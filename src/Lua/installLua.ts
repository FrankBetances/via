/* -------------------------------------------------------------------------- */
/*  Lúa — instalación conjunta: adaptador BLE + silencio clínico.                */
/*                                                                             */
/*  Una sola llamada, para que no se pueda instalar el periférico OLVIDANDO la    */
/*  defensa en profundidad que lo acompaña. Si `installBleLua` fuera público a    */
/*  secas, el orden natural de una integración apresurada sería «primero que      */
/*  funcione la gata, luego el silencio», y ese estado intermedio no debe existir */
/*  ni un día.                                                                  */
/*                                                                             */
/*  POR QUÉ NO SE LLAMA TODAVÍA EN `App.tsx`                                    */
/*  Necesita un `BleManager` y hoy la app no crea ninguno: el adaptador del       */
/*  pulsioxímetro tiene el mismo `install…(manager)` y también está sin instalar   */
/*  esperando ese manager compartido. Crearlo cambia el arranque en iOS (el       */
/*  primer uso dispara el permiso de Bluetooth del sistema), así que es una       */
/*  decisión de la fase de hardware y se toma con la placa delante, de una vez    */
/*  para los dos periféricos. Hasta entonces todo `src/Lua/` es *no-op*.          */
/*                                                                             */
/*  Y no corre prisa por otra razón: el aparato solo anuncia 120 s tras pulsar su */
/*  botón físico, así que ni siquiera un escaneo permanente lo encontraría solo.  */
/* -------------------------------------------------------------------------- */

import { installBleLua } from './luaAdapter';
import { installClinicalSilence } from './clinicalSilence';

/**
 * Instala Lúa completa sobre un `BleManager` ya creado —el MISMO que usa el
 * pulsioxímetro— y devuelve la función de limpieza.
 *
 *   import { BleManager } from 'react-native-ble-plx';
 *   const manager = new BleManager();
 *   useEffect(() => installLua(manager), []);
 *
 * El vigilante del silencio arranca ANTES del adaptador: así, si al conectar ya
 * hubiera una captura de micrófono viva, la primera cosa que recibe el aparato es
 * el silencio clínico y no una concesión.
 */
export function installLua(manager: any): () => void {
  const stopSilence = installClinicalSilence();
  const stopAdapter = installBleLua(manager);
  return () => {
    stopAdapter();
    stopSilence();
  };
}
