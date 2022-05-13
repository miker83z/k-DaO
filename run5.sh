#!/bin/bash
for i in {50..50..10}
  do
    for j in {2..4}
    do
      for k in {1..3}
      do
        node test.js -t $j -b $i
      done
    done
  done
