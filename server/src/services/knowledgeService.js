import 'dotenv/config';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import OpenAI from 'openai';
import pool from './db.js';
import { CATEGORIES, SUBCATEGORIES } from '../config/categories.js';


const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROMPTS_DIR = join(__dirname, '..', 'prompts');

const INTENT_SYSTEM_PROMPT = readFileSync(join(PROMPTS_DIR, 'intent_detect.txt'), 'utf-8').trim();
const SQL_SYSTEM_PROMPT = readFileSync(join(PROMPTS_DIR, 'text_to_sql.txt'), 'utf-8').trim();
const RESPONSE_SYSTEM_PROMPT = readFileSync(join(PROMPTS_DIR, 'knowledge_response.txt'), 'utf-8').trim();
const MAP_SYSTEM_PROMPT = readFileSync(join(PROMPTS_DIR, 'map_taxonomy.txt'), 'utf-8').trim();

/**
 * Strips comments (--, /*, #) from a SQL query string.
 * 
 * @param {string} sql - Raw SQL query
 * @returns {string} Clean SQL without comments
 */
export function stripSqlComments(sql) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, '') // Remove /* ... */
    .replace(/--.*$/gm, '')          // Remove -- ...
    .replace(/#.*$/gm, '')           // Remove # ...
    .trim();
}

/**
 * Validates a SQL query for read-only SELECT permissions and safety.
 * 
 * @param {string} sql - SQL query to validate
 * @returns {boolean} True if query is safe and allowed
 * @throws {Error} If query contains unauthorized actions or keywords
 */
export function validateAndCleanSQL(sql) {
  const strippedSql = stripSqlComments(sql);
  
  // Replace string literals with empty strings to avoid false positives on keywords
  // inside queries like: WHERE synopsis LIKE '%update%'
  const sqlWithoutStrings = strippedSql
    .replace(/'[^']*'/g, "''")
    .replace(/"[^"]*"/g, '""');

  const cleanSql = sqlWithoutStrings.trim().toLowerCase();

  // Verify that the query starts with an approved read-only command
  if (!cleanSql.startsWith('select') && !cleanSql.startsWith('show') && !cleanSql.startsWith('describe') && !cleanSql.startsWith('explain')) {
    throw new Error('Only SELECT, SHOW, DESCRIBE, or EXPLAIN statements are permitted.');
  }

  // Forbidden keywords checklist
  const forbiddenKeywords = [
    'insert', 'update', 'delete', 'drop', 'alter', 'truncate', 'replace',
    'create', 'grant', 'revoke', 'into outfile', 'into dumpfile', 'load_data'
  ];

  for (const keyword of forbiddenKeywords) {
    const regex = new RegExp(`\\b${keyword}\\b`, 'i');
    if (regex.test(sqlWithoutStrings)) {
      throw new Error(`Security validation failed: SQL query contains forbidden keyword "${keyword}".`);
    }
  }

  return true;
}

/**
 * Classifies user message intent (vulnerability_analysis vs knowledge_base_query)
 * 
 * @param {string} userMessage - Raw user input
 * @returns {Promise<{intent: string, reason: string}>} Classified intent
 */
export async function detectIntent(userMessage) {
  try {
    const completion = await client.chat.completions.create({
      model: MODEL,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: INTENT_SYSTEM_PROMPT
        },
        {
          role: 'user',
          content: userMessage
        }
      ]
    });

    const raw = completion.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(raw);
    return {
      intent: parsed.intent || 'vulnerability_analysis',
      reason: parsed.reason || ''
    };
  } catch (err) {
    console.error('[detectIntent] Error, defaulting to vulnerability_analysis:', err.message);
    return {
      intent: 'vulnerability_analysis',
      reason: 'Fallback due to detection error: ' + err.message
    };
  }
}

/**
 * Maps database vulnerability rows to the Enterprise Security Taxonomy.
 * 
 * @param {Array<Object>} records - Raw DB rows
 * @returns {Promise<Array<Object>>} Mapped findings array
 */
/**
 * Enriches partial records (e.g. from grouped queries) with representative fields from the DB.
 */
async function enrichRecordForMapping(record) {
  if (!record || !record.title) return record;
  // If it already has descriptive fields, no enrichment needed
  if (record.synopsis && record.threat && record.category && record.severity) {
    return record;
  }
  try {
    const [rows] = await pool.execute(
      `SELECT title, category, severity, risk_factor, threat, solution, synopsis, technology, type
       FROM va_issues
       WHERE title = ?
       LIMIT 1`,
      [record.title]
    );
    if (rows.length > 0) {
      // Merge: priority to original record's values (like custom count/aggregates)
      return { ...rows[0], ...record };
    }
  } catch (err) {
    console.error(`[enrichRecordForMapping] Error fetching representative record for "${record.title}":`, err.message);
  }
  return record;
}

/**
 * Resolves fields from database record using programmatic mappings where available.
 */
function getResolvedFields(rec) {
  let category = null;
  let subcategory = null;
  let severity = null;
  let type = null;

  // 1. Resolve Severity
  if (rec.severity !== undefined && rec.severity !== null) {
    const sevStr = String(rec.severity).trim();
    if (['low', 'medium', 'high', 'critical'].includes(sevStr.toLowerCase())) {
      severity = sevStr.charAt(0).toUpperCase() + sevStr.slice(1).toLowerCase();
    } else {
      const sevNum = parseInt(sevStr, 10);
      if (sevNum === 1) severity = 'Low';
      else if (sevNum === 2) severity = 'Medium';
      else if (sevNum === 3) severity = 'High';
      else if (sevNum === 4) severity = 'Critical';
    }
  }
  if (!severity && rec.risk_factor) {
    const rfStr = String(rec.risk_factor).trim();
    if (['low', 'medium', 'high', 'critical'].includes(rfStr.toLowerCase())) {
      severity = rfStr.charAt(0).toUpperCase() + rfStr.slice(1).toLowerCase();
    }
  }

  // 2. Resolve Category & Subcategory
  if (rec.category !== undefined && rec.category !== null) {
    const catStr = String(rec.category).trim();
    if (CATEGORIES.includes(catStr)) {
      category = catStr;
    } else {
      const catNum = parseInt(catStr, 10);
      if (catNum === 5) {
        category = 'Network & Communication Security';
      }
    }
  }

  if (rec.subcategory !== undefined && rec.subcategory !== null) {
    const subcatStr = String(rec.subcategory).trim();
    for (const [cat, subcats] of Object.entries(SUBCATEGORIES)) {
      if (subcats.includes(subcatStr)) {
        subcategory = subcatStr;
        if (!category) {
          category = cat;
        }
        break;
      }
    }
  }

  // 3. Resolve Type (Database-first, rules-based secondary checks)
  let resolvedType = null;
  if (rec.type !== undefined && rec.type !== null) {
    const typeStr = String(rec.type).trim();
    const validTypes = ['Application Fix', 'Version Upgrade', 'Configuration Change'];
    if (validTypes.includes(typeStr)) {
      resolvedType = typeStr;
    } else {
      const typeNum = parseInt(typeStr, 10);
      if (typeNum === 2) resolvedType = 'Version Upgrade';
      else if (typeNum === 3) resolvedType = 'Configuration Change';
    }
  }

  // Secondary checks: heuristic classification based on title and vulnerability context
  if (!resolvedType) {
    const titleLower = rec.title ? rec.title.toLowerCase() : '';
    // A. Third-party packages, outdated libraries -> Version Upgrade
    if (
      titleLower.startsWith('npm-') ||
      titleLower.startsWith('nuget-') ||
      titleLower.includes('vulnerable jquery version') ||
      titleLower.includes('vulnerable js file') ||
      titleLower.includes('outdated library')
    ) {
      resolvedType = 'Version Upgrade';
    }
    // B. Protocols, certificates, security headers, debug parameters -> Configuration Change
    else if (
      titleLower.includes('hsts') ||
      titleLower.includes('ssl certificate') ||
      titleLower.includes('insecure communication') ||
      titleLower.includes('debug_modes') ||
      titleLower.includes('session misconfiguration')
    ) {
      resolvedType = 'Configuration Change';
    }
    // C. Source code bugs -> Application Fix
    else {
      resolvedType = 'Application Fix';
    }
  }
  type = resolvedType;

  return { category, subcategory, severity, type };
}

function isFullyResolved(resolved) {
  return !!(
    resolved.category &&
    resolved.subcategory &&
    resolved.severity &&
    resolved.type
  );
}

function formatTitle(rec, llmTitle) {
  return llmTitle || rec.title || 'Unknown Vulnerability';
}

/**
 * Maps database vulnerability rows to the Enterprise Security Taxonomy.
 * 
 * @param {Array<Object>} records - Raw DB rows
 * @returns {Promise<Array<Object>>} Mapped findings array
 */
export async function mapDbRecordsToTaxonomy(records) {
  if (!records || records.length === 0) return [];
  try {
    // 1. Enrich records with full database details if they are partial (e.g. from grouped queries)
    const enrichedRecords = await Promise.all(records.map(enrichRecordForMapping));

    const finalFindings = new Array(records.length);
    const recordsToMap = [];
    const mappedIndices = [];

    for (let i = 0; i < enrichedRecords.length; i++) {
      const rec = enrichedRecords[i];
      const resolved = getResolvedFields(rec);
      
      const countKey = Object.keys(rec).find(k => k.toLowerCase().includes('count') || k.toLowerCase() === 'cnt');
      const occurrences = countKey ? rec[countKey] : null;

      if (isFullyResolved(resolved)) {
        // Already fully resolved programmatically (or from original fields)
        finalFindings[i] = {
          matched_vulnerability: formatTitle(rec, rec.title),
          occurrences: occurrences !== null ? Number(occurrences) : undefined,
          category: resolved.category,
          subcategory: resolved.subcategory,
          severity: resolved.severity,
          type: resolved.type
        };
      } else {
        // Needs AI mapping
        recordsToMap.push(rec);
        mappedIndices.push(i);
      }
    }

    // 2. Call LLM ONLY for records that need mapping
    if (recordsToMap.length > 0) {
      console.log(`[mapDbRecordsToTaxonomy] Calling LLM to map ${recordsToMap.length} records...`);
      const completion = await client.chat.completions.create({
        model: MODEL,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: MAP_SYSTEM_PROMPT
          },
          {
            role: 'user',
            content: JSON.stringify(recordsToMap.map(r => ({
              title: r.title,
              category: r.category,
              severity: r.severity,
              risk_factor: r.risk_factor,
              threat: r.threat,
              synopsis: r.synopsis,
              technology: r.technology,
              type: r.type
            })))
          }
        ]
      });

      const raw = completion.choices[0]?.message?.content || '{"findings":[]}';
      const parsed = JSON.parse(raw);
      const llmFindings = Array.isArray(parsed.findings) ? parsed.findings : [];

      for (let j = 0; j < recordsToMap.length; j++) {
        const origRec = recordsToMap[j];
        const resolved = getResolvedFields(origRec);
        const llmFinding = llmFindings[j] || {};
        const origIdx = mappedIndices[j];

        // Merge keeping resolved/existing DB fields as priority (STRICT: Severity is never mapped from LLM)
        const category = resolved.category || llmFinding.category || 'Uncategorized';
        const subcategory = resolved.subcategory || llmFinding.subcategory || 'Uncategorized';
        const severity = resolved.severity || 'Low';
        const type = resolved.type || llmFinding.type || 'Review Required';

        const countKey = Object.keys(origRec).find(k => k.toLowerCase().includes('count') || k.toLowerCase() === 'cnt');
        const occurrences = countKey ? origRec[countKey] : null;

        finalFindings[origIdx] = {
          matched_vulnerability: formatTitle(origRec, llmFinding.matched_vulnerability || origRec.title),
          occurrences: occurrences !== null ? Number(occurrences) : undefined,
          category,
          subcategory,
          severity,
          type
        };
      }
    }

    return finalFindings;
  } catch (err) {
    console.error('[mapDbRecordsToTaxonomy] Error mapping records:', err.message);
    // Fallback logic
    return records.map(rec => {
      const resolved = getResolvedFields(rec);
      const countKey = Object.keys(rec).find(k => k.toLowerCase().includes('count') || k.toLowerCase() === 'cnt');
      const occurrences = countKey ? rec[countKey] : null;
      return {
        matched_vulnerability: formatTitle(rec, rec.title),
        occurrences: occurrences !== null ? Number(occurrences) : undefined,
        category: resolved.category || 'Uncategorized',
        subcategory: resolved.subcategory || 'Uncategorized',
        severity: resolved.severity || 'Low',
        type: resolved.type || 'Review Required'
      };
    });
  }
}


/**
 * Executes a repository-oriented natural language query on the database and
 * returns a formatted response.
 * 
 * @param {string} userMessage - User's question
 * @returns {Promise<Object>} Mapped JSON response with formatting/routing details
 */
export async function handleKnowledgeQuery(userMessage, isConceptual = false) {
  let sqlQuery = '';
  let queryResults = [];
  let queryFields = [];
  let queryError = null;

  if (!isConceptual) {
    try {
      // 1. Generate SQL using LLM
      const sqlCompletion = await client.chat.completions.create({
      model: MODEL,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: SQL_SYSTEM_PROMPT
        },
        {
          role: 'user',
          content: userMessage
        }
      ]
    });

    const rawSqlJson = sqlCompletion.choices[0]?.message?.content || '{}';
    const parsedSqlJson = JSON.parse(rawSqlJson);
    sqlQuery = parsedSqlJson.sql || '';
    const explanation = parsedSqlJson.explanation || '';
    
    console.log(`[Text-to-SQL] Generated SQL: "${sqlQuery}"`);
    console.log(`[Text-to-SQL] Explanation: "${explanation}"`);

    if (sqlQuery) {
      // 2. Validate and clean SQL
      validateAndCleanSQL(sqlQuery);
      
      // Enforce LIMIT 50 if no limit exists and not a count query
      let executionQuery = sqlQuery.trim();
      const strippedForLimit = stripSqlComments(executionQuery);
      if (!/limit\s+\d+/i.test(strippedForLimit) && !/count\(/i.test(strippedForLimit)) {
        executionQuery = executionQuery.replace(/;$/, '');
        executionQuery += ' LIMIT 50';
      }

      // 3. Execute SQL query
      const [rows, fields] = await pool.query(executionQuery);
      queryResults = rows;
      queryFields = fields || [];
      console.log(`[Text-to-SQL] Query executed successfully. Returned ${queryResults.length} rows.`);
    } else {
      console.log('[Text-to-SQL] No SQL query generated. Proceeding to direct LLM explanation.');
    }
  } catch (err) {
    console.error('[handleKnowledgeQuery] SQL Pipeline error:', err.message);
    queryError = err.message;
  }
}


  // 4. Decide format based on columns returned and row count
  const columnNames = queryFields.map(f => f.name.toLowerCase());
  const isVulnList = !queryError && sqlQuery && columnNames.includes('title') && queryResults.length > 0;

  if (isVulnList) {
    console.log('[handleKnowledgeQuery] Vulnerability list detected. Mapping to taxonomy...');
    const findings = await mapDbRecordsToTaxonomy(queryResults);
    // Never render empty findings table
    if (findings && findings.length > 0) {
      return {
        is_vuln_list: true,
        findings
      };
    }
    console.log('[handleKnowledgeQuery] ⚠️ Mapped findings were empty. Falling back to text response.');
  }

  // 5. Generate final markdown text response for analytics/conceptual/error cases
  try {
    const resultsPayload = queryError 
      ? { error: queryError }
      : (sqlQuery ? { rowCount: queryResults.length, data: queryResults.slice(0, 50) } : { noQuery: true });

    const responseCompletion = await client.chat.completions.create({
      model: MODEL,
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content: RESPONSE_SYSTEM_PROMPT
        },
        {
          role: 'user',
          content: [
            `User's Question: ${userMessage}`,
            `SQL Query executed: ${sqlQuery || 'None (General request)'}`,
            `Query Results: ${JSON.stringify(resultsPayload)}`
          ].join('\n\n')
        }
      ]
    });

    const responseText = responseCompletion.choices[0]?.message?.content || 'Unable to generate response.';
    return {
      is_vuln_list: false,
      answer: responseText
    };
  } catch (err) {
    console.error('[handleKnowledgeQuery] Response generation failed:', err.message);
    return {
      is_vuln_list: false,
      answer: `I successfully queried the database, but was unable to format a response due to an error: ${err.message}`
    };
  }
}
