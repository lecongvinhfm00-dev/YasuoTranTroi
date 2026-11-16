import React, { useEffect, useRef, useState } from 'react';
import {
  Sparkles,
  Send,
  Volume2,
  BookOpen,
  ListMusic,
  Play,
  Pause,
  ChevronRight,
} from 'lucide-react';
import { AudioEngineState, masterAudioEngine } from '../services/audioEngine.ts';
import type {
  AudioTrack,
  LiteratureDocument,
  NavigationModule,
} from '../types/studio.ts';
import { analyzeLiteraryMetrics, formatDuration } from '../utils/studioLogic.ts';

interface RightPanelProps {
  engineState: AudioEngineState;
  activeDocument: LiteratureDocument | null;
  activeModule: NavigationModule;
  onQuickAiSubmit: (prompt: string) => void;
  onSelectModule: (mod: NavigationModule) => void;
}

export const RightPanel: React.FC<RightPanelProps> = ({
  engineState,
  activeDocument,
  onQuickAiSubmit,
  onSelectModule,
}) => {
  const [quickPrompt, setQuickPrompt] = useState('');
  const miniCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let rafId = 0;
    const drawMiniSpectrum = () => {
      const canvas = miniCanvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          const { frequencyData } = masterAudioEngine.getVisualizerData();
          const bars = 20;
          const barW = canvas.width / bars - 2;
          for (let i = 0; i < bars; i++) {
            const val = frequencyData[i * 2] || (engineState.isPlaying ? 16 : 3);
            const h = Math.max(3, (val / 255) * (canvas.height - 4));
            ctx.fillStyle = i % 2 === 0 ? '#8275F5' : '#E9C878';
            ctx.fillRect(i * (barW + 2), canvas.height - h, barW, h);
          }
        }
      }
      rafId = requestAnimationFrame(drawMiniSpectrum);
    };
    rafId = requestAnimationFrame(drawMiniSpectrum);
    return () => cancelAnimationFrame(rafId);
  }, [engineState.isPlaying]);

  const handleQuickSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickPrompt.trim()) return;
    onQuickAiSubmit(quickPrompt.trim());
    setQuickPrompt('');
  };

  const docMetrics = activeDocument
    ? analyzeLiteraryMetrics(activeDocument.content)
    : null;

  return (
    <aside
      aria-label="Bảng công cụ ngữ cảnh bên phải"
      className="hidden xl:flex w-80 shrink-0 flex-col border-l border-[var(--border-subtle)] bg-[var(--bg-sidebar)] overflow-y-auto p-4 space-y-5"
    >
      {/* 1. Quick AI Literature Assistant */}
      <section className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[#E9C878]" />
            <h3 className="text-xs font-bold text-[var(--text-main)]">
              Trợ lý Văn học nhanh
            </h3>
          </div>
          <button
            type="button"
            onClick={() => onSelectModule('ai')}
            className="flex items-center gap-0.5 text-[11px] font-medium text-[#A78BFA] hover:underline"
          >
            <span>Mở rộng</span>
            <ChevronRight className="h-3 w-3" />
          </button>
        </div>

        <form onSubmit={handleQuickSend} className="mt-3 space-y-2">
          <input
            type="text"
            value={quickPrompt}
            onChange={(e) => setQuickPrompt(e.target.value)}
            placeholder="Hỏi nhanh về tác phẩm, nhân vật..."
            aria-label="Câu hỏi nhanh cho AI Văn học"
            className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-xs text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:border-[#8275F5] focus:outline-none"
          />
          <button
            type="submit"
            className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#8275F5] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#7162E8] transition-colors"
          >
            <Send className="h-3.5 w-3.5" />
            <span>Phân tích ngay</span>
          </button>
        </form>
      </section>

      {/* 2. Now Playing & Real-Time Audio Spectrum */}
      <section className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Volume2 className="h-4 w-4 text-[#8275F5]" />
            <h3 className="text-xs font-bold text-[var(--text-main)]">Đang phát (Now Playing)</h3>
          </div>
          <span className="font-tabular text-[11px] text-[var(--text-muted)]">
            {engineState.isDucked ? 'Ducking Bật' : 'Chuẩn'}
          </span>
        </div>

        {engineState.currentTrack ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <img
                src={engineState.currentTrack.coverUrl}
                alt={engineState.currentTrack.title}
                referrerPolicy="no-referrer"
                className="h-12 w-12 rounded-lg object-cover border border-[var(--border-subtle)]"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-[var(--text-main)]">
                  {engineState.currentTrack.title}
                </p>
                <p className="truncate text-[11px] text-[var(--text-muted)]">
                  {engineState.currentTrack.artist}
                </p>
              </div>
            </div>

            <div className="rounded-lg bg-[#0B0D17] p-2.5 border border-[var(--border-subtle)]">
              <canvas ref={miniCanvasRef} width={240} height={42} className="w-full h-10 block" />
            </div>
          </div>
        ) : (
          <p className="text-xs text-[var(--text-muted)]">Chưa có bài nhạc đang phát.</p>
        )}
      </section>

      {/* 3. Active Queue */}
      <section className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ListMusic className="h-4 w-4 text-[#A78BFA]" />
            <h3 className="text-xs font-bold text-[var(--text-main)]">Danh sách chờ (Queue)</h3>
          </div>
          <span className="font-tabular text-[11px] text-[var(--text-muted)]">
            {engineState.queue.length} bài
          </span>
        </div>

        <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
          {engineState.queue.map((track: AudioTrack) => {
            const isCurrent = engineState.currentTrack?.id === track.id;
            return (
              <button
                key={track.id}
                type="button"
                onClick={() =>
                  isCurrent
                    ? masterAudioEngine.togglePlay()
                    : masterAudioEngine.loadTrack(track, true)
                }
                className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition-colors ${
                  isCurrent
                    ? 'bg-[#8275F5]/15 text-[var(--text-main)] font-semibold'
                    : 'text-[var(--text-muted)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-main)]'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {isCurrent && engineState.isPlaying ? (
                    <Pause className="h-3.5 w-3.5 shrink-0 text-[#E9C878]" />
                  ) : (
                    <Play className="h-3.5 w-3.5 shrink-0 opacity-70" />
                  )}
                  <span className="truncate">{track.title}</span>
                </div>
                <span className="font-tabular text-[11px] shrink-0">
                  {formatDuration(track.duration)}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* 4. Active Document Inspector */}
      {activeDocument && docMetrics && (
        <section className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 space-y-2.5">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-[#36C98F]" />
            <h3 className="text-xs font-bold text-[var(--text-main)]">Tài liệu đang mở</h3>
          </div>
          <p className="text-xs font-semibold text-[var(--text-main)] line-clamp-2">
            {activeDocument.title}
          </p>
          <p className="text-[11px] text-[var(--text-muted)]">
            {activeDocument.author} · {activeDocument.category} · {activeDocument.format}
          </p>
          <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
            <div className="rounded-lg bg-[var(--bg-surface)] p-2">
              <span className="block text-[var(--text-muted)]">Số từ</span>
              <span className="font-tabular font-semibold text-[var(--text-main)]">
                {docMetrics.wordCount} từ
              </span>
            </div>
            <div className="rounded-lg bg-[var(--bg-surface)] p-2">
              <span className="block text-[var(--text-muted)]">Khổ / Đoạn</span>
              <span className="font-tabular font-semibold text-[var(--text-main)]">
                {docMetrics.stanzaOrParagraphCount} đoạn
              </span>
            </div>
          </div>
        </section>
      )}
    </aside>
  );
};
