import { Router } from 'express';
import { preFilterTitles, getVulnerabilityByTitle } from '../services/vulnerabilityService.js';
import { matchVulnerability, matchMultipleVulnerabilities, classifyAndRemediate } from '../services/openaiService.js';
import { CATEGORIES } from '../config/categories.js';

const router = Router();

// ─── Critical Title Injection Map ──────────────────────────────────────────────
// For vulnerability types whose natural-language descriptions share few literal
// words with the DB title, we use a pattern match on the user message to
// guarantee the correct DB title is always present in the Phase 1 candidate set.
//
// This is a deterministic safety net — it runs AFTER the SQL pre-filter.
// It only ADDS titles to the candidate list; it never removes any.
const CRITICAL_TITLE_INJECTIONS = [
  {
    // HSTS: user phrases mention downgrade, enforce HTTPS, or missing HSTS header
    patterns: [
      /hsts/i,
      /strict.transport/i,
      /downgrade/i,
      /browsers?\s+do\s+not\s+enforce/i,
      /https?\s+not\s+enforced/i,
      /enforce\s+https/i,
      /missing.*strict.transport/i
    ],
    title: 'Missing_HSTS_Header'
  },
  {
    // Mass Assignment: hidden fields, parameter modification for admin-only updates
    patterns: [
      /mass\s+assign/i,
      /hidden\s+(request\s+)?param/i,
      /hidden\s+field/i,
      /admin.only\s+field/i,
      /update\s+fields?.*admin/i,
      /over.post/i
    ],
    title: 'Mass Assignment'
  },
  {
    // IDOR: accessing other users' records by modifying identifiers
    patterns: [
      /\bidor\b/i,
      /insecure\s+direct\s+object/i,
      /access\s+records?\s+(belonging|of)\s+other\s+users?/i,
      /modify(ing)?\s+identifiers?\s+(in|within)\s+request/i,
      /access\s+other\s+users?[''s]?\s+data/i
    ],
    title: 'IDOR'
  },
  {
    // Debug modes: debug or diagnostic features enabled in production
    patterns: [
      /debug/i,
      /debugging/i,
      /diagnostic/i
    ],
    title: 'Debug_Modes_Enabled'
  }
];

/**
 * Injects known critical vulnerability titles into the candidate list
 * when the user message matches a pattern for that vulnerability type.
 * Deduplicates to avoid sending the same title twice.
 *
 * @param {string}   userMessage     - Raw user message
 * @param {string[]} candidateTitles - Current pre-filtered candidate list
 * @returns {string[]} Augmented candidate list
 */
function injectCriticalTitles(userMessage, candidateTitles) {
  const titleSet = new Set(candidateTitles);
  const injected = [];

  for (const { patterns, title } of CRITICAL_TITLE_INJECTIONS) {
    if (!title) continue;  // skip entries with no definitive title
    const matched = patterns.some(p => p.test(userMessage));
    if (matched && !titleSet.has(title)) {
      titleSet.add(title);
      injected.push(title);
      console.log(`[Step 1a] ⚠️  Critical title injected: "${title}" (pattern matched in user message)`);
    }
  }

  if (injected.length === 0) {
    console.log('[Step 1a] No critical title injection needed.');
  }

  return [...titleSet];
}

// ─── VIRTUAL TITLE ALIASES ─────────────────────────────────────────────────────
// Maps GPT shorthand labels (NOT real DB titles) to their correct DB counterparts.
// Shared between single and multi-finding pipelines.
const VIRTUAL_TITLE_ALIASES = {
  'IDOR':               'Privacy_Violation',       // IDOR → access to other users' records
  'Debug_Modes_Enabled': 'Session Misconfiguration' // debug in prod → nearest config-level DB record
};

/**
 * Runs Steps 2b–4 for a single matched title:
 *  - Virtual alias resolution
 *  - DB record fetch (three-tier)
 *  - GPT Phase 2 classify + remediate
 *
 * Returns { result } on success, or { error: string } on soft failure
 * (so the caller can skip failed findings gracefully in the multi path).
 *
 * @param {string} rawTitle     - Title from Phase 1 (already sanitized)
 * @param {string} userMessage  - Original user message (for Phase 2 context)
 * @returns {Promise<{result?: Object, error?: string}>}
 */
async function runSingleFindingPipeline(rawTitle, userMessage) {
  // ── Virtual alias resolution ─────────────────────────────────────────────
  let matchedTitle = rawTitle;
  let virtualContext = null;

  if (VIRTUAL_TITLE_ALIASES[matchedTitle]) {
    const alias = VIRTUAL_TITLE_ALIASES[matchedTitle];
    virtualContext = matchedTitle;
    console.log(`[Pipeline] Virtual alias: "${matchedTitle}" → "${alias}"`);
    matchedTitle = alias;
  }

  // ── DB fetch ─────────────────────────────────────────────────────────────
  let vulnerability;
  try {
    const dbResult = await getVulnerabilityByTitle(matchedTitle);
    vulnerability = dbResult.record;
  } catch (dbErr) {
    console.error(`[Pipeline] DB error for "${matchedTitle}":`, dbErr.message);
    return { error: `DB unavailable for "${rawTitle}"` };
  }

  if (!vulnerability) {
    console.warn(`[Pipeline] ❌ No DB record for "${matchedTitle}"`);
    return { error: `Record not found for "${rawTitle}"` };
  }

  // ── GPT Phase 2 ───────────────────────────────────────────────────────────
  try {
    const result = await classifyAndRemediate(userMessage, vulnerability, CATEGORIES, virtualContext);
    return { result };
  } catch (aiErr) {
    console.error(`[Pipeline] Phase 2 error for "${rawTitle}":`, aiErr.message);
    return { error: `Classification failed for "${rawTitle}"` };
  }
}

/**
 * POST /api/chat
 *
 * Automatically detects single vs. multi-finding inputs:
 *
 * Single finding path (backward compatible):
 *   Response: { success: true, data: { matched_vulnerability, category, subcategory, severity, remediation, type } }
 *
 * Multi-finding path (new):
 *   Response: { success: true, multi: true, findings: [ ...singleDataObjects ] }
 *
 * No match: { success: false, message: string }
 * Error:    { success: false, message: string }
 *
 * Pipeline:
 *  Step 1  — SQL pre-filter + critical title injection
 *  Step 1b — GPT Multi-Match: detect ALL matched vulnerability titles
 *  Step 2  — If multi (>1 title): run Steps 2b–4 in parallel for each title
 *            If single (1 title): run the standard single-finding path
 *  Steps 2b–4 — Virtual alias → DB fetch → GPT Phase 2 (per finding)
 */
router.post('/chat', async (req, res) => {
  const { message } = req.body;

  // ── Validate input ───────────────────────────────────────────────────────
  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Request body must include a non-empty "message" string.'
    });
  }

  const userMessage = message.trim();
  console.log(`\n[/api/chat] Received: "${userMessage.substring(0, 80)}${userMessage.length > 80 ? '...' : ''}"`);

  try {
    // ── Step 1: SQL pre-filter ───────────────────────────────────────────────
    let candidateTitles;
    try {
      candidateTitles = await preFilterTitles(userMessage);
    } catch (dbErr) {
      console.error('[Step 1] DB error during pre-filter:', dbErr.message);
      return res.status(503).json({
        success: false,
        message: 'Database is temporarily unavailable. Please try again shortly.'
      });
    }

    if (candidateTitles.length === 0) {
      return res.status(200).json({
        success: false,
        message: 'The vulnerability database appears to be empty. Please contact your administrator.'
      });
    }

    console.log(`[Step 1] Candidate titles from pre-filter: ${candidateTitles.length}`);

    // ── Step 1a: Critical title injection ────────────────────────────────────
    candidateTitles = injectCriticalTitles(userMessage, candidateTitles);
    console.log(`[Step 1] Final candidate titles sent to Phase 1: ${candidateTitles.length}`);

    // ── Step 1b: Multi-Match — detect ALL vulnerabilities in the input ────────
    let matchedTitles;
    try {
      matchedTitles = await matchMultipleVulnerabilities(userMessage, candidateTitles);
    } catch (aiErr) {
      console.error('[Step 1b] Multi-Match error:', aiErr.message);
      return res.status(503).json({
        success: false,
        message: 'AI service is temporarily unavailable. Please try again shortly.'
      });
    }

    if (matchedTitles.length === 0) {
      // ── Fallback: try single-match in case multi-match is overly strict ────
      console.log('[Step 1b] Multi-match returned 0 — falling back to single-match Phase 1');
      let singleTitle;
      try {
        singleTitle = await matchVulnerability(userMessage, candidateTitles);
      } catch (aiErr) {
        console.error('[Step 2 fallback] OpenAI Phase 1 error:', aiErr.message);
        return res.status(503).json({
          success: false,
          message: 'AI service is temporarily unavailable. Please try again shortly.'
        });
      }

      const cleanedSingle = singleTitle
        .replace(/^["'`]|["'`]$/g, '')
        .replace(/[.,;!?]+$/, '')
        .trim();

      if (!cleanedSingle || cleanedSingle === 'NO_MATCH') {
        return res.status(200).json({
          success: false,
          message: 'No relevant vulnerability was found matching your description. Try rephrasing or providing more specific technical details about the security issue.'
        });
      }
      matchedTitles = [cleanedSingle];
    }

    // ── Route: single vs. multi ──────────────────────────────────────────────
    if (matchedTitles.length === 1) {
      // ── SINGLE FINDING — original pipeline, original response shape ──────
      console.log(`[/api/chat] Single finding: "${matchedTitles[0]}"`);
      const { result, error } = await runSingleFindingPipeline(matchedTitles[0], userMessage);

      if (error) {
        return res.status(200).json({ success: false, message: error });
      }

      console.log(`[/api/chat] ✅ Done — ${result.matched_vulnerability} | ${result.category} / ${result.subcategory} | Type: ${result.type} | ${result.severity}`);
      return res.status(200).json({ success: true, data: result });

    } else {
      // ── MULTI-FINDING — run all pipelines in parallel ────────────────────
      console.log(`[/api/chat] Multi-finding: ${matchedTitles.length} vulnerabilities detected: ${matchedTitles.join(', ')}`);

      const pipelineResults = await Promise.all(
        matchedTitles.map(title => runSingleFindingPipeline(title, userMessage))
      );

      const successfulFindings = pipelineResults
        .filter(r => r.result)
        .map(r => r.result);

      const failedTitles = pipelineResults
        .map((r, i) => r.error ? matchedTitles[i] : null)
        .filter(Boolean);

      if (failedTitles.length > 0) {
        console.warn(`[/api/chat] ⚠️  Some findings failed: ${failedTitles.join(', ')}`);
      }

      if (successfulFindings.length === 0) {
        return res.status(200).json({
          success: false,
          message: 'Multiple vulnerabilities were detected but none could be fully classified. Please try again.'
        });
      }

      if (successfulFindings.length === 1) {
        // Degrade gracefully to single if only 1 succeeded
        console.log(`[/api/chat] ✅ Degraded to single-finding (only 1 of ${matchedTitles.length} succeeded)`);
        return res.status(200).json({ success: true, data: successfulFindings[0] });
      }

      console.log(`[/api/chat] ✅ Multi-finding done — ${successfulFindings.length} findings`);
      return res.status(200).json({
        success: true,
        multi: true,
        findings: successfulFindings
      });
    }

  } catch (unexpectedErr) {
    console.error('[/api/chat] Unexpected error:', unexpectedErr);
    return res.status(500).json({
      success: false,
      message: 'An unexpected error occurred. Please try again.'
    });
  }
});

export default router;
