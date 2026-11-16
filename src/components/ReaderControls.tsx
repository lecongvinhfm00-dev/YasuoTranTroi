import React from 'react';
import {
  Play,
  Pause,
  Square,
  RotateCcw,
  Volume2,
  Sliders,
  AlertTriangle,
  Sparkles,
  MousePointerClick,
  RefreshCw,
} from 'lucide-react';
import type { TTSReaderSnapshot } from '../services/ttsService';
import { VI } from '../i18n/vi';

interface ReaderControlsProps {
  ttsState: TTSReaderSnapshot;
  onPlay: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onReplay: () => void;
  onReadFromCursor: () => void;
  onSelectVoice: (voiceURI: string) => void;
  onChangeRate: (rate: number) => void;
  onChangePitch: (pitch: number) => void;
  onChangeVolume: (volume: number) => void;
  onSelectSegment: (index: number) => void;
  onTogglePref: (key: 'autoNextSegment' | 'autoScroll' | 'highlightActive', value: boolean) => void;
  onRefreshVoices: () => void;
}

const SPEED_OPTIONS = [0.75, 0.9, 1.0, 1.1, 1.25, 1.5, 1.75, 2.0];

export const ReaderControls: React.FC<ReaderControlsProps> = ({
  ttsState,
  onPlay,
  onPause,
  onResume,
  onStop,
  onReplay,
  onReadFromCursor,
  onSelectVoice,
  onChangeRate,
  onChangePitch,
  onChangeVolume,
  onSelectSegment,
  onTogglePref,
  onRefreshVoices,
}) => {
  const isReading = ttsState.status === 'reading';
  const isPaused = ttsState.status === 'paused';

  return (
    <div
      data-testid="reader-tts-controls"
      className="bg-[#171A2B] border border-white/10 rounded-xl p-4 space-y-4 shadow-xl"
    >
      {/* Cảnh báo rõ ràng khi trình duyệt chưa cài gói giọng đọc tiếng Việt (vi-VN) */}
      {!ttsState.hasVietnameseVoice && (
        <div
          data-testid="tts-no-vietnamese-voice-banner"
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-lg bg-[#E9C878]/10 border border-[#E9C878]/35 text-xs text-[#F4F4FA]"
        >
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-[#E9C878] shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-[#E9C878]">{VI.tts.noVoiceWarning}</p>
              <p className="text-[#A0A4B8] leading-relaxed">{VI.tts.noVoiceGuide}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onRefreshVoices}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#20243A] hover:bg-white/10 text-[#E9C878] border border-[#E9C878]/30 font-medium shrink-0 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Kiểm tra lại giọng đọc
          </button>
        </div>
      )}

      {ttsState.errorMessage && ttsState.hasVietnameseVoice && (
        <div className="p-3 rounded-lg bg-[#F16C78]/15 border border-[#F16C78]/35 text-xs text-[#F16C78]">
          {ttsState.errorMessage}
        </div>
      )}

      {/* Hàng 1: Nút điều khiển phát chính */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {!isReading && !isPaused ? (
            <button
              type="button"
              data-testid="tts-play-button"
              onClick={onPlay}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#8275F5] hover:bg-[#8275F5]/90 text-white text-xs font-semibold shadow-md transition-all cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              {VI.tts.readText}
            </button>
          ) : isReading ? (
            <button
              type="button"
              data-testid="tts-pause-button"
              onClick={onPause}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#E9C878] hover:bg-[#E9C878]/90 text-[#0B0D17] text-xs font-semibold shadow-md transition-all cursor-pointer"
            >
              <Pause className="w-3.5 h-3.5 fill-current" />
              {VI.tts.pause}
            </button>
          ) : (
            <button
              type="button"
              data-testid="tts-resume-button"
              onClick={onResume}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#36C98F] hover:bg-[#36C98F]/90 text-[#0B0D17] text-xs font-semibold shadow-md transition-all cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              {VI.tts.resume}
            </button>
          )}

          <button
            type="button"
            data-testid="tts-stop-button"
            onClick={onStop}
            disabled={ttsState.status === 'idle' || ttsState.status === 'stopped'}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#20243A] hover:bg-white/10 disabled:opacity-40 text-[#F4F4FA] text-xs font-medium border border-white/10 transition-colors cursor-pointer"
          >
            <Square className="w-3.5 h-3.5" />
            {VI.tts.stop}
          </button>

          <button
            type="button"
            data-testid="tts-replay-button"
            onClick={onReplay}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#20243A] hover:bg-white/10 text-[#F4F4FA] text-xs font-medium border border-white/10 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            {VI.tts.replay}
          </button>

          <button
            type="button"
            data-testid="tts-read-cursor-button"
            onClick={onReadFromCursor}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#20243A] hover:bg-[#8275F5]/20 text-[#A78BFA] text-xs font-medium border border-[#8275F5]/30 transition-colors cursor-pointer"
            title="Bôi đen hoặc đặt con trỏ vào đoạn văn bản bất kỳ rồi bấm để đọc từ vị trí đó"
          >
            <MousePointerClick className="w-3.5 h-3.5" />
            {VI.tts.readFromCursor}
          </button>
        </div>

        {/* Trạng thái đọc hiện tại */}
        <div className="flex items-center gap-2 text-xs">
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium border ${
              isReading
                ? 'bg-[#36C98F]/15 text-[#36C98F] border-[#36C98F]/30'
                : isPaused
                ? 'bg-[#E9C878]/15 text-[#E9C878] border-[#E9C878]/30'
                : 'bg-[#20243A] text-[#A0A4B8] border-white/10'
            }`}
          >
            <Sparkles className="w-3 h-3" />
            {isReading
              ? VI.tts.statusReading
              : isPaused
              ? VI.tts.statusPaused
              : ttsState.status === 'stopped'
              ? VI.tts.statusStopped
              : VI.tts.statusReady}
          </span>
          <span className="text-[#A0A4B8] font-mono">
            Đoạn {ttsState.currentSegmentIndex + 1}/{Math.max(1, ttsState.segments.length)}
          </span>
        </div>
      </div>

      {/* Hàng 2: Chọn giọng đọc, Tốc độ đọc, Chọn đoạn, Cao độ & Âm lượng */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-white/5">
        {/* Chọn giọng đọc tiếng Việt */}
        <div className="space-y-1">
          <label className="block text-[11px] font-medium text-[#A0A4B8]">
            {VI.tts.selectVoice} (vi-VN)
          </label>
          <select
            data-testid="tts-voice-select"
            value={ttsState.selectedVoiceURI}
            onChange={(e) => onSelectVoice(e.target.value)}
            className="w-full bg-[#101321] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-[#F4F4FA] focus:outline-none focus:border-[#8275F5]"
          >
            {ttsState.voices.length === 0 ? (
              <option value="">Chưa tìm thấy giọng đọc vi-VN trên thiết bị</option>
            ) : (
              ttsState.voices.map((v) => (
                <option key={v.voiceURI} value={v.voiceURI}>
                  {v.name} ({v.genderHint} • {v.regionHint})
                </option>
              ))
            )}
          </select>
        </div>

        {/* Tốc độ đọc */}
        <div className="space-y-1">
          <label className="block text-[11px] font-medium text-[#A0A4B8]">
            {VI.tts.speed}: <span className="text-[#E9C878] font-mono">{ttsState.rate}x</span>
          </label>
          <div className="flex flex-wrap gap-1">
            {SPEED_OPTIONS.map((spd) => (
              <button
                key={spd}
                type="button"
                data-testid={`tts-speed-${spd}`}
                onClick={() => onChangeRate(spd)}
                className={`px-2 py-1 rounded text-[11px] font-mono transition-colors cursor-pointer ${
                  Math.abs(ttsState.rate - spd) < 0.02
                    ? 'bg-[#8275F5] text-white font-semibold'
                    : 'bg-[#101321] text-[#A0A4B8] hover:text-white border border-white/5'
                }`}
              >
                {spd}x
              </button>
            ))}
          </div>
        </div>

        {/* Chọn đoạn đọc */}
        <div className="space-y-1">
          <label className="block text-[11px] font-medium text-[#A0A4B8]">
            {VI.tts.selectSegment}
          </label>
          <select
            data-testid="tts-segment-select"
            value={ttsState.currentSegmentIndex}
            onChange={(e) => onSelectSegment(Number(e.target.value))}
            className="w-full bg-[#101321] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-[#F4F4FA] focus:outline-none focus:border-[#8275F5]"
          >
            {ttsState.segments.map((seg, idx) => (
              <option key={idx} value={idx}>
                Đoạn {idx + 1}: {seg.slice(0, 42)}...
              </option>
            ))}
          </select>
        </div>

        {/* Cao độ & Âm lượng đọc */}
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="flex items-center justify-between text-[11px] text-[#A0A4B8]">
              <span className="inline-flex items-center gap-1">
                <Sliders className="w-3 h-3 text-[#A78BFA]" />
                Cao độ
              </span>
              <span className="font-mono text-[#F4F4FA]">{ttsState.pitch.toFixed(1)}</span>
            </label>
            <input
              type="range"
              min={0.6}
              max={1.4}
              step={0.1}
              value={ttsState.pitch}
              onChange={(e) => onChangePitch(Number(e.target.value))}
              className="w-full accent-[#8275F5] cursor-pointer"
            />
          </div>

          <div className="space-y-1">
            <label className="flex items-center justify-between text-[11px] text-[#A0A4B8]">
              <span className="inline-flex items-center gap-1">
                <Volume2 className="w-3 h-3 text-[#E9C878]" />
                Âm lượng
              </span>
              <span className="font-mono text-[#F4F4FA]">{Math.round(ttsState.volume * 100)}%</span>
            </label>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={ttsState.volume}
              onChange={(e) => onChangeVolume(Number(e.target.value))}
              className="w-full accent-[#E9C878] cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* Hàng 3: Tùy chọn tự động chuyển đoạn, tự động cuộn, tô sáng câu đang đọc */}
      <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-white/5 text-xs text-[#A0A4B8]">
        <label className="inline-flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={ttsState.autoNextSegment}
            onChange={(e) => onTogglePref('autoNextSegment', e.target.checked)}
            className="rounded accent-[#8275F5]"
          />
          <span>{VI.tts.autoNextSegment}</span>
        </label>

        <label className="inline-flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={ttsState.autoScroll}
            onChange={(e) => onTogglePref('autoScroll', e.target.checked)}
            className="rounded accent-[#8275F5]"
          />
          <span>{VI.tts.autoScroll}</span>
        </label>

        <label className="inline-flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={ttsState.highlightActive}
            onChange={(e) => onTogglePref('highlightActive', e.target.checked)}
            className="rounded accent-[#8275F5]"
          />
          <span>{VI.tts.highlightActive}</span>
        </label>
      </div>
    </div>
  );
};
