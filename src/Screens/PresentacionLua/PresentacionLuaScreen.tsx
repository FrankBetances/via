import React, { useEffect, useState } from 'react';
import {
  Image,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
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
import { ArrowLeft, ArrowRight, Bluetooth, Info, Mail, MessageCircle, Shield, ShieldAlert, ShoppingCart } from 'lucide-react-native';

import { RootStackParamList } from '@/Navigators';
import { useT } from '@/I18n';
import ViaIcon from '@/Components/Common/ViaIcon';
import { CatPixel } from '@/Components/Mascot/LuaPixel';
import { Text } from '@/Components/Common';
import { atoms } from '@/Theme/styleAtoms';

type Props = NativeStackScreenProps<RootStackParamList, 'PresentacionLua'>;

const MONO = Platform.OS === 'ios' ? 'Courier' : 'monospace';

/* Los dos destinos de contacto, arriba y una sola vez: el texto que se lee
 * cuando NO se pueden abrir los nombra, y dos copias se separan. */
const WEB_URL = 'https://earlify.health';
const EMAIL_URL = 'mailto:contacto@earlify.health?subject=Solicitud%20de%20Mascota%20L%C3%BAa';

export default function PresentacionLuaScreen({ navigation }: Props) {
  const t = useT();
  const insets = useSafeAreaInsets();
  const { width: winW, height: winH } = useWindowDimensions();
  const isLandscape = winW > winH;
  const isTabletLandscape = (winW >= 850 && isLandscape) || winW >= 960;
  const isMobileLandscape = isLandscape && winH < 520 && !isTabletLandscape;
  const isMobile = winW < 600;
  const isSmallPhone = winW < 380;

  // Dimensiones adaptativas de la mascota Lúa y su halo de pulso
  const showcaseSize = isSmallPhone ? 190 : isMobileLandscape ? 180 : isMobile ? 220 : 260;
  const imageSize = Math.round(showcaseSize * 0.82);
  const ringRadius = Math.round(showcaseSize / 2);

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
          withTiming(1, { duration: 3000, easing: Easing.out(Easing.ease) }),
          withTiming(0, { duration: 0 }),
        ),
        -1,
        false,
      );
    ring1.value = makePulse();
    ring2.value = withDelay(1500, makePulse());
    
    float.value = withRepeat(
      withSequence(
        withTiming(-8, { duration: 3200, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 3200, easing: Easing.inOut(Easing.sin) }),
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
    /* Los `useSharedValue` son referencias estables: listarlas no reprograma
     * las animaciones en cada render, y calla al linter sin desactivarlo. */
  }, [float, introOpacity, introTranslateY, ring1, ring2]);

  const introStyle = useAnimatedStyle(() => ({
    opacity: introOpacity.value,
    transform: [{ translateY: introTranslateY.value }],
  }));

  const ring1Style = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(ring1.value, [0, 1], [0.9, 1.3]) }],
    opacity: interpolate(ring1.value, [0, 1], [0.3, 0]),
  }));
  const ring2Style = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(ring2.value, [0, 1], [0.9, 1.3]) }],
    opacity: interpolate(ring2.value, [0, 1], [0.3, 0]),
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
      navigation.navigate('Creditos');
    }
  };

  const handleContinue = () => {
    navigation.navigate('SeleccionProfesional');
  };

  /* REGLA 4. `Linking.openURL` RECHAZA cuando no hay aplicación que atienda el
   * intent, y en las imágenes de AVD del emulador —el banco de pruebas de
   * Frank— no hay cliente de correo: sin este `catch`, el botón «Contactar»
   * no hace nada, no dice nada y la promesa rechazada muere sin que la vea
   * nadie. `console.warn` tampoco valdría: en un APK de release no se lee.
   * Así que el fallo se pinta, y con la dirección al lado para que el
   * profesional pueda seguir por su cuenta. */
  const [linkError, setLinkError] = useState<string | null>(null);

  const openLink = async (url: string, failureText: string) => {
    setLinkError(null);
    try {
      await Linking.openURL(url);
    } catch {
      setLinkError(failureText);
    }
  };

  const handleContactWeb = () => openLink(WEB_URL, t.luaIntro.webFailed);

  const handleContactEmail = () => openLink(EMAIL_URL, t.luaIntro.emailFailed);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#F5F2EC" />
      <View style={styles.blobTopRight} pointerEvents="none" />
      <View style={styles.blobBottomLeft} pointerEvents="none" />
      <View
        style={[
          styles.topNavbar,
          { paddingTop: Math.max(insets.top, 12) },
          isSmallPhone
            ? styles.topNavbarSmall
            : isMobile
              ? styles.topNavbarMobile
              : undefined,
        ]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t.luaIntro.navBackA11y}
          hitSlop={8}
          style={({ pressed }) => [styles.navBackButton, pressed && styles.navButtonPressed]}
          onPress={handleBack}>
          <ArrowLeft size={isMobile ? 18 : 20} color="#2B2620" strokeWidth={2.4} />
          <View style={styles.navLogoRow}>
            <ViaIcon size={isMobile ? 22 : 24} variant="color" />
            <Text style={[styles.navLogoText, isMobile && styles.navLogoTextMobile]}>
              VIA<Text style={styles.navLogoPlus}>+</Text>
            </Text>
          </View>
        </Pressable>

        <Text
          style={[
            styles.navTitle,
            isSmallPhone
              ? styles.navTitleSmall
              : isMobile
                ? styles.navTitleMobile
                : undefined,
          ]}
          numberOfLines={1}
          ellipsizeMode="tail">
          {t.luaIntro.navTitle}
        </Text>

        <View style={[styles.navRightGroup, isSmallPhone && styles.navRightGroupSmall]}>
          <View style={[styles.samdBadgeNav, isSmallPhone && styles.samdBadgeNavSmall]}>
            <Bluetooth size={isSmallPhone ? 11 : 13} color="#0284C7" strokeWidth={2.2} />
            <Text
              style={[
                styles.samdBadgeNavText,
                styles.samdBadgeNavTextBle,
                isSmallPhone && styles.samdBadgeNavTextSmall,
              ]}>
              {t.luaIntro.badgeBle}
            </Text>
          </View>
          <View
            style={[
              styles.samdBadgeNav,
              styles.samdBadgeNavPhi,
              isSmallPhone && styles.samdBadgeNavSmall,
            ]}>
            <ShieldAlert size={isSmallPhone ? 11 : 13} color="#DC2626" strokeWidth={2.2} />
            <Text
              style={[
                styles.samdBadgeNavText,
                styles.samdBadgeNavTextPhi,
                isSmallPhone && styles.samdBadgeNavTextSmall,
              ]}>
              {t.luaIntro.badgeZeroPhi}
            </Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={atoms.flex1}
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: (isMobile ? 86 : 100) + Math.max(insets.bottom, 16) },
          isSmallPhone
            ? styles.scrollSmall
            : isMobile
              ? styles.scrollMobile
              : undefined,
          (isTabletLandscape || isMobileLandscape) && styles.scrollLandscape,
        ]}
        showsVerticalScrollIndicator={false}>
        <View
          style={[
            styles.contentContainer,
            (isTabletLandscape || isMobileLandscape) && styles.contentContainerLandscape,
          ]}>
          {/* ================================================================== */}
          {/* COLUMNA IZQUIERDA: Showcase Fotográfico de la Mascota Lúa          */}
          {/* ================================================================== */}
          <Animated.View
            style={[
              styles.leftColumn,
              (isTabletLandscape || isMobileLandscape) && styles.columnHalf,
              introStyle,
            ]}>
            <View style={[styles.emblemCard, isMobile && styles.emblemCardMobile]}>
              <View style={styles.emblemHeaderRow}>
                <View style={styles.emblemDotLive} />
                <Text style={[styles.emblemHeading, isSmallPhone && styles.emblemHeadingSmall]}>
                  {t.luaIntro.emblemHeading}
                </Text>
              </View>

              <View style={[styles.deviceShowcase, { width: showcaseSize, height: showcaseSize }]}>
                {/* Halos ambientales */}
                <Animated.View
                  style={[
                    styles.deviceRing,
                    { width: showcaseSize, height: showcaseSize, borderRadius: ringRadius },
                    ring1Style,
                  ]}
                />
                <Animated.View
                  style={[
                    styles.deviceRing,
                    { width: showcaseSize, height: showcaseSize, borderRadius: ringRadius },
                    ring2Style,
                  ]}
                />

                <Animated.View
                  style={[
                    styles.deviceImageContainer,
                    { width: imageSize, height: imageSize },
                    floatStyle,
                  ]}>
                  <Image
                    source={require('@/../assets/img/lua_mascot_device.jpg')}
                    style={styles.deviceImage}
                    resizeMode="contain"
                  />
                </Animated.View>
              </View>

              <View style={styles.catPixelRow}>
                <CatPixel size={isMobile ? 32 : 40} pose="head" />
                <Text style={[styles.emblemFootnote, isSmallPhone && styles.emblemFootnoteSmall]}>
                  {t.luaIntro.emblemFootnote}
                </Text>
              </View>
            </View>
          </Animated.View>

          {/* ================================================================== */}
          {/* COLUMNA DERECHA: Ficha Clínica y Botón de Contacto                 */}
          {/* ================================================================== */}
          <Animated.View
            style={[
              styles.rightColumn,
              (isTabletLandscape || isMobileLandscape) && styles.columnHalf,
              introStyle,
            ]}>
            {/* Tarjeta 1: Acompañamiento y Gamificación */}
            <View style={[styles.cardBlock, isMobile && styles.cardBlockMobile]}>
              <Text style={styles.cardBlockTitle}>{t.luaIntro.cardTitle}</Text>

              <View style={styles.partnerList}>
                <View style={styles.partnerItem}>
                  <View
                    style={[
                      styles.partnerIconBox,
                      isMobile && styles.partnerIconBoxMobile,
                      atoms.backgroundColorFEF3C7,
                    ]}>
                    <MessageCircle size={isMobile ? 20 : 22} color="#D97706" />
                  </View>
                  <View style={atoms.flex1}>
                    <Text style={[styles.partnerName, isMobile && styles.partnerNameMobile]}>
                      {t.luaIntro.empathyName}
                    </Text>
                    <Text
                      style={[
                        styles.partnerSubtitle,
                        isMobile && styles.partnerSubtitleMobile,
                      ]}>
                      {t.luaIntro.empathyDesc}
                    </Text>
                  </View>
                </View>

                <View style={styles.divider} />

                <View style={styles.partnerItem}>
                  <View
                    style={[
                      styles.partnerIconBox,
                      isMobile && styles.partnerIconBoxMobile,
                      atoms.backgroundColorE0F2FE,
                    ]}>
                    <Bluetooth size={isMobile ? 20 : 22} color="#0284C7" />
                  </View>
                  <View style={atoms.flex1}>
                    <Text style={[styles.partnerName, isMobile && styles.partnerNameMobile]}>
                      {t.luaIntro.bleName}
                    </Text>
                    <Text
                      style={[
                        styles.partnerSubtitle,
                        isMobile && styles.partnerSubtitleMobile,
                      ]}>
                      {t.luaIntro.bleDesc}
                    </Text>
                  </View>
                </View>

                <View style={styles.divider} />

                <View style={styles.partnerItem}>
                  <View
                    style={[
                      styles.partnerIconBox,
                      isMobile && styles.partnerIconBoxMobile,
                      atoms.backgroundColorFEE2E2,
                    ]}>
                    <Shield size={isMobile ? 20 : 22} color="#DC2626" />
                  </View>
                  <View style={atoms.flex1}>
                    <Text style={[styles.partnerName, isMobile && styles.partnerNameMobile]}>
                      {t.luaIntro.privacyName}
                    </Text>
                    <Text
                      style={[
                        styles.partnerSubtitle,
                        isMobile && styles.partnerSubtitleMobile,
                      ]}>
                      {t.luaIntro.privacyDesc}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Tarjeta 2: Adquisición / Pedidos */}
            <View style={[styles.cardBlockHighlight, isMobile && styles.cardBlockHighlightMobile]}>
              <View style={styles.highlightHeader}>
                <ShoppingCart size={isMobile ? 18 : 20} color="#FF7F00" strokeWidth={2.4} />
                <Text style={[styles.highlightTitle, isMobile && styles.highlightTitleMobile]}>
                  {t.luaIntro.highlightTitle}
                </Text>
              </View>
              <Text style={[styles.highlightText, isMobile && styles.highlightTextMobile]}>
                {t.luaIntro.highlightText}
              </Text>

              <View style={styles.contactButtonsRow}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t.luaIntro.infoA11y}
                  style={({ pressed }) => [
                    styles.contactBtn,
                    isMobile && styles.contactBtnMobile,
                    pressed && styles.navButtonPressed,
                  ]}
                  onPress={handleContactWeb}>
                  <Info size={16} color="#FFFFFF" strokeWidth={2.4} />
                  <Text style={[styles.contactBtnText, isMobile && styles.contactBtnTextMobile]}>
                    {t.luaIntro.infoLabel}
                  </Text>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t.luaIntro.contactA11y}
                  style={({ pressed }) => [
                    styles.contactBtnOutline,
                    isMobile && styles.contactBtnOutlineMobile,
                    pressed && styles.navButtonPressed,
                  ]}
                  onPress={handleContactEmail}>
                  <Mail size={16} color="#FF7F00" strokeWidth={2.4} />
                  <Text
                    style={[
                      styles.contactBtnTextOutline,
                      isMobile && styles.contactBtnTextOutlineMobile,
                    ]}>
                    {t.luaIntro.contactLabel}
                  </Text>
                </Pressable>
              </View>

              {linkError ? (
                <View style={styles.linkErrorRow} accessibilityLiveRegion="polite">
                  <ShieldAlert size={15} color="#B91C1C" strokeWidth={2.2} />
                  <Text style={styles.linkErrorText}>{linkError}</Text>
                </View>
              ) : null}
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
            accessibilityLabel={t.luaIntro.dockButton}
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
              {t.luaIntro.dockButton}
            </Text>
            <View style={styles.dockArrowCircle}>
              <ArrowRight size={isMobile ? 16 : 18} color="#FF7F00" strokeWidth={2.6} />
            </View>
          </Pressable>
        </Animated.View>
      </View>
    </View>
  );
}

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
  samdBadgeNav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E0F2FE',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  samdBadgeNavSmall: {
    paddingVertical: 3,
    paddingHorizontal: 5,
    borderRadius: 6,
    gap: 3,
  },
  samdBadgeNavPhi: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  navLogoPlus: {
    color: '#FF7F00',
  },
  samdBadgeNavTextBle: {
    color: '#0369A1',
  },
  samdBadgeNavTextPhi: {
    color: '#B91C1C',
  },
  linkErrorRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  linkErrorText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: '#B91C1C',
    fontWeight: '600',
  },
  samdBadgeNavText: {
    fontFamily: MONO,
    fontSize: 11,
    fontWeight: '700',
    color: '#0369A1',
  },
  samdBadgeNavTextSmall: {
    fontSize: 9.5,
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
  contentContainer: {
    width: '100%',
    maxWidth: 1120,
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

  /* Emblema Showcase */
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
  emblemHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 20,
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
  emblemHeadingSmall: {
    fontSize: 10,
    letterSpacing: 0.8,
  },
  deviceShowcase: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 10,
    position: 'relative',
  },
  deviceRing: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: 'rgba(255, 127, 0, 0.35)',
  },
  deviceImageContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  deviceImage: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  catPixelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginTop: 20,
    paddingHorizontal: 8,
  },
  emblemFootnote: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6B635A',
    lineHeight: 18,
    flexShrink: 1,
  },
  emblemFootnoteSmall: {
    fontSize: 12,
    lineHeight: 16,
  },

  /* Tarjetas */
  cardBlock: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#EDE7DC',
    shadowColor: '#2B2620',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  cardBlockMobile: {
    padding: 16,
    borderRadius: 20,
  },
  cardBlockTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#9A9183',
    letterSpacing: 0.8,
    marginBottom: 16,
  },
  partnerList: {
    gap: 16,
  },
  partnerItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
  },
  partnerIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  partnerIconBoxMobile: {
    width: 38,
    height: 38,
    borderRadius: 12,
  },
  partnerName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#2B2620',
    marginBottom: 4,
  },
  partnerNameMobile: {
    fontSize: 14,
  },
  partnerSubtitle: {
    fontSize: 13.5,
    color: '#6B635A',
    lineHeight: 20,
  },
  partnerSubtitleMobile: {
    fontSize: 12.5,
    lineHeight: 18,
  },
  divider: {
    height: 1,
    backgroundColor: '#F5F2EC',
  },

  /* Tarjeta Highlight */
  cardBlockHighlight: {
    backgroundColor: '#FFF7ED', 
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#FFEDD5', 
    borderLeftWidth: 4,
    borderLeftColor: '#FF7F00',
    shadowColor: '#FF7F00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 2,
  },
  cardBlockHighlightMobile: {
    padding: 16,
    borderRadius: 20,
  },
  highlightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  highlightTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#9A3412',
    flex: 1,
  },
  highlightTitleMobile: {
    fontSize: 15,
  },
  highlightText: {
    fontSize: 14,
    color: '#78350F',
    lineHeight: 21,
    marginBottom: 18,
  },
  highlightTextMobile: {
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 14,
  },
  contactButtonsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 10,
  },
  contactBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FF7F00',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    flexGrow: 1,
    minHeight: 44,
  },
  contactBtnMobile: {
    paddingHorizontal: 12,
  },
  contactBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  contactBtnTextMobile: {
    fontSize: 13,
  },
  contactBtnOutline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#FF7F00',
    flexGrow: 1,
    minHeight: 44,
  },
  contactBtnOutlineMobile: {
    paddingHorizontal: 12,
  },
  contactBtnTextOutline: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FF7F00',
    textAlign: 'center',
  },
  contactBtnTextOutlineMobile: {
    fontSize: 13,
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
    paddingTop: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    shadowColor: '#2B2620',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
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
    gap: 16,
    backgroundColor: '#FF7F00',
    height: 54,
    paddingHorizontal: 24,
    borderRadius: 28,
    width: '100%',
    maxWidth: 440,
    shadowColor: '#FF7F00',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 4,
  },
  dockButtonMobile: {
    height: 50,
    paddingHorizontal: 16,
    gap: 12,
  },
  dockButtonPressed: {
    opacity: 0.9,
  },
  dockButtonText: {
    fontSize: 15.5,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.2,
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
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});
