-- ─────────────────────────────────────────────────────────────
-- students.student_name (NOT NULL 레거시 컬럼) 자동 채움 트리거
--   · 앱은 real_name/display_name 만 관리하고 student_name 은 사용하지 않으나,
--     테이블에 NOT NULL 제약이 남아 있어 학생 등록/복원 등 모든 INSERT 가 실패함.
--   · INSERT/UPDATE 시 student_name 이 비어 있으면 real_name(없으면 '학생')으로 자동 설정.
--
-- 적용: Supabase SQL Editor 에 전체 붙여넣고 Run. (재배포 불필요 — 모든 삽입 경로에 즉시 적용)
-- ─────────────────────────────────────────────────────────────
create or replace function public.students_set_student_name()
returns trigger
language plpgsql
as $$
begin
  if new.student_name is null or btrim(new.student_name) = '' then
    new.student_name := coalesce(nullif(btrim(new.real_name), ''), '학생');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_students_student_name on public.students;
create trigger trg_students_student_name
  before insert or update on public.students
  for each row execute function public.students_set_student_name();
