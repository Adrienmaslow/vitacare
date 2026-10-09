#!/usr/bin/env python3
"""
capture_serial.py — enregistre le flux CSV temps réel de CARDIO ECE.

Envoie "PLOT 3" à la carte puis écrit toutes les lignes dans un fichier CSV
(exploitable dans Excel ou avec analyze_csv.py). Ctrl+C pour arrêter.

    pip install pyserial
    python3 capture_serial.py /dev/ttyACM0 acquisition_sujet1.csv --duree 60

La première ligne du fichier indique la SOURCE (CAPTEUR_WPSE340 ou
SIMULATION) : ne jamais présenter une capture SIMULATION comme une mesure.
"""
import argparse
import sys
import time

try:
    import serial
except ImportError:
    sys.exit("Module manquant : pip install pyserial")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("port")
    ap.add_argument("sortie")
    ap.add_argument("--baud", type=int, default=115200)
    ap.add_argument("--duree", type=float, default=0, help="secondes (0 = jusqu'à Ctrl+C)")
    a = ap.parse_args()

    with serial.Serial(a.port, a.baud, timeout=1) as s, open(a.sortie, "w", encoding="utf-8") as f:
        time.sleep(2.5)                       # la carte redémarre à l'ouverture du port
        s.reset_input_buffer()
        s.write(b"PLOT 3\n")
        t0 = time.time()
        n = 0
        try:
            while a.duree == 0 or time.time() - t0 < a.duree:
                line = s.readline().decode("ascii", errors="replace").strip()
                if not line:
                    continue
                f.write(line + "\n")
                n += 1
                if n % 500 == 0:
                    print(f"{n} lignes, {time.time() - t0:.0f} s", flush=True)
        except KeyboardInterrupt:
            pass
        s.write(b"PLOT 0\n")
    print(f"{n} lignes écrites dans {a.sortie}")


if __name__ == "__main__":
    main()
