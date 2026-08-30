import React from 'react';
import { act, create } from 'react-test-renderer';
import LanguagePickerModal, { LANGUAGE_OPTIONS } from '../LanguagePickerModal';
import { SESSION_LANGS } from '@/Store/slices/sessionLangs';

const mockDispatch = jest.fn();
jest.mock('react-redux', () => ({
  useSelector: (selector: any) => selector({ locale: { language: 'es' } }),
  useDispatch: () => mockDispatch,
}));

jest.mock('@/I18n', () => ({
  isInitialized: true,
  changeLanguage: jest.fn().mockResolvedValue({}),
}));

describe('LanguagePickerModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('ofrece exactamente las 7 lenguas de SESSION_LANGS', () => {
    const codes = LANGUAGE_OPTIONS.map(o => o.code);
    expect(codes).toEqual([...SESSION_LANGS]);
    expect(codes).toContain('es');
    expect(codes).toContain('gl');
    expect(codes).toContain('eu');
    expect(codes).toContain('ca');
    expect(codes).toContain('es-419');
    expect(codes).toContain('es-DO');
    expect(codes).toContain('en');
  });

  it('renderiza la lista de idiomas y todas sus etiquetas cuando visible es true', () => {
    let tree: ReturnType<typeof create> | undefined;
    act(() => {
      tree = create(<LanguagePickerModal visible={true} onClose={jest.fn()} />);
    });
    expect(tree).toBeDefined();

    const json = JSON.stringify(tree!.toJSON());
    expect(json).toContain('Idioma de la aplicación');
    expect(json).toContain('Español (España)');
    expect(json).toContain('Galego');
    expect(json).toContain('Euskara');
    expect(json).toContain('Català');
    expect(json).toContain('Español (Latinoamérica)');
    expect(json).toContain('Español (Rep. Dominicana)');
    expect(json).toContain('English (US)');
  });
});
