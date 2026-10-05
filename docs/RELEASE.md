# 릴리스 방법: 버전 올리기부터 배포까지

> 릴리스 순서는 **① 규칙 → ② 최신화 → ③ 빌드**입니다. 이 문서는 ②와 ③을 다룹니다.
> ①(Firebase 규칙)은 자동입니다. 규칙 파일을 바꿔 `main`에 push하면 **dev에 자동 반영**되고(`deploy-dev.yml`), 버전 태그를 push하면 규칙이 바뀐 경우에만 **승인을 거쳐 운영에 반영**된 뒤 빌드됩니다(`release.yml`). GCP 설정 전이라 건너뛰면 경고가 뜨니, 그때는 직접 배포합니다 → [GIT_CONVENTION.md 4장](GIT_CONVENTION.md#4-firebase-규칙--functions-배포)

---

## 한눈에 보기

**버튼으로 (추천)**: GitHub → **Actions** → 왼쪽 **release-start** → **Run workflow** → 버전 종류(`patch` · `minor` · `beta`) 고르기 → **Run workflow**.
검사 · 버전 올리기 · 태그 · 빌드까지 자동으로 하고, 10~15분 뒤 Releases 초안이 생깁니다(아래 5번부터 같음).

**명령으로**:

```bash
git pull --rebase                  # 1. 최신 받기
npm run check                      # 2. 검사 (마지막 줄 «빨강 0» 확인)
npm version patch -m "chore: %s"   # 3. 버전 올리기 (숫자 수정 + 커밋 + 태그)
git push --follow-tags             # 4. 올리기 → 자동 빌드 시작
```
5. 10~15분 뒤 GitHub **Releases**에 초안이 생깁니다 → 확인 → **Publish release**

**사람이 정하는 건 3번의 `patch` 자리 하나뿐입니다.** 나머지는 자동입니다.

---

## 1. 어떤 버전으로 올릴지 고르기

버전은 `MAJOR.MINOR.PATCH` 형식입니다(예: `0.10.1`). **지금 `package.json`의 버전**에서 고른 자리만 +1 됩니다.

지금 버전이 `0.10.1`일 때:

| 명령 | 결과 | 언제 고르나 |
|---|---|---|
| `npm version patch -m "chore: %s"` | **0.10.2** | 버그 수정, 작은 개선, 비용 최적화 |
| `npm version minor -m "chore: %s"` | **0.11.0** | 새 기능 추가 |
| `npm version major -m "chore: %s"` | **1.0.0** | 큰 변경, 옛 버전과 데이터·규칙 호환이 깨질 때 |
| `npm version 0.12.0 -m "chore: %s"` | **0.12.0** | 원하는 번호를 직접 지정 |

- 애매하면 **`patch`**를 고르면 됩니다.
- `-m "chore: %s"`는 커밋 메시지 형식입니다. `%s`가 버전 번호로 바뀌어 `chore: 0.10.2`가 됩니다.

---

## 2. `npm version`이 하는 일

명령 한 줄이 아래를 **한 번에** 합니다.

1. `package.json`과 `package-lock.json`의 `version`을 새 번호로 고칩니다.
2. 그 두 파일로 **커밋**을 만듭니다: `chore: 0.10.2`
3. 그 커밋에 **태그**를 붙입니다: `v0.10.2`

결과 확인:
```bash
git log --oneline --decorate -1
# 예) a1b2c3d (HEAD -> main, tag: v0.10.2) chore: 0.10.2
```

**실행 전 조건**
- **커밋 안 된 변경이 있으면 거부됩니다**(`Git working directory not clean`). 먼저 커밋하거나 정리하세요.
- `main` 브랜치에서 실행합니다.

**push하지 않으면 아무 일도 일어나지 않습니다.** 커밋과 태그는 아직 내 PC에만 있습니다.

---

## 3. 올리기: `git push --follow-tags`

- 커밋과 **그 커밋에 붙은 태그**를 함께 GitHub에 올립니다.
- 그냥 `git push`는 **태그를 올리지 않습니다.** 그러면 빌드가 시작되지 않습니다.
- GitHub에 `v0.10.2` 태그가 도착하면 `.github/workflows/release.yml`이 **자동으로** 실행됩니다. yml을 고치거나 버튼을 누를 필요가 없습니다(`v*` 패턴의 태그면 무엇이든 실행됨).

---

## 4. 자동 빌드 (`release.yml`)

GitHub → **Actions** → **release**에서 진행 상황을 볼 수 있습니다.

| 단계 | 내용 | 실패하면 |
|---|---|---|
| 버전 확인 | 태그와 `package.json` 버전이 같은가 | `npm version`을 안 쓰고 태그만 달았을 때 |
| | 마지막 공개 릴리스보다 **높은가** (같아도 막음) | 이미 나간 번호를 또 쓰려 할 때 |
| Windows 빌드 | exe, `.blockmap`, `latest.yml` | |
| Mac 빌드 | dmg × 2 (arm64, x64) | |
| Releases 초안 | 모든 파일을 **한 초안**에 업로드. `latest.yml`과 파일 이름 대조 | 이미 **공개된** 릴리스는 덮어쓰지 않음 |

---

## 5. 공개: Publish

1. GitHub → **Releases** → `0.10.2` 초안을 엽니다.
2. 파일 5개가 모두 **같은 버전**인지 확인합니다.
   - `Together-Working-Setup-0.10.2.exe`, `….exe.blockmap`, `latest.yml`
   - `…-0.10.2-arm64.dmg`, `…-0.10.2-x64.dmg`
3. 설명란에 사용자용 변경 사항을 적습니다. 비워 두면 커밋 메시지가 대신 보입니다.
4. **Publish release**를 누릅니다. **이때부터 사용자에게 배포됩니다.**
   - Windows: 앱이 자동으로 내려받고 「업데이트 설치」 버튼이 뜹니다.
   - Mac: 앱이 새 버전 안내를 띄웁니다. 사용자가 dmg를 직접 받습니다.

**공개 후 (해당할 때만)**: 방 통신 형식이 바뀐 버전이면, 사용자 대부분이 업데이트한 뒤 `config/minRoomVer`를 새 버전으로 바꿉니다. GitHub → Actions → **min-room-ver** → Run workflow → 버전(예: `0.10.2`) 입력 → 승인.

---

## 5-1. 테스트 빌드 (dev 서버에 붙는 앱)

정식 배포 전에 내부에서 먼저 써 볼 때 씁니다. 버전에 `-beta.N` 꼬리를 붙이면 됩니다.

```bash
npm version prerelease --preid=beta -m "chore: %s"   # 0.10.1 → 0.10.2-beta.0 (다시 하면 -beta.1, -beta.2 …)
git push --follow-tags
```

| | 테스트 빌드 (`v0.10.2-beta.0`) | 정식 빌드 (`v0.10.2`) |
|---|---|---|
| 앱이 접속하는 Firebase | **dev (`together-working-dev`)** | 운영 (`together-working`) |
| 운영 규칙 배포 | 하지 않음 | 규칙이 바뀌었으면 승인 후 배포 |
| Releases 표시 | **Pre-release** | Latest |
| 일반 사용자 자동 업데이트 | **받지 않음** | 받음 |
| 설치 | 내부 사람이 Releases 페이지에서 직접 받음 | 자동 |

- 빌드할 때 `package.json`에 `twFirebase: dev` 표시가 들어가고, 앱이 그걸 보고 dev 설정을 고릅니다. 운영·dev 설정은 둘 다 `app/parts/firebase-config.js`에 있습니다.
- **내 PC에서 dev로 실행**: `npm run start:dev` (설치본에는 영향 없음)
- 테스트가 끝나면 `npm version patch`로 정식 버전을 냅니다(`0.10.2-beta.N` → `0.10.2`).
- dev 서버에서 **안 되는 기능**: 비밀번호 변경(Cloud Functions 없음), 폰 연결 QR(운영 호스팅 주소 고정). 구글 로그인은 dev 콘솔에서 허용 설정을 해야 됩니다.
- dev DB는 운영과 **데이터가 분리**돼 있습니다. 계정도 따로 가입해야 하고, 카탈로그(파츠·책상·아이템)는 운영에서 복사해 둬야 보입니다.

---

## 6. 문제가 생겼을 때

| 상황 | 해결 |
|---|---|
| `npm version`이 `Git working directory not clean`으로 거부 | `git status`로 확인 → 커밋하거나 정리한 뒤 다시 실행 |
| push가 `rejected` | 원격에 새 커밋이 있음 → `git pull --rebase` → `git push --follow-tags` |
| 빌드가 중간에 실패 | 원인을 고친 뒤 Actions → release → **Run workflow** → 태그(예: `v0.10.2`) 입력해서 다시 빌드 |
| 태그를 잘못 만들었다 (push 전) | `git tag -d v0.10.2` 후 `git reset --hard HEAD~1`로 버전 커밋 취소 |
| 태그를 잘못 만들었다 (push 후, 공개 전) | Actions 실행 취소 → `git push origin :refs/tags/v0.10.2` → Releases 초안 삭제 → 버전 커밋은 되돌리는 커밋으로 정리 |
| 이미 공개한 버전에 문제가 있다 | **같은 번호를 다시 쓰지 않습니다.** 고친 뒤 다음 번호(`patch`)로 새로 릴리스 |

---

## 7. 하지 않는 것

- **`package.json`의 `version`을 손으로 고치지 않습니다.** 항상 `npm version`을 씁니다.
- **개발자 PC에서 `npm run release`를 쓰지 않습니다.** 같은 버전 초안에 파일이 섞이고 버전이 어긋날 수 있습니다. 빌드는 `release.yml`이 합니다.
- 공개된 릴리스의 파일을 바꾸거나 태그를 옮기지 않습니다.
