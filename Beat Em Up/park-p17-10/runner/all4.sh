#!/bin/bash
# usage: all4.sh <tag> <seeds> <seedFrom> [difficulties...]  -> runs the difficulties one after the other, summary in sum-<tag>.txt
cd /tmp/claude/bp1710b
tag=$1; seeds=$2; from=$3; shift 3
diffs=${@:-easy normal hard expert}
: > sum-$tag.txt
for d in $diffs; do ./run.sh $tag $d $seeds $from >> sum-$tag.txt 2>&1; done
echo done >> sum-$tag.txt
