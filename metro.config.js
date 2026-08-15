const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

const defaultConfig = getDefaultConfig(__dirname);

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
  transformer: {
    // `inlineRequires` convierte los import de nivel superior en require()
    // perezosos: un módulo no se evalúa hasta que alguien usa uno de sus
    // símbolos. Importa aquí más que en una app corriente porque VIA+ tiene
    // dos grafos muy pesados colgando del arranque:
    //   · Navigators/Default.tsx importa las 19 pantallas, y cada pantalla
    //     arrastra su registro de assets.
    //   · verbalAssetsByLang.ts importa los CUATRO bancos de recortes en
    //     base64 (es, es-DO, gl, eu ≈ 1,6 MB de fuente), de los que una
    //     sesión usa uno.
    // El preset de RN ya lo activa por defecto desde 0.72; se fija aquí de
    // forma EXPLÍCITA para que un cambio de ese valor por defecto no revierta
    // en silencio el arranque de la app. Se compone con las opciones del
    // preset en lugar de reemplazarlas: `getDefaultConfig` puede fijar otras
    // banderas de transformación y perderlas sería una regresión callada.
    getTransformOptions: async (...args) => {
      const base = await defaultConfig.transformer?.getTransformOptions?.(...args);
      return {
        ...base,
        transform: { ...base?.transform, inlineRequires: true },
      };
    },
  },
};

module.exports = mergeConfig(defaultConfig, config);
