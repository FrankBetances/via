import { Buffer } from 'buffer';

import {
  acquireAudioContext,
  acquireRecorder,
  acquireRecordingSession,
  isAudioEngineAvailable,
  isOutputDriverRunning,
  isRecordingSessionActive,
  recorderHealth,
  recoverAudioContext,
  releaseAudioContext,
  resumeAudioContext,
  setRecorderPermissionGranted,
  type RecorderHealth,
} from '@/Audio';
import { nativeRecognitionProbe } from '@/Screens/Articulation/articulationAudio';
import {
  probeRecognitionCaps,
  recognitionBlockLabel,
  resolveRecognitionMode,
} from '@/Screens/Articulation/articulationRecognition';
import type { TtsPhase } from '@/Screens/VerbalAudiometry/verbalAudiometryAudio';
/* Import de los MÓDULOS HOJA, no del barril `@/Screens/VerbalAudiometry`: el
 * barril reexporta la pantalla, y con ella react-redux y gluestack. Cargarlo
 * aquí metía toda la interfaz de la audiometría verbal dentro del diagnóstico
 * (y rompía sus tests). */
import { registeredVerbalAssets } from '@/Screens/VerbalAudiometry/verbalAssets';
import { verbalAudioBase64ForLang } from '@/Screens/VerbalAudiometry/verbalAssetsByLang';
import {
  VOICE_ASSETS,
  VOICE_ASSETS_VERSION,
  probeSystemVoice,
  probeVoiceAsset,
  stopVoiceAsset,
  voiceAudioModeStatus,
  voiceStatus,
} from '@/Voice';

/* -------------------------------------------------------------------------- */
/*  Comprobación de audio EN EL DISPOSITIVO.                                   */
/*                                                                             */
/*  POR QUÉ EXISTE                                                             */
/*  Toda la capa de audio de VIA+ está diseñada para DEGRADAR EN SILENCIO: si  */
/*  no hay motor nativo, si el permiso no está concedido, si el stream de      */
/*  entrada no abre o si el sintetizador del sistema no enlaza, la app sigue   */
/*  funcionando y no suena nada. Es lo correcto en consulta —una prueba no     */
/*  debe reventar delante del niño— pero deja al profesional sin forma de      */
/*  saber POR QUÉ no se oye nada ni por qué una toma sale «insuficiente», y a  */
/*  quien mantiene el código sin nada que mirar salvo un `console.warn` que en */
/*  un APK de release no ve nadie.                                             */
/*                                                                             */
/*  Este módulo recorre la cadena entera eslabón a eslabón y devuelve un       */
/*  veredicto por cada uno. No repara nada: NOMBRA lo que está roto.           */
/*                                                                             */
/*  Cada comprobación es independiente y ninguna lanza: un eslabón roto debe   */
/*  dejar que se midan los siguientes, que es justo lo que distingue «no hay   */
/*  motor de audio» de «el motor está pero el micrófono no entrega muestras».  */
/* -------------------------------------------------------------------------- */

export type CheckStatus = 'ok' | 'warn' | 'fail' | 'skip';

/** Frase de prueba del sintetizador (corta: el profesional la oye entera). */
export const TEST_PHRASE = 'Uno, dos, tres. Comprobación de voz de VIA más.';

export interface CheckResult {
  /** Identificador estable (no se traduce; va en el resumen copiable). */
  id: string;
  /** Nombre del eslabón, tal y como lo lee el profesional. */
  label: string;
  status: CheckStatus;
  /** Qué se ha medido, en una línea. */
  detail: string;
  /** Qué hacer si está roto. */
  hint?: string;
}

/* Metro exige literales en `require(...)`; opcional para que los targets sin
 * el módulo nativo (y los tests) sigan compilando. */
const optionalAudioApi = (): any => {
  try {
    return require('react-native-audio-api');
  } catch (_e) {
    return null;
  }
};

/** Frecuencia y duración del tono de prueba de salida. */
export const TEST_TONE_HZ = 1000;
export const TEST_TONE_MS = 900;

/** Duración de la toma de prueba del micrófono. */
export const CAPTURE_PROBE_MS = 3000;

/* -------------------------------------------------------------------------- */
/*  Lógica PURA (probada sin módulo nativo)                                    */
/* -------------------------------------------------------------------------- */

/** Pico de una señal PCM en dBFS. `-Infinity` si la señal es exactamente 0. */
export const peakDbfs = (pcm: Float32Array): number => {
  let peak = 0;
  for (let i = 0; i < pcm.length; i++) {
    const v = Math.abs(pcm[i]);
    if (v > peak) peak = v;
  }
  return peak > 0 ? 20 * Math.log10(peak) : -Infinity;
};

/** Nivel eficaz (RMS) de una señal PCM en dBFS. */
export const rmsDbfs = (pcm: Float32Array): number => {
  if (!pcm.length) return -Infinity;
  let sum = 0;
  for (let i = 0; i < pcm.length; i++) sum += pcm[i] * pcm[i];
  const rms = Math.sqrt(sum / pcm.length);
  return rms > 0 ? 20 * Math.log10(rms) : -Infinity;
};

const fmtDb = (db: number): string => (Number.isFinite(db) ? `${db.toFixed(1)} dBFS` : 'silencio absoluto');

/**
 * Nivel del bloque más flojo y del más fuerte de la toma. Es la medida que
 * responde a «¿RESPONDE el micrófono?», que no es lo mismo que «¿entrega
 * bloques?»: una entrada nivelada por el sistema (AGC) o encaminada a un
 * dispositivo que no capta la sala entrega bloques perfectamente y devuelve
 * SIEMPRE el mismo nivel, acerque uno el micrófono o lo cambie por otro. Con
 * un solo número medio esa avería es indistinguible de un micrófono sano.
 */
export interface CaptureSpan {
  /** RMS del bloque más flojo, en dBFS. */
  minRmsDb: number;
  /** RMS del bloque más fuerte, en dBFS. */
  maxRmsDb: number;
}

/** Recorrido dinámico de la toma en dB (`null` si no se midió). */
const spanDb = (span?: CaptureSpan): number | null => {
  if (!span || !Number.isFinite(span.maxRmsDb) || !Number.isFinite(span.minRmsDb)) return null;
  return span.maxRmsDb - span.minRmsDb;
};

/**
 * Por debajo de este recorrido la toma es sospechosa de estar nivelada por el
 * sistema. Hablar y callar delante de un micrófono sano mueve el nivel eficaz
 * bastante más de 6 dB; un AGC lo aplana a unos pocos.
 */
export const MIN_RESPONSIVE_SPAN_DB = 6;

/**
 * Veredicto de una toma de prueba del micrófono. Separa los TRES casos que la
 * app confundía bajo un único «captura insuficiente», y que son problemas
 * completamente distintos:
 *
 *   · 0 bloques  → el stream de entrada no llegó a abrirse. No es que el niño
 *                  no hablara: el micrófono no entregó NADA. Culpa del motor,
 *                  del permiso o de otra app que tiene la entrada tomada.
 *   · bloques con silencio absoluto → el stream entrega, pero todas las
 *                  muestras son cero: entrada silenciada por el sistema o
 *                  encaminada a un dispositivo que no capta.
 *   · bloques con señal → el micrófono FUNCIONA. Si aun así una prueba dice
 *                  «insuficiente», el problema está aguas abajo.
 */
export const describeCapture = (
  blocks: number,
  samples: number,
  peak: number,
  rms: number,
  health: RecorderHealth,
  span?: CaptureSpan,
): CheckResult => {
  const base = { id: 'mic-capture', label: 'Captura real del micrófono' } as const;

  if (blocks === 0) {
    return {
      ...base,
      status: 'fail',
      detail: `El micrófono no entregó NI UN bloque en ${CAPTURE_PROBE_MS / 1000} s (estado del motor: ${health}).`,
      hint:
        health === 'no-permission'
          ? 'El permiso de micrófono no está concedido. Ajustes ▸ VIA+ ▸ Permisos ▸ Micrófono.'
          : health === 'no-engine'
            ? 'Este binario no incorpora el motor de captura: hay que reinstalar la app con una compilación completa.'
            : 'El stream de entrada no abrió. Cierre cualquier otra aplicación que use el micrófono (llamadas, grabadora, videoconferencia) y repita.',
    };
  }

  if (!Number.isFinite(peak)) {
    return {
      ...base,
      status: 'fail',
      detail: `Llegaron ${blocks} bloques (${samples} muestras) pero TODAS valen cero.`,
      hint: 'El sistema está entregando silencio digital: micrófono silenciado, o entrada encaminada a un accesorio que no capta. Revise el encaminamiento de audio y los accesorios Bluetooth.',
    };
  }

  // −60 dBFS es el suelo de una sala silenciosa con un micrófono sano; por
  // debajo, la señal no da para medir aunque el stream esté vivo.
  const usable = peak > -60;
  const rangeDb = spanDb(span);
  const detail =
    `${blocks} bloques · ${samples} muestras · pico ${fmtDb(peak)} · nivel ${fmtDb(rms)}` +
    (rangeDb !== null ? ` · recorrido ${rangeDb.toFixed(1)} dB` : '') +
    '.';

  if (!usable) {
    return {
      ...base,
      status: 'warn',
      detail,
      hint: 'El micrófono entrega audio, pero tan bajo que ninguna prueba podrá medirlo. Acerque el micrófono, suba la ganancia de entrada del sistema o pruebe sin accesorios.',
    };
  }

  /* El recorrido se PUBLICA siempre y no cambia el veredicto.
   *
   * Un recorrido corto es sospechoso —una entrada nivelada por el sistema
   * (control automático de ganancia) devuelve el mismo nivel se acerque uno o
   * cambie de micrófono, que es justo la duda que llegó de campo— pero no es
   * una prueba: una toma en silencio también es plana. Convertirlo en FALLO
   * sería inventarse un veredicto; callarlo era dejar la duda sin forma de
   * medirse. Se dice el número y qué hacer con él. */
  const flat = rangeDb !== null && rangeDb < MIN_RESPONSIVE_SPAN_DB;
  return {
    ...base,
    status: 'ok',
    detail,
    hint: flat
      ? `El nivel apenas varía entre bloques (${rangeDb!.toFixed(1)} dB en ${CAPTURE_PROBE_MS / 1000} s). ` +
        'Repita la toma HABLANDO y CALLANDO, y otra vez acercándose al micrófono: en una entrada sana el recorrido cambia mucho. Si sigue plano, el sistema está nivelando la ganancia por su cuenta y las medidas de INTENSIDAD del análisis acústico no son interpretables (la F0, el jitter y los formantes sí).'
      : undefined,
  };
};

/** ¿Hay algún eslabón roto? (para el titular del resumen). */
export const worstStatus = (checks: CheckResult[]): CheckStatus => {
  if (checks.some(c => c.status === 'fail')) return 'fail';
  if (checks.some(c => c.status === 'warn')) return 'warn';
  if (checks.length && checks.every(c => c.status === 'skip')) return 'skip';
  return 'ok';
};

/**
 * Comprobaciones que SOLO cierra el oído del profesional, una por motor de
 * salida. Mientras falte alguna, la salida de audio no está comprobada y el
 * resumen tiene que decirlo: el informe de campo que llegó decía «todo
 * funciona» sobre una app sin sonido justo porque estas preguntas ni se
 * hacían ni se echaban en falta.
 */
export const LISTEN_CHECK_IDS = ['tone', 'verbal-clip-heard', 'voice-bank-heard', 'tts-heard'] as const;

/**
 * Resumen en texto plano para que el profesional lo copie en un correo o una
 * incidencia. Sin esto, el informe de campo vuelve a ser «no funciona nada».
 */
export const summaryText = (checks: CheckResult[]): string => {
  const mark: Record<CheckStatus, string> = { ok: 'OK  ', warn: 'AVISO', fail: 'FALLO', skip: '—   ' };
  const lines = checks.map(c => `[${mark[c.status]}] ${c.label}: ${c.detail}${c.hint ? ` → ${c.hint}` : ''}`);
  const pending = LISTEN_CHECK_IDS.filter(id => !checks.some(c => c.id === id));
  const tail = pending.length
    ? [
        '',
        `SALIDA NO COMPROBADA: faltan ${pending.length} de ${LISTEN_CHECK_IDS.length} pruebas de escucha`,
        `(${pending.join(', ')}). Nada de lo anterior demuestra que el altavoz emita.`,
      ]
    : [];
  return [
    `VIA+ · comprobación de audio`,
    `Banco de voz: ${VOICE_ASSETS_VERSION}`,
    '',
    ...lines,
    ...tail,
  ].join('\n');
};

/* -------------------------------------------------------------------------- */
/*  Comprobaciones que TOCAN el motor nativo                                   */
/* -------------------------------------------------------------------------- */

/** 1 · ¿Trae este binario el motor de audio nativo? */
export function checkNativeEngine(): CheckResult {
  const api = optionalAudioApi();
  if (!api) {
    return {
      id: 'engine',
      label: 'Motor de audio nativo',
      status: 'fail',
      detail: 'El módulo `react-native-audio-api` no se pudo cargar en este binario.',
      hint: 'La compilación no enlazó el módulo nativo. Reinstale la app desde una compilación limpia (no un bundle de JS sobre un APK antiguo).',
    };
  }
  const missing = ['AudioContext', 'AudioRecorder', 'AudioManager'].filter(k => !api[k]);
  if (missing.length) {
    return {
      id: 'engine',
      label: 'Motor de audio nativo',
      status: 'fail',
      detail: `El módulo cargó pero le faltan piezas: ${missing.join(', ')}.`,
      hint: 'Versión del paquete nativo incompatible con el JS instalado. Vuelva a compilar la app completa.',
    };
  }
  return {
    id: 'engine',
    label: 'Motor de audio nativo',
    status: 'ok',
    detail: 'AudioContext, AudioRecorder y AudioManager presentes.',
  };
}

/** 2 · ¿Abre el contexto de SALIDA compartido? */
export function checkOutputContext(): CheckResult {
  const base = { id: 'output', label: 'Contexto de salida (altavoz)' } as const;
  if (!isAudioEngineAvailable()) {
    return { ...base, status: 'fail', detail: 'El motor de salida se marcó como no disponible en este arranque.' };
  }
  const ctx = acquireAudioContext();
  if (!ctx) {
    return {
      ...base,
      status: 'fail',
      detail: 'No se pudo abrir el contexto de audio compartido.',
      hint: 'Otra aplicación puede tener el dispositivo de salida en modo exclusivo. Ciérrelas y reinicie VIA+.',
    };
  }
  resumeAudioContext();
  const state = ctx.state ?? 'desconocido';
  const rate = ctx.sampleRate;
  releaseAudioContext();

  /* QUÉ SIGNIFICA «running» AQUÍ, versión comprobada contra el motor instalado
   * (react-native-audio-api 0.8.4, leído en `node_modules`).
   *
   * Es verdad que el constructor `AudioContext::AudioContext` hace
   *
   *     audioPlayer_->start();
   *     state_ = ContextState::RUNNING;
   *
   * IGNORANDO el booleano de `start()`. Pero lo que este código lee NO es
   * `state_`: `ctx.state` cruza el puente por `BaseAudioContextHostObject`, que
   * llama a `BaseAudioContext::getState()` (BaseAudioContext.cpp:31):
   *
   *     if (isDriverRunning()) return toString(state_);
   *     if (state_ == CLOSED)  return "closed";
   *     return "suspended";
   *
   * y `isDriverRunning()` termina en `AudioPlayer::isRunning()`
   * (AudioPlayer.cpp:79) = `mStream_ && mStream_->getState() == Started`. Es
   * decir: en esta versión un contexto cuyo stream de Oboe no abrió responde
   * «suspended», no «running».
   *
   * Consecuencia para el diagnóstico: «running» SÍ demuestra que el stream
   * nativo está abierto y arrancado. Lo que sigue sin demostrar es que salga
   * sonido audible —volumen a cero, ruta a un Bluetooth desconectado, ganancia
   * de la app en silencio—, y por eso el eslabón que cierra la salida sigue
   * siendo la prueba de escucha. Lo que este eslabón ya no hace es despreciar
   * una señal buena: distingue «el motor está vivo» de «el motor está muerto».
   *
   * NOTA DE MANTENIMIENTO: esta lectura vale para la 0.8.4. Si sube la versión
   * de `react-native-audio-api`, vuelve a leer `BaseAudioContext::getState()`
   * antes de dar por buena esta explicación. */
  const isStateOk = state === 'running' || state === 'desconocido';
  return {
    ...base,
    status: isStateOk ? 'ok' : 'warn',
    detail:
      `El contexto responde «${state}» a ${rate} Hz. ` +
      (state === 'running'
        ? 'En esta versión del motor eso implica que el stream nativo está abierto y arrancado; no implica que se OIGA.'
        : 'No prueba por sí solo que el altavoz emita.'),
    hint:
      state === 'suspended'
        ? 'El sistema tiene el contexto suspendido o el stream nativo no llegó a arrancar: no sonará nada así.'
        : 'Quien cierra este eslabón es la prueba de escucha del final de la pantalla.',
  };
}

/* -------------------------------------------------------------------------- */
/*  2 bis · EL RELOJ DEL HARDWARE, que es la única prueba máquina de que el     */
/*  motor de salida está VIVO.                                                 */
/*                                                                             */
/*  `ctx.currentTime` no es un reloj de pared: sale de                          */
/*  `AudioDestinationNode::getCurrentTime()` = `currentSampleFrame_ /           */
/*  sampleRate`, y `currentSampleFrame_` solo crece dentro de                   */
/*  `AudioDestinationNode::renderAudio` (AudioDestinationNode.cpp:44), a la que */
/*  únicamente se llega desde `AudioPlayer::onAudioReady`, el callback con el   */
/*  que Oboe PIDE muestras. Y ese callback sale por la puerta de atrás sin      */
/*  renderizar nada cuando `isInitialized_` es `false` —el caso del stream que  */
/*  no abrió—.                                                                  */
/*                                                                             */
/*  Por tanto: si `currentTime` avanza, el hardware está tirando de frames de   */
/*  verdad. Es lo más cerca de «el motor emite» a lo que se puede llegar sin    */
/*  un oído delante, y no cuesta ni un cuarto de segundo medirlo.               */
/* -------------------------------------------------------------------------- */

/** Resultado de la medida del reloj hardware del contexto de salida. */
export interface OutputClockProbe {
  /** ¿El reloj (`ctx.currentTime`) avanzó en la ventana medida? */
  advancing: boolean;
  /** Valor inicial de `currentTime`, en segundos. */
  initialTime: number;
  /** Valor tras la ventana de medida, en segundos. */
  finalTime: number;
  /** Incremento medido, en segundos. */
  deltaTime: number;
  /** Ventana pedida, en milisegundos. */
  windowMs: number;
  /** Fracción de la ventana que el reloj llegó a cubrir (1 = tiempo real). */
  ratio: number;
  /** `false` si no había contexto con el que medir. */
  measured: boolean;
}

/** Ventana de medida del reloj: suficiente para varios bloques de Oboe. */
export const CLOCK_PROBE_MS = 250;

/**
 * Fracción mínima de la ventana que debe cubrir el reloj para darlo por sano.
 * No se exige 1: el temporizador de JS y el del audio no son el mismo, y una
 * ventana corta siempre pierde algo por los bordes del bloque de render.
 */
export const MIN_CLOCK_RATIO = 0.5;

/**
 * Mide el avance de `ctx.currentTime` sobre una ventana. Detecta el motor
 * estancado: contexto abierto cuyo callback de audio no corre.
 */
export async function probeOutputClock(sampleDurationMs = CLOCK_PROBE_MS): Promise<OutputClockProbe> {
  const empty: OutputClockProbe = {
    advancing: false,
    initialTime: 0,
    finalTime: 0,
    deltaTime: 0,
    windowMs: sampleDurationMs,
    ratio: 0,
    measured: false,
  };
  const ctx = acquireAudioContext();
  if (!ctx) return empty;
  try {
    resumeAudioContext();
    const initialTime = Number(ctx.currentTime) || 0;
    await new Promise<void>(resolve => setTimeout(() => resolve(), sampleDurationMs));
    const finalTime = Number(ctx.currentTime) || 0;
    const deltaTime = finalTime - initialTime;
    return {
      advancing: deltaTime > 0,
      initialTime,
      finalTime,
      deltaTime,
      windowMs: sampleDurationMs,
      ratio: sampleDurationMs > 0 ? deltaTime / (sampleDurationMs / 1000) : 0,
      measured: true,
    };
  } finally {
    releaseAudioContext();
  }
}

/**
 * 2 bis · ¿Corre el reloj del hardware de salida? Es el eslabón que separa
 * «el motor está muerto» de «el motor va y no lo oigo», que hasta ahora solo
 * podía distinguir el oído del profesional.
 */
export async function checkOutputClock(): Promise<CheckResult> {
  const base = { id: 'output-clock', label: 'Reloj del hardware de salida' } as const;
  if (!isAudioEngineAvailable()) {
    return {
      ...base,
      status: 'skip',
      detail: 'Sin motor de salida no hay reloj que medir.',
    };
  }

  // La reserva se mantiene durante TODA la comprobación. Sin ella, la sonda
  // suelta la última referencia, el contexto se cierra entre medida y medida y
  // no queda nada que reabrir cuando toca recuperar.
  const held = acquireAudioContext();
  if (!held) {
    return {
      ...base,
      status: 'fail',
      detail: 'No hay contexto de salida con el que medir el reloj.',
      hint: 'Sin AudioContext no suena nada: mire antes el eslabón «Contexto de salida».',
    };
  }
  try {
    return await measureOutputClock(base);
  } finally {
    releaseAudioContext();
  }
}

async function measureOutputClock(
  base: { readonly id: string; readonly label: string },
): Promise<CheckResult> {

  /* La sesión de grabación no invalida la medida, pero sí la explica: en iOS
   * `playAndRecord` atenúa la salida. En Android no cambia nada —
   * `AudioAPIModule.kt:66` implementa `setAudioSessionOptions` como
   * «noting to do here»—, así que se dice como contexto, no como veredicto. */
  const recording = isRecordingSessionActive();
  const probe = await probeOutputClock();

  if (!probe.measured) {
    return {
      ...base,
      status: 'fail',
      detail: 'No hay contexto de salida con el que medir el reloj.',
      hint: 'Sin AudioContext no suena nada: mire antes el eslabón «Contexto de salida».',
    };
  }

  const ms = (probe.deltaTime * 1000).toFixed(0);
  const pct = (probe.ratio * 100).toFixed(0);
  const nota = recording
    ? ' Hay una captura de micrófono abierta: en iOS eso atenúa la salida (en Android no la altera).'
    : '';

  if (!probe.advancing) {
    /* Dos averías distintas se esconden bajo «el reloj no avanza», y tienen
     * arreglos distintos. Las separa `ctx.state`, que en esta versión del motor
     * SÍ dice si el stream de Oboe está `Started` (BaseAudioContext.cpp:31). */
    if (isOutputDriverRunning()) {
      return {
        ...base,
        status: 'fail',
        detail:
          `El motor declara el stream ARRANCADO pero no pidió una sola muestra en ${probe.windowMs} ms.` + nota,
        hint:
          'El hilo de audio está atascado: el stream figura abierto y su callback no corre. ' +
          'Cierre las demás aplicaciones con sonido y reinicie VIA+; si se repite, anótelo con esta pantalla copiada.',
      };
    }

    /* Stream que nunca abrió. NO se levanta con `resume()`: la rama que reabre
     * cuelga de `!playerHasBeenStarted_` y ese booleano ya vale `true` desde el
     * constructor (ver `recoverAudioContext` en `src/Audio`). El único camino de
     * vuelta es un AudioContext nuevo, así que aquí se INTENTA en vez de dejar
     * al profesional con un «reinicie la app». */
    const recovered = recoverAudioContext();
    const second = recovered ? await probeOutputClock() : null;

    if (second?.advancing) {
      return {
        ...base,
        status: 'warn',
        detail:
          `El motor estaba MUERTO (el stream nunca arrancó) y se ha reabierto: ahora corre a ${(
            second.ratio * 100
          ).toFixed(0)} %.` + nota,
        hint:
          'La salida vuelve a estar viva. Si vuelve a caerse, hay otra aplicación disputando el altavoz: ' +
          'ciérrelas y repita la comprobación antes de dar por válida una prueba.',
      };
    }

    return {
      ...base,
      status: 'fail',
      detail:
        `El stream nativo de salida no está arrancado y el reloj no avanzó en ${probe.windowMs} ms` +
        `${recovered ? ', tampoco tras reabrir el motor' : ' y el motor no se pudo reabrir'}.` +
        nota,
      hint:
        'El motor no pide audio: NADA de la app va a sonar. Suele ser el stream de Oboe que no abrió ' +
        '(otra aplicación tiene el altavoz en modo exclusivo). Ciérrelas y reinicie VIA+.',
    };
  }

  if (probe.ratio < MIN_CLOCK_RATIO) {
    return {
      ...base,
      status: 'warn',
      detail: `El reloj avanzó ${ms} ms en una ventana de ${probe.windowMs} ms (${pct} % del tiempo real).` + nota,
      hint:
        'El motor entrega muestras pero se queda corto: cortes o saturación del hilo de audio. ' +
        'El estímulo puede salir troceado, y en audiometría eso invalida el umbral.',
    };
  }

  return {
    ...base,
    status: 'ok',
    detail:
      `El reloj avanzó ${ms} ms en una ventana de ${probe.windowMs} ms (${pct} % del tiempo real): ` +
      'el hardware está pidiendo muestras.' +
      nota,
    hint: 'Demuestra que el motor emite, no que se oiga: el volumen y la ruta los cierra la prueba de escucha.',
  };
}

/**
 * 3 · Tono de prueba de 1 kHz por el altavoz. Devuelve `false` si no llegó ni
 * a programarse; que suene DE VERDAD solo lo puede confirmar quien escucha, y
 * por eso la pantalla lo pregunta en vez de darlo por bueno.
 */
export function playTestTone(): boolean {
  const ctx = acquireAudioContext();
  if (!ctx) return false;
  try {
    resumeAudioContext();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.setValueAtTime(TEST_TONE_HZ, now);
    // Rampas anti-click: un tono que entra en seco se oye como un chasquido y
    // el profesional no sabría si ha oído el tono o el artefacto.
    const end = now + TEST_TONE_MS / 1000;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.25, now + 0.02);
    gain.gain.setValueAtTime(0.25, end - 0.02);
    gain.gain.linearRampToValueAtTime(0, end);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(end);
    return true;
  } catch {
    return false;
  } finally {
    // El contexto es compartido y con recuento: se suelta la referencia, no el
    // stream (el tono programado sigue sonando).
    releaseAudioContext();
  }
}

/**
 * 4 · Banco de locuciones (`expo-audio`): la vía de las consignas y del modelo
 * hablado del T.A.R. cuando la lengua tiene recorte.
 *
 * Decía «la primera decodificó y se reprodujo» porque `playVoiceAsset` había
 * devuelto `true`, y ese `true` solo significa «`play()` no lanzó». Un
 * reproductor que nunca llegó a cargar el fichero tampoco lanza: un banco
 * ilegible se publicaba como CORRECTO. Ahora se espera a que el reproductor
 * declare el fichero cargado y se comprueba que la posición AVANZA.
 *
 * Sigue sin poder afirmar que se OIGA —eso lo cierra la prueba de escucha—, y
 * por eso el veredicto máximo de este eslabón es AVISO hasta que el
 * profesional conteste.
 */
export async function checkVoiceBank(): Promise<CheckResult> {
  const base = { id: 'voice-bank', label: 'Banco de locuciones' } as const;
  const ids = Object.keys(VOICE_ASSETS);
  if (!ids.length) {
    return {
      ...base,
      status: 'fail',
      detail: 'No hay ninguna locución empaquetada en este binario.',
      hint: 'El mapa de assets está vacío: la compilación no incluyó `assets/voice/`. Toda la voz dependerá del sintetizador del sistema.',
    };
  }
  const probe = await probeVoiceAsset(VOICE_ASSETS[ids[0]]);
  const ok = probe.loaded && probe.advanced;

  /* El modo de sesión de las locuciones falla en silencio por naturaleza: si no
   * se aplicó, la voz no suena con la tableta en silencio y además PAUSA lo que
   * estuviera sonando en vez de mezclarse. Se nombra aquí en vez de dejarlo en
   * un `catch` mudo. */
  const mode = voiceAudioModeStatus();
  const modeNote = mode.applied
    ? ''
    : ` El modo de sesión de las locuciones NO se aplicó${mode.error ? ` («${mode.error}»)` : ''}.`;

  if (ok && !mode.applied) {
    return {
      ...base,
      status: 'warn',
      detail: `${ids.length} locuciones empaquetadas (${VOICE_ASSETS_VERSION}); la primera ${probe.detail}.` + modeNote,
      hint: 'Con el modo sin aplicar, la voz enmudece si la tableta está en silencio y puede cortar el estímulo en curso en vez de mezclarse con él.',
    };
  }

  return {
    ...base,
    status: ok ? 'ok' : 'fail',
    detail: `${ids.length} locuciones empaquetadas (${VOICE_ASSETS_VERSION}); la primera ${probe.detail}.` + modeNote,
    hint: ok
      ? 'Que el reproductor avance no prueba que salga por el altavoz: conteste la prueba de escucha.'
      : 'Los ficheros .m4a están en el bundle pero el reproductor del sistema no los sirve. Compruebe que la compilación empaquetó `assets/voice/` y no solo el mapa.',
  };
}

/* -------------------------------------------------------------------------- */
/*  4 bis · LA CADENA DE LA AUDIOMETRÍA VERBAL, que no se comprobaba.          */
/*                                                                             */
/*  El banco de locuciones (arriba) suena por `expo-audio`. La audiometría     */
/*  verbal NO usa esa vía: decodifica el recorte incrustado en base64 con      */
/*  `decodeAudioData` del AudioContext compartido y lo reproduce por           */
/*  BufferSource → Gain → StereoPanner → destination. Son dos motores          */
/*  distintos, y el diagnóstico solo miraba el primero: de ahí que la pantalla */
/*  publicase CORRECTO mientras la audiometría verbal estaba muda.             */
/* -------------------------------------------------------------------------- */

/** Clave de recorte con la que se prueba la cadena (la primera registrada). */
const probeClipKey = (): string | null => registeredVerbalAssets().audio[0] ?? null;

export async function checkVerbalClipChain(): Promise<CheckResult> {
  const base = { id: 'verbal-clip', label: 'Recortes de la audiometría verbal' } as const;
  const key = probeClipKey();
  if (!key) {
    return {
      ...base,
      status: 'fail',
      detail: 'No hay ningún recorte de palabra registrado en este binario.',
      hint: 'La audiometría verbal no tiene estímulo que presentar. Falta el registro de assets (`scripts/verbal-assets.js registry`).',
    };
  }

  const b64 = verbalAudioBase64ForLang(key, 'es');
  if (!b64) {
    return {
      ...base,
      status: 'fail',
      detail: `El recorte «${key}» no tiene audio incrustado.`,
      hint: 'El registro de recortes se generó sin los bytes en base64: vuelva a ejecutar `node scripts/verbal-assets.js registry`.',
    };
  }

  const ctx = acquireAudioContext();
  if (!ctx) {
    return {
      ...base,
      status: 'fail',
      detail: 'No hay contexto de salida con el que decodificar el recorte.',
      hint: 'Sin AudioContext la audiometría verbal no puede presentar ninguna palabra.',
    };
  }

  try {
    // La locución del banco (comprobación anterior) puede seguir sonando: dos
    // emisiones solapadas no dejan juzgar ninguna de las dos.
    stopVoiceAsset();
    resumeAudioContext();
    const bytes = Buffer.from(b64, 'base64');
    const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    const buffer: any = await ctx.decodeAudioData(ab as ArrayBuffer);
    const duration = Number(buffer?.duration) || 0;
    if (duration <= 0) {
      return {
        ...base,
        status: 'fail',
        detail: `El recorte «${key}» (${bytes.byteLength} bytes) decodificó a un buffer de duración cero.`,
        hint: 'El decodificador nativo acepta el fichero pero no extrae muestras. La audiometría verbal presentará silencio: es un fallo del motor de audio, no del inventario.',
      };
    }

    // Se reproduce con la MISMA cadena de nodos que el estímulo real, para que
    // la prueba de escucha diga algo sobre la audiometría verbal y no sobre un
    // camino paralelo. A nivel pleno: aquí no se está midiendo un umbral.
    const now = ctx.currentTime;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    const panner = ctx.createStereoPanner();
    panner.pan.value = 0;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(1, now + 0.015);
    const end = now + duration;
    gain.gain.setValueAtTime(1, Math.max(now + 0.015, end - 0.015));
    gain.gain.linearRampToValueAtTime(0, end);
    source.connect(gain);
    gain.connect(panner);
    panner.connect(ctx.destination);
    source.start(now);

    return {
      ...base,
      status: 'ok',
      detail: `El recorte «${key}» decodificó a ${duration.toFixed(2)} s y se programó por la cadena real del estímulo.`,
      hint: 'Que se programe no prueba que se oiga: conteste la prueba de escucha.',
    };
  } catch (e) {
    return {
      ...base,
      status: 'fail',
      detail: `El recorte «${key}» NO decodificó: ${e instanceof Error ? e.message : 'error del decodificador'}.`,
      hint: 'La audiometría verbal degradará a la voz del sistema en todas las palabras. Compruebe la versión del módulo nativo de audio.',
    };
  } finally {
    releaseAudioContext();
  }
}

/** 5 · Estado real del sintetizador de voz del sistema. */
export function checkSystemVoice(): CheckResult {
  const base = { id: 'tts', label: 'Sintetizador de voz del sistema' } as const;
  const status = voiceStatus();
  if (!status) {
    return {
      ...base,
      status: 'fail',
      detail: 'El adaptador de voz no está instalado (no se registró al arrancar la app).',
      hint: 'Sin adaptador no hay voz en NINGÚN módulo. Cierre la app por completo y vuelva a abrirla.',
    };
  }
  const voices = `${status.voiceCount} voces`;
  const lang = status.currentLang ? `lengua «${status.currentLang}»` : 'sin lengua fijada';
  const degraded = status.degraded ? ' · voz DEGRADADA a otro idioma' : '';
  const byPhase: Record<TtsPhase, CheckStatus> = {
    ready: 'ok',
    initializing: 'warn',
    unavailable: 'fail',
  };
  const phaseStatus = byPhase[status.phase];
  return {
    ...base,
    status: status.degraded && phaseStatus === 'ok' ? 'warn' : phaseStatus,
    detail: `${status.detail} (${voices} · ${lang}${degraded})`,
    hint:
      status.phase === 'unavailable'
        ? 'Instale un motor de síntesis (p. ej. «Voz de Google») y los datos de voz en español desde los ajustes del sistema.'
        : // Enumerar voces y EMITIR son cosas distintas: un dispositivo puede
          // ver cientos de voces y no decir una sílaba. Lo comprueba el
          // eslabón siguiente, no éste.
          'Ver voces no es emitir: quien lo comprueba es «Locución real del sintetizador».',
  };
}

/**
 * 5 bis · ¿EMITE el sintetizador? Es el eslabón del que cuelgan el modelo
 * hablado del T.A.R. y las consignas de todos los módulos sin recorte propio.
 *
 * El diagnóstico se quedaba en «473 voces → CORRECTO», que responde a otra
 * pregunta. Un dispositivo con centenares de voces enumeradas no dice una
 * sílaba si la voz elegida se sintetiza EN SERVIDOR y no hay cobertura —el
 * caso normal en el emulador de Android Studio—: Android emite `onError` por
 * locución y el modelo hablado, que es fuego y olvido, se queda mudo sin
 * degradar y sin avisar. Esto DICTA de verdad y espera el veredicto del motor.
 */
export async function checkSystemVoiceSpeaks(lang = 'es', timeoutMs?: number): Promise<CheckResult> {
  const base = { id: 'tts-speak', label: 'Locución real del sintetizador' } as const;
  const probe = await probeSystemVoice(TEST_PHRASE, lang, timeoutMs);
  if (!probe) {
    return {
      ...base,
      status: 'fail',
      detail: 'El adaptador de voz no está instalado: no hay a quién pedirle una locución.',
      hint: 'Sin adaptador no hay voz en NINGÚN módulo. Cierre la app por completo y vuelva a abrirla.',
    };
  }

  const voice = probe.voiceId ? `voz «${probe.voiceId}»` : 'sin voz fijada (la elige el sistema)';
  const net = probe.voiceId
    ? probe.offline
      ? 'sin red'
      : 'REQUIERE RED'
    : 'disponibilidad desconocida';
  const where = `${voice} · ${probe.language} · ${net}${probe.degraded ? ' · voz de OTRO idioma' : ''}`;

  if (probe.error) {
    return {
      ...base,
      status: 'fail',
      detail: `${probe.error} (${where})`,
      hint: probe.offline
        ? 'La voz elegida no depende de la red, así que el fallo es del motor: pruebe a cambiar el motor de síntesis en Ajustes ▸ Sistema ▸ Idiomas ▸ Salida de texto a voz.'
        : 'La voz elegida SE SINTETIZA EN SERVIDOR: sin conexión no emite nada. Descargue la voz de español para uso sin conexión (Ajustes ▸ Sistema ▸ Idiomas ▸ Salida de texto a voz ▸ Instalar datos de voz) y repita.',
    };
  }

  return {
    ...base,
    status: probe.degraded ? 'warn' : 'ok',
    detail: `El motor dictó la frase de prueba completa (${where}).`,
    hint: probe.degraded
      ? 'Se dictó con una voz de otro idioma: instale la voz de la lengua de sesión para no alterar el estímulo.'
      : 'Que el motor la dicte no prueba que salga por el altavoz: conteste la prueba de escucha.',
  };
}

/** 6 · ¿Está concedido el permiso de micrófono? */
export async function checkMicPermission(
  request: () => Promise<boolean>,
): Promise<CheckResult> {
  const base = { id: 'mic-permission', label: 'Permiso de micrófono' } as const;
  let granted = false;
  try {
    granted = await request();
  } catch {
    granted = false;
  }
  // El micrófono compartido DEBE enterarse antes de abrir nada: el stream
  // nativo se abre en el constructor y uno creado sin permiso nace mudo.
  setRecorderPermissionGranted(granted);
  return {
    ...base,
    status: granted ? 'ok' : 'fail',
    detail: granted ? 'Concedido.' : 'Denegado o no concedido todavía.',
    hint: granted ? undefined : 'Ajustes ▸ VIA+ ▸ Permisos ▸ Micrófono. Sin él ninguna prueba de voz puede grabar.',
  };
}

/**
 * 7 · Toma de prueba REAL. Es la comprobación decisiva: distingue «el
 * micrófono no entrega nada» de «entrega, pero muy bajo» y de «funciona».
 */
export async function checkMicCapture(): Promise<CheckResult> {
  const shared = acquireRecorder();
  if (!shared) {
    return describeCapture(0, 0, -Infinity, -Infinity, recorderHealth());
  }

  let blocks = 0;
  let samples = 0;
  let peak = 0;
  let sumSquares = 0;
  // Recorrido dinámico: el bloque más flojo y el más fuerte de la toma. Es lo
  // que distingue un micrófono que RESPONDE de uno cuyo nivel no se mueve.
  let minBlockRms = Infinity;
  let maxBlockRms = 0;

  const unsubscribe = shared.subscribe(pcm => {
    blocks += 1;
    samples += pcm.length;
    let blockSquares = 0;
    for (let i = 0; i < pcm.length; i++) {
      const v = pcm[i];
      const a = v < 0 ? -v : v;
      if (a > peak) peak = a;
      blockSquares += v * v;
    }
    sumSquares += blockSquares;
    if (pcm.length) {
      const blockRms = Math.sqrt(blockSquares / pcm.length);
      if (blockRms < minBlockRms) minBlockRms = blockRms;
      if (blockRms > maxBlockRms) maxBlockRms = blockRms;
    }
  });

  const releaseSession = acquireRecordingSession();
  try {
    shared.start();
    await new Promise<void>(resolve => setTimeout(resolve, CAPTURE_PROBE_MS));
  } finally {
    shared.stop();
    releaseSession();
    unsubscribe();
    shared.release();
  }

  const peakDb = peak > 0 ? 20 * Math.log10(peak) : -Infinity;
  const rmsDb = samples > 0 && sumSquares > 0 ? 20 * Math.log10(Math.sqrt(sumSquares / samples)) : -Infinity;
  const span: CaptureSpan | undefined =
    blocks > 1 && maxBlockRms > 0 && Number.isFinite(minBlockRms)
      ? {
          minRmsDb: minBlockRms > 0 ? 20 * Math.log10(minBlockRms) : -Infinity,
          maxRmsDb: 20 * Math.log10(maxBlockRms),
        }
      : undefined;
  return describeCapture(blocks, samples, peakDb, rmsDb, recorderHealth(), span);
}

/* -------------------------------------------------------------------------- */
/*  EMISIONES para la prueba de escucha.                                       */
/*                                                                             */
/*  Las tres vías por las que la app puede sonar, cada una con su motor:       */
/*  el oscilador de las audiometrías (react-native-audio-api), el banco de     */
/*  locuciones (expo-audio) y el sintetizador del sistema (expo-speech). Sonar */
/*  por una NO implica sonar por las otras —es exactamente lo que pasaba: el   */
/*  banco respondía y la audiometría verbal y el T.A.R. estaban mudos—, así    */
/*  que la pantalla las emite por separado y pregunta por cada una.            */
/*                                                                             */
/*  Cada función devuelve si la emisión llegó a PROGRAMARSE. Que se oiga solo  */
/*  lo puede cerrar quien escucha.                                             */
/* -------------------------------------------------------------------------- */

/** Emite la primera locución empaquetada (vía `expo-audio`). */
export const emitVoiceBankSample = async (): Promise<boolean> => {
  const ids = Object.keys(VOICE_ASSETS);
  if (!ids.length) return false;
  const probe = await probeVoiceAsset(VOICE_ASSETS[ids[0]]);
  return probe.loaded && probe.advanced;
};

/** Emite un recorte por la cadena REAL de la audiometría verbal. */
export const emitVerbalClipSample = async (): Promise<boolean> =>
  (await checkVerbalClipChain()).status === 'ok';

/** Dicta la frase de prueba por la vía real del modelo hablado del T.A.R. */
export const emitSystemVoiceSample = async (lang = 'es', timeoutMs?: number): Promise<boolean> => {
  const probe = await probeSystemVoice(TEST_PHRASE, lang, timeoutMs);
  return !!probe && probe.error === null;
};

/**
 * 8 · Reconocimiento de voz del T.A.R.
 *
 * Se interroga la MISMA superficie nativa que usa el módulo clínico, no una
 * paralela: un diagnóstico que preguntase por otra vía podría declarar
 * «disponible» mientras el T.A.R. se queda mudo.
 *
 * VIA+ exige reconocimiento EN EL DISPOSITIVO y falla CERRADO (Zero-PHI: la voz
 * de un menor no sale del equipo). La consecuencia hay que decirla, porque no
 * es una anomalía sino el caso normal en buena parte del parque: Android exige
 * API 33 y el modelo de la lengua descargado, y NINGUNA imagen de emulador lo
 * trae. Un «no funciona el T.A.R.» sobre un emulador es esto, y hasta ahora no
 * se distinguía de una avería.
 */
export async function checkSpeechRecognition(locale = 'es-ES'): Promise<CheckResult> {
  const base = { id: 'asr', label: 'Reconocimiento de voz (T.A.R.)' } as const;
  const caps = await probeRecognitionCaps(nativeRecognitionProbe(), locale);
  const decision = resolveRecognitionMode(caps);
  if (decision.mode === 'on-device') {
    return { ...base, status: 'ok', detail: 'Reconocimiento garantizado en el dispositivo.' };
  }
  return {
    ...base,
    // AVISO y no FALLO: sin reconocimiento el T.A.R. sigue siendo válido con
    // clasificación SODA manual. Llamarlo «fallo» mandaría a buscar una avería
    // donde solo hay una capacidad que este equipo no tiene.
    status: 'warn',
    detail: recognitionBlockLabel(decision.reason),
    hint:
      decision.reason === 'no-local-model'
        ? 'Ajustes del sistema ▸ Idiomas ▸ Reconocimiento de voz: descargue el paquete de la lengua para uso sin conexión.'
        : 'El T.A.R. funciona con clasificación SODA manual. Para transcripción automática hace falta Android 13 o superior con el modelo de la lengua descargado — los emuladores no lo incluyen.',
  };
}
