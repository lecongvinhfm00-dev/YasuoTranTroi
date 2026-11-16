import { supabase, isSupabaseConfigured, isValidUUID } from './supabase';
import type {
  LiteratureDocument,
  PersonalNoteItem,
  PlaylistItem,
  ReadingHistoryItem,
  StudioSettings,
  TTSSettingsConfig,
} from '../types/studio';

// ============================================================================
// ĐỊNH NGHĨA KIỂU DỮ LIỆU ĐỐI CHIẾU CHÍNH XÁC VỚI 9 BẢNG TRONG SUPABASE SCHEMA
// (supabase/migrations/001_initial_schema.sql)
// ============================================================================

export interface SupabaseProfileRow {
  id: string; // UUID liên kết auth.users(id)
  display_name: string;
  avatar_url: string | null;
  role: 'user' | 'teacher' | 'admin';
  created_at: string;
  updated_at: string;
}

export interface SupabaseAuthorRow {
  id: string;
  name: string;
  biography: string | null;
  avatar_url: string | null;
}

export interface SupabaseCategoryRow {
  id: string;
  name: string;
  description: string | null;
}

export interface SupabaseWorkRow {
  id: string;
  title: string;
  author_id: string | null;
  category_id: string | null;
  description: string | null;
  content: string;
  cover_image: string | null;
  published: boolean;
  created_at: string;
  authors?: SupabaseAuthorRow | null;
  categories?: SupabaseCategoryRow | null;
}

export interface SupabaseReadingHistoryRow {
  id: string;
  user_id: string;
  work_id: string;
  last_read_at: string;
}

export interface SupabaseReadingProgressRow {
  id: string;
  user_id: string;
  work_id: string;
  progress: number;
  updated_at: string;
}

export interface SupabaseFavoriteRow {
  id: string;
  user_id: string;
  work_id: string;
  created_at: string;
}

export interface SupabaseLessonRow {
  id: string;
  title: string;
  description: string | null;
  content: string;
  teacher_id: string;
  created_at: string;
}

export interface SupabaseMaterialRow {
  id: string;
  title: string;
  description: string | null;
  file_url: string;
  teacher_id: string;
  created_at: string;
}

export interface UserWorkspaceBundle {
  lastDocumentId: string;
  lastSegmentIndex: number;
  ttsSettings: TTSSettingsConfig;
  personalNotes: PersonalNoteItem[];
  readingHistory: ReadingHistoryItem[];
  favorites: string[];
  savedDocuments: LiteratureDocument[];
  playlists?: PlaylistItem[];
  settings?: Partial<StudioSettings>;
  updatedAt?: string;
}

const LOCAL_WORKSPACE_CACHE_PREFIX = 'literature_studio_workspace_v2_';

export function loadLocalWorkspaceCache(uid: string): Partial<UserWorkspaceBundle> | null {
  try {
    const raw = localStorage.getItem(`${LOCAL_WORKSPACE_CACHE_PREFIX}${uid}`);
    if (!raw) return null;
    return JSON.parse(raw) as Partial<UserWorkspaceBundle>;
  } catch {
    return null;
  }
}

export function saveLocalWorkspaceCache(uid: string, bundle: Partial<UserWorkspaceBundle>): void {
  try {
    const existing = loadLocalWorkspaceCache(uid) || {};
    const merged = {
      ...existing,
      ...bundle,
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(`${LOCAL_WORKSPACE_CACHE_PREFIX}${uid}`, JSON.stringify(merged));
  } catch {
    // Bỏ qua lỗi hạn mức localStorage
  }
}

// ============================================================================
// CÁC HÀM TRUY VẤN TƯƠNG THÍCH VỚI 9 BẢNG TRÊN SUPABASE POSTGRESQL
// ============================================================================

/**
 * 1. Truy vấn hồ sơ người dùng từ bảng `public.profiles` theo UUID (`session.user.id`).
 *    Đảm bảo tài khoản ẩn danh luôn chỉ có role = 'user'.
 */
export async function fetchMySupabaseProfile(userId: string): Promise<SupabaseProfileRow | null> {
  if (!isSupabaseConfigured || !isValidUUID(userId)) return null;
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, display_name, avatar_url, role, created_at, updated_at')
      .eq('id', userId)
      .maybeSingle();

    if (error || !data) return null;
    return data as SupabaseProfileRow;
  } catch {
    return null;
  }
}

/**
 * 2. Lấy danh sách các tác phẩm đã xuất bản (`published = true`) từ bảng `public.works`
 *    kèm thông tin tác giả (`public.authors`) và thể loại (`public.categories`).
 */
export async function fetchPublishedWorksFromSupabase(): Promise<SupabaseWorkRow[]> {
  if (!isSupabaseConfigured) return [];
  try {
    const { data, error } = await supabase
      .from('works')
      .select(
        'id, title, author_id, category_id, description, content, cover_image, published, created_at, authors(id, name, biography, avatar_url), categories(id, name, description)'
      )
      .eq('published', true)
      .order('created_at', { ascending: false });

    if (error || !Array.isArray(data)) return [];
    return data as unknown as SupabaseWorkRow[];
  } catch {
    return [];
  }
}

/**
 * 3. Cập nhật lịch sử đọc (`public.reading_history`) và tiến độ đọc (`public.reading_progress`)
 *    của người dùng hiện tại (`user_id = session.user.id`) khi work_id là UUID.
 */
export async function syncReadingProgressToSupabaseTables(
  userId: string,
  workId: string,
  progressPercent: number
): Promise<void> {
  if (!isSupabaseConfigured || !isValidUUID(userId) || !isValidUUID(workId)) return;
  const nowIso = new Date().toISOString();
  const clampedProgress = Math.max(0, Math.min(100, Number(progressPercent.toFixed(2))));

  try {
    await Promise.all([
      supabase.from('reading_history').upsert(
        {
          user_id: userId,
          work_id: workId,
          last_read_at: nowIso,
        },
        { onConflict: 'user_id,work_id' }
      ),
      supabase.from('reading_progress').upsert(
        {
          user_id: userId,
          work_id: workId,
          progress: clampedProgress,
          updated_at: nowIso,
        },
        { onConflict: 'user_id,work_id' }
      ),
    ]);
  } catch {
    // Bỏ qua lỗi mạng nền
  }
}

/**
 * 4. Thêm hoặc xóa tác phẩm yêu thích trong bảng `public.favorites` (`user_id = session.user.id`).
 */
export async function toggleFavoriteWorkInSupabase(
  userId: string,
  workId: string,
  isFavorited: boolean
): Promise<void> {
  if (!isSupabaseConfigured || !isValidUUID(userId) || !isValidUUID(workId)) return;
  try {
    if (isFavorited) {
      await supabase.from('favorites').upsert(
        {
          user_id: userId,
          work_id: workId,
          created_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,work_id' }
      );
    } else {
      await supabase
        .from('favorites')
        .delete()
        .eq('user_id', userId)
        .eq('work_id', workId);
    }
  } catch {
    // Bỏ qua lỗi mạng nền
  }
}

/**
 * 5. Truy vấn danh sách bài giảng (`public.lessons`) và học liệu (`public.materials`).
 */
export async function fetchLessonsAndMaterialsFromSupabase(): Promise<{
  lessons: SupabaseLessonRow[];
  materials: SupabaseMaterialRow[];
}> {
  if (!isSupabaseConfigured) return { lessons: [], materials: [] };
  try {
    const [lessonsRes, materialsRes] = await Promise.all([
      supabase
        .from('lessons')
        .select('id, title, description, content, teacher_id, created_at')
        .order('created_at', { ascending: false }),
      supabase
        .from('materials')
        .select('id, title, description, file_url, teacher_id, created_at')
        .order('created_at', { ascending: false }),
    ]);

    return {
      lessons: (lessonsRes.data as SupabaseLessonRow[]) || [],
      materials: (materialsRes.data as SupabaseMaterialRow[]) || [],
    };
  } catch {
    return { lessons: [], materials: [] };
  }
}

/**
 * Tải dữ liệu cá nhân hóa theo UUID (`session.user.id`) từ Supabase hoặc Cloud SQL PostgreSQL (/api/user-data).
 */
export async function fetchUserWorkspaceData(
  uid: string,
  token: string
): Promise<{
  data: Partial<UserWorkspaceBundle> | null;
  source: 'supabase' | 'cloudsql' | 'local';
}> {
  if (isSupabaseConfigured && isValidUUID(uid)) {
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
      // Fallback sang máy chủ Cloud SQL
    }
  }

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
        return { data: payload.workspace, source: 'cloudsql' };
      }
    }
  } catch {
    // Giữ nguyên dữ liệu cục bộ khi mạng lỗi
  }

  return { data: loadLocalWorkspaceCache(uid), source: 'local' };
}

/**
 * Đồng bộ dữ liệu cá nhân hóa của người dùng theo UUID (`session.user.id`).
 */
export async function syncUserWorkspaceData(
  uid: string,
  token: string,
  bundle: Partial<UserWorkspaceBundle>
): Promise<{ ok: boolean; syncedAt: string }> {
  const nowIso = new Date().toISOString();
  saveLocalWorkspaceCache(uid, bundle);

  if (isSupabaseConfigured && isValidUUID(uid)) {
    try {
      const row: Record<string, unknown> = {
        user_id: uid,
        updated_at: nowIso,
      };
      if (bundle.lastDocumentId !== undefined) row.last_document_id = bundle.lastDocumentId;
      if (bundle.lastSegmentIndex !== undefined) row.last_segment_index = bundle.lastSegmentIndex;
      if (bundle.ttsSettings !== undefined)
        row.tts_settings_json = JSON.stringify(bundle.ttsSettings);
      if (bundle.personalNotes !== undefined)
        row.personal_notes_json = JSON.stringify(bundle.personalNotes);
      if (bundle.readingHistory !== undefined)
        row.reading_history_json = JSON.stringify(bundle.readingHistory);
      if (bundle.favorites !== undefined) row.favorites_json = JSON.stringify(bundle.favorites);
      if (bundle.savedDocuments !== undefined)
        row.saved_documents_json = JSON.stringify(bundle.savedDocuments);

      const { error } = await supabase
        .from('user_workspace_sync')
        .upsert(row, { onConflict: 'user_id' });
      if (!error) {
        return { ok: true, syncedAt: nowIso };
      }
    } catch {
      // Tiếp tục đồng bộ qua API Cloud SQL
    }
  }

  try {
    const res = await fetch('/api/user-data', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(bundle),
    });
    if (res.ok) {
      return { ok: true, syncedAt: nowIso };
    }
  } catch {
    // Báo lỗi đồng bộ để UI hiển thị đúng trạng thái
  }

  return { ok: false, syncedAt: nowIso };
}
