export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || 'ZeroProxy';
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0';

export const COOKIE_KEYS = {
  ACCESS_TOKEN: 'accessToken',
  REFRESH_TOKEN: 'refreshToken',
} as const;

export const ROLES = {
  ADMIN: 'ADMIN',
  HR: 'HR',
  EMPLOYEE: 'EMPLOYEE',
} as const;

export const ROUTES = {
  LOGIN: '/login',
  ROOT: '/',
  EMPLOYEE_DASHBOARD: '/employee/dashboard',
  ADMIN_DASHBOARD: '/admin/dashboard',
} as const;
