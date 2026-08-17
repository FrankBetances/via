import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { HStack } from '@gluestack-ui/themed';
import { Text } from '@/Components/Common';
import CategoryBadgeIcon, { CategoryType } from './CategoryBadgeIcon';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface Props {
  category: CategoryType;
  label: string;
  count: number;
  color: string;
  softColor: string;
  isActive: boolean;
  onPress: () => void;
}

const SPRING = { damping: 15, stiffness: 200 };

export default function CategoryFilterChip({
  category,
  label,
  count,
  color,
  softColor,
  isActive,
  onPress,
}: Props) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.96, SPRING);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, SPRING);
  };

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[
        styles.chip,
        isActive ? styles.activeChip : styles.inactiveChip,
        animatedStyle,
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected: isActive }}
      accessibilityLabel={`Filtro ${label}, ${count} pruebas`}>
      <HStack alignItems="center" space="xs" style={styles.content}>
        {/* Icono vectorial */}
        <CategoryBadgeIcon category={category} size={20} isActive={isActive} />

        {/* Texto de la categoría con contador */}
        <Text
          size="sm"
          weight={isActive ? 'bold' : 'semiBold'}
          style={[
            styles.label,
            { color: isActive ? '#2B2620' : '#475569' },
          ]}>
          {label}{' '}
          <Text
            size="sm"
            weight={isActive ? 'bold' : 'medium'}
            style={{ color: isActive ? '#FF7F00' : '#64748B' }}>
            ({count})
          </Text>
        </Text>
      </HStack>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderRadius: 24,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginRight: 10,
  },
  activeChip: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#FF7F00',
    shadowColor: '#FF7F00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
    elevation: 4,
  },
  inactiveChip: {
    backgroundColor: 'rgba(235, 230, 220, 0.75)',
    borderWidth: 1,
    borderColor: 'rgba(215, 208, 196, 0.6)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 0.5,
  },
  content: {
    alignItems: 'center',
  },
  label: {
    fontSize: 14,
    marginLeft: 6,
  },
});
