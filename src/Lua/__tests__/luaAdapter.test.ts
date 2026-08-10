/* -------------------------------------------------------------------------- */
/*  Pruebas del adaptador de Lúa.                                               */
/*                                                                             */
/*  Lo importante que se verifica aquí es lo que NO pasa: sin periférico, con    */
/*  periférico caído, o con una escritura que falla, nada lanza y nada bloquea.  */
/*  Es el riesgo L-4 («el accesorio interrumpe el flujo clínico») escrito como   */
/*  prueba, y también el requisito de §4 de que VIA+ funcione idénticamente sin  */
/*  Lúa. La regla de la casa —ningún `await` hacia el periférico— se comprueba   */
/*  por la firma: todas las funciones de envío devuelven `void`.                 */
/* -------------------------------------------------------------------------- */

import {
  getLuaAdapter,
  installBleLua,
  isLuaConnected,
  luaCapabilities,
  luaExpress,
  luaSendNoisePermit,
  setLuaAdapter,
  type LuaAdapter,
} from '../luaAdapter';
import {
  base64ToBytes,
  bytesToBase64,
  LUA_CAP_DISPLAY,
  LUA_CAP_SPEAKER,
  LUA_EXPRESSION_UUID,
  LUA_NOISE_PERMIT_MAGIC,
  LUA_NOISE_PERMIT_UUID,
  LUA_SERVICE_UUID,
  LuaAffect,
} from '../luaProtocol';

afterEach(() => {
  setLuaAdapter(null);
});

/* -------------------------------------------------------------------------- */
/*  Doble del BleManager de react-native-ble-plx                               */
/* -------------------------------------------------------------------------- */

interface Written {
  characteristic: string;
  bytes: number[];
}

function fakeManager(options: { capabilities?: number[]; failWrites?: boolean } = {}) {
  const written: Written[] = [];
  let statusNotifier: ((error: any, ch: any) => void) | null = null;
  let disconnectHandler: (() => void) | null = null;
  let scanStopped = 0;
  let connectionCancelled = 0;

  const device = {
    connect: async () => device,
    discoverAllServicesAndCharacteristics: async () => device,
    readCharacteristicForService: async (_s: string, uuid: string) => {
      if (uuid !== LUA_SERVICE_UUID && options.capabilities) {
        return { value: bytesToBase64(options.capabilities) };
      }
      return { value: options.capabilities ? bytesToBase64(options.capabilities) : null };
    },
    writeCharacteristicWithoutResponseForService: (_s: string, uuid: string, value: string) => {
      if (options.failWrites) return Promise.reject(new Error('periférico ausente'));
      written.push({ characteristic: uuid, bytes: base64ToBytes(value) });
      return Promise.resolve({});
    },
    monitorCharacteristicForService: (_s: string, _c: string, cb: (e: any, ch: any) => void) => {
      statusNotifier = cb;
      return { remove: () => {} };
    },
    onDisconnected: (cb: () => void) => {
      disconnectHandler = cb;
      return { remove: () => {} };
    },
    cancelConnection: async () => {
      connectionCancelled += 1;
    },
  };

  const manager = {
    startDeviceScan: (_uuids: string[], _opts: any, cb: (e: any, d: any) => void) => {
      // El escaneo entrega el dispositivo en el turno siguiente, como el real.
      setTimeout(() => cb(null, device), 0);
    },
    stopDeviceScan: () => {
      scanStopped += 1;
    },
  };

  return {
    manager,
    written,
    notifyStatus: (bytes: number[]) => statusNotifier?.(null, { value: bytesToBase64(bytes) }),
    disconnect: () => disconnectHandler?.(),
    scanStopped: () => scanStopped,
    connectionCancelled: () => connectionCancelled,
  };
}

/** Deja que se resuelvan las promesas del `connect` del doble. */
const settle = () => new Promise<void>(resolve => setTimeout(resolve, 0));

/* -------------------------------------------------------------------------- */

describe('sin adaptador registrado, VIA+ funciona igual', () => {
  it('la fachada es un no-op silencioso', () => {
    expect(getLuaAdapter()).toBeNull();
    expect(isLuaConnected()).toBe(false);
    expect(luaCapabilities()).toBeNull();
    expect(() => luaExpress(LuaAffect.Celebracion)).not.toThrow();
    expect(() => luaSendNoisePermit(3000, 1)).not.toThrow();
  });

  it('un adaptador que lanza no se propaga a la pantalla', () => {
    const explosivo: LuaAdapter = {
      isConnected: () => {
        throw new Error('boom');
      },
      capabilities: () => {
        throw new Error('boom');
      },
      sendExpression: () => {
        throw new Error('boom');
      },
      sendNoisePermit: () => {
        throw new Error('boom');
      },
      subscribeStatus: () => () => {},
      onLinkChange: () => () => {},
    };
    setLuaAdapter(explosivo);

    expect(isLuaConnected()).toBe(false);
    expect(luaCapabilities()).toBeNull();
    expect(() => luaExpress(LuaAffect.Contenta)).not.toThrow();
    expect(() => luaSendNoisePermit(3000, 1)).not.toThrow();
  });
});

describe('adaptador BLE', () => {
  it('registra el adaptador y conecta al encontrar el servicio', async () => {
    const ble = fakeManager({ capabilities: [1, LUA_CAP_DISPLAY] });
    const cleanup = installBleLua(ble.manager);
    expect(getLuaAdapter()).not.toBeNull();

    await settle();
    expect(isLuaConnected()).toBe(true);
    expect(ble.scanStopped()).toBe(1);
    cleanup();
  });

  it('lee las capacidades al conectar', async () => {
    const ble = fakeManager({ capabilities: [1, LUA_CAP_DISPLAY | LUA_CAP_SPEAKER] });
    const cleanup = installBleLua(ble.manager);
    await settle();

    expect(luaCapabilities()).toEqual({
      protocolVersion: 1,
      display: true,
      speaker: true,
      motors: false,
      rtc: false,
    });
    cleanup();
  });

  it('escribe la expresión codificada, sin respuesta', async () => {
    const ble = fakeManager({ capabilities: [1, LUA_CAP_DISPLAY] });
    const cleanup = installBleLua(ble.manager);
    await settle();

    luaExpress(LuaAffect.Celebracion, 200);
    expect(ble.written).toEqual([
      { characteristic: LUA_EXPRESSION_UUID, bytes: [LuaAffect.Celebracion, 200] },
    ]);
    cleanup();
  });

  it('un estado afectivo inválido no llega al aire', async () => {
    const ble = fakeManager({ capabilities: [1, LUA_CAP_DISPLAY] });
    const cleanup = installBleLua(ble.manager);
    await settle();

    luaExpress(99 as LuaAffect);
    expect(ble.written).toEqual([]);
    cleanup();
  });

  it('a un periférico SIN altavoz ni motores no se le escribe ningún permiso', async () => {
    // Segunda barrera, redundante con la de `noisePermit`: aunque alguien llame
    // a mano, sobre Lúa v1 la trama no sale.
    const ble = fakeManager({ capabilities: [1, LUA_CAP_DISPLAY] });
    const cleanup = installBleLua(ble.manager);
    await settle();

    luaSendNoisePermit(3000, 1);
    expect(ble.written).toEqual([]);
    cleanup();
  });

  it('a un periférico con altavoz sí, y con el byte mágico', async () => {
    const ble = fakeManager({ capabilities: [1, LUA_CAP_DISPLAY | LUA_CAP_SPEAKER] });
    const cleanup = installBleLua(ble.manager);
    await settle();

    luaSendNoisePermit(3000, 7);
    expect(ble.written).toEqual([
      { characteristic: LUA_NOISE_PERMIT_UUID, bytes: [LUA_NOISE_PERMIT_MAGIC, 30, 7] },
    ]);
    cleanup();
  });

  it('una escritura que falla no lanza ni deja un rechazo sin manejar', async () => {
    const ble = fakeManager({ capabilities: [1, LUA_CAP_SPEAKER], failWrites: true });
    const cleanup = installBleLua(ble.manager);
    await settle();

    expect(() => luaExpress(LuaAffect.Contenta)).not.toThrow();
    await settle();
    cleanup();
  });

  it('al desconectarse olvida capacidades y deja de escribir', async () => {
    const ble = fakeManager({ capabilities: [1, LUA_CAP_SPEAKER] });
    const cleanup = installBleLua(ble.manager);
    await settle();

    ble.disconnect();
    expect(isLuaConnected()).toBe(false);
    // Capacidades olvidadas: al reconectar se vuelven a leer, y hasta entonces
    // `luaCanMakeNoise(null)` es `false`, o sea que no se concede ruido.
    expect(luaCapabilities()).toBeNull();

    luaExpress(LuaAffect.Contenta);
    expect(ble.written).toEqual([]);
    cleanup();
  });

  it('avisa de los cambios de enlace a quien los escuche', async () => {
    const ble = fakeManager({ capabilities: [1, LUA_CAP_DISPLAY] });
    const cleanup = installBleLua(ble.manager);
    const visto: boolean[] = [];
    getLuaAdapter()?.onLinkChange(c => visto.push(c));

    await settle();
    ble.disconnect();
    expect(visto).toEqual([true, false]);
    cleanup();
  });

  it('entrega el estado notificado a los suscriptores', async () => {
    const ble = fakeManager({ capabilities: [1, LUA_CAP_DISPLAY] });
    const cleanup = installBleLua(ble.manager);
    await settle();

    const recibidos: any[] = [];
    getLuaAdapter()?.subscribeStatus(s => recibidos.push(s));
    ble.notifyStatus([1, 42, 0b0010, 3]);

    expect(recibidos).toHaveLength(1);
    expect(recibidos[0]).toMatchObject({ batteryPct: 42, lowBattery: true, sequenceEcho: 3 });
    cleanup();
  });

  it('la limpieza corta el enlace y desregistra el adaptador', async () => {
    const ble = fakeManager({ capabilities: [1, LUA_CAP_DISPLAY] });
    const cleanup = installBleLua(ble.manager);
    await settle();

    cleanup();
    expect(getLuaAdapter()).toBeNull();
    expect(ble.connectionCancelled()).toBe(1);
    expect(isLuaConnected()).toBe(false);
  });

  it('un manager sin BLE disponible no rompe el arranque', () => {
    const roto = {
      startDeviceScan: () => {
        throw new Error('bluetooth apagado');
      },
      stopDeviceScan: () => {},
    };
    expect(() => {
      const cleanup = installBleLua(roto);
      cleanup();
    }).not.toThrow();
  });
});
