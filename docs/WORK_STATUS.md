# 작업 현황판 — 누가 무엇을 만지는 중인가

여럿이 같은 파일을 동시에 고치다 충돌이 나지 않게 하려고 둔다. **작업을 시작하기 전에 «건드리는 파일» 칸을 보고, 내 파일이 겹치면 그 줄 담당과 먼저 맞춘다.**
머지 담당(검증 세션)이 PR 을 올리거나 머지할 때마다 고친다. 기준: 2026-10-17.

## 작업 시작 절차 — 누구든 코드를 만지기 전에 이것부터
1. `git pull` 로 이 파일을 받아 «진행 중» 표를 본다. 내가 고칠 파일이 다른 줄의 «건드리는 파일» 과 겹치면 **시작하지 말고** 그 담당과 먼저 맞춘다.
2. 겹치지 않으면 «진행 중» 표에 한 줄을 더한다 — 묶음 이름 · **담당(사람 또는 세션 이름)** · 내용 · 건드리는 파일 · 제보 번호(있으면).
3. **이 파일 하나만은 PR 없이 main 에 바로 커밋 · push 한다**(`docs(status): <묶음> 시작 — <담당>`). 다른 파일을 같은 커밋에 섞지 않는다 · force push 금지 · push 가 거절되면 `git pull --rebase` 뒤 다시.
4. PR 을 올리면 그 줄에 PR 번호를, 머지되면 줄을 «머지 완료» 로 옮긴다(이것도 main 에 바로).
- 웹 관리자 📋 할 일(`adminTodos`)은 계속 써도 되지만, «지금 누가 어느 파일을 만지는가» 는 이 파일이 정본이다.

## 규칙
- **한 번에 한 사람만 머지한다.** 지금 머지 담당은 검증 세션 하나뿐이다. 다른 세션은 PR 을 올리기까지만 하고 머지는 하지 않는다(같은 대기열을 둘이 머지하면 CHECKS 개정 번호가 엉킨다).
- `checks/CHECKS.md` 개정 번호는 머지 직전에 main 다음 번호로 다시 매긴다. PR 을 올릴 땐 임시 번호여도 된다.
- **클릭 통과(setIgnoreMouseEvents)를 정하는 조건은 `app/parts/launcher/click-through-policy.js` 한 곳에만 쓴다.** 다른 파일에 조건을 쓰면 `sim-click-through-policy.js` 가 빨강이다(#315 머지부터).
- **담당 이름은 남과 겹치지 않게** 쓴다(예: «검증-도우미1» · «계정 세션» · 사람 이름). 같은 이름이 둘이면 누가 누군지 못 가린다.
- 버그 제보를 고친 PR 은 제목 끝에 `(B-MMDD-n)` 을 붙이고, 아래 «제보 → 수정» 표에 한 줄 더한다.

## 진행 중 — 검증 · PR 올리는 중
| 묶음 | 담당 | 내용 | 건드리는 파일 | PR |
|---|---|---|---|---|
| ~~#315~~ 머지 | 검증 세션 | 클릭 통과 판단을 한 곳으로(main #261 의 onUI 조건 포함) | `launcher/click-through-policy.js`(새) · `launcher/desktop-run.js` · `main.js` · 클릭 검사들 | #315 |
| ~~w4 묶음~~ 머지 #326 | 검증-도우미1 | 구역 떼기 C · w4 다섯 줄(코드로 추가하기 · 책상 프리셋 · 책상 세팅 · 박힌 값 상수 · 좌석 우클릭 메뉴) | `creator/asset-import.js` · `desk-preset-store.js` · `desk-preset.js` · `desk-setup.js` · `asset-cards.js` · `room/seat-menu.js`(새) · `app.js` · html · smoke | — |
| ~~wQ 묶음~~ 머지 #320 | 검증-도우미2 | 내 코드가 없으면 친구 · 부팅 · 마이홈 · 일정 · 방명록 · 방 만들기 요청을 안 보낸다 | `myhome/friends-sub.js` · `myhome/myhome-init.js` · 일정 · 방명록 · 방 만들기 창 | — |
| ~~wW 묶음~~ 머지 #324 | 검증-도우미2 | 디자인 프리셋 판단 한 곳 → 프리셋에 그림도 담기 (B-1013-8) | `myhome/myhome-preset.js`(새) · `myhome/myhome-edit.js` | — |
| ~~wY~~ 머지 #328 | 검증-도우미4 | 파츠 바뀐 뒤 좌석 다시 맞추기 한 벌(seat-refit.js) + 399ae08 떠 있던 동물 고침 · 동작 변경 사용자 승인 | `room/seat-refit.js`(새) · `app.js` · `character/wardrobe.js` · `room/room-entry.js` · `character/catalog-sync.js` · `admin/admin-part-register.js` · html | #328 |
| ~~낱개~~ 머지 #321 · #323 · #325 · #327 | 검증-도우미3 | 문서 규칙(429c52b) · 두 번째 실행 10초(wT) · 토스트 문구(wS) · realtime 공통부(wP-C 6d352f0) · 에러코드(4c55c3c — 충돌 크면 다시 얹기) | `CLAUDE.md` · `main.js`(두 번째 실행) · 토스트 · `room/realtime-link.js`(새) · 에러코드 표 | — |
| B-1016-4 창 겹침 근본 | 도우미 1 | 창 앞뒤를 :root «창 층 표» 한 곳으로(동작 무변경) → 편집 · 종족도 창 쌓기 · 연 창이 맨 앞 · 대화상자는 창 쌓기 위 · #258 의 «편집 중 마이홈 숨김» 땜질 걷기 | `desk-companion-prototype.html`(z-index 37곳 · 창 층 표) · `shared/win-stack.js` · `sim-z-layers.js`(새) · `sim-win-front` · `sim-win-layers` · `sim-purikura-stage` · `sim-signup` · `sim-fix-1016` | — |
| CI 건너뛰기 | w2 세션 | 바뀐 폴더를 먼저 보고 앱 검사 · 웹 관리자 검사를 필요할 때만(문서만 바뀐 PR 은 검사 없음) · 같은 PR 의 앞 실행 취소 · release-start 는 «npm run check» job 이 실제로 초록일 때만 건너뜀 | `.github/workflows/checks.yml` · `.github/workflows/release-start.yml` | — |
| 도메인 together-working.com | w2 세션 | 앱 · 웹 관리자 서버 주소를 together-working.com 으로(운영 API · 방 서버 · CSP) · duckdns 는 옛 앱 · dev 용으로 계속 허용 · 운영 설정 servers 는 그대로(새 앱만 별칭으로 새 주소) — 브랜치 `feat/together-working-domain` 84eb017 · CHECKS 개정 322(임시) · QUEUE | `room/room-server-gate.js` · `shared/api-client.js` · `desk-companion-prototype.html`(CSP meta 두 줄 · 맨 위 — 창 층 표와 다른 자리) · `firebase.json` · `web-admin/src/shared/api/api.ts` · `web-admin/src/entities/room-server/model/roomServer.ts` · `sim-room-server-gate` · `sim-api-client` · `sim-remote-config` · `sim-account-delete` | — |
| 카탈로그 본문 API 읽기 | w2 세션 | 카탈로그 본문을 API(/v1/catalog — 운영 배포 끝 v0.2.1)에서 먼저 · 실패면 Firebase — 브랜치 `feat/catalog-api-read` 70183a0 · CHECKS 개정 271(임시) · QUEUE | `firebase-init.js`(카탈로그 구독 한 줄) · `shared/catalog-cache.js` · `sim-catalog-cache` | — |
| ~~회원 탈퇴 안내 자리~~ 머지 #322 | 계정 세션 | [내 정보 › 계정] 탈퇴를 누르면 «로그인 수단 ~ 이 컴퓨터에서 로그아웃» 자리가 탈퇴 안내로 바뀜(머지는 검증 세션) · ⚠️ html css 는 `#creatorOverlay.on` 줄 바로 뒤에 붙어 B-1016-4 와 같은 자리 — 그쪽이 «편집 중 마이홈 숨김» 줄을 걷을 때 우리 세 줄은 남겨 주세요 | `desk-companion-prototype.html`(#acctDeleteZone · css 세 줄) · `account/my-info.js` · `sim-account-delete.js` | #319 |
| ~~#265 다시 얹기~~ 머지 | 검증 세션 | 런처 화면 GPU 부하 줄이기 — 미리보기 1초 30번 · 깜빡임은 좌석과 같은 시간표 · 후원 반짝임(사용자 적용 승인 10-17) | `launcher/launcher-preview.js` · `shared/blink-timing.js`(새) · 좌석 깜빡임 · `shared/README.md` · 후원 문구 css | #318 |
| ~~#320 되돌림 고치기~~ 머지 #329 | 검증 세션 | 새 프로필(내 코드 없음) 친구 탭이 «불러오는 중» 에 멈춤 → «아직 친구가 없어요» — 마이홈 시작이 일찍 끝날 때 친구 목록도 «코드 없음» 으로 시작 | `myhome/myhome-init.js` · `checks/sim-myhome-init.js` | — |

## 대기 — 앞 줄이 머지돼야 올림
| 줄 | 내용 | 기다리는 것 |
|---|---|---|
| wJ 037867e | 같은 자리 여러 번 클릭 → 투게더워킹 활성화 (CONFIRM 38 승인) | #315 머지 · main #261(같은 증상 · 다른 방법) 과 겹치는지 다시 판단 |
| wAD 33d3d60 · f92b0f9 · d4afa40 | 클릭 통과 더 묶기 · 회복 사다리는 캐릭터 · 창 근처 클릭만 (B-1016-7) | wJ 037867e |
| wAE f51962b | 토스트를 누르면 글 복사(오류 번호 붙여 넣기용) | wS |
| wY 399ae08 | 파츠를 떼면 발밑 · 올라탄 사람 높이 다시 맞춤 | wY d4acee2 |
| wAB 3bbdc06 | 네트워크 준비 기다리기 15곳 묶기(net-ready.js) | 순서 |
| wAC 85b8eee · 6e07031 | 평준화 가두기 · 책상 자리를 모듈로 | 순서 |
| wL2 3b15806 · be25e90 · 2b15bbb | 몸 크기 재기 한 곳 → 리깅 모자 날기 위쪽 벽 | 순서 |

## 보류 — 서버 배포가 먼저(서버 브랜치가 아직 main · 배포 전)
| 줄 | 필요한 서버 브랜치(t-w-server) |
|---|---|
| wR 721ae87 친구 목록 스위치 빼기 | `feat/api-me-friends` |
| wP-C 943cc36 · b81d6e2 · ca05542 · bd69537 · 735a70a · e67dbea(규칙) | `feat/realtime-presence` · `feat/api-friends-write` |
| wX a7e6b43 · 7cb3745(규칙) · cbdec78 웹 관리자 제보 목록 API | `feat/api-admin-bugs` |
| (머지됨) #289 · #290 운영 설정 · #293 카탈로그 API | `feat/ops-hot-config` · 카탈로그 GET(앱 릴리스 전 배포) |

## 보류 — 결정 · 다시 얹기 대기
| 줄 | 까닭 |
|---|---|
| wAA 2c2d0e9 · 36fcf04 · 0353063 (B-1015-3) | w4 `desk-preset-store.js` 와 같은 묶기 — w4 머지 뒤 그 위로 다시 얹기(총괄) |
| wP-C 797d022 | 토스트 줄바꿈이 먼저 들어가야 |
| 머지된 브랜치 정리 — `claude/great-gates-o9jj5g`(#252) · `fix/bugs-1016-easy`(#258) · `fix/bugs-1016-medium`(#261) | 셋 다 머지 끝 · 아직 안 지움. 다른 담당이 이 브랜치 위에 쌓은 일이 없는지 보고 지워도 되면 지운다(검증 세션 · 총괄 확인) |

## 제보 → 수정
| 제보 | 증상 | 수정 PR | 상태 |
|---|---|---|---|
| v0.11.3 제보 | «친구 없음» 인데 추가하면 «이미 친구» | #306 · #307 | 머지 |
| 10-16 제보 1 · 2 · 6 · 10 · 11 · 12 | 알림콩 · 가챠 창 닫힘 · 상태 이모지 · 편집창 겹침 · 날기 천장 | #258 | 머지 |
| 10-16 제보 9 · 13 | 보관함 이동 복제 · 다른 앱 더블클릭 때 앞으로 옴 | #261 | 머지 |
| B-1016-7 | 다른 앱 더블클릭을 먹음(회복 사다리) | #261(일부) · wAD | 대기 |
| B-1016-4 | 마이홈을 띄운 채 캐릭터 편집을 열면 마이홈이 위에 겹침 | #258(숨김 땜질) → B-1016-4 창 겹침 근본 | 진행 중 |
| B-1013-8 | 디자인 프리셋에 그림이 안 담김 | #324 | 머지 |
| B-1015-3 | 생성기 프리셋 저장 · 읽기 실패를 안 알림 | wAA | 보류 |
| 리깅 모자 날기 | 모자 쓰고 날면 화면 아래에서 맴돎 | wL2 | 대기 |

## 머지 완료(10-17 검증 세션)
- 10-17 저녁(검증-합치기): #320 내 코드 없으면 요청 안 보냄 · #324 디자인 프리셋 그림(B-1013-8) · #326 w4 다섯 줄 · #329 #320 되돌림 고침 · #321 두 번째 실행 10초 · #323 토스트 줄바꿈 · #325 realtime 공통부 · #327 에러코드 · #328 좌석 다시 맞추기(개정 325~343)
- 10-17 오후: #318 런처 GPU 부하 줄이기(#265 대신) · #322 회원 탈퇴 안내를 계정 탭 자리에(grk #319 대신 — 검사 기록 번호만 다시 매김)
- 10-17 오후: #315 클릭 통과 판단 한 곳 · #316 옛 주석 줄이기 규칙 · #317 이 현황판
#255 이후 검증 세션이 올려 머지한 것: #256 · #263 · #269 · #270 · #273 · #281 · #284 · #286 · #288 ~ #312(카탈로그 · 친구 사슬 · 펜 끌기 등). 줄별 기록은 대기열(`docs/local/carve-handoff/QUEUE.md`, 이 PC 에만 있음).
