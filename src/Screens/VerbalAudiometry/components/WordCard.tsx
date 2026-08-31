import React, { useState } from 'react';
import { Image, ImageSourcePropType, Pressable } from 'react-native';
import { Center } from '@gluestack-ui/themed';

import { Text } from '@/Components/Common';
import type { CardModality } from '../verbalAudiometryResult';
import { atoms } from '@/Theme/styleAtoms';

/* -------------------------------------------------------------------------- */
/*  WordCard — tarjeta de selección de la Audiometría Verbal.                  */
/*  Un solo componente presentacional para las tres modalidades:               */
/*    · images (Banda A): solo ilustración, sin texto.                         */
/*    · mixed  (Bandas B/C): ilustración dominante + palabra de apoyo.         */
/*    · words  (Banda D, adultos): solo palabra, tipografía grande y sobria.   */
/*                                                                             */
/*  La lámina la gestiona la pantalla: aquí solo se pinta el estado. `onPress` */
/*  únicamente dispara en `idle` (tras responder, la lámina queda bloqueada    */
/*  por la pantalla marcando correct/wrong/revealTarget/disabled).             */
/*                                                                             */
/*  Ilustración: `imageSource` (asset real) > `glyph` (pictograma provisional, */
/*  como los instrumentos de AudiometryScreen) > tile de asset pendiente con   */
/*  la inicial de la palabra (mismo patrón que el mockup .dc.html).            */
/*  Espec: docs/design/audiometria-verbal.md §8 + mockup §2–3.                 */
/* -------------------------------------------------------------------------- */

export type WordCardState = 'idle' | 'correct' | 'wrong' | 'revealTarget' | 'disabled';

export interface WordCardProps {
  word: string;
  /** Asset de la ilustración (obligatoria funcionalmente si modality != 'words'). */
  imageSource?: ImageSourcePropType;
  /** Pictograma provisional (emoji) mientras no exista el asset. */
  glyph?: string;
  modality: CardModality;
  state: WordCardState;
  onPress: () => void;
  /** lg = pediátrico (Bandas A/B/C) · md = adultos (Banda D). */
  size?: 'lg' | 'md';
}

interface StateTokens {
  borderColor: string;
  borderWidth: number;
  bg: string;
  opacity: number;
  badge: '✓' | '✕' | null;
  badgeBg: string;
  halo: boolean;
}

const STATE_TOKENS: Record<WordCardState, StateTokens> = {
  idle: { borderColor: '$borderLight200', borderWidth: 1.5, bg: '$white', opacity: 1, badge: null, badgeBg: 'transparent', halo: false },
  correct: { borderColor: '$success400', borderWidth: 2.5, bg: '$success50', opacity: 1, badge: '✓', badgeBg: '$success500', halo: false },
  wrong: { borderColor: '$error400', borderWidth: 2.5, bg: '$error50', opacity: 1, badge: '✕', badgeBg: '$error500', halo: false },
  revealTarget: { borderColor: '$primary400', borderWidth: 2.5, bg: '$primary0', opacity: 1, badge: null, badgeBg: 'transparent', halo: true },
  disabled: { borderColor: '$borderLight100', borderWidth: 1.5, bg: '$backgroundLight50', opacity: 0.6, badge: null, badgeBg: 'transparent', halo: false },
};

export default function WordCard({
  word,
  imageSource,
  glyph,
  modality,
  state,
  onPress,
  size = 'lg',
}: WordCardProps) {
  const t = STATE_TOKENS[state];
  const lg = size === 'lg';
  const showImage = modality !== 'words';
  const showWord = modality !== 'images';
  // Asset ilegible en runtime (archivo corrupto / no empaquetado): degradar a
  // pictograma o tile — el paciente SIEMPRE debe ver una ilustración en las
  // bandas con imagen, la prueba es autónoma y no puede quedarse en blanco.
  const [imageFailed, setImageFailed] = useState(false);

  // Área táctil pediátrica ≥ 96 px; adultos ≥ 64 px (espec §8).
  const minHeight = lg ? 96 : 64;
  const imgSide = lg ? 96 : 72;

  const illustration = () => {
    if (!showImage) return null;
    if (imageSource && !imageFailed) {
      return (
        <Image
          source={imageSource}
          resizeMode="contain"
          style={{ width: imgSide, height: imgSide }}
          onError={() => setImageFailed(true)}
        />
      );
    }
    if (glyph) {
      return <Text style={{ fontSize: lg ? 54 : 42, lineHeight: lg ? 64 : 50 }}>{glyph}</Text>;
    }
    // Asset pendiente: tile crema con borde discontinuo + inicial (Iteración 2).
    return (
      <Center
        w={imgSide}
        h={imgSide * 0.78}
        borderRadius={12}
        borderWidth={1.5}
        borderColor="$borderLight200"
        bg="$backgroundLight50"
        style={atoms.borderStyleDashed}>
        <Text size={lg ? 'xl' : 'lg'} weight="bold" color="$textLight400">
          {word.charAt(0).toUpperCase()}
        </Text>
      </Center>
    );
  };

  return (
    <Pressable
      onPress={state === 'idle' ? onPress : undefined}
      disabled={state !== 'idle'}
      accessibilityRole="button"
      accessibilityLabel={word}
      accessibilityState={{ disabled: state !== 'idle', selected: state === 'correct' || state === 'wrong' }}>
      <Center
        py={lg ? '$3' : '$2.5'}
        px="$2"
        borderRadius={18}
        borderWidth={t.borderWidth}
        borderColor={t.borderColor}
        bg={t.bg}
        style={{
          minHeight,
          opacity: t.opacity,
          // Halo de "esta era la correcta" (revealTarget), sin depender solo del color.
          ...(t.halo
            ? { shadowColor: '#2563EB', shadowOpacity: 0.35, shadowRadius: 8, shadowOffset: { width: 0, height: 0 }, elevation: 5 }
            : {}),
        }}>
        {illustration()}
        {showWord ? (
          <Text
            size={modality === 'words' ? (lg ? '2xl' : 'xl') : lg ? 'md' : 'sm'}
            weight="bold"
            color="$textLight900"
            mt={showImage ? '$1.5' : undefined}
            style={atoms.textAlignCenter}>
            {word}
          </Text>
        ) : null}

        {/* badge de resultado (esquina superior derecha) */}
        {t.badge ? (
          <Center
            w={24}
            h={24}
            borderRadius="$full"
            bg={t.badgeBg}
            position="absolute"
            style={atoms.top8Right8}>
            <Text size="xs" weight="bold" color="$white">
              {t.badge}
            </Text>
          </Center>
        ) : null}
      </Center>
    </Pressable>
  );
}
