import React, { useMemo, useState } from 'react';
import { Pressable } from 'react-native';
import { StackScreenProps } from '@react-navigation/stack';
import {
  Box,
  Card,
  Center,
  HStack,
  Icon,
  Input,
  InputField,
  Textarea,
  TextareaInput,
  VStack,
} from '@gluestack-ui/themed';
import {
  ArrowRight,
  Check,
  Ear,
  Eye,
  Hand,
  Info,
  MessageSquare,
  ShieldCheck,
  ShieldQuestion,
  X,
} from 'lucide-react-native';

import { Button, Content, Header, Text } from '@/Components/Common';
import RadialBackground from '@/Components/Themed/RadialBackground';
import { RootStackParamList } from '@/Navigators';
import { RootState } from '@/Store';
import { Evaluation } from '@/Models/Evaluation/Evaluation';
import { ClinicalAssessment } from '@/Models/ClinicalAssessment/ClinicalAssessment';
import { useClassSelector } from '@/Helpers/ClassTransformer';
import { useCreateClinicalAssessmentMutation } from '@/Services/local/modules/clinicalAssessments';
import { showErrorToast, showSuccessToast } from '@/Helpers/showToast';
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

/* -------------------------------------------------------------------------- */
/*  Tokens de color por estado (alineados a los tokens Gluestack del repo)     */
/* -------------------------------------------------------------------------- */

const KIND_COLOR: Record<DomainKind, { fg: string; bg: string; dot: string }> = {
  ok: { fg: '$success700', bg: '$success50', dot: '$success600' },
  warn: { fg: '$warning800', bg: '$warning50', dot: '$warning600' },
  block: { fg: '$error700', bg: '$error50', dot: '$error500' },
  pending: { fg: '$textLight500', bg: '$backgroundLight100', dot: '$borderLight300' },
};

type DomainId = 'otoscopia' | 'visual' | 'verbal' | 'motor';

const DOMAINS: { id: DomainId; short: string; title: string; icon: any }[] = [
  { id: 'otoscopia', short: 'Otoscopia', title: 'Dominio 1 · Otoscopia', icon: Ear },
  { id: 'visual', short: 'Visual', title: 'Dominio 2 · Capacidad visual mínima', icon: Eye },
  { id: 'verbal', short: 'Verbal', title: 'Dominio 3 · Capacidad verbal mínima', icon: MessageSquare },
  { id: 'motor', short: 'Motora', title: 'Dominio 4 · Capacidad motora mínima', icon: Hand },
];

/* -------------------------------------------------------------------------- */
/*  Subcomponentes UI                                                          */
/* -------------------------------------------------------------------------- */

const StatusChip = ({ kind }: { kind: DomainKind }) => {
  const c = KIND_COLOR[kind];
  return (
    <Box bg={c.bg} px="$2.5" py="$0.5" borderRadius="$full">
      <Text size="2xs" weight="bold" color={c.fg} style={{ textTransform: 'uppercase', letterSpacing: 0.3 }}>
        {DOMAIN_LABELS[kind]}
      </Text>
    </Box>
  );
};

const YesNoToggle = ({ value, onYes, onNo }: { value: boolean | null; onYes: () => void; onNo: () => void }) => (
  <HStack space="sm">
    <Pressable onPress={onYes}>
      <Center px="$4" py="$1.5" borderRadius="$full" borderWidth={1.5} bg={value === true ? '$success600' : '$white'} borderColor={value === true ? '$success600' : '$borderLight200'}>
        <Text size="sm" weight="bold" color={value === true ? '$white' : '$textLight400'}>
          Sí
        </Text>
      </Center>
    </Pressable>
    <Pressable onPress={onNo}>
      <Center px="$4" py="$1.5" borderRadius="$full" borderWidth={1.5} bg={value === false ? '$error500' : '$white'} borderColor={value === false ? '$error500' : '$borderLight200'}>
        <Text size="sm" weight="bold" color={value === false ? '$white' : '$textLight400'}>
          No
        </Text>
      </Center>
    </Pressable>
  </HStack>
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
  <HStack alignItems="center" justifyContent="space-between" space="md" py="$3" borderBottomWidth={1} borderColor="$borderLight50">
    <HStack space="sm" alignItems="flex-start" style={{ flex: 1 }}>
      <Box bg="$backgroundLight100" px="$2" py="$0.5" borderRadius={6} mt="$0.5">
        <Text size="2xs" weight="semiBold" color="$textLight500" style={{ fontVariant: ['tabular-nums'] }}>
          {code}
        </Text>
      </Box>
      <VStack style={{ flex: 1 }}>
        <Text size="sm" color="$textLight700" style={{ lineHeight: 19 }}>
          {label}
        </Text>
        {note ? (
          <Text size="2xs" color="$warning700" mt="$0.5">
            ⚠ {note}
          </Text>
        ) : null}
      </VStack>
    </HStack>
    <YesNoToggle value={value} onYes={onYes} onNo={onNo} />
  </HStack>
);

/* -------------------------------------------------------------------------- */
/*  Pantalla principal                                                         */
/* -------------------------------------------------------------------------- */

type Props = StackScreenProps<RootStackParamList, 'ClinicalAssessment'>;

export default function ClinicalAssessmentScreen({ navigation }: Props) {
  const activeEvaluation = useClassSelector(Evaluation, (state: RootState) => state.activeEvaluation.evaluation);
  const [createAssessment, { isLoading: isSaving }] = useCreateClinicalAssessmentMutation();

  const [activeDomain, setActiveDomain] = useState<DomainId>('otoscopia');
  const [s, setS] = useState(() => emptyState());
  const [visObs, setVisObs] = useState('');
  const [verObs, setVerObs] = useState('');
  const [motObs, setMotObs] = useState('');
  const [otoObs, setOtoObs] = useState('');
  const [evaluatorName, setEvaluatorName] = useState(activeEvaluation?.professional?.name ?? '');
  const [evaluatorLicense, setEvaluatorLicense] = useState(activeEvaluation?.professional?.licenseNumber ?? '');

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
  const setVisual = (id: string, val: boolean) => setS(prev => ({ ...prev, visual: { ...prev.visual, [id]: val } }));
  const setMotor = (id: string, val: boolean) => setS(prev => ({ ...prev, motor: { ...prev.motor, [id]: val } }));
  const setVerbal = (id: string, val: boolean) => setS(prev => ({ ...prev, verbal: { ...prev.verbal, [id]: val } }));
  const setAge = (g: AgeGroup) => setS(prev => ({ ...prev, ageGroup: g, verbal: { VB1: null, VB2: null, VB3: null } }));

  const confirmReady = !!evaluatorName.trim() && !!evaluatorLicense.trim();

  const handleSave = async () => {
    if (isSaving || !confirmReady) return;
    if (!activeEvaluation) {
      showErrorToast('No se puede guardar', 'No hay una evaluación activa asociada al paciente.');
      return;
    }
    try {
      const ca = new ClinicalAssessment();
      ca.instrument = 'CAP';
      ca.globalResult = a.global;
      ca.globalLabel = a.globalLabel;
      ca.activeGames = a.activeCount;
      ca.totalGames = a.totalGames;
      ca.domains = {
        otoscopia: { od: s.od, oi: s.oi, odNotes: s.odNotes, oiNotes: s.oiNotes, notes: otoObs, kind: a.otoKind },
        visual: { answers: s.visual, notes: visObs, kind: a.visKind },
        verbal: { ageGroup: s.ageGroup, answers: s.verbal, notes: verObs, kind: a.verKind },
        motor: { answers: s.motor, notes: motObs, kind: a.motKind },
      };
      ca.games = a.games;
      ca.evaluatorName = evaluatorName.trim();
      ca.evaluatorLicense = evaluatorLicense.trim();
      ca.completedAt = new Date();
      ca.evaluation = { id: activeEvaluation.id } as Evaluation;

      await createAssessment(ca);
      showSuccessToast('CAP generado', `${a.globalLabel} · ${a.activeCount}/${a.totalGames} pruebas habilitadas.`);
      navigation.navigate('SeleccionEjercicios');
    } catch (e) {
      showErrorToast('Error al guardar', 'No se pudo registrar el certificado. Inténtelo de nuevo.');
    }
  };

  /* ------------------------------- render ------------------------------- */
  const verbalGroup = VERBAL_GROUPS[s.ageGroup];

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
          <VStack>
            <HStack alignItems="center" space="sm">
              <Text size="2xl" weight="bold" color="$textLight900">
                Evaluación Clínica Previa
              </Text>
              <Box bg="$primary50" px="$2" py="$0.5" borderRadius="$full">
                <Text size="2xs" weight="bold" color="$primary800" style={{ letterSpacing: 0.4 }}>
                  PRERREQUISITO · CAP
                </Text>
              </Box>
            </HStack>
            <Text size="xs" color="$textLight500">
              {patientName
                ? `${patientName}${patient?.nhc ? ` · NHC ${patient.nhc}` : ''}`
                : 'Certificado de Aptitud para la Prueba · condiciones mínimas de viabilidad'}
            </Text>
          </VStack>

          {/* ----- domain selector ----- */}
          <HStack space="sm">
            {DOMAINS.map(d => {
              const active = activeDomain === d.id;
              const k = kindByDomain[d.id];
              return (
                <Pressable key={d.id} style={{ flex: 1 }} onPress={() => setActiveDomain(d.id)}>
                  <VStack
                    alignItems="center"
                    space="xs"
                    py="$2.5"
                    borderRadius={16}
                    borderWidth={1.5}
                    bg={active ? '$primary50' : '$white'}
                    borderColor={active ? '$primary200' : '$borderLight100'}>
                    <Icon as={d.icon} size="sm" color={active ? '$primary600' : '$textLight400'} />
                    <Text size="2xs" weight="bold" color={active ? '$primary700' : '$textLight500'}>
                      {d.short}
                    </Text>
                    <Box w={7} h={7} borderRadius="$full" bg={KIND_COLOR[k].dot} />
                  </VStack>
                </Pressable>
              );
            })}
          </HStack>

          {/* ===================== OTOSCOPIA ===================== */}
          {activeDomain === 'otoscopia' && (
            <Card bgColor="$white" borderRadius={22} p="$5">
              <HStack alignItems="center" justifyContent="space-between" mb="$1">
                <Text size="lg" weight="bold" color="$textLight900">
                  Otoscopia
                </Text>
                <StatusChip kind={a.otoKind} />
              </HStack>
              <Text size="xs" color="$textLight500" mb="$4">
                Seleccione el hallazgo de cada oído. A realizar por médico/ORL o enfermería con formación en otoscopia.
              </Text>

              {(['od', 'oi'] as const).map(ear => {
                const finding = s[ear];
                const sev = earSeverity(finding);
                const sevKind: DomainKind = sev === 0 ? 'pending' : sev === 1 ? 'ok' : sev === 2 ? 'warn' : 'block';
                return (
                  <VStack key={ear} mb="$4" p="$3.5" borderRadius={16} borderWidth={1} borderColor="$borderLight100" bg="$backgroundLight50">
                    <HStack alignItems="center" justifyContent="space-between" mb="$3">
                      <Text size="sm" weight="semiBold" color="$textLight800">
                        {ear === 'od' ? 'Oído derecho · OD' : 'Oído izquierdo · OI'}
                      </Text>
                      <StatusChip kind={sevKind} />
                    </HStack>
                    <HStack space="xs" flexWrap="wrap" style={{ gap: 7 }}>
                      {FINDING_OPTIONS.map(f => {
                        const selected = finding === f;
                        const fsev = earSeverity(f);
                        const fkind: DomainKind = fsev === 1 ? 'ok' : fsev === 2 ? 'warn' : 'block';
                        const c = KIND_COLOR[fkind];
                        return (
                          <Pressable key={f} onPress={() => setFinding(ear, f)}>
                            <Box px="$3" py="$1.5" borderRadius="$full" borderWidth={1.5} bg={selected ? c.dot : '$white'} borderColor={selected ? c.dot : '$borderLight200'}>
                              <Text size="xs" weight="medium" color={selected ? '$white' : '$textLight600'}>
                                {f}
                              </Text>
                            </Box>
                          </Pressable>
                        );
                      })}
                    </HStack>
                    <Input variant="outline" borderRadius={11} mt="$3" bg="$white">
                      <InputField
                        placeholder="Observaciones libres…"
                        value={ear === 'od' ? s.odNotes : s.oiNotes}
                        onChangeText={t => setS(prev => ({ ...prev, [ear === 'od' ? 'odNotes' : 'oiNotes']: t }))}
                      />
                    </Input>
                  </VStack>
                );
              })}

              <HStack space="sm" alignItems="flex-start" p="$3" borderRadius={14} bg="$primary0">
                <Icon as={Info} size="xs" color="$primary600" style={{ marginTop: 1 }} />
                <Text size="2xs" color="$primary800" style={{ flex: 1, lineHeight: 16 }}>
                  Cerumen oclusivo, OMA y perforación bloquean la audiometría tonal de ese oído. Ref.: protocolo de audiometría
                  pediátrica del SNS · guías CODEPEH.
                </Text>
              </HStack>
            </Card>
          )}

          {/* ===================== VISUAL ===================== */}
          {activeDomain === 'visual' && (
            <Card bgColor="$white" borderRadius={22} p="$5">
              <HStack alignItems="center" justifyContent="space-between" mb="$1">
                <Text size="lg" weight="bold" color="$textLight900">
                  Capacidad visual mínima
                </Text>
                <StatusChip kind={a.visKind} />
              </HStack>
              <Text size="xs" color="$textLight500" mb="$2">
                El niño debe distinguir estímulos de ≥5 cm en pantalla a 30–50 cm. Evaluación funcional mínima, no examen
                oftalmológico.
              </Text>
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
                <Text size="2xs" color="$textLight500" mb="$1.5">
                  Observaciones del dominio
                </Text>
                <Textarea borderRadius={13} bg="$backgroundLight50">
                  <TextareaInput placeholder="Anotaciones del profesional…" value={visObs} onChangeText={setVisObs} />
                </Textarea>
              </Box>
              <Text size="2xs" color="$textLight400" mt="$3" style={{ lineHeight: 15 }}>
                Si V-02 o V-03 son «No» se bloquean las pruebas visuales. No se registran datos de agudeza visual.
              </Text>
            </Card>
          )}

          {/* ===================== VERBAL ===================== */}
          {activeDomain === 'verbal' && (
            <Card bgColor="$white" borderRadius={22} p="$5">
              <HStack alignItems="center" justifyContent="space-between" mb="$1">
                <Text size="lg" weight="bold" color="$textLight900">
                  Capacidad verbal mínima
                </Text>
                <StatusChip kind={a.verKind} />
              </HStack>
              <Text size="xs" color="$textLight500" mb="$3">
                Comprensión de instrucciones sencillas y/o respuesta vocal o gestual. El criterio se adapta al rango de edad.
              </Text>
              <HStack space="sm" alignItems="center" mb="$3" flexWrap="wrap">
                <Text size="2xs" color="$textLight500">
                  Grupo de edad
                </Text>
                {(['A', 'B', 'C'] as AgeGroup[]).map(g => (
                  <Pressable key={g} onPress={() => setAge(g)}>
                    <Box px="$3.5" py="$1" borderRadius="$full" borderWidth={1.5} bg={s.ageGroup === g ? '$primary500' : '$white'} borderColor={s.ageGroup === g ? '$primary500' : '$borderLight200'}>
                      <Text size="sm" weight="bold" color={s.ageGroup === g ? '$white' : '$textLight400'}>
                        {g}
                      </Text>
                    </Box>
                  </Pressable>
                ))}
              </HStack>
              <Text size="2xs" color="$textLight400" mb="$1">
                {verbalGroup.label}
              </Text>
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
                <Text size="2xs" color="$textLight500" mb="$1.5">
                  Observaciones del dominio
                </Text>
                <Textarea borderRadius={13} bg="$backgroundLight50">
                  <TextareaInput placeholder="Anotaciones del profesional…" value={verObs} onChangeText={setVerObs} />
                </Textarea>
              </Box>
              <Text size="2xs" color="$textLight400" mt="$3" style={{ lineHeight: 15 }}>
                Si &lt;50% de los ítems son «Sí», se bloquean las pruebas con producción verbal. La discriminación auditiva pasiva
                permanece activa.
              </Text>
            </Card>
          )}

          {/* ===================== MOTOR ===================== */}
          {activeDomain === 'motor' && (
            <Card bgColor="$white" borderRadius={22} p="$5">
              <HStack alignItems="center" justifyContent="space-between" mb="$1">
                <Text size="lg" weight="bold" color="$textLight900">
                  Capacidad motora mínima
                </Text>
                <StatusChip kind={a.motKind} />
              </HStack>
              <Text size="xs" color="$textLight500" mb="$2">
                El niño debe interactuar con la pantalla táctil con al menos un dedo de forma intencional y reproducible.
              </Text>
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
                <Text size="2xs" color="$textLight500" mb="$1.5">
                  Observaciones del dominio
                </Text>
                <Textarea borderRadius={13} bg="$backgroundLight50">
                  <TextareaInput placeholder="Anotaciones del profesional…" value={motObs} onChangeText={setMotObs} />
                </Textarea>
              </Box>
              <Text size="2xs" color="$textLight400" mt="$3" style={{ lineHeight: 15 }}>
                M-01 «No» bloquea todas las pruebas interactivas. M-03 «No» bloquea solo las pruebas con arrastre.
              </Text>
            </Card>
          )}

          {/* ===================== PERFIL DE APTITUD ===================== */}
          <Card bgColor="$white" borderRadius={22} p="$5">
            <HStack space="sm" alignItems="center" mb="$3">
              <Icon as={ShieldCheck} size="sm" color="$primary500" />
              <Text size="sm" weight="bold" color="$textLight800" style={{ textTransform: 'uppercase', letterSpacing: 0.4 }}>
                Perfil de aptitud
              </Text>
            </HStack>

            {/* global */}
            <VStack p="$4" borderRadius={18} bg={KIND_COLOR[a.globalKind].bg} mb="$4">
              <Text size="2xs" weight="bold" color={KIND_COLOR[a.globalKind].fg} style={{ letterSpacing: 0.4 }}>
                RESULTADO GLOBAL
              </Text>
              <Text size="xl" weight="bold" color={KIND_COLOR[a.globalKind].fg} mt="$0.5">
                {a.globalLabel}
              </Text>
              <Text size="xs" color={KIND_COLOR[a.globalKind].fg} mt="$1" style={{ lineHeight: 17, opacity: 0.95 }}>
                {a.globalDesc}
              </Text>
            </VStack>

            {/* per-domain */}
            <Text size="2xs" weight="bold" color="$textLight400" mb="$1" style={{ letterSpacing: 0.4 }}>
              RESULTADO POR DOMINIO
            </Text>
            {DOMAINS.map(d => {
              const k = kindByDomain[d.id];
              return (
                <HStack key={d.id} alignItems="center" justifyContent="space-between" py="$2" borderBottomWidth={1} borderColor="$borderLight50">
                  <HStack space="sm" alignItems="center">
                    <Box w={8} h={8} borderRadius="$full" bg={KIND_COLOR[k].dot} />
                    <Text size="sm" color="$textLight700">
                      {d.short === 'Otoscopia' ? 'Otoscopia' : `Capacidad ${d.short.toLowerCase()}`}
                    </Text>
                  </HStack>
                  <StatusChip kind={k} />
                </HStack>
              );
            })}

            {/* games */}
            <HStack alignItems="center" justifyContent="space-between" mt="$4" mb="$2">
              <Text size="sm" weight="bold" color="$textLight800">
                Pruebas de la sesión
              </Text>
              <Box bg="$primary50" px="$2.5" py="$0.5" borderRadius="$full">
                <Text size="2xs" weight="bold" color="$primary800">
                  {a.activeCount}/{a.totalGames}
                </Text>
              </Box>
            </HStack>
            <VStack space="xs">
              {a.games.map(g => (
                <HStack key={g.code} space="sm" alignItems="center" p="$2.5" borderRadius={12} bg={g.active ? '$backgroundLight50' : '$error50'}>
                  <Center w={28} h={28} borderRadius={9} bg={g.active ? '$success50' : '$error100'}>
                    <Icon as={g.active ? Check : X} size="xs" color={g.active ? '$success700' : '$error500'} />
                  </Center>
                  <VStack style={{ flex: 1 }}>
                    <HStack space="xs" alignItems="center">
                      <Text size="2xs" color="$textLight400">
                        {g.code}
                      </Text>
                      <Text size="sm" weight="semiBold" color="$textLight800">
                        {g.title}
                      </Text>
                    </HStack>
                    <Text size="2xs" color={g.active ? '$success700' : '$textLight500'}>
                      {g.reason}
                    </Text>
                  </VStack>
                </HStack>
              ))}
            </VStack>
          </Card>

          {/* ===================== EVALUADOR + CONFIRM ===================== */}
          <Card bgColor="$white" borderRadius={22} p="$5">
            <Text size="sm" weight="bold" color="$textLight800" mb="$2">
              Evaluador responsable
            </Text>
            <HStack space="sm" mb="$4">
              <Input variant="outline" borderRadius={12} style={{ flex: 2 }}>
                <InputField placeholder="Nombre" value={evaluatorName} onChangeText={setEvaluatorName} />
              </Input>
              <Input variant="outline" borderRadius={12} style={{ flex: 1 }}>
                <InputField placeholder="Nº Colegiado" value={evaluatorLicense} onChangeText={setEvaluatorLicense} />
              </Input>
            </HStack>
            <Button
              action="primary"
              variant="solid"
              rounded="$full"
              isDisabled={!confirmReady || isSaving}
              isLoading={isSaving}
              onPress={handleSave}>
              <HStack space="sm" alignItems="center">
                <Icon as={ShieldQuestion} size="sm" color="$white" />
                <Text size="md" weight="bold" color="$white">
                  Confirmar y generar CAP
                </Text>
                <Icon as={ArrowRight} size="sm" color="$white" />
              </HStack>
            </Button>
            <Text size="2xs" color="$textLight400" mt="$3" style={{ textAlign: 'center', lineHeight: 15 }}>
              Certifica únicamente las condiciones mínimas de viabilidad de la prueba. No constituye diagnóstico ni informe
              clínico.
            </Text>
          </Card>

          <Box h="$10" />
        </VStack>
      </VStack>
    </Content>
  );
}
