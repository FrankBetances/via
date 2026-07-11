import React, { useEffect } from 'react';
import { Pressable } from 'react-native';
import { Box, Card, Center, HStack, VStack } from '@gluestack-ui/themed';
import type { LucideIcon } from 'lucide-react-native';
import { Baby, Clock } from 'lucide-react-native';
import Animated, {
  FadeInDown,
  ZoomIn,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { Text } from '@/Components/Common';
import ModuleIllustration from './ModuleIllustration';

/* -------------------------------------------------------------------------- */
/*  ModuleCardItem — tarjeta animada de módulo clínico.                        */
/*                                                                             */
/*  Identidad visual: icono lucide sobre medallón en el color del módulo +     */
/*  escena SVG temática (ModuleIllustration) alusiva a la prueba.              */
/*                                                                             */
/*  Movimiento (reanimated, todo en el hilo de UI):                            */
/*   · entrada escalonada por índice (FadeInDown con muelle)                   */
/*   · escala de feedback al pulsar (pressIn/pressOut)                         */
/*   · al seleccionar: elevación + leve zoom de la tarjeta, "pop" del badge    */
/*     numerado y báscula del medallón                                         */
/* -------------------------------------------------------------------------- */

export interface ModuleCardData {
  id: string;
  title: string;
  description: string;
  duration: string;
  ages: string;
  icon: LucideIcon;
  tag: string; // etiqueta corta de dominio clínico
  color: string; // acento (medallón/borde/chip/badge)
  soft: string; // fondo suave de la ilustración
}

interface Props {
  module: ModuleCardData;
  /** Índice de la tarjeta en la parrilla; escalona la animación de entrada. */
  index: number;
  /** Posición 1-based dentro de la selección (null = no seleccionada). */
  order: number | null;
  onToggle: (id: string) => void;
}

const SPRING = { damping: 14, stiffness: 180 };

export default function ModuleCardItem({ module: m, index, order, onToggle }: Props) {
  const isSelected = order !== null;
  const IconGlyph = m.icon;

  const pressed = useSharedValue(0);
  const sel = useSharedValue(isSelected ? 1 : 0);

  useEffect(() => {
    sel.value = withSpring(isSelected ? 1 : 0, SPRING);
  }, [isSelected, sel]);

  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(sel.value, [0, 1], [0, -4]) },
      { scale: 1 - 0.04 * pressed.value + 0.02 * sel.value },
    ],
  }));

  const medallionStyle = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${interpolate(sel.value, [0, 1], [0, -8])}deg` },
      { scale: 1 + 0.08 * sel.value },
    ],
  }));

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 70)
        .springify()
        .damping(16)
        .stiffness(140)}
      style={{ width: '48.5%' }}>
      <Pressable
        onPress={() => onToggle(m.id)}
        onPressIn={() => {
          pressed.value = withSpring(1, SPRING);
        }}
        onPressOut={() => {
          pressed.value = withSpring(0, SPRING);
        }}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: isSelected }}
        accessibilityLabel={`${m.title}, ${m.duration}, ${m.ages}`}>
        <Animated.View style={cardStyle}>
          <Card
            bgColor="$white"
            borderRadius={20}
            borderWidth={2}
            p="$0"
            style={{
              overflow: 'hidden',
              minHeight: 216,
              borderColor: isSelected ? m.color : '#F0ECE4',
              backgroundColor: '#FFFFFF',
              shadowColor: isSelected ? m.color : '#000000',
              shadowOpacity: isSelected ? 0.25 : 0.05,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 6 },
              elevation: isSelected ? 6 : 2,
            }}>
            {/* ----- ilustración superior ----- */}
            <Box h={96} style={{ backgroundColor: m.soft, overflow: 'hidden' }}>
              <ModuleIllustration moduleId={m.id} color={m.color} />

              {/* medallón con el icono del módulo */}
              <Animated.View
                style={[
                  {
                    position: 'absolute',
                    left: 14,
                    top: 22,
                    width: 52,
                    height: 52,
                    borderRadius: 18,
                    backgroundColor: m.color,
                    alignItems: 'center',
                    justifyContent: 'center',
                    shadowColor: m.color,
                    shadowOpacity: 0.35,
                    shadowRadius: 8,
                    shadowOffset: { width: 0, height: 4 },
                    elevation: 4,
                  },
                  medallionStyle,
                ]}>
                <IconGlyph size={26} color="#FFFFFF" strokeWidth={2.2} />
              </Animated.View>

              {/* etiqueta de dominio */}
              <Box
                position="absolute"
                px="$2"
                py="$0.5"
                borderRadius="$full"
                style={{ left: 10, bottom: 8, backgroundColor: '#FFFFFF' }}>
                <Text size="2xs" weight="bold" style={{ color: m.color, letterSpacing: 0.6, fontSize: 9 }}>
                  {m.tag}
                </Text>
              </Box>

              {/* check de selección (con orden dentro de la batería) */}
              <Center
                w={26}
                h={26}
                borderRadius="$full"
                borderWidth={isSelected ? 0 : 1.5}
                borderColor="$borderLight300"
                position="absolute"
                style={{ right: 10, bottom: 8, backgroundColor: isSelected ? m.color : '#FFFFFF' }}>
                {isSelected ? (
                  <Animated.View entering={ZoomIn.springify().damping(12).stiffness(220)}>
                    <Text size="2xs" weight="bold" color="$white" style={{ fontVariant: ['tabular-nums'] }}>
                      {order}
                    </Text>
                  </Animated.View>
                ) : null}
              </Center>
            </Box>

            {/* ----- cuerpo ----- */}
            <VStack p="$3.5" style={{ flex: 1 }}>
              <Text size="sm" weight="bold" color="$textLight900" style={{ lineHeight: 18 }}>
                {m.title}
              </Text>
              <Text size="2xs" color="$textLight500" mt="$1" style={{ lineHeight: 15, flex: 1 }}>
                {m.description}
              </Text>
              <HStack space="xs" mt="$2.5" flexWrap="wrap" style={{ gap: 5 }}>
                <HStack space="xs" alignItems="center" px="$2" py="$0.5" borderRadius="$full" style={{ backgroundColor: m.soft, gap: 3 }}>
                  <Clock size={10} color={m.color} strokeWidth={2.5} />
                  <Text size="2xs" weight="bold" style={{ color: m.color, fontVariant: ['tabular-nums'], fontSize: 9 }}>
                    {m.duration}
                  </Text>
                </HStack>
                <HStack space="xs" alignItems="center" px="$2" py="$0.5" borderRadius="$full" borderWidth={1} borderColor="$borderLight200" bg="$white" style={{ gap: 3 }}>
                  <Baby size={10} color="#8A8577" strokeWidth={2.5} />
                  <Text size="2xs" weight="semiBold" color="$textLight500" style={{ fontSize: 9 }}>
                    {m.ages}
                  </Text>
                </HStack>
              </HStack>
            </VStack>

            {/* barra de acento inferior */}
            <Box h={4} style={{ backgroundColor: isSelected ? m.color : m.soft }} />
          </Card>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}
