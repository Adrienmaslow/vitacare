#!/usr/bin/env bash
# Compile les deux variantes (capteur et simulation) et affiche Flash/RAM.
# Usage : tools/size_report.sh <ArduinoCore-avr> <U8g2_Arduino>
set -euo pipefail
DIR=$(cd "$(dirname "$0")" && pwd)
for MODE in 0 1; do
  echo "===== SIMULATION_MODE=$MODE ====="
  OUT=$(mktemp -d) "$DIR/build_avr.sh" "$1" "$2" -DSIMULATION_MODE=$MODE | sed -n '/Program:/,/bss/p'
done
