import React, { useState } from 'react';
import { Pressable, ScrollView } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useDispatch } from 'react-redux';
import { Box, Card, Center, HStack, Icon, VStack } from '@gluestack-ui/themed';
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ClipboardList,
  LogOut,
  UserPlus,
  Volume2,
} from 'lucide-react-native';

import { Button, Content, Header, Text } from '@/Components/Common';
import RadialBackground from '@/Components/Themed/RadialBackground';
import { RootStackParamList } from '@/Navigators';
import { AppDispatch, RootState } from '@/Store';
import { logout } from '@/Store/slices/authSlice';
import { Evaluation } from '@/Models/Evaluation/Evaluation';
import { useClassSelector } from '@/Helpers/ClassTransformer';

/* -------------------------------------------------------------------------- */
/*  SeleccionEjerciciosScreen — hub central de la batería. Tarjetas con        */
/*  identidad visual por módulo (color + ilustración) y accesos rápidos a los  */
/*  prerrequisitos (CAP / sonómetro de sala), alta de paciente y cierre de     */
/*  sesión.                                                                    */
/* -------------------------------------------------------------------------- */

type Props = NativeStackScreenProps<RootStackParamList, 'SeleccionEjercicios'>;

interface ModuleCard {
  id: keyof RootStackParamList;
  title: string;
  description: string;
  duration: string;
  ages: string;
  emoji: string;
  deco: string; // emoji decorativo secundario de la ilustración
  tag: string; // etiqueta corta de dominio clínico
  color: string; // acento (borde/chip/checked)
  soft: string; // fondo suave de la ilustración
}

const MODULES: ModuleCard[] = [
  { id: 'VoiceAnalysis', title: 'Análisis Acústico de Voz', description: 'Vocal sostenida /a/ · F0, jitter, shimmer, HNR.', duration: '3–5 min', ages: 'Todas las edades', emoji: '🎤', deco: '🎵', tag: 'VOZ', color: '#7C3AED', soft: '#F3E8FF' },
  { id: 'Audiometry', title: 'Audiometría Infantil', description: 'Audiometría tonal por juego (play audiometry).', duration: '6–8 min', ages: '6 m – 5 a', emoji: '🎧', deco: '🔔', tag: 'AUDICIÓN', color: '#0284C7', soft: '#E0F2FE' },
  { id: 'AudiometryConditioned', title: 'Audiometría Condicionada', description: 'El Tren del Sonido · prueba automática con juego.', duration: '8–10 min', ages: '2–6 a', emoji: '🚂', deco: '🎺', tag: 'AUDICIÓN', color: '#0D9488', soft: '#CCFBF1' },
  { id: 'VerbalAudiometry', title: 'Audiometría Verbal', description: 'Reconocimiento de palabras por tarjetas · campo libre, sin audífonos.', duration: '5–8 min', ages: '2 a – adulto', emoji: '🗣️', deco: '🔊', tag: 'AUDICIÓN', color: '#2563EB', soft: '#DBEAFE' },
  { id: 'Articulation', title: 'Articulación · T.A.R.', description: 'Test de Articulación a la Repetición (SODA).', duration: '8–12 min', ages: '3–7 a', emoji: '🗣️', deco: '💬', tag: 'LENGUAJE', color: '#EA580C', soft: '#FFEDD5' },
  { id: 'DysphagiaTest', title: 'Exploración de Disfagia', description: 'Cribado con pulsioximetría integrada · sin CAP ni sonómetro.', duration: '10–15 min', ages: 'Pulsioximetría', emoji: '💧', deco: '🫧', tag: 'DEGLUCIÓN', color: '#DC2626', soft: '#FEE2E2' },
  { id: 'Mchat', title: 'Cuestionario Autismo', description: 'Cribado M-CHAT-R/F de trastorno del espectro autista.', duration: '5–10 min', ages: '16–30 m', emoji: '🧩', deco: '⭐', tag: 'CONDUCTA', color: '#DB2777', soft: '#FCE7F3' },
  { id: 'SahsScreening', title: 'Cribado SAHS Infantil', description: 'PSQ de Chervin + exploración física.', duration: '5–8 min', ages: '2–12 a', emoji: '😴', deco: '🌙', tag: 'SUEÑO', color: '#4F46E5', soft: '#E0E7FF' },
];

/* ------------------------- tarjeta de módulo ------------------------------ */

interface ModuleCardItemProps {
  module: ModuleCard;
  /** Posición 1-based dentro de la selección (null = no seleccionada). */
  order: number | null;
  onToggle: (id: string) => void;
}

function ModuleCardItem({ module: m, order, onToggle }: ModuleCardItemProps) {
  const isSelected = order !== null;
  return (
    <Pressable style={{ width: '48.5%' }} onPress={() => onToggle(m.id)}>
      <Card
        bgColor="$white"
        borderRadius={20}
        borderWidth={2}
        p="$0"
        style={{
          overflow: 'hidden',
          minHeight: 216,
          borderColor: isSelected ? m.color : '#F0ECE4',
          backgroundColor: '#FFFFFF',
          shadowColor: isSelected ? m.color : '#000000',
          shadowOpacity: isSelected ? 0.25 : 0.05,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 6 },
          elevation: isSelected ? 6 : 2,
        }}>
        {/* ----- ilustración superior ----- */}
        <Box h={84} style={{ backgroundColor: m.soft, overflow: 'hidden' }}>
          {/* círculos decorativos */}
          <Box
            w={90}
            h={90}
            borderRadius="$full"
            position="absolute"
            style={{ top: -34, right: -22, backgroundColor: '#FFFFFF', opacity: 0.35 }}
          />
          <Box
            w={54}
            h={54}
            borderRadius="$full"
            position="absolute"
            style={{ bottom: -20, left: -14, backgroundColor: m.color, opacity: 0.12 }}
          />
          <Text style={{ position: 'absolute', top: 8, right: 10, fontSize: 17, opacity: 0.55 }}>{m.deco}</Text>

          {/* emoji principal sobre medallón blanco */}
          <Center
            w={52}
            h={52}
            borderRadius={18}
            bg="$white"
            position="absolute"
            style={{
              left: 14,
              top: 18,
              shadowColor: '#000',
              shadowOpacity: 0.08,
              shadowRadius: 6,
              shadowOffset: { width: 0, height: 3 },
              elevation: 2,
            }}>
            <Text style={{ fontSize: 28 }}>{m.emoji}</Text>
          </Center>

          {/* etiqueta de dominio */}
          <Box
            position="absolute"
            px="$2"
            py="$0.5"
            borderRadius="$full"
            style={{ left: 76, top: 32, backgroundColor: '#FFFFFF' }}>
            <Text size="2xs" weight="bold" style={{ color: m.color, letterSpacing: 0.6, fontSize: 9 }}>
              {m.tag}
            </Text>
          </Box>

          {/* check de selección (con orden dentro de la batería) */}
          <Center
            w={26}
            h={26}
            borderRadius="$full"
            borderWidth={isSelected ? 0 : 1.5}
            borderColor="$borderLight300"
            position="absolute"
            style={{ right: 10, bottom: 8, backgroundColor: isSelected ? m.color : '#FFFFFF' }}>
            {isSelected ? (
              <Text size="2xs" weight="bold" color="$white" style={{ fontVariant: ['tabular-nums'] }}>
                {order}
              </Text>
            ) : null}
          </Center>
        </Box>

        {/* ----- cuerpo ----- */}
        <VStack p="$3.5" style={{ flex: 1 }}>
          <Text size="sm" weight="bold" color="$textLight900" style={{ lineHeight: 18 }}>
            {m.title}
          </Text>
          <Text size="2xs" color="$textLight500" mt="$1" style={{ lineHeight: 15, flex: 1 }}>
            {m.description}
          </Text>
          <HStack space="xs" mt="$2.5" flexWrap="wrap" style={{ gap: 5 }}>
            <HStack space="xs" alignItems="center" px="$2" py="$0.5" borderRadius="$full" style={{ backgroundColor: m.soft }}>
              <Text size="2xs" weight="bold" style={{ color: m.color, fontVariant: ['tabular-nums'], fontSize: 9 }}>
                ⏱ {m.duration}
              </Text>
            </HStack>
            <HStack space="xs" alignItems="center" px="$2" py="$0.5" borderRadius="$full" borderWidth={1} borderColor="$borderLight200" bg="$white">
              <Text size="2xs" weight="semiBold" color="$textLight500" style={{ fontSize: 9 }}>
                👶 {m.ages}
              </Text>
            </HStack>
          </HStack>
        </VStack>

        {/* barra de acento inferior */}
        <Box h={4} style={{ backgroundColor: isSelected ? m.color : m.soft }} />
      </Card>
    </Pressable>
  );
}

export default function SeleccionEjerciciosScreen({ navigation }: Props) {
  const dispatch = useDispatch<AppDispatch>();
  const activeEvaluation = useClassSelector(Evaluation, (state: RootState) => state.activeEvaluation.evaluation);
  const patient = activeEvaluation?.patient;
  const patientName = patient ? `${patient.name} ${patient.lastName}`.trim() : null;

  // Array (no Set): conserva el ORDEN de selección, que define el orden de la
  // batería y se muestra en el check de cada tarjeta.
  const [selected, setSelected] = useState<string[]>([]);

  const toggle = (id: string) => {
    setSelected(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  };

  const selCount = selected.length;
  const ctaLabel = selCount > 1 ? 'Iniciar batería' : 'Iniciar prueba';

  const handleStart = () => {
    if (selCount === 0) return;
    navigation.navigate(selected[0] as any);
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

        {/* Con 7 tarjetas + footer el contenido supera la altura de pantalla:
            sin ScrollView el CTA de inicio queda inaccesible. */}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingTop: 8 }}
          showsVerticalScrollIndicator={false}>
          <VStack flex={1} space="md">
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

            {/* ----- accesos rápidos a los prerrequisitos ----- */}
            <HStack space="sm">
              <Pressable style={{ flex: 1 }} onPress={() => navigation.navigate('ClinicalAssessment')}>
                <HStack space="xs" alignItems="center" justifyContent="center" py="$2.5" borderRadius={14} borderWidth={1.5} borderColor="$borderLight200" bg="$white">
                  <Icon as={ClipboardList} size="xs" color="$primary600" />
                  <Text size="xs" weight="bold" color="$primary600">
                    Volver al CAP
                  </Text>
                </HStack>
              </Pressable>
              <Pressable style={{ flex: 1 }} onPress={() => navigation.navigate('RoomNoiseCheck')}>
                <HStack space="xs" alignItems="center" justifyContent="center" py="$2.5" borderRadius={14} borderWidth={1.5} borderColor="$borderLight200" bg="$white">
                  <Icon as={Volume2} size="xs" color="$primary600" />
                  <Text size="xs" weight="bold" color="$primary600">
                    Sonómetro de sala
                  </Text>
                </HStack>
              </Pressable>
            </HStack>

            {/* ----- module grid ----- */}
            <HStack flexWrap="wrap" style={{ gap: 10 }}>
              {MODULES.map(m => {
                const idx = selected.indexOf(m.id);
                return <ModuleCardItem key={m.id} module={m} order={idx >= 0 ? idx + 1 : null} onToggle={toggle} />;
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

              {/* gestión de la sesión */}
              <HStack space="sm" mt="$2">
                <Pressable style={{ flex: 1 }} onPress={() => navigation.navigate('Pacientes')}>
                  <HStack space="xs" alignItems="center" justifyContent="center" py="$2.5" borderRadius={14} borderWidth={1.5} borderColor="$borderLight200" bg="$white">
                    <Icon as={UserPlus} size="xs" color="$textLight600" />
                    <Text size="xs" weight="bold" color="$textLight600">
                      Otro paciente
                    </Text>
                  </HStack>
                </Pressable>
                <Pressable style={{ flex: 1 }} onPress={() => dispatch(logout())}>
                  <HStack space="xs" alignItems="center" justifyContent="center" py="$2.5" borderRadius={14} borderWidth={1.5} borderColor="$error200" bg="$error50">
                    <Icon as={LogOut} size="xs" color="$error500" />
                    <Text size="xs" weight="bold" color="$error500">
                      Cerrar sesión
                    </Text>
                  </HStack>
                </Pressable>
              </HStack>
            </VStack>
          </VStack>
        </ScrollView>
      </VStack>
    </Content>
  );
}
