import { useMemo, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TierBadge } from "./TierBadge";
import { GenderMark } from "./GenderMark";
import { cn } from "@/lib/utils";
import { 
  Swords,
  Sparkles,
  AlertCircle, 
  X, 
  Dices, 
  Award,
  Flame,
  ArrowRight, 
  Users, 
  RotateCcw, 
  Trophy,
  UserCheck,
  UserPlus,
  ChevronDown,
  Search
} from "lucide-react";
import type { Student, Match, TierName } from "@/lib/league-types";
import { getTier } from "@/lib/league-types";
import { useLeagueStore } from "@/lib/league-store";
import { toast } from "sonner";

const GRADES = [1, 2, 3, 4, 5, 6];
const CLASSES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

type Selection = { grade: number | null; classNum: number | null; studentId: string | null };

const TIER_RANK_MAP: Record<string, number> = {
  Bronze: 1,
  Silver: 2,
  Gold: 3,
  Platinum: 4,
  Diamond: 5
};

type RecTag = { label: string; style: string; desc: string };

// 태그 칩 — 클릭 시 설명 펼침(접이식). 항상 노출하던 설명 리스트를 대체.
function TagAccordion({ tags }: { tags: RecTag[] }) {
  const [open, setOpen] = useState<string | null>(null);
  if (!tags || tags.length === 0) return null;
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-1">
        {tags.map((tag) => (
          <button
            key={tag.label}
            type="button"
            onClick={(e) => { e.stopPropagation(); setOpen(open === tag.label ? null : tag.label); }}
            className={cn(
              "inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider border transition-all active:scale-95 cursor-pointer",
              tag.style,
            )}
          >
            {tag.label}
            <ChevronDown className={cn("size-2.5 transition-transform", open === tag.label && "rotate-180")} />
          </button>
        ))}
      </div>
      {open && (
        <div className="rounded border border-surface-line bg-surface-deep p-2 text-[10px] leading-relaxed text-strong animate-in fade-in slide-in-from-top-1 duration-150">
          {tags.find((t) => t.label === open)?.desc}
        </div>
      )}
    </div>
  );
}

// 예상 RP 미리보기 — 승/패 칩(sky/rose) + "예상 추정치" 라벨
function RpPreview({ win, loss }: { win: number; loss: number }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-black bg-sky-500/10 text-sky-300 ring-1 ring-inset ring-sky-500/20">
        <span>승</span><span className="font-mono">+{win}</span>
      </span>
      <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-black bg-rose-500/10 text-rose-300 ring-1 ring-inset ring-rose-500/20">
        <span>패</span><span className="font-mono">{loss}</span>
      </span>
      <span className="text-[9px] text-soft">예상 추정치</span>
    </div>
  );
}

export function MatchRecommend({
  students,
  matches,
  onSelectRecommendedMatch,
  sel,
  onSelChange,
  mode,
  onModeChange,
  targetGrade,
  onTargetGradeChange,
  targetClass,
  onTargetClassChange,
  thresholds,
  onUpdateGender,
  isStudentView = false,
  isReadOnly = false,
}: {
  students: Student[];
  matches: Match[];
  onSelectRecommendedMatch: (
    playerAId: string,
    playerBId: string,
    playerA2Id?: string,
    playerB2Id?: string,
    matchType?: "single" | "double"
  ) => void;
  sel: Selection;
  onSelChange: (s: Selection) => void;
  mode: "class" | "otherClass" | "otherGrade";
  onModeChange: (m: "class" | "otherClass" | "otherGrade") => void;
  targetGrade: number | null;
  onTargetGradeChange: (g: number | null) => void;
  targetClass: number | null;
  onTargetClassChange: (c: number | null) => void;
  thresholds?: Record<string, number>;
  onUpdateGender?: (studentId: string, gender: "M" | "F" | "U") => void;
  isStudentView?: boolean;
  isReadOnly?: boolean;
}) {
  const { dynamicBonuses, dynamicPenalties, tiers } = useLeagueStore();
  
  // Local states for MatchRecommend 2.0
  const [gameType, setGameType] = useState<"single" | "double">("single");
  const [selectedTeammateId, setSelectedTeammateId] = useState<string | null>(null);
  const [teammateSearch, setTeammateSearch] = useState("");

  // Active analysis player profile
  const player = students.find((s) => s.id === sel.studentId) ?? null;

  // 성별 정보 누락 자동 완성을 위한 상태
  const [genderModalOpen, setGenderModalOpen] = useState(false);
  const [genderTargetId, setGenderTargetId] = useState<string | null>(null);

  // A선수 선택 시 성별이 "U"이거나 없을 때 모달 팝업 트리거 (학생 전용 화면에서는 성별 편집 불가 → 비활성)
  useEffect(() => {
    if (isStudentView) return;
    if (sel.studentId) {
      const selectedStudent = students.find((s) => s.id === sel.studentId);
      if (selectedStudent && (selectedStudent.gender === "U" || !selectedStudent.gender)) {
        setGenderTargetId(selectedStudent.id);
        setGenderModalOpen(true);
      }
    }
  }, [sel.studentId, students, isStudentView]);

  // 성별 보완 모달 트리거 (Teammate 선택 시에도 성별 체크)
  useEffect(() => {
    if (isStudentView) return;
    if (selectedTeammateId) {
      const partner = students.find((s) => s.id === selectedTeammateId);
      if (partner && (partner.gender === "U" || !partner.gender)) {
        setGenderTargetId(partner.id);
        setGenderModalOpen(true);
      }
    }
  }, [selectedTeammateId, students, isStudentView]);

  const handleUpdateGender = (gender: "M" | "F") => {
    if (genderTargetId) {
      onUpdateGender?.(genderTargetId, gender);
      setGenderModalOpen(false);
      setGenderTargetId(null);
      toast.success("선수의 성별이 정상 등록되었습니다!");
    }
  };

  const handleCancelGender = () => {
    if (genderTargetId) {
      if (sel.studentId === genderTargetId) {
        onSelChange({ ...sel, studentId: null });
      }
      if (selectedTeammateId === genderTargetId) {
        setSelectedTeammateId(null);
      }
    }
    setGenderModalOpen(false);
    setGenderTargetId(null);
    toast.warning("성별을 입력하지 않아 선수 선택이 취소되었습니다.");
  };

  // 1. Grade & Class options for dropdowns
  const classesForSel = useMemo(() => {
    if (sel.grade == null) return [];
    const set = new Set<number>();
    students.filter((s) => s.grade === sel.grade).forEach((s) => set.add(s.classNum));
    return Array.from(set).sort((a, b) => a - b);
  }, [students, sel.grade]);

  const rosterForSel = useMemo(() => {
    if (sel.grade == null || sel.classNum == null) return [];
    return students
      .filter((s) => s.grade === sel.grade && s.classNum === sel.classNum)
      .sort((a, b) => a.number - b.number);
  }, [students, sel.grade, sel.classNum]);

  // Options for matching scopes
  const availableClassesForGrade = useMemo(() => {
    if (!player) return [];
    const set = new Set<number>();
    students.filter((s) => s.grade === player.grade).forEach((s) => set.add(s.classNum));
    return Array.from(set).sort((a, b) => a - b);
  }, [students, player]);

  const availableGrades = useMemo(() => {
    const set = new Set<number>();
    students.forEach((s) => set.add(s.grade));
    return Array.from(set).sort((a, b) => a - b);
  }, [students]);

  const availableClassesForTargetGrade = useMemo(() => {
    if (targetGrade == null) return [];
    const set = new Set<number>();
    students.filter((s) => s.grade === targetGrade).forEach((s) => set.add(s.classNum));
    return Array.from(set).sort((a, b) => a - b);
  }, [students, targetGrade]);

  // Dice Rolls
  const handleRandomClass = () => {
    if (!player) return;
    const otherClasses = availableClassesForGrade.filter((c) => c !== player.classNum);
    if (otherClasses.length === 0) {
      toast.warning("동일 학년 내에 대결할 다른 학급 데이터가 명렬표에 없습니다.");
      return;
    }
    const rand = otherClasses[Math.floor(Math.random() * otherClasses.length)];
    onTargetClassChange(rand);
    toast.success(`🎲 주사위를 굴려 [${player.grade}학년 ${rand}반]을(를) 매칭 범위로 선택했습니다!`);
  };

  const handleRandomGradeClass = () => {
    if (!player) return;
    const pairs: { grade: number; classNum: number }[] = [];
    const seen = new Set<string>();

    students.forEach((s) => {
      if (s.grade === player.grade && s.classNum === player.classNum) return;
      const key = `${s.grade}-${s.classNum}`;
      if (!seen.has(key)) {
        seen.add(key);
        pairs.push({ grade: s.grade, classNum: s.classNum });
      }
    });

    if (pairs.length === 0) {
      toast.warning("도전할 수 있는 다른 학년/반 데이터가 명렬표에 없습니다.");
      return;
    }

    const rand = pairs[Math.floor(Math.random() * pairs.length)];
    onTargetGradeChange(rand.grade);
    onTargetClassChange(rand.classNum);
    toast.success(`🎲 주사위를 굴려 [${rand.grade}학년 ${rand.classNum}반]을(를) 매칭 범위로 선택했습니다!`);
  };

  // Compile player matches histories
  const playerMatches = useMemo(() => {
    if (!player) return [];
    return matches
      .filter((m) => m.playerAId === player.id || m.playerBId === player.id || m.playerA2Id === player.id || m.playerB2Id === player.id)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [player, matches]);

  // Compile set of player's recent opponents (last 5 matches)
  const recentOpponentIds = useMemo(() => {
    const set = new Set<string>();
    if (!player) return set;
    playerMatches.slice(0, 5).forEach((m) => {
      const isOnTeamA = m.playerAId === player.id || m.playerA2Id === player.id;
      const oppIds = isOnTeamA 
        ? [m.playerBId, m.playerB2Id].filter(Boolean) as string[] 
        : [m.playerAId, m.playerA2Id].filter(Boolean) as string[];
      oppIds.forEach(id => set.add(id));
    });
    return set;
  }, [player, playerMatches]);

  // Compile set of strict excluded opponents (last 2 matches opponents + self)
  const strictExcludedIds = useMemo(() => {
    const set = new Set<string>();
    if (!player) return set;
    set.add(player.id);
    playerMatches.slice(0, 2).forEach((m) => {
      const isOnTeamA = m.playerAId === player.id || m.playerA2Id === player.id;
      const oppIds = isOnTeamA 
        ? [m.playerBId, m.playerB2Id].filter(Boolean) as string[] 
        : [m.playerAId, m.playerA2Id].filter(Boolean) as string[];
      oppIds.forEach(id => set.add(id));
    });
    return set;
  }, [player, playerMatches]);

  // helper function for calculating expected RP win/loss preview
  const getExpectedDelta = (
    subject: Student,
    opp1: Student,
    isWon: boolean,
    partner: Student | null = null,
    opp2: Student | null = null
  ): number => {
    const isDouble = partner !== null && opp2 !== null;
    const playerTier = getTier(subject.rp, thresholds);
    const tierKey = playerTier.toLowerCase() as 'bronze'|'silver'|'gold'|'platinum'|'diamond';
    
    const baseWin = tiers?.[tierKey]?.winRp ?? 10;
    const baseLoss = tiers?.[tierKey]?.loseRp ?? 20;

    const TIER_NUM: Record<string, number> = { Bronze: 0, Silver: 1, Gold: 2, Platinum: 3, Diamond: 4 };
    const myTierNum = TIER_NUM[playerTier] ?? 0;

    const maxOppRp = isDouble && opp2 ? Math.max(opp1.rp, opp2.rp) : opp1.rp;
    const maxOppTier = getTier(maxOppRp, thresholds);
    const maxOppTierNum = TIER_NUM[maxOppTier] ?? 0;
    const tierDiff = maxOppTierNum - myTierNum;

    if (isWon) {
      let bonus = 0;

      // Underdog victory check
      if (dynamicBonuses?.underdogEnabled) {
        if (tierDiff === 1) {
          bonus += dynamicBonuses.underdogDiff1Rp ?? 5;
        } else if (tierDiff === 2) {
          bonus += dynamicBonuses.underdogDiff2Rp ?? 10;
        } else if (tierDiff >= 3) {
          bonus += dynamicBonuses.underdogDiff3Rp ?? 15;
        }
      }

      // Freshness bonus
      const isFresh = !recentOpponentIds.has(opp1.id) && (!opp2 || !recentOpponentIds.has(opp2.id));
      if (dynamicBonuses?.freshnessEnabled && isFresh) {
        bonus += dynamicBonuses.freshnessRp ?? 5;
      }

      // Win streak bonus
      if (dynamicBonuses?.streakEnabled && playerTier !== "Platinum" && playerTier !== "Diamond") {
        const preStreak = subject.currentStreak ?? 0;
        const targetStreak = dynamicBonuses.streakWins ?? 3;
        if (preStreak + 1 >= targetStreak) {
          bonus += dynamicBonuses.streakRp ?? 10;
        }
      }

      // First Win of the day
      const today = new Date();
      const todayYmd = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
      if (dynamicBonuses?.firstWinEnabled && subject.lastWinDate !== todayYmd) {
        bonus += dynamicBonuses.firstWinRp ?? 15;
      }

      // Revenge bonus
      if (dynamicBonuses?.revengeEnabled) {
        const sRecentMatches = playerMatches.slice(0, 20);
        const hasPastLoss = sRecentMatches.some((m) => {
          const mTeamA = [m.playerAId, m.playerA2Id].filter(Boolean) as string[];
          const mTeamB = [m.playerBId, m.playerB2Id].filter(Boolean) as string[];
          const mAWon = m.scoreA > m.scoreB;
          
          const sIsOnA = mTeamA.includes(subject.id);
          const sIsOnB = mTeamB.includes(subject.id);
          const lost = (sIsOnA && !mAWon) || (sIsOnB && mAWon);

          const oppIds = isDouble && opp2 ? [opp1.id, opp2.id] : [opp1.id];
          const facedAnyOpp = mTeamA.some(id => oppIds.includes(id)) || mTeamB.some(id => oppIds.includes(id));
          return lost && facedAnyOpp;
        });
        if (hasPastLoss) {
          bonus += dynamicBonuses.revengeRp ?? 10;
        }
      }

      // Will of Steel (불굴의 의지)
      if (dynamicBonuses?.willOfSteelEnabled) {
        const preStreak = subject.currentStreak ?? 0;
        if (preStreak <= -3) {
          const lossesCount = Math.abs(preStreak);
          if (lossesCount === 3) {
            bonus += dynamicBonuses.willOfSteel3Rp ?? 10;
          } else if (lossesCount === 4) {
            bonus += dynamicBonuses.willOfSteel4Rp ?? 15;
          } else if (lossesCount >= 5) {
            bonus += dynamicBonuses.willOfSteel5Rp ?? 20;
          }
        }
      }

      // Mentoring bonus
      if (isDouble && partner && dynamicBonuses?.mentoring?.enabled) {
        const partnerTier = getTier(partner.rp, thresholds);
        const myTierRank = TIER_RANK_MAP[playerTier] ?? 1;
        const partnerTierRank = TIER_RANK_MAP[partnerTier] ?? 1;
        const minGap = dynamicBonuses.mentoring.minTierGap ?? 1;
        const gap = Math.abs(myTierRank - partnerTierRank);
        if (gap >= minGap) {
          if (myTierRank > partnerTierRank) {
            bonus += dynamicBonuses.mentoring.mentorRp ?? 10;
          } else if (myTierRank < partnerTierRank) {
            bonus += dynamicBonuses.mentoring.menteeRp ?? 15;
          }
        }
      }

      // Great match bonus (hypothesized 1-point diff tight match victory)
      if (dynamicBonuses?.greatMatchEnabled) {
        bonus += dynamicBonuses.greatMatchWin1Rp ?? 10;
      }

      return baseWin + bonus;
    } else {
      let penalty = 0;

      // Freshness bonus (for loss too!)
      const isFresh = !recentOpponentIds.has(opp1.id) && (!opp2 || !recentOpponentIds.has(opp2.id));
      const freshnessBonus = (dynamicBonuses?.freshnessEnabled && isFresh) ? (dynamicBonuses.freshnessRp ?? 5) : 0;

      // Loss Comfort (꺾이지 않는 마음)
      let lossComfortBonus = 0;
      if (dynamicBonuses?.lossComfortEnabled) {
        const maxTier = dynamicBonuses.lossComfortMaxTier || "Gold";
        const maxTierRank = TIER_NUM[maxTier] ?? 2;
        if (myTierNum <= maxTierRank) {
          const preStreak = subject.currentStreak ?? 0;
          const currentLossStreak = preStreak <= 0 ? Math.abs(preStreak) + 1 : 1;
          if (currentLossStreak >= 2) {
            lossComfortBonus = dynamicBonuses.lossComfortRp ?? 5;
          }
        }
      }

      // Swamp penalty
      if (dynamicPenalties?.lossStreak) {
        const preStreak = subject.currentStreak ?? 0;
        const currentLossStreak = preStreak <= 0 ? Math.abs(preStreak) + 1 : 1;
        if (currentLossStreak >= 2) {
          if (currentLossStreak === 2) {
            if (playerTier === "Gold") penalty += dynamicPenalties.swampGold2 ?? 5;
            else if (playerTier === "Platinum") penalty += dynamicPenalties.swampPlatinum2 ?? 10;
            else if (playerTier === "Diamond") penalty += dynamicPenalties.swampDiamond2 ?? 15;
          } else if (currentLossStreak >= 3) {
            if (playerTier === "Gold") penalty += dynamicPenalties.swampGold3 ?? 10;
            else if (playerTier === "Platinum") penalty += dynamicPenalties.swampPlatinum3 ?? 15;
            else if (playerTier === "Diamond") penalty += dynamicPenalties.swampDiamond3 ?? 25;
          }
        }
      }

      // Champion Weight penalty
      if (dynamicPenalties?.championWeight) {
        if (playerTier === "Gold") penalty += dynamicPenalties.championGold ?? 5;
        else if (playerTier === "Platinum") penalty += dynamicPenalties.championPlatinum ?? 10;
        else if (playerTier === "Diamond") penalty += dynamicPenalties.championDiamond ?? 15;
      }

      // Arrogance penalty
      if (dynamicPenalties?.arrogance && myTierNum - maxOppTierNum >= 2) {
        if (playerTier === "Gold") penalty += dynamicPenalties.arroganceGold ?? 20;
        else if (playerTier === "Platinum") penalty += dynamicPenalties.arrogancePlatinum ?? 30;
        else if (playerTier === "Diamond") penalty += dynamicPenalties.arroganceDiamond ?? 40;
      }

      // Revenge Fail penalty (opponent successfully revenges)
      if (dynamicPenalties?.revengeFail) {
        const sRecentMatches = playerMatches.slice(0, 20);
        const opponentIds = isDouble && opp2 ? [opp1.id, opp2.id] : [opp1.id];
        const subjectWonPastMatch = sRecentMatches.some((m) => {
          const mTeamA = [m.playerAId, m.playerA2Id].filter(Boolean) as string[];
          const mTeamB = [m.playerBId, m.playerB2Id].filter(Boolean) as string[];
          const mAWon = m.scoreA > m.scoreB;
          
          const sIsOnA = mTeamA.includes(subject.id);
          const sIsOnB = mTeamB.includes(subject.id);
          const subjectWon = (sIsOnA && mAWon) || (sIsOnB && !mAWon);

          const facedAnyOpp = mTeamA.some(id => opponentIds.includes(id)) || mTeamB.some(id => opponentIds.includes(id));
          return subjectWon && facedAnyOpp;
        });
        if (subjectWonPastMatch) {
          if (playerTier === "Gold") penalty += dynamicPenalties.revengeAllowedGold ?? 10;
          else if (playerTier === "Platinum") penalty += dynamicPenalties.revengeAllowedPlatinum ?? 15;
          else if (playerTier === "Diamond") penalty += dynamicPenalties.revengeAllowedDiamond ?? 20;
        }
      }

      // Great match bonus (hypothesized 1-point diff tight match defeat)
      let greatMatchBonus = 0;
      if (dynamicBonuses?.greatMatchEnabled) {
        greatMatchBonus = dynamicBonuses.greatMatchLose1Rp ?? 5;
      }

      return -baseLoss + freshnessBonus + lossComfortBonus + greatMatchBonus - penalty;
    }
  };

  // ----------------------------------------------------
  // [단식 추천 엔진]
  // ----------------------------------------------------
  const singleRecommendations = useMemo(() => {
    if (!player || gameType !== "single") return [];

    let candidates = students.filter((s) => !strictExcludedIds.has(s.id));

    // Filter by scope
    if (mode === "class") {
      candidates = candidates.filter(
        (c) => c.grade === player.grade && c.classNum === player.classNum
      );
    } else if (mode === "otherClass") {
      if (targetClass == null) return [];
      candidates = candidates.filter(
        (c) => c.grade === player.grade && c.classNum === targetClass
      );
    } else if (mode === "otherGrade") {
      if (targetGrade == null || targetClass == null) return [];
      candidates = candidates.filter(
        (c) => c.grade === targetGrade && c.classNum === targetClass
      );
    }

    const scored = candidates.map((candidate) => {
      let score = 100;

      const rpGap = Math.abs(candidate.rp - player.rp);
      
      // 1. RP proximity
      if (rpGap <= 150) {
        score += (150 - rpGap);
      } else {
        score -= (rpGap - 150) * 0.5;
      }

      // 2. Same grade/class boosts
      if (candidate.grade === player.grade) score += 50;
      if (candidate.classNum === player.classNum) score += 30;

      // 3. Upward challenge incentive
      const rpDelta = candidate.rp - player.rp;
      if (rpDelta >= 10 && rpDelta <= 150) score += 40;

      // 4. Freshness
      const isRecentOpp = recentOpponentIds.has(candidate.id);
      if (!isRecentOpp) score += 40;

      // 5. Low activity candidate
      const totalMatches = candidate.wins + candidate.losses;
      if (totalMatches < 5) score += 25;

      // Tag determination
      const playerTier = getTier(player.rp, thresholds);
      const candidateTier = getTier(candidate.rp, thresholds);
      const playerTierIdx = TIER_RANK_MAP[playerTier] ?? 1;
      const candidateTierIdx = TIER_RANK_MAP[candidateTier] ?? 1;
      
      const tags: { label: string; style: string; desc: string }[] = [];
      
      if (!isRecentOpp) {
        tags.push({ 
          label: "🤝 새로운 인연", 
          style: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
          desc: "최근 5경기 동안 만난 적이 없습니다. 승패 무관하게 신선도 보너스를 받습니다." 
        });
      }
      if (candidateTierIdx - playerTierIdx >= 2) {
        tags.push({ 
          label: "🔥 언더독의 반란", 
          style: "bg-rose-500/15 text-rose-400 border-rose-500/30",
          desc: "상대가 2티어 높습니다. 승리 시 막대한 보너스를 얻습니다." 
        });
      }
      if (rpGap <= 80) {
        tags.push({ 
          label: "⚔️ 명승부 예상", 
          style: "bg-neon-blue/15 text-neon-blue border-neon-blue/30",
          desc: "RP가 비슷하여 1~2점 차 접전이 예상됩니다." 
        });
      }
      if (totalMatches < 5) {
        tags.push({ 
          label: "🌱 교류 환영", 
          style: "bg-purple-500/15 text-purple-400 border-purple-500/30",
          desc: "최근 경기 수가 적은 학생입니다. 함께 플레이하며 리그를 활성화해주세요." 
        });
      }

      return {
        student: candidate,
        score: Math.max(0, Math.round(score)),
        tags
      };
    });

    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, 6);
  }, [player, students, gameType, strictExcludedIds, mode, targetClass, targetGrade, thresholds, recentOpponentIds]);

  // ----------------------------------------------------
  // [복식 1단계: 팀원 추천 엔진]
  // ----------------------------------------------------
  const partnerRecommendations = useMemo(() => {
    if (!player || gameType !== "double") return [];

    // Partner candidates must be from the same grade (or class, but same class/grade is normal)
    // Exclude self
    let candidates = students.filter((s) => s.id !== player.id && s.grade === player.grade);

    // Prefer classmates
    const classmates = candidates.filter((c) => c.classNum === player.classNum);
    if (classmates.length > 0) {
      candidates = classmates;
    }

    // 후보별 "같은 팀으로 뛴 횟수" 집계 (시즌 전체 복식 기록 기준)
    // → 다양성 신호: 한 번도 안 짚은 친구일수록 높게.
    const pairCountByCandidate = new Map<string, number>();
    playerMatches.forEach((m) => {
      if (m.matchType !== "double") return;
      const isOnTeamA = m.playerAId === player.id || m.playerA2Id === player.id;
      const partnerId = isOnTeamA
        ? (m.playerAId === player.id ? m.playerA2Id : m.playerAId)
        : (m.playerBId === player.id ? m.playerB2Id : m.playerBId);
      if (partnerId) pairCountByCandidate.set(partnerId, (pairCountByCandidate.get(partnerId) ?? 0) + 1);
    });

    const scored = candidates.map((candidate) => {
      const pairCount = pairCountByCandidate.get(candidate.id) ?? 0;
      const rpDiff = Math.abs(player.rp - candidate.rp);

      // 다양성 점수 (0~100): 안 해본 짝 우선
      const diversityScore =
        pairCount === 0 ? 100
        : pairCount === 1 ? 55
        : pairCount === 2 ? 35
        : Math.max(0, 20 - (pairCount - 3) * 10);

      // 실력 균형 점수 (0~100): RP가 가까울수록 높음
      const balanceScore = Math.max(0, 100 - rpDiff * 0.5);

      // 50:50 혼합
      let score = diversityScore * 0.5 + balanceScore * 0.5;

      const tags: { label: string; style: string; desc: string }[] = [];

      // 다양성(동반 횟수) 등급 태그
      if (pairCount === 0) {
        tags.push({
          label: "🌟 처음 만나는 짝꿍",
          style: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
          desc: "이번 시즌 한 번도 같은 팀으로 뛴 적이 없어요. 새로운 친구와 호흡을 맞춰볼 좋은 기회예요!"
        });
      } else if (pairCount <= 2) {
        tags.push({
          label: "🔄 가끔 호흡 맞춘 사이",
          style: "bg-sky-500/15 text-sky-300 border-sky-500/30",
          desc: `이번 시즌 ${pairCount}번 같은 팀이었어요. 한 번 더 손발을 맞춰볼까요?`
        });
      } else {
        tags.push({
          label: "👯 자주 함께한 단골",
          style: "bg-slate-700/40 text-strong border-slate-600/40",
          desc: `이번 시즌 ${pairCount}번이나 같은 팀이었어요. 가끔은 새로운 친구와도 팀을 이뤄보세요!`
        });
      }

      // 실력 짝꿍 (균형)
      if (rpDiff <= 100) {
        tags.push({
          label: "⚖️ 실력 짝꿍",
          style: "bg-neon-blue/15 text-neon-blue border-neon-blue/30",
          desc: "RP가 비슷해 손발이 잘 맞는 균형 잡힌 복식 짝꿍이에요."
        });
      }

      // 함께 시작(신입 포함)
      if (candidate.wins + candidate.losses < 5) {
        score += 10;
        tags.push({
          label: "🌱 함께 시작",
          style: "bg-purple-500/15 text-purple-400 border-purple-500/30",
          desc: "아직 경기 경험이 적은 친구예요. 함께 팀을 이뤄 리그를 즐겨보세요!"
        });
      }

      // 멘토링 (설정 활성 시에만)
      const playerTierRank = TIER_RANK_MAP[getTier(player.rp, thresholds)] ?? 1;
      const partnerTierRank = TIER_RANK_MAP[getTier(candidate.rp, thresholds)] ?? 1;
      const minGap = dynamicBonuses?.mentoring?.minTierGap ?? 1;
      const isMentoring = !!(dynamicBonuses?.mentoring?.enabled && Math.abs(playerTierRank - partnerTierRank) >= minGap);
      if (isMentoring) {
        score += 10;
        tags.push({
          label: "🎓 멘토링",
          style: "bg-amber-500/15 text-amber-400 border-amber-500/30",
          desc: `티어 격차가 멘토링 조건(최소 ${minGap}단계)을 만족해, 승리 시 멘토링 보너스를 얻어요.`
        });
      }

      return {
        student: candidate,
        score: Math.max(0, Math.round(score)),
        tags
      };
    });

    return scored.sort((a, b) => b.score - a.score);
  }, [player, students, gameType, playerMatches, thresholds, dynamicBonuses]);

  // ----------------------------------------------------
  // [복식 2단계: 상대 팀 매칭 엔진]
  // ----------------------------------------------------
  const doubleOpponentRecommendations = useMemo(() => {
    if (!player || !selectedTeammateId || gameType !== "double") return [];
    
    const partner = students.find((s) => s.id === selectedTeammateId);
    if (!partner) return [];

    const ourCombinedRp = player.rp + partner.rp;

    // Opponent candidates pool
    let oppCandidates = students.filter((s) => s.id !== player.id && s.id !== partner.id);

    // Apply matching scope filter
    if (mode === "class") {
      oppCandidates = oppCandidates.filter(
        (c) => c.grade === player.grade && c.classNum === player.classNum
      );
    } else if (mode === "otherClass") {
      if (targetClass == null) return [];
      oppCandidates = oppCandidates.filter(
        (c) => c.grade === player.grade && c.classNum === targetClass
      );
    } else if (mode === "otherGrade") {
      if (targetGrade == null || targetClass == null) return [];
      oppCandidates = oppCandidates.filter(
        (c) => c.grade === targetGrade && c.classNum === targetClass
      );
    }

    if (oppCandidates.length < 2) return [];

    // Generate opponent pairs
    const pairs: { o1: Student; o2: Student; combinedRp: number; rpGap: number; score: number; tags?: { label: string; style: string; desc: string }[] }[] = [];

    for (let i = 0; i < oppCandidates.length; i++) {
      for (let j = i + 1; j < oppCandidates.length; j++) {
        const o1 = oppCandidates[i];
        const o2 = oppCandidates[j];

        const combinedRp = o1.rp + o2.rp;
        const rpGap = Math.abs(ourCombinedRp - combinedRp);

        let score = 100;
        
        // RP gap penalty
        score -= rpGap * 1.5;

        // Freshness: check if either opponent has played against us recently
        const playedRecently = playerMatches.slice(0, 5).some((m) => {
          const ids = [m.playerAId, m.playerBId, m.playerA2Id, m.playerB2Id];
          return ids.includes(o1.id) || ids.includes(o2.id);
        });
        if (!playedRecently) score += 35;

        // Balanced internal matchmaking
        const internalGap = Math.abs(o1.rp - o2.rp);
        if (internalGap <= 150) score += 20;

        // Tags
        const tags: { label: string; style: string; desc: string }[] = [];
        if (!playedRecently) {
          tags.push({
            label: "🤝 새로운 인연",
            style: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
            desc: "최근 5경기 동안 이 상대팀원과 만난 적이 없습니다. 승패 무관하게 신선도 보너스를 받습니다."
          });
        }

        const maxOppRp = Math.max(o1.rp, o2.rp);
        const maxOppTier = getTier(maxOppRp, thresholds);
        const myTier = getTier(player.rp, thresholds);
        const TIER_NUM: Record<string, number> = { Bronze: 0, Silver: 1, Gold: 2, Platinum: 3, Diamond: 4 };
        const myTierNum = TIER_NUM[myTier] ?? 0;
        const maxOppTierNum = TIER_NUM[maxOppTier] ?? 0;
        if (maxOppTierNum - myTierNum >= 2) {
          tags.push({
            label: "🔥 언더독의 반란",
            style: "bg-rose-500/15 text-rose-400 border-rose-500/30",
            desc: "상대 팀에 본인보다 2티어 이상 높은 강자가 포함되어 있습니다. 승리 시 막대한 보너스를 얻습니다."
          });
        }

        if (rpGap <= 40) {
          tags.push({
            label: "⚔️ 명승부 예상",
            style: "bg-neon-blue/15 text-neon-blue border-neon-blue/30",
            desc: "팀 합산 RP 격차가 40점 이하로 대등합니다. 치열한 접전이 예상됩니다."
          });
        }

        if (o1.wins + o1.losses < 5 || o2.wins + o2.losses < 5) {
          tags.push({
            label: "🌱 교류 환영",
            style: "bg-purple-500/15 text-purple-400 border-purple-500/30",
            desc: "최근 경기 수가 적은 학생이 포함된 팀입니다. 함께 플레이하며 리그를 활성화해주세요."
          });
        }

        pairs.push({
          o1,
          o2,
          combinedRp,
          rpGap,
          score: Math.max(0, Math.round(score)),
          tags
        });
      }
    }

    return pairs
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
  }, [player, selectedTeammateId, students, gameType, mode, targetClass, targetGrade, playerMatches, thresholds, recentOpponentIds, dynamicBonuses]);

  const showPromptToSelect = useMemo(() => {
    if (!player) return false;
    if (mode === "otherClass" && targetClass == null) return true;
    if (mode === "otherGrade" && (targetGrade == null || targetClass == null)) return true;
    return false;
  }, [player, mode, targetGrade, targetClass]);

  const selectedTeammate = useMemo(() => {
    return students.find((s) => s.id === selectedTeammateId) ?? null;
  }, [selectedTeammateId, students]);

  return (
    <div className="space-y-6">
      
      {/* Compact Button Grid selectors (only visible if not student view) */}
        {!isStudentView && !player && (
          <Card className="border-surface-line bg-surface-panel p-5 backdrop-blur flex flex-col gap-4">

            {/* 안내 헤더 — 빈 화면에 바로 학년 그리드가 뜨지 않도록 맥락 제공 */}
            <div className="flex items-center gap-2.5">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-neon-blue/30 bg-neon-blue/10">
                <Sparkles className="size-4.5 text-neon-blue" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-black text-strong">추천받을 선수 선택</h3>
                <p className="text-[11px] text-soft">학년 → 반 → 학생을 고르면 맞춤 대전 상대를 추천해 드려요</p>
              </div>
            </div>

            {/* 1. Grade Select Button Grid */}
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-soft block">1. 학년 선택</label>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {availableGrades.map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => {
                      onSelChange({ grade: g, classNum: null, studentId: null });
                      setSelectedTeammateId(null);
                    }}
                    className={cn(
                      "h-10 rounded-lg border text-xs font-black transition-all active:scale-95 flex items-center justify-center cursor-pointer",
                      sel.grade === g
                        ? "border-neon-blue bg-neon-blue/20 text-neon-blue glow-primary"
                        : "border-surface-line bg-surface-deep text-soft hover:text-strong"
                    )}
                  >
                    {g}학년
                  </button>
                ))}
              </div>
            </div>
            
            {/* 2. Class Select Button Grid */}
            {sel.grade != null && (
              <div className="space-y-2 animate-in slide-in-from-top-1 duration-200">
                <label className="text-[11px] font-bold text-soft block">2. 반 선택</label>
                <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                  {classesForSel.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => {
                        onSelChange({ ...sel, classNum: c, studentId: null });
                        setSelectedTeammateId(null);
                      }}
                      className={cn(
                        "h-10 rounded-lg border text-xs font-black transition-all active:scale-95 flex items-center justify-center cursor-pointer",
                        sel.classNum === c
                          ? "border-neon-blue bg-neon-blue/20 text-neon-blue glow-primary"
                          : "border-surface-line bg-surface-deep text-soft hover:text-strong"
                      )}
                    >
                      {c}반
                    </button>
                  ))}
                  {classesForSel.length === 0 && (
                    <span className="text-xs text-soft py-1 col-span-full">등록된 반이 없습니다.</span>
                  )}
                </div>
              </div>
            )}

            {/* 3. Student Select Button Grid */}
            {sel.classNum != null && (
              <div className="space-y-2 animate-in slide-in-from-top-1 duration-200">
                <label className="text-[11px] font-bold text-soft block">3. 학생 선택</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                  {rosterForSel.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => onSelChange({ ...sel, studentId: s.id })}
                      className={cn(
                        "relative rounded-lg border p-3 flex flex-col justify-between items-center text-center transition-all h-20 hover:border-neon-blue/60 hover:bg-surface-panel cursor-pointer w-full overflow-hidden",
                        sel.studentId === s.id
                          ? "border-neon-blue bg-neon-blue/10 text-neon-blue glow-primary"
                          : "border-surface-line bg-surface-deep text-strong"
                      )}
                    >
                      <span className="absolute top-1 left-1.5 text-[9px] text-soft font-mono">
                        {s.number}번
                      </span>
                      <GenderMark 
                        gender={s.gender} 
                        className="absolute top-1 right-1.5 size-3 text-[8px]" 
                      />
                      <span className="text-xs font-black mt-2 text-strong">{s.realName || s.name}</span>
                      <div className="mt-1 flex items-center gap-1">
                        <span className="text-[9px] text-soft font-mono font-bold">{s.rp} RP</span>
                        <TierBadge rp={s.rp} thresholds={thresholds} />
                      </div>
                    </button>
                  ))}
                  {rosterForSel.length === 0 && (
                    <span className="text-xs text-soft py-1 col-span-full">반에 학생이 없습니다.</span>
                  )}
                </div>
              </div>
            )}
          </Card>
        )}


        {/* Profile Card if student view or player selected */}
        {player && (
          <div className="relative rounded-xl border border-neon-blue/40 bg-surface-panel p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            {!isStudentView && (
              <button
                onClick={() => {
                  onSelChange({ grade: sel.grade, classNum: sel.classNum, studentId: null });
                  setSelectedTeammateId(null);
                }}
                className="absolute top-2.5 right-2.5 z-10 flex items-center gap-1 rounded-md px-2.5 py-1 text-xs text-soft hover:text-strong hover:bg-surface-panel border border-surface-line transition-all font-bold"
              >
                <RotateCcw className="size-3" /> 선수 초기화
              </button>
            )}
            <div>
              <div className="text-[10px] text-soft font-semibold tracking-wider uppercase">
                {player.grade}학년 {player.classNum}반 · {player.number}번 선수
              </div>
              <div className="mt-1 flex items-center gap-2 text-xl font-black text-strong">
                <GenderMark gender={player.gender} className="size-5 text-[10px]" />
                {player.realName || player.name}
              </div>
              <div className="mt-2 flex items-center gap-2.5">
                <TierBadge rp={player.rp} thresholds={thresholds} />
                <span className="font-mono text-xs text-neon-blue font-bold">{player.rp} RP</span>
                <span className="text-[10px] text-soft font-semibold">({player.wins}승 {player.losses}패)</span>
              </div>
            </div>

            {/* 경기 모드 + 매칭 범위 (통합) */}
            <div className="flex flex-col gap-3 sm:flex-row sm:gap-5">
              {/* 경기 모드 */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] text-soft font-bold block uppercase tracking-wider">경기 모드</span>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => {
                      setGameType("single");
                      setSelectedTeammateId(null);
                    }}
                    className={cn(
                      "py-1.5 px-3 rounded-lg border font-black text-xs transition-all active:scale-95 flex items-center justify-center gap-1 whitespace-nowrap",
                      gameType === "single"
                        ? "border-neon-blue bg-neon-blue/10 text-neon-blue shadow"
                        : "border-surface-line bg-surface-deep text-soft hover:text-strong"
                    )}
                  >
                    <Swords className="size-3.5" /> 단식
                  </button>
                  <button
                    onClick={() => setGameType("double")}
                    className={cn(
                      "py-1.5 px-3 rounded-lg border font-black text-xs transition-all active:scale-95 flex items-center justify-center gap-1 whitespace-nowrap",
                      gameType === "double"
                        ? "border-neon-green bg-neon-green/10 text-neon-green shadow"
                        : "border-surface-line bg-surface-deep text-soft hover:text-strong"
                    )}
                  >
                    <Users className="size-3.5" /> 복식
                  </button>
                </div>
              </div>

              {/* 매칭 범위 */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] text-soft font-bold block uppercase tracking-wider">매칭 범위</span>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => onModeChange("class")}
                    className={cn(
                      "py-1.5 px-3 rounded-lg border font-black text-xs transition-all active:scale-95 whitespace-nowrap",
                      mode === "class"
                        ? "border-neon-blue bg-neon-blue/10 text-neon-blue shadow"
                        : "border-surface-line bg-surface-deep text-soft hover:text-strong"
                    )}
                  >
                    우리 반
                  </button>
                  <button
                    onClick={() => {
                      onModeChange("otherClass");
                      const diffClasses = availableClassesForGrade.filter((c) => c !== player.classNum);
                      if (diffClasses.length > 0 && targetClass === null) {
                        onTargetClassChange(diffClasses[0]);
                      }
                    }}
                    className={cn(
                      "py-1.5 px-3 rounded-lg border font-black text-xs transition-all active:scale-95 whitespace-nowrap",
                      mode === "otherClass"
                        ? "border-neon-green bg-neon-green/10 text-neon-green shadow"
                        : "border-surface-line bg-surface-deep text-soft hover:text-strong"
                    )}
                  >
                    다른 반
                  </button>
                  <button
                    onClick={() => {
                      onModeChange("otherGrade");
                      const diffGrades = availableGrades.filter((g) => g !== player.grade);
                      if (diffGrades.length > 0) {
                        if (targetGrade === null) onTargetGradeChange(diffGrades[0]);
                        const cl = students.find((s) => s.grade === diffGrades[0])?.classNum ?? null;
                        if (cl !== null && targetClass === null) onTargetClassChange(cl);
                      }
                    }}
                    className={cn(
                      "py-1.5 px-3 rounded-lg border font-black text-xs transition-all active:scale-95 whitespace-nowrap",
                      mode === "otherGrade"
                        ? "border-purple-500 bg-purple-500/10 text-purple-400 shadow"
                        : "border-surface-line bg-surface-deep text-soft hover:text-strong"
                    )}
                  >
                    다른 학년
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      {/* 매칭 대상 지정 — 다른 반/다른 학년 선택 시에만 노출 */}
      {player && mode === "otherClass" && (
        <div className="p-4 rounded-xl border border-neon-green/30 bg-surface-panel space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs font-bold text-neon-green">⚔️ 대결할 학급(반) 지정</div>
                <Button
                  onClick={handleRandomClass}
                  variant="outline"
                  size="sm"
                  className="h-8 border-neon-green/40 text-neon-green bg-transparent hover:bg-neon-green hover:text-slate-950 font-black text-xs gap-1 active:scale-95"
                >
                  <Dices className="size-3.5" /> 🎲 랜덤 반
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {availableClassesForGrade
                  .filter((c) => c !== player.classNum)
                  .map((c) => (
                    <button
                      key={c}
                      onClick={() => onTargetClassChange(c)}
                      className={cn(
                        "rounded-full border px-3.5 py-1 text-xs font-bold transition-all active:scale-95",
                        targetClass === c
                          ? "border-neon-green bg-neon-green/20 text-neon-green"
                          : "border-surface-line bg-surface-deep text-soft hover:text-strong"
                      )}
                    >
                      {c}반
                    </button>
                  ))}
                {availableClassesForGrade.filter((c) => c !== player.classNum).length === 0 && (
                  <span className="text-xs text-soft py-1">다른 학급이 등록되지 않았습니다.</span>
                )}
              </div>
            </div>
          )}

          {player && mode === "otherGrade" && (
            <div className="p-4 rounded-xl border border-purple-500/30 bg-surface-panel space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-surface-line pb-2">
                <div className="text-xs font-bold text-purple-400">🚀 대결할 학년 및 반 지정</div>
                <Button
                  onClick={handleRandomGradeClass}
                  variant="outline"
                  size="sm"
                  className="h-8 border-purple-500/40 text-purple-400 bg-transparent hover:bg-purple-500 hover:text-slate-950 font-black text-xs gap-1 active:scale-95"
                >
                  <Dices className="size-3.5" /> 🎲 랜덤 학년/반
                </Button>
              </div>

              <div className="space-y-1.5">
                <div className="text-[10px] text-soft font-bold uppercase">1. 학년 선택</div>
                <div className="flex flex-wrap gap-1.5">
                  {availableGrades.map((g) => (
                    <button
                      key={g}
                      onClick={() => {
                        onTargetGradeChange(g);
                        const firstClass = students.find((s) => s.grade === g)?.classNum ?? null;
                        onTargetClassChange(firstClass);
                      }}
                      className={cn(
                        "rounded-full border px-3 py-1 text-xs font-bold transition-all active:scale-95",
                        targetGrade === g
                          ? "border-purple-500 bg-purple-500/20 text-purple-400"
                          : "border-surface-line bg-surface-deep text-soft hover:text-strong"
                      )}
                    >
                      {g}학년 {player.grade === g && <span className="text-[9px] text-soft">(내 학년)</span>}
                    </button>
                  ))}
                </div>
              </div>

              {targetGrade != null && (
                <div className="space-y-1.5">
                  <div className="text-[10px] text-soft font-bold uppercase">2. 반 선택</div>
                  <div className="flex flex-wrap gap-1.5">
                    {availableClassesForTargetGrade.map((c) => (
                      <button
                        key={c}
                        onClick={() => onTargetClassChange(c)}
                        className={cn(
                          "rounded-full border px-3 py-1 text-xs font-bold transition-all active:scale-95",
                          targetClass === c
                            ? "border-purple-500 bg-purple-500/20 text-purple-400"
                            : "border-surface-line bg-surface-deep text-soft hover:text-strong"
                        )}
                      >
                        {c}반 {player.grade === targetGrade && player.classNum === c && <span className="text-[9px] text-soft">(내 반)</span>}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

      {/* 2. Flat Single match recommendations */}
      {player && gameType === "single" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="size-5 text-amber-500 animate-pulse" />
              <h4 className="font-black text-base text-strong">🤖 AI 추천 단식 라이벌</h4>
            </div>
            
            <div className="rounded-full bg-surface-panel border border-surface-line px-3 py-1 text-[11px] text-soft font-semibold flex items-center gap-1.5 shadow-sm">
              <span className="size-1.5 rounded-full bg-neon-blue animate-ping" />
              추천 범위: <span className="font-bold text-strong">
                {mode === "class" && `${player.grade}학년 ${player.classNum}반`}
                {mode === "otherClass" && `${player.grade}학년 ${targetClass ?? "?"}반`}
                {mode === "otherGrade" && `${targetGrade ?? "?"}학년 ${targetClass ?? "?"}반`}
              </span>
            </div>
          </div>

          {showPromptToSelect ? (
            <Card className="flex flex-col items-center justify-center p-12 text-center border-dashed border-surface-line bg-surface-deep">
              <AlertCircle className="size-10 text-soft mb-2" />
              <div className="text-sm font-bold text-strong">도전 타겟이 완벽히 설정되지 않았습니다.</div>
              <p className="text-xs text-soft mt-1 max-w-sm">
                상단 범위 필터에서 반이나 학년을 클릭하거나 🎲 랜덤 버튼을 눌러 지정해 주세요.
              </p>
            </Card>
          ) : (
            <div className="grid gap-5 md:grid-cols-3">
              {singleRecommendations.length > 0 ? (
                singleRecommendations.map((rival, index) => {
                  const s = rival.student;
                  return (
                    <Card 
                      key={s.id} 
                      className="relative overflow-hidden border-surface-line bg-surface-panel p-5 backdrop-blur flex flex-col justify-between hover:border-neon-blue/50 hover:glow-primary hover:scale-[1.01] transition-all duration-300 group"
                    >
                      {/* Top Ranking Badge */}
                      <div className="absolute right-4 top-4 font-mono font-black text-3xl opacity-15 text-soft select-none group-hover:scale-110 transition-transform">
                        #{index + 1}
                      </div>

                      <div className="space-y-4">
                        {/* Opponent Profile */}
                        <div>
                          <div className="text-[10px] text-soft font-medium">
                            {s.grade}학년 {s.classNum}반 · {s.number}번
                          </div>
                          <div className="mt-0.5 flex items-center gap-1.5 text-lg font-black text-strong">
                            <GenderMark gender={s.gender} className="size-4.5 text-[9px]" />
                            {s.realName || s.name}
                          </div>
                        </div>

                        {/* Current Tier & RP */}
                        <div className="flex items-center gap-2">
                          <TierBadge rp={s.rp} thresholds={thresholds} />
                          <span className="font-mono text-xs text-neon-blue font-bold">{s.rp} RP</span>
                          <span className="text-[10px] text-soft">({s.wins}승 {s.losses}패)</span>
                        </div>

                        {/* Expected RP win/loss preview */}
                        <RpPreview win={getExpectedDelta(player, s, true)} loss={getExpectedDelta(player, s, false)} />

                        {/* Smart tags (collapsible) */}
                        <TagAccordion tags={rival.tags} />
                      </div>

                      {/* Action Button */}
                      {isStudentView ? (
                        <div className="mt-5 w-full text-center py-2 rounded-lg border border-neon-blue/30 bg-neon-blue/5 text-neon-blue text-xs font-black tracking-wide flex items-center justify-center gap-1">
                          <Swords className="size-3.5" /> 추천 단식 라이벌
                        </div>
                      ) : isReadOnly ? (
                        <div className="mt-5 w-full text-center py-2 rounded-lg border border-surface-line bg-surface-panel text-soft text-xs font-bold tracking-wide flex items-center justify-center gap-1">
                          <Swords className="size-3.5 opacity-50" /> 경기하기 (읽기 전용)
                        </div>
                      ) : (
                        <Button
                          onClick={() => onSelectRecommendedMatch(player.id, s.id, undefined, undefined, "single")}
                          className="mt-5 w-full bg-gradient-to-r from-neon-blue to-tier-diamond hover:from-neon-blue hover:to-tier-diamond text-slate-950 font-bold active:scale-[0.98] transition-all gap-1 text-xs"
                        >
                          <Swords className="size-3.5" /> ⚔️ 이 선수와 경기하기
                        </Button>
                      )}
                    </Card>
                  );
                })
              ) : (
                <Card className="col-span-3 flex flex-col items-center justify-center p-12 text-center border-dashed border-surface-line bg-surface-deep">
                  <AlertCircle className="size-10 text-soft mb-2" />
                  <div className="text-sm font-bold text-strong">추천할 수 있는 대전 상대가 없습니다.</div>
                  <p className="text-xs text-soft mt-1 max-w-sm">
                    지정된 범위에 등록된 다른 선수가 없거나 최근 2경기 이내에 치른 대결자 중복방지 필터링으로 인해 후보군이 비어 있습니다.
                  </p>
                </Card>
              )}
            </div>
          )}
        </div>
      )}

      {/* 3. Double match wizard flow */}
      {player && gameType === "double" && (
        <div className="space-y-6">
          
          {/* Stage Progress bar */}
          <div className="flex items-center justify-center gap-2 max-w-md mx-auto py-2 bg-surface-panel rounded-full border border-surface-line shadow-sm">
            <span className={cn(
              "px-3 py-1.5 rounded-full text-xs font-black transition-all flex items-center gap-1",
              selectedTeammateId == null 
                ? "bg-neon-green/15 text-neon-green border border-neon-green/30" 
                : "text-soft"
            )}>
              <span className="flex size-4 items-center justify-center rounded-full bg-surface-line text-[10px]">1</span>
              팀원 선택
            </span>
            <ArrowRight className="size-4 text-slate-700" />
            <span className={cn(
              "px-3 py-1.5 rounded-full text-xs font-black transition-all flex items-center gap-1",
              selectedTeammateId != null 
                ? "bg-neon-green/15 text-neon-green border border-neon-green/30" 
                : "text-soft"
            )}>
              <span className="flex size-4 items-center justify-center rounded-full bg-surface-line text-[10px]">2</span>
              상대팀 매칭
            </span>
          </div>

          {/* Stage 1 Teammate selection view */}
          {selectedTeammateId == null ? (
            <div className="space-y-4">
              <div className="flex justify-end">
                {/* 팀원 검색 (이름·번호) */}
                <div className="relative w-full sm:w-56">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-soft" />
                  <input
                    type="text"
                    value={teammateSearch}
                    onChange={(e) => setTeammateSearch(e.target.value)}
                    placeholder="이름 또는 번호 검색"
                    className="w-full rounded-lg border border-surface-line bg-surface-deep py-1.5 pl-8 pr-7 text-xs text-strong placeholder:text-soft focus:border-neon-green/50 focus:outline-none"
                  />
                  {teammateSearch && (
                    <button
                      type="button"
                      onClick={() => setTeammateSearch("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-soft hover:text-strong"
                    >
                      <X className="size-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {(() => {
                const q = teammateSearch.trim().toLowerCase();
                const filteredPartners = q
                  ? partnerRecommendations.filter((c) => {
                      const s = c.student;
                      return (s.realName || s.name || "").toLowerCase().includes(q) || String(s.number).includes(q);
                    })
                  : partnerRecommendations;
                return (
              <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
                {filteredPartners.length > 0 ? (
                  filteredPartners.map((cand) => {
                    const s = cand.student;
                    const rank = partnerRecommendations.findIndex((c) => c.student.id === s.id) + 1;
                    const rankLabel = rank === 1 ? "🥇 추천 1순위" : rank === 2 ? "🥈 추천 2순위" : rank === 3 ? "🥉 추천 3순위" : `추천 ${rank}순위`;
                    const rankStyle = rank === 1
                      ? "bg-neon-green/20 text-neon-green border-neon-green/40"
                      : rank <= 3
                        ? "bg-surface-line text-strong border-slate-700"
                        : "bg-surface-panel text-soft border-surface-line";
                    return (
                      <Card
                        key={s.id}
                        onClick={() => { setSelectedTeammateId(s.id); setTeammateSearch(""); }}
                        className={cn(
                          "p-4 active:scale-[0.98] transition-all cursor-pointer flex flex-col justify-between group",
                          rank === 1
                            ? "border-neon-green/50 ring-1 ring-neon-green/30 bg-neon-green/[0.04] hover:bg-neon-green/[0.08]"
                            : "border-surface-line bg-surface-panel hover:border-neon-green/60 hover:bg-surface-panel",
                        )}
                      >
                        <div className="space-y-3">
                          <div className="flex items-center justify-between gap-2">
                            <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-black", rankStyle)}>
                              {rankLabel}
                            </span>
                            <span className="text-[10px] font-mono text-neon-green font-bold shrink-0">{s.rp} RP</span>
                          </div>
                          <div>
                            <div className="text-[9px] text-soft">{s.grade}학년 {s.classNum}반 · {s.number}번</div>
                            <div className="font-bold text-strong flex items-center gap-1 mt-0.5">
                              <GenderMark gender={s.gender} className="size-3.5 text-[8px]" />
                              {s.realName || s.name}
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <TierBadge rp={s.rp} thresholds={thresholds} />
                            <span className="text-[10px] text-soft">({s.wins}승 {s.losses}패)</span>
                          </div>

                          <div className="pt-1">
                            <TagAccordion tags={cand.tags} />
                          </div>

                          {/* 사회적 넛지 — 1순위에만 */}
                          {rank === 1 && (
                            <div className="rounded-lg border border-neon-green/30 bg-neon-green/[0.06] px-2.5 py-2 text-[11px] leading-relaxed text-neon-green/90">
                              💬 오늘은 <span className="font-black">{s.realName || s.name}</span> 친구와 한 팀이 되어보는 건 어때요? 먼저 “같이 할래?” 하고 인사해볼까요!
                            </div>
                          )}
                        </div>

                        <Button
                          size="sm"
                          variant="ghost"
                          className="mt-4 w-full h-8 text-[11px] font-black text-neon-green hover:bg-neon-green/10 bg-neon-green/5 border border-neon-green/20 group-hover:border-neon-green/40 gap-1 active:scale-95"
                        >
                          <UserPlus className="size-3.5" /> 파트너로 매칭
                        </Button>
                      </Card>
                    );
                  })
                ) : (
                  <Card className="col-span-3 flex flex-col items-center justify-center p-12 text-center border-dashed border-surface-line bg-surface-deep">
                    <AlertCircle className="size-10 text-soft mb-2" />
                    <div className="text-sm font-bold text-strong">
                      {q ? `"${teammateSearch.trim()}" 검색 결과가 없습니다.` : "파트너 추천 후보가 없습니다."}
                    </div>
                    <p className="text-xs text-soft mt-1 max-w-sm">
                      {q ? "다른 이름이나 번호로 검색해보세요." : "현재 학년 또는 학급에 등록된 다른 학생 데이터가 비어 있습니다."}
                    </p>
                  </Card>
                )}
              </div>
                );
              })()}
            </div>
          ) : (
            // Stage 2 Opponent team auto matching view
            <div className="space-y-5">
              
              {/* Selected Teammate profile */}
              {selectedTeammate && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-neon-green/40 bg-neon-green/5 animate-in slide-in-from-top-2 duration-300">
                  <div className="flex items-center gap-3">
                    <div className="flex size-9 items-center justify-center rounded-lg bg-neon-green/15 border border-neon-green/30 text-neon-green shadow shrink-0">
                      <UserCheck className="size-5" />
                    </div>
                    <div>
                      <div className="text-[9px] text-soft font-bold uppercase tracking-wider">우리의 복식 팀원 확정</div>
                      <div className="text-sm font-black text-strong flex items-center gap-1.5 mt-0.5">
                        {player.realName || player.name} & {selectedTeammate.realName || selectedTeammate.name}
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <span className="text-[10px] text-soft">팀 합산 RP:</span>
                        <span className="font-mono text-xs text-neon-green font-bold">{player.rp + selectedTeammate.rp} RP</span>
                        <span className="text-soft">|</span>
                        <TierBadge rp={selectedTeammate.rp} thresholds={thresholds} />
                        <span className="text-[10px] text-soft">({selectedTeammate.realName || selectedTeammate.name})</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => setSelectedTeammateId(null)}
                    className="h-8 px-3.5 rounded-lg border border-surface-line bg-surface-deep text-soft hover:text-strong hover:bg-surface-panel text-xs font-black tracking-wide flex items-center gap-1 transition-all active:scale-95 shrink-0"
                  >
                    <RotateCcw className="size-3.5" /> 파트너 변경
                  </button>
                </div>
              )}

              {/* Opponent list */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Swords className="size-5 text-neon-green animate-pulse" />
                    <h4 className="font-black text-base text-strong">🤖 AI 엄선 상대팀 추천 (합산 밸런싱)</h4>
                  </div>
                  
                  <div className="rounded-full bg-surface-panel border border-surface-line px-3 py-1 text-[11px] text-soft font-semibold flex items-center gap-1.5 shadow-sm">
                    <span className="size-1.5 rounded-full bg-neon-green animate-ping" />
                    추천 범위: <span className="font-bold text-strong">
                      {mode === "class" && `${player.grade}학년 ${player.classNum}반`}
                      {mode === "otherClass" && `${player.grade}학년 ${targetClass ?? "?"}반`}
                      {mode === "otherGrade" && `${targetGrade ?? "?"}학년 ${targetClass ?? "?"}반`}
                    </span>
                  </div>
                </div>

                {showPromptToSelect ? (
                  <Card className="flex flex-col items-center justify-center p-12 text-center border-dashed border-surface-line bg-surface-deep">
                    <AlertCircle className="size-10 text-soft mb-2" />
                    <div className="text-sm font-bold text-strong">도전 타겟이 완벽히 설정되지 않았습니다.</div>
                    <p className="text-xs text-soft mt-1 max-w-sm">
                      상단 범위 필터에서 반이나 학년을 지정해 주세요.
                    </p>
                  </Card>
                ) : (
                  <div className="grid gap-5 md:grid-cols-3">
                    {doubleOpponentRecommendations.length > 0 ? (
                      doubleOpponentRecommendations.map((pair, index) => {
                        const ourCombined = player.rp + selectedTeammate!.rp;
                        const delta = pair.combinedRp - ourCombined;
                        const sign = delta > 0 ? `+${delta}` : `${delta}`;
                        
                        // Analysis message
                        let analysis = "";
                        if (Math.abs(delta) <= 30) {
                          analysis = "합산 RP 격차가 30점 미만으로, 완벽히 대등하고 치열한 명승부가 예상되는 최고의 매칭입니다! ⚔️";
                        } else if (delta > 30) {
                          analysis = "상대 팀의 평균 전력이 약간 높습니다. 업셋을 달성하면 막대한 점수 상승을 노릴 수 있습니다! 🏆";
                        } else {
                          analysis = "우리가 전력상 우위에 있습니다. 팀워크를 발휘하여 방심하지 말고 승리를 확보하세요! 📈";
                        }

                        return (
                          <Card 
                            key={`${pair.o1.id}-${pair.o2.id}`}
                            className="relative overflow-hidden border-surface-line bg-surface-panel p-5 backdrop-blur flex flex-col justify-between hover:border-neon-green/50 hover:shadow-[0_0_20px_rgba(34,197,94,0.06)] hover:scale-[1.01] transition-all duration-300 group"
                          >
                            <div className="absolute right-4 top-4 font-mono font-black text-3xl opacity-15 text-soft select-none group-hover:scale-110 transition-transform">
                              #{index + 1}
                            </div>

                            <div className="space-y-4">
                              {/* Opponents profile */}
                              <div className="space-y-3.5">
                                <span className="inline-flex items-center rounded bg-neon-green/15 text-neon-green border border-neon-green/25 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider">
                                  추천 매칭팀
                                </span>
                                
                                <div className="space-y-2 border-b border-surface-line pb-3">
                                  {/* Opponent 1 */}
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1.5">
                                      <GenderMark gender={pair.o1.gender} className="size-3.5 text-[8px]" />
                                      <span className="text-xs font-bold text-strong">{pair.o1.realName || pair.o1.name}</span>
                                      <span className="text-[9px] text-soft">{pair.o1.grade}학년 {pair.o1.classNum}반</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                      <TierBadge rp={pair.o1.rp} thresholds={thresholds} />
                                      <span className="font-mono text-[10px] text-soft font-bold">{pair.o1.rp} RP</span>
                                    </div>
                                  </div>

                                  {/* Opponent 2 */}
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1.5">
                                      <GenderMark gender={pair.o2.gender} className="size-3.5 text-[8px]" />
                                      <span className="text-xs font-bold text-strong">{pair.o2.realName || pair.o2.name}</span>
                                      <span className="text-[9px] text-soft">{pair.o2.grade}학년 {pair.o2.classNum}반</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                      <TierBadge rp={pair.o2.rp} thresholds={thresholds} />
                                      <span className="font-mono text-[10px] text-soft font-bold">{pair.o2.rp} RP</span>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* RP Summary */}
                              <div className="flex items-center justify-between text-xs">
                                <div>
                                  <span className="text-[10px] text-soft block">상대 합산 RP</span>
                                  <span className="font-mono font-black text-strong">{pair.combinedRp} RP</span>
                                </div>
                                <div className="text-right">
                                  <span className="text-[10px] text-soft block">격차</span>
                                  <span className={cn(
                                    "font-mono font-black",
                                    delta > 0 ? "text-rose-400" : "text-emerald-400"
                                  )}>
                                    {sign} RP
                                  </span>
                                </div>
                              </div>

                              {/* Expected RP win/loss preview */}
                              <RpPreview
                                win={getExpectedDelta(player, pair.o1, true, selectedTeammate, pair.o2)}
                                loss={getExpectedDelta(player, pair.o1, false, selectedTeammate, pair.o2)}
                              />

                              {/* Smart tags (collapsible) */}
                              <TagAccordion tags={pair.tags ?? []} />

                              {/* Analytical commentary */}
                              <div className="text-[10px] text-soft bg-surface-deep p-2.5 rounded border border-surface-line leading-relaxed min-h-[50px]">
                                {analysis}
                              </div>
                            </div>

                            {/* Action Trigger */}
                            {isStudentView ? (
                              <div className="mt-5 w-full text-center py-2 rounded-lg border border-neon-green/30 bg-neon-green/5 text-neon-green text-xs font-black tracking-wide flex items-center justify-center gap-1">
                                <Swords className="size-3.5 animate-pulse" /> 추천 복식 라이벌
                              </div>
                            ) : isReadOnly ? (
                              <div className="mt-5 w-full text-center py-2 rounded-lg border border-surface-line bg-surface-panel text-soft text-xs font-bold tracking-wide flex items-center justify-center gap-1">
                                <Swords className="size-3.5 opacity-50" /> 경기하기 (읽기 전용)
                              </div>
                            ) : (
                              <Button
                                onClick={() => onSelectRecommendedMatch(player.id, pair.o1.id, selectedTeammate!.id, pair.o2.id, "double")}
                                className="mt-5 w-full bg-gradient-to-r from-neon-green to-emerald-400 hover:from-neon-green hover:to-emerald-400 text-slate-950 font-bold active:scale-[0.98] transition-all gap-1 text-xs"
                              >
                                <Swords className="size-3.5" /> ⚔️ 이 팀들과 경기하기
                              </Button>
                            )}
                          </Card>
                        );
                      })
                    ) : (
                      <Card className="col-span-3 flex flex-col items-center justify-center p-12 text-center border-dashed border-surface-line bg-surface-deep">
                        <AlertCircle className="size-10 text-soft mb-2" />
                        <div className="text-sm font-bold text-strong">매칭 가능한 상대 팀이 없습니다.</div>
                        <p className="text-xs text-soft mt-1 max-w-sm">
                          지정 범위 내에 등록된 학생이 부족하거나 팀원과 아군을 제외한 선수 데이터가 모자랍니다.
                        </p>
                      </Card>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 성별 정보 보완 팝업창 (MatchRecommend) */}
      {genderModalOpen && genderTargetId && (() => {
        const targetStudent = students.find((s) => s.id === genderTargetId);
        if (!targetStudent) return null;
        return (
          <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in duration-300">
            <div className="relative w-full max-w-md overflow-hidden border border-neon-blue/30 bg-background/95 rounded-2xl p-6 md:p-8 glow-primary flex flex-col items-center animate-in zoom-in duration-300">
              <div className="absolute inset-0 bg-[linear-gradient(rgba(18,18,18,0.2)_1px,transparent_1px),linear-gradient(90deg,rgba(18,18,18,0.2)_1px,transparent_1px)] bg-[size:20px_20px] pointer-events-none opacity-20" />
              
              <button 
                onClick={handleCancelGender}
                className="absolute right-4 top-4 text-soft hover:text-strong hover:bg-surface-panel p-1.5 rounded-lg transition-all"
                title="취소 및 뒤로가기"
              >
                <X className="size-5" />
              </button>

              <div className="relative z-10 flex flex-col items-center text-center w-full">
                <div className="flex size-14 items-center justify-center rounded-full bg-neon-blue/15 border border-neon-blue/30 text-neon-blue glow-primary mb-4 animate-pulse">
                  <Sparkles className="size-6 text-neon-blue" />
                </div>
                <h3 className="text-xl font-black uppercase tracking-wider text-neon-blue mb-1">
                  선수 성별 정보 보완
                </h3>
                <p className="text-xs text-soft max-w-sm mb-6 leading-relaxed">
                  <span className="font-bold text-strong">[{targetStudent.realName || targetStudent.name}]</span> 선수의 성별 정보(M/F)가 지정되지 않았습니다.<br />
                  매치를 정확하게 추천하기 위해 성별을 입력해주세요.
                </p>
              </div>

              <div className="relative z-10 grid grid-cols-2 gap-4 w-full">
                <button
                  onClick={() => handleUpdateGender("M")}
                  className="flex flex-col items-center justify-center p-5 rounded-xl border border-neon-blue/30 bg-neon-blue/5 hover:bg-neon-blue/15 hover:border-neon-blue/60 transition-all active:scale-95 group glow-primary"
                >
                  <span className="text-4xl mb-2 group-hover:animate-bounce text-neon-blue">♂</span>
                  <span className="text-sm font-black text-neon-blue tracking-wider">남성 (M)</span>
                  <span className="text-[10px] text-soft mt-1">Male Athlete</span>
                </button>

                <button
                  onClick={() => handleUpdateGender("F")}
                  className="flex flex-col items-center justify-center p-5 rounded-xl border border-rose-500/30 bg-rose-500/5 hover:bg-rose-500/15 hover:border-rose-500/60 transition-all active:scale-95 group shadow-[0_0_15px_rgba(239,68,68,0.05)]"
                >
                  <span className="text-4xl mb-2 group-hover:animate-bounce text-rose-400">♀</span>
                  <span className="text-sm font-black text-rose-400 tracking-wider">여성 (F)</span>
                  <span className="text-[10px] text-soft mt-1">Female Athlete</span>
                </button>
              </div>

              <p className="relative z-10 text-[10px] text-soft mt-6 text-center leading-relaxed">
                입력하신 성별 데이터는 클라우드 데이터베이스에 실시간 영속 동기화됩니다.
              </p>
            </div>
          </div>
        );
      })()}

    </div>
  );
}
