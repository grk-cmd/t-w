# Git 커밋 · 브랜치 규칙

> 지금까지 히스토리에서 써 온 관례(한국어 메시지, Conventional Commits, CHECKS 개정 번호)를 그대로 이어 갑니다.
> 그 위에 브랜치, PR, 배포 규칙을 더했습니다.
> 작성 2026-10-03 · 관례의 근거는 [PROJECT_ANALYSIS.md §6](PROJECT_ANALYSIS.md#6-커밋-규칙--코드-컨벤션)에 있습니다.

---

## 1. 커밋 메시지

### 1.1 형식
```
<타입>(<스코프>): <무엇을> — <부연>  (CHECKS 개정 N)

- 파일명: 바꾼 내용
- 파일명: 바꾼 내용

Refs: <이슈·핸드오프 문서>        ← 선택
```
- **언어**: 제목과 본문 모두 한국어로 씁니다. 코드 식별자와 파일명은 원문 그대로 둡니다.
- **제목**: 72자 이내로 쓰고 마침표는 붙이지 않습니다. 여러 항목은 ` · `로 나열합니다.
- **CHECKS 개정**: `checks/CHECKS.md`를 바꿨으면 제목 끝에 `(CHECKS 개정 N)`을 붙입니다.
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
| `main` | `main.js`, `preload.js` (메인 프로세스, IPC) |
| `app` | `app/parts/app.js`, HTML (렌더러) |
| `firebase` | `firebase-init.js` (SDK 다리) |
| `rules` | `firebase-database-rules.json` |
| `functions` | `functions/` |
| `hosting` | `hosting/` |
| `win` / `mac` | 플랫폼 모듈 (`*-win.js`, `*-mac.js`) |
| `checks` | `checks/` 러너, 도구 |
| `probe` | `.github/workflows/mac-probe.yml` |
| 기능 이름 | `myhome`, `mallang`, `purikura`, `noise`, `bookmark`, `gacha`, `focus`, `room`, `chat`, `friend`, `license` … |

### 1.4 커밋 단위
- **한 커밋에는 한 가지 의도만 담습니다.** 「세션 묶음」 커밋은 더 만들지 않습니다.
- **규칙(`rules`)은 따로 커밋합니다.** 서버 배포 단위가 앱과 다르기 때문입니다(4장).
- 검사 파일을 바꾸면 `CHECKS.md`의 해시(§3 표)를 **같은 커밋**에서 갱신합니다. 다른 커밋으로 나누면 그 사이 커밋에서 `npm run check`가 「판이 다르다」로 빨개집니다.
- 커밋하기 전에 `npm run check`를 돌려 **빨강 0, 정본 일치**를 확인합니다.

### 1.5 예시
```
security(rules): 관리자 기능 때문에 열어 둔 쓰기 5곳 잠금

- firebase-database-rules.json: friendCodes 목록 읽기 → 관리자만
- firebase-database-rules.json: users/invite · inbox 쓰기 → 주인 또는 관리자
- firebase-database-rules.json: rooms/$room 통째 삭제 → 관리자만, _photo 청소는 분리
- firebase-database-rules.json: stats/userCount → +1 만 (임의 값은 관리자)
- firebase-database-rules.json: licenseRequests → 새 신청만 (승인·거절은 관리자)
- checks: sim-admin-rules · sim-google-login · sim-purikura-rules 기대값 갱신, CHECKS.md 해시
```

---

## 2. 브랜치

### 2.1 구조
```
main ──●────●────────●──────●── (항상 배포 가능 · 태그 vX.Y.Z)
        \          /  \    /
         feat/…  ─●     fix/… ─●
```
- **`main`**: 항상 빌드와 검사가 통과하는 상태를 유지합니다. push할 때마다 CI(`checks`)가 검사를 돌립니다.
- **버전 올림 커밋은 `main`에 직접** 올립니다(5장). 기능 수정을 PR로 할지 `main` 직접으로 할지는 아직 정하지 않았습니다.
- 작업은 모두 `main`에서 브랜치를 따서 하고, 끝나면 PR로 `main`에 합칩니다.
- `develop` 같은 장기 브랜치는 두지 않습니다(1~2인 규모에 맞춤).

### 2.2 이름
```
<타입>/<짧은-설명>          예) feat/bookmark-shelf
<타입>/<스코프>-<설명>       예) fix/mac-window-title, security/rules-owner-write
```
- 타입은 커밋 타입(1.2)과 같은 목록을 씁니다.
- 영어 소문자와 `-`만 씁니다(한글, 공백, `_`는 쓰지 않음).
- 긴급 운영 수정은 `hotfix/<설명>`으로 만들고, 합친 뒤 바로 패치 버전을 릴리스합니다.

### 2.3 합치기
- **Squash merge**를 기본으로 합니다. PR 제목이 그대로 `main`의 커밋 제목이 되므로 1장 형식을 지킵니다.
- 합친 브랜치는 지웁니다.
- 충돌은 `main`을 rebase해서 해결합니다(`git pull --rebase origin main`).

---

## 3. PR

### 3.1 본문 템플릿
```markdown
## 무엇을
## 왜
## 확인한 것
- [ ] `npm run check` — 빨강 0 · 정본 일치
- [ ] 실기기 확인 (Windows / mac) — 해당 시
- [ ] 규칙 변경이면 4장 절차대로 했는가
## 배포 영향
- 앱 릴리스 필요: 예 / 아니오
- 규칙·Functions 배포 필요: 예 / 아니오 (예면 순서 적기)
```

### 3.2 리뷰
- 리뷰어가 있으면 1명 승인 뒤 합칩니다. 혼자 작업할 때도 PR을 열어 diff를 한 번 보고 합칩니다.
- 보안(`security`)과 규칙(`rules`) 변경은 **반드시 PR로** 합칩니다. 기록이 남아야 합니다.

---

## 4. Firebase 규칙 · Functions 배포

규칙과 Functions는 **앱 업데이트 없이 즉시 모든 사용자에게 적용**됩니다. 그래서 앱 코드보다 엄격하게 다룹니다.

1. `rules` 또는 `security/rules-*` 브랜치에서 수정합니다.
2. 수정한 경로를 **앱에서 누가 쓰는지 전부 확인**합니다(`grep`으로 `firebase-init.js`, `app.js`, `purikura-net.js`, `functions/`).
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

---

## 5. 버전 · 릴리스

- **SemVer** `MAJOR.MINOR.PATCH`를 씁니다.
  - `PATCH`: 버그 수정
  - `MINOR`: 기능 추가
  - `MAJOR`: 데이터 구조나 규칙이 바뀌어 **옛 앱이 동작하지 않게 될 때**
- 순서는 **① 규칙 → ② 최신화 → ③ 빌드**입니다 (버전 올림은 `main`에 직접 커밋합니다).

  **① 규칙**: 규칙이나 Functions 변경이 있을 때만 합니다.
  1. 규칙 파일 변경을 먼저 커밋·push합니다. 배포는 **커밋된 파일 기준**으로 합니다.
  2. dev에 먼저 배포합니다: `firebase deploy --only database --project together-working-dev`
  3. 운영에 배포합니다: `firebase deploy --only database` (Functions면 `--only functions`)
  - 이 시점에는 사용자 대부분이 아직 **옛 앱**을 씁니다. 새 규칙이 옛 앱의 쓰기를 막지 않는지 확인합니다(4장).

  **② 최신화**
  1. `git pull --rebase` → `npm run check` (빨강 0)
  2. `npm version patch -m "chore: %s"`: `package.json` 버전 수정, 커밋, 태그 `vX.Y.Z`를 한 번에 합니다.
  3. `git push --follow-tags`
     **버전은 반드시 커밋하고 push한 뒤에** 빌드로 갑니다. 로컬에서만 올리면 맥 dmg가 옛 버전 번호로 빌드됩니다.

  **③ 빌드**
  1. GitHub Actions → `mac-probe` → Run workflow (`main`) → 아티팩트에서 dmg 2개(arm64·x64)를 받습니다.
  2. `npm run release`: exe와 `latest.yml`이 GitHub Releases **초안**으로 올라갑니다.
  3. 초안에 dmg 2개를 올리고 **Publish release**를 누릅니다. 이때부터 사용자에게 배포됩니다.
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

> `app/parts/firebase-config.js`는 `.gitignore`에 있지만 **이미 추적 중**이고, 빌드에 필요해 일부러 넣은 것입니다(커밋 `929f836`). 공개용 웹 설정이라 그대로 둡니다. 혼동을 줄이려면 `.gitignore`에서 그 줄을 지우는 게 맞습니다.
