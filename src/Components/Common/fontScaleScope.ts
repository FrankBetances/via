import { createContext } from 'react';

/* -------------------------------------------------------------------------- */
/*  ScaledTextScope — dentro de este scope, el componente común `Text` aplica  */
/*  el factor `theme.fontScale` (persistido en redux-persist) a su tamaño.     */
/*  Se activa en las pantallas de cuestionario (M-CHAT, PSQ/SAHS, CAP) para    */
/*  que el profesional pueda agrandar la letra durante la prueba sin afectar   */
/*  al resto de la app.                                                        */
/* -------------------------------------------------------------------------- */

export const ScaledTextScope = createContext(false);

/** Pasos de escala disponibles (100 % → 160 %). */
export const FONT_SCALE_STEPS = [1, 1.15, 1.3, 1.45, 1.6] as const;

export const MIN_FONT_SCALE = FONT_SCALE_STEPS[0];
export const MAX_FONT_SCALE = FONT_SCALE_STEPS[FONT_SCALE_STEPS.length - 1];

export function nextFontScale(current: number, direction: 1 | -1): number {
  // Busca el paso más cercano y avanza en la dirección pedida.
  let idx = 0;
  let best = Number.POSITIVE_INFINITY;
  FONT_SCALE_STEPS.forEach((s, i) => {
    const d = Math.abs(s - current);
    if (d < best) {
      best = d;
      idx = i;
    }
  });
  const next = Math.min(FONT_SCALE_STEPS.length - 1, Math.max(0, idx + direction));
  return FONT_SCALE_STEPS[next];
}
