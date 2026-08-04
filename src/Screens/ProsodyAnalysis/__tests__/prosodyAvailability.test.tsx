import React, { useEffect } from 'react';
import { act, create } from 'react-test-renderer';

import {
  getProsodyMicAdapter,
  setProsodyMicAdapter,
  useProsodyAnalysis,
  type ProsodyMicAdapter,
} from '../useProsodyAnalysis';

/* -------------------------------------------------------------------------- */
/*  REGRESIÓN — «el módulo de análisis prosódico dice que no detecta           */
/*  micrófono».                                                               */
/*                                                                            */
/*  La pantalla registra su adaptador de captura en un `useEffect`, o sea      */
/*  DESPUÉS del primer render. El `useEffect` del hook está declarado ANTES    */
/*  —el hook se invoca en la primera línea del componente— y los efectos de un */
/*  mismo componente corren en orden de declaración, así que el del hook       */
/*  siempre veía `micAdapter === null`.                                        */
/*                                                                            */
/*  Sin nadie que avisara del registro posterior, `available` se quedaba en    */
/*  `false` PARA SIEMPRE: la pantalla pintaba «No hay micrófono disponible en  */
/*  este dispositivo» y dejaba deshabilitado el botón de iniciar la toma, en   */
/*  un equipo con micrófono perfectamente funcional. No era intermitente ni    */
/*  dependía del dispositivo: era determinista, y salir y volver a entrar      */
/*  tampoco lo arreglaba porque al desmontar el adaptador se desregistra.      */
/*                                                                            */
/*  Lo que se vigila aquí es el ORDEN REAL de la pantalla, no una llamada      */
/*  suelta: el harness reproduce «hook primero, registro después».             */
/* -------------------------------------------------------------------------- */

const fakeAdapter = (): ProsodyMicAdapter => ({
  sampleRate: 16000,
  startRecording: async () => {},
  stopRecording: async () => new Float32Array(0),
  analyse: async () => ({}) as never,
  hasSignal: () => false,
});

type State = ReturnType<typeof useProsodyAnalysis>;

/** Mismo orden que `ProsodyAnalysisScreen`: hook arriba, registro en efecto. */
const renderScreenLike = (register: boolean) => {
  const seen = { current: null as unknown as State };

  const Harness = () => {
    seen.current = useProsodyAnalysis();
    useEffect(() => {
      if (!register) return;
      setProsodyMicAdapter(fakeAdapter());
      return () => setProsodyMicAdapter(null);
    }, []);
    return null;
  };

  let renderer!: ReturnType<typeof create>;
  act(() => {
    renderer = create(<Harness />);
  });
  return { seen, unmount: () => act(() => renderer.unmount()) };
};

describe('useProsodyAnalysis · disponibilidad del micrófono', () => {
  afterEach(() => setProsodyMicAdapter(null));

  it('ve el adaptador que la pantalla registra DESPUÉS del primer render', () => {
    const { seen, unmount } = renderScreenLike(true);
    expect(seen.current.available).toBe(true);
    unmount();
  });

  it('sigue diciendo que no hay micrófono cuando de verdad no lo hay', () => {
    const { seen, unmount } = renderScreenLike(false);
    expect(seen.current.available).toBe(false);
    unmount();
  });

  it('volver a entrar en la pantalla vuelve a ver el micrófono', () => {
    const primera = renderScreenLike(true);
    expect(primera.seen.current.available).toBe(true);
    primera.unmount();
    expect(getProsodyMicAdapter()).toBeNull(); // el desmontaje desregistra

    const segunda = renderScreenLike(true);
    expect(segunda.seen.current.available).toBe(true);
    segunda.unmount();
  });

  it('el registro y la baja se reflejan en vivo, sin remontar', () => {
    const { seen, unmount } = renderScreenLike(false);
    expect(seen.current.available).toBe(false);

    act(() => setProsodyMicAdapter(fakeAdapter()));
    expect(seen.current.available).toBe(true);

    act(() => setProsodyMicAdapter(null));
    expect(seen.current.available).toBe(false);
    unmount();
  });
});

/* -------------------------------------------------------------------------- */
/*  REGRESIÓN — la pantalla se quedaba «grabando» para siempre.                */
/*                                                                            */
/*  `startRecording` lanza si el permiso se deniega o si no hay motor de       */
/*  captura. El hook no lo capturaba: la promesa se rechazaba sin dueño y la   */
/*  fase se quedaba en `recording`, con su botón de detener y sin un solo      */
/*  bloque de audio. El clínico esperaba una toma que nunca existió.           */
/* -------------------------------------------------------------------------- */
describe('useProsodyAnalysis · arranque fallido', () => {
  afterEach(() => setProsodyMicAdapter(null));

  it('un arranque que lanza deja la toma en error, no en «grabando»', async () => {
    const roto: ProsodyMicAdapter = {
      ...fakeAdapter(),
      startRecording: async () => {
        throw new Error('Permiso de micrófono denegado');
      },
      health: () => 'no-permission',
    };

    const seen = { current: null as unknown as State };
    const Harness = () => {
      seen.current = useProsodyAnalysis();
      useEffect(() => {
        setProsodyMicAdapter(roto);
        return () => setProsodyMicAdapter(null);
      }, []);
      return null;
    };

    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(<Harness />);
    });

    await act(async () => {
      await seen.current.start();
    });

    expect(seen.current.phase).toBe('error');
    expect(seen.current.issues.noSignal).toBe(true);
    expect(seen.current.micHealth).toBe('no-permission');

    act(() => renderer.unmount());
  });
});
