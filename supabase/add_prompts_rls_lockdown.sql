-- 프롬프트 RLS: anon 키로 전체 조회·수정하지 못하게 잠근다.
-- 앱은 service_role 서버 API로만 프롬프트에 접근한다.
drop policy if exists "prompts_select_own" on public.prompts;
drop policy if exists "prompts_select_all" on public.prompts;
drop policy if exists "prompts_insert_own" on public.prompts;
drop policy if exists "prompts_update_own" on public.prompts;
drop policy if exists "prompts_update_all" on public.prompts;
drop policy if exists "prompts_delete_own" on public.prompts;
drop policy if exists "prompts_delete_all" on public.prompts;

create policy "prompts_select_all" on public.prompts
  for select using (false);
create policy "prompts_insert_own" on public.prompts
  for insert with check (false);
create policy "prompts_update_all" on public.prompts
  for update using (false);
create policy "prompts_delete_all" on public.prompts
  for delete using (false);
