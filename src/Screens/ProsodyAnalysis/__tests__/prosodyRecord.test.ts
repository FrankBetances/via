import { SAMPLE_RATE } from '@/Screens/VoiceAnalysis/voiceDsp';
import { analyseProsody } from '../prosodyDsp';
import {
  areProsodyTakesComparable,
  hasPublishableMetrics,
  toProsodyMetricsRecord,
} from '../prosodyRecord';

/* -------------------------------------------------------------------------- */
/*  Persistencia del análisis prosódico (B3).                                  */
/*                                                                            */
/*  Lo que se vigila aquí no es el cálculo —eso es `prosodyDsp.test.ts`— sino  */
/*  el CONTRATO de lo que sale del módulo hacia la base de datos:              */
/*   · que no se filtre audio ni contornos (Zero-PHI),                         */
/*   · que `null` sobreviva al mapeo y no se convierta en 0.                   */
/*                                                                            */
/*  El guardián de registro en el DataSource vive en                           */
/*  `scripts/__tests__/prosodyPersistence.test.js`, junto al resto de guardias */
/*  de arquitectura que inspeccionan el fuente.                                */
/* -------------------------------------------------------------------------- */

/** Habla sintética mínima: unas cuantas sílabas con una pausa. */
function synthSpeech(): Float32Array {
  const segs: Array<{ voiced: boolean; sec: number }> = [];
  for (let i = 0; i < 12; i++) {
    if (i) segs.push({ voiced: false, sec: 0.06 });
    segs.push({ voiced: true, sec: 0.22 });
  }
  segs.splice(12, 0, { voiced: false, sec: 0.5 });

  const total = segs.reduce((a, s) => a + s.sec, 0);
  const out = new Float32Array(Math.floor(total * SAMPLE_RATE));
  let seed = 4242;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  let phase = 0;
  let idx = 0;
  for (const seg of segs) {
    const len = Math.floor(seg.sec * SAMPLE_RATE);
    for (let j = 0; j < len && idx < out.length; j++, idx++) {
      if (seg.voiced) {
        const frac = len > 1 ? j / (len - 1) : 0;
        phase += (2 * Math.PI * 200) / SAMPLE_RATE;
        const env = 0.5 - 0.5 * Math.cos(2 * Math.PI * frac);
        out[idx] =
          0.3 * env * ((Math.sin(phase) + 0.5 * Math.sin(2 * phase)) / 1.5) +
          (rand() - 0.5) * 0.0008;
      } else {
        out[idx] = (rand() - 0.5) * 0.0008;
      }
    }
  }
  return out;
}

describe('toProsodyMetricsRecord – Zero-PHI', () => {
  it('no deja pasar contornos, tiempos silábicos ni ninguna serie temporal', async () => {
    const result = await analyseProsody(synthSpeech());
    // El resultado del DSP SÍ los trae: si no, la prueba no probaría nada.
    expect(result.contours.f0St.length).toBeGreaterThan(0);
    expect(result.syllableTimesSec.length).toBeGreaterThan(0);

    const record = toProsodyMetricsRecord(result);
    const keys = Object.keys(record);
    expect(keys).not.toContain('contours');
    expect(keys).not.toContain('syllableTimesSec');
    expect(keys).not.toContain('pauses');

    // Ningún valor persistido puede ser un array o un buffer: todas las
    // métricas son escalares. Un array aquí sería una serie temporal colada.
    for (const value of Object.values(record)) {
      expect(Array.isArray(value)).toBe(false);
      expect(ArrayBuffer.isView(value as object)).toBe(false);
      expect(value === null || typeof value === 'number').toBe(true);
    }
  });

  it('el registro tiene exactamente los campos declarados, ni uno más', async () => {
    const record = toProsodyMetricsRecord(await analyseProsody(synthSpeech()));
    expect(Object.keys(record).sort()).toEqual(
      [
        'articulationRateSps',
        'durationSec',
        'f0MedianHz',
        'f0RangeSt',
        'f0SdSt',
        'finalContourSt',
        'intensitySdDb',
        'pauseCount',
        'pauseMeanSec',
        'pauseTotalSec',
        'phonationTimeSec',
        'spanSec',
        'speechRateSps',
        'syllableCount',
        'voicedFraction',
      ].sort(),
    );
  });
});

describe('toProsodyMetricsRecord – «no medido» sobrevive al mapeo', () => {
  it('una toma en silencio persiste null, nunca cero', async () => {
    const result = await analyseProsody(new Float32Array(SAMPLE_RATE * 3));
    const record = toProsodyMetricsRecord(result);
    expect(record.pauseCount).toBeNull();
    expect(record.syllableCount).toBeNull();
    expect(record.f0MedianHz).toBeNull();
    expect(record.speechRateSps).toBeNull();
    // La duración sí se conoce: la toma existió, aunque estuviera vacía.
    expect(record.durationSec).toBeCloseTo(3, 5);
  });

  it('hasPublishableMetrics distingue toma medida de toma no concluyente', async () => {
    const conHabla = toProsodyMetricsRecord(await analyseProsody(synthSpeech()));
    const enSilencio = toProsodyMetricsRecord(
      await analyseProsody(new Float32Array(SAMPLE_RATE * 3)),
    );
    expect(hasPublishableMetrics(conHabla)).toBe(true);
    expect(hasPublishableMetrics(enSilencio)).toBe(false);
  });
});

describe('areProsodyTakesComparable – B0.2', () => {
  it('solo compara tomas de la misma tarea', () => {
    expect(areProsodyTakesComparable('narracion-lamina', 'narracion-lamina')).toBe(true);
    expect(areProsodyTakesComparable('narracion-lamina', 'lectura')).toBe(false);
    expect(areProsodyTakesComparable('recuento-historia', 'narracion-lamina')).toBe(false);
  });
});

