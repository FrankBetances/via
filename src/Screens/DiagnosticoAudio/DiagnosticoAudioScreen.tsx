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
import {
  CAPTURE_PROBE_MS,
  TEST_TONE_HZ,
  checkMicCapture,
  checkMicPermission,
  checkNativeEngine,
  checkOutputContext,
  checkSystemVoice,
  checkVoiceBank,
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
/*  Dos comprobaciones no las puede hacer la máquina —si el tono SE OYE y si   */
/*  la locución SE OYE— así que se preguntan en vez de darlas por buenas: un   */
/*  «reproducido correctamente» sobre un altavoz mudo sería exactamente el     */
/*  tipo de falso positivo que esta pantalla viene a eliminar.                 */
/* -------------------------------------------------------------------------- */

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
  const navigation = useNavigation();
  const [checks, setChecks] = useState<CheckResult[]>([]);
  const [running, setRunning] = useState(false);
  const [step, setStep] = useState<string | null>(null);
  /** Pregunta pendiente al profesional (lo que la máquina no puede medir). */
  const [askTone, setAskTone] = useState(false);
  const [retrying, setRetrying] = useState(false);
  // Un `run` nuevo invalida al anterior: pulsar «repetir» a mitad de una toma
  // no debe mezclar los resultados de las dos pasadas.
  const runToken = useRef(0);

  const run = useCallback(async () => {
    const mine = ++runToken.current;
    setRunning(true);
    setChecks([]);
    setAskTone(false);

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

    setStep('Sintetizador del sistema…');
    push(checkSystemVoice());

    setStep('Permiso de micrófono…');
    push(await checkMicPermission(requestMic));

    setStep(`Grabando ${CAPTURE_PROBE_MS / 1000} s para medir la captura…`);
    push(await checkMicCapture());

    if (mine !== runToken.current) return;
    setStep(null);
    setRunning(false);
  }, []);

  const onPlayTone = () => {
    const scheduled = playTestTone();
    setAskTone(scheduled);
    if (!scheduled) {
      setChecks(prev => [
        ...prev.filter(c => c.id !== 'tone'),
        {
          id: 'tone',
          label: 'Tono de prueba por el altavoz',
          status: 'fail',
          detail: 'El tono no llegó ni a programarse: no hay contexto de salida.',
        },
      ]);
    }
  };

  const answerTone = (heard: boolean) => {
    setAskTone(false);
    setChecks(prev => [
      ...prev.filter(c => c.id !== 'tone'),
      {
        id: 'tone',
        label: 'Tono de prueba por el altavoz',
        status: heard ? 'ok' : 'fail',
        detail: heard
          ? `Tono de ${TEST_TONE_HZ} Hz emitido y OÍDO por el profesional.`
          : `Tono de ${TEST_TONE_HZ} Hz emitido pero NO se oyó.`,
        hint: heard
          ? undefined
          : 'El motor programó el tono y aun así no suena: revise el volumen de multimedia, el silencio del sistema y si hay un accesorio Bluetooth capturando la salida.',
      },
    ]);
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

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Pressable style={styles.back} onPress={() => navigation.goBack()}>
          <ArrowLeft size={18} color="#524B42" />
          <Text style={styles.backText}>Volver</Text>
        </Pressable>

        <Text style={styles.eyebrow}>DIAGNÓSTICO DEL DISPOSITIVO</Text>
        <Text style={styles.title}>Comprobación de audio</Text>
        <Text style={styles.lead}>
          Recorre la cadena completa —motor nativo, altavoz, banco de locuciones, sintetizador del
          sistema y micrófono— y dice exactamente qué eslabón falla. Ejecútela en el mismo equipo y
          la misma sala donde las pruebas no funcionan.
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
            {running ? 'Comprobando…' : checks.length ? 'Repetir comprobación' : 'Iniciar comprobación'}
          </Text>
        </Pressable>

        {step ? <Text style={styles.step}>{step}</Text> : null}

        {checks.length > 0 && !running ? (
          <View style={[styles.verdict, { backgroundColor: STATUS_SOFT[overall] }]}>
            <Text style={[styles.verdictText, { color: STATUS_COLOR[overall] }]}>
              {overall === 'ok'
                ? 'Toda la cadena de audio responde en este dispositivo.'
                : overall === 'warn'
                  ? 'La cadena responde, pero hay avisos que degradan las pruebas.'
                  : 'Hay al menos un eslabón roto: las pruebas de voz no pueden funcionar así.'}
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
                  {retrying ? 'Reintentando…' : 'Reintentar el motor de voz'}
                </Text>
              </Pressable>
            ) : null}
          </View>
        ))}

        {/* Comprobación que solo puede cerrar el oído humano. */}
        {checks.length > 0 && !running ? (
          <View style={styles.card}>
            <View style={styles.cardHead}>
              <Text style={styles.cardLabel}>Prueba de escucha</Text>
              <Ear size={18} color="#8C8275" />
            </View>
            <Text style={styles.cardDetail}>
              Que el motor programe un tono no prueba que el altavoz lo emita. Reprodúzcalo y
              conteste si lo ha oído.
            </Text>
            {askTone ? (
              <View style={styles.answerRow}>
                <Text style={styles.answerQ}>¿Ha oído el tono?</Text>
                <Pressable style={[styles.answerBtn, styles.answerYes]} onPress={() => answerTone(true)}>
                  <Text style={styles.answerYesText}>Sí</Text>
                </Pressable>
                <Pressable style={[styles.answerBtn, styles.answerNo]} onPress={() => answerTone(false)}>
                  <Text style={styles.answerNoText}>No</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable style={styles.inlineBtn} onPress={onPlayTone}>
                <Volume2 size={14} color="#0D9488" />
                <Text style={styles.inlineBtnText}>Reproducir tono de {TEST_TONE_HZ} Hz</Text>
              </Pressable>
            )}
          </View>
        ) : null}

        {checks.length > 0 && !running ? (
          <View style={styles.summaryBox}>
            <Text style={styles.summaryTitle}>Resumen para incidencia</Text>
            <Text style={styles.summaryHint}>
              Haga una captura de este bloque y adjúntela: nombra el eslabón roto sin ambigüedad.
            </Text>
            <Text selectable style={styles.summaryText}>
              {summaryText(checks)}
            </Text>
          </View>
        ) : null}

        {!hasTts && !checks.length ? (
          <Text style={styles.footNote}>
            Nada de lo que mide esta pantalla se guarda ni se envía: se ejecuta y se muestra en el
            dispositivo.
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
