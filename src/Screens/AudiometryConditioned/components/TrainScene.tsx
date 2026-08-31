import React, { useEffect, useRef } from 'react';
import { Animated, Easing, LayoutChangeEvent, StyleSheet, View } from 'react-native';
import { Box, HStack, Text } from '@gluestack-ui/themed';

import { useT } from '@/I18n';
import { atoms } from '@/Theme/styleAtoms';

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

/* -------------------------------------------------------------------------- */
/*  El decorado, con nombre. Antes iba en línea: cada fotograma de la          */
/*  animación reconstruía el cielo, las colinas y las cuarenta y una piezas    */
/*  del tren. Lo que depende del render —la posición del vapor, el giro de     */
/*  las ruedas, la parada iluminada— sigue en línea, que es donde tiene que    */
/*  estar; lo demás se crea una sola vez.                                      */
/* -------------------------------------------------------------------------- */

const styles = StyleSheet.create({
  /* rueda */
  wheel: {
    backgroundColor: '#2C3E50',
    borderWidth: 2.5,
    borderColor: '#1A252F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  wheelSpoke: { height: 2, backgroundColor: '#BDC3C7', position: 'absolute' },
  wheelSpokeUpright: { width: 2, backgroundColor: '#BDC3C7', position: 'absolute' },
  wheelHub: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#E74C3C' },

  /* vapor y notas */
  steamPuff: {
    position: 'absolute',
    bottom: 60,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: 'rgba(180, 200, 220, 0.7)',
  },
  floatingNote: { position: 'absolute', bottom: 66 },

  /* recompensa iluminada */
  glowWrap: { position: 'absolute', top: 14, left: 0, right: 0, alignItems: 'center', zIndex: 10 },
  glowBox: { width: 100, height: 100, alignItems: 'center', justifyContent: 'center' },
  glowRayLayer: {
    position: 'absolute',
    width: 100,
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowRay: {
    position: 'absolute',
    width: 100,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFE57F',
    opacity: 0.9,
  },
  glowHalo: {
    position: 'absolute',
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#FFD54F',
    opacity: 0.95,
  },
  glowFace: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#FFF9C4',
    borderWidth: 3,
    borderColor: '#FFA000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confetti: { position: 'absolute', top: 0, zIndex: 9 },

  /* paisaje */
  sky: { position: 'absolute', top: 0, left: 0, right: 0, height: '54%', backgroundColor: '#E0F2FE' },
  ground: { position: 'absolute', bottom: 0, left: 0, right: 0, height: '46%', backgroundColor: '#DCFCE7' },
  sun: {
    position: 'absolute',
    top: 12,
    right: 20,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FDE047',
    borderWidth: 2,
    borderColor: '#FACC15',
  },
  cloudNear: {
    position: 'absolute',
    top: 18,
    left: '12%',
    width: 56,
    height: 20,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    opacity: 0.9,
  },
  cloudFar: {
    position: 'absolute',
    top: 32,
    left: '46%',
    width: 48,
    height: 16,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    opacity: 0.75,
  },
  hillLeft: {
    position: 'absolute',
    bottom: '42%',
    left: -35,
    width: 240,
    height: 130,
    borderRadius: 120,
    backgroundColor: '#BBF7D0',
    opacity: 0.8,
  },
  hillRight: {
    position: 'absolute',
    bottom: '42%',
    right: -45,
    width: 280,
    height: 150,
    borderRadius: 140,
    backgroundColor: '#86EFAC',
    opacity: 0.6,
  },

  /* estaciones */
  station: { position: 'absolute', bottom: 38, alignItems: 'center', marginLeft: -18, zIndex: 2 },
  friendWaiting: { fontSize: 22, opacity: 1 },
  friendBoarded: { fontSize: 14, opacity: 0.35 },
  hut: {
    width: 34,
    height: 26,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hutDone: { backgroundColor: '#86EFAC', borderColor: '#22C55E' },
  hutPending: { backgroundColor: '#FEF3C7', borderColor: '#F59E0B' },
  hutRoof: {
    position: 'absolute',
    top: -9,
    left: -4,
    right: -4,
    height: 9,
    borderTopLeftRadius: 5,
    borderTopRightRadius: 5,
  },
  hutRoofDone: { backgroundColor: '#15803D' },
  hutRoofPending: { backgroundColor: '#D97706' },

  /* vía */
  rail: { position: 'absolute', left: 0, right: 0, bottom: 30, height: 6, backgroundColor: '#64748B' },
  sleepers: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 24,
    height: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
  },
  sleeper: { width: 5, height: 6, backgroundColor: '#854D0E', borderRadius: 1 },

  /* tren */
  train: { position: 'absolute', bottom: 30, left: 0, zIndex: 5 },
  carriageRoof: {
    position: 'absolute',
    left: -2,
    right: -2,
    top: -6,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#047857',
  },
  carriage: {
    width: 86,
    height: 42,
    borderRadius: 9,
    backgroundColor: '#10B981',
    borderWidth: 2.5,
    borderColor: '#047857',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 4,
  },
  seat: {
    width: 17,
    height: 19,
    borderRadius: 4,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  seatTaken: { backgroundColor: '#FEF08A', borderColor: '#CA8A04' },
  seatEmpty: { backgroundColor: '#E2E8F0', borderColor: '#94A3B8' },
  carriageAxles: { width: 68, justifyContent: 'space-around', alignSelf: 'center', marginTop: 3 },
  coupling: { width: 7, height: 5, backgroundColor: '#334155', marginBottom: 15 },
  boiler: {
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
  },
  chimney: {
    position: 'absolute',
    bottom: 44,
    left: 36,
    width: 14,
    height: 18,
    borderRadius: 4,
    backgroundColor: '#0369A1',
    borderWidth: 2,
    borderColor: '#075985',
  },
  dome: {
    position: 'absolute',
    bottom: 44,
    left: 60,
    width: 13,
    height: 10,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    backgroundColor: '#F59E0B',
    borderWidth: 2,
    borderColor: '#D97706',
  },
  headlampBeam: {
    position: 'absolute',
    bottom: 19,
    left: 102,
    width: 32,
    height: 16,
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
    backgroundColor: '#FEF08A',
    opacity: 0.9,
  },
  headlamp: {
    position: 'absolute',
    bottom: 21,
    left: 94,
    width: 9,
    height: 12,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#1E293B',
  },
  headlampLit: { backgroundColor: '#FACC15' },
  headlampDim: { backgroundColor: '#FDE047' },
  cab: {
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
  },
  cabWindow: {
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
  },
  locoAxles: { width: 104, alignItems: 'flex-end', marginTop: 3, paddingLeft: 32 },
});

const STATION_PCT = [0.16, 0.38, 0.6, 0.82];
const ANIMAL_FRIENDS = ['🐰', '🐻', '🦊', '🐱'];
const ANIMAL_NAMES = ['Conejito', 'Osito', 'Zorrito', 'Lúa'];

/* --------------------------------- Rueda ---------------------------------- */

const Wheel = ({ size, spin }: { size: number; spin: Animated.AnimatedInterpolation<string> }) => (
  <Animated.View
    style={[styles.wheel, { width: size, height: size, borderRadius: size / 2, transform: [{ rotate: spin }] }]}>
    <View style={[styles.wheelSpoke, { width: size * 0.6 }]} />
    <View style={[styles.wheelSpokeUpright, { height: size * 0.6 }]} />
    <View style={styles.wheelHub} />
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
      style={[
        styles.steamPuff,
        { left, width: size, height: size, borderRadius: size / 2, opacity, transform: [{ translateY }, { translateX }, { scale }] },
      ]}
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
      style={[styles.floatingNote, { left, opacity, transform: [{ translateY }, { translateX }, { scale }] }]}>
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
      style={[styles.glowWrap, { transform: [{ scale: pop }] }]}>
      <View style={styles.glowBox}>
        {/* rayos giratorios */}
        <Animated.View
          style={[styles.glowRayLayer, { transform: [{ rotate: spin }] }]}>
          {[0, 45, 90, 135].map(deg => (
            <View
              key={deg}
              style={[styles.glowRay, { transform: [{ rotate: `${deg}deg` }] }]}
            />
          ))}
        </Animated.View>
        {/* halo que "se enciende" */}
        <Animated.View
          style={[styles.glowHalo, { transform: [{ scale: glowScale }] }]}
        />
        <View
          style={styles.glowFace}>
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
      style={[styles.confetti, { left: `${leftPct}%`, opacity, transform: [{ translateY }, { rotate }] }]}>
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
    <Box h={225} borderRadius={22} borderWidth={2} borderColor="#BEE3F8" style={atoms.overflowHidden} onLayout={onLayout}>
      {/* cielo + suelo */}
      <View style={styles.sky} />
      <View style={styles.ground} />

      {/* sol brillante y nubes alegres */}
      <View style={styles.sun} />
      <View style={styles.cloudNear} />
      <View style={styles.cloudFar} />

      {/* colinas verdes */}
      <View style={styles.hillLeft} />
      <View style={styles.hillRight} />

      {/* estaciones con los animales amigos */}
      {STATION_PCT.map((pct, i) => {
        const isDone = doneFlags[i];
        return (
          <View key={i} style={[styles.station, { left: `${pct * 100}%` }]}>
            {/* Animal amigo esperando en la parada o ya recogido */}
            <View style={atoms.alignItemsCenterMarginBottom2}>
              <Text style={isDone ? styles.friendBoarded : styles.friendWaiting}>
                {ANIMAL_FRIENDS[i]}
              </Text>
            </View>

            {/* caseta de la estación */}
            <View
              style={[styles.hut, isDone ? styles.hutDone : styles.hutPending]}>
              <View style={[styles.hutRoof, isDone ? styles.hutRoofDone : styles.hutRoofPending]} />
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
      <View style={styles.rail} />
      <View style={styles.sleepers}>
        {Array.from({ length: 18 }).map((_, i) => (
          <View key={i} style={styles.sleeper} />
        ))}
      </View>

      {/* TREN MÁGICO */}
      <Animated.View style={[styles.train, { transform: [{ translateX: trainX }, { translateY: bobY }] }]}>
        <HStack alignItems="flex-end">
          {/* coche de pasajeros (recoge a los amigos completados) */}
          <View style={atoms.marginRight3}>
            <View style={styles.carriageRoof} />
            <HStack
              style={styles.carriage}>
              {ANIMAL_FRIENDS.map((p, i) => (
                <Box
                  key={i}
                  style={[styles.seat, doneFlags[i] ? styles.seatTaken : styles.seatEmpty]}>
                  <Text fontSize={doneFlags[i] ? 11 : 8}>{doneFlags[i] ? p : '·'}</Text>
                </Box>
              ))}
            </HStack>
            <HStack style={styles.carriageAxles}>
              <Wheel size={17} spin={spin} />
              <Wheel size={17} spin={spin} />
            </HStack>
          </View>

          <View style={styles.coupling} />

          {/* locomotora */}
          <View style={atoms.positionRelative}>
            {/* caldera */}
            <View
              style={styles.boiler}
            />
            {/* chimenea */}
            <View style={styles.chimney} />
            
            {/* vapor animado de la chimenea */}
            <SteamPuff active={steamActive} delay={0} left={29} size={28} />
            <SteamPuff active={steamActive} delay={300} left={39} size={22} />
            <SteamPuff active={steamActive} delay={600} left={33} size={17} />

            {/* notas musicales: SOLO refuerzo visual del estímulo en práctica */}
            <FloatingNote active={stimulusVisual} delay={0} left={54} emoji="🎵" />
            <FloatingNote active={stimulusVisual} delay={400} left={68} emoji="✨" />

            {/* domo dorado */}
            <View style={styles.dome} />

            {/* haz del faro encendido durante el estímulo en la práctica */}
            {stimulusVisual ? (
              <View
                pointerEvents="none"
                style={styles.headlampBeam}
              />
            ) : null}

            {/* faro */}
            <View
              style={[styles.headlamp, stimulusVisual ? styles.headlampLit : styles.headlampDim]}
            />

            {/* cabina con maquinista */}
            <View
              style={styles.cab}>
              <View
                style={styles.cabWindow}>
                <Text fontSize={11}>🐱</Text>
              </View>
            </View>

            {/* ruedas de la locomotora */}
            <HStack style={styles.locoAxles} space="xs">
              <Wheel size={24} spin={spin} />
              <Wheel size={24} spin={spin} />
              <View style={atoms.marginBottom3}>
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
