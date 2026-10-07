import { apiSlice } from "../store/apiSlice";
import { clearCredentials } from "../store/authSlice";
import { store } from "../store/store";
import { clearSelectedUsers } from "../utils/selectedUsers";

const buildUrl = (url, params) => {
  if (!params) return url;
  const query = new URLSearchParams(params).toString();
  return query ? `${url}${url.includes("?") ? "&" : "?"}${query}` : url;
};

const request = async ({ url, method = "GET", body, params }) => {
  const result = await store.dispatch(
    apiSlice.endpoints.customRequest.initiate({
      url: buildUrl(url, params),
      method,
      body,
    }, {
      forceRefetch: method === "GET",
    })
  );

  if (result.error) {
    const error = new Error(result.error.data?.message || "Request failed");
    error.response = {
      status: result.error.status,
      data: result.error.data,
    };
    throw error;
  }

  return {
    data: result.data,
    status: result.meta?.response?.status || 200,
  };
};

const api = {
  get: (url, config = {}) => request({ url, method: "GET", params: config.params }),
  post: (url, body) => request({ url, method: "POST", body }),
  put: (url, body) => request({ url, method: "PUT", body }),
  delete: (url) => request({ url, method: "DELETE" }),
};

export const clearAuthState = () => {
  clearSelectedUsers();
  store.dispatch(clearCredentials());
  sessionStorage.clear();
};

export default api;
