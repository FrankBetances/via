import React, { useEffect, useRef } from 'react';
import { Animated, Easing, LayoutChangeEvent, View } from 'react-native';
import { Box, HStack, Text } from '@gluestack-ui/themed';

interface Props {
  /** Estaciones alcanzadas para el oído activo (0..4). */
  progress: number;
  stationLabels: string[]; // ['500','1k','2k','4k']
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

/* --------------------------------- Rueda ---------------------------------- */

const Wheel = ({ size, spin }: { size: number; spin: Animated.AnimatedInterpolation<string> }) => (
  <Animated.View
    style={{
      width: size,
      height: size,
      borderRadius: size / 2,
      backgroundColor: '#33414C',
      borderWidth: 2,
      borderColor: '#1F2A33',
      transform: [{ rotate: spin }],
      alignItems: 'center',
      justifyContent: 'center',
    }}>
    <View style={{ width: size * 0.5, height: 2, backgroundColor: '#8A9BA8', position: 'absolute' }} />
    <View style={{ width: 2, height: size * 0.5, backgroundColor: '#8A9BA8', position: 'absolute' }} />
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
          Animated.timing(v, { toValue: 1, duration: 1250, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(v, { toValue: 0, duration: 0, useNativeDriver: true }),
        ]),
      );
      loop.start();
    } else {
      v.setValue(0);
    }
    return () => loop?.stop();
  }, [active, delay, v]);

  // Recorrido alto y crecimiento marcado, con opacidad casi plena la mayor
  // parte del ciclo: las nubes pequeñas y translúcidas de antes apenas se
  // distinguían contra el cielo claro de la escena.
  const translateY = v.interpolate({ inputRange: [0, 1], outputRange: [0, -64] });
  const translateX = v.interpolate({ inputRange: [0, 1], outputRange: [0, 14] });
  const scale = v.interpolate({ inputRange: [0, 1], outputRange: [0.55, 2] });
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
        // Contorno gris suave: da volumen y separa el humo del cielo claro.
        borderWidth: 1.5,
        borderColor: 'rgba(122,144,160,0.55)',
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

  const translateY = v.interpolate({ inputRange: [0, 1], outputRange: [0, -46] });
  const translateX = v.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 8, -4] });
  const opacity = v.interpolate({ inputRange: [0, 0.1, 0.8, 1], outputRange: [0, 1, 0.8, 0] });
  const scale = v.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1.25] });

  return (
    <Animated.View
      pointerEvents="none"
      style={{ position: 'absolute', bottom: 66, left, opacity, transform: [{ translateY }, { translateX }, { scale }] }}>
      <Text fontSize={15}>{emoji}</Text>
    </Animated.View>
  );
};

/* ----------------- muñeco que se ilumina (refuerzo al acierto) ------------- */

const GlowMascot = ({ visible }: { visible: boolean }) => {
  const pop = useRef(new Animated.Value(0)).current;
  const rot = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let rayLoop: Animated.CompositeAnimation | null = null;
    let pulseLoop: Animated.CompositeAnimation | null = null;
    if (visible) {
      pop.setValue(0);
      Animated.spring(pop, { toValue: 1, friction: 4, tension: 90, useNativeDriver: true }).start();
      rot.setValue(0);
      rayLoop = Animated.loop(
        Animated.timing(rot, { toValue: 1, duration: 2600, easing: Easing.linear, useNativeDriver: true }),
      );
      rayLoop.start();
      pulse.setValue(0);
      pulseLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1, duration: 380, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 0, duration: 380, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
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
  const glowScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] });

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: 12,
        left: 0,
        right: 0,
        alignItems: 'center',
        zIndex: 10,
        transform: [{ scale: pop }],
      }}>
      <View style={{ width: 92, height: 92, alignItems: 'center', justifyContent: 'center' }}>
        {/* rayos giratorios */}
        <Animated.View
          style={{ position: 'absolute', width: 92, height: 92, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: spin }] }}>
          {[0, 45, 90, 135].map(deg => (
            <View
              key={deg}
              style={{
                position: 'absolute',
                width: 92,
                height: 7,
                borderRadius: 4,
                backgroundColor: '#FFE28A',
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
            width: 64,
            height: 64,
            borderRadius: 32,
            backgroundColor: '#FFD24A',
            opacity: 0.95,
            transform: [{ scale: glowScale }],
          }}
        />
        <View
          style={{
            width: 52,
            height: 52,
            borderRadius: 26,
            backgroundColor: '#FFF6DC',
            borderWidth: 2.5,
            borderColor: '#F2B705',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Text fontSize={28}>🐻</Text>
        </View>
      </View>
      <Box bg="#FFF6DC" px="$2" py="$0.5" borderRadius={8} mt={-6} borderWidth={1.5} borderColor="#F2B705">
        <Text fontSize={11} fontWeight="$bold" color="#8A5A00">
          ¡BRAVO!
        </Text>
      </Box>
    </Animated.View>
  );
};

/* ------------------------------ lluvia de confeti --------------------------- */

const CONFETTI = ['🎉', '⭐', '🎊', '✨', '🎈', '🌟', '🎫', '💫'];

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
        Animated.delay(index * 90),
        Animated.timing(v, { toValue: 1, duration: 1300, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      ]).start();
    } else {
      v.setValue(0);
    }
  }, [visible, index, v]);

  if (!visible) return null;

  const leftPct = 6 + ((index * 13) % 88);
  const translateY = v.interpolate({ inputRange: [0, 1], outputRange: [-24, 170] });
  const rotate = v.interpolate({ inputRange: [0, 1], outputRange: ['0deg', index % 2 ? '300deg' : '-300deg'] });
  const opacity = v.interpolate({ inputRange: [0, 0.08, 0.8, 1], outputRange: [0, 1, 1, 0] });

  return (
    <Animated.View
      pointerEvents="none"
      style={{ position: 'absolute', top: 0, left: `${leftPct}%`, zIndex: 9, opacity, transform: [{ translateY }, { rotate }] }}>
      <Text fontSize={15 + ((index * 3) % 6)}>{CONFETTI[index % CONFETTI.length]}</Text>
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
      duration: 1500,
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
        Animated.timing(wheel, { toValue: 1, duration: 600, easing: Easing.linear, useNativeDriver: true }),
      );
      loop.start();
    }
    return () => loop?.stop();
  }, [chugging, wheel]);

  // Balanceo de espera: movimiento continuo NO ligado al estímulo (mantiene la
  // mirada del niño en la escena sin dar ninguna pista auditivo-visual).
  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;
    if (idle) {
      bob.setValue(0);
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(bob, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(bob, { toValue: 0, duration: 1500, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        ]),
      );
      loop.start();
    } else {
      bob.setValue(0);
    }
    return () => loop?.stop();
  }, [idle, bob]);

  const spin = wheel.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const bobY = bob.interpolate({ inputRange: [0, 1], outputRange: [0, -2.5] });

  // Vapor: fuerte durante el estímulo (práctica) y también al avanzar (chugging),
  // como parte de la recompensa.
  const steamActive = stimulusVisual || chugging;

  return (
    <Box h={210} borderRadius={18} borderWidth={1.5} borderColor="#DCE7F0" style={{ overflow: 'hidden' }} onLayout={onLayout}>
      {/* cielo + suelo */}
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '53%', backgroundColor: '#CDE6FB' }} />
      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '47%', backgroundColor: '#DBF0DD' }} />
      {/* sol + nubes */}
      <View style={{ position: 'absolute', top: 14, right: 24, width: 34, height: 34, borderRadius: 17, backgroundColor: '#FFD86B' }} />
      <View style={{ position: 'absolute', top: 22, left: '16%', width: 54, height: 18, borderRadius: 12, backgroundColor: '#fff', opacity: 0.85 }} />
      <View style={{ position: 'absolute', top: 36, left: '50%', width: 46, height: 15, borderRadius: 10, backgroundColor: '#fff', opacity: 0.7 }} />
      {/* colinas */}
      <View style={{ position: 'absolute', bottom: '44%', left: -30, width: 220, height: 120, borderRadius: 110, backgroundColor: '#CDEBC8', opacity: 0.8 }} />
      <View style={{ position: 'absolute', bottom: '44%', right: -40, width: 260, height: 140, borderRadius: 130, backgroundColor: '#C2E6BE', opacity: 0.7 }} />

      {/* estaciones */}
      {STATION_PCT.map((pct, i) => (
        <View key={i} style={{ position: 'absolute', bottom: 36, left: `${pct * 100}%`, alignItems: 'center', marginLeft: -16, zIndex: 2 }}>
          {/* bandera */}
          <View style={{ flexDirection: 'row', marginBottom: -1 }}>
            <View style={{ width: 2, height: 14, backgroundColor: '#9C6B3F' }} />
            <View style={{ width: 9, height: 7, backgroundColor: doneFlags[i] ? '#34A853' : '#C0392B' }} />
          </View>
          {/* edificio */}
          <View style={{ width: 30, height: 24, borderRadius: 5, backgroundColor: doneFlags[i] ? '#9BD7AE' : '#E9DFCB', borderWidth: 2, borderColor: '#B98A5E' }}>
            <View style={{ position: 'absolute', top: -9, left: -3, right: -3, height: 9, backgroundColor: '#9C6B3F', borderTopLeftRadius: 4, borderTopRightRadius: 4 }} />
          </View>
          <Box bg="rgba(255,255,255,0.85)" px="$1.5" borderRadius={4} mt="$1">
            <Text fontSize={8} fontWeight="$bold" color="#3A352F">{stationLabels[i]}</Text>
          </Box>
        </View>
      ))}

      {/* vía */}
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 30, height: 6, backgroundColor: '#8A9BA8' }} />
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 24, height: 6, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 6 }}>
        {Array.from({ length: 16 }).map((_, i) => (
          <View key={i} style={{ width: 5, height: 6, backgroundColor: '#7A4F2B' }} />
        ))}
      </View>

      {/* TREN */}
      <Animated.View style={{ position: 'absolute', bottom: 30, left: 0, zIndex: 5, transform: [{ translateX: trainX }, { translateY: bobY }] }}>
        <HStack alignItems="flex-end">
          {/* coche de pasajeros */}
          <View style={{ marginRight: 3 }}>
            <View style={{ position: 'absolute', left: -2, right: -2, top: -5, height: 6, borderRadius: 4, backgroundColor: '#1F6B58' }} />
            <HStack
              style={{ width: 78, height: 38, borderRadius: 7, backgroundColor: '#2E8B74', borderWidth: 2, borderColor: '#1F6B58', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 }}
              space="xs">
              {['🐰', '🐻', '🦊'].map((p, i) => (
                <Box key={i} style={{ width: 14, height: 16, borderRadius: 3, backgroundColor: '#BFE9FF', borderWidth: 1, borderColor: '#1F6B58', alignItems: 'center', justifyContent: 'center' }}>
                  <Text fontSize={9}>{p}</Text>
                </Box>
              ))}
            </HStack>
            <HStack style={{ width: 60, justifyContent: 'space-around', alignSelf: 'center', marginTop: 3 }}>
              <Wheel size={16} spin={spin} />
              <Wheel size={16} spin={spin} />
            </HStack>
          </View>

          <View style={{ width: 7, height: 4, backgroundColor: '#33414C', marginBottom: 14 }} />

          {/* locomotora */}
          <View style={{ position: 'relative' }}>
            {/* caldera */}
            <View style={{ position: 'absolute', bottom: 14, left: 30, width: 64, height: 30, borderTopLeftRadius: 6, borderBottomLeftRadius: 6, borderTopRightRadius: 14, borderBottomRightRadius: 14, backgroundColor: '#34495A', borderWidth: 2, borderColor: '#1F2A33' }} />
            {/* chimenea */}
            <View style={{ position: 'absolute', bottom: 42, left: 34, width: 13, height: 16, borderRadius: 3, backgroundColor: '#33414C', borderWidth: 2, borderColor: '#1F2A33' }} />
            {/* vapor animado de la chimenea */}
            <SteamPuff active={steamActive} delay={0} left={27} size={26} />
            <SteamPuff active={steamActive} delay={320} left={37} size={20} />
            <SteamPuff active={steamActive} delay={640} left={31} size={16} />
            <SteamPuff active={steamActive} delay={960} left={40} size={13} />
            {/* notas del silbido: SOLO refuerzo del estímulo en la práctica */}
            <FloatingNote active={stimulusVisual} delay={0} left={52} emoji="🎵" />
            <FloatingNote active={stimulusVisual} delay={420} left={66} emoji="🎶" />
            {/* domo */}
            <View style={{ position: 'absolute', bottom: 42, left: 56, width: 12, height: 9, borderTopLeftRadius: 6, borderTopRightRadius: 6, backgroundColor: '#C0392B', borderWidth: 2, borderColor: '#8E2A20' }} />
            {/* haz del faro encendido durante el silbido de práctica */}
            {stimulusVisual ? (
              <View
                pointerEvents="none"
                style={{ position: 'absolute', bottom: 18, left: 98, width: 26, height: 14, borderTopRightRadius: 10, borderBottomRightRadius: 10, backgroundColor: '#FFE9A8', opacity: 0.9 }}
              />
            ) : null}
            {/* faro */}
            <View style={{ position: 'absolute', bottom: 20, left: 90, width: 8, height: 10, borderRadius: 3, backgroundColor: stimulusVisual ? '#FFB300' : '#FFD24A', borderWidth: 1.5, borderColor: '#1F2A33' }} />
            {/* cabina */}
            <View style={{ width: 34, height: 48, borderTopLeftRadius: 7, borderTopRightRadius: 7, borderBottomLeftRadius: 4, borderBottomRightRadius: 4, backgroundColor: '#C0392B', borderWidth: 2, borderColor: '#8E2A20', zIndex: 2 }}>
              <View style={{ width: 18, height: 16, borderRadius: 4, backgroundColor: '#BFE9FF', borderWidth: 1.5, borderColor: '#8E2A20', alignSelf: 'center', marginTop: 7 }} />
            </View>
            {/* ruedas */}
            <HStack style={{ width: 96, alignItems: 'flex-end', marginTop: 3, paddingLeft: 30 }} space="xs">
              <Wheel size={22} spin={spin} />
              <Wheel size={22} spin={spin} />
              <View style={{ marginBottom: 3 }}>
                <Wheel size={15} spin={spin} />
              </View>
            </HStack>
          </View>
        </HStack>
      </Animated.View>

      {/* recompensa: muñeco iluminado + lluvia de confeti */}
      <GlowMascot visible={celebrate} />
      {Array.from({ length: 8 }).map((_, i) => (
        <ConfettiPiece key={i} visible={celebrate} index={i} />
      ))}
    </Box>
  );
}
