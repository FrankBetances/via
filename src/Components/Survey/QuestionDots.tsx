import React, { useEffect, useRef } from 'react';
import { Pressable, ScrollView } from 'react-native';
import { Center, HStack } from '@gluestack-ui/themed';
import { Text } from '@/Components/Common';

/* -------------------------------------------------------------------------- */
/*  QuestionDots — mapa navegable del cuestionario. Un chip numerado por       */
/*  pregunta; tocar uno salta a esa pregunta. Estados:                         */
/*   · actual     → primario con anillo                                        */
/*   · respondida → verde (o ámbar si la respuesta es de riesgo)               */
/*   · pendiente  → contorno gris                                              */
/*  Autodesplaza el scroll para mantener visible la pregunta actual.           */
/* -------------------------------------------------------------------------- */

export interface QuestionDotState {
  answered: boolean;
  /** Respuesta marcada como de riesgo (se pinta en ámbar). */
  flagged?: boolean;
}

interface Props {
  states: QuestionDotState[];
  current: number;
  onJump: (index: number) => void;
}

const DOT = 32;
const GAP = 6;

export default function QuestionDots({ states, current, onJump }: Props) {
  const ref = useRef<ScrollView>(null);

  useEffect(() => {
    // Centra aproximadamente la pregunta actual (3 chips de margen).
    ref.current?.scrollTo({ x: Math.max(0, (current - 3) * (DOT + GAP)), animated: true });
  }, [current]);

  return (
    <ScrollView ref={ref} horizontal showsHorizontalScrollIndicator={false}>
      <HStack space="xs" alignItems="center" py="$1">
        {states.map((s, i) => {
          const active = i === current;
          const bg = active ? '$primary500' : s.answered ? (s.flagged ? '$warning500' : '$success600') : '$white';
          const fg = active || s.answered ? '$white' : '$textLight400';
          return (
            <Pressable key={i} onPress={() => onJump(i)} hitSlop={4}>
              <Center
                w={DOT}
                h={DOT}
                borderRadius="$full"
                bg={bg}
                borderWidth={active ? 2 : s.answered ? 0 : 1.5}
                borderColor={active ? '$primary200' : '$borderLight200'}>
                <Text size="2xs" weight="bold" color={fg} style={{ fontVariant: ['tabular-nums'] }}>
                  {i + 1}
                </Text>
              </Center>
            </Pressable>
          );
        })}
      </HStack>
    </ScrollView>
  );
}
