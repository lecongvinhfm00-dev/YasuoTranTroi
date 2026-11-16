import React, { useEffect, useRef, useState } from 'react';
import {
  BookOpen,
  Maximize2,
  Minimize2,
  Sparkles,
  StickyNote,
  Type,
  Volume2,
  BookmarkCheck,
  CheckCircle2,
} from 'lucide-react';
import type { LiteratureDocument, TTSSettingsConfig } from '../types/studio';
import { vietnameseTTS, type TTSReaderSnapshot } from '../services/ttsService';
import { ReaderControls } from './ReaderControls';

interface ReaderViewProps {
  documents: LiteratureDocument[];
  selectedDocId: string;
  initialSegmentIndex: number;
  ttsSettings: TTSSettingsConfig;
  onSelectDoc: (docId: string) => void;
  onUpdateReadingPosition: (docId: string, segmentIndex: number, totalSegments: number) => void;
  onUpdateTTSSettings: (next: Partial<TTSSettingsConfig>) => void;
  onSendToAI: (doc: LiteratureDocument, selectedExcerpt?: string) => void;
  onQuickSaveNote: (title: string, content: string, documentId: string) => void;
}

const FONT_SIZE_CLASSES: Record<TTSSettingsConfig['fontSize'], string> = {
  sm: 'text-sm leading-relaxed',
  base: 'text-base leading-relaxed',
  lg: 'text-lg leading-loose',
  xl: 'text-xl leading-loose',
};

export const ReaderView: React.FC<ReaderViewProps> = ({
  documents,
  selectedDocId,
  initialSegmentIndex,
  ttsSettings,
  onSelectDoc,
  onUpdateReadingPosition,
  onUpdateTTSSettings,
  onSendToAI,
  onQuickSaveNote,
}) => {
  const currentDoc =
    documents.find((d) => d.id === selectedDocId) || documents[0] || null;

  const [ttsState, setTtsState] = useState<TTSReaderSnapshot>(() =>
    vietnameseTTS.getSnapshot()
  );
  const [focusMode, setFocusMode] = useState(false);
  const [cursorSegmentIndex, setCursorSegmentIndex] = useState<number>(initialSegmentIndex);
  const [selectedExcerpt, setSelectedExcerpt] = useState<string>('');
  const [noteToast, setNoteToast] = useState<string | null>(null);

  const segmentRefs = useRef<Record<number, HTMLDivElement | null>>({});

  // Đăng ký lắng nghe trạng thái TTS và dừng đọc khi rời khỏi trang
  useEffect(() => {
    const unsubscribe = vietnameseTTS.subscribe((snap) => {
      setTtsState(snap);
    });
    return () => {
      unsubscribe();
      vietnameseTTS.stop();
    };
  }, []);

  // Tải văn bản của tác phẩm đang chọn vào bộ đọc TTS
  useEffect(() => {
    if (!currentDoc) return;
    vietnameseTTS.setPreferences({
      rate: ttsSettings.rate,
      pitch: ttsSettings.pitch,
      volume: ttsSettings.volume,
      voiceURI: ttsSettings.voiceURI,
      autoNextSegment: ttsSettings.autoNextSegment,
      autoScroll: ttsSettings.autoScroll,
      highlightActive: ttsSettings.highlightActive,
    });
    vietnameseTTS.loadDocumentText(currentDoc.content, initialSegmentIndex);
    setCursorSegmentIndex(initialSegmentIndex);
  }, [currentDoc?.id]);

  // Tự động cuộn tới đoạn đang đọc và cập nhật vị trí đọc gần nhất
  useEffect(() => {
    if (!currentDoc) return;
    const idx = ttsState.currentSegmentIndex;
    const total = Math.max(1, ttsState.segments.length);
    onUpdateReadingPosition(currentDoc.id, idx, total);

    if (ttsState.autoScroll && ttsState.status === 'reading') {
      const node = segmentRefs.current[idx];
      if (node && typeof node.scrollIntoView === 'function') {
        node.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [ttsState.currentSegmentIndex, ttsState.status]);

  const handleTextSelection = (segIdx: number) => {
    setCursorSegmentIndex(segIdx);
    if (typeof window !== 'undefined' && window.getSelection) {
      const sel = window.getSelection()?.toString().trim() || '';
      if (sel.length > 3) {
        setSelectedExcerpt(sel);
      }
    }
  };

  const handleSaveExcerptNote = () => {
    if (!currentDoc) return;
    const excerptToSave =
      selectedExcerpt.trim() ||
      ttsState.segments[ttsState.currentSegmentIndex] ||
      currentDoc.summary;
    onQuickSaveNote(
      `Trích đoạn: ${currentDoc.title} (Đoạn ${ttsState.currentSegmentIndex + 1})`,
      excerptToSave,
      currentDoc.id
    );
    setNoteToast('Đã lưu đoạn trích vào Ghi chú cá nhân!');
    setTimeout(() => setNoteToast(null), 3000);
  };

  if (!currentDoc) {
    return (
      <div className="p-8 text-center text-[#A0A4B8]">
        Chưa có tác phẩm nào trong thư viện để hiển thị.
      </div>
    );
  }

  return (
    <div
      data-testid="reader-view"
      className={`space-y-5 transition-all ${
        focusMode ? 'max-w-4xl mx-auto py-2' : ''
      }`}
    >
      {/* Thanh tiêu đề Trình đọc văn bản */}
      <div className="flex flex-col gap-3.5 bg-[#171A2B] border border-white/10 rounded-xl p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 shrink-0 rounded-xl bg-[#8275F5]/15 border border-[#8275F5]/30 flex items-center justify-center text-[#E9C878]">
              <BookOpen className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold text-[#F4F4FA]">
                  Trình đọc văn bản & Giọng đọc Tiếng Việt
                </h1>
                <span className="px-2 py-0.5 rounded bg-[#E9C878]/15 text-[#E9C878] text-[11px] font-medium shrink-0">
                  {currentDoc.category}
                </span>
              </div>
              <p className="text-xs text-[#A0A4B8] truncate">
                Tác giả: <span className="text-[#F4F4FA] font-medium">{currentDoc.author}</span> •{' '}
                {currentDoc.period}
              </p>
            </div>
          </div>

          <button
            type="button"
            data-testid="reader-focus-mode-toggle"
            onClick={() => setFocusMode((v) => !v)}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-colors cursor-pointer shrink-0 ${
              focusMode
                ? 'bg-[#E9C878] text-[#0B0D17] border-[#E9C878]'
                : 'bg-[#20243A] text-[#F4F4FA] border-white/10 hover:bg-white/10'
            }`}
          >
            {focusMode ? (
              <>
                <Minimize2 className="w-3.5 h-3.5" />
                Thoát chế độ tập trung
              </>
            ) : (
              <>
                <Maximize2 className="w-3.5 h-3.5" />
                Chế độ tập trung
              </>
            )}
          </button>
        </div>

        {/* Công cụ chọn tác phẩm và cỡ chữ */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2.5 border-t border-white/5">
          <div className="flex items-center gap-2 flex-1 min-w-[220px]">
            <span className="text-xs text-[#A0A4B8] shrink-0">Tác phẩm:</span>
            <select
              data-testid="reader-document-select"
              value={currentDoc.id}
              onChange={(e) => onSelectDoc(e.target.value)}
              className="w-full max-w-md truncate bg-[#101321] border border-white/10 rounded-lg px-3 py-2 text-xs text-[#F4F4FA] focus:outline-none focus:border-[#8275F5]"
            >
              {documents.map((doc) => (
                <option key={doc.id} value={doc.id}>
                  {doc.title} — {doc.author}
                </option>
              ))}
            </select>
          </div>

          {/* Chọn cỡ chữ */}
          <div className="inline-flex items-center bg-[#101321] border border-white/10 rounded-lg p-1 shrink-0">
            <Type className="w-3.5 h-3.5 text-[#A0A4B8] mx-1.5" />
            {(
              [
                { id: 'sm', label: 'Nhỏ' },
                { id: 'base', label: 'Vừa' },
                { id: 'lg', label: 'Lớn' },
                { id: 'xl', label: 'Rất lớn' },
              ] as const
            ).map((sz) => (
              <button
                key={sz.id}
                type="button"
                onClick={() => onUpdateTTSSettings({ fontSize: sz.id })}
                className={`px-2 py-1 rounded text-[11px] transition-colors cursor-pointer ${
                  ttsSettings.fontSize === sz.id
                    ? 'bg-[#8275F5] text-white font-semibold'
                    : 'text-[#A0A4B8] hover:text-white'
                }`}
              >
                {sz.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Bộ điều khiển giọng đọc Tiếng Việt */}
      <ReaderControls
        ttsState={ttsState}
        onPlay={() => vietnameseTTS.play()}
        onPause={() => vietnameseTTS.pause()}
        onResume={() => vietnameseTTS.resume()}
        onStop={() => vietnameseTTS.stop()}
        onReplay={() => vietnameseTTS.replayCurrentSegment()}
        onReadFromCursor={() => vietnameseTTS.play(cursorSegmentIndex)}
        onSelectVoice={(voiceURI) => {
          vietnameseTTS.setVoice(voiceURI);
          onUpdateTTSSettings({ voiceURI });
        }}
        onChangeRate={(rate) => {
          vietnameseTTS.setRate(rate);
          onUpdateTTSSettings({ rate });
        }}
        onChangePitch={(pitch) => {
          vietnameseTTS.setPitch(pitch);
          onUpdateTTSSettings({ pitch });
        }}
        onChangeVolume={(volume) => {
          vietnameseTTS.setVolume(volume);
          onUpdateTTSSettings({ volume });
        }}
        onSelectSegment={(idx) => {
          setCursorSegmentIndex(idx);
          vietnameseTTS.selectSegment(idx, false);
        }}
        onTogglePref={(key, val) => {
          vietnameseTTS.setPreferences({ [key]: val });
          onUpdateTTSSettings({ [key]: val });
        }}
        onRefreshVoices={() => vietnameseTTS.refreshVoices()}
      />

      {noteToast && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#36C98F]/15 border border-[#36C98F]/40 text-xs text-[#36C98F]">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{noteToast}</span>
        </div>
      )}

      {/* Không gian hiển thị văn bản từng đoạn với tô sáng trực quan */}
      <div className="bg-[#171A2B] border border-white/10 rounded-xl p-6 space-y-5 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-white/10">
          <div>
            <h2 className="text-xl font-bold text-[#E9C878] font-serif">{currentDoc.title}</h2>
            <p className="text-xs text-[#A0A4B8] mt-0.5">{currentDoc.summary}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleSaveExcerptNote}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#20243A] hover:bg-white/10 text-xs text-[#E9C878] border border-[#E9C878]/30 transition-colors cursor-pointer"
            >
              <StickyNote className="w-3.5 h-3.5" />
              Lưu đoạn đang chọn vào Ghi chú
            </button>
            <button
              type="button"
              onClick={() =>
                onSendToAI(
                  currentDoc,
                  selectedExcerpt || ttsState.segments[ttsState.currentSegmentIndex]
                )
              }
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#8275F5]/20 hover:bg-[#8275F5]/30 text-xs text-[#A78BFA] border border-[#8275F5]/40 transition-colors cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Phân tích đoạn này bằng AI
            </button>
          </div>
        </div>

        {/* Danh sách các đoạn văn bản */}
        <div className="space-y-4 max-h-[540px] overflow-y-auto pr-2">
          {ttsState.segments.map((segment, index) => {
            const isCurrent = ttsState.currentSegmentIndex === index;
            const isHighlighted = isCurrent && ttsState.highlightActive;

            // Tô sáng từ đang đọc nếu trình duyệt bắn sự kiện onboundary
            let renderedContent: React.ReactNode = segment;
            if (
              isHighlighted &&
              ttsState.status === 'reading' &&
              ttsState.activeCharIndex >= 0 &&
              ttsState.activeCharLength > 0 &&
              ttsState.activeCharIndex < segment.length
            ) {
              const start = ttsState.activeCharIndex;
              const end = Math.min(segment.length, start + ttsState.activeCharLength);
              renderedContent = (
                <>
                  {segment.slice(0, start)}
                  <mark className="bg-[#E9C878] text-[#0B0D17] px-1 rounded font-semibold">
                    {segment.slice(start, end)}
                  </mark>
                  {segment.slice(end)}
                </>
              );
            }

            return (
              <div
                key={index}
                ref={(el) => {
                  segmentRefs.current[index] = el;
                }}
                data-testid={`reader-segment-${index}`}
                onClick={() => handleTextSelection(index)}
                className={`group relative rounded-xl p-4 transition-all border cursor-pointer ${
                  isHighlighted
                    ? 'bg-[#8275F5]/15 border-[#E9C878]/60 shadow-lg'
                    : cursorSegmentIndex === index
                    ? 'bg-[#20243A]/90 border-[#8275F5]/40'
                    : 'bg-[#101321]/70 border-white/5 hover:border-white/15'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center justify-center px-2 py-0.5 rounded text-[10px] font-mono ${
                        isCurrent
                          ? 'bg-[#E9C878] text-[#0B0D17] font-bold'
                          : 'bg-[#20243A] text-[#A0A4B8]'
                      }`}
                    >
                      Đoạn {index + 1}
                    </span>
                    {isCurrent && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-[#E9C878] font-medium">
                        <BookmarkCheck className="w-3.5 h-3.5" />
                        Vị trí đang theo dõi
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setCursorSegmentIndex(index);
                      vietnameseTTS.play(index);
                    }}
                    className="opacity-85 group-hover:opacity-100 inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#20243A] hover:bg-[#8275F5] text-[11px] text-[#F4F4FA] transition-colors cursor-pointer"
                  >
                    <Volume2 className="w-3 h-3" />
                    Đọc đoạn {index + 1}
                  </button>
                </div>

                <div
                  className={`whitespace-pre-line font-serif text-[#F4F4FA] ${
                    FONT_SIZE_CLASSES[ttsSettings.fontSize || 'base']
                  }`}
                >
                  {renderedContent}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
