import React, { useEffect, useMemo, useState } from 'react';
import { Pressable } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Box, Card, Center, HStack, Icon, Input, InputField, ScrollView, VStack } from '@gluestack-ui/themed';
import { Check, RotateCcw, Save, Volume2, X } from 'lucide-react-native';

import { Button, Content, Header, Text } from '@/Components/Common';
import RadialBackground from '@/Components/Themed/RadialBackground';
import { finishModule, RootStackParamList } from '@/Navigators';
import { RootState } from '@/Store';
import { Evaluation } from '@/Models/Evaluation/Evaluation';
import { AudiometryTest } from '@/Models/Audiometry/AudiometryTest';
import { useClassSelector } from '@/Helpers/ClassTransformer';
import { useTelemetryTracker } from '@/Telemetry';
import { useCreateAudiometryMutation } from '@/Services/local/modules/audiometry';
import { showErrorToast, showSuccessToast } from '@/Helpers/showToast';
import { useAudiometryTest, ToneTarget } from './useAudiometryTest';
import { DB_STEPS, FREQ_LABEL, FREQS, interpretAudiometry, severityOf } from './audiometryResult';
import Audiogram from './components/Audiogram';

type Props = NativeStackScreenProps<RootStackParamList, 'Audiometry'>;

const INSTRUMENTS: { key: string; glyph: string; name: string; freq: ToneTarget; tag: string }[] = [
  { key: 'drum', glyph: '🥁', name: 'Tambor', freq: 500, tag: '500 Hz' },
  { key: 'piano', glyph: '🎹', name: 'Piano', freq: 1000, tag: '1000 Hz' },
  { key: 'bell', glyph: '🔔', name: 'Campana', freq: 2000, tag: '2000 Hz' },
  { key: 'flute', glyph: '🎵', name: 'Flauta', freq: 4000, tag: '4000 Hz' },
  { key: 'amb', glyph: '🚑', name: 'Ambulancia', freq: 'amb', tag: 'Control' },
  { key: 'tren', glyph: '🚂', name: 'Tren', freq: 'tren', tag: 'Control' },
];

export default function AudiometryScreen({ navigation }: Props) {
  const activeEvaluation = useClassSelector(Evaluation, (state: RootState) => state.activeEvaluation.evaluation);
  const [createAudiometry, { isLoading: isSaving }] = useCreateAudiometryMutation();
  const a = useAudiometryTest();
  const tracker = useTelemetryTracker(); // telemetría silenciosa (useRef, sin re-render)

  const [celebrate, setCelebrate] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [evaluatorName, setEvaluatorName] = useState(activeEvaluation?.professional?.name ?? '');
  const [evaluatorLicense, setEvaluatorLicense] = useState(activeEvaluation?.professional?.licenseNumber ?? '');

  const patient = activeEvaluation?.patient;
  const patientName = patient ? `${patient.name} ${patient.lastName}`.trim() : null;

  const correctOf = (freq: ToneTarget) => a.playing && a.freq === freq;

  const onInstrument = (key: string, freq: ToneTarget) => {
    if (!correctOf(freq)) return;
    a.stop();
    setCelebrate(key);
    setTimeout(() => setCelebrate(null), 1000);
    if (typeof freq === 'number') a.responded();
  };

  const assistant = useMemo(() => {
    if (a.isControl) {
      return {
        tag: 'SONIDO DE CONTROL',
        text: 'Estímulo de control (no tonal): verifique la atención y el condicionamiento del niño/a antes de continuar con los tonos.',
        bg: '$primary0',
      };
    }
    if (a.currentThreshold !== null) {
      return {
        tag: 'UMBRAL CONFIRMADO',
        text: `Umbral ${a.ear} ${FREQ_LABEL[String(a.freq)]} = ${a.currentThreshold} dB HL confirmado. Seleccione la siguiente frecuencia u oído.`,
        bg: '$success50',
      };
    }
    const conf = a.heardAtMin !== null ? ` · ${a.heardTally}/2 respuestas a ${a.heardAtMin} dB` : '';
    return {
      tag: 'HUGHSON-WESTLAKE',
      text: `Presente a ${a.db} dB. Si responde → «Sí» (baja 10). Si no → «No» (sube 5). Confirme el umbral con 2 respuestas${conf}.`,
      bg: '$warning50',
    };
  }, [a.isControl, a.currentThreshold, a.ear, a.freq, a.heardAtMin, a.heardTally, a.db]);

  // Telemetría: cada umbral (oído + frecuencia tonal) es un reactivo. Los
  // «Sí/No» son el bracketing de Hughson-Westlake (protocolo), NO fricción;
  // por eso medimos por umbral: abrimos la ventana al cambiar de oído/frecuencia
  // y la cerramos cuando el umbral queda confirmado. Reconfirmar = rectificación.
  useEffect(() => {
    if (typeof a.freq === 'number') tracker.enterReactivo(`aud-${a.ear}-${a.freq}`);
  }, [a.ear, a.freq, tracker]);

  useEffect(() => {
    if (a.currentThreshold !== null && typeof a.freq === 'number') {
      tracker.classifyReactivo(`aud-${a.ear}-${a.freq}`);
    }
  }, [a.currentThreshold, a.ear, a.freq, tracker]);

  const handleSave = async () => {
    if (isSaving) return;
    if (!evaluatorName.trim() || !evaluatorLicense.trim()) return;
    if (!activeEvaluation) {
      showErrorToast('No se puede guardar', 'No hay una evaluación activa asociada al paciente.');
      return;
    }
    try {
      const item = new AudiometryTest();
      item.method = 'play';
      item.transducer = 'air';
      item.thresholds = a.thresholds;
      item.ptaOD = a.ptaOD;
      item.ptaOI = a.ptaOI;
      item.reliability = a.reliability;
      item.interpretation = interpretAudiometry(a.thresholds);
      item.notes = notes.trim();
      item.evaluatorName = evaluatorName.trim();
      item.evaluatorLicense = evaluatorLicense.trim();
      item.completedAt = new Date();
      item.evaluation = { id: activeEvaluation.id } as Evaluation;

      await createAudiometry(item);
      showSuccessToast('Audiometría guardada', `PTA OD ${a.ptaOD ?? '—'} · PTA OI ${a.ptaOI ?? '—'} dB HL.`);
      // Aterriza en los resultados, no de vuelta al hub (ver finishModule).
      finishModule(navigation);
    } catch {
      showErrorToast('Error al guardar', 'No se pudo registrar la audiometría. Inténtelo de nuevo.');
    }
  };

  const sevOD = severityOf(a.ptaOD);
  const sevOI = severityOf(a.ptaOI);

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
        <ScrollView showsVerticalScrollIndicator={false}>
          <VStack flex={1} px="$6" mt="$2" space="md" pb="$10">
            {/* título */}
            <HStack alignItems="center" justifyContent="space-between">
              <VStack>
                <HStack alignItems="center" space="sm">
                  <Text size="2xl" weight="bold" color="$textLight900">
                    Audiometría infantil
                  </Text>
                  <Box bg="$primary50" px="$2" py="$0.5" borderRadius="$full">
                    <Text size="2xs" weight="bold" color="$primary800" style={{ letterSpacing: 0.4 }}>
                      JUEGO DE TONOS
                    </Text>
                  </Box>
                </HStack>
                <Text size="xs" color="$textLight500">
                  {patientName ?? 'Audiometría tonal condicionada por juego'}
                </Text>
              </VStack>
              <HStack space="xs" alignItems="center" bg="$white" borderRadius="$full" px="$3" py="$1.5" borderWidth={1} borderColor="$borderLight100">
                <Text size="sm">⭐</Text>
                <Text size="sm" weight="bold" color="$primary600">
                  {a.stars}/8
                </Text>
              </HStack>
            </HStack>

            {/* audiograma */}
            <Card bgColor="$white" borderRadius={22} p="$4">
              <HStack justifyContent="space-between" alignItems="center" mb="$2">
                <Text size="sm" weight="bold" color="$textLight900">
                  Audiograma clínico
                </Text>
                <HStack space="md">
                  <Text size="2xs" style={{ color: '#E63535' }}>● OD</Text>
                  <Text size="2xs" style={{ color: '#1E8049' }}>✕ OI</Text>
                </HStack>
              </HStack>
              <Box h={250} borderRadius={12} borderWidth={1} borderColor="$borderLight100" bg="$backgroundLight50">
                <Audiogram thresholds={a.thresholds} cursor={a.isControl ? null : { freq: a.freq as number, db: a.db }} />
              </Box>
            </Card>

            {/* umbrales + PTA + fiabilidad */}
            <Card bgColor="$white" borderRadius={20} p="$4">
              <Text size="sm" weight="bold" color="$textLight900" mb="$2">
                Umbrales registrados · dB HL
              </Text>
              <VStack space="xs">
                <HStack>
                  <Text size="xs" color="$textLight400" style={{ width: 50 }}>Oído</Text>
                  {FREQS.map(f => (
                    <Text key={f} size="xs" color="$textLight400" style={{ flex: 1, textAlign: 'center' }}>
                      {FREQ_LABEL[String(f)]}
                    </Text>
                  ))}
                </HStack>
                {(['OD', 'OI'] as const).map(e => (
                  <HStack key={e} alignItems="center">
                    <Text size="sm" weight="bold" style={{ width: 50, color: e === 'OD' ? '#E63535' : '#1E8049' }}>
                      {e}
                    </Text>
                    {FREQS.map(f => (
                      <Text key={f} size="sm" weight="semiBold" color="$textLight700" style={{ flex: 1, textAlign: 'center', fontVariant: ['tabular-nums'] }}>
                        {a.thresholds[e][f] ?? '—'}
                      </Text>
                    ))}
                  </HStack>
                ))}
              </VStack>

              <HStack space="sm" mt="$3">
                <Box flex={1} bg="$backgroundLight50" borderRadius={12} p="$2.5" alignItems="center">
                  <Text size="2xs" color="$textLight400">PTA OD</Text>
                  <Text size="lg" weight="bold" style={{ color: '#E63535' }}>{a.ptaOD ?? '—'}</Text>
                  {sevOD ? <Text size="2xs" color="$textLight500">{sevOD.label}</Text> : null}
                </Box>
                <Box flex={1} bg="$backgroundLight50" borderRadius={12} p="$2.5" alignItems="center">
                  <Text size="2xs" color="$textLight400">PTA OI</Text>
                  <Text size="lg" weight="bold" style={{ color: '#1E8049' }}>{a.ptaOI ?? '—'}</Text>
                  {sevOI ? <Text size="2xs" color="$textLight500">{sevOI.label}</Text> : null}
                </Box>
                <Box flex={1} bg="$backgroundLight50" borderRadius={12} p="$2.5" alignItems="center">
                  <Text size="2xs" color="$textLight400">FIABILIDAD</Text>
                  <Text size="lg" weight="bold" color={a.reliability === null ? '$textLight400' : a.reliability >= 80 ? '$success600' : '$warning600'}>
                    {a.reliability !== null ? `${a.reliability}%` : '—'}
                  </Text>
                </Box>
              </HStack>
            </Card>

            {/* juego del niño */}
            <Card bgColor="$white" borderRadius={20} p="$4">
              <HStack justifyContent="space-between" alignItems="center" mb="$3">
                <Text size="sm" weight="bold" color="$textLight900">
                  ¿Qué instrumento suena?
                </Text>
                {a.playing ? (
                  <Box bg="$warning50" px="$2.5" py="$1" borderRadius="$full">
                    <Text size="2xs" weight="bold" color="$warning700">SONANDO…</Text>
                  </Box>
                ) : null}
              </HStack>
              <HStack flexWrap="wrap" justifyContent="space-between">
                {INSTRUMENTS.map(inst => {
                  const active = correctOf(inst.freq);
                  const success = celebrate === inst.key;
                  return (
                    <Pressable key={inst.key} onPress={() => onInstrument(inst.key, inst.freq)} style={{ width: '31%', marginBottom: 12 }}>
                      <Center
                        py="$3"
                        borderRadius={16}
                        borderWidth={success || active ? 2.5 : 1.5}
                        borderColor={success ? '$success400' : active ? '$primary500' : '$borderLight100'}
                        bg={success ? '$success50' : active ? '$primary0' : '$white'}>
                        <Text size="3xl">{inst.glyph}</Text>
                        <Text size="sm" weight="bold" color="$textLight900" mt="$1">{inst.name}</Text>
                        <Box bg={typeof inst.freq === 'number' ? '$primary50' : '$backgroundLight100'} px="$2" py="$0.5" borderRadius="$full" mt="$1">
                          <Text size="2xs" weight="bold" color={typeof inst.freq === 'number' ? '$primary700' : '$textLight400'}>
                            {inst.tag}
                          </Text>
                        </Box>
                      </Center>
                    </Pressable>
                  );
                })}
              </HStack>
            </Card>

            {/* panel del evaluador */}
            <Card bgColor="$white" borderRadius={20} p="$4">
              {/* oído */}
              <Text size="xs" weight="semiBold" color="$textLight600" mb="$1">Oído</Text>
              <HStack space="sm" mb="$3">
                {(['OD', 'OI'] as const).map(e => (
                  <Pressable key={e} style={{ flex: 1 }} onPress={() => a.setEar(e)}>
                    <Center py="$2" borderRadius={10} bg={a.ear === e ? (e === 'OD' ? '$error500' : '$success600') : '$white'} borderWidth={1.5} borderColor={a.ear === e ? 'transparent' : '$borderLight200'}>
                      <Text size="sm" weight="bold" color={a.ear === e ? '$white' : '$textLight500'}>{e}</Text>
                    </Center>
                  </Pressable>
                ))}
              </HStack>

              {/* intensidad */}
              <Text size="xs" weight="semiBold" color="$textLight600" mb="$1">Intensidad · dB HL</Text>
              <HStack space="xs" mb="$3">
                {DB_STEPS.map(d => (
                  <Pressable key={d} style={{ flex: 1 }} onPress={() => a.setDb(d)}>
                    <Center py="$1.5" borderRadius={8} bg={a.db === d ? '$primary500' : '$white'} borderWidth={1.5} borderColor={a.db === d ? 'transparent' : '$borderLight200'}>
                      <Text size="xs" weight="bold" color={a.db === d ? '$white' : '$textLight500'} style={{ fontVariant: ['tabular-nums'] }}>{d}</Text>
                    </Center>
                  </Pressable>
                ))}
              </HStack>

              {/* estímulo */}
              <Text size="xs" weight="semiBold" color="$textLight600" mb="$1">Estímulo</Text>
              <HStack space="xs" flexWrap="wrap" mb="$3">
                {([500, 1000, 2000, 4000, 'amb', 'tren'] as ToneTarget[]).map(f => (
                  <Pressable key={String(f)} onPress={() => a.setFreq(f)}>
                    <Box px="$3" py="$1.5" borderRadius="$full" bg={a.freq === f ? '$textLight900' : '$white'} borderWidth={1.5} borderColor={a.freq === f ? 'transparent' : '$borderLight200'}>
                      <Text size="xs" weight="bold" color={a.freq === f ? '$white' : '$textLight500'}>{FREQ_LABEL[String(f)]}</Text>
                    </Box>
                  </Pressable>
                ))}
              </HStack>

              {/* asistente HW + emitir */}
              <HStack space="sm" alignItems="stretch" mb="$3">
                <Box flex={1} bg={assistant.bg} borderRadius={14} p="$3" justifyContent="center">
                  <Text size="2xs" weight="bold" color="$warning700" style={{ letterSpacing: 0.4 }}>{assistant.tag}</Text>
                  <Text size="xs" weight="semiBold" color="$textLight800" mt="$0.5" style={{ lineHeight: 17 }}>{assistant.text}</Text>
                </Box>
                <Button action="primary" variant="solid" rounded="$xl" onPress={a.playStimulus} style={{ width: 120 }}>
                  <VStack alignItems="center">
                    <Icon as={Volume2} size="md" color="$white" />
                    <Text size="2xs" weight="bold" color="$white" mt="$0.5">Emitir</Text>
                  </VStack>
                </Button>
              </HStack>

              {/* registro */}
              <HStack space="sm">
                <Pressable style={{ flex: 1 }} onPress={() => a.responded()}>
                  <Center py="$2.5" borderRadius={12} bg="$success50">
                    <HStack space="xs" alignItems="center">
                      <Icon as={Check} size="sm" color="$success700" />
                      <Text size="sm" weight="bold" color="$success700">Sí respondió</Text>
                    </HStack>
                  </Center>
                </Pressable>
                <Pressable style={{ flex: 1 }} onPress={() => a.noResponse()}>
                  <Center py="$2.5" borderRadius={12} bg="$error50">
                    <HStack space="xs" alignItems="center">
                      <Icon as={X} size="sm" color="$error600" />
                      <Text size="sm" weight="bold" color="$error600">No respondió</Text>
                    </HStack>
                  </Center>
                </Pressable>
                <Pressable onPress={a.reset}>
                  <Center w={44} py="$2.5" borderRadius={12} borderWidth={1} borderColor="$borderLight200" bg="$white">
                    <Icon as={RotateCcw} size="sm" color="$textLight500" />
                  </Center>
                </Pressable>
              </HStack>
            </Card>

            {/* evaluador + guardar */}
            <Card bgColor="$white" borderRadius={20} p="$4">
              <Text size="sm" weight="bold" color="$textLight700" mb="$2">Evaluador responsable</Text>
              <HStack space="sm" mb="$3">
                <Input variant="outline" borderRadius={12} style={{ flex: 2 }}>
                  <InputField placeholder="Nombre" value={evaluatorName} onChangeText={setEvaluatorName} />
                </Input>
                <Input variant="outline" borderRadius={12} style={{ flex: 1 }}>
                  <InputField placeholder="Colegiado" value={evaluatorLicense} onChangeText={setEvaluatorLicense} />
                </Input>
              </HStack>
              <Input variant="outline" borderRadius={12} h={64} mb="$3">
                <InputField multiline placeholder="Observaciones clínicas…" value={notes} onChangeText={setNotes} style={{ textAlignVertical: 'top' }} />
              </Input>
              <Button
                action="primary"
                variant="solid"
                rounded="$full"
                isDisabled={isSaving || !evaluatorName.trim() || !evaluatorLicense.trim()}
                isLoading={isSaving}
                onPress={handleSave}>
                <HStack space="sm" alignItems="center">
                  <Icon as={Save} size="sm" color="$white" />
                  <Text size="sm" weight="bold" color="$white">Guardar audiometría</Text>
                </HStack>
              </Button>
            </Card>
          </VStack>
        </ScrollView>
      </VStack>
    </Content>
  );
}
