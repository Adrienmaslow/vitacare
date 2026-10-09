#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Compilation "à la main" du sketch CardioECE pour Arduino Uno (ATmega328P)
# avec avr-gcc, en reproduisant les options de l'IDE Arduino (platform.txt
# du cœur arduino:avr 1.8.6). Sert à vérifier la compilation et la taille
# RAM/Flash sur une machine sans arduino-cli.
#
# Usage : tools/build_avr.sh <ArduinoCore-avr> <U8g2_Arduino> [-DSIMULATION_MODE=1]
#   <ArduinoCore-avr> : git clone --branch 1.8.6 https://github.com/arduino/ArduinoCore-avr
#   <U8g2_Arduino>    : git clone https://github.com/olikraus/U8g2_Arduino
# Méthode recommandée en pratique : arduino-cli (voir README.md).
# ---------------------------------------------------------------------------
set -euo pipefail
CORE=$(cd "$1" && pwd); U8G2=$(cd "$2" && pwd); shift 2
EXTRA="$*"
SKETCH=$(cd "$(dirname "$0")/.." && pwd)
OUT=${OUT:-$(mktemp -d)}
mkdir -p "$OUT/core" "$OUT/lib" "$OUT/sketch"

MCU="-mmcu=atmega328p -DF_CPU=16000000L -DARDUINO=10819 -DARDUINO_AVR_UNO -DARDUINO_ARCH_AVR"
INC="-I$CORE/cores/arduino -I$CORE/variants/standard -I$CORE/libraries/Wire/src -I$CORE/libraries/EEPROM/src -I$CORE/libraries/SPI/src -I$U8G2/src -I$U8G2/src/clib"
CFLAGS="-c -g -Os -std=gnu11 -ffunction-sections -fdata-sections -flto -fno-fat-lto-objects $MCU $INC"
CXXFLAGS="-c -g -Os -std=gnu++11 -fpermissive -fno-exceptions -ffunction-sections -fdata-sections -fno-threadsafe-statics -Wno-error=narrowing -flto $MCU $INC"
SFLAGS="-c -g -x assembler-with-cpp -flto $MCU $INC"

echo "[1/4] coeur Arduino"
for f in "$CORE"/cores/arduino/*.c;   do avr-gcc $CFLAGS -w "$f" -o "$OUT/core/$(basename "$f").o"; done
for f in "$CORE"/cores/arduino/*.cpp; do avr-g++ $CXXFLAGS -w "$f" -o "$OUT/core/$(basename "$f").o"; done
for f in "$CORE"/cores/arduino/*.S;   do avr-gcc $SFLAGS "$f" -o "$OUT/core/$(basename "$f").o"; done
rm -f "$OUT/core.a"; avr-gcc-ar rcs "$OUT/core.a" "$OUT"/core/*.o

echo "[2/4] bibliotheques (Wire, SPI, U8g2)"
avr-g++ $CXXFLAGS -w "$CORE/libraries/Wire/src/Wire.cpp" -o "$OUT/lib/Wire.o"
avr-gcc $CFLAGS -w "$CORE/libraries/Wire/src/utility/twi.c" -o "$OUT/lib/twi.o"
avr-g++ $CXXFLAGS -w "$CORE/libraries/SPI/src/SPI.cpp" -o "$OUT/lib/SPI.o"
for f in "$U8G2"/src/clib/*.c; do avr-gcc $CFLAGS -w "$f" -o "$OUT/lib/$(basename "$f").o"; done
for f in "$U8G2"/src/*.cpp;    do avr-g++ $CXXFLAGS -w "$f" -o "$OUT/lib/$(basename "$f").o"; done

echo "[3/4] sketch CardioECE (avertissements actives)"
avr-g++ $CXXFLAGS -Wall -Wextra $EXTRA -x c++ -include Arduino.h "$SKETCH/CardioECE.ino" -o "$OUT/sketch/CardioECE.ino.o"
for f in "$SKETCH"/*.cpp; do avr-g++ $CXXFLAGS -Wall -Wextra $EXTRA "$f" -o "$OUT/sketch/$(basename "$f").o"; done

echo "[4/4] edition de liens"
avr-gcc -w -Os -g -flto -fuse-linker-plugin -Wl,--gc-sections -mmcu=atmega328p \
  -o "$OUT/CardioECE.elf" "$OUT"/sketch/*.o "$OUT"/lib/*.o "$OUT/core.a" -L"$OUT" -lm
avr-objcopy -O ihex -R .eeprom "$OUT/CardioECE.elf" "$OUT/CardioECE.hex"
echo
avr-size -C --mcu=atmega328p "$OUT/CardioECE.elf" || avr-size "$OUT/CardioECE.elf"
echo "HEX : $OUT/CardioECE.hex"
