/* -------------------------------------------------------------------------- */
/*  Estímulos del módulo de prosodia (contenido enumerable · lógica PURA).      */
/*                                                                            */
/*  MÓDULO PURO (P7): no importa React Native, UI ni la entidad de TypeORM.    */
/*  Tiene que poder compilarse y ejecutarse desde un script de Node, porque    */
/*  `viaVoiceConsignas` lo enumera para meter las consignas en el pipeline de  */
/*  síntesis neuronal. Si deja de ser puro, el exportador del corpus falla en  */
/*  build-time — que es donde debe fallar, y no en la app.                     */
/*                                                                            */
/*  DERIVA CERO (P3): la pantalla pinta la lámina y locuta la consigna DESDE   */
/*  esta tabla, y el corpus de voz se deriva de ella. Corpus y pantalla no     */
/*  pueden divergir: si una consigna cambia aquí, cambia su id de voz y el     */
/*  recorte cae limpiamente a la voz del sistema hasta que se regenere.        */
/*                                                                            */
/*  Los tipos `ProsodyTask` y `ProsodyAgeBand` viven AQUÍ y no en el modelo,   */
/*  por la misma razón que `SodaCode` vive en `articulationResult` y no en     */
/*  `ArticulationTest`: la entidad los importa como tipo (import que se borra  */
/*  al compilar) y así la cadena de contenido no arrastra TypeORM.             */
/* -------------------------------------------------------------------------- */

/** Tarea de habla con la que se obtiene la muestra (decisión B0.1). */
export type ProsodyTask = 'narracion-lamina' | 'recuento-historia' | 'lectura';

/** Banda de edad. Determina la lámina y la consigna. */
export type ProsodyAgeBand = 'prelector' | 'lector';

/** Texto de una consigna por lengua (la base `es` es obligatoria). */
export interface ProsodyConsignaText {
  es: string;
  'es-DO'?: string;
  'es-419'?: string;
  gl?: string;
  eu?: string;
  ca?: string;
  en?: string;
}

/** Un elemento describible de la lámina, con su etiqueta de trazabilidad. */
export interface ProsodyStimulusElement {
  /** Clave estable del elemento (documenta qué contiene la lámina). */
  key: string;
  /** Qué representa, para la documentación clínica y las pruebas. */
  label: string;
}

export interface ProsodyStimulus {
  /** Id estable y VERSIONADO. Cambiar la lámina obliga a subir la versión: las
   *  tomas guardadas apuntan a un estímulo concreto y deben seguir siendo
   *  interpretables. */
  id: string;
  task: ProsodyTask;
  ageBand: ProsodyAgeBand;
  title: string;
  /** Consigna hablada, locutada por `@/Voice` (no la lee el explorador). */
  consigna: ProsodyConsignaText;
  /** Nº de viñetas de la lámina (1 = escena única; >1 = secuencia). */
  panels: number;
  /** Elementos describibles, que es lo que sostiene la duración de la muestra. */
  elements: ProsodyStimulusElement[];
}

/* -------------------------------------------------------------------------- */
/*  POR QUÉ ESTAS DOS LÁMINAS                                                  */
/*                                                                            */
/*  La muestra objetivo son 30–60 s de habla. Una lámina pobre no los da: el   */
/*  niño dice «un parque» y calla. De ahí que cada lámina declare sus          */
/*  elementos describibles y que las dos superen la decena — hay de qué        */
/*  hablar sin que el explorador tenga que preguntar (y preguntar metería su   */
/*  voz en la medida).                                                        */
/*                                                                            */
/*  La lámina del lector es SECUENCIADA (tres viñetas) en vez de una escena    */
/*  única: a partir de los siete años la narración libre sobre escena estática */
/*  se agota en pocas frases, mientras que una secuencia obliga a encadenar    */
/*  con conectores y produce el contorno entonativo de cierre que el módulo    */
/*  mide.                                                                     */
/* -------------------------------------------------------------------------- */

export const PROSODY_STIMULI: Record<ProsodyAgeBand, ProsodyStimulus> = {
  prelector: {
    id: 'lamina-parque-v1',
    task: 'narracion-lamina',
    ageBand: 'prelector',
    title: 'Un día en el parque',
    consigna: {
      es: 'Mira bien este dibujo. Cuéntame todo lo que ves y todo lo que está pasando.',
      'es-DO': 'Mira bien este dibujo. Cuéntame todo lo que ves y todo lo que está pasando.',
      'es-419': 'Mira bien este dibujo. Cuéntame todo lo que ves y todo lo que está pasando.',
      gl: 'Mira ben este debuxo. Cóntame todo o que ves e todo o que está a pasar.',
      eu: 'Begiratu ondo marrazki honi. Kontatu ikusten duzun guztia eta gertatzen ari dena.',
      ca: 'Mira bé aquest dibuix. Explica’m tot el que veus i tot el que està passant.',
      en: 'Look closely at this picture. Tell me everything you see and everything that is happening.',
    },
    panels: 1,
    elements: [
      { key: 'sol', label: 'sol y nubes' },
      { key: 'arbol', label: 'árbol grande' },
      { key: 'nina-pelota', label: 'niña jugando a la pelota' },
      { key: 'nino-columpio', label: 'niño en el columpio' },
      { key: 'perro', label: 'perro corriendo' },
      { key: 'banco', label: 'banco con una persona sentada' },
      { key: 'pajaros', label: 'pájaros volando' },
      { key: 'cometa', label: 'cometa en el aire' },
      { key: 'flores', label: 'flores en el césped' },
      { key: 'pelota', label: 'pelota' },
    ],
  },
  lector: {
    /* Lámina SECUENCIADA. La tarea sigue siendo narración a partir de imagen,
     * no `recuento-historia`: un recuento exige una historia fuente que el niño
     * escuche antes, y esa locución todavía no existe en el corpus. Declararlo
     * como recuento sin la historia sería etiquetar la toma con una tarea que
     * no se ha realizado, y la tarea es justamente lo que hace comparables dos
     * tomas entre sí. */
    id: 'lamina-excursion-v1',
    task: 'narracion-lamina',
    ageBand: 'lector',
    title: 'La excursión',
    consigna: {
      es: 'Mira las tres viñetas por orden. Cuéntame la historia completa, desde el principio hasta el final.',
      'es-DO': 'Mira las tres viñetas por orden. Cuéntame la historia completa, desde el principio hasta el final.',
      'es-419': 'Mira las tres viñetas por orden. Cuéntame la historia completa, desde el principio hasta el final.',
      gl: 'Mira as tres viñetas por orde. Cóntame a historia completa, desde o principio ata o final.',
      eu: 'Begiratu hiru binetei hurrenez hurren. Kontatu istorio osoa, hasieratik amaieraraino.',
      ca: 'Mira les tres vinyetes per ordre. Explica’m la història completa, des del principi fins al final.',
      en: 'Look at the three panels in order. Tell me the full story, from beginning to end.',
    },
    panels: 3,
    elements: [
      { key: 'autobus', label: 'viñeta 1 · autobús y niños con mochilas' },
      { key: 'salida', label: 'viñeta 1 · salida del colegio' },
      { key: 'montana', label: 'viñeta 2 · montaña y sendero' },
      { key: 'merienda', label: 'viñeta 2 · merienda sobre la hierba' },
      { key: 'mapa', label: 'viñeta 2 · niño mirando un mapa' },
      { key: 'lluvia', label: 'viñeta 3 · empieza a llover' },
      { key: 'paraguas', label: 'viñeta 3 · paraguas abierto' },
      { key: 'vuelta', label: 'viñeta 3 · vuelta corriendo al autobús' },
    ],
  },
};

/** Estímulo de una banda de edad. */
export const prosodyStimulusFor = (ageBand: ProsodyAgeBand): ProsodyStimulus =>
  PROSODY_STIMULI[ageBand];

/** Estímulo por su id (para releer una toma guardada). `null` si no existe. */
export const prosodyStimulusById = (id: string): ProsodyStimulus | null =>
  Object.values(PROSODY_STIMULI).find(s => s.id === id) ?? null;

/** Consigna hablada de una banda de edad, por lengua (DERIVA CERO). */
export const prosodyConsignaByLang = (ageBand: ProsodyAgeBand): ProsodyConsignaText =>
  PROSODY_STIMULI[ageBand].consigna;

/** Todas las bandas, en orden de presentación. */
export const PROSODY_AGE_BANDS: ProsodyAgeBand[] = ['prelector', 'lector'];

/** Etiqueta de la banda para pantalla e informe. */
export const PROSODY_AGE_BAND_LABEL: Record<ProsodyAgeBand, string> = {
  prelector: 'Prelector (3–6 a)',
  lector: 'Lector (7–12 a)',
};

/** Etiqueta de la tarea para pantalla e informe. */
export const PROSODY_TASK_LABEL: Record<ProsodyTask, string> = {
  'narracion-lamina': 'Narración sobre lámina',
  'recuento-historia': 'Recuento de historia',
  lectura: 'Lectura en voz alta',
};
