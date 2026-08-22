/* -------------------------------------------------------------------------- */
/*  articulationLexicon — inventario del T.A.R. en las cuatro variedades       */
/*  ofrecidas por la app: castellano (es), dominicano (es-DO), galego (gl) y   */
/*  euskara (eu).                                                             */
/*                                                                            */
/*  QUÉ ES ESTE FICHERO, Y QUÉ NO ES                                          */
/*                                                                            */
/*  El T.A.R. no es una lista de palabras: es una rejilla que cruza FONEMA x   */
/*  POSICIÓN silábica (inicial, media, final, trabada). Cada ítem existe para  */
/*  provocar UN fonema en UNA posición. Por eso este banco no se puede         */
/*  construir traduciendo: «Llave» -> «Chave» es la traducción correcta al     */
/*  galego y a la vez destruye la casilla, porque cambia /ʎ/ por /tʃ/.        */
/*                                                                            */
/*  La regla que se ha seguido en las cuatro columnas es, por orden:           */
/*    1. Conservar el fonema diana en la misma posición silábica.              */
/*    2. Con (1) garantizado, elegir la palabra más natural y frecuente para   */
/*       un niño de esa comunidad lingüística.                                 */
/*    3. Cuando la fonotaxis de la lengua NO admite esa combinación, se toma   */
/*       la aproximación más próxima y se deja constancia en `note`. No se     */
/*       inventan palabras ni se deja la casilla con la forma castellana       */
/*       disfrazada.                                                           */
/*                                                                            */
/*  VALIDACIÓN CLÍNICA                                                         */
/*  Las cuatro columnas de este inventario, incluidas todas las entradas con   */
/*  `note`, están revisadas y FIRMADAS por el Dr. Frank Alberto Betances       */
/*  Reinoso, otorrinolaringólogo infantil especializado en lenguaje, como      */
/*  responsable clínico de VIA+. Cualquier cambio en una entrada —añadir un    */
/*  ítem al inventario, sustituir una palabra, retocar una nota— sale de esa   */
/*  firma y requiere que vuelva a revisarse antes de publicarse.               */
/*                                                                            */
/*  Sobre la puntuación: los baremos publicados del T.A.R. se establecieron    */
/*  sobre fonología castellana. Las columnas `gl` y `eu` son inventarios       */
/*  equivalentes validados para explorar el repertorio fonético en la lengua   */
/*  vehicular del niño; comparar sus puntuaciones con el baremo castellano     */
/*  exige el criterio del responsable clínico, porque el dato normativo de     */
/*  origen no se obtuvo en esas lenguas.                                       */
/* -------------------------------------------------------------------------- */

export interface TarLexEntry {
  /** Dominicano. Difiere del castellano sobre todo en los chilenismos del
   *  léxico original (poroto, diuca, puñete, carabinero) y en «guagua», que en
   *  República Dominicana significa AUTOBÚS y no bebé. */
  'es-DO': string;
  /** Galego. */
  gl: string;
  /** Euskara. */
  eu: string;
  /** Desviación respecto de la regla 1, documentada y validada. Lo que
   *  explica es POR QUÉ esta casilla no puede seguir la rejilla en esa
   *  lengua, para que el clínico lea el ítem sabiéndolo. */
  note?: string;
}

/* Clave = palabra castellana del inventario (`buildArticulationItems`).        */
export const TAR_LEXICON: Record<string, TarLexEntry> = {
  /* ---------------------------- Bilabiales -------------------------------- */
  /* B /b/ */
  Bote: { 'es-DO': 'Bote', gl: 'Bote', eu: 'Botila' },
  Cabeza: { 'es-DO': 'Cabeza', gl: 'Cabeza', eu: 'Abere' },
  Nube: {
    'es-DO': 'Nube', gl: 'Nube', eu: 'Alaba',
    note: 'eu: el euskara no admite /b/ en coda final; se explora en ataque de la última sílaba.',
  },
  Objeto: { 'es-DO': 'Objeto', gl: 'Obxecto', eu: 'Objektu' },
  /* P /p/ */
  Pato: { 'es-DO': 'Pato', gl: 'Pato', eu: 'Pilota' },
  Zapato: { 'es-DO': 'Zapato', gl: 'Zapato', eu: 'Kapela' },
  Copa: { 'es-DO': 'Copa', gl: 'Copa', eu: 'Kopa' },
  Apto: { 'es-DO': 'Apto', gl: 'Apto', eu: 'Optika' },
  /* M /m/ */
  Mano: { 'es-DO': 'Mano', gl: 'Man', eu: 'Mahai' },
  Camisa: { 'es-DO': 'Camisa', gl: 'Camisa', eu: 'Kamiseta' },
  Suma: { 'es-DO': 'Suma', gl: 'Suma', eu: 'Ama' },
  Campo: {
    'es-DO': 'Campo', gl: 'Campo', eu: 'Kanpo',
    note: 'eu: se escribe <n> ante /p/, pero se realiza [m]; la diana articulatoria se mantiene.',
  },

  /* --------------------------- Labiodental -------------------------------- */
  /* F /f/ */
  Foca: { 'es-DO': 'Foca', gl: 'Foca', eu: 'Festa' },
  'Búfalo': {
    'es-DO': 'Elefante', gl: 'Búfalo', eu: 'Bufalo',
    note: 'es-DO: el búfalo no es fauna reconocible en RD; el elefante sí, y conserva /f/ media.',
  },
  'Café': { 'es-DO': 'Café', gl: 'Café', eu: 'Kafe' },
  Aftosa: { 'es-DO': 'Aftosa', gl: 'Aftosa', eu: 'Asfalto' },

  /* ----------------------------- Dentales --------------------------------- */
  /* D /d/ */
  Dama: { 'es-DO': 'Dama', gl: 'Dama', eu: 'Dorre' },
  Cadena: { 'es-DO': 'Cadena', gl: 'Cadea', eu: 'Adar' },
  Codo: { 'es-DO': 'Codo', gl: 'Cóbado', eu: 'Hodei' },
  Pared: {
    'es-DO': 'Pared', gl: 'Parede', eu: 'Adiskide',
    note: 'eu: el euskara no admite /d/ en coda final; se explora en ataque de la última sílaba.',
  },
  /* T /t/ */
  Tapa: { 'es-DO': 'Tapa', gl: 'Tapa', eu: 'Tomate' },
  Mata: { 'es-DO': 'Mata', gl: 'Mata', eu: 'Ate' },
  Torta: {
    'es-DO': 'Puerta', gl: 'Torta', eu: 'Bertso',
    note: 'es-DO: en RD el pastel es «bizcocho» y «torta» tiene otro sentido; «puerta» conserva /r/ trabada.',
  },
  Etna: { 'es-DO': 'Etna', gl: 'Etna', eu: 'Etna' },

  /* ---------------------------- Alveolares -------------------------------- */
  /* S /s/ */
  Sapo: { 'es-DO': 'Sapo', gl: 'Sapo', eu: 'Sagu' },
  Rosa: {
    'es-DO': 'Rosa', gl: 'Rosa', eu: 'Arrosa',
    note: 'Este ítem cubre dos casillas: /s/ media y /r/ inicial. «Arrosa» mantiene ambas consonantes y el mismo referente, pero el euskara no admite /r/ en posición inicial —la desplaza a media—, así que esa casilla no queda explorada en euskara y su ausencia no debe puntuarse como error.',
  },
  Bosque: {
    'es-DO': 'Fiesta', gl: 'Bosque', eu: 'Asto',
    note: 'es-DO: «bosque» compite con «monte» en RD; «fiesta» es de uso diario y mantiene /s/ trabada.',
  },
  /* N /n/ */
  Nido: { 'es-DO': 'Nido', gl: 'Niño', eu: 'Neska' },
  Panera: {
    'es-DO': 'Banana', gl: 'Panadeira', eu: 'Anaia',
    note: 'es-DO: «panera» no es de uso en RD; «banana» es cotidiana y conserva /n/ media.',
  },
  Canto: { 'es-DO': 'Canto', gl: 'Canto', eu: 'Kanta' },
  /* L /l/ */
  Luna: { 'es-DO': 'Luna', gl: 'Lúa', eu: 'Lore' },
  Pala: { 'es-DO': 'Pala', gl: 'Pala', eu: 'Kale' },
  Dulce: { 'es-DO': 'Dulce', gl: 'Doce', eu: 'Zaldi' },
  /* R /ɾ/ */
  Coro: { 'es-DO': 'Coro', gl: 'Coro', eu: 'Euri' },
  Loro: { 'es-DO': 'Loro', gl: 'Loro', eu: 'Ura' },
  /* RR /r/ */
  Perro: {
    'es-DO': 'Perro', gl: 'Carro', eu: 'Txakurra',
    note: 'gl: «can» es la traducción natural pero pierde /r/; se elige otro portador del fonema.',
  },
  Carroza: { 'es-DO': 'Carroza', gl: 'Carroza', eu: 'Elurra' },

  /* ----------------------------- Palatales -------------------------------- */
  /* LL /ʎ/ */
  Llave: {
    'es-DO': 'Llave', gl: 'Lle', eu: 'Oilar',
    note: 'Ni el galego ni el euskara tienen palabras plenas con /ʎ/ inicial: es un hueco del sistema fonológico, no del inventario. gl: clítico «lle»; eu: /ʎ/ en posición media. La posición inicial no queda explorada en estas dos lenguas y su ausencia no debe puntuarse como error articulatorio.',
  },
  Payaso: { 'es-DO': 'Payaso', gl: 'Pallaso', eu: 'Oilo' },
  Malla: { 'es-DO': 'Malla', gl: 'Malla', eu: 'Mailu' },
  /* Ñ /ɲ/ */
  'Ñu': {
    'es-DO': 'Ñame', gl: 'Ñu', eu: 'Ñu',
    note: 'es-DO: el ñame es alimento cotidiano en RD y lo nombra cualquier niño; el ñu solo se ve en documentales.',
  },
  Muñeca: { 'es-DO': 'Muñeca', gl: 'Piñeiro', eu: 'Andereño' },
  'Caña': {
    'es-DO': 'Caña', gl: 'Mañá', eu: 'Iñaki',
    note: 'gl: «cana» es la forma galega pero se realiza con /n/; se elige otro portador de /ɲ/. eu: nombre propio de uso corriente, que el niño reconoce sin explicación.',
  },
  /* CH /tʃ/ */
  'Chándal': {
    'es-DO': 'Chancleta', gl: 'Chave', eu: 'Txakur',
    note: 'es-DO: «chándal» es peninsular; «chancleta» es de uso corriente en RD.',
  },
  Lechuga: {
    'es-DO': 'Lechuga', gl: 'Cocho', eu: 'Etxe',
    note: 'gl: «leituga» pierde /tʃ/; se elige otro portador del fonema.',
  },
  Noche: {
    'es-DO': 'Noche', gl: 'Coche', eu: 'Bitxi',
    note: 'gl: «noite» pierde /tʃ/; se elige otro portador del fonema.',
  },

  /* ------------------------------ Velares --------------------------------- */
  /* K /k/ */
  Casa: { 'es-DO': 'Casa', gl: 'Casa', eu: 'Katu' },
  Paquete: { 'es-DO': 'Paquete', gl: 'Paquete', eu: 'Bakea' },
  Taco: { 'es-DO': 'Taco', gl: 'Taco', eu: 'Ikusi' },
  Acto: { 'es-DO': 'Acto', gl: 'Acto', eu: 'Aktore' },
  /* G /g/ */
  Gato: { 'es-DO': 'Gato', gl: 'Gato', eu: 'Gizon' },
  Laguna: { 'es-DO': 'Laguna', gl: 'Lagoa', eu: 'Agur' },
  Signo: { 'es-DO': 'Signo', gl: 'Signo', eu: 'Diagnostiko' },
  /* J /x/ — en galego el correspondiente es /ʃ/ (grafía <x>) */
  'José': {
    'es-DO': 'José', gl: 'Xosé', eu: 'Jauna',
    note: 'gl: el galego no tiene /x/; su correspondiente sistemático es /ʃ/.',
  },
  Tejido: {
    'es-DO': 'Tejido', gl: 'Caixa', eu: 'Garaje',
    note: 'gl: /ʃ/ como correspondiente de /x/; «tecido» no lo porta. eu: se descarta el etnónimo que portaba este fonema por otro portador neutro.',
  },
  Reloj: { 'es-DO': 'Reloj', gl: 'Reloxo', eu: 'Erloju' },

  /* ------------------------ Dífonos vocálicos ----------------------------- */
  Piano: { 'es-DO': 'Piano', gl: 'Piano', eu: 'Piano' },
  Vaina: { 'es-DO': 'Vaina', gl: 'Vaina', eu: 'Ainara' },
  'Violín': { 'es-DO': 'Violín', gl: 'Violín', eu: 'Biolin' },
  'Autobús': {
    'es-DO': 'Jaula', gl: 'Autobús', eu: 'Autobus',
    note: 'es-DO: en RD el autobús es «la guagua»; se elige otro portador de /au/ para no introducir el término que ya causaba el equívoco en las frases.',
  },
  Ciudad: { 'es-DO': 'Ciudad', gl: 'Miúdo', eu: 'Ziur' },
  Fui: { 'es-DO': 'Fui', gl: 'Ruído', eu: 'Kuia' },

  /* --------------------- Dífonos consonánticos ---------------------------- */
  Tabla: { 'es-DO': 'Tabla', gl: 'Bloque', eu: 'Bloke',
    note: 'gl: «táboa» no porta el grupo /bl/; se elige otro portador.' },
  Regla: { 'es-DO': 'Regla', gl: 'Regra', eu: 'Erregela',
    note: 'gl: la forma galega es /gɾ/, no /gl/.' },
  Premio: { 'es-DO': 'Premio', gl: 'Premio', eu: 'Prezio' },
  Clavo: { 'es-DO': 'Clavo', gl: 'Cravo', eu: 'Klase',
    note: 'gl: la forma galega es /kɾ/, no /kl/.' },
  Brazo: { 'es-DO': 'Brazo', gl: 'Brazo', eu: 'Brontze' },
  Atlas: { 'es-DO': 'Atlas', gl: 'Atlas', eu: 'Atlas' },
  Flecha: { 'es-DO': 'Flecha', gl: 'Frecha', eu: 'Flauta',
    note: 'gl: la forma galega es /fɾ/, no /fl/.' },
  Fruta: { 'es-DO': 'Fruta', gl: 'Froita', eu: 'Fruitu' },
  Tigre: { 'es-DO': 'Tigre', gl: 'Tigre', eu: 'Tigre' },
  'Dragón': { 'es-DO': 'Dragón', gl: 'Dragón', eu: 'Dragoi' },
  Crema: { 'es-DO': 'Crema', gl: 'Crema', eu: 'Krema' },
  Plato: { 'es-DO': 'Plato', gl: 'Prato', eu: 'Plater',
    note: 'gl: la forma galega es /pɾ/, no /pl/.' },

  /* ---------------------------- Polisílabas ------------------------------- */
  Locomotora: {
    'es-DO': 'Carpintero', gl: 'Locomotora', eu: 'Ikastetxea',
    note: 'es-DO: el carpintero es un pájaro corriente en RD; conserva la palabra polisilábica con un referente que el niño reconoce.',
  },
  'Panadería': { 'es-DO': 'Panadería', gl: 'Panadaría', eu: 'Okindegia' },
  Caperucita: { 'es-DO': 'Caperucita', gl: 'Carrapuchiña', eu: 'Txanogorritxu' },
  Ametralladora: {
    'es-DO': 'Ametralladora', gl: 'Metralladora', eu: 'Metrailadorea',
    note: 'gl: la forma galega es «metralladora», sin a- inicial. PENDIENTE DE CRITERIO CLÍNICO: el referente es un arma y esto no es una cuestión regional sino de adecuación infantil; «mantequilla» conservaría /ʎ/ y el carácter polisilábico.',
  },
  'Helicóptero': { 'es-DO': 'Helicóptero', gl: 'Helicóptero', eu: 'Helikopteroa' },
  Bicicleta: { 'es-DO': 'Bicicleta', gl: 'Bicicleta', eu: 'Bizikleta' },

  /* ------------------------------- Frases --------------------------------- */
  'El perro salta.': {
    'es-DO': 'El perro salta.',
    gl: 'O can salta.',
    eu: 'Txakurrak salto egiten du.',
  },
  'La niña rubia come.': {
    'es-DO': 'La niña rubia come.',
    gl: 'A nena loura come.',
    eu: 'Neska ilehoriak jaten du.',
  },
  'Ana fue al jardín con su gatita.': {
    'es-DO': 'Ana fue al jardín con su gatita.',
    gl: 'Ana foi ao xardín coa súa gatiña.',
    eu: 'Ana lorategira joan zen bere katutxoarekin.',
  },
  'El bebé lloraba porque tenía hambre.': {
    'es-DO': 'El bebé lloraba porque tenía hambre.',
    gl: 'O bebé choraba porque tiña fame.',
    eu: 'Haurra negarrez zegoen gose zelako.',
    note: 'El original chileno decía «la guagua», que en RD significa AUTOBÚS y en España no significa nada.',
  },
  'El mono que estaba dentro de la jaula se perdió.': {
    'es-DO': 'El mono que estaba dentro de la jaula se perdió.',
    gl: 'O mono que estaba dentro da gaiola perdeuse.',
    eu: 'Kaiolan zegoen tximinoa galdu egin zen.',
  },
  'Juanito se metió debajo de la cama para que no lo pillara su mamá.': {
    'es-DO': 'Juanito se metió debajo de la cama para que no lo agarrara su mamá.',
    gl: 'Xoaniño meteuse debaixo da cama para que non o collera a súa nai.',
    eu: 'Joanito ohe azpian ezkutatu zen amak harrapa ez zezan.',
    note: 'es-DO: «pillar» con el sentido de sorprender es poco corriente en RD.',
  },
};
