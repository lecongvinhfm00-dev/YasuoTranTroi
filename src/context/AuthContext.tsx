import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import {
  supabase,
  isSupabaseConfigured,
  isValidUUID,
  sanitizeAnonymousRole,
} from '../lib/supabase';
import {
  ensureAnonymousSession,
  loadCachedSession,
  withNetworkTimeout,
} from '../lib/anonymousAuth';
import { setMemoryAuthToken } from '../services/apiClient';

export type AuthConnectionStatus = 'initializing' | 'authenticated' | 'error';

export interface AuthContextValue {
  /** Trạng thái kết nối xác thực: đang khởi tạo | đã đăng nhập | lỗi kết nối */
  status: AuthConnectionStatus;
  /** Phiên Supabase Auth hiện tại */
  session: Session | null;
  /** Đối tượng người dùng Supabase Auth */
  user: User | null;
  /** UUID của người dùng lấy trực tiếp từ session.user.id */
  userId: string | null;
  /** Tên hiển thị mặc định của độc giả ẩn danh */
  displayName: string;
  /** Tài khoản ẩn danh luôn có isAnonymous = true */
  isAnonymous: boolean;
  /** Vai trò bảo mật: luôn khóa ở 'user', không bao giờ cấp quyền 'admin' hoặc 'teacher' cho tài khoản ẩn danh */
  role: 'user';
  canAccessAdmin: false;
  canAccessTeacher: false;
  /** Thông báo lỗi khi mất mạng hoặc Supabase không phản hồi */
  error: string | null;
  /** Cho biết biến môi trường Supabase đã được cấu hình trực tiếp hay đang dùng cơ chế dự phòng */
  isSupabaseConfigured: boolean;
  /** Thử kết nối và khởi tạo lại phiên đăng nhập ẩn danh */
  retryAuth: () => Promise<void>;
  /** Cho phép kiểm tra trạng thái lỗi kết nối mạng và khôi phục */
  triggerConnectionErrorTest: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/**
 * Đồng bộ hồ sơ người dùng ẩn danh vào bảng `public.profiles` trên Supabase.
 * Tuyệt đối không gửi hoặc nâng quyền `role` thành `admin` hoặc `teacher`.
 */
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
    // Không chặn luồng đăng nhập nếu bảng profiles chưa chạy migration
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [status, setStatus] = useState<AuthConnectionStatus>('initializing');
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const applyAuthenticatedSession = useCallback((activeSession: Session) => {
    // Yêu cầu 5: Lấy UUID của người dùng từ session.user.id
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
        // Kiểm tra kết nối mạng trình duyệt
        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
          throw new Error(
            'Mất kết nối mạng Internet. Không thể kết nối tới máy chủ xác thực Supabase.'
          );
        }

        // Bước 1: Kiểm tra phiên đăng nhập hợp lệ hiện có (Yêu cầu 2 & 3: giữ nguyên phiên hiện tại, không tạo mới khi tải lại trang)
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

        // Bước 2: Khi người dùng lần đầu mở website, tự động gọi supabase.auth.signInAnonymously() (Yêu cầu 1)
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

        // Dự phòng qua ensureAnonymousSession nếu cần
        const anonResult = await ensureAnonymousSession({
          throwOnNetworkError: strictNetworkCheck,
        });
        applyAuthenticatedSession(anonResult.session);
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : 'Không thể kết nối tới dịch vụ Supabase Anonymous Auth.';

        // Giữ phiên đã lưu trong bộ nhớ cục bộ (nếu có) để không làm mất giao diện hoặc chức năng hiện tại (Yêu cầu 10 & 11)
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

    // Yêu cầu 4: Duy trì phiên đăng nhập bằng Supabase Auth (onAuthStateChange)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;
      if (nextSession?.user?.id) {
        applyAuthenticatedSession(nextSession);
      }
    });

    // Lắng nghe sự kiện mạng khôi phục hoặc mất kết nối
    const handleOnline = () => {
      if (mounted && status === 'error') {
        initializeAnonymousAuth(false);
      }
    };
    const handleOffline = () => {
      if (mounted) {
        setError('Thiết bị vừa mất kết nối mạng. Đang duy trì chế độ ngoại tuyến tạm thời.');
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

  // Yêu cầu 9: Không cấp quyền Admin hoặc Teacher cho tài khoản ẩn danh
  const safeRole = sanitizeAnonymousRole(user?.role);
  const displayName = userId
    ? `Độc giả #${userId.slice(-6).toUpperCase()}`
    : 'Độc giả Ẩn danh';

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
    retryAuth,
    triggerConnectionErrorTest,
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
