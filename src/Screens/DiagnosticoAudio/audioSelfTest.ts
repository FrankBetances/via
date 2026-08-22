import {
  acquireAudioContext,
  acquireRecorder,
  acquireRecordingSession,
  isAudioEngineAvailable,
  recorderHealth,
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
import { VOICE_ASSETS, VOICE_ASSETS_VERSION, playVoiceAsset, voiceStatus } from '@/Voice';

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
  return {
    ...base,
    status: usable ? 'ok' : 'warn',
    detail: `${blocks} bloques · ${samples} muestras · pico ${fmtDb(peak)} · nivel ${fmtDb(rms)}.`,
    hint: usable
      ? undefined
      : 'El micrófono entrega audio, pero tan bajo que ninguna prueba podrá medirlo. Acerque el micrófono, suba la ganancia de entrada del sistema o pruebe sin accesorios.',
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
 * Resumen en texto plano para que el profesional lo copie en un correo o una
 * incidencia. Sin esto, el informe de campo vuelve a ser «no funciona nada».
 */
export const summaryText = (checks: CheckResult[]): string => {
  const mark: Record<CheckStatus, string> = { ok: 'OK  ', warn: 'AVISO', fail: 'FALLO', skip: '—   ' };
  const lines = checks.map(c => `[${mark[c.status]}] ${c.label}: ${c.detail}${c.hint ? ` → ${c.hint}` : ''}`);
  return [`VIA+ · comprobación de audio`, `Banco de voz: ${VOICE_ASSETS_VERSION}`, '', ...lines].join('\n');
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
  const state = ctx.state ?? 'desconocido';
  releaseAudioContext();
  return {
    ...base,
    status: state === 'running' || state === 'desconocido' ? 'ok' : 'warn',
    detail: `Abierto a ${ctx.sampleRate} Hz · estado «${state}».`,
    hint: state === 'suspended' ? 'El sistema tiene el contexto suspendido: no sonará nada hasta que se reanude.' : undefined,
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

/** 4 · ¿Está el banco de locuciones empaquetado y se puede decodificar? */
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
  const sounded = await playVoiceAsset(VOICE_ASSETS[ids[0]]);
  return {
    ...base,
    status: sounded ? 'ok' : 'fail',
    detail: sounded
      ? `${ids.length} locuciones empaquetadas (${VOICE_ASSETS_VERSION}); la primera decodificó y se reprodujo.`
      : `${ids.length} locuciones empaquetadas (${VOICE_ASSETS_VERSION}), pero la primera NO decodificó.`,
    hint: sounded
      ? undefined
      : 'Los ficheros .m4a están en el bundle pero el decodificador nativo los rechaza. Compruebe que la compilación empaquetó los assets y no solo el mapa.',
  };
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
        : undefined,
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

  const unsubscribe = shared.subscribe(pcm => {
    blocks += 1;
    samples += pcm.length;
    for (let i = 0; i < pcm.length; i++) {
      const v = pcm[i];
      const a = v < 0 ? -v : v;
      if (a > peak) peak = a;
      sumSquares += v * v;
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
  return describeCapture(blocks, samples, peakDb, rmsDb, recorderHealth());
}

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
