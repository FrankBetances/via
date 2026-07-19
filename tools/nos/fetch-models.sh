#!/usr/bin/env bash
# Descarga idempotente de los modelos del motor de voz neural (tools/nos).
#
#   tools/nos/fetch-models.sh            → descarga lo que falte
#   NOS_MODELS_DIR=/ruta ...             → caché alternativa (por defecto tools/nos/models)
#
# Checksums: en la primera descarga se anota el sha256 en <archivo>.sha256;
# las ejecuciones siguientes lo verifican (si los pesos upstream cambian, el
# script falla en vez de aceptar silenciosamente un modelo distinto — T0.4).
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MODELS="${NOS_MODELS_DIR:-$HERE/models}"
PIPER_BASE="https://huggingface.co/rhasspy/piper-voices/resolve/main"
CELTIA_REPO="proxectonos/Nos_TTS-celtia-vits-graphemes"

mkdir -p "$MODELS/piper" "$MODELS/celtia"

checksum() { # checksum <archivo>  → anota o verifica <archivo>.sha256
  local f="$1"
  if [[ -f "$f.sha256" ]]; then
    (cd "$(dirname "$f")" && sha256sum -c "$(basename "$f").sha256" >/dev/null) \
      || { echo "✗ checksum distinto: $f (¿cambiaron los pesos upstream?)"; exit 1; }
  else
    (cd "$(dirname "$f")" && sha256sum "$(basename "$f")" > "$(basename "$f").sha256")
  fi
}

fetch() { # fetch <url> <destino>
  local url="$1" dest="$2"
  if [[ ! -s "$dest" ]]; then
    echo "↓ $(basename "$dest")"
    curl -fL --retry 4 --retry-delay 2 -o "$dest.part" "$url"
    mv "$dest.part" "$dest"
  fi
  checksum "$dest"
}

# --- Voces Piper (es provisional + es-DO Quisqueya Habla, Q4.1) --------------
fetch "$PIPER_BASE/es/es_ES/davefx/medium/es_ES-davefx-medium.onnx"       "$MODELS/piper/es_ES-davefx-medium.onnx"
fetch "$PIPER_BASE/es/es_ES/davefx/medium/es_ES-davefx-medium.onnx.json"  "$MODELS/piper/es_ES-davefx-medium.onnx.json"
fetch "$PIPER_BASE/es/es_MX/claude/high/es_MX-claude-high.onnx"           "$MODELS/piper/es_MX-claude-high.onnx"
fetch "$PIPER_BASE/es/es_MX/claude/high/es_MX-claude-high.onnx.json"      "$MODELS/piper/es_MX-claude-high.onnx.json"

# --- Voz Celtia (gl, Proxecto Nós / ILENIA, T4.1) -----------------------------
# El repo trae config.json + checkpoint .pth; se descarga completo y versionado.
if ! ls "$MODELS/celtia"/*.pth >/dev/null 2>&1; then
  echo "↓ Celtia ($CELTIA_REPO)"
  if command -v huggingface-cli >/dev/null 2>&1; then
    huggingface-cli download "$CELTIA_REPO" --local-dir "$MODELS/celtia"
  else
    python3 - "$CELTIA_REPO" "$MODELS/celtia" <<'PY'
import sys
from huggingface_hub import snapshot_download
snapshot_download(repo_id=sys.argv[1], local_dir=sys.argv[2])
PY
  fi
fi
for f in "$MODELS/celtia"/*.pth "$MODELS/celtia"/config.json; do
  [[ -f "$f" ]] && checksum "$f"
done

echo "✓ Modelos en $MODELS"
python3 "$HERE/tts.py" --list
