/* -------------------------------------------------------------------------- */
/*  @/Telemetry — barrel de la telemetría de usabilidad Zero-PHI de VIA+.      */
/* -------------------------------------------------------------------------- */

export { useTelemetryTracker } from './useTelemetryTracker';
export type { TelemetryTracker } from './useTelemetryTracker';
export { buildTelemetryJson, compressTelemetry, decompressTelemetry } from './buildTelemetryPayload';
export type { TelemetrySnapshot } from './telemetryStore';
