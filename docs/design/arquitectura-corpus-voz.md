# Arquitectura de corpus de voz neuronal en VIA+ (es · gl · eu · es-DO)

> **Estado:** INFRAESTRUCTURA (v1). Capa `src/Voice/` portada del blueprint
> replicable de Valeria+ (`arquitectura-corpus-voz-nos-ilenia.json`, Proxecto
> Nós / ILENIA) y adaptada a la pila de VIA+ (React Native + `react-native-tts`
> + `react-native-audio-api`). Documentos hermanos: `integracion-proxecto-nos.md`
> (gallego) e `integracion-quisqueya-habla.md` (dominicano).
> **Principio rector (P1):** ningún modelo de IA corre en el dispositivo. Los
> modelos solo se ejecutan en BUILD-TIME (`tools/nos/`) para pre-generar audio;
> en runtime la app solo REPRODUCE ficheros ya empaquetados o cae a la voz del
> sistema. VIA+ sigue siendo offline-first y SaMD Clase IIa (MDR 2017/745).

---

## 1. Qué resuelve esta capa

VIA+ ya tenía voz **acoplada a la audiometría verbal** (recortes por palabra en
`assets/audio/verbal/<lang>/`, pipeline `scripts/verbal-assets.js`, motor
`tools/nos/`). Lo que faltaba —y aporta esta capa— es el **corpus general y
enumerable** del blueprint de Valeria: las **consignas habladas** de la app
(hoy dictadas solo por el TTS del sistema en es-ES, sin assets ni multi-idioma)
pasan a un contrato con id por hash de contenido, pipeline de síntesis y cadena
de degradación elegante, cableado para **castellano, gallego, euskera y dominicano**.

La audiometría verbal conserva su pipeline propio (estímulo clínico validado por
el logopeda); esta capa es para consignas/instrucciones y futuros módulos.

## 2. Mapa de componentes (blueprint → VIA+)

| Rol (blueprint Valeria) | Archivo en Valeria+ | Equivalente en VIA+ |
|---|---|---|
| Contrato de id | `src/valeriaVoiceCorpus.ts` (`voiceCorpusId`) | **`src/Voice/voiceCorpusId.ts`** |
| Definición del corpus (puro) | `src/valeriaVoiceCorpus.ts` | **`src/Voice/viaVoiceCorpus.ts`** + banco `src/Voice/viaVoiceConsignas.ts` |
| Exportador del corpus | `scripts/export-voice-corpus.js` | **`scripts/export-voice-corpus.js`** → `voice-corpus.json` |
| Generador de assets (síntesis) | `scripts/generate-voice-assets.py` | `tools/nos/tts.py` (Piper/Celtia) + ffmpeg — ver §5 |
| Mapa id→asset | `scripts/build-voice-asset-map.js` | **`scripts/build-voice-asset-map.js`** → `src/Voice/viaVoiceAssets.ts` |
| Reproductor runtime | `src/valeriaVoicePlayback.ts` (expo-audio) | **`src/Voice/viaVoicePlayback.ts`** (`react-native-audio-api`) |
| Integración runtime | `src/valeriaVoice.ts` (expo-speech) | **`src/Voice/viaVoice.ts`** (voz de sistema vía adaptador verbal / `react-native-tts`) |
| Mapa generado | `src/valeriaVoiceAssets.ts` | **`src/Voice/viaVoiceAssets.ts`** (GENERADO) |
| Corpus serializado | `voice-corpus.json` | **`voice-corpus.json`** |

## 3. El contrato de id (`voiceCorpusId`)

```
id = [${lang}_]${style}_${fnv1a32(normalize(text))}_${len}
```

+ **`style`** ∈ `tutor | child | clinical | slow` — la prosodia se hornea en el
  audio: un mismo texto en dos estilos son DOS entradas con ids distintos.
+ **`lang`** ∈ `es | gl | es-DO` — la base `es` **no** lleva prefijo
  (retro-compat de assets ya sintetizados); `gl`/`es-DO` prefijan `${lang}_`.
+ **`fnv1a32`** — FNV-1a de 32 bits (hex), estable entre plataformas.
+ **`normalize`** — colapsa espacios y recorta bordes (los espacios no cambian
  la locución; todo lo demás sí).

La MISMA función se usa en build (al enumerar el corpus) y en runtime (al
resolver el asset). Si un literal cambia en el código, su id cambia, el mapa
deja de resolver y la locución **cae limpiamente a la voz del sistema**: la
deriva degrada calidad, nunca rompe (invariante P4).

## 4. Pipeline build-time

```
buildVoiceCorpus()               (módulo puro, src/Voice/viaVoiceCorpus.ts)
  → scripts/export-voice-corpus.js   → voice-corpus.json      (valida colisiones)
  → tools/nos + ffmpeg               → assets/voice/<id>.m4a  (síntesis, §5)
  → scripts/build-voice-asset-map.js → src/Voice/viaVoiceAssets.ts
  → runtime: viaVoice.speak() resuelve el id en VOICE_ASSETS o cae al sistema
```

Comandos:

```bash
node scripts/export-voice-corpus.js      # corpus puro → voice-corpus.json
node scripts/build-voice-asset-map.js    # assets presentes → viaVoiceAssets.ts
```

El exportador **compila el módulo puro con `tsc`** y lo ejecuta: si el corpus
deja de ser puro (importa RN/UI), falla aquí, nunca en la app (P7). El
`voice-corpus.json` no lleva marca de tiempo: regenerar solo produce diffs de
las cadenas cambiadas (P4).

## 5. Síntesis neuronal (registro de voces)

Las voces ya están declaradas en `tools/nos/voices.json` (los modelos corren
SOLO en build-time; ver `tools/nos/README.md`):

| Lengua | Motor | Voz | Proyecto | Estado |
|---|---|---|---|---|
| `es` | Piper (VITS/ONNX) | `es_ES-davefx-medium` | rhasspy/piper-voices | Provisional |
| `gl` | Coqui (VITS grafemas) | **Celtia** | **Proxecto Nós / ILENIA** | Provisional |
| `eu` | **AhoTTS** (VITS + frontend vasco) | **Maider** (respaldo Antton) | **HiTZ/Aholab · UPV/EHU (ILENIA / NEL-GAITU)** | Provisional |
| `es-DO` | Piper (VITS/ONNX) | `es_MX` (neutra LatAm) | rhasspy/piper-voices | Provisional (ADR Q4.3) |

La voz **neural es la vía por defecto de todos los idiomas**, castellano
incluido: `VERBAL_TTS=espeak` queda solo como degradación explícita para
entornos sin acceso a los pesos (y no cubre `gl` ni `eu`). El castellano usaba
espeak-ng por defecto por herencia histórica, de modo que un `audio --lang es`
en local sustituía sin avisar los recortes neurales por los clásicos.

**El euskera no es un VITS de grafemas como el gallego.** Celtia se infiere
directamente sobre el texto; el `vits.onnx` de Maider espera **fonemas**, y
quien los produce es el binario `tts` de [AhoTTS](https://github.com/hitz-zentroa/aHoTTS)
con el frontend lingüístico vasco y el diccionario `eu_dicc`. Inferir el ONNX
por su cuenta produce audio inservible. Por eso `eu` declara `engine: "ahotts"`,
el workflow clona el repositorio de AhoTTS y expone `AHOTTS_DIR`, y el
`vits.onnx` se descarga de Hugging Face (`HiTZ/TTS-eu_maider`, con
`HiTZ/TTS-eu_antton` de respaldo) en tiempo de síntesis y no con
`fetch-models.sh`.

Toda esta cadena está **portada de Valeria+**, donde la misma voz ya está en
producción (`scripts/generate-voice-assets.py`, `docs/plan-integracion-euskera.md`).

La síntesis del corpus general (consignas) la ejecuta
**`scripts/synthesize-voice-corpus.js`** (equivalente a `generate-voice-assets.py
--lang` del blueprint): consume `voice-corpus.json`, filtra por idioma,
sintetiza **solo lo que falta** (incremental → sin churn) con
`tools/nos/tts.py` (Piper es/es-DO · Celtia gl) y aplica el post-proceso ffmpeg
(`loudnorm I=-20:TP=-3:LRA=7`, m4a mono 44.1k) — el MISMO objetivo de sonoridad
que la audiometría verbal — escribiendo en `assets/voice/<id>.m4a`.

```bash
node scripts/synthesize-voice-corpus.js --lang gl       # voz neural (Celtia)
VOICE_TTS=espeak node scripts/synthesize-voice-corpus.js --lang es-DO  # degradación
node scripts/build-voice-asset-map.js                   # mapa id→asset
```

**Degradación sin pesos:** `VOICE_TTS=espeak` locuta con la voz clásica
espeak-ng (es → `es`, es-DO → `es-419` LatAm); `gl` requiere el motor neural
(no hay voz espeak-ng fiable). El workflow CI
**`.github/workflows/voice-assets.yml`** (`workflow_dispatch` + push a
`claude/**`) ejecuta export → síntesis por idioma → rebuild del mapa → commit de
los assets a la rama (push con rebase, anti-bucle). Requiere el secret
**`HF_TOKEN`** (la voz Celtia es «gated» en Hugging Face). Los modelos JAMÁS
corren en el dispositivo; `main` está protegida y los assets entran por PR.

## 6. Runtime y cadena de degradación (P2)

`viaVoice.speak(style, text, lang)` resuelve, en orden:

1. **asset neuronal de la lengua** (`VOICE_ASSETS[voiceCorpusId(style,text,lang)]`);
2. **asset neuronal base `es`** (banco compartido) — audio antes que sistema;
3. **voz del sistema** (`react-native-tts`) vía el adaptador de la audiometría
   verbal ya registrado (no se duplica el motor ni la selección de voz española);
4. **sin voz utilizable → silencio** (el clínico lee la consigna).

Mientras `VOICE_ASSETS` esté vacío (aún sin síntesis), `speak` cae siempre al
paso 3/4 → **comportamiento idéntico al actual, sin regresión**. `efSpeech`
(consignas de Funciones Ejecutivas) ya enruta por esta capa y acepta la lengua
de sesión.

## 7. Invariantes críticas

+ El módulo del corpus (`viaVoiceCorpus.ts` + `viaVoiceConsignas.ts`) permanece
  **PURO** (sin imports de RN/UI), o el exportador falla en build-time.
+ `voiceCorpusId` es idéntica en build y runtime (ambos importan la misma).
+ Los ids de la base `es` **no** llevan prefijo (retro-compat de assets).
+ Los modelos de IA nunca corren en el dispositivo: solo en build-time.
+ `src/Voice/viaVoiceAssets.ts` es **GENERADO**: no editar a mano.
+ Toda locución sin asset cae limpiamente a la voz del sistema; nunca silencio
  inesperado.
+ **Traducir no es adaptar (P6):** las consignas `gl`/`es-DO` se localizan con
  revisión humana firmada (Nós M2 / Quisqueya Habla Q2); nada de traducción
  automática entra al corpus sin revisar. El material clínico (pares mínimos de
  la audiometría verbal) se REDISEÑA por lengua, no se traduce.

## 8. Créditos y licencias

Voz **Celtia** del [Proxecto Nós](https://github.com/proxectonos) (gallego),
voz **Maider** de [HiTZ/Aholab](https://huggingface.co/HiTZ) (UPV/EHU, euskera —
ILENIA / NEL-GAITU, CC BY 4.0) y las voces Piper de
[rhasspy/piper-voices](https://huggingface.co/rhasspy/piper-voices).
La atribución requerida por cada modelo debe reflejarse en la pantalla de
créditos antes de empaquetar audio en una release clínica (auditoría de
licencias T0.2, pendiente de firma — `tools/nos/README.md`).

## 9. Tareas de cableado pendientes (no incluidas en esta capa)

1. **Localización revisada** de las consignas en `gl` y `es-DO`
   (`EF_CONSIGNA_L10N` en `viaVoiceConsignas.ts`) — Nós M2 / Quisqueya Q2.
   Hasta entonces el corpus solo tiene entradas `es` y no hay nada `gl`/`es-DO`
   que sintetizar.
2. **Propagar la lengua de sesión** (`state.locale.language`) a
   `speakConsigna(text, lang)` en las pantallas de Funciones Ejecutivas.
3. **Registrar `gl` estructuralmente** en i18n y en `VERBAL_BANK_LANGS` (hoy
   `es`, `es-DO`), y ofrecerlo en el selector de sesión — plan Nós M1/M3.
4. **Configurar el secret `HF_TOKEN`** en el repositorio y aceptar las
   condiciones de la voz Celtia en Hugging Face con esa cuenta, para que el
   workflow `voice-assets.yml` pueda sintetizar `gl`.
5. Ampliar el corpus a las consignas de otros módulos (mismo patrón enumerable).
