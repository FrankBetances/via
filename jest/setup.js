/* -------------------------------------------------------------------------- */
/*  Preparación común de las suites.                                            */
/*                                                                             */
/*  AsyncStorage es un módulo NATIVO: fuera del dispositivo su puente es null y */
/*  cualquier suite que lo importe —aunque sea de rebote, como cualquier        */
/*  pantalla que ahora lee el idioma de interfaz— revienta al cargar con        */
/*  «NativeModule: AsyncStorage is null».                                      */
/*                                                                             */
/*  Se usa el mock QUE PUBLICA LA PROPIA LIBRERÍA, no uno escrito a mano: la    */
/*  regla 3 de CLAUDE.md nace justo de mocks que no respetaban el contrato del  */
/*  módulo nativo y validaban la suposición del autor. El de la librería lo     */
/*  mantiene quien mantiene la librería.                                        */
/* -------------------------------------------------------------------------- */
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
