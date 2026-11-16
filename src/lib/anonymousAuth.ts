import type { Session } from '@supabase/supabase-js';
import {
  supabase,
  isSupabaseConfigured,
  isValidUUID,
  generateUUIDv4,
  buildAnonymousSupabaseSession,
  SUPABASE_AUTH_STORAGE_KEY,
} from './supabase';

export interface AnonymousUserSession {
  uid: string;
  token: string;
  provider: 'supabase-anonymous' | 'cloudsql-anonymous';
  createdAt: string;
  isAnonymous: boolean;
  role: 'user';
  canAccessAdmin: false;
  canAccessTeacher: false;
  session: Session;
}

const LOCAL_SESSION_STORAGE_KEY = 'literature_studio_anon_session_v2';
const SUPABASE_TIMEOUT_MS = 8000;

/**
 * Bọc lời gọi bất đồng bộ với bộ giới hạn thời gian (timeout)
 * để xử lý trường hợp mất mạng hoặc Supabase không phản hồi.
 */
export async function withNetworkTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number = SUPABASE_TIMEOUT_MS,
  timeoutMessage = 'Dịch vụ Supabase không phản hồi trong thời gian quy định.'
): Promise<T> {
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(new Error(timeoutMessage));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}

function toAnonymousUserSession(
  session: Session,
  provider: 'supabase-anonymous' | 'cloudsql-anonymous'
): AnonymousUserSession {
  // Yêu cầu 5: Lấy UUID của người dùng từ session.user.id
  const userUuid = session.user.id;
  return {
    uid: userUuid,
    token: session.access_token || `anon_tok_${userUuid}`,
    provider,
    createdAt: session.user.created_at || new Date().toISOString(),
    isAnonymous: true,
    // Yêu cầu 9: Không cấp quyền Admin hoặc Teacher cho tài khoản ẩn danh
    role: 'user',
    canAccessAdmin: false,
    canAccessTeacher: false,
    session,
  };
}

export function loadCachedSession(): AnonymousUserSession | null {
  try {
    const raw = localStorage.getItem(LOCAL_SESSION_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.uid && isValidUUID(parsed.uid)) {
        const reconstructed = buildAnonymousSupabaseSession(
          parsed.uid,
          parsed.createdAt,
          parsed.token
        );
        return toAnonymousUserSession(
          reconstructed,
          parsed.provider === 'supabase-anonymous' ? 'supabase-anonymous' : 'cloudsql-anonymous'
        );
      }
    }

    const supaRaw = localStorage.getItem(SUPABASE_AUTH_STORAGE_KEY);
    if (supaRaw) {
      const parsedSupa = JSON.parse(supaRaw);
      const userId = parsedSupa?.user?.id || parsedSupa?.currentSession?.user?.id;
      if (userId && isValidUUID(userId)) {
        const reconstructed = buildAnonymousSupabaseSession(
          userId,
          parsedSupa?.user?.created_at,
          parsedSupa?.access_token
        );
        return toAnonymousUserSession(
          reconstructed,
          isSupabaseConfigured ? 'supabase-anonymous' : 'cloudsql-anonymous'
        );
      }
    }
  } catch {
    // Bỏ qua lỗi đọc JSON trong localStorage
  }
  return null;
}

function saveCachedSession(anonSession: AnonymousUserSession): void {
  try {
    localStorage.setItem(
      LOCAL_SESSION_STORAGE_KEY,
      JSON.stringify({
        uid: anonSession.uid,
        token: anonSession.token,
        provider: anonSession.provider,
        createdAt: anonSession.createdAt,
        isAnonymous: true,
        role: 'user',
      })
    );
  } catch {
    // Bỏ qua lỗi bộ nhớ đầy
  }
}

/**
 * Tự động khởi tạo hoặc khôi phục phiên đăng nhập ẩn danh qua Supabase Auth:
 * 1. Gọi `supabase.auth.getSession()` để kiểm tra phiên hợp lệ hiện có.
 * 2. Nếu đã có phiên hợp lệ, giữ nguyên phiên hiện tại (không tạo tài khoản mới khi tải lại trang).
 * 3. Nếu chưa có phiên, tự động gọi `supabase.auth.signInAnonymously()`.
 * 4. Lấy UUID người dùng trực tiếp từ `session.user.id`.
 * 5. Đồng bộ hồ sơ người dùng ẩn danh với máy chủ để lưu trữ dữ liệu theo UUID.
 */
export async function ensureAnonymousSession(options?: {
  throwOnNetworkError?: boolean;
}): Promise<AnonymousUserSession> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    const cachedOffline = loadCachedSession();
    if (options?.throwOnNetworkError) {
      throw new Error('Thiết bị đang mất kết nối mạng. Không thể liên lạc với máy chủ Supabase.');
    }
    if (cachedOffline) return cachedOffline;
  }

  try {
    // Bước 1: Kiểm tra phiên đăng nhập hợp lệ hiện có trong Supabase Auth
    const { data: sessionData, error: sessionError } = await withNetworkTimeout(
      supabase.auth.getSession(),
      SUPABASE_TIMEOUT_MS,
      'Quá thời gian chờ khi kiểm tra phiên đăng nhập Supabase.'
    );

    if (sessionError) {
      throw sessionError;
    }

    if (sessionData?.session?.user?.id) {
      const existingSession = sessionData.session;
      const activeAnon = toAnonymousUserSession(
        existingSession,
        isSupabaseConfigured ? 'supabase-anonymous' : 'cloudsql-anonymous'
      );
      saveCachedSession(activeAnon);
      // Đồng bộ ngầm với backend để đảm bảo UUID tồn tại trong hồ sơ
      syncUuidWithBackend(existingSession.user.id, existingSession.access_token).catch(() => {});
      return activeAnon;
    }

    // Bước 2: Lần đầu mở website -> tự động gọi supabase.auth.signInAnonymously()
    const { data: signInData, error: signInError } = await withNetworkTimeout(
      supabase.auth.signInAnonymously(),
      SUPABASE_TIMEOUT_MS,
      'Supabase không phản hồi khi khởi tạo tài khoản ẩn danh.'
    );

    if (signInError) {
      throw signInError;
    }

    if (signInData?.session?.user?.id) {
      const createdSession = signInData.session;
      const createdAnon = toAnonymousUserSession(
        createdSession,
        isSupabaseConfigured ? 'supabase-anonymous' : 'cloudsql-anonymous'
      );
      saveCachedSession(createdAnon);
      syncUuidWithBackend(createdSession.user.id, createdSession.access_token).catch(() => {});
      return createdAnon;
    }

    throw new Error('Không nhận được session.user.id hợp lệ từ Supabase Auth.');
  } catch (err) {
    if (options?.throwOnNetworkError) {
      throw err instanceof Error
        ? err
        : new Error('Lỗi kết nối tới dịch vụ xác thực Supabase.');
    }

    // Dự phòng an toàn khi mạng lỗi hoặc Supabase không phản hồi:
    // ưu tiên giữ nguyên phiên đã lưu trong trình duyệt để không mất dữ liệu
    const cached = loadCachedSession();
    if (cached) {
      return cached;
    }

    const fallbackUuid = generateUUIDv4();
    const fallbackSupaSession = buildAnonymousSupabaseSession(fallbackUuid);
    const fallbackAnon = toAnonymousUserSession(fallbackSupaSession, 'cloudsql-anonymous');
    saveCachedSession(fallbackAnon);
    return fallbackAnon;
  }
}

async function syncUuidWithBackend(uuid: string, token: string): Promise<void> {
  try {
    await fetch('/api/auth/anonymous', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        existingUid: uuid,
        existingToken: token,
      }),
    });
  } catch {
    // Bỏ qua lỗi mạng nền
  }
}

export function getActiveAnonymousSession(): AnonymousUserSession | null {
  return loadCachedSession();
}
