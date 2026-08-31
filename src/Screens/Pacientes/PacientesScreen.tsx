import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, ListRenderItemInfo, Pressable } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useDispatch, useSelector } from 'react-redux';
import { Box, Card, Center, HStack, Icon, Input, InputField, VStack } from '@gluestack-ui/themed';
import { ChevronRight, FileClock, LogOut, Plus, Search } from 'lucide-react-native';

import { Content, Header, Text } from '@/Components/Common';
import RadialBackground from '@/Components/Themed/RadialBackground';
import { RootStackParamList } from '@/Navigators';
import { AppDispatch, RootState } from '@/Store';
import { setActiveEvaluation } from '@/Store/slices/activeEvaluationSlice';
import { logout } from '@/Store/slices/authSlice';
import { signOutQuietly } from '@/Services/firebase';
import { Patient } from '@/Models/Patient/Patient';
import { Evaluation } from '@/Models/Evaluation/Evaluation';
import { Professional } from '@/Models/Professional/Professional';
import { PatientRepository } from '@/Repositories/PatientRepository';
import { EvaluationRepository } from '@/Repositories/EvaluationRepository';
import { ClinicalAssessmentRepository } from '@/Repositories/ClinicalAssessmentRepository';
import { InformedConsentRepository } from '@/Repositories/InformedConsentRepository';
import { showErrorToast } from '@/Helpers/showToast';
import { writeWithVerify } from '@/Helpers/dbWrite';

import { useT } from '@/I18n';
/* -------------------------------------------------------------------------- */
/*  PacientesScreen — lista/búsqueda de pacientes (mockup `Pacientes.dc.html`)*/
/*  "Nuevo paciente" abre el alta (`RegistroPaciente`). Al seleccionar un      */
/*  paciente con evaluación pendiente, retoma el flujo en el punto adecuado:   */
/*  si aún no tiene CAP, va a `ClinicalAssessment`; si ya lo tiene, va         */
/*  directamente a `SeleccionEjercicios`.                                     */
/* -------------------------------------------------------------------------- */

type Props = NativeStackScreenProps<RootStackParamList, 'Pacientes'>;

interface PatientRow {
  patient: Patient;
  latestEvaluation: Evaluation | null;
}

const AVATAR_PALETTES = ['$primary500', '$success600', '$info600', '$warning600'];

const ItemSeparator = () => <Box h="$2" />;

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts
    .slice(0, 2)
    .map(p => p[0]?.toUpperCase() ?? '')
    .join('');
}

interface PatientListItemProps {
  row: PatientRow;
  paletteColor: string;
  onPress: (row: PatientRow) => void;
  onHistory: (row: PatientRow) => void;
}

const PatientListItem = React.memo(function PatientListItem({
  row,
  paletteColor,
  onPress,
  onHistory,
}: PatientListItemProps) {
  const t = useT();
  const { patient, latestEvaluation } = row;
  const completed = latestEvaluation?.status === 'completed';
  const statusLabel = completed ? t.pacientes.completado : t.pacientes.curso;
  const statusBg = completed ? '$success50' : '$warning50';
  const statusFg = completed ? '$success700' : '$warning800';

  return (
    <Card bgColor="$white" borderRadius={18} p="$4">
      <Pressable onPress={() => onPress(row)}>
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
                  
                  {t.pacientes.nhc} {patient.idHash}
                </Text>
              </Box>
            </HStack>
            <Text size="2xs" color="$textLight400" mt="$0.5" style={{ fontVariant: ['tabular-nums'] }}>
              {patient.dobEnc} · {latestEvaluation ? t.pacientes.evaluacionRegistrada : t.pacientes.sinEvaluacionesPrevias}
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
      </Pressable>

      {/* Acceso a los resultados YA REGISTRADOS. Abrir la ficha inicia o
          retoma una sesión (consentimiento → CAP → sala), que no es lo que
          quiere quien solo va a consultar lo que ya se hizo: sin esta vía no
          había forma de volver a ver los resultados de un paciente. */}
      <Pressable
        onPress={() => onHistory(row)}
        accessibilityRole="button"
        accessibilityLabel={t.pacientes.verResultados(patient.nameEnc)}>
        <HStack
          space="xs"
          alignItems="center"
          justifyContent="center"
          mt="$3"
          py="$2"
          borderRadius={12}
          borderWidth={1}
          borderColor="$borderLight200">
          <Icon as={FileClock} size="xs" color="$primary600" />
          <Text size="2xs" weight="bold" color="$primary600">
            
            {t.pacientes.verResultadosPruebasRealizadas}
          </Text>
        </HStack>
      </Pressable>
    </Card>
  );
});

export default function PacientesScreen({ navigation }: Props) {
  const t = useT();
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

  const handleSelectPatient = useCallback(
    async (row: PatientRow) => {
      const { patient, latestEvaluation } = row;
      let evaluation = latestEvaluation ?? null;

      try {
        // Un paciente puede quedar sin evaluación (p. ej. si el alta se
        // interrumpió a mitad). Se crea aquí: sin un id real de evaluación
        // el CAP no puede guardarse (violaría la FK) y el flujo se bloquea.
        if (!evaluation) {
          const nueva = new Evaluation();
          nueva.patient = patient;
          if (currentProfessional?.id) {
            nueva.professional = { id: currentProfessional.id } as Professional;
          }
          nueva.status = 'in_progress';
          nueva.capApproved = false;
          nueva.capNotes = null;
          nueva.consentSignedAt = null;
          nueva.completedAt = null;
          evaluation = await writeWithVerify(
            () => EvaluationRepository.createEvaluation(nueva),
            () => EvaluationRepository.getLatestPendingByPatient(patient.id),
          );
        }

        // Consentimiento informado: la marca rápida vive en la evaluación
        // (`consentSignedAt`) y la fuente de verdad en `informed_consent`
        // (sesiones donde el UPDATE de la marca falló pero la firma sí se
        // guardó). Sin consentimiento no se avanza al CAP ni a las pruebas.
        let consentSigned = !!evaluation?.consentSignedAt;
        if (!consentSigned && evaluation) {
          consentSigned = !!(await InformedConsentRepository.getLatestByEvaluation(evaluation.id));
        }

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
              nameEnc: patient.nameEnc,
              idHash: patient.idHash,
            },
            professional: currentProfessional
              ? { id: currentProfessional.id, name: currentProfessional.fullName, licenseNumber: currentProfessional.licenseNumber }
              : null,
          }),
        );

        if (!evaluation || !consentSigned) {
          // El consentimiento es el primer paso bloqueante; su pantalla
          // continúa al CAP (o a la sala si el CAP ya existe).
          navigation.navigate('Consentimiento', { next: 'cap' });
        } else if (!cap) {
          navigation.navigate('ClinicalAssessment');
        } else {
          // Con CAP vigente, la sala debe verificarse con el sonómetro antes
          // de acceder a las pruebas de esta sesión.
          navigation.navigate('RoomNoiseCheck');
        }
      } catch (e) {
        const detail = e instanceof Error && e.message ? ` (${e.message})` : '';
        console.error('VIA+: error abriendo expediente', e);
        showErrorToast('Error', `No se pudo abrir el expediente del paciente.${detail}`);
      }
    },
    [currentProfessional, dispatch, navigation],
  );

  const handleOpenHistory = useCallback(
    (row: PatientRow) => {
      navigation.navigate('HistorialPaciente', {
        patientId: row.patient.id,
        patientName: row.patient.nameEnc,
        nhc: row.patient.idHash,
      });
    },
    [navigation],
  );

  const renderItem = useCallback(
    ({ item, index }: ListRenderItemInfo<PatientRow>) => (
      <PatientListItem
        row={item}
        paletteColor={AVATAR_PALETTES[index % AVATAR_PALETTES.length]}
        onPress={handleSelectPatient}
        onHistory={handleOpenHistory}
      />
    ),
    [handleSelectPatient, handleOpenHistory],
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
          data={filteredRows}
          keyExtractor={row => String(row.patient.id)}
          renderItem={renderItem}
          contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 8, paddingBottom: 40 }}
          ItemSeparatorComponent={ItemSeparator}
          ListHeaderComponent={
            <VStack space="md" mb="$3">
              {/* ----- title + professional ----- */}
              <HStack alignItems="flex-start" justifyContent="space-between">
                <VStack>
                  <Text size="2xl" weight="bold" color="$textLight900">
                    
                    {t.pacientes.pacientes}
                  </Text>
                  <Text size="xs" color="$textLight500">
                    
                    {t.pacientes.creaRegistroNuevoAbreExpediente}
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
                    <Pressable
                      onPress={() => {
                        signOutQuietly();
                        dispatch(logout());
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={t.pacientes.cerrarSesion}>
                      <Center w={36} h={36} borderRadius="$full" borderWidth={1.5} borderColor="$error200" bg="$error50">
                        <Icon as={LogOut} size="sm" color="$error500" />
                      </Center>
                    </Pressable>
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
                      
                      {t.pacientes.nuevoPaciente}
                    </Text>
                    <Text size="xs" color="$textLight500" style={{ lineHeight: 16 }}>
                      
                      {t.pacientes.registraDatosPacienteEmpiezaSesion}
                    </Text>
                  </VStack>
                  <Icon as={ChevronRight} size="sm" color="$textLight400" />
                </HStack>
              </Pressable>

              {/* ----- search + list header ----- */}
              <HStack alignItems="center" justifyContent="space-between" mt="$2">
                <Text size="sm" weight="bold" color="$textLight800">
                  
                  {t.pacientes.registrosPrevios}
                </Text>
                <Box bg="$backgroundLight100" px="$2.5" py="$0.5" borderRadius="$full">
                  <Text size="2xs" weight="bold" color="$textLight500">
                    {rows.length}  {t.pacientes.expediente}{rows.length === 1 ? '' : 's'}
                  </Text>
                </Box>
              </HStack>

              <Input variant="outline" borderRadius={14} bg="$white">
                <Icon as={Search} size="sm" color="$textLight400" ml="$3" />
                <InputField placeholder={t.pacientes.buscarNombreNhc} value={query} onChangeText={setQuery} />
              </Input>
            </VStack>
          }
          ListEmptyComponent={
            <Text size="xs" color="$textLight400" style={{ textAlign: 'center' }} mt="$4">
              {isLoading ? t.pacientes.cargandoPacientes : t.pacientes.sinExpedientesRegistradosTodavia}
            </Text>
          }
        />
      </VStack>
    </Content>
  );
}
