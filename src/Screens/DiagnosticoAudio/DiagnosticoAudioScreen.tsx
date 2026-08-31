import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  PermissionsAndroid,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ArrowLeft, Ear, RefreshCw, Volume2 } from 'lucide-react-native';

import { retryVoiceEngine } from '@/Voice';
import { useT } from '@/I18n';
import {
  CAPTURE_PROBE_MS,
  TEST_TONE_HZ,
  checkMicCapture,
  checkMicPermission,
  checkNativeEngine,
  checkOutputContext,
  checkSpeechRecognition,
  checkSystemVoice,
  checkSystemVoiceSpeaks,
  checkVerbalClipChain,
  checkVoiceBank,
  emitSystemVoiceSample,
  emitVerbalClipSample,
  emitVoiceBankSample,
  LISTEN_CHECK_IDS,
  playTestTone,
  summaryText,
  worstStatus,
  type CheckResult,
  type CheckStatus,
} from './audioSelfTest';

/* -------------------------------------------------------------------------- */
/*  Comprobación de audio — pantalla de diagnóstico.                           */
/*                                                                             */
/*  Recorre la cadena de audio completa DELANTE del profesional y dice qué     */
/*  eslabón está roto. Existe porque la app degrada en silencio por diseño     */
/*  (una prueba no debe reventar delante del niño), y esa misma decisión hacía */
/*  imposible distinguir «no hay motor de audio en este binario» de «el        */
/*  micrófono está ocupado» o «no hay voz instalada en el sistema»: todo se    */
/*  veía igual, como que no sonaba nada.                                       */
/*                                                                             */
/*  Lo que la máquina NO puede cerrar —si algo se OYE— se pregunta, en vez de  */
/*  darlo por bueno: un «reproducido correctamente» sobre un altavoz mudo es   */
/*  exactamente el falso positivo que esta pantalla viene a eliminar.          */
/*                                                                             */
/*  Y se pregunta TRES VECES, una por motor, porque son tres cadenas           */
/*  independientes: el oscilador de las audiometrías (react-native-audio-api), */
/*  los recortes de la audiometría verbal (decodificados sobre ese mismo       */
/*  contexto) y el banco de locuciones + el sintetizador del sistema, que van  */
/*  por `expo-audio` y `expo-speech`. Con una sola pregunta sobre el tono, la  */
/*  pantalla publicaba «toda la cadena responde» mientras la audiometría       */
/*  verbal y el T.A.R. estaban mudos: no había mentira, había una pregunta     */
/*  que no se hacía.                                                           */
/* -------------------------------------------------------------------------- */

/** Una emisión que solo el oído del profesional puede dar por buena. */
interface ListenSpec {
  /* El id sale de `LISTEN_CHECK_IDS`, que es también lo que mira el resumen
   * copiable para declarar la salida sin comprobar: si las dos listas se
   * separan, el resumen volvería a callar una emisión no escuchada. Con el
   * tipo atado, separarlas no compila. */
  id: (typeof LISTEN_CHECK_IDS)[number];
  label: string;
  /** Qué se va a oír y a qué módulo pertenece esa vía. */
  what: string;
  /** Emite. Devuelve `false` si no llegó ni a programarse. */
  emit: () => Promise<boolean>;
  heard: string;
  notHeard: string;
  notHeardHint: string;
  notEmitted: string;
}

const LISTEN_SPECS: Array<ListenSpec & { id: (typeof LISTEN_CHECK_IDS)[number] }> = [
  {
    id: 'tone',
    label: 'Tono de prueba por el altavoz',
    what: `Tono de ${TEST_TONE_HZ} Hz — la vía de las DOS audiometrías (oscilador nativo).`,
    emit: async () => playTestTone(),
    heard: `Tono de ${TEST_TONE_HZ} Hz emitido y OÍDO.`,
    notHeard: `Tono de ${TEST_TONE_HZ} Hz emitido pero NO se oyó.`,
    notHeardHint:
      'El motor programó el tono y aun así no suena: las audiometrías tonal y condicionada no pueden presentar estímulo. Revise el volumen de multimedia, el silencio del sistema y si hay un accesorio Bluetooth capturando la salida.',
    notEmitted: 'El tono no llegó ni a programarse: no hay contexto de salida.',
  },
  {
    id: 'verbal-clip-heard',
    label: 'Palabra de la audiometría verbal',
    what: 'Un recorte de palabra por la cadena real del estímulo verbal (base64 → decodificación → altavoz).',
    emit: emitVerbalClipSample,
    heard: 'La palabra se oyó: la audiometría verbal tiene estímulo.',
    notHeard: 'La palabra se decodificó y se programó pero NO se oyó.',
    notHeardHint:
      'Es exactamente el fallo de «la audiometría verbal no suena». El recorte es correcto y el motor lo acepta: el eslabón roto está entre el contexto de audio y el altavoz. Compare con el tono: si el tono SÍ se oye y la palabra no, el problema es la decodificación en memoria; si no se oye ninguno, es la salida entera.',
    notEmitted:
      'El recorte no llegó a programarse. La tarjeta «Recortes de la audiometría verbal» dice por qué.',
  },
  {
    id: 'voice-bank-heard',
    label: 'Locución empaquetada',
    what: 'Una locución del banco (vía `expo-audio`): consignas y modelo hablado de las lenguas con recorte.',
    emit: emitVoiceBankSample,
    heard: 'La locución empaquetada se oyó.',
    notHeard: 'La locución se cargó y avanzó pero NO se oyó.',
    notHeardHint:
      'El reproductor del sistema avanza pero no sale audio: revise el volumen de multimedia y si otra aplicación tiene la salida tomada.',
    notEmitted: 'La locución no llegó a reproducirse. La tarjeta «Banco de locuciones» dice por qué.',
  },
  {
    id: 'tts-heard',
    label: 'Voz del sistema',
    what: 'La frase de prueba dictada por el sintetizador: la vía del modelo hablado del T.A.R.',
    emit: () => emitSystemVoiceSample(),
    heard: 'La voz del sistema se oyó: el T.A.R. puede presentar el modelo hablado.',
    notHeard: 'El motor dictó la frase pero NO se oyó.',
    notHeardHint:
      'Es el fallo de «el test de articulación no suena». El motor dice haber emitido: revise el volumen de multimedia y el encaminamiento de audio; si el tono tampoco se oye, la salida está rota para toda la app.',
    notEmitted:
      'El sintetizador no llegó a emitir. La tarjeta «Locución real del sintetizador» dice por qué.',
  },
];

const requestMic = async (): Promise<boolean> => {
  if (Platform.OS !== 'android') return true;
  const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO, {
    title: 'Permiso de micrófono',
    message: 'La comprobación necesita el micrófono para verificar que captura audio real.',
    buttonPositive: 'Permitir',
  });
  return granted === PermissionsAndroid.RESULTS.GRANTED;
};

const STATUS_COLOR: Record<CheckStatus, string> = {
  ok: '#1E8049',
  warn: '#D97706',
  fail: '#DC2626',
  skip: '#8C8275',
};
const STATUS_SOFT: Record<CheckStatus, string> = {
  ok: '#DCFCE7',
  warn: '#FEF3C7',
  fail: '#FEE2E2',
  skip: '#EFEAE0',
};
const STATUS_LABEL: Record<CheckStatus, string> = {
  ok: 'CORRECTO',
  warn: 'AVISO',
  fail: 'FALLO',
  skip: 'SIN COMPROBAR',
};

export default function DiagnosticoAudioScreen() {
  const t = useT();
  const navigation = useNavigation();
  const [checks, setChecks] = useState<CheckResult[]>([]);
  const [running, setRunning] = useState(false);
  const [step, setStep] = useState<string | null>(null);
  /** Emisión cuya respuesta está pendiente (lo que la máquina no puede medir). */
  const [asking, setAsking] = useState<string | null>(null);
  /** Emisión en curso (para desactivar su botón mientras suena). */
  const [emitting, setEmitting] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  // Un `run` nuevo invalida al anterior: pulsar «repetir» a mitad de una toma
  // no debe mezclar los resultados de las dos pasadas.
  const runToken = useRef(0);

  const run = useCallback(async () => {
    const mine = ++runToken.current;
    setRunning(true);
    setChecks([]);
    setAsking(null);

    const collected: CheckResult[] = [];
    const push = (c: CheckResult) => {
      if (mine !== runToken.current) return;
      collected.push(c);
      setChecks([...collected]);
    };

    setStep('Motor de audio nativo…');
    push(checkNativeEngine());

    setStep('Contexto de salida…');
    push(checkOutputContext());

    setStep('Banco de locuciones…');
    push(await checkVoiceBank());

    setStep('Recortes de la audiometría verbal…');
    push(await checkVerbalClipChain());

    setStep('Sintetizador del sistema…');
    push(checkSystemVoice());

    setStep('Dictando la frase de prueba…');
    push(await checkSystemVoiceSpeaks());

    setStep('Reconocimiento de voz…');
    push(await checkSpeechRecognition());

    setStep('Permiso de micrófono…');
    push(await checkMicPermission(requestMic));

    setStep(`Grabando ${CAPTURE_PROBE_MS / 1000} s para medir la captura…`);
    push(await checkMicCapture());

    if (mine !== runToken.current) return;
    setStep(null);
    setRunning(false);
  }, []);

  const replaceCheck = (c: CheckResult) =>
    setChecks(prev => [...prev.filter(x => x.id !== c.id), c]);

  const onEmit = async (spec: ListenSpec) => {
    setAsking(null);
    setEmitting(spec.id);
    let scheduled = false;
    try {
      scheduled = await spec.emit();
    } catch {
      scheduled = false;
    }
    setEmitting(null);
    if (scheduled) {
      setAsking(spec.id);
      return;
    }
    replaceCheck({ id: spec.id, label: spec.label, status: 'fail', detail: spec.notEmitted });
  };

  const onAnswer = (spec: ListenSpec, heard: boolean) => {
    setAsking(null);
    replaceCheck({
      id: spec.id,
      label: spec.label,
      status: heard ? 'ok' : 'fail',
      detail: heard ? spec.heard : spec.notHeard,
      hint: heard ? undefined : spec.notHeardHint,
    });
  };

  const onRetryVoice = async () => {
    setRetrying(true);
    try {
      await retryVoiceEngine();
    } finally {
      setRetrying(false);
    }
    setChecks(prev => prev.map(c => (c.id === 'tts' ? checkSystemVoice() : c)));
  };

  const overall = worstStatus(checks);
  const hasTts = checks.some(c => c.id === 'tts');
  /** Emisiones que el profesional todavía no ha escuchado. */
  const pendingListen = LISTEN_SPECS.filter(spec => !checks.some(c => c.id === spec.id));

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Pressable style={styles.back} onPress={() => navigation.goBack()}>
          <ArrowLeft size={18} color="#524B42" />
          <Text style={styles.backText}>{t.diagnosticoAudio.volver}</Text>
        </Pressable>

        <Text style={styles.eyebrow}>{t.diagnosticoAudio.diagnosticoDispositivo}</Text>
        <Text style={styles.title}>{t.diagnosticoAudio.comprobacionAudio}</Text>
        <Text style={styles.lead}>
          
          {t.diagnosticoAudio.recorreCadenaCompletaMotorNativo}
        </Text>

        <Pressable
          style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed, running && styles.ctaOff]}
          disabled={running}
          onPress={run}>
          {running ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <RefreshCw size={18} color="#FFFFFF" strokeWidth={2.5} />
          )}
          <Text style={styles.ctaText}>
            {running ? t.diagnosticoAudio.comprobando : checks.length ? t.diagnosticoAudio.repetirComprobacion : t.diagnosticoAudio.iniciarComprobacion}
          </Text>
        </Pressable>

        {step ? <Text style={styles.step}>{step}</Text> : null}

        {checks.length > 0 && !running ? (
          <View style={[styles.verdict, { backgroundColor: STATUS_SOFT[overall] }]}>
            <Text style={[styles.verdictText, { color: STATUS_COLOR[overall] }]}>
              {overall === 'fail'
                ? t.diagnosticoAudio.hayMenosEslabonRotoPruebas
                : pendingListen.length
                  ? /* NUNCA «todo funciona» con emisiones sin escuchar: ése es
                       justo el falso positivo del que salió esta pantalla. */
                    t.diagnosticoAudio.motoresRespondenPeroSalidaEsta(pendingListen.length, LISTEN_SPECS.length)
                  : overall === 'warn'
                    ? t.diagnosticoAudio.cadenaRespondeOyePeroHay
                    : t.diagnosticoAudio.cadenaAudioRespondeOyeEste}
            </Text>
          </View>
        ) : null}

        {checks.map(c => (
          <View key={c.id} style={styles.card}>
            <View style={styles.cardHead}>
              <Text style={styles.cardLabel}>{c.label}</Text>
              <View style={[styles.pill, { backgroundColor: STATUS_SOFT[c.status] }]}>
                <Text style={[styles.pillText, { color: STATUS_COLOR[c.status] }]}>
                  {STATUS_LABEL[c.status]}
                </Text>
              </View>
            </View>
            <Text style={styles.cardDetail}>{c.detail}</Text>
            {c.hint ? <Text style={styles.cardHint}>{c.hint}</Text> : null}
            {c.id === 'tts' && c.status !== 'ok' ? (
              <Pressable style={styles.inlineBtn} disabled={retrying} onPress={onRetryVoice}>
                <RefreshCw size={14} color="#0D9488" />
                <Text style={styles.inlineBtnText}>
                  {retrying ? t.diagnosticoAudio.reintentando : t.diagnosticoAudio.reintentarMotorVoz}
                </Text>
              </Pressable>
            ) : null}
          </View>
        ))}

        {/* Lo único que cierra la salida: el oído del profesional, UNA VEZ POR
            MOTOR. Con una sola pregunta sobre el tono, esta pantalla daba por
            buena toda la cadena mientras dos módulos estaban mudos. */}
        {checks.length > 0 && !running ? (
          <View style={styles.card}>
            <View style={styles.cardHead}>
              <Text style={styles.cardLabel}>{t.diagnosticoAudio.pruebaEscucha}</Text>
              <Ear size={18} color="#8C8275" />
            </View>
            <Text style={styles.cardDetail}>
              
              {t.diagnosticoAudio.motorProgrameSonidoPruebaAltavoz}
            </Text>
            {LISTEN_SPECS.map(spec => {
              const answered = checks.find(c => c.id === spec.id);
              return (
                <View key={spec.id} style={styles.listenRow}>
                  <Text style={styles.listenLabel}>{spec.label}</Text>
                  <Text style={styles.listenWhat}>{spec.what}</Text>
                  {asking === spec.id ? (
                    <View style={styles.answerRow}>
                      <Text style={styles.answerQ}>{t.diagnosticoAudio.haOido}</Text>
                      <Pressable
                        style={[styles.answerBtn, styles.answerYes]}
                        onPress={() => onAnswer(spec, true)}>
                        <Text style={styles.answerYesText}>Sí</Text>
                      </Pressable>
                      <Pressable
                        style={[styles.answerBtn, styles.answerNo]}
                        onPress={() => onAnswer(spec, false)}>
                        <Text style={styles.answerNoText}>No</Text>
                      </Pressable>
                    </View>
                  ) : (
                    <Pressable
                      style={styles.inlineBtn}
                      disabled={emitting !== null}
                      onPress={() => onEmit(spec)}>
                      <Volume2 size={14} color="#0D9488" />
                      <Text style={styles.inlineBtnText}>
                        {emitting === spec.id
                          ? t.diagnosticoAudio.emitiendo
                          : answered
                            ? t.diagnosticoAudio.repetirEmision
                            : t.diagnosticoAudio.reproducir}
                      </Text>
                    </Pressable>
                  )}
                </View>
              );
            })}
          </View>
        ) : null}

        {checks.length > 0 && !running ? (
          <View style={styles.summaryBox}>
            <Text style={styles.summaryTitle}>{t.diagnosticoAudio.resumenIncidencia}</Text>
            <Text style={styles.summaryHint}>
              
              {t.diagnosticoAudio.hagaCapturaEsteBloqueAdjuntela}
            </Text>
            <Text selectable style={styles.summaryText}>
              {summaryText(checks)}
            </Text>
          </View>
        ) : null}

        {!hasTts && !checks.length ? (
          <Text style={styles.footNote}>
            
            {t.diagnosticoAudio.nadaMideEstaPantallaGuarda}
          </Text>
        ) : null}
      </ScrollView>
    </View>
  );
}

const MONO = Platform.OS === 'ios' ? 'Courier' : 'monospace';

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F5F2EC' },
  content: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 48, maxWidth: 760, alignSelf: 'center', width: '100%' },
  back: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 18, alignSelf: 'flex-start' },
  backText: { fontSize: 15, color: '#524B42', fontWeight: '600' },
  eyebrow: { fontFamily: MONO, fontSize: 11, fontWeight: '700', letterSpacing: 1.8, color: '#B45309' },
  title: { fontSize: 32, fontWeight: '800', letterSpacing: -0.8, color: '#2B2620', marginTop: 6 },
  lead: { fontSize: 15, lineHeight: 23, color: '#524B42', marginTop: 10, marginBottom: 20 },

  cta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: '#FF7F00', borderRadius: 22, paddingVertical: 14, paddingHorizontal: 24,
  },
  ctaPressed: { opacity: 0.9 },
  ctaOff: { opacity: 0.7 },
  ctaText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  step: { fontFamily: MONO, fontSize: 12, color: '#8C8275', marginTop: 12, textAlign: 'center' },

  verdict: { borderRadius: 14, padding: 14, marginTop: 18 },
  verdictText: { fontSize: 14, fontWeight: '700', lineHeight: 20 },

  card: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginTop: 12,
    borderWidth: 1, borderColor: '#E8E2D5',
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  cardLabel: { fontSize: 15, fontWeight: '700', color: '#2B2620', flexShrink: 1 },
  pill: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  pillText: { fontFamily: MONO, fontSize: 10, fontWeight: '700', letterSpacing: 0.8 },
  cardDetail: { fontSize: 14, lineHeight: 21, color: '#524B42', marginTop: 8 },
  cardHint: { fontSize: 13, lineHeight: 20, color: '#9A3412', marginTop: 8 },

  listenRow: { marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#EFEAE0' },
  listenLabel: { fontSize: 14, fontWeight: '700', color: '#2B2620' },
  listenWhat: { fontSize: 13, lineHeight: 20, color: '#6E6459', marginTop: 4 },

  inlineBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, alignSelf: 'flex-start' },
  inlineBtnText: { fontSize: 13, fontWeight: '700', color: '#0D9488' },

  answerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12, flexWrap: 'wrap' },
  answerQ: { fontSize: 14, fontWeight: '700', color: '#2B2620' },
  answerBtn: { borderRadius: 10, paddingHorizontal: 18, paddingVertical: 8 },
  answerYes: { backgroundColor: '#DCFCE7' },
  answerYesText: { color: '#1E8049', fontWeight: '700', fontSize: 14 },
  answerNo: { backgroundColor: '#FEE2E2' },
  answerNoText: { color: '#DC2626', fontWeight: '700', fontSize: 14 },

  summaryBox: { backgroundColor: '#2B2620', borderRadius: 16, padding: 16, marginTop: 18 },
  summaryTitle: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  summaryHint: { color: '#C7BDAD', fontSize: 12, marginTop: 4, marginBottom: 10, lineHeight: 18 },
  summaryText: { fontFamily: MONO, fontSize: 11, lineHeight: 17, color: '#F0E9DC' },

  footNote: { fontSize: 12, color: '#8C8275', marginTop: 20, lineHeight: 18 },
});
