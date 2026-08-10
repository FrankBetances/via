/* -------------------------------------------------------------------------- */
/*  Integración: micrófono clínico real → permiso de ruido revocado.            */
/*                                                                             */
/*  `noisePermit.test.ts` prueba el control con dependencias inyectadas. Aquí se */
/*  prueba el CABLEADO de verdad: el `acquireRecordingSession()` de `@/Audio`     */
/*  —el mismo que llaman los módulos clínicos— contra el renovador instalado con  */
/*  `installNoisePermit()` y un adaptador de Lúa falso. Si alguien rompe el aviso */
/*  de `onRecordingSessionChange`, o el renovador deja de escucharlo, esta suite  */
/*  se cae aunque las otras dos sigan verdes.                                    */
/*                                                                             */
/*  Es la puerta de salida de la F3 (docs/design/integracion-lua.md §9).         */
/* -------------------------------------------------------------------------- */

import { acquireRecordingSession, __resetSharedAudioContextForTests } from '@/Audio';
import { setLuaAdapter, type LuaAdapter } from '../luaAdapter';
import {
  installNoisePermit,
  isNoisePermitGranted,
  setActiveLuaRoute,
  __resetNoisePermitForTests,
} from '../noisePermit';
import { handleNavigationStateChange } from '../luaRoute';
import { LUA_CAP_SPEAKER } from '../luaProtocol';

/** Lúa de la v2 (con altavoz): la única configuración en la que hay algo que revocar. */
function fakeLuaConAltavoz() {
  const permits: number[] = [];
  const adapter: LuaAdapter = {
    isConnected: () => true,
    capabilities: () => ({
      protocolVersion: 1,
      display: true,
      speaker: (LUA_CAP_SPEAKER & LUA_CAP_SPEAKER) !== 0,
      motors: false,
      rtc: false,
    }),
    sendExpression: () => {},
    sendNoisePermit: ttlMs => permits.push(ttlMs),
    subscribeStatus: () => () => {},
    onLinkChange: () => () => {},
  };
  setLuaAdapter(adapter);
  return { permits };
}

let stopPermit: (() => void) | null = null;

beforeEach(() => {
  jest.useFakeTimers();
  __resetSharedAudioContextForTests();
  __resetNoisePermitForTests();
});

afterEach(() => {
  stopPermit?.();
  stopPermit = null;
  __resetNoisePermitForTests();
  setLuaAdapter(null);
  jest.clearAllTimers();
  jest.useRealTimers();
});

describe('el micrófono clínico revoca el permiso de ruido', () => {
  it('abrir la sesión de grabación revoca; cerrarla la devuelve', () => {
    const { permits } = fakeLuaConAltavoz();
    stopPermit = installNoisePermit();
    setActiveLuaRoute('SeleccionEjercicios');
    expect(isNoisePermitGranted()).toBe(true);

    // Esto es EXACTAMENTE lo que hace cualquier adaptador de micrófono de VIA+.
    const release = acquireRecordingSession();
    expect(isNoisePermitGranted()).toBe(false);
    expect(permits[permits.length - 1]).toBe(0);

    release();
    expect(isNoisePermitGranted()).toBe(true);
  });

  it('con dos módulos grabando a la vez, el permiso no vuelve hasta el último', () => {
    fakeLuaConAltavoz();
    stopPermit = installNoisePermit();
    setActiveLuaRoute('ResultadosFinal');

    const releaseA = acquireRecordingSession();
    const releaseB = acquireRecordingSession();
    expect(isNoisePermitGranted()).toBe(false);

    releaseA();
    expect(isNoisePermitGranted()).toBe(false);
    releaseB();
    expect(isNoisePermitGranted()).toBe(true);
  });

  it('mientras hay micrófono abierto no se envía ninguna renovación', () => {
    const { permits } = fakeLuaConAltavoz();
    stopPermit = installNoisePermit();
    setActiveLuaRoute('SeleccionEjercicios');
    const release = acquireRecordingSession();
    const enviadas = permits.length;

    jest.advanceTimersByTime(60_000); // un minuto de grabación
    expect(permits).toHaveLength(enviadas);

    release();
  });

  it('instalar Lúa a mitad de una grabación no concede permiso', () => {
    const { permits } = fakeLuaConAltavoz();
    const release = acquireRecordingSession();

    stopPermit = installNoisePermit();
    setActiveLuaRoute('SeleccionEjercicios');
    expect(isNoisePermitGranted()).toBe(false);
    expect(permits).toEqual([]);

    release();
  });

  it('el permiso hereda la ruta informada ANTES de instalarse', () => {
    // El navegador informa de la ruta desde el arranque; Lúa puede instalarse
    // después (cuando aparezca el BleManager compartido) y debe encontrarse el
    // estado, no un hueco.
    fakeLuaConAltavoz();
    setActiveLuaRoute('SeleccionEjercicios');
    stopPermit = installNoisePermit();
    expect(isNoisePermitGranted()).toBe(true);
  });
});

describe('la ruta llega desde el estado del navegador', () => {
  it('un módulo clínico anidado revoca aunque el contenedor esté permitido', () => {
    fakeLuaConAltavoz();
    stopPermit = installNoisePermit();

    handleNavigationStateChange({
      index: 0,
      routes: [
        {
          name: 'SeleccionEjercicios',
          state: { index: 0, routes: [{ name: 'VoiceAnalysis' }] },
        },
      ],
    });
    expect(isNoisePermitGranted()).toBe(false);
  });

  it('la pantalla activa de la pila es la que decide', () => {
    fakeLuaConAltavoz();
    stopPermit = installNoisePermit();

    handleNavigationStateChange({
      index: 1,
      routes: [{ name: 'VoiceAnalysis' }, { name: 'ResultadosPreliminares' }],
    });
    expect(isNoisePermitGranted()).toBe(true);

    handleNavigationStateChange({
      index: 0,
      routes: [{ name: 'ProsodyAnalysis' }, { name: 'ResultadosPreliminares' }],
    });
    expect(isNoisePermitGranted()).toBe(false);
  });

  it('un estado vacío o nulo no concede nada', () => {
    fakeLuaConAltavoz();
    stopPermit = installNoisePermit();

    handleNavigationStateChange(null);
    expect(isNoisePermitGranted()).toBe(false);
    handleNavigationStateChange({ index: 0, routes: [] });
    expect(isNoisePermitGranted()).toBe(false);
  });
});

describe('sin Lúa conectada', () => {
  it('todo el mecanismo es inerte: ni un envío, ni un error', () => {
    stopPermit = installNoisePermit(); // sin `setLuaAdapter`: no hay periférico
    setActiveLuaRoute('SeleccionEjercicios');
    expect(isNoisePermitGranted()).toBe(false);

    const release = acquireRecordingSession();
    expect(() => {
      jest.advanceTimersByTime(10_000);
    }).not.toThrow();
    release();
  });
});
