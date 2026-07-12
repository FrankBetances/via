import React, { useEffect, useRef, useState } from 'react';
import { HStack, VStack, Center } from '@gluestack-ui/themed';

import { Text } from '@/Components/Common';
import GameCard, { GameCardState } from './GameCard';
import { AttentionPlan, AttentionResult } from '../executiveFunctionsGame';

/* -------------------------------------------------------------------------- */
/*  «Busca y encuentra» — atención (búsqueda visual).                          */
/*  Lámina fija con objetivos y distractores: el niño toca TODOS los           */
/*  objetivos. Los distractores tocados parpadean en rojo y cuentan como       */
/*  comisión. Termina al encontrar el último objetivo.                         */
/* -------------------------------------------------------------------------- */

export default function AttentionGame({
  plan,
  onFinish,
}: {
  plan: AttentionPlan;
  onFinish: (result: AttentionResult) => void;
}) {
  const [found, setFound] = useState<Set<number>>(() => new Set());
  const [wrongFlash, setWrongFlash] = useState<number | null>(null);
  const falseTaps = useRef(0);
  const startTs = useRef(Date.now());
  const finished = useRef(false);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finishTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (flashTimer.current) clearTimeout(flashTimer.current);
      if (finishTimer.current) clearTimeout(finishTimer.current);
    },
    [],
  );

  const tap = (index: number) => {
    if (finished.current || found.has(index)) return;
    const card = plan.cards[index];
    if (card.isTarget) {
      const nextFound = new Set(found);
      nextFound.add(index);
      setFound(nextFound);
      if (nextFound.size >= plan.targetCount) {
        finished.current = true;
        const result: AttentionResult = {
          targets: plan.targetCount,
          hits: nextFound.size,
          falseTaps: falseTaps.current,
          elapsedMs: Date.now() - startTs.current,
        };
        finishTimer.current = setTimeout(() => onFinish(result), 900);
      }
    } else {
      falseTaps.current += 1;
      setWrongFlash(index);
      if (flashTimer.current) clearTimeout(flashTimer.current);
      flashTimer.current = setTimeout(() => setWrongFlash(null), 500);
    }
  };

  const stateOf = (index: number): GameCardState => {
    if (found.has(index)) return 'correct';
    if (wrongFlash === index) return 'wrong';
    return 'idle';
  };

  const remaining = plan.targetCount - found.size;

  return (
    <VStack space="md" alignItems="center">
      <Center bg="$primary0" borderRadius={14} px="$4" py="$2">
        <Text size="md" weight="bold" color="$primary800">
          {remaining > 0
            ? `Busca ${remaining === plan.targetCount ? 'todos los' : 'los que faltan:'} ${plan.targetGlyph} (${remaining})`
            : '¡Los has encontrado todos! 🎉'}
        </Text>
      </Center>
      <HStack flexWrap="wrap" justifyContent="center" style={{ gap: 10 }}>
        {plan.cards.map((card, index) => (
          <GameCard key={index} glyph={card.glyph} state={stateOf(index)} onPress={() => tap(index)} size={plan.cards.length > 12 ? 74 : 86} />
        ))}
      </HStack>
    </VStack>
  );
}
