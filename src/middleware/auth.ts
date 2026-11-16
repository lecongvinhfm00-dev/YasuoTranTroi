import { Request, Response, NextFunction } from 'express';

export interface AuthUserContext {
  uid: string;
  email: string;
  username: string;
  avatarUrl?: string;
  role: 'user';
  dailyQuota: number;
  isAuthenticated: boolean;
}

export interface AuthRequest extends Request {
  userContext?: AuthUserContext;
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Xác thực yêu cầu từ Supabase Auth Bearer JWT (lấy UUID từ payload.sub / session.user.id).
 * Tuyệt đối không sử dụng Cloud SQL và không cấp quyền Admin/Teacher cho tài khoản ẩn danh.
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
      // 1. Giải mã JWT của Supabase Anonymous Auth (lấy UUID chuẩn từ payload.sub)
      const parts = token.split('.');
      if (parts.length === 3) {
        try {
          const payloadRaw = Buffer.from(parts[1], 'base64url').toString('utf8');
          const payload = JSON.parse(payloadRaw);
          if (payload && typeof payload.sub === 'string' && UUID_REGEX.test(payload.sub.trim())) {
            const supaUuid = payload.sub.trim();
            req.userContext = {
              uid: supaUuid,
              email: `${supaUuid}@supabase.literature.studio`,
              username:
                payload.user_metadata?.display_name ||
                `Độc giả #${supaUuid.slice(-6).toUpperCase()}`,
              // Yêu cầu bảo mật: Tài khoản ẩn danh luôn bị khóa ở role = 'user'
              role: 'user',
              dailyQuota: 15,
              isAuthenticated: true,
            };
            return next();
          }
        } catch {
          // Tiếp tục kiểm tra định dạng token dự phòng bên dưới
        }
      }

      // 2. Hỗ trợ token phiên ẩn danh định dạng anon_tok_<uuid>
      if (token.startsWith('anon_tok_')) {
        const rawUuid = token.slice('anon_tok_'.length).trim();
        if (UUID_REGEX.test(rawUuid)) {
          req.userContext = {
            uid: rawUuid,
            email: `${rawUuid}@supabase.literature.studio`,
            username: `Độc giả #${rawUuid.slice(-6).toUpperCase()}`,
            role: 'user',
            dailyQuota: 15,
            isAuthenticated: true,
          };
          return next();
        }
      }
    }
  }

  // Không giả định hai tài khoản ẩn danh khác nhau là cùng một người:
  // nếu thiếu token hợp lệ, từ chối truy cập dữ liệu cá nhân thay vì dùng chung một tài khoản mặc định.
  if (req.path.startsWith('/api/user-data') || req.path.startsWith('/api/device-sync')) {
    return res.status(401).json({
      error: 'Yêu cầu phiên đăng nhập Supabase hợp lệ (session.user.id) để đồng bộ dữ liệu.',
    });
  }

  const headerUuid = String(req.headers['x-supabase-user-id'] || '').trim();
  const safeUid = UUID_REGEX.test(headerUuid)
    ? headerUuid
    : '00000000-0000-4000-8000-000000000000';

  req.userContext = {
    uid: safeUid,
    email: `${safeUid}@supabase.literature.studio`,
    username: `Độc giả #${safeUid.slice(-6).toUpperCase()}`,
    role: 'user',
    dailyQuota: 15,
    isAuthenticated: true,
  };
  return next();
};
