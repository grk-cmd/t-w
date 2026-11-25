#!/bin/bash
# prep.sh <측정 worktree> <커밋> — 측정용 worktree 를 그 커밋으로 맞추고 측정 줄(instrument.py) · 망 흉내(shape.py)를 넣는다.
# ⚠️ 측정 worktree 는 작업 worktree 와 따로 둔다(git checkout -f 로 덮는다) — 넣은 줄은 커밋하지 않는다.
set -e
K=$(cd "$(dirname "$0")" && pwd)
W=$1
cd "$W" && git checkout -q -f --detach "$2" && python3 "$K/instrument.py" "$W" && python3 "$K/shape.py" "$W" && git log --oneline -1
