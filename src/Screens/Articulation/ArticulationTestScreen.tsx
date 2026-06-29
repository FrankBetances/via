import React, { useMemo, useState } from 'react';
import { Pressable } from 'react-native';
import { StackScreenProps } from '@react-navigation/stack';
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
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Image as ImageIcon,
  Info,
  Mic,
  Play,
  ShieldCheck,
  Square,
  Volume2,
} from 'lucide-react-native';

import { Button, Content, Header, Text } from '@/Components/Common';
import RadialBackground from '@/Components/Themed/RadialBackground';
import { RootStackParamList } from '@/Navigators';
import { RootState } from '@/Store';
import { Evaluation } from '@/Models/Evaluation/Evaluation';
import { ArticulationTest } from '@/Models/ArticulationTest/ArticulationTest';
import { useClassSelector } from '@/Helpers/ClassTransformer';
import { useCreateArticulationMutation } from '@/Services/local/modules/articulationTests';
import { showErrorToast, showSuccessToast } from '@/Helpers/showToast';
import { useArticulationAudio } from './articulationAudio';
import {
  ArticulationItem,
  ArticulationSection,
  POSITION_LABELS,
  SECTION_LABELS,
  SodaCode,
  SodaResults,
  SODA_META,
  Substitutions,
  buildArticulationItems,
  computeArticulationScore,
  firstIndexOfPhoneme,
  firstIndexOfSection,
} from './articulationResult';

/* -------------------------------------------------------------------------- */
/*  Test de Articulación a la Repetición (T.A.R.)                              */
/* -------------------------------------------------------------------------- */
/*  Flujo móvil vertical: preparación → registro ítem a ítem (modelo hablado + */
/*  grabación opcional + clasificación SODA por fonema) → informe (% acierto,  */
/*  recuento SODA, fonemas a intervenir).                                       */
/*  La lógica clínica vive en ./articulationResult (fuente única, idéntica al   */
/*  mockup `Articulación TAR.dc.html`). El audio en ./articulationAudio.         */
/* -------------------------------------------------------------------------- */

type View = 'setup' | 'test' | 'report';

const SECTION_ORDER: ArticulationSection[] = [
  'consonantes',
  'difvoc',
  'difcons',
  'polisilabas',
  'frases',
];

const SECTION_TABS: { key: ArticulationSection; short: string }[] = [
  { key: 'consonantes', short: 'Conson.' },
  { key: 'difvoc', short: 'Díf. voc.' },
  { key: 'difcons', short: 'Díf. cons.' },
  { key: 'polisilabas', short: 'Polisíl.' },
  { key: 'frases', short: 'Frases' },
];

const SETUP_ITEMS = [
  'Ambiente tranquilo y sin ruido; el niño/a atento/a a la pantalla.',
  'Explicar la consigna: «Mira la imagen y repite la palabra que escuches».',
  'Presentar el modelo hablado y registrar lo que el niño/a produce, no lo esperado.',
  'Clasificar cada producción como Correcto / Sustitución / Omisión / Distorsión / Adición (SODA).',
];

/* Color base por categoría SODA (alineado con el mockup). */
const SODA_COLOR: Record<SodaCode, string> = {
  C: '$success600',
  S: '$warning700',
  O: '$info600',
  D: '$secondary600',
  A: '$error500',
};
const SODA_BG: Record<SodaCode, string> = {
  C: '$success50',
  S: '$warning50',
  O: '$info50',
  D: '$secondary50',
  A: '$error50',
};

/* -------------------------------------------------------------------------- */
/*  Pantalla principal                                                         */
/* -------------------------------------------------------------------------- */

type Props = StackScreenProps<RootStackParamList, 'Articulation'>;

export default function ArticulationTestScreen({ navigation }: Props) {
  const activeEvaluation = useClassSelector(Evaluation, (state: RootState) => state.activeEvaluation.evaluation);
  const [createArticulation, { isLoading: isSaving }] = useCreateArticulationMutation();
  const audio = useArticulationAudio();

  const items = useMemo<ArticulationItem[]>(() => buildArticulationItems(), []);

  const [view, setView] = useState<View>('setup');
  const [idx, setIdx] = useState<number>(0);
  const [results, setResults] = useState<SodaResults>({});
  const [subs, setSubs] = useState<Substitutions>({});
  const [setup, setSetup] = useState<boolean[]>([false, false, false, false]);
  const [obs, setObs] = useState<string>('');
  const [evaluatorName, setEvaluatorName] = useState<string>(activeEvaluation?.professional?.name ?? '');
  const [evaluatorLicense, setEvaluatorLicense] = useState<string>(activeEvaluation?.professional?.licenseNumber ?? '');

  const setupReady = setup.every(Boolean);
  const patient = activeEvaluation?.patient;
  const patientName = patient ? `${patient.name} ${patient.lastName}`.trim() : null;

  const cur = items[idx];
  const curCode = results[cur.id] ?? null;

  const score = useMemo(() => computeArticulationScore(items, results), [items, results]);

  /* ----------------------------- handlers ------------------------------- */

  const toggleSetup = (i: number) => setSetup(prev => prev.map((v, k) => (k === i ? !v : v)));

  const goTo = (i: number) => {
    audio.reset();
    setIdx(Math.max(0, Math.min(items.length - 1, i)));
  };
  const next = () => goTo(idx + 1);
  const prev = () => goTo(idx - 1);
  const jumpSection = (section: ArticulationSection) => {
    const i = firstIndexOfSection(items, section);
    if (i >= 0) goTo(i);
  };
  const jumpPhoneme = (phoneme: string) => {
    const i = firstIndexOfPhoneme(items, phoneme);
    if (i >= 0) goTo(i);
  };

  const recordCode = (code: SodaCode) => {
    setResults(prev => ({ ...prev, [cur.id]: code }));
    audio.reset();
    // avance automático al clasificar como correcto (igual que el mockup)
    if (code === 'C') {
      setTimeout(() => {
        setIdx(p => Math.min(items.length - 1, p + 1));
      }, 320);
    }
  };

  const onSub = (text: string) => setSubs(prev => ({ ...prev, [cur.id]: text }));

  const handleStart = () => {
    if (!setupReady) return;
    setView('test');
    setIdx(0);
  };

  const canSave = score.evaluatedCount > 0;

  const handleSave = async () => {
    if (!canSave || isSaving) return;
    if (!evaluatorName.trim() || !evaluatorLicense.trim()) return;

    if (!activeEvaluation) {
      showErrorToast('No se puede guardar', 'No hay una evaluación activa asociada al paciente.');
      return;
    }

    try {
      const t = new ArticulationTest();
      t.instrument = 'T.A.R. (Articulación a la Repetición)';
      t.results = results;
      t.substitutions = subs;
      t.evaluatedCount = score.evaluatedCount;
      t.totalCount = score.totalCount;
      t.correctPct = score.correctPct;
      t.sodaCounts = score.sodaCounts;
      t.affectedPhonemes = score.affectedPhonemes;
      t.phonemeStatus = score.phonemeStatus;
      t.notes = { obs: obs.trim() };
      t.evaluatorName = evaluatorName.trim();
      t.evaluatorLicense = evaluatorLicense.trim();
      t.completedAt = new Date();
      t.evaluation = { id: activeEvaluation.id } as Evaluation;

      await createArticulation(t);

      showSuccessToast('Registro guardado', `T.A.R. · ${score.evaluatedCount} ítems · ${score.correctPct}% acierto.`);
      navigation.goBack();
    } catch (e) {
      showErrorToast('Error al guardar', 'No se pudo registrar el test. Inténtelo de nuevo.');
    }
  };

  /* report visual config ------------------------------------------------- */

  const reportTheme = useMemo(() => {
    if (score.correctPct >= 85) {
      return { bg: '$success50', border: '$success300', fg: '$success700', icon: CheckCircle2, color: '$success600' };
    }
    if (score.correctPct >= 60) {
      return { bg: '$warning50', border: '$warning300', fg: '$warning800', icon: AlertTriangle, color: '$warning700' };
    }
    return { bg: '$error50', border: '$error300', fg: '$error700', icon: AlertTriangle, color: '$error500' };
  }, [score.correctPct]);

  const sodaSummary = SODA_META.map(m => ({ ...m, count: score.sodaCounts[m.code] }));

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
                Articulación · T.A.R.
              </Text>
              <Box bg="$primary50" px="$2" py="$0.5" borderRadius="$full">
                <Text size="2xs" weight="bold" color="$primary800" style={{ letterSpacing: 0.4 }}>
                  REPETICIÓN
                </Text>
              </Box>
            </HStack>
            <Text size="xs" color="$textLight500">
              {patientName
                ? `${patientName}${patient?.nhc ? ` · NHC ${patient.nhc}` : ''}`
                : 'Test de articulación a la repetición · registro SODA por fonema'}
            </Text>
          </VStack>

          {/* =====================  SETUP  ===================== */}
          {view === 'setup' && (
            <VStack space="md">
              <Card bgColor="$white" borderRadius={22} p="$5">
                <Text size="lg" weight="bold" color="$textLight900">
                  Preparación del registro
                </Text>
                <Text size="sm" color="$textLight600" mt="$1">
                  Inventario fonético por punto de articulación más dífonos, palabras polisilábicas y frases. Para cada
                  ítem se presenta un modelo hablado y se clasifica la producción del niño/a según el sistema SODA.
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

              {!audio.available && !audio.recognitionAvailable ? (
                <HStack space="sm" alignItems="flex-start" p="$3.5" borderRadius={16} bg="$warning50" borderWidth={1} borderColor="$warning200">
                  <Icon as={Info} size="sm" color="$warning700" style={{ marginTop: 1 }} />
                  <Text size="xs" color="$warning800" style={{ flex: 1, lineHeight: 18 }}>
                    Modo limitado: sin motor de grabación ni reconocimiento de voz disponible. Puede registrar la
                    clasificación SODA igualmente; el modelo se pronuncia manualmente.
                  </Text>
                </HStack>
              ) : null}

              <HStack space="sm" alignItems="flex-start" p="$3.5" borderRadius={16} bg="$primary0" borderWidth={1} borderColor="$primary100">
                <Icon as={Info} size="sm" color="$primary600" style={{ marginTop: 1 }} />
                <Text size="xs" color="$primary800" style={{ flex: 1, lineHeight: 18 }}>
                  Registro descriptivo de la producción a la repetición. No sustituye el juicio clínico del fonoaudiólogo.
                </Text>
              </HStack>

              <Button action="primary" variant="solid" rounded="$full" isDisabled={!setupReady} onPress={handleStart}>
                <HStack space="sm" alignItems="center">
                  <Text size="md" weight="bold" color="$white">
                    Comenzar registro
                  </Text>
                  <Icon as={ArrowRight} size="sm" color="$white" />
                </HStack>
              </Button>
            </VStack>
          )}

          {/* =====================  TEST  ===================== */}
          {view === 'test' && (
            <VStack space="md">
              {/* progreso + secciones */}
              <Card bgColor="$white" borderRadius={20} p="$4">
                <HStack alignItems="center" justifyContent="space-between" mb="$3">
                  <Text size="2xs" weight="bold" color="$primary700" style={{ textTransform: 'uppercase', letterSpacing: 0.4 }}>
                    {SECTION_LABELS[cur.section]}
                  </Text>
                  <Text size="2xs" weight="bold" color="$textLight500" style={{ fontVariant: ['tabular-nums'] }}>
                    {idx + 1} / {items.length}
                  </Text>
                </HStack>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <HStack space="xs">
                    {SECTION_TABS.map(tab => {
                      const active = cur.section === tab.key;
                      return (
                        <Pressable key={tab.key} onPress={() => jumpSection(tab.key)}>
                          <Box px="$3" py="$1.5" borderRadius="$full" borderWidth={1.5} bg={active ? '$primary500' : '$white'} borderColor={active ? '$primary500' : '$borderLight200'}>
                            <Text size="xs" weight="bold" color={active ? '$white' : '$textLight400'}>
                              {tab.short}
                            </Text>
                          </Box>
                        </Pressable>
                      );
                    })}
                  </HStack>
                </ScrollView>
              </Card>

              {/* ítem actual */}
              <Card bgColor="$white" borderRadius={22} p="$5">
                <HStack space="sm" alignItems="center" mb="$3" flexWrap="wrap" style={{ rowGap: 6 }}>
                  <Box bg="$backgroundLight100" px="$2.5" py="$0.5" borderRadius="$full">
                    <Text size="2xs" weight="bold" color="$textLight600">
                      {cur.phoneme}
                    </Text>
                  </Box>
                  {cur.section === 'consonantes' && cur.position !== '-' ? (
                    <Box bg="$primary50" px="$2.5" py="$0.5" borderRadius="$full">
                      <Text size="2xs" weight="bold" color="$primary800">
                        Sílaba {POSITION_LABELS[cur.position]}
                      </Text>
                    </Box>
                  ) : null}
                  {curCode ? (
                    <Box bg={SODA_BG[curCode]} px="$2.5" py="$0.5" borderRadius="$full">
                      <Text size="2xs" weight="bold" color={SODA_COLOR[curCode]}>
                        {SODA_META.find(m => m.code === curCode)?.label}
                      </Text>
                    </Box>
                  ) : null}
                </HStack>

                {/* placeholder de ilustración */}
                <Center borderRadius={18} borderWidth={1.5} borderColor="$borderLight200" bg="$backgroundLight50" py="$6" mb="$4" style={{ borderStyle: 'dashed' }}>
                  <Icon as={ImageIcon} size="xl" color="$textLight300" />
                  <Text size="2xs" color="$textLight400" mt="$2" style={{ letterSpacing: 0.4 }}>
                    ILUSTRACIÓN
                  </Text>
                </Center>

                <Text
                  weight="bold"
                  color="$textLight900"
                  style={{ fontSize: cur.section === 'frases' ? 22 : 40, lineHeight: cur.section === 'frases' ? 28 : 44 }}>
                  {cur.word}
                </Text>

                {/* controles de audio */}
                <HStack space="sm" mt="$5">
                  <Button action="primary" variant="solid" rounded="$xl" style={{ flex: 1 }} onPress={() => audio.speakModel(cur.word)}>
                    <HStack space="sm" alignItems="center">
                      <Icon as={Volume2} size="sm" color="$white" />
                      <Text size="sm" weight="bold" color="$white">
                        Escuchar modelo
                      </Text>
                    </HStack>
                  </Button>
                  {audio.available || audio.recognitionAvailable ? (
                    <>
                      <Pressable style={{ flex: 1 }} onPress={() => audio.toggleRecording(cur.word)}>
                        <Center py="$3" borderRadius={14} bg={audio.recStatus === 'recording' ? '$error50' : '$textLight900'} borderWidth={audio.recStatus === 'recording' ? 1.5 : 0} borderColor="$error500">
                          <HStack space="sm" alignItems="center">
                            <Icon as={audio.recStatus === 'recording' ? Square : Mic} size="sm" color={audio.recStatus === 'recording' ? '$error500' : '$white'} />
                            <Text size="sm" weight="bold" color={audio.recStatus === 'recording' ? '$error600' : '$white'}>
                              {audio.recStatus === 'recording' ? 'Detener' : 'Grabar'}
                            </Text>
                          </HStack>
                        </Center>
                      </Pressable>
                      {audio.available ? (
                        <Pressable onPress={() => audio.playRecording()} disabled={audio.recStatus !== 'ready'}>
                          <Center w={52} py="$3" borderRadius={14} borderWidth={1} borderColor="$borderLight200" bg="$white" opacity={audio.recStatus === 'ready' ? 1 : 0.5}>
                            <Icon as={Play} size="sm" color="$primary500" />
                          </Center>
                        </Pressable>
                      ) : null}
                    </>
                  ) : null}
                </HStack>

                {/* feedback de reconocimiento de voz */}
                {audio.recognizing || audio.transcript ? (
                  <Box mt="$3" p="$3.5" borderRadius={14} bg={audio.matched ? '$success50' : audio.transcript ? '$warning50' : '$backgroundLight50'} borderWidth={1} borderColor={audio.matched ? '$success200' : audio.transcript ? '$warning200' : '$borderLight200'}>
                    <HStack space="sm" alignItems="center">
                      <Icon as={Mic} size="sm" color={audio.matched ? '$success600' : '$warning700'} />
                      <VStack style={{ flex: 1 }}>
                        <Text size="2xs" weight="bold" color="$textLight500" style={{ textTransform: 'uppercase', letterSpacing: 0.4 }}>
                          {audio.recognizing ? 'Escuchando…' : 'Reconocimiento de voz'}
                        </Text>
                        <Text size="sm" weight="bold" color="$textLight800">
                          {audio.transcript ? `«${audio.transcript}»` : 'Habla ahora…'}
                        </Text>
                      </VStack>
                      {audio.transcript ? (
                        <Box bg={audio.matched ? '$success600' : '$warning700'} px="$2.5" py="$0.5" borderRadius="$full">
                          <Text size="2xs" weight="bold" color="$white">
                            {audio.matched ? 'COINCIDE' : 'REVISAR'}
                          </Text>
                        </Box>
                      ) : null}
                    </HStack>
                    {audio.matched ? (
                      <Pressable onPress={() => recordCode('C')}>
                        <Center mt="$3" py="$2.5" borderRadius={12} bg="$success600">
                          <HStack space="sm" alignItems="center">
                            <Icon as={Check} size="sm" color="$white" />
                            <Text size="sm" weight="bold" color="$white">
                              Marcar como correcto
                            </Text>
                          </HStack>
                        </Center>
                      </Pressable>
                    ) : null}
                  </Box>
                ) : null}
              </Card>

              {/* clasificación SODA */}
              <Card bgColor="$white" borderRadius={20} p="$5">
                <Text size="sm" weight="bold" color="$textLight800" mb="$1">
                  Registro de la producción
                </Text>
                <Text size="2xs" color="$textLight500" mb="$3">
                  Clasifique la repetición del niño/a (SODA).
                </Text>
                <VStack space="sm">
                  {SODA_META.map(m => {
                    const active = curCode === m.code;
                    return (
                      <Pressable key={m.code} onPress={() => recordCode(m.code)}>
                        <HStack space="sm" alignItems="center" p="$3" borderRadius={14} borderWidth={2} bg={active ? SODA_BG[m.code] : '$white'} borderColor={active ? SODA_COLOR[m.code] : '$borderLight100'}>
                          <Center w={34} h={34} borderRadius={9} bg={SODA_COLOR[m.code]}>
                            <Text size="md" weight="bold" color="$white">
                              {m.letter}
                            </Text>
                          </Center>
                          <VStack style={{ flex: 1 }}>
                            <Text size="sm" weight="bold" color={active ? SODA_COLOR[m.code] : '$textLight800'}>
                              {m.label}
                            </Text>
                            <Text size="2xs" color="$textLight500">
                              {m.hint}
                            </Text>
                          </VStack>
                          {active ? <Icon as={Check} size="sm" color={SODA_COLOR[m.code]} /> : null}
                        </HStack>
                      </Pressable>
                    );
                  })}
                </VStack>

                {curCode === 'S' ? (
                  <Box mt="$4">
                    <Text size="2xs" weight="bold" color="$textLight500" mb="$2" style={{ textTransform: 'uppercase', letterSpacing: 0.4 }}>
                      ¿Qué produjo?
                    </Text>
                    <Input variant="outline" borderRadius={12}>
                      <InputField
                        placeholder="Transcriba el fonema/sílaba producido (p. ej. /t/ por /k/)"
                        value={subs[cur.id] ?? ''}
                        onChangeText={onSub}
                      />
                    </Input>
                  </Box>
                ) : null}
              </Card>

              {/* navegación */}
              <HStack space="md" justifyContent="space-between">
                <Button action="secondary" variant="outline" rounded="$full" onPress={prev} isDisabled={idx <= 0}>
                  <Icon as={ArrowLeft} size="sm" color="$primary500" />
                </Button>
                <Button action="secondary" variant="outline" rounded="$full" style={{ flex: 1 }} onPress={next} isDisabled={idx >= items.length - 1}>
                  <HStack space="sm" alignItems="center">
                    <Text size="sm" weight="bold" color="$primary500">
                      Siguiente
                    </Text>
                    <Icon as={ArrowRight} size="sm" color="$primary500" />
                  </HStack>
                </Button>
                <Button action="primary" variant="solid" rounded="$full" style={{ flex: 1 }} onPress={() => { audio.reset(); setView('report'); }} isDisabled={!canSave}>
                  <HStack space="sm" alignItems="center">
                    <Text size="sm" weight="bold" color="$white">
                      Finalizar
                    </Text>
                    <Icon as={Check} size="sm" color="$white" />
                  </HStack>
                </Button>
              </HStack>

              {/* mapa de inventario consonántico */}
              <Card bgColor="$white" borderRadius={20} p="$5">
                <HStack alignItems="center" justifyContent="space-between" mb="$3">
                  <Text size="sm" weight="bold" color="$textLight800">
                    Inventario fonético
                  </Text>
                  <HStack space="sm">
                    <HStack space="xs" alignItems="center">
                      <Box w={8} h={8} borderRadius="$full" bg="$success600" />
                      <Text size="2xs" color="$textLight500">Logrado</Text>
                    </HStack>
                    <HStack space="xs" alignItems="center">
                      <Box w={8} h={8} borderRadius="$full" bg="$warning700" />
                      <Text size="2xs" color="$textLight500">En proceso</Text>
                    </HStack>
                    <HStack space="xs" alignItems="center">
                      <Box w={8} h={8} borderRadius="$full" bg="$error500" />
                      <Text size="2xs" color="$textLight500">No logr.</Text>
                    </HStack>
                  </HStack>
                </HStack>
                <HStack space="xs" flexWrap="wrap" style={{ rowGap: 8 }}>
                  {score.phonemeStatus.map(st => {
                    const map = {
                      ok: { bg: '$success50', fg: '$success700', bd: '$success200' },
                      mid: { bg: '$warning50', fg: '$warning700', bd: '$warning200' },
                      bad: { bg: '$error50', fg: '$error600', bd: '$error200' },
                      none: { bg: '$backgroundLight50', fg: '$textLight400', bd: '$borderLight200' },
                    }[st.status];
                    const isCur = cur.phoneme === st.phoneme;
                    return (
                      <Pressable key={st.phoneme} onPress={() => jumpPhoneme(st.phoneme)}>
                        <Center minWidth={34} px="$2" py="$1.5" borderRadius={9} bg={map.bg} borderWidth={isCur ? 2 : 1.5} borderColor={isCur ? '$primary500' : map.bd}>
                          <Text size="xs" weight="bold" color={map.fg} style={{ fontVariant: ['tabular-nums'] }}>
                            {st.phoneme}
                          </Text>
                        </Center>
                      </Pressable>
                    );
                  })}
                </HStack>
              </Card>
            </VStack>
          )}

          {/* =====================  REPORT  ===================== */}
          {view === 'report' && (
            <VStack space="md">
              <Card bgColor={reportTheme.bg} borderColor={reportTheme.border} borderWidth={1} borderRadius={20} p="$5">
                <HStack space="sm" alignItems="center" justifyContent="space-between">
                  <HStack space="sm" alignItems="center" style={{ flex: 1 }}>
                    <Center w={44} h={44} borderRadius={14} bg="$white">
                      <Icon as={reportTheme.icon} size="lg" color={reportTheme.color} />
                    </Center>
                    <VStack style={{ flex: 1 }}>
                      <Text size="lg" weight="bold" color={reportTheme.fg}>
                        Resumen articulatorio
                      </Text>
                      <Text size="2xs" color={reportTheme.fg} style={{ opacity: 0.9 }}>
                        {score.evaluatedCount} / {score.totalCount} ítems registrados
                      </Text>
                    </VStack>
                  </HStack>
                  <VStack alignItems="center">
                    <Text size="2xl" weight="bold" color={reportTheme.fg}>
                      {score.correctPct}%
                    </Text>
                    <Text size="2xs" weight="bold" color={reportTheme.fg} style={{ textTransform: 'uppercase', opacity: 0.8 }}>
                      Acierto
                    </Text>
                  </VStack>
                </HStack>
              </Card>

              {/* recuento SODA */}
              <Card bgColor="$white" borderRadius={20} p="$5">
                <Text size="sm" weight="bold" color="$textLight700" mb="$3" style={{ textTransform: 'uppercase', letterSpacing: 0.4 }}>
                  Recuento por categoría (SODA)
                </Text>
                <HStack space="sm" flexWrap="wrap" style={{ rowGap: 8 }}>
                  {sodaSummary.map(m => (
                    <VStack key={m.code} alignItems="center" style={{ flexGrow: 1, flexBasis: '18%' }} p="$2" borderRadius={12} bg={SODA_BG[m.code]}>
                      <Text size="xl" weight="bold" color={SODA_COLOR[m.code]} style={{ fontVariant: ['tabular-nums'] }}>
                        {m.count}
                      </Text>
                      <Text size="2xs" weight="bold" color={SODA_COLOR[m.code]}>
                        {m.letter}
                      </Text>
                    </VStack>
                  ))}
                </HStack>
              </Card>

              {/* fonemas a intervenir */}
              <Card bgColor="$white" borderRadius={20} p="$5">
                <Text size="sm" weight="bold" color="$textLight700" mb="$3" style={{ textTransform: 'uppercase', letterSpacing: 0.4 }}>
                  Fonemas a intervenir
                </Text>
                {score.affectedPhonemes.length === 0 ? (
                  <HStack space="sm" alignItems="center">
                    <Icon as={CheckCircle2} size="sm" color="$success600" />
                    <Text size="sm" color="$success700">
                      Inventario completo sin alteraciones registradas.
                    </Text>
                  </HStack>
                ) : (
                  <HStack space="sm" flexWrap="wrap" style={{ rowGap: 8 }}>
                    {score.affectedPhonemes.map(a => (
                      <Box key={a.phoneme} bg={a.topCode === 'O' ? '$info50' : a.topCode === 'D' ? '$secondary50' : a.topCode === 'A' ? '$error50' : '$warning50'} px="$3" py="$1.5" borderRadius="$full">
                        <Text size="xs" weight="bold" color="$textLight700">
                          {a.phoneme} · {a.detail}
                        </Text>
                      </Box>
                    ))}
                  </HStack>
                )}
              </Card>

              {/* observaciones */}
              <Card bgColor="$white" borderRadius={18} p="$4">
                <Text size="2xs" weight="bold" color="$textLight500" mb="$2" style={{ textTransform: 'uppercase', letterSpacing: 0.4 }}>
                  Observaciones clínicas
                </Text>
                <Input variant="outline" borderRadius={12}>
                  <InputField placeholder="Anotaciones del profesional…" value={obs} onChangeText={setObs} multiline />
                </Input>
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
                <Button action="secondary" variant="outline" rounded="$full" onPress={() => setView('test')}>
                  <HStack space="sm" alignItems="center">
                    <Icon as={ArrowLeft} size="sm" color="$primary500" />
                    <Text size="sm" weight="bold" color="$primary500">
                      Seguir
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
                      Guardar en la evaluación
                    </Text>
                  </HStack>
                </Button>
              </HStack>

              <Text size="2xs" color="$textLight400" style={{ textAlign: 'center', lineHeight: 16 }}>
                Registro descriptivo de la producción a la repetición. No sustituye el juicio clínico del fonoaudiólogo.
              </Text>
            </VStack>
          )}

          <Box h="$10" />
        </VStack>
      </VStack>
    </Content>
  );
}
