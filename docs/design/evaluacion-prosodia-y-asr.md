# Evaluación: módulo de análisis prosódico y reconocimiento de voz en el TAR

> Respuesta técnica a la propuesta *«Arquitectura del Módulo Acústico (VIA+)»*,
> contrastada contra el código que hay hoy en el repositorio.
>
> **Veredicto en una línea:** el módulo de prosodia **sí** debe construirse, pero
> en TypeScript sobre el DSP que ya existe —no con Python embebido—; y el
> reconocimiento de voz **no hay que integrarlo, porque ya está integrado y está
> roto**: son dos proyectos distintos, con riesgos regulatorios distintos.

---

## 0. Resumen ejecutivo

| Propuesta original | Veredicto | Motivo |
|---|---|---|
| **Hito 1** — ASR con `react-native-sherpa-onnx-stt` | ⚠️ **Replantear** | El ASR ya existe (`@react-native-voice/voice`) y tiene 3 defectos concretos. Sherpa resuelve uno solo de ellos, y a cambio rompe el principio rector «cero IA en el dispositivo» |
| **Hito 2** — Praat + DisVoice vía Chaquopy/BeeWare | ❌ **Descartar** | Contradice una decisión arquitectónica ya tomada y documentada. Las métricas ya son calculables con el DSP existente, validado contra Praat al decimal |
| **Hito 3** — Purga del `.wav` (`fs.unlink`) | ✅ **Aceptar y priorizar** | Es un hueco de conformidad **real y presente**: hoy el `.wav` del T.A.R. no se borra nunca |
| **Módulo de prosodia como tal** | ✅ **Aceptar, con otro alcance** | Buena idea clínica, pero necesita una **toma de habla conectada** que hoy no existe en ninguna pantalla |

---

## 1. Lo que la propuesta no sabe que ya está construido

El documento parte de un supuesto de partida en verde («dotar al T.A.R. de
capacidades de ASR y extracción de prosodia»). El repositorio dice otra cosa.

### 1.1 El ASR ya está integrado en el TAR

`src/Screens/Articulation/articulationAudio.ts` ya monta el reconocimiento
completo: resolución perezosa de la librería, mapa de locales BCP-47
(`es-ES`, `es-DO`, `gl-ES`, `eu-ES`), reintento en la lengua base cuando el
dispositivo no trae el modelo, gestión de permisos, degradación a SODA manual y
comparación automática contra la palabra objetivo.

```ts
// articulationAudio.ts:217
const voiceMod = resolveLib(RN_VOICE, '@react-native-voice/voice');
```

No es un esqueleto: son ~450 líneas con el ciclo de vida resuelto y el módulo
declarado como operativo en el README (módulo 9).

### 1.2 El motor acústico ya existe, en TypeScript puro y validado contra Praat

`src/Screens/VoiceAnalysis/voiceDsp.ts` (≈900 líneas) implementa ya, sin una
sola dependencia nativa:

- **F0** por autocorrelación normalizada, banda 70–500 Hz, con interpolación
  parabólica del vértice.
- **HNR** derivado del pico de autocorrelación, con techo declarado (30 dB).
- **Jitter / shimmer** sobre los contornos de F0 y RMS.
- **Formantes F1–F3** por LPC orden 20 (Levinson-Durbin) + picos de envolvente.
- **Acondicionado**: FIR anti-alias de 33 coeficientes, decimación ×3 de
  48→16 kHz, y pasa-alto Butterworth de 2.º orden a 55 Hz.
- **Detección de sonoridad** por umbrales de RMS y periodicidad.

Y `analysePcm()` **ya devuelve los vectores por trama** —`f0s[]`, `frameRms[]`,
`hnrs[]`, `stats.voicedFrames`— que son exactamente la materia prima de la
prosodia.

### 1.3 Praat y DisVoice ya están en el proyecto — en build-time, por decisión explícita

Esto es lo que invalida el Hito 2. `tools/acoustics/` ya usa **parselmouth**, y
`.github/workflows/acoustic-validation.yml` ya lo corre como puerta de CI. El
README de esa herramienta lo dice sin ambigüedad:

> Es una herramienta de **build-time**, igual que `tools/nos/`: los modelos y
> librerías de análisis **no entran nunca en el dispositivo**.

Y el README principal lo eleva a principio rector del producto:

> ### Principio rector: cero IA en el dispositivo
> En runtime la app únicamente reproduce ficheros ya empaquetados […] VIA+ no
> incorpora inferencia de IA como parte del dispositivo médico.

La propuesta plantea meter en el dispositivo justamente las dos cosas que esa
doctrina mantiene fuera. No es un detalle de implementación: es la línea
argumental con la que VIA+ sostiene su expediente MDR.

Además, el banco ya demostró su valor: encontró cuatro defectos reales en la
primera pasada (orden LPC insuficiente, techo de HNR sin declarar, un caso de
prueba mal construido, y confirmó el acondicionado de baja frecuencia). El
estado actual es **F0 coincidente con Praat al decimal (Δ = 0.0 Hz)**.

> Dicho de otro modo: no hace falta llevar Praat al móvil para tener la exactitud
> de Praat en el móvil. Ya se tiene, y se demuestra en cada PR.

---

## 2. Defectos presentes en el ASR del T.A.R. (hallazgos de esta evaluación)

El reconocimiento existe, pero hay tres cosas que hoy no funcionan o no cumplen.

### 2.1 🔴 iOS: falta `NSSpeechRecognitionUsageDescription` → la app termina

`ios-native/VIAPlus/Info.plist` declara `NSMicrophoneUsageDescription` pero
**no** `NSSpeechRecognitionUsageDescription`. iOS termina el proceso (SIGABRT)
en cuanto se solicita autorización a `SFSpeechRecognizer` sin esa clave. El
reconocimiento del T.A.R. en iOS no está degradado: está muerto, y además es
rechazo seguro en App Store review.

### 2.2 🔴 Android: falta `<queries>` para el servicio de reconocimiento

`targetSdkVersion = 35` (> 30), así que aplica el filtrado de visibilidad de
paquetes. Sin declarar en el manifiesto:

```xml
<queries>
  <intent><action android:name="android.speech.RecognitionService" /></intent>
</queries>
```

…`SpeechRecognizer` no puede enlazar con el servicio. Esto explica
probablemente buena parte del «el reconocimiento de voz no funciona» que ya
motivó comentarios extensos en el propio fichero.

### 2.3 🔴 Zero-PHI: la voz del niño puede salir del dispositivo

Este es el hallazgo grave, y es el **único argumento sólido a favor de Sherpa**.

Los reconocedores del sistema son, por defecto, **de servidor**:
`SFSpeechRecognizer` no fuerza `requiresOnDeviceRecognition`, y
`SpeechRecognizer` de Android sin `EXTRA_PREFER_OFFLINE` enruta a Google. La app
declara `android.permission.INTERNET`. Nada en `articulationAudio.ts` pide modo
offline.

Consecuencia: **la voz de un menor —dato biométrico— puede viajar a Apple o
Google en el módulo T.A.R.**, mientras el propio `Info.plist` le promete al
usuario lo contrario:

> «Las grabaciones se procesan en el dispositivo.»

Esa frase es hoy falsa para la ruta del T.A.R. Es una inconsistencia entre la
información al usuario y el comportamiento real del producto, en un SaMD Clase
IIa y con sujetos menores de edad. Debe resolverse con independencia de lo que
se decida sobre prosodia.

### 2.4 🟠 El `.wav` del T.A.R. no se borra nunca

No hay una sola llamada a `unlink` en todo `src/`. `toggleRecording()` guarda el
`audioUri` de `react-native-audio-recorder-player` y `reset()` se limita a
ponerlo a `null`: **el fichero queda en el almacenamiento de la app**
indefinidamente. El Hito 3.3 de la propuesta está bien visto y debería ir
primero, no al final.

> Contraste interesante: el módulo `VoiceAnalysis` **ya lo hace bien**. Su
> adaptador (`voiceMicAdapter.ts`) captura PCM en memoria vía
> `react-native-audio-api` y **nunca escribe un fichero**. Zero-PHI por diseño,
> no por limpieza posterior. El T.A.R. debería converger a ese patrón.

---

## 3. Por qué el ASR genérico es la herramienta equivocada para puntuar articulación

Aun resolviendo lo anterior, hay un problema de fondo que la propuesta no
aborda: **un ASR de palabras destruye justo la señal que el T.A.R. mide.**

El T.A.R. clasifica SODA: Correcto / **S**ustitución / **O**misión /
**D**istorsión / **A**dición. Eso son desviaciones *sublexicales*. Un ASR de
propósito general lleva un modelo de lenguaje cuyo trabajo explícito es
normalizar hacia la palabra de diccionario más próxima:

- Un niño que dice **«tato»** por «gato» se transcribe muy probablemente
  «gato» → el ASR **borra la sustitución** y la puntúa como correcta.
- Una **distorsión** (una /s/ interdental, una /r/ mal vibrada) produce la misma
  cadena de caracteres que la producción correcta → la categoría **D es
  literalmente invisible** a la transcripción.
- La comparación actual es contención de cadenas:

  ```ts
  // articulationAudio.ts — matchesTarget
  const present = tokens.filter(tk => h.includes(tk)).length;
  ```

  Sobre texto ya normalizado (sin tildes, sin signos). Sirve como ayuda de
  cribado; no como medida clínica.

`whisper-small` es el peor candidato posible aquí: es el modelo con el LM más
pesado y con tendencia documentada a alucinar sobre audio corto y atípico —y el
habla infantil con trastorno fonológico es exactamente eso. Además, cuantizado
sigue rondando cientos de MB, contra un `Zipformer` de ~80–100 MB.

**Lo que el T.A.R. necesita no es ASR, es alineamiento forzado a nivel de
fonema** (posteriorgramas / *Goodness of Pronunciation*): decodificar contra un
léxico fonético **sin modelo de lenguaje**, para que la salida conserve lo que el
niño produjo en vez de lo que debería haber producido. Eso es factible con
Zipformer CTC, pero es un proyecto de investigación con validación clínica
propia —no un hito de integración de librería.

---

## 4. Por qué Chaquopy / BeeWare no es viable aquí

Más allá de que contradice la doctrina del proyecto:

1. **Asimetría de plataforma.** Chaquopy es solo Android. Embeber CPython en una
   app React Native de iOS vía BeeWare no es una ruta soportada en producción.
   El resultado realista es **una métrica clínica que existe en Android y no en
   iOS**. Para un producto MDR eso significa comportamiento clínico divergente
   entre plataformas: o dos validaciones, o una funcionalidad que no se puede
   declarar.
2. **Peso y superficie.** CPython + `numpy` + `scipy` + `praat-parselmouth`
   añade decenas de MB por ABI, un segundo *runtime* al expediente técnico y al
   SBOM, y una superficie de CVE que CodeQL (ya configurado en el repo) no
   cubre igual dentro de un APK.
3. **Coste de build.** El propio documento reconoce el problema al pedir caché
   agresivo y temer *timeouts* en GitHub Actions. Es una señal: el plan pelea
   contra la infraestructura en lugar de apoyarse en ella.
4. **Coste/beneficio.** Semanas de ingeniería de compilación para obtener unas
   métricas que son del orden de **300 líneas de TypeScript** sobre vectores que
   `analysePcm()` ya devuelve.

---

## 5. Propuesta alternativa

### 5.1 Módulo de prosodia — en TypeScript, sobre el DSP existente

Todas las métricas prosódicas relevantes en logopedia pediátrica se derivan de
lo que el motor actual ya produce por trama:

| Métrica | Derivación | Insumo actual |
|---|---|---|
| Tasa de habla / articulación | sílabas o núcleos vocálicos por segundo, con y sin pausas | `frameRms[]`, `voicedFrames` |
| Nº y duración de pausas | rachas de tramas bajo `SILENCE_RMS` | `frameRms[]` |
| Rango tonal (semitonos) | percentiles 5–95 de `f0s[]` en escala log | `f0s[]` |
| Variabilidad de F0 | SD en semitonos (independiente del sexo/edad) | `f0s[]` |
| Contorno final | pendiente de F0 en el último segmento sonoro (ascenso/descenso) | `f0s[]` |
| Variación de intensidad | SD del RMS en dB sobre tramas sonoras | `frameRms[]` |
| Fracción sonora | `voicedFrames / totalFrames` | `stats` |

Ninguna requiere nada que no esté ya en el dispositivo.

**Y se valida gratis:** basta extender `tools/acoustics/fixtures.js` y
`validate.py` para contrastar las nuevas métricas contra Praat/DisVoice en CI,
igual que ya se hace con F0, HNR y formantes. El módulo de prosodia nacería con
un oráculo de validación desde el primer commit —algo que la ruta Chaquopy no
da, porque allí Praat es el motor, no el juez.

### 5.2 ⚠️ Lo que falta y nadie ha mencionado: la toma de habla conectada

Este es el hueco de alcance más importante de la propuesta.

**La prosodia necesita habla continua: 20–60 s de lectura o habla espontánea.**
Y hoy VIA+ no captura eso en ningún sitio:

- `VoiceAnalysis` captura una **/a/ sostenida** — por definición sin prosodia
  (sin pausas, sin contorno, sin ritmo).
- El T.A.R. captura **repeticiones de palabra aislada**, típicamente < 1 s —
  demasiado corto para cualquier métrica de ritmo o pausa.

Enganchar prosodia al T.A.R., como plantea el diagrama de la propuesta, produce
métricas calculables pero **clínicamente vacías**. El módulo de prosodia necesita
**su propia pantalla y su propia tarea** (lámina descriptiva por edad, o texto
de lectura para los que ya leen), su entidad `ProsodyAnalysis` con migración, y
su bloque de PDF. Eso es lo que hay que planificar, y no aparece en el documento.

### 5.3 ASR — separar en dos proyectos con riesgos distintos

**Proyecto A — Saneamiento (días, no semanas). Sin discusión arquitectónica:**

1. Añadir `NSSpeechRecognitionUsageDescription` al `Info.plist` (§2.1).
2. Añadir `<queries>` para `android.speech.RecognitionService` (§2.2).
3. Forzar reconocimiento **on-device**: `requiresOnDeviceRecognition` en iOS y
   `EXTRA_PREFER_OFFLINE` en Android; y si el dispositivo no lo soporta,
   **degradar a SODA manual antes que enviar audio a un servidor**. El módulo ya
   tiene toda la maquinaria de degradación construida: es aplicarla a un caso
   más (§2.3).
4. Purgar el `.wav` tras procesarlo, o mejor, migrar el T.A.R. al patrón de PCM
   en memoria de `voiceMicAdapter` (§2.4).
5. Corregir la redacción del `NSMicrophoneUsageDescription` para que sea cierta.

**Proyecto B — Puntuación fonética (investigación).** Evaluar Zipformer CTC con
léxico fonético y decodificación sin LM para *scoring* a nivel de fonema. Exige
decisión previa del responsable regulatorio sobre si eso rompe «cero IA en el
dispositivo» y qué añade al expediente MDR. **No debe bloquear al Proyecto A ni
al módulo de prosodia.**

---

## 6. Lo que la propuesta acierta

Para no dejar solo la crítica:

- **El diagnóstico clínico es correcto.** La prosodia es un dominio real y
  ausente en la batería; añadirlo tiene sentido.
- **La purga de audio (Hito 3.3)** es un hallazgo válido y presente.
- **No subir modelos a Git / evitar LFS** es la política correcta, y de hecho es
  la que el repo ya sigue con `tools/nos/`.
- **Aislar features en PRs independientes** coincide con las convenciones de
  contribución del proyecto.
- **La preocupación por la latencia y el consumo** está bien orientada, aunque
  la respuesta correcta resulte ser «no meter un segundo runtime» en lugar de
  «cachear su compilación».

---

## 7. Recomendación

1. **Ahora — Proyecto A (saneamiento del ASR + purga de audio).** Riesgo de
   conformidad presente, coste bajo, ninguna decisión arquitectónica pendiente.
2. **A continuación — módulo de prosodia en TypeScript**, con pantalla de toma de
   habla conectada propia, extendiendo `voiceDsp.ts` y el banco de validación
   contra Praat.
3. **Después, y por separado — Proyecto B (scoring fonético)**, previa decisión
   regulatoria sobre inferencia en el dispositivo.
4. **Descartar** Chaquopy / BeeWare / DisVoice en runtime.

El resultado clínico que persigue la propuesta se alcanza igual. La diferencia
es que se alcanza sin abrir un segundo runtime, sin partir el comportamiento
entre Android e iOS y sin desmontar el argumento «cero IA en el dispositivo» con
el que VIA+ sostiene hoy su expediente.
