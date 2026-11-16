import React, { useRef, useState } from 'react';
import {
  Upload,
  Search,
  Play,
  Pause,
  Heart,
  Trash2,
  Edit3,
  Plus,
  Music2,
  Sliders,
  CheckSquare,
  Square,
  FolderPlus,
} from 'lucide-react';
import type { AudioTrack, DuckingConfig } from '../types/studio.ts';
import { AudioEngineState, masterAudioEngine } from '../services/audioEngine.ts';
import { formatBytes, formatDuration, synthesizeWavBytes } from '../utils/studioLogic.ts';
import { COVER_IMAGES } from '../data/seedLiterature.ts';

interface MusicLibraryViewProps {
  tracks: AudioTrack[];
  engineState: AudioEngineState;
  onAddTrack: (track: AudioTrack) => Promise<void>;
  onUpdateTrack: (track: AudioTrack) => Promise<void>;
  onDeleteTracks: (ids: string[]) => Promise<void>;
  onCreatePlaylistFromTracks: (name: string, trackIds: string[]) => Promise<void>;
}

export const MusicLibraryView: React.FC<MusicLibraryViewProps> = ({
  tracks,
  engineState,
  onAddTrack,
  onUpdateTrack,
  onDeleteTracks,
  onCreatePlaylistFromTracks,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'favorites' | 'WAV' | 'MP3'>('all');
  const [sortBy, setSortBy] = useState<'title' | 'artist' | 'duration' | 'size'>('title');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editingTrack, setEditingTrack] = useState<AudioTrack | null>(null);
  const [confirmDeleteIds, setConfirmDeleteIds] = useState<string[] | null>(null);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFilesSelected = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;

    for (const file of Array.from(fileList)) {
      const ext = (file.name.split('.').pop() || 'MP3').toUpperCase();
      if (!['MP3', 'WAV', 'OGG', 'M4A', 'FLAC'].includes(ext)) {
        setStatusMessage(`Định dạng .${ext} không nằm trong danh sách chuẩn (MP3, WAV, OGG, M4A, FLAC).`);
        continue;
      }

      // Measure duration using temporary Audio element
      const tempUrl = URL.createObjectURL(file);
      const durationSec = await new Promise<number>((resolve) => {
        const audio = new Audio(tempUrl);
        audio.onloadedmetadata = () => {
          URL.revokeObjectURL(tempUrl);
          resolve(Number.isFinite(audio.duration) ? Math.round(audio.duration) : 180);
        };
        audio.onerror = () => {
          URL.revokeObjectURL(tempUrl);
          resolve(120);
        };
      });

      const baseTitle = file.name.replace(/\.[^/.]+$/, '');
      const newTrack: AudioTrack = {
        id: `track-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        title: baseTitle,
        artist: 'Người dùng Import',
        album: 'Thư viện Cá nhân',
        duration: durationSec,
        fileSize: file.size,
        format: ext,
        coverUrl: COVER_IMAGES.acousticStudio,
        isFavorite: false,
        createdAt: new Date().toISOString(),
        audioBlob: file,
      };
      await onAddTrack(newTrack);
      setStatusMessage(`Đã thêm "${newTrack.title}" vào IndexedDB thành công.`);
    }
  };

  const handleSynthesizeStudioTrack = async () => {
    const scales = [
      {
        title: 'Khúc Ngâm Thu Vịnh — Hòa Tấu Sáo & Đàn Tranh',
        album: 'Tuyển Tập Thơ Thu Nguyễn Khuyến',
        notes: [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 392.0, 329.63],
        cover: COVER_IMAGES.truyenKieu,
      },
      {
        title: 'Giai Điệu Đêm Trăng Sông Hương — Ambient Piano',
        album: 'Không Gian Văn Học Hiện Đại',
        notes: [220.0, 277.18, 329.63, 440.0, 392.0, 329.63, 246.94, 220.0],
        cover: COVER_IMAGES.acousticStudio,
      },
    ];
    const pick = scales[tracks.length % scales.length];
    const wavBytes = synthesizeWavBytes({
      durationSec: 12,
      sampleRate: 22050,
      notesHz: pick.notes,
    });
    const blob = new Blob([wavBytes], { type: 'audio/wav' });
    const synthTrack: AudioTrack = {
      id: `track-synth-${Date.now()}`,
      title: pick.title,
      artist: 'Literature Studio Sound Lab',
      album: pick.album,
      duration: 12,
      fileSize: blob.size,
      format: 'WAV',
      coverUrl: pick.cover,
      isFavorite: false,
      createdAt: new Date().toISOString(),
      audioBlob: blob,
    };
    await onAddTrack(synthTrack);
    setStatusMessage(`Đã khởi tạo và lưu bản nhạc "${synthTrack.title}" vào IndexedDB.`);
  };

  const filteredTracks = tracks
    .filter((t) => {
      if (filterType === 'favorites' && !t.isFavorite) return false;
      if (filterType === 'WAV' && t.format !== 'WAV') return false;
      if (filterType === 'MP3' && t.format !== 'MP3') return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        t.title.toLowerCase().includes(q) ||
        t.artist.toLowerCase().includes(q) ||
        t.album.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      if (sortBy === 'title') return a.title.localeCompare(b.title);
      if (sortBy === 'artist') return a.artist.localeCompare(b.artist);
      if (sortBy === 'duration') return b.duration - a.duration;
      return b.fileSize - a.fileSize;
    });

  const toggleSelectId = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleDuckingChange = (partial: Partial<DuckingConfig>) => {
    masterAudioEngine.updateDuckingConfig(partial);
  };

  return (
    <div className="space-y-6 pb-8">
      {/* Header & Drag-Drop Import Zone */}
      <section
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          handleFilesSelected(e.dataTransfer.files);
        }}
        className={`rounded-xl border transition-colors p-6 ${
          isDragging
            ? 'border-[#8275F5] bg-[#8275F5]/10'
            : 'border-[var(--border-subtle)] bg-[var(--bg-card)]'
        }`}
      >
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-xl font-bold text-[var(--text-main)]">
              Thư viện Âm nhạc & Master Audio Ducking
            </h1>
            <p className="text-xs text-[var(--text-muted)]">
              Hỗ trợ kéo thả hoặc chọn file MP3, WAV, OGG, M4A, FLAC. Toàn bộ file âm thanh được lưu trữ bền vững trong IndexedDB.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <input
              ref={fileInputRef}
              type="file"
              accept=".mp3,.wav,.ogg,.m4a,.flac,audio/*"
              multiple
              onChange={(e) => handleFilesSelected(e.target.files)}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 rounded-lg bg-[#8275F5] px-4 py-2 text-xs font-semibold text-white hover:bg-[#7162E8] transition-colors whitespace-nowrap"
            >
              <Upload className="h-4 w-4" />
              <span>Import File Nhạc</span>
            </button>

            <button
              type="button"
              onClick={handleSynthesizeStudioTrack}
              className="flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-2 text-xs font-semibold text-[var(--text-main)] hover:border-[#E9C878] transition-colors whitespace-nowrap"
            >
              <Plus className="h-4 w-4 text-[#E9C878]" />
              <span>Tạo nhạc nền đọc sách mới</span>
            </button>
          </div>
        </div>

        {statusMessage && (
          <div className="mt-4 flex items-center justify-between rounded-lg bg-[#36C98F]/15 px-4 py-2.5 text-xs text-[#36C98F]">
            <span>{statusMessage}</span>
            <button
              type="button"
              onClick={() => setStatusMessage(null)}
              className="font-semibold hover:underline"
            >
              Đóng
            </button>
          </div>
        )}
      </section>

      {/* Audio Ducking Studio Configuration Panel */}
      <section className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sliders className="h-4 w-4 text-[#E9C878]" />
            <h2 className="text-sm font-bold text-[var(--text-main)]">
              Cấu hình Audio Ducking (Tự động giảm nhạc nền khi đọc văn bản / TTS)
            </h2>
          </div>
          <label className="flex items-center gap-2 text-xs font-medium text-[var(--text-main)] cursor-pointer">
            <input
              type="checkbox"
              checked={engineState.duckingConfig.enabled}
              onChange={(e) => handleDuckingChange({ enabled: e.target.checked })}
              className="h-4 w-4 accent-[#8275F5] rounded"
            />
            <span>Kích hoạt Audio Ducking tự động</span>
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-lg bg-[var(--bg-surface)] p-3.5 space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-[var(--text-muted)]">Mức âm lượng khi giảm (Ducking Level)</span>
              <span className="font-tabular font-semibold text-[#E9C878]">
                {engineState.duckingConfig.duckingLevelPercent}%
              </span>
            </div>
            <input
              type="range"
              aria-label="Mức giảm âm lượng Ducking"
              min={10}
              max={60}
              step={2}
              value={engineState.duckingConfig.duckingLevelPercent}
              onChange={(e) =>
                handleDuckingChange({ duckingLevelPercent: Number(e.target.value) })
              }
              className="w-full accent-[#8275F5] cursor-pointer"
            />
          </div>

          <div className="rounded-lg bg-[var(--bg-surface)] p-3.5 space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-[var(--text-muted)]">Thời gian giảm âm (Fade Duration)</span>
              <span className="font-tabular font-semibold text-[var(--text-main)]">
                {engineState.duckingConfig.fadeDurationMs} ms
              </span>
            </div>
            <input
              type="range"
              aria-label="Thời gian giảm âm Fade Duration"
              min={100}
              max={1500}
              step={50}
              value={engineState.duckingConfig.fadeDurationMs}
              onChange={(e) =>
                handleDuckingChange({ fadeDurationMs: Number(e.target.value) })
              }
              className="w-full accent-[#8275F5] cursor-pointer"
            />
          </div>

          <div className="rounded-lg bg-[var(--bg-surface)] p-3.5 space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-[var(--text-muted)]">Thời gian khôi phục (Restore Duration)</span>
              <span className="font-tabular font-semibold text-[var(--text-main)]">
                {engineState.duckingConfig.restoreDurationMs} ms
              </span>
            </div>
            <input
              type="range"
              aria-label="Thời gian khôi phục Restore Duration"
              min={200}
              max={2000}
              step={50}
              value={engineState.duckingConfig.restoreDurationMs}
              onChange={(e) =>
                handleDuckingChange({ restoreDurationMs: Number(e.target.value) })
              }
              className="w-full accent-[#8275F5] cursor-pointer"
            />
          </div>
        </div>
      </section>

      {/* Search, Filter, Sort & Multi-Select Toolbar */}
      <section className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm theo tên bài, nghệ sĩ, album..."
              aria-label="Tìm kiếm bài nhạc"
              className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] pl-9 pr-4 py-2 text-xs text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:border-[#8275F5] focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Interactive Filter Tabs */}
            <div className="flex items-center gap-1 rounded-lg bg-[var(--bg-surface)] p-1">
              {(['all', 'favorites', 'WAV', 'MP3'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setFilterType(tab)}
                  className={`rounded-md px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                    filterType === tab
                      ? 'bg-[#8275F5] text-white'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                  }`}
                >
                  {tab === 'all' ? 'Tất cả' : tab === 'favorites' ? 'Yêu thích' : tab}
                </button>
              ))}
            </div>

            <select
              aria-label="Sắp xếp danh sách nhạc"
              value={sortBy}
              onChange={(e) =>
                setSortBy(e.target.value as 'title' | 'artist' | 'duration' | 'size')
              }
              className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs text-[var(--text-main)] focus:border-[#8275F5] focus:outline-none"
            >
              <option value="title">Sắp xếp: Tên bài hát</option>
              <option value="artist">Sắp xếp: Nghệ sĩ</option>
              <option value="duration">Sắp xếp: Thời lượng</option>
              <option value="size">Sắp xếp: Dung lượng</option>
            </select>
          </div>
        </div>

        {/* Multi-select batch action bar */}
        {selectedIds.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[#8275F5]/15 px-4 py-2.5 border border-[#8275F5]/30">
            <span className="text-xs font-semibold text-[var(--text-main)]">
              Đã chọn {selectedIds.length} bài hát
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowPlaylistModal(true)}
                className="flex items-center gap-1.5 rounded-lg bg-[#8275F5] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#7162E8]"
              >
                <FolderPlus className="h-3.5 w-3.5" />
                <span>Tạo Playlist từ mục chọn</span>
              </button>
              <button
                type="button"
                onClick={() => setConfirmDeleteIds(selectedIds)}
                className="flex items-center gap-1.5 rounded-lg bg-[#F16C78] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Xóa mục đã chọn</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedIds([])}
                className="text-xs text-[var(--text-muted)] hover:text-[var(--text-main)] px-2"
              >
                Bỏ chọn
              </button>
            </div>
          </div>
        )}

        {/* Tracks Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[var(--border-subtle)] text-[11px] font-semibold text-[var(--text-muted)]">
                <th className="py-2.5 px-2 w-8">Chọn</th>
                <th className="py-2.5 px-3">Bài hát & Nghệ sĩ</th>
                <th className="py-2.5 px-3 hidden md:table-cell">Album</th>
                <th className="py-2.5 px-3">Định dạng · Kích thước</th>
                <th className="py-2.5 px-3 text-right">Thời lượng</th>
                <th className="py-2.5 px-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)] text-xs">
              {filteredTracks.map((track) => {
                const isCurrent = engineState.currentTrack?.id === track.id;
                const isSelected = selectedIds.includes(track.id);
                return (
                  <tr
                    key={track.id}
                    className={`transition-colors hover:bg-[var(--bg-surface)]/60 ${
                      isCurrent ? 'bg-[#8275F5]/10' : ''
                    }`}
                  >
                    <td className="py-3 px-2">
                      <button
                        type="button"
                        onClick={() => toggleSelectId(track.id)}
                        aria-label={`Chọn bài ${track.title}`}
                        className="text-[var(--text-muted)] hover:text-[var(--text-main)]"
                      >
                        {isSelected ? (
                          <CheckSquare className="h-4 w-4 text-[#8275F5]" />
                        ) : (
                          <Square className="h-4 w-4" />
                        )}
                      </button>
                    </td>

                    <td className="py-3 px-3">
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() =>
                            isCurrent
                              ? masterAudioEngine.togglePlay()
                              : masterAudioEngine.loadTrack(track, true)
                          }
                          aria-label={
                            isCurrent && engineState.isPlaying
                              ? `Tạm dừng ${track.title}`
                              : `Phát ${track.title}`
                          }
                          className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] group"
                        >
                          <img
                            src={track.coverUrl}
                            alt={track.title}
                            referrerPolicy="no-referrer"
                            className="h-full w-full object-cover"
                          />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
                            {isCurrent && engineState.isPlaying ? (
                              <Pause className="h-4 w-4 text-white" />
                            ) : (
                              <Play className="h-4 w-4 text-white" />
                            )}
                          </div>
                        </button>
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-[var(--text-main)]">
                            {track.title}
                          </p>
                          <p className="truncate text-[11px] text-[var(--text-muted)]">
                            {track.artist}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-3 hidden md:table-cell text-[var(--text-muted)]">
                      {track.album}
                    </td>

                    <td className="py-3 px-3 font-tabular text-[var(--text-muted)]">
                      {track.format} · {formatBytes(track.fileSize)}
                    </td>

                    <td className="py-3 px-3 text-right font-tabular text-[var(--text-main)]">
                      {formatDuration(track.duration)}
                    </td>

                    <td className="py-3 px-3 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateTrack({ ...track, isFavorite: !track.isFavorite })
                          }
                          aria-label={`Yêu thích ${track.title}`}
                          className="p-1.5 rounded-md hover:bg-[var(--bg-surface)]"
                        >
                          <Heart
                            className={`h-4 w-4 ${
                              track.isFavorite
                                ? 'text-[#E9C878] fill-[#E9C878]'
                                : 'text-[var(--text-muted)]'
                            }`}
                          />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingTrack({ ...track })}
                          aria-label={`Sửa thông tin ${track.title}`}
                          className="p-1.5 rounded-md text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-surface)]"
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteIds([track.id])}
                          aria-label={`Xóa ${track.title}`}
                          className="p-1.5 rounded-md text-[var(--text-muted)] hover:text-[#F16C78] hover:bg-[var(--bg-surface)]"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filteredTracks.length === 0 && (
            <div className="py-12 text-center space-y-2">
              <Music2 className="mx-auto h-8 w-8 text-[var(--text-muted)]" />
              <p className="text-sm font-semibold text-[var(--text-main)]">
                Không tìm thấy bài nhạc phù hợp
              </p>
              <p className="text-xs text-[var(--text-muted)]">
                Thử từ khóa khác hoặc nhấn "Import File Nhạc" để thêm nhạc mới.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Edit Metadata Modal */}
      {editingTrack && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Chỉnh sửa Metadata bài hát"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
        >
          <div className="w-full max-w-md rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6 space-y-4">
            <h3 className="text-base font-bold text-[var(--text-main)]">
              Chỉnh sửa Metadata bài hát
            </h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[var(--text-muted)] mb-1">Tên bài hát (Song Title)</label>
                <input
                  type="text"
                  value={editingTrack.title}
                  onChange={(e) =>
                    setEditingTrack({ ...editingTrack, title: e.target.value })
                  }
                  className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-[var(--text-main)]"
                />
              </div>
              <div>
                <label className="block text-[var(--text-muted)] mb-1">Nghệ sĩ (Artist)</label>
                <input
                  type="text"
                  value={editingTrack.artist}
                  onChange={(e) =>
                    setEditingTrack({ ...editingTrack, artist: e.target.value })
                  }
                  className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-[var(--text-main)]"
                />
              </div>
              <div>
                <label className="block text-[var(--text-muted)] mb-1">Album</label>
                <input
                  type="text"
                  value={editingTrack.album}
                  onChange={(e) =>
                    setEditingTrack({ ...editingTrack, album: e.target.value })
                  }
                  className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-[var(--text-main)]"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingTrack(null)}
                className="rounded-lg bg-[var(--bg-surface)] px-4 py-2 text-xs font-medium text-[var(--text-main)]"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={async () => {
                  await onUpdateTrack(editingTrack);
                  setEditingTrack(null);
                  setStatusMessage('Đã lưu thông tin metadata bài hát vào IndexedDB.');
                }}
                className="rounded-lg bg-[#8275F5] px-4 py-2 text-xs font-semibold text-white"
              >
                Lưu thay đổi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {confirmDeleteIds && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Xác nhận xóa bài hát"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
        >
          <div className="w-full max-w-sm rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6 space-y-4">
            <h3 className="text-base font-bold text-[var(--text-main)]">
              Xác nhận xóa khỏi thư viện
            </h3>
            <p className="text-xs text-[var(--text-muted)]">
              Bạn có chắc chắn muốn xóa {confirmDeleteIds.length} bài hát đã chọn khỏi bộ nhớ IndexedDB? Thao tác này không thể hoàn tác.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteIds(null)}
                className="rounded-lg bg-[var(--bg-surface)] px-4 py-2 text-xs font-medium text-[var(--text-main)]"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={async () => {
                  await onDeleteTracks(confirmDeleteIds);
                  setSelectedIds((prev) =>
                    prev.filter((id) => !confirmDeleteIds.includes(id))
                  );
                  setConfirmDeleteIds(null);
                }}
                className="rounded-lg bg-[#F16C78] px-4 py-2 text-xs font-semibold text-white"
              >
                Xác nhận xóa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Playlist from Selection Modal */}
      {showPlaylistModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Tạo Playlist mới"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
        >
          <div className="w-full max-w-sm rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6 space-y-4">
            <h3 className="text-base font-bold text-[var(--text-main)]">
              Tạo Playlist từ {selectedIds.length} bài đã chọn
            </h3>
            <input
              type="text"
              value={newPlaylistName}
              onChange={(e) => setNewPlaylistName(e.target.value)}
              placeholder="Nhập tên Playlist mới..."
              className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-xs text-[var(--text-main)]"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowPlaylistModal(false)}
                className="rounded-lg bg-[var(--bg-surface)] px-4 py-2 text-xs font-medium text-[var(--text-main)]"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!newPlaylistName.trim()) return;
                  await onCreatePlaylistFromTracks(newPlaylistName.trim(), selectedIds);
                  setNewPlaylistName('');
                  setSelectedIds([]);
                  setShowPlaylistModal(false);
                  setStatusMessage('Đã tạo Playlist mới thành công.');
                }}
                className="rounded-lg bg-[#8275F5] px-4 py-2 text-xs font-semibold text-white"
              >
                Tạo Playlist
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
