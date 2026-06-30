const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

/**
 * Metro configuration for VIA+.
 * https://reactnative.dev/docs/metro
 *
 * @type {import('metro-config').MetroConfig}
 */
const config = {
  resolver: {
    // @gluestack-ui/themed re-exporta Menu/Select desde un único barril, que
    // arrastra react-aria -> react-dom aunque la app nunca use esos
    // componentes (no hay Menu/Select en src/). react-aria es 100% web y no
    // tiene variante para React Native, así que ese código es inalcanzable
    // en runtime; solo necesita resolver para que Metro pueda bundlear.
    extraNodeModules: {
      'react-dom': require.resolve('./scripts/empty-module.js'),
    },
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
