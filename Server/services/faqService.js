/**
 * FAQ Service
 * Provides intelligent answering for common Council of Architecture queries
 */

export const FAQ_DATA = [
  {
    id: "renewal_registration",
    category: "Renewal",
    title: "How to renew Architect Registration",
    keywords: [
      "how can i renew my registration",
      "how to renew registration",
      "how to renew my registration",
      "how can i renew registration",
      "how do i renew my registration",
      "renewal procedure",
      "renewal process",
      "renewal fees",
      "renewal documents",
      "how to pay renewal",
    ],
    procedure: [
      "1. Visit the official CoA renewal portal: https://coa.org.in/e-services/renewal-registration or https://coa.gov.in",
      "2. Log in using your registered Architect credentials.",
      "3. Go to 'Renewal of Registration', verify your personal & contact details.",
      "4. Make the payment of the requisite renewal fee through online mode or offline mode (Demand Draft in favour of 'COUNCIL OF ARCHITECTURE' payable at New Delhi / Cash at CoA New Delhi office).",
      "5. Submit a copy of your Final Degree Certificate issued by the University if not already submitted.",
      "6. If you possess a Certificate of Registration in the old format, surrender the original to CoA to receive the updated certificate.",
    ],
    requiredDocuments: [
      "Copy of Final Degree Certificate (if not previously submitted).",
      "Original old format Certificate of Registration (for surrender/replacement, if applicable).",
    ],
    fees: "Applicable renewal fee as prescribed under Council of Architecture regulations for the respective calendar year.",
    officialLinks: {
      portal: "https://coa.org.in/e-services/renewal-registration",
      ticketSystem: "https://ecoa.in/samarthaya/public/requestQuery?lang=1&level=1&sublinkid=1317&lid=1189",
      website: "https://coa.gov.in",
    },
    helpdesk: {
      email: "registration-renewal-coa@coa.gov.in",
      whatsappHelpdesk: "+91 70429 39122",
      phone: "011-49412100",
    },
    formatResponse() {
      return (
        `🏛️ *Council of Architecture — Registration Renewal Guide*\n\n` +
        `📋 *Procedure:*\n` +
        `1. Visit: https://coa.org.in/e-services/renewal-registration\n` +
        `2. Log in using your registered Architect credentials.\n` +
        `3. Verify your details & select Renewal of Registration.\n` +
        `4. Pay the requisite renewal fee online or offline via Demand Draft in favour of "COUNCIL OF ARCHITECTURE" payable at New Delhi / Cash at the CoA office.\n` +
        `5. Submit a copy of your Final Degree Certificate if not submitted earlier.\n\n` +
        `📄 *Required Documents:*\n` +
        `• Copy of Final Degree Certificate (if pending submission)\n` +
        `• Surrender of old format Certificate of Registration (if applicable)\n\n` +
        `💰 *Applicable Fees:*\n` +
        `• As prescribed on the portal for annual/comprehensive renewal\n\n` +
        `🔗 *Official Links:*\n` +
        `• Renewal Portal: https://coa.org.in/e-services/renewal-registration\n` +
        `• Samarthaya Ticket System: https://ecoa.in/samarthaya/public/requestQuery?lang=1&level=1&sublinkid=1317&lid=1189\n\n` +
        `📞 *Renewal Helpdesk:*\n` +
        `• Email: registration-renewal-coa@coa.gov.in\n` +
        `• WhatsApp Helpdesk: +91 70429 39122\n` +
        `• Phone: 011-49412100\n\n` +
        `_Type "menu" to return to the main menu._`
      );
    },
  },
  {
    id: "fresh_registration",
    category: "Registration",
    title: "How to register as an Architect (Fresh Registration)",
    keywords: [
      "how to register as an architect",
      "how to apply for registration",
      "how can i register as an architect",
      "how to get ca number",
    ],
    procedure: [
      "1. Visit the online registration portal: https://coa.org.in/e-services/register-architect",
      "2. Create a new applicant account and fill in personal and educational details.",
      "3. Upload scanned copies of recognized B.Arch degree, marksheets, ID proof, photo, and signature.",
      "4. Pay the prescribed registration fee online.",
      "5. Submit the application and note your Application Number for status tracking.",
    ],
    requiredDocuments: [
      "Recognized Bachelor of Architecture (B.Arch) Degree / Provisional Certificate",
      "Mark sheets of all semesters/years",
      "Identity Proof (Aadhaar / Passport / Voter ID)",
      "Passport size photograph & Signature",
    ],
    officialLinks: {
      portal: "https://coa.org.in/e-services/register-architect",
      ticketSystem: "https://ecoa.in/samarthaya/public/requestQuery?lang=1&level=1&sublinkid=1317&lid=1189",
    },
    helpdesk: {
      email: "registration-coa@coa.gov.in",
      phone: "011-49412100",
    },
    formatResponse() {
      return (
        `🏛️ *Council of Architecture — Fresh Architect Registration*\n\n` +
        `📋 *Procedure:*\n` +
        `1. Visit: https://coa.org.in/e-services/register-architect\n` +
        `2. Fill in the online registration form with academic & personal details.\n` +
        `3. Upload required documents (Degree/Provisional certificate, marksheets, ID proof, photo, signature).\n` +
        `4. Pay the online registration fee.\n` +
        `5. Submit and track status using your Application Number.\n\n` +
        `📄 *Key Documents:*\n` +
        `• Recognized B.Arch Degree/Provisional Certificate\n` +
        `• All semester mark sheets\n` +
        `• ID Proof & Passport size photograph\n\n` +
        `📞 *Registration Helpdesk:*\n` +
        `• Email: registration-coa@coa.gov.in\n` +
        `• Phone: 011-49412100\n` +
        `• Ticket System: https://ecoa.in/samarthaya/public/requestQuery?lang=1&level=1&sublinkid=1317&lid=1189\n\n` +
        `_Type "menu" to return to the main menu._`
      );
    },
  },
  {
    id: "surrender_certificate",
    category: "Registration",
    title: "Surrendering Old Format Registration Certificate",
    keywords: [
      "surrender certificate",
      "surrender registration",
      "old certificate format",
      "return certificate",
      "section 38",
    ],
    formatResponse() {
      return (
        `🏛️ *Council of Architecture — Surrender of Certificate*\n\n` +
        `In case you possess a Certificate of Registration in the old format, or in case of failure to renew registration, the Certificate of Registration must be surrendered to the Council immediately as provided under Section 38 of the Architects Act, 1972.\n\n` +
        `📬 *Office Address for Surrender:*\n` +
        `Council of Architecture\n` +
        `Core 6A, 1st Floor, India Habitat Centre, Lodhi Road, New Delhi - 110003\n\n` +
        `📞 *Helpdesk:* 011-49412100 | registration-coa@coa.gov.in\n\n` +
        `_Type "menu" to return to the main menu._`
      );
    },
  },
];

class FaqService {
  /**
   * Find matching FAQ for user query
   */
  findFaq(queryText) {
    if (!queryText || typeof queryText !== "string") return null;

    const normalized = queryText.toLowerCase().trim();

    // Direct keywords match
    for (const faq of FAQ_DATA) {
      for (const kw of faq.keywords) {
        if (normalized === kw || normalized.includes(kw)) {
          return faq;
        }
      }
    }

    return null;
  }

  getAllFaqs() {
    return FAQ_DATA.map((f) => ({
      id: f.id,
      category: f.category,
      title: f.title,
      procedure: f.procedure || [],
      requiredDocuments: f.requiredDocuments || [],
      fees: f.fees || "",
      officialLinks: f.officialLinks || {},
      helpdesk: f.helpdesk || {},
    }));
  }
}

export const faqService = new FaqService();
export default faqService;
