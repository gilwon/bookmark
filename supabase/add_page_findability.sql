-- 페이지 찾기(평문·태그·원문 URL·즐겨찾기) 컬럼
alter table public.custom_pages add column if not exists tags text not null default '[]';
alter table public.custom_pages add column if not exists source_url text;
alter table public.custom_pages add column if not exists search_text text not null default '';
alter table public.custom_pages add column if not exists is_favorite integer not null default 0;
