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
  · Parámetros de síntesis fijados en voices.json y semilla determinista:
    misma entrada → misma locución (en la misma máquina/versión de modelo; el
    determinismo bit a bit puede variar entre backends numéricos). Cada motor
    tiene su mando y hay que usar el suyo: Celtia siembra PyTorch por texto
    (`torch.manual_seed`), AhoTTS es un binario determinista y Piper sortea
    dentro del grafo ONNX (`onnxruntime.set_seed`, ANTES de crear la sesión).
    En Piper la semilla es del lote en `--batch` y del texto en `--text`, PERO
    el determinismo de Piper NO está comprobado: medido en CI, el mismo lote da
    duraciones distintas entre corridas. Trátelo como pendiente, no como
    garantía (ver el comentario de PiperEngine).
  · El post-proceso de sonoridad (loudnorm/ffmpeg) NO vive aquí: lo aplica
    `scripts/verbal-assets.js` de forma idéntica para todas las voces.

Requisitos: `pip install -r tools/nos/requirements.txt` y modelos descargados
con `tools/nos/fetch-models.sh` (o NOS_MODELS_DIR apuntando a una caché).
"""

from __future__ import annotations

import argparse
import audioop
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


def _reject_if_empty(out_wav: Path, text: str) -> None:
    """Rechaza una locución vacía o muda — guarda anti-basura de Valeria+.

    Un WAV de cero muestras, o cuyo pico es prácticamente silencio, es una
    síntesis fallida que el resto del pipeline daría por buena: se codificaría a
    .m4a, entraría en el mapa de assets y la app «locutaría» silencio. Vale más
    fallar aquí y que la corrida siguiente lo reintente.
    """
    try:
        with wave.open(str(out_wav), "rb") as r:
            frames = r.readframes(r.getnframes())
            width = r.getsampwidth()
    except Exception as exc:  # noqa: BLE001
        raise RuntimeError(f"WAV ilegible para {text!r}: {exc}") from exc
    if not frames:
        raise RuntimeError(f"síntesis vacía (0 muestras) para: {text!r}")
    if audioop.max(frames, width) < 32:  # ~-60 dBFS en s16: silencio
        raise RuntimeError(f"síntesis muda (solo silencio) para: {text!r}")


# --------------------------------------------------------------------------- #
#  Motores                                                                    #
# --------------------------------------------------------------------------- #


class PiperEngine:
    """Piper (VITS/ONNX). Voz definida por <modelo>.onnx + <modelo>.onnx.json."""

    def __init__(self, voice_cfg: dict, base: Path, seed: int):
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
        # ANTES de crear la sesión, y esto es lo importante. Un VITS exportado a
        # ONNX muestrea su ruido DENTRO DEL GRAFO (nodos RandomNormalLike): piper
        # 1.2.0 solo pasa `scales` y llama a `session.run`, así que ni
        # `numpy.random.seed` ni `torch.manual_seed` tocan nada. Quien manda es
        # `onnxruntime.set_seed`, PERO el kernel de ORT construye su generador en
        # el CONSTRUCTOR —es decir, al inicializar la sesión—, leyendo ahí el
        # valor global. Llamarlo después de `PiperVoice.load()` no hace nada:
        # así estaba primero y la corrida siguió sorteando duraciones distintas
        # («pan» dio 337 ms con lengthScale 3.02 y 302 ms con 3.52, que es el
        # mismo sinsentido de antes).
        #
        # Consecuencia del mismo detalle: dentro de un proceso el generador
        # AVANZA en cada inferencia, así que la semilla no puede ser por texto
        # sin recrear la sesión. Se reparte así:
        #   · lote  → semilla del contenido del lote.
        #   · unidad → semilla del texto (cada invocación es un proceso nuevo, o
        #             sea una sesión nueva).
        #
        # OJO, no lo dé por resuelto: esta colocación es la correcta —la de
        # antes, después de `load()`, era demostrablemente inútil— pero MEDIDO
        # en CI el determinismo sigue sin verse. Con el mismo lote y el mismo
        # commit, «pan» salió en 175 ms una corrida y en 117 ms la siguiente.
        # O el kernel de esta compilación de ORT no lee la semilla global, o el
        # ruido no es lo único que se mueve. Mientras no haya dos corridas
        # idénticas medidas, aquí no hay reproducibilidad que prometer.
        onnxruntime.set_seed(seed)
        self.voice = PiperVoice.load(str(onnx), config_path=str(config))
        self.params = voice_cfg.get("params", {})

        # HABLANTE FEMENINA en voces multi-hablante — regla de Valeria+
        # (make_piper_synth). Sin esto, una voz con varias hablantes entra por
        # la 0, que es la que el modelo traiga primero: la elección la haría el
        # orden del `speaker_id_map`, no nosotros. Hoy no muerde porque sharvard
        # es de hablante única, pero deja de ser una bomba de relojería para la
        # próxima voz que no lo sea.
        self.speaker_id = None
        try:
            cfg = json.loads(Path(config).read_text(encoding="utf-8"))
        except Exception:  # noqa: BLE001 — la config ya se validó al cargar
            cfg = {}
        if int(cfg.get("num_speakers", 1)) > 1:
            id_map = cfg.get("speaker_id_map") or {}
            self.speaker_id = next(
                (int(v) for k, v in id_map.items()
                 if k.lower().startswith(("f", "female", "muller", "mujer"))),
                0,
            )
            print(f"Voz multi-hablante: se usa hablante={self.speaker_id}")

    def synthesize(self, text: str, out_wav: Path) -> None:
        kwargs = {}
        if "lengthScale" in self.params:
            kwargs["length_scale"] = self.params["lengthScale"]
        if "noiseScale" in self.params:
            kwargs["noise_scale"] = self.params["noiseScale"]
        if "noiseW" in self.params:
            kwargs["noise_w"] = self.params["noiseW"]
        if self.speaker_id is not None:
            kwargs["speaker_id"] = self.speaker_id
        with wave.open(str(out_wav), "wb") as wav_file:
            self.voice.synthesize(text, wav_file, **kwargs)
        _reject_if_empty(out_wav, text)


class CoquiVitsEngine:
    """Coqui TTS (VITS) — voz Celtia del Proxecto Nós (grafemas, sin fonemizador)."""

    # `seed` se acepta por uniformidad y se ignora: Celtia siembra por texto en
    # `synthesize`, que es donde PyTorch sortea el ruido.
    def __init__(self, voice_cfg: dict, base: Path, seed: int):
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

    # `seed` se acepta por uniformidad y se ignora: AhoTTS es un binario
    # determinista, sin muestreo de ruido que fijar.
    def __init__(self, voice_cfg: dict, base: Path, seed: int):
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



class MatxaEngine:
    """Matxa-TTS del projecte AINA (BSC) — ONNX end-to-end (acústico + vocóder).

    PORTE de `make_matxa_synth` de Valeria+ (`scripts/generate-voice-assets.py`),
    incluido lo que allí se aprendió a base de fallar. Tres diferencias con los
    motores que ya había aquí, y las tres importan:

      1. Es Matcha-TTS, no VITS: `scales` son DOS valores —temperatura y
         length_scale—, no los tres de VITS. Pasarle tres desplaza el vector y
         el audio sale mal SIN DAR ERROR.
      2. El frontend es FONÉMICO (espeak-ng vía phonemizer, idioma `ca`), no de
         grafemas: meterle letras produce ruido, no acento.
      3. El vocóder va DENTRO del export, así que la salida ya es forma de onda.

    Esquema real del modelo, verificado en Valeria+ contra
    `projecte-aina/matxa-tts-cat-multiaccent` (29/8/2026):

        entradas : x(int64 [B,T]) · x_lengths(int64 [B]) · scales(float [2])
                   · spks(int64 [B])
        salidas  : mel_lengths[0] · hfwaveform[1]   ← el audio es la SEGUNDA
        metadata : vacía (sin mapa de símbolos embebido)

    Coger `run(...)[0]` devuelve `mel_lengths`, no la onda: es el fallo que allí
    cazó el canario. Las salidas se resuelven por NOMBRE, nunca por índice.
    """

    SR = 22050

    def __init__(self, voice_cfg: dict, base: Path, seed: int):
        try:
            import numpy as np  # noqa: PLC0415
            import onnxruntime as ort  # noqa: PLC0415
            from phonemizer.backend import EspeakBackend  # noqa: PLC0415
        except ImportError as exc:  # pragma: no cover
            raise SystemExit(
                "Faltan dependencias del motor Matxa (onnxruntime, phonemizer): "
                "pip install -r tools/nos/requirements.txt\n"
                "phonemizer necesita ADEMÁS el binario espeak-ng del sistema."
            ) from exc
        self._np = np
        self.params = voice_cfg.get("params", {})
        self.speaker = int(os.environ.get("MATXA_SPEAKER", voice_cfg.get("speaker", 0)))

        model_dir = base / voice_cfg["files"]["dir"]
        # Se prefiere el export END-TO-END: si el repo solo publicara el
        # acústico, encadenar un vocóder aparte a ciegas es justo lo que este
        # motor evita, así que se aborta con el listado a la vista.
        onnx_files = sorted(model_dir.glob("*.onnx"))
        e2e = [f for f in onnx_files if "e2e" in f.name.lower()]
        chosen = e2e[0] if e2e else (onnx_files[0] if len(onnx_files) == 1 else None)
        if chosen is None:
            raise SystemExit(
                f"Modelo Matxa no utilizable en {model_dir}: {[f.name for f in onnx_files]}.\n"
                "Descárguelo con tools/nos/fetch-models.sh; si el repo publica varios "
                "ONNX sin uno end-to-end, hay que decidir a mano cuál, no adivinarlo."
            )

        self.sess = ort.InferenceSession(str(chosen), providers=["CPUExecutionProvider"])
        self.inputs = [i.name for i in self.sess.get_inputs()]
        self.out_names = [o.name for o in self.sess.get_outputs()]
        self.symbol_map = self._resolve_symbols(model_dir)
        self.backend = EspeakBackend("ca", preserve_punctuation=True, with_stress=True)
        self._canary(model_dir)

    # ---- CANARIO: una frase catalana real ANTES de tocar el corpus ---------
    # Se comprueba al CONSTRUIR el motor, no al sintetizar, para que un modelo
    # mal cargado muera con cero ficheros escritos. En Valeria+ este canario
    # evitó 858 ficheros de ruido: la onda se estaba leyendo de la salida
    # equivocada y nada más lo habría avisado.
    #
    # Además deja una muestra por índice de hablante. El modelo es MULTIACCENT
    # y su metadata viene vacía: nada dice cuál es el central, que es el acento
    # para el que se escribiría un banco clínico catalán. Eso no se deduce de un
    # log, se decide OYÉNDOLO — por eso las muestras se escriben siempre.
    def _canary(self, model_dir: Path) -> None:
        frase = "Hola! Així sonarà la meva veu als exercicis."
        try:
            wav = self._run(frase)
            words = len(frase.split())
            dur = len(wav) / self.SR
            np = self._np
            if not np.isfinite(wav).all() or float(np.max(np.abs(wav))) < 1e-3:
                raise RuntimeError("salida no válida (silencio/NaN)")
            if not (0.12 * words <= dur <= 3.0 * words + 1.0):
                raise RuntimeError(f"duración implausible {dur:.2f}s ({words} palabras)")
        except Exception as exc:  # noqa: BLE001
            raise SystemExit(
                f"El canario de Matxa falló, así que NO se sintetiza nada: {exc}\n"
                f"    entradas ONNX: {self.inputs}\n"
                f"    salidas ONNX : {self.out_names}\n"
                "    Con ese esquema se ajusta la fonemización o la firma de "
                "entrada. Es deliberado morir aquí en vez de escribir un corpus "
                "de ruido que nadie escucharía hasta el emulador."
            ) from exc
        print(f"[canario] OK · {dur:.2f}s para {len(frase.split())} palabras")

        muestras = model_dir / "muestras"
        muestras.mkdir(parents=True, exist_ok=True)
        for cand in range(4):
            try:
                w = self._run(frase, speaker=cand)
                pcm = (self._np.clip(w, -1.0, 1.0) * 32767.0).astype("<i2")
                with wave.open(str(muestras / f"canario_spk{cand}.wav"), "wb") as f:
                    f.setnchannels(1)
                    f.setsampwidth(2)
                    f.setframerate(self.SR)
                    f.writeframes(pcm.tobytes())
                print(f"[muestra] spk={cand} · {len(w) / self.SR:.2f}s")
            except Exception as exc:  # noqa: BLE001
                print(f"[muestra] spk={cand} no disponible: {exc}")

    def _resolve_symbols(self, model_dir: Path) -> dict:
        """Mapa de símbolos: metadata del export → fichero del repo → por defecto."""
        meta = self.sess.get_modelmeta().custom_metadata_map or {}
        for key in ("symbols", "symbol_to_id", "phoneme_id_map", "text_symbols"):
            if key not in meta:
                continue
            try:
                parsed = json.loads(meta[key])
                return ({s: i for i, s in enumerate(parsed)}
                        if isinstance(parsed, list) else parsed)
            except Exception:  # noqa: BLE001 — se sigue buscando, no se adivina
                pass
        for cand in sorted(model_dir.glob("*.json")):
            low = cand.name.lower()
            if not any(k in low for k in ("symbol", "vocab", "token", "char")):
                continue
            try:
                parsed = json.loads(cand.read_text(encoding="utf-8"))
                return ({s: i for i, s in enumerate(parsed)}
                        if isinstance(parsed, list) else parsed)
            except Exception:  # noqa: BLE001
                pass
        # Conjunto de Matcha-TTS (text/symbols.py). Si el modelo tuviera otro, el
        # CANARIO lo caza antes de escribir nada.
        pad = "_"
        punctuation = ';:,.!?¡¿—…"«»“” '
        letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
        letters_ipa = ("ɑɐɒæɓʙβɔɕçɗɖðʤəɘɚɛɜɝɞɟʄɡɠɢʛɦɧħɥʜɨɪʝɭɬɫɮʟɱɯɰŋɳɲɴøɵɸθœɶʘɹɺɾɻʀʁ"
                       "ɽʂʃʈʧʉʊʋⱱʌɣɤʍχʎʏʑʐʒʔʡʕʢǀǁǂǃˈˌːˑʼʴʰʱʲʷˠˤ˞↓↑→↗↘\'̩\'ᵻ")
        symbols = [pad] + list(punctuation) + list(letters) + list(letters_ipa)
        return {s: i for i, s in enumerate(symbols)}

    def _to_ids(self, text: str) -> list:
        phon = self.backend.phonemize([text], strip=True)[0]
        ids = [self.symbol_map[c] for c in phon if c in self.symbol_map]
        # Matcha intercala el pad entre símbolos (add_blank del preprocesado).
        out = [0]
        for i in ids:
            out += [i, 0]
        return out

    def _run(self, text: str, speaker: int | None = None):
        np = self._np
        ids = self._to_ids(text)
        if len(ids) < 5:
            raise RuntimeError(f"fonemización vacía para: {text!r}")
        x = np.array([ids], dtype=np.int64)
        xl = np.array([x.shape[1]], dtype=np.int64)
        length_scale = float(self.params.get("lengthScale", 1.0))
        # Temperatura baja: el corpus es INCREMENTAL, así que el mismo texto no
        # puede cambiar de voz entre lotes.
        temperature = float(self.params.get("temperature", 0.667))
        scales = np.array([temperature, length_scale], dtype=np.float32)
        spk = self.speaker if speaker is None else speaker

        feeds = {}
        for name in self.inputs:
            if name in ("x", "input", "text"):
                feeds[name] = x
            elif name in ("x_lengths", "input_lengths", "text_lengths"):
                feeds[name] = xl
            elif name == "scales":
                feeds[name] = scales
            elif name == "temperature":
                feeds[name] = np.array([temperature], dtype=np.float32)
            elif name == "length_scale":
                feeds[name] = np.array([length_scale], dtype=np.float32)
            elif name in ("spks", "sid", "speaker_id", "spk"):
                feeds[name] = np.array([spk], dtype=np.int64)
            else:
                print(f"aviso: entrada ONNX no reconocida, se omite: {name}")

        outs = self.sess.run(None, feeds)
        idx = next((i for i, n in enumerate(self.out_names)
                    if any(k in n.lower() for k in ("waveform", "wav", "audio"))), None)
        if idx is None:
            idx = max(range(len(outs)), key=lambda i: np.asarray(outs[i]).size)
            print(f"aviso: ninguna salida se llama waveform/audio; se usa "
                  f"'{self.out_names[idx]}' por tamaño.")
        return np.squeeze(np.asarray(outs[idx])).astype(np.float32)

    def synthesize(self, text: str, out_wav: Path) -> None:
        np = self._np
        wav = self._run(text)
        # Plausibilidad ANTES de escribir: silencio, NaN o una duración
        # imposible son síntesis fallidas que el resto del pipeline daría por
        # buenas (se codificarían a .m4a y la app «locutaría» ruido).
        words = max(1, len(text.split()))
        dur = len(wav) / self.SR
        if not np.isfinite(wav).all() or float(np.max(np.abs(wav))) < 1e-3:
            raise RuntimeError(f"síntesis no válida (silencio/NaN) para: {text!r}")
        if not (0.12 * words <= dur <= 3.0 * words + 1.0):
            raise RuntimeError(
                f"duración implausible {dur:.2f}s ({words} palabras): {text!r}"
            )
        pcm = np.clip(wav, -1.0, 1.0)
        pcm = (pcm * 32767.0).astype("<i2")
        with wave.open(str(out_wav), "wb") as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(self.SR)
            w.writeframes(pcm.tobytes())
        _reject_if_empty(out_wav, text)


ENGINES = {
    "piper": PiperEngine,
    "coqui-vits": CoquiVitsEngine,
    "ahotts": AhoTtsEngine,
    "matxa": MatxaEngine,
}


def make_engine(lang: str, registry: dict, seed: int):
    voices = registry["voices"]
    if lang not in voices:
        known = ", ".join(sorted(voices))
        raise SystemExit(f"Sin voz registrada para '{lang}' (voces: {known})")
    cfg = voices[lang]
    engine_cls = ENGINES.get(cfg["engine"])
    if engine_cls is None:
        raise SystemExit(f"Motor desconocido '{cfg['engine']}' para '{lang}'")
    return engine_cls(cfg, models_dir(registry), seed), cfg


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
        ("piper", "from piper import PiperVoice", "voces Piper (es, es-DO, es-419, en)"),
        ("coqui-tts", "from TTS.api import TTS", "voz Celtia (gl, Proxecto Nós)"),
        ("onnxruntime", "import onnxruntime", "Matxa-TTS (ca, projecte AINA)"),
        ("phonemizer", "from phonemizer.backend import EspeakBackend",
         "frontend fonémico de Matxa (ca) — necesita el binario espeak-ng"),
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
    ap.add_argument("--lang", help="idioma/variante registrado en voices.json (es | es-DO | gl | eu)")
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

    # La semilla se decide ANTES de construir el motor: Piper la necesita para
    # sembrar el generador de ONNX Runtime antes de crear la sesión (ver
    # PiperEngine). Por eso el lote se lee aquí y no más abajo.
    entries = None
    if unit:
        seed = seed_for(args.text)
    else:
        with open(args.batch, encoding="utf-8") as fh:
            entries = json.load(fh)
        if not isinstance(entries, dict):
            raise SystemExit("--batch debe ser un objeto JSON {clave: texto}")
        # Del CONTENIDO del lote, no de la hora: el mismo lote da el mismo audio.
        seed = seed_for("\x00".join(f"{k}={entries[k]}" for k in sorted(entries)))

    engine, cfg = make_engine(args.lang, registry, seed)
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

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    for key, text in sorted(entries.items()):
        engine.synthesize(str(text), out_dir / f"{key}.wav")
        sys.stdout.write(".")
        sys.stdout.flush()
    print(f"\n{len(entries)} locuciones {args.lang} [{cfg['model']}] → {out_dir}")


if __name__ == "__main__":
    main()
