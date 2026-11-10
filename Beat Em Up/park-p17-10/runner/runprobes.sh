#!/bin/bash
# usage: runprobes.sh <style> <seedFrom> <tag:prelude> ...   -> sequential probes, summary in probes-<style>.txt
cd /tmp/claude/bp1710b
style=$1; from=$2; shift 2
for spec in "$@"; do
  tag=${spec%%:*}; pre=${spec#*:}
  echo "== $tag ($pre) seeds from $from" >> probes-$style.txt
  ./dd.sh $tag $style 20 $from "$pre" ${G:-game-p1.js} >> probes-$style.txt 2>&1
done
echo done >> probes-$style.txt
