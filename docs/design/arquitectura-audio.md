# Arquitectura de audio de VIA+

> Un solo motor de audio para toda la app. Este documento explica por qué, y
> qué fallo de campo corrigió.

## El problema

Los módulos de audio de VIA+ (audiometría tonal e infantil, audiometría verbal,
consignas habladas de los ejercicios y reproducción de las tomas del análisis
acústico) creaban **cada uno su propio `AudioContext`** de
`react-native-audio-api`.

Un `AudioContext` de esa librería no es un objeto ligero: abre un *stream* de
salida nativo en el constructor y lo arranca inmediatamente.

- **Android** (`AudioPlayer.cpp`): abre un stream de Oboe con
  `SharingMode::Exclusive`. En exclusiva el dispositivo tiene **un** dueño: el
  segundo stream falla al abrir, `isInitialized_` queda en `false`, `start()`
  devuelve `false` … y **nadie mira ese valor de retorno**. El contexto queda
  mudo para siempre sin lanzar ninguna excepción en JS.
- **iOS** (`NativeAudioPlayer.m`): los contextos comparten un `AVAudioEngine`,
  pero cada `start()` **para el motor** para reconectar sus nodos, cortando lo
  que estuviera sonando en los demás.

Como la app abría dos contextos ya en el arranque (`installAudiometryToneAdapter`
y `installVerbalAudioAdapter`, uno detrás de otro en `App.tsx`) y otros dos más
tarde bajo demanda, **cuál se quedaba el altavoz dependía del orden de montaje**.
De ahí el patrón de síntomas reportado en campo:

- «la audiometría infantil no suena»,
- «la audiometría verbal no funciona»,
- «no hay sonido en ninguno de los ejercicios»,
- «el sonómetro a veces no funciona».

Todos eran la misma causa vista desde módulos distintos. El propio `App.tsx`
llevaba un comentario avisando de no montar «ningún provider que cree un
segundo AudioContext»: el aviso era correcto, pero la app ya lo estaba
incumpliendo por dentro.

## La solución: `src/Audio`

`src/Audio/sharedAudioContext.ts` es ahora el **único** punto de la app que
construye un `AudioContext`.

```ts
const ctx = acquireAudioContext();   // crea el stream en la 1.ª reserva
…
releaseAudioContext();               // solo cierra cuando no queda nadie
```

- **Recuento de referencias.** N consumidores comparten un contexto; cerrar la
  pantalla de un módulo no silencia a los demás.
- **`resumeAudioContext()`.** Un contexto suspendido (interrupción de llamada,
  cambio de ruta de audio, vuelta de segundo plano) reproduce silencio *sin dar
  error*. Se llama antes de programar cada estímulo.
- **Sesión de audio centralizada.** `playback` por defecto; los módulos que
  graban piden `acquireRecordingSession()` y la sesión vuelve sola a
  reproducción cuando se suelta la última petición. Antes cada adaptador la
  reconfiguraba por su cuenta y salir del sonómetro a media medición dejaba la
  sesión en `playAndRecord`, con la salida atenuada en iOS.

Consumidores: `audiometryToneAdapter`, `verbalAudiometryAudio`,
`viaVoicePlayback` (consignas de los ejercicios) y `voiceMicAdapter`
(reproducción de tomas). El contrato está fijado en
`src/Audio/__tests__/sharedAudioContext.test.ts`.

## El lado de la ENTRADA: `sharedAudioRecorder`

El micrófono tiene el mismo problema y **uno peor**. `AudioRecorder` abre su
stream de Oboe (también `SharingMode::Exclusive`) en el **constructor**, no
expone `close()` en JS y el constructor nativo **ignora el resultado de
`openStream`**: si la apertura falla, el objeto se construye igual, `start()` no
hace nada, no lanza y el micrófono simplemente no entrega audio. El stream solo
se cierra en el destructor de C++, es decir cuando el recolector de basura de JS
libera el *host object* — cuando le parece.

Dos decisiones se derivan de ahí, y las dos son la corrección de un fallo de
campo (*«grabo, guarda el audio y luego dice captura insuficiente»*):

- **Singleton de proceso.** El recorder se crea una vez y **no se suelta nunca**.
  La versión anterior soltaba la referencia al bajar el recuento de reservas a
  cero, «para que el GC cierre el stream»; pero el GC no corre a demanda, así que
  ir del T.A.R. al análisis de voz —o de la voz a la prosodia— construía un
  recorder nuevo con el anterior todavía abierto en exclusiva. El módulo entrante
  capturaba silencio sin ningún error, y el fallo parecía aleatorio porque
  dependía del **orden de visita a los módulos**. Al quedarse sin consumidores el
  recorder se **para**, que es lo que libera la captura; el stream queda abierto
  y listo para la toma siguiente.
- **No se abre sin permiso.** `acquireRecorder()` ya **no construye nada**: solo
  comprueba que el binario trae motor de captura. El objeto nativo se crea en el
  primer `start()` y solo con el permiso confirmado
  (`setRecorderPermissionGranted`). Antes el T.A.R. pedía el micrófono al montar
  la pantalla, o sea antes de solicitar `RECORD_AUDIO`: Oboe no podía abrir la
  entrada, el objeto quedaba cacheado sin stream y —al ser compartido— **el
  análisis de voz y el de prosodia heredaban un micrófono muerto**.

Si aun así una toma de duración razonable termina sin **un solo bloque**, la
instancia se marca como sospechosa y la siguiente la reconstruye. `recorderHealth()`
distingue `no-permission`, `no-engine` y `silent`, y las pantallas lo usan para
decir la causa en vez de un «no se capturó nada» genérico.

## Reglas para código nuevo

1. **Nunca** `new AudioContext(...)` fuera de `src/Audio`. Usa
   `acquireAudioContext()` / `releaseAudioContext()`.
2. **Nunca** `new AudioRecorder(...)` fuera de `src/Audio`. Usa
   `acquireRecorder()`, y **pide el micrófono cuando vayas a grabar**, no al
   montar la pantalla: abrirlo sin permiso lo deja muerto para toda la app.
3. Todo módulo que pida `RECORD_AUDIO` avisa con `setRecorderPermissionGranted()`
   **antes** de arrancar la primera toma.
4. Toda captura de micrófono envuelve su vida con `acquireRecordingSession()` y
   libera en el `stop`, no solo en el camino feliz.
5. Si no hay motor nativo, **no registres el adaptador**: así la pantalla puede
   avisar («no se emitirán tonos») en vez de aparentar que la prueba es válida
   mientras presenta silencio.

## Visibilidad de paquetes en Android (`<queries>`)

Dos servicios del sistema de los que depende el audio de VIA+ son **servicios
enlazados**, y con `targetSdkVersion ≥ 30` el filtrado de visibilidad de
paquetes los oculta salvo que el manifiesto los declare:

| Servicio | Qué se queda sin él |
|---|---|
| `android.speech.RecognitionService` | El reconocimiento del T.A.R. («modo limitado» permanente). |
| `android.intent.action.TTS_SERVICE` | **Toda** la voz del sistema: modelo hablado del T.A.R., consigna del módulo de prosodia, consignas de FE. |

El segundo faltaba, y por eso *«el T.A.R. no suena»*: `TextToSpeech` no enlazaba
con ningún motor, la inicialización devolvía ERROR, `voices()` salía vacío y
`speak()` no emitía — **sin ninguna señal en JS**. La audiometría verbal se
salvó por reproducir recortes empaquetados (`preferTts: false`), y esa asimetría
es la que hizo que el fallo pareciera de un módulo y no de la app. Ninguna de las
dos librerías lo declara en su propio manifiesto. Vigilado en
`scripts/__tests__/nativeAudioConfig.test.js`.

## Nota aparte: assets de audio en desarrollo

`decodeAudioDataSource()` solo abre **rutas locales**. En un build de
depuración, `Image.resolveAssetSource()` devuelve una URL `http://` del servidor
de Metro, que esa vía no sabe abrir — por eso las consignas habladas no sonaban
en Android Studio aunque el asset existiera. `viaVoicePlayback` descarga y
decodifica en memoria cuando la URI es remota (mismo orden de degradación que el
adaptador de la audiometría verbal, que ya lo hacía con base64).
