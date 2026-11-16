-- ============================================================================
-- LITERATURE STUDIO – VIETNAMESE EDITION
-- FILE: supabase/migrations/001_initial_schema.sql
-- MÔ TẢ: Thiết kế hệ thống Cơ sở dữ liệu PostgreSQL hoàn chỉnh trên Supabase
--        tích hợp Supabase Anonymous Auth, phân quyền bảo mật (user / teacher / admin)
--        và chính sách Row Level Security (RLS) nghiêm ngặt.
-- NGUYÊN TẮC AN TOÀN:
--   1. Kiểm tra bảng/cột hiện có trước khi tạo (IF NOT EXISTS), không tạo bảng trùng lặp.
--   2. Không xóa bất kỳ bảng hoặc dữ liệu hiện tại nào (không dùng DROP TABLE / TRUNCATE).
--   3. Không tự tạo dữ liệu giả (seed data).
--   4. Khóa chặt quyền tài khoản ẩn danh (is_anonymous = true -> chỉ có role = 'user').
-- ============================================================================

-- Kích hoạt tiện ích sinh UUID chuẩn của PostgreSQL
create extension if not exists "pgcrypto";

-- ============================================================================
-- PHẦN I. KHỞI TẠO CÁC BẢNG DỮ LIỆU CHÍNH (9 BẢNG CHUẨN + BẢNG ĐỒNG BỘ WORKSPACE)
-- ============================================================================

-- 1. Bảng profiles: Hồ sơ người dùng liên kết trực tiếp với auth.users(id)
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

-- 3. Bảng categories: Danh mục thể loại / giai đoạn văn học
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text default ''
);

-- 4. Bảng works: Tác phẩm văn học trong thư viện
create table if not exists public.works (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  author_id uuid references public.authors(id) on delete set null,
  category_id uuid references public.categories(id) on delete set null,
  description text default '',
  content text not null,
  cover_image text,
  published boolean not null default false,
  created_at timestamptz not null default now()
);

-- 5. Bảng reading_history: Lịch sử đọc tác phẩm của từng người dùng
-- (Nếu bảng reading_history từ phiên bản cũ tồn tại, bổ sung cột chuẩn an toàn mà không xóa dữ liệu)
create table if not exists public.reading_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  work_id uuid not null references public.works(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  unique (user_id, work_id)
);

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'reading_history' and column_name = 'work_id'
  ) then
    alter table public.reading_history add column work_id uuid references public.works(id) on delete cascade;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'reading_history' and column_name = 'last_read_at'
  ) then
    alter table public.reading_history add column last_read_at timestamptz not null default now();
  end if;
end $$;

-- 6. Bảng reading_progress: Tiến độ đọc tác phẩm (0% -> 100%) của từng người dùng
create table if not exists public.reading_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  work_id uuid not null references public.works(id) on delete cascade,
  progress numeric(5, 2) not null default 0 check (progress >= 0 and progress <= 100),
  updated_at timestamptz not null default now(),
  unique (user_id, work_id)
);

-- 7. Bảng favorites: Danh sách tác phẩm yêu thích của từng người dùng
create table if not exists public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  work_id uuid not null references public.works(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, work_id)
);

-- 8. Bảng lessons: Bài giảng văn học do Giáo viên (teacher) hoặc Quản trị viên (admin) biên soạn
create table if not exists public.lessons (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text default '',
  content text not null,
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- 9. Bảng materials: Học liệu, tài liệu tham khảo & tệp đính kèm của Giáo viên / Quản trị viên
create table if not exists public.materials (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text default '',
  file_url text not null,
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- 10. Bảng bổ trợ user_workspace_sync: Đồng bộ nhanh trạng thái không gian làm việc (TTS, vị trí đoạn đọc, ghi chú cá nhân)
create table if not exists public.user_workspace_sync (
  user_id uuid primary key references auth.users(id) on delete cascade,
  last_document_id text not null default 'doc-truyen-kieu',
  last_segment_index integer not null default 0,
  tts_settings_json text not null default '{}',
  personal_notes_json text not null default '[]',
  reading_history_json text not null default '[]',
  favorites_json text not null default '[]',
  saved_documents_json text not null default '[]',
  updated_at timestamptz not null default now()
);

-- ============================================================================
-- PHẦN II. CHỈ MỤC TỐI ƯU TRUY VẤN (INDEXES)
-- ============================================================================

create index if not exists idx_profiles_role on public.profiles(role);
create index if not exists idx_authors_name on public.authors(name);
create index if not exists idx_categories_name on public.categories(name);
create index if not exists idx_works_author_id on public.works(author_id);
create index if not exists idx_works_category_id on public.works(category_id);
create index if not exists idx_works_published_created on public.works(published, created_at desc);
create index if not exists idx_reading_history_user_last_read on public.reading_history(user_id, last_read_at desc);
create index if not exists idx_reading_history_work_id on public.reading_history(work_id);
create index if not exists idx_reading_progress_user_work on public.reading_progress(user_id, work_id);
create index if not exists idx_favorites_user_created on public.favorites(user_id, created_at desc);
create index if not exists idx_favorites_work_id on public.favorites(work_id);
create index if not exists idx_lessons_teacher_created on public.lessons(teacher_id, created_at desc);
create index if not exists idx_materials_teacher_created on public.materials(teacher_id, created_at desc);

-- ============================================================================
-- PHẦN III. HÀM BẢO MẬT PHÂN QUYỀN & CHỐNG LEO THANG ĐẶC QUYỀN (SECURITY DEFINER)
-- ============================================================================

-- 1. Kiểm tra xem phiên JWT hiện tại có phải là tài khoản ẩn danh (Supabase Anonymous Auth) hay không
create or replace function public.is_anonymous_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false);
$$;

-- 2. Lấy role thực tế của người dùng hiện tại:
--    Nếu là tài khoản ẩn danh (is_anonymous = true), LUÔN LUÔN trả về 'user'
--    (Tuyệt đối không bao giờ cấp quyền admin hoặc teacher cho tài khoản ẩn danh).
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

-- 3. Kiểm tra quyền Quản trị viên (Admin):
--    Bắt buộc không phải tài khoản ẩn danh VÀ có role = 'admin' trong bảng profiles.
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

-- 4. Kiểm tra quyền Giáo viên hoặc Quản trị viên (Teacher / Admin):
--    Bắt buộc không phải tài khoản ẩn danh VÀ có role thuộc ('teacher', 'admin').
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

-- 5. Trigger bảo vệ bảng profiles:
--    - Không cho phép người dùng tự tạo profile với role = 'admin' hoặc 'teacher'.
--    - Không cho phép người dùng tự cập nhật cột role của chính mình.
--    - Tài khoản ẩn danh luôn bị khóa cứng ở role = 'user'.
create or replace function public.enforce_profile_role_security()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at := now();

  -- Nếu là tài khoản ẩn danh, bắt buộc role luôn là 'user'
  if public.is_anonymous_user() then
    if tg_op = 'UPDATE' and new.role is distinct from old.role then
      raise exception 'Bảo mật RLS: Tài khoản ẩn danh không được phép thay đổi quyền hạn (role).';
    end if;
    new.role := 'user';
    return new;
  end if;

  -- Khi INSERT từ phía client (auth.uid() khác null và không phải admin): khóa role = 'user'
  if tg_op = 'INSERT' then
    if auth.uid() is not null and not public.is_admin() then
      new.role := 'user';
    end if;
    return new;
  end if;

  -- Khi UPDATE từ phía client: chỉ Admin mới được phép thay đổi giá trị cột role
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

-- 6. Trigger tự động khởi tạo dòng tương ứng trong public.profiles khi có user mới trong auth.users
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

-- ============================================================================
-- PHẦN IV. BẬT ROW LEVEL SECURITY (RLS) CHO TẤT CẢ CÁC BẢNG
-- ============================================================================

alter table public.profiles enable row level security;
alter table public.authors enable row level security;
alter table public.categories enable row level security;
alter table public.works enable row level security;
alter table public.reading_history enable row level security;
alter table public.reading_progress enable row level security;
alter table public.favorites enable row level security;
alter table public.lessons enable row level security;
alter table public.materials enable row level security;
alter table public.user_workspace_sync enable row level security;

-- ============================================================================
-- PHẦN V. CHÍNH SÁCH BẢO MẬT CHI TIẾT (RLS POLICIES)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Chính sách cho bảng public.profiles
--    - Người dùng (kể cả ẩn danh) chỉ được xem, tạo và cập nhật hồ sơ của chính mình.
--    - Admin chính thức được phép xem và quản lý toàn bộ hồ sơ.
-- ----------------------------------------------------------------------------
drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin"
  on public.profiles
  for select
  using (auth.uid() = id or public.is_admin());

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles
  for insert
  with check (auth.uid() = id and role = 'user');

drop policy if exists "profiles_update_own_or_admin" on public.profiles;
create policy "profiles_update_own_or_admin"
  on public.profiles
  for update
  using (auth.uid() = id or public.is_admin())
  with check (
    (auth.uid() = id and role = public.get_current_user_role())
    or public.is_admin()
  );

drop policy if exists "profiles_delete_admin_only" on public.profiles;
create policy "profiles_delete_admin_only"
  on public.profiles
  for delete
  using (public.is_admin());

-- ----------------------------------------------------------------------------
-- 2. Chính sách cho bảng public.authors
--    - Mọi người dùng đã xác thực (bao gồm ẩn danh) được đọc thông tin tác giả.
--    - Chỉ Teacher hoặc Admin (không phải ẩn danh) mới được thêm / sửa / xóa tác giả.
-- ----------------------------------------------------------------------------
drop policy if exists "authors_select_all" on public.authors;
create policy "authors_select_all"
  on public.authors
  for select
  using (true);

drop policy if exists "authors_write_teacher_or_admin" on public.authors;
create policy "authors_write_teacher_or_admin"
  on public.authors
  for all
  using (public.is_teacher_or_admin())
  with check (public.is_teacher_or_admin());

-- ----------------------------------------------------------------------------
-- 3. Chính sách cho bảng public.categories
--    - Mọi người dùng được đọc danh mục thể loại.
--    - Chỉ Teacher hoặc Admin (không phải ẩn danh) mới được thêm / sửa / xóa thể loại.
-- ----------------------------------------------------------------------------
drop policy if exists "categories_select_all" on public.categories;
create policy "categories_select_all"
  on public.categories
  for select
  using (true);

drop policy if exists "categories_write_teacher_or_admin" on public.categories;
create policy "categories_write_teacher_or_admin"
  on public.categories
  for all
  using (public.is_teacher_or_admin())
  with check (public.is_teacher_or_admin());

-- ----------------------------------------------------------------------------
-- 4. Chính sách cho bảng public.works
--    - Người dùng (kể cả ẩn danh) chỉ được đọc các tác phẩm đã xuất bản (published = true).
--    - Teacher và Admin (không phải ẩn danh) được xem cả bản nháp và quản lý tác phẩm.
-- ----------------------------------------------------------------------------
drop policy if exists "works_select_published_or_staff" on public.works;
create policy "works_select_published_or_staff"
  on public.works
  for select
  using (published = true or public.is_teacher_or_admin());

drop policy if exists "works_insert_teacher_or_admin" on public.works;
create policy "works_insert_teacher_or_admin"
  on public.works
  for insert
  with check (public.is_teacher_or_admin());

drop policy if exists "works_update_teacher_or_admin" on public.works;
create policy "works_update_teacher_or_admin"
  on public.works
  for update
  using (public.is_teacher_or_admin())
  with check (public.is_teacher_or_admin());

drop policy if exists "works_delete_admin_only" on public.works;
create policy "works_delete_admin_only"
  on public.works
  for delete
  using (public.is_admin());

-- ----------------------------------------------------------------------------
-- 5. Chính sách cho bảng public.reading_history
--    - Tài khoản ẩn danh và người dùng chỉ được truy cập lịch sử đọc của chính mình (auth.uid() = user_id).
-- ----------------------------------------------------------------------------
drop policy if exists "reading_history_own_access" on public.reading_history;
create policy "reading_history_own_access"
  on public.reading_history
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- 6. Chính sách cho bảng public.reading_progress
--    - Tài khoản ẩn danh và người dùng chỉ được xem / cập nhật tiến độ đọc của chính mình.
-- ----------------------------------------------------------------------------
drop policy if exists "reading_progress_own_access" on public.reading_progress;
create policy "reading_progress_own_access"
  on public.reading_progress
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- 7. Chính sách cho bảng public.favorites
--    - Tài khoản ẩn danh và người dùng chỉ được xem / thêm / xóa danh sách yêu thích của chính mình.
-- ----------------------------------------------------------------------------
drop policy if exists "favorites_own_access" on public.favorites;
create policy "favorites_own_access"
  on public.favorites
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- 8. Chính sách cho bảng public.lessons
--    - Độc giả đã xác thực (kể cả ẩn danh) được xem bài giảng.
--    - Chỉ Teacher (sở hữu bài giảng: teacher_id = auth.uid()) hoặc Admin mới được tạo / sửa / xóa.
--    - Tài khoản ẩn danh tuyệt đối không được tạo, sửa hay xóa bài giảng.
-- ----------------------------------------------------------------------------
drop policy if exists "lessons_select_authenticated" on public.lessons;
create policy "lessons_select_authenticated"
  on public.lessons
  for select
  using (auth.uid() is not null);

drop policy if exists "lessons_insert_teacher_or_admin" on public.lessons;
create policy "lessons_insert_teacher_or_admin"
  on public.lessons
  for insert
  with check (
    public.is_teacher_or_admin()
    and (teacher_id = auth.uid() or public.is_admin())
  );

drop policy if exists "lessons_update_own_teacher_or_admin" on public.lessons;
create policy "lessons_update_own_teacher_or_admin"
  on public.lessons
  for update
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
  on public.lessons
  for delete
  using (
    public.is_teacher_or_admin()
    and (teacher_id = auth.uid() or public.is_admin())
  );

-- ----------------------------------------------------------------------------
-- 9. Chính sách cho bảng public.materials
--    - Độc giả đã xác thực (kể cả ẩn danh) được xem / tải học liệu.
--    - Chỉ Teacher (teacher_id = auth.uid()) hoặc Admin mới được đăng tải / cập nhật / xóa học liệu.
--    - Tài khoản ẩn danh tuyệt đối không được phép thêm, sửa, xóa học liệu.
-- ----------------------------------------------------------------------------
drop policy if exists "materials_select_authenticated" on public.materials;
create policy "materials_select_authenticated"
  on public.materials
  for select
  using (auth.uid() is not null);

drop policy if exists "materials_insert_teacher_or_admin" on public.materials;
create policy "materials_insert_teacher_or_admin"
  on public.materials
  for insert
  with check (
    public.is_teacher_or_admin()
    and (teacher_id = auth.uid() or public.is_admin())
  );

drop policy if exists "materials_update_own_teacher_or_admin" on public.materials;
create policy "materials_update_own_teacher_or_admin"
  on public.materials
  for update
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
  on public.materials
  for delete
  using (
    public.is_teacher_or_admin()
    and (teacher_id = auth.uid() or public.is_admin())
  );

-- ----------------------------------------------------------------------------
-- 10. Chính sách cho bảng public.user_workspace_sync
--     - Tài khoản ẩn danh chỉ được đọc / ghi dữ liệu không gian làm việc của chính mình.
-- ----------------------------------------------------------------------------
drop policy if exists "Users manage own workspace_sync" on public.user_workspace_sync;
drop policy if exists "workspace_sync_own_access" on public.user_workspace_sync;
create policy "workspace_sync_own_access"
  on public.user_workspace_sync
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
