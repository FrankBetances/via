import { VOICE_LANGS } from '@/Voice/voiceCorpusId';
import { VERBAL_BANK_LANGS } from '@/Screens/VerbalAudiometry/verbalAudiometryBanks';

import { SESSION_LANGS, SESSION_LANG_LABEL } from '../sessionLangs';

/* -------------------------------------------------------------------------- */
/*  Idioma de sesión: registro de lenguas seleccionables (es · gl · es-DO).    */
/*  El selector del hub las ofrece las tres y las tres tienen banco verbal      */
/*  propio, de modo que elegir una lengua en el hub y abrir la audiometría      */
/*  verbal no degrada silenciosamente a otra.                                   */
/*                                                                             */
/*  Se importa el módulo PURO `sessionLangs` (no el slice) para no arrastrar    */
/*  @reduxjs/toolkit, que la config de jest no transforma.                      */
/* -------------------------------------------------------------------------- */

describe('idioma de sesión · SESSION_LANGS', () => {
  it('ofrece las tres lenguas (castellano, gallego, dominicano) con etiqueta', () => {
    expect([...SESSION_LANGS]).toEqual(['es', 'gl', 'es-DO']);
    for (const lang of SESSION_LANGS) {
      expect(SESSION_LANG_LABEL[lang]?.trim()).toBeTruthy();
    }
  });

  it('incluye el gallego (registro pedido en el selector)', () => {
    expect(SESSION_LANGS).toContain('gl');
    expect(SESSION_LANG_LABEL.gl).toBe('Galego');
  });

  it('coincide con las lenguas locutables de la capa de voz (sin deriva)', () => {
    expect([...SESSION_LANGS].sort()).toEqual([...VOICE_LANGS].sort());
  });

  it('toda lengua de sesión tiene banco verbal registrado (el selector no promete de más)', () => {
    expect([...SESSION_LANGS].sort()).toEqual([...VERBAL_BANK_LANGS].sort());
  });
});
