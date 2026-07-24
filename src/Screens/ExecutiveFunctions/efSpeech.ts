import { canSpeak, speak, stopSpeaking } from '@/Voice';

/* -------------------------------------------------------------------------- */
/*  Dictado por voz de las consignas de los mini-juegos de funciones           */
/*  ejecutivas. Clave para los niños que aún no leen (bandas A/B): la consigna  */
/*  se oye sola al entrar en cada juego y puede repetirse con el botón de       */
/*  altavoz.                                                                    */
/*                                                                            */
/*  Enruta por la capa de voz general (`@/Voice`): si hay un asset neuronal     */
/*  pre-sintetizado de la consigna en la lengua de sesión lo reproduce; si no,  */
/*  cae al asset base `es` y, en último término, a la voz del sistema (motor    */
/*  es-ES verificado del adaptador verbal). Silencioso con degradación: sin voz */
/*  disponible no suena nada y la prueba sigue siendo plenamente operativa.     */
/*                                                                            */
/*  `lang` es la lengua/variante de la sesión (`'es' | 'gl' | 'es-DO'`); por    */
/*  defecto `es` para no romper a los llamadores que aún no la propagan.        */
/* -------------------------------------------------------------------------- */

/** Dicta una consigna; interrumpe la anterior si aún sonaba. */
export const speakConsigna = (text: string, lang: string = 'es'): void => {
  try {
    speak('tutor', text, lang);
  } catch {
    /* la voz es una ayuda: nunca debe tumbar el juego */
  }
};

/** Detiene cualquier dictado en curso (cambio de fase/juego). */
export const stopConsigna = (): void => {
  try {
    stopSpeaking();
  } catch {
    /* noop */
  }
};

/** ¿Hay dictado disponible? (para mostrar u ocultar el botón de altavoz). */
export const canSpeakConsignas = (): boolean => canSpeak();
