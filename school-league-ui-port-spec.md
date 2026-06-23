# 학교용 리그 UI 포팅 명세서 (club-league → school-league)

이 문서를 `D:\다운로드\school-league` 작업 세션에 붙여넣고 진행하세요.

## 전제 / 원칙
- **데이터 모델은 학교 그대로, 겉모습·상호작용만 클럽에서 이식**합니다.
- **유지(절대 이식 금지)**: 학년/반/번호(`grade`/`classNum`/`number`) 정체성, `realName` 표시, 3단계 picker 단계(학년→반→로스터), 매치추천의 **범위 선택**(우리반/다른반/다른학년)과 그 필터/추천 엔진, 강등 보호막 등 학교 고유 기능.
- 공유 컴포넌트 `GenderMark`/`TierBadge`는 학교에 이미 동일하게 존재 → 그대로 사용.
- 클럽의 `TeamBlock/Slot/PlayerPicker/Chip/ScorePad/ACCENT`는 클럽 `RecordMatch.tsx`에 **인라인** 정의됨 → 학교에도 인라인으로 이식하되 **picker만 학년·반 3단계로 적응**.
- 작업 후 `npx tsc --noEmit` + `npm run build` 통과 확인. **커밋은 사용자가 요청할 때만.**

### 색 토큰(공통)
```
팀 A (amber):  text-amber-400  / border-amber-500/60  / bg-amber-500/10  / soft: border-amber-500/30 bg-amber-500/[0.06] / band: border-amber-500/40 bg-amber-500/15 text-amber-400
팀 B (violet): text-violet-400 / border-violet-500/60 / bg-violet-500/10 / soft: border-violet-500/30 bg-violet-500/[0.06] / band: border-violet-500/40 bg-violet-500/15 text-violet-400
추천: 단식 = from-neon-blue to-tier-diamond,  복식 = from-neon-green to-emerald-400
승/패: win = sky-300/500 계열,  loss = rose-300/500 계열
```

---

# 파트 1 — 경기 기록 화면 (RecordMatch.tsx)
- 클럽 출처: `D:\다운로드\club-league\src\components\league\RecordMatch.tsx`
- 학교 대상: `D:\다운로드\school-league\src\components\league\RecordMatch.tsx` (≈1998줄, grade/classNum/number + 3단계 picker)

### 1. 팀 색상 amber / violet (현 학교 blue/green 교체)
클럽 `ACCENT` 맵(club 1727–1742)을 그대로 도입:
```tsx
const ACCENT = {
  amber:  { text:"text-amber-400",  border:"border-amber-500/60",  soft:"border-amber-500/30 bg-amber-500/[0.06]",  fill:"border-amber-500/60 bg-amber-500/10",  band:"border-amber-500/40 bg-amber-500/15 text-amber-400" },
  violet: { text:"text-violet-400", border:"border-violet-500/60", soft:"border-violet-500/30 bg-violet-500/[0.06]", fill:"border-violet-500/60 bg-violet-500/10", band:"border-violet-500/40 bg-violet-500/15 text-violet-400" },
} as const;
type Accent = keyof typeof ACCENT;
```
- 학교의 `accent="blue"|"green"` 타입과 호출부(학교 ≈1049/1068, 파트너 1058/1077)를 `"amber"`(팀A)·`"violet"`(팀B)로 교체.
- 학교 `Chip`(1855–1870), `ScorePad`(1873–1907)의 blue/green 분기를 amber/violet로 교체.

### 2. 단식/복식 토글 + 기본 복식
- 클럽: 중앙 토글, 기본값 `useState<"single"|"double">("double")` (club 100). 학교(1009–1039) 토글 유지하되 **기본값을 `"double"`로**.

### 3. "한 번에 picker 1개" + 컴팩트 슬롯 (가장 큰 변경)
클럽 패턴(club 106, 1044–1086, 1757–1789):
- 상태: `const [activeSlot, setActiveSlot] = useState<"A"|"A2"|"B"|"B2"|null>(null);`
- 각 슬롯은 `Slot` 컴포넌트로:
  - **선택됨** → 컴팩트 카드: 라벨 + (학교: `{grade}학년 {classNum}반 {number}번`) + `GenderMark` + 이름 + `TierBadge` + 우상단 ✕(해제). 클럽 1762–1777 구조.
  - **비었음** → 점선 "＋ {라벨}" 버튼(활성 시 accent 색). 클럽 1779–1788.
- 펼쳐진 슬롯이 있을 때만 **그 슬롯의 picker 패널 1개**를 전체폭으로 렌더. `onOpen={() => setActiveSlot(prev===key?null:key)}`.
- **학교 적응**: 클럽 picker는 [검색 → 그룹칩 → 로스터] 2단계지만, **학교는 [학년 chips → 반 chips → 로스터] 3단계를 그 picker 패널 안에 그대로** 넣는다(학교 PlayerSelector 1781–1837의 단계 로직 재사용). 즉 "동시에 selector 1개만 펼친다"만 도입하고 단계 구조는 학교 유지.
- 단식: 팀당 슬롯 1개(A,B). 복식: 팀당 2개(A·A2 / B·B2).

### 4. TeamBlock 래퍼
클럽 `TeamBlock`(club 1746–1754): soft 배경 박스 + 팀 타이틀 밴드 + cols(1|2) 그리드. 팀 A(amber)/팀 B(violet) 각각 감싼다.
```tsx
function TeamBlock({title,accent,cols,children}) {
  const a = ACCENT[accent];
  return (<div className={cn("rounded-2xl border p-2.5 sm:p-3", a.soft)}>
    <div className={cn("mb-2 inline-flex items-center rounded-lg border px-2.5 py-1 text-xs font-black", a.band)}>{title}</div>
    <div className={cn("grid gap-2", cols===1?"grid-cols-1":"grid-cols-2")}>{children}</div>
  </div>);
}
```

### 5. ScorePad 리스타일
클럽 `ScorePad`(club 1890–1923): 큰 팀색(amber/violet) 숫자 + `+1/+5/+10`(neon-blue) / `-1/-5/-10`(loss) / "0으로 초기화"(amber) 버튼. 학교 ScorePad의 색만 amber/violet로 맞추고 버튼 구성 동일하게.
- 스코어보드 배치: `grid-cols-[1fr_auto_1fr]` 가운데 VS (club 1100–1112). 단식은 팀명 자리에 선수 라벨, 복식은 "팀 A"/"팀 B".

### 6. 선수 라벨(학교 표기 유지)
- 슬롯/로스터 카드의 이름은 학교 표기: `{grade}학년 {classNum}반 {number}번` + 이름(`realName`/`name`). **닉네임 강제 금지.** 클럽의 `playerLabel`(닉네임 우선)을 그대로 쓰지 말고 학교 표기 함수를 유지.

---

# 파트 2 — 매치 추천 화면 (MatchRecommend.tsx)
- 클럽 출처: `D:\다운로드\club-league\src\components\league\MatchRecommend.tsx`
- 학교 대상: `D:\다운로드\school-league\src\components\league\MatchRecommend.tsx` (≈1655줄, 범위 선택 우리반/다른반/다른학년)

### 1. 바깥 박스/타이틀 제거
- 클럽처럼 겉 카드/제목·아이콘 없이 **선택 + 추천 카드만** 세로 스택(`space-y-6`). (club 754~)

### 2. TagAccordion (접었다 펴기) — 핵심
클럽 `TagAccordion`(club 52–77): 키워드 태그를 칩으로 띄우고, **칩 클릭 시 아래로 설명 펼침**.
```tsx
const [open, setOpen] = useState<string|null>(null);
// 칩: onClick={(e)=>{e.stopPropagation(); setOpen(open===tag.label?null:tag.label);}}
//     <ChevronDown className={cn("size-2.5 transition-transform", open===tag.label&&"rotate-180")}/>
// 펼침 패널: {open && <div className="... animate-in fade-in slide-in-from-top-1 duration-150">{desc}</div>}
```
- 학교는 현재 태그 설명을 항상 인라인 노출(학교 1200–1223 등) → **접이식으로 교체**.
- 태그 라벨/색 예시: `🤝 새로운 인연`(emerald), `🔥 언더독의 반란`(rose), `⚔️ 명승부 예상`(neon-blue), `🌱 교류 환영`(purple).

### 3. RpPreview "예상 추정치" 배지
클럽 `RpPreview`(club 35–49): 승/패 예상 RP를 sky/rose 칩으로 + 옆에 작은 `예상 추정치` 라벨.
```tsx
<span className="...bg-sky-500/10 text-sky-300 ring-sky-500/20"><span>승</span><span className="font-mono">{win}</span></span>
<span className="...bg-rose-500/10 text-rose-300 ring-rose-500/20"><span>패</span><span className="font-mono">{loss}</span></span>
<span className="text-[9px] text-slate-500">예상 추정치</span>
```

### 4. 상대 1행 레이아웃 + 리딩 배지
- 복식 상대 2명을 한 줄로: `GenderMark + 이름  &  GenderMark + 이름` (club 1172–1179).
- 카드 상단 좌측에 `추천 매칭팀` 리딩 배지(neon-green) (club 1163–1167).

### 5. 팀원 선택 카드 모바일 2열
- 복식 1단계 팀원 선택: `grid grid-cols-2 gap-2.5 md:grid-cols-3` 컴팩트 카드(좌: 식별/성별/이름, 우: RP, 하단: 태그 + "이 회원과 팀" CTA). club 1032–1077.
- **학교 적응**: 카드 식별 표기를 `{grade}학년 {classNum}반 {number}번`로.

### 6. 합산/격차 1행 요약 바
- `상대 합산 N · 우리보다 ±X 높음/낮음 · [예상 추정치]`를 한 줄 정보 바로(club 1186–1199):
  `flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border border-slate-800/60 bg-slate-950/40 px-2.5 py-2 text-[11px]`

### 7. 버튼 그라데이션
- 단식: `bg-gradient-to-r from-neon-blue to-tier-diamond` · 라벨 "이 선수와 경기하기".
- 복식: `bg-gradient-to-r from-neon-green to-emerald-400` · 라벨 "이 팀과 경기하기".

### 8. 카드 hover/스케일, 배지
- 카드 hover: `hover:border-neon-blue/50 hover:scale-[1.01]`(단식) / `hover:border-neon-green/50`(복식). `TierBadge`/`GenderMark` 그대로.

### 학교 유지(이식 금지)
- **범위 선택(우리반/다른반/다른학년)** UI와 필터 로직(학교 462–477 단식, 647–662 복식), grade/class 표기, 추천 점수 엔진(`getExpectedDelta`, `singleRecommendations`, `partnerRecommendations`, `doubleOpponentRecommendations`)은 그대로.

---

# 학교용 세션 작업 지시(요약)
1. 위 파트 1·2를 학교 `RecordMatch.tsx` / `MatchRecommend.tsx`에 적용.
2. **데이터/식별/범위선택/강등보호막은 유지**, 색상·슬롯·카드·접이식 등 **디자인만** 이식.
3. 각 파일 적용 후 `npx tsc --noEmit`, 마무리 `npm run build` 0 에러 확인.
4. preview 375px(모바일)·데스크톱에서 단식/복식·팀색(amber/violet)·한 번에 picker 1개·태그 접이식·예상 추정치 확인.
5. **커밋/푸시는 사용자가 요청할 때만.**
