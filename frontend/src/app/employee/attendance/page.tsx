'use client';
import { useState, useEffect } from 'react';
import { Calendar, Clock } from 'lucide-react';
import { attendanceApi } from '@/lib/api';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { formatDate, formatTime, formatHours } from '@/lib/utils';
import toast from 'react-hot-toast';

export default function AttendancePage() {
  const [records, setRecords] = useState<any[]>([]);
  const [meta, setMeta] = useState<any>(null);
  const [monthlyReport, setMonthlyReport] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);

  const now = new Date();
  const [selectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear] = useState(now.getFullYear());

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [recordsRes, reportRes] = await Promise.all([
        attendanceApi.getAll({ page, limit: 10 }),
        attendanceApi.monthlyReport({ month: selectedMonth, year: selectedYear }),
      ]);
      setRecords(recordsRes.data.data.data || []);
      setMeta(recordsRes.data.data.meta);
      setMonthlyReport(reportRes.data.data);
    } catch {
      toast.error('Failed to load attendance');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [page]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text-main">My Attendance</h1>
          <p className="text-slate-500 text-sm mt-0.5">Your attendance history and monthly report</p>
        </div>
      </div>

      {/* Monthly Summary Cards */}
      {monthlyReport && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Working Days', value: monthlyReport.summary?.workingDays ?? 0, color: 'bg-primary-50 text-primary' },
            { label: 'Total Hours', value: monthlyReport.summary?.totalHours ? `${monthlyReport.summary.totalHours}h` : '0h', color: 'bg-success-50 text-success' },
            { label: 'Avg Per Day', value: monthlyReport.summary?.avgHoursPerDay ? `${monthlyReport.summary.avgHoursPerDay}h` : '0h', color: 'bg-cyan-50 text-accent' },
          ].map((s) => (
            <div key={s.label} className="zp-card text-center">
              <p className={`text-2xl font-bold ${s.color.split(' ')[1]}`}>{s.value}</p>
              <p className="text-xs text-slate-500 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Records Table */}
      <div className="zp-card space-y-4">
        <h3 className="font-semibold text-text-main">Attendance Records</h3>

        {isLoading ? (
          <div className="flex justify-center py-10"><Spinner /></div>
        ) : records.length === 0 ? (
          <div className="text-center py-10">
            <Calendar className="w-10 h-10 text-slate-200 mx-auto mb-2" />
            <p className="text-sm text-slate-400">No records found</p>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {records.map((r: any) => (
                <div key={r.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-background border border-border hover:border-primary/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-primary-50 flex items-center justify-center shrink-0">
                      <Clock className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-text-main">{formatDate(r.checkIn)}</p>
                      <p className="text-xs text-slate-400">
                        {formatTime(r.checkIn)}{r.checkOut ? ` → ${formatTime(r.checkOut)}` : ' (active)'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="text-sm font-semibold text-text-main">{formatHours(r.totalHours)}</p>
                    <Badge variant={r.checkOut ? 'success' : 'warning'}>
                      {r.checkOut ? 'Done' : 'Active'}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {meta && meta.totalPages > 1 && (
              <div className="flex items-center justify-between pt-2">
                <p className="text-xs text-slate-400">
                  {meta.total} records · Page {meta.page} of {meta.totalPages}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="zp-btn-secondary text-xs px-3 py-1.5 disabled:opacity-40 cursor-pointer"
                  >
                    Prev
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
                    disabled={page === meta.totalPages}
                    className="zp-btn-secondary text-xs px-3 py-1.5 disabled:opacity-40 cursor-pointer"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
