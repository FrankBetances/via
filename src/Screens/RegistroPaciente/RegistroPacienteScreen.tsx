import React, { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useDispatch, useSelector } from 'react-redux';
import { Box, Card, HStack, Icon, Input, InputField, VStack } from '@gluestack-ui/themed';
import { ArrowRight } from 'lucide-react-native';

import { Button, Content, Header, Text } from '@/Components/Common';
import RadialBackground from '@/Components/Themed/RadialBackground';
import { RootStackParamList } from '@/Navigators';
import { AppDispatch, RootState } from '@/Store';
import { setActiveEvaluation } from '@/Store/slices/activeEvaluationSlice';
import { Patient, PatientSex } from '@/Models/Patient/Patient';
import { Evaluation } from '@/Models/Evaluation/Evaluation';
import { Professional } from '@/Models/Professional/Professional';
import { PatientRepository } from '@/Repositories/PatientRepository';
import { EvaluationRepository } from '@/Repositories/EvaluationRepository';
import { showErrorToast, showSuccessToast } from '@/Helpers/showToast';
import { writeWithVerify } from '@/Helpers/dbWrite';

/* -------------------------------------------------------------------------- */
/*  RegistroPacienteScreen — alta sociodemográfica de un paciente nuevo       */
/*  (mockup `Registro Paciente.dc.html`). Al confirmar: crea `Patient` +      */
/*  `Evaluation` (status `in_progress`), puebla `activeEvaluation` y          */
/*  continúa al consentimiento informado (paso bloqueante previo al CAP o a   */
/*  la exploración de disfagia).                                              */
/*                                                                            */
/*  NOTA: la seudonimización real (cifrado AES-256-GCM / HMAC del NHC) está  */
/*  fuera de alcance de esta fase (ver `Models/Patient`); aquí se guarda el   */
/*  nombre/fecha de nacimiento en claro en las columnas *Enc, consistente     */
/*  con el resto del esquema actual.                                          */
/* -------------------------------------------------------------------------- */

type Props = NativeStackScreenProps<RootStackParamList, 'RegistroPaciente'>;

const SEXOS: { value: PatientSex; label: string }[] = [
  { value: 'F', label: 'Femenino' },
  { value: 'M', label: 'Masculino' },
  { value: 'O', label: 'Otro' },
];

const DOB_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Fecha de nacimiento válida: formato AAAA-MM-DD, fecha real y no futura. */
function isValidDob(isoDob: string): boolean {
  const value = isoDob.trim();
  if (!DOB_RE.test(value)) return false;
  const dob = new Date(`${value}T00:00:00`);
  if (Number.isNaN(dob.getTime())) return false;
  // Rechaza normalizaciones tipo 2024-02-31 → 2024-03-02.
  const [, m, d] = value.split('-').map(Number);
  if (dob.getMonth() + 1 !== m || dob.getDate() !== d) return false;
  return dob.getTime() <= Date.now();
}

function computeAgeLabel(isoDob: string): string {
  if (!isValidDob(isoDob)) return '—';
  const dob = new Date(`${isoDob.trim()}T00:00:00`);
  const now = new Date();
  let years = now.getFullYear() - dob.getFullYear();
  let months = now.getMonth() - dob.getMonth();
  if (now.getDate() < dob.getDate()) months -= 1;
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  if (years < 2) {
    const totalMonths = years * 12 + months;
    return `${totalMonths} m`;
  }
  return `${years} a`;
}

export default function RegistroPacienteScreen({ navigation }: Props) {
  const dispatch = useDispatch<AppDispatch>();
  const currentProfessional = useSelector((state: RootState) => state.auth.currentProfessional);

  const [nombre, setNombre] = useState('');
  const [lastName, setLastName] = useState('');
  const [fnac, setFnac] = useState('');
  const [sexo, setSexo] = useState<PatientSex | null>(null);
  const [nhc, setNhc] = useState('');
  const [lengua, setLengua] = useState('Español');
  const [isSaving, setIsSaving] = useState(false);

  const fnacValid = useMemo(() => isValidDob(fnac), [fnac]);
  const edad = useMemo(() => (fnacValid ? computeAgeLabel(fnac) : '—'), [fnac, fnacValid]);

  const requiredCount = useMemo(() => {
    const fields = [nombre.trim(), fnacValid ? fnac : '', sexo, nhc.trim()];
    return fields.filter(Boolean).length;
  }, [nombre, fnac, fnacValid, sexo, nhc]);

  const ready = requiredCount === 4;

  /**
   * Guarda paciente + evaluación y continúa al consentimiento informado
   * (obligatorio en ambos caminos). `destination === 'dysphagia'` indica que
   * tras la firma se salta directamente a la exploración de disfagia: esa
   * prueba no requiere CAP ni comprobación de ruido de sala.
   */
  const handleSubmit = async (destination: 'cap' | 'dysphagia' = 'cap') => {
    if (!ready || isSaving) return;
    if (!currentProfessional?.id) {
      showErrorToast('Sesión no válida', 'Vuelva a iniciar sesión antes de registrar pacientes.');
      return;
    }
    setIsSaving(true);
    try {
      const trimmedNhc = nhc.trim();
      const fullName = `${nombre.trim()} ${lastName.trim()}`.trim();

      // `idHash` (NHC) es UNIQUE: comprobarlo antes evita que el alta falle
      // con una violación de unicidad opaca y el usuario se quede bloqueado.
      const existing = await PatientRepository.getPatientByIdHash(trimmedNhc);
      if (existing) {
        showErrorToast(
          'NHC ya registrado',
          `Ya existe un paciente con el NHC ${trimmedNhc}. Ábrelo desde la lista de pacientes.`,
        );
        return;
      }

      const patient = new Patient();
      patient.idHash = trimmedNhc;
      patient.nameEnc = fullName;
      patient.dobEnc = fnac.trim();
      patient.sex = sexo ?? 'O';
      patient.legalGuardianName = '';
      patient.centerId = currentProfessional?.centerId ?? null;

      // Escrituras con verificación por lectura: en dispositivo se ha visto
      // que save() puede no responder aunque la fila quede guardada (ver
      // Helpers/dbWrite.ts); el NHC es único, así que sirve para verificar.
      const savedPatient = await writeWithVerify(
        () => PatientRepository.createPatient(patient),
        () => PatientRepository.getPatientByIdHash(trimmedNhc),
      );

      const evaluation = new Evaluation();
      evaluation.patient = savedPatient;
      evaluation.professional = { id: currentProfessional.id } as Professional;
      evaluation.status = 'in_progress';
      evaluation.capApproved = false;
      evaluation.capNotes = null;
      evaluation.consentSignedAt = null;
      evaluation.completedAt = null;

      const savedEvaluation = await writeWithVerify(
        () => EvaluationRepository.createEvaluation(evaluation),
        () => EvaluationRepository.getLatestPendingByPatient(savedPatient.id),
      );

      dispatch(
        setActiveEvaluation({
          id: savedEvaluation.id,
          status: savedEvaluation.status,
          patient: {
            id: savedPatient.id,
            name: nombre.trim(),
            lastName: lastName.trim(),
            nhc: trimmedNhc,
          },
          professional: currentProfessional
            ? { id: currentProfessional.id, name: currentProfessional.fullName, licenseNumber: currentProfessional.licenseNumber }
            : null,
        }),
      );

      showSuccessToast('Paciente registrado', `${fullName} · NHC ${trimmedNhc}`);
      // El consentimiento informado es bloqueante: se firma antes del CAP y
      // también antes del acceso directo a disfagia.
      navigation.navigate('Consentimiento', { next: destination });
    } catch (e) {
      const detail = e instanceof Error && e.message ? ` (${e.message})` : '';
      console.error('VIA+: error registrando paciente', e);
      showErrorToast('Error al registrar', `No se pudo guardar el paciente.${detail}`);
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
              {/* ----- title + stepper ----- */}
              <VStack>
                <Text size="2xl" weight="bold" color="$textLight900">
                  Nuevo paciente
                </Text>
                <Text size="xs" color="$textLight500">
                  Registro sociodemográfico para esta sesión
                </Text>
              </VStack>

              <HStack space="xs" alignItems="center">
                {[
                  { n: 1, label: 'Paciente', active: true },
                  { n: 2, label: 'Consent.', active: false },
                  { n: 3, label: 'CAP', active: false },
                  { n: 4, label: 'Sala', active: false },
                  { n: 5, label: 'Pruebas', active: false },
                ].map((step, idx) => (
                  <React.Fragment key={step.n}>
                    <HStack alignItems="center" space="xs">
                      <Box w={20} h={20} borderRadius="$full" alignItems="center" justifyContent="center" bg={step.active ? '$primary500' : '$white'} borderWidth={step.active ? 0 : 1.5} borderColor="$borderLight300">
                        <Text size="2xs" weight="bold" color={step.active ? '$white' : '$textLight400'}>
                          {step.n}
                        </Text>
                      </Box>
                      <Text size="2xs" weight="semiBold" color={step.active ? '$textLight800' : '$textLight400'}>
                        {step.label}
                      </Text>
                    </HStack>
                    {idx < 4 ? <Box style={{ flex: 1, height: 1 }} bg="$borderLight200" /> : null}
                  </React.Fragment>
                ))}
              </HStack>

              {/* ----- form card ----- */}
              <Card bgColor="$white" borderRadius={22} p="$5">
                <Text size="xs" weight="semiBold" color="$textLight600" mb="$1.5">
                  Nombre y apellidos
                </Text>
                <HStack space="sm" mb="$4">
                  <Input variant="outline" borderRadius={12} style={{ flex: 1 }}>
                    <InputField placeholder="Nombre" value={nombre} onChangeText={setNombre} />
                  </Input>
                  <Input variant="outline" borderRadius={12} style={{ flex: 1 }}>
                    <InputField placeholder="Apellidos" value={lastName} onChangeText={setLastName} />
                  </Input>
                </HStack>

                <HStack space="sm" mb={fnac.trim() && !fnacValid ? '$1.5' : '$4'}>
                  <VStack style={{ flex: 1 }}>
                    <Text size="xs" weight="semiBold" color="$textLight600" mb="$1.5">
                      Fecha de nacimiento
                    </Text>
                    <Input
                      variant="outline"
                      borderRadius={12}
                      borderColor={fnac.trim() && !fnacValid ? '$error600' : undefined}>
                      <InputField
                        placeholder="AAAA-MM-DD"
                        value={fnac}
                        onChangeText={setFnac}
                        keyboardType="numbers-and-punctuation"
                        autoCapitalize="none"
                      />
                    </Input>
                  </VStack>
                  <VStack style={{ flex: 1 }}>
                    <Text size="xs" weight="semiBold" color="$textLight600" mb="$1.5">
                      Edad
                    </Text>
                    <Box borderRadius={12} borderWidth={1} borderColor="$borderLight200" bg="$backgroundLight50" px="$3" py="$2.5">
                      <Text size="sm" color="$textLight600" style={{ fontVariant: ['tabular-nums'] }}>
                        {edad}
                      </Text>
                    </Box>
                  </VStack>
                </HStack>
                {fnac.trim() && !fnacValid ? (
                  <Text size="2xs" color="$error600" mb="$4">
                    Introduce una fecha válida con formato AAAA-MM-DD (no futura).
                  </Text>
                ) : null}

                <Text size="xs" weight="semiBold" color="$textLight600" mb="$1.5">
                  Sexo
                </Text>
                <HStack space="sm" mb="$4">
                  {SEXOS.map(s => {
                    const selected = sexo === s.value;
                    return (
                      <Pressable key={s.value} style={{ flex: 1 }} onPress={() => setSexo(s.value)}>
                        <Box alignItems="center" py="$2" borderRadius="$full" borderWidth={1.5} bg={selected ? '$primary50' : '$white'} borderColor={selected ? '$primary500' : '$borderLight200'}>
                          <Text size="sm" weight="bold" color={selected ? '$primary600' : '$textLight400'}>
                            {s.label}
                          </Text>
                        </Box>
                      </Pressable>
                    );
                  })}
                </HStack>

                <Text size="xs" weight="semiBold" color="$textLight600" mb="$1.5">
                  Número de historia clínica (NHC)
                </Text>
                <Input variant="outline" borderRadius={12} mb="$4">
                  <InputField placeholder="PT-0000" value={nhc} onChangeText={setNhc} style={{ fontVariant: ['tabular-nums'] }} />
                </Input>

                <Text size="xs" weight="semiBold" color="$textLight600" mb="$1.5">
                  Lengua materna
                </Text>
                <Input variant="outline" borderRadius={12}>
                  <InputField placeholder="Español" value={lengua} onChangeText={setLengua} />
                </Input>
              </Card>

              <Box style={{ flex: 1 }} />

              {/* ----- footer ----- */}
              <VStack space="xs" mb="$6" mt="$3">
                <Text size="2xs" color="$textLight400" style={{ textAlign: 'center' }}>
                  {requiredCount}/4 campos obligatorios completados
                </Text>
                <Button action="primary" variant="solid" rounded="$full" isDisabled={!ready || isSaving} isLoading={isSaving} onPress={() => handleSubmit('cap')}>
                  <HStack space="sm" alignItems="center">
                    <Text size="md" weight="bold" color="$white">
                      Continuar al consentimiento
                    </Text>
                    <Icon as={ArrowRight} size="sm" color="$white" />
                  </HStack>
                </Button>

                {/* La exploración de disfagia no necesita CAP ni sonómetro de
                    sala: acceso directo tras el alta del paciente. */}
                <Pressable disabled={!ready || isSaving} onPress={() => handleSubmit('dysphagia')}>
                  <HStack
                    space="xs"
                    alignItems="center"
                    justifyContent="center"
                    py="$3"
                    borderRadius="$full"
                    borderWidth={1.5}
                    borderColor={ready && !isSaving ? '$info300' : '$borderLight200'}
                    bg={ready && !isSaving ? '$info50' : '$white'}
                    style={{ opacity: ready && !isSaving ? 1 : 0.5 }}>
                    <Text size="lg">💧</Text>
                    <Text size="sm" weight="bold" color={ready && !isSaving ? '$info700' : '$textLight400'}>
                      Ir directo a exploración de disfagia
                    </Text>
                  </HStack>
                </Pressable>
                <Text size="2xs" color="$textLight400" style={{ textAlign: 'center' }}>
                  La disfagia no requiere CAP ni sonómetro de sala (el consentimiento sí)
                </Text>
              </VStack>
            </VStack>
          </ScrollView>
        </VStack>
      </KeyboardAvoidingView>
    </Content>
  );
}
