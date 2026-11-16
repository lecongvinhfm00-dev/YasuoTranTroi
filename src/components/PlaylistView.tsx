import React, { useRef, useState } from 'react';
import {
  ListMusic,
  Plus,
  Play,
  Heart,
  Trash2,
  ArrowUp,
  ArrowDown,
  Download,
  Upload,
  Edit3,
} from 'lucide-react';
import type { AudioTrack, PlaylistItem } from '../types/studio.ts';
import { AudioEngineState, masterAudioEngine } from '../services/audioEngine.ts';
import { formatDuration } from '../utils/studioLogic.ts';

interface PlaylistViewProps {
  playlists: PlaylistItem[];
  tracks: AudioTrack[];
  engineState: AudioEngineState;
  onSavePlaylist: (pl: PlaylistItem) => Promise<void>;
  onDeletePlaylist: (id: string) => Promise<void>;
}

export const PlaylistView: React.FC<PlaylistViewProps> = ({
  playlists,
  tracks,
  engineState,
  onSavePlaylist,
  onDeletePlaylist,
}) => {
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string>(
    playlists[0]?.id || ''
  );
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [renamingName, setRenamingName] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);

  const importInputRef = useRef<HTMLInputElement | null>(null);

  const activePlaylist =
    playlists.find((p) => p.id === selectedPlaylistId) || playlists[0] || null;

  const playlistTracks = activePlaylist
    ? activePlaylist.trackIds
        .map((id) => tracks.find((t) => t.id === id))
        .filter((t): t is AudioTrack => Boolean(t))
    : [];

  const availableTracksToAdd = activePlaylist
    ? tracks.filter((t) => !activePlaylist.trackIds.includes(t.id))
    : [];

  const handleCreatePlaylist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    const pl: PlaylistItem = {
      id: `pl-${Date.now()}`,
      name: newName.trim(),
      description: newDesc.trim() || 'Danh sách phát tùy chỉnh trong Literature Studio.',
      trackIds: tracks.slice(0, 2).map((t) => t.id),
      isFavorite: false,
      createdAt: new Date().toISOString(),
    };
    await onSavePlaylist(pl);
    setSelectedPlaylistId(pl.id);
    setNewName('');
    setNewDesc('');
  };

  const handleReorderTrack = async (idx: number, direction: -1 | 1) => {
    if (!activePlaylist) return;
    const nextIdx = idx + direction;
    if (nextIdx < 0 || nextIdx >= activePlaylist.trackIds.length) return;
    const copy = [...activePlaylist.trackIds];
    const [moved] = copy.splice(idx, 1);
    copy.splice(nextIdx, 0, moved);
    await onSavePlaylist({ ...activePlaylist, trackIds: copy });
  };

  const handleSaveCurrentQueueAsPlaylist = async () => {
    if (engineState.queue.length === 0) return;
    const pl: PlaylistItem = {
      id: `pl-queue-${Date.now()}`,
      name: `Danh sách chờ (${new Date().toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
      })})`,
      description: 'Lưu trực tiếp từ hàng đợi Master Bot Player.',
      trackIds: engineState.queue.map((t) => t.id),
      isFavorite: true,
      createdAt: new Date().toISOString(),
    };
    await onSavePlaylist(pl);
    setSelectedPlaylistId(pl.id);
  };

  const handleExportPlaylist = () => {
    if (!activePlaylist) return;
    const blob = new Blob([JSON.stringify(activePlaylist, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activePlaylist.name.replace(/\s+/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportPlaylistJson = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    try {
      const text = await files[0].text();
      const parsed = JSON.parse(text);
      if (parsed && parsed.name) {
        const imported: PlaylistItem = {
          id: `pl-imp-${Date.now()}`,
          name: String(parsed.name),
          description: String(parsed.description || 'Playlist được Import từ JSON'),
          trackIds: Array.isArray(parsed.trackIds) ? parsed.trackIds : [],
          isFavorite: Boolean(parsed.isFavorite),
          createdAt: new Date().toISOString(),
        };
        await onSavePlaylist(imported);
        setSelectedPlaylistId(imported.id);
      }
    } catch {
      // ignore invalid json
    }
  };

  return (
    <div className="space-y-6 pb-8">
      {/* Header & Create Form */}
      <section className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-[var(--text-main)]">
              Quản lý Playlist & Hàng đợi Âm thanh (Queue Management)
            </h1>
            <p className="text-xs text-[var(--text-muted)]">
              Tạo, đổi tên, sắp xếp thứ tự bài nhạc, đồng bộ trực tiếp với Master Bot Player và hỗ trợ Import/Export JSON.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleSaveCurrentQueueAsPlaylist}
              className="flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3.5 py-2 text-xs font-semibold text-[var(--text-main)] hover:border-[#E9C878] transition-colors"
            >
              <ListMusic className="h-4 w-4 text-[#E9C878]" />
              <span>Lưu Queue hiện tại thành Playlist</span>
            </button>

            <input
              ref={importInputRef}
              type="file"
              accept=".json,application/json"
              onChange={(e) => handleImportPlaylistJson(e.target.files)}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => importInputRef.current?.click()}
              className="flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3.5 py-2 text-xs font-semibold text-[var(--text-main)] hover:border-[#8275F5]"
            >
              <Upload className="h-4 w-4 text-[#8275F5]" />
              <span>Import JSON</span>
            </button>
          </div>
        </div>

        <form onSubmit={handleCreatePlaylist} className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Tên Playlist mới (VD: Nhạc nền đọc Truyện Kiều)..."
            aria-label="Tên Playlist mới"
            className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-[var(--text-main)]"
          />
          <input
            type="text"
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            placeholder="Mô tả không gian âm nhạc..."
            aria-label="Mô tả Playlist mới"
            className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-[var(--text-main)]"
          />
          <button
            type="submit"
            className="flex items-center justify-center gap-1.5 rounded-lg bg-[#8275F5] px-4 py-2 font-semibold text-white hover:bg-[#7162E8] transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>Tạo Playlist mới</span>
          </button>
        </form>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Playlists List */}
        <div className="lg:col-span-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 space-y-3 h-fit">
          <h2 className="text-xs font-bold text-[var(--text-main)]">
            Danh sách Playlist ({playlists.length})
          </h2>
          <div className="space-y-2">
            {playlists.map((pl) => {
              const isSelected = activePlaylist?.id === pl.id;
              return (
                <div
                  key={pl.id}
                  onClick={() => setSelectedPlaylistId(pl.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') setSelectedPlaylistId(pl.id);
                  }}
                  className={`cursor-pointer rounded-lg border p-3.5 transition-colors ${
                    isSelected
                      ? 'border-[#8275F5] bg-[#8275F5]/15'
                      : 'border-[var(--border-subtle)] bg-[var(--bg-surface)]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-bold text-[var(--text-main)] truncate">
                      {pl.name}
                    </p>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={async (e) => {
                          e.stopPropagation();
                          await onSavePlaylist({ ...pl, isFavorite: !pl.isFavorite });
                        }}
                        aria-label={`Yêu thích playlist ${pl.name}`}
                        className="p-1"
                      >
                        <Heart
                          className={`h-3.5 w-3.5 ${
                            pl.isFavorite
                              ? 'text-[#E9C878] fill-[#E9C878]'
                              : 'text-[var(--text-muted)]'
                          }`}
                        />
                      </button>
                      <button
                        type="button"
                        onClick={async (e) => {
                          e.stopPropagation();
                          await onDeletePlaylist(pl.id);
                        }}
                        aria-label={`Xóa playlist ${pl.name}`}
                        className="p-1 text-[var(--text-muted)] hover:text-[#F16C78]"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <p className="mt-1 text-[11px] text-[var(--text-muted)] line-clamp-1">
                    {pl.description}
                  </p>
                  <p className="mt-1 font-tabular text-[11px] text-[#E9C878]">
                    {pl.trackIds.length} bài nhạc
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Active Playlist Tracks & Reordering */}
        {activePlaylist ? (
          <div className="lg:col-span-8 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-subtle)] pb-4">
              <div>
                {isRenaming ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={renamingName}
                      onChange={(e) => setRenamingName(e.target.value)}
                      className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-1 text-sm text-[var(--text-main)]"
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        if (renamingName.trim()) {
                          await onSavePlaylist({
                            ...activePlaylist,
                            name: renamingName.trim(),
                          });
                        }
                        setIsRenaming(false);
                      }}
                      className="rounded-lg bg-[#8275F5] px-3 py-1 text-xs font-semibold text-white"
                    >
                      Lưu tên
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-[var(--text-main)]">
                      {activePlaylist.name}
                    </h2>
                    <button
                      type="button"
                      onClick={() => {
                        setRenamingName(activePlaylist.name);
                        setIsRenaming(true);
                      }}
                      aria-label="Đổi tên Playlist"
                      className="text-[var(--text-muted)] hover:text-[var(--text-main)]"
                    >
                      <Edit3 className="h-4 w-4" />
                    </button>
                  </div>
                )}
                <p className="text-xs text-[var(--text-muted)]">
                  {activePlaylist.description}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (playlistTracks.length > 0) {
                      masterAudioEngine.setQueue(playlistTracks, false);
                      masterAudioEngine.loadTrack(playlistTracks[0], true);
                    }
                  }}
                  className="flex items-center gap-1.5 rounded-lg bg-[#8275F5] px-4 py-2 text-xs font-semibold text-white hover:bg-[#7162E8]"
                >
                  <Play className="h-4 w-4" />
                  <span>Phát toàn bộ Playlist</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportPlaylist}
                  className="flex items-center gap-1.5 rounded-lg bg-[var(--bg-surface)] px-3 py-2 text-xs font-medium text-[var(--text-main)] hover:bg-[#8275F5] hover:text-white transition-colors"
                >
                  <Download className="h-4 w-4" />
                  <span>Export JSON</span>
                </button>
              </div>
            </div>

            {/* Tracks inside Playlist */}
            <div className="space-y-2">
              {playlistTracks.map((track, idx) => (
                <div
                  key={track.id}
                  className="flex items-center justify-between gap-3 rounded-lg bg-[var(--bg-surface)] p-3 border border-[var(--border-subtle)]"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="font-tabular text-xs text-[var(--text-muted)] w-5">
                      {idx + 1}.
                    </span>
                    <img
                      src={track.coverUrl}
                      alt={track.title}
                      referrerPolicy="no-referrer"
                      className="h-9 w-9 rounded-md object-cover"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-[var(--text-main)]">
                        {track.title}
                      </p>
                      <p className="truncate text-[11px] text-[var(--text-muted)]">
                        {track.artist} · {formatDuration(track.duration)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleReorderTrack(idx, -1)}
                      aria-label="Chuyển lên"
                      className="p-1 text-[var(--text-muted)] hover:text-[var(--text-main)]"
                    >
                      <ArrowUp className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleReorderTrack(idx, 1)}
                      aria-label="Chuyển xuống"
                      className="p-1 text-[var(--text-muted)] hover:text-[var(--text-main)]"
                    >
                      <ArrowDown className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        const nextIds = activePlaylist.trackIds.filter(
                          (id) => id !== track.id
                        );
                        await onSavePlaylist({ ...activePlaylist, trackIds: nextIds });
                      }}
                      aria-label={`Gỡ ${track.title} khỏi playlist`}
                      className="p-1 text-[var(--text-muted)] hover:text-[#F16C78]"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Add More Tracks to Playlist */}
            {availableTracksToAdd.length > 0 && (
              <div className="pt-3 border-t border-[var(--border-subtle)] space-y-2">
                <h3 className="text-xs font-bold text-[var(--text-muted)]">
                  Thêm bài nhạc có sẵn vào Playlist này:
                </h3>
                <div className="flex flex-wrap gap-2">
                  {availableTracksToAdd.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={async () => {
                        await onSavePlaylist({
                          ...activePlaylist,
                          trackIds: [...activePlaylist.trackIds, t.id],
                        });
                      }}
                      className="flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs text-[var(--text-main)] hover:border-[#8275F5]"
                    >
                      <Plus className="h-3.5 w-3.5 text-[#8275F5]" />
                      <span>{t.title}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
};
