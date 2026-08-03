import React, { useEffect, useMemo, useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  Box,
  Card,
  HStack,
  Icon,
  Input,
  InputField,
  ScrollView,
  Spinner,
  VStack,
} from '@gluestack-ui/themed';
import { AlertTriangle, AudioWaveform, Mic, RotateCcw, Save, Square } from 'lucide-react-native';

import { Button, Content, Header, Text } from '@/Components/Common';
import RadialBackground from '@/Components/Themed/RadialBackground';
import { finishModule, RootStackParamList } from '@/Navigators';
import { RootState } from '@/Store';
import { Evaluation } from '@/Models/Evaluation/Evaluation';
import {
  ProsodyAnalysis,
  type ProsodyAgeBand,
  type ProsodyTask,
} from '@/Models/ProsodyAnalysis/ProsodyAnalysis';
import { useClassSelector } from '@/Helpers/ClassTransformer';
import { useTelemetryTracker } from '@/Telemetry';
import { useCreateProsodyAnalysisMutation } from '@/Services/local/modules/prosodyAnalysis';
import { showErrorToast, showSuccessToast } from '@/Helpers/showToast';
import {
  MIN_SPEECH_SEC,
  TARGET_SPEECH_SEC,
  useProsodyAnalysis,
} from './useProsodyAnalysis';
import { registerProsodyMicAdapter, unregisterProsodyMicAdapter } from './prosodyMicAdapter';
import { EMPTY_PROSODY_METRICS, toProsodyMetricsRecord } from './prosodyRecord';
import { prosodyInterpretation, prosodyReasonLabel, prosodyReportRows } from './prosodyResult';

type Props = NativeStackScreenProps<RootStackParamList, 'ProsodyAnalysis'>;

/* -------------------------------------------------------------------------- */
/*  Módulo de prosodia — toma de habla conectada.                              */
/*                                                                            */
/*  La tarea y los tiempos vienen de la decisión B0.1                          */
/*  (`docs/design/b0-prosodia-tarea-y-afirmaciones.md`), y la ausencia de      */
/*  juicio clínico en pantalla viene de B0.2: se muestran valores medidos, no  */
/*  percentiles ni etiquetas de normalidad, porque no hay baremo pediátrico    */
/*  español que los respalde.                                                  */
/* -------------------------------------------------------------------------- */

/** Estímulos por banda de edad (B0.1). Trazables por `stimulusId`. */
const STIMULI: Record<ProsodyAgeBand, { id: string; task: ProsodyTask; title: string; prompt: string }> = {
  prelector: {
    id: 'lamina-parque-v1',
    task: 'narracion-lamina',
    title: 'Lámina: un día en el parque',
    prompt: 'Cuéntame todo lo que pasa en este dibujo. Tómate el tiempo que quieras.',
  },
  lector: {
    id: 'recuento-excursion-v1',
    task: 'recuento-historia',
    title: 'Recuento: la excursión',
    prompt: 'Cuéntame la historia con tus palabras, desde el principio hasta el final.',
  },
};

const secs = (v: number) => `${v.toFixed(0)} s`;

export default function ProsodyAnalysisScreen({ navigation }: Props) {
  const activeEvaluation = useClassSelector(
    Evaluation,
    (state: RootState) => state.activeEvaluation.evaluation,
  );
  const [createProsodyAnalysis, { isLoading: isSaving }] = useCreateProsodyAnalysisMutation();
  const prosody = useProsodyAnalysis();
  const tracker = useTelemetryTracker();

  // Registra el motor de captura y lo libera al salir: sin la baja quedarían
  // abiertas la reserva del micrófono compartido y la sesión en modo grabación,
  // que en iOS atenúa la salida del resto de módulos.
  useEffect(() => {
    registerProsodyMicAdapter();
    return () => unregisterProsodyMicAdapter();
  }, []);

  useEffect(() => {
    tracker.enterReactivo('prosodia-toma');
  }, [tracker]);

  /* Cierre del reactivo cuando la toma termina de analizarse —se cierre a mano
   * o sola por tope de duración—. La primera vez mide el tiempo de respuesta;
   * repetir la toma cuenta como rectificación, que es justo lo que interesa
   * saber de un módulo cuya muestra puede salir corta o ruidosa. */
  useEffect(() => {
    if (prosody.phase === 'done' || prosody.phase === 'error') {
      tracker.classifyReactivo('prosodia-toma');
    }
  }, [prosody.phase, tracker]);

  const [ageBand, setAgeBand] = useState<ProsodyAgeBand>('prelector');
  const [notes, setNotes] = useState('');
  const [evaluatorName, setEvaluatorName] = useState(
    activeEvaluation?.professional?.name ?? '',
  );
  const [evaluatorLicense, setEvaluatorLicense] = useState(
    activeEvaluation?.professional?.licenseNumber ?? '',
  );

  const stimulus = STIMULI[ageBand];
  const result = prosody.result;

  const record = useMemo(
    () => (result ? toProsodyMetricsRecord(result) : null),
    [result],
  );
  const rows = useMemo(() => (record ? prosodyReportRows(record) : []), [record]);

  const recording = prosody.phase === 'recording';
  const analysing = prosody.phase === 'analysing';
  const done = prosody.phase === 'done';

  /* Se puede guardar en cuanto hay análisis, aunque la muestra sea corta o no
   * haya dado métricas: queda constancia de que la prueba se intentó, con el
   * motivo. Ocultar las tomas fallidas dejaría el historial mintiendo por
   * omisión. */
  const canSave = (done || prosody.phase === 'error') && !!evaluatorName.trim();

  const handleSave = async () => {
    if (!canSave || isSaving) return;
    if (!activeEvaluation) {
      showErrorToast('No se puede guardar', 'No hay una evaluación activa asociada al paciente.');
      return;
    }
    try {
      const item = new ProsodyAnalysis();
      item.task = stimulus.task;
      item.ageBand = ageBand;
      item.stimulusId = stimulus.id;
      item.language = 'es';
      item.reason = result?.stats.reason ?? 'empty';
      item.metrics = record ?? EMPTY_PROSODY_METRICS;
      item.interpretation = prosodyInterpretation(item.metrics, item.reason);
      item.notes = { obs: notes.trim() };
      item.evaluatorName = evaluatorName.trim();
      item.evaluatorLicense = evaluatorLicense.trim();
      item.evaluatorSignatureSvg = null;
      item.completedAt = new Date();
      item.evaluation = { id: activeEvaluation.id } as Evaluation;

      await createProsodyAnalysis(item);
      showSuccessToast(
        'Muestra registrada',
        item.reason === 'ok'
          ? `Rango tonal ${record?.f0RangeSt?.toFixed(1) ?? '—'} st · ${record?.pauseCount ?? '—'} pausa(s).`
          : prosodyReasonLabel(item.reason),
      );
      finishModule(navigation);
    } catch {
      showErrorToast('Error al guardar', 'No se pudo registrar la muestra. Inténtelo de nuevo.');
    }
  };

  const progress = Math.min(1, prosody.speechSec / TARGET_SPEECH_SEC);

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
            <VStack>
              <HStack alignItems="center" space="sm">
                <Text size="2xl" weight="bold" color="$textLight900">
                  Análisis prosódico
                </Text>
                <Box bg="$primary50" px="$2" py="$0.5" borderRadius="$full">
                  <Text size="2xs" weight="bold" color="$primary800" style={{ letterSpacing: 0.4 }}>
                    HABLA CONECTADA
                  </Text>
                </Box>
              </HStack>
              <Text size="sm" color="$textLight600">
                Ritmo, pausas y entonación sobre una muestra de habla narrada.
              </Text>
            </VStack>

            {/* Sin motor de captura: el módulo lo dice y no finge. */}
            {!prosody.available ? (
              <Card p="$4" borderRadius={16} bg="$warning50" borderWidth={1} borderColor="$warning200">
                <HStack space="sm" alignItems="center">
                  <Icon as={AlertTriangle} size="sm" color="$warning700" />
                  <Text size="sm" color="$warning800" flex={1}>
                    No hay micrófono disponible en este dispositivo. La prueba no puede realizarse.
                  </Text>
                </HStack>
              </Card>
            ) : null}

            {/* Banda de edad y estímulo */}
            <Card p="$4" borderRadius={16}>
              <VStack space="sm">
                <Text size="sm" weight="bold" color="$textLight800">
                  Tarea
                </Text>
                <HStack space="sm">
                  {(['prelector', 'lector'] as ProsodyAgeBand[]).map(band => (
                    <Button
                      key={band}
                      flex={1}
                      variant={ageBand === band ? 'solid' : 'outline'}
                      isDisabled={recording || analysing}
                      onPress={() => setAgeBand(band)}>
                      {band === 'prelector' ? '3–6 años' : '7–12 años'}
                    </Button>
                  ))}
                </HStack>
                <Text size="sm" weight="bold" color="$textLight900">
                  {stimulus.title}
                </Text>
                <Text size="sm" color="$textLight600">
                  «{stimulus.prompt}»
                </Text>
                {/* B0.1: el explorador no debe hablar durante la toma — su voz
                    entraría en el recuento de sílabas y en las pausas. */}
                <Box bg="$backgroundLight50" p="$3" borderRadius={12}>
                  <Text size="xs" color="$textLight600">
                    Lea la consigna ANTES de iniciar la toma y guarde silencio mientras el niño habla:
                    su voz se sumaría a la medida.
                  </Text>
                </Box>
                {/* El ruido de sala degrada las pausas y el recuento silábico.
                    No se puede comprobar automáticamente: el sonómetro guarda su
                    calibración, no el nivel medido, así que no hay estado que
                    consultar. Queda el acceso directo, antes de empezar. */}
                {!recording && !analysing ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onPress={() => navigation.navigate('RoomNoiseCheck')}>
                    Comprobar ruido de sala
                  </Button>
                ) : null}
              </VStack>
            </Card>

            {/* Captura */}
            <Card p="$4" borderRadius={16}>
              <VStack space="md">
                <HStack alignItems="center" justifyContent="space-between">
                  <Text size="sm" weight="bold" color="$textLight800">
                    Muestra
                  </Text>
                  <Text size="xs" color="$textLight600">
                    {secs(prosody.speechSec)} de habla · {secs(prosody.elapsedSec)} totales
                  </Text>
                </HStack>

                {/* Barra de progreso hacia el objetivo de muestra. Cuenta HABLA,
                    no reloj: si el niño calla, no avanza. */}
                <Box h={8} bg="$backgroundLight100" borderRadius="$full" overflow="hidden">
                  <Box
                    h={8}
                    w={`${progress * 100}%`}
                    bg={prosody.enough ? '$success500' : '$primary500'}
                  />
                </Box>
                <Text size="xs" color="$textLight600">
                  Objetivo: {TARGET_SPEECH_SEC} s de habla (mínimo {MIN_SPEECH_SEC} s).
                </Text>

                {prosody.clipping ? (
                  <HStack space="sm" alignItems="center">
                    <Icon as={AlertTriangle} size="sm" color="$warning700" />
                    <Text size="xs" color="$warning800" flex={1}>
                      La señal satura: aleje el dispositivo o baje la ganancia y repita la toma.
                    </Text>
                  </HStack>
                ) : null}

                <HStack space="sm">
                  {!recording ? (
                    <Button
                      flex={1}
                      isDisabled={!prosody.available || analysing}
                      onPress={() => void prosody.start()}>
                      <Icon as={Mic} size="sm" color="$white" />
                      {done || prosody.phase === 'error' ? '  Repetir toma' : '  Iniciar toma'}
                    </Button>
                  ) : (
                    <Button flex={1} action="secondary" onPress={() => void prosody.stop()}>
                      <Icon as={Square} size="sm" color="$white" />
                      {'  Detener'}
                    </Button>
                  )}
                  {done || prosody.phase === 'error' ? (
                    <Button variant="outline" onPress={prosody.reset}>
                      <Icon as={RotateCcw} size="sm" />
                    </Button>
                  ) : null}
                </HStack>

                {analysing ? (
                  <HStack space="sm" alignItems="center">
                    <Spinner size="small" />
                    <Text size="sm" color="$textLight600">
                      Procesando análisis prosódico…
                    </Text>
                  </HStack>
                ) : null}
              </VStack>
            </Card>

            {/* Avisos de validez de la toma */}
            {prosody.issues.noSignal ? (
              <Card p="$4" borderRadius={16} bg="$error50" borderWidth={1} borderColor="$error200">
                <Text size="sm" color="$error800">
                  El micrófono no entregó audio. Compruebe que ninguna otra aplicación lo esté usando.
                </Text>
              </Card>
            ) : null}
            {done && prosody.issues.tooLittleSpeech ? (
              <Card p="$4" borderRadius={16} bg="$warning50" borderWidth={1} borderColor="$warning200">
                <Text size="sm" color="$warning800">
                  Muestra corta ({secs(prosody.speechSec)} de habla). Las medidas de ritmo pierden
                  fiabilidad; considere repetir la toma.
                </Text>
              </Card>
            ) : null}

            {/* Resultados */}
            {done && record ? (
              <Card p="$4" borderRadius={16}>
                <VStack space="sm">
                  <HStack alignItems="center" space="sm">
                    <Icon as={AudioWaveform} size="sm" color="$primary600" />
                    <Text size="sm" weight="bold" color="$textLight800">
                      Parámetros medidos
                    </Text>
                  </HStack>

                  {result && result.stats.reason !== 'ok' ? (
                    <Text size="sm" color="$warning800">
                      {prosodyReasonLabel(result.stats.reason)}
                    </Text>
                  ) : null}

                  {rows.map(row => (
                    <VStack key={row.key} py="$1.5" borderBottomWidth={1} borderColor="$borderLight100">
                      <HStack justifyContent="space-between" alignItems="center">
                        <Text size="sm" color="$textLight800">
                          {row.label}
                        </Text>
                        <Text size="sm" weight="bold" color={row.value === null ? '$textLight400' : '$textLight900'}>
                          {row.value === null ? 'no medido' : `${row.value} ${row.unit}`.trim()}
                        </Text>
                      </HStack>
                      <Text size="2xs" color="$textLight500">
                        {row.hint}
                      </Text>
                    </VStack>
                  ))}

                  {/* B0.2: sin baremo, no hay percentiles ni etiquetas. Debe
                      constar en pantalla, no solo en el PDF. */}
                  <Box bg="$backgroundLight50" p="$3" borderRadius={12}>
                    <Text size="xs" color="$textLight600">
                      Valores descriptivos, sin baremo poblacional: no se emite juicio de normalidad.
                      La comparación válida es con tomas anteriores del mismo niño en la misma tarea.
                      Las medidas acústicas no sustituyen la valoración perceptiva del logopeda.
                    </Text>
                  </Box>
                </VStack>
              </Card>
            ) : null}

            {/* Cierre */}
            {done || prosody.phase === 'error' ? (
              <Card p="$4" borderRadius={16}>
                <VStack space="sm">
                  <Text size="sm" weight="bold" color="$textLight800">
                    Observaciones
                  </Text>
                  <Input>
                    <InputField
                      placeholder="Colaboración, fatiga, incidencias…"
                      value={notes}
                      onChangeText={setNotes}
                    />
                  </Input>
                  <Text size="sm" weight="bold" color="$textLight800">
                    Explorador
                  </Text>
                  <Input>
                    <InputField placeholder="Nombre" value={evaluatorName} onChangeText={setEvaluatorName} />
                  </Input>
                  <Input>
                    <InputField
                      placeholder="Nº de colegiado"
                      value={evaluatorLicense}
                      onChangeText={setEvaluatorLicense}
                    />
                  </Input>
                  <Button isDisabled={!canSave || isSaving} onPress={() => void handleSave()}>
                    <Icon as={Save} size="sm" color="$white" />
                    {'  Guardar muestra'}
                  </Button>
                </VStack>
              </Card>
            ) : null}
          </VStack>
        </ScrollView>
      </VStack>
    </Content>
  );
}
