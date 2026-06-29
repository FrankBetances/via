import React, { useMemo, useState } from 'react';
import { Pressable } from 'react-native';
import { StackScreenProps } from '@react-navigation/stack';
import { Box, Card, Center, HStack, Icon, VStack } from '@gluestack-ui/themed';
import {
  Activity,
  ArrowRight,
  Baby,
  Check,
  CheckCircle2,
  Ear,
  Mic2,
  Stethoscope,
  Waves,
} from 'lucide-react-native';

import { Button, Content, Header, Text } from '@/Components/Common';
import RadialBackground from '@/Components/Themed/RadialBackground';
import { RootStackParamList } from '@/Navigators';
import { RootState } from '@/Store';
import { Evaluation } from '@/Models/Evaluation/Evaluation';
import { useClassSelector } from '@/Helpers/ClassTransformer';

/* -------------------------------------------------------------------------- */
/*  SeleccionEjerciciosScreen — hub central de la batería (mockup            */
/*  `Selección de Pruebas.dc.html`). Tarjetas seleccionables por módulo;      */
/*  cada una navega a su pantalla real. Incluye las 7 pruebas disponibles     */
/*  en el sistema (las 6 enumeradas en la tarea + Análisis Acústico de Voz,   */
/*  ya registrada como módulo independiente — ver Contrato de Compilación).   */
/* -------------------------------------------------------------------------- */

type Props = StackScreenProps<RootStackParamList, 'SeleccionEjercicios'>;

interface ModuleCard {
  id: keyof RootStackParamList;
  title: string;
  description: string;
  meta: string;
  icon: any;
}

const MODULES: ModuleCard[] = [
  { id: 'VoiceAnalysis', title: 'Análisis Acústico de Voz', description: 'Vocal sostenida /a/ · F0, jitter, shimmer, HNR.', meta: '3–5 min · todas las edades', icon: Mic2 },
  { id: 'Audiometry', title: 'Audiometría Infantil', description: 'Audiometría tonal por juego (play audiometry).', meta: '6–8 min · 6 m – 5 a', icon: Ear },
  { id: 'AudiometryConditioned', title: 'Audiometría Condicionada', description: 'Respuesta condicionada visual (VRA).', meta: '8–10 min · 2–6 a', icon: Ear },
  { id: 'Articulation', title: 'Articulación · T.A.R.', description: 'Test de Articulación a la Repetición (SODA).', meta: '8–12 min · 3–7 a', icon: Stethoscope },
  { id: 'DysphagiaTest', title: 'Exploración de Disfagia', description: 'Cribado con pulsioximetría integrada.', meta: '10–15 min · pulsioximetría', icon: Activity },
  { id: 'Mchat', title: 'Cuestionario Autismo', description: 'Cribado M-CHAT-R/F de trastorno del espectro autista.', meta: '5–10 min · 16–30 m', icon: Baby },
  { id: 'SahsScreening', title: 'Cribado SAHS Infantil', description: 'PSQ de Chervin + exploración física.', meta: '5–8 min · 2–12 a', icon: Waves },
];

export default function SeleccionEjerciciosScreen({ navigation }: Props) {
  const activeEvaluation = useClassSelector(Evaluation, (state: RootState) => state.activeEvaluation.evaluation);
  const patient = activeEvaluation?.patient;
  const patientName = patient ? `${patient.name} ${patient.lastName}`.trim() : null;

  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selCount = selected.size;
  const ctaLabel = selCount > 1 ? 'Iniciar batería' : 'Iniciar prueba';

  const handleStart = () => {
    if (selCount === 0) return;
    const first = MODULES.find(m => selected.has(m.id));
    if (first) navigation.navigate(first.id as any);
  };

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
              <Text size="2xl" weight="bold" color="$textLight900">
                Selección de pruebas
              </Text>
              <Text size="xs" color="$textLight500">
                Elige las exploraciones para esta sesión
              </Text>
            </VStack>
            {patientName ? (
              <VStack alignItems="flex-end">
                <Text size="xs" weight="semiBold" color="$textLight800">
                  {patientName}
                </Text>
                {patient?.nhc ? (
                  <Text size="2xs" color="$textLight400">
                    NHC {patient.nhc}
                  </Text>
                ) : null}
              </VStack>
            ) : null}
          </HStack>

          {/* ----- CAP banner ----- */}
          <HStack alignItems="center" space="sm" bg="$success50" p="$3.5" borderRadius={16} borderWidth={1} borderColor="$success200">
            <Center w={32} h={32} borderRadius="$full" bg="$success600">
              <Icon as={Check} size="xs" color="$white" />
            </Center>
            <VStack style={{ flex: 1 }}>
              <Text size="sm" weight="bold" color="$success800">
                Certificado de Aptitud de sala generado
              </Text>
              <Text size="2xs" color="$success700" style={{ fontVariant: ['tabular-nums'] }}>
                {patient?.nhc ? `CAP-${patient.nhc} · ` : ''}sala apta · todas las pruebas disponibles
              </Text>
            </VStack>
          </HStack>

          {/* ----- module grid ----- */}
          <HStack flexWrap="wrap" style={{ gap: 10 }}>
            {MODULES.map(m => {
              const isSelected = selected.has(m.id);
              return (
                <Pressable key={m.id} style={{ width: '48.5%' }} onPress={() => toggle(m.id)}>
                  <Card
                    bgColor={isSelected ? '$primary0' : '$white'}
                    borderRadius={18}
                    borderWidth={1.5}
                    borderColor={isSelected ? '$primary400' : '$borderLight100'}
                    p="$4"
                    style={{ minHeight: 168 }}>
                    <HStack alignItems="center" justifyContent="space-between" mb="$2">
                      <Center w={36} h={36} borderRadius={11} bg={isSelected ? '$primary500' : '$backgroundLight100'}>
                        <Icon as={m.icon} size="sm" color={isSelected ? '$white' : '$textLight500'} />
                      </Center>
                      <Center
                        w={22}
                        h={22}
                        borderRadius={7}
                        bg={isSelected ? '$primary500' : '$white'}
                        borderWidth={isSelected ? 0 : 1.5}
                        borderColor="$borderLight300">
                        {isSelected ? <Icon as={Check} size="2xs" color="$white" /> : null}
                      </Center>
                    </HStack>
                    <Text size="sm" weight="bold" color="$textLight900" style={{ lineHeight: 18 }}>
                      {m.title}
                    </Text>
                    <Text size="2xs" color="$textLight500" mt="$1" style={{ lineHeight: 14, flex: 1 }}>
                      {m.description}
                    </Text>
                    <Text size="2xs" color="$textLight400" mt="$2" style={{ fontVariant: ['tabular-nums'] }}>
                      {m.meta}
                    </Text>
                  </Card>
                </Pressable>
              );
            })}
          </HStack>

          <Pressable onPress={() => navigation.navigate('ResultadosPreliminares')}>
            <HStack alignItems="center" justifyContent="center" space="xs" py="$2">
              <Icon as={CheckCircle2} size="xs" color="$textLight400" />
              <Text size="xs" weight="semiBold" color="$textLight500">
                Ver resultados preliminares de la sesión
              </Text>
            </HStack>
          </Pressable>

          <Box style={{ flex: 1 }} />

          {/* ----- footer ----- */}
          <VStack space="xs" mb="$6">
            <Text size="2xs" color="$textLight400" style={{ textAlign: 'center' }}>
              {selCount} prueba{selCount === 1 ? '' : 's'} seleccionada{selCount === 1 ? '' : 's'}
            </Text>
            <Button action="primary" variant="solid" rounded="$full" isDisabled={selCount === 0} onPress={handleStart}>
              <HStack space="sm" alignItems="center">
                <Text size="md" weight="bold" color="$white">
                  {ctaLabel}
                </Text>
                <Icon as={ArrowRight} size="sm" color="$white" />
              </HStack>
            </Button>
          </VStack>
        </VStack>
      </VStack>
    </Content>
  );
}
