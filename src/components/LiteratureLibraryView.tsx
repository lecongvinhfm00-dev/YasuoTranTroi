import React, { useRef, useState } from 'react';
import {
  BookOpen,
  Upload,
  Plus,
  Search,
  Highlighter,
  Bookmark,
  Copy,
  Download,
  Volume2,
  Pause,
  Play,
  Square,
  Sparkles,
  Trash2,
  Save,
  Check,
} from 'lucide-react';
import type {
  AIModeId,
  DocumentHighlight,
  LiteratureCategory,
  LiteratureDocument,
} from '../types/studio.ts';
import { AudioEngineState, masterAudioEngine } from '../services/audioEngine.ts';
import { analyzeLiteraryMetrics } from '../utils/studioLogic.ts';

const CATEGORIES: ('Tất cả' | LiteratureCategory)[] = [
  'Tất cả',
  'Thơ',
  'Truyện ngắn',
  'Tiểu thuyết',
  'Kịch',
  'Nghị luận',
  'Tài liệu học tập',
  'Tài liệu thuyết trình',
  'Tài liệu cá nhân',
];

interface LiteratureLibraryViewProps {
  documents: LiteratureDocument[];
  activeDocument: LiteratureDocument | null;
  engineState: AudioEngineState;
  onSelectDocument: (doc: LiteratureDocument) => void;
  onSaveDocument: (doc: LiteratureDocument) => Promise<void>;
  onDeleteDocument: (id: string) => Promise<void>;
  onSendDocumentToAi: (doc: LiteratureDocument, actionLabel: string, mode: AIModeId) => void;
  onOpenInDedicatedReader?: (doc: LiteratureDocument) => void;
}

export const LiteratureLibraryView: React.FC<LiteratureLibraryViewProps> = ({
  documents,
  activeDocument,
  engineState,
  onSelectDocument,
  onSaveDocument,
  onDeleteDocument,
  onSendDocumentToAi,
  onOpenInDedicatedReader,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<'Tất cả' | LiteratureCategory>('Tất cả');
  const [libSearch, setLibSearch] = useState('');
  const [inDocSearch, setInDocSearch] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [newQuote, setNewQuote] = useState('');
  const [newNote, setNewNote] = useState('');
  const [newColor, setNewColor] = useState<DocumentHighlight['color']>('amber');
  const [newBookmark, setNewBookmark] = useState('');
  const [copiedNotice, setCopiedNotice] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftAuthor, setDraftAuthor] = useState('');
  const [draftCategory, setDraftCategory] = useState<LiteratureCategory>('Thơ');
  const [draftContent, setDraftContent] = useState('');

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const currentDoc = activeDocument || documents[0] || null;
  const metrics = currentDoc ? analyzeLiteraryMetrics(currentDoc.content) : null;

  const filteredDocs = documents.filter((d) => {
    if (selectedCategory !== 'Tất cả' && d.category !== selectedCategory) return false;
    if (!libSearch.trim()) return true;
    const q = libSearch.toLowerCase();
    return (
      d.title.toLowerCase().includes(q) ||
      d.author.toLowerCase().includes(q) ||
      d.content.toLowerCase().includes(q)
    );
  });

  const inDocMatchCount =
    currentDoc && inDocSearch.trim()
      ? currentDoc.content
          .toLowerCase()
          .split(inDocSearch.trim().toLowerCase()).length - 1
      : 0;

  const handleImportFile = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    for (const file of Array.from(files)) {
      if (file.size > 5 * 1024 * 1024) {
        continue;
      }
      const ext = (file.name.split('.').pop() || 'TXT').toUpperCase();
      const format: LiteratureDocument['format'] =
        ext === 'MD' ? 'MD' : ext === 'PDF' ? 'PDF' : ext === 'DOCX' ? 'DOCX' : 'TXT';

      const rawText = await file.text();
      const cleanText =
        rawText.replace(/\0/g, '').trim() ||
        `[Tài liệu ${file.name} (${format}) đã được nạp vào không gian làm việc]`;

      const importedDoc: LiteratureDocument = {
        id: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        title: file.name.replace(/\.[^/.]+$/, ''),
        author: 'Tài liệu người dùng',
        category: 'Tài liệu cá nhân',
        period: 'Tài liệu tải lên',
        format,
        content: cleanText,
        summary: cleanText.slice(0, 160),
        highlights: [],
        bookmarks: [],
        personalNotes: '',
        isFavorite: false,
        updatedAt: new Date().toISOString(),
      };
      await onSaveDocument(importedDoc);
      onSelectDocument(importedDoc);
    }
  };

  const handleAddHighlight = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentDoc || !newQuote.trim()) return;
    const hl: DocumentHighlight = {
      id: `hl-${Date.now()}`,
      quote: newQuote.trim(),
      note: newNote.trim() || 'Ghi chú nghệ thuật / nội dung.',
      color: newColor,
      createdAt: new Date().toISOString(),
    };
    const updated: LiteratureDocument = {
      ...currentDoc,
      highlights: [hl, ...currentDoc.highlights],
      updatedAt: new Date().toISOString(),
    };
    await onSaveDocument(updated);
    onSelectDocument(updated);
    setNewQuote('');
    setNewNote('');
  };

  const handleAddBookmark = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentDoc || !newBookmark.trim()) return;
    const updated: LiteratureDocument = {
      ...currentDoc,
      bookmarks: [...currentDoc.bookmarks, newBookmark.trim()],
      updatedAt: new Date().toISOString(),
    };
    await onSaveDocument(updated);
    onSelectDocument(updated);
    setNewBookmark('');
  };

  const handleExportDocument = () => {
    if (!currentDoc) return;
    const exportText = `# ${currentDoc.title}\nTác giả: ${currentDoc.author} · Thể loại: ${currentDoc.category}\n\n${currentDoc.content}\n\n---\n## Ghi chú cá nhân\n${currentDoc.personalNotes}\n`;
    const blob = new Blob([exportText], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentDoc.title.replace(/\s+/g, '_')}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyContent = async () => {
    if (!currentDoc) return;
    await navigator.clipboard.writeText(currentDoc.content);
    setCopiedNotice(true);
    setTimeout(() => setCopiedNotice(false), 2000);
  };

  return (
    <div className="space-y-6 pb-8">
      {/* Header & Category Filter Bar */}
      <section className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-[var(--text-main)]">
              Thư viện Văn học & Không gian Đọc – Chú giải
            </h1>
            <p className="text-xs text-[var(--text-muted)]">
              Quản lý tác phẩm theo 8 phân loại, đánh dấu dẫn chứng, đọc văn bản tiếng Việt và gửi phân tích cùng Trợ lý AI.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {currentDoc && onOpenInDedicatedReader && (
              <button
                type="button"
                onClick={() => onOpenInDedicatedReader(currentDoc)}
                className="flex items-center gap-2 rounded-lg bg-[#E9C878] px-3.5 py-2 text-xs font-semibold text-[#0B0D17] hover:bg-[#E9C878]/90 transition-colors whitespace-nowrap cursor-pointer"
              >
                <Volume2 className="h-4 w-4" />
                <span>Mở trong Trình đọc văn bản (TTS)</span>
              </button>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.md,.pdf,.docx"
              multiple
              onChange={(e) => handleImportFile(e.target.files)}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3.5 py-2 text-xs font-semibold text-[var(--text-main)] hover:border-[#8275F5] transition-colors whitespace-nowrap cursor-pointer"
            >
              <Upload className="h-4 w-4 text-[#8275F5]" />
              <span>Tải tài liệu lên (TXT / MD / PDF)</span>
            </button>

            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 rounded-lg bg-[#8275F5] px-4 py-2 text-xs font-semibold text-white hover:bg-[#7162E8] transition-colors whitespace-nowrap cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Tạo tài liệu mới</span>
            </button>
          </div>
        </div>

        {/* 8 Categories Filter Buttons */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                selectedCategory === cat
                  ? 'bg-[#8275F5] text-white'
                  : 'bg-[var(--bg-surface)] text-[var(--text-muted)] hover:text-[var(--text-main)]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </section>

      {/* Main Split: Document List (Left) + Literature Workspace (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Document Catalog */}
        <div className="lg:col-span-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 space-y-3 h-fit">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="text"
              value={libSearch}
              onChange={(e) => setLibSearch(e.target.value)}
              placeholder="Tìm tác phẩm, tác giả..."
              aria-label="Tìm kiếm tác phẩm văn học"
              className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] pl-9 pr-3 py-2 text-xs text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:border-[#8275F5] focus:outline-none"
            />
          </div>

          <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
            {filteredDocs.map((doc) => {
              const isSelected = currentDoc?.id === doc.id;
              return (
                <div
                  key={doc.id}
                  onClick={() => onSelectDocument(doc)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') onSelectDocument(doc);
                  }}
                  className={`cursor-pointer rounded-lg border p-3.5 transition-colors ${
                    isSelected
                      ? 'border-[#8275F5] bg-[#8275F5]/12'
                      : 'border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:border-[#8275F5]/40'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-xs font-bold text-[var(--text-main)] line-clamp-2">
                      {doc.title}
                    </h3>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteDocument(doc.id);
                      }}
                      aria-label={`Xóa tài liệu ${doc.title}`}
                      className="text-[var(--text-muted)] hover:text-[#F16C78] p-0.5 shrink-0"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <p className="mt-1 text-[11px] text-[#E9C878]">
                    {doc.author} · {doc.category} · {doc.format}
                  </p>
                  <p className="mt-1.5 text-[11px] text-[var(--text-muted)] line-clamp-2">
                    {doc.summary}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Literature Workspace & TTS & AI Actions */}
        {currentDoc ? (
          <div className="lg:col-span-8 space-y-5">
            {/* TTS Reader & Audio Ducking Bar */}
            <section className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Volume2 className="h-4 w-4 text-[#E9C878]" />
                  <h2 className="text-xs font-bold text-[var(--text-main)]">
                    Đọc diễn cảm Văn bản (Text-to-Speech · Kết nối Audio Ducking)
                  </h2>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {!engineState.ttsActive ? (
                    <button
                      type="button"
                      onClick={() => masterAudioEngine.speakText(currentDoc.content)}
                      className="flex items-center gap-1.5 rounded-lg bg-[#8275F5] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#7162E8] transition-colors"
                    >
                      <Play className="h-3.5 w-3.5" />
                      <span>Đọc tác phẩm</span>
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() =>
                          engineState.ttsPaused
                            ? masterAudioEngine.resumeTts()
                            : masterAudioEngine.pauseTts()
                        }
                        className="flex items-center gap-1.5 rounded-lg bg-[#E9C878] px-3 py-1.5 text-xs font-semibold text-[#0B0D17]"
                      >
                        <Pause className="h-3.5 w-3.5" />
                        <span>{engineState.ttsPaused ? 'Tiếp tục đọc' : 'Tạm dừng'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => masterAudioEngine.stopTts()}
                        className="flex items-center gap-1.5 rounded-lg bg-[#F16C78] px-3 py-1.5 text-xs font-semibold text-white"
                      >
                        <Square className="h-3.5 w-3.5" />
                        <span>Dừng đọc</span>
                      </button>
                    </>
                  )}

                  <select
                    aria-label="Tốc độ đọc TTS"
                    value={engineState.ttsRate}
                    onChange={(e) => masterAudioEngine.setTtsRate(Number(e.target.value))}
                    className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-xs font-tabular text-[var(--text-main)]"
                  >
                    <option value={0.8}>Tốc độ 0.8x (Ngâm thơ)</option>
                    <option value={1.0}>Tốc độ 1.0x (Chuẩn)</option>
                    <option value={1.2}>Tốc độ 1.2x (Nhanh)</option>
                  </select>

                  {engineState.availableVoices.length > 0 && (
                    <select
                      aria-label="Chọn giọng đọc TTS"
                      value={engineState.ttsVoiceName}
                      onChange={(e) => masterAudioEngine.setTtsVoice(e.target.value)}
                      className="max-w-[180px] truncate rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-xs text-[var(--text-main)]"
                    >
                      {engineState.availableVoices.map((v) => (
                        <option key={v.name} value={v.name}>
                          {v.name} ({v.lang})
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              {!engineState.hasVietnameseVoice && (
                <p className="text-[11px] text-[var(--text-muted)]">
                  Lưu ý: Trình duyệt hiện tại chưa cài gói giọng đọc tiếng Việt (vi-VN) bản địa; hệ thống sẽ sử dụng giọng mặc định của thiết bị và vẫn tự động giảm nhạc nền (Audio Ducking).
                </p>
              )}
            </section>

            {/* 7.4 One-Click AI Literary Analysis Actions */}
            <section className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-[#A78BFA]" />
                  <h2 className="text-xs font-bold text-[var(--text-main)]">
                    Gửi văn bản sang Trợ lý Văn học AI (Gemini Analysis)
                  </h2>
                </div>
                <span className="text-[11px] text-[var(--text-muted)]">
                  Tự động đính kèm toàn văn tác phẩm
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                <button
                  type="button"
                  onClick={() =>
                    onSendDocumentToAi(
                      currentDoc,
                      `Hãy tóm tắt ngắn gọn nội dung và mạch bố cục của tác phẩm "${currentDoc.title}".`,
                      'work_analysis'
                    )
                  }
                  className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-2 text-xs font-medium text-[var(--text-main)] hover:border-[#8275F5] transition-colors"
                >
                  Tóm tắt
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onSendDocumentToAi(
                      currentDoc,
                      `Phân tích toàn diện giá trị nội dung và tư tưởng của tác phẩm "${currentDoc.title}".`,
                      'work_analysis'
                    )
                  }
                  className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-2 text-xs font-medium text-[var(--text-main)] hover:border-[#8275F5] transition-colors"
                >
                  Phân tích
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onSendDocumentToAi(
                      currentDoc,
                      `Xác định hệ thống luận điểm chính và lập dàn ý nghị luận cho văn bản "${currentDoc.title}".`,
                      'study_support'
                    )
                  }
                  className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-2 text-xs font-medium text-[var(--text-main)] hover:border-[#8275F5] transition-colors"
                >
                  Tìm luận điểm
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onSendDocumentToAi(
                      currentDoc,
                      `Trích xuất và phân tích diễn biến tâm lý, tính cách nhân vật/chủ thể trữ tình trong "${currentDoc.title}".`,
                      'character_analysis'
                    )
                  }
                  className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-2 text-xs font-medium text-[var(--text-main)] hover:border-[#8275F5] transition-colors"
                >
                  Nhân vật
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onSendDocumentToAi(
                      currentDoc,
                      `Xác định chủ đề, cảm hứng chủ đạo và thông điệp nhân sinh của "${currentDoc.title}".`,
                      'work_analysis'
                    )
                  }
                  className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-2 text-xs font-medium text-[var(--text-main)] hover:border-[#8275F5] transition-colors"
                >
                  Chủ đề
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onSendDocumentToAi(
                      currentDoc,
                      `Phân tích đặc sắc nghệ thuật (ngôn từ, giọng điệu, biện pháp tu từ, kết cấu) trong "${currentDoc.title}".`,
                      currentDoc.category === 'Thơ' ? 'poetry_analysis' : 'work_analysis'
                    )
                  }
                  className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-2 text-xs font-medium text-[var(--text-main)] hover:border-[#8275F5] transition-colors"
                >
                  Nghệ thuật
                </button>
              </div>
            </section>

            {/* Document Viewer & Editor */}
            <section className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-subtle)] pb-4">
                <div>
                  <h2 className="text-lg font-bold text-[var(--text-main)]">
                    {currentDoc.title}
                  </h2>
                  <p className="text-xs text-[var(--text-muted)]">
                    {currentDoc.author} · {currentDoc.period} · {metrics?.wordCount} từ ·{' '}
                    {metrics?.estimatedReadingMinutes} phút đọc
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <input
                      type="text"
                      value={inDocSearch}
                      onChange={(e) => setInDocSearch(e.target.value)}
                      placeholder="Tìm trong văn bản..."
                      aria-label="Tìm từ khóa trong văn bản"
                      className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs text-[var(--text-main)] w-44"
                    />
                    {inDocSearch.trim() && (
                      <span className="ml-1.5 font-tabular text-[11px] text-[#E9C878]">
                        {inDocMatchCount} kết quả
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => setEditMode((prev) => !prev)}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                      editMode
                        ? 'bg-[#36C98F] text-[#0B0D17]'
                        : 'bg-[var(--bg-surface)] text-[var(--text-main)]'
                    }`}
                  >
                    <Save className="h-3.5 w-3.5" />
                    <span>{editMode ? 'Xem văn bản' : 'Chỉnh sửa'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCopyContent}
                    className="flex items-center gap-1.5 rounded-lg bg-[var(--bg-surface)] px-3 py-1.5 text-xs font-medium text-[var(--text-main)] hover:bg-[#8275F5] hover:text-white transition-colors"
                  >
                    {copiedNotice ? (
                      <Check className="h-3.5 w-3.5 text-[#36C98F]" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                    <span>{copiedNotice ? 'Đã chép' : 'Sao chép'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleExportDocument}
                    className="flex items-center gap-1.5 rounded-lg bg-[var(--bg-surface)] px-3 py-1.5 text-xs font-medium text-[var(--text-main)] hover:bg-[#8275F5] hover:text-white transition-colors"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Xuất tệp .MD</span>
                  </button>
                </div>
              </div>

              {editMode ? (
                <textarea
                  value={currentDoc.content}
                  onChange={async (e) => {
                    const updated = {
                      ...currentDoc,
                      content: e.target.value,
                      updatedAt: new Date().toISOString(),
                    };
                    onSelectDocument(updated);
                    await onSaveDocument(updated);
                  }}
                  rows={14}
                  aria-label="Trình soạn thảo nội dung văn bản"
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 font-literary text-base leading-relaxed text-[var(--text-main)] focus:border-[#8275F5] focus:outline-none"
                />
              ) : (
                <div className="rounded-xl bg-[var(--bg-surface)]/45 p-6 font-literary text-base leading-relaxed text-[var(--text-main)] whitespace-pre-wrap max-h-[420px] overflow-y-auto border border-[var(--border-subtle)]">
                  {currentDoc.content}
                </div>
              )}
            </section>

            {/* Đánh dấu dẫn chứng, Chú giải, Dấu trang & Ghi chú cá nhân */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Đánh dấu & Chú giải */}
              <section className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <Highlighter className="h-4 w-4 text-[#E9C878]" />
                  <h3 className="text-sm font-bold text-[var(--text-main)]">
                    Đánh dấu dẫn chứng & Chú giải
                  </h3>
                </div>

                <form onSubmit={handleAddHighlight} className="space-y-2.5 text-xs">
                  <input
                    type="text"
                    value={newQuote}
                    onChange={(e) => setNewQuote(e.target.value)}
                    placeholder="Trích dẫn câu thơ / câu văn cần đánh dấu..."
                    className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-[var(--text-main)]"
                  />
                  <input
                    type="text"
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    placeholder="Ghi chú phân tích nghệ thuật / nội dung..."
                    className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-[var(--text-main)]"
                  />
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      {(['amber', 'violet', 'emerald', 'rose'] as const).map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setNewColor(c)}
                          aria-label={`Chọn màu đánh dấu ${c}`}
                          className={`h-5 w-5 rounded-full border ${
                            newColor === c ? 'ring-2 ring-white' : 'opacity-60'
                          } ${
                            c === 'amber'
                              ? 'bg-[#E9C878]'
                              : c === 'violet'
                              ? 'bg-[#8275F5]'
                              : c === 'emerald'
                              ? 'bg-[#36C98F]'
                              : 'bg-[#F16C78]'
                          }`}
                        />
                      ))}
                    </div>
                    <button
                      type="submit"
                      className="rounded-lg bg-[#8275F5] px-3 py-1.5 font-semibold text-white hover:bg-[#7162E8]"
                    >
                      Lưu dẫn chứng
                    </button>
                  </div>
                </form>

                <div className="space-y-2.5 max-h-52 overflow-y-auto pr-1">
                  {currentDoc.highlights.map((hl) => (
                    <div
                      key={hl.id}
                      className="rounded-lg bg-[var(--bg-surface)] p-3 border border-[var(--border-subtle)] space-y-1"
                    >
                      <p className="font-literary italic text-xs font-semibold text-[#E9C878]">
                        “{hl.quote}”
                      </p>
                      <p className="text-xs text-[var(--text-main)]">{hl.note}</p>
                    </div>
                  ))}
                </div>
              </section>

              {/* Dấu trang & Ghi chú cá nhân */}
              <section className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <Bookmark className="h-4 w-4 text-[#8275F5]" />
                  <h3 className="text-sm font-bold text-[var(--text-main)]">
                    Dấu trang & Sổ tay Ghi chú cá nhân
                  </h3>
                </div>

                <form onSubmit={handleAddBookmark} className="flex gap-2 text-xs">
                  <input
                    type="text"
                    value={newBookmark}
                    onChange={(e) => setNewBookmark(e.target.value)}
                    placeholder="Thêm dấu trang (VD: Khổ 2 - Tượng đài người lính)..."
                    className="flex-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-1.5 text-[var(--text-main)]"
                  />
                  <button
                    type="submit"
                    className="rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] px-3 py-1.5 font-semibold text-[var(--text-main)] hover:border-[#8275F5]"
                  >
                    Đánh dấu
                  </button>
                </form>

                {currentDoc.bookmarks.length > 0 && (
                  <div className="text-xs text-[var(--text-muted)]">
                    Dấu trang: {currentDoc.bookmarks.join(' · ')}
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-[var(--text-muted)]">
                    Ghi chú học tập cá nhân (Tự động lưu IndexedDB)
                  </label>
                  <textarea
                    rows={5}
                    value={currentDoc.personalNotes}
                    onChange={async (e) => {
                      const updated = {
                        ...currentDoc,
                        personalNotes: e.target.value,
                        updatedAt: new Date().toISOString(),
                      };
                      onSelectDocument(updated);
                      await onSaveDocument(updated);
                    }}
                    placeholder="Ghi lại ý tưởng mở bài, liên hệ mở rộng..."
                    className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3 text-xs text-[var(--text-main)] focus:border-[#8275F5] focus:outline-none"
                  />
                </div>
              </section>
            </div>
          </div>
        ) : (
          <div className="lg:col-span-8 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-12 text-center">
            <BookOpen className="mx-auto h-8 w-8 text-[var(--text-muted)]" />
            <p className="mt-2 text-sm font-semibold text-[var(--text-main)]">
              Chọn một tác phẩm từ danh mục bên trái để bắt đầu đọc và phân tích.
            </p>
          </div>
        )}
      </div>

      {/* Create New Literature Document Modal */}
      {showCreateModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Tạo tài liệu văn học mới"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
        >
          <div className="w-full max-w-lg rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6 space-y-4">
            <h3 className="text-base font-bold text-[var(--text-main)]">
              Thêm tác phẩm / tài liệu văn học mới
            </h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[var(--text-muted)] mb-1">Tiêu đề tác phẩm / tài liệu</label>
                <input
                  type="text"
                  value={draftTitle}
                  onChange={(e) => setDraftTitle(e.target.value)}
                  placeholder="VD: Việt Bắc (Trích đoạn)"
                  className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-[var(--text-main)]"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[var(--text-muted)] mb-1">Tác giả</label>
                  <input
                    type="text"
                    value={draftAuthor}
                    onChange={(e) => setDraftAuthor(e.target.value)}
                    placeholder="VD: Tố Hữu"
                    className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-[var(--text-main)]"
                  />
                </div>
                <div>
                  <label className="block text-[var(--text-muted)] mb-1">Phân loại</label>
                  <select
                    value={draftCategory}
                    onChange={(e) => setDraftCategory(e.target.value as LiteratureCategory)}
                    className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-[var(--text-main)]"
                  >
                    {CATEGORIES.filter((c) => c !== 'Tất cả').map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[var(--text-muted)] mb-1">Nội dung văn bản</label>
                <textarea
                  rows={6}
                  value={draftContent}
                  onChange={(e) => setDraftContent(e.target.value)}
                  placeholder="Nhập hoặc dán nội dung thơ, văn xuôi, đề cương..."
                  className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3 font-literary text-sm text-[var(--text-main)]"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="rounded-lg bg-[var(--bg-surface)] px-4 py-2 text-xs font-medium text-[var(--text-main)]"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!draftTitle.trim() || !draftContent.trim()) return;
                  const newDoc: LiteratureDocument = {
                    id: `doc-${Date.now()}`,
                    title: draftTitle.trim(),
                    author: draftAuthor.trim() || 'Khuyết danh',
                    category: draftCategory,
                    period: 'Tài liệu bổ sung',
                    format: 'MD',
                    content: draftContent.trim(),
                    summary: draftContent.trim().slice(0, 140),
                    highlights: [],
                    bookmarks: [],
                    personalNotes: '',
                    isFavorite: false,
                    updatedAt: new Date().toISOString(),
                  };
                  await onSaveDocument(newDoc);
                  onSelectDocument(newDoc);
                  setDraftTitle('');
                  setDraftAuthor('');
                  setDraftContent('');
                  setShowCreateModal(false);
                }}
                className="rounded-lg bg-[#8275F5] px-4 py-2 text-xs font-semibold text-white"
              >
                Lưu tài liệu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
