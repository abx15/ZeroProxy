export type Role = 'ADMIN' | 'HR' | 'EMPLOYEE';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  companyId: string;
  faceRegistered: boolean;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  timestamp: string;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AttendanceRecord {
  id: string;
  userId: string;
  checkIn: string;
  checkOut: string | null;
  totalHours: number | null;
  ipAddress: string;
  deviceInfo: string;
  verificationMethod: 'FACE' | 'PIN_FALLBACK';
  createdAt: string;
  user?: {
    id: string;
    name: string;
    email: string;
  };
}

export interface Session {
  id: string;
  deviceInfo: string;
  ipAddress: string;
  lastActivity: string;
  expiresAt: string;
  createdAt: string;
  user?: {
    id: string;
    name: string;
    email: string;
    role: Role;
  };
}

export interface ActivityLog {
  _id: string;
  userId: string;
  userEmail: string;
  userName: string;
  action: string;
  status: 'SUCCESS' | 'FAILED';
  metadata: Record<string, unknown>;
  ipAddress: string;
  deviceInfo: string;
  createdAt: string;
}

export interface DailySummary {
  date: string;
  summary: {
    totalEmployees: number;
    present: number;
    absent: number;
    currentlyCheckedIn: number;
    checkedOut: number;
    averageHours: number;
  };
  records: Array<{
    userId: string;
    name: string;
    email: string;
    checkIn: string;
    checkOut: string | null;
    totalHours: number | null;
    status: 'CHECKED_IN' | 'CHECKED_OUT';
  }>;
}
