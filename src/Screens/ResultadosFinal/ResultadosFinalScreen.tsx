import React, { useEffect, useMemo, useState } from 'react';
import { Pressable } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Box, Card, HStack, Icon, ScrollView, VStack } from '@gluestack-ui/themed';
import {
  Activity,
  AlertCircle,
  Baby,
  ChevronLeft,
  Ear,
  FileText,
  LogOut,
  Mail,
  Mic2,
  MoreHorizontal,
  Volume2,
  Printer,
  Share2,
  Stethoscope,
  UserPlus,
  Waves,
} from 'lucide-react-native';
import { useDispatch } from 'react-redux';

import { Button, Content, Header, Text } from '@/Components/Common';
import RadialBackground from '@/Components/Themed/RadialBackground';
import { RootStackParamList } from '@/Navigators';
import { AppDispatch, RootState } from '@/Store';
import { logout } from '@/Store/slices/authSlice';
import { Evaluation } from '@/Models/Evaluation/Evaluation';
import { useClassSelector } from '@/Helpers/ClassTransformer';

import { AudiometryRepository } from '@/Repositories/AudiometryRepository';
import { VoiceAnalysisRepository } from '@/Repositories/VoiceAnalysisRepository';
import { DysphagiaTestRepository } from '@/Repositories/DysphagiaTestRepository';
import { SahsScreeningRepository } from '@/Repositories/SahsScreeningRepository';
import { ArticulationTestRepository } from '@/Repositories/ArticulationTestRepository';
import { VerbalAudiometryRepository } from '@/Repositories/VerbalAudiometryRepository';
import { ScreeningRepository } from '@/Repositories/ScreeningRepository';
import { EvaluationRepository } from '@/Repositories/EvaluationRepository';

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
import { imcLabel, suspicionLabel } from '@/Screens/SahsScreening/sahsScreeningResult';
import { generateReport } from '@/PDF/templates/Report';
import { showErrorToast, showSuccessToast } from '@/Helpers/showToast';

/* -------------------------------------------------------------------------- */
/*  ResultadosFinalScreen — vista de resultados detallados (mockup            */
/*  `Resultados Detallados.dc.html`). Panel de navegación lateral por prueba  */
/*  + panel de detalle (tabla de audiometría / parámetros / filas) +          */
/*  generación y "compartir" de informe PDF (`generateReport`).               */
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
  od?: (number | null)[];
  oi?: (number | null)[];
  /** Umbrales de campo libre (cribado binaural sin discriminación de oído). */
  cl?: (number | null)[];
  params?: ParamRow[];
  rows?: SimpleRow[];
  interp: string;
}

const STATUS_TOKENS: Record<StatusKind, { fg: string; bg: string; label: string }> = {
  ok: { fg: '$success700', bg: '$success50', label: 'Normal' },
  warn: { fg: '$warning800', bg: '$warning50', label: 'Revisar' },
  alt: { fg: '$error700', bg: '$error50', label: 'Alterado' },
};

const cellTokens = (v: number | null): { fg: string; bg: string } => {
  if (v == null) return { fg: '$textLight400', bg: '$backgroundLight50' };
  if (v <= 20) return { fg: '$success700', bg: '$success50' };
  if (v <= 40) return { fg: '$warning800', bg: '$warning50' };
  return { fg: '$error700', bg: '$error50' };
};

export default function ResultadosFinalScreen({ navigation }: Props) {
  const dispatch = useDispatch<AppDispatch>();
  const activeEvaluation = useClassSelector(Evaluation, (state: RootState) => state.activeEvaluation.evaluation);
  const patient = activeEvaluation?.patient;
  const patientName = patient ? `${patient.name} ${patient.lastName}`.trim() : null;
  const evaluationId = activeEvaluation?.id;

  const [tests, setTests] = useState<TestDetail[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [shareOpen, setShareOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (!evaluationId) {
      setIsLoading(false);
      return;
    }
    let mounted = true;
    (async () => {
      try {
        const result: TestDetail[] = [];

        const audiometries = await AudiometryRepository.getAudiometryByEvaluation(evaluationId);
        audiometries.forEach(a => {
          const od = FREQS.map(f => a.thresholds.OD[f] ?? null);
          const oi = FREQS.map(f => a.thresholds.OI[f] ?? null);
          const cl = a.thresholds.CL ? FREQS.map(f => a.thresholds.CL?.[f] ?? null) : undefined;
          // Campo libre: un umbral ausente = sin respuesta al nivel máximo → alterado.
          const vals = cl ?? [...od, ...oi];
          const worst = vals.some(v => v != null && v > 20) ? 'warn' : 'ok';
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
            icon: Ear,
            od,
            oi,
            cl,
            interp: interpretAudiometry(a.thresholds),
          });
        });

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
            rows,
            interp: v.interpretation || 'Audiometría verbal completada.',
          });
        });

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
              rows: g
                ? [
                    { label: 'GRBAS · valoración perceptual', value: `G${g.g} R${g.r} B${g.b} A${g.a} S${g.s}`, status: g.g >= 2 ? 'alt' : g.g === 1 ? 'warn' : 'ok', tag: `total ${g.g + g.r + g.b + g.a + g.s}/15` },
                  ]
                : [],
              interp: v.interpretation || 'Prueba de voz cerrada manualmente (análisis acústico no disponible).',
            });
            return;
          }
          const sF0 = statusF0(v.f0);
          const sJ = statusJitter(v.jitter);
          const sS = statusShimmer(v.shimmer);
          const sH = statusHnr(v.hnr);
          const toKind = (s: string): StatusKind => (s === 'normal' ? 'ok' : s === 'borderline' ? 'warn' : 'alt');
          const params: ParamRow[] = [
            { label: 'F0 · frecuencia fundamental', value: `${Math.round(v.f0)} Hz`, status: toKind(sF0), ref: '200–320 Hz' },
            { label: 'Jitter', value: `${v.jitter.toFixed(1)} %`, status: toKind(sJ), ref: '< 1.0 %' },
            { label: 'Shimmer', value: `${v.shimmer.toFixed(1)} %`, status: toKind(sS), ref: '< 3.0 %' },
            { label: 'HNR · relación armónico-ruido', value: `${Math.round(v.hnr)} dB`, status: toKind(sH), ref: '> 20 dB' },
          ];
          const overall: StatusKind = params.some(p => p.status === 'alt') ? 'alt' : params.some(p => p.status === 'warn') ? 'warn' : 'ok';
          result.push({
            id: `voice-${v.id}`,
            kind: 'params',
            status: overall,
            title: 'Análisis Acústico de Voz',
            subtitle: 'Vocal sostenida /a/ · parámetros perturbatorios',
            icon: Mic2,
            params,
            interp: buildVoiceInterpretation({ f0: v.f0, jitter: v.jitter, shimmer: v.shimmer, hnr: v.hnr, formants: v.formants }),
          });
        });

        const articulations = await ArticulationTestRepository.getArticulationByEvaluation(evaluationId);
        articulations.forEach(a => {
          const rows: SimpleRow[] = [
            { label: 'Ítems acertados', value: `${a.evaluatedCount} / ${a.totalCount}`, status: a.correctPct >= 90 ? 'ok' : a.correctPct >= 70 ? 'warn' : 'alt', tag: `${a.correctPct} %` },
            { label: 'Sustituciones · S', value: `${a.sodaCounts.S ?? 0}`, status: (a.sodaCounts.S ?? 0) > 0 ? 'warn' : 'ok', tag: a.affectedPhonemes.map(p => p.phoneme).join(', ') || '—' },
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
            icon: Stethoscope,
            rows,
            interp: `${a.correctPct}% de producción correcta. ${a.affectedPhonemes.length} fonema(s) afectado(s).`,
          });
        });

        const sahsScreenings = await SahsScreeningRepository.getSahsScreeningsByEvaluation(evaluationId);
        sahsScreenings.forEach(s => {
          const status: StatusKind = s.suspicionLevel === 'high' ? 'alt' : s.suspicionLevel === 'med' ? 'warn' : 'ok';
          const params: ParamRow[] = [
            { label: 'PSQ de Chervin', value: `${(s.psqYesCount / s.psqTotal).toFixed(2)}`, status, ref: '< 0.33 (positivo ≥0.33)' },
            { label: 'Hipertrofia amigdalar · Brodsky', value: s.brodsky != null ? `Grado ${s.brodsky}` : '—', status, ref: 'I–II bajo · III–IV alto' },
            { label: 'IMC · categoría', value: imcLabel(s.imc), status, ref: 'normopeso esperado' },
          ];
          result.push({
            id: `sahs-${s.id}`,
            kind: 'params',
            status,
            title: 'Cribado SAHS Infantil',
            subtitle: 'PSQ de Chervin · Brodsky · IMC',
            icon: Waves,
            params,
            interp: `${suspicionLabel(s.suspicionLevel)}. ${s.recommendation}`,
          });
        });

        const screenings = await ScreeningRepository.getScreeningsByEvaluation(evaluationId);
        screenings.forEach(s => {
          const status: StatusKind = s.riskLevel === 'high' ? 'alt' : s.riskLevel === 'med' ? 'warn' : 'ok';
          result.push({
            id: `screen-${s.id}`,
            kind: 'params',
            status,
            title: s.instrument === 'autism-tea' ? 'Cuestionario Autismo' : s.instrument,
            subtitle: 'Cribado de TEA · 20 ítems',
            icon: Baby,
            params: [{ label: 'Puntuación total', value: `${s.score} / ${s.total}`, status, ref: s.rangeLabel }],
            interp: s.recommendation,
          });
        });

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
            icon: Activity,
            rows,
            interp: d.interpretation || 'Exploración MECV-V completada.',
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

  const active = useMemo(() => tests.find(t => t.id === activeId) ?? tests[0] ?? null, [tests, activeId]);

  const handleShare = async (target: 'whatsapp' | 'correo' | 'imprimir' | 'mas') => {
    if (!activeEvaluation) return;
    setShareOpen(false);
    setIsGenerating(true);
    try {
      let evaluation = activeEvaluation as unknown as Evaluation;
      if (evaluationId) {
        const fetched = await EvaluationRepository.getEvaluationById(evaluationId);
        if (fetched) evaluation = fetched;
      }
      await generateReport({ evaluation });
      const labels: Record<typeof target, string> = {
        whatsapp: 'WhatsApp',
        correo: 'Correo',
        imprimir: 'Impresión',
        mas: 'otras apps',
      };
      showSuccessToast('Informe generado', `PDF listo para compartir vía ${labels[target]}.`);
    } catch (e) {
      showErrorToast('Error al generar informe', 'No se pudo generar el PDF. Inténtelo de nuevo.');
    } finally {
      setIsGenerating(false);
    }
  };

  const SHARE_TARGETS: { key: 'whatsapp' | 'correo' | 'imprimir' | 'mas'; label: string; icon: any; fg: string; bg: string }[] = [
    { key: 'whatsapp', label: 'WhatsApp', icon: Share2, fg: '$success600', bg: '$success50' },
    { key: 'correo', label: 'Correo', icon: Mail, fg: '$info600', bg: '$info50' },
    { key: 'imprimir', label: 'Imprimir', icon: Printer, fg: '$textLight600', bg: '$backgroundLight100' },
    { key: 'mas', label: 'Más apps', icon: MoreHorizontal, fg: '$warning700', bg: '$warning50' },
  ];

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

        <VStack flex={1} px="$6" mt="$2" space="md">
          {/* ----- title + share ----- */}
          <HStack alignItems="flex-start" justifyContent="space-between">
            <VStack>
              <Text size="2xl" weight="bold" color="$textLight900">
                Resultados detallados
              </Text>
              <Text size="xs" color="$textLight500" style={{ fontVariant: ['tabular-nums'] }}>
                {patientName ? `${patientName}${patient?.nhc ? ` · NHC ${patient.nhc}` : ''}` : 'Sesión actual'}
              </Text>
            </VStack>
            <Button action="primary" variant="solid" rounded="$full" isLoading={isGenerating} onPress={() => setShareOpen(true)}>
              <HStack space="sm" alignItems="center">
                <Icon as={Share2} size="sm" color="$white" />
                <Text size="sm" weight="bold" color="$white">
                  Compartir PDF
                </Text>
              </HStack>
            </Button>
          </HStack>

          {isLoading ? (
            <Text size="xs" color="$textLight400" style={{ textAlign: 'center' }} mt="$4">
              Cargando resultados…
            </Text>
          ) : tests.length === 0 ? (
            <Text size="xs" color="$textLight400" style={{ textAlign: 'center' }} mt="$4">
              Todavía no hay resultados registrados en esta sesión.
            </Text>
          ) : (
            <HStack space="md" style={{ flex: 1, minHeight: 0 }}>
              {/* ----- sidebar nav ----- */}
              <VStack space="sm" style={{ width: 248 }}>
                {tests.map(t => {
                  const tokens = STATUS_TOKENS[t.status];
                  const isActive = t.id === active?.id;
                  return (
                    <Pressable key={t.id} onPress={() => setActiveId(t.id)}>
                      <Card
                        bgColor={isActive ? '$primary0' : '$white'}
                        borderRadius={15}
                        borderWidth={1.5}
                        borderColor={isActive ? '$primary300' : '$borderLight100'}
                        p="$3">
                        <HStack space="sm" alignItems="center">
                          <Box w={9} h={9} borderRadius="$full" bg={tokens.fg} />
                          <VStack style={{ flex: 1 }}>
                            <Text size="xs" weight="semiBold" color="$textLight900" style={{ lineHeight: 16 }}>
                              {t.title}
                            </Text>
                            <Text size="2xs" color="$textLight400" mt="$0.5">
                              {tokens.label}
                            </Text>
                          </VStack>
                        </HStack>
                      </Card>
                    </Pressable>
                  );
                })}

                <Button action="secondary" variant="outline" rounded="$full" mt="$1" onPress={() => navigation.navigate('SeleccionEjercicios')}>
                  <HStack space="sm" alignItems="center">
                    <Icon as={ChevronLeft} size="sm" color="$primary500" />
                    <Text size="sm" weight="bold" color="$primary500">
                      Volver a ejercicios
                    </Text>
                  </HStack>
                </Button>

                {/* cierre de la sesión clínica: nuevo paciente o salir */}
                <Button action="secondary" variant="outline" rounded="$full" mt="$1" onPress={() => navigation.navigate('Pacientes')}>
                  <HStack space="sm" alignItems="center">
                    <Icon as={UserPlus} size="sm" color="$primary500" />
                    <Text size="sm" weight="bold" color="$primary500">
                      Nuevo paciente
                    </Text>
                  </HStack>
                </Button>
                <Button action="secondary" variant="outline" rounded="$full" mt="$1" onPress={() => dispatch(logout())}>
                  <HStack space="sm" alignItems="center">
                    <Icon as={LogOut} size="sm" color="$error500" />
                    <Text size="sm" weight="bold" color="$error500">
                      Cerrar sesión
                    </Text>
                  </HStack>
                </Button>

                <Card bgColor="$white" borderRadius={14} p="$3" mt="auto">
                  <Text size="2xs" color="$textLight400" style={{ lineHeight: 15 }}>
                    Medidas orientativas sobre el dispositivo. No sustituyen equipo certificado ni constituyen diagnóstico.
                  </Text>
                </Card>
              </VStack>

              {/* ----- detail panel ----- */}
              {active ? (
                <Card bgColor="$white" borderRadius={20} p="$0" style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                  <HStack alignItems="center" justifyContent="space-between" p="$4" borderBottomWidth={1} borderColor="$borderLight100">
                    <HStack space="sm" alignItems="center" style={{ flex: 1, minWidth: 0 }}>
                      <Box w={46} h={46} borderRadius={13} alignItems="center" justifyContent="center" bg={STATUS_TOKENS[active.status].bg}>
                        <Icon as={active.icon} size="sm" color={STATUS_TOKENS[active.status].fg} />
                      </Box>
                      <VStack style={{ flex: 1 }}>
                        <Text size="md" weight="bold" color="$textLight900">
                          {active.title}
                        </Text>
                        <Text size="2xs" color="$textLight400" mt="$0.5">
                          {active.subtitle}
                        </Text>
                      </VStack>
                    </HStack>
                    <Box bg={STATUS_TOKENS[active.status].bg} px="$3" py="$1" borderRadius="$full">
                      <Text size="2xs" weight="bold" color={STATUS_TOKENS[active.status].fg}>
                        {STATUS_TOKENS[active.status].label}
                      </Text>
                    </Box>
                  </HStack>

                  <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20 }}>
                    {active.kind === 'audio' && (active.cl || (active.od && active.oi)) ? (
                      <VStack space="md" mb="$4">
                        <Box borderWidth={1} borderColor="$borderLight100" borderRadius={16} style={{ overflow: 'hidden' }}>
                          <HStack bg="$backgroundLight50" borderBottomWidth={1} borderColor="$borderLight100">
                            <Box style={{ width: 56 }} p="$2.5">
                              <Text size="2xs" weight="bold" color="$textLight400">
                                Hz
                              </Text>
                            </Box>
                            {FREQS.map(f => (
                              <Box key={f} style={{ flex: 1 }} p="$2.5" alignItems="center">
                                <Text size="xs" weight="bold" color="$textLight600" style={{ fontVariant: ['tabular-nums'] }}>
                                  {f >= 1000 ? `${f / 1000}k` : f}
                                </Text>
                              </Box>
                            ))}
                          </HStack>
                          {(active.cl
                            ? [{ label: 'CL', values: active.cl }]
                            : [
                                { label: 'OD', values: active.od! },
                                { label: 'OI', values: active.oi! },
                              ]
                          ).map((row, idx) => (
                            <HStack key={row.label} borderBottomWidth={idx === 0 && !active.cl ? 1 : 0} borderColor="$borderLight100">
                              <Box style={{ width: 56 }} p="$2.5" alignItems="flex-start" justifyContent="center">
                                <Text size="xs" weight="bold" color="$textLight900">
                                  {row.label}
                                </Text>
                              </Box>
                              {row.values.map((v, i) => {
                                const t = cellTokens(v);
                                return (
                                  <Box key={i} style={{ flex: 1 }} p="$2" alignItems="center">
                                    <Box bg={t.bg} px="$2" py="$1" borderRadius={9} style={{ minWidth: 42, alignItems: 'center' }}>
                                      <Text size="xs" weight="bold" color={t.fg} style={{ fontVariant: ['tabular-nums'] }}>
                                        {v ?? '—'}
                                      </Text>
                                    </Box>
                                  </Box>
                                );
                              })}
                            </HStack>
                          ))}
                        </Box>
                        <HStack space="md">
                          <HStack space="xs" alignItems="center">
                            <Box w={11} h={11} borderRadius={3} bg="$success50" borderWidth={1} borderColor="$success200" />
                            <Text size="2xs" color="$textLight400">
                              Normal ≤20
                            </Text>
                          </HStack>
                          <HStack space="xs" alignItems="center">
                            <Box w={11} h={11} borderRadius={3} bg="$warning50" borderWidth={1} borderColor="$warning200" />
                            <Text size="2xs" color="$textLight400">
                              Leve 21–40
                            </Text>
                          </HStack>
                          <HStack space="xs" alignItems="center">
                            <Box w={11} h={11} borderRadius={3} bg="$error50" borderWidth={1} borderColor="$error200" />
                            <Text size="2xs" color="$textLight400">
                              &gt;40 dB HL
                            </Text>
                          </HStack>
                        </HStack>
                      </VStack>
                    ) : null}

                    {active.kind === 'params' && active.params ? (
                      <VStack space="lg" mb="$2">
                        {active.params.map((p, idx) => {
                          const tokens = STATUS_TOKENS[p.status];
                          return (
                            <VStack key={idx}>
                              <HStack alignItems="baseline" justifyContent="space-between" mb="$1.5">
                                <Text size="sm" weight="semiBold" color="$textLight700" style={{ flex: 1 }}>
                                  {p.label}
                                </Text>
                                <HStack space="sm" alignItems="baseline">
                                  <Text size="md" weight="bold" color={tokens.fg} style={{ fontVariant: ['tabular-nums'] }}>
                                    {p.value}
                                  </Text>
                                  <Box bg={tokens.bg} px="$2.5" py="$1" borderRadius="$full">
                                    <Text size="2xs" weight="bold" color={tokens.fg}>
                                      {tokens.label}
                                    </Text>
                                  </Box>
                                </HStack>
                              </HStack>
                              <Box h={8} borderRadius="$full" bg="$backgroundLight100" />
                              <Text size="2xs" color="$textLight400" mt="$1.5">
                                Referencia: {p.ref}
                              </Text>
                            </VStack>
                          );
                        })}
                      </VStack>
                    ) : null}

                    {active.kind === 'rows' && active.rows ? (
                      <Box borderWidth={1} borderColor="$borderLight100" borderRadius={16} style={{ overflow: 'hidden' }} mb="$2">
                        {active.rows.map((r, idx) => {
                          const tokens = STATUS_TOKENS[r.status];
                          return (
                            <HStack
                              key={idx}
                              alignItems="center"
                              justifyContent="space-between"
                              p="$3.5"
                              borderBottomWidth={idx === active.rows!.length - 1 ? 0 : 1}
                              borderColor="$borderLight100">
                              <Text size="sm" weight="semiBold" color="$textLight700">
                                {r.label}
                              </Text>
                              <HStack space="sm" alignItems="center">
                                <Text size="md" weight="bold" color={tokens.fg} style={{ fontVariant: ['tabular-nums'] }}>
                                  {r.value}
                                </Text>
                                <Box bg={tokens.bg} px="$2.5" py="$1" borderRadius="$full">
                                  <Text size="2xs" weight="bold" color={tokens.fg}>
                                    {r.tag}
                                  </Text>
                                </Box>
                              </HStack>
                            </HStack>
                          );
                        })}
                      </Box>
                    ) : null}

                    <Box borderRadius={14} p="$3.5" bg={STATUS_TOKENS[active.status].bg} mt="$2">
                      <HStack space="xs" alignItems="center" mb="$1.5">
                        <Icon as={AlertCircle} size="2xs" color={STATUS_TOKENS[active.status].fg} />
                        <Text size="xs" weight="bold" color={STATUS_TOKENS[active.status].fg}>
                          Interpretación
                        </Text>
                      </HStack>
                      <Text size="xs" color="$textLight600" style={{ lineHeight: 18 }}>
                        {active.interp}
                      </Text>
                    </Box>
                  </ScrollView>
                </Card>
              ) : null}
            </HStack>
          )}

          <Box h="$4" />
        </VStack>
      </VStack>

      {/* ----- share bottom sheet ----- */}
      {shareOpen ? (
        <Pressable
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(40,30,15,0.42)', justifyContent: 'flex-end' }}
          onPress={() => setShareOpen(false)}>
          <Pressable onPress={() => {}}>
            <Card bgColor="$white" p="$6" style={{ borderTopLeftRadius: 26, borderTopRightRadius: 26 }}>
              <Box w={44} h={5} borderRadius="$full" bg="$backgroundLight200" alignSelf="center" mb="$4" />
              <HStack space="sm" alignItems="center" mb="$5">
                <Box w={48} h={48} borderRadius={13} bg="$error50" alignItems="center" justifyContent="center">
                  <Icon as={FileText} size="md" color="$error600" />
                </Box>
                <VStack>
                  <Text size="md" weight="bold" color="$textLight900">
                    Compartir informe en PDF
                  </Text>
                  <Text size="2xs" color="$textLight400" style={{ fontVariant: ['tabular-nums'] }}>
                    {patient?.nhc ? `VIA_${patient.nhc}_detallado.pdf` : 'VIA_informe_detallado.pdf'}
                  </Text>
                </VStack>
              </HStack>
              <HStack flexWrap="wrap" style={{ gap: 12 }}>
                {SHARE_TARGETS.map(t => (
                  <Pressable key={t.key} style={{ width: '22.5%' }} onPress={() => handleShare(t.key)}>
                    <VStack alignItems="center" space="sm" bg="$backgroundLight50" borderWidth={1} borderColor="$borderLight100" borderRadius={16} p="$3">
                      <Box w={52} h={52} borderRadius={15} alignItems="center" justifyContent="center" bg={t.bg}>
                        <Icon as={t.icon} size="md" color={t.fg} />
                      </Box>
                      <Text size="xs" weight="semiBold" color="$textLight700">
                        {t.label}
                      </Text>
                    </VStack>
                  </Pressable>
                ))}
              </HStack>
              <Button action="secondary" variant="outline" rounded="$full" mt="$5" onPress={() => setShareOpen(false)}>
                <Text size="sm" weight="bold" color="$textLight600">
                  Cancelar
                </Text>
              </Button>
            </Card>
          </Pressable>
        </Pressable>
      ) : null}
    </Content>
  );
}
