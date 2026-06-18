import axios from 'axios';
import Cookies from 'js-cookie';
import toast from 'react-hot-toast';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

// Request interceptor — attach token
api.interceptors.request.use((config) => {
  const token = Cookies.get('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor — handle errors + refresh token
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;

    // 401 — try refresh
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      const refreshToken = Cookies.get('refreshToken');

      if (refreshToken) {
        try {
          const res = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
          const { accessToken, refreshToken: newRefresh } = res.data.data;

          Cookies.set('accessToken', accessToken, { expires: 1 });
          Cookies.set('refreshToken', newRefresh, { expires: 7 });

          original.headers.Authorization = `Bearer ${accessToken}`;
          return api(original);
        } catch {
          // Refresh failed — logout
          Cookies.remove('accessToken');
          Cookies.remove('refreshToken');
          window.location.href = '/login';
        }
      } else {
        window.location.href = '/login';
      }
    }

    // Show error toast
    const message = error.response?.data?.message || 'Something went wrong';
    if (error.response?.status !== 401) {
      toast.error(message);
    }

    return Promise.reject(error);
  }
);

export default api;

// ─── API Functions ─────────────────────────────────────────

export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
  refresh: (refreshToken: string) =>
    api.post('/auth/refresh', { refreshToken }),
};

export const usersApi = {
  getAll: (params?: object) => api.get('/users', { params }),
  getOne: (id: string) => api.get(`/users/${id}`),
  create: (data: object) => api.post('/users', data),
  update: (id: string, data: object) => api.patch(`/users/${id}`, data),
  delete: (id: string) => api.delete(`/users/${id}`),
  getStats: () => api.get('/users/stats'),
};

export const attendanceApi = {
  checkIn: (data: object) => api.post('/attendance/checkin', data),
  checkOut: (data?: object) => api.post('/attendance/checkout', data || {}),
  today: () => api.get('/attendance/today'),
  getAll: (params?: object) => api.get('/attendance', { params }),
  summary: (date?: string) => api.get('/attendance/summary', { params: { date } }),
  monthlyReport: (params: object) => api.get('/attendance/report/monthly', { params }),
};

export const sessionsApi = {
  getMine: () => api.get('/sessions/me'),
  getAll: () => api.get('/sessions'),
  getLive: () => api.get('/sessions/live'),
  forceLogout: (sessionId: string) => api.delete(`/sessions/${sessionId}`),
  forceLogoutAll: (userId: string) =>
    api.post('/sessions/force-logout-all', { userId }),
};

export const activityApi = {
  getAll: (params?: object) => api.get('/activity', { params }),
  getSummary: (days?: number) => api.get('/activity/summary', { params: { days } }),
  getChart: (days?: number) => api.get('/activity/chart', { params: { days } }),
  getFailedLogins: () => api.get('/activity/failed-logins'),
};

export const aiApi = {
  health: () => api.get('/ai/health'),
  registerFace: (imageBase64: string) =>
    api.post('/ai/face/register', { imageBase64 }),
  getFaceStatus: () => api.get('/ai/face/status'),
  checkLiveness: (frames: string[]) => api.post('/ai/liveness', { frames }),
  faceLogin: (imageBase64: string, livenessFrames: string[]) =>
    api.post('/ai/face/login', { imageBase64, livenessFrames }),
};
