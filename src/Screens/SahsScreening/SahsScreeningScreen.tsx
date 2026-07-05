import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable } from 'react-native';
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
  VStack,
} from '@gluestack-ui/themed';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Info,
  Moon,
  Scale,
  ShieldCheck,
  Stethoscope,
  Volume2,
  Zap,
} from 'lucide-react-native';

import { Button, Content, FontSizeControl, Header, ScaledTextScope, Text } from '@/Components/Common';
import { QuestionDots, QuestionTransition, SurveyProgress, YesNoAnswer } from '@/Components/Survey';
import RadialBackground from '@/Components/Themed/RadialBackground';
import { RootStackParamList } from '@/Navigators';
import { RootState } from '@/Store';
import { Evaluation } from '@/Models/Evaluation/Evaluation';
import { SahsScreening } from '@/Models/SahsScreening/SahsScreening';
import { useClassSelector } from '@/Helpers/ClassTransformer';
import { useCreateSahsScreeningMutation } from '@/Services/local/modules/sahsScreenings';
import { showErrorToast, showSuccessToast } from '@/Helpers/showToast';
import {
  BRODSKY_OPTIONS,
  EXAM_SIGNS,
  IMC_OPTIONS,
  ImcCategory,
  PSQ_BLOCKS,
  PSQ_QUESTIONS,
  PSQ_TOTAL,
  PsqAnswers,
  RISK_FACTORS,
  computeSahsScore,
  imcLabel,
  isPsqRisk,
  recommendationFor,
  suspicionLabel,
} from './sahsScreeningResult';

/* -------------------------------------------------------------------------- */
/*  Cribado de SAHS infantil (trastornos respiratorios del sueño)             */
/* -------------------------------------------------------------------------- */
/*  Flujo móvil vertical: preparación → PSQ de Chervin (4 bloques) →           */
/*  exploración física (Brodsky + IMC + signos) → factores de riesgo →         */
/*  informe (nivel de sospecha + recomendación de derivación).                 */
/*  La lógica clínica vive en ./sahsScreeningResult (fuente única).            */
/* -------------------------------------------------------------------------- */

type View = 'setup' | 'psq' | 'exam' | 'risk' | 'report';

const PHASES = ['Prep', 'PSQ', 'Explor.', 'Factores', 'Informe'];
const PHASE_OF: Record<View, number> = { setup: 0, psq: 1, exam: 2, risk: 3, report: 4 };

const SETUP_ITEMS = [
  'Niño/a roncador/a habitual (ronquido > 3 noches/semana, todo el año).',
  'Cuestionario PSQ respondido por el cuidador principal.',
  'Responder según la conducta habitual durante el sueño, no la mejor noche.',
  'Exploración ORL básica disponible (amígdalas) y antropometría (IMC).',
];

const emptyPsq = (): PsqAnswers => {
  const a: PsqAnswers = {};
  for (let i = 1; i <= PSQ_TOTAL; i++) a[i] = null;
  return a;
};

/** Icono de cada bloque del PSQ (ronquido, apneas, somnolencia, conducta). */
const PSQ_BLOCK_ICONS = [Volume2, Activity, Moon, Zap];

/** Primera pregunta del PSQ sin responder (índice 0-based), o -1 si completas. */
const firstUnanswered = (psq: PsqAnswers): number => {
  for (let i = 1; i <= PSQ_TOTAL; i++) if (psq[i] === null || psq[i] === undefined) return i - 1;
  return -1;
};

/** Retardo del auto-avance tras responder (deja ver la selección animada). */
const AUTO_ADVANCE_MS = 450;

/* -------------------------------------------------------------------------- */
/*  Subcomponentes UI                                                          */
/* -------------------------------------------------------------------------- */

const PhaseStepper = ({ view }: { view: View }) => {
  const current = PHASE_OF[view];
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <HStack space="xs" alignItems="center" py="$1">
        {PHASES.map((label, idx) => {
          const done = idx < current;
          const active = idx === current;
          const bg = active ? '$primary500' : done ? '$success600' : '$backgroundLight100';
          const fg = active || done ? '$white' : '$textLight400';
          return (
            <HStack key={idx} alignItems="center" space="xs">
              <HStack alignItems="center" space="xs" bg={bg} px="$2.5" py="$1" borderRadius="$full">
                <Center w={16} h={16} borderRadius="$full" bg="rgba(255,255,255,0.25)">
                  <Text size="2xs" weight="bold" color={fg}>
                    {idx + 1}
                  </Text>
                </Center>
                <Text size="2xs" weight="bold" color={fg}>
                  {label}
                </Text>
              </HStack>
              {idx < PHASES.length - 1 ? <Box w={10} h={2} borderRadius="$full" bg="$borderLight200" /> : null}
            </HStack>
          );
        })}
      </HStack>
    </ScrollView>
  );
};

/* -------------------------------------------------------------------------- */
/*  Pantalla principal                                                         */
/* -------------------------------------------------------------------------- */

type Props = NativeStackScreenProps<RootStackParamList, 'SahsScreening'>;

export default function SahsScreeningScreen({ navigation }: Props) {
  const activeEvaluation = useClassSelector(Evaluation, (state: RootState) => state.activeEvaluation.evaluation);
  const [createSahsScreening, { isLoading: isSaving }] = useCreateSahsScreeningMutation();

  const [view, setView] = useState<View>('setup');
  const [qIndex, setQIndex] = useState<number>(0); // pregunta PSQ visible (0..21)
  const [dir, setDir] = useState<1 | -1>(1); // sentido de la transición
  const [psq, setPsq] = useState<PsqAnswers>(() => emptyPsq());
  const [brodsky, setBrodsky] = useState<number | null>(null);
  const [imc, setImc] = useState<ImcCategory | null>(null);
  const [signs, setSigns] = useState<Record<string, boolean>>({});
  const [risk, setRisk] = useState<Record<string, boolean>>({});
  const [setup, setSetup] = useState<boolean[]>([false, false, false, false]);
  const [psqObs, setPsqObs] = useState<string>('');
  const [examObs, setExamObs] = useState<string>('');
  const [riskObs, setRiskObs] = useState<string>('');
  const [evaluatorName, setEvaluatorName] = useState<string>(activeEvaluation?.professional?.name ?? '');
  const [evaluatorLicense, setEvaluatorLicense] = useState<string>(activeEvaluation?.professional?.licenseNumber ?? '');

  const setupReady = setup.every(Boolean);
  const patient = activeEvaluation?.patient;
  const patientName = patient ? `${patient.name} ${patient.lastName}`.trim() : null;

  // Auto-avance tras responder: solo si el usuario sigue en la misma pregunta.
  const autoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const qIndexRef = useRef(0);
  qIndexRef.current = qIndex;
  useEffect(
    () => () => {
      if (autoTimer.current) clearTimeout(autoTimer.current);
    },
    [],
  );

  /* ----------------------------- handlers ------------------------------- */

  const toggleSetup = (i: number) => setSetup(prev => prev.map((v, idx) => (idx === i ? !v : v)));
  const toggleSign = (label: string) => setSigns(prev => ({ ...prev, [label]: !prev[label] }));
  const toggleRisk = (label: string) => setRisk(prev => ({ ...prev, [label]: !prev[label] }));

  const goTo = (i: number, d?: 1 | -1) => {
    if (autoTimer.current) clearTimeout(autoTimer.current);
    const clamped = Math.max(0, Math.min(PSQ_TOTAL - 1, i));
    setDir(d ?? (clamped >= qIndexRef.current ? 1 : -1));
    setQIndex(clamped);
  };

  const answer = (id: number, val: boolean) => {
    const next = { ...psq, [id]: val };
    setPsq(next);
    // Auto-avance con la respuesta ya visible (la selección rebota primero).
    if (autoTimer.current) clearTimeout(autoTimer.current);
    const fromIndex = id - 1;
    autoTimer.current = setTimeout(() => {
      if (qIndexRef.current !== fromIndex) return; // el usuario ya navegó
      if (fromIndex < PSQ_TOTAL - 1) {
        goTo(fromIndex + 1, 1);
      } else {
        const pending = firstUnanswered(next);
        if (pending === -1) setView('exam');
        else goTo(pending);
      }
    }, AUTO_ADVANCE_MS);
  };

  const handleNext = () => {
    if (view === 'psq') {
      if (qIndex >= PSQ_TOTAL - 1) {
        const pending = firstUnanswered(psq);
        if (pending === -1) setView('exam');
        else goTo(pending);
        return;
      }
      goTo(qIndex + 1, 1);
      return;
    }
    if (view === 'exam') return setView('risk');
    if (view === 'risk') return setView('report');
  };

  const handlePrev = () => {
    if (view === 'report') return setView('risk');
    if (view === 'risk') return setView('exam');
    if (view === 'exam') {
      setView('psq');
      goTo(PSQ_TOTAL - 1, -1);
      return;
    }
    if (view === 'psq') {
      if (qIndex <= 0) setView('setup');
      else goTo(qIndex - 1, -1);
    }
  };

  const handleStart = () => {
    if (!setupReady) return;
    setView('psq');
    setQIndex(0);
    setDir(1);
  };

  /* ----------------------------- análisis ------------------------------- */

  const signList = useMemo(() => EXAM_SIGNS.filter(s => signs[s]), [signs]);
  const riskList = useMemo(() => RISK_FACTORS.filter(r => risk[r.label]).map(r => r.label), [risk]);

  const score = useMemo(
    () => computeSahsScore({ psq, brodsky, imc, riskFactors: riskList }),
    [psq, brodsky, imc, riskList],
  );

  const rec = useMemo(() => recommendationFor(score.level), [score.level]);

  const psqComplete = score.answeredCount === PSQ_TOTAL;
  const examComplete = brodsky != null && imc != null;
  const canSave = psqComplete && examComplete;

  /* report visual config ------------------------------------------------- */

  const reportTheme = useMemo(() => {
    if (score.level === 'high') {
      return { bannerBg: '$error50', bannerBorder: '$error300', bannerFg: '$error700', icon: AlertCircle, iconColor: '$error500', desc: 'Alta probabilidad de SAHS. Cumple criterios de derivación a Unidad de Sueño.' };
    }
    if (score.level === 'med') {
      return { bannerBg: '$warning50', bannerBorder: '$warning300', bannerFg: '$warning800', icon: AlertTriangle, iconColor: '$warning700', desc: 'Hallazgos intermedios. Requiere seguimiento estrecho y reevaluación.' };
    }
    return { bannerBg: '$success50', bannerBorder: '$success300', bannerFg: '$success700', icon: CheckCircle2, iconColor: '$success600', desc: 'Hallazgos compatibles con ronquido primario. Sin criterios de derivación preferente.' };
  }, [score.level]);

  /* --------------------------- persistencia ----------------------------- */

  const handleSave = async () => {
    if (!canSave || isSaving) return;
    if (!evaluatorName.trim() || !evaluatorLicense.trim()) return;

    if (!activeEvaluation) {
      showErrorToast('No se puede guardar', 'No hay una evaluación activa asociada al paciente.');
      return;
    }

    try {
      const s = new SahsScreening();
      s.instrument = 'PSQ-Chervin / SAHS';
      s.psqAnswers = psq;
      s.psqYesCount = score.yesCount;
      s.psqTotal = PSQ_TOTAL;
      s.psqPositive = score.psqPositive;
      s.redFlag = score.redFlag;
      s.brodsky = brodsky;
      s.imc = imc;
      s.signs = signList;
      s.riskFactors = riskList;
      s.breakdown = score.breakdown;
      s.totalScore = score.total;
      s.scoreMax = score.totalMax;
      s.suspicionLevel = score.level;
      s.suspicionLabel = suspicionLabel(score.level);
      s.recommendation = rec.action;
      s.referral = rec.referral;
      s.notes = { psqObs: psqObs.trim(), examObs: examObs.trim(), riskObs: riskObs.trim() };
      s.evaluatorName = evaluatorName.trim();
      s.evaluatorLicense = evaluatorLicense.trim();
      s.completedAt = new Date();
      s.evaluation = { id: activeEvaluation.id } as Evaluation;

      await createSahsScreening(s);

      showSuccessToast('Cribado guardado', `SAHS · ${score.total}/${score.totalMax} · ${suspicionLabel(score.level)}.`);
      navigation.goBack();
    } catch (e) {
      showErrorToast('Error al guardar', 'No se pudo registrar el cribado. Inténtelo de nuevo.');
    }
  };

  /* pregunta y bloque PSQ activos (una pregunta por pantalla) */
  const q = PSQ_QUESTIONS[qIndex];
  const block = PSQ_BLOCKS[q.block];
  const blockIcon = PSQ_BLOCK_ICONS[q.block];
  const isBlockStart = q.id === block.range[0];
  const dotStates = PSQ_QUESTIONS.map(question => ({
    answered: psq[question.id] !== null && psq[question.id] !== undefined,
    flagged: isPsqRisk(psq[question.id]),
  }));

  /* desglose para el informe */
  const breakdownRows = [
    { label: 'PSQ de Chervin', detail: `${score.yesCount}/22 (${Math.round(score.prop * 100)}%)`, pts: score.breakdown.psq },
    { label: 'Apneas presenciadas', detail: score.redFlag ? 'Señal de alarma presente' : 'No referidas', pts: score.breakdown.apnea },
    { label: 'Brodsky', detail: brodsky == null ? 'Sin registrar' : `Grado ${brodsky}`, pts: score.breakdown.brodsky },
    { label: 'Estado ponderal', detail: imcLabel(imc), pts: score.breakdown.imc },
    { label: 'Factores de riesgo', detail: `${riskList.length} marcados`, pts: score.breakdown.risk },
  ];

  /* ------------------------------- render ------------------------------- */

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

        {/* La exploración, los factores de riesgo y el informe superan la
            altura de pantalla: el scroll vertical sigue siendo necesario. */}
        <ScrollView showsVerticalScrollIndicator={false}>
        <VStack flex={1} px="$6" mt="$2" space="md">
          {/* ----- title ----- */}
          <VStack>
            <HStack alignItems="center" space="sm">
              <Text size="2xl" weight="bold" color="$textLight900">
                Cribado de SAHS infantil
              </Text>
              <Box bg="$primary50" px="$2" py="$0.5" borderRadius="$full">
                <Text size="2xs" weight="bold" color="$primary800" style={{ letterSpacing: 0.4 }}>
                  PSQ-CHERVIN
                </Text>
              </Box>
            </HStack>
            <Text size="xs" color="$textLight500">
              {patientName
                ? `${patientName}${patient?.nhc ? ` · NHC ${patient.nhc}` : ''}`
                : 'Trastornos respiratorios del sueño · Atención Primaria'}
            </Text>
          </VStack>

          {view !== 'setup' && <PhaseStepper view={view} />}

          {/* =====================  SETUP  ===================== */}
          {view === 'setup' && (
            <VStack space="md">
              <Card bgColor="$white" borderRadius={22} p="$5">
                <Text size="lg" weight="bold" color="$textLight900">
                  Preparación del cribado
                </Text>
                <Text size="sm" color="$textLight600" mt="$1">
                  Cuestionario PSQ de Chervin (22 ítems Sí/No) más exploración física y factores de riesgo. El sistema
                  calcula el nivel de sospecha y la recomendación de derivación de forma automática.
                </Text>

                <HStack alignItems="center" space="sm" mt="$5" mb="$3">
                  <Icon as={ShieldCheck} size="sm" color="$primary500" />
                  <Text size="sm" weight="bold" color="$textLight800" style={{ textTransform: 'uppercase', letterSpacing: 0.4 }}>
                    Condiciones de aplicación
                  </Text>
                </HStack>

                <VStack space="sm">
                  {SETUP_ITEMS.map((label, i) => (
                    <Pressable key={i} onPress={() => toggleSetup(i)}>
                      <HStack space="sm" alignItems="flex-start">
                        <Center mt="$0.5" w={20} h={20} borderRadius={6} borderWidth={1.5} borderColor={setup[i] ? '$primary500' : '$borderLight300'} bg={setup[i] ? '$primary500' : '$white'}>
                          {setup[i] ? <Icon as={Check} size="2xs" color="$white" /> : null}
                        </Center>
                        <Text size="sm" color="$textLight700" style={{ flex: 1 }}>
                          {label}
                        </Text>
                      </HStack>
                    </Pressable>
                  ))}
                </VStack>
              </Card>

              <HStack space="sm" alignItems="flex-start" p="$3.5" borderRadius={16} bg="$primary0" borderWidth={1} borderColor="$primary100">
                <Icon as={Info} size="sm" color="$primary600" style={{ marginTop: 1 }} />
                <Text size="xs" color="$primary800" style={{ flex: 1, lineHeight: 18 }}>
                  Cribado orientativo de trastornos respiratorios del sueño: identifica el riesgo, no diagnostica SAHS. El
                  diagnóstico requiere polisomnografía en Unidad de Sueño.
                </Text>
              </HStack>

              <Button action="primary" variant="solid" rounded="$full" isDisabled={!setupReady} onPress={handleStart}>
                <HStack space="sm" alignItems="center">
                  <Text size="md" weight="bold" color="$white">
                    Comenzar cribado
                  </Text>
                  <Icon as={ArrowRight} size="sm" color="$white" />
                </HStack>
              </Button>
            </VStack>
          )}

          {/* =====================  PSQ (una pregunta por pantalla)  ===================== */}
          {view === 'psq' && (
            <VStack space="md">
              {/* progreso + mapa del cuestionario */}
              <Card bgColor="$white" borderRadius={22} p="$4">
                <SurveyProgress answered={score.answeredCount} total={PSQ_TOTAL} label={`Pregunta ${qIndex + 1} de ${PSQ_TOTAL}`} />
                <Box mt="$3">
                  <QuestionDots states={dotStates} current={qIndex} onJump={goTo} />
                </Box>
                <HStack space="sm" alignItems="center" mt="$2">
                  <Box bg={score.yesCount > 0 ? '$warning50' : '$backgroundLight50'} px="$2.5" py="$0.5" borderRadius="$full">
                    <Text size="2xs" weight="bold" color={score.yesCount > 0 ? '$warning700' : '$textLight400'} style={{ fontVariant: ['tabular-nums'] }}>
                      {score.yesCount} síntomas «Sí»
                    </Text>
                  </Box>
                  {score.redFlag ? (
                    <Box bg="$error50" px="$2.5" py="$0.5" borderRadius="$full">
                      <Text size="2xs" weight="bold" color="$error600" style={{ textTransform: 'uppercase', letterSpacing: 0.3 }}>
                        Señal de alarma
                      </Text>
                    </Box>
                  ) : null}
                </HStack>
              </Card>

              {/* tamaño de letra ajustable: facilita la lectura del PSQ */}
              <FontSizeControl />

              {/* tarjeta de la pregunta activa, con transición animada */}
              <QuestionTransition key={qIndex} direction={dir}>
                <Card bgColor="$white" borderRadius={22} p="$5">
                  {/* contexto del bloque (resaltado al entrar en un bloque nuevo) */}
                  <HStack space="sm" alignItems="center" mb="$3">
                    <Center w={34} h={34} borderRadius={10} bg={isBlockStart ? '$primary500' : '$primary50'}>
                      <Icon as={blockIcon} size="sm" color={isBlockStart ? '$white' : '$primary600'} />
                    </Center>
                    <VStack style={{ flex: 1 }}>
                      <Text size="2xs" weight="bold" color="$primary700" style={{ textTransform: 'uppercase', letterSpacing: 0.4 }}>
                        Bloque {q.block + 1} de {PSQ_BLOCKS.length} · {block.short}
                      </Text>
                      {isBlockStart ? (
                        <Text size="2xs" color="$textLight500">
                          Empieza un bloque nuevo: {block.name.toLowerCase()}
                        </Text>
                      ) : null}
                    </VStack>
                    <Box bg="$backgroundLight100" px="$2" py="$0.5" borderRadius={8}>
                      <Text size="2xs" weight="bold" color="$textLight500" style={{ fontVariant: ['tabular-nums'] }}>
                        {q.code}
                      </Text>
                    </Box>
                  </HStack>

                  {q.flag ? (
                    <Box alignSelf="flex-start" bg="$error50" px="$2" py="$0.5" borderRadius="$full" mb="$2">
                      <Text size="2xs" weight="bold" color="$error600" style={{ textTransform: 'uppercase', letterSpacing: 0.3 }}>
                        Señal de alarma
                      </Text>
                    </Box>
                  ) : null}

                  <ScaledTextScope.Provider value={true}>
                    <Text size="xl" weight="bold" color="$textLight900" style={{ lineHeight: 30 }}>
                      {q.label}
                    </Text>
                  </ScaledTextScope.Provider>

                  <Box mt="$5">
                    {/* En el PSQ, «Sí» = síntoma presente (riesgo) · «No» = ausente. */}
                    <YesNoAnswer value={psq[q.id]} onAnswer={val => answer(q.id, val)} yesTone="warning" noTone="success" />
                  </Box>

                  {isPsqRisk(psq[q.id]) && q.flag ? (
                    <HStack space="sm" alignItems="center" mt="$3" p="$2.5" borderRadius={12} bg="$error50">
                      <Icon as={AlertTriangle} size="xs" color="$error600" />
                      <Text size="xs" weight="semiBold" color="$error700" style={{ flex: 1 }}>
                        Señal de alarma presente: prioriza la derivación en el resultado.
                      </Text>
                    </HStack>
                  ) : null}
                </Card>
              </QuestionTransition>

              {/* PSQ completo → observaciones + acceso directo a la exploración */}
              {psqComplete ? (
                <>
                  <Card bgColor="$white" borderRadius={18} p="$4">
                    <Text size="2xs" weight="bold" color="$textLight500" mb="$2" style={{ textTransform: 'uppercase', letterSpacing: 0.4 }}>
                      Observaciones del PSQ
                    </Text>
                    <Input variant="outline" borderRadius={12}>
                      <InputField placeholder="Anotaciones del profesional…" value={psqObs} onChangeText={setPsqObs} multiline />
                    </Input>
                  </Card>
                  <Pressable onPress={() => setView('exam')}>
                    <HStack space="sm" alignItems="center" p="$3.5" borderRadius={16} bg="$success50" borderWidth={1} borderColor="$success200">
                      <Icon as={CheckCircle2} size="sm" color="$success600" />
                      <Text size="sm" weight="bold" color="$success800" style={{ flex: 1 }}>
                        Las {PSQ_TOTAL} preguntas están respondidas
                      </Text>
                      <Text size="sm" weight="bold" color="$success700">
                        Exploración →
                      </Text>
                    </HStack>
                  </Pressable>
                </>
              ) : null}

              <NavRow
                prevLabel={qIndex <= 0 ? 'Preparación' : 'Anterior'}
                nextLabel={qIndex >= PSQ_TOTAL - 1 ? (psqComplete ? 'Exploración física' : 'Ir a pendientes') : 'Siguiente'}
                onPrev={handlePrev}
                onNext={handleNext}
              />
            </VStack>
          )}

          {/* =====================  EXAM  ===================== */}
          {view === 'exam' && (
            <VStack space="md">
              {/* Brodsky */}
              <Card bgColor="$white" borderRadius={20} p="$5">
                <HStack alignItems="center" space="sm" mb="$3">
                  <Icon as={Stethoscope} size="sm" color="$primary600" />
                  <Text size="sm" weight="bold" color="$textLight800" style={{ flex: 1 }}>
                    Tamaño amigdalar · escala de Brodsky
                  </Text>
                  <Box bg={brodsky == null ? '$backgroundLight100' : brodsky >= 4 ? '$error50' : brodsky === 3 ? '$warning50' : '$success50'} px="$2.5" py="$0.5" borderRadius="$full">
                    <Text size="2xs" weight="bold" color={brodsky == null ? '$textLight400' : brodsky >= 4 ? '$error600' : brodsky === 3 ? '$warning700' : '$success700'}>
                      {brodsky == null ? 'Sin registrar' : `Grado ${brodsky}`}
                    </Text>
                  </Box>
                </HStack>
                <HStack space="xs">
                  {BRODSKY_OPTIONS.map(b => {
                    const active = brodsky === b.grade;
                    const sevBg = b.grade >= 4 ? '$error500' : b.grade === 3 ? '$warning700' : '$primary500';
                    return (
                      <Pressable key={b.grade} style={{ flex: 1 }} onPress={() => setBrodsky(b.grade)}>
                        <Center py="$3" borderRadius={14} borderWidth={1.5} bg={active ? sevBg : '$white'} borderColor={active ? sevBg : '$borderLight200'}>
                          <Text size="lg" weight="bold" color={active ? '$white' : '$textLight400'}>
                            {b.grade}
                          </Text>
                          <Text size="2xs" color={active ? '$white' : '$textLight400'} mt="$0.5" style={{ textAlign: 'center' }}>
                            {b.sub}
                          </Text>
                        </Center>
                      </Pressable>
                    );
                  })}
                </HStack>
              </Card>

              {/* IMC */}
              <Card bgColor="$white" borderRadius={20} p="$5">
                <HStack alignItems="center" space="sm" mb="$3">
                  <Icon as={Scale} size="sm" color="$primary600" />
                  <Text size="sm" weight="bold" color="$textLight800">
                    Estado ponderal · IMC por percentil
                  </Text>
                </HStack>
                <HStack space="xs">
                  {IMC_OPTIONS.map(m => {
                    const active = imc === m.key;
                    const sevBg = m.key === 'obesidad' ? '$error500' : m.key === 'sobrepeso' ? '$warning700' : '$success600';
                    return (
                      <Pressable key={m.key} style={{ flex: 1 }} onPress={() => setImc(m.key)}>
                        <Center py="$3" borderRadius={14} borderWidth={1.5} bg={active ? sevBg : '$white'} borderColor={active ? sevBg : '$borderLight200'}>
                          <Text size="sm" weight="bold" color={active ? '$white' : '$textLight400'}>
                            {m.label}
                          </Text>
                          <Text size="2xs" color={active ? '$white' : '$textLight400'} mt="$0.5">
                            {m.sub}
                          </Text>
                        </Center>
                      </Pressable>
                    );
                  })}
                </HStack>
              </Card>

              {/* Signos */}
              <Card bgColor="$white" borderRadius={20} p="$5">
                <Text size="sm" weight="bold" color="$textLight800">
                  Signos exploratorios
                </Text>
                <Text size="2xs" color="$textLight500" mt="$0.5" mb="$3">
                  Marque los hallazgos presentes.
                </Text>
                <HStack space="sm" flexWrap="wrap" style={{ rowGap: 8 }}>
                  {EXAM_SIGNS.map(label => {
                    const active = !!signs[label];
                    return (
                      <Pressable key={label} onPress={() => toggleSign(label)}>
                        <Box px="$3" py="$2" borderRadius="$full" borderWidth={1.5} bg={active ? '$primary50' : '$white'} borderColor={active ? '$primary300' : '$borderLight200'}>
                          <Text size="xs" weight="semiBold" color={active ? '$primary800' : '$textLight500'}>
                            {label}
                          </Text>
                        </Box>
                      </Pressable>
                    );
                  })}
                </HStack>
                <Box mt="$4">
                  <Text size="2xs" weight="bold" color="$textLight500" mb="$2" style={{ textTransform: 'uppercase', letterSpacing: 0.4 }}>
                    Observaciones de la exploración
                  </Text>
                  <Input variant="outline" borderRadius={12}>
                    <InputField placeholder="Anotaciones del profesional…" value={examObs} onChangeText={setExamObs} multiline />
                  </Input>
                </Box>
              </Card>

              {!examComplete ? (
                <HStack space="sm" alignItems="flex-start" p="$3" borderRadius={14} bg="$warning50">
                  <Icon as={AlertTriangle} size="sm" color="$warning700" style={{ marginTop: 1 }} />
                  <Text size="xs" color="$warning800" style={{ flex: 1, lineHeight: 18 }}>
                    Registre el grado de Brodsky y el estado ponderal para completar la exploración.
                  </Text>
                </HStack>
              ) : null}

              <NavRow prevLabel="PSQ" nextLabel="Factores de riesgo" onPrev={handlePrev} onNext={handleNext} />
            </VStack>
          )}

          {/* =====================  RISK  ===================== */}
          {view === 'risk' && (
            <VStack space="md">
              <Card bgColor="$white" borderRadius={20} p="$5">
                <Text size="sm" weight="bold" color="$textLight800">
                  Factores de riesgo y comorbilidades
                </Text>
                <Text size="2xs" color="$textLight500" mt="$0.5">
                  Circunstancias que aumentan la probabilidad de SAHS o el riesgo perioperatorio.
                </Text>
              </Card>

              <VStack space="sm">
                {RISK_FACTORS.map(r => {
                  const active = !!risk[r.label];
                  return (
                    <Pressable key={r.label} onPress={() => toggleRisk(r.label)}>
                      <Card bgColor={active ? '$primary0' : '$white'} borderRadius={16} borderWidth={1.5} borderColor={active ? '$primary300' : '$borderLight100'} p="$4">
                        <HStack space="sm" alignItems="center">
                          <Center w={24} h={24} borderRadius={7} borderWidth={1.5} bg={active ? '$primary500' : '$white'} borderColor={active ? '$primary500' : '$borderLight300'}>
                            {active ? <Icon as={Check} size="2xs" color="$white" /> : null}
                          </Center>
                          <VStack style={{ flex: 1 }}>
                            <Text size="sm" weight="semiBold" color="$textLight800">
                              {r.label}
                            </Text>
                            <Text size="2xs" color="$textLight500">
                              {r.note}
                            </Text>
                          </VStack>
                        </HStack>
                      </Card>
                    </Pressable>
                  );
                })}
              </VStack>

              <Card bgColor="$white" borderRadius={18} p="$4">
                <Text size="2xs" weight="bold" color="$textLight500" mb="$2" style={{ textTransform: 'uppercase', letterSpacing: 0.4 }}>
                  Observaciones de factores de riesgo
                </Text>
                <Input variant="outline" borderRadius={12}>
                  <InputField placeholder="Anotaciones del profesional…" value={riskObs} onChangeText={setRiskObs} multiline />
                </Input>
              </Card>

              <NavRow prevLabel="Exploración" nextLabel="Ver resultado" onPrev={handlePrev} onNext={handleNext} />
            </VStack>
          )}

          {/* =====================  REPORT  ===================== */}
          {view === 'report' && (
            <VStack space="md">
              <Card bgColor={reportTheme.bannerBg} borderColor={reportTheme.bannerBorder} borderWidth={1} borderRadius={20} p="$5">
                <HStack space="sm" alignItems="center" justifyContent="space-between">
                  <HStack space="sm" alignItems="center" style={{ flex: 1 }}>
                    <Center w={44} h={44} borderRadius={14} bg="$white">
                      <Icon as={reportTheme.icon} size="lg" color={reportTheme.iconColor} />
                    </Center>
                    <VStack style={{ flex: 1 }}>
                      <Text size="lg" weight="bold" color={reportTheme.bannerFg}>
                        {suspicionLabel(score.level)}
                      </Text>
                      <Text size="2xs" color={reportTheme.bannerFg} style={{ opacity: 0.9 }}>
                        {reportTheme.desc}
                      </Text>
                    </VStack>
                  </HStack>
                  <VStack alignItems="center">
                    <Text size="2xl" weight="bold" color={reportTheme.bannerFg}>
                      {score.total}
                      <Text size="sm" weight="semiBold" color={reportTheme.bannerFg} style={{ opacity: 0.8 }}>
                        {' '}
                        / {score.totalMax}
                      </Text>
                    </Text>
                    <Text size="2xs" weight="bold" color={reportTheme.bannerFg} style={{ textTransform: 'uppercase', opacity: 0.8 }}>
                      Puntuación
                    </Text>
                  </VStack>
                </HStack>
              </Card>

              {/* recomendación */}
              <Card bgColor="$white" borderRadius={20} p="$5">
                <Text size="sm" weight="bold" color="$textLight700" mb="$2" style={{ textTransform: 'uppercase', letterSpacing: 0.4 }}>
                  Recomendación · derivación
                </Text>
                <HStack space="sm" alignItems="center" mb="$2">
                  <Text size="lg" weight="bold" color="$textLight900" style={{ flex: 1 }}>
                    {rec.action}
                  </Text>
                  <Box bg="$primary50" px="$2.5" py="$1" borderRadius="$full">
                    <Text size="2xs" weight="bold" color="$primary800">
                      {rec.referral}
                    </Text>
                  </Box>
                </HStack>
                <Text size="sm" color="$textLight700" style={{ lineHeight: 21 }}>
                  {rec.desc}
                </Text>
              </Card>

              {/* desglose */}
              <Card bgColor="$white" borderRadius={20} p="$5">
                <Text size="sm" weight="bold" color="$textLight700" mb="$3" style={{ textTransform: 'uppercase', letterSpacing: 0.4 }}>
                  Desglose de puntuación
                </Text>
                <VStack space="sm">
                  {breakdownRows.map(row => (
                    <HStack key={row.label} alignItems="center" justifyContent="space-between" py="$1.5" borderBottomWidth={1} borderColor="$borderLight50">
                      <VStack style={{ flex: 1 }}>
                        <Text size="sm" color="$textLight700">
                          {row.label}
                        </Text>
                        <Text size="2xs" color="$textLight400">
                          {row.detail}
                        </Text>
                      </VStack>
                      <Box bg={row.pts > 0 ? '$warning100' : '$backgroundLight100'} px="$2.5" py="$0.5" borderRadius="$full">
                        <Text size="2xs" weight="bold" color={row.pts > 0 ? '$warning700' : '$textLight400'} style={{ fontVariant: ['tabular-nums'] }}>
                          {row.pts > 0 ? `+${row.pts}` : '0'} pt
                        </Text>
                      </Box>
                    </HStack>
                  ))}
                  <HStack alignItems="center" justifyContent="space-between" pt="$2">
                    <Text size="sm" weight="bold" color="$textLight900">
                      Puntuación total
                    </Text>
                    <Text size="md" weight="bold" color="$textLight900" style={{ fontVariant: ['tabular-nums'] }}>
                      {score.total} / {score.totalMax}
                    </Text>
                  </HStack>
                </VStack>
              </Card>

              {/* evaluador */}
              <Card bgColor="$white" borderRadius={20} p="$5">
                <Text size="sm" weight="bold" color="$textLight700" mb="$2">
                  Profesional responsable
                </Text>
                <HStack space="sm">
                  <Input variant="outline" borderRadius={12} style={{ flex: 2 }}>
                    <InputField placeholder="Nombre" value={evaluatorName} onChangeText={setEvaluatorName} />
                  </Input>
                  <Input variant="outline" borderRadius={12} style={{ flex: 1 }}>
                    <InputField placeholder="Colegiado" value={evaluatorLicense} onChangeText={setEvaluatorLicense} />
                  </Input>
                </HStack>
              </Card>

              <HStack space="md" justifyContent="space-between">
                <Button action="secondary" variant="outline" rounded="$full" onPress={handlePrev}>
                  <HStack space="sm" alignItems="center">
                    <Icon as={ArrowLeft} size="sm" color="$primary500" />
                    <Text size="sm" weight="bold" color="$primary500">
                      Modificar
                    </Text>
                  </HStack>
                </Button>
                <Button
                  action="primary"
                  variant="solid"
                  rounded="$full"
                  style={{ flex: 1 }}
                  isDisabled={!canSave || isSaving || !evaluatorName.trim() || !evaluatorLicense.trim()}
                  isLoading={isSaving}
                  onPress={handleSave}>
                  <HStack space="sm" alignItems="center">
                    <Icon as={ClipboardCheck} size="sm" color="$white" />
                    <Text size="sm" weight="bold" color="$white">
                      Confirmar y guardar
                    </Text>
                  </HStack>
                </Button>
              </HStack>

              {!canSave ? (
                <HStack space="sm" alignItems="flex-start" p="$3" borderRadius={14} bg="$warning50">
                  <Icon as={AlertTriangle} size="sm" color="$warning700" style={{ marginTop: 1 }} />
                  <Text size="xs" color="$warning800" style={{ flex: 1, lineHeight: 18 }}>
                    {!psqComplete
                      ? `Quedan ${PSQ_TOTAL - score.answeredCount} preguntas del PSQ por responder. `
                      : ''}
                    {!examComplete ? 'Complete el grado de Brodsky y el estado ponderal. ' : ''}
                    Es necesario para poder guardar el resultado.
                  </Text>
                </HStack>
              ) : null}
            </VStack>
          )}

          <Box h="$10" />
        </VStack>
        </ScrollView>
      </VStack>
    </Content>
  );
}

/* -------------------------------------------------------------------------- */
/*  Barra de navegación inferior reutilizable (Anterior / Siguiente)           */
/* -------------------------------------------------------------------------- */

const NavRow = ({
  prevLabel,
  nextLabel,
  onPrev,
  onNext,
}: {
  prevLabel: string;
  nextLabel: string;
  onPrev: () => void;
  onNext: () => void;
}) => (
  <HStack space="md" justifyContent="space-between">
    <Button action="secondary" variant="outline" rounded="$full" onPress={onPrev}>
      <HStack space="sm" alignItems="center">
        <Icon as={ArrowLeft} size="sm" color="$primary500" />
        <Text size="sm" weight="bold" color="$primary500">
          {prevLabel}
        </Text>
      </HStack>
    </Button>
    <Button action="primary" variant="solid" rounded="$full" style={{ flex: 1 }} onPress={onNext}>
      <HStack space="sm" alignItems="center">
        <Text size="sm" weight="bold" color="$white">
          {nextLabel}
        </Text>
        <Icon as={ArrowRight} size="sm" color="$white" />
      </HStack>
    </Button>
  </HStack>
);
