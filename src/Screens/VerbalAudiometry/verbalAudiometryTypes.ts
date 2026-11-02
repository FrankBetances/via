/* -------------------------------------------------------------------------- */
/*  Tipos del banco verbal. Sin imports.                                       */
/*                                                                             */
/*  `scripts/check-verbal-coverage.js` y `scripts/verbal-assets.js` compilan   */
/*  el banco con tsc suelto y lo ejecutan en Node. Un import fuera de esta     */
/*  carpeta mueve el rootDir y, si apunta a `@/`, ese tsc no lo resuelve.      */
/*  El motor NLG vive en `verbalAudiometryResult.ts`, que el gate no compila.  */
/* -------------------------------------------------------------------------- */

/** Franja de edad → lista de estímulos y modalidad de tarjeta. */
export type AgeBand = 'A' | 'B' | 'C' | 'D';

/** Modalidad de la tarjeta de selección (WordCard). */
export type CardModality = 'images' | 'mixed' | 'words';
