import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, View } from 'react-native';
import { Center, Icon } from '@gluestack-ui/themed';
import { Bell } from 'lucide-react-native';

import { Text } from '@/Components/Common';

interface Props {
  onPress: () => void;
  disabled?: boolean;
  /**
   * Refuerzo visual del estímulo: el botón "se enciende" y emite ondas
   * mientras suena el tono. SOLO debe usarse en la fase de práctica
   * (condicionamiento): en la prueba real el botón debe verse SIEMPRE igual
   * para que el niño responda al sonido y no al color (validez del umbral).
   */
  highlight?: boolean;
  label: string;
  sublabel: string;
}

/** Onda expansiva tipo sónar alrededor del botón (mientras `active`). */
const SonarRing = ({ active, delay }: { active: boolean; delay: number }) => {
  const v = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;
    if (active) {
      v.setValue(0);
      loop = Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(v, { toValue: 1, duration: 1000, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(v, { toValue: 0, duration: 0, useNativeDriver: true }),
        ]),
      );
      loop.start();
    } else {
      v.setValue(0);
    }
    return () => loop?.stop();
  }, [active, delay, v]);

  if (!active) return null;

  const scale = v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.25] });
  const opacity = v.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.55, 0] });

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        borderRadius: 28,
        borderWidth: 3,
        borderColor: '#2A9D6B',
        opacity,
        transform: [{ scale }],
      }}
    />
  );
};

/**
 * Botón grande del silbato. Respira suavemente SIEMPRE (atractivo constante,
 * sin información sobre el estímulo); con `highlight` añade el estado
 * encendido + ondas para el condicionamiento de la práctica.
 */
export default function WhistleButton({ onPress, disabled = false, highlight = false, label, sublabel }: Props) {
  const breath = useRef(new Animated.Value(0)).current;
  const ring = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(breath, { toValue: 0, duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [breath]);

  // Campanilla que se agita cuando el botón está encendido (práctica).
  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;
    if (highlight) {
      ring.setValue(0);
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(ring, { toValue: 1, duration: 120, easing: Easing.linear, useNativeDriver: true }),
          Animated.timing(ring, { toValue: -1, duration: 240, easing: Easing.linear, useNativeDriver: true }),
          Animated.timing(ring, { toValue: 0, duration: 120, easing: Easing.linear, useNativeDriver: true }),
        ]),
      );
      loop.start();
    } else {
      ring.setValue(0);
    }
    return () => loop?.stop();
  }, [highlight, ring]);

  const scale = breath.interpolate({ inputRange: [0, 1], outputRange: [1, 1.025] });
  const wobble = ring.interpolate({ inputRange: [-1, 1], outputRange: ['-18deg', '18deg'] });

  return (
    <Pressable onPress={onPress} disabled={disabled}>
      <View>
        <SonarRing active={highlight && !disabled} delay={0} />
        <SonarRing active={highlight && !disabled} delay={500} />
        <Animated.View style={{ transform: [{ scale }] }}>
          <Center
            py="$6"
            borderRadius={28}
            bg={disabled ? '$backgroundLight300' : highlight ? '$success600' : '$primary600'}
            borderWidth={3}
            borderColor={disabled ? '$backgroundLight300' : highlight ? '$success400' : '$primary400'}>
            <Animated.View style={{ transform: [{ rotate: wobble }] }}>
              <Icon as={Bell} size="xl" color="$white" />
            </Animated.View>
            <Text size="lg" weight="bold" color="$white" mt="$1">
              {label}
            </Text>
            <Text size="xs" color="$white" style={{ opacity: 0.9 }}>
              {sublabel}
            </Text>
          </Center>
        </Animated.View>
      </View>
    </Pressable>
  );
}
