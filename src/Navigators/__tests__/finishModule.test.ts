import { finishModule } from '../finishModule';

/* -------------------------------------------------------------------------- */
/*  Decisión de Frank (18/11/2026): tras guardar cada prueba se vuelve al hub, */
/*  con las hechas marcadas. Antes (desde el 2/11/2026) se aterrizaba en       */
/*  Resultados preliminares.                                                   */
/* -------------------------------------------------------------------------- */

describe('finishModule', () => {
  it('vuelve al hub de la batería', () => {
    const navigation = { navigate: jest.fn(), replace: jest.fn(), goBack: jest.fn() };
    finishModule(navigation);
    expect(navigation.navigate).toHaveBeenCalledWith('SeleccionEjercicios');
    expect(navigation.navigate).toHaveBeenCalledTimes(1);
  });

  it('no aterriza en los resultados ni hace goBack', () => {
    const navigation = { navigate: jest.fn(), replace: jest.fn(), goBack: jest.fn() };
    finishModule(navigation);
    expect(navigation.replace).not.toHaveBeenCalled();
    expect(navigation.goBack).not.toHaveBeenCalled();
    expect(navigation.navigate).not.toHaveBeenCalledWith('ResultadosPreliminares');
  });
});
