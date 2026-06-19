-- ─────────────────────────────────────────────────────────────
-- 학생 통계 컬럼(win_count / lose_count / recent_matches) 서버 자동 유지
--   · 평소 화면 로드는 경기 전체를 안 불러오고 이 컬럼만 읽도록 하기 위함(성능 최적화)
--   · 현재 시즌(classes.settings->>'season') 경기만 집계
--   · 경기 기록/복원 시 자동 갱신. 삭제/점수수정은 클라이언트가 refresh_class_stats 호출.
--
-- 적용: Supabase SQL Editor 에 전체 붙여넣고 Run.
--      그 다음 아래 "백필" 한 줄도 실행하여 기존 데이터를 채운다.
-- ─────────────────────────────────────────────────────────────
begin;

-- 1) 현재 시즌 기준으로 반 전체 학생 통계 재계산
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
         where m.class_id = p_class_id and m.season = v_season and m.winner_id = st.id) as wins,
      (select count(*) from public.matches m
         where m.class_id = p_class_id and m.season = v_season and m.loser_id = st.id) as losses,
      coalesce((
        select jsonb_agg(x.res order by x.ord)
        from (
          select case when m.winner_id = st.id then 'W' else 'L' end as res,
                 row_number() over (order by m.created_at desc) as ord
          from public.matches m
          where m.class_id = p_class_id and m.season = v_season
            and (m.winner_id = st.id or m.loser_id = st.id)
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

-- 2) 경기 기록 트랜잭션: 기존 동작 + 끝에 통계 갱신
create or replace function public.record_match_transaction(
  p_class_id uuid, p_match_id uuid, p_winner_id uuid, p_loser_id uuid, p_player_updates jsonb
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
  insert into public.matches (id, class_id, winner_id, loser_id, created_at)
  values (p_match_id, p_class_id, p_winner_id, p_loser_id, now());
  for player_record in select * from jsonb_to_recordset(p_player_updates) as x(id uuid, rp int)
  loop
    update public.students set rp = player_record.rp
     where id = player_record.id and class_id = p_class_id;
  end loop;
  perform public.refresh_class_stats(p_class_id);
end;
$$;
grant execute on function public.record_match_transaction(uuid, uuid, uuid, uuid, jsonb) to authenticated;

-- 3) 복원 함수: 학생/경기 삽입 후 통계 갱신 (student_name 포함 버전 유지)
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

  insert into public.matches (id, class_id, winner_id, loser_id, created_at)
  select
    (m->>'id')::uuid, p_class_id,
    case when coalesce((m->>'scoreA')::int,0) >= coalesce((m->>'scoreB')::int,0)
         then (m->>'playerAId')::uuid else (m->>'playerBId')::uuid end,
    case when coalesce((m->>'scoreA')::int,0) >= coalesce((m->>'scoreB')::int,0)
         then (m->>'playerBId')::uuid else (m->>'playerAId')::uuid end,
    coalesce((m->>'date')::timestamptz, now())
  from jsonb_array_elements(coalesce(p_matches,'[]'::jsonb)) as m;
  get diagnostics v_matches = row_count;

  perform public.refresh_class_stats(p_class_id);

  return jsonb_build_object('students', v_students, 'matches', v_matches);
end;
$$;
grant execute on function public.restore_class_data(uuid, jsonb, jsonb) to authenticated;

commit;

-- ── 백필: 기존 모든 반의 통계 컬럼을 한 번 채운다 (위 commit 후 별도 실행 권장) ──
-- select public.refresh_class_stats(id) from public.classes where coalesce(is_deleted,false)=false;
