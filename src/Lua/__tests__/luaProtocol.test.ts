/* -------------------------------------------------------------------------- */
/*  Pruebas del códec de Lúa.                                                   */
/*                                                                             */
/*  Dos cosas se vigilan aquí, y solo una es técnica:                            */
/*                                                                             */
/*   · Que las tramas se construyan e interpreten bien (lo aburrido).            */
/*   · Que por el enlace NO PUEDA VIAJAR SEMÁNTICA CLÍNICA. El enumerado de      */
/*     estados afectivos es lo que sostiene que Lúa no sea accesorio de un        */
/*     producto sanitario (docs/design/integracion-lua.md §4), así que su tamaño  */
/*     y su contenido son un requisito verificable, no una convención. Si alguien */
/*     amplía `LuaAffect` con un «acierto» o un «umbral», esta suite se cae y el  */
/*     PR tiene que explicar por qué — que es exactamente donde queremos que se   */
/*     discuta.                                                                  */
/* -------------------------------------------------------------------------- */

import {
  base64ToBytes,
  bytesToBase64,
  decodeCapabilities,
  decodeStatus,
  encodeExpression,
  encodeNoisePermit,
  encodeNoiseRevocation,
  luaCanMakeNoise,
  nextSequence,
  LUA_AFFECTS,
  LUA_CAPABILITIES_UUID,
  LUA_CAP_MOTORS,
  LUA_CAP_RTC,
  LUA_CAP_SPEAKER,
  LUA_EXPRESSION_UUID,
  LUA_NOISE_PERMIT_MAGIC,
  LUA_NOISE_PERMIT_MAX_TTL_MS,
  LUA_NOISE_PERMIT_RENEWAL_MS,
  LUA_NOISE_PERMIT_TTL_MS,
  LUA_NOISE_PERMIT_UUID,
  LUA_SERVICE_UUID,
  LUA_STATUS_UUID,
  LuaAffect,
  LuaFirmwareState,
} from '../luaProtocol';

describe('UUIDs', () => {
  it('el servicio y las cuatro características comparten la base «lua»', () => {
    expect(LUA_SERVICE_UUID).toBe('6c756100-b17e-4f4d-9a2f-0a1b2c3d4e5f');
    expect(LUA_CAPABILITIES_UUID).toBe('6c756101-b17e-4f4d-9a2f-0a1b2c3d4e5f');
    expect(LUA_EXPRESSION_UUID).toBe('6c756102-b17e-4f4d-9a2f-0a1b2c3d4e5f');
    expect(LUA_NOISE_PERMIT_UUID).toBe('6c756103-b17e-4f4d-9a2f-0a1b2c3d4e5f');
    expect(LUA_STATUS_UUID).toBe('6c756104-b17e-4f4d-9a2f-0a1b2c3d4e5f');
  });

  it('no hay dos características con el mismo UUID', () => {
    const all = [
      LUA_SERVICE_UUID,
      LUA_CAPABILITIES_UUID,
      LUA_EXPRESSION_UUID,
      LUA_NOISE_PERMIT_UUID,
      LUA_STATUS_UUID,
    ];
    expect(new Set(all).size).toBe(all.length);
  });
});

describe('el enlace no transporta clínica', () => {
  it('el enumerado afectivo tiene exactamente los seis estados acordados', () => {
    expect(LUA_AFFECTS).toEqual([0, 1, 2, 3, 4, 5]);
    expect(Object.keys(LuaAffect).filter(k => isNaN(Number(k)))).toEqual([
      'Dormida',
      'Neutra',
      'Atenta',
      'Contenta',
      'Celebracion',
      'Carino',
    ]);
  });

  it('ningún nombre del enumerado alude a una medida, un juicio ni un resultado', () => {
    // Guardián de intención: la lista de palabras es la frontera de §4 escrita
    // en código. Ampliar el enumerado es legítimo; colarle clínica, no.
    const prohibidas = /acierto|fallo|error|umbral|puntuaci|score|correct|nivel|db|resultado|diagn/i;
    for (const nombre of Object.keys(LuaAffect).filter(k => isNaN(Number(k)))) {
      expect(nombre).not.toMatch(prohibidas);
    }
  });

  it('un estado fuera del enumerado no se codifica: no llega al aire', () => {
    expect(encodeExpression(6)).toBeNull();
    expect(encodeExpression(42)).toBeNull();
    expect(encodeExpression(-1)).toBeNull();
    expect(encodeExpression(2.5)).toBeNull();
    expect(encodeExpression(NaN)).toBeNull();
  });
});

describe('expresión', () => {
  it('codifica estado e intensidad en dos bytes', () => {
    expect(encodeExpression(LuaAffect.Contenta, 128)).toEqual([3, 128]);
  });

  it('la intensidad por omisión es la máxima', () => {
    expect(encodeExpression(LuaAffect.Carino)).toEqual([5, 255]);
  });

  it('la intensidad se recorta al rango del byte en vez de desbordar', () => {
    expect(encodeExpression(LuaAffect.Atenta, 999)).toEqual([2, 255]);
    expect(encodeExpression(LuaAffect.Atenta, -5)).toEqual([2, 0]);
  });
});

describe('permiso de ruido', () => {
  it('la renovación es más frecuente que la caducidad, con margen para fallar', () => {
    // El TTL sin esta relación sería decorativo: si el permiso caducara antes de
    // la siguiente renovación, la gata parpadearía entre muda y sonora. Tres
    // oportunidades por vida del permiso es el margen elegido en §3.
    expect(LUA_NOISE_PERMIT_RENEWAL_MS).toBeLessThan(LUA_NOISE_PERMIT_TTL_MS);
    expect(LUA_NOISE_PERMIT_TTL_MS / LUA_NOISE_PERMIT_RENEWAL_MS).toBeGreaterThanOrEqual(2);
  });

  it('el TTL viaja en décimas de segundo detrás del byte mágico', () => {
    expect(encodeNoisePermit(3000, 7)).toEqual([LUA_NOISE_PERMIT_MAGIC, 30, 7]);
  });

  it('un TTL por encima del techo del campo se rechaza, no se trunca en silencio', () => {
    expect(encodeNoisePermit(LUA_NOISE_PERMIT_MAX_TTL_MS, 1)).toEqual([LUA_NOISE_PERMIT_MAGIC, 255, 1]);
    expect(encodeNoisePermit(LUA_NOISE_PERMIT_MAX_TTL_MS + 100, 1)).toBeNull();
    expect(encodeNoisePermit(-1, 1)).toBeNull();
    expect(encodeNoisePermit(Infinity, 1)).toBeNull();
  });

  it('TTL cero es la revocación explícita', () => {
    expect(encodeNoisePermit(0, 9)).toEqual([LUA_NOISE_PERMIT_MAGIC, 0, 9]);
    expect(encodeNoiseRevocation(9)).toEqual([LUA_NOISE_PERMIT_MAGIC, 0, 9]);
  });

  it('la secuencia da la vuelta dentro del byte', () => {
    expect(nextSequence(0)).toBe(1);
    expect(nextSequence(254)).toBe(255);
    expect(nextSequence(255)).toBe(0);
  });
});

describe('capacidades', () => {
  it('interpreta el mapa de bits', () => {
    expect(decodeCapabilities([1, LUA_CAP_SPEAKER | LUA_CAP_RTC])).toEqual({
      protocolVersion: 1,
      display: false,
      speaker: true,
      motors: false,
      rtc: true,
    });
  });

  it('una trama corta o ausente no se inventa capacidades', () => {
    expect(decodeCapabilities([1])).toBeNull();
    expect(decodeCapabilities([])).toBeNull();
    expect(decodeCapabilities(null)).toBeNull();
    expect(decodeCapabilities(undefined)).toBeNull();
  });

  it('sin capacidades conocidas NO se puede hacer ruido', () => {
    // Es la respuesta que hace segura la ventana entre conectar y leer.
    expect(luaCanMakeNoise(null)).toBe(false);
  });

  it('Lúa v1 (solo pantalla) no puede hacer ruido', () => {
    expect(luaCanMakeNoise(decodeCapabilities([1, 0b0001]))).toBe(false);
  });

  it('altavoz o motores, cualquiera de los dos, sí puede', () => {
    expect(luaCanMakeNoise(decodeCapabilities([1, LUA_CAP_SPEAKER]))).toBe(true);
    expect(luaCanMakeNoise(decodeCapabilities([1, LUA_CAP_MOTORS]))).toBe(true);
  });
});

describe('estado notificado', () => {
  it('interpreta estado, batería, flags y eco de secuencia', () => {
    expect(decodeStatus([1, 87, 0b0001, 12])).toEqual({
      state: LuaFirmwareState.ConPermisoDeRuido,
      batteryPct: 87,
      charging: true,
      lowBattery: false,
      sequenceEcho: 12,
    });
  });

  it('batería 0xFF es «no medida», no «descargada»', () => {
    expect(decodeStatus([0, 0xff, 0, 0])?.batteryPct).toBeNull();
  });

  it('un estado desconocido se interpreta como fallo, no como permiso vigente', () => {
    expect(decodeStatus([200, 50, 0, 0])?.state).toBe(LuaFirmwareState.Fallo);
  });

  it('una trama corta no produce un estado a medias', () => {
    expect(decodeStatus([0, 1, 2])).toBeNull();
    expect(decodeStatus(null)).toBeNull();
  });
});

describe('base64 (lo que habla react-native-ble-plx)', () => {
  it('ida y vuelta sobre todos los valores del byte', () => {
    const bytes = Array.from({ length: 256 }, (_, i) => i);
    expect(base64ToBytes(bytesToBase64(bytes))).toEqual(bytes);
  });

  it('codifica las tramas reales del protocolo', () => {
    // pequeñas y verificables a mano: 0xA5 0x1E 0x07
    expect(bytesToBase64([0xa5, 0x1e, 0x07])).toBe('pR4H');
    expect(base64ToBytes('pR4H')).toEqual([0xa5, 0x1e, 0x07]);
  });
});
