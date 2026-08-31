import React, { useEffect, useRef } from 'react';
import { Animated, Pressable } from 'react-native';
import { Center, HStack, Icon } from '@gluestack-ui/themed';
import { Check, X } from 'lucide-react-native';
import { Text } from '@/Components/Common';
import { atoms } from '@/Theme/styleAtoms';

/* -------------------------------------------------------------------------- */
/*  YesNoAnswer — respuesta Sí/No de los cuestionarios, en formato grande y    */
/*  táctil (una pregunta por pantalla). Rebota al seleccionar y colorea según  */
/*  el «tono» clínico de cada opción:                                          */
/*   · autism-tea: ambas neutras (primary) — el riesgo depende del ítem.       */
/*   · PSQ (SAHS): Sí = síntoma presente (warning) · No = ausente (success).   */
/* -------------------------------------------------------------------------- */

export type AnswerTone = 'primary' | 'success' | 'warning';

const TONE_BG: Record<AnswerTone, string> = {
  primary: '$primary500',
  success: '$success600',
  warning: '$warning700',
};

interface AnswerButtonProps {
  label: string;
  icon: typeof Check;
  selected: boolean;
  tone: AnswerTone;
  onPress: () => void;
}

const AnswerButton = ({ label, icon, selected, tone, onPress }: AnswerButtonProps) => {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!selected) return;
    Animated.sequence([
      Animated.spring(scale, { toValue: 1.06, speed: 40, bounciness: 9, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, speed: 40, bounciness: 9, useNativeDriver: true }),
    ]).start();
  }, [selected, scale]);

  const bg = TONE_BG[tone];

  return (
    <Pressable style={atoms.flex1} onPress={onPress}>
      <Animated.View style={{ transform: [{ scale }] }}>
        <Center
          py="$4"
          borderRadius={18}
          bg={selected ? bg : '$white'}
          borderWidth={2}
          borderColor={selected ? bg : '$borderLight200'}>
          <Center w={34} h={34} borderRadius="$full" bg={selected ? 'rgba(255,255,255,0.25)' : '$backgroundLight50'}>
            <Icon as={icon} size="sm" color={selected ? '$white' : '$textLight400'} />
          </Center>
          <Text size="lg" weight="bold" color={selected ? '$white' : '$textLight500'} mt="$1">
            {label}
          </Text>
        </Center>
      </Animated.View>
    </Pressable>
  );
};

interface Props {
  value: boolean | null;
  onAnswer: (value: boolean) => void;
  /** Tono de cada opción (por defecto neutro `primary`). */
  yesTone?: AnswerTone;
  noTone?: AnswerTone;
}

export default function YesNoAnswer({ value, onAnswer, yesTone = 'primary', noTone = 'primary' }: Props) {
  return (
    <HStack space="md">
      <AnswerButton label="Sí" icon={Check} selected={value === true} tone={yesTone} onPress={() => onAnswer(true)} />
      <AnswerButton label="No" icon={X} selected={value === false} tone={noTone} onPress={() => onAnswer(false)} />
    </HStack>
  );
}
