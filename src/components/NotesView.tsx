import React, { useState } from 'react';
import {
  StickyNote,
  Plus,
  Trash2,
  Edit3,
  Save,
  X,
  Search,
  BookOpen,
  Tag,
} from 'lucide-react';
import type { LiteratureDocument, PersonalNoteItem } from '../types/studio';

interface NotesViewProps {
  notes: PersonalNoteItem[];
  documents: LiteratureDocument[];
  onSaveNote: (note: PersonalNoteItem) => void;
  onDeleteNote: (id: string) => void;
  onOpenDocumentInReader: (docId: string) => void;
}

export const NotesView: React.FC<NotesViewProps> = ({
  notes,
  documents,
  onSaveNote,
  onDeleteNote,
  onOpenDocumentInReader,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDocId, setFilterDocId] = useState<string>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [documentId, setDocumentId] = useState<string>(documents[0]?.id || '');
  const [tagsInput, setTagsInput] = useState('Cảm nhận, Dẫn chứng');

  const resetForm = () => {
    setEditingId(null);
    setTitle('');
    setContent('');
    setDocumentId(documents[0]?.id || '');
    setTagsInput('Cảm nhận, Dẫn chứng');
  };

  const handleStartEdit = (note: PersonalNoteItem) => {
    setEditingId(note.id);
    setTitle(note.title);
    setContent(note.content);
    setDocumentId(note.documentId || '');
    setTagsInput((note.tags || []).join(', '));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    const linkedDoc = documents.find((d) => d.id === documentId);
    const noteObj: PersonalNoteItem = {
      id: editingId || `note-${Date.now()}`,
      title: title.trim(),
      content: content.trim(),
      documentId: linkedDoc?.id,
      documentTitle: linkedDoc?.title,
      tags: tagsInput
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      updatedAt: new Date().toISOString(),
    };

    onSaveNote(noteObj);
    resetForm();
  };

  const filteredNotes = notes.filter((n) => {
    const matchesDoc = filterDocId === 'all' || n.documentId === filterDocId;
    const q = searchQuery.trim().toLowerCase();
    const matchesQuery =
      !q ||
      n.title.toLowerCase().includes(q) ||
      n.content.toLowerCase().includes(q) ||
      (n.documentTitle || '').toLowerCase().includes(q) ||
      (n.tags || []).some((t) => t.toLowerCase().includes(q));
    return matchesDoc && matchesQuery;
  });

  return (
    <div data-testid="notes-view" className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#171A2B] border border-white/10 rounded-xl p-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#E9C878]/15 border border-[#E9C878]/30 flex items-center justify-center text-[#E9C878]">
            <StickyNote className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-[#F4F4FA]">Ghi chú văn học cá nhân</h1>
            <p className="text-xs text-[#A0A4B8]">
              Lưu trữ luận điểm, trích dẫn tâm đắc và dàn ý ôn tập — tự động đồng bộ theo tài khoản ẩn danh của bạn.
            </p>
          </div>
        </div>
        <div className="text-xs text-[#E9C878] font-mono bg-[#101321] px-3 py-1.5 rounded-lg border border-white/10">
          Tổng số: {notes.length} ghi chú
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Biểu mẫu thêm / chỉnh sửa ghi chú */}
        <form
          onSubmit={handleSubmit}
          className="lg:col-span-5 bg-[#171A2B] border border-white/10 rounded-xl p-5 space-y-4 h-fit"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#F4F4FA] flex items-center gap-2">
              <Plus className="w-4 h-4 text-[#8275F5]" />
              {editingId ? 'Chỉnh sửa ghi chú' : 'Tạo ghi chú văn học mới'}
            </h2>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="text-xs text-[#A0A4B8] hover:text-white inline-flex items-center gap-1 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                Hủy sửa
              </button>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs text-[#A0A4B8]">Tiêu đề ghi chú</label>
            <input
              data-testid="note-title-input"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ví dụ: Nghệ thuật tả cảnh ngụ tình trong Truyện Kiều..."
              className="w-full bg-[#101321] border border-white/10 rounded-lg px-3 py-2 text-xs text-[#F4F4FA] focus:outline-none focus:border-[#8275F5]"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs text-[#A0A4B8]">Liên kết tác phẩm văn học</label>
            <select
              data-testid="note-doc-select"
              value={documentId}
              onChange={(e) => setDocumentId(e.target.value)}
              className="w-full bg-[#101321] border border-white/10 rounded-lg px-3 py-2 text-xs text-[#F4F4FA] focus:outline-none focus:border-[#8275F5]"
            >
              <option value="">-- Ghi chú chung (Không gắn tác phẩm) --</option>
              {documents.map((doc) => (
                <option key={doc.id} value={doc.id}>
                  {doc.title} — {doc.author}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs text-[#A0A4B8]">Nội dung ghi chú / Trích dẫn</label>
            <textarea
              data-testid="note-content-input"
              rows={5}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Nhập câu thơ, dẫn chứng hoặc luận điểm phân tích của bạn..."
              className="w-full bg-[#101321] border border-white/10 rounded-lg p-3 text-xs text-[#F4F4FA] focus:outline-none focus:border-[#8275F5] leading-relaxed"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs text-[#A0A4B8]">Từ khóa (ngăn cách bằng dấu phẩy)</label>
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="Cảm nhận, Thơ Mới, Ôn thi..."
              className="w-full bg-[#101321] border border-white/10 rounded-lg px-3 py-2 text-xs text-[#F4F4FA] focus:outline-none focus:border-[#8275F5]"
            />
          </div>

          <button
            type="submit"
            data-testid="note-save-button"
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#8275F5] hover:bg-[#8275F5]/90 text-white text-xs font-semibold shadow-md transition-all cursor-pointer"
          >
            <Save className="w-4 h-4" />
            {editingId ? 'Cập nhật ghi chú' : 'Lưu ghi chú cá nhân'}
          </button>
        </form>

        {/* Danh sách ghi chú đã lưu */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 bg-[#171A2B] border border-white/10 rounded-xl p-3.5">
            <div className="relative flex-1 min-w-0">
              <Search className="w-4 h-4 text-[#A0A4B8] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm kiếm trong ghi chú cá nhân..."
                className="w-full bg-[#101321] border border-white/10 rounded-lg pl-9 pr-3 py-2 text-xs text-[#F4F4FA] focus:outline-none focus:border-[#8275F5]"
              />
            </div>
            <select
              value={filterDocId}
              onChange={(e) => setFilterDocId(e.target.value)}
              className="sm:max-w-[210px] truncate bg-[#101321] border border-white/10 rounded-lg px-3 py-2 text-xs text-[#F4F4FA]"
            >
              <option value="all">Tất cả tác phẩm</option>
              {documents.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.title}
                </option>
              ))}
            </select>
          </div>

          {filteredNotes.length === 0 ? (
            <div className="bg-[#171A2B] border border-white/10 rounded-xl p-8 text-center text-xs text-[#A0A4B8]">
              Chưa có ghi chú nào phù hợp. Hãy thêm ghi chú mới ở khung bên trái hoặc lưu trực tiếp khi đang đọc văn bản.
            </div>
          ) : (
            <div className="space-y-3">
              {filteredNotes.map((note) => (
                <div
                  key={note.id}
                  data-testid={`note-card-${note.id}`}
                  className="bg-[#171A2B] border border-white/10 rounded-xl p-4 space-y-3 hover:border-[#8275F5]/40 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-[#F4F4FA]">{note.title}</h3>
                      <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px] text-[#A0A4B8]">
                        <span>
                          Cập nhật: {new Date(note.updatedAt).toLocaleString('vi-VN')}
                        </span>
                        {note.documentTitle && (
                          <button
                            type="button"
                            onClick={() =>
                              note.documentId && onOpenDocumentInReader(note.documentId)
                            }
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#8275F5]/15 text-[#A78BFA] hover:bg-[#8275F5]/25 cursor-pointer"
                          >
                            <BookOpen className="w-3 h-3" />
                            {note.documentTitle}
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleStartEdit(note)}
                        className="p-1.5 rounded-lg bg-[#20243A] hover:bg-white/10 text-[#E9C878] cursor-pointer"
                        title="Chỉnh sửa"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteNote(note.id)}
                        className="p-1.5 rounded-lg bg-[#20243A] hover:bg-[#F16C78]/20 text-[#F16C78] cursor-pointer"
                        title="Xóa ghi chú"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <p className="text-xs text-[#F4F4FA]/90 whitespace-pre-line leading-relaxed bg-[#101321]/70 p-3 rounded-lg border border-white/5">
                    {note.content}
                  </p>

                  {note.tags && note.tags.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      {note.tags.map((tag, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#20243A] text-[10px] text-[#A0A4B8]"
                        >
                          <Tag className="w-2.5 h-2.5 text-[#E9C878]" />
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
