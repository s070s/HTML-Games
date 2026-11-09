#!/bin/bash
# usage: run.sh <tag> <difficulty> <seeds> <seedFrom> [gameFile]   -> 2 heavy workers in parallel, merged to out-<tag>-<diff>.json
# a worker that gets no heavy slot within 5 min (exit 75) tries again
cd /tmp/claude/bp1710b
tag=$1; diff=$2; seeds=$3; from=$4; game=${5:-${GAME:-game.js}}
worker() {
  while true; do
    node ~/.claude/scripts/heavy.mjs -- node pairs.js $game $diff $seeds $1 2 part-$tag-$diff-$1.json $from > log-$tag-$diff-$1.txt 2>&1
    code=$?
    [ $code -ne 75 ] && break
  done
}
worker 0 &
worker 1 &
wait
node merge.js out-$tag-$diff.json part-$tag-$diff-0.json part-$tag-$diff-1.json
