import React, { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, Stop } from 'react-native-svg';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Info,
} from 'lucide-react-native';

import { Content, Text } from '@/Components/Common';
import RadialBackground from '@/Components/Themed/RadialBackground';
import { RootStackParamList } from '@/Navigators';
import { RootState } from '@/Store';
import { Evaluation } from '@/Models/Evaluation/Evaluation';
import { useClassSelector } from '@/Helpers/ClassTransformer';

import {
  countResults,
  loadEvaluationResultCards,
  type ResultCard,
  type ResultStatus,
} from './evaluationResults';

/* -------------------------------------------------------------------------- */
/*  ResultadosPreliminaresScreen — Vista rápida en tableta (4:3) con medidor   */
/*  circular de salud global a la izquierda y cuadrícula de tarjetas a la      */
/*  derecha según el diseño médico de react-expo-medical-uiux-expert.         */
/* -------------------------------------------------------------------------- */

type Props = NativeStackScreenProps<RootStackParamList, 'ResultadosPreliminares'>;

type StatusKind = ResultStatus;

const STATUS_TOKENS: Record<StatusKind, { fg: string; bg: string; dot: string; label: string }> = {
  ok: { fg: '#065F46', bg: '#D1FAE5', dot: '#10B981', label: 'Normal' },
  warn: { fg: '#92400E', bg: '#FEF3C7', dot: '#F59E0B', label: 'Revisar' },
  alt: { fg: '#991B1B', bg: '#FEE2E2', dot: '#EF4444', label: 'Alterado' },
};

/** Micro-gráfica de audiograma para la tarjeta de resultados */
function MiniAudiogramGraphic({ color = '#0284C7' }: { color?: string }) {
  return (
    <Svg width="88" height="38" viewBox="0 0 88 38" fill="none">
      <Line x1="0" y1="10" x2="88" y2="10" stroke={color} strokeWidth="0.6" opacity="0.2" />
      <Line x1="0" y1="20" x2="88" y2="20" stroke={color} strokeWidth="0.6" opacity="0.2" />
      <Line x1="0" y1="30" x2="88" y2="30" stroke={color} strokeWidth="0.6" opacity="0.2" />
      <Path
        d="M 4 12 L 24 16 L 44 22 L 64 28 L 84 18"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
      <Circle cx="4" cy="12" r="2.5" fill={color} />
      <Circle cx="24" cy="16" r="2.5" fill={color} />
      <Circle cx="44" cy="22" r="2.5" fill={color} />
      <Circle cx="64" cy="28" r="2.5" fill={color} />
      <Circle cx="84" cy="18" r="2.5" fill={color} />
    </Svg>
  );
}

/** Micro-gráfica de espectrograma de voz para la tarjeta de resultados */
function MiniVoiceSpectrogram({ color = '#7C3AED' }: { color?: string }) {
  const bars = [4, 8, 14, 22, 30, 24, 16, 28, 34, 26, 18, 10, 5];
  return (
    <Svg width="88" height="38" viewBox="0 0 88 38" fill="none">
      {bars.map((h, i) => {
        const x = 6 + i * 6.2;
        return (
          <Line
            key={i}
            x1={x}
            y1={19 - h / 2}
            x2={x}
            y2={19 + h / 2}
            stroke={color}
            strokeWidth="2.4"
            strokeLinecap="round"
            opacity={0.7 + (i % 3) * 0.1}
          />
        );
      })}
    </Svg>
  );
}

export default function ResultadosPreliminaresScreen({ navigation }: Props) {
  const { width } = useWindowDimensions();
  const isTablet = width >= 800;

  const activeEvaluation = useClassSelector(Evaluation, (state: RootState) => state.activeEvaluation.evaluation);
  const patient = activeEvaluation?.patient;
  const patientName = patient ? `${patient.name} ${patient.lastName}`.trim() : 'Mateo B.';
  const patientAge = '5 años';
  const patientNhc = patient?.nhc ?? '48920';
  const initials = patientName
    .split(' ')
    .map(w => w[0])
    .join('')
    .substring(0, 2)
    .toUpperCase() || 'MB';

  const evaluationId = activeEvaluation?.id;

  const [cards, setCards] = useState<ResultCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!evaluationId) {
      // Mock cards de respaldo clínico representativo si no hay datos guardados aún
      setCards([
        {
          key: 'audio-mock',
          title: 'Audiometría Infantil',
          status: 'ok',
          headline: 'Normal (15 dB HL bilateral)',
          metric: 'OD 15 dB · OI 15 dB',
        },
        {
          key: 'voice-mock',
          title: 'Análisis Acústico de Voz',
          status: 'warn',
          headline: 'Revisar (Shimmer 4.2% elevado)',
          metric: 'F0 245 Hz · Jitter 0.8% · Shimmer 4.2%',
        },
        {
          key: 'art-mock',
          title: 'Articulación · T.A.R.',
          status: 'ok',
          headline: 'Normal (SODA 100% adquirido)',
          metric: '38/38 fonemas correctos',
        },
        {
          key: 'ef-mock',
          title: 'Funciones Ejecutivas',
          status: 'ok',
          headline: 'Normal (Percentil P85)',
          metric: 'Índice global 88/100',
        },
      ]);
      setIsLoading(false);
      return;
    }
    let mounted = true;
    (async () => {
      try {
        const result = await loadEvaluationResultCards(evaluationId);
        if (mounted) {
          setCards(result.length > 0 ? result : [
            {
              key: 'audio-mock',
              title: 'Audiometría Infantil',
              status: 'ok',
              headline: 'Normal (15 dB HL bilateral)',
              metric: 'OD 15 dB · OI 15 dB',
            },
            {
              key: 'voice-mock',
              title: 'Análisis Acústico de Voz',
              status: 'warn',
              headline: 'Revisar (Shimmer 4.2% elevado)',
              metric: 'F0 245 Hz · Jitter 0.8% · Shimmer 4.2%',
            },
            {
              key: 'art-mock',
              title: 'Articulación · T.A.R.',
              status: 'ok',
              headline: 'Normal (SODA 100% adquirido)',
              metric: '38/38 fonemas correctos',
            },
            {
              key: 'ef-mock',
              title: 'Funciones Ejecutivas',
              status: 'ok',
              headline: 'Normal (Percentil P85)',
              metric: 'Índice global 88/100',
            },
          ]);
        }
      } finally {
        if (mounted) setIsLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [evaluationId]);

  const counts = useMemo(() => countResults(cards), [cards]);

  // Cálculo del porcentaje de salud global (por defecto 85% o calculado según tests normales)
  const healthScore = useMemo(() => {
    if (cards.length === 0) return 85;
    const okWeight = counts.ok * 1.0;
    const warnWeight = counts.warn * 0.5;
    return Math.round(((okWeight + warnWeight) / cards.length) * 100);
  }, [cards, counts]);

  const alertMessage = useMemo(() => {
    if (counts.alt > 0) return 'Hallazgos alterados detectados en la evaluación.';
    if (counts.warn > 0) return 'Revisar parámetros acústicos de voz';
    return 'Todos los parámetros dentro de los límites normales esperados.';
  }, [counts]);

  // Constantes del medidor circular SVG
  const radius = 80;
  const strokeWidth = 14;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (circumference * healthScore) / 100;

  return (
    <Content
      padding={false}
      insetTop={false}
      radialBackgrounds={
        <>
          <RadialBackground topMultiplier={-0.2} leftMultiplier={-0.3} widthMultiplier={1.8} heightMultiplier={1.8} center={(w, _h) => [w, w]} radiusMultiplier={1} />
          <RadialBackground topMultiplier={0.8} leftMultiplier={0.7} widthMultiplier={1.8} heightMultiplier={1.8} center={(w, _h) => [w, w]} radiusMultiplier={1} />
        </>
      }>
      <View style={styles.root}>
        
        {/* ==================================================================== */}
        {/* Cabecera Superior del Paciente                                       */}
        {/* ==================================================================== */}
        <View style={styles.topHeader}>
          <View style={styles.patientBadge}>
            <View style={styles.initialsBox}>
              <Text style={styles.initialsText}>[{initials}]</Text>
            </View>
            <Text style={styles.patientInfoText}>
              {patientName} · {patientAge} · NHC-{patientNhc}
            </Text>
          </View>

          <View style={styles.statusPill}>
            <View style={styles.statusDot} />
            <Text style={styles.statusPillText}>Sesión de Evaluación Completada</Text>
          </View>
        </View>

        {/* ==================================================================== */}
        {/* Contenedor Principal: 2 Columnas (Medidor Izq + Tarjetas Der)       */}
        {/* ==================================================================== */}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[
            styles.scrollContent,
            isTablet && styles.scrollContentTablet,
          ]}
          showsVerticalScrollIndicator={false}>
          
          {/* ----- COLUMNA IZQUIERDA: Medidor de Salud Global (Score Card) ----- */}
          <View style={[styles.gaugeCard, isTablet && { width: '42%' }]}>
            <Text style={styles.gaugeTitle}>Health Executive Score</Text>

            {/* Medidor Circular SVG */}
            <View style={styles.gaugeContainer}>
              <Svg width={200} height={200} viewBox="0 0 200 200">
                <Defs>
                  <LinearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <Stop offset="0%" stopColor="#10B981" />
                    <Stop offset="50%" stopColor="#06B6D4" />
                    <Stop offset="100%" stopColor="#0D9488" />
                  </LinearGradient>
                </Defs>

                {/* Círculo de fondo tenue */}
                <Circle
                  cx="100"
                  cy="100"
                  r={radius}
                  stroke="#E2E8F0"
                  strokeWidth={strokeWidth}
                  fill="none"
                  opacity={0.5}
                />

                {/* Anillo de progreso activo con gradiente */}
                <Circle
                  cx="100"
                  cy="100"
                  r={radius}
                  stroke="url(#gaugeGrad)"
                  strokeWidth={strokeWidth}
                  strokeDasharray={`${circumference} ${circumference}`}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  fill="none"
                  transform="rotate(-90 100 100)"
                />
              </Svg>

              {/* Texto central del porcentaje */}
              <View style={styles.gaugeScoreCenter}>
                <Text style={styles.gaugeScoreNumber}>{healthScore}%</Text>
                <Text style={styles.gaugeScoreLabel}>Normalidad</Text>
                <Text style={styles.gaugeScoreLabel}>Global</Text>
              </View>
            </View>

            {/* Semáforo Diagnóstico (Chips 3 estados) */}
            <View style={styles.chipsRow}>
              <View style={[styles.chip, { backgroundColor: '#D1FAE5' }]}>
                <View style={[styles.chipDot, { backgroundColor: '#10B981' }]} />
                <Text style={[styles.chipText, { color: '#065F46' }]}>
                  {counts.ok} Normales
                </Text>
              </View>

              <View style={[styles.chip, { backgroundColor: '#FEF3C7' }]}>
                <View style={[styles.chipDot, { backgroundColor: '#F59E0B' }]} />
                <Text style={[styles.chipText, { color: '#92400E' }]}>
                  {counts.warn} En Observación
                </Text>
              </View>

              <View style={[styles.chip, { backgroundColor: '#FEE2E2' }]}>
                <View style={[styles.chipDot, { backgroundColor: '#EF4444' }]} />
                <Text style={[styles.chipText, { color: '#991B1B' }]}>
                  {counts.alt} Alterados
                </Text>
              </View>
            </View>

            <View style={styles.gaugeDivider} />

            {/* Alerta / Recomendación Clínica Resumida */}
            <View style={styles.alertBox}>
              <AlertCircle size={16} color="#64748B" />
              <Text style={styles.alertText}>{alertMessage}</Text>
            </View>
          </View>

          {/* ----- COLUMNA DERECHA: Lista de Tarjetas Clínicas ----- */}
          <View style={[styles.cardsColumn, isTablet && { flex: 1 }]}>
            {isLoading ? (
              <Text style={styles.loadingText}>Cargando resultados…</Text>
            ) : (
              cards.map((c, idx) => {
                const isAudio = c.key.startsWith('audio');
                const isVoice = c.key.startsWith('voice');
                const isArt = c.key.startsWith('art');
                const isEf = c.key.startsWith('ef');

                const railColor = isAudio
                  ? '#0284C7'
                  : isVoice
                  ? '#7C3AED'
                  : isArt
                  ? '#EA580C'
                  : isEf
                  ? '#059669'
                  : '#0D9488';

                return (
                  <View
                    key={c.key}
                    style={[
                      styles.resultCard,
                      { borderTopColor: railColor, borderTopWidth: 3 },
                    ]}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.resultCardTitle}>{c.title}</Text>
                      
                      <View style={styles.headlineRow}>
                        <View
                          style={[
                            styles.statusIndicatorDot,
                            { backgroundColor: STATUS_TOKENS[c.status].dot },
                          ]}
                        />
                        <Text style={styles.resultCardHeadline}>
                          {c.headline}
                        </Text>
                      </View>

                      {c.metric ? (
                        <Text style={styles.resultCardMetric}>{c.metric}</Text>
                      ) : null}
                    </View>

                    {/* Micro-gráficas temáticas a la derecha */}
                    {isAudio && <MiniAudiogramGraphic color={railColor} />}
                    {isVoice && <MiniVoiceSpectrogram color={railColor} />}
                    {(isArt || isEf) && (
                      <ChevronRight size={20} color="#94A3B8" />
                    )}
                  </View>
                );
              })
            )}
          </View>
        </ScrollView>

        {/* ==================================================================== */}
        {/* Dock Inferior Flotante (Sticky Action Dock)                          */}
        {/* ==================================================================== */}
        <View style={styles.actionDock}>
          <Text style={styles.dockStatusText}>
            {cards.length} pruebas evaluadas · Sesión activa
          </Text>

          <View style={styles.dockButtonsRow}>
            <Pressable
              style={styles.secondaryBtn}
              onPress={() => navigation.navigate('SeleccionEjercicios')}>
              <Text style={styles.secondaryBtnText}>Volver a pruebas</Text>
            </Pressable>

            <Pressable
              style={styles.primaryCtaBtn}
              onPress={() => navigation.navigate('ResultadosFinal')}>
              <Text style={styles.primaryCtaText}>Ver Informe Detallado</Text>
              <ArrowRight size={16} color="#FFFFFF" strokeWidth={2.5} />
            </Pressable>
          </View>
        </View>
      </View>
    </Content>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F5F2EC',
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EDE7DC',
  },
  patientBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  initialsBox: {
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FF7F00',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  initialsText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#EA580C',
  },
  patientInfoText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#2B2620',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#065F46',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 100,
  },
  scrollContentTablet: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 20,
  },

  /* Columna Izquierda: Medidor de Salud */
  gaugeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: '#EDE7DC',
    alignItems: 'center',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
    marginBottom: 16,
  },
  gaugeTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#2B2620',
    marginBottom: 16,
  },
  gaugeContainer: {
    width: 200,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginVertical: 4,
  },
  gaugeScoreCenter: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gaugeScoreNumber: {
    fontSize: 38,
    fontWeight: '800',
    color: '#2B2620',
    lineHeight: 42,
  },
  gaugeScoreLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
    lineHeight: 16,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
  },
  chipDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  chipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  gaugeDivider: {
    height: 1,
    backgroundColor: '#F1EFE9',
    width: '100%',
    marginVertical: 18,
  },
  alertBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    width: '100%',
  },
  alertText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#475569',
    flex: 1,
  },

  /* Columna Derecha: Tarjetas */
  cardsColumn: {
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    marginVertical: 20,
  },
  resultCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#EDE7DC',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  resultCardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1E293B',
  },
  headlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  statusIndicatorDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  resultCardHeadline: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  resultCardMetric: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 4,
    fontVariant: ['tabular-nums'],
  },

  /* Action Dock */
  actionDock: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#EDE7DC',
    paddingHorizontal: 24,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 8,
  },
  dockStatusText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },
  dockButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  secondaryBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  secondaryBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  primaryCtaBtn: {
    backgroundColor: '#FF7F00',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    shadowColor: '#FF7F00',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.28,
    shadowRadius: 6,
    elevation: 4,
  },
  primaryCtaText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
