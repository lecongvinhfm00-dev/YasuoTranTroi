import React from 'react';
import {
  LayoutDashboard,
  Music,
  Film,
  BookOpen,
  Sparkles,
  ListMusic,
  Presentation,
  Settings,
  LogIn,
  LogOut,
  X,
  Feather,
} from 'lucide-react';
import type { NavigationModule, UserProfile } from '../types/studio.ts';

interface SidebarProps {
  activeModule: NavigationModule;
  onSelectModule: (mod: NavigationModule) => void;
  user: UserProfile;
  quotaRemaining: number;
  quotaLimit: number;
  onSignIn: () => void;
  onSignOut: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

const NAV_ITEMS: { id: NavigationModule; label: string; icon: React.FC<{ className?: string }> }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'music', label: 'Music Library', icon: Music },
  { id: 'video', label: 'Video Player', icon: Film },
  { id: 'literature', label: 'Literature Library', icon: BookOpen },
  { id: 'ai', label: 'AI Assistant', icon: Sparkles },
  { id: 'playlist', label: 'Playlist', icon: ListMusic },
  { id: 'presentation', label: 'Presentation', icon: Presentation },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export const Sidebar: React.FC<SidebarProps> = ({
  activeModule,
  onSelectModule,
  user,
  quotaRemaining,
  quotaLimit,
  onSignIn,
  onSignOut,
  mobileOpen,
  onCloseMobile,
}) => {
  const handleNavClick = (mod: NavigationModule) => {
    onSelectModule(mod);
    onCloseMobile();
  };

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs lg:hidden"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      <aside
        aria-label="Thanh điều hướng chính"
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-[var(--border-subtle)] bg-[var(--bg-sidebar)] transition-transform duration-200 lg:static lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="flex h-16 items-center justify-between border-b border-[var(--border-subtle)] px-5">
          <button
            type="button"
            onClick={() => handleNavClick('dashboard')}
            className="flex items-center gap-3 text-left focus:outline-none"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#8275F5]/15 text-[#E9C878]">
              <Feather className="h-5 w-5" />
            </div>
            <div>
              <span className="block text-base font-bold tracking-tight text-[var(--text-main)] whitespace-nowrap">
                Literature Studio
              </span>
              <span className="block text-[11px] text-[var(--text-muted)] whitespace-nowrap">
                Âm nhạc · Văn học · AI
              </span>
            </div>
          </button>

          <button
            type="button"
            onClick={onCloseMobile}
            aria-label="Đóng menu"
            className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-main)] lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4" aria-label="Module không gian làm việc">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeModule === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavClick(item.id)}
                className={`flex w-full items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-[#8275F5] text-white shadow-xs'
                    : 'text-[var(--text-muted)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-main)]'
                }`}
              >
                <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-white' : 'text-[var(--text-muted)]'}`} />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Quota & Account Footer */}
        <div className="border-t border-[var(--border-subtle)] p-4 space-y-3">
          <div className="rounded-lg bg-[var(--bg-card)] p-3 border border-[var(--border-subtle)]">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[var(--text-muted)]">Hạn mức AI hôm nay</span>
              <span className="font-tabular font-semibold text-[#E9C878]">
                {quotaRemaining}/{quotaLimit} lượt
              </span>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[var(--bg-surface)]">
              <div
                className="h-full bg-[#8275F5] transition-all duration-300"
                style={{
                  width: `${Math.min(100, Math.round((quotaRemaining / Math.max(1, quotaLimit)) * 100))}%`,
                }}
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 pt-1">
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-[var(--text-main)]">
                {user.username}
              </p>
              <p className="truncate text-[11px] text-[var(--text-muted)]">
                {user.isAuthenticated ? 'Tài khoản đã xác thực' : 'Phiên Khách · Cục bộ'}
              </p>
            </div>
            {user.isAuthenticated ? (
              <button
                type="button"
                onClick={onSignOut}
                aria-label="Đăng xuất tài khoản"
                className="flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-xs font-medium text-[var(--text-main)] hover:border-[#F16C78]/50 hover:text-[#F16C78] transition-colors whitespace-nowrap shrink-0"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Thoát</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onSignIn}
                aria-label="Đăng nhập với Google"
                className="flex items-center gap-1.5 rounded-lg bg-[#8275F5] px-2.5 py-1.5 text-xs font-medium text-white hover:bg-[#7162E8] transition-colors whitespace-nowrap shrink-0"
              >
                <LogIn className="h-3.5 w-3.5" />
                <span>Đăng nhập</span>
              </button>
            )}
          </div>
        </div>
      </aside>
    </>
  );
};
