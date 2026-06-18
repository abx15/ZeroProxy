'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { Spinner } from '@/components/ui/Spinner';

export default function RootPage() {
  const router = useRouter();
  const { isAuthenticated, user } = useAuthStore();

  useEffect(() => {
    if (isAuthenticated && user) {
      if (user.role === 'ADMIN' || user.role === 'HR') {
        router.push('/admin/dashboard');
      } else {
        router.push('/employee/dashboard');
      }
    } else {
      router.push('/login');
    }
  }, [isAuthenticated, user]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
          <span className="text-white font-bold text-xl">Z</span>
        </div>
        <Spinner size="md" />
        <p className="text-sm text-slate-500">Loading ZeroProxy...</p>
      </div>
    </div>
  );
}
