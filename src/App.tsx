import 'reflect-metadata';
import React, { useEffect, useState } from 'react';
import { Provider as ReduxProvider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { GluestackUIProvider } from '@gluestack-ui/themed';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { store, persistor } from '@/Store';
import { config } from '@/Theme/gluestack-ui.config';
import { initDatabase } from '@/Database/config';
import DefaultNavigator from '@/Navigators/Default';
import SplashScreen from '@/Screens/Splash/SplashScreen';
import { AudioEngineProvider } from '@/Providers/AudioEngineProvider';
import '@/Navigators/screenTypeNavigator';

/* -------------------------------------------------------------------------- */
/*  Punto de entrada de la app — VIA+.                                      */
/*  Orden de providers: Redux -> PersistGate -> GluestackUI ->               */
/*  AudioEngineProvider (motor de audio compartido) -> Navigation.           */
/*  El DataSource de TypeORM se inicializa una vez al montar; mientras tanto  */
/*  se muestra un splash.                                                     */
/* -------------------------------------------------------------------------- */

function AppShell() {
  const [dbReady, setDbReady] = useState(false);
  const [dbError, setDbError] = useState<unknown>(null);

  useEffect(() => {
    let mounted = true;
    initDatabase()
      .then(() => {
        if (mounted) setDbReady(true);
      })
      .catch(err => {
        if (mounted) setDbError(err);
      });
    return () => {
      mounted = false;
    };
  }, []);

  if (!dbReady) {
    // En caso de error de inicialización, se sigue mostrando el splash;
    // el manejo de error/reintento clínico se añade en una fase posterior.
    if (dbError) {
      console.error('VIA+: error inicializando la base de datos local', dbError);
    }
    return <SplashScreen />;
  }

  return (
    <NavigationContainer>
      <DefaultNavigator />
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ReduxProvider store={store}>
        <PersistGate loading={<SplashScreen />} persistor={persistor}>
          <SafeAreaProvider>
            <GluestackUIProvider config={config}>
              <AudioEngineProvider>
                <AppShell />
              </AudioEngineProvider>
            </GluestackUIProvider>
          </SafeAreaProvider>
        </PersistGate>
      </ReduxProvider>
    </GestureHandlerRootView>
  );
}
