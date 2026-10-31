# 앱 도메인 지도 — `apps/desktop/app/parts/`

앱(Electron 렌더러) 코드를 **도메인**(무슨 기능 묶음인가)으로 나눈 지도다. 어디에 무엇이 있는지 찾을 때, 그리고 폴더를 나눌 때 기준으로 쓴다.

- 앱 구조 정리 순서: ① FSD 옮기기(끝 — `docs/APP_FSD_MAP.md`) → **② 도메인 지도(이 문서)** → ③ 도메인 폴더로 나누기 → ④ 컨벤션 → ⑤ 설정 · 비즈니스 로직은 서버 · 관리자로.
- 지금(2026-10-14)은 모든 파일이 `apps/desktop/app/parts/` 한 층(관리자만 `apps/desktop/app/parts/admin/`)에 있다. 아래 «폴더» 칸은 ③에서 옮길 자리다.
- 줄 수는 2026-10-14 main 기준(대략). 「서버」 칸: `fb` = `firebaseAPI.*` 를 직접 부르는 수, `api` = 자체 서버 API(t-w-server) 통로, `ws` = 방 서버 웹소켓.

## 0. 한눈에

| 폴더(③에서) | 도메인 | 파일 | 줄(약) |
|---|---|---:|---:|
| (그대로) | 🚀 입구 · 3D 핵심 — `app.js` · `firebase-init.js` · 설정 · 내장 데이터 | 8 | 18,700 |
| `room/` ✅ | 🛰 방(워킹룸 · 투게더룸) — 입장 · 동기화 · 방 서버 · 방 안 놀이 | 21 | 7,200 |
| `chat/` ✅ | 💬 채팅 — 대화창 · 기록 · 설정 · 이모티콘 | 8 | 2,600 |
| `myhome/` ✅ | 🏠 마이홈 — 페이지 · 편집 · 스티커 · 친구 · 우편 · 방명록 · 바탕화면 앱 | 19 | 13,900 |
| `friends/` | 👥 친구 데이터 — 포트 · provider(firebase 옛 길 · api · ws 자리). 화면 · 마이홈은 포트만 부른다 | 3 | 180 |
| `realtime/` | 🔌 realtime 서버 웹소켓 연결 공통부(열기 · hello · 토큰 · 백오프 · rid 요청) — 방 연결(`room/room-server-net.js`)과 친구 접속 상태 연결이 같이 쓴다 | 1 | 270 |
| `character/` ✅ | 🧍 캐릭터 · 꾸미기 — 꾸미기 창 · 파츠 · 동물 · 슬롯 · 코드 · 가챠 | 19 | 10,500 |
| `creator/` ✅ | 🎨 생성기 — 그리기 도구 · 단계 길잡이 (+ app.js 에 남은 생성기 묶음을 여기로) | 6 | 650 (+ 약 3,500) |
| `focus/` ✅ | ⭐ 집중 · 레벨 — 포커스 기록 · 레벨 · 경험치 · 달성표 · 뽀모도로 | 9 | 2,700 |
| `status/` ✅ | 📍 상태칩 — 칩 · 팝업 · 플레이리스트 · 백색소음 | 4 | 3,200 |
| `account/` ✅ | 🔑 계정 · 라이선스 — 로그인 · 내 정보 · 초대장 · 라이선스 · 한 기기 | 10 | 2,900 |
| `launcher/` ✅ | 🖥️ 런처 · 앱 껍데기 — 설정 창 · 프로그램 설정 · 데스크탑 실행 · 단축키 · 광고 | 6 | 2,300 |
| `support/` ✅ | 🐞 제보 · 신고 — 버그 게시판 · 신고하기 | 3 | 860 |
| `purikura/` ✅ | 📷 스티커사진 | 2 | 4,000 |
| `admin/` | 🛠️ 관리자(이미 폴더) | 11 | 2,600 |
| `shared/` ✅ | 🧰 공용 도구 · 공용 통로 — 창 겹침 · 프롬프트 · 효과음 · 테마 · API · 원격 설정 | 16 | 1,800 |

## 1. 🚀 입구 · 3D 핵심 — 폴더를 만들지 않고 `apps/desktop/app/parts/` 에 둔다

| 파일 | 하는 일 | 줄 | 서버 |
|---|---|---:|---|
| `app.js` | 부팅 순서 · 모듈 연결 · 3D 핵심(씬 · 좌석 · 좌석 크기 평준화 · 파츠 입히기 · 동작 `animateRig` · 프레임 루프 · PS1 도트) · **생성기 묶음(③ 뒤 `creator/` 로)** | 14,197 | fb 48 |
| `firebase-init.js` | Firebase SDK 초기화 · `window.firebaseAPI`(DB 경로는 여기) · ES 모듈 18개를 `import` 해 연결 | 4,459 | — |
| `firebase-config.js` | 운영 / dev 프로젝트 설정 | 27 | — |
| `base-glb.js` · `skin-data.js` · `animal-glb.js` · `ears-glb.js` | 내장 데이터(기본 캐릭터 · 피부 · 동물 · 귀 GLB) | — | — |

app.js 안에 남은 구역(남기는 이유는 `docs/APP_FSD_MAP.md` «남기는 것» · «더 남기는 것»): SETUP · BUILDERS · SEATS · 좌석 크기 · 좌석 배치 · FIT · FILE LOAD · USER STATUS ·
3D 상호작용(DRAG / PET) · WARDROBE PARTS(파츠 부착) · 모델 · 텍스처 · GLB 캐시 · Presence · ANIM · INIT · 공용 상태 · 모듈 연결 · **생성기 묶음**(CREATOR + LAUNCHER · 도장 · 책상 · 좌석 세팅 · 기즈모 · 커미션 코드 입력 · 카탈로그 동기화).

## 2. 🛰 `room/` — 방 ✅ 옮김(폴더 9번)

| 파일 | 하는 일 | 서버 |
|---|---|---|
| `room-entry.js` | 방 서버 provider 고르기 · 방 개수 · 방 만들기 · 랜덤 참여 · 입장 · 나가기 · 승계 · 해산 | fb 75 |
| `room-sync.js` | 방으로 보내는 def(직렬화 · 델타) · poke 신선도 · 자리비움 자동 퇴장 · 서버 모듈 감시견 | fb 12 |
| `room-invite-ui.js` | 투게더룸 친구 초대 · 초대 받기 팝업 | fb 6 |
| `friend-visit.js` | 친구 방에 놀러 가기(마이홈 친구 목록의 방 코드) | — |
| `seat-pin.js` · `hidden-seats.js` | 내 자리 맨 오른쪽 고정 · 워킹룸 숨기기 | — |
| `ride-bench.js` · `interaction-desk.js` | 올라타기(탑) · 벤치 · 상호작용 책상 · 춤 목록 · 재주 상수 | — |
| `tricks.js` · `dice-games.js` · `roulette.js` · `floaters.js` | 깜짝쇼 · 때리기 · 주사위 · 하루 횟수 · 러시안룰렛 · 이모지 떠오르기 | fb 2 · 2 |
| `overhead.js` · `away-pic.js` | 머리 위 말풍선 · 이름표 · 공지 배너 · 자리비움 그림 | fb 2 |
| `room-server-net.js` (ES) | 방 서버 웹소켓 provider(PROTOCOL v1) — 연결 공통부는 `realtime/realtime-link.js` | ws |
| `room-server-gate.js` (ES) | 0.13 — 늘 Firebase 방을 돌려주는 얇은 자리(방 묶음이 rt-hub 방 포트로 갈아 끼우며 걷음) | api 2 |
| `room-alive.js` · `room-ghost-heal.js` · `room-index.js` · `room-channel.js` (ES) | 살아 있음 판정 · 사라진 멤버 다시 등록 · roomIndex · 채널 값 | (firebase-init 이 연결) |

## 3. 💬 `chat/` — 채팅 ✅ 옮김(폴더 3번)

| 파일 | 하는 일 | 서버 |
|---|---|---|
| `chat-ui.js` | 채팅 본체 — 날리기 · 여기까지 읽음 · 채팅 탭 · 드래그 복사 · 커스텀 이모티콘 | fb 28 |
| `chat-window.js` | 대화창 배선(닫기 · 최소화 · 끌기 · 메뉴 · 입력) | — |
| `chat-prefs.js` · `chat-lock.js` | 기록 삭제(방장) · 투명도 · 글자 크기 · 알림음 · 시크릿룸 잠금 | fb 5 |
| `chat-tabs.js` · `chat-copy.js` · `demoji-palette.js` | 채팅 탭(채널) · 복사 형식 · 기본 이모티콘 팔레트 | — |
| `chat-history.js` (ES) | 대화 기록 — 서버 3일 + 이 PC 저장 + ts 커서로 이어 받기 | (firebase-init 이 연결) |

## 4. 🏠 `myhome/` — 마이홈 ✅ 옮김(폴더 8번)

| 파일 | 하는 일 | 서버 |
|---|---|---|
| `myhome-init.js` | 마이홈 시작(INIT 에서 한 번) — 접속 표시 · 프로필 · 친구 · 요청 · 우편 · 공지 구독 | fb 13 |
| `friends-sub.js` | 내 친구 목록 한 벌 — 상태(불러오는 중 · 못 불러옴 · 받음) · 목록 열 때 다시 걸기(동시 1개) · 판정용 한 번 읽기 · 이름 받기 · 열려 있는 동안만 접속 상태 | fb 0(포트 friends/ 를 deps 로) |
| `myhome-visit.js` · `myhome-page.js` | 내 마이홈 데이터 · 친구 홈 구경 · 페이지 불러오기 · 그리기 | fb 6 · 2 |
| `myhome-ui.js` · `myhome-edit.js` | 창 버튼 · 탭 · 프로필 레일 · 페이지 편집(자동저장 · BGM · 배경 · 테마 · 디자인 스튜디오) | fb 10 · 4 |
| `myhome-preset.js` | 👑 디자인 프리셋 규칙(지금 디자인 ↔ 칸 · 저장본 씻기 · 그림 키 · 그림 올릴 이름) — 순수 함수 | — |
| `myhome-sticker.js` · `myhome-sticker-layout.js` | 스티커 관리 창 · 배치 계산(그리기 `renderMyHomeStickers` 는 app.js) | — |
| `myhome-inbox.js` · `friend-manage.js` · `add-friend.js` | 수령함 · 선물함 · 친구 목록 · 친구 관리 · 책상에서 친구 추가 | fb 13 · 10 |
| `guestbook.js` · `scheduler.js` | 방명록 · 스케줄러 · 일정 알림 | fb 15 · 24 |
| `myhome-desktop.js` · `folder-free.js` · `bookmark.js` · `mallang.js` | 마이홈 바탕화면 · 폴더 자유배치 · 북마크 책장 · 말랑이 | fb 98 · 27 |
| `myhome-links.js` · `myhome-diag.js` | 본문 링크 · 클릭 진단(콘솔) | — |
| `inbox-api.js` · `mail-feed.js` | 📩 내 우편 — 서버 길(`/v1/me/notifications`) · 받아 들고 있는 한 벌(받는 중 · 못 받음 · 새 우편 알림 · 읽음 · 지우기). 사용법은 `README.md` | 서버 |
| `launcher/notice-api.js` · `launcher/notice-feed.js` | 📢 공지 한 판(`/v1/notices` — 소식 · 업데이트 공지 · 런처 배너) + 관리자 소식 쓰기. 확성기는 realtime `announce`(`room/overhead.js`). 사용법은 `launcher/README.md` | 서버 |

### 4-1. 👥 `friends/` — 친구 데이터 포트 · provider (서버 이관 — 사용법은 `apps/desktop/app/parts/friends/README.md`)

| 파일 | 하는 일 | 서버 |
|---|---|---|
| `friends-port.js` | 포트 — 친구 목록 받기 · 목록 듣기 · 접속 상태 듣기. friends-sub.js(마이홈)가 부른다 | — |
| `friends-firebase.js` | 옛 길 provider — 상시 구독은 목록 하나 · 카드는 열 때 한 번 · 접속 상태는 목록이 열려 있는 동안만(나중에 걷음) | fb 0(deps 로) |
| `friends-api.js` | api provider — GET /v1/me/friends · 요청 규칙(5초 · 서버 문제면 두 번 더 · 401 · 400 은 바로 옛 길) | api(로그인) |

## 5. 🧍 `character/` — 캐릭터 · 꾸미기 ✅ 옮김(폴더 10번)

| 파일 | 하는 일 | 서버 |
|---|---|---|
| `wardrobe.js` · `wardrobe-panel.js` | 꾸미기 창(미리보기 · 초안 · 상세조정 · 색 줄 · 파츠 착용) · 사이드 패널 | — |
| `premium-assets.js` | 프리미엄 꾸미기 파츠 · 라이선스 책상 · 전용 자산 접기 | fb 2 |
| `part-paint.js` | 파츠에 직접 그리기 · 그림칸 · UV 구제 | fb 2 |
| `animal.js` · `human-ear.js` · `wd-ear.js` | 동물 캐릭터 · 사람 귀 · 귀 탭 | — |
| `chars.js` · `slot-save.js` · `slot-sync.js` | 캐릭터 보관함(chars) · 슬롯 저장 · 기기 간 동기화 | fb 33 · 15 |
| `char-code.js` · `code-crypto.js` · `asset-code.js` · `commission.js` | 복제 코드 · 암호화 · 에셋 코드 · 커미션 zip · 저장 책상 / 아이템 | — |
| `face-heal.js` · `def-size.js` · `seat-slot.js` | 얼굴 자동 복구 · def 용량 상한 · 좌석 안 파츠 가두기 | — |
| `gacha.js` | 파츠 가챠 · 보관함 · 뽑기 창 | fb 5 |
| `catalog-cache.js` (ES) | 카탈로그(parts · gachaParts · items · desks) 버전 확인 + 로컬 캐시 | (firebase-init 이 연결) |

## 6. 🎨 `creator/` — 생성기 ✅ 옮김(폴더 12번)

| 파일 | 하는 일 |
|---|---|
| `paint-tools.js` · `uv-fill.js` | 붓 · 페인트통 · 지우개 · 메쉬 채우기 |
| `race-picker.js` · `animal-edit-route.js` | 종족 선택창 · 동물 편집 길잡이 |
| `creator-flat-view.js` · `desk-item-origin.js` | 원색 보기 · 책상 아이템 처음 자리 |
| (app.js 에서 옮겨 올 것) | 생성기 묶음 약 3,500줄 — CREATOR + LAUNCHER · 이미지 도장 · 책상 세팅(5단계) · 아이템 기즈모 · 좌석 세팅(6단계) · 커미션 코드 입력 · 카탈로그 실시간 동기화 · 런처 미리보기 · 컨트롤 |

생성기 묶음은 생성기 상태(`cDesk*` · 붓 · 히스토리 · `savedParts` …)를 읽고 쓰는 곳이 수십 군데라, ③에서 `creator/` 폴더가 생긴 뒤 한 덩이로 옮긴다.

## 7. ⭐ `focus/` — 집중 · 레벨 ✅ 옮김(폴더 5번)

| 파일 | 하는 일 | 서버 |
|---|---|---|
| `focus-level.js` · `lv-tier.js` · `exp-bar.js` | 포커스 레벨 · 공유 · 태블릿 · 레벨 티어 · 경험치 바 | fb 16 |
| `focus-total.js` · `focus-log.js` · `focus-share.js` | 누적 시간 · 기록 팝업 · 오늘 기록 전시 | — |
| `weekly-challenge.js` · `pomodoro.js` | 달성표 · 뽀모도로 | fb 9 |
| `gamepad-activity.js` | 게임패드도 활동으로 치기 | — |

## 8. 📍 `status/` — 상태칩 ✅ 옮김(폴더 4번)

| 파일 | 하는 일 | 서버 |
|---|---|---|
| `status-chip.js` | 상태칩 자리 · 칩 클릭 · 팝업 · 입력창 자리 · 상태 이모지 · UI 아이콘 | — |
| `playlist.js` | 상태칩 플레이리스트 | fb 11 |
| `noise.js` · `noise-sounds.js` | 백색소음 | — |

## 9. 🔑 `account/` — 계정 · 라이선스 ✅ 옮김(폴더 6번)

| 파일 | 하는 일 | 서버 |
|---|---|---|
| `account.js` · `my-info.js` | 로그인 · 로그아웃 · 신원 지우기 · 내 정보(랭킹 · 보관함 · 휴지통 · 계정 탭) | fb 44 · 16 |
| `license-gate.js` | 초대장 — 앱 접근 제한 | fb 60 |
| `license-ui.js` · `license-key.js` · `license-request.js` | 라이선스 화면 · 키 등록 / 해제 · 요청 | fb 6 |
| `device-lost.js` · `name-guard.js` | 한 계정 한 기기 · 운영진처럼 보이는 이름 막기 | fb 4 |
| `invite-revoke.js` (ES) | 초대권 전체 회수(관리자) | (firebase-init 이 연결) |

## 10. 🖥️ `launcher/` — 런처 · 앱 껍데기 ✅ 옮김(폴더 7번)

| 파일 | 하는 일 | 서버 |
|---|---|---|
| `settings-panel.js` · `program-settings.js` | 설정 패널 · 캐릭터 탭 · 닉네임 · 프로그램 설정(회사원 · 피규어 모드) | fb 2 |
| `desktop-run.js` | 데스크탑 실행 화면 — 업데이트 배너 · 활성 앱 · 전역 입력 · 클릭 통과 · 하트비트 | — |
| `launcher-chrome.js` · `fn-keys.js` · `ad-banner.js` | 런처 타이틀바 · 함수키 · 광고 배너(공지 한 판에서 그림) · 게임 설정 구독 | fb 5 |
| `app-boot.js` | 🚀 켜는 순서 한 곳 — 계정 확인 뒤 옛 값 옮기기 → realtime → 계정 기능 열넷 시작(차례 표 `STEPS`). 사용법은 `launcher/README.md` | — |

## 11. 🐞 `support/` — 제보 · 신고 ✅ 옮김(폴더 2번)

| 파일 | 하는 일 | 서버 |
|---|---|---|
| `bug-board-ui.js` | 버그 제보 게시판 화면 | fb 8 |
| `report.js` | 신고하기 · 신고 창 도우미(관리자 목록은 `admin/admin-report.js`) | — |
| `bug-board.js` (ES) | 버그 게시판 데이터 | (firebase-init 이 연결) |

## 12. 📷 `purikura/` — 스티커사진 ✅ 옮김(폴더 1번)

| 파일 | 하는 일 | 서버 |
|---|---|---|
| `purikura-ui.js` | 촬영 창 · 로비 · 전용 씬 · 촬영 · 꾸미기 | fb 10 |
| `purikura-net.js` | 하루 정원 · 방 통신(`window.Purikura`) | fb 7 |

## 13. 🛠️ `admin/` — 관리자 (이미 폴더)

`admin-mode.js`(진입) · `admin-license.js` · `admin-license-bulk.js` · `admin-notice.js` · `admin-category.js` · `admin-part-register.js` · `admin-asset.js` · `admin-users.js` · `admin-launcher.js` · `admin-console.js` · `admin-report.js`.
웹 관리자와 겹치는 것(라이선스 발급 · 목록 · 통계 등)은 ⑤에서 «웹 관리자 열기» 로 바꾸며 걷는다(`listLicenses` 통째 읽기 포함 — 지금은 그대로 둔다).

## 14. 🧰 `shared/` — 공용 도구 · 공용 통로 ✅ 옮김(폴더 11번)

| 파일 | 하는 일 |
|---|---|
| `win-stack.js` · `outside-close.js` · `async-prompt.js` · `key-input.js` | 창 겹침 · ESC · 팝업 바깥 닫기 · 인앱 프롬프트 · 키 입력 공통 |
| `rich-text.js` · `sfx.js` · `frame-budget.js` · `gl-recover.js` | 리치 텍스트 sanitize · 효과음 공장 · 프레임 예산 · 3D 연결 끊김 복구 |
| `theme.js` · `theme-ui.js` | 디자인 테마 · 자식 창 테마 |
| `api-client.js` · `remote-config.js` · `api-errors.js` · `request-id.js` · `device-id.js` | 서버 API 통로 · 원격 설정(GET /v1/config) · 오류 번역 · 요청 번호 · 기기 id (api) |
| `api-public-reads.js` · `app-version.js` · `app-version-gate.js` · `visit-ping.js` (ES) | 공개 읽기 API 먼저 · 앱 버전 싣기 · 최소 버전 막기 · 방문 집계 |

## 15. ③ 폴더로 나눌 때 — 같이 고칠 곳과 함정

- **HTML `<script src>`**(`apps/desktop/app/desk-companion-prototype.html`): 경로만 바꾸고 **싣는 순서는 그대로**(classic script 는 순서가 곧 의존).
- **ES 모듈 import**: `firebase-init.js` 머리의 `import … from "./room-index.js"` 등 18줄, 그리고 모듈끼리(`room-index.js → room-channel.js`). 폴더가 달라지면 `"./room/room-index.js"` · `"../room/…"` 로.
- **⚠️ 검사가 못 잡는 자리**(→ `sim-parts-paths.js` 로 막음 · 폴더 1번): 검사 러너(`checks/run.js`)는 `apps/desktop/app/parts/` 아래를 **평평하게 펴서** 돌린다. 그래서 실제 앱에서 `<script src>` · import 경로가 틀려도 검사는 초록이다. → 첫 폴더 PR 에서 «실제 폴더 기준으로 `<script src>` · 상대 import 가 다 있는 파일을 가리키는가» 를 보는 검사를 먼저 넣는다.
- **파일 이름은 폴더가 달라도 겹치면 안 된다** — 러너가 이름으로 찾는다(겹치면 `flatDup` 로 알린다).
- **소리 · 그림 파일**(`parts/click.mp3` 등)은 옮기지 않는다 — 코드 안 경로(`'parts/click.mp3'`)가 그대로 맞게.
- **CLAUDE.md 구조 표**의 경로, `checks/CHECKS.md` 메모의 경로, `audit.py` 검사 8 목록은 이름만 보므로 그대로.
- 한 PR = 한 도메인 폴더. 작은 · 독립적인 것부터: `purikura/` → `support/` → `chat/` → `status/` → `focus/` → `account/` → `launcher/` → `myhome/` → `room/` → `character/` → `shared/` → `creator/`(+ 생성기 묶음).

## 16. 다음 단계(④ 컨벤션)에서 볼 것 — 이 지도에서 보이는 것

- **서버 직접 부르기가 화면 파일에 흩어져 있다** — `firebaseAPI.*` 를 부르는 화면 파일이 40개 넘는다(많은 곳: `myhome-desktop.js` 98 · `room-entry.js` 75 · `license-gate.js` 60 · `account.js` 44 · `chars.js` 33). 도메인마다 `-net` 통로 하나로 모으고, 그 안에서 «자체 서버 먼저, 안 되면 Firebase» 를 고른다(이미 그 꼴: `api-public-reads.js` · `room-server-gate.js`).
- **모듈 모양이 두 가지** — classic script(`window.TwX` · `createX(deps)`) 와 ES 모듈(`export` · firebase-init 이 import). 하나로 맞출지 정한다.
- **시작 일은 INIT 에서** — 모듈을 만들 때 시작 일까지 해 버리는 곳(예전 `initMyHome` 처럼)을 훑어 «만들 때는 준비만» 으로.
- **임시 다리 걷기** — app.js 의 «// 옛 전역 이름» 줄 10개 · keep 으로 남긴 공용 이름(`findMySeat` · `isPremium` · `getDisplayName` · `_flyActive` · `customItems` · `_focusTotalSec` · `renderMyHomeStickers` …)을 deps 로.
