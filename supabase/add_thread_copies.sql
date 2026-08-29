-- 스레드 카피 테이블 (프로덕션/기존 프로젝트용)
create table if not exists public.thread_copies (
  id text primary key,
  user_id text not null,
  title text not null,
  body text not null default '',
  source_url text,
  tags text not null default '[]',
  is_favorite integer not null default 0,
  created_at text not null,
  updated_at text not null
);

create index if not exists idx_thread_copies_user on public.thread_copies (user_id);

alter table public.thread_copies enable row level security;

drop policy if exists "thread_copies_select_own" on public.thread_copies;
drop policy if exists "thread_copies_insert_own" on public.thread_copies;
drop policy if exists "thread_copies_update_own" on public.thread_copies;
drop policy if exists "thread_copies_delete_own" on public.thread_copies;
create policy "thread_copies_select_own" on public.thread_copies
  for select using (user_id = coalesce(auth.jwt() ->> 'sub', auth.uid()::text));
create policy "thread_copies_insert_own" on public.thread_copies
  for insert with check (user_id = coalesce(auth.jwt() ->> 'sub', auth.uid()::text));
create policy "thread_copies_update_own" on public.thread_copies
  for update using (user_id = coalesce(auth.jwt() ->> 'sub', auth.uid()::text));
create policy "thread_copies_delete_own" on public.thread_copies
  for delete using (user_id = coalesce(auth.jwt() ->> 'sub', auth.uid()::text));
