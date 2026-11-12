# app/parts/support — 🐞 버그 제보 · 🚩 신고

## report-api.js — 🚩 신고 provider(classic script `window.TwReportApi`)
- 책임: 신고 서버 길(`POST /v1/reports`) · 관리자 신고 목록 길(`GET /v1/admin/reports` · `POST …/dismissals` · `POST …/{target}/take-down`) 한 벌. 경로 · 본문 모양 · 서버 종류 이름(`CHARACTER` · `AWAY_IMAGE` · `NICKNAME` · `ETC`) · 서버 줄 → 화면 줄 바꾸기는 여기만 안다.
- deps: `authed`(로그인 통로 `TwApi.authed` — `post(path, body)`) · `errs`(`TwApiErrors` — `translate` · `COMMON`).
- 내놓는 것: `createReportApi(deps)` → `{ file(target, kind, note), failOf(err) }` — `target` 은 신고할 사람의 사용자 코드, `kind` 는 신고 창 사유 이름(`char` · `away` · `nick` · `etc`).
  `failOf` 는 실패 하나 → 갈래(`self` · `noAwayImage` · `noteRequired` · `common` · `site`). 서버 거절 code 는 기능 표 `ERRORS` 에만 있다(공통 표보다 먼저 본다).
  순수: `bodyOf(target, kind, note)`(보낼 본문 `{ target, kind, note? }`) · `failOf(err, errs)` · `KIND` · `FAIL` · `ERRORS` · `NOTE_MAX`(40) · `PATHS`.
  `createAdminReportApi(deps)`(같은 deps — `authed.get` 도 씀) → `{ page(cursor), dismiss(target), takeDown(target, url), failOf(err) }` — 관리자 신고 목록(`admin/admin-report.js`)이 부른다.
  `page` 는 `{ items:[{ target, name, friendCode, awayImg, count, reporters:[{ code, friendCode, name, kind, note, at }] }], next, total }`(신고자는 최근 것이 위 · 신고자 `name` 은 신고할 때 이름 `nameSnapshot` 이 먼저 · `kind` 는 신고 창 사유 이름 · 모르면 null · `total` 은 첫 쪽에만) · 관리자 갈래는 `imageChanged` · `common` · `site`.
  순수(관리자): `targetOf` · `pageOf` · `adminFailOf(err, errs)` · `KIND_OF` · `ADMIN_FAIL` · `ADMIN_ERRORS`.
- 함정:
  - 신고한 사람은 서버가 토큰에서 정한다 — 본문에 내 이름 · 코드를 싣지 않는다.
  - 실패는 ApiError 를 그대로 던진다. 다시 보내지 않는다(다시 하는 길은 사용자가 [신고] 를 다시 누르는 것뿐).
  - 틀린 값(대상 없음 · 모르는 사유 · 40자 넘는 글)은 요청 없이 code `INVALID` 로 던진다.
  - 같은 사람을 다시 신고하면 서버가 열린 신고를 고친다 — 그래서 `requestId` 칸이 없다.
  - 관리자 목록에 `minReporters` 를 싣지 않는다 — 서버 기본(3)이 신고 창 안내 «서로 다른 3명» 과 같다.
  - 관리자 응답 모양이 틀리면 code `SHAPE` 로 던진다(빈 목록으로 돌리지 않는다 — 실패 ≠ 없음). `dismiss` 는 그 사람 줄이 `ok` 가 아니면 그 줄의 code 로 던진다.
- 검사: `checks/sim-report.js`.

## report.js — 🚩 신고 창 · 공용 도우미(classic script `window.TwReport`)
- 책임: 좌석 · 책상 · 이름표 우클릭 «🚩 신고하기…» 창(사유 넷 · 기타 40자) → `report-api.js` 로 보내기 → 성공하면 내 화면에서 숨김(`hidden-seats.js` 의 같은 Set) · 창 닫기.
  관리자 신고 목록(`admin/admin-report.js`)과 함께 쓰는 창 틀 · 닫기 · 팝업 칸(한 번에 하나)을 가진다.
- deps: `toast` · `getMyUserId` · `seatLabelName` · `awayUrlOk` · `reportHiddenSave` · `reportHiddenUids` · `reportApi`(`TwReportApi.createReportApi`) · `apiErrors`(`TwApiErrors.store`) · `notifyError`(`TwErrorCodes.notify`).
- 내놓는 것: `openDialog(seat)` · 관리자 목록용 `close` · `box` · `KINDS` · `ADMIN_MIN` · `ov` · `setOv` · `esc` · `setEsc`.
- 실패: `reportApi.failOf` 의 갈래만 본다 — `self` 는 조용히 닫기 · `noAwayImage` · `noteRequired` 는 안내 문구 · `common`(로그인 풀림 · 점검 · 닿지 못함 등)은 공통 표(`apiErrors.notify`) · 그 밖은 `E-RPT-01`. 실패하면 숨기지 않고 [신고] 를 다시 켠다 · 다시 보내지 않는다.
- 함정: 보내는 동안 [신고] 는 꺼져 있다(연타로 두 번 보내지 않게). `ADMIN_MIN`(3)은 창 안내 문구 «서로 다른 3명» · 관리자 목록 머리 글에만 쓴다 — 거르기는 서버 기본(3)이 한다(서버 기본이 바뀌면 같이 고친다).
- 검사: `checks/sim-report.js` · `checks/sim-report-away.js`.

## bug-board.js — 🐞 버그제보 규칙(classic script `window.TwBugBoard`)
- 책임: 게시판 화면 · provider 가 같이 보는 상수 · 순수 함수 — 한 쪽 크기(`BUG_PAGE` 8 · 서버 `limit` 로 보냄) · 입력 상한(제목 60 · 본문 2000 · 환경 120 · 답글 1000 — 서버와 같음) · 분류 일곱(`BUG_CATS` — «건의» 포함) · 상태 여섯(`BUG_STATUS` — «검토중» 포함) · 글쓴이 상태 셋 · 오픈카톡 주소 판정 · 공개 범위 안내 문구 · 서버 거절 code 별 안내 문구(`GUIDE_TEXT`).
- 내놓는 것: 위 상수 · `checkPost(p)`(새 글 입력 확인 — 문제없으면 null) · `canChangeVis(post)`(내 글 · 공지 아님 · 댓글 0 — 서버 공개 범위 바꾸기와 같은 조건).
- 함정: 분류 · 상태 열쇠는 서버 이름(`BUG` · `REVIEW` …)의 소문자다 — 하나 늘리면 서버 값과 같이. 요청 · DOM · 저장을 모른다.
- 검사: `checks/sim-bug-board.js` 2절.

## bug-api.js — 🐞 버그제보 provider(classic script `window.TwBugApi`)
- 책임: 게시판 서버 길 한 벌 — 목록(`GET /v1/bugs?filter=&limit=&cursor=` · 공지 `filter=notices`) · 글(`GET /v1/bugs/{number}`) · 새 글(`POST /v1/bugs`) · 답글(`POST …/{number}/replies`) · 공개 범위(`PATCH …/{number}/visibility`) · 👍(`PUT …/{number}/like`) · 봤음(`PUT /v1/me/bugs/{number}/seen`) · 오늘 남은 수(`GET /v1/me/bugs/quota`) · 새 답변 배지 수(`GET /v1/me/bugs/unseen-count`).
  서버 모양(대문자 이름 · ISO 시각 · `author`) → 화면 모양(`vis` 'pub'|'prv' · 소문자 `cat` · `status` · ms · `anon` · `authorReplied`)은 여기 한 곳(`rowOf` · `postOf`).
- deps: `authed`(`TwApi.authed`) · `errs`(`TwApiErrors` — `translate` · `COMMON`) · `pending`(요청 번호 기억 만들기 — `TwRequestId.createPending`).
- 내놓는 것: `createBugApi(deps)` → `{ KIND, ERRORS, list, notices, detail, write, reply, setVis, like, seen, quota, refreshBadge, badgeCount, failOf, reset }`. 순수: `rowOf` · `postOf` · `pageOf` · `quotaOf` · `writeBody` · `failOf(err, errs)` · `PATHS` · `KIND` · `ERRORS` · `LIMIT_MAX`.
  `failOf` 갈래 — `guide`(안내 문구 · 번호 없음) · `missing`(없는 글) · `private`(남의 비공개 글) · `conflict`(그사이 바뀜) · `common`(공통 code · 닿지 못함) · `site`(그 자리 번호).
- 함정:
  - 글쓴이 · 공감한 사람 · 읽은 사람은 서버가 토큰에서 정한다 — 본문에 내 이름 · 코드 · uid 를 싣지 않는다.
  - 새 글 · 답글은 요청 번호를 싣는다 — 닿지 못해 다시 누르면 같은 번호(두 번 안 올라감), 서버가 답했으면(성공 · 거절) 다음엔 새 번호.
  - 실패는 ApiError 를 그대로 던진다(빈 목록으로 돌리지 않는다). 다시 보내지 않는다. 응답 모양이 틀리면 code `SHAPE`, 보내기 전 틀린 값은 `INVALID`(요청 0).
  - 배지 수는 `reset` 마다 오르는 epoch 로 묶는다 — 계정을 놓기 전에 보낸 받기의 늦은 답이 새 계정 수를 덮지 않게.
  - 👍 응답에는 수가 없다 — 화면이 본 수 + 1 로 그린다(누를 수 있던 버튼 = 아직 안 누름 · 서버가 한 사람 한 번만 셈).
- 검사: `checks/sim-bug-api.js`.

## bug-board-ui.js — 🐞 버그제보 게시판 화면(classic script `window.TwBugBoardUi`)
- 책임: 마이홈 «버그제보» 탭의 목록 → 상세 → 글쓰기 세 화면 · 탭 «새 답변» 배지. 파일 끝(게시판 밖)은 관리자 오픈카톡 기본 링크(`bugReport/current` — 다음 묶음이 서버 설정으로 옮긴다).
- deps: `bugApi`(`createBugApi` 인스턴스) · `lib`(`TwBugBoard`) · `apiErrors`(`TwApiErrors.store`) · `notifyError`(`TwErrorCodes.notify`) · `toast` · `escHtml` · `safeHtml`(`TwSafeHtml`) · `isAdmin`(읽는 함수) · `rtOn`(`TwRtHub.store.on`).
- 내놓는 것: `createBugBoardUi(deps)` → `{ start, reset, refreshBadge }` — `start` 는 app-boot STEPS 의 `bugBadge`(배지 한 번 · realtime resync 때 한 번 다시), `reset` 은 계정을 놓을 때(account.js). 우편함 고리 `window._bugBoardOpen(번호)` · `window._bugBoardRefreshBadge(번호)` 를 만들 때 건다.
- 실패: 갈래로 — 안내는 그 칸 문구 · 공통은 공통 번호 · 그 밖은 `E-BUG-01`(목록) · `02`(글) · `03`(등록) · `04`(답글) · `05`(👍) · `06`(공개 범위) · `07`(오늘 남은 수). 없는 글 · 남의 비공개 글은 번호 없이 그 화면.
- 함정:
  - 목록 · 글 · 남은 수 받기마다 번호(gen)를 쥔다 — 그사이 다른 필터 · 다른 글 · reset 이면 늦은 답을 버린다. 쓰기는 한 번에 하나(busy).
  - 시작 전 · reset 뒤엔 받지 않는다(«로그인 뒤에 볼 수 있어요»). 배지를 타이머로 되풀이하지 않는다.
  - TODO(D9-4): 관리자 [답변 등록] 은 아직 서버 길이 없어 등록하지 않고 까닭만 적는다.
- 검사: `checks/sim-bug-board.js`.
