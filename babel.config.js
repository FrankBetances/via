module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
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
