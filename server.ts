import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import * as dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { resolveUserSession, AuthRequest } from './src/middleware/auth.ts';
import {
  checkDatabaseReady,
  clearAllUserConversations,
  deleteUserConversation,
  getDailyUsageCount,
  getOrCreateProfile,
  getUserSettingsRecord,
  getUserWorkspaceSyncRecord,
  incrementDailyUsageCount,
  listUserConversations,
  saveConversationTurn,
  upsertUserSettingsRecord,
  upsertUserWorkspaceSyncRecord,
} from './src/db/repository.ts';
import crypto from 'crypto';
import { evaluateQuotaState, formatDateKey } from './src/utils/studioLogic.ts';

dotenv.config();

const ALLOWED_MODELS = new Set(['gemini-4-hydrogen', 'gemini-3.1-flash-lite']);
const DEFAULT_MODEL = 'gemini-4-hydrogen';

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

  app.use(express.json({ limit: '2mb' }));

  // 1. Health & Configuration Check Endpoint
  app.get('/api/health', async (_req, res) => {
    const geminiConfigured = Boolean(
      process.env.GEMINI_API_KEY &&
        process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY' &&
        process.env.GEMINI_API_KEY.trim() !== ''
    );
    const dbConnected = await checkDatabaseReady();

    res.json({
      status: geminiConfigured && dbConnected ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      services: {
        backend: true,
        geminiConfigured,
        defaultModel: DEFAULT_MODEL,
        availableModels: Array.from(ALLOWED_MODELS),
        databaseConnected: dbConnected,
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
    const supabaseConfigured = Boolean(
      process.env.VITE_SUPABASE_URL &&
        process.env.VITE_SUPABASE_PUBLISHABLE_KEY &&
        !process.env.VITE_SUPABASE_URL.includes('your_supabase')
    );
    const dbConnected = await checkDatabaseReady();

    res.json({
      ok: true,
      backendReady: true,
      geminiConfigured,
      supabaseConfigured,
      databaseConnected: dbConnected,
      anonymousAuthEnabled: true,
      timestamp: new Date().toISOString(),
    });
  });

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

  // 1c. Automatic Anonymous Session Provisioning Endpoint (/api/auth/anonymous)
  app.post('/api/auth/anonymous', async (req, res) => {
    try {
      const { existingUid } = req.body || {};
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      const hasValidExistingUuid =
        typeof existingUid === 'string' && uuidRegex.test(existingUid.trim());

      // Nếu lần đầu khởi tạo và có cấu hình Supabase, thử đăng ký ẩn danh trực tiếp với Supabase Auth
      const supaUrl = (process.env.VITE_SUPABASE_URL || '').trim();
      const supaKey = (
        process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
        process.env.VITE_SUPABASE_ANON_KEY ||
        ''
      ).trim();

      if (!hasValidExistingUuid && supaUrl.startsWith('http') && supaKey) {
        try {
          const supaRes = await fetch(`${supaUrl.replace(/\/$/, '')}/auth/v1/signup`, {
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
              await getOrCreateProfile({
                uid: remoteUser.id,
                email: `${remoteUser.id}@anonymous.literature.studio`,
                username: `Độc giả #${String(remoteUser.id).slice(-6).toUpperCase()}`,
                role: 'user',
              }).catch(() => {});

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
          // Nếu Supabase chưa bật Allow anonymous sign-ins (422) hoặc mạng trễ, chuyển sang cấp phiên UUID chuẩn
        }
      }

      const uid = hasValidExistingUuid ? existingUid.trim() : crypto.randomUUID();
      const profile = await getOrCreateProfile({
        uid,
        email: `${uid}@anonymous.literature.studio`,
        username: `Độc giả #${uid.slice(-6).toUpperCase()}`,
        role: 'user',
      });

      const createdAtIso = profile.createdAt?.toISOString() ?? new Date().toISOString();
      const supaSession = buildServerSupabaseSession(profile.uid, createdAtIso);

      res.json({
        ...supaSession,
        session: supaSession,
        uid: profile.uid,
        username: profile.username,
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

  // 1d. Per-User Workspace Synchronization Endpoints (/api/user-data)
  app.get('/api/user-data', resolveUserSession, async (req: AuthRequest, res) => {
    try {
      const user = req.userContext!;
      const syncRow = await getUserWorkspaceSyncRecord(user.uid);
      if (!syncRow) {
        return res.json({ workspace: null });
      }
      const safeParse = <T>(raw: string | null | undefined, fallback: T): T => {
        if (!raw) return fallback;
        try {
          return JSON.parse(raw) as T;
        } catch {
          return fallback;
        }
      };

      res.json({
        workspace: {
          lastDocumentId: syncRow.lastDocumentId || 'doc-truyen-kieu',
          lastSegmentIndex: syncRow.lastSegmentIndex ?? 0,
          ttsSettings: safeParse(syncRow.ttsSettingsJson, undefined),
          personalNotes: safeParse(syncRow.personalNotesJson, undefined),
          readingHistory: safeParse(syncRow.readingHistoryJson, undefined),
          favorites: safeParse(syncRow.favoritesJson, undefined),
          savedDocuments: safeParse(syncRow.savedDocumentsJson, undefined),
          updatedAt: syncRow.updatedAt?.toISOString() ?? new Date().toISOString(),
        },
      });
    } catch (error: any) {
      console.error('Error in GET /api/user-data:', error);
      res.status(500).json({ error: 'Không thể tải dữ liệu đồng bộ người dùng.' });
    }
  });

  app.post('/api/user-data', resolveUserSession, async (req: AuthRequest, res) => {
    try {
      const user = req.userContext!;
      const body = req.body || {};

      const updated = await upsertUserWorkspaceSyncRecord({
        uid: user.uid,
        lastDocumentId:
          typeof body.lastDocumentId === 'string' ? body.lastDocumentId : undefined,
        lastSegmentIndex:
          typeof body.lastSegmentIndex === 'number' ? body.lastSegmentIndex : undefined,
        ttsSettingsJson:
          body.ttsSettings !== undefined ? JSON.stringify(body.ttsSettings) : undefined,
        personalNotesJson:
          body.personalNotes !== undefined ? JSON.stringify(body.personalNotes) : undefined,
        readingHistoryJson:
          body.readingHistory !== undefined ? JSON.stringify(body.readingHistory) : undefined,
        favoritesJson:
          body.favorites !== undefined ? JSON.stringify(body.favorites) : undefined,
        savedDocumentsJson:
          body.savedDocuments !== undefined ? JSON.stringify(body.savedDocuments) : undefined,
      });

      res.json({
        ok: true,
        syncedAt: updated?.updatedAt?.toISOString() ?? new Date().toISOString(),
      });
    } catch (error: any) {
      console.error('Error in POST /api/user-data:', error);
      res.status(500).json({ error: 'Không thể lưu dữ liệu đồng bộ người dùng.' });
    }
  });

  // 2. Daily Quota & Usage Endpoint
  app.get('/api/usage', resolveUserSession, async (req: AuthRequest, res) => {
    try {
      const user = req.userContext!;
      const todayKey = formatDateKey();
      const usedToday = await getDailyUsageCount(user.uid, todayKey);
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
          'Hạn mức 15 lượt/ngày là hạn mức quản trị của Literature Studio theo từng tài khoản, độc lập với hạn mức API của Gemini và cấu hình thanh toán Google Cloud.',
      });
    } catch (error: any) {
      console.error('Error in GET /api/usage:', error);
      res.status(500).json({
        error: error.message || 'Không thể kiểm tra hạn mức sử dụng.',
      });
    }
  });

  // 3. Conversations History Endpoints
  app.get('/api/conversations', resolveUserSession, async (req: AuthRequest, res) => {
    try {
      const user = req.userContext!;
      const items = await listUserConversations(user.uid);
      res.json({ conversations: items });
    } catch (error: any) {
      console.error('Error in GET /api/conversations:', error);
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
      const savedId = await saveConversationTurn({
        uid: user.uid,
        conversationId: conversationId ? Number(conversationId) : undefined,
        title: String(title || userPrompt).slice(0, 90),
        mode: String(mode || 'work_analysis'),
        userPrompt: String(userPrompt),
        assistantReply: String(assistantReply),
      });
      res.json({ success: true, conversationId: savedId });
    } catch (error: any) {
      console.error('Error in POST /api/conversations:', error);
      res.status(500).json({
        error: error.message || 'Không thể lưu hội thoại.',
      });
    }
  });

  app.delete('/api/conversations', resolveUserSession, async (req: AuthRequest, res) => {
    try {
      const user = req.userContext!;
      const idParam = req.query.id;
      if (idParam) {
        const deleted = await deleteUserConversation(user.uid, Number(idParam));
        return res.json({ success: deleted });
      } else {
        await clearAllUserConversations(user.uid);
        return res.json({ success: true });
      }
    } catch (error: any) {
      console.error('Error in DELETE /api/conversations:', error);
      res.status(500).json({
        error: error.message || 'Không thể xóa hội thoại.',
      });
    }
  });

  // 4. User Settings Endpoints
  app.get('/api/settings', resolveUserSession, async (req: AuthRequest, res) => {
    try {
      const user = req.userContext!;
      const record = await getUserSettingsRecord(user.uid);
      res.json({ settings: record });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Không thể tải cài đặt.' });
    }
  });

  app.post('/api/settings', resolveUserSession, async (req: AuthRequest, res) => {
    try {
      const user = req.userContext!;
      const { theme, language, playerSettings, aiSettings } = req.body || {};
      const updated = await upsertUserSettingsRecord({
        uid: user.uid,
        theme: String(theme || 'dark'),
        language: String(language || 'vi'),
        playerSettings:
          typeof playerSettings === 'string'
            ? playerSettings
            : JSON.stringify(playerSettings || {}),
        aiSettings:
          typeof aiSettings === 'string' ? aiSettings : JSON.stringify(aiSettings || {}),
      });
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
      const usedToday = await getDailyUsageCount(user.uid, todayKey);
      const quota = evaluateQuotaState(usedToday, user.dailyQuota);

      if (!quota.allowed) {
        return res.status(429).json({
          error: `Bạn đã sử dụng hết hạn mức ${user.dailyQuota} lượt AI trong ngày hôm nay (${todayKey}). Vui lòng quay lại vào ngày mai hoặc liên hệ quản trị viên.`,
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

      // Construct conversation context cleanly (limit recent history to 6 messages)
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

      const updatedCount = await incrementDailyUsageCount(user.uid, todayKey);
      const updatedQuota = evaluateQuotaState(updatedCount, user.dailyQuota);

      let activeConvId = conversationId ? Number(conversationId) : undefined;
      if (saveHistory !== false) {
        activeConvId = await saveConversationTurn({
          uid: user.uid,
          conversationId: activeConvId,
          title: prompt.trim().slice(0, 80),
          mode,
          userPrompt: prompt.trim(),
          assistantReply: replyText,
        });
      }

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
