import React, { useEffect, useMemo } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ArrowRight, Lock, Stethoscope, Trophy } from 'lucide-react-native';

import type { RootStackParamList } from '@/Navigators/screenTypeNavigator';
import ViaIcon from '@/Components/Common/ViaIcon';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Bienvenida'>;

/* -------------------------------------------------------------------------- */
/*  BienvenidaScreen — "Del ruido a la información clínica" en tableta (4:3)   */
/*  Escenario cinemático de partículas + onda dual a la izquierda, propuesta   */
/*  de valor clínico estructurada y CTA a la derecha.                          */
/* -------------------------------------------------------------------------- */

const ICON_SIZE = 92;
const RING_DURATION = 2600;
const FIELD_H = 220;
const PARTICLES = 28;
const TRAVEL_MS = 5400;

interface ParticleSpec {
  delay: number;
  duration: number;
  size: number;
  baseY: number;
  amp: number;
  f1: number;
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
    size: 3.5 + Math.round(rnd() * 3),
    baseY: rnd() * 2 - 1,
    amp: 16 + rnd() * 28,
    f1: 6 + rnd() * 9,
    p1: rnd() * Math.PI * 2,
    f2: 14 + rnd() * 14,
    p2: rnd() * Math.PI * 2,
  }));
}

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

    // Grado de desorden: 1 antes del logo (0-40%), 0 después (40-100%)
    const disorder = 1 - Math.min(1, Math.max(0, (p - 0.35) / 0.18));

    const yChaos =
      spec.baseY * (FIELD_H / 2 - 20) +
      Math.sin(p * spec.f1 + spec.p1) * spec.amp +
      Math.sin(p * spec.f2 + spec.p2) * spec.amp * 0.5;
    const yOrder = Math.sin(p * Math.PI * 2 * 2.5) * 22;
    const y = disorder * yChaos + (1 - disorder) * yOrder;

    const opacity =
      interpolate(p, [0, 0.05, 0.92, 1], [0, 1, 1, 0]) * (0.55 + 0.45 * (1 - disorder));

    return {
      transform: [
        { translateX: x },
        { translateY: y },
        { scale: 0.85 + 0.5 * (1 - disorder) },
      ],
      opacity,
      backgroundColor: interpolateColor(disorder, [0, 1], ['#FF7F00', '#A39988']),
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

export default function BienvenidaScreen() {
  const navigation = useNavigation<Nav>();
  const { width: winW } = useWindowDimensions();
  const isTabletLandscape = winW >= 850;
  const stageWidth = isTabletLandscape ? Math.min(winW * 0.48, 500) : Math.min(winW - 48, 480);
  const specs = useMemo(buildSpecs, []);

  const floatY = useSharedValue(0);
  const ring1 = useSharedValue(0);
  const ring2 = useSharedValue(0);
  const waveProg = useSharedValue(0);

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

    waveProg.value = withRepeat(
      withTiming(1, { duration: 4000, easing: Easing.linear }),
      -1,
      false,
    );

    return () => {
      cancelAnimation(floatY);
      cancelAnimation(ring1);
      cancelAnimation(ring2);
      cancelAnimation(waveProg);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const floatStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: floatY.value }],
  }));
  const ring1Style = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(ring1.value, [0, 1], [0.92, 1.65]) }],
    opacity: interpolate(ring1.value, [0, 1], [0.45, 0]),
  }));
  const ring2Style = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(ring2.value, [0, 1], [0.92, 1.65]) }],
    opacity: interpolate(ring2.value, [0, 1], [0.45, 0]),
  }));

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#F5F2EC" />

      {/* Ambient background glows */}
      <View style={styles.blobTopLeft} pointerEvents="none" />
      <View style={styles.blobBottomRight} pointerEvents="none" />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          isTabletLandscape && styles.scrollContentLandscape,
        ]}
        showsVerticalScrollIndicator={false}>
        
        {/* ================================================================== */}
        {/* COLUMNA IZQUIERDA: Escenario Cinemático de Partículas + Onda Dual  */}
        {/* ================================================================== */}
        <View style={[styles.stageColumn, { width: stageWidth }]}>
          <View style={[styles.fieldContainer, { width: stageWidth }]}>
            
            {/* Partículas de fondo */}
            <View style={styles.particleTrack} pointerEvents="none">
              {specs.map((spec, i) => (
                <Particle key={i} spec={spec} width={stageWidth} />
              ))}
            </View>

            {/* Onda senoidal dual armónica renderizada en SVG */}
            <View style={styles.waveLayer} pointerEvents="none">
              <Svg width={stageWidth * 0.58} height={120} viewBox="0 0 240 120" fill="none">
                {/* Onda 1: Naranja Radiante (Armónica fundamental) */}
                <Path
                  d="M 10 60 C 35 15, 60 105, 95 60 C 130 15, 160 105, 195 60 C 215 35, 230 45, 238 60"
                  stroke="#FF7F00"
                  strokeWidth="3.8"
                  strokeLinecap="round"
                  fill="none"
                  opacity="0.9"
                />
                {/* Onda 2: Turquesa / Teal (Formante clínico secundario) */}
                <Path
                  d="M 10 60 C 40 30, 65 90, 105 60 C 145 30, 170 90, 205 60 C 220 48, 232 52, 238 60"
                  stroke="#0D9488"
                  strokeWidth="2.8"
                  strokeLinecap="round"
                  fill="none"
                  opacity="0.8"
                />
              </Svg>
            </View>

            {/* Isotipo VIA+ con pulso de anillos concéntricos */}
            <Animated.View style={[styles.iconWrapper, floatStyle]}>
              <Animated.View style={[styles.ring, ring1Style]} />
              <Animated.View style={[styles.ring, ring2Style]} />
              <ViaIcon size={ICON_SIZE} variant="color" />
            </Animated.View>
          </View>

          {/* Rótulos del flujo de señal */}
          <View style={styles.stageLabelsRow}>
            <Text style={styles.stageLabelLeft}>RUIDO</Text>
            <View style={styles.arrowRow}>
              <View style={styles.arrowLine} />
              <Text style={styles.arrowHead}>→</Text>
            </View>
            <Text style={styles.stageLabelRight}>INFORMACIÓN CLÍNICA</Text>
          </View>
        </View>

        {/* ================================================================== */}
        {/* COLUMNA DERECHA: Propuesta de Valor, Tarjetas y Botón de Inicio   */}
        {/* ================================================================== */}
        <View style={styles.narrativeColumn}>
          {/* Wordmark VIA+ */}
          <View style={styles.wordmark}>
            <Text style={styles.wordmarkVia}>VIA</Text>
            <Text style={styles.wordmarkPlus}>+</Text>
          </View>

          {/* Titular destacado */}
          <View style={styles.titleWrapper}>
            <Text style={styles.titleLead}>Del ruido a la</Text>
            <View style={styles.titleHighlightPill}>
              <Text style={styles.titleHighlightText}>información clínica</Text>
            </View>
          </View>

          {/* Párrafo explicativo */}
          <Text style={styles.description}>
            VIA+ procesa objetivamente la señal acústica y la transforma en parámetros diagnósticos precisos para optimizar la toma de decisiones clínicas.
          </Text>

          {/* 3 Tarjetas / Chips de Valor Clínico */}
          <View style={styles.chipsContainer}>
            <View style={styles.valueChip}>
              <Stethoscope size={16} color="#0284C7" />
              <Text style={styles.valueChipText}>12 Módulos Clínicos</Text>
            </View>

            <View style={styles.valueChip}>
              <Lock size={15} color="#0D9488" />
              <Text style={styles.valueChipText}>100% On-Device · Zero-PHI</Text>
            </View>

            <View style={styles.valueChip}>
              <Trophy size={16} color="#D97706" />
              <Text style={styles.valueChipText}>Sello ITEMAS 2024</Text>
            </View>
          </View>

          {/* Botón de Acción Principal en Naranja Radiante */}
          <Pressable
            style={({ pressed }) => [styles.ctaButton, pressed && styles.ctaButtonPressed]}
            onPress={() => navigation.navigate('Creditos')}>
            <Text style={styles.ctaButtonText}>Comenzar Exploración</Text>
            <ArrowRight size={18} color="#FFFFFF" strokeWidth={2.5} />
          </Pressable>

          {/* Nota regulatoria */}
          <Text style={styles.regulatoryNote}>
            VIA+ · SaMD Clase IIa · MDR 2017/745
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const MONO = Platform.OS === 'ios' ? 'Courier' : 'monospace';

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F5F2EC',
  },
  blobTopLeft: {
    position: 'absolute',
    top: -140,
    left: -100,
    width: 420,
    height: 420,
    borderRadius: 210,
    backgroundColor: 'rgba(240, 174, 108, 0.16)',
  },
  blobBottomRight: {
    position: 'absolute',
    bottom: -160,
    right: -120,
    width: 440,
    height: 440,
    borderRadius: 220,
    backgroundColor: 'rgba(255, 204, 128, 0.14)',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingVertical: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContentLandscape: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 40,
  },

  /* Columna Escenario */
  stageColumn: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  fieldContainer: {
    height: FIELD_H,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  particleTrack: {
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
  waveLayer: {
    position: 'absolute',
    right: 0,
    top: FIELD_H / 2 - 60,
    width: '60%',
    height: 120,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  iconWrapper: {
    position: 'absolute',
    left: 20,
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
    borderColor: 'rgba(255, 127, 0, 0.38)',
  },
  stageLabelsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 12,
    marginTop: 8,
  },
  stageLabelLeft: {
    fontFamily: MONO,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.1,
    color: '#8C8275',
  },
  stageLabelRight: {
    fontFamily: MONO,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.1,
    color: '#D97706',
  },
  arrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 10,
  },
  arrowLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#D1C7B8',
  },
  arrowHead: {
    color: '#8C8275',
    fontSize: 12,
    marginLeft: 2,
  },

  /* Columna Narrativa */
  narrativeColumn: {
    maxWidth: 440,
    alignItems: 'flex-start',
  },
  wordmark: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 12,
  },
  wordmarkVia: {
    fontSize: 42,
    fontWeight: '800',
    letterSpacing: -2,
    lineHeight: 46,
    color: '#2B2620',
  },
  wordmarkPlus: {
    fontSize: 42,
    fontWeight: '800',
    letterSpacing: -1,
    lineHeight: 46,
    color: '#FF7F00',
  },
  titleWrapper: {
    marginBottom: 12,
  },
  titleLead: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.6,
    lineHeight: 34,
    color: '#2B2620',
  },
  titleHighlightPill: {
    backgroundColor: '#FED7AA',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  titleHighlightText: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
    color: '#9A3412',
  },
  description: {
    fontSize: 14,
    color: '#524B42',
    lineHeight: 22,
    marginBottom: 20,
  },

  /* Feature chips */
  chipsContainer: {
    gap: 10,
    width: '100%',
    marginBottom: 24,
  },
  valueChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#E8E2D5',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  valueChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2B2620',
  },

  /* Botón CTA */
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#FF7F00',
    borderRadius: 24,
    paddingVertical: 14,
    paddingHorizontal: 28,
    shadowColor: '#FF7F00',
    shadowOpacity: 0.32,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  ctaButtonPressed: {
    opacity: 0.9,
    transform: [{ translateY: -1 }],
  },
  ctaButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },

  regulatoryNote: {
    fontFamily: MONO,
    fontSize: 11,
    color: '#9C9284',
    marginTop: 20,
    letterSpacing: 0.4,
  },
});
