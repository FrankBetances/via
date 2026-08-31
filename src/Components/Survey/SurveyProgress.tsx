import React, { useEffect, useRef } from 'react';
import { Animated } from 'react-native';
import { Box, HStack } from '@gluestack-ui/themed';
import { Text } from '@/Components/Common';
import { atoms } from '@/Theme/styleAtoms';

/* -------------------------------------------------------------------------- */
/*  SurveyProgress — barra de progreso animada de los cuestionarios            */
/*  (cribados de autismo y SAHS). Muestra la posición («Pregunta 7 de 20»),    */
/*  el porcentaje completado y anima el relleno con cada respuesta.            */
/* -------------------------------------------------------------------------- */

interface Props {
  /** Preguntas ya respondidas. */
  answered: number;
  /** Total de preguntas del cuestionario. */
  total: number;
  /** Etiqueta de posición, p. ej. «Pregunta 7 de 20». */
  label: string;
}

export default function SurveyProgress({ answered, total, label }: Props) {
  const anim = useRef(new Animated.Value(0)).current;
  const complete = answered >= total;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: total > 0 ? answered / total : 0,
      duration: 350,
      useNativeDriver: false, // anima `width` en %
    }).start();
  }, [answered, total, anim]);

  const pct = total > 0 ? Math.round((answered / total) * 100) : 0;

  return (
    <Box>
      <HStack justifyContent="space-between" alignItems="center" mb="$1.5">
        <Text size="2xs" weight="bold" color="$textLight500" style={atoms.letterSpacing04TextTransformUppercase}>
          {label}
        </Text>
        <Text size="2xs" weight="bold" color={complete ? '$success700' : '$primary700'} style={atoms.tabularNums}>
          {answered}/{total} · {pct}%
        </Text>
      </HStack>
      <Box h={8} borderRadius="$full" bg="$backgroundLight100" style={atoms.overflowHidden}>
        <Animated.View
          style={[
            atoms.fillBar,
            complete ? atoms.backgroundColor2A7948 : atoms.backgroundColorFF7F00,
            { width: anim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) },
          ]}
        />
      </Box>
    </Box>
  );
}
