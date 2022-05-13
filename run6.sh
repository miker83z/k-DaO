#!/bin/bash
for i in {60..60..10}
  do
    for j in {1..4..3}
    do
      for k in {1..3}
      do
        node test.js -t $j -b $i
      done
    done
  done
