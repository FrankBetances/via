module.exports = {
  root: true,
  /* Recortes de la audiometría verbal INCRUSTADOS en base64: ~2 MB de datos
   * GENERADOS por `node scripts/verbal-assets.js registry`. Analizarlos no
   * dice nada de nadie —no hay código que revisar— y obligaba a llevar en
   * cabecera un silenciador en blanco (un «disable» sin reglas), que es
   * justo la clase de mordaza que esconde el aviso siguiente. */
  ignorePatterns: ['src/Screens/VerbalAudiometry/verbalAudioClips*.ts'],
  extends: '@react-native',
  rules: {
    /* `void promesa()` es el idioma DELIBERADO de este repositorio para el
     * disparo sin espera: dice, en el propio sitio, «esta promesa no se
     * aguarda a propósito», que es justo lo que un `catch {}` mudo no dice
     * (regla 4). La opción `allowAsStatement` es la que la propia regla trae
     * para este caso: sigue prohibiendo `void` como EXPRESIÓN —donde de
     * verdad confunde— y lo permite como sentencia suelta. */
    'no-void': ['warn', { allowAsStatement: true }],
  },
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
    {
      /* La preparación común de las suites corre DENTRO de jest, así que usa
       * `jest.mock` en el ámbito del módulo. Sin declarar el entorno salía
       * `'jest' is not defined` — el error número 1 desde que la cuenta está
       * a cero, y por eso se arregla aquí y no se documenta como conocido. */
      files: ['jest/setup.js'],
      env: { node: true, jest: true },
    },
  ],
};
