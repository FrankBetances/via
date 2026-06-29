import React, { useEffect, useMemo, useState } from 'react';
import { Pressable } from 'react-native';
import { StackScreenProps } from '@react-navigation/stack';
import { useDispatch, useSelector } from 'react-redux';
import { Box, Card, Center, HStack, Icon, Input, InputField, VStack } from '@gluestack-ui/themed';
import { ChevronRight, Plus, Search } from 'lucide-react-native';

import { Content, Header, Text } from '@/Components/Common';
import RadialBackground from '@/Components/Themed/RadialBackground';
import { RootStackParamList } from '@/Navigators';
import { AppDispatch, RootState } from '@/Store';
import { setActiveEvaluation } from '@/Store/slices/activeEvaluationSlice';
import { Patient } from '@/Models/Patient/Patient';
import { Evaluation } from '@/Models/Evaluation/Evaluation';
import { PatientRepository } from '@/Repositories/PatientRepository';
import { EvaluationRepository } from '@/Repositories/EvaluationRepository';
import { ClinicalAssessmentRepository } from '@/Repositories/ClinicalAssessmentRepository';
import { showErrorToast } from '@/Helpers/showToast';

/* -------------------------------------------------------------------------- */
/*  PacientesScreen — lista/búsqueda de pacientes (mockup `Pacientes.dc.html`)*/
/*  "Nuevo paciente" abre el alta (`RegistroPaciente`). Al seleccionar un      */
/*  paciente con evaluación pendiente, retoma el flujo en el punto adecuado:   */
/*  si aún no tiene CAP, va a `ClinicalAssessment`; si ya lo tiene, va         */
/*  directamente a `SeleccionEjercicios`.                                     */
/* -------------------------------------------------------------------------- */

type Props = StackScreenProps<RootStackParamList, 'Pacientes'>;

interface PatientRow {
  patient: Patient;
  latestEvaluation: Evaluation | null;
}

const AVATAR_PALETTES = ['$primary500', '$success600', '$info600', '$warning600'];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts
    .slice(0, 2)
    .map(p => p[0]?.toUpperCase() ?? '')
    .join('');
}

export default function PacientesScreen({ navigation }: Props) {
  const dispatch = useDispatch<AppDispatch>();
  const currentProfessional = useSelector((state: RootState) => state.auth.currentProfessional);

  const [rows, setRows] = useState<PatientRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const patients = await PatientRepository.getAllPatients();
        const withEvaluations = await Promise.all(
          patients.map(async patient => {
            const evaluations = await EvaluationRepository.getEvaluationsByPatient(patient.id);
            return { patient, latestEvaluation: evaluations[0] ?? null };
          }),
        );
        if (mounted) setRows(withEvaluations);
      } catch (e) {
        if (mounted) showErrorToast('Error al cargar', 'No se pudieron cargar los pacientes registrados.');
      } finally {
        if (mounted) setIsLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r => r.patient.nameEnc.toLowerCase().includes(q) || r.patient.idHash.toLowerCase().includes(q));
  }, [rows, query]);

  const handleSelectPatient = async (row: PatientRow) => {
    const { patient, latestEvaluation } = row;
    const evaluation = latestEvaluation ?? null;

    try {
      const cap = evaluation ? await ClinicalAssessmentRepository.getLatestByEvaluation(evaluation.id) : null;

      dispatch(
        setActiveEvaluation({
          id: evaluation?.id ?? 0,
          status: evaluation?.status ?? 'in_progress',
          patient: {
            id: patient.id,
            name: patient.nameEnc.split(' ')[0] ?? patient.nameEnc,
            lastName: patient.nameEnc.split(' ').slice(1).join(' '),
            nhc: patient.idHash,
          },
          professional: currentProfessional
            ? { id: currentProfessional.id, name: currentProfessional.fullName, licenseNumber: currentProfessional.licenseNumber }
            : null,
        }),
      );

      if (!evaluation || !cap) {
        navigation.navigate('ClinicalAssessment');
      } else {
        navigation.navigate('SeleccionEjercicios');
      }
    } catch (e) {
      showErrorToast('Error', 'No se pudo abrir el expediente del paciente.');
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
          {/* ----- title + professional ----- */}
          <HStack alignItems="flex-start" justifyContent="space-between">
            <VStack>
              <Text size="2xl" weight="bold" color="$textLight900">
                Pacientes
              </Text>
              <Text size="xs" color="$textLight500">
                Crea un registro nuevo o abre un expediente previo
              </Text>
            </VStack>
            {currentProfessional ? (
              <HStack alignItems="center" space="sm">
                <VStack alignItems="flex-end">
                  <Text size="xs" weight="semiBold" color="$textLight800">
                    {currentProfessional.fullName}
                  </Text>
                  <Text size="2xs" color="$textLight400">
                    {currentProfessional.licenseNumber || currentProfessional.role}
                  </Text>
                </VStack>
                <Center w={36} h={36} borderRadius="$full" bg="$primary500">
                  <Text size="xs" weight="bold" color="$white">
                    {initials(currentProfessional.fullName)}
                  </Text>
                </Center>
              </HStack>
            ) : null}
          </HStack>

          {/* ----- nuevo paciente CTA ----- */}
          <Pressable onPress={() => navigation.navigate('RegistroPaciente')}>
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
                <Icon as={Plus} size="md" color="$white" />
              </Center>
              <VStack style={{ flex: 1 }}>
                <Text size="sm" weight="bold" color="$textLight900">
                  Nuevo paciente
                </Text>
                <Text size="xs" color="$textLight500" style={{ lineHeight: 16 }}>
                  Registra los datos de un paciente y empieza una sesión de evaluación
                </Text>
              </VStack>
              <Icon as={ChevronRight} size="sm" color="$textLight400" />
            </HStack>
          </Pressable>

          {/* ----- search + list header ----- */}
          <HStack alignItems="center" justifyContent="space-between" mt="$2">
            <Text size="sm" weight="bold" color="$textLight800">
              Registros previos
            </Text>
            <Box bg="$backgroundLight100" px="$2.5" py="$0.5" borderRadius="$full">
              <Text size="2xs" weight="bold" color="$textLight500">
                {rows.length} expediente{rows.length === 1 ? '' : 's'}
              </Text>
            </Box>
          </HStack>

          <Input variant="outline" borderRadius={14} bg="$white">
            <Icon as={Search} size="sm" color="$textLight400" ml="$3" />
            <InputField placeholder="Buscar por nombre o NHC…" value={query} onChangeText={setQuery} />
          </Input>

          {/* ----- list ----- */}
          {isLoading ? (
            <Text size="xs" color="$textLight400" style={{ textAlign: 'center' }} mt="$4">
              Cargando pacientes…
            </Text>
          ) : filteredRows.length === 0 ? (
            <Text size="xs" color="$textLight400" style={{ textAlign: 'center' }} mt="$4">
              Sin expedientes registrados todavía.
            </Text>
          ) : (
            <VStack space="sm">
              {filteredRows.map((row, idx) => {
                const { patient, latestEvaluation } = row;
                const completed = latestEvaluation?.status === 'completed';
                const statusLabel = completed ? 'Completado' : 'En curso';
                const statusBg = completed ? '$success50' : '$warning50';
                const statusFg = completed ? '$success700' : '$warning800';
                const paletteColor = AVATAR_PALETTES[idx % AVATAR_PALETTES.length];
                return (
                  <Pressable key={patient.id} onPress={() => handleSelectPatient(row)}>
                    <Card bgColor="$white" borderRadius={18} p="$4">
                      <HStack alignItems="center" space="sm">
                        <Center w={44} h={44} borderRadius="$full" bg={paletteColor}>
                          <Text size="sm" weight="bold" color="$white">
                            {initials(patient.nameEnc)}
                          </Text>
                        </Center>
                        <VStack style={{ flex: 1 }}>
                          <HStack alignItems="center" space="sm">
                            <Text size="sm" weight="bold" color="$textLight900">
                              {patient.nameEnc}
                            </Text>
                            <Box bg="$backgroundLight100" px="$2" py="$0.5" borderRadius="$full">
                              <Text size="2xs" weight="bold" color="$textLight500" style={{ fontVariant: ['tabular-nums'] }}>
                                NHC {patient.idHash}
                              </Text>
                            </Box>
                          </HStack>
                          <Text size="2xs" color="$textLight400" mt="$0.5" style={{ fontVariant: ['tabular-nums'] }}>
                            {patient.dobEnc} · {latestEvaluation ? 'Evaluación registrada' : 'Sin evaluaciones previas'}
                          </Text>
                        </VStack>
                        <VStack alignItems="flex-end" space="xs">
                          <Box bg={statusBg} px="$2.5" py="$0.5" borderRadius="$full">
                            <Text size="2xs" weight="bold" color={statusFg}>
                              {statusLabel}
                            </Text>
                          </Box>
                          <Icon as={ChevronRight} size="sm" color="$textLight400" />
                        </VStack>
                      </HStack>
                    </Card>
                  </Pressable>
                );
              })}
            </VStack>
          )}

          <Box h="$10" />
        </VStack>
      </VStack>
    </Content>
  );
}
