import coaApiService from "../services/coaApiService.js";
import faqService from "../services/faqService.js";
import { DEPARTMENT_DATA } from "../services/queryRouterService.js";

/**
 * Controller for architect search & verification, FAQ and Department routing
 */
export const searchArchitect = async (req, res) => {
  try {
    const { reg_no, name, query } = req.query;
    const searchTerm = reg_no || name || query || (req.body && (req.body.reg_no || req.body.name || req.body.query));

    if (!searchTerm) {
      return res.status(400).json({
        success: false,
        message: "Please provide a registration number (reg_no) or name to search.",
      });
    }

    const result = await coaApiService.searchArchitect({
      regNumber: reg_no,
      name: name,
      query: searchTerm,
    });

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Error in searchArchitect controller:", error.message);
    return res.status(500).json({
      success: false,
      message: "An error occurred while searching for architect details.",
    });
  }
};

export const verifyArchitect = async (req, res) => {
  try {
    const regNumber = req.params.regNumber || req.query.reg_no;

    if (!regNumber) {
      return res.status(400).json({
        success: false,
        message: "Registration number is required for verification.",
      });
    }

    const result = await coaApiService.searchArchitect({
      regNumber,
    });

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Error in verifyArchitect controller:", error.message);
    return res.status(500).json({
      success: false,
      message: "An error occurred while verifying the architect registration.",
    });
  }
};

export const getFaqs = async (req, res) => {
  try {
    const { query } = req.query;
    if (query) {
      const match = faqService.findFaq(query);
      return res.status(200).json({
        success: true,
        data: match || null,
      });
    }

    const all = faqService.getAllFaqs();
    return res.status(200).json({
      success: true,
      data: all,
    });
  } catch (error) {
    console.error("Error in getFaqs controller:", error.message);
    return res.status(500).json({
      success: false,
      message: "An error occurred while retrieving FAQs.",
    });
  }
};

export const getDepartments = async (req, res) => {
  try {
    return res.status(200).json({
      success: true,
      data: DEPARTMENT_DATA,
    });
  } catch (error) {
    console.error("Error in getDepartments controller:", error.message);
    return res.status(500).json({
      success: false,
      message: "An error occurred while retrieving department information.",
    });
  }
};
