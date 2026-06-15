import 'dotenv/config';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import OpenAI from 'openai';
import { CATEGORIES, SUBCATEGORIES } from '../config/categories.js';

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
// that helps GPT Phase 2 select the correct enterprise security category.
// This is NOT a hardcoded vulnerability→category mapping — it is a data-source
// hint that GPT uses as supporting evidence alongside the taxonomy definitions.
//
// IMPORTANT: DB category 1 contains TWO distinct finding types:
//   - Deprecated API usage (e.g. Client_JQuery_Deprecated_Symbols)
//     → Input Handling & Injection (Cross-Site Scripting (XSS))
//   - Outdated/vulnerable package versions (e.g. Npm-jquery-1.11.1)
//     → Input Handling & Injection or Network & Communication Security
// The hint must therefore be neutral for category 1 — GPT must rely on the
// threat and synopsis fields (not this hint) to distinguish between these two.
const DB_CATEGORY_HINTS = {
  1: 'Client-side JavaScript library issue — refer to the threat and synopsis to determine whether this is a deprecated API usage in code (fix = refactor code) or an outdated/vulnerable library version (fix = upgrade version)',
  2: 'Application-level security weakness (logic flaw, session, data handling, or access control issue). Examples include: CSRF, Mass Assignment, HSTS misconfiguration, session issues, hidden-field privilege bypass, path traversal, privacy violation, cookie misconfigurations, trust boundary violations.',
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

  // ── Diagnostic: log candidate set size and whether key titles are present ─
  console.log(`[GPT Phase 1] Candidate set size: ${titles.length}`);
  const hstsCandidates = titles.filter(t => /hsts|strict.transport/i.test(t));
  const massAssignCandidates = titles.filter(t => /mass.assign/i.test(t));
  const idorCandidates = titles.filter(t => /idor|insecure.direct|access.control|horizontal/i.test(t));
  if (hstsCandidates.length > 0)   console.log(`[GPT Phase 1] HSTS candidates in set: ${hstsCandidates.join(', ')}`);
  if (massAssignCandidates.length > 0) console.log(`[GPT Phase 1] Mass Assignment candidates in set: ${massAssignCandidates.join(', ')}`);
  if (idorCandidates.length > 0)   console.log(`[GPT Phase 1] IDOR/Access Control candidates in set: ${idorCandidates.join(', ')}`);

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

  const rawMatch = completion.choices[0]?.message?.content?.trim() || 'NO_MATCH';

  // Strip any markdown fences or extra surrounding text that GPT might add
  // even though the prompt says to return only the title.
  const matched = rawMatch
    .replace(/^```[\w]*\n?/, '')
    .replace(/\n?```$/, '')
    .replace(/^["'`]|["'`]$/g, '')
    .replace(/[.,;!?]+$/, '')
    .trim() || 'NO_MATCH';

  if (matched !== rawMatch) {
    console.log(`[GPT Phase 1] ⚠️  Raw output sanitized: "${rawMatch}" → "${matched}"`);
  } else {
    console.log(`[GPT Phase 1] Matched: "${matched}"`);
  }
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
// ─── OWASP Synopsis Sanitizer ─────────────────────────────────────────────────
// Some DB records store the OWASP Top-10 category name in the `synopsis` field
// (e.g. "Identification and Authentication Failures", "Software and Data Integrity Failures").
// These are metadata labels, NOT descriptions of the vulnerability.
// If GPT reads them as classification signals it will try to output the OWASP
// category name — which fails taxonomy validation because it is not in our taxonomy.
// We annotate such values so GPT knows to ignore them for classification purposes.
const OWASP_SYNOPSIS_PATTERNS = [
  /broken access control/i,
  /cryptographic failure/i,
  /injection/i,
  /insecure design/i,
  /security misconfiguration/i,
  /vulnerable.*outdated.*component/i,
  /identification.*authentication.*failure/i,
  /software.*data.*integrity.*failure/i,
  /security.*logging.*monitoring.*failure/i,
  /server.side.*request.*forgery/i
];

function sanitizeSynopsis(synopsis) {
  if (!synopsis) return 'N/A';
  const isOwaspLabel = OWASP_SYNOPSIS_PATTERNS.some(p => p.test(synopsis));
  if (isOwaspLabel) {
    // Annotate clearly so GPT treats it as a metadata tag, not a classification guide
    return `[OWASP label — do NOT use as taxonomy category] ${synopsis}`;
  }
  return synopsis;
}

export async function classifyAndRemediate(userMessage, vulnerability, categories, virtualContext = null) {
  const categoriesBlock = categories.join('\n');

  // Convert raw DB severity integer to a human-readable label
  const severityLabel = resolveSeverityLabel(vulnerability.severity);

  // Resolve the DB category number to a descriptive classification hint
  const dbCategoryHint = resolveDbCategoryHint(vulnerability.category);

  // Parse structured fields from the ai_remediation JSON column
  const { remediationText, verificationSteps } = parseAiRemediation(vulnerability.ai_remediation);

  // Sanitize the synopsis field — some records store an OWASP category name here
  // which would mislead GPT into outputting a non-taxonomy category string.
  const sanitizedSynopsis = sanitizeSynopsis(vulnerability.synopsis);

  // Build the vulnerability context block with clearly labelled, separate fields.
  // This allows GPT to distinguish vendor-certified advice from AI-generated content.
  const vulnBlockLines = [
    `Title           : ${vulnerability.title}`,
    `Severity        : ${severityLabel}`,
    `Synopsis        : ${sanitizedSynopsis}`,
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

  // ── Virtual context override ──────────────────────────────────────────────
  // When the matched title is a virtual label (e.g. "Debug_Modes_Enabled") that
  // was resolved to a proxy DB record, inject an explicit override line so GPT
  // classifies based on the user's ACTUAL reported vulnerability type and not
  // the proxy record's content (which may describe a different issue entirely).
  if (virtualContext) {
    vulnBlockLines.unshift(
      `CLASSIFICATION OVERRIDE: The user's actual reported vulnerability is "${virtualContext}". ` +
      `Classify and remediate based on this label and the user's description above. ` +
      `Ignore any session/token content in the record below that does not relate to this issue.`
    );
    console.log(`[GPT Phase 2] Virtual context override injected: "${virtualContext}"`);
  }

  const vulnBlock = vulnBlockLines.join('\n');
  console.log(`[GPT Phase 2] Sending vulnerability context to GPT:\n${vulnBlock}`);

  const completion = await client.chat.completions.create({
    model: MODEL,
    temperature: 0,
    max_tokens: 3000,        // ensure enough room for type + full remediation without truncation
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
  console.log(`[GPT Phase 2] Raw GPT response (first 800 chars):\n${raw.substring(0, 800)}`);

  // ── Step 1: Parse and validate field presence ─────────────────────────────
  // Strip markdown code fences if GPT wraps output despite json_object mode
  const cleanRaw = raw
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/, '')
    .replace(/\s*```$/, '')
    .trim();

  let parsed;
  try {
    parsed = JSON.parse(cleanRaw);
    console.log(`[GPT Phase 2] ✅ Step 1 — JSON parsed successfully. Keys: ${Object.keys(parsed).join(', ')}`);
  } catch (parseErr) {
    console.error(
      `[GPT Phase 2] ❌ Step 1 — JSON parse failed.\n` +
      `  Parse error : ${parseErr.message}\n` +
      `  Raw output  :\n${raw.substring(0, 500)}`
    );
    throw new Error(`GPT Phase 2 returned unparseable JSON: ${parseErr.message}`);
  }

  const missingFields = ['matched_vulnerability', 'category', 'subcategory', 'severity', 'remediation', 'type']
    .filter(f => !parsed[f]);
  if (missingFields.length > 0) {
    console.error(
      `[GPT Phase 2] ❌ Step 1 — Incomplete JSON structure.\n` +
      `  Missing fields: ${missingFields.join(', ')}\n` +
      `  Parsed object : ${JSON.stringify(parsed).substring(0, 400)}`
    );
    throw new Error(`GPT Phase 2 returned an incomplete JSON structure. Missing: ${missingFields.join(', ')}.`);
  }
  console.log(`[GPT Phase 2] ✅ Step 1 — All required fields present.`);

  // ── Step 2: Strict taxonomy validation ───────────────────────────────────
  // Verify that both category and subcategory belong to the approved
  // Enterprise Security Taxonomy defined in config/categories.js.
  // This prevents hallucinated classifications from reaching the UI.

  console.log(`[GPT Phase 2] Step 2 — Validating category: "${parsed.category}"`);
  if (!CATEGORIES.includes(parsed.category)) {
    const allowed = CATEGORIES.join('\n  - ');
    console.error(
      `[GPT Phase 2] ❌ Step 2 — Invalid taxonomy category.\n` +
      `  Category returned : "${parsed.category}"\n` +
      `  Expected one of   :\n  - ${allowed}`
    );
    throw new Error(
      `GPT Phase 2 returned an unrecognised category: "${parsed.category}". ` +
      `Expected one of the approved enterprise taxonomy categories.`
    );
  }
  console.log(`[GPT Phase 2] ✅ Step 2 — Category valid: "${parsed.category}"`);

  // Normalise subcategory whitespace around slashes before comparison.
  // GPT sometimes returns "IDOR/BOLA" instead of "IDOR / BOLA".
  // This normalisation prevents a false taxonomy failure on spacing alone.
  const normaliseSubcat = (s) => s.replace(/\s*\/\s*/g, ' / ').trim();
  const normalisedSubcat = normaliseSubcat(parsed.subcategory);
  const allowedSubcategories = (SUBCATEGORIES[parsed.category] || []).map(normaliseSubcat);

  console.log(
    `[GPT Phase 2] Step 2 — Validating subcategory: "${parsed.subcategory}" ` +
    `(normalised: "${normalisedSubcat}") under category "${parsed.category}".\n` +
    `  Allowed subcategories: ${allowedSubcategories.join(' | ')}`
  );

  if (!allowedSubcategories.includes(normalisedSubcat)) {
    const allowed = allowedSubcategories.join('\n  - ');
    console.error(
      `[GPT Phase 2] ❌ Step 2 — Invalid taxonomy subcategory.\n` +
      `  Category    : ${parsed.category}\n` +
      `  Subcategory returned (raw)       : "${parsed.subcategory}"\n` +
      `  Subcategory returned (normalised): "${normalisedSubcat}"\n` +
      `  Expected one of:\n  - ${allowed}`
    );
    throw new Error(
      `GPT Phase 2 returned an unrecognised subcategory: "${parsed.subcategory}" ` +
      `under category "${parsed.category}". ` +
      `Expected one of: ${allowedSubcategories.join(', ')}.`
    );
  }
  // Store the normalised form so downstream consumers see a canonical value
  parsed.subcategory = normalisedSubcat;
  console.log(`[GPT Phase 2] ✅ Step 2 — Subcategory valid (normalised): "${parsed.subcategory}"`);

  // ── Step 3: Remediation type validation ───────────────────────────────────
  const allowedTypes = ['Application Fix', 'Version Upgrade', 'Configuration Change'];
  console.log(`[GPT Phase 2] Step 3 — Validating remediation type: "${parsed.type}"`);
  if (!allowedTypes.includes(parsed.type)) {
    console.error(
      `[GPT Phase 2] ❌ Step 3 — Invalid remediation type.\n` +
      `  Type returned : "${parsed.type}"\n` +
      `  Expected one of: Application Fix, Version Upgrade, Configuration Change`
    );
    throw new Error(
      `GPT Phase 2 returned an unrecognised remediation type: "${parsed.type}". ` +
      `Expected one of: Application Fix, Version Upgrade, Configuration Change.`
    );
  }
  console.log(`[GPT Phase 2] ✅ Step 3 — Remediation type valid: "${parsed.type}"`);

  console.log(`[GPT Phase 2] ✅ All validations passed — Category: "${parsed.category}" / "${parsed.subcategory}", Type: "${parsed.type}", Severity: "${parsed.severity}"`);
  return parsed;
}
