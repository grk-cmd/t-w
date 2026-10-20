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
