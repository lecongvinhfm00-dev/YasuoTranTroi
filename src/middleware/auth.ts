import { Request, Response, NextFunction } from 'express';
import { adminAuth } from '../lib/firebase-admin.ts';
import { getOrCreateProfile } from '../db/repository.ts';

export interface AuthUserContext {
  uid: string;
  email: string;
  username: string;
  avatarUrl?: string;
  role: 'guest' | 'user' | 'admin';
  dailyQuota: number;
  isAuthenticated: boolean;
}

export interface AuthRequest extends Request {
  userContext?: AuthUserContext;
}

/**
 * Authenticates requests via Firebase Bearer ID Token.
 * Also supports scoped Studio Guest Workspace sessions via x-studio-guest-id
 * so unauthenticated users can test the studio within a sandboxed guest quota,
 * while never allowing frontend role escalation.
 */
export const resolveUserSession = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split('Bearer ')[1].trim();
    if (token && token !== 'null' && token !== 'undefined') {
      // 1. Hỗ trợ phiên tài khoản ẩn danh tự động (anon_tok_<uid>)
      if (token.startsWith('anon_tok_')) {
        const rawAnonUid = token
          .slice('anon_tok_'.length)
          .replace(/[^a-zA-Z0-9_-]/g, '')
          .slice(0, 64);
        const uid = rawAnonUid || 'anon_default_user';
        try {
          const profile = await getOrCreateProfile({
            uid,
            email: `${uid}@anonymous.literature.studio`,
            username: `Độc giả #${uid.slice(-6).toUpperCase()}`,
            role: 'user',
          });
          req.userContext = {
            uid: profile.uid,
            email: profile.email,
            username: profile.username,
            role: 'user',
            dailyQuota: profile.dailyQuota,
            isAuthenticated: true,
          };
          return next();
        } catch (err) {
          console.error('Anonymous token profile resolution error:', err);
          req.userContext = {
            uid,
            email: `${uid}@anonymous.literature.studio`,
            username: `Độc giả #${uid.slice(-6).toUpperCase()}`,
            role: 'user',
            dailyQuota: 15,
            isAuthenticated: true,
          };
          return next();
        }
      }

      // 2. Hỗ trợ Firebase ID Token hoặc JWT (Supabase Anonymous JWT)
      try {
        const decoded = await adminAuth.verifyIdToken(token);
        const email = decoded.email || `${decoded.uid}@user.literature.studio`;
        const username = decoded.name || email.split('@')[0] || 'Độc giả Văn học';
        const profile = await getOrCreateProfile({
          uid: decoded.uid,
          email,
          username,
          avatarUrl: decoded.picture || undefined,
        });

        req.userContext = {
          uid: profile.uid,
          email: profile.email,
          username: profile.username,
          avatarUrl: profile.avatarUrl || undefined,
          role: (profile.role as 'guest' | 'user' | 'admin') || 'user',
          dailyQuota: profile.dailyQuota,
          isAuthenticated: true,
        };
        return next();
      } catch {
        // Giải mã payload JWT của Supabase Anonymous Auth (lấy UUID từ payload.sub / session.user.id)
        try {
          const parts = token.split('.');
          if (parts.length === 3) {
            const payloadRaw = Buffer.from(parts[1], 'base64url').toString('utf8');
            const payload = JSON.parse(payloadRaw);
            if (payload && typeof payload.sub === 'string' && payload.sub.length > 5) {
              const supaUuid = payload.sub.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
              const profile = await getOrCreateProfile({
                uid: supaUuid,
                email: `${supaUuid}@supabase.literature.studio`,
                username: `Độc giả #${supaUuid.slice(-6).toUpperCase()}`,
                role: 'user',
              });
              req.userContext = {
                uid: profile.uid,
                email: profile.email,
                username: profile.username,
                // Yêu cầu 9: Không cấp quyền Admin hoặc Teacher cho tài khoản ẩn danh
                role: 'user',
                dailyQuota: profile.dailyQuota,
                isAuthenticated: true,
              };
              return next();
            }
          }
        } catch {
          // Tiếp tục xuống fallback ẩn danh bên dưới
        }
      }
    }
  }

  // 3. Fallback phiên ẩn danh theo header x-studio-guest-id
  const rawGuestId = String(req.headers['x-studio-guest-id'] || 'anon-default')
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .slice(0, 48);
  const guestUid = rawGuestId.startsWith('anon') ? rawGuestId : `anon_${rawGuestId || 'studio'}`;

  try {
    const profile = await getOrCreateProfile({
      uid: guestUid,
      email: `${guestUid}@anonymous.literature.studio`,
      username: `Độc giả #${guestUid.slice(-6).toUpperCase()}`,
      role: 'user',
    });

    req.userContext = {
      uid: profile.uid,
      email: profile.email,
      username: profile.username,
      role: 'user',
      dailyQuota: profile.dailyQuota,
      isAuthenticated: true,
    };
    return next();
  } catch (error) {
    console.error('Fallback session resolution error:', error);
    req.userContext = {
      uid: guestUid,
      email: `${guestUid}@anonymous.literature.studio`,
      username: `Độc giả #${guestUid.slice(-6).toUpperCase()}`,
      role: 'user',
      dailyQuota: 15,
      isAuthenticated: true,
    };
    return next();
  }
};

