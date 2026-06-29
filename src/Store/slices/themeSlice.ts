import { createSlice, PayloadAction } from '@reduxjs/toolkit';

/* -------------------------------------------------------------------------- */
/*  theme slice — PERSISTIDO (whitelist de redux-persist, ver README          */
/*  §Stack Tecnológico: "Estado global offline-first (whitelist `theme`)").   */
/* -------------------------------------------------------------------------- */

export type ColorMode = 'light' | 'dark';

export interface ThemeState {
  colorMode: ColorMode;
  fontScale: number;
}

const initialState: ThemeState = {
  colorMode: 'light',
  fontScale: 1,
};

const themeSlice = createSlice({
  name: 'theme',
  initialState,
  reducers: {
    setColorMode(state, action: PayloadAction<ColorMode>) {
      state.colorMode = action.payload;
    },
    setFontScale(state, action: PayloadAction<number>) {
      state.fontScale = action.payload;
    },
  },
});

export const { setColorMode, setFontScale } = themeSlice.actions;
export default themeSlice.reducer;
