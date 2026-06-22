'use client';
import { useState, useEffect } from 'react';
import { Activity, LogIn, LogOut, Clock, UserPlus, ShieldAlert, AlertTriangle } from 'lucide-react';
import { activityApi } from '@/lib/api';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import toast from 'react-hot-toast';

const actionConfig: Record<string, { icon: any; color: string; label: string }> = {
  LOGIN: { icon: LogIn, color: 'text-success bg-success-50', label: 'Login' },
  LOGOUT: { icon: LogOut, color: 'text-slate-500 bg-slate-100', label: 'Logout' },
  LOGIN_FAILED: { icon: AlertTriangle, color: 'text-red-500 bg-red-50', label: 'Failed Login' },
  CHECK_IN: { icon: Clock, color: 'text-primary bg-primary-50', label: 'Check In' },
  CHECK_OUT: { icon: Clock, color: 'text-secondary bg-secondary/10', label: 'Check Out' },
  USER_CREATED: { icon: UserPlus, color: 'text-accent bg-cyan-50', label: 'User Created' },
  SESSION_FORCE_LOGOUT: { icon: ShieldAlert, color: 'text-red-500 bg-red-50', label: 'Force Logout' },
};

export default function ActivityLogsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [meta, setMeta] = useState<any>(null);
  const [summary, setSummary] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState('');

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [logsRes, summaryRes] = await Promise.all([
        activityApi.getAll({ page, limit: 15, action: actionFilter || undefined }),
        activityApi.getSummary(7),
      ]);
      setLogs(logsRes.data.data.data);
      setMeta(logsRes.data.data.meta);
      setSummary(summaryRes.data.data);
    } catch {
      toast.error('Failed to load activity logs');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [page, actionFilter]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-text-main">Activity Logs</h1>
        <p className="text-slate-500 text-sm mt-0.5">Complete audit trail of all actions</p>
      </div>

      {/* Summary chips */}
      {summary && (
        <div className="flex gap-3 flex-wrap">
          {summary.actions.slice(0, 6).map((a: any) => (
            <button
              key={a.action}
              onClick={() => { setActionFilter(actionFilter === a.action ? '' : a.action); setPage(1); }}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-all ${
                actionFilter === a.action
                  ? 'bg-primary text-white border-primary'
                  : 'bg-card border-border hover:border-primary/30'
              }`}
            >
              <span className="text-xs font-medium">{actionConfig[a.action]?.label || a.action}</span>
              <span className={`text-xs font-bold ${actionFilter === a.action ? 'text-white' : 'text-primary'}`}>
                {a.total}
              </span>
            </button>
          ))}
          {actionFilter && (
            <button onClick={() => setActionFilter('')} className="text-xs text-slate-400 hover:text-red-500 px-2">
              Clear filter
            </button>
          )}
        </div>
      )}

      {/* Logs list */}
      <div className="zp-card space-y-2">
        {isLoading ? (
          <div className="flex justify-center py-10"><Spinner /></div>
        ) : logs.length === 0 ? (
          <div className="text-center py-10">
            <Activity className="w-10 h-10 text-slate-200 mx-auto mb-2" />
            <p className="text-sm text-slate-400">No activity logs found</p>
          </div>
        ) : (
          logs.map((log: any) => {
            const config = actionConfig[log.action] || { icon: Activity, color: 'text-slate-500 bg-slate-100', label: log.action };
            const Icon = config.icon;
            return (
              <div key={log._id} className="flex items-center justify-between p-3 rounded-xl hover:bg-background transition-colors">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${config.color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-text-main">
                      {config.label} — {log.userName}
                    </p>
                    <p className="text-xs text-slate-400">
                      {log.userEmail} · {log.ipAddress}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <Badge variant={log.status === 'SUCCESS' ? 'success' : 'error'}>
                    {log.status}
                  </Badge>
                  <p className="text-xs text-slate-400 mt-1">
                    {new Date(log.createdAt).toLocaleString('en-IN', {
                      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                    })}
                  </p>
                </div>
              </div>
            );
          })
        )}

        {meta && meta.totalPages > 1 && (
          <div className="flex items-center justify-between pt-3 border-t border-border">
            <p className="text-xs text-slate-400">Page {meta.page} of {meta.totalPages}</p>
            <div className="flex gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                className="zp-btn-secondary text-xs px-3 py-1.5 disabled:opacity-40">Prev</button>
              <button onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))} disabled={page === meta.totalPages}
                className="zp-btn-secondary text-xs px-3 py-1.5 disabled:opacity-40">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
