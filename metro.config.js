const { getDefaultConfig } = require('expo/metro-config');
const { mergeConfig } = require('metro-config');

const defaultConfig = getDefaultConfig(__dirname);

/**
 * Metro configuration for VIA+.
 * https://docs.expo.dev/guides/customizing-metro/
 *
 * POR QUÉ EL DE EXPO Y NO EL DE REACT NATIVE
 * El empaquetado de release NO lo hace el CLI de React Native: desde que
 * `install-expo-modules` tocó el proyecto, `android/app/build.gradle` fija
 * `cliFile = @expo/cli` y `bundleCommand = "export:embed"`. Ese comando llama
 * al serializador de Metro y espera la SALIDA ESTRUCTURADA de Expo
 * (`serializer.customSerializer`, que devuelve `{ code, map, artifacts }`).
 *
 * `@react-native/metro-config` no define `customSerializer`, así que Metro
 * devolvía el bundle en crudo y el CLI de Expo intentaba parsearlo como JSON:
 *
 *   Error: Serializer did not return expected format. The project copy of
 *   `expo/metro-config` may be out of date.
 *   Error: Unexpected token 'v', "var __BUND"... is not valid JSON
 *   > Task :app:createBundleReleaseJsAndAssets FAILED
 *
 * Un build de 21 min 46 s tirado en el último paso, después de compilar todo
 * el nativo. El typecheck y los 656 tests no ven nada de esto: el bundle solo
 * se construye al compilar.
 *
 * Es además lo que hace Valeria+, que es la referencia (regla 1): allí no hay
 * `metro.config.js` porque es un proyecto Expo gestionado y coge el de Expo
 * por defecto. VIA+ sí necesita fichero —tiene `android/` en el repositorio y
 * dos ajustes propios que van más abajo—, pero la BASE tiene que ser la misma.
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
    // El preset ya lo activa por defecto; se fija aquí de forma EXPLÍCITA
    // para que un cambio de ese valor por defecto no revierta en silencio el
    // arranque de la app. Se compone con las opciones del preset en lugar de
    // reemplazarlas: `getDefaultConfig` puede fijar otras banderas de
    // transformación y perderlas sería una regresión callada.
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
