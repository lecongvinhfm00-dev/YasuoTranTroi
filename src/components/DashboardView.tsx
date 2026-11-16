import React, { useEffect, useState } from 'react';
import {
  Music,
  Sparkles,
  Presentation,
  BookOpen,
  Upload,
  ListPlus,
  Play,
  HardDrive,
  Clock,
  Heart,
  MessageSquare,
} from 'lucide-react';
import type {
  AudioTrack,
  ConversationItem,
  LiteratureDocument,
  NavigationModule,
  PlaylistItem,
  UserProfile,
} from '../types/studio.ts';
import { masterAudioEngine } from '../services/audioEngine.ts';
import { formatBytes, formatDuration } from '../utils/studioLogic.ts';
import type { StudioActivityLog } from '../services/indexedDbService.ts';

interface DashboardViewProps {
  user: UserProfile;
  tracks: AudioTrack[];
  documents: LiteratureDocument[];
  playlists: PlaylistItem[];
  conversations: ConversationItem[];
  activities: StudioActivityLog[];
  storageInfo: {
    usedBytes: number;
    quotaBytes: number;
    breakdown: { tracksBytes: number; videosBytes: number; docsBytes: number };
  };
  quotaUsed: number;
  quotaLimit: number;
  geminiHealthy: boolean;
  onSelectModule: (mod: NavigationModule) => void;
  onOpenDocument: (doc: LiteratureDocument) => void;
  onTriggerMediaImport: () => void;
  onTriggerCreatePlaylist: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  user,
  tracks,
  documents,
  playlists,
  conversations,
  activities,
  storageInfo,
  quotaUsed,
  quotaLimit,
  geminiHealthy,
  onSelectModule,
  onOpenDocument,
  onTriggerMediaImport,
  onTriggerCreatePlaylist,
}) => {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const favoritePlaylists = playlists.filter((p) => p.isFavorite);
  const quotaRemaining = Math.max(0, quotaLimit - quotaUsed);

  return (
    <div className="space-y-6 pb-8">
      {/* 1. Welcome Banner & Live Clock */}
      <section className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-[#E9C878]">
              Không gian làm việc Văn học & Âm thanh học thuật
            </p>
            <h1 className="text-2xl font-bold tracking-tight text-[var(--text-main)]">
              Xin chào, {user.username}
            </h1>
            <p className="text-sm text-[var(--text-muted)] max-w-2xl">
              Quản lý thư viện tác phẩm văn học, điều phối nhạc nền thông minh với Audio Ducking, và chuẩn bị bài thuyết trình cùng Trợ lý Ngữ văn Gemini.
            </p>
          </div>

          <div className="flex flex-col items-start md:items-end justify-center rounded-lg bg-[var(--bg-surface)] px-4 py-3 border border-[var(--border-subtle)] shrink-0">
            <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
              <Clock className="h-3.5 w-3.5 text-[#8275F5]" />
              <span>Thời gian hệ thống</span>
            </div>
            <p className="mt-1 font-tabular text-lg font-bold text-[var(--text-main)]">
              {now.toLocaleTimeString('vi-VN', { hour12: false })}
            </p>
            <p className="text-xs text-[var(--text-muted)]">
              {now.toLocaleDateString('vi-VN', {
                weekday: 'long',
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
              })}
            </p>
          </div>
        </div>

        {/* 7. Quick Actions (6 Actions) */}
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 gap-3">
          <button
            type="button"
            onClick={() => onSelectModule('music')}
            className="flex items-center gap-2.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3.5 py-2.5 text-left text-xs font-semibold text-[var(--text-main)] hover:border-[#8275F5] transition-colors whitespace-nowrap"
          >
            <Music className="h-4 w-4 shrink-0 text-[#8275F5]" />
            <span className="truncate">Open Music Player</span>
          </button>

          <button
            type="button"
            onClick={() => onSelectModule('ai')}
            className="flex items-center gap-2.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3.5 py-2.5 text-left text-xs font-semibold text-[var(--text-main)] hover:border-[#E9C878] transition-colors whitespace-nowrap"
          >
            <Sparkles className="h-4 w-4 shrink-0 text-[#E9C878]" />
            <span className="truncate">Open AI Assistant</span>
          </button>

          <button
            type="button"
            onClick={() => onSelectModule('presentation')}
            className="flex items-center gap-2.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3.5 py-2.5 text-left text-xs font-semibold text-[var(--text-main)] hover:border-[#A78BFA] transition-colors whitespace-nowrap"
          >
            <Presentation className="h-4 w-4 shrink-0 text-[#A78BFA]" />
            <span className="truncate">Create Presentation</span>
          </button>

          <button
            type="button"
            onClick={() => onSelectModule('literature')}
            className="flex items-center gap-2.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3.5 py-2.5 text-left text-xs font-semibold text-[var(--text-main)] hover:border-[#36C98F] transition-colors whitespace-nowrap"
          >
            <BookOpen className="h-4 w-4 shrink-0 text-[#36C98F]" />
            <span className="truncate">Open Literature Library</span>
          </button>

          <button
            type="button"
            onClick={onTriggerMediaImport}
            className="flex items-center gap-2.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3.5 py-2.5 text-left text-xs font-semibold text-[var(--text-main)] hover:border-[#8275F5] transition-colors whitespace-nowrap"
          >
            <Upload className="h-4 w-4 shrink-0 text-[#8275F5]" />
            <span className="truncate">Import Media</span>
          </button>

          <button
            type="button"
            onClick={onTriggerCreatePlaylist}
            className="flex items-center gap-2.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3.5 py-2.5 text-left text-xs font-semibold text-[var(--text-main)] hover:border-[#E9C878] transition-colors whitespace-nowrap"
          >
            <ListPlus className="h-4 w-4 shrink-0 text-[#E9C878]" />
            <span className="truncate">Create Playlist</span>
          </button>
        </div>
      </section>

      {/* Metrics Row: Storage Usage, AI Usage Statistics, Connection Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 8. Storage Usage */}
        <section className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
            <span>Dung lượng lưu trữ cục bộ (IndexedDB)</span>
            <HardDrive className="h-4 w-4 text-[#8275F5]" />
          </div>
          <p className="font-tabular text-xl font-bold text-[var(--text-main)]">
            {formatBytes(storageInfo.usedBytes)}
          </p>
          <p className="text-xs text-[var(--text-muted)]">
            Âm nhạc: {formatBytes(storageInfo.breakdown.tracksBytes)} · Video:{' '}
            {formatBytes(storageInfo.breakdown.videosBytes)} · Văn bản:{' '}
            {formatBytes(storageInfo.breakdown.docsBytes)}
          </p>
        </section>

        {/* 9. AI Usage Statistics */}
        <section className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
            <span>Thống kê sử dụng AI hôm nay</span>
            <Sparkles className="h-4 w-4 text-[#E9C878]" />
          </div>
          <p className="font-tabular text-xl font-bold text-[var(--text-main)]">
            Đã dùng {quotaUsed} / {quotaLimit} lượt
          </p>
          <p className="text-xs text-[var(--text-muted)]">
            Còn lại <span className="font-tabular font-semibold text-[#36C98F]">{quotaRemaining} lượt</span> ·
            Hội thoại đã lưu: <span className="font-tabular">{conversations.length}</span>
          </p>
        </section>

        {/* 10. Connection Status */}
        <section className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
            <span>Trạng thái dịch vụ hệ thống</span>
            <span className="font-tabular font-semibold text-[#36C98F]">
              {geminiHealthy ? 'Sẵn sàng' : 'Chờ cấu hình'}
            </span>
          </div>
          <p className="text-base font-bold text-[var(--text-main)]">
            {geminiHealthy ? 'Gemini AI & Đồng bộ Hoạt động' : 'Chế độ ngoại tuyến cục bộ'}
          </p>
          <p className="text-xs text-[var(--text-muted)]">
            Model mặc định: gemini-4-hydrogen · Audio Engine: Web Audio API
          </p>
        </section>
      </div>

      {/* Main Content Grid: Recently Played, Recent Documents, Favorite Playlists, Recent AI */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 3. Recently Played Music */}
        <section className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-[var(--text-main)]">
              01. Âm nhạc phát gần đây (Recently Played)
            </h2>
            <button
              type="button"
              onClick={() => onSelectModule('music')}
              className="text-xs font-medium text-[#A78BFA] hover:underline"
            >
              Xem thư viện
            </button>
          </div>

          <div className="divide-y divide-[var(--border-subtle)]">
            {tracks.slice(0, 4).map((track) => (
              <div
                key={track.id}
                className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <img
                    src={track.coverUrl}
                    alt={track.title}
                    referrerPolicy="no-referrer"
                    className="h-10 w-10 rounded-lg object-cover border border-[var(--border-subtle)] shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-[var(--text-main)]">
                      {track.title}
                    </p>
                    <p className="truncate text-[11px] text-[var(--text-muted)]">
                      {track.artist} · {track.format} · {formatDuration(track.duration)}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => masterAudioEngine.loadTrack(track, true)}
                  aria-label={`Phát ${track.title}`}
                  className="flex items-center gap-1 rounded-lg bg-[var(--bg-surface)] px-3 py-1.5 text-xs font-medium text-[var(--text-main)] hover:bg-[#8275F5] hover:text-white transition-colors shrink-0"
                >
                  <Play className="h-3.5 w-3.5" />
                  <span>Phát</span>
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* 4. Recent Documents */}
        <section className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-[var(--text-main)]">
              02. Tác phẩm & Tài liệu gần đây (Recent Documents)
            </h2>
            <button
              type="button"
              onClick={() => onSelectModule('literature')}
              className="text-xs font-medium text-[#A78BFA] hover:underline"
            >
              Mở thư viện Văn học
            </button>
          </div>

          <div className="divide-y divide-[var(--border-subtle)]">
            {documents.slice(0, 4).map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
              >
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-[var(--text-main)]">
                    {doc.title}
                  </p>
                  <p className="truncate text-[11px] text-[var(--text-muted)]">
                    {doc.author} · {doc.category} · {doc.highlights.length} ghi chú
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onOpenDocument(doc)}
                  className="rounded-lg bg-[var(--bg-surface)] px-3 py-1.5 text-xs font-medium text-[var(--text-main)] hover:bg-[#8275F5] hover:text-white transition-colors shrink-0"
                >
                  Đọc & Phân tích
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* 5. Favorite Playlists */}
        <section className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-[var(--text-main)]">
              03. Danh sách phát yêu thích (Favorite Playlists)
            </h2>
            <button
              type="button"
              onClick={() => onSelectModule('playlist')}
              className="text-xs font-medium text-[#A78BFA] hover:underline"
            >
              Quản lý Playlist
            </button>
          </div>

          <div className="space-y-2.5">
            {favoritePlaylists.length > 0 ? (
              favoritePlaylists.map((pl) => (
                <div
                  key={pl.id}
                  className="flex items-center justify-between gap-3 rounded-lg bg-[var(--bg-surface)] p-3 border border-[var(--border-subtle)]"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <Heart className="h-3.5 w-3.5 text-[#E9C878] fill-[#E9C878]" />
                      <p className="truncate text-xs font-semibold text-[var(--text-main)]">
                        {pl.name}
                      </p>
                    </div>
                    <p className="mt-0.5 truncate text-[11px] text-[var(--text-muted)]">
                      {pl.description} · {pl.trackIds.length} bài nhạc
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const plTracks = tracks.filter((t) => pl.trackIds.includes(t.id));
                      if (plTracks.length > 0) {
                        masterAudioEngine.setQueue(plTracks, false);
                        masterAudioEngine.loadTrack(plTracks[0], true);
                      }
                    }}
                    className="rounded-lg bg-[#8275F5] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#7162E8] transition-colors shrink-0"
                  >
                    Phát bộ
                  </button>
                </div>
              ))
            ) : (
              <p className="text-xs text-[var(--text-muted)]">
                Chưa có playlist yêu thích. Hãy đánh dấu yêu thích trong mục Playlist.
              </p>
            )}
          </div>
        </section>

        {/* 6. Recently Used AI & Workspace Activity */}
        <section className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-[var(--text-main)]">
              04. Hoạt động AI & Không gian làm việc gần đây
            </h2>
            <button
              type="button"
              onClick={() => onSelectModule('ai')}
              className="text-xs font-medium text-[#A78BFA] hover:underline"
            >
              Mở Trợ lý AI
            </button>
          </div>

          <div className="divide-y divide-[var(--border-subtle)]">
            {conversations.length > 0 ? (
              conversations.slice(0, 3).map((conv) => (
                <div
                  key={String(conv.id)}
                  className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <MessageSquare className="h-4 w-4 shrink-0 text-[#8275F5]" />
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-[var(--text-main)]">
                        {conv.title}
                      </p>
                      <p className="text-[11px] text-[var(--text-muted)]">
                        {conv.messages.length} phản hồi · {conv.mode}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onSelectModule('ai')}
                    className="rounded-lg bg-[var(--bg-surface)] px-2.5 py-1 text-xs font-medium text-[var(--text-main)] hover:bg-[#8275F5] hover:text-white transition-colors shrink-0"
                  >
                    Tiếp tục
                  </button>
                </div>
              ))
            ) : (
              activities.slice(0, 3).map((act) => (
                <div
                  key={act.id}
                  className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-[var(--text-main)]">
                      {act.title}
                    </p>
                    <p className="truncate text-[11px] text-[var(--text-muted)]">
                      {act.subtitle}
                    </p>
                  </div>
                  <span className="font-tabular text-[11px] text-[var(--text-muted)] shrink-0">
                    {new Date(act.timestamp).toLocaleTimeString('vi-VN', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
};
