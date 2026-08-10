/* -------------------------------------------------------------------------- */
/*  Lúa — adaptador del periférico (BLE) y degradación a *no-op*.               */
/*                                                                             */
/*  Mismo patrón que el adaptador del pulsioxímetro                            */
/*  (`src/Screens/DysphagiaTest/pulseOximeter.ts`): en el arranque se registra  */
/*  UN adaptador único y, si nadie lo registra, todas las llamadas son          */
/*  *no-op*. VIA+ tiene que funcionar exactamente igual sin Lúa —es la norma de */
/*  la casa y aquí además es un requisito regulatorio (§4): un periférico de    */
/*  motivación no puede estar en el camino crítico de una exploración.          */
/*                                                                             */
/*  DOS REGLAS DURAS DE ESTE FICHERO                                            */
/*                                                                             */
/*  1. NADA DE `await` HACIA LÚA. Todas las funciones de envío son sincrónicas  */
/*     y devuelven `void`. Una escritura BLE que tarda, un periférico que se    */
/*     desconecta a mitad o un `startDeviceScan` que se atasca no pueden        */
/*     bloquear ni retrasar una pantalla clínica (riesgo L-4). Lo que falla, se */
/*     traga; el peor caso admisible es que la gata no reaccione.               */
/*                                                                             */
/*  2. BLE-ONLY. Lúa no anuncia, no implementa y no negocia A2DP ni HFP. No es  */
/*     una preferencia de diseño: la sesión de audio de VIA+ se configura con   */
/*     `allowBluetooth` y `allowBluetoothA2DP`, así que un perfil de audio      */
/*     clásico en el periférico permitiría a iOS encaminar hacia él los tonos   */
/*     de la audiometría — una prueba de campo libre saliendo por un altavoz de */
/*     juguete sin calibrar, y sin ningún error a la vista (riesgo L-2). Este   */
/*     fichero solo habla GATT; la verificación en el firmware es de la F1.     */
/*                                                                             */
/*  Referencia: docs/design/integracion-lua.md §5 y §6.                        */
/* -------------------------------------------------------------------------- */

import {
  base64ToBytes,
  bytesToBase64,
  decodeCapabilities,
  decodeStatus,
  encodeExpression,
  encodeNoisePermit,
  LUA_CAPABILITIES_UUID,
  LUA_EXPRESSION_UUID,
  LUA_NOISE_PERMIT_UUID,
  LUA_SERVICE_UUID,
  LUA_STATUS_UUID,
  LuaAffect,
  LuaCapabilities,
  LuaStatus,
} from './luaProtocol';

export interface LuaAdapter {
  /** ¿Hay periférico conectado ahora mismo? */
  isConnected: () => boolean;
  /** Capacidades leídas al conectar; `null` mientras no se hayan leído. */
  capabilities: () => LuaCapabilities | null;
  /** Envía una expresión. No espera confirmación y nunca lanza. */
  sendExpression: (affect: LuaAffect, intensity?: number) => void;
  /** Envía un permiso de ruido con caducidad (`ttlMs` a 0 = revocación). */
  sendNoisePermit: (ttlMs: number, sequence: number) => void;
  /** Suscribe al estado notificado (diagnóstico). Devuelve la baja. */
  subscribeStatus: (listener: (status: LuaStatus) => void) => () => void;
  /** Suscribe a los cambios de enlace (conectado / desconectado). */
  onLinkChange: (listener: (connected: boolean) => void) => () => void;
}

let adapter: LuaAdapter | null = null;

export const setLuaAdapter = (a: LuaAdapter | null): void => {
  adapter = a;
};
export const getLuaAdapter = (): LuaAdapter | null => adapter;

/* -------------------------------------------------------------------------- */
/*  Fachada *no-op*                                                            */
/*                                                                             */
/*  Las pantallas y el renovador del permiso llaman SIEMPRE a estas funciones,  */
/*  nunca a `getLuaAdapter()` directamente. Así ningún sitio de la app necesita */
/*  comprobar si hay hardware, que es la forma en que estos controles se        */
/*  olvidan.                                                                    */
/* -------------------------------------------------------------------------- */

/** ¿Hay periférico conectado? `false` también cuando no hay adaptador. */
export const isLuaConnected = (): boolean => {
  try {
    return adapter?.isConnected() ?? false;
  } catch {
    return false;
  }
};

/** Capacidades del periférico conectado, o `null`. */
export const luaCapabilities = (): LuaCapabilities | null => {
  try {
    return adapter?.capabilities() ?? null;
  } catch {
    return null;
  }
};

/** Expresa un estado afectivo. Sin adaptador, no hace nada. */
export const luaExpress = (affect: LuaAffect, intensity = 255): void => {
  try {
    adapter?.sendExpression(affect, intensity);
  } catch {
    /* un periférico de juguete no interrumpe una exploración */
  }
};

/** Concede o revoca (ttlMs = 0) el permiso de ruido. Sin adaptador, no hace nada. */
export const luaSendNoisePermit = (ttlMs: number, sequence: number): void => {
  try {
    adapter?.sendNoisePermit(ttlMs, sequence);
  } catch {
    /* idem: el silencio no depende de que esta trama salga (§3) */
  }
};

/* -------------------------------------------------------------------------- */
/*  Adaptador BLE real                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Registra el adaptador BLE real con `react-native-ble-plx`. Recibe la
 * instancia de `BleManager` de la app —la MISMA que usa el pulsioxímetro: dos
 * managers escanean por separado y se estorban— y devuelve la función de
 * limpieza.
 *
 *   import { BleManager } from 'react-native-ble-plx';
 *   const manager = new BleManager();
 *   useEffect(() => installBleLua(manager), []);
 *
 * Los permisos de Android ya están declarados en el manifiesto para el
 * pulsioxímetro (`BLUETOOTH_SCAN` con `neverForLocation` y `BLUETOOTH_CONNECT`):
 * no hace falta añadir ninguno.
 */
export function installBleLua(manager: any): () => void {
  let device: any = null;
  let connected = false;
  let caps: LuaCapabilities | null = null;
  let statusSub: any = null;
  let cancelled = false;

  const statusListeners = new Set<(s: LuaStatus) => void>();
  const linkListeners = new Set<(c: boolean) => void>();

  const setConnected = (value: boolean): void => {
    if (connected === value) return;
    connected = value;
    linkListeners.forEach(listener => {
      try {
        listener(value);
      } catch {
        /* noop */
      }
    });
  };

  /* Escritura SIN respuesta: la característica está declarada así porque el
   * presupuesto de latencia (§5.1) no admite esperar el ack del GATT, y porque
   * no hay nada que hacer con un fallo salvo ignorarlo. El `catch` vacío es
   * deliberado: escribir a un periférico que acaba de irse es normal. */
  const write = (characteristicUuid: string, bytes: number[]): void => {
    const target = device;
    if (!target || !connected) return;
    try {
      const result = target.writeCharacteristicWithoutResponseForService(
        LUA_SERVICE_UUID,
        characteristicUuid,
        bytesToBase64(bytes),
      );
      // La librería devuelve una promesa; se descarta explícitamente para que
      // nadie la espere y para no dejar un rechazo sin manejar.
      if (result && typeof result.catch === 'function') result.catch(() => {});
    } catch {
      /* noop */
    }
  };

  const connect = async (dev: any): Promise<void> => {
    device = await dev.connect();
    if (cancelled) {
      try {
        await device.cancelConnection();
      } catch {
        /* noop */
      }
      return;
    }
    await device.discoverAllServicesAndCharacteristics();

    // Capacidades PRIMERO: la política del permiso de ruido depende de ellas, y
    // hasta leerlas `luaCanMakeNoise(null)` es `false`, o sea que no se concede
    // nada. Ese orden es el que hace segura una v1 sin altavoz.
    try {
      const ch = await device.readCharacteristicForService(LUA_SERVICE_UUID, LUA_CAPABILITIES_UUID);
      caps = decodeCapabilities(ch?.value ? base64ToBytes(ch.value) : null);
    } catch {
      caps = null;
    }

    statusSub = device.monitorCharacteristicForService(
      LUA_SERVICE_UUID,
      LUA_STATUS_UUID,
      (error: any, ch: any) => {
        if (error || !ch?.value) return;
        const status = decodeStatus(base64ToBytes(ch.value));
        if (!status) return;
        statusListeners.forEach(listener => {
          try {
            listener(status);
          } catch {
            /* noop */
          }
        });
      },
    );

    device.onDisconnected(() => {
      caps = null;
      setConnected(false);
      device = null;
    });

    setConnected(true);
  };

  const scan = (): void => {
    try {
      manager.startDeviceScan([LUA_SERVICE_UUID], null, (error: any, dev: any) => {
        if (error || cancelled || !dev) return;
        try {
          manager.stopDeviceScan();
        } catch {
          /* noop */
        }
        void connect(dev).catch(() => {
          caps = null;
          setConnected(false);
          device = null;
        });
      });
    } catch {
      /* sin BLE disponible: el adaptador queda registrado y es un no-op */
    }
  };

  scan();

  setLuaAdapter({
    isConnected: () => connected,
    capabilities: () => caps,
    sendExpression: (affect, intensity = 255) => {
      const frame = encodeExpression(affect, intensity);
      // `null` = estado fuera del enumerado. No se envía nada: el códec es la
      // puerta por la que no pasa semántica clínica (ver luaProtocol.ts).
      if (frame) write(LUA_EXPRESSION_UUID, frame);
    },
    sendNoisePermit: (ttlMs, sequence) => {
      // Un permiso solo se envía a un periférico que pueda hacer ruido. En Lúa
      // v1 (pantalla y nada más) esta rama no se ejecuta jamás.
      if (!caps?.speaker && !caps?.motors) return;
      const frame = encodeNoisePermit(ttlMs, sequence);
      if (frame) write(LUA_NOISE_PERMIT_UUID, frame);
    },
    subscribeStatus: listener => {
      statusListeners.add(listener);
      return () => statusListeners.delete(listener);
    },
    onLinkChange: listener => {
      linkListeners.add(listener);
      return () => linkListeners.delete(listener);
    },
  });

  return () => {
    cancelled = true;
    try {
      manager.stopDeviceScan();
    } catch {
      /* noop */
    }
    try {
      statusSub?.remove();
    } catch {
      /* noop */
    }
    try {
      device?.cancelConnection();
    } catch {
      /* noop */
    }
    statusListeners.clear();
    linkListeners.clear();
    connected = false;
    device = null;
    caps = null;
    setLuaAdapter(null);
  };
}
