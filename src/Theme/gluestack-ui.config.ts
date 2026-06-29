import { config as defaultConfig } from '@gluestack-ui/config';
import { createConfig } from '@gluestack-style/react';

/* -------------------------------------------------------------------------- */
/*  Tokens de diseño — VIA+.                                                 */
/*  Paleta cálida tomada de los mockups: fondo crema (#F5F2EC / #ECE7DE) y    */
/*  acento naranja (#F0AE6C). Tipografía Rethink Sans (familia "heading" y    */
/*  "body" comparten la misma fuente, distinta por peso).                    */
/*                                                                            */
/*  Cargar la fuente nativa (`RethinkSans-Regular`, `-Medium`, `-SemiBold`,   */
/*  `-Bold`) vía react-native.config.js / assets en fases posteriores;        */
/*  este archivo solo declara los tokens, no empaqueta la fuente.            */
/* -------------------------------------------------------------------------- */

export const viaPlusColors = {
  // Fondos cálidos de los mockups.
  background0: '#F5F2EC',
  background50: '#ECE7DE',
  background100: '#E3DCD0',

  // Acento naranja de marca.
  accent50: '#FBE8D3',
  accent100: '#F6D2AC',
  accent300: '#F0AE6C',
  accent500: '#E08A3D',
  accent700: '#B86A26',

  // Neutros de texto.
  textPrimary: '#2B2620',
  textSecondary: '#6B635A',
  textMuted: '#9A9183',

  // Estados clínicos.
  success500: '#4F9A66',
  warning500: '#E0A93D',
  error500: '#D1564A',

  white: '#FFFFFF',
  black: '#000000',
};

export const viaPlusSpace = {
  '0': 0,
  '0.5': 2,
  '1': 4,
  '1.5': 6,
  '2': 8,
  '2.5': 10,
  '3': 12,
  '4': 16,
  '5': 20,
  '6': 24,
  '8': 32,
  '10': 40,
  '12': 48,
  '16': 64,
};

export const viaPlusFonts = {
  heading: 'RethinkSans-SemiBold',
  body: 'RethinkSans-Regular',
  mono: 'RethinkSans-Medium',
};

export const viaPlusRadii = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
};

export const config = createConfig({
  ...defaultConfig,
  tokens: {
    ...defaultConfig.tokens,
    colors: {
      ...defaultConfig.tokens.colors,
      ...viaPlusColors,
    },
    space: {
      ...defaultConfig.tokens.space,
      ...viaPlusSpace,
    },
    radii: {
      ...defaultConfig.tokens.radii,
      ...viaPlusRadii,
    },
    fonts: {
      ...defaultConfig.tokens.fonts,
      ...viaPlusFonts,
    },
  },
});

export type ViaPlusConfig = typeof config;

declare module '@gluestack-style/react' {
   
  interface ICustomConfig extends ViaPlusConfig {}
}
