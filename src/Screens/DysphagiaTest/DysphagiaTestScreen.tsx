import React, { useEffect, useMemo, useState } from 'react';
import { Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import {
  Box,
  Card,
  Center,
  HStack,
  Icon,
  Input,
  InputField,
  ScrollView,
  VStack,
} from '@gluestack-ui/themed';
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  Bluetooth,
  BluetoothConnected,
  Check,
  ClipboardCheck,
  Droplet,
  Info,
  ShieldCheck,
} from 'lucide-react-native';

import { Button, Content, Header, Text } from '@/Components/Common';
import RadialBackground from '@/Components/Themed/RadialBackground';
import { finishModule } from '@/Navigators';
import { RootState } from '@/Store';
import { Evaluation } from '@/Models/Evaluation/Evaluation';
import { DysphagiaTest, BolusRecord, DysphagiaVerdict } from '@/Models/DysphagiaTest/DysphagiaTest';
import { useClassSelector } from '@/Helpers/ClassTransformer';
import { useTelemetryTracker } from '@/Telemetry';
import { useCreateDysphagiaMutation } from '@/Services/local/modules/dysphagiaTest';
import { showErrorToast, showSuccessToast } from '@/Helpers/showToast';
import { usePulseOximeter, PulseOximeterState } from './pulseOximeter';

/* -------------------------------------------------------------------------- */
/*  Configuración clínica MECV-V                                               */
/* -------------------------------------------------------------------------- */

type Viscosity = 'nectar' | 'liquido' | 'pudin';

interface BolusConfig {
  id: number;
  viscosity: Viscosity;
  viscosityLabel: string;
  volume: string;
  volumeVal: number;
  nextSafe: number | null;
  nextUnsafe: number | null;
  desc: string;
}

const BOLUS_LIST: BolusConfig[] = [
  { id: 1, viscosity: 'nectar', viscosityLabel: 'Néctar', volume: '5 mL', volumeVal: 5, nextSafe: 2, nextUnsafe: 7, desc: 'Textura intermedia (néctar) · volumen mínimo.' },
  { id: 2, viscosity: 'nectar', viscosityLabel: 'Néctar', volume: '10 mL', volumeVal: 10, nextSafe: 3, nextUnsafe: 7, desc: 'Textura intermedia (néctar) · volumen medio.' },
  { id: 3, viscosity: 'nectar', viscosityLabel: 'Néctar', volume: '20 mL', volumeVal: 20, nextSafe: 4, nextUnsafe: 7, desc: 'Textura intermedia (néctar) · volumen máximo.' },
  { id: 4, viscosity: 'liquido', viscosityLabel: 'Líquido', volume: '5 mL', volumeVal: 5, nextSafe: 5, nextUnsafe: 7, desc: 'Textura agua (líquido) · volumen mínimo.' },
  { id: 5, viscosity: 'liquido', viscosityLabel: 'Líquido', volume: '10 mL', volumeVal: 10, nextSafe: 6, nextUnsafe: 7, desc: 'Textura agua (líquido) · volumen medio.' },
  { id: 6, viscosity: 'liquido', viscosityLabel: 'Líquido', volume: '20 mL', volumeVal: 20, nextSafe: 7, nextUnsafe: 7, desc: 'Textura agua (líquido) · volumen máximo.' },
  { id: 7, viscosity: 'pudin', viscosityLabel: 'Pudin', volume: '5 mL', volumeVal: 5, nextSafe: 8, nextUnsafe: null, desc: 'Textura máxima densidad (pudin) · volumen mínimo.' },
  { id: 8, viscosity: 'pudin', viscosityLabel: 'Pudin', volume: '10 mL', volumeVal: 10, nextSafe: 9, nextUnsafe: null, desc: 'Textura máxima densidad (pudin) · volumen medio.' },
  { id: 9, viscosity: 'pudin', viscosityLabel: 'Pudin', volume: '20 mL', volumeVal: 20, nextSafe: null, nextUnsafe: null, desc: 'Textura máxima densidad (pudin) · volumen máximo.' },
];

const MIN_SPO2_DROP = 3;

interface BoloState {
  evaluated: boolean;
  skipped: boolean;
  spo2: number | null;
  safety: { tos: boolean; cambio_voz: boolean };
  efficacy: { sello_labial: boolean; residuo: boolean; deglucion_fraccionada: boolean };
}

const emptyBoloState = (): BoloState => ({
  evaluated: false,
  skipped: false,
  spo2: null,
  safety: { tos: false, cambio_voz: false },
  efficacy: { sello_labial: false, residuo: false, deglucion_fraccionada: false },
});

const VISC_CHIP: Record<Viscosity, { bg: string; color: string }> = {
  nectar: { bg: '$primary50', color: '$primary700' },
  liquido: { bg: '$info100', color: '$info700' },
  pudin: { bg: '$purple100', color: '$purple700' },
};

type NodeKind = 'pending' | 'active' | 'safe' | 'efficacy-fail' | 'safety-fail' | 'skipped';

const NODE_COLOR: Record<NodeKind, { bg: string; fg: string }> = {
  pending: { bg: '$backgroundLight100', fg: '$textLight400' },
  active: { bg: '$primary50', fg: '$primary600' },
  safe: { bg: '$success600', fg: '$white' },
  'efficacy-fail': { bg: '$warning500', fg: '$white' },
  'safety-fail': { bg: '$error500', fg: '$white' },
  skipped: { bg: '$backgroundLight200', fg: '$textLight400' },
};

const SETUP_ITEMS = [
  'Paciente sentado erecto (90°) con soporte cefálico si procede.',
  'Pulsioxímetro colocado y con señal estable.',
  'Jeringas dosificadoras y texturas preparadas con espesante.',
  'Equipo de aspiración disponible en sala.',
];

const SAFETY_META = [
  { key: 'tos', label: 'Tos (espontánea / provocada)' },
  { key: 'cambio_voz', label: 'Cambio de voz (fonación húmeda)' },
] as const;

const EFFICACY_META = [
  { key: 'sello_labial', label: 'Sello labial incompetente (babeo)' },
  { key: 'residuo', label: 'Residuos orales o faríngeos' },
  { key: 'deglucion_fraccionada', label: 'Deglución fraccionada' },
] as const;

/* -------------------------------------------------------------------------- */
/*  Subcomponentes UI                                                          */
/* -------------------------------------------------------------------------- */

const ViscChip = ({ visc, label }: { visc: Viscosity; label: string }) => {
  const c = VISC_CHIP[visc];
  return (
    <Box bg={c.bg} px="$2" py="$0.5" borderRadius="$full">
      <Text size="2xs" weight="bold" color={c.color} style={{ textTransform: 'uppercase', letterSpacing: 0.4 }}>
        {label}
      </Text>
    </Box>
  );
};

const AlterationRow = ({
  label,
  active,
  kind,
  onPress,
}: {
  label: string;
  active: boolean;
  kind: 'safety' | 'efficacy';
  onPress: () => void;
}) => {
  const accent = kind === 'safety' ? '$error500' : '$warning700';
  const softBg = kind === 'safety' ? '$error50' : '$warning50';
  return (
    <Pressable onPress={onPress}>
      <HStack
        alignItems="center"
        justifyContent="space-between"
        px="$3"
        py="$2.5"
        borderRadius={12}
        borderWidth={1.5}
        borderColor={active ? accent : '$borderLight100'}
        bg={active ? softBg : '$white'}>
        <Text size="md" weight="semiBold" color="$textLight900" style={{ flex: 1, marginRight: 10 }}>
          {label}
        </Text>
        <Center
          w={20}
          h={20}
          borderRadius="$full"
          borderWidth={2}
          borderColor={active ? accent : '$borderLight300'}
          bg={active ? accent : '$white'}>
          {active ? <Icon as={Check} size="2xs" color="$white" /> : null}
        </Center>
      </HStack>
    </Pressable>
  );
};

const MapStepper = ({
  states,
  currentId,
  view,
  basalSpO2,
}: {
  states: Record<number, BoloState>;
  currentId: number;
  view: 'setup' | 'bolo' | 'report';
  basalSpO2: number;
}) => (
  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
    <HStack space="xs" alignItems="center" py="$1">
      {BOLUS_LIST.map(b => {
        const s = states[b.id];
        let kind: NodeKind = 'pending';
        if (view === 'bolo' && b.id === currentId) kind = 'active';
        else if (s.evaluated) {
          const d = deriveBolo(s, basalSpO2);
          kind = d.hasSafety ? 'safety-fail' : d.hasEfficacy ? 'efficacy-fail' : 'safe';
        } else if (s.skipped) kind = 'skipped';
        const c = NODE_COLOR[kind];
        return (
          <Center key={b.id} w={30} h={30} borderRadius="$full" bg={c.bg}>
            <Text size="2xs" weight="bold" color={c.fg}>
              {b.id}
            </Text>
          </Center>
        );
      })}
    </HStack>
  </ScrollView>
);

/* -------------------------------------------------------------------------- */
/*  Lógica clínica                                                             */
/* -------------------------------------------------------------------------- */

function deriveBolo(s: BoloState, basalSpO2: number) {
  const eff = s.spo2 == null ? basalSpO2 : s.spo2;
  const desat = basalSpO2 - eff >= MIN_SPO2_DROP;
  const hasSafety = s.safety.tos || s.safety.cambio_voz || desat;
  const hasEfficacy = s.efficacy.sello_labial || s.efficacy.residuo || s.efficacy.deglucion_fraccionada;
  return { eff, desat, hasSafety, hasEfficacy };
}

/* Fila de lectura en vivo del pulsioxímetro (BLE o demo) + botón Capturar. */
const OximeterRow = ({ ox, onCapture }: { ox: PulseOximeterState; onCapture: () => void }) => (
  <HStack alignItems="center" justifyContent="space-between" mt="$3" p="$2.5" borderRadius={12} bg={ox.connected ? '$success50' : '$backgroundLight100'}>
    <HStack space="sm" alignItems="center" style={{ flex: 1 }}>
      <Icon as={ox.connected ? BluetoothConnected : Bluetooth} size="sm" color={ox.connected ? '$success600' : '$textLight400'} />
      <VStack>
        <Text size="2xs" weight="semiBold" color="$textLight700">
          {ox.connected ? 'Pulsioxímetro BLE' : 'Sensor demo (sin BLE)'}
        </Text>
        <Text size="2xs" color="$textLight500">
          {ox.spo2 != null ? `${ox.spo2}% SpO₂${ox.hr != null ? ` · ${ox.hr} lpm` : ''}` : 'Sin lectura'}
        </Text>
      </VStack>
    </HStack>
    <Pressable onPress={onCapture}>
      <Box bg="$primary500" px="$3" py="$1.5" borderRadius="$full">
        <Text size="2xs" weight="bold" color="$white">
          Capturar
        </Text>
      </Box>
    </Pressable>
  </HStack>
);

/* -------------------------------------------------------------------------- */
/*  Pantalla principal                                                         */
/* -------------------------------------------------------------------------- */

export default function DysphagiaTestScreen() {
  const navigation = useNavigation();

  const activeEvaluation = useClassSelector(Evaluation, (state: RootState) => state.activeEvaluation.evaluation);
  const [createDysphagia, { isLoading: isSaving }] = useCreateDysphagiaMutation();
  const ox = usePulseOximeter(true);
  const tracker = useTelemetryTracker(); // telemetría silenciosa (useRef, sin re-render)
  const [spo2Source, setSpo2Source] = useState<'manual' | 'demo' | 'ble'>('manual');

  const [view, setView] = useState<'setup' | 'bolo' | 'report'>('setup');
  const [basalSpO2, setBasalSpO2] = useState<number>(98);
  const [currentIdx, setCurrentIdx] = useState<number>(0);
  const [evaluatorName, setEvaluatorName] = useState<string>(activeEvaluation?.professional?.name ?? '');
  const [evaluatorLicense, setEvaluatorLicense] = useState<string>(activeEvaluation?.professional?.licenseNumber ?? '');
  const [setup, setSetup] = useState<boolean[]>([false, false, false, false]);
  const [boloStates, setBoloStates] = useState<Record<number, BoloState>>(() => {
    const o: Record<number, BoloState> = {};
    BOLUS_LIST.forEach(b => (o[b.id] = emptyBoloState()));
    return o;
  });

  const activeBolo = BOLUS_LIST[currentIdx];
  const activeState = boloStates[activeBolo.id];
  const setupReady = setup.every(Boolean);

  // Telemetría: cada bolo del MECV-V (viscosidad × volumen) es un reactivo;
  // abre su ventana de tiempo al presentarse durante la serie.
  useEffect(() => {
    if (view === 'bolo') tracker.enterReactivo(`dis-${activeBolo.id}`);
  }, [view, activeBolo.id, tracker]);

  /* ----------------------------- handlers ------------------------------- */

  const toggleSetup = (i: number) =>
    setSetup(prev => prev.map((v, idx) => (idx === i ? !v : v)));

  const handleStart = () => {
    if (!setupReady) return;
    setView('bolo');
    setCurrentIdx(0);
  };

  const toggleOption = (group: 'safety' | 'efficacy', key: string) => {
    setBoloStates(prev => {
      const cur = prev[activeBolo.id];
      return {
        ...prev,
        [activeBolo.id]: {
          ...cur,
          [group]: { ...cur[group], [key]: !(cur[group] as Record<string, boolean>)[key] },
        },
      };
    });
  };

  const handleSpO2Change = (raw: string) => {
    const n = parseInt(raw, 10);
    if (isNaN(n) || n < 50 || n > 100) return;
    setSpo2Source('manual');
    setBoloStates(prev => ({
      ...prev,
      [activeBolo.id]: { ...prev[activeBolo.id], spo2: n },
    }));
  };

  /* Captura la lectura en vivo del pulsioxímetro (BLE o demo). */
  const captureBasal = () => {
    if (ox.spo2 == null) return;
    setBasalSpO2(ox.spo2);
    setSpo2Source(ox.source);
  };
  const captureBolo = () => {
    if (ox.spo2 == null) return;
    const v = ox.spo2;
    setSpo2Source(ox.source);
    setBoloStates(prev => ({
      ...prev,
      [activeBolo.id]: { ...prev[activeBolo.id], spo2: v },
    }));
  };

  const handleNext = () => {
    // Telemetría: cierra el reactivo del bolo al finalizarlo y avanzar.
    tracker.classifyReactivo(`dis-${activeBolo.id}`);
    const isUnsafe = deriveBolo(activeState, basalSpO2).hasSafety;
    const nextId = isUnsafe ? activeBolo.nextUnsafe : activeBolo.nextSafe;

    setBoloStates(prev => {
      const updated = { ...prev };
      updated[activeBolo.id] = {
        ...updated[activeBolo.id],
        evaluated: true,
        skipped: false,
        spo2: updated[activeBolo.id].spo2 ?? basalSpO2,
      };
      if (nextId !== null) {
        for (let i = activeBolo.id + 1; i < nextId; i++) {
          updated[i] = { ...emptyBoloState(), skipped: true };
        }
        if (updated[nextId].spo2 === null) {
          updated[nextId] = { ...updated[nextId], spo2: basalSpO2, skipped: false };
        }
      } else {
        for (let i = activeBolo.id + 1; i <= 9; i++) {
          updated[i] = { ...emptyBoloState(), skipped: true };
        }
      }
      return updated;
    });

    if (nextId !== null) {
      setCurrentIdx(BOLUS_LIST.findIndex(x => x.id === nextId));
    } else {
      setView('report');
    }
  };

  const handlePrev = () => {
    if (view === 'report') {
      let last = 1;
      for (let i = 1; i <= 9; i++) if (boloStates[i].evaluated) last = i;
      setCurrentIdx(BOLUS_LIST.findIndex(x => x.id === last));
      setView('bolo');
      return;
    }
    let prevId: number | null = null;
    for (let i = activeBolo.id - 1; i >= 1; i--) {
      if (boloStates[i].evaluated) {
        prevId = i;
        break;
      }
    }
    if (prevId !== null) {
      const pid = prevId;
      setBoloStates(prev => {
        const updated = { ...prev };
        for (let i = pid + 1; i <= activeBolo.id; i++) {
          updated[i] = { ...updated[i], skipped: false };
          if (i === activeBolo.id) updated[i] = { ...updated[i], evaluated: false };
        }
        return updated;
      });
      setCurrentIdx(BOLUS_LIST.findIndex(x => x.id === pid));
    } else {
      setView('setup');
    }
  };

  /* ---------------------------- análisis -------------------------------- */

  const analysis = useMemo(() => {
    let hasSafetyAlt = false;
    let hasEfficacyAlt = false;
    let minSpO2 = basalSpO2;
    let maxDrop = 0;
    let nSafe = 0,
      lSafe = 0,
      pSafe = 0;
    let nBad = false,
      lBad = false,
      pBad = false;

    for (let i = 1; i <= 9; i++) {
      const s = boloStates[i];
      if (!s.evaluated) continue;
      const cfg = BOLUS_LIST[i - 1];
      const d = deriveBolo(s, basalSpO2);
      if (d.hasSafety) hasSafetyAlt = true;
      if (d.hasEfficacy) hasEfficacyAlt = true;
      minSpO2 = Math.min(minSpO2, d.eff);
      maxDrop = Math.max(maxDrop, basalSpO2 - d.eff);
      const safe = !d.hasSafety;
      if (cfg.viscosity === 'nectar') {
        if (!safe) nBad = true;
        else if (!nBad) nSafe = Math.max(nSafe, cfg.volumeVal);
      } else if (cfg.viscosity === 'liquido') {
        if (!safe) lBad = true;
        else if (!lBad) lSafe = Math.max(lSafe, cfg.volumeVal);
      } else {
        if (!safe) pBad = true;
        else if (!pBad) pSafe = Math.max(pSafe, cfg.volumeVal);
      }
    }

    let recom = 'Suspender vía oral (nutrición alternativa)';
    if (lSafe >= 5 && !lBad && !nBad) recom = `Líquido ${lSafe} mL`;
    else if (nSafe >= 5 && !nBad) recom = `Néctar ${nSafe} mL`;
    else if (pSafe >= 5 && !pBad) recom = `Pudin ${pSafe} mL`;

    return { hasSafetyAlt, hasEfficacyAlt, minSpO2, maxDrop, recom };
  }, [boloStates, basalSpO2]);

  /* derived for active bolo (live) */
  const liveDerive = deriveBolo(activeState, basalSpO2);
  const liveSpO2 = activeState.spo2 ?? basalSpO2;

  const repBad = analysis.hasSafetyAlt;
  const repWarn = !analysis.hasSafetyAlt && analysis.hasEfficacyAlt;
  const bannerBg = repBad ? '$error50' : repWarn ? '$warning50' : '$success50';
  const bannerBorder = repBad ? '$error300' : repWarn ? '$warning300' : '$success300';
  const bannerFg = repBad ? '$error700' : repWarn ? '$warning800' : '$success700';
  const reportTitle = repBad
    ? 'Disfagia · alteración de seguridad'
    : repWarn
      ? 'Disfagia · alteración de eficacia'
      : 'Exploración negativa · sin disfagia';

  const handleSave = async () => {
    if (isSaving) return;
    if (!evaluatorName.trim() || !evaluatorLicense.trim()) return;
    if (!activeEvaluation) {
      showErrorToast('No se puede guardar', 'No hay una evaluación activa asociada al paciente.');
      return;
    }
    try {
      const verdict: DysphagiaVerdict = analysis.hasSafetyAlt
        ? 'safety'
        : analysis.hasEfficacyAlt
          ? 'efficacy'
          : 'safe';
      const bolus: BolusRecord[] = BOLUS_LIST.map(cfg => {
        const s = boloStates[cfg.id];
        return {
          id: cfg.id,
          viscosity: cfg.viscosity,
          volume: cfg.volumeVal,
          evaluated: s.evaluated,
          skipped: s.skipped,
          spo2: s.spo2,
          safety: { ...s.safety },
          efficacy: { ...s.efficacy },
        };
      });
      const interpretation =
        verdict === 'safety'
          ? `Alteración de la seguridad de la deglución (tos, cambio de voz o desaturación ≥3 % vs basal). SpO₂ mínima ${analysis.minSpO2}% (caída máx. −${analysis.maxDrop}%). Recomendación: ${analysis.recom}.`
          : verdict === 'efficacy'
            ? `Alteración de la eficacia de la deglución (sello labial, residuo o deglución fraccionada) sin signos de riesgo de seguridad. Recomendación: ${analysis.recom}.`
            : `Exploración MECV-V sin signos de alteración de seguridad ni eficacia. Recomendación: ${analysis.recom}.`;

      const item = new DysphagiaTest();
      item.basalSpO2 = basalSpO2;
      item.spo2Source = spo2Source;
      item.bolus = bolus;
      item.safetyAltered = analysis.hasSafetyAlt;
      item.efficacyAltered = analysis.hasEfficacyAlt;
      item.minSpO2 = analysis.minSpO2;
      item.maxDrop = analysis.maxDrop;
      item.recommendation = analysis.recom;
      item.verdict = verdict;
      item.interpretation = interpretation;
      item.notes = '';
      item.evaluatorName = evaluatorName.trim();
      item.evaluatorLicense = evaluatorLicense.trim();
      item.completedAt = new Date();
      item.evaluation = { id: activeEvaluation.id } as Evaluation;

      await createDysphagia(item);
      showSuccessToast('Exploración guardada', `${reportTitle} · ${analysis.recom}.`);
      // Aterriza en los resultados, no de vuelta al hub (ver finishModule).
      finishModule(navigation);
    } catch {
      showErrorToast('Error al guardar', 'No se pudo registrar la exploración. Inténtelo de nuevo.');
    }
  };

  /* ------------------------------- render ------------------------------- */

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

        {/* La exploración (pulsioximetría + texturas + seguridad) supera la
            altura de pantalla: sin scroll vertical es inutilizable. */}
        <ScrollView showsVerticalScrollIndicator={false}>
        <VStack flex={1} px="$6" mt="$2" space="md">
          {/* ----- title ----- */}
          <VStack>
            <HStack alignItems="center" space="sm">
              <Text size="2xl" weight="bold" color="$textLight900">
                Disfagia MECV-V
              </Text>
              <Box bg="$primary50" px="$2" py="$0.5" borderRadius="$full">
                <Text size="2xs" weight="bold" color="$primary800" style={{ letterSpacing: 0.4 }}>
                  MÉTODO CLÍNICO
                </Text>
              </Box>
            </HStack>
            <Text size="xs" color="$textLight500">
              Volumen-Viscosidad · cribado de disfagia orofaríngea
            </Text>
          </VStack>

          {/* =====================  SETUP  ===================== */}
          {view === 'setup' && (
            <VStack space="md">
              <Card bgColor="$white" borderRadius={22} p="$5">
                <Text size="lg" weight="bold" color="$textLight900">
                  Preparación de la exploración
                </Text>
                <Text size="sm" color="$textLight600" mt="$1">
                  Evalúa la deglución ante texturas néctar, líquido y pudin en volúmenes crecientes (5 · 10 · 20 mL),
                  monitorizando la saturación de oxígeno de forma continua.
                </Text>

                <HStack alignItems="center" space="sm" mt="$5" mb="$3">
                  <Icon as={ShieldCheck} size="sm" color="$primary500" />
                  <Text size="sm" weight="bold" color="$textLight800" style={{ textTransform: 'uppercase', letterSpacing: 0.4 }}>
                    Requisitos previos de seguridad
                  </Text>
                </HStack>

                <VStack space="sm">
                  {SETUP_ITEMS.map((label, i) => (
                    <Pressable key={i} onPress={() => toggleSetup(i)}>
                      <HStack space="sm" alignItems="flex-start">
                        <Center
                          mt="$0.5"
                          w={20}
                          h={20}
                          borderRadius={6}
                          borderWidth={1.5}
                          borderColor={setup[i] ? '$primary500' : '$borderLight300'}
                          bg={setup[i] ? '$primary500' : '$white'}>
                          {setup[i] ? <Icon as={Check} size="2xs" color="$white" /> : null}
                        </Center>
                        <Text size="sm" color="$textLight700" style={{ flex: 1 }}>
                          {label}
                        </Text>
                      </HStack>
                    </Pressable>
                  ))}
                </VStack>
              </Card>

              <Card bgColor="$white" borderRadius={22} p="$5">
                <HStack alignItems="center" justifyContent="space-between">
                  <VStack style={{ flex: 1 }}>
                    <Text size="sm" weight="semiBold" color="$textLight800">
                      Saturación basal (SpO₂)
                    </Text>
                    <Text size="2xs" color="$textLight500">
                      Lectura estable antes del primer bolo
                    </Text>
                  </VStack>
                  <Input variant="outline" w={96} borderRadius={12}>
                    <InputField
                      keyboardType="numeric"
                      textAlign="center"
                      value={String(basalSpO2)}
                      onChangeText={t => { setSpo2Source('manual'); setBasalSpO2(parseInt(t, 10) || 98); }}
                    />
                  </Input>
                </HStack>
                <OximeterRow ox={ox} onCapture={captureBasal} />
              </Card>

              <Button
                action="primary"
                variant="solid"
                rounded="$full"
                isDisabled={!setupReady}
                onPress={handleStart}>
                <HStack space="sm" alignItems="center">
                  <Text size="md" weight="bold" color="$white">
                    Iniciar exploración
                  </Text>
                  <Icon as={ArrowRight} size="sm" color="$white" />
                </HStack>
              </Button>
            </VStack>
          )}

          {/* =====================  BOLO  ===================== */}
          {view === 'bolo' && (
            <VStack space="md">
              <Card bgColor="$white" borderRadius={22} p="$5">
                <MapStepper states={boloStates} currentId={activeBolo.id} view={view} basalSpO2={basalSpO2} />

                <HStack alignItems="center" justifyContent="space-between" mt="$4">
                  <HStack space="sm" alignItems="center" style={{ flex: 1 }}>
                    <Center w={48} h={48} borderRadius={14} bg={VISC_CHIP[activeBolo.viscosity].bg}>
                      <Icon as={Droplet} size="lg" color={VISC_CHIP[activeBolo.viscosity].color} />
                    </Center>
                    <VStack style={{ flex: 1 }}>
                      <Text size="lg" weight="bold" color="$textLight900">
                        Bolo {activeBolo.id} · {activeBolo.viscosityLabel} {activeBolo.volume}
                      </Text>
                      <Text size="2xs" color="$textLight500">
                        {activeBolo.desc}
                      </Text>
                    </VStack>
                  </HStack>
                  <Box bg="$primary50" px="$2.5" py="$1" borderRadius="$full">
                    <Text size="2xs" weight="bold" color="$primary800">
                      {activeBolo.id}/9
                    </Text>
                  </Box>
                </HStack>

                <HStack space="sm" alignItems="flex-start" mt="$4" p="$3" borderRadius={14} bg="$primary0">
                  <Icon as={Info} size="sm" color="$primary600" style={{ marginTop: 1 }} />
                  <Text size="xs" color="$primary800" style={{ flex: 1, lineHeight: 18 }}>
                    Pida al paciente que retenga el bolo antes de tragar; tras la deglución, que abra la boca para
                    verificar residuos y que repita su nombre para detectar fonación húmeda.
                  </Text>
                </HStack>
              </Card>

              {/* Seguridad */}
              <Card bgColor="$white" borderRadius={22} p="$5">
                <HStack alignItems="center" justifyContent="space-between" mb="$3">
                  <Text size="sm" weight="bold" color="$error500" style={{ textTransform: 'uppercase', letterSpacing: 0.4 }}>
                    Seguridad
                  </Text>
                  <Text size="2xs" color="$textLight400">
                    Riesgo crítico
                  </Text>
                </HStack>
                <VStack space="sm">
                  {SAFETY_META.map(o => (
                    <AlterationRow
                      key={o.key}
                      label={o.label}
                      kind="safety"
                      active={(activeState.safety as Record<string, boolean>)[o.key]}
                      onPress={() => toggleOption('safety', o.key)}
                    />
                  ))}
                  {/* Desaturación derivada (solo lectura) */}
                  <HStack
                    alignItems="center"
                    justifyContent="space-between"
                    px="$3"
                    py="$2.5"
                    borderRadius={12}
                    borderWidth={1.5}
                    borderColor={liveDerive.desat ? '$error500' : '$borderLight100'}
                    bg={liveDerive.desat ? '$error50' : '$white'}>
                    <Text size="sm" weight="semiBold" color="$textLight800">
                      Desaturación SpO₂ (≥3%)
                    </Text>
                    <Text size="2xs" weight="bold" color={liveDerive.desat ? '$error500' : '$textLight400'}>
                      {liveDerive.desat ? 'Detectada' : 'No'}
                    </Text>
                  </HStack>
                </VStack>

                {/* SpO2 post-deglución */}
                <HStack alignItems="center" justifyContent="space-between" mt="$4" p="$3" borderRadius={14} bg="$backgroundLight50">
                  <HStack space="sm" alignItems="center" style={{ flex: 1 }}>
                    <Center w={40} h={40} borderRadius={12} bg="$error50">
                      <Icon as={Activity} size="md" color="$error500" />
                    </Center>
                    <VStack style={{ flex: 1 }}>
                      <Text size="sm" weight="semiBold" color="$textLight800">
                        SpO₂ tras la deglución
                      </Text>
                      <Text size="2xs" color={liveDerive.desat ? '$error500' : '$textLight500'}>
                        Dif {basalSpO2 - liveSpO2 > 0 ? `−${basalSpO2 - liveSpO2}` : 0}% vs basal
                      </Text>
                    </VStack>
                  </HStack>
                  <Input variant="outline" w={86} borderRadius={12}>
                    <InputField
                      keyboardType="numeric"
                      textAlign="center"
                      value={String(liveSpO2)}
                      onChangeText={handleSpO2Change}
                    />
                  </Input>
                </HStack>
                <OximeterRow ox={ox} onCapture={captureBolo} />
              </Card>

              {/* Eficacia */}
              <Card bgColor="$white" borderRadius={22} p="$5">
                <HStack alignItems="center" justifyContent="space-between" mb="$3">
                  <Text size="sm" weight="bold" color="$warning700" style={{ textTransform: 'uppercase', letterSpacing: 0.4 }}>
                    Eficacia
                  </Text>
                  <Text size="2xs" color="$textLight400">
                    Nutrición
                  </Text>
                </HStack>
                <VStack space="sm">
                  {EFFICACY_META.map(o => (
                    <AlterationRow
                      key={o.key}
                      label={o.label}
                      kind="efficacy"
                      active={(activeState.efficacy as Record<string, boolean>)[o.key]}
                      onPress={() => toggleOption('efficacy', o.key)}
                    />
                  ))}
                </VStack>
              </Card>

              <HStack space="md" justifyContent="space-between">
                <Button action="secondary" variant="outline" rounded="$full" onPress={handlePrev}>
                  <HStack space="sm" alignItems="center">
                    <Icon as={ArrowLeft} size="sm" color="$primary500" />
                    <Text size="sm" weight="bold" color="$primary500">
                      Anterior
                    </Text>
                  </HStack>
                </Button>
                <Button action="primary" variant="solid" rounded="$full" style={{ flex: 1 }} onPress={handleNext}>
                  <HStack space="sm" alignItems="center">
                    <Text size="sm" weight="bold" color="$white">
                      {activeBolo.nextSafe === null && activeBolo.nextUnsafe === null ? 'Finalizar' : 'Registrar y continuar'}
                    </Text>
                    <Icon as={ArrowRight} size="sm" color="$white" />
                  </HStack>
                </Button>
              </HStack>
            </VStack>
          )}

          {/* =====================  REPORT  ===================== */}
          {view === 'report' && (
            <VStack space="md">
              <Card bgColor={bannerBg} borderColor={bannerBorder} borderWidth={1} borderRadius={20} p="$5">
                <Text size="lg" weight="bold" color={bannerFg}>
                  {reportTitle}
                </Text>
                <Text size="sm" color={bannerFg} mt="$1">
                  Dieta recomendada: <Text weight="bold" color={bannerFg}>{analysis.recom}</Text>
                </Text>
                <Text size="2xs" color="$textLight500" mt="$2">
                  Basal {basalSpO2}% · mínima {analysis.minSpO2}% · caída máx −{analysis.maxDrop}%
                </Text>
              </Card>

              <Card bgColor="$white" borderRadius={20} p="$5">
                <Text size="sm" weight="bold" color="$textLight700" mb="$3" style={{ textTransform: 'uppercase', letterSpacing: 0.4 }}>
                  Detalle por bolo
                </Text>
                <VStack space="xs">
                  {BOLUS_LIST.map(b => {
                    const s = boloStates[b.id];
                    let dotKind: NodeKind = 'pending';
                    let statusText = 'Pendiente';
                    if (s.evaluated) {
                      const d = deriveBolo(s, basalSpO2);
                      dotKind = d.hasSafety ? 'safety-fail' : d.hasEfficacy ? 'efficacy-fail' : 'safe';
                      statusText = d.hasSafety ? 'Fallo seguridad' : d.hasEfficacy ? 'Fallo eficacia' : 'Segura';
                    } else if (s.skipped) {
                      dotKind = 'skipped';
                      statusText = 'Omitido';
                    }
                    const dot = NODE_COLOR[dotKind];
                    return (
                      <HStack key={b.id} alignItems="center" justifyContent="space-between" py="$2" borderBottomWidth={1} borderColor="$borderLight50">
                        <HStack space="sm" alignItems="center" style={{ flex: 1 }}>
                          <Center w={26} h={26} borderRadius="$full" bg={dot.bg}>
                            <Text size="2xs" weight="bold" color={dot.fg}>
                              {b.id}
                            </Text>
                          </Center>
                          <ViscChip visc={b.viscosity} label={b.viscosityLabel} />
                          <Text size="2xs" color="$textLight500">
                            {b.volume}
                          </Text>
                        </HStack>
                        <Text size="2xs" weight="semiBold" color="$textLight700">
                          {s.evaluated ? `${deriveBolo(s, basalSpO2).eff}% · ${statusText}` : statusText}
                        </Text>
                      </HStack>
                    );
                  })}
                </VStack>
              </Card>

              <Card bgColor="$white" borderRadius={20} p="$5">
                <Text size="sm" weight="bold" color="$textLight700" mb="$2">
                  Evaluador responsable
                </Text>
                <HStack space="sm">
                  <Input variant="outline" borderRadius={12} style={{ flex: 2 }}>
                    <InputField placeholder="Nombre" value={evaluatorName} onChangeText={setEvaluatorName} />
                  </Input>
                  <Input variant="outline" borderRadius={12} style={{ flex: 1 }}>
                    <InputField placeholder="Colegiado" value={evaluatorLicense} onChangeText={setEvaluatorLicense} />
                  </Input>
                </HStack>
              </Card>

              <HStack space="md" justifyContent="space-between">
                <Button action="secondary" variant="outline" rounded="$full" onPress={handlePrev}>
                  <HStack space="sm" alignItems="center">
                    <Icon as={ArrowLeft} size="sm" color="$primary500" />
                    <Text size="sm" weight="bold" color="$primary500">
                      Modificar
                    </Text>
                  </HStack>
                </Button>
                <Button
                  action="primary"
                  variant="solid"
                  rounded="$full"
                  style={{ flex: 1 }}
                  isDisabled={!evaluatorName.trim() || !evaluatorLicense.trim() || isSaving}
                  onPress={handleSave}>
                  <HStack space="sm" alignItems="center">
                    <Icon as={ClipboardCheck} size="sm" color="$white" />
                    <Text size="sm" weight="bold" color="$white">
                      Confirmar y guardar
                    </Text>
                  </HStack>
                </Button>
              </HStack>
            </VStack>
          )}

          <Box h="$10" />
        </VStack>
        </ScrollView>
      </VStack>
    </Content>
  );
}
