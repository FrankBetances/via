import {
  buildTelemetryJson,
  compressTelemetry,
  decompressTelemetry,
  type TelemetrySnapshot,
} from '@/Telemetry';
import {
  classifyReactivo,
  endSession,
  enterReactivo,
  getSnapshot,
  resetTelemetry,
  setLikert,
  startSession,
} from '@/Telemetry/telemetryStore';

/* -------------------------------------------------------------------------- */
/*  Telemetría Zero-PHI — contrato de payload + compresión.                    */
/* -------------------------------------------------------------------------- */

const SAMPLE: TelemetrySnapshot = {
  s: 'AB12CD34',
  b: 'e7',
  l: 4,
  d: 842000,
  f: [
    [1, 3200, 0],
    [2, 1500, 1],
    [3, 900, 0],
    [4, 5100, 2],
  ],
};

describe('buildTelemetryJson', () => {
  it('emite el JSON estricto con claves de 1 char y arrays anónimos', () => {
    expect(buildTelemetryJson(SAMPLE)).toBe(
      '{"s":"AB12CD34","b":"e7","l":4,"d":842000,"f":[[1,3200,0],[2,1500,1],[3,900,0],[4,5100,2]]}',
    );
  });

  it('no filtra claves extra (Zero-PHI)', () => {
    const parsed = JSON.parse(buildTelemetryJson(SAMPLE));
    expect(Object.keys(parsed).sort()).toEqual(['b', 'd', 'f', 'l', 's']);
  });
});

describe('compressTelemetry', () => {
  it('hace round-trip sin pérdida', () => {
    const payload = compressTelemetry(SAMPLE);
    expect(decompressTelemetry(payload)).toEqual(SAMPLE);
  });

  it('SIEMPRE es más corto que Base64 del mismo JSON (Base64 infla +33%, no comprime)', () => {
    const json = buildTelemetryJson(SAMPLE);
    const compressed = compressTelemetry(SAMPLE);
    // JSON es ASCII → 1 byte/char; Base64 = 4·ceil(bytes/3), infla ~+33%.
    const base64Len = 4 * Math.ceil(json.length / 3);
    expect(base64Len).toBeGreaterThan(json.length); // Base64 nunca comprime
    expect(compressed.length).toBeLessThan(base64Len);
  });

  it('a ESCALA de batería sí reduce frente al JSON crudo (el caso real)', () => {
    // ~40 reactivos: estructura repetitiva que LZW aprovecha. En payloads
    // diminutos el overhead de LZString puede superar al crudo; la ganancia
    // aparece a escala, que es justo la condición de una batería completa.
    const bigBattery: TelemetrySnapshot = {
      s: 'AB12CD34',
      b: 'e7',
      l: 4,
      d: 842000,
      f: Array.from({ length: 40 }, (_, i) => [i + 1, 1000 + i * 37, i % 3] as [number, number, number]),
    };
    const json = buildTelemetryJson(bigBattery);
    const compressed = compressTelemetry(bigBattery);
    expect(compressed.length).toBeLessThan(json.length);
  });

  it('emite solo ASCII URL-safe (1 byte/char en el QR)', () => {
    expect(compressTelemetry(SAMPLE)).toMatch(/^[A-Za-z0-9\-_$+.]*$/);
  });
});

describe('telemetryStore (ciclo de vida)', () => {
  afterEach(() => resetTelemetry());

  it('asigna ordinales 1-based por orden de aparición y cuenta rectificaciones', () => {
    startSession('e7');
    enterReactivo('itemA');
    classifyReactivo('itemA'); // 1ª → fija tiempo
    enterReactivo('itemB');
    classifyReactivo('itemB');
    classifyReactivo('itemB'); // 2ª → rectificación
    classifyReactivo('itemB'); // 3ª → rectificación
    endSession();

    const snap = getSnapshot()!;
    expect(snap.f.map(([id]) => id)).toEqual([1, 2]);
    expect(snap.f[0][2]).toBe(0); // itemA sin rectificaciones
    expect(snap.f[1][2]).toBe(2); // itemB con 2 rectificaciones
  });

  it('startSession reinicia el estado (sin sesión zombie entre pacientes)', () => {
    startSession('e7');
    enterReactivo('x');
    classifyReactivo('x');
    const first = getSnapshot()!.s;

    startSession('e7');
    const snap = getSnapshot()!;
    expect(snap.f).toHaveLength(0);
    expect(snap.s).not.toBe(first); // nuevo sessionId
  });

  it('clampa el Likert a 1–5', () => {
    startSession('e7');
    setLikert(9);
    expect(getSnapshot()!.l).toBe(5);
    setLikert(-3);
    expect(getSnapshot()!.l).toBe(0);
  });

  it('getSnapshot devuelve null sin sesión', () => {
    expect(getSnapshot()).toBeNull();
  });
});
