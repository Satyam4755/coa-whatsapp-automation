import axios from "axios";
import https from "https";

const httpsAgent = new https.Agent({
  rejectUnauthorized: false,
});

class CoaApiService {
  constructor() {
    this.apiBaseUrl = (
      process.env.API_BASE_URL ||
      "https://coa-portal.prodioslabs.in/api/external/whatsapp"
    ).replace(/\/+$/, "");

    this.username = process.env.WHATSAPP_BASIC_AUTH_USERNAME || "coa-erp-portal";
    this.password = process.env.WHATSAPP_BASIC_AUTH_PASSWORD || "";
    this.timeout = 5000;

    this.cachedAccessToken = null;
    this.tokenExpiresAt = 0;
    this.tokenFetchPromise = null;
  }

  getBasicAuthHeader() {
    if (!this.username || !this.password) return null;
    const token = Buffer.from(`${this.username}:${this.password}`).toString(
      "base64"
    );
    return `Basic ${token}`;
  }

  getAuthHeader() {
    return this.getBasicAuthHeader();
  }

  invalidateToken() {
    this.cachedAccessToken = null;
    this.tokenExpiresAt = 0;
    this.tokenFetchPromise = null;
  }

  async getAccessToken(forceRefresh = false) {
    if (forceRefresh) {
      this.invalidateToken();
    }

    const now = Date.now();
    // Use cached token if valid and not within 60s early refresh margin
    if (!forceRefresh && this.cachedAccessToken && this.tokenExpiresAt - now > 60 * 1000) {
      return this.cachedAccessToken;
    }

    // Deduplicate in-flight token fetch requests across concurrent callers
    if (this.tokenFetchPromise) {
      return this.tokenFetchPromise;
    }

    let fetchPromise = null;
    fetchPromise = (async () => {
      try {
        const basicAuth = this.getBasicAuthHeader();
        if (!basicAuth) {
          throw new Error("Missing WhatsApp Basic Auth credentials for COA ERP API");
        }

        const authUrl = `${this.apiBaseUrl}/auth/token`;
        const response = await axios.post(
          authUrl,
          {},
          {
            headers: {
              Authorization: basicAuth,
              Accept: "application/json",
              "Content-Type": "application/json",
            },
            timeout: this.timeout,
            httpsAgent,
          }
        );

        const data = response?.data?.data || response?.data;
        const accessToken = data?.accessToken;
        const expiresIn = Number(data?.expiresIn) || 900;

        if (!accessToken) {
          throw new Error("COA ERP API /auth/token response missing accessToken");
        }

        this.cachedAccessToken = accessToken;
        this.tokenExpiresAt = Date.now() + expiresIn * 1000;
        return this.cachedAccessToken;
      } catch (err) {
        this.invalidateToken();
        console.error("COA ERP API token acquisition failed:", err.message);
        throw err;
      } finally {
        if (this.tokenFetchPromise === fetchPromise) {
          this.tokenFetchPromise = null;
        }
      }
    })();

    this.tokenFetchPromise = fetchPromise;
    return this.tokenFetchPromise;
  }

  getAxiosClient() {
    const client = axios.create({
      baseURL: this.apiBaseUrl,
      headers: {
        Accept: "application/json, text/plain, */*",
        "Content-Type": "application/json",
      },
      timeout: this.timeout,
      httpsAgent,
    });

    // Request interceptor: attach Bearer token to resource requests
    client.interceptors.request.use(
      async (config) => {
        try {
          const token = await this.getAccessToken();
          if (token) {
            config.headers = config.headers || {};
            config.headers.Authorization = `Bearer ${token}`;
          }
        } catch (tokenErr) {
          console.error("Failed to attach Bearer token to request:", tokenErr.message);
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor: retry on 401 once with refreshed token
    client.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;
        if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
          originalRequest._retry = true;
          this.invalidateToken();
          try {
            const newToken = await this.getAccessToken(true);
            if (newToken) {
              originalRequest.headers = originalRequest.headers || {};
              originalRequest.headers.Authorization = `Bearer ${newToken}`;
              return client(originalRequest);
            }
          } catch (refreshErr) {
            console.error("Retry failed after 401:", refreshErr.message);
            return Promise.reject(refreshErr);
          }
        }
        return Promise.reject(error);
      }
    );

    return client;
  }

  formatDate(dateStr, twoDigitYear = false) {
    if (!dateStr) return "";
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
      let day = "", month = "", year = "";
      const str = dateStr.toString().trim();
      const dateMatch = str.match(/(\d{1,2})[\/\-]([a-zA-Z0-9]+)[\/\-](\d{2,4})/);
      if (dateMatch) {
        day = dateMatch[1];
        month = months[dateMatch[2]] || dateMatch[2];
        year = dateMatch[3];
      } else if (str.includes("/")) {
        [day, month, year] = str.split("/");
        month = months[month] || month;
      } else if (str.includes("-")) {
        [year, month, day] = str.split("-");
      }

      if (!day || !month || !year) return str;
      const formattedYear = twoDigitYear && year.length === 4 ? year.slice(-2) : year;
      return `${day.padStart(2, "0")}/${month.padStart(2, "0")}/${formattedYear}`;
    } catch {
      return dateStr;
    }
  }

  getValidityDisplay(raw) {
    const rawStatus = (raw.archStatus || raw.status || "").toString();
    const rawValidity = (
      raw.archValidityUpTo ||
      raw.validity ||
      raw.valid_upto ||
      raw.validUntil ||
      ""
    ).toString();

    // 1. Endorsement due
    if (/endorsement\s*due/i.test(rawStatus) || /endorsement\s*due/i.test(rawValidity)) {
      return "Endorsement due.";
    }

    // 2. One time payment
    if (
      raw.isOneTimePayment ||
      raw.payment_type === "otp" ||
      raw.paymentType === "one_time" ||
      /one\s*time\s*payment|\botp\b|lifetime/i.test(rawValidity) ||
      /one\s*time\s*payment|\botp\b/i.test(rawStatus)
    ) {
      const d = this.formatDate(rawValidity, true);
      return d ? `One time payment valid till ${d}` : "One time payment valid till DD/MM/YY";
    }

    // 3. Annual payment
    if (rawValidity) {
      const d = this.formatDate(rawValidity, false);
      if (d) return `Annual payment valid till ${d}`;
    }

    return "Endorsement due.";
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

    let rawStatus =
      raw.archStatus ||
      raw.status ||
      raw.registration_status ||
      "Active";

    // Clean HTML tags from status (e.g. <span class="DataRed">Endorsement Due</span>)
    const cleanStatus = rawStatus.toString().replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();

    const rawValidity =
      raw.archValidityUpTo ||
      raw.validity ||
      raw.valid_upto ||
      raw.validUntil ||
      raw.validityUpTo ||
      "";

    const validityDisplay = this.getValidityDisplay(raw);

    return {
      regNumber: regNumber.toString().trim().toUpperCase(),
      name: name.toString().trim(),
      status: cleanStatus,
      validity: rawValidity ? this.formatDate(rawValidity, false) : "Not Available",
      validityDisplay: validityDisplay,
      rawValidity: rawValidity,
      address: [raw.CorresspondanceAddr, raw.district, raw.pincode].filter(Boolean).join(", "),
    };
  }

  /**
   * Search architect using ONLY the official CoA API (API_BASE_URL)
   * No fallback endpoints or full-directory downloads.
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

    const isRegNumber = /^CA\/\d{2,4}\/\d{3,7}$/i.test(searchTerm) || /^CA\/\d+/i.test(searchTerm);
    const client = this.getAxiosClient();

    try {
      const params = isRegNumber
        ? { reg_no: searchTerm.toUpperCase() }
        : { name: searchTerm };

      const response = await client.get("", { params });

      if (response && response.status >= 200 && response.status < 300 && response.data) {
        let data = response.data.data || response.data;

        if (Array.isArray(data) && data.length > 0) {
          const architects = data.map((item) => this.normalizeArchitect(item)).filter(Boolean);
          if (architects.length > 0) {
            return {
              found: true,
              count: architects.length,
              architects,
              source: "coa-official-api",
            };
          }
        } else if (typeof data === "object" && data !== null) {
          if (data.archRegNum || data.reg_no || data.archName || data.name || data.archFirstName) {
            const architect = this.normalizeArchitect(data);
            if (architect) {
              return {
                found: true,
                count: 1,
                architects: [architect],
                source: "coa-official-api",
              };
            }
          }
        }
      }
    } catch (error) {
      console.error("CoA Official API request error:", error.message);
    }

    return {
      found: false,
      architects: [],
      message: isRegNumber
        ? `No architect record found for Registration No. ${searchTerm.toUpperCase()}.`
        : `No architect found matching "${searchTerm}".`,
    };
  }
}

export const coaApiService = new CoaApiService();
export default coaApiService;
