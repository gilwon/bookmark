-- 기존 프로젝트에 X 북마크 테이블을 추가한다.
create table if not exists public.x_bookmarks (
  id text primary key,
  user_id text not null,
  tweet_id text not null,
  text text not null default '',
  author_name text not null default '',
  author_username text not null default '',
  posted_at text not null default '',
  url text not null,
  last_synced text not null,
  created_at text not null,
  unique (user_id, tweet_id)
);

create index if not exists idx_x_bookmarks_user on public.x_bookmarks (user_id);
create unique index if not exists idx_x_bookmarks_user_tweet
  on public.x_bookmarks (user_id, tweet_id);

alter table public.x_bookmarks enable row level security;

drop policy if exists "x_bookmarks_select_own" on public.x_bookmarks;
drop policy if exists "x_bookmarks_insert_own" on public.x_bookmarks;
drop policy if exists "x_bookmarks_update_own" on public.x_bookmarks;
drop policy if exists "x_bookmarks_delete_own" on public.x_bookmarks;

create policy "x_bookmarks_select_own" on public.x_bookmarks
  for select using (user_id = coalesce(auth.jwt() ->> 'sub', auth.uid()::text));
create policy "x_bookmarks_insert_own" on public.x_bookmarks
  for insert with check (user_id = coalesce(auth.jwt() ->> 'sub', auth.uid()::text));
create policy "x_bookmarks_update_own" on public.x_bookmarks
  for update using (user_id = coalesce(auth.jwt() ->> 'sub', auth.uid()::text));
create policy "x_bookmarks_delete_own" on public.x_bookmarks
  for delete using (user_id = coalesce(auth.jwt() ->> 'sub', auth.uid()::text));
