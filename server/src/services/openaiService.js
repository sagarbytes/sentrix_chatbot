import 'dotenv/config';
import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

// ─── Phase 1: Vulnerability Matching ─────────────────────────────────────────

/**
 * Asks GPT to identify the single most relevant vulnerability title
 * from the pre-filtered candidate list, based on the user's message.
 *
 * Prompt design:
 *  - System: strict instruction to return ONLY the exact title or NO_MATCH
 *  - User: issue description + the candidate title list
 *  - Temperature 0 for deterministic, consistent matching
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
        content: [
          'You are a cybersecurity vulnerability matching engine.',
          'You will receive a user-reported security issue and a list of known vulnerability titles.',
          'Your task: identify the single most relevant vulnerability title from the list.',
          '',
          'Rules:',
          '- Respond with ONLY the exact title string from the list — nothing else.',
          '- Do not add explanation, punctuation, or surrounding text.',
          '- If no title is relevant to the described issue, respond with exactly: NO_MATCH'
        ].join('\n')
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
 * generate a concise remediation recommendation.
 *
 * Prompt design:
 *  - System: structured JSON output instructions with exact field names
 *  - User: issue + full vulnerability record fields + available categories
 *  - Temperature 0.2 for slightly more natural remediation prose
 *
 * @param {string}   userMessage    - Original user issue description
 * @param {Object}   vulnerability  - Full record from va_issues
 * @param {string[]} categories     - Available business categories
 * @returns {Promise<Object>}       - { matched_vulnerability, category, severity, remediation }
 */
export async function classifyAndRemediate(userMessage, vulnerability, categories) {
  const categoriesBlock = categories.join('\n');

  // Build vulnerability context — use ai_remediation if populated, else solution
  const remediationHint = vulnerability.ai_remediation || vulnerability.solution || '';

  const vulnBlock = [
    `Title      : ${vulnerability.title}`,
    `Severity   : ${vulnerability.severity || 'Unknown'}`,
    `Risk Factor: ${vulnerability.risk_factor || 'Unknown'}`,
    `Synopsis   : ${vulnerability.synopsis || ''}`,
    `Threat     : ${vulnerability.threat || ''}`,
    `Technology : ${vulnerability.technology || ''}`,
    `Remediation: ${remediationHint}`
  ].join('\n');

  const completion = await client.chat.completions.create({
    model: MODEL,
    temperature: 0.2,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: [
          'You are a cybersecurity remediation assistant.',
          'You will receive a user security issue, a matched vulnerability record, and a list of business categories.',
          '',
          'Return a JSON object with EXACTLY these four fields:',
          '  "matched_vulnerability" : the vulnerability title (string)',
          '  "category"              : the most appropriate category from the provided list (string)',
          '  "severity"              : the severity from the vulnerability record (string)',
          '  "remediation"           : a clear, actionable remediation (2–4 sentences, plain text)',
          '',
          'Category selection rules:',
          '- Choose from the provided list only — do not invent new categories.',
          '- Base the selection on the vulnerability synopsis, threat, and technology fields.',
          '',
          'Return ONLY valid JSON. No markdown, no code fences, no extra keys.'
        ].join('\n')
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
