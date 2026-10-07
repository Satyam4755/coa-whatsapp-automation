import axios from "axios";
import cloudinary from "cloudinary";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { createServer } from 'http';
import https from "https";
import mongoose from "mongoose";
import morgan from "morgan";
import cron from "node-cron";

// Import the background job processor
import BulkJobProcessor from "./services/BulkJobProcessor.js";

const app = express();
const httpServer = createServer(app);

dotenv.config();

app.use(express.json());
app.use(cors({
  origin: [process.env.CLIENT_URL , "http://localhost:5173","https://coa-whatsapp-automation.onrender.com"],
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true
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

    // Initialize background job processor after MongoDB connection
    const jobProcessor = new BulkJobProcessor(httpServer);

    // Make job processor available to routes
    app.locals.jobProcessor = jobProcessor;

  })
  .catch((error) => {
    console.error("MongoDB connection error:", error);
  });

app.get("/", (req, res) => {
  res.send("Hello Diamond-ore - Background Jobs Ready! 🚀");
});

// Your existing WhatsApp webhook and message handling code
const WA_ACCESS_TOKEN = process.env.WA_ACCESS_TOKEN;
const PHONE_NUMBER_ID = process.env.WA_PHONE_NUMBER_ID;
const COA_WELCOME_IMAGE = process.env.COA_WELCOME_IMAGE;

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

// Your existing cron job
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

// All your existing webhook and message handling code...
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
      } else if (message?.text?.body) {
        await handleTextMessage(userNumber, message.text.body.toLowerCase());
      }
    } else if (change?.value?.statuses) {
      console.log("Status Update:", change.value.statuses[0]);
      console.log("Full Status Data:", JSON.stringify(change.value.statuses[0], null, 2));
      console.log("checking",change.value.statuses[0].errors[0].error_data);
    }

    res.sendStatus(200);
  } catch (e) {
    console.error("Webhook Error:", e);
    res.sendStatus(500);
  }
});

// [Include all your existing webhook handler functions here...]

app.get("/webhook", (req, res) => {
  const verifyToken = process.env.WA_WEBHOOK_VERIFY_TOKEN;

  if (!verifyToken) {
    console.error("WA_WEBHOOK_VERIFY_TOKEN is not configured");
    return res.status(500).send("Webhook verify token not configured");
  }

  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === verifyToken) {
    console.log("✅ Webhook verified");
    res.status(200).send(challenge);
  } else {
    console.log("❌ Verification failed");
    res.sendStatus(403);
  }
});

// Import and use routes
import backgroundJobController from "./controllers/admin-background-jobs.js"; // New controller for background jobs
import adminController from "./controllers/admin.js";
import errorMiddleware from "./middlewares/error.middleware.js";
import messageTemplateRouter from "./routes/messageTemplate.routes.js";

app.use("/api/admin", adminController); // Existing admin routes
app.use("/api/admin", backgroundJobController); // New background job routes
app.use("/api/template", messageTemplateRouter);

app.use(errorMiddleware);

// Use httpServer instead of app for Socket.IO compatibility
httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on port: ${PORT}`);
  console.log(`🔄 Background job processor active`);
  console.log(`📡 WebSocket server ready for real-time updates`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  httpServer.close(() => {
    console.log('Process terminated');
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  httpServer.close(() => {
    console.log('Process terminated');
  });
});
