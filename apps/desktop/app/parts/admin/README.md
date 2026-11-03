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

- **책임**: 앱 관리자 창이 쓰는 서버 관리자 API(`/v1/admin/...`) 요청 모양 한 곳. 지금: 관리자 확인(`me`) · 📣 확성기 · 📰 업데이트 공지 · 📢 런처 배너 · 🛑 전체 방 종료. 화면 · 알림은 모른다 — 실패는 `ApiError` 를 던진다.
- **만드는 법**: app.js `noticeApi` 바로 뒤에서 `const adminApi = TwAdminApi.createAdminApi({ authed, pending, fetchBoard })`
  - `authed` = `TwApi.authed` · `pending` = `TwRequestId.createPending()` · `fetchBoard` = `()=>noticeApi.fetchBoard()`(지금 업데이트 공지의 id 를 공지 한 판에서 받는다)
- **내보내는 것**: `me` · `announce` · `clearAnnouncement` · `currentUpdateNotice` · `publishUpdateNotice` · `withdrawUpdateNotice` · `fetchBanner` · `replaceBanner` · `closeAllRooms` · `ERRORS`(서버 code → 오류 번호 `E-ADM-*` 기능 표 — `TwApiErrors.store.notify(err, adminApi.ERRORS)`)
- **함정**
  - 관리자 판정은 서버가 한다(`ACCESS_DENIED` → `E-ADM-05`). 앱은 «누가 했는지» 를 보내지 않는다.
  - 배너 저장은 읽은 판(`version`)을 싣는다 — 409 면 덮어쓰지 않고 다시 받는다. 링크 칸이 비면 서버가 거절한다(`E-ADM-01`).
  - 서버에 길이 없어 멈춘 것: ⚙️ 게임 설정(동물 해금 레벨) · 🧹 유령 방 청소 — 여기서 메우지 않는다.
  - 검사: `checks/sim-admin-api.js`(요청 모양 · 요청 번호 · 오류 표 · 배선 · 깨 보기).
