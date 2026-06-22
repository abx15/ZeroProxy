'use client';
import { useState, useEffect } from 'react';
import { Users, UserCheck, UserX, Clock, Activity as ActivityIcon } from 'lucide-react';
import { usersApi, attendanceApi, sessionsApi } from '@/lib/api';
import { StatsCard } from '@/components/admin/StatsCard';
import { LiveActivityFeed } from '@/components/admin/LiveActivityFeed';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { formatTime } from '@/lib/utils';
import toast from 'react-hot-toast';

interface UserStats {
  total: number;
  active: number;
}

interface DailySummary {
  summary: {
    present: number;
    totalEmployees: number;
    absent: number;
    averageHours: number;
  };
  records: Array<{
    userId: string;
    name: string;
    email: string;
    checkIn: string;
    checkOut: string | null;
    status: 'CHECKED_IN' | 'CHECKED_OUT';
  }>;
}

interface LiveStats {
  onlineNow: number;
}

export default function AdminDashboardPage() {
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [dailySummary, setDailySummary] = useState<DailySummary | null>(null);
  const [liveStats, setLiveStats] = useState<LiveStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async () => {
    try {
      const [statsRes, summaryRes, liveRes] = await Promise.all([
        usersApi.getStats(),
        attendanceApi.summary(),
        sessionsApi.getLive(),
      ]);
      setUserStats(statsRes.data.data);
      setDailySummary(summaryRes.data.data);
      setLiveStats(liveRes.data.data);
    } catch {
      toast.error('Failed to load dashboard data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    Promise.resolve().then(() => {
      loadData();
    });
    const interval = setInterval(() => {
      Promise.resolve().then(() => {
        loadData();
      });
    }, 30000); // refresh every 30s
    return () => clearInterval(interval);
  }, []);

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><Spinner size="lg" /></div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text-main">Dashboard Overview</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <Badge variant="success">
          <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
          {liveStats?.onlineNow ?? 0} online now
        </Badge>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatsCard label="Total Employees" value={userStats?.total ?? 0} icon={Users} color="primary" sub={`${userStats?.active ?? 0} active`} />
        <StatsCard label="Present Today" value={dailySummary?.summary?.present ?? 0} icon={UserCheck} color="success" sub={`of ${dailySummary?.summary?.totalEmployees ?? 0}`} />
        <StatsCard label="Absent Today" value={dailySummary?.summary?.absent ?? 0} icon={UserX} color="warning" />
        <StatsCard label="Avg Hours" value={`${dailySummary?.summary?.averageHours ?? 0}h`} icon={Clock} color="accent" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Today&apos;s records */}
        <div className="lg:col-span-2 zp-card space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-text-main">Today&apos;s Attendance</h3>
            <a href="/admin/attendance" className="text-xs text-primary hover:underline">View all</a>
          </div>

          {dailySummary?.records?.length === 0 ? (
            <div className="text-center py-10">
              <ActivityIcon className="w-10 h-10 text-slate-200 mx-auto mb-2" />
              <p className="text-sm text-slate-400">No attendance recorded today</p>
            </div>
          ) : (
            <div className="space-y-2">
              {dailySummary?.records?.slice(0, 8).map((r) => (
                <div key={r.userId} className="flex items-center justify-between py-2.5 border-b border-border last:border-0">
                  <div>
                    <p className="text-sm font-medium text-text-main">{r.name}</p>
                    <p className="text-xs text-slate-400">{r.email}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-500">
                      {formatTime(r.checkIn)}{r.checkOut ? ` - ${formatTime(r.checkOut)}` : ''}
                    </p>
                    <Badge variant={r.status === 'CHECKED_IN' ? 'success' : 'info'} className="mt-1">
                      {r.status === 'CHECKED_IN' ? 'Working' : 'Done'}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Live Activity Feed */}
        <LiveActivityFeed />
      </div>
    </div>
  );
}
