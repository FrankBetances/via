import React, { useMemo, useState } from 'react';
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
  ClipboardCheck,
  Eye,
  Info,
  MessageSquare,
  ShieldCheck,
  Smile,
  Users,
} from 'lucide-react-native';

import { Button, Content, Header, Text } from '@/Components/Common';
import RadialBackground from '@/Components/Themed/RadialBackground';
import { RootStackParamList } from '@/Navigators';
import { RootState } from '@/Store';
import { Evaluation } from '@/Models/Evaluation/Evaluation';
import { Screening } from '@/Models/Screening/Screening';
import { useClassSelector } from '@/Helpers/ClassTransformer';
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

/* -------------------------------------------------------------------------- */
/*  Subcomponentes UI                                                          */
/* -------------------------------------------------------------------------- */

type BlockStatus = 'done' | 'prog' | 'pend';

const blockStatusOf = (answers: Answers, range: [number, number]): { status: BlockStatus; answered: number } => {
  let answered = 0;
  for (let i = range[0]; i <= range[1]; i++) if (answers[i] !== null) answered++;
  return { status: answered === 5 ? 'done' : answered > 0 ? 'prog' : 'pend', answered };
};

const BlockStepper = ({
  answers,
  view,
  activeBlock,
}: {
  answers: Answers;
  view: 'setup' | 'block' | 'report';
  activeBlock: number;
}) => (
  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
    <HStack space="xs" alignItems="center" py="$1">
      {BLOCKS.map((b, idx) => {
        const { status } = blockStatusOf(answers, b.range);
        const active = view === 'block' && idx === activeBlock;
        const done = status === 'done';
        const bg = active ? '$primary500' : done ? '$success600' : status === 'prog' ? '$warning500' : '$backgroundLight100';
        const fg = active || done || status === 'prog' ? '$white' : '$textLight400';
        return (
          <HStack key={idx} alignItems="center" space="xs">
            <Center w={30} h={30} borderRadius="$full" bg={bg}>
              <Text size="2xs" weight="bold" color={fg}>
                {idx + 1}
              </Text>
            </Center>
            {idx < BLOCKS.length - 1 ? <Box w={14} h={2} borderRadius="$full" bg="$borderLight200" /> : null}
          </HStack>
        );
      })}
    </HStack>
  </ScrollView>
);

const AnswerToggle = ({
  value,
  onYes,
  onNo,
}: {
  value: boolean | null;
  onYes: () => void;
  onNo: () => void;
}) => {
  return (
    <HStack space="sm">
      <Pressable style={{ flex: 1 }} onPress={onYes}>
        <Center py="$2" borderRadius="$full" bg={value === true ? '$primary500' : '$white'} borderWidth={1.5} borderColor={value === true ? '$primary500' : '$borderLight200'}>
          <Text size="sm" weight="bold" color={value === true ? '$white' : '$textLight400'}>
            Sí
          </Text>
        </Center>
      </Pressable>
      <Pressable style={{ flex: 1 }} onPress={onNo}>
        <Center py="$2" borderRadius="$full" bg={value === false ? '$primary500' : '$white'} borderWidth={1.5} borderColor={value === false ? '$primary500' : '$borderLight200'}>
          <Text size="sm" weight="bold" color={value === false ? '$white' : '$textLight400'}>
            No
          </Text>
        </Center>
      </Pressable>
    </HStack>
  );
};

/* -------------------------------------------------------------------------- */
/*  Pantalla principal                                                         */
/* -------------------------------------------------------------------------- */

type Props = NativeStackScreenProps<RootStackParamList, 'Mchat'>;

export default function AutismScreeningScreen({ navigation }: Props) {
  // Evaluación activa (paciente + profesional) desde Redux, como en ResultScreen.
  const activeEvaluation = useClassSelector(Evaluation, (state: RootState) => state.activeEvaluation.evaluation);
  const [createScreening, { isLoading: isSaving }] = useCreateScreeningMutation();

  const [view, setView] = useState<'setup' | 'block' | 'report'>('setup');
  const [activeBlock, setActiveBlock] = useState<number>(0);
  const [answers, setAnswers] = useState<Answers>(() => emptyAnswers());
  const [setup, setSetup] = useState<boolean[]>([false, false, false, false]);
  const [evaluatorName, setEvaluatorName] = useState<string>(activeEvaluation?.professional?.name ?? '');
  const [evaluatorLicense, setEvaluatorLicense] = useState<string>(activeEvaluation?.professional?.licenseNumber ?? '');

  const setupReady = setup.every(Boolean);
  const patient = activeEvaluation?.patient;
  const patientName = patient ? `${patient.name} ${patient.lastName}`.trim() : null;

  /* ----------------------------- handlers ------------------------------- */

  const toggleSetup = (i: number) => setSetup(prev => prev.map((v, idx) => (idx === i ? !v : v)));

  const handleStart = () => {
    if (!setupReady) return;
    setView('block');
    setActiveBlock(0);
  };

  const answer = (id: number, val: boolean) =>
    setAnswers(prev => ({ ...prev, [id]: val }));

  const handleNext = () => {
    if (activeBlock >= 3) setView('report');
    else setActiveBlock(b => b + 1);
  };

  const handlePrev = () => {
    if (view === 'report') {
      setView('block');
      setActiveBlock(3);
      return;
    }
    if (activeBlock <= 0) setView('setup');
    else setActiveBlock(b => b - 1);
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
      navigation.goBack();
    } catch (e) {
      showErrorToast('Error al guardar', 'No se pudo registrar el cribado. Inténtelo de nuevo.');
    }
  };

  // bloque activo
  const block = BLOCKS[activeBlock];
  const [bStart, bEnd] = block.range;
  const blockAnswered = blockStatusOf(answers, block.range).answered;
  const showGuia = true;

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

          {/* =====================  BLOCK  ===================== */}
          {view === 'block' && (
            <VStack space="md">
              <Card bgColor="$white" borderRadius={22} p="$5">
                <BlockStepper answers={answers} view={view} activeBlock={activeBlock} />

                <HStack alignItems="center" justifyContent="space-between" mt="$4">
                  <HStack space="sm" alignItems="center" style={{ flex: 1 }}>
                    <Center w={48} h={48} borderRadius={14} bg="$primary50">
                      <Icon as={block.icon} size="lg" color="$primary600" />
                    </Center>
                    <VStack style={{ flex: 1 }}>
                      <Text size="2xs" weight="bold" color="$primary700" style={{ textTransform: 'uppercase', letterSpacing: 0.4 }}>
                        Bloque {activeBlock + 1} de 4
                      </Text>
                      <Text size="lg" weight="bold" color="$textLight900">
                        {block.name}
                      </Text>
                    </VStack>
                  </HStack>
                  <Box bg={blockAnswered === 5 ? '$success50' : '$primary50'} px="$2.5" py="$1" borderRadius="$full">
                    <Text size="2xs" weight="bold" color={blockAnswered === 5 ? '$success700' : '$primary800'}>
                      {blockAnswered}/5
                    </Text>
                  </Box>
                </HStack>

                {showGuia && (
                  <HStack space="sm" alignItems="flex-start" mt="$4" p="$3" borderRadius={14} bg="$primary0">
                    <Icon as={Info} size="sm" color="$primary600" style={{ marginTop: 1 }} />
                    <Text size="xs" color="$primary800" style={{ flex: 1, lineHeight: 18 }}>
                      <Text size="xs" weight="bold" color="$primary800">
                        Pauta de observación:{' '}
                      </Text>
                      {block.guide}
                    </Text>
                  </HStack>
                )}
              </Card>

              {/* preguntas */}
              <VStack space="sm">
                {QUESTIONS.slice(bStart - 1, bEnd).map(q => {
                  const v = answers[q.id];
                  const flag = isRiskAns(q.id, v);
                  return (
                    <Card key={q.id} bgColor={flag ? '$warning50' : '$white'} borderRadius={18} borderWidth={1} borderColor={flag ? '$warning200' : '$borderLight100'} p="$4">
                      <HStack space="sm" alignItems="flex-start" mb="$3">
                        <Box bg={flag ? '$warning100' : '$backgroundLight100'} px="$2" py="$0.5" borderRadius={8}>
                          <Text size="2xs" weight="bold" color={flag ? '$warning700' : '$textLight500'} style={{ fontVariant: ['tabular-nums'] }}>
                            {q.code}
                          </Text>
                        </Box>
                        {flag ? (
                          <Box bg="$warning100" px="$2" py="$0.5" borderRadius="$full">
                            <Text size="2xs" weight="bold" color="$warning700" style={{ textTransform: 'uppercase', letterSpacing: 0.3 }}>
                              Riesgo
                            </Text>
                          </Box>
                        ) : null}
                      </HStack>
                      <Text size="sm" weight="semiBold" color="$textLight800" style={{ lineHeight: 20 }}>
                        {q.label}
                      </Text>
                      {q.example ? (
                        <Text size="2xs" color="$textLight400" mt="$1" style={{ lineHeight: 16 }}>
                          {q.example}
                        </Text>
                      ) : null}
                      <Box mt="$3">
                        <AnswerToggle value={v} onYes={() => answer(q.id, true)} onNo={() => answer(q.id, false)} />
                      </Box>
                    </Card>
                  );
                })}
              </VStack>

              <HStack space="md" justifyContent="space-between">
                <Button action="secondary" variant="outline" rounded="$full" onPress={handlePrev}>
                  <HStack space="sm" alignItems="center">
                    <Icon as={ArrowLeft} size="sm" color="$primary500" />
                    <Text size="sm" weight="bold" color="$primary500">
                      {activeBlock <= 0 ? 'Preparación' : 'Anterior'}
                    </Text>
                  </HStack>
                </Button>
                <Button action="primary" variant="solid" rounded="$full" style={{ flex: 1 }} onPress={handleNext}>
                  <HStack space="sm" alignItems="center">
                    <Text size="sm" weight="bold" color="$white">
                      {activeBlock >= 3 ? 'Ver resultado' : 'Siguiente bloque'}
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
      </VStack>
    </Content>
  );
}
