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
import { writeWithVerify } from '@/Helpers/dbWrite';

/* -------------------------------------------------------------------------- */
/*  RegistroProfesionalScreen — alta del profesional responsable. Sin usuario  */
/*  ni email: solo nombre y rol son obligatorios; nº de colegiado y centro     */
/*  son opcionales. Al confirmar crea el `Professional` y abre sesión          */
/*  (`loginSuccess`).                                                          */
/*                                                                            */
/*  NOTA de navegación: cuando se llega aquí sin sesión (AccessStack), NO se  */
/*  navega manualmente a `Pacientes` — al despachar `loginSuccess` el gate    */
/*  de `DefaultNavigator` desmonta el AccessStack y monta el MainStack (cuya  */
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
    const fields = [nombre.trim(), rolLabel];
    return fields.filter(Boolean).length;
  }, [nombre, rolLabel]);

  const ready = requiredCount === 2;

  const handleSubmit = () => {
    if (!ready || isSaving) return;
    setIsSaving(true);

    const trimmedName = nombre.trim();
    const trimmedLicense = colegiado.trim();
    const role = selectedRole?.value ?? 'medico';
    const wasLogged = isLogged;

    // La sesión se abre INMEDIATAMENTE (optimista): la escritura del driver
    // SQLite puede no resolver nunca su promesa aunque la fila quede guardada
    // (síntoma verificado: al reabrir la app el perfil existe). Si la pantalla
    // espera ese await, el usuario queda bloqueado sin poder continuar ni
    // volver atrás. El id real se reconcilia en segundo plano.
    dispatch(
      loginSuccess({
        id: 0,
        fullName: trimmedName,
        licenseNumber: trimmedLicense,
        role,
        email: null,
        centerId: null,
        createdAt: new Date().toISOString(),
      }),
    );
    showSuccessToast('Registro completado', `Bienvenido/a, ${trimmedName}.`);
    if (wasLogged && navigation.canGoBack()) {
      navigation.goBack();
    }

    // Persistencia + reconciliación del id en segundo plano.
    (async () => {
      try {
        // Si ya hay un perfil con ese nº de colegiado, se reutiliza en lugar
        // de duplicarlo (el registro es "una sola vez por dispositivo").
        const existing = trimmedLicense
          ? await ProfessionalRepository.getProfessionalByLicense(trimmedLicense)
          : null;

        let saved: Professional;
        if (existing) {
          saved = existing;
        } else {
          const professional = new Professional();
          professional.fullName = trimmedName;
          professional.role = role;
          professional.licenseNumber = trimmedLicense;
          professional.email = null;
          professional.passwordHash = '';
          professional.centerId = null;
          saved = await writeWithVerify(
            () => ProfessionalRepository.createProfessional(professional),
            () =>
              trimmedLicense
                ? ProfessionalRepository.getProfessionalByLicense(trimmedLicense)
                : ProfessionalRepository.getLatestByFullName(trimmedName),
          );
        }

        dispatch(
          loginSuccess({
            id: saved.id,
            fullName: saved.fullName,
            licenseNumber: saved.licenseNumber,
            role: saved.role,
            email: saved.email ?? null,
            centerId: saved.centerId,
            createdAt: saved.createdAt?.toISOString?.() ?? new Date().toISOString(),
          }),
        );
      } catch (e) {
        // La sesión ya está abierta; solo se informa de que el perfil no quedó
        // persistido para que el usuario pueda reintentar el alta más tarde.
        const detail = e instanceof Error && e.message ? ` (${e.message})` : '';
        console.error('VIA+: error registrando profesional', e);
        showErrorToast('Aviso', `El perfil no se pudo persistir todavía.${detail}`);
      } finally {
        setIsSaving(false);
      }
    })();
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
                      Nº de colegiado · opcional
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
                  Centro de trabajo · opcional
                </Text>
                <Input variant="outline" borderRadius={12} mb="$3">
                  <InputField placeholder="Hospital / Centro de salud" value={centro} onChangeText={setCentro} />
                </Input>

                <HStack space="sm" alignItems="flex-start" p="$3" borderRadius={14} bg="$primary0">
                  <Icon as={Info} size="xs" color="$primary600" style={{ marginTop: 1 }} />
                  <Text size="2xs" color="$primary800" style={{ flex: 1, lineHeight: 16 }}>
                    Este registro se realiza una sola vez por dispositivo. Después bastará con elegir tu
                    perfil en la pantalla de acceso.
                  </Text>
                </HStack>
              </Card>

              <Box style={{ flex: 1 }} />

              {/* ----- footer ----- */}
              <VStack space="xs" mb="$6" mt="$3">
                <Text size="2xs" color="$textLight400" style={{ textAlign: 'center' }}>
                  {requiredCount}/2 campos obligatorios completados
                </Text>
                <Button action="primary" variant="solid" rounded="$full" isDisabled={!ready || isSaving} isLoading={isSaving} onPress={handleSubmit}>
                  <HStack space="sm" alignItems="center">
                    <Text size="md" weight="bold" color="$white">
                      Guardar y continuar
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
