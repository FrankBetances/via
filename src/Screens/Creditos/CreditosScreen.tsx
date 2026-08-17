import React, { useEffect, useState } from 'react';
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
import Animated, {
  cancelAnimation,
  Easing,
  Extrapolation,
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ArrowRight, Award, Flame, Globe2, Sparkles, UserCheck } from 'lucide-react-native';

import { Header } from '@/Components/Common';
import ViaIcon from '@/Components/Common/ViaIcon';
import { RootStackParamList } from '@/Navigators';
import {
  AcoprosMark,
  DrBetancesMark,
  EarlifyMark,
  ItemasSealMark,
  QuisqueyaHablaMark,
} from './BrandMarks';
import { ORBIT_MODULES, ORBIT_MAX_REACH, OrbitModule } from './orbitModules';

/* -------------------------------------------------------------------------- */
/*  CreditosScreen — Quién hay detrás de VIA+ en formato Tableta 4:3           */
/*  Diseño de 2 columnas panorámicas: Emblema y Autor a la izquierda,          */
/*  Alianzas, Voces y Calidad a la derecha, con Action Dock inferior.          */
/* -------------------------------------------------------------------------- */

type Props = NativeStackScreenProps<RootStackParamList, 'Creditos'>;

const YEAR = new Date().getFullYear();
const EMBLEM = 88;
const RING_DURATION = 2600;
const ORBIT_TILT = 0.82;

const ORBIT_LABEL = `Los doce módulos de la batería VIA+ orbitando el isotipo: ${ORBIT_MODULES.map(
  m => m.label,
).join(', ')}.`;

const LANGUAGE_CREDITS = [
  { flag: '🇩🇴', name: 'Quisqueya Habla (es-DO)', role: 'Variante dominicana · 86 locuciones aprobadas (FONDOCYT)' },
  { flag: '🇪🇸', name: 'Español (España)', role: 'Idioma base de la batería de evaluación clínica' },
  { flag: '🌐', name: 'Proxecto Nós (Gallego)', role: 'Voz neuronal Celtia (ILENIA) aprobada por ACOPROS' },
];

/* ----------------------- Banda de partículas del autor ---------------------- */
const BAND_H = 110;
const PARTICLE_COUNT = 26;
const LANES = [-16, -5, 5, 16];
const CHAOS_COLORS = ['#C9BEA9', '#B3A791', '#D8CFC0', '#F0AE6C'];
const ORDER_COLOR = '#FF7F00';

const makeRand = (seed: number) => () => {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
};
const prand = makeRand(20260710);

interface ParticleCfg {
  id: number;
  duration: number;
  delay: number;
  size: number;
  color: string;
  yStops: number[];
  lane: number;
  phase: number;
  wobbleAmp: number;
  wobbleFreq: number;
}

const PARTICLES: ParticleCfg[] = Array.from({ length: PARTICLE_COUNT }, (_, id) => ({
  id,
  duration: 5000 + prand() * 3800,
  delay: prand() * 6000,
  size: 3 + prand() * 3.5,
  color: CHAOS_COLORS[id % CHAOS_COLORS.length],
  yStops: Array.from({ length: 5 }, () => 14 + prand() * (BAND_H - 28)),
  lane: LANES[id % LANES.length],
  phase: prand() * Math.PI * 2,
  wobbleAmp: 3 + prand() * 5,
  wobbleFreq: 2 + prand() * 3,
}));

function FlowParticle({ cfg, width }: { cfg: ParticleCfg; width: number }) {
  const t = useSharedValue(0);

  useEffect(() => {
    t.value = 0;
    t.value = withDelay(
      cfg.delay,
      withRepeat(withTiming(1, { duration: cfg.duration, easing: Easing.linear }), -1, false),
    );
    return () => cancelAnimation(t);
  }, [width]);

  const style = useAnimatedStyle(() => {
    const x = interpolate(t.value, [0, 1], [-16, width + 16]);
    const k = interpolate(x, [width * 0.50, width * 0.76], [0, 1], Extrapolation.CLAMP);
    const chaosY = interpolate(t.value, [0, 0.25, 0.5, 0.75, 1], cfg.yStops);
    const wobble =
      Math.sin(t.value * cfg.wobbleFreq * 2 * Math.PI + cfg.phase) * cfg.wobbleAmp * (1 - k);
    const orderY = BAND_H / 2 + cfg.lane + Math.sin(x / 28 + cfg.phase) * 2 * k;
    const y = chaosY + (orderY - chaosY) * k + wobble;
    const edgeFade = interpolate(t.value, [0, 0.05, 0.95, 1], [0, 1, 1, 0]);
    return {
      transform: [
        { translateX: x - cfg.size / 2 },
        { translateY: y - cfg.size / 2 },
        { scale: 1 - 0.2 * (1 - k) },
      ],
      opacity: (0.38 + 0.62 * k) * edgeFade,
      backgroundColor: interpolateColor(k, [0, 1], [cfg.color, ORDER_COLOR]),
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.particle,
        { width: cfg.size, height: cfg.size, borderRadius: cfg.size / 2 },
        style,
      ]}
    />
  );
}

/* --------------------------- Punto en órbita ------------------------------ */
function OrbitDot({ module: m }: { module: OrbitModule }) {
  const spin = useSharedValue(0);

  useEffect(() => {
    spin.value = withRepeat(
      withTiming(360, { duration: m.durationMs, easing: Easing.linear }),
      -1,
      false,
    );
    return () => cancelAnimation(spin);
  }, []);

  const style = useAnimatedStyle(() => {
    const rad = ((m.phase + spin.value) * Math.PI) / 180;
    const depth = (Math.sin(rad) + 1) / 2;
    return {
      transform: [
        { translateX: Math.cos(rad) * m.radius },
        { translateY: Math.sin(rad) * m.radius * ORBIT_TILT },
        { scale: 0.76 + 0.36 * depth },
      ],
      opacity: 0.4 + 0.6 * depth,
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.orbitDot,
        {
          width: m.size,
          height: m.size,
          borderRadius: m.size / 2,
          backgroundColor: m.color,
          shadowColor: m.color,
        },
        style,
      ]}
    />
  );
}

export default function CreditosScreen({ navigation }: Props) {
  const { width: winW } = useWindowDimensions();
  const isTabletLandscape = winW >= 850;
  const [bandWidth, setBandWidth] = useState(0);

  const ring1 = useSharedValue(0);
  const ring2 = useSharedValue(0);
  const float = useSharedValue(0);

  useEffect(() => {
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
    float.value = withRepeat(
      withSequence(
        withTiming(-5, { duration: 2800, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 2800, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
    return () => {
      cancelAnimation(ring1);
      cancelAnimation(ring2);
      cancelAnimation(float);
    };
  }, []);

  const ring1Style = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(ring1.value, [0, 1], [0.95, 1.75]) }],
    opacity: interpolate(ring1.value, [0, 1], [0.4, 0]),
  }));
  const ring2Style = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(ring2.value, [0, 1], [0.95, 1.75]) }],
    opacity: interpolate(ring2.value, [0, 1], [0.4, 0]),
  }));
  const floatStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: float.value }],
  }));

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#F5F2EC" />
      <View style={styles.blobTopRight} pointerEvents="none" />
      <View style={styles.blobBottomLeft} pointerEvents="none" />

      {/* Top Navbar */}
      <View style={styles.topNavbar}>
        <View style={styles.navLogoRow}>
          <View style={styles.iconSquare}>
            <Flame size={18} color="#FF7F00" fill="#FF7F00" />
          </View>
          <Text style={styles.navLogoText}>
            VIA<Text style={{ color: '#FF7F00' }}>+</Text>
          </Text>
        </View>
        <Text style={styles.navTitle}>Créditos</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[
          styles.scroll,
          isTabletLandscape && styles.scrollLandscape,
        ]}
        showsVerticalScrollIndicator={false}>
        
        {/* ================================================================== */}
        {/* COLUMNA IZQUIERDA: Emblema de Órbita + Tarjeta del Autor           */}
        {/* ================================================================== */}
        <View style={[styles.leftColumn, isTabletLandscape && styles.columnHalf]}>
          {/* Emblema de 12 módulos orbitando */}
          <View style={styles.emblemCard}>
            <Text style={styles.emblemHeading}>DOCE MÓDULOS · UNA SOLA BATERÍA</Text>
            
            <Animated.View
              style={[styles.emblemWrapper, floatStyle]}
              accessible
              accessibilityRole="image"
              accessibilityLabel={ORBIT_LABEL}>
              <Animated.View style={[styles.ring, ring1Style]} />
              <Animated.View style={[styles.ring, ring2Style]} />
              
              <View style={styles.emblemCore}>
                <Text style={styles.emblemCoreText}>
                  VIA<Text style={{ color: '#FF7F00' }}>+</Text>
                </Text>
              </View>

              <View style={styles.orbitLayer} pointerEvents="none">
                {ORBIT_MODULES.map(m => (
                  <OrbitDot key={m.key} module={m} />
                ))}
              </View>
            </Animated.View>
          </View>

          {/* Tarjeta del Autor (Dr. Betances) */}
          <View style={styles.authorCard}>
            <View style={styles.authorBadgeRow}>
              <UserCheck size={14} color="#EA580C" />
              <Text style={styles.authorBadgeText}>Autor</Text>
            </View>

            <View
              style={styles.particleBand}
              onLayout={e => setBandWidth(Math.round(e.nativeEvent.layout.width))}>
              {bandWidth > 0
                ? PARTICLES.map(cfg => <FlowParticle key={cfg.id} cfg={cfg} width={bandWidth} />)
                : null}
            </View>

            <View style={styles.authorInfo}>
              <Text style={styles.authorName}>Dr. Frank Alberto Betances Reinoso</Text>
              <Text style={styles.authorRole}>Otorrinolaringólogo & Desarrollador Principal</Text>
            </View>
          </View>
        </View>

        {/* ================================================================== */}
        {/* COLUMNA DERECHA: Colaboradores, Voces y Calidad Regulatoria        */}
        {/* ================================================================== */}
        <View style={[styles.rightColumn, isTabletLandscape && styles.columnHalf]}>
          {/* Tarjeta 1: Entidades Colaboradoras */}
          <View style={styles.cardBlock}>
            <Text style={styles.cardBlockTitle}>Institucional Partners Card</Text>
            
            <View style={styles.partnerList}>
              <View style={styles.partnerItem}>
                <View style={styles.partnerIconBox}>
                  <QuisqueyaHablaMark size={32} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.partnerName}>Quisqueya Habla (FONDOCYT)</Text>
                  <Text style={styles.partnerSubtitle}>Ensayo clínico y validación de instrumentos</Text>
                </View>
              </View>

              <View style={styles.divider} />

              <View style={styles.partnerItem}>
                <View style={styles.partnerIconBox}>
                  <AcoprosMark size={32} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.partnerName}>ACOPROS</Text>
                  <Text style={styles.partnerSubtitle}>Asociación de Colaboración y Promoción del Sordo</Text>
                </View>
              </View>

              <View style={styles.divider} />

              <View style={styles.partnerItem}>
                <View style={styles.partnerIconBox}>
                  <EarlifyMark size={32} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.partnerName}>Earlify Health</Text>
                  <Text style={styles.partnerSubtitle}>Tecnología e ingeniería clínica</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Tarjeta 2: Voces y Variantes */}
          <View style={styles.cardBlock}>
            <Text style={styles.cardBlockTitle}>Voices & Language Variants Card</Text>
            
            <View style={styles.langList}>
              {LANGUAGE_CREDITS.map((item, idx) => (
                <View key={idx} style={[styles.langItem, idx > 0 && { marginTop: 10 }]}>
                  <Text style={styles.langFlag}>{item.flag}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.langName}>{item.name}</Text>
                    <Text style={styles.langRole}>{item.role}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>

          {/* Tarjeta 3: Calidad y Marco Regulatorio */}
          <View style={styles.cardBlock}>
            <Text style={styles.cardBlockTitle}>Regulatory & Quality Card</Text>
            
            <View style={styles.sealRow}>
              <ItemasSealMark size={36} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.sealTitle}>Sello ITEMAS 2024</Text>
                <Text style={styles.sealSubtitle}>Innovación tecnológica en salud</Text>
              </View>
            </View>

            <View style={styles.chipsRow}>
              <View style={styles.chipPill}>
                <Text style={styles.chipText}>SaMD Clase IIa</Text>
              </View>
              <View style={styles.chipPill}>
                <Text style={styles.chipText}>MDR 2017/745</Text>
              </View>
              <View style={styles.chipPill}>
                <Text style={styles.chipText}>Lugo, Galicia</Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Action Dock Inferior */}
      <View style={styles.actionDock}>
        <Pressable
          style={({ pressed }) => [styles.dockButton, pressed && styles.dockButtonPressed]}
          onPress={() => navigation.navigate('SeleccionProfesional')}>
          <Text style={styles.dockButtonText}>Comenzar Selección Profesional</Text>
          <ArrowRight size={18} color="#FFFFFF" strokeWidth={2.5} />
        </Pressable>
      </View>
    </View>
  );
}

const MONO = Platform.OS === 'ios' ? 'Courier' : 'monospace';

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F5F2EC',
  },
  blobTopRight: {
    position: 'absolute',
    top: -140,
    right: -100,
    width: 380,
    height: 380,
    borderRadius: 190,
    backgroundColor: 'rgba(240, 174, 108, 0.16)',
  },
  blobBottomLeft: {
    position: 'absolute',
    bottom: -150,
    left: -100,
    width: 380,
    height: 380,
    borderRadius: 190,
    backgroundColor: 'rgba(255, 204, 128, 0.14)',
  },
  topNavbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#EDE7DC',
  },
  navLogoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  iconSquare: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navLogoText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#2B2620',
  },
  navTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2B2620',
  },
  scroll: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 100,
  },
  scrollLandscape: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 24,
    paddingHorizontal: 36,
  },
  leftColumn: {
    gap: 20,
    marginBottom: 20,
  },
  rightColumn: {
    gap: 16,
    marginBottom: 20,
  },
  columnHalf: {
    flex: 1,
    marginBottom: 0,
  },

  /* Emblema */
  emblemCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingVertical: 20,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EDE7DC',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  emblemHeading: {
    fontFamily: MONO,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: '#2B2620',
    marginBottom: 16,
  },
  emblemWrapper: {
    width: 200,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: EMBLEM + 30,
    height: EMBLEM + 30,
    borderRadius: (EMBLEM + 30) / 2,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 127, 0, 0.35)',
  },
  emblemCore: {
    width: EMBLEM,
    height: EMBLEM,
    borderRadius: EMBLEM / 2,
    backgroundColor: '#FFF7ED',
    borderWidth: 2,
    borderColor: '#FF7F00',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF7F00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  emblemCoreText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#2B2620',
  },
  orbitLayer: {
    position: 'absolute',
    width: 200,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orbitDot: {
    position: 'absolute',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.4,
    shadowRadius: 2,
    elevation: 2,
  },

  /* Autor */
  authorCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#EDE7DC',
    borderLeftWidth: 4,
    borderLeftColor: '#FF7F00',
    overflow: 'hidden',
    padding: 18,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  authorBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  authorBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#EA580C',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  particleBand: {
    height: 36,
    width: '100%',
    marginVertical: 4,
  },
  particle: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  authorInfo: {
    marginTop: 4,
  },
  authorName: {
    fontSize: 17,
    fontWeight: '800',
    color: '#2B2620',
    lineHeight: 22,
  },
  authorRole: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748B',
    marginTop: 2,
  },

  /* Tarjetas Bloque Derecha */
  cardBlock: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#EDE7DC',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1.5,
  },
  cardBlockTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  partnerList: {
    gap: 8,
  },
  partnerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  partnerIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  partnerName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
  },
  partnerSubtitle: {
    fontSize: 11,
    color: '#64748B',
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
  },
  langList: {
    gap: 8,
  },
  langItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  langFlag: {
    fontSize: 20,
  },
  langName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
  },
  langRole: {
    fontSize: 11,
    color: '#64748B',
  },
  sealRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sealTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#B45309',
  },
  sealSubtitle: {
    fontSize: 11,
    color: '#64748B',
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chipPill: {
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  chipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },

  /* Dock Inferior */
  actionDock: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#EDE7DC',
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 8,
  },
  dockButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#FF7F00',
    borderRadius: 24,
    paddingVertical: 12,
    paddingHorizontal: 32,
    shadowColor: '#FF7F00',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  dockButtonPressed: {
    opacity: 0.9,
    transform: [{ translateY: -1 }],
  },
  dockButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
