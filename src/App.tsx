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
import { installAudiometryToneAdapter } from '@/Screens/Audiometry';
import { installVerbalAudioAdapter, verbalAudioBase64, verbalAudioSource } from '@/Screens/VerbalAudiometry';
import '@/Navigators/screenTypeNavigator';

/* -------------------------------------------------------------------------- */
/*  Punto de entrada de la app — VIA+.                                      */
/*  Orden de providers: Redux -> PersistGate -> GluestackUI -> Navigation.   */
/*  El DataSource de TypeORM se inicializa una vez al montar; mientras tanto  */
/*  se muestra un splash.                                                     */
/* -------------------------------------------------------------------------- */

function AppShell() {
  const [dbReady, setDbReady] = useState(false);
  const [dbError, setDbError] = useState<unknown>(null);

  // Motor de tonos REAL (react-native-audio-api) para las dos audiometrías.
  // Sin esta instalación las pantallas quedaban en modo demostración (sin
  // emisión de sonido). Devuelve la función de limpieza del AudioContext.
  useEffect(() => installAudiometryToneAdapter(), []);

  // Motor de palabras de la audiometría verbal (campo libre).
  //
  // Vía PRIMARIA: el TTS NEURAL del dispositivo (`preferTts`, por defecto) con
  // la MEJOR voz española instalada (la es-ES neural de Google/Apple suena
  // natural, muy por encima de los recortes provisionales de espeak-ng). Solo
  // se usa si hay una voz española VERIFICADA — sin verificar, Android dictaba
  // en inglés (bug de campo ya corregido).
  //
  // RESPALDO garantizado: los recortes es-ES INCRUSTADOS en base64
  // (`verbalAudioBase64`), decodificados en memoria (funcionan offline y sin
  // depender de la ruta del asset, que no sonaba en desarrollo). La ruta del
  // asset (`verbalAudioSource`) queda como último recurso.
  useEffect(
    () =>
      installVerbalAudioAdapter({
        preferTts: true,
        assetBase64: verbalAudioBase64,
        assetSource: verbalAudioSource,
      }),
    [],
  );

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
              {/* NOTA: no montar aquí ningún provider que cree un segundo
                  AudioContext ni que reconfigure la sesión de audio a modo
                  grabación al arrancar: pisa la sesión de reproducción del
                  adaptador de tonos y silencia las audiometrías. El motor de
                  tonos se instala en AppShell; el micrófono lo abre cada
                  módulo solo mientras lo usa. */}
              <AppShell />
            </GluestackUIProvider>
          </SafeAreaProvider>
        </PersistGate>
      </ReduxProvider>
    </GestureHandlerRootView>
  );
}
