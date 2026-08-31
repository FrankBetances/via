/* -------------------------------------------------------------------------- */
/*  VIA+ · Catálogo de cadenas de INTERFAZ · Español latinoamericano (es-419)   */
/*                                                                             */
/*  Es un DELTA sobre el castellano peninsular, no un catálogo aparte, porque   */
/*  es LA MISMA LENGUA: escribirlo entero duplicaría ~700 cadenas idénticas y   */
/*  garantizaría que las dos copias se separen con el tiempo. Se parte de `ES`  */
/*  y solo se sobrescribe lo que de verdad cambia de variedad.                  */
/*                                                                             */
/*  El tipo sigue siendo `UiStrings`, así que la cobertura está igual de        */
/*  garantizada por el compilador: el spread aporta todas las claves y una      */
/*  clave nueva en `strings.es.ts` llega aquí sola, en castellano peninsular,   */
/*  hasta que alguien decida que necesita variante.                             */
/*                                                                             */
/*  Criterio de qué se cambia: léxico que un profesional latinoamericano no     */
/*  usa («ordenador», «móvil», «vale») y el tratamiento. Lo que se dice igual   */
/*  a los dos lados del Atlántico NO se toca: inventar diferencias donde no las */
/*  hay es tan malo como no marcar las que existen.                             */
/* -------------------------------------------------------------------------- */
import { ES, UiStrings } from './strings.es';

export const ES_419: UiStrings = {
  ...ES,

  common: {
    ...ES.common,
    back: 'Regresar',
    accept: 'Aceptar',
    retry: 'Volver a intentar',
  },

  langPicker: {
    ...ES.langPicker,
    subtitle: 'La selección cambia los textos y las locuciones de toda la app',
    navA11y: (label: string) => `Idioma actual: ${label}. Toca para cambiar de idioma.`,
  },

  credits: {
    ...ES.credits,
    authorRole: 'Otorrinolaringólogo e investigador principal',
    earlifyDesc: 'Tecnología e ingeniería clínica en salud',
    qualityTitle: 'CALIDAD Y REGULACIÓN SANITARIA',
  },

  components: {
    ...ES.components,
    volver: 'Regresar',
    tamanoLetra: 'Tamaño de letra',
    firmeAqui: 'Firme aquí con el dedo o con un lápiz táctil',
  },
};
