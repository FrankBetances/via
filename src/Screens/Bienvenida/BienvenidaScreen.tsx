import React, { useEffect, useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  StatusBar,
  Platform,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  cancelAnimation,
  interpolate,
  interpolateColor,
  Easing,
} from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/Navigators/screenTypeNavigator';
import ViaIcon from '@/Components/Common/ViaIcon';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Bienvenida'>;

/* -------------------------------------------------------------------------- */
/*  BienvenidaScreen — "del ruido a la información" contado con partículas:    */
/*  un enjambre desordenado entra por la izquierda (movimiento caótico, gris)  */
/*  y, al atravesar el isotipo VIA+, cada partícula se alinea en una onda      */
/*  senoidal limpia y se tiñe de naranja: la señal ordenada. El CTA continúa   */
/*  a la pantalla de créditos del proyecto.                                    */
/* -------------------------------------------------------------------------- */

const ICON_SIZE = 108;
const RING_DURATION = 2600;
const FIELD_H = 200;
const PARTICLES = 26;
const TRAVEL_MS = 5600;

/* Parámetros deterministas por partícula (generados con un LCG con semilla
   fija: el enjambre es idéntico en cada arranque y no cuesta Math.random en
   cada render). */
interface ParticleSpec {
  delay: number; // ms de entrada escalonada
  duration: number; // ms de viaje completo
  size: number; // diámetro px
  baseY: number; // deriva vertical base (-1..1)
  amp: number; // amplitud del caos (px)
  f1: number; // frecuencias/fases del ruido
  p1: number;
  f2: number;
  p2: number;
}

function buildSpecs(): ParticleSpec[] {
  let seed = 20260704;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  return Array.from({ length: PARTICLES }, (_, i) => ({
    delay: i * (TRAVEL_MS / PARTICLES) + rnd() * 160,
    duration: TRAVEL_MS * (0.88 + rnd() * 0.28),
    size: 4 + Math.round(rnd() * 3),
    baseY: rnd() * 2 - 1,
    amp: 18 + rnd() * 30,
    f1: 6 + rnd() * 9,
    p1: rnd() * Math.PI * 2,
    f2: 14 + rnd() * 14,
    p2: rnd() * Math.PI * 2,
  }));
}

/* ───────────────────────── partícula ────────────────────────────────────── */

function Particle({ spec, width }: { spec: ParticleSpec; width: number }) {
  const prog = useSharedValue(0);

  useEffect(() => {
    prog.value = 0;
    prog.value = withDelay(
      spec.delay,
      withRepeat(withTiming(1, { duration: spec.duration, easing: Easing.linear }), -1, false),
    );
    return () => cancelAnimation(prog);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spec, width]);

  const style = useAnimatedStyle(() => {
    const p = prog.value;
    const x = interpolate(p, [0, 1], [-8, width + 8]);

    // Grado de desorden: 1 antes del logo, 0 después (transición al cruzarlo).
    const disorder = 1 - Math.min(1, Math.max(0, (p - 0.40) / 0.20));

    // Trayectoria caótica (ruido) vs onda senoidal común (información).
    const yChaos =
      spec.baseY * (FIELD_H / 2 - 24) +
      Math.sin(p * spec.f1 + spec.p1) * spec.amp +
      Math.sin(p * spec.f2 + spec.p2) * spec.amp * 0.5;
    const yOrder = Math.sin(p * Math.PI * 2 * 2.4) * 20;
    const y = disorder * yChaos + (1 - disorder) * yOrder;

    const opacity =
      interpolate(p, [0, 0.05, 0.92, 1], [0, 1, 1, 0]) * (0.55 + 0.45 * (1 - disorder));

    return {
      transform: [
        { translateX: x },
        { translateY: y },
        { scale: 0.9 + 0.5 * (1 - disorder) },
      ],
      opacity,
      backgroundColor: interpolateColor(disorder, [0, 1], ['#FF7F00', '#B3A791']),
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.particle,
        { width: spec.size, height: spec.size, borderRadius: spec.size / 2 },
        style,
      ]}
    />
  );
}

/* ───────────────────────── screen ───────────────────────────────────────── */

export default function BienvenidaScreen() {
  const navigation = useNavigation<Nav>();
  const { width: winW } = useWindowDimensions();
  const fieldW = Math.min(winW - 48, 520);
  const specs = useMemo(buildSpecs, []);

  const floatY = useSharedValue(0);
  const ring1 = useSharedValue(0);
  const ring2 = useSharedValue(0);

  useEffect(() => {
    floatY.value = withRepeat(
      withSequence(
        withTiming(-6, { duration: 3000, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 3000, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );

    const makePulse = () =>
      withRepeat(
        withSequence(
          withTiming(1, { duration: RING_DURATION, easing: Easing.out(Easing.ease) }),
          withTiming(0, { duration: 0 }),
        ),
        -1,
        false,
      );
    ring1.value = makePulse();
    ring2.value = withDelay(RING_DURATION / 2, makePulse());

    return () => {
      cancelAnimation(floatY);
      cancelAnimation(ring1);
      cancelAnimation(ring2);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const floatStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: floatY.value }],
  }));
  const ring1Style = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(ring1.value, [0, 1], [0.92, 1.6]) }],
    opacity: interpolate(ring1.value, [0, 1], [0.45, 0]),
  }));
  const ring2Style = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(ring2.value, [0, 1], [0.92, 1.6]) }],
    opacity: interpolate(ring2.value, [0, 1], [0.45, 0]),
  }));

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#F1ECE2" />

      {/* Ambient blobs */}
      <View style={styles.blobTopLeft} pointerEvents="none" />
      <View style={styles.blobBottomRight} pointerEvents="none" />

      {/* Center content */}
      <View style={styles.center}>
        {/* Wordmark */}
        <View style={styles.wordmark}>
          <Text style={styles.wordmarkVia}>VIA</Text>
          <Text style={styles.wordmarkPlus}>+</Text>
        </View>

        {/* ── Campo de partículas: caos → VIA+ → onda ordenada ── */}
        <View style={[styles.field, { width: fieldW }]}>
          <View style={styles.fieldCenterLine} pointerEvents="none">
            {specs.map((spec, i) => (
              <Particle key={i} spec={spec} width={fieldW} />
            ))}
          </View>

          <Animated.View style={[styles.iconWrapper, floatStyle]}>
            <Animated.View style={[styles.ring, ring1Style]} />
            <Animated.View style={[styles.ring, ring2Style]} />
            <ViaIcon size={ICON_SIZE} variant="color" />
          </Animated.View>

          <Text style={[styles.stageLabel, styles.labelLeft]}>VOZ CON RUIDO</Text>
          <Text style={[styles.stageLabel, styles.labelRight]}>INFORMACIÓN CLÍNICA</Text>
        </View>

        {/* Title — una sola frase */}
        <Text style={styles.title}>
          {'Del ruido a la '}
          <Text style={styles.titleAccent}>información</Text>
        </Text>

        {/* Una línea de apoyo */}
        <Text style={styles.description}>
          VIA+ procesa cada voz y la convierte en medidas clínicas objetivas.
        </Text>
      </View>

      {/* Continue button */}
      <Pressable
        style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
        onPress={() => navigation.navigate('Creditos')}
      >
        <Text style={styles.buttonText}>Comenzar</Text>
        <Text style={styles.buttonArrow}>→</Text>
      </Pressable>

      {/* Footer */}
      <Text style={styles.footer}>
        {'VIA+ · Evaluación de audición y lenguaje · '}
        {new Date().getFullYear()}
      </Text>
    </View>
  );
}

const MONO = Platform.OS === 'ios' ? 'Courier' : 'monospace';

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F1ECE2',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  blobTopLeft: {
    position: 'absolute',
    top: -160,
    left: -120,
    width: 400,
    height: 400,
    borderRadius: 200,
    backgroundColor: 'rgba(240,174,108,0.18)',
  },
  blobBottomRight: {
    position: 'absolute',
    bottom: -180,
    right: -130,
    width: 380,
    height: 380,
    borderRadius: 190,
    backgroundColor: 'rgba(255,204,128,0.14)',
  },
  center: {
    alignItems: 'center',
    width: '100%',
    maxWidth: 520,
  },
  wordmark: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
    marginBottom: 26,
  },
  wordmarkVia: {
    fontSize: 46,
    fontWeight: '800',
    letterSpacing: -2,
    lineHeight: 50,
    color: '#3A352F',
  },
  wordmarkPlus: {
    fontSize: 46,
    fontWeight: '800',
    letterSpacing: -1,
    lineHeight: 50,
    color: '#FF7F00',
  },

  /* ── campo de partículas ── */
  field: {
    height: FIELD_H + 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 30,
  },
  fieldCenterLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: FIELD_H / 2,
    height: 0,
  },
  particle: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  iconWrapper: {
    width: ICON_SIZE + 20,
    height: ICON_SIZE + 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: ICON_SIZE,
    height: ICON_SIZE,
    borderRadius: (ICON_SIZE * 42) / 150,
    borderWidth: 2,
    borderColor: 'rgba(255,127,0,0.40)',
  },
  stageLabel: {
    position: 'absolute',
    bottom: 0,
    fontFamily: MONO,
    fontSize: 9,
    letterSpacing: 1.2,
    color: '#A89F93',
    fontWeight: '600',
  },
  labelLeft: {
    left: 4,
  },
  labelRight: {
    right: 4,
    color: '#D98324',
  },

  title: {
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.7,
    lineHeight: 37,
    textAlign: 'center',
    color: '#3A352F',
  },
  titleAccent: {
    color: '#FF7F00',
  },
  description: {
    marginTop: 12,
    fontSize: 15,
    color: '#7A746B',
    textAlign: 'center',
    lineHeight: 23,
    maxWidth: 340,
  },
  button: {
    position: 'absolute',
    bottom: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    backgroundColor: '#FF7F00',
    borderRadius: 999,
    paddingHorizontal: 34,
    paddingVertical: 17,
    shadowColor: '#FF7F00',
    shadowOpacity: 0.36,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 14 },
    elevation: 10,
  },
  buttonPressed: {
    opacity: 0.88,
    transform: [{ translateY: -2 }],
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  buttonArrow: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  footer: {
    position: 'absolute',
    bottom: 22,
    fontFamily: MONO,
    fontSize: 10,
    color: '#BDB5A8',
    letterSpacing: 0.5,
  },
});
