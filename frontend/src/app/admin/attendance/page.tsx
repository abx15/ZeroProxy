'use client';
import { useState, useEffect } from 'react';
import { Calendar } from 'lucide-react';
import { attendanceApi } from '@/lib/api';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { formatDate, formatTime, formatHours } from '@/lib/utils';
import toast from 'react-hot-toast';

export default function AdminAttendancePage() {
  const [summary, setSummary] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [isLoading, setIsLoading] = useState(true);

  const loadSummary = async () => {
    try {
      setIsLoading(true);
      const res = await attendanceApi.summary(selectedDate);
      setSummary(res.data.data);
    } catch {
      toast.error('Failed to load attendance summary');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadSummary(); }, [selectedDate]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text-main">Attendance Overview</h1>
          <p className="text-slate-500 text-sm mt-0.5">Company-wide daily attendance</p>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-slate-400" />
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="zp-input w-auto"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { label: 'Total', value: summary?.summary?.totalEmployees ?? 0, color: 'text-text-main' },
              { label: 'Present', value: summary?.summary?.present ?? 0, color: 'text-success' },
              { label: 'Absent', value: summary?.summary?.absent ?? 0, color: 'text-red-500' },
              { label: 'Checked In', value: summary?.summary?.currentlyCheckedIn ?? 0, color: 'text-primary' },
              { label: 'Avg Hours', value: `${summary?.summary?.averageHours ?? 0}h`, color: 'text-accent' },
            ].map((s) => (
              <div key={s.label} className="zp-card text-center">
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-slate-500 mt-1">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Records Table */}
          <div className="zp-card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-text-main">
                Records for {formatDate(selectedDate)}
              </h3>
            </div>

            {summary?.records?.length === 0 ? (
              <div className="text-center py-10">
                <p className="text-sm text-slate-400">No records for this date</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-slate-400 border-b border-border">
                      <th className="pb-3 font-medium">Employee</th>
                      <th className="pb-3 font-medium">Check In</th>
                      <th className="pb-3 font-medium">Check Out</th>
                      <th className="pb-3 font-medium">Hours</th>
                      <th className="pb-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary?.records?.map((r: any) => (
                      <tr key={r.userId} className="border-b border-border last:border-0">
                        <td className="py-3">
                          <p className="font-medium text-text-main">{r.name}</p>
                          <p className="text-xs text-slate-400">{r.email}</p>
                        </td>
                        <td className="py-3 text-slate-600">{formatTime(r.checkIn)}</td>
                        <td className="py-3 text-slate-600">{r.checkOut ? formatTime(r.checkOut) : '—'}</td>
                        <td className="py-3 font-medium text-text-main">{formatHours(r.totalHours)}</td>
                        <td className="py-3">
                          <Badge variant={r.status === 'CHECKED_IN' ? 'success' : 'info'}>
                            {r.status === 'CHECKED_IN' ? 'Working' : 'Done'}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
