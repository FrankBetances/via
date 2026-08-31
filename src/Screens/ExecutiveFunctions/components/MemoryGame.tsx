import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Center, HStack, VStack } from '@gluestack-ui/themed';

import { Text } from '@/Components/Common';
import GameCard from './GameCard';
import { useT } from '@/I18n';
import {
  buildMemorySequence,
  expectedMemoryAnswer,
  MemoryPlan,
  MemoryResult,
} from '../executiveFunctionsGame';

/* -------------------------------------------------------------------------- */
/*  «El loro repetidor» — memoria de trabajo (span de tarjetas).               */
/*  Las tarjetas del tablero se iluminan en secuencia; el niño la repite       */
/*  tocándolas en el mismo orden (bandas A–C) o AL REVÉS (banda D, span        */
/*  inverso). Dos intentos por longitud; avanza con uno correcto y termina     */
/*  tras fallar los dos. Un toque erróneo cierra el intento (feedback          */
/*  amable) — no hay «rachas» punitivas, es un juego.                          */
/* -------------------------------------------------------------------------- */

type Stage = 'watch' | 'answer' | 'feedback';

export default function MemoryGame({
  plan,
  seed,
  onFinish,
}: {
  plan: MemoryPlan;
  seed: number;
  onFinish: (result: MemoryResult) => void;
}) {
  const t = useT();
  const [span, setSpan] = useState(plan.startSpan);
  const [attempt, setAttempt] = useState(1);
  const [stage, setStage] = useState<Stage>('watch');
  const [litIndex, setLitIndex] = useState<number | null>(null);
  const [tapped, setTapped] = useState<number[]>([]);
  const [lastOk, setLastOk] = useState<boolean | null>(null);

  const sequence = useRef<number[]>([]);
  const bestSpan = useRef(0);
  const trialsDone = useRef(0);
  const finished = useRef(false);
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

  const finish = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    onFinish({
      direction: plan.direction,
      startSpan: plan.startSpan,
      maxSpan: plan.maxSpan,
      bestSpan: bestSpan.current,
      trialsDone: trialsDone.current,
    });
  }, [onFinish, plan]);

  // Reproducción de la secuencia (fase «mira»): iluminar tarjeta a tarjeta.
  useEffect(() => {
    if (stage !== 'watch' || finished.current) return;
    sequence.current = buildMemorySequence(plan, span, seed + attempt * 7919);
    setTapped([]);
    setLastOk(null);
    let delay = 600; // respiro antes del primer destello
    sequence.current.forEach(cardIndex => {
      after(delay, () => setLitIndex(cardIndex));
      after(delay + plan.litMs, () => setLitIndex(null));
      delay += plan.litMs + plan.gapMs;
    });
    after(delay + 150, () => setStage('answer'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, span, attempt]);

  const settleAttempt = (ok: boolean) => {
    trialsDone.current += 1;
    setLastOk(ok);
    setStage('feedback');
    after(1100, () => {
      if (ok) {
        bestSpan.current = Math.max(bestSpan.current, span);
        if (span >= plan.maxSpan) {
          finish();
          return;
        }
        setSpan(s => s + 1);
        setAttempt(1);
      } else if (attempt < plan.attemptsPerSpan) {
        setAttempt(a => a + 1);
      } else {
        finish();
        return;
      }
      setStage('watch');
    });
  };

  const tap = (cardIndex: number) => {
    if (stage !== 'answer' || finished.current) return;
    const expected = expectedMemoryAnswer(sequence.current, plan.direction);
    const position = tapped.length;
    if (cardIndex === expected[position]) {
      const next = [...tapped, cardIndex];
      setTapped(next);
      if (next.length === expected.length) settleAttempt(true);
    } else {
      settleAttempt(false);
    }
  };

  const instruction =
    stage === 'watch'
      ? '👀 Mira con atención…'
      : stage === 'answer'
        ? plan.direction === 'backward'
          ? '¡Ahora tú, pero AL REVÉS! 🔁'
          : '¡Ahora tú! Repite el orden 🦜'
        : lastOk
          ? '¡Perfecto! 🎉 Ahora una más larga…'
          : attempt < plan.attemptsPerSpan
            ? '¡Casi! Prueba otra vez 💪'
            : '¡Buen trabajo! 🦜';

  return (
    <VStack space="md" alignItems="center">
      <Center bg="$primary0" borderRadius={14} px="$4" py="$2">
        <Text size="md" weight="bold" color="$primary800">
          {instruction}
        </Text>
      </Center>

      <HStack flexWrap="wrap" justifyContent="center" style={{ gap: 12, maxWidth: 340 }}>
        {plan.board.map((glyph, index) => (
          <GameCard
            key={index}
            glyph={glyph}
            state={
              litIndex === index
                ? 'lit'
                : stage === 'answer'
                  ? tapped.includes(index) && plan.direction === 'forward'
                    ? 'correct'
                    : 'idle'
                  : 'disabled'
            }
            onPress={() => tap(index)}
            size={plan.board.length > 4 ? 88 : 100}
          />
        ))}
      </HStack>

      <HStack space="xs" alignItems="center">
        <Text size="xs" color="$textLight500">
          
          {t.efGames.secuencia} {span}
        </Text>
        {stage === 'answer' ? (
          <Text size="xs" weight="bold" color="$primary600">
            · {tapped.length}/{span}
          </Text>
        ) : null}
      </HStack>
    </VStack>
  );
}
