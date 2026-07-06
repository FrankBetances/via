import {
  CLINICAL_FREQS,
  MAX_DB_HL,
  dbHLtoGainFreeField,
  retsplFreeField,
} from '../audiometryCalibration';

/* -------------------------------------------------------------------------- */
/*  Pruebas de la calibración de nivel de la audiometría (infantil y           */
/*  condicionada comparten este mapeo dB HL → ganancia). Regresión del mapeo   */
/*  plano anterior, que emitía el mismo dBFS en todas las frecuencias.         */
/* -------------------------------------------------------------------------- */

describe('retsplFreeField', () => {
  it('devuelve los valores tabulados en los puntos de octava', () => {
    expect(retsplFreeField(500)).toBeCloseTo(4.4, 5);
    expect(retsplFreeField(1000)).toBeCloseTo(2.4, 5);
    expect(retsplFreeField(2000)).toBeCloseTo(-1.3, 5);
    expect(retsplFreeField(4000)).toBeCloseTo(-5.4, 5);
  });

  it('interpola entre puntos y satura fuera de la tabla', () => {
    const mid = retsplFreeField(3000); // punto tabulado -5.8
    expect(mid).toBeCloseTo(-5.8, 5);
    const between = retsplFreeField(1400); // entre 1000 y 1500
    expect(between).toBeLessThanOrEqual(retsplFreeField(1000));
    expect(retsplFreeField(50)).toBeCloseTo(retsplFreeField(125), 5); // satura grave
    expect(retsplFreeField(20000)).toBeCloseTo(retsplFreeField(8000), 5); // satura agudo
  });
});

describe('dbHLtoGainFreeField', () => {
  it('es monótona creciente con el nivel en dB HL a cada frecuencia', () => {
    for (const f of CLINICAL_FREQS) {
      let prev = -1;
      for (let hl = 20; hl <= MAX_DB_HL; hl += 5) {
        const g = dbHLtoGainFreeField(hl, f);
        expect(g).toBeGreaterThan(prev);
        prev = g;
      }
    }
  });

  it('nunca satura por encima de 1.0 (sin recorte) en el rango clínico', () => {
    for (const f of CLINICAL_FREQS) {
      for (let hl = 20; hl <= MAX_DB_HL; hl += 5) {
        const g = dbHLtoGainFreeField(hl, f);
        expect(g).toBeGreaterThan(0);
        expect(g).toBeLessThanOrEqual(1);
      }
    }
  });

  it('la ganancia depende de la frecuencia (no es un mapeo plano)', () => {
    // A igual dB HL, 500 Hz (RETSPL mayor) exige más nivel que 4 kHz.
    const g500 = dbHLtoGainFreeField(60, 500);
    const g4000 = dbHLtoGainFreeField(60, 4000);
    expect(g500).toBeGreaterThan(g4000);
    // Debe haber una diferencia real y apreciable entre bandas.
    expect(g500 / g4000).toBeGreaterThan(1.1);
  });

  it('a nivel máximo la banda más exigente llega al fondo de escala (0 dBFS)', () => {
    // Por construcción el techo se ancla en la frecuencia clínica de mayor
    // RETSPL (500 Hz) a MAX_DB_HL → ganancia 1.0.
    const gMax = Math.max(...CLINICAL_FREQS.map(f => dbHLtoGainFreeField(MAX_DB_HL, f)));
    expect(gMax).toBeCloseTo(1, 6);
  });

  it('mantiene audibilidad en el arranque (40 dB HL @ 1 kHz por encima de -50 dBFS)', () => {
    // El ajuste previo elevó los niveles porque 40 dB HL ≈ -50 dBFS resultaba
    // inaudible; la calibración conserva esa sonoridad en el ancla de 1 kHz.
    const g = dbHLtoGainFreeField(40, 1000);
    const dbFS = 20 * Math.log10(g);
    expect(dbFS).toBeGreaterThan(-50);
  });
});
