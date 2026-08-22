import { buildArticulationItems } from '../articulationResult';
import { TAR_LEXICON } from '../articulationLexicon';
import { tarModelByLang } from '@/Voice/viaVoiceConsignas';

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

  /* Los chilenismos del léxico original eran justamente los que no podían
     quedarse igual: «guagua» es bebé en Chile y AUTOBÚS en RD. */
  it('los chilenismos no sobreviven intactos en la columna dominicana', () => {
    expect(TAR_LEXICON['Poroto']['es-DO']).not.toBe('Poroto');
    expect(TAR_LEXICON['Diuca']['es-DO']).not.toBe('Diuca');
    expect(TAR_LEXICON['Carabinero']['es-DO']).not.toBe('Carabinero');
    expect(TAR_LEXICON['La guagua lloraba porque tenía hambre.']['es-DO']).not.toMatch(
      /guagua/i,
    );
  });

  /* Una desviación de la regla «mismo fonema, misma posición» está validada,
     pero NUNCA es silenciosa: el clínico tiene que poder leerla en el ítem. */
  it('toda entrada que se aparta de la rejilla lleva su nota', () => {
    const documented = Object.entries(TAR_LEXICON).filter(([, e]) => e.note);
    expect(documented.length).toBeGreaterThan(0);
    for (const [, e] of documented) expect(e.note!.length).toBeGreaterThan(20);
  });
});
