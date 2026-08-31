import React from 'react';
import { act, create } from 'react-test-renderer';

import LanguagePickerModal, { LANGUAGE_OPTIONS } from '../LanguagePickerModal';
import { SESSION_LANGS, SESSION_LANG_LABEL } from '@/Store/slices/sessionLangs';
import { getUiLang, setUiLang } from '@/I18n/uiLang';

/* -------------------------------------------------------------------------- */
/*  El selector de idioma.                                                      */
/*                                                                             */
/*  El test que había antes mockeaba `@/I18n` con `isInitialized: true`, es     */
/*  decir, afirmaba justo lo contrario de lo que ocurría en el dispositivo, y   */
/*  por eso pasaba en verde mientras el botón no cambiaba ni un texto. Aquí no  */
/*  se mockea la capa de idioma: se usa la de verdad y se comprueba que pulsar  */
/*  una opción mueve los DOS ejes.                                              */
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
      removeItem: jest.fn(async () => undefined),
    },
  };
});

const mockDispatch = jest.fn();
jest.mock('react-redux', () => ({
  useDispatch: () => mockDispatch,
}));

const render = () => {
  let tree: ReturnType<typeof create> | undefined;
  act(() => {
    tree = create(<LanguagePickerModal visible onClose={jest.fn()} />);
  });
  return tree!;
};

/**
 * Las opciones del selector, una por lengua.
 *
 * Se filtra a elementos ANFITRIÓN (`typeof type === 'string'`): un `Pressable`
 * aparece tres veces en el árbol —el componente, su envoltorio y la vista real—
 * y las tres llevan el mismo `accessibilityRole`, así que contarlas todas daba
 * 21 opciones para siete lenguas.
 */
const optionsOf = (tree: ReturnType<typeof create>) =>
  tree.root.findAll(
    n => n.props?.accessibilityRole === 'radio' && typeof n.type === 'string',
    { deep: true },
  );

beforeEach(async () => {
  mockDispatch.mockClear();
  await setUiLang('es');
});

describe('LanguagePickerModal', () => {
  it('ofrece exactamente las siete variedades de SESSION_LANGS', () => {
    expect([...LANGUAGE_OPTIONS]).toEqual([...SESSION_LANGS]);
  });

  it('enseña el nombre de cada lengua en la propia lengua', () => {
    const json = JSON.stringify(render().toJSON());
    for (const lang of SESSION_LANGS) {
      expect({ lang, shown: json.includes(SESSION_LANG_LABEL[lang]) }).toEqual({
        lang,
        shown: true,
      });
    }
  });

  it('elegir una lengua cambia la INTERFAZ y despacha la VARIEDAD', async () => {
    const tree = render();
    expect(optionsOf(tree)).toHaveLength(SESSION_LANGS.length);

    // Para PULSAR hace falta el nodo compuesto: el anfitrión recibe el rol y el
    // estado, pero `onPress` se queda en el `Pressable` que lo envuelve.
    const pressables = tree.root.findAll(
      n => n.props?.accessibilityRole === 'radio' && typeof n.props.onPress === 'function',
      { deep: true },
    );
    expect(pressables).toHaveLength(SESSION_LANGS.length);

    await act(async () => {
      pressables[SESSION_LANGS.indexOf('en')].props.onPress();
    });

    // Eje 1 · interfaz.
    expect(getUiLang()).toBe('en');
    // Eje 2 · variedad clínica (banco de estímulos, voz y ASR).
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'locale/setSessionLanguage', payload: 'en' }),
    );
  });

  it('el propio selector se repinta en el idioma elegido', async () => {
    await setUiLang('eu');
    const json = JSON.stringify(render().toJSON());
    // Título del modal en euskera, no en castellano.
    expect(json).toContain('Aplikazioaren hizkuntza');
    expect(json).not.toContain('Idioma de la aplicación');
  });

  it('marca como seleccionada la lengua activa, y solo esa', async () => {
    await setUiLang('ca');
    const tree = render();
    const selected = optionsOf(tree).filter(n => n.props.accessibilityState?.selected);
    expect(selected).toHaveLength(1);
    expect(selected[0].props.accessibilityLabel).toContain(SESSION_LANG_LABEL.ca);
  });
});
