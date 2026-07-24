/* -------------------------------------------------------------------------- */
/*  Reproductor de assets de voz (runtime · react-native-audio-api).            */
/*                                                                             */
/*  `playVoiceAsset(module)` reproduce el `.m4a` pre-sintetizado. Carga         */
/*  PEREZOSA del módulo nativo: si `react-native-audio-api` no está disponible  */
/*  (o el asset no decodifica), devuelve `false` y el llamante (`viaVoice`)     */
/*  cae a la voz del sistema. Un ÚNICO slot de reproducción: empezar una        */
/*  locución detiene la anterior (misma disciplina que el adaptador verbal).    */
/*                                                                             */
/*  Los modelos de IA NUNCA corren aquí: en runtime solo se REPRODUCE audio ya  */
/*  empaquetado (offline-first inviolable, P1).                                 */
/* -------------------------------------------------------------------------- */

/* Metro exige literales en `require(...)` (ver verbalAudiometryAudio.ts). */
const optionalAudioApi = (): any => {
  try {
    return require('react-native-audio-api');
  } catch (_e) {
    return null;
  }
};

const optionalRN = (): any => {
  try {
    return require('react-native');
  } catch (_e) {
    return null;
  }
};

let ctx: any = null;
let source: any = null;
const cache = new Map<number, any>(); // módulo de asset → AudioBuffer decodificado

const getContext = (): any => {
  if (ctx) return ctx;
  const api = optionalAudioApi();
  if (!api?.AudioContext) return null;
  try {
    ctx = new api.AudioContext({ sampleRate: 48000 });
    return ctx;
  } catch {
    return null;
  }
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
  try {
    if (c.state && c.state !== 'running') void c.resume?.();
  } catch {
    /* algunos targets no exponen state/resume */
  }
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
    const buffer = await c.decodeAudioDataSource(uri);
    cache.set(assetModule, buffer);
    return play(buffer);
  } catch {
    return false;
  }
};

/** Libera el contexto de audio y la caché (limpieza en desmontaje). */
export const disposeVoicePlayback = (): void => {
  stopVoiceAsset();
  try {
    ctx?.close?.();
  } catch {
    /* noop */
  }
  ctx = null;
  cache.clear();
};
