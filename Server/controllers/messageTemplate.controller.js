import axios from "axios";
import cloudinary from "cloudinary";
import fs from "fs/promises";
import MessageTemplate from "../models/MessageTemplate.js";
import AppError from "../utils/error.utils.js";

const WA_ACCESS_TOKEN = process.env.WA_ACCESS_TOKEN;
const WHATSAPP_BUSINESS_ACCOUNT_ID = process.env.WA_BUSINESS_ACCOUNT_ID;
const META_APP_ID = process.env.META_APP_ID || process.env.FB_APP_ID || process.env.WA_APP_ID;
const TEMPLATE_NAME_REGEX = /^[a-z][a-z_]*$/;
const LANGUAGE_REGEX = /^[a-z]{2,3}(?:_[A-Z]{2})?$/;
const VALID_TEMPLATE_CATEGORIES = ["AUTHENTICATION", "MARKETING", "UTILITY"];

const normalizeTemplateName = (name = "") =>
  String(name)
    .trim()
    .toLowerCase()
    .replace(/[^a-z_]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");

const extractVariableNumbers = (text = "") => {
  const matches = [...String(text).matchAll(/\{\{(\d+)\}\}/g)];
  return matches.map((match) => Number(match[1]));
};

const validateSequentialVariables = (text = "", label = "Template text") => {
  const open = (String(text).match(/\{\{/g) || []).length;
  const close = (String(text).match(/\}\}/g) || []).length;
  if (open !== close) {
    throw new AppError(`${label} has mismatched variable braces.`, 400);
  }

  const numbers = [...new Set(extractVariableNumbers(text))].sort((a, b) => a - b);
  for (let i = 0; i < numbers.length; i++) {
    if (numbers[i] !== i + 1) {
      throw new AppError(`${label} variables must be sequential: {{1}}, {{2}}, ...`, 400);
    }
  }

  if (/\{\{\d+\}\}\s*$/.test(text)) {
    throw new AppError(`${label} cannot end with a variable.`, 400);
  }
};

const validateVariableMap = (variableMap) => {
  if (!variableMap) return;

  const keys = Object.keys(variableMap)
    .map(Number)
    .sort((a, b) => a - b);
  for (let i = 0; i < keys.length; i++) {
    if (keys[i] !== i + 1) {
      throw new AppError("variableMap keys must be sequential: 1,2,3,...", 400);
    }
  }
};

const validateTemplateBasics = ({ name, category, language, components }) => {
  if (!name || !category || !language || !components) {
    throw new AppError(
      "All required fields (name, category, language, components) must be provided",
      400
    );
  }

  if (!TEMPLATE_NAME_REGEX.test(name)) {
    throw new AppError(
      "Template name must start with a lower-case letter and contain only lower-case letters and underscores.",
      400
    );
  }

  if (!VALID_TEMPLATE_CATEGORIES.includes(category)) {
    throw new AppError("Template category must be AUTHENTICATION, MARKETING, or UTILITY.", 400);
  }

  if (!LANGUAGE_REGEX.test(language)) {
    throw new AppError("Template language must use Meta format, for example en_US.", 400);
  }

  if (!Array.isArray(components) || !components.some((c) => c.type === "BODY")) {
    throw new AppError("Template must include a BODY component.", 400);
  }
};

const processTemplateComponents = (components) =>
  components.map((component) => {
    const c = { ...component };

    if (c.type === "HEADER") {
      if (c.format === "IMAGE") {
        if (!c.example || !c.example.header_handle) {
          throw new AppError("IMAGE header must include example.header_handle.", 400);
        }

        const headerHandle = Array.isArray(c.example.header_handle)
          ? c.example.header_handle
          : [c.example.header_handle];

        if (!headerHandle.length || !headerHandle[0]) {
          throw new AppError(
            "IMAGE header must include at least one value in example.header_handle.",
            400
          );
        }

        return {
          ...c,
          example: {
            ...c.example,
            header_handle: headerHandle,
          },
        };
      }

      if (c.format === "TEXT") {
        validateSequentialVariables(c.text || "", "Header");
        const variableCount = extractVariableNumbers(c.text || "").length;
        if (variableCount > 0 && (!c.example || !Array.isArray(c.example.header_text))) {
          throw new AppError(
            "TEXT header with variables must include example.header_text array.",
            400
          );
        }
        if (variableCount === 0) {
          const { example, ...rest } = c;
          return rest;
        }
      }
    }

    if (c.type === "BODY") {
      if (!String(c.text || "").trim()) {
        throw new AppError("BODY text is required.", 400);
      }

      validateSequentialVariables(c.text || "", "Body");
      const variableCount = extractVariableNumbers(c.text || "").length;
      if (variableCount > 0) {
        if (
          !c.example ||
          !Array.isArray(c.example.body_text) ||
          !Array.isArray(c.example.body_text[0]) ||
          c.example.body_text[0].length < variableCount
        ) {
          throw new AppError(
            "BODY with variables must include example.body_text values for every variable.",
            400
          );
        }
      } else {
        const { example, ...rest } = c;
        return rest;
      }
    }

    if (c.type === "FOOTER") {
      if (!String(c.text || "").trim()) {
        throw new AppError("FOOTER text cannot be empty.", 400);
      }
      if (String(c.text).length > 60) {
        throw new AppError("FOOTER text must be 60 characters or less.", 400);
      }
      if (extractVariableNumbers(c.text || "").length > 0) {
        throw new AppError("FOOTER text cannot include variables.", 400);
      }
      return { type: "FOOTER", text: String(c.text).trim() };
    }

    if (c.type === "BUTTONS") {
      if (!Array.isArray(c.buttons) || c.buttons.length === 0) {
        throw new AppError("BUTTONS component must include at least one button.", 400);
      }
      if (c.buttons.length > 3) {
        throw new AppError("Use at most 3 buttons for this template editor.", 400);
      }

      const buttons = c.buttons.map((button) => {
        const type = button.type;
        const text = String(button.text || "").trim();

        if (!["QUICK_REPLY", "URL", "PHONE_NUMBER"].includes(type)) {
          throw new AppError("Button type must be QUICK_REPLY, URL, or PHONE_NUMBER.", 400);
        }
        if (!text) {
          throw new AppError("Every button must include text.", 400);
        }
        if (text.length > 25) {
          throw new AppError("Button text must be 25 characters or less.", 400);
        }

        if (type === "URL") {
          const url = String(button.url || "").trim();
          if (!/^https:\/\/.+/i.test(url)) {
            throw new AppError("URL buttons must use a valid https:// URL.", 400);
          }
          return { type, text, url };
        }

        if (type === "PHONE_NUMBER") {
          const phoneNumber = String(button.phone_number || "").trim();
          if (!/^\+?[1-9]\d{7,14}$/.test(phoneNumber)) {
            throw new AppError(
              "Phone number buttons must use international format, for example +919876543210.",
              400
            );
          }
          return { type, text, phone_number: phoneNumber };
        }

        return { type, text };
      });

      return { type: "BUTTONS", buttons };
    }

    return c;
  });

const buildMetaTemplateErrorMessage = (err) => {
  const error = err.response?.data?.error;
  if (!error) return err.message;

  return [
    error.error_user_title,
    error.error_user_msg,
    error.message && `Meta message: ${error.message}`,
    error.error_subcode && `Subcode: ${error.error_subcode}`,
  ]
    .filter(Boolean)
    .join(" - ");
};

const getMetaHeaders = (extraHeaders = {}) => ({
  Authorization: `Bearer ${WA_ACCESS_TOKEN}`,
  ...extraHeaders,
});

const getTemplateStatusFromMeta = (waTemplate) => {
  if (!waTemplate) return {};
  return {
    status: waTemplate.status,
    rejection_reason:
      waTemplate.rejected_reason ||
      waTemplate.rejection_reason ||
      waTemplate.quality_score?.reasons?.join(", ") ||
      undefined,
    wa_template_id: waTemplate.id,
  };
};

const MISSING_ON_META_REASON =
  "Template no longer exists on Meta. Review and delete the stale local record if this was intentional.";

const fetchAllMetaTemplates = async () => {
  if (!WA_ACCESS_TOKEN || !WHATSAPP_BUSINESS_ACCOUNT_ID) {
    throw new AppError(
      "WhatsApp template sync is not configured. WA_ACCESS_TOKEN and WA_BUSINESS_ACCOUNT_ID are required.",
      500
    );
  }

  let url = `https://graph.facebook.com/v23.0/${WHATSAPP_BUSINESS_ACCOUNT_ID}/message_templates?limit=100&fields=id,name,language,status,category,rejected_reason,quality_score`;
  const templates = [];

  while (url) {
    const response = await axios.get(url, {
      headers: getMetaHeaders(),
      timeout: 30000,
    });
    templates.push(...(response.data.data || []));
    url = response.data.paging?.next || null;
  }

  return templates;
};

const updateLocalTemplateFromMeta = (local, waTemplate) => {
  const meta = getTemplateStatusFromMeta(waTemplate);
  let changed = false;

  if (meta.status && local.status !== meta.status) {
    local.status = meta.status;
    changed = true;
  }

  if (meta.wa_template_id && local.wa_template_id !== meta.wa_template_id) {
    local.wa_template_id = meta.wa_template_id;
    changed = true;
  }

  if (meta.rejection_reason && local.rejection_reason !== meta.rejection_reason) {
    local.rejection_reason = meta.rejection_reason;
    changed = true;
  }

  if (meta.status && meta.status !== "REJECTED" && local.rejection_reason) {
    local.rejection_reason = undefined;
    changed = true;
  }

  return changed;
};

const getTemplateList = async (req, res, next) => {
  try {
    const templates = await MessageTemplate.find({});
    res.status(200).json({
      success: true,
      message: "Template List",
      templates,
    });
  } catch (e) {
    return next(new AppError("Something went wrong!", 500));
  }
};

const createTemplate = async (req, res, next) => {
  try {
    const rawName = req.body.name;
    const name = normalizeTemplateName(rawName);
    const {
      category,
      language,
      components,
      message_send_ttl_seconds,
      variableMap,
    } = req.body;

    validateTemplateBasics({ name, category, language, components });
    validateVariableMap(variableMap);

    const existingTemplate = await MessageTemplate.findOne({ name, language });
    if (existingTemplate) {
      return next(
        new AppError("A template with this name and language already exists.", 409)
      );
    }

    if (!WA_ACCESS_TOKEN || !WHATSAPP_BUSINESS_ACCOUNT_ID) {
      return next(
        new AppError(
          "WhatsApp template creation is not configured. WA_ACCESS_TOKEN and WA_BUSINESS_ACCOUNT_ID are required.",
          500
        )
      );
    }

    const comps = processTemplateComponents(components);

    // Submit to WhatsApp Cloud API
    let waRes;
    try {
      const url = `https://graph.facebook.com/v23.0/${WHATSAPP_BUSINESS_ACCOUNT_ID}/message_templates`;

      // Prepare payload specifically for WhatsApp API
      const waPayload = {
        name,
        category,
        language,
        components: comps.map((c) => {
          // For IMAGE headers, ensure the format matches WhatsApp expectations
          if (c.type === "HEADER" && c.format === "IMAGE") {
            return {
              type: "HEADER",
              format: "IMAGE",
              example: {
                header_handle: c.example.header_handle,
              },
            };
          }
          return c;
        }),
        message_send_ttl_seconds,
      };

      waRes = await axios.post(url, waPayload, {
        headers: getMetaHeaders({ "Content-Type": "application/json" }),
        timeout: 30000,
      });
    } catch (err) {
      console.error("WhatsApp API Error:", {
        status: err.response?.status,
        data: err.response?.data,
        headers: err.response?.headers,
      });
      return next(new AppError(buildMetaTemplateErrorMessage(err), 400));
    }

    const template = await MessageTemplate.create({
      name,
      category,
      language,
      components: comps,
      message_send_ttl_seconds,
      status: waRes.data.status || "PENDING",
      wa_template_id: waRes.data.id,
      variableMap,
    });

    res.status(201).json({
      success: true,
      message: "Template processed",
      template,
    });
  } catch (e) {
    console.error("Template Creation Error:", e);
    if (e instanceof AppError) {
      return next(e);
    }
    return next(new AppError(`Template creation failed: ${e.message}`, 500));
  }
};

const updateTemplate = async (req, res, next) => {
  try {
    const { id } = req.params;
    const rawName = req.body.name;
    const normalizedName = rawName ? normalizeTemplateName(rawName) : undefined;
    const {
      category,
      language,
      components,
      message_send_ttl_seconds,
      status,
      variableMap,
    } = req.body;
    const template = await MessageTemplate.findById(id);
    if (!template) {
      return next(new AppError("No template found", 400));
    }

    if (template.wa_template_id || ["PENDING", "APPROVED"].includes(template.status)) {
      return next(
        new AppError(
          "Templates already submitted to Meta cannot be edited locally. Create a new template with a new name for Meta review.",
          409
        )
      );
    }

    const nextTemplateData = {
      name: normalizedName || template.name,
      category: category || template.category,
      language: language || template.language,
      components: components || template.components,
    };

    validateTemplateBasics(nextTemplateData);
    validateVariableMap(variableMap);

    if (normalizedName || language) {
      const duplicateTemplate = await MessageTemplate.findOne({
        _id: { $ne: id },
        name: nextTemplateData.name,
        language: nextTemplateData.language,
      });

      if (duplicateTemplate) {
        return next(
          new AppError("A template with this name and language already exists.", 409)
        );
      }
    }

    // Validate BODY example for variables
    let comps = components;
    if (components) {
      comps = processTemplateComponents(components);
    }
    if (normalizedName) template.name = normalizedName;
    if (category) template.category = category;
    if (language) template.language = language;
    if (components) template.components = comps;
    if (message_send_ttl_seconds)
      template.message_send_ttl_seconds = message_send_ttl_seconds;
    if (status) template.status = status;
    if (variableMap) {
      // Validate variableMap is sequential
      const keys = Object.keys(variableMap)
        .map(Number)
        .sort((a, b) => a - b);
      for (let i = 0; i < keys.length; i++) {
        if (keys[i] !== i + 1) {
          return next(
            new AppError("variableMap keys must be sequential: 1,2,3,...", 400)
          );
        }
      }
      template.variableMap = variableMap;
    }
    await template.save();
    res.status(200).json({
      success: true,
      message: "Template updated successfully",
      template,
    });
  } catch (e) {
    if (e instanceof AppError) {
      return next(e);
    }
    return next(new AppError(e.message, 500));
  }
};

const deleteTemplate = async (req, res, next) => {
  try {
    const { id } = req.params;
    const template = await MessageTemplate.findById(id);
    if (!template) {
      return next(new AppError("No template found", 400));
    }

    try {
      const url = `https://graph.facebook.com/v23.0/${WHATSAPP_BUSINESS_ACCOUNT_ID}/message_templates?name=${template.name}&language=${template.language}`;
      await axios.delete(url, {
        headers: getMetaHeaders(),
        timeout: 30000,
      });
    } catch (err) {
      console.error("Failed to delete template from Meta:", err.response?.data || err.message);
      return next(
        new AppError(
          `Meta template deletion failed. Local template was not deleted. ${buildMetaTemplateErrorMessage(err)}`,
          502
        )
      );
    }

    await MessageTemplate.findByIdAndDelete(id);
    res.status(200).json({
      success: true,
      message: "Template deleted successfully",
    });
  } catch (e) {
    return next(new AppError(e.message, 500));
  }
};

const getTemplate = async (req, res, next) => {
  try {
    const { id } = req.params;
    const template = await MessageTemplate.findById(id);
    if (!template) {
      return next(new AppError("No template found"));
    }
    res.status(200).json({
      success: true,
      message: "Template Data!",
      template,
    });
  } catch (e) {
    return next(new AppError("Try Again! Something went wrong", 500));
  }
};

const syncTemplateStatus = async (req, res, next) => {
  try {
    const localTemplates = await MessageTemplate.find({});
    const waTemplates = await fetchAllMetaTemplates();
    let updated = 0;
    let missingOnMeta = 0;

    for (const local of localTemplates) {
      const wa = waTemplates.find(
        (template) => template.name === local.name && template.language === local.language
      );

      if (!wa) {
        missingOnMeta++;
        if (local.status !== "MISSING_ON_META" || local.rejection_reason !== MISSING_ON_META_REASON) {
          local.status = "MISSING_ON_META";
          local.rejection_reason = MISSING_ON_META_REASON;
          await local.save();
          updated++;
        }
        continue;
      }

      if (updateLocalTemplateFromMeta(local, wa)) {
        await local.save();
        updated++;
      }
    }

    res.status(200).json({
      success: true,
      message: `Synced ${updated} template${updated === 1 ? "" : "s"} from Meta`,
      updated,
      missingOnMeta,
      metaTemplateCount: waTemplates.length,
      templates: await MessageTemplate.find({}),
    });
  } catch (e) {
    console.error("Template sync error:", e.response?.data || e.message);
    return next(
      new AppError(`Failed to sync template statuses: ${buildMetaTemplateErrorMessage(e)}`, 500)
    );
  }
};

const uploadHeaderImage = async (req, res, next) => {
  const filePath = req.file?.path;

  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded. Please select an image file.",
      });
    }

    const fileSize = req.file.size;
    const fileSizeInMB = fileSize / (1024 * 1024);
    const fileType = req.file.mimetype;

    if (!["image/jpeg", "image/jpg", "image/png"].includes(fileType)) {
      return res.status(400).json({
        success: false,
        message: "Only JPG and PNG files can be used for WhatsApp template image headers.",
      });
    }

    if (fileSizeInMB > 5) {
      return res.status(400).json({
        success: false,
        message: "File size exceeds 5MB limit required by WhatsApp template image headers.",
      });
    }

    if (!WA_ACCESS_TOKEN || !META_APP_ID) {
      return res.status(500).json({
        success: false,
        message:
          "Template header image upload is not configured. WA_ACCESS_TOKEN and META_APP_ID, FB_APP_ID, or WA_APP_ID are required.",
      });
    }

    const fileBuffer = await fs.readFile(filePath);
    const uploadSession = await axios.post(
      `https://graph.facebook.com/v23.0/${META_APP_ID}/uploads`,
      null,
      {
        params: {
          file_name: req.file.originalname,
          file_length: fileSize,
          file_type: fileType,
        },
        headers: {
          Authorization: `OAuth ${WA_ACCESS_TOKEN}`,
        },
        timeout: 30000,
      }
    );

    const uploadSessionId = uploadSession.data.id;
    if (!uploadSessionId) {
      throw new Error("Meta did not return an upload session id.");
    }

    const uploadResponse = await axios.post(
      `https://graph.facebook.com/v23.0/${uploadSessionId}`,
      fileBuffer,
      {
        headers: {
          Authorization: `OAuth ${WA_ACCESS_TOKEN}`,
          file_offset: "0",
          "Content-Type": "application/octet-stream",
        },
        maxContentLength: 10 * 1024 * 1024,
        maxBodyLength: 10 * 1024 * 1024,
        timeout: 30000,
      }
    );

    const headerHandle = uploadResponse.data.h;
    if (!headerHandle) {
      throw new Error("Meta did not return a template header image handle.");
    }

    let previewUrl = "";
    try {
      const cloudinaryResult = await cloudinary.v2.uploader.upload(filePath, {
        folder: "whatsapp-template-previews",
        resource_type: "image",
        transformation: [
          {
            width: 1200,
            crop: "limit",
            quality: "auto:good",
            format: "png",
          },
        ],
      });
      previewUrl = cloudinaryResult.secure_url;
    } catch (previewError) {
      console.warn("Failed to generate Cloudinary template preview:", previewError.message);
    }

    return res.status(200).json({
      success: true,
      header_handle: headerHandle,
      preview_url: previewUrl,
      data: {
        header_handle: headerHandle,
        preview_url: previewUrl,
        file_size_mb: fileSizeInMB.toFixed(2),
        original_filename: req.file.originalname,
        file_type: fileType,
      },
      message: "Image uploaded successfully for WhatsApp template header",
    });
  } catch (error) {
    console.error("Template header image upload error:", error.response?.data || error.message);

    if (error.response?.data?.error) {
      return res.status(400).json({
        success: false,
        message: `Meta upload failed: ${error.response.data.error.message}`,
        error_code: error.response.data.error.code,
        error_subcode: error.response.data.error.error_subcode,
      });
    }

    return next(new AppError(`Image upload failed: ${error.message}`, 500));
  } finally {
    if (filePath) {
      try {
        await fs.unlink(filePath);
      } catch (cleanupError) {
        console.warn("Failed to delete temporary upload file:", cleanupError.message);
      }
    }
  }
};

export {
  createTemplate, deleteTemplate,
  getTemplate, getTemplateList, syncTemplateStatus, updateTemplate, uploadHeaderImage
};

