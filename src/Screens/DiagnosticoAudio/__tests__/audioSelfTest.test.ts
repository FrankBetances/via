import {
  describeCapture,
  peakDbfs,
  rmsDbfs,
  summaryText,
  worstStatus,
  type CheckResult,
} from '../audioSelfTest';

/* -------------------------------------------------------------------------- */
/*  Lo que se vigila aquí es que la comprobación DISTINGA los tres fallos que  */
/*  la app confundía bajo un único «captura insuficiente». Confundirlos es lo  */
/*  que hacía imposible arreglar nada desde un informe de campo: «no graba»    */
/*  puede ser el stream que no abre, el sistema entregando ceros o un nivel    */
/*  demasiado bajo, y cada uno se resuelve de una forma distinta.              */
/* -------------------------------------------------------------------------- */

const tone = (n: number, amp: number): Float32Array =>
  Float32Array.from({ length: n }, (_, i) => amp * Math.sin((2 * Math.PI * 100 * i) / 16000));

describe('medidas de nivel', () => {
  it('el pico de una señal a plena escala es 0 dBFS', () => {
    expect(peakDbfs(tone(16000, 1))).toBeCloseTo(0, 1);
  });

  it('el silencio absoluto no devuelve un número: no se puede promediar', () => {
    expect(peakDbfs(new Float32Array(1000))).toBe(-Infinity);
    expect(rmsDbfs(new Float32Array(1000))).toBe(-Infinity);
  });

  it('el RMS de una senoide está 3 dB por debajo de su pico', () => {
    const pcm = tone(16000, 0.5);
    expect(rmsDbfs(pcm)).toBeCloseTo(peakDbfs(pcm) - 3.01, 1);
  });

  it('una señal vacía no rompe la medida', () => {
    expect(rmsDbfs(new Float32Array(0))).toBe(-Infinity);
  });
});

describe('veredicto de la toma de prueba', () => {
  it('CERO bloques es un fallo del stream, no una toma silenciosa', () => {
    const r = describeCapture(0, 0, -Infinity, -Infinity, 'silent');
    expect(r.status).toBe('fail');
    expect(r.detail).toMatch(/NI UN bloque/);
    // El consejo debe hablar del stream, no de pedirle al niño que hable más.
    expect(r.hint).toMatch(/otra aplicación/i);
  });

  it('sin permiso, el consejo apunta a los ajustes del sistema', () => {
    expect(describeCapture(0, 0, -Infinity, -Infinity, 'no-permission').hint).toMatch(/Permisos/);
  });

  it('sin motor en el binario, el consejo apunta a la compilación', () => {
    expect(describeCapture(0, 0, -Infinity, -Infinity, 'no-engine').hint).toMatch(/compilación completa/);
  });

  it('bloques con TODAS las muestras a cero es silencio digital, no falta de voz', () => {
    const r = describeCapture(30, 48000, -Infinity, -Infinity, 'live');
    expect(r.status).toBe('fail');
    expect(r.detail).toMatch(/TODAS valen cero/);
    expect(r.hint).toMatch(/silenciado|encaminada/i);
  });

  it('señal audible es CORRECTO y publica las cifras medidas', () => {
    const r = describeCapture(30, 48000, -12, -20, 'live');
    expect(r.status).toBe('ok');
    expect(r.detail).toContain('30 bloques');
    expect(r.detail).toContain('-12.0 dBFS');
    expect(r.hint).toBeUndefined();
  });

  it('señal por debajo del suelo medible avisa, pero no la da por rota', () => {
    const r = describeCapture(30, 48000, -72, -80, 'live');
    expect(r.status).toBe('warn');
    expect(r.hint).toMatch(/tan bajo/);
  });

  /* -------------------------------------------------------------------------
   *  RECORRIDO DINÁMICO — la duda de campo del 25/8/2026: «cuando me acerco o
   *  uso otro micrófono externo no cambia la supuesta intensidad de señal».
   *
   *  Con un solo nivel medio esa pregunta no tiene respuesta: una entrada
   *  nivelada por el sistema entrega bloques perfectamente y devuelve siempre
   *  la misma cifra. El recorrido entre el bloque más flojo y el más fuerte
   *  sí la tiene, y por eso se PUBLICA. Lo que NO se hace es convertirlo en un
   *  veredicto: una toma en silencio también es plana, y llamarla avería sería
   *  inventarse un diagnóstico.
   * ------------------------------------------------------------------------- */
  it('publica el recorrido entre el bloque más flojo y el más fuerte', () => {
    const r = describeCapture(30, 48000, -12, -20, 'live', { minRmsDb: -46, maxRmsDb: -18 });
    expect(r.detail).toMatch(/recorrido 28\.0 dB/);
    expect(r.status).toBe('ok');
    expect(r.hint).toBeUndefined();
  });

  it('un nivel que no se mueve se EXPLICA, pero no se declara avería', () => {
    const r = describeCapture(30, 48000, -12, -20, 'live', { minRmsDb: -21, maxRmsDb: -19 });
    expect(r.status).toBe('ok'); // no hay prueba de avería: no se inventa
    expect(r.detail).toMatch(/recorrido 2\.0 dB/);
    expect(r.hint).toMatch(/HABLANDO y CALLANDO/);
    expect(r.hint).toMatch(/INTENSIDAD/);
  });

  it('sin recorrido medido, el detalle no se lo inventa', () => {
    expect(describeCapture(1, 4800, -12, -20, 'live').detail).not.toMatch(/recorrido/);
  });
});

describe('resumen', () => {
  const mk = (id: string, status: CheckResult['status']): CheckResult => ({
    id,
    label: id,
    status,
    detail: 'x',
  });

  it('el veredicto global lo marca el peor eslabón', () => {
    expect(worstStatus([mk('a', 'ok'), mk('b', 'warn'), mk('c', 'fail')])).toBe('fail');
    expect(worstStatus([mk('a', 'ok'), mk('b', 'warn')])).toBe('warn');
    expect(worstStatus([mk('a', 'ok'), mk('b', 'ok')])).toBe('ok');
  });

  it('una cadena sin comprobar no se declara correcta', () => {
    expect(worstStatus([mk('a', 'skip'), mk('b', 'skip')])).toBe('skip');
  });

  it('el texto copiable nombra cada eslabón y su veredicto', () => {
    const text = summaryText([mk('motor', 'fail'), mk('voz', 'ok')]);
    expect(text).toMatch(/\[FALLO\] motor/);
    expect(text).toMatch(/\[OK {2}\] voz/);
    // La versión del banco viaja con el informe: sin ella no se sabe qué
    // compilación produjo el fallo.
    expect(text).toMatch(/Banco de voz:/);
  });
});

/* -------------------------------------------------------------------------- */
/*  El T.A.R. exige reconocimiento EN EL DISPOSITIVO y falla cerrado. Eso hay  */
/*  que DECIRLO, no dejarlo en un silencio indistinguible de una avería: en    */
/*  cualquier emulador de Android —y en buena parte del parque real— es el     */
/*  caso normal, porque hace falta API 33 y el modelo de la lengua descargado. */
/* -------------------------------------------------------------------------- */
describe('reconocimiento de voz del T.A.R.', () => {
  const { checkSpeechRecognition } = require('../audioSelfTest');

  it('sin capa nativa avisa, NO declara avería, y explica la alternativa', async () => {
    const r = await checkSpeechRecognition('es-ES');
    // AVISO y no FALLO: el T.A.R. sigue siendo válido con SODA manual, así que
    // marcarlo como roto mandaría a buscar una avería que no existe.
    expect(r.status).toBe('warn');
    expect(r.id).toBe('asr');
    expect(r.hint).toMatch(/SODA manual|modelo de la lengua/);
  });
});
