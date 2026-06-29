import React from 'react';
import Svg, { Circle, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import { AudiometryThresholds } from '@/Models/Audiometry/AudiometryTest';
import { FREQS } from '../audiometryResult';

const X: Record<number, number> = { 500: 80, 1000: 170, 2000: 260, 4000: 330 };
const yOf = (db: number) => 50 + (db - 20) * 3;

interface Props {
  thresholds: AudiometryThresholds;
  /** Marcador de la presentación en curso. */
  cursor?: { freq: number; db: number } | null;
  cursorColor?: string;
}

/**
 * Audiograma clínico (vía aérea) con bandas de severidad, símbolos
 * normalizados (O = OD, X = OI) y cursor de la presentación en curso.
 * Reutilizado por la pantalla infantil y la condicionada.
 */
export default function Audiogram({ thresholds, cursor, cursorColor = '#FF7F00' }: Props) {
  const pointsOf = (ear: 'OD' | 'OI') =>
    FREQS.map(f => ({ f, v: thresholds[ear][f] }))
      .filter(p => p.v !== null)
      .map(p => ({ f: p.f, x: X[p.f], y: yOf(p.v as number) }));

  const ptsOD = pointsOf('OD');
  const ptsOI = pointsOf('OI');
  const pathOf = (pts: { x: number; y: number }[]) =>
    pts.length > 1 ? 'M' + pts.map(p => `${p.x},${p.y}`).join(' L') : '';

  return (
    <Svg width="100%" height="100%" viewBox="0 0 364 268">
      {/* bandas de severidad */}
      <Rect x={50} y={30} width={300} height={20} fill="#EAF7EF" />
      <Rect x={50} y={50} width={300} height={60} fill="#FBF4E3" />
      <Rect x={50} y={110} width={300} height={60} fill="#FBEDDD" />
      <Rect x={50} y={170} width={300} height={62} fill="#FBE6E2" />
      <SvgText x={54} y={44} fontSize={7.5} fill="#3F9F6B">NORMAL</SvgText>
      <SvgText x={54} y={76} fontSize={7.5} fill="#C99A3A">LEVE</SvgText>
      <SvgText x={54} y={136} fontSize={7.5} fill="#C2742E">MODERADA</SvgText>
      <SvgText x={54} y={196} fontSize={7.5} fill="#C2554E">SEVERA</SvgText>

      {/* rejilla horizontal */}
      {[50, 80, 110, 140, 170, 200, 230].map((y, i) => (
        <Line key={`h${y}`} x1={50} y1={y} x2={350} y2={y} stroke={i % 2 ? '#EDE6D8' : '#E4DCCD'} strokeWidth={1} />
      ))}
      {[20, 30, 40, 50, 60, 70, 80].map((db, i) => (
        <SvgText key={`yl${db}`} x={44} y={53 + i * 30} fontSize={8.5} fill="#9A938A" textAnchor="end">
          {db}
        </SvgText>
      ))}

      {/* rejilla vertical */}
      {FREQS.map(f => (
        <Line key={`v${f}`} x1={X[f]} y1={30} x2={X[f]} y2={232} stroke="#EDE6D8" strokeWidth={1} />
      ))}
      <SvgText x={80} y={248} fontSize={8.5} fill="#9A938A" textAnchor="middle">500</SvgText>
      <SvgText x={170} y={248} fontSize={8.5} fill="#9A938A" textAnchor="middle">1k</SvgText>
      <SvgText x={260} y={248} fontSize={8.5} fill="#9A938A" textAnchor="middle">2k</SvgText>
      <SvgText x={330} y={248} fontSize={8.5} fill="#9A938A" textAnchor="middle">4k</SvgText>
      <SvgText x={200} y={262} fontSize={8} fill="#B7AFA3" textAnchor="middle">Frecuencia (Hz)</SvgText>

      {/* cursor de presentación */}
      {cursor && X[cursor.freq] ? (
        <Circle cx={X[cursor.freq]} cy={yOf(cursor.db)} r={9} fill="none" stroke={cursorColor} strokeWidth={1.4} strokeDasharray="3,2" opacity={0.85} />
      ) : null}

      {/* OD (círculos rojos) */}
      {pathOf(ptsOD) ? <Path d={pathOf(ptsOD)} fill="none" stroke="#E63535" strokeWidth={2.2} /> : null}
      {ptsOD.map(p => (
        <Circle key={`od${p.f}`} cx={p.x} cy={p.y} r={5} fill="#fff" stroke="#E63535" strokeWidth={2.2} />
      ))}

      {/* OI (cruces verdes) */}
      {pathOf(ptsOI) ? <Path d={pathOf(ptsOI)} fill="none" stroke="#1E8049" strokeWidth={2.2} /> : null}
      {ptsOI.map(p => (
        <G key={`oi${p.f}`}>
          <Line x1={p.x - 5} y1={p.y - 5} x2={p.x + 5} y2={p.y + 5} stroke="#1E8049" strokeWidth={2.2} />
          <Line x1={p.x + 5} y1={p.y - 5} x2={p.x - 5} y2={p.y + 5} stroke="#1E8049" strokeWidth={2.2} />
        </G>
      ))}
    </Svg>
  );
}
