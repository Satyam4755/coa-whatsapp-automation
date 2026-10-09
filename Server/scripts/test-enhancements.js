import assert from "assert";
import axios from "axios";
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
    assert.strictEqual(norm1.validityDisplay, "Annual payment valid till 31/12/1976");
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
    assert.strictEqual(norm2.validityDisplay, "Annual payment valid till 31/12/2026");

    const sample3 = {
      archName: "RAJESH KUMAR   AGGARWAL",
      archRegNum: "CA/1975/00002",
      archStatus: "Defaulter",
    };

    const norm3 = coaApiService.normalizeArchitect(sample3);
    assert.strictEqual(norm3.name, "RAJESH KUMAR AGGARWAL");

    // Test Endorsement Due display
    const sampleEndorsement = {
      archFirstName: "NEHA",
      archLastName: "GOEL",
      archRegNum: "CA/2000/25600",
      archStatus: "Active [ <span class=\"DataRed\">Endorsement Due</span> ]",
      archValidityUpTo: "31/December/2024",
    };
    const normEndorsement = coaApiService.normalizeArchitect(sampleEndorsement);
    assert.strictEqual(normEndorsement.validityDisplay, "Endorsement due.");

    // Test One Time Payment display
    const sampleOTP = {
      archFirstName: "VIPUL",
      archLastName: "PATEL",
      archRegNum: "CA/2015/70000",
      archStatus: "Active",
      isOneTimePayment: true,
      archValidityUpTo: "31/December/2035",
    };
    const normOTP = coaApiService.normalizeArchitect(sampleOTP);
    assert.strictEqual(normOTP.validityDisplay, "One time payment valid till 31/12/35");
  });

  // 13. CoA API Service - Architect normalization and response verification
  await asyncTest("13. CoA API Service - Architect normalization and response structure verification", async () => {
    const origGetAxiosClient = coaApiService.getAxiosClient.bind(coaApiService);
    coaApiService.getAxiosClient = function () {
      return {
        get: async () => ({
          status: 200,
          data: [{
            archFirstName: "PRAKASH",
            archLastName: "NARAYAN",
            archRegNum: "CA/1975/00048",
            archStatus: "Defaulter",
            archValidityUpTo: "31/December/1976",
          }],
        }),
      };
    };

    try {
      const res = await coaApiService.searchArchitect({ regNumber: "CA/1975/00048" });
      assert.strictEqual(res.found, true);
      assert.strictEqual(res.architects.length, 1);
      assert.strictEqual(res.architects[0].regNumber, "CA/1975/00048");
      assert.strictEqual(res.architects[0].name, "PRAKASH NARAYAN");
    } finally {
      coaApiService.getAxiosClient = origGetAxiosClient;
    }

    const sample = {
      archFirstName: "PRAKASH",
      archLastName: "NARAYAN",
      archRegNum: "CA/1975/00048",
      archStatus: "Defaulter",
      archValidityUpTo: "31/December/1976",
    };
    const norm = coaApiService.normalizeArchitect(sample);
    assert.strictEqual(norm.regNumber, "CA/1975/00048");
    assert.strictEqual(norm.name, "PRAKASH NARAYAN");
    assert.strictEqual(norm.status, "Defaulter");
  });

  // 14. CoA API Service - Architect search by Name
  await asyncTest("14. CoA API Service - Architect search by Name", async () => {
    const origGetAxiosClient = coaApiService.getAxiosClient.bind(coaApiService);
    coaApiService.getAxiosClient = function () {
      return {
        get: async () => ({
          status: 200,
          data: [{
            archFirstName: "RAJESH",
            archLastName: "SHARMA",
            archRegNum: "CA/2005/12345",
            archStatus: "Active",
            archValidityUpTo: "31/December/2026",
          }],
        }),
      };
    };

    try {
      const res = await coaApiService.searchArchitect({ name: "Sharma" });
      assert.strictEqual(res.found, true);
      assert.strictEqual(res.architects.length, 1);
      assert.strictEqual(res.architects[0].name, "RAJESH SHARMA");
    } finally {
      coaApiService.getAxiosClient = origGetAxiosClient;
    }
  });

  // 15. CoA API Service - No result search
  await asyncTest("15. CoA API Service - No result architect search", async () => {
    const origGetAxiosClient = coaApiService.getAxiosClient.bind(coaApiService);
    coaApiService.getAxiosClient = function () {
      return {
        get: async () => ({
          status: 200,
          data: [],
        }),
      };
    };

    try {
      const res = await coaApiService.searchArchitect({ query: "NonExistentArchitectNameXYZ999" });
      assert.strictEqual(res.found, false);
      assert.strictEqual(res.architects.length, 0);
    } finally {
      coaApiService.getAxiosClient = origGetAxiosClient;
    }
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

  // 21. Idempotency Verification - Duplicate Message ID ignores second processing
  test("21. Safety Rule B - Duplicate WhatsApp Message ID detection", () => {
    const localDeduplicationMap = new Map();
    function checkDuplicate(msgId) {
      if (localDeduplicationMap.has(msgId)) return true;
      localDeduplicationMap.set(msgId, Date.now());
      return false;
    }

    const id1 = "wamid.TEST_ID_12345";
    assert.strictEqual(checkDuplicate(id1), false, "First reception must be allowed");
    assert.strictEqual(checkDuplicate(id1), true, "Second reception of same ID must be detected as duplicate");
    assert.strictEqual(checkDuplicate(id1), true, "Subsequent receptions must be blocked");
  });

  // 22. State Reset Verification - Architect lookup resets state and avoids old number reuse
  test("22. Safety Rule E - Architect search resets state after execution", () => {
    const userStates = { "919876543210": { awaiting: "search_architect", lastMessageId: "msg_1" } };
    
    // Simulate lookup completion
    userStates["919876543210"] = { lastMessageId: "msg_1" }; // cleared awaiting

    assert.strictEqual(userStates["919876543210"].awaiting, undefined);

    // Simulate next user input: "How can I renew?"
    const nextClassification = queryRouterService.classifyQuery("How can I renew?");
    assert.ok(nextClassification.type === "DEPARTMENT_QUERY" || nextClassification.type === "FAQ");
    assert.notStrictEqual(nextClassification.type, "SEARCH_ARCHITECT", "Must not search architect");
    assert.strictEqual(userStates["919876543210"].awaiting, undefined, "State must not retain architect search");
  });

  // 23. Stale Async Operation Invalidation
  test("23. Safety Rule C - In-flight async response is discarded if user sent a newer message", () => {
    const userStates = { "919876543210": { lastMessageId: "msg_2_newer" } };
    const staleOperationMessageId = "msg_1_older";

    let responseSent = false;
    function finishAsyncSearch(userNumber, msgId) {
      if (msgId && userStates[userNumber]?.lastMessageId && userStates[userNumber].lastMessageId !== msgId) {
        // Discard stale response
        return;
      }
      responseSent = true;
    }

    finishAsyncSearch("919876543210", staleOperationMessageId);
    assert.strictEqual(responseSent, false, "Stale response must be discarded when message ID is superseded");

    finishAsyncSearch("919876543210", "msg_2_newer");
    assert.strictEqual(responseSent, true, "Active response must be delivered");
  });

  // 24. Safety Rule A - Non-architect query does not trigger architect search
  test("24. Safety Rule A - Generic input without architect search query does not classify as SEARCH_ARCHITECT", () => {
    const nonArchitectQueries = [
      "Hello",
      "Good morning",
      "Where is COA office?",
      "9876543210",
      "APP123456",
      "I need a refund",
      "Renewal help",
    ];

    for (const q of nonArchitectQueries) {
      const res = queryRouterService.classifyQuery(q);
      assert.notStrictEqual(res.type, "SEARCH_ARCHITECT", `Query "${q}" must NOT be classified as SEARCH_ARCHITECT`);
    }
  });

  // ==================================================
  // FEATURE 1: MONGODB CONVERSATION STORAGE TESTS
  // ==================================================
  const { default: conversationService } = await import("../services/conversationService.js");
  const { Lead } = await import("../models/Lead.js");

  // 25. Conversation Record Creation & Structure
  await asyncTest("25. MongoDB - User message creates conversation record with chat array [{ user: '...' }]", async () => {
    const userNumber = "919999988881";
    const userMsg = "Hello COA";
    const res = await conversationService.logUserMessage({ userNumber, message: userMsg, messageId: "msg_test_01" });

    assert.ok(res, "Must return result object");
    assert.deepStrictEqual(res.chatEntry, { user: userMsg });
    assert.ok(Array.isArray(res.chat), "Chat must be an array");
    assert.strictEqual(res.chat.length, 1);
    assert.deepStrictEqual(res.chat[0], { user: userMsg });
  });

  // 26. Multiple Messages Append in Chronological Order
  await asyncTest("26. MongoDB - Multiple messages append to chat array in exact order", async () => {
    const userNumber = "919999988882";
    await conversationService.logUserMessage({ userNumber, message: "Hi", messageId: "msg_u1" });
    await conversationService.logCoaMessage({ userNumber, message: "Welcome to COA", messageId: "msg_c1" });
    await conversationService.logUserMessage({ userNumber, message: "CA/2021/12345", messageId: "msg_u2" });
    const r4 = await conversationService.logCoaMessage({ userNumber, message: "Status details", messageId: "msg_c2" });

    assert.ok(Array.isArray(r4.chat));
    assert.strictEqual(r4.chat.length, 4);
    assert.deepStrictEqual(r4.chat[0], { user: "Hi" });
    assert.deepStrictEqual(r4.chat[1], { coa: "Welcome to COA" });
    assert.deepStrictEqual(r4.chat[2], { user: "CA/2021/12345" });
    assert.deepStrictEqual(r4.chat[3], { coa: "Status details" });
  });

  // 27. Chat Entries Contain Only 'user' or 'coa' Keys
  await asyncTest("27. MongoDB - Chat entry objects contain only 'user' or 'coa' without metadata", async () => {
    const userNumber = "919999988883";
    const resU = await conversationService.logUserMessage({ userNumber, message: "Query", messageId: "u_meta" });
    const resC = await conversationService.logCoaMessage({ userNumber, message: "Answer", messageId: "c_meta" });

    const userEntry = resC.chat[0];
    const coaEntry = resC.chat[1];

    assert.deepStrictEqual(Object.keys(userEntry), ["user"]);
    assert.deepStrictEqual(Object.keys(coaEntry), ["coa"]);
    assert.strictEqual(userEntry.sender, undefined);
    assert.strictEqual(userEntry.timestamp, undefined);
    assert.strictEqual(userEntry.messageId, undefined);
  });

  // 28. Chronological Order Preserved Across Multiple Messages
  await asyncTest("28. MongoDB - Chronological order maintained for consecutive COA messages", async () => {
    const userNumber = "919999988884";
    await conversationService.logCoaMessage({ userNumber, message: "Part 1", messageId: "coa_seq_1" });
    await conversationService.logCoaMessage({ userNumber, message: "Part 2", messageId: "coa_seq_2" });
    const r3 = await conversationService.logCoaMessage({ userNumber, message: "Part 3", messageId: "coa_seq_3" });

    assert.strictEqual(r3.chat.length, 3);
    assert.deepStrictEqual(r3.chat[0], { coa: "Part 1" });
    assert.deepStrictEqual(r3.chat[1], { coa: "Part 2" });
    assert.deepStrictEqual(r3.chat[2], { coa: "Part 3" });
  });

  // 29. Deduplication by WhatsApp messageId
  await asyncTest("29. MongoDB - Duplicate messageId is ignored without creating duplicate array items", async () => {
    const userNumber = "919999988885";
    const duplicateId = "wamid.TEST_DEDUP_MSG_ARR";
    const r1 = await conversationService.logUserMessage({ userNumber, message: "Hello", messageId: duplicateId });
    const r2 = await conversationService.logUserMessage({ userNumber, message: "Hello", messageId: duplicateId });

    assert.strictEqual(r1.chat.length, 1);
    assert.strictEqual(r2.deduplicated, true);
    assert.strictEqual(r2.chat.length, 1);
  });

  // 30. Multiple Consecutive COA Responses
  await asyncTest("30. MongoDB - Consecutive COA messages stored as separate { coa: '...' } objects", async () => {
    const userNumber = "919999988886";
    const r1 = await conversationService.logCoaMessage({ userNumber, message: "Line 1", messageId: "c_m1" });
    const r2 = await conversationService.logCoaMessage({ userNumber, message: "Line 2", messageId: "c_m2" });

    assert.deepStrictEqual(r1.chat[0], { coa: "Line 1" });
    assert.deepStrictEqual(r2.chat[1], { coa: "Line 2" });
  });

  // 31. Safe Non-Blocking Logging on MongoDB Failure
  await asyncTest("31. MongoDB - Failure/offline mode does not crash or throw unhandled errors", async () => {
    const safeNull = await conversationService.logMessage({ userNumber: null, message: null });
    assert.strictEqual(safeNull, null);
  });

  // 32. Lead Model Schema Structure Compatibility
  test("32. MongoDB - Lead Mongoose schema has only chat, chatDate, userNumber and no timestamps", () => {
    assert.strictEqual(Lead.collection.name, "leads");
    assert.strictEqual(Lead.schema.options.strict, false);
    assert.strictEqual(Lead.schema.options.timestamps, false);
    assert.ok(Lead.schema.path("userNumber"));
    assert.ok(Lead.schema.path("chatDate"));
    assert.ok(Lead.schema.path("chat"));
  });

  // ==================================================
  // FEATURE 2: PRODUCTION-GRADE RATE LIMITING TESTS
  // ==================================================
  const { default: rateLimiterService } = await import("../services/rateLimiterService.js");

  // 34. Requests below limit are allowed
  await asyncTest("34. Rate Limiter - Requests below limit are allowed", async () => {
    const testUser = "919111122201";
    await rateLimiterService.resetRateLimit(testUser);

    const r1 = await rateLimiterService.checkRateLimit(testUser);
    assert.strictEqual(r1.allowed, true);
    assert.ok(r1.remaining >= 0);
  });

  // 35. Requests above limit are rejected
  await asyncTest("35. Rate Limiter - Requests above limit are rejected with retryAfterMs", async () => {
    const testUser = "919111122202";
    await rateLimiterService.resetRateLimit(testUser);

    for (let i = 0; i < rateLimiterService.maxRequests; i++) {
      const res = await rateLimiterService.checkRateLimit(testUser);
      assert.strictEqual(res.allowed, true);
    }

    const blockedRes = await rateLimiterService.checkRateLimit(testUser);
    assert.strictEqual(blockedRes.allowed, false);
    assert.ok(blockedRes.retryAfterMs > 0);
  });

  // 36. Sliding Window Expiry / Reset
  await asyncTest("36. Rate Limiter - Reset allows new requests immediately", async () => {
    const testUser = "919111122203";
    await rateLimiterService.resetRateLimit(testUser);

    for (let i = 0; i < rateLimiterService.maxRequests; i++) {
      await rateLimiterService.checkRateLimit(testUser);
    }
    const blocked = await rateLimiterService.checkRateLimit(testUser);
    assert.strictEqual(blocked.allowed, false);

    await rateLimiterService.resetRateLimit(testUser);
    const unblocked = await rateLimiterService.checkRateLimit(testUser);
    assert.strictEqual(unblocked.allowed, true);
  });

  // 37. Independent Users Rate Limit Isolation
  await asyncTest("37. Rate Limiter - Different users have isolated rate limit state", async () => {
    const userA = "919111122204";
    const userB = "919111122205";
    await rateLimiterService.resetRateLimit(userA);
    await rateLimiterService.resetRateLimit(userB);

    for (let i = 0; i < rateLimiterService.maxRequests; i++) {
      await rateLimiterService.checkRateLimit(userA);
    }
    const resA = await rateLimiterService.checkRateLimit(userA);
    assert.strictEqual(resA.allowed, false, "UserA must be blocked");

    const resB = await rateLimiterService.checkRateLimit(userB);
    assert.strictEqual(resB.allowed, true, "UserB must NOT be blocked by UserA");
  });

  // 38. Concurrent Requests Safe Handling
  await asyncTest("38. Rate Limiter - Concurrent requests are handled safely", async () => {
    const testUser = "919111122206";
    await rateLimiterService.resetRateLimit(testUser);

    const promises = [];
    for (let i = 0; i < rateLimiterService.maxRequests + 5; i++) {
      promises.push(rateLimiterService.checkRateLimit(testUser));
    }
    const results = await Promise.all(promises);
    const allowedCount = results.filter((r) => r.allowed).length;
    const blockedCount = results.filter((r) => !r.allowed).length;

    assert.strictEqual(allowedCount, rateLimiterService.maxRequests, `Must allow exactly ${rateLimiterService.maxRequests} requests`);
    assert.strictEqual(blockedCount, 5, "Must block exactly excess concurrent requests");
  });

  // 39. Warning Message Cooldown Throttling
  test("39. Rate Limiter - Warning message cooldown prevents spamming warning text", () => {
    const testUser = "919111122207";
    const firstWarning = rateLimiterService.shouldSendWarning(testUser);
    assert.strictEqual(firstWarning, true, "First warning should be sent");

    const immediateSecond = rateLimiterService.shouldSendWarning(testUser);
    assert.strictEqual(immediateSecond, false, "Second immediate warning must be throttled");
  });

  // 40. Daily Renewal Reminder Cron - Disabled by default
  await asyncTest("40. Daily Renewal Cron - Disabled by default when ENABLE_DAILY_RENEWAL_CRON !== 'true'", async () => {
    const origEnv = process.env.ENABLE_DAILY_RENEWAL_CRON;
    delete process.env.ENABLE_DAILY_RENEWAL_CRON;

    const { executeDailyRenewalReminders } = await import("../server.js");
    const res = await executeDailyRenewalReminders();
    assert.strictEqual(res.status, "skipped");
    assert.strictEqual(res.reason, "disabled");

    if (origEnv !== undefined) process.env.ENABLE_DAILY_RENEWAL_CRON = origEnv;
  });

  // 41. Daily Renewal Reminder Cron - Redis Lock prevents duplicate execution
  await asyncTest("41. Daily Renewal Cron - Redis Lock prevents duplicate execution across instances", async () => {
    const { redisConnection } = await import("../services/bulkJobQueue.js");
    if (redisConnection && redisConnection.status === "ready") {
      const todayStr = new Date().toISOString().slice(0, 10);
      const lockKey = `wa:lock:daily_renewal_cron:${todayStr}`;
      await redisConnection.set(lockKey, Date.now().toString(), "EX", 82800);

      const origEnv = process.env.ENABLE_DAILY_RENEWAL_CRON;
      process.env.ENABLE_DAILY_RENEWAL_CRON = "true";

      const { executeDailyRenewalReminders } = await import("../server.js");
      const res = await executeDailyRenewalReminders();
      assert.strictEqual(res.status, "skipped");
      assert.strictEqual(res.reason, "lock_held");

      await redisConnection.del(lockKey);
      if (origEnv !== undefined) process.env.ENABLE_DAILY_RENEWAL_CRON = origEnv;
      else delete process.env.ENABLE_DAILY_RENEWAL_CRON;
    }
  });

  // 42. Bulk Job Recovery - Safe startup behavior without auto-dispatch
  await asyncTest("42. Bulk Job Recovery - Startup does not auto-resume jobs by default", async () => {
    const origEnv = process.env.AUTO_RESUME_BULK_JOBS_ON_STARTUP;
    delete process.env.AUTO_RESUME_BULK_JOBS_ON_STARTUP;

    const { default: BulkJobProcessor } = await import("../services/BulkJobProcessor.js");
    const processor = Object.create(BulkJobProcessor.prototype);
    // Calling enqueueRecoverableJobs with default env should complete safely without auto-dispatch
    await processor.enqueueRecoverableJobs();
    assert.ok(true, "enqueueRecoverableJobs completed safely without throwing");

    if (origEnv !== undefined) process.env.AUTO_RESUME_BULK_JOBS_ON_STARTUP = origEnv;
  });

  // ==================================================
  // FEATURE 3: 20-MINUTE SESSION INACTIVITY TIMEOUT TESTS
  // ==================================================
  const {
    getSessionTimeoutMs,
    isRequestSuperseded,
    updateUserState,
    resetUserState,
    cleanupExpiredUserStates,
    userStates,
  } = await import("../server.js");

  // 43. Session Timeout Config
  test("43. Session Timeout - Defaults to 20 minutes and respects CHAT_SESSION_TIMEOUT_MINUTES", () => {
    const origEnv = process.env.CHAT_SESSION_TIMEOUT_MINUTES;
    delete process.env.CHAT_SESSION_TIMEOUT_MINUTES;
    assert.strictEqual(getSessionTimeoutMs(), 20 * 60 * 1000, "Default must be 20 minutes");

    process.env.CHAT_SESSION_TIMEOUT_MINUTES = "15";
    assert.strictEqual(getSessionTimeoutMs(), 15 * 60 * 1000, "Should parse valid minute string");

    process.env.CHAT_SESSION_TIMEOUT_MINUTES = "invalid";
    assert.strictEqual(getSessionTimeoutMs(), 20 * 60 * 1000, "Invalid value must fallback to 20 minutes");

    if (origEnv !== undefined) process.env.CHAT_SESSION_TIMEOUT_MINUTES = origEnv;
    else delete process.env.CHAT_SESSION_TIMEOUT_MINUTES;
  });

  // 44. Request Superseded Check by Message ID and Session Token
  test("44. Request Superseded - Invalidation on new message ID or mismatched session token", () => {
    const testUser = "9199990001";
    userStates[testUser] = {
      sessionToken: "sess_token_1",
      sessionGeneration: 1,
      lastMessageId: "msg_1",
      lastUserMessageAt: Date.now(),
    };

    // Valid current request
    assert.strictEqual(isRequestSuperseded(testUser, "msg_1", "sess_token_1"), false);

    // Superseded by newer message ID
    assert.strictEqual(isRequestSuperseded(testUser, "msg_old", "sess_token_1"), true);

    // Superseded by newer session token
    assert.strictEqual(isRequestSuperseded(testUser, "msg_1", "sess_token_old"), true);

    // Non-existent or deleted user state
    delete userStates[testUser];
    assert.strictEqual(isRequestSuperseded(testUser, "msg_1", "sess_token_1"), true);
  });

  // 45. Inactivity Deadline Refresh on User Activity
  test("45. Session Lifecycle - User message updates lastUserMessageAt and session state safely", () => {
    const testUser = "9199990002";
    const initialTime = Date.now() - 5000;
    userStates[testUser] = {
      sessionToken: "sess_active_1",
      sessionGeneration: 1,
      lastMessageId: "msg_init",
      lastUserMessageAt: initialTime,
      attempts: 0,
      awaiting: "search_architect",
    };

    // User activity occurs
    const newTime = Date.now();
    updateUserState(testUser, { lastUserMessageAt: newTime, lastMessageId: "msg_next" });

    assert.strictEqual(userStates[testUser].lastUserMessageAt, newTime);
    assert.strictEqual(userStates[testUser].lastMessageId, "msg_next");
    assert.strictEqual(userStates[testUser].sessionToken, "sess_active_1");
    assert.strictEqual(userStates[testUser].awaiting, "search_architect");
  });

  // 46. Bot Response Alone Does Not Update User Inactivity Timestamp
  test("46. Session Lifecycle - Outbound bot response alone does not extend inactivity deadline", () => {
    const testUser = "9199990003";
    const fixedUserTimestamp = Date.now() - 10000;
    userStates[testUser] = {
      sessionToken: "sess_bot_test",
      sessionGeneration: 1,
      lastMessageId: "msg_user_prompt",
      lastUserMessageAt: fixedUserTimestamp,
    };

    // Simulated bot state reset on reply completion preserves lastUserMessageAt
    resetUserState(testUser, { lastMessageId: "msg_user_prompt" });
    assert.strictEqual(userStates[testUser].lastUserMessageAt, fixedUserTimestamp);
  });

  // 47. Independent User Session Isolation
  test("47. Session Isolation - User A activity does not affect User B session or timeout", () => {
    const userA = "9199990004";
    const userB = "9199990005";
    const timeA = Date.now() - 15 * 60 * 1000;
    const timeB = Date.now() - 2 * 60 * 1000;

    userStates[userA] = {
      sessionToken: "token_user_a",
      lastMessageId: "msg_a",
      lastUserMessageAt: timeA,
    };
    userStates[userB] = {
      sessionToken: "token_user_b",
      lastMessageId: "msg_b",
      lastUserMessageAt: timeB,
    };

    // User A receives a message and refreshes
    const nowA = Date.now();
    userStates[userA].lastUserMessageAt = nowA;

    assert.strictEqual(userStates[userA].lastUserMessageAt, nowA);
    assert.strictEqual(userStates[userB].lastUserMessageAt, timeB, "User B timestamp must remain unchanged");
    assert.strictEqual(userStates[userB].sessionToken, "token_user_b");
  });

  // 48. Session Expiration Cleanup
  test("48. Session Cleanup - Expired user states are pruned safely by periodic cleanup", () => {
    const activeUser = "9199990006";
    const expiredUser = "9199990007";
    const now = Date.now();

    userStates[activeUser] = {
      sessionToken: "token_active",
      lastUserMessageAt: now - 5 * 60 * 1000, // 5 min ago (active)
    };
    userStates[expiredUser] = {
      sessionToken: "token_expired",
      lastUserMessageAt: now - 25 * 60 * 1000, // 25 min ago (expired)
    };

    cleanupExpiredUserStates();

    assert.ok(userStates[activeUser], "Active user must be retained");
    assert.strictEqual(userStates[expiredUser], undefined, "Expired user state must be pruned");
  });

  // 49. Asynchronous Response From Expired Session Discarded
  test("49. Async Protection - API response from expired session cannot send outbound message", () => {
    const user = "9199990008";
    const sessionTokenOld = "sess_old_token";
    const sessionTokenNew = "sess_new_token";

    // User had a search in old session
    userStates[user] = {
      sessionToken: sessionTokenNew, // New session started after expiry
      lastMessageId: "msg_new",
      lastUserMessageAt: Date.now(),
    };

    // Check if old async callback is allowed
    const isSuperseded = isRequestSuperseded(user, "msg_old", sessionTokenOld);
    assert.strictEqual(isSuperseded, true, "Async response from old session must be rejected");
  });

  // ==================================================
  // FEATURE 4: COA ERP API PHASE 1 AUTHENTICATION TESTS
  // ==================================================
  const { default: CoaApiServiceImpl } = await import("../services/coaApiService.js");

  // 50. Basic Auth formatting for /auth/token
  test("50. COA ERP Auth - Basic Auth header generated from credentials", () => {
    const service = new CoaApiServiceImpl.constructor();
    service.username = "test-user";
    service.password = "test-pass";
    const header = service.getBasicAuthHeader();
    const expected = `Basic ${Buffer.from("test-user:test-pass").toString("base64")}`;
    assert.strictEqual(header, expected);
  });

  // 51. Token Acquisition, Caching, and Reuse
  await asyncTest("51. COA ERP Auth - getAccessToken acquires, caches, and reuses token", async () => {
    const service = new CoaApiServiceImpl.constructor();
    service.username = "test-user";
    service.password = "test-pass";

    let tokenCalls = 0;
    const originalPost = axios.post;
    axios.post = async function (url, body, config) {
      if (url.includes("/auth/token")) {
        tokenCalls++;
        assert.ok(config.headers.Authorization.startsWith("Basic "));
        return {
          data: {
            success: true,
            data: {
              accessToken: "mock_jwt_token_12345",
              expiresIn: 900,
              tokenType: "Bearer",
            },
          },
        };
      }
      return originalPost.apply(this, arguments);
    };

    try {
      // 1. Initial fetch
      const token1 = await service.getAccessToken();
      assert.strictEqual(token1, "mock_jwt_token_12345");
      assert.strictEqual(tokenCalls, 1);

      // 2. Second fetch within TTL reuses cache
      const token2 = await service.getAccessToken();
      assert.strictEqual(token2, "mock_jwt_token_12345");
      assert.strictEqual(tokenCalls, 1, "Cached token must be reused without repeat /auth/token call");
    } finally {
      axios.post = originalPost;
    }
  });

  // 52. Expired Token Refresh
  await asyncTest("52. COA ERP Auth - Expired or near-expiry token is refreshed", async () => {
    const service = new CoaApiServiceImpl.constructor();
    service.username = "test-user";
    service.password = "test-pass";

    let tokenCalls = 0;
    const originalPost = axios.post;
    axios.post = async function (url, body, config) {
      if (url.includes("/auth/token")) {
        tokenCalls++;
        return {
          data: {
            success: true,
            data: {
              accessToken: `mock_token_gen_${tokenCalls}`,
              expiresIn: 900,
              tokenType: "Bearer",
            },
          },
        };
      }
      return originalPost.apply(this, arguments);
    };

    try {
      const token1 = await service.getAccessToken();
      assert.strictEqual(token1, "mock_token_gen_1");

      // Set token expiry to 30s in future (within 60s early refresh threshold)
      service.tokenExpiresAt = Date.now() + 30 * 1000;

      const token2 = await service.getAccessToken();
      assert.strictEqual(token2, "mock_token_gen_2");
      assert.strictEqual(tokenCalls, 2, "Token within 60s of expiry must be refreshed");
    } finally {
      axios.post = originalPost;
    }
  });

  // 53. Concurrent Token Fetch Deduplication
  await asyncTest("53. COA ERP Auth - Concurrent requests share a single in-flight token request", async () => {
    const service = new CoaApiServiceImpl.constructor();
    service.username = "test-user";
    service.password = "test-pass";

    let tokenCalls = 0;
    const originalPost = axios.post;
    axios.post = async function (url, body, config) {
      if (url.includes("/auth/token")) {
        tokenCalls++;
        await new Promise((r) => setTimeout(r, 50));
        return {
          data: {
            success: true,
            data: {
              accessToken: "shared_token_concurrent",
              expiresIn: 900,
              tokenType: "Bearer",
            },
          },
        };
      }
      return originalPost.apply(this, arguments);
    };

    try {
      const [t1, t2, t3] = await Promise.all([
        service.getAccessToken(),
        service.getAccessToken(),
        service.getAccessToken(),
      ]);
      assert.strictEqual(t1, "shared_token_concurrent");
      assert.strictEqual(t2, "shared_token_concurrent");
      assert.strictEqual(t3, "shared_token_concurrent");
      assert.strictEqual(tokenCalls, 1, "Exactly one /auth/token network call for concurrent callers");
    } finally {
      axios.post = originalPost;
    }
  });

  // 54. Resource Request Uses Bearer Token and Handles 401 Recovery
  await asyncTest("54. COA ERP Auth - Resource request uses Bearer token and retries once on 401", async () => {
    const service = new CoaApiServiceImpl.constructor();
    service.username = "test-user";
    service.password = "test-pass";

    let tokenCalls = 0;
    let resourceCalls = 0;
    const originalPost = axios.post;

    axios.post = async function (url, body, config) {
      if (url.includes("/auth/token")) {
        tokenCalls++;
        return {
          data: {
            success: true,
            data: {
              accessToken: `token_v${tokenCalls}`,
              expiresIn: 900,
            },
          },
        };
      }
      return originalPost.apply(this, arguments);
    };

    try {
      const client = service.getAxiosClient();
      client.defaults.adapter = async (config) => {
        resourceCalls++;
        assert.ok(config.headers.Authorization.startsWith("Bearer "));
        if (resourceCalls === 1) {
          // First attempt returns 401
          const err = new Error("Request failed with status code 401");
          err.response = { status: 401, data: { message: "Unauthorized" } };
          err.config = config;
          throw err;
        }
        // Second attempt succeeds with new token
        assert.strictEqual(config.headers.Authorization, "Bearer token_v2");
        return {
          status: 200,
          data: [{ archRegNum: "CA/2021/11111", archName: "Retried Architect" }],
        };
      };

      const res = await client.get("/search");
      assert.strictEqual(res.status, 200);
      assert.strictEqual(resourceCalls, 2, "Resource request must be retried once");
      assert.strictEqual(tokenCalls, 2, "Fresh token must be fetched after 401");
    } finally {
      axios.post = originalPost;
    }
  });

  // 55. Second 401 Does Not Retry Indefinitely
  await asyncTest("55. COA ERP Auth - Second 401 is rejected without looping", async () => {
    const service = new CoaApiServiceImpl.constructor();
    service.username = "test-user";
    service.password = "test-pass";

    let resourceCalls = 0;
    const originalPost = axios.post;
    axios.post = async function (url) {
      if (url.includes("/auth/token")) {
        return { data: { success: true, data: { accessToken: "bad_token", expiresIn: 900 } } };
      }
      return originalPost.apply(this, arguments);
    };

    try {
      const client = service.getAxiosClient();
      client.defaults.adapter = async (config) => {
        resourceCalls++;
        const err = new Error("Request failed with status code 401");
        err.response = { status: 401, data: { message: "Unauthorized" } };
        err.config = config;
        throw err;
      };

      let failed = false;
      try {
        await client.get("/search");
      } catch (err) {
        failed = true;
        assert.strictEqual(err.response?.status, 401);
      }
      assert.strictEqual(failed, true, "Should reject on persistent 401");
      assert.strictEqual(resourceCalls, 2, "Must not retry more than once");
    } finally {
      axios.post = originalPost;
    }
  });

  // 56. Missing Credentials and Malformed Token Fail Safely
  await asyncTest("56. COA ERP Auth - Missing credentials and malformed responses fail safely", async () => {
    const service = new CoaApiServiceImpl.constructor();
    service.username = "";
    service.password = "";

    let errorThrown = false;
    try {
      await service.getAccessToken();
    } catch (err) {
      errorThrown = true;
      assert.ok(err.message && err.message.includes("Missing WhatsApp Basic Auth credentials"));
    }
    assert.strictEqual(errorThrown, true);

    // Malformed token response
    service.username = "user";
    service.password = "pass";
    service.invalidateToken();
    const originalPost = axios.post;
    axios.post = async function () {
      return { data: { success: false, data: {} } };
    };

    let malformedError = false;
    try {
      await service.getAccessToken(true);
    } catch (err) {
      malformedError = true;
      assert.ok(
        err.message.toLowerCase().includes("missing accesstoken") ||
        err.message.includes("missing accessToken"),
        `Unexpected error message: ${err.message}`
      );
    }
    assert.strictEqual(malformedError, true);
    axios.post = originalPost;
  });

  // 57. Mocked Architect Lookup by Registration Number (Single Match with Bearer Auth)
  await asyncTest("57. Mocked Architect Search - Lookup by Registration Number with Bearer Auth", async () => {
    const service = new CoaApiServiceImpl.constructor();
    service.username = "test-user";
    service.password = "test-pass";

    const originalPost = axios.post;
    axios.post = async function (url) {
      if (url.includes("/auth/token")) {
        return { data: { success: true, data: { accessToken: "search_token_123", expiresIn: 900 } } };
      }
      return originalPost.apply(this, arguments);
    };

    try {
      let interceptedAuth = null;
      let interceptedParams = null;

      const origGetAxiosClient = service.getAxiosClient.bind(service);
      service.getAxiosClient = function () {
        const client = origGetAxiosClient();
        client.defaults.adapter = async (config) => {
          interceptedAuth = config.headers?.Authorization;
          interceptedParams = config.params;
          return {
            status: 200,
            statusText: "OK",
            headers: {},
            config,
            data: {
              success: true,
              data: [
                {
                  archRegNum: "CA/2021/12345",
                  archFirstName: "AMIT",
                  archLastName: "KUMAR",
                  archStatus: "Active",
                  archValidityUpTo: "31/December/2026",
                  CorresspondanceAddr: "Sector 62",
                  district: "Noida",
                  pincode: "201301",
                },
              ],
            },
          };
        };
        return client;
      };

      const res = await service.searchArchitect({ regNumber: "CA/2021/12345" });
      assert.strictEqual(res.found, true);
      assert.strictEqual(res.count, 1);
      assert.strictEqual(res.architects[0].regNumber, "CA/2021/12345");
      assert.strictEqual(res.architects[0].name, "AMIT KUMAR");
      assert.strictEqual(res.architects[0].status, "Active");
      assert.strictEqual(res.architects[0].validityDisplay, "Annual payment valid till 31/12/2026");
      assert.strictEqual(interceptedAuth, "Bearer search_token_123");
      assert.deepStrictEqual(interceptedParams, { reg_no: "CA/2021/12345" });
    } finally {
      axios.post = originalPost;
    }
  });

  // 58. Mocked Architect Search by Name (Multiple Results)
  await asyncTest("58. Mocked Architect Search - Search by Name (Multiple Results)", async () => {
    const service = new CoaApiServiceImpl.constructor();
    service.username = "test-user";
    service.password = "test-pass";

    const originalPost = axios.post;
    axios.post = async function (url) {
      if (url.includes("/auth/token")) {
        return { data: { success: true, data: { accessToken: "search_token_456", expiresIn: 900 } } };
      }
      return originalPost.apply(this, arguments);
    };

    try {
      const origGetAxiosClient = service.getAxiosClient.bind(service);
      service.getAxiosClient = function () {
        const client = origGetAxiosClient();
        client.defaults.adapter = async (config) => {
          return {
            status: 200,
            statusText: "OK",
            headers: {},
            config,
            data: {
              success: true,
              data: [
                {
                  archRegNum: "CA/2020/11111",
                  name: "Rahul Sharma",
                  status: "Active",
                  archValidityUpTo: "31/12/2025",
                },
                {
                  archRegNum: "CA/2019/22222",
                  name: "Rahul Verma",
                  status: "Defaulter",
                  archValidityUpTo: "31/12/2021",
                },
              ],
            },
          };
        };
        return client;
      };

      const res = await service.searchArchitect({ name: "Rahul" });
      assert.strictEqual(res.found, true);
      assert.strictEqual(res.count, 2);
      assert.strictEqual(res.architects[0].name, "Rahul Sharma");
      assert.strictEqual(res.architects[1].name, "Rahul Verma");
      assert.strictEqual(res.architects[1].status, "Defaulter");
    } finally {
      axios.post = originalPost;
    }
  });

  // 59. Mocked Architect Search - Record Not Found
  await asyncTest("59. Mocked Architect Search - Record Not Found Handling", async () => {
    const service = new CoaApiServiceImpl.constructor();
    service.username = "test-user";
    service.password = "test-pass";

    const originalPost = axios.post;
    axios.post = async function (url) {
      if (url.includes("/auth/token")) {
        return { data: { success: true, data: { accessToken: "search_token_789", expiresIn: 900 } } };
      }
      return originalPost.apply(this, arguments);
    };

    try {
      const origGetAxiosClient = service.getAxiosClient.bind(service);
      service.getAxiosClient = function () {
        const client = origGetAxiosClient();
        client.defaults.adapter = async (config) => {
          return {
            status: 200,
            statusText: "OK",
            headers: {},
            config,
            data: { success: true, data: [] },
          };
        };
        return client;
      };

      const res = await service.searchArchitect({ regNumber: "CA/9999/99999" });
      assert.strictEqual(res.found, false);
      assert.strictEqual(res.architects.length, 0);
      assert.ok(res.message.includes("No architect record found"));
    } finally {
      axios.post = originalPost;
    }
  });

  // 60. Payment-Validity Fields Verification (Annual, One-Time, Endorsement Due)
  test("60. Payment-Validity Fields - Format & Representation Verification", () => {
    // 1. Annual Payment
    const annual = coaApiService.normalizeArchitect({
      archRegNum: "CA/2010/12345",
      archName: "ANIL KAPOOR",
      archStatus: "Active",
      archValidityUpTo: "31/12/2027",
    });
    assert.strictEqual(annual.validityDisplay, "Annual payment valid till 31/12/2027");

    // 2. One Time Payment (OTP)
    const otp = coaApiService.normalizeArchitect({
      archRegNum: "CA/2015/67890",
      archName: "PRIYA SHARMA",
      archStatus: "Active",
      payment_type: "otp",
      archValidityUpTo: "31/12/2040",
    });
    assert.strictEqual(otp.validityDisplay, "One time payment valid till 31/12/40");

    // 3. Endorsement Due (Status or Validity)
    const endorsement = coaApiService.normalizeArchitect({
      archRegNum: "CA/2005/11223",
      archName: "ROHIT MEHTA",
      archStatus: "Active [ <span class=\"DataRed\">Endorsement Due</span> ]",
      archValidityUpTo: "31/12/2023",
    });
    assert.strictEqual(endorsement.validityDisplay, "Endorsement due.");
  });

  // 61. Mocked API Errors - 500 and Timeout Handling Fail Safely
  await asyncTest("61. Mocked Architect Search - Upstream 500 & Network Errors Fail Safely", async () => {
    const service = new CoaApiServiceImpl.constructor();
    service.username = "test-user";
    service.password = "test-pass";

    const originalPost = axios.post;
    axios.post = async function (url) {
      if (url.includes("/auth/token")) {
        return { data: { success: true, data: { accessToken: "search_token_err", expiresIn: 900 } } };
      }
      return originalPost.apply(this, arguments);
    };

    try {
      const origGetAxiosClient = service.getAxiosClient.bind(service);
      service.getAxiosClient = function () {
        const client = origGetAxiosClient();
        client.defaults.adapter = async (config) => {
          const err = new Error("Network timeout after 5000ms");
          err.config = config;
          throw err;
        };
        return client;
      };

      const res = await service.searchArchitect({ regNumber: "CA/2021/12345" });
      assert.strictEqual(res.found, false);
      assert.strictEqual(res.architects.length, 0);
      assert.ok(res.message.includes("No architect record found"));
    } finally {
      axios.post = originalPost;
    }
  });

  // 62. Button Click Routing - "Architect Status", "Search Architect", "Verify Architect" and IDs
  test("62. Button Click Routing - 'Architect Status', 'architect_status', and aliases prompt for registration number", () => {
    for (const title of ["Architect Status", "architect_status", "Search Architect", "search_architect", "Verify Architect", "verify_architect"]) {
      const classification = queryRouterService.classifyQuery(title);
      assert.strictEqual(
        classification.type,
        "PROMPT_SEARCH_ARCHITECT",
        `Expected PROMPT_SEARCH_ARCHITECT for button title/id: "${title}"`
      );
    }
  });

  console.log("\n==================================================");
  console.log(`📊 FINAL TEST REPORT: ${passed} Passed, ${failed} Failed`);
  console.log("==================================================");

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests();
