# app/parts/focus — 포커스(집중 기록 · 레벨 · 태블릿·폰)

이 폴더 모듈의 책임 · deps · 함정. 아직 절이 없는 모듈은 파일 머리 주석이 정본이다.

## mobile-diag.js — 📱 태블릿·폰 연결 진단 줄

- **책임**: PC 가 받은 폰 신호(`mobileLink/{uid}/state`)를 기록하고, 설정 › 포커싱 칸에 쓸 한 줄을 만든다(순수 함수 · DOM · firebase 없음). «연동이 자꾸 풀린다» 제보를 캡처 한 장으로 가르려고 둔다.
- **만드는 법**: 만들지 않는다 — 얼린 표 `window.TwMobileDiag`. app.js 가 `mobileDiag: TwMobileDiag` 로 focus-level.js 에 넘긴다.
- **내보내는 것**: `empty()` · `next(기록, 사건)` → 새 기록 · `line(기록, 시각 글자?)` → `🔍 마지막 신호 14:02:10 열림(Procreate) · 그 전 … · 이번 실행 3번`.
  - 사건: `{ kind:'state', v, first }`(구독으로 받은 값 · first = 처음 온 값이라 수에 안 넣음) · `{ kind:'reset', v }`(PC 를 켤 때 «켜짐» 을 내린 원래 값) · `{ kind:'live', has }`(PC 켜짐 표시).
- **함정**
  - 신호 하나 = ts(서버 시각). 같은 ts 가 다시 오면 새 신호가 아니다 — 부팅 초기화는 on 만 내려서 같은 ts 의 «꺼짐» 이 곧 온다.
  - 읽기만 한다 — 켜짐 판정(`_mobileOn`)도, live 를 다시 거는 일도 하지 않는다. 진단으로 원인을 본 뒤 동작을 따로 고친다.
  - 다른 키로 쓴 값은 세지 않는다(focus-level.js `_mobileStart`).
  - 검사: `checks/sim-mobile-diag.js`(규칙 · 잇기를 실제로 돌림 · firebase-init 알림 자리).
