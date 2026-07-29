import { analysePcm, conditionForAnalysis, createVoiceHighpass, SAMPLE_RATE } from '../voiceDsp';
import { computeParams } from '../useVoiceAnalysis';

/* -------------------------------------------------------------------------- */
/*  Regresión del bug «el análisis acústico no funciona».                      */
/*                                                                             */
/*  El módulo NO fallaba de forma visible: con contaminación de baja           */
/*  frecuencia en la captura (componente continua del convertidor, deriva de   */
/*  línea de base al mover el equipo, retumbe de climatización) devolvía       */
/*  números PLAUSIBLES pero falsos —F0 doblada, jitter y shimmer de voz        */
/*  gravemente patológica, formantes fuera de banda— sobre una emisión sana.   */
/*  Es el peor modo de fallo posible en un SaMD, así que aquí queda fijado.    */
/* -------------------------------------------------------------------------- */

jest.setTimeout(60000);

/**
 * /a/ sostenida sintética: tren de armónicos de `f0` conformado por una
 * envolvente con tres resonancias (≈700, 1200 y 2600 Hz). Opcionalmente se le
 * suma componente continua y/o deriva de baja frecuencia.
 */
const vowel = (
  f0: number,
  secs: number,
  { dc = 0, driftHz = 0, driftAmp = 0 }: { dc?: number; driftHz?: number; driftAmp?: number } = {},
): Float32Array => {
  const n = Math.floor(SAMPLE_RATE * secs);
  const x = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let h = 1; h <= 30; h++) {
      const f = f0 * h;
      if (f > 5000) break;
      const env =
        1 / (1 + Math.pow((f - 700) / 120, 2)) +
        0.6 / (1 + Math.pow((f - 1200) / 160, 2)) +
        0.3 / (1 + Math.pow((f - 2600) / 220, 2)) +
        0.02;
      s += env * Math.sin((2 * Math.PI * f * i) / SAMPLE_RATE + h);
    }
    x[i] = 0.08 * s + dc + driftAmp * Math.sin((2 * Math.PI * driftHz * i) / SAMPLE_RATE);
  }
  return x;
};

const analyse = async (pcm: Float32Array) => computeParams(await analysePcm(pcm));

describe('analysePcm · una /a/ sana se mide como sana pese a la contaminación', () => {
  it.each([
    ['sin contaminar', {}],
    ['componente continua pequeña', { dc: 0.05 }],
    ['componente continua fuerte', { dc: 0.2 }],
    ['deriva de línea de base (3 Hz)', { driftHz: 3, driftAmp: 0.3 }],
    ['retumbe de climatización (20 Hz)', { driftHz: 20, driftAmp: 0.3 }],
  ])('voz infantil de 200 Hz · %s', async (_label, contamination) => {
    const r = await analyse(vowel(200, 3, contamination));
    expect(r).not.toBeNull();
    // F0 correcta: sin el acondicionado salía DOBLADA (~400 Hz), porque la
    // componente lenta correlaciona consigo misma a todos los lags y rompe la
    // normalización de la autocorrelación.
    expect(r!.f0).toBeGreaterThan(190);
    expect(r!.f0).toBeLessThan(210);
    // Perturbación de voz sana: antes salían jitter ~33 % y shimmer ~45 %.
    expect(r!.jitter).toBeLessThan(1);
    expect(r!.shimmer).toBeLessThan(5);
    // Formantes dentro de la banda que la LPC analiza (150–4000 Hz).
    expect(r!.formants).not.toBeNull();
    expect(r!.formants!.f1).toBeGreaterThan(600);
    expect(r!.formants!.f1).toBeLessThan(1200);
    expect(r!.formants!.f3).toBeLessThanOrEqual(4000);
  });

  it('voz adulta grave (110 Hz) también se mide bien, con y sin continua', async () => {
    for (const contamination of [{}, { dc: 0.1 }]) {
      const r = await analyse(vowel(110, 3, contamination));
      expect(r).not.toBeNull();
      expect(r!.f0).toBeGreaterThan(105);
      expect(r!.f0).toBeLessThan(115);
    }
  });

  it('F3 se mide, no se fabrica: nunca sale por encima de la banda de la LPC', async () => {
    // El respaldo histórico era `mediana(F2)·2`, que devolvía valores de ~5 kHz
    // —imposibles para un análisis que solo mira hasta 4 kHz— presentados en el
    // informe como dato medido.
    for (const f0 of [110, 160, 200, 260]) {
      const r = await analyse(vowel(f0, 2.5));
      if (r?.formants) {
        expect(r.formants.f3).toBeLessThanOrEqual(4000);
        expect(r.formants.f3).toBeGreaterThan(r.formants.f2);
      }
    }
  });

  it('el silencio sigue siendo insuficiente (no se inventa una voz)', async () => {
    expect(await analyse(new Float32Array(SAMPLE_RATE * 2))).toBeNull();
  });

  it('no modifica el PCM de la toma (la reproducción debe sonar como se grabó)', async () => {
    const pcm = vowel(200, 1, { dc: 0.2 });
    const copy = Float32Array.from(pcm);
    await analysePcm(pcm);
    expect(Array.from(pcm)).toEqual(Array.from(copy));
  });
});

describe('acondicionado de la señal', () => {
  it('quita continua y deriva, y deja intacta la banda de la voz', () => {
    const n = SAMPLE_RATE; // 1 s
    const voz = new Float32Array(n);
    const sucia = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      voz[i] = 0.2 * Math.sin((2 * Math.PI * 200 * i) / SAMPLE_RATE);
      sucia[i] = voz[i] + 0.4 + 0.3 * Math.sin((2 * Math.PI * 2 * i) / SAMPLE_RATE);
    }
    const limpia = conditionForAnalysis(sucia);

    const mean = (x: Float32Array) => x.reduce((a, b) => a + b, 0) / x.length;
    const rms = (x: Float32Array) => Math.sqrt(x.reduce((a, b) => a + b * b, 0) / x.length);
    expect(Math.abs(mean(limpia))).toBeLessThan(1e-3);
    // La componente de 200 Hz sobrevive con su nivel (el corte está en 55 Hz).
    const from = Math.floor(SAMPLE_RATE / 4);
    expect(rms(limpia.subarray(from))).toBeCloseTo(rms(voz.subarray(from)), 2);
  });

  it('el pasa-alto conserva el estado entre bloques y reset() lo devuelve al inicio', () => {
    const hp = createVoiceHighpass();
    const block = new Float32Array(1024).fill(0.3);
    const first = Array.from(hp.process(block));
    hp.process(block);
    hp.reset();
    expect(Array.from(hp.process(block))).toEqual(first);
  });
});
