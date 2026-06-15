import { Router } from 'express';
import { preFilterTitles, getVulnerabilityByTitle } from '../services/vulnerabilityService.js';
import { matchVulnerability, classifyAndRemediate } from '../services/openaiService.js';
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

/**
 * POST /api/chat
 *
 * Pipeline:
 *  Step 1 — SQL pre-filter: extract keywords from user message, run targeted
 *            LIKE query across title/synopsis/threat/technology columns to get
 *            a narrow candidate set (falls back to all titles if set is too small).
 *
 *  Step 2 — GPT Phase 1: select the single best matching vulnerability title
 *            from the candidate set. Returns exact title string or "NO_MATCH".
 *
 *  Step 3 — SQL fetch: retrieve the full vulnerability record by title.
 *            Uses three-tier resolution: exact → fuzzy prefix → case-insensitive LIKE.
 *
 *  Step 4 — GPT Phase 2: classify into a business category and generate
 *            a concise remediation recommendation.
 *
 * Request body : { message: string }
 * Success (200): { success: true, data: { matched_vulnerability, category, subcategory, severity, remediation, type } }
 * No match (200): { success: false, message: string }
 * Error (500/503): { success: false, message: string }
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
    // Guarantees that known hard-to-match vulnerability titles are always
    // included in the candidate set when the user message matches their pattern.
    candidateTitles = injectCriticalTitles(userMessage, candidateTitles);
    console.log(`[Step 1] Final candidate titles sent to Phase 1: ${candidateTitles.length}`);

    // ── Step 2: GPT Phase 1 — match vulnerability title ─────────────────────
    let matchedTitle;
    try {
      matchedTitle = await matchVulnerability(userMessage, candidateTitles);
    } catch (aiErr) {
      console.error('[Step 2] OpenAI Phase 1 error:', aiErr.message);
      return res.status(503).json({
        success: false,
        message: 'AI service is temporarily unavailable. Please try again shortly.'
      });
    }

    // ── Step 2a: Sanitize Phase 1 output ─────────────────────────────────────
    // GPT may occasionally wrap the title in quotes or add trailing punctuation.
    // Strip those so the exact title lookup has the best chance of succeeding.
    const cleanedTitle = matchedTitle
      .replace(/^["'`]|["'`]$/g, '')   // remove surrounding quotes
      .replace(/[.,;!?]+$/, '')          // remove trailing punctuation
      .trim();

    if (cleanedTitle !== matchedTitle) {
      console.log(`[Step 2] ⚠️  Phase 1 output sanitized: "${matchedTitle}" → "${cleanedTitle}"`);
      matchedTitle = cleanedTitle;
    }

    if (!matchedTitle || matchedTitle === 'NO_MATCH') {
      console.log('[Step 2] GPT Phase 1 returned NO_MATCH');
      return res.status(200).json({
        success: false,
        message: 'No relevant vulnerability was found matching your description. Try rephrasing or providing more specific technical details about the security issue.'
      });
    }

    console.log(`[Step 2] GPT Phase 1 matched: "${matchedTitle}"`);

    // ── Step 2b: Virtual title alias resolution ────────────────────────────────
    // Maps GPT shorthand labels (that are NOT real DB titles) to their correct
    // DB counterparts. Runs after sanitization, before the DB lookup.
    // This lets prompt authors use human-readable labels like "IDOR" in the
    // semantic mapping table without those labels needing to exist in the DB.
    const VIRTUAL_TITLE_ALIASES = {
      'IDOR':               'Privacy_Violation',    // IDOR → access to other users' records
      'Debug_Modes_Enabled': 'Session Misconfiguration'  // debug in prod → nearest config-level DB record
    };

    // Track whether a virtual alias was applied and what the original label was.
    // This is forwarded to Phase 2 so GPT classifies by the actual vulnerability
    // type, not by the proxy DB record's content.
    let virtualContext = null;

    if (VIRTUAL_TITLE_ALIASES[matchedTitle]) {
      const alias = VIRTUAL_TITLE_ALIASES[matchedTitle];
      virtualContext = matchedTitle;   // preserve original label for Phase 2 override
      console.log(`[Step 2b] Virtual title alias resolved: "${matchedTitle}" → "${alias}" (virtualContext retained)`);
      matchedTitle = alias;
    } else {
      console.log('[Step 2b] No virtual alias needed.');
    }

    // ── Step 3: SQL fetch — full vulnerability record ─────────────────────
    let vulnerability;
    let resolvedTitle;
    try {
      const result = await getVulnerabilityByTitle(matchedTitle);
      vulnerability = result.record;
      resolvedTitle = result.resolvedTitle;
    } catch (dbErr) {
      console.error('[Step 3] DB error during record fetch:', dbErr.message);
      return res.status(503).json({
        success: false,
        message: 'Database is temporarily unavailable. Please try again shortly.'
      });
    }

    if (!vulnerability) {
      // All three resolution tiers failed — GPT matched something not in DB at all
      console.warn(`[Step 3] ❌ Title "${matchedTitle}" not found in DB after all resolution attempts.`);
      return res.status(200).json({
        success: false,
        message: `A vulnerability was identified (${matchedTitle}), but its full record could not be retrieved. Please contact your administrator.`
      });
    }

    console.log(`[Step 3] Record retrieved: "${resolvedTitle}" (requested: "${matchedTitle}")`);

    // ── Step 4: GPT Phase 2 — classify + remediate ──────────────────────────
    let result;
    try {
      result = await classifyAndRemediate(userMessage, vulnerability, CATEGORIES, virtualContext);
    } catch (aiErr) {
      console.error('[Step 4] OpenAI Phase 2 error:', aiErr.message);
      return res.status(503).json({
        success: false,
        message: 'AI classification service encountered an error. Please try again.'
      });
    }

    // ── Success ───────────────────────────────────────────────────────────────────
    console.log(`[/api/chat] ✅ Done — ${result.matched_vulnerability} | ${result.category} / ${result.subcategory} | Type: ${result.type} | ${result.severity}`);

    return res.status(200).json({
      success: true,
      data: result
    });

  } catch (unexpectedErr) {
    console.error('[/api/chat] Unexpected error:', unexpectedErr);
    return res.status(500).json({
      success: false,
      message: 'An unexpected error occurred. Please try again.'
    });
  }
});

export default router;
