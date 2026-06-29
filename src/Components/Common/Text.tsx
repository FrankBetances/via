import React, { ComponentProps } from 'react';
import { TextStyle } from 'react-native';
import { Text as GSText } from '@gluestack-ui/themed';

/* -------------------------------------------------------------------------- */
/*  Text — wrapper de `@gluestack-ui/themed`'s Text usado por las 9 pantallas */
/*  de módulo. Añade el atajo `weight` (mapeado a `fontWeight`) que las       */
/*  pantallas usan junto a `size`/`color` (ambos ya soportados nativamente    */
/*  por el Text de Gluestack). El resto de props se reenvía sin cambios.      */
/* -------------------------------------------------------------------------- */

export type TextWeight = 'normal' | 'medium' | 'semiBold' | 'bold';

const WEIGHT_MAP: Record<TextWeight, TextStyle['fontWeight']> = {
  normal: '400',
  medium: '500',
  semiBold: '600',
  bold: '700',
};

export interface TextProps extends ComponentProps<typeof GSText> {
  weight?: TextWeight;
}

export default function Text({ weight, style, ...rest }: TextProps) {
  const fontWeight = weight ? WEIGHT_MAP[weight] : undefined;
  return <GSText style={fontWeight ? [{ fontWeight }, style] : style} {...rest} />;
}
