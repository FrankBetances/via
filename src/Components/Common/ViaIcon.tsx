import React from 'react';
import Svg, { Defs, LinearGradient, Stop, Rect, Text as SvgText } from 'react-native-svg';

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

export default function ViaIcon({ size = 150, variant = 'color' }: ViaIconProps) {
  const barFill = variant === 'white' ? '#3A352F' : 'rgba(255,255,255,0.96)';
  const bgFill =
    variant === 'color' ? 'url(#via-bg)' : variant === 'ink' ? '#3A352F' : '#FFFFFF';

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${TILE} ${TILE}`}>
      <Defs>
        <LinearGradient id="via-bg" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#FDB35C" />
          <Stop offset="0.46" stopColor="#FF8A1E" />
          <Stop offset="1" stopColor="#E85F12" />
        </LinearGradient>
        <LinearGradient id="via-gloss" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="rgba(255,255,255,0.32)" />
          <Stop offset="1" stopColor="rgba(255,255,255,0)" />
        </LinearGradient>
      </Defs>

      <Rect x="0" y="0" width={TILE} height={TILE} rx="42" fill={bgFill} />

      {variant === 'color' && (
        <Rect x="0" y="0" width={TILE} height="81" rx="42" fill="url(#via-gloss)" />
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
        />
      ))}

      <SvgText x="128" y="46" fontSize="30" fontWeight="800" fill="rgba(255,255,255,0.96)" textAnchor="end">
        +
      </SvgText>
    </Svg>
  );
}
