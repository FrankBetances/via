# Integración con Valeria+ — arquitectura de voz de referencia

> **Estado:** REFERENCIA CONTRASTADA (31/07/2026). Este documento existe porque
> la cadena de voz de VIA+ se portó de Valeria+ pero **la copia se desvió en
> silencio**, y esa desviación costó una voz castellana inservible en producción
> y cuatro corridas de CI en rojo. Aquí queda escrito qué hace Valeria, qué hace
> VIA+, y —cuando difieren— si la diferencia es deliberada o es deuda.
>
> Fuente: `FrankBetances/Valeria` · `scripts/generate-voice-assets.py` (597 líneas)
> y `docs/arquitectura-corpus-voz-nos-ilenia.json`.

---

## 1. Por qué este documento

VIA+ declara en `arquitectura-corpus-voz.md` que su capa de voz está «portada
del blueprint replicable de Valeria+». La afirmación es cierta para la
estructura —contrato de id, exportador, mapa id→asset, tolerancia por idioma—
pero **no para la receta de síntesis**, que es justo donde se rompió.

El fallo concreto: el castellano se locutó con `es_ES-davefx-medium`, una voz
elegida en VIA+ que Valeria nunca usó. davefx desploma los monosílabos —«pan»
116 ms medido sobre el WAV, antes de cualquier post-proceso— y ninguna cantidad
de realentizado la levantaba hasta el suelo clínico de 350 ms. Valeria locuta el
castellano con **`es_ES-sharvard-medium`** y su corpus, mucho mayor que el de
VIA+, funciona sin incidencias.

La lección no es «copiar Valeria entera sin pensar»: hay divergencias
deliberadas y bien fundadas (§4). Es que **cada divergencia debe estar escrita y
justificada**, porque la que no lo está acaba siendo un defecto.

## 2. La arquitectura de Valeria+ (`scripts/generate-voice-assets.py`)

Un solo script Python, por idioma, incremental por existencia de `.m4a`.

### 2.1 Voces

| Lengua | Motor | Modelo |
|---|---|---|
| `es` | piper | **`es_ES-sharvard-medium`** («Sharvard» femenina, rhasspy/piper-voices) |
| `gl` | coqui | Celtia · Proxecto Nós (VITS de grafemas) |
| `eu` | ahotts | Maider · HiTZ/Aholab (respaldo Antton) |

En voces Piper multi-hablante elige explícitamente la **hablante femenina**
(`speaker_id_map` → primera clave que empiece por `f`/`female`/`muller`/`mujer`),
por paridad con Celtia.

### 2.2 El ritmo va POR ESTILO, no por voz

```python
LENGTH_SCALE = {"tutor": 1.0, "child": 1.05, "clinical": 1.15, "slow": 1.6}
```

Es el punto arquitectónico más importante y el que VIA+ perdió por completo. El
estilo ya viaja en el id de cada entrada del corpus
(`${style}_${hash}_${len}`), y Valeria lo usa para elegir el `length_scale`
nativo del VITS. El estilo se **hornea en la síntesis**, nunca con `atempo`
posterior: estirar el audio ya renderizado alarga también los silencios y añade
artefactos de resampleo (el defecto que motivó `make_coqui_synth` V2 en gallego).

### 2.3 Masterización

```python
PEAK_DBFS   = -3.0        # pico, no LUFS
AAC_BITRATE = "40k"
```

1. `to_s16_wav` → mono, PCM 16 bits.
2. (solo `ahotts`) `compress_internal_silence` — recorte de silencios **en
   Python**, por RMS por ventanas de 10 ms: los huecos INTERNOS de más de 280 ms
   se recortan a 150 ms y el silencio de borde se limita a 120 ms. Con dos
   salvaguardas notables: si no hay un hueco interno real de más de 250 ms **no
   reescribe el fichero**, de modo que los clips de una sola palabra quedan
   intactos; y nunca toca una muestra de voz, así que no puede dejar clics.
3. `normalize_peak` → escala a pico −3 dBFS con `audioop`.
4. `encode_m4a` → AAC 40k, `+faststart`.

### 2.4 Guarda anti-basura, y NO hay suelo de duración

Valeria descarta un ítem cuando la síntesis devuelve NaN/silencio o una duración
implausible (`0,12·palabras ≤ dur ≤ 3,0·palabras + 1,0`). El asset **no se
escribe**, de modo que la corrida siguiente lo reintenta.

Lo que Valeria **no** tiene es un suelo de duración por locución ni realentizado
por recorte. No le hace falta: su corpus son consignas habladas, no estímulos de
palabra aislada.

## 3. Correspondencia de componentes

| Rol | Valeria+ | VIA+ |
|---|---|---|
| Contrato de id | `src/valeriaVoiceCorpus.ts` | `src/Voice/voiceCorpusId.ts` |
| Exportador | `scripts/export-voice-corpus.js` | igual |
| Síntesis | `scripts/generate-voice-assets.py` (todo en uno) | `tools/nos/tts.py` + `scripts/synthesize-voice-corpus.js` + `scripts/verbal-assets.js` |
| Registro de voces | `VOICES` (dict en el script) | `tools/nos/voices.json` (declarativo) |
| Mapa id→asset | `scripts/build-voice-asset-map.js` | igual |
| Cobertura | `scripts/check-voice-corpus-coverage.js` | `scripts/check-verbal-coverage.js` |
| Manifiesto | `voice-assets-manifest.<lang>.json` | `assets/verbal-manifest*.json` |

## 4. Divergencias: cuáles son deliberadas y cuáles son deuda

### 4.1 Deliberadas (VIA+ es un audiómetro, Valeria no)

| Punto | Valeria | VIA+ | Por qué difiere |
|---|---|---|---|
| Normalización | pico −3 dBFS | `loudnorm I=-20:TP=-3:LRA=7` (LUFS) | La audiometría verbal **presenta a nivel calibrado**: la escala del adaptador presupone un RMS de referencia común entre idiomas. Dos recortes con el mismo pico pueden diferir mucho en sonoridad percibida; LUFS no. **No sustituir por normalización de pico sin rehacer la calibración de nivel.** |
| Bitrate AAC | 40k | 96k | Los estímulos de audiometría se juzgan por inteligibilidad; 40k es agresivo para material clínico. |
| Suelo de duración | no existe | 350 ms + realentizado por recorte con techo 3,6 | Los modelos hablados del T.A.R. y los estímulos verbales son **palabras aisladas para repetir o reconocer**. Por debajo de ese umbral el estímulo no mide lo que dice medir. Es un requisito clínico de VIA+ que Valeria no tiene por qué cumplir. |
| Registro de voces | dict en el script | `voices.json` declarativo + firma clínica por lengua | VIA+ es SaMD Clase IIa: la receta aprobada debe ser un artefacto versionado y firmable, no una constante en el código. |

### 4.2 Deuda pendiente (divergencias sin justificación)

1. **`length_scale` por estilo — NO IMPLEMENTADO.** VIA+ aplica un único
   `lengthScale` por voz y **ignora el `style` de la entrada**, aunque el estilo
   viaja en el id. Valeria usa `tutor 1.0 · child 1.05 · clinical 1.15 · slow 1.6`.
   Consecuencia hoy: todas las consignas castellanas se locutan al mismo ritmo,
   y las que el corpus marca como `slow` —pensadas para ir claramente más
   despacio— suenan igual que las demás. Es la divergencia de fondo que queda
   por cerrar.
2. **Selección de hablante femenina** en voces Piper multi-hablante: Valeria la
   hace, VIA+ no. Hoy no muerde porque sharvard es de hablante única, pero
   cualquier voz multi-hablante futura entraría por la 0 sin decidirlo.
3. **Versión de piper-tts.** Valeria usa la API `SynthesisConfig` +
   `synthesize_wav` (piper-tts ≥ 1.3); VIA+ fija `piper-tts==1.2.0` y llama a
   `synthesize(**kwargs)`. Funciona, pero son dos ramas de API distintas.
4. **Guarda anti-basura.** Valeria descarta y reintenta al siguiente run los
   ítems con salida NaN/silencio o duración implausible. VIA+ no comprueba
   NaN/silencio.

## 5. Reglas que se derivan de todo esto

1. **Una voz nueva declara su procedencia.** Cada entrada de `voices.json` lleva
   `origin`. Si no viene de Valeria, hay que decir de dónde viene y por qué.
2. **Una voz nueva se mide contra el suelo ANTES de firmarla.** La comprobación
   que habría descartado davefx el primer día son sus monosílabos. El pipeline
   registra ahora la duración del WAV *antes* del post-proceso junto a la del
   `.m4a`, que es lo que distingue «la voz viene corta» de «el post-proceso la
   recorta».
3. **Cambiar de receta regenera el idioma entero.** `assets/voice/recipe.json`
   anota motor + modelo + params por idioma; si no coincide con lo declarado, se
   regenera todo. Sin esto, cambiar de voz dejaba un banco con dos locutores
   mezclados y nada lo delataba en el diff.
4. **La firma clínica se anota DESPUÉS de comprobar el banco**, nunca antes.
