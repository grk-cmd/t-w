# Together Working — Electron 버전 (Step 2: config/run 모드 전환)

## 폴더 구조
```
tw-electron/
 ├ package.json
 ├ main.js              ← Electron 진입점 (창 설정 + IPC 핸들러)
 ├ preload.js            ← renderer에 window.companion API 노출
 └ app/                  ← 렌더러(화면에 보이는 것) — 기존 프로토타입 그대로
    ├ desk-companion-prototype.html
    ├ parts/
    │   ├ app.js
    │   ├ base-glb.js
    │   └ skin-data.js
    └ vendor/            ← ★ 직접 복사해야 함 (아래 참고)
```

## 처음 설치 순서

### 1. vendor 폴더 복사 (필수!)
기존 `tw` 폴더의 `vendor/` 폴더를 통째로 복사해서
`tw-electron/app/vendor/` 위치에 붙여넣으세요.

### 2. 패키지 설치
```
npm install
```

### 3. 실행
```
npm start
```

## Step 2에서 달라진 것

- **런처/캐릭터 생성 화면** = 작은 창(420×720)이 화면 중앙에 뜸 (배경 있는 카드처럼)
- **캐릭터 실행 화면** = 전체화면 투명 오버레이로 자동 전환 (다른 창들이 비침)
- 이 전환은 `preload.js`가 `window.companion.setConfigMode()`를 제공해서 기존 app.js 코드가 자동으로 처리함

## 확인할 것

1. 앱 켜면 **작은 카드 창**이 화면 중앙에 뜨는지 (배경 크림색 있어도 정상 — 설정 화면이니까)
2. 캐릭터 생성/불러오기 하면 **전체화면으로 바뀌고 투명**해지는지 (바탕화면·다른 창 비쳐야 정상)
3. 다시 런처로 돌아가면(⚙ 버튼 등) **다시 작은 창**으로 돌아오는지

## 아직 안 된 것 (다음 단계)

- 클릭 통과 (지금은 투명해도 클릭은 캐릭터 없는 빈 공간까지 다 먹음)
- 전역 마우스 클릭 / 키보드 타이핑 감지 (클릭 애니메이션의 기반)
- 시스템 전체 유휴시간 감지 (`onIdle` — 지금은 자리만 잡아둠, 아직 미구현)
- 작업표시줄 숨김
- 창 크기(CONFIG_WIDTH/HEIGHT = 420×720)가 실제 카드 크기와 안 맞으면 `main.js` 상단 값 조정 필요

## 문제 생기면

- 화면이 안 뜨면: 터미널 에러 메시지 전체 복사해서 알려주세요
- 캐릭터가 안 보이면: vendor 폴더 복사 확인 + devTools로 콘솔 에러 확인
  (`main.js`의 `openDevTools` 줄 주석 해제하면 콘솔 창 뜸)
- 런처 화면 크기가 이상하면: `main.js`의 `CONFIG_WIDTH`/`CONFIG_HEIGHT` 값을 조정

