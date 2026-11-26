# boot-measure — 켤 때 캐릭터 · 파츠가 뜨는 시간 재기

dev 앱을 e2e-local 로 켜서 «계정 확인 → 런처에 캐릭터가 뜸 → 입은 파츠가 다 붙음» 까지의 시간과 그 전에 나간 요청 수를 잰다. 바꾸기 전 · 뒤를 같은 조건으로 견주는 도구다. 앱 설치본에는 들어가지 않고 CI 에서도 돌지 않는다.

| 파일 | 하는 일 |
|---|---|
| `seed.js` | 로컬 묶음에 카탈로그 파츠 100개(GLB 약 8MB)를 관리자 계정으로 올리고, 앱으로 가입한 계정 하나를 `<결과 폴더>/seed/appdata` 에 남긴다 |
| `create.js` | 그 계정에 캐릭터 3칸을 만들고 칸마다 파츠 셋을 입힌다 |
| `instrument.py` | 측정 worktree 에 측정 줄을 넣는다 — `window.__twMarks` 에 `begin`(app-boot 시작) · `face`(런처 캐릭터) · `parts:n/m`(입은 파츠) |
| `shape.py` | 측정 worktree 의 e2e-local 주소 돌리기에 왕복 지연 · 공유 대역폭 흉내를 넣는다(로컬은 지연이 0 이라 순서 차이가 안 보인다) |
| `prep.sh` | 측정 worktree 를 잴 커밋으로 맞추고 위 둘을 넣는다 |
| `measure.js` | 한 번 켜서 잰다 — `prep-cold`(GLB 영구 캐시 · HTTP 캐시 비우기) · `prep-update`(영구 캐시 열쇠를 0.13 서버 endpoint 주소로 바꿔 0.13.1 → 0.14 업데이트 흉내) |
| `run.sh` | cold(처음 켬) · warm(다시 켬) · update(업데이트 뒤 켬)를 n 번 |
| `summ.py` | 경우마다 가운데 값 |
| `open.js` | 켠 뒤 마이홈 · 플레이리스트 · 꾸미기 창을 열어 그때 나간 요청과 화면을 남긴다(창을 열 때 받는 기능 확인) |

## 쓰는 법

1. 로컬 묶음과 e2e-local 의존성을 준비한다(`../e2e-local/README.md` «준비»). Storage 에뮬레이터 규칙은 로그인한 사람에게 열어 둔다(얼굴 · 파츠 올리기).
2. 측정 worktree 를 따로 만든다 — `prep.sh` 가 `git checkout -f` 로 덮는다. 덮기 전에 그 폴더가 worktree 맨 위인지 · 이 도구가 든 worktree 가 아닌지 · HEAD 가 떨어져 있는지(`--detach` 로 만든 것) 보고, 하나라도 아니면 멈춘다.
   ```bash
   git worktree add --detach ../.wt/boot-measure origin/release/0.14.0   # node_modules 는 작업 worktree 것을 링크해도 된다
   ```
3. 시드 — 한 번. 먼저 측정 worktree 를 맞춘다(`prep.sh` 가 켤 때 확인을 `/actuator/health/liveness` 로 바꾼다 — 로컬 API 의 `/actuator/health` 는 DOWN 일 수 있다).
   ```bash
   K=apps/desktop/tools/boot-measure; E=<측정 worktree>/apps/desktop/tools/e2e-local
   export TW_E2E_PG=<DB 컨테이너>          # 없으면 e2e-local 기본(tw-dev-local-postgres-1)
   $K/prep.sh <측정 worktree> origin/release/0.14.0
   node $K/seed.js $E ${TW_BOOTM_OUT:-/tmp/tw-bootm-e2e}/seed
   node $K/create.js $E ${TW_BOOTM_OUT:-/tmp/tw-bootm-e2e}/seed
   node $K/measure.js $E ${TW_BOOTM_OUT:-/tmp/tw-bootm-e2e}/seed prep-cold   # 처음 켬 상태로 비워 둔다
   ```
4. 잰다 — 커밋마다.
   ```bash
   $K/prep.sh <측정 worktree> <커밋>
   $K/run.sh <측정 worktree> <이름> 3        # SHOT=1 이면 cold 화면도 남긴다
   python3 $K/summ.py <이름>
   ```

환경 값: `TW_BOOTM_OUT`(결과 폴더 · 기본 `/tmp/tw-bootm-e2e`) · `TW_BOOTM_RTT`(왕복 ms · 기본 40) · `TW_BOOTM_BW`(바이트/ms · 기본 2500 = 2.5MB/s) · `TW_E2E_PG`(DB 컨테이너 · 없으면 e2e-local 기본) · `SETTLE_MS`(파츠가 붙은 뒤 더 기다릴 ms · 기본 15000) · `SHOT`(cold 화면) · `SHOT_AT_MS`(begin 뒤 그 ms 에 화면 한 장과 토스트 글 — «접속 중…» 확인).

## 함정

- CI 러너가 같은 맥에서 빌드 중이면(`pgrep -f gradle` · `docker ps`) 숫자가 흔들리고 빌드도 늦어진다 — 그때는 돌리지 않는다.
- 측정 줄 · 망 흉내는 측정 worktree 에만 넣는다. 작업 브랜치에 커밋하지 않는다.
- 결과 폴더(`TW_BOOTM_OUT`)는 저장소 밖에 둔다(앱 데이터가 통째로 쌓인다). `seed.js` 는 `<결과 폴더>/seed` 를 지우고 다시 만든다 — e2e-local 결과 폴더 규칙(`outRootProblem` — 이름에 e2e · 홈 · /tmp 자체 아님 · 저장소 밖)을 지키고 마지막 폴더가 `seed` 가 아니면 멈춘다.
- `seed.js` 는 로컬 묶음 카탈로그에 파츠 `bench000`~`bench099` 를 남긴다(같은 묶음을 쓰는 다른 시험 · 꾸미기 목록에 보인다). 다 쟀으면 관리자 토큰으로 단종한다: `POST /v2/admin/catalog/listings/bulk` `{ action: 'ARCHIVE', items: [{ kind: 'part', id: 'bench000', version: <지금 판> } …] }` — 측정만을 위한 묶음(compose 프로젝트를 따로)이면 `down -v` 로 통째로 지워도 된다.
- node_modules 가 둘 필요하다 — 저장소 맨 위 `npm install`(앱 · electron)과 `apps/desktop/tools/e2e-local` 의 `npm install`(playwright-core). 측정 worktree 는 작업 worktree 의 것을 링크해도 된다.
