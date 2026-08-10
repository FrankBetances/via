/* -------------------------------------------------------------------------- */
/*  Lúa — lectura de la ruta activa del navegador.                              */
/*                                                                             */
/*  La lista blanca de §3 necesita saber en qué pantalla estamos, y esa es la    */
/*  única cosa que Lúa lee de la app. Se resuelve leyendo el estado de React     */
/*  Navigation en vez de que cada pantalla se anuncie: una pantalla nueva no     */
/*  tiene que acordarse de nada, y como la lista blanca es por INCLUSIÓN, nace   */
/*  en silencio.                                                                */
/*                                                                             */
/*  Referencia: docs/design/integracion-lua.md §3 y §6.                        */
/* -------------------------------------------------------------------------- */

import { setActiveLuaRoute } from './noisePermit';

interface NavigationStateLike {
  index?: number;
  routes?: { name: string; state?: NavigationStateLike }[];
}

/**
 * Nombre de la ruta activa más PROFUNDA del árbol de navegación. Se baja hasta
 * la hoja porque un módulo clínico anidado dentro de otro navigator no puede
 * quedar tapado por el nombre del contenedor: lo que decide es la pantalla que
 * el niño tiene delante.
 */
export function activeRouteName(state: NavigationStateLike | null | undefined): string | null {
  let node = state;
  let name: string | null = null;
  // El guardián de profundidad evita un bucle infinito si algún día llega un
  // estado con un ciclo; 32 niveles es holgadamente más de lo que la app monta.
  for (let depth = 0; depth < 32; depth++) {
    const routes = node?.routes;
    if (!routes || routes.length === 0) break;
    const index = typeof node?.index === 'number' ? node.index : routes.length - 1;
    const route = routes[Math.max(0, Math.min(routes.length - 1, index))];
    if (!route) break;
    name = route.name;
    if (!route.state) break;
    node = route.state;
  }
  return name;
}

/**
 * Manejador para `onStateChange`/`onReady` de `NavigationContainer`. Es *no-op*
 * mientras Lúa no esté instalada, salvo por recordar la ruta.
 */
export function handleNavigationStateChange(state: NavigationStateLike | null | undefined): void {
  setActiveLuaRoute(activeRouteName(state));
}
