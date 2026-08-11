/* -------------------------------------------------------------------------- */
/*  Pruebas de la recompensa de cierre — la única integración de VIA+ en la v1.   */
/*                                                                             */
/*  Lo que fija esta suite es tanto lo que hace como lo que NO puede hacer:      */
/*  celebrar solo con la exploración terminada, pedir desbloqueo antes de         */
/*  conceder (el silencio clínico deja el aparato bloqueado), y no celebrar       */
/*  jamás con un micrófono abierto.                                             */
/* -------------------------------------------------------------------------- */

import {
  CLOSING_CELEBRATION_INTENSITY,
  CLOSING_GRANT_SECONDS,
  createClosingReward,
} from '../closingReward';
import { LUA_LIMITS } from '../luaProtocol';

interface Log {
  unlocks: number;
  grants: number[];
  celebrations: number[];
  heartbeats: number;
  idles: number;
}

function setup(options: { recording?: boolean; unlockOk?: boolean } = {}) {
  const log: Log = { unlocks: 0, grants: [], celebrations: [], heartbeats: 0, idles: 0 };
  const reward = createClosingReward({
    unlock: () => {
      log.unlocks += 1;
      return options.unlockOk === false ? Promise.reject(new Error('sin aparato')) : Promise.resolve(true);
    },
    grant: seconds => log.grants.push(seconds),
    celebrate: intensity => log.celebrations.push(intensity),
    heartbeat: () => {
      log.heartbeats += 1;
    },
    idle: () => {
      log.idles += 1;
    },
    isRecordingActive: () => options.recording ?? false,
  });
  return { reward, log };
}

/** Deja que corra la cadena de promesas del desbloqueo. */
const settle = () => Promise.resolve().then(() => Promise.resolve());

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

describe('celebración', () => {
  it('desbloquea, concede y celebra, en ese orden', async () => {
    // El orden importa: el silencio clínico deja el aparato en LOCKED, y en ese
    // estado el firmware ignora las concesiones (`main.cpp:126`).
    const { reward, log } = setup();
    reward.start();
    expect(log.unlocks).toBe(1);
    expect(log.grants).toEqual([]); // todavía no: el desbloqueo es asíncrono

    await settle();
    expect(log.grants).toEqual([CLOSING_GRANT_SECONDS]);
    expect(log.celebrations).toEqual([CLOSING_CELEBRATION_INTENSITY]);
  });

  it('la concesión que pide cabe en el máximo del aparato', () => {
    expect(CLOSING_GRANT_SECONDS).toBeLessThanOrEqual(LUA_LIMITS.grantMaxSeconds);
    expect(CLOSING_GRANT_SECONDS).toBeGreaterThan(LUA_LIMITS.heartbeatSeconds);
  });

  it('la intensidad está en el rango 0-2 del opcode', () => {
    expect(CLOSING_CELEBRATION_INTENSITY).toBeGreaterThanOrEqual(0);
    expect(CLOSING_CELEBRATION_INTENSITY).toBeLessThanOrEqual(2);
  });

  it('arrancar dos veces no celebra dos veces', async () => {
    const { reward, log } = setup();
    reward.start();
    reward.start();
    await settle();
    expect(log.unlocks).toBe(1);
    expect(log.celebrations).toEqual([CLOSING_CELEBRATION_INTENSITY]);
  });

  it('un desbloqueo que falla no lanza ni deja un rechazo sin manejar', async () => {
    const { reward, log } = setup({ unlockOk: false });
    expect(() => reward.start()).not.toThrow();
    await settle();
    expect(log.grants).toEqual([]);
    expect(log.celebrations).toEqual([]);
  });
});

describe('con micrófono abierto no se celebra', () => {
  it('ni desbloquea, ni concede, ni celebra', () => {
    // No debería poder ocurrir —ResultadosFinal no graba— pero comprobarlo cuesta
    // cero y equivocarse cuesta una medición.
    const { reward, log } = setup({ recording: true });
    reward.start();
    expect(log).toMatchObject({ unlocks: 0, grants: [], celebrations: [] });
    expect(reward.isCelebrating()).toBe(false);
  });
});

describe('latido', () => {
  it('renueva con la cadencia del aparato mientras la pantalla está viva', async () => {
    const { reward, log } = setup();
    reward.start();
    await settle();

    jest.advanceTimersByTime(LUA_LIMITS.heartbeatSeconds * 1000 * 3);
    expect(log.heartbeats).toBe(3);
  });

  it('al salir de la pantalla se corta el latido y se deja la cara neutra', async () => {
    const { reward, log } = setup();
    reward.start();
    await settle();
    reward.stop();

    expect(log.idles).toBe(1);
    jest.advanceTimersByTime(LUA_LIMITS.heartbeatSeconds * 1000 * 5);
    expect(log.heartbeats).toBe(0);
    expect(reward.isCelebrating()).toBe(false);
  });

  it('si la app muere, el aparato vuelve a reposo solo: nadie envía nada', async () => {
    // No hay trama de apagado que pueda perderse — eso es el diseño del aparato.
    // Lo que se verifica es que la concesión pedida CADUCA y que, sin latido, no
    // se envía nada más.
    const { reward, log } = setup();
    reward.start();
    await settle();
    reward.stop(); // equivalente a que la pantalla deje de existir
    const enviados = log.heartbeats;

    jest.advanceTimersByTime(LUA_LIMITS.grantMaxSeconds * 1000 * 3);
    expect(log.heartbeats).toBe(enviados);
    expect(log.grants).toEqual([CLOSING_GRANT_SECONDS]);
  });

  it('parar sin haber arrancado no toca el aparato', () => {
    const { reward, log } = setup();
    reward.stop();
    expect(log).toMatchObject({ unlocks: 0, idles: 0, heartbeats: 0 });
  });
});
