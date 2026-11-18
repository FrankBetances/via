import React, { Children, ComponentProps, ReactNode } from 'react';
import { Button as GSButton, ButtonSpinner, ButtonText } from '@gluestack-ui/themed';

/* -------------------------------------------------------------------------- */
/*  Button — wrapper de `@gluestack-ui/themed`'s Button usado por las 9       */
/*  pantallas de módulo. A diferencia del Button "puro" de Gluestack (que     */
/*  exige `ButtonText`/`ButtonIcon` como hijos), las pantallas le pasan        */
/*  children arbitrarios (`<HStack><Icon/><Text/></HStack>`) directamente, y  */
/*  un flag `isLoading` que sustituye esos children por un spinner mientras   */
/*  la mutation está en curso. El resto de props (`action`, `variant`,        */
/*  `rounded`, `isDisabled`, `onPress`, `style`, ...) se reenvía sin cambios. */
/* -------------------------------------------------------------------------- */

export interface ButtonProps extends ComponentProps<typeof GSButton> {
  isLoading?: boolean;
  children?: ReactNode;
}

/**
 * Un texto suelto como hijo (`<Button>{t.x}</Button>`) iba directo al
 * contenedor del Button de gluestack, que no lo envuelve en `<Text>`, y React
 * Native no admite texto fuera de `<Text>`: la pantalla falla al dibujarse.
 * Pasaba en los seis botones de `ProsodyAnalysisScreen.tsx` (informe E3,
 * 18/11/2026). Aquí cada texto o número suelto se mete en `ButtonText`; el
 * resto de hijos (`<HStack>`, `<Icon>`…) pasa igual que antes.
 */
export const wrapLooseText = (children: ReactNode): ReactNode =>
  Children.map(children, child =>
    typeof child === 'string' || typeof child === 'number' ? <ButtonText>{child}</ButtonText> : child,
  );

export default function Button({ isLoading, isDisabled, children, ...rest }: ButtonProps) {
  return (
    <GSButton isDisabled={isDisabled || isLoading} {...rest}>
      {isLoading ? <ButtonSpinner color="$white" /> : wrapLooseText(children)}
    </GSButton>
  );
}
