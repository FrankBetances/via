/* -------------------------------------------------------------------------- */
/*  Lúa — la recompensa de cierre. La ÚNICA integración de VIA+ en la v1.        */
/*                                                                             */
/*  «La única integración de VIA+ en v1 es la recompensa de cierre, en           */
/*  `ResultadosFinal`, con la exploración ya terminada y los datos ya sellados.  */
/*  Ahí Lúa no puede contaminar nada.» — plan de Valeria+, §8.2.                 */
/*                                                                             */
/*  De ahí sale todo el diseño de este fichero, y también lo que NO tiene:       */
/*                                                                             */
/*  · No hay refuerzo durante ningún módulo. Ni al cerrar uno                    */
/*    (`ResultadosPreliminares`): la sesión sigue abierta y puede haber otra     */
/*    toma de voz a continuación. Solo al cerrar la SESIÓN.                      */
/*  · No hay lista blanca de pantallas. La versión anterior abría cuatro; el     */
/*    plan abre una, y una pantalla que no llama a esto no expresa nada.         */
/*  · No se envía `VERDICT` ni `PHASE`. Existen en el protocolo porque Valeria+  */
/*    los usa dentro de la terapia, donde el adulto califica y el aparato        */
/*    espeja el turno. En VIA+ eso sería refuerzo durante la medición, que el    */
/*    §8.4 deja explícitamente fuera de la v1: haría falta plantearse si Lúa     */
/*    pasa a ser parte del dispositivo, y esa conversación es con el organismo   */
/*    notificado.                                                               */
/*                                                                             */
/*  EL DESBLOQUEO NO ES UN DETALLE                                              */
/*  El silencio clínico deja el aparato en `LOCKED`, y en ese estado el firmware */
/*  no dibuja nada aunque se le conceda (`main.cpp:126`, `148`). Así que la      */
/*  recompensa tiene que pedir `UNLOCK` antes de conceder. El orden es           */
/*  `UNLOCK` → `GRANT` → `CELEBRATE`, y solo se arranca si NO hay ninguna        */
/*  captura de micrófono viva.                                                  */
/* -------------------------------------------------------------------------- */

import { LUA_LIMITS } from './luaProtocol';
import { luaCelebrate, luaGrant, luaHeartbeat, luaIdle, luaUnlock } from './luaAdapter';

/** Intensidad de `CELEBRATE` (0-2) para el cierre de una sesión de valoración. */
export const CLOSING_CELEBRATION_INTENSITY = 2;

/**
 * Duración de la concesión que pide la recompensa. Se piden 30 s de los 60 que
 * admite el aparato: sobra para la celebración y, si la app muere justo después,
 * el aparato vuelve a reposo antes que con el máximo.
 */
export const CLOSING_GRANT_SECONDS = 30;

export interface ClosingRewardDeps {
  unlock: () => Promise<boolean>;
  grant: (seconds: number) => void;
  celebrate: (intensity: number) => void;
  heartbeat: () => void;
  idle: () => void;
  /** ¿Hay una captura de micrófono viva ahora mismo? */
  isRecordingActive: () => boolean;
}

export interface ClosingReward {
  /** Lanza la recompensa. Idempotente: dos llamadas no celebran dos veces. */
  start: () => void;
  /** Corta el latido y deja al aparato en reposo. Se llama al salir de la pantalla. */
  stop: () => void;
  /** ¿Está celebrando ahora mismo? (diagnóstico/tests) */
  isCelebrating: () => boolean;
}

/**
 * Crea la recompensa con dependencias inyectadas. El latido se renueva cada
 * `LUA_LIMITS.heartbeatSeconds`; si la pantalla se cierra o la app muere, el
 * aparato vuelve a reposo solo al caducar la concesión, sin que nadie tenga que
 * acordarse de apagarlo.
 */
export function createClosingReward(deps: ClosingRewardDeps): ClosingReward {
  let celebrating = false;
  let timer: ReturnType<typeof setInterval> | null = null;

  const stop = (): void => {
    if (timer !== null) {
      clearInterval(timer);
      timer = null;
    }
    if (!celebrating) return;
    celebrating = false;
    // Cara neutra al salir. No hace falta revocar la concesión: caduca sola, y
    // ese es justamente el diseño del aparato.
    deps.idle();
  };

  return {
    start: () => {
      if (celebrating) return;
      // Cinturón: si por cualquier razón hubiera un micrófono abierto, aquí no se
      // celebra. No debería poder pasar —esta pantalla no graba— pero el coste de
      // comprobarlo es cero y el de equivocarse es una medición inválida.
      if (deps.isRecordingActive()) return;

      celebrating = true;
      // El desbloqueo es asíncrono y con confirmación; la concesión y la
      // celebración van detrás, pero SIN esperarlas desde la pantalla: nada del
      // camino de UI se bloquea por el aparato.
      void deps
        .unlock()
        .then(() => {
          if (!celebrating) return;
          deps.grant(CLOSING_GRANT_SECONDS);
          deps.celebrate(CLOSING_CELEBRATION_INTENSITY);
        })
        .catch(() => {
          /* sin aparato, o sin confirmación: no hay nada que hacer */
        });

      timer = setInterval(() => {
        if (!celebrating) return;
        deps.heartbeat();
      }, LUA_LIMITS.heartbeatSeconds * 1000);
    },
    stop,
    isCelebrating: () => celebrating,
  };
}

/** Recompensa con las dependencias reales (adaptador de Lúa + audio de VIA+). */
export function createRealClosingReward(isRecordingActive: () => boolean): ClosingReward {
  return createClosingReward({
    unlock: luaUnlock,
    grant: luaGrant,
    celebrate: luaCelebrate,
    heartbeat: luaHeartbeat,
    idle: luaIdle,
    isRecordingActive,
  });
}
