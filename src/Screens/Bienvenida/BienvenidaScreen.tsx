import React, { useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  StatusBar,
  Platform,
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
  Easing,
} from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/Navigators/screenTypeNavigator';
import ViaIcon from '@/Components/Common/ViaIcon';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Bienvenida'>;

/* -------------------------------------------------------------------------- */
/*  BienvenidaScreen — presenta la metáfora central de VIA+: la app escucha    */
/*  la voz tal y como llega (con ruido), la procesa y la transforma en        */
/*  información clínica útil. El centro de la pantalla es un "pipeline"       */
/*  animado de tres etapas:                                                   */
/*    [voz + ruido] ──▸ [VIA+ procesa] ──▸ [información útil]                 */
/*  Barras caóticas a la izquierda, el isotipo con anillos de pulso en el     */
/*  centro y una mini-ficha de resultados ordenados a la derecha, con puntos  */
/*  de flujo que recorren la tubería.                                         */
/* -------------------------------------------------------------------------- */

const ICON_SIZE = 96;
const RING_DURATION = 2600;

/* Secuencias pseudoaleatorias de alturas (px) para las barras de "ruido".
   Precalculadas para que el efecto sea determinista y barato. */
const NOISE_SEQUENCES: number[][] = [
  [12, 30, 8, 24, 14],
  [26, 10, 34, 16, 28],
  [8, 22, 12, 36, 10],
  [30, 14, 26, 8, 32],
  [16, 34, 10, 28, 12],
  [24, 8, 30, 14, 26],
  [10, 28, 16, 32, 8],
];

/* Perfil simétrico y ordenado de la señal "procesada". */
const CLEAN_BARS = [10, 18, 28, 36, 28, 18, 10];

/* ───────────────────────── noisy input bar ──────────────────────────────── */

function NoisyBar({ index }: { index: number }) {
  const height = useSharedValue(NOISE_SEQUENCES[index % NOISE_SEQUENCES.length][0]);

  useEffect(() => {
    const seq = NOISE_SEQUENCES[index % NOISE_SEQUENCES.length];
    const duration = 240 + (index % 3) * 70;
    height.value = withDelay(
      index * 90,
      withRepeat(
        withSequence(
          ...seq.map(h => withTiming(h, { duration, easing: Easing.inOut(Easing.quad) })),
        ),
        -1,
        true,
      ),
    );
    return () => cancelAnimation(height);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const style = useAnimatedStyle(() => ({ height: height.value }));
  return <Animated.View style={[styles.noisyBar, style]} />;
}

/* ───────────────────────── flow dots (left → right) ─────────────────────── */

function FlowDot({ delay }: { delay: number }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      delay,
      withRepeat(withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) }), -1, false),
    );
    return () => cancelAnimation(progress);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(progress.value, [0, 1], [0, 22]) }],
    opacity: interpolate(progress.value, [0, 0.2, 0.8, 1], [0, 1, 1, 0]),
  }));

  return <Animated.View style={[styles.flowDot, style]} />;
}

function FlowTrack() {
  return (
    <View style={styles.flowTrack} pointerEvents="none">
      <View style={styles.flowLine} />
      <FlowDot delay={0} />
      <FlowDot delay={750} />
    </View>
  );
}

/* ───────────────────────── clean output rows ────────────────────────────── */

function ResultRow({ index, width }: { index: number; width: number }) {
  const reveal = useSharedValue(0);

  useEffect(() => {
    reveal.value = withDelay(
      500 + index * 420,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 500, easing: Easing.out(Easing.cubic) }),
          withTiming(1, { duration: 2400 }),
          withTiming(0, { duration: 350, easing: Easing.in(Easing.cubic) }),
        ),
        -1,
        false,
      ),
    );
    return () => cancelAnimation(reveal);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dotStyle = useAnimatedStyle(() => ({ opacity: 0.25 + 0.75 * reveal.value }));
  const lineStyle = useAnimatedStyle(() => ({
    width: interpolate(reveal.value, [0, 1], [6, width]),
    opacity: 0.35 + 0.65 * reveal.value,
  }));

  return (
    <View style={styles.resultRow}>
      <Animated.View style={[styles.resultDot, dotStyle]} />
      <Animated.View style={[styles.resultLine, lineStyle]} />
    </View>
  );
}

/* ───────────────────────── screen ───────────────────────────────────────── */

export default function BienvenidaScreen() {
  const navigation = useNavigation<Nav>();

  const floatY = useSharedValue(0);
  const ring1 = useSharedValue(0);
  const ring2 = useSharedValue(0);

  useEffect(() => {
    floatY.value = withRepeat(
      withSequence(
        withTiming(-7, { duration: 3000, easing: Easing.inOut(Easing.sin) }),
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
    transform: [{ scale: interpolate(ring1.value, [0, 1], [0.9, 1.75]) }],
    opacity: interpolate(ring1.value, [0, 1], [0.5, 0]),
  }));
  const ring2Style = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(ring2.value, [0, 1], [0.9, 1.75]) }],
    opacity: interpolate(ring2.value, [0, 1], [0.5, 0]),
  }));

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#F1ECE2" />

      {/* Ambient blobs */}
      <View style={styles.blobTopLeft} pointerEvents="none" />
      <View style={styles.blobBottomRight} pointerEvents="none" />

      {/* Top badge */}
      <View style={styles.badge}>
        <View style={styles.badgeDot} />
        <Text style={styles.badgeText}>EVALUACIÓN DE AUDICIÓN Y LENGUAJE</Text>
      </View>

      {/* Center content */}
      <View style={styles.center}>
        {/* Wordmark */}
        <View style={styles.wordmark}>
          <Text style={styles.wordmarkVia}>VIA</Text>
          <Text style={styles.wordmarkPlus}>+</Text>
        </View>

        {/* Divider */}
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerLabel}>TE DAMOS LA BIENVENIDA</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* ── Pipeline: voz con ruido → VIA+ procesa → información útil ── */}
        <View style={styles.pipeline}>
          {/* Etapa 1: la voz llega con ruido */}
          <View style={styles.stage}>
            <View style={styles.noisyWave}>
              {NOISE_SEQUENCES.map((_, i) => (
                <NoisyBar key={i} index={i} />
              ))}
            </View>
            <Text style={styles.stageLabel}>VOZ + RUIDO</Text>
          </View>

          <FlowTrack />

          {/* Etapa 2: VIA+ procesa (isotipo con anillos de pulso) */}
          <View style={styles.stage}>
            <Animated.View style={[styles.iconWrapper, floatStyle]}>
              <Animated.View style={[styles.ring, ring1Style]} />
              <Animated.View style={[styles.ring, ring2Style]} />
              <ViaIcon size={ICON_SIZE} variant="color" />
            </Animated.View>
            <Text style={[styles.stageLabel, styles.stageLabelAccent]}>VIA+ PROCESA</Text>
          </View>

          <FlowTrack />

          {/* Etapa 3: información clínica útil */}
          <View style={styles.stage}>
            <View style={styles.resultCard}>
              <View style={styles.cleanWave}>
                {CLEAN_BARS.map((h, i) => (
                  <View key={i} style={[styles.cleanBar, { height: h }]} />
                ))}
              </View>
              <ResultRow index={0} width={40} />
              <ResultRow index={1} width={30} />
              <ResultRow index={2} width={36} />
            </View>
            <Text style={styles.stageLabel}>INFORMACIÓN ÚTIL</Text>
          </View>
        </View>

        {/* Title */}
        <Text style={styles.title}>
          {'Del ruido a la '}
          <Text style={styles.titleAccent}>información</Text>
          {'\nque cada voz necesita'}
        </Text>

        {/* Description */}
        <Text style={styles.description}>
          VIA+ escucha la voz tal y como llega —con el ruido de la sala—, la procesa y la
          transforma en medidas objetivas para tus evaluaciones de audición y lenguaje.
        </Text>
      </View>

      {/* Continue button */}
      <Pressable
        style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
        onPress={() => navigation.navigate('Login')}
      >
        <Text style={styles.buttonText}>Comenzar</Text>
        <Text style={styles.buttonArrow}>→</Text>
      </Pressable>

      {/* Footer */}
      <Text style={styles.footer}>
        {'VIA+ · Plataforma clínica de evaluación · '}
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
  badge: {
    position: 'absolute',
    top: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EBE6DD',
    borderRadius: 999,
    paddingHorizontal: 17,
    paddingVertical: 8,
    shadowColor: '#503C1E',
    shadowOpacity: 0.07,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  badgeDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: '#FF7F00',
  },
  badgeText: {
    fontFamily: MONO,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1,
    color: '#9A938A',
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
  },
  wordmarkVia: {
    fontSize: 44,
    fontWeight: '800',
    letterSpacing: -2,
    lineHeight: 48,
    color: '#3A352F',
  },
  wordmarkPlus: {
    fontSize: 44,
    fontWeight: '800',
    letterSpacing: -1,
    lineHeight: 48,
    color: '#FF7F00',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    marginTop: 14,
    marginBottom: 26,
  },
  dividerLine: {
    width: 40,
    height: 1.5,
    backgroundColor: '#D9CFBF',
  },
  dividerLabel: {
    fontFamily: MONO,
    fontSize: 10,
    letterSpacing: 2.5,
    color: '#A89F93',
  },

  /* ── pipeline ── */
  pipeline: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    marginBottom: 30,
  },
  stage: {
    alignItems: 'center',
    gap: 10,
  },
  stageLabel: {
    fontFamily: MONO,
    fontSize: 9,
    letterSpacing: 1,
    color: '#A89F93',
    fontWeight: '600',
  },
  stageLabelAccent: {
    color: '#E8720C',
  },
  noisyWave: {
    height: ICON_SIZE + 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 2,
  },
  noisyBar: {
    width: 4,
    borderRadius: 2,
    backgroundColor: '#B9AC97',
  },
  flowTrack: {
    width: 34,
    height: ICON_SIZE + 16,
    justifyContent: 'center',
    marginHorizontal: 2,
  },
  flowLine: {
    position: 'absolute',
    left: 3,
    right: 3,
    height: 1.5,
    borderRadius: 1,
    backgroundColor: '#DDD2C0',
    alignSelf: 'center',
    top: (ICON_SIZE + 16) / 2 - 0.75,
  },
  flowDot: {
    position: 'absolute',
    top: (ICON_SIZE + 16) / 2 - 3.5,
    left: 3,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#FF7F00',
  },
  iconWrapper: {
    width: ICON_SIZE + 16,
    height: ICON_SIZE + 16,
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
  resultCard: {
    height: ICON_SIZE + 16,
    minWidth: 74,
    justifyContent: 'center',
    gap: 7,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EBE6DD',
    paddingHorizontal: 12,
    shadowColor: '#503C1E',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  cleanWave: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginBottom: 3,
  },
  cleanBar: {
    width: 4,
    borderRadius: 2,
    backgroundColor: '#FF8A1E',
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  resultDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#3FA764',
  },
  resultLine: {
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E3D9C8',
  },

  title: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.7,
    lineHeight: 35,
    textAlign: 'center',
    color: '#3A352F',
  },
  titleAccent: {
    color: '#FF7F00',
  },
  description: {
    marginTop: 16,
    fontSize: 14.5,
    color: '#7A746B',
    textAlign: 'center',
    lineHeight: 23,
    maxWidth: 360,
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
