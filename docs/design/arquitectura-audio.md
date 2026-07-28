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

## Reglas para código nuevo

1. **Nunca** `new AudioContext(...)` fuera de `src/Audio`. Usa
   `acquireAudioContext()` / `releaseAudioContext()`.
2. Toda captura de micrófono envuelve su vida con `acquireRecordingSession()` y
   libera en el `stop`, no solo en el camino feliz.
3. Si no hay motor nativo, **no registres el adaptador**: así la pantalla puede
   avisar («no se emitirán tonos») en vez de aparentar que la prueba es válida
   mientras presenta silencio.

## Nota aparte: assets de audio en desarrollo

`decodeAudioDataSource()` solo abre **rutas locales**. En un build de
depuración, `Image.resolveAssetSource()` devuelve una URL `http://` del servidor
de Metro, que esa vía no sabe abrir — por eso las consignas habladas no sonaban
en Android Studio aunque el asset existiera. `viaVoicePlayback` descarga y
decodifica en memoria cuando la URI es remota (mismo orden de degradación que el
adaptador de la audiometría verbal, que ya lo hacía con base64).
