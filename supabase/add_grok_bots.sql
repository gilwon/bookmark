-- 그록봇 템플릿 테이블 (프로덕션/기존 프로젝트용)
create table if not exists public.grok_bots (
  id text primary key,
  user_id text not null,
  slug text,
  name text not null,
  name_en text not null default '',
  creator text not null default '',
  category text,
  description text not null default '',
  how_it_works text not null default '',
  notes text not null default '',
  skills text not null default '[]',
  routines text not null default '[]',
  template_url text not null,
  source_url text,
  official_marketplace integer not null default 0,
  is_favorite integer not null default 0,
  created_at text not null,
  updated_at text not null
);

create index if not exists idx_grok_bots_user on public.grok_bots (user_id);
create unique index if not exists idx_grok_bots_user_template on public.grok_bots (user_id, template_url);

alter table public.grok_bots enable row level security;

drop policy if exists "grok_bots_select_own" on public.grok_bots;
drop policy if exists "grok_bots_insert_own" on public.grok_bots;
drop policy if exists "grok_bots_update_own" on public.grok_bots;
drop policy if exists "grok_bots_delete_own" on public.grok_bots;
create policy "grok_bots_select_own" on public.grok_bots
  for select using (user_id = coalesce(auth.jwt() ->> 'sub', auth.uid()::text));
create policy "grok_bots_insert_own" on public.grok_bots
  for insert with check (user_id = coalesce(auth.jwt() ->> 'sub', auth.uid()::text));
create policy "grok_bots_update_own" on public.grok_bots
  for update using (user_id = coalesce(auth.jwt() ->> 'sub', auth.uid()::text));
create policy "grok_bots_delete_own" on public.grok_bots
  for delete using (user_id = coalesce(auth.jwt() ->> 'sub', auth.uid()::text));
