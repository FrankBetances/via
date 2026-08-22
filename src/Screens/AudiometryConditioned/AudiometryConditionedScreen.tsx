import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, Vibration } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Box, Card, Center, HStack, Icon, Input, InputField, ScrollView, VStack } from '@gluestack-ui/themed';
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Pause,
  Play,
  RotateCcw,
  Save,
  Sparkles,
  Train,
  Volume2,
} from 'lucide-react-native';

import { Button, Content, Header, Text } from '@/Components/Common';
import RadialBackground from '@/Components/Themed/RadialBackground';
import { finishModule, RootStackParamList } from '@/Navigators';
import { RootState } from '@/Store';
import { Evaluation } from '@/Models/Evaluation/Evaluation';
import { AudiometryTest } from '@/Models/Audiometry/AudiometryTest';
import { useClassSelector } from '@/Helpers/ClassTransformer';
import { useTelemetryTracker } from '@/Telemetry';
import { useCreateAudiometryMutation } from '@/Services/local/modules/audiometry';
import { showErrorToast, showSuccessToast } from '@/Helpers/showToast';
import {
  Audiogram,
  FREQ_LABEL,
  FREQS,
  interpretAudiometry,
  severityOf,
  soundfieldNeedsReferral,
  useAudiometryTest,
} from '@/Screens/Audiometry';
import TrainScene from './components/TrainScene';
import WhistleButton from './components/WhistleButton';
import { LuaCompanionWidget } from '@/Components/Mascot/LuaCompanionWidget';
import { useLuaCompanion, LuaEmotion } from '@/Lua';

/* -------------------------------------------------------------------------- */
/*  Audiometría condicionada AUTOMÁTICA en CAMPO LIBRE — «El Tren de Lúa»      */
/*                                                                            */
/*  CPA (Conditioned Play Audiometry) y Refuerzo Visual (VRA) adaptado para    */
/*  ejecución autónoma por el niño/a:                                          */
/*   1. intro     → Lúa explica el juego con lenguaje cálido y amigable.       */
/*   2. practice  → Condicionamiento asistido (2 aciertos a 60 dB HL).        */
/*   3. test      → Prueba autónoma inmersiva de 4 estaciones amigas.          */
/*   4. done      → Fiesta de llegada + informe clínico y guardado.            */
/* -------------------------------------------------------------------------- */

type Props = NativeStackScreenProps<RootStackParamList, 'AudiometryConditioned'>;

type Phase = 'intro' | 'practice' | 'test' | 'done';

const FREQ_ORDER = [1000, 2000, 4000, 500] as const;
const TONE_MS = 1400;
const RESPONSE_GRACE_MS = 1500;
const PRACTICE_HITS_NEEDED = 2;
const MAX_MISSES_AT_80 = 2;

const INTRO_STEPS: { emoji: string; title: string; text: string }[] = [
  { emoji: '🔊', title: 'Prepara la sala', text: 'Sala tranquila, volumen del dispositivo al máximo y el niño/a sentado frente al altavoz a menos de 1 metro.' },
  { emoji: '👂', title: 'Escucha con Lúa', text: 'El tren viaja por las colinas. A veces hace sonar una música bajita… ¡hay que poner las orejitas atentas!' },
  { emoji: '✨', title: 'Toca la pantalla', text: 'En cuanto oigas el sonido, toca el gran botón en la pantalla para hacer avanzar el tren.' },
  { emoji: '🐰', title: '¡Recoge a los amigos!', text: 'Con cada sonido acertado subirá un amigo al vagón: el conejito, el osito, el zorrito y Lúa.' },
];

export default function AudiometryConditionedScreen({ navigation }: Props) {
  const activeEvaluation = useClassSelector(Evaluation, (state: RootState) => state.activeEvaluation.evaluation);
  const [createAudiometry, { isLoading: isSaving }] = useCreateAudiometryMutation();
  const a = useAudiometryTest({ soundfield: true });
  const tracker = useTelemetryTracker();

  const [phase, setPhase] = useState<Phase>('intro');
  const [paused, setPaused] = useState(false);
  const [practiceHits, setPracticeHits] = useState(0);
  const [practiceTick, setPracticeTick] = useState(0);
  const [trialTick, setTrialTick] = useState(0);
  const [chugging, setChugging] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const [warn, setWarn] = useState(false);
  const [showClinicianPanel, setShowClinicianPanel] = useState(false);

  const [notes, setNotes] = useState('');
  const [evaluatorName, setEvaluatorName] = useState(activeEvaluation?.professional?.name ?? '');
  const [evaluatorLicense, setEvaluatorLicense] = useState(activeEvaluation?.professional?.licenseNumber ?? '');

  const windowOpen = useRef(false);
  const missesAtMax = useRef(0);
  const skipped = useRef<Set<number>>(new Set());
  const presentTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const windowTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const phaseRef = useRef<Phase>('intro');
  phaseRef.current = phase;

  const patient = activeEvaluation?.patient;
  const patientName = patient ? `${patient.name} ${patient.lastName}`.trim() : null;

  const lua = useLuaCompanion({
    moduleKey: 'audiometry_conditioned',
    initialEmotion: LuaEmotion.Tranquility,
    initialLevel: 1,
  });

  const clearTimers = useCallback(() => {
    if (presentTimer.current) clearTimeout(presentTimer.current);
    if (windowTimer.current) clearTimeout(windowTimer.current);
    presentTimer.current = null;
    windowTimer.current = null;
    windowOpen.current = false;
  }, []);

  useEffect(() => () => clearTimers(), [clearTimers]);

  /**
   * Refuerzo inmediato al acierto: Lúa se ilumina + confeti + tren avanza + vibración háptica.
   */
  const flashCelebrate = useCallback(() => {
    setChugging(true);
    setCelebrate(true);
    try {
      Vibration.vibrate(150);
    } catch {
      /* sin vibración */
    }
    setTimeout(() => {
      setChugging(false);
      setCelebrate(false);
    }, 1800);
  }, []);

  const flashGentlePrompt = useCallback(() => {
    setWarn(true);
    setTimeout(() => setWarn(false), 1400);
  }, []);

  /* ------------------------- transición de fases -------------------------- */

  const startPractice = () => {
    clearTimers();
    setPracticeHits(0);
    a.setFreq(1000);
    a.setDb(60);
    setPhase('practice');
    lua.setPhase(0);
    lua.setEmotion(LuaEmotion.Tranquility);
  };

  const startTest = useCallback(() => {
    clearTimers();
    a.reset();
    skipped.current = new Set();
    missesAtMax.current = 0;
    setPaused(false);
    setPhase('test');
    lua.setPhase(1);
    lua.setEmotion(LuaEmotion.Tranquility);
  }, [a, clearTimers, lua]);

  const restartAll = () => {
    clearTimers();
    a.reset();
    skipped.current = new Set();
    missesAtMax.current = 0;
    setPracticeHits(0);
    setPaused(false);
    setPhase('intro');
    lua.setPhase(0);
    lua.setEmotion(LuaEmotion.Tranquility);
  };

  /** Avanza a la siguiente frecuencia pendiente; si no queda nada, fin. */
  const advance = useCallback(() => {
    missesAtMax.current = 0;
    const cur = typeof a.freq === 'number' ? a.freq : null;
    const isPending = (f: number) =>
      (a.thresholds.CL?.[f] ?? null) === null && !skipped.current.has(f) && f !== cur;

    const nextFreq = FREQ_ORDER.find(isPending);
    if (nextFreq !== undefined) {
      a.setFreq(nextFreq);
      a.setDb(40);
      lua.setEmotion(LuaEmotion.Tranquility);
      return;
    }
    clearTimers();
    setPhase('done');
    lua.triggerReward('audiometry_conditioned', 2);
  }, [a, clearTimers, lua]);

  useEffect(() => {
    if (phase === 'test' && typeof a.freq === 'number') tracker.enterReactivo(`auc-${a.freq}`);
  }, [phase, a.freq, tracker]);

  useEffect(() => {
    if (phase === 'test' && a.currentThreshold !== null && typeof a.freq === 'number') {
      tracker.classifyReactivo(`auc-${a.freq}`);
    }
  }, [phase, a.currentThreshold, a.freq, tracker]);

  /* --------------------- secuenciador: juego de práctica ------------------- */

  useEffect(() => {
    if (phase !== 'practice' || paused) return;
    if (practiceHits >= PRACTICE_HITS_NEEDED) {
      const t = setTimeout(startTest, 1500);
      return () => clearTimeout(t);
    }
    presentTimer.current = setTimeout(() => {
      a.playStimulus();
      windowOpen.current = true;
      windowTimer.current = setTimeout(() => {
        windowOpen.current = false;
        setPracticeTick(t => t + 1);
      }, TONE_MS + RESPONSE_GRACE_MS);
    }, 1600 + Math.random() * 800);
    return () => {
      if (presentTimer.current) clearTimeout(presentTimer.current);
      if (windowTimer.current) clearTimeout(windowTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, paused, practiceHits, practiceTick]);

  /* ------------------- secuenciador: prueba autónoma (HW) ------------------ */

  useEffect(() => {
    if (phase !== 'test' || paused) return;
    if (typeof a.freq !== 'number') return;
    const f = a.freq;

    if ((a.thresholds.CL?.[f] ?? null) !== null || skipped.current.has(f)) {
      advance();
      return;
    }

    presentTimer.current = setTimeout(() => {
      a.playStimulus();
      windowOpen.current = true;
      windowTimer.current = setTimeout(() => {
        windowOpen.current = false;
        if (phaseRef.current !== 'test') return;
        if (a.db >= 80) {
          missesAtMax.current += 1;
          if (missesAtMax.current >= MAX_MISSES_AT_80) {
            skipped.current.add(f);
            advance();
            return;
          }
        }
        a.noResponse();
        setTrialTick(t => t + 1);
      }, TONE_MS + RESPONSE_GRACE_MS);
    }, 1400 + Math.random() * 1600);

    return () => {
      if (presentTimer.current) clearTimeout(presentTimer.current);
      if (windowTimer.current) clearTimeout(windowTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, paused, a.freq, a.db, trialTick]);

  /* ------------------------------ el toque táctil -------------------------- */

  const onWhistle = () => {
    if (phase === 'practice') {
      if (a.playing || windowOpen.current) {
        clearTimers();
        a.stop();
        setPracticeHits(h => h + 1);
        flashCelebrate();
        lua.setVerdict(2);
        setPracticeTick(t => t + 1);
      } else {
        flashGentlePrompt();
      }
      return;
    }
    if (phase === 'test') {
      if (a.playing || windowOpen.current) {
        clearTimers();
        a.stop();
        const r = a.responded();
        flashCelebrate();
        lua.setVerdict(2);
        if (r.confirmed) advance();
        else setTrialTick(t => t + 1);
      } else {
        flashGentlePrompt();
      }
    }
  };

  /* ------------------------------- guardado -------------------------------- */

  const handleSave = async () => {
    if (isSaving) return;
    if (!evaluatorName.trim() || !evaluatorLicense.trim()) return;
    if (!activeEvaluation) {
      showErrorToast('No se puede guardar', 'No hay una evaluación activa asociada al paciente.');
      return;
    }
    try {
      const item = new AudiometryTest();
      item.method = 'conditioned';
      item.transducer = 'soundfield';
      item.thresholds = a.thresholds;
      item.ptaOD = null;
      item.ptaOI = null;
      item.reliability = a.reliability;
      item.interpretation = interpretAudiometry(a.thresholds);
      item.notes = notes.trim();
      item.evaluatorName = evaluatorName.trim();
      item.evaluatorLicense = evaluatorLicense.trim();
      item.completedAt = new Date();
      item.evaluation = { id: activeEvaluation.id } as Evaluation;

      await createAudiometry(item);
      showSuccessToast('Audiometría guardada', `PTA campo libre ${a.ptaCL ?? '—'} dB HL.`);
      finishModule(navigation);
    } catch {
      showErrorToast('Error al guardar', 'No se pudo registrar la audiometría. Inténtelo de nuevo.');
    }
  };

  /* -------------------------------- render --------------------------------- */

  const whistleActive = phase === 'practice' && a.playing;
  const doneForActive = a.stars;
  const doneFlags = [
    (a.thresholds.CL?.[1000] ?? null) !== null,
    (a.thresholds.CL?.[2000] ?? null) !== null,
    (a.thresholds.CL?.[4000] ?? null) !== null,
    (a.thresholds.CL?.[500] ?? null) !== null,
  ];
  const stationLabels = ['1. 🐰 1 kHz', '2. 🐻 2 kHz', '3. 🦊 4 kHz', '4. 🐱 500 Hz'];

  const needsReferral = soundfieldNeedsReferral(a.thresholds, a.ptaCL);
  const sevCL = a.ptaCL !== null ? severityOf(a.ptaCL) : null;

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
        <ScrollView showsVerticalScrollIndicator={false}>
          <VStack flex={1} px="$5" mt="$1" space="md" pb="$10">
            {/* Cabecera Lúdica */}
            <HStack alignItems="center" justifyContent="space-between">
              <VStack style={{ flex: 1 }}>
                <HStack alignItems="center" space="xs">
                  <Text size="xl" weight="bold" color="$textLight900">
                    El Tren Mágico de Lúa
                  </Text>
                  <Box bg="$primary50" px="$2" py="$0.5" borderRadius="$full">
                    <Text size="3xs" weight="bold" color="$primary800">
                      CPA INFANTIL
                    </Text>
                  </Box>
                </HStack>
                <Text size="xs" color="$textLight500">
                  {patientName ? `Viajero: ${patientName}` : 'Juego interactivo de audición en campo libre'}
                </Text>
              </VStack>

              {phase === 'test' || phase === 'done' ? (
                <HStack space="xs" alignItems="center" bg="$white" borderRadius="$full" px="$3" py="$1.5" borderWidth={1.5} borderColor="$emerald300" shadowColor="$black" shadowOpacity={0.05} elevation={2}>
                  <Text size="sm">⭐</Text>
                  <Text size="sm" weight="bold" color="$emerald700">
                    {a.stars}/4 amigos
                  </Text>
                </HStack>
              ) : null}
            </HStack>

            {/* Acompañamiento Lúa (Fusión Biofeedback y Recompensas) */}
            <LuaCompanionWidget
              emotion={lua.currentEmotion}
              activeBadge={phase === 'done' ? lua.activeBadge : null}
              connected={lua.connected}
              level={phase === 'done' ? 12 : phase === 'test' ? a.stars * 3 : 1}
              size={phase === 'test' ? 'compact' : 'normal'}
              message={
                phase === 'intro'
                  ? '¡Hola! Te acompaño en el Tren Mágico. Escucharemos sonidos divertidos.'
                  : phase === 'practice'
                  ? whistleActive
                    ? '¡Lúa oye el sonido! ¡Toca la pantalla grande!'
                    : 'Espera en silencio con las orejitas atentas...'
                  : phase === 'test'
                  ? 'Escucha con mucha atención… ¡toca en cuanto oigas la música!'
                  : '¡Fantástico viaje! Has recogido a todos los amigos y ganado la insignia Oído Atento.'
              }
            />

            {/* ============================ INTRO ============================ */}
            {phase === 'intro' && (
              <>
                <Card bgColor="$white" borderRadius={24} p="$5" shadowColor="$black" shadowOpacity={0.04} elevation={3}>
                  <HStack space="sm" alignItems="center" mb="$3">
                    <Center w={48} h={48} borderRadius={16} bg="$primary50">
                      <Icon as={Train} size="xl" color="$primary600" />
                    </Center>
                    <VStack style={{ flex: 1 }}>
                      <Text size="lg" weight="bold" color="$textLight900">
                        ¿Cómo jugamos?
                      </Text>
                      <Text size="xs" color="$textLight500">
                        Cuatro pasos sencillos para el niño/a
                      </Text>
                    </VStack>
                  </HStack>

                  <VStack space="md">
                    {INTRO_STEPS.map((s, i) => (
                      <HStack key={i} space="sm" alignItems="center">
                        <Center w={42} h={42} borderRadius={14} bg="$backgroundLight50">
                          <Text style={{ fontSize: 24 }}>{s.emoji}</Text>
                        </Center>
                        <VStack style={{ flex: 1 }}>
                          <Text size="sm" weight="bold" color="$textLight800">
                            {i + 1}. {s.title}
                          </Text>
                          <Text size="xs" color="$textLight500" style={{ lineHeight: 16 }}>
                            {s.text}
                          </Text>
                        </VStack>
                      </HStack>
                    ))}
                  </VStack>
                </Card>

                {!a.hasTone ? (
                  <Card bgColor="$error50" borderRadius={18} borderWidth={1} borderColor="$error200" p="$4">
                    <Text size="xs" weight="bold" color="$error700">
                      Motor de audio no disponible. Reinicie la aplicación antes de realizar la prueba.
                    </Text>
                  </Card>
                ) : null}

                <Button action="primary" variant="solid" rounded="$full" size="xl" onPress={startPractice}>
                  <HStack space="sm" alignItems="center">
                    <Icon as={Play} size="md" color="$white" />
                    <Text size="md" weight="bold" color="$white">
                      ¡Empezar a jugar!
                    </Text>
                  </HStack>
                </Button>
              </>
            )}

            {/* ========================== PRACTICE =========================== */}
            {phase === 'practice' && (
              <>
                <Card bgColor="$white" borderRadius={24} p="$4" shadowColor="$black" shadowOpacity={0.04} elevation={3}>
                  <HStack justifyContent="space-between" alignItems="center" mb="$2">
                    <Text size="sm" weight="bold" color="$textLight900">
                      Práctica — Aprende la magia
                    </Text>
                    <Box bg={practiceHits >= PRACTICE_HITS_NEEDED ? '$success100' : '$primary50'} px="$3" py="$1" borderRadius="$full">
                      <Text size="xs" weight="bold" color={practiceHits >= PRACTICE_HITS_NEEDED ? '$success800' : '$primary700'}>
                        {practiceHits}/{PRACTICE_HITS_NEEDED} aciertos
                      </Text>
                    </Box>
                  </HStack>

                  <TrainScene
                    progress={Math.min(3, practiceHits)}
                    stationLabels={['1. ¡Hola!', '2. ¡Casi!', '3. ¡Listo!', '4. ¡Vamos!']}
                    doneFlags={[practiceHits > 0, practiceHits > 1, false, false]}
                    chugging={chugging}
                    celebrate={celebrate}
                    stimulusVisual={whistleActive}
                  />

                  <Center mt="$3">
                    <Text size="sm" weight="bold" color={whistleActive ? '$success600' : '$textLight600'} style={{ textAlign: 'center' }}>
                      {practiceHits >= PRACTICE_HITS_NEEDED
                        ? '¡Genial! Ya estás listo para el gran viaje…'
                        : whistleActive
                        ? '¡Está sonando la música! ¡Toca la pantalla!'
                        : 'Espera en silencio… pronto sonará el tono.'}
                    </Text>
                  </Center>
                </Card>

                {/* Zona Táctil Gigante */}
                <WhistleButton
                  onPress={onWhistle}
                  highlight={whistleActive}
                  label={whistleActive ? '¡HE OÍDO EL SONIDO!' : '¡TOCA LA PANTALLA!'}
                  sublabel={whistleActive ? '¡Pulsa rápido para recoger al amigo!' : 'Espera a oír el sonido con las orejitas'}
                />

                {warn ? (
                  <Center>
                    <Box bg="$primary50" px="$4" py="$2" borderRadius={14} borderWidth={1} borderColor="$primary200">
                      <Text size="xs" weight="bold" color="$primary800">
                        ¡Shh! Escucha con las orejitas atentas... pronto sonará 👂✨
                      </Text>
                    </Box>
                  </Center>
                ) : null}
              </>
            )}

            {/* ============================ TEST ============================= */}
            {phase === 'test' && (
              <>
                <Card bgColor="$white" borderRadius={24} p="$4" shadowColor="$black" shadowOpacity={0.04} elevation={3}>
                  <HStack justifyContent="space-between" alignItems="center" mb="$2">
                    <Text size="sm" weight="bold" color="$textLight900">
                      El Gran Viaje de las 4 Estaciones
                    </Text>
                    {paused ? (
                      <Box bg="$warning50" px="$2.5" py="$1" borderRadius="$full">
                        <Text size="2xs" weight="bold" color="$warning700">EN PAUSA</Text>
                      </Box>
                    ) : (
                      <Box bg="$emerald50" px="$2.5" py="$1" borderRadius="$full">
                        <Text size="2xs" weight="bold" color="$emerald700">EN MARCHA</Text>
                      </Box>
                    )}
                  </HStack>

                  <TrainScene
                    progress={doneForActive}
                    stationLabels={stationLabels}
                    doneFlags={doneFlags}
                    chugging={chugging}
                    celebrate={celebrate}
                    idle={!paused}
                  />
                </Card>

                {/* Zona Táctil Gigante del Niño */}
                <WhistleButton
                  onPress={onWhistle}
                  disabled={paused}
                  label="¡HE OÍDO EL SONIDO!"
                  sublabel="Toca la pantalla cada vez que oigas el sonido"
                />

                {warn ? (
                  <Center>
                    <Box bg="$primary50" px="$4" py="$2" borderRadius={14} borderWidth={1} borderColor="$primary200">
                      <Text size="xs" weight="bold" color="$primary800">
                        ¡Casi! Escuchemos un poquito más... 👂🚂
                      </Text>
                    </Box>
                  </Center>
                ) : null}

                {/* Panel del Profesional Desplegable (Discreto) */}
                <Card bgColor="$backgroundLight50" borderRadius={18} borderWidth={1} borderColor="$borderLight100" p="$3">
                  <Pressable onPress={() => setShowClinicianPanel(p => !p)}>
                    <HStack alignItems="center" justifyContent="space-between">
                      <HStack space="xs" alignItems="center">
                        <Icon as={Volume2} size="xs" color="$textLight500" />
                        <Text size="2xs" weight="bold" color="$textLight500" style={{ letterSpacing: 0.4 }}>
                          PANEL CLÍNICO · {typeof a.freq === 'number' ? `${FREQ_LABEL[String(a.freq)]} Hz · ${a.db} dB HL` : '—'}
                        </Text>
                      </HStack>
                      <Icon as={showClinicianPanel ? ChevronUp : ChevronDown} size="xs" color="$textLight500" />
                    </HStack>
                  </Pressable>

                  {showClinicianPanel && (
                    <VStack space="sm" mt="$3" pt="$3" borderTopWidth={1} borderColor="$borderLight200">
                      <Text size="2xs" color="$textLight600">
                        Hughson-Westlake (−10/+5 dB) en campo libre. Umbrales: {a.stars}/4 confirmados.
                      </Text>
                      <HStack space="sm" justifyContent="flex-end">
                        <Button size="xs" variant="outline" action="secondary" onPress={() => setPaused(p => !p)}>
                          <HStack space="2xs" alignItems="center">
                            <Icon as={paused ? Play : Pause} size="2xs" color="$textLight600" />
                            <Text size="2xs" weight="bold" color="$textLight700">
                              {paused ? 'Reanudar' : 'Pausar'}
                            </Text>
                          </HStack>
                        </Button>
                        <Button size="xs" variant="outline" action="secondary" onPress={restartAll}>
                          <HStack space="2xs" alignItems="center">
                            <Icon as={RotateCcw} size="2xs" color="$textLight600" />
                            <Text size="2xs" weight="bold" color="$textLight700">
                              Reiniciar
                            </Text>
                          </HStack>
                        </Button>
                      </HStack>
                    </VStack>
                  )}
                </Card>
              </>
            )}

            {/* ============================ DONE ============================= */}
            {phase === 'done' && (
              <>
                <Card bgColor="$success50" borderRadius={24} borderWidth={1.5} borderColor="$success200" p="$5" shadowColor="$black" shadowOpacity={0.05} elevation={3}>
                  <HStack space="md" alignItems="center">
                    <Center w={52} h={52} borderRadius={18} bg="$white">
                      <Text style={{ fontSize: 32 }}>🏆</Text>
                    </Center>
                    <VStack style={{ flex: 1 }}>
                      <Text size="lg" weight="bold" color="$success800">
                        ¡Gran Viaje Completado!
                      </Text>
                      <Text size="xs" color="$success700">
                        {a.stars}/4 umbrales confirmados · Fiabilidad {a.reliability !== null ? `${a.reliability}%` : '—'}
                      </Text>
                    </VStack>
                  </HStack>
                </Card>

                {/* Criterio de derivación */}
                {needsReferral ? (
                  <Card bgColor="$warning50" borderRadius={20} borderWidth={1} borderColor="$warning200" p="$4">
                    <HStack space="sm" alignItems="flex-start">
                      <Icon as={AlertTriangle} size="sm" color="$warning600" style={{ marginTop: 2 }} />
                      <VStack style={{ flex: 1 }}>
                        <Text size="sm" weight="bold" color="$warning800">
                          Indicios de hipoacusia — Derivación recomendada
                        </Text>
                        <Text size="xs" color="$warning800" style={{ lineHeight: 17 }}>
                          El cribado en campo libre sugiere una audición por debajo de lo esperado
                          {a.ptaCL !== null ? ` (PTA ${a.ptaCL} dB HL)` : ' (respuestas insuficientes)'}. Se aconseja
                          derivación a ORL / audiología para audiometría clínica con auriculares.
                        </Text>
                      </VStack>
                    </HStack>
                  </Card>
                ) : (
                  <Card bgColor="$primary0" borderRadius={20} borderWidth={1} borderColor="$primary100" p="$4">
                    <Text size="xs" color="$primary800" style={{ lineHeight: 17 }}>
                      Cribado dentro de la normalidad. El campo libre estima la audición del mejor oído y no descarta
                      pérdida unilateral. Ante dudas clínicas, mantenga el seguimiento.
                    </Text>
                  </Card>
                )}

                {/* Audiograma */}
                <Card bgColor="$white" borderRadius={22} p="$4">
                  <HStack justifyContent="space-between" alignItems="center" mb="$2">
                    <Text size="sm" weight="bold" color="$textLight900">Audiograma de cribado</Text>
                    <Text size="2xs" style={{ color: '#0066B3', fontWeight: 'bold' }}>Ⓢ Campo libre (binaural)</Text>
                  </HStack>
                  <Box h={250} borderRadius={14} borderWidth={1} borderColor="$borderLight100" bg="$backgroundLight50">
                    <Audiogram thresholds={a.thresholds} cursor={null} cursorColor="#0066B3" />
                  </Box>
                </Card>

                {/* Umbrales + PTA + Fiabilidad */}
                <Card bgColor="$white" borderRadius={22} p="$4">
                  <Text size="sm" weight="bold" color="$textLight900" mb="$2">Umbrales registrados · dB HL</Text>
                  <VStack space="xs">
                    <HStack>
                      <Text size="xs" color="$textLight400" style={{ width: 90 }}>Canal</Text>
                      {FREQS.map(f => (
                        <Text key={f} size="xs" color="$textLight400" style={{ flex: 1, textAlign: 'center' }}>{FREQ_LABEL[String(f)]}</Text>
                      ))}
                    </HStack>
                    <HStack alignItems="center">
                      <Text size="sm" weight="bold" style={{ width: 90, color: '#0066B3' }}>Campo libre</Text>
                      {FREQS.map(f => (
                        <Text key={f} size="sm" weight="semiBold" color="$textLight700" style={{ flex: 1, textAlign: 'center', fontVariant: ['tabular-nums'] }}>
                          {a.thresholds.CL?.[f] ?? '—'}
                        </Text>
                      ))}
                    </HStack>
                  </VStack>
                  <HStack space="sm" mt="$3">
                    <Box flex={1} bg="$backgroundLight50" borderRadius={12} p="$2.5" alignItems="center">
                      <Text size="2xs" color="$textLight400">PTA CAMPO LIBRE</Text>
                      <Text size="lg" weight="bold" style={{ color: '#0066B3' }}>{a.ptaCL ?? '—'}</Text>
                      {sevCL ? <Text size="2xs" color="$textLight500">{sevCL.label}</Text> : null}
                    </Box>
                    <Box flex={1} bg="$backgroundLight50" borderRadius={12} p="$2.5" alignItems="center">
                      <Text size="2xs" color="$textLight400">FIABILIDAD</Text>
                      <Text size="lg" weight="bold" color={a.reliability === null ? '$textLight400' : a.reliability >= 80 ? '$success600' : '$warning600'}>
                        {a.reliability !== null ? `${a.reliability}%` : '—'}
                      </Text>
                    </Box>
                  </HStack>
                </Card>

                {/* Formulario de Guardado */}
                <Card bgColor="$white" borderRadius={22} p="$4">
                  <Text size="sm" weight="bold" color="$textLight700" mb="$2">Evaluador responsable</Text>
                  <HStack space="sm" mb="$3">
                    <Input variant="outline" borderRadius={12} style={{ flex: 2 }}>
                      <InputField placeholder="Nombre" value={evaluatorName} onChangeText={setEvaluatorName} />
                    </Input>
                    <Input variant="outline" borderRadius={12} style={{ flex: 1 }}>
                      <InputField placeholder="Colegiado" value={evaluatorLicense} onChangeText={setEvaluatorLicense} />
                    </Input>
                  </HStack>
                  <Input variant="outline" borderRadius={12} h={64} mb="$3">
                    <InputField multiline placeholder="Observaciones clínicas…" value={notes} onChangeText={setNotes} style={{ textAlignVertical: 'top' }} />
                  </Input>
                  <Button
                    action="primary"
                    variant="solid"
                    rounded="$full"
                    size="xl"
                    isDisabled={isSaving || !evaluatorName.trim() || !evaluatorLicense.trim()}
                    isLoading={isSaving}
                    onPress={handleSave}>
                    <HStack space="sm" alignItems="center">
                      <Icon as={Save} size="sm" color="$white" />
                      <Text size="md" weight="bold" color="$white">Guardar audiometría</Text>
                    </HStack>
                  </Button>
                  <Pressable onPress={restartAll} style={{ marginTop: 10 }}>
                    <Center py="$2.5" borderRadius={12} borderWidth={1} borderColor="$borderLight200" bg="$white">
                      <HStack space="xs" alignItems="center">
                        <Icon as={RotateCcw} size="xs" color="$textLight500" />
                        <Text size="sm" weight="bold" color="$textLight500">Repetir la prueba</Text>
                      </HStack>
                    </Center>
                  </Pressable>
                </Card>
              </>
            )}
          </VStack>
        </ScrollView>
      </VStack>
    </Content>
  );
}
