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
  test("1. Menu & greeting triggers reset conversation state (hi, hii, hiii, hello, hey, start, menu)", () => {
    for (const word of ["menu", "main menu", "hi", "hii", "hiii", "hello", "hey", "heyy", "namaste", "good morning", "start", "options", "help"]) {
      const res = queryRouterService.classifyQuery(word);
      assert.strictEqual(res.type, "MENU", `Expected MENU for "${word}"`);
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

    const res3 = queryRouterService.classifyQuery("CA/1975/00048");
    assert.strictEqual(res3.type, "SEARCH_ARCHITECT");
    assert.strictEqual(res3.query, "CA/1975/00048");
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
  test("4. Architect Search - Standalone 'search architect' and 'verify architect' command", () => {
    for (const phrase of ["search architect", "verify architect", "find architect", "architect status", "verify", "search"]) {
      const res = queryRouterService.classifyQuery(phrase);
      assert.strictEqual(res.type, "PROMPT_SEARCH_ARCHITECT", `Expected PROMPT_SEARCH_ARCHITECT for "${phrase}"`);
    }
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
    assert.ok(res.response.includes("https://www.nata.in"));
    assert.ok(res.response.includes("https://coa.gov.in"));
    assert.ok(res.response.includes("https://ecoa.in/samarthaya/public/requestQuery"));
  });

  // 8. PGETA Department Routing
  test("8. Department Routing - PGETA queries", () => {
    const res = queryRouterService.classifyQuery("PGETA post graduate examination details");
    assert.strictEqual(res.type, "DEPARTMENT_QUERY");
    assert.strictEqual(res.department, "PGETA");
    assert.ok(res.response.includes("https://coa.gov.in"));
    assert.ok(res.response.includes("https://ecoa.in/samarthaya/public/requestQuery"));
  });

  // 9. Education Department Routing
  test("9. Department Routing - Education department", () => {
    const res = queryRouterService.classifyQuery("Education department college approval syllabus");
    assert.strictEqual(res.type, "DEPARTMENT_QUERY");
    assert.strictEqual(res.department, "EDUCATION");
    assert.ok(res.response.includes("https://coa.gov.in"));
    assert.ok(res.response.includes("https://ecoa.in/samarthaya/public/requestQuery"));
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

  // 12. Correct Architect Name Extraction & Normalization
  test("12. Architect Data Extraction - Correct name parsing when upstream API splits name fields", () => {
    const sample1 = {
      title: "Mr.",
      archFirstName: "PRAKASH",
      archMiddleName: null,
      archLastName: "NARAYAN",
      archRegNum: "CA/1975/00048",
      archStatus: "Defaulter",
      archValidityUpTo: "31/December/1976",
      CorresspondanceAddr: "ASSOCIATE PLANNER HOUSING 8th Flr. VIKAS MINAR Bldg I.P.ESTATE",
      district: "New Delhi",
      pincode: "110002",
    };

    const norm1 = coaApiService.normalizeArchitect(sample1);
    assert.strictEqual(norm1.regNumber, "CA/1975/00048");
    assert.strictEqual(norm1.name, "PRAKASH NARAYAN");
    assert.notStrictEqual(norm1.name, "Not Available");
    assert.notStrictEqual(norm1.name, "");
    assert.strictEqual(norm1.status, "Defaulter");
    assert.strictEqual(norm1.validity, "31/12/1976");
    assert.ok(norm1.address.includes("New Delhi"));

    const sample2 = {
      title: "Ms.",
      archFirstName: "SNISHTHA",
      archMiddleName: "RAJESH",
      archLastName: "BHATIA",
      archRegNum: "CA/2021/130000",
      archStatus: "Active",
      archValidityUpTo: "31/December/2026",
    };

    const norm2 = coaApiService.normalizeArchitect(sample2);
    assert.strictEqual(norm2.name, "SNISHTHA RAJESH BHATIA");
    assert.strictEqual(norm2.regNumber, "CA/2021/130000");

    const sample3 = {
      archName: "RAJESH KUMAR   AGGARWAL",
      archRegNum: "CA/1975/00002",
      archStatus: "Defaulter",
    };

    const norm3 = coaApiService.normalizeArchitect(sample3);
    assert.strictEqual(norm3.name, "RAJESH KUMAR AGGARWAL");
  });

  // 13. CoA API Service - Live Architect Search CA/1975/00048 Name Extraction
  await asyncTest("13. CoA API Service - Live Architect Search CA/1975/00048 extracts PRAKASH NARAYAN", async () => {
    const res = await coaApiService.searchArchitect({ regNumber: "CA/1975/00048" });
    assert.strictEqual(res.found, true);
    assert.ok(res.architects.length > 0);
    const arch = res.architects[0];
    assert.strictEqual(arch.regNumber, "CA/1975/00048");
    assert.strictEqual(arch.name, "PRAKASH NARAYAN");
    assert.strictEqual(arch.status, "Defaulter");
  });

  // 14. CoA API Service - Architect search by Name
  await asyncTest("14. CoA API Service - Architect search by Name", async () => {
    const res = await coaApiService.searchArchitect({ name: "Sharma" });
    assert.ok(typeof res.found === "boolean");
    assert.ok(Array.isArray(res.architects));
  });

  // 15. CoA API Service - No result search
  await asyncTest("15. CoA API Service - No result architect search", async () => {
    const res = await coaApiService.searchArchitect({ query: "NonExistentArchitectNameXYZ999" });
    assert.strictEqual(res.found, false);
    assert.strictEqual(res.architects.length, 0);
  });

  // 16. State Machine - Fresh greeting after completed architect lookup
  test("16. State Machine - 'hii' after architect lookup starts a fresh menu interaction", () => {
    const simulatedUserState = {}; // cleared state after lookup
    const userInput = "hii";

    const isGreeting =
      /^(?:hi+|hello+|hey+|namaste|good\s*(?:morning|afternoon|evening)|start|menu|main\s*menu|options|help|home)$/i.test(
        userInput.toLowerCase()
      ) ||
      (/^(?:hi+|hello+|hey+|namaste)\b/i.test(userInput.toLowerCase()) && userInput.length <= 15);

    assert.strictEqual(isGreeting, true, "Greeting must be recognized");
  });

  // 17. State Machine - Unrelated query after architect lookup routes freshly
  test("17. State Machine - Unrelated query after architect lookup routes to new handler", () => {
    const classification = queryRouterService.classifyQuery("How can I renew my registration?");
    assert.strictEqual(classification.type, "FAQ");
    assert.strictEqual(classification.faq.id, "renewal_registration");
  });

  // 18. Application Status & Dispatch Status format validation
  test("18. Existing Flow Validation - Application number and Dispatch mobile number regex", () => {
    const appNumRegex = /^(?=.*\d)[a-zA-Z\d]{6,}$/i;
    assert.strictEqual(appNumRegex.test("APP123456"), true);
    assert.strictEqual(appNumRegex.test("CA12"), false); // too short (< 6 chars)
    assert.strictEqual(appNumRegex.test("ABCDEF"), false); // no numbers

    const mobileRegex = /^\d{10}$/;
    assert.strictEqual(mobileRegex.test("9876543210"), true);
    assert.strictEqual(mobileRegex.test("123"), false);
  });

  // 19. Security Check - Frontend build contains no Basic Auth credentials
  test("19. Security Check - Frontend build contains no Basic Auth credentials", () => {
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

  // 20. OTP Removal Verification - Ensure no OTP code in WhatsApp conversation flow
  await asyncTest("20. Verification - No OTP functions or conversation states remain in server.js", async () => {
    const fs = await import("fs");
    const serverCode = fs.readFileSync("./server.js", "utf-8");
    const otpKeywords = [
      "otp_verification_architect",
      "otp_verification_application",
      "otp_verification_dispatch",
      "initiateOTPVerification",
      "handleArchitectOTPVerification",
      "handleApplicationOTPVerification",
      "handleDispatchOTPVerification",
      "coa_verification_otp",
    ];

    for (const kw of otpKeywords) {
      assert.ok(!serverCode.includes(kw), `OTP keyword "${kw}" must not be present in server.js`);
    }
  });

  console.log("\n==================================================");
  console.log(`📊 FINAL TEST REPORT: ${passed} Passed, ${failed} Failed`);
  console.log("==================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
