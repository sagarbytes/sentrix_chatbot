import { Router } from 'express';
import { preFilterTitles, getVulnerabilityByTitle } from '../services/vulnerabilityService.js';
import { matchVulnerability, classifyAndRemediate } from '../services/openaiService.js';
import CATEGORIES from '../config/categories.js';

const router = Router();

/**
 * POST /api/chat
 *
 * Pipeline:
 *  Step 1 — SQL pre-filter: extract keywords from user message, run targeted
 *            LIKE query across title/synopsis/threat columns to get a narrow
 *            candidate set (falls back to all titles if set is too small).
 *
 *  Step 2 — GPT Phase 1: select the single best matching vulnerability title
 *            from the candidate set.
 *
 *  Step 3 — SQL fetch: retrieve the full vulnerability record by title.
 *
 *  Step 4 — GPT Phase 2: classify into a business category and generate
 *            a concise remediation recommendation.
 *
 * Request body : { message: string }
 * Success (200): { success: true, data: { matched_vulnerability, category, severity, remediation } }
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
      console.error('[Step 1] DB error:', dbErr.message);
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

    console.log(`[Step 1] Candidate titles: ${candidateTitles.length}`);

    // ── Step 2: GPT Phase 1 — match vulnerability title ─────────────────────
    let matchedTitle;
    try {
      matchedTitle = await matchVulnerability(userMessage, candidateTitles);
    } catch (aiErr) {
      console.error('[Step 2] OpenAI error:', aiErr.message);
      return res.status(503).json({
        success: false,
        message: 'AI service is temporarily unavailable. Please try again shortly.'
      });
    }

    if (!matchedTitle || matchedTitle === 'NO_MATCH') {
      return res.status(200).json({
        success: false,
        message: 'No relevant vulnerability was found matching your description. Try rephrasing or providing more specific technical details about the security issue.'
      });
    }

    // ── Step 3: SQL fetch — full vulnerability record ─────────────────────
    let vulnerability;
    try {
      vulnerability = await getVulnerabilityByTitle(matchedTitle);
    } catch (dbErr) {
      console.error('[Step 3] DB error:', dbErr.message);
      return res.status(503).json({
        success: false,
        message: 'Database is temporarily unavailable. Please try again shortly.'
      });
    }

    if (!vulnerability) {
      // GPT matched a title that doesn't exist verbatim — graceful fallback
      console.warn(`[Step 3] Title "${matchedTitle}" not found in DB. GPT may have paraphrased.`);
      return res.status(200).json({
        success: false,
        message: `A vulnerability was identified (${matchedTitle}), but its full record could not be retrieved. Please contact your administrator.`
      });
    }

    // ── Step 4: GPT Phase 2 — classify + remediate ──────────────────────────
    let result;
    try {
      result = await classifyAndRemediate(userMessage, vulnerability, CATEGORIES);
    } catch (aiErr) {
      console.error('[Step 4] OpenAI error:', aiErr.message);
      return res.status(503).json({
        success: false,
        message: 'AI classification service encountered an error. Please try again.'
      });
    }

    // ── Success ──────────────────────────────────────────────────────────────
    console.log(`[/api/chat] ✅ Done — ${result.matched_vulnerability} | ${result.category} | ${result.severity}`);

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
