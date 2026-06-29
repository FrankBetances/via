import React, { ReactNode } from 'react';
import { Box } from '@gluestack-ui/themed';
import { SafeAreaView } from 'react-native-safe-area-context';

/* -------------------------------------------------------------------------- */
/*  Content — contenedor raíz compartido por las 9 pantallas de módulo.       */
/*  Provee el fondo base + una capa absoluta para las manchas decorativas     */
/*  (`radialBackgrounds`, ver RadialBackground) detrás del contenido real.    */
/*  `padding`/`insetTop` controlan si el propio Content aplica su padding o   */
/*  inset por defecto (las 9 pantallas siempre pasan `false` en ambos y       */
/*  gestionan su propio padding/Header con inset).                            */
/* -------------------------------------------------------------------------- */

export interface ContentProps {
  children: ReactNode;
  radialBackgrounds?: ReactNode;
  padding?: boolean;
  insetTop?: boolean;
}

export default function Content({ children, radialBackgrounds, padding = true, insetTop = true }: ContentProps) {
  return (
    <SafeAreaView style={{ flex: 1 }} edges={insetTop ? ['top', 'bottom'] : ['bottom']}>
      <Box flex={1} bg="$backgroundLight0" position="relative" overflow="hidden" p={padding ? '$4' : 0}>
        {radialBackgrounds}
        {children}
      </Box>
    </SafeAreaView>
  );
}
