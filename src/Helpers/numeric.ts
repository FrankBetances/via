/** Limita `n` al rango [min, max] (usado por sonómetro, pulsioxímetro y voz). */
export const clamp = (n: number, min: number, max: number): number => Math.max(min, Math.min(max, n));

/** Redondea `n` a `decimals` decimales (def. 0). */
export const roundTo = (n: number, decimals = 0): number => {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
};
