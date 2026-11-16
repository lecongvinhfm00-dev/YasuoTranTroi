import type { AIModeId, ConversationItem } from '../types/studio.ts';

let currentBearerToken: string | null = null;
const sessionGuestId = `studio_${Math.random().toString(36).slice(2, 10)}`;

export function setMemoryAuthToken(token: string | null) {
  currentBearerToken = token;
}

function buildHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Studio-Guest-Id': sessionGuestId,
  };
  if (currentBearerToken) {
    headers['Authorization'] = `Bearer ${currentBearerToken}`;
  }
  return headers;
}

export interface HealthStatusResponse {
  status: 'healthy' | 'degraded';
  timestamp: string;
  services: {
    backend: boolean;
    geminiConfigured: boolean;
    defaultModel: string;
    availableModels: string[];
    databaseConnected: boolean;
    authConfigured: boolean;
  };
}

export interface UsageQuotaResponse {
  user: {
    uid: string;
    username: string;
    email: string;
    role: 'guest' | 'user' | 'admin';
    isAuthenticated: boolean;
  };
  date: string;
  studioQuota: {
    used: number;
    limit: number;
    remaining: number;
    allowed: boolean;
    usagePercent: number;
    isExhausted: boolean;
  };
  quotaNotice: string;
}

export const studioApiClient = {
  async checkHealth(): Promise<HealthStatusResponse> {
    const res = await fetch('/api/health', { headers: buildHeaders() });
    if (!res.ok) {
      throw new Error('Không thể kiểm tra trạng thái kết nối máy chủ.');
    }
    return res.json();
  },

  async fetchUsage(): Promise<UsageQuotaResponse> {
    const res = await fetch('/api/usage', { headers: buildHeaders() });
    if (!res.ok) {
      throw new Error('Không thể tải thông tin hạn mức sử dụng.');
    }
    return res.json();
  },

  async fetchConversations(): Promise<ConversationItem[]> {
    const res = await fetch('/api/conversations', { headers: buildHeaders() });
    if (!res.ok) {
      throw new Error('Không thể tải lịch sử hội thoại.');
    }
    const data = await res.json();
    return data.conversations || [];
  },

  async deleteConversation(id?: number | string): Promise<void> {
    const url = id ? `/api/conversations?id=${encodeURIComponent(String(id))}` : '/api/conversations';
    const res = await fetch(url, {
      method: 'DELETE',
      headers: buildHeaders(),
    });
    if (!res.ok) {
      throw new Error('Không thể xóa hội thoại.');
    }
  },

  async askLiteratureAI(
    params: {
      prompt: string;
      documentContext?: string;
      mode: AIModeId;
      model: string;
      responseLength: 'concise' | 'balanced' | 'deep';
      history?: { role: string; content: string }[];
      conversationId?: number | string;
      saveHistory?: boolean;
    },
    signal?: AbortSignal
  ): Promise<{
    reply: string;
    model: string;
    mode: AIModeId;
    conversationId?: number;
    studioQuota: UsageQuotaResponse['studioQuota'];
  }> {
    const res = await fetch('/api/ai', {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify(params),
      signal,
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Yêu cầu AI không thành công.');
    }
    return data;
  },

  async saveCloudSettings(payload: {
    theme: string;
    language: string;
    playerSettings: unknown;
    aiSettings: unknown;
  }) {
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify(payload),
    });
    return res.json();
  },
};
