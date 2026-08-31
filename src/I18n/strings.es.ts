/* -------------------------------------------------------------------------- */
/*  VIA+ · Catálogo de cadenas de INTERFAZ · castellano                         */
/*                                                                             */
/*  PORTE de `src/i18n/strings.es.ts` de Valeria+ (regla 1). Este fichero es la */
/*  FUENTE DE VERDAD del catálogo: su forma define el tipo `UiStrings`, y los   */
/*  seis catálogos restantes se declaran CON ese tipo. Consecuencia buscada: si */
/*  aquí se añade una clave y allí no, `npx tsc --noEmit` falla. Una cadena que */
/*  falta tiene que romper el build, no aparecer en blanco en la tablet de una  */
/*  logopeda.                                                                   */
/*                                                                             */
/*  Convenciones (las de Valeria+, sin cambios):                               */
/*   · Un namespace por pantalla, más `common` para lo compartido.             */
/*   · Texto con datos dentro → FUNCIÓN tipada, nunca concatenación en la      */
/*     pantalla: el orden de las palabras cambia entre idiomas.                */
/*   · Las cadenas LOCUTADAS no viven aquí. Van en la capa de voz              */
/*     (`src/Voice/viaVoiceConsignas.ts` y los bancos por variedad) porque el  */
/*     corpus las enumera para pregenerar su audio; mezclarlas rompería esa    */
/*     tubería y el gate `export-voice-corpus.js` dejaría de cuadrar.          */
/*   · El acceso es por PROPIEDAD (`t.credits.navTitle`), no por clave de       */
/*     texto: una clave mal escrita la caza el compilador, no el QA.           */
/* -------------------------------------------------------------------------- */

export const ES = {
  common: {
    continue: 'Continuar',
    back: 'Atrás',
    cancel: 'Cancelar',
    save: 'Guardar',
    close: 'Cerrar',
    accept: 'Aceptar',
    loading: 'Cargando…',
    retry: 'Reintentar',
    next: 'Siguiente',
    finish: 'Finalizar',
    yes: 'Sí',
    no: 'No',
    notAvailable: 'No disponible',
  },

  /* Selector de idioma de la interfaz (cabecera de Créditos y tarjeta de
   * voces). Vive aquí y no en el componente para que el propio selector se
   * lea en el idioma activo. */
  langPicker: {
    title: 'Idioma de la aplicación',
    subtitle: 'La elección cambia los textos y las locuciones de toda la app',
    navA11y: (label: string) => `Idioma actual: ${label}. Toca para cambiar de idioma.`,
    openA11y: 'Cambiar el idioma de la aplicación',
    change: (code: string) => `Cambiar idioma (${code})`,
    closeA11y: 'Cerrar el selector de idioma',
    optionA11y: (name: string, hint: string) => `${name}: ${hint}`,
    /* Pie de cada opción: qué aporta esa variedad, no su estado de revisión. */
    hintEs: 'Idioma base de la batería clínica',
    hintGl: 'Proxecto Nós · voz Celtia · aval ACOPROS',
    hintEu: 'HiTZ · AhoTTS · voz Maider · aval Ulertuz',
    hintCa: 'Veu Piper · UPC ona',
    hintEs419: 'Variante neutra latinoamericana · voz Piper',
    hintEsDO: 'Quisqueya Habla · banco y locuciones propios · FONDOCYT',
    hintEn: 'American English · Piper Lessac',
  },

  credits: {
    navBackA11y: 'Volver a la pantalla de bienvenida',
    navTitle: 'Créditos y Avales',
    samdBadge: 'Clase IIa',
    emblemFootnote:
      'Arquitectura integrada de valoración audiológica, fonética y deglutoria',
    authorBadge: 'AUTORÍA Y DIRECCIÓN CLÍNICA',
    authorRole: 'Otorrinolaringólogo e investigador principal',
    partnersTitle: 'ALIANZAS Y COLABORADORES',
    quisqueyaDesc: 'Proyecto FONDOCYT · adaptación lingüística dominicana',
    acoprosDesc: 'Asociación de Colaboración y Promoción del Sordo',
    earlifyDesc: 'Tecnología e ingeniería clínica sanitaria',
    voicesTitle: 'VOCES Y LOCALIZACIÓN',
    qualityTitle: 'CALIDAD Y REGULACIÓN SANITARIA',
    sealTitle: 'Sello de Calidad ITEMAS 2024',
    /* El rediseño proponía «Innovación sanitaria avalada por el ISCIII». Es
     * una afirmación sobre una acreditación, más fuerte que la actual, y
     * cambiarla no es efecto colateral de un cambio de estilo: se mantiene la
     * que ya estaba hasta que Frank confirme los términos del sello. */
    sealSubtitle: 'Innovación tecnológica en salud',
    chipSamd: 'SaMD Clase IIa',
    chipLocation: 'Lugo, Galicia',
    dockButton: 'Comenzar Selección Profesional',

    /* Créditos de voz y localización, uno por variedad. Se listan aquí —y no
     * como datos sueltos en la pantalla— porque son texto que se lee y por
     * tanto se traduce. La ATRIBUCIÓN de los motores es obligatoria: las
     * voces Piper de `ca` y `es-419` son CC BY-SA 4.0 y CC BY 4.0, y las dos
     * exigen citar al autor (ver `tools/nos/voices.json`). */
    langEs: 'Idioma base de la batería de evaluación clínica',
    langGl: 'Voz neuronal Celtia, banco aprobado por ACOPROS',
    langEu: 'Voz neuronal Maider, banco aprobado por Ulertuz',
    langCa: 'Voz neuronal Piper · UPC ona (CC BY-SA 4.0)',
    langEs419: 'Variante neutra latinoamericana · Piper (CC BY 4.0)',
    langEsDO: 'Variante dominicana: banco y locuciones propios (FONDOCYT)',
    langEn: 'Interfaz y voz en inglés americano · Piper Lessac',
    enginePiper: 'Voces neuronales VITS para castellano, catalán, inglés y variantes',
    engineEspeak: 'Síntesis de respaldo offline sin pesos neuronales',
  },

  /* Componentes compartidos entre pantallas: cabecera, firma, control de
   * tamaño de letra, mascota, tarjetas del hub, audiograma y tren. */
  components: {
    volver: 'Volver',
    borrarFirma: 'Borrar firma',
    firmeAqui: 'Firme aquí con el dedo o un lápiz táctil',
    tamanoLetra: 'Tamaño de letra',
    lua: 'Lúa ·',
    respiracionGuiada: 'Respiración Guiada',
    esp32Ble: 'ESP32 BLE',
    nivel: 'Nivel',
    /* El plural lo forma CADA lengua: la pantalla pasa el número, no la «s».
     * Antes llegaba ya resuelto (`count === 1 ? '' : 's'`), que es castellano
     * incrustado en el sitio donde no se puede traducir. */
    filtroPrueba: (a: string | number, b: string | number) =>
      `Filtro ${a}, ${b} ${Number(b) === 1 ? 'prueba' : 'pruebas'}`,
    duracionEdades: (a: string | number, b: string | number, c: string | number, d: string | number) =>
      `${a}. ${b} Duración ${c}. Edades ${d}.`,
    calibracionOk: 'Calibración OK',
    normal: 'NORMAL',
    leve: 'LEVE',
    moderada: 'MODERADA',
    severa: 'SEVERA',
    frecuenciaHz: 'Frecuencia (Hz)',
    genial: '¡GENIAL! ⭐',
  },
} as const;

/**
 * Forma del catálogo. Los demás idiomas se declaran `const XX: UiStrings`, de
 * modo que el compilador exige TODAS las claves con la MISMA firma: una
 * función con dos parámetros aquí no puede ser una cadena suelta allí.
 */
export type UiStrings = {
  [NS in keyof typeof ES]: {
    [K in keyof (typeof ES)[NS]]: (typeof ES)[NS][K] extends (...args: infer A) => string
      ? (...args: A) => string
      : string;
  };
};
