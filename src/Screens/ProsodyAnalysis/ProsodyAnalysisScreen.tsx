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
import { AlertTriangle, AudioWaveform, Mic, RotateCcw, Save, Square, Volume2 } from 'lucide-react-native';

import type { RecorderHealth } from '@/Audio';
import { Button, Content, Header, Text } from '@/Components/Common';
import RadialBackground from '@/Components/Themed/RadialBackground';
import { finishModule, RootStackParamList } from '@/Navigators';
import { RootState } from '@/Store';
import { Evaluation } from '@/Models/Evaluation/Evaluation';
import { ProsodyAnalysis } from '@/Models/ProsodyAnalysis/ProsodyAnalysis';
import { canSpeak, prosodyConsignaTextByLang, speakLocalized, stopSpeaking } from '@/Voice';
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
import {
  PROSODY_AGE_BANDS,
  PROSODY_AGE_BAND_LABEL,
  prosodyStimulusFor,
  type ProsodyAgeBand,
} from './prosodyStimuli';
import ProsodyStimulusScene from './ProsodyStimulusScene';
import { LuaCompanionWidget } from '@/Components/Mascot/LuaCompanionWidget';
import { useLuaCompanion, LuaEmotion } from '@/Lua';

import { useT } from '@/I18n';
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

const secs = (v: number) => `${v.toFixed(0)} s`;

/* Por qué no hubo audio. Un aviso genérico («el micrófono no entregó audio»)
 * manda al clínico a buscar una avería que casi nunca es la que cree: lo más
 * frecuente es el permiso sin conceder, que se resuelve en dos toques. */
const MIC_HEALTH_LABEL: Record<RecorderHealth, string> = {
  unknown:
    'El micrófono no entregó audio. Compruebe que ninguna otra aplicación lo esté usando.',
  live: 'El micrófono no entregó audio. Compruebe que ninguna otra aplicación lo esté usando.',
  silent:
    'El micrófono no entregó ni un bloque de audio: puede estar ocupado por otra aplicación o silenciado por el sistema. Ciérrelas y repita la toma.',
  'no-permission':
    'VIA+ no tiene permiso de micrófono. Concédalo en los ajustes del sistema y repita la toma.',
  'no-engine':
    'Esta versión de la app no incorpora el motor de captura de audio. El módulo de prosodia no puede realizarse en este dispositivo.',
};

export default function ProsodyAnalysisScreen({ navigation }: Props) {
  const t = useT();
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
  const patient = activeEvaluation?.patient;
  const patientName = patient ? `${patient.name} ${patient.lastName}`.trim() : null;

  const lua = useLuaCompanion({
    moduleKey: 'prosody_analysis',
    initialEmotion: LuaEmotion.Tranquility,
    initialLevel: 1,
  });

  useEffect(() => {
    if (prosody.phase === 'recording') {
      lua.setPhase(1);
      lua.setEmotion(LuaEmotion.Love);
    } else if (prosody.phase === 'done') {
      lua.setVerdict(2);
      lua.triggerReward('prosody_analysis', 2);
    } else {
      lua.setPhase(0);
      lua.setEmotion(LuaEmotion.Tranquility);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prosody.phase]);

  const stimulus = prosodyStimulusFor(ageBand);
  const [voiceAvailable, setVoiceAvailable] = useState(canSpeak);

  /* Locuta la consigna con la voz de la app (recorte neuronal → voz del
   * sistema). Se detiene cualquier locución previa: dos consignas solapadas
   * serían un modelo prosódico contradictorio. */
  const speakConsigna = () => {
    try {
      stopSpeaking();
      speakLocalized('tutor', prosodyConsignaTextByLang(ageBand), 'es');
    } catch {
      /* sin motor de voz: el explorador lee la consigna (ya se avisa) */
    }
  };

  // La voz del sistema tarda en arrancar: sin esto la pantalla podía quedarse
  // con el «no» del arranque y desactivar el botón para siempre.
  useEffect(() => {
    setVoiceAvailable(canSpeak());
  }, []);

  // Al salir no puede quedar una consigna sonando sobre otra pantalla.
  useEffect(() => () => {
    try {
      stopSpeaking();
    } catch {
      /* noop */
    }
  }, []);
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
                  
                  {t.prosody.analisisProsodico}
                </Text>
                <Box bg="$primary50" px="$2" py="$0.5" borderRadius="$full">
                  <Text size="2xs" weight="bold" color="$primary800" style={{ letterSpacing: 0.4 }}>
                    
                    {t.prosody.hablaConectada}
                  </Text>
                </Box>
              </HStack>
              <Text size="sm" color="$textLight600">
                {patientName ?? 'Ritmo, pausas y entonación sobre una muestra de habla narrada.'}
              </Text>
            </VStack>

            {/* Acompañamiento Lúa (Escucha Activa y Recompensa Prosódica) */}
            <LuaCompanionWidget
              emotion={lua.currentEmotion}
              activeBadge={prosody.phase === 'done' ? lua.activeBadge : null}
              connected={lua.connected}
              level={prosody.phase === 'done' ? 12 : prosody.phase === 'recording' ? 6 : 2}
              message={
                prosody.phase === 'recording'
                  ? '¡Te escucho con mucha atención! Cuéntame la historia.'
                  : prosody.phase === 'done'
                  ? '¡Fantástica narración! Has ganado la insignia Ritmo y Melodía.'
                  : 'Mira la lámina y cuéntame todo lo que ves con tu ritmo natural.'
              }
            />

            {/* Sin motor de captura: el módulo lo dice y no finge. */}
            {!prosody.available ? (
              <Card p="$4" borderRadius={16} bg="$warning50" borderWidth={1} borderColor="$warning200">
                <HStack space="sm" alignItems="center">
                  <Icon as={AlertTriangle} size="sm" color="$warning700" />
                  <Text size="sm" color="$warning800" flex={1}>
                    
                    {t.prosody.hayMicrofonoDisponibleEsteDispositivo}
                  </Text>
                </HStack>
              </Card>
            ) : null}

            {/* Banda de edad, lámina y consigna */}
            <Card p="$4" borderRadius={16}>
              <VStack space="sm">
                <Text size="sm" weight="bold" color="$textLight800">
                  
                  {t.prosody.tarea}
                </Text>
                <HStack space="sm">
                  {PROSODY_AGE_BANDS.map(band => (
                    <Button
                      key={band}
                      flex={1}
                      variant={ageBand === band ? 'solid' : 'outline'}
                      isDisabled={recording || analysing}
                      onPress={() => setAgeBand(band)}>
                      {PROSODY_AGE_BAND_LABEL[band]}
                    </Button>
                  ))}
                </HStack>

                <Text size="sm" weight="bold" color="$textLight900">
                  {stimulus.title}
                </Text>

                {/* La LÁMINA es el estímulo: es lo que el niño mira mientras
                    habla, y de su riqueza depende que la muestra llegue a los
                    30 s. Se dibuja en SVG (ver ProsodyStimulusScene). */}
                <Box
                  borderRadius={14}
                  overflow="hidden"
                  borderWidth={1}
                  borderColor="$borderLight200"
                  style={{ aspectRatio: 400 / 240 }}>
                  <ProsodyStimulusScene ageBand={ageBand} />
                </Box>

                {/* La consigna la LOCUTA la app, no la lee el explorador: el
                    niño imita el modelo que oye —velocidad, pausas, entonación—
                    y una consigna leída por cada explorador metería esa
                    variabilidad en la medida de un módulo que mide exactamente
                    eso. Por eso el botón, y por eso está en el corpus de voz. */}
                <Button
                  variant="outline"
                  isDisabled={recording || analysing || !voiceAvailable}
                  onPress={speakConsigna}>
                  <Icon as={Volume2} size="sm" />
                  {t.prosody.reproducirConsigna}
                </Button>
                <Text size="xs" color="$textLight600">
                  «{stimulus.consigna.es}»
                </Text>
                {!voiceAvailable ? (
                  <Text size="xs" color="$warning800">
                    
                    {t.prosody.sinVozDisponibleLeaConsigna}
                  </Text>
                ) : null}

                {/* B0.1: el explorador no debe hablar durante la toma — su voz
                    entraría en el recuento de sílabas y en las pausas. */}
                <Box bg="$backgroundLight50" p="$3" borderRadius={12}>
                  <Text size="xs" color="$textLight600">
                    
                    {t.prosody.reproduzcaConsignaAntesIniciarToma}
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
                    
                    {t.prosody.comprobarRuidoSala}
                  </Button>
                ) : null}
              </VStack>
            </Card>

            {/* Captura */}
            <Card p="$4" borderRadius={16}>
              <VStack space="md">
                <HStack alignItems="center" justifyContent="space-between">
                  <Text size="sm" weight="bold" color="$textLight800">
                    
                    {t.prosody.muestra}
                  </Text>
                  <Text size="xs" color="$textLight600">
                    {secs(prosody.speechSec)}  {t.prosody.habla} {secs(prosody.elapsedSec)}  {t.prosody.totales}
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
                  
                  {t.prosody.objetivo} {TARGET_SPEECH_SEC}  {t.prosody.sHablaMinimo} {MIN_SPEECH_SEC} s).
                </Text>

                {prosody.clipping ? (
                  <HStack space="sm" alignItems="center">
                    <Icon as={AlertTriangle} size="sm" color="$warning700" />
                    <Text size="xs" color="$warning800" flex={1}>
                      
                      {t.prosody.senalSaturaAlejeDispositivoBaje}
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
                      {done || prosody.phase === 'error' ? t.prosody.repetirToma : t.prosody.iniciarToma}
                    </Button>
                  ) : (
                    <Button flex={1} action="secondary" onPress={() => void prosody.stop()}>
                      <Icon as={Square} size="sm" color="$white" />
                      {t.prosody.detener}
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
                      
                      {t.prosody.procesandoAnalisisProsodico}
                    </Text>
                  </HStack>
                ) : null}
              </VStack>
            </Card>

            {/* Avisos de validez de la toma */}
            {prosody.issues.noSignal ? (
              <Card p="$4" borderRadius={16} bg="$error50" borderWidth={1} borderColor="$error200">
                <Text size="sm" color="$error800">
                  {MIC_HEALTH_LABEL[prosody.micHealth]}
                </Text>
              </Card>
            ) : null}
            {done && prosody.issues.tooLittleSpeech ? (
              <Card p="$4" borderRadius={16} bg="$warning50" borderWidth={1} borderColor="$warning200">
                <Text size="sm" color="$warning800">
                  
                  {t.prosody.muestraCorta}{secs(prosody.speechSec)}  {t.prosody.hablaMedidasRitmoPierdenFiabilidad}
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
                      
                      {t.prosody.parametrosMedidos}
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
                          {row.value === null ? t.prosody.medido : `${row.value} ${row.unit}`.trim()}
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
                      
                      {t.prosody.valoresDescriptivosSinBaremoPoblacional}
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
                    
                    {t.prosody.observaciones}
                  </Text>
                  <Input>
                    <InputField
                      placeholder={t.prosody.colaboracionFatigaIncidencias}
                      value={notes}
                      onChangeText={setNotes}
                    />
                  </Input>
                  <Text size="sm" weight="bold" color="$textLight800">
                    
                    {t.prosody.explorador}
                  </Text>
                  <Input>
                    <InputField placeholder={t.prosody.nombre} value={evaluatorName} onChangeText={setEvaluatorName} />
                  </Input>
                  <Input>
                    <InputField
                      placeholder={t.prosody.nColegiado}
                      value={evaluatorLicense}
                      onChangeText={setEvaluatorLicense}
                    />
                  </Input>
                  <Button isDisabled={!canSave || isSaving} onPress={() => void handleSave()}>
                    <Icon as={Save} size="sm" color="$white" />
                    {t.prosody.guardarMuestra}
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
