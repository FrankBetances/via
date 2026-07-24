import { VOICE_LANGS } from '@/Voice/voiceCorpusId';

import { SESSION_LANGS, SESSION_LANG_LABEL } from '../sessionLangs';

/* -------------------------------------------------------------------------- */
/*  Idioma de sesión: registro de lenguas seleccionables (es · gl · es-DO).    */
/*  El selector del hub las ofrece las tres; la audiometría verbal degrada las  */
/*  que aún no tienen banco propio (gl) al banco español, sin romperse.         */
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
});
