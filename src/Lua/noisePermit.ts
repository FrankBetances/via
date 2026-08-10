/* -------------------------------------------------------------------------- */
/*  Lúa — permiso de ruido (el control de riesgo L-1).                          */
/*                                                                             */
/*  EL SILENCIO NO SE ORDENA, SE CONCEDE                                        */
/*  La versión evidente de este control es un comando «cállate» que la tableta  */
/*  envía al entrar en un módulo con micrófono. Falla hacia el lado equivocado: */
/*  el estado seguro dependería de que un mensaje LLEGUE. Enlace caído, app     */
/*  cerrada de golpe, tableta dormida, o una pantalla nueva escrita en 2027 por */
/*  alguien que no sabe que Lúa existe — y la mascota maúlla encima de una toma */
/*  de voz. En términos de ISO 14971, un control cuyo modo de fallo produce     */
/*  exactamente el daño que quiere evitar.                                      */
/*                                                                             */
/*  Aquí está invertido: Lúa arranca muda y solo puede sonar mientras SOSTIENE  */
/*  un permiso vigente que esta tableta le renueva. La tableta no tiene que     */
/*  acordarse de silenciar, tiene que acordarse de PERMITIR, y olvidarse de     */
/*  permitir es inofensivo. Todo fallo converge en silencio.                    */
/*                                                                             */
/*  TRES CAPAS, CADA UNA SUFICIENTE POR SÍ SOLA                                 */
/*   1. Lista blanca de rutas: solo se concede en pantallas sin clínica. Dentro */
/*      de un módulo NUNCA hay permiso, así que la carrera de la capa 2 no      */
/*      llega a existir en el caso normal.                                      */
/*   2. Revocación por sesión de grabación: cuelga de `onRecordingSessionChange`*/
/*      (`src/Audio/sharedAudioContext.ts`), el punto único por el que pasan    */
/*      TODOS los consumidores de micrófono. Cubre cualquier captura, incluida  */
/*      la de módulos que todavía no existen.                                   */
/*   3. Caducidad: TTL de 3 s renovado cada 1 s. Sin renovación, el firmware    */
/*      vuelve a mudo solo. Cubre lo que el software ya no puede cubrir porque  */
/*      el software se ha muerto.                                              */
/*                                                                             */
/*  Y una cuarta, gratis, por hardware: Lúa v1 no lleva altavoz. Sin capacidad  */
/*  declarada de ruido, este módulo no envía ni un permiso.                     */
/*                                                                             */
/*  Referencia: docs/design/integracion-lua.md §3.                             */
/* -------------------------------------------------------------------------- */

import { onRecordingSessionChange, isRecordingSessionActive } from '@/Audio';
import { luaCapabilities, luaSendNoisePermit } from './luaAdapter';
import {
  luaCanMakeNoise,
  LUA_NOISE_PERMIT_RENEWAL_MS,
  LUA_NOISE_PERMIT_TTL_MS,
  nextSequence,
} from './luaProtocol';

/**
 * Las ÚNICAS rutas en las que Lúa puede hacer ruido: las que no tienen clínica
 * ninguna. La lista es corta a propósito y se declara por inclusión, no por
 * exclusión: una pantalla nueva no está en ella, así que nace en silencio. Una
 * lista de pantallas prohibidas tendría la propiedad contraria, que es la que
 * se olvida de actualizar.
 */
export const NOISE_ALLOWED_ROUTES: readonly string[] = [
  'Bienvenida',
  'SeleccionEjercicios',
  'ResultadosPreliminares',
  'ResultadosFinal',
];

export const isNoiseAllowedRoute = (route: string | null | undefined): boolean =>
  route != null && NOISE_ALLOWED_ROUTES.includes(route);

export interface NoisePermitDeps {
  /** Envío de la trama (ttlMs = 0 revoca). */
  sendPermit: (ttlMs: number, sequence: number) => void;
  /** ¿El periférico conectado puede hacer ruido o moverse? */
  canMakeNoise: () => boolean;
  /** Suscripción a las transiciones 0↔1 de la sesión de grabación. */
  subscribeRecording: (listener: (active: boolean) => void) => () => void;
  /** Estado inicial de la sesión de grabación. */
  isRecordingActive: () => boolean;
  ttlMs?: number;
  renewalMs?: number;
}

export interface NoisePermitController {
  /** Ruta activa del navegador; `null` cuando no se conoce. */
  setRoute: (route: string | null) => void;
  /** Reevalúa con los datos actuales (p. ej. al conectar y leer capacidades). */
  refresh: () => void;
  /** ¿Hay permiso concedido y renovándose ahora mismo? */
  isGranted: () => boolean;
  /** Número de secuencia del último envío (diagnóstico/tests). */
  sequence: () => number;
  /** Revoca, deja de renovar y se da de baja de todo. */
  stop: () => void;
}

/**
 * Crea un renovador con sus dependencias inyectadas: sin BLE, sin audio y sin
 * navegador, para poder probar el control de riesgo entero sin hardware, que es
 * la única forma de probarlo tantas veces como hace falta.
 */
export function createNoisePermitController(deps: NoisePermitDeps): NoisePermitController {
  const ttlMs = deps.ttlMs ?? LUA_NOISE_PERMIT_TTL_MS;
  const renewalMs = deps.renewalMs ?? LUA_NOISE_PERMIT_RENEWAL_MS;

  let route: string | null = null;
  // Se arranca con el estado REAL de la grabación, no con `false`: instalar Lúa
  // a mitad de una medición no puede conceder un permiso.
  let recording = deps.isRecordingActive();
  let granted = false;
  let sequence = 0;
  let timer: ReturnType<typeof setInterval> | null = null;
  let stopped = false;

  const send = (ttl: number): void => {
    sequence = nextSequence(sequence);
    deps.sendPermit(ttl, sequence);
  };

  const shouldGrant = (): boolean =>
    !stopped && !recording && isNoiseAllowedRoute(route) && deps.canMakeNoise();

  const revoke = (): void => {
    if (timer !== null) {
      clearInterval(timer);
      timer = null;
    }
    if (!granted) return;
    granted = false;
    // Revocación explícita: cortesía, no garantía. El silencio ya está
    // asegurado por la caducidad; esto solo lo adelanta si la trama llega.
    send(0);
  };

  const grant = (): void => {
    granted = true;
    send(ttlMs);
    timer = setInterval(() => {
      // Se revalida en cada renovación en vez de renovar a ciegas: si algo
      // cambió sin avisar (un observador que se perdió, una ruta que no se
      // notificó), el permiso muere aquí en lugar de perpetuarse.
      if (!shouldGrant()) {
        revoke();
        return;
      }
      send(ttlMs);
    }, renewalMs);
  };

  const evaluate = (): void => {
    const wanted = shouldGrant();
    if (wanted && !granted) grant();
    else if (!wanted && granted) revoke();
  };

  const unsubscribe = deps.subscribeRecording(active => {
    recording = active;
    // La revocación por micrófono es INMEDIATA: no espera al siguiente tick de
    // renovación ni a que la ruta cambie. Es el camino por el que se cubren los
    // módulos que aún no existen.
    if (active) revoke();
    else evaluate();
  });

  return {
    setRoute: next => {
      if (route === next) return;
      route = next;
      evaluate();
    },
    refresh: evaluate,
    isGranted: () => granted,
    sequence: () => sequence,
    stop: () => {
      revoke();
      stopped = true;
      try {
        unsubscribe();
      } catch {
        /* noop */
      }
    },
  };
}

/* -------------------------------------------------------------------------- */
/*  Singleton de la app                                                        */
/*                                                                             */
/*  La ruta activa se guarda AQUÍ y no en el controlador para que el navegador  */
/*  pueda informar de ella sin saber si hay hardware instalado: `App.tsx` llama */
/*  a `setActiveLuaRoute` en cada cambio de pantalla, y si Lúa se instala más   */
/*  tarde, hereda la ruta en la que ya estábamos.                              */
/* -------------------------------------------------------------------------- */

let controller: NoisePermitController | null = null;
let activeRoute: string | null = null;

/**
 * Arranca el renovador del permiso con las dependencias reales (adaptador de
 * Lúa + observador de grabación de `@/Audio`). Devuelve la función de limpieza.
 * Se llama junto a `installBleLua`, en el arranque de la app.
 */
export function installNoisePermit(): () => void {
  controller?.stop();
  const created = createNoisePermitController({
    sendPermit: luaSendNoisePermit,
    canMakeNoise: () => luaCanMakeNoise(luaCapabilities()),
    subscribeRecording: onRecordingSessionChange,
    isRecordingActive: isRecordingSessionActive,
  });
  controller = created;
  created.setRoute(activeRoute);
  return () => {
    created.stop();
    if (controller === created) controller = null;
  };
}

/**
 * Informa de la pantalla activa. Es *no-op* mientras no haya renovador
 * instalado, salvo por recordar la ruta.
 */
export function setActiveLuaRoute(route: string | null): void {
  activeRoute = route;
  controller?.setRoute(route);
}

/** Reevalúa el permiso (p. ej. al conectar el periférico y leer capacidades). */
export const refreshNoisePermit = (): void => controller?.refresh();

/** ¿Hay permiso de ruido vigente? (diagnóstico/tests) */
export const isNoisePermitGranted = (): boolean => controller?.isGranted() ?? false;

/** Solo para tests: olvida ruta y renovador. */
export function __resetNoisePermitForTests(): void {
  controller?.stop();
  controller = null;
  activeRoute = null;
}
