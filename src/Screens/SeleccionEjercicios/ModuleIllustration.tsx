import React from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Circle, Line, Path, Rect, Text as SvgText } from 'react-native-svg';

/* -------------------------------------------------------------------------- */
/*  ModuleIllustration — escena SVG temática que decora la cabecera de cada    */
/*  tarjeta de módulo. Cada escena alude al contenido clínico de la prueba     */
/*  (forma de onda para voz, curva de audiograma para audiometría, onda de    */
/*  pulso para disfagia…) dibujada en el color de acento del módulo con        */
/*  opacidades bajas para no competir con el icono principal.                  */
/* -------------------------------------------------------------------------- */

interface Props {
  moduleId: string;
  color: string;
}

/** Forma de onda de voz: barras verticales tipo espectrograma. */
function VoiceScene({ color }: { color: string }) {
  const heights = [12, 26, 40, 20, 52, 32, 58, 36, 22, 44, 28, 14];
  return (
    <>
      {heights.map((h, i) => {
        const x = 40 + i * 13;
        return (
          <Line
            key={i}
            x1={x}
            y1={48 - h / 2}
            x2={x}
            y2={48 + h / 2}
            stroke={color}
            strokeWidth={4}
            strokeLinecap="round"
            opacity={i % 2 === 0 ? 0.28 : 0.16}
          />
        );
      })}
    </>
  );
}

/** Curva de audiograma descendente con marcadores circulares (símbolo "O"). */
function AudiogramScene({ color }: { color: string }) {
  const marks: Array<[number, number]> = [
    [50, 26],
    [86, 32],
    [122, 46],
    [156, 62],
    [186, 72],
  ];
  return (
    <>
      {[24, 48, 72].map(y => (
        <Line key={y} x1={40} y1={y} x2={196} y2={y} stroke={color} strokeWidth={1} opacity={0.08} />
      ))}
      <Path
        d="M50 26 C 78 28, 100 36, 122 46 S 168 68, 186 72"
        stroke={color}
        strokeWidth={2.5}
        fill="none"
        opacity={0.3}
      />
      {marks.map(([cx, cy], i) => (
        <Circle key={i} cx={cx} cy={cy} r={5} stroke={color} strokeWidth={2} fill="#FFFFFF" opacity={0.55} />
      ))}
    </>
  );
}

/** Vía de tren (raíles + traviesas) con notas musicales del juego sonoro. */
function TrainScene({ color }: { color: string }) {
  return (
    <>
      <Line x1={30} y1={70} x2={200} y2={70} stroke={color} strokeWidth={2.5} opacity={0.28} />
      <Line x1={30} y1={78} x2={200} y2={78} stroke={color} strokeWidth={2.5} opacity={0.28} />
      {[46, 74, 102, 130, 158, 186].map(x => (
        <Line key={x} x1={x} y1={66} x2={x} y2={82} stroke={color} strokeWidth={2.5} opacity={0.16} />
      ))}
      {/* corcheas */}
      <Path d="M150 18 v16 a4 4 0 1 1 -3 -4" stroke={color} strokeWidth={2.5} fill="none" opacity={0.35} />
      <Path d="M178 26 v14 a3.5 3.5 0 1 1 -3 -3.5" stroke={color} strokeWidth={2.5} fill="none" opacity={0.22} />
    </>
  );
}

/** Abanico de tarjetas de palabras del reconocimiento verbal. */
function WordCardsScene({ color }: { color: string }) {
  return (
    <>
      <Rect x={118} y={22} width={30} height={40} rx={6} stroke={color} strokeWidth={2} fill="#FFFFFF" opacity={0.35} transform="rotate(-10 133 42)" />
      <Rect x={148} y={20} width={30} height={40} rx={6} stroke={color} strokeWidth={2} fill="#FFFFFF" opacity={0.5} />
      <Rect x={178} y={22} width={30} height={40} rx={6} stroke={color} strokeWidth={2} fill="#FFFFFF" opacity={0.35} transform="rotate(10 193 42)" />
      <Circle cx={163} cy={34} r={5} stroke={color} strokeWidth={2} fill="none" opacity={0.4} />
      <Line x1={156} y1={48} x2={170} y2={48} stroke={color} strokeWidth={2} strokeLinecap="round" opacity={0.4} />
      <Line x1={158} y1={54} x2={168} y2={54} stroke={color} strokeWidth={2} strokeLinecap="round" opacity={0.25} />
    </>
  );
}

/** Bocadillos de conversación de la repetición de palabras. */
function SpeechScene({ color }: { color: string }) {
  return (
    <>
      <Path
        d="M120 16 h52 a10 10 0 0 1 10 10 v12 a10 10 0 0 1 -10 10 h-34 l-10 10 v-10 h-8 a10 10 0 0 1 -10 -10 v-12 a10 10 0 0 1 10 -10 z"
        stroke={color}
        strokeWidth={2}
        fill="#FFFFFF"
        opacity={0.45}
      />
      {[138, 150, 162].map(cx => (
        <Circle key={cx} cx={cx} cy={32} r={2.5} fill={color} opacity={0.45} />
      ))}
      <Path
        d="M96 52 h30 a8 8 0 0 1 8 8 v6 a8 8 0 0 1 -8 8 h-16 l-8 8 v-8 h-6 a8 8 0 0 1 -8 -8 v-6 a8 8 0 0 1 8 -8 z"
        stroke={color}
        strokeWidth={2}
        fill="#FFFFFF"
        opacity={0.28}
      />
    </>
  );
}

/** Onda de pletismografía (pulsioximetría) del cribado de disfagia. */
function PulseScene({ color }: { color: string }) {
  return (
    <>
      <Path
        d="M36 56 h24 l8 -20 l8 32 l8 -16 h28 l8 -20 l8 32 l8 -16 h28 l8 -20 l8 32 l8 -12"
        stroke={color}
        strokeWidth={2.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        fill="none"
        opacity={0.3}
      />
      <Circle cx={186} cy={26} r={8} stroke={color} strokeWidth={2} fill="none" opacity={0.25} />
      <SvgText x={186} y={30} textAnchor="middle" fontSize={9} fontWeight="bold" fill={color} opacity={0.4}>
        %
      </SvgText>
    </>
  );
}

/** Constelación de piezas y destellos del cribado conductual. */
function PuzzleScene({ color }: { color: string }) {
  return (
    <>
      <Path d="M160 14 l3.2 10 l10 3.2 l-10 3.2 l-3.2 10 l-3.2 -10 l-10 -3.2 l10 -3.2 z" fill={color} opacity={0.3} />
      <Path d="M122 46 l2.2 7 l7 2.2 l-7 2.2 l-2.2 7 l-2.2 -7 l-7 -2.2 l7 -2.2 z" fill={color} opacity={0.2} />
      <Circle cx={188} cy={52} r={6} stroke={color} strokeWidth={2} fill="none" opacity={0.3} />
      <Circle cx={142} cy={22} r={3.5} fill={color} opacity={0.15} />
      <Circle cx={172} cy={72} r={4.5} fill={color} opacity={0.18} />
      <Circle cx={112} cy={70} r={3} fill={color} opacity={0.14} />
    </>
  );
}

/** Zzz y destellos nocturnos del cribado de sueño. */
function SleepScene({ color }: { color: string }) {
  return (
    <>
      <SvgText x={132} y={46} fontSize={30} fontWeight="bold" fill={color} opacity={0.3}>
        Z
      </SvgText>
      <SvgText x={158} y={34} fontSize={21} fontWeight="bold" fill={color} opacity={0.22}>
        Z
      </SvgText>
      <SvgText x={176} y={24} fontSize={14} fontWeight="bold" fill={color} opacity={0.16}>
        Z
      </SvgText>
      <Path d="M186 56 l2.4 7.6 l7.6 2.4 l-7.6 2.4 l-2.4 7.6 l-2.4 -7.6 l-7.6 -2.4 l7.6 -2.4 z" fill={color} opacity={0.22} />
      <Circle cx={124} cy={66} r={3.5} fill={color} opacity={0.15} />
    </>
  );
}

const SCENES: Record<string, React.ComponentType<{ color: string }>> = {
  VoiceAnalysis: VoiceScene,
  Audiometry: AudiogramScene,
  AudiometryConditioned: TrainScene,
  VerbalAudiometry: WordCardsScene,
  Articulation: SpeechScene,
  DysphagiaTest: PulseScene,
  Mchat: PuzzleScene,
  SahsScreening: SleepScene,
};

export default function ModuleIllustration({ moduleId, color }: Props) {
  const Scene = SCENES[moduleId] ?? VoiceScene;
  return (
    <Svg
      style={StyleSheet.absoluteFill}
      viewBox="0 0 210 96"
      preserveAspectRatio="xMaxYMid slice"
      pointerEvents="none">
      <Scene color={color} />
    </Svg>
  );
}
