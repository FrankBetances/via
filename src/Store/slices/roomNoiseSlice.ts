import { createSlice, PayloadAction } from '@reduxjs/toolkit';

import {
  applyRoomNoiseSkip,
  applyRoomNoiseVerdict,
  initialRoomNoise,
  type RoomNoiseState,
  type RoomNoiseStatus,
} from './roomNoiseState';

/* -------------------------------------------------------------------------- */
/*  Slice de la verificación acústica de la sala.                              */
/*                                                                             */
/*  Envoltorio DELGADO sobre `roomNoiseState.ts`: toda la decisión —qué cuenta */
/*  como sala verificada y qué se le muestra al clínico— vive allí, en lógica  */
/*  pura y sin redux, para poder probarla. Es el mismo patrón que              */
/*  `sessionLangs.ts`, y no es estilo: el jest del proyecto no transforma el   */
/*  ESM de `@reduxjs/toolkit`, así que una regla clínica escrita dentro del    */
/*  reducer sería una regla clínica sin prueba.                                */
/*                                                                             */
/*  NO se persiste (fuera de la whitelist de redux-persist): la acústica de    */
/*  una sala es de ESTA sesión y en ESTE sitio.                                */
/* -------------------------------------------------------------------------- */

const roomNoiseSlice = createSlice({
  name: 'roomNoise',
  initialState: initialRoomNoise,
  reducers: {
    setRoomNoiseVerdict: (
      _state,
      action: PayloadAction<{
        status: Exclude<RoomNoiseStatus, 'unmeasured' | 'skipped'>;
        avgDb: number | null;
        peakDb: number | null;
      }>,
    ): RoomNoiseState =>
      applyRoomNoiseVerdict(action.payload.status, action.payload.avgDb, action.payload.peakDb),
    skipRoomNoiseCheck: (): RoomNoiseState => applyRoomNoiseSkip(),
    resetRoomNoise: (): RoomNoiseState => initialRoomNoise,
  },
});

export const { setRoomNoiseVerdict, skipRoomNoiseCheck, resetRoomNoise } = roomNoiseSlice.actions;
export default roomNoiseSlice.reducer;
export { isRoomVerified, roomNoiseLabel } from './roomNoiseState';
export type { RoomNoiseState, RoomNoiseStatus } from './roomNoiseState';
