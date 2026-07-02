import React, { useMemo } from 'react';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';

/* -------------------------------------------------------------------------- */
/*  ViaIcon — isotipo de VIA+: tesela redondeada con la onda de voz (7 barras */
/*  simétricas) y el signo "+" en la esquina superior derecha.                */
/*                                                                            */
/*  El "+" se dibuja con dos <Rect> vectoriales (no con <Text> SVG, que       */
/*  depende de la fuente del dispositivo y en Android puede no renderizarse). */
/*  Los colores de gradiente usan hex + stopOpacity (react-native-svg no      */
/*  aplica de forma fiable el alfa embebido en cadenas rgba() de stopColor).  */
/*  Los ids de gradiente llevan un sufijo por instancia: en react-native-svg  */
/*  los ids son globales y dos ViaIcon montados a la vez se pisarían.         */
/* -------------------------------------------------------------------------- */

interface ViaIconProps {
  size?: number;
  variant?: 'color' | 'ink' | 'white';
}

const BARS = [26, 46, 74, 100, 74, 46, 26];
const BAR_W = 9;
const GAP = 9;
const TILE = 150;
const TOTAL_BAR_W = BARS.length * BAR_W + (BARS.length - 1) * GAP; // 117
const START_X = (TILE - TOTAL_BAR_W) / 2; // 16.5
const CENTER_Y = TILE / 2; // 75

/* Signo "+" vectorial (esquina superior derecha). */
const PLUS_CX = 116;
const PLUS_CY = 36;
const PLUS_ARM = 22; // longitud total de cada brazo
const PLUS_W = 7; // grosor del trazo

let instanceCounter = 0;

export default function ViaIcon({ size = 150, variant = 'color' }: ViaIconProps) {
  const uid = useMemo(() => `via-${++instanceCounter}`, []);
  const bgGradId = `${uid}-bg`;
  const glossGradId = `${uid}-gloss`;

  const barFill = variant === 'white' ? '#3A352F' : '#FFFFFF';
  const plusFill = variant === 'color' ? '#FFFFFF' : '#FF7F00';
  const bgFill =
    variant === 'color' ? `url(#${bgGradId})` : variant === 'ink' ? '#3A352F' : '#FFFFFF';

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${TILE} ${TILE}`}>
      <Defs>
        <LinearGradient id={bgGradId} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#FDB35C" />
          <Stop offset="0.46" stopColor="#FF8A1E" />
          <Stop offset="1" stopColor="#E85F12" />
        </LinearGradient>
        <LinearGradient id={glossGradId} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.32" />
          <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </LinearGradient>
      </Defs>

      <Rect
        x="0"
        y="0"
        width={TILE}
        height={TILE}
        rx="42"
        fill={bgFill}
        stroke={variant === 'white' ? '#EBE6DD' : 'none'}
        strokeWidth={variant === 'white' ? 2 : 0}
      />

      {variant === 'color' && (
        <Rect x="0" y="0" width={TILE} height="81" rx="42" fill={`url(#${glossGradId})`} />
      )}

      {BARS.map((h, i) => (
        <Rect
          key={i}
          x={START_X + i * (BAR_W + GAP)}
          y={CENTER_Y - h / 2}
          width={BAR_W}
          height={h}
          rx={4.5}
          fill={barFill}
          fillOpacity={0.96}
        />
      ))}

      {/* "+" vectorial: barra horizontal + barra vertical */}
      <Rect
        x={PLUS_CX - PLUS_ARM / 2}
        y={PLUS_CY - PLUS_W / 2}
        width={PLUS_ARM}
        height={PLUS_W}
        rx={PLUS_W / 2}
        fill={plusFill}
        fillOpacity={0.96}
      />
      <Rect
        x={PLUS_CX - PLUS_W / 2}
        y={PLUS_CY - PLUS_ARM / 2}
        width={PLUS_W}
        height={PLUS_ARM}
        rx={PLUS_W / 2}
        fill={plusFill}
        fillOpacity={0.96}
      />
    </Svg>
  );
}
