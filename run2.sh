#!/bin/bash
./run5.sh
sleep 5
./run6.sh
sleep 5
./run7.sh
sleep 5
node test.js -t 1 -b 80
sleep 5
./run8.sh
sleep 5