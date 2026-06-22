-- ─────────────────────────────────────────────────────────────
-- students.last_win_date 컬럼 + 서버 유지 (첫 승 보너스 정확화)
--   · firstWin 보너스는 student.lastWinDate 로 "오늘 첫 승인지"를 판정하는데,
--     이 값이 로드되지 않아 새로고침마다 undefined → 매번 첫 승 보너스가 부당 지급됨.
--   · refresh_class_stats 가 last_win_date(마지막 승리 경기 시각)도 함께 유지하도록 한다.
--
-- 적용: Supabase SQL Editor 에 전체 Run. 그 다음 백필.
-- ─────────────────────────────────────────────────────────────
begin;

alter table public.students add column if not exists last_win_date timestamptz;

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
    last_match_date = stats.last_at,
    last_win_date = stats.last_win
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
      (select max(m.created_at) from public.matches m
         where m.class_id = p_class_id and m.season = v_season
           and (m.winner_id = st.id or m.winner2_id = st.id)) as last_win,
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
