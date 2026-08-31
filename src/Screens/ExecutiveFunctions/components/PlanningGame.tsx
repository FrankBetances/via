import React, { useEffect, useRef, useState } from 'react';
import { Pressable } from 'react-native';
import { Center, HStack, Icon, VStack } from '@gluestack-ui/themed';
import { RotateCcw } from 'lucide-react-native';

import { Text } from '@/Components/Common';
import GameCard from './GameCard';
import { PlanningPlan, PlanningResult } from '../executiveFunctionsGame';

import { useT } from '@/I18n';
/* -------------------------------------------------------------------------- */
/*  «Ordena la historia» — planificación (secuenciación de tarjetas).          */
/*  Las tarjetas aparecen desordenadas; el niño las toca en el orden que cree  */
/*  correcto (cada toque recibe su número). Al completar se corrige con        */
/*  crédito parcial por posición y se pasa a la siguiente historia. Botón      */
/*  «empezar de nuevo» para replantearse antes de terminar (planificar         */
/*  también es corregir el plan).                                              */
/* -------------------------------------------------------------------------- */

const FEEDBACK_MS = 1500;

export default function PlanningGame({
  plan,
  onFinish,
}: {
  plan: PlanningPlan;
  onFinish: (result: PlanningResult) => void;
}) {
  const t = useT();
  const [trialIndex, setTrialIndex] = useState(0);
  const [picks, setPicks] = useState<number[]>([]); // índices sobre `ordered`, en orden de toque
  const [graded, setGraded] = useState<boolean | null>(null); // null = aún eligiendo

  const totals = useRef<PlanningResult>({
    correctPositions: 0,
    totalPositions: 0,
    perfectSequences: 0,
    sequences: 0,
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

  useEffect(() => {
    if (!trial) onFinish(totals.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trialIndex]);

  if (!trial) return null;

  const length = trial.sequence.ordered.length;

  const tap = (orderedIndex: number) => {
    if (graded !== null || picks.includes(orderedIndex)) return;
    const next = [...picks, orderedIndex];
    setPicks(next);
    if (next.length === length) {
      // Corrección con crédito parcial: posición i correcta si se tocó la
      // tarjeta i de la secuencia en el i-ésimo lugar.
      const correct = next.filter((orderedIdx, position) => orderedIdx === position).length;
      const t = totals.current;
      t.correctPositions += correct;
      t.totalPositions += length;
      t.sequences += 1;
      const perfect = correct === length;
      if (perfect) t.perfectSequences += 1;
      setGraded(perfect);
      after(FEEDBACK_MS, () => {
        setPicks([]);
        setGraded(null);
        setTrialIndex(i => i + 1);
      });
    }
  };

  const clear = () => {
    if (graded !== null) return;
    setPicks([]);
  };

  return (
    <VStack space="md" alignItems="center">
      <Center bg="$primary0" borderRadius={14} px="$4" py="$2">
        <Text size="md" weight="bold" color="$primary800">
          {trial.sequence.title}  {t.efGames.tocaTarjetasOrden}
        </Text>
      </Center>

      <HStack flexWrap="wrap" justifyContent="center" style={{ gap: 12, maxWidth: 360 }}>
        {trial.displayOrder.map(orderedIndex => {
          const pickPosition = picks.indexOf(orderedIndex);
          const isPicked = pickPosition !== -1;
          return (
            <GameCard
              key={orderedIndex}
              glyph={trial.sequence.ordered[orderedIndex]}
              state={
                graded === null
                  ? isPicked
                    ? 'done'
                    : 'idle'
                  : // corregida: la tarjeta i era correcta si se tocó en el lugar i
                    pickPosition === orderedIndex
                    ? 'correct'
                    : 'wrong'
              }
              badge={isPicked ? pickPosition + 1 : null}
              onPress={() => tap(orderedIndex)}
              size={length > 4 ? 78 : 90}
            />
          );
        })}
      </HStack>

      {graded !== null ? (
        <Text size="md" weight="bold" color={graded ? '$success700' : '$primary800'}>
          {graded ? t.efGames.historiaPerfecta : t.efGames.buenIntentoMiraOrdenCorrecto}
        </Text>
      ) : (
        <Pressable onPress={clear} disabled={!picks.length}>
          <HStack space="xs" alignItems="center" style={{ opacity: picks.length ? 1 : 0.4 }}>
            <Icon as={RotateCcw} size="xs" color="$textLight500" />
            <Text size="xs" weight="bold" color="$textLight500">
              
              {t.efGames.empezarEstaHistoriaNuevo}
            </Text>
          </HStack>
        </Pressable>
      )}

      <HStack space="xs">
        {plan.trials.map((_, i) => (
          <Center key={i} w={8} h={8} borderRadius="$full" bg={i < trialIndex ? '$primary400' : '$backgroundLight200'} />
        ))}
      </HStack>
    </VStack>
  );
}
