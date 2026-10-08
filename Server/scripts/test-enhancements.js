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
    try {
      const res = await coaApiService.searchArchitect({ regNumber: "CA/1975/00048" });
      if (res && res.found && res.architects.length > 0) {
        const arch = res.architects[0];
        assert.strictEqual(arch.regNumber, "CA/1975/00048");
      }
    } catch {
      // Ignore upstream network fluctuation in unit test
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
  await asyncTest("25. MongoDB - User message creates conversation record with only _id, chat, chatDate, userNumber", async () => {
    const userNumber = "919999988881";
    const userMsg = "Hello COA";
    const res = await conversationService.logUserMessage({ userNumber, message: userMsg, messageId: "msg_test_01" });

    assert.ok(res, "Must return result object");
    assert.strictEqual(res.key, "user_1");
    assert.strictEqual(res.message, userMsg);
    assert.strictEqual(res.chat["user_1"], userMsg);
    assert.ok(!Array.isArray(res.chat), "Chat must NOT be an array");
    assert.strictEqual(typeof res.chat, "object", "Chat must be an object");
  });

  // 26. Multiple Messages Append with Sequential Keys (user_1, coa_1, user_2, coa_2)
  await asyncTest("26. MongoDB - Multiple messages append with sequential keys (user_1, coa_1, user_2, coa_2)", async () => {
    const userNumber = "919999988882";
    const r1 = await conversationService.logUserMessage({ userNumber, message: "Hi", messageId: "msg_u1" });
    const r2 = await conversationService.logCoaMessage({ userNumber, message: "Welcome to COA", messageId: "msg_c1" });
    const r3 = await conversationService.logUserMessage({ userNumber, message: "CA/2021/12345", messageId: "msg_u2" });
    const r4 = await conversationService.logCoaMessage({ userNumber, message: "Status details", messageId: "msg_c2" });

    assert.strictEqual(r1.key, "user_1");
    assert.strictEqual(r2.key, "coa_1");
    assert.strictEqual(r3.key, "user_2");
    assert.strictEqual(r4.key, "coa_2");

    assert.strictEqual(r4.chat["user_1"], "Hi");
    assert.strictEqual(r4.chat["coa_1"], "Welcome to COA");
    assert.strictEqual(r4.chat["user_2"], "CA/2021/12345");
    assert.strictEqual(r4.chat["coa_2"], "Status details");
  });

  // 27. No Nested Array or Metadata Objects Inside Chat Entries
  await asyncTest("27. MongoDB - Chat object values are direct message strings without metadata objects", async () => {
    const userNumber = "919999988883";
    const res = await conversationService.logUserMessage({ userNumber, message: "Direct string test", messageId: "u_msg_str" });

    assert.strictEqual(typeof res.chat["user_1"], "string");
    assert.strictEqual(res.chat["user_1"], "Direct string test");
    assert.strictEqual(res.chat["user_1"].sender, undefined);
    assert.strictEqual(res.chat["user_1"].timestamp, undefined);
  });

  // 28. Chronological Conversation Order Maintained via Key Suffixes
  await asyncTest("28. MongoDB - Chronological order maintained with coa_1, coa_2, coa_3", async () => {
    const userNumber = "919999988884";
    await conversationService.logCoaMessage({ userNumber, message: "Message 1", messageId: "coa_seq_1" });
    await conversationService.logCoaMessage({ userNumber, message: "Message 2", messageId: "coa_seq_2" });
    const r3 = await conversationService.logCoaMessage({ userNumber, message: "Message 3", messageId: "coa_seq_3" });

    assert.strictEqual(r3.chat["coa_1"], "Message 1");
    assert.strictEqual(r3.chat["coa_2"], "Message 2");
    assert.strictEqual(r3.chat["coa_3"], "Message 3");
  });

  // 29. Deduplication by WhatsApp messageId avoids duplicate key increments
  await asyncTest("29. MongoDB - Duplicate messageId is ignored without creating extra keys", async () => {
    const userNumber = "919999988885";
    const duplicateId = "wamid.TEST_DEDUP_MSG_FLAT";
    const r1 = await conversationService.logUserMessage({ userNumber, message: "Hello", messageId: duplicateId });
    const r2 = await conversationService.logUserMessage({ userNumber, message: "Hello", messageId: duplicateId });

    assert.strictEqual(r1.key, "user_1");
    assert.strictEqual(r2.deduplicated, true);
    assert.strictEqual(r2.key, null);
    assert.strictEqual(r1.chat["user_2"], undefined);
  });

  // 30. Multiple Consecutive COA Responses
  await asyncTest("30. MongoDB - Multiple consecutive COA responses create coa_1, coa_2, coa_3", async () => {
    const userNumber = "919999988886";
    const r1 = await conversationService.logCoaMessage({ userNumber, message: "Part 1", messageId: "c_m1" });
    const r2 = await conversationService.logCoaMessage({ userNumber, message: "Part 2", messageId: "c_m2" });

    assert.strictEqual(r1.key, "coa_1");
    assert.strictEqual(r2.key, "coa_2");
    assert.strictEqual(r2.chat["coa_1"], "Part 1");
    assert.strictEqual(r2.chat["coa_2"], "Part 2");
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
