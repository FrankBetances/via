import type { OscillatorNode, GainNode, StereoPannerNode } from 'react-native-audio-api';

import {
  acquireAudioContext,
  onAudioContextChange,
  releaseAudioContext,
  resumeAudioContext,
} from '@/Audio';
import { setAudiometryToneAdapter, ToneChannel, ToneTarget } from './useAudiometryTest';
import { dbHLtoGainFreeField } from './audiometryCalibration';

/* ==========================================================================
 * Adaptador de tono REAL para Audiometría Infantil / Condicionada (Android+iOS)
 * --------------------------------------------------------------------------
 * Biblioteca: react-native-audio-api (Software Mansion) — Web Audio API nativa
 * sobre **Oboe** en Android y AVAudioEngine en iOS. Es la única dependencia de
 * audio que sintetiza tonos puros calibrados en el dispositivo; `react-native-
 * sound` NO sirve aquí (solo reproduce ficheros, no genera osciladores).
 *
 *   yarn add react-native-audio-api
 *   cd ios && pod install
 *
 * Síntesis: osciladores (parciales) -> GainNode maestro (envolvente × nivel
 * dB HL) -> StereoPannerNode (OD = derecho, OI = izquierdo, CL = campo libre
 * centrado) -> destination. Rampas de subida/bajada siempre (anti-click,
 * imprescindible en audiometría).
 *
 * CONTEXTO COMPARTIDO: los nodos cuelgan del ÚNICO AudioContext de la app
 * (`@/Audio`). Este adaptador creaba antes su propio contexto y, con él, un
 * segundo stream nativo: en Android (Oboe, sharing mode EXCLUSIVO) el segundo
 * contexto que se abría se quedaba mudo sin avisar, así que según el orden de
 * arranque se silenciaban los tonos o las palabras de la verbal.
 *
 * TIMBRES: la pantalla infantil presenta cada frecuencia como un instrumento
 * (500 = tambor, 1000 = piano, 2000 = campana, 4000 = flauta), así que el
 * estímulo debe SONAR a ese instrumento o el juego de identificación no
 * funciona (antes todas las frecuencias emitían el mismo seno puro y solo
 * 'amb'/'tren' tenían timbre propio). Cada instrumento es síntesis aditiva
 * mínima: la fundamental en la frecuencia nominal lleva ≥ 75 % de la amplitud
 * (desviación ≤ 2.5 dB respecto al tono puro calibrado, muy por debajo del
 * paso de 5 dB del algoritmo) y la envolvente aporta el gesto (golpes de
 * tambor, nota pulsada, tañido con batido, soplo con vibrato). La suma de
 * parciales nunca supera 1.0 → sin recorte ni a nivel máximo. Los sonidos de
 * control no tonales ('amb' = sirena de ambulancia, 'tren' = silbato de tren
 * con vibrato) se generan modulados para condicionar la atención del niño.
 * ========================================================================== */

export interface ToneAdapterOptions {
  /** dB HL -> ganancia lineal. Por defecto se usa la calibración por frecuencia
   *  (RETSPL de campo libre, ISO 389-7) de `audiometryCalibration`, que corrige
   *  la RELACIÓN de nivel entre bandas. Sustituible por la tabla real medida
   *  contra equipo patrón por transductor si se dispone de ella. El nivel
   *  ABSOLUTO sigue siendo ORIENTATIVO (debe advertirse en UI/PDF). */
  dbHLtoGain?: (dbHL: number, freq: number) => number;
  /** Duración del tono puro (ms). El hook ya corta a 1400 ms por su cuenta. */
  toneDurationMs?: number;
}

// OD = derecha, OI = izquierda, CL = campo libre (centrado, ambos altavoces).
const panForChannel = (channel: ToneChannel): number =>
  channel === 'OD' ? 1 : channel === 'OI' ? -1 : 0;

/**
 * Registra el motor de tono real sobre react-native-audio-api y devuelve una
 * función de limpieza que lo desregistra y libera el AudioContext.
 *
 *   // App.tsx (una sola vez, al arrancar)
 *   import { installAudiometryToneAdapter } from '@/Screens/Audiometry';
 *   useEffect(() => installAudiometryToneAdapter(), []);
 */
export function installAudiometryToneAdapter(opts: ToneAdapterOptions = {}): () => void {
  const dbHLtoGain = opts.dbHLtoGain ?? dbHLtoGainFreeField;
  const toneDurationMs = opts.toneDurationMs ?? 1600;

  // Contexto ÚNICO de la app (crea el stream nativo en la primera reserva y
  // configura la sesión de reproducción por altavoz). `let`, no `const`: si el
  // stream nativo muere y hay que reabrirlo, este adaptador —que se instala al
  // arrancar la app y vive todo el proceso— se quedaría con el objeto muerto.
  let ctx = acquireAudioContext();
  if (!ctx) {
    // Sin motor nativo NO se registra adaptador: así `hasTone` queda en false
    // y la pantalla avisa («no se emitirán tonos») en vez de aparentar que la
    // prueba es válida mientras presenta silencio.
    console.warn('VIA+: motor de audio no disponible; la audiometría no emitirá tonos.');
    releaseAudioContext();
    return () => {};
  }

  // Nodos activos del estímulo en curso (para poder detenerlos). Un estímulo
  // con timbre usa varios osciladores (parciales), de ahí las listas.
  let oscs: OscillatorNode[] = [];
  let gains: GainNode[] = [];
  let panner: StereoPannerNode | null = null;
  let sirenTimer: ReturnType<typeof setInterval> | null = null;

  const stop = () => {
    if (sirenTimer) { clearInterval(sirenTimer); sirenTimer = null; }
    for (const o of oscs) { try { o.stop(); } catch {} }
    for (const o of oscs) { try { o.disconnect(); } catch {} }
    for (const g of gains) { try { g.disconnect(); } catch {} }
    try { panner?.disconnect(); } catch {}
    oscs = []; gains = []; panner = null;
  };

  /** Cadena maestra: GainNode (envolvente, arranca en 0) -> panner -> salida. */
  const buildChain = (channel: ToneChannel, now: number): GainNode | null => {
    if (!ctx) return null;
    const master = ctx.createGain();
    panner = ctx.createStereoPanner();
    panner.pan.value = panForChannel(channel);
    master.gain.setValueAtTime(0, now);
    master.connect(panner);
    panner.connect(ctx.destination);
    gains.push(master);
    return master;
  };

  /** Añade un parcial (oscilador + ganancia fija `coef`) al nodo maestro. */
  const addPartial = (
    master: GainNode,
    freqHz: number,
    coef: number,
    now: number,
    type: 'sine' | 'square' | 'triangle' = 'sine',
  ): OscillatorNode | null => {
    if (!ctx) return null;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = freqHz;
    const g = ctx.createGain();
    g.gain.value = coef;
    o.connect(g);
    g.connect(master);
    o.start(now);
    oscs.push(o);
    gains.push(g);
    return o;
  };

  const playTone = (freq: ToneTarget, dbHL: number, channel: ToneChannel) => {
    if (!ctx) return;
    stop();
    // Si el sistema suspendió el contexto (interrupción, cambio de ruta de
    // audio, arranque en segundo plano), reactivarlo antes de programar el
    // estímulo: un contexto suspendido reproduce silencio sin dar error.
    resumeAudioContext();
    const now = ctx.currentTime;

    if (typeof freq === 'number') {
      // --- Estímulo tonal calibrado con timbre de instrumento -------------
      // Envolvente = ganancia maestra en fracciones del nivel calibrado.
      // Los recorridos terminan en 0 antes del corte del hook (1400 ms) para
      // cerrar siempre sin click. Frecuencias sin instrumento asignado suenan
      // como tono puro (comportamiento anterior).
      const level = dbHLtoGain(dbHL, freq);
      const master = buildChain(channel, now);
      if (!master) return;
      const seg = (v: number, t: number) =>
        master.gain.linearRampToValueAtTime(v * level, now + t);
      const stopAll = (t: number) => {
        for (const o of oscs) { try { o.stop(now + t); } catch {} }
      };

      if (freq === 500) {
        // Tambor: tres golpes secos, cada uno con caída rápida de tono en el
        // ataque (el «boing» de la piel) y decaimiento percusivo.
        const o = addPartial(master, 500, 1, now);
        if (!o) return;
        for (const tS of [0, 0.45, 0.9]) {
          o.frequency.setValueAtTime(565, now + tS);
          o.frequency.linearRampToValueAtTime(500, now + tS + 0.05);
          master.gain.setValueAtTime(0, now + tS);
          seg(1, tS + 0.012);
          seg(0.3, tS + 0.13);
          seg(0.06, tS + 0.3);
          seg(0, tS + 0.42);
        }
        stopAll(1.35);
      } else if (freq === 1000) {
        // Piano: nota pulsada — ataque casi instantáneo, brillo de armónicos
        // 2 y 3 y caída natural de cuerda.
        addPartial(master, 1000, 0.75, now);
        addPartial(master, 2000, 0.18, now);
        addPartial(master, 3000, 0.07, now);
        seg(1, 0.008);
        seg(0.45, 0.25);
        seg(0.2, 0.7);
        seg(0, 1.3);
        stopAll(1.35);
      } else if (freq === 2000) {
        // Campana: tañido largo con batido lento (par desafinado ±1.5 Hz
        // alrededor de la nominal) y un parcial agudo inarmónico (~×2.5).
        addPartial(master, 1998.5, 0.4, now);
        addPartial(master, 2001.5, 0.4, now);
        addPartial(master, 4960, 0.18, now);
        seg(1, 0.006);
        seg(0.5, 0.4);
        seg(0.22, 0.85);
        seg(0, 1.32);
        stopAll(1.35);
      } else if (freq === 4000) {
        // Flauta: ataque suave (soplo), sostenido con vibrato de ~5 Hz y
        // cierre en fundido.
        const o = addPartial(master, 4000, 0.9, now);
        if (!o) return;
        addPartial(master, 8000, 0.08, now);
        seg(1, 0.15);
        seg(0.95, 1.1);
        seg(0, 1.3);
        for (let k = 0; k < 10; k++) {
          o.frequency.linearRampToValueAtTime(4000 + (k % 2 ? -25 : 25), now + 0.2 + k * 0.1);
        }
        stopAll(1.35);
      } else {
        // Tono puro con rampas anti-click (frecuencias no clínicas).
        const o = addPartial(master, freq, 1, now);
        if (!o) return;
        const end = now + toneDurationMs / 1000;
        master.gain.linearRampToValueAtTime(level, now + 0.02);
        master.gain.setValueAtTime(level, end - 0.02);
        master.gain.linearRampToValueAtTime(0, end);
        try { o.stop(end); } catch {}
      }
    } else {
      // --- Sonido de control no tonal ------------------------------------
      // Nivel de control alto y fijo: solo condiciona la atención, no umbral.
      // 0.5 (≈ −6 dBFS): con la escala de tonos anclada al altavoz, el sonido
      // de control debe seguir siendo claramente más llamativo que los tonos
      // del rango de trabajo (el 0.18 anterior quedaba flojo por el altavoz).
      // 'amb' = sirena de ambulancia (dos tonos alternos).
      // 'tren' = silbato de tren (tono grave sostenido con vibrato lento).
      const master = buildChain(channel, now);
      if (!master) return;
      master.gain.linearRampToValueAtTime(0.5, now + 0.02); // anti-click 20 ms
      const o = addPartial(master, freq === 'amb' ? 650 : 520, 1, now, freq === 'amb' ? 'square' : 'triangle');
      if (!o) return;
      let phase = 0;
      sirenTimer = setInterval(() => {
        if (!ctx) return;
        if (freq === 'amb') {
          phase = 1 - phase;
          o.frequency.setValueAtTime(phase ? 900 : 650, ctx.currentTime);
        } else {
          phase += 0.35;
          o.frequency.setValueAtTime(520 + 26 * Math.sin(phase), ctx.currentTime);
        }
      }, freq === 'amb' ? 420 : 90);
    }
  };

  setAudiometryToneAdapter({ playTone, stop });

  // Si `recoverAudioContext()` sustituye el contexto muerto por uno nuevo, hay
  // que soltar los nodos del anterior y apuntar al vivo.
  const unsubscribe = onAudioContextChange(next => {
    stop();
    ctx = next;
  });

  return () => {
    unsubscribe();
    stop();
    setAudiometryToneAdapter(null);
    // No se cierra el contexto: es compartido. `releaseAudioContext` solo lo
    // cierra cuando ya no queda ningún consumidor.
    releaseAudioContext();
  };
}
