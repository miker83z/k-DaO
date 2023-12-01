#!/bin/bash
for i in `seq 50 10 50`
  do
    for j in {1..4}
    do
      for k in {1..4}
      do
        node test.js -t $j -b $i
      done
    done
  done
