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
      try {
        const decoded = await adminAuth.verifyIdToken(token);
        const email = decoded.email || `${decoded.uid}@user.literature.studio`;
        const username = decoded.name || email.split('@')[0] || 'Học viên Văn học';
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
      } catch (error) {
        console.error('Error verifying Firebase ID token:', error);
        return res.status(401).json({
          error: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại.',
        });
      }
    }
  }

  // Fallback to a sandboxed guest session so the app works immediately before Google Sign-In
  const rawGuestId = String(req.headers['x-studio-guest-id'] || 'guest-default')
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .slice(0, 48);
  const guestUid = `guest_${rawGuestId || 'studio'}`;

  try {
    const profile = await getOrCreateProfile({
      uid: guestUid,
      email: `${guestUid}@guest.literature.studio`,
      username: 'Khách trải nghiệm',
      role: 'guest',
    });

    req.userContext = {
      uid: profile.uid,
      email: profile.email,
      username: profile.username,
      role: 'guest',
      dailyQuota: profile.dailyQuota,
      isAuthenticated: false,
    };
    return next();
  } catch (error) {
    console.error('Fallback session resolution error:', error);
    req.userContext = {
      uid: guestUid,
      email: `${guestUid}@guest.literature.studio`,
      username: 'Khách trải nghiệm',
      role: 'guest',
      dailyQuota: 15,
      isAuthenticated: false,
    };
    return next();
  }
};
