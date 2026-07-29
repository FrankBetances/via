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
REGISTRY="$HERE/voices.json"

mkdir -p "$MODELS/piper"

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

# --- Voces VITS (Coqui) declaradas en voices.json ---------------------------
# Se leen del REGISTRO en vez de estar a fuego: añadir una lengua es editar
# voices.json, no este script. Cada entrada aporta su repositorio (`repo`, que
# admite varios candidatos en `hfRepos`, en orden de preferencia) y su
# directorio de destino (`files.dir`).
#
# El euskera NO pasa por aquí: su motor es AhoTTS y el `vits.onnx` lo descarga
# el propio motor (tools/nos/tts.py), que además necesita el binario y los
# diccionarios del repositorio aHoTTS que clona el workflow.
vits_entries() {
  python3 -c '
import json, os, re, sys
registry = json.load(open(sys.argv[1], encoding="utf-8"))
for lang, cfg in registry["voices"].items():
    if cfg.get("engine") != "coqui-vits":
        continue
    repos = cfg.get("hfRepos") or [cfg.get("model", "")]
    print("\t".join([lang, " ".join(r for r in repos if r), cfg["files"]["dir"]]))
' "$REGISTRY"
}

while IFS=$'\t' read -r LANG REPOS DIR; do
  [[ -z "$LANG" ]] && continue
  if [[ -z "$REPOS" ]]; then
    echo "✗ La voz '$LANG' no declara ningún repositorio de pesos (hfRepos) en voices.json."
    exit 1
  fi

  DEST="$MODELS/$DIR"
  mkdir -p "$DEST"
  if ! ls "$DEST"/*.pth >/dev/null 2>&1; then
    # Candidatos en orden: gana el primero que responda (los espejos de HF no
    # siempre resuelven la misma capitalización del identificador).
    OK=0
    for REPO in $REPOS; do
      echo "↓ $LANG ($REPO)"
      if command -v huggingface-cli >/dev/null 2>&1; then
        huggingface-cli download "$REPO" --local-dir "$DEST" && OK=1 && break
      else
        python3 -c '
import sys
from huggingface_hub import snapshot_download
snapshot_download(repo_id=sys.argv[1], local_dir=sys.argv[2])
' "$REPO" "$DEST" && OK=1 && break
      fi
      echo "  aviso: $REPO no accesible, probando el siguiente…"
    done
    if [[ "$OK" -ne 1 ]]; then
      echo "✗ Ningún repositorio de '$LANG' fue accesible: $REPOS"
      echo "  Compruebe HF_TOKEN y que se hayan aceptado las condiciones del modelo."
      exit 1
    fi
  fi
  for f in "$DEST"/*.pth "$DEST"/config.json; do
    [[ -f "$f" ]] && checksum "$f"
  done
done < <(vits_entries)

echo "✓ Modelos en $MODELS"
python3 "$HERE/tts.py" --list
