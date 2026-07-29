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
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  Eye,
  Info,
  MessageSquare,
  ShieldCheck,
  Smile,
  Users,
} from 'lucide-react-native';

import { Button, Content, FontSizeControl, Header, ScaledTextScope, Text } from '@/Components/Common';
import { QuestionDots, QuestionTransition, SurveyProgress, YesNoAnswer } from '@/Components/Survey';
import RadialBackground from '@/Components/Themed/RadialBackground';
import { finishModule, RootStackParamList } from '@/Navigators';
import { RootState } from '@/Store';
import { Evaluation } from '@/Models/Evaluation/Evaluation';
import { Screening } from '@/Models/Screening/Screening';
import { useClassSelector } from '@/Helpers/ClassTransformer';
import { useTelemetryTracker } from '@/Telemetry';
import { useCreateScreeningMutation } from '@/Services/local/modules/screenings';
import { showErrorToast, showSuccessToast } from '@/Helpers/showToast';
import { isRiskAns } from './autismScreeningResult';

/* -------------------------------------------------------------------------- */
/*  Configuración clínica del cribado de autismo                                           */
/* -------------------------------------------------------------------------- */
/*  Cuestionario de cribado de TEA (16–30 meses). 20 ítems Sí/No.             */
/*  En la mayoría de ítems la respuesta de riesgo es «No»; en los ítems        */
/*  invertidos (2, 5, 12) la respuesta de riesgo es «Sí».                      */
/*  Puntuación total → 0-2 bajo · 3-7 medio · 8-20 alto.                       */
/* -------------------------------------------------------------------------- */

interface QuestionConfig {
  id: number;
  code: string;
  label: string;
  example: string;
}

// `INVERSE_ITEMS` e `isRiskAns` viven en ./autismScreeningResult (fuente única).

const QUESTIONS: QuestionConfig[] = [
  { id: 1, code: 'P-01', label: 'Si usted señala algo al otro lado de la habitación, ¿su hijo/a lo mira?', example: 'p. ej. mira a un juguete o a un animal' },
  { id: 2, code: 'P-02', label: '¿Alguna vez ha sospechado que su hijo/a podría ser sordo/a?', example: '' },
  { id: 3, code: 'P-03', label: '¿Su hijo/a juega a juegos de simulación o de hacer creer?', example: 'p. ej. hace como que bebe de una taza vacía o habla por teléfono' },
  { id: 4, code: 'P-04', label: '¿A su hijo/a le gusta subirse a los sitios?', example: 'p. ej. a los muebles, a los juegos del parque o a las escaleras' },
  { id: 5, code: 'P-05', label: '¿Su hijo/a hace movimientos extraños con los dedos cerca de sus ojos?', example: 'p. ej. mueve los dedos cerca de sus ojos de forma inusual' },
  { id: 6, code: 'P-06', label: '¿Su hijo/a señala con un dedo para pedir algo o pedir ayuda?', example: 'p. ej. señala un juguete o un alimento fuera de su alcance' },
  { id: 7, code: 'P-07', label: '¿Su hijo/a señala con un dedo para mostrarle algo que le llama la atención?', example: 'p. ej. señala un avión en el cielo o un camión grande' },
  { id: 8, code: 'P-08', label: '¿Su hijo/a se interesa por otros niños?', example: 'p. ej. los mira, les sonríe o se les acerca' },
  { id: 9, code: 'P-09', label: '¿Su hijo/a le muestra cosas solo para compartirlas con usted, no para pedir ayuda?', example: 'p. ej. le muestra una flor, un peluche o un coche de juguete' },
  { id: 10, code: 'P-10', label: '¿Su hijo/a responde cuando se le llama por su nombre?', example: 'p. ej. le mira, balbucea o deja lo que está haciendo' },
  { id: 11, code: 'P-11', label: 'Cuando usted le sonríe a su hijo/a, ¿él o ella le devuelve la sonrisa?', example: '' },
  { id: 12, code: 'P-12', label: '¿Su hijo/a se molesta con los ruidos cotidianos?', example: 'p. ej. grita o llora con la aspiradora o la música fuerte' },
  { id: 13, code: 'P-13', label: '¿Su hijo/a camina solo/a?', example: '' },
  { id: 14, code: 'P-14', label: '¿Su hijo/a le mira a los ojos cuando usted le habla, juega o le viste?', example: '' },
  { id: 15, code: 'P-15', label: '¿Su hijo/a intenta imitar lo que usted hace?', example: 'p. ej. dice adiós con la mano, da palmas o hace ruidos graciosos' },
  { id: 16, code: 'P-16', label: 'Si usted gira la cabeza para mirar algo, ¿su hijo/a gira la cabeza para ver qué mira?', example: '' },
  { id: 17, code: 'P-17', label: '¿Su hijo/a intenta llamar su atención para que usted le mire?', example: 'p. ej. le busca para que le alabe, o le dice «mira» o «mírame»' },
  { id: 18, code: 'P-18', label: '¿Su hijo/a le comprende cuando usted le dice que haga algo, sin señalar?', example: 'p. ej. «pon el libro en la silla» o «tráeme la manta»' },
  { id: 19, code: 'P-19', label: 'Si pasa algo nuevo, ¿su hijo/a le mira a la cara para ver cómo se siente usted?', example: 'p. ej. ante un ruido extraño o un juguete nuevo' },
  { id: 20, code: 'P-20', label: '¿A su hijo/a le gustan las actividades de movimiento?', example: 'p. ej. que le mezan o le hagan saltar sobre sus rodillas' },
];

interface BlockConfig {
  name: string;
  short: string;
  range: [number, number];
  guide: string;
  icon: any;
}

const BLOCKS: BlockConfig[] = [
  { name: 'Social y atención conjunta', short: 'Social y atención', range: [1, 5], icon: Users, guide: 'observe la atención conjunta y el contacto visual espontáneo, sin forzar la respuesta.' },
  { name: 'Comunicación y gestos', short: 'Comunicación y gestos', range: [6, 10], icon: MessageSquare, guide: 'valore los gestos protodeclarativos y la respuesta al nombre en situaciones cotidianas, sin repetir ni insistir.' },
  { name: 'Respuesta e imitación', short: 'Respuesta e imitación', range: [11, 15], icon: Smile, guide: 'comprobaciones de reciprocidad social e imitación; ante una conducta dudosa, registre la más frecuente.' },
  { name: 'Comprensión y físico', short: 'Comprensión y físico', range: [16, 20], icon: Eye, guide: 'comprensión verbal sin apoyo gestual y referenciación social. El ítem P-13 es un hito motor, no social.' },
];

const SETUP_ITEMS = [
  'Edad del niño/a entre 16 y 30 meses.',
  'Cuestionario respondido por el cuidador principal.',
  'Responder según la conducta habitual, no la mejor respuesta puntual.',
  'Entorno tranquilo y sin prisas para la observación.',
];

type RiskLevel = 'inc' | 'low' | 'med' | 'high';

type Answers = Record<number, boolean | null>;

const emptyAnswers = (): Answers => {
  const a: Answers = {};
  for (let i = 1; i <= 20; i++) a[i] = null;
  return a;
};

/** Primera pregunta sin responder (índice 0-based), o -1 si están todas. */
const firstUnanswered = (answers: Answers): number => {
  for (let i = 1; i <= 20; i++) if (answers[i] === null || answers[i] === undefined) return i - 1;
  return -1;
};

/** Retardo del auto-avance tras responder (deja ver la selección animada). */
const AUTO_ADVANCE_MS = 450;

/* -------------------------------------------------------------------------- */
/*  Pantalla principal                                                         */
/* -------------------------------------------------------------------------- */

type Props = NativeStackScreenProps<RootStackParamList, 'Mchat'>;

export default function AutismScreeningScreen({ navigation }: Props) {
  // Evaluación activa (paciente + profesional) desde Redux, como en ResultScreen.
  const activeEvaluation = useClassSelector(Evaluation, (state: RootState) => state.activeEvaluation.evaluation);
  const [createScreening, { isLoading: isSaving }] = useCreateScreeningMutation();
  const tracker = useTelemetryTracker(); // telemetría silenciosa (useRef, sin re-render)

  const [view, setView] = useState<'setup' | 'quiz' | 'report'>('setup');
  const [qIndex, setQIndex] = useState<number>(0); // pregunta visible (0..19)
  const [dir, setDir] = useState<1 | -1>(1); // sentido de la transición
  const [showGuide, setShowGuide] = useState(false); // pauta de observación plegable
  const [answers, setAnswers] = useState<Answers>(() => emptyAnswers());
  const [setup, setSetup] = useState<boolean[]>([false, false, false, false]);
  const [evaluatorName, setEvaluatorName] = useState<string>(activeEvaluation?.professional?.name ?? '');
  const [evaluatorLicense, setEvaluatorLicense] = useState<string>(activeEvaluation?.professional?.licenseNumber ?? '');

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

  const setupReady = setup.every(Boolean);
  const patient = activeEvaluation?.patient;
  const patientName = patient ? `${patient.name} ${patient.lastName}`.trim() : null;

  /* ----------------------------- handlers ------------------------------- */

  const toggleSetup = (i: number) => setSetup(prev => prev.map((v, idx) => (idx === i ? !v : v)));

  const goTo = (i: number, d?: 1 | -1) => {
    if (autoTimer.current) clearTimeout(autoTimer.current);
    const clamped = Math.max(0, Math.min(19, i));
    setDir(d ?? (clamped >= qIndexRef.current ? 1 : -1));
    setQIndex(clamped);
  };

  const handleStart = () => {
    if (!setupReady) return;
    setView('quiz');
    setQIndex(0);
    setDir(1);
  };

  const answer = (id: number, val: boolean) => {
    // Telemetría: cada respuesta a un ítem M-CHAT; rerresponder = rectificación.
    tracker.classifyReactivo(`aut-${id}`);
    const next = { ...answers, [id]: val };
    setAnswers(next);
    // Auto-avance con la respuesta ya visible (la selección rebota primero).
    if (autoTimer.current) clearTimeout(autoTimer.current);
    const fromIndex = id - 1;
    autoTimer.current = setTimeout(() => {
      if (qIndexRef.current !== fromIndex) return; // el usuario ya navegó
      if (fromIndex < 19) {
        goTo(fromIndex + 1, 1);
      } else {
        const pending = firstUnanswered(next);
        if (pending === -1) setView('report');
        else goTo(pending);
      }
    }, AUTO_ADVANCE_MS);
  };

  // Telemetría: abre la ventana de tiempo del ítem visible durante el quiz.
  useEffect(() => {
    if (view === 'quiz') tracker.enterReactivo(`aut-${qIndex + 1}`);
  }, [view, qIndex, tracker]);

  const handleNext = () => {
    if (qIndex >= 19) {
      const pending = firstUnanswered(answers);
      if (pending === -1) setView('report');
      else goTo(pending);
      return;
    }
    goTo(qIndex + 1, 1);
  };

  const handlePrev = () => {
    if (view === 'report') {
      setView('quiz');
      goTo(19, -1);
      return;
    }
    if (qIndex <= 0) setView('setup');
    else goTo(qIndex - 1, -1);
  };

  /* ---------------------------- análisis -------------------------------- */

  const analysis = useMemo(() => {
    let answered = 0;
    let score = 0;
    const blockCounts = [0, 0, 0, 0];
    const flagRows: { code: string; label: string; answer: string }[] = [];

    for (let i = 1; i <= 20; i++) {
      const v = answers[i];
      if (v === null || v === undefined) continue;
      answered++;
      if (isRiskAns(i, v)) {
        score++;
        const q = QUESTIONS[i - 1];
        flagRows.push({ code: q.code, label: q.label, answer: v ? 'Sí' : 'No' });
        blockCounts[Math.floor((i - 1) / 5)]++;
      }
    }

    const all = answered === 20;
    const level: RiskLevel = !all ? 'inc' : score >= 8 ? 'high' : score >= 3 ? 'med' : 'low';

    return { answered, score, blockCounts, flagRows, all, level };
  }, [answers]);

  const { answered, score, blockCounts, flagRows, all, level } = analysis;

  /* report copy --------------------------------------------------------- */

  const report = useMemo(() => {
    if (level === 'high') {
      return {
        title: 'Riesgo alto de TEA',
        range: 'Rango 8–20',
        desc: 'Puntuación elevada con múltiples indicadores de riesgo. Requiere actuación prioritaria.',
        recommendation:
          'Omitir la entrevista de seguimiento y derivar de forma directa e inmediata para una evaluación diagnóstica formal y asignación a un programa de estimulación temprana.',
        bannerBg: '$error50',
        bannerBorder: '$error300',
        bannerFg: '$error700',
        icon: AlertCircle,
        iconColor: '$error500',
        iconBg: '$error50',
      };
    }
    if (level === 'med') {
      return {
        title: 'Riesgo medio de TEA',
        range: 'Rango 3–7',
        desc: 'Riesgo moderado. Conviene ampliar información clínica antes de decidir la derivación.',
        recommendation:
          'Aplicar la Entrevista de Seguimiento. Si la puntuación en la entrevista persiste ≥ 2, derivar para evaluación diagnóstica formal.',
        bannerBg: '$warning50',
        bannerBorder: '$warning300',
        bannerFg: '$warning800',
        icon: AlertTriangle,
        iconColor: '$warning700',
        iconBg: '$warning50',
      };
    }
    return {
      title: 'Riesgo bajo de TEA',
      range: 'Rango 0–2',
      desc: 'Sin indicadores de riesgo significativos en el cribado actual.',
      recommendation:
        'Probabilidad baja de TEA. Si el niño/a es menor de 24 meses, repetir el cribado al cumplir los 2 años ante cualquier nueva duda del desarrollo.',
      bannerBg: '$success50',
      bannerBorder: '$success300',
      bannerFg: '$success700',
      icon: CheckCircle2,
      iconColor: '$success600',
      iconBg: '$success50',
    };
  }, [level]);

  const rangeText = !all ? 'Incompleto' : score >= 8 ? 'Alto (8–20)' : score >= 3 ? 'Medio (3–7)' : 'Bajo (0–2)';

  /* --------------------------- persistencia ----------------------------- */
  /* Guarda el resultado en la tabla `screening` (entidad Screening) ligado a  */
  /* la evaluación activa, vía useCreateScreeningMutation.                      */

  const handleSave = async () => {
    if (!all || isSaving) return;
    if (!evaluatorName.trim() || !evaluatorLicense.trim()) return;

    if (!activeEvaluation) {
      // Sin evaluación activa no hay dónde anclar el resultado.
      showErrorToast('No se puede guardar', 'No hay una evaluación activa asociada al paciente.');
      return;
    }

    try {
      const screening = new Screening();
      screening.instrument = 'autism-tea';
      screening.score = score;
      screening.total = 20;
      screening.riskLevel = level === 'inc' ? 'low' : level;
      screening.rangeLabel = rangeText;
      screening.recommendation = report.recommendation;
      screening.answers = answers;
      screening.blockCounts = blockCounts;
      screening.flaggedItems = flagRows.map(f => ({ code: f.code, label: f.label, answer: f.answer as 'Sí' | 'No' }));
      screening.evaluatorName = evaluatorName.trim();
      screening.evaluatorLicense = evaluatorLicense.trim();
      screening.completedAt = new Date();
      // Vinculación por referencia (solo el FK; no re-guarda la evaluación).
      screening.evaluation = { id: activeEvaluation.id } as Evaluation;

      await createScreening(screening);

      showSuccessToast('Cribado guardado', `Cribado de autismo · ${score}/20 · ${rangeText}.`);
      // Aterriza en los resultados, no de vuelta al hub (ver finishModule).
      finishModule(navigation);
    } catch (e) {
      showErrorToast('Error al guardar', 'No se pudo registrar el cribado. Inténtelo de nuevo.');
    }
  };

  // pregunta y bloque activos del cuestionario (una pregunta por pantalla)
  const q = QUESTIONS[qIndex];
  const blockIdx = Math.floor(qIndex / 5);
  const block = BLOCKS[blockIdx];
  const isBlockStart = qIndex % 5 === 0;
  const dotStates = QUESTIONS.map(question => ({
    answered: answers[question.id] !== null && answers[question.id] !== undefined,
    flagged: isRiskAns(question.id, answers[question.id]),
  }));

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

        {/* El informe (y la pregunta con la guía desplegada en pantallas
            pequeñas) supera la altura visible: el scroll sigue siendo necesario. */}
        <ScrollView showsVerticalScrollIndicator={false}>
        <VStack flex={1} px="$6" mt="$2" space="md">
          {/* ----- title ----- */}
          <VStack>
            <HStack alignItems="center" space="sm">
              <Text size="2xl" weight="bold" color="$textLight900">
                Cribado de autismo
              </Text>
              <Box bg="$primary50" px="$2" py="$0.5" borderRadius="$full">
                <Text size="2xs" weight="bold" color="$primary800" style={{ letterSpacing: 0.4 }}>
                  AUTISMO
                </Text>
              </Box>
            </HStack>
            <Text size="xs" color="$textLight500">
              {patientName
                ? `${patientName}${patient?.nhc ? ` · NHC ${patient.nhc}` : ''}`
                : 'Modified Checklist for Autism in Toddlers · cribado 16–30 meses'}
            </Text>
          </VStack>

          {/* =====================  SETUP  ===================== */}
          {view === 'setup' && (
            <VStack space="md">
              <Card bgColor="$white" borderRadius={22} p="$5">
                <Text size="lg" weight="bold" color="$textLight900">
                  Preparación del cribado
                </Text>
                <Text size="sm" color="$textLight600" mt="$1">
                  20 preguntas de respuesta Sí / No sobre la conducta habitual del niño/a, agrupadas en 4 bloques. El
                  sistema calcula la puntuación de riesgo y la recomendación de derivación de forma automática.
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
                        <Center
                          mt="$0.5"
                          w={20}
                          h={20}
                          borderRadius={6}
                          borderWidth={1.5}
                          borderColor={setup[i] ? '$primary500' : '$borderLight300'}
                          bg={setup[i] ? '$primary500' : '$white'}>
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
                  El cribado de autismo es un instrumento de cribado validado: identifica riesgo, no proporciona un diagnóstico
                  formal de TEA.
                </Text>
              </HStack>

              <Button action="primary" variant="solid" rounded="$full" isDisabled={!setupReady} onPress={handleStart}>
                <HStack space="sm" alignItems="center">
                  <Text size="md" weight="bold" color="$white">
                    Comenzar cuestionario
                  </Text>
                  <Icon as={ArrowRight} size="sm" color="$white" />
                </HStack>
              </Button>
            </VStack>
          )}

          {/* =====================  QUIZ (una pregunta por pantalla)  ===================== */}
          {view === 'quiz' && (
            <VStack space="md">
              {/* progreso + mapa del cuestionario */}
              <Card bgColor="$white" borderRadius={22} p="$4">
                <SurveyProgress answered={answered} total={20} label={`Pregunta ${qIndex + 1} de 20`} />
                <Box mt="$3">
                  <QuestionDots states={dotStates} current={qIndex} onJump={goTo} />
                </Box>
              </Card>

              {/* tamaño de letra: es una prueba leída al informador — se debe
                  facilitar la lectura (aplica a todos los cuestionarios) */}
              <FontSizeControl />

              {/* tarjeta de la pregunta activa, con transición animada */}
              <QuestionTransition key={qIndex} direction={dir}>
                <Card bgColor="$white" borderRadius={22} p="$5">
                  {/* contexto del bloque (resaltado al entrar en un bloque nuevo) */}
                  <HStack space="sm" alignItems="center" mb="$3">
                    <Center w={34} h={34} borderRadius={10} bg={isBlockStart ? '$primary500' : '$primary50'}>
                      <Icon as={block.icon} size="sm" color={isBlockStart ? '$white' : '$primary600'} />
                    </Center>
                    <VStack style={{ flex: 1 }}>
                      <Text size="2xs" weight="bold" color="$primary700" style={{ textTransform: 'uppercase', letterSpacing: 0.4 }}>
                        Bloque {blockIdx + 1} de 4 · {block.short}
                      </Text>
                      {isBlockStart ? (
                        <Text size="2xs" color="$textLight500">
                          Empieza un bloque nuevo
                        </Text>
                      ) : null}
                    </VStack>
                    <Box bg="$backgroundLight100" px="$2" py="$0.5" borderRadius={8}>
                      <Text size="2xs" weight="bold" color="$textLight500" style={{ fontVariant: ['tabular-nums'] }}>
                        {q.code}
                      </Text>
                    </Box>
                  </HStack>

                  <ScaledTextScope.Provider value={true}>
                    <Text size="xl" weight="bold" color="$textLight900" style={{ lineHeight: 30 }}>
                      {q.label}
                    </Text>
                    {q.example ? (
                      <Text size="sm" color="$textLight500" mt="$2" style={{ lineHeight: 20 }}>
                        {q.example}
                      </Text>
                    ) : null}
                  </ScaledTextScope.Provider>

                  <Box mt="$5">
                    <YesNoAnswer value={answers[q.id]} onAnswer={val => answer(q.id, val)} />
                  </Box>

                  {isRiskAns(q.id, answers[q.id]) ? (
                    <HStack space="sm" alignItems="center" mt="$3" p="$2.5" borderRadius={12} bg="$warning50">
                      <Icon as={AlertTriangle} size="xs" color="$warning700" />
                      <Text size="xs" weight="semiBold" color="$warning800" style={{ flex: 1 }}>
                        Respuesta de riesgo: suma 1 punto en el cribado.
                      </Text>
                    </HStack>
                  ) : null}

                  {/* pauta de observación del bloque, plegable */}
                  <Pressable onPress={() => setShowGuide(g => !g)} style={{ marginTop: 14 }}>
                    <HStack space="xs" alignItems="center">
                      <Icon as={Info} size="xs" color="$primary600" />
                      <Text size="xs" weight="bold" color="$primary700" style={{ flex: 1 }}>
                        Pauta de observación del bloque
                      </Text>
                      <Icon as={showGuide ? ChevronUp : ChevronDown} size="xs" color="$primary600" />
                    </HStack>
                  </Pressable>
                  {showGuide ? (
                    <Box mt="$2" p="$3" borderRadius={12} bg="$primary0">
                      <Text size="xs" color="$primary800" style={{ lineHeight: 18 }}>
                        {block.guide}
                      </Text>
                    </Box>
                  ) : null}
                </Card>
              </QuestionTransition>

              {/* cuestionario completo → acceso directo al resultado */}
              {all ? (
                <Pressable onPress={() => setView('report')}>
                  <HStack space="sm" alignItems="center" p="$3.5" borderRadius={16} bg="$success50" borderWidth={1} borderColor="$success200">
                    <Icon as={CheckCircle2} size="sm" color="$success600" />
                    <Text size="sm" weight="bold" color="$success800" style={{ flex: 1 }}>
                      Las 20 preguntas están respondidas
                    </Text>
                    <Text size="sm" weight="bold" color="$success700">
                      Ver resultado →
                    </Text>
                  </HStack>
                </Pressable>
              ) : null}

              <HStack space="md" justifyContent="space-between">
                <Button action="secondary" variant="outline" rounded="$full" onPress={handlePrev}>
                  <HStack space="sm" alignItems="center">
                    <Icon as={ArrowLeft} size="sm" color="$primary500" />
                    <Text size="sm" weight="bold" color="$primary500">
                      {qIndex <= 0 ? 'Preparación' : 'Anterior'}
                    </Text>
                  </HStack>
                </Button>
                <Button action="primary" variant="solid" rounded="$full" style={{ flex: 1 }} onPress={handleNext}>
                  <HStack space="sm" alignItems="center">
                    <Text size="sm" weight="bold" color="$white">
                      {qIndex >= 19 ? (all ? 'Ver resultado' : 'Ir a pendientes') : 'Siguiente'}
                    </Text>
                    <Icon as={ArrowRight} size="sm" color="$white" />
                  </HStack>
                </Button>
              </HStack>
            </VStack>
          )}

          {/* =====================  REPORT  ===================== */}
          {view === 'report' && (
            <VStack space="md">
              <Card bgColor={report.bannerBg} borderColor={report.bannerBorder} borderWidth={1} borderRadius={20} p="$5">
                <HStack space="sm" alignItems="center" justifyContent="space-between">
                  <HStack space="sm" alignItems="center" style={{ flex: 1 }}>
                    <Center w={44} h={44} borderRadius={14} bg="$white">
                      <Icon as={report.icon} size="lg" color={report.iconColor} />
                    </Center>
                    <VStack style={{ flex: 1 }}>
                      <Text size="lg" weight="bold" color={report.bannerFg}>
                        {report.title}
                      </Text>
                      <Text size="2xs" color={report.bannerFg} style={{ opacity: 0.9 }}>
                        {report.desc}
                      </Text>
                    </VStack>
                  </HStack>
                  <VStack alignItems="center">
                    <Text size="2xl" weight="bold" color={report.bannerFg}>
                      {score}
                      <Text size="sm" weight="semiBold" color={report.bannerFg} style={{ opacity: 0.8 }}>
                        {' '}
                        / 20
                      </Text>
                    </Text>
                    <Text size="2xs" weight="bold" color={report.bannerFg} style={{ textTransform: 'uppercase', opacity: 0.8 }}>
                      {report.range}
                    </Text>
                  </VStack>
                </HStack>
              </Card>

              {/* recomendación */}
              <Card bgColor="$white" borderRadius={20} p="$5">
                <Text size="sm" weight="bold" color="$textLight700" mb="$2" style={{ textTransform: 'uppercase', letterSpacing: 0.4 }}>
                  Recomendación clínica
                </Text>
                <Text size="sm" color="$textLight700" style={{ lineHeight: 21 }}>
                  {report.recommendation}
                </Text>
              </Card>

              {/* distribución por bloque */}
              <Card bgColor="$white" borderRadius={20} p="$5">
                <Text size="sm" weight="bold" color="$textLight700" mb="$3" style={{ textTransform: 'uppercase', letterSpacing: 0.4 }}>
                  Respuestas de riesgo por bloque
                </Text>
                <VStack space="sm">
                  {BLOCKS.map((b, idx) => {
                    const n = blockCounts[idx];
                    return (
                      <HStack key={idx} alignItems="center" justifyContent="space-between" py="$1.5" borderBottomWidth={1} borderColor="$borderLight50">
                        <HStack space="sm" alignItems="center" style={{ flex: 1 }}>
                          <Center w={28} h={28} borderRadius={9} bg="$primary50">
                            <Icon as={b.icon} size="xs" color="$primary600" />
                          </Center>
                          <Text size="sm" color="$textLight700" style={{ flex: 1 }}>
                            {b.short}
                          </Text>
                        </HStack>
                        <Box bg={n > 0 ? '$warning100' : '$backgroundLight100'} px="$2.5" py="$0.5" borderRadius="$full">
                          <Text size="2xs" weight="bold" color={n > 0 ? '$warning700' : '$textLight400'}>
                            {n}
                          </Text>
                        </Box>
                      </HStack>
                    );
                  })}
                </VStack>
              </Card>

              {/* ítems de riesgo */}
              <Card bgColor="$white" borderRadius={20} p="$5">
                <Text size="sm" weight="bold" color="$textLight700" mb="$3" style={{ textTransform: 'uppercase', letterSpacing: 0.4 }}>
                  Ítems de riesgo marcados
                </Text>
                {flagRows.length > 0 ? (
                  <VStack space="xs">
                    {flagRows.map(f => (
                      <HStack key={f.code} space="sm" alignItems="flex-start" py="$2" borderBottomWidth={1} borderColor="$borderLight50">
                        <Box bg="$warning50" px="$2" py="$0.5" borderRadius={6} mt="$0.5">
                          <Text size="2xs" weight="bold" color="$warning700">
                            {f.code}
                          </Text>
                        </Box>
                        <Text size="xs" color="$textLight700" style={{ flex: 1, lineHeight: 17 }}>
                          {f.label}
                        </Text>
                        <Text size="2xs" weight="bold" color="$error500">
                          {f.answer}
                        </Text>
                      </HStack>
                    ))}
                  </VStack>
                ) : (
                  <Center py="$4">
                    <Text size="sm" color="$success700" style={{ fontStyle: 'italic', textAlign: 'center' }}>
                      Ninguna respuesta de riesgo. Desarrollo dentro de lo esperado para la edad.
                    </Text>
                  </Center>
                )}
              </Card>

              {/* evaluador */}
              <Card bgColor="$white" borderRadius={20} p="$5">
                <Text size="sm" weight="bold" color="$textLight700" mb="$2">
                  Evaluador responsable
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
                  isDisabled={!all || isSaving || !evaluatorName.trim() || !evaluatorLicense.trim()}
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

              {!all ? (
                <HStack space="sm" alignItems="flex-start" p="$3" borderRadius={14} bg="$warning50">
                  <Icon as={AlertTriangle} size="sm" color="$warning700" style={{ marginTop: 1 }} />
                  <Text size="xs" color="$warning800" style={{ flex: 1, lineHeight: 18 }}>
                    Quedan {20 - answered} preguntas por responder. Complete el cuestionario para poder guardar el
                    resultado.
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
