import {
  ALL_UI_LANGS,
  DEFAULT_UI_LANG,
  getUiLang,
  hydrateUiLang,
  isUiLang,
  resolveInitialUiLang,
  setAppLanguage,
  setUiLang,
  subscribeUiLang,
} from '../uiLang';
import { SESSION_LANGS } from '@/Store/slices/sessionLangs';

/* -------------------------------------------------------------------------- */
/*  Idioma de INTERFAZ: el eje que faltaba.                                     */
/*                                                                             */
/*  Lo que vigila este fichero es la regresión concreta de `mejora2`: elegir un */
/*  idioma en Créditos movía la VARIEDAD CLÍNICA (banco de estímulos y voz) y   */
/*  no movía la interfaz, porque el cambio de textos colgaba de un              */
/*  `i18n.isInitialized` que en el dispositivo era siempre falso. Media acción  */
/*  invisible ejecutándose y media visible sin ejecutarse.                      */
/* -------------------------------------------------------------------------- */

jest.mock('@react-native-async-storage/async-storage', () => {
  const store = new Map<string, string>();
  return {
    __esModule: true,
    default: {
      getItem: jest.fn(async (k: string) => store.get(k) ?? null),
      setItem: jest.fn(async (k: string, v: string) => {
        store.set(k, v);
      }),
      removeItem: jest.fn(async (k: string) => {
        store.delete(k);
      }),
    },
  };
});

beforeEach(async () => {
  await setUiLang(DEFAULT_UI_LANG);
});

describe('idioma de interfaz · registro', () => {
  it('ofrece exactamente las variedades de sesión (sin deriva entre los dos ejes)', () => {
    expect([...ALL_UI_LANGS]).toEqual([...SESSION_LANGS]);
  });

  it('arranca en castellano', () => {
    expect(DEFAULT_UI_LANG).toBe('es');
    expect(getUiLang()).toBe('es');
  });

  it('reconoce las siete y rechaza lo demás', () => {
    for (const lang of ALL_UI_LANGS) expect(isUiLang(lang)).toBe(true);
    for (const bad of ['fr', '', 'ES', null, undefined, 42]) expect(isUiLang(bad)).toBe(false);
  });

  it('un valor ilegible del disco cae al defecto seguro, no rompe', () => {
    expect(resolveInitialUiLang('pt')).toBe('es');
    expect(resolveInitialUiLang(null)).toBe('es');
    expect(resolveInitialUiLang('eu')).toBe('eu');
  });
});

describe('idioma de interfaz · cambio', () => {
  it('avisa a los suscriptores para que la app se repinte', async () => {
    const seen: string[] = [];
    const stop = subscribeUiLang(() => seen.push(getUiLang()));
    await setUiLang('eu');
    await setUiLang('ca');
    stop();
    await setUiLang('en');
    expect(seen).toEqual(['eu', 'ca']);
  });

  it('no avisa si el idioma no cambia (nada de repintados de balde)', async () => {
    await setUiLang('gl');
    const fn = jest.fn();
    const stop = subscribeUiLang(fn);
    await setUiLang('gl');
    stop();
    expect(fn).not.toHaveBeenCalled();
  });

  it('sobrevive al reinicio: lo elegido se rehidrata del disco', async () => {
    // Un reinicio de verdad: el disco conserva 'ca' y la memoria arranca en el
    // defecto seguro. Volver a llamar a `setUiLang` reescribiría el disco y el
    // test no probaría nada.
    await setUiLang('ca');
    const storage = jest.requireMock('@react-native-async-storage/async-storage').default;
    expect(storage.setItem).toHaveBeenCalledWith('@via_ui_lang', 'ca');

    await setUiLang('es');
    storage.getItem.mockResolvedValueOnce('ca');
    await hydrateUiLang();
    expect(getUiLang()).toBe('ca');
  });

  it('un idioma corrupto en el disco no deja la app sin catálogo', async () => {
    const storage = jest.requireMock('@react-native-async-storage/async-storage').default;
    storage.getItem.mockResolvedValueOnce('klingon');
    await hydrateUiLang();
    expect(getUiLang()).toBe('es');
  });
});

describe('setAppLanguage · el botón cambia la APP ENTERA', () => {
  it('mueve los DOS ejes: interfaz y variedad de sesión', async () => {
    const applied: string[] = [];
    await setAppLanguage('en', lang => applied.push(lang));
    expect(getUiLang()).toBe('en');
    expect(applied).toEqual(['en']);
  });

  it('aplica la variedad para las siete, sin excepciones silenciosas', async () => {
    for (const lang of ALL_UI_LANGS) {
      const applied: string[] = [];
      await setAppLanguage(lang, l => applied.push(l));
      expect({ lang, ui: getUiLang(), applied }).toEqual({ lang, ui: lang, applied: [lang] });
    }
  });

  it('la variedad se aplica ANTES de persistir: si el disco falla, el niño ya oye su lengua', async () => {
    const order: string[] = [];
    const storage = jest.requireMock('@react-native-async-storage/async-storage').default;
    storage.setItem.mockImplementationOnce(async () => {
      order.push('persist');
      throw new Error('disco lleno');
    });
    await setAppLanguage('gl', () => order.push('variedad'));
    expect(order).toEqual(['variedad', 'persist']);
    expect(getUiLang()).toBe('gl');
  });
});
