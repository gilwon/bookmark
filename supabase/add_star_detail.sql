-- github_stars 레포 상세(README) 컬럼 (프로덕션/기존 프로젝트용)
alter table public.github_stars add column if not exists detail_json text;
alter table public.github_stars add column if not exists readme_md text;
alter table public.github_stars add column if not exists detail_fetched_at text;
