import { createApi } from "@reduxjs/toolkit/query/react";
import axiosBaseQuery from "./axiosBaseQuery";

const rawBaseQuery = axiosBaseQuery();

export const apiSlice = createApi({
  reducerPath: "api",
  baseQuery: rawBaseQuery,
  tagTypes: ["Auth", "Templates", "Jobs", "Architects"],
  endpoints: (builder) => ({
    customRequest: builder.query({
      query: ({ url, method = "GET", body }) => ({
        url,
        method,
        body,
      }),
    }),
    login: builder.mutation({
      query: (credentials) => ({
        url: "/admin/login",
        method: "POST",
        body: credentials,
      }),
    }),
    refreshToken: builder.mutation({
      query: () => ({
        url: "/admin/refresh-token",
        method: "POST",
      }),
    }),
    logout: builder.mutation({
      query: () => ({
        url: "/admin/logout",
        method: "POST",
      }),
    }),
    getMyProfile: builder.query({
      query: () => "/admin/my-profile",
      providesTags: ["Auth"],
    }),
    getArchitects: builder.query({
      query: () => "/admin/all-architects",
      providesTags: ["Architects"],
    }),
    getTemplates: builder.query({
      query: () => "/template",
      providesTags: ["Templates"],
    }),
    getTemplate: builder.query({
      query: (id) => `/template/${id}`,
      providesTags: (_result, _error, id) => [{ type: "Templates", id }],
    }),
    createTemplate: builder.mutation({
      query: (body) => ({
        url: "/template",
        method: "POST",
        body,
      }),
      invalidatesTags: ["Templates"],
    }),
    updateTemplate: builder.mutation({
      query: ({ id, body }) => ({
        url: `/template/${id}`,
        method: "PUT",
        body,
      }),
      invalidatesTags: (_result, _error, { id }) => [
        "Templates",
        { type: "Templates", id },
      ],
    }),
    deleteTemplate: builder.mutation({
      query: (id) => ({
        url: `/template/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["Templates"],
    }),
    syncTemplateStatus: builder.mutation({
      query: () => ({
        url: "/template/template/sync-status",
        method: "POST",
      }),
      invalidatesTags: ["Templates"],
    }),
    uploadHeaderImage: builder.mutation({
      query: (formData) => ({
        url: "/template/image/upload-header-image",
        method: "POST",
        body: formData,
      }),
    }),
    createBackgroundJob: builder.mutation({
      query: (body) => ({
        url: "/admin/create-background-job",
        method: "POST",
        body,
      }),
      invalidatesTags: ["Jobs"],
    }),
    getBackgroundJobs: builder.query({
      query: (params = {}) => ({
        url: "/admin/background-jobs",
        params,
      }),
      providesTags: ["Jobs"],
    }),
    getDashboardSummary: builder.query({
      query: () => "/admin/dashboard-summary",
      providesTags: ["Jobs"],
    }),
    getJobDetails: builder.query({
      query: ({ jobId, ...params }) => ({
        url: `/admin/job-details/${jobId}`,
        params,
      }),
      providesTags: (_result, _error, { jobId }) => [{ type: "Jobs", id: jobId }],
    }),
    jobAction: builder.mutation({
      query: ({ action, jobId }) => ({
        url: `/admin/${action}-job/${jobId}`,
        method: "POST",
        body: {},
      }),
      invalidatesTags: (_result, _error, { jobId }) => [
        "Jobs",
        { type: "Jobs", id: jobId },
      ],
    }),
    deleteJob: builder.mutation({
      query: (jobId) => ({
        url: `/admin/delete-job/${jobId}`,
        method: "DELETE",
      }),
      invalidatesTags: ["Jobs"],
    }),
  }),
});

export const {
  useLoginMutation,
  useRefreshTokenMutation,
  useLogoutMutation,
  useGetMyProfileQuery,
  useLazyGetMyProfileQuery,
  useGetArchitectsQuery,
  useLazyGetArchitectsQuery,
  useGetTemplatesQuery,
  useLazyGetTemplatesQuery,
  useGetTemplateQuery,
  useLazyGetTemplateQuery,
  useCreateTemplateMutation,
  useUpdateTemplateMutation,
  useDeleteTemplateMutation,
  useSyncTemplateStatusMutation,
  useUploadHeaderImageMutation,
  useCreateBackgroundJobMutation,
  useGetBackgroundJobsQuery,
  useLazyGetBackgroundJobsQuery,
  useGetDashboardSummaryQuery,
  useLazyGetDashboardSummaryQuery,
  useGetJobDetailsQuery,
  useLazyGetJobDetailsQuery,
  useJobActionMutation,
  useDeleteJobMutation,
} = apiSlice;
