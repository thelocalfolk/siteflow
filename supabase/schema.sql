-- SiteFlow Phase 1 Schema
-- Run this in the Supabase SQL editor for your project

-- ============================================================
-- TABLES
-- ============================================================

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  phone text,
  role text not null default 'worker' check (role in ('manager', 'worker')),
  status text not null default 'pending' check (status in ('pending', 'active', 'removed')),
  trade_tags text[] default '{}',
  on_shift boolean not null default false,
  avatar_color text not null default '#3B82F6',
  created_at timestamptz not null default now()
);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references profiles(id) on delete cascade,
  body text,
  photo_url text,
  created_at timestamptz not null default now(),
  check (body is not null or photo_url is not null)
);

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  location text,
  priority text not null default 'medium' check (priority in ('low', 'medium', 'urgent')),
  status text not null default 'unassigned' check (status in ('unassigned', 'assigned', 'in_progress', 'blocked', 'done')),
  assignee_id uuid references profiles(id) on delete set null,
  accepted boolean not null default false,
  due_at timestamptz,
  source_message_id uuid references messages(id) on delete set null,
  created_by uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references messages(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  emoji text not null,
  unique (message_id, user_id, emoji)
);

create table if not exists task_photos (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  url text not null,
  kind text not null check (kind in ('before', 'after', 'issue')),
  uploaded_by uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists task_activity (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  author_id uuid references profiles(id) on delete set null,
  type text not null check (type in ('comment', 'system')),
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  type text not null check (type in ('assigned', 'mention', 'urgent', 'completed')),
  body text not null,
  task_id uuid references tasks(id) on delete cascade,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

-- ============================================================
-- ROW-LEVEL SECURITY
-- ============================================================

alter table profiles enable row level security;
alter table messages enable row level security;
alter table tasks enable row level security;
alter table reactions enable row level security;
alter table task_photos enable row level security;
alter table task_activity enable row level security;
alter table notifications enable row level security;

-- Helper: get the calling user's role and status
create or replace function auth_profile_role() returns text
  language sql stable security definer
  as $$ select role from profiles where id = auth.uid() $$;

create or replace function auth_profile_status() returns text
  language sql stable security definer
  as $$ select status from profiles where id = auth.uid() $$;

-- ---- profiles ----
-- Any signed-in user can read their own profile (needed for pending screen)
create policy "users read own profile"
  on profiles for select
  using (id = auth.uid());

-- Active users can read other active profiles
create policy "active users read active profiles"
  on profiles for select
  using (auth_profile_status() = 'active' and status = 'active');

-- Users insert their own profile (happens at sign-up)
create policy "users insert own profile"
  on profiles for insert
  with check (id = auth.uid());

-- Managers can update any profile (approve, remove, change role)
create policy "managers update profiles"
  on profiles for update
  using (auth_profile_role() = 'manager');

-- Users can update their own non-privileged fields (name, trade_tags, on_shift, avatar_color)
create policy "users update own profile"
  on profiles for update
  using (id = auth.uid());

-- ---- messages ----
create policy "active users read messages"
  on messages for select
  using (auth_profile_status() = 'active');

create policy "active users insert messages"
  on messages for insert
  with check (auth_profile_status() = 'active' and sender_id = auth.uid());

-- ---- reactions ----
create policy "active users read reactions"
  on reactions for select
  using (auth_profile_status() = 'active');

create policy "active users manage own reactions"
  on reactions for all
  using (auth_profile_status() = 'active' and user_id = auth.uid())
  with check (auth_profile_status() = 'active' and user_id = auth.uid());

-- ---- tasks ----
create policy "active users read tasks"
  on tasks for select
  using (auth_profile_status() = 'active');

-- Managers can insert/update any task
create policy "managers manage tasks"
  on tasks for all
  using (auth_profile_role() = 'manager')
  with check (auth_profile_role() = 'manager');

-- Workers can update tasks assigned to them (accept, status, etc.)
create policy "workers update assigned tasks"
  on tasks for update
  using (
    auth_profile_status() = 'active'
    and auth_profile_role() = 'worker'
    and assignee_id = auth.uid()
  );

-- Active workers can create tasks too (managers can reassign)
create policy "active workers create tasks"
  on tasks for insert
  with check (auth_profile_status() = 'active' and created_by = auth.uid());

-- ---- task_photos ----
create policy "active users read task photos"
  on task_photos for select
  using (auth_profile_status() = 'active');

create policy "active users insert task photos"
  on task_photos for insert
  with check (auth_profile_status() = 'active' and uploaded_by = auth.uid());

-- ---- task_activity ----
create policy "active users read activity"
  on task_activity for select
  using (auth_profile_status() = 'active');

create policy "active users insert activity"
  on task_activity for insert
  with check (auth_profile_status() = 'active');

-- ---- notifications ----
create policy "users read own notifications"
  on notifications for select
  using (user_id = auth.uid());

create policy "system insert notifications"
  on notifications for insert
  with check (true); -- written by server-side logic; lock down further if using edge functions

create policy "users update own notifications"
  on notifications for update
  using (user_id = auth.uid());

-- ============================================================
-- SEED (optional — run separately to add test data)
-- See supabase/seed.sql
-- ============================================================
