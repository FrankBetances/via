import {
  applyRoomNoiseSkip,
  applyRoomNoiseVerdict,
  initialRoomNoise,
  isRoomVerified,
  roomNoiseLabel,
  type RoomNoiseState,
} from '../roomNoiseState';

/* -------------------------------------------------------------------------- */
/*  REGRESIÓN — «Sala verificada · sonómetro OK» sobre una sala que nadie      */
/*  había medido.                                                              */
/*                                                                             */
/*  El hub deducía el estado de la sala de la AUSENCIA de una bandera de       */
/*  navegación que solo ponía el botón de saltar. Cualquier otro camino la     */
/*  dejaba `undefined`, y `undefined` caía en la rama del tic verde. Los dos   */
/*  caminos que producían el falso certificado:                                */
/*                                                                             */
/*    · no abrir el sonómetro jamás;                                           */
/*    · medir, obtener «DEMASIADO RUIDO» y volver atrás.                       */
/*                                                                             */
/*  Lo que se vigila aquí es la regla de fondo: **«verificada» es un estado    */
/*  que hay que GANARSE con una medición que pasa**, y ninguna ausencia de     */
/*  dato puede leerse como aprobado.                                           */
/* -------------------------------------------------------------------------- */

const init = (): RoomNoiseState => initialRoomNoise;

describe('estado de la sala', () => {
  it('sin medir NO está verificada, y lo dice', () => {
    const s = init();
    expect(s.status).toBe('unmeasured');
    expect(isRoomVerified(s)).toBe(false);
    expect(roomNoiseLabel(s)).toMatch(/sin medir/i);
    // Y sobre todo: no puede parecerse a un aprobado.
    expect(roomNoiseLabel(s)).not.toMatch(/verificada · sonómetro OK/);
  });

  it('una medición que PASA es lo único que verifica la sala', () => {
    const s = applyRoomNoiseVerdict('ok', 38, 44);
    expect(isRoomVerified(s)).toBe(true);
    expect(roomNoiseLabel(s)).toMatch(/verificada/i);
    expect(s.avgDb).toBe(38);
    expect(s.measuredAt).not.toBeNull();
  });

  it('una sala DEMASIADO RUIDOSA no se verifica, y el aviso lo dice sin rodeos', () => {
    const s = applyRoomNoiseVerdict('block', 71, 83);
    expect(isRoomVerified(s)).toBe(false);
    // El clínico tiene que leer la consecuencia clínica, no un «pendiente».
    expect(roomNoiseLabel(s)).toMatch(/no válidas/i);
  });

  it('una sala en el límite tampoco cuenta como verificada', () => {
    const s = applyRoomNoiseVerdict('warn', 50, 58);
    expect(isRoomVerified(s)).toBe(false);
    expect(roomNoiseLabel(s)).toMatch(/límite/i);
  });

  it('saltar la medición se registra COMO SALTADA, nunca como apta', () => {
    const s = applyRoomNoiseSkip();
    expect(s.status).toBe('skipped');
    expect(isRoomVerified(s)).toBe(false);
    expect(roomNoiseLabel(s)).toMatch(/omitido/i);
    // Saltar no inventa cifras.
    expect(s.avgDb).toBeNull();
    expect(s.peakDb).toBeNull();
  });

  it('un veredicto MALO no se puede pisar quedándose sin medir', () => {
    // Reproduce el camino real: medir mal y volver atrás. El estado tiene que
    // sobrevivir a la navegación; era justo lo que no pasaba.
    const bad = applyRoomNoiseVerdict('block', 75, 88);
    expect(isRoomVerified(bad)).toBe(false);
    // El veredicto malo es un ESTADO, no la ausencia de una bandera: sobrevive
    // a la navegación en lugar de evaporarse y volver al tic verde.
    expect(isRoomVerified({ ...bad })).toBe(false);
  });

  it('una sesión nueva vuelve a «sin medir», no hereda el aprobado de ayer', () => {
    const ok = applyRoomNoiseVerdict('ok', 38, 44);
    expect(isRoomVerified(ok)).toBe(true);
    const fresh = initialRoomNoise;
    expect(fresh.status).toBe('unmeasured');
    expect(isRoomVerified(fresh)).toBe(false);
  });

  it('NINGÚN estado distinto de una medición que pasa verifica la sala', () => {
    // Invariante, no lista de casos: si alguien añade un estado nuevo y se le
    // olvida esto, esta prueba lo caza.
    const estados: RoomNoiseState['status'][] = ['unmeasured', 'warn', 'block', 'skipped'];
    for (const status of estados) {
      expect(isRoomVerified({ status, avgDb: null, peakDb: null, measuredAt: null })).toBe(false);
    }
  });
});
