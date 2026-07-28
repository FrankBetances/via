import {
  acquireAudioContext,
  peekAudioContext,
  releaseAudioContext,
  resumeAudioContext,
  type SharedAudioContext,
} from '@/Audio';

/* -------------------------------------------------------------------------- */
/*  Reproductor de assets de voz (runtime · react-native-audio-api).            */
/*                                                                             */
/*  `playVoiceAsset(module)` reproduce el `.m4a` pre-sintetizado. Usa el        */
/*  contexto de audio COMPARTIDO de la app (`@/Audio`): antes creaba uno        */
/*  propio y en Android (Oboe en modo exclusivo) ese contexto extra se quedaba  */
/*  mudo —o dejaba mudos a los de las audiometrías—, que es por lo que las      */
/*  consignas habladas de los ejercicios no sonaban.                            */
/*                                                                             */
/*  Si no hay motor nativo (o el asset no decodifica) devuelve `false` y el     */
/*  llamante (`viaVoice`) cae a la voz del sistema. Un ÚNICO slot de            */
/*  reproducción: empezar una locución detiene la anterior (misma disciplina    */
/*  que el adaptador verbal).                                                    */
/*                                                                             */
/*  Los modelos de IA NUNCA corren aquí: en runtime solo se REPRODUCE audio ya  */
/*  empaquetado (offline-first inviolable, P1).                                 */
/* -------------------------------------------------------------------------- */

/* Metro exige literales en `require(...)` (ver verbalAudiometryAudio.ts). */
const optionalRN = (): any => {
  try {
    return require('react-native');
  } catch (_e) {
    return null;
  }
};

let source: any = null;
const cache = new Map<number, any>(); // módulo de asset → AudioBuffer decodificado
/** ¿Se tomó ya la referencia del contexto compartido? (una sola por proceso) */
let holdsContext = false;

const getContext = (): SharedAudioContext | null => {
  if (holdsContext) return peekAudioContext();
  const ctx = acquireAudioContext();
  // Se marca la reserva aunque el contexto sea null: `acquireAudioContext`
  // incrementa el contador igualmente y hay que soltarlo en `dispose`.
  holdsContext = true;
  return ctx;
};

/** Detiene la locución en curso (si la hay). */
export const stopVoiceAsset = (): void => {
  try {
    source?.stop();
  } catch {
    /* ya detenida */
  }
  try {
    source?.disconnect();
  } catch {
    /* noop */
  }
  source = null;
};

const uriForModule = (assetModule: number): string | null => {
  const RN = optionalRN();
  try {
    return RN?.Image?.resolveAssetSource?.(assetModule)?.uri ?? null;
  } catch {
    return null;
  }
};

const play = (buffer: any): boolean => {
  const c = getContext();
  if (!c) return false;
  resumeAudioContext();
  try {
    stopVoiceAsset();
    const src = c.createBufferSource();
    src.buffer = buffer;
    src.connect(c.destination);
    src.start(c.currentTime);
    source = src;
    return true;
  } catch {
    return false;
  }
};

/**
 * Decodifica el asset. En RELEASE el asset es un fichero del bundle y
 * `decodeAudioDataSource` (que solo abre RUTAS locales) lo resuelve; en
 * DESARROLLO `resolveAssetSource` devuelve una URL http del servidor de Metro
 * que la vía nativa por ruta NO sabe abrir —por eso las consignas no sonaban
 * en los builds de depuración—, así que se descarga y se decodifica en memoria.
 * Mismo orden de degradación que el adaptador de la audiometría verbal.
 */
const decodeAsset = async (c: SharedAudioContext, uri: string): Promise<any> => {
  const isRemote = /^https?:/i.test(uri);
  if (!isRemote) {
    try {
      return await c.decodeAudioDataSource(uri);
    } catch {
      /* cae a la descarga */
    }
  }
  const res = await fetch(uri);
  const data = await res.arrayBuffer();
  return await c.decodeAudioData(data);
};

/**
 * Reproduce el asset de voz pre-sintetizado. Devuelve una promesa a `true` si
 * sonó, `false` si no hay motor nativo o el asset no decodifica (el llamante
 * degrada a la voz del sistema). Nunca lanza.
 */
export const playVoiceAsset = async (assetModule: number | undefined): Promise<boolean> => {
  if (assetModule == null) return false;
  const cached = cache.get(assetModule);
  if (cached) return play(cached);

  const c = getContext();
  if (!c) return false;
  const uri = uriForModule(assetModule);
  if (!uri) return false;
  try {
    const buffer = await decodeAsset(c, uri);
    cache.set(assetModule, buffer);
    return play(buffer);
  } catch {
    return false;
  }
};

/** Libera la referencia al contexto compartido y la caché (limpieza en desmontaje). */
export const disposeVoicePlayback = (): void => {
  stopVoiceAsset();
  if (holdsContext) {
    holdsContext = false;
    releaseAudioContext();
  }
  cache.clear();
};
