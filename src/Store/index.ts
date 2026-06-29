import { combineReducers, configureStore } from '@reduxjs/toolkit';
import {
  FLUSH,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER,
  REHYDRATE,
  persistReducer,
  persistStore,
} from 'redux-persist';
import AsyncStorage from '@react-native-async-storage/async-storage';

import themeReducer from '@/Store/slices/themeSlice';
import authReducer from '@/Store/slices/authSlice';

/* -------------------------------------------------------------------------- */
/*  Store de Redux Toolkit — VIA+.                                           */
/*  Whitelist de redux-persist: SOLO `theme` (ver README §Stack Tecnológico). */
/*  `auth` se mantiene fuera de la persistencia (sesión solo en memoria).     */
/* -------------------------------------------------------------------------- */

const rootReducer = combineReducers({
  theme: themeReducer,
  auth: authReducer,
});

const persistConfig = {
  key: 'via-plus-root',
  storage: AsyncStorage,
  whitelist: ['theme'],
};

const persistedReducer = persistReducer(persistConfig, rootReducer);

export const store = configureStore({
  reducer: persistedReducer,
  middleware: getDefaultMiddleware =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, PAUSE, PERSIST, PURGE, REGISTER, REHYDRATE],
      },
    }),
});

export const persistor = persistStore(store);

export type RootState = ReturnType<typeof rootReducer>;
export type AppDispatch = typeof store.dispatch;
