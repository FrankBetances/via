import React, { useEffect, useReducer, useState } from 'react';
import {
  Image,
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
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ArrowLeft, ArrowRight, Globe, ShieldCheck, UserCheck } from 'lucide-react-native';

import { RootStackParamList } from '@/Navigators';
import ViaIcon from '@/Components/Common/ViaIcon';
import LanguagePickerModal from '@/Components/Common/LanguagePickerModal';
import { SESSION_LANG_LABEL } from '@/Store/slices/sessionLangs';
import { useT, UiStrings } from '@/I18n';
import { getUiLang, subscribeUiLang, UiLang } from '@/I18n/uiLang';
import {
  AcoprosMark,
  EarlifyMark,
  ItemasSealMark,
  QuisqueyaHablaMark,
} from './BrandMarks';
import { ORBIT_MODULES, OrbitModule } from './orbitModules';
import { CONTENT_MAX_WIDTH } from '@/Theme/screenLayout';

import { computeCreditsLayout } from './creditsLayout';
import { atoms } from '@/Theme/styleAtoms';

/* -------------------------------------------------------------------------- */
/*  CreditosScreen — Quién hay detrás de VIA+ en formato Tableta 4:3 y Móvil   */
/*  Diseño clínico panorámico: Emblema de órbita y autor a la izquierda,       */
/*  Alianzas, Voces y Calidad Sanitaria a la derecha, con Action Dock seguro.  */
/* -------------------------------------------------------------------------- */

type Props = NativeStackScreenProps<RootStackParamList, 'Creditos'>;

const RING_DURATION = 2600;
const ORBIT_TILT = 0.82;

/* El recuento se DEDUCE de la constelación, nunca se escribe a mano: el
   cribado ASHA entró en agosto de 2026 y esta pantalla siguió anunciando
   «DOCE MÓDULOS» encima de trece puntos. Un número escrito a mano en un
   rótulo no lo revisa nadie al añadir un módulo. */
const NUMERALES = [
  'CERO', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO',
  'NUEVE', 'DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS',
  'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE', 'VEINTE',
];

/** «TRECE» si hay palabra para el número; si no, el dígito. */
export const orbitCountWord = (n: number): string =>
  NUMERALES[n] ?? String(n);

const ORBIT_COUNT = ORBIT_MODULES.length;
const ORBIT_HEADING = `${orbitCountWord(ORBIT_COUNT)} MÓDULOS · UNA SOLA BATERÍA`;

const ORBIT_LABEL = `Los ${orbitCountWord(
  ORBIT_COUNT,
).toLowerCase()} módulos de la batería VIA+ orbitando el isotipo: ${ORBIT_MODULES.map(
  m => m.label,
).join(', ')}.`;

/**
 * Créditos de voz y localización. Se DERIVAN del catálogo activo, no son una
 * lista de datos a fuego: si no, la tarjeta se quedaría en castellano dentro de
 * una app en inglés, que es justo el defecto que este trabajo viene a cerrar.
 *
 * La atribución de los motores es OBLIGATORIA y por eso vuelve aquí: la voz
 * catalana es CC BY-SA 4.0 y la latinoamericana CC BY 4.0 (ver
 * `tools/nos/voices.json`), y las dos licencias exigen citar al autor. Se
 * habían perdido de esta pantalla al reescribir la lista.
 */
const languageCredits = (t: UiStrings) => [
  { flag: '🇪🇸', name: SESSION_LANG_LABEL.es, role: t.credits.langEs },
  { flag: '🌐', name: SESSION_LANG_LABEL.gl, role: t.credits.langGl },
  { flag: '🌐', name: SESSION_LANG_LABEL.eu, role: t.credits.langEu },
  { flag: '🌐', name: SESSION_LANG_LABEL.ca, role: t.credits.langCa },
  { flag: '🌎', name: SESSION_LANG_LABEL['es-419'], role: t.credits.langEs419 },
  { flag: '🇩🇴', name: SESSION_LANG_LABEL['es-DO'], role: t.credits.langEsDO },
  { flag: '🇺🇸', name: SESSION_LANG_LABEL.en, role: t.credits.langEn },
  // i18n-exempt: nombre propio del motor; su descripción sí sale del catálogo.
  { flag: '🎙️', name: 'Piper · rhasspy/piper-voices', role: t.credits.enginePiper },
  // i18n-exempt: nombre propio del motor.
  { flag: '🔊', name: 'eSpeak NG', role: t.credits.engineEspeak },
];


/* ----------------------- Banda de partículas del autor ---------------------- */
const BAND_H = 100;
const PARTICLE_COUNT = 26;
const LANES = [-14, -4, 4, 14];
const CHAOS_COLORS = ['#C9BEA9', '#B3A791', '#D8CFC0', '#F0AE6C'];
const ORDER_COLOR = '#FF7F00';

const makeRand = (seed: number) => () => {
  // eslint-disable-next-line no-bitwise -- el generador congruencial lineal necesita el módulo 2^31 del enmascarado; es lo que hace la señal REPRODUCIBLE entre ejecuciones.
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
function OrbitDot({ module: m, scale }: { module: OrbitModule; scale: number }) {
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
    const depth = (Math.sin(rad) + 1) / 2;
    return {
      transform: [
        { translateX: Math.cos(rad) * m.radius * scale },
        { translateY: Math.sin(rad) * m.radius * ORBIT_TILT * scale },
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
          width: m.size * scale,
          height: m.size * scale,
          borderRadius: (m.size * scale) / 2,
          backgroundColor: m.color,
          shadowColor: m.color,
        },
        style,
      ]}
    />
  );
}

export default function CreditosScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { width: winW, height: winH } = useWindowDimensions();
  const {
    twoColumns,
    isMobile,
    isSmallPhone,
    emblemScale,
    emblemBox,
    coreSize,
    ringSize,
    isotypeSize,
  } = computeCreditsLayout({ winW, winH });
  const [bandWidth, setBandWidth] = useState(0);
  const [langModalVisible, setLangModalVisible] = useState(false);

  const t = useT();

  // El idioma de INTERFAZ vive en `I18n/uiLang` (módulo con suscripción), no en
  // redux: `useT()` ya repinta el catálogo, y este espejo repinta el código que
  // se enseña en el botón. La variedad de sesión sigue en redux y la mueve
  // `setAppLanguage` desde el selector.
  const [, forceLang] = useReducer((n: number) => n + 1, 0);
  useEffect(() => subscribeUiLang(forceLang), []);
  const currentLang: UiLang = getUiLang();

  // Animaciones continuas de pulso y flotación
  const ring1 = useSharedValue(0);
  const ring2 = useSharedValue(0);
  const float = useSharedValue(0);

  // Animaciones de entrada escalonada y botón
  const introOpacity = useSharedValue(0);
  const introTranslateY = useSharedValue(18);
  const btnScale = useSharedValue(1);

  useEffect(() => {
    introOpacity.value = withTiming(1, { duration: 600, easing: Easing.out(Easing.cubic) });
    introTranslateY.value = withTiming(0, { duration: 600, easing: Easing.out(Easing.cubic) });

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
      cancelAnimation(introOpacity);
      cancelAnimation(introTranslateY);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const introStyle = useAnimatedStyle(() => ({
    opacity: introOpacity.value,
    transform: [{ translateY: introTranslateY.value }],
  }));

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

  const btnAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: btnScale.value }],
  }));

  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('Bienvenida');
    }
  };

  const handleContinue = () => {
    navigation.navigate('PresentacionLua');
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#F5F2EC" />
      <View style={styles.blobTopRight} pointerEvents="none" />
      <View style={styles.blobBottomLeft} pointerEvents="none" />

      {/* Top Navbar con insets seguros */}
      <View
        style={[
          styles.topNavbar,
          { paddingTop: Math.max(insets.top, 12) },
          isSmallPhone ? styles.topNavbarSmall : isMobile ? styles.topNavbarMobile : undefined,
        ]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t.credits.navBackA11y}
          hitSlop={8}
          style={({ pressed }) => [styles.navBackButton, pressed && styles.navButtonPressed]}
          onPress={handleBack}>
          <ArrowLeft size={isMobile ? 18 : 20} color="#2B2620" strokeWidth={2.4} />
          <View style={styles.navLogoRow}>
            <ViaIcon size={isMobile ? 22 : 24} variant="color" />
            <Text style={[styles.navLogoText, isMobile && styles.navLogoTextMobile]}>
              VIA<Text style={atoms.colorFF7F00}>+</Text>
            </Text>
          </View>
        </Pressable>

        <Text
          style={[
            styles.navTitle,
            isSmallPhone ? styles.navTitleSmall : isMobile ? styles.navTitleMobile : undefined,
          ]}
          numberOfLines={1}
          ellipsizeMode="tail">
          {t.credits.navTitle}
        </Text>

        <View style={[styles.navRightGroup, isSmallPhone && styles.navRightGroupSmall]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t.langPicker.navA11y(SESSION_LANG_LABEL[currentLang] ?? currentLang)}
            hitSlop={8}
            style={({ pressed }) => [
              styles.langNavButton,
              isSmallPhone && styles.navPillSmall,
              pressed && styles.navButtonPressed,
            ]}
            onPress={() => setLangModalVisible(true)}>
            <Globe size={isSmallPhone ? 12 : 14} color="#FF7F00" strokeWidth={2.4} />
            <Text style={[styles.langNavButtonText, isSmallPhone && styles.navPillTextSmall]}>
              {currentLang.toUpperCase()}
            </Text>
          </Pressable>

          <View style={[styles.samdBadgeNav, isSmallPhone && styles.navPillSmall]}>
            <ShieldCheck size={isSmallPhone ? 11 : 13} color="#0D9488" strokeWidth={2.2} />
            <Text style={[styles.samdBadgeNavText, isSmallPhone && styles.navPillTextSmall]}>
              {t.credits.samdBadge}
            </Text>
          </View>
        </View>
      </View>


      <ScrollView
        style={atoms.flex1}
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: (isMobile ? 86 : 100) + Math.max(insets.bottom, 16) },
          isSmallPhone ? styles.scrollSmall : isMobile ? styles.scrollMobile : undefined,
          twoColumns && styles.scrollLandscape,
        ]}
        showsVerticalScrollIndicator={false}>
        <View style={[styles.contentContainer, twoColumns && styles.contentContainerLandscape]}>
          {/* ================================================================== */}
          {/* COLUMNA IZQUIERDA: Emblema de Órbita + Tarjeta del Autor           */}
          {/* ================================================================== */}
          <Animated.View style={[styles.leftColumn, twoColumns && styles.columnHalf, introStyle]}>
            {/* Emblema con un punto por módulo de la batería */}
            <View style={[styles.emblemCard, isMobile && styles.emblemCardMobile]}>
              <View style={styles.emblemHeaderRow}>
                <View style={styles.emblemDotLive} />
                <Text style={styles.emblemHeading}>{ORBIT_HEADING}</Text>
              </View>
            
              <Animated.View
                style={[styles.emblemWrapper, { width: emblemBox, height: emblemBox }, floatStyle]}
                accessible
                accessibilityRole="image"
                accessibilityLabel={ORBIT_LABEL}>
                <Animated.View
                  style={[
                    styles.ring,
                    { width: ringSize, height: ringSize, borderRadius: ringSize / 2 },
                    ring1Style,
                  ]}
                />
                <Animated.View
                  style={[
                    styles.ring,
                    { width: ringSize, height: ringSize, borderRadius: ringSize / 2 },
                    ring2Style,
                  ]}
                />

                <View
                  style={[
                    styles.emblemCore,
                    { width: coreSize, height: coreSize, borderRadius: coreSize / 2 },
                  ]}>
                  <ViaIcon size={isotypeSize} variant="color" />
                </View>

                <View
                  style={[styles.orbitLayer, { width: emblemBox, height: emblemBox }]}
                  pointerEvents="none">
                  {ORBIT_MODULES.map(m => (
                    <OrbitDot key={m.key} module={m} scale={emblemScale} />
                  ))}
                </View>
              </Animated.View>

              <Text style={styles.emblemFootnote}>
                {t.credits.emblemFootnote}
              </Text>
            </View>

            {/* Tarjeta del Autor (Dr. Betances) */}
            <View style={[styles.authorCard, isMobile && styles.cardMobile]}>
              <View style={styles.authorHeaderRow}>
                <View style={styles.authorAvatarBox}>
                  <Image
                    source={require('@/../assets/img/logo_betances.jpg')}
                    style={styles.authorAvatarImg}
                    resizeMode="cover"
                  />
                </View>
                <View style={atoms.flex1}>
                  <View style={styles.authorBadgeRow}>
                    <UserCheck size={14} color="#EA580C" strokeWidth={2.4} />
                    <Text style={styles.authorBadgeText}>{t.credits.authorBadge}</Text>
                  </View>
                  <Text style={styles.authorName}>Dr. Frank Alberto Betances Reinoso</Text>
                  <Text style={styles.authorRole}>{t.credits.authorRole}</Text>
                </View>
              </View>

              <View
                style={styles.particleBand}
                onLayout={e => setBandWidth(Math.round(e.nativeEvent.layout.width))}>
                {bandWidth > 0
                  ? PARTICLES.map(cfg => <FlowParticle key={cfg.id} cfg={cfg} width={bandWidth} />)
                  : null}
              </View>
            </View>
          </Animated.View>

          {/* ================================================================== */}
          {/* COLUMNA DERECHA: Colaboradores, Voces y Calidad Regulatoria        */}
          {/* ================================================================== */}
          <Animated.View style={[styles.rightColumn, twoColumns && styles.columnHalf, introStyle]}>
            {/* Tarjeta 1: Entidades Colaboradoras */}
            <View style={[styles.cardBlock, isMobile && styles.cardMobile]}>
              <Text style={styles.cardBlockTitle}>{t.credits.partnersTitle}</Text>
            
              <View style={styles.partnerList}>
                <View style={styles.partnerItem}>
                  <View style={styles.partnerIconBox}>
                    <QuisqueyaHablaMark size={34} />
                  </View>
                  <View style={atoms.flex1}>
                    <Text style={styles.partnerName}>Quisqueya Habla (FONDOCYT)</Text>
                    <Text style={styles.partnerSubtitle}>{t.credits.quisqueyaDesc}</Text>
                  </View>
                </View>

                <View style={styles.divider} />

                <View style={styles.partnerItem}>
                  <View style={styles.partnerIconBox}>
                    <AcoprosMark size={34} />
                  </View>
                  <View style={atoms.flex1}>
                    <Text style={styles.partnerName}>ACOPROS</Text>
                    <Text style={styles.partnerSubtitle}>{t.credits.acoprosDesc}</Text>
                  </View>
                </View>

                <View style={styles.divider} />

                <View style={styles.partnerItem}>
                  <View style={styles.partnerIconBox}>
                    <EarlifyMark size={34} />
                  </View>
                  <View style={atoms.flex1}>
                    <Text style={styles.partnerName}>Earlify Health</Text>
                    <Text style={styles.partnerSubtitle}>{t.credits.earlifyDesc}</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Tarjeta 2: Voces y Variantes */}
            <View style={[styles.cardBlock, isMobile && styles.cardMobile]}>
              <View style={styles.cardBlockHeaderRow}>
                <Text style={styles.cardBlockTitle}>{t.credits.voicesTitle}</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t.langPicker.openA11y}
                  style={({ pressed }) => [styles.changeLangButton, pressed && styles.navButtonPressed]}
                  onPress={() => setLangModalVisible(true)}>
                  <Globe size={13} color="#FF7F00" strokeWidth={2.2} />
                  <Text style={styles.changeLangButtonText}>{t.langPicker.change(currentLang)}</Text>
                </Pressable>
              </View>
            
              <View style={styles.langList}>
                {languageCredits(t).map((item, idx) => (
                  <View key={idx} style={[styles.langItem, idx > 0 && atoms.marginTop10]}>
                    <Text style={styles.langFlag}>{item.flag}</Text>
                    <View style={atoms.flex1}>
                      <Text style={styles.langName}>{item.name}</Text>
                      <Text style={styles.langRole}>{item.role}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>

            {/* Tarjeta 3: Calidad y Marco Regulatorio */}
            <View style={[styles.cardBlock, isMobile && styles.cardMobile]}>
              <Text style={styles.cardBlockTitle}>{t.credits.qualityTitle}</Text>
            
              <View style={styles.sealRow}>
                <ItemasSealMark size={40} />
                <View style={atoms.flex1MarginLeft14}>
                  <Text style={styles.sealTitle}>{t.credits.sealTitle}</Text>
                  {/* El rediseño proponía «Innovación sanitaria avalada por el
                      ISCIII». Es una afirmación sobre una acreditación, más
                      fuerte que la actual, y cambiarla no es un efecto colateral
                      de un cambio de estilo: se mantiene la que ya estaba hasta
                      que Frank confirme los términos del sello. */}
                  <Text style={styles.sealSubtitle}>{t.credits.sealSubtitle}</Text>
                </View>
              </View>

              <View style={styles.chipsRow}>
                <View style={styles.chipPill}>
                  <Text style={styles.chipText}>{t.credits.chipSamd}</Text>
                </View>
                <View style={styles.chipPill}>
                  <Text style={styles.chipText}>MDR 2017/745</Text>
                </View>
                <View style={styles.chipPill}>
                  <Text style={styles.chipText}>{t.credits.chipLocation}</Text>
                </View>
              </View>
            </View>
          </Animated.View>
        </View>
      </ScrollView>

      {/* Action Dock Inferior con manejo dinámico de Safe Area */}
      <View
        style={[
          styles.actionDock,
          { paddingBottom: Math.max(insets.bottom, isMobile ? 12 : 14) },
          isMobile && styles.actionDockMobile,
        ]}>
        <Animated.View style={[btnAnimatedStyle, styles.dockBtnWrapper]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t.credits.dockButton}
            style={({ pressed }) => [
              styles.dockButton,
              isMobile && styles.dockButtonMobile,
              pressed && styles.dockButtonPressed,
            ]}
            onPressIn={() => (btnScale.value = withSpring(0.97, { damping: 15, stiffness: 300 }))}
            onPressOut={() => (btnScale.value = withSpring(1, { damping: 15, stiffness: 300 }))}
            onPress={handleContinue}>
            <Text
              style={[
                styles.dockButtonText,
                isSmallPhone
                  ? styles.dockButtonTextSmall
                  : isMobile
                    ? styles.dockButtonTextMobile
                    : undefined,
              ]}
              numberOfLines={1}
              ellipsizeMode="tail">
              {t.credits.dockButton}
            </Text>
            <View style={styles.dockArrowCircle}>
              <ArrowRight size={isMobile ? 16 : 18} color="#FF7F00" strokeWidth={2.6} />
            </View>
          </Pressable>
        </Animated.View>
      </View>

      <LanguagePickerModal
        visible={langModalVisible}
        onClose={() => setLangModalVisible(false)}
      />
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
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EDE7DC',
    backgroundColor: 'rgba(245, 242, 236, 0.94)',
  },
  topNavbarMobile: {
    paddingHorizontal: 16,
  },
  topNavbarSmall: {
    paddingHorizontal: 12,
  },
  navBackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: 10,
    minHeight: 44,
  },
  navButtonPressed: {
    opacity: 0.7,
  },
  navLogoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  navLogoText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#2B2620',
    letterSpacing: -0.5,
  },
  navLogoTextMobile: {
    fontSize: 16,
  },
  navTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#2B2620',
    flexShrink: 1,
    textAlign: 'center',
    marginHorizontal: 12,
  },
  navTitleMobile: {
    fontSize: 14.5,
    marginHorizontal: 6,
  },
  navTitleSmall: {
    fontSize: 13,
    marginHorizontal: 4,
  },
  navRightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  navRightGroupSmall: {
    gap: 4,
  },
  /* Las dos píldoras de la derecha —idioma y sello— comparten talla compacta:
   * en un teléfono estrecho el título se queda sin sitio si no encogen. */
  navPillSmall: {
    paddingVertical: 3,
    paddingHorizontal: 5,
    borderRadius: 6,
    gap: 3,
  },
  navPillTextSmall: {
    fontSize: 9.5,
  },
  langNavButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#EDE7DC',
    shadowColor: '#2B2620',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  langNavButtonText: {
    fontFamily: MONO,
    fontSize: 11,
    fontWeight: '800',
    color: '#FF7F00',
  },
  samdBadgeNav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#CCFBF1',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#99F6E4',
  },
  samdBadgeNavText: {
    fontFamily: MONO,
    fontSize: 11,
    fontWeight: '700',
    color: '#0F766E',
  },
  scroll: {
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  scrollMobile: {
    paddingHorizontal: 16,
  },
  scrollSmall: {
    paddingHorizontal: 12,
  },
  scrollLandscape: {
    paddingHorizontal: 28,
  },
  /* El ancho máximo va en el contenido, no en el `contentContainerStyle`: en
   * una tableta grande las dos columnas se centran en vez de estirarse. */
  contentContainer: {
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
  },
  contentContainerLandscape: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 20,
  },
  leftColumn: {
    gap: 18,
    marginBottom: 18,
  },
  rightColumn: {
    gap: 14,
    marginBottom: 18,
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
    shadowColor: '#2B2620',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  emblemCardMobile: {
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  cardMobile: {
    padding: 12,
    borderRadius: 20,
  },
  emblemHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 14,
  },
  emblemDotLive: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FF7F00',
  },
  emblemHeading: {
    fontFamily: MONO,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.1,
    color: '#2B2620',
  },
  emblemWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 4,
  },
  ring: {
    position: 'absolute',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 127, 0, 0.35)',
  },
  emblemCore: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#FF7F00',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF7F00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 8,
    elevation: 3,
  },
  orbitLayer: {
    position: 'absolute',
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
  emblemFootnote: {
    fontSize: 12,
    color: '#6B635A',
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 16,
    paddingHorizontal: 8,
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
    padding: 16,
    shadowColor: '#2B2620',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  authorBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  authorBadgeText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#EA580C',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  authorHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 8,
  },
  authorAvatarBox: {
    width: 60,
    height: 60,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#12A79B',
    overflow: 'hidden',
    backgroundColor: '#0D9488',
    shadowColor: '#12A79B',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  authorAvatarImg: {
    width: '100%',
    height: '100%',
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
  authorName: {
    fontSize: 15.5,
    fontWeight: '800',
    color: '#2B2620',
    lineHeight: 20,
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
    shadowColor: '#2B2620',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1.5,
  },
  cardBlockHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    flexWrap: 'wrap',
    gap: 6,
  },
  cardBlockTitle: {
    fontFamily: MONO,
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  changeLangButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255, 127, 0, 0.08)',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 127, 0, 0.22)',
    marginBottom: 12,
  },
  changeLangButtonText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#D97706',
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
    width: 40,
    height: 40,
    borderRadius: 11,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  partnerName: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#1E293B',
  },
  partnerSubtitle: {
    fontSize: 11.5,
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
    fontSize: 11.5,
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
    fontSize: 11.5,
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
    paddingTop: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2B2620',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 8,
  },
  actionDockMobile: {
    paddingTop: 12,
    paddingHorizontal: 16,
  },
  dockBtnWrapper: {
    width: '100%',
    maxWidth: 440,
    alignItems: 'center',
  },
  dockButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF7F00',
    borderRadius: 28,
    height: 54,
    paddingHorizontal: 24,
    width: '100%',
    maxWidth: 440,
    shadowColor: '#FF7F00',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  dockButtonPressed: {
    opacity: 0.92,
  },
  dockButtonMobile: {
    height: 50,
    paddingHorizontal: 16,
  },
  dockButtonText: {
    color: '#FFFFFF',
    fontSize: 15.5,
    fontWeight: '800',
    letterSpacing: 0.2,
    marginRight: 10,
    flexShrink: 1,
    textAlign: 'center',
  },
  dockButtonTextMobile: {
    fontSize: 14.5,
  },
  dockButtonTextSmall: {
    fontSize: 13.5,
  },
  dockArrowCircle: {
    flexShrink: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

