import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import Svg, { Circle } from 'react-native-svg';
import { Box, Card, Center, HStack, Icon, Input, InputField, VStack } from '@gluestack-ui/themed';
import { AlertTriangle, ArrowRight, Check, Mic, Square } from 'lucide-react-native';

import { Button, Content, Header, Text } from '@/Components/Common';
import RadialBackground from '@/Components/Themed/RadialBackground';
import { RootStackParamList } from '@/Navigators';
import { RootState } from '@/Store';
import { Evaluation } from '@/Models/Evaluation/Evaluation';
import { useClassSelector } from '@/Helpers/ClassTransformer';
import { NoiseVerdict, NoiseZone, useNoiseMeter, zoneOf } from './useNoiseMeter';
import { registerNoiseMicAdapter, unregisterNoiseMicAdapter } from './noiseMicAdapter';
import { loadNoiseCalibration, saveNoiseCalibration } from './noiseCalibrationStore';
import {
  getNoiseCalibrationOffset,
  NOISE_OFFSET_LIMIT_DB,
  offsetForReference,
  splFraction,
} from './noiseDsp';

/* -------------------------------------------------------------------------- */
/*  Constantes                                                                 */
/* -------------------------------------------------------------------------- */

const RING_SIZE = 260;
const RING_R = 112;
const RING_C = 2 * Math.PI * RING_R;
const BRAND = '#FF7F00';

const ZONE_HEX: Record<NoiseZone, string> = { ok: '#1E8049', warn: '#E0760C', block: '#E63535' };
const ZONE_LABEL: Record<NoiseZone, string> = {
  ok: 'SILENCIO ADECUADO',
  warn: 'RUIDO MODERADO',
  block: 'RUIDO ALTO',
};

const KIND_TOKENS: Record<'ok' | 'warn' | 'block' | 'pending', { fg: string; bg: string }> = {
  ok: { fg: '$success700', bg: '$success50' },
  warn: { fg: '$warning800', bg: '$warning50' },
  block: { fg: '$error700', bg: '$error50' },
  pending: { fg: '$textLight500', bg: '$backgroundLight100' },
};

const CHECKLIST: { id: string; label: string }[] = [
  { id: 'c1', label: 'Puertas y ventanas cerradas' },
  { id: 'c2', label: 'Sin conversaciones ni personas ajenas a la prueba' },
  { id: 'c3', label: 'Climatización, ventiladores y equipos ruidosos apagados' },
  { id: 'c4', label: 'Móviles y notificaciones silenciados' },
];

const VERDICT_COPY: Record<NoiseVerdict, { title: string; desc: string; kind: 'ok' | 'warn' | 'block' | 'pending' }> = {
  pending: {
    title: 'PENDIENTE',
    desc: 'Active el micrófono y ejecute la prueba de ruido para verificar la sala.',
    kind: 'pending',
  },
  ok: { title: 'SALA APTA', desc: 'El ruido de fondo está dentro del límite. Puede iniciar los ejercicios.', kind: 'ok' },
  warn: { title: 'RUIDO LIMÍTROFE', desc: 'El nivel está cerca del umbral. Reduzca el ruido y vuelva a medir.', kind: 'warn' },
  block: {
    title: 'DEMASIADO RUIDO',
    desc: 'El ruido de fondo invalidaría las pruebas auditivas. Acondicione la sala y repita.',
    kind: 'block',
  },
};

/* -------------------------------------------------------------------------- */
/*  Props de la pantalla                                                        */
/* -------------------------------------------------------------------------- */

interface ScreenConfig {
  /** Umbral de ruido apto en dB (por defecto 45). */
  threshold?: number;
  /** Duración de la medición en segundos (por defecto 5). */
  testDurationSec?: number;
}

type Props = NativeStackScreenProps<RootStackParamList, 'RoomNoiseCheck'>;

export default function RoomNoiseCheckScreen({ navigation, route }: Props) {
  const cfg = (route.params as ScreenConfig | undefined) ?? {};
  const threshold = cfg.threshold ?? 45;
  const testDurationSec = cfg.testDurationSec ?? 5;

  const activeEvaluation = useClassSelector(Evaluation, (state: RootState) => state.activeEvaluation.evaluation);
  const patient = activeEvaluation?.patient;
  const patientName = patient ? `${patient.name} ${patient.lastName}`.trim() : null;

  const meter = useNoiseMeter({ threshold, testDurationSec });
  const [checks, setChecks] = useState<Record<string, boolean>>({ c1: false, c2: false, c3: false, c4: false });
  // Corrección de campo del sonómetro (dB): permite anclar la lectura a un
  // sonómetro de referencia sin recompilar. Vive en el módulo DSP (proceso),
  // no en el estado, para que el adaptador la aplique bloque a bloque; y se
  // PERSISTE, porque es una propiedad del micrófono del equipo y no de la
  // sesión (antes se perdía al cerrar la app y había que recalibrar cada vez).
  const [calibration, setCalibration] = useState(() => getNoiseCalibrationOffset());
  const [referenceInput, setReferenceInput] = useState('');
  const applyCalibration = (db: number) => {
    setCalibration(db);
    void saveNoiseCalibration(db).then(setCalibration);
  };
  const adjustCalibration = (delta: number) => applyCalibration(calibration + delta);
  /** Calibración GUIADA: el clínico teclea lo que marca su sonómetro patrón y
   *  VIA+ calcula el offset. Evita tener que deducir el signo y sumar dB a dB. */
  const calibrateToReference = () => {
    const reference = Number(referenceInput.replace(',', '.'));
    if (!Number.isFinite(reference) || meter.db == null) return;
    applyCalibration(offsetForReference(reference, meter.db));
    setReferenceInput('');
  };

  // Registra el motor de captura real (react-native-audio-api) y lo libera al
  // salir: sin la baja, el recorder y la sesión de grabación quedaban abiertos
  // y el resto de módulos sonaba atenuado (o el sonómetro se quedaba «pillado»
  // al volver a entrar).
  useEffect(() => {
    registerNoiseMicAdapter();
    return () => unregisterNoiseMicAdapter();
  }, []);

  // Recupera la calibración guardada en este dispositivo.
  useEffect(() => {
    let mounted = true;
    void loadNoiseCalibration().then(db => {
      if (mounted) setCalibration(db);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const allChecked = useMemo(() => CHECKLIST.every(c => checks[c.id]), [checks]);
  const canContinue = meter.verdict === 'ok' && allChecked;

  const liveDb = meter.db;
  const zone: NoiseZone = liveDb == null ? 'ok' : zoneOf(liveDb, threshold);
  const ringColor = liveDb == null ? '#C9C2B6' : ZONE_HEX[zone];
  // Fracción del anillo con la MISMA escala que el DSP (antes estaba fijada a
  // mano en 28–92 dB y quedó desincronizada al recalibrar el sonómetro).
  const frac = liveDb == null ? 0 : splFraction(liveDb);
  const dashoffset = RING_C * (1 - frac);

  const sourceMeta: { kind: 'ok' | 'block' | 'pending'; text: string } =
    meter.source === 'mic'
      ? { kind: 'ok', text: 'Micrófono en vivo' }
      : meter.source === 'error'
        ? { kind: 'block', text: 'Micrófono no disponible' }
        : { kind: 'pending', text: 'Micrófono inactivo' };

  const verdict = VERDICT_COPY[meter.verdict];

  let gate: { kind: 'ok' | 'warn' | 'pending'; text: string };
  if (canContinue) gate = { kind: 'ok', text: 'TODO LISTO' };
  else if (meter.verdict !== 'ok') gate = { kind: 'pending', text: 'FALTA MEDICIÓN' };
  else gate = { kind: 'warn', text: 'FALTAN CONDICIONES' };

  const fmt = (n: number | null) => (n == null ? '—' : `${Math.round(n)}`);

  const handleContinue = () => {
    if (!canContinue) return;
    meter.stop();
    // El sonómetro es un prerrequisito (gate): no persiste resultado clínico.
    // Si quieres registrar la verificación, ver LEEME.md § "Persistencia (opcional)".
    navigation.navigate('SeleccionEjercicios');
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

        {/* El gauge + stats + checklist superan la altura de pantalla: sin
            scroll el botón de continuar queda inaccesible. */}
        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        <VStack flex={1} px="$6" mt="$2" space="md">
          {/* ----- title ----- */}
          <VStack>
            <HStack alignItems="center" space="sm">
              <Text size="2xl" weight="bold" color="$textLight900">
                Sonómetro Ambiental
              </Text>
              <Box bg="$primary50" px="$2" py="$0.5" borderRadius="$full">
                <Text size="2xs" weight="bold" color="$primary800" style={{ letterSpacing: 0.4 }}>
                  PRERREQUISITO · SALA
                </Text>
              </Box>
            </HStack>
            <Text size="xs" color="$textLight500">
              {patientName
                ? `${patientName}${patient?.nhc ? ` · NHC ${patient.nhc}` : ''}`
                : 'Verificación de ruido ambiente antes de iniciar los ejercicios'}
            </Text>
          </VStack>

          {/* ===================== GAUGE ===================== */}
          <Card bgColor="$white" borderRadius={22} p="$5">
            <HStack alignItems="center" justifyContent="space-between" mb="$2">
              <VStack style={{ flex: 1 }}>
                <Text size="md" weight="bold" color="$textLight900">
                  Nivel de ruido ambiente
                </Text>
                <Text size="2xs" color="$textLight500">
                  Mantenga la sala en silencio durante la medición
                </Text>
              </VStack>
              <Box bg={KIND_TOKENS[sourceMeta.kind].bg} px="$2.5" py="$0.5" borderRadius="$full">
                <Text size="2xs" weight="bold" color={KIND_TOKENS[sourceMeta.kind].fg}>
                  {sourceMeta.text}
                </Text>
              </Box>
            </HStack>

            {/* ring */}
            <Center my="$3">
              <Box width={RING_SIZE} height={RING_SIZE} alignItems="center" justifyContent="center">
                <Svg width={RING_SIZE} height={RING_SIZE} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
                  <Circle cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RING_R} stroke="#F0EBE2" strokeWidth={16} fill="none" />
                  <Circle
                    cx={RING_SIZE / 2}
                    cy={RING_SIZE / 2}
                    r={RING_R}
                    stroke={ringColor}
                    strokeWidth={16}
                    strokeLinecap="round"
                    fill="none"
                    strokeDasharray={RING_C}
                    strokeDashoffset={dashoffset}
                  />
                </Svg>
                <VStack alignItems="center">
                  <HStack alignItems="flex-end" space="xs">
                    <Text style={{ fontSize: 64, fontWeight: '800', lineHeight: 64, color: liveDb == null ? '#C9C2B6' : ZONE_HEX[zone] }}>
                      {liveDb == null ? '--' : Math.round(liveDb)}
                    </Text>
                    <Text size="lg" weight="semiBold" color="$textLight400" mb="$2">
                      dB(A)
                    </Text>
                  </HStack>
                  <Text size="xs" weight="bold" style={{ letterSpacing: 0.6, color: liveDb == null ? '#B0A89C' : ZONE_HEX[zone] }}>
                    {liveDb == null ? 'MICRÓFONO INACTIVO' : ZONE_LABEL[zone]}
                  </Text>
                </VStack>
              </Box>
            </Center>

            {/* spectrum */}
            <HStack alignItems="flex-end" justifyContent="center" style={{ height: 56, gap: 4 }}>
              {meter.levels.map((lv, i) => (
                <Box key={i} style={{ flex: 1, height: Math.max(3, lv * 56), borderRadius: 3, backgroundColor: meter.running ? BRAND : '#E7E0D4' }} />
              ))}
            </HStack>
          </Card>

          {/* ===================== STATS ===================== */}
          {/* Nomenclatura de sonómetro: LAeq (media energética), L90 (ruido de
              fondo) y L10 (picos sostenidos). El «pico máximo» absoluto que se
              mostraba antes convertía cualquier roce del equipo en un valor
              alarmante y no describía la sala. */}
          <HStack space="sm">
            {[
              { label: `LAeq ${testDurationSec} s`, value: fmt(meter.avg), color: '$textLight900' },
              { label: 'FONDO L90', value: fmt(meter.background), color: '$textLight900' },
              { label: 'PICOS L10', value: fmt(meter.peak), color: '$textLight900' },
              { label: 'UMBRAL APTO', value: `≤ ${threshold}`, color: '$primary600' },
            ].map((stat, i) => (
              <Card key={i} bgColor="$white" borderRadius={14} p="$3" style={{ flex: 1 }}>
                <Text size="2xs" color="$textLight400" style={{ letterSpacing: 0.4, textAlign: 'center' }}>
                  {stat.label}
                </Text>
                <Text size="lg" weight="bold" color={stat.color} mt="$0.5" style={{ textAlign: 'center', fontVariant: ['tabular-nums'] }}>
                  {stat.value}
                </Text>
              </Card>
            ))}
          </HStack>

          {meter.clipped > 0 ? (
            <HStack space="sm" alignItems="flex-start" p="$3" borderRadius={14} bg="$warning50">
              <Icon as={AlertTriangle} size="xs" color="$warning700" style={{ marginTop: 2 }} />
              <Text size="2xs" color="$warning800" style={{ flex: 1, lineHeight: 15 }}>
                Se descartaron {meter.clipped} tramo{meter.clipped === 1 ? '' : 's'} por saturación del micrófono
                (golpes o roces del equipo). Deje el dispositivo apoyado y quieto durante la medición.
              </Text>
            </HStack>
          ) : null}

          {/* test progress */}
          {meter.testing ? (
            <VStack>
              <HStack justifyContent="space-between" mb="$1.5">
                <Text size="2xs" color="$textLight500">
                  Midiendo ruido ambiente…
                </Text>
                <Text size="2xs" color="$textLight500">
                  {meter.testRemaining} s
                </Text>
              </HStack>
              <Box h={8} borderRadius="$full" bg="$backgroundLight200" overflow="hidden">
                <Box h="$full" bg="$primary500" borderRadius="$full" style={{ width: `${Math.round(meter.testProgress * 100)}%` }} />
              </Box>
            </VStack>
          ) : null}

          {/* controls */}
          <HStack space="sm">
            <Button
              action="secondary"
              variant="outline"
              rounded="$full"
              style={{ flex: 1 }}
              onPress={() => (meter.source === 'mic' ? meter.stop() : meter.start())}>
              <HStack space="sm" alignItems="center">
                <Icon as={meter.source === 'mic' ? Square : Mic} size="sm" color={meter.source === 'mic' ? '$error500' : '$primary500'} />
                <Text size="sm" weight="bold" color={meter.source === 'mic' ? '$error500' : '$primary500'}>
                  {meter.source === 'mic' ? 'Detener' : 'Activar micrófono'}
                </Text>
              </HStack>
            </Button>
            <Button action="primary" variant="solid" rounded="$full" style={{ flex: 1 }} isDisabled={meter.testing} onPress={meter.runTest}>
              <Text size="sm" weight="bold" color="$white">
                {meter.testing ? 'Midiendo…' : meter.verdict !== 'pending' ? 'Repetir medición' : `Medir ${testDurationSec} s`}
              </Text>
            </Button>
          </HStack>

          {/* ================= CALIBRACIÓN DE CAMPO ================= */}
          <Card bgColor="$white" borderRadius={18} borderWidth={1} borderColor="$borderLight100" p="$4">
            <HStack alignItems="center" justifyContent="space-between">
              <VStack style={{ flex: 1 }}>
                <Text size="2xs" weight="bold" color="$textLight400" style={{ letterSpacing: 0.4 }}>
                  CALIBRACIÓN DE CAMPO
                </Text>
                <Text size="xs" color="$textLight500" mt="$0.5" style={{ lineHeight: 16 }}>
                  Ajuste la lectura a un sonómetro de referencia en la misma sala. El ajuste se guarda en este
                  dispositivo.
                </Text>
              </VStack>
              <HStack space="xs" alignItems="center">
                <Pressable onPress={() => adjustCalibration(-1)} disabled={calibration <= -NOISE_OFFSET_LIMIT_DB}>
                  <Center w={38} h={38} borderRadius={12} borderWidth={1} borderColor="$borderLight200" bg="$white">
                    <Text size="lg" weight="bold" color="$textLight600">
                      −
                    </Text>
                  </Center>
                </Pressable>
                <Box minWidth={58}>
                  <Text
                    size="md"
                    weight="bold"
                    color={calibration === 0 ? '$textLight400' : '$primary600'}
                    style={{ textAlign: 'center', fontVariant: ['tabular-nums'] }}>
                    {calibration > 0 ? `+${calibration}` : calibration} dB
                  </Text>
                </Box>
                <Pressable onPress={() => adjustCalibration(1)} disabled={calibration >= NOISE_OFFSET_LIMIT_DB}>
                  <Center w={38} h={38} borderRadius={12} borderWidth={1} borderColor="$borderLight200" bg="$white">
                    <Text size="lg" weight="bold" color="$textLight600">
                      +
                    </Text>
                  </Center>
                </Pressable>
              </HStack>
            </HStack>

            {/* Calibración GUIADA: teclear la lectura del patrón es mucho menos
                propenso a error que deducir el signo del offset y sumar dB a dB. */}
            <VStack space="xs" mt="$3" pt="$3" borderTopWidth={1} borderColor="$borderLight100">
              <Text size="2xs" color="$textLight500" style={{ lineHeight: 15 }}>
                Con el micrófono activo, escriba lo que marca el sonómetro patrón y VIA+ calculará el ajuste.
              </Text>
              <HStack space="sm" alignItems="center">
                <Input variant="outline" borderRadius={12} bg="$white" style={{ flex: 1 }}>
                  <InputField
                    placeholder="dB(A) del patrón"
                    keyboardType="numeric"
                    value={referenceInput}
                    onChangeText={setReferenceInput}
                  />
                </Input>
                <Button
                  action="secondary"
                  variant="outline"
                  rounded="$full"
                  isDisabled={meter.db == null || !referenceInput.trim()}
                  onPress={calibrateToReference}>
                  <Text size="xs" weight="bold" color="$primary500">
                    Ajustar
                  </Text>
                </Button>
              </HStack>
            </VStack>
          </Card>

          {/* error de captura (permiso denegado, micrófono sin señal…) */}
          {meter.error ? (
            <Card bgColor="$error50" borderRadius={18} borderWidth={1} borderColor="$error200" p="$4">
              <HStack space="sm" alignItems="flex-start">
                <Icon as={AlertTriangle} size="sm" color="$error600" style={{ marginTop: 2 }} />
                <VStack style={{ flex: 1 }}>
                  <Text size="sm" weight="bold" color="$error700">
                    No se pudo medir
                  </Text>
                  <Text size="xs" color="$error700" style={{ lineHeight: 17 }}>
                    {meter.error}
                  </Text>
                </VStack>
              </HStack>
            </Card>
          ) : null}

          {/* ===================== VERDICT ===================== */}
          <Card bgColor={KIND_TOKENS[verdict.kind].bg} borderRadius={20} p="$5">
            <Text size="2xs" weight="bold" color={KIND_TOKENS[verdict.kind].fg} style={{ letterSpacing: 0.4 }}>
              CONDICIÓN ACÚSTICA
            </Text>
            <Text size="xl" weight="bold" color={KIND_TOKENS[verdict.kind].fg} mt="$0.5">
              {verdict.title}
            </Text>
            <Text size="xs" color={KIND_TOKENS[verdict.kind].fg} mt="$1" style={{ lineHeight: 17, opacity: 0.95 }}>
              {verdict.desc}
            </Text>
          </Card>

          {/* ===================== CHECKLIST ===================== */}
          <Card bgColor="$white" borderRadius={22} p="$5">
            <HStack space="sm" alignItems="center" mb="$3">
              <Icon as={Check} size="sm" color="$primary500" />
              <Text size="sm" weight="bold" color="$textLight800">
                Condiciones de la sala
              </Text>
            </HStack>
            <VStack space="sm">
              {CHECKLIST.map(c => {
                const checked = checks[c.id];
                return (
                  <Pressable key={c.id} onPress={() => setChecks(prev => ({ ...prev, [c.id]: !prev[c.id] }))}>
                    <HStack space="sm" alignItems="center" p="$3" borderRadius={13} borderWidth={1.5} bg={checked ? '$success50' : '$white'} borderColor={checked ? '$success200' : '$borderLight100'}>
                      <Center w={22} h={22} borderRadius={7} bg={checked ? '$success600' : '$white'} borderWidth={checked ? 0 : 1.5} borderColor="$borderLight300">
                        {checked ? <Icon as={Check} size="2xs" color="$white" /> : null}
                      </Center>
                      <Text size="sm" color={checked ? '$textLight800' : '$textLight600'} weight={checked ? 'semiBold' : 'normal'} style={{ flex: 1, lineHeight: 18 }}>
                        {c.label}
                      </Text>
                    </HStack>
                  </Pressable>
                );
              })}
            </VStack>
            <HStack space="sm" alignItems="flex-start" mt="$3" p="$3" borderRadius={14} bg="$backgroundLight50">
              <Text size="2xs" color="$textLight500" style={{ flex: 1, lineHeight: 16 }}>
                Las pruebas de discriminación auditiva requieren ≤ {threshold} dB(A) de ruido de fondo. Lectura con
                ponderación A (IEC 61672) sobre el micrófono del dispositivo, sin calibración certificada: es
                orientativa y no sustituye a un sonómetro patrón.
              </Text>
            </HStack>
          </Card>

          {/* ===================== GATE + CONTINUE ===================== */}
          <Card bgColor="$white" borderRadius={22} p="$5">
            <HStack alignItems="center" justifyContent="space-between" mb="$3">
              <Text size="2xs" color="$textLight500">
                Requisitos
              </Text>
              <Box bg={KIND_TOKENS[gate.kind].bg} px="$2.5" py="$0.5" borderRadius="$full">
                <Text size="2xs" weight="bold" color={KIND_TOKENS[gate.kind].fg}>
                  {gate.text}
                </Text>
              </Box>
            </HStack>
            <Button action="primary" variant="solid" rounded="$full" isDisabled={!canContinue} onPress={handleContinue}>
              <HStack space="sm" alignItems="center">
                <Text size="md" weight="bold" color="$white">
                  Continuar a los ejercicios
                </Text>
                <Icon as={ArrowRight} size="sm" color="$white" />
              </HStack>
            </Button>
          </Card>

          <Box h="$10" />
        </VStack>
        </ScrollView>
      </VStack>
    </Content>
  );
}
