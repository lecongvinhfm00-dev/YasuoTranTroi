import React from 'react';
import {
  LayoutDashboard,
  Music,
  Film,
  BookOpen,
  BookOpenCheck,
  Sparkles,
  ListMusic,
  StickyNote,
  History,
  Presentation,
  Settings,
  X,
  Feather,
  CloudCheck,
  RefreshCw,
  AlertCircle,
  ShieldCheck,
} from 'lucide-react';
import type { NavigationModule, SyncStatusState, UserProfile } from '../types/studio.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { VI } from '../i18n/vi.ts';

interface SidebarProps {
  activeModule: NavigationModule;
  onSelectModule: (mod: NavigationModule) => void;
  user: UserProfile;
  syncStatus: SyncStatusState;
  quotaRemaining: number;
  quotaLimit: number;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

const NAV_ITEMS: { id: NavigationModule; label: string; icon: React.FC<{ className?: string }> }[] = [
  { id: 'dashboard', label: VI.nav.dashboard, icon: LayoutDashboard },
  { id: 'reader', label: VI.nav.reader, icon: BookOpenCheck },
  { id: 'literature', label: VI.nav.literature, icon: BookOpen },
  { id: 'ai', label: VI.nav.ai, icon: Sparkles },
  { id: 'music', label: VI.nav.music, icon: Music },
  { id: 'video', label: VI.nav.video, icon: Film },
  { id: 'playlist', label: VI.nav.playlist, icon: ListMusic },
  { id: 'notes', label: VI.nav.notes, icon: StickyNote },
  { id: 'history', label: VI.nav.history, icon: History },
  { id: 'presentation', label: VI.nav.presentation, icon: Presentation },
  { id: 'settings', label: VI.nav.settings, icon: Settings },
];

export const Sidebar: React.FC<SidebarProps> = ({
  activeModule,
  onSelectModule,
  user,
  syncStatus,
  quotaRemaining,
  quotaLimit,
  mobileOpen,
  onCloseMobile,
}) => {
  const { status: authStatus, userId, displayName, error: authError, retryAuth } = useAuth();

  const handleNavClick = (mod: NavigationModule) => {
    onSelectModule(mod);
    onCloseMobile();
  };

  const activeUuid = userId || user.uid;

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
        {/* Thương hiệu */}
        <div className="flex h-16 items-center justify-between border-b border-[var(--border-subtle)] px-5">
          <button
            type="button"
            onClick={() => handleNavClick('dashboard')}
            className="flex items-center gap-3 text-left focus:outline-none cursor-pointer"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#8275F5]/15 text-[#E9C878]">
              <Feather className="h-5 w-5" />
            </div>
            <div>
              <span className="block text-base font-bold tracking-tight text-[var(--text-main)] whitespace-nowrap">
                Literature Studio
              </span>
              <span className="block text-[11px] text-[var(--text-muted)] whitespace-nowrap">
                {VI.app.tagline}
              </span>
            </div>
          </button>

          <button
            type="button"
            onClick={onCloseMobile}
            aria-label="Đóng bảng chọn"
            className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-main)] lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Danh mục điều hướng tiếng Việt */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-3" aria-label="Danh mục chức năng">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeModule === item.id;
            return (
              <button
                key={item.id}
                type="button"
                data-testid={`nav-${item.id}`}
                onClick={() => handleNavClick(item.id)}
                className={`flex w-full items-center gap-3 rounded-lg px-3.5 py-2 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
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

        {/* Hạn mức AI & Trạng thái Supabase Anonymous Auth */}
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

          <div
            data-testid="sidebar-anonymous-account"
            className="rounded-lg bg-[var(--bg-surface)] p-2.5 border border-[var(--border-subtle)] space-y-1.5"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-xs font-semibold text-[var(--text-main)]">
                {displayName || user.username}
              </span>
              <span
                data-testid="auth-status-badge"
                className={`px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0 ${
                  authStatus === 'initializing'
                    ? 'bg-[#E9C878]/15 text-[#E9C878]'
                    : authStatus === 'error'
                    ? 'bg-[#F16C78]/15 text-[#F16C78]'
                    : 'bg-[#36C98F]/15 text-[#36C98F]'
                }`}
              >
                {authStatus === 'initializing'
                  ? 'Đang khởi tạo...'
                  : authStatus === 'error'
                  ? 'Lỗi kết nối'
                  : 'Đã đăng nhập ẩn danh'}
              </span>
            </div>

            <p
              data-testid="anonymous-uid-label"
              title={activeUuid}
              className="truncate text-[10px] font-mono text-[var(--text-muted)]"
            >
              UUID: {activeUuid}
            </p>

            <div className="flex items-center gap-1 text-[10px] text-[#A0A4B8]">
              <ShieldCheck className="h-3 w-3 text-[#8275F5] shrink-0" />
              <span className="truncate">Quyền: Độc giả (Không cấp Admin/Teacher)</span>
            </div>

            {authStatus === 'error' && (
              <div className="pt-1 space-y-1">
                <p className="text-[10px] text-[#F16C78] leading-snug line-clamp-2">
                  {authError || 'Không thể kết nối tới Supabase Auth.'}
                </p>
                <button
                  type="button"
                  data-testid="sidebar-retry-auth"
                  onClick={() => retryAuth()}
                  className="w-full rounded bg-[#8275F5]/20 hover:bg-[#8275F5]/30 border border-[#8275F5]/40 px-2 py-1 text-[10px] font-semibold text-[#F4F4FA] cursor-pointer"
                >
                  Thử kết nối lại
                </button>
              </div>
            )}

            <div className="flex items-center gap-1.5 text-[11px] pt-0.5">
              {syncStatus === 'syncing' || authStatus === 'initializing' ? (
                <>
                  <RefreshCw className="h-3 w-3 text-[#E9C878] animate-spin" />
                  <span className="text-[#E9C878]">{VI.sync.syncing}</span>
                </>
              ) : syncStatus === 'error' || authStatus === 'error' ? (
                <>
                  <AlertCircle className="h-3 w-3 text-[#F16C78]" />
                  <span className="text-[#F16C78]">{VI.sync.failed}</span>
                </>
              ) : (
                <>
                  <CloudCheck className="h-3 w-3 text-[#36C98F]" />
                  <span className="text-[#36C98F]">{VI.sync.synced}</span>
                </>
              )}
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};
