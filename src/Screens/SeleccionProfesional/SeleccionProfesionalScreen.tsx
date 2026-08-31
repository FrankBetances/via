import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  ListRenderItemInfo,
  Modal,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useDispatch } from 'react-redux';
import { useFocusEffect } from '@react-navigation/native';

import { Header } from '@/Components/Common';
import { RootStackParamList } from '@/Navigators';
import { AppDispatch } from '@/Store';
import { loginSuccess } from '@/Store/slices/authSlice';
import { Professional, ProfessionalRole } from '@/Models/Professional/Professional';
import { ProfessionalRepository } from '@/Repositories/ProfessionalRepository';
import { showErrorToast } from '@/Helpers/showToast';
import { describeAuthError, isFirebaseAvailable, signInWithEmail } from '@/Services/firebase';

import { useT } from '@/I18n';
import { atoms } from '@/Theme/styleAtoms';
/* -------------------------------------------------------------------------- */
/*  SeleccionProfesionalScreen — acceso del profesional: se elige el perfil    */
/*  del dispositivo y, si tiene cuenta (email), se pide la contraseña y se     */
/*  verifica contra Firebase Authentication antes de abrir sesión              */
/*  (`loginSuccess`; el gate de DefaultNavigator cambia de grupo y aterriza    */
/*  en Pacientes). Los perfiles antiguos sin email conservan el acceso         */
/*  directo de siempre.                                                        */
/*  Diseño en el lenguaje visual de Bienvenida/Créditos: saludo según la       */
/*  hora, tarjetas con avatar en anillo de color y rol con emoji, y alta de    */
/*  nuevo perfil como tarjeta punteada destacada.                              */
/* -------------------------------------------------------------------------- */

type Props = NativeStackScreenProps<RootStackParamList, 'SeleccionProfesional'>;

const AVATAR_COLORS = ['#FF7F00', '#2A7948', '#0066B3', '#7C3AED', '#DB2777'];

const ROLE_META: Record<ProfessionalRole, { label: string; emoji: string }> = {
  medico: { label: 'Médico', emoji: '🩺' },
  logopeda: { label: 'Logopeda', emoji: '🗣️' },
  psicopedagogo: { label: 'Psicopedagogo/a', emoji: '🧠' },
  enfermero: { label: 'Enfermería', emoji: '💉' },
};

function greeting(): { text: string; emoji: string } {
  const h = new Date().getHours();
  if (h < 7) return { text: 'Buenas noches', emoji: '🌙' };
  if (h < 14) return { text: 'Buenos días', emoji: '☀️' };
  if (h < 21) return { text: 'Buenas tardes', emoji: '🌤️' };
  return { text: 'Buenas noches', emoji: '🌙' };
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts
    .slice(0, 2)
    .map(p => p[0]?.toUpperCase() ?? '')
    .join('');
}

/* ------------------------------ tarjeta perfil ---------------------------- */

interface ProfessionalItemProps {
  professional: Professional;
  color: string;
  onSelect: (professional: Professional) => void;
}

const ProfessionalItem = React.memo(function ProfessionalItem({ professional, color, onSelect }: ProfessionalItemProps) {
  const t = useT();
  const role = ROLE_META[professional.role] ?? { label: professional.role, emoji: '🧑‍⚕️' };
  return (
    <Pressable onPress={() => onSelect(professional)}>
      {({ pressed }) => (
        <View style={[styles.card, pressed && styles.cardPressed]}>
          {/* avatar con anillo de color */}
          <View style={[styles.avatarRing, { borderColor: color }]}>
            <View style={[styles.avatar, { backgroundColor: color }]}>
              <Text style={styles.avatarText}>{initials(professional.fullName)}</Text>
            </View>
          </View>

          <View style={atoms.flex1}>
            <Text style={styles.cardName}>{professional.fullName}</Text>
            <View style={styles.cardMetaRow}>
              <View style={styles.roleChip}>
                <Text style={styles.roleChipText}>
                  {role.emoji} {role.label}
                </Text>
              </View>
              {professional.licenseNumber ? (
                <Text style={styles.cardLicense}>{t.seleccionProfesional.col} {professional.licenseNumber}</Text>
              ) : null}
            </View>
          </View>

          <View style={[styles.enterBadge, { backgroundColor: color }]}>
            <Text style={styles.enterBadgeText}>→</Text>
          </View>
        </View>
      )}
    </Pressable>
  );
});

const ItemSeparator = () => <View style={atoms.height10} />;

/* --------------------------------- pantalla -------------------------------- */

export default function SeleccionProfesionalScreen({ navigation }: Props) {
  const t = useT();
  const dispatch = useDispatch<AppDispatch>();

  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Perfil pendiente de verificación de contraseña (abre el modal de acceso).
  const [authTarget, setAuthTarget] = useState<Professional | null>(null);
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  // Recarga al volver del alta de profesional.
  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      (async () => {
        try {
          const all = await ProfessionalRepository.getAllProfessionals();
          if (mounted) setProfessionals(all);
        } catch (e) {
          if (mounted) showErrorToast('Error al cargar', 'No se pudieron cargar los perfiles registrados.');
        } finally {
          if (mounted) setIsLoading(false);
        }
      })();
      return () => {
        mounted = false;
      };
    }, []),
  );

  const openSession = useCallback(
    (professional: Professional) => {
      dispatch(
        loginSuccess({
          id: professional.id,
          fullName: professional.fullName,
          licenseNumber: professional.licenseNumber,
          role: professional.role,
          email: professional.email ?? null,
          centerId: professional.centerId,
          createdAt: professional.createdAt?.toISOString?.() ?? new Date().toISOString(),
        }),
      );
      // El gate de DefaultNavigator cambia de grupo (aterriza en Pacientes);
      // no hay que navegar manualmente.
    },
    [dispatch],
  );

  const handleSelect = useCallback(
    (professional: Professional) => {
      if (professional.email && isFirebaseAvailable()) {
        // Cuenta con credenciales: la contraseña se verifica contra Firebase
        // Authentication en el modal antes de abrir sesión.
        setPassword('');
        setAuthError(null);
        setAuthTarget(professional);
        return;
      }
      if (professional.email) {
        // Build sin google-services.json: no hay backend contra el que
        // verificar la contraseña, así que el perfil conserva el acceso
        // directo (como los perfiles antiguos) en lugar de quedar bloqueado.
        showErrorToast('Firebase no configurado', 'Acceso directo: este build no puede verificar la contraseña.');
        openSession(professional);
        return;
      }
      // Perfil antiguo sin cuenta: acceso directo como hasta ahora.
      openSession(professional);
    },
    [openSession],
  );

  const closeAuthModal = useCallback(() => {
    if (isAuthenticating) return;
    setAuthTarget(null);
    setPassword('');
    setAuthError(null);
  }, [isAuthenticating]);

  const handleConfirmPassword = useCallback(async () => {
    if (!authTarget?.email || !password || isAuthenticating) return;
    setIsAuthenticating(true);
    setAuthError(null);
    try {
      await signInWithEmail(authTarget.email, password);
      setAuthTarget(null);
      setPassword('');
      openSession(authTarget);
    } catch (e) {
      setAuthError(describeAuthError(e));
    } finally {
      setIsAuthenticating(false);
    }
  }, [authTarget, password, isAuthenticating, openSession]);

  const renderItem = useCallback(
    ({ item, index }: ListRenderItemInfo<Professional>) => (
      <ProfessionalItem professional={item} color={AVATAR_COLORS[index % AVATAR_COLORS.length]} onSelect={handleSelect} />
    ),
    [handleSelect],
  );

  const hello = greeting();

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#F1ECE2" />
      <View style={styles.blobTopRight} pointerEvents="none" />
      <View style={styles.blobBottomLeft} pointerEvents="none" />

      <Header animationType="expand" />

      <FlatList
        data={professionals}
        keyExtractor={p => String(p.id)}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={ItemSeparator}
        ListHeaderComponent={
          <View style={styles.headerBlock}>
            <Text style={styles.greeting}>
              {hello.text} {hello.emoji}
            </Text>
            <Text style={styles.title}>{t.seleccionProfesional.quienVaEvaluarHoy}</Text>
            <Text style={styles.subtitle}>{t.seleccionProfesional.eligeTuPerfilAccedeTu}</Text>

            {/* ----- alta de nuevo profesional ----- */}
            <Pressable onPress={() => navigation.navigate('RegistroProfesional')}>
              {({ pressed }) => (
                <View style={[styles.newCard, pressed && styles.cardPressed]}>
                  <View style={styles.newBadge}>
                    <Text style={styles.newBadgeText}>+</Text>
                  </View>
                  <View style={atoms.flex1}>
                    <Text style={styles.newTitle}>{t.seleccionProfesional.registrarNuevoProfesional}</Text>
                    <Text style={styles.newSubtitle}>{t.seleccionProfesional.creaTuPerfilSolaVez}</Text>
                  </View>
                  <Text style={styles.newEmoji}>🧑‍⚕️</Text>
                </View>
              )}
            </Pressable>

            {professionals.length > 0 ? (
              <View style={styles.sectionRow}>
                <View style={styles.sectionLine} />
                <Text style={styles.sectionLabel}>
                  {professionals.length === 1 ? t.seleccionProfesional.n1PerfilRegistrado : t.seleccionProfesional.perfilesRegistrados(professionals.length)}
                </Text>
                <View style={styles.sectionLine} />
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyCircle}>
              <Text style={styles.emptyEmoji}>{isLoading ? '⏳' : '🪪'}</Text>
            </View>
            <Text style={styles.emptyText}>
              {isLoading
                ? t.seleccionProfesional.cargandoPerfiles
                : t.seleccionProfesional.aunHayProfesionalesEsteDispositivo}
            </Text>
          </View>
        }
      />

      {/* ----- modal de contraseña (verificación con Firebase Auth) ----- */}
      <Modal visible={!!authTarget} transparent animationType="fade" onRequestClose={closeAuthModal}>
        <KeyboardAvoidingView style={styles.modalBackdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalCard}>
            <View style={styles.modalAvatar}>
              <Text style={styles.modalAvatarText}>{authTarget ? initials(authTarget.fullName) : ''}</Text>
            </View>
            <Text style={styles.modalTitle}>{authTarget?.fullName}</Text>
            <Text style={styles.modalSubtitle}>{authTarget?.email}</Text>

            <TextInput
              style={styles.modalInput}
              placeholder={t.seleccionProfesional.contrasena}
              placeholderTextColor="#B8B2A7"
              value={password}
              onChangeText={text => {
                setPassword(text);
                if (authError) setAuthError(null);
              }}
              secureTextEntry
              autoCapitalize="none"
              autoFocus
              editable={!isAuthenticating}
              onSubmitEditing={handleConfirmPassword}
              returnKeyType="go"
            />

            {authError ? <Text style={styles.modalError}>{authError}</Text> : null}

            <View style={styles.modalButtonsRow}>
              <Pressable
                style={({ pressed }) => [styles.modalCancel, pressed && styles.cardPressed]}
                disabled={isAuthenticating}
                onPress={closeAuthModal}>
                <Text style={styles.modalCancelText}>{t.seleccionProfesional.cancelar}</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.modalConfirm,
                  (!password || isAuthenticating) && styles.modalConfirmDisabled,
                  pressed && !!password && !isAuthenticating && styles.cardPressed,
                ]}
                disabled={!password || isAuthenticating}
                onPress={handleConfirmPassword}>
                {isAuthenticating ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalConfirmText}>{t.seleccionProfesional.acceder}</Text>
                )}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
  list: {
    paddingHorizontal: 24,
    paddingTop: 4,
    paddingBottom: 40,
  },

  headerBlock: {
    marginBottom: 14,
  },
  greeting: {
    fontFamily: MONO,
    fontSize: 11,
    letterSpacing: 1,
    fontWeight: '700',
    color: '#B3A791',
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.6,
    color: '#3A352F',
    marginTop: 4,
  },
  subtitle: {
    fontSize: 13,
    color: '#8A8274',
    marginTop: 4,
    marginBottom: 18,
  },

  newCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    borderRadius: 20,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#FF9E3D',
    backgroundColor: 'rgba(255,127,0,0.06)',
    padding: 16,
  },
  newBadge: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: '#FF7F00',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF7F00',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 4,
  },
  newBadgeText: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '700',
    lineHeight: 30,
  },
  newTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#3A352F',
  },
  newSubtitle: {
    fontSize: 11.5,
    color: '#8A8274',
    marginTop: 2,
  },
  newEmoji: {
    fontSize: 24,
  },

  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 22,
  },
  sectionLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5DECF',
  },
  sectionLabel: {
    fontFamily: MONO,
    fontSize: 9,
    letterSpacing: 1.2,
    fontWeight: '700',
    color: '#A89F93',
  },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#EFE8DB',
    padding: 14,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  cardPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.99 }],
  },
  avatarRing: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  cardName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#3A352F',
  },
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  roleChip: {
    backgroundColor: '#F6F1E7',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  roleChipText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#6E6759',
  },
  cardLicense: {
    fontFamily: MONO,
    fontSize: 10,
    color: '#A89F93',
  },
  enterBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  enterBadgeText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },

  empty: {
    alignItems: 'center',
    marginTop: 26,
  },
  emptyCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EFE8DB',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyEmoji: {
    fontSize: 36,
  },
  emptyText: {
    fontSize: 13,
    lineHeight: 20,
    color: '#8A8274',
    textAlign: 'center',
  },

  /* ----- modal de contraseña ----- */
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(58,53,47,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 22,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
  modalAvatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#FF7F00',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  modalAvatarText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#3A352F',
    textAlign: 'center',
  },
  modalSubtitle: {
    fontFamily: MONO,
    fontSize: 11,
    color: '#A89F93',
    marginTop: 3,
    marginBottom: 16,
  },
  modalInput: {
    alignSelf: 'stretch',
    borderWidth: 1.5,
    borderColor: '#E9E2D5',
    borderRadius: 13,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 12 : 9,
    fontSize: 15,
    color: '#3A352F',
    backgroundColor: '#FBF9F4',
  },
  modalError: {
    alignSelf: 'stretch',
    fontSize: 12,
    lineHeight: 17,
    color: '#C2410C',
    marginTop: 8,
  },
  modalButtonsRow: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    gap: 10,
    marginTop: 16,
  },
  modalCancel: {
    flex: 1,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: '#E9E2D5',
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelText: {
    color: '#6E6759',
    fontSize: 14,
    fontWeight: '700',
  },
  modalConfirm: {
    flex: 1.4,
    borderRadius: 999,
    backgroundColor: '#FF7F00',
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalConfirmDisabled: {
    backgroundColor: '#D8CFC0',
  },
  modalConfirmText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
});
