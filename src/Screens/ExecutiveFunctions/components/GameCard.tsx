import React from 'react';
import { Pressable } from 'react-native';
import { Center } from '@gluestack-ui/themed';

import { Text } from '@/Components/Common';

/* -------------------------------------------------------------------------- */
/*  GameCard — tarjeta de los mini-juegos de funciones ejecutivas.             */
/*  Presentacional puro: emoji grande + fondo/borde opcionales (p. ej. el      */
/*  color del DCCS) + estado visual + insignia de orden (planificación).       */
/* -------------------------------------------------------------------------- */

export type GameCardState = 'idle' | 'correct' | 'wrong' | 'lit' | 'disabled' | 'done';

export interface GameCardProps {
  glyph: string;
  state: GameCardState;
  onPress?: () => void;
  /** Fondo/borde propios (DCCS); si no, los del estado. */
  bg?: string;
  borderColor?: string;
  /** Insignia numérica (orden elegido en planificación). */
  badge?: number | null;
  /** Lado de la tarjeta en px. */
  size?: number;
}

const STATE_STYLE: Record<GameCardState, { bg: string; border: string; opacity: number }> = {
  idle: { bg: '#FFFFFF', border: '#E5DED2', opacity: 1 },
  correct: { bg: '#DCFCE7', border: '#4ADE80', opacity: 1 },
  wrong: { bg: '#FEE2E2', border: '#F87171', opacity: 1 },
  lit: { bg: '#FEF3C7', border: '#F59E0B', opacity: 1 },
  disabled: { bg: '#FAF7F2', border: '#EFE9DE', opacity: 0.55 },
  done: { bg: '#F1F5F9', border: '#CBD5E1', opacity: 0.8 },
};

export default function GameCard({
  glyph,
  state,
  onPress,
  bg,
  borderColor,
  badge = null,
  size = 88,
}: GameCardProps) {
  const s = STATE_STYLE[state];
  const interactive = (state === 'idle' || state === 'lit') && !!onPress;
  return (
    <Pressable onPress={interactive ? onPress : undefined} disabled={!interactive} accessibilityRole="button">
      <Center
        style={{
          width: size,
          height: size,
          borderRadius: 18,
          borderWidth: 2.5,
          borderColor: borderColor ?? s.border,
          backgroundColor: bg ?? s.bg,
          opacity: s.opacity,
        }}>
        <Text style={{ fontSize: size * 0.5, lineHeight: size * 0.62 }}>{glyph}</Text>
        {badge !== null ? (
          <Center
            w={26}
            h={26}
            borderRadius="$full"
            bg="$primary600"
            position="absolute"
            style={{ top: -8, right: -8 }}>
            <Text size="xs" weight="bold" color="$white">
              {badge}
            </Text>
          </Center>
        ) : null}
      </Center>
    </Pressable>
  );
}
