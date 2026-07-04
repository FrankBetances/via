import React, { useCallback, useState } from 'react';
import {
  FlatList,
  ListRenderItemInfo,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
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

/* -------------------------------------------------------------------------- */
/*  SeleccionProfesionalScreen — acceso sin usuario/contraseña: se elige el    */
/*  perfil profesional del dispositivo y se abre sesión (`loginSuccess`; el    */
/*  gate de DefaultNavigator cambia de grupo y aterriza en Pacientes).         */
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

          <View style={{ flex: 1 }}>
            <Text style={styles.cardName}>{professional.fullName}</Text>
            <View style={styles.cardMetaRow}>
              <View style={styles.roleChip}>
                <Text style={styles.roleChipText}>
                  {role.emoji} {role.label}
                </Text>
              </View>
              {professional.licenseNumber ? (
                <Text style={styles.cardLicense}>Col. {professional.licenseNumber}</Text>
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

const ItemSeparator = () => <View style={{ height: 10 }} />;

/* --------------------------------- pantalla -------------------------------- */

export default function SeleccionProfesionalScreen({ navigation }: Props) {
  const dispatch = useDispatch<AppDispatch>();

  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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

  const handleSelect = useCallback(
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
            <Text style={styles.title}>¿Quién va a evaluar hoy?</Text>
            <Text style={styles.subtitle}>Elige tu perfil para empezar · sin usuario ni contraseña</Text>

            {/* ----- alta de nuevo profesional ----- */}
            <Pressable onPress={() => navigation.navigate('RegistroProfesional')}>
              {({ pressed }) => (
                <View style={[styles.newCard, pressed && styles.cardPressed]}>
                  <View style={styles.newBadge}>
                    <Text style={styles.newBadgeText}>+</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.newTitle}>Registrar nuevo profesional</Text>
                    <Text style={styles.newSubtitle}>Crea tu perfil una sola vez en este dispositivo</Text>
                  </View>
                  <Text style={styles.newEmoji}>🧑‍⚕️</Text>
                </View>
              )}
            </Pressable>

            {professionals.length > 0 ? (
              <View style={styles.sectionRow}>
                <View style={styles.sectionLine} />
                <Text style={styles.sectionLabel}>
                  {professionals.length === 1 ? '1 PERFIL REGISTRADO' : `${professionals.length} PERFILES REGISTRADOS`}
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
                ? 'Cargando perfiles…'
                : 'Aún no hay profesionales en este dispositivo.\nRegistra tu perfil para comenzar.'}
            </Text>
          </View>
        }
      />
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
});
