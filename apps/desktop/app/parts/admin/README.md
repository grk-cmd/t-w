# admin/ — 관리자 코드

관리자만 쓰는 기능 모듈. 나중에 걷어 낼 때 이 폴더 파일만 지우면 되게 모은다(docs/APP_FSD_MAP.md «관리자 코드 admin 폴더»).
절은 모듈마다 하나 — 다른 사람이 만든 절은 건드리지 않고 자기 절만 더한다.

## admin-thumbs.js — 🖼️ 파츠 썸네일 한꺼번에 다시 굽기

- **책임**: F12 콘솔 함수 `window.generateAllPartThumbnails(force)` 하나. 카탈로그 파츠 썸네일을 굽고(`partSceneMod.generatePartThumbnail`) 카탈로그에 올린다. 관리자가 아니면 아무것도 안 한다.
- **만드는 법**: app.js «🧊 파츠 GLB 파싱 캐시 · 썸네일» 자리, `partSceneMod` 바로 뒤에서 `const adminThumbs = TwAdminThumbs.createAdminThumbs({ … });`
  - `partSceneMod` · `adminPartReg` · `catalogSourceMod`(올리기 provider) · `premiumMod` · `wardrobeMod` (값) · `toast` (함수) · `isAdmin` · `gachaMod` (읽는 함수)
- **내보내는 것**: 없음 — 만들 때 window 에 건다.
  ```js
  // F12 콘솔
  generateAllPartThumbnails();      // 썸네일 없는 카탈로그 파츠만
  generateAllPartThumbnails(true);  // 있는 것도 다시 굽고 낡은 thumbUrl 을 지운다
  ```
- **확장할 때 고칠 자리**: 대상 거르기(`fromCatalog && (force || 썸네일 없음)`) · 올리는 데이터는 `adminPartReg.buildPartPublishData` 한 곳.
- **함정**
  - 올리기(`catalogSourceMod.catalogSrcPublishPart` → Firebase `publishPart`)는 `set()`(노드 통째 교체) — 필드를 손으로 나열하지 말 것(빠진 `gacha` 로 뽑기 파츠가 꾸미기 창에 뜬 적 있다).
  - 카드는 `thumbUrl` 을 `thumbnail` 보다 먼저 읽는다 — force 때 `thumbUrl` 을 지우는 줄을 빼면 다시 구워도 안 바뀐다.
  - 검사: `checks/sim-admin-thumbs.js`(4절 — 관리자 아님 · 없는 것만 · force · 실패 건너뛰기 · 0개 · 서버 연결 없음).

## admin-api.js — 🛠️ 앱 관리자 서버 길 provider

- **책임**: 앱 관리자 창이 쓰는 서버 관리자 API(`/v2/admin/...`) 요청 모양 한 곳. 지금: 관리자 확인(`me`) · 📣 확성기 · 📰 업데이트 공지 · 📢 런처 배너 · 🛑 전체 방 종료. 화면 · 알림은 모른다 — 실패는 `ApiError` 를 던진다.
- **만드는 법**: app.js `noticeApi` 바로 뒤에서 `const adminApi = TwAdminApi.createAdminApi({ authed, pending, fetchBoard })`
  - `authed` = `TwApi.authed` · `pending` = `TwRequestId.createPending()` · `fetchBoard` = `()=>noticeApi.fetchBoard()`(지금 업데이트 공지의 id 를 공지 한 판에서 받는다)
- **내보내는 것**: `me` · `announce` · `clearAnnouncement` · `currentUpdateNotice` · `publishUpdateNotice` · `withdrawUpdateNotice` · `fetchBanner` · `replaceBanner` · `closeAllRooms` · `ERRORS`(서버 code → 오류 번호 `E-ADM-*` 기능 표 — `TwApiErrors.store.notify(err, adminApi.ERRORS)`)
- **함정**
  - 관리자 판정은 서버가 한다(`ACCESS_DENIED` → `E-ADM-05`). 앱은 «누가 했는지» 를 보내지 않는다.
  - 배너 저장은 읽은 판(`version`)을 싣는다 — 409 면 덮어쓰지 않고 다시 받는다. 링크 칸은 비워도 된다(서버가 «링크 없는 장» 으로 받고 런처는 누르면 아무 일 없게 그린다) · 채운 주소가 틀리면 `E-ADM-01` · 409 는 번호 없이 «다른 곳에서 바꾼 내용을 받아왔어요».
  - 멈춘 것: ⚙️ 게임 설정(동물 해금 레벨 — 서버 길은 카탈로그 해금 `PUT /v2/admin/catalog/unlocks/…` 이지만 사용자 앱이 아직 Firebase 에서 읽어, 올려도 닿지 않는다. 읽는 쪽이 옮겨 가면 D11-2) · 🧹 유령 방 청소(D11-2 에서 걷음) — 여기서 메우지 않는다.
  - 검사: `checks/sim-admin-api.js`(요청 모양 · 요청 번호 · 오류 표 · 배선 · 깨 보기).

## admin-report.js — 🚩 신고 목록(관리자)

- **책임**: 관리자 줄 [🚩 신고 목록](`#lcReportList`) 창 — 목록 받기 · [더 보기] · [문제없음] · [그림 내리기] 화면. 서버 길은 `support/report-api.js` 의 `createAdminReportApi` 하나(`/v2/admin/reports*`) — 거르기(서로 다른 3명 이상) · 이름 · 그림 붙이기 · 그림 칸과 파일 지우기는 서버가 한다.
- **만드는 법**: app.js «🚩 신고하기» 자리, `reportMod` 바로 뒤에서 `const adminReport = TwAdminReport.createAdminReport({ … });`
  - `toast` · `awayUrlOk` · `isAdmin`(읽는 함수) · report.js 의 `reportClose` · `reportBox` · `kinds` · `adminMin` · 팝업 칸 `reportOv` · `setReportOv` · `reportEsc` · `setReportEsc` · `adminApi`(`TwReportApi.createAdminReportApi`) · `apiErrors`(`TwApiErrors.store`) · `notifyError`(`TwErrorCodes.notify`)
- **내보내는 것**: 없음 — 버튼은 만들 때 건다.
- **화면 상태**: 불러오는 중 · 받음(머리 «서로 다른 3명 이상 … · N명» — N 은 첫 쪽 `total`(더 보기 뒤에도 그대로) · 없으면 받은 수, 다음 쪽이 있으면 «N명 넘게» · [더 보기]) · 코드는 친구 코드(없으면 사용자 코드) · 빈 목록 «확인할 신고가 없어요» · 못 받음 «못 불러왔어요 [다시 시도]» + `E-ADM-30`.
- **실패**: `adminApi.failOf` 갈래만 본다 — `common`(로그인 풀림 · 권한 없음 · 닿지 못함 등)은 공통 표 · `imageChanged`(그 사이 그림이 바뀜)는 안내 + 목록 첫 쪽부터 다시 받기 · 그 밖은 자리 번호(목록 `E-ADM-30` · 문제없음 `E-ADM-31` · 그림 내리기 `E-ADM-32`) 뒤 버튼 다시 켬.
- **함정**
  - 받은 답은 그 창 · 그 차례(gen)일 때만 그린다 — 창을 닫았거나 다시 받기가 시작됐으면 옛 답은 버린다.
  - 혼자 다시 받지 않는다 — [다시 시도] · [더 보기] · 버튼을 관리자가 누를 때만.
  - 서버가 준 그림 주소도 `awayUrlOk`(우리 Storage 주소)일 때만 그리고 [그림 내리기]를 켠다. [그림 내리기]는 목록에서 본 주소를 보낸다(서버가 지금 그림과 다르면 거절).
  - 검사: `checks/sim-report.js`(2절 · 깨 보기) · `checks/sim-report-away.js`.
