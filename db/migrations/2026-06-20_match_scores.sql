-- ─────────────────────────────────────────────────────────────
-- 경기 점수 저장 (winner_score / loser_score)
--   · 지금까지 matches 는 winner_id/loser_id 만 저장 → 화면에서 점수를 21:19 로 하드코딩.
--   · 실제 점수를 보존하도록 컬럼 추가 + 기록/복원/점수수정 경로 연결.
--   · 표시는 "승자 점수 : 패자 점수" (승자가 항상 높은 쪽).
--
-- 적용: Supabase SQL Editor 에 전체 Run. (2026-06-19_doubles.sql 이후)
-- ─────────────────────────────────────────────────────────────
begin;

alter table public.matches add column if not exists winner_score int;
alter table public.matches add column if not exists loser_score  int;

-- 경기 기록: 파트너 + 점수 저장
drop function if exists public.record_match_transaction(uuid, uuid, uuid, uuid, jsonb, uuid, uuid);
create or replace function public.record_match_transaction(
  p_class_id uuid, p_match_id uuid, p_winner_id uuid, p_loser_id uuid, p_player_updates jsonb,
  p_winner2_id uuid default null, p_loser2_id uuid default null,
  p_winner_score int default null, p_loser_score int default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare player_record record;
begin
  if not public.is_class_recorder(p_class_id) then
    raise exception '권한이 없습니다. 이 반의 경기 기록 권한이 없습니다.';
  end if;
  insert into public.matches (id, class_id, winner_id, loser_id, winner2_id, loser2_id, winner_score, loser_score, created_at)
  values (p_match_id, p_class_id, p_winner_id, p_loser_id, p_winner2_id, p_loser2_id, p_winner_score, p_loser_score, now());
  for player_record in select * from jsonb_to_recordset(p_player_updates) as x(id uuid, rp int)
  loop
    update public.students set rp = player_record.rp
     where id = player_record.id and class_id = p_class_id;
  end loop;
  perform public.refresh_class_stats(p_class_id);
end;
$$;
grant execute on function public.record_match_transaction(uuid, uuid, uuid, uuid, jsonb, uuid, uuid, int, int) to authenticated;

-- 복원: 점수도 함께 저장 (백업의 scoreA/scoreB 중 큰 값=승자 점수)
create or replace function public.restore_class_data(
  p_class_id uuid,
  p_students jsonb,
  p_matches  jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_students int := 0;
  v_matches  int := 0;
begin
  if not exists (select 1 from public.classes c where c.id = p_class_id and c.owner_uid = auth.uid()) then
    raise exception '권한이 없습니다. (개설자 전용)';
  end if;
  if p_students is null or jsonb_typeof(p_students) <> 'array' or jsonb_array_length(p_students) = 0 then
    raise exception '복원할 학생 데이터가 없습니다.';
  end if;

  delete from public.matches  where class_id = p_class_id;
  delete from public.students where class_id = p_class_id;

  insert into public.students
    (id, class_id, rp, grade, class_number, student_no, student_name, real_name, nickname, gender)
  select
    (e->>'id')::uuid, p_class_id,
    coalesce((e->>'rp')::int, 1000),
    coalesce((e->>'grade')::int, 0),
    coalesce((e->>'classNum')::int, 0),
    coalesce((e->>'number')::int, 0),
    coalesce(nullif(btrim(e->>'realName'),''), nullif(btrim(e->>'name'),''), '학생'),
    coalesce(nullif(btrim(e->>'realName'),''), nullif(btrim(e->>'name'),''), '학생'),
    nullif(btrim(coalesce(e->>'nickname','')),''),
    coalesce(nullif(e->>'gender',''),'U')
  from jsonb_array_elements(p_students) as e;
  get diagnostics v_students = row_count;

  insert into public.matches (id, class_id, winner_id, loser_id, winner2_id, loser2_id, winner_score, loser_score, created_at)
  select
    (m->>'id')::uuid, p_class_id,
    case when coalesce((m->>'scoreA')::int,0) >= coalesce((m->>'scoreB')::int,0)
         then (m->>'playerAId')::uuid else (m->>'playerBId')::uuid end,
    case when coalesce((m->>'scoreA')::int,0) >= coalesce((m->>'scoreB')::int,0)
         then (m->>'playerBId')::uuid else (m->>'playerAId')::uuid end,
    case when coalesce((m->>'scoreA')::int,0) >= coalesce((m->>'scoreB')::int,0)
         then nullif(m->>'playerA2Id','')::uuid else nullif(m->>'playerB2Id','')::uuid end,
    case when coalesce((m->>'scoreA')::int,0) >= coalesce((m->>'scoreB')::int,0)
         then nullif(m->>'playerB2Id','')::uuid else nullif(m->>'playerA2Id','')::uuid end,
    greatest(coalesce((m->>'scoreA')::int,0), coalesce((m->>'scoreB')::int,0)),
    least(coalesce((m->>'scoreA')::int,0), coalesce((m->>'scoreB')::int,0)),
    coalesce((m->>'date')::timestamptz, now())
  from jsonb_array_elements(coalesce(p_matches,'[]'::jsonb)) as m;
  get diagnostics v_matches = row_count;

  perform public.refresh_class_stats(p_class_id);

  return jsonb_build_object('students', v_students, 'matches', v_matches);
end;
$$;
grant execute on function public.restore_class_data(uuid, jsonb, jsonb) to authenticated;

commit;
