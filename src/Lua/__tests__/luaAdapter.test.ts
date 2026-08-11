/* -------------------------------------------------------------------------- */
/*  Pruebas del adaptador de Lúa.                                               */
/*                                                                             */
/*  Lo importante que se verifica es lo que NO pasa: sin aparato, con el aparato  */
/*  caído o con una escritura que falla, nada lanza y nada bloquea. Es el         */
/*  requisito de que VIA+ funcione idénticamente sin Lúa, y también la regla de   */
/*  la casa de que ningún camino clínico espere (`await`) al periférico.          */
/*                                                                             */
/*  Y se verifica que escribe donde toca: `CTRL` sin confirmación, `SAFE` CON     */
/*  confirmación. Confundir las dos es lo que haría que el silencio clínico se    */
/*  diera por enviado sin saber si llegó.                                        */
/* -------------------------------------------------------------------------- */

import {
  getLuaAdapter,
  installBleLua,
  isLuaConnected,
  luaCelebrate,
  luaClinicalSilence,
  luaGrant,
  luaHeartbeat,
  luaIdle,
  luaState,
  luaUnlock,
  setLuaAdapter,
  type LuaAdapter,
} from '../luaAdapter';
import { LUA_CHR, LUA_MODE, LUA_OP, LUA_PROTOCOL_VERSION, LUA_SAFE, LUA_SERVICE_UUID } from '../luaProtocol';
import { base64ToBytes, bytesToBase64 } from '../luaWire';

afterEach(() => {
  setLuaAdapter(null);
});

interface Written {
  characteristic: string;
  bytes: number[];
  withResponse: boolean;
}

function fakeManager(options: { failWrites?: boolean } = {}) {
  const written: Written[] = [];
  let stateNotifier: ((error: any, ch: any) => void) | null = null;
  let disconnectHandler: (() => void) | null = null;
  let scanStopped = 0;
  let cancelled = 0;

  const device = {
    connect: async () => device,
    discoverAllServicesAndCharacteristics: async () => device,
    writeCharacteristicWithoutResponseForService: (_s: string, uuid: string, value: string) => {
      if (options.failWrites) return Promise.reject(new Error('aparato ausente'));
      written.push({ characteristic: uuid, bytes: base64ToBytes(value), withResponse: false });
      return Promise.resolve({});
    },
    writeCharacteristicWithResponseForService: async (_s: string, uuid: string, value: string) => {
      if (options.failWrites) throw new Error('aparato ausente');
      written.push({ characteristic: uuid, bytes: base64ToBytes(value), withResponse: true });
      return {};
    },
    monitorCharacteristicForService: (_s: string, _c: string, cb: (e: any, ch: any) => void) => {
      stateNotifier = cb;
      return { remove: () => {} };
    },
    onDisconnected: (cb: () => void) => {
      disconnectHandler = cb;
      return { remove: () => {} };
    },
    cancelConnection: async () => {
      cancelled += 1;
    },
  };

  const manager = {
    startDeviceScan: (_uuids: string[], _opts: any, cb: (e: any, d: any) => void) => {
      setTimeout(() => cb(null, device), 0);
    },
    stopDeviceScan: () => {
      scanStopped += 1;
    },
  };

  return {
    manager,
    written,
    notifyState: (bytes: number[]) => stateNotifier?.(null, { value: bytesToBase64(bytes) }),
    disconnect: () => disconnectHandler?.(),
    scanStopped: () => scanStopped,
    cancelled: () => cancelled,
  };
}

const settle = () => new Promise<void>(resolve => setTimeout(resolve, 0));

describe('sin adaptador registrado, VIA+ funciona igual', () => {
  it('la fachada es un no-op silencioso', async () => {
    expect(getLuaAdapter()).toBeNull();
    expect(isLuaConnected()).toBe(false);
    expect(luaState()).toBeNull();
    expect(() => luaIdle()).not.toThrow();
    expect(() => luaCelebrate(2)).not.toThrow();
    expect(() => luaGrant(30)).not.toThrow();
    expect(() => luaHeartbeat()).not.toThrow();
    await expect(luaClinicalSilence()).resolves.toBe(false);
    await expect(luaUnlock()).resolves.toBe(false);
  });

  it('un adaptador que lanza no se propaga a la pantalla', async () => {
    const explosivo: LuaAdapter = {
      isConnected: () => {
        throw new Error('boom');
      },
      state: () => {
        throw new Error('boom');
      },
      sendCtrl: () => {
        throw new Error('boom');
      },
      sendSafe: () => {
        throw new Error('boom');
      },
      subscribeState: () => () => {},
      onLinkChange: () => () => {},
    };
    setLuaAdapter(explosivo);

    expect(isLuaConnected()).toBe(false);
    expect(luaState()).toBeNull();
    expect(() => luaCelebrate(1)).not.toThrow();
    await expect(luaClinicalSilence()).resolves.toBe(false);
  });
});

describe('adaptador BLE', () => {
  it('escanea por el servicio del aparato y conecta', async () => {
    const ble = fakeManager();
    const cleanup = installBleLua(ble.manager);
    await settle();
    expect(isLuaConnected()).toBe(true);
    expect(ble.scanStopped()).toBe(1);
    cleanup();
  });

  it('CTRL va sin confirmación, con la trama de cuatro bytes', async () => {
    const ble = fakeManager();
    const cleanup = installBleLua(ble.manager);
    await settle();

    luaGrant(30);
    luaCelebrate(2);
    expect(ble.written).toEqual([
      {
        characteristic: LUA_CHR.CTRL,
        bytes: [LUA_PROTOCOL_VERSION, LUA_OP.GRANT, 30, 0],
        withResponse: false,
      },
      {
        characteristic: LUA_CHR.CTRL,
        bytes: [LUA_PROTOCOL_VERSION, LUA_OP.CELEBRATE, 2, 0],
        withResponse: false,
      },
    ]);
    cleanup();
  });

  it('el TTL de la concesión se recorta al máximo del aparato antes de salir', async () => {
    const ble = fakeManager();
    const cleanup = installBleLua(ble.manager);
    await settle();

    luaGrant(9999);
    expect(ble.written[0].bytes).toEqual([LUA_PROTOCOL_VERSION, LUA_OP.GRANT, 60, 0]);
    cleanup();
  });

  it('SAFE va CON confirmación y sin byte de versión', async () => {
    const ble = fakeManager();
    const cleanup = installBleLua(ble.manager);
    await settle();

    await expect(luaClinicalSilence()).resolves.toBe(true);
    expect(ble.written).toEqual([
      {
        characteristic: LUA_CHR.SAFE,
        bytes: [LUA_SAFE.CLINICAL_SILENCE, 0x00],
        withResponse: true,
      },
    ]);
    cleanup();
  });

  it('una escritura de SAFE que falla se reporta como no confirmada', async () => {
    const ble = fakeManager({ failWrites: true });
    const cleanup = installBleLua(ble.manager);
    await settle();

    await expect(luaClinicalSilence()).resolves.toBe(false);
    cleanup();
  });

  it('una escritura de CTRL que falla no lanza ni deja un rechazo suelto', async () => {
    const ble = fakeManager({ failWrites: true });
    const cleanup = installBleLua(ble.manager);
    await settle();

    expect(() => luaCelebrate(2)).not.toThrow();
    await settle();
    cleanup();
  });

  it('publica el estado notificado y lo olvida al desconectar', async () => {
    const ble = fakeManager();
    const cleanup = installBleLua(ble.manager);
    await settle();

    const recibidos: any[] = [];
    getLuaAdapter()?.subscribeState(s => recibidos.push(s));
    ble.notifyState([LUA_MODE.ACTIVE, 42, LUA_OP.CELEBRATE, LUA_PROTOCOL_VERSION, 30, 1, 0, 0]);

    expect(recibidos).toHaveLength(1);
    expect(luaState()).toMatchObject({ mode: LUA_MODE.ACTIVE, grantSecondsLeft: 42, fps: 30 });

    ble.disconnect();
    expect(isLuaConnected()).toBe(false);
    expect(luaState()).toBeNull();
    cleanup();
  });

  it('con el aparato desconectado no se escribe nada', async () => {
    const ble = fakeManager();
    const cleanup = installBleLua(ble.manager);
    await settle();
    ble.disconnect();

    luaCelebrate(2);
    await expect(luaClinicalSilence()).resolves.toBe(false);
    expect(ble.written).toEqual([]);
    cleanup();
  });

  it('avisa de los cambios de enlace', async () => {
    const ble = fakeManager();
    const cleanup = installBleLua(ble.manager);
    const visto: boolean[] = [];
    getLuaAdapter()?.onLinkChange(c => visto.push(c));

    await settle();
    ble.disconnect();
    expect(visto).toEqual([true, false]);
    cleanup();
  });

  it('la limpieza corta el enlace y desregistra el adaptador', async () => {
    const ble = fakeManager();
    const cleanup = installBleLua(ble.manager);
    await settle();

    cleanup();
    expect(getLuaAdapter()).toBeNull();
    expect(ble.cancelled()).toBe(1);
  });

  it('un manager sin BLE disponible no rompe el arranque', () => {
    const roto = {
      startDeviceScan: () => {
        throw new Error('bluetooth apagado');
      },
      stopDeviceScan: () => {},
    };
    expect(() => installBleLua(roto)()).not.toThrow();
  });

  it('escanea por el UUID del servicio real, no por otro', async () => {
    let scannedFor: string[] | null = null;
    const manager = {
      startDeviceScan: (uuids: string[]) => {
        scannedFor = uuids;
      },
      stopDeviceScan: () => {},
    };
    const cleanup = installBleLua(manager);
    expect(scannedFor).toEqual([LUA_SERVICE_UUID]);
    cleanup();
  });
});
