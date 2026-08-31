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
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';
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
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  Activity,
  ArrowRight,
  Award,
  Lock,
  ShieldCheck,
  Sparkles,
  Stethoscope,
} from 'lucide-react-native';

import type { RootStackParamList } from '@/Navigators/screenTypeNavigator';
import ViaIcon from '@/Components/Common/ViaIcon';

import { useT } from '@/I18n';
import { ORBIT_MODULES } from '@/Screens/Creditos/orbitModules';
import { atoms } from '@/Theme/styleAtoms';
type Nav = NativeStackNavigationProp<RootStackParamList, 'Bienvenida'>;

/* -------------------------------------------------------------------------- */
/*  BienvenidaScreen — "Del ruido a la información clínica"                   */
/*  Diseño clínico cálido, riguroso y optimizado para tableta 4:3 y móviles.   */
/*  Escenario cinemático acústico a la izquierda, tarjetas de valor clínico    */
/*  y llamada a la acción accesible a la derecha.                             */
/* -------------------------------------------------------------------------- */

const RING_DURATION = 2600;
const PARTICLES = 28;
const TRAVEL_MS = 5200;

/* El escenario acustico se dimensiona con la ventana: en tabletas altas crece
   hasta llenar la columna y en moviles se encoge para no empujar el CTA fuera. */
const FIELD_H_MIN = 150;
const FIELD_H_MAX = 420;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

/* Cromo vertical de la tarjeta del escenario: cabecera (24 + 8), fila de
   etiquetas (14 + 26) y relleno de la propia tarjeta (16 arriba + 16 abajo). */
const STAGE_CHROME_H = 118;

export interface StageLayout {
  isTabletLandscape: boolean;
  stageWidth: number;
  fieldHeight: number;
  iconSize: number;
  waveHeight: number;
}

/**
 * Reparte la ventana entre las dos columnas.
 *
 * El escenario acústico tenía alto fijo (200 px), así que en tableta apaisada
 * la columna izquierda se quedaba corta y sobraba fondo por arriba y por
 * abajo, mientras la columna narrativa se salía por el pie. Aquí el escenario
 * se estira hasta llenar el alto útil real —descontados el área segura y el
 * relleno del ScrollView— y se encoge en móviles para que el botón de acción
 * siga entrando en pantalla.
 */
export function computeStageLayout({
  winW,
  winH,
  insetTop,
  insetBottom,
}: {
  winW: number;
  winH: number;
  insetTop: number;
  insetBottom: number;
}): StageLayout {
  const isTabletLandscape = winW >= 850;
  const stageWidth = isTabletLandscape
    ? Math.min(winW * 0.46, 520)
    : Math.min(winW - 48, 480);

  // Alto útil real, ya descontados el área segura y el relleno del ScrollView.
  const availableH =
    winH - Math.max(insetTop, 16) - Math.max(insetBottom, 16) - 32;

  const fieldHeight = Math.round(
    isTabletLandscape
      ? clamp(availableH - STAGE_CHROME_H, FIELD_H_MIN, FIELD_H_MAX)
      : clamp(availableH * 0.26, FIELD_H_MIN, 232),
  );

  return {
    isTabletLandscape,
    stageWidth,
    fieldHeight,
    iconSize: Math.round(clamp(fieldHeight * 0.44, 62, 96)),
    waveHeight: Math.round(clamp(fieldHeight * 0.5, 70, 130)),
  };
}

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
    delay: i * (TRAVEL_MS / PARTICLES) + rnd() * 140,
    duration: TRAVEL_MS * (0.88 + rnd() * 0.24),
    size: 3.5 + Math.round(rnd() * 3),
    baseY: rnd() * 2 - 1,
    amp: 14 + rnd() * 24,
    f1: 6 + rnd() * 8,
    p1: rnd() * Math.PI * 2,
    f2: 12 + rnd() * 12,
    p2: rnd() * Math.PI * 2,
  }));
}

function Particle({
  spec,
  width,
  height,
}: {
  spec: ParticleSpec;
  width: number;
  height: number;
}) {
  const prog = useSharedValue(0);

  useEffect(() => {
    prog.value = 0;
    prog.value = withDelay(
      spec.delay,
      withRepeat(withTiming(1, { duration: spec.duration, easing: Easing.linear }), -1, false),
    );
    return () => cancelAnimation(prog);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spec, width, height]);

  const style = useAnimatedStyle(() => {
    const p = prog.value;
    const x = interpolate(p, [0, 1], [-8, width + 8]);

    // Grado de desorden: 1 antes del isotipo (0-38%), 0 después (38-100%)
    const disorder = 1 - Math.min(1, Math.max(0, (p - 0.34) / 0.18));

    const yChaos =
      spec.baseY * (height / 2 - 24) +
      Math.sin(p * spec.f1 + spec.p1) * spec.amp +
      Math.sin(p * spec.f2 + spec.p2) * spec.amp * 0.5;
    const yOrder = Math.sin(p * Math.PI * 2 * 2.6) * 18;
    const y = disorder * yChaos + (1 - disorder) * yOrder;

    const opacity =
      interpolate(p, [0, 0.06, 0.92, 1], [0, 1, 1, 0]) * (0.55 + 0.45 * (1 - disorder));

    return {
      transform: [
        { translateX: x },
        { translateY: y },
        { scale: 0.85 + 0.45 * (1 - disorder) },
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
  const t = useT();
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { width: winW, height: winH } = useWindowDimensions();
  const { isTabletLandscape, stageWidth, fieldHeight, iconSize, waveHeight } =
    computeStageLayout({
      winW,
      winH,
      insetTop: insets.top,
      insetBottom: insets.bottom,
    });
  const specs = useMemo(buildSpecs, []);

  // Shared values para animaciones continuas del escenario
  const floatY = useSharedValue(0);
  const ring1 = useSharedValue(0);
  const ring2 = useSharedValue(0);
  const waveProg = useSharedValue(0);

  // Animaciones de entrada escalonada (Staggered Entrance)
  const introOpacity = useSharedValue(0);
  const introTranslateY = useSharedValue(20);
  const btnScale = useSharedValue(1);

  useEffect(() => {
    // Entrada fluida
    introOpacity.value = withTiming(1, { duration: 650, easing: Easing.out(Easing.cubic) });
    introTranslateY.value = withTiming(0, { duration: 650, easing: Easing.out(Easing.cubic) });

    // Isotipo flotante
    floatY.value = withRepeat(
      withSequence(
        withTiming(-5, { duration: 2800, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 2800, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );

    // Ondas acústicas concéntricas
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
      withTiming(1, { duration: 3600, easing: Easing.linear }),
      -1,
      false,
    );

    return () => {
      cancelAnimation(floatY);
      cancelAnimation(ring1);
      cancelAnimation(ring2);
      cancelAnimation(waveProg);
      cancelAnimation(introOpacity);
      cancelAnimation(introTranslateY);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const introStyle = useAnimatedStyle(() => ({
    opacity: introOpacity.value,
    transform: [{ translateY: introTranslateY.value }],
  }));

  const floatStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: floatY.value }],
  }));

  const ring1Style = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(ring1.value, [0, 1], [0.92, 1.62]) }],
    opacity: interpolate(ring1.value, [0, 1], [0.45, 0]),
  }));

  const ring2Style = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(ring2.value, [0, 1], [0.92, 1.62]) }],
    opacity: interpolate(ring2.value, [0, 1], [0.45, 0]),
  }));

  const btnAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: btnScale.value }],
  }));

  const handlePressIn = () => {
    btnScale.value = withSpring(0.97, { damping: 15, stiffness: 300 });
  };

  const handlePressOut = () => {
    btnScale.value = withSpring(1, { damping: 15, stiffness: 300 });
  };

  const handleStart = () => {
    navigation.navigate('Creditos');
  };

  return (
    <View style={[styles.root, { paddingTop: Math.max(insets.top, 16), paddingBottom: Math.max(insets.bottom, 16) }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#F5F2EC" />

      {/* Fondos de luz ambiental cálida */}
      <View style={styles.blobTopLeft} pointerEvents="none" />
      <View style={styles.blobBottomRight} pointerEvents="none" />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          isTabletLandscape && styles.scrollContentLandscape,
        ]}
        showsVerticalScrollIndicator={false}>
        
        {/* ================================================================== */}
        {/* COLUMNA IZQUIERDA: Escenario Cinemático Acústico ("Del Ruido...") */}
        {/* ================================================================== */}
        <Animated.View
          style={[
            styles.stageColumn,
            { width: stageWidth },
            isTabletLandscape && styles.stageColumnLandscape,
            introStyle,
          ]}>
          <View style={[styles.stageCard, { width: stageWidth }]}>
            {/* Header del escenario con etiqueta de señal en tiempo real */}
            <View style={styles.stageCardHeader}>
              <View style={styles.signalLiveBadge}>
                <View style={styles.liveDot} />
                <Text style={styles.signalLiveText}>{t.bienvenida.procesamientoDsp}</Text>
              </View>
              <Text style={styles.signalSamplingText}>{t.bienvenida.n48Khz24Bit}</Text>
            </View>

            {/* Contenedor del osciloscopio cinemático */}
            <View
              style={[styles.fieldContainer, { width: stageWidth - 32, height: fieldHeight }]}>
              {/* Partículas de señal en movimiento */}
              <View
                style={[styles.particleTrack, { top: fieldHeight / 2 }]}
                pointerEvents="none">
                {specs.map((spec, i) => (
                  <Particle
                    key={i}
                    spec={spec}
                    width={stageWidth - 32}
                    height={fieldHeight}
                  />
                ))}
              </View>

              {/* Onda senoidal dual armónica renderizada en SVG */}
              <View
                style={[
                  styles.waveLayer,
                  { top: fieldHeight / 2 - waveHeight / 2, height: waveHeight },
                ]}
                pointerEvents="none">
                <Svg
                  width={(stageWidth - 32) * 0.58}
                  height={waveHeight}
                  viewBox="0 0 240 100"
                  fill="none">
                  <Defs>
                    <LinearGradient id="orangeWave" x1="0" y1="0" x2="1" y2="0">
                      <Stop offset="0" stopColor="#FF7F00" stopOpacity="0.3" />
                      <Stop offset="0.5" stopColor="#FF7F00" stopOpacity="0.95" />
                      <Stop offset="1" stopColor="#E08A3D" stopOpacity="0.8" />
                    </LinearGradient>
                    <LinearGradient id="tealWave" x1="0" y1="0" x2="1" y2="0">
                      <Stop offset="0" stopColor="#0D9488" stopOpacity="0.2" />
                      <Stop offset="0.6" stopColor="#0D9488" stopOpacity="0.9" />
                      <Stop offset="1" stopColor="#14B8A6" stopOpacity="0.7" />
                    </LinearGradient>
                  </Defs>

                  {/* Onda 1: Armónica fundamental en Naranja Radiante */}
                  <Path
                    d="M 10 50 C 35 15, 60 85, 95 50 C 130 15, 160 85, 195 50 C 215 30, 230 40, 238 50"
                    stroke="url(#orangeWave)"
                    strokeWidth="3.6"
                    strokeLinecap="round"
                    fill="none"
                  />
                  {/* Onda 2: Formante clínica secundaria en Turquesa */}
                  <Path
                    d="M 10 50 C 40 25, 65 75, 105 50 C 145 25, 170 75, 205 50 C 220 40, 232 44, 238 50"
                    stroke="url(#tealWave)"
                    strokeWidth="2.6"
                    strokeLinecap="round"
                    fill="none"
                  />
                </Svg>
              </View>

              {/* Isotipo VIA+ con pulso de anillos acústicos */}
              <Animated.View
                style={[
                  styles.iconWrapper,
                  { width: iconSize + 20, height: iconSize + 20 },
                  floatStyle,
                ]}>
                <Animated.View style={[styles.ring, ringSize(iconSize), ring1Style]} />
                <Animated.View style={[styles.ring, ringSize(iconSize), ring2Style]} />
                <ViaIcon size={iconSize} variant="color" />
              </Animated.View>
            </View>

            {/* Cápsula de transformación DSP */}
            <View style={styles.stageLabelsRow}>
              <View style={styles.stagePillLeft}>
                <Text style={styles.stageLabelLeft}>{t.bienvenida.ruido}</Text>
              </View>
              <View style={styles.arrowRow}>
                <View style={styles.arrowLine} />
                <Text style={styles.arrowHead}>➔</Text>
              </View>
              <View style={styles.stagePillRight}>
                <Text style={styles.stageLabelRight}>{t.bienvenida.informacionClinica}</Text>
              </View>
            </View>
          </View>
        </Animated.View>

        {/* ================================================================== */}
        {/* COLUMNA DERECHA: Narrativa Clínica, Tarjetas de Valor y Acción     */}
        {/* ================================================================== */}
        <Animated.View
          style={[
            styles.narrativeColumn,
            isTabletLandscape && styles.narrativeColumnLandscape,
            introStyle,
          ]}>
          {/* Cabecera / Wordmark VIA+ */}
          <View style={styles.wordmarkRow}>
            <View style={styles.wordmark}>
              <Text style={styles.wordmarkVia}>VIA</Text>
              <Text style={styles.wordmarkPlus}>+</Text>
            </View>
            <View style={styles.samdHeaderPill}>
              <ShieldCheck size={14} color="#0D9488" strokeWidth={2.2} />
              <Text style={styles.samdHeaderText}>{t.bienvenida.samdClaseIia}</Text>
            </View>
          </View>

          {/* Titular Principal */}
          <View style={styles.titleWrapper}>
            <Text style={styles.titleEyebrow}>{t.bienvenida.valoracionInteractivaAudicionLenguaje}</Text>
            <Text style={[styles.titleLead, isTabletLandscape && styles.titleLeadWide]}>
              
              {t.bienvenida.ruido2}
            </Text>
            <View style={styles.titleHighlightPill}>
              <Sparkles size={isTabletLandscape ? 26 : 20} color="#9A3412" strokeWidth={2} style={styles.sparkleIcon} />
              <Text style={[styles.titleHighlightText, isTabletLandscape && styles.titleHighlightWide]}>
                
                {t.bienvenida.informacionClinica2}
              </Text>
            </View>
          </View>

          {/* Descripción clínica */}
          <Text style={[styles.description, isTabletLandscape && styles.descriptionWide]}>
            
            {t.bienvenida.plataformaAvanzadaEvaluacionAudiologicaLenguaje}
          </Text>

          {/* 3 Tarjetas de Valor Clínico Enriquecidas */}
          <View style={styles.cardsContainer}>
            {/* Tarjeta 1: 12 Módulos Clínicos */}
            <View style={styles.clinicalCard}>
              <View style={[styles.cardIconBox, atoms.backgroundColorE0F2FE]}>
                <Stethoscope size={20} color="#0284C7" strokeWidth={2.2} />
              </View>
              <View style={styles.cardContent}>
                <Text style={styles.cardTitle}>{t.bienvenida.modulosBateria(ORBIT_MODULES.length)}</Text>
                <Text style={styles.cardSubtitle}>
                  
                  {t.bienvenida.audiometriaTonalCpaVerbalVoz}
                </Text>
              </View>
            </View>

            {/* Tarjeta 2: 100% On-Device · Zero-PHI */}
            <View style={styles.clinicalCard}>
              <View style={[styles.cardIconBox, atoms.backgroundColorCCFBF1]}>
                <Lock size={19} color="#0D9488" strokeWidth={2.2} />
              </View>
              <View style={styles.cardContent}>
                <Text style={styles.cardTitle}>{t.bienvenida.n100OnDeviceZeroPhi}</Text>
                <Text style={styles.cardSubtitle}>
                  
                  {t.bienvenida.dspAcusticoLocalSinSubida}
                </Text>
              </View>
            </View>

            {/* Tarjeta 3: Sello ITEMAS 2024 */}
            <View style={styles.clinicalCard}>
              <View style={[styles.cardIconBox, atoms.backgroundColorFEF3C7]}>
                <Award size={20} color="#D97706" strokeWidth={2.2} />
              </View>
              <View style={styles.cardContent}>
                <Text style={styles.cardTitle}>{t.bienvenida.selloCalidadItemas2024}</Text>
                <Text style={styles.cardSubtitle}>
                  
                  {t.bienvenida.innovacionSanitariaAvaladaInstitutoSalud}
                </Text>
              </View>
            </View>
          </View>

          {/* Botón de Acción Principal (*Primary CTA*) */}
          <Animated.View style={[styles.ctaWrapper, btnAnimatedStyle]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t.bienvenida.comenzarExploracionClinica}
              accessibilityHint={t.bienvenida.navegaPantallaCreditosEInicio}
              style={({ pressed }) => [styles.ctaButton, pressed && styles.ctaButtonPressed]}
              onPressIn={handlePressIn}
              onPressOut={handlePressOut}
              onPress={handleStart}>
              <Text style={styles.ctaButtonText}>{t.bienvenida.comenzarExploracion}</Text>
              <View style={styles.ctaArrowCircle}>
                <ArrowRight size={18} color="#FF7F00" strokeWidth={2.6} />
              </View>
            </Pressable>
          </Animated.View>

          {/* Nota regulatoria y de rigor sanitario */}
          <View style={styles.regulatoryRow}>
            <Activity size={13} color="#9C9284" />
            <Text style={styles.regulatoryNote}>
              
              {t.bienvenida.viaMedicalSystemMdr2017}
            </Text>
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const MONO = Platform.OS === 'ios' ? 'Courier' : 'monospace';

/* El anillo acustico sigue al isotipo: mismo radio relativo que el logotipo. */
const ringSize = (iconSize: number) => ({
  width: iconSize,
  height: iconSize,
  borderRadius: (iconSize * 42) / 150,
});

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F5F2EC',
  },
  blobTopLeft: {
    position: 'absolute',
    top: -120,
    left: -100,
    width: 440,
    height: 440,
    borderRadius: 220,
    backgroundColor: 'rgba(240, 174, 108, 0.18)',
  },
  blobBottomRight: {
    position: 'absolute',
    bottom: -140,
    right: -100,
    width: 460,
    height: 460,
    borderRadius: 230,
    backgroundColor: 'rgba(255, 204, 128, 0.16)',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContentLandscape: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 28,
    paddingHorizontal: 28,
  },

  /* -------------------------------------------------------------------------- */
  /* Columna Escenario Acústico Cinemático                                      */
  /* -------------------------------------------------------------------------- */
  stageColumn: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  stageColumnLandscape: {
    marginBottom: 0,
  },
  stageCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E8E2D5',
    shadowColor: '#2B2620',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 14,
    elevation: 3,
    alignItems: 'center',
  },
  stageCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 8,
    marginBottom: 8,
  },
  signalLiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F0FDF4',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DCFCE7',
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#16A34A',
  },
  signalLiveText: {
    fontFamily: MONO,
    fontSize: 11,
    fontWeight: '700',
    color: '#15803D',
    letterSpacing: 0.6,
  },
  signalSamplingText: {
    fontFamily: MONO,
    fontSize: 11,
    color: '#8C8275',
    letterSpacing: 0.4,
  },
  fieldContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    backgroundColor: '#FAF8F4',
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#EFEAE1',
  },
  particleTrack: {
    position: 'absolute',
    left: 0,
    right: 0,
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
    width: '60%',
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  iconWrapper: {
    position: 'absolute',
    left: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: 'rgba(255, 127, 0, 0.38)',
  },
  stageLabelsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 4,
    marginTop: 14,
  },
  stagePillLeft: {
    backgroundColor: '#F3F0E9',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  stagePillRight: {
    backgroundColor: '#FEF3C7',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  stageLabelLeft: {
    fontFamily: MONO,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: '#6E6459',
  },
  stageLabelRight: {
    fontFamily: MONO,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: '#B45309',
  },
  arrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 8,
  },
  arrowLine: {
    flex: 1,
    height: 1.5,
    backgroundColor: '#D1C7B8',
  },
  arrowHead: {
    color: '#B45309',
    fontSize: 14,
    marginLeft: 3,
    fontWeight: '700',
  },
  /* -------------------------------------------------------------------------- */
  /* Columna Narrativa y Tarjetas Clínicas                                      */
  /* -------------------------------------------------------------------------- */
  narrativeColumn: {
    maxWidth: 520,
    alignItems: 'flex-start',
  },
  narrativeColumnLandscape: {
    flex: 1,
  },
  wordmarkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 8,
  },
  wordmark: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  wordmarkVia: {
    fontSize: 40,
    fontWeight: '800',
    letterSpacing: -1.5,
    lineHeight: 44,
    color: '#2B2620',
  },
  wordmarkPlus: {
    fontSize: 40,
    fontWeight: '800',
    letterSpacing: -0.5,
    lineHeight: 44,
    color: '#FF7F00',
  },
  samdHeaderPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#CCFBF1',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#99F6E4',
  },
  samdHeaderText: {
    fontFamily: MONO,
    fontSize: 11,
    fontWeight: '700',
    color: '#0F766E',
    letterSpacing: 0.3,
  },
  titleWrapper: {
    marginBottom: 10,
  },
  titleEyebrow: {
    fontFamily: MONO,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    color: '#B45309',
    marginBottom: 6,
  },
  titleLead: {
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: -1,
    lineHeight: 42,
    color: '#2B2620',
  },
  titleLeadWide: {
    fontSize: 44,
    lineHeight: 50,
    letterSpacing: -1.2,
  },
  titleHighlightPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FED7AA',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  sparkleIcon: {
    marginRight: 6,
  },
  titleHighlightText: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.8,
    lineHeight: 40,
    color: '#9A3412',
  },
  titleHighlightWide: {
    fontSize: 40,
    lineHeight: 48,
    letterSpacing: -1,
  },
  description: {
    fontSize: 14.5,
    color: '#524B42',
    lineHeight: 22,
    marginBottom: 14,
  },
  descriptionWide: {
    fontSize: 16,
    lineHeight: 25,
  },

  /* Tarjetas Clínicas */
  cardsContainer: {
    gap: 9,
    width: '100%',
    marginBottom: 14,
  },
  clinicalCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 11,
    paddingHorizontal: 13,
    borderWidth: 1,
    borderColor: '#E8E2D5',
    shadowColor: '#2B2620',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1.5,
  },
  cardIconBox: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#2B2620',
    marginBottom: 2,
  },
  cardSubtitle: {
    fontSize: 12,
    color: '#6B635A',
    lineHeight: 16,
  },

  /* Botón CTA Principal */
  ctaWrapper: {
    width: '100%',
    marginTop: 4,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF7F00',
    borderRadius: 28,
    height: 56,
    paddingHorizontal: 26,
    shadowColor: '#FF7F00',
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  ctaButtonPressed: {
    opacity: 0.94,
  },
  ctaButtonText: {
    color: '#FFFFFF',
    fontSize: 16.5,
    fontWeight: '800',
    letterSpacing: 0.2,
    marginRight: 10,
  },
  ctaArrowCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Pie regulatorio */
  regulatoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
  },
  regulatoryNote: {
    fontFamily: MONO,
    fontSize: 11,
    color: '#9C9284',
    letterSpacing: 0.3,
  },
});

