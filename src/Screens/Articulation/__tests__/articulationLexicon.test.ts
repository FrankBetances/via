import { buildArticulationItems } from '../articulationResult';
import { TAR_LEXICON } from '../articulationLexicon';
import { tarModelByLang } from '@/Voice/viaVoiceConsignas';
import { WORD_EMOJI } from '../articulationPictograms';

/* El banco multilingüe del T.A.R. solo vale si está COMPLETO: `bankLangs`
   deriva del contenido, así que un solo ítem sin cubrir retira la lengua del
   selector de todas las pantallas. Estas pruebas fijan esa completitud para
   que añadir un ítem al inventario obligue a traer sus cuatro variedades. */
describe('léxico del T.A.R. · las cuatro variedades, sin huecos', () => {
  const words = [...new Set(buildArticulationItems().map(i => i.word))];

  it('cada ítem del inventario tiene entrada en el léxico', () => {
    const missing = words.filter(w => !TAR_LEXICON[w]);
    expect(missing).toEqual([]);
  });

  it('ninguna variedad queda vacía en ninguna entrada', () => {
    for (const w of words) {
      const e = TAR_LEXICON[w];
      for (const lang of ['es-DO', 'gl', 'eu'] as const) {
        expect(typeof e[lang]).toBe('string');
        expect(e[lang].trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('el léxico no arrastra claves que ya no están en el inventario', () => {
    const known = new Set(words);
    expect(Object.keys(TAR_LEXICON).filter(k => !known.has(k))).toEqual([]);
  });

  it('`tarModelByLang` declara las cuatro variedades para todo el inventario', () => {
    for (const w of words) {
      const t = tarModelByLang(w);
      expect(t.es).toBe(w);
      expect(t['es-DO']).toBeTruthy();
      expect(t.gl).toBeTruthy();
      expect(t.eu).toBeTruthy();
    }
  });

  /* El T.A.R. de origen es chileno y su léxico venía con americanismos y
     referentes locales. Ninguna de las cuatro columnas es Chile: la castellana
     es IBÉRICA, así que estas formas no deben sobrevivir en ninguna parte del
     banco, ni siquiera en `es`. «Guagua» merece mención propia: es bebé en
     Chile, AUTOBÚS en RD y nada en España. */
  const CHILENISMOS = [
    /\bporoto/i, /\bdiuca/i, /\bcarabinero/i, /\bguagua/i, /\bpu[ñn]ete/i,
    /\b[ñn]and[uú]/i,
  ];

  it('ningún chilenismo del inventario original sobrevive en ninguna columna', () => {
    const survivors: string[] = [];
    for (const [key, e] of Object.entries(TAR_LEXICON)) {
      for (const text of [key, e['es-DO'], e.gl, e.eu]) {
        if (CHILENISMOS.some(rx => rx.test(text))) survivors.push(`${key} -> ${text}`);
      }
    }
    expect(survivors).toEqual([]);
  });

  it('«pasto» y «auto» no se cuelan como castellano peninsular', () => {
    // Americanismos que un niño de la Península no usa: césped y coche.
    expect(Object.keys(TAR_LEXICON)).not.toContain('Pasto');
    expect(Object.keys(TAR_LEXICON)).not.toContain('Auto');
  });

  /* Una desviación de la regla «mismo fonema, misma posición» está validada,
     pero NUNCA es silenciosa: el clínico tiene que poder leerla en el ítem. */
  /* El pictograma se indexa por la clave castellana del ítem. Al adaptar la
     columna ibérica, las claves cambiaron y el emoji se quedó apuntando a las
     antiguas: «Locomotora» heredó el policía de «Carabinero». */
  it('cada ítem no-frase conserva su pictograma', () => {
    const sinEmoji = buildArticulationItems()
      .filter(i => i.section !== 'frases' && !WORD_EMOJI[i.word])
      .map(i => i.word);
    expect(sinEmoji).toEqual([]);
  });

  it('el mapa de pictogramas no arrastra claves muertas', () => {
    const known = new Set(buildArticulationItems().map(i => i.word));
    expect(Object.keys(WORD_EMOJI).filter(k => !known.has(k))).toEqual([]);
  });

  /* Ninguna prueba infantil debe pedirle a un niño que nombre un arma. El
     inventario original traía «ametralladora» y «flecha» (con arco). Se
     sustituyeron por «mariposa» y «flauta», que no es solo un cambio de
     palabra: el pictograma que el niño ve también deja de serlo. */
  const ARMAS = [
    /metrall/i, /flecha/i, /frecha/i, /pistol/i, /fusil/i, /espada/i,
    /cuchill/i, /puñal/i, /\bbala\b/i, /\barma/i, /cañón/i, /granada/i,
  ];
  const EMOJIS_ARMA = ['🔫', '🏹', '🗡️', '⚔️', '💣', '🪓', '🔪', '🛡️', '💥', '👊'];

  it('ninguna columna nombra un arma', () => {
    const hits: string[] = [];
    for (const [key, e] of Object.entries(TAR_LEXICON)) {
      for (const text of [key, e['es-DO'], e.gl, e.eu]) {
        if (ARMAS.some(rx => rx.test(text))) hits.push(`${key} -> ${text}`);
      }
    }
    expect(hits).toEqual([]);
  });

  it('ningún pictograma dibuja un arma', () => {
    const hits = Object.entries(WORD_EMOJI)
      .filter(([, g]) => EMOJIS_ARMA.some(a => g.includes(a)))
      .map(([w, g]) => `${w} ${g}`);
    expect(hits).toEqual([]);
  });

  /* Los doce dífonos consonánticos cubren doce grupos distintos: quitar una
     palabra sin mirar deja un grupo sin explorar. «Flauta» entra justamente
     porque conserva el /fl/ que «flecha» era la única en portar. */
  it('la sustitución de «flecha» no deja el grupo /fl/ sin cubrir', () => {
    const difcons = buildArticulationItems()
      .filter(i => i.section === 'difcons')
      .map(i => i.word);
    expect(difcons).toHaveLength(12);
    expect(difcons.some(w => /^fl/i.test(w))).toBe(true);
  });

  it('toda entrada que se aparta de la rejilla lleva su nota', () => {
    const documented = Object.entries(TAR_LEXICON).filter(([, e]) => e.note);
    expect(documented.length).toBeGreaterThan(0);
    for (const [, e] of documented) expect(e.note!.length).toBeGreaterThan(20);
  });
});
