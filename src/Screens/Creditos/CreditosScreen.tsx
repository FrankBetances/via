import React, { useEffect, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
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
/*  CreditosScreen — quién hay detrás de VIA+.                                 */
/*  Mismo lenguaje visual que Bienvenida (crema + naranja + etiquetas mono).   */
/*                                                                            */
/*  El emblema es el isotipo V+ rodeado de anillos de pulso y de DOCE puntos   */
/*  diminutos: uno por cada módulo de la batería, del CAP a Funciones          */
/*  Ejecutivas (ver orbitModules.ts). Cada punto lleva su radio, su periodo y  */
/*  el color de su módulo, así que la constelación no gira en bloque: se       */
/*  recompone sola y nunca repite la misma figura.                             */
/*                                                                            */
/*  La tarjeta de autoría es una banda de partículas: fluyen caóticas desde    */
/*  la izquierda y, tras atravesar el nombre, se ordenan en carriles naranjas  */
/*  (el nombre actúa como filtro que ordena el caos). El CTA continúa a la     */
/*  selección de perfil profesional (esta ruta solo existe en el flujo de      */
/*  acceso, antes de abrir sesión).                                            */
/* -------------------------------------------------------------------------- */

type Props = NativeStackScreenProps<RootStackParamList, 'Creditos'>;

const YEAR = new Date().getFullYear();
const EMBLEM = 92;
const RING_DURATION = 2600;
/** El isotipo tiene rx = 42 sobre una tesela de 150: los anillos lo copian. */
const EMBLEM_RADIUS = EMBLEM * (42 / 150);

/* Onda separadora (perfil simétrico, "respira" por barra). */
const WAVE_BARS = [10, 18, 30, 44, 56, 44, 30, 18, 10];

/* Lienzo de la constelación: el radio mayor más aire para el punto y su halo. */
const ORBIT_CANVAS = Math.ceil(ORBIT_MAX_REACH + 12) * 2;
/** Achatamiento vertical: da profundidad sin salirse del ancho de pantalla. */
const ORBIT_TILT = 0.84;

const ORBIT_LABEL = `Los doce módulos de la batería VIA+ orbitando el isotipo: ${ORBIT_MODULES.map(
  m => m.label,
).join(', ')}.`;

/* Idiomas/variantes de la batería y motor de voz neural abierto que los hace
   posibles (ver docs/design/integracion-*.md y tools/nos/). */
const LANGUAGE_CREDITS = [
  { flag: '🇩🇴', name: 'Quisqueya Habla', role: 'Variante en español dominicano (es-DO): banco y locuciones propios' },
  { flag: '🇪🇸', name: 'Español (España)', role: 'Idioma base de la batería de evaluación' },
  { flag: '🌐', name: 'Proxecto Nós · ILENIA', role: 'Voz neural Celtia (gallego) — TTS abierto (VITS/Coqui)' },
  { flag: '🎙️', name: 'Piper · rhasspy/piper-voices', role: 'Voces neuronales VITS para español y variantes' },
  { flag: '🔊', name: 'eSpeak NG', role: 'Síntesis de respaldo offline (español latinoamericano)' },
];

/* ----------------------- banda de partículas del autor ---------------------- */
/*  Cada partícula recorre la banda de izquierda a derecha en bucle. En la     */
/*  mitad izquierda deambula caótica (trayectoria aleatoria + temblor, tonos   */
/*  apagados y tamaños dispares); al atravesar la zona del nombre (55–78 % del */
/*  ancho) converge a su carril: y fija, temblor nulo, naranja de marca y      */
/*  opacidad plena. Todo se calcula en el hilo de UI a partir de un único      */
/*  valor de progreso por partícula.                                           */

const BAND_H = 118;
const PARTICLE_COUNT = 30;
/** Carriles ordenados (offsets respecto al centro de la banda). */
const LANES = [-18, -6, 6, 18];
const CHAOS_COLORS = ['#C9BEA9', '#B3A791', '#D8CFC0', '#F0AE6C'];
const ORDER_COLOR = '#FF7F00';

/* Generación determinista (misma constelación en cada montaje). */
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
  /** Trayectoria caótica: y (px) en 5 puntos del recorrido. */
  yStops: number[];
  /** Carril al que converge tras atravesar el nombre. */
  lane: number;
  phase: number;
  wobbleAmp: number;
  wobbleFreq: number;
}

const PARTICLES: ParticleCfg[] = Array.from({ length: PARTICLE_COUNT }, (_, id) => ({
  id,
  duration: 5200 + prand() * 4200,
  delay: prand() * 7000,
  size: 3.5 + prand() * 3.5,
  color: CHAOS_COLORS[id % CHAOS_COLORS.length],
  yStops: Array.from({ length: 5 }, () => 16 + prand() * (BAND_H - 32)),
  lane: LANES[id % LANES.length],
  phase: prand() * Math.PI * 2,
  wobbleAmp: 3 + prand() * 6,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width]);

  const style = useAnimatedStyle(() => {
    const x = interpolate(t.value, [0, 1], [-16, width + 16]);
    // Grado de orden: 0 = caos (antes del nombre), 1 = carril (después).
    const k = interpolate(x, [width * 0.55, width * 0.78], [0, 1], Extrapolation.CLAMP);
    const chaosY = interpolate(t.value, [0, 0.25, 0.5, 0.75, 1], cfg.yStops);
    const wobble =
      Math.sin(t.value * cfg.wobbleFreq * 2 * Math.PI + cfg.phase) * cfg.wobbleAmp * (1 - k);
    const orderY = BAND_H / 2 + cfg.lane + Math.sin(x / 30 + cfg.phase) * 2 * k;
    const y = chaosY + (orderY - chaosY) * k + wobble;
    // Evita el "pop" al reiniciar el bucle en los bordes.
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

/* --------------------------- punto en órbita ------------------------------ */
/*  Un módulo de la batería. Cada punto tiene su propio reloj (periodo propio  */
/*  = velocidad propia), así que la figura del conjunto nunca se repite. La    */
/*  órbita se pinta achatada y el punto se aclara y encoge en la mitad         */
/*  superior, la que "pasa por detrás" del isotipo: eso es toda la             */
/*  profundidad que necesita.                                                  */

function OrbitDot({ module: m }: { module: OrbitModule }) {
  const spin = useSharedValue(0);

  useEffect(() => {
    spin.value = withRepeat(
      withTiming(360, { duration: m.durationMs, easing: Easing.linear }),
      -1,
      false,
    );
    return () => cancelAnimation(spin);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const style = useAnimatedStyle(() => {
    const rad = ((m.phase + spin.value) * Math.PI) / 180;
    // 0 = mitad de atrás (arriba), 1 = mitad de delante (abajo).
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

function WaveBar({ index, height }: { index: number; height: number }) {
  const breathe = useSharedValue(0);
  useEffect(() => {
    breathe.value = withDelay(
      index * 120,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: 1500, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        false,
      ),
    );
    return () => cancelAnimation(breathe);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const style = useAnimatedStyle(() => ({
    transform: [{ scaleY: interpolate(breathe.value, [0, 1], [0.8, 1]) }],
    opacity: interpolate(breathe.value, [0, 1], [0.75, 1]),
  }));
  return <Animated.View style={[styles.waveBar, { height }, style]} />;
}

function SectionRule({ label }: { label: string }) {
  return (
    <View style={styles.sectionRow}>
      <View style={styles.sectionLine} />
      <Text style={styles.sectionLabel}>{label}</Text>
      <View style={styles.sectionLine} />
    </View>
  );
}

function PartnerRow({
  mark,
  name,
  role,
}: {
  mark: React.ReactNode;
  name: string;
  role: string;
}) {
  return (
    <View style={styles.partnerRow}>
      <View style={styles.partnerLogo}>{mark}</View>
      <View style={{ flex: 1 }}>
        <Text style={styles.partnerName}>{name}</Text>
        <Text style={styles.partnerRole}>{role}</Text>
      </View>
    </View>
  );
}

export default function CreditosScreen({ navigation }: Props) {
  const ring1 = useSharedValue(0);
  const ring2 = useSharedValue(0);
  const float = useSharedValue(0);
  const [bandWidth, setBandWidth] = useState(0);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      <StatusBar barStyle="dark-content" backgroundColor="#F1ECE2" />
      <View style={styles.blobTopRight} pointerEvents="none" />
      <View style={styles.blobBottomLeft} pointerEvents="none" />

      <Header animationType="expand" />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}>
        {/* ----- overline ----- */}
        <View style={styles.badge}>
          <View style={styles.badgeDot} />
          <Text style={styles.badgeText}>VIA+ · CDSS AUDICIÓN Y LENGUAJE</Text>
        </View>

        {/* ----- emblema: isotipo V+ y los doce módulos en órbita ----- */}
        <Animated.View
          style={[styles.emblemWrapper, floatStyle]}
          accessible
          accessibilityRole="image"
          accessibilityLabel={ORBIT_LABEL}>
          <Animated.View style={[styles.ring, ring1Style]} />
          <Animated.View style={[styles.ring, ring2Style]} />
          <View style={styles.emblem}>
            <ViaIcon size={EMBLEM} />
          </View>
          <View style={styles.orbitLayer} pointerEvents="none">
            {ORBIT_MODULES.map(m => (
              <OrbitDot key={m.key} module={m} />
            ))}
          </View>
        </Animated.View>

        {/* ----- título ----- */}
        <Text style={styles.overline}>DOCE MÓDULOS · UNA SOLA BATERÍA</Text>
        <Text style={styles.title}>
          VIA<Text style={styles.titleAccent}>+</Text>
        </Text>
        <Text style={styles.subtitle}>
          Tecnología clínica al servicio de la evaluación y la rehabilitación del lenguaje.
        </Text>

        {/* ----- onda separadora ----- */}
        <View style={styles.wave}>
          {WAVE_BARS.map((h, i) => (
            <WaveBar key={i} index={i} height={h} />
          ))}
        </View>

        {/* ----- autoría y dirección clínica ----- */}
        <SectionRule label="AUTORÍA Y DIRECCIÓN CLÍNICA" />

        {/* Banda de partículas: caos → nombre → orden. */}
        <View style={styles.authorCard}>
          <View style={styles.authorAccent} />
          <View
            style={styles.particleBand}
            onLayout={e => setBandWidth(Math.round(e.nativeEvent.layout.width))}>
            {bandWidth > 0
              ? PARTICLES.map(cfg => <FlowParticle key={cfg.id} cfg={cfg} width={bandWidth} />)
              : null}
            <View style={styles.authorOverlay} pointerEvents="none">
              <View style={styles.authorLogo}>
                <DrBetancesMark size={46} />
              </View>
              <Text style={styles.authorName}>Dr. Frank Alberto Betances</Text>
              <Text style={styles.authorRole}>Otorrinolaringólogo y desarrollador</Text>
            </View>
          </View>
        </View>

        {/* ----- colaboradores ----- */}
        <SectionRule label="COLABORADORES" />

        <View style={styles.partnerCard}>
          <PartnerRow
            mark={<QuisqueyaHablaMark size={40} />}
            name="Quisqueya Habla"
            role="Proyecto FONDOCYT · variante dominicana de la batería"
          />
          <View style={styles.partnerDivider} />
          <PartnerRow
            mark={<AcoprosMark size={40} />}
            name="ACOPROS"
            role="Asociación de Colaboración y Promoción del Sordo"
          />
          <View style={styles.partnerDivider} />
          <PartnerRow
            mark={<EarlifyMark size={40} />}
            name="Earlify Health"
            role="Tecnología e ingeniería"
          />
        </View>

        {/* ----- voces y lenguajes ----- */}
        <SectionRule label="VOCES Y LENGUAJES" />

        <View style={styles.langCard}>
          {LANGUAGE_CREDITS.map((c, i) => (
            <View key={c.name} style={[styles.langRow, i > 0 && styles.langRowDivider]}>
              <View style={styles.langFlag}>
                <Text style={styles.langFlagText}>{c.flag}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.langName}>{c.name}</Text>
                <Text style={styles.langRole}>{c.role}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* ----- calidad y normativa ----- */}
        <SectionRule label="CALIDAD Y NORMATIVA" />

        <View style={styles.sealCard}>
          <ItemasSealMark size={64} />
          <Text style={styles.sealTitle}>Sello de Calidad ITEMAS 2024</Text>
          <Text style={styles.sealRole}>Calidad en innovación tecnológica</Text>
        </View>

        <View style={styles.sealRow}>
          <View style={styles.sealChip}>
            <Text style={styles.sealChipText}>SaMD · Clase IIa</Text>
          </View>
          <View style={styles.sealChip}>
            <Text style={styles.sealChipText}>MDR 2017/745</Text>
          </View>
          <View style={styles.sealChip}>
            <Text style={styles.sealChipText}>Lugo · Galicia · {YEAR}</Text>
          </View>
        </View>
      </ScrollView>

      {/* ----- CTA ----- */}
      <View style={styles.footer}>
        <Pressable
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          onPress={() => navigation.navigate('SeleccionProfesional')}>
          <Text style={styles.buttonText}>Comenzar</Text>
          <Text style={styles.buttonArrow}>→</Text>
        </Pressable>
      </View>
    </View>
  );
}

const MONO = Platform.OS === 'ios' ? 'Courier' : 'monospace';

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F1ECE2',
  },
  blobTopRight: {
    position: 'absolute',
    top: -150,
    right: -120,
    width: 380,
    height: 380,
    borderRadius: 190,
    backgroundColor: 'rgba(240,174,108,0.18)',
  },
  blobBottomLeft: {
    position: 'absolute',
    bottom: -170,
    left: -130,
    width: 360,
    height: 360,
    borderRadius: 180,
    backgroundColor: 'rgba(255,204,128,0.14)',
  },
  scroll: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 130,
  },

  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E9E2D5',
    paddingHorizontal: 13,
    paddingVertical: 6,
    marginTop: 4,
  },
  badgeDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#FF7F00',
  },
  badgeText: {
    fontFamily: MONO,
    fontSize: 9,
    letterSpacing: 0.8,
    fontWeight: '700',
    color: '#8A8274',
  },

  emblemWrapper: {
    width: ORBIT_CANVAS,
    height: ORBIT_CANVAS * ORBIT_TILT,
    maxWidth: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
  },
  ring: {
    position: 'absolute',
    width: EMBLEM,
    height: EMBLEM,
    borderRadius: EMBLEM_RADIUS,
    borderWidth: 2,
    borderColor: 'rgba(255,127,0,0.4)',
  },
  emblem: {
    borderRadius: EMBLEM_RADIUS,
    shadowColor: '#FF7F00',
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  orbitLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orbitDot: {
    position: 'absolute',
    shadowOpacity: 0.5,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },

  overline: {
    fontFamily: MONO,
    fontSize: 10,
    letterSpacing: 2,
    fontWeight: '700',
    color: '#B3A791',
    marginTop: 14,
    textAlign: 'center',
  },
  title: {
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: -1,
    color: '#3A352F',
    marginTop: 4,
    textAlign: 'center',
  },
  titleAccent: {
    color: '#FF7F00',
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 21,
    color: '#7A746B',
    textAlign: 'center',
    maxWidth: 300,
    marginTop: 8,
  },

  wave: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 56,
    marginTop: 20,
    marginBottom: 6,
  },
  waveBar: {
    width: 6,
    borderRadius: 3,
    backgroundColor: '#FF7F00',
  },

  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    alignSelf: 'stretch',
    marginTop: 20,
    marginBottom: 10,
  },
  sectionLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5DECF',
  },
  sectionLabel: {
    fontFamily: MONO,
    fontSize: 9,
    letterSpacing: 1.4,
    fontWeight: '700',
    color: '#A89F93',
  },

  authorCard: {
    alignSelf: 'stretch',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#EFE8DB',
    overflow: 'hidden',
  },
  authorAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: '#FF7F00',
    zIndex: 1,
  },
  particleBand: {
    alignSelf: 'stretch',
    height: BAND_H + 46,
    justifyContent: 'center',
  },
  particle: {
    position: 'absolute',
    left: 0,
    top: 23, // centra la franja de partículas (BAND_H) dentro de la banda
  },
  authorOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  authorLogo: {
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 8,
  },
  authorName: {
    // 16 y no 17: «Dr. Frank Alberto Betances» ocupa casi todo el ancho de la
    // tarjeta en un móvil de 360 dp y a 17 se partía en dos líneas.
    fontSize: 16,
    fontWeight: '800',
    color: '#3A352F',
    textAlign: 'center',
  },
  authorRole: {
    fontSize: 11,
    color: '#8A8274',
    marginTop: 3,
    textAlign: 'center',
  },

  partnerCard: {
    alignSelf: 'stretch',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#EFE8DB',
    paddingHorizontal: 14,
  },
  partnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  partnerDivider: {
    height: 1,
    backgroundColor: '#F1ECE2',
  },
  partnerLogo: {
    width: 40,
    height: 40,
    borderRadius: 13,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#EFE8DB',
  },
  partnerName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#3A352F',
  },
  partnerRole: {
    fontSize: 10.5,
    lineHeight: 15,
    color: '#8A8274',
    marginTop: 2,
  },

  langCard: {
    alignSelf: 'stretch',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#EFE8DB',
    paddingHorizontal: 14,
  },
  langRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  langRowDivider: {
    borderTopWidth: 1,
    borderTopColor: '#F1ECE2',
  },
  langFlag: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: '#F7F3EA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  langFlagText: {
    fontSize: 17,
  },
  langName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#3A352F',
  },
  langRole: {
    fontSize: 10.5,
    lineHeight: 15,
    color: '#8A8274',
    marginTop: 2,
  },

  sealCard: {
    alignSelf: 'stretch',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#EFE8DB',
    paddingVertical: 16,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  sealTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#3A352F',
    marginTop: 8,
    textAlign: 'center',
  },
  sealRole: {
    fontSize: 10.5,
    color: '#8A8274',
    marginTop: 2,
    textAlign: 'center',
  },

  sealRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 7,
    marginTop: 20,
  },
  sealChip: {
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderWidth: 1,
    borderColor: '#E5DECF',
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  sealChipText: {
    fontFamily: MONO,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: '#8A8274',
  },

  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 24,
    paddingBottom: 28,
    paddingTop: 12,
    alignItems: 'center',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    backgroundColor: '#FF7F00',
    borderRadius: 999,
    paddingHorizontal: 44,
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
});
