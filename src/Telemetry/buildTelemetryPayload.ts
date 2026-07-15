/* -------------------------------------------------------------------------- */
/*  buildTelemetryPayload — consolidación + compresión EXTREMA del payload de  */
/*  telemetría para el QR de cierre.                                           */
/*                                                                            */
/*  Formato estricto (claves de un solo carácter, ver TelemetrySnapshot):     */
/*    {"s":"ID_sesion","b":"ID_bateria","l":likert,"d":dur_ms,                 */
/*     "f":[[id,tiempo_ms,rectificaciones], ...]}                             */
/*                                                                            */
/*  Compresión: `LZString.compressToEncodedURIComponent`.                     */
/*  ¿Por qué LZString y NO Base64? Base64 NO comprime: infla +33% y solo      */
/*  aporta binary-safety, que el QR en byte-mode ya nos da. Sobre este JSON    */
/*  (claves repetidas de 1 char + arrays numéricos) LZW rinde ~50–55% de      */
/*  reducción, que es lo que mantiene el QR en una versión legible por        */
/*  cámaras de gama baja. La variante `...EncodedURIComponent` emite ASCII    */
/*  URL-safe (1 byte/char en el QR) y decodifica sin problemas de charset.    */
/* -------------------------------------------------------------------------- */

import LZString from 'lz-string';
import type { TelemetrySnapshot } from './telemetryStore';

/** Serializa al JSON estricto con ORDEN de claves fijo y sin claves extra
 *  (determinista + Zero-PHI: no se cuela ningún campo no previsto). */
export function buildTelemetryJson(snap: TelemetrySnapshot): string {
  const strict: TelemetrySnapshot = {
    s: snap.s,
    b: snap.b,
    l: snap.l,
    d: snap.d,
    // Arrays anónimos [id, tiempo, errores]: ahorran ~15–20 B/reactivo frente
    // a objetos {id,t,e}. A escala de batería, es QR legible vs. ruido.
    f: snap.f.map(([id, t, r]) => [id, t, r] as [number, number, number]),
  };
  return JSON.stringify(strict);
}

/** JSON estricto → string comprimido URL-safe listo para el QR. */
export function compressTelemetry(snap: TelemetrySnapshot): string {
  return LZString.compressToEncodedURIComponent(buildTelemetryJson(snap));
}

/** Inverso de `compressTelemetry` (verificación / tests / lector externo). */
export function decompressTelemetry(payload: string): TelemetrySnapshot | null {
  const json = LZString.decompressFromEncodedURIComponent(payload);
  if (!json) return null;
  try {
    return JSON.parse(json) as TelemetrySnapshot;
  } catch {
    return null;
  }
}
