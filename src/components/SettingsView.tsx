import React, { useState } from 'react';
import {
  Settings,
  Volume2,
  Sparkles,
  User,
  HardDrive,
  Share2,
  MonitorUp,
  RefreshCw,
  Trash2,
  Download,
  LogIn,
  LogOut,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import type {
  AISettingsConfig,
  NavigationModule,
  UserProfile,
} from '../types/studio.ts';
import { AudioEngineState, masterAudioEngine } from '../services/audioEngine.ts';
import { HealthStatusResponse, studioApiClient } from '../services/apiClient.ts';
import { formatBytes } from '../utils/studioLogic.ts';

interface SettingsViewProps {
  theme: 'dark' | 'light';
  language: 'vi' | 'en';
  startupModule: NavigationModule;
  user: UserProfile;
  engineState: AudioEngineState;
  aiSettings: AISettingsConfig;
  healthStatus: HealthStatusResponse | null;
  quotaUsed: number;
  quotaLimit: number;
  storageInfo: {
    usedBytes: number;
    quotaBytes: number;
    breakdown: { tracksBytes: number; videosBytes: number; docsBytes: number };
  };
  onToggleTheme: (nextTheme: 'dark' | 'light') => void;
  onChangeLanguage: (lang: 'vi' | 'en') => void;
  onChangeStartupModule: (mod: NavigationModule) => void;
  onUpdateAiSettings: (next: AISettingsConfig) => void;
  onSignIn: () => void;
  onSignOut: () => void;
  onRefreshHealth: () => Promise<void>;
  onResetLocalCache: () => Promise<void>;
  onExportFullStudioData: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  theme,
  language,
  startupModule,
  user,
  engineState,
  aiSettings,
  healthStatus,
  quotaUsed,
  quotaLimit,
  storageInfo,
  onToggleTheme,
  onChangeLanguage,
  onChangeStartupModule,
  onUpdateAiSettings,
  onSignIn,
  onSignOut,
  onRefreshHealth,
  onResetLocalCache,
  onExportFullStudioData,
}) => {
  const [activeTab, setActiveTab] = useState<
    'general' | 'audio' | 'ai' | 'account' | 'storage' | 'connections'
  >('general');
  const [meetingShareState, setMeetingShareState] = useState<
    'not_connected' | 'ready_to_share' | 'sharing_active' | 'unsupported'
  >(
    typeof navigator !== 'undefined' &&
      navigator.mediaDevices &&
      'getDisplayMedia' in navigator.mediaDevices
      ? 'ready_to_share'
      : 'unsupported'
  );
  const [statusToast, setStatusToast] = useState<string | null>(null);

  const handleTestScreenShare = async () => {
    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices ||
      !('getDisplayMedia' in navigator.mediaDevices)
    ) {
      setMeetingShareState('unsupported');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });
      setMeetingShareState('sharing_active');
      stream.getVideoTracks()[0]?.addEventListener('ended', () => {
        setMeetingShareState('ready_to_share');
      });
    } catch {
      setMeetingShareState('ready_to_share');
    }
  };

  const handleSaveCloudPreferences = async () => {
    try {
      await studioApiClient.saveCloudSettings({
        theme,
        language,
        playerSettings: engineState.duckingConfig,
        aiSettings,
      });
      setStatusToast('Đã đồng bộ cấu hình cá nhân lên cơ sở dữ liệu.');
    } catch {
      setStatusToast('Đã lưu cấu hình trên phiên hiện tại.');
    }
  };

  return (
    <div className="space-y-6 pb-8">
      {/* Header & Section Tabs */}
      <section className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-[var(--text-main)]">
              Cài đặt Hệ thống & Tích hợp Trình chiếu (Settings & Connections)
            </h1>
            <p className="text-xs text-[var(--text-muted)]">
              Quản lý giao diện Dark/Light, cấu hình Web Audio Ducking, tài khoản người dùng, bộ nhớ IndexedDB và tích hợp Google Meet / Zoom / Discord.
            </p>
          </div>

          <button
            type="button"
            onClick={handleSaveCloudPreferences}
            className="rounded-lg bg-[#8275F5] px-4 py-2 text-xs font-semibold text-white hover:bg-[#7162E8] transition-colors whitespace-nowrap"
          >
            Đồng bộ cài đặt
          </button>
        </div>

        {statusToast && (
          <div className="rounded-lg bg-[#36C98F]/15 px-4 py-2 text-xs text-[#36C98F]">
            {statusToast}
          </div>
        )}

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {[
            { id: 'general', label: 'A. Giao diện chung', icon: Settings },
            { id: 'audio', label: 'B. Âm thanh & Ducking', icon: Volume2 },
            { id: 'ai', label: 'C. Cấu hình AI & Quota', icon: Sparkles },
            { id: 'account', label: 'D. Tài khoản & Phân quyền', icon: User },
            { id: 'storage', label: 'E. Lưu trữ (IndexedDB)', icon: HardDrive },
            { id: 'connections', label: 'F. Kết nối & Họp trực tuyến', icon: Share2 },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-[#8275F5] text-white'
                    : 'bg-[var(--bg-surface)] text-[var(--text-muted)] hover:text-[var(--text-main)]'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* A. General Settings */}
      {activeTab === 'general' && (
        <section className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6 space-y-5 text-xs">
          <h2 className="text-sm font-bold text-[var(--text-main)]">
            A. Cài đặt Chung (General & Theme)
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="rounded-lg bg-[var(--bg-surface)] p-4 space-y-2 border border-[var(--border-subtle)]">
              <label className="block font-semibold text-[var(--text-main)]">
                Chế độ màu sắc (Theme)
              </label>
              <p className="text-[11px] text-[var(--text-muted)]">
                Mặc định sử dụng Dark Theme (#0B0D17) chuẩn phòng thu hoặc chuyển sang Light Theme.
              </p>
              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => onToggleTheme('dark')}
                  className={`flex-1 rounded-lg py-2 font-semibold transition-colors ${
                    theme === 'dark'
                      ? 'bg-[#8275F5] text-white'
                      : 'bg-[var(--bg-card)] text-[var(--text-muted)]'
                  }`}
                >
                  Dark Theme (#0B0D17)
                </button>
                <button
                  type="button"
                  onClick={() => onToggleTheme('light')}
                  className={`flex-1 rounded-lg py-2 font-semibold transition-colors ${
                    theme === 'light'
                      ? 'bg-[#8275F5] text-white'
                      : 'bg-[var(--bg-card)] text-[var(--text-muted)]'
                  }`}
                >
                  Light Theme
                </button>
              </div>
            </div>

            <div className="rounded-lg bg-[var(--bg-surface)] p-4 space-y-2 border border-[var(--border-subtle)]">
              <label className="block font-semibold text-[var(--text-main)]">
                Ngôn ngữ giao diện (Language)
              </label>
              <p className="text-[11px] text-[var(--text-muted)]">
                Ngôn ngữ hiển thị chính và ưu tiên giọng đọc văn học.
              </p>
              <select
                aria-label="Ngôn ngữ giao diện"
                value={language}
                onChange={(e) => onChangeLanguage(e.target.value as 'vi' | 'en')}
                className="mt-2 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 py-2 text-[var(--text-main)]"
              >
                <option value="vi">Tiếng Việt (Mặc định)</option>
                <option value="en">English (International)</option>
              </select>
            </div>

            <div className="rounded-lg bg-[var(--bg-surface)] p-4 space-y-2 border border-[var(--border-subtle)]">
              <label className="block font-semibold text-[var(--text-main)]">
                Trang khởi động (Startup Page)
              </label>
              <p className="text-[11px] text-[var(--text-muted)]">
                Module mở đầu tiên khi truy cập Literature Studio.
              </p>
              <select
                aria-label="Trang khởi động mặc định"
                value={startupModule}
                onChange={(e) =>
                  onChangeStartupModule(e.target.value as NavigationModule)
                }
                className="mt-2 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 py-2 text-[var(--text-main)]"
              >
                <option value="dashboard">Dashboard — Trung tâm điều khiển</option>
                <option value="literature">Literature Library — Thư viện Văn học</option>
                <option value="music">Music Library — Thư viện Âm nhạc</option>
                <option value="ai">AI Assistant — Trợ lý Ngữ văn</option>
                <option value="presentation">Presentation Mode — Thuyết trình</option>
              </select>
            </div>
          </div>
        </section>
      )}

      {/* B. Audio Settings */}
      {activeTab === 'audio' && (
        <section className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6 space-y-5 text-xs">
          <h2 className="text-sm font-bold text-[var(--text-main)]">
            B. Cài đặt Âm thanh & Master Bot Player (Web Audio API)
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="rounded-lg bg-[var(--bg-surface)] p-4 space-y-3 border border-[var(--border-subtle)]">
              <div className="flex justify-between">
                <span className="font-semibold text-[var(--text-main)]">
                  Âm lượng mặc định (Default Volume)
                </span>
                <span className="font-tabular text-[#E9C878]">
                  {Math.round(engineState.volume * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.02}
                value={engineState.volume}
                onChange={(e) => masterAudioEngine.setVolume(Number(e.target.value))}
                className="w-full accent-[#8275F5]"
              />
            </div>

            <div className="rounded-lg bg-[var(--bg-surface)] p-4 space-y-3 border border-[var(--border-subtle)]">
              <div className="flex justify-between">
                <span className="font-semibold text-[var(--text-main)]">
                  Mức giảm âm lượng khi đọc văn bản (Ducking Level)
                </span>
                <span className="font-tabular text-[#E9C878]">
                  {engineState.duckingConfig.duckingLevelPercent}%
                </span>
              </div>
              <input
                type="range"
                min={10}
                max={60}
                step={2}
                value={engineState.duckingConfig.duckingLevelPercent}
                onChange={(e) =>
                  masterAudioEngine.updateDuckingConfig({
                    duckingLevelPercent: Number(e.target.value),
                  })
                }
                className="w-full accent-[#8275F5]"
              />
            </div>
          </div>
        </section>
      )}

      {/* C. AI Settings & Quota Explanation */}
      {activeTab === 'ai' && (
        <section className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6 space-y-5 text-xs">
          <h2 className="text-sm font-bold text-[var(--text-main)]">
            C. Cấu hình Google Gemini AI & Quản trị Hạn mức (Quota Management)
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-lg bg-[var(--bg-surface)] p-4 space-y-2 border border-[var(--border-subtle)]">
              <span className="text-[var(--text-muted)]">1. Hạn mức Literature Studio</span>
              <p className="font-tabular text-lg font-bold text-[var(--text-main)]">
                {quotaUsed} / {quotaLimit} lượt / ngày
              </p>
              <p className="text-[11px] text-[var(--text-muted)]">
                Mức phân bổ mặc định của hệ thống Literature Studio cho mỗi tài khoản người dùng để kiểm soát chất lượng học tập.
              </p>
            </div>

            <div className="rounded-lg bg-[var(--bg-surface)] p-4 space-y-2 border border-[var(--border-subtle)]">
              <span className="text-[var(--text-muted)]">2. Hạn mức kỹ thuật Gemini API</span>
              <p className="font-tabular text-lg font-bold text-[#E9C878]">
                RPM / TPM theo Tier
              </p>
              <p className="text-[11px] text-[var(--text-muted)]">
                Giới hạn số yêu cầu mỗi phút (Requests Per Minute) do máy chủ Google Gemini quy định cho khóa API được cấu hình.
              </p>
            </div>

            <div className="rounded-lg bg-[var(--bg-surface)] p-4 space-y-2 border border-[var(--border-subtle)]">
              <span className="text-[var(--text-muted)]">3. Hạn mức thanh toán Google Cloud</span>
              <p className="font-tabular text-lg font-bold text-[#36C98F]">
                Bảo vệ ở tầng Backend
              </p>
              <p className="text-[11px] text-[var(--text-muted)]">
                15 lượt của Literature Studio là quy tắc quản trị ứng dụng, hoàn toàn tách biệt với biểu phí thanh toán của Google Cloud.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-[var(--text-muted)] mb-1">
                Model Gemini sử dụng
              </label>
              <select
                value={aiSettings.model}
                onChange={(e) =>
                  onUpdateAiSettings({
                    ...aiSettings,
                    model: e.target.value as AISettingsConfig['model'],
                  })
                }
                className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-[var(--text-main)]"
              >
                <option value="gemini-4-hydrogen">gemini-4-hydrogen</option>
                <option value="gemini-3.1-flash-lite">gemini-3.1-flash-lite</option>
              </select>
            </div>

            <div>
              <label className="block text-[var(--text-muted)] mb-1">
                Độ dài phản hồi mặc định
              </label>
              <select
                value={aiSettings.responseLength}
                onChange={(e) =>
                  onUpdateAiSettings({
                    ...aiSettings,
                    responseLength: e.target.value as AISettingsConfig['responseLength'],
                  })
                }
                className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-[var(--text-main)]"
              >
                <option value="concise">Ngắn gọn</option>
                <option value="balanced">Cân đối</option>
                <option value="deep">Phân tích sâu</option>
              </select>
            </div>
          </div>
        </section>
      )}

      {/* D. Account & Role Management */}
      {activeTab === 'account' && (
        <section className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6 space-y-4 text-xs">
          <h2 className="text-sm font-bold text-[var(--text-main)]">
            D. Thông tin Tài khoản & Phân quyền (Account & RBAC)
          </h2>

          <div className="rounded-lg bg-[var(--bg-surface)] p-5 border border-[var(--border-subtle)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <p className="text-sm font-bold text-[var(--text-main)]">{user.username}</p>
              <p className="text-[var(--text-muted)]">Email: {user.email}</p>
              <p className="font-tabular text-[11px] text-[#E9C878]">
                User ID: {user.uid} · Vai trò (Role): {user.role.toUpperCase()} · Hạn mức:{' '}
                {user.dailyQuota} lượt/ngày
              </p>
            </div>

            {user.isAuthenticated ? (
              <button
                type="button"
                onClick={onSignOut}
                className="flex items-center gap-2 rounded-lg bg-[#F16C78] px-4 py-2 font-semibold text-white"
              >
                <LogOut className="h-4 w-4" />
                <span>Đăng xuất tài khoản</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onSignIn}
                className="flex items-center gap-2 rounded-lg bg-[#8275F5] px-4 py-2 font-semibold text-white hover:bg-[#7162E8]"
              >
                <LogIn className="h-4 w-4" />
                <span>Đăng nhập với Google (Xác thực Cloud)</span>
              </button>
            )}
          </div>
        </section>
      )}

      {/* E. Storage Management */}
      {activeTab === 'storage' && (
        <section className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6 space-y-4 text-xs">
          <h2 className="text-sm font-bold text-[var(--text-main)]">
            E. Quản lý Lưu trữ Cục bộ & Sao lưu (IndexedDB Storage)
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-lg bg-[var(--bg-surface)] p-4 border border-[var(--border-subtle)]">
              <span className="text-[var(--text-muted)]">Dung lượng Âm nhạc (IndexedDB)</span>
              <p className="mt-1 font-tabular text-base font-bold text-[var(--text-main)]">
                {formatBytes(storageInfo.breakdown.tracksBytes)}
              </p>
            </div>
            <div className="rounded-lg bg-[var(--bg-surface)] p-4 border border-[var(--border-subtle)]">
              <span className="text-[var(--text-muted)]">Dung lượng Video (IndexedDB)</span>
              <p className="mt-1 font-tabular text-base font-bold text-[var(--text-main)]">
                {formatBytes(storageInfo.breakdown.videosBytes)}
              </p>
            </div>
            <div className="rounded-lg bg-[var(--bg-surface)] p-4 border border-[var(--border-subtle)]">
              <span className="text-[var(--text-muted)]">Dung lượng Tài liệu Văn học</span>
              <p className="mt-1 font-tabular text-base font-bold text-[var(--text-main)]">
                {formatBytes(storageInfo.breakdown.docsBytes)}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onExportFullStudioData}
              className="flex items-center gap-2 rounded-lg bg-[#8275F5] px-4 py-2 font-semibold text-white hover:bg-[#7162E8]"
            >
              <Download className="h-4 w-4" />
              <span>Export toàn bộ dữ liệu Văn học & Playlist (.JSON)</span>
            </button>

            <button
              type="button"
              onClick={onResetLocalCache}
              className="flex items-center gap-2 rounded-lg border border-[#F16C78]/40 bg-[#F16C78]/15 px-4 py-2 font-semibold text-[#F16C78] hover:bg-[#F16C78] hover:text-white transition-colors"
            >
              <Trash2 className="h-4 w-4" />
              <span>Xóa Cache & Khôi phục dữ liệu gốc</span>
            </button>
          </div>
        </section>
      )}

      {/* F. Connections & Online Meeting Integration */}
      {activeTab === 'connections' && (
        <div className="space-y-6 text-xs">
          <section className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-[var(--text-main)]">
                Kiểm tra Trạng thái Kết nối Thực tế (/api/health)
              </h2>
              <button
                type="button"
                onClick={onRefreshHealth}
                className="flex items-center gap-1.5 rounded-lg bg-[var(--bg-surface)] px-3 py-1.5 font-medium text-[var(--text-main)] hover:bg-[#8275F5] hover:text-white transition-colors"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Kiểm tra lại</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-lg bg-[var(--bg-surface)] p-4 border border-[var(--border-subtle)] flex items-center justify-between">
                <div>
                  <p className="font-semibold text-[var(--text-main)]">Google Gemini API</p>
                  <p className="text-[11px] text-[var(--text-muted)]">
                    Model: {healthStatus?.services.defaultModel || 'gemini-4-hydrogen'}
                  </p>
                </div>
                {healthStatus?.services.geminiConfigured ? (
                  <span className="flex items-center gap-1 font-semibold text-[#36C98F]">
                    <CheckCircle2 className="h-4 w-4" /> Đã cấu hình
                  </span>
                ) : (
                  <span className="flex items-center gap-1 font-semibold text-[#F16C78]">
                    <AlertCircle className="h-4 w-4" /> Chưa cấu hình
                  </span>
                )}
              </div>

              <div className="rounded-lg bg-[var(--bg-surface)] p-4 border border-[var(--border-subtle)] flex items-center justify-between">
                <div>
                  <p className="font-semibold text-[var(--text-main)]">Backend API Server</p>
                  <p className="text-[11px] text-[var(--text-muted)]">
                    Endpoints: /api/ai · /api/usage
                  </p>
                </div>
                {healthStatus?.services.backend ? (
                  <span className="flex items-center gap-1 font-semibold text-[#36C98F]">
                    <CheckCircle2 className="h-4 w-4" /> Hoạt động
                  </span>
                ) : (
                  <span className="flex items-center gap-1 font-semibold text-[#F16C78]">
                    <AlertCircle className="h-4 w-4" /> Mất kết nối
                  </span>
                )}
              </div>

              <div className="rounded-lg bg-[var(--bg-surface)] p-4 border border-[var(--border-subtle)] flex items-center justify-between">
                <div>
                  <p className="font-semibold text-[var(--text-main)]">
                    Meeting Screen/Audio Share
                  </p>
                  <p className="text-[11px] text-[var(--text-muted)]">
                    Trạng thái: {meetingShareState.toUpperCase()}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleTestScreenShare}
                  className="flex items-center gap-1 rounded-lg bg-[#8275F5] px-3 py-1.5 font-semibold text-white"
                >
                  <MonitorUp className="h-3.5 w-3.5" />
                  <span>Chia sẻ Tab</span>
                </button>
              </div>
            </div>
          </section>

          {/* Meeting Integration Instructions: Google Meet, Zoom, Discord */}
          <section className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6 space-y-4">
            <h2 className="text-sm font-bold text-[var(--text-main)]">
              Hướng dẫn Tích hợp Họp & Giảng dạy Trực tuyến (Meeting Integration)
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-lg bg-[var(--bg-surface)] p-4 border border-[var(--border-subtle)] space-y-2">
                <h3 className="font-bold text-[#E9C878]">01. Google Meet</h3>
                <ul className="space-y-1.5 text-[var(--text-muted)] list-disc pl-4">
                  <li>Nhấn nút "Trình bày ngay" (Present now) trong Google Meet.</li>
                  <li>Chọn "Một thẻ" (A Tab) và chọn tab Literature Studio.</li>
                  <li>Bật tùy chọn "Chia sẻ âm thanh thẻ" (Share tab audio) để học sinh nghe rõ nhạc nền và giọng đọc TTS.</li>
                </ul>
              </div>

              <div className="rounded-lg bg-[var(--bg-surface)] p-4 border border-[var(--border-subtle)] space-y-2">
                <h3 className="font-bold text-[#A78BFA]">02. Zoom Meeting</h3>
                <ul className="space-y-1.5 text-[var(--text-muted)] list-disc pl-4">
                  <li>Nhấn "Share Screen" trên thanh công cụ Zoom.</li>
                  <li>Đánh dấu ô "Share sound" (Chia sẻ âm thanh máy tính) ở góc dưới bên trái.</li>
                  <li>Mở Presentation Mode trong Literature Studio để trình chiếu toàn màn hình.</li>
                </ul>
              </div>

              <div className="rounded-lg bg-[var(--bg-surface)] p-4 border border-[var(--border-subtle)] space-y-2">
                <h3 className="font-bold text-[#36C98F]">03. Discord Voice & Bot</h3>
                <ul className="space-y-1.5 text-[var(--text-muted)] list-disc pl-4">
                  <li>Cách 1: Dùng "Share Your Screen" → Chọn ứng dụng trình duyệt để phát trực tiếp âm thanh vào Voice Channel.</li>
                  <li>Cách 2 (Discord Bot riêng): Cấu hình Discord Bot Token trên biến môi trường Backend riêng biệt (tuyệt đối không đặt Bot Token ở frontend).</li>
                </ul>
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
};
