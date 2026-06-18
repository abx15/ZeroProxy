'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { Spinner } from '@/components/ui/Spinner';
import { io, Socket } from 'socket.io-client';
import Cookies from 'js-cookie';
import toast from 'react-hot-toast';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001';

// Global socket instance accessible to all admin pages via context-like pattern
let globalSocket: Socket | null = null;
export function getAdminSocket() {
  return globalSocket;
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isAuthenticated, user } = useAuthStore();
  const [socketConnected, setSocketConnected] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    if (user && user.role !== 'ADMIN' && user.role !== 'HR') {
      router.push('/employee/dashboard');
      return;
    }

    const token = Cookies.get('accessToken');
    if (!token) return;

    globalSocket = io(`${WS_URL}/events`, {
      auth: { token },
      transports: ['websocket'],
    });

    globalSocket.on('connect', () => setSocketConnected(true));
    globalSocket.on('disconnect', () => setSocketConnected(false));

    globalSocket.on('employee:checkin', (data) => {
      toast.success(`${data.userName} checked in`, { icon: '🟢' });
    });
    globalSocket.on('employee:checkout', (data) => {
      toast(`${data.userName} checked out`, { icon: '🔵' });
    });
    globalSocket.on('user:login', (data) => {
      toast(`${data.userName} logged in`, { icon: '👤' });
    });
    globalSocket.on('session:force-logout', (data) => {
      toast(`Session terminated for ${data.targetUserName}`, { icon: '⚠️' });
    });

    return () => {
      globalSocket?.disconnect();
    };
  }, [isAuthenticated, user]);

  if (!isAuthenticated || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <AdminSidebar socketConnected={socketConnected} />
      <main className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto p-4 md:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
