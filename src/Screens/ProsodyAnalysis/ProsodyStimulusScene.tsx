import React from 'react';
import Svg, { Circle, Ellipse, Line, Path, Rect } from 'react-native-svg';

import type { ProsodyAgeBand } from './prosodyStimuli';

/* -------------------------------------------------------------------------- */
/*  Láminas del módulo de prosodia, dibujadas en SVG.                          */
/*                                                                            */
/*  POR QUÉ SVG Y NO IMÁGENES. El repositorio no versiona binarios de          */
/*  ilustración (misma razón que `ModuleIllustration`): un PNG por lámina y    */
/*  densidad engorda el APK y el repositorio, y una lámina clínica tiene que   */
/*  poder revisarse y corregirse en un diff. Dibujada, la lámina se escala sin */
/*  pérdida a cualquier tamaño de tablet y su contenido es auditable línea a   */
/*  línea — que en un estímulo de evaluación importa: lo que hay en la lámina  */
/*  es lo que el niño puede nombrar.                                          */
/*                                                                            */
/*  Cada elemento dibujado aquí tiene su entrada en `elements` de              */
/*  `prosodyStimuli`, y una prueba comprueba que no se descuelguen: una lámina */
/*  con menos cosas de las declaradas produce muestras más cortas de lo        */
/*  previsto, y la duración de la muestra es un parámetro clínico del módulo.  */
/* -------------------------------------------------------------------------- */

const SKY = '#DBEAFE';
const GRASS = '#BBF7D0';
const LINE = '#334155';
const WARM = '#F59E0B';
const ACCENT = '#C026D3';

/** Figura infantil sencilla (cabeza, cuerpo, brazos y piernas). */
function Child({
  x,
  y,
  scale = 1,
  color = LINE,
  armsUp = false,
}: {
  x: number;
  y: number;
  scale?: number;
  color?: string;
  armsUp?: boolean;
}) {
  const s = scale;
  return (
    <>
      <Circle cx={x} cy={y} r={6 * s} stroke={color} strokeWidth={2} fill="#FFFFFF" />
      <Line x1={x} y1={y + 6 * s} x2={x} y2={y + 22 * s} stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Line
        x1={x - 9 * s}
        y1={armsUp ? y + 4 * s : y + 18 * s}
        x2={x + 9 * s}
        y2={armsUp ? y + 4 * s : y + 18 * s}
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
      <Line x1={x} y1={y + 22 * s} x2={x - 7 * s} y2={y + 36 * s} stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Line x1={x} y1={y + 22 * s} x2={x + 7 * s} y2={y + 36 * s} stroke={color} strokeWidth={2} strokeLinecap="round" />
    </>
  );
}

/** Árbol de copa redonda. */
function Tree({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  return (
    <>
      <Rect x={x - 4 * scale} y={y} width={8 * scale} height={30 * scale} fill="#92400E" rx={2} />
      <Circle cx={x} cy={y - 6 * scale} r={22 * scale} fill="#16A34A" opacity={0.85} />
      <Circle cx={x - 13 * scale} cy={y + 4 * scale} r={13 * scale} fill="#16A34A" opacity={0.7} />
      <Circle cx={x + 13 * scale} cy={y + 3 * scale} r={12 * scale} fill="#16A34A" opacity={0.7} />
    </>
  );
}

/** Pájaro en «uve». */
const Bird = ({ x, y, s = 1 }: { x: number; y: number; s?: number }) => (
  <Path
    d={`M ${x - 6 * s} ${y} q ${6 * s} ${-5 * s} ${6 * s} 0 q 0 ${-5 * s} ${6 * s} 0`}
    stroke={LINE}
    strokeWidth={1.6}
    fill="none"
    strokeLinecap="round"
  />
);

/* --------------------------- lámina del prelector -------------------------- */

/** «Un día en el parque»: escena única con diez elementos describibles. */
function ParkScene() {
  return (
    <Svg viewBox="0 0 400 240" width="100%" height="100%">
      <Rect x={0} y={0} width={400} height={165} fill={SKY} />
      <Rect x={0} y={165} width={400} height={75} fill={GRASS} />

      {/* sol y nubes */}
      <Circle cx={348} cy={38} r={20} fill={WARM} />
      <Ellipse cx={92} cy={40} rx={26} ry={12} fill="#FFFFFF" opacity={0.9} />
      <Ellipse cx={112} cy={34} rx={18} ry={10} fill="#FFFFFF" opacity={0.9} />

      {/* pájaros */}
      <Bird x={190} y={34} />
      <Bird x={215} y={48} s={0.8} />

      {/* cometa */}
      <Path d="M 292 62 l 12 14 l -12 14 l -12 -14 Z" fill={ACCENT} opacity={0.85} />
      <Line x1={292} y1={90} x2={276} y2={132} stroke={LINE} strokeWidth={1.4} />

      {/* árbol */}
      <Tree x={54} y={126} scale={1.25} />

      {/* banco con persona sentada */}
      <Rect x={296} y={146} width={62} height={5} rx={2} fill="#92400E" />
      <Rect x={296} y={168} width={62} height={5} rx={2} fill="#92400E" />
      <Line x1={302} y1={173} x2={302} y2={190} stroke="#92400E" strokeWidth={4} />
      <Line x1={352} y1={173} x2={352} y2={190} stroke="#92400E" strokeWidth={4} />
      {/* persona SENTADA: cabeza sobre el respaldo, muslo en el asiento y
          pierna cayendo por delante. Dibujada así y no con `Child` porque una
          figura de pie detrás del banco no se lee como «sentada». */}
      <Circle cx={316} cy={134} r={6} stroke={LINE} strokeWidth={2} fill="#FFFFFF" />
      <Line x1={316} y1={140} x2={316} y2={166} stroke={LINE} strokeWidth={2} strokeLinecap="round" />
      <Line x1={316} y1={150} x2={330} y2={154} stroke={LINE} strokeWidth={2} strokeLinecap="round" />
      <Line x1={316} y1={166} x2={334} y2={166} stroke={LINE} strokeWidth={2} strokeLinecap="round" />
      <Line x1={334} y1={166} x2={334} y2={186} stroke={LINE} strokeWidth={2} strokeLinecap="round" />

      {/* columpio con niño */}
      <Line x1={132} y1={112} x2={192} y2={112} stroke={LINE} strokeWidth={3} strokeLinecap="round" />
      <Line x1={132} y1={112} x2={122} y2={172} stroke={LINE} strokeWidth={3} strokeLinecap="round" />
      <Line x1={192} y1={112} x2={202} y2={172} stroke={LINE} strokeWidth={3} strokeLinecap="round" />
      <Line x1={162} y1={112} x2={162} y2={150} stroke={LINE} strokeWidth={1.6} />
      <Rect x={150} y={150} width={24} height={5} rx={2} fill="#92400E" />
      {/* niño SENTADO en la tabla, agarrado a la cuerda. */}
      <Circle cx={162} cy={128} r={6} stroke={LINE} strokeWidth={2} fill="#FFFFFF" />
      <Line x1={162} y1={134} x2={162} y2={150} stroke={LINE} strokeWidth={2} strokeLinecap="round" />
      <Line x1={154} y1={140} x2={170} y2={140} stroke={LINE} strokeWidth={2} strokeLinecap="round" />
      <Line x1={166} y1={152} x2={180} y2={158} stroke={LINE} strokeWidth={2} strokeLinecap="round" />
      <Line x1={158} y1={152} x2={172} y2={162} stroke={LINE} strokeWidth={2} strokeLinecap="round" />

      {/* niña jugando a la pelota */}
      <Child x={238} y={158} armsUp />
      <Circle cx={262} cy={196} r={9} fill={ACCENT} />
      <Path d="M 253 196 q 9 -6 18 0" stroke="#FFFFFF" strokeWidth={1.4} fill="none" />

      {/* perro corriendo */}
      <Ellipse cx={96} cy={196} rx={17} ry={9} fill="#FFFFFF" stroke={LINE} strokeWidth={2} />
      <Circle cx={116} cy={186} r={7.5} fill="#FFFFFF" stroke={LINE} strokeWidth={2} />
      <Path d="M 121 180 l 5 -7 l 2 8 Z" fill="#FFFFFF" stroke={LINE} strokeWidth={1.6} />
      <Line x1={86} y1={204} x2={84} y2={216} stroke={LINE} strokeWidth={2} strokeLinecap="round" />
      <Line x1={96} y1={205} x2={95} y2={216} stroke={LINE} strokeWidth={2} strokeLinecap="round" />
      <Line x1={106} y1={204} x2={108} y2={216} stroke={LINE} strokeWidth={2} strokeLinecap="round" />
      <Line x1={79} y1={192} x2={68} y2={184} stroke={LINE} strokeWidth={2} strokeLinecap="round" />

      {/* flores */}
      {[28, 200, 286, 374].map((fx, i) => (
        <React.Fragment key={fx}>
          <Line x1={fx} y1={222} x2={fx} y2={210} stroke="#15803D" strokeWidth={2} />
          <Circle cx={fx} cy={207} r={4} fill={i % 2 ? '#F472B6' : '#FBBF24'} />
        </React.Fragment>
      ))}
    </Svg>
  );
}

/* ---------------------------- lámina del lector ---------------------------- */

/** Marco de viñeta con su número. */
function Panel({ x, children }: { x: number; children: React.ReactNode }) {
  return (
    <>
      <Rect x={x} y={10} width={122} height={200} rx={10} fill={SKY} stroke={LINE} strokeWidth={1.5} />
      <Path
        d={`M ${x} 150 l 122 0 l 0 50 a 10 10 0 0 1 -10 10 l -102 0 a 10 10 0 0 1 -10 -10 Z`}
        fill={GRASS}
      />
      {children}
    </>
  );
}

/** «La excursión»: tres viñetas en secuencia (salida · montaña · lluvia). */
function ExcursionScene() {
  return (
    <Svg viewBox="0 0 400 240" width="100%" height="100%">
      {/* viñeta 1 — salida del colegio en autobús */}
      <Panel x={8}>
        <Circle cx={106} cy={34} r={13} fill={WARM} />
        {/* colegio */}
        <Rect x={20} y={92} width={44} height={58} fill="#FDE68A" stroke={LINE} strokeWidth={1.5} />
        <Path d="M 16 92 L 42 72 L 68 92 Z" fill="#EF4444" stroke={LINE} strokeWidth={1.5} />
        <Rect x={36} y={122} width={12} height={28} fill="#92400E" />
        {/* autobús */}
        <Rect x={62} y={116} width={58} height={30} rx={5} fill="#FBBF24" stroke={LINE} strokeWidth={1.5} />
        <Rect x={68} y={122} width={14} height={12} fill="#FFFFFF" />
        <Rect x={86} y={122} width={14} height={12} fill="#FFFFFF" />
        <Circle cx={76} cy={149} r={6} fill={LINE} />
        <Circle cx={108} cy={149} r={6} fill={LINE} />
        {/* niños con mochila */}
        <Child x={36} y={168} scale={0.62} />
        <Rect x={28} y={172} width={7} height={11} rx={2} fill={ACCENT} />
        <Child x={58} y={168} scale={0.62} armsUp />
      </Panel>

      {/* viñeta 2 — montaña, sendero, merienda y mapa */}
      <Panel x={139}>
        <Path d="M 143 150 L 176 96 L 209 150 Z" fill="#A5B4FC" stroke={LINE} strokeWidth={1.5} />
        <Path d="M 196 150 L 224 108 L 252 150 Z" fill="#818CF8" stroke={LINE} strokeWidth={1.5} />
        <Path d="M 176 96 l -7 12 l 14 0 Z" fill="#FFFFFF" />
        {/* sendero */}
        {/* el sendero se queda DENTRO del marco: antes se salía por abajo a la
            izquierda y parecía un borrón fuera de la viñeta. */}
        <Path d="M 152 202 q 26 -12 32 -26 q 7 -16 34 -18" stroke="#D6D3D1" strokeWidth={6} fill="none" strokeLinecap="round" />
        {/* merienda sobre la hierba */}
        <Rect x={148} y={176} width={30} height={20} rx={3} fill="#FCA5A5" stroke={LINE} strokeWidth={1.2} />
        <Circle cx={156} cy={172} r={4} fill="#FBBF24" />
        <Circle cx={168} cy={170} r={4} fill="#22C55E" />
        {/* niño mirando un mapa */}
        <Child x={224} y={166} scale={0.62} />
        <Rect x={230} y={172} width={16} height={12} rx={1.5} fill="#FFFFFF" stroke={LINE} strokeWidth={1.2} />
        <Line x1={232} y1={176} x2={244} y2={176} stroke={ACCENT} strokeWidth={1.2} />
        <Line x1={232} y1={180} x2={241} y2={180} stroke={ACCENT} strokeWidth={1.2} />
      </Panel>

      {/* viñeta 3 — lluvia, paraguas y vuelta corriendo */}
      <Panel x={270}>
        <Ellipse cx={318} cy={44} rx={30} ry={14} fill="#94A3B8" />
        <Ellipse cx={342} cy={38} rx={20} ry={11} fill="#94A3B8" />
        {[292, 306, 320, 334, 348, 362].map((rx, i) => (
          <Line
            key={rx}
            x1={rx}
            y1={62 + (i % 2) * 8}
            x2={rx - 5}
            y2={80 + (i % 2) * 8}
            stroke="#3B82F6"
            strokeWidth={1.8}
            strokeLinecap="round"
          />
        ))}
        {/* paraguas abierto */}
        <Path d="M 300 132 a 22 22 0 0 1 44 0 Z" fill={ACCENT} stroke={LINE} strokeWidth={1.5} />
        <Line x1={322} y1={132} x2={322} y2={162} stroke={LINE} strokeWidth={2} />
        <Child x={322} y={160} scale={0.6} />
        {/* vuelta corriendo al autobús */}
        <Rect x={286} y={168} width={40} height={22} rx={4} fill="#FBBF24" stroke={LINE} strokeWidth={1.5} />
        <Circle cx={296} cy={192} r={5} fill={LINE} />
        <Circle cx={318} cy={192} r={5} fill={LINE} />
        <Child x={352} y={166} scale={0.6} armsUp />
      </Panel>
    </Svg>
  );
}

interface Props {
  ageBand: ProsodyAgeBand;
}

/** Lámina de estímulo de la banda de edad indicada. */
export default function ProsodyStimulusScene({ ageBand }: Props) {
  return ageBand === 'prelector' ? <ParkScene /> : <ExcursionScene />;
}
