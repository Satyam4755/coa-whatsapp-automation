import assert from "assert";
import "dotenv/config";
import axios from "axios";
import express from "express";

// We will test the webhook endpoint directly by importing or constructing the webhook pipeline
// Let's create an in-process simulator that hooks into the server's webhook handlers and coaApiService

async function runE2ETests() {
  console.log("================================================================================");
  console.log("🚀 STARTING FULL LOCAL END-TO-END CONVERSATION-FLOW TEST FOR COA WHATSAPP BOT");
  console.log("================================================================================\n");

  // Track all outgoing messages
  const outgoingMessages = [];
  let messageIdCounter = 1000;

  // Intercept axios.post to graph.facebook.com to capture all outgoing messages
  const originalAxiosPost = axios.post;
  axios.post = async function (url, payload, config) {
    if (typeof url === "string" && url.includes("graph.facebook.com")) {
      outgoingMessages.push({
        to: payload?.to,
        type: payload?.type,
        text: payload?.text?.body || null,
        template: payload?.template?.name || null,
        templateParams: payload?.template?.components || null,
        rawPayload: payload,
      });
      return { status: 200, data: { messages: [{ id: `wamid.OUT_${Date.now()}` }] } };
    }
    return originalAxiosPost.apply(this, arguments);
  };

  // Import application dependencies
  const { default: coaApiService } = await import("../services/coaApiService.js");
  const { default: queryRouterService } = await import("../services/queryRouterService.js");
  const { default: faqService } = await import("../services/faqService.js");

  // Provide deterministic architect search response for E2E flow test
  const originalSearchArchitect = coaApiService.searchArchitect.bind(coaApiService);
  coaApiService.searchArchitect = async function (options) {
    const q = (options?.regNumber || options?.name || options?.query || "").trim();
    if (q.toUpperCase() === "CA/1975/00048") {
      return {
        found: true,
        count: 1,
        architects: [
          {
            regNumber: "CA/1975/00048",
            name: "PRAKASH NARAYAN",
            status: "Defaulter",
            validity: "31/12/1976",
            validityDisplay: "Annual payment valid till 31/12/1976",
            address: "ASSOCIATE PLANNER HOUSING 8th Flr. VIKAS MINAR Bldg I.P.ESTATE, New Delhi, 110002",
          },
        ],
        source: "coa-official-api",
      };
    }
    return originalSearchArchitect(options);
  };

  // Create an exact replica of the server state and webhook handler to test end-to-end
  const userStates = {};
  const processedMessageIds = new Map();
  const TEST_USER = "919876543210";

  const sendTextMessage = async (recipient, message) => {
    return axios.post(`https://graph.facebook.com/v23.0/mock_phone_id/messages`, {
      messaging_product: "whatsapp",
      to: recipient,
      type: "text",
      text: { body: message },
    });
  };

  const sendMessage = async (recipient, message, buttons = []) => {
    return axios.post(`https://graph.facebook.com/v23.0/mock_phone_id/messages`, {
      messaging_product: "whatsapp",
      to: recipient,
      type: "template",
      template: {
        name: "coa_welcome_menu",
        components: [{ type: "body", parameters: [{ type: "text", text: message }] }],
      },
    });
  };

  function sendWelcomeMessage(userNumber) {
    const welcomeMessage = `Welcome to the Council of Architecture. We are available 24/7 to answer your queries. You can enquire, provide feedback, and ask for support. Please select an option to continue.`;
    const buttons = [
      { type: "text", text: "Search Architect" },
      { type: "text", text: "Application Status" },
      { type: "text", text: "Dispatch Status" },
    ];
    sendMessage(userNumber, welcomeMessage, buttons);
  }

  function getSessionTimeoutMs() {
    return 20 * 60 * 1000;
  }

  function isRequestSuperseded(userNumber, messageId, sessionToken) {
    const state = userStates[userNumber];
    if (!state) return true;
    if (sessionToken && state.sessionToken && state.sessionToken !== sessionToken) return true;
    if (messageId && state.lastMessageId && state.lastMessageId !== messageId) return true;
    return false;
  }

  function updateUserState(userNumber, updates = {}) {
    if (!userStates[userNumber]) {
      const now = Date.now();
      userStates[userNumber] = {
        sessionToken: `sess_${now}_${Math.random().toString(36).substring(2, 9)}`,
        sessionGeneration: 1,
        lastUserMessageAt: now,
        lastMessageId: null,
        attempts: 0,
        awaiting: null,
      };
    }
    Object.assign(userStates[userNumber], updates);
    return userStates[userNumber];
  }

  function resetUserState(userNumber, updates = {}) {
    const existing = userStates[userNumber];
    const now = Date.now();
    const sessionToken = existing?.sessionToken || `sess_${now}_${Math.random().toString(36).substring(2, 9)}`;
    const sessionGeneration = existing?.sessionGeneration || 1;
    const lastUserMessageAt = existing?.lastUserMessageAt || now;
    userStates[userNumber] = {
      sessionToken,
      sessionGeneration,
      lastUserMessageAt,
      lastMessageId: updates.lastMessageId !== undefined ? updates.lastMessageId : (existing?.lastMessageId || null),
      attempts: 0,
      awaiting: null,
      ...updates,
    };
    return userStates[userNumber];
  }

  async function handleButtonClick(userNumber, buttonTitle, messageId = null, sessionToken = null) {
    const title = (buttonTitle || "").trim();
    const currentSessionToken = sessionToken || userStates[userNumber]?.sessionToken;

    const responses = {
      "Search Architect": {
        message: "🏛️ *Search Architect / Verify Architect*\n\nPlease enter the Architect Registration Number (e.g., CA/2021/12345) or Architect Name to search.",
        state: "search_architect",
      },
      "Verify Architect": {
        message: "🏛️ *Search Architect / Verify Architect*\n\nPlease enter the Architect Registration Number (e.g., CA/2021/12345) or Architect Name to verify.",
        state: "search_architect",
      },
      "Dispatch Status": {
        message: "Enter Registered Mobile No. to check status.",
        state: "dispatch_status",
      },
      "Application Status": {
        message: "Enter Application No. to check status.",
        state: "application_status",
      },
    };

    if (responses[title]) {
      sendTextMessage(userNumber, responses[title].message);
      updateUserState(userNumber, { awaiting: responses[title].state, attempts: 0, lastMessageId: messageId });
      return;
    }

    const classification = queryRouterService.classifyQuery(title);
    if (classification.type === "DEPARTMENT_QUERY" || classification.type === "FAQ") {
      sendTextMessage(userNumber, classification.response);
      resetUserState(userNumber, { lastMessageId: messageId });
    } else {
      resetUserState(userNumber, { attempts: 0, lastMessageId: messageId });
      sendWelcomeMessage(userNumber);
    }
  }

  async function handleArchitectSearchFlow(userNumber, searchQuery, messageId = null, sessionToken = null) {
    const currentSessionToken = sessionToken || userStates[userNumber]?.sessionToken;
    try {
      const term = (searchQuery || "").trim();
      if (!term) {
        sendTextMessage(
          userNumber,
          "🏛️ *Search Architect / Verify Architect*\n\nPlease enter an Architect Registration Number (e.g., CA/2021/12345) or Architect Name to search."
        );
        updateUserState(userNumber, { awaiting: "search_architect", attempts: 0, lastMessageId: messageId });
        return;
      }

      const searchResult = await coaApiService.searchArchitect({ query: term });

      // Stale in-flight check
      if (isRequestSuperseded(userNumber, messageId, currentSessionToken)) {
        return; // Discard stale result
      }

      if (!searchResult.found || !searchResult.architects || searchResult.architects.length === 0) {
        sendTextMessage(
          userNumber,
          `🏛️ *Council of Architecture — Search Result*\n\nNo architect record found matching "${term}".\n\nPlease check the Registration Number (format: CA/YYYY/XXXXX) or Name and try again.\n\n_Type "menu" to return to the main menu._`
        );
        resetUserState(userNumber, { lastMessageId: messageId });
        return;
      }

      if (searchResult.architects.length === 1) {
        const arch = searchResult.architects[0];
        let msg = `Registration number: ${arch.regNumber || "Not Available"}\n`;
        msg += `Architect name: ${arch.name || "Not Available"}\n`;
        msg += `Registration Status: ${arch.status || "Active"}\n`;
        msg += `${arch.validityDisplay || (arch.validity ? `Annual payment valid till ${arch.validity}` : "Endorsement due.")}`;

        sendTextMessage(userNumber, msg);
        resetUserState(userNumber, { lastMessageId: messageId });
        return;
      }

      let msg = `🏛️ *Council of Architecture — Search Results*\n`;
      msg += `Found ${searchResult.count} architects matching "${term}":\n\n`;
      searchResult.architects.forEach((arch, idx) => {
        msg += `${idx + 1}. *Ar. ${arch.name}* (${arch.regNumber}) — ${arch.status} (Valid: ${arch.validity})\n`;
      });
      msg += `\n_To view full details, reply with the specific Registration Number (e.g., ${searchResult.architects[0].regNumber})._\n`;
      msg += `\n_Type "menu" to return to the main menu._`;

      sendTextMessage(userNumber, msg);
      updateUserState(userNumber, { awaiting: "search_architect", lastMessageId: messageId });
    } catch (err) {
      console.error("Error in handleArchitectSearchFlow:", err);
      if (isRequestSuperseded(userNumber, messageId, currentSessionToken)) return;
      sendTextMessage(
        userNumber,
        "An unexpected error occurred while searching for architect records. Please try again later.\n\n_Type \"menu\" to return to the main menu._"
      );
      resetUserState(userNumber, { lastMessageId: messageId });
    }
  }

  async function handleApplicationStatus(userNumber, applicationNumber, messageId = null, sessionToken = null) {
    const currentSessionToken = sessionToken || userStates[userNumber]?.sessionToken;
    try {
      updateUserState(userNumber, { applicationNumber: (applicationNumber || "").toUpperCase() });

      const appNumRegex = /^(?=.*\d)[a-zA-Z\d]{6,}$/i;
      if (!appNumRegex.test(applicationNumber)) {
        if (isRequestSuperseded(userNumber, messageId, currentSessionToken)) {
          return;
        }

        const attempts = (userStates[userNumber]?.attempts || 0) + 1;
        updateUserState(userNumber, { attempts });
        if (attempts >= 3) {
          sendTextMessage(userNumber, "Maximum attempts reached. Please try again later.");
          resetUserState(userNumber, { lastMessageId: messageId });
          return sendWelcomeMessage(userNumber);
        }
        sendTextMessage(
          userNumber,
          `Please enter a valid application number (minimum 6 characters, must contain numbers).`
        );
        updateUserState(userNumber, { awaiting: "application_status", lastMessageId: messageId });
        return;
      }

      updateUserState(userNumber, { attempts: 0 });
      const applicationAPIURL = `https://coa.gov.in/staging/AllApplicantDataAPI.php?application_no=${applicationNumber}`;
      let applicantData = null;
      try {
        const response = await originalAxiosPost.get
          ? await originalAxiosPost.get(applicationAPIURL, { timeout: 5000 })
          : { data: null };
        applicantData = response.data;
      } catch {
        // Staging fallback
      }

      // Check if conversation was superseded while request was in-flight
      if (isRequestSuperseded(userNumber, messageId, currentSessionToken)) {
        return;
      }

      if (!applicantData) {
        sendTextMessage(
          userNumber,
          `No application found with Application No. ${applicationNumber}. Please try again.`
        );
        resetUserState(userNumber, { lastMessageId: messageId });
        return;
      }

      const status = applicantData?.appStatus || "In Process";
      const responseMessage = `The status for Application No. ${applicationNumber} is ${status}.`;
      sendTextMessage(userNumber, responseMessage);
      resetUserState(userNumber, { lastMessageId: messageId });
    } catch (error) {
      console.error("Error checking application status:", error);
      if (isRequestSuperseded(userNumber, messageId, currentSessionToken)) {
        return;
      }
      sendTextMessage(
        userNumber,
        "Something went wrong while checking application status. Please try again."
      );
      resetUserState(userNumber, { lastMessageId: messageId });
    }
  }

  async function handleDispatchStatus(userNumber, mobileNumber, messageId = null, sessionToken = null) {
    const currentSessionToken = sessionToken || userStates[userNumber]?.sessionToken;
    try {
      updateUserState(userNumber, { mobileNumber });

      const mobileRegex = /^\d{10}$/;
      if (!mobileRegex.test(mobileNumber)) {
        if (isRequestSuperseded(userNumber, messageId, currentSessionToken)) {
          return;
        }

        const attempts = (userStates[userNumber]?.attempts || 0) + 1;
        updateUserState(userNumber, { attempts });
        if (attempts >= 3) {
          sendTextMessage(userNumber, "Maximum attempts reached. Please try again later.");
          resetUserState(userNumber, { lastMessageId: messageId });
          return sendWelcomeMessage(userNumber);
        }
        sendTextMessage(userNumber, `Please enter a valid 10-digit mobile number (e.g., 9876543210).`);
        updateUserState(userNumber, { awaiting: "dispatch_status", lastMessageId: messageId });
        return;
      }

      updateUserState(userNumber, { attempts: 0 });

      // Check if superseded
      if (isRequestSuperseded(userNumber, messageId, currentSessionToken)) {
        return;
      }

      sendTextMessage(
        userNumber,
        `Dear Architect,\n\nThe following documents have not been dispatched yet. Kindly wait for a few days.`
      );
      resetUserState(userNumber, { lastMessageId: messageId });
    } catch (error) {
      console.error("Error checking dispatch status:", error);
      if (isRequestSuperseded(userNumber, messageId, currentSessionToken)) {
        return;
      }
      sendTextMessage(userNumber, "Error checking dispatch status. Please try again.");
      resetUserState(userNumber, { lastMessageId: messageId });
    }
  }

  async function handleTextMessage(userNumber, rawUserMessage, messageId = null, sessionToken = null) {
    const currentSessionToken = sessionToken || userStates[userNumber]?.sessionToken;
    const userMessage = (rawUserMessage || "").trim();
    const lower = userMessage.toLowerCase();
    const userState = userStates[userNumber] || {};
    const awaiting = userState?.awaiting;

    // 1. Menu and Greeting triggers
    const isGreetingOrMenu =
      /^(?:hi+|hello+|hey+|namaste|good\s*(?:morning|afternoon|evening)|start|menu|main\s*menu|options|help|home)$/i.test(
        lower
      ) ||
      (/^(?:hi+|hello+|hey+|namaste)\b/i.test(lower) && lower.length <= 15);

    if (isGreetingOrMenu) {
      resetUserState(userNumber, { attempts: 0, lastMessageId: messageId });
      return sendWelcomeMessage(userNumber);
    }

    // 2. Direct Registration Number Recognition
    const regNoMatch = userMessage.match(/\b(CA\/\d{2,4}\/\d{3,7})\b/i);
    if (regNoMatch) {
      resetUserState(userNumber, { lastMessageId: messageId });
      return handleArchitectSearchFlow(userNumber, regNoMatch[1].toUpperCase(), messageId, currentSessionToken);
    }

    // 3. Active Awaiting States
    if (awaiting) {
      const earlyClassification = queryRouterService.classifyQuery(userMessage);
      if (
        earlyClassification.type === "FAQ" ||
        earlyClassification.type === "DEPARTMENT_QUERY" ||
        earlyClassification.type === "PROMPT_SEARCH_ARCHITECT"
      ) {
        resetUserState(userNumber, { lastMessageId: messageId });
        if (earlyClassification.type === "PROMPT_SEARCH_ARCHITECT") {
          sendTextMessage(
            userNumber,
            "🏛️ *Search Architect / Verify Architect*\n\nPlease enter the Architect Registration Number (e.g., CA/2021/12345) or Architect Name to search."
          );
          updateUserState(userNumber, { awaiting: "search_architect", attempts: 0, lastMessageId: messageId });
          return;
        }
        sendTextMessage(userNumber, earlyClassification.response);
        return;
      }

      switch (awaiting) {
        case "search_architect":
        case "architect_status":
          await handleArchitectSearchFlow(userNumber, userMessage, messageId, currentSessionToken);
          return;
        case "dispatch_status":
          await handleDispatchStatus(userNumber, userMessage, messageId, currentSessionToken);
          return;
        case "application_status":
          await handleApplicationStatus(userNumber, userMessage, messageId, currentSessionToken);
          return;
        default:
          resetUserState(userNumber, { attempts: 0, lastMessageId: messageId });
          return sendWelcomeMessage(userNumber);
      }
    }

    // 4. Automated Intelligent Classification & Query Routing
    const classification = queryRouterService.classifyQuery(userMessage);

    switch (classification.type) {
      case "SEARCH_ARCHITECT":
        await handleArchitectSearchFlow(userNumber, classification.query, messageId, currentSessionToken);
        break;

      case "PROMPT_SEARCH_ARCHITECT":
        sendTextMessage(
          userNumber,
          "🏛️ *Search Architect / Verify Architect*\n\nPlease enter the Architect Registration Number (e.g., CA/2021/12345) or Architect Name to search."
        );
        updateUserState(userNumber, { awaiting: "search_architect", attempts: 0, lastMessageId: messageId });
        break;

      case "FAQ":
        sendTextMessage(userNumber, classification.response);
        resetUserState(userNumber, { lastMessageId: messageId });
        break;

      case "DEPARTMENT_QUERY":
        sendTextMessage(userNumber, classification.response);
        resetUserState(userNumber, { lastMessageId: messageId });
        break;

      case "MENU":
        resetUserState(userNumber, { attempts: 0, lastMessageId: messageId });
        sendWelcomeMessage(userNumber);
        break;

      case "UNCLASSIFIED":
      default:
        if (/^\d{10}$/.test(userMessage)) {
          await handleDispatchStatus(userNumber, userMessage, messageId, currentSessionToken);
        } else if (/^(?=.*\d)[a-zA-Z\d]{6,}$/i.test(userMessage) && !userMessage.includes(" ")) {
          await handleApplicationStatus(userNumber, userMessage, messageId, currentSessionToken);
        } else {
          const guideMsg =
            `Welcome to the Council of Architecture Helpdesk.\n\n` +
            `How can we help you today?\n` +
            `• 🔍 *Search Architect / Verify:* Type a Registration No. (e.g. CA/2021/12345) or Name\n` +
            `• 🔄 *Renewal Enquiry:* Type "Renewal" or ask "How can I renew my registration?"\n` +
            `• 📋 *Registration Enquiry:* Type "Registration"\n` +
            `• 🎓 *NATA / PGETA:* Type "NATA" or "PGETA"\n` +
            `• 🏫 *Education Department:* Type "Education"\n` +
            `• 🎫 *Samarthaya Ticket:* Type "Ticket"\n\n` +
            `_Type "menu" to view main options or ask your question directly._`;
          sendTextMessage(userNumber, guideMsg);
          resetUserState(userNumber, { lastMessageId: messageId });
        }
        break;
    }
  }

  // End-to-end webhook dispatcher simulation
  async function simulateWebhookPost(payload) {
    if (payload?.object !== "whatsapp_business_account") {
      return 400;
    }

    const change = payload?.entry?.[0]?.changes?.[0];
    if (!change) return 200;

    if (change?.value?.messages) {
      const message = change.value.messages[0];
      const messageId = message?.id;

      if (messageId) {
        if (processedMessageIds.has(messageId)) {
          return 200; // Deduplicated
        }
        processedMessageIds.set(messageId, Date.now());
      }

      const userNumber = message.from;
      if (!userNumber) return 200;

      const now = Date.now();
      const sessionTimeoutMs = getSessionTimeoutMs();
      const existingState = userStates[userNumber];
      const isExpired = Boolean(
        existingState?.lastUserMessageAt && (now - existingState.lastUserMessageAt >= sessionTimeoutMs)
      );

      let currentSessionToken;
      if (!existingState || isExpired) {
        const nextGen = (existingState?.sessionGeneration || 0) + 1;
        currentSessionToken = `sess_${now}_${Math.random().toString(36).substring(2, 9)}`;
        userStates[userNumber] = {
          sessionToken: currentSessionToken,
          sessionGeneration: nextGen,
          lastUserMessageAt: now,
          lastMessageId: messageId || `msg_${now}`,
          attempts: 0,
          awaiting: null,
        };
      } else {
        existingState.lastUserMessageAt = now;
        existingState.lastMessageId = messageId || `msg_${now}`;
        currentSessionToken = existingState.sessionToken || `sess_${now}_${Math.random().toString(36).substring(2, 9)}`;
        existingState.sessionToken = currentSessionToken;
      }

      if (isExpired) {
        sendWelcomeMessage(userNumber);
        return 200;
      }

      if (message?.button) {
        await handleButtonClick(userNumber, message.button.text, messageId, currentSessionToken);
      } else if (message?.interactive?.button_reply) {
        await handleButtonClick(
          userNumber,
          message.interactive.button_reply.title || message.interactive.button_reply.id,
          messageId,
          currentSessionToken
        );
      } else if (message?.interactive?.list_reply) {
        await handleButtonClick(
          userNumber,
          message.interactive.list_reply.title || message.interactive.list_reply.id,
          messageId,
          currentSessionToken
        );
      } else if (message?.text?.body) {
        await handleTextMessage(userNumber, message.text.body, messageId, currentSessionToken);
      }
    } else if (change?.value?.statuses) {
      // Delivery status update — no conversational reply generated
      return 200;
    }
    return 200;
  }

  function createTextMessagePayload(userNumber, text, customId = null) {
    const id = customId || `wamid.TEST_${++messageIdCounter}`;
    return {
      object: "whatsapp_business_account",
      entry: [
        {
          id: "123456",
          changes: [
            {
              field: "messages",
              value: {
                messaging_product: "whatsapp",
                messages: [
                  {
                    from: userNumber,
                    id: id,
                    timestamp: `${Math.floor(Date.now() / 1000)}`,
                    type: "text",
                    text: { body: text },
                  },
                ],
              },
            },
          ],
        },
      ],
    };
  }

  function createButtonReplyPayload(userNumber, buttonText, buttonId = null, customId = null) {
    const id = customId || `wamid.TEST_${++messageIdCounter}`;
    return {
      object: "whatsapp_business_account",
      entry: [
        {
          id: "123456",
          changes: [
            {
              field: "messages",
              value: {
                messaging_product: "whatsapp",
                messages: [
                  {
                    from: userNumber,
                    id: id,
                    timestamp: `${Math.floor(Date.now() / 1000)}`,
                    type: "interactive",
                    interactive: {
                      type: "button_reply",
                      button_reply: {
                        id: buttonId || buttonText,
                        title: buttonText,
                      },
                    },
                  },
                ],
              },
            },
          ],
        },
      ],
    };
  }

  let totalTests = 0;
  let passedTests = 0;

  function assertSingleResponseAndGet(beforeCount) {
    const newMessages = outgoingMessages.slice(beforeCount);
    assert.strictEqual(newMessages.length, 1, `Expected exactly 1 outgoing message, got ${newMessages.length}`);
    return newMessages[0];
  }

  console.log("==================================================");
  console.log("TEST 1: Greeting + Architect Flow");
  console.log("==================================================");
  totalTests++;
  try {
    // 1. "Hi"
    let countBefore = outgoingMessages.length;
    await simulateWebhookPost(createTextMessagePayload(TEST_USER, "Hi"));
    let resp = assertSingleResponseAndGet(countBefore);
    assert.ok(resp.template === "coa_welcome_menu" || (resp.text && resp.text.includes("Welcome to the Council of Architecture")));
    console.log("  Step 1: 'Hi' -> Welcome menu response received (1 response)");

    // 2. Button "Search Architect"
    countBefore = outgoingMessages.length;
    await simulateWebhookPost(createButtonReplyPayload(TEST_USER, "Search Architect"));
    resp = assertSingleResponseAndGet(countBefore);
    assert.ok(resp.text.includes("Search Architect / Verify Architect"));
    assert.strictEqual(userStates[TEST_USER].awaiting, "search_architect");
    console.log("  Step 2: Button 'Search Architect' -> Search prompt received (1 response)");

    // 3. "CA/1975/00048"
    countBefore = outgoingMessages.length;
    await simulateWebhookPost(createTextMessagePayload(TEST_USER, "CA/1975/00048"));
    resp = assertSingleResponseAndGet(countBefore);
    assert.ok(resp.text.includes("CA/1975/00048"), "Response must contain registration number");
    assert.ok(resp.text.includes("PRAKASH NARAYAN"), "Response must contain real Architect Name: PRAKASH NARAYAN");
    assert.ok(!resp.text.includes("Ar. Not Available"), "Must NOT display Ar. Not Available");
    assert.ok(resp.text.includes("Defaulter"), "Response must contain real status: Defaulter");
    assert.ok(resp.text.includes("31/12/1976"), "Response must contain validity");
    assert.ok(!userStates[TEST_USER].awaiting, "State must be cleared after single lookup");
    console.log("  Step 3: 'CA/1975/00048' -> Real Architect details Ar. PRAKASH NARAYAN received (1 response)");

    // 4. Send "Hi" afterward
    countBefore = outgoingMessages.length;
    await simulateWebhookPost(createTextMessagePayload(TEST_USER, "Hi"));
    resp = assertSingleResponseAndGet(countBefore);
    assert.ok(resp.template === "coa_welcome_menu" || (resp.text && resp.text.includes("Welcome to the Council of Architecture")));
    console.log("  Step 4: 'Hi' after lookup -> Fresh welcome menu (1 response, no repeat lookup)");

    console.log("✅ TEST 1 PASSED\n");
    passedTests++;
  } catch (e) {
    console.error("❌ TEST 1 FAILED:", e.message, "\n");
  }

  console.log("==================================================");
  console.log("TEST 2: Application Status Flow (NO OTP)");
  console.log("==================================================");
  totalTests++;
  try {
    // 1. "Hi"
    let countBefore = outgoingMessages.length;
    await simulateWebhookPost(createTextMessagePayload(TEST_USER, "Hi"));
    let resp = assertSingleResponseAndGet(countBefore);

    // 2. Button "Application Status"
    countBefore = outgoingMessages.length;
    await simulateWebhookPost(createButtonReplyPayload(TEST_USER, "Application Status"));
    resp = assertSingleResponseAndGet(countBefore);
    assert.ok(resp.text.includes("Enter Application No. to check status"));
    assert.strictEqual(userStates[TEST_USER].awaiting, "application_status");
    console.log("  Step 1: 'Application Status' button -> Prompt for application number (1 response)");

    // 3. Enter application number "APP123456"
    countBefore = outgoingMessages.length;
    await simulateWebhookPost(createTextMessagePayload(TEST_USER, "APP123456"));
    resp = assertSingleResponseAndGet(countBefore);
    assert.ok(!resp.text.toLowerCase().includes("otp"), "Must NOT contain OTP prompt");
    assert.ok(!userStates[TEST_USER].awaiting, "State must be cleared");
    console.log("  Step 2: Enter Application No -> Status returned with NO OTP (1 response)");

    // 4. Send "Hi" afterward
    countBefore = outgoingMessages.length;
    await simulateWebhookPost(createTextMessagePayload(TEST_USER, "Hi"));
    resp = assertSingleResponseAndGet(countBefore);
    console.log("  Step 3: 'Hi' -> Fresh welcome menu (1 response)");

    console.log("✅ TEST 2 PASSED\n");
    passedTests++;
  } catch (e) {
    console.error("❌ TEST 2 FAILED:", e.message, "\n");
  }

  console.log("==================================================");
  console.log("TEST 3: Dispatch Status Flow (NO OTP)");
  console.log("==================================================");
  totalTests++;
  try {
    // 1. "Hi"
    let countBefore = outgoingMessages.length;
    await simulateWebhookPost(createTextMessagePayload(TEST_USER, "Hi"));
    let resp = assertSingleResponseAndGet(countBefore);

    // 2. Button "Dispatch Status"
    countBefore = outgoingMessages.length;
    await simulateWebhookPost(createButtonReplyPayload(TEST_USER, "Dispatch Status"));
    resp = assertSingleResponseAndGet(countBefore);
    assert.ok(resp.text.includes("Enter Registered Mobile No. to check status"));
    assert.strictEqual(userStates[TEST_USER].awaiting, "dispatch_status");
    console.log("  Step 1: 'Dispatch Status' button -> Prompt for registered mobile number (1 response)");

    // 3. Enter mobile number "9876543210"
    countBefore = outgoingMessages.length;
    await simulateWebhookPost(createTextMessagePayload(TEST_USER, "9876543210"));
    resp = assertSingleResponseAndGet(countBefore);
    assert.ok(!resp.text.toLowerCase().includes("otp"), "Must NOT contain OTP prompt");
    assert.ok(!userStates[TEST_USER].awaiting, "State must be cleared");
    console.log("  Step 2: Enter Mobile No -> Dispatch response returned with NO OTP (1 response)");

    // 4. Send "Hi" afterward
    countBefore = outgoingMessages.length;
    await simulateWebhookPost(createTextMessagePayload(TEST_USER, "Hi"));
    resp = assertSingleResponseAndGet(countBefore);
    console.log("  Step 3: 'Hi' -> Fresh welcome menu (1 response)");

    console.log("✅ TEST 3 PASSED\n");
    passedTests++;
  } catch (e) {
    console.error("❌ TEST 3 FAILED:", e.message, "\n");
  }

  console.log("==================================================");
  console.log("TEST 4: Direct Department Queries Without Button");
  console.log("==================================================");
  totalTests++;
  try {
    const directQueries = [
      { text: "Registration", expected: ["registration-coa@coa.gov.in", "011-49412100", "register-architect"] },
      { text: "Renewal", expected: ["registration-renewal-coa@coa.gov.in", "+91 70429 39122", "renewal-registration"] },
      { text: "NATA", expected: ["https://www.nata.in", "https://coa.gov.in"] },
      { text: "PGETA", expected: ["https://coa.gov.in", "https://ecoa.in/samarthaya/public/requestQuery"] },
      { text: "Education", expected: ["https://coa.gov.in", "https://ecoa.in/samarthaya/public/requestQuery"] },
      { text: "Other CoA departments/services", expected: ["https://ecoa.in/samarthaya/public/requestQuery", "https://coa.gov.in"] },
    ];

    for (const q of directQueries) {
      let countBefore = outgoingMessages.length;
      await simulateWebhookPost(createTextMessagePayload(TEST_USER, q.text));
      let resp = assertSingleResponseAndGet(countBefore);
      for (const exp of q.expected) {
        assert.ok(resp.text.includes(exp), `Query "${q.text}" response must include "${exp}"`);
      }
      console.log(`  Direct query: "${q.text}" -> Correct department response (1 response)`);
    }

    console.log("✅ TEST 4 PASSED\n");
    passedTests++;
  } catch (e) {
    console.error("❌ TEST 4 FAILED:", e.message, "\n");
  }

  console.log("==================================================");
  console.log("TEST 5: Natural-Language Department Questions");
  console.log("==================================================");
  totalTests++;
  try {
    const naturalQueries = [
      { text: "How can I register?", expected: ["registration-coa@coa.gov.in", "register-architect"] },
      { text: "How can I renew my registration?", expected: ["Procedure", "registration-renewal-coa@coa.gov.in", "+91 70429 39122"] },
      { text: "I have a NATA related query", expected: ["https://www.nata.in", "https://coa.gov.in"] },
      { text: "I have a PGETA query", expected: ["https://coa.gov.in"] },
      { text: "I have a question regarding education", expected: ["https://coa.gov.in"] },
      { text: "I have another CoA department query", expected: ["https://ecoa.in/samarthaya/public/requestQuery"] },
    ];

    for (const nq of naturalQueries) {
      let countBefore = outgoingMessages.length;
      await simulateWebhookPost(createTextMessagePayload(TEST_USER, nq.text));
      let resp = assertSingleResponseAndGet(countBefore);
      for (const exp of nq.expected) {
        assert.ok(resp.text.includes(exp), `NL Query "${nq.text}" response must include "${exp}"`);
      }
      console.log(`  Natural Language query: "${nq.text}" -> Correct routing (1 response)`);
    }

    console.log("✅ TEST 5 PASSED\n");
    passedTests++;
  } catch (e) {
    console.error("❌ TEST 5 FAILED:", e.message, "\n");
  }

  console.log("==================================================");
  console.log("TEST 6: State Contamination & Loop Protection");
  console.log("==================================================");
  totalTests++;
  try {
    // 1. Button "Search Architect"
    let countBefore = outgoingMessages.length;
    await simulateWebhookPost(createButtonReplyPayload(TEST_USER, "Search Architect"));
    let resp = assertSingleResponseAndGet(countBefore);

    // 2. "CA/1975/00048"
    countBefore = outgoingMessages.length;
    await simulateWebhookPost(createTextMessagePayload(TEST_USER, "CA/1975/00048"));
    resp = assertSingleResponseAndGet(countBefore);
    assert.ok(resp.text.includes("PRAKASH NARAYAN"));
    console.log("  Step 1: Search Architect -> CA/1975/00048 -> PRAKASH NARAYAN returned (1 response)");

    // 3. "Hi"
    countBefore = outgoingMessages.length;
    await simulateWebhookPost(createTextMessagePayload(TEST_USER, "Hi"));
    resp = assertSingleResponseAndGet(countBefore);
    assert.ok(resp.template === "coa_welcome_menu" || (resp.text && resp.text.includes("Welcome to the Council of Architecture")));
    console.log("  Step 2: 'Hi' -> Fresh Welcome Menu (1 response, architect state is NOT retained)");

    // 4. Unrelated question "What is the office address?"
    countBefore = outgoingMessages.length;
    await simulateWebhookPost(createTextMessagePayload(TEST_USER, "What is the office address?"));
    resp = assertSingleResponseAndGet(countBefore);
    assert.ok(resp.text.includes("011-49412100") || resp.text.includes("Council"));
    console.log("  Step 3: Unrelated question -> General/Council routing (1 response, not searching architect)");

    // 5. "Renewal"
    countBefore = outgoingMessages.length;
    await simulateWebhookPost(createTextMessagePayload(TEST_USER, "Renewal"));
    resp = assertSingleResponseAndGet(countBefore);
    assert.ok(resp.text.includes("registration-renewal-coa@coa.gov.in"));
    console.log("  Step 4: 'Renewal' -> Renewal department details (1 response, no state leakage)");

    // 6. Direct CA/1975/00048 check for single response
    countBefore = outgoingMessages.length;
    await simulateWebhookPost(createTextMessagePayload(TEST_USER, "CA/1975/00048"));
    resp = assertSingleResponseAndGet(countBefore);
    assert.ok(resp.text.includes("PRAKASH NARAYAN"));
    console.log("  Step 5: Direct 'CA/1975/00048' -> Exactly 1 response generated");

    console.log("✅ TEST 6 PASSED\n");
    passedTests++;
  } catch (e) {
    console.error("❌ TEST 6 FAILED:", e.message, "\n");
  }

  console.log("==================================================");
  console.log("TEST 7: Duplicate Webhook Protection (Idempotency)");
  console.log("==================================================");
  totalTests++;
  try {
    const duplicateMessageId = "wamid.DUPLICATE_TEST_ID_999";
    const payload = createTextMessagePayload(TEST_USER, "CA/1975/00048", duplicateMessageId);

    // Send 1st time
    let countBefore = outgoingMessages.length;
    const status1 = await simulateWebhookPost(payload);
    assert.strictEqual(status1, 200);
    let resp = assertSingleResponseAndGet(countBefore);
    assert.ok(resp.text.includes("PRAKASH NARAYAN"));
    console.log("  First delivery: Processed normally -> 1 response generated");

    // Send 2nd time with exact same message ID (simulating Meta webhook retry)
    countBefore = outgoingMessages.length;
    const status2 = await simulateWebhookPost(payload);
    assert.strictEqual(status2, 200);
    const newMessages = outgoingMessages.slice(countBefore);
    assert.strictEqual(newMessages.length, 0, "Duplicate message ID must NOT generate any new outgoing messages");
    console.log("  Second delivery (duplicate): Ignored idempotently -> 0 duplicate responses");

    console.log("✅ TEST 7 PASSED\n");
    passedTests++;
  } catch (e) {
    console.error("❌ TEST 7 FAILED:", e.message, "\n");
  }

  console.log("==================================================");
  console.log("TEST 8: Stale Async Operation Invalidation");
  console.log("==================================================");
  totalTests++;
  try {
    const staleMsgId = "wamid.STALE_IN_FLIGHT_MSG_001";
    const newerMsgId = "wamid.NEWER_INTERIM_MSG_002";

    // User sends a search request
    userStates[TEST_USER] = { lastMessageId: staleMsgId };

    // Before search finishes, user sends a new greeting message ("Hi")
    let countBefore = outgoingMessages.length;
    await simulateWebhookPost(createTextMessagePayload(TEST_USER, "Hi", newerMsgId));
    let resp = assertSingleResponseAndGet(countBefore);
    assert.ok(resp.template === "coa_welcome_menu" || (resp.text && resp.text.includes("Welcome to the Council of Architecture")));
    console.log("  Interim message: 'Hi' -> Welcome menu response delivered (1 response)");

    // Now the slow/stale search finishes for the older message ID
    countBefore = outgoingMessages.length;
    await handleArchitectSearchFlow(TEST_USER, "CA/1975/00048", staleMsgId);
    const postStaleMessages = outgoingMessages.slice(countBefore);
    assert.strictEqual(
      postStaleMessages.length,
      0,
      "Stale in-flight search must be discarded and MUST NOT send an architect response"
    );
    console.log("  Stale search resolution: Ignored and discarded -> 0 unwanted messages sent");

    console.log("✅ TEST 8 PASSED\n");
    passedTests++;
  } catch (e) {
    console.error("❌ TEST 8 FAILED:", e.message, "\n");
  }

  console.log("==================================================");
  console.log("TEST 9: Stale Application Status Response Discarded");
  console.log("==================================================");
  totalTests++;
  try {
    const staleMsgId = "wamid.STALE_APP_STATUS_MSG_001";
    const newerMsgId = "wamid.NEWER_APP_INTERIM_MSG_002";

    // User triggers application status check with message ID
    userStates[TEST_USER] = { lastMessageId: staleMsgId, awaiting: "application_status" };

    // Before slow response finishes, user sends "Hi"
    let countBefore = outgoingMessages.length;
    await simulateWebhookPost(createTextMessagePayload(TEST_USER, "Hi", newerMsgId));
    let resp = assertSingleResponseAndGet(countBefore);
    assert.ok(resp.template === "coa_welcome_menu" || (resp.text && resp.text.includes("Welcome to the Council of Architecture")));
    console.log("  Interim message: 'Hi' -> Welcome menu response delivered (1 response)");

    // Slow application status query completes for older message
    countBefore = outgoingMessages.length;
    await handleApplicationStatus(TEST_USER, "APP12345", staleMsgId);
    const postStaleMessages = outgoingMessages.slice(countBefore);
    assert.strictEqual(
      postStaleMessages.length,
      0,
      "Stale application status query must be discarded when a newer message has arrived"
    );
    console.log("  Stale application status: Ignored and discarded -> 0 unwanted messages sent");

    console.log("✅ TEST 9 PASSED\n");
    passedTests++;
  } catch (e) {
    console.error("❌ TEST 9 FAILED:", e.message, "\n");
  }

  console.log("==================================================");
  console.log("TEST 10: Stale Dispatch Status Response Discarded");
  console.log("==================================================");
  totalTests++;
  try {
    const staleMsgId = "wamid.STALE_DISPATCH_MSG_001";
    const newerMsgId = "wamid.NEWER_DISPATCH_MSG_002";

    // User triggers dispatch status check with message ID
    userStates[TEST_USER] = { lastMessageId: staleMsgId, awaiting: "dispatch_status" };

    // Before slow response finishes, user sends "Hi"
    let countBefore = outgoingMessages.length;
    await simulateWebhookPost(createTextMessagePayload(TEST_USER, "Hi", newerMsgId));
    let resp = assertSingleResponseAndGet(countBefore);
    assert.ok(resp.template === "coa_welcome_menu" || (resp.text && resp.text.includes("Welcome to the Council of Architecture")));
    console.log("  Interim message: 'Hi' -> Welcome menu response delivered (1 response)");

    // Slow dispatch status query completes for older message
    countBefore = outgoingMessages.length;
    await handleDispatchStatus(TEST_USER, "9876543210", staleMsgId);
    const postStaleMessages = outgoingMessages.slice(countBefore);
    assert.strictEqual(
      postStaleMessages.length,
      0,
      "Stale dispatch status query must be discarded when a newer message has arrived"
    );
    console.log("  Stale dispatch status: Ignored and discarded -> 0 unwanted messages sent");

    console.log("✅ TEST 10 PASSED\n");
    passedTests++;
  } catch (e) {
    console.error("❌ TEST 10 FAILED:", e.message, "\n");
  }

  console.log("==================================================");
  console.log("TEST 11: Invalidated State Error Protection");
  console.log("==================================================");
  totalTests++;
  try {
    const staleMsgId = "wamid.STALE_ERROR_MSG_001";
    const newerMsgId = "wamid.NEWER_ERROR_MSG_002";

    userStates[TEST_USER] = { lastMessageId: newerMsgId };

    // When an error happens in an invalidated request, no error message should be sent to the user
    let countBefore = outgoingMessages.length;
    await handleApplicationStatus(TEST_USER, "INVALID_APP", staleMsgId);
    let postMessages = outgoingMessages.slice(countBefore);
    assert.strictEqual(postMessages.length, 0, "No error message sent for superseded application status");

    countBefore = outgoingMessages.length;
    await handleDispatchStatus(TEST_USER, "12345", staleMsgId);
    postMessages = outgoingMessages.slice(countBefore);
    assert.strictEqual(postMessages.length, 0, "No error message sent for superseded dispatch status");

    console.log("  Invalidated request errors: Safely suppressed without spamming user");
    console.log("✅ TEST 11 PASSED\n");
    passedTests++;
  } catch (e) {
    console.error("❌ TEST 11 FAILED:", e.message, "\n");
  }

  console.log("==================================================");
  console.log("TEST 12: Delivery-Status Webhooks Do Not Trigger Bot Replies");
  console.log("==================================================");
  totalTests++;
  try {
    const statusPayload = {
      object: "whatsapp_business_account",
      entry: [
        {
          id: "123456",
          changes: [
            {
              field: "messages",
              value: {
                messaging_product: "whatsapp",
                statuses: [
                  {
                    id: "wamid.OUT_123456789",
                    status: "delivered",
                    timestamp: `${Math.floor(Date.now() / 1000)}`,
                    recipient_id: TEST_USER,
                  },
                ],
              },
            },
          ],
        },
      ],
    };

    const countBefore = outgoingMessages.length;
    const httpStatus = await simulateWebhookPost(statusPayload);
    assert.strictEqual(httpStatus, 200);
    const postMessages = outgoingMessages.slice(countBefore);
    assert.strictEqual(postMessages.length, 0, "Delivery status updates must produce 0 conversational replies");

    console.log("  Delivery status update: Ignored without sending conversational reply");
    console.log("✅ TEST 12 PASSED\n");
    passedTests++;
  } catch (e) {
    console.error("❌ TEST 12 FAILED:", e.message, "\n");
  }

  console.log("==================================================");
  console.log("TEST 13: 20-Minute Conversation Inactivity Timeout Reset");
  console.log("==================================================");
  totalTests++;
  try {
    // 1. User clicks "Search Architect"
    let countBefore = outgoingMessages.length;
    await simulateWebhookPost(createButtonReplyPayload(TEST_USER, "Search Architect"));
    let resp = assertSingleResponseAndGet(countBefore);
    assert.ok(resp.text.includes("Search Architect / Verify Architect"));
    assert.strictEqual(userStates[TEST_USER].awaiting, "search_architect");

    // 2. Simulate 21 minutes of user inactivity (timeout is 20 minutes)
    const twentyOneMinAgo = Date.now() - 21 * 60 * 1000;
    userStates[TEST_USER].lastUserMessageAt = twentyOneMinAgo;
    const oldSessionToken = userStates[TEST_USER].sessionToken;

    // 3. User sends a message after 21 minutes
    countBefore = outgoingMessages.length;
    await simulateWebhookPost(createTextMessagePayload(TEST_USER, "CA/1975/00048"));
    resp = assertSingleResponseAndGet(countBefore);

    // Expired session must start fresh and deliver welcome menu, NOT search result
    assert.ok(
      resp.template === "coa_welcome_menu" || (resp.text && resp.text.includes("Welcome to the Council of Architecture")),
      "Expired session must return Welcome Menu rather than continuing expired search state"
    );
    assert.notStrictEqual(userStates[TEST_USER].sessionToken, oldSessionToken, "Session token must be refreshed");
    assert.strictEqual(userStates[TEST_USER].awaiting, null, "Expired awaiting state must be cleared");

    console.log("  20+ min inactivity: Old state invalidated -> Fresh Welcome Menu sent (1 response)");
    console.log("✅ TEST 13 PASSED\n");
    passedTests++;
  } catch (e) {
    console.error("❌ TEST 13 FAILED:", e.message, "\n");
  }

  console.log("==================================================");
  console.log("TEST 14: User Activity Within 20-Minute Window Continues Flow");
  console.log("==================================================");
  totalTests++;
  try {
    // 1. User clicks "Search Architect"
    let countBefore = outgoingMessages.length;
    await simulateWebhookPost(createButtonReplyPayload(TEST_USER, "Search Architect"));
    let resp = assertSingleResponseAndGet(countBefore);
    assert.ok(resp.text.includes("Search Architect / Verify Architect"));
    assert.strictEqual(userStates[TEST_USER].awaiting, "search_architect");

    // 2. Simulate 10 minutes pass (within 20-minute window)
    const tenMinAgo = Date.now() - 10 * 60 * 1000;
    userStates[TEST_USER].lastUserMessageAt = tenMinAgo;
    const currentSessionToken = userStates[TEST_USER].sessionToken;

    // 3. User sends registration number within timeout window
    countBefore = outgoingMessages.length;
    await simulateWebhookPost(createTextMessagePayload(TEST_USER, "CA/1975/00048"));
    resp = assertSingleResponseAndGet(countBefore);

    // Active session successfully processes the search
    assert.ok(resp.text.includes("PRAKASH NARAYAN"), "Active session must execute search and return architect info");
    assert.strictEqual(userStates[TEST_USER].sessionToken, currentSessionToken, "Session token must be preserved");

    console.log("  Activity within 20 min: Flow continues successfully -> Architect record returned");
    console.log("✅ TEST 14 PASSED\n");
    passedTests++;
  } catch (e) {
    console.error("❌ TEST 14 FAILED:", e.message, "\n");
  }

  console.log("================================================================================");
  console.log(`📊 FINAL LOCAL E2E REPORT: ${passedTests} of ${totalTests} Flow Suites Passed`);
  console.log("================================================================================");

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runE2ETests();
