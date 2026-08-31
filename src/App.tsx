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
import { StartupErrorBoundary, StartupReport } from '@/Startup';
import { installAudiometryToneAdapter } from '@/Screens/Audiometry';
import { installVerbalAudioAdapter, verbalAudioBase64ForLang, verbalAudioSourceForLang } from '@/Screens/VerbalAudiometry';
import '@/Navigators/screenTypeNavigator';
import { atoms } from '@/Theme/styleAtoms';

/* -------------------------------------------------------------------------- */
/*  Punto de entrada de la app — VIA+.                                      */
/*  Orden de providers: barrera de error -> Redux -> PersistGate ->          */
/*  GluestackUI -> Navigation.                                                */
/*  El DataSource de TypeORM se inicializa una vez al montar; mientras tanto  */
/*  la pantalla de arranque DICE qué se está esperando y, si falla, por qué   */
/*  (ver `@/Startup`). Antes mostraba un splash mudo en los dos casos.        */
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
    /* NI SPLASH MUDO NI `console.error` (regla 4). Antes, un fallo de
     * `initDatabase()` solo se escribía en la consola —invisible en un APK de
     * release— y la pantalla se quedaba en el splash para siempre: desde fuera,
     * «no abre, se queda colgado». Ahora el error se pinta, y si no hay error
     * pero la espera se alarga, la pantalla dice que el eslabón atascado es la
     * base de datos y no la rehidratación. */
    return <StartupReport stage="la base de datos local" error={dbError} />;
  }

  return (
    <NavigationContainer>
      <DefaultNavigator />
    </NavigationContainer>
  );
}

export default function App() {
  return (
    /* La barrera va POR FUERA de todos los proveedores: si el que revienta es
     * Redux, Gluestack o la navegación, el árbol se desmonta entero y sin ella
     * el APK se queda en blanco sin decir nada. */
    <StartupErrorBoundary stage="la interfaz">
      <GestureHandlerRootView style={atoms.flex1}>
        <ReduxProvider store={store}>
          <PersistGate
            loading={<StartupReport stage="las preferencias guardadas" />}
            persistor={persistor}
          >
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
    </StartupErrorBoundary>
  );
}
