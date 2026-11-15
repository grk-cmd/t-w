# support — 신고 · 버그 제보 등 지원 기능

## `report-api.js` · `report.js` — 🚩 신고 보내기
**책임** — `report.js` 는 신고 창(좌석 우클릭 → 사유 → [신고]) · 공용 창 틀 · 팝업 칸. `report-api.js` 는 신고 서버 길(provider): 사유 이름 → 서버 종류 이름 · 본문 `{ target, kind, note? }` · 틀린 값 거르기(요청 0, code `INVALID`) · 실패 갈래(`failOf`).
**deps** — `report.js`: `reportApi`(`TwReportApi.createReportApi({ authed: TwApi.authed, errs: TwApiErrors })`) · `apiErrors`(`TwApiErrors.store`) · `notifyError`(`TwErrorCodes.notify`) · 숨김 Set · 좌석 이름 · 그림 주소 확인 · toast.
**내놓는 것** — `reportApi.file(target, kind, note)` · `failOf(err)` → `self | noAwayImage | noteRequired | common | site`.
**실패 처리** — `self` 는 조용히 닫음 · `noAwayImage` · `noteRequired` 는 사용자가 바로 고칠 수 있는 안내라 번호 없이 toast · `common`(로그인 풀림 · 닿지 못함 등)은 공통 표 `E-NET-xx` · 그 밖은 `E-RPT-01`. 실패하면 숨기지 않고 [신고] 를 다시 켠다.
**함정** — 신고한 사람은 서버가 토큰에서 정한다(앱은 이름 · 코드를 싣지 않는다). 자동 재시도 없음. 관리자 신고 목록(`admin/admin-report.js`)은 아직 Firebase 읽기라 서버가 같은 칸에 같은 모양으로 써야 이어진다.

## bug-board-ui.js — 🐞 버그제보 게시판 화면 · 버그 제보 탭

- **책임**: 예전엔 app.js 다음 `<script>` 로 실려 app.js 맨 위 이름을 그냥 불렀다(R7). 지금은 `TwBugBoardUi.createBugBoardUi(deps)` 로 받는다 — app.js 보다 먼저 싣고(html), app.js 끝의 «화면 모듈 넷(M23)» 줄에서 INIT 뒤에 만든다(옛 «app.js 다음 script» 와 같은 때 · 같은 차례).
- **받는 deps**: 함수 다섯(`escHtml` · `getDisplayName` · `getMyUserId` · `toast` · `_saveFailMsg`) · 읽는 함수 하나(`isAdmin`).
- **함정**: `firebase-init.js`(type="module")보다 앞에 돈다 — `firebase-ready` 를 기다리는 구독 시작 때가 예전과 같다. 검사: `checks/sim-global-deps.js`(deps 없이 app.js 이름을 부르는 곳 0 · deps 짝 · 연결).
