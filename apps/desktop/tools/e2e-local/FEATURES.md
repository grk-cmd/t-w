# e2e 기능 지도 — 0.13 데스크톱 앱

0.13 데스크톱 앱에서 사용자가 쓰는 기능마다, 그 기능을 끝까지 몰아 보는 e2e 시나리오와 로직을 보는 sim 이 있는지 적은 표다. 새 시나리오를 만들 때 이 표의 **할 일** 줄부터 고른다. 시나리오나 sim 을 더하거나 지우면 이 표도 같은 PR 에서 고친다.

## 읽는 법

- **e2e** 열
  - `flow.js «단계»` — `node flow.js <결과 폴더>` 가 스스로 도는 단계(README «flow.js — 한 바퀴»).
  - `REPL «항목»` — README «해 본 것 — REPL 로» 에 적은, 손으로 명령을 보내 확인한 순서. 스크립트가 아니라 다시 돌리려면 사람이 `run.sh` 로 보낸다.
  - `scenarios/<영역>/<이름>.js` — `node run-all.js` 가 돌리는 자동 판정 시나리오(README «run-all.js — 시나리오»).
  - `<영역>/<이름>`(방 · 채팅 줄) — 같은 시나리오를 줄여 쓴 것(`scenarios/room/create-join.js` → `room/create-join`). 괄호 안은 그 시나리오가 보는 것.
  - 비어 있으면 e2e 가 없다.
- **sim** 열 — `checks/sim-<이름>.js` 의 `<이름>`. 돌리기는 `node checks/run.js <이름>`. sim 은 모듈을 가짜 화면 · 가짜 서버로 돌려 로직을 보는 검사라, 앱을 켜서 화면을 끝까지 누르지 않는다.
- **상태**
  - `e2e` — flow.js · 시나리오가 판정까지 한다.
  - `REPL` — 손으로 돌린 순서만 있다(자동 판정 없음).
  - `부분` — e2e 가 기능 일부만 지나가거나, 화면을 찍기만 하고 판정하지 않는다(무엇이 빠졌는지 e2e 열에 적음).
  - **할 일** — e2e 가 없다.

sim 가운데 구조 · 빌드 · 진단 · 서버 함수만 보는 것(`app-size` `lint` `rules-keys` `env-diag` `daily-active` 등)과 앱에 없는 설계의 순수 로직(`town-32` `village-addr` `yard-enter`)은 사용자 기능에 매이지 않아 표에 넣지 않았다.

## 켜기 · 런처 · 실행 화면

| 기능 | e2e | sim | 상태 |
|---|---|---|---|
| 앱 켜기 순서 | `flow.js «로그인된 책상»`(다시 켠 뒤 15초 기다려 화면만 찍음) | `app-boot` `run-boot` `dom-boot` `user-local` · 부팅 스모크 `checks/smoke.js` | 부분 |
| 두 번째 실행(이미 켠 창을 앞으로) | `scenarios/launcher/second-instance.js`(멀쩡하면 새 실행이 바로 꺼지고 옛 앱이 신호를 받음 · 렌더러가 죽은 채면 옛 앱이 다시 켜기) | `second-instance` | e2e |
| 렌더러가 죽었을 때 런처로 되돌리기 | `scenarios/launcher/renderer-crash.js`(마이홈 창 모드에서 렌더러를 crashed 로 죽임 → 창이 런처 크기 · main 로그 crashed → 되돌림 → 자동 다시 불러오기 한 번). 실행 화면은 캐릭터가 있어야 들어가서 마이홈으로 본다(되돌리는 길은 같다) · Playwright 로 붙인 앱은 다시 뜬 렌더러가 로드를 끝내지 못해 다시 불러온 화면 · 로그인 유지는 빠짐 | `renderer-gone-reset` | 부분 |
| 런처 화면(미리보기 · 슬롯 · 타이틀바 · 컨트롤) | `REPL «캐릭터 만들기»` 가 런처에서 시작(런처 자체는 판정 안 함) | `launcher-chrome` `launcher-controls` `launcher-preview` `launcher-state` `app-mode` `cfg-fit` `slot-fit` `zoom-window` | 부분 |
| 런처 광고 배너 · 게임 설정 |  | `ad-banner` | **할 일** |
| 책상 모드(데스크톱 실행 화면 · 클릭 통과) | `REPL «책상 모드»` | `desktop-run` `click-through-policy` `hit-map` `hit-shadow` `overlay-gap` `overlay-layered` `top-level` `run-rect` `display-pick` `system-prompt` `pen-forward` `hover-poke` `fly-click-through` | REPL |
| 피규어 · 회사원 모드 |  | `office-mode` `figure-mode` `window-mode` | **할 일** |
| 프로그램 이동 모드 |  | `move-mode` | **할 일** |
| 설정 창(캐릭터 크기 · 포커싱 어플 · 테마 · 화면 크기 · 화질 · 단축키) | `scenarios/launcher/settings.js`(런처 ⚙️ 설정 — 탭 · 판 표시 · 테마 · 화질 · 회사원 모드 · 다시 켠 뒤 유지). 실행 화면의 F1 설정 패널(캐릭터 크기 · 포커싱 어플 · 화면 표시)은 캐릭터가 있는 실행 화면이 필요해 빠짐 · 자동 실행 토글은 이 PC 로그인 항목을 바꿔 누르지 않음 | `settings-panel` `program-settings` `panel-fit` `winlist` `theme` `theme-ui` `child-theme` `ui-zoom` `fn-keys` `key-input` `no-default-menu` `frame-budget` `unfocused-fps` | 부분 |
| 오픈소스 라이선스 창 | `scenarios/launcher/oss-licenses.js`(런처 · 설정 두 입구 · 줄 수 · 원문 펼침 · 이름 → 브라우저 요청 기록) | `oss-licenses` | e2e |
| 창 앞뒤 · 바깥 눌러 닫기 |  | `win-stack` `win-front` `win-layers` `z-layers` `outside-close` | **할 일** |

## 계정 · 로그인 · PC 등록

| 기능 | e2e | sim | 상태 |
|---|---|---|---|
| 초대 코드로 가입 | `flow.js «초대 화면» «초대 코드 입력» «가입»` | `signup` `license-gate` `name-guard` | e2e |
| 가입 뒤 다시 켜기 · 로그인 유지 | `flow.js «시작하기 → 다시 켜기» «로그인된 책상»`(로그인이 남았는지는 뒤 단계 «얼굴 올리기 · 받기» 의 내 정보 요청이 성공해야 통과) | `login-flow` `account` `session` `session-baseline` `account-state` `account-store` `user-api` `first-run-013` | e2e |
| 로그인 화면(친구 코드 · 비밀번호 · 구글) · 구글로 가입 | `scenarios/account/login.js`(틀린 모양 · 틀린 비밀번호 · 로그인 · 구글 가입 기록 없음 → 초대 코드 → 구글 가입 · 다른 PC 에서 같은 구글). 구글 창은 진짜 OAuth 라 Auth 에뮬레이터가 받는 가짜 구글 ID 토큰을 main 의 구글 창 IPC 자리에서 돌려준다 | `login-flow` `account` `session` | e2e |
| 비밀번호 바꾸기 · 구글 계정에 비밀번호 붙이기 | `scenarios/account/password.js`(바꾸기 → 새 비밀번호만 로그인 · 붙이기 → 이 PC 로그인이 이어지고 친구 코드로도 같은 계정) | `user-api` `account` | e2e |
| 회원 탈퇴 | `scenarios/account/withdraw.js`(미리보기 · 체크 + «탈퇴» 둘 다 · 서버 탈퇴 → 로그인 화면 · 계정 없음) | `account-delete` `account` `my-info` `user-api` | e2e |
| 친구 코드 고정 | `flow.js «초대 코드 입력»` 이 가입 화면의 친구 코드를 읽어 `account.json` 에 적음(바뀌지 않는지는 안 봄) | `friend-code-keep` | 부분 |
| 로그아웃 | `scenarios/account/switch-account.js`(확인창 → 다시 켜기 → 로그인 화면 · 이 PC 계정 사본 없음 · 서버 기기 목록에서 빠짐) · `REPL «로그아웃»` | `account` `account-switch` `signup` | e2e |
| 같은 PC 에서 계정 바꾸기 | `scenarios/account/switch-account.js`(A 로그아웃 → B 로그인 · 같은 기기 id 가 B 에 등록 · A 에서 빠짐) | `account-switch` `account-store` | e2e |
| 닉네임 바꾸기 · 운영진처럼 보이는 이름 막기 | `scenarios/account/nickname.js`(저장 · 서버 이름 · «운영자» 화면에서 막음 · 서버도 거절 · 12자 · 다시 켜도 그대로) | `user-name` `name-guard` `person-name` | e2e |
| 내 정보 · 보관함 · 휴지통 | `scenarios/account/my-info.js`(친구 코드 · 보관함 n/20 · 휴지통으로 옮기기 · 복원 · 슬롯에 올리기 — 캐릭터는 API 로 미리 넣음) | `my-info` `my-info-box` | e2e |
| 초대장 발급(친구를 가입에 초대) | `scenarios/account/invite-issue.js`(남은 장수 · [취소]는 차감 없음 · 발급 · 그 코드로 친구 가입 · 쓴 코드 거절) | `license-gate` `user-api` | e2e |
| 라이선스 · 프리미엄 등록 | `scenarios/account/license.js`(없는 키 거절 · 관리자가 낸 키 등록 → 서버 프리미엄 · 남의 키 거절 · 이 기기 해제) | `license-api` `license-key` `license-ui` `license-screen` `license-premium` `license-leak` `premium-assets` `premium-desk` | e2e |
| PC 등록(계정마다 3대 · 넷째 PC 는 묻고 하나 지움) | `scenarios/account/device-limit.js`(앞 셋은 API 등록 · 넷째 앱 → «가장 오래된 기기 … 이 기기를 지우고 이 PC를 쓸까요?» · [취소]는 아무것도 안 지우고 로그인 화면 · [지우고 사용]은 그 기기만 지움) | `device-register` `device-limit-dialog` `device-id` `license-screen` | e2e |
| PC 연결이 끊긴 뒤 안내(다른 PC 에서 이 PC 를 지움 · 이 PC 에서 새로 연 앱에 밀림) | `scenarios/account/device-lost.js`(상대 PC · 새 세션은 API 등록으로 — 서버가 realtime 에 닫게 알림 · 두 안내 글 · 다시 등록 · 여기서 계속) | `device-lost` | e2e |
| 서버 점검 화면 | `REPL «점검 켜고 끄기»` | `maintenance-gate` `remote-config` | REPL |
| 판 확인(강제 · 선택 업데이트 · 최소 판) | `scenarios/account/version.js`(최소 판 강제 창 · 새 판 선택 창 [나중에] · 같은 계정 다른 PC 의 더 새 판으로 막힘). 최소 판은 같이 쓰는 로컬 설정을 바꿀 수 없어 이 앱의 `GET /v2/config` 응답만 고치고, «새 판 있음» 은 GitHub 릴리스 피드라 main 의 확인 IPC 자리에서 상태를 보낸다 · 실제 내려받기 · 설치는 빠짐 | `update-flow` `app-version-sync` `app-version` `remote-config` `mac-update` `update-diag` | e2e |

## 캐릭터 · 책상 · 가챠

| 기능 | e2e | sim | 상태 |
|---|---|---|---|
| 캐릭터 만들기(생성기 · 종족 고르기 · 얼굴 그리기) | `REPL «캐릭터 만들기»` | `creator-flow` `creator-open` `creator-state` `creator-save` `creator-preview` `creator-face` `creator-canvas` `creator-xform` `creator-flat-view` `race-picker` `paint-stroke` `paint-tools` `paint-geom` `uv-fill` `cr-stamp` `animal-edit-route` `animal-cast` `animal-tex` | REPL |
| 꾸미기(옷장 · 파츠 · 귀 · 색칠) |  | `wardrobe` `wardrobe-panel` `wd-ear` `human-ear` `human-ear-attach` `part-equip-mod` `part-xf` `part-paint` `part-color-entry` `part-ao-clean` `part-scene` `part-anim` `cloth-visibility` `deco-parts` `deco-parts-visibility` `closet` `closet-api` `wd-parts-persist` | **할 일** |
| 캐릭터 슬롯 저장 · 서버에 올리기 | `flow.js «GLB 올리기 · 받기»`(파일 왕복만 · 슬롯 화면은 안 거침) | `slot-save` `slot-codec` `char-apply` `def-size` `def-send` `char-identity` | 부분 |
| 얼굴 그림 올리기 · 받기 | `flow.js «얼굴 올리기 · 받기»`(파일 왕복 · 화면에서 다시 받기) | `upload-cache` `image-bytes` `face-loss` `face-heal` `room-face-load` `img-retry` | e2e |
| 캐릭터 · 커미션 코드(복제 · 가져오기) |  | `char-code` `clone-code-entry` `code-crypto` `commission` `commission-import` `asset-code` `asset-import` `asset-cards` | **할 일** |
| 책상 세팅 · 프리셋 · 책상 위 아이템 |  | `desk-setup` `desk-preset` `desk-items` `desk-item-equip` `desk-item-origin` `desk-place` `desk-visual` `desk-build` `desk-floor-clamp` `desk-part-scale` `item-rot` `interaction-desk` `saved-lists-wiring` | **할 일** |
| 카탈로그 받기 · 갱신 |  | `catalog-api` `catalog-sync` `catalog-glb` `catalog-cache` `glb-idb-cache` `http-cache-reset` | **할 일** |
| 가챠 · 모은 파츠 |  | `gacha` `gacha-api` `gacha-prune` `gacha-race` `wd-parts-persist` | **할 일** |

## 방

| 기능 | e2e | sim | 상태 |
|---|---|---|---|
| 방 만들기 · 참여(로비 · 방 코드) | `room/create-join`(로비 [방 만들기] · 로비 카드로 참여 · 서로 보임 · 최근 방 · 나가기) · 코드 칸 참여는 다른 방 시나리오가 모두 지나감 | `room-entry` `room-lobby-ui` `room-lobby` `room-settings` `lobby-window` `room-code-len` `recent-rooms` | e2e |
| 투게더룸(프리미엄 방) | `room/together-disband`(라이선스 없으면 만들기 창의 투게더룸 단추 꺼짐 · 관리자로 PLAY- 방 · 손님 참여) — 관리자는 `seed/admin.sql` | `license-premium` `room-entry` `dice-games` | e2e |
| 방 나가기 · 방장 넘기기 · 해산 | `room/host-settings`(방장이 나가면 남은 사람이 방장 · 다시 들어와도 그대로) · `room/together-disband`(이어받을 보유자 없으면 해산) · `room/create-join`(나가기) | `room-entry` `room-order` `room-meta-cleanup` | e2e |
| 시크릿룸 · 채팅 잠금 | `room/secret-room`(관리자 API 로 발급 · 주인이 «내 시크릿룸» 으로 열기 · 공개 목록에 없음 · 별표 없이는 다른 방 · «코드*» 로 손님 · 방장 잠금 · 풀기) | `chat-lock` `secret-room-grant` `room-order` | e2e |
| 방 정보 · 방 설정(제목 · 공개 · 인원) | `room/host-settings`(방장만 [방 설정] · 제목 · 비공개로 바꾸면 남도 받고 로비 API 에서 빠짐) · `room/create-join`(만들 때 제목 · 공개). 인원은 만들 때만 정한다(설계) | `room-info-ui` `room-settings` | e2e |
| 좌석 배치 · 내 자리 고정 · 자리 바꾸기 | `room/seat-status`(둘이 겹치지 않는 한 줄 · «맨 오른쪽 고정» 이면 내가 0번 · 되돌리기). 책상 · 이름표를 끌어 자리 바꾸기는 시나리오 없음 | `seats` `seat-layout` `seat-camera` `seat-pin` `seat-label-drag` `seat-sync-diff` `seat-refit` `seat-equalize` `seat-eq` `seat-eq-clamp` `seat-slot` `seat-model-load` `char-place` `fit-model` `fit-watch` | 부분 |
| 같은 계정은 한 자리만 | `room/same-account`(둘째 PC 가 친구 코드 · 비밀번호로 로그인해 같은 방 → 먼저 PC 토스트 · 방 밖 · 남 화면엔 한 자리) | `room-rt` `room-entry` | e2e |
| 좌석 우클릭 메뉴 · 숨기기 · 투명도 · 쓰다듬기 | `room/seat-status`(이름표 우클릭 메뉴 남 · 나 · 숨기기 · 다시 보이기 · 자리비움이면 몸 투명 · 눌러 쓰다듬기 → 상대 화면 이모지) | `seat-menu` `seat-panel` `seat-hide` `hidden-seats` `seat-opacity` `seat-opacity-mod` `seat-pointer` `seat-hit-targets` `seat-regions` | e2e |
| 내 모습이 남 화면에 맞게 가기(방 동기화) | `room/sync`(내 좌석 메뉴 › 캐릭터 편집 · 상의 색 → 남 화면 같은 색 · def 메시지) · `room/create-join`(서버 이름 · 레벨 · 이름 없으면 «이름 없음») | `room-sync` `room-parity` `room-live-def` `def-send` `room-rt` `room-state` | e2e |
| 방 놀이(깜짝쇼 · 때리기 · 러시안룰렛 · 주사위 · 이모지 · 플라잉체어 · 올라타기) | `room/games`(워킹룸 이모티콘 말풍선 · 룰렛 · 투게더룸 주사위 · 1 이면 내가 날아감 · /80 레벨 80 문턱 · 레벨 80(시드)으로 /80×3 깜짝쇼 · 때리기 · 💣 레벨 100 문턱 — 주사위 눈은 Math.random 고정) · `room/riding`(동물 숨김 해금 → 끌어 머리 위에 올라타기 · 남 화면). 💣 로 남을 날리기(레벨 100)는 문턱만 본다 | `tricks` `fly-egg` `fly-replay` `fly-roulette` `roulette` `dice-games` `floaters` `flying-chair` `ride-bench` `ride-chain` `ride-height` `ride-measure` `ride-part-top` `ride-tuning` | 부분 |
| 자리비움 그림 | `room/away-pic`(프리미엄 아니면 등록 막힘 · 내 정보에서 PNG 등록 → 서버 주소 · 자리비움이면 남 화면에 그림 · [기본으로]) | `away-pic` `away-follow` `away-start` | e2e |
| 방 접속 상태 · 활동 상태 · 상태칩 | `room/seat-status`(상태칩 «밥 먹는 중» · «온라인» 을 남이 받음 · 나가면 남 화면 좌석이 빠짐) | `presence` `user-status` `user-status-table` `seat-state` `status-chip` `chip-popups` `chip-chat-ui` `app-version` | e2e |
| 같이 듣기 · DJ | `room/listen`(서버 플레이리스트 곡 · 같이 듣기 방 · 방장 DJ 판정 · 이름표 «🎧 DJ» · 첫 곡 music 이 남에게 · 같이 듣기 창 곡 제목 · DJ 가 나가면 새 방장이 DJ) — 소리는 조용히 켜기가 끈다 | `listen-model` `listen-provider` `listen-ui` | e2e |
| 스티커사진(purikura) | `room/purikura`(정원 API · 둘이 같은 세션 · 방장만 [시작] · 시작하면 정원 하나 줄어듦 · 나가기). 촬영 · 꾸미기 · 저장은 시나리오 없음 | `purikura-ui` `purikura-net` `purikura-rt` `purikura-rules` `purikura-stage` `purikura-deco` `purikura-fish` `pk-bgm` `pk-fit` `ps1-dither` | 부분 |

## 채팅

| 기능 | e2e | sim | 상태 |
|---|---|---|---|
| 채팅 보내기 · 받기 · 기록 | `chat/send-receive`(둘이 주고받기 · 서버 기록 API) | `chat-rt` `chat-ui` `chat-window` `chat-tabs` `chat-layout` `chat-read-on-send` `chat-history` `chat-log-persist` | e2e |
| 채팅 기록 지우기(방장) · 투명도 · 글자 크기 · 알림음 | `chat/send-receive`(내 화면 지우기 · 되돌리기 · 방장만 기록 삭제 → 남 화면 · 서버에서 사라짐 · 창 닫아 두면 알림음) · `chat/prefs-emoji-fly`(투명도 · 글자 크기 · 알림음 끄기 · 소리 고르기 — 다시 켜도 남음) | `chat-prefs` `chat-sfx` `chat-delete-log` | e2e |
| 이모티콘 · 날리기 · 머리 위 말풍선 · 복사 | `chat/prefs-emoji-fly`(기본 이모티콘 → 남 대화창 그림 · 날리기 → 남 화면) · `chat/send-receive`(머리 위 말풍선 · «이 메시지 복사» — 클립보드는 가로채 셈). 내 이모티콘 등록은 시나리오 없음 | `demoji-catalog` `demoji-palette` `chat-fly` `overhead` `chat-copy` | 부분 |

## 친구 · 초대

| 기능 | e2e | sim | 상태 |
|---|---|---|---|
| 친구 요청 보내기 | `scenarios/social/friend-request-accept.js`(마이홈 › 친구 코드 → 보낸 요청 · 서버) | `friend-requests` `social-api` `add-friend` `seat-friend-req` | e2e |
| 친구 요청 받기 · 수락 · 거절 | `scenarios/social/friend-request-accept.js`(토스트 · 배지 · 목록 [수락]) · `scenarios/social/friend-request-decline.js`(팝업 [거절] · 목록 [거절] · 보낸 요청 취소) | `friend-requests` `social-api` `friend-manage` | e2e |
| 친구 목록 · 관리 · 끊기 | `scenarios/social/friend-list-remove.js`(이름 · Lv · 온라인 묶음 · 검색 · ✕ 끊기 · 상대 화면) | `friends-port` `friends-sub` `friend-manage` `friend-manage-module` `friend-profile-live` | e2e |
| 친구 접속 표시(온라인으로 보이기) | `scenarios/social/friend-presence.js`(토글 · 🔒 고정 show_online · 다시 켜도 숨김 · 앱 끄면 오프라인) | `friends-presence-rt` `presence-lock` | e2e |
| 친구 방 놀러 가기 · 친구 마이홈 구경 | `scenarios/social/friend-visit.js` | `friend-visit` `myhome-visit` | e2e |
| 방 초대 보내기 · 받기(3분 뒤 자동 거절) | `scenarios/social/room-invite.js`(수락 · 거절 · 3분은 렌더러 시계를 앞으로) | `room-invite-rt` `room-invite-ui` `room-invite-wait` | e2e |

## 마이홈

| 기능 | e2e | sim | 상태 |
|---|---|---|---|
| 마이홈 열기 · 꾸미기(배경 · 스티커 · 디자인 프리셋 · 본문 링크) | `REPL «친구 요청»` 이 열기만 지나감(꾸미기는 안 거침) | `myhome-init` `myhome-page` `myhome-load` `myhome-store` `myhome-wire` `myhome-ui` `myhome-steps` `myhome-state` `myhome-edit` `myhome-hooks` `myhome-preset` `myhome-links` `myhome-sticker` `myhome-sticker-layout` `myhome-sticker-render` `myhome-sticker-rules` `myhome-api` `mh-bg-url` `mh-pad-pos` `mh-title-nodrag` | 부분 |
| 마이홈 바탕화면 · 폴더 · 책장 북마크 | `scenarios/social/myhome-desktop.js`(폴더 숨기기 · 책 꽂기 · 공개 책만 친구에게) | `folder-free` `mhd-envsub` `mhd-hidefolders` `bookmark` `bookshelf-store` | e2e |
| 방명록 · 웹박수 | `scenarios/social/guestbook.js`(친구만 · 쓰기 · 박수 · 새 글 배지 · 지우기 — 창이 포커스를 잃으면 닫히는 동작은 막고 돌림) | `guestbook` `guestbook-api` `guestbook-feed` `guestbook-wiring` `mh-sanitize` `rich-text` | e2e |
| 말랑이 · 선물 보내기 · 받기 | `scenarios/social/mallang-gift.js`(라이선스 잠김 · 그림 등록(POST /v2/me/images → 칸 저장) — OS 파일 창은 main 의 dialog 를 바꿔 고른 파일을 준다 · 폴더 누르면 소환 · 친구 줄 우클릭 선물 보내기(서버 사본) · 받은 쪽 선물함) | `mallang-module` `mallang-store` `mallang-gift` `mallang-hide` `gift-api` `gift-box` `gift-save` `gift-img-retry` | e2e |
| 우편함 · 공지 | `scenarios/social/inbox-notice.js`(관리자 우편 · 읽음 · 지우기 · 소식) | `inbox-api` `inbox-sections` `mail-feed` `myhome-inbox` `notice-api` `notice-feed` `drag-scroll` | e2e |
| 일정 · 디데이 · 일정 알림 | `scenarios/social/schedule-dday.js`(일정 · 친구 태그 → 🔔 · D-day · 공개 범위) | `schedule-api` `scheduler` | e2e |
| 플레이리스트 | `scenarios/social/playlist.js`(곡 추가 — 유튜브 제목 조회는 가짜 답 · 서버 사본 · 친구 파도타기. 실제 재생은 유튜브라 안 봄) | `playlist` `playlist-api` `pl-grab-pick` `pl-loop` `pl-next` `pl-watchdog` `api-public-reads` `bgm-diag` | 부분 |
| 백색소음 | `scenarios/social/white-noise.js`(고르기 · 음량 · 같은 방 전파 · 남의 소리 끄기 · 다시 켜도 기억. 소리가 나는 때(타이핑 자세)는 OS 전역 키 입력이라 안 봄) | `noise` | 부분 |
| 도움말 탭 | `scenarios/social/help-tab.js`(도움말 사이트는 route-main.js 가 저장소의 firebase/hosting/help 로 답한다 · 목차 · 묶음 펴기 · 편 이동. 못 불러옴 E-MH-01 은 sim-help-tab 이 본다) | `help-tab` | e2e |

## 포커스 · 레벨

| 기능 | e2e | sim | 상태 |
|---|---|---|---|
| 포커스 시간 · 레벨 · 경험치 바 | `scenarios/social/focus-level.js`(올리기 API · 레벨 식 경계 0 · 3599 · 3600 · 999 상한 · 경험치 칸 · 내 정보 · 친구 Lv. «집중» 판정(앞 창 감지)은 OS 라 그 뒤 단계부터) | `focus-progress` `focus-total` `focus-day` `focus-level` `focus-api` `focus-gate` `focus-gate-self` `exp-bar` `exp-bar-color` `lv-tier` `idle-gate` `gamepad-activity` | 부분 |
| 포커스 기록 · 오늘 기록 보여 주기 | `scenarios/social/pomodoro.js` · `scenarios/social/weekly-challenge.js` 가 포커스 기록 창을 연다(누적 · 오늘 숫자 판정은 없음) | `focus-log` `focus-share` `focus-show` | 부분 |
| 뽀모도로 | `scenarios/social/pomodoro.js`(시작 · 일시정지 · 시간 다 됨 · 건너뛰기 · 다시 켜도 이어짐 · 멈춤) | `pomodoro` `pomodoro-module` | e2e |
| 달성표(한 주 도전) | `scenarios/social/weekly-challenge.js`(잠김 · 📋 규칙 만들기 · 오늘 달성 · 포기. 🎯 집중 · 🔁 반복은 포커싱 앱 등록이 OS 라 안 봄) | `weekly-challenge` `chal-store` | 부분 |
| 폰 · 태블릿 연결 | `scenarios/social/phone-link.js`(키 만들기 · 폰 신호는 폰 자동화와 같은 API · 사용 중 · 쉬는 중 · 잘못된 키 · 끊기) | `mobile-focus` `focus-api` `mobile-link-trim` | e2e |

## 알림 · 제보 · 신고

| 기능 | e2e | sim | 상태 |
|---|---|---|---|
| 토스트 · 오류 번호 알림 | `scenarios/social/toast-errors.js`(안내 토스트 · 서버 500 → E-FR-01 · tw-error.log · 다시 누르면 됨) | `toast` `error-codes` `api-errors` `error-log` | e2e |
| 버그 제보 게시판 | `scenarios/social/bug-board.js`(비공개 글 · 남에게 잠긴 줄 · 관리자가 본문 읽기 · 관리자 답변(API — 앱의 관리자 모드는 비밀번호 창이라 시험이 못 켠다) · 글쓴이 «새 답변» · 우편 · 열면 안 본 답 0. 관리자 답변 화면은 안 봄) | `bug-board` `bug-api` `bug-no` `bug-cleanup` | 부분 |
| 신고하기 | `scenarios/social/report.js`(이름표 우클릭 › 신고 · 숨김 · 관리자 목록) | `report` `report-away` | e2e |

일정 알림 · 채팅 알림음 · 방 초대 · 공지는 위 «마이홈» · «채팅» · «친구 · 초대» 표에 있다.

## 연결

| 기능 | e2e | sim | 상태 |
|---|---|---|---|
| 오프라인 → 온라인 다시 잇기 | `flow.js «오프라인» «온라인»`(크로미움 오프라인 흉내라 열린 realtime 웹소켓은 안 끊김 · 화면만 찍음 — README «함정») | `rt-hub` `rt-status-ui` `realtime-link` `net-ready` | 부분 |
| keepalive(조용하면 ping · 응답 없으면 끊고 다시 잇기) |  | `rt-hub` `realtime-link` `heartbeat` `heartbeat-policy` | **할 일** |
| 3D 장치 끊김 복구 |  | `gl-recover` `gl-context` | **할 일** |

## 관리자(앱 안)

| 기능 | e2e | sim | 상태 |
|---|---|---|---|
| 관리자 모드 들어가기 · 개발자 도구 열기 |  | `admin-mode` `admin-active` `admin-api` `admin-rules` `devtools-gate` | **할 일** |
| 사용자 관리 · 초대권 주기 · 관리자 런처 |  | `admin-users-launcher` | **할 일** |
| 라이선스 발급 · 엑셀 일괄 발급 · 시크릿룸 발급 |  | `admin-license` `license-xlsx` `secret-room-grant` | **할 일** |
| 파츠 · 책상 · 아이템 등록 · 카탈로그 쓰기 |  | `admin-part-register` `admin-asset` `admin-thumbs` `catalog-admin-api` `publish-fields` | **할 일** |
| 공지 · 업데이트 공지 편집 |  | `admin-notice` | **할 일** |
| 신고 목록 |  | `report` | **할 일** |
| 카테고리 관리 |  | `admin-license` `admin-mode` | **할 일** |

웹 관리자(`apps/admin`, 데스크톱 앱 밖)는 따로 Playwright e2e 가 있다 — `apps/admin/e2e/*.spec.ts`(`auth` `users` `license` `license-bulk` `secret-room` `notices` `reports` `rooms` `room-server` `settings` `metrics` `usage` `admin-log` `catalog-categories` `catalog-parts` `catalog-desks-items` `catalog-gacha` `catalog-diagnose` `smoke`), 돌리기는 `npm --prefix apps/admin run e2e`. 이 표에는 넣지 않았다.

## 발견한 버그

시나리오가 찾은 앱 버그. 시나리오는 `t.knownBug(번호, …)` 로 «고쳐졌어야 할 모습» 을 판정해 `steps.txt` 에 `BUG  <번호>` 줄을 남긴다(통과 판정은 바꾸지 않음). 고쳐져서 `FIXED` 가 나오면 이 줄을 지우고 시나리오의 그 자리를 일반 단계로 바꾼다.

| 번호 | 무엇이 틀렸나 | 다시 만들기 | 시나리오 |
|---|---|---|---|

## 할 일 — e2e 가 없거나 일부만 있는 기능

e2e 가 없는 기능(위 표의 **할 일**):

- 켜기 · 런처: 광고 배너 · 피규어 · 회사원 모드 · 이동 모드 · 창 앞뒤
- 캐릭터: 꾸미기 · 캐릭터 · 커미션 코드 · 책상 세팅 · 카탈로그 · 가챠
- 연결: keepalive · 3D 끊김 복구
- 관리자(앱 안): 전부

e2e 가 있지만 일부만 보는 기능(`부분`):

- 앱 켜기 순서 · 오프라인 → 온라인 — 화면만 찍고 판정하지 않는다. 다시 잇기는 README «함정» 처럼 realtime 컨테이너를 멈췄다 풀어야 실제로 끊긴다.
- 렌더러가 죽었을 때 — main 쪽(창 크기 · 다시 불러오기)까지만 본다. 다시 불러온 화면은 Playwright 아래에서 로드가 끝나지 않는다.
- 설정 창 — 런처 ⚙️ 설정만 본다(실행 화면 F1 설정 패널 — 캐릭터 크기 · 포커싱 어플 · 화면 표시 — 은 캐릭터가 있는 실행 화면이 필요해 빠짐).
- 런처 화면 · 마이홈 열기 · 친구 코드 고정 · 캐릭터 슬롯 저장 — 다른 흐름이 지나가기만 한다(마이홈 꾸미기는 e2e 없음).
- 좌석 배치 — 책상 · 이름표를 끌어 자리 바꾸기는 시나리오가 없다.
- 방 놀이 — 💣 로 남을 날리기(레벨 100)는 문턱(안내 토스트)만 본다.
- 스티커사진 — 세션 · 시작 · 정원까지. 촬영 · 꾸미기 · 저장은 시나리오가 없다.
- 이모티콘 — 내 이모티콘 등록(그림 올리기)은 시나리오가 없다.
- 플레이리스트 · 백색소음 · 포커스 시간 · 레벨 · 포커스 기록 · 달성표 — 시험이 만들 수 없는 몫(유튜브 재생 · OS 전역 키 입력 · 앞 창 감지 · 포커싱 앱 등록)은 빼고 그 다음 단계부터 판정한다(표의 e2e 열에 무엇을 뺐는지).

REPL 순서만 있는 기능(`REPL` — 자동 판정 없음): 책상 모드 · 서버 점검 · 캐릭터 만들기.
