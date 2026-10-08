import axios from "axios";
import https from "https";

const httpsAgent = new https.Agent({
  rejectUnauthorized: false,
});

class CoaApiService {
  constructor() {
    this.apiBaseUrl = (
      process.env.API_BASE_URL ||
      "https://coa.brandforce360.com/api/external/whatsapp"
    ).replace(/\/+$/, "");

    this.username = process.env.WHATSAPP_BASIC_AUTH_USERNAME || "coa-erp-portal";
    this.password = process.env.WHATSAPP_BASIC_AUTH_PASSWORD || "";
    this.timeout = 10000; // 10 seconds
  }

  getAuthHeader() {
    if (!this.username && !this.password) return null;
    const token = Buffer.from(`${this.username}:${this.password}`).toString(
      "base64"
    );
    return `Basic ${token}`;
  }

  getAxiosClient() {
    const headers = {
      Accept: "application/json, text/plain, */*",
      "Content-Type": "application/json",
    };

    const authHeader = this.getAuthHeader();
    if (authHeader) {
      headers.Authorization = authHeader;
    }

    return axios.create({
      baseURL: this.apiBaseUrl,
      headers,
      timeout: this.timeout,
      httpsAgent,
      validateStatus: (status) => status < 500, // Handle non-500 status gracefully
    });
  }

  formatDate(dateStr) {
    if (!dateStr) return "Not Available";
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

    try {
      if (dateStr.includes("/")) {
        const [day, month, year] = dateStr.split("/");
        const formattedMonth = months[month] || month;
        return `${day.padStart(2, "0")}/${formattedMonth}/${year}`;
      }
      return dateStr;
    } catch {
      return dateStr;
    }
  }

  maskPhone(phone) {
    if (!phone) return "";
    const str = phone.toString().trim();
    if (str.length < 4) return str;
    return `******${str.slice(-4)}`;
  }

  maskEmail(email) {
    if (!email || typeof email !== "string" || !email.includes("@")) return "";
    const [user, domain] = email.split("@");
    if (user.length <= 2) return `${user[0]}*@${domain}`;
    return `${user[0]}${"*".repeat(Math.min(user.length - 2, 5))}${user.slice(-1)}@${domain}`;
  }

  formatValidity(dateStr) {
    if (!dateStr) return "Not Available";
    const str = dateStr.toString().trim();
    if (/one\s*time\s*payment|\botp\b|lifetime/i.test(str)) {
      return "Valid Through: (One Time Payment)";
    }
    return this.formatDate(str);
  }

  normalizeArchitect(raw) {
    if (!raw || typeof raw !== "object") return null;

    const regNumber =
      raw.archRegNum ||
      raw.reg_no ||
      raw.registration_no ||
      raw.regNumber ||
      raw.registrationNumber ||
      "";

    let name =
      raw.archName ||
      raw.name ||
      raw.architect_name ||
      raw.architectName ||
      "";

    if (!name || name.trim() === "") {
      const parts = [
        raw.archFirstName || raw.firstName || "",
        raw.archMiddleName || raw.middleName || "",
        raw.archLastName || raw.lastName || "",
      ]
        .map((p) => (p || "").toString().trim())
        .filter(Boolean);

      if (parts.length > 0) {
        name = parts.join(" ");
      }
    }

    // Clean up extra whitespace
    name = (name || "").toString().replace(/\s+/g, " ").trim();

    const status =
      raw.archStatus ||
      raw.status ||
      raw.registration_status ||
      "Active";

    const rawValidity =
      raw.archValidityUpTo ||
      raw.validity ||
      raw.valid_upto ||
      raw.validUntil ||
      raw.validityUpTo ||
      "";

    const mobile = raw.Mobile || raw.mobile || raw.contact || "";
    const email = raw.Email || raw.email || "";
    const dob = raw.archdob || raw.dob || "";

    // Assemble address from available address fields
    let address =
      raw.archAddress ||
      raw.address ||
      raw.CorresspondanceAddr ||
      raw.PermanentAddr ||
      "";

    address = (address || "").toString().replace(/[\r\n]+/g, ", ").replace(/\s+/g, " ").trim();
    if (raw.district && !address.toLowerCase().includes(raw.district.toLowerCase())) {
      address += address ? `, ${raw.district}` : raw.district;
    }
    if (raw.pincode && !address.includes(raw.pincode)) {
      address += address ? ` - ${raw.pincode}` : raw.pincode;
    }

    return {
      regNumber: regNumber.toString().trim().toUpperCase(),
      name: name.toString().trim(),
      status: status.toString().trim(),
      validity: rawValidity ? this.formatValidity(rawValidity) : "Not Available",
      rawValidity: rawValidity,
      dob: dob ? this.formatDate(dob) : "",
      mobile: mobile ? mobile.toString() : "",
      maskedMobile: this.maskPhone(mobile),
      email: email.toString(),
      maskedEmail: this.maskEmail(email),
      address: address,
    };
  }

  /**
   * Search architect by registration number or name
   * Primary: Calls API_BASE_URL with Basic Auth
   * Fallback: Live CoA API endpoints (ArchitectVerifyAPI / AllArchitectDataAPI)
   */
  async searchArchitect({ regNumber, name, query }) {
    const searchTerm = (regNumber || name || query || "").trim();
    if (!searchTerm) {
      return {
        found: false,
        architects: [],
        message: "Search query is empty. Please provide a Registration Number or Name.",
      };
    }

    const isRegNumber = /^CA\/\d{4}\/\d{4,7}$/i.test(searchTerm) || /^CA\/\d+/i.test(searchTerm);
    const client = this.getAxiosClient();

    // 1. Try external API with Basic Auth
    try {
      const endpointsToTry = isRegNumber
        ? [
            `/architects?reg_no=${encodeURIComponent(searchTerm)}`,
            `/verify?reg_no=${encodeURIComponent(searchTerm)}`,
            `/search?reg_no=${encodeURIComponent(searchTerm)}`,
            `?reg_no=${encodeURIComponent(searchTerm)}`,
          ]
        : [
            `/architects?name=${encodeURIComponent(searchTerm)}`,
            `/search?name=${encodeURIComponent(searchTerm)}`,
            `/search?query=${encodeURIComponent(searchTerm)}`,
            `?name=${encodeURIComponent(searchTerm)}`,
          ];

      for (const endpoint of endpointsToTry) {
        try {
          const response = await client.get(endpoint);
          if (response.status >= 200 && response.status < 300 && response.data) {
            let data = response.data;
            if (data.data) data = data.data;

            if (Array.isArray(data) && data.length > 0) {
              const architects = data.map((item) => this.normalizeArchitect(item)).filter(Boolean);
              if (architects.length > 0) {
                return {
                  found: true,
                  count: architects.length,
                  architects,
                  source: "coa-external-api",
                };
              }
            } else if (typeof data === "object" && !Array.isArray(data) && (data.archRegNum || data.reg_no || data.archName || data.name)) {
              const architect = this.normalizeArchitect(data);
              if (architect) {
                return {
                  found: true,
                  count: 1,
                  architects: [architect],
                  source: "coa-external-api",
                };
              }
            }
          }
        } catch {
          // Continue to next endpoint or fallback
        }
      }
    } catch {
      // Ignore upstream network error and move to verified CoA fallback
    }

    // 2. Fallback: Query CoA Official API Endpoints
    try {
      if (isRegNumber) {
        const formattedReg = searchTerm.toUpperCase();
        const verifyUrl =
          process.env.NODE_ENV === "production"
            ? `https://www.coa.gov.in/ArchitectVerifyAPI.php?reg_no=${encodeURIComponent(formattedReg)}`
            : `https://www.coa.gov.in/staging/ArchitectVerifyAPI.php?reg_no=${encodeURIComponent(formattedReg)}`;

        const verifyRes = await axios.get(verifyUrl, {
          httpsAgent,
          timeout: this.timeout,
          validateStatus: (s) => s < 500,
        });

        if (verifyRes.data && typeof verifyRes.data === "object" && (verifyRes.data.archRegNum || verifyRes.data.archName || verifyRes.data.Mobile)) {
          const architect = this.normalizeArchitect({
            ...verifyRes.data,
            archRegNum: verifyRes.data.archRegNum || formattedReg,
          });
          return {
            found: true,
            count: 1,
            architects: [architect],
            source: "coa-verify-api",
          };
        }
      }

      // Name search or all-architect fallback
      const allUrl =
        process.env.NODE_ENV === "production"
          ? `https://coa.gov.in/AllArchitectDataAPI.php`
          : `https://coa.gov.in/staging/AllArchitectDataAPI.php`;

      const allRes = await axios.get(allUrl, {
        httpsAgent,
        timeout: 15000,
        validateStatus: (s) => s < 500,
      });

      if (allRes.data && typeof allRes.data === "string") {
        const rawData = allRes.data;
        const architects = rawData
          .split("}{")
          .map((item, index, arr) => {
            try {
              if (index === 0) return JSON.parse(item + "}");
              if (index === arr.length - 1) return JSON.parse("{" + item);
              return JSON.parse("{" + item + "}");
            } catch {
              return null;
            }
          })
          .filter(Boolean);

        const lowerQuery = searchTerm.toLowerCase();
        const matches = architects
          .filter((item) => {
            const archReg = (item.archRegNum || "").toLowerCase();
            const archName = (item.archName || "").toLowerCase();
            return archReg.includes(lowerQuery) || archName.includes(lowerQuery);
          })
          .slice(0, 5) // Return top 5 matches
          .map((item) => this.normalizeArchitect(item))
          .filter(Boolean);

        if (matches.length > 0) {
          return {
            found: true,
            count: matches.length,
            architects: matches,
            source: "coa-directory-api",
          };
        }
      }
    } catch (err) {
      console.error("Architect search fallback error:", err.message);
    }

    return {
      found: false,
      architects: [],
      message: `No architect found matching "${searchTerm}".`,
    };
  }
}

export const coaApiService = new CoaApiService();
export default coaApiService;
