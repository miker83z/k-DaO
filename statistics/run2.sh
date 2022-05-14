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
sleep 5
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
sleep 5
for i in {70..70..10}
  do
    for j in {1..4}
    do
      for k in {1..3}
      do
        node test.js -t $j -b $i
      done
    done
  done
sleep 5
node test.js -t 1 -b 80
sleep 5
for i in {80..80..10}
  do
    for j in {3..4}
    do
      for k in {1..3}
      do
        node test.js -t $j -b $i
      done
    done
  done