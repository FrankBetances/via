/* -------------------------------------------------------------------------- */
/*  Control L-3 del análisis de riesgo (docs/design/integracion-lua.md §7).    */
/*                                                                            */
/*  La audiometría condicionada es un VRA: el niño responde AL SONIDO, y el    */
/*  refuerzo llega después. Si Lúa se expresara en la ventana que va del       */
/*  estímulo a la respuesta, el niño podría responder a la gata en vez de al   */
/*  tono, y el umbral registrado sería más bajo que el real: una hipoacusia    */
/*  infravalorada, que es el fallo grave de esta prueba.                       */
/*                                                                            */
/*  La misma razón por la que `WhistleButton` mantiene aspecto constante       */
/*  durante la prueba real y solo emite ondas en la práctica.                  */
/*                                                                            */
/*  QUÉ ES ESTA PRUEBA Y QUÉ NO ES. Es una puerta ESTRUCTURAL sobre el código  */
/*  fuente, del mismo tipo que `scripts/check-*.js`: comprueba que no hay      */
/*  ninguna llamada a Lúa dentro de los secuenciadores de estímulo. No es una  */
/*  prueba de comportamiento y no sustituye a la verificación en el aparato    */
/*  real, que sigue pendiente (§9). Lo que sí hace es impedir la regresión por */
/*  goteo: que alguien añada una animación «para que sea más bonito» en el     */
/*  punto exacto donde invalida la medida.                                     */
/* -------------------------------------------------------------------------- */

/* Mismo patrón que `luaProtocolGate` y `luaSpriteGate`: el tsconfig de la app
   no incluye los tipos de Node, así que las puertas que leen el código fuente
   declaran lo que usan en vez de arrastrar @types/node a la compilación. */
declare const __dirname: string;
const fs = require('fs');
const path = require('path');

const SRC: string = path.join(__dirname, '..', 'AudiometryConditionedScreen.tsx');
const source: string = fs.readFileSync(SRC, 'utf8');

/** Cuerpo equilibrado en llaves que arranca en `from`. */
function blockAt(text: string, from: number): string {
  const open = text.indexOf('{', from);
  if (open < 0) return '';
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}' && --depth === 0) return text.slice(open, i + 1);
  }
  return text.slice(open);
}

/** Los secuenciadores: cada `presentTimer.current = setTimeout(...)`. */
function stimulusSequencers(): string[] {
  const out: string[] = [];
  const marker = 'presentTimer.current = setTimeout(';
  let i = source.indexOf(marker);
  while (i >= 0) {
    out.push(blockAt(source, i));
    i = source.indexOf(marker, i + marker.length);
  }
  return out;
}

describe('L-3 · Lúa calla entre el estímulo y la respuesta', () => {
  it('los secuenciadores de estímulo existen y presentan el tono', () => {
    const blocks = stimulusSequencers();
    // Práctica y prueba. Si esto cambia, la prueba de abajo dejaría de mirar
    // donde debe y hay que revisarla, no relajarla.
    expect(blocks).toHaveLength(2);
    for (const b of blocks) expect(b).toContain('a.playStimulus()');
  });

  it('ningún secuenciador de estímulo toca a Lúa', () => {
    const culpables = stimulusSequencers()
      .flatMap(b => b.match(/lua\.\w+/g) ?? []);
    expect(culpables).toEqual([]);
  });

  it('el veredicto se emite SOLO desde el manejador de la respuesta', () => {
    const onWhistle = blockAt(source, source.indexOf('const onWhistle'));
    expect(onWhistle).toContain('lua.setVerdict');

    const fuera = source.replace(onWhistle, '');
    expect(fuera).not.toContain('lua.setVerdict');
  });

  it('el veredicto exige que el tono estuviera sonando', () => {
    // `setVerdict` va siempre detrás de la comprobación de que hay estímulo
    // vivo: una pulsación al azar no obtiene refuerzo, que es lo que sostiene
    // el condicionamiento.
    const onWhistle = blockAt(source, source.indexOf('const onWhistle'));
    for (const trozo of onWhistle.split('lua.setVerdict').slice(0, -1)) {
      expect(trozo).toContain('a.playing || windowOpen.current');
    }
  });

  it('la expresión afectiva solo cambia en fronteras de fase', () => {
    // Fuera de los secuenciadores, `setEmotion` acompaña cambios de fase o de
    // frecuencia; nunca la presentación de un tono.
    const secuenciadores = stimulusSequencers().join('\n');
    expect(secuenciadores).not.toContain('setEmotion');
    expect(source).toContain('lua.setEmotion');
  });
});
