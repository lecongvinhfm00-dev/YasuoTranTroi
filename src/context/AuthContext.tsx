import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import {
  supabase,
  isSupabaseConfigured,
  isValidUUID,
  sanitizeAnonymousRole,
  encodeMultiDeviceSyncKey,
} from '../lib/supabase';
import {
  applyLinkedDeviceSession,
  ensureAnonymousSession,
  loadCachedSession,
  withNetworkTimeout,
} from '../lib/anonymousAuth';
import {
  claimMultiDevicePairingCode,
  createMultiDevicePairingCode,
  type UserWorkspaceBundle,
} from '../lib/userData';
import { setMemoryAuthToken } from '../services/apiClient';

export type AuthConnectionStatus = 'initializing' | 'authenticated' | 'error';

export interface AuthContextValue {
  status: AuthConnectionStatus;
  session: Session | null;
  user: User | null;
  userId: string | null;
  displayName: string;
  isAnonymous: boolean;
  role: 'user';
  canAccessAdmin: false;
  canAccessTeacher: false;
  error: string | null;
  isSupabaseConfigured: boolean;
  multiDeviceSyncKey: string;
  retryAuth: () => Promise<void>;
  triggerConnectionErrorTest: () => void;
  generateDevicePairingCode: () => Promise<{
    ok: boolean;
    code?: string;
    expiresAt?: string;
    error?: string;
  }>;
  linkWithDeviceCode: (
    codeOrKey: string
  ) => Promise<{
    ok: boolean;
    newUserId?: string;
    workspace?: Partial<UserWorkspaceBundle> | null;
    error?: string;
  }>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function syncSupabaseUserProfile(session: Session): Promise<void> {
  if (!isSupabaseConfigured || !session?.user?.id) return;
  const userUuid = session.user.id;
  const displayName =
    (session.user.user_metadata?.display_name as string | undefined) ||
    `Độc giả #${userUuid.slice(-6).toUpperCase()}`;

  try {
    await withNetworkTimeout(
      Promise.resolve(
        supabase.from('profiles').upsert(
          {
            id: userUuid,
            display_name: displayName,
            avatar_url: null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'id', ignoreDuplicates: false }
        )
      ),
      5000,
      'Quá thời gian đồng bộ bảng profiles'
    );
  } catch {
    // Bỏ qua nếu bảng profiles chưa khởi tạo
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [status, setStatus] = useState<AuthConnectionStatus>('initializing');
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const applyAuthenticatedSession = useCallback((activeSession: Session) => {
    const uuid = activeSession.user.id;
    setSession(activeSession);
    setUser(activeSession.user);
    setUserId(uuid);
    setMemoryAuthToken(activeSession.access_token || `anon_tok_${uuid}`);
    setError(null);
    setStatus('authenticated');
  }, []);

  const initializeAnonymousAuth = useCallback(
    async (strictNetworkCheck = false) => {
      setStatus('initializing');
      setError(null);

      try {
        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
          throw new Error(
            'Mất kết nối mạng Internet. Đang sử dụng hàng đợi ngoại tuyến và sẽ tự động đồng bộ lại khi có mạng.'
          );
        }

        const { data: currentSessionData, error: getSessionError } = await withNetworkTimeout(
          supabase.auth.getSession(),
          8000,
          'Máy chủ Supabase không phản hồi khi kiểm tra phiên đăng nhập.'
        );

        if (getSessionError) {
          throw getSessionError;
        }

        if (currentSessionData?.session?.user?.id) {
          applyAuthenticatedSession(currentSessionData.session);
          syncSupabaseUserProfile(currentSessionData.session).catch(() => {});
          return;
        }

        const { data: signInData, error: signInError } = await withNetworkTimeout(
          supabase.auth.signInAnonymously(),
          8000,
          'Máy chủ Supabase không phản hồi khi khởi tạo tài khoản ẩn danh.'
        );

        if (signInError) {
          throw signInError;
        }

        if (signInData?.session?.user?.id) {
          applyAuthenticatedSession(signInData.session);
          syncSupabaseUserProfile(signInData.session).catch(() => {});
          return;
        }

        const anonResult = await ensureAnonymousSession({
          throwOnNetworkError: strictNetworkCheck,
        });
        applyAuthenticatedSession(anonResult.session);
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : 'Không thể kết nối tới dịch vụ Supabase Anonymous Auth.';

        const cached = loadCachedSession();
        if (cached?.session?.user?.id && isValidUUID(cached.session.user.id)) {
          setSession(cached.session);
          setUser(cached.session.user);
          setUserId(cached.session.user.id);
          setMemoryAuthToken(cached.token);
        }

        setError(message);
        setStatus('error');
      }
    },
    [applyAuthenticatedSession]
  );

  useEffect(() => {
    let mounted = true;

    initializeAnonymousAuth(false);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;
      if (nextSession?.user?.id) {
        applyAuthenticatedSession(nextSession);
      }
    });

    const handleOnline = () => {
      if (mounted) {
        initializeAnonymousAuth(false);
      }
    };
    const handleOffline = () => {
      if (mounted) {
        setError('Thiết bị vừa mất kết nối mạng. Dữ liệu thay đổi sẽ được lưu chờ đồng bộ lại.');
        setStatus('error');
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
    }

    return () => {
      mounted = false;
      subscription.unsubscribe();
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      }
    };
  }, [applyAuthenticatedSession, initializeAnonymousAuth]);

  const retryAuth = useCallback(async () => {
    await initializeAnonymousAuth(true);
  }, [initializeAnonymousAuth]);

  const triggerConnectionErrorTest = useCallback(() => {
    setError(
      'Không thể phản hồi từ máy chủ Supabase Auth (Kiểm tra trạng thái lỗi kết nối). Nhấn "Thử kết nối lại" để khôi phục phiên.'
    );
    setStatus('error');
  }, []);

  const generateDevicePairingCode = useCallback(async () => {
    let activeUserId = userId;
    let activeSession = session;
    if (!activeUserId || !activeSession) {
      try {
        const result = await ensureAnonymousSession();
        applyAuthenticatedSession(result.session);
        activeUserId = result.uid;
        activeSession = result.session;
      } catch (err: any) {
        return { ok: false, error: err?.message || 'Phiên đăng nhập chưa sẵn sàng.' };
      }
    }
    return createMultiDevicePairingCode(activeUserId, activeSession.access_token, activeSession);
  }, [userId, session, applyAuthenticatedSession]);

  const linkWithDeviceCode = useCallback(
    async (codeOrKey: string) => {
      const claimResult = await claimMultiDevicePairingCode(codeOrKey);
      if (!claimResult.ok || !claimResult.session) {
        return {
          ok: false,
          error: claimResult.error || 'Không thể liên kết thiết bị.',
        };
      }

      const applied = await applyLinkedDeviceSession(claimResult.session);
      applyAuthenticatedSession(applied.session);
      syncSupabaseUserProfile(applied.session).catch(() => {});

      return {
        ok: true,
        newUserId: applied.uid,
        workspace: claimResult.workspace || null,
      };
    },
    [applyAuthenticatedSession]
  );

  const safeRole = sanitizeAnonymousRole(user?.role);
  const displayName = userId
    ? `Độc giả #${userId.slice(-6).toUpperCase()}`
    : 'Độc giả Ẩn danh';
  const multiDeviceSyncKey = session ? encodeMultiDeviceSyncKey(session) : '';

  const value: AuthContextValue = {
    status,
    session,
    user,
    userId,
    displayName,
    isAnonymous: true,
    role: safeRole,
    canAccessAdmin: false,
    canAccessTeacher: false,
    error,
    isSupabaseConfigured,
    multiDeviceSyncKey,
    retryAuth,
    triggerConnectionErrorTest,
    generateDevicePairingCode,
    linkWithDeviceCode,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth phải được sử dụng bên trong <AuthProvider>.');
  }
  return context;
}
