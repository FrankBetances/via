/* -------------------------------------------------------------------------- */
/*  telemetryStore — store de telemetría de usabilidad "Zero-PHI" de la        */
/*  batería VIA+.                                                              */
/*                                                                            */
/*  ¿Por qué un SINGLETON de módulo y no un slice de Redux ni un useState?     */
/*  Las 9 pruebas de la batería son RUTAS HERMANAS de un único native-stack    */
/*  (ver Navigators/Default.tsx); no existe un componente que las envuelva.    */
/*  Un `useRef`/`useState` dentro de una pantalla de módulo se PIERDE al       */
/*  desmontarse esa pantalla al volver al hub. Este singleton vive FUERA del   */
/*  árbol React, así que la medición sobrevive a toda la navegación hasta      */
/*  ResultadosFinal. El hook `useTelemetryTracker` solo expone una API         */
/*  estable (vía useRef) sobre este módulo → CERO useState, CERO re-render.    */
/*                                                                            */
/*  Zero-PHI: NADA aquí identifica al paciente. `sessionId` es aleatorio (no   */
/*  derivado del NHC ni del id clínico) y el estado es EFÍMERO en memoria      */
/*  (nunca toca Firestore ni SQLite ni redux-persist).                        */
/* -------------------------------------------------------------------------- */

/** Payload final que viaja en el QR. Claves de un solo carácter a propósito. */
export interface TelemetrySnapshot {
  /** ID de sesión Zero-PHI (8 chars, NO reversible a paciente). */
  s: string;
  /** ID/tag compacto de la batería ejecutada. */
  b: string;
  /** Puntuación Likert (1–5). 0 = todavía sin responder. */
  l: number;
  /** Duración total de la batería en ms. */
  d: number;
  /** Fricción por reactivo: `[id_ordinal, tiempo_ms, rectificaciones]`. */
  f: Array<[number, number, number]>;
}

interface ReactivoRecord {
  /** Índice ordinal 1-based (orden de aparición), NO un UUID → ahorra bytes. */
  ordinal: number;
  /** Marca temporal de la última activación del reactivo. */
  enteredAt: number;
  /** Tiempo (ms) desde la activación hasta la 1ª clasificación. */
  responseMs: number;
  /** Reclasificaciones posteriores a la primera (fricción/duda del clínico). */
  rectifications: number;
  /** Si ya se clasificó al menos una vez. */
  classified: boolean;
}

interface SessionState {
  sessionId: string;
  batteryId: string;
  startedAt: number;
  endedAt: number | null;
  likert: number;
  /** Claves en orden de aparición → define el `ordinal` y el orden de `f`. */
  order: string[];
  reactivos: Map<string, ReactivoRecord>;
}

/** Reloj monótono cuando está disponible; si no, epoch. Sin timers colgables. */
function now(): number {
  const p = (globalThis as { performance?: { now?: () => number } }).performance;
  return typeof p?.now === 'function' ? p.now() : Date.now();
}

/** ID Zero-PHI de 8 chars base36 (aleatorio + entropía temporal). */
function genSessionId(): string {
  const rand = Math.random().toString(36).slice(2);
  const time = Date.now().toString(36);
  return (rand + time).slice(0, 8).padEnd(8, '0');
}

/* --------------------------- estado del módulo ---------------------------- */

let session: SessionState | null = null;

function createSession(batteryId: string): SessionState {
  return {
    sessionId: genSessionId(),
    batteryId,
    startedAt: now(),
    endedAt: null,
    likert: 0,
    order: [],
    reactivos: new Map(),
  };
}

/** Garantiza sesión activa (auto-arranque defensivo si un módulo mide antes
 *  de que el hub llame a `startSession`). */
function ensureSession(): SessionState {
  if (session === null) session = createSession('');
  return session;
}

/* ------------------------------- API pública ------------------------------ */

/** Arranca (o reinicia) la medición de una batería. Idempotente por diseño:
 *  SIEMPRE parte de estado limpio → nunca mezcla la sesión del paciente
 *  anterior con la nueva (evita la "sesión zombie"). Devuelve el sessionId. */
export function startSession(batteryId = ''): string {
  session = createSession(batteryId);
  return session.sessionId;
}

/** Registra la activación de un reactivo. `key` es una clave opaca del módulo
 *  (p. ej. el id del ítem); solo se usa para deduplicar y ordenar, no se
 *  exporta. Reactivos nuevos reciben el siguiente ordinal. */
export function enterReactivo(rawKey: string | number): void {
  const s = ensureSession();
  const key = String(rawKey);
  const existing = s.reactivos.get(key);
  if (existing) {
    // Revisita de un reactivo aún sin clasificar → reinicia la ventana de
    // tiempo (medimos el tiempo hasta responder en la última visita).
    if (!existing.classified) existing.enteredAt = now();
    return;
  }
  s.order.push(key);
  s.reactivos.set(key, {
    ordinal: s.order.length,
    enteredAt: now(),
    responseMs: 0,
    rectifications: 0,
    classified: false,
  });
}

/** Registra la clasificación de un reactivo. La 1ª fija `responseMs`; las
 *  siguientes cuentan como rectificaciones (el clínico cambió de opinión). */
export function classifyReactivo(rawKey: string | number): void {
  const s = ensureSession();
  const key = String(rawKey);
  let rec = s.reactivos.get(key);
  if (!rec) {
    enterReactivo(key);
    rec = s.reactivos.get(key)!;
  }
  if (!rec.classified) {
    rec.responseMs = Math.max(0, now() - rec.enteredAt);
    rec.classified = true;
  } else {
    rec.rectifications += 1;
  }
}

/** Fija la percepción Likert (1–5). 0 lo trata como "sin responder". */
export function setLikert(score: number): void {
  const s = ensureSession();
  s.likert = Number.isFinite(score) ? Math.max(0, Math.min(5, Math.round(score))) : 0;
}

/** Congela la duración total de la batería. Idempotente. */
export function endSession(): void {
  if (session && session.endedAt === null) session.endedAt = now();
}

/** Limpia toda la telemetría (cierre de sesión clínica / cambio de paciente). */
export function resetTelemetry(): void {
  session = null;
}

/** Snapshot listo para comprimir. `null` si nunca arrancó una sesión. */
export function getSnapshot(): TelemetrySnapshot | null {
  if (session === null) return null;
  const end = session.endedAt ?? now();
  const f: Array<[number, number, number]> = session.order.map(key => {
    const r = session!.reactivos.get(key)!;
    return [r.ordinal, Math.round(r.responseMs), r.rectifications];
  });
  return {
    s: session.sessionId,
    b: session.batteryId,
    l: session.likert,
    d: Math.max(0, Math.round(end - session.startedAt)),
    f,
  };
}
