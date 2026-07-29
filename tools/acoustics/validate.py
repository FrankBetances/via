#!/usr/bin/env python3
"""Validación del análisis acústico de VIA+ contra Praat (parselmouth).

    python3 tools/acoustics/validate.py [--out-dir tools/acoustics/out] [--json informe.json]

Lee los WAV y el `via-measurements.json` que produce `tools/acoustics/fixtures.js`
—es decir, las medidas del DSP que corre DE VERDAD en la app— y mide los mismos
ficheros con Praat a través de parselmouth. Compara parámetro a parámetro con
tolerancias declaradas y sale con código distinto de cero si alguno se desvía.

Por qué Praat y no otra referencia: es el estándar de facto en fonética
clínica, y los valores de F0, jitter, shimmer, HNR y formantes que un logopeda
espera son los que Praat define. Que VIA+ coincida con Praat sobre las mismas
señales es la única forma de afirmar que sus cifras significan lo que el
informe dice que significan.

Los modelos NO corren en el dispositivo: esto es una herramienta de build-time
igual que `tools/nos/`. La app sigue analizando en local y offline.
"""

import argparse
import json
import os
import sys

try:
    import parselmouth
    from parselmouth.praat import call
except ImportError:  # pragma: no cover - entorno sin la dependencia
    sys.exit(
        "Falta parselmouth. Instálelo con:\n"
        "    pip install -r tools/acoustics/requirements.txt"
    )


# Banda de análisis de F0 de VIA+ (voiceDsp.ts: 70–500 Hz).
F0_MIN = 70.0
F0_MAX = 500.0

# Tolerancias por parámetro. Son ANCHAS a propósito en los parámetros de
# perturbación: VIA+ mide por ventanas de 64 ms y Praat ciclo a ciclo, así que
# no puede haber coincidencia exacta. Lo que se vigila es que no haya DERIVA
# (un cambio del DSP que aleje las cifras de la referencia) y que el orden de
# magnitud clínico sea el mismo.
TOLERANCES = {
    "f0_hz": 5.0,        # Hz — aquí sí se exige precisión: es la medida ancla
    # HNR: sobre ruido aditivo puro ambos coinciden dentro de 0.5 dB, pero
    # VIA+ lo deriva del pico de autocorrelación y Praat de la armonicidad, así
    # que ante PERTURBACIÓN (jitter/shimmer) divergen algunos dB — el pico de
    # autocorrelación baja también cuando lo que varía es el periodo, no el
    # ruido. La tolerancia cubre esa diferencia de método.
    "hnr_db": 8.0,       # dB, dentro del rango medible (ver VIA_HNR_CEILING_DB)
    "f1_hz": 200.0,      # Hz
    "f2_hz": 300.0,      # Hz
    # F3 es el formante menos fiable de los dos estimadores: en vocales donde
    # F2 y F3 se acercan (/i/) ambos se desplazan, Praat incluido. La tolerancia
    # lo refleja en vez de fingir una precisión que ninguno de los dos tiene.
    "f3_hz": 500.0,      # Hz
}

# Techo del HNR de VIA+ (`HNR_CEILING_DB` en voiceDsp.ts). Por encima de él la
# lectura significa «≥ techo», no un valor: comparar ahí no informa de nada,
# porque tanto VIA+ como Praat están diciendo «esta señal está limpia».
# El techo se alcanza de forma ASINTÓTICA (r ≤ 0.999 → 29.996 dB), así que se
# considera saturada cualquier lectura a menos de medio decibelio de él.
VIA_HNR_CEILING_DB = 30.0
HNR_SATURATION_MARGIN_DB = 0.5


def praat_measures(path: str) -> dict:
    """Mide un WAV con Praat: F0, jitter, shimmer, HNR y F1–F3."""
    sound = parselmouth.Sound(path)

    pitch = call(sound, "To Pitch", 0.0, F0_MIN, F0_MAX)
    f0 = call(pitch, "Get mean", 0, 0, "Hertz")

    point_process = call(sound, "To PointProcess (periodic, cc)", F0_MIN, F0_MAX)
    jitter = call(point_process, "Get jitter (local)", 0, 0, 1e-4, 0.02, 1.3)
    shimmer = call(
        [sound, point_process], "Get shimmer (local)", 0, 0, 1e-4, 0.02, 1.3, 1.6
    )

    harmonicity = call(sound, "To Harmonicity (cc)", 0.01, F0_MIN, 0.1, 1.0)
    hnr = call(harmonicity, "Get mean", 0, 0)

    formant = call(sound, "To Formant (burg)", 0.0, 5, 5000, 0.025, 50)
    formants = [
        call(formant, "Get mean", n, 0, 0, "Hertz") for n in (1, 2, 3)
    ]

    def clean(v):
        return None if v is None or v != v else float(v)  # descarta NaN

    return {
        "f0_hz": clean(f0),
        "jitter_pct": None if jitter != jitter else float(jitter) * 100,
        "shimmer_pct": None if shimmer != shimmer else float(shimmer) * 100,
        "hnr_db": clean(hnr),
        "f1_hz": clean(formants[0]),
        "f2_hz": clean(formants[1]),
        "f3_hz": clean(formants[2]),
    }


def via_measures(case: dict) -> dict:
    """Normaliza las medidas de VIA+ al mismo vocabulario que las de Praat."""
    via = case["via"]
    formants = via.get("formants") or {}
    return {
        "f0_hz": via.get("f0"),
        "hnr_db": via.get("hnr"),
        "f1_hz": formants.get("f1"),
        "f2_hz": formants.get("f2"),
        "f3_hz": formants.get("f3"),
    }


def compare(name: str, via: dict, praat: dict) -> list:
    """Diferencias que superan la tolerancia declarada."""
    problems = []
    for key, tol in TOLERANCES.items():
        a, b = via.get(key), praat.get(key)
        if a is None or b is None:
            # Que VIA+ no estime un parámetro NO es un fallo de validación:
            # declarar «no estimable» es una respuesta legítima y preferible a
            # inventar un número. Se informa, pero no rompe.
            continue
        # HNR saturado en ambos lados: los dos dicen «limpia», no hay medida
        # que contrastar. Si VIA+ satura y Praat NO, eso sí sería un error y
        # cae por la comparación normal de abajo.
        saturated = a >= VIA_HNR_CEILING_DB - HNR_SATURATION_MARGIN_DB
        if key == "hnr_db" and saturated and b >= VIA_HNR_CEILING_DB:
            continue

        delta = abs(a - b)
        if delta > tol:
            problems.append(
                f"{name}: {key} VIA+={a:.1f} Praat={b:.1f} (Δ{delta:.1f} > {tol})"
            )
    return problems


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    here = os.path.dirname(os.path.abspath(__file__))
    parser.add_argument("--out-dir", default=os.path.join(here, "out"))
    parser.add_argument("--json", help="escribe el informe completo a un fichero")
    args = parser.parse_args()

    measurements_path = os.path.join(args.out_dir, "via-measurements.json")
    if not os.path.exists(measurements_path):
        sys.exit(
            f"No existe {measurements_path}.\n"
            "Genere primero los casos: node tools/acoustics/fixtures.js"
        )

    with open(measurements_path, encoding="utf-8") as fh:
        measurements = json.load(fh)

    report = {"cases": {}}
    problems: list = []
    not_estimated: list = []

    for name, case in measurements["cases"].items():
        wav = os.path.join(args.out_dir, f"{name}.conditioned.wav")
        if not os.path.exists(wav):
            problems.append(f"{name}: falta {wav}")
            continue

        praat = praat_measures(wav)
        via = via_measures(case)
        report["cases"][name] = {
            "expected": case.get("expected"),
            "via": via,
            "praat": praat,
        }

        for key in TOLERANCES:
            if via.get(key) is None and praat.get(key) is not None:
                not_estimated.append(f"{name}: {key}")

        problems.extend(compare(name, via, praat))

    # Informe legible.
    header = f"{'caso':26} {'parámetro':10} {'VIA+':>10} {'Praat':>10} {'Δ':>8}"
    print(header)
    print("-" * len(header))
    for name, data in report["cases"].items():
        for key in TOLERANCES:
            a, b = data["via"].get(key), data["praat"].get(key)
            if a is None or b is None:
                shown_a = "—" if a is None else f"{a:.1f}"
                shown_b = "—" if b is None else f"{b:.1f}"
                print(f"{name:26} {key:10} {shown_a:>10} {shown_b:>10} {'—':>8}")
            else:
                print(f"{name:26} {key:10} {a:>10.1f} {b:>10.1f} {abs(a - b):>8.1f}")

    if not_estimated:
        print(f"\nParámetros que VIA+ declara no estimables ({len(not_estimated)}):")
        for item in not_estimated:
            print(f"  · {item}")

    if args.json:
        with open(args.json, "w", encoding="utf-8") as fh:
            json.dump(report, fh, indent=2, ensure_ascii=False)
            fh.write("\n")

    if problems:
        print(f"\n✗ {len(problems)} desviación(es) por encima de la tolerancia:")
        for p in problems:
            print(f"  · {p}")
        return 1

    print("\n✓ Todas las medidas comparables están dentro de la tolerancia.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
