import React, { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  Box,
  HStack,
  Input,
  InputField,
  Textarea,
  TextareaInput,
  VStack,
} from '@gluestack-ui/themed';
import {
  ArrowRight,
  Check,
  ChevronRight,
  Droplets,
  Ear,
  Eye,
  Hand,
  Info,
  MessageSquare,
  ShieldCheck,
  ShieldQuestion,
  UserCheck,
  X,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Content, FontSizeControl, Header, ScaledTextScope, Text } from '@/Components/Common';
import RadialBackground from '@/Components/Themed/RadialBackground';
import { RootStackParamList } from '@/Navigators';
import { RootState } from '@/Store';
import { Evaluation } from '@/Models/Evaluation/Evaluation';
import { Patient } from '@/Models/Patient/Patient';
import { Professional } from '@/Models/Professional/Professional';
import { ClinicalAssessment } from '@/Models/ClinicalAssessment/ClinicalAssessment';
import { useClassSelector } from '@/Helpers/ClassTransformer';
import { ClinicalAssessmentRepository } from '@/Repositories/ClinicalAssessmentRepository';
import { EvaluationRepository } from '@/Repositories/EvaluationRepository';
import { showErrorToast, showSuccessToast } from '@/Helpers/showToast';
import { writeWithVerify } from '@/Helpers/dbWrite';
import { useT } from '@/I18n';
import {
  AgeGroup,
  DOMAIN_LABELS,
  DomainKind,
  EarFinding,
  FINDING_OPTIONS,
  MOTOR_ITEMS,
  VERBAL_GROUPS,
  VISUAL_ITEMS,
  analyzeClinicalAssessment,
  earSeverity,
  emptyState,
} from './clinicalAssessmentResult';
import { atoms } from '@/Theme/styleAtoms';

/* -------------------------------------------------------------------------- */
/*  Tokens de color semántico clínico para estados del CAP                     */
/* -------------------------------------------------------------------------- */

/**
 * Colores del chip de estado. La PALABRA no vive aquí: sale de `DOMAIN_LABELS`,
 * que está junto a la lógica que produce el `DomainKind`.
 *
 * El rediseño traía las etiquetas duplicadas dentro de esta tabla y, de paso,
 * renombradas —«Restricción» pasaba a «Adaptar» y «Bloqueo» a «Bloqueado»—.
 * Renombrar un veredicto clínico es una decisión clínica, no un efecto
 * colateral de un cambio de estilo, así que se mantiene el vocabulario actual
 * y se deja una sola fuente para él.
 */
const KIND_THEME: Record<DomainKind, { fg: string; bg: string; border: string; dot: string }> = {
  ok: {
    fg: '#15803D',
    bg: '#F0FDF4',
    border: '#BBF7D0',
    dot: '#16A34A',
  },
  warn: {
    fg: '#B45309',
    bg: '#FFFBEB',
    border: '#FDE68A',
    dot: '#D97706',
  },
  block: {
    fg: '#B91C1C',
    bg: '#FEF2F2',
    border: '#FECACA',
    dot: '#DC2626',
  },
  pending: {
    fg: '#64748B',
    bg: '#F8FAFC',
    border: '#E2E8F0',
    dot: '#94A3B8',
  },
};

type DomainId = 'otoscopia' | 'visual' | 'verbal' | 'motor';

const DOMAINS: {
  id: DomainId;
  short: string;
  title: string;
  subtitle: string;
  icon: any;
  accent: string;
  bgLight: string;
}[] = [
  {
    id: 'otoscopia',
    short: 'Otoscopia',
    title: 'Dominio 1 · Otoscopia',
    subtitle: 'Exploración de CAE y membrana timpánica',
    icon: Ear,
    accent: '#EA580C',
    bgLight: '#FFF7ED',
  },
  {
    id: 'visual',
    short: 'Visual',
    title: 'Dominio 2 · Capacidad visual',
    subtitle: 'Fijación y discriminación en pantalla',
    icon: Eye,
    accent: '#0284C7',
    bgLight: '#F0F9FF',
  },
  {
    id: 'verbal',
    short: 'Verbal',
    title: 'Dominio 3 · Capacidad verbal',
    subtitle: 'Comprensión y respuesta según edad',
    icon: MessageSquare,
    accent: '#0D9488',
    bgLight: '#F0FDFA',
  },
  {
    id: 'motor',
    short: 'Motora',
    title: 'Dominio 4 · Capacidad motora',
    subtitle: 'Interacción táctil y control intencional',
    icon: Hand,
    accent: '#7C3AED',
    bgLight: '#F5F3FF',
  },
];

/* -------------------------------------------------------------------------- */
/*  Subcomponentes UI Ergonómicos                                              */
/* -------------------------------------------------------------------------- */

const StatusChip = ({ kind }: { kind: DomainKind }) => {
  const t = KIND_THEME[kind];
  return (
    <View style={[styles.statusChip, { backgroundColor: t.bg, borderColor: t.border }]}>
      <View style={[styles.statusDot, { backgroundColor: t.dot }]} />
      <Text size="2xs" weight="bold" style={{ color: t.fg, letterSpacing: 0.4 }}>
        {DOMAIN_LABELS[kind]}
      </Text>
    </View>
  );
};

const YesNoToggle = ({
  value,
  onYes,
  onNo,
}: {
  value: boolean | null;
  onYes: () => void;
  onNo: () => void;
}) => (
  <View style={styles.toggleRow}>
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Sí"
      style={({ pressed }) => [
        styles.toggleBtn,
        value === true && styles.toggleBtnYesActive,
        pressed && styles.toggleBtnPressed,
      ]}
      onPress={onYes}>
      <Check size={16} color={value === true ? '#FFFFFF' : '#64748B'} strokeWidth={2.6} />
      <Text
        size="sm"
        weight="bold"
        style={{ color: value === true ? '#FFFFFF' : '#64748B', marginLeft: 4 }}>
        Sí
      </Text>
    </Pressable>

    <Pressable
      accessibilityRole="button"
      accessibilityLabel="No"
      style={({ pressed }) => [
        styles.toggleBtn,
        value === false && styles.toggleBtnNoActive,
        pressed && styles.toggleBtnPressed,
      ]}
      onPress={onNo}>
      <X size={16} color={value === false ? '#FFFFFF' : '#64748B'} strokeWidth={2.6} />
      <Text
        size="sm"
        weight="bold"
        style={{ color: value === false ? '#FFFFFF' : '#64748B', marginLeft: 4 }}>
        No
      </Text>
    </Pressable>
  </View>
);

const ItemRow = ({
  code,
  label,
  note,
  value,
  onYes,
  onNo,
}: {
  code: string;
  label: string;
  note?: string;
  value: boolean | null;
  onYes: () => void;
  onNo: () => void;
}) => (
  <View style={styles.itemRowContainer}>
    <View style={styles.itemTextCol}>
      <View style={styles.itemCodeBadge}>
        <Text size="2xs" weight="bold" color="$textLight600" style={{ fontVariant: ['tabular-nums'] }}>
          {code}
        </Text>
      </View>
      <View style={atoms.flex1}>
        <Text size="sm" weight="medium" color="$textLight800" style={atoms.lineHeight20}>
          {label}
        </Text>
        {note ? (
          <View style={styles.itemNoteRow}>
            <Info size={12} color="#D97706" />
            <Text size="2xs" color="$warning800" style={atoms.flex1}>
              {note}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
    <YesNoToggle value={value} onYes={onYes} onNo={onNo} />
  </View>
);

/* -------------------------------------------------------------------------- */
/*  Pantalla Principal: ClinicalAssessmentScreen (CAP)                         */
/* -------------------------------------------------------------------------- */

type Props = NativeStackScreenProps<RootStackParamList, 'ClinicalAssessment'>;

export default function ClinicalAssessmentScreen({ navigation }: Props) {
  const t = useT();
  const insets = useSafeAreaInsets();
  const activeEvaluation = useClassSelector(
    Evaluation,
    (state: RootState) => state.activeEvaluation.evaluation,
  );
  const [isSaving, setIsSaving] = useState(false);

  const [activeDomain, setActiveDomain] = useState<DomainId>('otoscopia');
  const [s, setS] = useState(() => emptyState());
  const [visObs, setVisObs] = useState('');
  const [verObs, setVerObs] = useState('');
  const [motObs, setMotObs] = useState('');
  const [otoObs, _setOtoObs] = useState('');
  const [evaluatorName, setEvaluatorName] = useState(activeEvaluation?.professional?.name ?? '');
  const [evaluatorLicense, setEvaluatorLicense] = useState(
    activeEvaluation?.professional?.licenseNumber ?? '',
  );

  const patient = activeEvaluation?.patient;
  const patientName = patient ? `${patient.name} ${patient.lastName}`.trim() : null;

  const a = useMemo(() => analyzeClinicalAssessment(s), [s]);
  const kindByDomain: Record<DomainId, DomainKind> = {
    otoscopia: a.otoKind,
    visual: a.visKind,
    verbal: a.verKind,
    motor: a.motKind,
  };

  /* ----------------------------- handlers ------------------------------- */
  const setFinding = (ear: 'od' | 'oi', f: EarFinding) => setS(prev => ({ ...prev, [ear]: f }));
  const setVisual = (id: string, val: boolean) =>
    setS(prev => ({ ...prev, visual: { ...prev.visual, [id]: val } }));
  const setMotor = (id: string, val: boolean) =>
    setS(prev => ({ ...prev, motor: { ...prev.motor, [id]: val } }));
  const setVerbal = (id: string, val: boolean) =>
    setS(prev => ({ ...prev, verbal: { ...prev.verbal, [id]: val } }));
  const setAge = (g: AgeGroup) =>
    setS(prev => ({ ...prev, ageGroup: g, verbal: { VB1: null, VB2: null, VB3: null } }));

  const confirmReady = !!evaluatorName.trim() && !!evaluatorLicense.trim();

  const ensureEvaluationId = async (): Promise<number | null> => {
    if (activeEvaluation?.id) return activeEvaluation.id;
    const patientId = activeEvaluation?.patient?.id;
    if (!patientId) return null;

    const pending = await EvaluationRepository.getLatestPendingByPatient(patientId);
    if (pending) return pending.id;

    const nueva = new Evaluation();
    nueva.patient = { id: patientId } as Patient;
    if (activeEvaluation?.professional?.id) {
      nueva.professional = { id: activeEvaluation.professional.id } as Professional;
    }
    nueva.status = 'in_progress';
    nueva.capApproved = false;
    nueva.capNotes = null;
    nueva.consentSignedAt = null;
    nueva.completedAt = null;
    const saved = await writeWithVerify(
      () => EvaluationRepository.createEvaluation(nueva),
      () => EvaluationRepository.getLatestPendingByPatient(patientId),
    );
    return saved.id;
  };

  const handleSave = async () => {
    if (isSaving || !confirmReady) return;
    if (!activeEvaluation) {
      showErrorToast('No se puede guardar', 'No hay una evaluación activa asociada al paciente.');
      return;
    }
    setIsSaving(true);
    try {
      const evaluationId = await ensureEvaluationId();
      if (!evaluationId) {
        showErrorToast(
          'No se puede guardar',
          'No hay una evaluación activa. Vuelva a la lista de pacientes y seleccione el paciente de nuevo.',
        );
        return;
      }

      const ca = new ClinicalAssessment();
      ca.instrument = 'CAP';
      ca.globalResult = a.global;
      ca.globalLabel = a.globalLabel;
      ca.activeGames = a.activeCount;
      ca.totalGames = a.totalGames;
      ca.domains = {
        otoscopia: {
          od: s.od,
          oi: s.oi,
          odNotes: s.odNotes,
          oiNotes: s.oiNotes,
          notes: otoObs,
          kind: a.otoKind,
        },
        visual: { answers: s.visual, notes: visObs, kind: a.visKind },
        verbal: { ageGroup: s.ageGroup, answers: s.verbal, notes: verObs, kind: a.verKind },
        motor: { answers: s.motor, notes: motObs, kind: a.motKind },
      };
      ca.games = a.games;
      ca.evaluatorName = evaluatorName.trim();
      ca.evaluatorLicense = evaluatorLicense.trim();
      ca.completedAt = new Date();
      ca.evaluation = { id: evaluationId } as Evaluation;

      const attemptTime = ca.completedAt.getTime();
      await writeWithVerify(
        () => ClinicalAssessmentRepository.createClinicalAssessment(ca),
        async () => {
          const latest = await ClinicalAssessmentRepository.getLatestByEvaluation(evaluationId);
          if (!latest?.completedAt) return null;
          return new Date(latest.completedAt).getTime() >= attemptTime - 60_000 ? latest : null;
        },
      );
      showSuccessToast(
        'CAP generado',
        `${a.globalLabel} · ${a.activeCount}/${a.totalGames} pruebas habilitadas.`,
      );
      navigation.navigate('RoomNoiseCheck');
    } catch (e) {
      const detail = e instanceof Error && e.message ? ` (${e.message})` : '';
      console.error('VIA+: error guardando CAP', e);
      showErrorToast('Error al guardar', `No se pudo registrar el certificado.${detail}`);
    } finally {
      setIsSaving(false);
    }
  };

  const verbalGroup = VERBAL_GROUPS[s.ageGroup];

  return (
    <Content
      padding={false}
      insetTop={false}
      radialBackgrounds={
        <>
          <RadialBackground
            topMultiplier={0.12}
            leftMultiplier={-0.2}
            widthMultiplier={2}
            heightMultiplier={2}
            center={(w, _h) => [w, w]}
            radiusMultiplier={1}
          />
          <RadialBackground
            topMultiplier={-0.95}
            leftMultiplier={-0.8}
            widthMultiplier={2}
            heightMultiplier={2}
            center={(w, _h) => [w, w]}
            radiusMultiplier={1}
          />
        </>
      }>
      <KeyboardAvoidingView
        style={atoms.flex1}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <VStack flex={1}>
          <Header animationType="expand" />

          <ScrollView
            style={atoms.flex1}
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: 40 + Math.max(insets.bottom, 16) },
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            <VStack space="lg">
              {/* ============================================================ */}
              {/* HEADER CLÍNICO & PACIENTE                                    */}
              {/* ============================================================ */}
              <View style={styles.headerCard}>
                <View style={styles.headerTitleRow}>
                  <View style={atoms.flex1}>
                    <View style={styles.badgePrereqRow}>
                      <ShieldCheck size={14} color="#0D9488" strokeWidth={2.2} />
                      <Text size="2xs" weight="bold" color="$teal700" style={atoms.letterSpacing04}>
                        
                        {t.clinicalAssessment.prerrequisitoClinicoCap}
                      </Text>
                    </View>
                    <Text size="2xl" weight="bold" color="$textLight900" style={atoms.marginTop2}>
                      
                      {t.clinicalAssessment.evaluacionClinicaPrevia}
                    </Text>
                  </View>

                  <View style={styles.samdBadge}>
                    <Text size="2xs" weight="bold" color="$textLight600">
                      
                      {t.clinicalAssessment.samdClaseIia}
                    </Text>
                  </View>
                </View>

                <View style={styles.patientInfoBar}>
                  <Text size="xs" weight="semiBold" color="$textLight800">
                    {patientName ? t.clinicalAssessment.paciente(patientName) : t.clinicalAssessment.pacienteSinRegistrar}
                  </Text>
                  {patient?.nhc ? (
                    <Text size="2xs" color="$textLight500" style={atoms.marginLeft8}>
                      
                      {t.clinicalAssessment.nhc} {patient.nhc}
                    </Text>
                  ) : null}
                </View>
              </View>

              {/* ============================================================ */}
              {/* ACCESO RÁPIDO: DISFAGIA                                     */}
              {/* ============================================================ */}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t.clinicalAssessment.irDirectoExploracionDisfagia}
                style={({ pressed }) => [styles.dysphagiaBanner, pressed && styles.bannerPressed]}
                onPress={() => navigation.navigate('DysphagiaTest')}>
                <View style={styles.dysphagiaIconBox}>
                  <Droplets size={20} color="#0284C7" strokeWidth={2.2} />
                </View>
                <View style={atoms.flex1}>
                  <Text size="xs" weight="bold" color="$info800">
                    
                    {t.clinicalAssessment.sesionExclusivaDisfagiaEat10}
                  </Text>
                  <Text size="2xs" color="$info700" style={atoms.marginTop1}>
                    
                    {t.clinicalAssessment.irDirectoEsteModuloClinico}
                  </Text>
                </View>
                <ChevronRight size={18} color="#0284C7" strokeWidth={2.2} />
              </Pressable>

              {/* ============================================================ */}
              {/* SELECTOR DE PESTAÑAS POR DOMINIO                             */}
              {/* ============================================================ */}
              <View style={styles.tabsGrid}>
                {DOMAINS.map(d => {
                  const active = activeDomain === d.id;
                  const k = kindByDomain[d.id];
                  const kindTheme = KIND_THEME[k];
                  const IconComp = d.icon;
                  return (
                    <Pressable
                      key={d.id}
                      style={({ pressed }) => [
                        styles.tabItem,
                        active && styles.tabItemActive,
                        { borderColor: active ? d.accent : '#E8E2D5' },
                        pressed && { opacity: 0.88 },
                      ]}
                      onPress={() => setActiveDomain(d.id)}>
                      <View style={[styles.tabIconBox, { backgroundColor: active ? d.bgLight : '#F8FAFC' }]}>
                        <IconComp size={20} color={active ? d.accent : '#64748B'} strokeWidth={2.2} />
                      </View>
                      <View style={atoms.flex1}>
                        <Text size="xs" weight="bold" color={active ? '$textLight900' : '$textLight600'}>
                          {d.short}
                        </Text>
                        <View style={styles.tabStatusRow}>
                          <View style={[styles.statusMiniDot, { backgroundColor: kindTheme.dot }]} />
                          <Text size="2xs" weight="semiBold" style={{ color: kindTheme.fg }}>
                            {DOMAIN_LABELS[k]}
                          </Text>
                        </View>
                      </View>
                    </Pressable>
                  );
                })}
              </View>

              {/* Control de accesibilidad de tamaño de texto */}
              <FontSizeControl />

              {/* ============================================================ */}
              {/* CONTENIDO DEL DOMINIO ACTIVO                                 */}
              {/* ============================================================ */}
              <ScaledTextScope.Provider value={true}>
                {/* -------------------- 1. OTOSCOPIA -------------------- */}
                {activeDomain === 'otoscopia' && (
                  <View style={styles.cardSection}>
                    <View style={styles.sectionHeaderRow}>
                      <View style={styles.sectionTitleCol}>
                        <View style={styles.sectionTitleBadge}>
                          <Ear size={16} color="#EA580C" strokeWidth={2.2} />
                          <Text size="sm" weight="bold" color="$textLight900">
                            
                            {t.clinicalAssessment.dominio1OtoscopiaClinica}
                          </Text>
                        </View>
                        <Text size="2xs" color="$textLight500" style={atoms.marginTop2}>
                          
                          {t.clinicalAssessment.seleccioneHallazgoCadaOidoOd}
                        </Text>
                      </View>
                      <StatusChip kind={a.otoKind} />
                    </View>

                    {/* Paneles de Oído Derecho e Izquierdo */}
                    {(['od', 'oi'] as const).map(ear => {
                      const finding = s[ear];
                      const sev = earSeverity(finding);
                      const sevKind: DomainKind =
                        sev === 0 ? 'pending' : sev === 1 ? 'ok' : sev === 2 ? 'warn' : 'block';
                      const isRight = ear === 'od';

                      return (
                        <View
                          key={ear}
                          style={[
                            styles.earBox,
                            { borderLeftColor: isRight ? '#EF4444' : '#0284C7' },
                          ]}>
                          <View style={styles.earHeader}>
                            <View style={styles.earLabelBadge}>
                              <View
                                style={[
                                  styles.earIndicatorCircle,
                                  { backgroundColor: isRight ? '#EF4444' : '#0284C7' },
                                ]}
                              />
                              <Text size="sm" weight="bold" color="$textLight900">
                                {isRight ? t.clinicalAssessment.oidoDerechoOd : t.clinicalAssessment.oidoIzquierdoOi}
                              </Text>
                            </View>
                            <StatusChip kind={sevKind} />
                          </View>

                          <View style={styles.findingsPillsWrap}>
                            {FINDING_OPTIONS.map(f => {
                              const selected = finding === f;
                              const fsev = earSeverity(f);
                              const fkind: DomainKind =
                                fsev === 1 ? 'ok' : fsev === 2 ? 'warn' : 'block';
                              const c = KIND_THEME[fkind];
                              return (
                                <Pressable
                                  key={f}
                                  style={({ pressed }) => [
                                    styles.findingPill,
                                    selected && {
                                      backgroundColor: c.dot,
                                      borderColor: c.dot,
                                    },
                                    pressed && { opacity: 0.8 },
                                  ]}
                                  onPress={() => setFinding(ear, f)}>
                                  <Text
                                    size="xs"
                                    weight="bold"
                                    style={{ color: selected ? '#FFFFFF' : '#475569' }}>
                                    {f}
                                  </Text>
                                </Pressable>
                              );
                            })}
                          </View>

                          <Input variant="outline" borderRadius={12} mt="$3" bg="$white">
                            <InputField
                              placeholder={t.clinicalAssessment.anotacionesOtoscopiaTimpanoCae}
                              value={isRight ? s.odNotes : s.oiNotes}
                              onChangeText={text =>
                                setS(prev => ({
                                  ...prev,
                                  [isRight ? 'odNotes' : 'oiNotes']: text,
                                }))
                              }
                            />
                          </Input>
                        </View>
                      );
                    })}

                    <View style={styles.clinicalAlertBox}>
                      <Info size={16} color="#0D9488" style={atoms.marginTop2} />
                      <Text size="2xs" color="$teal800" style={atoms.flex1LineHeight17}>
                        
                        {t.clinicalAssessment.criterioSeguridadAudiologicaCerumenOclusivo}
                      </Text>
                    </View>
                  </View>
                )}

                {/* -------------------- 2. VISUAL -------------------- */}
                {activeDomain === 'visual' && (
                  <View style={styles.cardSection}>
                    <View style={styles.sectionHeaderRow}>
                      <View style={styles.sectionTitleCol}>
                        <View style={styles.sectionTitleBadge}>
                          <Eye size={16} color="#0284C7" strokeWidth={2.2} />
                          <Text size="sm" weight="bold" color="$textLight900">
                            
                            {t.clinicalAssessment.dominio2CapacidadVisualMinima}
                          </Text>
                        </View>
                        <Text size="2xs" color="$textLight500" style={atoms.marginTop2}>
                          
                          {t.clinicalAssessment.discriminacionEstimulosPantalla5Cm}
                        </Text>
                      </View>
                      <StatusChip kind={a.visKind} />
                    </View>

                    {VISUAL_ITEMS.map(it => (
                      <ItemRow
                        key={it.id}
                        code={it.code}
                        label={it.label}
                        value={s.visual[it.id] as boolean | null}
                        onYes={() => setVisual(it.id, true)}
                        onNo={() => setVisual(it.id, false)}
                      />
                    ))}

                    <Box mt="$4">
                      <Text size="2xs" weight="bold" color="$textLight600" mb="$1.5">
                        
                        {t.clinicalAssessment.observacionesDominioVisual}
                      </Text>
                      <Textarea borderRadius={12} bg="$backgroundLight50">
                        <TextareaInput
                          placeholder={t.clinicalAssessment.anotacionesOftalmologicasRespuestaVisual}
                          value={visObs}
                          onChangeText={setVisObs}
                        />
                      </Textarea>
                    </Box>
                  </View>
                )}

                {/* -------------------- 3. VERBAL -------------------- */}
                {activeDomain === 'verbal' && (
                  <View style={styles.cardSection}>
                    <View style={styles.sectionHeaderRow}>
                      <View style={styles.sectionTitleCol}>
                        <View style={styles.sectionTitleBadge}>
                          <MessageSquare size={16} color="#0D9488" strokeWidth={2.2} />
                          <Text size="sm" weight="bold" color="$textLight900">
                            
                            {t.clinicalAssessment.dominio3CapacidadVerbalMinima}
                          </Text>
                        </View>
                        <Text size="2xs" color="$textLight500" style={atoms.marginTop2}>
                          
                          {t.clinicalAssessment.comprensionRespuestaAdaptadaRangoEtario}
                        </Text>
                      </View>
                      <StatusChip kind={a.verKind} />
                    </View>

                    {/* Selector de Grupo de Edad */}
                    <View style={styles.ageGroupContainer}>
                      <Text size="2xs" weight="bold" color="$textLight600" mb="$2">
                        
                        {t.clinicalAssessment.grupoEdadPaciente}
                      </Text>
                      <View style={styles.ageButtonsRow}>
                        {(['A', 'B', 'C'] as AgeGroup[]).map(g => {
                          const active = s.ageGroup === g;
                          const gLabel =
                            g === 'A'
                              ? 'Grupo A (18m - 2a 11m)'
                              : g === 'B'
                                ? 'Grupo B (3a - 4a 11m)'
                                : 'Grupo C (≥ 5 años)';
                          return (
                            <Pressable
                              key={g}
                              style={({ pressed }) => [
                                styles.ageGroupBtn,
                                active && styles.ageGroupBtnActive,
                                pressed && { opacity: 0.85 },
                              ]}
                              onPress={() => setAge(g)}>
                              <Text
                                size="xs"
                                weight="bold"
                                style={{ color: active ? '#FFFFFF' : '#475569' }}>
                                {gLabel}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>

                    {verbalGroup.items.map(it => (
                      <ItemRow
                        key={it.id}
                        code={it.code}
                        label={it.label}
                        value={s.verbal[it.id] as boolean | null}
                        onYes={() => setVerbal(it.id, true)}
                        onNo={() => setVerbal(it.id, false)}
                      />
                    ))}

                    <Box mt="$4">
                      <Text size="2xs" weight="bold" color="$textLight600" mb="$1.5">
                        
                        {t.clinicalAssessment.observacionesDominioVerbal}
                      </Text>
                      <Textarea borderRadius={12} bg="$backgroundLight50">
                        <TextareaInput
                          placeholder={t.clinicalAssessment.anotacionesLenguajeComunicacion}
                          value={verObs}
                          onChangeText={setVerObs}
                        />
                      </Textarea>
                    </Box>
                  </View>
                )}

                {/* -------------------- 4. MOTOR -------------------- */}
                {activeDomain === 'motor' && (
                  <View style={styles.cardSection}>
                    <View style={styles.sectionHeaderRow}>
                      <View style={styles.sectionTitleCol}>
                        <View style={styles.sectionTitleBadge}>
                          <Hand size={16} color="#7C3AED" strokeWidth={2.2} />
                          <Text size="sm" weight="bold" color="$textLight900">
                            
                            {t.clinicalAssessment.dominio4CapacidadMotoraMinima}
                          </Text>
                        </View>
                        <Text size="2xs" color="$textLight500" style={atoms.marginTop2}>
                          
                          {t.clinicalAssessment.capacidadInteractuarPantallaTactilManera}
                        </Text>
                      </View>
                      <StatusChip kind={a.motKind} />
                    </View>

                    {MOTOR_ITEMS.map(it => (
                      <ItemRow
                        key={it.id}
                        code={it.code}
                        label={it.label}
                        note={it.note}
                        value={s.motor[it.id] as boolean | null}
                        onYes={() => setMotor(it.id, true)}
                        onNo={() => setMotor(it.id, false)}
                      />
                    ))}

                    <Box mt="$4">
                      <Text size="2xs" weight="bold" color="$textLight600" mb="$1.5">
                        
                        {t.clinicalAssessment.observacionesDominioMotor}
                      </Text>
                      <Textarea borderRadius={12} bg="$backgroundLight50">
                        <TextareaInput
                          placeholder={t.clinicalAssessment.anotacionesPsicomotricesLateralidad}
                          value={motObs}
                          onChangeText={setMotObs}
                        />
                      </Textarea>
                    </Box>
                  </View>
                )}
              </ScaledTextScope.Provider>

              {/* ============================================================ */}
              {/* RESUMEN DE PERFIL DE APTITUD DIAGNÓSTICA                     */}
              {/* ============================================================ */}
              <View style={styles.aptitudeSection}>
                <View style={styles.aptitudeHeaderRow}>
                  <ShieldCheck size={20} color="#FF7F00" strokeWidth={2.4} />
                  <Text size="md" weight="bold" color="$textLight900">
                    
                    {t.clinicalAssessment.perfilAptitudGatingPruebas}
                  </Text>
                </View>

                {/* Banner de Veredicto Global */}
                <View
                  style={[
                    styles.globalResultCard,
                    {
                      backgroundColor: KIND_THEME[a.globalKind].bg,
                      borderColor: KIND_THEME[a.globalKind].border,
                    },
                  ]}>
                  <View style={styles.globalResultTop}>
                    <View style={atoms.flex1}>
                      <Text
                        size="2xs"
                        weight="bold"
                        style={{ color: KIND_THEME[a.globalKind].fg, letterSpacing: 0.6 }}>
                        
                        {t.clinicalAssessment.veredictoClinicoGlobal}
                      </Text>
                      <Text
                        size="xl"
                        weight="bold"
                        style={{ color: KIND_THEME[a.globalKind].fg, marginTop: 2 }}>
                        {a.globalLabel}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.globalResultBadge,
                        { backgroundColor: KIND_THEME[a.globalKind].dot },
                      ]}>
                      <Text size="xs" weight="bold" color="$white">
                        {a.activeCount}/{a.totalGames}  {t.clinicalAssessment.activas}
                      </Text>
                    </View>
                  </View>
                  <Text
                    size="xs"
                    style={{ color: KIND_THEME[a.globalKind].fg, marginTop: 6, lineHeight: 18 }}>
                    {a.globalDesc}
                  </Text>
                </View>

                {/* Desglose de Pruebas de la Sesión */}
                <Text size="2xs" weight="bold" color="$textLight600" mt="$3" mb="$2" style={atoms.letterSpacing05}>
                  
                  {t.clinicalAssessment.estadoHabilitacionPruebasBateria}
                </Text>
                <View style={styles.gamesListWrap}>
                  {a.games.map(g => (
                    <View
                      key={g.code}
                      style={[
                        styles.gameGateItem,
                        { backgroundColor: g.active ? '#F8FAFC' : '#FEF2F2' },
                      ]}>
                      <View
                        style={[
                          styles.gameStatusIcon,
                          { backgroundColor: g.active ? '#DCFCE7' : '#FEE2E2' },
                        ]}>
                        {g.active ? (
                          <Check size={14} color="#16A34A" strokeWidth={2.8} />
                        ) : (
                          <X size={14} color="#DC2626" strokeWidth={2.8} />
                        )}
                      </View>
                      <View style={atoms.flex1}>
                        <Text size="xs" weight="bold" color="$textLight900">
                          {g.code} · {g.title}
                        </Text>
                        <Text
                          size="2xs"
                          weight="medium"
                          style={{ color: g.active ? '#15803D' : '#DC2626' }}>
                          {g.reason}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              </View>

              {/* ============================================================ */}
              {/* FIRMA Y CONFIRMACIÓN DEL PROFESIONAL                         */}
              {/* ============================================================ */}
              <View style={styles.evaluatorSection}>
                <View style={styles.evaluatorHeaderRow}>
                  <UserCheck size={18} color="#0D9488" strokeWidth={2.2} />
                  <Text size="sm" weight="bold" color="$textLight900">
                    
                    {t.clinicalAssessment.profesionalEvaluadorResponsable}
                  </Text>
                </View>

                <HStack space="md" mb="$4" mt="$2">
                  <View style={atoms.flex2}>
                    <Text size="2xs" weight="bold" color="$textLight600" mb="$1">
                      
                      {t.clinicalAssessment.nombreProfesional}
                    </Text>
                    <Input variant="outline" borderRadius={12} bg="$white">
                      <InputField
                        placeholder={t.clinicalAssessment.ejDrFrankBetances}
                        value={evaluatorName}
                        onChangeText={setEvaluatorName}
                      />
                    </Input>
                  </View>
                  <View style={atoms.flex1}>
                    <Text size="2xs" weight="bold" color="$textLight600" mb="$1">
                      
                      {t.clinicalAssessment.nColegiado}
                    </Text>
                    <Input variant="outline" borderRadius={12} bg="$white">
                      <InputField
                        placeholder={t.clinicalAssessment.nColegiado2}
                        value={evaluatorLicense}
                        onChangeText={setEvaluatorLicense}
                      />
                    </Input>
                  </View>
                </HStack>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t.clinicalAssessment.confirmarGenerarCertificadoAptitud}
                  disabled={!confirmReady || isSaving}
                  style={({ pressed }) => [
                    styles.confirmButton,
                    (!confirmReady || isSaving) && styles.confirmButtonDisabled,
                    pressed && confirmReady && !isSaving && styles.confirmButtonPressed,
                  ]}
                  onPress={handleSave}>
                  <ShieldQuestion size={18} color="#FFFFFF" strokeWidth={2.2} />
                  <Text size="md" weight="bold" color="$white" style={atoms.marginHorizontal8}>
                    {isSaving ? t.clinicalAssessment.guardandoCertificado : t.clinicalAssessment.confirmarGenerarCap}
                  </Text>
                  <ArrowRight size={18} color="#FFFFFF" strokeWidth={2.4} />
                </Pressable>

                <Text size="2xs" color="$textLight400" mt="$3" style={atoms.textAlignCenterLineHeight15}>
                  
                  {t.clinicalAssessment.capCertificaCondicionesViabilidadSesion}
                </Text>
              </View>
            </VStack>
          </ScrollView>
        </VStack>
      </KeyboardAvoidingView>
    </Content>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 10,
  },

  /* Header Card */
  headerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E8E2D5',
    shadowColor: '#2B2620',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  badgePrereqRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 4,
  },
  samdBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  patientInfoBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },

  /* Disfagia Callout */
  dysphagiaBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#F0F9FF',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1.5,
    borderColor: '#BAE6FD',
  },
  dysphagiaIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerPressed: {
    opacity: 0.85,
    transform: [{ translateY: -1 }],
  },

  /* Pestañas de Dominio */
  tabsGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderWidth: 1.5,
    shadowColor: '#2B2620',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  tabItemActive: {
    backgroundColor: '#FFFFFF',
    shadowOpacity: 0.08,
    elevation: 3,
  },
  tabIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  statusMiniDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },

  /* Tarjeta de Contenido de Dominio */
  cardSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E8E2D5',
    shadowColor: '#2B2620',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  sectionTitleCol: {
    flex: 1,
    marginRight: 12,
  },
  sectionTitleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  /* Otoscopia */
  earBox: {
    backgroundColor: '#FAFAF9',
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E7E5E4',
    borderLeftWidth: 4,
  },
  earHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  earLabelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  earIndicatorCircle: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  findingsPillsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  findingPill: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
  },
  clinicalAlertBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#F0FDFA',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#CCFBF1',
    marginTop: 4,
  },

  /* Toggles y Preguntas */
  itemRowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    gap: 12,
  },
  itemTextCol: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  itemCodeBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 1,
  },
  itemNoteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 8,
  },
  toggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    minWidth: 62,
    minHeight: 40,
  },
  toggleBtnYesActive: {
    backgroundColor: '#16A34A',
    borderColor: '#16A34A',
  },
  toggleBtnNoActive: {
    backgroundColor: '#DC2626',
    borderColor: '#DC2626',
  },
  toggleBtnPressed: {
    opacity: 0.8,
  },

  /* Grupo de Edad */
  ageGroupContainer: {
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  ageButtonsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  ageGroupBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
  },
  ageGroupBtnActive: {
    backgroundColor: '#0D9488',
    borderColor: '#0D9488',
  },

  /* Perfil de Aptitud */
  aptitudeSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E8E2D5',
    shadowColor: '#2B2620',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  aptitudeHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  globalResultCard: {
    borderRadius: 16,
    padding: 14,
    borderWidth: 1.5,
  },
  globalResultTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  globalResultBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  gamesListWrap: {
    gap: 6,
  },
  gameGateItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 12,
  },
  gameStatusIcon: {
    width: 24,
    height: 24,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Evaluador y Confirmación */
  evaluatorSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E8E2D5',
    shadowColor: '#2B2620',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  evaluatorHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  confirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF7F00',
    borderRadius: 28,
    height: 56,
    paddingHorizontal: 24,
    shadowColor: '#FF7F00',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  confirmButtonDisabled: {
    backgroundColor: '#CBD5E1',
    shadowOpacity: 0,
    elevation: 0,
  },
  confirmButtonPressed: {
    opacity: 0.92,
    transform: [{ translateY: -1 }],
  },

  /* Chips de Estado */
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});

