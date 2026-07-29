import React, { useState } from 'react';
import { Pressable, ScrollView } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useDispatch, useSelector } from 'react-redux';
import { Box, Center, HStack, Icon, VStack } from '@gluestack-ui/themed';
import {
  AlertTriangle,
  ArrowRight,
  BrainCircuit,
  Check,
  CheckCircle2,
  ClipboardList,
  Droplets,
  Ear,
  FileClock,
  Headphones,
  Languages,
  LogOut,
  Mic,
  MoonStar,
  Puzzle,
  Speech,
  TrainFront,
  UserPlus,
  Volume2,
} from 'lucide-react-native';

import { Button, Content, Header, Text } from '@/Components/Common';
import RadialBackground from '@/Components/Themed/RadialBackground';
import { RootStackParamList } from '@/Navigators';
import { AppDispatch, RootState } from '@/Store';
import { logout } from '@/Store/slices/authSlice';
import { SESSION_LANGS, SESSION_LANG_LABEL, setSessionLanguage } from '@/Store/slices/localeSlice';
import { signOutQuietly } from '@/Services/firebase';
import { Evaluation } from '@/Models/Evaluation/Evaluation';
import { useClassSelector } from '@/Helpers/ClassTransformer';
import { useTelemetryTracker } from '@/Telemetry';
import { useVoiceEngineStatus } from '@/Voice';
import { VERBAL_BANK_PROVISIONAL } from '@/Screens/VerbalAudiometry/verbalAudiometryBanks';
import ModuleCardItem, { ModuleCardData } from './ModuleCardItem';

/* -------------------------------------------------------------------------- */
/*  SeleccionEjerciciosScreen — hub central de la batería. Tarjetas animadas   */
/*  con identidad visual por módulo (icono clínico + escena SVG temática, ver  */
/*  ModuleCardItem) y accesos rápidos a los prerrequisitos (CAP / sonómetro    */
/*  de sala), alta de paciente y cierre de sesión.                             */
/* -------------------------------------------------------------------------- */

type Props = NativeStackScreenProps<RootStackParamList, 'SeleccionEjercicios'>;

type ModuleCard = ModuleCardData & { id: keyof RootStackParamList };

const MODULES: ModuleCard[] = [
  { id: 'VoiceAnalysis', title: 'Análisis Acústico de Voz', description: 'Vocal sostenida /a/ · F0, jitter, shimmer, HNR.', duration: '3–5 min', ages: 'Todas las edades', icon: Mic, tag: 'VOZ', color: '#7C3AED', soft: '#F3E8FF' },
  { id: 'Audiometry', title: 'Audiometría Infantil', description: 'Audiometría tonal por juego (play audiometry).', duration: '6–8 min', ages: '6 m – 5 a', icon: Headphones, tag: 'AUDICIÓN', color: '#0284C7', soft: '#E0F2FE' },
  { id: 'AudiometryConditioned', title: 'Audiometría Condicionada', description: 'El Tren del Sonido · prueba automática con juego.', duration: '8–10 min', ages: '2–6 a', icon: TrainFront, tag: 'AUDICIÓN', color: '#0D9488', soft: '#CCFBF1' },
  { id: 'VerbalAudiometry', title: 'Audiometría Verbal', description: 'Reconocimiento de palabras por tarjetas · campo libre, sin audífonos.', duration: '5–8 min', ages: '2 a – adulto', icon: Ear, tag: 'AUDICIÓN', color: '#2563EB', soft: '#DBEAFE' },
  { id: 'Articulation', title: 'Articulación · T.A.R.', description: 'Test de Articulación a la Repetición (SODA).', duration: '8–12 min', ages: '3–7 a', icon: Speech, tag: 'LENGUAJE', color: '#EA580C', soft: '#FFEDD5' },
  { id: 'DysphagiaTest', title: 'Exploración de Disfagia', description: 'Cribado con pulsioximetría integrada · sin CAP ni sonómetro.', duration: '10–15 min', ages: 'Pulsioximetría', icon: Droplets, tag: 'DEGLUCIÓN', color: '#DC2626', soft: '#FEE2E2' },
  { id: 'ExecutiveFunctions', title: 'Funciones Ejecutivas', description: 'Cinco mini-juegos de tarjetas: atención, inhibición, flexibilidad, memoria y planificación.', duration: '8–12 min', ages: '3–12 a', icon: BrainCircuit, tag: 'COGNICIÓN', color: '#059669', soft: '#D1FAE5' },
  { id: 'Mchat', title: 'Cuestionario Autismo', description: 'Cribado M-CHAT-R/F de trastorno del espectro autista.', duration: '5–10 min', ages: '16–30 m', icon: Puzzle, tag: 'CONDUCTA', color: '#DB2777', soft: '#FCE7F3' },
  { id: 'SahsScreening', title: 'Cribado SAHS Infantil', description: 'PSQ de Chervin + exploración física.', duration: '5–8 min', ages: '2–12 a', icon: MoonStar, tag: 'SUEÑO', color: '#4F46E5', soft: '#E0E7FF' },
];

export default function SeleccionEjerciciosScreen({ navigation }: Props) {
  const dispatch = useDispatch<AppDispatch>();
  const activeEvaluation = useClassSelector(Evaluation, (state: RootState) => state.activeEvaluation.evaluation);
  const patient = activeEvaluation?.patient;
  const patientName = patient ? `${patient.name} ${patient.lastName}`.trim() : null;

  // Idioma/variante de la sesión (persistido): decide el banco de estímulos y
  // la voz de los módulos localizados (hoy la audiometría verbal).
  const sessionLanguage = useSelector((state: RootState) => state.locale.language);

  // Estado del motor de voz del sistema: si no va a sonar nada, hay que
  // decirlo aquí (donde se elige el idioma) y ofrecer reintentar.
  const voiceEngine = useVoiceEngineStatus();

  // Tracker de telemetría SILENCIOSO (useRef, cero useState → cero re-render).
  const tracker = useTelemetryTracker();

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
    // ID de batería Zero-PHI: bitmask compacto (base36) de los módulos elegidos.
    // Identifica la COMPOSICIÓN de la batería sin exponer nada del paciente.
    const mask = MODULES.reduce((m, mod, i) => (selected.includes(mod.id) ? m | (1 << i) : m), 0);
    tracker.startSession(mask.toString(36));
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

            {/* ----- idioma / variante de la sesión ----- */}
            <VStack space="sm" bg="$white" p="$3.5" borderRadius={16} borderWidth={1} borderColor="$borderLight200">
              <HStack alignItems="center" space="xs">
                <Icon as={Languages} size="xs" color="$primary600" />
                <Text size="xs" weight="bold" color="$textLight800">
                  Idioma de la sesión
                </Text>
              </HStack>
              <HStack space="sm">
                {SESSION_LANGS.map(l => {
                  const on = sessionLanguage === l;
                  return (
                    <Pressable key={l} style={{ flex: 1 }} onPress={() => dispatch(setSessionLanguage(l))}>
                      <Center
                        py="$2.5"
                        px="$2"
                        borderRadius={12}
                        bg={on ? '$primary500' : '$white'}
                        borderWidth={1.5}
                        borderColor={on ? 'transparent' : '$borderLight200'}>
                        <Text
                          size="2xs"
                          weight="bold"
                          color={on ? '$white' : '$textLight600'}
                          style={{ textAlign: 'center' }}>
                          {SESSION_LANG_LABEL[l] ?? l}
                        </Text>
                      </Center>
                    </Pressable>
                  );
                })}
              </HStack>
              <Text size="2xs" color="$textLight400">
                Determina las consignas habladas y el banco de estímulos. Gallego y euskera se
                dictan con la voz del sistema hasta que existan sus locuciones propias.
              </Text>

              {/* Banco sin firma clínica: hay que decirlo donde se elige. */}
              {VERBAL_BANK_PROVISIONAL.includes(sessionLanguage as never) ? (
                <HStack space="xs" alignItems="flex-start" p="$2.5" borderRadius={12} bg="$warning50">
                  <Icon as={AlertTriangle} size="2xs" color="$warning700" style={{ marginTop: 2 }} />
                  <Text size="2xs" color="$warning800" style={{ flex: 1, lineHeight: 15 }}>
                    Banco de estímulos provisional: pendiente de validación clínica. Úselo solo con fines
                    de desarrollo o pilotaje.
                  </Text>
                </HStack>
              ) : null}

              {/* Motor de voz caído: decir POR QUÉ y ofrecer reintentar, en vez
                  de dejar que el profesional descubra que nada suena. */}
              {voiceEngine.shouldWarn ? (
                <VStack space="xs" p="$2.5" borderRadius={12} bg="$error50">
                  <HStack space="xs" alignItems="flex-start">
                    <Icon as={AlertTriangle} size="2xs" color="$error600" style={{ marginTop: 2 }} />
                    <Text size="2xs" color="$error700" style={{ flex: 1, lineHeight: 15 }}>
                      {voiceEngine.status?.detail}
                    </Text>
                  </HStack>
                  <Pressable onPress={voiceEngine.retry} disabled={voiceEngine.retrying}>
                    <Center py="$1.5" borderRadius={10} borderWidth={1} borderColor="$error200" bg="$white">
                      <Text size="2xs" weight="bold" color="$error600">
                        {voiceEngine.retrying ? 'Reintentando…' : 'Reintentar la voz del sistema'}
                      </Text>
                    </Center>
                  </Pressable>
                </VStack>
              ) : null}
            </VStack>

            {/* ----- module grid ----- */}
            <HStack flexWrap="wrap" style={{ gap: 10 }}>
              {MODULES.map((m, i) => {
                const idx = selected.indexOf(m.id);
                return <ModuleCardItem key={m.id} module={m} index={i} order={idx >= 0 ? idx + 1 : null} onToggle={toggle} />;
              })}
            </HStack>

            {/* ----- resultados de la sesión ----- */}
            {/* Era un enlace de texto gris de bajo contraste al final de la
                lista: pasaba desapercibido y por eso «no aparecía un botón
                para ver resultados previos». Ahora es una tarjeta con la
                misma jerarquía visual que el resto de accesos. */}
            <Pressable onPress={() => navigation.navigate('ResultadosPreliminares')}>
              <HStack
                alignItems="center"
                space="sm"
                p="$3.5"
                borderRadius={16}
                borderWidth={1.5}
                borderColor="$primary200"
                bg="$primary0">
                <Center w={36} h={36} borderRadius={12} bg="$primary500">
                  <Icon as={CheckCircle2} size="sm" color="$white" />
                </Center>
                <VStack style={{ flex: 1 }}>
                  <Text size="sm" weight="bold" color="$textLight900">
                    Ver resultados de la sesión
                  </Text>
                  <Text size="2xs" color="$textLight500" style={{ lineHeight: 15 }}>
                    Resumen de las pruebas ya realizadas y acceso al informe detallado
                  </Text>
                </VStack>
                <Icon as={ArrowRight} size="sm" color="$primary600" />
              </HStack>
            </Pressable>

            {/* Historial completo del paciente (sesiones anteriores). */}
            {patient?.id ? (
              <Pressable
                onPress={() =>
                  navigation.navigate('HistorialPaciente', {
                    patientId: patient.id,
                    patientName: patientName ?? 'Paciente',
                    nhc: patient.nhc ?? undefined,
                  })
                }>
                <HStack alignItems="center" justifyContent="center" space="xs" py="$2.5" borderRadius={14} borderWidth={1} borderColor="$borderLight200" bg="$white">
                  <Icon as={FileClock} size="xs" color="$textLight600" />
                  <Text size="xs" weight="bold" color="$textLight600">
                    Historial de sesiones anteriores
                  </Text>
                </HStack>
              </Pressable>
            ) : null}

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
                <Pressable style={{ flex: 1 }} onPress={() => {
                  signOutQuietly();
                  dispatch(logout());
                }}>
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
