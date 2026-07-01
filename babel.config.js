module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    // Los modelos de TypeORM (src/Models/**) usan decoradores legacy
    // (@Entity, @Column...); el preset de RN no los habilita por sí solo.
    ['@babel/plugin-proposal-decorators', { legacy: true }],
    // gluestack-ui arrastra react-stately/react-aria (vía @react-spectrum/menu),
    // que usan static class blocks (ES2022); el preset de RN no los habilita.
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
    // react-native-reanimated/plugin must always be listed LAST.
    'react-native-reanimated/plugin',
  ],
};
