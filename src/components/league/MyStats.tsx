import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Student, Match, TierName } from "@/lib/league-types";
import { TierBadge } from "./TierBadge";
import { GenderMark } from "./GenderMark";
import { Swords, Users, Target } from "lucide-react";

// 단/복식 강약 라벨 (게임형, 승률 기반)
function styleLabel(w: number, l: number): { text: string; cls: string } {
  const g = w + l;
  if (g === 0) return { text: "미기록", cls: "text-muted-foreground" };
  const rate = (w / g) * 100;
  if (rate >= 65) return { text: "주력 종목 ⭐", cls: "text-amber-400" };
  if (rate >= 45) return { text: "호각 대전 ⚔️", cls: "text-neon-blue" };
  return { text: "수련 중 🔧", cls: "text-emerald-400" };
}

// 본인 경기(시간 오름차순)
function useMyMatches(matches: Match[], studentId: string) {
  return useMemo(() => matches
    .filter((m) => m.playerAId === studentId || m.playerBId === studentId || m.playerA2Id === studentId || m.playerB2Id === studentId)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()), [matches, studentId]);
}

const Stat = ({ label: l, value, sub }: { label: string; value: React.ReactNode; sub?: string }) => (
  <div className="rounded-xl border border-border/40 bg-background/30 p-3 text-center">
    <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground whitespace-nowrap">{l}</div>
    <div className="mt-0.5 text-xl font-black text-foreground">{value}</div>
    {sub ? <div className="text-[10px] text-muted-foreground mt-0.5">{sub}</div> : null}
  </div>
);

// ─────────────────────────────────────────────────────────────
// 나의 전적 (프로필 박스 옆에 배치) — 승률/승/패/최고연승 + 최근 10경기
// ─────────────────────────────────────────────────────────────
export function MyStatsSummary({
  student, matches, matchesLoading = false,
}: { student: Student; matches: Match[]; matchesLoading?: boolean }) {
  const wins = student.wins ?? 0;
  const losses = student.losses ?? 0;
  const myMatches = useMyMatches(matches, student.id);

  const bestStreak = useMemo(() => {
    let best = 0, cur = 0;
    for (const m of myMatches) {
      const won = m.playerAId === student.id || m.playerA2Id === student.id;
      if (won) { cur++; best = Math.max(best, cur); } else cur = 0;
    }
    return best;
  }, [myMatches, student.id]);

  // 최근 10경기 승률
  const recentRate = useMemo(() => {
    const last = [...myMatches].slice(-10);
    if (last.length === 0) return null;
    const w = last.filter((m) => m.playerAId === student.id || m.playerA2Id === student.id).length;
    return { rate: Math.round((w / last.length) * 100), n: last.length };
  }, [myMatches, student.id]);

  return (
    <Card className="h-full border-border/60 bg-card/45 p-5 backdrop-blur-xl shadow-lg">
      <div className="flex items-center gap-1.5 text-sm font-black text-foreground mb-3">
        <Swords className="size-4 text-neon-blue" /> 나의 전적
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <Stat label="최근 승률" value={matchesLoading && !recentRate ? "…" : recentRate ? `${recentRate.rate}%` : "-"} sub={recentRate ? `최근 ${recentRate.n}경기` : "최근 10경기"} />
        <Stat label="최고 연승" value={matchesLoading ? "…" : `${bestStreak}`} sub="역대" />
        <Stat label="승" value={<span className="text-win">{wins}</span>} />
        <Stat label="패" value={<span className="text-loss">{losses}</span>} />
      </div>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────
// 경기 스타일(단/복식 강약·접전) + 나의 라이벌(2명)
// ─────────────────────────────────────────────────────────────
export function MyStatsDetail({
  student, students, matches, matchesLoading = false, thresholds,
}: { student: Student; students: Student[]; matches: Match[]; matchesLoading?: boolean; thresholds?: Record<TierName, number> }) {
  const myMatches = useMyMatches(matches, student.id);

  const d = useMemo(() => {
    let sW = 0, sL = 0, dW = 0, dL = 0, deuce = 0, bigWin = 0;
    const opp: Record<string, { w: number; l: number; lastTs: number; lastWon: boolean }> = {};
    for (const m of myMatches) {
      const isA = m.playerAId === student.id || m.playerA2Id === student.id;
      const won = isA;
      const isDouble = m.matchType === "double" || !!(m.playerA2Id || m.playerB2Id);
      if (isDouble) { won ? dW++ : dL++; } else { won ? sW++ : sL++; }
      const sa = Number(m.scoreA), sb = Number(m.scoreB);
      if (Number.isFinite(sa) && Number.isFinite(sb)) {
        const diff = Math.abs(sa - sb);
        if (diff <= 2) deuce++;
        if (won && diff >= 5) bigWin++;
      }
      const ts = new Date(m.date).getTime();
      const ids = isA ? [m.playerBId, m.playerB2Id] : [m.playerAId, m.playerA2Id];
      for (const oid of ids) {
        if (!oid) continue;
        const rec = opp[oid] || { w: 0, l: 0, lastTs: 0, lastWon: false };
        if (won) rec.w++; else rec.l++;
        if (ts >= rec.lastTs) { rec.lastTs = ts; rec.lastWon = won; }
        opp[oid] = rec;
      }
    }
    // 라이벌: 맞대결 수 → (동률) 내 승수 → (동률) 최근 경기. 상위 2명.
    const rivals = Object.entries(opp)
      .map(([id, r]) => ({ id, ...r, games: r.w + r.l }))
      .sort((a, b) => (b.games - a.games) || (b.w - a.w) || (b.lastTs - a.lastTs))
      .slice(0, 2);
    return { sW, sL, dW, dL, deuce, bigWin, rivals };
  }, [myMatches, student.id]);

  return (
    <>
      <Card className="border-border/60 bg-card/45 p-5 backdrop-blur-xl shadow-lg">
        <div className="flex items-center gap-1.5 mb-3 text-sm font-black text-foreground">
          <Target className="size-4 text-neon-blue" /> 경기 스타일
        </div>
        {matchesLoading && myMatches.length === 0 ? (
          <div className="text-center py-4 text-xs text-muted-foreground">불러오는 중…</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {(() => { const sl = styleLabel(d.sW, d.sL); return (
              <Stat label="단식" value={<span className={cn(sl.cls, "text-sm")}>{sl.text}</span>} sub={`${d.sW}승 ${d.sL}패`} />
            ); })()}
            {(() => { const dl = styleLabel(d.dW, d.dL); return (
              <Stat label="복식" value={<span className={cn(dl.cls, "text-sm")}>{dl.text}</span>} sub={`${d.dW}승 ${d.dL}패`} />
            ); })()}
            <Stat label="짜릿한 접전" value={`${d.deuce}`} sub="2점차 이내" />
            <Stat label="압도적 승리" value={`${d.bigWin}`} sub="5점차+ 승" />
          </div>
        )}
      </Card>

      <Card className="border-border/60 bg-card/45 p-5 backdrop-blur-xl shadow-lg">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5 text-sm font-black text-foreground">
            <Users className="size-4 text-neon-blue" /> 나의 라이벌
          </div>
          <span className="text-[10px] text-muted-foreground">가장 많이 겨룬 상대</span>
        </div>
        {matchesLoading && myMatches.length === 0 ? (
          <div className="text-center py-3 text-xs text-muted-foreground">불러오는 중…</div>
        ) : d.rivals.length === 0 ? (
          <div className="text-center py-3 text-xs text-muted-foreground">아직 라이벌이 없어요. 더 많은 경기를 해보세요!</div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {d.rivals.map((r) => {
              const opp = students.find((s) => s.id === r.id) ?? null;
              const status = r.w > r.l ? { t: "내가 우세", c: "text-win" } : r.w < r.l ? { t: "내가 열세", c: "text-loss" } : { t: "팽팽한 맞수", c: "text-amber-400" };
              return (
                <div key={r.id} className="rounded-xl border border-rose-500/30 bg-rose-500/[0.06] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {opp && <GenderMark gender={opp.gender} className="size-3.5 text-[9px]" />}
                      {opp && opp.nickname && opp.nickname.trim() ? (
                        <span className="min-w-0 truncate">
                          <span className="text-sm font-black text-foreground">{opp.nickname.trim()}</span>
                          <span className="ml-1 text-[10px] font-medium text-muted-foreground">{opp.grade}학년 {opp.classNum}반 {opp.number}번</span>
                        </span>
                      ) : (
                        <span className="text-sm font-black text-foreground truncate">
                          {opp ? `${opp.grade}학년 ${opp.classNum}반 ${opp.number}번` : "알 수 없음"}
                        </span>
                      )}
                      {opp && <TierBadge rp={opp.rp} thresholds={thresholds} />}
                    </div>
                    <span className="text-[10px] font-bold text-muted-foreground shrink-0">{r.games}번</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs font-bold">
                    <span><span className="text-win">{r.w}승</span> <span className="text-loss">{r.l}패</span></span>
                    <span className={status.c}>{status.t}</span>
                  </div>
                  <div className="mt-1 text-[10px] text-muted-foreground">지난 대결 {r.lastWon ? "🔥 승리" : "😤 패배"}</div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </>
  );
}
