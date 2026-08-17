import React, { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Center, HStack, VStack } from '@gluestack-ui/themed';
import type { LucideIcon } from 'lucide-react-native';
import { Clock, Compass, Sparkles, User } from 'lucide-react-native';
import Animated, {
  FadeInDown,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  ZoomIn,
} from 'react-native-reanimated';

import { Text } from '@/Components/Common';
import ModuleIllustration from './ModuleIllustration';
import { CategoryType } from './CategoryBadgeIcon';

/* -------------------------------------------------------------------------- */
/*  ModuleCardItem — Tarjeta clínica vertical en rejilla según el render       */
/*  aprobado para tableta (azulejo superior, micro-gráfica central, metadatos) */
/* -------------------------------------------------------------------------- */

export interface ModuleCardData {
  id: string;
  title: string;
  subtitle?: string;
  description: string;
  duration: string;
  durationMinutes: number;
  ages: string;
  icon: LucideIcon;
  category: CategoryType;
  tag: string;
  color: string;
  soft: string;
  badgeParam?: string;
  isCalibrated?: boolean;
}

interface Props {
  module: ModuleCardData;
  index: number;
  order: number | null;
  onToggle: (id: string) => void;
  cardWidth?: number | string;
}

const SPRING = { damping: 14, stiffness: 180 };

export default function ModuleCardItem({
  module: m,
  index,
  order,
  onToggle,
  cardWidth = '100%',
}: Props) {
  const isSelected = order !== null;
  const IconGlyph = m.icon;

  const pressed = useSharedValue(0);
  const sel = useSharedValue(isSelected ? 1 : 0);

  useEffect(() => {
    sel.value = withSpring(isSelected ? 1 : 0, SPRING);
  }, [isSelected, sel]);

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - 0.02 * pressed.value }],
    shadowOpacity: interpolate(sel.value, [0, 1], [0.06, 0.18]),
  }));

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 40)
        .springify()
        .damping(16)
        .stiffness(150)}
      style={{ width: cardWidth as any }}>
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
        accessibilityLabel={`${m.title}. ${m.description} Duración ${m.duration}. Edades ${m.ages}.`}>
        <Animated.View
          style={[
            styles.card,
            {
              backgroundColor: isSelected ? m.soft : '#FFFFFF',
              borderColor: isSelected ? m.color : '#EDE7DC',
              borderLeftColor: m.color,
              borderLeftWidth: isSelected ? 3 : 4,
              shadowColor: isSelected ? m.color : '#0F172A',
            },
            cardStyle,
          ]}>
          {/* Fila Superior: Azulejo de Icono + Número de Selección */}
          <HStack alignItems="center" justifyContent="space-between" mb="$2.5">
            {/* Azulejo temático */}
            <Center
              w={44}
              h={44}
              borderRadius={14}
              style={{
                backgroundColor: isSelected ? '#FFFFFF' : m.soft,
                borderWidth: 1,
                borderColor: isSelected ? m.color : 'rgba(0,0,0,0.04)',
                shadowColor: isSelected ? m.color : 'transparent',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: isSelected ? 0.2 : 0,
                shadowRadius: 4,
                elevation: isSelected ? 2 : 0,
              }}>
              <IconGlyph size={22} color={m.color} strokeWidth={2.2} />
            </Center>

            {/* Círculo de orden secuencial (#1, #2...) o estado vacío */}
            {isSelected ? (
              <Animated.View entering={ZoomIn.springify().damping(12).stiffness(220)}>
                <Center
                  w={30}
                  h={30}
                  borderRadius={15}
                  style={{
                    backgroundColor: '#FFFFFF',
                    borderWidth: 2,
                    borderColor: m.color,
                    shadowColor: m.color,
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.25,
                    shadowRadius: 4,
                    elevation: 3,
                  }}>
                  <Text
                    size="xs"
                    weight="bold"
                    style={{
                      color: m.color,
                      fontSize: 13,
                      fontVariant: ['tabular-nums'],
                    }}>
                    {order}
                  </Text>
                </Center>
              </Animated.View>
            ) : (
              <Center
                w={26}
                h={26}
                borderRadius={13}
                style={{
                  backgroundColor: 'rgba(0,0,0,0.03)',
                  borderWidth: 1.5,
                  borderColor: '#E2DDD5',
                }}
              />
            )}
          </HStack>

          {/* Título y Subtítulo / Descripción */}
          <VStack space="xs" style={{ minHeight: 64 }}>
            <Text
              size="sm"
              weight="bold"
              color="$textLight900"
              style={{
                fontSize: 15,
                lineHeight: 19,
                letterSpacing: -0.2,
              }}
              numberOfLines={2}>
              {m.title}
            </Text>
            {m.subtitle ? (
              <Text
                size="2xs"
                weight="semiBold"
                style={{ color: m.color, fontSize: 11, lineHeight: 14 }}>
                {m.subtitle}
              </Text>
            ) : null}
            <Text
              size="2xs"
              color="$textLight600"
              style={{ fontSize: 11, lineHeight: 15 }}
              numberOfLines={2}>
              {m.description}
            </Text>
          </VStack>

          {/* Micro-Gráfica Vectorial Central */}
          <View style={styles.graphicContainer}>
            <ModuleIllustration moduleId={m.id} color={m.color} softColor={m.soft} />
          </View>

          {/* Fila Inferior de Metadatos */}
          <VStack space="xs" mt="$1">
            {/* Duración y Rango de Edad */}
            <HStack alignItems="center" space="md">
              <HStack alignItems="center" space="xs">
                <Clock size={12} color="#64748B" />
                <Text
                  size="2xs"
                  weight="medium"
                  style={{ color: '#475569', fontSize: 11, fontVariant: ['tabular-nums'] }}>
                  {m.duration}
                </Text>
              </HStack>
              <HStack alignItems="center" space="xs">
                <User size={12} color="#64748B" />
                <Text
                  size="2xs"
                  weight="medium"
                  style={{ color: '#475569', fontSize: 11 }}>
                  {m.ages}
                </Text>
              </HStack>
            </HStack>

            {/* Badge de Parámetro o Calibración */}
            <HStack alignItems="center" space="xs" mt="$0.5">
              {m.badgeParam ? (
                <HStack
                  alignItems="center"
                  space="xs"
                  px="$2"
                  py="$0.5"
                  borderRadius={8}
                  style={{
                    backgroundColor: isSelected ? '#FFFFFF' : 'rgba(0,0,0,0.05)',
                    borderWidth: 0.8,
                    borderColor: isSelected ? m.color : 'rgba(0,0,0,0.08)',
                  }}>
                  <Sparkles size={10} color={m.color} />
                  <Text
                    size="2xs"
                    weight="bold"
                    style={{ color: m.color, fontSize: 10 }}>
                    {m.badgeParam}
                  </Text>
                </HStack>
              ) : (
                <HStack alignItems="center" space="xs">
                  <Compass size={12} color="#0D9488" />
                  <Text
                    size="2xs"
                    weight="semiBold"
                    style={{ color: '#0D9488', fontSize: 11 }}>
                    Calibración OK
                  </Text>
                </HStack>
              )}
            </HStack>
          </VStack>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    borderWidth: 1.5,
    padding: 14,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 2,
    marginBottom: 14,
  },
  graphicContainer: {
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 6,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    overflow: 'hidden',
  },
});
