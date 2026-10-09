import faqService from "./faqService.js";

/**
 * Department contact details approved from official CoA requirements
 */
export const DEPARTMENT_DATA = {
  REGISTRATION: {
    name: "Registration Department",
    category: "Registration",
    email: "registration-coa@coa.gov.in",
    phone: "011-49412100",
    portal: "https://coa.org.in/e-services/register-architect",
    ticketSystem:
      "https://ecoa.in/samarthaya/public/requestQuery?lang=1&level=1&sublinkid=1317&lid=1189",
    description: "New Architect Enrolment, Registration Queries, and Documentation",
  },
  RENEWAL: {
    name: "Renewal Department",
    category: "Renewal",
    email: "registration-renewal-coa@coa.gov.in",
    whatsappHelpdesk: "+91 70429 39122",
    portal: "https://coa.org.in/e-services/renewal-registration",
    ticketSystem:
      "https://ecoa.in/samarthaya/public/requestQuery?lang=1&level=1&sublinkid=1317&lid=1189",
    description: "Annual & Comprehensive Registration Renewal, Validity & Re-activation",
  },
  NATA: {
    name: "NATA (National Aptitude Test in Architecture)",
    category: "NATA",
    website: "https://www.nata.in",
    portal: "https://coa.gov.in",
    ticketSystem:
      "https://ecoa.in/samarthaya/public/requestQuery?lang=1&level=1&sublinkid=1317&lid=1189",
    description: "NATA Exam Information, Scorecards & Admissions",
  },
  PGETA: {
    name: "PGETA Department",
    category: "PGETA",
    website: "https://coa.gov.in",
    ticketSystem:
      "https://ecoa.in/samarthaya/public/requestQuery?lang=1&level=1&sublinkid=1317&lid=1189",
    description: "Post Graduate Examination in Training & Architecture Enquiries",
  },
  EDUCATION: {
    name: "Education & Institution Department",
    category: "Education",
    website: "https://coa.gov.in",
    ticketSystem:
      "https://ecoa.in/samarthaya/public/requestQuery?lang=1&level=1&sublinkid=1317&lid=1189",
    description: "Architectural Institutions, Inspection, Minimum Standards & Approval",
  },
  GENERAL: {
    name: "Other CoA Departments & Services",
    category: "Other CoA Services",
    website: "https://coa.gov.in",
    ticketSystem:
      "https://ecoa.in/samarthaya/public/requestQuery?lang=1&level=1&sublinkid=1317&lid=1189",
    description: "Council Administrative Queries, Samarthaya Online Ticket System",
  },
};

class QueryRouterService {
  /**
   * Format department contact response for WhatsApp aligned with CoA recommendations
   */
  formatDepartmentResponse(deptKey) {
    if (deptKey === "REGISTRATION") {
      return (
        `Dear Architect,\n\n` +
        `Kindly email us your query at registration-coa@coa.gov.in or contact our Registration Department at 011-49412100.\n\n` +
        `Feel free to reach out here in case of any further issues.\n\n` +
        `Or visit https://coa.org.in/e-services/register-architect for more details\n\n` +
        `Or Ticket System:\nhttps://ecoa.in/samarthaya/public/requestQuery?lang=1&level=1&sublinkid=1317&lid=1189\n\n` +
        `_Type "menu" to return to the main menu._`
      );
    }

    if (deptKey === "RENEWAL") {
      return (
        `Dear Architect,\n\n` +
        `Kindly email us your query at registration-renewal-coa@coa.gov.in or WhatsApp our CoA Renewal Helpdesk at +91 70429 39122.\n\n` +
        `Feel free to reach out here in case of any further issues.\n\n` +
        `Or visit https://coa.org.in/e-services/renewal-registration for more details\n\n` +
        `Or Ticket System:\nhttps://ecoa.in/samarthaya/public/requestQuery?lang=1&level=1&sublinkid=1317&lid=1189\n\n` +
        `_Type "menu" to return to the main menu._`
      );
    }

    if (deptKey === "NATA") {
      return (
        `Dear Architect / Candidate,\n\n` +
        `For queries related to NATA (National Aptitude Test in Architecture), please visit the official NATA website or the CoA portal:\n\n` +
        `• Official NATA Website: https://www.nata.in\n` +
        `• CoA Official Website: https://coa.gov.in\n` +
        `• Ticket System: https://ecoa.in/samarthaya/public/requestQuery?lang=1&level=1&sublinkid=1317&lid=1189\n\n` +
        `_Type "menu" to return to the main menu._`
      );
    }

    if (deptKey === "PGETA") {
      return (
        `Dear Architect / Candidate,\n\n` +
        `For queries related to PGETA (Post Graduate Examination in Training & Architecture), please visit the official CoA website or submit a query via the Ticket System:\n\n` +
        `• Official Website: https://coa.gov.in\n` +
        `• Ticket System: https://ecoa.in/samarthaya/public/requestQuery?lang=1&level=1&sublinkid=1317&lid=1189\n\n` +
        `_Type "menu" to return to the main menu._`
      );
    }

    if (deptKey === "EDUCATION") {
      return (
        `Dear Architect / Institution,\n\n` +
        `For queries related to Architecture Education & Institutions (Approval, Minimum Standards, Syllabus), please visit the official website or submit a query via the Ticket System:\n\n` +
        `• Official Website: https://coa.gov.in\n` +
        `• Ticket System: https://ecoa.in/samarthaya/public/requestQuery?lang=1&level=1&sublinkid=1317&lid=1189\n\n` +
        `_Type "menu" to return to the main menu._`
      );
    }

    return (
      `Dear Architect / User,\n\n` +
      `For queries related to other Council of Architecture departments and services, please submit your request through the Samarthaya Ticket System:\n\n` +
      `• Online Ticket System: https://ecoa.in/samarthaya/public/requestQuery?lang=1&level=1&sublinkid=1317&lid=1189\n` +
      `• Official Website: https://coa.gov.in\n\n` +
      `_Type "menu" to return to the main menu._`
    );
  }

  /**
   * Classify user query and return intention and details
   */
  classifyQuery(rawMessage) {
    if (!rawMessage || typeof rawMessage !== "string") {
      return { type: "UNKNOWN", raw: "" };
    }

    const text = rawMessage.trim();
    const lower = text.toLowerCase();

    // 1. Menu / Greeting triggers (matches hi, hii, hiii, hello, hey, heyy, start, menu, etc.)
    if (
      /^(?:hi+|hello+|hey+|namaste|good\s*(?:morning|afternoon|evening)|start|menu|main\s*menu|options|help|home)$/i.test(
        lower
      ) ||
      (/^(?:hi+|hello+|hey+|namaste)\b/i.test(lower) && lower.length <= 15)
    ) {
      return { type: "MENU", raw: text };
    }

    // 2. Direct Registration Number Pattern Match (e.g., CA/2021/12345 or CA/98/1234)
    const regNoMatch = text.match(/\b(CA\/\d{4}\/\d{4,7})\b/i) || text.match(/\b(CA\/\d{2,4}\/\d{3,7})\b/i);
    if (regNoMatch) {
      return {
        type: "SEARCH_ARCHITECT",
        searchType: "REGISTRATION_NUMBER",
        query: regNoMatch[1].toUpperCase(),
        raw: text,
      };
    }

    // 3. Standalone "Search Architect" / "Verify Architect" / "Architect Status" command or button ID
    const normalizedCmd = lower.replace(/[_\-]+/g, " ").trim();
    if (
      normalizedCmd === "search architect" ||
      normalizedCmd === "verify architect" ||
      normalizedCmd === "find architect" ||
      normalizedCmd === "architect search" ||
      normalizedCmd === "architect verification" ||
      normalizedCmd === "verify" ||
      normalizedCmd === "search" ||
      normalizedCmd === "architect status"
    ) {
      return {
        type: "PROMPT_SEARCH_ARCHITECT",
        raw: text,
      };
    }

    // 4. Search / Verify Architect Intent with specific query (e.g. "search architect Rajesh Sharma", "verify CA/2019/12345", "find architect John")
    const searchPrefixMatch = text.match(
      /^(?:search|verify|find|check|look\s*up)\s+(?:architect\s+)?(.+)$/i
    );
    if (searchPrefixMatch) {
      const queryParam = searchPrefixMatch[1].trim();
      if (
        queryParam.toLowerCase() !== "architect" &&
        queryParam.toLowerCase() !== "status"
      ) {
        if (/^CA\/\d+/i.test(queryParam) || /^\d{4,7}$/.test(queryParam)) {
          return {
            type: "SEARCH_ARCHITECT",
            searchType: "REGISTRATION_NUMBER",
            query: queryParam.toUpperCase(),
            raw: text,
          };
        }
        return {
          type: "SEARCH_ARCHITECT",
          searchType: "NAME",
          query: queryParam,
          raw: text,
        };
      }
    }

    // 5. Intelligent FAQ Match (Specific FAQ questions like "How can I renew my registration?")
    const matchedFaq = faqService.findFaq(lower);
    if (matchedFaq) {
      return {
        type: "FAQ",
        faq: matchedFaq,
        response: matchedFaq.formatResponse(),
        raw: text,
      };
    }

    // 6. Department Keyword Classification
    // NATA
    if (
      lower.includes("nata") ||
      lower.includes("aptitude test") ||
      lower.includes("b.arch entrance") ||
      lower.includes("nata exam")
    ) {
      return {
        type: "DEPARTMENT_QUERY",
        department: "NATA",
        response: this.formatDepartmentResponse("NATA"),
        raw: text,
      };
    }

    // PGETA
    if (
      lower.includes("pgeta") ||
      lower.includes("post graduate examination") ||
      lower.includes("m.arch entrance") ||
      lower.includes("pg entrance")
    ) {
      return {
        type: "DEPARTMENT_QUERY",
        department: "PGETA",
        response: this.formatDepartmentResponse("PGETA"),
        raw: text,
      };
    }

    // Renewal
    if (
      lower.includes("renewal") ||
      lower.includes("renew") ||
      lower.includes("re-registration") ||
      lower.includes("late fee") ||
      lower.includes("extend validity")
    ) {
      return {
        type: "DEPARTMENT_QUERY",
        department: "RENEWAL",
        response: this.formatDepartmentResponse("RENEWAL"),
        raw: text,
      };
    }

    // Education
    if (
      lower.includes("education") ||
      lower.includes("college approval") ||
      lower.includes("architecture institution") ||
      lower.includes("syllabus") ||
      lower.includes("minimum standards") ||
      lower.includes("intake capacity")
    ) {
      return {
        type: "DEPARTMENT_QUERY",
        department: "EDUCATION",
        response: this.formatDepartmentResponse("EDUCATION"),
        raw: text,
      };
    }

    // Registration
    if (
      lower.includes("registration") ||
      lower.includes("register") ||
      lower.includes("enrolment") ||
      lower.includes("enrollment") ||
      lower.includes("apply for ca")
    ) {
      return {
        type: "DEPARTMENT_QUERY",
        department: "REGISTRATION",
        response: this.formatDepartmentResponse("REGISTRATION"),
        raw: text,
      };
    }

    // Ticket / Grievance / Samarthaya / Contact / Office / Other Departments
    if (
      lower.includes("ticket") ||
      lower.includes("samarthaya") ||
      lower.includes("grievance") ||
      lower.includes("complaint") ||
      lower.includes("contact") ||
      lower.includes("helpline") ||
      lower.includes("address") ||
      lower.includes("phone number") ||
      lower.includes("other") ||
      lower.includes("another") ||
      lower.includes("department") ||
      lower.includes("services") ||
      lower.includes("general")
    ) {
      return {
        type: "DEPARTMENT_QUERY",
        department: "GENERAL",
        response: this.formatDepartmentResponse("GENERAL"),
        raw: text,
      };
    }

    return {
      type: "UNCLASSIFIED",
      raw: text,
    };
  }
}

export const queryRouterService = new QueryRouterService();
export default queryRouterService;
