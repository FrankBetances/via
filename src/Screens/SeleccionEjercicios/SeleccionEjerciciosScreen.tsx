import React, { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useDispatch, useSelector } from 'react-redux';
import { Box, Center, HStack, VStack } from '@gluestack-ui/themed';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  FileClock,
  LogOut,
  RotateCcw,
} from 'lucide-react-native';

import { Content, Text } from '@/Components/Common';
import ViaIcon from '@/Components/Common/ViaIcon';
import RadialBackground from '@/Components/Themed/RadialBackground';
import { RootStackParamList } from '@/Navigators';
import { AppDispatch, RootState } from '@/Store';
import { isRoomVerified, roomNoiseLabel } from '@/Store/slices/roomNoiseSlice';
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
import ModuleCardItem from './ModuleCardItem';
import CategoryFilterChip from './CategoryFilterChip';
import { MODULES } from './moduleCards';
import { computeGridLayout } from './seleccionLayout';
import { CategoryType } from './CategoryBadgeIcon';

import { useT } from '@/I18n';
import { atoms } from '@/Theme/styleAtoms';
/* -------------------------------------------------------------------------- */
/*  SeleccionEjerciciosScreen — Hub clínico con diseño en tableta (4:3)        */
/*  Pixel-perfect según la referencia visual aprobada de VIA+                  */
/* -------------------------------------------------------------------------- */

type Props = NativeStackScreenProps<RootStackParamList, 'SeleccionEjercicios'>;


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

/**
 * Acceso de la barra superior. En tableta sigue siendo el enlace subrayado de
 * la referencia visual; en teléfono pasa a botón con área de toque propia,
 * porque ahí estos accesos son la única vía a la comprobación de audio y al
 * sonómetro, y un texto de 11 px no se acierta con el pulgar.
 */
function NavAction({
  isPhone,
  label,
  onPress,
}: {
  isPhone: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        isPhone ? styles.navChip : styles.navLink,
        pressed && atoms.opacity08,
      ]}>
      <Text
        size="xs"
        weight={isPhone ? 'bold' : 'medium'}
        style={isPhone ? atoms.color475569FontSize11 : atoms.color64748BTextDecorationLineUnderline}>
        {label}
      </Text>
    </Pressable>
  );
}

export default function SeleccionEjerciciosScreen({ navigation }: Props) {
  const t = useT();
  const dispatch = useDispatch<AppDispatch>();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();

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

  /* Estado REAL de la sala (ver `roomNoiseState.ts`). Ya no se lee ningún
   * parámetro de navegación: el antiguo `noiseCheckSkipped` solo lo ponía el
   * botón de saltar, y su ausencia se interpretaba como aprobado. Lo que manda
   * es el veredicto que publica el sonómetro al terminar de medir. */
  const roomNoise = useSelector((state: RootState) => state.roomNoise);
  const roomVerified = isRoomVerified(roomNoise);
  const roomChip = roomVerified
    ? { bg: '#ECFDF5', border: '#A7F3D0', fg: '#065F46', label: roomNoiseLabel(roomNoise) }
    : roomNoise.status === 'block'
      ? { bg: '#FEE2E2', border: '#FECACA', fg: '#B91C1C', label: roomNoiseLabel(roomNoise) }
      : { bg: '#FEF3C7', border: '#FDE68A', fg: '#92400E', label: roomNoiseLabel(roomNoise) };
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
    // eslint-disable-next-line no-bitwise -- la selección de módulos viaja como máscara de bits en la telemetría Zero-PHI.
    const mask = MODULES.reduce((m, mod, i) => (selected.includes(mod.id) ? m | (1 << i) : m), 0);
    tracker.startSession(mask.toString(36));
    navigation.navigate(selected[0] as any);
  };

  /* Reparto de la pantalla. Sale de `computeGridLayout` para poder medirlo sin
   * montar la pantalla: la tableta 4:3 de la referencia y un teléfono a una
   * columna no se diferencian solo en el número de columnas — cambian el
   * relleno lateral, el alto del dibujo de cada tarjeta y el hueco que hay que
   * reservarle al muelle de acciones, que en teléfono va apilado. */
  const { isPhone, gap, horizontalPadding, cardWidth, illustrationHeight, dockClearance } =
    computeGridLayout({ width });

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
      <VStack flex={1} style={atoms.backgroundColorF6F3EE}>
        
        {/* ==================================================================== */}
        {/* Cabecera Superior VIA+ (Zero-PHI & Estado de Sala)                    */}
        {/* ==================================================================== */}
        {/* `Content` monta el área segura sin el borde superior (`insetTop={false}`)
            y cada pantalla se ocupa del suyo. Ésta no lo hacía: en tableta se
            nota poco, pero en un teléfono la barra de estado se comía la fila
            del logotipo y el paciente. Solo se aplica en teléfono para no mover
            la cabecera de la tableta, que es la que Frank ya da por buena. */}
        <View
          style={[
            styles.topNavbar,
            isPhone ? styles.topNavbarPhone : styles.topNavbarWide,
            isPhone ? { paddingTop: Math.max(insets.top, 12) } : null,
          ]}>
          {/* Logo VIA+ y Datos del Paciente */}
          <HStack alignItems="center" space="md" style={isPhone ? styles.navIdentityPhone : undefined}>
            {/* Logo VIA+ */}
            <HStack alignItems="center" space="xs">
              <ViaIcon size={28} variant="color" />
              <Text size="lg" weight="bold" style={atoms.color2B2620LetterSpacingNeg05}>
                VIA<Text size="lg" weight="bold" style={atoms.colorFF7F00}>+</Text>
              </Text>
            </HStack>

            {/* Divisor vertical */}
            <Box w={1} h={20} bg="#E2DDD5" />

            {/* Píldora de Paciente */}
            <HStack alignItems="center" space="xs">
              <Center px="$1.5" py="$0.5" borderRadius={6} bg="#EBE5DB">
                <Text size="2xs" weight="bold" style={atoms.color475569FontSize11}>
                  [{initials}]
                </Text>
              </Center>
              <Text
                size="sm"
                weight="semiBold"
                numberOfLines={1}
                style={[atoms.color2B2620, atoms.flexShrink1]}>
                {patientLabel}
              </Text>
            </HStack>
          </HStack>

          {/* Estado de Sala y Accesos Directos.
              En teléfono esto era una fila única con `space-between` y sin
              envolver: el chip de sala y los tres accesos no caben en 360 dp,
              así que «Comprobar audio» —el último— se salía por la derecha y no
              había forma de llegar a él. Ahora envuelve y cada acceso es un
              botón con su propia área de toque. */}
          <View style={[styles.navActions, isPhone && styles.navActionsPhone]}>
            {/* Certificado de Sala Activo */}
            {/* El estado de la sala se LEE del veredicto real del sonómetro.
                Antes se deducía de la ausencia de una bandera de navegación, y
                `undefined` caía en la rama del tic verde: una sala que nadie
                había medido —o que había salido «DEMASIADO RUIDO»— se
                anunciaba como «verificada». «Verificada» hay que ganárselo. */}
            <HStack
              alignItems="center"
              space="xs"
              px="$3"
              py="$1.5"
              borderRadius={20}
              bg={roomChip.bg}
              borderWidth={1}
              borderColor={roomChip.border}>
              {roomVerified ? (
                <CheckCircle2 size={14} color="#059669" fill="#D1FAE5" />
              ) : (
                <AlertTriangle size={14} color={roomChip.fg} />
              )}
              <Text size="xs" weight="bold" style={{ color: roomChip.fg }}>
                {roomChip.label}
              </Text>
            </HStack>

            {/* Acceso directo a CAP */}
            <NavAction
              isPhone={isPhone}
              label={t.seleccionEjercicios.volverCap}
              onPress={() => navigation.navigate('ClinicalAssessment')}
            />

            {/* Acceso a Sonómetro */}
            <NavAction
              isPhone={isPhone}
              label={t.seleccionEjercicios.sonometroSala}
              onPress={() => navigation.navigate('RoomNoiseCheck')}
            />

            {/* Comprobación de audio del dispositivo. Va aquí, siempre visible y
                no solo cuando algo ya ha fallado: cuando las pruebas de voz no
                suenan ni graban, la app degrada en silencio y el profesional no
                tiene desde dónde averiguar qué eslabón está roto. */}
            <NavAction
              isPhone={isPhone}
              label={t.seleccionEjercicios.comprobarAudio}
              onPress={() => navigation.navigate('DiagnosticoAudio')}
            />
          </View>
        </View>

        {/* ==================================================================== */}
        {/* Aviso del motor de voz (si la locución no está disponible)           */}
        {/* ==================================================================== */}
        {voiceEngine.shouldWarn ? (
          <Box pt="$2" style={{ paddingHorizontal: horizontalPadding }}>
            <VStack space="xs" bg="#FEF2F2" p="$3" borderRadius={14} borderWidth={1} borderColor="#FECACA">
              <HStack space="xs" alignItems="flex-start">
                <AlertTriangle size={14} color="#DC2626" />
                <Text size="2xs" style={atoms.flex1ColorB91C1CLineHeight15}>
                  {voiceEngine.status?.detail}
                </Text>
              </HStack>
              <HStack space="xs">
                <Pressable style={atoms.flex1} onPress={voiceEngine.retry} disabled={voiceEngine.retrying}>
                  <Center py="$1.5" borderRadius={10} borderWidth={1} borderColor="#FECACA" bg="#FFFFFF">
                    <Text size="2xs" weight="bold" style={atoms.colorDC2626}>
                      {voiceEngine.retrying ? t.seleccionEjercicios.reintentando : t.seleccionEjercicios.reintentarVozSistema}
                    </Text>
                  </Center>
                </Pressable>
                {/* El reintento solo cubre el sintetizador del sistema. Si lo que
                    falla es el motor nativo, el banco de locuciones o el propio
                    micrófono, este aviso se quedaría corto. */}
                <Pressable style={atoms.flex1} onPress={() => navigation.navigate('DiagnosticoAudio')}>
                  <Center py="$1.5" borderRadius={10} borderWidth={1} borderColor="#FECACA" bg="#FFFFFF">
                    <Text size="2xs" weight="bold" style={atoms.colorDC2626}>
                      
                      {t.seleccionEjercicios.comprobarTodaCadena}
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
        <Box py="$2" style={{ paddingHorizontal: horizontalPadding }}>
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
            <Center w={28} h={28} borderRadius={14} bg="rgba(0,0,0,0.04)" style={atoms.alignSelfCenterMarginLeft4}>
              <ChevronRight size={16} color="#64748B" />
            </Center>
          </ScrollView>
        </Box>

        {/* ==================================================================== */}
        {/* Contenido Principal: Rejilla Responsiva de Módulos Clínicos          */}
        {/* ==================================================================== */}
        <ScrollView
          style={atoms.flex1}
          contentContainerStyle={[
            styles.gridScroll,
            { paddingHorizontal: horizontalPadding, paddingBottom: dockClearance },
          ]}
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
                  illustrationHeight={illustrationHeight}
                />
              );
            })}
          </View>

          {/* Accesos Rápidos Inferiores de Gestión de Sesión */}
          <HStack space="md" mt="$4" justifyContent="center" style={atoms.flexWrapWrap}>
            <Pressable onPress={() => navigation.navigate('ResultadosPreliminares')}>
              <HStack alignItems="center" space="xs" px="$4" py="$2" borderRadius={12} bg="#FFFFFF" borderWidth={1} borderColor="#E2DDD5">
                <CheckCircle2 size={15} color="#0D9488" />
                <Text size="xs" weight="bold" color="#0D9488">
                  
                  {t.seleccionEjercicios.verResultadosPreliminares}
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
                    
                    {t.seleccionEjercicios.historialPaciente}
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
                  
                  {t.seleccionEjercicios.cerrarSesion}
                </Text>
              </HStack>
            </Pressable>
          </HStack>
        </ScrollView>

        {/* ==================================================================== */}
        {/* Dock Inferior Flotante (Sticky Action Dock)                          */}
        {/* ==================================================================== */}
        {/* En teléfono el muelle se APILA. Era una fila única con
            `space-between`: en 360 dp el texto de estado («2 pruebas en cola ·
            Tiempo total: 18 min») empujaba el botón naranja fuera del muelle, y
            con él la única forma de empezar la batería. Apilado, el botón ocupa
            el ancho completo y no depende de lo que mida el texto. */}
        <View
          style={[styles.floatingDock, isPhone && styles.floatingDockPhone]}>
          <View style={isPhone ? styles.dockStack : styles.dockRow}>
            {/* Texto de estado acumulado */}
            <HStack alignItems="center" space="xs" style={atoms.flexWrapWrap}>
              <Text size="sm" weight="bold" style={atoms.color1E293BFontSize14}>
                {selCount === 0
                  ? t.seleccionEjercicios.ningunaPruebaCola
                  : t.seleccionEjercicios.pruebaCola(selCount)}
              </Text>
              {totalEstimatedMinutes > 0 && (
                <>
                  <Text size="sm" style={atoms.color94A3B8}>·</Text>
                  <Text size="sm" weight="medium" style={atoms.color475569FontSize14}>
                    
                    {t.seleccionEjercicios.tiempoTotal}{totalEstimatedMinutes}  {t.seleccionEjercicios.min}
                  </Text>
                </>
              )}
            </HStack>

            {/* Acciones del Dock */}
            <HStack alignItems="center" space="sm" style={isPhone ? styles.dockActionsPhone : undefined}>
              {selCount > 0 && (
                <Pressable
                  onPress={() => setSelected([])}
                  style={styles.clearBtn}>
                  <HStack alignItems="center" space="xs">
                    <RotateCcw size={13} color="#64748B" />
                    <Text size="xs" weight="medium" color="#64748B">
                      
                      {t.seleccionEjercicios.limpiar}
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
                  isPhone && styles.ctaButtonPhone,
                  selCount > 0 ? atoms.backgroundColorFF7F00 : atoms.backgroundColorCBD5E1,
                ]}>
                <HStack alignItems="center" justifyContent="center" space="xs">
                  <Text size="sm" weight="bold" style={atoms.colorFFFFFFFontSize14}>
                    {ctaLabel}
                  </Text>
                  <ArrowRight size={16} color="#FFFFFF" strokeWidth={2.5} />
                </HStack>
              </Pressable>
            </HStack>
          </View>
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
  topNavbarWide: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 12,
  },
  topNavbarPhone: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    gap: 8,
  },
  navIdentityPhone: {
    flexShrink: 1,
  },
  navActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  navActionsPhone: {
    flexWrap: 'wrap',
    rowGap: 8,
    columnGap: 8,
  },
  navLink: {
    paddingVertical: 2,
  },
  navChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2DDD5',
  },
  gridScroll: {
    paddingTop: 10,
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
  dockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dockStack: {
    gap: 10,
  },
  dockActionsPhone: {
    width: '100%',
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
  floatingDockPhone: {
    left: 12,
    right: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  ctaButtonPhone: {
    // Toma el ancho que quede tras «Limpiar»: así el rótulo largo («Iniciar
    // batería (3 pruebas)») ya no puede empujar el botón fuera del muelle.
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
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
