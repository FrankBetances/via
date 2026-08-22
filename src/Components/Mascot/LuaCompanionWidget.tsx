// ============================================================================
// VIA+ · Widget de Acompañamiento Clínico de Lúa (Fusión Enfoques A + C)
// ============================================================================
import React, { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import {
  Box,
  VStack,
  HStack,
  Center,
  Card,
  Icon,
} from '@gluestack-ui/themed';
// El `Text` del proyecto, no el de Gluestack: aporta `weight` y aplica el
// `fontScale` con que el clínico agranda la letra durante la prueba.
import { Text } from '@/Components/Common';
import { Sparkles, Wind, Award, Heart, CheckCircle2, Ear } from 'lucide-react-native';
import { CatPixel } from './LuaPixel';
import { LuaEmotion, LuaBadgeInfo } from '@/Lua';

export interface LuaCompanionWidgetProps {
  emotion?: LuaEmotion;
  isBreathing?: boolean;
  activeBadge?: LuaBadgeInfo | null;
  message?: string;
  size?: 'compact' | 'normal' | 'large';
  showBadge?: boolean;
  connected?: boolean;
  level?: number;
}

const EMOTION_META: Record<
  LuaEmotion,
  { label: string; bg: string; icon: any; color: string; cue: string }
> = {
  [LuaEmotion.Joy]: {
    label: 'Alegría',
    bg: '$amber50',
    icon: Sparkles,
    color: '$amber500',
    cue: '¡Excelente esfuerzo!',
  },
  [LuaEmotion.Love]: {
    label: 'Cariño',
    bg: '$rose50',
    icon: Heart,
    color: '$rose500',
    cue: 'Te escucho con atención',
  },
  [LuaEmotion.Gratitude]: {
    label: 'Gratitud',
    bg: '$primary50',
    icon: Heart,
    color: '$primary500',
    cue: '¡Gracias por participar!',
  },
  [LuaEmotion.Tranquility]: {
    label: 'Calma',
    bg: '$cyan50',
    icon: Wind,
    color: '$cyan600',
    cue: 'Respira hondo y despacio',
  },
  [LuaEmotion.Hope]: {
    label: 'Esperanza',
    bg: '$purple50',
    icon: Sparkles,
    color: '$purple500',
    cue: '¡Vamos a por ello!',
  },
  [LuaEmotion.Pride]: {
    label: 'Orgullo',
    bg: '$emerald50',
    icon: Award,
    color: '$emerald600',
    cue: '¡Gran logro conseguido!',
  },
  [LuaEmotion.Inspire]: {
    label: 'Inspiración',
    bg: '$indigo50',
    icon: Sparkles,
    color: '$indigo500',
    cue: 'Sostén tu voz firme',
  },
  [LuaEmotion.Fun]: {
    label: 'Diversión',
    bg: '$amber50',
    icon: Sparkles,
    color: '$amber600',
    cue: '¡Qué buen juego!',
  },
  [LuaEmotion.Attentive]: {
    label: 'Escucha atenta',
    bg: '$backgroundLight50',
    icon: Ear,
    // Neutro de pizarra: la escucha atenta no compite con el estímulo. Se usa
    // la escala `textLight` del tema, no un `blueGray` que aquí no existe.
    color: '$textLight600',
    cue: 'Lúa escucha contigo…',
  },
};

export const LuaCompanionWidget: React.FC<LuaCompanionWidgetProps> = ({
  emotion = LuaEmotion.Tranquility,
  isBreathing = false,
  activeBadge,
  message,
  size = 'normal',
  showBadge = true,
  connected = false,
  level,
}) => {
  const breathAnim = useRef(new Animated.Value(1)).current;
  const meta = EMOTION_META[emotion] ?? EMOTION_META[LuaEmotion.Tranquility];

  // Animación de respiración suave o guiada
  useEffect(() => {
    let anim: Animated.CompositeAnimation | null = null;
    if (isBreathing) {
      // Respiración pautada: 2s inhalar, 2s exhalar
      anim = Animated.loop(
        Animated.sequence([
          Animated.timing(breathAnim, {
            toValue: 1.15,
            duration: 2000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(breathAnim, {
            toValue: 1.0,
            duration: 2000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      );
      anim.start();
    } else {
      // Pulso orgánico sutil
      anim = Animated.loop(
        Animated.sequence([
          Animated.timing(breathAnim, {
            toValue: 1.04,
            duration: 2500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(breathAnim, {
            toValue: 1.0,
            duration: 2500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      );
      anim.start();
    }

    return () => {
      anim?.stop();
    };
  }, [isBreathing, breathAnim]);

  const catPxSize = size === 'compact' ? 44 : size === 'large' ? 80 : 60;

  return (
    <Card
      bg={meta.bg}
      borderRadius={20}
      p={size === 'compact' ? '$2.5' : '$3.5'}
      borderWidth={1.5}
      borderColor={meta.color}>
      <HStack alignItems="center" space="md">
        {/* Avatar de Lúa con respiración */}
        <Center
          w={catPxSize + 16}
          h={catPxSize + 16}
          borderRadius="$full"
          bg="$white"
          shadowColor="$black"
          shadowOpacity={0.06}
          shadowRadius={8}
          elevation={2}>
          <Animated.View style={{ transform: [{ scale: breathAnim }] }}>
            <CatPixel size={catPxSize} pose={size === 'compact' ? 'head' : 'sit'} />
          </Animated.View>
        </Center>

        {/* Información de estado, mensaje y retroalimentación */}
        <VStack flex={1} space="xs">
          <HStack alignItems="center" justifyContent="space-between">
            <HStack alignItems="center" space="xs">
              <Icon as={meta.icon} size="xs" color={meta.color} />
              <Text size="2xs" weight="bold" color={meta.color} style={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Lúa · {isBreathing ? 'Respiración Guiada' : meta.label}
              </Text>
            </HStack>

            {connected ? (
              <HStack alignItems="center" space="xs" bg="$emerald100" px="$2" py="$0.5" borderRadius="$full">
                <Icon as={CheckCircle2} size="2xs" color="$emerald700" />
                <Text size="2xs" weight="bold" color="$emerald800">
                  ESP32 BLE
                </Text>
              </HStack>
            ) : level ? (
              <Box bg="$primary100" px="$2" py="$0.5" borderRadius="$full">
                <Text size="2xs" weight="bold" color="$primary800">
                  Nivel {level}/12
                </Text>
              </Box>
            ) : null}
          </HStack>

          <Text size="xs" weight="medium" color="$textLight800" style={{ lineHeight: 16 }}>
            {message || meta.cue}
          </Text>

          {/* Insignia activa si procede */}
          {showBadge && activeBadge ? (
            <HStack alignItems="center" space="xs" mt="$1" bg="$white" px="$2" py="$1" borderRadius={8} alignSelf="flex-start">
              <Icon as={Award} size="xs" color="$amber500" />
              <Text size="2xs" weight="bold" color="$textLight700">
                {activeBadge.name}
              </Text>
            </HStack>
          ) : null}
        </VStack>
      </HStack>
    </Card>
  );
};
