import React, { useEffect, useState } from 'react';
import { ScrollView } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Box, Card, HStack, Icon, VStack } from '@gluestack-ui/themed';
import { ChevronLeft, FileClock } from 'lucide-react-native';

import { Button, Content, Header, Text } from '@/Components/Common';
import RadialBackground from '@/Components/Themed/RadialBackground';
import { RootStackParamList } from '@/Navigators';
import { EvaluationRepository } from '@/Repositories/EvaluationRepository';
import { useT } from '@/I18n';
import {
  countResults,
  loadEvaluationResultCards,
  type ResultCard,
  type ResultStatus,
} from '@/Screens/ResultadosPreliminares/evaluationResults';

/* -------------------------------------------------------------------------- */
/*  HistorialPacienteScreen — pruebas realizadas a un paciente, sesión a       */
/*  sesión.                                                                    */
/*                                                                             */
/*  Faltaba una vía para consultar resultados de sesiones ANTERIORES: desde la */
/*  lista de pacientes solo se podía abrir una sesión nueva, y los resultados  */
/*  preliminares muestran únicamente la evaluación activa. Un expediente al    */
/*  que no se puede volver no sirve de expediente.                             */
/*                                                                             */
/*  Cada evaluación se lee con el MISMO cargador que los resultados            */
/*  preliminares (`evaluationResults`), así que las dos vistas no pueden       */
/*  divergir al ampliar la batería.                                            */
/* -------------------------------------------------------------------------- */

type Props = NativeStackScreenProps<RootStackParamList, 'HistorialPaciente'>;

const STATUS_TOKENS: Record<ResultStatus, { fg: string; bg: string; label: string }> = {
  ok: { fg: '$success700', bg: '$success50', label: 'Normal' },
  warn: { fg: '$warning800', bg: '$warning50', label: 'Revisar' },
  alt: { fg: '$error700', bg: '$error50', label: 'Alterado' },
};

interface SessionBlock {
  evaluationId: number;
  startedAt: Date | null;
  status: string;
  cards: ResultCard[];
}

const formatDate = (d: Date | null): string => {
  if (!d || Number.isNaN(d.getTime())) return 'Fecha no registrada';
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });
};

export default function HistorialPacienteScreen({ navigation, route }: Props) {
  const t = useT();
  const { patientId, patientName, nhc } = route.params;

  const [sessions, setSessions] = useState<SessionBlock[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const evaluations = await EvaluationRepository.getEvaluationsByPatient(patientId);
        const blocks: SessionBlock[] = [];
        for (const evaluation of evaluations) {
          blocks.push({
            evaluationId: evaluation.id,
            startedAt: evaluation.startedAt ? new Date(evaluation.startedAt) : null,
            status: evaluation.status,
            cards: await loadEvaluationResultCards(evaluation.id),
          });
        }
        if (mounted) setSessions(blocks);
      } catch (e) {
        console.error('VIA+: error cargando el historial del paciente', e);
        if (mounted) setError('No se pudo cargar el historial de pruebas de este paciente.');
      } finally {
        if (mounted) setIsLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [patientId]);

  // Sesiones sin ninguna prueba registrada (p. ej. un alta interrumpida) se
  // muestran igual: saber que existieron y quedaron vacías es información.
  const totalTests = sessions.reduce((n, s) => n + s.cards.length, 0);

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

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 8, paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}>
          <VStack space="md">
            {/* ----- title ----- */}
            <VStack>
              <HStack alignItems="center" space="sm">
                <Icon as={FileClock} size="sm" color="$primary600" />
                <Text size="2xl" weight="bold" color="$textLight900">
                  
                  {t.historialPaciente.historialPruebas}
                </Text>
              </HStack>
              <Text size="xs" color="$textLight500">
                {patientName}
                {nhc ? t.historialPaciente.nhc(nhc) : ''}
              </Text>
            </VStack>

            {isLoading ? (
              <Text size="xs" color="$textLight400" style={{ textAlign: 'center' }} mt="$6">
                
                {t.historialPaciente.cargandoHistorial}
              </Text>
            ) : error ? (
              <Card bgColor="$error50" borderRadius={18} p="$4">
                <Text size="xs" color="$error700" style={{ lineHeight: 17 }}>
                  {error}
                </Text>
              </Card>
            ) : sessions.length === 0 ? (
              <Card bgColor="$white" borderRadius={18} p="$5">
                <Text size="sm" weight="bold" color="$textLight800">
                  
                  {t.historialPaciente.sinSesionesRegistradas}
                </Text>
                <Text size="xs" color="$textLight500" mt="$1" style={{ lineHeight: 17 }}>
                  
                  {t.historialPaciente.estePacienteTodaviaTieneNinguna}
                </Text>
              </Card>
            ) : (
              <>
                <HStack space="sm" alignItems="center">
                  <Box bg="$backgroundLight100" px="$3" py="$1" borderRadius="$full">
                    <Text size="2xs" weight="bold" color="$textLight600">
                      {sessions.length}  {t.historialPaciente.sesion}{sessions.length === 1 ? '' : 'es'}
                    </Text>
                  </Box>
                  <Box bg="$backgroundLight100" px="$3" py="$1" borderRadius="$full">
                    <Text size="2xs" weight="bold" color="$textLight600">
                      {totalTests}  {t.historialPaciente.prueba}{totalTests === 1 ? '' : 's'}
                    </Text>
                  </Box>
                </HStack>

                {sessions.map(session => {
                  const counts = countResults(session.cards);
                  return (
                    <Card key={session.evaluationId} bgColor="$white" borderRadius={20} p="$4">
                      <HStack alignItems="flex-start" justifyContent="space-between">
                        <VStack style={{ flex: 1 }}>
                          <Text size="sm" weight="bold" color="$textLight900">
                            {formatDate(session.startedAt)}
                          </Text>
                          <Text size="2xs" color="$textLight400">
                            {session.cards.length}  {t.historialPaciente.prueba}{session.cards.length === 1 ? '' : 's'}
                            {counts.affected > 0 ? t.historialPaciente.hallazgos(counts.affected) : ''}
                          </Text>
                        </VStack>
                        <Box
                          bg={session.status === 'completed' ? '$success50' : '$warning50'}
                          px="$2.5"
                          py="$0.5"
                          borderRadius="$full">
                          <Text
                            size="2xs"
                            weight="bold"
                            color={session.status === 'completed' ? '$success700' : '$warning800'}>
                            {session.status === 'completed' ? t.historialPaciente.completada : t.historialPaciente.curso}
                          </Text>
                        </Box>
                      </HStack>

                      {session.cards.length === 0 ? (
                        <Text size="2xs" color="$textLight400" mt="$3" style={{ lineHeight: 15 }}>
                          
                          {t.historialPaciente.estaSesionLlegoRegistrarNinguna}
                        </Text>
                      ) : (
                        <VStack space="sm" mt="$3">
                          {session.cards.map(c => {
                            const tokens = STATUS_TOKENS[c.status];
                            return (
                              <VStack key={c.key} p="$3" borderRadius={14} bg="$backgroundLight50">
                                <HStack alignItems="center" justifyContent="space-between">
                                  <Text size="xs" weight="bold" color="$textLight900" style={{ flex: 1 }}>
                                    {c.title}
                                  </Text>
                                  <Box bg={tokens.bg} px="$2" py="$0.5" borderRadius="$full">
                                    <Text size="2xs" weight="bold" color={tokens.fg}>
                                      {tokens.label}
                                    </Text>
                                  </Box>
                                </HStack>
                                <Text size="2xs" color="$textLight600" mt="$1" style={{ lineHeight: 14 }}>
                                  {c.headline}
                                </Text>
                                <Text
                                  size="2xs"
                                  color="$textLight400"
                                  mt="$0.5"
                                  style={{ fontVariant: ['tabular-nums'], lineHeight: 13 }}>
                                  {c.metric}
                                </Text>
                              </VStack>
                            );
                          })}
                        </VStack>
                      )}
                    </Card>
                  );
                })}
              </>
            )}

            <Text size="2xs" color="$textLight400" mt="$2" style={{ lineHeight: 15 }}>
              
              {t.historialPaciente.resumenOrientativoPruebasYaRegistradas}
            </Text>

            <Button
              action="secondary"
              variant="outline"
              rounded="$full"
              onPress={() => navigation.goBack()}>
              <HStack space="sm" alignItems="center">
                <Icon as={ChevronLeft} size="sm" color="$primary500" />
                <Text size="sm" weight="bold" color="$primary500">
                  
                  {t.historialPaciente.volverPacientes}
                </Text>
              </HStack>
            </Button>
          </VStack>
        </ScrollView>
      </VStack>
    </Content>
  );
}
