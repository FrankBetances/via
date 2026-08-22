import React, { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useDispatch } from 'react-redux';
import { Box, Center, HStack, VStack } from '@gluestack-ui/themed';
import {
  AlertTriangle,
  ArrowRight,
  BrainCircuit,
  AudioWaveform,
  CheckCircle2,
  ChevronRight,
  Droplets,
  Ear,
  FileClock,
  LogOut,
  Mic,
  MoonStar,
  Puzzle,
  RotateCcw,
  Speech,
  TrainFront,
} from 'lucide-react-native';

import { Content, Text } from '@/Components/Common';
import ViaIcon from '@/Components/Common/ViaIcon';
import RadialBackground from '@/Components/Themed/RadialBackground';
import { RootStackParamList } from '@/Navigators';
import { AppDispatch, RootState } from '@/Store';
import { setActiveEvaluation } from '@/Store/slices/activeEvaluationSlice';
import { logout } from '@/Store/slices/authSlice';
import { signOutQuietly } from '@/Services/firebase';
import { Evaluation } from '@/Models/Evaluation/Evaluation';
import { EvaluationRepository } from '@/Repositories/EvaluationRepository';
import { PatientRepository } from '@/Repositories/PatientRepository';
import { useClassSelector } from '@/Helpers/ClassTransformer';
import { describePatient } from '@/Helpers/patientHeader';
import { useTelemetryTracker } from '@/Telemetry';
import { useVoiceEngineStatus } from '@/Voice';
import ModuleCardItem, { ModuleCardData } from './ModuleCardItem';
import CategoryFilterChip from './CategoryFilterChip';
import { CategoryType } from './CategoryBadgeIcon';

/* -------------------------------------------------------------------------- */
/*  SeleccionEjerciciosScreen — Hub clínico con diseño en tableta (4:3)        */
/*  Pixel-perfect según la referencia visual aprobada de VIA+                  */
/* -------------------------------------------------------------------------- */

type Props = NativeStackScreenProps<RootStackParamList, 'SeleccionEjercicios'>;

type ModuleCard = ModuleCardData & { id: keyof RootStackParamList };

const MODULES: ModuleCard[] = [
  {
    id: 'Audiometry',
    title: 'Audiometría Infantil',
    description: 'Audiometría tonal liminar por juego (play audiometry).',
    duration: '8–10 min',
    durationMinutes: 9,
    ages: '2–6 años',
    icon: Ear,
    category: 'hearing',
    tag: 'AUDICIÓN',
    color: '#0284C7',
    soft: '#E0F2FE',
    isCalibrated: true,
  },
  {
    id: 'AudiometryConditioned',
    title: 'Audiometría Condicionada',
    subtitle: '(El Tren del Sonido)',
    description: 'Audiometría por condicionamiento con refuerzo visual animado.',
    duration: '8–10 min',
    durationMinutes: 9,
    ages: '2–6 años',
    icon: TrainFront,
    category: 'hearing',
    tag: 'AUDICIÓN',
    color: '#0D9488',
    soft: '#CCFBF1',
    isCalibrated: true,
  },
  {
    id: 'VerbalAudiometry',
    title: 'Audiometría Verbal',
    description: 'Reconocimiento de palabras por tarjetas en campo libre.',
    duration: '8–10 min',
    durationMinutes: 8,
    ages: '2 años – adulto',
    icon: Speech,
    category: 'hearing',
    tag: 'AUDICIÓN',
    color: '#2563EB',
    soft: '#DBEAFE',
    isCalibrated: true,
  },
  {
    id: 'VoiceAnalysis',
    title: 'Análisis Acústico de Voz',
    description: 'Vocal sostenida /a/ · Frecuencia fundamental y formantes.',
    duration: '3–5 min',
    durationMinutes: 4,
    ages: 'Todas las edades',
    icon: Mic,
    category: 'voice',
    tag: 'VOZ',
    color: '#7C3AED',
    soft: '#F3E8FF',
    badgeParam: 'F0, jitter, shimmer',
  },
  {
    id: 'Articulation',
    title: 'Articulación · T.A.R.',
    description: 'Test de Articulación a la Repetición · registro SODA.',
    duration: '8–12 min',
    durationMinutes: 10,
    ages: '3–7 años',
    icon: Speech,
    category: 'neuro',
    tag: 'NEURODESARROLLO',
    color: '#EA580C',
    soft: '#FFEDD5',
    badgeParam: 'SODA Fonética',
  },
  {
    id: 'ExecutiveFunctions',
    title: 'Funciones Ejecutivas',
    description: 'Cinco mini-juegos: atención, inhibición, flexibilidad, memoria y planificación.',
    duration: '8–10 min',
    durationMinutes: 9,
    ages: '3–12 años',
    icon: BrainCircuit,
    category: 'neuro',
    tag: 'NEURODESARROLLO',
    color: '#059669',
    soft: '#D1FAE5',
    isCalibrated: true,
  },
  {
    id: 'ProsodyAnalysis',
    title: 'Análisis Prosódico',
    description: 'Habla conectada · ritmo, entonación, pausas y modulación.',
    duration: '4–6 min',
    durationMinutes: 5,
    ages: '3–12 años',
    icon: AudioWaveform,
    category: 'voice',
    tag: 'VOZ',
    color: '#C026D3',
    soft: '#FAE8FF',
    badgeParam: 'Prosodia DSP',
  },
  {
    id: 'Mchat',
    title: 'Cuestionario Autismo',
    subtitle: '(M-CHAT-R/F)',
    description: 'Cribado conductual de señales tempranas de TEA.',
    duration: '5–10 min',
    durationMinutes: 7,
    ages: '16–30 meses',
    icon: Puzzle,
    category: 'neuro',
    tag: 'NEURODESARROLLO',
    color: '#DB2777',
    soft: '#FCE7F3',
    badgeParam: '20 Ítems M-CHAT',
  },
  {
    id: 'SahsScreening',
    title: 'Cribado SAHS Infantil',
    description: 'Cuestionario PSQ de Chervin y exploración física (Brodsky, IMC).',
    duration: '5–8 min',
    durationMinutes: 6,
    ages: '2–12 años',
    icon: MoonStar,
    category: 'sleep',
    tag: 'SUEÑO',
    color: '#4F46E5',
    soft: '#E0E7FF',
    badgeParam: 'Brodsky + PSQ',
  },
  {
    id: 'DysphagiaTest',
    title: 'Exploración de Disfagia',
    description: 'MECV-V volumen-viscosidad con pulsioximetría integrada · sin CAP ni sonómetro.',
    duration: '10–15 min',
    durationMinutes: 12,
    ages: 'Todas las edades',
    icon: Droplets,
    category: 'dysphagia',
    tag: 'DEGLUCIÓN',
    color: '#DC2626',
    soft: '#FEE2E2',
    badgeParam: 'SpO₂ · desaturación',
  },
];

interface FilterCategoryDef {
  id: CategoryType;
  label: string;
  count: number;
  color: string;
  soft: string;
}

/** Los contadores se derivan de MODULES: añadir una prueba no deja el filtro mintiendo. */
const countOf = (id: CategoryType) =>
  id === 'all' ? MODULES.length : MODULES.filter(m => m.category === id).length;

const CATEGORIES: FilterCategoryDef[] = [
  { id: 'all', label: 'Todas', count: countOf('all'), color: '#0D9488', soft: '#CCFBF1' },
  { id: 'hearing', label: 'Pruebas auditivas', count: countOf('hearing'), color: '#0284C7', soft: '#E0F2FE' },
  { id: 'voice', label: 'Voz', count: countOf('voice'), color: '#7C3AED', soft: '#F3E8FF' },
  { id: 'neuro', label: 'Neurodesarrollo', count: countOf('neuro'), color: '#059669', soft: '#D1FAE5' },
  { id: 'sleep', label: 'Sueño', count: countOf('sleep'), color: '#4F46E5', soft: '#E0E7FF' },
  { id: 'dysphagia', label: 'Disfagia', count: countOf('dysphagia'), color: '#DC2626', soft: '#FEE2E2' },
];

export default function SeleccionEjerciciosScreen({ navigation, route }: Props) {
  const dispatch = useDispatch<AppDispatch>();
  const { width } = useWindowDimensions();

  const activeEvaluation = useClassSelector(Evaluation, (state: RootState) => state.activeEvaluation.evaluation);
  const patient = activeEvaluation?.patient;
  const { patientLabel, initials } = describePatient(patient);
  const patientName = patient ? `${patient.name} ${patient.lastName}`.trim() : '';

  useEffect(() => {
    if (!patient) {
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
          // ignore error in background recovery
        }
      })();
      return () => {
        mounted = false;
      };
    }
  }, [dispatch, patient]);

  const noiseCheckSkipped = route.params?.noiseCheckSkipped === true;
  const voiceEngine = useVoiceEngineStatus();
  const tracker = useTelemetryTracker();

  // Categoría activa de filtrado
  const [activeCategory, setActiveCategory] = useState<CategoryType>('all');

  // Array ordenado de pruebas seleccionadas. Arranca VACÍO: la batería la
  // compone el clínico. Las tres pruebas precargadas venían del render de
  // referencia («3 pruebas en cola»), no de una decisión clínica.
  const [selected, setSelected] = useState<string[]>([]);

  const toggle = (id: string) => {
    setSelected(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  };

  const filteredModules = useMemo(() => {
    if (activeCategory === 'all') return MODULES;
    return MODULES.filter(m => m.category === activeCategory);
  }, [activeCategory]);

  const selCount = selected.length;

  // Cálculo dinámico de minutos totales estimados
  const totalEstimatedMinutes = useMemo(() => {
    return selected.reduce((sum, id) => {
      const mod = MODULES.find(m => m.id === id);
      return sum + (mod?.durationMinutes ?? 0);
    }, 0);
  }, [selected]);

  const ctaLabel = selCount > 1 ? `Iniciar batería (${selCount} pruebas)` : selCount === 1 ? 'Iniciar prueba' : 'Selecciona pruebas';

  const handleStart = () => {
    if (selCount === 0) return;
    const mask = MODULES.reduce((m, mod, i) => (selected.includes(mod.id) ? m | (1 << i) : m), 0);
    tracker.startSession(mask.toString(36));
    navigation.navigate(selected[0] as any);
  };

  // Rejilla de columnas responsiva según el ancho de pantalla (Tableta 4:3 = 4 columnas)
  const numColumns = width >= 980 ? 4 : width >= 680 ? 2 : 1;
  const gap = 14;
  const horizontalPadding = 24;
  const availableWidth = width - horizontalPadding * 2;
  const cardWidth = numColumns > 1 ? (availableWidth - gap * (numColumns - 1)) / numColumns : '100%';

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
      <VStack flex={1} style={{ backgroundColor: '#F6F3EE' }}>
        
        {/* ==================================================================== */}
        {/* Cabecera Superior VIA+ (Zero-PHI & Estado de Sala)                    */}
        {/* ==================================================================== */}
        <HStack
          alignItems="center"
          justifyContent="space-between"
          px="$6"
          pt="$4"
          pb="$3"
          style={styles.topNavbar}>
          {/* Logo VIA+ y Datos del Paciente */}
          <HStack alignItems="center" space="md">
            {/* Logo VIA+ */}
            <HStack alignItems="center" space="xs">
              <ViaIcon size={28} variant="color" />
              <Text size="lg" weight="bold" style={{ color: '#2B2620', letterSpacing: -0.5 }}>
                VIA<Text size="lg" weight="bold" style={{ color: '#FF7F00' }}>+</Text>
              </Text>
            </HStack>

            {/* Divisor vertical */}
            <Box w={1} h={20} bg="#E2DDD5" />

            {/* Píldora de Paciente */}
            <HStack alignItems="center" space="xs">
              <Center px="$1.5" py="$0.5" borderRadius={6} bg="#EBE5DB">
                <Text size="2xs" weight="bold" style={{ color: '#475569', fontSize: 11 }}>
                  [{initials}]
                </Text>
              </Center>
              <Text size="sm" weight="semiBold" style={{ color: '#2B2620' }}>
                {patientLabel}
              </Text>
            </HStack>
          </HStack>

          {/* Estado de Sala y Accesos Directos */}
          <HStack alignItems="center" space="md">
            {/* Certificado de Sala Activo */}
            {noiseCheckSkipped ? (
              <HStack alignItems="center" space="xs" px="$3" py="$1.5" borderRadius={20} bg="#FEF3C7" borderWidth={1} borderColor="#FDE68A">
                <AlertTriangle size={14} color="#D97706" />
                <Text size="xs" weight="bold" style={{ color: '#92400E' }}>
                  Sala sin verificar · sonómetro omitido
                </Text>
              </HStack>
            ) : (
              <HStack alignItems="center" space="xs" px="$3" py="$1.5" borderRadius={20} bg="#ECFDF5" borderWidth={1} borderColor="#A7F3D0">
                <CheckCircle2 size={14} color="#059669" fill="#D1FAE5" />
                <Text size="xs" weight="bold" style={{ color: '#065F46' }}>
                  Sala verificada · sonómetro OK
                </Text>
              </HStack>
            )}

            {/* Acceso directo a CAP */}
            <Pressable onPress={() => navigation.navigate('ClinicalAssessment')}>
              <Text size="xs" weight="medium" style={{ color: '#64748B', textDecorationLine: 'underline' }}>
                Volver al CAP
              </Text>
            </Pressable>

            {/* Acceso a Sonómetro */}
            <Pressable onPress={() => navigation.navigate('RoomNoiseCheck')}>
              <Text size="xs" weight="medium" style={{ color: '#64748B', textDecorationLine: 'underline' }}>
                Sonómetro de sala
              </Text>
            </Pressable>

            {/* Comprobación de audio del dispositivo. Va aquí, siempre visible y
                no solo cuando algo ya ha fallado: cuando las pruebas de voz no
                suenan ni graban, la app degrada en silencio y el profesional no
                tiene desde dónde averiguar qué eslabón está roto. */}
            <Pressable onPress={() => navigation.navigate('DiagnosticoAudio')}>
              <Text size="xs" weight="medium" style={{ color: '#64748B', textDecorationLine: 'underline' }}>
                Comprobar audio
              </Text>
            </Pressable>
          </HStack>
        </HStack>

        {/* ==================================================================== */}
        {/* Aviso del motor de voz (si la locución no está disponible)           */}
        {/* ==================================================================== */}
        {voiceEngine.shouldWarn ? (
          <Box px="$6" pt="$2">
            <VStack space="xs" bg="#FEF2F2" p="$3" borderRadius={14} borderWidth={1} borderColor="#FECACA">
              <HStack space="xs" alignItems="flex-start">
                <AlertTriangle size={14} color="#DC2626" />
                <Text size="2xs" style={{ flex: 1, color: '#B91C1C', lineHeight: 15 }}>
                  {voiceEngine.status?.detail}
                </Text>
              </HStack>
              <HStack space="xs">
                <Pressable style={{ flex: 1 }} onPress={voiceEngine.retry} disabled={voiceEngine.retrying}>
                  <Center py="$1.5" borderRadius={10} borderWidth={1} borderColor="#FECACA" bg="#FFFFFF">
                    <Text size="2xs" weight="bold" style={{ color: '#DC2626' }}>
                      {voiceEngine.retrying ? 'Reintentando…' : 'Reintentar la voz del sistema'}
                    </Text>
                  </Center>
                </Pressable>
                {/* El reintento solo cubre el sintetizador del sistema. Si lo que
                    falla es el motor nativo, el banco de locuciones o el propio
                    micrófono, este aviso se quedaría corto. */}
                <Pressable style={{ flex: 1 }} onPress={() => navigation.navigate('DiagnosticoAudio')}>
                  <Center py="$1.5" borderRadius={10} borderWidth={1} borderColor="#FECACA" bg="#FFFFFF">
                    <Text size="2xs" weight="bold" style={{ color: '#DC2626' }}>
                      Comprobar toda la cadena
                    </Text>
                  </Center>
                </Pressable>
              </HStack>
            </VStack>
          </Box>
        ) : null}

        {/* ==================================================================== */}
        {/* Barra de Filtros de Categorías (Carrusel Horizontal)                 */}
        {/* ==================================================================== */}
        <Box px="$6" py="$2">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}>
            {CATEGORIES.map(cat => (
              <CategoryFilterChip
                key={cat.id}
                category={cat.id}
                label={cat.label}
                count={cat.count}
                isActive={activeCategory === cat.id}
                onPress={() => setActiveCategory(cat.id)}
              />
            ))}
            <Center w={28} h={28} borderRadius={14} bg="rgba(0,0,0,0.04)" style={{ alignSelf: 'center', marginLeft: 4 }}>
              <ChevronRight size={16} color="#64748B" />
            </Center>
          </ScrollView>
        </Box>

        {/* ==================================================================== */}
        {/* Contenido Principal: Rejilla Responsiva de Módulos Clínicos          */}
        {/* ==================================================================== */}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingHorizontal: horizontalPadding,
            paddingTop: 10,
            paddingBottom: 110,
          }}
          showsVerticalScrollIndicator={false}>
          
          {/* Rejilla de Tarjetas (Grid Multi-Columna) */}
          <View style={[styles.gridContainer, { gap }]}>
            {filteredModules.map((m, i) => {
              const idx = selected.indexOf(m.id);
              return (
                <ModuleCardItem
                  key={m.id}
                  module={m}
                  index={i}
                  order={idx >= 0 ? idx + 1 : null}
                  onToggle={toggle}
                  cardWidth={cardWidth}
                />
              );
            })}
          </View>

          {/* Accesos Rápidos Inferiores de Gestión de Sesión */}
          <HStack space="md" mt="$4" justifyContent="center">
            <Pressable onPress={() => navigation.navigate('ResultadosPreliminares')}>
              <HStack alignItems="center" space="xs" px="$4" py="$2" borderRadius={12} bg="#FFFFFF" borderWidth={1} borderColor="#E2DDD5">
                <CheckCircle2 size={15} color="#0D9488" />
                <Text size="xs" weight="bold" color="#0D9488">
                  Ver resultados preliminares
                </Text>
              </HStack>
            </Pressable>

            {patient?.id ? (
              <Pressable
                onPress={() =>
                  navigation.navigate('HistorialPaciente', {
                    patientId: patient.id,
                    patientName: patientName,
                    nhc: patient.nhc ?? undefined,
                  })
                }>
                <HStack alignItems="center" space="xs" px="$4" py="$2" borderRadius={12} bg="#FFFFFF" borderWidth={1} borderColor="#E2DDD5">
                  <FileClock size={15} color="#475569" />
                  <Text size="xs" weight="bold" color="#475569">
                    Historial del paciente
                  </Text>
                </HStack>
              </Pressable>
            ) : null}

            <Pressable
              onPress={() => {
                signOutQuietly();
                dispatch(logout());
              }}>
              <HStack alignItems="center" space="xs" px="$4" py="$2" borderRadius={12} bg="#FEF2F2" borderWidth={1} borderColor="#FECACA">
                <LogOut size={15} color="#DC2626" />
                <Text size="xs" weight="bold" color="#DC2626">
                  Cerrar sesión
                </Text>
              </HStack>
            </Pressable>
          </HStack>
        </ScrollView>

        {/* ==================================================================== */}
        {/* Dock Inferior Flotante (Sticky Action Dock)                          */}
        {/* ==================================================================== */}
        <View style={styles.floatingDock}>
          <HStack alignItems="center" justifyContent="space-between">
            {/* Texto de estado acumulado */}
            <HStack alignItems="center" space="xs">
              <Text size="sm" weight="bold" style={{ color: '#1E293B', fontSize: 14 }}>
                {selCount === 0
                  ? 'Ninguna prueba en cola'
                  : `${selCount} prueba${selCount > 1 ? 's' : ''} en cola`}
              </Text>
              {totalEstimatedMinutes > 0 && (
                <>
                  <Text size="sm" style={{ color: '#94A3B8' }}>·</Text>
                  <Text size="sm" weight="medium" style={{ color: '#475569', fontSize: 14 }}>
                    ⏱️ Tiempo total: ~{totalEstimatedMinutes} min
                  </Text>
                </>
              )}
            </HStack>

            {/* Acciones del Dock */}
            <HStack alignItems="center" space="sm">
              {selCount > 0 && (
                <Pressable
                  onPress={() => setSelected([])}
                  style={styles.clearBtn}>
                  <HStack alignItems="center" space="xs">
                    <RotateCcw size={13} color="#64748B" />
                    <Text size="xs" weight="medium" color="#64748B">
                      Limpiar
                    </Text>
                  </HStack>
                </Pressable>
              )}

              {/* Botón de Inicio Naranja Radiante */}
              <Pressable
                disabled={selCount === 0}
                onPress={handleStart}
                style={[
                  styles.ctaButton,
                  { backgroundColor: selCount > 0 ? '#FF7F00' : '#CBD5E1' },
                ]}>
                <HStack alignItems="center" space="xs">
                  <Text size="sm" weight="bold" style={{ color: '#FFFFFF', fontSize: 14 }}>
                    {ctaLabel}
                  </Text>
                  <ArrowRight size={16} color="#FFFFFF" strokeWidth={2.5} />
                </HStack>
              </Pressable>
            </HStack>
          </HStack>
        </View>
      </VStack>
    </Content>
  );
}

const styles = StyleSheet.create({
  topNavbar: {
    backgroundColor: '#F6F3EE',
    borderBottomWidth: 1,
    borderBottomColor: '#EDE7DC',
  },
  filterRow: {
    paddingVertical: 6,
    paddingRight: 12,
    alignItems: 'center',
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    alignItems: 'stretch',
  },
  floatingDock: {
    position: 'absolute',
    bottom: 16,
    left: 24,
    right: 24,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#EDE7DC',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  clearBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
  },
  ctaButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    shadowColor: '#FF7F00',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
});
