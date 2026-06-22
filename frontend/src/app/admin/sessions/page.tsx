'use client';
import { useState, useEffect } from 'react';
import { Monitor, MapPin, Clock, XCircle, RefreshCw } from 'lucide-react';
import { sessionsApi } from '@/lib/api';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import toast from 'react-hot-toast';

export default function SessionsPage() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [liveStats, setLiveStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [terminating, setTerminating] = useState<string | null>(null);

  const loadSessions = async () => {
    try {
      setIsLoading(true);
      const [sessionsRes, liveRes] = await Promise.all([
        sessionsApi.getAll(),
        sessionsApi.getLive(),
      ]);
      setSessions(sessionsRes.data.data.sessions);
      setLiveStats(liveRes.data.data);
    } catch {
      toast.error('Failed to load sessions');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadSessions(); }, []);

  const handleTerminate = async (sessionId: string) => {
    if (!confirm('Terminate this session? The user will be logged out immediately.')) return;
    setTerminating(sessionId);
    try {
      await sessionsApi.forceLogout(sessionId);
      toast.success('Session terminated');
      loadSessions();
    } catch {
    } finally {
      setTerminating(null);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text-main">Active Sessions</h1>
          <p className="text-slate-500 text-sm mt-0.5">Monitor devices and active logins</p>
        </div>
        <button onClick={loadSessions} className="zp-btn-secondary flex items-center gap-2">
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Live Stats */}
      <div className="grid grid-cols-2 gap-4 max-w-md">
        <div className="zp-card text-center">
          <p className="text-2xl font-bold text-success">{liveStats?.onlineNow ?? 0}</p>
          <p className="text-xs text-slate-500 mt-1">Online Now (5 min)</p>
        </div>
        <div className="zp-card text-center">
          <p className="text-2xl font-bold text-primary">{liveStats?.activeSessions ?? 0}</p>
          <p className="text-xs text-slate-500 mt-1">Total Active Sessions</p>
        </div>
      </div>

      {/* Sessions List */}
      <div className="zp-card space-y-2">
        {isLoading ? (
          <div className="flex justify-center py-10"><Spinner /></div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-10">
            <Monitor className="w-10 h-10 text-slate-200 mx-auto mb-2" />
            <p className="text-sm text-slate-400">No active sessions</p>
          </div>
        ) : (
          sessions.map((s: any) => (
            <div key={s.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-background transition-colors">
              <div className="flex items-center gap-3">
                <Avatar name={s.user?.name || 'U'} size="md" />
                <div>
                  <p className="text-sm font-medium text-text-main">{s.user?.name}</p>
                  <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
                    <span className="flex items-center gap-1">
                      <Monitor className="w-3 h-3" />
                      {s.deviceInfo?.split(' ').slice(0, 3).join(' ') || 'Unknown device'}
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {s.ipAddress}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-xs text-slate-400 flex items-center gap-1 justify-end">
                    <Clock className="w-3 h-3" />
                    Active {new Date(s.lastActivity).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                  <Badge variant={s.user?.role === 'ADMIN' ? 'error' : s.user?.role === 'HR' ? 'warning' : 'info'} className="mt-1">
                    {s.user?.role}
                  </Badge>
                </div>
                <button
                  onClick={() => handleTerminate(s.id)}
                  disabled={terminating === s.id}
                  className="p-2 rounded-lg hover:bg-red-50 text-red-500 transition-colors"
                  title="Terminate session"
                >
                  {terminating === s.id ? <Spinner size="sm" /> : <XCircle className="w-4 h-4" />}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
