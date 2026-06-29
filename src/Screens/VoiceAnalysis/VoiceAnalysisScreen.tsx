import React, { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import Svg, { Ellipse, Line, Circle, Text as SvgText } from 'react-native-svg';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
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
import { AudioWaveform, Mic, Save, Sparkles, Square } from 'lucide-react-native';

import { Button, Content, Header, Text } from '@/Components/Common';
import RadialBackground from '@/Components/Themed/RadialBackground';
import { RootStackParamList } from '@/Navigators';
import { RootState } from '@/Store';
import { Evaluation } from '@/Models/Evaluation/Evaluation';
import { VoiceAnalysis } from '@/Models/VoiceAnalysis/VoiceAnalysis';
import { useClassSelector } from '@/Helpers/ClassTransformer';
import { useCreateVoiceAnalysisMutation } from '@/Services/local/modules/voiceAnalysis';
import { showErrorToast, showSuccessToast } from '@/Helpers/showToast';
import { useVoiceAnalysis } from './useVoiceAnalysis';
import {
  buildInterpretation,
  statusColor,
  statusF0,
  statusHnr,
  statusJitter,
  statusLabel,
  statusShimmer,
} from './voiceAnalysisResult';

type Props = NativeStackScreenProps<RootStackParamList, 'VoiceAnalysis'>;

/* ------------------------- Espacio vocálico (F1×F2) ----------------------- */

const VowelSpace = ({ f1, f2 }: { f1: number | null; f2: number | null }) => {
  const W = 300;
  const H = 150;
  const f2x = (v: number) => 18 + ((2400 - v) / (2400 - 700)) * (W - 30);
  const f1y = (v: number) => 14 + ((v - 200) / (1000 - 200)) * (H - 34);
  const zones = [
    { v: '/i/', f1: 300, f2: 2300, c: '#C7D2FE' },
    { v: '/a/', f1: 850, f2: 1400, c: '#FFE3C2' },
    { v: '/u/', f1: 350, f2: 900, c: '#BBF7D0' },
  ];
  return (
    <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
      {[0, 1, 2, 3].map(i => (
        <Line key={`v${i}`} x1={18 + (i * (W - 30)) / 3} y1={12} x2={18 + (i * (W - 30)) / 3} y2={H - 18} stroke="#ECE5D8" strokeWidth={1} />
      ))}
      {[0, 1, 2, 3].map(i => (
        <Line key={`h${i}`} x1={18} y1={14 + (i * (H - 34)) / 3} x2={W - 12} y2={14 + (i * (H - 34)) / 3} stroke="#ECE5D8" strokeWidth={1} />
      ))}
      {zones.map(z => (
        <React.Fragment key={z.v}>
          <Ellipse cx={f2x(z.f2)} cy={f1y(z.f1)} rx={32} ry={24} fill={z.c} opacity={0.85} />
          <SvgText x={f2x(z.f2)} y={f1y(z.f1) + 3} fontSize={10} fill="#7A746B" textAnchor="middle">
            {z.v}
          </SvgText>
        </React.Fragment>
      ))}
      {f1 !== null && f2 !== null ? (
        <>
          <Circle cx={f2x(f2)} cy={f1y(f1)} r={11} fill="none" stroke="#FF7F00" strokeOpacity={0.35} strokeWidth={2} />
          <Circle cx={f2x(f2)} cy={f1y(f1)} r={6} fill="#FF7F00" stroke="#fff" strokeWidth={2} />
        </>
      ) : null}
    </Svg>
  );
};

/* --------------------------------- Pantalla -------------------------------- */

export default function VoiceAnalysisScreen({ navigation }: Props) {
  const activeEvaluation = useClassSelector(Evaluation, (state: RootState) => state.activeEvaluation.evaluation);
  const [createVoiceAnalysis, { isLoading: isSaving }] = useCreateVoiceAnalysisMutation();
  const voice = useVoiceAnalysis();

  const [notes, setNotes] = useState('');
  const [evaluatorName, setEvaluatorName] = useState(activeEvaluation?.professional?.name ?? '');
  const [evaluatorLicense, setEvaluatorLicense] = useState(activeEvaluation?.professional?.licenseNumber ?? '');

  const patient = activeEvaluation?.patient;
  const patientName = patient ? `${patient.name} ${patient.lastName}`.trim() : null;
  const r = voice.result;

  const interpretation = useMemo(() => (r ? buildInterpretation(r) : ''), [r]);

  const ParamCard = ({
    label,
    value,
    norm,
    status,
  }: {
    label: string;
    value: string;
    norm: string;
    status: 'normal' | 'borderline' | 'altered';
  }) => (
    <Card bgColor="$backgroundLight50" borderRadius={16} borderWidth={1} borderColor="$borderLight100" p="$3" style={{ flex: 1 }}>
      <HStack justifyContent="space-between" alignItems="flex-start">
        <Text size="2xs" color="$textLight500" style={{ letterSpacing: 0.3 }}>
          {label}
        </Text>
        <Box px="$2" py="$0.5" borderRadius="$full" bg={status === 'normal' ? '$success50' : status === 'borderline' ? '$warning50' : '$error50'}>
          <Text size="2xs" weight="bold" color={statusColor(status)}>
            {statusLabel(status)}
          </Text>
        </Box>
      </HStack>
      <Text size="2xl" weight="bold" color="$textLight900" mt="$1" style={{ fontVariant: ['tabular-nums'] }}>
        {value}
      </Text>
      <Text size="2xs" color="$textLight400" mt="$0.5">
        {norm}
      </Text>
    </Card>
  );

  const handleSave = async () => {
    if (!r || isSaving) return;
    if (!evaluatorName.trim() || !evaluatorLicense.trim()) return;
    if (!activeEvaluation) {
      showErrorToast('No se puede guardar', 'No hay una evaluación activa asociada al paciente.');
      return;
    }
    try {
      const item = new VoiceAnalysis();
      item.vowel = 'a';
      item.source = voice.source;
      item.durationSec = 5;
      item.quality = r.quality;
      item.f0 = r.f0;
      item.jitter = r.jitter;
      item.shimmer = r.shimmer;
      item.hnr = r.hnr;
      item.formants = r.formants;
      item.interpretation = interpretation;
      item.notes = notes.trim();
      item.evaluatorName = evaluatorName.trim();
      item.evaluatorLicense = evaluatorLicense.trim();
      item.completedAt = new Date();
      item.evaluation = { id: activeEvaluation.id } as Evaluation;

      await createVoiceAnalysis(item);
      showSuccessToast('Análisis guardado', `F0 ${r.f0} Hz · HNR ${r.hnr} dB · Jitter ${r.jitter}%.`);
      navigation.goBack();
    } catch {
      showErrorToast('Error al guardar', 'No se pudo registrar el análisis. Inténtelo de nuevo.');
    }
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

        <ScrollView showsVerticalScrollIndicator={false}>
          <VStack flex={1} px="$6" mt="$2" space="md" pb="$10">
            {/* título */}
            <VStack>
              <HStack alignItems="center" space="sm">
                <Text size="2xl" weight="bold" color="$textLight900">
                  Análisis acústico de voz
                </Text>
                <Box bg="$primary50" px="$2" py="$0.5" borderRadius="$full">
                  <Text size="2xs" weight="bold" color="$primary800" style={{ letterSpacing: 0.4 }}>
                    ESPECTROGRAFÍA
                  </Text>
                </Box>
              </HStack>
              <Text size="xs" color="$textLight500">
                {patientName ?? 'Vocal /a/ sostenida · 5 s · F0 · Jitter · Shimmer · HNR'}
              </Text>
            </VStack>

            {/* captura */}
            <Card bgColor="$white" borderRadius={22} p="$5">
              <HStack alignItems="center" space="sm" mb="$3">
                <Center w={40} h={40} borderRadius={12} bg="$primary50">
                  <Icon as={AudioWaveform} size="lg" color="$primary600" />
                </Center>
                <VStack style={{ flex: 1 }}>
                  <Text size="md" weight="bold" color="$textLight900">
                    Captura de voz
                  </Text>
                  <Text size="2xs" color="$textLight500">
                    {voice.hasMic ? 'Micrófono disponible' : 'Modo demostración (sin micrófono nativo)'}
                  </Text>
                </VStack>
                {voice.isRecording ? (
                  <Box bg="$error50" px="$2.5" py="$1" borderRadius="$full">
                    <Text size="2xs" weight="bold" color="$error600">
                      GRABANDO
                    </Text>
                  </Box>
                ) : null}
              </HStack>

              <HStack space="sm" alignItems="flex-start" p="$3" borderRadius={14} bg="$primary0" mb="$4">
                <Text size="xs" color="$primary800" style={{ flex: 1, lineHeight: 18 }}>
                  Pida al niño/a que emita la vocal <Text weight="bold" size="xs" color="$primary800">«A»</Text> sostenida a un
                  tono e intensidad cómodos durante 5 segundos, con el micrófono a unos 10 cm.
                </Text>
              </HStack>

              {/* nivel + F0 en vivo */}
              <HStack space="md" mb="$4">
                <VStack style={{ flex: 1 }}>
                  <Text size="2xs" color="$textLight500">
                    PITCH EN VIVO
                  </Text>
                  <Text size="xl" weight="bold" color="$primary600" style={{ fontVariant: ['tabular-nums'] }}>
                    {voice.liveF0 ? `${voice.liveF0} Hz` : '— Hz'}
                  </Text>
                </VStack>
                <VStack style={{ flex: 1, justifyContent: 'center' }}>
                  <Text size="2xs" color="$textLight500" mb="$1">
                    NIVEL DE SEÑAL
                  </Text>
                  <Box h={8} borderRadius="$full" bg="$backgroundLight100" style={{ overflow: 'hidden' }}>
                    <View
                      style={{
                        height: '100%',
                        width: `${Math.round(voice.level * 100)}%`,
                        backgroundColor: voice.level > 0.6 ? '#2A7948' : voice.level > 0.3 ? '#FF7F00' : '#D8CFC0',
                        borderRadius: 999,
                      }}
                    />
                  </Box>
                </VStack>
              </HStack>

              {/* progreso */}
              <Box h={8} borderRadius="$full" bg="$backgroundLight100" mb="$4" style={{ overflow: 'hidden' }}>
                <View style={{ height: '100%', width: `${Math.round(voice.progress * 100)}%`, backgroundColor: '#FF7F00', borderRadius: 999 }} />
              </Box>

              {/* controles */}
              <HStack space="sm">
                <Button
                  action="primary"
                  variant="solid"
                  rounded="$xl"
                  style={{ flex: 1 }}
                  isDisabled={voice.isRecording}
                  onPress={voice.startRecording}>
                  <HStack space="sm" alignItems="center">
                    <Icon as={Mic} size="sm" color="$white" />
                    <Text size="sm" weight="bold" color="$white">
                      Grabar voz
                    </Text>
                  </HStack>
                </Button>
                <Button action="secondary" variant="outline" rounded="$xl" isDisabled={!voice.isRecording} onPress={voice.stopRecording}>
                  <Icon as={Square} size="sm" color="$error500" />
                </Button>
              </HStack>
              <Pressable onPress={voice.startDemo} disabled={voice.isRecording} style={{ marginTop: 10 }}>
                <Center py="$2.5" borderRadius={12} borderWidth={1} borderColor="$borderLight200" bg="$white">
                  <HStack space="xs" alignItems="center">
                    <Icon as={Sparkles} size="xs" color="$textLight500" />
                    <Text size="sm" weight="bold" color="$textLight500">
                      Simular voz infantil (demo)
                    </Text>
                  </HStack>
                </Center>
              </Pressable>
            </Card>

            {/* resultados */}
            {r ? (
              <>
                <HStack space="sm">
                  <ParamCard label="F0 · PITCH MEDIO" value={`${r.f0} Hz`} norm="200–320 Hz" status={statusF0(r.f0)} />
                  <ParamCard label="HNR" value={`${r.hnr} dB`} norm="> 20 dB" status={statusHnr(r.hnr)} />
                </HStack>
                <HStack space="sm">
                  <ParamCard label="JITTER" value={`${r.jitter} %`} norm="< 1.0 %" status={statusJitter(r.jitter)} />
                  <ParamCard label="SHIMMER" value={`${r.shimmer} %`} norm="< 3.0 %" status={statusShimmer(r.shimmer)} />
                </HStack>

                <Card bgColor="$white" borderRadius={20} p="$5">
                  <HStack justifyContent="space-between" alignItems="center" mb="$2">
                    <Text size="sm" weight="bold" color="$textLight700" style={{ letterSpacing: 0.3 }}>
                      ESPACIO VOCÁLICO · F1 × F2
                    </Text>
                  </HStack>
                  <VowelSpace f1={r.formants.f1} f2={r.formants.f2} />
                  <HStack justifyContent="space-between" mt="$3">
                    <Text size="sm" weight="bold" style={{ color: '#FF7F00' }}>
                      F1 {r.formants.f1} Hz
                    </Text>
                    <Text size="sm" weight="bold" style={{ color: '#0EA5E9' }}>
                      F2 {r.formants.f2} Hz
                    </Text>
                    <Text size="sm" weight="bold" style={{ color: '#A855F7' }}>
                      F3 {r.formants.f3} Hz
                    </Text>
                  </HStack>
                </Card>

                <Card bgColor="$white" borderRadius={20} p="$5">
                  <Text size="sm" weight="bold" color="$textLight700" mb="$2" style={{ letterSpacing: 0.3 }}>
                    INTERPRETACIÓN CLÍNICA
                  </Text>
                  <Text size="sm" color="$textLight700" style={{ lineHeight: 21 }}>
                    {interpretation}
                  </Text>
                </Card>

                <Card bgColor="$white" borderRadius={20} p="$5">
                  <Text size="sm" weight="bold" color="$textLight700" mb="$2">
                    Observaciones
                  </Text>
                  <Input variant="outline" borderRadius={12} h={80}>
                    <InputField
                      multiline
                      placeholder="Interpretación o notas sobre la calidad vocal…"
                      value={notes}
                      onChangeText={setNotes}
                      style={{ textAlignVertical: 'top' }}
                    />
                  </Input>
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

                <Button
                  action="primary"
                  variant="solid"
                  rounded="$full"
                  isDisabled={isSaving || !evaluatorName.trim() || !evaluatorLicense.trim()}
                  isLoading={isSaving}
                  onPress={handleSave}>
                  <HStack space="sm" alignItems="center">
                    <Icon as={Save} size="sm" color="$white" />
                    <Text size="sm" weight="bold" color="$white">
                      Guardar análisis
                    </Text>
                  </HStack>
                </Button>
              </>
            ) : (
              <Card bgColor="$white" borderRadius={20} p="$6">
                <Center>
                  <Icon as={AudioWaveform} size="xl" color="$textLight300" />
                  <Text size="sm" color="$textLight400" mt="$2" style={{ textAlign: 'center' }}>
                    Grabe o simule una emisión para obtener los parámetros acústicos.
                  </Text>
                </Center>
              </Card>
            )}
          </VStack>
        </ScrollView>
      </VStack>
    </Content>
  );
}
