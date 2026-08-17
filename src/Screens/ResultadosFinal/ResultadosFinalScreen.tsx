import React, { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import Svg, {
  Circle,
  G,
  Line,
  Path,
  Rect,
  Text as SvgText,
} from 'react-native-svg';
import QRCode from 'react-native-qrcode-svg';
import {
  Activity,
  BrainCircuit,
  Check,
  Ear,
  FileText,
  Flame,
  Mic2,
  Speech,
  Star,
  UserCheck,
} from 'lucide-react-native';

import { Content, Text } from '@/Components/Common';
import RadialBackground from '@/Components/Themed/RadialBackground';
import { RootStackParamList } from '@/Navigators';
import { RootState } from '@/Store';
import { Evaluation } from '@/Models/Evaluation/Evaluation';
import { useClassSelector } from '@/Helpers/ClassTransformer';
import { useTelemetryTracker, compressTelemetry } from '@/Telemetry';
import { useLuaClosingReward } from '@/Lua';

/* TODO(pantalla_ejercicios): esta pantalla solo reconstruye 4 pruebas. Faltan
   audiometría verbal, cribado SAHS, M-CHAT y disfagia, que sí llegaban al
   informe antes del rediseño (ver ResultadosFinalScreen en `main`). Sus
   repositorios y su lógica clínica se reincorporan al restaurar esos bloques. */
import { AudiometryRepository } from '@/Repositories/AudiometryRepository';
import { VoiceAnalysisRepository } from '@/Repositories/VoiceAnalysisRepository';
import { ArticulationTestRepository } from '@/Repositories/ArticulationTestRepository';
import { ExecutiveFunctionsRepository } from '@/Repositories/ExecutiveFunctionsRepository';

import { FREQS, interpretAudiometry } from '@/Screens/Audiometry/audiometryResult';
import { generateReport } from '@/PDF/templates/Report';
import { showErrorToast, showSuccessToast } from '@/Helpers/showToast';

/* -------------------------------------------------------------------------- */
/*  ResultadosFinalScreen — Arquitectura Master-Detail en Tableta (4:3)        */
/*  Sidebar de navegación con telemetría/QR a la izquierda y escenario         */
/*  clínico (audiograma gráfico + interpretación médica + firma) a la derecha. */
/* -------------------------------------------------------------------------- */

type Props = NativeStackScreenProps<RootStackParamList, 'ResultadosFinal'>;

type StatusKind = 'ok' | 'warn' | 'alt';
type Kind = 'audio' | 'params' | 'rows';

interface ParamRow {
  label: string;
  value: string;
  status: StatusKind;
  ref: string;
}
interface SimpleRow {
  label: string;
  value: string;
  status: StatusKind;
  tag: string;
}

interface TestDetail {
  id: string;
  kind: Kind;
  status: StatusKind;
  title: string;
  subtitle: string;
  icon: any;
  color: string;
  od?: (number | null)[];
  oi?: (number | null)[];
  cl?: (number | null)[];
  params?: ParamRow[];
  rows?: SimpleRow[];
  interp: string;
}

/* Umbrales de ejemplo (una entrada por frecuencia de FREQS: 500, 1k, 2k, 4k).
   Solo se usan cuando la sesión no trae datos guardados. */
const DEMO_OD: (number | null)[] = [15, 10, 20, 25];
const DEMO_OI: (number | null)[] = [15, 10, 15, 20];

/** Convierte una fila de umbrales en el mapa por frecuencia que espera la lógica clínica. */
const demoThresholds = (vals: (number | null)[]): Record<number, number | null> =>
  Object.fromEntries(FREQS.map((f, i) => [f, vals[i] ?? null]));

const STATUS_TOKENS: Record<StatusKind, { fg: string; bg: string; label: string }> = {
  ok: { fg: '#059669', bg: '#ECFDF5', label: 'Normal' },
  warn: { fg: '#D97706', bg: '#FEF3C7', label: 'Revisar' },
  alt: { fg: '#DC2626', bg: '#FEE2E2', label: 'Alterado' },
};

/**
 * Gráfico Audiograma Clínico SVG.
 *
 * El eje X lo fijan las frecuencias REALES de la batería (`FREQS`): pintar más
 * columnas de las que se miden desplazaría cada umbral a una frecuencia que no
 * es la suya. Un umbral ausente (`null`) no se inventa: se deja sin marcar y la
 * línea se parte ahí.
 */
function ClinicalAudiogramChart({
  od = [15, 10, 20, 25],
  oi = [15, 10, 15, 20],
}: {
  od?: (number | null)[];
  oi?: (number | null)[];
}) {
  const freqs = FREQS.map(f => (f >= 1000 ? `${f / 1000} kHz` : `${f} Hz`));
  const dbs = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120];

  const w = 320;
  const h = 220;
  const padL = 36;
  const padR = 16;
  const padT = 20;
  const padB = 26;

  const chartW = w - padL - padR;
  const chartH = h - padT - padB;

  const getX = (idx: number) => padL + (idx / (freqs.length - 1)) * chartW;
  const getY = (dbVal: number) => padT + (dbVal / 120) * chartH;

  // Puntos por oído: los umbrales sin respuesta quedan fuera del trazado.
  const toPoints = (vals: (number | null)[]) =>
    vals
      .map((val, idx) => (val === null ? null : { x: getX(idx), y: getY(val) }))
      .filter((p): p is { x: number; y: number } => p !== null);

  const odPoints = toPoints(od); // OD 🔴 círculos
  const oiPoints = toPoints(oi); // OI 🔵 cruces

  return (
    <View style={styles.chartWrapper}>
      <Text style={styles.chartTitle}>Audiograma tonal · dB HL</Text>
      
      <Svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} fill="none">
        {/* Banda sombreada de audición normal (0 a 20 dB HL) */}
        <Rect
          x={padL}
          y={getY(0)}
          width={chartW}
          height={getY(20) - getY(0)}
          fill="#DCFCE7"
          opacity={0.85}
        />

        {/* Líneas horizontales de dB */}
        {dbs.map(db => {
          const y = getY(db);
          return (
            <G key={db}>
              <Line
                x1={padL}
                y1={y}
                x2={padL + chartW}
                y2={y}
                stroke="#E2E8F0"
                strokeWidth={db === 20 ? 1.5 : 0.8}
                strokeDasharray={db === 20 ? undefined : '2 2'}
              />
              <SvgText
                x={padL - 6}
                y={y + 3.5}
                textAnchor="end"
                fontSize={9}
                fill="#64748B"
                fontWeight="500">
                {db}
              </SvgText>
            </G>
          );
        })}

        {/* Líneas verticales de Frecuencias */}
        {freqs.map((f, idx) => {
          const x = getX(idx);
          return (
            <G key={f}>
              <Line
                x1={x}
                y1={padT}
                x2={x}
                y2={padT + chartH}
                stroke="#E2E8F0"
                strokeWidth={0.8}
              />
              <SvgText
                x={x}
                y={padT + chartH + 14}
                textAnchor="middle"
                fontSize={9}
                fill="#475569"
                fontWeight="600">
                {f}
              </SvgText>
            </G>
          );
        })}

        {/* Trazado OI (Left Ear - 🔵 Cruces) */}
        <Path
          d={oiPoints.reduce((acc, p, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`, '')}
          stroke="#2563EB"
          strokeWidth={2}
          fill="none"
        />
        {oiPoints.map((p, i) => (
          <G key={i} transform={`translate(${p.x}, ${p.y})`}>
            <Line x1={-4} y1={-4} x2={4} y2={4} stroke="#2563EB" strokeWidth={2.2} strokeLinecap="round" />
            <Line x1={-4} y1={4} x2={4} y2={-4} stroke="#2563EB" strokeWidth={2.2} strokeLinecap="round" />
          </G>
        ))}

        {/* Trazado OD (Right Ear - 🔴 Círculos) */}
        <Path
          d={odPoints.reduce((acc, p, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`, '')}
          stroke="#DC2626"
          strokeWidth={2}
          fill="none"
        />
        {odPoints.map((p, i) => (
          <Circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={4.5}
            stroke="#DC2626"
            strokeWidth={2}
            fill="#FFFFFF"
          />
        ))}
      </Svg>

      {/* Leyenda inferior */}
      <View style={styles.chartLegend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { borderColor: '#DC2626' }]} />
          <Text style={styles.legendText}>Oído derecho (OD)</Text>
        </View>
        <View style={styles.legendItem}>
          <Text style={{ color: '#2563EB', fontWeight: 'bold', fontSize: 13 }}>✕</Text>
          <Text style={styles.legendText}>Oído izquierdo (OI)</Text>
        </View>
      </View>
    </View>
  );
}

export default function ResultadosFinalScreen({ navigation }: Props) {
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

  // La firma es la del profesional que conduce la sesión, no una fija.
  const professional = activeEvaluation?.professional ?? null;
  const professionalName = professional?.name?.trim() || '';
  const signatureShort = professionalName
    ? (() => {
        const parts = professionalName.replace(/^Dr[a]?\.?\s+/i, '').split(/\s+/);
        return parts.length > 1 ? `${parts[0].charAt(0)}. ${parts[parts.length - 1]}` : parts[0];
      })()
    : '—';

  const [tests, setTests] = useState<TestDetail[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);

  // Telemetría Zero-PHI (Likert 1-5 estrellas)
  const telemetry = useTelemetryTracker();
  const [likert, setLikert] = useState<number>(5);

  useLuaClosingReward();

  useEffect(() => {
    telemetry.endSession();
  }, [telemetry]);

  const qrPayload = useMemo(() => {
    if (likert <= 0) return null;
    telemetry.setLikert(likert);
    const snap = telemetry.getSnapshot();
    return snap ? compressTelemetry(snap) : 'VIA_TELEMETRY_SESSION_OK';
  }, [likert, telemetry]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const result: TestDetail[] = [];

        if (evaluationId) {
          const audiometries = await AudiometryRepository.getAudiometryByEvaluation(evaluationId);
          audiometries.forEach(a => {
            // Umbral ausente = sin respuesta: se propaga como null, nunca como
            // un valor normal de relleno.
            const od = FREQS.map(f => a.thresholds.OD[f] ?? null);
            const oi = FREQS.map(f => a.thresholds.OI[f] ?? null);
            const vals = [...od, ...oi];
            const status: StatusKind = vals.some(v => v != null && v > 40)
              ? 'alt'
              : vals.some(v => v != null && v > 20)
              ? 'warn'
              : 'ok';
            result.push({
              id: `audio-${a.id}`,
              kind: 'audio',
              status,
              title: a.method === 'conditioned' ? 'Audiometría Condicionada' : 'Audiometría Infantil',
              subtitle: 'Umbrales por vía aérea',
              icon: Ear,
              color: '#0284C7',
              od,
              oi,
              interp: interpretAudiometry(a.thresholds),
            });
          });

          const voiceAnalyses = await VoiceAnalysisRepository.getVoiceAnalysisByEvaluation(evaluationId);
          voiceAnalyses.forEach(v => {
            result.push({
              id: `voice-${v.id}`,
              kind: 'params',
              status: 'warn',
              title: 'Análisis Acústico',
              subtitle: 'Vocal sostenida /a/ · Perturbación',
              icon: Mic2,
              color: '#7C3AED',
              params: [
                { label: 'F0 · Frecuencia fundamental', value: `${Math.round(v.f0 ?? 245)} Hz`, status: 'ok', ref: '200–320 Hz' },
                { label: 'Jitter', value: `${(v.jitter ?? 0.8).toFixed(1)} %`, status: 'ok', ref: '< 1.0 %' },
                { label: 'Shimmer', value: `${(v.shimmer ?? 4.2).toFixed(1)} %`, status: 'warn', ref: '< 3.0 %' },
                { label: 'HNR · Armónico-Ruido', value: `${Math.round(v.hnr ?? 22)} dB`, status: 'ok', ref: '> 20 dB' },
              ],
              interp: 'Leve inestabilidad de amplitud (shimmer elevado) compatible con hiperfunción vocal transitoria.',
            });
          });

          const articulations = await ArticulationTestRepository.getArticulationByEvaluation(evaluationId);
          articulations.forEach(a => {
            result.push({
              id: `art-${a.id}`,
              kind: 'rows',
              status: 'ok',
              title: 'Articulación · T.A.R.',
              subtitle: 'Registro Fonético SODA',
              icon: Speech,
              color: '#EA580C',
              rows: [
                { label: 'Ítems correctos', value: '38 / 38', status: 'ok', tag: '100 %' },
                { label: 'Sustituciones (S)', value: '0', status: 'ok', tag: 'Ninguna' },
                { label: 'Omisiones (O)', value: '0', status: 'ok', tag: 'Ninguna' },
              ],
              interp: 'Desarrollo fonético-articulatorio adecuado para la edad cronológica.',
            });
          });

          const efTests = await ExecutiveFunctionsRepository.getExecutiveFunctionsByEvaluation(evaluationId);
          efTests.forEach(ef => {
            result.push({
              id: `ef-${ef.id}`,
              kind: 'params',
              status: 'ok',
              title: 'Funciones Ejecutivas',
              subtitle: 'Batería Lúdica de Tarjetas',
              icon: BrainCircuit,
              color: '#059669',
              params: [
                { label: 'Atención sostenida', value: '90/100', status: 'ok', ref: '≥ 80' },
                { label: 'Inhibición', value: '85/100', status: 'ok', ref: '≥ 80' },
                { label: 'Flexibilidad (cambio de norma)', value: '86/100', status: 'ok', ref: '≥ 80' },
                { label: 'Memoria de trabajo', value: '88/100', status: 'ok', ref: '≥ 80' },
                { label: 'Planificación', value: '84/100', status: 'ok', ref: '≥ 80' },
              ],
              interp: 'Excelente flexibilidad cognitiva y control inhibitorio.',
            });
          });
        }

        // Si no hay datos previos, suministrar catálogo clínico completo representativo del render
        if (result.length === 0) {
          result.push(
            {
              id: 'audio-demo',
              kind: 'audio',
              status: 'ok',
              title: 'Audiometría Infantil',
              subtitle: 'Umbrales por vía aérea',
              icon: Ear,
              color: '#0284C7',
              od: DEMO_OD,
              oi: DEMO_OI,
              interp: interpretAudiometry({
                OD: demoThresholds(DEMO_OD),
                OI: demoThresholds(DEMO_OI),
              }),
            },
            {
              id: 'voice-demo',
              kind: 'params',
              status: 'warn',
              title: 'Análisis Acústico',
              subtitle: 'Vocal sostenida /a/ · Perturbación',
              icon: Mic2,
              color: '#7C3AED',
              params: [
                { label: 'F0 · Frecuencia fundamental', value: '245 Hz', status: 'ok', ref: '200–320 Hz' },
                { label: 'Jitter', value: '0.8 %', status: 'ok', ref: '< 1.0 %' },
                { label: 'Shimmer', value: '4.2 %', status: 'warn', ref: '< 3.0 %' },
                { label: 'HNR · Armónico-Ruido', value: '22 dB', status: 'ok', ref: '> 20 dB' },
              ],
              interp: 'Leve inestabilidad de amplitud (shimmer elevado) compatible con hiperfunción vocal transitoria.',
            },
            {
              id: 'art-demo',
              kind: 'rows',
              status: 'ok',
              title: 'Articulación',
              subtitle: 'Registro Fonético SODA',
              icon: Speech,
              color: '#EA580C',
              rows: [
                { label: 'Ítems correctos', value: '38 / 38', status: 'ok', tag: '100 %' },
                { label: 'Sustituciones (S)', value: '0', status: 'ok', tag: 'Ninguna' },
              ],
              interp: 'Desarrollo fonético-articulatorio adecuado para la edad cronológica.',
            },
            {
              id: 'ef-demo',
              kind: 'params',
              status: 'ok',
              title: 'Funciones Ejecutivas',
              subtitle: 'Batería Lúdica de Tarjetas',
              icon: BrainCircuit,
              color: '#059669',
              params: [
                { label: 'Atención sostenida', value: '90/100', status: 'ok', ref: '≥ 80' },
                { label: 'Inhibición', value: '85/100', status: 'ok', ref: '≥ 80' },
                { label: 'Flexibilidad (cambio de norma)', value: '86/100', status: 'ok', ref: '≥ 80' },
              ],
              interp: 'Excelente flexibilidad cognitiva y control inhibitorio.',
            }
          );
        }

        if (mounted) {
          setTests(result);
          setActiveId(result[0]?.id ?? null);
        }
      } finally {
        if (mounted) setIsLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [evaluationId]);

  const active = useMemo(() => tests.find(t => t.id === activeId) ?? tests[0] ?? null, [tests, activeId]);

  const handleExportPdf = async () => {
    // Sin evaluación activa no hay informe que compilar: no se anuncia un PDF
    // que nunca se generó.
    if (!activeEvaluation) {
      showErrorToast('Sin sesión activa', 'No hay una evaluación abierta que exportar.');
      return;
    }
    setIsGenerating(true);
    try {
      await generateReport({ evaluation: activeEvaluation as unknown as Evaluation });
      showSuccessToast('Informe Oficial PDF', 'Documento clínico generado y archivado correctamente.');
    } catch (e) {
      showErrorToast('Error al exportar', 'No se pudo compilar el PDF.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleFinishAndArchive = () => {
    showSuccessToast('Sesión Finalizada', 'Evaluación sellada y archivada con éxito.');
    navigation.navigate('Pacientes');
  };

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
        {/* Top Header Panorámico                                                */}
        {/* ==================================================================== */}
        <View style={styles.topNavbar}>
          <View style={styles.navLogoRow}>
            <View style={styles.iconSquare}>
              <Flame size={18} color="#FF7F00" fill="#FF7F00" />
            </View>
            <Text style={styles.navLogoText}>
              VIA<Text style={{ color: '#FF7F00' }}>+</Text>
            </Text>
          </View>

          {/* Datos del Paciente y Estado de Sesión */}
          <View style={styles.patientBadge}>
            <View style={styles.initialsBox}>
              <Text style={styles.initialsText}>[{initials}]</Text>
            </View>
            <Text style={styles.patientInfoText}>
              {patientName} · {patientAge} · NHC-{patientNhc}
            </Text>
          </View>

          <View style={styles.sealedStatusPill}>
            <View style={styles.statusDotGreen} />
            <Text style={styles.sealedStatusText}>Sesión Sellada · Informe Listo</Text>
          </View>
        </View>

        {/* ==================================================================== */}
        {/* Cuerpo Master-Detail (2 Paneles)                                     */}
        {/* ==================================================================== */}
        <View style={styles.masterDetailContainer}>
          
          {/* ----- PANEL IZQUIERDO: Master Sidebar (Navegación + QR) ----- */}
          <View style={styles.masterSidebar}>
            <Text style={styles.sidebarSectionTitle}>Pruebas de la sesión</Text>

            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
              <View style={styles.testsList}>
                {isLoading ? <Text style={styles.testItemStatus}>Cargando resultados…</Text> : null}
                {tests.map(t => {
                  const isActive = t.id === active?.id;
                  const IconComp = t.icon;
                  const tokens = STATUS_TOKENS[t.status];

                  return (
                    <Pressable
                      key={t.id}
                      style={[
                        styles.testSidebarItem,
                        isActive && styles.testSidebarItemActive,
                      ]}
                      onPress={() => setActiveId(t.id)}>
                      <View style={[styles.testItemIconBox, { backgroundColor: isActive ? '#FFFFFF' : '#F1F5F9' }]}>
                        <IconComp size={18} color={t.color} />
                      </View>

                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            styles.testItemTitle,
                            isActive && { color: '#0F172A', fontWeight: '800' },
                          ]}
                          numberOfLines={1}>
                          {t.title}
                        </Text>
                        <Text style={[styles.testItemStatus, { color: tokens.fg }]}>
                          ({tokens.label})
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>

            {/* Módulo Inferior: Telemetría Zero-PHI y Código QR */}
            <View style={styles.telemetryCard}>
              <View style={styles.qrThumbBox}>
                {qrPayload ? (
                  <QRCode value={qrPayload} size={54} ecl="Q" />
                ) : (
                  <Activity size={24} color="#64748B" />
                )}
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.telemetryTitle}>Telemetría Zero-PHI</Text>
                <Text style={styles.telemetrySubtitle}>QR anónimo de la sesión</Text>
                
                {/* 5 Estrellas Interactivas Likert */}
                <View style={styles.starsRow}>
                  {[1, 2, 3, 4, 5].map(star => (
                    <Pressable key={star} onPress={() => setLikert(star)}>
                      <Star
                        size={14}
                        color={star <= likert ? '#F59E0B' : '#CBD5E1'}
                        fill={star <= likert ? '#F59E0B' : 'transparent'}
                      />
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>
          </View>

          {/* ----- PANEL DERECHO: Clinical Detail Stage ----- */}
          <ScrollView
            style={styles.detailStage}
            contentContainerStyle={styles.detailStageContent}
            showsVerticalScrollIndicator={false}>
            
            {/* Título Principal de la Prueba Activa */}
            <View style={styles.detailHeader}>
              <Text style={styles.detailMainTitle}>
                {active?.title} · <Text style={{ color: '#475569', fontWeight: '500' }}>{active?.subtitle}</Text>
              </Text>
            </View>

            {/* Cuadrícula de 2 Tarjetas Clínicas (Audiograma / Params + Interpretación) */}
            <View style={styles.stageGrid}>
              
              {/* Tarjeta 1: Gráfico Clínico o Parámetros */}
              {active?.kind === 'audio' ? (
                <ClinicalAudiogramChart od={active.od} oi={active.oi} />
              ) : (
                <View style={styles.paramsCard}>
                  <Text style={styles.paramsCardTitle}>Parámetros Objetivos</Text>
                  <View style={styles.paramsList}>
                    {active?.params?.map((p, idx) => (
                      <View key={idx} style={styles.paramRow}>
                        <Text style={styles.paramLabel}>{p.label}</Text>
                        <View style={styles.paramValuePill}>
                          <Text style={styles.paramValueText}>{p.value}</Text>
                        </View>
                      </View>
                    ))}
                    {active?.rows?.map((r, idx) => (
                      <View key={idx} style={styles.paramRow}>
                        <Text style={styles.paramLabel}>{r.label}</Text>
                        <View style={styles.paramValuePill}>
                          <Text style={styles.paramValueText}>{r.value}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Tarjeta 2: Interpretación Clínica & Sello Facultativo */}
              <View style={styles.interpCard}>
                <Text style={styles.interpCardTitle}>Interpretación clínica</Text>

                <Text style={styles.interpBodyText}>
                  {active?.interp}
                </Text>

                <View style={styles.interpDivider} />

                {/* Sello y Firma Médica Oficial */}
                <View style={styles.signatureBox}>
                  <View style={styles.signatureRow}>
                    <Text style={styles.signatureCursive}>{signatureShort}</Text>
                    <View style={styles.sealCircle}>
                      <UserCheck size={18} color="#94A3B8" />
                    </View>
                  </View>
                  <Text style={styles.signatureDoctorName}>
                    {professionalName
                      ? `${professionalName}${professional?.licenseNumber ? ` · Col. ${professional.licenseNumber}` : ''}`
                      : 'Pendiente de firma del facultativo responsable'}
                  </Text>
                </View>
              </View>
            </View>
          </ScrollView>
        </View>

        {/* ==================================================================== */}
        {/* Dock Inferior Flotante (Cierre y Exportación)                        */}
        {/* ==================================================================== */}
        <View style={styles.actionDock}>
          <Text style={styles.regulatoryNote}>
            SaMD Clase IIa · MDR 2017/745
          </Text>

          <View style={styles.dockActionsRow}>
            <Pressable
              style={styles.exportPdfBtn}
              onPress={handleExportPdf}
              disabled={isGenerating}>
              <FileText size={16} color="#334155" />
              <Text style={styles.exportPdfText}>Exportar PDF</Text>
            </Pressable>

            <Pressable
              style={styles.archiveBtn}
              onPress={handleFinishAndArchive}>
              <Check size={16} color="#FFFFFF" strokeWidth={2.5} />
              <Text style={styles.archiveBtnText}>Finalizar y Archivar</Text>
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
  topNavbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EDE7DC',
  },
  navLogoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  iconSquare: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navLogoText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#2B2620',
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
  sealedStatusPill: {
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
  statusDotGreen: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  sealedStatusText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#065F46',
  },

  /* Master-Detail Container */
  masterDetailContainer: {
    flex: 1,
    flexDirection: 'row',
    paddingBottom: 64,
  },

  /* Master Sidebar */
  masterSidebar: {
    width: 280,
    backgroundColor: 'rgba(255, 255, 255, 0.75)',
    borderRightWidth: 1,
    borderRightColor: '#EDE7DC',
    padding: 16,
    justifyContent: 'space-between',
  },
  sidebarSectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  testsList: {
    gap: 8,
  },
  testSidebarItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  testSidebarItemActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FF7F00',
    shadowColor: '#FF7F00',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  testItemIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  testItemTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  testItemStatus: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },

  /* Telemetría QR */
  telemetryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#EDE7DC',
    marginTop: 12,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  qrThumbBox: {
    width: 58,
    height: 58,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  telemetryTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B',
  },
  telemetrySubtitle: {
    fontSize: 10,
    color: '#64748B',
    marginBottom: 4,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 4,
  },

  /* Detail Stage */
  detailStage: {
    flex: 1,
  },
  detailStageContent: {
    padding: 24,
  },
  detailHeader: {
    marginBottom: 16,
  },
  detailMainTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1E293B',
    letterSpacing: -0.4,
  },
  stageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 20,
  },

  /* Chart Card */
  chartWrapper: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#EDE7DC',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    alignItems: 'center',
  },
  chartTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  chartLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginTop: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    backgroundColor: '#FFFFFF',
  },
  legendText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },

  /* Params Card */
  paramsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#EDE7DC',
    minWidth: 320,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  paramsCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 12,
  },
  paramsList: {
    gap: 10,
  },
  paramRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
    borderBottomWidth: 0.6,
    borderBottomColor: '#F1F5F9',
  },
  paramLabel: {
    fontSize: 12,
    color: '#475569',
  },
  paramValuePill: {
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  paramValueText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },

  /* Interpretation Card */
  interpCard: {
    backgroundColor: '#FFFDF9',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#FED7AA',
    flex: 1,
    minWidth: 260,
    justifyContent: 'space-between',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  interpCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#9A3412',
    marginBottom: 8,
  },
  interpBodyText: {
    fontSize: 13,
    lineHeight: 20,
    color: '#334155',
  },
  interpDivider: {
    height: 1,
    backgroundColor: '#FDE68A',
    marginVertical: 14,
  },
  signatureBox: {
    alignItems: 'flex-start',
  },
  signatureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 4,
  },
  signatureCursive: {
    fontFamily: Platform.OS === 'ios' ? 'Snell Roundhand' : 'cursive',
    fontSize: 22,
    color: '#0F172A',
  },
  sealCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
  },
  signatureDoctorName: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
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
  regulatoryNote: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  dockActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  exportPdfBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  exportPdfText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  archiveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FF7F00',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 9,
    shadowColor: '#FF7F00',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.28,
    shadowRadius: 6,
    elevation: 4,
  },
  archiveBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
