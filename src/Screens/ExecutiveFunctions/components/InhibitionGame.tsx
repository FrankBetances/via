import React, { useEffect, useRef, useState } from 'react';
import { Center, HStack, VStack } from '@gluestack-ui/themed';

import { Text } from '@/Components/Common';
import GameCard from './GameCard';
import { InhibitionPlan, InhibitionResult } from '../executiveFunctionsGame';

import { useT } from '@/I18n';
/* -------------------------------------------------------------------------- */
/*  «No despiertes al lobo» — inhibición (go/no-go).                           */
/*  Las tarjetas aparecen UNA A UNA con ventana de respuesta cronometrada:     */
/*  tocar cada animal (go) y aguantarse con el lobo (no-go). Sin respuesta a   */
/*  tiempo: omisión (go) o rechazo correcto (no-go). Avanza solo.              */
/* -------------------------------------------------------------------------- */

const GAP_MS = 450; // pantalla en blanco entre ensayos
const FEEDBACK_MS = 550; // tras un toque, feedback breve antes de avanzar

export default function InhibitionGame({
  plan,
  onFinish,
}: {
  plan: InhibitionPlan;
  onFinish: (result: InhibitionResult) => void;
}) {
  const t = useT();
  const [trialIndex, setTrialIndex] = useState(0);
  const [visible, setVisible] = useState(false);
  const [feedback, setFeedback] = useState<'hit' | 'oops' | null>(null);

  const counts = useRef({ goHits: 0, omissions: 0, commissions: 0 });
  const answered = useRef(false);
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

  const advance = () => {
    setVisible(false);
    setFeedback(null);
    after(GAP_MS, () => setTrialIndex(i => i + 1));
  };

  // Ciclo de cada ensayo: mostrar → ventana de respuesta → resolver sin toque.
  useEffect(() => {
    if (!trial) {
      const c = counts.current;
      const nogoTrials = plan.trials.filter(t => t.isNogo).length;
      onFinish({
        goTrials: plan.trials.length - nogoTrials,
        nogoTrials,
        goHits: c.goHits,
        omissions: c.omissions,
        commissions: c.commissions,
      });
      return;
    }
    answered.current = false;
    setVisible(true);
    const t = setTimeout(() => {
      if (answered.current) return;
      answered.current = true;
      // Sin respuesta: omisión si era go; rechazo correcto (silencioso) si no-go.
      if (!trial.isNogo) counts.current.omissions += 1;
      advance();
    }, plan.stimulusMs);
    timers.current.push(t);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trialIndex]);

  const tap = () => {
    if (!trial || answered.current || !visible) return;
    answered.current = true;
    if (trial.isNogo) {
      counts.current.commissions += 1;
      setFeedback('oops');
    } else {
      counts.current.goHits += 1;
      setFeedback('hit');
    }
    after(FEEDBACK_MS, advance);
  };

  return (
    <VStack space="md" alignItems="center">
      <Center bg="$primary0" borderRadius={14} px="$4" py="$2">
        <Text size="md" weight="bold" color="$primary800">
          
          {t.efGames.tocaAnimalesPero} {plan.nogoGlyph}  {t.efGames.niTocarlo}
        </Text>
      </Center>

      <Center style={{ height: 180 }}>
        {trial && visible ? (
          <GameCard
            glyph={trial.glyph}
            state={feedback === 'hit' ? 'correct' : feedback === 'oops' ? 'wrong' : 'idle'}
            onPress={tap}
            size={150}
          />
        ) : (
          <Text size="2xl" color="$textLight300">
            ·
          </Text>
        )}
      </Center>

      {feedback === 'oops' ? (
        <Text size="md" weight="bold" color="$error600">
          
          {t.efGames.shhhEraLobo}
        </Text>
      ) : feedback === 'hit' ? (
        <Text size="md" weight="bold" color="$success700">
          
          {t.efGames.bien}
        </Text>
      ) : (
        <Text size="md" color="$textLight400">
          {' '}
        </Text>
      )}

      <HStack space="xs">
        {plan.trials.map((_, i) => (
          <Center
            key={i}
            w={8}
            h={8}
            borderRadius="$full"
            bg={i < trialIndex ? '$primary400' : '$backgroundLight200'}
          />
        ))}
      </HStack>
    </VStack>
  );
}
