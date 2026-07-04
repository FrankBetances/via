import React, { ComponentProps, useContext } from 'react';
import { StyleSheet, TextStyle } from 'react-native';
import { useSelector } from 'react-redux';
import { Text as GSText } from '@gluestack-ui/themed';

import type { RootState } from '@/Store';
import { ScaledTextScope } from './fontScaleScope';

/* -------------------------------------------------------------------------- */
/*  Text — wrapper de `@gluestack-ui/themed`'s Text usado por las 9 pantallas */
/*  de módulo. Añade el atajo `weight` (mapeado a `fontWeight`) que las       */
/*  pantallas usan junto a `size`/`color` (ambos ya soportados nativamente    */
/*  por el Text de Gluestack). Dentro de un `ScaledTextScope` (pantallas de   */
/*  cuestionario) aplica además el factor `theme.fontScale` al tamaño, para   */
/*  que el profesional pueda agrandar la letra durante la prueba.             */
/* -------------------------------------------------------------------------- */

export type TextWeight = 'normal' | 'medium' | 'semiBold' | 'bold';

const WEIGHT_MAP: Record<TextWeight, TextStyle['fontWeight']> = {
  normal: '400',
  medium: '500',
  semiBold: '600',
  bold: '700',
};

/** Tamaños en px de los tokens `size` de Gluestack (para poder escalarlos). */
const SIZE_PX: Record<string, number> = {
  '2xs': 10,
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 20,
  '2xl': 24,
  '3xl': 30,
  '4xl': 36,
  '5xl': 48,
  '6xl': 60,
};

export interface TextProps extends ComponentProps<typeof GSText> {
  weight?: TextWeight;
}

export default function Text({ weight, style, size, ...rest }: TextProps) {
  const scaleEnabled = useContext(ScaledTextScope);
  const fontScale = useSelector((state: RootState) => state.theme.fontScale);

  const fontWeight = weight ? WEIGHT_MAP[weight] : undefined;
  const weightStyle = fontWeight ? { fontWeight } : null;

  if (scaleEnabled && fontScale !== 1) {
    const flat = (StyleSheet.flatten(style) ?? {}) as TextStyle;
    const base = flat.fontSize ?? SIZE_PX[String(size ?? 'md')] ?? 16;
    const scaled: TextStyle = { fontSize: Math.round(base * fontScale) };
    // El lineHeight explícito de la pantalla se escala también: si quedara
    // fijo, la letra agrandada se recortaría verticalmente.
    if (flat.lineHeight) scaled.lineHeight = Math.round(flat.lineHeight * fontScale);
    return <GSText size={size} style={[weightStyle, style, scaled]} {...rest} />;
  }

  return <GSText size={size} style={weightStyle ? [weightStyle, style] : style} {...rest} />;
}
