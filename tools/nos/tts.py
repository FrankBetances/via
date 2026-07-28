#!/usr/bin/env python3
"""Motor de voz neural de VIA+ (ILENIA / Proxecto Nós + Piper) — build-time.

Sintetiza locuciones WAV con la voz neural registrada para cada idioma o
variante de la batería (`tools/nos/voices.json`):

  · gl    → Celtia (VITS sobre grafemas, Coqui TTS) — Proxecto Nós / ILENIA
  · es    → Piper es_ES (provisional; sustituye a espeak-ng si se pide neural)
  · es-DO → Piper es_MX neutra LatAm (provisional Quisqueya Habla, ADR Q4.3)

Uso:
  python3 tools/nos/tts.py --list
  python3 tools/nos/tts.py --lang es-DO --text "vaca" --out vaca.wav
  python3 tools/nos/tts.py --lang gl --batch lote.json --out-dir out/
      (lote.json = {"clave": "texto", ...} → out/<clave>.wav)

Principios (docs/design/integracion-proxecto-nos.md · integracion-quisqueya-habla.md):
  · Los modelos se ejecutan SOLO aquí, en build-time: la app no incorpora
    ninguna dependencia de IA en runtime y sigue siendo offline-first.
  · Parámetros de síntesis fijados en voices.json y semilla derivada del texto:
    misma entrada → misma locución (reproducible entre ejecuciones en la misma
    máquina/versión de modelo; el determinismo bit a bit puede variar entre
    backends numéricos).
  · El post-proceso de sonoridad (loudnorm/ffmpeg) NO vive aquí: lo aplica
    `scripts/verbal-assets.js` de forma idéntica para todas las voces.

Requisitos: `pip install -r tools/nos/requirements.txt` y modelos descargados
con `tools/nos/fetch-models.sh` (o NOS_MODELS_DIR apuntando a una caché).
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
import wave
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
VOICES_JSON = HERE / "voices.json"


def load_registry() -> dict:
    with open(VOICES_JSON, encoding="utf-8") as fh:
        return json.load(fh)


def models_dir(registry: dict) -> Path:
    env = os.environ.get("NOS_MODELS_DIR")
    if env:
        return Path(env)
    return ROOT / registry.get("modelsDir", "tools/nos/models")


def seed_for(text: str) -> int:
    """Semilla determinista por texto (reproducibilidad de la síntesis)."""
    return int.from_bytes(hashlib.sha256(text.encode("utf-8")).digest()[:4], "big")


# --------------------------------------------------------------------------- #
#  Motores                                                                    #
# --------------------------------------------------------------------------- #


class PiperEngine:
    """Piper (VITS/ONNX). Voz definida por <modelo>.onnx + <modelo>.onnx.json."""

    def __init__(self, voice_cfg: dict, base: Path):
        try:
            from piper import PiperVoice  # noqa: PLC0415 — import perezoso
        except ImportError as exc:  # pragma: no cover
            raise SystemExit(
                "piper-tts no instalado: pip install -r tools/nos/requirements.txt"
            ) from exc
        onnx = base / voice_cfg["files"]["onnx"]
        config = base / voice_cfg["files"]["config"]
        for f in (onnx, config):
            if not f.exists():
                raise SystemExit(
                    f"Modelo no encontrado: {f}\nDescárguelo con tools/nos/fetch-models.sh"
                )
        self.voice = PiperVoice.load(str(onnx), config_path=str(config))
        self.params = voice_cfg.get("params", {})

    def synthesize(self, text: str, out_wav: Path) -> None:
        kwargs = {}
        if "lengthScale" in self.params:
            kwargs["length_scale"] = self.params["lengthScale"]
        if "noiseScale" in self.params:
            kwargs["noise_scale"] = self.params["noiseScale"]
        if "noiseW" in self.params:
            kwargs["noise_w"] = self.params["noiseW"]
        with wave.open(str(out_wav), "wb") as wav_file:
            self.voice.synthesize(text, wav_file, **kwargs)


class CoquiVitsEngine:
    """Coqui TTS (VITS) — voz Celtia del Proxecto Nós (grafemas, sin fonemizador)."""

    def __init__(self, voice_cfg: dict, base: Path):
        try:
            import torch  # noqa: PLC0415
            from TTS.api import TTS  # noqa: PLC0415 — import perezoso (pesado)
        except ImportError as exc:  # pragma: no cover
            raise SystemExit(
                "coqui-tts no instalado: pip install -r tools/nos/requirements.txt"
            ) from exc
        self._torch = torch
        model_dir = base / voice_cfg["files"]["dir"]
        config = model_dir / "config.json"
        checkpoints = sorted(model_dir.glob("*.pth"))
        if not config.exists() or not checkpoints:
            raise SystemExit(
                f"Modelo Celtia no encontrado en {model_dir} (config.json + *.pth).\n"
                "Descárguelo con tools/nos/fetch-models.sh"
            )
        self.tts = TTS(model_path=str(checkpoints[0]), config_path=str(config), progress_bar=False)
        self.params = voice_cfg.get("params", {})

    def synthesize(self, text: str, out_wav: Path) -> None:
        # Semilla fija por texto: VITS muestrea ruido en inferencia; sin esto
        # cada ejecución daría una locución distinta (rompería el contrato de
        # reproducibilidad del pipeline de assets).
        self._torch.manual_seed(seed_for(text))
        kwargs = {}
        # La API de Coqui expone el ritmo como `speed` (multiplicador), no como
        # el `length_scale` de VITS: son inversos (length_scale 1.1 = 10 % más
        # lento = speed 0.909). Pasar `length_scale` acababa en un TypeError que
        # se tragaba el `except` de abajo, de modo que el parámetro declarado en
        # voices.json NO se aplicaba nunca y la locución gallega salía siempre a
        # ritmo por defecto.
        length_scale = self.params.get("lengthScale")
        if length_scale:
            kwargs["speed"] = 1.0 / float(length_scale)
        try:
            self.tts.tts_to_file(text=text, file_path=str(out_wav), **kwargs)
        except TypeError:
            # Versiones de Coqui sin passthrough del ritmo.
            self.tts.tts_to_file(text=text, file_path=str(out_wav))


ENGINES = {"piper": PiperEngine, "coqui-vits": CoquiVitsEngine}


def make_engine(lang: str, registry: dict):
    voices = registry["voices"]
    if lang not in voices:
        known = ", ".join(sorted(voices))
        raise SystemExit(f"Sin voz registrada para '{lang}' (voces: {known})")
    cfg = voices[lang]
    engine_cls = ENGINES.get(cfg["engine"])
    if engine_cls is None:
        raise SystemExit(f"Motor desconocido '{cfg['engine']}' para '{lang}'")
    return engine_cls(cfg, models_dir(registry)), cfg


# --------------------------------------------------------------------------- #
#  CLI                                                                        #
# --------------------------------------------------------------------------- #


def cmd_check() -> int:
    """Diagnóstico del entorno Python (`--check`).

    Comprueba que las librerías de síntesis IMPORTAN de verdad, no solo que
    estén instaladas: la ruta de fallo real del pipeline gallego fue un entorno
    con `coqui-tts` presente pero `import TTS` roto porque spacy necesita
    `click` y las versiones nuevas de typer ya no lo arrastran. Un `pip list`
    no lo detecta; este comando sí.

    Devuelve 0 si todo importa, 1 si falta algo (apto para CI).
    """
    checks: list[tuple[str, str, str]] = [
        ("piper", "from piper import PiperVoice", "voces Piper (es, es-DO)"),
        ("coqui-tts", "from TTS.api import TTS", "voz Celtia (gl, Proxecto Nós)"),
        ("torch", "import torch", "backend de Coqui/VITS"),
        ("huggingface_hub", "from huggingface_hub import snapshot_download", "descarga de pesos"),
    ]
    failed = 0
    for name, statement, purpose in checks:
        try:
            exec(compile(statement, "<check>", "exec"), {})  # noqa: S102 — diagnóstico local
        except Exception as exc:  # noqa: BLE001 — cualquier fallo de import cuenta
            failed += 1
            print(f"✗ {name:16} {purpose}\n    {type(exc).__name__}: {exc}")
        else:
            print(f"✓ {name:16} {purpose}")

    if failed:
        print(
            "\nEntorno incompleto. Reinstale con:\n"
            "  pip install -r tools/nos/requirements.txt\n"
            "(el archivo fija `click` y `numpy<2`, que son las dos resoluciones "
            "transitivas que rompen `import TTS`)."
        )
    return 1 if failed else 0


def cmd_list(registry: dict) -> None:
    base = models_dir(registry)
    for lang, cfg in sorted(registry["voices"].items()):
        files = cfg.get("files", {})
        paths = [base / p for p in files.values()]
        ready = all(p.exists() for p in paths) if paths else False
        state = "descargada" if ready else "PENDIENTE (fetch-models.sh)"
        flag = " · provisional" if cfg.get("provisional") else ""
        print(f"{lang:6} {cfg['engine']:11} {cfg['model']}{flag} · {state}")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--lang", help="idioma/variante registrado en voices.json (es | es-DO | gl)")
    ap.add_argument("--text", help="texto a sintetizar (modo unitario)")
    ap.add_argument("--out", help="WAV de salida (modo unitario)")
    ap.add_argument("--batch", help="JSON {clave: texto} (modo lote)")
    ap.add_argument("--out-dir", help="directorio de salida del lote (<clave>.wav)")
    ap.add_argument("--list", action="store_true", help="listar voces registradas y su estado")
    ap.add_argument(
        "--check",
        action="store_true",
        help="verificar que las librerías de síntesis importan (diagnóstico del entorno)",
    )
    args = ap.parse_args()

    if args.check:
        raise SystemExit(cmd_check())

    registry = load_registry()
    if args.list:
        return cmd_list(registry)

    if not args.lang:
        ap.error("--lang es obligatorio (salvo --list)")
    unit = bool(args.text or args.out)
    batch = bool(args.batch or args.out_dir)
    if unit == batch:
        ap.error("use --text/--out (unitario) O --batch/--out-dir (lote)")
    if unit and not (args.text and args.out):
        ap.error("el modo unitario requiere --text y --out")
    if batch and not (args.batch and args.out_dir):
        ap.error("el modo lote requiere --batch y --out-dir")

    engine, cfg = make_engine(args.lang, registry)

    if unit:
        out = Path(args.out)
        out.parent.mkdir(parents=True, exist_ok=True)
        engine.synthesize(args.text, out)
        print(f"{args.lang} [{cfg['model']}] → {out}")
        return

    with open(args.batch, encoding="utf-8") as fh:
        entries = json.load(fh)
    if not isinstance(entries, dict):
        raise SystemExit("--batch debe ser un objeto JSON {clave: texto}")
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    for key, text in sorted(entries.items()):
        engine.synthesize(str(text), out_dir / f"{key}.wav")
        sys.stdout.write(".")
        sys.stdout.flush()
    print(f"\n{len(entries)} locuciones {args.lang} [{cfg['model']}] → {out_dir}")


if __name__ == "__main__":
    main()
