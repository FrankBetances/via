/* -------------------------------------------------------------------------- */
/*  Pictogramas PROVISIONALES por palabra (bandas con imagen) — fuente única   */
/*  para la pantalla y para el generador de ilustraciones provisionales        */
/*  (`scripts/generate-verbal-images.js`). Palabra sin pictograma → tile de    */
/*  inicial. TODOS son provisionales: la producción final (ilustrador, estilo  */
/*  homogéneo validado con niños) los sustituye en la Iteración 2 sin tocar    */
/*  código (misma clave de asset).                                             */
/* -------------------------------------------------------------------------- */

export const VERBAL_GLYPHS: Record<string, string> = {
  // Banda A
  pato: '🦆', gato: '🐱', pan: '🍞', mano: '✋', vaca: '🐄', casa: '🏠', taza: '☕',
  boca: '👄', mono: '🐒', pelota: '⚽', galleta: '🍪', zapato: '👟', manzana: '🍎',
  plátano: '🍌', flor: '🌸', sol: '☀️', pez: '🐟', mesa: '🍽️', pala: '🏓',
  // Banda B
  ventana: '🪟', campana: '🔔', cabaña: '🛖', caballo: '🐴', cebolla: '🧅',
  pastilla: '💊', botella: '🍾', rodilla: '🦵', mariposa: '🦋', escalera: '🪜',
  tijeras: '✂️', bandera: '🚩', pájaro: '🐦', lámpara: '💡', cámara: '📷',
  número: '🔢', orejas: '👂', abejas: '🐝', cerezas: '🍒', maderas: '🪵',
  escoba: '🧹', escuela: '🏫', estrella: '⭐', ballena: '🐋', botón: '🔘',
  maleta: '🧳', semilla: '🌱', gallina: '🐔', cadena: '⛓️',
  manguera: '🚿', mañana: '🌅', semana: '📅', sábana: '🛏️',
  // Banda C
  pino: '🌲', vino: '🍷', niño: '👦', pila: '🔋', foca: '🦭', roca: '🪨',
  bota: '👢', gota: '💧', nota: '🎵', gorra: '🧢', rata: '🐀', lata: '🥫',
  pata: '🐾', bata: '🥼', gata: '🐈', rana: '🐸', caña: '🎣', reina: '👑',
  fuente: '⛲', puente: '🌉', diente: '🦷', queso: '🧀', beso: '💋', peso: '⚖️',
  hueso: '🦴', jarra: '🏺', carta: '✉️', cara: '🙂', peine: '🪮', parra: '🍇',
  // Banda C — pares mínimos que antes quedaban sin dibujo (tile de inicial). Los
  // más abstractos (fino, gana, maña, rota, toca) llevan el emoji más cercano;
  // como en estas bandas la tarjeta muestra también la palabra, un pictograma
  // plausible + palabra es más claro que una inicial suelta.
  aceite: '🫒', barra: '🥖', cana: '👵', fino: '🪶', gana: '😋', garra: '🦅',
  lino: '🧵', loca: '🤪', marca: '🏷️', maña: '🛠️', pota: '🦑', rota: '💔',
  seso: '🧠', toca: '👆', yeso: '🩹',
};
