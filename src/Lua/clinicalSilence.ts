/* -------------------------------------------------------------------------- */
/*  Lúa — silencio clínico: DEFENSA EN PROFUNDIDAD, no control de riesgo.       */
/*                                                                             */
/*  LO QUE ESTE MÓDULO NO ES                                                    */
/*  No es el control de riesgo de la interferencia del periférico. Conviene      */
/*  decirlo primero porque la versión anterior de este fichero lo declaraba como */
/*  tal, y era un error caro: convertir el silencio en un control implementado   */
/*  por software de un dispositivo externo no verificado obliga a demostrar,     */
/*  para el marcado CE, que el comando llega siempre, que el firmware siempre    */
/*  obedece y que el fallo es detectable. VIA+ es SaMD Clase IIa; eso entra en   */
/*  el expediente técnico.                                                      */
/*                                                                             */
/*  **El control es la ausencia física: Lúa no entra en la cabina ni en la sala  */
/*  de campo libre durante una medición.** Es un requisito del protocolo de      */
/*  exploración, y se audita mirando, no leyendo logs. Un aparato ausente no      */
/*  puede interferir.                                                           */
/*                                                                             */
/*  LO QUE SÍ ES                                                                */
/*  El cinturón sobre los tirantes, para el caso de que alguien la traiga        */
/*  puesta: al abrirse cualquier captura de micrófono se escribe `SAFE`          */
/*  `CLINICAL_SILENCE`, que en el aparato revoca la concesión viva y **bloquea**  */
/*  nuevas hasta un `UNLOCK` explícito (`main.cpp:165-170`).                     */
/*                                                                             */
/*  POR QUÉ CUELGA DEL MICRÓFONO Y NO DE UNA LISTA DE PANTALLAS                 */
/*  El plan pide emitirlo «al abrir cualquier pantalla de captura». Colgarlo de  */
/*  `onRecordingSessionChange()` —el punto único por el que pasan todos los      */
/*  consumidores de micrófono de VIA+— cumple eso y además cubre a los módulos    */
/*  que todavía no existen: el quinto que se escriba queda protegido sin que su   */
/*  autor sepa que Lúa existe. Una lista de pantallas hay que recordar            */
/*  actualizarla; esto se hereda.                                               */
/*                                                                             */
/*  Referencias: `FrankBetances/Valeria` · `docs/plan-integracion-lua.md` §5 y   */
/*  §8; `docs/design/integracion-lua.md` §3 en este repositorio.                */
/* -------------------------------------------------------------------------- */

import { isRecordingSessionActive, onRecordingSessionChange } from '@/Audio';
import { luaClinicalSilence, luaIdle } from './luaAdapter';

export interface ClinicalSilenceDeps {
  /** Escribe `SAFE`/`CLINICAL_SILENCE`. Resuelve si se confirmó. */
  silence: () => Promise<boolean>;
  /** Manda cara neutra por `CTRL`; funciona sin concesión. */
  idle: () => void;
  subscribeRecording: (listener: (active: boolean) => void) => () => void;
  isRecordingActive: () => boolean;
}

export interface ClinicalSilenceController {
  /** ¿Se ha emitido el silencio y no se ha vuelto a permitir nada desde entonces? */
  isSilenced: () => boolean;
  /** Nº de emisiones (diagnóstico/tests). */
  emissions: () => number;
  stop: () => void;
}

/**
 * Arranca el vigilante con dependencias inyectadas: sin BLE y sin audio nativo,
 * para poder probarlo en cada commit.
 *
 * Emite en el momento en que se abre la primera captura, y **también al instalarse
 * si ya hay una captura en curso** — conectar el aparato a mitad de una medición
 * no puede dejarlo desbloqueado.
 */
export function createClinicalSilenceController(deps: ClinicalSilenceDeps): ClinicalSilenceController {
  let silenced = false;
  let emissions = 0;
  let stopped = false;

  const emit = (): void => {
    if (stopped) return;
    emissions += 1;
    silenced = true;
    // La cara neutra va por CTRL además del SAFE: el aparato ya la pone al
    // bloquearse, pero si el SAFE no llegara, esto al menos lo deja quieto.
    deps.idle();
    void deps.silence().catch(() => false);
  };

  if (deps.isRecordingActive()) emit();

  const unsubscribe = deps.subscribeRecording(active => {
    if (active) emit();
    // Al cerrarse la captura NO se desbloquea nada. El desbloqueo es explícito y
    // solo lo pide la recompensa de cierre, con la exploración terminada.
  });

  return {
    isSilenced: () => silenced,
    emissions: () => emissions,
    stop: () => {
      stopped = true;
      try {
        unsubscribe();
      } catch {
        /* noop */
      }
    },
  };
}

/* ------------------------------- singleton -------------------------------- */

let controller: ClinicalSilenceController | null = null;

/** Arranca el vigilante con las dependencias reales. Devuelve la limpieza. */
export function installClinicalSilence(): () => void {
  controller?.stop();
  const created = createClinicalSilenceController({
    silence: luaClinicalSilence,
    idle: luaIdle,
    subscribeRecording: onRecordingSessionChange,
    isRecordingActive: isRecordingSessionActive,
  });
  controller = created;
  return () => {
    created.stop();
    if (controller === created) controller = null;
  };
}

/** ¿Se emitió el silencio clínico en esta sesión de app? (diagnóstico/tests) */
export const isLuaSilenced = (): boolean => controller?.isSilenced() ?? false;

/** Solo para tests. */
export function __resetClinicalSilenceForTests(): void {
  controller?.stop();
  controller = null;
}
