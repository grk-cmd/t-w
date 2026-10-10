---
name: todo
description: 관리자 할 일(adminTodos)을 확인 · 등록 · 완료한다 — 같이 일하는 사람끼리 같은 일을 겹쳐 하지 않게. 코드 작업(기능 · 버그 수정)을 시작하기 전, PR 을 만들 때, PR 이 머지된 뒤에 쓴다. "할 일 확인", "할 일 등록", "누가 하고 있나", "/todo" 에도.
---

# 할 일 확인 · 등록 · 완료

웹 관리자 📋 할 일 화면과 같은 데이터(`adminTodos`)를 `node scripts/todo.js` 로 다룬다.
관리자 Google 계정으로 `gcloud auth login` 한 사람만 쓸 수 있다. 처음 한 번은 `node scripts/todo.js setup` 으로 내 관리자 계정을 고른다(아래 «처음 한 번»).

## 언제
- **코드 작업을 시작하기 전** — 기능이든 버그 수정이든. 문서 오타 · 한 줄 설정처럼 아주 작은 일은 건너뛰어도 된다.
- **PR 을 만들 때** — 본문에 `할 일: <id>` 한 줄.
- **PR 이 머지된 뒤** — 완료 + 실려 나갈 버전.

## 순서

### 1. 겹치는지 확인
```bash
node scripts/todo.js brief                 # 지금 진행 중인 일 전부(누가 · 무엇을)
node scripts/todo.js find <낱말> <낱말>     # 하려는 일의 핵심 낱말 2~3개 — 제목 · 메모에서 찾는다
```
- 낱말은 한국어 · 영어 둘 다 넣어 본다(예: `find 채팅 이모티콘 chat`).
- **비슷한 일이 «진행 중» 이면 멈추고 사용자에게 알린다** — 누가 하고 있는지, id, 그래도 할지 / 그 사람과 나눌지 묻는다. 묻지 않고 시작하지 않는다.
- «완료» 로 나온 것은 이미 끝난 일일 수 있다 — 같은 일인지 사용자에게 말한다.
- «할 일»(아직 아무도 안 잡은 것)이 같은 일이면 새로 만들지 말고 그걸 쓰자고 제안한다(웹 관리자에서 작업자 · 상태를 나로 바꾸면 된다).

### 2. 등록 — 겹치지 않으면
```bash
node scripts/todo.js start "<무엇을 — 한 줄 제목>" --type feat|bug [--memo "<왜 · 범위>"] [--report <제보 id>]
```
- `--type` 은 꼭: 새 기능 · 개선은 `feat`, 버그 수정은 `bug`. 빠지면 오류가 난다 — 사용자에게 묻지 말고 일의 성격으로 고른다.
- 제목은 120자까지, 사용자가 알아볼 쉬운 말로. 버그 제보에서 시작한 일이면 `--report <제보 id>`(20자, 웹 관리자 제보 주소 끝).
- 처음 써 보거나 확실하지 않으면 `--dry-run` 으로 무엇을 쓸지 먼저 보여 준다.
- 나온 `id` 를 기억해 둔다(브랜치 · PR 본문에 쓴다).

### 3. PR 본문
`.github/pull_request_template.md` 의 `할 일:` 줄에 id 를 적는다. 예: `할 일: tmv1tiuezg94bz0`

### 4. 머지된 뒤 — 완료
PR 본문에 `할 일: <id>` 가 있으면 main 에 머지될 때 **자동으로** 완료 + 다음 버전(main 의 package.json 다음 patch) + 메모 «PR #N 머지» 가 된다(`.github/workflows/todo-merge.yml` → 함수 `todoMergeDone`). 이미 적어 둔 버전은 덮지 않는다.
머지 뒤 Actions 의 todo-merge 로그에 «건너뜀» 이 찍혔거나(설정 전) 버전을 바꿔야 할 때만 손으로:
```bash
node scripts/todo.js done <id> --release <다음 버전> [--memo "PR #123"]
```
- 다음 버전: 최신 공개 릴리스(`gh release list --limit 1`)의 다음 patch(0.11.2 → 0.11.3). 사용자가 다른 버전을 말했으면 그것.
- 메모는 덮지 않고 한 줄 덧붙는다. PR 번호를 남기면 나중에 찾기 쉽다.
- 머지 전에 `done` 하지 않는다 — 머지가 안 되면 남이 «끝난 일» 로 보고 다시 안 잡는다.

## 그 밖의 명령
```bash
node scripts/todo.js list                 # 완료 빼고 전부
node scripts/todo.js list --mine          # 내가 작업자인 것
node scripts/todo.js list --doing         # 진행 중만
node scripts/todo.js list --all           # 완료까지
```
줄 앞 배지: 🆕 새 기능(feat) · 🐞 버그(bug) · `·` 종류 없음(웹에서 만든 옛 할 일).
어느 명령이든 `--dev` 를 붙이면 dev DB(together-working-dev).

## 처음 한 번 (새로 같이 일하는 사람)
1. Google Cloud CLI 설치 → `gcloud auth login` (웹 관리자에 들어가는 그 관리자 Google 계정, 프로젝트 권한이 있어야 한다)
2. 웹 관리자 오른쪽 위에서 내 이름을 정해 둔다(이름표 `adminNames`).
3. `node scripts/todo.js setup` → 목록에서 내 이름 확인 → `node scripts/todo.js setup <내 이름 또는 uid>`
   저장 위치는 `.claude/todo-me.json`(본 저장소 · 워크트리 공용 · **커밋되지 않는다**).

## 안 될 때
- «관리자 계정만 쓸 수 있어요» — gcloud 로그인 계정이 프로젝트 권한이 없다. `gcloud auth list` 로 어느 계정인지 보고 `gcloud auth login`.
- «gcloud 가 없어요» — 1번 설치부터.
- «먼저 내 관리자 계정을 정해 주세요» — `setup`.
- «방금 다른 사람이 이 할 일을 바꿨어요» — 그대로 다시 실행하면 최신 값 위에 쓴다.
- 관리자가 아닌 사람은 이 스킬을 건너뛴다(세션 시작 요약도 조용히 안 나온다). 그때는 사용자에게 겹치는 일이 없는지 직접 물어본다.

## 지키는 것
- 이 도구는 gcloud 토큰으로 **보안 규칙을 거치지 않고** 운영 DB 에 쓴다. 할 일(`adminTodos`)과 작업 기록(`adminLog`) 말고는 쓰지 않고, 모양 검사 · rev + 1 · 읽은 값 그대로일 때만 쓰기(ETag)를 스크립트가 한다 — 스크립트를 고칠 때 이 셋을 지키고 `checks/sim-todo-cli.js` 를 돌린다.
- 할 일을 지우거나, 남이 작업자인 할 일을 «완료» 로 바꾸는 것은 사용자에게 먼저 묻는다.
