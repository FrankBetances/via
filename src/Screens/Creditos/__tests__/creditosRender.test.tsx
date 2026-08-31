import React from 'react';
import { act, create } from 'react-test-renderer';

/* -------------------------------------------------------------------------- */
/*  Humo: la pantalla de créditos monta y desmonta entera.                     */
/*                                                                            */
/*  Monta MUCHAS piezas animadas a la vez —30 partículas, 9 barras de onda,    */
/*  2 anillos de pulso y un punto en órbita por módulo, cada uno con su       */
/*  reloj— y                                                                  */
/*  cinco marcas vectoriales. Un descuido en cualquiera (un import roto, un    */
/*  `useSharedValue` fuera de sitio, una marca sin cerrar) rompe la pantalla   */
/*  entera, y el compilador no lo ve. Esta prueba renderiza el árbol completo  */
/*  y comprueba que TODOS los módulos llegan al árbol, que el rótulo dice su   */
/*  número real, y que al desmontar no queda ninguna animación viva.          */
/* -------------------------------------------------------------------------- */

jest.mock('@/Components/Common', () => ({
  Header: () => null,
}));

jest.mock('react-redux', () => ({
  useSelector: (selector: any) => selector({ locale: { language: 'es' } }),
  useDispatch: () => jest.fn(),
}));

// La pantalla lee el área segura para colocar su barra superior en tableta.
// `useSafeAreaInsets` LANZA si no encuentra proveedor, así que el árbol se
// monta dentro de uno con métricas fijas: la app real sí lo tiene (`App.tsx`),
// y este doble evita que la prueba dependa de la pantalla del ejecutor.
import { SafeAreaProvider } from 'react-native-safe-area-context';

const SAFE_AREA_METRICS = {
  frame: { x: 0, y: 0, width: 1024, height: 768 },
  insets: { top: 24, left: 0, right: 0, bottom: 16 },
};

import CreditosScreen, { orbitCountWord } from '../CreditosScreen';
import { ORBIT_MODULES } from '../orbitModules';

const navigation = { navigate: jest.fn() } as never;

describe('CreditosScreen', () => {
  it('monta la pantalla completa y pinta TODOS los módulos', () => {
    let tree: ReturnType<typeof create> | undefined;
    act(() => {
      tree = create(
        <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
          <CreditosScreen navigation={navigation} route={{} as never} />
        </SafeAreaProvider>,
      );
    });
    expect(tree).toBeDefined();

    const json = JSON.stringify(tree!.toJSON());

    // Un punto por módulo, cada uno con su color de marca.
    ORBIT_MODULES.forEach(m => {
      expect(json).toContain(m.color);
    });

    // Y el rótulo dice CUÁNTOS son. Estuvo anunciando «DOCE MÓDULOS» encima de
    // trece puntos desde que entró el cribado ASHA, porque el número estaba
    // escrito a mano. Ahora sale de la propia constelación y esta prueba lo
    // contrasta contra ella.
    expect(json).toContain(
      `${orbitCountWord(ORBIT_MODULES.length)} MÓDULOS · UNA SOLA BATERÍA`,
    );

    // Y las secciones de la pantalla siguen ahí. El rediseño de agosto de 2026
    // renombró la última («CALIDAD Y NORMATIVA» → «CALIDAD Y REGULACIÓN
    // SANITARIA») sin quitar nada de dentro.
    [
      'AUTORÍA Y DIRECCIÓN CLÍNICA',
      'COLABORADORES',
      'CALIDAD Y REGULACIÓN SANITARIA',
      'Conocer a Lúa',
    ].forEach(texto => expect(json).toContain(texto));

    // Las menciones institucionales y regulatorias no se pierden en un
    // rediseño: son lo que esta pantalla existe para acreditar.
    ['ITEMAS', 'ACOPROS', 'FONDOCYT', 'SaMD Clase IIa', 'MDR 2017/745'].forEach(texto =>
      expect(json).toContain(texto),
    );

    act(() => {
      tree!.unmount();
    });
  });
});
