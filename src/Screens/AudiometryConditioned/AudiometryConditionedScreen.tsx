import React, { useMemo, useState } from 'react';
import { Pressable } from 'react-native';
import { StackScreenProps } from '@react-navigation/stack';
import { Box, Card, Center, HStack, Icon, Input, InputField, ScrollView, VStack } from '@gluestack-ui/themed';
import { Bell, Check, RotateCcw, Save, Volume2, X } from 'lucide-react-native';

import { Button, Content, Header, Text } from '@/Components/Common';
import RadialBackground from '@/Components/Themed/RadialBackground';
import { RootStackParamList } from '@/Navigators';
import { RootState } from '@/Store';
import { Evaluation } from '@/Models/Evaluation/Evaluation';
import { AudiometryTest } from '@/Models/Audiometry/AudiometryTest';
import { useClassSelector } from '@/Helpers/ClassTransformer';
import { useCreateAudiometryMutation } from '@/Services/local/modules/audiometry';
import { showErrorToast, showSuccessToast } from '@/Helpers/showToast';
import {
  Audiogram,
  DB_STEPS,
  FREQS,
  interpretAudiometry,
  severityOf,
  ToneTarget,
  useAudiometryTest,
} from '@/Screens/Audiometry';
import TrainScene from './components/TrainScene';

type Props = StackScreenProps<RootStackParamList, 'AudiometryConditioned'>;

const FREQ_LABEL: Record<string, string> = { '500': '500', '1000': '1k', '2000': '2k', '4000': '4k', amb: 'Amb', pol: 'Pol' };

export default function AudiometryConditionedScreen({ navigation }: Props) {
  const activeEvaluation = useClassSelector(Evaluation, (state: RootState) => state.activeEvaluation.evaluation);
  const [createAudiometry, { isLoading: isSaving }] = useCreateAudiometryMutation();
  const a = useAudiometryTest();

  const [chugging, setChugging] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const [warn, setWarn] = useState(false);
  const [notes, setNotes] = useState('');
  const [evaluatorName, setEvaluatorName] = useState(activeEvaluation?.professional?.name ?? '');
  const [evaluatorLicense, setEvaluatorLicense] = useState(activeEvaluation?.professional?.licenseNumber ?? '');

  const patient = activeEvaluation?.patient;
  const patientName = patient ? `${patient.name} ${patient.lastName}`.trim() : null;

  const onWhistle = () => {
    if (a.playing) {
      a.stop();
      setChugging(true);
      setCelebrate(true);
      setTimeout(() => {
        setChugging(false);
        setCelebrate(false);
      }, 1600);
      if (typeof a.freq === 'number') a.responded();
    } else {
      setWarn(true);
      setTimeout(() => setWarn(false), 1400);
    }
  };

  const doneForActive = a.doneForEar(a.ear);
  const doneFlags = FREQS.map(f => a.thresholds[a.ear][f] !== null);
  const stationLabels = FREQS.map(f => FREQ_LABEL[String(f)]);
  const earWord = a.ear === 'OD' ? 'derecho' : 'izquierdo';

  const assistant = useMemo(() => {
    if (a.isControl) {
      return { tag: 'SONIDO DE CONTROL', text: 'Estímulo de control (no tonal): verifique la atención y el condicionamiento antes de seguir con los tonos.', bg: '$primary0' };
    }
    if (a.currentThreshold !== null) {
      return { tag: 'ESTACIÓN ALCANZADA', text: `Umbral ${a.ear} ${FREQ_LABEL[String(a.freq)]} = ${a.currentThreshold} dB HL confirmado. Avance a la siguiente estación (frecuencia).`, bg: '$success50' };
    }
    const conf = a.heardAtMin !== null ? ` · ${a.heardTally}/2 a ${a.heardAtMin} dB` : '';
    return { tag: 'HUGHSON-WESTLAKE', text: `Presente a ${a.db} dB. Responde → «Sí» (baja 10). No → «No» (sube 5). Confirme con 2 respuestas${conf}.`, bg: '$warning50' };
  }, [a.isControl, a.currentThreshold, a.ear, a.freq, a.heardAtMin, a.heardTally, a.db]);

  const handleSave = async () => {
    if (isSaving) return;
    if (!evaluatorName.trim() || !evaluatorLicense.trim()) return;
    if (!activeEvaluation) {
      showErrorToast('No se puede guardar', 'No hay una evaluación activa asociada al paciente.');
      return;
    }
    try {
      const item = new AudiometryTest();
      item.method = 'conditioned';
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
      navigation.goBack();
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
                    Audiometría condicionada
                  </Text>
                  <Box bg="$primary50" px="$2" py="$0.5" borderRadius="$full">
                    <Text size="2xs" weight="bold" color="$primary800" style={{ letterSpacing: 0.4 }}>
                      EL TREN DEL SONIDO
                    </Text>
                  </Box>
                </HStack>
                <Text size="xs" color="$textLight500">
                  {patientName ?? 'Refuerzo visual lúdico (CRA) · Hughson-Westlake guiado'}
                </Text>
              </VStack>
              <HStack space="xs" alignItems="center" bg="$white" borderRadius="$full" px="$3" py="$1.5" borderWidth={1} borderColor="$borderLight100">
                <Text size="sm">🎫</Text>
                <Text size="sm" weight="bold" color="$primary600">
                  {a.stars}/8
                </Text>
              </HStack>
            </HStack>

            {/* escena del tren */}
            <Card bgColor="$white" borderRadius={22} p="$4">
              <HStack justifyContent="space-between" alignItems="center" mb="$2">
                <Text size="sm" weight="bold" color="$textLight900">
                  El Tren del Sonido — oído {earWord}
                </Text>
                {a.playing ? (
                  <Box bg="$primary50" px="$2.5" py="$1" borderRadius="$full">
                    <Text size="2xs" weight="bold" color="$primary700">SILBANDO…</Text>
                  </Box>
                ) : null}
              </HStack>
              <TrainScene progress={doneForActive} stationLabels={stationLabels} doneFlags={doneFlags} chugging={chugging} celebrate={celebrate} />

              {/* silbato del niño */}
              <HStack space="sm" alignItems="center" mt="$3">
                <Pressable style={{ flex: 1 }} onPress={onWhistle}>
                  <Center py="$3" borderRadius={16} bg={a.playing ? '$success600' : '$primary600'}>
                    <HStack space="sm" alignItems="center">
                      <Icon as={Bell} size="md" color="$white" />
                      <VStack>
                        <Text size="md" weight="bold" color="$white">¡Toca el silbato!</Text>
                        <Text size="2xs" color="$white" style={{ opacity: 0.9 }}>Pulsa cuando oigas el tren</Text>
                      </VStack>
                    </HStack>
                  </Center>
                </Pressable>
                {warn ? (
                  <Box bg="$error50" px="$3" py="$2" borderRadius={10} style={{ maxWidth: 130 }}>
                    <Text size="2xs" weight="bold" color="$error600">Espera a oír el silbido</Text>
                  </Box>
                ) : null}
              </HStack>
            </Card>

            {/* audiograma */}
            <Card bgColor="$white" borderRadius={20} p="$4">
              <HStack justifyContent="space-between" alignItems="center" mb="$2">
                <Text size="sm" weight="bold" color="$textLight900">Audiograma clínico</Text>
                <HStack space="md">
                  <Text size="2xs" style={{ color: '#E63535' }}>● OD</Text>
                  <Text size="2xs" style={{ color: '#1E8049' }}>✕ OI</Text>
                </HStack>
              </HStack>
              <Box h={250} borderRadius={12} borderWidth={1} borderColor="$borderLight100" bg="$backgroundLight50">
                <Audiogram thresholds={a.thresholds} cursor={a.isControl ? null : { freq: a.freq as number, db: a.db }} cursorColor="#0066B3" />
              </Box>
            </Card>

            {/* umbrales + PTA + fiabilidad */}
            <Card bgColor="$white" borderRadius={20} p="$4">
              <Text size="sm" weight="bold" color="$textLight900" mb="$2">Umbrales registrados · dB HL</Text>
              <VStack space="xs">
                <HStack>
                  <Text size="xs" color="$textLight400" style={{ width: 50 }}>Oído</Text>
                  {FREQS.map(f => (
                    <Text key={f} size="xs" color="$textLight400" style={{ flex: 1, textAlign: 'center' }}>{FREQ_LABEL[String(f)]}</Text>
                  ))}
                </HStack>
                {(['OD', 'OI'] as const).map(e => (
                  <HStack key={e} alignItems="center">
                    <Text size="sm" weight="bold" style={{ width: 50, color: e === 'OD' ? '#E63535' : '#1E8049' }}>{e}</Text>
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

            {/* panel del evaluador */}
            <Card bgColor="$white" borderRadius={20} p="$4">
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

              <Text size="xs" weight="semiBold" color="$textLight600" mb="$1">Estímulo</Text>
              <HStack space="xs" flexWrap="wrap" mb="$3">
                {([500, 1000, 2000, 4000, 'amb', 'pol'] as ToneTarget[]).map(f => (
                  <Pressable key={String(f)} onPress={() => a.setFreq(f)}>
                    <Box px="$3" py="$1.5" borderRadius="$full" bg={a.freq === f ? '$textLight900' : '$white'} borderWidth={1.5} borderColor={a.freq === f ? 'transparent' : '$borderLight200'}>
                      <Text size="xs" weight="bold" color={a.freq === f ? '$white' : '$textLight500'}>{FREQ_LABEL[String(f)]}</Text>
                    </Box>
                  </Pressable>
                ))}
              </HStack>

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
