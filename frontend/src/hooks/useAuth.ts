'use client';
import { useAuthStore } from '@/store/auth.store';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/api';
import toast from 'react-hot-toast';

export function useAuth() {
  const { user, isAuthenticated, setAuth, clearAuth } = useAuthStore();
  const router = useRouter();

  const login = async (email: string, password: string) => {
    try {
      const res = await authApi.login(email, password);
      const { user, accessToken, refreshToken } = res.data.data;
      setAuth(user, accessToken, refreshToken);

      toast.success(`Welcome back, ${user.name}!`);

      // Redirect based on role
      if (user.role === 'ADMIN' || user.role === 'HR') {
        router.push('/admin/dashboard');
      } else {
        router.push('/employee/dashboard');
      }

      return { success: true };
    } catch (err) {
      const error = err as { response?: { data?: { message?: string } } };
      return {
        success: false,
        message: error.response?.data?.message || 'Login failed',
      };
    }
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch {
      // ignore
    } finally {
      clearAuth();
      router.push('/login');
      toast.success('Logged out successfully');
    }
  };

  return { user, isAuthenticated, login, logout };
}
