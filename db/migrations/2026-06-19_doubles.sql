-- ─────────────────────────────────────────────────────────────
-- 복식(doubles) 경기 저장 지원
--   · matches 에 winner2_id / loser2_id (파트너) 컬럼 추가 (nullable).
--   · record_match_transaction: 파트너 함께 저장.
--   · refresh_class_stats: 파트너도 승/패·최근전적에 포함하여 집계.
--   · restore_class_data: 백업의 playerA2Id/playerB2Id 를 점수 기준으로 매핑하여 복원.
--
-- 적용: Supabase SQL Editor 에 전체 붙여넣고 Run. (2026-06-19_student_stats.sql 적용 이후)
-- ─────────────────────────────────────────────────────────────
begin;

alter table public.matches add column if not exists winner2_id uuid references public.students(id) on delete set null;
alter table public.matches add column if not exists loser2_id  uuid references public.students(id) on delete set null;

-- 통계 재계산: 파트너(winner2/loser2)도 포함
create or replace function public.refresh_class_stats(p_class_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_season text;
begin
  select settings->>'season' into v_season from public.classes where id = p_class_id;

  update public.students s set
    win_count = stats.wins,
    lose_count = stats.losses,
    recent_matches = stats.recent
  from (
    select
      st.id,
      (select count(*) from public.matches m
         where m.class_id = p_class_id and m.season = v_season
           and (m.winner_id = st.id or m.winner2_id = st.id)) as wins,
      (select count(*) from public.matches m
         where m.class_id = p_class_id and m.season = v_season
           and (m.loser_id = st.id or m.loser2_id = st.id)) as losses,
      coalesce((
        select jsonb_agg(x.res order by x.ord)
        from (
          select case when (m.winner_id = st.id or m.winner2_id = st.id) then 'W' else 'L' end as res,
                 row_number() over (order by m.created_at desc) as ord
          from public.matches m
          where m.class_id = p_class_id and m.season = v_season
            and (m.winner_id = st.id or m.winner2_id = st.id or m.loser_id = st.id or m.loser2_id = st.id)
          order by m.created_at desc
          limit 5
        ) x
      ), '[]'::jsonb) as recent
    from public.students st
    where st.class_id = p_class_id
  ) stats
  where s.id = stats.id;
end;
$$;
grant execute on function public.refresh_class_stats(uuid) to authenticated;

-- 경기 기록: 파트너 파라미터 추가 (기존 5인자 함수 제거 후 7인자로 재정의)
drop function if exists public.record_match_transaction(uuid, uuid, uuid, uuid, jsonb);
create or replace function public.record_match_transaction(
  p_class_id uuid, p_match_id uuid, p_winner_id uuid, p_loser_id uuid, p_player_updates jsonb,
  p_winner2_id uuid default null, p_loser2_id uuid default null
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
  insert into public.matches (id, class_id, winner_id, loser_id, winner2_id, loser2_id, created_at)
  values (p_match_id, p_class_id, p_winner_id, p_loser_id, p_winner2_id, p_loser2_id, now());
  for player_record in select * from jsonb_to_recordset(p_player_updates) as x(id uuid, rp int)
  loop
    update public.students set rp = player_record.rp
     where id = player_record.id and class_id = p_class_id;
  end loop;
  perform public.refresh_class_stats(p_class_id);
end;
$$;
grant execute on function public.record_match_transaction(uuid, uuid, uuid, uuid, jsonb, uuid, uuid) to authenticated;

-- 복원: 파트너도 점수 기준으로 매핑하여 삽입
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

  insert into public.matches (id, class_id, winner_id, loser_id, winner2_id, loser2_id, created_at)
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
    coalesce((m->>'date')::timestamptz, now())
  from jsonb_array_elements(coalesce(p_matches,'[]'::jsonb)) as m;
  get diagnostics v_matches = row_count;

  perform public.refresh_class_stats(p_class_id);

  return jsonb_build_object('students', v_students, 'matches', v_matches);
end;
$$;
grant execute on function public.restore_class_data(uuid, jsonb, jsonb) to authenticated;

commit;

-- 기존 데이터 통계 재집계 (선택, 위 commit 후):
-- select public.refresh_class_stats(id) from public.classes where coalesce(is_deleted,false)=false;
