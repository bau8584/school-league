import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLeagueStore } from "@/lib/league-store";
import { Card } from "@/components/ui/card";
import { TierBadge } from "@/components/league/TierBadge";
import { GenderMark } from "@/components/league/GenderMark";
import { MyAchievements } from "@/components/league/MyAchievements";
import { SeasonSummary } from "@/components/league/SeasonSummary";
import { StudentCardSettings } from "@/components/league/StudentCardSettings";
import { MatchRecommend } from "@/components/league/MatchRecommend";
import { MyStatsSummary, MyStatsDetail } from "@/components/league/MyStats";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import {
  getTier,
  TIER_STYLES,
  type TierName,
  type Student,
  type Match,
  type DecaySettingsRecord,
} from "@/lib/league-types";
import { Trophy, ChevronLeft, TrendingUp, Medal, Calendar, Settings, Hourglass, Target, BarChart3, Award } from "lucide-react";

export const Route = createFileRoute("/view/$classId")({
  component: StudentViewerComponent,
});

const DEFAULT_THRESHOLDS: Record<TierName, number> = {
  Bronze: 0,
  Silver: 1000,
  Gold: 1200,
  Platinum: 1400,
  Diamond: 1600,
};

// 학번 표기 ("5-9 4번"). 학년-반은 하이픈, 번호 앞은 띄어쓰기.
function studentNo(s: { grade: number; classNum: number; number: number }) {
  return `${s.grade}-${s.classNum} ${s.number}번`;
}

// 화면에 크게 보일 이름. 별명이 있으면 별명, 없으면 학번.
function displayIdentity(s: { nickname?: string | null; grade: number; classNum: number; number: number }) {
  return s.nickname && s.nickname.trim() ? s.nickname.trim() : studentNo(s);
}

// 과거 시즌: 선수 카드 / 시즌 요약 전환 칩
function ViewToggle({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "px-4 py-1.5 rounded-full border text-xs font-bold transition-all active:scale-95",
        active ? "border-neon-blue/50 bg-neon-blue/15 text-neon-blue" : "border-border/40 text-muted-foreground hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}

// 최근 5경기 흐름(W/L 점)을 그리는 공용 미니 위젯
function RecentDots({ recent, size = "sm" }: { recent: ("W" | "L")[]; size?: "sm" | "lg" }) {
  const dot = size === "lg" ? "size-7 text-xs" : "size-5.5 text-[9px]";
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: 5 }).map((_, idx) => {
        const r = recent[idx];
        return (
          <span
            key={idx}
            className={cn(
              "flex items-center justify-center rounded-full font-bold",
              dot,
              !r && "bg-muted/40 text-muted-foreground",
              r === "W" && "bg-win/20 text-win ring-1 ring-win/40",
              r === "L" && "bg-loss/20 text-loss ring-1 ring-loss/40",
            )}
          >
            {r ?? "·"}
          </span>
        );
      })}
    </div>
  );
}

function StudentViewerComponent() {
  const { classId } = Route.useParams();
  const { students, matches, matchesLoaded, title, loadClassData, loadMatches, tierThresholds, hydrated, isSyncing,
    seasonList, currentSeason, currentViewSeason, changeViewSeason,
    decaySettings, decayAppliedDates } = useLeagueStore();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showSummary, setShowSummary] = useState(false);
  const isPastSeason = currentViewSeason !== "현재 시즌";

  // 내 카드 기억: 이 리그 링크에서 마지막으로 고른 카드를 저장 → 다음 방문 시 바로 내 기록으로 진입
  const savedKey = `slv_selected_${classId}`;
  // 카드 선택(저장)
  const handleSelectStudent = (id: string) => {
    setSelectedId(id);
    try { localStorage.setItem(savedKey, id); } catch { /* ignore */ }
  };
  // 목록으로(다른 카드 고르기 → 기억 해제)
  const handleBackToList = () => {
    setSelectedId(null);
    try { localStorage.removeItem(savedKey); } catch { /* ignore */ }
  };

  // 시즌 전환: 선택된 학생/보기 상태는 그대로 유지한 채 데이터만 교체.
  const handleSeasonChange = (season: string) => {
    changeViewSeason(season);
  };

  useEffect(() => {
    if (classId) {
      loadClassData(classId);
    }
  }, [classId, loadClassData]);

  // 저장된 카드가 있으면(현재 시즌·미선택 시) 자동으로 그 학생 기록으로 진입
  const autoSelectRef = useRef(false);
  useEffect(() => {
    if (autoSelectRef.current) return;
    if (isPastSeason || selectedId || students.length === 0) return;
    try {
      const saved = localStorage.getItem(savedKey);
      if (saved && students.some((s) => s.id === saved)) {
        autoSelectRef.current = true;
        setSelectedId(saved);
      }
    } catch { /* ignore */ }
  }, [students, isPastSeason, selectedId, savedKey]);

  // 학생 카드를 열 때만 경기를 lazy-load (목록 화면은 경기 미로드)
  useEffect(() => {
    if (selectedId && classId && currentViewSeason === "현재 시즌") {
      loadMatches(classId);
    }
  }, [selectedId, classId, currentViewSeason, loadMatches]);

  const thresholds = tierThresholds || DEFAULT_THRESHOLDS;

  const selectedStudent = useMemo(
    () => students.find((s) => s.id === selectedId) ?? null,
    [students, selectedId],
  );

  if (!hydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="size-10 rounded-full border-4 border-muted/30 border-t-neon-blue animate-spin" />
          <span className="text-xs text-muted-foreground font-black tracking-wider animate-pulse">
            리그 정보를 불러오고 있습니다...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden bg-background">
      <Toaster theme="dark" position="top-center" richColors />
      {/* Background neon elements */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(18,18,18,0.25)_1px,transparent_1px),linear-gradient(90deg,rgba(18,18,18,0.25)_1px,transparent_1px)] bg-[size:30px_30px] pointer-events-none opacity-30" />
      <div className="absolute -top-40 -left-40 size-96 rounded-full bg-neon-blue/10 blur-[130px] pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 size-96 rounded-full bg-tier-diamond/10 blur-[130px] pointer-events-none" />

      {/* Header */}
      <header className="border-b border-border/60 bg-card/40 backdrop-blur-xl relative z-10">
        <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-gradient-to-br from-neon-blue to-tier-diamond glow-primary">
              <Trophy className="size-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-black tracking-tight text-foreground">
                {title}
              </h1>
              <p className="text-[10px] font-bold text-neon-green tracking-wider uppercase flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-neon-green animate-pulse" />
                학생 전용 화면
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isSyncing && (
              <div className="flex items-center gap-1 px-2.5 py-1 rounded-full border border-neon-blue/40 bg-neon-blue/5 text-[9px] font-bold text-neon-blue animate-pulse">
                <span>실시간 동기화 중...</span>
              </div>
            )}
            {/* 시즌 선택 (과거 시즌 열람) */}
            <div className="flex items-center gap-1.5 rounded-full border border-border/60 bg-card/60 px-3 py-1.5">
              <Calendar className="size-3.5 text-neon-blue" />
              <select
                value={currentViewSeason}
                onChange={(e) => handleSeasonChange(e.target.value)}
                className="bg-transparent text-xs font-bold text-foreground focus:outline-none cursor-pointer pr-1"
              >
                <option value="현재 시즌" className="bg-background text-foreground font-bold">{currentSeason} (현재)</option>
                {seasonList && seasonList.map((season) => (
                  <option key={season} value={season} className="bg-background text-foreground font-bold">{season}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8 relative z-10 space-y-5">
        {/* 과거 시즌 읽기 전용 배너 */}
        {isPastSeason && (
          <div className="flex items-center gap-3 rounded-xl border border-amber-500/35 bg-amber-500/10 p-3.5 text-amber-200">
            <Calendar className="size-5 shrink-0 text-amber-500" />
            <div className="flex-1 text-xs sm:text-sm">
              <span className="font-black">과거 시즌 {currentViewSeason}</span> 열람 중입니다. (읽기 전용)
            </div>
            <button
              onClick={() => handleSeasonChange("현재 시즌")}
              className="text-xs bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 rounded-lg px-3 py-1.5 font-bold transition-all active:scale-95 shrink-0 cursor-pointer"
            >
              현재 시즌으로
            </button>
          </div>
        )}

        {selectedStudent ? (
          <StudentDashboard
            student={selectedStudent}
            students={students}
            matches={matches}
            matchesLoading={currentViewSeason === "현재 시즌" && !matchesLoaded}
            thresholds={thresholds}
            decaySettings={decaySettings}
            decayAppliedDates={decayAppliedDates}
            readOnly={isPastSeason}
            onBack={handleBackToList}
            onSaved={() => loadClassData(classId, true)}
          />
        ) : isPastSeason && showSummary ? (
          <SeasonSummary
            season={currentViewSeason}
            students={students}
            matches={matches}
            thresholds={thresholds}
          />
        ) : (
          <>
            {/* 과거 시즌일 때 선수 카드 / 시즌 요약 전환 */}
            {isPastSeason && (
              <div className="flex items-center gap-1.5">
                <ViewToggle active={!showSummary} onClick={() => setShowSummary(false)}>선수 카드</ViewToggle>
                <ViewToggle active={showSummary} onClick={() => setShowSummary(true)}>시즌 요약</ViewToggle>
              </div>
            )}
            <StudentPicker
              students={students}
              thresholds={thresholds}
              onSelect={handleSelectStudent}
            />
          </>
        )}
      </main>

      <footer className="border-t border-border/25 py-4 text-center text-[10px] text-muted-foreground relative z-10 bg-background/50">
        <div>자기 카드를 눌러 나의 티어와 경기 기록, 업적을 확인해 보세요. 화면은 실시간으로 갱신됩니다.</div>
      </footer>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 화면 1: 학생 선택 창 (카드 그리드)
// ─────────────────────────────────────────────────────────────
function StudentPicker({
  students,
  thresholds,
  onSelect,
}: {
  students: Student[];
  thresholds: Record<TierName, number>;
  onSelect: (id: string) => void;
}) {
  const [grade, setGrade] = useState<number | null>(null);
  const [classNum, setClassNum] = useState<number | null>(null);

  const grades = useMemo(() => {
    const set = new Set<number>();
    students.forEach((s) => { if (s.grade) set.add(s.grade); });
    return Array.from(set).sort((a, b) => a - b);
  }, [students]);

  const classes = useMemo(() => {
    if (grade == null) return [];
    const set = new Set<number>();
    students.filter((s) => s.grade === grade).forEach((s) => set.add(s.classNum));
    return Array.from(set).sort((a, b) => a - b);
  }, [students, grade]);

  const roster = useMemo(() => {
    if (grade == null || classNum == null) return [];
    return students
      .filter((s) => s.grade === grade && s.classNum === classNum)
      .sort((a, b) => a.number - b.number);
  }, [students, grade, classNum]);

  const ChipBtn = ({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) => (
    <button
      onClick={onClick}
      className={cn(
        "rounded-xl border px-3 py-2.5 text-sm font-bold transition-all active:scale-95 cursor-pointer",
        active
          ? "border-neon-blue/60 bg-neon-blue/15 text-neon-blue glow-primary"
          : "border-border/60 bg-card/60 text-muted-foreground hover:text-foreground hover:bg-accent/40",
      )}
    >
      {children}
    </button>
  );

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      <div>
        <h2 className="text-lg font-black tracking-tight text-foreground">나의 카드를 찾아주세요</h2>
        <p className="text-xs text-muted-foreground mt-0.5">학년 → 반을 고르면 우리 반 친구들이 나와요.</p>
      </div>

      {students.length === 0 ? (
        <Card className="border-border/60 bg-card/60 p-12 text-center backdrop-blur-xl">
          <p className="text-sm text-muted-foreground">아직 등록된 학생이 없습니다.</p>
        </Card>
      ) : (
        <div className="space-y-5">
          {/* 1단계: 학년 */}
          <div>
            <div className="mb-2 text-sm font-extrabold text-muted-foreground">학년</div>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
              {grades.map((g) => (
                <ChipBtn key={g} active={grade === g} onClick={() => { setGrade(g); setClassNum(null); }}>{g}학년</ChipBtn>
              ))}
            </div>
          </div>

          {/* 2단계: 반 */}
          {grade != null && (
            <div>
              <div className="mb-2 text-sm font-extrabold text-muted-foreground">반</div>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
                {classes.map((c) => (
                  <ChipBtn key={c} active={classNum === c} onClick={() => setClassNum(c)}>{c}반</ChipBtn>
                ))}
              </div>
            </div>
          )}

          {/* 3단계: 학생 카드 */}
          {classNum != null && (
            <div>
              <div className="mb-2 text-sm font-extrabold text-muted-foreground">나의 카드</div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
                {roster.map((s) => {
                  const tier = getTier(s.rp, thresholds);
                  const style = TIER_STYLES[tier];
                  return (
                    <button
                      key={s.id}
                      onClick={() => onSelect(s.id)}
                      className={cn(
                        "group relative flex flex-col gap-3 rounded-2xl border bg-card/60 p-4 text-left backdrop-blur-xl transition-all",
                        "hover:scale-[1.03] hover:bg-card/80 active:scale-100 cursor-pointer",
                        style.ring,
                        "ring-1",
                      )}
                    >
                      <div
                        className={cn(
                          "absolute -top-10 -right-10 size-24 rounded-full blur-[50px] opacity-20 pointer-events-none",
                          style.bg.replace("/15", ""),
                        )}
                      />
                      <div className="flex items-center justify-between gap-1.5 relative z-10">
                        <GenderMark gender={s.gender} />
                        <span className="text-[10px] font-semibold text-muted-foreground whitespace-nowrap">{s.grade}학년 {s.classNum}반</span>
                        <TierBadge rp={s.rp} thresholds={thresholds} />
                      </div>
                      <div className="flex flex-col items-center gap-1 py-2 relative z-10">
                        <span className="text-2xl font-black tracking-tight text-foreground text-center break-keep line-clamp-2">
                          {s.nickname && s.nickname.trim() ? s.nickname.trim() : `${s.number}번`}
                        </span>
                        {s.nickname && s.nickname.trim() ? (
                          <span className="text-xs font-semibold text-muted-foreground">{s.number}번</span>
                        ) : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 화면 2: 개인 대시보드 (RP 점수·승률·등수 숨김)
// ─────────────────────────────────────────────────────────────
function StudentDashboard({
  student,
  students,
  matches,
  matchesLoading = false,
  thresholds,
  decaySettings,
  decayAppliedDates = {},
  readOnly = false,
  onBack,
  onSaved,
}: {
  student: Student;
  students: Student[];
  matches: Match[];
  matchesLoading?: boolean;
  thresholds: Record<TierName, number>;
  decaySettings?: DecaySettingsRecord;
  decayAppliedDates?: Record<string, string>;
  readOnly?: boolean;
  onBack: () => void;
  onSaved: () => void;
}) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const currentTier = getTier(student.rp, thresholds);

  // 개인 대시보드 탭: 내 기록 / 매치 추천
  const [tab, setTab] = useState<"record" | "recommend" | "achievements">("record");
  // 매치 추천(학생 시점): 본인을 고정 분석 대상으로, 상대 범위만 선택
  const recSel = useMemo(
    () => ({ grade: student.grade, classNum: student.classNum, studentId: student.id }),
    [student.grade, student.classNum, student.id],
  );
  const [recMode, setRecMode] = useState<"class" | "otherClass" | "otherGrade">("class");
  const [recTargetGrade, setRecTargetGrade] = useState<number | null>(null);
  const [recTargetClass, setRecTargetClass] = useState<number | null>(null);
  // 학생을 바꿔 들어오면 추천 탭 상태 초기화
  useEffect(() => {
    setTab("record");
    setRecMode("class");
    setRecTargetGrade(null);
    setRecTargetClass(null);
  }, [student.id]);

  // 휴면 감점 카운트다운 (사이클당 1회 차감 기준). 과거 시즌 열람(readOnly)에서는 숨김.
  // students_public 뷰에는 lastMatchDate가 없으므로 matches에서 마지막 경기일을 직접 계산한다.
  const decayInfo = useMemo(() => {
    if (readOnly) return null;
    const tierKey = currentTier.toLowerCase() as 'bronze'|'silver'|'gold'|'platinum'|'diamond';
    const setting = decaySettings?.[tierKey];
    if (!setting || !setting.enabled) return null;

    const lastMatchTime = matches
      .filter((m) =>
        m.playerAId === student.id ||
        m.playerBId === student.id ||
        m.playerA2Id === student.id ||
        m.playerB2Id === student.id,
      )
      .reduce((max, m) => Math.max(max, new Date(m.date).getTime()), 0);
    if (!lastMatchTime) return null; // 경기 기록이 없으면 표시하지 않음

    const dayMs = 1000 * 60 * 60 * 24;
    const appliedStr = decayAppliedDates[student.id];
    const baseline = Math.max(lastMatchTime, appliedStr ? new Date(appliedStr).getTime() : 0);
    const daysRemaining = Math.max(0, Math.ceil(setting.inactiveDays - (Date.now() - baseline) / dayMs));
    return { daysRemaining, decayRp: setting.decayRp, warning: daysRemaining <= 3 };
  }, [readOnly, matches, student.id, currentTier, decaySettings, decayAppliedDates]);

  // 다음 티어까지의 진행도 (RP 숫자는 노출하지 않고 막대/비율만)
  const progress = useMemo(() => {
    const order: TierName[] = ["Bronze", "Silver", "Gold", "Platinum", "Diamond"];
    const idx = order.indexOf(currentTier);
    const nextTier = idx < order.length - 1 ? order[idx + 1] : null;
    const currentThreshold = thresholds[currentTier] ?? 0;
    const nextThreshold = nextTier
      ? thresholds[nextTier] ?? currentThreshold + 400
      : currentThreshold + 400;
    const range = Math.max(1, nextThreshold - currentThreshold);
    const percent = Math.min(100, Math.max(0, Math.round(((student.rp - currentThreshold) / range) * 100)));
    return { nextTier, percent };
  }, [currentTier, student.rp, thresholds]);

  // 본인이 참여한 경기 (최신순). 상대는 display_name(별명/번호)이라 실명 노출 없음.
  const myMatches = useMemo(() => {
    return matches
      .filter(
        (m) =>
          m.playerAId === student.id ||
          m.playerBId === student.id ||
          m.playerA2Id === student.id ||
          m.playerB2Id === student.id,
      )
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [matches, student.id]);

  const style = TIER_STYLES[currentTier];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-card/60 px-3 py-1.5 text-sm font-bold text-muted-foreground transition-colors hover:bg-accent/40 hover:text-foreground cursor-pointer"
        >
          <ChevronLeft className="size-4" />
          목록으로
        </button>
        {!readOnly && (
          <button
            onClick={() => setSettingsOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-neon-blue/40 bg-neon-blue/5 px-3 py-1.5 text-sm font-bold text-neon-blue transition-colors hover:bg-neon-blue/15 cursor-pointer"
          >
            <Settings className="size-4" />
            내 카드 설정
          </button>
        )}
      </div>

      {settingsOpen && (
        <StudentCardSettings
          student={student}
          onClose={() => setSettingsOpen(false)}
          onSaved={onSaved}
          students={students}
          matches={matches}
          thresholds={thresholds}
        />
      )}

      {/* 탭: 내 기록 / 매치 추천 / 업적 */}
      <div className="flex gap-1 overflow-x-auto">
        <ViewToggle active={tab === "record"} onClick={() => setTab("record")}>
          <span className="inline-flex items-center gap-1.5"><BarChart3 className="size-4" /> 내 기록</span>
        </ViewToggle>
        {!readOnly && (
          <ViewToggle active={tab === "recommend"} onClick={() => setTab("recommend")}>
            <span className="inline-flex items-center gap-1.5"><Target className="size-4" /> 매치 추천</span>
          </ViewToggle>
        )}
        <ViewToggle active={tab === "achievements"} onClick={() => setTab("achievements")}>
          <span className="inline-flex items-center gap-1.5"><Award className="size-4" /> 업적</span>
        </ViewToggle>
      </div>

      {tab === "recommend" && !readOnly && (
        <MatchRecommend
          students={students}
          matches={matches}
          onSelectRecommendedMatch={() => {}}
          sel={recSel}
          onSelChange={() => {}}
          mode={recMode}
          onModeChange={setRecMode}
          targetGrade={recTargetGrade}
          onTargetGradeChange={setRecTargetGrade}
          targetClass={recTargetClass}
          onTargetClassChange={setRecTargetClass}
          thresholds={thresholds}
          isStudentView={true}
          isReadOnly={true}
        />
      )}

      {tab === "record" && (<>
      <div className="grid grid-cols-2 gap-3 items-stretch">
      {/* 프로필 + 티어 진행도 (3연승+면 불꽃 글로우) */}
      <Card className={cn(
        "h-full relative overflow-hidden border-border/60 bg-card/45 p-6 backdrop-blur-xl shadow-lg",
        (student.currentStreak ?? 0) >= 3 && "ring-2 ring-orange-500/50 shadow-[0_0_26px_rgba(249,115,22,0.28)]",
      )}>
        <div
          className={cn(
            "absolute -right-24 -top-24 size-64 rounded-full blur-[100px] pointer-events-none opacity-20",
            style.bg.replace("/15", ""),
          )}
        />
        <div className="relative z-10 flex flex-col gap-5">
          <div className="flex flex-col items-start gap-1.5 min-w-0">
            {/* 이름 */}
            <h2 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2 max-w-full break-keep">
              <GenderMark gender={student.gender} />
              {student.nickname && student.nickname.trim() ? (
                <span className="truncate">{student.nickname.trim()}</span>
              ) : readOnly ? (
                <span>{student.number}번</span>
              ) : (
                <button
                  onClick={() => setSettingsOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-neon-blue/50 bg-neon-blue/10 px-3 py-1.5 text-base font-bold text-neon-blue transition-all hover:bg-neon-blue/20 active:scale-95 cursor-pointer"
                >
                  <Settings className="size-4" />
                  별명 정하기
                </button>
              )}
            </h2>
            {/* 칭호 (이름과 반번호 사이) */}
            {student.title && student.title.trim() ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[11px] font-bold text-amber-400">
                🏅 {student.title.trim()}
              </span>
            ) : null}
            {/* 반번호 */}
            <span className="text-[11px] font-bold text-muted-foreground">
              {student.grade}학년 {student.classNum}반 {student.number}번
            </span>
            {/* 티어 (이름 아래) */}
            <TierBadge rp={student.rp} thresholds={thresholds} className="text-sm px-2.5 py-1" />
          </div>

          {/* 티어 진행 막대 (RP 숫자 없음) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-muted-foreground">
              <span className="flex items-center gap-1">
                <TrendingUp className="size-3.5 text-neon-blue" />
                티어 진행도
              </span>
              <span>
                {progress.nextTier ? (
                  <>
                    다음 등급:{" "}
                    <span className="text-neon-blue font-extrabold">
                      {TIER_STYLES[progress.nextTier].label}
                    </span>
                  </>
                ) : (
                  <span className="text-glow-gold text-gold flex items-center gap-1">
                    <Medal className="size-3.5" /> 최고 티어 달성!
                  </span>
                )}
              </span>
            </div>
            <div className="relative w-full h-3.5 bg-background/60 border border-border/40 rounded-full overflow-hidden p-0.5">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-700 bg-gradient-to-r",
                  currentTier === "Diamond"
                    ? "from-tier-diamond to-[#00b4d8]"
                    : currentTier === "Platinum"
                      ? "from-tier-platinum to-[#80ffdb]"
                      : currentTier === "Gold"
                        ? "from-tier-gold to-amber-300"
                        : currentTier === "Silver"
                          ? "from-tier-silver to-[#e2eafc]"
                          : "from-tier-bronze to-amber-700",
                )}
                style={{ width: `${progress.percent}%` }}
              />
            </div>
          </div>

          {/* 휴면 감점 카운트다운 */}
          {decayInfo && (
            <div className={cn(
              "rounded-xl border p-3 text-xs font-bold flex items-center justify-between gap-2.5 transition-all",
              decayInfo.warning
                ? "border-destructive/40 bg-destructive/10 text-destructive animate-pulse"
                : "border-border/50 bg-background/40 text-muted-foreground"
            )}>
              <span className="flex items-center gap-1.5 leading-relaxed">
                <Hourglass className="size-3.5 shrink-0" />
                {decayInfo.daysRemaining <= 0
                  ? `미활동으로 곧 RP ${decayInfo.decayRp}점이 차감됩니다. 지금 대결하세요!`
                  : `대결이 없으면 ${decayInfo.daysRemaining}일 후 RP ${decayInfo.decayRp}점이 차감돼요.`}
              </span>
              <span className={cn(
                "text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded border shrink-0",
                decayInfo.warning
                  ? "text-destructive bg-destructive/15 border-destructive/20"
                  : "text-muted-foreground bg-card/65 border-border/40"
              )}>
                {decayInfo.daysRemaining <= 0 ? "감점 임박!" : `D-${decayInfo.daysRemaining}`}
              </span>
            </div>
          )}
        </div>
      </Card>

      {/* 나의 전적 — 프로필과 같은 행 */}
      <MyStatsSummary student={student} matches={matches} matchesLoading={matchesLoading} />
      </div>

      {/* 경기 스타일 + 나의 라이벌(2명) */}
      <MyStatsDetail
        student={student}
        students={students}
        matches={matches}
        matchesLoading={matchesLoading}
        thresholds={thresholds}
      />
      </>)}

      {/* 업적 탭 */}
      {tab === "achievements" && (
        <MyAchievements studentId={student.id} />
      )}
    </div>
  );
}
