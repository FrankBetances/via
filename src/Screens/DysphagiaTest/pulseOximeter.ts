import { useEffect, useRef, useState } from 'react';

/* ==========================================================================
 * Pulsioxímetro — adaptador BLE + modo demo (Disfagia MECV-V)
 * --------------------------------------------------------------------------
 * La SpO₂ post-deglución es el dato objetivo del MECV-V (desaturación ≥3 %).
 * Biblioteca recomendada (spec v2): **react-native-ble-plx** con el perfil
 * estándar Bluetooth «Pulse Oximeter Service» (0x1822):
 *   · PLX Continuous Measurement  0x2A5F  (notify)
 *   · PLX Spot-Check Measurement  0x2A5E  (indicate)
 *
 * Patrón idéntico al adaptador de tono de Audiometría: se registra UN adaptador
 * en el arranque; sin él, `usePulseOximeter()` cae a **modo demo** (lectura
 * simulada determinista) para poder probar todo el flujo sin hardware. La UI
 * indica la fuente con un chip (BLE / demo / manual).
 * ========================================================================== */

export interface OximeterReading {
  spo2: number; // %
  hr: number | null; // lpm (frecuencia de pulso)
  at: number; // timestamp ms
}

export interface OximeterAdapter {
  /** Suscribe a lecturas; devuelve función para cancelar la suscripción. */
  subscribe: (onReading: (r: OximeterReading) => void) => () => void;
  /** `true` si hay un sensor BLE conectado y emitiendo. */
  isConnected: () => boolean;
}

let oximeterAdapter: OximeterAdapter | null = null;
export const setOximeterAdapter = (a: OximeterAdapter | null) => {
  oximeterAdapter = a;
};
export const getOximeterAdapter = () => oximeterAdapter;

/* -------------------------------------------------------------------------- */
/*  Parser IEEE-11073 SFLOAT (16 bits) usado por las medidas PLX.             */
/* -------------------------------------------------------------------------- */
export function parseSFloat(byte0: number, byte1: number): number {
  let mantissa = byte0 | ((byte1 & 0x0f) << 8);
  let exponent = byte1 >> 4;
  if (exponent >= 0x0008) exponent = -((0x000f + 1) - exponent);
  if (mantissa >= 0x0800) mantissa = -((0x0fff + 1) - mantissa);
  return mantissa * Math.pow(10, exponent);
}

/**
 * Decodifica el valor de PLX Continuous Measurement (0x2A5F).
 * Estructura: flags(uint8) + SpO2(SFLOAT) + PR(SFLOAT) [+ campos opcionales].
 */
export function decodePlxMeasurement(bytes: number[]): OximeterReading | null {
  if (!bytes || bytes.length < 5) return null;
  const spo2 = parseSFloat(bytes[1], bytes[2]);
  const pr = parseSFloat(bytes[3], bytes[4]);
  if (!isFinite(spo2) || spo2 <= 0 || spo2 > 100) return null;
  return { spo2: Math.round(spo2), hr: isFinite(pr) && pr > 0 ? Math.round(pr) : null, at: Date.now() };
}

/* -------------------------------------------------------------------------- */
/*  Servicio/Característica estándar del perfil Pulse Oximeter.                */
/* -------------------------------------------------------------------------- */
export const PLX_SERVICE_UUID = '00001822-0000-1000-8000-00805f9b34fb';
export const PLX_CONTINUOUS_UUID = '00002a5f-0000-1000-8000-00805f9b34fb';

/**
 * Registra un adaptador BLE real con react-native-ble-plx. Pásale tu instancia
 * de `BleManager` ya creada (compartida con otros módulos, p. ej. Disfagia BLE).
 * Devuelve una función de limpieza que cancela la suscripción y borra el adaptador.
 *
 *   // App.tsx / proveedor de Bluetooth
 *   import { BleManager } from 'react-native-ble-plx';
 *   const manager = new BleManager();
 *   useEffect(() => installBlePulseOximeter(manager), []);
 *
 * Requiere permisos runtime (BLUETOOTH_SCAN / BLUETOOTH_CONNECT en Android 12+,
 * y localización en versiones previas) — gestiónalos con react-native-permissions.
 */
export function installBlePulseOximeter(manager: any): () => void {
  let connected = false;
  let device: any = null;
  let monitorSub: any = null;
  const listeners = new Set<(r: OximeterReading) => void>();
  let cancelled = false;

  const emit = (r: OximeterReading) => listeners.forEach(fn => fn(r));

  const base64ToBytes = (b64: string): number[] => {
    // RN expone atob a través de la global; si no, usa Buffer.
    const globalAtob = (globalThis as { atob?: (data: string) => string }).atob;
    const bin =
      typeof globalAtob === 'function'
        ? globalAtob(b64)
        :  
          require('buffer').Buffer.from(b64, 'base64').toString('binary');
    const out: number[] = [];
    for (let i = 0; i < bin.length; i++) out.push(bin.charCodeAt(i) & 0xff);
    return out;
  };

  (async () => {
    try {
      manager.startDeviceScan([PLX_SERVICE_UUID], null, async (error: any, dev: any) => {
        if (error || cancelled || !dev) return;
        manager.stopDeviceScan();
        device = await dev.connect();
        await device.discoverAllServicesAndCharacteristics();
        connected = true;
        monitorSub = device.monitorCharacteristicForService(
          PLX_SERVICE_UUID,
          PLX_CONTINUOUS_UUID,
          (err: any, ch: any) => {
            if (err || !ch?.value) return;
            const reading = decodePlxMeasurement(base64ToBytes(ch.value));
            if (reading) emit(reading);
          },
        );
        device.onDisconnected(() => {
          connected = false;
        });
      });
    } catch {
      connected = false;
    }
  })();

  setOximeterAdapter({
    subscribe: onReading => {
      listeners.add(onReading);
      return () => listeners.delete(onReading);
    },
    isConnected: () => connected,
  });

  return () => {
    cancelled = true;
    try { manager.stopDeviceScan(); } catch {}
    try { monitorSub?.remove(); } catch {}
    try { device?.cancelConnection(); } catch {}
    listeners.clear();
    setOximeterAdapter(null);
  };
}

/* -------------------------------------------------------------------------- */
/*  Modo demo: lectura simulada determinista (sin hardware).                  */
/* -------------------------------------------------------------------------- */
function demoReading(tick: number): OximeterReading {
  // Oscila ~96-99 % con micro-variación suave; HR ~78-86 lpm.
  const spo2 = 98 + Math.round(Math.sin(tick / 5) * 1) - (tick % 11 === 0 ? 1 : 0);
  const hr = 82 + Math.round(Math.sin(tick / 3) * 4);
  return { spo2: Math.max(94, Math.min(100, spo2)), hr, at: Date.now() };
}

export type Spo2Source = 'ble' | 'demo';

export interface PulseOximeterState {
  spo2: number | null;
  hr: number | null;
  connected: boolean; // hay sensor BLE real conectado
  source: Spo2Source; // de dónde viene la lectura mostrada
}

/**
 * Hook de lectura en vivo de SpO₂/HR. Usa el adaptador BLE si está registrado;
 * si no, emite lecturas demo (cada 1 s) para no bloquear el flujo clínico.
 * La pantalla puede seguir permitiendo edición manual por encima de esto.
 */
export function usePulseOximeter(active = true): PulseOximeterState {
  const [state, setState] = useState<PulseOximeterState>({
    spo2: null,
    hr: null,
    connected: false,
    source: oximeterAdapter ? 'ble' : 'demo',
  });
  const tick = useRef(0);

  useEffect(() => {
    if (!active) return;
    const adapter = oximeterAdapter;

    if (adapter) {
      const unsub = adapter.subscribe(r =>
        setState({ spo2: r.spo2, hr: r.hr, connected: adapter.isConnected(), source: 'ble' }),
      );
      return unsub;
    }

    // Fallback demo.
    const id = setInterval(() => {
      tick.current += 1;
      const r = demoReading(tick.current);
      setState({ spo2: r.spo2, hr: r.hr, connected: false, source: 'demo' });
    }, 1000);
    return () => clearInterval(id);
  }, [active]);

  return state;
}
