import { store } from "../store/store";

const FALLBACK_KEY = "selectedUsers";

const getScopedKey = () => {
  const email = store.getState().auth.user?.email?.trim()?.toLowerCase();
  return email ? `selectedUsers:${email}` : FALLBACK_KEY;
};

export const getSelectedUsers = () => {
  try {
    return JSON.parse(localStorage.getItem(getScopedKey())) || [];
  } catch {
    return [];
  }
};

export const setSelectedUsers = (users) => {
  localStorage.setItem(getScopedKey(), JSON.stringify(users));
};

export const clearSelectedUsers = () => {
  localStorage.removeItem(getScopedKey());
  localStorage.removeItem(FALLBACK_KEY);
};
