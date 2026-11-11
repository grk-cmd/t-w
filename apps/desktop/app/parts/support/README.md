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
