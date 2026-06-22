-- ─────────────────────────────────────────────────────────────
-- students_public 뷰 박제 (학생/익명 화면용 — 실명 차단 경계)
--   · 이 뷰는 학생/익명 화면이 조회하는 유일한 학생 소스로, real_name 을 의도적으로 제외한다.
--     (실명 노출 차단의 보안 경계. 지금까지 대시보드에만 존재 → DB 재구축 시 누락/오설정 위험)
--   · security_invoker 를 켜지 않음(뷰 소유자 권한으로 실행) → 공개 컬럼만 익명에 노출.
--   · security_barrier=true 유지.
--
-- 적용: Supabase SQL Editor 에 전체 Run. (스키마 재구축/검증용 — 운영 중 재실행해도 안전)
-- ─────────────────────────────────────────────────────────────
begin;

create or replace view public.students_public as
  select
    s.id,
    s.class_id,
    s.rp,
    s.tier,
    s.win_count,
    s.lose_count,
    s.is_deleted,
    s.nickname,
    s.grade,
    s.class_number,
    s.student_no,
    s.gender,
    s.recent_matches,
    s.display_name
  from public.students s
    join public.classes c on s.class_id = c.id
  where s.is_deleted is distinct from true
    and c.is_deleted is distinct from true;

alter view public.students_public set (security_barrier = true);

-- 익명/로그인 사용자가 읽을 수 있어야 함(실명 제외 공개 컬럼만)
grant select on public.students_public to anon, authenticated;

commit;
