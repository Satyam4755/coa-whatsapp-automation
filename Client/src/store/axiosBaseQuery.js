import axiosInstance from "../services/axiosInstance";

const axiosBaseQuery =
  () =>
  async (args) => {
    const request =
      typeof args === "string"
        ? { url: args, method: "GET" }
        : args;

    const { url, method = "GET", body, data, params, headers, ...config } =
      request;

    try {
      const result = await axiosInstance({
        url,
        method,
        data: data ?? body,
        params,
        headers,
        ...config,
      });

      return {
        data: result.data,
        meta: {
          response: result,
        },
      };
    } catch (axiosError) {
      return {
        error: {
          status: axiosError.response?.status || "FETCH_ERROR",
          data: axiosError.response?.data || axiosError.message,
        },
      };
    }
  };

export default axiosBaseQuery;
