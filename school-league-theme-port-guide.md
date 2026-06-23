# 학교용 리그 — 테마/디자인 이식 지침 (club-league → school-league)

이 문서를 `D:\다운로드\school-league` 작업 세션에 붙여넣고 진행하세요. 두 저장소는 같은 머신에 있고(`D:\다운로드\club-league`, `D:\다운로드\school-league`), **테마 인프라가 100% 동일**(styles.css 베이스라인·`ui/card`·`ui/button`·`__root` 일치, 토큰 세트 동일)이라 대부분 그대로 복사하면 됩니다.

## 이식 대상(클럽에서 한 디자인 작업)
1. 선택형 테마 5종(게임=사이버펑크 / 블랙=무채색 / 모던=웜+먹 / 글래스=아쿠아 유리 / 클레이=캔디 클레이) + ThemePicker + 무플래시 + localStorage 저장.
2. 표면/글자 토큰(`surface-deep/panel/line`, `strong/soft`)으로 다크 하드코딩 치환 → 라이트 테마 가독성.
3. 글로우 테마화(`glow-primary`, `text-glow-blue` = var 기반).
4. `theme-card`/`theme-btn` 훅으로 글래스 blur·클레이 섀도우 질감.
5. 선수 이름 라이트 가독성(`team-name`), "0으로 초기화" 버튼 무채색.

## 학교 특이사항(주의)
- 학교는 **학년/반/번호** 정체성이지만 **테마는 색/토큰만 다루므로 정체성과 무관** → 정체성 코드는 건드리지 않는다.
- 학교 `RecordMatch.tsx`는 승리 연출(셀러브레이션) 모달에 `bg-[#090d16]`, `bg-[#041121]` 등 **다크 hex 배경이 많음**. 이건 항상 어두운 연출용이라 **그대로 둔다**(표면 토큰 치환 대상 아님). 토큰 치환은 **선수 선택 picker/로스터/패널 표면**에만 적용.

---

# A. 인프라 — 거의 그대로 복사

### A-1. `src/styles.css` — 클럽 파일을 통째로 가져오기
학교 styles.css는 클럽의 **테마 적용 전 베이스라인과 동일**하고, 테마 추가분은 전부 **순수 토큰/유틸**(학교 종속 없음)이다. → **`D:\다운로드\club-league\src\styles.css` 전체 내용을 학교 `src/styles.css`로 복사**하면 5종 테마 블록 + surface/strong/soft 토큰 매핑 + `glow-primary`/`text-glow-blue`(var) + `team-name` 라이트 오버라이드 + 클레이/글래스 `theme-card`·`theme-btn` 질감 규칙이 한 번에 들어온다.
- 클럽 styles.css 핵심 구조(참고): `@theme inline`에 `--color-surface-deep/panel/line`, `--color-strong/soft` 추가 · `:root,[data-theme="game"]`(사이버펑크) · `[data-theme="black|modern|glass|clay"]` 4블록 · body `background-image: var(--body-gradient)` · `@utility glow-primary{box-shadow:var(--shadow-glow-blue)}` · `@utility text-glow-blue{text-shadow:var(--text-glow-blue)}` · `[data-theme=modern|glass|clay] .team-name{color:var(--strong)}` · `[data-theme=clay] .theme-card{...inset...}` + `.theme-btn{border-radius:9999px;...}` · `[data-theme=glass] .theme-card{backdrop-filter:blur(22px)...}`.

### A-2. `src/components/ui/card.tsx` — `theme-card` 훅 추가
베이스 className 맨 앞에 `theme-card` 추가:
`className={cn("theme-card rounded-xl border bg-card text-card-foreground shadow", className)}`

### A-3. `src/components/ui/button.tsx` — `theme-btn` 훅 추가
cva 첫 문자열 맨 앞에 `theme-btn ` 추가:
`"theme-btn inline-flex items-center justify-center gap-2 ..."`

### A-4. `src/lib/use-theme.ts` — 클럽 파일 그대로 복사
`D:\다운로드\club-league\src\lib\use-theme.ts` 전체 복사(ThemeName 5종, THEMES, localStorage `ui-theme`, legacy `pastel`→`clay` 정규화).

### A-5. `src/components/ThemePicker.tsx` — 클럽 파일 그대로 복사
`D:\다운로드\club-league\src\components\ThemePicker.tsx` 전체 복사(5종 세그먼트 + 색 스와치). 의존: `@/lib/use-theme`, `@/lib/utils`만.

### A-6. `src/routes/__root.tsx` — 무플래시 + data-theme
`RootShell` 위에 추가:
```ts
const THEME_INIT = `(function(){try{var t=localStorage.getItem('ui-theme');if(t==='pastel')t='clay';if(['black','modern','glass','clay'].indexOf(t)<0)t='game';document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`;
```
`<html lang="ko">` → `<html lang="ko" data-theme="game" suppressHydrationWarning>`, `<head>` 첫 자식으로 `<script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />` 삽입.

---

# B. 컴포넌트 레벨 — 학교 파일에 적용(반복 작업)

### B-1. 표면 토큰 치환(라이트 테마 깨짐 방지) — `RecordMatch.tsx`, `MatchRecommend.tsx`, `MyAchievements.tsx`
선수 선택 picker/로스터/패널의 **다크 표면/글자**만 토큰으로. **승리 연출 모달의 `bg-[#0xxxxx]` hex 다수는 제외**(항상 다크). perl 일괄(학교 디렉터리에서):
```bash
for f in src/components/league/RecordMatch.tsx src/components/league/MatchRecommend.tsx src/components/league/MyAchievements.tsx; do
perl -i -pe '
  s/\bbg-\[#0e1322\](\/\d+)?/bg-surface-deep/g;
  s/\bbg-slate-950(\/\d+)?/bg-surface-deep/g;
  s/\bbg-slate-900(\/\d+)?/bg-surface-panel/g;
  s/\bbg-slate-800(\/\d+)?/bg-surface-line/g;
  s/\bborder-slate-8(?:00|50)(\/\d+)?/border-surface-line/g;
  s/\btext-slate-(?:100|200|300)(\/\d+)?/text-strong/g;
  s/\btext-slate-(?:400|450|500|600)(\/\d+)?/text-soft/g;
  s/\btext-gray-(?:300|500)(\/\d+)?/text-soft/g;
' "$f"; done
```
- 그 외 `bg-[#0a0f1d]`, `bg-[#041121]` 등 **연출 모달 hex는 그대로 둔다**(매핑 안 함).
- 강조색(amber/violet/sky/rose/emerald/neon/tier-*)·`text-slate-700/950`(밝은 위 어두운 글자)는 건드리지 않음.

### B-2. picker 검색창·로스터 이름의 `text-white` → 토큰
학교 `RecordMatch.tsx`/`MatchRecommend.tsx`의 **선수 선택 검색 input**과 **로스터 카드 이름**이 `bg-surface-deep` 위에서 `text-white`면 라이트 테마에서 안 보임:
- 검색 input `text-white` → `text-foreground`
- 로스터 카드 선수명 `text-white` → `text-strong`
- **주의**: 승리 연출 모달의 `text-white`(어두운 연출 배경 위)는 그대로 둔다. picker/로스터 것만 변경.

### B-3. 선수 이름 팀색 라이트 가독성 — `team-name`
학교 `RecordMatch.tsx`의 **선택된 선수 카드 이름**이 팀 강조색(blue/green 또는 amber/violet)으로 뜨면, 그 `<span>`에 `team-name` 클래스를 추가. styles.css의 `[data-theme=modern|glass|clay] .team-name{color:var(--strong)}`가 라이트 테마에서만 고대비로 바꿔줌(게임/블랙 다크에선 팀색 유지).

### B-4. 파란 글로우 테마화 — 인라인 blue glow → `glow-primary`
학교 전역에서 하드코딩 파란 box-shadow를 유틸로(테마별 자동: 게임=시안, 블랙/모던=약/없음, 글래스=소프트, 클레이=약):
```bash
for f in $(grep -rlE 'shadow-\[0_0_[^]]*(230|0,180,216|0\.78_0\.18)' src); do
  perl -i -pe 's/shadow-\[0_0_[^\]]*(?:230|0,180,216|0\.78_0\.18)[^\]]*\]/glow-primary/g' "$f"
done
```
- `text-glow-blue`는 styles.css에서 이미 `var(--text-glow-blue)`로 바뀌므로(A-1), **탭(TabButton, class.$classId 약 545줄)·리더보드 RP**의 글자 글로우가 테마별로 자동 적용됨. 추가 작업 불필요.

### B-5. "0으로 초기화" 버튼 무채색 — `RecordMatch.tsx` ScorePad
amber 버튼이면 무채색 토큰으로:
`bg-amber-500 ... text-slate-950 ... shadow-[...]` → `bg-muted text-muted-foreground hover:bg-accent hover:text-foreground border border-border/60`(글로우 제거).

### B-6. ThemePicker 배치 — 헤더 로그아웃 버튼 왼쪽
- 로비 헤더와 리그(class) 헤더의 **로그아웃 버튼 왼쪽**에 팔레트 아이콘 드롭다운으로 `<ThemePicker/>`를 넣는다(클럽과 동일 패턴):
```tsx
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <button title="화면 테마" className="...로그아웃과 같은 스타일..."><Palette className="size-4"/><span className="hidden sm:inline">테마</span></button>
  </DropdownMenuTrigger>
  <DropdownMenuContent align="end" className="w-60 p-3"><ThemePicker/></DropdownMenuContent>
</DropdownMenu>
```
- import: `Palette`(lucide), `ThemePicker`, `DropdownMenu*`(@/components/ui/dropdown-menu).

---

# C. 검증
1. `npx tsc --noEmit` 0, `npm run build` 0 에러.
2. preview(데스크톱·375px): 헤더 테마 버튼으로 5종 전환 →
   - 게임: 마젠타/시안 네온, 블랙: 무채색, 모던: 웜+먹, 글래스: 카드 유리(blur+sheen)+아쿠아 배경, 클레이: 캔디·통통·알약버튼.
   - **라이트 테마(모던/글래스/클레이)에서 선수 선택 picker·로스터·이름·탭·RP 글자가 어두운 패치/흰글자 없이 잘 보임.**
   - 승리 연출 모달은 모든 테마에서 기존처럼 어둡게 유지(연출 hex 미변경).
3. 새로고침 시 선택 테마 유지, 무플래시.

# D. 주의
- 학년/반/번호 정체성·매칭 범위(우리반/다른반/다른학년)·강등 보호막 등 **학교 고유 기능은 건드리지 않는다**(테마는 색/토큰만).
- 강조색 ~수백 곳 완전 토큰화는 범위 밖(표면/글자/글로우 토큰 + theme-card/theme-btn 훅으로 커버).
- 커밋/푸시는 사용자 요청 시에만.
