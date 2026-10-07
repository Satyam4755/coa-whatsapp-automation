import axios from "axios";
import bcrypt from "bcrypt";
import dotenv from "dotenv";
import express from "express";
import https from "https";
import Admin from "../models/Admin.js";
import MessageTemplate from "../models/MessageTemplate.js";
import { whatsappRateLimiter } from "../services/whatsappRateLimiter.js";
import {
  REFRESH_COOKIE_NAME,
  getRefreshCookieOptions,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../utils/authTokens.js";

const messageQueue = [];

// Enhanced message sending with rate limiting
const sendWhatsAppMessage = async (payload, waToken, waPhoneNumberId, architect) => {
  await whatsappRateLimiter.waitForTurn();

  try {
    const response = await axios.post(
      `https://graph.facebook.com/v23.0/${waPhoneNumberId}/messages`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${waToken}`,
          "Content-Type": "application/json",
        },
        timeout: 30000, // 30 second timeout
      }
    );

    return {
      status: "success",
      architect,
      response: response.data,
    };
  } catch (error) {
    const errData = error.response?.data || error.message;
    console.error(`❌ Error sending message to ${architect.archName}:`, errData);

    return {
      status: "failed",
      architect,
      error: errData
    };
  }
};

// Validate phone number format for WhatsApp
const validatePhoneNumber = (mobile) => {
  if (!mobile) return false;

  // Remove any non-digit characters
  const cleanMobile = mobile.toString().replace(/\D/g, '');

  // Check if it's a valid 10-digit Indian mobile number
  if (cleanMobile.length === 10 && /^[6-9]\d{9}$/.test(cleanMobile)) {
    return `91${cleanMobile}`;
  }

  // Check if it already includes country code
  if (cleanMobile.length === 12 && cleanMobile.startsWith('91')) {
    return cleanMobile;
  }

  return false;
};

const buildTemplateMessageComponents = (template, architect) => {
  return (template.components || [])
    .map((comp) => {
      const type = (comp.type || "").toLowerCase();

      if (type === "header") {
        if (comp.format === "IMAGE") {
          const previewUrl = comp.example?.preview_url;
          const headerHandle = Array.isArray(comp.example?.header_handle)
            ? comp.example.header_handle[0]
            : comp.example?.header_handle;

          if (previewUrl) {
            return {
              type: "header",
              parameters: [{ type: "image", image: { link: previewUrl } }],
            };
          }

          if (typeof headerHandle === "string" && /^https?:\/\//i.test(headerHandle)) {
            return {
              type: "header",
              parameters: [{ type: "image", image: { link: headerHandle } }],
            };
          }

          if (typeof headerHandle === "string" && /^\d+$/.test(headerHandle)) {
            return {
              type: "header",
              parameters: [{ type: "image", image: { id: Number(headerHandle) } }],
            };
          }

          return null;
        }

        if (comp.format === "TEXT") {
          const matches = [...(comp.text || "").matchAll(/\{\{(\d+)\}\}/g)];
          const numbers = matches.map((m) => parseInt(m[1], 10));
          const params = [];
          for (let i = 1; i <= Math.max(0, ...numbers); i++) {
            const field = template.variableMap?.[i];
            params.push({ type: "text", text: architect[field] || "" });
          }
          return { type: "header", parameters: params };
        }
      }

      if (type === "body") {
        const matches = [...(comp.text || "").matchAll(/\{\{(\d+)\}\}/g)];
        const numbers = matches.map((m) => parseInt(m[1], 10));
        const params = [];
        for (let i = 1; i <= Math.max(0, ...numbers); i++) {
          const field = template.variableMap?.[i];
          params.push({ type: "text", text: architect[field] || "" });
        }
        return { type: "body", parameters: params };
      }

      if (type === "button") {
        return null;
      }

      return null;
    })
    .filter(Boolean);
};

dotenv.config();

const router = express.Router();

// SIGNUP
router.post("/signup", async (req, res) => {
  const { name, email, password, security } = req.body;
  try {
    const normalizedName = name?.trim();
    const normalizedEmail = email?.trim().toLowerCase();
    const normalizedPassword = password?.trim();
    const normalizedQuestion = security?.question?.trim();
    const normalizedAnswer = security?.answer?.trim();

    if (
      !normalizedName ||
      !normalizedEmail ||
      !normalizedPassword ||
      !normalizedQuestion ||
      !normalizedAnswer
    ) {
      return res.status(401).json({ message: "All fields are important!!!" });
    }
    const userExist = await Admin.exists({ email: normalizedEmail });
    if (userExist) {
      return res.status(402).json({ message: "User already exists" });
    }
    const hashedPassword = await bcrypt.hash(normalizedPassword, 10);
    const hashedSecurityAnswer = await bcrypt.hash(normalizedAnswer, 10);
    const newAdmin = new Admin({
      name: normalizedName,
      email: normalizedEmail,
      password: hashedPassword,
      security: {
        question: normalizedQuestion,
        answer: hashedSecurityAnswer,
      },
    });
    await newAdmin.save();
    res.status(201).json({ message: "New Admin created" });
  } catch (error) {
    console.log(error.message);
    res.status(500).json({ message: error.message });
  }
});

// LOGIN
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const normalizedEmail = email?.trim().toLowerCase();
    const normalizedPassword = password?.trim();

    if (!normalizedEmail || !normalizedPassword) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const user = await Admin.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(401).json({ message: "User does not exists!!!" });
    }
    const passwordMatch = await bcrypt.compare(normalizedPassword, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }
    const accessToken = signAccessToken(user);
    const refreshToken = signRefreshToken(user);

    res.cookie(REFRESH_COOKIE_NAME, refreshToken, getRefreshCookieOptions());

    return res.status(200).json({
      success: true,
      message: "Login successful",
      accessToken,
      user: {
        name: user.name,
        email: user.email,
        role: "admin"
      }
    });
  } catch (error) {
    console.log(error.message);
    return res.status(500).json({ message: error.message });
  }
});

router.post("/refresh-token", async (req, res) => {
  const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME];

  if (!refreshToken) {
    return res.status(401).json({ message: "Refresh token not found" });
  }

  try {
    const decoded = verifyRefreshToken(refreshToken);

    if (decoded.type !== "refresh") {
      return res.status(401).json({ message: "Invalid refresh token" });
    }

    const user = await Admin.findById(decoded.userId);
    if (!user || (user.refreshTokenVersion || 0) !== decoded.tokenVersion) {
      return res.status(401).json({ message: "Invalid refresh token" });
    }

    const accessToken = signAccessToken(user);
    const nextRefreshToken = signRefreshToken(user);
    res.cookie(REFRESH_COOKIE_NAME, nextRefreshToken, getRefreshCookieOptions());

    return res.status(200).json({
      success: true,
      accessToken,
      user: {
        name: user.name,
        email: user.email,
        role: "admin",
      },
    });
  } catch (error) {
    console.error("Refresh token error:", error.message);
    res.clearCookie(REFRESH_COOKIE_NAME, getRefreshCookieOptions());
    return res.status(401).json({ message: "Invalid refresh token" });
  }
});

// LOGOUT
router.post("/logout", (req, res) => {
  res.clearCookie(REFRESH_COOKIE_NAME, getRefreshCookieOptions());
  return res.status(200).json({ success: true, message: "Logout successful" });
});

// Admin Profile
import AdminAuthenticateToken from "../middlewares/AdminAuthenticateToken.js";
router.get("/my-profile", AdminAuthenticateToken, async (req, res) => {
  try {
    const { email } = req.user;
    const findUser = await Admin.findOne({ email: email }).select(
      "-password -security"
    );
    res.status(201).json(findUser);
  } catch (error) {
    console.log(error.message);
    res.status(500).json({ message: error.message });
  }
});

// Fetch candidate details
const httpsAgent = new https.Agent({
  rejectUnauthorized: false, // Disable SSL certificate verification
});

const hardcodedArchitect = [
  {
    archName: "test1",
    archRegNum: "bA/2024/99999",
    archdob: "1990-01-01",
    archValidityUpTo: "31/December/2099",
    Mobile: "6207234759",
    Email: "hardcoded@example.com",
    archStatus: "Active",
  },
  {
    archName: "Yash",
    archRegNum: "CA/2024/99999",
    archdob: "1990-01-01",
    archValidityUpTo: "1/December/2099",
    Mobile: "7017375108",
    Email: "Yash@example.com",
    archStatus: "Active",
  },
  {
    archName: "Praveen",
    archRegNum: "CA/2024/99999",
    archdob: "1990-01-01",
    archValidityUpTo: "1/December/2099",
    Mobile: "8743987079",
    Email: "Praveen@example.com",
    archStatus: "Active",
  },
  {
    archName: "Mani",
    archRegNum: "CA/2024/99999",
    archdob: "1990-01-01",
    archValidityUpTo: "1/December/2099",
    Mobile: "8750300077",
    Email: "Mani@example.com",
    archStatus: "Active",
  },
  {
    archName: "Jatin",
    archRegNum: "CA/2024/99999",
    archdob: "1990-01-01",
    archValidityUpTo: "1/December/2099",
    Mobile: "9711341936",
    Email: "Jatin@example.com",
    archStatus: "Active",
  },
];

router.get("/all-architects", async (req, res) => {
  try {
    const response = await axios.get(
      "https://coa.gov.in/AllArchitectDataAPI.php",
      { httpsAgent }
    );
    const rawData = response.data;
    const architects = rawData.split("}{").map((item, index, arr) => {
      if (index === 0) return JSON.parse(item + "}");
      if (index === arr.length - 1) return JSON.parse("{" + item);
      return JSON.parse("{" + item + "}");
    });
    architects.push(...hardcodedArchitect);
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Pragma", "no-cache");

    const wantsPagination =
      req.query.paginate === "true" || req.query.page || req.query.limit;

    if (!wantsPagination) {
      return res.json(architects);
    }

    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(
      Math.max(parseInt(req.query.limit, 10) || 20, 1),
      100
    );
    const search = String(req.query.search || "").trim().toLowerCase();
    const year = String(req.query.year || "").trim();

    const years = Array.from(
      new Set(
        architects
          .map((architect) =>
            new Date(architect.archValidityUpTo).getFullYear()
          )
          .filter((validityYear) => !Number.isNaN(validityYear))
      )
    ).sort((a, b) => a - b);

    const filteredArchitects = architects
      .filter((architect) => {
        const validityYear = new Date(
          architect.archValidityUpTo
        ).getFullYear();
        const matchesYear = year ? String(validityYear) === year : true;
        const searchableText = [
          architect.archName,
          architect.archRegNum,
          architect.archdob,
          architect.archValidityUpTo,
          architect.Mobile,
          architect.Email,
          architect.archStatus,
          validityYear,
        ]
          .filter((value) => value !== undefined && value !== null)
          .join(" ")
          .toLowerCase();
        const matchesSearch = search ? searchableText.includes(search) : true;

        return matchesYear && matchesSearch;
      })
      .sort(
        (a, b) =>
          new Date(a.archValidityUpTo).getFullYear() -
          new Date(b.archValidityUpTo).getFullYear()
      );

    const total = filteredArchitects.length;
    const totalPages = Math.max(Math.ceil(total / limit), 1);
    const currentPage = Math.min(page, totalPages);
    const start = (currentPage - 1) * limit;

    return res.json({
      data: filteredArchitects.slice(start, start + limit),
      years,
      pagination: {
        currentPage,
        limit,
        total,
        totalCount: total,
        totalPages,
      },
    });
  } catch (error) {
    console.error("Error processing API response:", error.message);
    res.status(500).json({ message: "Error processing API response" });
  }
});

// Send message with or without attachment
router.post("/send-message", async (req, res) => {
  const { templateId, allArchitects } = req.body;

  try {
    const template = await MessageTemplate.findById(templateId);
    if (!template || !Array.isArray(allArchitects) || !allArchitects.length) {
      return res
        .status(400)
        .json({ error: "Template and recipients are required." });
    }

    // Validate template status
    if (template.status !== 'APPROVED') {
      return res
        .status(400)
        .json({
          error: `Template status is "${template.status}". Only APPROVED templates can be sent.`,
          templateStatus: template.status,
          rejectionReason: template.rejection_reason
        });
    }

    console.log(`📤 Sending messages using template: ${template.name} (${template.status})`);

    const results = [];
    const waToken = process.env.WA_ACCESS_TOKEN;
    const waPhoneNumberId = process.env.WA_PHONE_NUMBER_ID;

    // Validate all phone numbers first
    const validArchitects = allArchitects.filter(architect => {
      const validPhone = validatePhoneNumber(architect.Mobile);
      if (!validPhone) {
        results.push({
          status: "failed",
          architect,
          error: architect.Mobile ? "Invalid phone number format" : "Missing mobile number",
        });
        return false;
      }
      architect.validPhone = validPhone;
      return true;
    });

    console.log(`📞 Processing ${validArchitects.length} valid recipients out of ${allArchitects.length} total`);

    for (const architect of validArchitects) {
      const phone = architect.validPhone;

      if (
        template.name &&
        template.language &&
        Array.isArray(template.components) &&
        template.components.length > 0
      ) {
        // Build parameters for WhatsApp template using variableMap and actual BODY variables
        const builtComponents = buildTemplateMessageComponents(template, architect);

        const messagePayload = {
          messaging_product: "whatsapp",
          to: phone,
          type: "template",
          template: {
            name: template.name,
            language: { code: template.language },
            components: builtComponents,
          },
        };

        // Use rate-limited sending function
        const result = await sendWhatsAppMessage(messagePayload, waToken, waPhoneNumberId, architect);
        results.push(result);

        if (result.status === "success") {
          console.log(`✅ Template message sent to ${architect.archName}`);
        }
      } else {
        // Handle fallback legacy message
        const customizedMessage = (template.message || "").replace(
          /\{\{(\w+)\}\}/g,
          (_, key) => {
            return architect[key] || `{{${key}}}`;
          }
        );

        const messagePayload = {
          messaging_product: "whatsapp",
          to: phone,
        };

        if (template?.attachment?.secure_url) {
          messagePayload.type = "document";
          messagePayload.document = {
            link: template.attachment.secure_url,
            caption: customizedMessage,
          };
        } else {
          messagePayload.type = "text";
          messagePayload.text = {
            body: customizedMessage,
          };
        }

        // Use rate-limited sending function for legacy messages too
        const result = await sendWhatsAppMessage(messagePayload, waToken, waPhoneNumberId, architect);
        results.push(result);

        if (result.status === "success") {
          console.log(`✅ Legacy message sent to ${architect.archName}`);
        }
      }
    }

    return res.status(200).json({
      message: "Messages processed",
      successCount: results.filter((r) => r.status === "success").length,
      failureCount: results.filter((r) => r.status === "failed").length,
      results,
    });
  } catch (error) {
    console.error("❌ Server error while sending messages:", error.message);
    return res
      .status(500)
      .json({ error: "Server error while sending messages" });
  }
});

export default router;
