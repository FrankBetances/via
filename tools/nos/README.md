# tools/nos — motor de voz neural (ILENIA / Proxecto Nós · Quisqueya Habla)

Herramientas de **build-time** para generar las locuciones de la batería VIA+
con voces neuronales abiertas. Implementa T0.1/T4.1 del plan gallego
(`docs/design/integracion-proxecto-nos.md`) y Q0.5/Q4.1 del plan dominicano
(`docs/design/integracion-quisqueya-habla.md`).

> **Principio rector:** los modelos se ejecutan solo aquí, fuera de la app.
> VIA+ no incorpora ninguna dependencia de IA en runtime y sigue siendo
> offline-first. Todo audio generado es **provisional** (`provisional: true`
> en el manifiesto) hasta la producción clínica firmada.

## Voces registradas (`voices.json`)

| Idioma | Motor | Modelo | Estado |
|---|---|---|---|
| `es` | Piper (VITS/ONNX) | `es_ES-davefx-medium` | Provisional (alternativa neural a espeak-ng) |
| `es-DO` | Piper (VITS/ONNX) | `es_MX-claude-high` | Provisional Quisqueya Habla — no existe voz abierta es-DO; la definitiva se decide en el ADR Q4.3 |
| `gl` | Coqui TTS (VITS grafemas) | `proxectonos/Nos_TTS-celtia-vits-graphemes` (Celtia) | Provisional Proxecto Nós / ILENIA |

## Uso

```bash
# 1. Entorno aislado (una vez)
python3 -m venv tools/nos/.venv
tools/nos/.venv/bin/pip install -r tools/nos/requirements.txt

# 2. Modelos (idempotente, con checksums anotados)
tools/nos/fetch-models.sh

# 3. Síntesis directa
python3 tools/nos/tts.py --list
python3 tools/nos/tts.py --lang es-DO --text "vaca" --out /tmp/vaca.wav
python3 tools/nos/tts.py --lang gl --batch lote.json --out-dir /tmp/gl/

# 4. Pipeline de assets de la audiometría verbal (WAV → loudnorm → m4a)
node scripts/verbal-assets.js audio --lang es-DO      # voz neural (Piper es_MX)
VERBAL_TTS=neural node scripts/verbal-assets.js audio # es con Piper en vez de espeak-ng
VERBAL_TTS=espeak node scripts/verbal-assets.js audio --lang es-DO  # degradación (ver abajo)
```

**Degradación sin acceso a los pesos:** si el entorno de build no puede
descargar de Hugging Face (política de red), `VERBAL_TTS=espeak` locuta la
variante con la voz clásica espeak-ng correspondiente (`es-419`, español
LatAm, para es-DO). Es un escalón por debajo del motor neural: mantiene el
contrato de claves y sonoridad, y se sustituye archivo a archivo regenerando
con la voz neural (misma orden, sin `VERBAL_TTS`) en cuanto haya red.

La normalización de sonoridad (ffmpeg `loudnorm I=-20:TP=-3:LRA=7`, m4a mono
44.1 kHz) la aplica `scripts/verbal-assets.js` de forma idéntica para todas
las voces: mismo objetivo LUFS entre `es`, `es-DO` y `gl` (T4.4/Q4.4).

## Reproducibilidad

Parámetros de síntesis fijados en `voices.json`; para VITS/Coqui la semilla se
deriva del texto (sha256), de modo que la misma entrada produce la misma
locución en la misma máquina y versión de modelo. `fetch-models.sh` anota el
sha256 de cada peso en la primera descarga y lo verifica después: un cambio
silencioso de pesos upstream rompe el script en lugar de cambiar la voz.

## Licencias (auditoría T0.2 — pendiente de firma)

Cada modelo conserva su ficha y licencia en su repositorio de origen
(`source` en `voices.json`). Antes de **empaquetar** audio generado en una
release clínica debe completarse la tabla de licencias en
`docs/design/integracion-proxecto-nos-licencias.md` y confirmarse que la
licencia de cada voz permite redistribuir el audio sintetizado en una app
propietaria. Hasta entonces, el audio neural se usa en desarrollo y pilotos
técnicos.
