import { detectIntent, handleKnowledgeQuery } from './src/services/knowledgeService.js';
import pool from './src/services/db.js';

async function investigate() {
  const query = "show all configuration issues";
  console.log(`=== START INVESTIGATION FOR: "${query}" ===\n`);

  // 1. Detected Intent
  const intentResult = await detectIntent(query);
  console.log(`1. Detected Intent: "${intentResult.intent}" (Reason: ${intentResult.reason})`);

  // 2. Generate SQL and check mapping logic
  const { mapDbRecordsToTaxonomy } = await import('./src/services/knowledgeService.js');
  
  // We will manually run the Text-to-SQL logic so we can inspect everything
  const OpenAI = (await import('openai')).default;
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const fs = require = (await import('fs'));
  const path = (await import('path'));
  const { fileURLToPath } = await import('url');
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const SQL_SYSTEM_PROMPT = fs.readFileSync(path.join(__dirname, 'src', 'prompts', 'text_to_sql.txt'), 'utf-8').trim();

  console.log('\nGenerating SQL...');
  const sqlCompletion = await client.chat.completions.create({
    model: MODEL,
    temperature: 0,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SQL_SYSTEM_PROMPT },
      { role: 'user', content: query }
    ]
  });

  const parsedSqlJson = JSON.parse(sqlCompletion.choices[0]?.message?.content || '{}');
  const sqlQuery = parsedSqlJson.sql || '';
  const explanation = parsedSqlJson.explanation || '';

  console.log(`2. Generated SQL: "${sqlQuery}"`);
  console.log(`   Explanation: "${explanation}"`);

  // 3 & 4. Category-query trigger & source verification
  const categoryKeywords = ['category = 1', 'category = 2', 'category = 5', 'category = 2 OR', 'category = 1 OR', 'category = 5 OR'];
  const hasCategoryFilter = categoryKeywords.some(kw => sqlQuery.toLowerCase().includes(kw));
  
  console.log(`\n3. Whether the category-query rule was triggered: ${hasCategoryFilter ? 'YES' : 'NO'}`);
  console.log(`4. SQL Source: ${hasCategoryFilter ? 'New category mapping logic (filtered by database categories/synonyms)' : 'Fallback title-search path (e.g. title LIKE)'}`);

  // 5. Raw database rows returned
  console.log('\n5. Raw database rows returned before mapping:');
  try {
    const [rows] = await pool.query(sqlQuery);
    console.log(`   Total rows returned: ${rows.length}`);
    if (rows.length > 0) {
      console.log('   Sample rows (first 3):');
      console.log(JSON.stringify(rows.slice(0, 3), null, 2));
    } else {
      console.log('   No rows returned.');
    }
  } catch (err) {
    console.error(`   Error running SQL: ${err.message}`);
  }

  process.exit(0);
}

investigate().catch(console.error);
