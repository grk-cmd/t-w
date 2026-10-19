---
name: ship
description: 작업 끝내기 — PR 을 올리고 컨펌자(tw-confirmer) · 검증자(tw-verifier)를 깨끗한 맥락으로 돌려, 둘 다 통과하고 CI 가 초록이면 판 브랜치에 머지한다(위험도 높은 PR 은 승인자 mihioon 의 Approve 뒤에). 걸리면 스스로 고쳐 다시 돈다. 터미널 · 클라우드(웹) 세션 모두에서. 작업(커밋)을 마쳤을 때 · «올려 줘» · «머지해 줘» 에 쓴다.
---

# /ship — PR · 컨펌 · 검증 · 머지

머지 담당 세션이 따로 없다. 이 흐름이 그 일을 한다 — 컨펌자 · 검증자 판정을 머리 커밋의 상태값(`tw/confirm` · `tw/verify`)으로 남기고,
가드(`.claude/hooks/ship-gate.py`)는 그 둘이 success 가 아니면 머지를 막는다.
**위험도**(`python3 .claude/hooks/risk.py <PR>` — diff 로 기계 판정: 데이터 경로 · 규칙 · 서버 · 빌드 · 새 모듈)가 높으면 승인자 **mihioon** 이 머리 커밋을 GitHub 에서 Approve 해야 머지된다(가드가 확인). 낮으면 승인 없이 머지.
**사용자가 `/ship` 을 다시 치게 하지 않는다** — 사용자 몫은 승인 명령 한 줄뿐이고, 승인 · CI 는 세션이 뒤에서 기다렸다가(`risk.py --wait`) 머지까지 이어 간다. 승인 · 판정 뒤 판 브랜치를 합치기만 한 머리는 앞 커밋의 승인 · 판정을 이어 받는다(가드가 «PR 자체 변경이 같은가» 를 본다 — 다시 묻지 않는다).

**클라우드 세션에서는 `gh pr …` 이 막혀 있다(GraphQL). 모든 GitHub 일은 `gh api`(REST)로 한다.** 아래 `R=repos/grk-cmd/t-w`.

## 0. 확인
- 판: 이 작업이 어느 버전에 나가는지 정해져 있어야 한다(브랜치를 딸 때 사용자에게 물었다). base = `release/X.Y.Z`. 모르면 **묻고 멈춘다**. 긴급 수정 `hotfix/*` · 하네스 `harness/*` 만 base = `main`.
- 동작이 바뀌는 작업(화면 · 문구 · 타이밍 · 요청 수)이면 사용자 확인을 받았는가 — 받은 말을 PR 본문 «왜» 에 적는다. 안 받았으면 묻고 멈춘다.
- 커밋 안 된 변경이 없다. 바뀐 곳의 `sim-*` 를 돌려 통과(전체 `npm run check` 는 CI).

## 1. PR
- `git push -u origin <브랜치>`(force 금지).
- 열린 PR 찾기: `gh api "$R/pulls?head=grk-cmd:<브랜치>&state=open" --jq '.[0].number'`.
- 없으면 만든다: `gh api $R/pulls -f title='<커밋 제목 형식>' -f head='<브랜치>' -f base='<base>' -f body="$(cat 본문파일)"` — 본문은 `.github/pull_request_template.md` 틀 그대로.

## 2. 컨펌 · 검증 (깨끗한 맥락 두 에이전트를 **한 번에 함께** 부른다)
- 머리 커밋 `SHA=$(git rev-parse HEAD)`.
- `Agent(subagent_type: "tw-confirmer")` · `Agent(subagent_type: "tw-verifier")` — 둘 다 같은 입력: PR 번호 · base · SHA · 의도(무엇을 · 왜) · 사용자 확인 기록. 구현하며 겪은 일은 넘기지 않는다(깨끗한 맥락).
- 두 답의 «고칠 것» 이 실제 diff 에 맞는지 한 번 본다. 틀린 지적은 근거를 적어 버린다.

## 3. 걸리면 — 고치고 다시
- 고칠 것을 고친다(한 커밋 한 의도) → push(같은 PR) → **2 를 처음부터 다시**(머리 커밋이 바뀌었으므로 두 판정 모두 다시).
- 판 브랜치를 합치기만 한 커밋(5 의 충돌 풀기 등)은 고친 것이 아니다 — `python3 .claude/hooks/risk.py --same <번호> <판정 받은 커밋>` 이 `true` 면 2 · 4-1 을 건너뛰고 5 로(가드가 앞 판정 · 승인을 이어 받는다). `false`(충돌을 풀며 코드가 달라짐)면 2 부터.
- 같은 지적이 두 번 되풀이되거나 3 바퀴를 넘으면 멈추고 사용자에게: 남은 지적 · 내가 보기에 맞는지 · 선택지.
- 지적이 «사용자 결정이 필요한 것»(동작 · 범위)이면 고치지 말고 묻는다.

## 4. 통과 — 상태값 남기기
두 판정이 모두 «통과» 이고 머리 커밋이 SHA 그대로일 때만:
```
gh api $R/statuses/$SHA -f state=success -f context=tw/confirm -f description='컨펌자 통과'
gh api $R/statuses/$SHA -f state=success -f context=tw/verify  -f description='검증자 통과 — <돌린 검사 요약 60자>'
```
판정을 꾸며 올리지 않는다 — 이 두 줄은 실제 «통과» 답을 받았을 때만 쓴다.

## 4-1. 위험도 — 높으면 승인 대기
- `python3 .claude/hooks/risk.py <번호>` → `high` 면:
  - 승인자의 리뷰를 읽는다: `gh api $R/pulls/<번호>/reviews` · `gh api $R/pulls/<번호>/comments` · `gh api $R/issues/<번호>/comments` 에서 user.login = `mihioon` 인 것.
  - **CHANGES_REQUESTED 이거나 고칠 것을 적은 코멘트**가 머리 커밋 뒤에 있으면 → 고치고(3 처럼) → 고친 지적마다 `/lesson` → push → 2 부터.
  - 머리 커밋에 **APPROVED** 가 있거나, `mihioon` 코멘트에 한 줄 «승인 <머리 커밋 앞 7자리>» 가 있으면 → 5 로(이 PC 세션이 올린 PR 은 작성자가 mihioon 이라 GitHub Approve 가 안 된다 — 코멘트로 받는다). 이 한 줄은 세션이 쓰지 않는다(가드가 막는다). 승인자가 그 머리 커밋에 Request changes 를 달았으면 코멘트로는 풀리지 않는다 — 고쳐서 새 커밋을 올리고 다시 승인받는다(남이 올린 PR 은 Approve 로).
  - 아직 없으면 → 승인 요청을 남기고 **뒤에서 기다린다**:
    ```
    gh api $R/statuses/$SHA -f state=pending -f context=tw/owner -f description='mihioon 승인 대기'
    gh api $R/issues/<번호>/comments -F body=@- <<'EOF'
    <승인 요청 본문>
    EOF
    ```
    본문은 꼭 따옴표 친 heredoc(`<<'EOF'`)으로 — `-f body="…"` 큰따옴표 안의 백틱은 셸이 명령으로 실행해 붙여 넣을 한 줄이 빈칸이 된다.
    본문: «@mihioon 승인 요청 — 위험도 높음: <risk 이유>» + 컨펌자의 «설계 요약» + 검증자 «돌린 것» + «터미널에서 `! node scripts/approve.js <번호>` 를 돌리거나(지금 머리 커밋으로 승인 코멘트를 단다 · 여러 PR 은 번호를 이어서), Approve 하거나, 이 한 줄을 코멘트로 달면 세션이 머지합니다: `승인 <머리 커밋 앞 7자리>` · 고칠 것은 Request changes 나 코멘트로»(한 줄은 백틱으로 감싸 그 코멘트 자체가 승인으로 읽히지 않게). 승인 명령은 세션이 돌리지 않는다(가드가 막는다).
    그리고 `python3 .claude/hooks/risk.py --wait <번호>` 를 **뒤에서**(Bash `run_in_background`) 돌린다 — 승인이 달리고 CI 가 끝나면 한 줄로 알린다(0 = 머지할 차례 · 1 = CI 빨강 · 닫힘 · 1시간 넘김). 알림이 오면 5 로 바로 이어 간다.
    사용자에게는 «승인 명령 한 줄 — 달리면 세션이 머지» 만 말한다. 승인 기다리는 PR 이 여럿이면 번호를 이은 명령 한 줄로 한 번에 묻는다. `/ship` 을 다시 치라고 하지 않는다.
- 낮으면 → 5 로.

## 5. CI → 머지
- CI 확인: `gh api $R/commits/$SHA/check-runs --jq '[.check_runs[] | {name, status, conclusion}]'` — 모두 completed · success(또는 skipped)일 때까지 기다린다(`risk.py --wait <번호>` 를 뒤에서 돌리면 끝날 때 알린다 · 기다리기와 머지를 한 명령으로 잇지 않는다). 빨강이면 3 으로.
- base 와 충돌(`gh api $R/pulls/<번호> --jq .mergeable` 이 false)이면 base 를 합쳐(`git merge origin/<base>` — rebase · force 금지) 풀고 push → 3 의 «합치기만 한 커밋» 대로(`--same` 이 true 면 다시 묻지 않고 CI 만 기다려 머지).
- 머지: 작업 → 판 브랜치 · hotfix → main 은 squash.
  `gh api -X PUT $R/pulls/<번호>/merge -f merge_method=squash -f sha=$SHA -f commit_title='<PR 제목> (#<번호>)'`
- 브랜치 지우기는 클라우드에서 막힐 수 있다 — 막히면 그대로 둔다.

## 6. 끝
- 위험도 높음이었으면 `gh api $R/statuses/$SHA -f state=success -f context=tw/owner -f description='mihioon 승인'`.
- 버그 제보 수정이면 `node scripts/todo.js done <id> --release <판>`(관리자 gcloud 로그인이 있을 때만 — 없으면 건너뛰고 알린다).
- 사용자에게 한 번만 보고: PR 링크 · 컨펌 · 검증 결과 한 줄씩 · 머지한 판 브랜치. 끝난 것을 다시 나열하지 않는다.

하지 않는 것: 판 브랜치 → main 합치기(릴리스 — 사용자가 정할 때만, merge commit), 운영 · 규칙 · 함수 배포, 판정 없이 머지.
