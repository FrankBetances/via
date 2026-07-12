import { getVerbalAudioAdapter } from '@/Screens/VerbalAudiometry/verbalAudiometryAudio';

/* -------------------------------------------------------------------------- */
/*  Dictado por voz de las consignas de los mini-juegos de funciones           */
/*  ejecutivas, reutilizando el motor es-ES de la audiometría verbal (se       */
/*  registra una sola vez en App.tsx). Clave para los niños que aún no leen    */
/*  (bandas A/B): la consigna se oye sola al entrar en cada juego y puede      */
/*  repetirse con el botón de altavoz.                                         */
/*                                                                            */
/*  Silencioso con degradación: sin adaptador registrado o sin voz española    */
/*  verificada en el dispositivo no suena nada (el clínico lee la consigna),   */
/*  y la prueba sigue siendo plenamente operativa.                             */
/* -------------------------------------------------------------------------- */

/** Dicta una consigna; interrumpe la anterior si aún sonaba. */
export const speakConsigna = (text: string): void => {
  try {
    getVerbalAudioAdapter()?.speakText?.(text);
  } catch {
    /* la voz es una ayuda: nunca debe tumbar el juego */
  }
};

/** Detiene cualquier dictado en curso (cambio de fase/juego). */
export const stopConsigna = (): void => {
  try {
    getVerbalAudioAdapter()?.stop();
  } catch {
    /* noop */
  }
};

/** ¿Hay dictado disponible? (para mostrar u ocultar el botón de altavoz). */
export const canSpeakConsignas = (): boolean => !!getVerbalAudioAdapter()?.speakText;
