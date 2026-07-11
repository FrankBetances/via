import React, { useEffect, useMemo, useState } from 'react';
import { Pressable } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSelector } from 'react-redux';
import {
  Box,
  Card,
  Center,
  HStack,
  Icon,
  Input,
  InputField,
  ScrollView,
  VStack,
} from '@gluestack-ui/themed';
import {
  ArrowRight,
  Check,
  ShieldCheck,
  Users,
} from 'lucide-react-native';

import { Button, Content, Header, SignaturePad, Text } from '@/Components/Common';
import RadialBackground from '@/Components/Themed/RadialBackground';
import { RootStackParamList } from '@/Navigators';
import { RootState } from '@/Store';
import { Evaluation } from '@/Models/Evaluation/Evaluation';
import { ConsentSignerType, InformedConsent } from '@/Models/InformedConsent/InformedConsent';
import { Professional } from '@/Models/Professional/Professional';
import { Patient } from '@/Models/Patient/Patient';
import { PatientRepository } from '@/Repositories/PatientRepository';
import { EvaluationRepository } from '@/Repositories/EvaluationRepository';
import { InformedConsentRepository } from '@/Repositories/InformedConsentRepository';
import { ClinicalAssessmentRepository } from '@/Repositories/ClinicalAssessmentRepository';
import { showErrorToast, showSuccessToast } from '@/Helpers/showToast';
import { writeWithVerify } from '@/Helpers/dbWrite';

/* -------------------------------------------------------------------------- */
/*  ConsentimientoScreen — consentimiento informado BLOQUEANTE.               */
/*  Flujo: RegistroPaciente → AQUÍ → CAP (o exploración de disfagia).          */
/*                                                                            */
/*  Reglas de firma:                                                          */
/*   · Menor de edad  → firma padre/madre/tutor legal.                        */
/*   · Adulto         → firma el propio paciente; o un familiar/representante  */
/*     si existe un trastorno neurodegenerativo u otra incapacidad para       */
/*     firmar (se registra el motivo).                                        */
/*                                                                            */
/*  Persistencia: tabla nueva `informed_consent` (sin tocar columnas de       */
/*  `evaluation`, salvo el UPDATE parcial de `consentSignedAt` que ya existía  */
/*  en el esquema). Todas las escrituras van con `writeWithVerify` para que   */
/*  la pantalla no pueda quedarse colgada si el driver no responde (ver        */
/*  Helpers/dbWrite.ts).                                                      */
/* -------------------------------------------------------------------------- */

type Props = NativeStackScreenProps<RootStackParamList, 'Consentimiento'>;

/** Actualizar al cambiar el texto legal mostrado (trazabilidad de versiones). */
const CONSENT_VERSION = '1.0';

const CONSENT_PARAGRAPHS = [
  'Se le propone realizar una evaluación de cribado de la audición, el habla, la voz y la deglución mediante la aplicación VIA+. La sesión incluye pruebas breves, no invasivas y sin riesgos conocidos: cuestionarios clínicos, audiometría de cribado, análisis acústico de la voz (con grabación de audio), exploración de la articulación y, si procede, exploración de la deglución.',
  'Los resultados tienen carácter de CRIBADO ORIENTATIVO: no constituyen por sí mismos un diagnóstico y pueden recomendar una valoración especializada posterior.',
  'Los datos y grabaciones se almacenan de forma local en este dispositivo, se utilizan únicamente para elaborar el informe clínico de esta evaluación y son tratados por el profesional responsable conforme a la normativa de protección de datos aplicable.',
  'La participación es voluntaria: puede negarse a realizar alguna prueba o retirar el consentimiento en cualquier momento sin perjuicio para la atención recibida.',
];

const GUARDIAN_RELATIONS = ['Madre', 'Padre', 'Tutor/a legal'];

const AGREE_ITEMS = [
  'He leído y comprendido la información anterior y he podido resolver mis dudas con el profesional.',
  'Autorizo la realización de las pruebas y el registro de los datos y grabaciones necesarios para el informe clínico.',
];

/** Edad en años cumplidos a partir de 'AAAA-MM-DD'; null si no es interpretable. */
function ageFromDob(isoDob: string | null | undefined): number | null {
  if (!isoDob || !/^\d{4}-\d{2}-\d{2}$/.test(isoDob.trim())) return null;
  const dob = new Date(`${isoDob.trim()}T00:00:00`);
  if (Number.isNaN(dob.getTime())) return null;
  const now = new Date();
  let years = now.getFullYear() - dob.getFullYear();
  if (
    now.getMonth() < dob.getMonth() ||
    (now.getMonth() === dob.getMonth() && now.getDate() < dob.getDate())
  ) {
    years -= 1;
  }
  return years;
}

/* --------------------------------- Pantalla -------------------------------- */

export default function ConsentimientoScreen({ navigation, route }: Props) {
  const next = route.params?.next ?? 'cap';
  const activeEvaluation = useSelector((state: RootState) => state.activeEvaluation.evaluation);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [scrollEnabled, setScrollEnabled] = useState(true);

  /** null = fecha de nacimiento no interpretable (se ofrecen todas las opciones). */
  const [isMinor, setIsMinor] = useState<boolean | null>(null);
  const [existingConsent, setExistingConsent] = useState<InformedConsent | null>(null);

  const [signerType, setSignerType] = useState<ConsentSignerType>('guardian');
  const [signerName, setSignerName] = useState('');
  const [signerRelation, setSignerRelation] = useState('');
  const [incapacityReason, setIncapacityReason] = useState('');
  const [agreed, setAgreed] = useState<boolean[]>(AGREE_ITEMS.map(() => false));
  const [signaturePaths, setSignaturePaths] = useState<string[]>([]);

  const patientView = activeEvaluation?.patient;
  const patientName = patientView ? `${patientView.name} ${patientView.lastName}`.trim() : null;

  // Carga inicial: edad del paciente (para el régimen de firma) y consentimiento previo.
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (patientView?.id) {
          const patient = await PatientRepository.getPatientById(patientView.id);
          const age = ageFromDob(patient?.dobEnc);
          if (!mounted) return;
          if (age !== null) {
            const minor = age < 18;
            setIsMinor(minor);
            setSignerType(minor ? 'guardian' : 'patient');
            if (!minor) setSignerName(patient?.nameEnc ?? '');
          }
        }
        if (activeEvaluation?.id) {
          const existing = await InformedConsentRepository.getLatestByEvaluation(activeEvaluation.id);
          if (mounted && existing) setExistingConsent(existing);
        }
      } catch (e) {
        console.warn('VIA+: no se pudo cargar el estado del consentimiento', e);
      } finally {
        if (mounted) setIsLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signerOptions = useMemo(() => {
    const guardian = { value: 'guardian' as const, label: 'Padre/Madre/Tutor' };
    const patient = { value: 'patient' as const, label: 'El propio paciente' };
    const family = { value: 'family' as const, label: 'Familiar/representante' };
    if (isMinor === true) return [guardian];
    if (isMinor === false) return [patient, family];
    return [guardian, patient, family];
  }, [isMinor]);

  const needsRelation = signerType !== 'patient';
  const needsReason = signerType === 'family';

  const ready =
    !!signerName.trim() &&
    (!needsRelation || !!signerRelation.trim()) &&
    (!needsReason || !!incapacityReason.trim()) &&
    agreed.every(Boolean) &&
    signaturePaths.length > 0;

  const setSignerMode = (value: ConsentSignerType) => {
    setSignerType(value);
    setSignerRelation('');
    // Si firma el propio paciente se precarga su nombre; para tutor/familiar
    // el campo queda vacío (lo rellena quien firma).
    setSignerName(value === 'patient' ? patientName ?? '' : '');
    if (value === 'patient') setIncapacityReason('');
  };

  /**
   * Garantiza un id real de `Evaluation` (mismo salvavidas que el CAP para
   * sesiones antiguas que llegan con id 0): sin id real, el INSERT del
   * consentimiento violaría la FK y bloquearía el flujo.
   */
  const ensureEvaluationId = async (): Promise<number | null> => {
    if (activeEvaluation?.id) return activeEvaluation.id;
    const patientId = activeEvaluation?.patient?.id;
    if (!patientId) return null;

    const pending = await EvaluationRepository.getLatestPendingByPatient(patientId);
    if (pending) return pending.id;

    const nueva = new Evaluation();
    nueva.patient = { id: patientId } as Patient;
    if (activeEvaluation?.professional?.id) {
      nueva.professional = { id: activeEvaluation.professional.id } as Professional;
    }
    nueva.status = 'in_progress';
    nueva.capApproved = false;
    nueva.capNotes = null;
    nueva.consentSignedAt = null;
    nueva.completedAt = null;
    const saved = await writeWithVerify(
      () => EvaluationRepository.createEvaluation(nueva),
      () => EvaluationRepository.getLatestPendingByPatient(patientId),
    );
    return saved.id;
  };

  /** Continúa el flujo tras la firma (o con consentimiento ya existente). */
  const goNext = async (evaluationId: number | null) => {
    if (next === 'dysphagia') {
      navigation.navigate('DysphagiaTest');
      return;
    }
    // Con CAP ya emitido (reanudación de sesión antigua), saltar directamente
    // a la verificación de sala, igual que hace PacientesScreen.
    let hasCap = false;
    if (evaluationId) {
      try {
        hasCap = !!(await ClinicalAssessmentRepository.getLatestByEvaluation(evaluationId));
      } catch {
        hasCap = false;
      }
    }
    navigation.navigate(hasCap ? 'RoomNoiseCheck' : 'ClinicalAssessment');
  };

  const handleSign = async () => {
    if (!ready || isSaving) return;
    if (!activeEvaluation) {
      showErrorToast('No se puede firmar', 'No hay una evaluación activa asociada al paciente.');
      return;
    }
    setIsSaving(true);
    try {
      const evaluationId = await ensureEvaluationId();
      if (!evaluationId) {
        showErrorToast(
          'No se puede firmar',
          'No hay una evaluación activa. Vuelva a la lista de pacientes y seleccione el paciente de nuevo.',
        );
        return;
      }

      const consent = new InformedConsent();
      consent.consentVersion = CONSENT_VERSION;
      consent.signerType = signerType;
      consent.signerName = signerName.trim();
      consent.signerRelation = signerType === 'patient' ? '' : signerRelation.trim();
      consent.incapacityReason = signerType === 'family' ? incapacityReason.trim() : null;
      consent.patientIsMinor = isMinor === true;
      consent.signatureSvg = signaturePaths.join(' ');
      consent.signedAt = new Date();
      consent.evaluation = { id: evaluationId } as Evaluation;

      // Escritura con verificación por lectura (ver Helpers/dbWrite.ts). Solo
      // se acepta como "guardado" un consentimiento de este intento.
      const attemptTime = consent.signedAt.getTime();
      await writeWithVerify(
        () => InformedConsentRepository.createInformedConsent(consent),
        async () => {
          const latest = await InformedConsentRepository.getLatestByEvaluation(evaluationId);
          if (!latest?.signedAt) return null;
          return new Date(latest.signedAt).getTime() >= attemptTime - 60_000 ? latest : null;
        },
      );

      // Marca rápida en `evaluation` — mejor esfuerzo: la fila de
      // `informed_consent` ya está persistida y es la fuente de verdad, así
      // que un fallo aquí NO debe bloquear el flujo clínico.
      try {
        await writeWithVerify(
          () => EvaluationRepository.markConsentSigned(evaluationId, consent.signedAt).then(() => true as const),
          async () => {
            const ev = await EvaluationRepository.getEvaluationById(evaluationId);
            return ev?.consentSignedAt ? (true as const) : null;
          },
        );
      } catch (flagError) {
        console.warn('VIA+: no se pudo marcar consentSignedAt en evaluation', flagError);
      }

      showSuccessToast('Consentimiento firmado', `Firmado por ${consent.signerName}.`);
      await goNext(evaluationId);
    } catch (e) {
      const detail = e instanceof Error && e.message ? ` (${e.message})` : '';
      console.error('VIA+: error guardando consentimiento', e);
      showErrorToast('Error al guardar', `No se pudo registrar el consentimiento.${detail}`);
    } finally {
      setIsSaving(false);
    }
  };

  /* ------------------------------- render -------------------------------- */

  const signerTypeLabel = (t: ConsentSignerType) =>
    t === 'patient' ? 'el propio paciente' : t === 'guardian' ? 'padre/madre/tutor legal' : 'familiar/representante';

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

        <ScrollView showsVerticalScrollIndicator={false} scrollEnabled={scrollEnabled} keyboardShouldPersistTaps="handled">
          <VStack flex={1} px="$6" mt="$2" space="md" pb="$10">
            {/* título */}
            <VStack>
              <HStack alignItems="center" space="sm">
                <Text size="2xl" weight="bold" color="$textLight900">
                  Consentimiento informado
                </Text>
                <Box bg="$primary50" px="$2" py="$0.5" borderRadius="$full">
                  <Text size="2xs" weight="bold" color="$primary800" style={{ letterSpacing: 0.4 }}>
                    OBLIGATORIO
                  </Text>
                </Box>
              </HStack>
              <Text size="xs" color="$textLight500">
                {patientName ? `Paciente: ${patientName}` : 'Debe firmarse antes de iniciar las pruebas'}
              </Text>
            </VStack>

            {/* stepper */}
            <HStack space="xs" alignItems="center">
              {[
                { n: 1, label: 'Paciente', done: true, active: false },
                { n: 2, label: 'Consent.', done: false, active: true },
                { n: 3, label: 'CAP', done: false, active: false },
                { n: 4, label: 'Sala', done: false, active: false },
                { n: 5, label: 'Pruebas', done: false, active: false },
              ].map((step, idx) => (
                <React.Fragment key={step.n}>
                  <HStack alignItems="center" space="xs">
                    <Box
                      w={20}
                      h={20}
                      borderRadius="$full"
                      alignItems="center"
                      justifyContent="center"
                      bg={step.active ? '$primary500' : step.done ? '$success500' : '$white'}
                      borderWidth={step.active || step.done ? 0 : 1.5}
                      borderColor="$borderLight300">
                      {step.done ? (
                        <Icon as={Check} size="2xs" color="$white" />
                      ) : (
                        <Text size="2xs" weight="bold" color={step.active ? '$white' : '$textLight400'}>
                          {step.n}
                        </Text>
                      )}
                    </Box>
                    <Text size="2xs" weight="semiBold" color={step.active ? '$textLight800' : '$textLight400'}>
                      {step.label}
                    </Text>
                  </HStack>
                  {idx < 4 ? <Box style={{ flex: 1, height: 1 }} bg="$borderLight200" /> : null}
                </React.Fragment>
              ))}
            </HStack>

            {existingConsent ? (
              /* --------- consentimiento ya firmado para esta evaluación --------- */
              <Card bgColor="$white" borderRadius={22} p="$5">
                <HStack alignItems="center" space="sm" mb="$3">
                  <Center w={40} h={40} borderRadius={12} bg="$success50">
                    <Icon as={ShieldCheck} size="lg" color="$success600" />
                  </Center>
                  <VStack style={{ flex: 1 }}>
                    <Text size="md" weight="bold" color="$textLight900">
                      Consentimiento ya firmado
                    </Text>
                    <Text size="2xs" color="$textLight500">
                      {new Date(existingConsent.signedAt).toLocaleString('es-ES')}
                    </Text>
                  </VStack>
                </HStack>
                <Text size="sm" color="$textLight700" mb="$4" style={{ lineHeight: 20 }}>
                  Firmado por <Text size="sm" weight="bold" color="$textLight900">{existingConsent.signerName}</Text>
                  {existingConsent.signerRelation ? ` (${existingConsent.signerRelation})` : ''} —{' '}
                  {signerTypeLabel(existingConsent.signerType)}.
                </Text>
                <Button action="primary" variant="solid" rounded="$full" onPress={() => goNext(activeEvaluation?.id ?? null)}>
                  <HStack space="sm" alignItems="center">
                    <Text size="md" weight="bold" color="$white">
                      Continuar
                    </Text>
                    <Icon as={ArrowRight} size="sm" color="$white" />
                  </HStack>
                </Button>
              </Card>
            ) : (
              <>
                {/* --------- información al paciente --------- */}
                <Card bgColor="$white" borderRadius={22} p="$5">
                  <HStack alignItems="center" space="sm" mb="$3">
                    <Center w={40} h={40} borderRadius={12} bg="$primary50">
                      <Icon as={ShieldCheck} size="lg" color="$primary600" />
                    </Center>
                    <VStack style={{ flex: 1 }}>
                      <Text size="md" weight="bold" color="$textLight900">
                        Información de la evaluación
                      </Text>
                      <Text size="2xs" color="$textLight500">
                        Versión del documento {CONSENT_VERSION}
                      </Text>
                    </VStack>
                  </HStack>
                  <VStack space="sm">
                    {CONSENT_PARAGRAPHS.map((p, i) => (
                      <Text key={i} size="xs" color="$textLight700" style={{ lineHeight: 18 }}>
                        {p}
                      </Text>
                    ))}
                  </VStack>
                </Card>

                {/* --------- quién firma --------- */}
                <Card bgColor="$white" borderRadius={22} p="$5">
                  <HStack alignItems="center" space="sm" mb="$3">
                    <Center w={40} h={40} borderRadius={12} bg="$primary50">
                      <Icon as={Users} size="lg" color="$primary600" />
                    </Center>
                    <VStack style={{ flex: 1 }}>
                      <Text size="md" weight="bold" color="$textLight900">
                        Persona que firma
                      </Text>
                      <Text size="2xs" color="$textLight500">
                        {isLoading
                          ? 'Comprobando la edad del paciente…'
                          : isMinor === true
                            ? 'Paciente menor de edad: firma su padre/madre o tutor legal'
                            : isMinor === false
                              ? 'Paciente mayor de edad'
                              : 'No se pudo determinar la edad del paciente'}
                      </Text>
                    </VStack>
                  </HStack>

                  {signerOptions.length > 1 ? (
                    <HStack space="sm" mb="$4">
                      {signerOptions.map(opt => {
                        const selected = signerType === opt.value;
                        return (
                          <Pressable key={opt.value} style={{ flex: 1 }} onPress={() => setSignerMode(opt.value)}>
                            <Box
                              alignItems="center"
                              py="$2"
                              px="$1"
                              borderRadius={12}
                              borderWidth={1.5}
                              bg={selected ? '$primary50' : '$white'}
                              borderColor={selected ? '$primary500' : '$borderLight200'}>
                              <Text
                                size="2xs"
                                weight="bold"
                                color={selected ? '$primary600' : '$textLight400'}
                                style={{ textAlign: 'center' }}>
                                {opt.label}
                              </Text>
                            </Box>
                          </Pressable>
                        );
                      })}
                    </HStack>
                  ) : null}

                  {signerType === 'family' ? (
                    <HStack space="sm" alignItems="flex-start" p="$3" borderRadius={14} bg="$warning50" mb="$4">
                      <Text size="xs" color="$warning800" style={{ flex: 1, lineHeight: 17 }}>
                        Firma en representación de un adulto que no puede hacerlo por sí mismo (p. ej.,
                        trastorno neurodegenerativo o incapacidad para firmar). Indique el motivo: quedará
                        registrado en el consentimiento.
                      </Text>
                    </HStack>
                  ) : null}

                  <Text size="xs" weight="semiBold" color="$textLight600" mb="$1.5">
                    Nombre y apellidos de quien firma
                  </Text>
                  <Input variant="outline" borderRadius={12} mb="$4">
                    <InputField placeholder="Nombre completo" value={signerName} onChangeText={setSignerName} />
                  </Input>

                  {needsRelation ? (
                    <>
                      <Text size="xs" weight="semiBold" color="$textLight600" mb="$1.5">
                        Relación con el paciente
                      </Text>
                      {signerType === 'guardian' ? (
                        <HStack space="sm" mb="$4">
                          {GUARDIAN_RELATIONS.map(rel => {
                            const selected = signerRelation === rel;
                            return (
                              <Pressable key={rel} style={{ flex: 1 }} onPress={() => setSignerRelation(rel)}>
                                <Box
                                  alignItems="center"
                                  py="$2"
                                  borderRadius="$full"
                                  borderWidth={1.5}
                                  bg={selected ? '$primary50' : '$white'}
                                  borderColor={selected ? '$primary500' : '$borderLight200'}>
                                  <Text size="xs" weight="bold" color={selected ? '$primary600' : '$textLight400'}>
                                    {rel}
                                  </Text>
                                </Box>
                              </Pressable>
                            );
                          })}
                        </HStack>
                      ) : (
                        <Input variant="outline" borderRadius={12} mb="$4">
                          <InputField
                            placeholder="Cónyuge, hijo/a, tutor/a…"
                            value={signerRelation}
                            onChangeText={setSignerRelation}
                          />
                        </Input>
                      )}
                    </>
                  ) : null}

                  {needsReason ? (
                    <>
                      <Text size="xs" weight="semiBold" color="$textLight600" mb="$1.5">
                        Motivo por el que el paciente no firma
                      </Text>
                      <Input variant="outline" borderRadius={12} h={70} mb="$1">
                        <InputField
                          multiline
                          placeholder="P. ej., enfermedad de Alzheimer en fase moderada; incapacidad motora para firmar…"
                          value={incapacityReason}
                          onChangeText={setIncapacityReason}
                          style={{ textAlignVertical: 'top' }}
                        />
                      </Input>
                    </>
                  ) : null}
                </Card>

                {/* --------- declaraciones + firma --------- */}
                <Card bgColor="$white" borderRadius={22} p="$5">
                  <Text size="md" weight="bold" color="$textLight900" mb="$3">
                    Declaración y firma
                  </Text>

                  <VStack space="sm" mb="$4">
                    {AGREE_ITEMS.map((item, i) => {
                      const checked = agreed[i];
                      return (
                        <Pressable
                          key={i}
                          onPress={() => setAgreed(prev => prev.map((v, idx) => (idx === i ? !v : v)))}>
                          <HStack space="sm" alignItems="flex-start">
                            <Box
                              w={22}
                              h={22}
                              borderRadius={7}
                              borderWidth={1.5}
                              alignItems="center"
                              justifyContent="center"
                              bg={checked ? '$primary500' : '$white'}
                              borderColor={checked ? '$primary500' : '$borderLight300'}
                              style={{ marginTop: 1 }}>
                              {checked ? <Icon as={Check} size="2xs" color="$white" /> : null}
                            </Box>
                            <Text size="xs" color="$textLight700" style={{ flex: 1, lineHeight: 18 }}>
                              {item}
                            </Text>
                          </HStack>
                        </Pressable>
                      );
                    })}
                  </VStack>

                  <Text size="xs" weight="semiBold" color="$textLight600" mb="$1.5">
                    Firma
                  </Text>
                  <SignaturePad
                    paths={signaturePaths}
                    onAddPath={p => setSignaturePaths(prev => [...prev, p])}
                    onClear={() => setSignaturePaths([])}
                    setScrollEnabled={setScrollEnabled}
                  />
                </Card>

                <Button
                  action="primary"
                  variant="solid"
                  rounded="$full"
                  isDisabled={!ready || isSaving || isLoading}
                  isLoading={isSaving}
                  onPress={handleSign}>
                  <HStack space="sm" alignItems="center">
                    <Text size="md" weight="bold" color="$white">
                      {next === 'dysphagia' ? 'Firmar y continuar a disfagia' : 'Firmar y continuar al CAP'}
                    </Text>
                    <Icon as={ArrowRight} size="sm" color="$white" />
                  </HStack>
                </Button>
                <Text size="2xs" color="$textLight400" style={{ textAlign: 'center' }} mb="$6">
                  Sin consentimiento firmado no es posible iniciar las pruebas
                </Text>
              </>
            )}
          </VStack>
        </ScrollView>
      </VStack>
    </Content>
  );
}
