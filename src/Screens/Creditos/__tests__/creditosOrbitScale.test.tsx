/* -------------------------------------------------------------------------- */
/*  El CABLEADO: la pantalla usa la escala también en los puntos de la órbita.  */
/*                                                                            */
/*  `creditsLayout.test.ts` demuestra que la función pura escala el emblema y  */
/*  que los trece puntos siguen dentro. Eso no dice nada de si la pantalla la  */
/*  usa: un `scale={1}` a fuego en `<OrbitDot>` encogería el envoltorio y      */
/*  dejaría los puntos donde estaban —fuera de la tarjeta— con la función      */
/*  pura en verde. Es la misma figura que las dos pruebas inertes que este     */
/*  trabajo vino a sustituir, y por eso se cubre aparte.                       */
/*                                                                            */
/*  Se sustituye el MÓDULO de layout, no `useWindowDimensions`: espiar el hook */
/*  desde fuera no llega al componente (medido: 0 llamadas), y la guarda de    */
/*  `scripts/__tests__/windowDimensionsSpy.test.js` lo impide.                 */
/* -------------------------------------------------------------------------- */
import React from 'react';
import { act, create } from 'react-test-renderer';
import { SafeAreaProvider } from 'react-native-safe-area-context';

jest.mock('@/Components/Common', () => ({ Header: () => null }));
jest.mock('react-redux', () => ({
  useSelector: (selector: any) => selector({ locale: { language: 'es' } }),
  useDispatch: () => jest.fn(),
}));

const ESCALA = 0.7;

jest.mock('../creditsLayout', () => ({
  computeCreditsLayout: () => ({
    twoColumns: true,
    isTabletLandscape: false,
    isMobileLandscape: true,
    isMobile: true,
    isSmallPhone: false,
    emblemScale: ESCALA,
    emblemBox: 140,
    coreSize: 59,
    ringSize: 84,
    isotypeSize: 39,
  }),
}));

import CreditosScreen from '../CreditosScreen';
import { ORBIT_MODULES } from '../orbitModules';

const SAFE_AREA_METRICS = {
  frame: { x: 0, y: 0, width: 740, height: 360 },
  insets: { top: 12, left: 0, right: 0, bottom: 12 },
};

it('con el emblema encogido, los puntos de la órbita encogen con él', () => {
  let tree: ReturnType<typeof create> | undefined;
  act(() => {
    tree = create(
      <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
        <CreditosScreen navigation={{ navigate: jest.fn() } as never} route={{} as never} />
      </SafeAreaProvider>,
    );
  });

  const json = JSON.stringify(tree!.toJSON());

  // El envoltorio toma la talla del layout...
  expect(json).toContain('"width":140');
  // ...y CADA punto toma su diámetro escalado, no el original.
  ORBIT_MODULES.forEach(m => {
    expect(json).toContain(`"width":${m.size * ESCALA}`);
  });

  act(() => tree!.unmount());
});
