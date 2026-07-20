import { createSlice, PayloadAction } from '@reduxjs/toolkit';

/* -------------------------------------------------------------------------- */
/*  locale slice — idioma/variante de la SESIÓN de evaluación (T1.6 / Q1.3).   */
/*                                                                             */
/*  Se elige en el hub de pruebas (SeleccionEjercicios) y lo leen los módulos  */
/*  que tienen contenido localizado (hoy la audiometría verbal: banco de       */
/*  estímulos + voz). PERSISTIDO (whitelist de redux-persist) para que la      */
/*  variante elegida sobreviva al reinicio, igual que el tema.                 */
/*                                                                             */
/*  Valor: código de banco registrado en `verbalAudiometryBanks.ts`           */
/*  ('es' | 'es-DO'); se guarda como string para no acoplar el store a un      */
/*  módulo de pantalla.                                                        */
/* -------------------------------------------------------------------------- */

export interface LocaleState {
  language: string;
}

const initialState: LocaleState = {
  language: 'es',
};

const localeSlice = createSlice({
  name: 'locale',
  initialState,
  reducers: {
    setSessionLanguage(state, action: PayloadAction<string>) {
      state.language = action.payload;
    },
  },
});

export const { setSessionLanguage } = localeSlice.actions;
export default localeSlice.reducer;
