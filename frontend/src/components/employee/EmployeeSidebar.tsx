'use client';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Clock, User, LogOut,
  Menu, X, Shield, ChevronRight,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/employee/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/employee/attendance', label: 'My Attendance', icon: Clock },
  { href: '/employee/profile', label: 'Profile', icon: User },
];

export function EmployeeSidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-border">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shrink-0">
          <span className="text-white font-bold text-sm">Z</span>
        </div>
        <div>
          <p className="font-bold text-text-main text-sm">ZeroProxy</p>
          <p className="text-xs text-slate-400">Employee Portal</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group',
                active
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-slate-600 hover:bg-background hover:text-text-main'
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
              {active && <ChevronRight className="w-3 h-3 ml-auto opacity-60" />}
            </Link>
          );
        })}
      </nav>

      {/* User info + logout */}
      <div className="p-3 border-t border-border space-y-2">
        <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-background">
          <Avatar name={user?.name || 'U'} size="sm" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-text-main truncate">{user?.name}</p>
            <p className="text-xs text-slate-400 truncate">{user?.email}</p>
          </div>
          {user?.faceRegistered && (
            <span title="Face registered" className="shrink-0">
              <Shield className="w-3.5 h-3.5 text-success" />
            </span>
          )}
        </div>
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:bg-red-50 hover:text-red-500 transition-all cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-56 bg-card border-r border-border h-screen sticky top-0 shrink-0">
        {sidebarContent}
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden flex items-center justify-between px-4 py-3 bg-card border-b border-border sticky top-0 z-30">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
            <span className="text-white font-bold text-xs">Z</span>
          </div>
          <span className="font-bold text-text-main text-sm">ZeroProxy</span>
        </div>
        <button onClick={() => setMobileOpen(true)} className="p-1.5 rounded-lg hover:bg-background cursor-pointer">
          <Menu className="w-5 h-5 text-slate-600" />
        </button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex animate-fade-in">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <div className="relative w-64 bg-card h-full shadow-modal animate-slide-up">
            <button onClick={() => setMobileOpen(false)}
              className="absolute top-4 right-4 p-1 rounded-lg hover:bg-background cursor-pointer">
              <X className="w-4 h-4 text-slate-600" />
            </button>
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
