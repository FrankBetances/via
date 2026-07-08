/* -------------------------------------------------------------------------- */
/*  Calibración de nivel para la audiometría tonal (infantil y condicionada).  */
/*                                                                            */
/*  El motor de tonos (`audiometryToneAdapter`) necesita convertir el nivel    */
/*  clínico en dB HL a una ganancia lineal (0..1) para el oscilador. La        */
/*  conversión NO puede ser plana en frecuencia: el dB HL se define respecto a */
/*  un umbral de referencia (RETSPL) que depende de la frecuencia, de modo que */
/*  para presentar el MISMO nivel de audición a 500 Hz y a 4 kHz hay que emitir */
/*  niveles físicos (dB SPL) distintos. El mapeo plano anterior emitía el mismo */
/*  dBFS a todas las frecuencias: la prueba quedaba descalibrada entre bandas   */
/*  (500 Hz sonaba relativamente flojo y 4 kHz relativamente fuerte respecto a  */
/*  un audiograma real).                                                        */
/*                                                                            */
/*  Aquí se aplica la corrección por frecuencia usando los RETSPL de CAMPO      */
/*  LIBRE frontal binaural (ISO 389-7), que es la condición de escucha de la    */
/*  app (altavoz del dispositivo, sin auriculares). Sobre una cadena de         */
/*  reproducción idealmente plana esto hace que «igual dB HL → igual nivel de   */
/*  audición» en todas las bandas.                                             */
/*                                                                            */
/*  ADVERTENCIA: esto NO es una calibración ABSOLUTA. El nivel real en el oído  */
/*  del niño depende del altavoz y del volumen del dispositivo, que no se miden */
/*  contra un equipo patrón. El resultado sigue siendo ORIENTATIVO y así debe   */
/*  advertirse en la UI/PDF. Lo que se corrige aquí es la RELACIÓN entre bandas */
/*  (calibración relativa por frecuencia), no el valor absoluto.               */
/* -------------------------------------------------------------------------- */

/**
 * RETSPL de campo libre frontal (0°), escucha binaural, en dB SPL para 0 dB HL
 * (ISO 389-7). Puntos de octava/tercio habituales en audiometría pediátrica.
 * Un valor menor significa que el oído es MÁS sensible a esa frecuencia y, por
 * tanto, hace falta MENOS nivel físico para el mismo dB HL.
 */
export const RETSPL_FREEFIELD: ReadonlyArray<readonly [freq: number, dbSpl: number]> = [
  [125, 22.1],
  [250, 11.4],
  [500, 4.4],
  [750, 2.4],
  [1000, 2.4],
  [1500, 2.4],
  [2000, -1.3],
  [3000, -5.8],
  [4000, -5.4],
  [6000, 4.3],
  [8000, 12.6],
];

/**
 * RETSPL interpolado (lineal en frecuencia logarítmica) para una frecuencia
 * arbitraria; fuera de la tabla se satura al extremo más cercano.
 */
export function retsplFreeField(freq: number): number {
  const table = RETSPL_FREEFIELD;
  if (freq <= table[0][0]) return table[0][1];
  const last = table[table.length - 1];
  if (freq >= last[0]) return last[1];
  for (let i = 0; i < table.length - 1; i++) {
    const [f0, v0] = table[i];
    const [f1, v1] = table[i + 1];
    if (freq >= f0 && freq <= f1) {
      const t = (Math.log(freq) - Math.log(f0)) / (Math.log(f1) - Math.log(f0));
      return v0 + t * (v1 - v0);
    }
  }
  return last[1];
}

/** Frecuencias clínicas de la prueba (para fijar el techo de nivel sin recorte). */
export const CLINICAL_FREQS = [500, 1000, 2000, 4000] as const;
/** Nivel máximo del algoritmo Hughson-Westlake de la app (dB HL). */
export const MAX_DB_HL = 80;
/**
 * Nivel (dB HL) que se ancla al fondo de escala digital para la reproducción
 * por ALTAVOZ. La prueba se hace con el altavoz de la tableta (campo libre,
 * sin auriculares): anclar el máximo del algoritmo (80 dB HL) a 0 dBFS dejaba
 * el rango de trabajo habitual (20–40 dB HL) a −45…−65 dBFS, prácticamente
 * inaudible sobre el ruido de sala — «sonaba a niveles de auricular». Con el
 * ancla en 60 dB HL toda la escala sube 20 dB; los niveles por encima saturan
 * en el fondo de escala (el altavoz tampoco podía reproducirlos de verdad) y
 * eso no cambia ninguna decisión de cribado: la derivación se dispara ya con
 * PTA > 20 dB HL, muy por debajo de la zona comprimida.
 */
export const SPEAKER_ANCHOR_DB_HL = 60;
/**
 * Techo digital (dBFS) al que se ancla la presentación del nivel de anclaje
 * (la frecuencia clínica con mayor RETSPL a `SPEAKER_ANCHOR_DB_HL`).
 * 0 dBFS = fondo de escala.
 */
export const CEILING_DBFS = 0;

/**
 * dBFS de referencia: SPL que corresponde a 0 dBFS. Se elige para que la
 * presentación más exigente del tramo lineal (mayor SPL entre las frecuencias
 * clínicas a `SPEAKER_ANCHOR_DB_HL`) quede exactamente en `CEILING_DBFS`; por
 * encima del ancla la ganancia se recorta a 1.0 (saturación controlada).
 */
const REF_DBFS = (() => {
  let maxSpl = -Infinity;
  for (const f of CLINICAL_FREQS) {
    const spl = SPEAKER_ANCHOR_DB_HL + retsplFreeField(f);
    if (spl > maxSpl) maxSpl = spl;
  }
  return maxSpl - CEILING_DBFS;
})();

/**
 * dB HL → ganancia lineal (0..1) con corrección de frecuencia por RETSPL de
 * campo libre. Reemplaza al mapeo plano `-80 + dbHL`. Por encima de
 * `SPEAKER_ANCHOR_DB_HL` la ganancia satura en 1.0 (ver nota del ancla).
 * Sustituible por una tabla medida contra equipo patrón por transductor si se
 * dispone de ella.
 */
export function dbHLtoGainFreeField(dbHL: number, freq: number): number {
  const dbFS = dbHL + retsplFreeField(freq) - REF_DBFS;
  return Math.min(1, Math.pow(10, dbFS / 20));
}
