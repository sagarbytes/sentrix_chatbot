import { detectIntent, handleKnowledgeQuery } from './src/services/knowledgeService.js';

async function runTests() {
  console.log('--- TEST 1: Intent Detection (incl. Unclear Intent) ---');
  const intentCases = [
    { q: "lis top 10 vulnerabilitries", expected: "knowledge_base_query" },
    { q: "critcal vulnerabilities", expected: "knowledge_base_query" },
    { q: "sqll injection in our code", expected: "vulnerability_analysis" },
    { q: "hello how are you doing", expected: "unclear" },
    { q: "asdffghjhj", expected: "unclear" },
    { q: "What is SQL Injection?", expected: "conceptual_security" },
    { q: "Explain CSRF", expected: "conceptual_security" },
    { q: "Do we have SQL Injection issues?", expected: "knowledge_base_query" }
  ];

  for (const tc of intentCases) {
    const res = await detectIntent(tc.q);
    console.log(`Query: "${tc.q}"`);
    console.log(`Intent: "${res.intent}" (Reason: ${res.reason})`);
    console.log(`Expected: "${tc.expected}" -> ${res.intent === tc.expected ? '✅' : '❌'}`);
    console.log('------------------------');
  }

  console.log('\n--- TEST 2: Typo-Tolerance and Ranking Query Execution ---');
  const queries = [
    {
      q: "lis top 5 vulnerabilities",
      desc: "Top vulnerability rank query — should group and return counts"
    },
    {
      q: "critcal vulnerabilities",
      desc: "Typo in query — should correct and list critical issues"
    },
    {
      q: "sqll injection findings",
      desc: "Typo in keyword — should search SQL injection findings"
    },
    {
      q: "List vulnerabilities matching 'FakeTitle'",
      desc: "Zero records matching — should fallback to text response"
    },
    {
      q: "Explain SQL Injection",
      desc: "Conceptual security query — should bypass DB execution and explain SQL Injection",
      isConceptual: true
    },
    {
      q: "show finding 236",
      desc: "Finding ID lookup - should search by id"
    },
    {
      q: "show vulnerability 111",
      desc: "Vulnerability QID lookup - should search by qid or id"
    },
    {
      q: "show issues related to CVE-2019-11358",
      desc: "CVE-based lookup - should search in cve_id"
    },
    {
      q: "list findings for CWE-79",
      desc: "CWE-based lookup - should search text fields for CWE-79"
    },
    {
      q: "list Version Upgrade issues",
      desc: "Remediation type lookup - should search by type = 2"
    }
  ];

  for (const { q, desc, isConceptual } of queries) {
    console.log(`\n==============================================`);
    console.log(`QUERY: "${q}" (${desc})`);
    try {
      const result = await handleKnowledgeQuery(q, isConceptual);
      console.log(`is_vuln_list: ${result.is_vuln_list}`);
      if (result.is_vuln_list) {
        console.log(`Findings count: ${result.findings.length}`);
        console.log(`First finding sample:`, JSON.stringify(result.findings[0], null, 2));
      } else {
        console.log(`Text answer:\n${result.answer}`);
      }
    } catch (err) {
      console.error(`Error executing query:`, err.message);
    }
  }

  process.exit(0);
}

runTests().catch(err => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
