import React, { useCallback, useState } from 'react';
import { FlatList, ListRenderItemInfo, Pressable } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useDispatch } from 'react-redux';
import { useFocusEffect } from '@react-navigation/native';
import { Box, Card, Center, HStack, Icon, VStack } from '@gluestack-ui/themed';
import { ChevronRight, UserPlus } from 'lucide-react-native';

import { Content, Header, Text } from '@/Components/Common';
import RadialBackground from '@/Components/Themed/RadialBackground';
import { RootStackParamList } from '@/Navigators';
import { AppDispatch } from '@/Store';
import { loginSuccess } from '@/Store/slices/authSlice';
import { Professional, ProfessionalRole } from '@/Models/Professional/Professional';
import { ProfessionalRepository } from '@/Repositories/ProfessionalRepository';
import { showErrorToast } from '@/Helpers/showToast';

/* -------------------------------------------------------------------------- */
/*  SeleccionProfesionalScreen — acceso sin usuario/contraseña: el dispositivo */
/*  guarda los perfiles profesionales dados de alta y aquí se elige quién      */
/*  realizará las evaluaciones. Tocar un perfil abre sesión (`loginSuccess`,   */
/*  el gate de DefaultNavigator monta el MainStack). "Registrar nuevo          */
/*  profesional" lleva al alta (`RegistroProfesional`).                        */
/* -------------------------------------------------------------------------- */

type Props = NativeStackScreenProps<RootStackParamList, 'SeleccionProfesional'>;

const AVATAR_PALETTES = ['$primary500', '$success600', '$info600', '$warning600'];

const ROLE_LABELS: Record<ProfessionalRole, string> = {
  medico: 'Médico',
  logopeda: 'Logopeda',
  psicopedagogo: 'Psicopedagogo/a',
  enfermero: 'Enfermería',
};

const ItemSeparator = () => <Box h="$2" />;

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts
    .slice(0, 2)
    .map(p => p[0]?.toUpperCase() ?? '')
    .join('');
}

interface ProfessionalItemProps {
  professional: Professional;
  paletteColor: string;
  onSelect: (professional: Professional) => void;
}

const ProfessionalItem = React.memo(function ProfessionalItem({ professional, paletteColor, onSelect }: ProfessionalItemProps) {
  const roleLabel = ROLE_LABELS[professional.role] ?? professional.role;
  return (
    <Pressable onPress={() => onSelect(professional)}>
      <Card bgColor="$white" borderRadius={18} p="$4">
        <HStack alignItems="center" space="sm">
          <Center w={44} h={44} borderRadius="$full" bg={paletteColor}>
            <Text size="sm" weight="bold" color="$white">
              {initials(professional.fullName)}
            </Text>
          </Center>
          <VStack style={{ flex: 1 }}>
            <Text size="sm" weight="bold" color="$textLight900">
              {professional.fullName}
            </Text>
            <Text size="2xs" color="$textLight400" mt="$0.5">
              {roleLabel}
              {professional.licenseNumber ? ` · Col. ${professional.licenseNumber}` : ''}
            </Text>
          </VStack>
          <Icon as={ChevronRight} size="sm" color="$textLight400" />
        </HStack>
      </Card>
    </Pressable>
  );
});

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
      // El gate de DefaultNavigator monta el MainStack (ruta inicial Pacientes);
      // no hay que navegar manualmente.
    },
    [dispatch],
  );

  const renderItem = useCallback(
    ({ item, index }: ListRenderItemInfo<Professional>) => (
      <ProfessionalItem professional={item} paletteColor={AVATAR_PALETTES[index % AVATAR_PALETTES.length]} onSelect={handleSelect} />
    ),
    [handleSelect],
  );

  return (
    <Content
      padding={false}
      insetTop={false}
      radialBackgrounds={
        <>
          <RadialBackground topMultiplier={0.12} leftMultiplier={-0.2} widthMultiplier={2} heightMultiplier={2} center={(w, _h) => [w, w]} radiusMultiplier={1} />
          <RadialBackground topMultiplier={-0.95} leftMultiplier={-0.8} widthMultiplier={2} heightMultiplier={2} center={(w, _h) => [w, w]} radiusMultiplier={1} />
        </>
      }>
      <VStack flex={1}>
        <Header animationType="expand" />

        <FlatList
          data={professionals}
          keyExtractor={p => String(p.id)}
          renderItem={renderItem}
          contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 8, paddingBottom: 40 }}
          ItemSeparatorComponent={ItemSeparator}
          ListHeaderComponent={
            <VStack space="md" mb="$3">
              <VStack>
                <Text size="2xl" weight="bold" color="$textLight900">
                  ¿Quién va a evaluar hoy?
                </Text>
                <Text size="xs" color="$textLight500">
                  Elige tu perfil para empezar, sin usuario ni contraseña
                </Text>
              </VStack>

              {/* ----- registrar nuevo profesional CTA ----- */}
              <Pressable onPress={() => navigation.navigate('RegistroProfesional')}>
                <HStack
                  alignItems="center"
                  space="sm"
                  p="$4"
                  borderRadius={18}
                  borderWidth={1.5}
                  borderColor="$primary300"
                  bg="$primary0"
                  style={{ borderStyle: 'dashed' }}>
                  <Center w={44} h={44} borderRadius={14} bg="$primary500">
                    <Icon as={UserPlus} size="md" color="$white" />
                  </Center>
                  <VStack style={{ flex: 1 }}>
                    <Text size="sm" weight="bold" color="$textLight900">
                      Registrar nuevo profesional
                    </Text>
                    <Text size="xs" color="$textLight500" style={{ lineHeight: 16 }}>
                      Crea tu perfil una sola vez en este dispositivo
                    </Text>
                  </VStack>
                  <Icon as={ChevronRight} size="sm" color="$textLight400" />
                </HStack>
              </Pressable>

              {professionals.length > 0 ? (
                <Text size="sm" weight="bold" color="$textLight800" mt="$2">
                  Perfiles registrados
                </Text>
              ) : null}
            </VStack>
          }
          ListEmptyComponent={
            <Text size="xs" color="$textLight400" style={{ textAlign: 'center' }} mt="$4">
              {isLoading
                ? 'Cargando perfiles…'
                : 'Aún no hay profesionales registrados en este dispositivo.'}
            </Text>
          }
        />
      </VStack>
    </Content>
  );
}
