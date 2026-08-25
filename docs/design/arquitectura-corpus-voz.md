# Arquitectura de corpus de voz neuronal en VIA+ (es · gl · eu · es-DO)

> **Estado:** INFRAESTRUCTURA (v1). Capa `src/Voice/` portada del blueprint
> replicable de Valeria+ (`arquitectura-corpus-voz-nos-ilenia.json`, Proxecto
> Nós / ILENIA) y adaptada a la pila de VIA+ (React Native + `react-native-tts`
> + `react-native-audio-api`). Documentos hermanos: `integracion-proxecto-nos.md`
> (gallego), `integracion-quisqueya-habla.md` (dominicano) e
> **`integracion-valeria.md`** — este último contrasta línea a línea la receta
> de síntesis de Valeria+ con la de VIA+ y deja escrito qué divergencias son
> deliberadas y cuáles son deuda; léalo ANTES de tocar una voz.
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

> **Las dos filas de runtime estuvieron divergiendo, y eso costó caro.** Hasta
> la migración de agosto de 2026 esta tabla decía que VIA+ usaba
> `react-native-audio-api` donde Valeria+ usa `expo-audio`, y `react-native-tts`
> donde usa `expo-speech` — **sin dar ningún motivo**, y con el mismo formato
> que las filas que sí son portes literales. Presentadas así, las
> sustituciones parecían equivalentes y nadie las cuestionó nunca.
>
> No lo eran. `react-native-tts` devuelve la lista de voces truncada o vacía en
> silencio (comparación de referencias `country != ""` más `map.get()` sin
> comprobar null, con el `catch` fuera del bucle), y sobre esa lista colgaba una
> selección de voz que además funcionaba como PUERTA: sin voz verificada, la app
> dejaba de dictar en todos los módulos. El resultado en campo fue que Valeria+
> locutaba con voz neural en un emulador donde VIA+ estaba mudo.
>
> **Regla que deja esta historia:** una divergencia respecto al blueprint se
> anota CON SU MOTIVO en esta tabla, o no se hace. Una decisión sin
> justificación escrita no se revisa: se hereda.
>
> Divergencia que SÍ queda, y su motivo: `react-native-audio-api` se conserva
> para los tonos de las audiometrías (osciladores) y para la captura de PCM
> crudo del análisis acústico y la prosodia. `expo-audio` graba a fichero y no
> entrega bloques de muestras, así que no puede sustituirlo ahí. Valeria+ no
> tiene esa necesidad porque no hace análisis acústico.
>
> ⚠️ **Pendiente:** Expo SDK 54 fija `react-native: 0.81.5` en su
> `bundledNativeModules.json` (la versión de Valeria+) y VIA+ está en 0.80.1.
> `install-expo-modules` rechazó esa combinación y se forzó con
> `--sdk-version`. Igualar de verdad exige subir React Native a 0.81.5.

| Rol (blueprint Valeria) | Archivo en Valeria+ | Equivalente en VIA+ |
|---|---|---|
| Contrato de id | `src/valeriaVoiceCorpus.ts` (`voiceCorpusId`) | **`src/Voice/voiceCorpusId.ts`** |
| Definición del corpus (puro) | `src/valeriaVoiceCorpus.ts` | **`src/Voice/viaVoiceCorpus.ts`** + banco `src/Voice/viaVoiceConsignas.ts` |
| Exportador del corpus | `scripts/export-voice-corpus.js` | **`scripts/export-voice-corpus.js`** → `voice-corpus.json` |
| Generador de assets (síntesis) | `scripts/generate-voice-assets.py` | `tools/nos/tts.py` (Piper/Celtia) + ffmpeg — ver §5 |
| Mapa id→asset | `scripts/build-voice-asset-map.js` | **`scripts/build-voice-asset-map.js`** → `src/Voice/viaVoiceAssets.ts` |
| Reproductor runtime | `src/valeriaVoicePlayback.ts` (expo-audio) | **`src/Voice/viaVoicePlayback.ts`** (expo-audio) |
| Integración runtime | `src/valeriaVoice.ts` (expo-speech) | **`src/Voice/viaVoice.ts`** (expo-speech vía adaptador verbal) |
| Reconocimiento (T.A.R.) | `src/valeriaVoice.ts` (expo-speech-recognition) | **`src/Screens/Articulation/speechRecognitionBridge.ts`** (expo-speech-recognition) |
| Mapa generado | `src/valeriaVoiceAssets.ts` | **`src/Voice/viaVoiceAssets.ts`** (GENERADO) |
| Corpus serializado | `voice-corpus.json` | **`voice-corpus.json`** |
| Elección de la voz del sistema | `scoreVoice` en `src/valeriaVoice.ts` | **`src/Screens/VerbalAudiometry/verbalTtsVoice.ts`** (`scoreVoiceOf`) |

### 2 bis. La elección de voz DIVERGÍA, y era la divergencia que enmudecía la app

Registro del 25/8/2026, tras el informe de campo «la audiometría verbal y el
test de articulación siguen sin sonido».

Valeria+ y VIA+ puntúan las voces del sistema para quedarse con la mejor. La
diferencia estaba en **de dónde sacan si una voz necesita conexión**:

| | Valeria+ (funciona) | VIA+ (antes) |
|---|---|---|
| Señal usada | el **id** de la voz: `id.includes('local')` → +2, `id.includes('network')` → +1 | la bandera `networkConnectionRequired === false` → +1500 |
| ¿Existe esa señal? | Sí: el id es uno de los cuatro campos que `expo-speech` entrega | **No.** `VoiceRecord.kt` de expo-speech declara `identifier`, `name`, `quality` y `language`, y nada más |
| Efecto | gana la voz `-local` | la bandera era siempre `undefined`, el bonus **nunca se aplicó** y ganaba la voz `-network` (calidad Enhanced: 2000 contra 1200) |

Consecuencia: VIA+ elegía sistemáticamente la voz que se sintetiza **en
servidor**. Sin cobertura —el caso normal en el emulador de Android Studio—
Android emite `onError` por locución y no sale nada. La audiometría verbal
degrada al recorte tras dos fallos, pero el modelo hablado del T.A.R. es fuego
y olvido: se quedaba mudo sin degradar y sin avisar.

**Arreglado portando la disciplina de Valeria+**: `isOfflineVoice` lee el id, la
bandera del motor solo manda si existe, y los motores heredados
(`espeak`/`pico`/`compact`) pierden contra cualquier alternativa. Vigilado por
`verbalTtsVoice.test.ts`, en un bloque que construye las voces **con los cuatro
campos reales de expo-speech y ninguno más** — los tests anteriores fijaban
`networkConnectionRequired` a mano y por eso daban verde sobre una app muda
(regla 3: un mock que no respeta el contrato nativo no prueba nada).

### 2 ter. El servicio en primer plano de `react-native-audio-api` NO se declara

`AudioPlayer::start()` (Android) llama a `NativeAudioPlayer.start()`, que hace
`MediaSessionManager.startForegroundServiceIfNecessary()` →
`ContextCompat.startForegroundService(…, AudioForegroundService)`. El
`AndroidManifest.xml` de la librería está **vacío**: no declara ni el servicio
ni `FOREGROUND_SERVICE`, así que esa llamada es un no-op silencioso (Android
registra «Unable to start service … not found» y sigue).

**Divergencia deliberada, con su motivo:** declararlo arrancaría un servicio en
primer plano con notificación permanente en cuanto la app abre el contexto de
audio —VIA+ lo abre al arrancar y no lo suelta— y VIA+ no necesita controles de
pantalla de bloqueo. El no-op no afecta a la emisión de audio. **No verificado
en dispositivo**: si alguna vez hace falta reproducción en segundo plano, hay
que declarar el servicio con `foregroundServiceType="mediaPlayback"` y sus dos
permisos.

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
| `es` | Piper (VITS/ONNX) | `es_ES-sharvard-medium` | rhasspy/piper-voices | Referencia de Valeria+ |
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

**Tolerancia por idioma (portada de Valeria+).** La síntesis NO es todo o nada:
cada idioma se sintetiza por separado y su fallo no tira el lote. El resto se
commitea igual y el idioma que falta degrada a la voz del sistema, que es una
degradación declarada y funcional. Antes un fallo en el primer idioma del bucle
se llevaba por delante el trabajo de los demás. El job solo se declara fallido
si NO se sintetizó ningún idioma.

Ese diseño tiene dos mitades y hacen falta las dos:

+ en la **síntesis**, `scripts/check-verbal-coverage.js` es informativo — deja
  en el log qué idiomas quedaron locutados, sin cortar;
+ en el **empaquetado** (`android-release.yml`, antes de descifrar el
  keystore), el mismo chequeo con `--strict` sale con código 1: ahí una voz
  ausente no es una degradación aceptada, es un APK defectuoso.

El modo estricto no exige «todos los idiomas al 100 %», sino **coherencia con
`VERBAL_AUDIO_PENDING`**, la declaración revisada de qué idiomas se sabe que aún
no tienen locuciones propias y que la propia pantalla usa para advertir al
profesional. Falla en los dos sentidos:

+ un idioma **no** declarado pendiente al que le falten recortes — la app
  promete un estímulo locutado que no existe;
+ un idioma declarado pendiente que **ya** los tiene todos — el aviso de «el
  estímulo no es el definitivo» ha pasado a ser falso.

Es decir: cuando el workflow de voz sintetice el gallego, la release seguirá
fallando hasta que se saque `gl` de `VERBAL_AUDIO_PENDING`, que es exactamente
el momento en que hay que revisarlo.

**Degradación sin pesos:** `VOICE_TTS=espeak` locuta con la voz clásica
espeak-ng (es → `es`, es-DO → `es-419` LatAm); `gl` requiere el motor neural
(no hay voz espeak-ng fiable). El workflow CI
**`.github/workflows/voice-assets.yml`** (`workflow_dispatch` + push a
`claude/**`) ejecuta export → síntesis por idioma → rebuild del mapa → commit de
los assets a la rama (push con rebase, anti-bucle). Requiere el secret
**`HF_TOKEN`** (la voz Celtia es «gated» en Hugging Face). Los modelos JAMÁS
corren en el dispositivo; `main` está protegida y los assets entran por PR.

## 6. Runtime y cadena de degradación (P2)

### 6.0 La regla que gobierna todo lo demás: la voz es la del TEXTO

**La lengua de una locución es la lengua del TEXTO que se dice, no la de la
sesión.** La lengua de sesión solo decide QUÉ texto se elige.

Durante un tiempo esta capa hizo lo contrario: cada pantalla componía su texto
—casi siempre el castellano, porque es el único que tienen el T.A.R. y las
consignas de FE— y se lo pasaba a `speak()` junto con la lengua de SESIÓN. Con
una sesión gallega eso pedía voz gallega para un texto castellano. El resultado
en campo fue exactamente ese: **acento gallego leyendo castellano**, y tarjetas
que no se correspondían con lo que sonaba. La audiometría verbal se libraba
porque resolvía sus recortes por su cuenta (`verbalAssetsByLang.ts`) y ya
aplicaba la regla correcta.

La resolución vive en `viaVoiceLocale.ts` (módulo puro) y distingue:

| lengua de sesión | sin texto propio en el banco | resultado |
|---|---|---|
| `es-DO` (VARIANTE de `es`) | hereda el texto castellano | **voz dominicana** — misma lengua, otro acento |
| `gl`, `eu` (idiomas COMPLETOS) | no hereda | **texto y voz castellanos**, y la pantalla lo advierte |

`VOICE_LANG_BASE` declara esa relación (`es-DO → es`; `gl`, `eu` → `null`), y es
la misma que `VERBAL_BANK_BASE` usa en la audiometría verbal.

### 6.1 Cadena

`viaVoice.speakLocalized(style, textoPorLengua, lenguaDeSesión)` es la vía
recomendada: resuelve texto y voz a la vez con `resolveSpokenText` y delega en
`speak(style, text, langDelTexto)`, que resuelve en orden:

1. **asset neuronal de esa lengua** (`VOICE_ASSETS[voiceCorpusId(style,text,lang)]`);
2. **asset de su base, SOLO si es una variante** (`es-DO → es`): mismo idioma,
   otro acento. Un idioma completo **no** cruza al banco castellano;
3. **voz del sistema** (`react-native-tts`) vía el adaptador de la audiometría
   verbal ya registrado (no se duplica el motor ni la selección de voz);
4. **sin voz utilizable → silencio** (el clínico lee la consigna).

Mientras `VOICE_ASSETS` esté vacío (aún sin síntesis), `speak` cae siempre al
paso 3/4 → **comportamiento idéntico al actual, sin regresión**.

### 6.2 Un selector no puede ofrecer lo que el banco no tiene

`bankLangs(entradas)` deriva del CONTENIDO las lenguas que un banco cubre
enteras, y cada pantalla ofrece solo ésas: hoy `EF_CONSIGNA_LANGS` y
`TAR_MODEL_LANGS` son `['es', 'es-DO']`. Ofrecer gallego o euskera en pruebas
sin inventario propio era la promesa incumplida que originaba el desajuste; el
selector global del hub, que ofrecía las cuatro lenguas para toda la batería, se
ha retirado por lo mismo. Cuando se firme un delta, la lista crece sola.

## 7. Invariantes críticas

+ El módulo del corpus (`viaVoiceCorpus.ts` + `viaVoiceConsignas.ts`) permanece
  **PURO** (sin imports de RN/UI), o el exportador falla en build-time.
+ `voiceCorpusId` es idéntica en build y runtime (ambos importan la misma).
+ Los ids de la base `es` **no** llevan prefijo (retro-compat de assets).
+ Los modelos de IA nunca corren en el dispositivo: solo en build-time.
+ `src/Voice/viaVoiceAssets.ts` es **GENERADO**: no editar a mano.
+ Toda locución sin asset cae limpiamente a la voz del sistema; nunca silencio
  inesperado.
+ **La voz es la del texto (§6.0):** ninguna locución sale con la voz de una
  lengua distinta de aquella en la que está escrito lo que se dice. Un idioma
  completo sin recorte propio no se sirve con el recorte castellano. Fijado por
  `src/Voice/__tests__/viaVoiceLocale.test.ts`.
+ **Ninguna frase hablada se compone fuera de un banco:** si una pantalla arma
  un texto al vuelo, se queda sin lengua de sesión y sin síntesis neuronal (le
  pasaba a los anuncios de norma del juego de flexibilidad, ya incorporados como
  `EF_RULE_CONSIGNAS`).
+ **Traducir no es adaptar (P6):** las consignas `gl`/`es-DO` se localizan con
  revisión humana firmada (Nós M2 / Quisqueya Habla Q2); nada de traducción
  automática entra al corpus sin revisar. El material clínico (pares mínimos de
  la audiometría verbal) se REDISEÑA por lengua, no se traduce.

## 7 bis. El ritmo de la voz es un parámetro del motor, y se le pone puerta

La velocidad de locución no vive en el banco de estímulos: vive en el
`lengthScale` de la voz declarada en `tools/nos/voices.json`. Eso significa que
una voz mal parametrizada degrada **todo su banco a la vez y en silencio** —
nada falla, nada avisa, simplemente el estímulo deja de ser reconocible.

Ocurrió con el castellano. Medido sobre los 37 recortes comunes de la
audiometría verbal, generados todos con el mismo post-proceso y el mismo
`lengthScale = 1.1`:

| Banco | Voz | Duración media | Monosílabos |
|---|---|---|---|
| `es` (retirada) | Piper `es_ES-davefx-medium` | 0,454 s | «pan» 0,151 s · «ven» 0,175 s |
| `es-DO` | Piper `es_MX-claude-high` | 0,507 s | «pan» 0,386 s · «ven» 0,352 s |

El castellano era un 17 % más rápido de media y hasta 2,5 veces más rápido en
los monosílabos, que quedaban directamente atropellados. En una prueba de
RECONOCIMIENTO de palabra eso invalida el estímulo, y así se reportó desde
campo: «el castellano va demasiado deprisa; el resto está bien».

### Por qué el `lengthScale` global no bastaba

El primer intento fue subir el `lengthScale` del castellano de 1.1 a 1.35. No
sirvió, y merece la pena entender por qué, porque el fallo se repitió entero:

+ **La desviación no es uniforme.** davefx mantiene las polisílabas en un ritmo
  razonable y desploma las cortas. El factor que rescataría a «pan» (×2,3)
  dejaría el resto del banco arrastrándose.
+ **La puerta descartaba el banco entero.** Con 1.35, «pan» seguía en ~185 ms,
  por debajo del suelo: la generación fallaba, el workflow lo anotaba como
  «idioma fallido» con un simple aviso y en el árbol se quedaban **los recortes
  viejos**, que son justamente los atropellados. El arreglo no llegó nunca a los
  `.m4a` y el defecto sobrevivió a su propio parche sin que nadie viera un fallo
  en rojo (run del 29/07: `VERBAL_FAILED="es"`, conclusión *success*).
+ **El corpus general no tenía puerta ninguna.** Por ahí se colaron los modelos
  hablados del T.A.R.: «Tapa» 0,140 s, «Apto» 0,163 s. El módulo parecía no
  tener voz neuronal cuando lo que tenía era una inservible.

### Lo que se aplica ahora

1. El `lengthScale` de una voz es un parámetro **por voz**, no un valor que se
   copie entre modelos: cada modelo tiene su tempo natural. El castellano está
   en 1.35 como ritmo base.
2. `scripts/voice-clip-tempo.js` es el criterio **único** de los dos bancos
   (audiometría verbal y corpus general). Mide cada locución recién codificada
   y, si baja del suelo, la **re-sintetiza solo a ella** con el `lengthScale`
   justo para alcanzarlo (regla de tres sobre la duración medida, con techo en
   `VERBAL_MAX_LENGTH_SCALE`). El resto del banco conserva su ritmo. Solo falla
   si el techo no basta, y entonces el problema no es el ritmo sino la voz.
3. **RESUELTO — no era el ritmo, era el modelo. Se cambia la voz castellana.**
   El realentizado por recorte presupone que estirar el `lengthScale` alarga la
   locución en proporción, y con davefx no lo hacía: al techo de 3.6 «pan» solo
   llegaba a 221 ms desde 116 (estirar 2,7 veces alargaba 1,9), y para tocar los
   350 ms harían falta escalas de 5 a 8 — justo lo que el techo existe para
   impedir.

   Se persiguieron dos causas equivocadas antes de medir: el sorteo de ruido de
   Piper y el post-proceso de ffmpeg. La segunda quedó descartada con el dato
   que ahora registra el pipeline —la duración del WAV **antes** de post-procesar
   junto a la del `.m4a`—:

   ```
   es: «Apto» síntesis 163 ms → tras post-proceso 163 ms (se pierde -0 ms)
   es: «Tapa» síntesis 151 ms → tras post-proceso 151 ms (se pierde -0 ms)
   es: «pan»  síntesis 116 ms → tras post-proceso 117 ms (se pierde -1 ms)
   ```

   `loudnorm` y `silenceremove` no recortan nada. El WAV que sale de Piper ya son
   116 ms. La misma palabra con `es_MX-claude-high` sale a 386 ms por la misma
   cadena, así que nunca fue ffmpeg ni el ritmo: **`es_ES-davefx-medium` desploma
   los monosílabos** y no sirve para un banco de palabras aisladas.

   El castellano pasa a **`es_ES-sharvard-medium`**, la voz de referencia de
   Valeria+, cuyo corpus —bastante mayor que este— funciona con ella.

   Conviene no sacar de aquí la moraleja fácil. **No** es que «todas las voces
   vengan de Valeria»: solo el euskera (Maider) está documentado como portado de
   su registro; el gallego es de Proxecto Nós y el dominicano de Quisqueya
   Habla, elegidos en este proyecto, y los dos cumplen el suelo. Lo que falló
   con la castellana es que se eligió **sin contrastarla con la referencia y sin
   medir sus monosílabos contra el suelo**, que es la comprobación que la habría
   descartado el primer día. Por eso cada voz declara ahora su procedencia en
   el campo `origin` de `tools/nos/voices.json`: para que elegir una voz nueva
   obligue a decir de dónde sale.

   Sobre la semilla de Piper: `onnxruntime.set_seed` se sembraba **después** de
   `PiperVoice.load()`, y el kernel de ORT construye su generador al inicializar
   la sesión, así que no sembraba nada. Ya está en su sitio, pero **no dé el
   determinismo por comprobado**: con el mismo lote y el mismo commit se midió
   «pan» en 175 ms y en 117 ms. Queda pendiente de dos corridas idénticas.

4. **Un reintento nunca publica algo peor de lo que ya había.** El realentizado
   sobrescribe el `.m4a` en cada pasada; mientras el sorteo era libre, un
   intento podía salir por debajo del anterior y quedarse. Así acabó «Tapa»
   commiteada en 163 ms *después* de haber alcanzado 244 ms. `voice-clip-tempo`
   conserva ahora el mejor intento y restaura si el siguiente empeora.
5. **El corpus general publica por staging**, como ya hacía la audiometría
   verbal: codifica a un temporal y solo copia a `assets/voice` si pasa el
   suelo. Escribiendo directo, una corrida que no convergía dejaba en el árbol
   locuciones peores que las anteriores —y el workflow las commitea antes de
   evaluar el resultado—. Si falla, el árbol se queda como estaba.
6. El suelo son **350 ms**, tomados del banco es-DO de Quisqueya Habla, que es
   el que suena bien en campo: su recorte más corto son 376 ms.
7. La síntesis incremental deja de ser ciega: un recorte ya commiteado que esté
   por debajo del suelo entra en la lista de pendientes. Antes «existe, luego se
   salta» hacía inmortal a un recorte defectuoso.
8. `scripts/check-verbal-coverage.js --strict` —la puerta del empaquetado— ya no
   solo comprueba que las locuciones *estén*: comprueba que **no estén
   atropelladas**. Un recorte presente pero de 151 ms es peor que uno ausente,
   porque el ausente al menos degrada a la voz del sistema y este se presenta
   como estímulo válido.

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
