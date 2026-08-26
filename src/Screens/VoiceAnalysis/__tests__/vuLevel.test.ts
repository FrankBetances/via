import { calculateVuLevel, VU_FLOOR_DBFS } from '../voiceDsp';

/* -------------------------------------------------------------------------- */
/*  Escala del medidor de nivel en vivo.                                       */
/*                                                                            */
/*  El cálculo anterior era `min(1, rms * 4)`: lineal, saturado a tope desde   */
/*  un RMS de 0,25 y aplastado contra cero por debajo. La barra estaba casi    */
/*  siempre en un extremo, así que no guiaba la toma — que es lo único para lo */
/*  que existe. Lo que se fija aquí es que el recorrido caiga donde ocurre la  */
/*  fonación, no que el número sea un nivel calibrado (no lo es: el micrófono  */
/*  no está calibrado y la barra es presentación, no medida).                  */
/* -------------------------------------------------------------------------- */

const rmsAt = (dbFs: number): number => Math.pow(10, dbFs / 20);

describe('calculateVuLevel', () => {
  it('el silencio y lo que hay por debajo del suelo dan cero', () => {
    expect(calculateVuLevel(0)).toBe(0);
    expect(calculateVuLevel(rmsAt(VU_FLOOR_DBFS))).toBe(0);
    expect(calculateVuLevel(rmsAt(VU_FLOOR_DBFS - 10))).toBe(0);
  });

  it('la saturación digital da el tope y no lo pasa', () => {
    expect(calculateVuLevel(1)).toBe(1);
    expect(calculateVuLevel(4)).toBe(1);
  });

  it('reparte el recorrido de forma logarítmica sobre la banda útil', () => {
    expect(calculateVuLevel(rmsAt(-35))).toBeCloseTo(0.3, 2);
    expect(calculateVuLevel(rmsAt(-25))).toBeCloseTo(0.5, 2);
    expect(calculateVuLevel(rmsAt(-10))).toBeCloseTo(0.8, 2);
  });

  it('una fonación normal cae en la zona verde de la pantalla (0,45–0,90)', () => {
    // Umbrales de VoiceAnalysisScreen. Con la escala lineal anterior, un RMS
    // de 0,05 (≈ −26 dBFS, una /a/ perfectamente utilizable) daba 0,20 y la
    // barra la pintaba en ámbar de «nivel insuficiente».
    const level = calculateVuLevel(0.05);
    expect(level).toBeGreaterThan(0.45);
    expect(level).toBeLessThan(0.9);
  });

  it('es monótona: más señal nunca baja la barra', () => {
    let prev = -1;
    for (let db = -60; db <= 0; db += 2) {
      const level = calculateVuLevel(rmsAt(db));
      expect(level).toBeGreaterThanOrEqual(prev);
      prev = level;
    }
  });
});
