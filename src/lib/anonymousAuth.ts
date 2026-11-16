import type { Session } from '@supabase/supabase-js';
import {
  supabase,
  isValidUUID,
  generateUUIDv4,
  buildAnonymousSupabaseSession,
  savePersistedFallbackSession,
  SUPABASE_AUTH_STORAGE_KEY,
} from './supabase';

export interface AnonymousUserSession {
  uid: string;
  token: string;
  provider: 'supabase-anonymous';
  createdAt: string;
  isAnonymous: boolean;
  role: 'user';
  canAccessAdmin: false;
  canAccessTeacher: false;
  session: Session;
}

const LOCAL_SESSION_STORAGE_KEY = 'literature_studio_anon_session_v2';
const SUPABASE_TIMEOUT_MS = 8000;

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

function toAnonymousUserSession(session: Session): AnonymousUserSession {
  const userUuid = session.user.id;
  return {
    uid: userUuid,
    token: session.access_token || `anon_tok_${userUuid}`,
    provider: 'supabase-anonymous',
    createdAt: session.user.created_at || new Date().toISOString(),
    isAnonymous: true,
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
        return toAnonymousUserSession(reconstructed);
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
        return toAnonymousUserSession(reconstructed);
      }
    }
  } catch {
    // Bỏ qua lỗi đọc JSON trong localStorage
  }
  return null;
}

export function saveCachedSession(anonSession: AnonymousUserSession): void {
  try {
    localStorage.setItem(
      LOCAL_SESSION_STORAGE_KEY,
      JSON.stringify({
        uid: anonSession.uid,
        token: anonSession.token,
        provider: 'supabase-anonymous',
        createdAt: anonSession.createdAt,
        isAnonymous: true,
        role: 'user',
      })
    );
    savePersistedFallbackSession(anonSession.session);
  } catch {
    // Bỏ qua lỗi bộ nhớ đầy
  }
}

/**
 * Chuyển đổi phiên hiện tại trên thiết bị này sang phiên của cùng một người dùng từ thiết bị khác
 * (thông qua Mã Ghép Nối Đa Thiết Bị hoặc Khóa Phiên Đa Thiết Bị).
 */
export async function applyLinkedDeviceSession(targetSession: Session): Promise<AnonymousUserSession> {
  const anon = toAnonymousUserSession(targetSession);
  saveCachedSession(anon);
  try {
    await supabase.auth.setSession({
      access_token: targetSession.access_token,
      refresh_token: targetSession.refresh_token || `refresh_${targetSession.user.id}`,
    });
  } catch {
    // Đã lưu trực tiếp vào storage của Supabase Auth
  }
  return anon;
}

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
    const { data: sessionData, error: sessionError } = await withNetworkTimeout(
      supabase.auth.getSession(),
      SUPABASE_TIMEOUT_MS,
      'Quá thời gian chờ khi kiểm tra phiên đăng nhập Supabase.'
    );

    if (sessionError) {
      throw sessionError;
    }

    if (sessionData?.session?.user?.id) {
      const existingAnon = toAnonymousUserSession(sessionData.session);
      saveCachedSession(existingAnon);
      return existingAnon;
    }

    const { data: signInData, error: signInError } = await withNetworkTimeout(
      supabase.auth.signInAnonymously(),
      SUPABASE_TIMEOUT_MS,
      'Supabase không phản hồi khi khởi tạo tài khoản ẩn danh.'
    );

    if (signInError) {
      throw signInError;
    }

    if (signInData?.session?.user?.id) {
      const createdAnon = toAnonymousUserSession(signInData.session);
      saveCachedSession(createdAnon);
      return createdAnon;
    }

    throw new Error('Không nhận được session.user.id hợp lệ từ Supabase Auth.');
  } catch (err) {
    if (options?.throwOnNetworkError) {
      throw err instanceof Error
        ? err
        : new Error('Lỗi kết nối tới dịch vụ xác thực Supabase.');
    }

    const cached = loadCachedSession();
    if (cached) {
      return cached;
    }

    const fallbackUuid = generateUUIDv4();
    const fallbackSupaSession = buildAnonymousSupabaseSession(fallbackUuid);
    const fallbackAnon = toAnonymousUserSession(fallbackSupaSession);
    saveCachedSession(fallbackAnon);
    return fallbackAnon;
  }
}

export function getActiveAnonymousSession(): AnonymousUserSession | null {
  return loadCachedSession();
}
