import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { ProfessionalDTO } from '@/Models/Professional/Professional';

/* -------------------------------------------------------------------------- */
/*  auth slice — NO persistido (fuera de la whitelist de redux-persist).      */
/*  La sesión del profesional vive solo en memoria; cada arranque exige        */
/*  reautenticación, consistente con JWT de corta caducidad (README).         */
/* -------------------------------------------------------------------------- */

export interface AuthState {
  isLogged: boolean;
  currentProfessional: ProfessionalDTO | null;
}

const initialState: AuthState = {
  isLogged: false,
  currentProfessional: null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    loginSuccess(state, action: PayloadAction<ProfessionalDTO>) {
      state.isLogged = true;
      state.currentProfessional = action.payload;
    },
    logout(state) {
      state.isLogged = false;
      state.currentProfessional = null;
    },
  },
});

export const { loginSuccess, logout } = authSlice.actions;
export default authSlice.reducer;
