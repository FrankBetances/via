// gluestack no se transforma en jest: se sustituye por piezas mínimas. Lo que
// se prueba es el envoltorio, no gluestack.
jest.mock('@gluestack-ui/themed', () => ({
  Button: ({ children }: { children?: unknown }) => children,
  ButtonSpinner: () => null,
  ButtonText: ({ children }: { children?: unknown }) => children,
}));

import React, { isValidElement } from 'react';
import { ButtonText } from '@gluestack-ui/themed';

import { wrapLooseText } from '../Button';

/* -------------------------------------------------------------------------- */
/*  Un texto suelto dentro de <Button> rompía el dibujo de la pantalla: el     */
/*  Button de gluestack no lo envuelve en <Text> (lib/Button.jsx pinta los     */
/*  hijos tal cual) y React Native no admite texto fuera de <Text>. Pasaba en */
/*  los seis botones de ProsodyAnalysisScreen.tsx (informe E3, 18/11/2026).   */
/* -------------------------------------------------------------------------- */

const asArray = (n: React.ReactNode) => React.Children.toArray(n);

describe('wrapLooseText', () => {
  it('mete un texto suelto en ButtonText', () => {
    const [only] = asArray(wrapLooseText('Iniciar toma'));
    expect(isValidElement(only) && only.type).toBe(ButtonText);
  });

  it('mete también un número suelto', () => {
    const [only] = asArray(wrapLooseText(3));
    expect(isValidElement(only) && only.type).toBe(ButtonText);
  });

  it('deja igual los hijos que ya son componentes', () => {
    const icon = <ButtonText>ya envuelto</ButtonText>;
    const [only] = asArray(wrapLooseText(icon));
    expect(isValidElement(only) && only.type).toBe(ButtonText);
    expect(isValidElement(only) && (only.props as { children: string }).children).toBe('ya envuelto');
  });

  it('en una mezcla solo envuelve lo suelto', () => {
    const out = asArray(wrapLooseText(['Hola', <ButtonText key="x">x</ButtonText>]));
    expect(out).toHaveLength(2);
    expect(out.every(c => isValidElement(c) && c.type === ButtonText)).toBe(true);
  });
});
