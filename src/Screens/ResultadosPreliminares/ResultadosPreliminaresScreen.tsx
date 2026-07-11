import React, { useEffect, useMemo, useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Box, Card, HStack, Icon, VStack } from '@gluestack-ui/themed';
import { AlertTriangle, ArrowRight, ChevronLeft } from 'lucide-react-native';

import { Button, Content, Header, Text } from '@/Components/Common';
import RadialBackground from '@/Components/Themed/RadialBackground';
import { RootStackParamList } from '@/Navigators';
import { RootState } from '@/Store';
import { Evaluation } from '@/Models/Evaluation/Evaluation';
import { useClassSelector } from '@/Helpers/ClassTransformer';

import { AudiometryRepository } from '@/Repositories/AudiometryRepository';
import { VoiceAnalysisRepository } from '@/Repositories/VoiceAnalysisRepository';
import { DysphagiaTestRepository } from '@/Repositories/DysphagiaTestRepository';
import { SahsScreeningRepository } from '@/Repositories/SahsScreeningRepository';
import { ArticulationTestRepository } from '@/Repositories/ArticulationTestRepository';
import { ScreeningRepository } from '@/Repositories/ScreeningRepository';

import { interpretAudiometry, pta, severityOf } from '@/Screens/Audiometry/audiometryResult';
import { buildInterpretation as buildVoiceInterpretation } from '@/Screens/VoiceAnalysis/voiceAnalysisResult';

/* -------------------------------------------------------------------------- */
/*  ResultadosPreliminaresScreen — vista rápida de resultados de la sesión    */
/*  (mockup `Resultados Preliminares.dc.html`). Lee cada repositorio de       */
/*  módulo por evaluación y muestra una tarjeta resumida por resultado.       */
/* -------------------------------------------------------------------------- */

type Props = NativeStackScreenProps<RootStackParamList, 'ResultadosPreliminares'>;

type StatusKind = 'ok' | 'warn' | 'alt';

interface ResultCard {
  key: string;
  title: string;
  status: StatusKind;
  headline: string;
  metric: string;
}

const STATUS_TOKENS: Record<StatusKind, { fg: string; bg: string; label: string }> = {
  ok: { fg: '$success700', bg: '$success50', label: 'Normal' },
  warn: { fg: '$warning800', bg: '$warning50', label: 'Revisar' },
  alt: { fg: '$error700', bg: '$error50', label: 'Alterado' },
};

export default function ResultadosPreliminaresScreen({ navigation }: Props) {
  const activeEvaluation = useClassSelector(Evaluation, (state: RootState) => state.activeEvaluation.evaluation);
  const patient = activeEvaluation?.patient;
  const patientName = patient ? `${patient.name} ${patient.lastName}`.trim() : null;
  const evaluationId = activeEvaluation?.id;

  const [cards, setCards] = useState<ResultCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!evaluationId) {
      setIsLoading(false);
      return;
    }
    let mounted = true;
    (async () => {
      try {
        const result: ResultCard[] = [];

        const audiometries = await AudiometryRepository.getAudiometryByEvaluation(evaluationId);
        audiometries.forEach(a => {
          let status: StatusKind;
          let metric: string;
          if (a.thresholds.CL) {
            // Cribado en campo libre: PTA binaural único.
            const clPta = pta(a.thresholds.CL);
            status = severityOf(clPta)?.key === 'normal' ? 'ok' : 'warn';
            metric = `Campo libre ${clPta ?? '—'} dB HL`;
          } else {
            const odPta = pta(a.thresholds.OD);
            const oiPta = pta(a.thresholds.OI);
            const sevOd = severityOf(odPta);
            const sevOi = severityOf(oiPta);
            status = (sevOd?.key !== 'normal' || sevOi?.key !== 'normal') ? 'warn' : 'ok';
            metric = `OD ${odPta ?? '—'} dB HL · OI ${oiPta ?? '—'} dB HL`;
          }
          result.push({
            key: `audio-${a.id}`,
            title: a.method === 'conditioned' ? 'Audiometría Condicionada' : 'Audiometría Infantil',
            status,
            headline: interpretAudiometry(a.thresholds),
            metric,
          });
        });

        const voiceAnalyses = await VoiceAnalysisRepository.getVoiceAnalysisByEvaluation(evaluationId);
        voiceAnalyses.forEach(v => {
          // Cierre manual: sin acústica, se muestra la valoración GRBAS registrada.
          if (v.f0 == null || v.jitter == null || v.shimmer == null || v.hnr == null) {
            result.push({
              key: `voice-${v.id}`,
              title: 'Análisis Acústico de Voz',
              status: v.grbas && v.grbas.g >= 1 ? 'warn' : 'ok',
              headline: v.interpretation || 'Prueba de voz cerrada manualmente (análisis acústico no disponible).',
              metric: v.grbas
                ? `GRBAS G${v.grbas.g} R${v.grbas.r} B${v.grbas.b} A${v.grbas.a} S${v.grbas.s}`
                : 'Cierre manual',
            });
            return;
          }
          const params = { f0: v.f0, jitter: v.jitter, shimmer: v.shimmer, hnr: v.hnr, formants: v.formants };
          const interp = buildVoiceInterpretation(params);
          const altered = interp.startsWith('Se observa');
          result.push({
            key: `voice-${v.id}`,
            title: 'Análisis Acústico de Voz',
            status: altered ? 'alt' : 'ok',
            headline: interp,
            metric: `F0 ${Math.round(v.f0)} Hz · Jitter ${v.jitter.toFixed(1)}% · Shimmer ${v.shimmer.toFixed(1)}%`,
          });
        });

        const dysphagias = await DysphagiaTestRepository.getDysphagiaByEvaluation(evaluationId);
        dysphagias.forEach(d => {
          const status: StatusKind = d.verdict === 'safe' ? 'ok' : d.verdict === 'safety' ? 'alt' : 'warn';
          result.push({
            key: `dys-${d.id}`,
            title: 'Exploración de Disfagia',
            status,
            headline: d.interpretation || 'Exploración MECV-V completada.',
            metric: `SpO₂ basal ${d.basalSpO2}% · mín. ${d.minSpO2 ?? '—'}%`,
          });
        });

        const sahsScreenings = await SahsScreeningRepository.getSahsScreeningsByEvaluation(evaluationId);
        sahsScreenings.forEach(s => {
          const status: StatusKind = s.suspicionLevel === 'high' ? 'alt' : s.suspicionLevel === 'med' ? 'warn' : 'ok';
          result.push({
            key: `sahs-${s.id}`,
            title: 'Cribado SAHS Infantil',
            status,
            headline: s.suspicionLabel || s.recommendation,
            metric: `PSQ ${s.psqYesCount}/${s.psqTotal} · Puntuación ${s.totalScore}/${s.scoreMax}`,
          });
        });

        const articulations = await ArticulationTestRepository.getArticulationByEvaluation(evaluationId);
        articulations.forEach(a => {
          const status: StatusKind = a.correctPct >= 90 ? 'ok' : a.correctPct >= 70 ? 'warn' : 'alt';
          result.push({
            key: `art-${a.id}`,
            title: 'Articulación · T.A.R.',
            status,
            headline: `${a.correctPct}% de producción correcta`,
            metric: `${a.evaluatedCount}/${a.totalCount} ítems · ${a.affectedPhonemes.length} fonema(s) afectado(s)`,
          });
        });

        const screenings = await ScreeningRepository.getScreeningsByEvaluation(evaluationId);
        screenings.forEach(s => {
          const status: StatusKind = s.riskLevel === 'high' ? 'alt' : s.riskLevel === 'med' ? 'warn' : 'ok';
          result.push({
            key: `screen-${s.id}`,
            title: s.instrument === 'autism-tea' ? 'Cuestionario Autismo' : s.instrument,
            status,
            headline: s.rangeLabel,
            metric: `Puntuación ${s.score}/${s.total}`,
          });
        });

        if (mounted) setCards(result);
      } finally {
        if (mounted) setIsLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [evaluationId]);

  const counts = useMemo(() => {
    const ok = cards.filter(c => c.status === 'ok').length;
    const warn = cards.filter(c => c.status === 'warn').length;
    const alt = cards.filter(c => c.status === 'alt').length;
    return { ok, warn, alt };
  }, [cards]);

  const affectedAreas = counts.warn + counts.alt;

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
          {/* ----- title ----- */}
          <HStack alignItems="flex-start" justifyContent="space-between">
            <VStack>
              <HStack alignItems="center" space="sm">
                <Text size="2xl" weight="bold" color="$textLight900">
                  Resultados preliminares
                </Text>
                <Box bg="$backgroundLight100" px="$2" py="$0.5" borderRadius="$full">
                  <Text size="2xs" weight="bold" color="$textLight500" style={{ letterSpacing: 0.4 }}>
                    VISTA RÁPIDA
                  </Text>
                </Box>
              </HStack>
              <Text size="xs" color="$textLight500">
                {patientName ? `${patientName}${patient?.nhc ? ` · NHC ${patient.nhc}` : ''}` : 'Resultados de la sesión actual'}
              </Text>
            </VStack>
          </HStack>

          {/* ----- summary banner ----- */}
          <Card bgColor="$warning50" borderRadius={20} p="$4">
            <HStack space="sm" alignItems="flex-start">
              <Icon as={AlertTriangle} size="sm" color="$warning700" style={{ marginTop: 2 }} />
              <VStack style={{ flex: 1 }}>
                <Text size="md" weight="bold" color="$warning800">
                  {affectedAreas} área{affectedAreas === 1 ? '' : 's'} con hallazgos
                </Text>
                <Text size="xs" color="$warning700" mt="$0.5">
                  {cards.length} prueba{cards.length === 1 ? '' : 's'} realizada{cards.length === 1 ? '' : 's'} · revise los resultados con hallazgos
                </Text>
              </VStack>
            </HStack>
            <HStack space="sm" mt="$3">
              {[
                { label: 'Normal', value: counts.ok, c: STATUS_TOKENS.ok },
                { label: 'Revisar', value: counts.warn, c: STATUS_TOKENS.warn },
                { label: 'Alterado', value: counts.alt, c: STATUS_TOKENS.alt },
              ].map(s => (
                <Box key={s.label} bg={s.c.bg} px="$3" py="$1.5" borderRadius="$full" style={{ flex: 1 }}>
                  <Text size="xs" weight="bold" color={s.c.fg} style={{ textAlign: 'center' }}>
                    {s.value} {s.label}
                  </Text>
                </Box>
              ))}
            </HStack>
          </Card>

          {/* ----- results grid ----- */}
          {isLoading ? (
            <Text size="xs" color="$textLight400" style={{ textAlign: 'center' }} mt="$4">
              Cargando resultados…
            </Text>
          ) : cards.length === 0 ? (
            <Text size="xs" color="$textLight400" style={{ textAlign: 'center' }} mt="$4">
              Todavía no hay resultados registrados en esta sesión.
            </Text>
          ) : (
            <HStack flexWrap="wrap" style={{ gap: 10 }}>
              {cards.map(c => {
                const tokens = STATUS_TOKENS[c.status];
                return (
                  <Card key={c.key} bgColor="$white" borderRadius={16} p="$3.5" style={{ width: '31.5%', minHeight: 130 }}>
                    <Box bg={tokens.bg} px="$2" py="$0.5" borderRadius="$full" alignSelf="flex-start" mb="$2">
                      <Text size="2xs" weight="bold" color={tokens.fg}>
                        {tokens.label}
                      </Text>
                    </Box>
                    <Text size="xs" weight="bold" color="$textLight900" style={{ lineHeight: 15 }}>
                      {c.title}
                    </Text>
                    <HStack alignItems="center" space="xs" mt="$1">
                      <Box w={6} h={6} borderRadius="$full" bg={tokens.fg} />
                      <Text size="2xs" color="$textLight600" style={{ flex: 1, lineHeight: 13 }}>
                        {c.headline}
                      </Text>
                    </HStack>
                    <Text size="2xs" color="$textLight400" mt="$1.5" style={{ fontVariant: ['tabular-nums'], lineHeight: 12 }}>
                      {c.metric}
                    </Text>
                  </Card>
                );
              })}
            </HStack>
          )}

          <Text size="2xs" color="$textLight400" mt="$2" style={{ lineHeight: 15 }}>
            Vista preliminar orientativa. No constituye un informe clínico definitivo; consulte el detalle completo antes
            de comunicar resultados a la familia.
          </Text>

          <Box style={{ flex: 1 }} />

          {/* ----- footer ----- */}
          <HStack space="sm" mb="$6">
            <Button action="secondary" variant="outline" rounded="$full" style={{ flex: 1 }} onPress={() => navigation.navigate('SeleccionEjercicios')}>
              <HStack space="sm" alignItems="center">
                <Icon as={ChevronLeft} size="sm" color="$primary500" />
                <Text size="sm" weight="bold" color="$primary500">
                  Volver a ejercicios
                </Text>
              </HStack>
            </Button>
            <Button action="primary" variant="solid" rounded="$full" style={{ flex: 1 }} onPress={() => navigation.navigate('ResultadosFinal')}>
              <HStack space="sm" alignItems="center">
                <Text size="sm" weight="bold" color="$white">
                  Ver detallados
                </Text>
                <Icon as={ArrowRight} size="sm" color="$white" />
              </HStack>
            </Button>
          </HStack>
        </VStack>
      </VStack>
    </Content>
  );
}
