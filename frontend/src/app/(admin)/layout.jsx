"use client";

import React, { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Activity, UserPlus, Trophy, LayoutDashboard, Monitor as MonitorIcon, LogOut, Settings as SettingsIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const NavLink = ({ href, icon: Icon, label }) => {
  const pathname = usePathname();
  const isActive = pathname === href || (href !== '/' && pathname.startsWith(href));
  return (
    <Link
      href={href}
      className={cn(
        "relative flex items-center gap-2 text-sm font-semibold transition-all px-4 py-2 rounded-xl group",
        isActive
          ? "text-primary bg-primary/8 shadow-sm"
          : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
      )}
    >
      <Icon size={18} className={cn("transition-transform group-hover:scale-110", isActive && "text-primary")} />
      <span>{label}</span>
      {isActive && (
        <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 bg-primary rounded-full" />
      )}
    </Link>
  );
};

export default function AdminLayout({ children }) {
  const { user, logout, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  if (loading || !user) {
    return null; // Or a loading spinner
  }

  return (
    <div className="min-h-screen flex flex-col tech-grid">
      <nav className="sticky top-0 z-50 w-full border-b border-black/5 bg-white/60 backdrop-blur-2xl">
        <div className="container mx-auto px-4 h-20 flex justify-between items-center">
          <Link href="/" className="flex items-center gap-3 group">
            <img src="/logo.png" alt="IKSPI" className="h-12 w-auto object-contain group-hover:scale-105 transition-transform drop-shadow-sm" />
            <div className="h-8 w-px bg-slate-200 mx-1 hidden sm:block" />
            <div className="flex flex-col">
              <span className="text-xl font-bold tracking-tighter leading-none text-slate-900">
                IMPACT<span className="text-primary">MONITOR</span>
              </span>
              <span className="text-[10px] uppercase tracking-[0.2em] font-black text-slate-400">Pro Edition</span>
            </div>
          </Link>
          <div className="hidden md:flex items-center gap-2 p-1.5 bg-slate-100/50 rounded-2xl border border-black/5">
            <NavLink href="/" icon={LayoutDashboard} label="Dashboard" />
            <NavLink href="/register" icon={UserPlus} label="Register" />
            <NavLink href="/monitor" icon={MonitorIcon} label="Monitor" />
            <NavLink href="/leaderboard" icon={Trophy} label="Leaderboard" />
            <NavLink href="/settings" icon={SettingsIcon} label="Settings" />
          </div>
          <div className="flex items-center gap-4">
            <div className="h-8 w-[1px] bg-slate-200 hidden sm:block" />
            <Button
              variant="ghost"
              size="icon"
              className="text-slate-500 hover:text-red-500 rounded-full"
              title="Logout"
              onClick={handleLogout}
            >
              <LogOut size={20} />
            </Button>
          </div>
        </div>
      </nav>
      <main className="flex-1 container mx-auto p-6 md:p-10">
        <div className="max-w-7xl mx-auto">
          {children}
        </div>
      </main>
      <footer className="py-8 border-t border-black/5 text-center text-sm text-slate-400">
        <p>&copy; {new Date().getFullYear()} ImpactMonitor Pro · Dirancang untuk Atlet Profesional</p>
      </footer>
    </div>
  );
}
