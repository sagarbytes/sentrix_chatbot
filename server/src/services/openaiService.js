import 'dotenv/config';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

// ─── Load system prompts from dedicated .txt files ────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
const PROMPTS_DIR = join(__dirname, '..', 'prompts');

const PHASE1_SYSTEM_PROMPT = readFileSync(join(PROMPTS_DIR, 'phase1_match.txt'), 'utf-8').trim();
const PHASE2_SYSTEM_PROMPT = readFileSync(join(PROMPTS_DIR, 'phase2_classify.txt'), 'utf-8').trim();

console.log('[openaiService] Loaded system prompts from disk.');

// ─── Severity: Numeric → Human-Readable Label ────────────────────────────────
// Maps the raw `severity` smallint from va_issues to a plain-text label.
// Scale confirmed from database distribution and ai_remediation JSON content.
const SEVERITY_LABELS = {
  1: 'Low',
  2: 'Medium',
  3: 'High',
  4: 'Critical'
};

function resolveSeverityLabel(rawSeverity) {
  const num = parseInt(rawSeverity, 10);
  return SEVERITY_LABELS[num] || String(rawSeverity);
}

// ─── DB Category: Numeric → Descriptive Hint ─────────────────────────────────
// Maps the `category` smallint from va_issues to a descriptive hint string
// that helps GPT Phase 2 select the correct business category.
// This is NOT a hardcoded vulnerability→category mapping — it is a data-source
// hint that GPT uses as supporting evidence alongside the category definitions.
//
// IMPORTANT: DB category 1 contains TWO distinct finding types:
//   - Deprecated API usage (e.g. Client_JQuery_Deprecated_Symbols) → Browser Related
//   - Outdated/vulnerable package versions (e.g. Npm-jquery-1.11.1) → Software Upgrade
// The hint must therefore be neutral for category 1 — GPT must rely on the
// threat and synopsis fields (not this hint) to distinguish between these two.
const DB_CATEGORY_HINTS = {
  1: 'Client-side JavaScript library issue — refer to the threat and synopsis to determine whether this is a deprecated API usage in code (Browser Related) or an outdated/vulnerable library version (Software Upgrade)',
  2: 'Application-level security weakness (logic flaw, session, data handling, or access control issue)',
  5: 'SSL/TLS certificate or transport-layer encryption issue'
};

function resolveDbCategoryHint(rawCategory) {
  const num = parseInt(rawCategory, 10);
  return DB_CATEGORY_HINTS[num] || null;
}

// ─── ai_remediation JSON Parser ───────────────────────────────────────────────
// The ai_remediation column stores a structured JSON object.
// We extract only the fields useful for GPT remediation generation:
//   - remediation_text    : concise AI-written fix description
//   - verification_steps  : array of verification actions
// Returns null fields gracefully if the JSON is missing or malformed.
function parseAiRemediation(raw) {
  if (!raw) return { remediationText: null, verificationSteps: null };
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const remediationText = parsed.remediation_text || null;
    const steps = Array.isArray(parsed.verification_steps) ? parsed.verification_steps : null;
    const verificationSteps = steps ? steps.join(' | ') : null;
    return { remediationText, verificationSteps };
  } catch {
    return { remediationText: null, verificationSteps: null };
  }
}

// ─── Phase 1: Vulnerability Matching ─────────────────────────────────────────

/**
 * Asks GPT to identify the single most relevant vulnerability title
 * from the pre-filtered candidate list, based on the user's message.
 *
 * System prompt is loaded from: server/src/prompts/phase1_match.txt
 * Temperature 0 for deterministic, consistent matching.
 *
 * @param {string} userMessage - The user's natural language security description
 * @param {string[]} titles    - Pre-filtered list of candidate vulnerability titles
 * @returns {Promise<string>}  - Exact matched title, or 'NO_MATCH'
 */
export async function matchVulnerability(userMessage, titles) {
  const titlesBlock = titles.join('\n');

  const completion = await client.chat.completions.create({
    model: MODEL,
    temperature: 0,
    messages: [
      {
        role: 'system',
        content: PHASE1_SYSTEM_PROMPT
      },
      {
        role: 'user',
        content: [
          `User-reported issue:\n${userMessage}`,
          '',
          `Vulnerability titles:\n${titlesBlock}`
        ].join('\n')
      }
    ]
  });

  const matched = completion.choices[0]?.message?.content?.trim() || 'NO_MATCH';
  console.log(`[GPT Phase 1] Matched: "${matched}"`);
  return matched;
}

// ─── Phase 2: Classification & Remediation ────────────────────────────────────

/**
 * Asks GPT to classify a vulnerability into a business category and
 * generate structured remediation guidance.
 *
 * Improvements in this version:
 *  - Severity is converted from numeric (1–4) to a plain-text label before sending.
 *  - The DB `category` field is resolved to a descriptive hint and passed as signal.
 *  - `solution` (vendor text) and `ai_remediation` (parsed JSON fields) are passed
 *    as separate, distinctly labelled fields so GPT can weight them correctly.
 *  - Remediation output is structured in three labelled parts: Immediate Actions,
 *    Verification, and Long-Term Measures.
 *
 * System prompt is loaded from: server/src/prompts/phase2_classify.txt
 * Temperature 0 for deterministic classification; remediation will still
 * vary naturally based on input context.
 *
 * @param {string}   userMessage    - Original user issue description
 * @param {Object}   vulnerability  - Full record from va_issues (including `category`)
 * @param {string[]} categories     - Available business categories
 * @returns {Promise<Object>}       - { matched_vulnerability, category, severity, remediation }
 */
export async function classifyAndRemediate(userMessage, vulnerability, categories) {
  const categoriesBlock = categories.join('\n');

  // Convert raw DB severity integer to a human-readable label
  const severityLabel = resolveSeverityLabel(vulnerability.severity);

  // Resolve the DB category number to a descriptive classification hint
  const dbCategoryHint = resolveDbCategoryHint(vulnerability.category);

  // Parse structured fields from the ai_remediation JSON column
  const { remediationText, verificationSteps } = parseAiRemediation(vulnerability.ai_remediation);

  // Build the vulnerability context block with clearly labelled, separate fields.
  // This allows GPT to distinguish vendor-certified advice from AI-generated content.
  const vulnBlockLines = [
    `Title           : ${vulnerability.title}`,
    `Severity        : ${severityLabel}`,
    `Synopsis        : ${vulnerability.synopsis || 'N/A'}`,
    `Threat          : ${vulnerability.threat || 'N/A'}`,
    `Technology      : ${vulnerability.technology || 'N/A'}`,
    `Vendor Solution : ${vulnerability.solution || 'N/A'}`,
    `AI Remediation Text : ${remediationText || 'N/A'}`,
    `AI Verification Steps : ${verificationSteps || 'N/A'}`
  ];

  // Only append the DB category hint if one is available
  if (dbCategoryHint) {
    vulnBlockLines.push(`DB Category Hint : ${dbCategoryHint}`);
  }

  const vulnBlock = vulnBlockLines.join('\n');

  const completion = await client.chat.completions.create({
    model: MODEL,
    temperature: 0,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: PHASE2_SYSTEM_PROMPT
      },
      {
        role: 'user',
        content: [
          `User issue:\n${userMessage}`,
          '',
          `Matched vulnerability record:\n${vulnBlock}`,
          '',
          `Available business categories:\n${categoriesBlock}`
        ].join('\n')
      }
    ]
  });

  const raw = completion.choices[0]?.message?.content || '{}';

  // Parse and validate — throw on malformed response so the route can handle it
  const parsed = JSON.parse(raw);

  if (!parsed.matched_vulnerability || !parsed.category || !parsed.severity || !parsed.remediation) {
    throw new Error('GPT Phase 2 returned an incomplete JSON structure.');
  }

  console.log(`[GPT Phase 2] Category: "${parsed.category}", Severity: "${parsed.severity}"`);
  return parsed;
}
