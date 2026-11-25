#!/bin/bash
# run.sh <측정 worktree> <이름> [횟수] — cold · warm · update 를 n 번 재서 <결과 뿌리>/<이름>/out.txt 에 한 줄씩
# 결과 뿌리: TW_BOOTM_OUT(기본 /tmp/tw-bootm-e2e) · 그 아래 seed/appdata 가 있어야 한다(seed.js · measure.js prep-cold — README)
set -e
K=$(cd "$(dirname "$0")" && pwd)
WT=$1; NAME=$2; N=${3:-3}
OUT=${TW_BOOTM_OUT:-/tmp/tw-bootm-e2e}
export TW_BOOTM_RTT=${TW_BOOTM_RTT:-40} TW_BOOTM_BW=${TW_BOOTM_BW:-2500}
E=$WT/apps/desktop/tools/e2e-local
R=$OUT/$NAME
mkdir -p "$R"
for i in $(seq 1 "$N"); do
  D=$R/r$i; rm -rf "$D"; mkdir -p "$D"
  cp -R "$OUT/seed/appdata" "$D/appdata"
  echo "cold $i $(cd "$E" && SHOT=${SHOT:+cold$i} node "$K/measure.js" "$E" "$D")" >> "$R/out.txt"
  cp "$D/measure.json" "$D/cold.json"
  echo "warm $i $(cd "$E" && node "$K/measure.js" "$E" "$D" prep-update)" >> "$R/out.txt"
  cp "$D/measure.json" "$D/warm.json"
  echo "update $i $(cd "$E" && node "$K/measure.js" "$E" "$D")" >> "$R/out.txt"
  cp "$D/measure.json" "$D/update.json"
done
