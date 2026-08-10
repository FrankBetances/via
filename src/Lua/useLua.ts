/* -------------------------------------------------------------------------- */
/*  Lúa — hook de conveniencia para las pantallas.                              */
/*                                                                             */
/*  Lo que una pantalla puede hacer con Lúa es UNA cosa: expresar un estado     */
/*  afectivo. No puede leer nada que influya en una medida ni en un juicio      */
/*  clínico — el enlace es de escritura hacia el periférico, y lo que Lúa       */
/*  notifica (batería, estado de firmware) es diagnóstico que no entra en       */
/*  ningún informe. Ese asimetría es lo que sostiene §4, así que este hook      */
/*  expone `express` a todo el mundo y el estado del periférico solo a quien lo */
/*  pida explícitamente (`useLuaDiagnostics`), que es la pantalla de ajustes.   */
/*                                                                             */
/*  Referencia: docs/design/integracion-lua.md §4 y §6.                        */
/* -------------------------------------------------------------------------- */

import { useCallback, useEffect, useState } from 'react';
import { getLuaAdapter, isLuaConnected, luaExpress } from './luaAdapter';
import { LuaAffect, LuaStatus } from './luaProtocol';

export interface LuaControls {
  /** Expresa un estado afectivo. *No-op* si no hay periférico. */
  express: (affect: LuaAffect, intensity?: number) => void;
  /** ¿Hay periférico conectado? Para pintar un indicador, nada más. */
  connected: boolean;
}

/**
 * Controles de Lúa para una pantalla. `express` es estable y sincrónica: se
 * puede llamar desde un callback de UI sin `await` ni manejo de error, porque no
 * hay error que manejar (riesgo L-4).
 */
export function useLua(): LuaControls {
  const [connected, setConnected] = useState<boolean>(() => isLuaConnected());

  useEffect(() => {
    const adapter = getLuaAdapter();
    if (!adapter) {
      setConnected(false);
      return;
    }
    setConnected(adapter.isConnected());
    return adapter.onLinkChange(setConnected);
  }, []);

  const express = useCallback((affect: LuaAffect, intensity = 255) => {
    luaExpress(affect, intensity);
  }, []);

  return { express, connected };
}

/**
 * Expresa un estado afectivo mientras la pantalla esté montada, y devuelve a
 * `Dormida` al desmontarse. Es la forma correcta de que la gata «duerma» dentro
 * de un módulo clínico (riesgo L-3, distracción visual): la lista blanca de
 * rutas gobierna el ruido, pero dormir la expresión es responsabilidad de quien
 * entra en la pantalla.
 */
export function useLuaAffectWhileMounted(affect: LuaAffect, intensity = 255): void {
  useEffect(() => {
    luaExpress(affect, intensity);
    return () => luaExpress(LuaAffect.Dormida, 0);
  }, [affect, intensity]);
}

export interface LuaDiagnostics {
  connected: boolean;
  status: LuaStatus | null;
}

/**
 * Estado del periférico para una pantalla de diagnóstico o de ajustes. NO se usa
 * en ningún flujo de medida: si algún día una decisión de VIA+ dependiera de
 * esto, Lúa pasaría a ser accesorio de un producto sanitario y habría que
 * reabrir su clasificación.
 */
export function useLuaDiagnostics(): LuaDiagnostics {
  const [connected, setConnected] = useState<boolean>(() => isLuaConnected());
  const [status, setStatus] = useState<LuaStatus | null>(null);

  useEffect(() => {
    const adapter = getLuaAdapter();
    if (!adapter) return;
    setConnected(adapter.isConnected());
    const offLink = adapter.onLinkChange(next => {
      setConnected(next);
      if (!next) setStatus(null);
    });
    const offStatus = adapter.subscribeStatus(setStatus);
    return () => {
      offLink();
      offStatus();
    };
  }, []);

  return { connected, status };
}
