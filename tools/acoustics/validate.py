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
    # JITTER Y SHIMMER. Son los dos números de perturbación que salen impresos
    # en el informe clínico y hasta agosto de 2026 NADIE los validaba: el banco
    # medía F0, HNR y formantes y se saltaba justo las dos cifras sobre las que
    # el logopeda decide si una voz es sana.
    #
    # Las tolerancias son ANCHAS a propósito, y conviene decir por qué en vez
    # de fingir precisión: VIA+ los deriva de las series por VENTANA (una F0 y
    # una amplitud cada 16 ms) y Praat de los PULSOS GLOTALES uno a uno sobre
    # un PointProcess. Son dos definiciones distintas de «ciclo», así que sobre
    # la misma señal dan números distintos por construcción. Lo que estas
    # tolerancias vigilan es que no se separen por un ORDEN DE MAGNITUD — que
    # es lo que pasaba con la contaminación de baja frecuencia, cuando VIA+
    # daba 33 % de jitter sobre una voz sana.
    "jitter_pct": 1.5,   # %
    "shimmer_pct": 6.0,  # %
}

# ---------------------------------------------------------------------------
# PROSODIA — DOS ORÁCULOS, Y POR QUÉ
#
# Las medidas prosódicas no se pueden arbitrar todas con Praat, y fingir que sí
# sería peor que no validarlas:
#
#  · ENTONACIÓN Y PAUSAS → Praat. Tiene estimador de tono propio y detector de
#    silencios propio (`To TextGrid (silences)`), así que es un juez
#    independiente de verdad.
#
#  · RECUENTO DE SÍLABAS → el guion de la síntesis. Praat NO trae detector de
#    núcleos silábicos: el método de De Jong & Wempe que usa VIA+ es un SCRIPT
#    de Praat, no una función suya. Reimplementarlo aquí sería comparar el
#    módulo contra una segunda implementación nuestra del mismo método —
#    circular y sin valor probatorio—. Como las señales se sintetizan con un
#    número de sílabas conocido, la verdad de campo es mejor juez que Praat.
#
# De ahí las dos tablas de tolerancias que siguen.
# ---------------------------------------------------------------------------

# VIA+ contra Praat. Ajustadas sobre la primera pasada, como las de vocal: las
# desviaciones observadas fueron F0 ≤ 0.03 Hz, SD ≤ 0.07 st y pausas ≤ 13 ms.
PROSODY_TOLERANCES = {
    "f0_median_hz": 1.0,      # Hz — la medida ancla, igual que en vocal
    # El rango se mide por percentiles del contorno. En los casos con
    # glissando final los dos estimadores muestrean la rampa con pasos
    # distintos (VIA+ 32 ms, Praat su propio paso adaptativo) y los extremos
    # caen en puntos algo distintos de la rampa: de ahí el margen.
    "f0_range_st": 1.0,       # semitonos
    "f0_sd_st": 0.5,          # semitonos
    "pause_count": 0,         # entero: o coinciden o hay un fallo de criterio
    "pause_total_sec": 0.08,  # s
}

# VIA+ contra el guion de síntesis (verdad de campo).
TRUTH_TOLERANCES = {
    "syllable_count": 0,      # exacto: se sintetizaron N sílabas, deben salir N
    "pause_count": 0,         # exacto
}

# Margen POR PAUSA al contrastar la duración total contra el guion.
#
# Una pausa medida sale ~50 ms más larga que la sintetizada, y NO es un sesgo
# del detector: los flancos de la envolvente de cada sílaba pasan bajo el
# umbral de silencio antes de que termine el segmento, así que el silencio
# acústico REAL es más largo que el nominal. Praat mide esas mismas pausas
# largas (Δ frente a VIA+ ≤ 13 ms), que es la prueba de que el silencio está en
# la señal y no en el criterio. El margen recoge esa diferencia entre «lo que
# pedía el guion» y «lo que contiene la señal».
TRUTH_PAUSE_MARGIN_SEC = 0.10

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


def praat_prosody(path: str) -> dict:
    """Mide un WAV de habla conectada con Praat: entonación y pausas."""
    sound = parselmouth.Sound(path)

    pitch = call(sound, "To Pitch", 0.0, F0_MIN, F0_MAX)
    median_hz = call(pitch, "Get quantile", 0, 0, 0.50, "Hertz")
    # Percentiles y no mín–máx: un solo fallo de octava arruinaría el extremo.
    # Es el mismo criterio que aplica el módulo (p5–p95).
    q05 = call(pitch, "Get quantile", 0, 0, 0.05, "semitones re 100 Hz")
    q95 = call(pitch, "Get quantile", 0, 0, 0.95, "semitones re 100 Hz")
    sd_st = call(pitch, "Get standard deviation", 0, 0, "semitones")

    # Detector de silencios propio de Praat, con el MISMO criterio que el
    # módulo: umbral a −25 dB del nivel alto y pausa mínima de 250 ms.
    intensity = call(sound, "To Intensity", F0_MIN, 0.0, "yes")
    grid = call(intensity, "To TextGrid (silences)", -25, 0.25, 0.1, "silent", "sounding")
    count = call(grid, "Get number of intervals", 1)

    pauses = []
    for i in range(1, count + 1):
        # Los silencios de los EXTREMOS son margen de grabación, no pausas del
        # habla. El módulo los excluye igual (ver `detectPauses`).
        if i in (1, count):
            continue
        if call(grid, "Get label of interval", 1, i) != "silent":
            continue
        start = call(grid, "Get start time of interval", 1, i)
        end = call(grid, "Get end time of interval", 1, i)
        pauses.append(end - start)

    def clean(v):
        return None if v is None or v != v else float(v)  # descarta NaN

    span_st = None
    if q05 == q05 and q95 == q95:  # ninguno es NaN
        span_st = float(q95) - float(q05)

    return {
        "f0_median_hz": clean(median_hz),
        "f0_range_st": span_st,
        "f0_sd_st": clean(sd_st),
        "pause_count": len(pauses),
        "pause_total_sec": sum(pauses),
    }


def via_prosody(case: dict) -> dict:
    """Medidas prosódicas de VIA+ en el vocabulario común."""
    via = case["via"]
    return {key: via.get(key) for key in (
        "f0_median_hz", "f0_range_st", "f0_sd_st", "pause_count", "pause_total_sec",
        "syllable_count", "speech_rate_sps", "articulation_rate_sps",
        "final_contour_st", "span_sec", "voiced_fraction",
    )}


def compare_prosody(name: str, via: dict, praat: dict) -> list:
    """VIA+ contra Praat en las medidas que Praat sí puede arbitrar."""
    problems = []
    for key, tol in PROSODY_TOLERANCES.items():
        a, b = via.get(key), praat.get(key)
        if a is None or b is None:
            # Igual que en vocal: declarar «no medido» es legítimo y no rompe.
            continue
        delta = abs(a - b)
        if delta > tol:
            problems.append(
                f"{name}: {key} VIA+={a:.2f} Praat={b:.2f} (Δ{delta:.2f} > {tol})"
            )
    return problems


def compare_truth(name: str, via: dict, truth: dict) -> list:
    """VIA+ contra el guion de síntesis (lo que Praat no puede arbitrar)."""
    problems = []
    expected = {
        "syllable_count": truth.get("syllableCount"),
        "pause_count": truth.get("pauseCount"),
    }
    for key, tol in TRUTH_TOLERANCES.items():
        a, b = via.get(key), expected.get(key)
        if a is None or b is None:
            continue
        delta = abs(a - b)
        if delta > tol:
            problems.append(
                f"{name}: {key} VIA+={a} guion={b} (Δ{delta} > {tol})"
            )

    a = via.get("pause_total_sec")
    b = truth.get("pauseTotalSec")
    if a is not None and b is not None:
        margin = max(TRUTH_PAUSE_MARGIN_SEC, TRUTH_PAUSE_MARGIN_SEC * (truth.get("pauseCount") or 0))
        if abs(a - b) > margin:
            problems.append(
                f"{name}: pause_total_sec VIA+={a:.2f} guion={b:.2f} "
                f"(Δ{abs(a - b):.2f} > {margin:.2f})"
            )
    return problems


def via_measures(case: dict) -> dict:
    """Normaliza las medidas de VIA+ al mismo vocabulario que las de Praat."""
    via = case["via"]
    formants = via.get("formants") or {}
    return {
        "f0_hz": via.get("f0"),
        "hnr_db": via.get("hnr"),
        # Jitter y shimmer llegan de `computeParams`, que es la función que
        # alimenta la pantalla y el informe — no se recalculan en el banco.
        "jitter_pct": via.get("jitterPct"),
        "shimmer_pct": via.get("shimmerPct"),
        "f1_hz": formants.get("f1"),
        "f2_hz": formants.get("f2"),
        "f3_hz": formants.get("f3"),
    }


# Tolerancia de formantes CONTRA EL GUION en la familia de fuente de pulsos.
# Es holgada porque un estimador LPC lee el máximo de la envolvente, que con
# F0 alta cae en el armónico más cercano al formante y no en el formante: a
# 400 Hz de F0 los armónicos van de 400 en 400, así que ±200 Hz es el error
# irreducible del método, no del código.
TRUTH_FORMANT_TOL_HZ = 250.0


def compare_vowel_truth(name: str, via: dict, truth: dict) -> list:
    """VIA+ contra los formantes SINTETIZADOS (lo que Praat no arbitra bien)."""
    expected = truth.get("formants") or []
    problems = []
    for n, key in enumerate(("f1_hz", "f2_hz", "f3_hz")):
        if n >= len(expected):
            continue
        a, b = via.get(key), expected[n]
        # No estimar es una respuesta legítima; ver `compare`.
        if a is None or b is None:
            continue
        delta = abs(a - b)
        if delta > TRUTH_FORMANT_TOL_HZ:
            problems.append(
                f"{name}: {key} VIA+={a:.1f} guion={b:.1f} (Δ{delta:.1f} > {TRUTH_FORMANT_TOL_HZ})"
            )
    return problems


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

        kind = case.get("kind", "vowel")
        if kind == "prosody":
            praat = praat_prosody(wav)
            via = via_prosody(case)
            truth = case.get("truth") or {}
            report["cases"][name] = {
                "kind": kind,
                "truth": truth,
                "via": via,
                "praat": praat,
            }
            for key in PROSODY_TOLERANCES:
                if via.get(key) is None and praat.get(key) is not None:
                    not_estimated.append(f"{name}: {key}")
            problems.extend(compare_prosody(name, via, praat))
            problems.extend(compare_truth(name, via, truth))
            continue

        praat = praat_measures(wav)
        via = via_measures(case)
        report["cases"][name] = {
            "kind": kind,
            "expected": case.get("expected"),
            "via": via,
            "praat": praat,
        }

        for key in TOLERANCES:
            if via.get(key) is None and praat.get(key) is not None:
                not_estimated.append(f"{name}: {key}")

        expected = case.get("expected") or {}
        if expected.get("formants"):
            # Familia de fuente de pulsos: los formantes los arbitra el guion
            # (ver `compare_vowel_truth`); del resto sigue encargándose Praat.
            problems.extend(
                p
                for p in compare(name, via, praat)
                if not any(p.split(": ")[1].startswith(k) for k in ("f1_hz", "f2_hz", "f3_hz"))
            )
            problems.extend(compare_vowel_truth(name, via, expected))
        else:
            problems.extend(compare(name, via, praat))

    def is_kind(data, kind):
        return data.get("kind", "vowel") == kind

    # Informe legible — vocal sostenida (VIA+ contra Praat).
    header = f"{'caso':26} {'parámetro':16} {'VIA+':>10} {'Praat':>10} {'Δ':>8}"
    print("VOCAL SOSTENIDA — calidad de la fonación (juez: Praat)")
    print(header)
    print("-" * len(header))
    for name, data in report["cases"].items():
        if not is_kind(data, "vowel"):
            continue
        for key in TOLERANCES:
            a, b = data["via"].get(key), data["praat"].get(key)
            if a is None or b is None:
                shown_a = "—" if a is None else f"{a:.1f}"
                shown_b = "—" if b is None else f"{b:.1f}"
                print(f"{name:26} {key:16} {shown_a:>10} {shown_b:>10} {'—':>8}")
            else:
                print(f"{name:26} {key:16} {a:>10.1f} {b:>10.1f} {abs(a - b):>8.1f}")

    prosody_cases = [n for n, d in report["cases"].items() if is_kind(d, "prosody")]
    if prosody_cases:
        print("\nHABLA CONECTADA — entonación y pausas (juez: Praat)")
        print(header)
        print("-" * len(header))
        for name in prosody_cases:
            data = report["cases"][name]
            for key in PROSODY_TOLERANCES:
                a, b = data["via"].get(key), data["praat"].get(key)
                if a is None or b is None:
                    shown_a = "—" if a is None else f"{a:.2f}"
                    shown_b = "—" if b is None else f"{b:.2f}"
                    print(f"{name:26} {key:16} {shown_a:>10} {shown_b:>10} {'—':>8}")
                else:
                    print(f"{name:26} {key:16} {a:>10.2f} {b:>10.2f} {abs(a - b):>8.2f}")

        # Recuento de sílabas: Praat no lo mide, así que el juez es el guion.
        head2 = f"{'caso':26} {'parámetro':16} {'VIA+':>10} {'guion':>10} {'Δ':>8}"
        print("\nHABLA CONECTADA — ritmo (juez: el guion de síntesis)")
        print(head2)
        print("-" * len(head2))
        for name in prosody_cases:
            data = report["cases"][name]
            truth = data.get("truth") or {}
            pairs = (
                ("syllable_count", truth.get("syllableCount")),
                ("pause_count", truth.get("pauseCount")),
                ("pause_total_sec", truth.get("pauseTotalSec")),
            )
            for key, expected in pairs:
                a = data["via"].get(key)
                if a is None or expected is None:
                    continue
                print(
                    f"{name:26} {key:16} {a:>10.2f} {expected:>10.2f} "
                    f"{abs(a - expected):>8.2f}"
                )

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
