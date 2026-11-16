import React, { useEffect, useState } from 'react';
import {
  Presentation,
  Plus,
  Copy,
  Trash2,
  ArrowUp,
  ArrowDown,
  Play,
  Sparkles,
  Volume2,
  Clock,
  ChevronLeft,
  ChevronRight,
  X,
  Music,
} from 'lucide-react';
import type {
  AudioTrack,
  LiteratureDocument,
  PresentationDeck,
  SlideItem,
} from '../types/studio.ts';
import { masterAudioEngine } from '../services/audioEngine.ts';
import { studioApiClient } from '../services/apiClient.ts';
import { formatDuration, parseMarkdownToSlides } from '../utils/studioLogic.ts';
import { COVER_IMAGES } from '../data/seedLiterature.ts';

interface PresentationViewProps {
  presentations: PresentationDeck[];
  tracks: AudioTrack[];
  activeDocument: LiteratureDocument | null;
  onSavePresentation: (deck: PresentationDeck) => Promise<void>;
  onDeletePresentation: (id: string) => Promise<void>;
  onRefreshQuota: () => Promise<void>;
}

export const PresentationView: React.FC<PresentationViewProps> = ({
  presentations,
  tracks,
  activeDocument,
  onSavePresentation,
  onDeletePresentation,
  onRefreshQuota,
}) => {
  const [selectedDeckId, setSelectedDeckId] = useState<string>(
    presentations[0]?.id || ''
  );
  const [selectedSlideIdx, setSelectedSlideIdx] = useState<number>(0);
  const [aiTopicInput, setAiTopicInput] = useState('');
  const [isAiBuilding, setIsAiBuilding] = useState(false);
  const [aiStatusMsg, setAiStatusMsg] = useState<string | null>(null);

  // Presentation Player Fullscreen state
  const [isPresenting, setIsPresenting] = useState(false);
  const [showSpeakerNotes, setShowSpeakerNotes] = useState(true);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);

  const currentDeck =
    presentations.find((d) => d.id === selectedDeckId) || presentations[0] || null;
  const currentSlide =
    currentDeck?.slides[selectedSlideIdx] || currentDeck?.slides[0] || null;

  useEffect(() => {
    if (!isPresenting || !timerRunning) return;
    const t = setInterval(() => setTimerSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [isPresenting, timerRunning]);

  // Keyboard shortcuts in Presentation Player
  useEffect(() => {
    if (!isPresenting || !currentDeck) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        setSelectedSlideIdx((idx) =>
          Math.min(currentDeck.slides.length - 1, idx + 1)
        );
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setSelectedSlideIdx((idx) => Math.max(0, idx - 1));
      } else if (e.key === 'Escape') {
        setIsPresenting(false);
        setTimerRunning(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isPresenting, currentDeck]);

  const updateCurrentSlide = async (patch: Partial<SlideItem>) => {
    if (!currentDeck || !currentSlide) return;
    const nextSlides = currentDeck.slides.map((s, idx) =>
      idx === selectedSlideIdx ? { ...s, ...patch } : s
    );
    await onSavePresentation({
      ...currentDeck,
      slides: nextSlides,
      updatedAt: new Date().toISOString(),
    });
  };

  const handleAddSlide = async () => {
    if (!currentDeck) return;
    const newSlide: SlideItem = {
      id: `slide-${Date.now()}`,
      title: `Luận điểm mới — Trang ${currentDeck.slides.length + 1}`,
      bullets: [
        'Luận cứ phân tích thứ nhất có dẫn chứng văn bản.',
        'Luận cứ phân tích nghệ thuật và giọng điệu.',
      ],
      speakerNotes: 'Lời dẫn thuyết trình cho slide này.',
      layout: 'analysis',
    };
    const nextSlides = [...currentDeck.slides, newSlide];
    await onSavePresentation({
      ...currentDeck,
      slides: nextSlides,
      updatedAt: new Date().toISOString(),
    });
    setSelectedSlideIdx(nextSlides.length - 1);
  };

  const handleDuplicateSlide = async () => {
    if (!currentDeck || !currentSlide) return;
    const copy: SlideItem = {
      ...currentSlide,
      id: `slide-dup-${Date.now()}`,
      title: `${currentSlide.title} (Bản sao)`,
    };
    const nextSlides = [...currentDeck.slides];
    nextSlides.splice(selectedSlideIdx + 1, 0, copy);
    await onSavePresentation({
      ...currentDeck,
      slides: nextSlides,
      updatedAt: new Date().toISOString(),
    });
    setSelectedSlideIdx(selectedSlideIdx + 1);
  };

  const handleDeleteSlide = async () => {
    if (!currentDeck || currentDeck.slides.length <= 1) return;
    const nextSlides = currentDeck.slides.filter((_, idx) => idx !== selectedSlideIdx);
    await onSavePresentation({
      ...currentDeck,
      slides: nextSlides,
      updatedAt: new Date().toISOString(),
    });
    setSelectedSlideIdx(Math.max(0, selectedSlideIdx - 1));
  };

  const handleMoveSlide = async (dir: -1 | 1) => {
    if (!currentDeck) return;
    const target = selectedSlideIdx + dir;
    if (target < 0 || target >= currentDeck.slides.length) return;
    const copy = [...currentDeck.slides];
    const [moved] = copy.splice(selectedSlideIdx, 1);
    copy.splice(target, 0, moved);
    await onSavePresentation({
      ...currentDeck,
      slides: copy,
      updatedAt: new Date().toISOString(),
    });
    setSelectedSlideIdx(target);
  };

  const handleGenerateSlidesWithAi = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiTopicInput.trim() || isAiBuilding) return;
    setIsAiBuilding(true);
    setAiStatusMsg(null);

    try {
      const prompt = `Hãy soạn nội dung bộ 4 slide thuyết trình Ngữ văn về chủ đề: "${aiTopicInput.trim()}".
Mỗi slide bắt đầu bằng "## Tiêu đề Slide", theo sau là 3 gạch đầu dòng ngắn gọn, 1 dòng trích dẫn bắt đầu bằng "> " (nếu có) và 1 dòng "Ghi chú: ..." cho lời dẫn của người thuyết trình. Slide cuối gồm kết luận và 2 câu hỏi tương tác.`;

      const res = await studioApiClient.askLiteratureAI({
        prompt,
        documentContext: activeDocument ? activeDocument.content : undefined,
        mode: 'presentation_assistant',
        model: 'gemini-4-hydrogen',
        responseLength: 'balanced',
        saveHistory: true,
      });

      const parsedSlides = parseMarkdownToSlides(res.reply, aiTopicInput.trim());
      const newDeck: PresentationDeck = {
        id: `deck-${Date.now()}`,
        title: aiTopicInput.trim(),
        topic: activeDocument ? `Dựa trên: ${activeDocument.title}` : 'AI Presentation Studio',
        backgroundTrackId: tracks[0]?.id,
        slides: parsedSlides,
        updatedAt: new Date().toISOString(),
      };
      await onSavePresentation(newDeck);
      setSelectedDeckId(newDeck.id);
      setSelectedSlideIdx(0);
      setAiTopicInput('');
      setAiStatusMsg('Đã tạo bộ slide thuyết trình mới từ Gemini AI thành công!');
      await onRefreshQuota();
    } catch (err: any) {
      setAiStatusMsg(err?.message || 'Không thể tạo slide bằng AI lúc này.');
    } finally {
      setIsAiBuilding(false);
    }
  };

  const startPresentationMode = () => {
    setIsPresenting(true);
    setTimerSeconds(0);
    setTimerRunning(true);
    if (currentDeck?.backgroundTrackId) {
      const bgTrack = tracks.find((t) => t.id === currentDeck.backgroundTrackId);
      if (bgTrack) {
        masterAudioEngine.loadTrack(bgTrack, true);
      }
    }
  };

  return (
    <div className="space-y-6 pb-8">
      {/* Top Bar & AI Slide Builder */}
      <section className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 sm:p-6 space-y-4">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="text-lg sm:text-xl font-bold text-[var(--text-main)]">
              Chế độ Thuyết trình Văn học & Thiết kế Trình chiếu AI
            </h1>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              Thiết kế trang chiếu, gắn nhạc nền tự động giảm âm khi đọc lời dẫn, kèm đồng hồ bấm giờ và ghi chú diễn giả.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0">
            <select
              aria-label="Chọn bộ bài thuyết trình"
              value={currentDeck?.id || ''}
              onChange={(e) => {
                setSelectedDeckId(e.target.value);
                setSelectedSlideIdx(0);
              }}
              className="w-full sm:w-auto sm:max-w-xs truncate rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-xs font-semibold text-[var(--text-main)]"
            >
              {presentations.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.title} ({d.slides.length} trang)
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={startPresentationMode}
              className="flex items-center justify-center gap-2 rounded-lg bg-[#8275F5] px-4 py-2 text-xs font-semibold text-white hover:bg-[#7162E8] transition-colors whitespace-nowrap"
            >
              <Play className="h-4 w-4 shrink-0" />
              <span>Trình chiếu toàn màn hình</span>
            </button>
          </div>
        </div>

        {/* Trợ lý soạn thuyết trình bằng AI */}
        <form
          onSubmit={handleGenerateSlidesWithAi}
          className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 pt-2 border-t border-[var(--border-subtle)]"
        >
          <div className="flex items-center gap-2 text-xs font-semibold text-[#E9C878] shrink-0">
            <Sparkles className="h-4 w-4" />
            <span>Trợ lý soạn thuyết trình AI:</span>
          </div>
          <input
            type="text"
            value={aiTopicInput}
            onChange={(e) => setAiTopicInput(e.target.value)}
            placeholder="Nhập chủ đề cần tạo bộ trang chiếu thuyết trình (VD: Vẻ đẹp nhân vật Huấn Cao trong Chữ người tử tù)..."
            aria-label="Chủ đề tạo trang chiếu thuyết trình bằng AI"
            className="flex-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3.5 py-2 text-xs text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:border-[#8275F5] focus:outline-none"
          />
          <button
            type="submit"
            disabled={isAiBuilding || !aiTopicInput.trim()}
            className="rounded-lg bg-[var(--bg-surface)] border border-[#8275F5]/50 px-4 py-2 text-xs font-semibold text-[var(--text-main)] hover:bg-[#8275F5] hover:text-white disabled:opacity-50 transition-colors whitespace-nowrap"
          >
            {isAiBuilding ? 'Đang biên soạn...' : 'Tạo bộ trang chiếu bằng AI'}
          </button>
        </form>

        {aiStatusMsg && (
          <p className="text-xs font-medium text-[#36C98F]">{aiStatusMsg}</p>
        )}
      </section>

      {currentDeck && currentSlide && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Slide Thumbnails & Deck Audio */}
          <div className="lg:col-span-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 space-y-4 h-fit">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold text-[var(--text-main)]">
                Danh sách Slide ({currentDeck.slides.length})
              </h2>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleAddSlide}
                  aria-label="Thêm slide mới"
                  className="flex items-center gap-1 rounded-lg bg-[#8275F5] px-2.5 py-1 text-xs font-semibold text-white"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Thêm</span>
                </button>
                <button
                  type="button"
                  onClick={handleDuplicateSlide}
                  aria-label="Nhân bản slide hiện tại"
                  className="p-1.5 rounded-lg bg-[var(--bg-surface)] text-[var(--text-muted)] hover:text-[var(--text-main)]"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={handleDeleteSlide}
                  aria-label="Xóa slide hiện tại"
                  className="p-1.5 rounded-lg bg-[var(--bg-surface)] text-[var(--text-muted)] hover:text-[#F16C78]"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
              {currentDeck.slides.map((sl, idx) => {
                const isSelected = idx === selectedSlideIdx;
                return (
                  <div
                    key={sl.id}
                    onClick={() => setSelectedSlideIdx(idx)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') setSelectedSlideIdx(idx);
                    }}
                    className={`cursor-pointer rounded-lg border p-3 transition-colors ${
                      isSelected
                        ? 'border-[#8275F5] bg-[#8275F5]/15'
                        : 'border-[var(--border-subtle)] bg-[var(--bg-surface)]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-tabular text-[11px] font-bold text-[#E9C878]">
                        Slide {String(idx + 1).padStart(2, '0')}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMoveSlide(-1);
                          }}
                          aria-label="Di chuyển slide lên"
                          className="p-0.5 text-[var(--text-muted)] hover:text-[var(--text-main)]"
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMoveSlide(1);
                          }}
                          aria-label="Di chuyển slide xuống"
                          className="p-0.5 text-[var(--text-muted)] hover:text-[var(--text-main)]"
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    <p className="mt-1 text-xs font-semibold text-[var(--text-main)] line-clamp-1">
                      {sl.title}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Background Music Selector for Presentation */}
            <div className="border-t border-[var(--border-subtle)] pt-3 space-y-2 text-xs">
              <label className="flex items-center gap-1.5 font-semibold text-[var(--text-muted)]">
                <Music className="h-3.5 w-3.5 text-[#8275F5]" />
                <span>Nhạc nền trình chiếu (Audio Integration)</span>
              </label>
              <select
                aria-label="Chọn nhạc nền bài thuyết trình"
                value={currentDeck.backgroundTrackId || ''}
                onChange={async (e) => {
                  await onSavePresentation({
                    ...currentDeck,
                    backgroundTrackId: e.target.value || undefined,
                  });
                }}
                className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-[var(--text-main)]"
              >
                <option value="">Không phát nhạc nền tự động</option>
                {tracks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title} ({t.artist})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Right Column: Live Slide Preview & Slide Editor */}
          <div className="lg:col-span-8 space-y-5">
            {/* Live Visual Slide Canvas Preview */}
            <section className="rounded-xl border border-[var(--border-subtle)] bg-[#0B0D17] p-8 min-h-[320px] flex flex-col justify-between relative overflow-hidden">
              <div className="flex items-center justify-between text-xs text-[#A0A4B8]">
                <span>{currentDeck.title}</span>
                <span className="font-tabular">
                  Trang {selectedSlideIdx + 1} / {currentDeck.slides.length}
                </span>
              </div>

              <div className="my-6 grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                <div className={currentSlide.imageUrl ? 'md:col-span-8 space-y-4' : 'md:col-span-12 space-y-4'}>
                  <h2 className="text-2xl font-bold text-[#F4F4FA] tracking-tight">
                    {currentSlide.title}
                  </h2>

                  {currentSlide.quote && (
                    <blockquote className="rounded-lg bg-[#171A2B] p-4 font-literary italic text-sm text-[#E9C878] border border-white/10">
                      “{currentSlide.quote}”
                    </blockquote>
                  )}

                  <ul className="space-y-2.5 text-sm text-[#F4F4FA]/90">
                    {currentSlide.bullets.map((b, i) => (
                      <li key={i} className="flex items-start gap-2.5">
                        <span className="font-tabular text-xs font-bold text-[#8275F5] mt-1">
                          0{i + 1}.
                        </span>
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {currentSlide.imageUrl && (
                  <div className="md:col-span-4">
                    <img
                      src={currentSlide.imageUrl}
                      alt={currentSlide.title}
                      referrerPolicy="no-referrer"
                      className="w-full aspect-square rounded-xl object-cover border border-white/10"
                    />
                  </div>
                )}
              </div>

              <div className="border-t border-white/10 pt-3 flex items-center justify-between text-xs text-[#A0A4B8]">
                <span className="truncate max-w-lg">
                  Lời dẫn: {currentSlide.speakerNotes}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    masterAudioEngine.speakText(
                      `${currentSlide.title}. ${currentSlide.bullets.join('. ')}. ${
                        currentSlide.speakerNotes
                      }`
                    )
                  }
                  className="flex items-center gap-1.5 rounded-lg bg-[#8275F5]/20 px-3 py-1 text-[#A78BFA] hover:bg-[#8275F5] hover:text-white transition-colors shrink-0"
                >
                  <Volume2 className="h-3.5 w-3.5" />
                  <span>Đọc lời thuyết trình (TTS)</span>
                </button>
              </div>
            </section>

            {/* Slide Content & Speaker Notes Editor */}
            <section className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6 space-y-4 text-xs">
              <h3 className="text-sm font-bold text-[var(--text-main)]">
                Chỉnh sửa nội dung Slide {selectedSlideIdx + 1}
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[var(--text-muted)] mb-1">Tiêu đề Slide</label>
                  <input
                    type="text"
                    value={currentSlide.title}
                    onChange={(e) => updateCurrentSlide({ title: e.target.value })}
                    className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-[var(--text-main)]"
                  />
                </div>

                <div>
                  <label className="block text-[var(--text-muted)] mb-1">
                    Hình minh họa nghệ thuật
                  </label>
                  <select
                    aria-label="Chọn hình minh họa cho slide"
                    value={currentSlide.imageUrl || ''}
                    onChange={(e) =>
                      updateCurrentSlide({ imageUrl: e.target.value || undefined })
                    }
                    className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-[var(--text-main)]"
                  >
                    <option value="">Không chèn ảnh</option>
                    <option value={COVER_IMAGES.truyenKieu}>
                      Tranh sơn mài Ánh Trăng & Đàn Tranh (Truyện Kiều)
                    </option>
                    <option value={COVER_IMAGES.tayTien}>
                      Tranh sơn dầu Đêm Tây Bắc & Lửa Trại (Tây Tiến)
                    </option>
                    <option value={COVER_IMAGES.acousticStudio}>
                      Không gian Thính phòng Cello & Sách Cổ
                    </option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[var(--text-muted)] mb-1">
                  Câu thơ / Dẫn chứng nổi bật (Quote)
                </label>
                <input
                  type="text"
                  value={currentSlide.quote || ''}
                  onChange={(e) =>
                    updateCurrentSlide({ quote: e.target.value || undefined })
                  }
                  placeholder="Nhập câu thơ hoặc nhận định lý luận văn học..."
                  className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 font-literary text-[var(--text-main)]"
                />
              </div>

              <div>
                <label className="block text-[var(--text-muted)] mb-1">
                  Các ý chính trên Slide (Mỗi dòng 1 ý)
                </label>
                <textarea
                  rows={4}
                  value={currentSlide.bullets.join('\n')}
                  onChange={(e) =>
                    updateCurrentSlide({
                      bullets: e.target.value
                        .split('\n')
                        .map((l) => l.trim())
                        .filter(Boolean),
                    })
                  }
                  className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3 text-[var(--text-main)]"
                />
              </div>

              <div>
                <label className="block text-[var(--text-muted)] mb-1">
                  Ghi chú của người thuyết trình (Speaker Notes)
                </label>
                <textarea
                  rows={3}
                  value={currentSlide.speakerNotes}
                  onChange={(e) => updateCurrentSlide({ speakerNotes: e.target.value })}
                  className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3 text-[var(--text-main)]"
                />
              </div>
            </section>
          </div>
        </div>
      )}

      {/* Fullscreen Presentation Player Modal */}
      {isPresenting && currentDeck && currentSlide && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Trình chiếu toàn màn hình Presentation Player"
          className="fixed inset-0 z-50 flex flex-col bg-[#0B0D17] text-[#F4F4FA]"
        >
          {/* Top Stage Control Bar */}
          <div className="flex items-center justify-between border-b border-white/10 px-6 py-4 bg-[#101321]">
            <div className="flex items-center gap-3">
              <Presentation className="h-5 w-5 text-[#8275F5]" />
              <span className="text-sm font-bold">{currentDeck.title}</span>
              <span className="font-tabular text-xs text-[#A0A4B8]">
                · Slide {selectedSlideIdx + 1}/{currentDeck.slides.length}
              </span>
            </div>

            <div className="flex items-center gap-4">
              {/* Presentation Timer */}
              <div className="flex items-center gap-2 rounded-lg bg-[#171A2B] px-3 py-1.5 border border-white/10 text-xs">
                <Clock className="h-4 w-4 text-[#E9C878]" />
                <span className="font-tabular font-bold">
                  {formatDuration(timerSeconds)}
                </span>
                <button
                  type="button"
                  onClick={() => setTimerRunning((r) => !r)}
                  className="text-[#A78BFA] hover:underline ml-1"
                >
                  {timerRunning ? 'Tạm dừng' : 'Tiếp tục'}
                </button>
              </div>

              <button
                type="button"
                onClick={() => setShowSpeakerNotes((prev) => !prev)}
                className="rounded-lg bg-[#171A2B] px-3 py-1.5 text-xs font-medium border border-white/10 hover:border-[#8275F5]"
              >
                {showSpeakerNotes ? 'Ẩn Speaker Notes' : 'Hiện Speaker Notes'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsPresenting(false);
                  setTimerRunning(false);
                }}
                aria-label="Thoát chế độ trình chiếu"
                className="flex items-center gap-1 rounded-lg bg-[#F16C78] px-3 py-1.5 text-xs font-semibold text-white"
              >
                <X className="h-4 w-4" />
                <span>Thoát (Esc)</span>
              </button>
            </div>
          </div>

          {/* Center Slide Stage */}
          <div className="flex-1 flex flex-col justify-center px-8 lg:px-20 py-10 overflow-y-auto">
            <div className="max-w-5xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
              <div className={currentSlide.imageUrl ? 'lg:col-span-8 space-y-6' : 'lg:col-span-12 space-y-6'}>
                <h1 className="text-3xl lg:text-5xl font-bold tracking-tight text-[#F4F4FA]">
                  {currentSlide.title}
                </h1>

                {currentSlide.quote && (
                  <blockquote className="rounded-xl bg-[#171A2B] p-6 font-literary italic text-xl text-[#E9C878] border border-white/10">
                    “{currentSlide.quote}”
                  </blockquote>
                )}

                <ul className="space-y-4 text-lg lg:text-xl text-[#F4F4FA]/90">
                  {currentSlide.bullets.map((b, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="font-tabular font-bold text-[#8275F5]">
                        0{i + 1}.
                      </span>
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {currentSlide.imageUrl && (
                <div className="lg:col-span-4">
                  <img
                    src={currentSlide.imageUrl}
                    alt={currentSlide.title}
                    referrerPolicy="no-referrer"
                    className="w-full rounded-2xl object-cover border border-white/15 shadow-2xl"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Speaker Notes & Bottom Slide Navigation */}
          <div className="border-t border-white/10 bg-[#101321] px-8 py-4 flex flex-col md:flex-row items-center justify-between gap-4">
            {showSpeakerNotes ? (
              <div className="flex-1 text-xs text-[#A0A4B8]">
                <span className="font-bold text-[#E9C878] mr-2">Speaker Notes:</span>
                <span>{currentSlide.speakerNotes}</span>
              </div>
            ) : (
              <div className="flex-1 text-xs text-[#A0A4B8]">
                Sử dụng phím mũi tên Trái / Phải hoặc Space để chuyển slide.
              </div>
            )}

            <div className="flex items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={() =>
                  masterAudioEngine.speakText(currentSlide.speakerNotes)
                }
                className="flex items-center gap-1.5 rounded-lg bg-[#171A2B] border border-white/10 px-3 py-2 text-xs font-medium text-[#E9C878] hover:border-[#E9C878]"
              >
                <Volume2 className="h-4 w-4" />
                <span>Đọc lời dẫn (TTS + Ducking)</span>
              </button>

              <button
                type="button"
                disabled={selectedSlideIdx === 0}
                onClick={() => setSelectedSlideIdx((i) => Math.max(0, i - 1))}
                className="flex items-center gap-1 rounded-lg bg-[#171A2B] px-4 py-2 text-xs font-semibold disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
                <span>Slide trước</span>
              </button>

              <button
                type="button"
                disabled={selectedSlideIdx >= currentDeck.slides.length - 1}
                onClick={() =>
                  setSelectedSlideIdx((i) =>
                    Math.min(currentDeck.slides.length - 1, i + 1)
                  )
                }
                className="flex items-center gap-1 rounded-lg bg-[#8275F5] px-4 py-2 text-xs font-semibold text-white disabled:opacity-40"
              >
                <span>Slide tiếp</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
