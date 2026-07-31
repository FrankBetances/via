import React, { useEffect, useRef, useState } from 'react';
import { Center, HStack, VStack } from '@gluestack-ui/themed';

import { Text } from '@/Components/Common';
import GameCard from './GameCard';
import {
  EF_COLOR_BG,
  EF_COLOR_BORDER,
  EF_SHAPE_GLYPH,
  FlexibilityPlan,
  FlexibilityResult,
  flexibilityAnswerIndex,
} from '../executiveFunctionsGame';
import { speakRuleConsigna } from '../efSpeech';

/* -------------------------------------------------------------------------- */
/*  «El juego de las normas» — flexibilidad cognitiva (DCCS).                  */
/*  Arriba la tarjeta estímulo (forma sobre color); abajo las dos tarjetas     */
/*  objetivo fijas, en conflicto. La norma vigente (COLOR o FORMA) se anuncia  */
/*  en grande y CAMBIA a mitad de juego (y por ensayo en el bloque mixto).     */
/* -------------------------------------------------------------------------- */

const FEEDBACK_MS = 900;
const RULE_CHANGE_MS = 1600; // aviso grande de cambio de norma antes del ensayo

export default function FlexibilityGame({
  plan,
  onFinish,
  lang = 'es',
}: {
  plan: FlexibilityPlan;
  onFinish: (result: FlexibilityResult) => void;
  /** Lengua de sesión: los anuncios de norma se dictaban siempre en castellano. */
  lang?: string;
}) {
  const [trialIndex, setTrialIndex] = useState(0);
  const [chosen, setChosen] = useState<0 | 1 | null>(null);
  const [showRuleChange, setShowRuleChange] = useState(false);

  const counts = useRef<FlexibilityResult>({
    preCorrect: 0,
    preTotal: 0,
    postCorrect: 0,
    postTotal: 0,
    mixedCorrect: 0,
    mixedTotal: 0,
  });
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const after = (ms: number, fn: () => void) => {
    timers.current.push(setTimeout(fn, ms));
  };

  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout);
    },
    [],
  );

  const trial = plan.trials[trialIndex] ?? null;

  // Aviso grande + DICTADO cuando cambia la norma: el niño debe enterarse del
  // cambio aunque no sepa leer (el aviso visual solo no basta en bandas A/B).
  useEffect(() => {
    if (!trial) {
      onFinish(counts.current);
      return;
    }
    if (trial.ruleChanged) {
      setShowRuleChange(true);
      speakRuleConsigna(trial.rule, true, lang);
      const t = setTimeout(() => setShowRuleChange(false), RULE_CHANGE_MS);
      timers.current.push(t);
      return () => clearTimeout(t);
    }
    if (trialIndex === 0) {
      // Anuncio de la norma inicial (la consigna de la antesala es genérica).
      speakRuleConsigna(trial.rule, false, lang);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trialIndex]);

  const answerIdx = trial ? flexibilityAnswerIndex(plan.targets, trial) : 0;
  const wasCorrect = chosen !== null && chosen === answerIdx;

  const tap = (index: 0 | 1) => {
    if (!trial || chosen !== null || showRuleChange) return;
    setChosen(index);
    const ok = index === flexibilityAnswerIndex(plan.targets, trial);
    const c = counts.current;
    if (trial.block === 'pre') {
      c.preTotal += 1;
      if (ok) c.preCorrect += 1;
    } else if (trial.block === 'post') {
      c.postTotal += 1;
      if (ok) c.postCorrect += 1;
    } else {
      c.mixedTotal += 1;
      if (ok) c.mixedCorrect += 1;
    }
    after(FEEDBACK_MS, () => {
      setChosen(null);
      setTrialIndex(i => i + 1);
    });
  };

  if (!trial) return null;

  const ruleBanner =
    trial.rule === 'color'
      ? { text: 'NORMA: por COLOR 🎨', bg: '$warning50', color: '$warning800' }
      : { text: 'NORMA: por FORMA 🐟🌸', bg: '$primary0', color: '$primary800' };

  return (
    <VStack space="md" alignItems="center">
      {showRuleChange ? (
        <Center bg="$error50" borderRadius={16} px="$5" py="$3">
          <Text size="lg" weight="bold" color="$error600">
            ¡La norma ha cambiado! 🔄
          </Text>
          <Text size="md" weight="bold" color="$textLight800" mt="$1">
            Ahora se juega {trial.rule === 'color' ? 'por COLOR' : 'por FORMA'}
          </Text>
        </Center>
      ) : (
        <Center bg={ruleBanner.bg} borderRadius={14} px="$4" py="$2">
          <Text size="md" weight="bold" color={ruleBanner.color}>
            {ruleBanner.text}
          </Text>
        </Center>
      )}

      {/* estímulo */}
      <VStack alignItems="center" space="xs">
        <Text size="2xs" color="$textLight400">
          ¿DÓNDE VA ESTA TARJETA?
        </Text>
        <GameCard
          glyph={EF_SHAPE_GLYPH[trial.stimulus.shape]}
          state="idle"
          bg={EF_COLOR_BG[trial.stimulus.color]}
          borderColor={EF_COLOR_BORDER[trial.stimulus.color]}
          size={110}
        />
      </VStack>

      <Text size="xl" color="$textLight300">
        ↓
      </Text>

      {/* objetivos */}
      <HStack space="xl">
        {plan.targets.map((target, index) => (
          <GameCard
            key={index}
            glyph={EF_SHAPE_GLYPH[target.shape]}
            state={
              chosen === null
                ? showRuleChange
                  ? 'disabled'
                  : 'idle'
                : chosen === index
                  ? wasCorrect
                    ? 'correct'
                    : 'wrong'
                  : 'disabled'
            }
            bg={chosen === null || chosen !== index ? EF_COLOR_BG[target.color] : undefined}
            borderColor={EF_COLOR_BORDER[target.color]}
            onPress={() => tap(index as 0 | 1)}
            size={100}
          />
        ))}
      </HStack>

      {chosen !== null ? (
        <Text size="md" weight="bold" color={wasCorrect ? '$success700' : '$error600'}>
          {wasCorrect ? '¡Muy bien! 🎉' : '¡Casi! Sigue así 💪'}
        </Text>
      ) : (
        <Text size="md" color="$textLight400">
          {' '}
        </Text>
      )}

      <HStack space="xs">
        {plan.trials.map((_, i) => (
          <Center key={i} w={8} h={8} borderRadius="$full" bg={i < trialIndex ? '$primary400' : '$backgroundLight200'} />
        ))}
      </HStack>
    </VStack>
  );
}
