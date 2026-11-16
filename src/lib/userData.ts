import type { Session } from '@supabase/supabase-js';
import {
  supabase,
  isSupabaseConfigured,
  isValidUUID,
  buildAnonymousSupabaseSession,
  decodeMultiDeviceSyncKey,
} from './supabase';
import type {
  LiteratureDocument,
  PersonalNoteItem,
  PlaylistItem,
  ReadingHistoryItem,
  StudioSettings,
  TTSSettingsConfig,
} from '../types/studio';

// ============================================================================
// ĐỊNH NGHĨA KIỂU DỮ LIỆU ĐỒNG BỘ SUPABASE POSTGRESQL ĐA THIẾT BỊ
// ============================================================================

export interface ReadingProgressMapItem {
  documentId: string;
  segmentIndex: number;
  totalSegments: number;
  progressPercent: number;
  updatedAt: string;
}

export interface UserWorkspaceBundle {
  lastDocumentId: string;
  lastSegmentIndex: number;
  readingProgress: Record<string, ReadingProgressMapItem>;
  ttsSettings: TTSSettingsConfig;
  personalNotes: PersonalNoteItem[];
  readingHistory: ReadingHistoryItem[];
  favorites: string[];
  savedDocuments: LiteratureDocument[];
  playlists?: PlaylistItem[];
  settings?: Partial<StudioSettings>;
  updatedAt?: string;
}

const LOCAL_WORKSPACE_CACHE_PREFIX = 'literature_studio_workspace_v3_';
const OFFLINE_QUEUE_PREFIX = 'literature_studio_offline_queue_v3_';

export function loadLocalWorkspaceCache(uid: string): Partial<UserWorkspaceBundle> | null {
  if (!isValidUUID(uid)) return null;
  try {
    const raw = localStorage.getItem(`${LOCAL_WORKSPACE_CACHE_PREFIX}${uid}`);
    if (!raw) return null;
    return JSON.parse(raw) as Partial<UserWorkspaceBundle>;
  } catch {
    return null;
  }
}

export function saveLocalWorkspaceCache(uid: string, bundle: Partial<UserWorkspaceBundle>): void {
  if (!isValidUUID(uid)) return;
  try {
    const existing = loadLocalWorkspaceCache(uid) || {};
    const merged: Partial<UserWorkspaceBundle> = {
      ...existing,
      ...bundle,
      readingProgress: {
        ...(existing.readingProgress || {}),
        ...(bundle.readingProgress || {}),
      },
      updatedAt: bundle.updatedAt || new Date().toISOString(),
    };
    localStorage.setItem(`${LOCAL_WORKSPACE_CACHE_PREFIX}${uid}`, JSON.stringify(merged));
  } catch {
    // Bỏ qua lỗi vượt hạn mức localStorage
  }
}

/**
 * Lưu thay đổi vào hàng đợi ngoại tuyến (Offline Queue) theo đúng UUID người dùng
 * khi mất mạng hoặc khi chưa thể kết nối tới Supabase.
 */
export function enqueueOfflineSyncPatch(
  uid: string,
  patch: Partial<UserWorkspaceBundle>
): void {
  if (!isValidUUID(uid)) return;
  try {
    const existingRaw = localStorage.getItem(`${OFFLINE_QUEUE_PREFIX}${uid}`);
    const existing: Partial<UserWorkspaceBundle> = existingRaw ? JSON.parse(existingRaw) : {};
    const merged: Partial<UserWorkspaceBundle> = {
      ...existing,
      ...patch,
      readingProgress: {
        ...(existing.readingProgress || {}),
        ...(patch.readingProgress || {}),
      },
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(`${OFFLINE_QUEUE_PREFIX}${uid}`, JSON.stringify(merged));
  } catch {
    // Bỏ qua lỗi localStorage
  }
}

export function getOfflineSyncQueue(uid: string): Partial<UserWorkspaceBundle> | null {
  if (!isValidUUID(uid)) return null;
  try {
    const raw = localStorage.getItem(`${OFFLINE_QUEUE_PREFIX}${uid}`);
    if (!raw) return null;
    return JSON.parse(raw) as Partial<UserWorkspaceBundle>;
  } catch {
    return null;
  }
}

export function clearOfflineSyncQueue(uid: string): void {
  if (!isValidUUID(uid)) return;
  try {
    localStorage.removeItem(`${OFFLINE_QUEUE_PREFIX}${uid}`);
  } catch {
    // Bỏ qua
  }
}

export function hasPendingOfflineSync(uid: string): boolean {
  return Boolean(getOfflineSyncQueue(uid));
}

// ============================================================================
// ĐỒNG BỘ 6 NHÓM DỮ LIỆU LÊN CÁC BẢNG CHUẨN CỦA SUPABASE POSTGRESQL
// (reading_history, reading_progress, personal_notes, favorites, saved_documents, user_tts_settings, user_workspace_sync)
// ============================================================================

async function syncNormalizedSupabaseTables(
  uid: string,
  bundle: Partial<UserWorkspaceBundle>
): Promise<void> {
  if (!isSupabaseConfigured || !isValidUUID(uid)) return;
  const nowIso = new Date().toISOString();
  const tasks: Promise<unknown>[] = [];

  // 1. Cài đặt TTS (bảng public.user_tts_settings)
  if (bundle.ttsSettings) {
    tasks.push(
      Promise.resolve(
        supabase.from('user_tts_settings').upsert(
          {
            user_id: uid,
            voice_uri: bundle.ttsSettings.voiceURI || '',
            rate: bundle.ttsSettings.rate ?? 1.0,
            pitch: bundle.ttsSettings.pitch ?? 1.0,
            volume: bundle.ttsSettings.volume ?? 1.0,
            auto_next_segment: bundle.ttsSettings.autoNextSegment ?? true,
            auto_scroll: bundle.ttsSettings.autoScroll ?? true,
            highlight_active: bundle.ttsSettings.highlightActive ?? true,
            font_size: bundle.ttsSettings.fontSize || 'base',
            updated_at: nowIso,
          },
          { onConflict: 'user_id' }
        )
      )
    );
  }

  // 2. Lịch sử đọc (bảng public.reading_history)
  if (Array.isArray(bundle.readingHistory) && bundle.readingHistory.length > 0) {
    const historyRows = bundle.readingHistory.slice(0, 50).map((item) => ({
      user_id: uid,
      document_key: item.documentId,
      document_title: item.documentTitle,
      author_name: item.author || 'Khuyết danh',
      segment_index: item.segmentIndex ?? 0,
      total_segments: item.totalSegments ?? 1,
      progress_percent: item.progressPercent ?? 0,
      last_read_at: item.updatedAt || nowIso,
    }));
    tasks.push(
      Promise.resolve(
        supabase
          .from('reading_history')
          .upsert(historyRows, { onConflict: 'user_id,document_key' })
      )
    );
  }

  // 3. Tiến độ đọc (bảng public.reading_progress)
  if (bundle.readingProgress && Object.keys(bundle.readingProgress).length > 0) {
    const progressRows = Object.values(bundle.readingProgress).map((prog) => ({
      user_id: uid,
      document_key: prog.documentId,
      segment_index: prog.segmentIndex,
      total_segments: prog.totalSegments,
      progress: prog.progressPercent,
      updated_at: prog.updatedAt || nowIso,
    }));
    tasks.push(
      Promise.resolve(
        supabase
          .from('reading_progress')
          .upsert(progressRows, { onConflict: 'user_id,document_key' })
      )
    );
  }

  // 4. Ghi chú cá nhân (bảng public.personal_notes)
  if (Array.isArray(bundle.personalNotes)) {
    const noteRows = bundle.personalNotes.map((n) => ({
      id: n.id,
      user_id: uid,
      document_key: n.documentId || '',
      document_title: n.documentTitle || '',
      title: n.title,
      content: n.content,
      tags: n.tags || [],
      is_favorite: Boolean(n.isFavorite),
      updated_at: n.updatedAt || nowIso,
    }));
    if (noteRows.length > 0) {
      tasks.push(
        Promise.resolve(
          supabase.from('personal_notes').upsert(noteRows, { onConflict: 'user_id,id' })
        )
      );
    }
  }

  // 5. Sách / Tác phẩm yêu thích (bảng public.favorites)
  if (Array.isArray(bundle.favorites)) {
    const favRows = bundle.favorites.map((docKey) => ({
      user_id: uid,
      document_key: docKey,
      created_at: nowIso,
    }));
    if (favRows.length > 0) {
      tasks.push(
        Promise.resolve(
          supabase
            .from('favorites')
            .upsert(favRows, { onConflict: 'user_id,document_key' })
        )
      );
    }
  }

  // 6. Tài liệu văn học đã lưu (bảng public.saved_documents)
  if (Array.isArray(bundle.savedDocuments) && bundle.savedDocuments.length > 0) {
    const docRows = bundle.savedDocuments.map((d) => ({
      id: d.id,
      user_id: uid,
      title: d.title,
      author: d.author || 'Khuyết danh',
      category: d.category || 'Tài liệu học tập',
      period: d.period || 'Văn học Việt Nam',
      summary: d.summary || '',
      content: d.content,
      tags: d.bookmarks || [],
      is_favorite: Boolean(d.isFavorite),
      updated_at: nowIso,
    }));
    tasks.push(
      Promise.resolve(
        supabase.from('saved_documents').upsert(docRows, { onConflict: 'user_id,id' })
      )
    );
  }

  await Promise.allSettled(tasks);
}

/**
 * Khi mở website: Tải dữ liệu đồng bộ từ Supabase theo đúng UUID (`session.user.id`).
 * Nếu có thay đổi ngoại tuyến chưa đồng bộ trong hàng đợi của chính UUID đó, tự động đẩy lên Supabase trước.
 */
export async function fetchUserWorkspaceData(
  uid: string,
  token: string
): Promise<{
  data: Partial<UserWorkspaceBundle> | null;
  source: 'supabase' | 'local';
}> {
  if (!isValidUUID(uid)) {
    return { data: null, source: 'local' };
  }

  // Nếu thiết bị đang có dữ liệu ngoại tuyến chờ đồng bộ và hiện đã có mạng, đẩy lên Supabase trước
  const pendingQueue = getOfflineSyncQueue(uid);
  if (pendingQueue && (typeof navigator === 'undefined' || navigator.onLine !== false)) {
    await syncUserWorkspaceData(uid, token, pendingQueue);
  }

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { data: loadLocalWorkspaceCache(uid), source: 'local' };
  }

  // 1. Tải từ bảng `user_workspace_sync` trên Supabase PostgreSQL
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('user_workspace_sync')
        .select('*')
        .eq('user_id', uid)
        .maybeSingle();

      if (!error && data) {
        const parsed: Partial<UserWorkspaceBundle> = {
          lastDocumentId: data.last_document_id || 'doc-truyen-kieu',
          lastSegmentIndex:
            typeof data.last_segment_index === 'number' ? data.last_segment_index : 0,
          readingProgress: data.reading_progress_json
            ? JSON.parse(data.reading_progress_json)
            : {},
          ttsSettings: data.tts_settings_json ? JSON.parse(data.tts_settings_json) : undefined,
          personalNotes: data.personal_notes_json
            ? JSON.parse(data.personal_notes_json)
            : undefined,
          readingHistory: data.reading_history_json
            ? JSON.parse(data.reading_history_json)
            : undefined,
          favorites: data.favorites_json ? JSON.parse(data.favorites_json) : undefined,
          savedDocuments: data.saved_documents_json
            ? JSON.parse(data.saved_documents_json)
            : undefined,
          updatedAt: data.updated_at,
        };
        saveLocalWorkspaceCache(uid, parsed);
        return { data: parsed, source: 'supabase' };
      }
    } catch {
      // Tiếp tục kiểm tra qua endpoint đồng bộ Supabase trên máy chủ
    }
  }

  // 2. Tải từ endpoint đồng bộ Supabase trên máy chủ (/api/user-data) cô lập theo Bearer Token UUID
  try {
    const res = await fetch('/api/user-data', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (res.ok) {
      const payload = await res.json();
      if (payload && payload.workspace) {
        saveLocalWorkspaceCache(uid, payload.workspace);
        return { data: payload.workspace, source: 'supabase' };
      }
    }
  } catch {
    // Mất kết nối mạng -> đọc từ bộ nhớ đệm cục bộ của đúng UUID này
  }

  return { data: loadLocalWorkspaceCache(uid), source: 'local' };
}

/**
 * Khi người dùng thay đổi bất kỳ dữ liệu nào (lịch sử đọc, tiến độ đọc, ghi chú, sách yêu thích,
 * tài liệu đã lưu, cài đặt TTS): Tự động lưu lên Supabase PostgreSQL.
 * Nếu mất mạng, tự động đưa vào hàng đợi ngoại tuyến (Offline Queue) để đồng bộ lại ngay khi có mạng.
 */
export async function syncUserWorkspaceData(
  uid: string,
  token: string,
  bundle: Partial<UserWorkspaceBundle>
): Promise<{ ok: boolean; syncedAt: string; queuedOffline?: boolean }> {
  const nowIso = new Date().toISOString();
  if (!isValidUUID(uid)) {
    return { ok: false, syncedAt: nowIso };
  }

  saveLocalWorkspaceCache(uid, bundle);
  const fullSnapshot = loadLocalWorkspaceCache(uid) || bundle;

  // Kiểm tra trạng thái mạng trình duyệt
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    enqueueOfflineSyncPatch(uid, fullSnapshot);
    return { ok: false, syncedAt: nowIso, queuedOffline: true };
  }

  let supabaseDirectSuccess = false;

  if (isSupabaseConfigured) {
    try {
      const row: Record<string, unknown> = {
        user_id: uid,
        updated_at: nowIso,
      };
      if (fullSnapshot.lastDocumentId !== undefined)
        row.last_document_id = fullSnapshot.lastDocumentId;
      if (fullSnapshot.lastSegmentIndex !== undefined)
        row.last_segment_index = fullSnapshot.lastSegmentIndex;
      if (fullSnapshot.readingProgress !== undefined)
        row.reading_progress_json = JSON.stringify(fullSnapshot.readingProgress);
      if (fullSnapshot.ttsSettings !== undefined)
        row.tts_settings_json = JSON.stringify(fullSnapshot.ttsSettings);
      if (fullSnapshot.personalNotes !== undefined)
        row.personal_notes_json = JSON.stringify(fullSnapshot.personalNotes);
      if (fullSnapshot.readingHistory !== undefined)
        row.reading_history_json = JSON.stringify(fullSnapshot.readingHistory);
      if (fullSnapshot.favorites !== undefined)
        row.favorites_json = JSON.stringify(fullSnapshot.favorites);
      if (fullSnapshot.savedDocuments !== undefined)
        row.saved_documents_json = JSON.stringify(fullSnapshot.savedDocuments);

      const { error } = await supabase
        .from('user_workspace_sync')
        .upsert(row, { onConflict: 'user_id' });

      if (!error) {
        supabaseDirectSuccess = true;
      }

      // Đồng bộ song song vào các bảng chuẩn hóa (reading_history, reading_progress, personal_notes, favorites, saved_documents, user_tts_settings)
      syncNormalizedSupabaseTables(uid, fullSnapshot).catch(() => {});
    } catch {
      // Sẽ tiếp tục đồng bộ qua /api/user-data
    }
  }

  try {
    const res = await fetch('/api/user-data', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(fullSnapshot),
    });
    if (res.ok) {
      clearOfflineSyncQueue(uid);
      return { ok: true, syncedAt: nowIso };
    }
  } catch {
    // Lỗi kết nối mạng
  }

  if (supabaseDirectSuccess) {
    clearOfflineSyncQueue(uid);
    return { ok: true, syncedAt: nowIso };
  }

  // Nếu không thể kết nối tới Supabase, lưu vào hàng đợi ngoại tuyến để tự động đồng bộ lại khi có mạng
  enqueueOfflineSyncPatch(uid, fullSnapshot);
  return { ok: false, syncedAt: nowIso, queuedOffline: true };
}

/**
 * Tự động đồng bộ lại hàng đợi ngoại tuyến khi thiết bị có mạng trở lại.
 */
export async function flushOfflineQueueToSupabase(
  uid: string,
  token: string
): Promise<{ ok: boolean; syncedAt: string }> {
  const pending = getOfflineSyncQueue(uid);
  if (!pending) {
    return { ok: true, syncedAt: new Date().toISOString() };
  }
  return syncUserWorkspaceData(uid, token, pending);
}

// ============================================================================
// CƠ CHẾ ĐỒNG BỘ ĐA THIẾT BỊ CHO CÙNG MỘT NGƯỜI DÙNG
// (Không bao giờ giả định hai tài khoản ẩn danh khác nhau là cùng một người)
// ============================================================================

/**
 * Tạo Mã Ghép Nối Thiết Bị một lần (One-Time Pairing Code, có hiệu lực 15 phút)
 * trên Supabase (`public.device_sync_codes`) cho người dùng hiện tại (`session.user.id`).
 */
export async function createMultiDevicePairingCode(
  uid: string,
  token: string,
  session: Session | null
): Promise<{ ok: boolean; code?: string; expiresAt?: string; error?: string }> {
  if (!isValidUUID(uid)) {
    return { ok: false, error: 'Phiên người dùng chưa sẵn sàng.' };
  }

  try {
    const res = await fetch('/api/device-sync/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        sessionPayload: session,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data?.code) {
        // Nếu Supabase đã chạy SQL migration, lưu đồng thời vào bảng public.device_sync_codes
        if (isSupabaseConfigured && session) {
          Promise.resolve(
            supabase.from('device_sync_codes').upsert({
              code: data.code,
              owner_user_id: uid,
              session_payload: session,
              expires_at: data.expiresAt,
              claimed: false,
            })
          ).catch(() => {});
        }
        return {
          ok: true,
          code: data.code,
          expiresAt: data.expiresAt,
        };
      }
    }
    const errJson = await res.json().catch(() => ({}));
    return {
      ok: false,
      error: errJson?.error || 'Không thể khởi tạo mã ghép nối thiết bị.',
    };
  } catch {
    return {
      ok: false,
      error: 'Mất kết nối mạng khi tạo mã ghép nối thiết bị.',
    };
  }
}

/**
 * Thiết bị thứ 2 nhập Mã Ghép Nối (`LS-XXX-XXX`) hoặc Khóa Phiên Đa Thiết Bị (`LSKEY....`)
 * để liên kết vào đúng tài khoản Supabase (`session.user.id`) của người dùng đó và tải toàn bộ dữ liệu.
 */
export async function claimMultiDevicePairingCode(
  rawInput: string
): Promise<{
  ok: boolean;
  session?: Session;
  workspace?: Partial<UserWorkspaceBundle> | null;
  error?: string;
}> {
  const cleaned = rawInput.trim();
  if (!cleaned) {
    return { ok: false, error: 'Vui lòng nhập Mã Ghép Nối hoặc Khóa Liên Kết Đa Thiết Bị.' };
  }

  // Trường hợp 1: Người dùng nhập Khóa Liên Kết Đa Thiết Bị trực tiếp (LSKEY....)
  if (cleaned.startsWith('LSKEY.')) {
    const decodedSession = decodeMultiDeviceSyncKey(cleaned);
    if (!decodedSession || !isValidUUID(decodedSession.user.id)) {
      return {
        ok: false,
        error: 'Khóa Liên Kết Đa Thiết Bị không hợp lệ hoặc bị hỏng.',
      };
    }
    const { data: syncedData } = await fetchUserWorkspaceData(
      decodedSession.user.id,
      decodedSession.access_token
    );
    return {
      ok: true,
      session: decodedSession,
      workspace: syncedData,
    };
  }

  // Trường hợp 2: Người dùng nhập Mã Ghép Nối 1 lần (ví dụ: LS-482-910)
  const code = cleaned.toUpperCase();

  // Thử gọi RPC `claim_device_sync_code` trên Supabase PostgreSQL trước
  if (isSupabaseConfigured) {
    try {
      const { data: rpcPayload, error: rpcError } = await supabase.rpc(
        'claim_device_sync_code',
        { p_code: code }
      );
      if (!rpcError && rpcPayload && typeof rpcPayload === 'object') {
        const targetUid = (rpcPayload as any)?.user?.id;
        if (isValidUUID(targetUid)) {
          const targetSession = buildAnonymousSupabaseSession(
            targetUid,
            (rpcPayload as any)?.user?.created_at,
            (rpcPayload as any)?.access_token
          );
          const { data: syncedData } = await fetchUserWorkspaceData(
            targetUid,
            targetSession.access_token
          );
          return {
            ok: true,
            session: targetSession,
            workspace: syncedData,
          };
        }
      }
    } catch {
      // Tiếp tục kiểm tra qua endpoint máy chủ
    }
  }

  try {
    const res = await fetch('/api/device-sync/claim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.ok) {
      return {
        ok: false,
        error:
          data?.error ||
          'Mã ghép nối không tồn tại, đã được sử dụng hoặc đã hết hạn.',
      };
    }

    const ownerUuid = data.ownerUserId || data.session?.user?.id;
    if (!isValidUUID(ownerUuid)) {
      return { ok: false, error: 'Dữ liệu phiên từ mã ghép nối không hợp lệ.' };
    }

    const linkedSession = buildAnonymousSupabaseSession(
      ownerUuid,
      data.session?.user?.created_at,
      data.session?.access_token
    );

    if (data.workspace) {
      saveLocalWorkspaceCache(ownerUuid, data.workspace);
    }

    return {
      ok: true,
      session: linkedSession,
      workspace: data.workspace || null,
    };
  } catch {
    return {
      ok: false,
      error: 'Không thể kết nối tới máy chủ để xác thực mã ghép nối thiết bị.',
    };
  }
}
