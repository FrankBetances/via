import {
  clampSample,
  playbackNormalizationGain,
  PLAYBACK_MAX_GAIN,
  PLAYBACK_TARGET_PEAK,
} from '../playbackGain';

/* -------------------------------------------------------------------------- */
/*  Ganancia de reproducción de las tomas.                                     */
/*                                                                            */
/*  La captura va en modo «measurement» (sin AGC), así que la toma llega a     */
/*  ~−30 dBFS y en el altavoz de una tableta casi no se oye. Se normaliza solo */
/*  para ESCUCHAR. Lo que estas pruebas fijan es que la normalización no se    */
/*  convierta en un amplificador de ruido: sin tope, una toma de silencio      */
/*  pediría ×850 y devolvería el suelo del micrófono a todo volumen.           */
/* -------------------------------------------------------------------------- */

const withPeak = (peak: number, n = 64): Float32Array => {
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = (i % 2 === 0 ? peak : -peak) * (i === 0 ? 1 : 0.4);
  out[0] = peak;
  return out;
};

describe('playbackNormalizationGain', () => {
  it('lleva una toma floja al pico objetivo', () => {
    const gain = playbackNormalizationGain(withPeak(0.05));
    expect(0.05 * gain).toBeCloseTo(PLAYBACK_TARGET_PEAK, 5);
  });

  it('una toma a −30 dBFS queda audible aunque muerda el tope', () => {
    // −30 dBFS (pico 0,032) es el caso típico de la captura «measurement»:
    // llegar a 0,85 pediría ×27, por encima del tope. El tope manda, y lo que
    // importa es que la toma acabe igualmente en zona audible.
    const peak = 0.032;
    const gain = playbackNormalizationGain(withPeak(peak));
    expect(gain).toBe(PLAYBACK_MAX_GAIN);
    expect(peak * gain).toBeGreaterThan(0.6); // > −4,4 dBFS
    expect(peak * gain).toBeLessThanOrEqual(1);
  });

  it('no amplifica una toma que ya llega al pico objetivo', () => {
    expect(playbackNormalizationGain(withPeak(0.85))).toBeCloseTo(1, 5);
  });

  it('ATENÚA una toma saturada en vez de dejarla recortando', () => {
    const gain = playbackNormalizationGain(withPeak(1));
    expect(gain).toBeLessThan(1);
    expect(1 * gain).toBeCloseTo(PLAYBACK_TARGET_PEAK, 5);
  });

  it('no sube el suelo de ruido: una toma de silencio se queda como está', () => {
    // 0.001 de pico es silencio digital / ruido remoto. Sin el suelo, la
    // normalización pediría ×850 y lo pondría a todo volumen.
    expect(playbackNormalizationGain(withPeak(0.001))).toBe(1);
    expect(playbackNormalizationGain(new Float32Array(0))).toBe(1);
  });

  it('tiene tope de amplificación', () => {
    // Justo por encima del suelo: el objetivo pediría ×425.
    expect(playbackNormalizationGain(withPeak(0.0021))).toBe(PLAYBACK_MAX_GAIN);
  });
});

describe('clampSample', () => {
  it('acota al rango válido de un canal de audio', () => {
    expect(clampSample(2)).toBe(1);
    expect(clampSample(-2)).toBe(-1);
    expect(clampSample(0.5)).toBe(0.5);
  });
});
