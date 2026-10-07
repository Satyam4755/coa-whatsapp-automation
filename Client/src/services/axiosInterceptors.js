import { clearCredentials, setCredentials } from "../store/authSlice";
import axiosInstance from "./axiosInstance";

let interceptorIds = null;

const isAuthRoute = (url = "") =>
  url.includes("/admin/login") || url.includes("/admin/refresh-token");

export const setupAxiosInterceptors = (store) => {
  if (interceptorIds) {
    axiosInstance.interceptors.request.eject(interceptorIds.request);
    axiosInstance.interceptors.response.eject(interceptorIds.response);
  }

  const request = axiosInstance.interceptors.request.use((config) => {
    const token = store.getState().auth.accessToken;

    if (token && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  });

  const response = axiosInstance.interceptors.response.use(
    (res) => res,
    async (error) => {
      const originalRequest = error.config;

      if (
        error.response?.status !== 401 ||
        !originalRequest ||
        originalRequest._retry ||
        originalRequest.skipAuthRefresh ||
        isAuthRoute(originalRequest.url)
      ) {
        return Promise.reject(error);
      }

      originalRequest._retry = true;

      try {
        const refreshResponse = await axiosInstance.post(
          "/admin/refresh-token",
          {},
          { skipAuthRefresh: true }
        );

        store.dispatch(setCredentials(refreshResponse.data));

        originalRequest.headers.Authorization = `Bearer ${refreshResponse.data.accessToken}`;
        return axiosInstance(originalRequest);
      } catch (refreshError) {
        store.dispatch(clearCredentials());
        return Promise.reject(refreshError);
      }
    }
  );

  interceptorIds = { request, response };
};
