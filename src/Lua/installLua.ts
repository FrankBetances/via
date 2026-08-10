/* -------------------------------------------------------------------------- */
/*  Lúa — instalación completa (adaptador BLE + permiso de ruido).              */
/*                                                                             */
/*  Una sola llamada, para que no se pueda instalar el periférico OLVIDANDO el  */
/*  control de riesgo que lo acompaña. Si `installBleLua` fuera público a secas, */
/*  el orden natural de una integración apresurada sería «primero que funcione  */
/*  la gata, luego el permiso», y ese estado intermedio es precisamente el que  */
/*  no debe existir ni un día.                                                  */
/*                                                                             */
/*  POR QUÉ NO SE LLAMA TODAVÍA EN `App.tsx`                                    */
/*  Necesita un `BleManager` y hoy la app no crea ninguno: el adaptador del      */
/*  pulsioxímetro tiene el mismo `install…(manager)` y también está sin instalar */
/*  esperando ese manager compartido. Crear el manager cambia el comportamiento  */
/*  de arranque (en iOS, el primer uso dispara el permiso de Bluetooth del       */
/*  sistema), así que es una decisión de la fase de hardware —no un detalle de   */
/*  cableado— y se toma con la placa delante. Hasta entonces, todo `src/Lua/` es */
/*  *no-op* y lo único vivo es la lista blanca de rutas, que ya se alimenta      */
/*  desde el navegador.                                                         */
/*                                                                             */
/*  Referencia: docs/design/integracion-lua.md §6.                             */
/* -------------------------------------------------------------------------- */

import { installBleLua } from './luaAdapter';
import { installNoisePermit } from './noisePermit';

/**
 * Instala Lúa completa sobre un `BleManager` ya creado —el MISMO que usa el
 * pulsioxímetro— y devuelve la función de limpieza.
 *
 *   import { BleManager } from 'react-native-ble-plx';
 *   const manager = new BleManager();
 *   useEffect(() => installLua(manager), []);
 *
 * El permiso se arranca ANTES del adaptador: mientras no haya capacidades
 * leídas, `luaCanMakeNoise(null)` es `false` y no se concede nada, así que no
 * hay ventana en la que el periférico esté conectado y el renovador todavía no.
 */
export function installLua(manager: any): () => void {
  const stopPermit = installNoisePermit();
  const stopAdapter = installBleLua(manager);
  return () => {
    stopAdapter();
    stopPermit();
  };
}
