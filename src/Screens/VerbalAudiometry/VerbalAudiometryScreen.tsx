import React, { useMemo, useState } from 'react';
import { Pressable } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Box, Card, Center, HStack, Icon, Input, InputField, ScrollView, VStack } from '@gluestack-ui/themed';
import { Check, RotateCcw, Save, Volume2 } from 'lucide-react-native';

import { Button, Content, Header, Text } from '@/Components/Common';
import RadialBackground from '@/Components/Themed/RadialBackground';
import { RootStackParamList } from '@/Navigators';
import { RootState } from '@/Store';
import { Evaluation } from '@/Models/Evaluation/Evaluation';
import { VerbalAudiometryTest } from '@/Models/VerbalAudiometry/VerbalAudiometryTest';
import { useClassSelector } from '@/Helpers/ClassTransformer';
import { useCreateVerbalAudiometryMutation } from '@/Services/local/modules/verbalAudiometry';
import { showErrorToast, showSuccessToast } from '@/Helpers/showToast';

import { useVerbalAudiometryTest } from './useVerbalAudiometryTest';
import {
  AgeBand,
  LEVEL_LABEL,
  MAX_REPEATS,
  PRESENTATION_LEVELS,
  VerbalMode,
  interpretVerbal,
  verbalDiscriminationStatus,
} from './verbalAudiometryResult';
import { VERBAL_BANDS } from './verbalAudiometryLists';
import WordCard, { WordCardState } from './components/WordCard';

type Props = NativeStackScreenProps<RootStackParamList, 'VerbalAudiometry'>;

/**
 * Pictogramas PROVISIONALES por palabra (bandas con imagen) mientras no
 * existan las ilustraciones (`assets/img/verbal/*`, Iteración 2). Palabra sin
 * pictograma → WordCard pinta el tile de asset pendiente con la inicial.
 */
const GLYPHS: Record<string, string> = {
  pato: '🦆', gato: '🐱', pan: '🍞', mano: '✋', vaca: '🐄', casa: '🏠', taza: '☕',
  boca: '👄', mono: '🐒', pelota: '⚽', galleta: '🍪', zapato: '👟', manzana: '🍎',
  plátano: '🍌', flor: '🌸', sol: '☀️', pez: '🐟',
  ventana: '🪟', campana: '🔔', cabaña: '🛖', caballo: '🐴', cebolla: '🧅',
  pastilla: '💊', botella: '🍾', rodilla: '🦵', mariposa: '🦋', escalera: '🪜',
  tijeras: '✂️', bandera: '🚩', pájaro: '🐦', lámpara: '💡', cámara: '📷',
  número: '🔢', orejas: '👂', abejas: '🐝', cerezas: '🍒', maderas: '🪵',
  escoba: '🧹', escuela: '🏫', estrella: '⭐', ballena: '🐋', botón: '🔘',
  maleta: '🧳', semilla: '🌱', gallina: '🐔',
  pino: '🌲', vino: '🍷', niño: '👦', pila: '🔋', foca: '🦭', roca: '🪨',
  bota: '👢', gota: '💧', nota: '🎵', gorra: '🧢', rata: '🐀', lata: '🥫',
  pata: '🐾', bata: '🥼', gata: '🐈', rana: '🐸', caña: '🎣', reina: '👑',
  fuente: '⛲', puente: '🌉', diente: '🦷', queso: '🧀', beso: '💋', peso: '⚖️',
  hueso: '🦴', jarra: '🏺', carta: '✉️',
};

const MODE_META: { key: VerbalMode; label: string; hint: string }[] = [
  { key: 'discrimination', label: 'Discriminación', hint: '% aciertos a nivel fijo' },
  { key: 'threshold', label: 'Umbral · URV', hint: 'desciende hasta ≈50 %' },
];

export default function VerbalAudiometryScreen({ navigation }: Props) {
  const activeEvaluation = useClassSelector(Evaluation, (state: RootState) => state.activeEvaluation.evaluation);
  const [createVerbalAudiometry, { isLoading: isSaving }] = useCreateVerbalAudiometryMutation();
  const v = useVerbalAudiometryTest();

  const [notes, setNotes] = useState('');
  const [evaluatorName, setEvaluatorName] = useState(activeEvaluation?.professional?.name ?? '');
  const [evaluatorLicense, setEvaluatorLicense] = useState(activeEvaluation?.professional?.licenseNumber ?? '');

  const patient = activeEvaluation?.patient;
  const patientName = patient ? `${patient.name} ${patient.lastName}`.trim() : null;

  const answered = v.chosen !== null;
  const scoredTotal = v.bandDef.items.filter(i => !i.practice).length;

  /** Estado visual de una tarjeta según la fase de la lámina. */
  const cardStateOf = (word: string): WordCardState => {
    if (!v.played) return 'disabled'; // atenuadas hasta presentar el estímulo
    if (!answered) return 'idle';
    if (word === v.chosen) return v.wasCorrect ? 'correct' : 'wrong';
    if (!v.wasCorrect && v.item && word === v.item.targetWord) return 'revealTarget';
    return 'disabled';
  };

  const assistant = useMemo(() => {
    if (v.completedForLevel) {
      return {
        tag: 'PASADA COMPLETADA',
        text: `Lista completada a ${v.level} dB. Puede repetir la lista a otro nivel o guardar el resultado.`,
        bg: '$success50',
      };
    }
    if (v.isPractice) {
      return {
        tag: 'FAMILIARIZACIÓN',
        text: 'Lámina de práctica (no puntúa): enseñe la mecánica al paciente antes de empezar la prueba.',
        bg: '$primary0',
      };
    }
    if (!v.played) {
      return {
        tag: 'PRESENTAR ESTÍMULO',
        text: `Pulse «Escuchar palabra» para presentar el estímulo a ${v.level} dB (${LEVEL_LABEL[v.level] ?? 'nivel'}). Las tarjetas se habilitan tras la presentación.`,
        bg: '$warning50',
      };
    }
    if (!answered) {
      return {
        tag: 'ESPERANDO RESPUESTA',
        text: `El paciente debe tocar la tarjeta de la palabra oída. Quedan ${MAX_REPEATS - v.repeats} repeticiones de ayuda.`,
        bg: '$warning50',
      };
    }
    return v.wasCorrect
      ? { tag: 'ACIERTO', text: `«${v.item?.targetWord}» reconocida. Pulse «Siguiente» para continuar.`, bg: '$success50' }
      : { tag: 'FALLO', text: `Eligió «${v.chosen}»; la palabra era «${v.item?.targetWord}» (resaltada). Pulse «Siguiente».`, bg: '$error50' };
  }, [v.completedForLevel, v.isPractice, v.played, v.level, v.repeats, v.wasCorrect, v.item, v.chosen, answered]);

  const handleSave = async () => {
    if (isSaving) return;
    if (!evaluatorName.trim() || !evaluatorLicense.trim() || v.score.presentedCount === 0) return;
    if (!activeEvaluation) {
      showErrorToast('No se puede guardar', 'No hay una evaluación activa asociada al paciente.');
      return;
    }
    try {
      const item = new VerbalAudiometryTest();
      item.transducer = 'soundfield';
      item.ageBand = v.band;
      item.modality = v.modality;
      item.mode = v.mode;
      item.results = v.results;
      item.levelScores = v.score.levelScores;
      item.srtDb = v.srtDb;
      item.presentedCount = v.score.presentedCount;
      item.correctCount = v.score.correctCount;
      item.discriminationPct = v.score.discriminationPct;
      item.reliability = v.reliability;
      item.interpretation = interpretVerbal(v.band, v.score, v.srtDb);
      item.notes = [notes.trim(), v.audioEngine !== 'assets' ? 'Estímulo por síntesis de voz (TTS): nivel no calibrado.' : '']
        .filter(Boolean)
        .join(' ');
      item.evaluatorName = evaluatorName.trim();
      item.evaluatorLicense = evaluatorLicense.trim();
      item.completedAt = new Date();
      item.evaluation = { id: activeEvaluation.id } as Evaluation;

      await createVerbalAudiometry(item);
      showSuccessToast('Audiometría verbal guardada', `Discriminación ${v.score.discriminationPct}% a ${v.level} dB.`);
      navigation.goBack();
    } catch {
      showErrorToast('Error al guardar', 'No se pudo registrar la audiometría verbal. Inténtelo de nuevo.');
    }
  };

  const pctStatus = verbalDiscriminationStatus(v.score.discriminationPct);
  const pctColor = pctStatus === 'ok' ? '$success600' : pctStatus === 'warn' ? '$warning600' : '$error600';
  const cardWidth = v.bandDef.optionsPerCard === 4 ? '48.5%' : '31.5%';

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
                    Audiometría verbal
                  </Text>
                  <Box bg="$primary50" px="$2" py="$0.5" borderRadius="$full">
                    <Text size="2xs" weight="bold" color="$primary800" style={{ letterSpacing: 0.4 }}>
                      CAMPO LIBRE · SIN AUDÍFONOS
                    </Text>
                  </Box>
                </HStack>
                <Text size="xs" color="$textLight500">
                  {patientName ?? 'Reconocimiento de palabras por selección de tarjetas'}
                </Text>
              </VStack>
              <HStack space="xs" alignItems="center" bg="$white" borderRadius="$full" px="$3" py="$1.5" borderWidth={1} borderColor="$borderLight100">
                <Text size="sm">⭐</Text>
                <Text size="sm" weight="bold" color="$primary600">
                  {v.score.correctCount}/{scoredTotal}
                </Text>
              </HStack>
            </HStack>

            {/* configuración de la sesión */}
            <Card bgColor="$white" borderRadius={20} p="$4">
              <Text size="sm" weight="bold" color="$textLight900" mb="$2">
                Configuración de la sesión
              </Text>

              <Text size="xs" weight="semiBold" color="$textLight600" mb="$1">
                Banda de edad · lista de estímulos (override manual)
              </Text>
              <HStack space="sm" flexWrap="wrap" mb="$3" style={{ gap: 6 }}>
                {VERBAL_BANDS.map(b => {
                  const on = v.band === b.band;
                  return (
                    <Pressable key={b.band} onPress={() => v.setBand(b.band as AgeBand)}>
                      <Box px="$3" py="$1.5" borderRadius={10} bg={on ? '$textLight900' : '$white'} borderWidth={1.5} borderColor={on ? 'transparent' : '$borderLight200'}>
                        <Text size="xs" weight="bold" color={on ? '$white' : '$textLight600'}>
                          Banda {b.band}
                        </Text>
                        <Text size="2xs" color={on ? '$textLight300' : '$textLight400'}>
                          {b.ages} · {b.label.toLowerCase()}
                        </Text>
                      </Box>
                    </Pressable>
                  );
                })}
              </HStack>

              <Text size="xs" weight="semiBold" color="$textLight600" mb="$1">
                Modo
              </Text>
              <HStack space="sm" mb="$3">
                {MODE_META.map(m => {
                  const on = v.mode === m.key;
                  return (
                    <Pressable key={m.key} style={{ flex: 1 }} onPress={() => v.setMode(m.key)}>
                      <Center py="$2" borderRadius={10} bg={on ? '$primary500' : '$white'} borderWidth={1.5} borderColor={on ? 'transparent' : '$borderLight200'}>
                        <Text size="xs" weight="bold" color={on ? '$white' : '$textLight500'}>{m.label}</Text>
                        <Text size="2xs" color={on ? '$primary100' : '$textLight400'}>{m.hint}</Text>
                      </Center>
                    </Pressable>
                  );
                })}
              </HStack>

              <Text size="xs" weight="semiBold" color="$textLight600" mb="$1">
                Nivel de presentación
              </Text>
              <HStack space="sm" mb="$3">
                {PRESENTATION_LEVELS.map(l => {
                  const on = v.level === l;
                  return (
                    <Pressable key={l} style={{ flex: 1 }} onPress={() => v.setLevel(l)}>
                      <Center py="$2" borderRadius={10} bg={on ? '$primary500' : '$white'} borderWidth={1.5} borderColor={on ? 'transparent' : '$borderLight200'}>
                        <Text size="xs" weight="bold" color={on ? '$white' : '$textLight500'} style={{ fontVariant: ['tabular-nums'] }}>
                          {l} dB
                        </Text>
                        <Text size="2xs" color={on ? '$primary100' : '$textLight400'}>{LEVEL_LABEL[l]}</Text>
                      </Center>
                    </Pressable>
                  );
                })}
              </HStack>

              <Box bg="$warning50" borderRadius={12} p="$2.5">
                <Text size="2xs" color="$warning800" style={{ lineHeight: 15 }}>
                  ⚠️ Nivel orientativo: la presentación por altavoz no está calibrada clínicamente. La salida robusta es
                  el % de discriminación a voz conversacional. Resultado binaural (mejor oído): no descarta pérdida
                  unilateral.
                  {v.audioEngine !== 'assets' ? ' Estímulo por síntesis de voz (TTS): nivel no aplicable.' : ''}
                </Text>
              </Box>
            </Card>

            {/* estímulo */}
            <Card bgColor="$white" borderRadius={20} p="$4">
              <HStack space="sm" alignItems="stretch">
                <Button
                  action="primary"
                  variant="solid"
                  rounded="$xl"
                  style={{ flex: 1 }}
                  isDisabled={!v.item || answered}
                  onPress={v.playStimulus}>
                  <HStack space="sm" alignItems="center">
                    <Icon as={Volume2} size="md" color="$white" />
                    <Text size="md" weight="bold" color="$white">
                      {v.played ? 'Palabra presentada' : 'Escuchar palabra'}
                    </Text>
                  </HStack>
                </Button>
                <Pressable onPress={v.repeatStimulus} disabled={!v.canRepeat}>
                  <Center px="$4" py="$2" borderRadius={14} borderWidth={1.5} borderColor="$borderLight200" bg="$white" style={{ opacity: v.canRepeat ? 1 : 0.45, height: '100%' }}>
                    <Text size="xs" weight="bold" color="$textLight600">Repetir</Text>
                    <Text size="sm" weight="bold" color="$textLight900" style={{ fontVariant: ['tabular-nums'] }}>
                      {v.repeats}/{MAX_REPEATS}
                    </Text>
                  </Center>
                </Pressable>
              </HStack>
              <HStack justifyContent="space-between" alignItems="center" mt="$2.5">
                <Text size="xs" color="$textLight500" style={{ fontVariant: ['tabular-nums'] }}>
                  Lámina {Math.min(v.itemIndex + 1, v.itemTotal)}/{v.itemTotal}
                  {v.isPractice ? ' · práctica' : ''}
                </Text>
                {v.playing ? (
                  <Box bg="$warning50" px="$2.5" py="$1" borderRadius="$full">
                    <Text size="2xs" weight="bold" color="$warning700">SONANDO…</Text>
                  </Box>
                ) : null}
              </HStack>
            </Card>

            {/* tarjetas de selección */}
            <Card bgColor="$white" borderRadius={20} p="$4">
              <Text size="sm" weight="bold" color="$textLight900" mb="$3">
                {v.modality === 'images' ? '¿Qué has oído? Toca su dibujo' : '¿Qué palabra has oído? Toca su tarjeta'}
              </Text>

              {v.completedForLevel ? (
                <VStack space="sm" alignItems="center" py="$4">
                  <Text size="lg" weight="bold" color="$success700">
                    ✓ Lista completada a {v.level} dB
                  </Text>
                  <Text size="xs" color="$textLight500" style={{ textAlign: 'center' }}>
                    Puede repetir la lista a otro nivel (los resultados por nivel se conservan) o guardar el resultado.
                  </Text>
                  <HStack space="sm" mt="$1">
                    {PRESENTATION_LEVELS.filter(l => l !== v.level).map(l => (
                      <Button key={l} action="secondary" variant="outline" rounded="$full" onPress={() => v.setLevel(l)}>
                        <Text size="sm" weight="bold" color="$primary500">
                          Pasada a {l} dB
                        </Text>
                      </Button>
                    ))}
                  </HStack>
                </VStack>
              ) : (
                <>
                  <HStack flexWrap="wrap" justifyContent="space-between" style={{ rowGap: 10 }}>
                    {v.options.map(opt => (
                      <Box key={opt.word} style={{ width: cardWidth, marginBottom: 2 }}>
                        <WordCard
                          word={opt.word}
                          glyph={GLYPHS[opt.word]}
                          modality={v.modality}
                          state={cardStateOf(opt.word)}
                          size={v.band === 'D' ? 'md' : 'lg'}
                          onPress={() => v.choose(opt.word)}
                        />
                      </Box>
                    ))}
                  </HStack>
                  {!v.played ? (
                    <Text size="2xs" color="$textLight400" mt="$2" style={{ textAlign: 'center' }}>
                      Pulse «Escuchar palabra» para habilitar las tarjetas
                    </Text>
                  ) : null}
                </>
              )}

              {/* asistente + siguiente */}
              <HStack space="sm" alignItems="stretch" mt="$3">
                <Box flex={1} bg={assistant.bg} borderRadius={14} p="$3" justifyContent="center">
                  <Text size="2xs" weight="bold" color="$warning700" style={{ letterSpacing: 0.4 }}>{assistant.tag}</Text>
                  <Text size="xs" weight="semiBold" color="$textLight800" mt="$0.5" style={{ lineHeight: 17 }}>
                    {assistant.text}
                  </Text>
                </Box>
                {answered && !v.completedForLevel ? (
                  <Button action="primary" variant="solid" rounded="$xl" onPress={v.next} style={{ width: 120 }}>
                    <Text size="sm" weight="bold" color="$white">Siguiente →</Text>
                  </Button>
                ) : null}
                <Pressable onPress={v.reset}>
                  <Center w={44} borderRadius={12} borderWidth={1} borderColor="$borderLight200" bg="$white" style={{ height: '100%' }}>
                    <Icon as={RotateCcw} size="sm" color="$textLight500" />
                  </Center>
                </Pressable>
              </HStack>
            </Card>

            {/* marcador */}
            <Card bgColor="$white" borderRadius={20} p="$4">
              <Text size="sm" weight="bold" color="$textLight900" mb="$2">
                Marcador de la prueba
              </Text>
              <HStack space="sm">
                <Box flex={1} bg="$backgroundLight50" borderRadius={12} p="$2.5" alignItems="center">
                  <Text size="2xs" color="$textLight400">DISCRIMINACIÓN</Text>
                  <Text size="lg" weight="bold" color={v.score.presentedCount ? pctColor : '$textLight400'}>
                    {v.score.presentedCount ? `${v.score.discriminationPct}%` : '—'}
                  </Text>
                  <Text size="2xs" color="$textLight500">{v.level} dB · {LEVEL_LABEL[v.level] ?? ''}</Text>
                </Box>
                <Box flex={1} bg="$backgroundLight50" borderRadius={12} p="$2.5" alignItems="center">
                  <Text size="2xs" color="$textLight400">ACIERTOS</Text>
                  <Text size="lg" weight="bold" color="$textLight700" style={{ fontVariant: ['tabular-nums'] }}>
                    {v.score.correctCount}/{v.score.presentedCount}
                  </Text>
                  <Text size="2xs" color="$textLight500">láminas respondidas</Text>
                </Box>
                <Box flex={1} bg="$backgroundLight50" borderRadius={12} p="$2.5" alignItems="center">
                  <Text size="2xs" color="$textLight400">FIABILIDAD</Text>
                  <Text size="lg" weight="bold" color={v.reliability === null ? '$textLight400' : v.reliability >= 80 ? '$success600' : '$warning600'}>
                    {v.reliability !== null ? `${v.reliability}%` : '—'}
                  </Text>
                  <Text size="2xs" color="$textLight500">repeticiones de ayuda</Text>
                </Box>
              </HStack>

              {v.score.levelScores.length > 0 ? (
                <VStack space="xs" mt="$3">
                  {v.score.levelScores.map(ls => {
                    const st = verbalDiscriminationStatus(ls.pct);
                    const color = st === 'ok' ? '$success600' : st === 'warn' ? '$warning600' : '$error600';
                    return (
                      <HStack key={ls.level} alignItems="center" justifyContent="space-between">
                        <Text size="xs" color="$textLight500">
                          {ls.level} dB · {LEVEL_LABEL[ls.level] ?? 'nivel'}
                        </Text>
                        <Text size="xs" weight="bold" color={color} style={{ fontVariant: ['tabular-nums'] }}>
                          {ls.pct} % ({ls.correct}/{ls.presented})
                        </Text>
                      </HStack>
                    );
                  })}
                  {v.srtDb !== null ? (
                    <HStack alignItems="center" justifyContent="space-between">
                      <Text size="xs" color="$textLight500">URV estimado</Text>
                      <Text size="xs" weight="bold" color="$textLight700" style={{ fontVariant: ['tabular-nums'] }}>
                        ≈ {v.srtDb} dB
                      </Text>
                    </HStack>
                  ) : null}
                </VStack>
              ) : null}
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
                isDisabled={isSaving || !evaluatorName.trim() || !evaluatorLicense.trim() || v.score.presentedCount === 0}
                isLoading={isSaving}
                onPress={handleSave}>
                <HStack space="sm" alignItems="center">
                  <Icon as={Save} size="sm" color="$white" />
                  <Text size="sm" weight="bold" color="$white">Guardar audiometría verbal</Text>
                </HStack>
              </Button>
              <HStack space="xs" alignItems="center" justifyContent="center" mt="$2">
                <Icon as={Check} size="2xs" color="$textLight400" />
                <Text size="2xs" color="$textLight400" style={{ textAlign: 'center' }}>
                  Medida orientativa sobre el dispositivo. No sustituye equipo certificado ni constituye diagnóstico.
                </Text>
              </HStack>
            </Card>
          </VStack>
        </ScrollView>
      </VStack>
    </Content>
  );
}
