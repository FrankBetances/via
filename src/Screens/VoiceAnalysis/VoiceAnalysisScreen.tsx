import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import Svg, { Ellipse, Line, Circle, Text as SvgText } from 'react-native-svg';
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
  Spinner,
  VStack,
} from '@gluestack-ui/themed';
import {
  Activity,
  AlertTriangle,
  AudioWaveform,
  Mic,
  Play,
  RotateCcw,
  Save,
  Square,
  Trash2,
} from 'lucide-react-native';

import { Button, Content, Header, SignaturePad, Text } from '@/Components/Common';
import RadialBackground from '@/Components/Themed/RadialBackground';
import { RootStackParamList } from '@/Navigators';
import { RootState } from '@/Store';
import { Evaluation } from '@/Models/Evaluation/Evaluation';
import { GrbasScores, VoiceAnalysis } from '@/Models/VoiceAnalysis/VoiceAnalysis';
import { useClassSelector } from '@/Helpers/ClassTransformer';
import { useTelemetryTracker } from '@/Telemetry';
import { useCreateVoiceAnalysisMutation } from '@/Services/local/modules/voiceAnalysis';
import { showErrorToast, showSuccessToast } from '@/Helpers/showToast';
import { useVoiceAnalysis, VoiceTake } from './useVoiceAnalysis';
import { registerVoiceMicAdapter, unregisterVoiceMicAdapter } from './voiceMicAdapter';
import {
  buildInterpretation,
  GRBAS_DIMENSIONS,
  GRBAS_SCORE_LABELS,
  grbasSeverityLabel,
  grbasSummary,
  statusColor,
  statusF0,
  statusHnr,
  statusJitter,
  statusLabel,
  statusShimmer,
} from './voiceAnalysisResult';

type Props = NativeStackScreenProps<RootStackParamList, 'VoiceAnalysis'>;

/* ------------------------- Espacio vocálico (F1×F2) ----------------------- */

const VowelSpace = ({ f1, f2 }: { f1: number | null; f2: number | null }) => {
  const W = 300;
  const H = 150;
  const f2x = (v: number) => 18 + ((2400 - v) / (2400 - 700)) * (W - 30);
  const f1y = (v: number) => 14 + ((v - 200) / (1000 - 200)) * (H - 34);
  const zones = [
    { v: '/i/', f1: 300, f2: 2300, c: '#C7D2FE' },
    { v: '/a/', f1: 850, f2: 1400, c: '#FFE3C2' },
    { v: '/u/', f1: 350, f2: 900, c: '#BBF7D0' },
  ];
  return (
    <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
      {[0, 1, 2, 3].map(i => (
        <Line key={`v${i}`} x1={18 + (i * (W - 30)) / 3} y1={12} x2={18 + (i * (W - 30)) / 3} y2={H - 18} stroke="#ECE5D8" strokeWidth={1} />
      ))}
      {[0, 1, 2, 3].map(i => (
        <Line key={`h${i}`} x1={18} y1={14 + (i * (H - 34)) / 3} x2={W - 12} y2={14 + (i * (H - 34)) / 3} stroke="#ECE5D8" strokeWidth={1} />
      ))}
      {zones.map(z => (
        <React.Fragment key={z.v}>
          <Ellipse cx={f2x(z.f2)} cy={f1y(z.f1)} rx={32} ry={24} fill={z.c} opacity={0.85} />
          <SvgText x={f2x(z.f2)} y={f1y(z.f1) + 3} fontSize={10} fill="#7A746B" textAnchor="middle">
            {z.v}
          </SvgText>
        </React.Fragment>
      ))}
      {f1 !== null && f2 !== null ? (
        <>
          <Circle cx={f2x(f2)} cy={f1y(f1)} r={11} fill="none" stroke="#FF7F00" strokeOpacity={0.35} strokeWidth={2} />
          <Circle cx={f2x(f2)} cy={f1y(f1)} r={6} fill="#FF7F00" stroke="#fff" strokeWidth={2} />
        </>
      ) : null}
    </Svg>
  );
};

/* ------------------------------ escala GRBAS ------------------------------ */

type GrbasDraft = Record<keyof GrbasScores, number | null>;

const EMPTY_GRBAS: GrbasDraft = { g: null, r: null, b: null, a: null, s: null };

const grbasComplete = (d: GrbasDraft): d is Record<keyof GrbasScores, number> =>
  GRBAS_DIMENSIONS.every(dim => d[dim.key] !== null);

/* --------------------------------- Pantalla -------------------------------- */

export default function VoiceAnalysisScreen({ navigation }: Props) {
  const activeEvaluation = useClassSelector(Evaluation, (state: RootState) => state.activeEvaluation.evaluation);
  const [createVoiceAnalysis, { isLoading: isSaving }] = useCreateVoiceAnalysisMutation();
  const voice = useVoiceAnalysis();
  const tracker = useTelemetryTracker(); // telemetría silenciosa (useRef, sin re-render)

  // Registra el motor de captura real (react-native-audio-api) y lo libera al
  // salir: sin la baja quedaban abiertos el recorder, la referencia al contexto
  // de audio compartido y la sesión en modo grabación, que en iOS atenúa la
  // salida del resto de módulos.
  useEffect(() => {
    registerVoiceMicAdapter();
    return () => unregisterVoiceMicAdapter();
  }, []);

  // Telemetría: reactivo de captura (la vocal sostenida /a/). Reanalizar o
  // grabar tomas extra cuenta como rectificación.
  useEffect(() => {
    tracker.enterReactivo('voz-rec');
  }, [tracker]);

  // Telemetría: las 5 dimensiones GRBAS son reactivos perceptuales; abren su
  // ventana en cuanto hay tomas que valorar.
  useEffect(() => {
    if (voice.takes.length > 0) {
      GRBAS_DIMENSIONS.forEach(dim => tracker.enterReactivo(`voz-${dim.key}`));
    }
  }, [voice.takes.length, tracker]);

  const [notes, setNotes] = useState('');
  const [grbas, setGrbas] = useState<GrbasDraft>(EMPTY_GRBAS);
  const [evaluatorName, setEvaluatorName] = useState(activeEvaluation?.professional?.name ?? '');
  const [evaluatorLicense, setEvaluatorLicense] = useState(activeEvaluation?.professional?.licenseNumber ?? '');
  const [signaturePaths, setSignaturePaths] = useState<string[]>([]);
  // El pad de firma congela el scroll mientras se traza (si no, el gesto
  // desplaza la pantalla en lugar de firmar).
  const [scrollEnabled, setScrollEnabled] = useState(true);

  const patient = activeEvaluation?.patient;
  const patientName = patient ? `${patient.name} ${patient.lastName}`.trim() : null;
  const r = voice.result;

  const interpretation = useMemo(() => (r ? buildInterpretation(r) : ''), [r]);
  const grbasScores: GrbasScores | null = grbasComplete(grbas) ? { ...grbas } : null;
  const analyzedTake = voice.takes.find(t => t.id === voice.analyzedTakeId) ?? null;
  const selectedTake = voice.takes.find(t => t.id === voice.selectedTakeId) ?? null;

  /** Cierre MANUAL: sin resultado acústico pero con tomas grabadas y la
   *  valoración perceptual GRBAS completa. La prueba queda registrada con la
   *  firma del explorador como constancia aunque el análisis no funcionara. */
  const canCloseManually = !r && voice.takes.length > 0 && !!grbasScores;
  const canSave = !!r || canCloseManually;
  /** Para el cierre manual la firma es obligatoria (es la constancia). */
  const signatureMissing = !r && signaturePaths.length === 0;

  const setGrbasScore = (key: keyof GrbasScores, value: number) => {
    // Telemetría: 1ª puntuación fija el tiempo; re-puntuar = rectificación
    // (incertidumbre perceptual del explorador).
    tracker.classifyReactivo(`voz-${key}`);
    setGrbas(prev => ({ ...prev, [key]: prev[key] === value ? null : value }));
  };

  const ParamCard = ({
    label,
    value,
    norm,
    status,
  }: {
    label: string;
    value: string;
    norm: string;
    status: 'normal' | 'borderline' | 'altered';
  }) => (
    <Card bgColor="$backgroundLight50" borderRadius={16} borderWidth={1} borderColor="$borderLight100" p="$3" style={{ flex: 1 }}>
      <HStack justifyContent="space-between" alignItems="flex-start">
        <Text size="2xs" color="$textLight500" style={{ letterSpacing: 0.3 }}>
          {label}
        </Text>
        <Box px="$2" py="$0.5" borderRadius="$full" bg={status === 'normal' ? '$success50' : status === 'borderline' ? '$warning50' : '$error50'}>
          <Text size="2xs" weight="bold" color={statusColor(status)}>
            {statusLabel(status)}
          </Text>
        </Box>
      </HStack>
      <Text size="2xl" weight="bold" color="$textLight900" mt="$1" style={{ fontVariant: ['tabular-nums'] }}>
        {value}
      </Text>
      <Text size="2xs" color="$textLight400" mt="$0.5">
        {norm}
      </Text>
    </Card>
  );

  const TakeRow = ({ take, index }: { take: VoiceTake; index: number }) => {
    const isSelected = take.id === voice.selectedTakeId;
    const isPlaying = take.id === voice.playingTakeId;
    const isAnalyzed = take.id === voice.analyzedTakeId;
    const time = take.recordedAt.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    return (
      <Pressable onPress={() => voice.selectTake(take.id)} disabled={voice.isAnalyzing}>
        <HStack
          alignItems="center"
          space="sm"
          p="$3"
          borderRadius={14}
          borderWidth={1.5}
          borderColor={isSelected ? '$primary400' : '$borderLight100'}
          bg={isSelected ? '$primary0' : '$backgroundLight50'}>
          {/* marcador de selección */}
          <Box
            w={18}
            h={18}
            borderRadius="$full"
            borderWidth={2}
            borderColor={isSelected ? '$primary600' : '$borderLight300'}
            alignItems="center"
            justifyContent="center">
            {isSelected ? <Box w={9} h={9} borderRadius="$full" bg="$primary600" /> : null}
          </Box>

          <VStack style={{ flex: 1 }}>
            <HStack alignItems="center" space="xs">
              <Text size="sm" weight="bold" color="$textLight900">
                Toma {index + 1}
              </Text>
              {isAnalyzed ? (
                <Box bg="$success50" px="$1.5" py="$0.5" borderRadius="$full">
                  <Text size="2xs" weight="bold" color="$success600">
                    ANALIZADA
                  </Text>
                </Box>
              ) : null}
            </HStack>
            <Text size="2xs" color="$textLight500">
              {take.durationSec.toFixed(1)} s · {time}
            </Text>
          </VStack>

          {/* reproducir / parar */}
          <Pressable
            onPress={() => voice.playTake(take.id)}
            disabled={voice.isRecording || voice.isAnalyzing}
            hitSlop={8}>
            <Center w={36} h={36} borderRadius="$full" bg={isPlaying ? '$error50' : '$primary50'}>
              <Icon as={isPlaying ? Square : Play} size="sm" color={isPlaying ? '$error600' : '$primary600'} />
            </Center>
          </Pressable>

          {/* eliminar */}
          <Pressable
            onPress={() => voice.deleteTake(take.id)}
            disabled={voice.isRecording || voice.isAnalyzing}
            hitSlop={8}>
            <Center w={36} h={36} borderRadius="$full" bg="$backgroundLight100">
              <Icon as={Trash2} size="sm" color="$textLight400" />
            </Center>
          </Pressable>
        </HStack>
      </Pressable>
    );
  };

  const handleSave = async () => {
    if (!canSave || isSaving) return;
    if (!evaluatorName.trim() || !evaluatorLicense.trim() || signatureMissing) return;
    if (!activeEvaluation) {
      showErrorToast('No se puede guardar', 'No hay una evaluación activa asociada al paciente.');
      return;
    }
    try {
      const item = new VoiceAnalysis();
      item.vowel = 'a';
      item.source = voice.source;
      item.durationSec = (analyzedTake ?? selectedTake)?.durationSec ?? 5;
      item.quality = r?.quality ?? 'low';
      item.f0 = r?.f0 ?? null;
      item.jitter = r?.jitter ?? null;
      item.shimmer = r?.shimmer ?? null;
      item.hnr = r?.hnr ?? null;
      item.formants = r?.formants ?? null;
      item.grbas = grbasScores;
      const baseInterpretation = r
        ? interpretation
        : 'Análisis acústico no disponible (captura insuficiente); prueba cerrada manualmente por el explorador tras la escucha de las tomas.';
      item.interpretation = grbasScores
        ? `${baseInterpretation} Valoración perceptual GRBAS: ${grbasSummary(grbasScores)} (${grbasSeverityLabel(grbasScores).toLowerCase()}).`
        : baseInterpretation;
      item.notes = notes.trim();
      item.evaluatorName = evaluatorName.trim();
      item.evaluatorLicense = evaluatorLicense.trim();
      item.evaluatorSignatureSvg = signaturePaths.length ? signaturePaths.join(' ') : null;
      item.completedAt = new Date();
      item.evaluation = { id: activeEvaluation.id } as Evaluation;

      await createVoiceAnalysis(item);
      showSuccessToast(
        r ? 'Análisis guardado' : 'Prueba registrada',
        r
          ? `F0 ${r.f0} Hz · HNR ${r.hnr} dB · Jitter ${r.jitter}%.`
          : `Cierre manual con valoración GRBAS firmado por ${evaluatorName.trim()}.`,
      );
      navigation.goBack();
    } catch {
      showErrorToast('Error al guardar', 'No se pudo registrar el análisis. Inténtelo de nuevo.');
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
      <VStack flex={1}>
        <Header animationType="expand" />

        <ScrollView showsVerticalScrollIndicator={false} scrollEnabled={scrollEnabled}>
          <VStack flex={1} px="$6" mt="$2" space="md" pb="$10">
            {/* título */}
            <VStack>
              <HStack alignItems="center" space="sm">
                <Text size="2xl" weight="bold" color="$textLight900">
                  Análisis acústico de voz
                </Text>
                <Box bg="$primary50" px="$2" py="$0.5" borderRadius="$full">
                  <Text size="2xs" weight="bold" color="$primary800" style={{ letterSpacing: 0.4 }}>
                    ESPECTROGRAFÍA
                  </Text>
                </Box>
              </HStack>
              <Text size="xs" color="$textLight500">
                {patientName ?? 'Vocal /a/ sostenida · 5 s · F0 · Jitter · Shimmer · HNR'}
              </Text>
            </VStack>

            {/* captura */}
            <Card bgColor="$white" borderRadius={22} p="$5">
              <HStack alignItems="center" space="sm" mb="$3">
                <Center w={40} h={40} borderRadius={12} bg="$primary50">
                  <Icon as={AudioWaveform} size="lg" color="$primary600" />
                </Center>
                <VStack style={{ flex: 1 }}>
                  <Text size="md" weight="bold" color="$textLight900">
                    Captura de voz
                  </Text>
                  <Text size="2xs" color="$textLight500">
                    {voice.hasMic ? 'Micrófono disponible' : 'Micrófono no disponible en este dispositivo'}
                  </Text>
                </VStack>
                {voice.isRecording ? (
                  <Box bg="$error50" px="$2.5" py="$1" borderRadius="$full">
                    <Text size="2xs" weight="bold" color="$error600">
                      GRABANDO
                    </Text>
                  </Box>
                ) : null}
              </HStack>

              <HStack space="sm" alignItems="flex-start" p="$3" borderRadius={14} bg="$primary0" mb="$4">
                <Text size="xs" color="$primary800" style={{ flex: 1, lineHeight: 18 }}>
                  Pida al niño/a que emita la vocal <Text weight="bold" size="xs" color="$primary800">«A»</Text> sostenida a un
                  tono e intensidad cómodos durante 5 segundos, con el micrófono a unos 10 cm. Puede grabar
                  varias tomas y elegir después cuál analizar.
                </Text>
              </HStack>

              {/* nivel + F0 en vivo */}
              <HStack space="md" mb="$4">
                <VStack style={{ flex: 1 }}>
                  <Text size="2xs" color="$textLight500">
                    PITCH EN VIVO
                  </Text>
                  <Text size="xl" weight="bold" color="$primary600" style={{ fontVariant: ['tabular-nums'] }}>
                    {voice.liveF0 ? `${voice.liveF0} Hz` : '— Hz'}
                  </Text>
                </VStack>
                <VStack style={{ flex: 1, justifyContent: 'center' }}>
                  <Text size="2xs" color="$textLight500" mb="$1">
                    NIVEL DE SEÑAL
                  </Text>
                  <Box h={8} borderRadius="$full" bg="$backgroundLight100" style={{ overflow: 'hidden' }}>
                    <View
                      style={{
                        height: '100%',
                        width: `${Math.round(voice.level * 100)}%`,
                        backgroundColor: voice.level > 0.6 ? '#2A7948' : voice.level > 0.3 ? '#FF7F00' : '#D8CFC0',
                        borderRadius: 999,
                      }}
                    />
                  </Box>
                </VStack>
              </HStack>

              {/* progreso */}
              <Box h={8} borderRadius="$full" bg="$backgroundLight100" mb="$4" style={{ overflow: 'hidden' }}>
                <View style={{ height: '100%', width: `${Math.round(voice.progress * 100)}%`, backgroundColor: '#FF7F00', borderRadius: 999 }} />
              </Box>

              {/* controles */}
              <HStack space="sm">
                <Button
                  action="primary"
                  variant="solid"
                  rounded="$xl"
                  style={{ flex: 1 }}
                  isDisabled={voice.isRecording || voice.isAnalyzing || !voice.hasMic}
                  onPress={voice.startRecording}>
                  <HStack space="sm" alignItems="center">
                    <Icon as={Mic} size="sm" color="$white" />
                    <Text size="sm" weight="bold" color="$white">
                      {voice.takes.length ? 'Grabar otra toma' : 'Grabar voz'}
                    </Text>
                  </HStack>
                </Button>
                <Button action="secondary" variant="outline" rounded="$xl" isDisabled={!voice.isRecording} onPress={voice.stopRecording}>
                  <Icon as={Square} size="sm" color="$error500" />
                </Button>
              </HStack>
            </Card>

            {/* tomas grabadas */}
            {voice.takes.length ? (
              <Card bgColor="$white" borderRadius={22} p="$5">
                <HStack alignItems="center" justifyContent="space-between" mb="$3">
                  <Text size="md" weight="bold" color="$textLight900">
                    Grabaciones
                  </Text>
                  <Text size="2xs" color="$textLight500">
                    {voice.takes.length} {voice.takes.length === 1 ? 'toma' : 'tomas'}
                  </Text>
                </HStack>
                <Text size="2xs" color="$textLight500" mb="$3">
                  Reproduzca las tomas, seleccione la de mejor calidad y pulse «Analizar». La escucha
                  también sirve para la valoración perceptual GRBAS.
                </Text>

                <VStack space="sm" mb="$4">
                  {voice.takes.map((take, index) => (
                    <TakeRow key={take.id} take={take} index={index} />
                  ))}
                </VStack>

                <Button
                  action="primary"
                  variant="solid"
                  rounded="$xl"
                  isDisabled={!selectedTake || voice.isRecording || voice.isAnalyzing}
                  onPress={() => {
                    tracker.classifyReactivo('voz-rec');
                    voice.analyzeTake();
                  }}>
                  <HStack space="sm" alignItems="center">
                    {voice.isAnalyzing ? <Spinner size="small" color="$white" /> : <Icon as={Activity} size="sm" color="$white" />}
                    <Text size="sm" weight="bold" color="$white">
                      {voice.isAnalyzing
                        ? 'Analizando…'
                        : selectedTake
                          ? `Analizar toma ${voice.takes.indexOf(selectedTake) + 1}`
                          : 'Analizar toma'}
                    </Text>
                  </HStack>
                </Button>
              </Card>
            ) : null}

            {/* captura insuficiente o error de captura */}
            {voice.phase === 'insufficient' ? (
              <Card bgColor="$warning50" borderRadius={18} borderWidth={1} borderColor="$warning200" p="$4">
                <HStack space="sm" alignItems="flex-start">
                  <Icon as={AlertTriangle} size="sm" color="$warning600" style={{ marginTop: 2 }} />
                  <VStack style={{ flex: 1 }}>
                    <Text size="sm" weight="bold" color="$warning800">
                      Captura insuficiente
                    </Text>
                    <Text size="xs" color="$warning800" style={{ lineHeight: 17 }}>
                      No se detectó suficiente voz sonora para calcular los parámetros. Acerque el micrófono
                      (~10 cm), pida una «A» sostenida y firme, y grabe una nueva toma.
                    </Text>
                    {voice.insufficientReason ? (
                      <Text size="xs" weight="bold" color="$warning800" mt="$1" style={{ lineHeight: 17 }}>
                        Detalle: {voice.insufficientReason}
                      </Text>
                    ) : null}
                    <Text size="xs" color="$warning800" mt="$1" style={{ lineHeight: 17 }}>
                      Si el análisis sigue fallando, puede completar la valoración perceptual
                      GRBAS escuchando las tomas y cerrar la prueba manualmente con su firma.
                    </Text>
                    <Pressable onPress={voice.startRecording} style={{ marginTop: 8 }}>
                      <HStack space="xs" alignItems="center">
                        <Icon as={RotateCcw} size="xs" color="$warning700" />
                        <Text size="xs" weight="bold" color="$warning700">
                          Repetir grabación
                        </Text>
                      </HStack>
                    </Pressable>
                  </VStack>
                </HStack>
              </Card>
            ) : null}
            {voice.phase === 'error' ? (
              <Card bgColor="$error50" borderRadius={18} borderWidth={1} borderColor="$error200" p="$4">
                <HStack space="sm" alignItems="flex-start">
                  <Icon as={AlertTriangle} size="sm" color="$error600" style={{ marginTop: 2 }} />
                  <VStack style={{ flex: 1 }}>
                    <Text size="sm" weight="bold" color="$error700">
                      No se pudo grabar
                    </Text>
                    <Text size="xs" color="$error700" style={{ lineHeight: 17 }}>
                      {voice.errorMsg ?? 'Error desconocido del motor de audio.'}
                    </Text>
                  </VStack>
                </HStack>
              </Card>
            ) : null}

            {/* valoración perceptual GRBAS (disponible en cuanto hay tomas) */}
            {voice.takes.length ? (
              <Card bgColor="$white" borderRadius={20} p="$5">
                <HStack alignItems="center" justifyContent="space-between" mb="$1">
                  <Text size="sm" weight="bold" color="$textLight700" style={{ letterSpacing: 0.3 }}>
                    VALORACIÓN PERCEPTUAL · GRBAS
                  </Text>
                  {grbasScores ? (
                    <Box bg="$primary50" px="$2" py="$0.5" borderRadius="$full">
                      <Text size="2xs" weight="bold" color="$primary800">
                        {grbasSummary(grbasScores)}
                      </Text>
                    </Box>
                  ) : null}
                </HStack>
                <Text size="2xs" color="$textLight500" mb="$3">
                  Escuche la toma y puntúe cada dimensión de 0 (normal) a 3 (severo).
                </Text>

                <VStack space="md">
                  {GRBAS_DIMENSIONS.map(dim => (
                    <VStack key={dim.key}>
                      <HStack alignItems="center" justifyContent="space-between" mb="$1.5">
                        <HStack alignItems="center" space="xs" style={{ flex: 1 }}>
                          <Center w={22} h={22} borderRadius={7} bg="$primary50">
                            <Text size="2xs" weight="bold" color="$primary800">
                              {dim.letter}
                            </Text>
                          </Center>
                          <Text size="xs" weight="bold" color="$textLight800">
                            {dim.label}
                          </Text>
                        </HStack>
                        <Text size="2xs" color="$textLight400" style={{ flex: 1, textAlign: 'right' }}>
                          {dim.description}
                        </Text>
                      </HStack>
                      <HStack space="sm">
                        {[0, 1, 2, 3].map(score => {
                          const active = grbas[dim.key] === score;
                          return (
                            <Pressable key={score} onPress={() => setGrbasScore(dim.key, score)} style={{ flex: 1 }}>
                              <Center
                                py="$1.5"
                                borderRadius={10}
                                borderWidth={1.5}
                                borderColor={active ? '$primary600' : '$borderLight200'}
                                bg={active ? '$primary600' : '$backgroundLight50'}>
                                <Text size="xs" weight="bold" color={active ? '$white' : '$textLight600'}>
                                  {score}
                                </Text>
                                <Text size="2xs" color={active ? '$primary50' : '$textLight400'}>
                                  {GRBAS_SCORE_LABELS[score]}
                                </Text>
                              </Center>
                            </Pressable>
                          );
                        })}
                      </HStack>
                    </VStack>
                  ))}
                </VStack>

                {grbasScores ? (
                  <Box mt="$4" p="$3" borderRadius={12} bg="$primary0">
                    <Text size="xs" weight="bold" color="$primary800">
                      {grbasSeverityLabel(grbasScores)}
                    </Text>
                  </Box>
                ) : (
                  <Text size="2xs" color="$textLight400" mt="$3">
                    Puntúe las 5 dimensiones para incluir la escala en el informe (opcional).
                  </Text>
                )}
              </Card>
            ) : null}

            {/* resultados */}
            {r ? (
              <>
                <HStack space="sm">
                  <ParamCard label="F0 · PITCH MEDIO" value={`${r.f0} Hz`} norm="200–320 Hz" status={statusF0(r.f0)} />
                  <ParamCard label="HNR" value={`${r.hnr} dB`} norm="> 20 dB" status={statusHnr(r.hnr)} />
                </HStack>
                <HStack space="sm">
                  <ParamCard label="JITTER" value={`${r.jitter} %`} norm="< 1.0 %" status={statusJitter(r.jitter)} />
                  <ParamCard label="SHIMMER" value={`${r.shimmer} %`} norm="< 3.0 %" status={statusShimmer(r.shimmer)} />
                </HStack>

                <Card bgColor="$white" borderRadius={20} p="$5">
                  <HStack justifyContent="space-between" alignItems="center" mb="$2">
                    <Text size="sm" weight="bold" color="$textLight700" style={{ letterSpacing: 0.3 }}>
                      ESPACIO VOCÁLICO · F1 × F2
                    </Text>
                  </HStack>
                  <VowelSpace f1={r.formants?.f1 ?? null} f2={r.formants?.f2 ?? null} />
                  {r.formants ? (
                    <HStack justifyContent="space-between" mt="$3">
                      <Text size="sm" weight="bold" style={{ color: '#FF7F00' }}>
                        F1 {r.formants.f1} Hz
                      </Text>
                      <Text size="sm" weight="bold" style={{ color: '#0EA5E9' }}>
                        F2 {r.formants.f2} Hz
                      </Text>
                      <Text size="sm" weight="bold" style={{ color: '#A855F7' }}>
                        F3 {r.formants.f3} Hz
                      </Text>
                    </HStack>
                  ) : (
                    <Text size="xs" color="$textLight500" mt="$3" style={{ lineHeight: 17 }}>
                      Los formantes F1–F3 no pudieron estimarse en esta toma; el resto de
                      parámetros (F0, jitter, shimmer, HNR) sí es válido. Puede grabar y
                      analizar otra toma si necesita el espacio vocálico.
                    </Text>
                  )}
                </Card>

                <Card bgColor="$white" borderRadius={20} p="$5">
                  <Text size="sm" weight="bold" color="$textLight700" mb="$2" style={{ letterSpacing: 0.3 }}>
                    INTERPRETACIÓN CLÍNICA
                  </Text>
                  <Text size="sm" color="$textLight700" style={{ lineHeight: 21 }}>
                    {interpretation}
                  </Text>
                </Card>
              </>
            ) : null}

            {/* cierre manual: sin análisis pero con tomas + GRBAS completa */}
            {canCloseManually ? (
              <Card bgColor="$primary0" borderRadius={18} borderWidth={1} borderColor="$primary100" p="$4">
                <Text size="sm" weight="bold" color="$primary800">
                  Cierre manual de la prueba
                </Text>
                <Text size="xs" color="$primary800" mt="$1" style={{ lineHeight: 17 }}>
                  El análisis acústico no está disponible, pero hay tomas grabadas y la
                  valoración perceptual GRBAS está completa. Puede registrar la prueba
                  igualmente: firme abajo para dejar constancia.
                </Text>
              </Card>
            ) : null}

            {canSave ? (
              <>
                <Card bgColor="$white" borderRadius={20} p="$5">
                  <Text size="sm" weight="bold" color="$textLight700" mb="$2">
                    Observaciones
                  </Text>
                  <Input variant="outline" borderRadius={12} h={80}>
                    <InputField
                      multiline
                      placeholder="Interpretación o notas sobre la calidad vocal…"
                      value={notes}
                      onChangeText={setNotes}
                      style={{ textAlignVertical: 'top' }}
                    />
                  </Input>
                </Card>

                <Card bgColor="$white" borderRadius={20} p="$5">
                  <Text size="sm" weight="bold" color="$textLight700" mb="$2">
                    Evaluador responsable
                  </Text>
                  <HStack space="sm" mb="$3">
                    <Input variant="outline" borderRadius={12} style={{ flex: 2 }}>
                      <InputField placeholder="Nombre" value={evaluatorName} onChangeText={setEvaluatorName} />
                    </Input>
                    <Input variant="outline" borderRadius={12} style={{ flex: 1 }}>
                      <InputField placeholder="Colegiado" value={evaluatorLicense} onChangeText={setEvaluatorLicense} />
                    </Input>
                  </HStack>
                  <Text size="xs" weight="bold" color="$textLight600" mb="$1">
                    Firma del explorador{r ? ' (opcional)' : ''}
                  </Text>
                  <SignaturePad
                    paths={signaturePaths}
                    onAddPath={p => setSignaturePaths(prev => [...prev, p])}
                    onClear={() => setSignaturePaths([])}
                    setScrollEnabled={setScrollEnabled}
                  />
                  {signatureMissing ? (
                    <Text size="2xs" color="$warning700" mt="$1">
                      Para el cierre manual la firma es obligatoria: deja constancia de la prueba.
                    </Text>
                  ) : null}
                </Card>

                <Button
                  action="primary"
                  variant="solid"
                  rounded="$full"
                  isDisabled={isSaving || !evaluatorName.trim() || !evaluatorLicense.trim() || signatureMissing}
                  isLoading={isSaving}
                  onPress={handleSave}>
                  <HStack space="sm" alignItems="center">
                    <Icon as={Save} size="sm" color="$white" />
                    <Text size="sm" weight="bold" color="$white">
                      {r ? 'Guardar análisis' : 'Registrar prueba con firma'}
                    </Text>
                  </HStack>
                </Button>
              </>
            ) : (
              <Card bgColor="$white" borderRadius={20} p="$6">
                <Center>
                  <Icon as={AudioWaveform} size="xl" color="$textLight300" />
                  <Text size="sm" color="$textLight400" mt="$2" style={{ textAlign: 'center' }}>
                    {voice.takes.length
                      ? 'Seleccione una toma y pulse «Analizar» para obtener los parámetros acústicos. Si el análisis no funciona, complete la valoración GRBAS para poder cerrar la prueba manualmente con su firma.'
                      : 'Grabe una o varias tomas de la vocal /a/ para empezar.'}
                  </Text>
                </Center>
              </Card>
            )}
          </VStack>
        </ScrollView>
      </VStack>
    </Content>
  );
}
