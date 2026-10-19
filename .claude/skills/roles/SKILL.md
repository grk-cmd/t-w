---
name: roles
description: 역할 세션(서버담당 · 보안담당 · 투두담당 · 질문)을 Orca 탭으로 연다 — 이미 열린 역할은 다시 열지 않고, 들어갈 탭을 한 줄씩 알려 준다. 이 PC(Orca 가 깔린 맥)의 오케스트레이터 세션에서만. «역할 세션 열어 줘», «서버담당 열어», «/roles» 에.
---

# /roles — 역할 세션 열기

역할 세션은 `claude -n <이름>` 으로 연 세션이다. 시작 hook(`.claude/hooks/role-start.py`)이 이름을 보고 `.claude/roles/_공통.md` + `<이름>.md` 를 지침으로 붙이고, main 위에서 열렸으면 열린 판 요약을 주고 «어느 버전에 나갈 작업인가요?» 를 묻게 한다. 이 스킬은 그 세션을 Orca 탭으로 여는 일만 한다.

- 역할 = `.claude/roles/` 의 `.md` 파일 이름(`_공통` 은 빼고). 인자로 이름을 받으면 그것만, 없으면 전부.
- 모르는 이름이면 열지 않고 있는 역할을 알려 준다(역할을 새로 만들려면 그 폴더에 파일을 더하는 하네스 PR).
- 웹(클라우드) 세션에는 Orca 가 없다 — «이 PC 에서만 된다» 고 말하고 끝낸다. 웹 세션에도 시작 hook 은 돌아 판 요약은 붙지만, 웹 세션 이름이 hook 에 들어오는지(역할 지침)는 아직 확인하지 않았다.

## 순서
1. Orca CLI 찾기: `command -v orca` → 없으면 `/Applications/Orca.app/Contents/Resources/bin/orca` → `~/Downloads/Orca.app/Contents/Resources/bin/orca`. 없으면 «Orca 앱 설정 › General › Orca CLI 로 등록» 을 안내하고 끝낸다. `orca status --json` 이 `ok` 가 아니면 «Orca 앱을 켜 주세요».
2. 열린 탭 보기: `orca terminal list --json` → `result.terminals[].title`. Claude 가 뜨면 탭 이름 앞에 상태 글자가 붙는다(`✳ 서버담당` · `◐ 서버담당`) — **앞의 상태 글자 + 공백을 떼고** 역할 이름과 같으면 이미 열린 것이다. 다시 열지 않는다.
3. 없는 역할만 연다 — 저장소 폴더는 이 세션의 저장소 루트(`git rev-parse --show-toplevel`, 본 저장소 · main):
   ```bash
   orca terminal create --worktree path:<저장소 루트> --title <이름> --command "claude -n <이름>" --json
   ```
   새 창이 아니라 탭이 열린다. 돌려받은 `handle` 을 적어 둔다.
4. 뜰 때까지 기다리기(역할마다): `orca terminal wait --terminal <handle> --for tui-idle --timeout-ms 60000 --json`. 시간이 넘으면 «아직 뜨는 중» 으로 알리고 넘어간다(닫지 않는다).
5. 사용자에게 한 줄씩: `서버담당 — 새로 열림` · `질문 — 이미 열려 있음` 처럼. 그 탭에 들어가 할 일을 말하면 된다고 덧붙인다(세션이 먼저 판을 묻는다).

## 하지 않는 것
- 열린 역할 탭을 닫거나 다시 열지 않는다(사용자가 시킬 때만 `orca terminal close --terminal <handle> --tab`).
- 역할 세션에 일을 대신 보내지 않는다(`terminal send`) — 시킬 때만.
- Orca 버튼(`worktree create`)으로 worktree 를 만들지 않는다 — 가드를 거치지 않는다. 브랜치는 역할 세션 안에서 git 으로 딴다.
- `--agent` 로 열지 않는다 — 에이전트 지침이 Claude Code 기본 지침을 통째로 대신한다.
