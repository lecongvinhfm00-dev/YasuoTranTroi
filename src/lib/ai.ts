import type { AIMode } from '../types/studio';

export interface AskLiteratureAIParams {
  token: string;
  conversationId?: string | null;
  title?: string;
  mode: AIMode;
  prompt: string;
  documentContext?: string;
}

export interface AskLiteratureAIResponse {
  conversationId: string;
  reply: string;
  tokensUsed: number;
  dailyUsage: {
    requestsCount: number;
    tokensCount: number;
    limit: number;
  };
}

/**
 * Gửi yêu cầu phân tích văn học tới Backend API (/api/ai).
 * Không bao giờ gọi trực tiếp Gemini API từ trình duyệt hoặc để lộ GEMINI_API_KEY ở frontend.
 */
export async function askLiteratureAI(params: AskLiteratureAIParams): Promise<AskLiteratureAIResponse> {
  const response = await fetch('/api/ai', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${params.token}`,
    },
    body: JSON.stringify({
      conversationId: params.conversationId || undefined,
      title: params.title,
      mode: params.mode,
      prompt: params.prompt,
      documentContext: params.documentContext || '',
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Không thể kết nối với dịch vụ Trợ lý Văn học AI lúc này.');
  }

  return data as AskLiteratureAIResponse;
}
