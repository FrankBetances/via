import { analyseFrame, analysePcm, FRAME, SAMPLE_RATE } from '../voiceDsp';

/* -------------------------------------------------------------------------- */
/*  Pruebas del DSP acústico. Regresión del bug «captura insuficiente»:        */
/*  la app grababa y guardaba la toma pero el análisis devolvía siempre        */
/*  «sin datos suficientes» por (1) error de octava en la F0 (subarmónico a    */
/*  ~100 Hz, descartado por el filtro) y (2) orden LPC demasiado bajo para     */
/*  resolver F1 en voz infantil.                                               */
/* -------------------------------------------------------------------------- */

const CAPTURE_SR = SAMPLE_RATE * 3; // el adaptador decima ×3 desde 48 kHz

/** Vocal sintética a 16 kHz: tren de pulsos glotales F0 + resonadores IIR de
 *  formantes (2 polos por formante), como una vocal sostenida. */
function synthVowel({
  f0,
  seconds = 4,
  formants,
  jitterPct = 0.4,
  amp = 0.25,
  noise = 0.01,
}: {
  f0: number;
  seconds?: number;
  formants: Array<[number, number]>;
  jitterPct?: number;
  amp?: number;
  noise?: number;
}): Float32Array {
  const n = Math.floor(SAMPLE_RATE * seconds);
  const src = new Float64Array(n);
  let t = 0;
  // Semilla determinista para reproducibilidad de la prueba.
  let seed = 12345;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  while (t < n) {
    src[Math.floor(t)] = 1;
    const period = SAMPLE_RATE / (f0 * (1 + (rand() - 0.5) * 2 * (jitterPct / 100)));
    t += period;
  }
  const out = new Float64Array(n);
  for (const [fc, bw] of formants) {
    const r = Math.exp((-Math.PI * bw) / SAMPLE_RATE);
    const theta = (2 * Math.PI * fc) / SAMPLE_RATE;
    const a1 = 2 * r * Math.cos(theta);
    const a2 = -r * r;
    let y1 = 0;
    let y2 = 0;
    for (let i = 0; i < n; i++) {
      const y = src[i] + a1 * y1 + a2 * y2;
      out[i] += y;
      y2 = y1;
      y1 = y;
    }
  }
  let max = 0;
  for (let i = 0; i < n; i++) max = Math.max(max, Math.abs(out[i]));
  const pcm = new Float32Array(n);
  for (let i = 0; i < n; i++) pcm[i] = (out[i] / (max || 1)) * amp + (rand() - 0.5) * 2 * noise;
  return pcm;
}

describe('analyseFrame – F0 por autocorrelación', () => {
  // Ventana sinusoidal pura de F0 conocida (sin salto de octava esperado).
  const sineFrame = (f0: number): Float32Array => {
    const x = new Float32Array(FRAME);
    for (let i = 0; i < FRAME; i++) x[i] = 0.3 * Math.sin((2 * Math.PI * f0 * i) / SAMPLE_RATE);
    return x;
  };

  it.each([150, 200, 250, 300, 350, 400])('estima F0≈%i Hz sin error de octava', f0 => {
    const res = analyseFrame(sineFrame(f0));
    expect(res).not.toBeNull();
    expect(res!.f0).toBeGreaterThan(f0 - 12);
    expect(res!.f0).toBeLessThan(f0 + 12);
  });

  it('devuelve null para silencio (por debajo del umbral de sonoridad)', () => {
    expect(analyseFrame(new Float32Array(FRAME))).toBeNull();
  });

  it('devuelve null para ruido no periódico', () => {
    const x = new Float32Array(FRAME);
    let seed = 7;
    for (let i = 0; i < FRAME; i++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      x[i] = (seed / 0x7fffffff - 0.5) * 0.2;
    }
    expect(analyseFrame(x)).toBeNull();
  });
});

describe('analysePcm – análisis completo de una toma /a/ infantil', () => {
  const cases: Array<{ label: string; f0: number; formants: Array<[number, number]> }> = [
    { label: 'niño F0=250', f0: 250, formants: [[900, 60], [1500, 90], [2900, 120]] },
    { label: 'niño F0=300', f0: 300, formants: [[1000, 80], [1700, 100], [3200, 150]] },
    { label: 'niño F0=350', f0: 350, formants: [[1100, 90], [1800, 110], [3400, 160]] },
    { label: 'niña F0=400', f0: 400, formants: [[1150, 90], [1900, 120], [3500, 160]] },
  ];

  it.each(cases)('$label produce parámetros interpretables (no «insuficiente»)', async ({ f0, formants }) => {
    const pcm = synthVowel({ f0, formants });
    const r = await analysePcm(pcm);

    // (1) Suficientes ventanas sonoras con F0 en rango plausible (el filtro de
    // computeParams exige >= 8 en [65, 520] Hz).
    const valid = r.f0s.filter(f => f >= 65 && f <= 520);
    expect(valid.length).toBeGreaterThanOrEqual(8);

    // La F0 media cae cerca de la real (sin colapsar al subarmónico ~100 Hz).
    const meanF0 = valid.reduce((a, b) => a + b, 0) / valid.length;
    expect(meanF0).toBeGreaterThan(f0 - 30);
    expect(meanF0).toBeLessThan(f0 + 30);

    // (2) Formantes estimables (F1 resuelto pese a la F0 alta infantil).
    expect(r.formants).not.toBeNull();
    expect(r.formants!.f1).toBeGreaterThan(300);
    expect(r.formants!.f2).toBeGreaterThan(r.formants!.f1);
  });

  // Regresión del bug «siempre insuficiente» con micrófonos de ganancia baja:
  // la captura sin AGC (modo measurement) puede entregar RMS muy por debajo del
  // antiguo umbral absoluto (0.015) aunque la voz se oiga bien al reproducir.
  // El umbral de sonoridad ahora es relativo al nivel de la propia toma.
  it.each([0.05, 0.02, 0.01])(
    'una toma de nivel bajo (amp=%d) sigue siendo analizable',
    async amp => {
      const pcm = synthVowel({ f0: 250, formants: cases[0].formants, amp, noise: amp / 25 });
      const r = await analysePcm(pcm);
      const valid = r.f0s.filter(f => f >= 65 && f <= 520);
      expect(valid.length).toBeGreaterThanOrEqual(8);
      const meanF0 = valid.reduce((a, b) => a + b, 0) / valid.length;
      expect(meanF0).toBeGreaterThan(220);
      expect(meanF0).toBeLessThan(280);
      expect(r.formants).not.toBeNull();
    },
  );

  // Regresión del bug «voz insuficiente» con voz ADULTA: la banda de análisis
  // histórica (100–500 Hz) dejaba fuera la voz masculina grave (una /a/
  // relajada cae en 80–100 Hz). Con el paso-alto típico del micrófono de un
  // móvil (que atenúa el fundamental) la autocorrelación no hallaba ningún
  // periodo y toda toma de un adulto acababa en «captura insuficiente» aunque
  // la grabación fuera perfecta. La banda ahora baja hasta 70 Hz.
  describe('voz adulta grave (p. ej. el clínico probando la app con su voz)', () => {
    /** Paso-alto de 1er orden ~150 Hz, como el acoplamiento AC del mic MEMS. */
    const highpass = (pcm: Float32Array, fc = 150): Float32Array => {
      const rc = 1 / (2 * Math.PI * fc);
      const dt = 1 / SAMPLE_RATE;
      const a = rc / (rc + dt);
      const out = new Float32Array(pcm.length);
      let yPrev = 0;
      let xPrev = 0;
      for (let i = 0; i < pcm.length; i++) {
        yPrev = a * (yPrev + pcm[i] - xPrev);
        xPrev = pcm[i];
        out[i] = yPrev;
      }
      return out;
    };

    it.each([80, 90, 100, 120])(
      'F0=%i Hz con fundamental atenuado produce parámetros interpretables',
      async f0 => {
        const pcm = highpass(
          synthVowel({ f0, formants: [[750, 60], [1200, 90], [2600, 130]], jitterPct: 1 }),
        );
        const r = await analysePcm(pcm);
        const valid = r.f0s.filter(f => f >= 65 && f <= 520);
        expect(valid.length).toBeGreaterThanOrEqual(8);
        const meanF0 = valid.reduce((a, b) => a + b, 0) / valid.length;
        expect(meanF0).toBeGreaterThan(f0 * 0.85);
        expect(meanF0).toBeLessThan(f0 * 1.15);
        expect(r.formants).not.toBeNull();
      },
    );
  });

  it('una toma en silencio (solo ruido de fondo ínfimo) sigue siendo insuficiente', async () => {
    const n = SAMPLE_RATE * 4;
    const pcm = new Float32Array(n);
    let seed = 4242;
    for (let i = 0; i < n; i++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      pcm[i] = (seed / 0x7fffffff - 0.5) * 0.002; // ~-60 dBFS
    }
    const r = await analysePcm(pcm);
    expect(r.f0s.length).toBe(0);
    expect(r.formants).toBeNull();
  });

  it('una toma de puro ruido sigue considerándose insuficiente (sin formantes)', async () => {
    const n = SAMPLE_RATE * 4;
    const pcm = new Float32Array(n);
    let seed = 99;
    for (let i = 0; i < n; i++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      pcm[i] = (seed / 0x7fffffff - 0.5) * 0.1;
    }
    const r = await analysePcm(pcm);
    expect(r.formants).toBeNull();
  });
});

describe('coherencia de la cadena de captura', () => {
  it('SAMPLE_RATE es 16 kHz (48 kHz decimado ×3)', () => {
    expect(SAMPLE_RATE).toBe(16000);
    expect(CAPTURE_SR).toBe(48000);
  });
});
