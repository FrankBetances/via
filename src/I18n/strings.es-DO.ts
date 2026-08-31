/* -------------------------------------------------------------------------- */
/*  VIA+ · Catálogo de cadenas de INTERFAZ · Español dominicano (es-DO)         */
/*  Quisqueya Habla · FONDOCYT                                                  */
/*                                                                             */
/*  DELTA sobre el castellano peninsular, por el mismo motivo que `es-419`      */
/*  (ver su cabecera): es la misma lengua, y duplicar ~700 cadenas idénticas    */
/*  solo garantiza que las copias se separen.                                   */
/*                                                                             */
/*  OJO con el alcance. Lo que Quisqueya Habla adapta con criterio clínico es   */
/*  el BANCO DE ESTÍMULOS y las LOCUCIONES —eso vive en                         */
/*  `verbalAudiometryLists.es-DO` y en el corpus de voz, no aquí—. La interfaz  */
/*  que lee el profesional es la misma prosa clínica, con el léxico de trato    */
/*  local. Meter aquí variantes del habla infantil dominicana sería confundir   */
/*  los dos ejes.                                                               */
/* -------------------------------------------------------------------------- */
import { ES, UiStrings } from './strings.es';

export const ES_DO: UiStrings = {
  ...ES,

  common: {
    ...ES.common,
    back: 'Regresar',
    retry: 'Volver a intentar',
  },

  langPicker: {
    ...ES.langPicker,
    subtitle: 'La selección cambia los textos y las locuciones de toda la app',
  },

  credits: {
    ...ES.credits,
    earlifyDesc: 'Tecnología e ingeniería clínica en salud',
    /* La variedad dominicana es la propia: en su catálogo se nombra sin el
     * paréntesis explicativo que necesita el resto. */
    langEsDO: 'Variedad dominicana: banco y locuciones propios (FONDOCYT)',
  },
};
