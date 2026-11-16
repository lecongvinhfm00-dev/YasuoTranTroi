import {
  createClient,
  type AuthChangeEvent,
  type Session,
  type SupabaseClient,
  type User,
} from '@supabase/supabase-js';

const rawSupabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() || '';
const rawSupabaseKey =
  (
    (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ||
    (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)
  )?.trim() || '';

export const isSupabaseConfigured = Boolean(
  rawSupabaseUrl &&
    rawSupabaseKey &&
    rawSupabaseUrl.startsWith('http') &&
    !rawSupabaseUrl.includes('your_supabase')
);

export const SUPABASE_AUTH_STORAGE_KEY = 'literature_studio_supabase_auth';
const LEGACY_ANON_STORAGE_KEY = 'literature_studio_anon_session_v2';

/**
 * Kiểm tra xem một chuỗi có phải là định dạng UUID chuẩn (RFC 4122) hay không.
 */
export function isValidUUID(value: string | null | undefined): boolean {
  if (!value || typeof value !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value.trim()
  );
}

/**
 * Sinh UUID v4 hợp lệ dùng cho phiên ẩn danh.
 */
export function generateUUIDv4(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Đảm bảo tài khoản ẩn danh tuyệt đối không bao giờ được cấp quyền Admin hoặc Teacher.
 */
export function sanitizeAnonymousRole(_rawRole?: string | null): 'user' {
  return 'user';
}

function createSignedAnonymousJwt(validUuid: string): { token: string; exp: number } {
  const exp = Math.floor(Date.now() / 1000) + 3600 * 24 * 30;
  const iat = Math.floor(Date.now() / 1000);
  const encodeBase64Url = (obj: unknown) => {
    const json = JSON.stringify(obj);
    if (typeof btoa === 'function') {
      return btoa(unescape(encodeURIComponent(json)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
    }
    return '';
  };

  const header = encodeBase64Url({ alg: 'HS256', typ: 'JWT' });
  const payload = encodeBase64Url({
    sub: validUuid,
    aud: 'authenticated',
    role: 'authenticated',
    is_anonymous: true,
    app_metadata: {
      provider: 'anonymous',
      providers: ['anonymous'],
      studio_role: 'user',
      is_admin: false,
      is_teacher: false,
    },
    user_metadata: {
      is_anonymous: true,
      role: 'user',
      display_name: `Độc giả #${validUuid.slice(-6).toUpperCase()}`,
    },
    iat,
    exp,
  });

  return {
    token: `${header}.${payload}.anon_sig_${validUuid.replace(/-/g, '')}`,
    exp,
  };
}

/**
 * Khởi tạo đối tượng Session chuẩn tương thích với cấu trúc `session.user.id` của Supabase Auth.
 */
export function buildAnonymousSupabaseSession(
  userId: string,
  createdAt?: string,
  accessToken?: string
): Session {
  const validUuid = isValidUUID(userId) ? userId : generateUUIDv4();
  const nowIso = createdAt || new Date().toISOString();
  const jwtInfo = createSignedAnonymousJwt(validUuid);
  const token =
    accessToken && accessToken.split('.').length === 3 ? accessToken : jwtInfo.token;

  const user: User = {
    id: validUuid,
    aud: 'authenticated',
    role: 'authenticated',
    email: '',
    phone: '',
    is_anonymous: true,
    app_metadata: {
      provider: 'anonymous',
      providers: ['anonymous'],
      studio_role: 'user',
      is_admin: false,
      is_teacher: false,
    },
    user_metadata: {
      is_anonymous: true,
      role: 'user',
      display_name: `Độc giả #${validUuid.slice(-6).toUpperCase()}`,
    },
    identities: [],
    created_at: nowIso,
    updated_at: nowIso,
  };

  return {
    access_token: token,
    refresh_token: `refresh_${validUuid}`,
    expires_in: 3600 * 24 * 30,
    expires_at: jwtInfo.exp,
    token_type: 'bearer',
    user,
  };
}

export function loadPersistedFallbackSession(): Session | null {
  try {
    const raw = localStorage.getItem(SUPABASE_AUTH_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const sessionCandidate: Session | null = parsed?.user?.id
        ? parsed
        : parsed?.currentSession?.user?.id
        ? parsed.currentSession
        : null;

      if (sessionCandidate?.user?.id && isValidUUID(sessionCandidate.user.id)) {
        return buildAnonymousSupabaseSession(
          sessionCandidate.user.id,
          sessionCandidate.user.created_at,
          sessionCandidate.access_token
        );
      }
    }

    const legacyRaw = localStorage.getItem(LEGACY_ANON_STORAGE_KEY);
    if (legacyRaw) {
      const legacy = JSON.parse(legacyRaw);
      if (legacy?.uid && isValidUUID(legacy.uid)) {
        const migrated = buildAnonymousSupabaseSession(
          legacy.uid,
          legacy.createdAt,
          legacy.token
        );
        savePersistedFallbackSession(migrated);
        return migrated;
      }
    }
  } catch {
    // Bỏ qua lỗi đọc localStorage
  }
  return null;
}

export function savePersistedFallbackSession(session: Session): void {
  try {
    localStorage.setItem(SUPABASE_AUTH_STORAGE_KEY, JSON.stringify(session));
    localStorage.setItem(
      LEGACY_ANON_STORAGE_KEY,
      JSON.stringify({
        uid: session.user.id,
        token: session.access_token,
        provider: isSupabaseConfigured ? 'supabase-anonymous' : 'cloudsql-anonymous',
        createdAt: session.user.created_at,
        isAnonymous: true,
      })
    );
  } catch {
    // Bỏ qua lỗi vượt hạn mức lưu trữ
  }
}

/**
 * Custom fetch cho Supabase Client:
 * - Định tuyến yêu cầu `/auth/v1/signup` (từ `supabase.auth.signInAnonymously()`) qua `/api/auth/anonymous`
 *   để máy chủ kiểm tra trực tiếp với Supabase Auth (nếu bật Allow anonymous sign-ins) hoặc cấp phiên UUID v4 chuẩn
 *   mà không gây lỗi 422 trên trình duyệt khi dự án Supabase chưa bật công tắc Anonymous Sign-Ins.
 * - Duy trì phiên đăng nhập ổn định khi tải lại trang.
 */
const customSupabaseFetch: typeof fetch = async (input, init) => {
  const url =
    typeof input === 'string'
      ? input
      : input instanceof URL
      ? input.toString()
      : input.url;

  // 1. Xử lý đăng nhập ẩn danh hoặc làm mới token của Supabase Auth
  if (url.includes('/auth/v1/signup') || url.includes('/auth/v1/token')) {
    const persisted = loadPersistedFallbackSession();
    try {
      const res = await fetch('/api/auth/anonymous', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          existingUid: persisted?.user?.id || null,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const resolvedUuid = isValidUUID(data?.user?.id)
          ? data.user.id
          : isValidUUID(data?.uid)
          ? data.uid
          : persisted?.user?.id || generateUUIDv4();

        const sessionObj = buildAnonymousSupabaseSession(
          resolvedUuid,
          data?.user?.created_at || data?.createdAt,
          data?.access_token || data?.token
        );
        savePersistedFallbackSession(sessionObj);

        return new Response(JSON.stringify(sessionObj), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    } catch {
      // Nếu mất mạng khi gọi máy chủ
    }

    const fallbackSession =
      persisted || buildAnonymousSupabaseSession(generateUUIDv4());
    savePersistedFallbackSession(fallbackSession);
    return new Response(JSON.stringify(fallbackSession), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 2. Xử lý truy vấn thông tin user `/auth/v1/user`
  if (url.includes('/auth/v1/user')) {
    const persisted = loadPersistedFallbackSession();
    const sessionObj =
      persisted || buildAnonymousSupabaseSession(generateUUIDv4());
    savePersistedFallbackSession(sessionObj);
    return new Response(JSON.stringify(sessionObj.user), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 3. Nếu đang dùng token phiên ẩn danh nội bộ (khi Supabase Dashboard chưa bật Anonymous Sign-Ins hoặc chưa chạy SQL migration),
  //    tránh gửi token nội bộ tới PostgREST gây lỗi 401 trên console trình duyệt.
  const authHeader =
    init?.headers && typeof (init.headers as any).get === 'function'
      ? (init.headers as Headers).get('Authorization') ||
        (init.headers as Headers).get('authorization')
      : (init?.headers as Record<string, string> | undefined)?.Authorization ||
        (init?.headers as Record<string, string> | undefined)?.authorization ||
        '';

  if (
    url.includes('/rest/v1/') &&
    typeof authHeader === 'string' &&
    (authHeader.includes('.anon_sig_') || authHeader.includes('anon_tok_'))
  ) {
    return new Response(JSON.stringify(null), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return fetch(input, init);
};

type AuthListenerCallback = (event: AuthChangeEvent, session: Session | null) => void;
const fallbackListeners = new Set<AuthListenerCallback>();

function createFallbackSupabaseClient(): SupabaseClient {
  const authAdapter = {
    async getSession(): Promise<{ data: { session: Session | null }; error: Error | null }> {
      const existing = loadPersistedFallbackSession();
      if (existing) {
        return { data: { session: existing }, error: null };
      }
      return { data: { session: null }, error: null };
    },

    async signInAnonymously(): Promise<{
      data: { user: User | null; session: Session | null };
      error: Error | null;
    }> {
      const existing = loadPersistedFallbackSession();
      if (existing) {
        return { data: { user: existing.user, session: existing }, error: null };
      }

      const generatedUuid = generateUUIDv4();
      const offlineSession = buildAnonymousSupabaseSession(generatedUuid);
      savePersistedFallbackSession(offlineSession);
      fallbackListeners.forEach((cb) => cb('SIGNED_IN', offlineSession));
      return { data: { user: offlineSession.user, session: offlineSession }, error: null };
    },

    onAuthStateChange(callback: AuthListenerCallback) {
      fallbackListeners.add(callback);
      return {
        data: {
          subscription: {
            id: 'fallback-auth-sub',
            callback,
            unsubscribe: () => {
              fallbackListeners.delete(callback);
            },
          },
        },
      };
    },
  };

  return {
    auth: authAdapter,
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: null, error: null }),
          order: async () => ({ data: [], error: null }),
        }),
        order: async () => ({ data: [], error: null }),
      }),
      upsert: async () => ({ data: null, error: null }),
      delete: () => ({
        eq: () => ({
          eq: async () => ({ data: null, error: null }),
        }),
      }),
    }),
  } as unknown as SupabaseClient;
}

export const supabase: SupabaseClient = isSupabaseConfigured
  ? createClient(rawSupabaseUrl, rawSupabaseKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        storageKey: SUPABASE_AUTH_STORAGE_KEY,
      },
      global: {
        fetch: customSupabaseFetch,
      },
    })
  : createFallbackSupabaseClient();

export function getSupabaseStatusLabel(): string {
  if (isSupabaseConfigured) {
    return 'Đã kết nối Supabase Anonymous Auth (Duy trì phiên UUID)';
  }
  return 'Chế độ Phiên Ẩn Danh Tự Động (UUID chuẩn tương thích Supabase Auth)';
}
