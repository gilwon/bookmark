-- github_stars README 한국어 번역 컬럼 (프로덕션/기존 프로젝트용)
alter table public.github_stars add column if not exists readme_md_ko text;
