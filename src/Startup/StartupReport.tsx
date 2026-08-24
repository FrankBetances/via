import React, { useEffect, useRef, useState } from 'react';
import { View, ActivityIndicator, ScrollView, Text, StyleSheet } from 'react-native';

import { describeError } from './describeError';

/* -------------------------------------------------------------------------- */
/*  StartupReport — la pantalla de arranque que SÍ dice qué está pasando.      */
/*                                                                            */
/*  Sustituye al splash mudo. Tiene tres estados y ninguno es «pantalla fija   */
/*  sin explicación»:                                                          */
/*                                                                            */
/*    · esperando  → splash normal (el arranque sano dura décimas de segundo)  */
/*    · atascado   → pasados `stallMs` sin terminar, NOMBRA el eslabón en el   */
/*      que se quedó esperando y cuánto lleva                                  */
/*    · fallo      → mensaje real del error, con código, causa y pila          */
/*                                                                            */
/*  POR QUÉ (regla 4: nada puede fallar en silencio)                           */
/*  El arranque tenía dos esperas sin límite —la rehidratación de              */
/*  redux-persist y `initDatabase()`— y las dos pintaban el MISMO splash. Si   */
/*  cualquiera de ellas no resolvía, la app se quedaba ahí indefinidamente; el */
/*  fallo de la base de datos, además, solo iba a `console.error`, que en un   */
/*  APK de release no lo lee nadie. Visto desde fuera: «no abre, se queda      */
/*  colgado», sin una sola pista de por qué ni de en cuál de las dos.          */
/* -------------------------------------------------------------------------- */

export interface StartupReportProps {
  /** Qué se está esperando, en palabras del usuario ("la base de datos local"). */
  stage: string;
  /** Fallo, si lo hubo. `undefined` = seguimos esperando. */
  error?: unknown;
  /** A partir de cuántos segundos se considera atascado. */
  stallSeconds?: number;
}

/**
 * Segundos transcurridos desde el montaje. El contador vive AQUÍ y no en el
 * llamador a propósito: `PersistGate` recibe su pantalla de espera como un
 * elemento ya creado y no vuelve a renderizarla, así que un contador de fuera
 * nunca avanzaría y la espera infinita seguiría siendo indistinguible de una
 * espera normal.
 */
function useSecondsSinceMount(active: boolean): number {
  const [seconds, setSeconds] = useState(0);
  const startedAt = useRef(Date.now());

  useEffect(() => {
    if (!active) return undefined;
    const id = setInterval(() => {
      setSeconds(Math.floor((Date.now() - startedAt.current) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [active]);

  return seconds;
}

export default function StartupReport({
  stage,
  error,
  stallSeconds = 8,
}: StartupReportProps) {
  const failed = error !== undefined && error !== null;
  const waitedSeconds = useSecondsSinceMount(!failed);

  if (failed) {
    const { message, detail } = describeError(error);
    return (
      <View style={styles.container}>
        <Text style={styles.brand}>VIA+</Text>
        <Text style={styles.title}>La app no ha podido arrancar</Text>
        <Text style={styles.stage}>Falló al preparar {stage}.</Text>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          <Text style={styles.message}>{message}</Text>
          {detail ? <Text style={styles.detail}>{detail}</Text> : null}
        </ScrollView>
        <Text style={styles.footer}>
          Esta pantalla existe para que el fallo se pueda leer sin cable ni logcat.
          Fotografíala y pásala tal cual.
        </Text>
      </View>
    );
  }

  const stalled = waitedSeconds >= stallSeconds;
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#F0AE6C" />
      <Text style={styles.brand}>VIA+</Text>
      {stalled ? (
        <>
          <Text style={styles.title}>Sigue esperando</Text>
          <Text style={styles.stage}>
            {stage} lleva {waitedSeconds} s sin responder y no ha dado ningún error.
          </Text>
          <Text style={styles.footer}>
            El arranque sano tarda décimas de segundo. Si esto no cambia, el eslabón
            atascado es este.
          </Text>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F2EC',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  brand: { fontSize: 18, color: '#2B2620', fontWeight: '600' },
  title: { fontSize: 20, color: '#8C2F13', fontWeight: '700', textAlign: 'center' },
  stage: { fontSize: 15, color: '#2B2620', textAlign: 'center' },
  scroll: { alignSelf: 'stretch', maxHeight: 320 },
  scrollContent: { gap: 10, paddingBottom: 8 },
  message: { fontSize: 15, color: '#2B2620', fontWeight: '600' },
  detail: { fontSize: 12, color: '#5A5148', fontFamily: 'monospace' },
  footer: { fontSize: 12, color: '#5A5148', textAlign: 'center' },
});
