import api, { clearAuthState } from '../services/api';

export const logout = async (navigate) => {
  try {
    await api.post('/admin/logout', {}, { skipAuthRefresh: true });
  } catch (error) {
    console.error('Logout request failed:', error);
  }

  clearAuthState();
  navigate('/');

  console.log('User logged out successfully');
};
