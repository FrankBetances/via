import React, { useEffect, useState } from 'react';
import { Pressable } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useDispatch, useSelector } from 'react-redux';
import { Box, Card, Center, HStack, Icon, Input, InputField, ScrollView, VStack } from '@gluestack-ui/themed';
import { Check, ChevronLeft, Play, RotateCcw, Save, Volume2, X } from 'lucide-react-native';

import { Button, Content, Header, Text } from '@/Components/Common';
import RadialBackground from '@/Components/Themed/RadialBackground';
import { RootStackParamList } from '@/Navigators';
import { AppDispatch, RootState } from '@/Store';
import { setSessionLanguage } from '@/Store/slices/localeSlice';
import { Evaluation } from '@/Models/Evaluation/Evaluation';
import { VerbalAudiometryTest } from '@/Models/VerbalAudiometry/VerbalAudiometryTest';
import { useClassSelector } from '@/Helpers/ClassTransformer';
import { useCreateVerbalAudiometryMutation } from '@/Services/local/modules/verbalAudiometry';
import { showErrorToast, showSuccessToast } from '@/Helpers/showToast';

import { useTelemetryTracker } from '@/Telemetry';
import { useVerbalAudiometryTest } from './useVerbalAudiometryTest';
import {
  AgeBand,
  LEVEL_LABEL,
  MAX_REPEATS,
  MODALITY_LABEL,
  PRESENTATION_LEVELS,
  VERBAL_LANG_LABEL,
  VerbalMode,
  interpretVerbal,
  verbalDiscriminationStatus,
} from './verbalAudiometryResult';
import { VERBAL_BANDS } from './verbalAudiometryLists';
import {
  resolveVerbalLang,
  VERBAL_BANK_LANGS,
  VERBAL_BANK_PROVISIONAL,
  VerbalLang,
} from './verbalAudiometryBanks';
import { verbalGlyphForLang, verbalImageSourceForLang } from './verbalAssetsByLang';
import WordCard, { WordCardState } from './components/WordCard';

type Props = NativeStackScreenProps<RootStackParamList, 'VerbalAudiometry'>;

/* -------------------------------------------------------------------------- */
/*  Pantalla de la Audiometría Verbal en TRES FASES:                           */
/*                                                                            */
/*   1. setup   — el profesional elige la banda de edad (y opciones            */
/*                avanzadas) y pulsa «Empezar». 30 segundos y fuera.           */
/*   2. play    — EL PACIENTE SOLO, en plan juego: la palabra SUENA SOLA al    */
/*                entrar en cada lámina, el niño toca la tarjeta y la          */
/*                pantalla avanza sola tras el feedback. Sin jerga clínica,    */
/*                sin botones de «presentar estímulo» ni «siguiente».          */
/*   3. results — hoja clínica: marcador, pasadas a otro nivel, evaluador y    */
/*                guardado.                                                    */
/*                                                                            */
/*  El modelo anterior (todo en una pantalla, con configuración, marcador y    */
/*  guardado siempre visibles y presentación/avance manuales) exigía la        */
/*  intervención del logopeda en cada lámina y era inviable para una prueba    */
/*  autónoma. El motor clínico (useVerbalAudiometryTest) no cambia.            */
/* -------------------------------------------------------------------------- */

type Phase = 'setup' | 'play' | 'results';

const MODE_META: { key: VerbalMode; label: string; hint: string }[] = [
  { key: 'discrimination', label: 'Discriminación', hint: '% aciertos a nivel fijo' },
  { key: 'threshold', label: 'Umbral · URV', hint: 'desciende hasta ≈50 %' },
];

/** Retardo de la auto-presentación del estímulo al entrar en una lámina. */
const AUTOPLAY_DELAY_MS = 900;
/** Tiempo de lectura del feedback antes de auto-avanzar (más si falló, para
 *  que vea la tarjeta correcta resaltada). */
const ADVANCE_OK_MS = 1300;
const ADVANCE_FAIL_MS = 2300;

const BAND_EMOJI: Record<AgeBand, string> = { A: '🧸', B: '🎈', C: '✏️', D: '📖' };

export default function VerbalAudiometryScreen({ navigation }: Props) {
  const activeEvaluation = useClassSelector(Evaluation, (state: RootState) => state.activeEvaluation.evaluation);
  const [createVerbalAudiometry, { isLoading: isSaving }] = useCreateVerbalAudiometryMutation();
  const dispatch = useDispatch<AppDispatch>();

  // Idioma/variante inicial = el elegido en el hub de sesión (T1.6), validado
  // contra los bancos registrados. El selector de esta pantalla actúa como
  // override y actualiza el idioma de sesión para el resto de la evaluación.
  const sessionLanguageRaw = useSelector((state: RootState) => state.locale.language);
  const sessionLang: VerbalLang = resolveVerbalLang(sessionLanguageRaw);
  const v = useVerbalAudiometryTest('A', sessionLang);
  const tracker = useTelemetryTracker(); // telemetría silenciosa (useRef, sin re-render)

  const [phase, setPhase] = useState<Phase>('setup');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [notes, setNotes] = useState('');
  const [evaluatorName, setEvaluatorName] = useState(activeEvaluation?.professional?.name ?? '');
  const [evaluatorLicense, setEvaluatorLicense] = useState(activeEvaluation?.professional?.licenseNumber ?? '');

  const patient = activeEvaluation?.patient;
  const patientName = patient ? `${patient.name} ${patient.lastName}`.trim() : null;

  const answered = v.chosen !== null;
  const scoredTotal = v.bandDef.items.filter(i => !i.practice).length;

  /* ----------------------- autonomía de la fase de juego -------------------- */

  // La palabra SUENA SOLA al entrar en cada lámina (el niño no tiene que
  // pulsar nada para oír el estímulo; las tarjetas se habilitan al sonar).
  useEffect(() => {
    if (phase !== 'play' || !v.item || v.played || v.completedForLevel) return;
    const t = setTimeout(() => v.playStimulus(), AUTOPLAY_DELAY_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, v.item, v.played, v.completedForLevel]);

  // Tras responder, la pantalla avanza sola después del feedback.
  useEffect(() => {
    if (phase !== 'play' || !answered) return;
    const t = setTimeout(() => v.next(), v.wasCorrect ? ADVANCE_OK_MS : ADVANCE_FAIL_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, answered, v.wasCorrect]);

  // Lista completada → hoja de resultados (el clínico retoma el control).
  useEffect(() => {
    if (phase !== 'play' || !v.completedForLevel) return;
    const t = setTimeout(() => setPhase('results'), 900);
    return () => clearTimeout(t);
  }, [phase, v.completedForLevel]);

  // Al salir de la fase de juego, parar cualquier estímulo en curso.
  useEffect(() => {
    if (phase !== 'play') v.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // Telemetría: cada lámina (nivel dB + índice) es un reactivo; abre su
  // ventana de tiempo al mostrarse.
  useEffect(() => {
    if (phase === 'play' && v.item) tracker.enterReactivo(`ver-${v.level}-${v.itemIndex}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, v.level, v.itemIndex, v.item]);

  /* ------------------------------- acciones -------------------------------- */

  const startRun = (level?: number) => {
    if (level !== undefined && level !== v.level) {
      v.setLevel(level); // ya reinicia la pasada
    } else if (v.completedForLevel || v.itemIndex > 0) {
      v.resetRun(); // repetir al mismo nivel: reinicia el índice de lámina
    }
    setPhase('play');
  };

  const exitRun = () => {
    v.stop();
    setPhase(v.score.presentedCount > 0 ? 'results' : 'setup');
  };

  const restartAll = () => {
    v.reset();
    setPhase('setup');
  };

  const handleSave = async () => {
    if (isSaving) return;
    if (!evaluatorName.trim() || !evaluatorLicense.trim() || v.score.presentedCount === 0) return;
    if (!activeEvaluation) {
      showErrorToast('No se puede guardar', 'No hay una evaluación activa asociada al paciente.');
      return;
    }
    try {
      const item = new VerbalAudiometryTest();
      item.transducer = 'soundfield';
      item.ageBand = v.band;
      item.language = v.lang;
      item.modality = v.modality;
      item.mode = v.mode;
      item.results = v.results;
      item.levelScores = v.score.levelScores;
      item.srtDb = v.srtDb;
      item.presentedCount = v.score.presentedCount;
      item.correctCount = v.score.correctCount;
      item.discriminationPct = v.score.discriminationPct;
      item.reliability = v.reliability;
      item.interpretation = interpretVerbal(v.band, v.score, v.srtDb, v.lang);
      item.notes = [notes.trim(), v.audioEngine === 'tts' ? 'Dictado por síntesis de voz nativa del dispositivo (TTS): nivel relativo, sin calibración absoluta.' : '']
        .filter(Boolean)
        .join(' ');
      item.evaluatorName = evaluatorName.trim();
      item.evaluatorLicense = evaluatorLicense.trim();
      item.completedAt = new Date();
      item.evaluation = { id: activeEvaluation.id } as Evaluation;

      await createVerbalAudiometry(item);
      showSuccessToast('Audiometría verbal guardada', `Discriminación ${v.score.discriminationPct}% a ${v.level} dB.`);
      navigation.goBack();
    } catch {
      showErrorToast('Error al guardar', 'No se pudo registrar la audiometría verbal. Inténtelo de nuevo.');
    }
  };

  /* --------------------------- piezas de render ---------------------------- */

  /** Estado visual de una tarjeta según la fase de la lámina. */
  const cardStateOf = (word: string): WordCardState => {
    if (!v.played) return 'disabled'; // atenuadas hasta que suene la palabra
    if (!answered) return 'idle';
    if (word === v.chosen) return v.wasCorrect ? 'correct' : 'wrong';
    if (!v.wasCorrect && v.item && word === v.item.targetWord) return 'revealTarget';
    return 'disabled';
  };

  const pctStatus = verbalDiscriminationStatus(v.score.discriminationPct);
  const pctColor = pctStatus === 'ok' ? '$success600' : pctStatus === 'warn' ? '$warning600' : '$error600';
  const cardWidth = v.bandDef.optionsPerCard === 4 ? '48.5%' : '31.5%';

  /* ------------------------------ fase: setup ------------------------------ */

  const renderSetup = () => (
    <VStack flex={1} px="$6" mt="$2" space="md" pb="$10">
      <VStack>
        <HStack alignItems="center" space="sm">
          <Text size="2xl" weight="bold" color="$textLight900">
            Audiometría verbal
          </Text>
          <Box bg="$primary50" px="$2" py="$0.5" borderRadius="$full">
            <Text size="2xs" weight="bold" color="$primary800" style={{ letterSpacing: 0.4 }}>
              CAMPO LIBRE · SIN AUDÍFONOS
            </Text>
          </Box>
        </HStack>
        <Text size="xs" color="$textLight500">
          {patientName ?? 'Reconocimiento de palabras por selección de tarjetas'}
        </Text>
      </VStack>

      <Card bgColor="$white" borderRadius={20} p="$4">
        <Text size="sm" color="$textLight700" style={{ lineHeight: 20 }}>
          El paciente hace la prueba <Text size="sm" weight="bold" color="$textLight900">solo, como un juego</Text>:
          suena una palabra por el altavoz y toca la tarjeta correspondiente. La palabra suena
          sola en cada lámina y la pantalla avanza sola tras cada respuesta.
        </Text>
      </Card>

      {/* selección de banda de edad */}
      <Card bgColor="$white" borderRadius={20} p="$4">
        <Text size="md" weight="bold" color="$textLight900" mb="$3">
          ¿Qué edad tiene el paciente?
        </Text>
        <VStack space="sm">
          {VERBAL_BANDS.map(b => {
            const on = v.band === b.band;
            return (
              <Pressable key={b.band} onPress={() => v.setBand(b.band as AgeBand)}>
                <HStack
                  alignItems="center"
                  space="md"
                  p="$3.5"
                  borderRadius={16}
                  borderWidth={2}
                  borderColor={on ? '$primary500' : '$borderLight200'}
                  bg={on ? '$primary0' : '$white'}>
                  <Center w={48} h={48} borderRadius={14} bg={on ? '$primary50' : '$backgroundLight50'}>
                    <Text style={{ fontSize: 26, lineHeight: 34 }}>{BAND_EMOJI[b.band as AgeBand]}</Text>
                  </Center>
                  <VStack style={{ flex: 1 }}>
                    <Text size="md" weight="bold" color="$textLight900">
                      {b.ages}
                    </Text>
                    <Text size="xs" color="$textLight500">
                      {b.label} · {MODALITY_LABEL[b.modality]} · {b.optionsPerCard} tarjetas
                    </Text>
                  </VStack>
                  <Box
                    w={22}
                    h={22}
                    borderRadius="$full"
                    borderWidth={2}
                    borderColor={on ? '$primary600' : '$borderLight300'}
                    alignItems="center"
                    justifyContent="center">
                    {on ? <Box w={11} h={11} borderRadius="$full" bg="$primary600" /> : null}
                  </Box>
                </HStack>
              </Pressable>
            );
          })}
        </VStack>
      </Card>

      {/* idioma/variante de la sesión (banco de estímulos + voz) */}
      <Card bgColor="$white" borderRadius={20} p="$4">
        <Text size="md" weight="bold" color="$textLight900" mb="$3">
          Lengua de la prueba
        </Text>
        <HStack space="sm">
          {VERBAL_BANK_LANGS.map(l => {
            const on = v.lang === l;
            return (
              <Pressable
                key={l}
                style={{ flex: 1 }}
                onPress={() => {
                  v.setLang(l);
                  dispatch(setSessionLanguage(l)); // el override rige el resto de la sesión
                }}>
                <Center
                  py="$2.5"
                  px="$2"
                  borderRadius={12}
                  bg={on ? '$primary500' : '$white'}
                  borderWidth={1.5}
                  borderColor={on ? 'transparent' : '$borderLight200'}>
                  <Text size="xs" weight="bold" color={on ? '$white' : '$textLight600'} style={{ textAlign: 'center' }}>
                    {VERBAL_LANG_LABEL[l] ?? l}
                  </Text>
                </Center>
              </Pressable>
            );
          })}
        </HStack>
        {v.lang !== 'es' ? (
          <Text size="2xs" color="$textLight400" mt="$2">
            Banco de estímulos y locuciones propios de la lengua; queda registrado en el informe.
          </Text>
        ) : null}
        {VERBAL_BANK_PROVISIONAL.includes(v.lang) ? (
          <HStack space="xs" alignItems="flex-start" mt="$2" p="$2.5" borderRadius={12} bg="$warning50">
            <Text size="2xs" color="$warning800" style={{ flex: 1, lineHeight: 15 }}>
              Banco PROVISIONAL, pendiente de la validación clínica del logopeda gallego-hablante. Todavía sin
              locuciones propias: las palabras se dictan con la voz del sistema, así que el nivel es aún menos
              comparable que en castellano. Uso en pilotos técnicos, no diagnóstico.
            </Text>
          </HStack>
        ) : null}
      </Card>

      {/* opciones avanzadas (modo y nivel), plegadas por defecto */}
      <Card bgColor="$white" borderRadius={20} p="$4">
        <Pressable onPress={() => setShowAdvanced(s => !s)}>
          <HStack alignItems="center" justifyContent="space-between">
            <Text size="sm" weight="bold" color="$textLight700">
              Opciones avanzadas
            </Text>
            <Text size="xs" color="$textLight400">
              {showAdvanced ? 'ocultar' : `${MODE_META.find(m => m.key === v.mode)?.label} · ${v.level} dB`}
            </Text>
          </HStack>
        </Pressable>
        {showAdvanced ? (
          <VStack mt="$3">
            <Text size="xs" weight="semiBold" color="$textLight600" mb="$1">
              Modo
            </Text>
            <HStack space="sm" mb="$3">
              {MODE_META.map(m => {
                const on = v.mode === m.key;
                return (
                  <Pressable key={m.key} style={{ flex: 1 }} onPress={() => v.setMode(m.key)}>
                    <Center py="$2" borderRadius={10} bg={on ? '$primary500' : '$white'} borderWidth={1.5} borderColor={on ? 'transparent' : '$borderLight200'}>
                      <Text size="xs" weight="bold" color={on ? '$white' : '$textLight500'}>{m.label}</Text>
                      <Text size="2xs" color={on ? '$primary100' : '$textLight400'}>{m.hint}</Text>
                    </Center>
                  </Pressable>
                );
              })}
            </HStack>
            <Text size="xs" weight="semiBold" color="$textLight600" mb="$1">
              Nivel de presentación
            </Text>
            <HStack space="sm">
              {PRESENTATION_LEVELS.map(l => {
                const on = v.level === l;
                return (
                  <Pressable key={l} style={{ flex: 1 }} onPress={() => v.setLevel(l)}>
                    <Center py="$2" borderRadius={10} bg={on ? '$primary500' : '$white'} borderWidth={1.5} borderColor={on ? 'transparent' : '$borderLight200'}>
                      <Text size="xs" weight="bold" color={on ? '$white' : '$textLight500'} style={{ fontVariant: ['tabular-nums'] }}>
                        {l} dB
                      </Text>
                      <Text size="2xs" color={on ? '$primary100' : '$textLight400'}>{LEVEL_LABEL[l]}</Text>
                    </Center>
                  </Pressable>
                );
              })}
            </HStack>
          </VStack>
        ) : null}
      </Card>

      <Box bg="$warning50" borderRadius={12} p="$2.5">
        <Text size="2xs" color="$warning800" style={{ lineHeight: 15 }}>
          ⚠️ Nivel orientativo: la presentación por altavoz no está calibrada clínicamente. La salida
          robusta es el % de discriminación a voz conversacional. Resultado binaural (mejor oído): no
          descarta pérdida unilateral.
          {!v.hasAudio ? ' Motor de audio no disponible: modo demostración (presente el modelo con su voz).' : ''}
        </Text>
      </Box>

      <Button action="primary" variant="solid" rounded="$full" onPress={() => startRun()}>
        <HStack space="sm" alignItems="center">
          <Icon as={Play} size="sm" color="$white" />
          <Text size="md" weight="bold" color="$white">
            Empezar la prueba
          </Text>
        </HStack>
      </Button>
      {v.score.presentedCount > 0 ? (
        <Button action="secondary" variant="outline" rounded="$full" onPress={() => setPhase('results')}>
          <Text size="sm" weight="bold" color="$primary500">
            Ver resultados
          </Text>
        </Button>
      ) : null}
    </VStack>
  );

  /* ------------------------------ fase: play ------------------------------- */

  const renderPlay = () => {
    const total = v.itemTotal;
    const feedback = !answered
      ? null
      : v.wasCorrect
        ? { text: '¡Muy bien! 🎉', color: '$success700', bg: '$success50' }
        : { text: `Era «${v.item?.targetWord}» 💙`, color: '$primary800', bg: '$primary0' };

    return (
      <VStack flex={1} px="$5" mt="$2" space="md" pb="$8">
        {/* barra superior mínima: salir (clínico) + progreso */}
        <HStack alignItems="center" space="sm">
          <Pressable onPress={exitRun} hitSlop={10}>
            <Center w={38} h={38} borderRadius="$full" bg="$white" borderWidth={1} borderColor="$borderLight200">
              <Icon as={X} size="sm" color="$textLight500" />
            </Center>
          </Pressable>
          <HStack style={{ flex: 1 }} justifyContent="center" space="xs">
            {Array.from({ length: total }).map((_, i) => (
              <Text key={i} style={{ fontSize: 15, lineHeight: 20 }}>
                {i < v.itemIndex ? '⭐' : i === v.itemIndex ? '🔵' : '⚪'}
              </Text>
            ))}
          </HStack>
          <Box w={38} />
        </HStack>

        {v.isPractice ? (
          <Center bg="$primary0" borderRadius={14} py="$2">
            <Text size="sm" weight="bold" color="$primary800">
              🎈 Vamos a practicar
            </Text>
          </Center>
        ) : null}

        {/* estímulo: suena solo; el botón grande repite (ayuda contada) */}
        <Card bgColor="$white" borderRadius={24} p="$5">
          <Center>
            <Pressable onPress={v.repeatStimulus} disabled={!v.canRepeat}>
              <Center
                w={96}
                h={96}
                borderRadius="$full"
                bg={v.playing ? '$warning100' : v.canRepeat ? '$primary500' : '$backgroundLight100'}>
                <Icon as={Volume2} size="xl" color={v.playing ? '$warning700' : v.canRepeat ? '$white' : '$textLight300'} />
              </Center>
            </Pressable>
            <Text size="md" weight="bold" color="$textLight900" mt="$3">
              {v.playing ? 'Escucha…' : !v.played ? 'Atento, va a sonar una palabra' : answered ? '' : '¿Cuál has oído? Toca su tarjeta'}
            </Text>
            {v.played && !answered ? (
              <Text size="2xs" color="$textLight400" mt="$1">
                Toca el altavoz para oírla otra vez ({MAX_REPEATS - v.repeats} restantes)
              </Text>
            ) : null}
          </Center>
        </Card>

        {/* tarjetas */}
        <HStack flexWrap="wrap" justifyContent="space-between" style={{ rowGap: 10 }}>
          {v.options.map(opt => (
            <Box key={opt.word} style={{ width: cardWidth, marginBottom: 2 }}>
              <WordCard
                word={opt.word}
                imageSource={opt.image ? verbalImageSourceForLang(opt.image, v.lang) : undefined}
                glyph={verbalGlyphForLang(opt.word, v.lang)}
                modality={v.modality}
                state={cardStateOf(opt.word)}
                size={v.band === 'D' ? 'md' : 'lg'}
                onPress={() => {
                  // Telemetría: 1ª elección fija el tiempo; el motor ignora
                  // toques posteriores, así que no contamos rectificaciones.
                  if (v.chosen === null) tracker.classifyReactivo(`ver-${v.level}-${v.itemIndex}`);
                  v.choose(opt.word);
                }}
              />
            </Box>
          ))}
        </HStack>

        {/* feedback grande y amable; la pantalla avanza sola */}
        {feedback ? (
          <Center bg={feedback.bg} borderRadius={16} py="$3">
            <Text size="lg" weight="bold" color={feedback.color}>
              {feedback.text}
            </Text>
          </Center>
        ) : null}
        {v.completedForLevel ? (
          <Center bg="$success50" borderRadius={16} py="$4">
            <Text size="lg" weight="bold" color="$success700">
              🏁 ¡Juego terminado, muy bien!
            </Text>
          </Center>
        ) : null}
      </VStack>
    );
  };

  /* ----------------------------- fase: results ----------------------------- */

  const renderResults = () => (
    <VStack flex={1} px="$6" mt="$2" space="md" pb="$10">
      <HStack alignItems="center" space="sm">
        <Pressable onPress={() => setPhase('setup')} hitSlop={10}>
          <Center w={38} h={38} borderRadius="$full" bg="$white" borderWidth={1} borderColor="$borderLight200">
            <Icon as={ChevronLeft} size="sm" color="$textLight500" />
          </Center>
        </Pressable>
        <VStack style={{ flex: 1 }}>
          <Text size="2xl" weight="bold" color="$textLight900">
            Resultados
          </Text>
          <Text size="xs" color="$textLight500">
            {patientName ?? 'Audiometría verbal'} · Banda {v.band}
          </Text>
        </VStack>
        <HStack space="xs" alignItems="center" bg="$white" borderRadius="$full" px="$3" py="$1.5" borderWidth={1} borderColor="$borderLight100">
          <Text size="sm">⭐</Text>
          <Text size="sm" weight="bold" color="$primary600">
            {v.score.correctCount}/{scoredTotal}
          </Text>
        </HStack>
      </HStack>

      {/* marcador */}
      <Card bgColor="$white" borderRadius={20} p="$4">
        <Text size="sm" weight="bold" color="$textLight900" mb="$2">
          Marcador de la prueba
        </Text>
        <HStack space="sm">
          <Box flex={1} bg="$backgroundLight50" borderRadius={12} p="$2.5" alignItems="center">
            <Text size="2xs" color="$textLight400">DISCRIMINACIÓN</Text>
            <Text size="lg" weight="bold" color={v.score.presentedCount ? pctColor : '$textLight400'}>
              {v.score.presentedCount ? `${v.score.discriminationPct}%` : '—'}
            </Text>
            <Text size="2xs" color="$textLight500">{v.level} dB · {LEVEL_LABEL[v.level] ?? ''}</Text>
          </Box>
          <Box flex={1} bg="$backgroundLight50" borderRadius={12} p="$2.5" alignItems="center">
            <Text size="2xs" color="$textLight400">ACIERTOS</Text>
            <Text size="lg" weight="bold" color="$textLight700" style={{ fontVariant: ['tabular-nums'] }}>
              {v.score.correctCount}/{v.score.presentedCount}
            </Text>
            <Text size="2xs" color="$textLight500">láminas respondidas</Text>
          </Box>
          <Box flex={1} bg="$backgroundLight50" borderRadius={12} p="$2.5" alignItems="center">
            <Text size="2xs" color="$textLight400">FIABILIDAD</Text>
            <Text size="lg" weight="bold" color={v.reliability === null ? '$textLight400' : v.reliability >= 80 ? '$success600' : '$warning600'}>
              {v.reliability !== null ? `${v.reliability}%` : '—'}
            </Text>
            <Text size="2xs" color="$textLight500">repeticiones de ayuda</Text>
          </Box>
        </HStack>

        {v.score.levelScores.length > 0 ? (
          <VStack space="xs" mt="$3">
            {v.score.levelScores.map(ls => {
              const st = verbalDiscriminationStatus(ls.pct);
              const color = st === 'ok' ? '$success600' : st === 'warn' ? '$warning600' : '$error600';
              return (
                <HStack key={ls.level} alignItems="center" justifyContent="space-between">
                  <Text size="xs" color="$textLight500">
                    {ls.level} dB · {LEVEL_LABEL[ls.level] ?? 'nivel'}
                  </Text>
                  <Text size="xs" weight="bold" color={color} style={{ fontVariant: ['tabular-nums'] }}>
                    {ls.pct} % ({ls.correct}/{ls.presented})
                  </Text>
                </HStack>
              );
            })}
            {v.srtDb !== null ? (
              <HStack alignItems="center" justifyContent="space-between">
                <Text size="xs" color="$textLight500">URV estimado</Text>
                <Text size="xs" weight="bold" color="$textLight700" style={{ fontVariant: ['tabular-nums'] }}>
                  ≈ {v.srtDb} dB
                </Text>
              </HStack>
            ) : null}
          </VStack>
        ) : null}
      </Card>

      {/* otra pasada / reiniciar */}
      <Card bgColor="$white" borderRadius={20} p="$4">
        <Text size="sm" weight="bold" color="$textLight900" mb="$2">
          Más pasadas
        </Text>
        <Text size="2xs" color="$textLight500" mb="$3">
          Los resultados por nivel se conservan: puede repetir la lista a otro nivel (p. ej. voz baja)
          para el modo umbral.
        </Text>
        <HStack space="sm" flexWrap="wrap" style={{ gap: 6 }}>
          {PRESENTATION_LEVELS.map(l => (
            <Button key={l} action="secondary" variant="outline" rounded="$full" onPress={() => startRun(l)}>
              <Text size="sm" weight="bold" color="$primary500">
                ▶ Pasada a {l} dB
              </Text>
            </Button>
          ))}
          <Button action="secondary" variant="outline" rounded="$full" onPress={restartAll}>
            <HStack space="xs" alignItems="center">
              <Icon as={RotateCcw} size="xs" color="$textLight500" />
              <Text size="sm" weight="bold" color="$textLight500">
                Nueva prueba
              </Text>
            </HStack>
          </Button>
        </HStack>
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
          isDisabled={isSaving || !evaluatorName.trim() || !evaluatorLicense.trim() || v.score.presentedCount === 0}
          isLoading={isSaving}
          onPress={handleSave}>
          <HStack space="sm" alignItems="center">
            <Icon as={Save} size="sm" color="$white" />
            <Text size="sm" weight="bold" color="$white">Guardar audiometría verbal</Text>
          </HStack>
        </Button>
        <HStack space="xs" alignItems="center" justifyContent="center" mt="$2">
          <Icon as={Check} size="2xs" color="$textLight400" />
          <Text size="2xs" color="$textLight400" style={{ textAlign: 'center' }}>
            Medida orientativa sobre el dispositivo. No sustituye equipo certificado ni constituye diagnóstico.
          </Text>
        </HStack>
      </Card>
    </VStack>
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
        <ScrollView showsVerticalScrollIndicator={false}>
          {phase === 'setup' ? renderSetup() : phase === 'play' ? renderPlay() : renderResults()}
        </ScrollView>
      </VStack>
    </Content>
  );
}
