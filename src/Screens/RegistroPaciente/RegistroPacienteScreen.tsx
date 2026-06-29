import React, { useMemo, useState } from 'react';
import { Pressable } from 'react-native';
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

/* -------------------------------------------------------------------------- */
/*  RegistroPacienteScreen — alta sociodemográfica de un paciente nuevo       */
/*  (mockup `Registro Paciente.dc.html`). Al confirmar: crea `Patient` +      */
/*  `Evaluation` (status `in_progress`), puebla `activeEvaluation` y          */
/*  continúa al CAP (`ClinicalAssessment`).                                   */
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

function computeAgeLabel(isoDob: string): string {
  const dob = new Date(isoDob);
  if (Number.isNaN(dob.getTime())) return '—';
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

  const edad = useMemo(() => (fnac ? computeAgeLabel(fnac) : '—'), [fnac]);

  const requiredCount = useMemo(() => {
    const fields = [nombre.trim(), fnac.trim(), sexo, nhc.trim()];
    return fields.filter(Boolean).length;
  }, [nombre, fnac, sexo, nhc]);

  const ready = requiredCount === 4;

  const handleSubmit = async () => {
    if (!ready || isSaving) return;
    setIsSaving(true);
    try {
      const fullName = `${nombre.trim()} ${lastName.trim()}`.trim();

      const patient = new Patient();
      patient.idHash = nhc.trim();
      patient.nameEnc = fullName;
      patient.dobEnc = fnac.trim();
      patient.sex = sexo ?? 'O';
      patient.legalGuardianName = '';
      patient.centerId = currentProfessional?.centerId ?? null;

      const savedPatient = await PatientRepository.createPatient(patient);

      const evaluation = new Evaluation();
      evaluation.patient = savedPatient;
      evaluation.professional = { id: currentProfessional?.id ?? 0 } as Professional;
      evaluation.status = 'in_progress';
      evaluation.capApproved = false;
      evaluation.capNotes = null;
      evaluation.consentSignedAt = null;
      evaluation.completedAt = null;

      const savedEvaluation = await EvaluationRepository.createEvaluation(evaluation);

      dispatch(
        setActiveEvaluation({
          id: savedEvaluation.id,
          status: savedEvaluation.status,
          patient: {
            id: savedPatient.id,
            name: nombre.trim(),
            lastName: lastName.trim(),
            nhc: nhc.trim(),
          },
          professional: currentProfessional
            ? { id: currentProfessional.id, name: currentProfessional.fullName, licenseNumber: currentProfessional.licenseNumber }
            : null,
        }),
      );

      showSuccessToast('Paciente registrado', `${fullName} · NHC ${nhc.trim()}`);
      navigation.navigate('ClinicalAssessment');
    } catch (e) {
      showErrorToast('Error al registrar', 'No se pudo guardar el paciente. Inténtelo de nuevo.');
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
      <VStack flex={1}>
        <Header animationType="expand" />

        <VStack flex={1} px="$6" mt="$2" space="md">
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
              { n: 2, label: 'Cert. clínico', active: false },
              { n: 3, label: 'Sala', active: false },
              { n: 4, label: 'Pruebas', active: false },
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
                {idx < 3 ? <Box style={{ flex: 1, height: 1 }} bg="$borderLight200" /> : null}
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

            <HStack space="sm" mb="$4">
              <VStack style={{ flex: 1 }}>
                <Text size="xs" weight="semiBold" color="$textLight600" mb="$1.5">
                  Fecha de nacimiento
                </Text>
                <Input variant="outline" borderRadius={12}>
                  <InputField placeholder="AAAA-MM-DD" value={fnac} onChangeText={setFnac} />
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
                        {s.value}
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
          <VStack space="xs" mb="$6">
            <Text size="2xs" color="$textLight400" style={{ textAlign: 'center' }}>
              {requiredCount}/4 campos obligatorios completados
            </Text>
            <Button action="primary" variant="solid" rounded="$full" isDisabled={!ready || isSaving} isLoading={isSaving} onPress={handleSubmit}>
              <HStack space="sm" alignItems="center">
                <Text size="md" weight="bold" color="$white">
                  Continuar a certificado clínico
                </Text>
                <Icon as={ArrowRight} size="sm" color="$white" />
              </HStack>
            </Button>
          </VStack>
        </VStack>
      </VStack>
    </Content>
  );
}
