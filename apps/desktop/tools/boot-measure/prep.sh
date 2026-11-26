#!/bin/bash
# prep.sh <측정 worktree> <커밋> — 측정용 worktree 를 그 커밋으로 맞추고 측정 줄(instrument.py) · 망 흉내(shape.py)를 넣는다.
# ⚠️ 측정 worktree 는 작업 worktree 와 따로 둔다(git checkout -f 로 덮는다) — 넣은 줄은 커밋하지 않는다.
#   덮기 전에 본다: 그 폴더가 worktree 맨 위 · 이 도구가 든 worktree 가 아님 · HEAD 가 떨어져 있음 · rebase · bisect 중이 아님 ·
#   이 도구의 표시(git dir 의 tw-boot-measure)가 없으면 고친 파일이 없어야 함(처음 맞출 때 표시를 남긴다)
set -e
K=$(cd "$(dirname "$0")" && pwd)
[ -n "$1" ] && [ -n "$2" ] || { echo "쓰는 법: prep.sh <측정 worktree> <커밋>"; exit 2; }
W=$(cd "$1" && pwd -P) || { echo "폴더가 없다: $1"; exit 2; }
TOP=$(git -C "$W" rev-parse --show-toplevel 2>/dev/null || true)
KTOP=$(git -C "$K" rev-parse --show-toplevel)
[ -n "$TOP" ] && [ "$(cd "$TOP" && pwd -P)" = "$W" ] || { echo "worktree 맨 위가 아니다: $W"; exit 2; }
[ "$(cd "$KTOP" && pwd -P)" != "$W" ] || { echo "이 도구가 든 worktree 는 덮지 않는다: $W"; exit 2; }
if git -C "$W" symbolic-ref -q HEAD >/dev/null; then echo "브랜치를 쥔 worktree 는 덮지 않는다(git worktree add --detach 로 만든 측정 worktree 만): $W"; exit 2; fi
GD=$(git -C "$W" rev-parse --absolute-git-dir)
for x in rebase-merge rebase-apply BISECT_LOG; do [ ! -e "$GD/$x" ] || { echo "진행 중인 git 일($x)이 있는 worktree 는 덮지 않는다: $W"; exit 2; }; done
MARK="$GD/tw-boot-measure"   # 이 도구가 처음 맞춘 worktree 표시 — 표시가 없는데 고친 파일이 있으면 남의 작업이다
if [ ! -e "$MARK" ]; then
  if [ -n "$(git -C "$W" status --porcelain --untracked-files=no)" ]; then echo "고친 파일이 있는 worktree 는 덮지 않는다(이 도구가 만든 측정 worktree 가 아님): $W"; exit 2; fi
  git -C "$W" checkout -q --detach "$2"   # 처음은 -f 없이 — 겹치는 추적 안 된 파일이 있으면 git 이 거절한다
  touch "$MARK"                         # 맞추기가 된 뒤에만 표시
else
  git -C "$W" checkout -q -f --detach "$2"   # 이 도구가 맞춘 worktree — 지난번 측정 줄을 덮는다
fi
python3 "$K/instrument.py" "$W" && python3 "$K/shape.py" "$W" && git -C "$W" log --oneline -1
