/* -------------------------------------------------------------------------- */
/*  Lúa — adaptador del periférico (BLE) y degradación a *no-op*.               */
/*                                                                             */
/*  Lúa es la mascota de Valeria+ —una gata en píxel art— y también el aparato  */
/*  físico de refuerzo sobre ESP32-C3. El plan que manda es                      */
/*  `docs/plan-integracion-lua.md` en `FrankBetances/Valeria`, porque allí viven */
/*  el firmware y la tabla de opcodes.                                          */
/*                                                                             */
/*  QUÉ HACE VIA+ CON LÚA, Y ES MUY POCO                                        */
/*  El §8 de ese plan se titula «VIA+: la integración correcta es la ausencia», y */
/*  fija la postura: Lúa **no está presente durante la medición** —requisito de   */
/*  procedimiento, no de software— y la única integración de la v1 es la          */
/*  recompensa de cierre, con la exploración terminada y los datos sellados. Por  */
/*  eso este adaptador expone tan poco: `CTRL` para la celebración de cierre,     */
/*  `SAFE` para el silencio clínico como defensa en profundidad, y `STATE` para   */
/*  diagnóstico. `CFG` no se usa en la v1.                                       */
/*                                                                             */
/*  DOS REGLAS DURAS                                                            */
/*  1. NADA DE `await` HACIA LÚA desde un flujo clínico. Los envíos de `CTRL` son */
/*     dispara-y-olvida con `catch` vacío deliberado. Una mascota apagada no      */
/*     puede colgar una exploración. La excepción es `SAFE`, que sí devuelve      */
/*     promesa —se escribe con confirmación— pero tampoco se espera en el camino  */
/*     crítico: se lanza y se comprueba después.                                 */
/*  2. BLE-ONLY. La sesión de audio de VIA+ se configura con `allowBluetooth` y   */
/*     `allowBluetoothA2DP`; un perfil de audio clásico en el periférico dejaría  */
/*     que iOS encaminase hacia él los tonos de la audiometría, sin ningún error  */
/*     a la vista. Lúa no anuncia A2DP ni HFP, y en la v1 no tiene ni altavoz.    */
/* -------------------------------------------------------------------------- */

import {
  LUA_CAP,
  LUA_CHR,
  LUA_OP,
  LUA_SAFE,
  LUA_SERVICE_UUID,
  luaFrame,
  luaGrantParam,
  type LuaOp,
} from './luaProtocol';
import {
  base64ToBytes,
  bytesToBase64,
  clampGrantSeconds,
  decodeLuaState,
  luaSafeFrame,
  type LuaState,
} from './luaWire';

export interface LuaAdapter {
  /** ¿Hay aparato conectado ahora mismo? */
  isConnected: () => boolean;
  /** Último estado notificado por `STATE`; `null` si no ha llegado ninguno. */
  state: () => LuaState | null;
  /** Escribe en `CTRL` (sin confirmación). No espera y nunca lanza. */
  sendCtrl: (op: LuaOp, param?: number) => void;
  /** Escribe en `SAFE` (con confirmación). Devuelve si la escritura se confirmó. */
  sendSafe: (safeOp: number) => Promise<boolean>;
  /** Suscribe al estado notificado (diagnóstico). Devuelve la baja. */
  subscribeState: (listener: (state: LuaState) => void) => () => void;
  /** Suscribe a los cambios de enlace. */
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
/*  Todo el resto de la app llama a estas funciones, nunca al adaptador. Sin    */
/*  aparato son no-op y no hay que comprobar nada en el sitio de la llamada,    */
/*  que es como se olvidan estos controles.                                    */
/* -------------------------------------------------------------------------- */

export const isLuaConnected = (): boolean => {
  try {
    return adapter?.isConnected() ?? false;
  } catch {
    return false;
  }
};

export const luaState = (): LuaState | null => {
  try {
    return adapter?.state() ?? null;
  } catch {
    return null;
  }
};

/** Envía un opcode de `CTRL`. Sin aparato, no hace nada. */
export const luaCtrl = (op: LuaOp, param = 0): void => {
  try {
    adapter?.sendCtrl(op, param);
  } catch {
    /* una mascota no interrumpe una exploración */
  }
};

/**
 * Concede capacidades durante `seconds` (1-60). Sin `caps` concede **solo la
 * visual**: la sonora nunca es implícita y hay que pedir su bit.
 *
 * VIA+ no la pide nunca. Desde la D-K la voz sale del altavoz de la tableta y
 * Lúa es muda en los siete módulos, así que aquí `caps` existe para que
 * `LUA_CAP.SOUND` tenga que escribirse a mano el día que alguien lo intente.
 */
export const luaGrant = (seconds: number, caps: number = LUA_CAP.VISUAL): void =>
  luaCtrl(LUA_OP.GRANT, luaGrantParam(clampGrantSeconds(seconds), caps));

/** Renueva la concesión viva. El firmware la extiende al máximo (60 s). */
export const luaHeartbeat = (): void => luaCtrl(LUA_OP.HEARTBEAT);

/** Cara neutra. Funciona SIN concesión (`main.cpp:137-140`), a propósito. */
export const luaIdle = (): void => luaCtrl(LUA_OP.IDLE);

/** Celebración, intensidad 0-2. Exige concesión viva en el aparato. */
export const luaCelebrate = (intensity: number): void =>
  luaCtrl(LUA_OP.CELEBRATE, Math.max(0, Math.min(2, Math.round(intensity))));

/**
 * Estado afectivo emocional. La tabla del enlace declara **0-7**:
 * 0: Alegría, 1: Amor, 2: Gratitud, 3: Tranquilidad, 4: Esperanza, 5: Orgullo,
 * 6: Inspiración, 7: Diversión.
 *
 * El 8 —«escucha atenta»— NO está en la tabla, y aquí funciona por el
 * `default` del firmware, no por diseño. Comprobado el 27/8/2026 contra
 * `core/src/device.cpp` de lua-firmware: el `switch` de `LUA_OP_AFFECT` manda
 * a `kExprAttentive` todo id que no reconozca, y el `spawnAffect` de las
 * partículas se salta con `if (param <= 7)`. O sea que un `AFFECT(8)` deja la
 * cara atenta y sin partículas, que es exactamente lo que hace falta en la
 * audiometría verbal y en el T.A.R.
 *
 * Este comentario decía hasta hoy que un firmware que no reconociera el id
 * debía replegarlo a `Tranquility` (3). **Era falso**: el aparato lo repliega a
 * la escucha atenta, no a la calma. Que el resultado nos venga bien no lo
 * convierte en contrato — mientras el 8 no esté en `protocol.json` esto depende
 * de una rama `default`, y eso está anotado en `docs/design/integracion-lua.md`
 * para subirlo a Valeria+, que es donde se decide la tabla.
 *
 * El rango se sigue acotando a 0-15 (medio byte) para no inventar un parámetro
 * imposible, y NO se toma el módulo: `8 % 8` pintaría Alegría en plena escucha.
 */
export const luaAffect = (emotion: number): void =>
  luaCtrl(LUA_OP.AFFECT, Math.max(0, Math.min(15, Math.round(emotion))));

/** Fase del turno clínico (0-3): 0: escucha, 1: repite/fonación, 2: veredicto, 3: misión */
export const luaPhase = (phase: number): void =>
  luaCtrl(LUA_OP.PHASE, Math.max(0, Math.min(3, Math.round(phase))));

/** Veredicto de articulación / respuesta (0-2): 0: no coincide, 1: casi, 2: aprobado */
export const luaVerdict = (level: number): void =>
  luaCtrl(LUA_OP.VERDICT, Math.max(0, Math.min(2, Math.round(level))));

/** Pictograma de la ficha del ejercicio (0-0xFFFF, 0xFFFF quita) */
export const luaPicto = (index: number): void =>
  luaCtrl(LUA_OP.PICTO, Math.max(0, Math.min(0xffff, Math.round(index))));

/** Insignia glífica (glifo 0-8, rango 0-4) */
export const luaAward = (glyph: number, rank = 0): void => {
  const g = Math.max(0, Math.min(8, Math.round(glyph)));
  const r = Math.max(0, Math.min(4, Math.round(rank)));
  // eslint-disable-next-line no-bitwise -- insignia y rango viajan empaquetados en el parámetro de 16 bits de la trama.
  luaCtrl(LUA_OP.AWARD, (r << 8) | g);
};

/** Nivel de progresión en el anillo radial (1-12) */
export const luaLevel = (level: number): void =>
  luaCtrl(LUA_OP.LEVEL, Math.max(1, Math.min(12, Math.round(level))));

/** Animación de llamada del Modo Vínculo */
export const luaCall = (): void => luaCtrl(LUA_OP.CALL);

/**
 * Silencio clínico: revoca la concesión y **bloquea** nuevas hasta un desbloqueo
 * explícito. Con confirmación. Resuelve `false` si no hay aparato o si la
 * escritura no llegó — que no es una emergencia: el control de la medición es la
 * ausencia física del aparato, no esta trama (§8).
 */
export const luaClinicalSilence = async (): Promise<boolean> => {
  try {
    return (await adapter?.sendSafe(LUA_SAFE.CLINICAL_SILENCE)) ?? false;
  } catch {
    return false;
  }
};

/**
 * Silencio SONORO: quita la capacidad de sonar y **deja la pantalla viva**. Es
 * lo que permite que la gata acompañe la /a/ sostenida con el micrófono
 * abierto, que con `CLINICAL_SILENCE` era imposible —bloquea el aparato entero
 * y en `LOCKED` no se dibuja nada—.
 *
 * Pega en el firmware hasta un `luaUnlock()` explícito: un `GRANT` posterior no
 * devuelve el sonido. No sustituye al silencio clínico y no lo suaviza; son dos
 * herramientas para dos casos, y la de apagarlo todo sigue siendo la otra.
 */
export const luaMute = async (): Promise<boolean> => {
  try {
    return (await adapter?.sendSafe(LUA_SAFE.MUTE)) ?? false;
  } catch {
    return false;
  }
};

/** Levanta el bloqueo del silencio clínico y el sonoro. Sin esto, el aparato no dibuja nada. */
export const luaUnlock = async (): Promise<boolean> => {
  try {
    return (await adapter?.sendSafe(LUA_SAFE.UNLOCK)) ?? false;
  } catch {
    return false;
  }
};

/* -------------------------------------------------------------------------- */
/*  Adaptador BLE real                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Registra el adaptador BLE con `react-native-ble-plx`. Recibe el `BleManager` de
 * la app —el MISMO que usa el pulsioxímetro— y devuelve la función de limpieza.
 *
 * El aparato **solo anuncia 120 s tras pulsar su botón físico** (§6.4 del plan de
 * Valeria+), así que un escaneo que no encuentra nada es lo normal, no un fallo.
 */
export function installBleLua(manager: any): () => void {
  let device: any = null;
  let connected = false;
  let lastState: LuaState | null = null;
  let stateSub: any = null;
  let cancelled = false;

  const stateListeners = new Set<(s: LuaState) => void>();
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

    stateSub = device.monitorCharacteristicForService(
      LUA_SERVICE_UUID,
      LUA_CHR.STATE,
      (error: any, ch: any) => {
        if (error || !ch?.value) return;
        const next = decodeLuaState(base64ToBytes(ch.value));
        if (!next) return;
        lastState = next;
        stateListeners.forEach(listener => {
          try {
            listener(next);
          } catch {
            /* noop */
          }
        });
      },
    );

    device.onDisconnected(() => {
      lastState = null;
      setConnected(false);
      device = null;
    });

    setConnected(true);
  };

  try {
    manager.startDeviceScan([LUA_SERVICE_UUID], null, (error: any, dev: any) => {
      if (error || cancelled || !dev) return;
      try {
        manager.stopDeviceScan();
      } catch {
        /* noop */
      }
      void connect(dev).catch(() => {
        lastState = null;
        setConnected(false);
        device = null;
      });
    });
  } catch {
    /* sin BLE disponible: el adaptador queda registrado y es un no-op */
  }

  setLuaAdapter({
    isConnected: () => connected,
    state: () => lastState,
    sendCtrl: (op, param = 0) => {
      if (!device || !connected) return;
      try {
        // Sin confirmación a propósito: pedir ACK duplica el peor caso del
        // presupuesto de latencia (300 ms) y una celebración perdida no le
        // importa a nadie.
        const result = device.writeCharacteristicWithoutResponseForService(
          LUA_SERVICE_UUID,
          LUA_CHR.CTRL,
          bytesToBase64(luaFrame(op, param)),
        );
        if (result && typeof result.catch === 'function') result.catch(() => {});
      } catch {
        /* noop */
      }
    },
    sendSafe: async safeOp => {
      if (!device || !connected) return false;
      try {
        await device.writeCharacteristicWithResponseForService(
          LUA_SERVICE_UUID,
          LUA_CHR.SAFE,
          bytesToBase64(luaSafeFrame(safeOp)),
        );
        return true;
      } catch {
        return false;
      }
    },
    subscribeState: listener => {
      stateListeners.add(listener);
      return () => stateListeners.delete(listener);
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
      stateSub?.remove();
    } catch {
      /* noop */
    }
    try {
      device?.cancelConnection();
    } catch {
      /* noop */
    }
    stateListeners.clear();
    linkListeners.clear();
    connected = false;
    device = null;
    lastState = null;
    setLuaAdapter(null);
  };
}
