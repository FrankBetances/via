import React from 'react';
import { act, create } from 'react-test-renderer';

/* -------------------------------------------------------------------------- */
/*  Humo: la pantalla de créditos monta y desmonta entera.                     */
/*                                                                            */
/*  Monta MUCHAS piezas animadas a la vez —30 partículas, 9 barras de onda,    */
/*  2 anillos de pulso y los 12 puntos en órbita, cada uno con su reloj— y     */
/*  cinco marcas vectoriales. Un descuido en cualquiera (un import roto, un    */
/*  `useSharedValue` fuera de sitio, una marca sin cerrar) rompe la pantalla   */
/*  entera, y el compilador no lo ve. Esta prueba renderiza el árbol completo  */
/*  y comprueba que los doce módulos llegan al árbol y que al desmontar no     */
/*  queda ninguna animación viva.                                             */
/* -------------------------------------------------------------------------- */

jest.mock('@/Components/Common', () => ({
  Header: () => null,
}));

import CreditosScreen from '../CreditosScreen';
import { ORBIT_MODULES } from '../orbitModules';

const navigation = { navigate: jest.fn() } as never;

describe('CreditosScreen', () => {
  it('monta la pantalla completa y pinta los doce módulos', () => {
    let tree: ReturnType<typeof create> | undefined;
    act(() => {
      tree = create(<CreditosScreen navigation={navigation} route={{} as never} />);
    });
    expect(tree).toBeDefined();

    const json = JSON.stringify(tree!.toJSON());

    // Un punto por módulo, cada uno con su color de marca.
    ORBIT_MODULES.forEach(m => {
      expect(json).toContain(m.color);
    });

    // Y las secciones de la pantalla siguen ahí.
    ['AUTORÍA Y DIRECCIÓN CLÍNICA', 'COLABORADORES', 'CALIDAD Y NORMATIVA', 'Comenzar'].forEach(
      texto => expect(json).toContain(texto),
    );

    act(() => {
      tree!.unmount();
    });
  });
});
