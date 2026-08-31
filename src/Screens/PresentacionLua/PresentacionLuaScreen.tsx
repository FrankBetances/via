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
import ViaIcon from '@/Components/Common/ViaIcon';
import { CatPixel } from '@/Components/Mascot/LuaPixel';
import { Text } from '@/Components/Common';

type Props = NativeStackScreenProps<RootStackParamList, 'PresentacionLua'>;

const MONO = Platform.OS === 'ios' ? 'Courier' : 'monospace';

export default function PresentacionLuaScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { width: winW } = useWindowDimensions();
  const isTabletLandscape = winW >= 850;

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
  }, []);

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

  const handleContactWeb = async () => {
    await Linking.openURL('https://earlify.health');
  };
  
  const handleContactEmail = async () => {
    await Linking.openURL('mailto:contacto@earlify.health?subject=Solicitud de Mascota Lúa');
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#F5F2EC" />
      <View style={styles.blobTopRight} pointerEvents="none" />
      <View style={styles.blobBottomLeft} pointerEvents="none" />

      {/* Top Navbar */}
      <View style={[styles.topNavbar, { paddingTop: Math.max(insets.top, 12) }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Volver a créditos"
          style={({ pressed }) => [styles.navBackButton, pressed && styles.navButtonPressed]}
          onPress={handleBack}>
          <ArrowLeft size={20} color="#2B2620" strokeWidth={2.4} />
          <View style={styles.navLogoRow}>
            <ViaIcon size={24} variant="color" />
            <Text style={styles.navLogoText}>
              VIA<Text style={{ color: '#FF7F00' }}>+</Text>
            </Text>
          </View>
        </Pressable>

        <Text style={styles.navTitle}>Lúa · Mascota y Periférico</Text>

        <View style={styles.navRightGroup}>
          <View style={styles.samdBadgeNav}>
            <Bluetooth size={13} color="#0284C7" strokeWidth={2.2} />
            <Text style={[styles.samdBadgeNavText, { color: '#0369A1' }]}>BLE</Text>
          </View>
          <View style={[styles.samdBadgeNav, { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]}>
            <ShieldAlert size={13} color="#DC2626" strokeWidth={2.2} />
            <Text style={[styles.samdBadgeNavText, { color: '#B91C1C' }]}>Zero-PHI</Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: 100 + Math.max(insets.bottom, 16) },
          isTabletLandscape && styles.scrollLandscape,
        ]}
        showsVerticalScrollIndicator={false}>
        
        {/* ================================================================== */}
        {/* COLUMNA IZQUIERDA: Showcase Fotográfico de la Mascota Lúa          */}
        {/* ================================================================== */}
        <Animated.View style={[styles.leftColumn, isTabletLandscape && styles.columnHalf, introStyle]}>
          <View style={styles.emblemCard}>
            <View style={styles.emblemHeaderRow}>
              <View style={styles.emblemDotLive} />
              <Text style={styles.emblemHeading}>ACOMPAÑANTE PEDIÁTRICO</Text>
            </View>
            
            <View style={styles.deviceShowcase}>
              {/* Halos ambientales */}
              <Animated.View style={[styles.deviceRing, ring1Style]} />
              <Animated.View style={[styles.deviceRing, ring2Style]} />
              
              <Animated.View style={[styles.deviceImageContainer, floatStyle]}>
                <Image 
                  source={require('@/../assets/img/lua_mascot_device.jpg')} 
                  style={styles.deviceImage} 
                  resizeMode="contain" 
                />
              </Animated.View>
            </View>

            <View style={styles.catPixelRow}>
               <CatPixel size={40} pose="head" />
               <Text style={styles.emblemFootnote}>
                 Dispositivo complementario opcional
               </Text>
            </View>
          </View>
        </Animated.View>

        {/* ================================================================== */}
        {/* COLUMNA DERECHA: Ficha Clínica y Botón de Contacto                 */}
        {/* ================================================================== */}
        <Animated.View style={[styles.rightColumn, isTabletLandscape && styles.columnHalf, introStyle]}>
          {/* Tarjeta 1: Acompañamiento y Gamificación */}
          <View style={styles.cardBlock}>
            <Text style={styles.cardBlockTitle}>DISPOSITIVO FÍSICO OPCIONAL</Text>
            
            <View style={styles.partnerList}>
              <View style={styles.partnerItem}>
                <View style={[styles.partnerIconBox, { backgroundColor: '#FEF3C7' }]}>
                  <MessageCircle size={22} color="#D97706" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.partnerName}>Empatía y Calma Clínica</Text>
                  <Text style={styles.partnerSubtitle}>Reduce la ansiedad del niño mediante expresiones amigables y respiración pautada durante las pruebas.</Text>
                </View>
              </View>

              <View style={styles.divider} />

              <View style={styles.partnerItem}>
                <View style={[styles.partnerIconBox, { backgroundColor: '#E0F2FE' }]}>
                  <Bluetooth size={22} color="#0284C7" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.partnerName}>Conexión Segura Inalámbrica</Text>
                  <Text style={styles.partnerSubtitle}>Enlace automático BLE (ESP32-C3). Reacciona al software sin cables ni configuraciones complejas.</Text>
                </View>
              </View>

              <View style={styles.divider} />

              <View style={styles.partnerItem}>
                <View style={[styles.partnerIconBox, { backgroundColor: '#FEE2E2' }]}>
                  <Shield size={22} color="#DC2626" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.partnerName}>Privacidad Estricta (Zero-PHI)</Text>
                  <Text style={styles.partnerSubtitle}>No graba ni almacena audio. Micrófono bloqueado por firmware para preservar la homologación médica.</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Tarjeta 2: Adquisición / Pedidos */}
          <View style={styles.cardBlockHighlight}>
            <View style={styles.highlightHeader}>
              <ShoppingCart size={20} color="#FF7F00" strokeWidth={2.4} />
              <Text style={styles.highlightTitle}>¿Te gustaría integrar a Lúa en tu consulta?</Text>
            </View>
            <Text style={styles.highlightText}>
              La evaluación clínica en VIA+ es totalmente autónoma. Sin embargo, Lúa está disponible para adquirir por separado si deseas potenciar el compromiso de tus pacientes pediátricos.
            </Text>
            
            <View style={styles.contactButtonsRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Botón Más Información"
                style={({ pressed }) => [styles.contactBtn, pressed && styles.navButtonPressed]}
                onPress={handleContactWeb}>
                <Info size={16} color="#FFFFFF" strokeWidth={2.4} />
                <Text style={styles.contactBtnText}>Más Información</Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Botón Contactar"
                style={({ pressed }) => [styles.contactBtnOutline, pressed && styles.navButtonPressed]}
                onPress={handleContactEmail}>
                <Mail size={16} color="#FF7F00" strokeWidth={2.4} />
                <Text style={styles.contactBtnTextOutline}>Contactar</Text>
              </Pressable>
            </View>
          </View>

        </Animated.View>
      </ScrollView>

      {/* Action Dock Inferior con manejo dinámico de Safe Area */}
      <View style={[styles.actionDock, { paddingBottom: Math.max(insets.bottom, 14) }]}>
        <Animated.View style={btnAnimatedStyle}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Comenzar Selección Profesional"
            style={({ pressed }) => [styles.dockButton, pressed && styles.dockButtonPressed]}
            onPressIn={() => (btnScale.value = withSpring(0.97, { damping: 15, stiffness: 300 }))}
            onPressOut={() => (btnScale.value = withSpring(1, { damping: 15, stiffness: 300 }))}
            onPress={handleContinue}>
            <Text style={styles.dockButtonText}>Comenzar Selección Profesional</Text>
            <View style={styles.dockArrowCircle}>
              <ArrowRight size={18} color="#FF7F00" strokeWidth={2.6} />
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
  navBackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: 10,
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
  navTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#2B2620',
  },
  navRightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  samdBadgeNavText: {
    fontFamily: MONO,
    fontSize: 11,
    fontWeight: '700',
    color: '#0369A1',
  },
  scroll: {
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  scrollLandscape: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 24,
    paddingHorizontal: 36,
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
  deviceShowcase: {
    width: 260,
    height: 260,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 10,
    position: 'relative',
  },
  deviceRing: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    borderWidth: 2,
    borderColor: 'rgba(255, 127, 0, 0.35)',
  },
  deviceImageContainer: {
    width: 200,
    height: 220,
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
  partnerName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#2B2620',
    marginBottom: 4,
  },
  partnerSubtitle: {
    fontSize: 13.5,
    color: '#6B635A',
    lineHeight: 20,
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
  highlightText: {
    fontSize: 14,
    color: '#78350F',
    lineHeight: 21,
    marginBottom: 18,
  },
  contactButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  contactBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FF7F00',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  contactBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  contactBtnOutline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FF7F00',
  },
  contactBtnTextOutline: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FF7F00',
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
  dockButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: '#FF7F00',
    height: 54,
    paddingHorizontal: 28,
    borderRadius: 28,
    shadowColor: '#FF7F00',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 4,
  },
  dockButtonPressed: {
    opacity: 0.9,
  },
  dockButtonText: {
    fontSize: 15.5,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  dockArrowCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
