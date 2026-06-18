'use client';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Users, Clock, Monitor, Activity,
  LogOut, Menu, X, ChevronRight, Wifi, WifiOff,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/admin/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/admin/employees', label: 'Employees', icon: Users },
  { href: '/admin/attendance', label: 'Attendance', icon: Clock },
  { href: '/admin/sessions', label: 'Sessions', icon: Monitor },
  { href: '/admin/activity', label: 'Activity Logs', icon: Activity },
];

export function AdminSidebar({ socketConnected }: { socketConnected?: boolean }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-5 py-5 border-b border-border">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shrink-0">
          <span className="text-white font-bold text-sm">Z</span>
        </div>
        <div className="flex-1">
          <p className="font-bold text-text-main text-sm">ZeroProxy</p>
          <p className="text-xs text-slate-400">Admin Console</p>
        </div>
        {socketConnected !== undefined && (
          socketConnected
            ? <Wifi className="w-3.5 h-3.5 text-success" />
            : <WifiOff className="w-3.5 h-3.5 text-slate-300" />
        )}
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link key={href} href={href} onClick={() => setMobileOpen(false)}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all',
                active ? 'bg-primary text-white shadow-sm' : 'text-slate-600 hover:bg-background hover:text-text-main'
              )}>
              <Icon className="w-4 h-4 shrink-0" />
              {label}
              {active && <ChevronRight className="w-3 h-3 ml-auto opacity-60" />}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-border space-y-2">
        <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-background">
          <Avatar name={user?.name || 'A'} size="sm" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-text-main truncate">{user?.name}</p>
            <p className="text-xs text-slate-400 truncate">{user?.role}</p>
          </div>
        </div>
        <button onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:bg-red-50 hover:text-red-500 transition-all">
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden md:flex flex-col w-56 bg-card border-r border-border h-screen sticky top-0 shrink-0">
        <SidebarContent />
      </aside>

      <div className="md:hidden flex items-center justify-between px-4 py-3 bg-card border-b border-border sticky top-0 z-30">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
            <span className="text-white font-bold text-xs">Z</span>
          </div>
          <span className="font-bold text-text-main text-sm">Admin Console</span>
        </div>
        <button onClick={() => setMobileOpen(true)} className="p-1.5 rounded-lg hover:bg-background">
          <Menu className="w-5 h-5 text-slate-600" />
        </button>
      </div>

      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <div className="relative w-64 bg-card h-full shadow-modal">
            <button onClick={() => setMobileOpen(false)} className="absolute top-4 right-4 p-1 rounded-lg hover:bg-background">
              <X className="w-4 h-4 text-slate-600" />
            </button>
            <SidebarContent />
          </div>
        </div>
      )}
    </>
  );
}
