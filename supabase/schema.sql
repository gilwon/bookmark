-- Supabase(Postgres) 이전용 스키마 — 로컬 SQLite MVP와 동일 모델
-- 실제 이전 시 RLS 정책과 auth.users FK를 추가하세요.

create extension if not exists "pgcrypto";

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

create index if not exists idx_bookmarks_user on public.bookmarks (user_id);
create index if not exists idx_stars_user on public.github_stars (user_id);
create index if not exists idx_pages_user on public.custom_pages (user_id);
