import React from 'react';
import {
  History,
  BookOpen,
  Sparkles,
  Play,
  Trash2,
  Clock,
  ArrowRight,
} from 'lucide-react';
import type { AudioTrack, ConversationItem, ReadingHistoryItem } from '../types/studio';

interface HistoryViewProps {
  readingHistory: ReadingHistoryItem[];
  conversations: ConversationItem[];
  recentTracks: AudioTrack[];
  onContinueReading: (documentId: string, segmentIndex: number) => void;
  onClearReadingHistory: () => void;
  onOpenConversation: (convId: number | string) => void;
  onPlayTrack: (track: AudioTrack) => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  readingHistory,
  conversations,
  recentTracks,
  onContinueReading,
  onClearReadingHistory,
  onOpenConversation,
  onPlayTrack,
}) => {
  return (
    <div data-testid="history-view" className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#171A2B] border border-white/10 rounded-xl p-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#8275F5]/15 border border-[#8275F5]/30 flex items-center justify-center text-[#A78BFA]">
            <History className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-[#F4F4FA]">Lịch sử hoạt động & Tiến độ đọc</h1>
            <p className="text-xs text-[#A0A4B8]">
              Theo dõi vị trí đọc văn bản gần nhất, lịch sử phân tích cùng AI và các bản nhạc đã thưởng thức.
            </p>
          </div>
        </div>

        {readingHistory.length > 0 && (
          <button
            type="button"
            onClick={onClearReadingHistory}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#20243A] hover:bg-[#F16C78]/20 text-xs text-[#F16C78] border border-white/10 transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Xóa lịch sử đọc
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Cột 1: Lịch sử đọc văn bản & Tiếp tục đọc */}
        <div className="lg:col-span-7 bg-[#171A2B] border border-white/10 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#F4F4FA] flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-[#E9C878]" />
              Tiến độ đọc văn bản gần đây
            </h2>
            <span className="text-xs text-[#A0A4B8]">{readingHistory.length} tác phẩm</span>
          </div>

          {readingHistory.length === 0 ? (
            <div className="p-6 text-center text-xs text-[#A0A4B8] bg-[#101321]/60 rounded-xl border border-white/5">
              Chưa có lịch sử đọc văn bản. Hãy mở mục Trình đọc văn bản để bắt đầu nghe hoặc đọc tác phẩm.
            </div>
          ) : (
            <div className="space-y-3">
              {readingHistory.map((item) => (
                <div
                  key={item.id}
                  className="bg-[#101321] border border-white/10 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-[#F4F4FA]">
                        {item.documentTitle}
                      </h3>
                      <span className="text-[11px] text-[#E9C878] bg-[#E9C878]/10 px-2 py-0.5 rounded">
                        Đoạn {item.segmentIndex + 1}/{Math.max(1, item.totalSegments)}
                      </span>
                    </div>
                    <p className="text-xs text-[#A0A4B8]">
                      Tác giả: {item.author} • Mở lần cuối:{' '}
                      {new Date(item.updatedAt).toLocaleString('vi-VN')}
                    </p>
                    <div className="w-full bg-[#20243A] h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-[#36C98F] h-full rounded-full transition-all"
                        style={{ width: `${Math.min(100, Math.max(5, item.progressPercent))}%` }}
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onContinueReading(item.documentId, item.segmentIndex)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#8275F5] hover:bg-[#8275F5]/90 text-white text-xs font-semibold shrink-0 transition-colors cursor-pointer"
                  >
                    Tiếp tục đọc
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Cột 2: Lịch sử hỏi đáp AI & Âm nhạc */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-[#171A2B] border border-white/10 rounded-xl p-5 space-y-3">
            <h2 className="text-sm font-semibold text-[#F4F4FA] flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#A78BFA]" />
              Phiên phân tích AI gần đây ({conversations.length})
            </h2>

            {conversations.length === 0 ? (
              <p className="text-xs text-[#A0A4B8] py-4 text-center">
                Chưa có cuộc hội thoại AI nào được lưu.
              </p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {conversations.slice(0, 8).map((conv) => (
                  <button
                    key={conv.id}
                    type="button"
                    onClick={() => onOpenConversation(conv.id)}
                    className="w-full text-left p-3 rounded-lg bg-[#101321] hover:bg-[#20243A] border border-white/5 transition-colors flex items-center justify-between gap-2 cursor-pointer"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-[#F4F4FA] truncate">{conv.title}</p>
                      <p className="text-[11px] text-[#A0A4B8] flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3" />
                        {new Date(conv.updatedAt).toLocaleString('vi-VN')}
                      </p>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-[#A78BFA] shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="bg-[#171A2B] border border-white/10 rounded-xl p-5 space-y-3">
            <h2 className="text-sm font-semibold text-[#F4F4FA] flex items-center gap-2">
              <Play className="w-4 h-4 text-[#36C98F]" />
              Nhạc nền học tập sẵn sàng ({recentTracks.length})
            </h2>
            <div className="space-y-2">
              {recentTracks.slice(0, 4).map((track) => (
                <div
                  key={track.id}
                  className="p-2.5 rounded-lg bg-[#101321] border border-white/5 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-[#F4F4FA] truncate">{track.title}</p>
                    <p className="text-[11px] text-[#A0A4B8] truncate">{track.artist}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onPlayTrack(track)}
                    className="px-2.5 py-1 rounded bg-[#20243A] hover:bg-[#8275F5] text-[11px] text-white transition-colors cursor-pointer"
                  >
                    Phát
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
