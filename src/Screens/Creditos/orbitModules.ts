/* -------------------------------------------------------------------------- */
/*  Los TRECE módulos que componen la batería de VIA+, en el orden real del    */
/*  flujo clínico: del CAP (Certificado de Aptitud para la Prueba, bloqueante) */
/*  a Funciones Ejecutivas. Es la fuente única que alimenta la constelación    */
/*  de la pantalla de créditos: cada módulo es un punto orbitando el isotipo   */
/*  V+ con su radio, su velocidad y su color de módulo.                        */
/*                                                                            */
/*  Los colores replican los de las tarjetas de SeleccionEjerciciosScreen      */
/*  (mismo módulo, mismo color en toda la app). CAP y sonómetro de sala no     */
/*  son tarjetas de la parrilla —son prerrequisitos— y toman los tonos con     */
/*  que aparecen en sus accesos rápidos.                                       */
/*                                                                            */
/*  PENDIENTE DE DECISIÓN: el cribado ASHA entró con el MISMO verde azulado    */
/*  (#0D9488) que la audiometría condicionada, y viene así de su tarjeta del   */
/*  hub. Aquí se respeta la regla de arriba —mismo módulo, mismo color— pero   */
/*  en una constelación codificada por color dos módulos indistinguibles no    */
/*  cumplen su función. Repintar un módulo es decisión de diseño de Frank; si  */
/*  se cambia, hay que cambiarlo EN LOS DOS SITIOS.                            */
/*                                                                            */
/*  Radios y duraciones están escritos a mano (no generados) para que la       */
/*  constelación sea reproducible y revisable: ninguna pareja comparte órbita  */
/*  ni periodo, así que los puntos nunca quedan «pegados» girando en bloque.   */
/*  Las fases usan el ángulo áureo (137.5°), que reparte doce puntos sobre el  */
/*  círculo sin alinearlos en radios.                                          */
/* -------------------------------------------------------------------------- */

export interface OrbitModule {
  /** Identificador estable del módulo (no es una ruta de navegación). */
  key: string;
  /** Nombre del módulo, usado en la etiqueta de accesibilidad. */
  label: string;
  /** Color de marca del módulo. */
  color: string;
  /** Radio de la órbita en px. */
  radius: number;
  /** Diámetro del punto en px. */
  size: number;
  /** Periodo de una vuelta completa en ms (velocidad). */
  durationMs: number;
  /** Posición inicial sobre la órbita, en grados. */
  phase: number;
}

/** Ángulo áureo: reparte las fases sin que los puntos se alineen. */
const GOLDEN_ANGLE = 137.5;

const SPEC: Omit<OrbitModule, 'phase'>[] = [
  { key: 'cap',        label: 'CAP · Certificado de Aptitud', color: '#0F766E', radius: 58,  size: 5.5, durationMs: 14200 },
  { key: 'sala',       label: 'Sonómetro de sala',            color: '#64748B', radius: 64,  size: 5,   durationMs: 16600 },
  { key: 'voz',        label: 'Análisis acústico de voz',     color: '#7C3AED', radius: 70,  size: 6,   durationMs: 18400 },
  { key: 'audInf',     label: 'Audiometría infantil',         color: '#0284C7', radius: 76,  size: 5.5, durationMs: 20200 },
  { key: 'audCond',    label: 'Audiometría condicionada',     color: '#0D9488', radius: 82,  size: 6,   durationMs: 22000 },
  { key: 'audVerbal',  label: 'Audiometría verbal',           color: '#2563EB', radius: 88,  size: 5,   durationMs: 23800 },
  { key: 'articul',    label: 'Articulación · T.A.R.',        color: '#EA580C', radius: 94,  size: 6.5, durationMs: 25600 },
  { key: 'prosodia',   label: 'Análisis prosódico',           color: '#C026D3', radius: 100, size: 5.5, durationMs: 27400 },
  { key: 'disfagia',   label: 'Exploración de disfagia',      color: '#DC2626', radius: 61,  size: 5,   durationMs: 29200 },
  { key: 'mchat',      label: 'Cribado de autismo · M-CHAT',  color: '#DB2777', radius: 73,  size: 6,   durationMs: 31000 },
  { key: 'sahs',       label: 'Cribado SAHS infantil',        color: '#4F46E5', radius: 85,  size: 5.5, durationMs: 32800 },
  { key: 'ejecutivas', label: 'Funciones ejecutivas',         color: '#059669', radius: 97,  size: 6.5, durationMs: 34600 },
  { key: 'asha',       label: 'Hitos del lenguaje · ASHA',    color: '#0D9488', radius: 67,  size: 5.5, durationMs: 36400 },
];

export const ORBIT_MODULES: OrbitModule[] = SPEC.map((m, i) => ({
  ...m,
  phase: (i * GOLDEN_ANGLE) % 360,
}));

/** Radio máximo alcanzado por la constelación (para dimensionar el lienzo). */
export const ORBIT_MAX_REACH = ORBIT_MODULES.reduce(
  (max, m) => Math.max(max, m.radius + m.size / 2),
  0,
);
