import assert from "assert";
import "dotenv/config";
import coaApiService from "../services/coaApiService.js";
import faqService from "../services/faqService.js";
import queryRouterService, { DEPARTMENT_DATA } from "../services/queryRouterService.js";

async function runTests() {
  console.log("==================================================");
  console.log("🚀 STARTING COMPREHENSIVE COA ENHANCEMENT SUITE");
  console.log("==================================================\n");

  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    try {
      fn();
      console.log(`✅ PASS: ${name}`);
      passed++;
    } catch (e) {
      console.error(`❌ FAIL: ${name}`);
      console.error(`   Error: ${e.message}`);
      failed++;
    }
  }

  async function asyncTest(name, fn) {
    try {
      await fn();
      console.log(`✅ PASS: ${name}`);
      passed++;
    } catch (e) {
      console.error(`❌ FAIL: ${name}`);
      console.error(`   Error: ${e.message}`);
      failed++;
    }
  }

  // 1. Menu and Greeting triggers
  test("1. Menu & greeting triggers reset conversation state", () => {
    for (const word of ["menu", "main menu", "hi", "hello", "hey", "start", "options", "help"]) {
      const res = queryRouterService.classifyQuery(word);
      assert.strictEqual(res.type, "MENU", `Expected MENU for ${word}`);
    }
  });

  // 2. Direct Registration Number Pattern Match
  test("2. Architect Search - Direct registration number recognition", () => {
    const res1 = queryRouterService.classifyQuery("CA/2018/12345");
    assert.strictEqual(res1.type, "SEARCH_ARCHITECT");
    assert.strictEqual(res1.query, "CA/2018/12345");

    const res2 = queryRouterService.classifyQuery("Please check status of CA/2021/98765");
    assert.strictEqual(res2.type, "SEARCH_ARCHITECT");
    assert.strictEqual(res2.query, "CA/2021/98765");
  });

  // 3. Search Architect by Name Intent
  test("3. Architect Search - Search by Name intent", () => {
    const res1 = queryRouterService.classifyQuery("search architect Rajesh Sharma");
    assert.strictEqual(res1.type, "SEARCH_ARCHITECT");
    assert.strictEqual(res1.searchType, "NAME");
    assert.strictEqual(res1.query, "Rajesh Sharma");

    const res2 = queryRouterService.classifyQuery("find architect John Doe");
    assert.strictEqual(res2.type, "SEARCH_ARCHITECT");
    assert.strictEqual(res2.query, "John Doe");
  });

  // 4. Standalone search architect command
  test("4. Architect Search - Standalone 'search architect' command", () => {
    const res = queryRouterService.classifyQuery("search architect");
    assert.strictEqual(res.type, "PROMPT_SEARCH_ARCHITECT");
  });

  // 5. Registration Department Routing
  test("5. Department Routing - Registration department", () => {
    const res = queryRouterService.classifyQuery("I want to enquire about new architect registration");
    assert.strictEqual(res.type, "DEPARTMENT_QUERY");
    assert.strictEqual(res.department, "REGISTRATION");
    assert.ok(res.response.includes("registration-coa@coa.gov.in"));
    assert.ok(res.response.includes("011-49412100"));
    assert.ok(res.response.includes("https://coa.org.in/e-services/register-architect"));
    assert.ok(res.response.includes("https://ecoa.in/samarthaya/public/requestQuery"));
    assert.ok(res.response.includes("Type \"menu\" to return to the main menu."));
  });

  // 6. Renewal Department Routing
  test("6. Department Routing - Renewal department", () => {
    const res = queryRouterService.classifyQuery("renewal enquiry and helpdesk number");
    assert.strictEqual(res.type, "DEPARTMENT_QUERY");
    assert.strictEqual(res.department, "RENEWAL");
    assert.ok(res.response.includes("registration-renewal-coa@coa.gov.in"));
    assert.ok(res.response.includes("+91 70429 39122"));
    assert.ok(res.response.includes("https://coa.org.in/e-services/renewal-registration"));
  });

  // 7. NATA Department Routing
  test("7. Department Routing - NATA queries", () => {
    const res = queryRouterService.classifyQuery("When will NATA results and admit card be released?");
    assert.strictEqual(res.type, "DEPARTMENT_QUERY");
    assert.strictEqual(res.department, "NATA");
    assert.ok(res.response.includes("nata-coa@gov.in"));
    assert.ok(res.response.includes("https://www.nata.in"));
    assert.ok(res.response.includes("011-49412100"));
  });

  // 8. PGETA Department Routing
  test("8. Department Routing - PGETA queries", () => {
    const res = queryRouterService.classifyQuery("PGETA post graduate examination details");
    assert.strictEqual(res.type, "DEPARTMENT_QUERY");
    assert.strictEqual(res.department, "PGETA");
    assert.ok(res.response.includes("pgeta-coa@gov.in"));
    assert.ok(res.response.includes("011-49412100"));
  });

  // 9. Education Department Routing
  test("9. Department Routing - Education department", () => {
    const res = queryRouterService.classifyQuery("Education department college approval syllabus");
    assert.strictEqual(res.type, "DEPARTMENT_QUERY");
    assert.strictEqual(res.department, "EDUCATION");
    assert.ok(res.response.includes("education-coa@gov.in"));
  });

  // 10. General / Samarthaya Ticket Routing
  test("10. Department Routing - Samarthaya Ticket / General grievance", () => {
    const res = queryRouterService.classifyQuery("how to raise samarthaya grievance ticket");
    assert.ok(res.type === "DEPARTMENT_QUERY" || res.type === "FAQ");
    assert.ok(res.response.includes("https://ecoa.in/samarthaya/public/requestQuery"));
  });

  // 11. FAQ Matching - "How can I renew my registration?"
  test("11. FAQ - 'How can I renew my registration?'", () => {
    const faq = faqService.findFaq("How can I renew my registration?");
    assert.ok(faq);
    assert.strictEqual(faq.id, "renewal_registration");
    const formatted = faq.formatResponse();
    assert.ok(formatted.includes("Procedure"));
    assert.ok(formatted.includes("Required Documents"));
    assert.ok(formatted.includes("registration-renewal-coa@coa.gov.in"));
    assert.ok(formatted.includes("+91 70429 39122"));
    assert.ok(formatted.includes("https://coa.org.in/e-services/renewal-registration"));
  });

  // 12. CoA API Service - Live / Fallback architect search
  await asyncTest("12. CoA API Service - Architect search by Reg Number", async () => {
    const res = await coaApiService.searchArchitect({ regNumber: "CA/2015/12345" });
    assert.ok(typeof res.found === "boolean");
    assert.ok(Array.isArray(res.architects));
  });

  // 13. CoA API Service - Architect search by Name
  await asyncTest("13. CoA API Service - Architect search by Name", async () => {
    const res = await coaApiService.searchArchitect({ name: "Sharma" });
    assert.ok(typeof res.found === "boolean");
    assert.ok(Array.isArray(res.architects));
  });

  // 14. CoA API Service - No result search
  await asyncTest("14. CoA API Service - No result architect search", async () => {
    const res = await coaApiService.searchArchitect({ query: "NonExistentArchitectNameXYZ999" });
    assert.strictEqual(res.found, false);
    assert.strictEqual(res.architects.length, 0);
  });

  // 15. CoA API Service - Basic Auth Header Construction
  test("15. CoA API Service - Basic Auth Header verification", () => {
    const header = coaApiService.getAuthHeader();
    assert.ok(header.startsWith("Basic "));
    const decoded = Buffer.from(header.replace("Basic ", ""), "base64").toString();
    assert.ok(decoded.includes(process.env.WHATSAPP_BASIC_AUTH_USERNAME || "coa-erp-portal"));
  });

  // 16. CoA API Service - Timeout & Error handling simulation
  await asyncTest("16. CoA API Service - Resilient error handling without throwing", async () => {
    // Search with special characters or simulated bad query
    const res = await coaApiService.searchArchitect({ query: "!@#$%^&*()" });
    assert.strictEqual(typeof res.found, "boolean");
  });

  // 17. Security Check - Frontend build inspection
  test("17. Security Check - Frontend build contains no Basic Auth credentials", () => {
    import("fs").then((fs) => {
      const distDir = "../Client/dist";
      if (fs.existsSync(distDir)) {
        const files = fs.readdirSync(distDir, { recursive: true });
        for (const f of files) {
          const fullPath = `${distDir}/${f}`;
          if (fs.statSync(fullPath).isFile() && (f.endsWith(".js") || f.endsWith(".html"))) {
            const content = fs.readFileSync(fullPath, "utf-8");
            const pw = process.env.WHATSAPP_BASIC_AUTH_PASSWORD;
            if (pw && pw.length > 5) {
              assert.ok(!content.includes(pw), `Password found in client asset ${f}`);
            }
          }
        }
      }
    });
  });

  console.log("\n==================================================");
  console.log(`📊 FINAL TEST REPORT: ${passed} Passed, ${failed} Failed`);
  console.log("==================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
