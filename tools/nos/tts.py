#!/usr/bin/env python3
"""Motor de voz neural de VIA+ (ILENIA / Proxecto Nós + Piper) — build-time.

Sintetiza locuciones WAV con la voz neural registrada para cada idioma o
variante de la batería (`tools/nos/voices.json`):

  · gl    → Celtia (VITS sobre grafemas, Coqui TTS) — Proxecto Nós / ILENIA
  · eu    → Maider (AhoTTS) — HiTZ/Aholab, UPV/EHU (ILENIA / NEL-GAITU)
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
    backends numéricos). Cada motor tiene su mando para eso y hay que usar el
    suyo: Celtia sortea el ruido en PyTorch (`torch.manual_seed`) y Piper lo
    sortea dentro del grafo ONNX (`onnxruntime.set_seed`).
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
import shlex
import shutil
import subprocess
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
            import onnxruntime  # noqa: PLC0415 — import perezoso
            from piper import PiperVoice  # noqa: PLC0415
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
        self._ort = onnxruntime
        self.voice = PiperVoice.load(str(onnx), config_path=str(config))
        self.params = voice_cfg.get("params", {})

    def synthesize(self, text: str, out_wav: Path) -> None:
        # Semilla por texto, igual que Celtia — pero el mando NO es el mismo. Un
        # VITS exportado a ONNX muestrea su ruido DENTRO DEL GRAFO (nodos
        # RandomNormalLike), no en Python: piper 1.2.0 se limita a pasar
        # `scales` y a llamar a `session.run`, así que ni `numpy.random.seed` ni
        # `torch.manual_seed` tocan nada. Quien fija ese generador es
        # `onnxruntime.set_seed`.
        #
        # Sin esto, cada inferencia era un sorteo distinto y la DURACIÓN de la
        # locución con ella, porque el predictor de duración del VITS también es
        # estocástico (noiseW). Las consecuencias eran dos, y las dos se veían en
        # el pipeline: la reproducibilidad que promete este módulo no existía
        # para Piper, y el realentizado por recorte de `voice-clip-tempo.js` no
        # podía converger — medía una duración, deducía por regla de tres el
        # lengthScale que la llevaría al suelo y, al re-sintetizar, le tocaba
        # otro sorteo. Se llegó a medir «ven» en 430 ms y, en la corrida
        # siguiente y con MÁS lengthScale, en 256 ms. Con la semilla fija el
        # sorteo del predictor de duración es el mismo, y entonces sí: la
        # duración es proporcional al lengthScale y una pasada basta.
        self._ort.set_seed(seed_for(text))
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


class AhoTtsEngine:
    """Voz vasca de HiTZ/Aholab (Maider) a través de AhoTTS.

    A diferencia de Celtia —un VITS de GRAFEMAS que se infiere directamente—,
    el `vits.onnx` vasco NO se ejecuta suelto: espera FONEMAS. Quien los produce
    es el binario `tts` de AhoTTS con el frontend lingüístico vasco y el
    diccionario `eu_dicc`. Inferir el ONNX por su cuenta da audio inservible.

    El binario y los diccionarios vienen del repositorio aHoTTS
    (github.com/hitz-zentroa/aHoTTS), que el workflow clona exponiendo
    `AHOTTS_DIR`; el `vits.onnx` se descarga de Hugging Face. Portado del
    pipeline de Valeria+, donde esta misma voz ya está en producción.
    """

    def __init__(self, voice_cfg: dict, base: Path):
        self.aho = Path(os.environ.get("AHOTTS_DIR", str(base / "ahotts")))
        self.model = voice_cfg["model"]
        self.tts_bin = self.aho / "ahotts" / "tts"
        self.voice_dir = self.aho / "ahotts" / "voices" / "eu" / self.model
        self.onnx = self.voice_dir / "vits.onnx"

        if not self.tts_bin.exists():
            raise SystemExit(
                f"No encuentro el binario de AhoTTS en {self.tts_bin}.\n"
                "Clone github.com/hitz-zentroa/aHoTTS y exporte AHOTTS_DIR "
                "(el workflow de voz lo hace por usted)."
            )
        os.chmod(self.tts_bin, 0o755)
        # `ldd` revela bibliotecas del sistema que le falten al binario, que es
        # el fallo más habitual y el más opaco si no se mira.
        subprocess.run(f'ldd "{self.tts_bin}" || true', shell=True, check=False)

        if not self.onnx.exists():
            self._download(voice_cfg)

    def _download(self, voice_cfg: dict) -> None:
        try:
            from huggingface_hub import hf_hub_download  # noqa: PLC0415
        except ImportError as exc:  # pragma: no cover
            raise SystemExit(
                "huggingface_hub no instalado: pip install -r tools/nos/requirements.txt"
            ) from exc
        token = os.environ.get("HF_TOKEN", "").strip() or None
        self.voice_dir.mkdir(parents=True, exist_ok=True)
        # Repositorios por orden de preferencia (Maider y, de respaldo, Antton).
        for repo in voice_cfg.get("hfRepos", []):
            try:
                path = hf_hub_download(repo_id=repo, filename="vits.onnx", token=token)
                shutil.copy2(path, self.onnx)
                print(f"Voz vasca: {self.model} · modelo de {repo}")
                return
            except Exception as exc:  # noqa: BLE001 — se prueba el siguiente
                print(f"aviso: {repo} no accesible ({exc})")
        raise SystemExit(
            f"No se pudo descargar vits.onnx de {voice_cfg.get('hfRepos')}. "
            "Compruebe el secret HF_TOKEN y las condiciones del modelo en Hugging Face."
        )

    def synthesize(self, text: str, out_wav: Path) -> None:
        # AhoTTS lee el texto por la entrada estándar en ISO-8859-1.
        cmd = (
            f"echo {shlex.quote(text)} | iconv -f UTF-8 -t ISO-8859-1//TRANSLIT | "
            f"./ahotts/tts -Lang=eu -Method=Vits "
            f"-HDic=./ahotts/dicts/eu/eu_dicc "
            f"-voice_path=./ahotts/voices/eu/{self.model} {shlex.quote(str(out_wav))}"
        )
        subprocess.run(cmd, shell=True, check=True, cwd=str(self.aho))
        if not out_wav.exists() or out_wav.stat().st_size < 128:
            raise RuntimeError(f"AhoTTS no generó audio para: {text!r}")


ENGINES = {"piper": PiperEngine, "coqui-vits": CoquiVitsEngine, "ahotts": AhoTtsEngine}


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
        "--length-scale",
        type=float,
        help=(
            "sobrescribe el lengthScale de la voz para ESTA invocación. Lo usa el "
            "pipeline para realentizar clip a clip las locuciones que salen por "
            "debajo del suelo de duración, sin tocar el ritmo del resto del banco."
        ),
    )
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
    # El override entra por `params`, que es de donde cada motor lee su ritmo
    # (Piper usa length_scale; Coqui lo invierte a `speed`). Así una sola
    # bandera vale para todos los motores sin duplicar la conversión.
    if args.length_scale:
        engine.params = {**getattr(engine, "params", {}), "lengthScale": args.length_scale}

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
