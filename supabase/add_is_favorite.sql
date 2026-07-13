-- 즐겨찾기 컬럼 (프로덕션/기존 프로젝트용)
alter table public.bookmarks add column if not exists is_favorite integer not null default 0;
alter table public.prompts add column if not exists is_favorite integer not null default 0;
