import React, { useEffect, useRef } from 'react';
import { Animated, Easing, LayoutChangeEvent, View } from 'react-native';
import { Box, HStack, Text } from '@gluestack-ui/themed';

import { useT } from '@/I18n';
interface Props {
  /** Estaciones alcanzadas para el oído activo (0..4). */
  progress: number;
  stationLabels: string[]; // ['1000 Hz', '2000 Hz', '4000 Hz', '500 Hz'] o nombres amigos
  doneFlags: boolean[]; // por estación
  chugging: boolean;
  celebrate: boolean;
  /**
   * Refuerzo visual DEL ESTÍMULO (vapor, notas, faro encendido) mientras suena
   * el tono. SOLO para la fase de práctica/condicionamiento: en la prueba real
   * no debe haber ninguna señal visual ligada al estímulo o el niño respondería
   * a la vista y no al oído (invalidaría el umbral).
   */
  stimulusVisual?: boolean;
  /** Balanceo sutil continuo para mantener la atención sin dar pistas (prueba). */
  idle?: boolean;
}

const STATION_PCT = [0.16, 0.38, 0.6, 0.82];
const ANIMAL_FRIENDS = ['🐰', '🐻', '🦊', '🐱'];
const ANIMAL_NAMES = ['Conejito', 'Osito', 'Zorrito', 'Lúa'];

/* --------------------------------- Rueda ---------------------------------- */

const Wheel = ({ size, spin }: { size: number; spin: Animated.AnimatedInterpolation<string> }) => (
  <Animated.View
    style={{
      width: size,
      height: size,
      borderRadius: size / 2,
      backgroundColor: '#2C3E50',
      borderWidth: 2.5,
      borderColor: '#1A252F',
      transform: [{ rotate: spin }],
      alignItems: 'center',
      justifyContent: 'center',
    }}>
    <View style={{ width: size * 0.6, height: 2, backgroundColor: '#BDC3C7', position: 'absolute' }} />
    <View style={{ width: 2, height: size * 0.6, backgroundColor: '#BDC3C7', position: 'absolute' }} />
    <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#E74C3C' }} />
  </Animated.View>
);

/* ------------------------- vapor de la chimenea ---------------------------- */

const SteamPuff = ({
  active,
  delay,
  left,
  size,
}: {
  active: boolean;
  delay: number;
  left: number;
  size: number;
}) => {
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

  const translateY = v.interpolate({ inputRange: [0, 1], outputRange: [0, -70] });
  const translateX = v.interpolate({ inputRange: [0, 1], outputRange: [0, 18] });
  const scale = v.interpolate({ inputRange: [0, 1], outputRange: [0.6, 2.2] });
  const opacity = v.interpolate({ inputRange: [0, 0.1, 0.7, 1], outputRange: [0, 1, 0.85, 0] });

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        bottom: 60,
        left,
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: '#FFFFFF',
        borderWidth: 1.5,
        borderColor: 'rgba(180, 200, 220, 0.7)',
        opacity,
        transform: [{ translateY }, { translateX }, { scale }],
      }}
    />
  );
};

/* -------------------- notas musicales del silbido (práctica) --------------- */

const FloatingNote = ({
  active,
  delay,
  left,
  emoji,
}: {
  active: boolean;
  delay: number;
  left: number;
  emoji: string;
}) => {
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

  const translateY = v.interpolate({ inputRange: [0, 1], outputRange: [0, -50] });
  const translateX = v.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 10, -5] });
  const opacity = v.interpolate({ inputRange: [0, 0.1, 0.8, 1], outputRange: [0, 1, 0.85, 0] });
  const scale = v.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.35] });

  return (
    <Animated.View
      pointerEvents="none"
      style={{ position: 'absolute', bottom: 66, left, opacity, transform: [{ translateY }, { translateX }, { scale }] }}>
      <Text fontSize={17}>{emoji}</Text>
    </Animated.View>
  );
};

/* ----------------- muñeco que se ilumina (refuerzo al acierto) ------------- */

const GlowMascot = ({ visible }: { visible: boolean }) => {
  const t = useT();
  const pop = useRef(new Animated.Value(0)).current;
  const rot = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let rayLoop: Animated.CompositeAnimation | null = null;
    let pulseLoop: Animated.CompositeAnimation | null = null;
    if (visible) {
      pop.setValue(0);
      Animated.spring(pop, { toValue: 1, friction: 3.5, tension: 100, useNativeDriver: true }).start();
      rot.setValue(0);
      rayLoop = Animated.loop(
        Animated.timing(rot, { toValue: 1, duration: 2400, easing: Easing.linear, useNativeDriver: true }),
      );
      rayLoop.start();
      pulse.setValue(0);
      pulseLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1, duration: 350, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 0, duration: 350, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        ]),
      );
      pulseLoop.start();
    } else {
      pop.setValue(0);
    }
    return () => {
      rayLoop?.stop();
      pulseLoop?.stop();
    };
  }, [visible, pop, rot, pulse]);

  if (!visible) return null;

  const spin = rot.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const glowScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.22] });

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: 14,
        left: 0,
        right: 0,
        alignItems: 'center',
        zIndex: 10,
        transform: [{ scale: pop }],
      }}>
      <View style={{ width: 100, height: 100, alignItems: 'center', justifyContent: 'center' }}>
        {/* rayos giratorios */}
        <Animated.View
          style={{ position: 'absolute', width: 100, height: 100, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: spin }] }}>
          {[0, 45, 90, 135].map(deg => (
            <View
              key={deg}
              style={{
                position: 'absolute',
                width: 100,
                height: 8,
                borderRadius: 4,
                backgroundColor: '#FFE57F',
                opacity: 0.9,
                transform: [{ rotate: `${deg}deg` }],
              }}
            />
          ))}
        </Animated.View>
        {/* halo que "se enciende" */}
        <Animated.View
          style={{
            position: 'absolute',
            width: 72,
            height: 72,
            borderRadius: 36,
            backgroundColor: '#FFD54F',
            opacity: 0.95,
            transform: [{ scale: glowScale }],
          }}
        />
        <View
          style={{
            width: 58,
            height: 58,
            borderRadius: 29,
            backgroundColor: '#FFF9C4',
            borderWidth: 3,
            borderColor: '#FFA000',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Text fontSize={32}>🐱</Text>
        </View>
      </View>
      <Box bg="#FFF9C4" px="$3" py="$1" borderRadius={12} mt={-6} borderWidth={2} borderColor="#FFA000" shadowColor="#000" shadowOpacity={0.1} shadowRadius={4} elevation={3}>
        <Text fontSize={13} fontWeight="$bold" color="#B78103">
          
          {t.components.genial}
        </Text>
      </Box>
    </Animated.View>
  );
};

/* ------------------------------ lluvia de confeti --------------------------- */

const CONFETTI = ['🎉', '⭐', '🎊', '✨', '🎈', '🌟', '🎫', '💫', '💖'];

const ConfettiPiece = ({
  visible,
  index,
}: {
  visible: boolean;
  index: number;
}) => {
  const v = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      v.setValue(0);
      Animated.sequence([
        Animated.delay(index * 80),
        Animated.timing(v, { toValue: 1, duration: 1300, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      ]).start();
    } else {
      v.setValue(0);
    }
  }, [visible, index, v]);

  if (!visible) return null;

  const leftPct = 4 + ((index * 12) % 92);
  const translateY = v.interpolate({ inputRange: [0, 1], outputRange: [-20, 180] });
  const rotate = v.interpolate({ inputRange: [0, 1], outputRange: ['0deg', index % 2 ? '360deg' : '-360deg'] });
  const opacity = v.interpolate({ inputRange: [0, 0.08, 0.8, 1], outputRange: [0, 1, 1, 0] });

  return (
    <Animated.View
      pointerEvents="none"
      style={{ position: 'absolute', top: 0, left: `${leftPct}%`, zIndex: 9, opacity, transform: [{ translateY }, { rotate }] }}>
      <Text fontSize={16 + ((index * 2) % 6)}>{CONFETTI[index % CONFETTI.length]}</Text>
    </Animated.View>
  );
};

/* ------------------------------ Escena del tren --------------------------- */

export default function TrainScene({
  progress,
  stationLabels,
  doneFlags,
  chugging,
  celebrate,
  stimulusVisual = false,
  idle = false,
}: Props) {
  const width = useRef(0);
  const trainX = useRef(new Animated.Value(0)).current;
  const wheel = useRef(new Animated.Value(0)).current;
  const bob = useRef(new Animated.Value(0)).current;

  const targetIdx = Math.min(3, progress);

  const moveTo = (w: number) => {
    Animated.timing(trainX, {
      toValue: 6 + targetIdx * 22 > 0 ? (0.06 + targetIdx * 0.22) * w : 0,
      duration: 1400,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };

  const onLayout = (e: LayoutChangeEvent) => {
    width.current = e.nativeEvent.layout.width;
    moveTo(width.current);
  };

  useEffect(() => {
    if (width.current) moveTo(width.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetIdx]);

  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;
    if (chugging) {
      wheel.setValue(0);
      loop = Animated.loop(
        Animated.timing(wheel, { toValue: 1, duration: 550, easing: Easing.linear, useNativeDriver: true }),
      );
      loop.start();
    }
    return () => loop?.stop();
  }, [chugging, wheel]);

  // Balanceo de espera: movimiento continuo sutil para mantener el foco
  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;
    if (idle) {
      bob.setValue(0);
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(bob, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(bob, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        ]),
      );
      loop.start();
    } else {
      bob.setValue(0);
    }
    return () => loop?.stop();
  }, [idle, bob]);

  const spin = wheel.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const bobY = bob.interpolate({ inputRange: [0, 1], outputRange: [0, -3] });

  // Vapor: activo durante el estímulo de práctica o al avanzar
  const steamActive = stimulusVisual || chugging;

  return (
    <Box h={225} borderRadius={22} borderWidth={2} borderColor="#BEE3F8" style={{ overflow: 'hidden' }} onLayout={onLayout}>
      {/* cielo + suelo */}
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '54%', backgroundColor: '#E0F2FE' }} />
      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '46%', backgroundColor: '#DCFCE7' }} />

      {/* sol brillante y nubes alegres */}
      <View style={{ position: 'absolute', top: 12, right: 20, width: 38, height: 38, borderRadius: 19, backgroundColor: '#FDE047', borderWidth: 2, borderColor: '#FACC15' }} />
      <View style={{ position: 'absolute', top: 18, left: '12%', width: 56, height: 20, borderRadius: 14, backgroundColor: '#FFFFFF', opacity: 0.9 }} />
      <View style={{ position: 'absolute', top: 32, left: '46%', width: 48, height: 16, borderRadius: 12, backgroundColor: '#FFFFFF', opacity: 0.75 }} />

      {/* colinas verdes */}
      <View style={{ position: 'absolute', bottom: '42%', left: -35, width: 240, height: 130, borderRadius: 120, backgroundColor: '#BBF7D0', opacity: 0.8 }} />
      <View style={{ position: 'absolute', bottom: '42%', right: -45, width: 280, height: 150, borderRadius: 140, backgroundColor: '#86EFAC', opacity: 0.6 }} />

      {/* estaciones con los animales amigos */}
      {STATION_PCT.map((pct, i) => {
        const isDone = doneFlags[i];
        return (
          <View key={i} style={{ position: 'absolute', bottom: 38, left: `${pct * 100}%`, alignItems: 'center', marginLeft: -18, zIndex: 2 }}>
            {/* Animal amigo esperando en la parada o ya recogido */}
            <View style={{ alignItems: 'center', marginBottom: 2 }}>
              <Text style={{ fontSize: isDone ? 14 : 22, opacity: isDone ? 0.35 : 1 }}>
                {ANIMAL_FRIENDS[i]}
              </Text>
            </View>

            {/* caseta de la estación */}
            <View
              style={{
                width: 34,
                height: 26,
                borderRadius: 6,
                backgroundColor: isDone ? '#86EFAC' : '#FEF3C7',
                borderWidth: 2,
                borderColor: isDone ? '#22C55E' : '#F59E0B',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <View style={{ position: 'absolute', top: -9, left: -4, right: -4, height: 9, backgroundColor: isDone ? '#15803D' : '#D97706', borderTopLeftRadius: 5, borderTopRightRadius: 5 }} />
              <Text fontSize={9} fontWeight="$bold" color={isDone ? '#14532D' : '#78350F'}>
                {isDone ? '✓' : i + 1}
              </Text>
            </View>

            {/* Etiqueta de la parada */}
            <Box bg="rgba(255,255,255,0.9)" px="$1.5" py="$0.5" borderRadius={6} mt="$1" borderWidth={1} borderColor="#E2E8F0">
              <Text fontSize={8} fontWeight="$bold" color="#1E293B">
                {stationLabels[i] ?? ANIMAL_NAMES[i]}
              </Text>
            </Box>
          </View>
        );
      })}

      {/* vía del tren */}
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 30, height: 6, backgroundColor: '#64748B' }} />
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 24, height: 6, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 6 }}>
        {Array.from({ length: 18 }).map((_, i) => (
          <View key={i} style={{ width: 5, height: 6, backgroundColor: '#854D0E', borderRadius: 1 }} />
        ))}
      </View>

      {/* TREN MÁGICO */}
      <Animated.View style={{ position: 'absolute', bottom: 30, left: 0, zIndex: 5, transform: [{ translateX: trainX }, { translateY: bobY }] }}>
        <HStack alignItems="flex-end">
          {/* coche de pasajeros (recoge a los amigos completados) */}
          <View style={{ marginRight: 3 }}>
            <View style={{ position: 'absolute', left: -2, right: -2, top: -6, height: 7, borderRadius: 4, backgroundColor: '#047857' }} />
            <HStack
              style={{
                width: 86,
                height: 42,
                borderRadius: 9,
                backgroundColor: '#10B981',
                borderWidth: 2.5,
                borderColor: '#047857',
                alignItems: 'center',
                justifyContent: 'space-around',
                paddingHorizontal: 4,
              }}>
              {ANIMAL_FRIENDS.map((p, i) => (
                <Box
                  key={i}
                  style={{
                    width: 17,
                    height: 19,
                    borderRadius: 4,
                    backgroundColor: doneFlags[i] ? '#FEF08A' : '#E2E8F0',
                    borderWidth: 1,
                    borderColor: doneFlags[i] ? '#CA8A04' : '#94A3B8',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                  <Text fontSize={doneFlags[i] ? 11 : 8}>{doneFlags[i] ? p : '·'}</Text>
                </Box>
              ))}
            </HStack>
            <HStack style={{ width: 68, justifyContent: 'space-around', alignSelf: 'center', marginTop: 3 }}>
              <Wheel size={17} spin={spin} />
              <Wheel size={17} spin={spin} />
            </HStack>
          </View>

          <View style={{ width: 7, height: 5, backgroundColor: '#334155', marginBottom: 15 }} />

          {/* locomotora */}
          <View style={{ position: 'relative' }}>
            {/* caldera */}
            <View
              style={{
                position: 'absolute',
                bottom: 14,
                left: 32,
                width: 68,
                height: 32,
                borderTopLeftRadius: 7,
                borderBottomLeftRadius: 7,
                borderTopRightRadius: 16,
                borderBottomRightRadius: 16,
                backgroundColor: '#0284C7',
                borderWidth: 2.5,
                borderColor: '#0369A1',
              }}
            />
            {/* chimenea */}
            <View style={{ position: 'absolute', bottom: 44, left: 36, width: 14, height: 18, borderRadius: 4, backgroundColor: '#0369A1', borderWidth: 2, borderColor: '#075985' }} />
            
            {/* vapor animado de la chimenea */}
            <SteamPuff active={steamActive} delay={0} left={29} size={28} />
            <SteamPuff active={steamActive} delay={300} left={39} size={22} />
            <SteamPuff active={steamActive} delay={600} left={33} size={17} />

            {/* notas musicales: SOLO refuerzo visual del estímulo en práctica */}
            <FloatingNote active={stimulusVisual} delay={0} left={54} emoji="🎵" />
            <FloatingNote active={stimulusVisual} delay={400} left={68} emoji="✨" />

            {/* domo dorado */}
            <View style={{ position: 'absolute', bottom: 44, left: 60, width: 13, height: 10, borderTopLeftRadius: 6, borderTopRightRadius: 6, backgroundColor: '#F59E0B', borderWidth: 2, borderColor: '#D97706' }} />

            {/* haz del faro encendido durante el estímulo en la práctica */}
            {stimulusVisual ? (
              <View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  bottom: 19,
                  left: 102,
                  width: 32,
                  height: 16,
                  borderTopRightRadius: 12,
                  borderBottomRightRadius: 12,
                  backgroundColor: '#FEF08A',
                  opacity: 0.9,
                }}
              />
            ) : null}

            {/* faro */}
            <View
              style={{
                position: 'absolute',
                bottom: 21,
                left: 94,
                width: 9,
                height: 12,
                borderRadius: 4,
                backgroundColor: stimulusVisual ? '#FACC15' : '#FDE047',
                borderWidth: 1.5,
                borderColor: '#1E293B',
              }}
            />

            {/* cabina con maquinista */}
            <View
              style={{
                width: 38,
                height: 52,
                borderTopLeftRadius: 8,
                borderTopRightRadius: 8,
                borderBottomLeftRadius: 4,
                borderBottomRightRadius: 4,
                backgroundColor: '#EF4444',
                borderWidth: 2.5,
                borderColor: '#B91C1C',
                zIndex: 2,
              }}>
              <View
                style={{
                  width: 20,
                  height: 18,
                  borderRadius: 5,
                  backgroundColor: '#E0F2FE',
                  borderWidth: 1.5,
                  borderColor: '#B91C1C',
                  alignSelf: 'center',
                  marginTop: 8,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <Text fontSize={11}>🐱</Text>
              </View>
            </View>

            {/* ruedas de la locomotora */}
            <HStack style={{ width: 104, alignItems: 'flex-end', marginTop: 3, paddingLeft: 32 }} space="xs">
              <Wheel size={24} spin={spin} />
              <Wheel size={24} spin={spin} />
              <View style={{ marginBottom: 3 }}>
                <Wheel size={16} spin={spin} />
              </View>
            </HStack>
          </View>
        </HStack>
      </Animated.View>

      {/* recompensa: Lúa iluminada + lluvia de confeti al acierto */}
      <GlowMascot visible={celebrate} />
      {Array.from({ length: 9 }).map((_, i) => (
        <ConfettiPiece key={i} visible={celebrate} index={i} />
      ))}
    </Box>
  );
}
