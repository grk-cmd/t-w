# 작업 현황판 — 누가 무엇을 만지는 중인가

여럿이 같은 일 · 같은 파일을 동시에 고치지 않게 하려고 둔다. **누구든(사람 · 세션 · 웹 세션) 작업을 시작하기 전에 이 파일부터 본다.** 기준: 2026-10-19.

## 0.11.4 기능 멈춤 (10-17 사용자)
- **0.11.4 에 넣을 기능은 여기까지.** 이제부터 만드는 기능 · 옮기기는 요청(PR)까지만 올리고, 0.11.4 릴리스 뒤에 하나씩 합친다.
- 0.11.4 에 넣는 것은 회귀 · 급한 버그 고침만(검증 세션과 먼저 맞춘다).
- 서버로 옮기기(앱은 API 하고만 · Firebase 는 저장소 포트 뒤 · 인증은 Firebase Auth)는 설계 문서(서버 저장소 docs/notes) 차례대로 0.11.4 뒤부터.

## 작업 시작 절차 — 누구든 코드를 만지기 전에 이것부터
1. **최신을 받아 본다** — `git fetch origin && git show origin/main:docs/WORK_STATUS.md`(어느 판 브랜치에서 일하든 이 파일은 main 것이 정본).
2. **같은 일 · 같은 파일 줄이 있으면 상태대로**:
   - **검토중** → 시작하지 말고 사용자에게 «제가 할까요, ○○(그 줄 담당)이 할까요?» 를 묻는다.
   - **작업중** · **작업완료** → 하지 않는다(필요하면 그 줄 담당 · PR 을 알려 준다).
3. **없으면 줄을 먼저 쓰고 커밋 · push 한 뒤 착수한다** — 보기만 해도 «검토중», 고치기 시작하면 «작업중». 칸: 상태 · 묶음 · 담당 · 판 · **브랜치** · 내용 · 건드리는 파일 · PR.
   - **브랜치 칸은 꼭** — 머지되면 GitHub Actions 가 이 칸으로 줄을 찾아 «작업완료» 로 바꾼다. 브랜치를 아직 안 땄으면 딸 이름을 적는다.
4. **이 파일 하나만 따로 main 에 바로 커밋 · push**(`docs(status): <묶음> <상태> — <담당>`). 다른 파일을 섞지 않는다 · force push 금지. push 가 거절되면 `git pull --rebase` 뒤 다시 보고 — 그새 남이 같은 일을 잡았으면 멈춘다.
5. PR 을 올리면 그 줄 PR 칸에 번호. **머지되면 «작업완료(판) · #PR · 날짜» 로 바뀌는 건 GitHub Actions 가 한다**(/ship · GitHub 버튼 · 웹 세션 어느 길로 머지해도). 작업완료 줄은 그 판을 낼 때 한꺼번에 걷는다.
- 웹 관리자 📋 할 일(`adminTodos`)에는 버그 제보와 관련된 일만 적는다. 기능 · 계획 · «지금 누가 무엇을 하나» 는 이 파일이 정본이다.

## 규칙
- **판은 사용자가 고른다** — 작업 전에 «어느 버전에 릴리스될 작업인가» 를 묻고 그 판 `release/X.Y.Z` 에서 딴다(지금 열린 판: release/0.12.0). 긴급 수정만 `hotfix/*`, 하네스만 `harness/*` 를 main 에서.
- **머지는 `/ship`** — 컨펌자 · 검증자 통과 → CI → 머지. 승인은 가드 자리를 바꾸는 PR 만(`risk.py --owner <PR>`) — 그 밖은 위험도가 높아도 자동. 로컬에서 검사 전체를 다시 돌리지 않는다(고친 검사만 · 전체는 CI).
- `checks/CHECKS.md` 에 개정 번호 · 기록은 적지 않는다(10-19 없앰 — 내력은 git). §3 해시만 맞춘다.
- **클릭 통과(setIgnoreMouseEvents)를 정하는 조건은 `app/parts/launcher/click-through-policy.js` 한 곳에만 쓴다.** 다른 파일에 조건을 쓰면 `sim-click-through-policy.js` 가 빨강이다(#315 머지부터).
- **담당 이름은 남과 겹치지 않게** 쓴다(예: «검증-도우미1» · «계정 세션» · 사람 이름). 같은 이름이 둘이면 누가 누군지 못 가린다.
- 버그 제보를 고친 PR 은 제목 끝에 `(B-MMDD-n)` 을 붙이고, 아래 «제보 → 수정» 표에 한 줄 더한다.

## 진행 중 — 검토중 · 작업중 · 작업완료
| 상태 | 묶음 | 담당 | 판 | 브랜치 | 내용 | 건드리는 파일 | PR |
|---|---|---|---|---|---|---|---|
| 작업완료(0.12.0) | 규칙 옛 앱 방 막기 | 서버 hotfix 세션(togetherworking-6b) | 0.12.0 | rules/old-app-room-block | 0.10.2 이하가 방을 여는 것 막기 — ① `config/minRoomVer` 읽기를 옛 앱 막기에서 빼서 옛 앱이 최소 버전을 읽고 스스로 멈추게(읽기 거부 → «조회 실패는 통과» 로 문이 열리던 것) ② 방 멤버 칸을 처음 만들 때 그 사람 presence 가 «접속중 · ver 없음» 이면 거절(사용자 10-20) | `firebase-database-rules.json`(config/minRoomVer · rooms/$room/$memberId) · `scripts/rules-emu-check.js` · `checks/sim-rules-src.js` · CHECKS.md | #423 · 2026-10-20 |
| 작업중 | 하네스 | 서버 hotfix 세션(togetherworking-6b) | main | harness/status-via-prs | 현황판을 main 커밋 대신 GitHub 로 — 작업중 = 초안 PR · 검토중 = 이슈 라벨 · 작업완료 = 머지 · 보기는 스크립트 + 시작 hook(main 의 docs(status) 커밋 주 180개 → 0 · 사용자 10-20 «A») | docs/WORK_STATUS.md · .github/workflows/work-status-done.yml · scripts/(현황 보기) · .claude/hooks/(시작 hook) · CLAUDE.md · docs/GIT_CONVENTION.md | |
| 작업완료(0.12.0) | 방 | 오케스트레이터 | 0.12.0 | fix/together-chat-keep-1h | 빈 투게더룸 #일반 대화(chatLog)를 바로 지우지 않고 1시간 뒤에 지움 — 그새 다시 열리면 남김(빈 Firebase 방 · 방 서버 방 닫힘 둘 다 · 사용자 10-20 «1시간») | `functions/room-stats.js` · `functions/index.js`(주석) · `checks/sim-room-meta-cleanup.js` · CHECKS.md | #419 · 2026-10-20 |
| 작업완료(0.12.0) | 방 | 오케스트레이터 | 0.12.0 | fix/room-ghost-member | 시각(lastSeen) · 하트비트 도장 둘 다 없는 멤버를 «있는 사람» 으로 세던 것 — 앱 입장 검사(Firebase 방에 붙잡힘) · 서버 빈 방 판정(영영 안 정리됨) 둘 다 찌꺼기로(사용자 10-20) | `app/parts/room/room-alive.js` · `functions/room-stats.js` · `checks/sim-room-alive.js` · 함수 검사 | #414 · 2026-10-20 |
| 작업완료(main) | 하네스 | 오케스트레이터 | main | harness/approve-at-release | 승인은 main 으로 가는 PR(하네스 · 긴급 수정)만 · 판 브랜치 PR 은 컨펌 · 검증 · CI 로 머지 · 릴리스 직전 «위험도 높았던 PR» 한 장 요약(risk.py --release) · 파일 내용이 같으면 판정 이어받기 · #407 위에 쌓음(사용자 10-20 «a») | .claude/hooks/risk.py · .claude/hooks/ship-gate.py · .claude/hooks/test_hooks.py · .claude/skills/ship/SKILL.md · CLAUDE.md · docs/RELEASE.md · docs/WORK_STATUS.md(규칙 줄) | #410 · 2026-10-20 |
| 작업중 | 📘 도움말 사이트 | 오케스트레이터 | 0.12.0 | chore/drop-design-page | 디자인 시스템 웹 페이지(/design/) 걷기 — 원본 docs/design-system 은 남김 · 빌드는 도움말 토큰(hosting/help/tokens.css)만 · #408 위에 쌓음(사용자 10-20) | `hosting/design/`(지움) · `scripts/build-design-site.js` → `build-design-tokens.js` · `checks/sim-design-site.js` → `sim-design-tokens.js` · `package.json`(script 한 줄) · 문서 | |
| 작업중 | 📘 도움말 사이트 | 오케스트레이터 | 0.12.0 | feat/help-site-privacy-link | 개인정보 처리방침 · 폰 연결 안내를 도움말 사이트(help.together-working.com)로 옮김 — 앱 링크 세 곳 새 주소 · 옛 web.app/privacy · /link 는 새 주소로 넘김(옛 앱) · #406 위에 쌓음(사용자 10-20) | `hosting/privacy.html` · `hosting/link.html` → `hosting/help/` · `firebase.json`(redirects) · `desk-companion-prototype.html`(링크 두 곳) · `focus/focus-level.js` · 검사 | |
| 작업완료(main) | 하네스 | 오케스트레이터 | main | harness/new-site-confirm | 앱에 바깥 주소를 새로 박는 일은 사람 확인 — CSP 가 바뀌거나 Firebase 기본 주소(*.web.app · *.firebaseapp.com)가 새로 들어오면 위험도 높음 · 컨펌자 점검표 · 작업 규칙 «새 사이트는 우리 도메인»(사용자 10-20) | .claude/hooks/risk.py · .claude/hooks/test_hooks.py · .claude/review-lessons.md · CLAUDE.md | #407 · 2026-10-20 |
| 작업중 | 하네스 | 오케스트레이터 | main | harness/approve-carry | 승인 손 줄이기 — 승인 뒤 판 브랜치만 합친 커밋은 앞 판정 · 승인을 이어 받음(PR 자체 변경이 같을 때만 · 가드가 확인) · 승인 · CI 를 세션이 지켜보다 머지(`risk.py --wait`) · «/ship 을 다시» 문구 걷기(사용자 10-20) | .claude/hooks/risk.py · .claude/hooks/ship-gate.py · .claude/hooks/test_hooks.py · .claude/skills/ship/SKILL.md · scripts/approve.js || #405 |
| 작업중 | 📘 도움말 탭 | grk 튜토리얼 세션 | 0.12.0 | claude/vibrant-hypatia-gotvcy | 튜토리얼(1~7편)을 웹 페이지(Hosting `/help`)로 올리고 마이홈에 **«도움말» 탭을 새로** 만들어 끼워 보여 준다 — 왼쪽 목차(묶음 접고 펴기) · 오른쪽 틀(sandbox · CSP frame-src 는 우리 Hosting 한 곳 · main.js 틀 이동은 도움말 주소만). 알림함의 📘 도움말 칸은 뺀다 | `hosting/help/` · `desk-companion-prototype.html`(도움말 탭 · CSP frame-src · 알림함 도움말 칸 빼기) · `main.js`(will-frame-navigate) · `shared/help-site.js`(새) · `myhome/help-tab.js`(새) · `myhome/myhome-ui.js` · `myhome/inbox-sections.js` · `myhome/myhome-inbox.js` · `shared/error-codes.js` · `app.js` · 검사 | |
| 작업중 | 📩 우편함 → 알림함 이름 | grk 튜토리얼 세션 | 0.12.0 | claude/rename-inbox-alim | 마이홈 탭 «우편함» → «알림함» · 벨 창 «📪 알림함 확인» · 디자인 스튜디오 항목 이름 · 버그 제보 안내(관리자 문구 · 내부 이름은 그대로) | `desk-companion-prototype.html`(탭 이름) · `myhome/scheduler.js` · `myhome/myhome-edit.js` · `support/bug-board-ui.js` · `checks/sim-scheduler.js` | #404 |
| 작업중 | 우편함 소식 칸 정리 | 계정 세션(머지는 검증 세션) | 0.12.0 | feat/inbox-tidy | 우편함 오른쪽 위 짙은 머리 띠(«소식 · 작성 · 전체 읽음») 걷기 → «전체 읽음» · «읽은 우편 지우기» 는 목록 아래 버튼만(띠 없음) · «작성» 은 전체 · 공지 · 업데이트 탭 옆 · 공지 / 업데이트 꼬리표 색 다르게 · 목록 스크롤바 숨기고 마우스로 끌기 · 휠로 움직이기 · 우편 아이콘 상자 걷기 · 버그제보 답변 🛠️ | `myhome/myhome-inbox.js` · `desk-companion-prototype.html`(우편함 칸 · css) · 검사 | #399 |
| 작업중 | 스티커사진 음악 켜고 끄기 | 계정 세션 | 0.12.0 | feat/purikura-bgm-toggle | 스티커사진 창 제목줄 남은 횟수 왼쪽에 «음악 끄기 / 음악 켜기»(마이홈 말랑이 숨기기와 같은 글자 버튼 · 시안 A) — 끈 상태는 이 PC 에 기억 · 다른 BGM 재우기 · 되살리기는 그대로 | `purikura/purikura-ui.js` · `desk-companion-prototype.html`(제목줄 span 하나) · 검사 | #398 |
| 작업완료(main) | 하네스 | 오케스트레이터 | main | harness/role-sessions | 역할 세션(서버 · 보안 · 투두 · 질문) — 이름으로 열면 시작 hook 이 역할 지침을 붙임 · 켤 때 열린 판 한 장 요약 + «어느 버전?» · /roles 스킬 | .claude/roles/* · .claude/hooks/(새 시작 hook · 시험) · .claude/settings.json · .claude/skills/roles/ | #396 · 2026-10-19 |
| 작업완료(main) | 하네스 | 오케스트레이터 | main | harness/status-done-action | PR 머지되면 현황판 줄을 «작업완료(판) · #PR · 날짜» 로 바꾸는 GitHub Actions | .github/workflows/(새 파일) · scripts/(새 순수 함수) · checks/(새 sim) · docs/RELEASE.md | #397 · 2026-10-19 |
| 검토중 | 제보 B-1019-3 | 미지정 | 미정 | fix/skin-blank | 캐릭터 피부가 투명해져 뒤가 비침 — 원인 · 고칠 방향은 PR 에 | app/parts/app.js(newCanvas) · app/parts/character/face-heal.js | |
| 검토중 | 제보(번호 미정) 동물 얼굴 · 올라타기 | 미지정 | 미정 | fix/animal-fallback-stuck | 동물 캐릭터 얼굴이 안 보이고 올라타기가 안 됨 — 원인 · 고칠 방향은 PR 에 | app/parts/character/animal.js · app/parts/app.js · app/parts/room/ride-bench.js | |
| 검토중 | 보안 점검 | 보안 점검 세션 | 미정 | — | 보안 점검(읽기만) — 고칠 것은 묶음별로 새 줄 | 없음 | |
| 작업완료(main) | 하네스 | 오케스트레이터(보안 점검 세션 #400 에서 이어받음) | main | harness/hook-utf8 | Windows(cp949)에서 risk.py · ship-gate.py 가 한글 출력으로 죽던 것만 고침 — «새 모듈» 규칙 빼기(#400)는 닫음(사용자 10-19) | .claude/hooks/risk.py · .claude/hooks/ship-gate.py · .claude/hooks/role-start.py · .claude/hooks/test_hooks.py | #403 · 2026-10-19 |
| 작업완료(main) | 규칙 hotfix 로그인 읽기 | 오케스트레이터 | main(hotfix) | hotfix/authusers-self-read | 옛 앱 차단(presence 켜짐 · ver 없음)이 로그인 때 자기 authUsers 한 칸 읽기까지 막아, presence 가 남은 사람은 구글 · 친구 코드 로그인이 영영 실패하던 것 — 자기 authUsers 읽기만 차단에서 뺀다 | firebase-database-rules.json(authUsers) · checks/sim-rules-src.js · scripts/rules-emu-check.js | #401 · 2026-10-19 |
| 작업완료(main) | 하네스 | 오케스트레이터 | main | harness/approve-cmd | 승인 명령 — 터미널에서 `! scripts/approve.sh <PR 번호…>` 한 줄로 그 PR 머리 커밋에 «승인» 코멘트 · 세션이 이 명령을 돌리면 가드가 막음 · 승인 요청 코멘트에 이 명령을 적음 | scripts/approve.sh(새) · .claude/hooks/ship-gate.py · .claude/hooks/test_hooks.py(#396 · #400 과 같은 파일) · .claude/skills/ship/SKILL.md(#400 과 같은 파일) | #402 · 2026-10-19 |
| 작업완료(0.12.0) | 규칙 userAuth 봇 읽기 | 서버 hotfix 세션(togetherworking-6b) | 0.12.0 | rules/userauth-bot-read | `userAuth` 노드에 apiBots 읽기 한 줄 — 서버가 신원 연결표를 구독해 PG 사본으로(서버 설계 AUTH_IDENTITY_SPLIT ① · 앱 동작 무변경) | firebase-database-rules.json(userAuth) · checks/sim-rules-src.js(필요하면) · checks/CHECKS.md §3 | #411 · #412 · 2026-10-20 |
| 작업완료(0.12.0) | 오픈소스 라이선스 창 | 서버 hotfix 세션(togetherworking-6b) | 0.12.0 | feat/oss-licenses | «개인정보 처리방침» 옆 «오픈소스 라이선스» 링크(설정 › 시스템 · 내 정보) → 고정 크기 창 · 안쪽 스크롤 · 목록은 스크립트가 lock 에서 만든다(사용자 10-20) | app/parts/launcher/oss-licenses.js(새) · app/licenses/oss-notices.js(새 · 만든 파일) · scripts/third-party-notices.js(새) · desk-companion-prototype.html(링크 둘 · script 한 줄) · app.js(한 줄) · checks/smoke.js · checks/sim-oss-licenses.js | #413 · 2026-10-20 |
| 작업완료(0.12.0) | 앱 가볍게(의존성 정리) | 서버 hotfix 세션(togetherworking-6b) | 0.12.0 | chore/slim-deps | 앱에서 안 쓰는 npm `firebase`(설치본 node_modules 162MB 중 140MB — 앱은 CDN 10.12.2 를 씀) 빼기 · 라이선스 목록 다시 만들기 · 그 밖에 설치본에 쓸데없이 들어가는 것 줄이기(사용자 10-20 «앱 가볍게 최대한») | `package.json`(dependencies · build.files — chore/drop-design-page 의 script 줄과 다른 줄) · `package-lock.json` · `scripts/third-party-notices.js` · `app/licenses/oss-notices.js` · 검사 | #415 · 2026-10-20 |
| 작업완료(0.12.0) | 첫 화면 버전 · 개인정보 처리방침 | 서버 hotfix 세션(togetherworking-6b) | 0.12.0 | feat/gate-privacy-version | 첫 화면(초대 게이트 — 로그인 전) 카드 맨 아래에 «v버전 · 개인정보 처리방침» 한 줄 — 정보를 주기 전에 처리방침을 볼 수 있게 · 로그인이 안 돼도 버전이 보이게(옛 «앱 버전 보이기» 줄을 이걸로 · 웹 관리자 쪽은 이미 됨 · 사용자 10-20) | `app/desk-companion-prototype.html`(게이트 카드 한 줄) · 링크 · 버전 거는 모듈 · 검사 | #418 · 2026-10-20 |
| 작업중 | 웹 관리자 방 목록 | 서버 hotfix 세션(togetherworking-6b) | 0.12.0 | feat/admin-room-search | 방 목록에 검색 칸(방 코드 · 들어간 사람 둘 다 — 사용자 10-20) · 방 서버 방은 인원 «—» · 방 서버 시크릿룸은 목록에 안 나옴 → 방 서버 관리자 API 로 «열린 방 전부(시크릿 · 인원 포함)» 받아 합치기(서버 작업 필요) · roomIndex 에는 안 적음(모든 앱이 읽는 공용 장부라 시크릿 코드가 드러남) | `web-admin/src/widgets/room-list/` · `web-admin/src/entities/room/` · (서버) t-w-server 관리자 API | |
| 작업완료(0.12.0) | 웹 관리자 사용자 · 버전 | 서버 hotfix 세션(togetherworking-6b) | 0.12.0 | fix/admin-ver-fallback | API 에 못 닿아 RTDB 로 넘어가면 버전 칩 · 버전 걸러 보기 · 마지막 접속이 아직 계정 요약(accountSnap — 로그인 기기가 켤 때만 씀) 기준 → presence 기준으로 · presence ver `unknown` 이 버전 칩으로 나오는 것 · 운영 DB 로 friendCodes · accountSnap 키 수와 관리자 «전체 n명» 맞대 보기(firebase 재로그인 필요) | `web-admin/src/entities/user/model/version.ts` · `userView.ts` · `userRow.ts` | #421 · 2026-10-20 |

## 대기 — 앞 줄이 머지돼야 올림
| 줄 | 내용 | 기다리는 것 |
|---|---|---|
| wJ 037867e | 같은 자리 여러 번 클릭 → 투게더워킹 활성화 (CONFIRM 38 승인) | #315 머지 · main #261(같은 증상 · 다른 방법) 과 겹치는지 다시 판단 |
| wAD 33d3d60 · f92b0f9 · d4afa40 | 클릭 통과 더 묶기 · 회복 사다리는 캐릭터 · 창 근처 클릭만 (B-1016-7) | wJ 037867e |
| wAC 85b8eee · 6e07031 — 책상 자리는 머지 #332 · 평준화 가두기는 main 에서 못 찾음(확인 필요) | 평준화 가두기 · 책상 자리를 모듈로 | 순서 |

## 보류 — 서버 배포가 먼저(서버 브랜치가 아직 main · 배포 전)
| 줄 | 필요한 서버 브랜치(t-w-server) |
|---|---|
| wR 721ae87 친구 목록 스위치 빼기 | `feat/api-me-friends` |
| wP-C 943cc36 · b81d6e2 · ca05542 · bd69537 · 735a70a · e67dbea(규칙) | `feat/realtime-presence` · `feat/api-friends-write` |
| (머지됨) #289 · #290 운영 설정 · #293 카탈로그 API | `feat/ops-hot-config` · 카탈로그 GET(앱 릴리스 전 배포) |

## 보류 — 결정 · 다시 얹기 대기
| 줄 | 까닭 |
|---|---|
| #51 안 묶인 uid 쓰기 37곳 잠금(보안) | 비밀번호 초기화(w2 세션)와 같은 계정 · 로그인 자리 — 그 작업이 합쳐진 뒤 그 위에 새로 만든다(검증 세션). 그때까지 구멍은 열려 있음 |
| wP-C 797d022 | 토스트 줄바꿈이 먼저 들어가야 |

## 제보 → 수정
| 제보 | 증상 | 수정 PR | 상태 |
|---|---|---|---|
| v0.11.3 제보 | «친구 없음» 인데 추가하면 «이미 친구» | #306 · #307 | 머지 |
| 10-16 제보 1 · 2 · 6 · 10 · 11 · 12 | 알림콩 · 가챠 창 닫힘 · 상태 이모지 · 편집창 겹침 · 날기 천장 | #258 | 머지 |
| 10-16 제보 9 · 13 | 보관함 이동 복제 · 다른 앱 더블클릭 때 앞으로 옴 | #261 | 머지 |
| 10-16 제보 4b | 올라탄 동물을 다른 동물로 바꾸면 이전 위치에 떠 있음 | — (main 40e84b5 에서 재현 안 됨 — 바꾸면 내려와 자기 자리 바닥으로 · 탑 가운데 · 꼭대기 · 아래 사람 바꾸기도 정상 · 4a 는 #328) | 제보자에게 최신 버전으로 다시 확인 요청 · «바꿔도 계속 타고 있기» 를 바란 거면 새 기능(계정 세션) |
| 10-16 제보 8 | 라이선스 등록 뒤 저장한 생성기 프리셋을 못 불러옴 — 프리셋이 카탈로그 책상 GLB 를 통째로 담아 저장소가 넘침(1MB 책상이면 4번째 칸부터) | #367 | 검증 |
| 10-16 제보 7 | Xbox 패드로만 게임하면 기록이 멈추고 잠듦(게임이 앞이면 패드 값을 못 받음) | #333 | 머지 |
| B-1016-4 | 마이홈 띄운 채 편집 열면 마이홈이 위에 겹침 | #342 | 머지 |
| B-1016-7 | 다른 앱 더블클릭을 먹음(회복 사다리) | #261(일부) · wAD | 대기 |
| B-1016-4 | 마이홈을 띄운 채 캐릭터 편집을 열면 마이홈이 위에 겹침 | #258(숨김 땜질) → B-1016-4 창 겹침 근본 | 진행 중 |
| B-1013-8 | 디자인 프리셋에 그림이 안 담김 | #324 | 머지 |
| B-1015-3 | 생성기 프리셋 저장 · 읽기 실패를 안 알림 | #353 | 머지 |
| 리깅 모자 날기 | 모자 쓰고 날면 화면 아래에서 맴돎 | wL2 | 대기 |

## 머지 완료(10-17 검증 세션)
- 10-18: #355 범용 데이터 통로(0.11.4 · 표가 비면 무변경 · 규칙 config/dataRoutes 운영 배포 필요)
- 10-17 밤: #353 생성기 프리셋 저장 · 읽기 실패 알림 · 망가진 프리셋 덮어쓰기 막기(B-1015-3 · 0.11.4)
- 10-17 밤: #351 웹 관리자 제보 목록 관리자 API(전체 쪽 수 · 쪽 번호 · 폴백) + viaApiOr 한 벌 + bugBoard/list 봇 읽기 규칙 · 서버 t-w-server #51 dev 합침 — 운영 배포: 규칙 → 서버 → 웹 관리자
- 10-17 밤: #255 앱 크기 기준선 쓰기(개정 360) · #153 웹 관리자 사용자 목록을 관리자 API 로(못 닿으면 옛 RTDB · 웹 관리자 Hosting 배포 필요)
- 10-17 밤 운영 배포 끝(사용자): 규칙(doneTs) · 함수 bugCleanup · adminDeleteAccount · deleteMyAccount · Hosting(웹 관리자 새 서버 주소 #343 · 처리방침 시행일 2026-10-18)
- 10-17 밤: #347 해결된 버그 제보 한 달 뒤 자동 삭제 · 탈퇴 때 제보 삭제 · 처리방침 보강 — **배포 필요(규칙 · 함수 3 · Hosting)**
- 10-17 밤(검증-도우미8): #340 몸 크기 재기 한 곳 · #342 창 겹침(B-1016-4 · grk 탈퇴 안내 css 지킴) · #343 서버 주소 together-working.com(웹 관리자 Hosting 배포 필요) · #344 자동 검사 판정 한 벌(릴리스 버튼 구멍 막음) · #345 토스트 누르면 복사
- 10-17 저녁: #339 이름표 · 경험치 바 끌어 좌석 바꾸기(grk #334 대신 — 날기 판단 한 줄을 캔버스와 같이 · 경험치 바는 deps 로 · 개정 350 · 351)
- 10-17 저녁: #338 도메인끼리 직접 부르는 곳이 늘면 빨강(sim-domain-calls.js · 기준선 34곳)
- 10-17 저녁: #335 자기 작업 직접 합치기 차례 · #336 공유 코드 규칙 · #337 바뀐 곳만 검사
- 10-17 저녁(계정 세션 · 사용자 요청으로 직접 머지): #333 게임패드 — 게임이 앞이어도 XInput 으로 읽기(개정 348)
- 10-17 저녁(검증-도우미5): #330 친구 목록 실패 토스트 줄바꿈 · #331 네트워크 준비 기다리기 net-ready.js 한 곳 · #332 평준화 가두기 seat-eq-clamp.js · 책상 자리 desk-place.js(28f731c 순환 없이)
- 10-17 저녁(검증-합치기): #320 내 코드 없으면 요청 안 보냄 · #324 디자인 프리셋 그림(B-1013-8) · #326 w4 다섯 줄 · #329 #320 되돌림 고침 · #321 두 번째 실행 10초 · #323 토스트 줄바꿈 · #325 realtime 공통부 · #327 에러코드 · #328 좌석 다시 맞추기(개정 325~343)
- 10-17 오후: #318 런처 GPU 부하 줄이기(#265 대신) · #322 회원 탈퇴 안내를 계정 탭 자리에(grk #319 대신 — 검사 기록 번호만 다시 매김)
- 10-17 오후: #315 클릭 통과 판단 한 곳 · #316 옛 주석 줄이기 규칙 · #317 이 현황판
#255 이후 검증 세션이 올려 머지한 것: #256 · #263 · #269 · #270 · #273 · #281 · #284 · #286 · #288 ~ #312(카탈로그 · 친구 사슬 · 펜 끌기 등). 줄별 기록은 대기열(`docs/local/carve-handoff/QUEUE.md`, 이 PC 에만 있음).
