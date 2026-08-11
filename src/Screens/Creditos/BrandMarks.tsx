import React, { useMemo } from 'react';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

/* -------------------------------------------------------------------------- */
/*  BrandMarks — los logotipos de la pantalla de créditos, dibujados como      */
/*  vectores en lugar de mapas de bits.                                        */
/*                                                                            */
/*  Son reconstrucciones vectoriales de las marcas reales: el repositorio no   */
/*  guarda los archivos de imagen originales y un PNG escalado se ve sucio en  */
/*  pantallas de alta densidad. Cada marca es un componente independiente, así */
/*  que sustituir cualquiera por el archivo oficial (cuando se incorpore a     */
/*  assets/) es cambiar el cuerpo de UNA función sin tocar a quien la usa.     */
/*                                                                            */
/*  Convenciones heredadas de ViaIcon: nada de <Text> SVG (depende de la       */
/*  fuente del dispositivo y en Android puede no pintarse) y los ids de        */
/*  gradiente llevan sufijo por instancia, porque en react-native-svg son      */
/*  globales y dos marcas montadas a la vez se pisarían.                       */
/* -------------------------------------------------------------------------- */

interface MarkProps {
  size?: number;
}

let instanceCounter = 0;
const useUid = (prefix: string) => useMemo(() => `${prefix}-${++instanceCounter}`, [prefix]);

/* ------------------------------ Dr. Betances ------------------------------ */
/*  Dos córvidos enfrentados posados sobre una llave, dentro de un anillo.     */

const TEAL = '#12A79B';

/** Córvido posado mirando a la derecha. La cola es una cuña horizontal: se
    proyecta hacia atrás sin bajar del vástago de la llave (y = 40 local). */
const RAVEN_PATH =
  'M -9 37 L 8 27 C 5 17 13 8 25 6 C 27 0 38 -2 43 3 L 49 6 L 42 10 C 45 20 40 30 30 33 C 22 36 8 37 -9 37 Z';
/** Plumas del ala, en el turquesa de la marca (igual que el logotipo real). */
const RAVEN_WING = 'M 8 27 C 15 21 25 20 33 24 M 11 31 C 18 27 26 26 32 28';

function Raven({ fill }: { fill: string }) {
  return (
    <>
      {/* patas: se dibujan antes que el cuerpo para que nazcan bajo el vientre */}
      <Rect x="18.5" y="31" width="2.4" height="11" fill={fill} />
      <Rect x="25.5" y="31" width="2.4" height="11" fill={fill} />
      <Path d={RAVEN_PATH} fill={fill} />
      <Path d={RAVEN_WING} stroke={TEAL} strokeWidth="1.5" strokeLinecap="round" fill="none" opacity={0.55} />
      <Circle cx="35" cy="6.4" r="1.9" fill={TEAL} />
    </>
  );
}

export function DrBetancesMark({ size = 48 }: MarkProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 140 140">
      <Rect x="0" y="0" width="140" height="140" rx="34" fill={TEAL} />
      <Circle cx="70" cy="70" r="52" stroke="#FFFFFF" strokeWidth="3" fill="none" opacity={0.92} />

      {/* llave: paletón a la izquierda, anilla a la derecha */}
      <Rect x="28" y="94" width="84" height="5" rx="2.5" fill="#FFFFFF" />
      <Circle cx="117" cy="96.5" r="8.5" stroke="#FFFFFF" strokeWidth="4" fill="none" />
      <Rect x="28" y="87" width="5" height="19" rx="2.5" fill="#FFFFFF" />
      <Rect x="39" y="99" width="4.5" height="9" rx="2" fill="#FFFFFF" />
      <Rect x="48" y="99" width="4.5" height="9" rx="2" fill="#FFFFFF" />

      {/* los dos córvidos, enfrentados sobre el vástago */}
      <G transform="translate(20,54)">
        <Raven fill="#0E1214" />
      </G>
      <G transform="translate(120,54) scale(-1,1)">
        <Raven fill="#FFFFFF" />
      </G>
    </Svg>
  );
}

/* ---------------------------- Quisqueya Habla ----------------------------- */
/*  Silueta infantil sobre la isla, trazo de pulso y mariposa que se dispersa. */

const QH_NAVY = '#1F3A6E';
const QH_RED = '#D0342C';
const QH_TEAL = '#37B4BE';

export function QuisqueyaHablaMark({ size = 44 }: MarkProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 140 140">
      <Rect x="0" y="0" width="140" height="140" rx="30" fill="#FBF7F0" />

      {/* isla */}
      <Path
        d="M 12 106 C 26 98 44 100 60 96 C 76 92 96 94 114 100 C 125 104 131 111 126 116 C 116 123 94 125 72 123 C 50 121 24 117 12 112 Z"
        fill={QH_NAVY}
      />

      {/* silueta del niño con los brazos en alto */}
      <Circle cx="69" cy="46" r="9" fill={QH_NAVY} />
      <Path d="M 61 56 L 77 56 L 75 82 L 63 82 Z" fill={QH_NAVY} />
      <Path
        d="M 62 60 L 48 47 M 76 60 L 91 44 M 66 82 L 62 97 M 73 82 L 78 97"
        stroke={QH_NAVY}
        strokeWidth="5.5"
        strokeLinecap="round"
        fill="none"
      />

      {/* pulso: rodea al niño y sale disparado hacia la mariposa */}
      <Path
        d="M 32 74 C 26 50 34 30 50 26 L 55 26 L 59 13 L 64 36 L 69 20 L 74 30 L 84 28"
        stroke={QH_RED}
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />

      {/* mariposa: cuatro alas separadas por el cuerpo (un turquesa un punto
          más oscuro, para que a 40 px no se fundan en una mancha) */}
      <G>
        <Ellipse cx="100" cy="20" rx="9" ry="6.5" fill={QH_TEAL} transform="rotate(-25 100 20)" />
        <Ellipse cx="124" cy="20" rx="9" ry="6.5" fill={QH_TEAL} transform="rotate(25 124 20)" />
        <Ellipse cx="103" cy="33" rx="7" ry="5" fill={QH_TEAL} transform="rotate(25 103 33)" />
        <Ellipse cx="121" cy="33" rx="7" ry="5" fill={QH_TEAL} transform="rotate(-25 121 33)" />
        <Rect x="110.8" y="14" width="2.4" height="24" rx="1.2" fill="#1E8C97" />
        <Path
          d="M 111 19 C 109 13 106 10 102 9 M 113 19 C 115 13 118 10 122 9"
          stroke="#1E8C97"
          strokeWidth="1.6"
          strokeLinecap="round"
          fill="none"
        />
      </G>
      <Circle cx="88" cy="16" r="2.6" fill={QH_TEAL} />
      <Circle cx="82" cy="24" r="2" fill={QH_TEAL} opacity={0.8} />
      <Circle cx="90" cy="29" r="1.6" fill={QH_TEAL} opacity={0.6} />
    </Svg>
  );
}

/* --------------------------------- ACOPROS -------------------------------- */
/*  Espiral coclear abierta, en el naranja de la asociación.                   */

const ACOPROS_ORANGE = '#F5821F';

export function AcoprosMark({ size = 44 }: MarkProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 140 140">
      <Rect x="0" y="0" width="140" height="140" rx="30" fill="#FFFFFF" />
      <Path
        d="M 104 62 C 104 34 80 18 55 26 C 30 34 20 64 34 88 C 46 108 74 113 90 100"
        stroke={ACOPROS_ORANGE}
        strokeWidth="14"
        strokeLinecap="round"
        fill="none"
      />
      <Path
        d="M 76 62 C 72 50 56 48 50 58 C 44 69 52 82 64 80"
        stroke={ACOPROS_ORANGE}
        strokeWidth="12"
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}

/* ----------------------------- Earlify Health ----------------------------- */
/*  Espiral concéntrica a pincel: turquesa por fuera, azul en el núcleo.       */

export function EarlifyMark({ size = 44 }: MarkProps) {
  const uid = useUid('earlify');
  return (
    <Svg width={size} height={size} viewBox="0 0 140 140">
      <Defs>
        <LinearGradient id={uid} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#5CC2C6" />
          <Stop offset="0.55" stopColor="#2E8FB8" />
          <Stop offset="1" stopColor="#2F3E9E" />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="140" height="140" rx="30" fill="#FAFAF2" />
      <Path
        d="M 118 70 A 48 48 0 1 0 46 111"
        stroke={`url(#${uid})`}
        strokeWidth="9"
        strokeLinecap="round"
        fill="none"
      />
      <Path
        d="M 100 74 A 30 30 0 1 0 76 100"
        stroke={`url(#${uid})`}
        strokeWidth="9"
        strokeLinecap="round"
        fill="none"
      />
      <Path
        d="M 84 72 A 14 14 0 1 0 70 86"
        stroke="#2F3E9E"
        strokeWidth="9"
        strokeLinecap="round"
        fill="none"
      />
      <Circle cx="70" cy="70" r="5.5" fill="#2F3E9E" />
    </Svg>
  );
}

/* ------------------------- Sello de calidad ITEMAS ------------------------ */
/*  Roseta festoneada con dos colas de cinta, a un solo trazo azul.            */

const ITEMAS_BLUE = '#16688F';
const ROSETTE_CX = 70;
const ROSETTE_CY = 56;
const ROSETTE_R = 38;
const SCALLOPS = 14;

export function ItemasSealMark({ size = 56 }: MarkProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 140 140">
      {/* colas de la cinta (bajo la roseta) */}
      <Path
        d="M 54 88 L 38 132 L 53 121 L 63 134"
        stroke={ITEMAS_BLUE}
        strokeWidth="4.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        fill="none"
      />
      <Path
        d="M 86 88 L 102 132 L 87 121 L 77 134"
        stroke={ITEMAS_BLUE}
        strokeWidth="4.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        fill="none"
      />

      {/* festón: círculos repartidos sobre el borde de la roseta */}
      {Array.from({ length: SCALLOPS }, (_, i) => {
        const a = (i / SCALLOPS) * Math.PI * 2;
        return (
          <Circle
            key={i}
            cx={ROSETTE_CX + Math.cos(a) * ROSETTE_R}
            cy={ROSETTE_CY + Math.sin(a) * ROSETTE_R}
            r="8"
            fill="#FFFFFF"
            stroke={ITEMAS_BLUE}
            strokeWidth="4"
          />
        );
      })}
      <Circle cx={ROSETTE_CX} cy={ROSETTE_CY} r={ROSETTE_R} fill="#FFFFFF" />
      <Circle
        cx={ROSETTE_CX}
        cy={ROSETTE_CY}
        r={ROSETTE_R - 3}
        stroke={ITEMAS_BLUE}
        strokeWidth="4"
        fill="none"
      />
      <Circle
        cx={ROSETTE_CX}
        cy={ROSETTE_CY}
        r={ROSETTE_R - 11}
        stroke={ITEMAS_BLUE}
        strokeWidth="3"
        fill="none"
        opacity={0.55}
      />
      {/* Guiño al logotipo «itemas isciii»: las tres motas y las líneas del
          logotipo, alineadas a la izquierda como en el sello real. Nada de
          simetría aquí: dos motas simétricas sobre una barra centrada leen
          como una cara a 40 px. */}
      <Circle cx="54" cy="46" r="2.9" fill={ITEMAS_BLUE} />
      <Circle cx="60.5" cy="43.6" r="2.4" fill={ITEMAS_BLUE} />
      <Circle cx="66.5" cy="45" r="2" fill={ITEMAS_BLUE} />
      <Rect x="50" y="52" width="42" height="6" rx="3" fill={ITEMAS_BLUE} opacity={0.85} />
      <Rect x="50" y="63" width="42" height="2.8" rx="1.4" fill={ITEMAS_BLUE} opacity={0.45} />
      <Rect x="50" y="69" width="30" height="2.8" rx="1.4" fill={ITEMAS_BLUE} opacity={0.45} />
    </Svg>
  );
}
