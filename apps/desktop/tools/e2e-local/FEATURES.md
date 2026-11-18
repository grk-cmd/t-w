# e2e 기능 지도 — 0.13 데스크톱 앱

0.13 데스크톱 앱에서 사용자가 쓰는 기능마다, 그 기능을 끝까지 몰아 보는 e2e 시나리오와 로직을 보는 sim 이 있는지 적은 표다. 새 시나리오를 만들 때 이 표의 **할 일** 줄부터 고른다. 시나리오나 sim 을 더하거나 지우면 이 표도 같은 PR 에서 고친다.

## 읽는 법

- **e2e** 열
  - `flow.js «단계»` — `node flow.js <결과 폴더>` 가 스스로 도는 단계(README «flow.js — 한 바퀴»).
  - `REPL «항목»` — README «해 본 것 — REPL 로» 에 적은, 손으로 명령을 보내 확인한 순서. 스크립트가 아니라 다시 돌리려면 사람이 `run.sh` 로 보낸다.
  - 비어 있으면 e2e 가 없다.
- **sim** 열 — `checks/sim-<이름>.js` 의 `<이름>`. 돌리기는 `node checks/run.js <이름>`. sim 은 모듈을 가짜 화면 · 가짜 서버로 돌려 로직을 보는 검사라, 앱을 켜서 화면을 끝까지 누르지 않는다.
- **상태**
  - `e2e` — flow.js 가 판정까지 한다.
  - `REPL` — 손으로 돌린 순서만 있다(자동 판정 없음).
  - `부분` — e2e 가 기능 일부만 지나가거나, 화면을 찍기만 하고 판정하지 않는다(무엇이 빠졌는지 e2e 열에 적음).
  - **할 일** — e2e 가 없다.

sim 가운데 구조 · 빌드 · 진단 · 서버 함수만 보는 것(`app-size` `lint` `rules-keys` `env-diag` `daily-active` 등)과 앱에 없는 설계의 순수 로직(`town-32` `village-addr` `yard-enter`)은 사용자 기능에 매이지 않아 표에 넣지 않았다.

## 켜기 · 런처 · 실행 화면

| 기능 | e2e | sim | 상태 |
|---|---|---|---|
| 앱 켜기 순서 | `flow.js «로그인된 책상»`(다시 켠 뒤 15초 기다려 화면만 찍음) | `app-boot` `run-boot` `dom-boot` `user-local` · 부팅 스모크 `checks/smoke.js` | 부분 |
| 두 번째 실행(이미 켠 창을 앞으로) |  | `second-instance` | **할 일** |
| 렌더러가 죽었을 때 런처로 되돌리기 |  | `renderer-gone-reset` | **할 일** |
| 런처 화면(미리보기 · 슬롯 · 타이틀바 · 컨트롤) | `REPL «캐릭터 만들기»` 가 런처에서 시작(런처 자체는 판정 안 함) | `launcher-chrome` `launcher-controls` `launcher-preview` `launcher-state` `app-mode` `cfg-fit` `slot-fit` `zoom-window` | 부분 |
| 런처 광고 배너 · 게임 설정 |  | `ad-banner` | **할 일** |
| 책상 모드(데스크톱 실행 화면 · 클릭 통과) | `REPL «책상 모드»` | `desktop-run` `click-through-policy` `hit-map` `hit-shadow` `overlay-gap` `overlay-layered` `top-level` `run-rect` `display-pick` `system-prompt` `pen-forward` `hover-poke` `fly-click-through` | REPL |
| 피규어 · 회사원 모드 |  | `office-mode` `figure-mode` `window-mode` | **할 일** |
| 프로그램 이동 모드 |  | `move-mode` | **할 일** |
| 설정 창(캐릭터 크기 · 포커싱 어플 · 테마 · 화면 크기 · 화질 · 단축키) |  | `settings-panel` `program-settings` `panel-fit` `winlist` `theme` `theme-ui` `child-theme` `ui-zoom` `fn-keys` `key-input` `no-default-menu` `frame-budget` `unfocused-fps` | **할 일** |
| 오픈소스 라이선스 창 |  | `oss-licenses` | **할 일** |
| 창 앞뒤 · 바깥 눌러 닫기 |  | `win-stack` `win-front` `win-layers` `z-layers` `outside-close` | **할 일** |

## 계정 · 로그인 · PC 등록

| 기능 | e2e | sim | 상태 |
|---|---|---|---|
| 초대 코드로 가입 | `flow.js «초대 화면» «초대 코드 입력» «가입»` | `signup` `license-gate` `name-guard` | e2e |
| 가입 뒤 다시 켜기 · 로그인 유지 | `flow.js «시작하기 → 다시 켜기» «로그인된 책상»`(로그인이 남았는지는 뒤 단계 «얼굴 올리기 · 받기» 의 내 정보 요청이 성공해야 통과) | `login-flow` `account` `session` `session-baseline` `account-state` `account-store` `user-api` `first-run-013` | e2e |
| 로그인 화면(친구 코드 · 비밀번호 · 구글) · 구글로 가입 |  | `login-flow` `account` `session` | **할 일** |
| 비밀번호 바꾸기 · 구글 계정에 비밀번호 붙이기 |  | `user-api` `account` | **할 일** |
| 회원 탈퇴 |  | `account-delete` `account` `my-info` `user-api` | **할 일** |
| 친구 코드 고정 | `flow.js «초대 코드 입력»` 이 가입 화면의 친구 코드를 읽어 `account.json` 에 적음(바뀌지 않는지는 안 봄) | `friend-code-keep` | 부분 |
| 로그아웃 | `REPL «로그아웃»` | `account` `account-switch` `signup` | REPL |
| 같은 PC 에서 계정 바꾸기 |  | `account-switch` `account-store` | **할 일** |
| 닉네임 바꾸기 · 운영진처럼 보이는 이름 막기 |  | `user-name` `name-guard` `person-name` | **할 일** |
| 내 정보 · 보관함 · 휴지통 |  | `my-info` `my-info-box` | **할 일** |
| 초대장 발급(친구를 가입에 초대) |  | `license-gate` `user-api` | **할 일** |
| 라이선스 · 프리미엄 등록 |  | `license-api` `license-key` `license-ui` `license-screen` `license-premium` `license-leak` `premium-assets` `premium-desk` | **할 일** |
| PC 등록(계정마다 3대 · 넷째 PC 는 묻고 하나 지움) |  | `device-register` `device-limit-dialog` `device-id` `license-screen` | **할 일** |
| PC 연결이 끊긴 뒤 안내(다른 PC 에서 이 PC 를 지움 · 이 PC 에서 새로 연 앱에 밀림) |  | `device-lost` | **할 일** |
| 서버 점검 화면 | `REPL «점검 켜고 끄기»` | `maintenance-gate` `remote-config` | REPL |
| 판 확인(강제 · 선택 업데이트 · 최소 판) |  | `update-flow` `app-version-sync` `app-version` `remote-config` `mac-update` `update-diag` | **할 일** |

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
| 방 만들기 · 참여(로비 · 방 코드) | `REPL «방 만들기 · 참여»`(결과 폴더 둘로 앱 두 벌) | `room-entry` `room-lobby-ui` `room-lobby` `room-settings` `lobby-window` `room-code-len` `recent-rooms` | REPL |
| 투게더룸(프리미엄 방) | `REPL «투게더룸»`(로컬 DB 에서 관리자로 만들어 프리미엄을 붙임) | `license-premium` `room-entry` `dice-games` | REPL |
| 방 나가기 · 방장 넘기기 · 해산 |  | `room-entry` `room-order` `room-meta-cleanup` | **할 일** |
| 시크릿룸 · 채팅 잠금 |  | `chat-lock` `secret-room-grant` `room-order` | **할 일** |
| 방 정보 · 방 설정(제목 · 공개 · 인원) |  | `room-info-ui` `room-settings` | **할 일** |
| 좌석 배치 · 내 자리 고정 · 자리 바꾸기 |  | `seats` `seat-layout` `seat-camera` `seat-pin` `seat-label-drag` `seat-sync-diff` `seat-refit` `seat-equalize` `seat-eq` `seat-eq-clamp` `seat-slot` `seat-model-load` `char-place` `fit-model` `fit-watch` | **할 일** |
| 같은 계정은 한 자리만 |  | `room-rt` `room-entry` | **할 일** |
| 좌석 우클릭 메뉴 · 숨기기 · 투명도 · 쓰다듬기 |  | `seat-menu` `seat-panel` `seat-hide` `hidden-seats` `seat-opacity` `seat-opacity-mod` `seat-pointer` `seat-hit-targets` `seat-regions` | **할 일** |
| 내 모습이 남 화면에 맞게 가기(방 동기화) |  | `room-sync` `room-parity` `room-live-def` `def-send` `room-rt` `room-state` | **할 일** |
| 방 놀이(깜짝쇼 · 때리기 · 러시안룰렛 · 주사위 · 이모지 · 플라잉체어 · 올라타기) |  | `tricks` `fly-egg` `fly-replay` `fly-roulette` `roulette` `dice-games` `floaters` `flying-chair` `ride-bench` `ride-chain` `ride-height` `ride-measure` `ride-part-top` `ride-tuning` | **할 일** |
| 자리비움 그림 |  | `away-pic` `away-follow` `away-start` | **할 일** |
| 방 접속 상태 · 활동 상태 · 상태칩 |  | `presence` `user-status` `user-status-table` `seat-state` `status-chip` `chip-popups` `chip-chat-ui` `app-version` | **할 일** |
| 같이 듣기 · DJ |  | `listen-model` `listen-provider` `listen-ui` | **할 일** |
| 스티커사진(purikura) |  | `purikura-ui` `purikura-net` `purikura-rt` `purikura-rules` `purikura-stage` `purikura-deco` `purikura-fish` `pk-bgm` `pk-fit` `ps1-dither` | **할 일** |

## 채팅

| 기능 | e2e | sim | 상태 |
|---|---|---|---|
| 채팅 보내기 · 받기 · 기록 | `REPL «채팅»` | `chat-rt` `chat-ui` `chat-window` `chat-tabs` `chat-layout` `chat-read-on-send` `chat-history` `chat-log-persist` | REPL |
| 채팅 기록 지우기(방장) · 투명도 · 글자 크기 · 알림음 |  | `chat-prefs` `chat-sfx` `chat-delete-log` | **할 일** |
| 이모티콘 · 날리기 · 머리 위 말풍선 · 복사 |  | `demoji-catalog` `demoji-palette` `chat-fly` `overhead` `chat-copy` | **할 일** |

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
| 말랑이 · 선물 보내기 · 받기 | `scenarios/social/mallang-gift.js`(라이선스 잠김 · 그림 등록(POST /v2/me/images → 칸 저장) — OS 파일 창은 main 의 dialog 를 바꿔 고른 파일을 준다 · 폴더 누르면 소환 · 친구 줄 우클릭 선물 보내기(서버 사본) · 받은 쪽 선물함) | `mallang-module` `mallang-store` `mallang-gift` `mallang-hide` `gift-api` `gift-box` `gift-save` `gift-img-retry` | 부분: Storage |
| 우편함 · 공지 | `scenarios/social/inbox-notice.js`(관리자 우편 · 읽음 · 지우기 · 소식) | `inbox-api` `inbox-sections` `mail-feed` `myhome-inbox` `notice-api` `notice-feed` `drag-scroll` | e2e |
| 일정 · 디데이 · 일정 알림 | `scenarios/social/schedule-dday.js`(일정 · 친구 태그 → 🔔 · D-day · 공개 범위) | `schedule-api` `scheduler` | e2e |
| 플레이리스트 | `scenarios/social/playlist.js`(곡 추가 — 유튜브 제목 조회는 가짜 답 · 서버 사본 · 친구 파도타기. 실제 재생은 유튜브라 안 봄) | `playlist` `playlist-api` `pl-grab-pick` `pl-loop` `pl-next` `pl-watchdog` `api-public-reads` `bgm-diag` | 부분 |
| 백색소음 | `scenarios/social/white-noise.js`(고르기 · 음량 · 같은 방 전파 · 남의 소리 끄기 · 다시 켜도 기억. 소리가 나는 때(타이핑 자세)는 OS 전역 키 입력이라 안 봄) | `noise` | 부분 |
| 도움말 탭 | `scenarios/social/help-tab.js`(저장소의 도움말 페이지를 돌려줌 · 목차 · 편 이동 · 못 불러옴 E-MH-01) | `help-tab` | e2e |

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

## 할 일 — e2e 가 없거나 일부만 있는 기능

e2e 가 없는 기능(위 표의 **할 일**):

- 켜기 · 런처: 두 번째 실행 · 렌더러가 죽었을 때 런처로 · 광고 배너 · 피규어 · 회사원 모드 · 이동 모드 · 설정 창 · 오픈소스 라이선스 창 · 창 앞뒤
- 계정: 로그인 화면 · 구글 로그인 · 가입 · 비밀번호 바꾸기 · 회원 탈퇴 · 같은 PC 계정 바꾸기 · 닉네임 · 내 정보 · 초대장 발급 · 라이선스 · 프리미엄 등록 · **PC 등록(3대 · 넷째 PC 확인)** · PC 연결이 끊긴 뒤 안내 · 판 확인(업데이트)
- 캐릭터: 꾸미기 · 캐릭터 · 커미션 코드 · 책상 세팅 · 카탈로그 · 가챠
- 방: 나가기 · 방장 넘기기 · 시크릿룸 · 방 설정 · 좌석 배치 · **같은 계정 한 자리** · 좌석 메뉴 · 방 동기화 · 방 놀이 · 자리비움 그림 · 접속 · 활동 상태 · 같이 듣기 · 스티커사진
- 채팅: 기록 지우기 · 채팅 설정 · 이모티콘 · 날리기 · 말풍선
- 연결: keepalive · 3D 끊김 복구
- 관리자(앱 안): 전부

e2e 가 있지만 일부만 보는 기능(`부분`):

- 앱 켜기 순서 · 오프라인 → 온라인 — 화면만 찍고 판정하지 않는다. 다시 잇기는 README «함정» 처럼 realtime 컨테이너를 멈췄다 풀어야 실제로 끊긴다.
- 런처 화면 · 마이홈 열기 · 친구 코드 고정 · 캐릭터 슬롯 저장 — 다른 흐름이 지나가기만 한다(마이홈 꾸미기는 e2e 없음).
- 플레이리스트 · 백색소음 · 포커스 시간 · 레벨 · 포커스 기록 · 달성표 — 시험이 만들 수 없는 몫(유튜브 재생 · OS 전역 키 입력 · 앞 창 감지 · 포커싱 앱 등록)은 빼고 그 다음 단계부터 판정한다(표의 e2e 열에 무엇을 뺐는지).

REPL 순서만 있는 기능(`REPL` — 자동 판정 없음): 책상 모드 · 로그아웃 · 서버 점검 · 캐릭터 만들기 · 방 만들기 · 참여 · 투게더룸 · 채팅.
