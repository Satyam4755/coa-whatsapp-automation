import axios from "axios";
import cloudinary from "cloudinary";
import cookieParser from "cookie-parser";
import cors from "cors";
import "dotenv/config";
console.log("WA_WEBHOOK_VERIFY_TOKEN:", process.env.WA_WEBHOOK_VERIFY_TOKEN);
import express from "express";
import http from "http";
import https from "https";
import mongoose from "mongoose";
import morgan from "morgan";
import cron from "node-cron";
import { Server } from "socket.io";
import coaApiService from "./services/coaApiService.js";
import queryRouterService from "./services/queryRouterService.js";
import architectRouter from "./routes/architect.routes.js";
import { redisConnection } from "./services/bulkJobQueue.js";
import conversationService from "./services/conversationService.js";
import rateLimiterService from "./services/rateLimiterService.js";

const app = express();

app.use(express.json());
app.use(cookieParser());
app.use(cors({
  origin: [
    process.env.CLIENT_URL,
    "http://localhost:5173",
    "https://coa-whatsapp-automation.onrender.com",
    "http://localhost:3000",
    "http://localhost:5174"
  ].filter(Boolean),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-auth-token', 'Cookie'],
  exposedHeaders: ['Set-Cookie']
}));
app.use(morgan("dev"));

const PORT = process.env.PORT || 8080;

cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("Connected to MongoDB");
    if (!jobProcessor) {
      jobProcessor = new BulkJobProcessor(io);
      console.log("Background job processor initialized successfully");
    }
  })
  .catch((error) => {
    console.error("MongoDB connection error:", error);
  });

app.get("/", (req, res) => {
  res.send("Hello Diamond-ore");
});

const WA_ACCESS_TOKEN = process.env.WA_ACCESS_TOKEN;
const PHONE_NUMBER_ID = process.env.WA_PHONE_NUMBER_ID;
const COA_WELCOME_IMAGE = process.env.COA_WELCOME_IMAGE;

// Debug: Check if WhatsApp credentials are set
console.log('🔍 Environment Variables Check:');
console.log(`WA_ACCESS_TOKEN: ${WA_ACCESS_TOKEN ? '✅ Set' : '❌ Missing'}`);
console.log(`WA_PHONE_NUMBER_ID: ${PHONE_NUMBER_ID ? '✅ Set' : '❌ Missing'}`);
if (!WA_ACCESS_TOKEN || !PHONE_NUMBER_ID) {
  console.error('🚨 Critical: WhatsApp credentials not set in environment variables!');
}

const sendMessage = async (recipient, message, buttons = []) => {
  const url = `https://graph.facebook.com/v23.0/${PHONE_NUMBER_ID}/messages`;

  const payload = {
    messaging_product: "whatsapp",
    to: recipient,
    type: "template",
    template: {
      name: "coa_welcome_menu",
      language: {
        code: "en",
      },
      components: [
        {
          type: "header",
          parameters: [
            {
              type: "image",
              image: {
                link: COA_WELCOME_IMAGE,
              },
            },
          ],
        },
        {
          type: "body",
          parameters: [],
        },
        {
          type: "button",
          sub_type: "quick_reply",
          index: 0,
          parameters: [],
        },
        {
          type: "button",
          sub_type: "quick_reply",
          index: 1,
          parameters: [],
        },
        {
          type: "button",
          sub_type: "quick_reply",
          index: 2,
          parameters: [],
        },
      ],
    },
  };

  const headers = {
    Authorization: `Bearer ${WA_ACCESS_TOKEN}`,
  };

  try {
    const res = await axios.post(url, payload, { headers });
    const outMsgId = res?.data?.messages?.[0]?.id || null;
    conversationService
      .logCoaMessage({
        userNumber: recipient,
        message: message || "Welcome to the Council of Architecture. Please select an option to continue.",
        messageId: outMsgId,
      })
      .catch((err) => console.error("Error logging COA welcome message:", err.message));
  } catch (error) {
    console.error(
      "Error sending message:",
      error.response ? error.response.data : error.message
    );
    conversationService
      .logCoaMessage({
        userNumber: recipient,
        message: message || "Welcome to the Council of Architecture. Please select an option to continue.",
      })
      .catch(() => {});
  }
};

const sendTextMessage = async (recipient, message) => {
  const url = `https://graph.facebook.com/v23.0/${PHONE_NUMBER_ID}/messages`;

  const payload = {
    messaging_product: "whatsapp",
    to: recipient,
    type: "text",
    text: { body: message },
  };

  const headers = {
    Authorization: `Bearer ${WA_ACCESS_TOKEN}`,
  };

  try {
    const res = await axios.post(url, payload, { headers });
    console.log(`Message sent to ${recipient}: ${message}`);
    const outMsgId = res?.data?.messages?.[0]?.id || null;
    conversationService
      .logCoaMessage({
        userNumber: recipient,
        message: message,
        messageId: outMsgId,
      })
      .catch((err) => console.error("Error logging COA text message:", err.message));
  } catch (error) {
    console.error(
      "Error sending text message:",
      error.response ? error.response.data : error.message
    );
    conversationService
      .logCoaMessage({
        userNumber: recipient,
        message: message,
      })
      .catch(() => {});
  }
};

const sendCronTextMessage = async (recipient, message, validityDate, calendarYear, wef) => {
  const url = `https://graph.facebook.com/v23.0/${PHONE_NUMBER_ID}/messages`;

  const payload = {
    messaging_product: "whatsapp",
    to: recipient,
    type: "template",
    template: {
      name: "cron_payment_template",
      language: {
        code: "en",
      },
      components: [
        {
          type: "body",
          parameters: [
            {
              type: "text",
              text: validityDate,
            },
            {
              type: "text",
              text: calendarYear,
            },
            {
              type: "text",
              text: wef,
            },
          ],
        },
      ],
    },
  };

  const headers = {
    Authorization: `Bearer ${WA_ACCESS_TOKEN}`,
  };

  try {
    const res = await axios.post(url, payload, { headers });
    console.log(`Message sent to ${recipient}: ${message}`);
    const outMsgId = res?.data?.messages?.[0]?.id || null;
    conversationService
      .logCoaMessage({
        userNumber: recipient,
        message: message,
        messageId: outMsgId,
      })
      .catch((err) => console.error("Error logging COA cron message:", err.message));
  } catch (error) {
    console.error(
      "Error sending text message:",
      error.response ? error.response.data : error.message
    );
    conversationService
      .logCoaMessage({
        userNumber: recipient,
        message: message,
      })
      .catch(() => {});
  }
};

export const userStates = {};

export function getSessionTimeoutMs() {
  const envVal = process.env.CHAT_SESSION_TIMEOUT_MINUTES;
  const minutes = Number(envVal);
  if (Number.isFinite(minutes) && minutes > 0) {
    return minutes * 60 * 1000;
  }
  return 20 * 60 * 1000; // Default: 20 minutes
}

export function isRequestSuperseded(userNumber, messageId, sessionToken) {
  const state = userStates[userNumber];
  if (!state) return true;
  if (sessionToken && state.sessionToken && state.sessionToken !== sessionToken) return true;
  if (messageId && state.lastMessageId && state.lastMessageId !== messageId) return true;
  return false;
}

export function updateUserState(userNumber, updates = {}) {
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

export function resetUserState(userNumber, updates = {}) {
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

export function cleanupExpiredUserStates() {
  const now = Date.now();
  const timeoutMs = getSessionTimeoutMs();
  for (const [userNumber, state] of Object.entries(userStates)) {
    if (state?.lastUserMessageAt && now - state.lastUserMessageAt >= timeoutMs) {
      delete userStates[userNumber];
    }
  }
}

const sessionCleanupInterval = setInterval(cleanupExpiredUserStates, 5 * 60 * 1000);
if (sessionCleanupInterval && typeof sessionCleanupInterval.unref === "function") {
  sessionCleanupInterval.unref();
}

const httpsAgent = new https.Agent({
  rejectUnauthorized: false,
});

function formatDate(dateStr) {
  const months = {
    January: "01",
    February: "02",
    March: "03",
    April: "04",
    May: "05",
    June: "06",
    July: "07",
    August: "08",
    September: "09",
    October: "10",
    November: "11",
    December: "12",
  };


  const [day, month, year] = dateStr.split("/");
  const formattedMonth = months[month] || month;
  return `${day.padStart(2, "0")}/${formattedMonth}/${year}`;
}

function scheduledTask(filteredData) {
  filteredData.forEach((item) => {
    const {
      archRegNum,
      archName,
      archdob,
      archValidityUpTo,
      Mobile,
      Email,
      archStatus,
    } = item;

    const calendarYear = item.calendarYear || 2026;
    const wef = item.wef || "01/01/2026";

    const formattedValidity = formatDate(archValidityUpTo);

    const message = `Sir/ Madam,
You were registered as an Architect vide Registration No. ${archRegNum}. The validity of your Registration was upto ${formattedValidity} and the renewal fee for the calendar year 2024 became due w.e.f. ${wef}.
You can renew your Registration by paying requisite fees through online/offline modes in order to continue to carry on profession of an Architect in India.
Payment of Renewal Fee can be made either through online mode, at COA website (www.coa.gov.in), by logging into your account, or offline mode through Demand Draft in favour of COUNCIL OF ARCHITECTURE payable at New Delhi and/or Cash at the office of the Council. One Time Payment of Renewal Fee is subject to submission of copy of Final Degree Certificate, issued by the concerned University if already not submitted. In case you possess Certificate of Registration in old format please surrender the same to COA and get new Certificate of Registration. It may be noted that in case of failure to renew Registration by the concerned Architect, the Certificate of Registration is to be surrendered to Council immediately. Non-surrender of Certificate shall attract fine as provided under section 38 of the Act.
Kindly ignore the above information in case you have already made the payment.`;

    sendCronTextMessage(`91${Mobile}`, message, formattedValidity, calendarYear, wef);
  });
}


let isRenewalCronRunning = false;

export async function executeDailyRenewalReminders() {
  const isEnabled = process.env.ENABLE_DAILY_RENEWAL_CRON === "true";
  if (!isEnabled) {
    console.log("[Renewal Cron] Daily renewal reminder cron is DISABLED (ENABLE_DAILY_RENEWAL_CRON !== 'true'). Skipping execution.");
    return { status: "skipped", reason: "disabled" };
  }

  if (isRenewalCronRunning) {
    console.warn("[Renewal Cron] Overlap detected: Job is already running in this process. Skipping.");
    return { status: "skipped", reason: "already_running" };
  }

  const todayStr = new Date().toISOString().slice(0, 10);
  const lockKey = `wa:lock:daily_renewal_cron:${todayStr}`;

  try {
    if (redisConnection && redisConnection.status === "ready") {
      const lockResult = await redisConnection.set(lockKey, Date.now().toString(), "EX", 82800, "NX");
      if (lockResult === null) {
        console.log(`[Renewal Cron] Skipped: another instance already acquired the lock for ${todayStr}.`);
        return { status: "skipped", reason: "lock_held" };
      }
    }

    isRenewalCronRunning = true;
    console.log(`[Renewal Cron] Starting daily renewal reminder execution for ${todayStr}...`);

    const cronAPIURL = process.env.NODE_ENV === "production" ? `https://coa.gov.in/AllArchitectDataAPI.php` : `https://coa.gov.in/staging/AllArchitectDataAPI.php`;

    const response = await axios.get(
      cronAPIURL,
      { httpsAgent }
    );
    const rawData = response.data;

    if (!rawData || typeof rawData !== "string") {
      console.log("[Renewal Cron] No valid architect data received from API.");
      return { status: "success", count: 0 };
    }

    const architects = rawData.split("}{").map((item, index, arr) => {
      if (index === 0) return JSON.parse(item + "}");
      if (index === arr.length - 1) return JSON.parse("{" + item);
      return JSON.parse("{" + item + "}");
    });

    function parseDate(dateStr) {
      if (!dateStr) return null;

      try {
        const [day, monthName, year] = dateStr.split("/");
        const dayNumber = parseInt(day, 10);
        const yearNumber = parseInt(year, 10);
        const monthNumber = new Date(
          Date.parse(monthName + " 1, 1970")
        ).getMonth();
        return new Date(yearNumber, monthNumber, dayNumber);
      } catch (error) {
        console.error("[Renewal Cron] Error parsing date:", dateStr, error.message);
        return null;
      }
    }

    function getRenewalInfo(validityDate) {
      if (!validityDate) return { calendarYear: null, wef: null };

      const wefDate = new Date(validityDate);
      wefDate.setDate(wefDate.getDate() + 1);
      const calendarYear = wefDate.getFullYear();

      return {
        calendarYear,
        wef: wefDate.toLocaleDateString("en-GB"),
      };
    }

    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + 15);
    targetDate.setHours(0, 0, 0, 0);

    const filteredData = architects
      .map((item) => {
        const validityDate = parseDate(item.archValidityUpTo);

        if (!validityDate) return null;

        if (
          validityDate.getFullYear() === targetDate.getFullYear() &&
          validityDate.getMonth() === targetDate.getMonth() &&
          validityDate.getDate() === targetDate.getDate()
        ) {
          const { calendarYear, wef } = getRenewalInfo(validityDate);

          return {
            ...item,
            validityDate: validityDate.toLocaleDateString("en-GB"),
            calendarYear,
            wef,
          };
        }
        return null;
      })
      .filter(Boolean);

    if (filteredData.length > 0) {
      console.log(`[Renewal Cron] Found ${filteredData.length} architects with renewal due in 15 days.`);
      scheduledTask(filteredData);
    } else {
      console.log("[Renewal Cron] No architects match the 15-day renewal reminder criteria.");
    }

    console.log(`[Renewal Cron] Successfully completed daily renewal check for ${todayStr}.`);
    return { status: "success", count: filteredData.length };
  } catch (err) {
    console.error("[Renewal Cron] Error during daily renewal execution:", err.message);
    return { status: "error", error: err.message };
  } finally {
    isRenewalCronRunning = false;
  }
}

cron.schedule("0 10 * * *", async () => {
  await executeDailyRenewalReminders();
});

const processedMessageIds = new Map();

async function isMessageDuplicate(messageId) {
  if (!messageId) return false;

  // 1. In-memory check (microsecond fast local check)
  if (processedMessageIds.has(messageId)) {
    return true;
  }
  processedMessageIds.set(messageId, Date.now());

  // Prune local in-memory map
  if (processedMessageIds.size > 5000) {
    const cutoff = Date.now() - 60 * 60 * 1000;
    for (const [id, time] of processedMessageIds.entries()) {
      if (time < cutoff) processedMessageIds.delete(id);
    }
  }

  // 2. Persistent Redis atomic check (distributed across workers / survives restarts)
  try {
    if (redisConnection && redisConnection.status === "ready") {
      const key = `wa:msg:idempotency:${messageId}`;
      const result = await redisConnection.set(key, Date.now().toString(), "EX", 86400, "NX");
      if (result === null) {
        return true;
      }
    }
  } catch (err) {
    console.warn("Redis idempotency check warning:", err.message);
  }

  return false;
}

app.post("/webhook", async (req, res) => {
  try {
    if (req.body?.object !== "whatsapp_business_account") {
      return res.status(400).send("Invalid request");
    }

    const change = req?.body?.entry?.[0]?.changes?.[0];
    if (!change) {
      return res.sendStatus(200);
    }

    if (change?.value?.messages) {
      const message = change.value.messages[0];
      const messageId = message?.id;

      // Webhook message deduplication to ensure strict idempotency
      if (messageId) {
        const isDuplicate = await isMessageDuplicate(messageId);
        if (isDuplicate) {
          console.log(`Duplicate webhook message ${messageId} ignored.`);
          return res.sendStatus(200);
        }
      }

      const userNumber = message.from;
      if (!userNumber) {
        return res.sendStatus(200);
      }

      // Rate limit check using atomic Redis sliding window
      const rateLimit = await rateLimiterService.checkRateLimit(userNumber);
      if (!rateLimit.allowed) {
        const maskedNum = userNumber.length > 4 ? `...${userNumber.slice(-4)}` : userNumber;
        console.warn(`[RateLimit] User ${maskedNum} exceeded rate limit. Request blocked.`);
        if (rateLimiterService.shouldSendWarning(userNumber)) {
          await sendTextMessage(
            userNumber,
            "⚠️ You are sending messages too quickly. Please wait a moment before trying again."
          );
        }
        return res.sendStatus(200);
      }

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

      // Extract incoming message text for persistence
      let incomingText = "";
      if (message?.button) {
        incomingText = message.button.text;
      } else if (message?.interactive?.button_reply) {
        incomingText = message.interactive.button_reply.title || message.interactive.button_reply.id || "";
      } else if (message?.interactive?.list_reply) {
        incomingText = message.interactive.list_reply.title || message.interactive.list_reply.id || "";
      } else if (message?.text?.body) {
        incomingText = message.text.body;
      } else if (message?.type) {
        incomingText = `[${message.type}]`;
      }

      // Persist USER message to MongoDB real-time in leads collection
      if (incomingText) {
        try {
          await conversationService.logUserMessage({
            userNumber,
            message: incomingText,
            messageId,
          });
        } catch (err) {
          console.error("Error logging user message:", err.message);
        }
      }

      // If previous session expired, discard old state and send welcome menu for this fresh interaction
      if (isExpired) {
        sendWelcomeMessage(userNumber);
        return res.sendStatus(200);
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
      console.log("Status Update:", change.value.statuses[0]);
    }

    res.sendStatus(200);
  } catch (e) {
    console.error("Webhook Error:", e);
    res.sendStatus(500);
  }
});

async function handleButtonClick(userNumber, buttonTitle, messageId = null, sessionToken = null) {
  console.log(`Button clicked by ${userNumber}: ${buttonTitle}`);
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

  // Check department classification for custom buttons
  const classification = queryRouterService.classifyQuery(title);
  if (classification.type === "DEPARTMENT_QUERY" || classification.type === "FAQ") {
    sendTextMessage(userNumber, classification.response);
    resetUserState(userNumber, { lastMessageId: messageId });
  } else {
    resetUserState(userNumber, { attempts: 0, lastMessageId: messageId });
    sendWelcomeMessage(userNumber);
  }
}

function sendWelcomeMessage(userNumber) {
  const welcomeMessage = `Welcome to the Council of Architecture. We are available 24/7 to answer your queries. You can enquire, provide feedback, and ask for support. Please select an option to continue.`;
  const buttons = [
    { type: "text", text: "Search Architect" },
    { type: "text", text: "Application Status" },
    { type: "text", text: "Dispatch Status" },
  ];
  sendMessage(userNumber, welcomeMessage, buttons);
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

    // Validate that the conversation has not moved on while this search was executing
    if (isRequestSuperseded(userNumber, messageId, currentSessionToken)) {
      console.log(
        `Discarding stale architect search response for ${userNumber} (msgId ${messageId} superseded)`
      );
      return;
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

    // Multiple matches
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
    if (isRequestSuperseded(userNumber, messageId, currentSessionToken)) {
      console.log(
        `Discarding error message for superseded architect search request ${userNumber}`
      );
      return;
    }
    sendTextMessage(
      userNumber,
      "An unexpected error occurred while searching for architect records. Please try again later.\n\n_Type \"menu\" to return to the main menu._"
    );
    resetUserState(userNumber, { lastMessageId: messageId });
  }
}

async function handleArchitectStatus(userNumber, registrationNumber, messageId = null, sessionToken = null) {
  return handleArchitectSearchFlow(userNumber, registrationNumber, messageId, sessionToken);
}

async function handleTextMessage(userNumber, rawUserMessage, messageId = null, sessionToken = null) {
  const currentSessionToken = sessionToken || userStates[userNumber]?.sessionToken;
  const userMessage = (rawUserMessage || "").trim();
  const lower = userMessage.toLowerCase();
  const userState = userStates[userNumber] || {};
  const awaiting = userState?.awaiting;

  // 1. Menu and Greeting triggers (e.g., hi, hii, hello, hey, start, menu, etc.)
  const isGreetingOrMenu =
    /^(?:hi+|hello+|hey+|namaste|good\s*(?:morning|afternoon|evening)|start|menu|main\s*menu|options|help|home)$/i.test(
      lower
    ) ||
    (/^(?:hi+|hello+|hey+|namaste)\b/i.test(lower) && lower.length <= 15);

  if (isGreetingOrMenu) {
    resetUserState(userNumber, { attempts: 0, lastMessageId: messageId });
    return sendWelcomeMessage(userNumber);
  }

  // 2. Direct Registration Number Recognition (always prioritized)
  const regNoMatch = userMessage.match(/\b(CA\/\d{2,4}\/\d{3,7})\b/i);
  if (regNoMatch) {
    resetUserState(userNumber, { lastMessageId: messageId });
    return handleArchitectSearchFlow(userNumber, regNoMatch[1].toUpperCase(), messageId, currentSessionToken);
  }

  // 3. Active Awaiting States
  if (awaiting) {
    // Check if the user is typing an explicit FAQ or Department query that should override the awaiting state
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
        sendTextMessage(
          userNumber,
          "Maximum attempts reached. Please try again later."
        );
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

    const applicationAPIURL = process.env.NODE_ENV === "production" ? `https://coa.gov.in/AllApplicantDataAPI.php?application_no=${applicationNumber}`:`https://coa.gov.in/staging/AllApplicantDataAPI.php?application_no=${applicationNumber}`;

    const response = await axios.get(
      applicationAPIURL,
      { httpsAgent }
    );

    // Validate that the conversation has not moved on while request was in flight
    if (isRequestSuperseded(userNumber, messageId, currentSessionToken)) {
      console.log(
        `Discarding stale application status response for ${userNumber} (msgId ${messageId} superseded)`
      );
      return;
    }

    const applicantData = response.data;

    if (!response.data || response.data.length === 0) {
      const attempts = (userStates[userNumber]?.attempts || 0) + 1;
      updateUserState(userNumber, { attempts });

      if (attempts >= 3) {
        sendTextMessage(
          userNumber,
          "Maximum attempts reached. Please try again later."
        );
        resetUserState(userNumber, { lastMessageId: messageId });
        return sendWelcomeMessage(userNumber);
      }

      sendTextMessage(
        userNumber,
        `No application found with Application No. ${applicationNumber}. Please try again.`
      );
      updateUserState(userNumber, { awaiting: "application_status", lastMessageId: messageId });
      return;
    }

    const status = applicantData?.appStatus || "Not Available";
    const responseMessage = `The status for Application No. ${applicationNumber} is ${status}.`;
    sendTextMessage(userNumber, responseMessage);
    resetUserState(userNumber, { lastMessageId: messageId });
  } catch (error) {
    console.error("Error checking application status:", error);
    if (isRequestSuperseded(userNumber, messageId, currentSessionToken)) {
      console.log(
        `Discarding error message for superseded application status request ${userNumber}`
      );
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
        sendTextMessage(
          userNumber,
          "Maximum attempts reached. Please try again later."
        );
        resetUserState(userNumber, { lastMessageId: messageId });
        return sendWelcomeMessage(userNumber);
      }

      sendTextMessage(
        userNumber,
        `Please enter a valid 10-digit mobile number (e.g., 9876543210).`
      );
      updateUserState(userNumber, { awaiting: "dispatch_status", lastMessageId: messageId });
      return;
    }

    updateUserState(userNumber, { attempts: 0 });

    const dispatchAPIURL = process.env.NODE_ENV === "production" ? `https://ecoa.in/api/letter-documents/${mobileNumber}`:`https://ecoa.in/ecoa_staging/public/api/letter-documents/${mobileNumber}`;

    const dispatchData = await axios.get(
      dispatchAPIURL,
      { httpsAgent }
    );

    // Validate that the conversation has not moved on while request was in flight
    if (isRequestSuperseded(userNumber, messageId, currentSessionToken)) {
      console.log(
        `Discarding stale dispatch status response for ${userNumber} (msgId ${messageId} superseded)`
      );
      return;
    }

    if (
      !dispatchData.data?.data?.length ||
      mobileNumber != dispatchData?.data?.data[0]?.contact
    ) {
      sendTextMessage(
        userNumber,
        `No dispatch found for the given mobile number ${mobileNumber}. Please try again.`
      );
      resetUserState(userNumber, { lastMessageId: messageId });
      return;
    }

    const isDispatched = dispatchData.data.data.filter((item) => item?.barcode);
    handleDispatchResponse(userNumber, isDispatched, messageId, currentSessionToken);
  } catch (error) {
    console.error("Error checking dispatch status:", error);
    if (isRequestSuperseded(userNumber, messageId, currentSessionToken)) {
      console.log(
        `Discarding error message for superseded dispatch status request ${userNumber}`
      );
      return;
    }
    sendTextMessage(
      userNumber,
      "Error checking dispatch status. Please try again."
    );
    resetUserState(userNumber, { lastMessageId: messageId });
  }
}

function handleDispatchResponse(userNumber, dispatchedItems, messageId = null, sessionToken = null) {
  const currentSessionToken = sessionToken || userStates[userNumber]?.sessionToken;
  if (isRequestSuperseded(userNumber, messageId, currentSessionToken)) {
    console.log(
      `Discarding stale dispatch response for ${userNumber} (msgId ${messageId} superseded)`
    );
    return;
  }

  if (!dispatchedItems || dispatchedItems.length === 0) {
    sendTextMessage(
      userNumber,
      `Dear Architect,\n\nThe following documents have not been dispatched yet. Kindly wait for a few days.`
    );
  } else {
    const lastItem = dispatchedItems[dispatchedItems.length - 1];
    const dispatchStatus = `The documents have been dispatched to your communication address on ${lastItem?.dispatched_date}. Consignment No. ${
      lastItem?.barcode
    } . The same may be tracked on the ${process.env.COURIER_COMPANY_NAME} Courier website.\n`;
    sendTextMessage(userNumber, dispatchStatus);
  }
  resetUserState(userNumber, { lastMessageId: messageId });
}

app.get("/webhook", (req, res) => {
  console.log("========== META WEBHOOK ==========");
  console.log("Headers:", req.headers);
  console.log("Query:", req.query);

  const verifyToken = process.env.WA_WEBHOOK_VERIFY_TOKEN;

  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  console.log({
    mode,
    token,
    challenge,
    verifyToken,
    tokenMatch: token === verifyToken,
  });

  if (mode === "subscribe" && token === verifyToken) {
    console.log("✅ VERIFIED");
    return res.status(200).send(challenge);
  }

  console.log("❌ FAILED");
  return res.sendStatus(403);
});

import adminBackgroundJobsRouter from "./controllers/admin-background-jobs.js";
import adminController from "./controllers/admin.js";
import errorMiddleware from "./middlewares/error.middleware.js";
import messageTemplateRouter from "./routes/messageTemplate.routes.js";
import BulkJobProcessor from "./services/BulkJobProcessor.js";

// Create HTTP server for Socket.IO
const server = http.createServer(app);

// Setup Socket.IO
const io = new Server(server, {
  transports: ['websocket', 'polling']
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('📡 Client connected to job monitoring:', socket.id);

  // Join job-specific room for updates
  socket.on('subscribe-to-job', (jobId) => {
    socket.join(`job-${jobId}`);
    console.log(`📊 Client ${socket.id} subscribed to job ${jobId}`);
  });

  socket.on('disconnect', () => {
    console.log('📡 Client disconnected:', socket.id);
  });
});

// Make io available globally for background job updates
global.io = io;

// Initialize proper background job processor
let jobProcessor;

// Initialize the job processor after server setup
setTimeout(() => {
  try {
    if (jobProcessor) {
      return;
    }
    jobProcessor = new BulkJobProcessor(io);
    console.log('🔄 Background job processor initialized successfully');
  } catch (error) {
    console.error('Error initializing background job processor:', error);
  }
}, 1000); // Small delay to ensure server is ready

app.use("/api/admin", adminController);
app.use("/api/admin", adminBackgroundJobsRouter);
app.use("/api/template", messageTemplateRouter);
app.use("/api/architect", architectRouter);
app.use("/api/coa", architectRouter);

app.use(errorMiddleware);

server.listen(PORT, () => {
  console.log(`🚀 Server is running on port: ${PORT}`);
  console.log(`📡 Socket.IO is ready for real-time updates`);
});
