#!/bin/bash
# usage: dd.sh <tag> <style> <seeds> <seedFrom> [prelude.js] [game.js]  -> one style against the other 15 at all four difficulties (two at a time), prints win rate per difficulty
cd /tmp/claude/bp1710b
tag=$1; style=$2; seeds=$3; from=$4; pre=$5; game=${6:-game.js}
one() {
  while true; do
    PRELUDE=$pre node ~/.claude/scripts/heavy.mjs -- node diag.js $game $1 $seeds $style /tmp/claude/bp1710b/d-$tag-$style-$1.json $from > /tmp/claude/bp1710b/dlog-$tag-$style-$1.txt 2>&1
    [ $? -ne 75 ] && break
  done
}
(one easy; one hard) &
(one normal; one expert) &
wait
for d in easy normal hard expert; do grep -h "win" /tmp/claude/bp1710b/dlog-$tag-$style-$d.txt | head -n 1; done
