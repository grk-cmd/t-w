# Together Working — Claude Code 작업 안내

책상 위에 사는 3D 데스크톱 컴패니언(Electron) + Firebase 백엔드. 이 저장소는 **공개**다.
이 프로젝트를 쓰는 사람 중엔 비개발자도 많다 — 설명은 **한국어로, 쉬운 말로**, 무엇을 바꾸는지 먼저 말하고 진행한다.

## 응답 · 커밋 규칙
- 답변, 문서, 커밋 메시지는 **한국어**. 코드 식별자·명령어는 원문 그대로.
- 커밋 메시지·PR 본문에 **Claude 표기(`Co-Authored-By: Claude…`, `Generated with Claude Code`)를 넣지 않는다.**
- 커밋 형식: `타입(스코프): 무엇을 — 부연` + 빈 줄 + `- 파일: 내용` 목록. 타입: `feat` `fix` `security` `refactor` `perf` `test` `docs` `ci` `build` `chore`. 자세한 건 `docs/GIT_CONVENTION.md`.
- 버그 제보를 고친 커밋 · PR 은 제목 끝에 `(B-MMDD-n)` 을 붙이고(여러 건이면 `(B-1009-1 · B-1009-3)`), 본문 «무엇을» 줄 앞에도 같은 번호를 적는다. 번호는 웹 관리자 🐞 제보에 보이는 고정 번호(«(임시)» 표시가 붙은 번호는 쓰지 않는다).
- 한 커밋에 한 의도. `checks/` 를 바꿨으면 `checks/CHECKS.md` §3 해시를 **같은 커밋**에서 갱신한다.
- 커밋·push 전에 무엇을 올리는지 한 줄로 알리고 진행한다. **force push 는 하지 않는다.**
- **PR**: 한 PR = 한 의도(버그 수정 묶음과 새 기능은 나눈다). 제목은 커밋 제목 형식(이모지 없음), 본문은 `.github/pull_request_template.md` 틀 그대로 — «무엇을» 은 커밋과 1:1. 자세한 건 `docs/GIT_CONVENTION.md` 3장.
- 절대 커밋하지 않는 것: `oauth-config.js`(OAuth 시크릿), `.env*`, `.idea/`, `*.iml`, `dist/`.

## 작업 전 할 일 확인
여럿이 같이 고치니 같은 일을 겹쳐 하지 않게 웹 관리자 📋 할 일(`adminTodos`)을 먼저 본다. 자세한 건 `/todo` 스킬.
1. **확인** — 코드 작업을 시작하기 전에 `node scripts/todo.js find <낱말>` · `brief`. 비슷한 일이 진행 중이면 멈추고 사용자에게 묻는다.
2. **등록** — 겹치지 않으면 `node scripts/todo.js start "<제목>" --type feat|bug`. 나온 id 를 PR 본문 `할 일:` 줄에.
3. **완료** — PR 이 머지되면 `node scripts/todo.js done <id> --release <다음 버전>`.
- 관리자 Google 계정으로 `gcloud auth login` 한 사람만 쓴다. 처음 한 번 `node scripts/todo.js setup`. 세션 시작 때 진행 중인 할 일이 자동으로 보인다(관리자가 아니면 조용히 안 나온다).

## 구조
| 위치 | 내용 |
|---|---|
| `main.js` · `preload.js` | Electron 메인 프로세스, IPC(`window.companion`) |
| `overlay-{win,mac}.js` · `sysinput-{win,mac}.js` | 플랫폼 모듈. 두 파일은 **export 이름이 같아야** 한다 |
| `app/desk-companion-prototype.html` | 렌더러 진입 HTML (CSP 정의) |
| `app/parts/app.js` | 렌더러 본체 (~45k줄, 전역 스코프). `/* ═══ 제목 ═══ */` 구역으로 나뉜다 |
| `app/parts/firebase-init.js` | Firebase SDK 초기화 + `window.firebaseAPI` (DB 경로는 여기서 찾는다) |
| `app/parts/room-*.js` · `invite-account.js` | 도메인 모듈 — `createXxx(deps)` 로 필요한 함수 · 상태를 받는다(Firebase 직접 import 없음). `firebase-init.js` 는 연결만 |
| `firebase-database-rules.json` | **Realtime Database 보안 규칙 — 서버 쪽 검증의 전부** |
| `functions/` | Cloud Functions (비밀번호 변경, 휴지통 청소, 방 개수 집계 `room-stats.js`, 일일 접속 집계 `daily-active.js`, IP 기준 방문자 `visit-ping.js`, 날짜별 요약 `daily-summary.js`, 사용량(비용) 기록 `usage-snapshot.js`, 카탈로그 항목별 장착 사용자 수 `part-equip.js` · 처음 숫자는 `scripts/backfill-part-equip.js`, 버그 제보 고정 번호 `bug-no.js` · 옛 글 번호는 `scripts/backfill-bug-no.js`). **자동 배포 대상이 아니다** |
| `hosting/` | Firebase Hosting (폰 연결 안내 페이지). `hosting/admin/` 은 `web-admin` 빌드 결과(커밋 안 함) |
| `web-admin/` | 웹 관리자 페이지 (Vite + React + TS + TanStack Query) — `/admin` 으로 배포. **FSD** 구조(`app` → `pages` → `widgets` → `features` → `entities` → `shared`, 위층만 아래층을 부름 · Steiger 가 검사). 테스트는 `tests/` |
| `checks/` | 자체 검사 (`sim-*.js` · `audit.py` · `run.js` 러너 · `CHECKS.md` 정본 표) |
| `.github/workflows/` | `checks.yml`(push·PR 마다 검사) · `deploy-dev.yml`(규칙 → dev) · `release-start.yml`(버튼 → 검사 · 버전 태그 · release 실행) · `release.yml`(버전 태그 → 빌드 · 검사 · 자동 공개) · `min-room-ver.yml` · `mac-probe.yml`(맥 빌드, 수동) |

## 명령
```bash
npm install          # 의존성 (postinstall 로 node-window-manager 패치)
npm start            # 앱 실행 (운영 Firebase)
npm run start:dev    # dev Firebase(together-working-dev)로 실행 — 테스트는 이걸로
npm run check        # 검사 전체 — 마지막 줄 «빨강 0» 이면 통과. 첫 바퀴의 ✗ 는 다음 바퀴에서 통과하면 정상

# 웹 관리자 (처음 한 번 npm --prefix web-admin install)
npm run admin:dev    # 로컬 개발 서버 (dev DB · firebase login 필요) → http://localhost:5173/admin/
npm run admin:test   # vitest
npm --prefix web-admin run lint   # oxlint + steiger(FSD 층 규칙) — CI 에서도 돈다
```

## 코드 컨벤션
- 앱(Electron)은 순수 JS, 번들러·TS 없음. **`web-admin/` 은 예외** — Vite + React + TS(strict), Prettier(`npm --prefix web-admin run format`), 조각 전용 스타일은 옆에 `*.module.css`. 여러 경로를 함께 쓰는 쓰기는 `db.commit` 한 묶음으로. `const` 위주, 2칸 들여쓰기, 작은따옴표, 세미콜론. 앱 쪽은 `if(`, `functions/` 는 `if (`.
- 새 로직은 `firebase-init.js` · `app.js` 에 쌓지 말고 도메인 모듈 파일로 만든다(위 구조 표). 모듈마다 검사(`sim-*.js`)를 붙인다.
- UI 를 고치거나 새로 만들 때는 `docs/design-system/` (원칙 · 토큰 · 부품 지침)을 따른다. 그 폴더를 고쳤으면 `npm run design:build` 로 `hosting/design/` 도 다시 만든다.
- 주석은 한국어로, **코드만 봐서는 모를 이유**만 짧게. 변경 이력 · 날짜 · 실측치는 커밋 메시지와 PR 에 적고, 이모지 꼬리표는 쓰지 않는다. 할 일은 `TODO:`.
- 여러 곳에서 쓰는 값(채널 이름, 접두사 등)은 상수로 둔다.
- localStorage 키는 `tw.` 접두사.
- 서버 데이터는 **Firebase Realtime Database**(JSON 트리). 요금은 **내려받은 바이트**로 나온다 —
  노드를 통째로 `get`/`onValue` 하지 말고 필요한 하위 경로만 읽는다. 반복 폴링·부팅마다 전체 받기를 새로 만들지 않는다.
- 권한 검사는 서버에 없고 규칙 파일뿐이다. 남의 데이터에 쓰는 기능을 만들면 규칙도 같이 본다.
- **규칙이 바뀌는 기능 개발 · 수정은 PR 본문에 «서버(AWS) 이관» 안내를 쓴다**(바뀐 경로 · 칸 · 권한 · 앱에서 쓰는 곳, 방에 오가는 칸인지). 자체 서버(`t-w-server`, 비공개 · 방 서버는 모르는 칸을 받지 않음)로 옮기는 중이라 관리자가 이 안내로 서버에 옮긴다. 형식은 `docs/GIT_CONVENTION.md` 4.1 · `.github/pull_request_template.md`.

## Firebase 규칙 · 배포
- `firebase deploy` 는 **모든 사용자에게 즉시 적용**된다. 기본 프로젝트(`.firebaserc`)는 **운영 `together-working`**.
- 규칙을 바꾸면 순서: ① 앱에서 그 경로를 쓰는 곳을 전부 grep(`firebase-init.js`, `app.js`, `purikura-net.js`, `functions/`) ② `npm run check` ③ **dev 에 먼저**: `firebase deploy --only database --project together-working-dev` ④ 확인 후 운영 배포.
- 규칙 함정: 상위 `.write` 가 하위 삭제를 대신 받아 주는 곳이 있다(예: `rooms/$room` ↔ `_photo`). 삭제(null)에는 `.validate` 가 안 돈다. 권한이 거부된 `onValue` 구독은 재시도 없이 끊긴다.
- 자동화(GitHub Actions): `main` 에 규칙이 바뀌어 push 되면 `deploy-dev.yml` 이 **dev 에 자동 반영**, 운영 규칙은 **사람이 태그 전에 직접** 배포한다(`release.yml` 은 규칙을 다루지 않는다). `config/minRoomVer` 는 웹 관리자 ⚙️ 설정에서(최신 릴리스까지만 · 작업 기록에 남음). `min-room-ver.yml` 은 운영 권한 변수가 생기기 전까지 동작하지 않는다. 릴리스 절차는 `docs/RELEASE.md`.
- 운영 DB 데이터를 대량으로 읽거나 고치기 전에는 몇 건·무엇을 읽는지 먼저 말하고 확인받는다.

## 릴리스 순서: ① 서버 → ② 버전 태그(→ 자동 공개)
1. **서버** (바뀐 것만): 함수는 자동 배포가 없으니 `firebase deploy --only functions:<이름> --project together-working` 을 앱 릴리스 **전에** 직접. 운영 규칙도 바뀌었으면 태그 전에 직접 `firebase deploy --only database --project together-working`. 옛 앱이 깨지지 않는지 확인한다.
2. **버전 태그**: Actions › **release-start** › Run workflow(patch · minor · beta) 버튼, 또는 main 에서 `git pull --rebase` → `npm run check` → `npm version patch -m "chore: %s"` → `git push --follow-tags`. 태그가 올라가면 `release.yml` 이 Windows · Mac 빌드 → 설치 파일 검사(dmg 열림 · 버전 · arch · 켜짐 · yml sha512 · 업로드 sha256) → **통과하면 공개**까지 자동. 빨강이면 초안으로 남는다. 버튼의 «공개 방식» 을 `초안으로 대기` 로 고르면 검사까지 같고 공개만 Releases 에서 사람이 누른다(정식은 «Set as the latest release» 체크 확인). 버튼은 main 의 그 커밋에 `checks.yml` 이 이미 초록이면 검사를 건너뛴다(없으면 직접 돌림). 테스트 빌드는 `npm version prerelease --preid=beta`(dev 에 붙고 일반 사용자에겐 안 감).
3. 방 통신 형식이 바뀐 버전이면, 사용자 대부분이 업데이트한 뒤 웹 관리자 ⚙️ 설정의 «방 입장 최소 버전» 으로 `config/minRoomVer` 를 올린다(올리면 낮은 앱은 방 입장이 막힌다). 자세한 절차는 `docs/RELEASE.md`.

## 문서
- `docs/GIT_CONVENTION.md` 커밋·브랜치·릴리스 규칙
- `docs/GUIDE_NON_DEVELOPER.md` 비개발자용 VS Code · Claude Code · git 안내
- `docs/design-system/` 디자인 시스템(원칙 · 토큰 · 부품) — 웹으로는 https://together-working.web.app/design/
- `handoff-*.md` 세션 인수인계 기록 (설계 배경)
