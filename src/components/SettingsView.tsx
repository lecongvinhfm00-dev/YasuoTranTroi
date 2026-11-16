import React, { useEffect, useState } from 'react';
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
  CheckCircle2,
  AlertCircle,
  BookOpenCheck,
  AlertTriangle,
} from 'lucide-react';
import type {
  AISettingsConfig,
  NavigationModule,
  SyncStatusState,
  TTSSettingsConfig,
  UserProfile,
} from '../types/studio.ts';
import { AudioEngineState, masterAudioEngine } from '../services/audioEngine.ts';
import { HealthStatusResponse, studioApiClient } from '../services/apiClient.ts';
import { vietnameseTTS, type TTSReaderSnapshot } from '../services/ttsService.ts';
import { formatBytes } from '../utils/studioLogic.ts';
import { getSupabaseStatusLabel, isSupabaseConfigured } from '../lib/supabase.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { VI } from '../i18n/vi.ts';

interface SettingsViewProps {
  theme: 'dark' | 'light';
  language: 'vi' | 'en';
  startupModule: NavigationModule;
  user: UserProfile;
  syncStatus: SyncStatusState;
  engineState: AudioEngineState;
  aiSettings: AISettingsConfig;
  ttsSettings: TTSSettingsConfig;
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
  onUpdateTTSSettings: (next: Partial<TTSSettingsConfig>) => void;
  onRefreshHealth: () => Promise<void>;
  onResetLocalCache: () => Promise<void>;
  onExportFullStudioData: () => void;
  onForceSyncNow: () => Promise<void>;
}

const SPEED_OPTIONS = [0.75, 0.9, 1.0, 1.1, 1.25, 1.5, 1.75, 2.0];

export const SettingsView: React.FC<SettingsViewProps> = ({
  theme,
  startupModule,
  user,
  syncStatus,
  engineState,
  aiSettings,
  ttsSettings,
  healthStatus,
  quotaUsed,
  quotaLimit,
  storageInfo,
  onToggleTheme,
  onChangeStartupModule,
  onUpdateAiSettings,
  onUpdateTTSSettings,
  onRefreshHealth,
  onResetLocalCache,
  onExportFullStudioData,
  onForceSyncNow,
}) => {
  const auth = useAuth();
  const [activeTab, setActiveTab] = useState<
    'voice' | 'general' | 'audio' | 'ai' | 'account' | 'storage' | 'connections'
  >('voice');
  const [ttsSnapshot, setTtsSnapshot] = useState<TTSReaderSnapshot>(() =>
    vietnameseTTS.getSnapshot()
  );
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

  useEffect(() => {
    return vietnameseTTS.subscribe((snap) => setTtsSnapshot(snap));
  }, []);

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
        language: 'vi',
        playerSettings: engineState.duckingConfig,
        aiSettings,
      });
      await onForceSyncNow();
      setStatusToast('Đã đồng bộ toàn bộ cài đặt cá nhân và cấu hình giọng đọc lên đám mây.');
    } catch {
      setStatusToast('Đã lưu cấu hình trên trình duyệt của bạn.');
    }
  };

  return (
    <div data-testid="settings-view" className="space-y-6 pb-8">
      {/* Tiêu đề & Thanh chọn mục Cài đặt */}
      <section className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-[var(--text-main)]">
              Cài đặt Hệ thống, Ngôn ngữ & Giọng đọc Tiếng Việt
            </h1>
            <p className="text-xs text-[var(--text-muted)]">
              Quản lý giọng đọc văn bản tiếng Việt, giao diện Sáng/Tối, tự động giảm nhạc nền, tài khoản ẩn danh tự động và kiểm tra kết nối hệ thống.
            </p>
          </div>

          <button
            type="button"
            data-testid="settings-sync-button"
            onClick={handleSaveCloudPreferences}
            className="rounded-lg bg-[#8275F5] px-4 py-2 text-xs font-semibold text-white hover:bg-[#7162E8] transition-colors whitespace-nowrap cursor-pointer"
          >
            Đồng bộ cài đặt ngay
          </button>
        </div>

        {statusToast && (
          <div className="rounded-lg bg-[#36C98F]/15 px-4 py-2 text-xs text-[#36C98F]">
            {statusToast}
          </div>
        )}

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {[
            { id: 'voice', label: '1. Ngôn ngữ và giọng đọc', icon: BookOpenCheck },
            { id: 'general', label: '2. Giao diện chung', icon: Settings },
            { id: 'audio', label: '3. Âm thanh & Giảm nhạc nền', icon: Volume2 },
            { id: 'ai', label: '4. Cấu hình AI & Hạn mức', icon: Sparkles },
            { id: 'account', label: '5. Tài khoản ẩn danh & Đồng bộ', icon: User },
            { id: 'storage', label: '6. Bộ nhớ & Sao lưu', icon: HardDrive },
            { id: 'connections', label: '7. Trạng thái kết nối', icon: Share2 },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                data-testid={`settings-tab-${tab.id}`}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
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

      {/* 1. Ngôn ngữ và giọng đọc (Mục ưu tiên theo chuẩn Vietnamese Edition) */}
      {activeTab === 'voice' && (
        <section
          data-testid="settings-voice-section"
          className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6 space-y-5 text-xs"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-[var(--text-main)]">
                1. Ngôn ngữ và giọng đọc Tiếng Việt
              </h2>
              <p className="text-[11px] text-[var(--text-muted)]">
                Thiết lập giọng đọc tiếng Việt mặc định (vi-VN), tốc độ đọc, cao độ và tự động cuộn văn bản.
              </p>
            </div>
            <button
              type="button"
              onClick={() => vietnameseTTS.refreshVoices()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--bg-surface)] px-3 py-1.5 text-xs font-medium text-[#E9C878] border border-[#E9C878]/30 hover:bg-white/10 cursor-pointer"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Làm mới danh sách giọng đọc
            </button>
          </div>

          {!ttsSnapshot.hasVietnameseVoice && (
            <div className="flex items-start gap-2.5 p-3.5 rounded-lg bg-[#E9C878]/10 border border-[#E9C878]/35 text-xs">
              <AlertTriangle className="h-4 w-4 text-[#E9C878] shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold text-[#E9C878]">{VI.tts.noVoiceWarning}</p>
                <p className="text-[var(--text-muted)]">{VI.tts.noVoiceGuide}</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Ngôn ngữ giao diện */}
            <div className="rounded-lg bg-[var(--bg-surface)] p-4 space-y-2 border border-[var(--border-subtle)]">
              <label className="block font-semibold text-[var(--text-main)]">
                Ngôn ngữ giao diện
              </label>
              <p className="text-[11px] text-[var(--text-muted)]">
                Toàn bộ nhãn điều hướng, thông báo và công cụ hiển thị bằng tiếng Việt chuẩn.
              </p>
              <div className="mt-2 rounded-lg border border-[#36C98F]/40 bg-[#36C98F]/10 px-3 py-2 font-semibold text-[#36C98F]">
                Tiếng Việt (Mặc định chính thức)
              </div>
            </div>

            {/* Giọng đọc mặc định */}
            <div className="rounded-lg bg-[var(--bg-surface)] p-4 space-y-2 border border-[var(--border-subtle)]">
              <label className="block font-semibold text-[var(--text-main)]">
                Giọng đọc mặc định (vi-VN)
              </label>
              <p className="text-[11px] text-[var(--text-muted)]">
                Không bao giờ dùng giọng tiếng Anh để đọc tác phẩm tiếng Việt.
              </p>
              <select
                value={ttsSettings.voiceURI}
                onChange={(e) => {
                  vietnameseTTS.setVoice(e.target.value);
                  onUpdateTTSSettings({ voiceURI: e.target.value });
                }}
                className="mt-2 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 py-2 text-[var(--text-main)]"
              >
                {ttsSnapshot.voices.length === 0 ? (
                  <option value="">Chưa phát hiện giọng đọc vi-VN trên trình duyệt</option>
                ) : (
                  ttsSnapshot.voices.map((v) => (
                    <option key={v.voiceURI} value={v.voiceURI}>
                      {v.name} ({v.genderHint} • {v.regionHint})
                    </option>
                  ))
                )}
              </select>
            </div>

            {/* Tốc độ đọc mặc định */}
            <div className="rounded-lg bg-[var(--bg-surface)] p-4 space-y-2 border border-[var(--border-subtle)]">
              <label className="block font-semibold text-[var(--text-main)]">
                Tốc độ đọc mặc định: <span className="text-[#E9C878]">{ttsSettings.rate}x</span>
              </label>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {SPEED_OPTIONS.map((spd) => (
                  <button
                    key={spd}
                    type="button"
                    onClick={() => {
                      vietnameseTTS.setRate(spd);
                      onUpdateTTSSettings({ rate: spd });
                    }}
                    className={`px-2.5 py-1 rounded text-xs font-mono transition-colors cursor-pointer ${
                      Math.abs(ttsSettings.rate - spd) < 0.02
                        ? 'bg-[#8275F5] text-white font-semibold'
                        : 'bg-[var(--bg-card)] text-[var(--text-muted)] hover:text-[var(--text-main)]'
                    }`}
                  >
                    {spd}x
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Cao độ mặc định */}
            <div className="rounded-lg bg-[var(--bg-surface)] p-4 space-y-2 border border-[var(--border-subtle)]">
              <div className="flex justify-between">
                <span className="font-semibold text-[var(--text-main)]">Cao độ mặc định</span>
                <span className="font-mono text-[#E9C878]">{ttsSettings.pitch.toFixed(1)}</span>
              </div>
              <input
                type="range"
                min={0.6}
                max={1.4}
                step={0.1}
                value={ttsSettings.pitch}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  vietnameseTTS.setPitch(val);
                  onUpdateTTSSettings({ pitch: val });
                }}
                className="w-full accent-[#8275F5]"
              />
            </div>

            {/* Tự động cuộn khi đọc */}
            <div className="rounded-lg bg-[var(--bg-surface)] p-4 flex items-center justify-between border border-[var(--border-subtle)]">
              <div>
                <p className="font-semibold text-[var(--text-main)]">Tự động cuộn khi đọc</p>
                <p className="text-[11px] text-[var(--text-muted)]">
                  Cuộn màn hình theo đoạn thơ/đoạn văn đang phát
                </p>
              </div>
              <input
                type="checkbox"
                checked={ttsSettings.autoScroll}
                onChange={(e) => {
                  vietnameseTTS.setPreferences({ autoScroll: e.target.checked });
                  onUpdateTTSSettings({ autoScroll: e.target.checked });
                }}
                className="h-4 w-4 accent-[#8275F5]"
              />
            </div>

            {/* Tự động giảm nhạc nền khi đọc */}
            <div className="rounded-lg bg-[var(--bg-surface)] p-4 flex items-center justify-between border border-[var(--border-subtle)]">
              <div>
                <p className="font-semibold text-[var(--text-main)]">
                  Tự động giảm nhạc nền khi đọc
                </p>
                <p className="text-[11px] text-[var(--text-muted)]">
                  Hạ âm lượng nhạc nền xuống {engineState.duckingConfig.duckingLevelPercent}% khi giọng đọc bật
                </p>
              </div>
              <input
                type="checkbox"
                checked={engineState.duckingConfig.enabled}
                onChange={(e) =>
                  masterAudioEngine.updateDuckingConfig({ enabled: e.target.checked })
                }
                className="h-4 w-4 accent-[#8275F5]"
              />
            </div>
          </div>
        </section>
      )}

      {/* 2. Giao diện chung */}
      {activeTab === 'general' && (
        <section className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6 space-y-5 text-xs">
          <h2 className="text-sm font-bold text-[var(--text-main)]">
            2. Cài đặt Giao diện Chung
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="rounded-lg bg-[var(--bg-surface)] p-4 space-y-2 border border-[var(--border-subtle)]">
              <label className="block font-semibold text-[var(--text-main)]">
                Chế độ màu sắc giao diện
              </label>
              <p className="text-[11px] text-[var(--text-muted)]">
                Mặc định sử dụng Giao diện tối (#0B0D17) chuẩn phòng thu hoặc chuyển sang Giao diện sáng.
              </p>
              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => onToggleTheme('dark')}
                  className={`flex-1 rounded-lg py-2 font-semibold transition-colors cursor-pointer ${
                    theme === 'dark'
                      ? 'bg-[#8275F5] text-white'
                      : 'bg-[var(--bg-card)] text-[var(--text-muted)]'
                  }`}
                >
                  Giao diện tối (#0B0D17)
                </button>
                <button
                  type="button"
                  onClick={() => onToggleTheme('light')}
                  className={`flex-1 rounded-lg py-2 font-semibold transition-colors cursor-pointer ${
                    theme === 'light'
                      ? 'bg-[#8275F5] text-white'
                      : 'bg-[var(--bg-card)] text-[var(--text-muted)]'
                  }`}
                >
                  Giao diện sáng
                </button>
              </div>
            </div>

            <div className="rounded-lg bg-[var(--bg-surface)] p-4 space-y-2 border border-[var(--border-subtle)]">
              <label className="block font-semibold text-[var(--text-main)]">
                Màn hình mở đầu tiên
              </label>
              <p className="text-[11px] text-[var(--text-muted)]">
                Chức năng hiển thị mặc định khi truy cập Literature Studio.
              </p>
              <select
                aria-label="Trang khởi động mặc định"
                value={startupModule}
                onChange={(e) =>
                  onChangeStartupModule(e.target.value as NavigationModule)
                }
                className="mt-2 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 py-2 text-[var(--text-main)]"
              >
                <option value="dashboard">Tổng quan — Trung tâm điều khiển</option>
                <option value="reader">Trình đọc văn bản — Đọc & Nghe tiếng Việt</option>
                <option value="literature">Thư viện văn học — Tác phẩm & Chú giải</option>
                <option value="music">Thư viện âm nhạc — Nhạc nền đọc sách</option>
                <option value="ai">Trợ lý văn học AI — Phân tích chuyên sâu</option>
                <option value="presentation">Thuyết trình — Trình chiếu bài giảng</option>
              </select>
            </div>
          </div>
        </section>
      )}

      {/* 3. Âm thanh & Giảm nhạc nền */}
      {activeTab === 'audio' && (
        <section className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6 space-y-5 text-xs">
          <h2 className="text-sm font-bold text-[var(--text-main)]">
            3. Cài đặt Âm thanh & Tự động giảm nhạc nền
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="rounded-lg bg-[var(--bg-surface)] p-4 space-y-3 border border-[var(--border-subtle)]">
              <div className="flex justify-between">
                <span className="font-semibold text-[var(--text-main)]">
                  Âm lượng nhạc nền mặc định
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
                  Mức giảm âm lượng khi đọc văn bản
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

      {/* 4. Cấu hình AI & Hạn mức */}
      {activeTab === 'ai' && (
        <section className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6 space-y-5 text-xs">
          <h2 className="text-sm font-bold text-[var(--text-main)]">
            4. Cấu hình Google Gemini AI & Quản lý Hạn mức
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-lg bg-[var(--bg-surface)] p-4 space-y-2 border border-[var(--border-subtle)]">
              <span className="text-[var(--text-muted)]">1. Hạn mức Literature Studio</span>
              <p className="font-tabular text-lg font-bold text-[var(--text-main)]">
                {quotaUsed} / {quotaLimit} lượt / ngày
              </p>
              <p className="text-[11px] text-[var(--text-muted)]">
                Mức phân bổ mặc định của hệ thống Literature Studio cho mỗi tài khoản ẩn danh trong ngày.
              </p>
            </div>

            <div className="rounded-lg bg-[var(--bg-surface)] p-4 space-y-2 border border-[var(--border-subtle)]">
              <span className="text-[var(--text-muted)]">2. Bảo mật khóa Gemini API</span>
              <p className="font-tabular text-lg font-bold text-[#E9C878]">
                Xử lý qua máy chủ (/api/ai)
              </p>
              <p className="text-[11px] text-[var(--text-muted)]">
                Khóa GEMINI_API_KEY được giữ hoàn toàn ở tầng Backend, không bao giờ lộ trên trình duyệt.
              </p>
            </div>

            <div className="rounded-lg bg-[var(--bg-surface)] p-4 space-y-2 border border-[var(--border-subtle)]">
              <span className="text-[var(--text-muted)]">3. Lưu trữ lịch sử AI</span>
              <p className="font-tabular text-lg font-bold text-[#36C98F]">
                Đồng bộ tự động
              </p>
              <p className="text-[11px] text-[var(--text-muted)]">
                Mọi cuộc hội thoại phân tích tác phẩm đều gắn với mã định danh người dùng ẩn danh của bạn.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-[var(--text-muted)] mb-1">
                Mô hình Gemini sử dụng
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
                <option value="gemini-4-hydrogen">gemini-4-hydrogen (Khuyên dùng)</option>
                <option value="gemini-3.1-flash-lite">gemini-3.1-flash-lite (Phản hồi nhanh)</option>
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
                <option value="deep">Phân tích chuyên sâu</option>
              </select>
            </div>
          </div>
        </section>
      )}

      {/* 5. Tài khoản ẩn danh & Đồng bộ */}
      {activeTab === 'account' && (
        <section
          data-testid="settings-account-section"
          className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6 space-y-5 text-xs"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-[var(--text-main)]">
                5. Xác thực Ẩn danh Supabase (Anonymous Auth) & Phân quyền RLS
              </h2>
              <p className="text-[11px] text-[var(--text-muted)]">
                Tự động khởi tạo phiên bằng supabase.auth.signInAnonymously(), duy trì UUID qua session.user.id và khóa quyền quản trị.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                data-testid="settings-retry-auth-btn"
                onClick={() => auth.retryAuth()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#8275F5] px-3 py-1.5 font-semibold text-white hover:bg-[#7162E8] transition-colors cursor-pointer"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Kiểm tra / Làm mới phiên</span>
              </button>
              <button
                type="button"
                data-testid="settings-test-auth-error-btn"
                onClick={() => auth.triggerConnectionErrorTest()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#F16C78]/40 bg-[#F16C78]/15 px-3 py-1.5 font-semibold text-[#F16C78] hover:bg-[#F16C78]/25 transition-colors cursor-pointer"
              >
                <AlertCircle className="h-3.5 w-3.5" />
                <span>Kiểm tra trạng thái lỗi kết nối</span>
              </button>
            </div>
          </div>

          <div className="rounded-lg bg-[var(--bg-surface)] p-5 border border-[var(--border-subtle)] space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-bold text-[var(--text-main)]">
                  {auth.displayName || user.username}
                </p>
                <p className="text-[var(--text-muted)]">
                  Chế độ xác thực: Tài khoản ẩn danh tự động (Không yêu cầu email, mật khẩu hoặc số điện thoại)
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span
                  data-testid="settings-auth-status"
                  className={`px-3 py-1 rounded-lg font-semibold ${
                    auth.status === 'initializing'
                      ? 'bg-[#E9C878]/15 text-[#E9C878]'
                      : auth.status === 'error'
                      ? 'bg-[#F16C78]/15 text-[#F16C78]'
                      : 'bg-[#36C98F]/15 text-[#36C98F]'
                  }`}
                >
                  {auth.status === 'initializing'
                    ? 'Đang khởi tạo...'
                    : auth.status === 'error'
                    ? 'Lỗi kết nối'
                    : 'Đã đăng nhập ẩn danh'}
                </span>
                <span className="px-3 py-1 rounded-lg bg-[#8275F5]/15 text-[#A78BFA] font-semibold">
                  {syncStatus === 'syncing'
                    ? VI.sync.syncing
                    : syncStatus === 'error'
                    ? VI.sync.failed
                    : VI.sync.synced}
                </span>
              </div>
            </div>

            {auth.status === 'error' && auth.error && (
              <div className="rounded-lg border border-[#F16C78]/40 bg-[#F16C78]/10 p-3 text-[#F16C78] flex items-center justify-between gap-3">
                <span>{auth.error}</span>
                <button
                  type="button"
                  onClick={() => auth.retryAuth()}
                  className="shrink-0 rounded bg-[#F16C78] px-3 py-1 text-white font-semibold cursor-pointer"
                >
                  Thử lại ngay
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-[var(--border-subtle)]">
              <div className="p-3 rounded-lg bg-[var(--bg-card)] space-y-1">
                <span className="text-[var(--text-muted)] block">
                  UUID người dùng (session.user.id):
                </span>
                <span
                  data-testid="settings-session-uuid"
                  className="font-mono font-semibold text-[#E9C878] break-all"
                >
                  {auth.userId || user.uid}
                </span>
              </div>

              <div className="p-3 rounded-lg bg-[var(--bg-card)] space-y-1">
                <span className="text-[var(--text-muted)] block">
                  Phân quyền bảo mật (RLS Role):
                </span>
                <span className="font-semibold text-[#36C98F] block">
                  role = &quot;{auth.role}&quot; (is_anonymous = true)
                </span>
                <span className="text-[11px] text-[var(--text-muted)] block">
                  Quyền Admin: Khóa • Quyền Teacher: Khóa
                </span>
              </div>

              <div className="p-3 rounded-lg bg-[var(--bg-card)] space-y-1">
                <span className="text-[var(--text-muted)] block">
                  Cơ chế lưu trữ & bảo vệ dữ liệu:
                </span>
                <span className="font-semibold text-[var(--text-main)] block">
                  {getSupabaseStatusLabel()}
                </span>
                <span className="text-[11px] text-[var(--text-muted)] block">
                  Chỉ sử dụng Publishable / Anon Key (Không dùng service_role ở frontend)
                </span>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 6. Bộ nhớ & Sao lưu */}
      {activeTab === 'storage' && (
        <section className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6 space-y-4 text-xs">
          <h2 className="text-sm font-bold text-[var(--text-main)]">
            6. Quản lý Lưu trữ Cục bộ & Sao lưu Dữ liệu
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-lg bg-[var(--bg-surface)] p-4 border border-[var(--border-subtle)]">
              <span className="text-[var(--text-muted)]">Dung lượng Âm nhạc</span>
              <p className="mt-1 font-tabular text-base font-bold text-[var(--text-main)]">
                {formatBytes(storageInfo.breakdown.tracksBytes)}
              </p>
            </div>
            <div className="rounded-lg bg-[var(--bg-surface)] p-4 border border-[var(--border-subtle)]">
              <span className="text-[var(--text-muted)]">Dung lượng Video</span>
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
              className="flex items-center gap-2 rounded-lg bg-[#8275F5] px-4 py-2 font-semibold text-white hover:bg-[#7162E8] cursor-pointer"
            >
              <Download className="h-4 w-4" />
              <span>Xuất toàn bộ dữ liệu Văn học, Ghi chú & Danh sách phát (.JSON)</span>
            </button>

            <button
              type="button"
              onClick={onResetLocalCache}
              className="flex items-center gap-2 rounded-lg border border-[#F16C78]/40 bg-[#F16C78]/15 px-4 py-2 font-semibold text-[#F16C78] hover:bg-[#F16C78] hover:text-white transition-colors cursor-pointer"
            >
              <Trash2 className="h-4 w-4" />
              <span>Xóa bộ nhớ đệm & Khôi phục dữ liệu mẫu</span>
            </button>
          </div>
        </section>
      )}

      {/* 7. Trạng thái kết nối */}
      {activeTab === 'connections' && (
        <div className="space-y-6 text-xs">
          <section className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-[var(--text-main)]">
                7. Kiểm tra Trạng thái Kết nối Hệ thống
              </h2>
              <button
                type="button"
                onClick={onRefreshHealth}
                className="flex items-center gap-1.5 rounded-lg bg-[var(--bg-surface)] px-3 py-1.5 font-medium text-[var(--text-main)] hover:bg-[#8275F5] hover:text-white transition-colors cursor-pointer"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Kiểm tra lại</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="rounded-lg bg-[var(--bg-surface)] p-4 border border-[var(--border-subtle)] flex items-center justify-between">
                <div>
                  <p className="font-semibold text-[var(--text-main)]">Google Gemini API</p>
                  <p className="text-[11px] text-[var(--text-muted)]">
                    Mô hình: {healthStatus?.services.defaultModel || 'gemini-4-hydrogen'}
                  </p>
                </div>
                {healthStatus?.services.geminiConfigured ? (
                  <span className="flex items-center gap-1 font-semibold text-[#36C98F]">
                    <CheckCircle2 className="h-4 w-4" /> Đã kết nối
                  </span>
                ) : (
                  <span className="flex items-center gap-1 font-semibold text-[#F16C78]">
                    <AlertCircle className="h-4 w-4" /> Chưa cấu hình
                  </span>
                )}
              </div>

              <div className="rounded-lg bg-[var(--bg-surface)] p-4 border border-[var(--border-subtle)] flex items-center justify-between">
                <div>
                  <p className="font-semibold text-[var(--text-main)]">Cơ sở dữ liệu & Đồng bộ</p>
                  <p className="text-[11px] text-[var(--text-muted)]">
                    {isSupabaseConfigured ? 'Supabase RLS' : 'Cloud SQL PostgreSQL'}
                  </p>
                </div>
                {healthStatus?.services.databaseConnected ? (
                  <span className="flex items-center gap-1 font-semibold text-[#36C98F]">
                    <CheckCircle2 className="h-4 w-4" /> Đã đồng bộ
                  </span>
                ) : (
                  <span className="flex items-center gap-1 font-semibold text-[#E9C878]">
                    <AlertCircle className="h-4 w-4" /> Lưu cục bộ
                  </span>
                )}
              </div>

              <div className="rounded-lg bg-[var(--bg-surface)] p-4 border border-[var(--border-subtle)] flex items-center justify-between">
                <div>
                  <p className="font-semibold text-[var(--text-main)]">Giọng đọc Tiếng Việt</p>
                  <p className="text-[11px] text-[var(--text-muted)]">
                    Chuẩn giọng vi-VN
                  </p>
                </div>
                {ttsSnapshot.hasVietnameseVoice ? (
                  <span className="flex items-center gap-1 font-semibold text-[#36C98F]">
                    <CheckCircle2 className="h-4 w-4" /> Sẵn sàng ({ttsSnapshot.voices.length})
                  </span>
                ) : (
                  <span className="flex items-center gap-1 font-semibold text-[#E9C878]">
                    <AlertTriangle className="h-4 w-4" /> Chưa có giọng vi-VN
                  </span>
                )}
              </div>

              <div className="rounded-lg bg-[var(--bg-surface)] p-4 border border-[var(--border-subtle)] flex items-center justify-between">
                <div>
                  <p className="font-semibold text-[var(--text-main)]">
                    Chia sẻ Âm thanh Trình chiếu
                  </p>
                  <p className="text-[11px] text-[var(--text-muted)]">
                    {meetingShareState === 'sharing_active' ? 'Đang chia sẻ' : 'Sẵn sàng'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleTestScreenShare}
                  className="flex items-center gap-1 rounded-lg bg-[#8275F5] px-3 py-1.5 font-semibold text-white cursor-pointer"
                >
                  <MonitorUp className="h-3.5 w-3.5" />
                  <span>Chia sẻ thẻ</span>
                </button>
              </div>
            </div>
          </section>

          {/* Hướng dẫn tích hợp Họp & Giảng dạy trực tuyến */}
          <section className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6 space-y-4">
            <h2 className="text-sm font-bold text-[var(--text-main)]">
              Hướng dẫn Tích hợp Họp & Giảng dạy Trực tuyến
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-lg bg-[var(--bg-surface)] p-4 border border-[var(--border-subtle)] space-y-2">
                <h3 className="font-bold text-[#E9C878]">01. Google Meet</h3>
                <ul className="space-y-1.5 text-[var(--text-muted)] list-disc pl-4">
                  <li>Nhấn nút "Trình bày ngay" trong Google Meet.</li>
                  <li>Chọn "Một thẻ trình duyệt" và chọn thẻ Literature Studio.</li>
                  <li>Bật tùy chọn "Chia sẻ âm thanh thẻ" để học sinh nghe rõ nhạc nền và giọng đọc văn bản.</li>
                </ul>
              </div>

              <div className="rounded-lg bg-[var(--bg-surface)] p-4 border border-[var(--border-subtle)] space-y-2">
                <h3 className="font-bold text-[#A78BFA]">02. Zoom</h3>
                <ul className="space-y-1.5 text-[var(--text-muted)] list-disc pl-4">
                  <li>Nhấn "Chia sẻ màn hình" trên thanh công cụ Zoom.</li>
                  <li>Đánh dấu ô "Chia sẻ âm thanh máy tính" ở góc dưới bên trái.</li>
                  <li>Mở chế độ Thuyết trình toàn màn hình trong Literature Studio để trình chiếu.</li>
                </ul>
              </div>

              <div className="rounded-lg bg-[var(--bg-surface)] p-4 border border-[var(--border-subtle)] space-y-2">
                <h3 className="font-bold text-[#36C98F]">03. Discord</h3>
                <ul className="space-y-1.5 text-[var(--text-muted)] list-disc pl-4">
                  <li>Sử dụng tính năng "Chia sẻ màn hình" và chọn cửa sổ trình duyệt để phát trực tiếp âm thanh vào kênh thoại.</li>
                  <li>Nhạc nền sẽ tự động giảm xuống khi giọng đọc văn bản tiếng Việt bắt đầu phát.</li>
                </ul>
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
};
