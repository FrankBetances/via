import {
  canSpeak,
  efConsignaByLang,
  efRuleConsignaByLang,
  speakLocalized,
  stopSpeaking,
  type SpokenText,
} from '@/Voice';

import type { EfDomain, EfRule } from './executiveFunctionsGame';

/* -------------------------------------------------------------------------- */
/*  Dictado por voz de las consignas de los mini-juegos de funciones           */
/*  ejecutivas. Clave para los niños que aún no leen (bandas A/B): la consigna  */
/*  se oye sola al entrar en cada juego y puede repetirse con el botón de       */
/*  altavoz.                                                                    */
/*                                                                            */
/*  Recibe el DOMINIO, no una cadena ya compuesta. Antes la pantalla armaba el  */
/*  texto castellano y se lo pasaba a `speak()` junto con la lengua de SESIÓN:  */
/*  en una sesión gallega eso pedía voz gallega para un texto castellano, que   */
/*  es la incoherencia reportada (acento de una lengua sobre el texto de otra). */
/*  Ahora `speakLocalized` resuelve texto y voz juntos desde el banco de        */
/*  consignas: si el gallego no tiene delta firmado, se locuta el castellano    */
/*  CON VOZ CASTELLANA y la pantalla lo advierte.                               */
/*                                                                            */
/*  Silencioso con degradación: sin voz disponible no suena nada y la prueba    */
/*  sigue siendo plenamente operativa.                                          */
/* -------------------------------------------------------------------------- */

/**
 * Dicta la consigna del dominio en la lengua de sesión; interrumpe la anterior
 * si aún sonaba. Devuelve la locución elegida (texto + lengua REAL) para que la
 * pantalla pueda mostrar exactamente lo que suena, o `null` si no hay texto.
 */
export const speakConsigna = (domain: EfDomain, lang: string = 'es'): SpokenText | null => {
  try {
    return speakLocalized('tutor', efConsignaByLang(domain), lang);
  } catch {
    /* la voz es una ayuda: nunca debe tumbar el juego */
    return null;
  }
};

/**
 * Dicta el anuncio de la norma vigente del juego de flexibilidad (DCCS):
 * `changed` distingue el aviso de CAMBIO de norma del anuncio de la inicial.
 * Pasa por el mismo banco que las consignas, así que hereda la lengua de sesión
 * y el recorte neuronal en cuanto el pipeline lo sintetice.
 */
export const speakRuleConsigna = (
  rule: EfRule,
  changed: boolean,
  lang: string = 'es',
): SpokenText | null => {
  try {
    return speakLocalized('tutor', efRuleConsignaByLang(rule, changed), lang);
  } catch {
    return null;
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
