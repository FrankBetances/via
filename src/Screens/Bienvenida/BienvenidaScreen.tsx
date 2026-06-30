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
  Easing,
} from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/Navigators/screenTypeNavigator';
import ViaIcon from '@/Components/Common/ViaIcon';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Bienvenida'>;

const RING_DURATION = 2800;
const ringTiming = { duration: RING_DURATION, easing: Easing.out(Easing.ease) };
const instant = { duration: 0 };

export default function BienvenidaScreen() {
  const navigation = useNavigation<Nav>();

  const floatY = useSharedValue(0);
  const ring1Scale = useSharedValue(0.62);
  const ring1Opacity = useSharedValue(0.55);
  const ring2Scale = useSharedValue(0.62);
  const ring2Opacity = useSharedValue(0.55);

  useEffect(() => {
    floatY.value = withRepeat(
      withSequence(
        withTiming(-9, { duration: 3000, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 3000, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );

    ring1Scale.value = withRepeat(
      withSequence(withTiming(2.05, ringTiming), withTiming(0.62, instant)),
      -1,
      false,
    );
    ring1Opacity.value = withRepeat(
      withSequence(withTiming(0, ringTiming), withTiming(0.55, instant)),
      -1,
      false,
    );

    ring2Scale.value = withDelay(
      1400,
      withRepeat(
        withSequence(withTiming(2.05, ringTiming), withTiming(0.62, instant)),
        -1,
        false,
      ),
    );
    ring2Opacity.value = withDelay(
      1400,
      withRepeat(
        withSequence(withTiming(0, ringTiming), withTiming(0.55, instant)),
        -1,
        false,
      ),
    );
  }, []);

  const floatStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: floatY.value }],
  }));
  const ring1Style = useAnimatedStyle(() => ({
    transform: [{ scale: ring1Scale.value }],
    opacity: ring1Opacity.value,
  }));
  const ring2Style = useAnimatedStyle(() => ({
    transform: [{ scale: ring2Scale.value }],
    opacity: ring2Opacity.value,
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
        {/* Floating icon with ring animations */}
        <Animated.View style={[styles.iconWrapper, floatStyle]}>
          <Animated.View style={[styles.ring, ring1Style]} />
          <Animated.View style={[styles.ring, ring2Style]} />
          <ViaIcon size={150} variant="color" />
        </Animated.View>

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

        {/* Title */}
        <Text style={styles.title}>
          {'Empecemos a '}
          <Text style={styles.titleAccent}>escuchar</Text>
          {'\nlo que cada voz necesita'}
        </Text>

        {/* Description */}
        <Text style={styles.description}>
          Nos alegra tenerte aquí. En unos pasos dejaremos todo listo para acompañar a tus
          pacientes en sus evaluaciones de audición y lenguaje.
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
    maxWidth: 480,
  },
  iconWrapper: {
    width: 168,
    height: 168,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 30,
  },
  ring: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 42,
    borderWidth: 2,
    borderColor: 'rgba(255,127,0,0.40)',
  },
  wordmark: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
  },
  wordmarkVia: {
    fontSize: 56,
    fontWeight: '800',
    letterSpacing: -2,
    lineHeight: 60,
    color: '#3A352F',
  },
  wordmarkPlus: {
    fontSize: 56,
    fontWeight: '800',
    letterSpacing: -1,
    lineHeight: 60,
    color: '#FF7F00',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    marginVertical: 24,
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
    marginTop: 18,
    fontSize: 15,
    color: '#7A746B',
    textAlign: 'center',
    lineHeight: 24,
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
