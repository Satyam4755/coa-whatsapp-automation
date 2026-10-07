import { Router } from "express";
import {
  createTemplate,
  deleteTemplate,
  getTemplate,
  getTemplateList,
  syncTemplateStatus,
  updateTemplate,
  uploadHeaderImage,
} from "../controllers/messageTemplate.controller.js";
import AdminAuthenticateToken from "../middlewares/AdminAuthenticateToken.js";
import upload from "../middlewares/multer.middleware.js";

const router = Router();

router.post(
  "/template/sync-status",
  AdminAuthenticateToken,
  syncTemplateStatus
);

// List all templates
router.get("/", AdminAuthenticateToken, getTemplateList);

// Get a single template by ID
router.get("/:id", AdminAuthenticateToken, getTemplate);

// Create a new template (no file upload, pure JSON)
router.post("/", AdminAuthenticateToken, createTemplate);

// Update a template by ID
router.put("/:id", AdminAuthenticateToken, updateTemplate);

// Delete a template by ID
router.delete("/:id", AdminAuthenticateToken, deleteTemplate);

// Sync template status from WhatsApp (stub)

// Upload header image route (with proper path and authentication)
router.post(
  "/image/upload-header-image",
  AdminAuthenticateToken,
  upload.single("file"),
  uploadHeaderImage
);

export default router;
