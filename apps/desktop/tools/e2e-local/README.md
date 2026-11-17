# e2e-local — 내 PC 에서 dev 앱을 끝까지 몰아 보기

dev 앱(`--tw-firebase=dev`)을 켜서 화면을 누르고 결과를 파일로 남기는 도구다. 앱이 부르는 dev 서버 · Firebase 주소를 이 PC 에 띄운 서버 · 에뮬레이터로 돌려서, 운영 · dev 데이터를 건드리지 않는다. 앱 설치본에는 들어가지 않는다(`apps/desktop/package.json` 의 `build.files` 밖). CI 에서도 돌지 않는다 — 손으로 돌리는 도구다.

| 파일 | 하는 일 |
|---|---|
| `lib.js` | 격리된 앱 한 벌 켜기 · 끄기 · 주소 돌리기 · 오프라인 흉내 |
| `flow.js` | 정해진 흐름 한 바퀴(가입 → 다시 켜기 → 로그인된 책상 → 얼굴 PNG · GLB 올리기 · 받기 → 오프라인 · 온라인) |
| `repl.js` · `run.sh` | 앱을 켜 둔 채 JS 명령을 하나씩 보내기 |

## 준비

1. **서버 저장소의 로컬 묶음 + Firebase 에뮬레이터** — 서버 저장소(비공개)의 dev 로컬 묶음을 에뮬레이터 설정과 함께 띄운다(서버 저장소 `deploy/dev-local` 의 `compose.yml` + `compose.emulator.yml`). API 서버 · realtime 서버 · DB · Firebase 에뮬레이터가 뜨면 된다. 띄우는 법은 서버 저장소 안내를 본다.
   - 로컬 DB 에 **초대 코드 한 줄**이 있어야 가입이 된다. `flow.js` 기본값은 `INVT-E2E2-TEST` — 다른 코드를 넣었으면 두 번째 인자로 준다.
2. **앱 의존성** — 저장소 맨 위에서 `npm install`(electron 이 `apps/desktop/node_modules` 에 깔린다).
3. **이 폴더 의존성** — `playwright-core` 하나뿐이다.
   ```bash
   cd apps/desktop/tools/e2e-local
   npm install
   ```

이 도구가 돌리는 주소:

| 앱이 부르는 곳 | 돌리는 곳 |
|---|---|
| `https://api-dev.together-working.com` | `http://127.0.0.1:8080`(API 서버) |
| `identitytoolkit` · `securetoken.googleapis.com` | `http://127.0.0.1:9099`(Auth 에뮬레이터) |
| `firebasestorage.googleapis.com` | `http://127.0.0.1:9199`(Storage 에뮬레이터) |

## 왜 감싸는 진입점을 쓰나

dev 앱은 `userData` 를 `appData/<이름>-dev` 로 바꾼다(`main.js`). 그래서 `--user-data-dir` 을 줘도 이 PC 에서 쓰던 dev 앱 폴더로 간다 — 시험이 내 dev 계정 · 캐릭터를 덮어쓴다.

`lib.js` 는 결과 폴더에 작은 진입점(`wrap/main.js`)을 만든다. 이 진입점이 `appData` 를 `<결과 폴더>/appdata` 로 돌린 뒤 앱 `main.js` 를 부른다. 켠 뒤 `userData` 가 결과 폴더 안인지 보고, 밖이면 바로 끄고 멈춘다.

결과 폴더는 **저장소 밖**에 둔다(예: `/tmp/tw-e2e/...`). 앱 데이터가 통째로 쌓이고, 저장소 안에 두면 검사 러너가 복사한다. 폴더를 지우면 앱 한 벌이 깨끗이 사라진다.

## 돌리기

### flow.js — 한 바퀴

```bash
cd apps/desktop/tools/e2e-local
node flow.js /tmp/tw-e2e/flow1                  # 초대 코드 기본값
node flow.js /tmp/tw-e2e/flow2 INVT-XXXX-XXXX   # 다른 초대 코드
```

결과 폴더에 남는 것: `steps.txt`(단계마다 ok · FAIL · 걸린 시간) · `console.txt`(렌더러 · 메인 로그) · `requests.txt`(돌린 요청 · 응답 코드) · 단계 화면 `01-invite.png` … · 실패 화면 `fail-<n>.png` · `account.json`(이번에 만든 친구 코드 · 시험 비밀번호 — 에뮬레이터 안에만 있는 계정). 끝나면 종료 코드 0, 실패하면 1.

### repl.js · run.sh — 켜 둔 앱에 명령 보내기

창 하나(터미널 1)에서 앱을 켜 둔다. `<결과 폴더>/ready` 가 생기면 준비된 것이다.

```bash
node repl.js /tmp/tw-e2e/a
```

다른 창(터미널 2)에서 명령을 보낸다. 명령 몸은 async 함수 안에서 돌고, `A`(lib.js 한 벌) · `app`(Electron) · `w`(창) · `fs` · `out` · `wait` 를 쓸 수 있다. `return` 한 값이 찍힌다.

```bash
./run.sh /tmp/tw-e2e/a "return await w.title()"
./run.sh /tmp/tw-e2e/a "await w.click('#lcEmpty'); return 'ok'"
./run.sh /tmp/tw-e2e/a "await w.screenshot({ path: out + '/now.png' }); return 'ok'"
./run.sh /tmp/tw-e2e/a "return 'QUIT'"          # 앱을 끄고 repl 도 끝낸다
```

명령마다 `console.txt` · `requests.txt` 를 다시 쓴다. 창을 바꿔 끼워야 하면 `c.w = …` 로 넣는다. 두 사람(친구 · 같은 방)을 보려면 결과 폴더를 둘 쓴다(`/tmp/tw-e2e/a` · `/tmp/tw-e2e/b`) — 앱 두 벌이 따로 돈다.

## 해 본 것 — REPL 로 (2026-11-17 확인)

- **캐릭터 만들기**: `#lcEmpty` → `#raceHuman` → «다음» 을 «완성 → 저장» 이 나올 때까지 누른다 → «완성 → 저장».
- **방 만들기 · 참여**: `방 만들기 / 참여하기` → `#lobbyCreate` 로 만든다. 참여하는 쪽은 `#lobbyGrid` 의 방 카드를 누른다. 코드 칸의 앞머리(WORK- · PLAY-)는 로비 탭이 아니라 그 칸의 이름표를 눌러서 고른다.
- **투게더룸**은 프리미엄이 있어야 한다. 로컬 DB 에서 그 계정을 관리자로 만들면 프리미엄이 붙는다 — 그다음 앱을 다시 켠다.
- **책상 모드**: `#lcPreview`. **채팅**: F5 → `#chatInput` 에 쓰고 Enter.
- **친구 요청**: 마이홈(`#lcNameBtn`) → 친구 탭 → `#mhAddToggleBtn` → `#mhAddInput` 에 친구 코드 → `#mhAddBtn`.
- **점검 켜고 끄기**: 관리자 토큰으로 관리자 설정 길 `PUT /v2/admin/config/app.maintenance` 를 부른다. 설정 알림은 앱마다 0~60초 사이에 흩어져 닿는다 — 바로 안 바뀌어도 1분은 기다린다.
- **로그아웃**: 내 정보 → `#miTabAcct` → `#acctLogoutBtn` → `#acctLogoutYes`.

## 함정

- **오프라인 흉내로는 realtime 이 안 끊긴다.** 크로미움 오프라인 흉내(`A.net(true)`)는 이미 열린 localhost 웹소켓을 끊지 않고, 다시 켜도 창의 `online` 이벤트를 쏘지 않는다. 다시 잇기를 보려면 realtime 컨테이너를 `docker pause` 했다가 `docker unpause` 하고, 창에서 `window.dispatchEvent(new Event('online'))` 를 직접 쏜다.
- **앱을 다시 켜는 흐름**(가입 끝의 [시작하기] 등)은 먼저 `await app.evaluate(({ app: a }) => { a.relaunch = () => {}; })` 로 다시 켜기 예약을 막는다. 막지 않으면 도구가 모르는 앱이 하나 더 뜬다. 앱이 꺼진 뒤에는 도구를 새로 띄운다(repl 은 `repl.js` 를 같은 결과 폴더로 다시 켬 · flow.js 는 스스로 다시 켠다).
- **런처의 × 는 앱을 끈다.** 창을 닫으려고 누르면 repl 도 할 일이 없어진다 — 끄려면 `'QUIT'` 을 쓴다.
- **보이는지 확인**: 화면에 고정된 겹창(fixed)은 `offsetParent === null` 이라 «안 보임» 으로 잘못 읽힌다. `getComputedStyle(el).display` 를 본다.
- **켤 때 한 번 새로 읽는다**(주소 돌리기를 건 뒤 첫 화면을 다시 부르려고). 그래서 한 번만 뜨는 알림(예: «로그아웃했어요»)은 그 새로 읽기에 먹혀 안 보일 수 있다.
