import axios from 'axios';

// Create axios instance with base URL from environment
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
});

// Add auth token to every request automatically
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 responses (expired/invalid token)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      // Redirect to root if not already there
      if (window.location.pathname !== '/' || (window.location.hash && window.location.hash !== '#/')) {
        window.location.href = '/';
      }
    }
    return Promise.reject(error);
  }
);

// ============ Auth API ============
export const authAPI = {
  register: (data) => api.post('/api/auth/register', data),
  login: (data) => api.post('/api/auth/login', data),
  getMe: () => api.get('/api/auth/me'),
};

// ============ Groups API ============
export const groupsAPI = {
  create: (data) => api.post('/api/groups', data),
  list: () => api.get('/api/groups'),
  get: (id) => api.get(`/api/groups/${id}`),
  addMember: (groupId, data) => api.post(`/api/groups/${groupId}/members`, data),
  updateMember: (groupId, userId, data) => api.patch(`/api/groups/${groupId}/members/${userId}`, data),
};

// ============ Expenses API ============
export const expensesAPI = {
  create: (groupId, data) => api.post(`/api/groups/${groupId}/expenses`, data),
  list: (groupId) => api.get(`/api/groups/${groupId}/expenses`),
  get: (groupId, expenseId) => api.get(`/api/groups/${groupId}/expenses/${expenseId}`),
  delete: (groupId, expenseId) => api.delete(`/api/groups/${groupId}/expenses/${expenseId}`),
};

// ============ Balances API ============
export const balancesAPI = {
  getGroupBalances: (groupId) => api.get(`/api/groups/${groupId}/balances`),
  getUserBalance: (groupId, userId) => api.get(`/api/groups/${groupId}/balances/${userId}`),
};

// ============ Settlements API ============
export const settlementsAPI = {
  create: (groupId, data) => api.post(`/api/groups/${groupId}/settlements`, data),
  list: (groupId) => api.get(`/api/groups/${groupId}/settlements`),
};

// ============ Import API ============
export const importAPI = {
  upload: (groupId, formData) => api.post(`/api/groups/${groupId}/import`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  confirm: (groupId, data) => api.post(`/api/groups/${groupId}/import/confirm`, data),
  getReports: (groupId) => api.get(`/api/groups/${groupId}/import/reports`),
};

export default api;
