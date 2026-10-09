#!/usr/bin/env bash
# Lance tous les tests automatiques disponibles sur la machine.
#   tests/run_all.sh                        -> tests PC uniquement
#   tests/run_all.sh <ArduinoCore-avr> <U8g2_Arduino>
#                                           -> + compilation AVR + émulation simavr
set -euo pipefail
HERE=$(cd "$(dirname "$0")" && pwd)
ROOT=$(cd "$HERE/.." && pwd)

echo "### 1. Tests PC (algorithmes, signaux SIMULÉS)"
make -C "$HERE" -s test_algorithms
(cd "$HERE" && ./test_algorithms | tail -1)

if [ $# -ge 2 ]; then
  echo "### 2. Compilation AVR (capteur + simulation)"
  OUT="$ROOT/build" "$ROOT/tools/build_avr.sh" "$1" "$2" | sed -n '/Program:/,/Data:/p'
  OUT="$ROOT/build_sim" "$ROOT/tools/build_avr.sh" "$1" "$2" -DSIMULATION_MODE=1 | sed -n '/Program:/,/Data:/p'
  if command -v simavr >/dev/null && [ -f /usr/include/simavr/sim_avr.h ]; then
    echo "### 3. Émulation du firmware (simavr)"
    make -C "$HERE/avr_sim" -s
    mkdir -p "$HERE/avr_sim/resultats"
    (cd "$HERE/avr_sim" && ./cardio_avr_sim "$ROOT/build/CardioECE.elf" resultats > resultats/emulation_log.txt; tail -1 resultats/emulation_log.txt)
    (cd "$HERE/avr_sim" && ./cardio_avr_sim "$ROOT/build_sim/CardioECE.elf" --sim > resultats/emulation_simulation_build_log.txt; tail -1 resultats/emulation_simulation_build_log.txt)
  else
    echo "simavr absent : émulation ignorée (apt install simavr libsimavr-dev libelf-dev)"
  fi
fi
