import {
  alignPhones,
  describe as describeDiff,
  graphemesToPhones,
  phraseToPhones,
  proposeSoda,
} from '../articulationPhonetics';
import { buildArticulationItems } from '../articulationResult';

/* -------------------------------------------------------------------------- */
/*  Fonética del T.A.R. (A-bis, mitad no acústica).                            */
/*                                                                            */
/*  La conversión grafema→fonema del español es reglada, así que se puede      */
/*  probar con casos conocidos en vez de con tolerancias. Lo que se vigila     */
/*  además es lo que el módulo NO debe hacer: proponer distorsiones que no     */
/*  puede ver, o inventar errores dialectales.                                */
/* -------------------------------------------------------------------------- */

const g2p = (w: string) => graphemesToPhones(w).join('-');

describe('grafema → fonema · reglas del español', () => {
  it('correspondencias directas', () => {
    expect(g2p('pato')).toBe('P-A-T-O');
    expect(g2p('mesa')).toBe('M-E-S-A');
  });

  it('b y v son el MISMO fonema', () => {
    expect(g2p('vaca')).toBe(g2p('baca'));
  });

  it('la h es muda', () => {
    expect(g2p('hilo')).toBe('I-L-O');
    expect(g2p('ahora')).toBe('A-O-R-A');
  });

  it('dígrafos: ch, ll, rr', () => {
    expect(g2p('chandal')).toBe('CH-A-N-D-A-L');
    expect(g2p('llave')).toBe('LL-A-B-E');
    expect(g2p('perro')).toBe('P-E-RR-O');
  });

  /* La distinción R / RR es la que el T.A.R. evalúa por separado, y no depende
   * de la grafía sino de la posición: inicial y tras n/l/s es múltiple. */
  it('vibrante múltiple en inicial y tras n, l o s', () => {
    expect(g2p('rosa')).toBe('RR-O-S-A');
    expect(g2p('honra')).toBe('O-N-RR-A');
    expect(g2p('alrededor')).toBe('A-L-RR-E-D-E-D-O-R');
    expect(g2p('cara')).toBe('K-A-R-A'); // simple entre vocales
  });

  it('qu y gu con u muda; gü con u sonora', () => {
    expect(g2p('queso')).toBe('K-E-S-O');
    expect(g2p('guitarra')).toBe('G-I-T-A-RR-A');
    expect(g2p('paraguas')).toBe('P-A-R-A-G-U-A-S');
    expect(g2p('pingüino')).toBe('P-I-N-G-W-I-N-O');
  });

  it('c y g cambian ante e/i', () => {
    expect(g2p('casa')).toBe('K-A-S-A');
    expect(g2p('cine')).toBe('S-I-N-E'); // seseo por defecto
    expect(g2p('gato')).toBe('G-A-T-O');
    expect(g2p('gente')).toBe('J-E-N-T-E');
  });

  /* El T.A.R. se usa en sesión castellana y dominicana. Sin seseo por defecto,
   * cada «zapato» de un niño dominicano se marcaría como sustitución de un
   * fonema que en su variedad no existe. */
  it('el seseo es el comportamiento por defecto, y se puede desactivar', () => {
    expect(g2p('zapato')).toBe('S-A-P-A-T-O');
    expect(graphemesToPhones('zapato', { seseo: false }).join('-')).toBe('Z-A-P-A-T-O');
  });

  it('las tildes no cambian el fonema', () => {
    expect(g2p('jose')).toBe(g2p('josé'));
    expect(g2p('nandu')).toBe('N-A-N-D-U');
    expect(g2p('ñandú')).toBe('Ñ-A-N-D-U');
  });

  it('frases enteras se transcriben como una secuencia', () => {
    expect(phraseToPhones('El perro salta.').join('-')).toBe('E-L-P-E-RR-O-S-A-L-T-A');
  });

  /* Todo el inventario del T.A.R. debe transcribirse sin quedarse vacío: si una
   * palabra del banco no produce fonemas, la propuesta SODA no funcionaría
   * justo en ese ítem y nadie se enteraría. */
  it('todas las palabras del inventario producen fonemas', () => {
    for (const item of buildArticulationItems()) {
      expect(phraseToPhones(item.word).length).toBeGreaterThan(0);
    }
  });
});

describe('alineamiento', () => {
  it('secuencias iguales son todo coincidencias', () => {
    const a = alignPhones(['G', 'A', 'T', 'O'], ['G', 'A', 'T', 'O']);
    expect(a.every(x => x.op === 'match')).toBe(true);
  });

  /* Un fonema cambiado se lee clínicamente como UNA sustitución, no como una
   * omisión seguida de una adición. */
  it('un cambio es una sustitución, no una omisión más una adición', () => {
    const a = alignPhones(['G', 'A', 'T', 'O'], ['T', 'A', 'T', 'O']);
    const errs = a.filter(x => x.op !== 'match');
    expect(errs).toHaveLength(1);
    expect(errs[0].op).toBe('sub');
    expect(errs[0].expected).toBe('G');
    expect(errs[0].produced).toBe('T');
  });

  it('localiza omisiones y adiciones', () => {
    const del = alignPhones(['P', 'L', 'A', 'T', 'O'], ['P', 'A', 'T', 'O']).filter(
      x => x.op !== 'match',
    );
    expect(del).toHaveLength(1);
    expect(del[0].op).toBe('del');
    expect(del[0].expected).toBe('L');

    const ins = alignPhones(['P', 'A', 'T', 'O'], ['P', 'L', 'A', 'T', 'O']).filter(
      x => x.op !== 'match',
    );
    expect(ins).toHaveLength(1);
    expect(ins[0].op).toBe('ins');
    expect(ins[0].produced).toBe('L');
  });
});

describe('propuesta SODA', () => {
  it('«tato» por «gato» es una sustitución del fonema diana', () => {
    const p = proposeSoda('Gato', 'tato', 'G');
    expect(p.code).toBe('S');
    expect(p.confidence).toBe('alta');
    expect(p.targetErrors).toHaveLength(1);
    expect(describeDiff(p.targetErrors[0])).toBe('/g/ → /t/');
  });

  it('«pato» por «plato» es una omisión', () => {
    const p = proposeSoda('Plato', 'pato', 'L');
    expect(p.code).toBe('O');
    expect(p.note).toMatch(/omite \/l\//);
  });

  it('«tigere» por «tigre» es una adición', () => {
    expect(proposeSoda('Tigre', 'tigere').code).toBe('A');
  });

  /* La coincidencia NO cierra el caso: el reconocedor pudo normalizar el error
   * hacia la palabra de diccionario, y una distorsión produce la misma cadena
   * que la producción correcta. Por eso «C» sale con confianza BAJA. */
  it('la coincidencia se propone con confianza baja y pide confirmar de oído', () => {
    const p = proposeSoda('Casa', 'casa', 'K');
    expect(p.code).toBe('C');
    expect(p.confidence).toBe('baja');
    expect(p.note).toMatch(/distorsión/i);
  });

  /* INVARIANTE: la distorsión no se ve en el texto. Ninguna entrada puede
   * hacer que este módulo la proponga. */
  it('nunca propone D, con ninguna entrada', () => {
    const words = buildArticulationItems().slice(0, 40).map(i => i.word);
    const mangled = ['tato', 'pato', 'ala', 'sss', 'gato', 'tigere', 'cala', ''];
    for (const w of words) {
      for (const h of mangled) {
        expect(proposeSoda(w, h)?.code).not.toBe('D');
      }
    }
  });

  it('sin transcripción no propone nada y lo dice', () => {
    const p = proposeSoda('Gato', '');
    expect(p.code).toBeNull();
    expect(p.note).toMatch(/manualmente/i);
  });

  /* Un ítem de /r/ en el que el niño falla una vocal átona no es un fallo de
   * /r/: el módulo lo señala como error fuera del fonema diana. */
  it('distingue el error sobre el fonema diana del error en otra parte', () => {
    const enDiana = proposeSoda('Cara', 'cala', 'R');
    expect(enDiana.targetErrors).toHaveLength(1);
    expect(enDiana.note).toMatch(/afecta a \/r\//i);

    const fuera = proposeSoda('Cara', 'quera', 'R');
    expect(fuera.targetErrors).toHaveLength(0);
    expect(fuera.note).toMatch(/fuera de \/r\//i);
  });

  it('el seseo no genera falsos errores en sesión dominicana', () => {
    // «zapato» dicho con seseo se transcribe «sapato»: no es una sustitución.
    expect(proposeSoda('Zapato', 'sapato').code).toBe('C');
  });
});
