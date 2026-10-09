#!/usr/bin/env python3
"""
analyze_csv.py — exploitation d'une acquisition CSV de CARDIO ECE.

    python3 analyze_csv.py acquisition.csv [--ref 72] [--png courbes.png]

Calcule à partir du fichier :
  - la fréquence d'échantillonnage réelle (contrôle des 100 Hz) ;
  - les battements détectés par la carte et le BPM moyen recalculé à partir
    des intervalles (60000 / IBI) ;
  - si --ref est donné (BPM de référence : oxymètre de pouls, comptage
    manuel 60 s...), l'erreur absolue et relative ;
  - un graphique (si matplotlib est installé) : brut, filtré, seuils, BPM.

Colonnes attendues (commande PLOT 3) :
t_ms,raw,filtered_x8,thr_high_x8,thr_low_x8,signal_ok,beat,bpm_x10
"""
import argparse
import csv
import statistics
import sys


def load(path):
    rows, source = [], "INCONNUE"
    with open(path, encoding="utf-8", errors="replace") as f:
        for line in f:
            line = line.strip()
            if line.startswith("# source="):
                source = line.split("=", 1)[1]
            if not line or not line[0].isdigit():
                continue
            p = line.split(",")
            if len(p) != 8:
                continue
            try:
                rows.append([int(x) for x in p])
            except ValueError:
                continue
    return source, rows


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("csv")
    ap.add_argument("--ref", type=float, help="BPM de référence mesuré par un autre appareil")
    ap.add_argument("--png", help="fichier image de sortie")
    a = ap.parse_args()

    source, rows = load(a.csv)
    if len(rows) < 10:
        sys.exit("Fichier vide ou format inattendu")
    print(f"Source déclarée par la carte : {source}")
    if source != "CAPTEUR_WPSE340":
        print("ATTENTION : ces données ne proviennent PAS du capteur réel.")

    t = [r[0] for r in rows]
    dts = [(t[i + 1] - t[i]) % 2**32 for i in range(len(t) - 1)]
    dur = sum(dts) / 1000.0
    print(f"Échantillons : {len(rows)}  durée : {dur:.1f} s  fs mesurée : {len(dts) / dur:.2f} Hz")
    gaps = [d for d in dts if d != 10]
    print(f"Écarts != 10 ms : {len(gaps)} (lignes série abandonnées ou échantillons perdus)")

    beats = [r[0] for r in rows if r[6] == 1]
    ibis = [(beats[i + 1] - beats[i]) % 2**32 for i in range(len(beats) - 1)]
    ibis = [x for x in ibis if 300 <= x <= 1500]
    if ibis:
        bpm_mean = 60000.0 * len(ibis) / sum(ibis)
        print(f"Battements validés : {len(beats)}  IBI moyen : {statistics.mean(ibis):.0f} ms"
              f"  écart-type : {statistics.pstdev(ibis):.0f} ms")
        print(f"BPM moyen (60000 x n / somme des IBI) : {bpm_mean:.1f}")
        disp = [r[7] / 10 for r in rows if r[7] > 0]
        if disp:
            print(f"BPM affiché : min {min(disp):.0f}  moy {statistics.mean(disp):.1f}  max {max(disp):.0f}")
        if a.ref:
            err = abs(bpm_mean - a.ref)
            print(f"Référence : {a.ref:.1f} BPM  erreur absolue : {err:.1f} BPM"
                  f"  erreur relative : {100 * err / a.ref:.1f} %")
    else:
        print("Aucun intervalle valide (signal invalide pendant toute l'acquisition ?)")
    valid = sum(1 for r in rows if r[7] > 0) / len(rows)
    print(f"Temps avec mesure valide : {100 * valid:.0f} %")

    if a.png:
        try:
            import matplotlib
            matplotlib.use("Agg")
            import matplotlib.pyplot as plt
        except ImportError:
            sys.exit("pip install matplotlib pour le graphique")
        ts = [(x - t[0]) % 2**32 / 1000 for x in t]
        fig, ax = plt.subplots(3, 1, sharex=True, figsize=(11, 7))
        ax[0].plot(ts, [r[1] for r in rows], lw=0.7)
        ax[0].set_ylabel("ADC brut")
        ax[0].set_title(f"CARDIO ECE — source : {source}")
        ax[1].plot(ts, [r[2] / 8 for r in rows], lw=0.7, label="filtré")
        ax[1].plot(ts, [r[3] / 8 for r in rows], lw=0.6, label="seuil haut")
        ax[1].plot(ts, [r[4] / 8 for r in rows], lw=0.6, label="seuil bas")
        bt = [(b - t[0]) % 2**32 / 1000 for b in beats]
        ax[1].plot(bt, [0] * len(bt), "rv", ms=4, label="battement")
        ax[1].set_ylabel("pas ADC")
        ax[1].legend(loc="upper right", fontsize=8)
        ax[2].plot(ts, [r[7] / 10 if r[7] else float("nan") for r in rows])
        if a.ref:
            ax[2].axhline(a.ref, color="k", ls="--", lw=0.8, label="référence")
            ax[2].legend(fontsize=8)
        ax[2].set_ylabel("BPM")
        ax[2].set_xlabel("temps (s)")
        fig.tight_layout()
        fig.savefig(a.png, dpi=130)
        print(f"Graphique : {a.png}")


if __name__ == "__main__":
    main()
