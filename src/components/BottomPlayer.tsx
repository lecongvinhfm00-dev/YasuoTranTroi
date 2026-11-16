import React, { useEffect, useRef, useState } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Repeat,
  Repeat1,
  Shuffle,
  Maximize2,
  Minimize2,
  AudioWaveform,
  Mic,
} from 'lucide-react';
import { AudioEngineState, masterAudioEngine } from '../services/audioEngine.ts';
import { formatDuration } from '../utils/studioLogic.ts';

interface BottomPlayerProps {
  engineState: AudioEngineState;
}

export const BottomPlayer: React.FC<BottomPlayerProps> = ({ engineState }) => {
  const [expanded, setExpanded] = useState(false);
  const [vizMode, setVizMode] = useState<'spectrum' | 'waveform' | 'equalizer'>('spectrum');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    isDucked,
    repeatMode,
    shuffle,
    ttsActive,
  } = engineState;

  useEffect(() => {
    if (!expanded) return;
    let rafId = 0;

    const renderLoop = () => {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const width = canvas.width;
          const height = canvas.height;
          ctx.clearRect(0, 0, width, height);

          const { frequencyData, waveformData } = masterAudioEngine.getVisualizerData();

          if (vizMode === 'spectrum' || vizMode === 'equalizer') {
            const bars = vizMode === 'equalizer' ? 24 : 48;
            const barWidth = width / bars - 3;
            for (let i = 0; i < bars; i++) {
              const val = frequencyData[i % frequencyData.length] || (isPlaying ? 18 : 4);
              const barHeight = Math.max(4, (val / 255) * (height - 16));
              const x = i * (barWidth + 3);
              const y = height - barHeight;

              ctx.fillStyle = i % 3 === 0 ? '#E9C878' : i % 2 === 0 ? '#A78BFA' : '#8275F5';
              ctx.fillRect(x, y, barWidth, barHeight);
            }
          } else {
            ctx.beginPath();
            ctx.lineWidth = 2.5;
            ctx.strokeStyle = '#8275F5';
            const sliceWidth = width / waveformData.length;
            let x = 0;
            for (let i = 0; i < waveformData.length; i++) {
              const v = waveformData[i] / 128.0;
              const y = (v * height) / 2;
              if (i === 0) ctx.moveTo(x, y);
              else ctx.lineTo(x, y);
              x += sliceWidth;
            }
            ctx.lineTo(width, height / 2);
            ctx.stroke();
          }
        }
      }
      rafId = requestAnimationFrame(renderLoop);
    };

    rafId = requestAnimationFrame(renderLoop);
    return () => cancelAnimationFrame(rafId);
  }, [expanded, vizMode, isPlaying]);

  return (
    <>
      <footer
        aria-label="Trình điều khiển âm thanh Master Bot Player"
        className="h-20 shrink-0 border-t border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-4 lg:px-6 flex items-center justify-between gap-4 z-30"
      >
        {/* Left: Track Info */}
        <div className="flex items-center gap-3 min-w-0 w-1/4">
          {currentTrack ? (
            <>
              <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
                <img
                  src={currentTrack.coverUrl}
                  alt={currentTrack.title}
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[var(--text-main)]">
                  {currentTrack.title}
                </p>
                <p className="truncate text-xs text-[var(--text-muted)]">
                  {currentTrack.artist} · {currentTrack.format}
                </p>
              </div>
            </>
          ) : (
            <div className="text-xs text-[var(--text-muted)]">Chưa chọn bài nhạc</div>
          )}
        </div>

        {/* Center: Transport & Seek Bar */}
        <div className="flex flex-1 max-w-xl flex-col items-center gap-1.5">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => masterAudioEngine.toggleShuffle()}
              aria-label="Phát ngẫu nhiên"
              className={`p-1.5 rounded-md transition-colors ${
                shuffle ? 'text-[#E9C878]' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
              }`}
            >
              <Shuffle className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={() => masterAudioEngine.previousTrack()}
              aria-label="Bài trước"
              className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors"
            >
              <SkipBack className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={() => masterAudioEngine.togglePlay()}
              aria-label={isPlaying ? 'Tạm dừng nhạc' : 'Phát nhạc'}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-[#8275F5] text-white hover:bg-[#7162E8] transition-colors shadow-xs"
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
            </button>

            <button
              type="button"
              onClick={() => masterAudioEngine.nextTrack()}
              aria-label="Bài tiếp theo"
              className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors"
            >
              <SkipForward className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={() => masterAudioEngine.cycleRepeatMode()}
              aria-label="Chế độ lặp lại"
              className={`p-1.5 rounded-md transition-colors ${
                repeatMode !== 'off'
                  ? 'text-[#E9C878]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
              }`}
            >
              {repeatMode === 'one' ? (
                <Repeat1 className="h-4 w-4" />
              ) : (
                <Repeat className="h-4 w-4" />
              )}
            </button>
          </div>

          <div className="flex w-full items-center gap-2.5">
            <span className="font-tabular text-[11px] text-[var(--text-muted)] w-9 text-right">
              {formatDuration(currentTime)}
            </span>
            <input
              type="range"
              aria-label="Thanh tiến trình bài hát"
              min={0}
              max={Math.max(1, duration)}
              step={0.2}
              value={Math.min(duration || 1, currentTime)}
              onChange={(e) => masterAudioEngine.seek(Number(e.target.value))}
              className="h-1.5 flex-1 cursor-pointer accent-[#8275F5] rounded-lg bg-[var(--bg-surface)]"
            />
            <span className="font-tabular text-[11px] text-[var(--text-muted)] w-9">
              {formatDuration(duration)}
            </span>
          </div>
        </div>

        {/* Right: Ducking Indicator, Volume & Expand */}
        <div className="hidden sm:flex items-center justify-end gap-3 w-1/4">
          {(isDucked || ttsActive) && (
            <span className="text-[11px] font-medium text-[#E9C878] whitespace-nowrap">
              Giảm âm nền {engineState.duckingConfig.duckingLevelPercent}%
            </span>
          )}

          <button
            type="button"
            onClick={() => masterAudioEngine.toggleMute()}
            aria-label={isMuted ? 'Bật âm thanh' : 'Tắt tiếng'}
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
            aria-label="Âm lượng chính"
            min={0}
            max={1}
            step={0.02}
            value={isMuted ? 0 : volume}
            onChange={(e) => masterAudioEngine.setVolume(Number(e.target.value))}
            className="w-20 cursor-pointer accent-[#8275F5] h-1.5 rounded-lg bg-[var(--bg-surface)]"
          />

          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            aria-label="Mở rộng trình phát & bộ phân tích phổ âm"
            className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] p-2 text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors"
          >
            {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
        </div>
      </footer>

      {/* Expanded Master Bot Player & Web Audio API Visualizer Modal */}
      {expanded && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Trình phát mở rộng và phân tích phổ âm thanh"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs"
        >
          <div className="w-full max-w-3xl rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-4">
              <div className="flex items-center gap-2.5">
                <AudioWaveform className="h-5 w-5 text-[#8275F5]" />
                <div>
                  <h2 className="text-base font-bold text-[var(--text-main)]">
                    Trình phát Âm thanh Trung tâm & Phân tích Phổ âm
                  </h2>
                  <p className="text-xs text-[var(--text-muted)]">
                    Xử lý âm thanh hợp nhất · Tự động giảm nhạc nền khi đọc văn bản tiếng Việt
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setExpanded(false)}
                className="rounded-lg bg-[var(--bg-surface)] px-3 py-1.5 text-xs font-medium text-[var(--text-main)] hover:bg-[#8275F5] hover:text-white transition-colors"
              >
                Thu gọn
              </button>
            </div>

            <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
              <div className="flex flex-col items-center text-center">
                <div className="h-40 w-40 overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
                  {currentTrack && (
                    <img
                      src={currentTrack.coverUrl}
                      alt={currentTrack.title}
                      referrerPolicy="no-referrer"
                      className="h-full w-full object-cover"
                    />
                  )}
                </div>
                <h3 className="mt-3 text-sm font-bold text-[var(--text-main)]">
                  {currentTrack?.title || 'Chưa chọn bài'}
                </h3>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  {currentTrack?.artist} · {currentTrack?.album}
                </p>
              </div>

              <div className="md:col-span-2 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1 rounded-lg bg-[var(--bg-surface)] p-1">
                    {(['spectrum', 'waveform', 'equalizer'] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setVizMode(mode)}
                        className={`rounded-md px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                          vizMode === mode
                            ? 'bg-[#8275F5] text-white'
                            : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                        }`}
                      >
                        {mode === 'spectrum'
                          ? 'Phổ tần số'
                          : mode === 'waveform'
                          ? 'Dạng sóng âm'
                          : 'Thanh cân bằng'}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      isDucked
                        ? masterAudioEngine.releaseDucking()
                        : masterAudioEngine.engageDucking()
                    }
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                      isDucked
                        ? 'bg-[#E9C878] text-[#0B0D17]'
                        : 'bg-[var(--bg-surface)] text-[var(--text-main)] hover:bg-[#8275F5]/20'
                    }`}
                  >
                    <Mic className="h-3.5 w-3.5" />
                    <span>{isDucked ? 'Khôi phục âm lượng gốc' : 'Thử giảm nhạc nền'}</span>
                  </button>
                </div>

                <div className="rounded-xl border border-[var(--border-subtle)] bg-[#0B0D17] p-4">
                  <canvas
                    ref={canvasRef}
                    width={520}
                    height={160}
                    className="w-full h-36 block"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3 text-xs text-[var(--text-muted)]">
                  <div className="rounded-lg bg-[var(--bg-surface)] p-2.5">
                    <span className="block text-[11px]">Mức giảm Ducking</span>
                    <span className="font-tabular font-semibold text-[var(--text-main)]">
                      {engineState.duckingConfig.duckingLevelPercent}% âm lượng gốc
                    </span>
                  </div>
                  <div className="rounded-lg bg-[var(--bg-surface)] p-2.5">
                    <span className="block text-[11px]">Thời gian Fade giảm</span>
                    <span className="font-tabular font-semibold text-[var(--text-main)]">
                      {engineState.duckingConfig.fadeDurationMs} ms
                    </span>
                  </div>
                  <div className="rounded-lg bg-[var(--bg-surface)] p-2.5">
                    <span className="block text-[11px]">Thời gian Khôi phục</span>
                    <span className="font-tabular font-semibold text-[var(--text-main)]">
                      {engineState.duckingConfig.restoreDurationMs} ms
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
