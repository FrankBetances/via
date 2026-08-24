module.exports = {
  root: true,
  extends: '@react-native',
  rules: {},
  overrides: [
    {
      /* Scripts y herramientas que corren en NODE, no en el dispositivo.
       *
       * `@react-native` da por hecho que todo el código es de la app y no
       * declara los globales de Node, así que `Buffer` salía como
       * `'Buffer' is not defined` (no-undef): 16 errores —13 en el generador
       * del gráfico de Play y 3 en el test del tempo de las locuciones— que
       * llevaban meses en rojo y que la propia guía del repositorio había
       * acabado documentando como «preexistentes, no son tuyos». Un error que
       * se explica en vez de arreglarse deja de verse: la siguiente vez que
       * `npx eslint .` saque 17, nadie va a distinguir cuál es el nuevo.
       *
       * Estos ficheros no se empaquetan nunca: ninguno está bajo `src/` ni
       * entra en el bundle (ver `index.js` y el grafo de Metro). Declararles
       * el entorno correcto no relaja nada de la app. */
      files: [
        'scripts/**/*.js',
        'tools/**/*.js',
        'docs/**/*.js',
        'jest/**/*.js',
        '*.config.js',
        '.eslintrc.js',
      ],
      env: { node: true },
    },
  ],
};
