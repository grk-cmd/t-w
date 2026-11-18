# e2e 기능 지도 — 0.13 데스크톱 앱

0.13 데스크톱 앱에서 사용자가 쓰는 기능마다, 그 기능을 끝까지 몰아 보는 e2e 시나리오와 로직을 보는 sim 이 있는지 적은 표다. 새 시나리오를 만들 때 이 표의 **할 일** 줄부터 고른다. 시나리오나 sim 을 더하거나 지우면 이 표도 같은 PR 에서 고친다.

## 읽는 법

- **e2e** 열
  - `flow.js «단계»` — `node flow.js <결과 폴더>` 가 스스로 도는 단계(README «flow.js — 한 바퀴»).
  - `core/<이름>.js «단계»` — `scenarios/core/<이름>.js` 시나리오(`node run-all.js core/<이름>` · README «run-all.js»). 판정까지 한다.
  - `REPL «항목»` — README «해 본 것 — REPL 로» 에 적은, 손으로 명령을 보내 확인한 순서. 스크립트가 아니라 다시 돌리려면 사람이 `run.sh` 로 보낸다.
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
| 앱 켜기 순서 | `core/boot-offline-online.js «켜기»`(다시 켠 앱이 시험보다 먼저 스스로 /v2/me 200 · realtime ready · 런처 · 화면 오류 없음). /v2/me 와 realtime 의 앞뒤 순서는 안 봄(웹소켓은 요청 기록에 없음) | `app-boot` `run-boot` `dom-boot` `user-local` · 부팅 스모크 `checks/smoke.js` | e2e |
| 두 번째 실행(이미 켠 창을 앞으로) |  | `second-instance` | **할 일** |
| 렌더러가 죽었을 때 런처로 되돌리기 |  | `renderer-gone-reset` | **할 일** |
| 런처 화면(미리보기 · 슬롯 · 타이틀바 · 컨트롤) | `REPL «캐릭터 만들기»` 가 런처에서 시작(런처 자체는 판정 안 함) | `launcher-chrome` `launcher-controls` `launcher-preview` `launcher-state` `app-mode` `cfg-fit` `slot-fit` `zoom-window` | 부분 |
| 런처 광고 배너 · 게임 설정 | `core/ad-banner.js`(관리자 배너 저장 → 다른 사람 런처에 서버 알림으로 · 4초 넘김 · 비우면 숨음 · 동물 해금 레벨이 카탈로그에) | `ad-banner` | e2e |
| 책상 모드(데스크톱 실행 화면 · 클릭 통과) | `core/desk-mode.js`(작업 영역 크기 · 맨 위 · setIgnoreMouseEvents true · 이름표 · 런처로 돌아오기). 캐릭터 위에서만 클릭 받기는 OS 마우스 자리로 판정해서 안 봄(합성 마우스는 OS 커서를 안 움직임) — sim 몫 | `desktop-run` `click-through-policy` `hit-map` `hit-shadow` `overlay-gap` `overlay-layered` `top-level` `run-rect` `display-pick` `system-prompt` `pen-forward` `hover-poke` `fly-click-through` | e2e |
| 피규어 · 회사원 모드 | `core/figure-office.js`(피규어 끔 → 잠듦 Z · 켬 → 안 잠듦 · 회사원 ■ 우클릭 숨김 · 다시 켜도 유지) | `office-mode` `figure-mode` `window-mode` | e2e |
| 프로그램 이동 모드 | `core/move-mode.js`(앱이 그리는 지금 자리 기준 — 이동 모드에서 마우스를 따라감 · 눌러 확정하면 tw.deskPan 저장값 = 지금 자리 · 확정 뒤 안 따라감 · 다시 켜면 지금 자리가 저장값으로 되살아남) | `move-mode` | e2e |
| 설정 창(캐릭터 크기 · 포커싱 어플 · 테마 · 화면 크기 · 화질 · 단축키) |  | `settings-panel` `program-settings` `panel-fit` `winlist` `theme` `theme-ui` `child-theme` `ui-zoom` `fn-keys` `key-input` `no-default-menu` `frame-budget` `unfocused-fps` | **할 일** |
| 오픈소스 라이선스 창 |  | `oss-licenses` | **할 일** |
| 창 앞뒤 · 바깥 눌러 닫기 | `core/win-stack.js`(마이홈 · 포커스 기록 창 누른 창 맨 앞 · ESC 는 나중 연 창부터 · 프로그램 설정 바깥 눌러 닫기). OS 창끼리의 앞뒤(다른 프로그램 위)는 OS 창 순서를 못 읽어 안 봄 — 맨 위(alwaysOnTop)만 desk-mode.js | `win-stack` `win-front` `win-layers` `z-layers` `outside-close` | e2e |

## 계정 · 로그인 · PC 등록

| 기능 | e2e | sim | 상태 |
|---|---|---|---|
| 초대 코드로 가입 | `flow.js «초대 화면» «초대 코드 입력» «가입»` | `signup` `license-gate` `name-guard` | e2e |
| 가입 뒤 다시 켜기 · 로그인 유지 | `flow.js «시작하기 → 다시 켜기» «로그인된 책상»`(로그인이 남았는지는 뒤 단계 «얼굴 올리기 · 받기» 의 내 정보 요청이 성공해야 통과) | `login-flow` `account` `session` `session-baseline` `account-state` `account-store` `user-api` `first-run-013` | e2e |
| 로그인 화면(친구 코드 · 비밀번호 · 구글) · 구글로 가입 |  | `login-flow` `account` `session` | **할 일** |
| 비밀번호 바꾸기 · 구글 계정에 비밀번호 붙이기 |  | `user-api` `account` | **할 일** |
| 회원 탈퇴 |  | `account-delete` `account` `my-info` `user-api` | **할 일** |
| 친구 코드 고정 | `flow.js «초대 코드 입력»` 이 가입 화면의 친구 코드를 읽어 `account.json` 에 적음(바뀌지 않는지는 안 봄) | `friend-code-keep` | 부분 |
| 로그아웃 | `core/logout-maintenance.js «로그아웃»`(내 정보 › 계정 › 로그아웃 → 다시 켜기 → 로그인 화면 · 토큰 없음 · 친구 코드로 다시 로그인하면 같은 계정) | `account` `account-switch` `signup` | e2e |
| 같은 PC 에서 계정 바꾸기 |  | `account-switch` `account-store` | **할 일** |
| 닉네임 바꾸기 · 운영진처럼 보이는 이름 막기 |  | `user-name` `name-guard` `person-name` | **할 일** |
| 내 정보 · 보관함 · 휴지통 |  | `my-info` `my-info-box` | **할 일** |
| 초대장 발급(친구를 가입에 초대) |  | `license-gate` `user-api` | **할 일** |
| 라이선스 · 프리미엄 등록 |  | `license-api` `license-key` `license-ui` `license-screen` `license-premium` `license-leak` `premium-assets` `premium-desk` | **할 일** |
| PC 등록(계정마다 3대 · 넷째 PC 는 묻고 하나 지움) |  | `device-register` `device-limit-dialog` `device-id` `license-screen` | **할 일** |
| PC 연결이 끊긴 뒤 안내(다른 PC 에서 이 PC 를 지움 · 이 PC 에서 새로 연 앱에 밀림) |  | `device-lost` | **할 일** |
| 서버 점검 화면 | `core/logout-maintenance.js «점검»`(관리자 PUT app.maintenance → 서버를 쓰는 단추에 점검 창 · 끄면 «다시 켜기» 안내 · 스택 잠금 안에서 · 끝에 끔) | `maintenance-gate` `remote-config` | e2e |
| 판 확인(강제 · 선택 업데이트 · 최소 판) |  | `update-flow` `app-version-sync` `app-version` `remote-config` `mac-update` `update-diag` | **할 일** |

## 캐릭터 · 책상 · 가챠

| 기능 | e2e | sim | 상태 |
|---|---|---|---|
| 캐릭터 만들기(생성기 · 종족 고르기 · 얼굴 그리기) | `core/creator-desk.js`(+ → 인간 → 완성 → 서버 보관함 슬롯 · def). 얼굴 그리기(붓질)는 안 거침 | `creator-flow` `creator-open` `creator-state` `creator-save` `creator-preview` `creator-face` `creator-canvas` `creator-xform` `creator-flat-view` `race-picker` `paint-stroke` `paint-tools` `paint-geom` `uv-fill` `cr-stamp` `animal-edit-route` `animal-cast` `animal-tex` | 부분 |
| 꾸미기(옷장 · 파츠 · 귀 · 색칠) | 로컬 묶음에서 못 돎 — API 에 Storage 봇이 없어 카탈로그 파츠 GLB 를 받지 못한다(`GET /v2/catalog/assets/*` 503 STORAGE_UNAVAILABLE). 서버 묶음 compose.emulator.yml 에 Storage 봇(에뮬레이터 주소 · 봇 계정)이 생기면 시나리오를 더한다 | `wardrobe` `wardrobe-panel` `wd-ear` `human-ear` `human-ear-attach` `part-equip-mod` `part-xf` `part-paint` `part-color-entry` `part-ao-clean` `part-scene` `part-anim` `cloth-visibility` `deco-parts` `deco-parts-visibility` `closet` `closet-api` `wd-parts-persist` | 부분: Storage |
| 캐릭터 슬롯 저장 · 서버에 올리기 | `flow.js «GLB 올리기 · 받기»`(파일 왕복만 · 슬롯 화면은 안 거침) | `slot-save` `slot-codec` `char-apply` `def-size` `def-send` `char-identity` | 부분 |
| 얼굴 그림 올리기 · 받기 | `flow.js «얼굴 올리기 · 받기»`(파일 왕복 · 화면에서 다시 받기) | `upload-cache` `image-bytes` `face-loss` `face-heal` `room-face-load` `img-retry` | e2e |
| 캐릭터 · 커미션 코드(복제 · 가져오기) | `core/char-code.js`(복제 코드 DCC1 내보내기 → 다른 사람이 틀린 암호 거절 · 맞는 암호로 같은 캐릭터 · 커미션 zip → DCM1 → 등록) | `char-code` `clone-code-entry` `code-crypto` `commission` `commission-import` `asset-code` `asset-import` `asset-cards` | e2e |
| 책상 세팅 · 프리셋 · 책상 위 아이템 | `core/creator-desk.js`(책상 색 · 크기 → 프리셋 저장 · 불러오기 · 서버 def · 다시 켜도 프리셋). 책상 위 아이템 · 카탈로그 책상 모델은 Storage 봇이 없어 안 거침(꾸미기 줄과 같은 까닭) | `desk-setup` `desk-preset` `desk-items` `desk-item-equip` `desk-item-origin` `desk-place` `desk-visual` `desk-build` `desk-floor-clamp` `desk-part-scale` `item-rot` `interaction-desk` `saved-lists-wiring` | 부분: Storage |
| 카탈로그 받기 · 갱신 | `core/catalog-gacha.js «카탈로그»`(seed/catalog-parts.sql 줄 → 관리자 이름 고침 → 서버 카탈로그 · 앱 다시 받기). 파일(GLB · 썸네일) 받기는 Storage 봇이 없어 안 거침 | `catalog-api` `catalog-sync` `catalog-glb` `catalog-cache` `glb-idb-cache` `http-cache-reset` | 부분: Storage |
| 가챠 · 모은 파츠 | `core/catalog-gacha.js «가챠»`(레벨 12 + 보너스 1 → 서버 earned 2 · bonus 1 · left 3 = floor(12/5)+1 · 앱 «남은 뽑기 3회» · 다음 Lv 15 · 1회 뽑기 → 2회 · 보유분) | `gacha` `gacha-api` `gacha-prune` `gacha-race` `wd-parts-persist` | e2e |

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
| 친구 요청 보내기 | `REPL «친구 요청»` | `friend-requests` `social-api` `add-friend` `seat-friend-req` | REPL |
| 친구 요청 받기 · 수락 · 거절 |  | `friend-requests` `social-api` `friend-manage` | **할 일** |
| 친구 목록 · 관리 · 끊기 |  | `friends-port` `friends-sub` `friend-manage` `friend-manage-module` `friend-profile-live` | **할 일** |
| 친구 접속 표시(온라인으로 보이기) |  | `friends-presence-rt` `presence-lock` | **할 일** |
| 친구 방 놀러 가기 · 친구 마이홈 구경 |  | `friend-visit` `myhome-visit` | **할 일** |
| 방 초대 보내기 · 받기(3분 뒤 자동 거절) |  | `room-invite-rt` `room-invite-ui` `room-invite-wait` | **할 일** |

## 마이홈

| 기능 | e2e | sim | 상태 |
|---|---|---|---|
| 마이홈 열기 · 꾸미기(배경 · 스티커 · 디자인 프리셋 · 본문 링크) | `REPL «친구 요청»` 이 열기만 지나감(꾸미기는 안 거침) | `myhome-init` `myhome-page` `myhome-load` `myhome-store` `myhome-wire` `myhome-ui` `myhome-steps` `myhome-state` `myhome-edit` `myhome-hooks` `myhome-preset` `myhome-links` `myhome-sticker` `myhome-sticker-layout` `myhome-sticker-render` `myhome-sticker-rules` `myhome-api` `mh-bg-url` `mh-pad-pos` `mh-title-nodrag` | 부분 |
| 마이홈 바탕화면 · 폴더 · 책장 북마크 |  | `folder-free` `mhd-envsub` `mhd-hidefolders` `bookmark` `bookshelf-store` | **할 일** |
| 방명록 · 웹박수 |  | `guestbook` `guestbook-api` `guestbook-feed` `guestbook-wiring` `mh-sanitize` `rich-text` | **할 일** |
| 말랑이 · 선물 보내기 · 받기 |  | `mallang-module` `mallang-store` `mallang-gift` `mallang-hide` `gift-api` `gift-box` `gift-save` `gift-img-retry` | **할 일** |
| 우편함 · 공지 |  | `inbox-api` `inbox-sections` `mail-feed` `myhome-inbox` `notice-api` `notice-feed` `drag-scroll` | **할 일** |
| 일정 · 디데이 · 일정 알림 |  | `schedule-api` `scheduler` | **할 일** |
| 플레이리스트 |  | `playlist` `playlist-api` `pl-grab-pick` `pl-loop` `pl-next` `pl-watchdog` `api-public-reads` `bgm-diag` | **할 일** |
| 백색소음 |  | `noise` | **할 일** |
| 도움말 탭 |  | `help-tab` | **할 일** |

## 포커스 · 레벨

| 기능 | e2e | sim | 상태 |
|---|---|---|---|
| 포커스 시간 · 레벨 · 경험치 바 |  | `focus-progress` `focus-total` `focus-day` `focus-level` `focus-api` `focus-gate` `focus-gate-self` `exp-bar` `exp-bar-color` `lv-tier` `idle-gate` `gamepad-activity` | **할 일** |
| 포커스 기록 · 오늘 기록 보여 주기 |  | `focus-log` `focus-share` `focus-show` | **할 일** |
| 뽀모도로 |  | `pomodoro` `pomodoro-module` | **할 일** |
| 달성표(한 주 도전) |  | `weekly-challenge` `chal-store` | **할 일** |
| 폰 · 태블릿 연결 |  | `mobile-focus` `focus-api` `mobile-link-trim` | **할 일** |

## 알림 · 제보 · 신고

| 기능 | e2e | sim | 상태 |
|---|---|---|---|
| 토스트 · 오류 번호 알림 |  | `toast` `error-codes` `api-errors` `error-log` | **할 일** |
| 버그 제보 게시판 |  | `bug-board` `bug-api` `bug-no` `bug-cleanup` | **할 일** |
| 신고하기 |  | `report` `report-away` | **할 일** |

일정 알림 · 채팅 알림음 · 방 초대 · 공지는 위 «마이홈» · «채팅» · «친구 · 초대» 표에 있다.

## 연결

| 기능 | e2e | sim | 상태 |
|---|---|---|---|
| 오프라인 → 온라인 다시 잇기 | `core/boot-offline-online.js`(크로미움 오프라인 + realtime 컨테이너 멈춤 → retrying · API 막힘 → 풀고 online 이벤트 → 5초 안에 ready) | `rt-hub` `rt-status-ui` `realtime-link` `net-ready` | e2e |
| keepalive(조용하면 ping · 응답 없으면 끊고 다시 잇기) | `core/keepalive.js`(realtime 컨테이너 pause → 조용함 뒤 ping · 5초 뒤 끊음 · 20초 안 · 15초 넘게 못 붙으면 «다시 연결하는 중» 띠 · unpause → ready · 띠 사라짐 · presenceGet 답) | `rt-hub` `realtime-link` `heartbeat` `heartbeat-policy` | e2e |
| 3D 장치 끊김 복구 | `core/gl-recover.js`(WEBGL_lose_context — 6초 안 복구면 그대로 · 안 돌아오면 6초 뒤 다시 켜기 · 10분 안 또 끊기면 안내 창) | `gl-recover` `gl-context` | e2e |

## 관리자(앱 안)

| 기능 | e2e | sim | 상태 |
|---|---|---|---|
| 관리자 모드 들어가기 · 개발자 도구 열기 | `core/admin-mode.js`(비밀번호 창 uid · 틀린 비밀번호 · 서버 관리자 아님 · 관리자 → 모드 켜짐 · Ctrl+E 끔). 개발자 도구 막기는 설치본에서만 돌아(dev 판은 늘 열림) 안 봄 — sim 몫 | `admin-mode` `admin-active` `admin-api` `admin-rules` `devtools-gate` | 부분 |
| 사용자 관리 · 초대권 주기 · 관리자 런처 | `core/admin-license.js «초대권»`(친구 코드로 2장 → 서버 남은 장 · 다시 켠 런처 수). 📊 통계 창은 안 거침 | `admin-users-launcher` | 부분 |
| 라이선스 발급 · 엑셀 일괄 발급 · 시크릿룸 발급 | `core/admin-license.js`(친구 코드로 발급 → 수령함 키 → 등록 → premium · 새 키 목록 · 시크릿룸 SCRT 코드 주인). 엑셀 일괄은 안 거침 | `admin-license` `license-xlsx` `secret-room-grant` | 부분 |
| 파츠 · 책상 · 아이템 등록 · 카탈로그 쓰기 | `core/catalog-gacha.js`(카탈로그 이름 고침 · 단종) · `core/ad-banner.js`(게임 설정 해금 레벨) · `core/admin-content.js`(카테고리). 등록 창(파일 올리기)은 Storage 봇이 없어 `POST /v2/admin/catalog/assets` 가 503 — 못 돎 | `admin-part-register` `admin-asset` `admin-thumbs` `catalog-admin-api` `publish-fields` | 부분: Storage |
| 공지 · 업데이트 공지 편집 | `core/admin-content.js`(확성기 → 다른 사람 머리 위 · 종료 · 업데이트 공지 → 다시 켤 때 공지 창) | `admin-notice` | e2e |
| 신고 목록 | `core/admin-content.js «신고»`(앱 없는 세 계정이 신고 → 관리자 목록 «3명» · 문제없음 → 빠짐) | `report` | e2e |
| 카테고리 관리 | `core/admin-content.js «카테고리»`(추가 → 다른 사람 카탈로그에 · 끝에 지움) | `admin-license` `admin-mode` | e2e |

웹 관리자(`apps/admin`, 데스크톱 앱 밖)는 따로 Playwright e2e 가 있다 — `apps/admin/e2e/*.spec.ts`(`auth` `users` `license` `license-bulk` `secret-room` `notices` `reports` `rooms` `room-server` `settings` `metrics` `usage` `admin-log` `catalog-categories` `catalog-parts` `catalog-desks-items` `catalog-gacha` `catalog-diagnose` `smoke`), 돌리기는 `npm --prefix apps/admin run e2e`. 이 표에는 넣지 않았다.

## 할 일 — e2e 가 없거나 일부만 있는 기능

e2e 가 없는 기능(위 표의 **할 일**):

- 켜기 · 런처: 두 번째 실행 · 렌더러가 죽었을 때 런처로 · 설정 창 · 오픈소스 라이선스 창
- 계정: 로그인 화면 · 구글 로그인 · 가입 · 비밀번호 바꾸기 · 회원 탈퇴 · 같은 PC 계정 바꾸기 · 닉네임 · 내 정보 · 초대장 발급 · 라이선스 · 프리미엄 등록 · **PC 등록(3대 · 넷째 PC 확인)** · PC 연결이 끊긴 뒤 안내 · 판 확인(업데이트)
- 캐릭터: 꾸미기(로컬 묶음에 Storage 봇이 없어 파츠 GLB 를 못 받음)
- 방: 나가기 · 방장 넘기기 · 시크릿룸 · 방 설정 · 좌석 배치 · **같은 계정 한 자리** · 좌석 메뉴 · 방 동기화 · 방 놀이 · 자리비움 그림 · 접속 · 활동 상태 · 같이 듣기 · 스티커사진
- 채팅: 기록 지우기 · 채팅 설정 · 이모티콘 · 날리기 · 말풍선
- 친구 · 초대: 요청 받기 · 수락 · 친구 목록 · 친구 접속 표시 · 친구 방 · 마이홈 놀러 가기 · 방 초대
- 마이홈: 바탕화면 · 방명록 · 말랑이 · 선물 · 우편함 · 공지 · 일정 · 디데이 · 플레이리스트 · 백색소음 · 도움말 탭
- 포커스: 포커스 시간 · 레벨 · 포커스 기록 · 뽀모도로 · 달성표 · 폰 연결
- 알림 · 제보: 토스트 · 오류 번호 · 버그 제보 · 신고

e2e 가 있지만 일부만 보는 기능(`부분`):

- 런처 화면 · 마이홈 열기 · 친구 코드 고정 · 캐릭터 슬롯 저장 — 다른 흐름이 지나가기만 한다(마이홈 꾸미기는 e2e 없음).

REPL 순서만 있는 기능(`REPL` — 자동 판정 없음): 방 만들기 · 참여 · 투게더룸 · 채팅 · 친구 요청 보내기.

core 시나리오가 일부만 보는 기능(`부분` — 까닭은 표의 e2e 열): 캐릭터 만들기(얼굴 그리기) · 책상 세팅(책상 위 아이템 · 카탈로그 책상) · 카탈로그(파일 받기) · 관리자 모드(개발자 도구 — 설치본만) · 초대권(통계 창) · 라이선스(엑셀 일괄) · 파츠 등록 창(파일 올리기 — Storage 봇). `부분: Storage` 줄은 로컬 묶음 API 의 Storage 에뮬레이터 연결이 들어오면 다시 돌린다.

## 발견한 버그

시나리오가 찾은 앱 버그. 시나리오는 비켜 가서 나머지를 판정하고, `steps.txt` · 러너 요약에 `BUG <번호>` 로 남긴다. 고치면 이 줄과 비켜 가는 코드를 같이 지운다.

지금 없음. 적을 때는 `| 번호 | 무엇 | 다시 보기 | 비켜 가는 곳 |` 표로 쓴다(시나리오는 `t.bug(번호, 글)`).
