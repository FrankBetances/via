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

import { useT } from '@/I18n';
import { atoms } from '@/Theme/styleAtoms';
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
  /**
   * Alto de la banda del dibujo, calculado desde el ancho REAL de la tarjeta
   * (`computeGridLayout`). Sin él la banda medía 52 px en cualquier pantalla y
   * el dibujo se quedaba a 160 px de ancho dentro de ella: a una columna, casi
   * la mitad de la tarjeta era hueco.
   */
  illustrationHeight?: number;
}

const SPRING = { damping: 14, stiffness: 180 };

export default function ModuleCardItem({
  module: m,
  index,
  order,
  onToggle,
  cardWidth = '100%',
  illustrationHeight,
}: Props) {
  const t = useT();
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
        accessibilityLabel={t.components.duracionEdades(m.title, m.description, m.duration, m.ages)}>
        <Animated.View
          style={[
            styles.card,
            isSelected ? styles.cardSelected : styles.cardIdle,
            isSelected ? { backgroundColor: m.soft, borderColor: m.color, shadowColor: m.color } : null,
            { borderLeftColor: m.color },
            cardStyle,
          ]}>
          {/* Fila Superior: Azulejo de Icono + Número de Selección */}
          <HStack alignItems="center" justifyContent="space-between" mb="$2.5">
            {/* Azulejo temático */}
            <Center
              w={44}
              h={44}
              borderRadius={14}
              style={[
                styles.iconTile,
                isSelected ? styles.iconTileSelected : styles.iconTileIdle,
                isSelected ? { borderColor: m.color, shadowColor: m.color } : { backgroundColor: m.soft },
              ]}>
              <IconGlyph size={22} color={m.color} strokeWidth={2.2} />
            </Center>

            {/* Círculo de orden secuencial (#1, #2...) o estado vacío */}
            {isSelected ? (
              <Animated.View entering={ZoomIn.springify().damping(12).stiffness(220)}>
                <Center
                  w={30}
                  h={30}
                  borderRadius={15}
                  style={[styles.orderBadge, { borderColor: m.color, shadowColor: m.color }]}>
                  <Text
                    size="xs"
                    weight="bold"
                    style={[atoms.fontSize13, atoms.tabularNums, { color: m.color }]}>
                    {order}
                  </Text>
                </Center>
              </Animated.View>
            ) : (
              <Center
                w={26}
                h={26}
                borderRadius={13}
                style={styles.orderSlot}
              />
            )}
          </HStack>

          {/* Título y Subtítulo / Descripción */}
          <VStack space="xs" style={atoms.minHeight64}>
            <Text
              size="sm"
              weight="bold"
              color="$textLight900"
              style={atoms.fontSize15LineHeight19LetterSpacingNeg02}
              numberOfLines={2}>
              {m.title}
            </Text>
            {m.subtitle ? (
              <Text
                size="2xs"
                weight="semiBold"
                style={[atoms.fontSize11LineHeight14, { color: m.color }]}>
                {m.subtitle}
              </Text>
            ) : null}
            <Text
              size="2xs"
              color="$textLight600"
              style={atoms.fontSize11LineHeight15}
              numberOfLines={2}>
              {m.description}
            </Text>
          </VStack>

          {/* Dibujo temático: ocupa la tarjeta de lado a lado */}
          <View
            style={[
              styles.graphicContainer,
              illustrationHeight ? { height: illustrationHeight } : null,
            ]}>
            <ModuleIllustration
              moduleId={m.id}
              color={m.color}
              softColor={m.soft}
              height={illustrationHeight}
            />
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
                  style={[atoms.color475569FontSize11, atoms.tabularNums]}>
                  {m.duration}
                </Text>
              </HStack>
              <HStack alignItems="center" space="xs">
                <User size={12} color="#64748B" />
                <Text
                  size="2xs"
                  weight="medium"
                  style={atoms.color475569FontSize11}>
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
                  style={[
                    styles.paramChip,
                    isSelected ? styles.paramChipSelected : styles.paramChipIdle,
                    isSelected ? { borderColor: m.color } : null,
                  ]}>
                  <Sparkles size={10} color={m.color} />
                  <Text
                    size="2xs"
                    weight="bold"
                    style={[atoms.fontSize10, { color: m.color }]}>
                    {m.badgeParam}
                  </Text>
                </HStack>
              ) : (
                <HStack alignItems="center" space="xs">
                  <Compass size={12} color="#0D9488" />
                  <Text
                    size="2xs"
                    weight="semiBold"
                    style={atoms.color0D9488FontSize11}>
                    
                    {t.components.calibracionOk}
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
  /* Lo que el estado de selección NO cambia, separado de lo que sí. */
  cardSelected: { borderLeftWidth: 3 },
  cardIdle: { borderLeftWidth: 4, backgroundColor: '#FFFFFF', borderColor: '#EDE7DC', shadowColor: '#0F172A' },
  iconTile: { borderWidth: 1, shadowOffset: { width: 0, height: 2 }, shadowRadius: 4 },
  iconTileSelected: { backgroundColor: '#FFFFFF', shadowOpacity: 0.2, elevation: 2 },
  iconTileIdle: { borderColor: 'rgba(0,0,0,0.04)', shadowColor: 'transparent', shadowOpacity: 0, elevation: 0 },
  paramChipSelected: { backgroundColor: '#FFFFFF' },
  paramChipIdle: { backgroundColor: 'rgba(0,0,0,0.05)', borderColor: 'rgba(0,0,0,0.08)' },
  orderBadge: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  orderSlot: { backgroundColor: 'rgba(0,0,0,0.03)', borderWidth: 1.5, borderColor: '#E2DDD5' },
  paramChip: { borderWidth: 0.8 },
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
    // Suelo para quien no pase alto (tests, usos sueltos): el valor real lo
    // calcula la pantalla desde el ancho de la tarjeta.
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 6,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    overflow: 'hidden',
  },
});
