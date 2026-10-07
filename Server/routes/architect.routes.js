import express from "express";
import {
  getDepartments,
  getFaqs,
  searchArchitect,
  verifyArchitect,
} from "../controllers/architect.controller.js";

const router = express.Router();

router.get("/search", searchArchitect);
router.post("/search", searchArchitect);
router.get("/verify/:regNumber", verifyArchitect);
router.get("/verify", verifyArchitect);
router.get("/faqs", getFaqs);
router.get("/departments", getDepartments);

export default router;
