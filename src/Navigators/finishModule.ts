/* -------------------------------------------------------------------------- */
/*  Cierre de un módulo de la batería.                                         */
/*                                                                             */
/*  Historia, porque esta decisión ya cambió dos veces:                        */
/*  · Al principio los módulos hacían `navigation.goBack()` y el profesional   */
/*    volvía a la selección sin ver lo registrado.                             */
/*  · El 2/11/2026 pasó a aterrizar en Resultados preliminares.                */
/*  · El 18/11/2026, por decisión de Frank, vuelve al HUB tras cada prueba,    */
/*    con las pruebas ya hechas marcadas en la rejilla (`doneModules.ts`).     */
/*    Los resultados siguen a un toque: «Ver resultados preliminares».         */
/*                                                                             */
/*  Se usa `navigate` y no `push`: si el hub ya está en la pila (lo normal,    */
/*  se llega al módulo desde él), la pila vuelve hasta él y el módulo ya       */
/*  guardado sale de ella, así que atrás no lleva a un formulario cerrado.     */
/* -------------------------------------------------------------------------- */

/**
 * Superficie mínima del `navigation` que necesita el cierre. Evita acoplar el
 * helper al genérico de `NativeStackScreenProps` de cada pantalla y permite
 * que los dobles de prueba declaren solo lo que usan.
 */
export interface ModuleExitNavigation {
  navigate: (name: 'SeleccionEjercicios') => void;
}

/** Cierra un módulo tras guardar su resultado y vuelve al hub de la batería. */
export function finishModule(navigation: ModuleExitNavigation): void {
  navigation.navigate('SeleccionEjercicios');
}
