'use client';
import { useState, useEffect } from 'react';
import { Clock, Calendar, TrendingUp, CheckCircle2, Timer, AlertCircle } from 'lucide-react';
import { attendanceApi } from '@/lib/api';
import { StatsCard } from '@/components/admin/StatsCard';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { useAuthStore } from '@/store/auth.store';
import { formatTime, formatDate, formatHours } from '@/lib/utils';
import toast from 'react-hot-toast';

export default function EmployeeDashboardPage() {
  const { user } = useAuthStore();
  const [todayStatus, setTodayStatus] = useState<any>(null);
  const [monthlyReport, setMonthlyReport] = useState<any>(null);
  const [recentAttendance, setRecentAttendance] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCheckingIn, setIsCheckingIn] = useState(false);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const now = new Date();
      const [todayRes, reportRes, recentRes] = await Promise.all([
        attendanceApi.today(),
        attendanceApi.monthlyReport({
          month: now.getMonth() + 1,
          year: now.getFullYear(),
        }),
        attendanceApi.getAll({ page: 1, limit: 5 }),
      ]);
      setTodayStatus(todayRes.data.data);
      setMonthlyReport(reportRes.data.data);
      setRecentAttendance(recentRes.data.data.data || []);
    } catch {
      toast.error('Failed to load attendance data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleCheckIn = async () => {
    setIsCheckingIn(true);
    try {
      await attendanceApi.checkIn({
        deviceInfo: `${navigator.userAgent.split(' ').slice(-1)[0]} / Web`,
        verificationMethod: 'PIN_FALLBACK',
      });
      toast.success('Checked in successfully!');
      loadData();
    } catch {
      // API client interceptor already triggers error toast
    } finally {
      setIsCheckingIn(false);
    }
  };

  const handleCheckOut = async () => {
    setIsCheckingIn(true);
    try {
      await attendanceApi.checkOut();
      toast.success('Checked out successfully!');
      loadData();
    } catch {
      // API client interceptor already triggers error toast
    } finally {
      setIsCheckingIn(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  const isCheckedIn = todayStatus?.status === 'CHECKED_IN';
  const isCheckedOut = todayStatus?.status === 'CHECKED_OUT';
  const notCheckedIn = todayStatus?.status === 'NOT_CHECKED_IN';

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-text-main">
          Good {getGreeting()}, {user?.name?.split(' ')[0]}!
        </h1>
        <p className="text-slate-500 text-sm mt-0.5">
          {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* Check-in Card */}
      <div className={`zp-card border-2 ${
        isCheckedIn ? 'border-success/30 bg-success-50/30' :
        isCheckedOut ? 'border-primary/20' :
        'border-amber-200 bg-amber-50/30'
      }`}>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
              isCheckedIn ? 'bg-success text-white' :
              isCheckedOut ? 'bg-primary-50 text-primary' :
              'bg-amber-100 text-amber-600'
            }`}>
              {isCheckedIn ? <Timer className="w-7 h-7" /> :
               isCheckedOut ? <CheckCircle2 className="w-7 h-7" /> :
               <AlertCircle className="w-7 h-7" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="font-semibold text-text-main">
                  {isCheckedIn ? 'Currently Working' :
                   isCheckedOut ? "Today's Work Done" :
                   'Not Checked In Yet'}
                </p>
                <Badge variant={isCheckedIn ? 'success' : isCheckedOut ? 'info' : 'warning'}>
                  {todayStatus?.status?.replace('_', ' ')}
                </Badge>
              </div>
              {isCheckedIn && todayStatus.record && (
                <p className="text-sm text-slate-500 mt-0.5">
                  Since {formatTime(todayStatus.record.checkIn)} ·{' '}
                  <span className="text-success font-medium">{todayStatus.record.liveHours || '0h'} elapsed</span>
                </p>
              )}
              {isCheckedOut && todayStatus.record && (
                <p className="text-sm text-slate-500 mt-0.5">
                  {formatTime(todayStatus.record.checkIn)} → {formatTime(todayStatus.record.checkOut)} ·{' '}
                  <span className="text-primary font-medium">{formatHours(todayStatus.record.totalHours)}</span>
                </p>
              )}
              {notCheckedIn && (
                <p className="text-sm text-slate-500 mt-0.5">Tap check in to start your day</p>
              )}
            </div>
          </div>

          {/* Action Button */}
          {!isCheckedOut && (
            <button
              onClick={isCheckedIn ? handleCheckOut : handleCheckIn}
              disabled={isCheckingIn}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm transition-all active:scale-95 cursor-pointer ${
                isCheckedIn
                  ? 'bg-red-500 hover:bg-red-600 text-white shadow-sm'
                  : 'bg-success hover:bg-success-600 text-white shadow-sm'
              }`}
            >
              {isCheckingIn ? <Spinner size="sm" /> : <Clock className="w-4 h-4" />}
              {isCheckedIn ? 'Check Out' : 'Check In'}
            </button>
          )}
        </div>
      </div>

      {/* Monthly Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatsCard
          label="Days Present"
          value={monthlyReport?.summary?.workingDays ?? 0}
          icon={Calendar}
          color="primary"
          sub="This month"
        />
        <StatsCard
          label="Total Hours"
          value={monthlyReport?.summary?.totalHours ? `${monthlyReport.summary.totalHours}h` : '0h'}
          icon={Clock}
          color="success"
          sub="This month"
        />
        <StatsCard
          label="Avg Hours/Day"
          value={monthlyReport?.summary?.avgHoursPerDay ? `${monthlyReport.summary.avgHoursPerDay}h` : '0h'}
          icon={TrendingUp}
          color="accent"
          sub="This month"
        />
      </div>

      {/* Recent Attendance */}
      <div className="zp-card space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-text-main">Recent Attendance</h3>
          <a href="/employee/attendance" className="text-xs text-primary hover:underline">View all</a>
        </div>

        {recentAttendance.length === 0 ? (
          <div className="text-center py-8">
            <Clock className="w-10 h-10 text-slate-200 mx-auto mb-2" />
            <p className="text-sm text-slate-400">No attendance records yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {recentAttendance.map((record: any) => (
              <div key={record.id}
                className="flex items-center justify-between py-3 border-b border-border last:border-0">
                <div>
                  <p className="text-sm font-medium text-text-main">{formatDate(record.checkIn)}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {formatTime(record.checkIn)}
                    {record.checkOut && ` → ${formatTime(record.checkOut)}`}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-text-main">{formatHours(record.totalHours)}</p>
                  <Badge variant={record.checkOut ? 'success' : 'warning'} className="mt-1">
                    {record.checkOut ? 'Complete' : 'Active'}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}
