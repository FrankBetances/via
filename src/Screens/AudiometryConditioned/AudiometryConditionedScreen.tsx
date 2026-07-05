import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Box, Card, Center, HStack, Icon, Input, InputField, ScrollView, VStack } from '@gluestack-ui/themed';
import { AlertTriangle, Bell, Pause, Play, RotateCcw, Save, Sparkles, Train, Volume2 } from 'lucide-react-native';

import { Button, Content, Header, Text } from '@/Components/Common';
import RadialBackground from '@/Components/Themed/RadialBackground';
import { RootStackParamList } from '@/Navigators';
import { RootState } from '@/Store';
import { Evaluation } from '@/Models/Evaluation/Evaluation';
import { AudiometryTest } from '@/Models/Audiometry/AudiometryTest';
import { useClassSelector } from '@/Helpers/ClassTransformer';
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

/* -------------------------------------------------------------------------- */
/*  Audiometría condicionada AUTOMÁTICA en CAMPO LIBRE — «El Tren del Sonido»  */
/*                                                                            */
/*  Cribado binaural por el altavoz del dispositivo, sin auriculares y sin     */
/*  discriminación de oído: aproxima la audición (mejor oído) y, ante          */
/*  indicios de hipoacusia, orienta la derivación a un centro especializado.   */
/*                                                                            */
/*  Flujo en 4 fases, sin operador durante la prueba:                          */
/*   1. intro     → instrucciones para el niño/a y el profesional.             */
/*   2. practice  → juego previo de condicionamiento: tonos claramente         */
/*                  audibles (60 dB HL); el niño debe tocar el silbato al      */
/*                  oírlos. Con 3 aciertos pasa a la prueba.                   */
/*   3. test      → prueba autónoma: la app presenta los tonos con intervalos  */
/*                  aleatorios y aplica Hughson-Westlake (baja 10 al acierto,  */
/*                  sube 5 al fallo, umbral con 2 respuestas al mismo nivel).   */
/*                  Orden 1000→2000→4000→500 Hz en una sola pasada (canal CL).  */
/*   4. done      → audiograma, PTA binaural, criterio de derivación y         */
/*                  guardado por el profesional.                               */
/* -------------------------------------------------------------------------- */

type Props = NativeStackScreenProps<RootStackParamList, 'AudiometryConditioned'>;

type Phase = 'intro' | 'practice' | 'test' | 'done';

const FREQ_ORDER = [1000, 2000, 4000, 500] as const;
const TONE_MS = 1400; // duración del tono (igual que el hook)
const RESPONSE_GRACE_MS = 1500; // margen tras el tono para aceptar la respuesta
const PRACTICE_HITS_NEEDED = 3;
const MAX_MISSES_AT_80 = 2; // no-respuestas a 80 dB antes de saltar la frecuencia

const INTRO_STEPS: { emoji: string; title: string; text: string }[] = [
  { emoji: '🔊', title: 'Prepara la sala', text: 'Sala silenciosa, volumen del dispositivo al máximo y el niño/a sentado frente al altavoz, a menos de 1 metro. Sin auriculares: el sonido sale por el altavoz.' },
  { emoji: '👂', title: 'Escucha con atención', text: 'El tren silba de vez en cuando. A veces suena muy bajito… ¡hay que estar muy atento!' },
  { emoji: '🔔', title: 'Toca el silbato', text: 'Cada vez que oigas el silbido del tren, pulsa el botón grande del silbato.' },
  { emoji: '🚉', title: 'Llega a las estaciones', text: 'Con cada silbido acertado el tren avanza. ¡Completa las 4 estaciones para ganar!' },
];

export default function AudiometryConditionedScreen({ navigation }: Props) {
  const activeEvaluation = useClassSelector(Evaluation, (state: RootState) => state.activeEvaluation.evaluation);
  const [createAudiometry, { isLoading: isSaving }] = useCreateAudiometryMutation();
  const a = useAudiometryTest({ soundfield: true });

  const [phase, setPhase] = useState<Phase>('intro');
  const [paused, setPaused] = useState(false);
  const [practiceHits, setPracticeHits] = useState(0);
  const [practiceTick, setPracticeTick] = useState(0);
  const [trialTick, setTrialTick] = useState(0);
  const [chugging, setChugging] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const [warn, setWarn] = useState(false);
  const [notes, setNotes] = useState('');
  const [evaluatorName, setEvaluatorName] = useState(activeEvaluation?.professional?.name ?? '');
  const [evaluatorLicense, setEvaluatorLicense] = useState(activeEvaluation?.professional?.licenseNumber ?? '');

  // Estado interno del secuenciador (no necesita re-render).
  const windowOpen = useRef(false); // ventana de respuesta activa (tono + gracia)
  const missesAtMax = useRef(0);
  const skipped = useRef<Set<number>>(new Set());
  const presentTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const windowTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const phaseRef = useRef<Phase>('intro');
  phaseRef.current = phase;

  const patient = activeEvaluation?.patient;
  const patientName = patient ? `${patient.name} ${patient.lastName}`.trim() : null;

  const clearTimers = useCallback(() => {
    if (presentTimer.current) clearTimeout(presentTimer.current);
    if (windowTimer.current) clearTimeout(windowTimer.current);
    presentTimer.current = null;
    windowTimer.current = null;
    windowOpen.current = false;
  }, []);

  useEffect(() => () => clearTimers(), [clearTimers]);

  const flashCelebrate = useCallback(() => {
    setChugging(true);
    setCelebrate(true);
    setTimeout(() => {
      setChugging(false);
      setCelebrate(false);
    }, 1500);
  }, []);

  const flashWarn = useCallback(() => {
    setWarn(true);
    setTimeout(() => setWarn(false), 1200);
  }, []);

  /* ------------------------- transición de fases -------------------------- */

  const startPractice = () => {
    clearTimers();
    setPracticeHits(0);
    a.setFreq(1000);
    a.setDb(60); // claramente audible: condicionamiento, no umbral
    setPhase('practice');
  };

  const startTest = useCallback(() => {
    clearTimers();
    a.reset(); // campo libre · 1000 Hz · 40 dB, umbrales limpios
    skipped.current = new Set();
    missesAtMax.current = 0;
    setPaused(false);
    setPhase('test');
  }, [a, clearTimers]);

  const restartAll = () => {
    clearTimers();
    a.reset();
    skipped.current = new Set();
    missesAtMax.current = 0;
    setPracticeHits(0);
    setPaused(false);
    setPhase('intro');
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
      return;
    }
    clearTimers();
    setPhase('done');
  }, [a, clearTimers]);

  /* --------------------- secuenciador: juego de práctica ------------------- */

  useEffect(() => {
    if (phase !== 'practice' || paused) return;
    if (practiceHits >= PRACTICE_HITS_NEEDED) {
      const t = setTimeout(startTest, 1600);
      return () => clearTimeout(t);
    }
    presentTimer.current = setTimeout(() => {
      a.playStimulus();
      windowOpen.current = true;
      windowTimer.current = setTimeout(() => {
        windowOpen.current = false;
        setPracticeTick(t => t + 1); // sin respuesta: se repite el estímulo
      }, TONE_MS + RESPONSE_GRACE_MS);
    }, 1800 + Math.random() * 1000);
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

    // Umbral ya confirmado en esta frecuencia → avanzar a la siguiente.
    if ((a.thresholds.CL?.[f] ?? null) !== null || skipped.current.has(f)) {
      advance();
      return;
    }

    // Intervalo aleatorio entre estímulos: evita que el niño responda al ritmo.
    presentTimer.current = setTimeout(() => {
      a.playStimulus();
      windowOpen.current = true;
      windowTimer.current = setTimeout(() => {
        windowOpen.current = false;
        // No respondió dentro de la ventana.
        if (phaseRef.current !== 'test') return;
        if (a.db >= 80) {
          missesAtMax.current += 1;
          if (missesAtMax.current >= MAX_MISSES_AT_80) {
            // Sin respuesta al máximo nivel: se salta la frecuencia (queda sin
            // umbral y así se refleja en el audiograma/PTA y en la derivación).
            skipped.current.add(f);
            advance();
            return;
          }
        }
        a.noResponse(); // sube 5 dB
        setTrialTick(t => t + 1);
      }, TONE_MS + RESPONSE_GRACE_MS);
    }, 1400 + Math.random() * 1600);

    return () => {
      if (presentTimer.current) clearTimeout(presentTimer.current);
      if (windowTimer.current) clearTimeout(windowTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, paused, a.freq, a.db, trialTick]);

  /* ------------------------------ el silbato ------------------------------- */

  const onWhistle = () => {
    if (phase === 'practice') {
      if (a.playing || windowOpen.current) {
        clearTimers();
        a.stop();
        setPracticeHits(h => h + 1);
        flashCelebrate();
        setPracticeTick(t => t + 1);
      } else {
        flashWarn();
      }
      return;
    }
    if (phase === 'test') {
      if (a.playing || windowOpen.current) {
        clearTimers();
        a.stop();
        const r = a.responded(); // HW: baja 10 dB o confirma umbral
        flashCelebrate();
        if (r.confirmed) advance();
        else setTrialTick(t => t + 1);
      } else {
        // Falsa alarma: sin estímulo activo. Solo feedback suave.
        flashWarn();
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
      item.transducer = 'soundfield'; // campo libre: sin discriminación de oído
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
      navigation.goBack();
    } catch {
      showErrorToast('Error al guardar', 'No se pudo registrar la audiometría. Inténtelo de nuevo.');
    }
  };

  /* -------------------------------- render --------------------------------- */

  const doneForActive = a.doneForEar('CL');
  const doneFlags = FREQS.map(f => (a.thresholds.CL?.[f] ?? null) !== null);
  const stationLabels = FREQS.map(f => FREQ_LABEL[String(f)]);
  const sevCL = severityOf(a.ptaCL);
  const needsReferral = phase === 'done' && a.thresholds.CL ? soundfieldNeedsReferral(a.thresholds.CL) : false;

  const whistleActive = a.playing || windowOpen.current;

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
          <VStack flex={1} px="$6" mt="$2" space="md" pb="$10">
            {/* título */}
            <HStack alignItems="center" justifyContent="space-between">
              <VStack style={{ flex: 1 }}>
                <HStack alignItems="center" space="sm">
                  <Text size="2xl" weight="bold" color="$textLight900">
                    Audiometría condicionada
                  </Text>
                  <Box bg="$primary50" px="$2" py="$0.5" borderRadius="$full">
                    <Text size="2xs" weight="bold" color="$primary800" style={{ letterSpacing: 0.4 }}>
                      CAMPO LIBRE
                    </Text>
                  </Box>
                </HStack>
                <Text size="xs" color="$textLight500">
                  {patientName ?? 'El Tren del Sonido · cribado binaural sin auriculares'}
                </Text>
              </VStack>
              {phase === 'test' || phase === 'done' ? (
                <HStack space="xs" alignItems="center" bg="$white" borderRadius="$full" px="$3" py="$1.5" borderWidth={1} borderColor="$borderLight100">
                  <Text size="sm">🎫</Text>
                  <Text size="sm" weight="bold" color="$primary600">
                    {a.stars}/4
                  </Text>
                </HStack>
              ) : null}
            </HStack>

            {/* ============================ INTRO ============================ */}
            {phase === 'intro' && (
              <>
                <Card bgColor="$white" borderRadius={22} p="$5">
                  <HStack space="sm" alignItems="center" mb="$3">
                    <Center w={44} h={44} borderRadius={14} bg="$primary50">
                      <Icon as={Train} size="lg" color="$primary600" />
                    </Center>
                    <VStack style={{ flex: 1 }}>
                      <Text size="lg" weight="bold" color="$textLight900">
                        El Tren del Sonido
                      </Text>
                      <Text size="xs" color="$textLight500">
                        Cómo se juega · explícaselo al niño/a
                      </Text>
                    </VStack>
                  </HStack>
                  <VStack space="md">
                    {INTRO_STEPS.map((s, i) => (
                      <HStack key={i} space="sm" alignItems="flex-start">
                        <Center w={40} h={40} borderRadius={12} bg="$backgroundLight50">
                          <Text style={{ fontSize: 22 }}>{s.emoji}</Text>
                        </Center>
                        <VStack style={{ flex: 1 }}>
                          <Text size="sm" weight="bold" color="$textLight800">
                            {i + 1}. {s.title}
                          </Text>
                          <Text size="xs" color="$textLight500" style={{ lineHeight: 17 }}>
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
                      Motor de audio no disponible: no se emitirán tonos. Reinicie la aplicación antes de
                      realizar la prueba.
                    </Text>
                  </Card>
                ) : null}

                <Card bgColor="$primary0" borderRadius={18} borderWidth={1} borderColor="$primary100" p="$4">
                  <HStack space="sm" alignItems="flex-start">
                    <Icon as={Volume2} size="sm" color="$primary600" style={{ marginTop: 2 }} />
                    <Text size="xs" color="$primary800" style={{ flex: 1, lineHeight: 18 }}>
                      Para el profesional: cribado en CAMPO LIBRE (altavoz, sin auriculares y sin discriminación de
                      oído). Tras un breve juego de práctica ({PRACTICE_HITS_NEEDED} aciertos con tonos claramente
                      audibles), la prueba es autónoma: tonos con intervalos aleatorios y Hughson-Westlake (−10 dB al
                      acierto, +5 dB al fallo, umbral con 2 respuestas) en 1000→2000→4000→500 Hz, en una sola pasada.
                      El resultado aproxima la audición del mejor oído; ante indicios de hipoacusia, derive a un
                      centro especializado.
                    </Text>
                  </HStack>
                </Card>

                <Button action="primary" variant="solid" rounded="$full" onPress={startPractice}>
                  <HStack space="sm" alignItems="center">
                    <Icon as={Play} size="sm" color="$white" />
                    <Text size="md" weight="bold" color="$white">
                      Empezar el juego de práctica
                    </Text>
                  </HStack>
                </Button>
              </>
            )}

            {/* ========================== PRACTICE =========================== */}
            {phase === 'practice' && (
              <>
                <Card bgColor="$white" borderRadius={22} p="$4">
                  <HStack justifyContent="space-between" alignItems="center" mb="$2">
                    <Text size="sm" weight="bold" color="$textLight900">
                      Práctica — ¡aprende a jugar!
                    </Text>
                    <Box bg={practiceHits >= PRACTICE_HITS_NEEDED ? '$success50' : '$primary50'} px="$2.5" py="$1" borderRadius="$full">
                      <Text size="2xs" weight="bold" color={practiceHits >= PRACTICE_HITS_NEEDED ? '$success700' : '$primary700'}>
                        {practiceHits}/{PRACTICE_HITS_NEEDED} aciertos
                      </Text>
                    </Box>
                  </HStack>
                  <TrainScene progress={Math.min(3, practiceHits)} stationLabels={['¡Hola!', 'Práctica', '¡Casi!', '¡Listo!']} doneFlags={[practiceHits > 0, practiceHits > 1, practiceHits > 2, false]} chugging={chugging} celebrate={celebrate} />
                  <Center mt="$3">
                    <Text size="sm" weight="semiBold" color="$textLight600" style={{ textAlign: 'center' }}>
                      {practiceHits >= PRACTICE_HITS_NEEDED
                        ? '¡Muy bien! Empieza la prueba de verdad…'
                        : a.playing
                          ? '¡El tren está silbando! ¡Toca el silbato!'
                          : 'Espera… cuando oigas el silbido, toca el silbato.'}
                    </Text>
                  </Center>
                </Card>

                <Pressable onPress={onWhistle}>
                  <Center py="$6" borderRadius={24} bg={whistleActive ? '$success600' : '$primary600'}>
                    <Icon as={Bell} size="xl" color="$white" />
                    <Text size="lg" weight="bold" color="$white" mt="$1">
                      ¡Toca el silbato!
                    </Text>
                    <Text size="xs" color="$white" style={{ opacity: 0.9 }}>
                      Pulsa cuando oigas el tren
                    </Text>
                  </Center>
                </Pressable>
                {warn ? (
                  <Center>
                    <Box bg="$error50" px="$4" py="$2" borderRadius={12}>
                      <Text size="xs" weight="bold" color="$error600">
                        Todavía no suena nada… espera al silbido 😉
                      </Text>
                    </Box>
                  </Center>
                ) : null}
              </>
            )}

            {/* ============================ TEST ============================= */}
            {phase === 'test' && (
              <>
                <Card bgColor="$white" borderRadius={22} p="$4">
                  <HStack justifyContent="space-between" alignItems="center" mb="$2">
                    <Text size="sm" weight="bold" color="$textLight900">
                      El Tren del Sonido — campo libre
                    </Text>
                    {a.playing ? (
                      <Box bg="$primary50" px="$2.5" py="$1" borderRadius="$full">
                        <Text size="2xs" weight="bold" color="$primary700">SILBANDO…</Text>
                      </Box>
                    ) : paused ? (
                      <Box bg="$warning50" px="$2.5" py="$1" borderRadius="$full">
                        <Text size="2xs" weight="bold" color="$warning700">EN PAUSA</Text>
                      </Box>
                    ) : null}
                  </HStack>
                  <TrainScene progress={doneForActive} stationLabels={stationLabels} doneFlags={doneFlags} chugging={chugging} celebrate={celebrate} />
                </Card>

                <Pressable onPress={onWhistle} disabled={paused}>
                  <Center py="$6" borderRadius={24} bg={paused ? '$backgroundLight300' : whistleActive ? '$success600' : '$primary600'}>
                    <Icon as={Bell} size="xl" color="$white" />
                    <Text size="lg" weight="bold" color="$white" mt="$1">
                      ¡Toca el silbato!
                    </Text>
                    <Text size="xs" color="$white" style={{ opacity: 0.9 }}>
                      Pulsa cuando oigas el tren
                    </Text>
                  </Center>
                </Pressable>
                {warn ? (
                  <Center>
                    <Box bg="$error50" px="$4" py="$2" borderRadius={12}>
                      <Text size="xs" weight="bold" color="$error600">
                        Espera a oír el silbido del tren
                      </Text>
                    </Box>
                  </Center>
                ) : null}

                {/* panel del profesional (estado, no controles clínicos) */}
                <Card bgColor="$backgroundLight50" borderRadius={18} borderWidth={1} borderColor="$borderLight100" p="$4">
                  <HStack alignItems="center" justifyContent="space-between">
                    <VStack style={{ flex: 1 }}>
                      <Text size="2xs" weight="bold" color="$textLight400" style={{ letterSpacing: 0.4 }}>
                        SECUENCIADOR AUTOMÁTICO
                      </Text>
                      <Text size="xs" weight="semiBold" color="$textLight700" mt="$0.5" style={{ fontVariant: ['tabular-nums'] }}>
                        Campo libre · {typeof a.freq === 'number' ? `${FREQ_LABEL[String(a.freq)]} Hz` : '—'} · {a.db} dB HL
                        {' · '}umbrales {a.stars}/4
                      </Text>
                    </VStack>
                    <HStack space="sm">
                      <Pressable onPress={() => setPaused(p => !p)}>
                        <Center w={42} h={42} borderRadius={12} borderWidth={1} borderColor="$borderLight200" bg="$white">
                          <Icon as={paused ? Play : Pause} size="sm" color="$textLight600" />
                        </Center>
                      </Pressable>
                      <Pressable onPress={restartAll}>
                        <Center w={42} h={42} borderRadius={12} borderWidth={1} borderColor="$borderLight200" bg="$white">
                          <Icon as={RotateCcw} size="sm" color="$textLight600" />
                        </Center>
                      </Pressable>
                    </HStack>
                  </HStack>
                </Card>
              </>
            )}

            {/* ============================ DONE ============================= */}
            {phase === 'done' && (
              <>
                <Card bgColor="$success50" borderRadius={20} borderWidth={1} borderColor="$success200" p="$5">
                  <HStack space="sm" alignItems="center">
                    <Center w={44} h={44} borderRadius={14} bg="$white">
                      <Icon as={Sparkles} size="lg" color="$success600" />
                    </Center>
                    <VStack style={{ flex: 1 }}>
                      <Text size="lg" weight="bold" color="$success800">
                        ¡Prueba completada!
                      </Text>
                      <Text size="2xs" color="$success700">
                        {a.stars}/4 umbrales confirmados · fiabilidad {a.reliability !== null ? `${a.reliability}%` : '—'}
                      </Text>
                    </VStack>
                  </HStack>
                </Card>

                {/* criterio de derivación del cribado */}
                {needsReferral ? (
                  <Card bgColor="$warning50" borderRadius={18} borderWidth={1} borderColor="$warning200" p="$4">
                    <HStack space="sm" alignItems="flex-start">
                      <Icon as={AlertTriangle} size="sm" color="$warning600" style={{ marginTop: 2 }} />
                      <VStack style={{ flex: 1 }}>
                        <Text size="sm" weight="bold" color="$warning800">
                          Indicios de hipoacusia — derivar
                        </Text>
                        <Text size="xs" color="$warning800" style={{ lineHeight: 17 }}>
                          El cribado en campo libre sugiere una audición por debajo de lo esperado
                          {a.ptaCL !== null ? ` (PTA ${a.ptaCL} dB HL)` : ' (respuestas insuficientes)'}. Derive a un
                          centro especializado (ORL / audiología) para una audiometría diagnóstica con auriculares.
                        </Text>
                      </VStack>
                    </HStack>
                  </Card>
                ) : (
                  <Card bgColor="$primary0" borderRadius={18} borderWidth={1} borderColor="$primary100" p="$4">
                    <Text size="xs" color="$primary800" style={{ lineHeight: 17 }}>
                      Cribado dentro de la normalidad. Recuerde: el campo libre estima la audición del mejor oído y
                      no descarta una pérdida unilateral; ante dudas clínicas, derive igualmente a un centro
                      especializado.
                    </Text>
                  </Card>
                )}

                {/* audiograma */}
                <Card bgColor="$white" borderRadius={20} p="$4">
                  <HStack justifyContent="space-between" alignItems="center" mb="$2">
                    <Text size="sm" weight="bold" color="$textLight900">Audiograma de cribado</Text>
                    <Text size="2xs" style={{ color: '#0066B3' }}>Ⓢ Campo libre (binaural)</Text>
                  </HStack>
                  <Box h={250} borderRadius={12} borderWidth={1} borderColor="$borderLight100" bg="$backgroundLight50">
                    <Audiogram thresholds={a.thresholds} cursor={null} cursorColor="#0066B3" />
                  </Box>
                </Card>

                {/* umbrales + PTA + fiabilidad */}
                <Card bgColor="$white" borderRadius={20} p="$4">
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
                  <Text size="2xs" color="$textLight400" mt="$2" style={{ lineHeight: 15 }}>
                    Estimación binaural en campo libre (mejor oído), sin discriminación entre oído derecho e
                    izquierdo. Niveles orientativos sin calibración con equipo patrón.
                  </Text>
                </Card>

                {/* evaluador + guardar */}
                <Card bgColor="$white" borderRadius={20} p="$4">
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
                    isDisabled={isSaving || !evaluatorName.trim() || !evaluatorLicense.trim()}
                    isLoading={isSaving}
                    onPress={handleSave}>
                    <HStack space="sm" alignItems="center">
                      <Icon as={Save} size="sm" color="$white" />
                      <Text size="sm" weight="bold" color="$white">Guardar audiometría</Text>
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
