import { analysePcm, computeCycleMetrics, SAMPLE_RATE } from '../voiceDsp';
import { computeParams } from '../useVoiceAnalysis';

/* -------------------------------------------------------------------------- */
/*  Jitter y shimmer CICLO A CICLO.                                            */
/*                                                                            */
/*  COSTE REAL (agosto de 2026). Las dos cifras de perturbación del informe    */
/*  salían de las series por VENTANA —una F0 y un RMS cada 16 ms, o sea ya     */
/*  promediados sobre unos cinco ciclos glotales—, y promediar es justo lo que */
/*  borra la perturbación que se quiere medir. El banco de `tools/acoustics/`  */
/*  lo destapó en cuanto se le pidieron estas dos cifras, que hasta entonces   */
/*  NO validaba nadie: sobre 1 % de jitter inyectado VIA+ informaba 0,1 %      */
/*  (Praat: 0,8 %) y sobre 8 % de shimmer informaba 1,3 % (Praat: 5,4 %).      */
/*                                                                            */
/*  Es el error en la dirección peligrosa: una voz patológica leída como sana. */
/*                                                                            */
/*  Estas pruebas fijan la SENSIBILIDAD (que la perturbación inyectada se vea) */
/*  y la ESPECIFICIDAD (que una voz sana no la simule), que son las dos cosas  */
/*  que la vía anterior no tenía a la vez.                                     */
/* -------------------------------------------------------------------------- */

jest.setTimeout(60000);

/**
 * /a/ sostenida por tren de pulsos glotales y resonadores (modelo de Klatt),
 * con jitter y shimmer inyectados de valor conocido.
 *
 * El pulso se reparte entre las dos muestras vecinas: clavarlo con `Math.floor`
 * cuantiza el periodo y, cuando no cabe en un número entero de muestras, el
 * patrón de redondeo se repite y crea un subarmónico REAL (ver el comentario
 * de `voiceDsp.test.ts`).
 */
const synth = ({
  f0,
  seconds = 3,
  formants = [[900, 60], [1500, 90], [2900, 120]] as Array<[number, number]>,
  jitterPct = 0,
  shimmerPct = 0,
  noise = 0,
  amp = 0.25,
}: {
  f0: number;
  seconds?: number;
  formants?: Array<[number, number]>;
  jitterPct?: number;
  shimmerPct?: number;
  noise?: number;
  amp?: number;
}): Float32Array => {
  const n = Math.floor(SAMPLE_RATE * seconds);
  let seed = 987654321;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };

  const src = new Float64Array(n);
  let t = 0;
  while (t < n - 1) {
    const i = Math.floor(t);
    const frac = t - i;
    const pulse = 1 + (rand() - 0.5) * 2 * (shimmerPct / 100);
    src[i] += pulse * (1 - frac);
    src[i + 1] += pulse * frac;
    t += SAMPLE_RATE / (f0 * (1 + (rand() - 0.5) * 2 * (jitterPct / 100)));
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
      y2 = y1;
      y1 = y;
      out[i] += y;
    }
  }
  let peak = 0;
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(out[i]));
  const g = peak > 0 ? amp / peak : 1;
  const x = new Float32Array(n);
  for (let i = 0; i < n; i++) x[i] = out[i] * g + (rand() - 0.5) * 2 * noise;
  return x;
};

const measure = async (pcm: Float32Array) => {
  const r = await analysePcm(pcm);
  const p = computeParams(r);
  expect(p).not.toBeNull();
  return { params: p!, stats: r.stats };
};

describe('la medida ciclo a ciclo llega al informe', () => {
  it('`analysePcm` publica los ciclos glotales que ha podido aislar', async () => {
    const { stats } = await measure(synth({ f0: 220 }));
    expect(stats?.glottalCycles).toBeGreaterThan(100);
    expect(stats?.jitterCyclePct).toBeDefined();
    expect(stats?.shimmerCyclePct).toBeDefined();
  });

  it('`computeParams` PREFIERE la medida por ciclos a la de ventanas', async () => {
    const r = await analysePcm(synth({ f0: 220 }));
    const withCycles = computeParams(r)!;
    const withoutCycles = computeParams({
      ...r,
      stats: { ...r.stats!, jitterCyclePct: undefined, shimmerCyclePct: undefined },
    })!;
    // El respaldo por ventanas sigue existiendo (tomas sin ciclos aislables),
    // pero no es lo que se publica cuando hay ciclos.
    expect(withCycles.jitter).not.toBe(withoutCycles.jitter);
  });
});

describe('SENSIBILIDAD · la perturbación inyectada se ve', () => {
  it('8 % de shimmer no se lee como una voz sana', async () => {
    // La vía por ventanas informaba 1,3 % aquí, dentro de lo que cualquier
    // tabla clínica considera normal (< 3,5 %). Praat mide 5,4 %.
    const { params } = await measure(synth({ f0: 200, shimmerPct: 8 }));
    expect(params.shimmer).toBeGreaterThan(3.5);
  });

  it('1 % de jitter no se lee como una voz sana', async () => {
    // La vía por ventanas informaba 0,1 %, muy por debajo del 0,2–0,8 % de una
    // voz sana. Praat mide 0,6–0,8 %.
    const { params } = await measure(synth({ f0: 200, jitterPct: 1 }));
    expect(params.jitter).toBeGreaterThan(0.3);
  });

  it('más perturbación da más lectura (es monótona)', async () => {
    const suave = await measure(synth({ f0: 200, shimmerPct: 3 }));
    const fuerte = await measure(synth({ f0: 200, shimmerPct: 12 }));
    expect(fuerte.params.shimmer).toBeGreaterThan(suave.params.shimmer);
  });

  it('LIMITACIÓN DECLARADA: el shimmer sigue la perturbación pero la COMPRIME', async () => {
    // Medido contra Praat en `tools/acoustics/` sobre fuente de pulsos a
    // 220 Hz (26/8/2026):
    //
    //   inyectado   Praat   VIA+
    //        4 %     5,4    4,1
    //        8 %     9,6    6,2
    //       16 %    17,6   10,2
    //
    // Es decir: VIA+ infravalora entre 1,3 y 1,7 veces, y la brecha crece con
    // la magnitud. Es mucho mejor que la vía por ventanas que había antes
    // (seis a diez veces), pero NO es paridad con Praat, y conviene tenerlo
    // escrito porque en su día se afirmó que sí lo era.
    //
    // La causa está en la física de la señal, no en un descuido: el resonador
    // sigue sonando de un ciclo al siguiente —a 220 Hz con F1 de 70 Hz de
    // ancho de banda, la cola apenas ha decaído cuando llega el pulso
    // siguiente—, así que la amplitud pico a pico de un ciclo lleva dentro la
    // de los anteriores. Eso es un filtro de paso bajo sobre la secuencia de
    // amplitudes, y comprime.
    //
    // Esta prueba fija los números para que el banco no tenga que dictaminar
    // sobre una limitación ya declarada: si la compresión EMPEORA, falla aquí.
    const cases: Array<[number, number]> = [
      [4, 3.0],
      [8, 5.0],
      [16, 8.0],
    ];
    let previous = 0;
    for (const [inyectado, minimo] of cases) {
      const { params } = await measure(
        synth({
          f0: 220,
          shimmerPct: inyectado,
          formants: [[800, 70], [1400, 100], [2800, 130]],
        }),
      );
      expect(params.shimmer).toBeGreaterThan(minimo);
      expect(params.shimmer).toBeGreaterThan(previous);
      previous = params.shimmer;
    }
  });
});

describe('ESPECIFICIDAD · una voz sana no simula perturbación', () => {
  // Los umbrales son los CLÍNICOS —jitter local < 1 %, shimmer local < 3,5 %
  // en voz sana—, no una cota inventada. Y conviene decir por qué no son más
  // estrechos: cuando el periodo no cabe en un número entero de muestras
  // (106,67 a 150 Hz; 45,71 a 350 Hz), la fase sub-muestra del pulso va
  // rotando y la cresta cae cada vez en un punto distinto entre dos muestras,
  // así que la amplitud medida oscila sola. Es un artefacto de muestreo, no
  // perturbación de la voz. Medido contra Praat en `tools/acoustics/` sobre
  // estas mismas señales, VIA+ queda entre 0,2 y 1,2 puntos por encima de
  // Praat en shimmer (VIA+ 2,3 / Praat 1,4 a 150 Hz; 2,6 / 2,4 a 350 Hz).
  // Lo que estas pruebas garantizan es lo que importa: una voz sana NO se lee
  // como patológica.
  it.each([150, 200, 250, 300, 350, 400])(
    'a %i Hz, una fonación sin perturbar no se lee como patológica',
    async f0 => {
      const { params } = await measure(synth({ f0 }));
      expect(params.jitter).toBeLessThan(1);
      expect(params.shimmer).toBeLessThan(3.5);
    },
  );

  it('el retumbe de climatización (20 Hz) no fabrica shimmer', async () => {
    // La amplitud del ciclo se mide PICO A PICO justamente por esto: un
    // residuo lento que el pasa-alto de 55 Hz atenúa pero no borra desplaza
    // por igual la cresta y el valle, y la diferencia lo cancela. Midiendo el
    // valor absoluto del máximo, esta señal daba 6 % de shimmer (Praat: 2,6 %),
    // o sea una /a/ sana leída como patológica.
    const pcm = synth({ f0: 200 });
    const contaminada = new Float32Array(pcm.length);
    for (let i = 0; i < pcm.length; i++) {
      contaminada[i] = pcm[i] + 0.3 * Math.sin((2 * Math.PI * 20 * i) / SAMPLE_RATE);
    }
    const { params } = await measure(contaminada);
    expect(params.shimmer).toBeLessThan(3.5);
    expect(params.f0).toBeGreaterThan(190);
    expect(params.f0).toBeLessThan(210);
  });

  it('el ruido del micrófono no fabrica jitter', async () => {
    // Contrapunto de lo anterior: aquí es el INSTANTE del pulso el que hay que
    // proteger. Tomar como instante la muestra de máximo valor cuantiza el
    // periodo a un entero —a 16 kHz, un ciclo de 300 Hz son 53,3 muestras—, y
    // un desplazamiento de UNA muestra por ruido ya son ~2 % de jitter
    // aparente. Por eso el vértice se interpola con una parábola.
    const { params } = await measure(synth({ f0: 300, noise: 0.03 }));
    expect(params.jitter).toBeLessThan(1.5);
  });
});

describe('computeCycleMetrics · casos degenerados', () => {
  it('sin tramos sonoros no inventa una medida', () => {
    const m = computeCycleMetrics(new Float32Array(16000), []);
    expect(m.cycles).toBe(0);
    expect(m.jitterLocalPct).toBe(0);
    expect(m.shimmerLocalPct).toBe(0);
  });

  it('descarta un tramo cuyo periodo cae fuera de la banda de F0', () => {
    const m = computeCycleMetrics(new Float32Array(16000), [
      { start: 0, length: 16000, meanPeriod: 4 }, // 4000 Hz: no es voz
    ]);
    expect(m.cycles).toBe(0);
  });
});
