import React, { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useDispatch, useSelector } from 'react-redux';
import { Box, Card, HStack, Icon, Input, InputField, VStack } from '@gluestack-ui/themed';
import { ArrowRight, Info, UserCheck } from 'lucide-react-native';

import { Button, Content, Header, Text } from '@/Components/Common';
import RadialBackground from '@/Components/Themed/RadialBackground';
import { RootStackParamList } from '@/Navigators';
import { AppDispatch, RootState } from '@/Store';
import { loginSuccess } from '@/Store/slices/authSlice';
import { Professional, ProfessionalRole } from '@/Models/Professional/Professional';
import { ProfessionalRepository } from '@/Repositories/ProfessionalRepository';
import { showErrorToast, showSuccessToast } from '@/Helpers/showToast';

/* -------------------------------------------------------------------------- */
/*  RegistroProfesionalScreen — alta del profesional responsable (mockup      */
/*  `Registro Profesional.dc.html`). Se registra una sola vez; al confirmar   */
/*  crea el `Professional` y abre sesión (`loginSuccess`).                    */
/*                                                                            */
/*  NOTA de navegación: cuando se llega aquí sin sesión (LoginStack), NO se   */
/*  navega manualmente a `Pacientes` — al despachar `loginSuccess` el gate    */
/*  de `DefaultNavigator` desmonta el LoginStack y monta el MainStack (cuya   */
/*  ruta inicial ya es `Pacientes`); un `navigate` manual sobre el stack en   */
/*  desmontaje produce "The action NAVIGATE was not handled". Si ya hay       */
/*  sesión (edición de perfil desde el MainStack), se vuelve atrás.           */
/* -------------------------------------------------------------------------- */

type Props = NativeStackScreenProps<RootStackParamList, 'RegistroProfesional'>;

const ROLES: { value: ProfessionalRole; label: string }[] = [
  { value: 'medico', label: 'Médico' },
  { value: 'medico', label: 'Otorrino' },
  { value: 'logopeda', label: 'Logopeda' },
  { value: 'enfermero', label: 'Enfermería' },
  { value: 'medico', label: 'Médico A. Primaria' },
  { value: 'medico', label: 'Pediatra' },
  { value: 'psicopedagogo', label: 'Psicopedagogo/a' },
];

/** Email local determinista derivado del nº de colegiado (p. ej. `28/1234` → `28-1234@viaplus.local`). */
function emailFromLicense(license: string): string {
  const local = license
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${local || 'profesional'}@viaplus.local`;
}

export default function RegistroProfesionalScreen({ navigation }: Props) {
  const dispatch = useDispatch<AppDispatch>();
  const isLogged = useSelector((state: RootState) => state.auth.isLogged);

  const [nombre, setNombre] = useState('');
  const [rolLabel, setRolLabel] = useState<string | null>(null);
  const [colegiado, setColegiado] = useState('');
  const [servicio, setServicio] = useState('');
  const [centro, setCentro] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const selectedRole = ROLES.find(r => r.label === rolLabel);

  const requiredCount = useMemo(() => {
    const fields = [nombre.trim(), rolLabel, colegiado.trim(), centro.trim()];
    return fields.filter(Boolean).length;
  }, [nombre, rolLabel, colegiado, centro]);

  const ready = requiredCount === 4;

  const handleSubmit = async () => {
    if (!ready || isSaving) return;
    setIsSaving(true);
    try {
      const email = emailFromLicense(colegiado);
      const wasLogged = isLogged;

      // El email (derivado del nº de colegiado) es UNIQUE: si ya existe un
      // perfil con ese colegiado, se reabre sesión con él en lugar de fallar
      // con una violación de unicidad opaca.
      const existing = await ProfessionalRepository.getProfessionalByEmail(email);

      let saved: Professional;
      if (existing) {
        saved = existing;
      } else {
        const professional = new Professional();
        professional.fullName = nombre.trim();
        professional.role = selectedRole?.value ?? 'medico';
        professional.licenseNumber = colegiado.trim();
        professional.email = email;
        professional.passwordHash = '';
        professional.centerId = null;
        saved = await ProfessionalRepository.createProfessional(professional);
      }

      dispatch(
        loginSuccess({
          id: saved.id,
          fullName: saved.fullName,
          licenseNumber: saved.licenseNumber,
          role: saved.role,
          email: saved.email,
          centerId: saved.centerId,
          createdAt: saved.createdAt?.toISOString?.() ?? new Date().toISOString(),
        }),
      );

      showSuccessToast(
        existing ? 'Perfil ya registrado' : 'Registro completado',
        `Bienvenido/a, ${saved.fullName}.`,
      );

      // Sin sesión previa: el gate de DefaultNavigator cambia al MainStack
      // automáticamente. Con sesión previa (gestión de perfil): volver atrás.
      if (wasLogged && navigation.canGoBack()) {
        navigation.goBack();
      }
    } catch (e) {
      showErrorToast('Error al registrar', 'No se pudo guardar el perfil profesional. Inténtelo de nuevo.');
    } finally {
      setIsSaving(false);
    }
  };

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
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <VStack flex={1}>
          <Header animationType="expand" />

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingTop: 8 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            <VStack flex={1} space="md">
              {/* ----- title ----- */}
              <HStack alignItems="flex-start" justifyContent="space-between">
                <VStack style={{ flex: 1 }}>
                  <Text size="2xl" weight="bold" color="$textLight900">
                    Registro del profesional
                  </Text>
                  <Text size="xs" color="$textLight500">
                    Responsable de las evaluaciones · se configura una sola vez
                  </Text>
                </VStack>
                <HStack alignItems="center" space="xs" bg="$success50" px="$2.5" py="$1" borderRadius="$full">
                  <Icon as={UserCheck} size="2xs" color="$success700" />
                  <Text size="2xs" weight="bold" color="$success700">
                    Perfil de cuenta
                  </Text>
                </HStack>
              </HStack>

              {/* ----- form card ----- */}
              <Card bgColor="$white" borderRadius={22} p="$5">
                <Text size="xs" weight="semiBold" color="$textLight600" mb="$1.5">
                  Nombre y apellidos
                </Text>
                <Input variant="outline" borderRadius={12} mb="$4">
                  <InputField placeholder="Ej. Elena Ruiz Soto" value={nombre} onChangeText={setNombre} />
                </Input>

                <Text size="xs" weight="semiBold" color="$textLight600" mb="$1.5">
                  Rol profesional
                </Text>
                <HStack space="xs" flexWrap="wrap" style={{ gap: 7 }} mb="$4">
                  {ROLES.map(r => {
                    const selected = rolLabel === r.label;
                    return (
                      <Pressable key={r.label} onPress={() => setRolLabel(r.label)}>
                        <Box px="$3" py="$1.5" borderRadius="$full" borderWidth={1.5} bg={selected ? '$success50' : '$white'} borderColor={selected ? '$success600' : '$borderLight200'}>
                          <Text size="xs" weight="medium" color={selected ? '$success700' : '$textLight600'}>
                            {r.label}
                          </Text>
                        </Box>
                      </Pressable>
                    );
                  })}
                </HStack>

                <HStack space="sm" mb="$4">
                  <VStack style={{ flex: 1 }}>
                    <Text size="xs" weight="semiBold" color="$textLight600" mb="$1.5">
                      Nº de colegiado
                    </Text>
                    <Input variant="outline" borderRadius={12}>
                      <InputField placeholder="28/1234" value={colegiado} onChangeText={setColegiado} style={{ fontVariant: ['tabular-nums'] }} />
                    </Input>
                  </VStack>
                  <VStack style={{ flex: 1 }}>
                    <Text size="xs" weight="semiBold" color="$textLight600" mb="$1.5">
                      Servicio / Unidad · opcional
                    </Text>
                    <Input variant="outline" borderRadius={12}>
                      <InputField placeholder="ORL pediátrica" value={servicio} onChangeText={setServicio} />
                    </Input>
                  </VStack>
                </HStack>

                <Text size="xs" weight="semiBold" color="$textLight600" mb="$1.5">
                  Centro de trabajo
                </Text>
                <Input variant="outline" borderRadius={12} mb="$3">
                  <InputField placeholder="Hospital / Centro de salud" value={centro} onChangeText={setCentro} />
                </Input>

                <HStack space="sm" alignItems="flex-start" p="$3" borderRadius={14} bg="$primary0">
                  <Icon as={Info} size="xs" color="$primary600" style={{ marginTop: 1 }} />
                  <Text size="2xs" color="$primary800" style={{ flex: 1, lineHeight: 16 }}>
                    Este registro se realiza una sola vez por dispositivo. Podrá editar estos datos posteriormente desde el
                    perfil de cuenta.
                  </Text>
                </HStack>
              </Card>

              <Box style={{ flex: 1 }} />

              {/* ----- footer ----- */}
              <VStack space="xs" mb="$6" mt="$3">
                <Text size="2xs" color="$textLight400" style={{ textAlign: 'center' }}>
                  {requiredCount}/4 campos obligatorios completados
                </Text>
                <Button action="primary" variant="solid" rounded="$full" isDisabled={!ready || isSaving} isLoading={isSaving} onPress={handleSubmit}>
                  <HStack space="sm" alignItems="center">
                    <Text size="md" weight="bold" color="$white">
                      Continuar a pacientes
                    </Text>
                    <Icon as={ArrowRight} size="sm" color="$white" />
                  </HStack>
                </Button>
              </VStack>
            </VStack>
          </ScrollView>
        </VStack>
      </KeyboardAvoidingView>
    </Content>
  );
}
