#!/bin/sh
# ./run.sh <결과 폴더> '<js 몸>'  — 켜 둔 repl.js 에 명령 하나 보내고 답을 찍는다(최대 120초 기다림)
o=$1; shift; n=$(python3 -c 'import time;print(time.time_ns())')
# 다 쓴 뒤 이름을 바꿔야 repl 이 반쯤 쓴 파일을 읽지 않는다
printf '%s' "$1" > "$o/cmd/$n.tmp" && mv "$o/cmd/$n.tmp" "$o/cmd/$n.js"
i=0; while [ ! -f "$o/cmd/$n.out" ] && [ $i -lt 600 ]; do sleep 0.2; i=$((i+1)); done; cat "$o/cmd/$n.out"; echo
