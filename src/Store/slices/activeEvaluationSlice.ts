import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { EvaluationStatus } from '@/Models/Evaluation/Evaluation';

/* -------------------------------------------------------------------------- */
/*  activeEvaluation slice — NO persistido (fuera de la whitelist de          */
/*  redux-persist). Mantiene la evaluación clínica en curso (paciente +       */
/*  profesional + estado del CAP) mientras el usuario recorre la batería de   */
/*  9 módulos. Las pantallas de módulo (`useClassSelector(Evaluation, ...)`)  */
/*  leen `state.activeEvaluation.evaluation` — ver Contrato de Compilación.   */
/*                                                                            */
/*  `ActiveEvaluationView` es un DTO de PRESENTACIÓN propio de este slice,    */
/*  NO el `Patient`/`Professional` real (seudonimizado/RBAC, ver Models). Las */
/*  9 pantallas de módulo (construidas contra un esquema v1 en texto plano)   */
/*  solo leen de aquí `patient.name/lastName/nhc` y                          */
/*  `professional.name/licenseNumber` para mostrar cabeceras; la             */
/*  identificación real seudonimizada vive en `Models/Patient`. Esta vista    */
/*  se puebla desde la capa de Pacientes/Evaluación en una fase posterior.    */
/* -------------------------------------------------------------------------- */

export interface ActiveEvaluationPatientView {
  id: number;
  name: string;
  lastName: string;
  nhc?: string;
}

export interface ActiveEvaluationProfessionalView {
  id: number;
  name: string;
  licenseNumber: string;
}

export interface ActiveEvaluationView {
  id: number;
  status: EvaluationStatus;
  patient: ActiveEvaluationPatientView | null;
  professional: ActiveEvaluationProfessionalView | null;
}

export interface ActiveEvaluationState {
  evaluation: ActiveEvaluationView | null;
}

const initialState: ActiveEvaluationState = {
  evaluation: null,
};

const activeEvaluationSlice = createSlice({
  name: 'activeEvaluation',
  initialState,
  reducers: {
    setActiveEvaluation(state, action: PayloadAction<ActiveEvaluationView | null>) {
      state.evaluation = action.payload;
    },
    clearActiveEvaluation(state) {
      state.evaluation = null;
    },
  },
});

export const { setActiveEvaluation, clearActiveEvaluation } = activeEvaluationSlice.actions;
export default activeEvaluationSlice.reducer;
