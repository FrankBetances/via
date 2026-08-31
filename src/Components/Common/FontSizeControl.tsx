import React from 'react';
import { Pressable } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { Box, Center, HStack } from '@gluestack-ui/themed';
import { Text as GSText } from '@gluestack-ui/themed';

import type { AppDispatch, RootState } from '@/Store';
import { setFontScale } from '@/Store/slices/themeSlice';
import { MAX_FONT_SCALE, MIN_FONT_SCALE, nextFontScale } from './fontScaleScope';

import { useT } from '@/I18n';
import { atoms } from '@/Theme/styleAtoms';
/* -------------------------------------------------------------------------- */
/*  FontSizeControl — control A− / A+ del tamaño de letra de los               */
/*  cuestionarios. Ajusta `theme.fontScale` (persistido: se recuerda entre     */
/*  sesiones y aplica a TODOS los cuestionarios a la vez). Usa GSText directo  */
/*  (no el Text común) para que el propio control no cambie de tamaño.         */
/* -------------------------------------------------------------------------- */

/* Fuera del componente A PROPÓSITO: definido dentro, React ve un tipo de
 * componente nuevo en cada render y desmonta el botón entero —perdiendo su
 * estado de pulsación— cada vez que cambia la escala de letra. */
const StepButton = ({ label, enabled, onPress, big }: { label: string; enabled: boolean; onPress: () => void; big?: boolean }) => (
  <Pressable onPress={onPress} disabled={!enabled} hitSlop={8}>
    <Center
      w={38}
      h={30}
      borderRadius={10}
      borderWidth={1.5}
      borderColor={enabled ? '$primary300' : '$borderLight200'}
      bg={enabled ? '$primary50' : '$white'}>
      <GSText
        size={big ? 'md' : 'xs'}
        style={{ fontWeight: '700', color: enabled ? '#C2410C' : '#B8B2A7' }}>
        {label}
      </GSText>
    </Center>
  </Pressable>
);

export default function FontSizeControl() {
  const t = useT();
  const dispatch = useDispatch<AppDispatch>();
  const fontScale = useSelector((state: RootState) => state.theme.fontScale);

  const canShrink = fontScale > MIN_FONT_SCALE + 0.01;
  const canGrow = fontScale < MAX_FONT_SCALE - 0.01;
  const pct = Math.round(fontScale * 100);

  return (
    <HStack
      alignItems="center"
      justifyContent="space-between"
      px="$3"
      py="$2"
      borderRadius={14}
      borderWidth={1}
      borderColor="$borderLight100"
      bg="$white">
      <HStack space="xs" alignItems="center">
        <GSText size="xs" style={atoms.fontWeight700Color5B554C}>
          Aa
        </GSText>
        <GSText size="2xs" style={atoms.colorA89F93}>
          
          {t.components.tamanoLetra}
        </GSText>
      </HStack>
      <HStack space="sm" alignItems="center">
        <StepButton label="A−" enabled={canShrink} onPress={() => dispatch(setFontScale(nextFontScale(fontScale, -1)))} />
        <Box minWidth={44} alignItems="center">
          <GSText size="xs" style={{ fontWeight: '700', color: '#5B554C', fontVariant: ['tabular-nums'] }}>
            {pct}%
          </GSText>
        </Box>
        <StepButton label="A+" enabled={canGrow} onPress={() => dispatch(setFontScale(nextFontScale(fontScale, 1)))} big />
      </HStack>
    </HStack>
  );
}
