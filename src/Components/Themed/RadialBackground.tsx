import React from 'react';
import { useWindowDimensions, View } from 'react-native';

/* -------------------------------------------------------------------------- */
/*  RadialBackground — mancha decorativa difusa usada como fondo de las 9     */
/*  pantallas de módulo (vía `Content.radialBackgrounds`). Es puramente        */
/*  cosmética: no participa en la lógica clínica. Implementación mínima con   */
/*  primitivas RN (sin librería de gradientes nueva): un círculo absoluto     */
/*  posicionado/escalado según los multiplicadores recibidos, con opacidad    */
/*  baja para simular el degradado radial de los mockups.                     */
/* -------------------------------------------------------------------------- */

export interface RadialBackgroundProps {
  /** Desplazamiento vertical como múltiplo del ancho de pantalla. */
  topMultiplier?: number;
  /** Desplazamiento horizontal como múltiplo del ancho de pantalla. */
  leftMultiplier?: number;
  /** Ancho de la mancha como múltiplo del ancho de pantalla. */
  widthMultiplier?: number;
  /** Alto de la mancha como múltiplo del ancho de pantalla. */
  heightMultiplier?: number;
  /** Radio de borde como múltiplo del lado mayor (1 = círculo perfecto). */
  radiusMultiplier?: number;
  /** Color de relleno (token o valor CSS). */
  color?: string;
  /** Opacidad de la mancha. */
  opacity?: number;
  /** Calcula el tamaño base [w, h] a partir del ancho/alto de pantalla. */
  center?: (screenWidth: number, screenHeight: number) => [number, number];
}

export default function RadialBackground({
  topMultiplier = 0,
  leftMultiplier = 0,
  widthMultiplier = 1,
  heightMultiplier = 1,
  radiusMultiplier = 1,
  color = '$primary100',
  opacity = 0.35,
  center,
}: RadialBackgroundProps) {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const [baseW, baseH] = center ? center(screenWidth, screenHeight) : [screenWidth, screenWidth];

  const w = baseW * widthMultiplier;
  const h = baseH * heightMultiplier;

  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: screenHeight * topMultiplier,
        left: screenWidth * leftMultiplier,
        width: w,
        height: h,
        borderRadius: Math.max(w, h) * radiusMultiplier,
        backgroundColor: color.startsWith('$') ? undefined : color,
        opacity,
      }}
    />
  );
}
