/* -------------------------------------------------------------------------- */
/*  Cierre de un módulo de la batería.                                         */
/*                                                                             */
/*  Al guardar una prueba, los módulos hacían `navigation.goBack()`: el        */
/*  profesional terminaba la exploración y aparecía otra vez en la selección   */
/*  de pruebas, sin ver nada de lo que acababa de registrar («realizo una      */
/*  prueba y me devuelven a la pantalla de ejercicios»). El resultado existía  */
/*  en la base de datos, pero no había ningún camino que llevara a él.         */
/*                                                                             */
/*  Ahora se aterriza en los resultados preliminares de la sesión, que ya      */
/*  incluyen la prueba recién guardada y enlazan tanto al informe detallado    */
/*  como de vuelta al hub.                                                      */
/*                                                                             */
/*  Se usa `replace` y no `navigate`: el módulo YA cerrado no debe quedarse en */
/*  la pila (volver atrás desde los resultados llevaría a un formulario ya     */
/*  guardado, invitando a registrarlo dos veces). Con `replace`, atrás lleva   */
/*  al hub, que es donde se continúa la batería.                               */
/* -------------------------------------------------------------------------- */

/**
 * Superficie mínima del `navigation` que necesita el cierre. Evita acoplar el
 * helper al genérico de `NativeStackScreenProps` de cada pantalla y permite
 * que los dobles de prueba declaren solo lo que usan.
 */
export interface ModuleExitNavigation {
  replace?: (name: 'ResultadosPreliminares') => void;
  navigate: (name: 'ResultadosPreliminares') => void;
}

/**
 * Cierra un módulo tras guardar su resultado y lleva a la vista de resultados
 * de la sesión.
 */
export function finishModule(navigation: ModuleExitNavigation): void {
  // `replace` solo existe en navigators de tipo pila; si no está (dobles de
  // prueba, otro navigator), se navega y no se rompe nada.
  if (typeof navigation.replace === 'function') {
    navigation.replace('ResultadosPreliminares');
    return;
  }
  navigation.navigate('ResultadosPreliminares');
}
