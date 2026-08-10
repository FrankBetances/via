import 'reflect-metadata';
import React, { useEffect, useState } from 'react';
import { Provider as ReduxProvider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { GluestackUIProvider } from '@gluestack-ui/themed';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { store, persistor } from '@/Store';
import { config } from '@/Theme/gluestack-ui.config';
import { initDatabase } from '@/Database/config';
import DefaultNavigator from '@/Navigators/Default';
import SplashScreen from '@/Screens/Splash/SplashScreen';
import { handleNavigationStateChange } from '@/Lua';
import { installAudiometryToneAdapter } from '@/Screens/Audiometry';
import { installVerbalAudioAdapter, verbalAudioBase64ForLang, verbalAudioSourceForLang } from '@/Screens/VerbalAudiometry';
import '@/Navigators/screenTypeNavigator';

/* -------------------------------------------------------------------------- */
/*  Punto de entrada de la app — VIA+.                                      */
/*  Orden de providers: Redux -> PersistGate -> GluestackUI -> Navigation.   */
/*  El DataSource de TypeORM se inicializa una vez al montar; mientras tanto  */
/*  se muestra un splash.                                                     */
/* -------------------------------------------------------------------------- */

/* Ref del contenedor de navegación: solo se usa para leer el estado inicial de
 * rutas al quedar listo (ver `onReady`). */
const navigationRef = createNavigationContainerRef();

function AppShell() {
  const [dbReady, setDbReady] = useState(false);
  const [dbError, setDbError] = useState<unknown>(null);

  // Motor de tonos REAL (react-native-audio-api) para las dos audiometrías.
  // Sin esta instalación las pantallas quedaban en modo demostración (sin
  // emisión de sonido). Devuelve la función de limpieza del AudioContext.
  useEffect(() => installAudiometryToneAdapter(), []);

  // Motor de palabras de la audiometría verbal (campo libre).
  //
  // Vía PRIMARIA: los RECORTES pre-sintetizados incrustados en base64
  // (`verbalAudioBase64`), decodificados en memoria sobre el AudioContext de
  // la app. Es la cadena de degradación del blueprint de Valeria+
  // (docs/design/arquitectura-corpus-voz.md §6): asset neuronal de la lengua →
  // asset base → voz del sistema → silencio.
  //
  // `preferTts` estuvo en `true` y ESO era el fallo de campo «las voces no
  // suenan»: con el TTS del dispositivo como vía primaria, el estímulo clínico
  // dependía de un motor que resuelve `speak()` al ENCOLAR, así que una
  // locución que el motor descarta (la primera tras arrancar, una voz de red
  // sin cobertura) se daba por emitida y el recorte de respaldo no llegaba a
  // sonar. Además imponía la voz y el acento del dispositivo sobre un
  // estímulo que está validado clínicamente recorte a recorte.
  //
  // Con los recortes como vía primaria la emisión es determinista y idéntica
  // en todos los equipos; el TTS queda donde le corresponde, como degradación
  // para las lenguas que aún no tienen banco de locuciones (gl, eu).
  useEffect(
    () =>
      installVerbalAudioAdapter({
        preferTts: false,
        // Accesores POR IDIOMA (Quisqueya Habla): la sesión es-DO reproduce sus
        // recortes propios como vía primaria (el TTS del dispositivo impondría
        // otro acento); es mantiene el comportamiento histórico.
        assetBase64: verbalAudioBase64ForLang,
        assetSource: verbalAudioSourceForLang,
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
    <NavigationContainer
      ref={navigationRef}
      // La ruta activa alimenta la lista blanca del permiso de ruido del
      // periférico de refuerzo (docs/design/integracion-lua.md §3). Es *no-op*
      // mientras Lúa no esté instalada: nada de la app depende de esto.
      //
      // `onReady` además de `onStateChange` porque el segundo no se dispara con
      // el estado INICIAL: sin él, la primera pantalla del arranque quedaría sin
      // informar. No sería peligroso —una ruta desconocida no concede permiso—
      // pero dejaría a la gata dormida hasta la primera navegación.
      onReady={() => handleNavigationStateChange(navigationRef.getRootState())}
      onStateChange={handleNavigationStateChange}
    >
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
