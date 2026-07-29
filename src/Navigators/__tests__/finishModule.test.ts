import { finishModule } from '../finishModule';

/* -------------------------------------------------------------------------- */
/*  Regresión de «realizo una prueba y me devuelven a la pantalla de           */
/*  ejercicios»: al guardar, los módulos hacían `goBack()` y el resultado      */
/*  recién registrado no se veía por ninguna parte.                            */
/* -------------------------------------------------------------------------- */

describe('finishModule', () => {
  it('lleva a los resultados de la sesión, no de vuelta al hub', () => {
    const navigation = { replace: jest.fn(), navigate: jest.fn(), goBack: jest.fn() };
    finishModule(navigation);
    expect(navigation.replace).toHaveBeenCalledWith('ResultadosPreliminares');
    expect(navigation.goBack).not.toHaveBeenCalled();
  });

  it('usa replace: el formulario ya guardado no debe quedarse en la pila', () => {
    // Si el módulo siguiera en la pila, «atrás» desde los resultados llevaría
    // a un formulario ya registrado e invitaría a guardarlo dos veces.
    const navigation = { replace: jest.fn(), navigate: jest.fn() };
    finishModule(navigation);
    expect(navigation.navigate).not.toHaveBeenCalled();
  });

  it('degrada a navigate si el navigator no ofrece replace', () => {
    const navigation = { navigate: jest.fn() };
    finishModule(navigation);
    expect(navigation.navigate).toHaveBeenCalledWith('ResultadosPreliminares');
  });
});
