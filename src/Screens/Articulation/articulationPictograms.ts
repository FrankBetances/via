/* -------------------------------------------------------------------------- */
/*  articulationPictograms — pictograma de cada ítem del T.A.R.               */
/*                                                                            */
/*  Vive fuera de la pantalla a propósito: es DATO del inventario, no de la    */
/*  vista, y así puede fijarse por test sin arrastrar el árbol de componentes. */
/*                                                                            */
/*  Se indexa por la clave CASTELLANA del ítem, que es su identificador        */
/*  estable —la misma que usa `articulationLexicon`—, no por la palabra que se */
/*  muestra: el dibujo del ítem es el mismo se locute en la variedad que se    */
/*  locute, porque el referente no cambia.                                     */
/* -------------------------------------------------------------------------- */

export const WORD_EMOJI: Record<string, string> = {
  // Bilabiales
  Bote: '🚤', Cabeza: '👦', Nube: '☁️', Objeto: '📦',
  Pato: '🦆', Zapato: '👟', Copa: '🏆', Apto: '✅',
  Mano: '✋', Camisa: '👕', Suma: '➕', Campo: '🌾',
  // Labiodental
  Foca: '🦭', Búfalo: '🐃', Café: '☕', Aftosa: '🤒',
  // Dentales
  Dama: '👸', Cadena: '⛓️', Codo: '💪', Pared: '🧱',
  Tapa: '🫙', Mata: '🌿', Torta: '🎂', Etna: '🌋',
  // Alveolares
  Sapo: '🐸', Rosa: '🌹', Bosque: '🌲',
  Nido: '🪺', Panera: '🧺', Canto: '🎵',
  Luna: '🌙', Pala: '⛏️', Dulce: '🍬',
  Coro: '🎶', Loro: '🦜',
  Perro: '🐶', Carroza: '🎠',
  // Palatales
  Llave: '🔑', Payaso: '🤡', Malla: '🩱',
  'Ñu': '🦬', Muñeca: '🪆', Caña: '🎣',
  Chándal: '🏃', Lechuga: '🥬', Noche: '🌃',
  // Velares
  Casa: '🏠', Paquete: '📦', Taco: '🌮', Acto: '🎭',
  Gato: '🐱', Laguna: '🏞️', Signo: '❓',
  José: '👨', Tejido: '🧶', Reloj: '⏰',
  // Dífonos vocálicos
  Piano: '🎹', Vaina: '🫛', Violín: '🎻', 'Autobús': '🚌', Ciudad: '🏙️', Fui: '🏃‍♂️',
  // Dífonos consonánticos
  Tabla: '🪵', Regla: '📏', Premio: '🏅', Clavo: '🔩', Brazo: '💪', Atlas: '🗺️',
  Flauta: '🪈', Fruta: '🍎', Tigre: '🐯', Dragón: '🐉', Crema: '🍦', Plato: '🍽️',
  // Polisílabas
  Locomotora: '🚂', Panadería: '🥖', Caperucita: '👧', Mariposa: '🦋',
  Helicóptero: '🚁', Bicicleta: '🚲',
};
