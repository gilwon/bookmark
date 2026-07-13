-- MyMark Supabase/Postgres 스키마 (앱 코드와 동일: text JSON 문자열)
-- Supabase Dashboard → SQL Editor 에서 실행하세요.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Tables (id 는 앱에서 uuid 문자열로 생성)
-- ---------------------------------------------------------------------------

create table if not exists public.bookmarks (
  id text primary key,
  user_id text not null,
  url text not null,
  title text not null,
  description text,
  image text,
  favicon text,
  tags text not null default '[]',
  category text,
  is_favorite integer not null default 0,
  created_at text not null
);

create table if not exists public.categories (
  id text primary key,
  user_id text not null,
  name text not null,
  created_at text not null,
  updated_at text not null,
  unique (user_id, name)
);

create table if not exists public.github_stars (
  id text primary key,
  user_id text not null,
  repo_full_name text not null,
  description text,
  language text,
  stars integer not null default 0,
  topics text not null default '[]',
  url text not null,
  last_synced text not null,
  created_at text not null,
  change_kind text,
  stars_delta integer not null default 0,
  changed_at text,
  source text not null default 'sync',
  unique (user_id, repo_full_name)
);

-- 북마크 URL 중복 방지 (동일 user+url)
create unique index if not exists idx_bookmarks_user_url
  on public.bookmarks (user_id, url);

-- 기존 프로젝트 마이그레이션 (이미 테이블 있으면 경우 SQL Editor에서 실행)
alter table public.github_stars add column if not exists change_kind text;
alter table public.github_stars add column if not exists stars_delta integer not null default 0;
alter table public.github_stars add column if not exists changed_at text;
alter table public.github_stars add column if not exists source text not null default 'sync';

create table if not exists public.custom_pages (
  id text primary key,
  user_id text not null,
  title text not null,
  content text not null default '{}',
  created_at text not null,
  updated_at text not null
);

create table if not exists public.oauth_tokens (
  id text primary key,
  user_id text not null,
  provider text not null,
  access_token_enc text not null,
  updated_at text not null,
  unique (user_id, provider)
);

create table if not exists public.agent_docs (
  id text primary key,
  user_id text not null,
  kind text not null default 'other',
  filename text not null,
  title text not null,
  description text,
  content text not null default '',
  bundle text not null default '[]',
  created_at text not null,
  updated_at text not null
);

create table if not exists public.prompts (
  id text primary key,
  user_id text not null,
  title text not null,
  category text,
  summary text,
  when_to_use text,
  sections text not null default '[]',
  is_favorite integer not null default 0,
  created_at text not null,
  updated_at text not null
);

-- 기존 프로젝트: 즐겨찾기 컬럼
alter table public.bookmarks add column if not exists is_favorite integer not null default 0;
alter table public.prompts add column if not exists is_favorite integer not null default 0;

create index if not exists idx_bookmarks_user on public.bookmarks (user_id);
create index if not exists idx_categories_user on public.categories (user_id);
create index if not exists idx_stars_user on public.github_stars (user_id);
create index if not exists idx_stars_repo on public.github_stars (user_id, repo_full_name);
create index if not exists idx_pages_user on public.custom_pages (user_id);
create index if not exists idx_oauth_user on public.oauth_tokens (user_id);
create index if not exists idx_agent_docs_user on public.agent_docs (user_id);
create index if not exists idx_agent_docs_kind on public.agent_docs (user_id, kind);
create index if not exists idx_prompts_user on public.prompts (user_id);

-- ---------------------------------------------------------------------------
-- RLS
-- 앱 서버는 DATABASE_URL(또는 service_role) 로 접속하므로 RLS 를 우회합니다.
-- 브라우저에서 anon key 로 직접 접근할 때만 정책이 적용됩니다.
-- Auth.js user.id 를 user_id 로 저장합니다.
-- ---------------------------------------------------------------------------

alter table public.bookmarks enable row level security;
alter table public.categories enable row level security;
alter table public.github_stars enable row level security;
alter table public.custom_pages enable row level security;
alter table public.oauth_tokens enable row level security;
alter table public.agent_docs enable row level security;
alter table public.prompts enable row level security;

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

create policy "bookmarks_select_own" on public.bookmarks
  for select using (user_id = coalesce(auth.jwt() ->> 'sub', auth.uid()::text));
create policy "bookmarks_insert_own" on public.bookmarks
  for insert with check (user_id = coalesce(auth.jwt() ->> 'sub', auth.uid()::text));
create policy "bookmarks_update_own" on public.bookmarks
  for update using (user_id = coalesce(auth.jwt() ->> 'sub', auth.uid()::text));
create policy "bookmarks_delete_own" on public.bookmarks
  for delete using (user_id = coalesce(auth.jwt() ->> 'sub', auth.uid()::text));

create policy "stars_select_own" on public.github_stars
  for select using (user_id = coalesce(auth.jwt() ->> 'sub', auth.uid()::text));
create policy "stars_insert_own" on public.github_stars
  for insert with check (user_id = coalesce(auth.jwt() ->> 'sub', auth.uid()::text));
create policy "stars_update_own" on public.github_stars
  for update using (user_id = coalesce(auth.jwt() ->> 'sub', auth.uid()::text));
create policy "stars_delete_own" on public.github_stars
  for delete using (user_id = coalesce(auth.jwt() ->> 'sub', auth.uid()::text));

create policy "pages_select_own" on public.custom_pages
  for select using (user_id = coalesce(auth.jwt() ->> 'sub', auth.uid()::text));
create policy "pages_insert_own" on public.custom_pages
  for insert with check (user_id = coalesce(auth.jwt() ->> 'sub', auth.uid()::text));
create policy "pages_update_own" on public.custom_pages
  for update using (user_id = coalesce(auth.jwt() ->> 'sub', auth.uid()::text));
create policy "pages_delete_own" on public.custom_pages
  for delete using (user_id = coalesce(auth.jwt() ->> 'sub', auth.uid()::text));

create policy "oauth_tokens_deny_all" on public.oauth_tokens
  for all using (false) with check (false);

create policy "agent_docs_select_own" on public.agent_docs
  for select using (user_id = coalesce(auth.jwt() ->> 'sub', auth.uid()::text));
create policy "agent_docs_insert_own" on public.agent_docs
  for insert with check (user_id = coalesce(auth.jwt() ->> 'sub', auth.uid()::text));
create policy "agent_docs_update_own" on public.agent_docs
  for update using (user_id = coalesce(auth.jwt() ->> 'sub', auth.uid()::text));
create policy "agent_docs_delete_own" on public.agent_docs
  for delete using (user_id = coalesce(auth.jwt() ->> 'sub', auth.uid()::text));

drop policy if exists "prompts_select_own" on public.prompts;
drop policy if exists "prompts_select_all" on public.prompts;
drop policy if exists "prompts_insert_own" on public.prompts;
drop policy if exists "prompts_update_own" on public.prompts;
drop policy if exists "prompts_update_all" on public.prompts;
drop policy if exists "prompts_delete_own" on public.prompts;
drop policy if exists "prompts_delete_all" on public.prompts;

-- 프롬프트는 공유 라이브러리: 인증된 사용자는 전체 조회·수정 가능
create policy "prompts_select_all" on public.prompts
  for select using (true);
create policy "prompts_insert_own" on public.prompts
  for insert with check (user_id = coalesce(auth.jwt() ->> 'sub', auth.uid()::text));
create policy "prompts_update_all" on public.prompts
  for update using (true);
create policy "prompts_delete_all" on public.prompts
  for delete using (true);


drop policy if exists "categories_select_own" on public.categories;
drop policy if exists "categories_insert_own" on public.categories;
drop policy if exists "categories_update_own" on public.categories;
drop policy if exists "categories_delete_own" on public.categories;
create policy "categories_select_own" on public.categories
  for select using (user_id = coalesce(auth.jwt() ->> 'sub', auth.uid()::text));
create policy "categories_insert_own" on public.categories
  for insert with check (user_id = coalesce(auth.jwt() ->> 'sub', auth.uid()::text));
create policy "categories_update_own" on public.categories
  for update using (user_id = coalesce(auth.jwt() ->> 'sub', auth.uid()::text));
create policy "categories_delete_own" on public.categories
  for delete using (user_id = coalesce(auth.jwt() ->> 'sub', auth.uid()::text));
