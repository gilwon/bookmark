-- Supabase(Postgres) 이전용 스키마 + RLS
-- 로컬 SQLite MVP와 동일 도메인 모델. 적용 전 백업 권장.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  url text not null,
  title text not null,
  description text,
  image text,
  favicon text,
  tags text[] not null default '{}',
  category text,
  created_at timestamptz not null default now()
);

create table if not exists public.github_stars (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  repo_full_name text not null,
  description text,
  language text,
  stars integer not null default 0,
  topics text[] not null default '{}',
  url text not null,
  last_synced timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, repo_full_name)
);

create table if not exists public.custom_pages (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  title text not null,
  content jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 서버 전용 OAuth 토큰 (앱 서버 롤만 접근, 클라이언트 RLS deny)
create table if not exists public.oauth_tokens (
  id text primary key,
  user_id text not null,
  provider text not null,
  access_token_enc text not null,
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);

-- SKILL.md / AGENTS.md / CLAUDE.md / .skill 번들 등 에이전트 지시 문서
create table if not exists public.agent_docs (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  kind text not null default 'other',
  filename text not null,
  title text not null,
  description text,
  content text not null default '',
  -- [{ "filename": "SKILL.md", "content": "..." }, { "filename": "x.skill", "content": "..." }]
  bundle jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_bookmarks_user on public.bookmarks (user_id);
create index if not exists idx_stars_user on public.github_stars (user_id);
create index if not exists idx_pages_user on public.custom_pages (user_id);
create index if not exists idx_oauth_user on public.oauth_tokens (user_id);
create index if not exists idx_agent_docs_user on public.agent_docs (user_id);

-- ---------------------------------------------------------------------------
-- RLS
-- Auth.js 사용 시 JWT의 sub 를 user_id 로 저장한다고 가정.
-- Supabase Auth를 쓸 경우 auth.uid()::text 와 맞추세요.
-- ---------------------------------------------------------------------------

alter table public.bookmarks enable row level security;
alter table public.github_stars enable row level security;
alter table public.custom_pages enable row level security;
alter table public.oauth_tokens enable row level security;
alter table public.agent_docs enable row level security;

-- 기존 정책 재생성 시 충돌 방지
drop policy if exists "bookmarks_select_own" on public.bookmarks;
drop policy if exists "bookmarks_insert_own" on public.bookmarks;
drop policy if exists "bookmarks_update_own" on public.bookmarks;
drop policy if exists "bookmarks_delete_own" on public.bookmarks;

drop policy if exists "stars_select_own" on public.github_stars;
drop policy if exists "stars_insert_own" on public.github_stars;
drop policy if exists "stars_update_own" on public.github_stars;
drop policy if exists "stars_delete_own" on public.github_stars;

drop policy if exists "pages_select_own" on public.custom_pages;
drop policy if exists "pages_insert_own" on public.custom_pages;
drop policy if exists "pages_update_own" on public.custom_pages;
drop policy if exists "pages_delete_own" on public.custom_pages;

drop policy if exists "oauth_tokens_deny_all" on public.oauth_tokens;

drop policy if exists "agent_docs_select_own" on public.agent_docs;
drop policy if exists "agent_docs_insert_own" on public.agent_docs;
drop policy if exists "agent_docs_update_own" on public.agent_docs;
drop policy if exists "agent_docs_delete_own" on public.agent_docs;

-- bookmarks: 본인만 CRUD
create policy "bookmarks_select_own" on public.bookmarks
  for select using (user_id = coalesce(auth.jwt() ->> 'sub', auth.uid()::text));
create policy "bookmarks_insert_own" on public.bookmarks
  for insert with check (user_id = coalesce(auth.jwt() ->> 'sub', auth.uid()::text));
create policy "bookmarks_update_own" on public.bookmarks
  for update using (user_id = coalesce(auth.jwt() ->> 'sub', auth.uid()::text));
create policy "bookmarks_delete_own" on public.bookmarks
  for delete using (user_id = coalesce(auth.jwt() ->> 'sub', auth.uid()::text));

-- github_stars: 본인만 CRUD
create policy "stars_select_own" on public.github_stars
  for select using (user_id = coalesce(auth.jwt() ->> 'sub', auth.uid()::text));
create policy "stars_insert_own" on public.github_stars
  for insert with check (user_id = coalesce(auth.jwt() ->> 'sub', auth.uid()::text));
create policy "stars_update_own" on public.github_stars
  for update using (user_id = coalesce(auth.jwt() ->> 'sub', auth.uid()::text));
create policy "stars_delete_own" on public.github_stars
  for delete using (user_id = coalesce(auth.jwt() ->> 'sub', auth.uid()::text));

-- custom_pages: 본인만 CRUD
create policy "pages_select_own" on public.custom_pages
  for select using (user_id = coalesce(auth.jwt() ->> 'sub', auth.uid()::text));
create policy "pages_insert_own" on public.custom_pages
  for insert with check (user_id = coalesce(auth.jwt() ->> 'sub', auth.uid()::text));
create policy "pages_update_own" on public.custom_pages
  for update using (user_id = coalesce(auth.jwt() ->> 'sub', auth.uid()::text));
create policy "pages_delete_own" on public.custom_pages
  for delete using (user_id = coalesce(auth.jwt() ->> 'sub', auth.uid()::text));

-- oauth_tokens: 클라이언트(anon/authenticated) 접근 전면 거부
-- 서버는 service_role 로만 접근 (RLS bypass)
create policy "oauth_tokens_deny_all" on public.oauth_tokens
  for all using (false) with check (false);

-- agent_docs: 본인만 CRUD
create policy "agent_docs_select_own" on public.agent_docs
  for select using (user_id = coalesce(auth.jwt() ->> 'sub', auth.uid()::text));
create policy "agent_docs_insert_own" on public.agent_docs
  for insert with check (user_id = coalesce(auth.jwt() ->> 'sub', auth.uid()::text));
create policy "agent_docs_update_own" on public.agent_docs
  for update using (user_id = coalesce(auth.jwt() ->> 'sub', auth.uid()::text));
create policy "agent_docs_delete_own" on public.agent_docs
  for delete using (user_id = coalesce(auth.jwt() ->> 'sub', auth.uid()::text));

comment on table public.oauth_tokens is
  'Encrypted OAuth tokens. Access only via service_role from Next.js server.';

comment on table public.agent_docs is
  'Agent instruction markdown files (SKILL.md, AGENTS.md, CLAUDE.md, etc).';
