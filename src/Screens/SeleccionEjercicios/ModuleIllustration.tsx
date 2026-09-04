import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, {
  Circle,
  G,
  Line,
  Path,
  Rect,
  Text as SvgText,
} from 'react-native-svg';

/* -------------------------------------------------------------------------- */
/*  ModuleIllustration — Dibujos vectoriales temáticos de cada tarjeta.        */
/*                                                                            */
/*  POR QUÉ LLENABAN TAN POCO. Cada escena tenía `height="48"` FIJO sobre un  */
/*  `viewBox` de 160×48. Con la relación de aspecto por defecto               */
/*  (`xMidYMid meet`) el dibujo se escala por el lado que primero se agota, y  */
/*  ese lado era SIEMPRE el alto: escala = min(ancho/160, 48/48) = 1. Es       */
/*  decir, el dibujo se pintaba a 160 px de ancho, centrado, pasara lo que     */
/*  pasara con el contenedor. En una tarjeta de móvil a una columna la banda   */
/*  mide 284 px: 124 px —el 44 %— eran vacío a los lados. En la rejilla de     */
/*  cuatro columnas de la tableta, 45 px (22 %).                              */
/*                                                                            */
/*  Ahora el SVG mide `100%` en los dos ejes y quien manda es la ALTURA que le */
/*  da la tarjeta (`ModuleCardItem`), calculada desde su ancho real con la     */
/*  proporción del propio viewBox. El dibujo llena la banda de lado a lado sin */
/*  deformarse: la escala pasa a estar limitada por el ancho, que es lo que    */
/*  sobra.                                                                    */
/* -------------------------------------------------------------------------- */

interface Props {
  moduleId: string;
  color: string;
  softColor?: string;
  /** Alto de la banda. Lo calcula la tarjeta desde su ancho (ver `illustrationHeight`). */
  height?: number;
}

/** Proporción del lienzo de todas las escenas (viewBox 160×48). */
export const ILLUSTRATION_ASPECT = 48 / 160;

/** 1. Audiometría Infantil: Cuadrícula con curva suave de audiograma */
function AudiogramScene({ color }: { color: string }) {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 160 48" fill="none">
      {/* Cuadrícula sutil */}
      <Line x1="0" y1="12" x2="160" y2="12" stroke={color} strokeWidth="0.8" opacity="0.15" strokeDasharray="3 3" />
      <Line x1="0" y1="24" x2="160" y2="24" stroke={color} strokeWidth="0.8" opacity="0.15" strokeDasharray="3 3" />
      <Line x1="0" y1="36" x2="160" y2="36" stroke={color} strokeWidth="0.8" opacity="0.15" strokeDasharray="3 3" />
      <Line x1="40" y1="4" x2="40" y2="44" stroke={color} strokeWidth="0.8" opacity="0.12" />
      <Line x1="80" y1="4" x2="80" y2="44" stroke={color} strokeWidth="0.8" opacity="0.12" />
      <Line x1="120" y1="4" x2="120" y2="44" stroke={color} strokeWidth="0.8" opacity="0.12" />

      {/* Curva de audiograma fluida */}
      <Path
        d="M 5 22 C 35 16, 65 32, 95 35 C 125 38, 140 20, 155 24"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
        opacity="0.85"
      />

      {/* Puntos de medición */}
      <Circle cx="20" cy="19" r="3" fill={color} opacity="0.9" />
      <Circle cx="80" cy="33" r="3" fill={color} opacity="0.9" />
      <Circle cx="140" cy="22" r="3" fill={color} opacity="0.9" />
    </Svg>
  );
}

/** 2. Audiometría Condicionada: Vías de tren y locomotora (El Tren del Sonido) */
function TrainScene({ color }: { color: string }) {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 160 48" fill="none">
      {/* Raíles horizontales */}
      <Line x1="0" y1="23" x2="130" y2="23" stroke={color} strokeWidth="2" opacity="0.6" />
      <Line x1="0" y1="31" x2="130" y2="31" stroke={color} strokeWidth="2" opacity="0.6" />

      {/* Traviesas verticales */}
      {[6, 18, 30, 42, 54, 66, 78, 90, 102, 114, 126].map(x => (
        <Line key={x} x1={x} y1="18" x2={x} y2="36" stroke={color} strokeWidth="2.2" opacity="0.5" strokeLinecap="round" />
      ))}

      {/* Locomotora estilizada en el extremo derecho */}
      <G transform="translate(132, 14)">
        {/* Cabina */}
        <Rect x="0" y="4" width="16" height="15" rx="2" stroke={color} strokeWidth="1.8" fill="none" opacity="0.85" />
        {/* Ventana */}
        <Rect x="3" y="7" width="5" height="5" rx="1" fill={color} opacity="0.5" />
        {/* Morro del tren */}
        <Rect x="15" y="9" width="8" height="10" rx="1.5" stroke={color} strokeWidth="1.8" fill="none" opacity="0.85" />
        {/* Chimenea */}
        <Rect x="18" y="5" width="3" height="4" fill={color} opacity="0.7" />
        {/* Ruedas */}
        <Circle cx="4" cy="20" r="3.5" stroke={color} strokeWidth="1.6" fill="none" opacity="0.85" />
        <Circle cx="12" cy="20" r="3.5" stroke={color} strokeWidth="1.6" fill="none" opacity="0.85" />
        <Circle cx="20" cy="20" r="3.5" stroke={color} strokeWidth="1.6" fill="none" opacity="0.85" />
      </G>
    </Svg>
  );
}

/** 3. Audiometría Verbal: Forma de onda de audio de habla */
function SpeechWaveScene({ color }: { color: string }) {
  const bars = [8, 14, 22, 16, 28, 38, 26, 42, 34, 46, 32, 40, 24, 36, 28, 18, 26, 16, 10, 6];
  return (
    <Svg width="100%" height="100%" viewBox="0 0 160 48" fill="none">
      {bars.map((h, i) => {
        const x = 8 + i * 7.4;
        return (
          <Line
            key={i}
            x1={x}
            y1={24 - h / 2}
            x2={x}
            y2={24 + h / 2}
            stroke={color}
            strokeWidth="3"
            strokeLinecap="round"
            opacity={0.6 + (i % 3) * 0.15}
          />
        );
      })}
    </Svg>
  );
}

/** 4. Análisis Acústico de Voz: Espectrograma de formantes simétrico */
function VoiceFormantsScene({ color }: { color: string }) {
  const bars = [4, 8, 14, 20, 28, 36, 44, 38, 30, 22, 14, 24, 34, 42, 36, 26, 18, 12, 6, 3];
  return (
    <Svg width="100%" height="100%" viewBox="0 0 160 48" fill="none">
      {bars.map((h, i) => {
        const x = 8 + i * 7.4;
        return (
          <Line
            key={i}
            x1={x}
            y1={24 - h / 2}
            x2={x}
            y2={24 + h / 2}
            stroke={color}
            strokeWidth="3"
            strokeLinecap="round"
            opacity={0.55 + (i % 2) * 0.25}
          />
        );
      })}
    </Svg>
  );
}

/** 5. Articulación T.A.R.: Ondas fonéticas y bocadillos de repetición */
function ArticulationScene({ color }: { color: string }) {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 160 48" fill="none">
      {/* Arco de fonación */}
      <Path
        d="M 15 24 Q 40 8, 65 24 T 115 24 T 150 24"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
        opacity="0.65"
      />
      {/* Burbujas fonéticas */}
      <Circle cx="40" cy="18" r="7" stroke={color} strokeWidth="1.8" fill="none" opacity="0.6" />
      <Circle cx="88" cy="30" r="9" stroke={color} strokeWidth="1.8" fill="none" opacity="0.7" />
      <Circle cx="130" cy="18" r="6" stroke={color} strokeWidth="1.8" fill="none" opacity="0.6" />
      {/* Puntos de articulación */}
      <Circle cx="40" cy="18" r="2.5" fill={color} opacity="0.8" />
      <Circle cx="88" cy="30" r="3" fill={color} opacity="0.8" />
      <Circle cx="130" cy="18" r="2" fill={color} opacity="0.8" />
    </Svg>
  );
}

/** 6. Funciones Ejecutivas: Red neuronal y conectomas cognitivos */
function ExecutiveScene({ color }: { color: string }) {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 160 48" fill="none">
      {/* Enlaces de red */}
      <Line x1="20" y1="24" x2="50" y2="12" stroke={color} strokeWidth="1.8" opacity="0.4" />
      <Line x1="20" y1="24" x2="55" y2="36" stroke={color} strokeWidth="1.8" opacity="0.4" />
      <Line x1="50" y1="12" x2="90" y2="18" stroke={color} strokeWidth="1.8" opacity="0.4" />
      <Line x1="55" y1="36" x2="90" y2="18" stroke={color} strokeWidth="1.8" opacity="0.4" />
      <Line x1="55" y1="36" x2="105" y2="34" stroke={color} strokeWidth="1.8" opacity="0.4" />
      <Line x1="90" y1="18" x2="135" y2="24" stroke={color} strokeWidth="1.8" opacity="0.4" />
      <Line x1="105" y1="34" x2="135" y2="24" stroke={color} strokeWidth="1.8" opacity="0.4" />

      {/* Nodos sinápticos */}
      <Circle cx="20" cy="24" r="5" stroke={color} strokeWidth="2" fill="#FFFFFF" opacity="0.9" />
      <Circle cx="50" cy="12" r="4.5" fill={color} opacity="0.8" />
      <Circle cx="55" cy="36" r="4.5" fill={color} opacity="0.8" />
      <Circle cx="90" cy="18" r="6" stroke={color} strokeWidth="2" fill="#FFFFFF" opacity="0.9" />
      <Circle cx="105" cy="34" r="4" fill={color} opacity="0.8" />
      <Circle cx="135" cy="24" r="5.5" stroke={color} strokeWidth="2" fill="#FFFFFF" opacity="0.9" />
    </Svg>
  );
}

/** 7. Cuestionario Autismo (M-CHAT-R): Rompecabezas / constelación */
function MchatScene({ color }: { color: string }) {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 160 48" fill="none">
      <Path
        d="M 50 14 H 66 A 4 4 0 0 1 70 18 V 22 A 4 4 0 0 0 74 26 A 4 4 0 0 0 70 30 V 34 A 4 4 0 0 1 66 38 H 50 A 4 4 0 0 1 46 34 V 28 A 4 4 0 0 0 42 24 A 4 4 0 0 0 46 20 V 18 A 4 4 0 0 1 50 14 Z"
        stroke={color}
        strokeWidth="2"
        fill="none"
        opacity="0.7"
      />
      <Path
        d="M 94 14 H 110 A 4 4 0 0 1 114 18 V 22 A 4 4 0 0 0 118 26 A 4 4 0 0 0 114 30 V 34 A 4 4 0 0 1 110 38 H 94 A 4 4 0 0 1 90 34 V 28 A 4 4 0 0 0 86 24 A 4 4 0 0 0 90 20 V 18 A 4 4 0 0 1 94 14 Z"
        stroke={color}
        strokeWidth="2"
        fill="none"
        opacity="0.7"
      />
      {/* Destellos */}
      <Circle cx="25" cy="24" r="3" fill={color} opacity="0.5" />
      <Circle cx="135" cy="24" r="3" fill={color} opacity="0.5" />
    </Svg>
  );
}

/** 8. Cribado SAHS Infantil: Luna creciente y constelación serena */
function SahsScene({ color }: { color: string }) {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 160 48" fill="none">
      {/* Luna */}
      <Path
        d="M 45 10 C 37 12 30 19 30 28 C 30 37 37 44 46 44 C 40 45 32 40 32 30 C 32 20 40 12 45 10 Z"
        fill={color}
        opacity="0.75"
      />
      {/* Zzz de sueño */}
      <SvgText x="70" y="32" fill={color} fontSize="20" fontWeight="bold" opacity="0.7">
        Z
      </SvgText>
      <SvgText x="92" y="24" fill={color} fontSize="15" fontWeight="bold" opacity="0.55">
        z
      </SvgText>
      <SvgText x="110" y="18" fill={color} fontSize="11" fontWeight="bold" opacity="0.4">
        z
      </SvgText>
      {/* Estrellas */}
      <Circle cx="130" cy="14" r="2.5" fill={color} opacity="0.6" />
      <Circle cx="142" cy="30" r="2" fill={color} opacity="0.5" />
    </Svg>
  );
}

/** 9. Exploración de Disfagia: Curva de pulsioximetría SpO2 */
function DysphagiaScene({ color }: { color: string }) {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 160 48" fill="none">
      <Path
        d="M 10 26 H 35 L 42 12 L 50 38 L 57 20 L 63 26 H 90 L 97 12 L 105 38 L 112 20 L 118 26 H 150"
        stroke={color}
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        opacity="0.8"
      />
      <Circle cx="135" cy="14" r="4" stroke={color} strokeWidth="1.5" fill="none" opacity="0.6" />
      <SvgText x="135" y="17" textAnchor="middle" fontSize="6" fontWeight="bold" fill={color} opacity="0.7">
        %
      </SvgText>
    </Svg>
  );
}

/** 10. Análisis Prosódico: Contorno melódico y modulación de pitch */
function ProsodyScene({ color }: { color: string }) {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 160 48" fill="none">
      <Path
        d="M 10 32 C 30 10, 50 40, 75 18 C 100 0, 120 38, 150 20"
        stroke={color}
        strokeWidth="2.8"
        strokeLinecap="round"
        fill="none"
        opacity="0.85"
      />
      <Circle cx="20" cy="24" r="3" fill={color} opacity="0.7" />
      <Circle cx="75" cy="18" r="3.5" fill={color} opacity="0.8" />
      <Circle cx="135" cy="26" r="3" fill={color} opacity="0.7" />
    </Svg>
  );
}

const SCENES: Record<string, React.ComponentType<{ color: string }>> = {
  Audiometry: AudiogramScene,
  AudiometryConditioned: TrainScene,
  VerbalAudiometry: SpeechWaveScene,
  VoiceAnalysis: VoiceFormantsScene,
  Articulation: ArticulationScene,
  ExecutiveFunctions: ExecutiveScene,
  Mchat: MchatScene,
  SahsScreening: SahsScene,
  DysphagiaTest: DysphagiaScene,
  ProsodyAnalysis: ProsodyScene,
};

export default function ModuleIllustration({ moduleId, color, height }: Props) {
  const Scene = SCENES[moduleId] ?? VoiceFormantsScene;
  return (
    <View style={[styles.container, height ? { height } : null]}>
      <Scene color={color} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    // Suelo: el alto real lo pone la tarjeta desde su ancho.
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
