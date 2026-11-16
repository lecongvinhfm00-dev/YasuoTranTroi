-- ============================================================================
-- LITERATURE STUDIO – VIETNAMESE EDITION
-- FILE: supabase/migrations/001_initial_schema.sql
-- MÔ TẢ: Hệ thống Cơ sở dữ liệu Supabase PostgreSQL hoàn chỉnh phục vụ:
--   1. Xác thực ẩn danh tự động (Supabase Anonymous Auth) & Liên kết đa thiết bị
--   2. Đồng bộ trực tuyến đa thiết bị: Lịch sử đọc, Tiến độ đọc, Ghi chú cá nhân,
--      Sách yêu thích, Tài liệu đã lưu và Cài đặt giọng đọc TTS
--   3. Quản lý thư viện tác phẩm xuất bản, tác giả, thể loại, bài giảng & học liệu
--   4. Bảo mật Row Level Security (RLS) cô lập dữ liệu tuyệt đối theo từng người dùng
-- ============================================================================

create extension if not exists "pgcrypto";

-- ============================================================================
-- PHẦN I. CÁC BẢNG DỮ LIỆU CHÍNH TRÊN SUPABASE POSTGRESQL
-- ============================================================================

-- 1. Bảng profiles: Hồ sơ người dùng liên kết với auth.users(id)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Độc giả Ẩn danh',
  avatar_url text,
  role text not null default 'user' check (role in ('user', 'teacher', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Bảng authors: Danh mục tác giả văn học
create table if not exists public.authors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  biography text default '',
  avatar_url text
);

-- 3. Bảng categories: Danh mục thể loại văn học
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text default ''
);

-- 4. Bảng works: Tác phẩm văn học xuất bản chung trên hệ thống
create table if not exists public.works (
  id uuid primary key default gen_random_uuid(),
  work_key text unique,
  title text not null,
  author_id uuid references public.authors(id) on delete set null,
  category_id uuid references public.categories(id) on delete set null,
  description text default '',
  content text not null,
  cover_image text,
  published boolean not null default false,
  created_at timestamptz not null default now()
);

-- 5. Bảng reading_history: Đồng bộ lịch sử đọc của từng người dùng
create table if not exists public.reading_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  work_id uuid references public.works(id) on delete cascade,
  document_key text not null default 'doc-truyen-kieu',
  document_title text not null default '',
  author_name text not null default '',
  segment_index integer not null default 0,
  total_segments integer not null default 1,
  progress_percent numeric(5, 2) not null default 0,
  last_read_at timestamptz not null default now(),
  unique (user_id, document_key)
);

-- 6. Bảng reading_progress: Đồng bộ tiến độ đọc của từng người dùng
create table if not exists public.reading_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  work_id uuid references public.works(id) on delete cascade,
  document_key text not null default 'doc-truyen-kieu',
  segment_index integer not null default 0,
  total_segments integer not null default 1,
  progress numeric(5, 2) not null default 0 check (progress >= 0 and progress <= 100),
  updated_at timestamptz not null default now(),
  unique (user_id, document_key)
);

-- 7. Bảng favorites: Đồng bộ sách / tác phẩm yêu thích của từng người dùng
create table if not exists public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  work_id uuid references public.works(id) on delete cascade,
  document_key text not null,
  created_at timestamptz not null default now(),
  unique (user_id, document_key)
);

-- 8. Bảng personal_notes: Đồng bộ ghi chú văn học cá nhân của từng người dùng
create table if not exists public.personal_notes (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  document_key text default '',
  document_title text default '',
  title text not null,
  content text not null,
  tags jsonb not null default '[]'::jsonb,
  is_favorite boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

-- 9. Bảng saved_documents: Đồng bộ tài liệu văn học đã lưu / tải lên của từng người dùng
create table if not exists public.saved_documents (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  author text not null default 'Khuyết danh',
  category text not null default 'Tài liệu học tập',
  period text not null default 'Văn học Việt Nam',
  summary text not null default '',
  content text not null,
  tags jsonb not null default '[]'::jsonb,
  is_favorite boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

-- 10. Bảng user_tts_settings: Đồng bộ cài đặt giọng đọc Tiếng Việt (TTS) & giao diện
create table if not exists public.user_tts_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  voice_uri text not null default '',
  rate numeric(4, 2) not null default 1.0,
  pitch numeric(4, 2) not null default 1.0,
  volume numeric(4, 2) not null default 1.0,
  auto_next_segment boolean not null default true,
  auto_scroll boolean not null default true,
  highlight_active boolean not null default true,
  font_size text not null default 'base',
  updated_at timestamptz not null default now()
);

-- 11. Bảng lessons: Bài giảng văn học (Dành cho Giáo viên / Quản trị viên)
create table if not exists public.lessons (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text default '',
  content text not null,
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- 12. Bảng materials: Học liệu & tài liệu tham khảo (Dành cho Giáo viên / Quản trị viên)
create table if not exists public.materials (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text default '',
  file_url text not null,
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- 13. Bảng user_workspace_sync: Snapshot đồng bộ nhanh toàn bộ không gian làm việc theo User ID
create table if not exists public.user_workspace_sync (
  user_id uuid primary key references auth.users(id) on delete cascade,
  last_document_id text not null default 'doc-truyen-kieu',
  last_segment_index integer not null default 0,
  tts_settings_json text not null default '{}',
  personal_notes_json text not null default '[]',
  reading_history_json text not null default '[]',
  reading_progress_json text not null default '{}',
  favorites_json text not null default '[]',
  saved_documents_json text not null default '[]',
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'user_workspace_sync' and column_name = 'reading_progress_json'
  ) then
    alter table public.user_workspace_sync add column reading_progress_json text not null default '{}';
  end if;
end $$;

-- 14. Bảng device_sync_codes: Mã ghép nối một lần (One-Time Pairing Code)
--     cho phép cùng một người dùng chuyển phiên Supabase Auth sang thiết bị thứ 2
--     mà KHÔNG bao giờ gộp nhầm hai tài khoản ẩn danh độc lập.
create table if not exists public.device_sync_codes (
  code text primary key,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  session_payload jsonb not null,
  expires_at timestamptz not null default (now() + interval '15 minutes'),
  claimed boolean not null default false,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- PHẦN II. CHỈ MỤC TỐI ƯU HÓA TRUY VẤN (INDEXES)
-- ============================================================================

create index if not exists idx_profiles_role on public.profiles(role);
create index if not exists idx_authors_name on public.authors(name);
create index if not exists idx_categories_name on public.categories(name);
create index if not exists idx_works_author_id on public.works(author_id);
create index if not exists idx_works_category_id on public.works(category_id);
create index if not exists idx_works_published_created on public.works(published, created_at desc);
create index if not exists idx_reading_history_user_last_read on public.reading_history(user_id, last_read_at desc);
create index if not exists idx_reading_progress_user_updated on public.reading_progress(user_id, updated_at desc);
create index if not exists idx_favorites_user_created on public.favorites(user_id, created_at desc);
create index if not exists idx_personal_notes_user_updated on public.personal_notes(user_id, updated_at desc);
create index if not exists idx_saved_documents_user_updated on public.saved_documents(user_id, updated_at desc);
create index if not exists idx_lessons_teacher_created on public.lessons(teacher_id, created_at desc);
create index if not exists idx_materials_teacher_created on public.materials(teacher_id, created_at desc);
create index if not exists idx_device_sync_codes_owner on public.device_sync_codes(owner_user_id, expires_at);

-- ============================================================================
-- PHẦN III. HÀM BẢO MẬT PHÂN QUYỀN & ĐỒNG BỘ ĐA THIẾT BỊ (SECURITY DEFINER)
-- ============================================================================

create or replace function public.is_anonymous_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false);
$$;

create or replace function public.get_current_user_role()
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_role text;
begin
  if auth.uid() is null then
    return 'anonymous';
  end if;

  if public.is_anonymous_user() then
    return 'user';
  end if;

  select p.role into v_role
  from public.profiles p
  where p.id = auth.uid();

  return coalesce(v_role, 'user');
end;
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select (auth.uid() is not null)
     and (not public.is_anonymous_user())
     and (public.get_current_user_role() = 'admin');
$$;

create or replace function public.is_teacher_or_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select (auth.uid() is not null)
     and (not public.is_anonymous_user())
     and (public.get_current_user_role() in ('teacher', 'admin'));
$$;

-- Trigger bảo vệ bảng profiles: Không cho phép người dùng tự nâng quyền thành admin hoặc teacher
create or replace function public.enforce_profile_role_security()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at := now();

  if public.is_anonymous_user() then
    if tg_op = 'UPDATE' and new.role is distinct from old.role then
      raise exception 'Bảo mật RLS: Tài khoản ẩn danh không được phép thay đổi quyền hạn (role).';
    end if;
    new.role := 'user';
    return new;
  end if;

  if tg_op = 'INSERT' then
    if auth.uid() is not null and not public.is_admin() then
      new.role := 'user';
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.role is distinct from old.role and auth.uid() is not null and not public.is_admin() then
      raise exception 'Bảo mật RLS: Người dùng không được phép tự nâng quyền thành admin hoặc teacher.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_profile_role_security on public.profiles;
create trigger trg_enforce_profile_role_security
  before insert or update on public.profiles
  for each row
  execute function public.enforce_profile_role_security();

-- Trigger tự động tạo bản ghi profiles khi có user mới trong auth.users
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, avatar_url, role, created_at, updated_at)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'display_name',
      'Độc giả #' || upper(right(new.id::text, 6))
    ),
    new.raw_user_meta_data ->> 'avatar_url',
    'user',
    now(),
    now()
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_auth_user();

-- Hàm RPC: Thiết bị 2 nhận phiên đồng bộ thông qua Mã Ghép Nối một lần (One-Time Pairing Code)
create or replace function public.claim_device_sync_code(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_record public.device_sync_codes%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Yêu cầu phiên xác thực hợp lệ để nhận mã ghép nối thiết bị.';
  end if;

  select * into v_record
  from public.device_sync_codes
  where upper(trim(code)) = upper(trim(p_code))
    and claimed = false
    and expires_at > now()
  for update;

  if not found then
    raise exception 'Mã ghép nối thiết bị không tồn tại, đã được sử dụng hoặc đã hết hạn.';
  end if;

  update public.device_sync_codes
  set claimed = true
  where code = v_record.code;

  return v_record.session_payload;
end;
$$;

-- ============================================================================
-- PHẦN IV. BẬT ROW LEVEL SECURITY (RLS) CHO TOÀN BỘ BẢNG
-- ============================================================================

alter table public.profiles enable row level security;
alter table public.authors enable row level security;
alter table public.categories enable row level security;
alter table public.works enable row level security;
alter table public.reading_history enable row level security;
alter table public.reading_progress enable row level security;
alter table public.favorites enable row level security;
alter table public.personal_notes enable row level security;
alter table public.saved_documents enable row level security;
alter table public.user_tts_settings enable row level security;
alter table public.lessons enable row level security;
alter table public.materials enable row level security;
alter table public.user_workspace_sync enable row level security;
alter table public.device_sync_codes enable row level security;

-- ============================================================================
-- PHẦN V. CHÍNH SÁCH BẢO MẬT CHI TIẾT (RLS POLICIES)
--         Đảm bảo dữ liệu của người dùng nào chỉ hiển thị cho đúng người dùng đó
-- ============================================================================

-- 1. profiles
drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin"
  on public.profiles for select
  using (auth.uid() = id or public.is_admin());

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = id and role = 'user');

drop policy if exists "profiles_update_own_or_admin" on public.profiles;
create policy "profiles_update_own_or_admin"
  on public.profiles for update
  using (auth.uid() = id or public.is_admin())
  with check (
    (auth.uid() = id and role = public.get_current_user_role())
    or public.is_admin()
  );

drop policy if exists "profiles_delete_admin_only" on public.profiles;
create policy "profiles_delete_admin_only"
  on public.profiles for delete
  using (public.is_admin());

-- 2. authors
drop policy if exists "authors_select_all" on public.authors;
create policy "authors_select_all"
  on public.authors for select using (true);

drop policy if exists "authors_write_teacher_or_admin" on public.authors;
create policy "authors_write_teacher_or_admin"
  on public.authors for all
  using (public.is_teacher_or_admin())
  with check (public.is_teacher_or_admin());

-- 3. categories
drop policy if exists "categories_select_all" on public.categories;
create policy "categories_select_all"
  on public.categories for select using (true);

drop policy if exists "categories_write_teacher_or_admin" on public.categories;
create policy "categories_write_teacher_or_admin"
  on public.categories for all
  using (public.is_teacher_or_admin())
  with check (public.is_teacher_or_admin());

-- 4. works
drop policy if exists "works_select_published_or_staff" on public.works;
create policy "works_select_published_or_staff"
  on public.works for select
  using (published = true or public.is_teacher_or_admin());

drop policy if exists "works_insert_teacher_or_admin" on public.works;
create policy "works_insert_teacher_or_admin"
  on public.works for insert
  with check (public.is_teacher_or_admin());

drop policy if exists "works_update_teacher_or_admin" on public.works;
create policy "works_update_teacher_or_admin"
  on public.works for update
  using (public.is_teacher_or_admin())
  with check (public.is_teacher_or_admin());

drop policy if exists "works_delete_admin_only" on public.works;
create policy "works_delete_admin_only"
  on public.works for delete
  using (public.is_admin());

-- 5. reading_history (Cô lập tuyệt đối theo auth.uid() = user_id)
drop policy if exists "reading_history_own_access" on public.reading_history;
create policy "reading_history_own_access"
  on public.reading_history for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 6. reading_progress (Cô lập tuyệt đối theo auth.uid() = user_id)
drop policy if exists "reading_progress_own_access" on public.reading_progress;
create policy "reading_progress_own_access"
  on public.reading_progress for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 7. favorites (Cô lập tuyệt đối theo auth.uid() = user_id)
drop policy if exists "favorites_own_access" on public.favorites;
create policy "favorites_own_access"
  on public.favorites for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 8. personal_notes (Cô lập tuyệt đối theo auth.uid() = user_id)
drop policy if exists "personal_notes_own_access" on public.personal_notes;
create policy "personal_notes_own_access"
  on public.personal_notes for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 9. saved_documents (Cô lập tuyệt đối theo auth.uid() = user_id)
drop policy if exists "saved_documents_own_access" on public.saved_documents;
create policy "saved_documents_own_access"
  on public.saved_documents for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 10. user_tts_settings (Cô lập tuyệt đối theo auth.uid() = user_id)
drop policy if exists "user_tts_settings_own_access" on public.user_tts_settings;
create policy "user_tts_settings_own_access"
  on public.user_tts_settings for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 11. lessons
drop policy if exists "lessons_select_authenticated" on public.lessons;
create policy "lessons_select_authenticated"
  on public.lessons for select
  using (auth.uid() is not null);

drop policy if exists "lessons_insert_teacher_or_admin" on public.lessons;
create policy "lessons_insert_teacher_or_admin"
  on public.lessons for insert
  with check (
    public.is_teacher_or_admin()
    and (teacher_id = auth.uid() or public.is_admin())
  );

drop policy if exists "lessons_update_own_teacher_or_admin" on public.lessons;
create policy "lessons_update_own_teacher_or_admin"
  on public.lessons for update
  using (
    public.is_teacher_or_admin()
    and (teacher_id = auth.uid() or public.is_admin())
  )
  with check (
    public.is_teacher_or_admin()
    and (teacher_id = auth.uid() or public.is_admin())
  );

drop policy if exists "lessons_delete_own_teacher_or_admin" on public.lessons;
create policy "lessons_delete_own_teacher_or_admin"
  on public.lessons for delete
  using (
    public.is_teacher_or_admin()
    and (teacher_id = auth.uid() or public.is_admin())
  );

-- 12. materials
drop policy if exists "materials_select_authenticated" on public.materials;
create policy "materials_select_authenticated"
  on public.materials for select
  using (auth.uid() is not null);

drop policy if exists "materials_insert_teacher_or_admin" on public.materials;
create policy "materials_insert_teacher_or_admin"
  on public.materials for insert
  with check (
    public.is_teacher_or_admin()
    and (teacher_id = auth.uid() or public.is_admin())
  );

drop policy if exists "materials_update_own_teacher_or_admin" on public.materials;
create policy "materials_update_own_teacher_or_admin"
  on public.materials for update
  using (
    public.is_teacher_or_admin()
    and (teacher_id = auth.uid() or public.is_admin())
  )
  with check (
    public.is_teacher_or_admin()
    and (teacher_id = auth.uid() or public.is_admin())
  );

drop policy if exists "materials_delete_own_teacher_or_admin" on public.materials;
create policy "materials_delete_own_teacher_or_admin"
  on public.materials for delete
  using (
    public.is_teacher_or_admin()
    and (teacher_id = auth.uid() or public.is_admin())
  );

-- 13. user_workspace_sync (Cô lập tuyệt đối theo auth.uid() = user_id)
drop policy if exists "Users manage own workspace_sync" on public.user_workspace_sync;
drop policy if exists "workspace_sync_own_access" on public.user_workspace_sync;
create policy "workspace_sync_own_access"
  on public.user_workspace_sync for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 14. device_sync_codes (Chỉ chủ sở hữu mới được tạo/xóa mã ghép nối của chính mình)
drop policy if exists "device_sync_codes_own_access" on public.device_sync_codes;
create policy "device_sync_codes_own_access"
  on public.device_sync_codes for all
  using (auth.uid() = owner_user_id)
  with check (auth.uid() = owner_user_id);
