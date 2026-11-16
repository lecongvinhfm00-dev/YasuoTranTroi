import React, { useRef, useState } from 'react';
import {
  Sparkles,
  Send,
  Square,
  RotateCcw,
  Copy,
  Trash2,
  Download,
  Plus,
  Sliders,
  BookOpen,
  Volume2,
  Check,
} from 'lucide-react';
import type {
  AIModeId,
  AISettingsConfig,
  ChatMessage,
  ConversationItem,
  LiteratureDocument,
} from '../types/studio.ts';
import { studioApiClient } from '../services/apiClient.ts';
import { masterAudioEngine } from '../services/audioEngine.ts';

const AI_MODES: { id: AIModeId; label: string; desc: string; samplePrompt: string }[] = [
  {
    id: 'work_analysis',
    label: 'A. Phân tích tác phẩm',
    desc: 'Hoàn cảnh sáng tác, xuất xứ, chủ đề, giá trị hiện thực & nhân đạo',
    samplePrompt:
      'Phân tích giá trị hiện thực và giá trị nhân đạo sâu sắc trong truyện ngắn Chí Phèo của Nam Cao.',
  },
  {
    id: 'character_analysis',
    label: 'B. Phân tích nhân vật',
    desc: 'Ngoại hình, hành động, ngôn ngữ, diễn biến tâm lý & ý nghĩa hình tượng',
    samplePrompt:
      'Phân tích diễn biến tâm lý nhân vật Thúy Kiều trong đoạn trích Trao duyên (Truyện Kiều - Nguyễn Du).',
  },
  {
    id: 'poetry_analysis',
    label: 'C. Phân tích thơ',
    desc: 'Thể thơ, hình ảnh, nhịp điệu, biện pháp tu từ & mạch cảm xúc',
    samplePrompt:
      'Phân tích bức tranh thiên nhiên Tây Bắc và hình tượng người lính trong bài thơ Tây Tiến của Quang Dũng.',
  },
  {
    id: 'study_support',
    label: 'D. Hỗ trợ học tập',
    desc: 'Lập dàn ý nghị luận, viết đoạn văn, nhận xét và sửa bài làm',
    samplePrompt:
      'Hãy lập dàn ý chi tiết đề bài: Cảm nhận vẻ đẹp khuất lấp của nhân vật người vợ nhặt trong truyện ngắn Vợ nhặt (Kim Lân).',
  },
  {
    id: 'literary_comparison',
    label: 'E. So sánh văn học',
    desc: 'So sánh nhân vật, tác phẩm, phong cách nghệ thuật và tư tưởng',
    samplePrompt:
      'So sánh hình tượng người lính trong bài thơ Tây Tiến (Quang Dũng) và Đồng chí (Chính Hữu).',
  },
  {
    id: 'presentation_assistant',
    label: 'F. Hỗ trợ soạn thuyết trình',
    desc: 'Tạo nội dung slide, lời dẫn thuyết trình và câu hỏi tương tác',
    samplePrompt:
      'Soạn cấu trúc 4 slide thuyết trình kèm lời dẫn về bi kịch tinh thần trong vở kịch Hồn Trương Ba, da hàng thịt của Lưu Quang Vũ.',
  },
];

interface AIAssistantViewProps {
  conversations: ConversationItem[];
  activeDocument: LiteratureDocument | null;
  aiSettings: AISettingsConfig;
  quotaUsed: number;
  quotaLimit: number;
  onUpdateAiSettings: (next: AISettingsConfig) => void;
  onRefreshConversationsAndQuota: () => Promise<void>;
  onImportSlidesFromAi: (markdownContent: string, title: string) => void;
}

export const AIAssistantView: React.FC<AIAssistantViewProps> = ({
  conversations,
  activeDocument,
  aiSettings,
  quotaUsed,
  quotaLimit,
  onUpdateAiSettings,
  onRefreshConversationsAndQuota,
  onImportSlidesFromAi,
}) => {
  const [selectedMode, setSelectedMode] = useState<AIModeId>('work_analysis');
  const [activeConvId, setActiveConvId] = useState<number | string | undefined>(
    conversations[0]?.id
  );
  const [localMessages, setLocalMessages] = useState<ChatMessage[]>(
    conversations[0]?.messages || []
  );
  const [inputPrompt, setInputPrompt] = useState('');
  const [attachActiveDoc, setAttachActiveDoc] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [showSettingsDrawer, setShowSettingsDrawer] = useState(false);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  const handleSelectConversation = (conv: ConversationItem) => {
    setActiveConvId(conv.id);
    setSelectedMode(conv.mode || 'work_analysis');
    setLocalMessages(conv.messages || []);
    setErrorBanner(null);
  };

  const handleNewChat = () => {
    setActiveConvId(undefined);
    setLocalMessages([]);
    setErrorBanner(null);
  };

  const executePrompt = async (promptText: string) => {
    if (!promptText.trim() || isGenerating) return;
    setErrorBanner(null);

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: promptText.trim(),
      createdAt: new Date().toISOString(),
      mode: selectedMode,
    };

    const updatedHistory = [...localMessages, userMsg];
    setLocalMessages(updatedHistory);
    setInputPrompt('');
    setIsGenerating(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await studioApiClient.askLiteratureAI(
        {
          prompt: promptText.trim(),
          documentContext:
            attachActiveDoc && activeDocument ? activeDocument.content : undefined,
          mode: selectedMode,
          model: aiSettings.model,
          responseLength: aiSettings.responseLength,
          history: localMessages.map((m) => ({ role: m.role, content: m.content })),
          conversationId: activeConvId,
          saveHistory: aiSettings.saveHistory,
        },
        controller.signal
      );

      const assistantMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: response.reply,
        createdAt: new Date().toISOString(),
        mode: selectedMode,
      };

      setLocalMessages((prev) => [...prev, assistantMsg]);
      if (response.conversationId) {
        setActiveConvId(response.conversationId);
      }
      await onRefreshConversationsAndQuota();
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        setErrorBanner('Đã dừng quá trình sinh câu trả lời theo yêu cầu.');
      } else {
        setErrorBanner(err?.message || 'Không thể kết nối tới dịch vụ Gemini AI.');
      }
    } finally {
      setIsGenerating(false);
      abortControllerRef.current = null;
    }
  };

  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const handleRegenerateLast = () => {
    const lastUser = [...localMessages].reverse().find((m) => m.role === 'user');
    if (lastUser) {
      executePrompt(lastUser.content);
    }
  };

  const handleExportConversation = () => {
    if (localMessages.length === 0) return;
    const md = localMessages
      .map(
        (m) =>
          `### ${m.role === 'user' ? 'Học viên' : 'Giáo viên Ngữ văn AI'}\n\n${m.content}\n`
      )
      .join('\n---\n\n');
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Hoi_thoai_Van_hoc_${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const currentModeObj = AI_MODES.find((m) => m.id === selectedMode) || AI_MODES[0];

  return (
    <div className="space-y-6 pb-8">
      {/* Top Mode Selector & AI Settings Bar */}
      <section className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-[var(--text-main)]">
              Trợ lý Văn học AI — Giáo viên Ngữ văn Chuyên sâu (Google Gemini API)
            </h1>
            <p className="text-xs text-[var(--text-muted)]">
              Phân tích có căn cứ văn bản, không tự bịa dẫn chứng · Model hiện tại:{' '}
              <span className="font-tabular font-semibold text-[#E9C878]">
                {aiSettings.model}
              </span>{' '}
              · Đã dùng{' '}
              <span className="font-tabular font-semibold text-[#36C98F]">
                {quotaUsed}/{quotaLimit} lượt
              </span>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleNewChat}
              className="flex items-center gap-1.5 rounded-lg bg-[#8275F5] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#7162E8] transition-colors whitespace-nowrap"
            >
              <Plus className="h-4 w-4" />
              <span>Hội thoại mới</span>
            </button>

            <button
              type="button"
              onClick={() => setShowSettingsDrawer((prev) => !prev)}
              className="flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3.5 py-2 text-xs font-semibold text-[var(--text-main)] hover:border-[#8275F5] transition-colors whitespace-nowrap"
            >
              <Sliders className="h-4 w-4 text-[#E9C878]" />
              <span>Cấu hình AI</span>
            </button>
          </div>
        </div>

        {/* 6 Literature AI Modes */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {AI_MODES.map((m) => {
            const active = selectedMode === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setSelectedMode(m.id)}
                className={`rounded-lg border p-3 text-left transition-colors ${
                  active
                    ? 'border-[#8275F5] bg-[#8275F5]/15'
                    : 'border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:border-[#8275F5]/40'
                }`}
              >
                <p className="text-xs font-bold text-[var(--text-main)]">{m.label}</p>
                <p className="mt-1 text-[11px] text-[var(--text-muted)] line-clamp-1">
                  {m.desc}
                </p>
              </button>
            );
          })}
        </div>

        {/* Optional AI Settings Drawer */}
        {showSettingsDrawer && (
          <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block text-[var(--text-muted)] mb-1">
                Model Gemini đã xác minh
              </label>
              <select
                aria-label="Chọn Gemini Model"
                value={aiSettings.model}
                onChange={(e) =>
                  onUpdateAiSettings({
                    ...aiSettings,
                    model: e.target.value as AISettingsConfig['model'],
                  })
                }
                className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 py-2 text-[var(--text-main)]"
              >
                <option value="gemini-4-hydrogen">gemini-4-hydrogen (Khuyên dùng)</option>
                <option value="gemini-3.1-flash-lite">gemini-3.1-flash-lite (Tốc độ cao)</option>
              </select>
            </div>

            <div>
              <label className="block text-[var(--text-muted)] mb-1">
                Độ sâu bài phân tích
              </label>
              <select
                aria-label="Chọn độ dài câu trả lời"
                value={aiSettings.responseLength}
                onChange={(e) =>
                  onUpdateAiSettings({
                    ...aiSettings,
                    responseLength: e.target.value as AISettingsConfig['responseLength'],
                  })
                }
                className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 py-2 text-[var(--text-main)]"
              >
                <option value="concise">Ngắn gọn (Tóm lược trọng tâm)</option>
                <option value="balanced">Cân đối (Chuẩn bài giảng)</option>
                <option value="deep">Chuyên sâu (Phân tích học thuật mở rộng)</option>
              </select>
            </div>

            <div className="flex flex-col justify-center space-y-2 pt-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={aiSettings.saveHistory}
                  onChange={(e) =>
                    onUpdateAiSettings({ ...aiSettings, saveHistory: e.target.checked })
                  }
                  className="h-4 w-4 accent-[#8275F5]"
                />
                <span className="text-[var(--text-main)]">
                  Tự động lưu lịch sử hội thoại vào Database
                </span>
              </label>
            </div>
          </div>
        )}
      </section>

      {/* Main Chat Split: Conversation History Sidebar + Chat Stream */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Conversation History List */}
        <div className="lg:col-span-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 space-y-3 h-fit">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-[var(--text-main)]">
              Lịch sử Hội thoại ({conversations.length})
            </h2>
            {conversations.length > 0 && (
              <button
                type="button"
                onClick={async () => {
                  await studioApiClient.deleteConversation();
                  handleNewChat();
                  await onRefreshConversationsAndQuota();
                }}
                className="text-[11px] text-[#F16C78] hover:underline"
              >
                Xóa tất cả
              </button>
            )}
          </div>

          <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
            {conversations.length > 0 ? (
              conversations.map((conv) => {
                const isCurrent = String(activeConvId) === String(conv.id);
                return (
                  <div
                    key={String(conv.id)}
                    onClick={() => handleSelectConversation(conv)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSelectConversation(conv);
                    }}
                    className={`cursor-pointer rounded-lg border p-3 transition-colors ${
                      isCurrent
                        ? 'border-[#8275F5] bg-[#8275F5]/15'
                        : 'border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:border-[#8275F5]/40'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-semibold text-[var(--text-main)] line-clamp-2">
                        {conv.title}
                      </p>
                      <button
                        type="button"
                        onClick={async (e) => {
                          e.stopPropagation();
                          await studioApiClient.deleteConversation(conv.id);
                          if (isCurrent) handleNewChat();
                          await onRefreshConversationsAndQuota();
                        }}
                        aria-label={`Xóa hội thoại ${conv.title}`}
                        className="text-[var(--text-muted)] hover:text-[#F16C78] p-0.5"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <p className="mt-1 text-[11px] text-[var(--text-muted)]">
                      {conv.messages.length} tin nhắn ·{' '}
                      {new Date(conv.updatedAt).toLocaleDateString('vi-VN')}
                    </p>
                  </div>
                );
              })
            ) : (
              <p className="text-xs text-[var(--text-muted)] py-6 text-center">
                Chưa có hội thoại nào được lưu. Hãy đặt câu hỏi đầu tiên bên phải.
              </p>
            )}
          </div>
        </div>

        {/* Right Chat Workspace */}
        <div className="lg:col-span-8 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] flex flex-col min-h-[540px]">
          {/* Context Header */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-subtle)] px-5 py-3.5">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[#E9C878]" />
              <span className="text-xs font-bold text-[var(--text-main)]">
                {currentModeObj.label}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {activeDocument && (
                <label className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={attachActiveDoc}
                    onChange={(e) => setAttachActiveDoc(e.target.checked)}
                    className="h-3.5 w-3.5 accent-[#8275F5]"
                  />
                  <BookOpen className="h-3.5 w-3.5 text-[#36C98F]" />
                  <span className="truncate max-w-[180px]">
                    Đính kèm: {activeDocument.title}
                  </span>
                </label>
              )}

              {localMessages.length > 0 && (
                <button
                  type="button"
                  onClick={handleExportConversation}
                  className="flex items-center gap-1 rounded-lg bg-[var(--bg-surface)] px-2.5 py-1 text-xs font-medium text-[var(--text-main)] hover:bg-[#8275F5] hover:text-white transition-colors"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Xuất tệp .MD</span>
                </button>
              )}
            </div>
          </div>

          {/* Messages Stream */}
          <div className="flex-1 space-y-4 overflow-y-auto p-5 max-h-[460px]">
            {localMessages.length === 0 ? (
              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]/50 p-6 space-y-3">
                <p className="text-sm font-bold text-[var(--text-main)]">
                  Gợi ý câu hỏi mẫu cho chế độ “{currentModeObj.label}”:
                </p>
                <p className="font-literary italic text-xs text-[var(--text-muted)]">
                  “{currentModeObj.samplePrompt}”
                </p>
                <button
                  type="button"
                  onClick={() => executePrompt(currentModeObj.samplePrompt)}
                  className="rounded-lg bg-[#8275F5] px-4 py-2 text-xs font-semibold text-white hover:bg-[#7162E8] transition-colors"
                >
                  Thử câu hỏi mẫu này ngay
                </button>
              </div>
            ) : (
              localMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`rounded-xl p-4 space-y-2 ${
                    msg.role === 'user'
                      ? 'bg-[#8275F5]/15 border border-[#8275F5]/30 ml-6'
                      : 'bg-[var(--bg-surface)] border border-[var(--border-subtle)] mr-4'
                  }`}
                >
                  <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)]">
                    <span className="font-bold text-[var(--text-main)]">
                      {msg.role === 'user' ? 'Bạn' : 'Giáo viên Ngữ văn AI (Gemini)'}
                    </span>

                    {msg.role === 'assistant' && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => masterAudioEngine.speakText(msg.content)}
                          aria-label="Đọc câu trả lời bằng giọng đọc"
                          className="flex items-center gap-1 hover:text-[#E9C878]"
                        >
                          <Volume2 className="h-3.5 w-3.5" />
                          <span>Nghe đọc</span>
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            onImportSlidesFromAi(
                              msg.content,
                              'Bài thuyết trình từ Trợ lý AI'
                            )
                          }
                          className="hover:text-[#A78BFA]"
                        >
                          Chuyển thành Slide
                        </button>

                        <button
                          type="button"
                          onClick={async () => {
                            await navigator.clipboard.writeText(msg.content);
                            setCopiedMsgId(msg.id);
                            setTimeout(() => setCopiedMsgId(null), 2000);
                          }}
                          className="flex items-center gap-1 hover:text-[var(--text-main)]"
                        >
                          {copiedMsgId === msg.id ? (
                            <Check className="h-3.5 w-3.5 text-[#36C98F]" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                          <span>Sao chép</span>
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="text-xs leading-relaxed text-[var(--text-main)] whitespace-pre-wrap">
                    {msg.content}
                  </div>
                </div>
              ))
            )}

            {isGenerating && (
              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 flex items-center justify-between">
                <span className="text-xs text-[var(--text-muted)]">
                  Giáo viên Ngữ văn AI đang phân tích văn bản và biên soạn luận điểm...
                </span>
                <button
                  type="button"
                  onClick={handleStopGeneration}
                  className="flex items-center gap-1 rounded-lg bg-[#F16C78] px-3 py-1 text-xs font-semibold text-white"
                >
                  <Square className="h-3 w-3" />
                  <span>Dừng</span>
                </button>
              </div>
            )}

            {errorBanner && (
              <div className="rounded-xl border border-[#F16C78]/40 bg-[#F16C78]/15 p-3.5 text-xs text-[#F16C78]">
                {errorBanner}
              </div>
            )}
          </div>

          {/* Input Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              executePrompt(inputPrompt);
            }}
            className="border-t border-[var(--border-subtle)] p-4 space-y-2.5"
          >
            <textarea
              rows={3}
              value={inputPrompt}
              onChange={(e) => setInputPrompt(e.target.value)}
              placeholder="Nhập câu hỏi phân tích tác phẩm, nhân vật, khổ thơ hoặc yêu cầu lập dàn ý..."
              aria-label="Nội dung câu hỏi gửi cho AI"
              className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3 text-xs text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:border-[#8275F5] focus:outline-none"
            />
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {localMessages.length > 0 && (
                  <button
                    type="button"
                    onClick={handleRegenerateLast}
                    disabled={isGenerating}
                    className="flex items-center gap-1 rounded-lg bg-[var(--bg-surface)] px-3 py-1.5 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-main)]"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Tạo lại phản hồi</span>
                  </button>
                )}
              </div>

              <button
                type="submit"
                disabled={isGenerating || !inputPrompt.trim()}
                className="flex items-center gap-1.5 rounded-lg bg-[#8275F5] px-5 py-2 text-xs font-semibold text-white hover:bg-[#7162E8] disabled:opacity-50 transition-colors"
              >
                <Send className="h-3.5 w-3.5" />
                <span>Gửi yêu cầu phân tích</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
