import { VOICE_LANGS } from '@/Voice/voiceCorpusId';
import { VERBAL_BANK_LANGS } from '@/Screens/VerbalAudiometry/verbalAudiometryBanks';

import { SESSION_LANGS, SESSION_LANG_LABEL } from '../sessionLangs';

/* -------------------------------------------------------------------------- */
/*  Idioma de sesión: registro de lenguas seleccionables                       */
/*  (es · gl · eu · es-DO). El selector del hub las ofrece todas y todas       */
/*  tienen banco verbal propio, de modo que elegir una lengua en el hub y      */
/*  abrir la audiometría verbal no degrada silenciosamente a otra.             */
/*                                                                             */
/*  Se importa el módulo PURO `sessionLangs` (no el slice) para no arrastrar    */
/*  @reduxjs/toolkit, que la config de jest no transforma.                      */
/* -------------------------------------------------------------------------- */

describe('idioma de sesión · SESSION_LANGS', () => {
  it('ofrece las lenguas registradas (castellano, gallego, euskera, catalán, latinoamericano, dominicano, inglés) con etiqueta', () => {
    expect([...SESSION_LANGS]).toEqual(['es', 'gl', 'eu', 'ca', 'es-419', 'es-DO', 'en']);
    for (const lang of SESSION_LANGS) {
      expect(SESSION_LANG_LABEL[lang]?.trim()).toBeTruthy();
    }
  });

  it('incluye el gallego (registro pedido en el selector)', () => {
    expect(SESSION_LANGS).toContain('gl');
    expect(SESSION_LANG_LABEL.gl).toBe('Galego');
  });

  it('incluye el euskera con su etiqueta en la propia lengua', () => {
    expect(SESSION_LANGS).toContain('eu');
    expect(SESSION_LANG_LABEL.eu).toBe('Euskara');
  });

  it('incluye el catalán con su etiqueta en la propia lengua', () => {
    expect(SESSION_LANGS).toContain('ca');
    expect(SESSION_LANG_LABEL.ca).toBe('Català');
  });

  it('incluye el español latinoamericano y el inglés', () => {
    expect(SESSION_LANGS).toContain('es-419');
    expect(SESSION_LANG_LABEL['es-419']).toBe('Español (Latinoamérica)');
    expect(SESSION_LANGS).toContain('en');
    expect(SESSION_LANG_LABEL.en).toBe('English (US)');
  });

  it('coincide con las lenguas locutables de la capa de voz (sin deriva)', () => {
    expect([...SESSION_LANGS].sort()).toEqual([...VOICE_LANGS].sort());
  });

  it('toda lengua de sesión tiene banco verbal registrado (el selector no promete de más)', () => {
    expect([...SESSION_LANGS].sort()).toEqual([...VERBAL_BANK_LANGS].sort());
  });
});

