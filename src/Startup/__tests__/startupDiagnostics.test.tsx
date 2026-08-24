import React from 'react';
import { act, create } from 'react-test-renderer';

/* -------------------------------------------------------------------------- */
/*  Lo que vigila este fichero es que un arranque roto se pueda LEER.          */
/*                                                                            */
/*  El APK del 24/8/2026 no abría y se quedaba colgado, y no había manera de   */
/*  saber en qué eslabón: la app no tenía ninguna barrera de error (una        */
/*  excepción de render dejaba la pantalla en blanco) y las dos esperas del    */
/*  arranque —la rehidratación de redux-persist y `initDatabase()`— pintaban   */
/*  el mismo splash mudo, con el error yendo solo a `console.error`, que en    */
/*  release no lo lee nadie.                                                   */
/*                                                                            */
/*  Las pruebas de abajo son sobre el TEXTO que acaba en pantalla, no sobre    */
/*  la existencia de los componentes: un boundary que capture y no diga nada   */
/*  deja el mismo agujero que no tenerlo.                                      */
/* -------------------------------------------------------------------------- */

import { describeError } from '../describeError';
import StartupErrorBoundary from '../StartupErrorBoundary';
import StartupReport from '../StartupReport';

/** Todo el texto del árbol renderizado, concatenado. */
const textOf = (tree: ReturnType<typeof create>): string =>
  JSON.stringify(tree.toJSON());

/* `StartupReport` cuenta los segundos de espera con un `setInterval`. Si un
 * árbol se queda montado al acabar la prueba, ese reloj sigue vivo y dispara
 * un `setState` fuera de `act(...)` en mitad de la siguiente: no rompe nada,
 * pero llena la salida de avisos que tapan los fallos de verdad. Se desmonta
 * siempre — y de paso se comprueba que el reloj se para al desmontar. */
const render = (element: React.ReactElement) => {
  let tree: ReturnType<typeof create> | undefined;
  act(() => {
    tree = create(element);
  });
  return tree!;
};

const mounted: ReturnType<typeof create>[] = [];
const renderAndTrack = (element: React.ReactElement) => {
  const tree = render(element);
  mounted.push(tree);
  return tree;
};

afterEach(() => {
  act(() => {
    while (mounted.length > 0) mounted.pop()!.unmount();
  });
});

describe('describeError', () => {
  it('saca el mensaje de un Error normal', () => {
    const d = describeError(new Error('no such table: professional'));
    expect(d.message).toBe('no such table: professional');
    expect(d.detail).toContain('no such table');
  });

  it('acepta una cadena (una promesa puede rechazarse con una)', () => {
    expect(describeError('boom').message).toBe('boom');
  });

  /* REGRESIÓN — el puente nativo devuelve objetos planos, y `String(e)` sobre
   * ellos produce «[object Object]»: otra forma de no decir nada. */
  it('lee objetos planos del puente nativo, con su código', () => {
    const d = describeError({ code: 'ERR_NITRO_OPEN', message: 'unable to open database file' });
    expect(d.message).toBe('unable to open database file');
    expect(d.detail).toContain('ERR_NITRO_OPEN');
  });

  /* REGRESIÓN — TypeORM envuelve el error real del driver; sin esto siempre se
   * leería el genérico y nunca lo que dijo SQLite. */
  it('desentierra el error del driver que TypeORM envuelve', () => {
    const d = describeError({
      message: 'Driver not Connected',
      driverError: { message: 'no such column: patient.nhc' },
    });
    expect(d.detail).toContain('no such column: patient.nhc');
  });

  it('nunca devuelve un mensaje vacío', () => {
    for (const value of [undefined, null, {}, 0, false]) {
      expect(describeError(value).message.length).toBeGreaterThan(0);
    }
  });
});

describe('StartupErrorBoundary', () => {
  const Exploding = (): React.ReactElement => {
    throw new Error('AudioContext nativo no disponible');
  };

  it('pinta EN PANTALLA el mensaje de una excepción de render', () => {
    /* React escribe la excepción capturada por consola; aquí estorba. */
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const tree = renderAndTrack(
      <StartupErrorBoundary stage="la interfaz">
        <Exploding />
      </StartupErrorBoundary>,
    );
    const text = textOf(tree);
    expect(text).toContain('AudioContext nativo no disponible');
    expect(text).toContain('no ha podido arrancar');
    spy.mockRestore();
  });

  it('no estorba cuando no hay fallo', () => {
    const tree = renderAndTrack(
      <StartupErrorBoundary>
        <StartupReport stage="las preferencias guardadas" />
      </StartupErrorBoundary>,
    );
    expect(textOf(tree)).toContain('VIA+');
  });
});

describe('StartupReport', () => {
  it('nombra el eslabón que falló', () => {
    const tree = renderAndTrack(
      <StartupReport stage="la base de datos local" error={new Error('unable to open database file')} />,
    );
    const text = textOf(tree);
    expect(text).toContain('la base de datos local');
    expect(text).toContain('unable to open database file');
  });

  /* REGRESIÓN — el caso que se vio en campo: NO hay error, simplemente la
   * promesa no vuelve. Antes eso era un splash idéntico al de un arranque
   * sano y por eso «se queda colgado» no se podía distinguir de «va lento». */
  it('avisa cuando la espera se alarga sin dar ningún error', () => {
    jest.useFakeTimers();
    const tree = renderAndTrack(<StartupReport stage="la base de datos local" stallSeconds={8} />);
    expect(textOf(tree)).not.toContain('Sigue esperando');

    act(() => {
      jest.advanceTimersByTime(9000);
    });
    const text = textOf(tree);
    expect(text).toContain('Sigue esperando');
    expect(text).toContain('la base de datos local');
    jest.useRealTimers();
  });
});
