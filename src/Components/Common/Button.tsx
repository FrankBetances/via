import React, { ComponentProps, ReactNode } from 'react';
import { Button as GSButton, ButtonSpinner } from '@gluestack-ui/themed';

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

export default function Button({ isLoading, isDisabled, children, ...rest }: ButtonProps) {
  return (
    <GSButton isDisabled={isDisabled || isLoading} {...rest}>
      {isLoading ? <ButtonSpinner color="$white" /> : children}
    </GSButton>
  );
}
