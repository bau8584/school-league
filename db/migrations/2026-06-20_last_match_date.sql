-- ─────────────────────────────────────────────────────────────
-- 자동 휴면 감점 복구: students.last_match_date 컬럼 + 서버 유지
--   · 앱은 student.lastMatchDate 로 휴면 여부를 판정하는데, 이 값이 students 컬럼이 아니라
--     로드 시 채워지지 않아 자동 감점이 전혀 동작하지 않았음.
--   · last_match_date 컬럼을 두고 refresh_class_stats 가 함께 갱신하도록 한다.
--   · refresh_class_stats 최종본 = 복식(winner2/loser2) 집계 + last_match_date.
--
-- 적용: Supabase SQL Editor 에 전체 Run. 그 다음 백필도 실행.
-- ─────────────────────────────────────────────────────────────
begin;

alter table public.students add column if not exists last_match_date timestamptz;

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
    recent_matches = stats.recent,
    last_match_date = stats.last_at
  from (
    select
      st.id,
      (select count(*) from public.matches m
         where m.class_id = p_class_id and m.season = v_season
           and (m.winner_id = st.id or m.winner2_id = st.id)) as wins,
      (select count(*) from public.matches m
         where m.class_id = p_class_id and m.season = v_season
           and (m.loser_id = st.id or m.loser2_id = st.id)) as losses,
      (select max(m.created_at) from public.matches m
         where m.class_id = p_class_id and m.season = v_season
           and (m.winner_id = st.id or m.winner2_id = st.id or m.loser_id = st.id or m.loser2_id = st.id)) as last_at,
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

commit;

-- 백필 (위 commit 후 실행):
-- select public.refresh_class_stats(id) from public.classes where coalesce(is_deleted,false)=false;
