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
/*  BienvenidaScreen — una sola idea, poco texto: VIA+ toma la voz con ruido   */
/*  y la transforma en información clínica útil. El centro es un gráfico       */
/*  único: barras caóticas (ruido) → isotipo con anillos de pulso (proceso)   */
/*  → onda ordenada (resultado), con dos etiquetas mínimas.                   */
/* -------------------------------------------------------------------------- */

const ICON_SIZE = 112;
const RING_DURATION = 2600;

/* Secuencias pseudoaleatorias de alturas (px) para las barras de "ruido".
   Precalculadas: efecto determinista y barato. */
const NOISE_SEQUENCES: number[][] = [
  [18, 44, 12, 34, 22],
  [38, 14, 50, 24, 40],
  [12, 32, 18, 54, 16],
  [44, 20, 38, 12, 48],
  [24, 50, 14, 40, 18],
  [34, 12, 44, 20, 38],
];

/* Perfil simétrico de la señal ya procesada. */
const CLEAN_BARS = [16, 28, 42, 56, 42, 28, 16];

/* ───────────────────────── noisy input bar ──────────────────────────────── */

function NoisyBar({ index }: { index: number }) {
  const height = useSharedValue(NOISE_SEQUENCES[index % NOISE_SEQUENCES.length][0]);

  useEffect(() => {
    const seq = NOISE_SEQUENCES[index % NOISE_SEQUENCES.length];
    const duration = 260 + (index % 3) * 80;
    height.value = withDelay(
      index * 100,
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

/* ───────────────────────── clean output bar ─────────────────────────────── */

function CleanBar({ index, height }: { index: number; height: number }) {
  const breathe = useSharedValue(0);

  useEffect(() => {
    breathe.value = withDelay(
      index * 140,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: 1600, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        false,
      ),
    );
    return () => cancelAnimation(breathe);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [{ scaleY: interpolate(breathe.value, [0, 1], [0.88, 1]) }],
    opacity: interpolate(breathe.value, [0, 1], [0.85, 1]),
  }));

  return <Animated.View style={[styles.cleanBar, { height }, style]} />;
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

        {/* ── Gráfico: ruido → VIA+ → señal ordenada ── */}
        <View style={styles.graphic}>
          <View style={styles.stage}>
            <View style={styles.wave}>
              {NOISE_SEQUENCES.map((_, i) => (
                <NoisyBar key={i} index={i} />
              ))}
            </View>
            <Text style={styles.stageLabel}>VOZ CON RUIDO</Text>
          </View>

          <Animated.View style={[styles.iconWrapper, floatStyle]}>
            <Animated.View style={[styles.ring, ring1Style]} />
            <Animated.View style={[styles.ring, ring2Style]} />
            <ViaIcon size={ICON_SIZE} variant="color" />
          </Animated.View>

          <View style={styles.stage}>
            <View style={styles.wave}>
              {CLEAN_BARS.map((h, i) => (
                <CleanBar key={i} index={i} height={h} />
              ))}
            </View>
            <Text style={styles.stageLabel}>INFORMACIÓN CLÍNICA</Text>
          </View>
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
        onPress={() => navigation.navigate('SeleccionProfesional')}
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
    marginBottom: 34,
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

  /* ── gráfico ── */
  graphic: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 22,
    marginBottom: 38,
  },
  stage: {
    alignItems: 'center',
    gap: 12,
  },
  wave: {
    height: ICON_SIZE,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  noisyBar: {
    width: 7,
    borderRadius: 3.5,
    backgroundColor: '#B3A791',
  },
  cleanBar: {
    width: 7,
    borderRadius: 3.5,
    backgroundColor: '#FF7F00',
  },
  stageLabel: {
    fontFamily: MONO,
    fontSize: 9,
    letterSpacing: 1.2,
    color: '#A89F93',
    fontWeight: '600',
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
