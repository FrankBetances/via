import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { SafeAreaProvider } from 'react-native-safe-area-context';

/* -------------------------------------------------------------------------- */
/*  Humo de la Evaluación Clínica Previa (CAP).                                */
/*                                                                            */
/*  Son 1.500 líneas que deciden si un niño puede hacer la batería, y hasta    */
/*  agosto de 2026 NO tenían ni una prueba: el rediseño de esa fecha se        */
/*  integró con «compila» como única verificación. Lo que se fija aquí es lo   */
/*  que un cambio de estilo puede llevarse por delante sin que nadie lo note:  */
/*                                                                            */
/*   · que los CUATRO dominios clínicos siguen en pantalla — perder uno es     */
/*     perder un criterio de aptitud, no un adorno;                            */
/*   · que el veredicto de cada dominio se nombra con el vocabulario           */
/*     CANÓNICO (`DOMAIN_LABELS`, junto a la lógica que lo produce) y no con   */
/*     una copia dentro de la hoja de estilos — el rediseño traía las          */
/*     etiquetas duplicadas y renombradas («Restricción» → «Adaptar»,          */
/*     «Bloqueo» → «Bloqueado»), que es como una app acaba diciendo dos cosas  */
/*     distintas del mismo estado;                                             */
/*   · que el certificado NO se puede emitir sin explorador identificado.      */
/* -------------------------------------------------------------------------- */

// gluestack se publica como ESM y jest no lo transforma (ver
// `transformIgnorePatterns` en package.json). Se sustituyen sus contenedores
// por primitivas de React Native: lo que se prueba es el árbol clínico, no la
// librería de componentes.
jest.mock('@gluestack-ui/themed', () => {
  const { View, TextInput } = require('react-native');
  const passthrough = (name: string) => {
    const C = ({ children, ...rest }: any) => <View {...rest}>{children}</View>;
    C.displayName = name;
    return C;
  };
  return {
    Box: passthrough('Box'),
    HStack: passthrough('HStack'),
    VStack: passthrough('VStack'),
    Input: passthrough('Input'),
    Textarea: passthrough('Textarea'),
    InputField: (props: any) => <TextInput {...props} />,
    TextareaInput: (props: any) => <TextInput {...props} />,
  };
});

// Las entidades de TypeORM arrastran `reflect-metadata` en ESM, que jest
// tampoco transforma. La pantalla solo las usa para CONSTRUIR el registro que
// guarda, así que bastan clases vacías; la persistencia se prueba en su
// repositorio, no aquí.
jest.mock('@/Models/Evaluation/Evaluation', () => ({ Evaluation: class {} }));
jest.mock('@/Models/Patient/Patient', () => ({ Patient: class {} }));
jest.mock('@/Models/Professional/Professional', () => ({ Professional: class {} }));
jest.mock('@/Models/ClinicalAssessment/ClinicalAssessment', () => ({
  ClinicalAssessment: class {},
}));
jest.mock('@/Repositories/ClinicalAssessmentRepository', () => ({
  ClinicalAssessmentRepository: { createClinicalAssessment: jest.fn(), getLatestByEvaluation: jest.fn() },
}));
jest.mock('@/Repositories/EvaluationRepository', () => ({
  EvaluationRepository: { createEvaluation: jest.fn(), getLatestPendingByPatient: jest.fn() },
}));

// `@/Components/Common` arrastra react-redux, que se publica como ESM y jest
// no transforma. Se sustituye por primitivas: la barra superior, el control de
// tamaño de letra y el contenedor no son lo que esta prueba vigila.
jest.mock('@/Components/Common', () => {
  const { View, Text: RNText } = require('react-native');
  const wrap = (name: string) => {
    const C = ({ children }: any) => <View>{children}</View>;
    C.displayName = name;
    return C;
  };
  return {
    Header: () => null,
    FontSizeControl: () => null,
    Content: wrap('Content'),
    // OJO: `ScaledTextScope` NO es un componente, es un contexto de React —
    // la pantalla lo usa como `<ScaledTextScope.Provider>`. Doblarlo como
    // función deja `.Provider` en `undefined` y el árbol no monta.
    ScaledTextScope: require('react').createContext(false),
    Text: RNText,
  };
});

jest.mock('@/Components/Themed/RadialBackground', () => {
  const { View } = require('react-native');
  return { __esModule: true, default: () => <View /> };
});

jest.mock('@/Helpers/showToast', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

// La pantalla lee la evaluación activa de Redux. Se sustituye el hook por un
// doble: lo que se prueba es el árbol clínico, no el almacén.
const evaluacion = {
  id: 7,
  patient: { id: 3, name: 'Lucía', lastName: 'Pérez Gómez' },
  professional: { name: '', licenseNumber: '' },
};
jest.mock('@/Helpers/ClassTransformer', () => ({
  useClassSelector: () => evaluacion,
}));

import ClinicalAssessmentScreen from '../ClinicalAssessmentScreen';
import { DOMAIN_LABELS } from '../clinicalAssessmentResult';

const SAFE_AREA_METRICS = {
  frame: { x: 0, y: 0, width: 1024, height: 768 },
  insets: { top: 24, left: 0, right: 0, bottom: 16 },
};

const navigation = { navigate: jest.fn(), goBack: jest.fn() } as never;

const render = (): ReactTestRenderer => {
  let tree: ReactTestRenderer | undefined;
  act(() => {
    tree = create(
      <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
        <ClinicalAssessmentScreen navigation={navigation} route={{} as never} />
      </SafeAreaProvider>,
    );
  });
  return tree!;
};

describe('ClinicalAssessmentScreen · humo', () => {
  it('monta y desmonta la pantalla entera', () => {
    const tree = render();
    expect(tree).toBeDefined();
    act(() => tree.unmount());
  });

  it('los CUATRO dominios clínicos están en pantalla', () => {
    const tree = render();
    const json = JSON.stringify(tree.toJSON());
    ['Otoscopia', 'Visual', 'Verbal', 'Motora'].forEach(dominio =>
      expect(json).toContain(dominio),
    );
    act(() => tree.unmount());
  });

  it('el veredicto arranca en «Pendiente», con la palabra CANÓNICA', () => {
    const tree = render();
    const json = JSON.stringify(tree.toJSON());
    // Sin explorar nada, los cuatro dominios están pendientes.
    expect(json).toContain(DOMAIN_LABELS.pending);
    // Y el vocabulario es el de `clinicalAssessmentResult`, no una copia con
    // otras palabras dentro de la pantalla.
    expect(DOMAIN_LABELS.warn).toBe('Restricción');
    expect(DOMAIN_LABELS.block).toBe('Bloqueo');
    expect(json).not.toContain('Adaptar');
    expect(json).not.toContain('Bloqueado');
    act(() => tree.unmount());
  });

  it('el certificado no se puede emitir sin explorador identificado', () => {
    // `confirmReady` exige nombre y número de colegiado; el doble de Redux los
    // trae vacíos a propósito. El botón tiene que estar deshabilitado.
    const tree = render();
    const botones = tree.root
      .findAll(n => typeof n.props?.accessibilityLabel === 'string', { deep: true })
      .filter(n =>
        (n.props.accessibilityLabel as string).includes('Confirmar y generar Certificado'),
      );
    expect(botones.length).toBeGreaterThan(0);
    expect(botones.some(b => b.props.disabled === true)).toBe(true);
    act(() => tree.unmount());
  });
});
