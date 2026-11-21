# e2e-local — 내 PC 에서 dev 앱을 끝까지 몰아 보기

dev 앱(`--tw-firebase=dev`)을 켜서 화면을 누르고 결과를 파일로 남기는 도구다. 앱이 부르는 dev 서버 · Firebase 주소를 이 PC 에 띄운 서버 · 에뮬레이터로 돌려서, 운영 · dev 데이터를 건드리지 않는다. 앱 설치본에는 들어가지 않는다(`apps/desktop/package.json` 의 `build.files` 밖). CI 에서도 돌지 않는다 — 손으로 돌리는 도구다.

| 파일 | 하는 일 |
|---|---|
| `lib.js` | 격리된 앱 한 벌 켜기 · 끄기 · 켤 때 주소 돌리기 확인 · 오프라인 흉내 · 조용한 창 · 막힌 요청 판정(`quietProblems`) · 같이 쓰는 값 한 곳(API · Auth 에뮬레이터 주소 `API` · `AUTH_EMU` · 메인 창 제목 `MAIN_WIN_TITLE` · 시험 비밀번호 `PW`) |
| `flow.js` | 정해진 흐름 한 바퀴(가입 → 다시 켜기 → 로그인된 책상 → 얼굴 PNG · GLB 올리기 · 받기 → 오프라인 · 온라인) |
| `quiet-main.js` | 조용한 창 — 시험 앱의 창 · 포커스를 화면 밖에 묶는다(아래 «조용한 창») |
| `route-main.js` | 주소 돌리기 — 시험 앱의 요청을 이 PC 서버 · 에뮬레이터로 돌리고 진짜 서버로는 못 나가게 막는다(아래 «주소 돌리기») |
| `run-all.js` · `scenarios/<영역>/*.js` | 자동 판정 시나리오 — 하나씩 돌리고 요약(종료 코드 · `steps.txt` 의 ok · FAIL) |
| `scenarios/_shared.js` | 네 묶음(account · room · core · social) 공통부 — 아래 «공통부» |
| `runlock.js` | 여러 사람 · 세션이 한 PC 에서 돌릴 때 한 번에 한 실행만 Electron 을 켜게 하는 잠금 |
| `seed/*.sql` | 시나리오가 쓰는 로컬 DB 시드(초대 코드 `invite.sql` · 관리자 `admin.sql` · 포커스 누적 `focus.sql` · 가챠 보너스 · 시험 파츠) |
| `repl.js` · `run.sh` | 앱을 켜 둔 채 JS 명령을 하나씩 보내기 |
| `FEATURES.md` | 앱 기능마다 이 도구의 시나리오 · `checks/` sim 이 있는지 적은 지도 — 빈 곳(할 일)부터 시나리오를 더한다 |

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

## 주소 돌리기 — 진짜 서버로는 안 나간다

감싸는 진입점이 앱 `main.js` 보다 먼저 `route-main.js` 를 부른다(조용한 창과 상관없이 늘). 세션마다 앱의 창 · 요청보다 먼저 걸린다.

- **돌리기** — 세션의 https 처리기(`protocol.handle`)가 이 PC 주소로 대신 받아 원래 주소의 답으로 준다(redirect 가 아니라 창에서 본 주소 · 출처가 그대로). `api-dev.together-working.com` → `127.0.0.1:8080` · `identitytoolkit` · `securetoken.googleapis.com` → Auth 에뮬레이터 `127.0.0.1:9099/<호스트>/…` · `firebasestorage.googleapis.com` → Storage 에뮬레이터 `127.0.0.1:9199`. `help.together-working.com` → 저장소 `firebase/hosting/help` 파일(firebase.json help 사이트처럼 cleanUrls · 없는 길 404). realtime 은 dev 판이 처음부터 `ws://127.0.0.1:8787` 이다.
- **막기** — 우리 데이터를 실을 수 있거나 우리 백엔드에 닿는 곳만 네트워크 오류로 끝낸다(ws · wss 포함): `*.together-working.com` · `identitytoolkit` · `securetoken` · `firebasestorage` · `firestore` · `firebaseinstallations.googleapis.com` · `*.firebaseio.com` · `*.firebasedatabase.app` · `*.firebaseapp.com` · `*.web.app`(돌릴 세 짝은 먼저 돌린다). 그 밖(유튜브 플레이어 · 글꼴 등)은 그대로 둔다. 막은 것은 결과 폴더 `net.txt` 에 `BLOCK` 줄로 남고 `lib.quietProblems` 가 문제로 낸다(시나리오는 그 단계가 실패하고 `e2e-quiet-fail` 에 주소가 남는다).
- **켤 때 확인** — `lib.launch` 가 앱 세션(main 의 `session.defaultSession.fetch`)으로 `https://api-dev.together-working.com/actuator/health` 를 불러 이 PC API 가 200 으로 답했는지(돌린 기록) · 막힌 요청이 없는지 본다. 아니면 앱을 끄고 실패한다(다시 읽기 · 다시 켜기로 감추지 않는다).
- 돌린 요청은 `net.txt` 의 `REQ` 줄 → `A.reqs`(옛 모양 `<방법> <길> <상태>` 그대로). 확인 시나리오는 `scenarios/launcher/routing.js`.

## 돌리기

### flow.js — 한 바퀴

```bash
cd apps/desktop/tools/e2e-local
node flow.js /tmp/tw-e2e/flow1                  # 초대 코드 기본값
node flow.js /tmp/tw-e2e/flow2 INVT-XXXX-XXXX   # 다른 초대 코드
```

결과 폴더에 남는 것: `steps.txt`(단계마다 ok · FAIL · 걸린 시간) · `console.txt`(렌더러 · 메인 로그) · `requests.txt`(돌린 요청 · 응답 코드) · 단계 화면 `01-invite.png` … · 실패 화면 `fail-<n>.png` · `account.json`(이번에 만든 친구 코드 · 시험 비밀번호 — 에뮬레이터 안에만 있는 계정). 끝나면 종료 코드 0, 실패하면 1.

### social 묶음

- `social` 묶음 공통부는 `scenarios/social/_kit.js`(`_` 로 시작하는 파일은 run-all 이 돌리지 않는다). 관리자 · 초대 코드 · 포커스 누적은 `seed/admin.sql` · `seed/invite.sql`(코드를 넘김) · `seed/focus.sql`(uid · 누적 초를 넘김) 을 로컬 DB 컨테이너(`TW_E2E_PG`, 기본 `tw-dev-local-postgres-1`)에 넣는다.
- 시험이 누를 수 없는 OS 창(파일 고르기)은 main 의 `dialog.showOpenDialog` 를 «이 파일을 골랐다» 로 바꿔 두고, 바깥 사이트 유튜브 제목 조회는 렌더러 fetch 를 그 주소에서만 가짜 답으로 바꾼다 — 앱 코드는 그대로다. 서버 실패는 이 앱만 오프라인(lib.js `net`)으로 만든다.

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

### run-all.js — 시나리오

```bash
node run-all.js                 # 전부
node run-all.js account         # 한 영역
node run-all.js core/keepalive  # 시나리오 하나
node scenarios/account/login.js /tmp/tw-e2e/account/login   # 하나만(러너 없이)
```

시나리오는 저마다 새 계정(새 친구 코드)을 만들고, 결과 폴더(`/tmp/tw-e2e/<영역>/<이름>`)를 비우고 시작한다. 판정은 화면 글 · 앱 상태 · 돌린 요청 기록 · API 응답으로 한다. 끝 줄이 `PASS` 면 통과(종료 코드 0). `BUG  <번호>` 줄은 FEATURES.md «발견한 버그» 에 적힌 버그가 아직 그대로라는 뜻이다(통과 판정은 바꾸지 않는다) — `FIXED` 로 바뀌면 그 버그를 표에서 지우고 시나리오의 그 자리를 일반 단계로 바꾼다. 모두가 보는 서버 값을 바꾸는 시나리오(core 의 배너 · 점검 · 공지 · 카테고리 · 시험 파츠)는 끝에 되돌리고, 못 되돌리면 `FIXED` 대신 `FAIL 정리: …` 줄로 실패가 된다.

#### 방 · 채팅(`scenarios/room` · `scenarios/chat`)

```bash
node run-all.js room chat       # 방 · 채팅 전부
node run-all.js room/create-join
```

- 결과 폴더는 `<TW_E2E_OUT 또는 /tmp/tw-e2e>/<영역>/<이름>` — 시작할 때 비운다. `steps.txt`(단계마다 `ok` · `FAIL` · 마지막 줄 `PASS` 또는 `ABORT`) · 사람마다 `a/` `b/` … 폴더(`console.txt` · `requests.txt` · `account.json` · 실패 화면 `fail-<n>.png`).
- 시나리오마다 새 계정을 가입시킨다(친구 코드는 서버가 새로 뽑는다). 두 사람 기능은 앱 두 벌(같은 계정 둘째 PC 는 그 계정으로 로그인한 셋째 벌).
- 판정은 앱 상태(방 meta · 좌석 · 대화창 글) · 화면 글 · API 응답으로 한다. realtime 이 오간 글은 `ws.txt` 에 남기지만(실패를 볼 때 참고) 창이 뜨자마자 붙은 연결은 놓칠 수 있어 판정에 쓰지 않는다. 소리 재생 · 복사는 이 PC 의 스피커 · 클립보드를 건드리지 않게 그 자리에서 가로채 센다.
- 시드: 초대 코드 `INVT-RMRM-E2E3` 은 시나리오가 켤 때마다 `seed/invite.sql` 로 넣는다(이미 있으면 남기되, 쓴 횟수가 상한에 가까우면 0 으로 되돌리고 멈춤 · 만료를 푼다). 투게더룸 · 시크릿룸 · 프리미엄 기능은 `seed/admin.sql` 로 그 계정의 로그인 uid 를 관리자로 넣고 다시 켠다(서버가 관리자에게 프리미엄을 붙인다). DB 컨테이너 이름은 `TW_E2E_PG`(기본 `tw-dev-local-postgres-1`).
- 방 · 채팅 시나리오도 **단계마다** `quietProblems(app)`(lib.js · 공통부 `_shared.js` 의 `quietGuard`)로 창이 조용한지 잰다 — 자식 창까지 진짜 창이 어느 화면과도 4분의 1 넘게 겹치지 않음 · 포커스 없음 · 진짜 불투명도 0 · 진짜 소리 끔 · 진짜 늘 위 아님 · 감싸지 않은 창 없음. 어긋나면 잠금 폴더 옆 `e2e-quiet-fail` 에 남기고 `run-all` 은 다음 시나리오를 켜지 않는다. 어긋나면 그 단계가 실패한다.
- 단계 하나는 3분(계정 묶음 5분 · core · social 은 상한 없음), 시나리오 하나는 `TW_E2E_SCENARIO_MIN`(기본 20)분을 넘으면 앱을 끄고 실패로 끝낸다(네 묶음 같음).

#### 컷오버 — 운영 0.12.3(`scenarios/cutover-012`)

지금 사용자 PC 에 깔린 **운영 0.12.3** 이 컷오버 차례(tw-docs `docs/design/06-cutover.md` 6장 — T-5 로그아웃 · T+0 점검 · T+2 규칙 · T+136 최소 버전 · T+145 점검 끔)를 만나면 무엇을 보이나 본다. 0.13 앱이 아니다.

```bash
git worktree add --detach ../.wt/app-0123 v0.12.3 && (cd ../.wt/app-0123 && npm install)   # 저장소 맨 위에서 한 번
cd apps/desktop/tools/e2e-local
TW_E2E_QUIET=1 TW_E2E_RUN_LOCK=<잠금 폴더> node run-all.js cutover-012
```

- **필요한 것**: `firebase` CLI · Java 11+ · `openssl`. tw-dev-local docker 묶음은 쓰지 않는다(건드리지 않음).
- **0.12.3 폴더**: `TW_E2E_APP012`, 없으면 저장소 옆 worktree(`<저장소>/../.wt/app-0123` 또는 worktree 끼리 `<저장소>/../app-0123`). `--tw-firebase=dev` 없이(운영 설정) 켠다 — 앱 코드는 그대로다.
- **띄우는 것**(시나리오마다 새로 · 빈 포트 · 끝나면 끔): Firebase 에뮬레이터(Database · Auth · Storage, 프로젝트 `demo-tw-c012`) · TLS 중계 · API stub. 운영 Firebase 프로젝트 · 운영 주소에는 닿지 않는다.
- **주소 돌리기(`_main012.js`)** — `route-main.js` 는 dev 주소(api-dev)만 알고, 운영 RTDB 는 wss 로 붙는데 webRequest 의 redirect 는 웹소켓에 듣지 않는다(해 보면 진짜 서버로 붙는다). 그래서:
  - 운영 RTDB 이름만 `host-resolver-rules` 로 TLS 중계(127.0.0.1)에 풀고, 그 이름의 인증서만 중계의 자체 서명 인증서를 받는다. 중계는 에뮬레이터로 넘기며 첫 handshake 의 `h`(에뮬레이터 주소)를 운영 이름으로 바꾸고(안 바꾸면 SDK 가 다음 연결을 `wss://127.0.0.1:<포트>` 로 열어 CSP 에 막힌다) 오간 글을 `rtdb.txt` 에 남긴다 — 쓰기 시도 · 거절은 여기서 센다. 긴 폴링(`.lp`) 답의 `h` 도 같이 바꾼다.
  - 이름 풀이: 운영 RTDB 이름 → TLS 중계 · localhost · `www.gstatic.com` 은 그대로 · 그 밖의 모든 이름은 `~NOTFOUND`.
  - https 처리기: `api.together-working.com` → API stub(`/v1/config` 는 시나리오가 고른 답 · 그 밖은 503 — 옛 API 를 멈춘 뒤와 같음) · identitytoolkit · securetoken → Auth 에뮬레이터 · firebasestorage → Storage 에뮬레이터 · `*.cloudfunctions.net` → stub 503 · `www.gstatic.com/firebasejs/` 만 그대로(앱이 SDK 를 받는 곳). **그 밖은 전부 막고** `net.txt` 에 `BLOCK` — 단계가 실패한다.
  - main 의 Node 요청(맥 업데이트 확인 `api.github.com`)은 stub 으로 · `shell.openExternal` · 시스템 창(`dialog`)은 열지 않고 `OPEN` · `DIALOG` 줄로만 남긴다 — 업데이트 단추를 눌러도 아무것도 내려받지 않는다.
- **켜기 전 문지기**(`_route012.js` 표 한 벌 · `_kit.guardLaunch`) — 시나리오마다 0.12.3 을 켜기 전에 ① 표만 보고 앱이 쓸 수 있는 Firebase · 우리 백엔드 이름(운영 RTDB · `*.firebasedatabase.app` · `*.firebaseio.com` · identitytoolkit · securetoken · firebasestorage · cloudfunctions · `api.together-working.com` 등 `GUARD_HOSTS`)이 이름 풀이 · https · wss 모두 이 PC 로만 가거나 막히는지, 스위치에 `no-proxy-server` 가 있는지, 중계 인증서 지문이 있는지 ② 앱 없이 같은 진입점 · 같은 스위치로 Electron 을 한 번 켜(`probe/`) 운영 RTDB 의 wss · https 가 `resolveProxy` 로 DIRECT 인지(아니면 아무것도 열지 않고 멈춤) · `resolveHost` 가 정말 그렇게 푸는지(표지 이름 `tw-e2e-guard.invalid` 가 먼저 규칙대로 풀린 뒤에만 다른 이름을 묻는다) · 운영 RTDB 이름의 wss 가 고정 인증서로 중계에 열리는지 · 막을 wss 가 막히는지 본다(판정 `R.probeProblems`).
  - **시스템 프록시**: 프록시(HTTP · SOCKS · PAC)가 있으면 Chromium 은 이름을 스스로 풀지 않고 프록시에 `CONNECT <이름>:443` 을 보내 이름 풀이 규칙이 듣지 않는다 — 그래서 `no-proxy-server` 로 끄고 확인용 실행이 DIRECT 를 확인한다.
  - **인증서 고정**: 운영 RTDB 이름은 이 실행이 만든 중계 인증서의 지문(`certificate.fingerprint`)과 같을 때만 받는다 — 어떤 길로든 진짜 Firebase 에 붙으면 인증서에서 끊긴다(두 번째 그물). 판정은 `net.txt` 의 `CERT` 줄. 어긋나면 앱을 켜지 않고 `FAIL 켜기 전 문지기 — …` 로 끝낸다(종료 코드 1). webRequest 는 wss 를 **막을 수는 있다**(redirect 만 안 듣는다) — 그래도 이름 풀이가 모든 이름을 `~NOTFOUND` 로 보내 막기를 놓쳐도 밖에 닿지 않는다. 표를 고치면 `node checks/run.js e2e-cutover-guard`(이 파일 글을 고친 mutation test — 인증서를 모두 받음 · no-proxy-server 뺌 · DIRECT 요구 뺌 · 이 PC 이름의 `^…$` 뺌 등 — 가 빨강인지까지 본다).
- **사용자**(`_kit.prepareUser`): 로그인을 연결한 옛 사용자 — Auth 계정 · `userAuth` · `authUsers` · 친구 코드를 넣고, 앱을 한 번 켜 `tw.myUserId` 를 적은 뒤 다시 켜 «로그인 필요» 창에서 친구 코드 비밀번호로 로그인하고, 한 번 더 켠다. 0.12.3 규칙(`v0.12.3:firebase-database-rules.json`)에서 시작해 시나리오가 컷오버 규칙(`firebase/firebase-database-rules-cutover.json`)을 에뮬레이터에 올린다(REST `.settings/rules.json` · owner). Storage 규칙은 0.12.3 저장소에 없어(콘솔 관리) «로그인한 사람은 읽고 씀» 으로 둔다.
- **판정 · 기록**: `steps.txt`(단계 줄 끝에 사용자가 본 창 · 토스트 · 🔑 띠) · 화면 `NN-*.png` · `pc/net.txt` · `rtdb.txt` · `api.txt` · `emu/emulators.log`. 단계마다 `lib.quietProblems` 로 조용한 창 · 막힌 요청을 본다(화면 · 포커스 · 소리로 새면 `e2e-quiet-fail`).
- **시나리오**: `maintenance`(T+0) · `rule-lock`(T+2 · T+145) · `force-update`(T+136 — /v1/config 503 · minVersion 0.13.0 · `config:{}`) · `revoked-login`(T-5).
- **함정**: T+2 뒤 0.12.3 은 «옛 버전 투게더워킹이 켜져 있어요» 창으로 앱 전체를 덮는다 — `rule-lock` 은 그 창을 찍은 뒤 **시험만** 창을 숨겨 그 아래 저장이 막히는지 본다(사용자는 할 수 없는 길). 점검 중에는 서버를 부르는 동작마다 점검 창이 떠 다음 누르기를 가리므로 `_kit.closeMaint` 로 닫고 누른다. Auth 에뮬레이터는 `validSince`(토큰 끊기)를 지키지 않는다 — `revoked-login` 은 토큰 다시 받기에 진짜 서버의 답(400 `TOKEN_EXPIRED`)을 대신 준다(단계 글에 적힘).

### 공통부(`scenarios/_shared.js`)

account · room · core · social 네 묶음의 `_kit.js` 와 `launcher` 시나리오가 같이 쓰는 한 벌이다. 묶음 kit 은 이것으로 시나리오 틀을 짜고, 그 묶음에만 있는 것(계정의 구글 로그인 흉내 · 방 · 좌석 도우미 · core 의 되돌리기 · 공유 스택 잠금 · social 의 마이홈 도우미)만 더한다.

- **틀** — `frame(영역, 이름)` 이 결과 폴더(`/tmp` · `TW_E2E_OUT` 아래 · 저장소 밖만)를 비우고 그 폴더에 남은 앱을 끈다. `step`(ok · FAIL 줄 · 실패 화면 `fail-<n>.png` · 단계 끝마다 조용한 창 판정) · `knownBug`(BUG · FIXED 줄) · `note`. `drive` 가 `e2e-quiet-fail` 확인 · 실행 잠금 · 시드 · 본문 · 앱 끄기 · 끝 줄(`PASS` · `ABORT` · `RESULT FAIL`) · 종료 코드를 맡는다. 단계 하나라도 FAIL 이면 실패다. 신호 · 시간 초과면 묶음이 건 `onSignal`(core 는 되돌리기)을 돌린 뒤 끝낸다.
- **조용한 창** — 단계마다 `lib.quietProblems` 와 막힌 요청을 보고, 어긋나면 앱을 다 끄고 `runlock.markQuietFail` 로 `e2e-quiet-fail` 에 남긴다. 판정을 못 했을 때(오류 · 10초 넘김)도 조용하다고 볼 수 없어 같게 다룬다 — 앱이 다시 켜지는 중(창 · 대상 닫힘)만 건너뛴다. 조용한 창 · 막힌 요청 자체를 시험하는 `launcher/quiet.js` · `launcher/routing.js` 는 `quietGuard: false` 로 이 판정을 끄고 스스로 본다(`quiet.js` 는 화면 · 포커스 · 소리로 새는 실패만 남기고, `e2e-quiet-fail` 이 있어도 돈다 — 지우기 전에 다시 통과해야 하므로).
- **앱 켜기 · 가입** — `launchRetry`(주소 돌리기가 안 걸린 실패는 다시 켜지 않고 `e2e-quiet-fail` 에 남김 · 그 밖의 실패만 세 번까지) · `signupForm`(초대 코드 → 비밀번호 가입 → 완료 화면) · `restartAfter`([시작하기] 처럼 앱이 스스로 다시 켜는 단추).
- **기다리기** — `waitUntil(fn, { ms, every, what })` 한 벌(core `poll` · account `waitFor` · room · social `until` 이 이것을 감싼다).
- **API** — `apiIn`(앱 창 안에서 앱 토큰으로) · `http` · `emuSignIn` · `headlessLogin`(Auth 에뮬레이터 로그인) · `apiUser`(앱 없는 계정) · `uidOf`.
- **시드** — `seedSql(파일, 변수)` · `query(SQL)` 은 `lib.docker` 로 로컬 DB 컨테이너(`TW_E2E_PG`)에 넣는다. 초대 코드는 묶음마다 다른 코드로 `seed/invite.sql` 한 벌(쓴 횟수가 상한에 가까우면 0 으로 되돌린다). social 은 `TW_E2E_INVITE` 를 받으면 그 코드를 건드리지 않는다.
- cutover-012 는 0.12.3 앱을 자기 문지기와 켜서 이 틀을 쓰지 않는다 — 결과 폴더(`outDir`) · `e2e-quiet-fail` 확인만 빌려 쓴다.

### 조용한 창 · 실행 잠금

- **조용한 창(`TW_E2E_QUIET`, 기본 켬 · `quiet-main.js`)** — 감싸는 진입점이 앱 main.js 보다 먼저 `quiet-main.js` 를 불러, 시험 프로세스 안에서만 electron 을 감싼다(앱 코드는 그대로). 앱은 «보조 앱»(mac `setActivationPolicy('accessory')` — Dock 아이콘 없음)으로 켜지고 `app.focus` · `app.show` · `dock.show` 는 아무것도 안 한다. 앱이 받는 `BrowserWindow` 는 하위 클래스로 바뀌어 처음부터 화면 밖(-20000, -20000) · 포커스 없이 보이고(`show` → `showInactive`), `focus` · `moveTop` · `maximize` · 전체 화면은 아무것도 안 하며, `setAlwaysOnTop` 은 값만 기억하고, `setBounds` · `setContentBounds` · `setPosition` · `center` 는 폭 · 높이만 따르고 자리는 «앱이 아는 자리» 로만 기억한다 — `getBounds` · `getPosition` · `getContentBounds` 는 그 자리를 돌려줘 앱이 화면 밖 값을 마지막 자리로 저장하지 않는다. 진짜 창은 투명(opacity 0) · 클릭 통과 · 소리 끔(mac 은 화면 밖 창을 화면 끝으로 당겨 놓아 끝자락이 보이고 눌릴 수 있다) — 앱이 부르는 `setAlwaysOnTop` · `setOpacity` · `setIgnoreMouseEvents` · `webContents.setAudioMuted`(BrowserView 등 모든 webContents) 는 값만 기억하고 `isAlwaysOnTop` · `getOpacity` · `isAudioMuted` 는 그 값을 돌려준다. 렌더러의 `window.open` 창(방명록 · 디자인 스튜디오)은 electron 이 안에서 만들어서, 모든 webContents 의 `setWindowOpenHandler` 를 감싸 처음부터 숨김 · 화면 밖 · 투명 · 늘 위 끔으로 열고, 만들어지자마자 같은 조용한 처리를 건다. 시험이 진짜 값을 볼 땐 `w.__e2eRealBounds()` · `w.__e2eRealOpacity()` · `w.webContents.__e2eRealAudioMuted()` · `w.__e2eRealAlwaysOnTop()` · 앱이 정한 클릭 통과는 `w.__e2eIgnoreMouse()`. Playwright 입력은 CDP 로 가서 포커스 · 클릭 통과와 상관없고, 화면 밖에서도 타이머 · WebGL 이 돌게 배경 늦추기를 끈다. 네 묶음이 이 한 벌을 같이 쓴다. 확인은 `scenarios/launcher/quiet.js`(lib.js 만 써서 계정 · 시드 없이 돈다 — 켠 뒤 · 앱이 창을 앞으로 부르는 길을 부른 뒤 · 창 목록 · window.open 자식 창 · BrowserView 소리 — 판정은 `lib.quietProblems` 한 곳 · 화면 · 포커스 · 소리로 새는 실패만 `e2e-quiet-fail` 에 남김). 시나리오 안에서는 `lib.quietProblems(app)` 이 단계마다 같은 규칙을 보고(`_shared.js` 의 `t.step` 끝마다 — 네 묶음 같음), 깨지면 잠금 폴더 옆 `e2e-quiet-fail` 에 까닭을 남긴다 — `run-all.js` 는 그 파일이 있으면 다음 시나리오를 켜지 않는다. 그 파일은 아무도 저절로 지우지 않는다: 까닭을 보고 고친 뒤(`scenarios/launcher/quiet.js` 가 다시 통과한 뒤) 사람 · 세션이 지운다. `quiet:false` 로 켠 앱은 단계 판정에서 건너뛴다. 눈으로 보려면 `TW_E2E_QUIET=0`. 화면에 꼭 떠야 하는 시나리오(창 앞뒤 · 바깥 눌러 닫기)는 `makeApp(out, { quiet: false })` 로 그 앱만 끄고 시나리오 머리에 까닭을 적는다.
- **실행 잠금(`TW_E2E_RUN_LOCK`)** — 잠금 폴더 경로를 주면 `mkdir` 로 잡고(있으면 30초마다 다시) 끝나면 `rmdir` 한다. `run-all.js` 가 잡으면 시나리오는 다시 잡지 않는다. 비워 두면 잠그지 않는다. 잡은 프로세스가 SIGKILL · 전원 꺼짐으로 죽으면 잠금 폴더가 남는다 — `owner` 의 pid 가 살아 있지 않으면(`ps -p <pid>`) 손으로 `rm <잠금>/owner; rmdir <잠금>`.

core · social 묶음 환경 값(`scenarios/core/_kit.js` · `scenarios/social/_kit.js`):

| 값 | 뜻 |
|---|---|
| `TW_E2E_STACK_LOCK` | 공유 컨테이너(realtime 등)를 멈췄다 풀 때만 잡는 잠금 폴더. 비어 있으면 컨테이너를 건드리는 시나리오(keepalive · 오프라인 → 온라인 · 점검)는 멈춘다. 신호로 끝나도 exit 에서 잠금을 지우고 멈춘 realtime 을 푼다 |
| `TW_E2E_INVITE` | 가입에 쓰는 초대 코드(core 기본 `INVT-C2RE-TEST` · social 기본 `INVT-SCAL-E2E3`). 기본 코드는 시나리오가 `seed/invite.sql` 로 넣는다 — core 는 준 코드도 넣고, social 은 준 코드를 건드리지 않는다 |
| `TW_E2E_PG` · `TW_E2E_RT` | DB · realtime 컨테이너 이름(기본 `tw-dev-local-postgres-1` · `tw-dev-local-rooms-dev-1`) |
| `TW_E2E_ADMIN_PASS` | 앱 관리자 비밀번호. 없으면 시험 글자 하나만 앱의 비밀번호 해시로 바꿔 주는 덮개를 창에 건다(비교 · 서버 확인 · 모드 켜기는 앱 코드 그대로) |

### 앱 끄기(`scenarios/core/quit-*.js`)

- 공통부는 `scenarios/core/_quit.js`. 캐릭터를 고쳐 3초 묶음 저장이 예약된 채(`closetMod.unsavedCount() > 0`) 끄고, main 의 `before-quit` 을 `net.txt` 에 `E2E <시각> before-quit held|go` 줄로 남긴다 — 같은 파일의 `REQ PUT /v2/me/avatars/…` 줄과 앞뒤를 견줘 «붙잡음 → 저장 200 → 놓아 줌» 을 본다.
- 메인 창 닫기는 그 창의 `close` 를 같은 방법으로 `E2E <시각> close held|go` · `E2E <시각> closed` 줄로 남기고 «close held → 저장 200 → close go → closed» 를 본다(`checkHeldClose`). 앱의 `beforeunload` 가 저장 PUT 을 기다리지 않고 보내고 그 요청은 main 을 거쳐 렌더러가 사라진 뒤에도 200 으로 닿을 수 있어, «닫힌 뒤 PUT 200» 만으로는 닫기를 붙잡았는지 모른다. mac 에서 다시 연 창은 새 창이라 `watchClose` 를 다시 건다.
- 메뉴 «종료» 도 `watchClose` 를 걸어 «붙잡은 뒤 저장 전에 메인 창이 닫히지 않음» 까지 본다(`checkHeldSave`). 꺼지는 시간은 그 뒤 두 번째 그물로 `quit-hold.js` `GUARD_MS` 안인지 본다.
- 못 올린 고침이 없을 때(`quit-idle.js`)의 «바로 꺼짐» 상한은 렌더러 상한(`app/parts/shared/leave-flush.js` `LEAVE_FLUSH_MAX_MS`)보다 짧아야 판정이 된다 — `_quit.js` 가 그 값을 파일에서 읽어 견준다.
- 서버 값은 앱 없이 `_shared.js` 의 `headlessLogin(친구 코드, 비밀번호)`(Auth 에뮬레이터 로그인)으로 본다 — `headlessUser` 도 같은 것을 쓴다.
- 메뉴 «종료» 는 main 에서 앱 메뉴의 role quit 항목을 찾아 누른다(OS 키는 보내지 않는다). mac 의 role quit 은 네이티브 항목이라 `MenuItem.click()` 이 아무것도 안 해서, 메뉴가 누를 때 보내는 `Menu.sendActionToFirstResponder('terminate:')` 를 보낸다(Cmd+Q 와 같은 길). mac 에서 그 항목이 없으면 실패다. 윈도우 · 리눅스는 앱 메뉴가 없어 제목줄 × 와 같은 `companion:quitApp` — 앱이 먼저 꺼져 «Target closed» 로 끝나는 것만 받아 준다.
- mac 에서 메인 창을 닫으면 창이 0개가 되어 단계 끝의 조용한 창 판정(«창이 하나도 안 보임»)이 틀리게 걸린다 — `quit-close.js` 는 닫기부터 Dock 누르기(`app.emit('activate')`)로 다시 열기까지를 한 단계로 둔다.

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
