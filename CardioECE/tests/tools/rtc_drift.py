#!/usr/bin/env python3
"""
rtc_drift.py — protocole de mesure de la dérive du DS1302 (objectif CDC :
<= 3 s/jour). Le PC doit être synchronisé NTP (vérifier : timedatectl /
"Régler l'heure automatiquement").

  1. Réglage initial (une seule fois) :
       python3 rtc_drift.py /dev/ttyACM0 --set
     -> envoie "SET" avec l'heure du PC au changement de seconde.
  2. Mesure (24 h ou plus, carte alimentée ou non entre deux relevés) :
       python3 rtc_drift.py /dev/ttyACM0 --log derive.csv
     -> envoie "GET" à chaque appel, enregistre (heure PC, heure RTC, écart).
  3. Dérive = (écart_final - écart_initial) / durée_en_jours, en s/jour.

Résolution : la RTC compte en secondes entières ; avec deux relevés à 24 h
d'intervalle l'incertitude est de ±1 s/jour. Pour conclure sur 3 s/jour, il
est préférable de mesurer sur 3 à 7 jours (incertitude ±0,3 à ±0,15 s/jour).
"""
import argparse
import csv
import datetime as dt
import os
import re
import sys
import time

try:
    import serial
except ImportError:
    sys.exit("Module manquant : pip install pyserial")

RX = re.compile(r"RTC (\d\d)/(\d\d)/(\d{4}) (\d\d):(\d\d):(\d\d)")


def open_port(port):
    s = serial.Serial(port, 115200, timeout=1)
    time.sleep(2.5)                           # redémarrage de la carte
    s.reset_input_buffer()
    return s


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("port")
    ap.add_argument("--set", action="store_true")
    ap.add_argument("--log")
    a = ap.parse_args()
    s = open_port(a.port)

    if a.set:
        now = dt.datetime.now()
        target = (now + dt.timedelta(seconds=1)).replace(microsecond=0)
        time.sleep((target - dt.datetime.now()).total_seconds())
        s.write(target.strftime("SET %Y-%m-%d %H:%M:%S\n").encode())
        print(s.readline().decode(errors="replace").strip())
        return

    # Relevé : on attend le passage de seconde de la RTC pour réduire l'erreur
    # de lecture à quelques ms (on scrute GET jusqu'au changement).
    last = None
    for _ in range(40):
        t_pc = dt.datetime.now()
        s.write(b"GET\n")
        m = RX.search(s.readline().decode(errors="replace"))
        if not m:
            continue
        d, mo, y, h, mi, se = map(int, m.groups())
        rtc = dt.datetime(y, mo, d, h, mi, se)
        if last is not None and rtc != last:
            ecart = (rtc - t_pc).total_seconds()
            print(f"PC {t_pc:%Y-%m-%d %H:%M:%S.%f}  RTC {rtc}  écart RTC-PC = {ecart:+.2f} s")
            if a.log:
                new = not os.path.exists(a.log)
                with open(a.log, "a", newline="") as f:
                    w = csv.writer(f)
                    if new:
                        w.writerow(["heure_pc", "heure_rtc", "ecart_s"])
                    w.writerow([t_pc.isoformat(), rtc.isoformat(), f"{ecart:.3f}"])
            return
        last = rtc
        time.sleep(0.05)
    sys.exit("Pas de réponse RTC valide (commande GET)")


if __name__ == "__main__":
    main()
