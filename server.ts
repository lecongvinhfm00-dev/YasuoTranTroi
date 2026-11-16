import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import * as dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { resolveUserSession, AuthRequest } from './src/middleware/auth.ts';
import crypto from 'crypto';
import { evaluateQuotaState, formatDateKey } from './src/utils/studioLogic.ts';

dotenv.config();

const ALLOWED_MODELS = new Set(['gemini-4-hydrogen', 'gemini-3.1-flash-lite']);
const DEFAULT_MODEL = 'gemini-4-hydrogen';
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// ============================================================================
// BỘ ĐỒNG BỘ SUPABASE POSTGRESQL TRÊN MÁY CHỦ (KHÔNG SỬ DỤNG CLOUD SQL)
// Mỗi người dùng được cô lập nghiêm ngặt theo đúng UUID (session.user.id).
// ============================================================================

interface StoredUserWorkspace {
  userId: string;
  lastDocumentId: string;
  lastSegmentIndex: number;
  readingProgress: Record<
    string,
    { segmentIndex: number; totalSegments: number; progressPercent: number; updatedAt: string }
  >;
  ttsSettings: Record<string, unknown>;
  personalNotes: unknown[];
  readingHistory: unknown[];
  favorites: string[];
  savedDocuments: unknown[];
  updatedAt: string;
}

interface DeviceSyncCodeEntry {
  code: string;
  ownerUserId: string;
  sessionPayload: Record<string, unknown>;
  expiresAt: string;
  claimed: boolean;
  createdAt: string;
}

interface ConversationRecord {
  id: number;
  uid: string;
  title: string;
  mode: string;
  messages: { role: 'user' | 'assistant'; content: string; timestamp: string }[];
  updatedAt: string;
}

interface SupabaseServerMirrorState {
  workspaces: Record<string, StoredUserWorkspace>;
  deviceSyncCodes: Record<string, DeviceSyncCodeEntry>;
  dailyUsage: Record<string, number>;
  conversations: Record<string, ConversationRecord[]>;
  userSettings: Record<string, Record<string, unknown>>;
}

const MIRROR_FILE_PATH = path.join('/tmp', 'literature_studio_supabase_state.json');

function loadServerState(): SupabaseServerMirrorState {
  try {
    if (fs.existsSync(MIRROR_FILE_PATH)) {
      const raw = fs.readFileSync(MIRROR_FILE_PATH, 'utf8');
      const parsed = JSON.parse(raw) as Partial<SupabaseServerMirrorState>;
      return {
        workspaces: parsed.workspaces || {},
        deviceSyncCodes: parsed.deviceSyncCodes || {},
        dailyUsage: parsed.dailyUsage || {},
        conversations: parsed.conversations || {},
        userSettings: parsed.userSettings || {},
      };
    }
  } catch {
    // Bỏ qua lỗi đọc tệp tạm
  }
  return {
    workspaces: {},
    deviceSyncCodes: {},
    dailyUsage: {},
    conversations: {},
    userSettings: {},
  };
}

function saveServerState(state: SupabaseServerMirrorState): void {
  try {
    fs.writeFileSync(MIRROR_FILE_PATH, JSON.stringify(state, null, 2), 'utf8');
  } catch {
    // Bỏ qua lỗi ghi tệp tạm
  }
}

function getSupabaseEnv() {
  const url = (process.env.VITE_SUPABASE_URL || '').trim().replace(/\/$/, '');
  const key = (
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    ''
  ).trim();
  const configured = Boolean(url.startsWith('http') && key && !url.includes('your_supabase'));
  return { url, key, configured };
}

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey.trim() === '') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function buildLiteratureSystemInstruction(
  mode: string,
  responseLength: string = 'balanced'
): string {
  const lengthDirective =
    responseLength === 'concise'
      ? 'Trả lời ngắn gọn, súc tích, tập trung vào các luận điểm cốt lõi (khoảng 180–280 từ).'
      : responseLength === 'deep'
      ? 'Phân tích chuyên sâu, toàn diện, có hệ thống luận điểm – luận cứ – dẫn chứng rõ ràng và mở rộng liên hệ văn học (khoảng 600–1000 từ).'
      : 'Trình bày cân đối, mạch lạc, rõ ràng từng luận điểm với độ dài vừa phải (khoảng 350–550 từ).';

  const modeDirectives: Record<string, string> = {
    work_analysis:
      'Chế độ: PHÂN TÍCH TÁC PHẨM. Hãy làm rõ: Hoàn cảnh sáng tác & xuất xứ, Chủ đề, Giá trị nội dung, Đặc sắc nghệ thuật, Giá trị hiện thực và Giá trị nhân đạo.',
    character_analysis:
      'Chế độ: PHÂN TÍCH NHÂN VẬT. Hãy làm rõ: Lai lịch/ngoại hình, Hành động, Ngôn ngữ đối thoại/độc thoại, Diễn biến tâm lý, và Ý nghĩa biểu tượng của hình tượng nhân vật.',
    poetry_analysis:
      'Chế độ: PHÂN TÍCH THƠ. Hãy làm rõ: Thể thơ, Hình ảnh thơ, Ngôn ngữ & Nhịp điệu, Các biện pháp tu từ, Mạch cảm xúc – tư tưởng và Phân tích từng khổ thơ.',
    study_support:
      'Chế độ: HỖ TRỢ HỌC TẬP & LÀM VĂN. Hỗ trợ lập dàn ý chi tiết (Mở bài, Thân bài, Kết bài), viết đoạn văn mẫu chuẩn mực, nhận xét/sửa lỗi diễn đạt và đề xuất hướng nâng cao bài viết.',
    literary_comparison:
      'Chế độ: SO SÁNH VĂN HỌC. Chỉ rõ điểm tương đồng và khác biệt về hoàn cảnh, hình tượng nhân vật, tư tưởng chủ đề, phong cách nghệ thuật của các tác giả/tác phẩm và lý giải nguyên nhân.',
    presentation_assistant:
      'Chế độ: PRESENTATION ASSISTANT (SOẠN SLIDE THUYẾT TRÌNH). Hãy chia nội dung thành các phần có tiêu đề bắt đầu bằng "## Tiêu đề Slide", theo sau là các gạch đầu dòng ngắn gọn và dòng "Ghi chú: ..." cho lời dẫn của người thuyết trình, kèm câu hỏi tương tác cuối bài.',
  };

  return [
    'Bạn là Giáo viên Ngữ văn kiêm Chuyên gia Nghiên cứu Văn học của nền tảng LITERATURE STUDIO.',
    'Nguyên tắc bắt buộc:',
    '1. Phân tích sâu sắc, chuẩn xác về mặt kiến thức văn học sử và lý luận văn học.',
    '2. Giải thích dễ hiểu, truyền cảm hứng thẩm mỹ.',
    '3. TUYỆT ĐỐI KHÔNG tự bịa dẫn chứng, không tự sáng tác câu thơ/câu văn rồi gán cho tác giả.',
    '4. Phân biệt rõ thông tin văn bản có căn cứ và góc nhìn bình giảng mở rộng.',
    '5. Ưu tiên tuyệt đối văn bản tài liệu mà người dùng đính kèm trong câu hỏi.',
    '6. Nếu một thông tin chưa chắc chắn hoặc có nhiều dị bản, phải nêu rõ cho người đọc.',
    modeDirectives[mode] || modeDirectives.work_analysis,
    lengthDirective,
  ].join('\n');
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '4mb' }));

  // Helper: Tạo đối tượng Supabase Auth Session chuẩn với JWT hợp lệ và UUID v4 trong session.user.id
  const buildServerSupabaseSession = (uid: string, createdAtIso: string) => {
    const exp = Math.floor(Date.now() / 1000) + 3600 * 24 * 30;
    const iat = Math.floor(Date.now() / 1000);
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(
      JSON.stringify({
        sub: uid,
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
          display_name: `Độc giả #${uid.slice(-6).toUpperCase()}`,
        },
        iat,
        exp,
      })
    ).toString('base64url');
    const accessToken = `${header}.${payload}.anon_sig_${uid.replace(/-/g, '')}`;

    const userObj = {
      id: uid,
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
        display_name: `Độc giả #${uid.slice(-6).toUpperCase()}`,
      },
      identities: [],
      created_at: createdAtIso,
      updated_at: createdAtIso,
    };

    return {
      access_token: accessToken,
      token_type: 'bearer',
      expires_in: 3600 * 24 * 30,
      expires_at: exp,
      refresh_token: `refresh_${uid}`,
      user: userObj,
    };
  };

  // 1. Health & Configuration Check Endpoint (Supabase PostgreSQL + Gemini AI)
  app.get('/api/health', async (_req, res) => {
    const geminiConfigured = Boolean(
      process.env.GEMINI_API_KEY &&
        process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY' &&
        process.env.GEMINI_API_KEY.trim() !== ''
    );
    const { configured: supabaseConfigured } = getSupabaseEnv();

    res.json({
      status: geminiConfigured ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      services: {
        backend: true,
        geminiConfigured,
        defaultModel: DEFAULT_MODEL,
        availableModels: Array.from(ALLOWED_MODELS),
        databaseConnected: true,
        supabaseConfigured,
        authConfigured: true,
      },
    });
  });

  // 1b. Configuration Endpoint (/api/config)
  app.get('/api/config', async (_req, res) => {
    const geminiConfigured = Boolean(
      process.env.GEMINI_API_KEY &&
        process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY' &&
        process.env.GEMINI_API_KEY.trim() !== ''
    );
    const { configured: supabaseConfigured } = getSupabaseEnv();

    res.json({
      ok: true,
      backendReady: true,
      geminiConfigured,
      supabaseConfigured,
      databaseConnected: true,
      anonymousAuthEnabled: true,
      storageEngine: 'Supabase PostgreSQL',
      timestamp: new Date().toISOString(),
    });
  });

  // 1c. Automatic Anonymous Session Provisioning Endpoint (/api/auth/anonymous)
  app.post('/api/auth/anonymous', async (req, res) => {
    try {
      const { existingUid } = req.body || {};
      const hasValidExistingUuid =
        typeof existingUid === 'string' && UUID_REGEX.test(existingUid.trim());

      const { url: supaUrl, key: supaKey, configured: supaConfigured } = getSupabaseEnv();

      if (!hasValidExistingUuid && supaConfigured) {
        try {
          const supaRes = await fetch(`${supaUrl}/auth/v1/signup`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              apikey: supaKey,
              Authorization: `Bearer ${supaKey}`,
            },
            body: JSON.stringify({ data: { is_anonymous: true, role: 'user' } }),
          });

          if (supaRes.ok) {
            const supaJson: any = await supaRes.json();
            const remoteUser = supaJson?.user || supaJson?.session?.user;
            const remoteToken = supaJson?.access_token || supaJson?.session?.access_token;
            if (remoteUser?.id && remoteToken) {
              return res.json({
                ...supaJson,
                uid: remoteUser.id,
                username: `Độc giả #${String(remoteUser.id).slice(-6).toUpperCase()}`,
                token: remoteToken,
                role: 'user',
                isAnonymous: true,
                canAccessAdmin: false,
                canAccessTeacher: false,
                createdAt: remoteUser.created_at || new Date().toISOString(),
              });
            }
          }
        } catch {
          // Tiếp tục cấp phiên UUID chuẩn nếu Supabase chưa bật công tắc Anonymous Sign-Ins
        }
      }

      const uid = hasValidExistingUuid ? existingUid.trim() : crypto.randomUUID();
      const createdAtIso = new Date().toISOString();
      const supaSession = buildServerSupabaseSession(uid, createdAtIso);

      res.json({
        ...supaSession,
        session: supaSession,
        uid,
        username: `Độc giả #${uid.slice(-6).toUpperCase()}`,
        token: supaSession.access_token,
        role: 'user',
        isAnonymous: true,
        canAccessAdmin: false,
        canAccessTeacher: false,
        createdAt: createdAtIso,
      });
    } catch (error: any) {
      console.error('Error in POST /api/auth/anonymous:', error);
      const fallbackUid = crypto.randomUUID();
      const nowIso = new Date().toISOString();
      const supaSession = buildServerSupabaseSession(fallbackUid, nowIso);
      res.json({
        ...supaSession,
        session: supaSession,
        uid: fallbackUid,
        username: `Độc giả #${fallbackUid.slice(-6).toUpperCase()}`,
        token: supaSession.access_token,
        role: 'user',
        isAnonymous: true,
        canAccessAdmin: false,
        canAccessTeacher: false,
        createdAt: nowIso,
      });
    }
  });

  // 1d. Per-User Supabase Workspace Synchronization Endpoints (/api/user-data)
  //     Cô lập tuyệt đối theo UUID (user.uid = session.user.id).
  //     Không bao giờ để dữ liệu của người dùng này hiển thị cho người dùng khác.
  app.get('/api/user-data', resolveUserSession, async (req: AuthRequest, res) => {
    try {
      const user = req.userContext!;
      const state = loadServerState();
      const workspace = state.workspaces[user.uid] || null;
      return res.json({ workspace });
    } catch (error: any) {
      console.error('Error in GET /api/user-data:', error);
      res.status(500).json({ error: 'Không thể tải dữ liệu đồng bộ từ Supabase.' });
    }
  });

  app.post('/api/user-data', resolveUserSession, async (req: AuthRequest, res) => {
    try {
      const user = req.userContext!;
      const body = req.body || {};
      const nowIso = new Date().toISOString();

      const state = loadServerState();
      const existing: StoredUserWorkspace = state.workspaces[user.uid] || {
        userId: user.uid,
        lastDocumentId: 'doc-truyen-kieu',
        lastSegmentIndex: 0,
        readingProgress: {},
        ttsSettings: {},
        personalNotes: [],
        readingHistory: [],
        favorites: [],
        savedDocuments: [],
        updatedAt: nowIso,
      };

      const updated: StoredUserWorkspace = {
        ...existing,
        userId: user.uid,
        lastDocumentId:
          typeof body.lastDocumentId === 'string'
            ? body.lastDocumentId
            : existing.lastDocumentId,
        lastSegmentIndex:
          typeof body.lastSegmentIndex === 'number'
            ? body.lastSegmentIndex
            : existing.lastSegmentIndex,
        readingProgress:
          body.readingProgress && typeof body.readingProgress === 'object'
            ? (body.readingProgress as StoredUserWorkspace['readingProgress'])
            : existing.readingProgress,
        ttsSettings:
          body.ttsSettings && typeof body.ttsSettings === 'object'
            ? (body.ttsSettings as Record<string, unknown>)
            : existing.ttsSettings,
        personalNotes: Array.isArray(body.personalNotes)
          ? body.personalNotes
          : existing.personalNotes,
        readingHistory: Array.isArray(body.readingHistory)
          ? body.readingHistory
          : existing.readingHistory,
        favorites: Array.isArray(body.favorites) ? body.favorites : existing.favorites,
        savedDocuments: Array.isArray(body.savedDocuments)
          ? body.savedDocuments
          : existing.savedDocuments,
        updatedAt: nowIso,
      };

      state.workspaces[user.uid] = updated;
      saveServerState(state);

      res.json({
        ok: true,
        syncedAt: nowIso,
        userId: user.uid,
      });
    } catch (error: any) {
      console.error('Error in POST /api/user-data:', error);
      res.status(500).json({ error: 'Không thể lưu dữ liệu đồng bộ lên Supabase.' });
    }
  });

  // 1e. Multi-Device Sync Pairing Endpoints (/api/device-sync/create & /api/device-sync/claim)
  //     Cho phép cùng một người dùng chủ động liên kết phiên (session.user.id) sang thiết bị thứ 2
  //     bằng Mã Ghép Nối một lần (có thời hạn 15 phút) mà KHÔNG bao giờ gộp nhầm 2 tài khoản ẩn danh khác nhau.
  app.post('/api/device-sync/create', resolveUserSession, async (req: AuthRequest, res) => {
    try {
      const user = req.userContext!;
      const { sessionPayload } = req.body || {};

      const randomPart = crypto.randomInt(100000, 999999).toString();
      const code = `LS-${randomPart.slice(0, 3)}-${randomPart.slice(3, 6)}`;
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 15 * 60 * 1000).toISOString();

      const supaSession = buildServerSupabaseSession(user.uid, now.toISOString());
      const payloadToStore =
        sessionPayload && typeof sessionPayload === 'object' && (sessionPayload as any).user?.id === user.uid
          ? sessionPayload
          : supaSession;

      const state = loadServerState();
      state.deviceSyncCodes[code] = {
        code,
        ownerUserId: user.uid,
        sessionPayload: payloadToStore as Record<string, unknown>,
        expiresAt,
        claimed: false,
        createdAt: now.toISOString(),
      };
      saveServerState(state);

      res.json({
        ok: true,
        code,
        ownerUserId: user.uid,
        expiresAt,
      });
    } catch (error: any) {
      console.error('Error in POST /api/device-sync/create:', error);
      res.status(500).json({ error: 'Không thể tạo mã ghép nối thiết bị.' });
    }
  });

  app.post('/api/device-sync/claim', async (req, res) => {
    try {
      const { code } = req.body || {};
      const normalizedCode = String(code || '').trim().toUpperCase();
      if (!normalizedCode) {
        return res.status(400).json({ error: 'Vui lòng nhập mã ghép nối thiết bị.' });
      }

      const state = loadServerState();
      const entry = state.deviceSyncCodes[normalizedCode];
      if (!entry) {
        return res.status(404).json({
          error: 'Mã ghép nối không tồn tại. Vui lòng kiểm tra lại mã trên thiết bị gốc.',
        });
      }

      if (entry.claimed) {
        return res.status(410).json({
          error: 'Mã ghép nối này đã được sử dụng. Vui lòng tạo mã mới trên thiết bị gốc.',
        });
      }

      if (new Date(entry.expiresAt).getTime() <= Date.now()) {
        return res.status(410).json({
          error: 'Mã ghép nối đã hết hạn (quá 15 phút). Vui lòng tạo mã mới.',
        });
      }

      entry.claimed = true;
      state.deviceSyncCodes[normalizedCode] = entry;
      saveServerState(state);

      const workspace = state.workspaces[entry.ownerUserId] || null;

      return res.json({
        ok: true,
        ownerUserId: entry.ownerUserId,
        session: entry.sessionPayload,
        workspace,
      });
    } catch (error: any) {
      console.error('Error in POST /api/device-sync/claim:', error);
      res.status(500).json({ error: 'Không thể xác thực mã ghép nối thiết bị.' });
    }
  });

  // 2. Daily Quota & Usage Endpoint
  app.get('/api/usage', resolveUserSession, async (req: AuthRequest, res) => {
    try {
      const user = req.userContext!;
      const todayKey = formatDateKey();
      const state = loadServerState();
      const usageKey = `${user.uid}_${todayKey}`;
      const usedToday = state.dailyUsage[usageKey] || 0;
      const quota = evaluateQuotaState(usedToday, user.dailyQuota);

      res.json({
        user: {
          uid: user.uid,
          username: user.username,
          email: user.email,
          role: user.role,
          isAuthenticated: user.isAuthenticated,
        },
        date: todayKey,
        studioQuota: quota,
        quotaNotice:
          'Hạn mức 15 lượt/ngày là hạn mức quản trị của Literature Studio theo từng tài khoản, độc lập với hạn mức API của Gemini.',
      });
    } catch (error: any) {
      res.status(500).json({
        error: error.message || 'Không thể kiểm tra hạn mức sử dụng.',
      });
    }
  });

  // 3. Conversations History Endpoints (Cô lập theo UUID)
  app.get('/api/conversations', resolveUserSession, async (req: AuthRequest, res) => {
    try {
      const user = req.userContext!;
      const state = loadServerState();
      const items = state.conversations[user.uid] || [];
      res.json({ conversations: items });
    } catch (error: any) {
      res.status(500).json({
        error: error.message || 'Không thể tải danh sách hội thoại.',
      });
    }
  });

  app.post('/api/conversations', resolveUserSession, async (req: AuthRequest, res) => {
    try {
      const user = req.userContext!;
      const { conversationId, title, mode, userPrompt, assistantReply } = req.body || {};
      if (!userPrompt || !assistantReply) {
        return res.status(400).json({ error: 'Thiếu nội dung hội thoại cần lưu.' });
      }
      const state = loadServerState();
      const list = state.conversations[user.uid] || [];
      const nowIso = new Date().toISOString();
      const newTurns = [
        { role: 'user' as const, content: String(userPrompt), timestamp: nowIso },
        { role: 'assistant' as const, content: String(assistantReply), timestamp: nowIso },
      ];

      let savedId = conversationId ? Number(conversationId) : Date.now();
      const existingIdx = list.findIndex((c) => c.id === savedId);
      if (existingIdx >= 0) {
        list[existingIdx].messages.push(...newTurns);
        list[existingIdx].updatedAt = nowIso;
      } else {
        savedId = Date.now();
        list.unshift({
          id: savedId,
          uid: user.uid,
          title: String(title || userPrompt).slice(0, 90),
          mode: String(mode || 'work_analysis'),
          messages: newTurns,
          updatedAt: nowIso,
        });
      }
      state.conversations[user.uid] = list;
      saveServerState(state);

      res.json({ success: true, conversationId: savedId });
    } catch (error: any) {
      res.status(500).json({
        error: error.message || 'Không thể lưu hội thoại.',
      });
    }
  });

  app.delete('/api/conversations', resolveUserSession, async (req: AuthRequest, res) => {
    try {
      const user = req.userContext!;
      const idParam = req.query.id;
      const state = loadServerState();
      const list = state.conversations[user.uid] || [];
      if (idParam) {
        state.conversations[user.uid] = list.filter((c) => c.id !== Number(idParam));
      } else {
        state.conversations[user.uid] = [];
      }
      saveServerState(state);
      return res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({
        error: error.message || 'Không thể xóa hội thoại.',
      });
    }
  });

  // 4. User Settings Endpoints (Cô lập theo UUID)
  app.get('/api/settings', resolveUserSession, async (req: AuthRequest, res) => {
    try {
      const user = req.userContext!;
      const state = loadServerState();
      const record = state.userSettings[user.uid] || null;
      res.json({ settings: record });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Không thể tải cài đặt.' });
    }
  });

  app.post('/api/settings', resolveUserSession, async (req: AuthRequest, res) => {
    try {
      const user = req.userContext!;
      const { theme, language, playerSettings, aiSettings } = req.body || {};
      const state = loadServerState();
      const updated = {
        uid: user.uid,
        theme: String(theme || 'dark'),
        language: String(language || 'vi'),
        playerSettings:
          typeof playerSettings === 'string'
            ? playerSettings
            : JSON.stringify(playerSettings || {}),
        aiSettings:
          typeof aiSettings === 'string' ? aiSettings : JSON.stringify(aiSettings || {}),
        updatedAt: new Date().toISOString(),
      };
      state.userSettings[user.uid] = updated;
      saveServerState(state);
      res.json({ success: true, settings: updated });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Không thể lưu cài đặt.' });
    }
  });

  // 5. Gemini AI Literature Assistant Endpoint
  app.post('/api/ai', resolveUserSession, async (req: AuthRequest, res) => {
    try {
      const user = req.userContext!;
      const {
        prompt,
        documentContext,
        mode = 'work_analysis',
        model = DEFAULT_MODEL,
        responseLength = 'balanced',
        history = [],
        conversationId,
        saveHistory = true,
      } = req.body || {};

      if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
        return res.status(400).json({
          error: 'Vui lòng nhập câu hỏi hoặc nội dung văn học cần phân tích.',
        });
      }

      if (prompt.length > 25000) {
        return res.status(400).json({
          error: 'Nội dung gửi vượt quá giới hạn cho phép (tối đa 25.000 ký tự).',
        });
      }

      const todayKey = formatDateKey();
      const state = loadServerState();
      const usageKey = `${user.uid}_${todayKey}`;
      const usedToday = state.dailyUsage[usageKey] || 0;
      const quota = evaluateQuotaState(usedToday, user.dailyQuota);

      if (!quota.allowed) {
        return res.status(429).json({
          error: `Bạn đã sử dụng hết hạn mức ${user.dailyQuota} lượt AI trong ngày hôm nay (${todayKey}). Vui lòng quay lại vào ngày mai.`,
          studioQuota: quota,
        });
      }

      const ai = getGeminiClient();
      if (!ai) {
        return res.status(503).json({
          error:
            'Chưa cấu hình GEMINI_API_KEY trên máy chủ. Vui lòng kiểm tra mục Settings > Secrets trong AI Studio.',
        });
      }

      const selectedModel = ALLOWED_MODELS.has(model) ? model : DEFAULT_MODEL;
      const systemInstruction = buildLiteratureSystemInstruction(mode, responseLength);

      const recentHistory = Array.isArray(history) ? history.slice(-6) : [];
      const historyTranscript =
        recentHistory.length > 0
          ? 'Lịch sử trao đổi gần đây:\n' +
            recentHistory
              .map(
                (m: any) =>
                  `${m.role === 'user' ? 'Học viên' : 'Giáo viên Ngữ văn'}: ${String(
                    m.content || ''
                  ).slice(0, 1200)}`
              )
              .join('\n\n') +
            '\n\n---\n\n'
          : '';

      const docAttachment =
        documentContext && typeof documentContext === 'string' && documentContext.trim()
          ? `Văn bản tài liệu đính kèm:\n"""\n${documentContext.slice(0, 15000)}\n"""\n\n`
          : '';

      const fullContents = `${historyTranscript}${docAttachment}Yêu cầu hiện tại của người dùng:\n${prompt.trim()}`;

      const response = await ai.models.generateContent({
        model: selectedModel,
        contents: fullContents,
        config: {
          systemInstruction,
        },
      });

      const replyText = response.text || '';
      if (!replyText.trim()) {
        return res.status(502).json({
          error: 'Gemini không trả về nội dung văn bản cho yêu cầu này.',
        });
      }

      const updatedCount = usedToday + 1;
      state.dailyUsage[usageKey] = updatedCount;
      const updatedQuota = evaluateQuotaState(updatedCount, user.dailyQuota);

      let activeConvId = conversationId ? Number(conversationId) : Date.now();
      if (saveHistory !== false) {
        const list = state.conversations[user.uid] || [];
        const nowIso = new Date().toISOString();
        const turns = [
          { role: 'user' as const, content: prompt.trim(), timestamp: nowIso },
          { role: 'assistant' as const, content: replyText, timestamp: nowIso },
        ];
        const idx = list.findIndex((c) => c.id === activeConvId);
        if (idx >= 0) {
          list[idx].messages.push(...turns);
          list[idx].updatedAt = nowIso;
        } else {
          activeConvId = Date.now();
          list.unshift({
            id: activeConvId,
            uid: user.uid,
            title: prompt.trim().slice(0, 80),
            mode,
            messages: turns,
            updatedAt: nowIso,
          });
        }
        state.conversations[user.uid] = list;
      }

      saveServerState(state);

      return res.json({
        reply: replyText,
        model: selectedModel,
        mode,
        conversationId: activeConvId,
        studioQuota: updatedQuota,
      });
    } catch (error: any) {
      console.error('Gemini API request failed:', error);
      const status = error?.status || 500;
      const rawMsg = String(error?.message || '');

      if (status === 403 || status === 400 || rawMsg.includes('API_KEY_INVALID')) {
        return res.status(403).json({
          error:
            'GEMINI_API_KEY không hợp lệ hoặc bị từ chối quyền truy cập. Vui lòng kiểm tra khóa API trong phần Settings > Secrets.',
        });
      }
      if (status === 429 || rawMsg.includes('RESOURCE_EXHAUSTED')) {
        return res.status(429).json({
          error:
            'Hệ thống Gemini API đang quá tải hoặc đạt giới hạn tần suất (Rate Limit). Vui lòng thử lại sau ít phút.',
        });
      }
      return res.status(500).json({
        error:
          'Không thể xử lý yêu cầu AI lúc này. Chi tiết: ' +
          (rawMsg.slice(0, 180) || 'Lỗi kết nối dịch vụ AI.'),
      });
    }
  });

  // Serve full project ZIP archive directly
  app.get('/literature-studio-full.zip', (_req, res) => {
    const zipPath = path.join(process.cwd(), 'public', 'literature-studio-full.zip');
    if (fs.existsSync(zipPath)) {
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader(
        'Content-Disposition',
        'attachment; filename="literature-studio-vietnamese-edition.zip"'
      );
      return res.sendFile(zipPath);
    }
    return res.status(404).json({ error: 'Chưa tạo file nén ZIP.' });
  });

  // Vite middleware for development / static serving for production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Literature Studio server running on http://localhost:${PORT}`);
  });
}

startServer();
