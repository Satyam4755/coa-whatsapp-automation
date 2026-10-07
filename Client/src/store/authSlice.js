import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  accessToken: null,
  user: null,
  isInitialized: false,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setCredentials: (state, action) => {
      state.accessToken = action.payload.accessToken;
      state.user = action.payload.user || state.user;
      state.isInitialized = true;
    },
    clearCredentials: (state) => {
      state.accessToken = null;
      state.user = null;
      state.isInitialized = true;
    },
    markInitialized: (state) => {
      state.isInitialized = true;
    },
  },
});

export const { setCredentials, clearCredentials, markInitialized } =
  authSlice.actions;

export const selectAccessToken = (state) => state.auth.accessToken;
export const selectCurrentUser = (state) => state.auth.user;
export const selectIsAuthInitialized = (state) => state.auth.isInitialized;

export default authSlice.reducer;
