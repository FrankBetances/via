/* -------------------------------------------------------------------------- */
/*  Lúa — lo que una pantalla de VIA+ puede pedirle.                            */
/*                                                                             */
/*  Una sola cosa: la recompensa de cierre, y solo desde `ResultadosFinal`       */
/*  (§8.2 del plan de Valeria+). No hay hook de «expresión» general, y no por    */
/*  falta de ganas: cualquier expresión durante la batería es refuerzo durante   */
/*  la medición, y eso queda fuera de la v1.                                    */
/*                                                                             */
/*  El enlace es de un solo sentido. Ninguna decisión de VIA+ lee nada de Lúa:   */
/*  lo que el aparato notifica por `STATE` es diagnóstico y no entra en ningún   */
/*  informe. Esa asimetría es lo que sostiene que Lúa no sea parte del           */
/*  dispositivo, así que `useLuaDiagnostics()` existe para una pantalla de       */
/*  ajustes, no para un flujo de prueba.                                        */
/* -------------------------------------------------------------------------- */

import { useEffect, useRef, useState } from 'react';
import { isRecordingSessionActive } from '@/Audio';
import { getLuaAdapter, isLuaConnected } from './luaAdapter';
import { createRealClosingReward } from './closingReward';
import type { LuaState } from './luaWire';

/**
 * Celebra el cierre de la sesión mientras la pantalla esté montada, y deja al
 * aparato en reposo al salir. Sin aparato es un *no-op* completo: no devuelve
 * nada, no hay que comprobar nada y la pantalla no se entera.
 *
 * Se llama desde `ResultadosFinal` y de ningún otro sitio.
 */
export function useLuaClosingReward(enabled = true): void {
  const rewardRef = useRef<ReturnType<typeof createRealClosingReward> | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const reward = createRealClosingReward(isRecordingSessionActive);
    rewardRef.current = reward;
    reward.start();
    return () => {
      reward.stop();
      rewardRef.current = null;
    };
  }, [enabled]);
}

export interface LuaDiagnostics {
  connected: boolean;
  state: LuaState | null;
}

/**
 * Estado del aparato para una pantalla de diagnóstico o de ajustes. NO se usa en
 * ningún flujo de medida: si algún día una decisión de VIA+ dependiera de esto,
 * Lúa dejaría de ser un accesorio decorativo y habría que reabrir su
 * clasificación.
 */
export function useLuaDiagnostics(): LuaDiagnostics {
  const [connected, setConnected] = useState<boolean>(() => isLuaConnected());
  const [state, setState] = useState<LuaState | null>(null);

  useEffect(() => {
    const adapter = getLuaAdapter();
    if (!adapter) return;
    setConnected(adapter.isConnected());
    setState(adapter.state());
    const offLink = adapter.onLinkChange(next => {
      setConnected(next);
      if (!next) setState(null);
    });
    const offState = adapter.subscribeState(setState);
    return () => {
      offLink();
      offState();
    };
  }, []);

  return { connected, state };
}
