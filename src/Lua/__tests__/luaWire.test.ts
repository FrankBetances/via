/* -------------------------------------------------------------------------- */
/*  Pruebas del formato de cable de Lúa.                                        */
/*                                                                             */
/*  Lo que se vigila aquí es que VIA+ hable EXACTAMENTE el protocolo del aparato. */
/*  No es una precaución teórica: la primera versión de este módulo se escribió a */
/*  mano, con UUIDs, tramas y TTL inventados, y no habría conectado con ninguna   */
/*  Lúa flasheada. Los valores de más abajo no se «acuerdan» aquí: se copian de   */
/*  `firmware/lua/protocol.json` y de `firmware/lua/src/main.cpp` en             */
/*  `FrankBetances/Valeria`, y si divergen, este fichero es el que avisa.        */
/* -------------------------------------------------------------------------- */

import {
  LUA_CHR,
  LUA_LIMITS,
  LUA_MODE,
  LUA_OP,
  LUA_PROTOCOL_VERSION,
  LUA_SAFE,
  LUA_SERVICE_UUID,
  luaFrame,
} from '../luaProtocol';
import {
  base64ToBytes,
  bytesToBase64,
  clampGrantSeconds,
  decodeLuaState,
  isLuaProtocolCompatible,
  luaSafeFrame,
} from '../luaWire';

describe('la tabla generada es la del aparato', () => {
  it('el servicio y las cuatro características son las del firmware', () => {
    expect(LUA_SERVICE_UUID).toBe('6c75612d-0001-4000-b000-000000000001');
    expect(LUA_CHR).toEqual({
      CTRL: '6c75612d-0002-4000-b000-000000000001',
      SAFE: '6c75612d-0003-4000-b000-000000000001',
      STATE: '6c75612d-0004-4000-b000-000000000001',
      CFG: '6c75612d-0005-4000-b000-000000000001',
    });
  });

  it('los opcodes son los ocho de protocol.json, con sus códigos', () => {
    expect(LUA_OP).toEqual({
      PHASE: 0x01,
      VERDICT: 0x02,
      CELEBRATE: 0x03,
      IDLE: 0x04,
      CALL: 0x05,
      GRANT: 0x10,
      HEARTBEAT: 0x11,
      BENCH: 0xf0,
    });
    expect(LUA_SAFE).toEqual({ CLINICAL_SILENCE: 0x01, UNLOCK: 0x02 });
    expect(LUA_MODE).toEqual({ REST: 0x00, ACTIVE: 0x01, LOCKED: 0x02 });
  });

  it('los límites son los del aparato, no los que le vendrían bien a la app', () => {
    // 60 s de concesión y latido de 10 s. La versión anterior usaba 3 s y 1 s,
    // inventados: el aparato habría vuelto a reposo entre latido y latido.
    expect(LUA_LIMITS.grantMaxSeconds).toBe(60);
    expect(LUA_LIMITS.heartbeatSeconds).toBe(10);
    expect(LUA_LIMITS.latencyBudgetMs).toBe(300);
    expect(LUA_LIMITS.minFps).toBe(20);
  });

  it('el latido cabe de sobra dentro de la concesión', () => {
    expect(LUA_LIMITS.heartbeatSeconds).toBeLessThan(LUA_LIMITS.grantMaxSeconds);
  });
});

describe('trama de CTRL', () => {
  it('son cuatro bytes: versión, opcode y parámetro de 16 bits little-endian', () => {
    // `main.cpp:117` rechaza lo que mida menos de 4 o no traiga su versión.
    expect(Array.from(luaFrame(LUA_OP.CELEBRATE, 2))).toEqual([LUA_PROTOCOL_VERSION, 0x03, 2, 0]);
  });

  it('el parámetro grande se parte en dos bytes, el bajo primero', () => {
    expect(Array.from(luaFrame(LUA_OP.GRANT, 0x0102))).toEqual([LUA_PROTOCOL_VERSION, 0x10, 0x02, 0x01]);
  });

  it('sin parámetro, va a cero', () => {
    expect(Array.from(luaFrame(LUA_OP.HEARTBEAT))).toEqual([LUA_PROTOCOL_VERSION, 0x11, 0, 0]);
  });
});

describe('trama de SAFE', () => {
  it('el byte 0 es la operación: NO lleva byte de versión', () => {
    // `main.cpp:164-165` lee `v[0]` como la operación. Meter ahí la versión
    // —como hacía la versión anterior de este módulo con su propia trama— haría
    // que el aparato interpretara «1» como CLINICAL_SILENCE por casualidad.
    expect(luaSafeFrame(LUA_SAFE.CLINICAL_SILENCE)[0]).toBe(0x01);
    expect(luaSafeFrame(LUA_SAFE.UNLOCK)[0]).toBe(0x02);
  });

  it('mide los 2 bytes que declara protocol.json, con el segundo reservado a cero', () => {
    expect(luaSafeFrame(LUA_SAFE.UNLOCK)).toEqual([0x02, 0x00]);
  });
});

describe('concesión', () => {
  it('el TTL va en SEGUNDOS y se recorta al máximo del aparato', () => {
    expect(clampGrantSeconds(30)).toBe(30);
    expect(clampGrantSeconds(60)).toBe(60);
    expect(clampGrantSeconds(600)).toBe(60);
  });

  it('nunca se concede cero ni negativo: eso sería una concesión sin efecto', () => {
    expect(clampGrantSeconds(0)).toBe(1);
    expect(clampGrantSeconds(-5)).toBe(1);
    expect(clampGrantSeconds(NaN)).toBe(1);
  });
});

describe('STATE — ocho bytes, y ninguno es la batería', () => {
  // Trama de `main.cpp:94-103`: modo, segundos restantes, cara, versión, fps y
  // 24 bits de microsegundos de despacho.
  const frame = [LUA_MODE.ACTIVE, 42, LUA_OP.CELEBRATE, LUA_PROTOCOL_VERSION, 30, 0x40, 0x0d, 0x03];

  it('desglosa la trama del firmware', () => {
    expect(decodeLuaState(frame)).toEqual({
      mode: LUA_MODE.ACTIVE,
      grantSecondsLeft: 42,
      face: LUA_OP.CELEBRATE,
      protocolVersion: LUA_PROTOCOL_VERSION,
      fps: 30,
      dispatchUs: 0x03_0d_40,
    });
  });

  it('los microsegundos de despacho son 24 bits little-endian', () => {
    expect(decodeLuaState([0, 0, 0, 1, 0, 0xff, 0x00, 0x00])?.dispatchUs).toBe(255);
    expect(decodeLuaState([0, 0, 0, 1, 0, 0x00, 0x01, 0x00])?.dispatchUs).toBe(256);
    expect(decodeLuaState([0, 0, 0, 1, 0, 0xff, 0xff, 0xff])?.dispatchUs).toBe(0xffffff);
  });

  it('una trama corta no produce un estado a medias', () => {
    expect(decodeLuaState(frame.slice(0, 7))).toBeNull();
    expect(decodeLuaState([])).toBeNull();
    expect(decodeLuaState(null)).toBeNull();
  });

  it('detecta un firmware que habla otra versión de protocolo', () => {
    expect(isLuaProtocolCompatible(decodeLuaState(frame))).toBe(true);
    const otra = [...frame];
    otra[3] = LUA_PROTOCOL_VERSION + 1;
    expect(isLuaProtocolCompatible(decodeLuaState(otra))).toBe(false);
    expect(isLuaProtocolCompatible(null)).toBe(false);
  });
});

describe('base64 (lo que habla react-native-ble-plx)', () => {
  it('ida y vuelta sobre todos los valores del byte', () => {
    const bytes = Array.from({ length: 256 }, (_, i) => i);
    expect(base64ToBytes(bytesToBase64(bytes))).toEqual(bytes);
  });

  it('codifica una trama real de CTRL', () => {
    const b64 = bytesToBase64(luaFrame(LUA_OP.GRANT, 30));
    expect(base64ToBytes(b64)).toEqual([LUA_PROTOCOL_VERSION, 0x10, 30, 0]);
  });
});
