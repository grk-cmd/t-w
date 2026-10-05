#!/bin/bash
# 클라우드 세션(claude.ai/code)이 열릴 때 의존성을 설치해 `npm run check` 를 바로 돌릴 수 있게 한다.
# 내 컴퓨터에서 쓸 때는 이미 설치돼 있으니 아무것도 하지 않는다.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"
# npm ci 가 아니라 install — 세션이 끝난 뒤 캐시된 node_modules 를 다시 쓸 수 있다.
npm install --no-audit --no-fund
