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
    await axios.post(url, payload, { headers });
  } catch (error) {
    console.error(
      "Error sending message:",
      error.response ? error.response.data : error.message
    );
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
    await axios.post(url, payload, { headers });
    console.log(`Message sent to ${recipient}: ${message}`);
  } catch (error) {
    console.error(
      "Error sending text message:",
      error.response ? error.response.data : error.message
    );
  }
};

const sendCronTextMessage = async (recipient, message,validityDate,calendarYear,wef) => {
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
    await axios.post(url, payload, { headers });
    console.log(`Message sent to ${recipient}: ${message}`);
  } catch (error) {
    console.error(
      "Error sending text message:",
      error.response ? error.response.data : error.message
    );
  }
};

const userStates = {};

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


cron.schedule("0 10 * * *", async () => {

const cronAPIURL = process.env.NODE_ENV === "production" ? `https://coa.gov.in/AllArchitectDataAPI.php`:`https://coa.gov.in/staging/AllArchitectDataAPI.php`;


  const response = await axios.get(
    cronAPIURL,
    { httpsAgent }
  );
  const rawData = response.data;

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
      ).getMonth(); // get month index
      return new Date(yearNumber, monthNumber, dayNumber);
    } catch (error) {
      console.error("Error parsing date:", dateStr, error);
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
    scheduledTask(filteredData);
  } else {
    console.log("No data matches the criteria.");
  }
});

app.post("/webhook", async (req, res) => {
  try {
    const change = req?.body?.entry?.[0]?.changes?.[0];

    if (!req.body?.object === "whatsapp_business_account") {
      return res.status(400).send("Invalid request");
    }

    if (!change) {
      return res.sendStatus(200);
    }

    if (change?.value?.messages) {
      const message = change.value.messages[0];

      const userNumber = message.from;
      if (!userNumber) {
        return res.sendStatus(200);
      }

      if (!userStates[userNumber]) {
        userStates[userNumber] = {};
      }

      if (message?.button) {
        await handleButtonClick(userNumber, message.button.text);
      } else if (message?.interactive?.button_reply) {
        await handleButtonClick(
          userNumber,
          message.interactive.button_reply.title || message.interactive.button_reply.id
        );
      } else if (message?.interactive?.list_reply) {
        await handleButtonClick(
          userNumber,
          message.interactive.list_reply.title || message.interactive.list_reply.id
        );
      } else if (message?.text?.body) {
        await handleTextMessage(userNumber, message.text.body);
      }
    } else if (change?.value?.statuses) {
      console.log("Status Update:", change.value.statuses[0]);
      console.log("Full Status Data:", JSON.stringify(change.value.statuses[0], null, 2));
    }

    res.sendStatus(200);
  } catch (e) {
    console.error("Webhook Error:", e);
    res.sendStatus(500);
  }
});

async function handleButtonClick(userNumber, buttonTitle) {
  console.log(`Button clicked by ${userNumber}: ${buttonTitle}`);
  const title = (buttonTitle || "").trim();

  const responses = {
    "Architect Status": {
      message: "🏛️ *Search Architect / Verify Architect*\n\nPlease enter the Architect Registration Number (e.g., CA/2021/12345) or Architect Name to search.",
      state: "search_architect",
    },
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
    userStates[userNumber] = { awaiting: responses[title].state, attempts: 0 };
    return;
  }

  // Check department classification for custom buttons
  const classification = queryRouterService.classifyQuery(title);
  if (classification.type === "DEPARTMENT_QUERY" || classification.type === "FAQ") {
    sendTextMessage(userNumber, classification.response);
  } else {
    userStates[userNumber] = { attempts: 0 };
    sendWelcomeMessage(userNumber);
  }
}

function sendWelcomeMessage(userNumber) {
  const welcomeMessage = `Welcome to the Council of Architecture. We are available 24/7 to answer your queries. You can enquire, provide feedback, and ask for support. Please select an option to continue.`;
  const buttons = [
    { type: "text", text: "Architect Status" },
    { type: "text", text: "Application Status" },
    { type: "text", text: "Dispatch Status" },
  ];
  sendMessage(userNumber, welcomeMessage, buttons);
}

async function handleArchitectSearchFlow(userNumber, searchQuery) {
  try {
    const term = (searchQuery || "").trim();
    if (!term) {
      sendTextMessage(
        userNumber,
        "Please enter an Architect Registration Number (e.g., CA/2021/12345) or Architect Name to search."
      );
      userStates[userNumber] = { awaiting: "search_architect", attempts: 0 };
      return;
    }

    const searchResult = await coaApiService.searchArchitect({ query: term });

    if (!searchResult.found || !searchResult.architects || searchResult.architects.length === 0) {
      sendTextMessage(
        userNumber,
        `🏛️ *Council of Architecture — Search Result*\n\nNo architect record found matching "${term}".\n\nPlease check the Registration Number (format: CA/YYYY/XXXXX) or Name and try again.\n\n_Type "menu" to return to the main menu._`
      );
      userStates[userNumber] = {};
      return;
    }

    if (searchResult.architects.length === 1) {
      const arch = searchResult.architects[0];
      let msg = `🏛️ *Council of Architecture — Architect Details*\n\n`;
      msg += `• *Registration No:* ${arch.regNumber || "Not Available"}\n`;
      msg += `• *Architect Name:* Ar. ${arch.name || "Not Available"}\n`;
      msg += `• *Registration Status:* ${arch.status || "Active"}\n`;
      msg += `• *Validity Upto:* ${arch.validity || "Not Available"}\n`;
      if (arch.maskedEmail) msg += `• *Email:* ${arch.maskedEmail}\n`;
      if (arch.maskedMobile) msg += `• *Mobile:* ${arch.maskedMobile}\n`;
      if (arch.address) msg += `• *Address:* ${arch.address}\n`;
      msg += `\n_Type "menu" to return to the main menu._`;

      sendTextMessage(userNumber, msg);
      userStates[userNumber] = {};
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
    userStates[userNumber] = { awaiting: "search_architect" };
  } catch (err) {
    console.error("Error in handleArchitectSearchFlow:", err);
    sendTextMessage(
      userNumber,
      "An unexpected error occurred while searching for architect records. Please try again later.\n\n_Type \"menu\" to return to the main menu._"
    );
    userStates[userNumber] = {};
  }
}

async function handleArchitectStatus(userNumber, registrationNumber) {
  return handleArchitectSearchFlow(userNumber, registrationNumber);
}

async function handleArchitectOTPVerification(userNumber, enteredOTP) {
  if (enteredOTP !== userStates[userNumber].otp?.toString()) {
    return sendTextMessage(userNumber, "Incorrect OTP. Please try again.");
  }

  const architectStatus = `The status for registration number ${userStates[userNumber].registrationNumber} is ${userStates[userNumber].status}, with validity up to ${userStates[userNumber].archValidityUpTo}.`;
  sendTextMessage(userNumber, architectStatus);
  userStates[userNumber] = {};
}

async function handleTextMessage(userNumber, rawUserMessage) {
  const userMessage = (rawUserMessage || "").trim();
  const lower = userMessage.toLowerCase();
  const userState = userStates[userNumber] || {};
  const awaiting = userState?.awaiting;

  // 1. Menu and Greeting triggers
  if (["menu", "main menu", "hi", "hello", "hey", "start", "options", "help", "home"].includes(lower)) {
    userStates[userNumber] = { attempts: 0 };
    return sendWelcomeMessage(userNumber);
  }

  // 2. Active Awaiting States
  if (awaiting) {
    switch (awaiting) {
      case "search_architect":
      case "architect_status":
        await handleArchitectSearchFlow(userNumber, userMessage);
        return;
      case "otp_verification_architect":
        await handleArchitectOTPVerification(userNumber, userMessage);
        return;
      case "dispatch_status":
        await handleDispatchStatus(userNumber, userMessage);
        return;
      case "application_status":
        await handleApplicationStatus(userNumber, userMessage);
        return;
      case "otp_verification_dispatch":
        await handleDispatchOTPVerification(userNumber, userMessage);
        return;
      case "otp_verification_application":
        await handleApplicationOTPVerification(userNumber, userMessage);
        return;
      default:
        userStates[userNumber] = { attempts: 0 };
        return sendWelcomeMessage(userNumber);
    }
  }

  // 3. Automated Intelligent Classification & Query Routing
  const classification = queryRouterService.classifyQuery(userMessage);

  switch (classification.type) {
    case "SEARCH_ARCHITECT":
      await handleArchitectSearchFlow(userNumber, classification.query);
      break;

    case "PROMPT_SEARCH_ARCHITECT":
      sendTextMessage(
        userNumber,
        "🏛️ *Search Architect / Verify Architect*\n\nPlease enter the Architect Registration Number (e.g., CA/2021/12345) or Architect Name to search."
      );
      userStates[userNumber] = { awaiting: "search_architect", attempts: 0 };
      break;

    case "FAQ":
      sendTextMessage(userNumber, classification.response);
      break;

    case "DEPARTMENT_QUERY":
      sendTextMessage(userNumber, classification.response);
      break;

    case "MENU":
      userStates[userNumber] = { attempts: 0 };
      sendWelcomeMessage(userNumber);
      break;

    case "UNCLASSIFIED":
    default:
      if (/^\d{10}$/.test(userMessage)) {
        await handleDispatchStatus(userNumber, userMessage);
      } else if (/^(?=.*\d)[a-zA-Z\d]{6,}$/i.test(userMessage) && !userMessage.includes(" ")) {
        await handleApplicationStatus(userNumber, userMessage);
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
      }
      break;
  }
}

async function handleApplicationStatus(userNumber, applicationNumber) {
  try {
    if (!userStates[userNumber].attempts) {
      userStates[userNumber].attempts = 0;
    }

    userStates[userNumber].applicationNumber = applicationNumber.toUpperCase();

    const appNumRegex = /^(?=.*\d)[a-zA-Z\d]{6,}$/i;
    if (!appNumRegex.test(applicationNumber)) {
      userStates[userNumber].attempts += 1;

      if (userStates[userNumber].attempts >= 3) {
        sendTextMessage(
          userNumber,
          "Maximum attempts reached. Please try again later."
        );
        userStates[userNumber] = {};
        return sendWelcomeMessage(userNumber);
      }

      sendTextMessage(
        userNumber,
        `Please enter a valid application number (minimum 6 characters, must contain numbers).`
      );
      return;
    }

    userStates[userNumber].attempts = 0;

const applicationAPIURL = process.env.NODE_ENV === "production" ? `https://coa.gov.in/AllApplicantDataAPI.php?application_no=${applicationNumber}`:`https://coa.gov.in/staging/AllApplicantDataAPI.php?application_no=${applicationNumber}`;

    const response = await axios.get(
      applicationAPIURL,
      { httpsAgent }
    );

    const applicantData = response.data;

    if (!response.data || response.data.length === 0) {
      userStates[userNumber].attempts += 1;

      if (userStates[userNumber].attempts >= 3) {
        sendTextMessage(
          userNumber,
          "Maximum attempts reached. Please try again later."
        );
        userStates[userNumber] = {};
        return sendWelcomeMessage(userNumber);
      }

      sendTextMessage(
        userNumber,
        `No application found with Application No. ${applicationNumber}. Please try again.`
      );
      return;
    }

    const status = applicantData?.appStatus || "Not Available";
    const applicantMobile = applicantData?.Mobile?.toString();
    const senderMobile = userNumber.startsWith("91")
      ? userNumber.substring(2)
      : userNumber;

    if (!applicantMobile) {
      const responseMessage = `Dear Applicant, \nNo mobile number is associated with application number (${applicationNumber}). \n\nPlease contact COA team for assistance:\nEmail: ${process.env.HELPLINE_EMAIL}\nPhone: ${process.env.HELPLINE_NUMBER}`;
      sendTextMessage(userNumber, responseMessage);
      userStates[userNumber] = {};
      return;
    }

    if (applicantMobile === senderMobile) {
      const responseMessage = `The status for Application No. ${applicationNumber} is ${status}.`;
      sendTextMessage(userNumber, responseMessage);
      userStates[userNumber] = {};
    } else {
      await initiateOTPVerification(
        userNumber,
        applicantMobile,
        "otp_verification_application",
        {
          applicationNumber: applicationNumber,
          status: status,
        }
      );
    }
  } catch (error) {
    console.error("Error initiating application status check:", error);
    sendTextMessage(
      userNumber,
      "Something went wrong while checking application status. Please try again."
    );
    userStates[userNumber] = {};
  }
}

async function handleApplicationOTPVerification(userNumber, enteredOTP) {
  if (enteredOTP !== userStates[userNumber].otp?.toString()) {
    userStates[userNumber].otpAttempts =
      (userStates[userNumber].otpAttempts || 0) + 1;

    if (userStates[userNumber].otpAttempts >= 3) {
      sendTextMessage(
        userNumber,
        "Maximum OTP attempts reached. Please start over."
      );
      userStates[userNumber] = {};
      return sendWelcomeMessage(userNumber);
    }

    return sendTextMessage(userNumber, "Incorrect OTP. Please try again.");
  }

  const applicationStatus = `The status for Application No. ${userStates[userNumber].applicationNumber} is ${userStates[userNumber].status}.`;
  sendTextMessage(userNumber, applicationStatus);
  userStates[userNumber] = {};
}

async function handleDispatchStatus(userNumber, mobileNumber) {
  try {
    if (!userStates[userNumber].attempts) {
      userStates[userNumber].attempts = 0;
    }

    userStates[userNumber].mobileNumber = mobileNumber;

    const mobileRegex = /^\d{10}$/;
    if (!mobileRegex.test(mobileNumber)) {
      userStates[userNumber].attempts += 1;

      if (userStates[userNumber].attempts >= 3) {
        sendTextMessage(
          userNumber,
          "Maximum attempts reached. Please try again later."
        );
        userStates[userNumber] = {};
        return sendWelcomeMessage(userNumber);
      }

      sendTextMessage(
        userNumber,
        `Please enter a valid 10-digit mobile number (e.g., 9876543210).`
      );
      return;
    }

    userStates[userNumber].attempts = 0;

    const dispatchAPIURL = process.env.NODE_ENV === "production" ? `https://ecoa.in/api/letter-documents/${mobileNumber}`:`https://ecoa.in/ecoa_staging/public/api/letter-documents/${mobileNumber}`;



    const dispatchData = await axios.get(
      dispatchAPIURL,
      { httpsAgent }
    );


    if (
      !dispatchData.data?.data?.length ||
      mobileNumber != dispatchData?.data?.data[0]?.contact
    ) {
      sendTextMessage(
        userNumber,
        `No dispatch found for the given mobile number ${mobileNumber}. Please try again.`
      );
      return (userStates[userNumber] = {});
    }

    const isDispatched = dispatchData.data.data.filter((item) => item?.barcode);
    const lastDispatched = isDispatched[isDispatched.length - 1];
    const applicantMobile = lastDispatched?.contact?.toString();
    const senderMobile = userNumber.startsWith("91")
      ? userNumber.substring(2)
      : userNumber;

    if (applicantMobile === senderMobile) {
      return handleDispatchResponse(userNumber, isDispatched);
    }

    await initiateOTPVerification(
      userNumber,
      applicantMobile,
      "otp_verification_dispatch",
      { mobileNumber: mobileNumber }
    );
  } catch (error) {
    console.error("Error checking dispatch status:", error);
    sendTextMessage(
      userNumber,
      "Error checking dispatch status. Please try again."
    );
    userStates[userNumber] = {};
  }
}

async function handleDispatchOTPVerification(userNumber, enteredOTP) {
  if (enteredOTP !== userStates[userNumber].otp?.toString()) {
    userStates[userNumber].otpAttempts =
      (userStates[userNumber].otpAttempts || 0) + 1;

    if (userStates[userNumber].otpAttempts >= 3) {
      sendTextMessage(
        userNumber,
        "Maximum OTP attempts reached. Please start over."
      );
      userStates[userNumber] = {};
      return sendWelcomeMessage(userNumber);
    }

    return sendTextMessage(userNumber, "Incorrect OTP. Please try again.");
  }

  try {

    const dispatchAPIURL = process.env.NODE_ENV === "production" ? `https://ecoa.in/api/letter-documents/${userStates[userNumber].mobileNumber}`:`https://ecoa.in/ecoa_staging/public/api/letter-documents/${userStates[userNumber].mobileNumber}`;

    const response = await axios.get(
      dispatchAPIURL,
      { httpsAgent }
    );

    const isDispatched = response.data.data.filter((item) => item?.barcode);
    handleDispatchResponse(userNumber, isDispatched);
  } catch (error) {
    console.error("Error verifying dispatch OTP:", error);
    sendTextMessage(
      userNumber,
      "Error verifying dispatch status. Please try again."
    );
    userStates[userNumber] = {};
  }
}

function handleDispatchResponse(userNumber, dispatchedItems) {
  if (!dispatchedItems || dispatchedItems.length === 0) {
    sendTextMessage(
      userNumber,
      `Dear Architect,\n\nThe following documents have not been dispatched yet. Kindly wait for a few days.`
    );
  } else {
    const lastItem = dispatchedItems[dispatchedItems.length - 1];
    const dispatchStatus = `The documents have been dispatched to your communication address on ${lastItem?.dispatched_date}. Consignment No. ${
      lastItem?.barcode
    } . The same may be tracked on the ${process.env.COURIER_COMPANY_NAME} Courier website.
`;
    sendTextMessage(userNumber, dispatchStatus);
  }
  userStates[userNumber] = {};
}

async function initiateOTPVerification(
  userNumber,
  recipientMobile,
  nextState,
  additionalState = {}
) {
  const otp = Math.floor(100000 + Math.random() * 900000);

  userStates[userNumber] = {
    ...userStates[userNumber],
    otp,
    awaiting: nextState,
    applicant_mobile: recipientMobile,
    ...additionalState,
  };

  const otpTemplatePayload = {
    messaging_product: "whatsapp",
    to: recipientMobile.startsWith("91")
      ? recipientMobile
      : `91${recipientMobile}`,
    type: "template",
    template: {
      name: "coa_verification_otp",
      language: { code: "en" },
      components: [
        {
          type: "body",
          parameters: [{ type: "text", text: otp.toString() }],
        },
        {
          type: "button",
          sub_type: "url",
          index: 0,
          parameters: [
            {
              type: "text",
              text: otp.toString(),
            },
          ],
        },
      ],
    },
  };

  const headers = {
    Authorization: `Bearer ${WA_ACCESS_TOKEN}`,
    "Content-Type": "application/json",
  };

  try {
    await axios.post(
      `https://graph.facebook.com/v23.0/${PHONE_NUMBER_ID}/messages`,
      otpTemplatePayload,
      { headers }
    );
    const otpMessage = `Enter the OTP sent to your registered mobile number ****${recipientMobile.slice(
      -4
    )} to verify your identity.`;
    sendTextMessage(userNumber, otpMessage);
  } catch (error) {
    console.error(
      "Error sending OTP template:",
      error.response?.data || error.message
    );
    sendTextMessage(userNumber, "Error sending OTP. Please try again.");
    userStates[userNumber] = {};
  }
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
