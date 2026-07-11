import { I18N_RESOURCES, DEFAULT_LANGUAGE, initI18n } from '../index';

/* -------------------------------------------------------------------------- */
/*  Paridad estructural de los catálogos i18next: todos los idiomas deben      */
/*  tener exactamente las mismas claves y los mismos placeholders `{{...}}`    */
/*  que el idioma por defecto (es). Añadir un texto en un idioma sin el otro   */
/*  rompe aquí, no en producción.                                              */
/* -------------------------------------------------------------------------- */

type Tree = Record<string, unknown>;

const flatten = (obj: Tree, prefix = ''): Map<string, string> => {
  const out = new Map<string, string>();
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') out.set(path, value);
    else if (value && typeof value === 'object') {
      for (const [k, v] of flatten(value as Tree, path)) out.set(k, v);
    }
  }
  return out;
};

const placeholders = (s: string): string[] => (s.match(/\{\{\s*\w+\s*\}\}/g) ?? []).sort();

const LANGS = Object.keys(I18N_RESOURCES) as (keyof typeof I18N_RESOURCES)[];
const NAMESPACES = Object.keys(I18N_RESOURCES[DEFAULT_LANGUAGE as 'es']) as ('verbalAudiometry')[];

describe('catálogos i18next · paridad es/en', () => {
  it('declara español como idioma por defecto y ambos idiomas presentes', () => {
    expect(DEFAULT_LANGUAGE).toBe('es');
    expect(LANGS).toEqual(expect.arrayContaining(['es', 'en']));
  });

  for (const ns of NAMESPACES) {
    describe(`namespace ${ns}`, () => {
      const base = flatten(I18N_RESOURCES.es[ns] as Tree);

      it('el catálogo base no está vacío y no tiene textos en blanco', () => {
        expect(base.size).toBeGreaterThan(0);
        for (const [key, value] of base) {
          expect({ key, empty: value.trim() === '' }).toEqual({ key, empty: false });
        }
      });

      for (const lang of LANGS.filter(l => l !== 'es')) {
        it(`${lang}: mismas claves que es`, () => {
          const other = flatten((I18N_RESOURCES[lang] as Record<string, Tree>)[ns]);
          expect([...other.keys()].sort()).toEqual([...base.keys()].sort());
        });

        it(`${lang}: mismos placeholders {{...}} que es en cada clave`, () => {
          const other = flatten((I18N_RESOURCES[lang] as Record<string, Tree>)[ns]);
          for (const [key, value] of base) {
            expect({ key, ph: placeholders(other.get(key) ?? '') }).toEqual({ key, ph: placeholders(value) });
          }
        });
      }
    });
  }

  it('initI18n arranca en español y resuelve claves del módulo verbal', async () => {
    const i18n = await initI18n();
    expect(i18n.language).toBe('es');
    expect(i18n.t('SCREEN.TITLE')).toBe('Audiometría verbal');
    expect(i18n.t('PDF.INTERPRETATION')).toBe('Interpretación');
    expect(i18n.t('SCREEN.ITEM_PROGRESS', { now: 2, total: 9 })).toBe('Lámina 2/9');
    await i18n.changeLanguage('en');
    expect(i18n.t('SCREEN.TITLE')).toBe('Speech audiometry');
    await i18n.changeLanguage('es');
  });
});
