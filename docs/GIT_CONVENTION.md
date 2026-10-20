# Git 커밋 · 브랜치 규칙

> 지금까지 히스토리에서 써 온 관례(한국어 메시지, Conventional Commits)를 그대로 이어 갑니다.
> 그 위에 브랜치, PR, 배포 규칙을 더했습니다.
> 작성 2026-10-03 · 관례의 근거는 [PROJECT_ANALYSIS.md §6](PROJECT_ANALYSIS.md#6-커밋-규칙--코드-컨벤션)에 있습니다.

---

## 1. 커밋 메시지

### 1.1 형식
```
<타입>(<스코프>): <무엇을> — <부연>

- 파일명: 바꾼 내용
- 파일명: 바꾼 내용

Refs: <이슈·핸드오프 문서>        ← 선택
```
- **언어**: 제목과 본문 모두 한국어로 씁니다. 코드 식별자와 파일명은 원문 그대로 둡니다.
- **제목**: 72자 이내로 쓰고 마침표는 붙이지 않습니다. 여러 항목은 ` · `로 나열합니다.
- **CHECKS 개정 번호는 쓰지 않습니다**: 제목에 `(CHECKS 개정 N)` 을 붙이지 않고, `CHECKS.md` 에 개정 번호 · 기록도 적지 않습니다(내력은 `git log -- checks/`). PR 마다 같은 줄을 고쳐 늘 충돌이 났습니다.
- **본문**: 빈 줄 하나 뒤에 `- 파일: 내용` 형식의 목록을 씁니다. "왜"가 코드 주석에 없으면 본문에 적습니다.

### 1.2 타입

| 타입 | 언제 | 예 |
|---|---|---|
| `feat` | 새 기능 | `feat: 북마크 책장 · 숨기기` |
| `fix` | 버그 수정 | `fix(mac): getWindowTitle NULL 크래시 수정` |
| `security` | 보안 수정 (규칙 잠금, 권한, 비밀값) | `security(rules): inbox 쓰기를 주인·관리자로 제한` |
| `refactor` | 동작이 같은 구조 변경 | `refactor(app): 친구 구역을 friends.js 로 분리` |
| `perf` | 성능 | `perf: 비활성 창 FPS 12 로` |
| `test` | `checks/` 검사만 바꿈 | `test: sim-admin-rules 새 규칙 반영` |
| `docs` | 문서, 핸드오프 | `docs: 커밋·브랜치 규칙` |
| `ci` | GitHub Actions | `ci: 맥 빌드 아티팩트 보관 3일` |
| `build` | electron-builder, 의존성, 패키징 | `build: electron 44.3.0` |
| `chore` | 버전 올림, 정리 | `chore: 0.10.1` |
| `revert` | 되돌림 | `revert: <원래 제목>` |

> 예전 `handoff:` 접두사는 `docs(handoff):`로 통일합니다.
> `feat/fix:`나 `feat: … / fix: …`처럼 두 타입을 한 커밋에 섞지 않고, 커밋을 나눕니다(1.4).

### 1.3 스코프 (선택)

| 스코프 | 범위 |
|---|---|
| `main` | `apps/desktop/main.js`, `apps/desktop/preload.js` (메인 프로세스, IPC) |
| `app` | `apps/desktop/app/parts/app.js`, HTML (렌더러) |
| `firebase` | `firebase-init.js` (SDK 다리) |
| `rules` | `firebase/firebase-database-rules.json` |
| `functions` | `firebase/functions/` |
| `hosting` | `firebase/hosting/` |
| `win` / `mac` | 플랫폼 모듈 (`*-win.js`, `*-mac.js`) |
| `checks` | `checks/` 러너, 도구 |
| `probe` | `.github/workflows/mac-probe.yml` |
| 기능 이름 | `myhome`, `mallang`, `purikura`, `noise`, `bookmark`, `gacha`, `focus`, `room`, `chat`, `friend`, `license` … |

### 1.4 커밋 단위
- **한 커밋에는 한 가지 의도만 담습니다.** 「세션 묶음」 커밋은 더 만들지 않습니다.
- **규칙(`rules`)은 따로 커밋합니다.** 서버 배포 단위가 앱과 다르기 때문입니다(4장).
- 검사 파일을 바꾸면 `CHECKS.md`의 해시(§3 표)를 **같은 커밋**에서 갱신합니다. 다른 커밋으로 나누면 그 사이 커밋에서 `npm run check`가 「판이 다르다」로 빨개집니다.
- 커밋하기 전에는 고친 검사만 돌립니다(`node checks/run.js <이름>`). 검사 전체는 push 하면 CI 가 돌리니 로컬에서 다시 돌리지 않습니다.

### 1.5 예시
```
security(rules): 관리자 기능 때문에 열어 둔 쓰기 5곳 잠금

- firebase/firebase-database-rules.json: friendCodes 목록 읽기 → 관리자만
- firebase/firebase-database-rules.json: users/invite · inbox 쓰기 → 주인 또는 관리자
- firebase/firebase-database-rules.json: rooms/$room 통째 삭제 → 관리자만, _photo 청소는 분리
- firebase/firebase-database-rules.json: stats/userCount → +1 만 (임의 값은 관리자)
- firebase/firebase-database-rules.json: licenseRequests → 새 신청만 (승인·거절은 관리자)
- checks: sim-admin-rules · sim-google-login · sim-purikura-rules 기대값 갱신, CHECKS.md 해시
```

---

## 2. 브랜치

### 2.1 구조 — 판(버전) 브랜치 (2026-10-19)
```
main ───────────●──────────────●──── (낸 것만 · 태그 vX.Y.Z)
               ↑ merge commit  ↑
release/0.12.0 ●──●──●─────────┘        ← 0.12.0 에 나갈 작업만
                \  ↑  ↑
                 \ fix/… feat/…  (squash)
release/0.12.1    ●──●──●── …           ← 다음 판. 앞 판 브랜치에서 따고, 앞 판이 바뀌면 합쳐 받는다
```
- **작업을 시작하기 전에 «어느 버전에 릴리스될 작업인가»를 사용자에게 묻는다.** 답한 판의 `release/X.Y.Z` 에서 브랜치를 따고 그 판으로 PR 한다. 판마다 무엇을 넣을지 **골라 담기** 위해서다(한 줄기 `dev` 에 모으면 들어간 순서대로 다 실린다).
- **`main`**: 낸 것만. 작업 PR 을 받지 않는다. 예외는 작업 규칙 문서(`harness/*` PR) · `hotfix/*`. 지금 누가 무엇을 하나는 파일이 아니라 열린 PR · 이슈(`docs/WORK_STATUS.md`).
- **판 브랜치 `release/X.Y.Z`**: 사용자가 판을 정할 때 연다(작업자가 만들지 않는다). 다음 판은 앞 판 브랜치에서 딴다.
- **내기**: 판 브랜치 → `main` PR 을 **merge commit**(squash 아님)으로 합친 뒤 `main` 에서 버전 태그(5장). 그다음 `main` 을 아직 열린 판 브랜치들에 합치고, 낸 판 브랜치는 지운다.
- **긴급 수정**: `main` 에서 `hotfix/<설명>` → `main` PR → 패치 릴리스 → `main` 을 열린 판 브랜치들에 합친다.
- `main` 의 규칙 문서가 바뀌면 판 브랜치에 `main` 을 합쳐 받는다.

### 2.2 이름
```
<타입>/<짧은-설명>          예) feat/bookmark-shelf
<타입>/<스코프>-<설명>       예) fix/mac-window-title, security/rules-owner-write
```
- 타입은 커밋 타입(1.2)과 같은 목록을 씁니다.
- 영어 소문자와 `-`만 씁니다(한글, 공백, `_`는 쓰지 않음).
- 긴급 운영 수정은 `hotfix/<설명>`으로 만들고, 합친 뒤 바로 패치 버전을 릴리스합니다.

### 2.3 합치기
- 작업 → 판 브랜치는 **Squash merge**. PR 제목이 그대로 판 브랜치의 커밋 제목이 되므로 1장 형식을 지킵니다. 판 브랜치 → `main` 만 merge commit.
- 합친 브랜치는 지웁니다.
- 충돌은 그 판 브랜치를 rebase해서 해결합니다(`git pull --rebase origin release/X.Y.Z`).

---

## 3. PR

### 3.0 규칙
- **한 PR = 한 의도.** 버그 수정 묶음과 새 기능은 PR 을 나눈다. 새 기능도 하나씩(예: 채팅 탭 · 버그 게시판은 따로).
  버그 제보 여러 건을 한 PR 로 묶는 건 괜찮지만, 거기에 새 기능을 섞지 않는다.
- **제목 = 커밋 제목 형식**(1.1): `타입(스코프): 무엇을 — 부연`. squash 하면 PR 제목이 그대로 `main` 의 커밋 제목이 된다.
  - 72자 안쪽, 마침표 없음, **이모지 없음**, 개수를 쓰면 실제와 맞게(예: «수정 13건»).
- **본문은 템플릿(3.1)을 그대로** 쓴다. GitHub 에서 PR 을 열면 `.github/pull_request_template.md` 가 자동으로 채워진다. 해당 없는 칸은 «없음».
  - **«무엇을»** 은 커밋과 1:1 로 맞춘다 — 커밋에 있는 변경은 빠짐없이, 없는 건 적지 않는다.
  - **버그 제보를 고친 커밋 · PR 은 제목 끝에 `(B-MMDD-n)` 을 붙이고**(여러 건이면 `(B-1009-1 · B-1009-3)`), 본문 «무엇을» 줄 앞에도 같은 번호를 적는다.
    번호는 웹 관리자 🐞 제보에 보이는 **고정 번호**다(서버 함수가 붙이고, 글을 지워도 바뀌거나 다시 쓰이지 않는다). «(임시)» 가 붙은 번호는 아직 고정되지 않은 것이니 쓰지 않는다.
    예) `fix(app): 채팅 탭 이름 잘림 — 줄임표 (B-1009-1 · B-1009-3)` / 본문 `- B-1009-1 apps/desktop/app/parts/chat-tabs.js: …`
  - 예전 방식의 제보 번호(`(#번호)`)를 쓴 옛 커밋은 그대로 둔다 — 그 번호도 커밋 제목의 `(#번호)` 와 본문이 같은 번호를 쓴다.
  - 사용자 입장에서 무엇이 달라지는지 먼저, 코드 설명은 그다음.
  - **«담당:» 줄 · «건드리는 파일» 칸** — 착수 때 PR 을 먼저 열면 남과 겹치는지 이 칸(코드가 오른 뒤엔 실제 diff 도)으로 본다(`docs/WORK_STATUS.md`). 담당은 남과 겹치지 않는 이름, 파일은 한 줄에 하나 · 백틱으로. 파일이 없으면 «없음».
  - **맨 위 `할 일:` 줄**에 이 작업의 할 일 id 를 적는다(`node scripts/todo.js start` 로 받은 것 · CLAUDE.md «작업 전 할 일 확인»). 머지되면 `done <id> --release <버전>`. 할 일은 버그 제보 관련만 등록하므로 그 밖의 PR 은 «없음».
- **규칙 · Functions · 방 통신 칸**을 바꿨으면 «배포 영향» 과 «서버(AWS) 이관» 칸을 꼭 채운다(4장 · 4.1).
- **서버(API 서버 · 웹소켓 서버)가 있어야 끝나는 일**인데 서버에 손댈 수 없으면(이 계정 밖 · 다른 PC) «서버 작업 필요» 칸에 적는다(4.2). 서버는 이 저장소 주인 PC 에서만 고친다.
- **Claude 표기(`Co-Authored-By: Claude…`, `Generated with Claude Code`, 세션 링크)를 넣지 않는다.**
- 머지는 CI(`npm run check` · 웹 관리자 테스트)가 **초록인 것을 확인한 뒤** 한다.

### 3.1 본문 템플릿
```markdown
할 일: <id>
담당: <세션 · 사람 이름>
## 건드리는 파일
- `경로` (폴더는 끝에 /)
## 무엇을
## 왜
## 확인한 것
- [ ] 고친 검사 통과 · CI 초록(검사 전체는 CI 가 돈다)
- [ ] 실기기 확인 (Windows / mac) — 해당 시
- [ ] 규칙 변경이면 4장 절차대로 했는가
## 배포 영향
- 앱 릴리스 필요: 예 / 아니오
- 규칙·Functions 배포 필요: 예 / 아니오 (예면 순서 적기)
## 서버(AWS) 이관 — 규칙(`firebase/firebase-database-rules.json`)을 바꿨으면 필수
- 바뀐 경로: 예) `rooms/$room/_meta/tabs`, `users/$id/bugSeen`
- 무엇이 바뀌었나: 새 칸 · 모양(형식 · 길이) · 누가 읽고 쓰나(권한) · 지우기
- 앱에서 쓰는 곳: 파일 · 함수
- 방에 오가는 칸(멤버 payload · `_meta` · 채팅)이면: 방 서버에도 같은 칸이 필요함 — 예 / 아니오
## 서버 작업 필요 — 서버가 있어야 끝나는 일이면 필수
- 필요한 것: API 엔드포인트 · 웹소켓 메시지 · 서버 설정 — 예) `GET /rooms/:id/members`, 메시지 `tab.update`
- 입력: 누가 · 무엇을 보내나(칸 · 형식 · 길이)
- 출력 모양: 돌려받는 칸 · 형식 · 실패할 때
- 권한: 누가 무엇을 볼 수 있나 — 남의 정보가 보이면 안 됨
- 서버가 생기기 전 앱이 쓰는 옛 길: 지금 동작(파일 · 함수)
- 서버가 생기면 앱에서 바꿀 자리: provider 이름(파일 · 함수)
```

**«서버(AWS) 이관» 칸**: 규칙을 바꾼 PR 은 이 칸을 채웁니다(4.1 참고). 규칙을 안 바꿨으면 지워도 됩니다.

**«서버 작업 필요» 칸**: 서버에 손댈 수 없는데(이 계정 밖 · 다른 PC) 서버가 있어야 끝나는 일이면 이 칸을 채웁니다(4.2 참고). 없으면 지워도 됩니다.

### 3.2 리뷰
- 리뷰어가 있으면 1명 승인 뒤 합칩니다. 혼자 작업할 때도 PR을 열어 diff를 한 번 보고 합칩니다.
- 보안(`security`)과 규칙(`rules`) 변경은 **반드시 PR로** 합칩니다. 기록이 남아야 합니다.

---

## 4. Firebase 규칙 · Functions 배포

규칙과 Functions는 **앱 업데이트 없이 즉시 모든 사용자에게 적용**됩니다. 그래서 앱 코드보다 엄격하게 다룹니다.

1. `rules` 또는 `security/rules-*` 브랜치에서 수정합니다.
2. 수정한 경로를 **앱에서 누가 쓰는지 전부 확인**합니다(`grep`으로 `firebase-init.js`, `app.js`, `purikura-net.js`, `firebase/functions/`).
   - 상위 경로의 `.write`가 하위 노드 삭제를 대신 받아 주는 경우가 있습니다. 예: `rooms/$room` → `_photo`.
   - 구독(`onValue`)이 권한 거부를 받으면 **재시도 없이 끊깁니다.** 읽기 권한을 좁힐 때는 앱이 로그인 복원 뒤에 구독하는지 확인합니다.
3. `npm run check`로 확인합니다. 규칙 기대값을 고정한 검사가 있으면 함께 고치고 `CHECKS.md` 해시를 갱신합니다.
4. (권장) 에뮬레이터나 콘솔 「규칙 플레이그라운드」로 허용·거부를 확인합니다.
5. PR로 합친 **뒤에** `main`에서 배포합니다.
   ```bash
   firebase deploy --only database     # 규칙
   firebase deploy --only functions    # 함수
   ```
6. 배포 전에 콘솔 규칙 탭의 현재 버전을 확인합니다. 저장소와 다르면 누군가 콘솔에서 직접 고친 것이니, 먼저 저장소에 반영합니다.
7. **콘솔에서 규칙을 직접 고치지 않습니다.** 급해서 고쳤다면 같은 날 저장소에 커밋합니다.

### 4.1 서버(AWS) 이관 안내
Firebase 에서 하던 일을 자체 서버(AWS — 방 서버 · 이후 API 서버, 비공개 저장소 `t-w-server`)로 옮기는 중입니다.
서버는 **앱이 보내는 칸을 허용 목록으로 검사**해서, 모르는 칸은 받지 않습니다. 그래서 Firebase 규칙이 바뀌는 기능은 서버에도 같은 작업이 필요합니다.

- **기능을 만들거나 고치다가 규칙이 바뀌면**, PR 본문의 «서버(AWS) 이관» 칸에 바뀐 경로 · 칸 · 권한 · 앱에서 쓰는 곳을 적습니다.
  서버 저장소는 비공개라 협업자는 고치지 않아도 됩니다 — **관리자가 이 안내를 보고 서버에 옮깁니다.**
- 특히 **방에 오가는 칸**(`rooms/*` 의 멤버 payload · `_meta` · 채팅)은 방 서버 규약(`PROTOCOL.md`)과 앱의 서버 허용 목록(`apps/desktop/app/parts/room-server-net.js` 의 `MEMBER_FIELDS` 등)에도 있어야 서버 방에서 동작합니다.
  없으면 서버 방에서는 그 칸만 빠집니다(깨지지는 않음).
- 관리자: 서버 PR(규약 · 허용 목록) → **서버 먼저 배포** → 앱 릴리스 순서로 반영합니다.

### 4.2 서버 작업 필요
서버(`t-w-server` — API 서버 · 웹소켓 서버)는 **이 저장소 주인 PC 에서만** 고칩니다. 주인 계정 · 주인 PC 의 작업은 서버까지 같이 고칩니다.
**이 계정 밖에서 작업하는 경우**(다른 사람 · 다른 PC — 서버에 손댈 수 없을 때) 서버가 있어야 끝나는 일이 생기면, **서버를 고치지 않고 PR 본문의 «서버 작업 필요» 칸에 적습니다.**

- **적을 것**: 필요한 것(API 엔드포인트 · 웹소켓 메시지 · 서버 설정) · 입력 · 출력 모양 · 권한 · 서버가 생기기 전 앱이 쓰는 옛 길 · 서버가 생기면 앱에서 바꿀 자리(provider 이름).
- **권한**은 누가 무엇을 볼 수 있는지까지 적습니다 — 남의 정보가 보이면 안 됩니다.
- **앱은 서버가 생길 때까지 옛 길(지금 동작)로 돕니다.** 나중에 갈아 끼울 자리만 provider 모양으로 둡니다(예: 옛 길 provider 하나로 시작 → 서버가 생기면 서버 provider 로 바꿈).
- **Firebase 의존을 새로 늘려서 때우지 않습니다.** 옛 길은 지금 있는 동작만 씁니다.
- 주인: 이 칸을 보고 서버 PR → **서버 먼저 배포** → 앱에서 provider 를 바꾸는 PR 순서로 반영합니다.

---

## 5. 버전 · 릴리스

- **SemVer** `MAJOR.MINOR.PATCH`를 씁니다.
  - `PATCH`: 버그 수정
  - `MINOR`: 기능 추가
  - `MAJOR`: 데이터 구조나 규칙이 바뀌어 **옛 앱이 동작하지 않게 될 때**
- 순서는 **⓪ 판 브랜치 → main 합치기(merge commit) → ① 규칙 → ② 최신화 → ③ 빌드**입니다 (버전 올림은 `main`에 직접 커밋합니다).

  **① 규칙**: 규칙이나 Functions 변경이 있을 때만 합니다.
  1. 규칙 파일 변경을 먼저 커밋·push합니다. 배포는 **커밋된 파일 기준**으로 합니다.
  2. dev에 먼저 배포합니다: `firebase deploy --only database --project together-working-dev`
  3. 운영에 배포합니다: `firebase deploy --only database` (Functions면 `--only functions`)
  - 이 시점에는 사용자 대부분이 아직 **옛 앱**을 씁니다. 새 규칙이 옛 앱의 쓰기를 막지 않는지 확인합니다(4장).

  **② 최신화**
  1. `git pull --rebase` → `npm run check` (빨강 0)
  2. `npm run version:bump -- patch`: 앱 버전(`apps/desktop/package.json`) 수정, 커밋, 태그 `vX.Y.Z`를 한 번에 합니다(`scripts/bump-version.js`).
  3. `git push --follow-tags`
     **버전은 반드시 커밋하고 push한 뒤에** 빌드로 갑니다. 로컬에서만 올리면 맥 dmg가 옛 버전 번호로 빌드됩니다.

  **③ 빌드 · 공개**: 태그가 올라가면 `release.yml` 이 빌드 · 검사 · 공개까지 합니다 → [RELEASE.md](RELEASE.md)
  4. 방 통신 형식이 바뀐 버전이면, 사용자 대부분이 업데이트한 뒤 RTDB `config/minRoomVer`를 새 버전 문자열로 바꿉니다 (콘솔에서 수동).
- 릴리스 본문에는 사용자용 변경 사항과, 규칙·Functions를 함께 배포했는지 적습니다.

---

## 6. 커밋하지 않는 것

| 대상 | 이유 | 처리 |
|---|---|---|
| `oauth-config.js` | OAuth 클라이언트 시크릿 | `.gitignore` (CI는 Secrets로 생성) |
| `.idea/`, `*.iml` | 개인 IDE 설정 | `.gitignore` |
| `node_modules/`, `dist/`, `out/`, `*.log` | 빌드 산출물 | `.gitignore` |
| `.env*`, `*.pem`, `*service-account*.json` | 비밀값 | `.gitignore` |
| `디자인/` (3D 원본 에셋) | 용량 | `.gitignore` |

> `apps/desktop/app/parts/firebase-config.js`는 `.gitignore`에 있지만 **이미 추적 중**이고, 빌드에 필요해 일부러 넣은 것입니다(커밋 `929f836`). 공개용 웹 설정이라 그대로 둡니다. 혼동을 줄이려면 `.gitignore`에서 그 줄을 지우는 게 맞습니다.
