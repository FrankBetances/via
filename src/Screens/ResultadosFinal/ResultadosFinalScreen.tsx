import React, { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useDispatch } from 'react-redux';
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
  ArrowLeft,
  AudioWaveform,
  BrainCircuit,
  Check,
  Droplets,
  Ear,
  FileText,
  Mic2,
  MoonStar,
  Puzzle,
  Speech,
  Star,
  TrainFront,
  UserCheck,
  Volume2,
} from 'lucide-react-native';

import { Content, Text } from '@/Components/Common';
import ViaIcon from '@/Components/Common/ViaIcon';
import RadialBackground from '@/Components/Themed/RadialBackground';
import { RootStackParamList } from '@/Navigators';
import { AppDispatch, RootState } from '@/Store';
import { setActiveEvaluation } from '@/Store/slices/activeEvaluationSlice';
import { Evaluation } from '@/Models/Evaluation/Evaluation';
import { EvaluationRepository } from '@/Repositories/EvaluationRepository';
import { PatientRepository } from '@/Repositories/PatientRepository';
import { useClassSelector } from '@/Helpers/ClassTransformer';
import { describePatient } from '@/Helpers/patientHeader';
import { useTelemetryTracker, compressTelemetry } from '@/Telemetry';
import { useLuaClosingReward, LuaEmotion, LUA_CLINICAL_BADGES } from '@/Lua';
import { LuaCompanionWidget } from '@/Components/Mascot/LuaCompanionWidget';

import { AudiometryRepository } from '@/Repositories/AudiometryRepository';
import { VoiceAnalysisRepository } from '@/Repositories/VoiceAnalysisRepository';
import { DysphagiaTestRepository } from '@/Repositories/DysphagiaTestRepository';
import { SahsScreeningRepository } from '@/Repositories/SahsScreeningRepository';
import { ArticulationTestRepository } from '@/Repositories/ArticulationTestRepository';
import { ProsodyAnalysisRepository } from '@/Repositories/ProsodyAnalysisRepository';
import { VerbalAudiometryRepository } from '@/Repositories/VerbalAudiometryRepository';
import { ScreeningRepository } from '@/Repositories/ScreeningRepository';
import { ExecutiveFunctionsRepository } from '@/Repositories/ExecutiveFunctionsRepository';
import { AshaMilestoneTestRepository } from '@/Repositories/AshaMilestoneTestRepository';

import { FREQS, interpretAudiometry } from '@/Screens/Audiometry/audiometryResult';
import {
  BAND_LABEL,
  LEVEL_LABEL,
  MODALITY_LABEL,
  verbalDiscriminationStatus,
} from '@/Screens/VerbalAudiometry/verbalAudiometryResult';
import {
  buildInterpretation as buildVoiceInterpretation,
  statusF0,
  statusHnr,
  statusJitter,
  statusShimmer,
} from '@/Screens/VoiceAnalysis/voiceAnalysisResult';
import { prosodyInterpretation, prosodyReportRows } from '@/Screens/ProsodyAnalysis/prosodyResult';
import { imcLabel, suspicionLabel } from '@/Screens/SahsScreening/sahsScreeningResult';
import { EF_DOMAIN_META, EF_DOMAIN_ORDER, efLabelFromTest, efStatus } from '@/Screens/ExecutiveFunctions/executiveFunctionsGame';
import { ASHA_DOMAIN_META, getMilestonesForAgeBand } from '@/Screens/AshaScreening/ashaMilestones';
import { ASHA_RISK_LABELS } from '@/Screens/AshaScreening/ashaCdssEngine';
import { generateReport } from '@/PDF/templates/Report';
import { showErrorToast, showSuccessToast } from '@/Helpers/showToast';

import { useT } from '@/I18n';
import { atoms } from '@/Theme/styleAtoms';
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
 * línea se parte ahí. No hay curvas por defecto: sin datos no hay gráfico.
 *
 * En cribado de campo libre (`cl`) la respuesta es binaural y no distingue
 * oído: se pinta una sola curva con el símbolo convencional «S», nunca dos
 * curvas OD/OI que nadie ha medido.
 */
function ClinicalAudiogramChart({
  od = [],
  oi = [],
  cl,
}: {
  od?: (number | null)[];
  oi?: (number | null)[];
  cl?: (number | null)[];
}) {
  const t = useT();
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

  const isSoundfield = Array.isArray(cl);
  const odPoints = isSoundfield ? [] : toPoints(od); // OD 🔴 círculos
  const oiPoints = isSoundfield ? [] : toPoints(oi); // OI 🔵 cruces
  const clPoints = isSoundfield ? toPoints(cl!) : []; // Campo libre · símbolo «S»

  const linePath = (pts: { x: number; y: number }[]) =>
    pts.reduce((acc, p, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`, '');

  return (
    <View style={styles.chartWrapper}>
      <Text style={styles.chartTitle}>{t.resultadosFinal.audiogramaTonalDbHl}</Text>
      
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

        {/* Trazado de campo libre (binaural, símbolo «S») */}
        {isSoundfield ? (
          <>
            <Path d={linePath(clPoints)} stroke="#0D9488" strokeWidth={2} fill="none" />
            {clPoints.map((p, i) => (
              <SvgText
                key={i}
                x={p.x}
                y={p.y + 4}
                textAnchor="middle"
                fontSize={12}
                fontWeight="700"
                fill="#0D9488">
                S
              </SvgText>
            ))}
          </>
        ) : null}

        {/* Trazado OI (oído izquierdo · 🔵 cruces) */}
        <Path
          d={linePath(oiPoints)}
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

        {/* Trazado OD (oído derecho · 🔴 círculos) */}
        <Path
          d={linePath(odPoints)}
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
        {isSoundfield ? (
          <View style={styles.legendItem}>
            <Text style={atoms.color0D9488FontWeightBoldFontSize13}>S</Text>
            <Text style={styles.legendText}>{t.resultadosFinal.campoLibreBinaural}</Text>
          </View>
        ) : (
          <>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, atoms.borderColorDC2626]} />
              <Text style={styles.legendText}>{t.resultadosFinal.oidoDerechoOd}</Text>
            </View>
            <View style={styles.legendItem}>
              <Text style={atoms.color2563EBFontWeightBoldFontSize13}>✕</Text>
              <Text style={styles.legendText}>{t.resultadosFinal.oidoIzquierdoOi}</Text>
            </View>
          </>
        )}
      </View>
    </View>
  );
}

export default function ResultadosFinalScreen({ navigation }: Props) {
  const t = useT();
  const dispatch = useDispatch<AppDispatch>();
  const activeEvaluation = useClassSelector(Evaluation, (state: RootState) => state.activeEvaluation.evaluation);
  const patient = activeEvaluation?.patient;
  const { patientLabel, initials } = describePatient(patient);

  const evaluationId = activeEvaluation?.id;

  useEffect(() => {
    if (!patient || !evaluationId) {
      let mounted = true;
      (async () => {
        try {
          const patients = await PatientRepository.getAllPatients();
          if (patients.length > 0 && mounted) {
            const latestPatient = patients[patients.length - 1];
            const evals = await EvaluationRepository.getEvaluationsByPatient(latestPatient.id);
            const latestEval = evals[0];
            if (latestEval && mounted) {
              dispatch(
                setActiveEvaluation({
                  id: latestEval.id,
                  status: latestEval.status,
                  patient: {
                    id: latestPatient.id,
                    name: latestPatient.nameEnc.split(' ')[0] ?? latestPatient.nameEnc,
                    lastName: latestPatient.nameEnc.split(' ').slice(1).join(' '),
                    nhc: latestPatient.idHash,
                    nameEnc: latestPatient.nameEnc,
                    idHash: latestPatient.idHash,
                  },
                  professional: latestEval.professional
                    ? {
                        id: latestEval.professional.id,
                        name: latestEval.professional.fullName,
                        licenseNumber: latestEval.professional.licenseNumber,
                      }
                    : null,
                }),
              );
            }
          }
        } catch {
          // ignore
        }
      })();
      return () => {
        mounted = false;
      };
    }
  }, [dispatch, evaluationId, patient]);

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
    if (!evaluationId) {
      setIsLoading(false);
      return;
    }
    let mounted = true;
    (async () => {
      try {
        const result: TestDetail[] = [];

        /* El fallo de un módulo no puede dejar el informe entero en blanco: cada
           lectura se aísla y se registra. */
        const collect = async (label: string, read: () => Promise<void>) => {
          try {
            await read();
          } catch (e) {
            console.warn(`VIA+: no se pudieron leer los resultados de ${label}`, e);
          }
        };

        /* ---------------------------- Audiometría tonal --------------------- */
        await collect('audiometría', async () => {
          const audiometries = await AudiometryRepository.getAudiometryByEvaluation(evaluationId);
          audiometries.forEach(a => {
            // Umbral ausente = sin respuesta al nivel máximo. Se propaga como
            // null; nunca se rellena con un valor normal inventado.
            const cl = a.thresholds.CL ? FREQS.map(f => a.thresholds.CL?.[f] ?? null) : undefined;
            const od = FREQS.map(f => a.thresholds.OD[f] ?? null);
            const oi = FREQS.map(f => a.thresholds.OI[f] ?? null);
            const vals = cl ?? [...od, ...oi];
            const worst: StatusKind = vals.some(v => v != null && v > 20) ? 'warn' : 'ok';
            const alt = vals.some(v => v != null && v > 40) || (cl ? cl.some(v => v == null) : false);
            result.push({
              id: `audio-${a.id}`,
              kind: 'audio',
              status: alt ? 'alt' : worst,
              title: a.method === 'conditioned' ? 'Audiometría Condicionada' : 'Audiometría Infantil',
              subtitle:
                a.method === 'conditioned'
                  ? cl
                    ? 'Cribado en campo libre · respuesta condicionada'
                    : 'Respuesta condicionada visual (VRA)'
                  : 'Umbrales por vía aérea · juego de refuerzo',
              icon: a.method === 'conditioned' ? TrainFront : Ear,
              color: a.method === 'conditioned' ? '#0D9488' : '#0284C7',
              od,
              oi,
              cl,
              interp: interpretAudiometry(a.thresholds),
            });
          });
        });

        /* --------------------------- Audiometría verbal --------------------- */
        await collect('audiometría verbal', async () => {
          const verbals = await VerbalAudiometryRepository.getVerbalAudiometryByEvaluation(evaluationId);
          verbals.forEach(v => {
            const status: StatusKind = v.presentedCount
              ? verbalDiscriminationStatus(v.discriminationPct)
              : 'warn';
            const rows: SimpleRow[] = [
              {
                label: 'Banda / modalidad',
                value: BAND_LABEL[v.ageBand] ?? v.ageBand,
                status: 'ok',
                tag: MODALITY_LABEL[v.modality] ?? v.modality,
              },
              ...(v.levelScores ?? []).map(ls => ({
                label: `Discriminación · ${ls.level} dB${LEVEL_LABEL[ls.level] ? ` (${LEVEL_LABEL[ls.level]})` : ''}`,
                value: `${ls.pct} %`,
                status: verbalDiscriminationStatus(ls.pct),
                tag: `${ls.correct}/${ls.presented}`,
              })),
              ...(v.srtDb != null
                ? [{ label: 'URV · umbral de recepción verbal', value: `≈ ${v.srtDb} dB`, status: 'ok' as StatusKind, tag: 'estimado' }]
                : []),
            ];
            result.push({
              id: `verbal-${v.id}`,
              kind: 'rows',
              status,
              title: 'Audiometría Verbal',
              subtitle: 'Reconocimiento por tarjetas · campo libre · sin audífonos',
              icon: Volume2,
              color: '#2563EB',
              rows,
              interp: v.interpretation || 'Audiometría verbal completada.',
            });
          });
        });

        /* ------------------------- Análisis acústico de voz ----------------- */
        await collect('análisis de voz', async () => {
          const voiceAnalyses = await VoiceAnalysisRepository.getVoiceAnalysisByEvaluation(evaluationId);
          voiceAnalyses.forEach(v => {
            // Cierre manual: sin parámetros acústicos, la prueba se registró con
            // la valoración perceptual GRBAS y la firma del explorador.
            if (v.f0 == null || v.jitter == null || v.shimmer == null || v.hnr == null) {
              const g = v.grbas;
              result.push({
                id: `voice-${v.id}`,
                kind: 'rows',
                status: g && g.g >= 2 ? 'alt' : g && g.g === 1 ? 'warn' : 'ok',
                title: 'Análisis Acústico de Voz',
                subtitle: 'Cierre manual · valoración perceptual GRBAS',
                icon: Mic2,
                color: '#7C3AED',
                rows: g
                  ? [
                      {
                        label: 'GRBAS · valoración perceptual',
                        value: `G${g.g} R${g.r} B${g.b} A${g.a} S${g.s}`,
                        status: g.g >= 2 ? 'alt' : g.g === 1 ? 'warn' : 'ok',
                        tag: `total ${g.g + g.r + g.b + g.a + g.s}/15`,
                      },
                    ]
                  : [],
                interp: v.interpretation || 'Prueba de voz cerrada manualmente (análisis acústico no disponible).',
              });
              return;
            }
            const toKind = (s: string): StatusKind => (s === 'normal' ? 'ok' : s === 'borderline' ? 'warn' : 'alt');
            const params: ParamRow[] = [
              { label: 'F0 · frecuencia fundamental', value: `${Math.round(v.f0)} Hz`, status: toKind(statusF0(v.f0)), ref: '200–320 Hz' },
              { label: 'Jitter', value: `${v.jitter.toFixed(1)} %`, status: toKind(statusJitter(v.jitter)), ref: '< 1.0 %' },
              { label: 'Shimmer', value: `${v.shimmer.toFixed(1)} %`, status: toKind(statusShimmer(v.shimmer)), ref: '< 3.0 %' },
              { label: 'HNR · relación armónico-ruido', value: `${Math.round(v.hnr)} dB`, status: toKind(statusHnr(v.hnr)), ref: '> 20 dB' },
            ];
            const overall: StatusKind = params.some(p => p.status === 'alt')
              ? 'alt'
              : params.some(p => p.status === 'warn')
              ? 'warn'
              : 'ok';
            result.push({
              id: `voice-${v.id}`,
              kind: 'params',
              status: overall,
              title: 'Análisis Acústico de Voz',
              subtitle: 'Vocal sostenida /a/ · parámetros perturbatorios',
              icon: Mic2,
              color: '#7C3AED',
              params,
              interp: buildVoiceInterpretation({
                f0: v.f0,
                jitter: v.jitter,
                shimmer: v.shimmer,
                hnr: v.hnr,
                formants: v.formants,
              }),
            });
          });
        });

        /* ---------------------------- Análisis prosódico -------------------- */
        await collect('análisis prosódico', async () => {
          const prosodies = await ProsodyAnalysisRepository.getProsodyAnalysisByEvaluation(evaluationId);
          prosodies.forEach(p => {
            // La prosodia NO emite juicio clínico (no hay baremo poblacional):
            // el estado solo distingue toma válida de toma que no dio métricas.
            const failed = p.reason !== 'ok';
            const rows: SimpleRow[] = prosodyReportRows(p.metrics).map(r => ({
              label: r.label,
              value: r.value !== null ? `${r.value} ${r.unit}` : '—',
              status: r.value !== null ? ('ok' as StatusKind) : ('warn' as StatusKind),
              tag: r.hint,
            }));
            result.push({
              id: `prosody-${p.id}`,
              kind: 'rows',
              status: failed ? 'warn' : 'ok',
              title: 'Análisis Prosódico',
              subtitle: `Habla conectada · ${p.task} · banda ${p.ageBand}`,
              icon: AudioWaveform,
              color: '#C026D3',
              rows,
              interp: p.interpretation || prosodyInterpretation(p.metrics, p.reason),
            });
          });
        });

        /* ---------------------------- Articulación T.A.R. ------------------- */
        await collect('articulación', async () => {
          const articulations = await ArticulationTestRepository.getArticulationByEvaluation(evaluationId);
          articulations.forEach(a => {
            const rows: SimpleRow[] = [
              {
                label: 'Ítems acertados',
                value: `${a.evaluatedCount} / ${a.totalCount}`,
                status: a.correctPct >= 90 ? 'ok' : a.correctPct >= 70 ? 'warn' : 'alt',
                tag: `${a.correctPct} %`,
              },
              {
                label: 'Sustituciones · S',
                value: `${a.sodaCounts.S ?? 0}`,
                status: (a.sodaCounts.S ?? 0) > 0 ? 'warn' : 'ok',
                tag: a.affectedPhonemes.map(p => p.phoneme).join(', ') || '—',
              },
              { label: 'Omisiones · O', value: `${a.sodaCounts.O ?? 0}`, status: (a.sodaCounts.O ?? 0) > 0 ? 'warn' : 'ok', tag: '—' },
              { label: 'Distorsiones · D', value: `${a.sodaCounts.D ?? 0}`, status: (a.sodaCounts.D ?? 0) > 0 ? 'warn' : 'ok', tag: '—' },
              { label: 'Adiciones · A', value: `${a.sodaCounts.A ?? 0}`, status: (a.sodaCounts.A ?? 0) > 0 ? 'warn' : 'ok', tag: '—' },
            ];
            result.push({
              id: `art-${a.id}`,
              kind: 'rows',
              status: a.correctPct >= 90 ? 'ok' : a.correctPct >= 70 ? 'warn' : 'alt',
              title: 'Articulación · T.A.R.',
              subtitle: 'Test de Articulación a la Repetición · registro SODA',
              icon: Speech,
              color: '#EA580C',
              rows,
              interp: `${a.correctPct}% de producción correcta. ${a.affectedPhonemes.length} fonema(s) afectado(s).`,
            });
          });
        });

        /* --------------------------- Funciones ejecutivas ------------------- */
        await collect('funciones ejecutivas', async () => {
          const efTests = await ExecutiveFunctionsRepository.getExecutiveFunctionsByEvaluation(evaluationId);
          efTests.forEach(ef => {
            const domainScores: Record<string, number | null> = {
              attention: ef.attentionScore,
              inhibition: ef.inhibitionScore,
              flexibility: ef.flexibilityScore,
              workingMemory: ef.workingMemoryScore,
              planning: ef.planningScore,
            };
            const params: ParamRow[] = EF_DOMAIN_ORDER.map(domain => {
              const s = domainScores[domain];
              return {
                label: `${EF_DOMAIN_META[domain].title} · ${EF_DOMAIN_META[domain].game}`,
                value: s !== null ? `${s}/100` : '—',
                status: s !== null ? efStatus(s) : 'warn',
                ref: '≥ 80 esperado',
              };
            });
            result.push({
              id: `ef-${ef.id}`,
              kind: 'params',
              status: ef.overallScore === null ? 'warn' : efStatus(ef.overallScore),
              title: 'Funciones Ejecutivas',
              subtitle: `Mini-juegos de tarjetas · banda ${ef.ageBand} · índice global ${efLabelFromTest(ef)}`,
              icon: BrainCircuit,
              color: '#059669',
              params,
              interp: ef.interpretation || 'Exploración lúdica de funciones ejecutivas completada.',
            });
          });
        });

        /* -------------------------- Cribado de hitos ASHA ------------------- */
        await collect('cribado de hitos ASHA', async () => {
          const ashaTests = await AshaMilestoneTestRepository.getAshaTestsByEvaluation(evaluationId);
          ashaTests.forEach(a => {
            const status: StatusKind =
              a.riskLevel === 'red' ? 'alt' : a.riskLevel === 'yellow' ? 'warn' : 'ok';
            const milestones = getMilestonesForAgeBand(a.ageBand as never);
            const responses = a.responses || {};
            const failed = Array.isArray(a.failedDomains) ? a.failedDomains : [];
            // Por dominio: cuántos hitos cumple de los CONTESTADOS. Un hito sin
            // respuesta no se cuenta ni como cumplido ni como fallado (ver
            // `ashaCdssEngine`), y el denominador lo dice.
            const params: ParamRow[] = (['receptive', 'expressive', 'pragmatic'] as const).map(
              domain => {
                const ofDomain = milestones.filter(m => m.domain === domain);
                const answered = ofDomain.filter(m => typeof responses[m.id] === 'boolean');
                const achieved = answered.filter(m => responses[m.id] === true);
                return {
                  label: ASHA_DOMAIN_META[domain].label,
                  value: answered.length
                    ? `${achieved.length}/${answered.length} hitos`
                    : 'sin evaluar',
                  status: !answered.length ? 'warn' : failed.includes(domain) ? 'alt' : 'ok',
                  ref: 'percentil 75 (ASHA)',
                } as ParamRow;
              },
            );
            const referrals = Array.isArray(a.recommendedReferrals) ? a.recommendedReferrals : [];
            result.push({
              id: `asha-${a.id}`,
              kind: 'params',
              status,
              title: 'Hitos del Lenguaje · ASHA',
              subtitle: `Cribado normativo · banda ${a.ageBand} · ${ASHA_RISK_LABELS[a.riskLevel]}`,
              icon: Puzzle,
              color: '#0D9488',
              params,
              interp: referrals.length
                ? referrals.join(' · ')
                : 'Cribado registrado sin recomendaciones de derivación.',
            });
          });
        });

        /* ----------------------------- Cribado SAHS ------------------------- */
        await collect('cribado SAHS', async () => {
          const sahsScreenings = await SahsScreeningRepository.getSahsScreeningsByEvaluation(evaluationId);
          sahsScreenings.forEach(s => {
            const status: StatusKind = s.suspicionLevel === 'high' ? 'alt' : s.suspicionLevel === 'med' ? 'warn' : 'ok';
            const params: ParamRow[] = [
              { label: 'PSQ de Chervin', value: `${(s.psqYesCount / s.psqTotal).toFixed(2)}`, status, ref: '< 0.33 (positivo ≥ 0.33)' },
              { label: 'Hipertrofia amigdalar · Brodsky', value: s.brodsky != null ? `Grado ${s.brodsky}` : '—', status, ref: 'I–II bajo · III–IV alto' },
              { label: 'IMC · categoría', value: imcLabel(s.imc), status, ref: 'normopeso esperado' },
            ];
            result.push({
              id: `sahs-${s.id}`,
              kind: 'params',
              status,
              title: 'Cribado SAHS Infantil',
              subtitle: 'PSQ de Chervin · Brodsky · IMC',
              icon: MoonStar,
              color: '#4F46E5',
              params,
              interp: `${suspicionLabel(s.suspicionLevel)}. ${s.recommendation}`,
            });
          });
        });

        /* -------------------------- Cribado TEA (M-CHAT) -------------------- */
        await collect('cribado de autismo', async () => {
          const screenings = await ScreeningRepository.getScreeningsByEvaluation(evaluationId);
          screenings.forEach(s => {
            const status: StatusKind = s.riskLevel === 'high' ? 'alt' : s.riskLevel === 'med' ? 'warn' : 'ok';
            result.push({
              id: `screen-${s.id}`,
              kind: 'params',
              status,
              title: s.instrument === 'autism-tea' ? 'Cuestionario Autismo' : s.instrument,
              subtitle: 'Cribado de TEA · 20 ítems (M-CHAT-R/F)',
              icon: Puzzle,
              color: '#DB2777',
              params: [{ label: 'Puntuación total', value: `${s.score} / ${s.total}`, status, ref: s.rangeLabel }],
              interp: s.recommendation,
            });
          });
        });

        /* ---------------------------- Disfagia MECV-V ----------------------- */
        await collect('disfagia', async () => {
          const dysphagias = await DysphagiaTestRepository.getDysphagiaByEvaluation(evaluationId);
          dysphagias.forEach(d => {
            const status: StatusKind = d.verdict === 'safe' ? 'ok' : d.verdict === 'safety' ? 'alt' : 'warn';
            const rows: SimpleRow[] = [
              { label: 'SpO₂ basal', value: `${d.basalSpO2} %`, status: d.basalSpO2 >= 95 ? 'ok' : 'warn', tag: '≥ 95 %' },
              { label: 'SpO₂ mínima', value: `${d.minSpO2 ?? '—'} %`, status: (d.minSpO2 ?? 100) >= 95 ? 'ok' : 'warn', tag: '≥ 95 %' },
              { label: 'Alteración de seguridad', value: d.safetyAltered ? 'Sí' : 'No', status: d.safetyAltered ? 'alt' : 'ok', tag: 'tos / voz húmeda' },
              { label: 'Alteración de eficacia', value: d.efficacyAltered ? 'Sí' : 'No', status: d.efficacyAltered ? 'warn' : 'ok', tag: 'sello / residuo' },
            ];
            result.push({
              id: `dys-${d.id}`,
              kind: 'rows',
              status,
              title: 'Exploración de Disfagia',
              subtitle: 'MECV-V · volumen-viscosidad · pulsioximetría integrada',
              icon: Droplets,
              color: '#DC2626',
              rows,
              interp: d.interpretation || 'Exploración MECV-V completada.',
            });
          });
        });

        if (mounted) {
          setTests(result);
          setActiveId(prev => prev ?? result[0]?.id ?? null);
        }
      } finally {
        if (mounted) setIsLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [evaluationId]);

  const active = useMemo(() => tests.find(item => item.id === activeId) ?? tests[0] ?? null, [tests, activeId]);

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
          <View style={styles.headerLeftGroup}>
            <Pressable
              style={({ pressed }) => [styles.backBtn, pressed && styles.backBtnPressed]}
              onPress={() => {
                if (navigation.canGoBack()) {
                  navigation.goBack();
                } else {
                  navigation.navigate('ResultadosPreliminares');
                }
              }}
              accessibilityRole="button"
              accessibilityLabel={t.resultadosFinal.volverResultadosPreliminares}>
              <ArrowLeft size={18} color="#334155" strokeWidth={2.2} />
            </Pressable>

            <View style={styles.navLogoRow}>
              <ViaIcon size={28} variant="color" />
              <Text style={styles.navLogoText}>
                VIA<Text style={atoms.colorFF7F00}>+</Text>
              </Text>
            </View>

            <View style={styles.headerDivider} />

            {/* Datos del Paciente */}
            <View style={styles.patientBadge}>
              <View style={styles.initialsBox}>
                <Text style={styles.initialsText}>[{initials}]</Text>
              </View>
              <Text style={styles.patientInfoText}>{patientLabel}</Text>
            </View>
          </View>

          <View style={styles.sealedStatusPill}>
            <View style={styles.statusDotGreen} />
            <Text style={styles.sealedStatusText}>{t.resultadosFinal.sesionSelladaInformeListo}</Text>
          </View>
        </View>

        {/* ==================================================================== */}
        {/* Cuerpo Master-Detail (2 Paneles)                                     */}
        {/* ==================================================================== */}
        <View style={styles.masterDetailContainer}>
          
          {/* ----- PANEL IZQUIERDO: Master Sidebar (Navegación + QR) ----- */}
          <View style={styles.masterSidebar}>
            <Text style={styles.sidebarSectionTitle}>{t.resultadosFinal.pruebasSesion}</Text>

            <ScrollView style={atoms.flex1} showsVerticalScrollIndicator={false}>
              <View style={styles.testsList}>
                {isLoading ? <Text style={styles.testItemStatus}>{t.resultadosFinal.cargandoResultados}</Text> : null}
                {tests.map(item => {
                  const isActive = item.id === active?.id;
                  const IconComp = item.icon;
                  const tokens = STATUS_TOKENS[item.status];

                  return (
                    <Pressable
                      key={item.id}
                      style={[
                        styles.testSidebarItem,
                        isActive && styles.testSidebarItemActive,
                      ]}
                      onPress={() => setActiveId(item.id)}>
                      <View style={[styles.testItemIconBox, { backgroundColor: isActive ? '#FFFFFF' : '#F1F5F9' }]}>
                        <IconComp size={18} color={item.color} />
                      </View>

                      <View style={atoms.flex1}>
                        <Text
                          style={[
                            styles.testItemTitle,
                            isActive && atoms.color0F172AFontWeight800,
                          ]}
                          numberOfLines={1}>
                          {item.title}
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

              <View style={atoms.flex1}>
                <Text style={styles.telemetryTitle}>{t.resultadosFinal.telemetriaZeroPhi}</Text>
                <Text style={styles.telemetrySubtitle}>{t.resultadosFinal.qrAnonimoSesion}</Text>
                
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
            
            {/* Sin pruebas registradas no se dibuja un informe de ejemplo. */}
            {!active ? (
              <View style={styles.emptyStage}>
                <Text style={styles.emptyStageTitle}>
                  {isLoading ? t.resultadosFinal.cargandoResultados : t.resultadosFinal.estaSesionTienePruebasRegistradas}
                </Text>
                {!isLoading ? (
                  <Text style={styles.emptyStageBody}>
                    
                    {t.resultadosFinal.informeComponeCadaModuloHaya}
                  </Text>
                ) : null}
              </View>
            ) : (
              <>
            {/* Celebración de Lúa y Entrega de la Gran Insignia Final */}
            <View style={atoms.marginBottom16}>
              <LuaCompanionWidget
                emotion={LuaEmotion.Pride}
                activeBadge={LUA_CLINICAL_BADGES.final_champion}
                level={12}
                message="¡Enhorabuena! Has completado la valoración clínica. Lúa te entrega la insignia Campeón de la Comunicación."
              />
            </View>

            {/* Título Principal de la Prueba Activa */}
            <View style={styles.detailHeader}>
              <Text style={styles.detailMainTitle}>
                {active.title} · <Text style={atoms.color475569FontWeight500}>{active.subtitle}</Text>
              </Text>
              <View style={[styles.statusBadge, { backgroundColor: STATUS_TOKENS[active.status].bg }]}>
                <Text style={[styles.statusBadgeText, { color: STATUS_TOKENS[active.status].fg }]}>
                  {STATUS_TOKENS[active.status].label}
                </Text>
              </View>
            </View>

            {/* Cuadrícula de 2 Tarjetas Clínicas (Audiograma / Params + Interpretación) */}
            <View style={styles.stageGrid}>

              {/* Tarjeta 1: Gráfico Clínico o Parámetros */}
              {active.kind === 'audio' ? (
                <ClinicalAudiogramChart od={active.od} oi={active.oi} cl={active.cl} />
              ) : (
                <View style={styles.paramsCard}>
                  <Text style={styles.paramsCardTitle}>{t.resultadosFinal.parametrosObjetivos}</Text>
                  <View style={styles.paramsList}>
                    {active.params?.map((p, idx) => (
                      <View key={idx} style={styles.paramRow}>
                        <View style={atoms.flex1}>
                          <Text style={styles.paramLabel}>{p.label}</Text>
                          <Text style={styles.paramRef}>{t.resultadosFinal.referencia} {p.ref}</Text>
                        </View>
                        <View
                          style={[
                            styles.paramValuePill,
                            { backgroundColor: STATUS_TOKENS[p.status].bg },
                          ]}>
                          <Text
                            style={[styles.paramValueText, { color: STATUS_TOKENS[p.status].fg }]}>
                            {p.value}
                          </Text>
                        </View>
                      </View>
                    ))}
                    {active.rows?.map((r, idx) => (
                      <View key={idx} style={styles.paramRow}>
                        <View style={atoms.flex1}>
                          <Text style={styles.paramLabel}>{r.label}</Text>
                          {r.tag ? <Text style={styles.paramRef}>{r.tag}</Text> : null}
                        </View>
                        <View
                          style={[
                            styles.paramValuePill,
                            { backgroundColor: STATUS_TOKENS[r.status].bg },
                          ]}>
                          <Text
                            style={[styles.paramValueText, { color: STATUS_TOKENS[r.status].fg }]}>
                            {r.value}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Tarjeta 2: Interpretación Clínica & Sello Facultativo */}
              <View style={styles.interpCard}>
                <Text style={styles.interpCardTitle}>{t.resultadosFinal.interpretacionClinica}</Text>

                <Text style={styles.interpBodyText}>
                  {active.interp}
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
                      : t.resultadosFinal.pendienteFirmaFacultativoResponsable}
                  </Text>
                </View>
              </View>
            </View>
              </>
            )}
          </ScrollView>
        </View>

        {/* ==================================================================== */}
        {/* Dock Inferior Flotante (Cierre y Exportación)                        */}
        {/* ==================================================================== */}
        <View style={styles.actionDock}>
          <Text style={styles.regulatoryNote}>
            
            {t.resultadosFinal.samdClaseIiaMdr2017}
          </Text>

          <View style={styles.dockActionsRow}>
            <Pressable
              style={styles.exportPdfBtn}
              onPress={handleExportPdf}
              disabled={isGenerating}>
              <FileText size={16} color="#334155" />
              <Text style={styles.exportPdfText}>{t.resultadosFinal.exportarPdf}</Text>
            </Pressable>

            <Pressable
              style={styles.archiveBtn}
              onPress={handleFinishAndArchive}>
              <Check size={16} color="#FFFFFF" strokeWidth={2.5} />
              <Text style={styles.archiveBtnText}>{t.resultadosFinal.finalizarArchivar}</Text>
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
  headerLeftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2DDD5',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  backBtnPressed: {
    backgroundColor: '#F1F5F9',
    transform: [{ scale: 0.96 }],
  },
  navLogoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  navLogoText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#2B2620',
  },
  headerDivider: {
    width: 1,
    height: 20,
    backgroundColor: '#E2DDD5',
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 16,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  emptyStage: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#EDE7DC',
    padding: 28,
    alignItems: 'center',
    gap: 8,
  },
  emptyStageTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#334155',
    textAlign: 'center',
  },
  emptyStageBody: {
    fontSize: 13,
    lineHeight: 20,
    color: '#64748B',
    textAlign: 'center',
    maxWidth: 420,
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
  paramRef: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 1,
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
