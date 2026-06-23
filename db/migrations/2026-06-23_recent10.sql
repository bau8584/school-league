-- ─────────────────────────────────────────────────────────────
-- recent_matches 보관 개수 5 → 10 (순위표 "최근 10경기 승률" 정확화)
--   · 순위표 승률을 최근 10경기 기준으로 계산하므로 recent 배열도 10개까지 유지한다.
--   · 컬럼 추가 없음 → 코드 배포 순서와 무관(미적용 시 최대 5개까지만 집계).
--
-- 적용: Supabase SQL Editor 에 전체 Run. 그 다음 백필.
-- ─────────────────────────────────────────────────────────────
begin;

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
          limit 10
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
