import { SAMPLE_RATE } from '@/Screens/VoiceAnalysis/voiceDsp';
import {
  analyseProsody,
  detectPauses,
  detectSyllableNuclei,
  hzToSemitones,
  intensityContour,
  intensityTime,
  linearSlope,
  MIN_SPAN_FOR_RATE_SEC,
  percentile,
  PAUSE_MIN_SEC,
  stdDev,
} from '../prosodyDsp';

/* -------------------------------------------------------------------------- */
/*  Pruebas del DSP de prosodia sobre HABLA CONECTADA sintética.               */
/*                                                                            */
/*  Todas las señales son DETERMINISTAS (generador congruencial con semilla    */
/*  fija, sin `Math.random`): el mismo caso produce siempre la misma señal, de */
/*  modo que un cambio en las cifras es un cambio real del DSP y no ruido de   */
/*  muestreo. Es el mismo criterio de `tools/acoustics/fixtures.js`.           */
/*                                                                            */
/*  Lo que se comprueba aquí es que el módulo mide lo que dice medir cuando la */
/*  respuesta es conocida de antemano: 16 sílabas son 16, una pausa de 500 ms  */
/*  es una pausa de 500 ms, y una oclusión de 60 ms NO es una pausa.           */
/* -------------------------------------------------------------------------- */

type Seg =
  /** Sílaba sonora: vocal con envolvente de coseno alzado (un pico por sílaba). */
  | { kind: 'syllable'; durSec: number; f0: number; f0End?: number }
  /** Oclusión consonántica: casi silencio, pero demasiado corta para ser pausa. */
  | { kind: 'gap'; durSec: number }
  /** Pausa del habla: silencio real. */
  | { kind: 'pause'; durSec: number };

/**
 * Sintetiza habla conectada a 16 kHz. La «vocal» es un tono con tres armónicos
 * —suficiente para que la autocorrelación de `analyseFrame` enganche el periodo
 * sin ambigüedad— modulado por una envolvente de coseno alzado, que garantiza
 * un único máximo de intensidad por sílaba.
 */
function synthSpeech(
  segments: Seg[],
  { amp = 0.3, gapAmp = 0.004, noise = 0.0004 } = {},
): Float32Array {
  const totalSec = segments.reduce((acc, s) => acc + s.durSec, 0);
  const n = Math.floor(totalSec * SAMPLE_RATE);
  const out = new Float32Array(n);

  let seed = 987654321;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };

  let phase = 0;
  let idx = 0;
  for (const seg of segments) {
    const len = Math.floor(seg.durSec * SAMPLE_RATE);
    for (let j = 0; j < len && idx < n; j++, idx++) {
      let a = 0;
      let value = 0;
      if (seg.kind === 'syllable') {
        const frac = len > 1 ? j / (len - 1) : 0;
        // Glissando lineal si se pide `f0End` (para probar el contorno final).
        const f0 = seg.f0End !== undefined ? seg.f0 + (seg.f0End - seg.f0) * frac : seg.f0;
        phase += (2 * Math.PI * f0) / SAMPLE_RATE;
        value = (Math.sin(phase) + 0.5 * Math.sin(2 * phase) + 0.25 * Math.sin(3 * phase)) / 1.75;
        a = amp * (0.5 - 0.5 * Math.cos(2 * Math.PI * frac));
      } else if (seg.kind === 'gap') {
        a = gapAmp;
        value = (rand() - 0.5) * 2;
      }
      out[idx] = a * value + (rand() - 0.5) * 2 * noise;
    }
  }
  return out;
}

/** Cadena de `count` sílabas separadas por oclusiones, sin pausas. */
function syllableRun(count: number, f0 = 200, sylSec = 0.2, gapSec = 0.06): Seg[] {
  const segs: Seg[] = [];
  for (let i = 0; i < count; i++) {
    if (i) segs.push({ kind: 'gap', durSec: gapSec });
    segs.push({ kind: 'syllable', durSec: sylSec, f0 });
  }
  return segs;
}

/* -------------------------------------------------------------------------- */
/*  Estadística auxiliar                                                       */
/* -------------------------------------------------------------------------- */

describe('estadística auxiliar', () => {
  it('percentil interpola linealmente y respeta los extremos', () => {
    const v = [1, 2, 3, 4, 5];
    expect(percentile(v, 0)).toBe(1);
    expect(percentile(v, 1)).toBe(5);
    expect(percentile(v, 0.5)).toBe(3);
    expect(percentile(v, 0.25)).toBeCloseTo(2, 6);
  });

  it('la desviación típica no está definida con menos de dos valores', () => {
    expect(Number.isNaN(stdDev([]))).toBe(true);
    expect(Number.isNaN(stdDev([1]))).toBe(true);
    expect(stdDev([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(2.138, 2);
  });

  it('la pendiente de mínimos cuadrados recupera una recta exacta', () => {
    const xs = [0, 1, 2, 3, 4];
    const ys = xs.map(x => 3 * x - 7);
    expect(linearSlope(xs, ys)).toBeCloseTo(3, 9);
  });

  it('una octava son 12 semitonos, en los dos sentidos', () => {
    expect(hzToSemitones(200) - hzToSemitones(100)).toBeCloseTo(12, 9);
    expect(hzToSemitones(100) - hzToSemitones(200)).toBeCloseTo(-12, 9);
  });
});

/* -------------------------------------------------------------------------- */
/*  Contorno de intensidad                                                     */
/* -------------------------------------------------------------------------- */

describe('intensityContour', () => {
  it('mide en dBFS: amplitud 1.0 constante da ~0 dB', () => {
    const pcm = new Float32Array(SAMPLE_RATE);
    pcm.fill(1);
    const db = intensityContour(pcm);
    expect(db.length).toBeGreaterThan(0);
    for (let k = 0; k < db.length; k++) expect(db[k]).toBeCloseTo(0, 6);
  });

  it('una señal 10× más baja está 20 dB por debajo', () => {
    const loud = new Float32Array(SAMPLE_RATE);
    loud.fill(0.1);
    const quiet = new Float32Array(SAMPLE_RATE);
    quiet.fill(0.01);
    expect(intensityContour(loud)[0] - intensityContour(quiet)[0]).toBeCloseTo(20, 6);
  });

  it('devuelve contorno vacío si la toma es más corta que la ventana', () => {
    expect(intensityContour(new Float32Array(100)).length).toBe(0);
  });
});

/* -------------------------------------------------------------------------- */
/*  Pausas                                                                     */
/* -------------------------------------------------------------------------- */

describe('detectPauses', () => {
  /** Contorno sintético: `frames` valores en dB, ya en la rejilla de intensidad. */
  const contour = (spec: Array<[number, number]>): Float64Array => {
    const out: number[] = [];
    for (const [db, frames] of spec) for (let i = 0; i < frames; i++) out.push(db);
    return Float64Array.from(out);
  };

  /** Nº de tramas de intensidad que ocupan `sec` segundos. */
  const frames = (sec: number) => Math.round((sec * SAMPLE_RATE) / 160);

  it('cuenta una pausa larga interior', () => {
    const db = contour([
      [-10, frames(1)],
      [-60, frames(0.5)],
      [-10, frames(1)],
    ]);
    const { pauses } = detectPauses(db, -35);
    expect(pauses).toHaveLength(1);
    expect(pauses[0].endSec - pauses[0].startSec).toBeCloseTo(0.5, 1);
  });

  it('NO cuenta como pausa una oclusión consonántica corta', () => {
    const short = PAUSE_MIN_SEC / 2;
    const db = contour([
      [-10, frames(1)],
      [-60, frames(short)],
      [-10, frames(1)],
    ]);
    expect(detectPauses(db, -35).pauses).toHaveLength(0);
  });

  it('el silencio inicial y final no son pausas, sino margen de grabación', () => {
    const db = contour([
      [-60, frames(2)],
      [-10, frames(1)],
      [-60, frames(2)],
    ]);
    const { pauses, firstActive, lastActive } = detectPauses(db, -35);
    expect(pauses).toHaveLength(0);
    expect(intensityTime(firstActive)).toBeCloseTo(2 + 0.016, 1);
    expect(intensityTime(lastActive)).toBeCloseTo(3, 1);
  });

  it('una toma enteramente por debajo del umbral no tiene tramo activo', () => {
    const { firstActive } = detectPauses(contour([[-80, 100]]), -35);
    expect(firstActive).toBe(-1);
  });
});

/* -------------------------------------------------------------------------- */
/*  Núcleos silábicos                                                          */
/* -------------------------------------------------------------------------- */

describe('detectSyllableNuclei', () => {
  const alwaysVoiced = () => true;

  it('cuenta un núcleo por pico separado por un valle suficiente', () => {
    // Tres picos de -10 dB separados por valles de -30 dB (caída de 20 dB).
    const out: number[] = [];
    for (let s = 0; s < 3; s++) {
      for (let i = 0; i < 20; i++) out.push(-30);
      out.push(-10);
      for (let i = 0; i < 20; i++) out.push(-30);
    }
    expect(detectSyllableNuclei(Float64Array.from(out), -50, alwaysVoiced)).toHaveLength(3);
  });

  it('la ondulación dentro de una misma vocal no cuenta como varias sílabas', () => {
    // Dos máximos locales separados por un valle de solo 0.5 dB: un solo núcleo.
    const out = [-30, -20, -10, -10.5, -10, -20, -30];
    expect(detectSyllableNuclei(Float64Array.from(out), -50, alwaysVoiced)).toHaveLength(1);
  });

  it('un pico sin sonoridad no es una sílaba', () => {
    const out: number[] = [];
    for (let i = 0; i < 20; i++) out.push(-30);
    out.push(-10);
    for (let i = 0; i < 20; i++) out.push(-30);
    expect(detectSyllableNuclei(Float64Array.from(out), -50, () => false)).toHaveLength(0);
  });

  it('un pico por debajo del umbral de silencio no es una sílaba', () => {
    const out = [-70, -60, -70];
    expect(detectSyllableNuclei(Float64Array.from(out), -50, alwaysVoiced)).toHaveLength(0);
  });
});

/* -------------------------------------------------------------------------- */
/*  Análisis completo                                                          */
/* -------------------------------------------------------------------------- */

describe('analyseProsody – salidas tempranas', () => {
  it('toma vacía', async () => {
    const r = await analyseProsody(new Float32Array(0));
    expect(r.stats.reason).toBe('empty');
    expect(r.metrics.pauseCount).toBeNull();
  });

  it('toma en silencio: no inventa métricas', async () => {
    const r = await analyseProsody(new Float32Array(SAMPLE_RATE * 3));
    expect(r.stats.reason).toBe('silent');
    expect(r.metrics.syllableCount).toBeNull();
    expect(r.metrics.f0MedianHz).toBeNull();
    expect(r.metrics.speechRateSps).toBeNull();
  });

  it('toma más corta que la ventana de análisis', async () => {
    const r = await analyseProsody(new Float32Array(64));
    expect(r.stats.reason).toBe('too-short');
  });

  /* REGRESIÓN — umbral relativo colapsado.
   *
   * `SILENCE_THRESHOLD_DB` se aplica sobre el percentil 99 de la PROPIA toma.
   * En una grabación sin habla ese nivel de referencia cae al suelo del
   * contorno, el umbral se hunde con él y todas las tramas quedan «por encima»:
   * el módulo declaraba habla la toma entera y publicaba tasa de habla, pausas
   * y sonoridad sobre una grabación en la que no habló nadie. La salvaguarda es
   * el suelo absoluto `ABSOLUTE_SILENCE_DB`. */
  it('una sala vacía con ruido de fondo no se lee como habla', async () => {
    // Ruido determinista muy por debajo del suelo absoluto de sonoridad.
    const pcm = new Float32Array(SAMPLE_RATE * 4);
    let seed = 24680;
    for (let i = 0; i < pcm.length; i++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      pcm[i] = (seed / 0x7fffffff - 0.5) * 2 * 0.0002;
    }
    const r = await analyseProsody(pcm);
    expect(r.stats.reason).toBe('silent');
    expect(r.metrics.speechRateSps).toBeNull();
    expect(r.metrics.syllableCount).toBeNull();
    expect(r.metrics.voicedFraction).toBeNull();
  });
});

describe('analyseProsody – habla conectada de referencia', () => {
  // 16 sílabas de 200 ms con oclusiones de 60 ms y UNA pausa de 500 ms al
  // centro. Duración ≈ 4.6 s. Todo conocido de antemano.
  const SYLLABLES = 16;
  const PAUSE_SEC = 0.5;
  const build = () => {
    const half = syllableRun(SYLLABLES / 2);
    return synthSpeech([
      ...half,
      { kind: 'pause', durSec: PAUSE_SEC },
      ...half,
    ]);
  };

  it('recupera el recuento de sílabas', async () => {
    const r = await analyseProsody(build());
    expect(r.metrics.syllableCount).toBe(SYLLABLES);
  });

  it('cuenta la pausa larga y ninguna de las oclusiones', async () => {
    const r = await analyseProsody(build());
    expect(r.metrics.pauseCount).toBe(1);
    expect(r.metrics.pauseTotalSec).toBeCloseTo(PAUSE_SEC, 1);
  });

  it('recupera la F0 de la síntesis', async () => {
    const r = await analyseProsody(build());
    expect(r.metrics.f0MedianHz).not.toBeNull();
    expect(r.metrics.f0MedianHz as number).toBeCloseTo(200, -1); // ±5 Hz
  });

  it('la tasa de articulación es mayor que la de habla, porque descuenta la pausa', async () => {
    const r = await analyseProsody(build());
    const speech = r.metrics.speechRateSps as number;
    const artic = r.metrics.articulationRateSps as number;
    expect(speech).not.toBeNull();
    expect(artic).toBeGreaterThan(speech);
    // 16 sílabas en ~4.5 s de tramo → ~3.5 sílabas/s.
    expect(speech).toBeGreaterThan(2.5);
    expect(speech).toBeLessThan(5);
  });

  it('un tono plano da un rango tonal estrecho', async () => {
    const r = await analyseProsody(build());
    expect(r.metrics.f0RangeSt).not.toBeNull();
    expect(r.metrics.f0RangeSt as number).toBeLessThan(1.5);
  });

  it('los contornos cubren la toma y marcan como NaN lo no sonoro', async () => {
    const r = await analyseProsody(build());
    const { f0St, f0TimesSec, intensityDb } = r.contours;
    expect(f0St.length).toBe(f0TimesSec.length);
    expect(intensityDb.length).toBeGreaterThan(f0St.length);
    expect(f0St.some(v => Number.isNaN(v))).toBe(true); // pausa y oclusiones
    expect(f0St.some(v => !Number.isNaN(v))).toBe(true);
    expect(r.stats.voicedF0Frames).toBeGreaterThan(0);
  });
});

describe('analyseProsody – contorno final', () => {
  /** Cadena de sílabas cuya última hace un glissando de `from` a `to`. */
  const withFinalGlide = (from: number, to: number) => {
    const segs = syllableRun(10);
    segs[segs.length - 1] = { kind: 'syllable', durSec: 0.5, f0: from, f0End: to };
    return synthSpeech(segs);
  };

  it('un ascenso final da un contorno positivo', async () => {
    const r = await analyseProsody(withFinalGlide(200, 300));
    expect(r.metrics.finalContourSt).not.toBeNull();
    expect(r.metrics.finalContourSt as number).toBeGreaterThan(1);
  });

  it('un descenso final da un contorno negativo', async () => {
    const r = await analyseProsody(withFinalGlide(300, 200));
    expect(r.metrics.finalContourSt).not.toBeNull();
    expect(r.metrics.finalContourSt as number).toBeLessThan(-1);
  });
});

describe('analyseProsody – doctrina de «no medido» frente a «cero»', () => {
  it('una toma demasiado corta no publica tasas, pero sí lo que sí midió', async () => {
    // Dos sílabas: por debajo del mínimo de tramo y de núcleos.
    const pcm = synthSpeech(syllableRun(2));
    const r = await analyseProsody(pcm);
    expect(r.metrics.durationSec).toBeLessThan(MIN_SPAN_FOR_RATE_SEC);
    expect(r.metrics.speechRateSps).toBeNull();
    expect(r.metrics.articulationRateSps).toBeNull();
    // El recuento de sílabas y las pausas sí son medibles en una toma corta.
    expect(r.metrics.syllableCount).toBe(2);
    expect(r.metrics.pauseCount).toBe(0);
  });

  it('cero pausas se distingue de pausas no medidas', async () => {
    const conHabla = await analyseProsody(synthSpeech(syllableRun(16)));
    const enSilencio = await analyseProsody(new Float32Array(SAMPLE_RATE * 3));
    expect(conHabla.metrics.pauseCount).toBe(0); // medido: no hubo pausas
    expect(enSilencio.metrics.pauseCount).toBeNull(); // no medido
  });
});
