import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import { Center, HStack, Icon, VStack } from '@gluestack-ui/themed';
import { Bell, Sparkles } from 'lucide-react-native';
import { Text } from '@/Components/Common';
import { atoms } from '@/Theme/styleAtoms';

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
  label?: string;
  sublabel?: string;
}

/** Onda expansiva tipo halo alrededor del botón interactivo (mientras `active`). */
const SonarRing = ({ active, delay }: { active: boolean; delay: number }) => {
  const v = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;
    if (active) {
      v.setValue(0);
      loop = Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(v, { toValue: 1, duration: 1100, easing: Easing.out(Easing.quad), useNativeDriver: true }),
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

  const scale = v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.28] });
  const opacity = v.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.6, 0] });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        styles.pulseRing,
        {
          opacity,
          transform: [{ scale }],
        },
      ]}
    />
  );
};

const styles = StyleSheet.create({
  /* El aro que late alrededor del pulsador mientras suena el estímulo. */
  pulseRing: { borderRadius: 32, borderWidth: 3.5, borderColor: '#10B981' },
});

export default function WhistleButton({
  onPress,
  disabled = false,
  highlight = false,
  label = '¡Toca la pantalla!',
  sublabel = 'Pulsa cuando oigas la música o el silbido',
}: Props) {
  const breath = useRef(new Animated.Value(0)).current;
  const pressScale = useRef(new Animated.Value(1)).current;
  const ring = useRef(new Animated.Value(0)).current;

  // Respiración suave permanente para llamar la atención del niño
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(breath, { toValue: 0, duration: 1200, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [breath]);

  // Campanilla que se agita cuando el botón está encendido (práctica)
  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;
    if (highlight) {
      ring.setValue(0);
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(ring, { toValue: 1, duration: 110, easing: Easing.linear, useNativeDriver: true }),
          Animated.timing(ring, { toValue: -1, duration: 220, easing: Easing.linear, useNativeDriver: true }),
          Animated.timing(ring, { toValue: 0, duration: 110, easing: Easing.linear, useNativeDriver: true }),
        ]),
      );
      loop.start();
    } else {
      ring.setValue(0);
    }
    return () => loop?.stop();
  }, [highlight, ring]);

  const handlePressIn = () => {
    Animated.spring(pressScale, { toValue: 0.94, useNativeDriver: true }).start();
  };

  const handlePressOut = () => {
    Animated.spring(pressScale, { toValue: 1, friction: 3.5, tension: 120, useNativeDriver: true }).start();
  };

  const breathScale = breath.interpolate({ inputRange: [0, 1], outputRange: [1, 1.03] });
  const wobble = ring.interpolate({ inputRange: [-1, 1], outputRange: ['-16deg', '16deg'] });

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      style={atoms.width100Pct}>
      <View style={atoms.positionRelative}>
        <SonarRing active={highlight && !disabled} delay={0} />
        <SonarRing active={highlight && !disabled} delay={550} />

        <Animated.View style={{ transform: [{ scale: pressScale }, { scale: breathScale }] }}>
          <Center
            py="$7"
            px="$4"
            borderRadius={32}
            bg={
              disabled
                ? '$backgroundLight300'
                : highlight
                ? '$success500'
                : '$primary500'
            }
            borderWidth={3.5}
            borderColor={
              disabled
                ? '$backgroundLight400'
                : highlight
                ? '$success300'
                : '$primary300'
            }
            shadowColor={highlight ? '$success700' : '$primary800'}
            shadowOpacity={0.25}
            shadowRadius={12}
            elevation={6}>
            <HStack space="md" alignItems="center">
              <Center
                w={56}
                h={56}
                borderRadius="$full"
                bg={highlight ? '$success600' : '$primary600'}
                borderWidth={2}
                borderColor="$white">
                <Animated.View style={{ transform: [{ rotate: wobble }] }}>
                  <Icon as={highlight ? Sparkles : Bell} size="xl" color="$white" />
                </Animated.View>
              </Center>

              <VStack style={atoms.flex1}>
                <Text size="xl" weight="bold" color="$white" style={atoms.letterSpacing03}>
                  {label}
                </Text>
                <Text size="sm" weight="medium" color="$white" style={atoms.opacity095LineHeight18}>
                  {sublabel}
                </Text>
              </VStack>
            </HStack>
          </Center>
        </Animated.View>
      </View>
    </Pressable>
  );
}
