# 검사 파일 정본 표 — 핸드오프 3-① 대응

바뀐 내력은 `git log -- checks/` 로 본다(개정 번호는 두지 않는다 — PR 마다 같은 줄을 고쳐 늘 충돌이 났다).
검사를 더하거나 고치면 §3 표의 해시만 같은 커밋에서 맞춘다(`node checks/run.js --hashes`).

## 0. 이 파일이 있는 이유

검사 파일들이 저장소에 없어서 **어느 판이 진짜인지 가려 주는 자리가 없다.** 그래서 지난
세션에 낡은 판으로 세 번 걸렸고, 그동안 나온 초록·빨강을 근거로 못 썼다.

이 표가 그 자리다. 검사를 저장소에 커밋할 때 **같이 커밋한다.** 검사를 고치면 해시도 같이
고친다. 해시가 안 맞으면 그 판은 정본이 아니다 — 초록이어도 근거로 쓰지 않는다.

---

## 1. 지금 상태

| 확인 | 결과 |
|---|---|
| 검사 파일 수 | **82개** (§3 · 개정 38 에서 `sim-signup.js` 신설 · 개정 33 에서 `sim-chars-migrate.js` 신설 · 개정 32 에서 `sim-chars-merge.js` 신설 · 개정 31 에서 `sim-slot-sync-ui.js` 신설 · 개정 30 에서 `sim-slot-conflict.js` 신설 · 개정 27 에서 `sim-friend-code-keep.js` 신설 · 개정 24~26 은 `sim-slot-sync.js` 에 ⑨·⑩·⑪ 절 추가) |
| 실기기 한 바퀴 | **초록 76 · 빨강 0 · 원본없음 1 · 시간초과 0** (개정 29 기대값 — 개정 22~27 의 «빨강 0» 은 `sim-account-switch.js` 스텁 탓에 실제로는 빨강 1 이었을 것, 개정 28 에서 해소 — 확인 전 · 저장소 러너 기준 — 프로젝트 사본 환경은 원본없음 7) |
| `sim-sysinput.js` | **입수함.** 받은 것은 §2 표의 **58·1 판**. 6절 한 줄 고쳐 **60·0** |
| `sysinput-win.js` 를 읽는 검사 | **2개** (`sim-sysinput.js` · `sim-admin-active.js`, 개정 16) |
| `overlay-win.js` 를 읽는 검사 | **2개** — §4-② 에서 메웠다 (개정 6 까지는 0개였다) |
| `audit.py` | **끝까지 돈다.** 110초 → 7초 · 검사 7~19 가 실기기에서 처음 돌았다 (§4-⑤) |

★ 개정 6 의 「`overlay-win.js` 를 보는 눈이 하나도 없다」는 §4-② 로 해소됐고, 클릭 통과 쪽은
`handoff-platform-split.md` §4-② + `sim-sysinput.js` 4절이 이미 지킨다 — **3-① 은 닫혔다**(§4-④).

**[2026-09-14] 검사 품질 쪽도 닫혔다.**

| 그때 남아 있던 것 | 지금 |
|---|---|
| §4-⑧ 원문/주석제거본 혼용 | 훑었다 — 닿는 22개 · 정규식 220건에 **진짜 함정 0건**(§4-⑧) |
| 이전 문서 §5-② 「안 읽는 검사 넷」 | 셋은 성격이 달랐다(§11 · 투게더빌리지 보류) · 하나는 고쳤다(§12) |
| 판정 줄 없는 검사 다섯 | **전멸.** 53개 전부 몇 개를 쟀는지가 남는다(§10 · §10-B · §10-C) |

⇒ 지금 막혀 있는 것은 **원본 다섯이 저장소에 없다**는 것 하나다(§13).

---

## 2. 실행 위치 규칙 ★ 커밋 layout 을 정하기 전에 읽을 것

검사들이 원본을 찾는 방식이 **두 갈래**다.

| 방식 | 수 | 뜻 |
|---|---|---|
| `fs.readFileSync('app.js')` — cwd 상대 | 43 | 원본이 있는 폴더**에서 실행**해야 한다 |
| `path.join(__dirname, …)` — 파일 위치 상대 | 9 | 원본이 있는 폴더**에 들어 있어야** 한다 |
| 둘 다 (`sim-mys-play.js`) | 1 | 어느 쪽이든 맞으면 된다 |

그리고 둘 다 **평평한 폴더**를 가정한다. `sim-overlay-gap.js:254` 는 `__dirname/app.js`,
`sim-pl-loop.js:31` 은 `app.js` · `main.js` · `preload.js` 를 한 폴더에서 찾는다.
`sim-sysinput.js` 도 `HERE = __dirname` 으로 `main.js` · `sysinput-win.js` 를 나란히 찾는다.
저장소는 그 모양이 아니다(앱 `apps/desktop/` · 렌더러 `apps/desktop/app/` · 규칙 · 함수 · Hosting `firebase/`) — **맞지 않는다.**

⇒ 그래서 러너(`run.js`)가 임시 폴더에 **옮기기 전 평면 모양**(루트 = 앱 · `app.js` 같은 층 · `functions/` · `hosting/` · 규칙 파일)을 다시 조립해서 돌린다. 지킬 것:
- 검사는 `node checks/run.js <이름>` 으로만 돌린다. 저장소에서 `node checks/sim-x.js` 를 바로 치면 원본을 못 찾는다.
- 새 검사도 **옛 평면 경로**로 원본을 읽는다(`app.js` · `main.js` · `functions/x.js` · `hosting/help/x`). `apps/desktop/…` · `firebase/…` 로 읽으면 스테이징에 그 자리가 없어 «원본 없음» 이다.
- typescript 파서를 쓰는 검사는 루트 `node_modules` 의 typescript 를 쓴다(루트 `package.json` devDependencies).

⇒ `checks/` 하위로 그냥 넣으면 `__dirname` 쪽 10개가 원본을 못 찾는다. 루트에 쏟으면
53개가 루트에 깔리고 `app.js` 는 여전히 `app/` 에 있다. **파일을 옮기는 것만으로는 안 된다.**

원본을 읽는 검사 수: `app.js` 41 · `smoke.js` 17 · `desk-companion-prototype.html` 14 ·
`main.js` 8 · `preload.js` 3 · `sysinput-win.js` 1 · `overlay-win.js` **2** (2026-09-13 · §4-②)

---

## 3. 목록 — sha256 앞 12자리

이 해시가 정본 표시다. 출처: Claude 프로젝트 사본(2026-09-12).

| 파일 | 줄 | sha256[:12] |
|---|---|---|
| **audit.py** | 937 | **6d2124379e6e** |
| **smoke.js** | 720 | **a61c377b61ee** |
| **sim-account-switch.js** | 452 | **71fef7fe9435** |
| **sim-admin-rules.js** | 411 | **8901ec208a8f** || · 아래 칸 · 쓰기 없음** · **개정 163 1절 관리자 서버 봇(apiBots) — admins · licenses 읽기만 · 봇 명단 잠김** · **개정 129 7절 할 일 공용 메모(adminTodoNote) — 관리자만 · rev + 1 · 0~2000자 · 서버 시각** · **개정 127 7절 할 일 종류(type) feat · bug · 없어도 됨** · **개정 126 1절 config/releaseAnswerTpl 관리자만 · 7절 릴리스 답변 템플릿 1~1000자 글자 · 지우기 관리자만 · 읽기 관리자만** · **개정 123 7절 할 일 릴리스 버전(release) 모양 · 20자 · 없어도 됨** · **개정 118 7절 관리자 할 일(adminTodos) — 관리자만 · rev + 1 만(덮어쓰기 막기) · 작업자는 관리자 uid · 제보 id 모양 · 관리자 이름(adminNames) 본인 칸만** · **개정 99 1절 metrics/improvements 관리자 쓰기 · 모양(버전 · 제목 · 항목 20개 · 적용 일수 0~30)** · **개정 95 1절 config/bugDailyMax 관리자만** · **개정 87 1절 config/minAppVer 관리자만** · **2026-10-08 1절 bugBoard/ans/pub · ans/prv 관리자만 · 2절 버그제보 글쓰기(본인 uid · 본인 코드 · 새 글만) · 👍 본인 표시 하나** · **2026-10-07 3절 metrics(접속 지표) 읽기 관리자만 · 쓰기 규칙 없음** · **2026-10-06 1절 inboxBroadcastMeta 관리자만** · **2026-10-06 1절 catalogMeta/$kind 관리자만** · **2026-10-05 6절 관리자 작업 기록(adminLog) — 규칙식을 굴려 관리자만 · 새로 쓰기만 · by · 서버 시각 · 길이 · 90일 지난 것만 지우기 · invites 목록 관리자 읽기(issuedBy 색인) · 코드 하나는 누구나** · **2026-10-04 licenseRequests 친구코드(선택 · MATE/COZY 형식) · accountSnap 목록 관리자 읽기** · **2026-10-03 licenseRequests 새 신청만 · userCount +1 만** · **개정 55 licenses 목록 관리자만 · 키 하나 읽기** |
| **sim-char-foot.js** | 142 | **17f2aa70cc31** |
| **sim-char-identity.js** | 188 | **9aa1d07d92b1** |
| **sim-char-z.js** | 225 | **92fb9efdb2c1** |
| **sim-cfg-fit.js** | 145 | **26df0415ed74** |
| **sim-chat-fly.js** | 360 | **b52fd913a6d7** |
| **sim-bug-board.js** | 384 | **7edc054fab9a** |
| **sim-bug-no.js** | 159 | **afeda1efa43f** |
| **sim-bug-cleanup.js** | 191 | **7c41fc91c912** |
| **sim-bump-version.js** | 108 | **9c635d7b9caa** |
| **sim-char-core-load.js** | 89 | **740ecf90c6f1** |
| **sim-chat-history.js** | 244 | **9bbbfd7c28fc** |
| **sim-gamepad-activity.js** | 252 | **f67604d46dc4** |
| **sim-mallang-hide.js** | 124 | **86040d19c645** |
| **sim-seat-pin.js** | 52 | **049a1089195e** |
| **sim-seat-label-drag.js** | 91 | **6a4daf86e439** |
| **sim-friend-visit.js** | 115 | **c33a7fed1e41** |
| **sim-friends-sub.js** | 618 | **6664bb6aad56** |
| **sim-friends-port.js** | 459 | **949952d584bb** |
| **sim-friend-profile-live.js** | 241 | **3c3e4af0e29d** |
| **sim-second-instance.js** | 226 | **65e5433c9fed** |
| **sim-wd-parts-persist.js** | 95 | **71c92bf7579e** ← **개정 342 장착 줄을 refitSeatAfterParts 안에서 찾는다(판정 무변경)** · **개정 244 열린 초안 주인은 꾸미기 relinkDraftSrc 를 onSeatRelinked 로 같이 돌림 · 걸려 있는지 판정 1 추가** · **개정 186 app.js(모듈 이름 뗌) + 옮기기 전 모양으로 되살린 모듈 — 공용 sim-renderer-src.js 의 joinRenderer 로 읽음(판정 무변경)** · **개정 155 신규 · 💾 꾸미기 · 가챠 파츠 재부팅 초기화 — _relinkSeatsToSlots 실행(같은 칸 · 비운 칸 · 남의 좌석 · 열린 초안) · 받는 두 곳 배선 · 저장이 파츠 받기보다 먼저 · 숨기기 전 closeWardrobe · 종료 때 저장**
| **sim-name-guard.js** | 42 | **9c89831d5c23** |
| **sim-chat-tabs.js** | 139 | **cb2e61320c79** |
| **sim-chat-layout.js** | 108 | **7b3248a01a4c** |
| **sim-fix-1008.js** | 425 | **94999f49d528** |
| **sim-fix-1016b.js** | 84 | **55d2d7d90ae9** |
| **sim-fix-1016.js** | 170 | **7724abcbddfe** |
| **sim-gl-recover.js** | 88 | **e3705358c7eb** |
| **sim-chat-copy.js** | 86 | **0e24f604f42f** |
| **sim-chat-delete-log.js** | 90 | **d987e49be2b8** |
| **sim-chat-log-persist.js** | 160 | **886c6f8cad51** |
| **sim-child-theme.js** | 104 | **365ddf210e7d** |
| **sim-chip-chat-ui.js** | 115 | **e60ef5c45121** |
| **sim-clone-code-entry.js** | 216 | **0ebba5a3d126** |
| **sim-dance-unlock-mail.js** | 201 | **0df73db8be6e** |
| **sim-def-send.js** | 211 | **e16ae6963145** |
| **sim-desk-floor-clamp.js** | 206 | **b59a0d2a44b2** |
| **sim-desk-part-scale.js** | 83 | **8a0a59ffb09a** |
| **sim-desk-preset.js** | 251 | **3ed07bb98346** |
| **sim-json-store.js** | 209 | **05d6cff00a2f** |
| **sim-desk-setup.js** | 229 | **c6aca6da921a** |
| sim-dom-boot.js | 83 | 927ab53ecc44 |
| sim-exp-bar-color.js | 135 | 4142ee5559d6 |
| **sim-face-loss.js** | 317 | **921e471b80b1** |
| **sim-fly-click-through.js** | 131 | **d3a06f4b89f9** |
| **sim-fly-egg.js** | 259 | **97f6fa1f3ffa** |
| **sim-fly-replay.js** | 161 | **b7faec9ac84f** |
| **sim-fly-roulette.js** | 150 | **f8539436d977** |
| **sim-license-xlsx.js** | 121 | **3f7e80f71b7e** |
| **sim-room-meta-cleanup.js** | 326 | **5629d47bab63** |
| **sim-room-stats.js** | 199 | **0bcea1517588** |
| **sim-room-lobby.js** | 196 | **8350cc76c150** |
| **sim-room-lobby-ui.js** | 280 | **17aaec38948c** |
| **sim-room-info-ui.js** | 202 | **9e002b240f2f** |
| **sim-listen-model.js** | 90 | **ee080c7f5c9c** |
| **sim-listen-provider.js** | 132 | **a39451c59791** |
| **sim-listen-ui.js** | 442 | **0f6cea8aae9c** |
| **sim-room-settings.js** | 274 | **e4ca78f5250d** |
| **sim-room-alive.js** | 144 | **336563eb0dcb** |
| **sim-daily-active.js** | 89 | **cde9ed578261** |
| **sim-visit-ping.js** | 163 | **0dcfbf2bd263** |
| **sim-usage-snapshot.js** | 194 | **a2cfdf538af3** |
| **sim-daily-summary.js** | 115 | **5362f8640c27** |
| **sim-account-delete.js** | 502 | **6b9278fac508** |
| **sim-password-reset.js** | 154 | **5c0d85ec06ed** |
| **sim-part-equip.js** | 134 | **2bfa1e861e1b** |
| **sim-room-server-net.js** | 1017 | **dff7cccfa0aa** |
| **sim-room-parity.js** | 112 | **cc77ba38d744** ← **개정 193 공용 sim-renderer-src.js 의 joinRenderer 로 읽음(판정 무변경)** · **개정 119 신규 · 🛰 방 짝 맞추기(정적) — app.js 가 방에 싣는 칸 ⊆ MEMBER_FIELDS ∪ {def, userId, chat, chatTab} · Firebase provider 메서드 ⊆ 서버 provider 메서드**
| **sim-room-server-gate.js** | 309 | **39d158c2f7e6** |
| **sim-room-live-def.js** | 150 | **1349d6997af1** |
| **sim-app-version.js** | 308 | **78aac83cbe8c** |
| **sim-app-version-gate.js** | 177 | **92374665c4d9** |
| **sim-maintenance-gate.js** | 212 | **9e1067926d18** |
| **sim-invite-account.js** | 80 | **a6c43e555063** |
| **sim-invite-revoke.js** | 100 | **c6ce8535f35b** |
| **sim-group-invite.js** | 257 | **50f7cbb67bc6** |
| **sim-room-invite-wait.js** | 44 | **6d9e289acbd7** |
| **sim-focus-auth.js** | 91 | **ef2f4cad0aeb** |
| **sim-focus-sync.js** | 174 | **084cb3a11f49** |
| **sim-friend-manage.js** | 274 | **73c11c84c96b** |
| **sim-gift-star.js** | 127 | **09dec0581403** |
| **sim-gacha-prune.js** | 166 | **d9e85bab60ff** |
| **sim-gacha-race.js** | 124 | **1f0427b99f71** |
| **sim-gacha-server.js** | 111 | **b7d5fbf55bc2** |
| **sim-gacha-tx.js** | 168 | **bee2d5e4c04c** |
| **sim-gacha-album.js** | 118 | **ff648a36d141** |
| **sim-ghost-cache-sync.js** | 365 | **62c744f5861c** |
| **sim-click-through-policy.js** | 312 | **c8a07dca8eaa** |
| **sim-ghost-heal.js** | 88 | **918a9097dda9** |
| **sim-catalog-cache.js** | 391 | **79b8e26cd2d6** |
| **sim-broadcast-cache.js** | 282 | **febd97c6e90e** |
| **sim-friend-code-keep.js** | 218 | **1777c059463e** |
| **sim-google-login.js** | 656 | **7117b52660b6** |
| **sim-invite-gate.js** | 136 | **e28cff183251** |
| **sim-item-rot.js** | 86 | **63a46f67bf8c** |
| **sim-key-input.js** | 71 | **180b0a3448b6** |
| **sim-keysof-twin.js** | 369 | **864c08b01c27** |
| **sim-license-leak.js** | 288 | **73780a67f961** |
| **sim-mh-sanitize.js** | 274 | **b840325c6768** |
| **sim-myhome-steps.js** | 127 | **ba55a9aea5d8** |
| **sim-myhome-load.js** | 106 | **e6eb15f88375** |
| **sim-fix-0923.js** | 297 | **9f338dfa790b** |
| **sim-noise.js** | 146 | **40568ea4018a** |
| **sim-mobile-focus.js** | 219 | **dab2fcb75879** |
| **sim-focus-gate-self.js** | 116 | **19283b4c764a** |
| **sim-mac-0923.js** | 86 | **7987043b2649** |
| **sim-bookmark.js** | 185 | **e1348542421e** |
| **sim-overlay-gap.js** | 343 | **0fc0435f4b6f** |
| **sim-overlay-layered.js** | 361 | **d9b483ece5e7** |
| **sim-part-color-entry.js** | 143 | **e31a5d7f4c86** |
| **sim-pk-fit.js** | 170 | **354391f1f290** |
| **sim-pl-grab-pick.js** | 187 | **35923393acdd** |
| **sim-pl-loop.js** | 508 | **131a502c88a2** |
| **sim-pl-next.js** | 171 | **9e7dea09b15f** |
| **sim-pl-watchdog.js** | 412 | **4658ffafbd00** |
| **sim-premium-desk.js** | 96 | **9911af6ac156** |
| **sim-presence.js** | 243 | **3f5b1eb57bdc** |
| **sim-light-tone.js** | 135 | **a299cf337216** |
| **sim-paint-geom.js** | 107 | **0c187cb7b3d7** |
| **sim-seat-friend-req.js** | 117 | **89a8bcf81a45** |
| **sim-seat-menu.js** | 167 | **d852cfc88b06** |
| **sim-publish-fields.js** | 208 | **f461e7690a5b** |
| **sim-purikura-deco.js** | 954 | **25b07f4973c8** |
| sim-purikura-net.js | 361 | a4029a7ef053 |
| **sim-purikura-rules.js** | 261 | **0f13cb4f0a37** |
| **sim-purikura-stage.js** | 270 | **115ae51a42d4** |
| **sim-report-away.js** | 116 | **2e7056e83b60** |
| **sim-ride-height.js** | 115 | **870e0eb2c0e7** |
| **sim-ride-part-top.js** | 101 | **0b4bf839278c** |
| **sim-room-channel.js** | 202 | **8f02cf7c60cb** |
| sim-room-clock.js | 135 | 421b90c3df47 |
| **sim-seat-eq.js** | 101 | **abfda97458b5** |
| **sim-seat-hide.js** | 84 | **4e8d2348e282** |
| **sim-seat-opacity.js** | 247 | **9d9cf1cc71f5** |
| **sim-slot-fit.js** | 246 | **d28aa326a223** |
| **sim-slot-sync.js** | 482 | **612ff46fdd50** |
| **sim-slot-conflict.js** | 256 | **d34d5155c360** |
| **sim-slot-sync-ui.js** | 82 | **0dd847a0d6a5** |
| **sim-chars-merge.js** | 137 | **db4dda0ead95** |
| **sim-chars-migrate.js** | 756 | **e29aa34d6dfc** |
| **sim-signup.js** | 1597 | **4b7e5277b87c** |
| **sim-sysinput.js** | 397 | **bdf06e31afdb** |
| sim-town-32.js | 87 | ff7b7c796278 |
| **sim-ui-zoom.js** | 132 | **3a62138fcd8e** |
| **sim-zoom-window.js** | 68 | **c130cf5b9af3** |
| **sim-z-layers.js** | 168 | **8cbeb3e3f5c6** |
| **sim-no-default-menu.js** | 95 | **0f1c5f7e0d75** |
| **sim-ops-hot-config.js** | 162 | **bc2e1a9dbb34** |
| **sim-animal-cast.js** | 65 | **0e1031329e06** |
| **sim-human-ear.js** | 239 | **b2f21075bb26** |
| **sim-wd-ear.js** | 375 | **96a46559b9b2** |
| **sim-uv-fill.js** | 106 | **66efa9691c9a** |
| **sim-paint-tools.js** | 300 | **156a46addf8d** |
| **sim-animal-edit-route.js** | 113 | **05e6088f9a9d** |
| **sim-seat-slot.js** | 114 | **bf05469a5050** |
| **sim-fix-1008b.js** | 47 | **a35227963110** |
| **sim-frame-budget.js** | 188 | **9d88ea741f36** |
| **sim-design-tokens.js** | 39 | **f9371a6fe998** |
| **sim-help-pages.js** | 163 | **7adeaa1327ac** |
| **sim-help-tab.js** | 200 | **1877f429bfdc** |
| **sim-unfocused-fps.js** | 177 | **8a40c76659ec** |
| **sim-purikura-fish.js** | 169 | **90c65a1bc566** |
| **sim-creator-flat-view.js** | 128 | **cc058c0dd902** |
| **sim-creator-xform.js** | 207 | **540025aaba06** |
| **sim-cr-stamp.js** | 210 | **aaa16fef5c4b** |
| **sim-creator-state.js** | 105 | **4e0daf68f5c8** |
| **sim-paint-stroke.js** | 194 | **d25ac9eb8388** |
| **sim-creator-flow.js** | 196 | **24a3d06e5a4e** |
| **sim-creator-save.js** | 226 | **2c8803488689** |
| **sim-commission-import.js** | 190 | **6c80a45a1abe** |
| **sim-creator-preview.js** | 202 | **cfd87debd49e** |
| **sim-hover-poke.js** | 197 | **9fb43da458ac** |
| sim-village-addr.js | 53 | f72ef601abbb |
| **sim-wheel-kick.js** | 97 | **cdd5b36aa254** |
| **sim-admin-active.js** | 155 | **100afda315c1** |
| **sim-room-order.js** | 78 | **19449085aa33** |
| **sim-device-session.js** | 144 | **bff537b6265c** |
| **sim-deco-parts.js** | 67 | **b2906a9efc04** |
| **sim-mhd-envsub.js** | 39 | **da0fcdb35c23** |
| **sim-font-hangul.js** | 54 | **1e0479f9fce5** |
| **sim-app-size.js** | 127 | **f4d91c399857** |
| **sim-asset-import.js** | 174 | **23c1ae52e3f9** |
| **sim-asset-cards.js** | 151 | **4043cca67af1** |
| **sim-scheduler.js** | 261 | **ded3144b895d** |
| **sim-weekly-challenge.js** | 345 | **35279543c804** |
| **sim-purikura-ui.js** | 277 | **d3b39f6fb1cd** |
| **sim-pk-bgm.js** | 103 | **6ec21bdb6d3e** |
| **sim-guestbook.js** | 291 | **d7d424fc8974** |
| **sim-friend-manage-module.js** | 309 | **1a09c072d659** |
| **sim-pomodoro-module.js** | 228 | **cfb5680616ad** |
| **sim-myhome-sticker.js** | 415 | **6a7c58901fb9** |
| **sim-gacha.js** | 612 | **f8c73e991261** |
| **sim-myhome-edit.js** | 614 | **bcddeecd526a** |
| **sim-room-invite-ui.js** | 371 | **a1751a4aebda** |
| **sim-focus-log.js** | 288 | **9cc9add827c7** |
| **sim-chat-window.js** | 559 | **95901abb7f00** |
| **sim-api-client.js** | 162 | **f93d00872b1a** |
| **sim-api-public-reads.js** | 191 | **b6f0a07d333f** |
| **sim-devtools-gate.js** | 87 | **0f94e5a4320f** |
| **sim-remote-config.js** | 527 | **bb9e649b2cae** |
| **sim-source-switch.js** | 178 | **0dbd6e281aa4** |
| **sim-data-gateway.js** | 273 | **b1301dd1fb44** |
| **sim-drag-scroll.js** | 103 | **dfe27aecdf9e** |
| **sim-myhome-inbox.js** | 602 | **2f88802194fc** |
| **sim-playlist-sync.js** | 98 | **a5b5c75741b5** |
| **sim-playlist.js** | 743 | **9c64891954bf** |
| **sim-ui-tokens.js** | 128 | **5e0444fe110a** |
| **sim-playlist-sync.js** | 98 | **a5b5c75741b5** |
| **sim-upload-cache.js** | 84 | **131a3db7c1b1** |
| **sim-desk-item-origin.js** | 104 | **c994d7c5152e** |
| **sim-def-size.js** | 157 | **68d8b678409d** |
| **sim-todo-cli.js** | 145 | **cea6fc0dd36b** |
| **sim-folder-free.js** | 190 | **b48c8b4f9389** |
| **sim-chat-sfx.js** | 153 | **fbc9c8b4eac6** |
| **sim-mac-update.js** | 212 | **dda6802135c3** |
| **sim-focus-cap.js** | 335 | **a290c42c1e85** |
| **sim-focus-show.js** | 86 | **94e634cb488e** |
| **sim-win-front.js** | 110 | **946f2d7cde7c** |
| **sim-win-layers.js** | 203 | **25e9c9dff07b** |
| sim-yard-enter.js | 59 | c323aea595a5 |
| **sim-away-follow.js** | 145 | **6f3fd7fc7064** |
| **sim-kb-blind.js** | 180 | **7d9f3fe5e684** |
| **sim-mhd-hidefolders.js** | 135 | **69194c95439e** |
| **sim-pomodoro.js** | 130 | **ef28b73a68d0** |
| **sim-admin-console.js** | 142 | **3e1dc419471c** |
| **sim-admin-license.js** | 198 | **5d02ff5ad25e** |
| **sim-admin-part-register.js** | 151 | **36e35de15c37** |
| **sim-admin-users-launcher.js** | 160 | **e7b57f3e1e66** |
| **sim-admin-asset.js** | 129 | **6ecb2dc8ed96** |
| **sim-admin-mode.js** | 133 | **437afbc7bb20** |
| **sim-report.js** | 139 | **144912a9daf0** |
| **sim-my-info.js** | 98 | **654e796c28d9** |
| **sim-renderer-src.js** | 229 | **c1077d0e962e** |
| **sim-chars.js** | 94 | **f9cca0b353e7** |
| **sim-slot-sync-mod.js** | 94 | **a2485a292a4e** |
| **sim-away-pic.js** | 94 | **02105f2b9019** |
| **sim-myhome-ui.js** | 133 | **8d2f056f3589** |
| **sim-tricks.js** | 94 | **53f1d40a59a5** |
| **sim-ride-bench.js** | 279 | **426a9d3c5c9f** |
| **sim-part-paint.js** | 94 | **ccaa45183979** |
| **sim-focus-level.js** | 119 | **3e7fcbc11472** |
| **sim-chat-ui.js** | 95 | **defcaa744921** |
| **sim-license-gate.js** | 179 | **9ad7d48c2ce4** |
| **sim-account.js** | 95 | **45959b36fe4e** |
| **sim-wardrobe.js** | 179 | **46606ffcae79** |
| **sim-settings-panel.js** | 201 | **8bd1a935f960** |
| **sim-desktop-run.js** | 94 | **7b36e49ed466** |
| **sim-room-entry.js** | 184 | **e1fdfef1a3ca** |
| **sim-overhead.js** | 102 | **988482f1dff9** |
| **sim-room-sync.js** | 99 | **a352bc22d8ac** |
| **sim-status-chip.js** | 168 | **66f2bb83d45f** |
| **sim-premium-assets.js** | 95 | **b79166874397** |
| **sim-char-code.js** | 95 | **9bc8b1717f50** |
| **sim-dice-games.js** | 95 | **1784b3741383** |
| **sim-program-settings.js** | 197 | **b1335da0e79b** |
| **sim-chat-prefs.js** | 95 | **ec9c1369226f** |
| **sim-chat-read-on-send.js** | 273 | **579f9feb2c0f** |
| **sim-rich-text.js** | 95 | **e2857c0faa2d** |
| **sim-win-stack.js** | 96 | **e7f9bf9ab745** |
| **sim-sfx.js** | 96 | **d24a22a1d75f** |
| **sim-face-heal.js** | 219 | **5451e2e7612f** |
| **sim-slot-save.js** | 96 | **1c9716fbec27** |
| **sim-interaction-desk.js** | 96 | **632770d8d886** |
| **sim-ad-banner.js** | 96 | **69f9e0557056** |
| **sim-license-request.js** | 96 | **2fc254e81411** |
| **sim-fn-keys.js** | 95 | **acb83f385e6d** |
| **sim-hidden-seats.js** | 96 | **178381fbe522** |
| **sim-theme-ui.js** | 96 | **ac544bbe99ae** |
| **sim-myhome-sticker-layout.js** | 96 | **b4bb313d0dbf** |
| **sim-myhome-diag.js** | 95 | **26738cf17aa4** |
| **sim-myhome-visit.js** | 96 | **d3c872803c16** |
| **sim-code-crypto.js** | 141 | **0234e006a868** |
| **sim-commission.js** | 103 | **f2dfe500eb47** |
| **sim-exp-bar.js** | 96 | **74b98b49f42f** |
| **sim-focus-total.js** | 96 | **8cffe6294bd4** |
| **sim-focus-share.js** | 96 | **18932a701a4c** |
| **sim-demoji-palette.js** | 95 | **24cf9fe4f0b6** |
| **sim-chat-lock.js** | 96 | **75b069f43f16** |
| **sim-roulette.js** | 96 | **a75ac3bfd7dd** |
| **sim-floaters.js** | 96 | **63212b22a6cd** |
| **sim-add-friend.js** | 96 | **6f1a6fef415e** |
| **sim-device-lost.js** | 180 | **634846059164** |
| **sim-myhome-page.js** | 126 | **b5ca916c06e5** |
| **sim-myhome-preset.js** | 158 | **931f2c50a7b0** |
| **sim-inbox-sections.js** | 126 | **1a78a79c79f8** |
| **sim-myhome-sticker-rules.js** | 90 | **d12d6538f2a7** |
| **sim-myhome-links.js** | 95 | **6d53e7c2d7fd** |
| **sim-async-prompt.js** | 112 | **298066b0cef9** |
| **sim-launcher-chrome.js** | 95 | **ed62fec910ad** |
| **sim-launcher-controls.js** | 204 | **78202998b89b** |
| **sim-launcher-preview.js** | 159 | **046bc6923a36** |
| **sim-mat-tone.js** | 179 | **1ed9ca399291** |
| **sim-oss-licenses.js** | 180 | **40f8118d76e8** |
| **sim-outside-close.js** | 95 | **2e61ab5a3e9c** |
| **sim-wardrobe-panel.js** | 148 | **a9f26dbddf39** |
| **sim-race-picker.js** | 99 | **eb713b5f131e** |
| **sim-realtime-link.js** | 323 | **1c6e8a88bcf8** |
| **sim-lv-tier.js** | 96 | **13d70962e49c** |
| **sim-theme.js** | 96 | **1f4b87d7c9d7** |
| **sim-license-ui.js** | 96 | **bc4bb234b208** |
| **sim-license-key.js** | 95 | **9b2c72d7fa60** |
| **sim-asset-code.js** | 96 | **1442b5b5b793** |
| **sim-myhome-init.js** | 132 | **16bf81cfbe09** |
| **sim-presence-lock.js** | 310 | **90b185582ac9** |
| **sim-parts-paths.js** | 84 | **2810fc3f9073** |
| **sim-global-names.js** | 236 | **4da03342e299** |
| **sim-dep-cycles.js** | 237 | **2cbd6d414f8e** |
| **sim-domain-calls.js** | 157 | **673fc5f9779a** |
| **sim-room-state.js** | 58 | **ddcd7ec6a8ac** |
| **sim-error-codes.js** | 109 | **c3b25d49f7c4** |
| **sim-myhome-state.js** | 90 | **9ac9ba6189aa** |
| **sim-account-state.js** | 94 | **d9d3c39a82ed** |
| **sim-nav.js** | 85 | **c4361c67713f** |
| **sim-net-ready.js** | 145 | **0a54ffa6283c** |
| **sim-myhome-hooks.js** | 99 | **a7ccbffbc7b3** |
| **sim-demoji-catalog.js** | 80 | **36e4e0c7b848** |
| **sim-hook-guards.js** | 77 | **0e8ccbe59d09** |
| **sim-typeof-guards.js** | 134 | **6fcc265732dd** |
| **sim-user-name.js** | 92 | **74e9a7a6d03a** |
| **sim-part-scene.js** | 209 | **4d4fc633d0be** |
| **sim-admin-thumbs.js** | 152 | **a364b1c70728** |
| **sim-glb-idb-cache.js** | 172 | **fda2ba697435** |
| **sim-catalog-glb.js** | 165 | **17abfb9c9515** |
| **sim-catalog-sync.js** | 282 | **d94edeb793ac** |
| **sim-catalog-source.js** | 100 | **48a661048e45** |
| **sim-desk-items.js** | 166 | **a1f0433d23a0** |
| **sim-bgm-diag.js** | 260 | **b16b4f888b77** |
| **sim-mobile-diag.js** | 147 | **394e3fd829e9** |
| **sim-blink-timing.js** | 112 | **624e0321ea28** |
| **sim-desk-visual.js** | 214 | **2428c62e17b8** |
| **sim-desk-place.js** | 187 | **2de2d6fa296b** |
| **sim-toast.js** | 174 | **25bd36f5c6a5** |
| **sim-dot-render.js** | 223 | **ed34e53f22dd** |
| **sim-ps1-dither.js** | 100 | **061d45e351ad** |
| **sim-seat-camera.js** | 151 | **779e4e952938** |
| **sim-ride-chain.js** | 54 | **7c397b3ae322** |
| **sim-seat-layout.js** | 172 | **6f339dcee0bc** |
| **sim-seat-refit.js** | 182 | **864d3b36827b** |
| **sim-seat-equalize.js** | 169 | **adf87881fdd8** |
| **sim-seat-eq-clamp.js** | 159 | **7ee3787c0a8c** |
| **sim-deco-parts-visibility.js** | 131 | **d079351120a6** |
| **sim-ride-measure.js** | 188 | **83e35751526e** |
| **sim-ride-tuning.js** | 124 | **6889f9df66be** |
| **sim-char-measure.js** | 167 | **c1ee503be3b6** |
| **sim-body-measure.js** | 653 | **67bf831c85c9** |
| **sim-floor-snap-diag.js** | 142 | **3aa611d6946d** |
| **sim-seat-model-load.js** | 194 | **7ff56380f12a** |
| **sim-seat-panel.js** | 163 | **2f9bad25ac96** |
| **sim-user-status-table.js** | 125 | **8727d9f8adac** |
| **sim-chip-popups.js** | 128 | **e58ffad1803b** |
| **sim-rules-keys.js** | 319 | **1b68e192d3fc** |
| **sim-rules-src.js** | 78 | **12241e59c87b** |
| **sim-mobile-link-trim.js** | 133 | **6d00f7fd7b7f** |
| **sim-label-measure.js** | 234 | **ce652588740d** |
| **sim-safe-html.js** | 715 | **0e7f5b0bbac1** |
| **sim-release-notes.js** | 75 | **37e41b730e37** |
| **sim-native-peek.js** | 168 | **10af633f27f9** |
| **sim-seat-regions.js** | 169 | **87bb9574eaf8** |
| **sim-mallang-gift.js** | 75 | **4e210440f918** |
| **sim-room-face-load.js** | 217 | **ea63c4cecbda** |
| **sim-part-ao-clean.js** | 128 | **f8bf7bb3709f** |
| **sim-img-retry.js** | 117 | **144a66e6e8df** |
| **sim-input-diag.js** | 148 | **09d9fb9484c8** |
| **sim-renderer-gone-reset.js** | 113 | **c6d9e72a66d1** |
| **sim-room-code-len.js** | 87 | **f0578d075c5e** |
| **sim-mh-pad-pos.js** | 164 | **4f0a3400f69c** |
| **sim-mh-bg-url.js** | 133 | **0713ca44ff81** |
| **sim-gift-img-retry.js** | 190 | **ce37377a809e** |

### `sim-sysinput.js` 판 계보 — 이 항목만 판이 여러 개다

| 판 | 결과 | 해시 | 비고 |
|---|---|---|---|
| §4-b 이전 | 49 · 1 | (없음) | `handoff-mac-runtime.md` §3-② 가 "받은 것" 이라 한 판 |
| 입수본 | 58 · 1 | b97367bf176e | 360줄. §2 표의 그 판이 맞다 |
| **정본** | **60 · 0** | **03256a7a7bbf** | 367줄. 6절만 고침 — §4-① |
| "65 · 0" | — | — | ★ **실물이 나온 적 없다.** 이전 핸드오프의 말뿐인 수치 |

★ 65·0 을 더 찾지 말 것. 6절을 고쳐 0 이 됐으므로 그 판을 기다릴 이유가 없어졌다.

---

### 도구 — 러너가 안 돌리는 파일 (§13 이 만들라고 한 칸)

`listChecks` 가 안 집으므로 §3 표에 안 들어간다. **판이 바뀌어도 아무도 모르는 자리**라
해시만 여기 적는다. 검사 개수(54)에는 안 넣는다.

```
run.js                         574줄   336f6f5e1b55   ← apps/desktop · firebase 로 옮긴 원본을 옛 평면 모양으로 되살려 스테이징
tools/trapscan.js              267줄   71a7d91b4979
tools/mac-bundleid-probe.js    415줄   cb30d59cf85a   ← 2026-09-30 6절에 `.app` 폴더 경로 · 옛 규칙 (개정 75)
CHECKS.md           (이 파일 · 자기 해시는 안 적는다)
```

★ [2026-09-15] `tools/mac-bundleid-probe.js` 가 늘었다 — mac 판정 키(번들 id)가 실제 맥에서
  서는지를 본다(`handoff-mac-runtime.md` §7-①). **`checks/` 바로 밑에 두면 안 된다** —
  `listChecks` 가 집는 순간 검사 개수가 55 가 되고, 윈도우 실기기에서는 **1절(본론)이 못 돌아
  종료 코드 2** 라 빨강이 박힌다. `trapscan.js` 와 같은 자리인 이유다(§13).
  ⚠️ **자리의 근거는 종료 코드가 아니라 성격이다.** 이 파일은 `npm run check` 가 돌릴 검사가
    아니라 **맥에서만 뜻이 있는 도구**다 — 윈도우에서 돌리면 6·7절(합성·정적)만 돈다.
    종료 코드 규칙은 바뀔 수 있지만(실제로 09-15 에 한 번 바뀌었다) 이 성격은 안 바뀐다.
  ⚠️ 돌리는 것은 **`.github/workflows/mac-probe.yml` 의 `keycheck` 잡**이다.

⚠️ **이걸 파이프 표(`| 이름 | 줄 | 해시 |`)로 쓰지 말 것 — 러너가 깨진다.**
`readManifest`(`run.js:82`)는 **문서 어디에 있든** 그 모양의 줄을 전부 줍고, 이름이
`.js`·`.py` 로 끝나면 정본 목록에 넣는다. 그다음 `verify`(`run.js:110`)가
«표에는 있는데 폴더에 없다» 를 찍는다 — `run.js`·`trapscan.js` 는 `listChecks` 밖이라
**영구히 `?` 둘이 박히고 「전부 일치」 줄이 영영 안 나온다.** 그러면 §1 이 세운
«해시가 안 맞으면 초록도 근거로 안 쓴다» 가 늘 켜진 경보가 되어 잡음이 된다.
⇒ 그래서 코드블록이다. 표로 바꾸고 싶으면 `run.js` 를 먼저 고칠 것(그건 §10-B 의 경고 대상이다).
★ 실측으로 확인했다(2026-09-14): 표 모양으로 넣으면 `? run.js — 표에는 있는데 폴더에 없다` 가 뜬다.

---

## 4. 손본 것 · 남은 것

### ① `sim-sysinput.js` 6절 — 고쳤다 (58·1 → 60·0)

빨간 항목 하나가 `f.name === exeName` 을 찾고 있었다. `main.js` 는 `keysOf` 한 통로로 갔고
(`main.js:383` 정의 · `:787` 판정), 785줄 주석에는 옛 비교문이 **"되돌리지 말 것" 예시로**
인용돼 있다. 검사가 주석 제거본을 보므로 그 인용에 안 걸렸고, 그래서 빨갛게 남았다.
③ 이 만든 빨강이 아니다 — 분리 전에도 똑같이 빨갰다(§3-②).

못 박는다는 6절의 뜻은 그대로 두고 **대상만** 옮겼다. 한 줄이 두 줄이 됐다:

- `★ 등록 판정이 keysOf 한 통로를 지난다` — `keysOf` 정의 + `keysOf(…).includes(` 통로
- `★ .name / .key 직접 비교가 없다` — §5 의 "직접 비교 금지" 를 검사가 처음으로 지킨다

두 번째 줄이 덤이다. §5 금지 항목 중 이것만 지켜 주는 자리가 없었다.

### ② 오버레이 검사 둘 — 고쳤다 (2026-09-13 · 단계 자동 판정을 심었다)

전에는 `main.js` 만 읽었다(`SRC = path.join(__dirname,'main.js')` · `readIf('main.js')`).
갭 상수와 레이어 판정이 `overlay-win.js` 로 나갔으므로 못 찾아서 `?` 가 넷씩 떴다.
`sim-sysinput.js` 와 같은 **단계 자동 판정**을 심었다 — `overlay-win.js` 가 있으면 분리 후로 본다.

찾는 자리를 셋으로 나눈다(합쳐 읽기 하나로 풀지 않았다):

| 무엇을 | 분리 후 어디서 |
|---|---|
| 본체 — 알파·켬값·적용함수·상태 / 갭 상수·`overlayGapFor`·`runOverlayHeight` | `overlay-win.js` **에만**. `main.js` 는 0곳이어야 한다 |
| 설정 파일·IPC·토글 핸들러 / 크기를 정하는 자리 셋 | `main.js` 그대로 (분리 대상이 아니었다) |
| 근거·경고 **주석** | 두 파일 합집합 (어느 쪽에 붙어도 목적은 달성된다) |

이음매에서 이름이 갈린다 — 모듈 안은 `_applyOverlayLayered`, 밖에서는 `overlay.applyLayered`.
호출 자리는 **파사드 이름**으로 센다(`APPLY_FACADE`). 둘 다 «분리 후 경계» 절을 새로 넣어
본체가 `main.js` 에 한 벌 더 남아 있지 않은지와 `require('./overlay-win')` 가 있는지를 본다.

```
sim-overlay-gap.js       20·7·4  →  51 · 0 · 0
sim-overlay-layered.js   24·5·4  →  46 · 0 · 0 · 건너뜀 1   (preload.js 가 있으면 48)
```

★ **이 장치는 지난 분리가 무사했다는 증명이 아니다.** `sim-sysinput.js` 는 쪼개기 **전에**
만들어져 같은 파일이 양쪽 단계에서 초록인 것을 보고 «동작 변경 0» 을 말할 수 있었다.
오버레이는 분리가 이미 끝났고 분리 전 `main.js` 가 없다 — **분리 후 초록 하나만** 볼 수 있다.
앞으로의 개명·재이동을 잡는 그물이지 지난 이사의 영수증이 아니다. 두 파일 머리말에 적어 뒀다.

★ `overlay-win.js` 를 치우면 분리 전 갈래로 떨어지고 **20·7·4 · 22·5·4** 로 옛 판과 한 줄도
안 달라진다(22 는 `preload.js` 가 없어 ②단 둘이 건너뛴 것). 갈래를 더한 것이지 바꾼 게 아니다.

**심으면서 두 번 고친 것 — 다음 사람이 같은 데서 헛돌지 않도록 남긴다.**

① 처음에 «자리 셋을 두 파일에서 다 뒤진다» 로 짰더니 **`main.js` 의 `setConfigMode` 호출을
통째로 지워도 초록**이었다. `setConfigMode` 가 `overlay-win.js` 주석에도 나오기 때문이다.
합집합은 **주석에만 쓴다.** 크기를 정하는 자리는 호출자 쪽 일이고 호출자는 `main.js` 다.

② 그다음 `setConfigMode` 가 빨강으로 남았는데 그것도 진짜가 아니었다. 핸들러(`main.js:2489`)가
`overlay.runOverlayHeight` 를 **55줄 뒤에서** 부르는데 `{0,2500}` 창 밖이었다 — §5-① 의
글자 수 창. ⇒ 중괄호를 세어 본문을 통째로 뗀다. `layered` 4절의 `{0,400}` 도 같이 바꿨다.

**일부러 깨뜨려 확인한 것**(§5-③): 모듈 안 개명 → `?` · **파사드만 개명 → `?`** ·
본체를 `main.js` 에 복사 → ✗ · `require` 제거 → ✗ · 갭 0 → ✗5 · 근거 주석 삭제 → ✗ ·
헬퍼 개명 → `?`4 · 토글/크기 호출 제거 → ✗2.

### ③ `sim-purikura-deco.js` — 고쳤다 (2026-09-13 · 9건 전부 낡은 검사였다)

9건 중 **코드가 틀린 것은 하나도 없었다.** 셋이 원인이었다.

- **시그니처** — `function _pkCloneChar(seat)` 로 박아 뒀는데 실물이 `(seat, out)` 이 됐다.
  그 한 줄에서 **6건**이 줄줄이 떨어졌다(찾기 1 + 그 블록을 보는 5).
- **글자 수 창** — `CHAR_H * grow / h` 가 함수 시작에서 2980자째인데 창이 `{0,2900}`(실효 2920)
  이었다. **60자 차이다.**
- **인접 앵커** — `classList.add('deco'); }\n  _pkClampWin()` 로 붙어 있기를 요구했는데
  사이에 주석 여덟 줄이 들어왔다. 호출은 `app.js:18338` 에 멀쩡히 있다.

⇒ 셋 다 **중괄호를 세어 본문을 뗀다**(`bodyAt` · `fnBody` · `enclosingBody`). 인자는 안 센다.

그리고 아홉째는 검사가 **다른 것을 보고 있었다.** 「포즈 키가 1·2 뿐이다」를 `_pkOwns` 의
반환 목록으로 셌는데, 그건 «우리가 먹는 키» 지 포즈 목록이 아니다. 키 3 은 눈 감기라
거기 정당하게 들어 있다(`app.js:17783` — 뼈와 텍스처는 안 겹치므로 1+3·2+3 이 된다).
⇒ **`me.pose` 에 값을 넣는 자리**로 센다. `me.pose === +e.key` 라는 비교까지 세지 않게
`=(?!=)` 로 대입만 본다.

⚠️ 이 파일에 `CODE`(주석 걷어낸 본문)를 새로 두었다. **「없어야 한다」 검사는 반드시 이쪽을
볼 것.** `app.js` 주석에 `v = pose + 4 같은 것` 이라는 **경고문**이 인용돼 있어서, 원문을
훑으면 그 경고에 제가 걸린다 — 고치는 중에 실제로 한 번 그렇게 헛짚었다.

**일부러 깨뜨려 확인**(§5-③): `_pkCloneChar` 개명 → ✗7(조용한 초록이 아니다) ·
`finally`→`catch` → ✗1 · `_pkClampWin()` 제거 → ✗1 · 키 4 추가 → ✗1 ·
`CHAR_H * grow / h` 제거 → ✗1 · **인자를 하나 더 늘림 → 통과 유지**(원래 사고의 재발 방지).

### ④ 남은 구멍

`overlay-win.js` 를 읽는 검사가 **0개에서 2개**가 됐다(위 ②). §5 의 금지 항목 중 오버레이 쪽
갭 상수 · 레이어 판정은 이제 지켜 주는 자리가 있다.

★ **[2026-09-13 정정] 「클릭 통과를 쪼개지 말 것」은 구멍이 아니다.**
개정 7 초안에 «직접 못 박는 자리가 아직 없다» 고 적었는데 **틀렸다.**
`handoff-platform-split.md` §4-② 가 그 사안을 이미 다르게 풀어 뒀다 — sysinput 이 가져가는
것은 「훅을 걸고 푼다」뿐이고 **핸들러 본문과 클릭 통과 일체는 `main.js` 에 남긴다.**
«움직이는 코드를 쪼개는 문제가 아니라 쪼개는 범위 밖에 두는 문제» 였고,
`sim-sysinput.js` 4절이 그 경계를 지킨다 — 클릭 통과를 sysinput 으로 옮기려 들면 거기서 운다.

⇒ 오버레이 축 · sysinput 축 둘 다 지켜 주는 자리가 있다. **§3-① 의 구멍은 닫혔다.**
남은 것은 검사의 **품질** 쪽이다 — 아래 ⑧.

### ⑧ 다음에 훑을 것 — `src`(원문) 와 `code`(주석 제거) 를 섞어 쓰는 자리 ★

`handoff-platform-split.md` §3 이 이미 경고해 뒀다: «문자열이 근처에 있는가» 로 쓰인 항목은
전부 의심 대상이고, 특히 원문과 주석 제거본을 섞어 쓰는 자리다. `sim-overlay-gap` 의
「이게 이 파일의 핵심 검사다」 항목이 **주석에 걸려 우연히 통과하고 있던 것**이 그 발견이었다.

**`audit.py` 검사 2 가 정확히 같은 것이었다**(§4-⑤ · 두 세션 뒤에 잡혔다). 그리고 §5-③-ⓑ
에서 CSS 쪽에도 같은 게 있다는 것이 드러났다 — 주석이 **선택자로** 붙어 들어온다.

지금 상태(프로젝트 사본 기준):

```
주석 제거본을 만드는 검사 : 5개
  sim-ghost-cache-sync · sim-google-login · sim-myhome-steps
  sim-overlay-gap · sim-overlay-layered   (+ sim-purikura-deco 의 CODE)
나머지                    : 원문에만 정규식을 건다
```

전부가 위험한 것은 아니다 — **「없어야 한다」 검사와 「근처에 있는가」 검사**만 해당한다.
그 두 부류만 골라 훑을 것. ⚠️ `app.js` 주석에는 **하지 말라고 적어 둔 코드가 인용돼 있다**
(`v = pose + 4 같은 것`). 원문에 「없어야 한다」를 걸면 그 주석에 걸린다.

**[2026-09-14 훑었다 — 닿는 범위는 깨끗하다]**

정규식이 원본 변수에 직접 걸리는 자리를 뽑아, 원문과 주석 제거본 양쪽에 돌려
「원문엔 걸리는데 코드엔 0건」(= 근거가 주석에만 있다)을 찾았다.

```
훑음            22개 검사 · 원본에 직접 건 정규식 220건  →  진짜 함정 0건
원본이 없어 못 봄  7개  dom-boot · exp-bar-color · overlay-layered ·
                        pl-loop · pl-watchdog · sysinput · win-front
사정권 밖        19개  원본을 텍스트로 안 훑고 **실행해서** 본다(vm/eval/require)
원본을 안 읽음     4개  §11
```

적중 3건은 전부 **의도된 것**이었다.

| 적중 | 왜 괜찮은가 |
|---|---|
| `ghost-cache-sync` `/150ms\|디바운스/` | 그 절 제목이 「6. 근거 보존」이다. 주석을 보는 게 목적 |
| `purikura-deco` `/pose\s*\+\s*4/` on `CODE` | 원문 1 · 주석 걷으면 0 — §4-③ 의 `CODE` 방어가 **작동 중이라는 증거** |
| `purikura-deco` `/_pkApplyBg(); // 비율이…/` | 정규식이 주석을 명시적으로 포함한다 |

⇒ `sim-overlay-gap` 이 걸렸던 부류는 닿는 범위에서 더 없다. ⚠️ 남은 7개는 `main.js` ·
`preload.js` · `*.html` 이 올라와야 본다 — **§5-② 대로, 이 결과에 무엇이 빠졌는지 같이 적는다.**
★ `app.js` 는 본문의 **29.8% 가 주석**이다. 이 함정이 세 번 재발한 것은 우연이 아니다.

**[2026-09-14 · 2회차 — 남은 7개 중 5개를 마저 훑었다. 여전히 0건]**

원본 다섯이 올라와 §13 이 막고 있던 것이 풀렸다. 훑기를 손에서 **도구로 옮겼다** —
`checks/trapscan.js`. 손으로 하면 다음 번에 또 같은 판단을 다시 해야 한다.

```
node trapscan.js tokens <원본...>          # 원본 쪽 — 주석에만 있는 토큰
node trapscan.js sweep <검사.js> <원본...>  # 검사 쪽 — 원문·주석제거본 양쪽에 걸어 본다
```

정본 40개(`audit.py` 제외 · 옛 판 11개와 없는 1개는 뺐다) 전수:

```
정규식 359건 = 실제로 원본에 댄 것 159 + 이미 걷은 판에 건 것 25
             + 원본 없어 건너뜀 47 + 원본 변수가 아님 128
주석을 일부러 봄 4 · 진짜 함정 0 · new RegExp 5건은 손으로
```

⚠️ **「함정 0」은 저 159건에 대해서만 하는 말이다.** 128건은 함수 인자·콜백 변수(`l`·`seg`)라
정적으로는 못 따라간다. 그 수를 화면에 찍는 것이 이 도구의 요점이다 — **안 본 것을 0 으로
숨기는 것이 §4-⑧ 이 막으려는 바로 그 일이다.**

적중 4건은 전부 `ghost-cache-sync` 6절 「근거 보존」이다. 1회차가 3건 중 하나로 잡았던
그 자리고, 결론도 같다.

**남은 7개의 결말**

| 검사 | 결과 |
|---|---|
| `dom-boot` | **사정권 밖.** `matchAll` 로 id·script 를 구조만 뽑을 뿐 판정 정규식이 없다 |
| `exp-bar-color` | 훑었다 · 0건 |
| `pl-loop` | 훑었다 · 0건 |
| `pl-watchdog` | 훑었다 · 0건 |
| `win-front` | 훑었다 · 0건 — 아래 ★ |
| `overlay-layered` | 훑었다 · 0건 (실기기 · 39 = 12+19+0+8) |
| `sysinput` | 훑었다 · 0건 (실기기 · 31 = 7+24+0+0) |

⇒ **§4-⑧ 은 7개까지 닫혔다.** 다만 아래 ★★ 를 먼저 읽을 것.

★ **§13 의 `dom-boot` 줄이 틀렸다.** `desk-companion-prototype.html` 밑에 적혀 있는데,
`dom-boot` 이 읽는 것은 `togetherland-ui-mockup.html` 이다 — **보류분**(§11)이라 원본 다섯으로는
애초에 안 풀린다. 판정 정규식이 없어 결과적으로 문제가 안 될 뿐이다.

★ **§5-③-ⓑ 가 말한 CSS 갈래는 `win-front` 에 있다.** `cssZ` 가 공백만 지운 **원문**에
`#id{…z-index:N}` 를 건다 — CSS 주석 안에 꺼 둔 옛 규칙이 있으면 그걸 읽는다.
z-index 규칙이 있는 id **40개를 원문·주석제거본 양쪽에서 재 보니 전부 같았다.** 지금은 안전하다.
⚠️ HTML 에 `/* … */` 로 꺼 둔 CSS 규칙을 남기면 그날 깨진다. `_flat` 을 만들 때 주석을 걷는 것이
근본 해법이지만, 지금 고치면 40개 값이 다 움직이므로 **깨진 뒤에 고치는 게 아니라 값을 같이 대고** 고칠 것.

**도구를 만들며 네 번 걸렸다 — 처음 셋은 전부 「조용한 0건」이었다**

① `pl-loop` · `pl-watchdog` 을 「원본을 담는 변수를 못 찾았다」로 넘겼다.
   `const APP = need('app.js'), MAIN = need('main.js')` — 도우미 함수 + 한 줄에 여럿을 못 봤다.
② 그 뒤에도 `ride-height` · `ride-part-top` 이 0건. `__dirname + '/app.js'` 처럼
   **이름이 경로와 붙어** 오면 못 잡았다.
③ ★ **제일 컸다.** 「정규식 359건 전수 · 함정 0건」이라고 보고했는데, 실제로 원본에 댄 것은
   **123건뿐이고 201건(56%)이 어느 칸에도 안 들어간 채 사라지고 있었다.** 검사는 원본을 통째로
   훑지 않고 **잘라서** 훑는다 — `src.slice(a,b)` · `fnBody(SRC,'f')` · `.match(...)[1]`.
   그 사슬을 안 따라가서 그만큼이 조용히 빠졌다.
   ⇒ 드러난 계기는 **숫자가 안 맞는 것**이었다(`정규식 39 · 댄 것 0 · 건너뜀 0`). 그래서 지금은
   **칸의 합이 정규식 수와 같아야 한다** — 안 맞으면 그 회차 결과는 근거가 아니다.
④ ③ 을 고치며 **반대 방향으로** 틀렸다. 파생을 너무 넓게 물려받아 검사 제 손의 함수
   (`const chk = (c,m) => …`)까지 원본으로 집었고, 그것이 「주석 걷음」으로 물들어
   **그 항목을 안 보고 건너뛰었다**(`이미 걷음` 41 → 25). 함정을 **놓치는** 방향이라 더 나쁘다.
   `=>` · `function` 이 든 대입은 원본 조각이 아니다.

★★ **1회차 22개도 다시 훑었다 — 결과는 「1회차가 맞았다」다.**

1회차도 «정규식이 원본 변수에 **직접** 걸리는 자리를 뽑아» 라고 적었고, 이번에 내 첫 판이
같은 방식이었다가 구멍 셋이 나왔다. 그래서 실기기에서 53개를 통째로 다시 댔다.

```
검사 43개 · 정규식 396건 = 댄 것 170 + 이미 걷음 34 + 원본 없어 건너뜀 27 + 원본 변수가 아님 165
함정 후보 0건 (1회차 220건 → 396건으로 그물을 넓힌 결과)
```

**후보 3건이 떴고 셋 다 가짜였다.** 그 셋이 이 도구의 한계를 정확히 짚어 준다:

| 후보 | 정체 |
|---|---|
| `purikura-deco` `/_pkApplyBg\(\); \/\/ …/` | **의도된 것** — 1회차가 이미 그렇게 분류했다. 정규식이 `//` 를 대놓고 품으면 주석을 찾는 것이다 |
| `overlay-gap` `/_winAlreadyIs/` on `bothSrc` | `bothSrc = src + '\n' + ovlSrc` — **두 원본을 이어붙인 변수**다. 하나만 대면 `main.js:102` 에 살아 있는 함수를 못 본다 |
| `slot-fit` `/width:max-content/` on `strip` | 이 파일은 `strip` 을 **두 번 다르게 쓴다**(§1 CSS 규칙 · §3 가짜 DOM). 진짜는 HTML `:2384` 에 살아 있다 |

⇒ **가짜 함정이 제일 나쁘다.** 하나가 뜨면 나머지를 안 믿게 되고, 그 사이에 진짜가 묻힌다.
셋 다 도구에서 막았다(이어붙인 변수는 합쳐서 댄다 · 이름을 두 번 쓰는 변수는 판정에서 뺀다).

**이 도구가 못 보는 것 — 다음 사람은 여기서 시작할 것**

| 못 보는 것 | 이번 수 |
|---|---|
| 함수 인자·콜백 변수(`l` · `seg`)에 건 정규식 | 165건 |
| `new RegExp(...)` 로 조립한 것 | 손으로 볼 것 |
| 이름을 두 번 쓰는 변수 | 72개 변수를 판정에서 뺐다 |
| 원본을 **실행해서** 보는 검사(vm · eval) | `dom-boot` · `win-front` 등 |

**「함정 0」은 실제로 댄 170건에 대해서만 하는 말이다.** 위 넷은 안 본 것이지 깨끗한 것이 아니다.

이번 회차에 **내가 못 훑은 검사 10개**(내 사본이 옛 판이라): `audit.py` · `chat-log-persist` ·
`mh-sanitize` · `overlay-gap` · `part-color-entry` · `purikura-deco` · `purikura-stage` ·
`seat-opacity` · `slot-fit` · `smoke`. 위 한 줄이 이 열도 같이 덮는다.

**일부러 깨뜨려 확인했다 (§5-③)**

| 심은 것 | 결과 |
|---|---|
| `/disable-direct-composition/` 를 원문에 건다 | ✗ 함정 후보 |
| `/FPS_UNFOCUSED/` 를 원문에 건다 | ✗ 함정 후보 |
| `const re = /_updateIgnore/; re.exec(src)` | ✗ 함정 후보 (정규식 변수도 잡는다) |
| `/setIgnoreMouseEvents/` — 살아 있는 코드 | 안 걸림 |
| `/OVERLAY_GAP/` 를 **걷은 본문**에 건다 | 안 걸림 |
| `/NVIDIA/` + 「근거 주석이 남아 있다」 | · 주석을 일부러 봄 |

⚠️ **「함정 후보」는 판정이 아니라 분류다.** 「근거 주석이 살아 있나」를 일부러 보는 항목이
있어서(오버레이 검사의 변이 목록 `근거 주석 삭제 → ✗`) 단서 **둘**로 가른다 — 옆에 붙은 설명
문구, 그리고 정규식 자체에 코드꼴 토큰이 있는가. 둘 다 아닐 때만 후보로 올린다. **마지막은 사람이 본다.**

⚠️ **`sweep` 은 반드시 §3 표로 판을 확인한 검사로 돌릴 것.** 옛 판 `overlay-gap` 으로 돌렸더니
`/물리 /` 가 함정 후보로 떴는데 **가짜였다** — `main.js` 에선 주석에만 있는 게 맞지만 진단 로그
문자열이 분리로 나가 `overlay-win.js:235` 에 살아 있다. 정본 gap 은 그 파일도 읽으므로 정당하다.

**원본 쪽 — 함정 면적 (`tokens` 로 잰 것)**

| 원본 | 주석이 차지한 글자 | 주석에만 있는 코드꼴 토큰 |
|---|---|---|
| `overlay-win.js` | **71%** ★ | 27 |
| `preload.js` | 60% | 26 |
| `main.js` | 52% | 68 |
| `sysinput-win.js` | 51% | 8 |
| `desk-companion-prototype.html` | 6% | 71 |

★ `app.js` 의 29.8% 보다 `overlay-win.js` 가 훨씬 높다. 본문보다 주석이 두 배 넘게 긴데
읽는 검사는 둘뿐이라, **눈이 제일 적은 자리가 면적은 제일 넓다.**
`main.js` 쪽에서 눈에 띄는 것: `OVERLAY_LAYERED_ALPHA` · `FPS_UNFOCUSED` · `STALE_MS` ·
`_updateIgnore` · `_sendIgnore` · `applyDesktopRunClass` — 앞 둘은 분리로 나갔고 뒤 셋은
다른 이름으로 살아 있는 옛 이름이다.

### ⑤ `audit.py` — 고쳤다 (2026-09-13 · 검사2 재설계 · 검사6 계량)

**검사 6 — 110초 → 7초.** 상수 이름 하나마다 1.9MB 원문을 다시 훑고 있었다(app.js 는
스캔 대상이 2,361개다). 파일마다 한 바퀴로 뒤집었다. `(?<![\w$.])` 를 그대로 둬서
판정은 **완전히 같다** — `obj.X++` · `xNAME--` · `let` 선언은 여전히 안 걸린다.
★ 이게 실기기에서 audit.py 가 기본 60초 상한에 잘려 **결과를 아예 못 보던** 원인이다.
성능이 아니라 **가시성** 문제였다. `--timeout=120` 은 이제 필요 없다.

**검사 2 — 세 군데가 한꺼번에 낡아 있었다.**

| 무엇이 | 옛 판 | 지금 |
|---|---|---|
| 앵커 | `closest('(#myStatusChip…)')` 인라인 목록 | `const UI_HIT_SEL` **이름**으로 |
| 수집 | `#id{…position:fixed` (붙여 쓴 단일 선택자만) — 11개 놓침 | `<style>` 안 규칙을 블록으로 · `position:fixed` ∪ `body.desktop` |
| 덮임 | HTML **글자 거리** 4000/12000 | **DOM 조상** (HTMLParser) |

옛 판은 이름 필터(`Overlay`/`Win`/`Modal`/`Gate`)까지 걸어서 **앵커만 고쳐도 후보가 0개**였다.
«통과 ✅» 가 찍히는데 잰 것이 없는 상태 — §5 가 경고하는 그 모양이라 필터를 뺐다.

★ **주석에 두 번 걸렸다.** ⓐ 옛 앵커 `closest('#myStatusChip')` 는 지금 `app.js` 전체에서
`37084` 줄 **주석 안에만** 있다 — 정규식을 조금만 느슨하게 풀면 그 주석에 걸려 초록이 된다.
⇒ `_strip_js_comments` 를 파일 위로 올리고 `app_code` 로만 본다.
ⓑ CSS 쪽도 같았다. 문서 전체에 블록 정규식을 걸면 규칙 앞 `/* … */` 가 **선택자로 붙어**
들어와, `#seatLabelsLayer` · `#myChatBox` · `#myStatusMenu` 가 통과 껍데기로 잘못 면제됐다.
⇒ `<style>` 안만 보고 CSS 주석을 먼저 걷는다.

★ `pointer-events:none` 면제는 **한 규칙만 보고 정하지 않는다.** `#myChatBox{…none}` 뒤에
`#myChatBox:not(.hidden){…auto}` 가 오면 열렸을 때는 클릭을 받는다. 되살아나는 id 는 뺀다.

**일부러 깨뜨려 확인한 것**

```
UI_HIT_SEL 개명            → ⚠️ 정의를 못 찾음
#friendPicker 를 목록에 추가 → 통과 ✅ (검사 대상 41 · id 49 · class 9)
목록에서 #myStatusChip 제거  → ⚠️8 (자식 팝업 일곱이 한꺼번에 드러난다)
#scene 예외를 지움          → ⚠️ #scene (예외가 실제로 일하고 있다)
검사6: const X=1; X+=2 주입 → 줄 번호까지 정확히 잡힌다 · obj.X++ · let 은 안 잡힌다
```

⚠️ 이 검사가 처음 찾아낸 빨강 하나(`#friendPicker`)는 가짜가 아니었다 — 아래 §4-⑥ 에서 고쳤다.

### ⑥ 새 검사2 가 처음 찾아낸 것 — 고쳤다 (2026-09-13)

**`#friendPicker` 가 `UI_HIT_SEL` 에 없었다.** `position:fixed; inset:0; z-index:46` 이고
`.fp-item` 클릭 · `fpCancel` 핸들러가 다 살아 있는데 화이트리스트에는 없었다. HTML 의
`body.desktop` 딤 투명화 그룹(= run 모드 모달의 사실상 정의) 12개 중 이것만 빠져 있었다.

제보가 없던 이유는 **뜰 수가 없어서**다 — `openAddFriend()`(`app.js:31196`)를 아무도 부르지
않는다. 그 호출을 되살리는 순간 클릭이 그대로 뒤 창으로 뚫렸을 것이다.
⇒ `UI_HIT_SEL` 끝에 `, #friendPicker` 를 붙였다. 검사 2 는 이제 초록이다.
⚠️ `UI_HIT_SEL` 쪽은 줄을 늘리지 않고 **문자열 안에만** 더했다. 다만 아래 ⑥-b 의 주석
  다섯 줄이 `29249` 에 들어가면서 **그 뒤가 전부 +5 밀렸다** — 이 문서와 아래 ⑦ 표의
  줄 번호는 **고친 뒤 기준**으로 다시 적었다. 핸드오프의 옛 번호를 볼 때 주의할 것.

**`#commImpOverlay`** — `app.js:26806` 이 `getElementById` 로 잡는데 HTML 에 그 요소가 없다.
`30210` 의 `bindLauncherDim` 목록에도 남아 있다. **검사 2 소관이 아니다** — 요소가 없으니
후보 수집에서 빠지고, 유령 id 는 검사 1 이 본다. 잔재 제거는 별건으로 잡을 것.

### ⑥-b 시간초과가 가리고 있던 것 — 검사 19 ★

검사 6 이 60초를 먹는 동안 실기기에서는 **검사 7~19 가 통째로 안 보였다.** 계량을 고치자
12개가 처음 돌았고 그중 하나가 걸렸다 — `검사19: app.js:29251 — value|c`.

계정 복구 상자가 후보를 그리는 자리다. `c` 의 출처는 `localStorage[MY_PREV_USER_IDS_KEY]`,
곧 **이 기기에서 예전에 쓰던 내 uid** 라 남이 넣을 수 있는 값은 아니었다. 그래도 씻는다 —
안 씻은 속성 보간은 되살아나는 구멍이고, 친구 목록 `title=` 이 정확히 그렇게 뚫렸다.
⇒ 속성과 `<b>` 텍스트 **둘 다** `escHtml()` 로 감쌌다.
★ 되읽는 쪽(`picked.value`)은 DOM 프로퍼티라 브라우저가 엔티티를 푼다 —
  `authRebindUserCode` 에 가는 값은 이스케이프 전과 같다. 동작이 안 바뀐다.

⚠️ **검사 19 는 속성값만 본다.** 같은 줄의 `'<b …>' + c + '</b>'` 는 안 짚었다(`_SINK19` 가
`속성="…"` 안의 보간만 센다). 텍스트 자리까지 보게 할지는 별건 — 오탐이 크게 늘 자리라
`_OK19` 같은 검토완료 목록을 먼저 설계하고 손댈 것.

★ `app.js` 를 고친 뒤 **52개 검사를 전·후로 다 돌려 출력을 대조했다 — 한 줄도 안 달라졌다.**

### ⑦ 닮은 목록이 다섯 더 있다 ★ 앵커를 옮기기 전에 읽을 것

`UI_HIT_SEL` 말고 `app.js` 에 같은 모양이 다섯이다. **전부 클릭 통과 화이트리스트가 아니다.**

| 줄 | 이름 | 무엇 |
|---|---|---|
| 7920 | `FS_KEEP_OPEN_SEL` | 설정창을 **안 닫을** 창 목록. ★ 하필 `'#myStatusChip'` 으로 시작한다 |
| 8373 | `OPEN_MODAL_SEL` | 지금 열린 모달이 있는가 |
| 8495 | (무명) | 꾸미기창 **바깥 클릭** 예외 21개. `#gachaInvOverlay` 로 시작 |
| 8505 | `modalOpen` | 8373 과 거의 같은 목록 (둘이 갈려 있다) |
| 30210 | `bindLauncherDim` | 런처 카드 톤다운용. `#commImpOverlay` 를 들고 있는 유일한 자리 |

주석을 다 걷어낸 코드에서도 `'#myStatusChip…'` 으로 시작하는 문자열이 **둘**이다(7920 과
정본). 「`#myStatusChip` 으로 시작하는 목록」이라는 기준으로는 못 가른다 — **이름으로 잡을 것.**

---

## 5. 커밋 layout — (B) 로 정함

```
t-w/
├─ main.js  preload.js  overlay-win.js  sysinput-win.js  package.json
├─ app/          app.js · desk-companion-prototype.html · parts/ · assets/
└─ checks/       ← 검사 53개 + CHECKS.md(이 파일) + run.js
```

`checks/run.js` 가 OS 임시 폴더에 **평평한 한 층**을 만들어 원본과 검사를 거기 모아 돌린다.
루트를 펼치고 그 위에 `app/` 내용을 같은 층에 펼친다(이름이 겹치면 루트가 이긴다).
cwd 와 `__dirname` 이 같은 곳을 가리키므로 §2 의 두 갈래가 동시에 만족된다 —
**검사 53개는 한 글자도 안 고쳤다.**

```
npm run check                 전부
node checks/run.js sysinput   이름에 그 말이 든 것만
node checks/run.js --list     목록과 정본 대조만
node checks/run.js --hashes   ↑ §3 표에 붙일 줄을 찍는다
node checks/run.js --keep     스테이징을 안 지우고 경로를 알려 준다
```

종료 코드: 0=전부 통과 · 1=빨강 있거나 정본 불일치 · 2=돌리지도 못함

### 러너가 지키는 두 가지

**① 정본 대조가 먼저다.** 돌리기 전에 `checks/*.js` 해시를 §3 표와 맞댄다. 다르면 그 줄을
찍고 **마지막 줄에 "위 초록은 근거로 못 쓴다" 를 남긴다.** 3-① 이 겪은 일이 다시 나면
조용히 지나가지 않는다. 검사를 고쳤으면 `--hashes` 로 표를 다시 찍어 §3 을 갈 것.

**② `원본 없음` 은 빨강이 아니다.** 원본 한 벌이 안 갖춰진 체크아웃에서 46개가 빨갛게
나오면 그 안에 진짜 빨강 2개가 묻힌다. 요약 줄(`통과 N · 실패 N`) 없이 ENOENT ·
MODULE_NOT_FOUND · "못 찾음" 으로 끝난 검사는 **`원본 없음` 으로 따로 센다.** 규칙이 깨진
검사는 반드시 요약 줄을 찍고 끝나므로 이 둘은 안 섞인다.

### 기준선 — 실기기 (Windows · `C:\Users\seo\Desktop\tw`)

**지금 것 (2026-09-14 · 개정 8 · `sim-keysof-twin.js` 등재 뒤)**

```
정본 대조   54개 전부 일치
검사 54개 · 초록 53 · 빨강 0 · 원본없음 1 · 시간초과 0 · 건너뜀 0
원본없음:   togetherland-ui-mockup.html  (sim-dom-boot.js) ← 보류분(§11)
```

⇒ **지금 저장소에서 닫을 수 있는 원본 구멍은 0개다.** 개정 7 의 `53 · 52 · 1` 에서 검사와
초록이 나란히 하나씩 늘었다 — 새 검사 하나가 그대로 초록으로 붙었고 나머지는 안 움직였다.

**이 바퀴가 새로 알려 준 것**

- ★ **`app.js` 는 `app\parts\app.js` 다.** 스테이징이 «`app\parts\app.js` 에서 끌어올림» 을
  찍었다. §6-③ 이 「한 층 더 깊이 있다」고만 적어 둔 자리의 **실제 경로**가 이것이다.
  `mallang.js` · `purikura-net.js` · `firebase-init.js` 도 전부 `app\parts\` 에 있고,
  2번째 바퀴(§6-⑥)가 그 셋을 찾아 올려 5개를 초록으로 돌렸다. **2번째 바퀴는 임시방편이 아니라
  지금 이 저장소 구조에서 상시로 필요한 단계다.**
- `sim-overlay-layered.js` **48 · 0** — §4-② 가 「`preload.js` 가 있으면 48」이라고 적어 둔 그 수다.
  리눅스에서는 43, 여기서는 48. 갈래가 예측대로 갈린다.
- `sim-fly-replay` · `sim-gacha-prune` 이 여전히 **「다 돌고 안 죽어서 끊음」**이다.
  §10-B 가 «이 둘은 stderr 세 줄만 늘면 재발한다» 고 못 박은 자리다 — 지금은 초록이지만
  **경고가 살아 있는 상태**로 읽을 것. 끊긴 것이 아니라 안 죽은 것이다.

⚠️ **이 초록은 `app/` 이 커밋됐다는 뜻이 아니다.** 러너는 git 이 아니라 **디스크**를 훑는다 —
미추적 파일도 그대로 스테이징에 올라간다. `app/` 이 저장소에 들어갔는지는 `git status` 로만
가른다(3-⑤). 다른 사람이 클론하면 43개가 원본없음으로 떨어질 수 있다.

★ **[2026-09-14] 이 「원본없음 1」은 메울 구멍이 아니다** — 투게더빌리지 보류분이다(§11).
  즉 지금 저장소에서 닫을 수 있는 원본 구멍은 **0개**다.

★ **`audit.py` 가 「전부 통과」로 찍힌 것은 이 저장소에서 처음이다.** 여태 60초 상한에 잘려
초록도 빨강도 아니었다 — §4-⑤. 검사 7~19 는 실기기에서 이번에 처음 끝까지 돌았다.

★ 이 기준선은 **2번째 바퀴를 포함한 숫자**다. 첫 바퀴에서 `mallang.js` · `purikura-net.js` ·
`firebase-init.js` 가 없어 6개가 원본없음으로 떨어졌다가, 깊은 자리에서 찾아 올린 뒤 초록이
됐다. 근본은 §6-③ 의 `app/` 미추적이고 러너의 바퀴는 임시방편이다.

<details><summary>옛 기준선 (개정 6 · 이 표가 처음 가려낸 것들)</summary>

```
검사 53개 · 초록 39 · 빨강 4 · 원본없음 7 · 시간초과 3
```

| 빨강 | 결과 | 정체 |
|---|---|---|
| `sim-overlay-gap.js` | 20·7·4 | §4-② — 오버레이 분리 이전 판 |
| `sim-overlay-layered.js` | 24·5·4 | §4-② — 같음 |
| `sim-chat-log-persist.js` | ✗ 2 | ★ **새로 드러난 것.** 아래 §8 |
| `sim-slot-fit.js` | ✗ 4 | ★ **새로 드러난 것.** 아래 §8 |

원본없음 7개가 찾던 것: `firebase-init.js` · `mallang.js` · `purikura-net.js` ·
`togetherland-ui-mockup.html`.

</details>


## 6. 실기기에서 드러난 것 — 러너 고침

### ① `.gitattributes` ★ 안 넣으면 정본 대조가 통째로 무너진다

커밋할 때 `LF will be replaced by CRLF` 경고가 53줄 떴다. Windows 의 `core.autocrlf` 다.
**다음 체크아웃·클론에서 바이트가 달라지므로 §3 해시가 전부 어긋난다.** 한 글자도 안 고쳤는데
러너가 53개 전부 "판이 다르다" 로 빨개지고, 그러면 이 표는 경고가 아니라 잡음이 된다.

루트에 `.gitattributes` 를 두고 `checks/** -text` 로 변환을 껐다.
`text eol=lf` 가 아니라 `-text` 인 이유는 그 파일 주석에 적어 뒀다.

### ② `audit.py` 가 가짜 빨강이었다

`python` 의 stdout 기본 인코딩이 Windows 에서 cp949 라 한글이 깨져서 왔다. 깨지니까
"…있는 폴더에서 실행하세요" 라는 제 말이 안 읽혔고, 러너가 `원본 없음` 으로 못 갈라
빨강으로 셌다. `PYTHONIOENCODING=utf-8` · `PYTHONUTF8=1` 을 주고 돌린다.

### ③ `app.js` 가 한 층 더 깊이 있다

스테이징은 루트와 `app/` 를 **한 층**만 펼친다. `app/` 보다 깊은 자리에 있으면 평면에
안 올라와 43개가 통째로 `원본 없음` 이 된다. 없다고 확인된 원본만 저장소에서 찾아
평면으로 끌어올리게 했다. 어디서 끌어왔는지 한 줄 찍는다.

⚠️ 같은 이름이 둘 이상 나오면 **고르지 않고 알려만 준다.** 어느 쪽이 진짜인지는 러너가
판단할 일이 아니다 — 잘못 고르면 초록이 거짓이 된다.

### ④ 안 죽는 검사 — 러너가 통째로 섰다 ★

`sim-fly-replay.js` 에서 러너가 멈췄다. 검사가 느린 게 아니다 — `app.js` 를 통째로 평가하는
검사는 할 일을 다 끝내고도 **렌더러가 남긴 타이머 때문에 node 가 안 죽는다.** `spawnSync` 는
프로세스가 끝나야 출력을 주므로 밖에서 보면 멈춘 것과 똑같이 보인다.

한 검사에 60초를 준다(`--timeout=120` 으로 늘릴 수 있다). 그리고 **끊긴 것과 멈춘 것을
가른다** — 요약 줄이 이미 나왔으면 그 결과를 쓰고 `(다 돌고 안 죽어서 끊음)` 만 덧붙인다.
요약도 없이 끊겼을 때만 `⏱ 시간초과` 로 세고, **그건 초록도 빨강도 아니다.**

### ⑤ 출력이 통째로 날아갔다 — 파이프 → 파일

시간초과로 죽인 검사 셋이 **출력 한 줄 없이** 왔다. 파이프로 받으면 아직 안 비워진 버퍼가
강제 종료와 함께 날아간다(리눅스에서는 살아남고 Windows 에서는 날아갔다). 그러면 ④ 의
"다 돌고 안 죽음 / 진짜 멈춤" 판정이 통째로 죽는다 — 실제로 셋 다 `시간초과` 로 뭉쳤다.

⇒ 출력을 **파일로 받는다.** 쓰는 즉시 디스크에 남으므로 죽여도 그때까지 찍은 것이 남는다.
로그는 스테이징 **밖**에 쓴다 — 안에 쓰면 검사가 폴더를 훑을 때 제 로그를 원본으로 본다.

### ⑥ 두 번째 바퀴

`원본 없음 — mallang.js` 처럼 **검사가 이름을 대 준** 원본은 저장소 어딘가에 있을 수 있다.
첫 바퀴에서는 그 이름을 모르니 못 올렸다. 이름을 알게 된 뒤 한 바퀴만 더 돈다 —
거기서도 못 찾으면 진짜로 없는 것이다.

### ⑦ "전부 통과 ✅" 로 끝내는 검사

`sim-town-32.js` · `sim-village-addr.js` 등은 `통과 N · 실패 N` 요약 줄을 안 찍는다.
종료코드만 남아 `종료코드 0` 으로 보였다. 이제 `전부 통과` 로 찍는다.

---

## 8. 새로 드러난 빨강 — ★ 이 표가 처음 가려낸 것

3-① 전에는 이 둘이 빨간지 아무도 몰랐다. 검사가 저장소에 없었고 `app.js` 가 평면에
안 올라와 돌지도 않았다. **이것이 검사를 커밋한 값이다.**

### `sim-chat-log-persist.js`

```
✗ chatLog 를 지우는 자리는 둘 그대로다 (찾은 수: 3)
✗ ★ 8842행의 삭제가 플래그 뒤에 있다
```

지우는 자리가 **둘에서 셋으로 늘었다.** 검사가 개수를 못 박아 둔 항목이라, 늘어난 하나가
무엇이고 왜 생겼는지를 봐야 한다. 검사가 낡은 것인지 코드가 샌 것인지는 아직 모른다.

### `sim-slot-fit.js`

```
✗ ★ 5번 칸을 쓰던 상태로 열면 그 칸이 창 안에 있다 (scrollLeft 0)
✗    끝까지 밀린 상태라 ▶ 가 꺼진다
✗    ◀ 는 살아 있다
✗ ★ 5칸 전부가 창 안으로 들어온다 — 못 닿는 칸: 5
```

넷이 한 덩어리다 — `scrollLeft` 가 0 에서 안 움직인다. 스크롤 복원이 통째로 안 듣는 모양이다.

★ 둘 다 **⑥ 과 무관한 렌더러 쪽**이다. 맥 런타임과 섞지 말 것 — 별건으로 잡는다.

---

## 10. 판정 줄이 없던 검사 — 다 닫았다 (2026-09-14)

§6-⑦ 이 「`sim-town-32` · `sim-village-addr` 등이 요약 줄을 안 찍어 `종료코드 0` 으로 보였다 →
이제 `전부 통과` 로 찍는다」고 적었는데, **그 둘만 고쳐졌고 다섯이 남아 있었다.**

⚠️ **리눅스 한 바퀴로는 이 목록을 못 만든다.** 거기서는 원본이 일곱 빠져 22개가 `원본없음` 으로
빠지므로 판정 줄 유무 자체가 안 보인다. 아래는 **실기기 로그(원본없음 1)** 로 만든 전수다.

| 파일 | 왜 `종료코드 0` 인가 |
|---|---|
| `sim-mh-sanitize.js` | 끝줄 형식 — 「전부」가 없다 · `N건 실패` 는 FAIL_LINE 네 갈래 어디에도 없다 → **고쳤다** |
| `sim-part-color-entry.js` | 끝줄 형식 — 설명이 숫자와 한 줄에 붙어 FAIL_LINE 의 `$` 에 걸린다 → **고쳤다** |
| `smoke.js` | 끝줄이 `✓ 부팅 스모크 통과 —…` 라 「전부 통과」가 없다 → **고쳤다**(§10-C) |
| `sim-seat-opacity.js` | 끝줄이 설명문이다 → **고쳤다**(§12에서 파일을 다시 쓰며 같이) |
| `sim-clone-code-entry.js` | **끝줄은 멀쩡하다.** 러너가 못 읽었다 → `run.js` 를 고쳤다(§10-B) |

⇒ 고친 둘은 **설명은 윗줄, 판정만 마지막 줄.** `전부 통과 ✅` · `✗ 실패 N건` 으로 통일했다.

**확인한 것**

```
통과 경로   고침 전후 출력 통째 대조 — 마지막 줄 말고 한 줄도 안 달라졌다
실패 경로   fail 3 주입 → 둘 다 verdict() 가 {fail:3} 으로 읽고 종료코드 1
러너        둘 다 `종료코드 0` → `전부 통과` 로 바뀐다
```

### 남은 갈래
⇒ **다섯 다 닫았다.** `sim-seat-opacity.js` 는 §12, `smoke.js` 는 §10-C 에서 처리했다.
  `sim-seat-opacity` 의 옛 끝줄에 대해서는 —
  옛 끝줄 `옛 코드 실패 N건 / 새 코드 실패 N건` 은 `run.js:187` 이 **일부러 위험 예시로 들어 둔
  그 줄**이었다(양끝을 안 묶으면 통과한 검사가 `실패 1건` 으로 둔갑한다). 지금은 그 설명을
  `구조 N건 · 지금 코드 N건 · 대조군 N건` 으로 옮기고 판정만 마지막 줄에 둔다.

---

## 10-B. 러너가 판정 줄을 잃어버리던 자리 — `run.js` 고침 (2026-09-14)

`sim-clone-code-entry.js` 는 `전부 통과 ✅ — …` 를 **제대로 찍는데도** `종료코드 0` 으로 왔다.
원인은 검사가 아니라 러너다.

```js
const out = slurp(of) + slurp(ef);   // ← stdout 뒤에 stderr 를 통째로 이어붙인다
const end = verdict(out);            // ← verdict 는 마지막 세 줄만 본다
```

⇒ **stderr 가 세 줄이면 그것만으로 판정 줄이 밀려나 사라진다.** `sim-clone-code-entry` 는
129~133줄에서 `console.log` · `console.warn` 만 가로막고 **`console.error` 는 안 막는다** —
`app.js` 평가 중 stderr 로 나간 줄이 판정을 덮었다.

**탐침으로 실측했다**(같은 검사에 stderr 세 줄만 더한 것):

| | 고치기 전 | 고친 뒤 |
|---|---|---|
| 통과 + stderr 3줄 | `종료코드 0` | `전부 통과` |
| `✗ 실패 3건` + stderr 3줄 | `종료코드 1` — **건수가 집계에서 샌다** | `실패 3건` |
| 통과 + 안 죽음 + stderr 3줄 | **`시간초과 — 결과를 못 봤다`** | `전부 통과 (다 돌고 안 죽어서 끊음)` |
| stdout 통과 + stderr 에 `✗ 실패 2건` | `실패 2건` | `실패 2건` (안 묻힌다) |

★ 셋째 줄이 이 파일이 제 주석에 적어 둔 **`sim-fly-replay` · `sim-gacha-prune` 사고 그대로다.**
그때 고친 것은 `status === null` 쪽뿐이고 이 자리는 남아 있었다. 그 둘은 지금도
「다 돌고 안 죽어서 끊음」이라 **stderr 세 줄만 늘면 재발한다.**

**고침** — 판정을 stdout · stderr **따로** 읽는다. 순서는 「stderr 의 실패 → stdout → stderr」.
stdout 의 통과만 보면 stderr 로 빨강을 찍는 검사를 덮으므로 실패는 그대로 이기게 뒀다.

```js
const vso = verdict(so), vse = verdict(se);
const end = (vse && vse.fail > 0) ? vse : (vso || vse);
```

회귀 확인: 53개 한 바퀴가 고치기 전과 같다(초록 31 · 빨강 0 · 원본없음 22 — 원본 일곱이 빠진
리눅스 기준).

⚠️ **`run.js` 와 `CHECKS.md` 는 §3 해시 표 밖이다.** 즉 이 고침은 정본 대조가 못 잡는다.
둘 중 하나만 옮겨도 조용히 어긋나므로 **`checks/` 는 통째로 주고받을 것.**

---

## 11. 「저장소를 한 글자도 안 읽는 검사 넷」 — 정정 (2026-09-14)

이전 문서 §5-② · 핸드오프 §4-① 이 넷을 한 덩어리로 묶고 «초록 52 중 넷은 아무것도 안
지키고 있다 · 정확도를 갉는 제일 큰 자리» 라고 적었다. **넷의 성격이 서로 다르다.**

`sim-town-32` · `sim-village-addr` · `sim-yard-enter` 는 `app.js` 를 안 보는 게 아니라
**볼 대상이 아직 코드로 없다.** 대상은 투게더빌리지이고, 그 상수는
`togetherland-handoff-4-full.md` §1 「확정된 값 — 이제 흔들지 말 것」과 전부 일치한다.

| 문서 §1 | 검사 안의 값 |
|---|---|
| 채널 6개 · 정원 40명 | `CHANNELS` 6 · `CH_CAP=40` (셋 다) |
| 부지 32개/채널 (4열 × 8줄) | `LOTX` 4 × `LOTY` 8 = 32 (`town-32`) |
| 세계 27 × 42칸 | `TW=27, TH=42` (`town-32`) |
| `CH_PREFIX.join('')==='투게더빌리지'` | 그대로 (`village-addr`) |
| 마당 = 누적 500시간 + 평수 최대(8×10) | `YARD_HOURS=500` · `STAGES` 최대 `'8 × 10'` (`yard-enter`) |

⇒ 이 셋은 **스펙 못박기** 검사다. 원본이라고는 `togetherland-ui-mockup.html` 하나뿐이고
그게 정확히 §5 기준선의 유일한 「원본없음」이다 — 즉 §4-① 이 아니라 **§6-③(`app/` 미추적)과
같은 하나의 막힌 자리**다. ⚠️ 진짜 구멍은 따로 있다: **셋이 그 핸드오프 문서와도 안 묶여
있다.** 문서의 확정값이 바뀌어도 셋은 초록이다.

`sim-seat-opacity` 만 §4-① 의 설명이 맞는다 — 대상(`app.js` 의 `setSeatOpacity`)이 살아
있는데 본문을 제 안에 베껴 두고 그걸 돌린다. 제 머리말도 「(임시)」라고 적어 뒀다.
**넷 중 지금 당장 원본을 읽게 고칠 수 있는 유일한 하나다.**

★ 투게더랜드 핸드오프가 `sim-char-sheet.js` · `sim-char-slots.js` · `sim-house-layout.js` ·
`sim-report-gate.js` 를 언급하는데 **넷 다 §3 표에도, 받은 `checks.zip` 에도 없다.**

### [2026-09-14 결정] 투게더빌리지는 보류다 — 셋을 고치지 말 것

만들 것이 많아 **나중에 다시 넣는다.** 그때까지 셋은 지금 모습 그대로 둔다.
문서와 맞대는 안(시안 A)도, `togetherland-ui-mockup.html` 을 읽히는 안(시안 B)도
**보류 해제 뒤에** 정한다. 지금 손대면 대상이 바뀐 뒤 두 번 고치게 된다.

이 결정이 같이 정리하는 것 셋:

- **기준선의 「초록」을 읽는 법.** 초록 안의 `town-32` · `village-addr` · `yard-enter` 셋은
  **보류된 제품의 스펙 못박기**다. `app.js` 가 어떻게 바뀌어도 초록이고 **그게 맞다.**
  이전 문서 §5-② 의 «초록인데 아무것도 안 지킨다» 로 세지 말 것 — 셋은 그 부류가 아니다.
- **`togetherland-ui-mockup.html` 은 메울 구멍이 아니다.** §5 기준선의 유일한 「원본없음」
  (`sim-dom-boot.js`)과 §6-③ 의 미추적 목록에 이것이 올라 있는데, **보류 대상이므로
  `app/` 커밋으로 닫을 자리가 아니다.** 남은 미추적은 보류분을 빼고 셀 것.
- **위 검사 넷을 찾지 말 것.** 만들다 만 것인지 이름만 적힌 것인지는 보류 해제 때 같이 본다.
  지금 저장소를 뒤지는 것은 헛품이다.

⇒ **`sim-seat-opacity` 만 §4-① 의 살아 있는 항목으로 남는다. → §12 에서 닫았다.**

---

## 9. 그 외

- `.gitignore` — 스테이징은 **저장소 밖**(OS 임시 폴더)이라 넣을 것이 없다.
  `oauth-config.js` · `app/parts/firebase-config.js` 는 별건으로 확인할 것(§3-⑤ 푸시 차단).
- `package.json build.files` 는 **허용 목록**이라 `checks/` 는 애초에 설치본에 안 실린다.
  뺄 것이 없다. `scripts.check` 만 더했다.
- **`app/` 을 커밋하면** 원본없음 43개가 살아난다. 그때 나오는 숫자가 진짜 기준선이고,
  ⑥ 은 그 뒤다.

---

## 12. `sim-seat-opacity` — 기록물에서 검사로 (2026-09-14)

§4-① 의 마지막 살아 있는 항목이었다. 이 파일은 `app.js` 의 `setSeatOpacity` 를 **베껴 둔
사본**(`setOpacityNew`)을 돌리고 있었다. 즉 `app.js` 쪽이 어떻게 바뀌어도 초록이었다 —
「고치기 전후가 달라졌다」를 보여 주는 **기록물**이지, 앞으로를 지키는 검사가 아니었다.

**[결정] 앞으로를 지키는 검사로 간다(시안 D).** 사본을 지우고 `app.js` 본문을 직접 뗀다.

```js
const BODY = fnBody(SRC, 'function setSeatOpacity(seat, op)');   // 중괄호를 세어 뗀다
const setOpacityNew = new Function('seat', 'op', BODY);          // 진짜 코드가 시나리오를 탄다
```

### 뗄 때 지킨 것

- **주석을 걷은 본문을 쓴다.** `app.js` 는 본문의 **30% 가 주석**이고 그 주석에 「하지 말라」고
  적어 둔 옛 코드가 인용돼 있다. 원문에 구조 검사를 걸면 그 인용문에 걸려 초록이 된다
  (§4-⑦ · `sim-overlay-gap` 이 실제로 그렇게 통과했었다).
- **모형을 실물에 맞췄다.** 실물은 `seat.meshes.forEach` 가 아니라 `seat.bodyWrap.traverse` 를
  돌고, `material` 이 배열일 수 있다고 보고 `mats.forEach` 로 편다. 옛 모형 그대로 태우면
  본문이 아무 메시도 못 만나 **전부 초록으로 지나간다.**
- **정규식 리터럴은 안 가린다.** 뗄 함수 안에 정규식이 없어서 괜찮다. 창을 넓히거나 다른
  함수에 쓸 때는 이 가정부터 확인할 것 — 파일에 주석으로 적어 뒀다.

### 옛 코드는 안 지웠다 — 역할이 바뀌었다

`setOpacityOld` 는 이제 **대조군**이다. 옛 코드가 시나리오 D 를 통과해 버리면 그건 고쳐졌다는
뜻이 아니라 **시나리오가 무뎌졌다**는 뜻이므로 그 자체를 빨강으로 센다.

```
check('시나리오가 아직 옛 코드를 가려낸다 (대조군 실패 N건)', oldFail > 0);
```

### 무엇을 재는가

| | |
|---|---|
| 구조 4건 | `op >= 0.999` 가드 · `_opTouched` 표식 · `_baseTransparent` 를 같은 조건에 묶음 · `_prevVisible` 복원 |
| 시나리오 4건 | A 재빌드 후 복귀 · B 3회 왕복 · C 반투명(0.5) 보존 · **D opacity 0 인 머티리얼이 userData 를 잃고 재진입** |
| 대조군 1건 | 옛 코드가 D 에서 실패해야 한다 |

★ 실제로 버그를 내는 것은 **D 하나뿐**이다. A·B 는 옛 코드도 통과한다 — 즉 이 사고는
재빌드만으로는 안 나고 **opacity 0 인 머티리얼 객체가 기억을 잃어야** 난다.

### 되돌림을 정말 잡는지 (실측)

| 시험 | 결과 |
|---|---|
| 정상 | `전부 통과 ✅` · 종료코드 0 |
| `app.js` 의 `!_opTouched && op >= 0.999` 가드를 떼어 옛 코드로 되돌림 | `✗ 실패 3건` (구조 2 · 시나리오 D 1) · 종료코드 1 |
| 함수 서명을 `(seat, op, extra)` 로 바꿈 | `✗ … setSeatOpacity 를 못 뗐다` · 종료코드 1 — **조용히 초록이 되지 않는다** |
| `app.js` 가 없음 | `✗ app.js 를 못 찾음 …` · 종료코드 2 → 러너가 `원본 없음` 으로 가른다 |

⚠️ 세 번째 줄이 이 방식의 값이자 위험이다. 서명이 바뀌면 **검사가 못 도는 것이지 규칙이
깨진 것이 아닌데** 빨강으로 나온다. 그래도 빨강으로 두는 편이 맞다 — 초록으로 두면
§4-① 의 그 자리로 되돌아간다. 서명을 바꿀 일이 있으면 이 파일의 `fnBody(...)` 인자를 같이 고칠 것.

판정 줄도 §10 형식으로 맞췄다: 설명은 `구조 N건 · 지금 코드 N건 · 대조군 N건`, 마지막 줄은
`전부 통과 ✅` 또는 `✗ 실패 N건`.

---

## 10-C. `smoke.js` 판정 줄 — 19개를 흔들지 않고 고쳤다 (2026-09-14)

이 파일은 **다른 검사 19개가 원본으로 읽는다.** 그래서 한동안 손대지 않고 미뤘는데,
읽는 방식을 확인해 보니 위험이 아니었다.

```js
let smokeSrc = fs.readFileSync('smoke.js', 'utf8');
smokeSrc = smokeSrc.slice(0, smokeSrc.indexOf('/* ── 실행'))   // ← 19개 전부 여기서 자른다
vm.runInThisContext(smokeSrc, { filename: 'smoke-stubs.js' });
```

⇒ **19개는 290줄 `/* ── 실행` 표식 앞의 스텁만 쓴다.** 판정 줄은 그보다 뒤다.
그래서 표식 **뒤만** 고쳤다. 스텁 구간(1~290줄)은 바이트까지 그대로다(`1c2e5ad635c4`).

### ⚠️ 거꾸로 말하면 — 표식 앞은 한 줄도 건드리지 말 것

`/* ── 실행` **앞**을 고치면 19개가 통째로 흔들린다. 줄을 지우거나 더하는 것뿐 아니라
스텁의 동작이 바뀌는 것도 마찬가지다. 그쪽을 고쳐야 할 때는 아래 절차를 그대로 쓸 것.

### 확인한 것 — 말로 안 하고 전후를 통째로 댔다

```
① 스텁 구간 해시     head -290 smoke.js  →  전후 동일 (1c2e5ad635c4)
② 53개 출력 전수     --keep 으로 전후 로그를 받아 diff
                     → 달라진 파일 smoke.js.out **하나뿐**
                     ⚠ 스테이징 폴더 이름이 매번 랜덤이라 .err 15개가 가짜로 걸린다.
                       `/tmp/tw-checks-XXXX` 를 지우고 대면 0 이 된다. 다음에도 이 노이즈부터 걷을 것.
③ 실패 경로          app.js 를 일부러 터뜨림 → `✗ 실패 1건` · 종료코드 1 · verdict {fail:1}
```

⚠️ **②의 범위** — 19개 중 리눅스에서 실제로 돈 것은 **15개**다. `sim-clone-code-entry` ·
`sim-friend-manage` · `sim-google-login` · `sim-win-front` 넷은 `desk-companion-prototype.html` ·
`main.js` · `preload.js` 가 없어 못 돌았다. 넷도 같은 표식에서 자르고 그 앞이 바이트 동일하니
구조상 안전하지만, **실기기 한 바퀴로 확인할 것.**

---

## 13. §4-⑧ 은 닫혔다 (2026-09-14 갱신)

원본 다섯이 들어와 **7개가 전부 닫혔고**, 1회차 22개도 넓힌 그물로 다시 댔다 — **함정 0건**.
막힌 자리는 없다.

남은 것은 §4-⑧ ★★ 표의 **「이 도구가 못 보는 것」 넷**이다. 급한 일이 아니다 —
지금 깨진 것이 아니라 **나중에 그 부류의 함정이 생기면 못 잡는다**는 뜻이다.

★ `dom-boot` 은 사정권 밖이다 — 판정 정규식이 없다.
★ `togetherland-ui-mockup.html` 은 보류분이다(§11).

### `trapscan.js` 는 `checks/tools/` 에 둔다 — 실측으로 정했다

`checks/` 바로 밑에 두면 **검사가 된다.** `listChecks` 가 `.js`·`.py` 를 전부 집고 예외는
`run.js` 하나뿐이다(`run.js:73`). 세 가지를 실제로 돌려 봤다.

| 둔 자리 | 결과 |
|---|---|
| `checks/trapscan.js` | `✗ trapscan.js 종료코드 2` — **빨강 1개가 영구히 박힌다.** 인자 없이 불려 사용법을 찍고 끝난다. 정본 대조도 `? 표에 없다` 를 찍어 「전부 일치」 줄이 사라진다 |
| `checks/tools/trapscan.js` (고치기 전) | **스테이징이 통째로 죽는다** — 아래 ★ |
| `checks/tools/trapscan.js` (고친 뒤) | 목록·정본 대조에 안 나타나고, 검사 결과가 **한 줄도 안 달라진다** |

★ **`trapscan` 과 무관한 기존 구멍을 하나 찾았다.** 스테이징이 `checks/` 를 훑을 때
`fs.cpSync` 를 재귀 옵션 없이 부른다(`run.js:137`). **폴더가 하나라도 생기면 그 자리에서 던지고
한 바퀴가 통째로 안 돈다** — 검사 하나가 빨개지는 게 아니라 아무것도 안 돈다.
`checks/fixtures/` 같은 것을 나중에 만들어도 같은 일이 난다. 고쳤다:

```js
for (const e of fs.readdirSync(CHECKS, { withFileTypes: true })){
  if (e.isDirectory() || e.name === 'run.js') continue;      // ← 폴더를 건너뛴다
  fs.cpSync(path.join(CHECKS, e.name), path.join(dir, e.name));
}
```

**전후를 통째로 댔다**(§10-C 와 같은 방식 · 스테이징 랜덤 경로는 지우고 비교):

```
전 : 검사 52개 · 초록 37 · 빨강 4 · 원본없음 10 · 시간초과 1     69줄
후 : 검사 52개 · 초록 37 · 빨강 4 · 원본없음 10 · 시간초과 1     69줄   → diff 없음
```
(빨강 4·시간초과 1 은 이 리눅스 환경의 낡은 사본 탓이다 — 실기기 숫자가 아니다. 여기서 볼 것은
**전후가 같다**는 것 하나다.)

⚠️ **`.mjs` 로 이름을 바꾸는 길은 쓰지 말 것.** `endsWith('.js')` 를 우연히 피해 가므로
아무것도 안 고치고 되긴 한다. 그러나 왜 되는지가 어디에도 안 적히고, `listChecks` 를 손보는
순간 조용히 검사로 끌려 들어온다. 이 문서가 막으려는 종류의 우연이다.

### `run.js` 도 §3 밖이다 — 도구 칸을 만들 것

`trapscan.js` 를 `tools/` 에 두면 `listChecks` 가 안 집으므로 §3 표에도 안 들어간다.
`run.js` 와 같은 처지다 — **판이 바뀌어도 아무도 모른다.** §1 이 적어 둔 그 구멍이 하나 더 는다.
⇒ §3 표 **아래에 「도구 — 러너가 안 돌리는 파일」 칸**을 만들어 `run.js` · `trapscan.js` 의
해시만 적을 것. 검사 개수(53)는 안 건드린다.

### 다음 세션에서 할 것

**검사 축은 여기서 끊는다.** §4-⑧ 이 닫혔고, 남은 것은 급하지 않다.

1. ~~§3 표 아래에 「도구」 칸을 만든다~~ → **개정 8 에서 했다**(§3 아래). ★ 파이프 표가 아니라
   코드블록이다 — 표로 쓰면 러너가 깨진다. 그 절의 ⚠️ 를 읽을 것.
2. ~~실기기 한 바퀴를 다시 잰다~~ → **했다**(§5 · `초록 53 · 빨강 0 · 원본없음 1`). **3-① 은 닫혔다.**
3. §8 의 `sim-chat-log-persist` · `sim-slot-fit` 은 지금 둘 다 초록이다 — 그 표가 가려낸
   빨강이 어떻게 닫혔는지 §8 에 마무리 한 줄을 적을 것.
4. 투게더빌리지 보류가 풀리면 §11 의 시안 A·B 를 정한다.

⚠️ **[개정 8 정정] 아래 두 줄이 낡았다.**
- 「다음 차례는 `handoff-overlay-video-blackout-4.md` §8」 — 그 건은 **닫혔다.** 실제로 잡은 것은
  갭이 아니라 **레이어드 알파**로 밝혀졌다(`handoff-mac.md` §6 이 기록). 릴리즈노트를 고칠 때
  그 문서의 「닫음」 절을 먼저 읽을 것.
- 「그다음이 맥 ⑤ — 맥에 관한 첫 실측이다」 — **⑤ 는 이미 초록이다.** `mac-probe #2` 에서
  arm64·x64 양쪽이 붙었다(`handoff-mac-runtime.md` §1). ③④⑤ 가 다 끝났고 다음은 **⑥**(맥 런타임)
  이며, 그건 Mac 실기기 + Apple Developer 계정이 있어야 연다.

### 다음 세션이 먼저 알아야 할 것

- **`run.js` 와 `CHECKS.md` 는 §3 해시 표 밖이다.** 정본 대조가 못 잡는다. `checks/` 는 통째로.
- **`smoke.js` 의 `/* ── 실행` 표식 앞은 건드리지 말 것** — 19개가 통째로 흔들린다(§10-C).
- **`sim-seat-opacity` 는 `app.js` 의 함수 서명에 묶여 있다**(§12). 서명을 바꾸면 빨강이 난다 —
  그건 고장이 아니라 설계다. 파일 안 `fnBody(...)` 인자를 같이 고칠 것.
- **`findstr` 로 코드 줄을 확인하지 말 것.** 이 저장소는 주석이 전부 한글이라 콘솔 코드페이지에서
  깨지고 「FINDSTR: 쓰기 오류」로 **첫 줄에서 끊긴다** — 없는데 있다고, 있는데 없다고 보인다.
  판을 가릴 때는 `certutil -hashfile <파일> SHA256` 으로 §3 해시를 댈 것.
- 전후 대조를 할 때 **스테이징 폴더 이름(`tw-checks-XXXX`)이 매번 랜덤**이라 `.err` 가 무더기로
  가짜로 걸린다. 경로를 지우고 댈 것(§10-C).

---

## 14. `sim-keysof-twin.js` — 판정 키 통로 두 벌 (2026-09-14 신규)

`handoff-platform-split.md` §4-b 가 «`keysOf` 는 두 벌이다(`main.js` 의 `keysOf` ·
`app.js` 의 `_chalKeysOf`). 한쪽만 고치면 안 된다» 라고 못 박고, 이어서
«`sim-sysinput.js` 6절이 두 벌의 우선순위가 같은지 대조한다» 라고 적어 뒀다.

★ **뒷 문장이 사실이 아니었다.** `sim-sysinput.js` 에는 `app.js` 라는 문자열이 **0건**이다 —
`app.js` 를 옆에 두든 치우든 결과가 60·0 으로 한 글자도 안 바뀐다. 6절은 `main.js` 쪽 통로만 본다.
§4-b 가 「제일 부서지기 쉽다」고 지목한 자리를 **지키는 것이 실제로는 하나도 없었다.**
§4-⑧ 이 훑은 「주석에 걸려 헛도는」 부류가 아니라 **문서에만 있고 파일에 없던** 부류다.

⇒ 새 파일로 메웠다. **`sim-sysinput.js` 6절에 끼워 넣지 않았다** — §3 의 판 계보가 보여 주듯
그 이름은 이미 판이 여럿이었다. 같은 이름에 하나를 더 만들면 「어느 초록이 진짜인가」가 또 생긴다.

### 무엇을 재는가 (30건)

| 절 | 지키는 것 |
|---|---|
| 1 | 두 함수가 제자리에 있다 (못 찾으면 `?` · 종료코드 2) |
| 2 | 본문이 주석·공백을 뺀 뒤 동일하다 |
| 3 | 우선순위가 양쪽 다 `keys → key → exe → name` — **둘이 같이 틀린 경우**를 잡는다 |
| 4 | 승격 접두사가 `'win:'` **리터럴** 고정 (`KEY_PLATFORM`·`'mac:'` 금지) · `toLowerCase` 둘 |
| 5 | ★ 두 함수를 **실제로 돌려** 입력 19종의 답을 맞댄다 |
| 6 | 저장은 언제나 하나 — `keys` 배열을 쓰는 자리가 없다 · 로더 승격이 살아 있다 |
| 7 | 판정이 통로를 지난다 · 옛 직접 비교(`f.name === exeName`)가 없다 |
| 8 | 근거 주석이 **양쪽에** 남아 있다 |

★ 2절(문자열)과 5절(동작)을 **나눠 둔 것이 요점이다.** 2절만 두면 한쪽 지역 변수만 바꿔도
빨개지고, 5절만 두면 입력표에 없는 갈래가 어긋난 걸 못 본다.
⇒ **2절만 빨가면 겉모양만 갈린 것, 둘 다 빨가면 진짜 갈린 것.** 2절 실패 메시지가 그렇게 말한다.

### ⚠️ 만들면서 §4-⑧ 함정에 그대로 걸렸다 — 이 문서가 세 번째로 같은 것을 본다

첫 판이 7절에서 빨갰는데 진짜가 아니었다. `main.js:787` 주석에
«여기서 `f.name === exeName` 로 되돌리면 mac 에서 조용히 전부 미등록이 된다» 는 **경고문**이
있고, 7절이 **원문**에 정규식을 걸어 그 경고문을 우회로로 셌다.

§4-⑧ 이 「‘없어야 한다’ 검사를 원문에 걸면 `app.js` 주석의 인용문에 걸린다」고 적어 둔 그것이다.
`sim-overlay-gap`(§3 서문) · `audit.py` 검사 2(§4-⑤) · `sim-purikura-deco`(§4-③) 에 이어 **네 번째**다.
⇒ 문자열 추적형 `stripComments()` 를 넣고 **6·7절은 `code`, 8절은 `src`** 로 갈랐다.
파일 안 `stripComments` 주석에 실측 날짜와 함께 적어 뒀다.
★ `main.js` 는 본문의 **52% 가 주석**이다(§4-⑧ 표). `app.js` 의 29.8% 보다 높다.

### 헛돌지 않는 것 — `--selftest`

```
node sim-keysof-twin.js --selftest    변이 9종 주입 → 전부 잡힘 · 못 잡음 0
  우선순위 뒤바꿈 · KEY_PLATFORM 변수화 · 'mac:' 접두사 · toLowerCase 제거
  filter(Boolean) 제거 · name 갈래 삭제 · exe 갈래 삭제 · 로더 승격 제거
  f.name === exeName 부활
```

`_chalKeysOf` 를 개명하면 **실패가 아니라 `?`(검사못함) + 종료코드 2** 로 떨어지는 것도 확인했다 —
러너가 「원본 없음」과 같은 칸으로 가르므로 빨강에 안 섞인다.

⚠️ **이 검사는 `app.js` 를 읽는다.** `main.js` 만 있는 체크아웃에서는 못 돈다.
§2 의 두 갈래 중 `__dirname` 쪽이다 — 러너의 평면 스테이징이 그 전제를 만든다.

---

## 15. `sim-chat-fly.js` — 🌊 채팅 「날리기」(2026-09-16 · 개정 9 신규)

근거: `handoff-chat-fly.md` §3-6. 대상: `app.js` · `desk-companion-prototype.html` 두 파일 대조.

### 이 검사가 지키는 것 — 네 규약의 **짝**

이 기능은 새 규약을 만들지 않는다. **이미 있는 네 규약 위에 얹혀 있고**, 얹힌 자리마다
「나중에 한쪽만 고쳐지면 조용히 깨지는」 짝이 생겼다. 이 검사는 그 짝을 묶는 자리다.

| 규약 | 한쪽만 고쳐지면 | 어디서 묶는가 |
|---|---|---|
| 클릭 통과 | 글자가 마우스를 먹으면 **화면 위쪽 절반**이 먹통이 된다. 반대로 화이트리스트에 넣으면 전체화면 사각형이 들어가 회수 로직이 통째로 죽는다(`_uiRegions` 의 `pointer-events:none` 주석이 그 사고 기록이다) | §3 |
| 비활성 FPS | rAF 로 옮기면 **남의 화면에서만** 끊긴다. 내 화면은 멀쩡해서 못 알아챈다(`sim-unfocused-fps`) | §4 |
| 채널 | 조건이 `_activeChannel === 2` **한 줄**이라야 투게더룸+시크릿룸과 정확히 겹친다. 늘리면 `_chatDelRefreshUI` 쪽과 어긋난다 | §2 |
| 레벨 | Lv.200 판정이 보내는 쪽에만 있으면 값을 조작해 색을 쓸 수 있다 | §2 |

### 절 구성

```
§1 전송      payload 에 fly/flyColor · 안 쓰면 안 싣는다 · 연타 억제 · chatLog 로 안 도망갔다
§2 수신      채널을 본다 · 레벨을 받는 쪽에서 다시 본다 · 말풍선 분기와 갈라진다
§3 층·클릭통과 #flyLayer 가 pointer-events:none · 화이트리스트/창 z 목록에 없다 · z 층(60<z<70)
§4 움직임    @keyframes flyAcross · rAF·setInterval 없음 · animationend 로 지운다
§5 레인·상한 _flyPickLane 을 **오려서 40번 돌린다** — 12명 동시 → 12레인 · 순서가 매번 다르다
             · 흔들림이 레인을 안 침범한다 · 레인이 띠 안에 들어간다 · 동시 상한
§6 글자 모양 두 겹 테두리 · 「이름: 내용」 · 이스케이프 순서 · 색은 표에 있는 것만 · 세션 변수
             · 체크 줄이 입력칸 바로 아래(`.chat-input-col` 안)에 있는가
```

★ §5 는 텍스트로 보지 않는다. `_flyPickLane` 을 소스에서 오려 `new Function` 으로 돌리고,
같은 순간에 `FLY_LANES` 명이 날렸을 때 **레인이 실제로 흩어지는지** 센다. 상수를 바꾸면
검사도 그 값을 따라간다(하드코딩한 숫자가 아니다).

⚠️ 배정에 **무작위가 들어 있어서 한 번만 돌리면 운으로 통과한다.** 그래서 40번 돌려
둘을 함께 본다 — ① 매번 레인이 안 겹친다(빈 칸 중에서만 고르므로) ② 순서가 늘 같지는 않다
(무작위가 실제로 걸려 있다). ②가 없으면 «순서대로 돌리기» 로 되돌아가도 검사가 조용히 통과한다.

### 되돌리면 안 되는 것 — 띠의 자리 (2026-09-16 변경)

처음엔 **상단 40%** 였다. 근거는 「캐릭터·책상을 안 가린다」였다. 실제로 띄워 보니 글자가
위쪽에만 몰려 눈이 그쪽으로만 끌렸고, 같이 보는 영상은 대개 화면 가운데에 있다.
⇒ **화면 한가운데 기준 위아래 300px** 로 옮겼다. 8레인(높이의 1/8 간격) → 12레인 × 48px.

⚠️ 이 띠는 **캐릭터·책상 위를 지난다.** 그것이 의도다. 「캐릭터를 가린다」를 사고로 보고
상단으로 되돌리지 말 것 — §3 의 `calc(50vh - 300px)` 검사가 그 회귀를 막는 자리다.

### 되돌리면 안 되는 것 — 체크 줄의 자리 (2026-09-16 변경)

처음엔 `.chat-inputrow` **밖**의 형제였다. 근거는 「안에 넣으면 프로필 칸(74px) 옆에 끼어
줄이 깨진다」였다 — 맞는 말인데, 막은 것이 **직계 형제**뿐이었다.

화면에서 보니 프로필이 입력칸보다 키가 커서, 밖에 둔 체크 줄이 프로필 **아래**로 밀려나
입력칸과의 사이에 빈 띠가 생겼다. ⇒ `.chat-input-col` **안**, 입력칸 바로 다음으로 옮겼다.
프로필 옆에 나란히 서면서 빈 띠가 사라진다. 안내 문구(`#chatFlyHint`)도 같이 뺐다 —
체크박스와 색 고르개 사이를 벌려 놓기만 했고, 「날리기」가 이미 하는 설명이었다.

⚠️ `.chat-inputrow` 직계로 되돌리지 말 것. 두 자리가 다르다:
`.chat-inputrow` 직계 = 프로필과 **가로로** 나란히(입력칸 폭이 줄어든다) ·
`.chat-input-col` 안 = 입력칸과 **세로로** 이어짐(원하는 모양). §6 이 이 둘을 가른다.

### 「몇 초」가 아니라 「초당 몇 px」 (2026-09-16 · 값 네 번 헛돈 끝에)

횡단 시간을 5.5 → 6.5 → 7 → 8.5 초로 **네 번** 올렸는데 화면에서는 여전히 빨랐다.
원인은 값이 아니라 **단위**였다. 애니메이션이 「화면 폭 전체를 그 시간 안에 건너가라」는
뜻이라, 시간을 고정하면 **화면이 넓을수록 빨라진다.**

```
목업  1280px · 6.6초  ≈ 224 px/s   ← 적당하다고 정해진 기준
실기  1920px · 8.5초  ≈ 261 px/s   ← 초를 올렸는데 목업보다 빨랐다
실기  3840px · 8.5초  ≈ 487 px/s   ← 4K 면 목업의 두 배
```

⚠️ 더 나쁜 것은 **같은 방의 두 사람이 모니터가 다르면 같은 메시지를 다른 속도로 봤다**는 점이다.
한 명은 느긋하게 읽고 한 명은 놓치는데, 서로 왜 그런지 알 길이 없다. 값만 만져서는 절대 안 잡힌다.

⇒ `FLY_SPEED_PX_S = 220`(목업 6.6초의 그 속도). 시간은 「(화면 폭 + 글자 폭) ÷ 속도」로 역산한다.
1920 에서 10.1초, 3840 에서 18.8초가 나오지만 **눈에 보이는 속도는 어디서나 220 px/s** 다.
길이 보정(옛 `FLY_LEN_MS`)은 없앴다 — 긴 글은 자기 폭만큼 거리가 늘어 저절로 오래 걸린다.

★ 조절할 값이 **하나로 줄었다.** 「조금 느리게」는 220 을 200 으로 내리는 것 하나이고,
그 변화가 모든 모니터에 똑같이 간다. 초를 올렸다 내렸다 할 일이 없어진다.

★ 덤 — 모든 줄이 같은 속도라 **뒷줄이 앞줄을 따라잡지 못한다.** 예전엔 긴 글에 시간을 더 줘서
줄마다 속도가 달랐고, 같은 레인에서 앞줄을 밀고 들어올 수 있었다.

**§4 가 지키는 짝**: JS 가 재는 거리(`innerWidth + offsetWidth`)와 CSS 가 실제로 가는 거리
(`translateX(calc(-100vw - 100%))`)가 같아야 한다. 한쪽만 고치면 속도가 조용히 어긋난다.
폭 재기가 한 줄당 한 번인지도 본다 — 매 프레임 재면 그게 곧 rAF 이동과 같은 값이 된다.

### 크기 3단 — 「가장 큰 단」을 재야 한다 (2026-09-16)

대(27px) · 중(21px) · 소(16px) 단추가 붙었다. 색과 달리 **레벨 문턱이 없다** — 크기는
읽기 편하자고 있는 것이지 치장이 아니다. 레벨 판정이 색에만 걸려 있는지 §2 가 본다.

한 화면에 세 크기가 **섞여** 흐르므로, 레인 칸은 늘 **제일 큰 단**을 담아야 한다.
⇒ §5 의 계산이 «대의 크기» 가 아니라 «`.fly` 계열 font-size 전부의 최대값» 을 쓴다.
27px 보다 큰 단을 나중에 늘리면 `FLY_LANE_PX` 를 안 올린 그 자리에서 빨강이 뜬다.

테두리도 단을 따라간다(4·3·2px). 27px 에 맞춘 4px 을 16px 글자에 그대로 쓰면 선이 글자를
먹어 한글 획이 붙는다. §5 가 «글자가 작을수록 테두리도 얇다» 를 단별로 확인한다.

`chat.flySize` 는 **기본값(대)일 때 안 실린다** — `flyColor` 와 같은 규칙이고,
받는 쪽은 「없으면 대」로 읽는다. 규칙 144 에도 2자 이하 문자열 검사를 같이 넣었다.

### 두 파일에 갈린 값 — 글자 크기와 레인 높이

같은 날 글자를 18px → **27px(1.5배)** 로 키우면서 레인도 48px → 64px, 12칸 → 9칸으로 바꿨다.
문제는 이 둘이 **다른 파일에 산다**는 것이다:

```
글자 크기   desk-companion-prototype.html   .fly { font: 700 27px/1.2 … }
레인 높이   app.js                          const FLY_LANE_PX = 64
```

한쪽만 키우면 그 순간 **조용히 줄이 겹친다.** 화면을 봐야 알고, 사람이 둘 동시에 날려 봐야 보인다.
⇒ §5 가 두 파일에서 값을 꺼내 «레인 높이 ≥ 글자×1.2 + 테두리×2 + 흔들림×2» 를 계산한다.
`sim-win-layers` 가 창 층을 두 파일에서 맞대어 보는 것과 같은 자리다.

⚠️ 「읽히는가」는 여기서 못 본다 — 밝은 영상 위, 어두운 영상 위, 이모티콘이 섞인 줄은
**눈으로 볼 것.** 이 검사가 지키는 것은 규약뿐이다.

---

## 16. `sim-slot-sync.js` — ☁️ 슬롯(캐릭터) 기기 간 동기화 (2026-09-16 · 개정 10 신규)

**제보 6-b** 「캐릭터가 집 PC 에 없음」. 고장이 아니라 기능 부재였다 — 슬롯은 localStorage 에만 있고
`users/{uid}` 에 노드가 없었다. 이번에 `users/{uid}/slots = { ts, v, s:{ "0":json … } }` 가 생겼다.

| 절 | 무엇을 지키나 | 방식 |
|---|---|---|
| 1 | `firebase-init.js` — `loadSlotsTs`(ts 한 값) · `loadSlotsRemote` · `saveSlotsRemote`(auth 대기선 뒤 통째 set) · `uploadSlotGlb` | 정적 |
| 2 | 규칙 파일 `users/$userId/slots` — gacha 와 같은 `.write` · 칸 문자열 150000자 상한 · `data:…;base64,` 거부 | JSON 읽어 대조 |
| 3 | 병합 진리표 — ① 서버 비움+로컬 있음 → 부팅 자동 push(결정 A) ② 서버 최신 → adopt(localStorage·메모리·ts) + 되저장 핑퐁 0 ③ 로컬 최신 → push ④ 연동 pull ⑤ 생성기 열림 → 건너뜀 ⑥ `_imgBroken` 칸은 원본이 올라감 ⑦ saveSlots 는 바뀐 저장만 ts·push | app.js 본문을 떼어 스텁 위에서 실행 |
| 3-⑪ | 🖼️ **되받기**(개정 26) — 되받기가 캔버스를 안 거친다 · 256·1024 가 그 크기로 돌아온다 · dataURL 이 한 바이트도 안 변한다 · 크기를 못 읽으면 512 · 실패는 던진다 | 실행 |
| 3-⑩ | 🔑 **내용 해시**(개정 25) — 옛 해시로 충돌하던 두 그림이 다른 파일 이름을 받는다 · 결정적 · 접두어 `h2` · 상한을 넘으면 구형부터 버린다 · 업로더는 새 키 하나만 본다 · `uploadPartPic` 도 같은 캐시 | 실행 |
| 3-⑨ | 🛟 **덮어쓰기 백업**(개정 24) — 덮기 직전 저장본 한 벌 · «안 남기는 경우» 셋(빈 로컬·같은 내용·더 큰 백업) · 되돌리기는 맞바꾸기 + `_slotsTouch()` · uid 대조 · 백업 실패해도 채택은 돈다 · **토스트는 그대로** | 실행 |
| 4 | 배선 — `_restoreOwnedDataAfterTransfer` 가 가챠 pull 다음에 슬롯 pull · 부팅 4.6초 · 30분 주기 · 방 입장과 같은 얼굴 캐시/키 | 정적 |

★ 서버 페이로드에 dataURL·thumb·GLB 원문이 한 바이트도 없다는 것을 3-①·② 가 실제 문자열로 본다.
★ 스텁의 `_quickHash` 는 7칸 간격 표본이라, 검사용 dataURL 은 태그를 문자열 전체에 펼쳐야 서로 다른
  그림으로 잡힌다(`D()` 주석). 접미사만 다르게 만들면 같은 파일로 합쳐져 업로드 수가 안 맞는다.

★ **⑨ (개정 24 · 제보 3-7).** 이 검사가 원래 지키던 것은 「받아오는가」였고, 제보 3-7 은 「받아오면서
  **덮는다**」였다 — 같은 함수의 반대쪽 얼굴이라 같은 파일에 두었다(새 검사를 만들면 둘이 따로 늙는다).
  ⚠️ 백업의 적은 «백업이 없는 것» 이 아니라 «백업이 방금 덮인 것» 이다. 5칸을 잃은 그 기기에서 같은
  내용으로 pull 이 한 번만 더 돌아도 백업이 1칸으로 갈아 끼워지면 아무것도 못 되돌린다 — ⑨ 가 그
  두 길(같은 내용 재채택 · 더 작은 값으로의 교체)을 각각 막아 둔다.
  ⚠️ `_quickHash` 충돌(제보 3-7 (나) 그래픽 밀림)은 **개정 25 에서 ⑩ 으로 들어왔다.** 확정 자료(`faceUrl`
  대조)를 기다리지 않고 고친 이유: 표본 1/7 로 파일 이름을 만드는 것은 그 제보와 무관하게 틀렸고,
  고치는 값(전수 스캔)이 5 MB 에 32 ms 다. 자료가 오면 **그 제보가 이 원인이었는지**만 가려진다 —
  고칠 것이 더 생기지는 않는다.

---

## 17. `sim-room-channel.js` — 🚪 방 채널 표지 복구 (2026-09-16 · 개정 11 신규)

**제보 2** 「투게더룸인데 초대받은 사람에게 채팅창이 안 뜬다 · 방장도 나갔다 들어오니 안 뜬다」.
실제 방 `COZY-42W5` 의 서버 트리에 **`_meta` 가 없었다**(chatLog + 멤버 2개만).

| 절 | 무엇을 지키나 |
|---|---|
| 1 | `getRoomChannelEx` 가 «있음 / 표지 없음(channel:null) / 읽기 실패(null)» 셋을 가른다. 옛 `getRoomChannel` 은 셋을 둘로 뭉갠다 — 구버전 폴백으로만 남긴다 |
| 2 | `recoverRoomChannel` — **트랜잭션 콜백을 실제로 돌려 본다.** 채널이 있으면 중단(보유/미보유 양쪽), 없을 때만 세운다. 방장은 비었을 때만. `openTs` 안 씀 |
| 3 | 입장 분기 — 표지 있음 → 그대로 · 없음 → 복구 · **읽기 실패 → 아무것도 안 함** |
| 4 | 퇴장 정리(`_finalCleanup`)는 그대로. 복구가 그것을 대신하지 않는다 |
| 5 | (개정 125) `room-channel.js` — `PLAY-`·`SCRT-` → 투게더룸, `WORK-` → 워킹룸, 옛 `COZY-` 만 라이선스로. 2절 뒷부분이 `PLAY-` + 무료 사용자 → 투게더룸 · 방장 비움을 실제로 돌려 본다 |
| 6 | `_maybeSucceedHost` — 승계 · 해산 규칙은 `room-channel.js` `hostSuccession` 한 곳. 방장 칸이 빈 방은 대상이 아니다. 투게더룸은 방장이 나갔고 보유자가 없으면 해산 · 있으면 그 보유자가 이어받는다. 워킹룸은 입장순 첫 사람이 이어받고 해산하지 않는다(6-2 · 6-3절). 표지 없는 채널 · 시크릿룸은 안 한다 |
| 7 | (개정 125) app.js `_onRoomMeta` — Firebase 방도 `_meta.channel` 이 바뀌면 `_activeChannel` 이 따라간다. null · channel 없음은 그대로 둔다 |

**2026-10-10 제보** 「업데이트 후 플레이룸에서 몇 명만 채팅 대신 이모티콘 버튼 · 튕김 · 다시 들어와도 그대로」.
운영 `PLAY-FVNJ` 의 `_meta` 가 `{channel:'workingroom', host:<무료 사용자>}`(openTs 없음 = 복구가 쓴 값)였다.
표지를 잃은 PLAY- 방에 무료 사용자가 먼저 들어와 워킹룸으로 굳혔고, 입장 때 한 번만 채널을 정하는 탓에 먼저 있던 사람만 채팅을 유지했다.

★ 3절의 마지막 줄이 이 검사의 핵심이다 — 복구를 `claimEmptyRoom` 으로 바꾸면 **있는 채널도 덮어써서**
  미보유자가 들어오는 것만으로 남의 투게더룸이 워킹룸이 된다. 문자열로 그 호출을 금지한다.
⚠️ 2절은 콜백 본문을 `new Function` 으로 다시 짠다 — 화살표 함수를 문자열로 자르면 꼬리 괄호가 어긋난다(한 번 밟았다).

## 18. `sim-account-switch.js` — 🧹 같은 PC 계정 전환 시 소지품 정리 (2026-09-16 · 개정 12 신규)

**제보 4** 「친구 노트북에서 친구를 로그아웃하고 내 계정으로 들어갔더니 나에게 프리미엄이 열리고,
친구로 돌아가니 친구 레벨이 1 → 51 이 되고 내 가챠가 친구 것이 됐다」.
로그아웃이 지우던 것은 **신원 6개뿐**이었다 — 라이선스·누적시간·가챠·슬롯·플레이리스트가 다 남았다.

| 절 | 무엇을 지키나 |
|---|---|
| 1 | `ACCOUNT_LOCAL_KEYS` **한 벌**에 제보의 다섯 자리가 다 있다. 로그아웃(`_loginDoLogout`)·연동 해제(`acctUnlinkYes`)가 같은 `_detachAccountLocal` 을 부르고, 해제 쪽에 따로 적힌 `removeItem` 이 없다. signOut 은 검문 **뒤** |
| 2 | 본문을 떼어 와 돌린다 — 지운 뒤 목록의 키 0개 · 접두어 키(`tw_chat_read:`)도 지움 · 테마·볼륨·카탈로그·프리셋은 남음 · 메모리(누적·가챠·달성표 dirty·슬롯 ts·플레이리스트 지문)도 비움. **검문**: 서버 ts 0 인 캐릭터 · 서버에 없는 가챠 · 마크가 2분 넘게 뒤처진 시간 · 읽기 실패(null) · firebaseAPI 없음 → 전부 `ok:false` 에 **아무것도 안 지운다** |
| 3 | `syncFocusTotalToServer` — `_acctDetached` 검사가 `getMyUserId()` **앞**에 있고, 놓은 뒤 'quit' 호출은 uid 발급 0 · 서버 호출 0. 평소(boot)는 예전 그대로 돈다(`sim-focus-sync.js` 를 흔들지 않는다) |
| 4 | 플레이리스트 — `fetchMyPlaylistSets`(firebase-init)가 세 벌을 그대로 돌려주고, `_restoreOwnedDataAfterTransfer` 가 세 벌을 다 앉힌다(빈 벌은 빈 채로 · 지문을 맞춰 헛쓰기 0). 저쪽이 비었으면 이 기기 것을 올린다 |
| 5 | `_danceUnlockPending` — 기록이 지워져도 수령함에 우편이 있으면 다시 안 보내고 기록만 찍는다. 새 계정(우편 없음)이면 보낸다. 수령함이 아직 안 왔으면 예전처럼 보낸다 |

★ 2절의 검문이 이 수정의 안전장치다 — 지우기 **전에** 올리고(`_acctFlushToServer`, 8초 상한), 올라갔는지 확인한 뒤 지운다.
  검문을 빼면 «비밀번호 연동만 한 기기»(쓰기가 조용히 거부되는 상태)에서 로그아웃이 곧 삭제가 된다.
⚠️ 2절 ④ 는 `mkEnv` 의 flush 스텁(마크=누적으로 맞춤)을 쓰지 않는다 — 거부된 기기를 흉내 내려면 마크를 안 옮기는 flush 가 필요해서 따로 짠다.

## 19. `sim-pk-fit.js` — 📏 스티커사진 무대 · 파츠는 키에 안 들어간다 (2026-09-16 · 개정 13 신규)

**제보 5** 「일부 머리 파츠를 쓰면 스티커사진에서 캐릭터가 작아진다」. 무대가 키 CHAR_H 의 분모를 «보이는 메시 전부»로
재서 뿔·모자가 클수록 더 줄였다. 실행 화면(measureCharBox)은 파츠 래퍼 하위를 빼는데 무대만 안 따랐다.

| 절 | 무엇을 지키나 |
|---|---|
| 1 | 소스 — `_pkVisibleBox(g, noParts)` · 표식은 **이름**(`__partWrap_`, 복제본엔 userData 가 없다) · 파츠 밑 스킨드메시는 늘 뺌 · 배선: 키·좌우 중심은 noParts 상자, 발밑은 전체 상자, 상한, 재기 전 회전 0 |
| 2 | **가짜 THREE(균일 배율+평행이동)** 위에서 `_pkVisibleBox` 와 `_pkCloneChar` 의 맞춤 블록을 실제로 돌린다 — 뿔(+0.6)·날개(+3 옆)·동물 모두 맨몸과 **같은 배율** · 뿔은 그려짐 · 욕조(−0.3)는 바닥에 닿음 · −5 파츠는 CHAR_H 에서 멈춤 · 숨은 placeholder(2.5)·파츠 밑 스킨드메시(−4) 제외 · 보이는 것 없으면 setFromObject |

★ `purikura-net.js` 가 없으면 CHAR_H=1.7·ANIMAL_H=1.15 기본값으로 돈다 — 판정이 전부 비율이라 값이 달라도 규칙은 같다.
⚠️ 변이 검사: `const bb = _pkVisibleBox(g, true)` 를 `false` 로 되돌리면 2절 ②③④⑨ 가 빨개진다(8 빨강). 초록이 곧 이빨이다.

## 20. `sim-ui-zoom.js` — 🔍 전체 화면 크기(렌더러 줌) 한 통로 (2026-09-16 · 개정 14 신규)

**제보 3-2 (F-1)** 확대/축소 통로가 둘 — 캐릭터 탭 «화면 크기»(아바타존만)와 우리 코드에 없는 일렉트론 기본 줌
가속기(렌더러 전체). 후자는 몇 %인지 알 길도 되돌릴 기준도 없었다. 시안(2026-09-16 확정)대로 설정 › 화면표시 ›
«창 위치 초기화» 아래에 `[화면 −] 100% [화면 +] [초기화]` 행을 두고, 값은 `main.js applyUiZoom` 한 곳에 모았다.

| 절 | 무엇을 지키나 |
|---|---|
| 1 | `setZoomFactor` 호출은 applyUiZoom 안 **한 곳뿐** · before-input-event 가 Ctrl(+Shift)+= / − / 0 을 가로채 그리로 · zoom-changed(Ctrl+휠)도 막고 그리로 · did-finish-load 뒤 복원 · tw-settings.json 저장/복원(clamp) · IPC `companion:uiZoom` |
| 2 | **좌표계** — setCharBounds(캐릭터 원·창 사각형)는 × z, _sendHitTest 는 ÷ z. 이게 빠지면 줌만 켜도 클릭 통과 판정(ⓕ·ⓖ·펜 근접)이 z 배 어긋난다 — 제보 3-1 의 «넓은 영역이 클릭을 먹는다» 와 같은 모양이 줌만으로 난다 |
| 3 | 본문 실행 — 10% 단계 · 50~200% · reset=100% · 값이 안 바뀌면 저장 안 함 · 키 판정(=·+·−·_·0·숫자패드·Cmd) · Alt/keyUp/다른 키는 안 잡음 · 150% 에서 100px↔150px · 100% 항등 |
| 4 | preload 채널 둘 · HTML 행이 «창 위치 초기화» 바로 아래, fs-toggle-btn 셋 + 배율 숫자, 숨긴 채 시작 · app.js 는 숫자를 받아서 보여 주기만(줌을 직접 안 만진다) · 구버전 preload 면 행 숨김 · 캐릭터 탭 «화면 크기»는 그대로 |

★ 3절 마지막 줄(100% 항등)이 이 수정의 안전선이다 — 줌을 안 쓰는 사람은 한 픽셀도 안 바뀐다.

## 21. `sim-wheel-kick.js` — 🛞 휠은 고착 회복 사다리를 안 탄다 (2026-09-17 · 개정 15 신규)

**제보 3-1 (C)** 「캐릭터 옆 여백에 커서를 두면 뒤의 크롬이 스크롤·클릭이 안 된다 · 다른 모니터로 갔다 오면 풀린다」.
제보자 진단 로그(09-15~17)에서 원인이 확정됐다: `이유=kick3` 212건 중 **206건이 커서가 다른 모니터에 있을 때**(chrome 205건),
나머지는 커서가 캐릭터 옆 여백에 **고정**(1327,782)된 채 3초 간격 셋. 전부 크롬 스크롤 중이다.
전역 휠이 클릭과 같은 채널·같은 모양으로 렌더러에 가서, 사다리(`__mouseKick`)가 «mousemove 3초 없음 = 통로가 죽었다» 로 읽고
1.5초마다 3단계(0.8초 클릭받기)를 반복했다 — 그 0.8초마다 투명 전체화면 창이 휠·클릭을 먹는다. 마우스를 움직이면 단계가 0 으로
풀리므로 «갔다 오면 풀린다». `offOverlay` 는 클릭 페이로드에만 있어서 다른 모니터 스크롤도 못 막았다.

| 절 | 무엇을 지키나 |
|---|---|
| 1 | `main.js _onGlobalWheel` — 페이로드에 `wheel:true` + `offOverlay`(클릭과 같은 계산). 채널은 그대로. 실제로 돌려 200ms 솎기까지 본다 |
| 2 | `app.js onGlobalClick` — `wheel === true` 면 `__mouseKick` 을 안 부른다. 활동 기록(anyInput·activity)은 그대로. 구버전 main(필드 없음)이면 예전처럼 탄다. 실제로 돌려 클릭/휠/구버전 셋을 가른다 |

★ 새 채널을 파지 않는다 — 필드 하나를 얹는 규약(offOverlay 와 같다). 구버전 조합 어느 쪽도 지금보다 나빠지지 않는다.

---

## 22. `sim-admin-active.js` — 🛡️ 관리자 권한 창도 판정한다 · 훅 수신 진단 (2026-09-17 · 개정 16 신규)

**E 추가 제보** 「관리자 권한 게임 클라이언트를 등록했는데 캐릭터는 포커싱 포즈(움직이고 안 졸음)인데 **타이머가 안 쌓인다.**
창모드도 같다. 인식 안 되는 게임클라 → 브라우저 클릭 → 다시 게임클라로 오면 캐릭터는 포커싱인데 카운팅 없음.」

원인은 코드에서 확정됐다. node-window-manager 의 `path` 는 OpenProcess(QUERY_INFORMATION|VM_READ)+GetModuleFileNameEx 로 읽는데,
일반 권한인 우리 앱은 **관리자 권한 프로세스를 못 열어** `path` 가 빈 문자열로 온다 → `sysinput.getActiveWindow` 가 null →
main.js 폴링이 «활성 창 판정 실패» 로 일찍 return → `activeAppState` 가 안 나가 렌더러의 누적 tick(`_applyActiveAppState`)이 서는데,
커서 이동 신호(`_reportCursorActivity`)는 finally 에서 계속 나가고 렌더러 상태는 직전 창(브라우저=등록)으로 굳어 있어 **캐릭터만 포커싱**.
핸드오프 §9-2 의 «훅 미수신» 가설은 이것과 **별개로** 여전히 살아 있다(관리자 권한 창 앞에서 일반 권한 저수준 훅은 UIPI 에 막힌다) —
그래서 진단 줄도 같이 넣었다.

| 절 | 무엇을 지키나 |
|---|---|
| 1 | `sysinput-win.js getActiveWindow` — 경로가 비면 pid 로 `tasklist /FO CSV /NH` 이름을 받아 `{owner:{path:'', name}}`. path 는 빈 채로. 캐시(같은 pid 반복 0회)·재조회 2초 상한·미스 30초·겹침 합침·실패 기록 1회. 가짜 windowManager·가짜 child_process 위에서 실제로 돌린다 |
| 2 | `sysinput-win.js listWindows` — 경로 없는 창도 이름으로 목록에 오른다(예전엔 통째로 빠져 «목록에 게임이 안 뜬다»). 같은 exe 는 이름 키로 한 줄. `main.js setFocusApp` 의 «path 없으면 name 으로 키» 길이 살아 있다 |
| 3 | `main.js` — `[활성]` 줄에 `경로=없음(관리자권한)` 표식 · `[입력]` 1분 진단(등록 앱 앞에서만 · 클릭·휠·키·커서이동 카운터 · 훅 0 이면 `⚠️훅 미수신`) · 카운트는 `startGlobalHooks` 등록 자리에서 감싸 센다(핸들러 본문 무변경) · 새 타이머 0(500ms 폴링 finally) · 실제로 돌려 본다 |
| 4 | `sysinput-mac.js` 내보내기 이름이 win 과 같다 · mac 에 tasklist 없음 |

★ 변이 검사: `sysinput-win.js` 를 원본으로 되돌리면 14 빨강, `main.js` 를 되돌리면 6 빨강.
★ `sim-sysinput.js` 1절의 접촉면 8곳은 그대로다 — tasklist 는 `windowManager` 를 우회하는 게 아니라 **없는 값을 보충**한다.
⚠️ 남은 갈래: 키보드만 쓰는 관리자 권한 게임은 훅이 막혀 여전히 안 쌓인다. `[입력]` 줄에 «등록=예 · 훅 0 · 커서이동>0» 이 찍히면 그것이다.
   그때의 선택지는 (a) 관리자 권한으로 실행 안내 (b) `_reportCursorActivity` 만으로는 부족하므로 별건 — 코드로는 아직 안 정했다.

---

## 23. `sim-room-order.js` — 🕒 입장순은 서버 시계로 · 시크릿룸 옛 uid 는 말해 준다 (2026-09-17 · 개정 17 신규)

**제보 2** 「방에 가만히 있었는데 누군가 입장하면 '같은 순간에…' 멘트와 함께 쫓겨난다」.
정원 초과 자기 퇴장(firebase-init.js 방 리스너)은 «memberId 오름차순 = 입장순» 으로 늦게 온 사람을 가르는데, memberId 앞부분이
**각자 PC 의 Date.now** 였다. 제보자 시계가 앞서 있으면 나중에 온 사람의 id 가 더 작아, 방이 찰 때마다 먼저 앉아 있던 제보자가
«늦게 온 사람» 으로 계산된다. 이미 있던 `.info/serverTimeOffset` 보정(`_svNow`)으로 id 를 만든다 — 형식·정렬 로직·구버전 호환 그대로.

**제보 4** 「관리자 모드에서 시크릿룸 전달 시 방장 부여가 안 되는 경우가 있음」.
계정 이전 뒤 `friendCodes/{코드}` 는 옛 uid 를 가리키고, 되찾기(`_healFriendCodeOwner`)와 관리자 7일 게이트가 **같은 7일**을 기다린다 —
그 사이 친구코드로 발급하면 `pub.owner` 가 옛 uid. 관리자 화면에 거울(`users/{uid}/friendCode`) 대조 경고를 더하고,
받는 쪽 입장 게이트는 owner 가 내가 버린 uid 면 «재발급 요청» 토스트를 띄운다(방장으로 쳐 주지는 않는다 — 방 전원이 같은 문자열로 판정).

| 절 | 무엇을 지키나 |
|---|---|
| 1 | `joinRoom` memberId = `'m' + _svNow().toString(36) + …`. 시계 5분 앞선 «먼저 온 사람» 모형으로 보정 전/후 정렬을 실제로 돌린다 |
| 2 | 관리자 발급: `getUserFriendCode(uid)` 거울이 입력 코드와 다르면 7일 게이트와 같은 «한 번 더 누르기». 조회 실패는 경고 안 함 |
| 3 | `startRoom`: `_isMyPrevUserId(pub.owner)` 면 안내 토스트. `_iAmSrOwner` 판정은 그대로 |

---

## 24. `sim-device-session.js` — 🖥️ 한 계정 한 기기 (2026-09-17 · 개정 18 신규)

**제보 3** 「서브 PC 와 기본 PC 둘 다 로그인해 두면 투게더룸·워킹룸에 다중 접속이 된다. 한쪽에 로그인하면 다른 쪽은 풀리거나 접속이 막혔으면」.
`users/{uid}/presence` 는 계정당 하나인데 두 기기가 각자 쓰고 각자 onDisconnect 를 걸었다 — 제보 ②(오프라인으로 둔 계정이 온라인으로 뜸)도 여기서 난다.

**구조** `users/{uid}/session = { id, at }`. 부팅(initMyHome, presence 등록 직후) 때 claim 하고 구독. 남의 id 가 오면 **밀려난 기기**:
방에서 나오고(doLeaveRoom) · presence onDisconnect 를 거두고 · `#deviceSessionOverlay`(시안 왼쪽) · `startRoom` 첫 줄에서 입장 차단.
«여기서 계속 쓰기» = 재claim + presence 재등록 → 반대쪽이 밀린다. «앱 닫기» = quitApp.
★ **로그아웃이 아니다.** 신원·소지품 그대로. 로그아웃의 올리고→검문→지움을 원격 신호로 돌리면 검문에 걸린 기기가 반쯤 남는다.
★ 로그인 계정만 대상(auth.currentUser 없으면 false). 로그아웃·연동 해제(`_detachAccountLocal`)가 내 것일 때만 트랜잭션으로 지운다.

**규칙** — `firebase-database-rules.json` `users/$userId/session` 에 넣었다(게시 필요). presence 와 달리 «미연동 기기 허용» 갈래가 없다 — 대상이 로그인 계정뿐이라서.
삭제(release 트랜잭션)가 통과하도록 `.validate` 는 `!newData.exists() || …` 로 시작한다 — 없으면 로그아웃 때 세션이 안 지워져 다음 로그인 기기가 «남의 세션» 을 보고 헛되이 밀린다.

| 절 | 무엇을 지키나 |
|---|---|
| 1 | firebase-init.js 세 메서드를 가짜 SDK 위에서 실행: 미로그인 false · 내 id 무시 · 빈 값 무시 · 남의 id 면 onLost 1회 + onDisconnect cancel · release 는 내 것만(트랜잭션) · 쓰기 거부면 false·구독 없음 |
| 2 | app.js: claim 자리 · 밀림 처리에 로그아웃/지움 호출 없음 · 계속 쓰기 배선 · startRoom 첫 줄 · `_detachAccountLocal` 의 release · UI_HIT_SEL 등록 |
| 3 | HTML: 숨긴 채 시작 · 버튼 둘 · 시안 문구 · «로그아웃» 이라는 말 없음 |

---

## 25. `sim-deco-parts.js` — 🎁 꾸미기 파츠 표시 켜짐/꺼짐 (2026-09-17 · 개정 19 신규)

**요청** 「설정 › 캐릭터 «좌석 크기 평준화» 아래에 꾸미기 파츠 켜짐/꺼짐. 꺼짐이면 내 화면에서만 나 포함 상대의 꾸미기 파츠가 안 보이게. 파츠 보관함의 가챠 파츠만 — 책상 설정의 책상 아이템은 그대로.」

**구조** `decoPartsVisible`(tw.decoParts, 기본 켜짐). 캐릭터에 붙는 파츠 wrapper(`__twPartWrap`)의 `visible` 만 내린다 — 일반·겹치기·다중 인스턴스 전부.
책상 위(`bone:'desk'`) 카테고리는 예외. 메시는 안 건드리므로 자리비움(`setSeatOpacity`·`_prevVisible`)과 안 섞이고, 파츠 애니·스티커사진 키 계산도 그대로.
★ **hides 되돌림** — 꺼짐이면 `applyClothVisibility` 가 «파츠 없음» 으로 계산해 파츠가 숨기던 기본 메시(머리카락·기본 상의)를 되돌린다. 이게 없으면 모자만 사라진 대머리가 된다.
적용 자리는 `applyClothVisibility` 안 — 부착·해제·좌석 재조립 뒤 늘 지나는 자리라 새로 붙는 파츠도 설정을 따른다. 서버에는 아무것도 안 쓴다.

| 절 | 무엇을 지키나 |
|---|---|
| 1 | 기본 켜짐·저장 키 · `_decoWrapperShow`/`applyDecoPartsVisibility` 를 가짜 좌석에서 실행: 꺼짐이면 모자·날개 숨김, 책상 위는 보임, 표식 없는 오브젝트는 안 건드림 |
| 2 | `applyClothVisibility`: wrapper 적용이 안에 있고 hides 계산 앞 · 꺼짐이면 `eq = {}` · 부착 끝의 기존 호출 줄 유지 |
| 3 | 토글: 뒤집고 저장 · 전 좌석 재적용 · 서버 쓰기 없음 · refreshToggleBtns · HTML 행이 평준화 바로 아래 · 이름·기본값·안내 |

⚠️ 꾸미기 창 미리보기(`wdPreviewBase`)는 좌석이 아니라 영향 없다 — 뭘 입히는지는 봐야 한다. 스티커사진은 좌석을 복제하므로 꺼진 채 찍으면 파츠 없이 찍힌다(내 화면 설정이 사진에도 따라간다).

---

## 26. `sim-mhd-envsub.js` — 🖥️ 마이홈 «환경 설정» 서브메뉴가 옆으로 흘러감 (2026-09-17 · 개정 20 신규)

**제보** 「마이홈 바탕화면 영역의 환경 설정을 누르고 글자 크기·브금 메뉴에 마우스를 대면 서브메뉴가 막 옆으로 움직인다.」

**원인** `myhome-desktop.js` 의 `addEnvMenu` 펼침 칸 클래스가 `.fly` 였다. `desk-companion-prototype.html` 의 채팅 「날리기」 전역 규칙
`.fly{position:absolute;left:100%;pointer-events:none;font:700 27px …;animation:flyAcross …}` 가 그대로 얹혀, 펼칠 때마다 서브메뉴가 흐르는 자막처럼 왼쪽 밖으로 날아갔다(클릭도 통과). 날리기가 들어온 뒤부터 난 사고.

**고침** 마이홈 쪽을 `mhd-fly` 로 바꿨다(CSS 3줄 · 마크업 · 셀렉터 2곳). 날리기 쪽 `.fly` 는 `sim-chat-fly` 가 규칙 문자열을 붙잡고 있으므로 건드리지 않는다.
★ 앞으로 새 UI 에 `fly`·`fsz` 같은 날리기 클래스 이름을 쓰지 말 것 — 전역이다.

| 절 | 무엇을 지키나 |
|---|---|
| 1 | myhome-desktop.js 에 맨 `.fly` 셀렉터·`class="fly"` 가 없다 · CSS/마크업/셀렉터/선택 표시가 모두 `mhd-fly` |
| 2 | 전제: HTML 전역 `.fly` 가 flyAcross·클릭 통과다(이 검사가 지키는 이유가 아직 살아 있는지) |

옛 판에 돌리면 1절 6개가 빨강이 된다(확인함).

---

## 27. `sim-font-hangul.js` — 🔤 기본 테마·말풍선 한글 폰트가 바뀜 (2026-09-17 · 개정 20 신규)

**제보** 「이전에 쓰던 것과 다른 폰트로 바뀐 것 같다」 — 기본 테마와 머리 위 말풍선. 대화창은 그대로.

**원인** 코드의 폰트 값은 9/14 이후 한 번도 안 바뀌었다(`git log -S"--win-font:"` 는 일괄 커밋 `500cf49` 하나뿐). 바뀐 것은 **Electron 31 → 44 (9/15 package.json)** 다.
Tahoma 에는 한글 글자가 없어서 한글은 브라우저가 고른 대체 폰트로 그려지는데, 그 선택이 바뀌었다. 예전엔 맑은 고딕이었다(app.js 말풍선 주석 「Tahoma→맑은 고딕」).
대화창(`#chatWindow`)만 멀쩡했던 것은 처음부터 `'Malgun Gothic'` 을 적어 두었기 때문 — 원인을 가르는 대조군이 됐다.

**고침** Tahoma 로 시작하는 폰트 목록마다 Tahoma **바로 뒤**에 Malgun Gothic 을 넣었다 — HTML 111곳(인라인 103 · 규칙 8) · app.js 14곳(자식 창 `var(--win-font,…)` 폴백 포함) · mallang.js 1곳.
영문은 여전히 Tahoma 가 먼저라 모양이 안 바뀐다. JS 문자열 안은 `"Malgun Gothic"`, HTML 은 `'Malgun Gothic'`(규칙 안 `font:` 줄임형은 원래 따옴표를 따라 `"…"`).
예외 둘: 버블 테마 `--win-font`(돋움이 먼저라 한글이 이미 정해짐 — 안 건드림) · app.js 15169 이모지 전용 목록.
자식 창(방명록·디자인)은 `THEME_CHILD_TOKENS` 로 부모의 `--win-font` 값을 받으므로 159행 수정으로 같이 따라온다.

| 절 | 무엇을 지키나 |
|---|---|
| 1 | HTML·app.js·(있으면) mallang.js·myhome-desktop.js 의 주석 밖 `font`/`font-family` 선언 중 Tahoma 가 든 것은 전부 한글 폰트(맑은 고딕·돋움)를 함께 적는다 · 이모지 목록 예외 |
| 2 | 기본 `--win-font` = Tahoma 다음 맑은 고딕 · 버블은 돋움 먼저 · 말풍선 15px · 이름표 · 대화창 |

⚠ 새 UI 에 `font-family:Tahoma,sans-serif` 를 그대로 쓰지 말 것 — 되도록 `var(--win-font)` 를 쓰고, 꼭 적어야 하면 한글 폰트를 붙인다. 옛 판에 돌리면 6개가 빨강(확인함).

---

## 28. `sim-chat-sfx.js` — 🔔 채팅 알림음 · 글자 크기 ▶ (2026-09-17 · 개정 20 신규)

**요청** 대화창 [설정]에 «알림음» 켜짐/꺼짐 — 켜짐이면 소리 3종(알림음 1·알림음 2·알림음 3, ▷ 미리듣기) 줄이 나타나고 꺼짐이면 사라진다. «글자 크기» 를 «글자 크기 ▶» 로 바꿔 마우스를 올리면 옆으로 4단. 시안 승인 후 구현.
결정: **대화창이 열려 있으면(최소화 포함) 안 울림** — 처음엔 «입력칸 포커스일 때만» 이었다가 커밋 전에 바뀌었다 · ▷ 는 듣기만(고르지 않음) · 기본 켜짐/알림음 1(`CHAT_SFX_DEFAULT_*`).

**구조** 소리 파일은 `app/parts/chat-notify-1~3.mp3`. 풀은 `_mkSndPool` 로 소리마다 하나, **prime 등록보다 먼저** 만든다(once:true — 늦게 만든 풀은 자동재생 잠금이 안 풀린다).
울리는 자리는 `syncFriendSeats` 의 상대 채팅 분기 한 곳 — 날리기·말풍선이 **실제로 뜬 경우에만**(`_chatShown`). friends 에 내 좌석이 없으니 내 메시지엔 안 울리고, chatLog 구독에는 걸지 않는다(한 줄 두 번 방지).
게이트: 꺼짐 · `_chatWinOpen()`(#chatOverlay 의 display 가 none 이 아님 — 여는 곳 block · 닫는 곳 closeChatWindow 의 none) · 250ms 간격 · 회사원 모드(풀 안).
서브메뉴는 **CSS :hover** 로 연다(`.chat-has-sub:hover > .chat-submenu`, `left:100%` 틈 없음). 오른쪽 끝이면 들어올 때 한 번 재서 `.flip`. 눌러도 열린다(`.sub-open`). 알림음 줄은 눌러도 메뉴가 안 닫힌다.
저장은 로컬 `tw.chatSfx`('1'/'0') · `tw.chatSfxId`.
🏢 **회사원 모드면 «꺼짐» 으로 보인다**(`_chatSfxOfficeLock`) — ✓ 없음 · 목록 숨김 · 줄 흐림 + «회사원 모드» · 눌러도 안 바뀜(토스트). 저장값은 안 건드려서 모드를 끄면 원래대로. 모드 토글이 `_applyChatSfxUI` 를 다시 부른다.

| 절 | 무엇을 지키나 |
|---|---|
| 1 | 가짜 DOM 에서 실행: 기본값 · 잘못된 id · 창이 열려 있으면 포커스와 무관하게 조용 · 창이 닫혀 있으면 울림 · 간격 · 소리 바꾸기 · 꺼짐이면 조용+목록 숨김+✓ 빠짐 · 🏢 회사원 모드면 꺼짐 표시·조용·저장값 유지·끄면 복귀 |
| 2 | `_mkSndPool` 사용 · prime 등록보다 앞 · new Audio 없음 · 회사원 게이트는 풀 play 안 · 경로 폴백 · (있으면) mp3 세 개 |
| 3 | 부르는 자리 1곳(수신 분기, 뜬 경우만) · chatLog 구독·sendMyChat 에 없음 · 배선 때 UI 반영 · 🏢 모드 토글이 다시 그림 · 잠긴 동안 저장값 불변 |
| 4 | data-sfx = 목록 id · ▷ 셋 · 메뉴 이름 알림음 1·2·3 = 목록 label · 4단 그대로 · 4단이 «글자 크기 ▶» 의 자식 서브메뉴 · :hover/left:100% · 베젤 radius · fly 이름 안 씀 · #chatWindow 안 |

실측: 헤드리스 크로미움에서 부모 줄→서브메뉴로 4px 씩 옮겨도 한 번도 안 닫히고, 호버 중 위치가 고정(흔들림 없음)임을 확인. 옛 판에서는 16개 빨강.

---

## 29. `sim-mac-update.js` — 🍎 맥은 autoUpdater 를 타지 않는다 (2026-09-18 · 개정 21 신규)

**상황** 0.9.7 맥판은 **애플 서명·공증이 없다.** electron-updater 의 맥 갈래는 서명된 zip + `latest-mac.yml` 을 전제로 하므로, 올려 봐야 설치 단계에서 실패한다. 그래서 맥은 릴리즈의 **dmg 직접 받기**로 간다(arm64 = 애플 실리콘 · x64 = 인텔).

**문제** `main.js` 의 `autoUpdater.checkForUpdates()` 에 플랫폼 구분이 없었다. 맥에서는 yml 이 없어 **켤 때마다 확인이 실패**하고 `sendUpdateStatus('error')` 가 돈다.
★ 다만 **화면에 뜨지는 않았다** — 렌더러 수신부는 `error` 를 `console.warn` 으로만 남기고 배너는 `downloaded` 에서만 띄운다(`handoff-2026-09-18b.md` §2 의 「화면에 뜬다」는 과장이었다). 실제 증상은 켤 때마다의 헛된 네트워크 확인과 콘솔 경고다.

**고침** 갈래를 `startUpdateCheck()` **한 자리**에 모았다 — 맥이면 `checkForUpdates()` 를 아예 안 부르고 `checkMacUpdate()` 로 간다. 맥 갈래는 GitHub releases 의 최신 태그만 **켤 때 한 번** 읽어(새 주기 없음) 새 버전이면 `'mac-available'` 을 렌더러에 보내고, 렌더러는 **기존 `#updateReadyBanner` 를 그대로 재활용**해 버튼만 «지금 재시작» → «받으러 가기»(`companion.openBrowser` = `shell.openExternal`)로 바꾼다. 새 창을 안 만들었으므로 시안이 필요 없다(규칙 3).
저장소 이름은 `package.json` 의 `build.publish` 에서 읽는다 — 코드에 박으면 저장소를 옮길 때 맥 안내만 옛 주소를 가리킨다.
★ 나중에 애플 개발자 프로그램(연 99달러)으로 서명·공증을 하면 되돌린다. 지울 곳은 `checkMacUpdate()` 와 `startUpdateCheck()` 두 군데뿐이고, 그때는 zip + `latest-mac.yml` 을 릴리즈에 함께 올려야 한다.

| 절 | 무엇을 지키나 |
|---|---|
| 1 | `checkForUpdates()` 호출이 한 곳뿐 · 그 자리가 `startUpdateCheck()` 안 · 부르는 자리가 그 함수를 쓴다 · **가짜 `process` 로 실행해서** darwin 이면 안 부르고 `checkMacUpdate()` 로 가며 win32 는 예전 그대로임을 확인 |
| 2 | 맥 갈래가 `'mac-available'` 만 보내고 `quitAndInstall` 을 안 부른다 · 새 창·새 주기 없음 · 주소는 응답의 `html_url` 에서 받고 https 확인 · 저장소 이름을 안 박았다 · `isNewerVersion` 을 **실행해서** `0.10.0 > 0.9.7` 을 확인(문자열 비교면 여기서 뒤집힌다) |
| 3 | 렌더러가 `'mac-available'` 을 처리하고 기존 배너로 간다 · 맥 전용 오버레이 신설 없음 · **가짜 DOM 으로 버튼을 눌러** 맥은 `openBrowser`(설치 안 함) · 윈도우는 `installUpdate`(브라우저 안 엶) |
| 4 | `companion:openBrowser` → `shell.openExternal` 통로 · `updateStatus` 통로 · `build.publish` 의 github owner·repo |

**이빨 확인(실측)** 0.9.7 판(고치기 전)에 돌리면 **21개 빨강**. 갈래 한 줄(`process.platform === 'darwin'` 분기)만 지우면 **2개 빨강** — 1절이 그 한 줄을 정확히 집는다.

⚠️ 맥 안내는 **네트워크가 막히거나 GitHub 이 답을 안 주면 조용히 아무것도 안 한다.** 그게 의도다 — 켤 때마다 «확인 실패» 를 띄우면 지금 고치려는 그 잡음이 모양만 바뀌어 돌아온다.

---

## 30. `sim-focus-cap.js` — 🕒 누적 상한과 레벨 상한은 다른 값이다 (2026-09-18 · 개정 22 신규)

**경위** 회차(999를 채우면 ★ 하나 + 레벨 1부터)를 붙이려는데 **재료가 안 쌓이고 있었다.** `FOCUS_LEVEL_CAP_HOURS`(999) 하나가 두 몫을 했다 — 레벨을 999에서 접는 것과, **누적 초 자체를 999시간에서 멈추는 것.** 그래서 999시간을 채운 사람은 그 뒤로 기록이 늘지 않았다.
★ 리셋 방식은 **안 된다**(§3-1-b). 서버 병합이 `max(서버+증분, 로컬)` 단조 증가라 누적을 0으로 내려도 다음 동기화가 즉시 되돌린다. 그 단조성은 실제 데이터 유실 사고를 막으려고 넣은 것이라 건드리면 그 사고가 되살아난다. ⇒ **회차는 저장하지 않고 파생시킨다**(`floor(누적/999시간)`).

**고침** 상한을 둘로 갈랐다.

| 상수 | 값 | 쓰는 곳 |
|---|---|---|
| `FOCUS_LEVEL_CAP_HOURS` | 999 | 레벨 숫자 · 경험치 바 (예전 그대로) |
| `FOCUS_CYCLE_SEC` | 999시간 | 회차 한 바퀴 |
| `FOCUS_CYCLE_CAP` | 100 | 열어 둔 회차 수 |
| `FOCUS_TOTAL_CAP_SEC` | **359,640,000초(99,900시간)** | 적립 · 서버 동기화 · 규칙 `.validate` |

같은 값이 **세 파일**에 있다: `app.js` · `firebase-init.js` `syncFocusTotal` 의 `CAP` · 규칙 파일 `users/$userId/focus`.
⚠️ **규칙을 게시해야 켜진다.** 서버 쪽이 낮으면 값이 잘리는 게 아니라 `permission_denied` 로 **쓰기가 통째로 거부**되어 그 기기의 기록이 서버에 안 간다.
⚠️ 상한을 아예 없애지 않은 이유: 규칙의 `.validate` 가 **조작된 큰 값이 랭킹 1위에 앉는 것**을 막는 유일한 자리다(핸드오프 B §1-4와 같은 이유).

**이번 단계에서 일부러 안 한 것 — 레벨 표시는 999에서 접힌 채다.** 그릇만 키웠다. 누적이 원천이라 표시를 나중에 붙여도 그동안 쌓인 몫이 **소급해서** 회차로 보인다. 반대로 레벨을 먼저 모듈로로 바꾸면 999를 넘긴 사람이 **별 없이 Lv.1** 로 떨어져 보인다 — 4절이 그 짝을 묶어 둔다(한쪽만 가면 빨강).

| 절 | 무엇을 지키나 |
|---|---|
| 1 | 상한 상수 셋이 있고, 회차 한 바퀴 = 999시간 · 누적 = 한 바퀴 × 회차 수 · 누적 > 레벨 · 안전 정수 |
| 2 | **떼어서 실행** — 999시간에서 한 시간 더 일하면 1000시간이 된다(예전엔 멈췄다) · 상한에서는 멈춘다 · 레벨은 998시간에 999이고 5000시간에도 999 · 적립·동기화에 옛 모양(`FOCUS_LEVEL_CAP_HOURS*3600`)이 없다 |
| 3 | app.js · `firebase-init.js` 의 `CAP` · 규칙의 `totalSec` 상한이 **같은 값** · (생기면) 랭킹 `sec` 상한도 같은 값 |
| 4 | 레벨 모듈로와 별 붙이기가 **함께** 간다 — 지금은 둘 다 없다 |

**이빨 확인(실측)** 고치기 전 판에 돌리면 **7개 빨강**. 규칙 파일만 옛 값(3,596,400)으로 되돌리면 **1개 빨강** — 3절이 「게시 안 함」을 정확히 집는다.

**남은 것(다음 단계)** 별 문자열(`☆`=1회 · `★`=2회 · 6자 접기) · `--pre-c` 를 좌석 요소에 얹기 · 배지/이름표/바에 클래스 붙이기 · 하트비트에 회차·색 필드.
⚠️ **색 고르는 자리(설정? 마이홈?)가 아직 안 정해졌고, 없는 UI 를 새로 만드는 일이다 — 코드보다 시안이 먼저다(규칙 3).**

## 31. `sim-friend-code-keep.js` — 🔗 친추코드는 처음 것이 유지된다 · 스냅샷 없이도 소지품은 온다 (2026-09-20 · 개정 27 신규)

| 절 | 무엇을 | 방식 |
|---|---|---|
| 1 | `_healFriendCodeOwner` 다섯 갈래 — 내 것·주인 없음·버린 uid·오래 조용함은 예전 그대로(되찾기 = 코드 유지), **활동 중인 남의 코드**일 때 로컬 코드가 남고·새로 뽑지 않고·소유권도 안 빼앗고·토스트가 없다 · 세션당 한 번 · «이 기기가 쓰던 코드» 기록 | 실행 |
| 2 | 정적 — `removeItem(MY_FRIEND_CODE_KEY)` 가 app.js 에 없다 · `FC_NEVER_REISSUE` · 재발급 토스트 호출 없음 · 마크업에 재발급·바꾸기 버튼 없음 | 정적 |
| 3 | `_applyTransferSnapshot` — null 이어도 친추코드 정정 → 소지품 → 집중초 셋이 그 순서로 돈다 · null 이면 이름·라이선스·집중초·로컬 코드는 안 건드린다 · 있으면 예전과 같다 · 집중초 max | 실행 |

★ **친추코드 재발급을 없앤 이유는 «같은 사람의 다른 PC» 다.** 활동 판정(7일)은 «버려진 uid 인가» 를 가르려는 것이었는데, 두 PC 를 번갈아 쓰면 어느 쪽 uid 도 버려진 적이 없다. 그 판정이 「남」이라고 답하는 순간 코드가 바뀌었고, 친구들이 적어 둔 코드가 죽었다. 재발급을 안 해서 생기는 손해(드문 «진짜 남의 코드» 경우)보다 훨씬 컸다.
⚠️ 소유권은 그대로 둔다. 활동 중인 소유자의 것을 빼앗으면 두 기기가 매 부팅 서로 되찾는 핑퐁이 된다(`_healFriendCodeOwner` 머리 주석). 되돌아가지 말 것.
⚠️ 3-1 은 «없어질 코드» 지만 지금 고쳤다 — 회원가입(uid = 계정)이 나오기 전까지 매일 나는 사고라서다. 회원가입에서 `_applyTransferSnapshot` 자체가 사라지면 이 절도 같이 내린다.

## 32. `sim-slot-conflict.js` — ⚖️ 양쪽이 다 바뀌면 덮지 않는다 (2026-09-20 · 개정 30 신규)

| 절 | 무엇을 | 방식 |
|---|---|---|
| 1 | `SLOTS_SEEN_KEY` 가 `SLOTS_TS_KEY` 바로 옆(`ACCOUNT_LOCAL_KEYS` · 계정 정리 한 줄) · 이관 규칙(없으면 지금 ts) · 충돌 = serverMoved && localDirty · 감지가 ts 갈래 **앞** · 콘솔 출구 둘 · UI 안 꽂음 | 정적 |
| 2 | ① 3-7 재현 — 본 적 없는 1칸 기기가 5칸 위에 올리려 하면 쓰기 0·받기 0·경고 1·충돌 기록·핸들러 전달, 다음 판도 조용, 집 PC 는 무손실 ② 한쪽만 움직인 판(빈 새 기기 받기 · 내가 고침 → 올림 · 남이 올림 → 받음 · 줄어든 받기는 백업 남김) ③ `'server'` 는 받고 백업 남음 · `'mine'` 은 올리고 `saveSlotsPrevRemote` 가 있으면 먼저 부름 · 그 밖 값 거부 ④ 충돌인데 계정이 비었으면 올림 ⑤ pull 은 충돌 안 봄 ⑥ 거부된 쓰기는 seen 안 찍음 | 실행 |

★ **왜 ts 큰 쪽이 아니라 seen 인가.** 3-7 에서 회사 PC 의 ts 가 컸던 것은 «나중에 저장했기 때문» 이지 «집 PC 의 5칸을 보고 나서 고쳤기 때문» 이 아니다. 후자만이 덮어도 되는 근거다. seen 은 그 둘을 가른다.
⚠️ 충돌이면 **멎는다.** 대화상자가 붙기 전까지 그 기기는 콘솔로만 풀린다 — 그래서 이관 규칙을 조용한 쪽으로 두었다(개정 30 머리). 대화상자(시안 `3-7-2 시안` 캔버스) 가 붙으면 `_slotsConflictHandler` 에 꽂고, 그때 «본 적 없음» 이관으로 바꿀지 되짚을 것.
⚠️ 이건 4번(캐릭터 단위 저장 ②③)의 **앞부분**이다. 칸 단위로 쓰게 되면 «양쪽이 다 바뀜» 중 다른 칸을 건드린 경우는 충돌에서 빠지고, 같은 칸만 남는다. 그때 이 검사의 ① 은 «같은 칸» 으로 좁혀 다시 쓴다.

## 33. `sim-slot-sync-ui.js` — 🛟 3-7-2 연동 UI: 띠 · 기기 연동 구획 · 충돌 대화상자 (2026-09-20 · 개정 31 신규)

| 절 | 무엇을 | 방식 |
|---|---|---|
| 1 | 마크업 — `#lcSyncBand` 가 `lc-stage` 바로 위(숨김) · 계정 탭 «기기 연동» 이 로그아웃 상자 다음·되찾기 앞 · `#slotConflictDlg` 전역 오버레이와 `scd*` id 여덟 · 버튼 순서(다른 PC 왼쪽) · 시안 문구 · 네이티브 confirm 없음 | 정적 |
| 2 | 배선 — `renderLauncher` → 띠 · `refreshAccountTab` → 구획 · adopt 가 손실 기록(from·to·bak) · push 세 갈래가 실패 사유 · 성공이 지움 · 읽기 실패·«같음» 도 마지막 연동에 · 기록 셋이 `ACCOUNT_LOCAL_KEYS`(백업 키는 여전히 밖) · [유지하기]·[닫기]·[확인] 은 접기만 · [지금 다시 올리기] 는 ts 안 찍음 · [고르기] 가 대화상자 다시 열기 · 되돌리면 «되돌린 직후» 기록 | 정적 |
| 3 | 문구 — 띠 세 상태 · 평상시 · 줄어든 교체 · 올리기 실패 · 분실 토스트 · **«되돌릴 수 있는 기한» 없음** | 정적 |

★ 띠와 구획은 **같은 기록**(`SLOTS_LOSS_KEY`)을 읽는다. 띠를 [유지하기] 로 닫으면 `dismissed` 가 되어 구획에서도 접힌다 — 두 자리가 다른 말을 하지 않는다.
⚠️ [지금 다시 올리기] 가 `_slotsTouch` 를 부르면 안 된다 — 실패한 push 는 이미 «로컬 ts > seen» 이라 다음 동기화가 그 갈래로 다시 간다. 새로 찍으면 서버가 그 사이 바뀌었을 때 ④ 가 잡을 판을 놓친다.
⚠️ 되돌리기의 두 번째 출구(`restoreSlotsPrevRemote`)는 규칙 파일이 **게시된 뒤**에만 값이 있다. 게시 전엔 첫 출구(로컬 백업)만 산다.

## 34. `sim-chars-merge.js` — 🧬 캐릭터 단위 병합: 합집합 · 묘비 · 휴지통 (2026-09-20 · 개정 32 신규)

| 절 | 무엇을 | 방식 |
|---|---|---|
| 1 | `_charsMerge` 본문을 떼어 와 돌린다 — ① 설계 §2-4 표 다섯 줄(한쪽만 · 같음 · 산 vs 산 양방향 · 산 vs 묘비 양방향 + 되살림) ② 3-7 재현(A 5 · 오프라인 B 1 → 6 · trash 0 · 다음 판 A 는 1만 받음) ③ 되감기(묘비가 이기면 def 는 trash `deleted`) ④ 미래 mtime(한 시간 → 정정·push·pull · 1분은 허용 · 묘비도) ⑤ 지우는 갈래 없음(merged = 합집합 · 본문에 delete/remove 없음) ⑥ 입력 불변 · cid 모양 · 콘솔 출구 · **아직 아무도 안 부른다** | 실행 |
| 2 | 규칙 — `chars` .write 가 slots 와 같은 소유 식 · cid 모양 · def 또는 del · def 검증 = `slots.s.$i` · `$other` 거부 · **`trash` 는 잎에서 붙이기만** · why 두 값 · `charsMeta` · **`slots`·`slotsPrev` 아직 있음** | 정적 |

★ **왜 순수 함수부터인가.** 설계 §10-4 — 병합 규칙이 곧 3-7 의 해답이고, 스텁 없이 돌릴 수 있는 유일한 조각이다. 이관(§5-N-2)·게이트(§3)·화면(§7 시안 뒤)은 전부 이 함수를 부르는 쪽이다.
⚠️ `trash` 의 `.write` 를 부모(`trash` 노드)로 올리지 말 것 — Firebase 규칙은 허용이 아래로 내려와서 잎의 `!data.exists()` 가 무력해진다. 2절 ★ 가 그것을 집는다.
★ 개정 34 부터 1절 «아직 아무도 안 부른다» 는 «**이관 조율 블록 밖에서는** 아무도 안 부른다» 다 — 부르는 자리는 콘솔 미리보기(`charsMigrateDryRun`) 하나. 블록 범위는 `const CHARS_SYNC_ENABLED` ~ `try{ window.charsMigrateDryRun`.
⚠️ 이 함수가 실제로 불리기 시작하면(§5-N) `sim-slot-conflict.js` ①·`sim-slot-sync-ui.js` 는 폐기 대상이다(설계 §6-⑨·⑫). 그 전까지는 둘 다 산다 — 이관 창 동안 `slots` 쓰기가 남기 때문.

## 35. `sim-chars-migrate.js` — 🧬 이관 slots → chars: 열쇠 두 벌 · 1:1 · 아무도 안 잃음 (2026-09-21 · 개정 33 신규)

| 절 | 무엇을 | 방식 |
|---|---|---|
| 1 | `_charsKeys` — 로컬(dataURL) ↔ 서버(URL)의 같은 마리가 같은 K1 · 치장만 고치면 K1 같고 K2 다름 · 다른 그림은 K1 다름 · 해시 없는 옛 URL 은 K2 로 맞음 · 캔버스 얼굴은 해시 없음 · 깨진 입력은 null · 0/false/없음 동일 | 실행 |
| 2 | `_charsFromServerSlots` — 첫 이관 5→5(규칙 cid 모양 · def 는 slots 문자열 그대로) · 같은 문자열 두 칸 → cid 둘 · slotsPrev 에만 있는 1마리 → 6번째(책상 밖) · ★ 두 번째 기기 → 새 cid 0 · 되돌이(치장 고침 → upd · 새 마리 → add · 빠진 칸은 무동작 · 옛 slots.ts 면 무동작) · 묘비와 짝(나중이면 되살림 · 먼저면 무동작 · 어느 쪽도 새 cid 없음) | 실행 |
| 3 | `_charsFromLocalSlots` + `_charsMerge` — ★ 안 고친 기기 push·pull·trash 0 · ★ 3-7 재현 6마리 · 고친 칸만 이김(★ K2 가 칸을 가른다) · 서버가 고쳤으면 pull + 옛 모습 trash · ★ 한 번도 못 올린 기기도 안 잃음 · 옛 URL 중복 0 · 1:1 · 입력 불변 | 실행 |
| 4 | 정적 — 조율 블록 밖에서는 아무도 안 부른다 · 병합 블록 뒤 · 이관 블록이 병합을 안 부른다 · 콘솔 출구 둘 · 본문에 localStorage/firebaseAPI 없음 | 정적 |
| 5 | 조율(개정 34) — ★ 스위치 false · ★ 부팅에서 안 부름 · uid 캐시만 · ★ 미리보기 읽기만 · 스텁 서버 실행: 스위치 꺼짐 = 선점·쓰기 0 · ★ 두 기기 동시 → 한 기기만 6마리 · 도장 · 세 번째 기기 무동작 · ★ 되돌이 upd 1 add 1 · 계정별 기록 · 기록 없어도 멱등 · 쓰기 실패 → 진행 중 · ★ 10분 뒤 재선점 · 미리보기 표 | 실행 |
| 6 | firebase-init — 통로 일곱(개정 35 `loadCharsTrashLatest` · 개정 36 `loadCharsMetaTs`) · ★ 선점 트랜잭션 · ★ chars 는 update(경로 키 `chars/{cid}`) · ★ 같은 update 안에 `charsMeta/ts` · 휴지통 한 줄씩 · why 두 값 · 규칙 `claimAt` · `ts` · 휴지통 why 두 값 | 정적 |
| 7 | 첫 채택(개정 35) — 계획: ★ 안 고친 기기 0 · 실기기 재현(서버 4/이 기기 3 → 보관함 4 · 책상 3) · ★ 3-7 · 고침 · ★ 바꿔 앉힘 · 열쇠 없는 묘비는 되살아남(경고 줄) · 열쇠 달린 묘비 → 내림 · 미래 시각. 조율: 스위치 · ★ 못 올리면 무변경 · ★ 보관함 서버 표현 · ★ 보관함에 dataURL 없음 · 두 번째 무동작 · 그림 못 받으면 무변경 · ★ 바꿔 앉힘 · 휴지통 못 읽으면 미룸 · ★ 지운 마리 내림 · 쓰기 순서 · 백업 | 실행 |
| 8 | 평상시 동기화(개정 36) — ① 스위치 꺼짐 = 훅 무동작·옛 문구 · ★ ② 채택 전 = 보관함 키를 안 만든다 · ★ ③ 기준 없으면 기준만(안 달라진 저장에서도) · 고친 cid 만 dirty(base · 열쇠) · ★ ③-b 백업 되돌리기 → 열쇠로 다시 짝짓기 · ★ ④ 휴지통 이동 = 묘비 + 책상 표 당김 · ★ 당기기는 고침 아님 · ⑤ 새 마리 · 20 문턱(묘비 안 셈) · ★ ⑥ ts 같으면 본문 0 · 올림 · 휴지통 0 · ★ ⑦ 바꿔 앉힘(기준 비움) · ★ ⑧ 내림 · ★ ⑨ 양쪽 고침 → overwritten · ★ ⑩ 못 올림·쓰기 실패·못 받음 = 무변경 · ⑪ 도중 바뀜 · ⑫ 생성기 · ⑬ 30분 = ts 만 · ★ ⑭ 못 올린 고침 휴지통. 배선(정적): saveSlots 한 곳 · 당기기 전 · 새 마리 넷 · ★ 옛 slots 첫머리 올리기만 · 백업 · 로그아웃 · ★ 부팅 배선은 스위치 안 | 실행 · 정적 |
| 9 | 섬네일(개정 37) — ★ thumbUrl 은 K1·K2 밖 · ★ 섬네일 → thumbUrl · dataURL 0 · ★ 섬네일만 실패 → push 안 접고 받아 둔 URL · 없으면 빼고 · 받아 앉힌 칸은 URL 그대로 · 얼굴 실패는 여전히 null · ★ slotToObj 는 있을 때만 · loadSlots 옮겨 적기 | 실행 · 정적 |

★ **떼어 오기 범위.** 이 검사는 `const CHARS_KEY_SCALARS` ~ `try{ window._charsFromServerSlots` 를 떼고, 병합 블록 · `_quickHash` · `SLOT_IMG_FIELDS` 를 같이 넣어 돌린다. `sim-chars-merge.js` 의 범위(`const CHARS_SKEW_TOL_MS` ~ `try{ window._charsMerge`)와 겹치지 않게 **그 뒤에** 붙였다 — 4절 둘째 줄이 집는다.
⚠️ 이관 블록 주석에 병합 함수 이름 + 여는 괄호를 쓰지 말 것 — `sim-chars-merge.js` 의 «아직 아무도 안 부른다» 가 주석까지 센다(원문 대상). 4절 셋째 줄이 같은 것을 이쪽에서 본다.
⚠️ **서버 URL 이름 속 해시** — 개정 34 에서 `firebase-init.js` 로 경로 모양(`users/{uid}/roomface_{종류}_{해시}.png` · GLB 는 `slotglb_…glb`)을 확인하고 픽스처를 맞췄다. 실데이터는 콘솔 `charsMigrateDryRun()` 의 «그림URL 전체 / 해시꺼냄» 두 수로 본다 — 다르면 옛 이름이 섞여 K2 가 받고 있다(분실 아님 · 중복 위험).
⚠️ 서버 이관은 **한 기기만** — 개정 34 의 `claimCharsMigration`(charsMeta 트랜잭션). 5절 ② 가 두 기기 동시를 돌린다. 선점한 기기가 쓰다 꺼지면 `migratedAt:0` 으로 남고 10분 뒤 다른 기기가 다시 잡는다(④).
⚠️ **`CHARS_SYNC_ENABLED` 를 켜는 것은 규칙 게시(`charsMeta.ts` 포함 · 개정 36) 뒤.** 이 기기 쪽 조율(첫 채택 개정 35 · 평상시 개정 36)은 들어왔다. 5절 첫 줄이 false 를 본다 — 켜는 세션은 그 줄을 같이 바꿀 것.
⚠️ 8절은 조율 블록을 `new Function` 으로 돌린다 — 평상시 블록의 **맨 윗단**(함수 밖)에 부작용(setTimeout · DOM)을 두지 말 것. 배선은 블록 밖(`try{ window.charsMigrateDryRun` 다음 줄)에 `if(CHARS_SYNC_ENABLED)` 로 둔다.

## 36. `sim-signup.js` — 🪪 회원가입 게이트: uid 는 게이트가 정한다 (2026-09-21 · 개정 38 신규)

설계 `design-signup-2026-09-20.md` §8 의 그 파일. 게이트를 조각마다 넣으며 절을 늘린다.

| 절 | 무엇을 | 방식 |
|---|---|---|
| 1 | ★ `getMyUserId` 본문에 setItem·생성 없음 · uid 모양 생성은 app.js 한 곳(`_inventMyUserId`) · ★ 부르는 곳도 하나이고 `_showInviteGate` 안 · `redeemInvite` 둘째 인자 ≠ `getMyUserId()` · 토큰으로 부름 · firebase-init 이 ref·update·Storage ref 를 감싼다 · ★ `redeemInvite` 가 users/·stats/ 에 안 씀 · `finishInviteSignup` 있음 | 정적 |
| 2 | `_noUidPath` — 정상 경로 그대로 · 'null' 로 시작하는 이름은 무사 · users/null · undefined · '//' → `_noUid/` · https:// 무사 · ref/sref 돌림 · 루트 ref 그대로 · ★ 다중 경로 update 한 줄이라도 걸리면 통째 거절 | 실행(떼어 오기) |
| 3 | 초대 토큰(스텁 서버) — 소진 = usedBy 토큰 · ★ users/ 쓰기 0 · 카운터 그대로 · 같은 토큰 재시도 통과 · 다른 토큰 거절 · 빈 토큰 거절 · 남의 토큰 마무리 무변경 · ★ 마무리 = usedBy uid · invite 0장 · 카운터 +1 · ★ 두 번 불러도 카운터 한 번 · users/ 아래 토큰 키 0 · 없는 코드 | 실행(떼어 오기) |
| 4 | app.js — ★ 빈 기기 null · 부르기만 해선 안 씀 · 발명 모양 · 만들기만 해선 안 기록 · `_setMyUserId` 거절 셋 · ★ uid 없으면 친구 코드 안 뽑음 · 토큰 모양 · 같은 코드 같은 토큰 · 다른 코드 새 토큰 · ★ uid 없으면 마무리 안 부름 · 실패 → 토큰 남김 · 성공 → 지움 | 실행(떼어 오기) |
| 5 | H(개정 39) — 세 문 글자·순서 · ★ 셋 다 lc-btn · ★ 옛 이전 줄 없음(마크업·게이트 본문) · 구글 안내 줄 · 친구 코드 모양 · `_loginDoFriendCode`: 틀림 무기록 · ★ 새 PC switched · uid·도장·로그인 키·스냅샷 · 같은 uid 재시작 없음 · 갈아탐 · ★ 모양 틀린 userCode 거절 + 로그아웃 · firebase-init 통로: ★ 읽기만 · 이메일 모양 · ★ 줄 없으면 로그아웃 · 오류 문구 둘 | 정적 · 실행(떼어 오기) |
| 6 | A(개정 40) — 시안 글자 · ★ 아이디 고정 표시 · 오버레이 안 · 발명은 `_signupPendingEnsure` 만 · ★ 끊긴 가입 → 부팅 때 A · 임시 블록 없음 · 실행: ★ 열기만 해선 서버·uid 0 · ★ 순서 익명 → 선점 → 연결 → 결속 → 거울 → 마무리 · uid·코드·로그인 표시·도장 · ★ 뺏긴 코드 → 새 코드 · ★ ④ 끊김 → 같은 uid·코드로 이어 끝남 · Auth 중복 → 새 코드 · 익명 꺼짐 · 결속 실패 · ★ 구글 가입 · ★ 이미 가입된 구글 · 창 닫음 · firebase-init: ★ 익명 이어 쓰기 · 승격 세션 · ★ 남의 세션 놓기 · 익명 꺼짐 · ★ 승격 authUid 그대로 · 한 번만 · taken · 약한 비밀번호 · ★ 결속 · 이메일 거울 없음 · 남의 것 거절 | 정적 · 실행(떼어 오기) |
| 7 | I(개정 41) — 시안 글자 · 고정 표시 · ★ 닫기 없음 · 반투명 · ★ UI_HIT_SEL 등록 · 게이트 뒤 판정 · 스위치 · 판정: uid 없음 · 꺼짐 · ★ 못 읽음 · ★ 이미 묶임 → 안 띄움 · ★ 묶이지 않음 → 이 기기 코드 · 거울 코드 · 새 후보 · 못 읽음 · 가입: ★ 순서(선점 없음) · ★ 이 uid 결속 · uid 그대로 · 로그인 표시 · 상태 키 없음 · 선점·뺏김 · ★ persist=false · 결속 실패 | 정적 · 실행(떼어 오기) |
| 8 | ⑥(개정 42) — ★ ensureMyFriendCode 첫머리(발급보다 먼저) · 부르는 곳 하나 · ★ 본문에 쓰기 없음 · 실행: ★ 다르고 내 것 → 로컬만 · ★ 쓰기 0 · ★ 남의 것 → 그대로 · 비었음 · 같음(주인 안 물음) · 못 읽음 둘 · uid 없음 · ★ 로컬 코드 없는 PC 는 거울을 따르고 발급 안 함 · 세션당 한 번 · 거울도 없으면 발급 | 정적 · 실행(떼어 오기) |
| 9 | J·J2·K(개정 43) — J 시안 글자 · 경고 두 줄(사용자 수정본) · 버튼 둘 · J2 줄 · ★ A·J 에 «되찾기 코드» 없음 · K 시안 · ★ 닫기 없음 · ★ UI_HIT_SEL · I 뒤 K · ★ A 완료 → 재시작 · 두 길 · ★ I 완료 → 닫기(재시작 없음) · ★ 구글 붙이기 = linkWithCredential · K 판정: uid 없음 · ★ 못 읽음 · 안 묶임 · ★ 이미 로그인 · ★ 묶였는데 로그인 안 됨(거울) · 다른 세션(이 기기 코드) · 완료 화면(가짜 DOM): J 표시 · J2 표시 · ★ [시작하기] 에서 풀림 · 구글 붙이기 성공·실패 | 정적 · 실행(떼어 오기 · 가짜 DOM) |
| 10 | C3·C2(개정 44) — 구획 자리(로그인 후 얼굴 · 로그아웃 위) · 시안 글자(로그인 수단 · C3 안내 · C2 경고 · C2 안내) · ★ 비밀번호 칸 둘뿐 · ★ «되찾기 코드» 없음 · ★ CSP 함수 호스트(두 줄 · 와일드카드 아님) · 리전 · ★ 새 통로 넷은 authSignOut 뒤 · ★ 함수 SDK 동적 import · 판 일치 · C3 = 붙이기 · 재인증 = 세션 유지 · firebase-init 실행: 세션 없음 · 익명 · already · ★ 성공 이메일 · ★ needReauth · taken · user-mismatch · C2: 세션 없음 · 비밀번호 없음 · 6자 · SDK 못 받음 · ★ not-found = 배포 전 · ★ 새 비밀번호만 보냄 · ★ 다시 로그인 · relogged:false · app 실행: 모드 다섯 · 입력 검사 · 아이디(거울 · 이 기기 · ★ 남의 코드 거절 · 모양 · 못 읽음 · uid 없음) · C3 한 번 · ★ 재인증 뒤 한 번 더 · 창 닫음 · 재인증 실패 · C2 통로 · 그리기(가짜 DOM): ★ C3 · ★ C2 · ★ 경고 + [연결하기] · 세션 풀림 · 로그인 안 함 | 정적 · 실행(떼어 오기 · 가짜 DOM) |

★ **떼어 오기(개정 44).** 10절 구획은 `<div id="acctMethods"` ~ `<div id="acctMOff"` — 그 사이에 다른 덩어리를 끼우지 말 것. firebase-init 새 통로 넷(`authProviders` · `authLinkPassword` · `authReauthGoogle` · `authChangePassword`)은 이 순서로 `authSignOut` **뒤**에 — 앞에 두면 5·6·9절 떼어 오기가 그것까지 품는다. `authChangePassword` 안의 `import(FUNCTIONS_SDK_URL)` 글자는 10절이 바꿔 끼워 돌린다(이 모양 그대로 둘 것).
★ **떼어 오기(개정 43).** 7절 I 마크업은 `#existingSignupOverlay` ~ 다음 덩어리 머리(`<!-- 🎉 J · J2` 또는 `<!-- 🖥️ 한 계정 한 기기`), 9절 J 는 ~ `<!-- 🔐 K ·`, K 는 ~ `<!-- 🖥️ 한 계정 한 기기`. **떼어 오기(개정 40).** 5절은 `async authSignInWithFriendCode(` ~ 다음 메서드 머리(가입 통로 주석 또는 `async authSignOut()`), 6절은 `async authSignupEnsure(` ~ `async authSignOut()` — 가입 통로 셋 사이에 다른 메서드를 끼우지 말 것. 2절은 firebase-init 의 `const _NOUID_SEG` ~ `return _dbUpdate(r, v);\n  };` 를, 3절은 `async redeemInvite(` ~ `// 초대장 발급 — 유저는 invitesLeft를 1 차감` 을 떼어 돌린다 — 그 둘 사이에 다른 메서드를 끼우면 3절이 그것까지 품는다. 4절은 함수 일곱을 이름으로 뗀다.
⚠️ smoke 하네스를 쓰는 검사(17개)는 **빈 localStorage 로 부팅한다** — 이제 uid 가 없는 «처음 쓰는 PC» 다. uid 가 필요한 시나리오는 부팅 **뒤**에 `tw.myUserId` 를 심는다(개정 38 의 두 검사). 부팅 **앞**에 심으면 `HAD_USER_ID_AT_BOOT` 가 true 가 되어 게이트·grandfather 갈래가 바뀐다.
다음 절(설계 §8): 게이트 표 갈래 스텁(H·A·I·«다름» · 오프라인 첫 실행) · 가입 중단 재시도 · 익명 가입(`isAnonymous` · 같은 authUid · providers) · 거울 정정 ⑥ · 코드 재발급 0회.

