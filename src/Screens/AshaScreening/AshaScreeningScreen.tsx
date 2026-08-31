import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  Box,
  Card,
  Center,
  HStack,
  Icon,
  Input,
  InputField,
  ScrollView,
  Textarea,
  TextareaInput,
  VStack,
} from '@gluestack-ui/themed';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronRight,
  Flag,
  Layers,
  Save,
  ShieldAlert,
  ShieldCheck,
  X,
} from 'lucide-react-native';

import { Button, Content, Header, Text } from '@/Components/Common';
import RadialBackground from '@/Components/Themed/RadialBackground';
import { finishModule, RootStackParamList } from '@/Navigators';
import { RootState } from '@/Store';
import { Evaluation } from '@/Models/Evaluation/Evaluation';
import { AshaMilestoneTest } from '@/Models/Asha/AshaMilestoneTest';
import { useClassSelector } from '@/Helpers/ClassTransformer';
import { useTelemetryTracker } from '@/Telemetry';
import { showErrorToast, showSuccessToast } from '@/Helpers/showToast';
import { AshaMilestoneTestRepository } from '@/Repositories/AshaMilestoneTestRepository';
import { ageInMonthsFromDob } from '@/Helpers/patientAge';

import {
  ASHA_AGE_BANDS,
  ASHA_DOMAIN_META,
  AshaAgeBand,
  getMilestonesForAgeBand,
  resolveAgeBandFromMonths,
} from './ashaMilestones';
import { evaluateAshaScreening } from './ashaCdssEngine';

import { useT } from '@/I18n';
type Props = NativeStackScreenProps<RootStackParamList, 'AshaScreening'>;

interface FormValues {
  ageBand: AshaAgeBand;
  responses: Record<string, boolean | null>;
  notes: string;
  evaluatorName: string;
  evaluatorLicense: string;
}

export default function AshaScreeningScreen({ navigation }: Props) {
  const t = useT();
  const activeEvaluation = useClassSelector(Evaluation, (state: RootState) => state.activeEvaluation.evaluation);
  const tracker = useTelemetryTracker();

  // Control de Riesgo Crítico (ISO 14971) - Modal bloqueante inicial
  const [riskModalOpen, setRiskModalOpen] = useState(true);
  const [riskNoticeAccepted, setRiskNoticeAccepted] = useState(false);

  // Banda inicial deducida de la fecha de nacimiento de la ficha. Si la ficha
  // no la trae o no es interpretable, NO se elige una por el clínico en
  // silencio: la banda decide qué hitos se preguntan y con qué norma se
  // comparan, así que una banda inventada es un resultado inventado. Se
  // preselecciona la del medio y la pantalla DICE que no viene del paciente.
  const patientMonths = useMemo(
    () => ageInMonthsFromDob(activeEvaluation?.patient?.dobEnc),
    [activeEvaluation?.patient?.dobEnc],
  );
  const ageBandIsDerived = patientMonths != null;
  const initialAgeBand: AshaAgeBand = useMemo(
    () => (patientMonths == null ? '19-24m' : resolveAgeBandFromMonths(patientMonths)),
    [patientMonths],
  );

  const [selectedAgeBand, setSelectedAgeBand] = useState<AshaAgeBand>(initialAgeBand);
  const [isSaving, setIsSaving] = useState(false);

  const { control, handleSubmit, watch, setValue } = useForm<FormValues>({
    defaultValues: {
      ageBand: initialAgeBand,
      responses: {},
      notes: '',
      evaluatorName: activeEvaluation?.professional?.name ?? '',
      evaluatorLicense: activeEvaluation?.professional?.licenseNumber ?? '',
    },
  });

  const formResponses = watch('responses');
  const milestones = useMemo(() => getMilestonesForAgeBand(selectedAgeBand), [selectedAgeBand]);

  // Cálculo en vivo del motor CDSS
  const cdssResult = useMemo(() => {
    return evaluateAshaScreening(formResponses, milestones);
  }, [formResponses, milestones]);

  useEffect(() => {
    tracker.enterReactivo('asha-screening-mount');
  }, [tracker]);

  const handleAcceptRiskNotice = () => {
    setRiskNoticeAccepted(true);
    setRiskModalOpen(false);
    tracker.classifyReactivo('asha-iso14971-accepted');
  };

  const handleAgeBandChange = (newBand: AshaAgeBand) => {
    setSelectedAgeBand(newBand);
    setValue('ageBand', newBand);
    setValue('responses', {}); // Reiniciar respuestas para nueva banda
    tracker.classifyReactivo(`asha-band-${newBand}`);
  };

  const onSubmit = async (data: FormValues) => {
    if (!riskNoticeAccepted) {
      showErrorToast('Verificación requerida', 'Debe confirmar el aviso regulatorio ISO 14971 antes de guardar.');
      setRiskModalOpen(true);
      return;
    }

    // Verificar que todos los hitos de la banda han sido evaluados
    const evaluatedKeys = Object.keys(data.responses).filter(k => data.responses[k] !== null && data.responses[k] !== undefined);
    if (evaluatedKeys.length < milestones.length) {
      showErrorToast(
        'Evaluación incompleta',
        `Por favor responda todos los ${milestones.length} hitos de la banda de edad seleccionada (${evaluatedKeys.length}/${milestones.length} evaluados).`,
      );
      return;
    }

    setIsSaving(true);
    try {
      tracker.classifyReactivo('asha-submitting');
      const testRecord = new AshaMilestoneTest();
      testRecord.ageBand = data.ageBand;
      testRecord.responses = data.responses as Record<string, boolean>;
      testRecord.riskLevel = cdssResult.riskLevel;
      testRecord.recommendedReferrals = cdssResult.recommendedReferrals;
      testRecord.failedDomains = cdssResult.failedDomains;
      testRecord.evaluatorName = data.evaluatorName.trim() || (activeEvaluation?.professional?.name ?? 'Profesional Clínico');
      testRecord.evaluatorLicense = data.evaluatorLicense.trim() || (activeEvaluation?.professional?.licenseNumber ?? 'N/A');
      testRecord.notes = data.notes.trim();
      testRecord.completedAt = new Date();

      if (activeEvaluation) {
        testRecord.evaluation = activeEvaluation;
      }

      await AshaMilestoneTestRepository.createAshaTest(testRecord);
      showSuccessToast('Cribado ASHA Guardado', `Nivel de riesgo: ${cdssResult.riskLabel}`);
      tracker.endSession();

      // Navegar a resultados preliminares
      finishModule(navigation);
    } catch (error) {
      showErrorToast('Error al guardar', error instanceof Error ? error.message : 'No se pudo persistir el resultado localmente.');
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
      <VStack flex={1} px="$6">
        <Header animationType="expand" />

        <VStack mb="$2">
          <Text size="2xl" weight="bold" color="$textLight900">
            
            {t.ashaScreening.cribadoHitosAsha}
          </Text>
          <Text size="sm" color="$textLight600">
            
            {t.ashaScreening.apoyoDecisionClinicaPercentil75}
          </Text>
        </VStack>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
          {/* Tarjeta de Identificación y Banda de Edad */}
          <Card bgColor="$white" borderRadius={20} p="$4" mb="$4" borderWidth={1} borderColor="$borderLight100">
            <HStack justifyContent="space-between" alignItems="center" mb="$3">
              <HStack space="xs" alignItems="center">
                <Icon as={Layers} size="sm" color="$primary600" />
                <Text size="sm" weight="bold" color="$textLight900">
                  
                  {t.ashaScreening.bandaEdadNormativa}
                </Text>
              </HStack>
              <Box px="$2.5" py="$1" borderRadius="$full" bg="$primary50">
                <Text size="2xs" weight="bold" color="$primary700">
                  
                  {t.ashaScreening.asha75thIle}
                </Text>
              </Box>
            </HStack>

            {/* De dónde sale la banda. Si no se pudo deducir de la ficha, la
                pantalla lo dice: elegirla en silencio decidiría con qué norma
                se compara al niño sin que nadie lo haya visto. */}
            <HStack space="xs" alignItems="center" mb="$2">
              <Icon
                as={ageBandIsDerived ? CheckCircle2 : AlertTriangle}
                size="xs"
                color={ageBandIsDerived ? '$success600' : '$warning600'}
              />
              <Text size="2xs" color={ageBandIsDerived ? '$textLight600' : '$warning700'}>
                {ageBandIsDerived
                  ? t.ashaScreening.deducidaFechaNacimientoFichaMeses(patientMonths)
                  : t.ashaScreening.fichaTraeFechaNacimientoUtilizable}
              </Text>
            </HStack>

            {/* Selector de Bandas de Edad */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              <HStack space="xs">
                {ASHA_AGE_BANDS.map(band => {
                  const isSelected = selectedAgeBand === band.id;
                  return (
                    <Pressable key={band.id} onPress={() => handleAgeBandChange(band.id)}>
                      <Box
                        px="$3"
                        py="$2"
                        borderRadius={12}
                        borderWidth={1.5}
                        borderColor={isSelected ? '$primary500' : '$borderLight200'}
                        bg={isSelected ? '$primary500' : '$backgroundLight50'}>
                        <Text size="xs" weight="bold" color={isSelected ? '$white' : '$textLight700'}>
                          {band.label}
                        </Text>
                      </Box>
                    </Pressable>
                  );
                })}
              </HStack>
            </ScrollView>

            <Text size="2xs" color="$textLight500" style={{ lineHeight: 16 }}>
              {ASHA_AGE_BANDS.find(b => b.id === selectedAgeBand)?.description}
            </Text>
          </Card>

          {/* Listado de Hitos Clínicos */}
          <VStack space="md" mb="$4">
            {milestones.map((milestone, index) => {
              const domainInfo = ASHA_DOMAIN_META[milestone.domain];
              return (
                <Controller
                  key={milestone.id}
                  name="responses"
                  control={control}
                  render={({ field: { value, onChange } }) => {
                    const currentVal = value?.[milestone.id];
                    return (
                      <Card
                        bgColor="$white"
                        borderRadius={18}
                        p="$4"
                        borderWidth={1}
                        borderColor={
                          currentVal === false && milestone.isRedFlag
                            ? '$error300'
                            : currentVal === true
                            ? '$success200'
                            : currentVal === false
                            ? '$warning200'
                            : '$borderLight100'
                        }>
                        {/* Cabecera del Hito */}
                        <HStack justifyContent="space-between" alignItems="flex-start" mb="$2">
                          <HStack space="xs" alignItems="center" style={{ flex: 1 }}>
                            <Box
                              px="$2"
                              py="$0.5"
                              borderRadius={6}
                              style={{ backgroundColor: `${domainInfo.color}15` }}>
                              <Text size="2xs" weight="bold" style={{ color: domainInfo.color }}>
                                {domainInfo.label}
                              </Text>
                            </Box>

                            {milestone.isRedFlag ? (
                              <HStack space="xs" alignItems="center" bg="$error50" px="$2" py="$0.5" borderRadius={6}>
                                <Icon as={Flag} size="xs" color="$error600" />
                                <Text size="2xs" weight="bold" color="$error700">
                                  
                                  {t.ashaScreening.banderaRoja}
                                </Text>
                              </HStack>
                            ) : null}
                          </HStack>

                          <Text size="2xs" color="$textLight400">
                            #{index + 1}
                          </Text>
                        </HStack>

                        {/* Texto del Hito */}
                        <Text size="sm" weight="medium" color="$textLight900" mb="$1" style={{ lineHeight: 20 }}>
                          {milestone.text}
                        </Text>

                        {milestone.description ? (
                          <Text size="2xs" color="$textLight500" mb="$3" style={{ lineHeight: 15 }}>
                            {milestone.description}
                          </Text>
                        ) : (
                          <Box mb="$2" />
                        )}

                        {/* Botonera de Respuesta Clínica */}
                        <HStack space="sm" mt="$1">
                          {/* Cumple (Sí) */}
                          <Pressable
                            style={{ flex: 1 }}
                            onPress={() => {
                              const updated = { ...value, [milestone.id]: true };
                              onChange(updated);
                              tracker.classifyReactivo(`asha-${milestone.id}-yes`);
                            }}>
                            <Center
                              py="$2.5"
                              borderRadius={12}
                              borderWidth={1.5}
                              borderColor={currentVal === true ? '$success600' : '$borderLight200'}
                              bg={currentVal === true ? '$success50' : '$white'}>
                              <HStack space="xs" alignItems="center">
                                <Icon as={Check} size="xs" color={currentVal === true ? '$success600' : '$textLight500'} />
                                <Text
                                  size="xs"
                                  weight="bold"
                                  color={currentVal === true ? '$success700' : '$textLight700'}>
                                  
                                  {t.ashaScreening.cumple}
                                </Text>
                              </HStack>
                            </Center>
                          </Pressable>

                          {/* No Cumple (No) */}
                          <Pressable
                            style={{ flex: 1 }}
                            onPress={() => {
                              const updated = { ...value, [milestone.id]: false };
                              onChange(updated);
                              tracker.classifyReactivo(`asha-${milestone.id}-no`);
                            }}>
                            <Center
                              py="$2.5"
                              borderRadius={12}
                              borderWidth={1.5}
                              borderColor={currentVal === false ? '$error600' : '$borderLight200'}
                              bg={currentVal === false ? '$error50' : '$white'}>
                              <HStack space="xs" alignItems="center">
                                <Icon as={X} size="xs" color={currentVal === false ? '$error600' : '$textLight500'} />
                                <Text
                                  size="xs"
                                  weight="bold"
                                  color={currentVal === false ? '$error700' : '$textLight700'}>
                                  
                                  {t.ashaScreening.cumple2}
                                </Text>
                              </HStack>
                            </Center>
                          </Pressable>
                        </HStack>
                      </Card>
                    );
                  }}
                />
              );
            })}
          </VStack>

          {/* Resumen CDSS en Vivo */}
          <Card bgColor="$white" borderRadius={20} p="$4" mb="$4" borderWidth={1} borderColor="$borderLight100">
            <HStack justifyContent="space-between" alignItems="center" mb="$3">
              <HStack space="xs" alignItems="center">
                <Icon as={ShieldCheck} size="sm" color="$primary600" />
                <Text size="sm" weight="bold" color="$textLight900">
                  
                  {t.ashaScreening.dictamenCdssPreliminar}
                </Text>
              </HStack>
              <Box px="$3" py="$1" borderRadius="$full" style={{ backgroundColor: `${cdssResult.riskColor}20` }}>
                <Text size="2xs" weight="bold" style={{ color: cdssResult.riskColor }}>
                  {cdssResult.riskLabel}
                </Text>
              </Box>
            </HStack>

            <Text size="xs" color="$textLight700" mb="$3" style={{ lineHeight: 18 }}>
              {cdssResult.clinicalSummary}
            </Text>

            {/* Rutas de derivación recomendadas */}
            <VStack space="xs" mb="$3">
              <Text size="2xs" weight="bold" color="$textLight500" style={{ textTransform: 'uppercase' }}>
                
                {t.ashaScreening.rutasDerivacionRecomendadas}
              </Text>
              {cdssResult.recommendedReferrals.map((ref, idx) => (
                <HStack key={idx} space="xs" alignItems="flex-start">
                  <Icon as={ChevronRight} size="2xs" color="$primary600" style={{ marginTop: 3 }} />
                  <Text size="xs" color="$textLight800" style={{ flex: 1, lineHeight: 18 }}>
                    {ref}
                  </Text>
                </HStack>
              ))}
            </VStack>

            {/* Banderas Rojas */}
            {cdssResult.redFlagsDetected.length > 0 ? (
              <Box p="$3" borderRadius={12} bg="$error50" borderWidth={1} borderColor="$error200">
                <HStack space="xs" alignItems="center" mb="$1">
                  <Icon as={AlertTriangle} size="xs" color="$error600" />
                  <Text size="xs" weight="bold" color="$error800">
                    
                    {t.ashaScreening.banderasRojasDetectadas}{cdssResult.redFlagsDetected.length}):
                  </Text>
                </HStack>
                {cdssResult.redFlagsDetected.map(rf => (
                  <Text key={rf.id} size="2xs" color="$error700" style={{ lineHeight: 15 }}>
                    • {rf.text}
                  </Text>
                ))}
              </Box>
            ) : null}
          </Card>

          {/* Observaciones y Firma */}
          <Card bgColor="$white" borderRadius={20} p="$4" mb="$5" borderWidth={1} borderColor="$borderLight100">
            <Text size="sm" weight="bold" color="$textLight900" mb="$3">
              
              {t.ashaScreening.observacionesClinicasFirma}
            </Text>

            <Controller
              name="notes"
              control={control}
              render={({ field: { value, onChange } }) => (
                <Textarea size="md" mb="$3" borderRadius={12} borderWidth={1} borderColor="$borderLight200">
                  <TextareaInput
                    placeholder={t.ashaScreening.observacionesInteraccionContextoComunicativoConducta}
                    value={value}
                    onChangeText={onChange}
                  />
                </Textarea>
              )}
            />

            <HStack space="sm">
              <Controller
                name="evaluatorName"
                control={control}
                render={({ field: { value, onChange } }) => (
                  <Input size="sm" style={{ flex: 1 }} borderRadius={12} borderWidth={1} borderColor="$borderLight200">
                    <InputField placeholder={t.ashaScreening.nombreEvaluador} value={value} onChangeText={onChange} />
                  </Input>
                )}
              />
              <Controller
                name="evaluatorLicense"
                control={control}
                render={({ field: { value, onChange } }) => (
                  <Input size="sm" style={{ flex: 1 }} borderRadius={12} borderWidth={1} borderColor="$borderLight200">
                    <InputField placeholder={t.ashaScreening.nColegiadoLicencia} value={value} onChangeText={onChange} />
                  </Input>
                )}
              />
            </HStack>
          </Card>

          {/* Botón de Guardado Final */}
          <Button
            action="primary"
            variant="solid"
            rounded="$xl"
            isDisabled={isSaving}
            onPress={handleSubmit(onSubmit)}>
            <HStack space="sm" alignItems="center">
              <Icon as={Save} size="sm" color="$white" />
              <Text size="sm" weight="bold" color="$white">
                {isSaving ? t.ashaScreening.guardando : t.ashaScreening.guardarFinalizarCribado}
              </Text>
            </HStack>
          </Button>
        </ScrollView>

        {/* ─── Modal Bloqueante de Riesgo Crítico (ISO 14971) ───────────────── */}
        <Modal
          visible={riskModalOpen}
          transparent
          animationType="fade"
          onRequestClose={() => {
            // Modal bloqueante: no se cierra pulsando atrás sin aceptar
          }}>
          <Box flex={1} bg="rgba(0,0,0,0.65)" justifyContent="center" alignItems="center" p="$4">
            <Card bgColor="$white" borderRadius={24} p="$6" borderWidth={1} borderColor="$borderLight100" style={{ maxWidth: 420, width: '100%' }}>
              <Center mb="$4">
                <Box p="$4" borderRadius="$full" bg="$warning50">
                  <Icon as={ShieldAlert} size="xl" color="$warning600" />
                </Box>
              </Center>

              <Text size="lg" weight="bold" color="$textLight900" textAlign="center" mb="$2">
                
                {t.ashaScreening.controlRiesgoCriticoIso14971}
              </Text>

              <Text size="xs" color="$textLight500" textAlign="center" mb="$4">
                
                {t.ashaScreening.moduloApoyoDecisionClinicaSamd}
              </Text>

              <Box p="$4" borderRadius={14} bg="$backgroundLight50" mb="$5" borderWidth={1} borderColor="$borderLight200">
                <Text size="sm" color="$textLight800" textAlign="center" weight="medium" style={{ lineHeight: 22 }}>
                  
                  {t.ashaScreening.confirmoEstaEvaluacionRealizaraMediante}
                </Text>
              </Box>

              <Button
                action="primary"
                variant="solid"
                rounded="$xl"
                onPress={handleAcceptRiskNotice}>
                <HStack space="xs" alignItems="center">
                  <Icon as={CheckCircle2} size="sm" color="$white" />
                  <Text size="sm" weight="bold" color="$white">
                    
                    {t.ashaScreening.aceptarContinuar}
                  </Text>
                </HStack>
              </Button>
            </Card>
          </Box>
        </Modal>
      </VStack>
    </Content>
  );
}
