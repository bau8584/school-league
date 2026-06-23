-- ─────────────────────────────────────────────────────────────
-- 학생 대표 칭호(title) — 해금한 업적 중 하나를 카드에 표시
--   · students.title 컬럼 + 코드 인증 self-set RPC(별명과 동일 패턴, 익명 /view 변조 방지).
--
-- 적용: Supabase SQL Editor 에 전체 Run. (이 컬럼을 조회하는 코드 배포보다 먼저!)
-- ─────────────────────────────────────────────────────────────
begin;

alter table public.students add column if not exists title text;

create or replace function public.set_student_title(p_student_id uuid, p_code text, p_title text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_title text := nullif(btrim(coalesce(p_title, '')), '');
begin
  if not public.verify_student_code(p_student_id, p_code) then
    raise exception '코드가 올바르지 않습니다.';
  end if;
  update public.students
    set title = case when v_title is null then null else left(v_title, 40) end
    where id = p_student_id;
  return true;
end;
$$;
grant execute on function public.set_student_title(uuid, text, text) to anon, authenticated;

-- 학생/익명 화면(students_public)에서도 title을 읽을 수 있도록 뷰 재생성 (real_name 제외 유지)
create or replace view public.students_public as
  select
    s.id, s.class_id, s.rp, s.tier, s.win_count, s.lose_count, s.is_deleted,
    s.nickname, s.grade, s.class_number, s.student_no, s.gender, s.recent_matches,
    s.display_name, s.title
  from public.students s
    join public.classes c on s.class_id = c.id
  where s.is_deleted is distinct from true
    and c.is_deleted is distinct from true;
alter view public.students_public set (security_barrier = true);
grant select on public.students_public to anon, authenticated;

commit;
