module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    // Los modelos de TypeORM (src/Models/**) usan decoradores legacy
    // (@Entity, @Column...); el preset de RN no los habilita por sí solo.
    ['@babel/plugin-proposal-decorators', { legacy: true }],
    [
      'module-resolver',
      {
        root: ['./'],
        extensions: ['.ios.js', '.android.js', '.js', '.jsx', '.json', '.ts', '.tsx'],
        alias: {
          '@': './src',
        },
      },
    ],
    // react-native-reanimated/plugin must always be listed LAST.
    'react-native-reanimated/plugin',
  ],
};
