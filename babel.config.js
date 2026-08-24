/* -------------------------------------------------------------------------- */
/*  Babel — VIA+.                                                              */
/*                                                                            */
/*  POR QUÉ EL PRESET DE EXPO Y NO EL DE REACT NATIVE                          */
/*  `install-expo-modules` gestiona TRES ficheros del proyecto:                */
/*  `android/app/build.gradle`, `metro.config.js` y ESTE. De los tres solo se  */
/*  arreglaron los dos primeros —el de Metro el 23/8/2026, después de perder   */
/*  un build de 21 min 46 s—, y este se quedó en                               */
/*  `module:@react-native/babel-preset` mientras Gradle empaqueta con el CLI   */
/*  de Expo y Metro parte de `expo/metro-config`. Una configuración a medias   */
/*  no falla de forma limpia: falla cuando toca una pieza que sí dependía de   */
/*  la parte que no se migró.                                                  */
/*                                                                            */
/*  `babel-preset-expo` ENVUELVE al de React Native (lo aplica por dentro) y   */
/*  añade lo que el resto de la cadena de Expo da por hecho, así que no se     */
/*  pierde nada al cambiar. Es además lo que usa Valeria+, que es la           */
/*  referencia obligatoria (regla 1): allí no hay `babel.config.js` propio     */
/*  porque, siendo proyecto Expo gestionado, coge este preset por defecto.     */
/*                                                                            */
/*  QUÉ DEJA DE HACER FALTA AQUÍ, Y POR QUÉ NO ES UNA PÉRDIDA                  */
/*  El preset ya trae, comprobado en                                          */
/*  `node_modules/babel-preset-expo/build/index.js`:                          */
/*                                                                            */
/*    · `@babel/plugin-proposal-decorators` con `{ legacy: true }` por         */
/*      defecto (línea 280) — es lo que necesitan los modelos de TypeORM.     */
/*    · `react-native-reanimated/plugin` automáticamente cuando el paquete     */
/*      está instalado (línea 290). NO se vuelve a listar aquí: duplicarlo es  */
/*      un fallo conocido de configuración, y el preset ya lo pone al final.  */
/*                                                                            */
/*  LO QUE SÍ SE QUEDA                                                         */
/*  `@babel/plugin-transform-class-static-block` se mantiene EXPLÍCITO: el     */
/*  preset solo lo añade cuando el motor NO es moderno (línea 105, rama        */
/*  `!isModernEngine`), y con Hermes activado esa rama no entra. gluestack-ui  */
/*  arrastra react-stately/react-aria (vía @react-spectrum/menu), que usan     */
/*  bloques estáticos de clase (ES2022), así que quitarlo de aquí sería        */
/*  fiarlo todo a que Hermes los soporte de serie. No es una suposición que    */
/*  se pueda comprobar sin compilar, y el coste de equivocarse es un APK que   */
/*  no arranca.                                                                */
/* -------------------------------------------------------------------------- */

module.exports = {
  presets: ['babel-preset-expo'],
  plugins: [
    // Ver cabecera: el preset solo lo añade en motores no modernos.
    '@babel/plugin-transform-class-static-block',
    [
      'module-resolver',
      {
        root: ['./'],
        extensions: ['.ios.js', '.android.js', '.js', '.jsx', '.json', '.ts', '.tsx'],
        alias: {
          '@': './src',
          // TypeORM (driver "react-native") referencia internamente el módulo
          // `react-native-sqlite-storage`. La app usa `react-native-nitro-sqlite`
          // (que expone un driver compatible vía `typeORMDriver`), así que se
          // redirige el nombre del módulo para que cualquier require interno de
          // TypeORM resuelva a nitro-sqlite. Ver Database/config.ts.
          'react-native-sqlite-storage': 'react-native-nitro-sqlite',
        },
      },
    ],
  ],
};
