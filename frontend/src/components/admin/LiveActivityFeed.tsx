'use client';
import { useEffect, useState } from 'react';
import { Circle, LogIn, LogOut, Clock, UserPlus, ShieldAlert } from 'lucide-react';
import { getAdminSocket } from '@/app/admin/layout';

interface FeedEvent {
  id: string;
  type: string;
  message: string;
  timestamp: string;
}

const eventConfig: Record<string, { icon: any; color: string }> = {
  'employee:checkin': { icon: Clock, color: 'text-success bg-success-50' },
  'employee:checkout': { icon: Clock, color: 'text-primary bg-primary-50' },
  'user:login': { icon: LogIn, color: 'text-secondary bg-secondary/10' },
  'user:logout': { icon: LogOut, color: 'text-slate-500 bg-slate-100' },
  'user:created': { icon: UserPlus, color: 'text-accent bg-cyan-50' },
  'session:force-logout': { icon: ShieldAlert, color: 'text-red-500 bg-red-50' },
};

export function LiveActivityFeed() {
  const [events, setEvents] = useState<FeedEvent[]>([]);

  useEffect(() => {
    const socket = getAdminSocket();
    if (!socket) return;

    const handlers: Record<string, (data: any) => void> = {
      'employee:checkin': (d) => addEvent('employee:checkin', `${d.userName} checked in`),
      'employee:checkout': (d) => addEvent('employee:checkout', `${d.userName} checked out (${d.totalHours}h)`),
      'user:login': (d) => addEvent('user:login', `${d.userName} logged in`),
      'user:logout': (d) => addEvent('user:logout', `${d.userName} logged out`),
      'user:created': (d) => addEvent('user:created', `New employee added: ${d.userName}`),
      'session:force-logout': (d) => addEvent('session:force-logout', `Session terminated for ${d.targetUserName}`),
    };

    const addEvent = (type: string, message: string) => {
      setEvents((prev) => [
        { id: `${Date.now()}-${Math.random()}`, type, message, timestamp: new Date().toISOString() },
        ...prev.slice(0, 19),
      ]);
    };

    Object.entries(handlers).forEach(([event, handler]) => {
      socket.on(event, handler);
    });

    return () => {
      Object.keys(handlers).forEach((event) => socket.off(event));
    };
  }, []);

  return (
    <div className="zp-card space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-text-main flex items-center gap-2">
          Live Activity
          <span className="flex items-center gap-1 text-xs text-success font-normal">
            <Circle className="w-2 h-2 fill-success animate-pulse" />
            Live
          </span>
        </h3>
      </div>

      <div className="space-y-2 max-h-96 overflow-y-auto">
        {events.length === 0 ? (
          <div className="text-center py-8">
            <Circle className="w-8 h-8 text-slate-200 mx-auto mb-2" />
            <p className="text-sm text-slate-400">Waiting for activity...</p>
            <p className="text-xs text-slate-300 mt-1">Events will appear here in real-time</p>
          </div>
        ) : (
          events.map((e) => {
            const config = eventConfig[e.type] || { icon: Circle, color: 'text-slate-500 bg-slate-100' };
            const Icon = config.icon;
            return (
              <div key={e.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-background transition-colors animate-fade-in">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${config.color}`}>
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-text-main truncate">{e.message}</p>
                  <p className="text-xs text-slate-400">
                    {new Date(e.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
