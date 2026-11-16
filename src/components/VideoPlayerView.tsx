import React, { useEffect, useRef, useState } from 'react';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Upload,
  Subtitles,
  PictureInPicture2,
  Film,
  Trash2,
} from 'lucide-react';
import type { VideoItem } from '../types/studio.ts';
import { formatBytes, formatDuration } from '../utils/studioLogic.ts';

interface VideoPlayerViewProps {
  videos: VideoItem[];
  onAddVideo: (video: VideoItem) => Promise<void>;
  onDeleteVideo: (id: string) => Promise<void>;
}

export const VideoPlayerView: React.FC<VideoPlayerViewProps> = ({
  videos,
  onAddVideo,
  onDeleteVideo,
}) => {
  const [activeVideo, setActiveVideo] = useState<VideoItem | null>(videos[0] || null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(activeVideo?.duration || 24);
  const [volume, setVolume] = useState(0.85);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [showSubtitles, setShowSubtitles] = useState(true);
  const [videoObjectUrl, setVideoObjectUrl] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoElRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!activeVideo && videos.length > 0) {
      setActiveVideo(videos[0]);
    }
  }, [videos, activeVideo]);

  useEffect(() => {
    if (!activeVideo) return;
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(activeVideo.duration || 24);

    if (videoObjectUrl) {
      URL.revokeObjectURL(videoObjectUrl);
      setVideoObjectUrl(null);
    }

    if (activeVideo.videoBlob && !activeVideo.isSynthesized) {
      const url = URL.createObjectURL(activeVideo.videoBlob);
      setVideoObjectUrl(url);
    }
  }, [activeVideo]);

  // Timer loop for synthesized poetic canvas videos
  useEffect(() => {
    if (!activeVideo?.isSynthesized || !isPlaying) return;
    const interval = setInterval(() => {
      setCurrentTime((prev) => {
        const next = prev + 0.1 * playbackSpeed;
        if (next >= duration) {
          setIsPlaying(false);
          return 0;
        }
        return next;
      });
    }, 100);
    return () => clearInterval(interval);
  }, [activeVideo, isPlaying, playbackSpeed, duration]);

  // Render poetic visual frame onto Canvas when viewing synthesized video
  useEffect(() => {
    if (!activeVideo?.isSynthesized) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#0B0D17');
    grad.addColorStop(0.55, '#171A2B');
    grad.addColorStop(1, '#251E3E');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Subtle moon/ambient orb
    ctx.beginPath();
    ctx.arc(w * 0.78, h * 0.28, 52, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(233, 200, 120, 0.18)';
    ctx.fill();

    // Title header
    ctx.fillStyle = '#E9C878';
    ctx.font = '600 16px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(activeVideo.title, 48, 56);

    // Animated poetic lines
    const lines = activeVideo.poemLines || [];
    const activeLineIdx = Math.floor((currentTime / Math.max(1, duration)) * lines.length);

    lines.slice(0, 6).forEach((line, idx) => {
      const isCurrentLine = idx === activeLineIdx;
      ctx.font = isCurrentLine
        ? '600 22px "Lora", Georgia, serif'
        : '400 18px "Lora", Georgia, serif';
      ctx.fillStyle = isCurrentLine ? '#F4F4FA' : 'rgba(160, 164, 184, 0.55)';
      ctx.fillText(line, 48, 120 + idx * 42);
    });
  }, [activeVideo, currentTime, duration]);

  const currentSubtitle = activeVideo?.subtitles?.find(
    (s) => currentTime >= s.start && currentTime <= s.end
  )?.text;

  const handleTogglePlay = () => {
    if (activeVideo?.isSynthesized) {
      setIsPlaying((prev) => !prev);
    } else if (videoElRef.current) {
      if (videoElRef.current.paused) {
        videoElRef.current.play();
        setIsPlaying(true);
      } else {
        videoElRef.current.pause();
        setIsPlaying(false);
      }
    }
  };

  const handleSeek = (val: number) => {
    setCurrentTime(val);
    if (videoElRef.current && !activeVideo?.isSynthesized) {
      videoElRef.current.currentTime = val;
    }
  };

  const handleSpeedChange = (spd: number) => {
    setPlaybackSpeed(spd);
    if (videoElRef.current) {
      videoElRef.current.playbackRate = spd;
    }
  };

  const handleFullscreen = () => {
    if (containerRef.current && containerRef.current.requestFullscreen) {
      if (!document.fullscreenElement) {
        containerRef.current.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    }
  };

  const handlePiP = async () => {
    if (videoElRef.current && 'requestPictureInPicture' in videoElRef.current) {
      try {
        await videoElRef.current.requestPictureInPicture();
      } catch {
        // ignore if unsupported on synthesized canvas
      }
    }
  };

  const handleImportVideoFile = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    for (const file of Array.from(files)) {
      const ext = (file.name.split('.').pop() || 'MP4').toUpperCase();
      const tempUrl = URL.createObjectURL(file);
      const dur = await new Promise<number>((resolve) => {
        const v = document.createElement('video');
        v.src = tempUrl;
        v.onloadedmetadata = () => {
          URL.revokeObjectURL(tempUrl);
          resolve(Number.isFinite(v.duration) ? Math.round(v.duration) : 60);
        };
        v.onerror = () => {
          URL.revokeObjectURL(tempUrl);
          resolve(60);
        };
      });

      const newVideo: VideoItem = {
        id: `vid-${Date.now()}`,
        title: file.name.replace(/\.[^/.]+$/, ''),
        description: 'Video tư liệu được tải lên từ thiết bị cá nhân.',
        duration: dur,
        fileSize: file.size,
        format: ext,
        createdAt: new Date().toISOString(),
        videoBlob: file,
        isSynthesized: false,
      };
      await onAddVideo(newVideo);
      setActiveVideo(newVideo);
    }
  };

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6">
        <div>
          <h1 className="text-xl font-bold text-[var(--text-main)]">
            Thư viện Video & Tư liệu Văn học
          </h1>
          <p className="text-xs text-[var(--text-muted)]">
            Hỗ trợ MP4, WebM, điều chỉnh tốc độ phát (0.5x – 2.0x), phụ đề văn học đồng bộ, hình trong hình và toàn màn hình.
          </p>
        </div>

        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="video/mp4,video/webm,video/*"
            onChange={(e) => handleImportVideoFile(e.target.files)}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 rounded-lg bg-[#8275F5] px-4 py-2 text-xs font-semibold text-white hover:bg-[#7162E8] transition-colors whitespace-nowrap"
          >
            <Upload className="h-4 w-4" />
            <span>Tải video lên (MP4 / WebM)</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Video Stage */}
        <div
          ref={containerRef}
          className="lg:col-span-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] overflow-hidden flex flex-col"
        >
          <div className="relative aspect-video w-full bg-[#0B0D17] flex items-center justify-center">
            {activeVideo?.isSynthesized ? (
              <canvas
                ref={canvasRef}
                width={800}
                height={450}
                onClick={handleTogglePlay}
                className="h-full w-full cursor-pointer object-contain"
              />
            ) : videoObjectUrl ? (
              <video
                ref={videoElRef}
                src={videoObjectUrl}
                muted={isMuted}
                onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
                onEnded={() => setIsPlaying(false)}
                onClick={handleTogglePlay}
                className="h-full w-full cursor-pointer object-contain"
              />
            ) : (
              <div className="text-center text-xs text-[var(--text-muted)] p-6">
                Chọn một video trong danh sách hoặc Import từ thiết bị.
              </div>
            )}

            {/* Synchronized Subtitles Overlay */}
            {showSubtitles && currentSubtitle && (
              <div className="pointer-events-none absolute bottom-6 inset-x-8 text-center">
                <span className="inline-block rounded-lg bg-black/80 px-4 py-2 font-literary text-sm text-[#F4F4FA] shadow-md">
                  {currentSubtitle}
                </span>
              </div>
            )}
          </div>

          {/* Video Transport Controls */}
          <div className="p-4 space-y-3 bg-[var(--bg-sidebar)] border-t border-[var(--border-subtle)]">
            <div className="flex items-center gap-3">
              <span className="font-tabular text-xs text-[var(--text-muted)] w-11 text-right">
                {formatDuration(currentTime)}
              </span>
              <input
                type="range"
                aria-label="Thanh tiến trình video"
                min={0}
                max={Math.max(1, duration)}
                step={0.1}
                value={Math.min(duration, currentTime)}
                onChange={(e) => handleSeek(Number(e.target.value))}
                className="flex-1 accent-[#8275F5] cursor-pointer h-1.5 rounded-lg"
              />
              <span className="font-tabular text-xs text-[var(--text-muted)] w-11">
                {formatDuration(duration)}
              </span>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleTogglePlay}
                  aria-label={isPlaying ? 'Tạm dừng video' : 'Phát video'}
                  className="flex items-center gap-1.5 rounded-lg bg-[#8275F5] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#7162E8]"
                >
                  {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  <span>{isPlaying ? 'Tạm dừng' : 'Phát Video'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const nextMute = !isMuted;
                    setIsMuted(nextMute);
                    if (videoElRef.current) videoElRef.current.muted = nextMute;
                  }}
                  aria-label="Bật tắt tiếng video"
                  className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-main)]"
                >
                  {isMuted || volume === 0 ? (
                    <VolumeX className="h-4 w-4 text-[#F16C78]" />
                  ) : (
                    <Volume2 className="h-4 w-4" />
                  )}
                </button>

                <input
                  type="range"
                  aria-label="Âm lượng video"
                  min={0}
                  max={1}
                  step={0.05}
                  value={isMuted ? 0 : volume}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setVolume(v);
                    setIsMuted(v === 0);
                    if (videoElRef.current) videoElRef.current.volume = v;
                  }}
                  className="w-20 accent-[#8275F5] cursor-pointer h-1.5"
                />
              </div>

              <div className="flex items-center gap-2">
                <select
                  aria-label="Tốc độ phát video"
                  value={playbackSpeed}
                  onChange={(e) => handleSpeedChange(Number(e.target.value))}
                  className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-1 text-xs font-tabular text-[var(--text-main)]"
                >
                  <option value={0.5}>0.5x</option>
                  <option value={0.75}>0.75x</option>
                  <option value={1}>1.0x Chuẩn</option>
                  <option value={1.25}>1.25x</option>
                  <option value={1.5}>1.5x</option>
                  <option value={2}>2.0x</option>
                </select>

                <button
                  type="button"
                  onClick={() => setShowSubtitles((prev) => !prev)}
                  aria-label="Bật tắt phụ đề"
                  className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                    showSubtitles
                      ? 'bg-[#E9C878]/20 text-[#E9C878]'
                      : 'bg-[var(--bg-surface)] text-[var(--text-muted)]'
                  }`}
                >
                  <Subtitles className="h-4 w-4" />
                  <span>Phụ đề</span>
                </button>

                {!activeVideo?.isSynthesized && (
                  <button
                    type="button"
                    onClick={handlePiP}
                    aria-label="Picture-in-Picture"
                    className="rounded-lg bg-[var(--bg-surface)] p-1.5 text-[var(--text-muted)] hover:text-[var(--text-main)]"
                  >
                    <PictureInPicture2 className="h-4 w-4" />
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleFullscreen}
                  aria-label="Toàn màn hình"
                  className="rounded-lg bg-[var(--bg-surface)] p-1.5 text-[var(--text-muted)] hover:text-[var(--text-main)]"
                >
                  <Maximize className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Video Playlist Sidebar */}
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Film className="h-4 w-4 text-[#8275F5]" />
              <h2 className="text-sm font-bold text-[var(--text-main)]">
                Danh sách phát Video ({videos.length})
              </h2>
            </div>
          </div>

          <div className="space-y-2.5">
            {videos.map((v) => {
              const isCurrent = activeVideo?.id === v.id;
              return (
                <div
                  key={v.id}
                  className={`rounded-lg border p-3 transition-colors ${
                    isCurrent
                      ? 'border-[#8275F5] bg-[#8275F5]/10'
                      : 'border-[var(--border-subtle)] bg-[var(--bg-surface)]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveVideo(v)}
                      className="text-left flex-1 min-w-0"
                    >
                      <p className="text-xs font-semibold text-[var(--text-main)] line-clamp-1">
                        {v.title}
                      </p>
                      <p className="mt-1 text-[11px] text-[var(--text-muted)] line-clamp-2">
                        {v.description}
                      </p>
                      <p className="mt-1.5 font-tabular text-[11px] text-[#E9C878]">
                        {v.format} · {formatDuration(v.duration)} · {formatBytes(v.fileSize)}
                      </p>
                    </button>

                    {!v.isSynthesized && (
                      <button
                        type="button"
                        onClick={() => onDeleteVideo(v.id)}
                        aria-label={`Xóa video ${v.title}`}
                        className="p-1 text-[var(--text-muted)] hover:text-[#F16C78]"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
