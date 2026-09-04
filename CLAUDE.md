# VIA+ · Notas para Claude Code

## Reglas de trabajo (obligatorias, no negociables)

Nacen de errores reales cometidos en este repositorio, cada uno con su coste.
No son buenas prácticas genéricas: son la lista de lo que ya salió mal aquí.

Valeria+ tiene su propio `CLAUDE.md` con las suyas. **Léelo también**: las
reglas 0, 2 y 4 de aquí son suyas en espíritu, y se incumplieron en VIA+
porque este repositorio no tenía dónde guardarlas. Una orden que solo vive en la memoria de
Frank y no en el repositorio se incumple por defecto en la sesión siguiente.

---

### 0. LA HONESTIDAD MANDA SOBRE TODAS LAS DEMÁS

No es una regla más de la lista: es la condición para que la lista sirva de
algo. **Sin ella no se puede continuar.** Un trabajo técnicamente correcto
entregado con una afirmación falsa al lado vale menos que no haberlo hecho,
porque Frank toma decisiones —compilar, distribuir a testers, presentar a una
evaluación externa— sobre lo que tú le dices, no sobre lo que hay en el disco.

Los tres verbos no son intercambiables. Usa el que te has ganado:

| Puedes decir | Cuándo |
| --- | --- |
| «He escrito / he cambiado X» | Siempre. Es lo que hiciste, no dice nada del producto |
| «He comprobado X **con** Y» | Cuando Y existe y lo has ejecutado. **Nombra Y** |
| «Está hecho» | Solo con la evidencia al lado, y solo del alcance que cubre esa evidencia |

**Coste real (agosto 2026).** Con 615 tests en verde y `tsc` limpio se le dijo a
Frank «el código no explica tu fallo; el problema está en tu dispositivo». Era
falso. Los tests medían la lógica de JS; los tres fallos estaban en capas
nativas que ningún test tocaba: un parche Java propio, el C++ del grabador y el
Java de la librería de TTS. **Ejecutar la suite no es haber mirado.**

**Prohibiciones concretas, todas cometidas ya:**

- Si no lo has comprobado, dilo con esas palabras: **«esto no lo he
  verificado»**. En el mismo mensaje en que entregas, no enterrado al final.
- **Nunca conviertas la ausencia de prueba en una acusación al equipo de
  Frank.** «No encuentro la causa» y «tu dispositivo está mal» son cosas
  distintas, y la segunda le hace perder días persiguiendo una avería que no
  existe.
- **No presentes tu actividad como el estado del producto.** «`tsc` limpio» y
  «54 suites en verde» son hechos sobre ti.
- Cuando te corrijan, **comprueba antes de defenderte**. En esta misma sesión
  Frank dijo «no estás siendo honesto» y tenía razón las dos veces: la
  comparación con Valeria+ que dio la causa raíz tardó cinco minutos y podía
  haberse hecho tres turnos antes.
- **Si te preguntan cuántas veces has fallado, cuenta y responde.** No lo
  suavices ni lo infles.
- **Una comprobación de build-time sobre señales SINTÉTICAS no es validez
  clínica.** `tools/acoustics/` compara el DSP con Praat sobre senoides
  generadas, y su propio README lo dice: «que VIA+ coincida con Praat sobre
  ellas dice que el cálculo es correcto, **no que la medida sea clínicamente
  válida sobre voz real de niño**». El 22/8/2026 se ejecutó ese banco y se le
  dijo a Frank «el análisis acústico no está roto» y «está sano y validado».
  Era falso en la dirección que importaba: en ese momento el micrófono devolvía
  un buffer vacío en las tomas cortas. Coincidir con Praat sobre una senoide no
  dice nada de lo que pasa con la voz de un niño a través de un micrófono sin
  calibrar.

---

### 1. Se hace lo DEMOSTRADO que funciona. Nunca inventes si ya hay camino

Solo por debajo de la honestidad. **Lo óptimo, rápido o cómodo PARA TI no es
el criterio nunca**, porque no es lo mismo que lo óptimo para Frank. Si existe
un camino ya demostrado en otro entorno, se usa ese: **no se inventa uno
nuevo**, no se busca un equivalente y no se sustituye una pieza por otra
«parecida». Inventar donde ya hay algo probado no es criterio de ingeniería,
es preferencia propia disfrazada.

**Valeria+ (`github.com/FrankBetances/Valeria`) es la referencia.** Si Frank
dice «copia la arquitectura de Valeria», se copia: mismas librerías, mismas
versiones, mismo patrón de uso. No se buscan equivalentes. No se sustituye un
motor por otro «parecido».

**Coste real (agosto 2026).** La capa de voz de VIA+ se construyó copiando de
Valeria+ la capa de datos con fidelidad literal —contrato de id, corpus,
exportador, mapa de assets— y **sustituyendo los dos motores de runtime**:
`expo-audio` → `react-native-audio-api` y `expo-speech` → `react-native-tts`.
La tabla de `docs/design/arquitectura-corpus-voz.md` §2 registró la
sustitución **sin dar ningún motivo**, con el mismo formato que las filas que sí
eran portes fieles. Presentada así parecía equivalente y nadie la cuestionó.

No lo era. `react-native-tts` devuelve la lista de voces truncada o vacía en
silencio (`country != ""` compara referencias en Java, y
`iso3CountryCodeToIso2CountryCode("")` hace `map.get("")` sin comprobar null,
con el `catch` fuera del bucle). Sobre esa lista colgaba una selección de voz
que además funcionaba como PUERTA: sin voz verificada, la app **dejaba de
dictar en todos los módulos**. Resultado en campo: Valeria+ locutaba con voz
neural en el mismo emulador donde VIA+ estaba mudo, durante varios ciclos de
desarrollo, con Frank informando del fallo cada vez.

#### Un repositorio de referencia es de USO OBLIGATORIO, no orientativo

Cuando Frank da un repositorio de GitHub que **ya funciona** —«usa este para el
análisis de prosodia», «copia la arquitectura de Valeria»— eso no es una
sugerencia ni un punto de partida del que separarse. **Es lo que se usa.** No se
evalúan alternativas, no se busca «algo equivalente y más ligero», no se
reimplementa la idea por tu cuenta. Si crees que hay un problema con esa
elección, **lo dices y esperas**; no lo resuelves tú cambiándola.

Un repositorio que Frank ha visto funcionar tiene una propiedad que ninguna
alternativa tuya tiene por bien razonada que esté: **está demostrado en su
entorno, con sus datos y en su emulador**. Eso vale más que cualquier
comparativa técnica que puedas hacer desde aquí, donde ni siquiera puedes
compilar.

**Registro de referencias obligatorias.** Antes de tocar cualquiera de estas
áreas, abre el repositorio y míralo:

| Área | Referencia obligatoria | Verificado en |
| --- | --- | --- |
| Arquitectura de voz, audio y ASR | `github.com/FrankBetances/Valeria` | Esta tabla y `docs/design/arquitectura-corpus-voz.md` §2 |
| Validación del análisis acústico y prosódico | **Praat** vía `praat-parselmouth` | `tools/acoustics/requirements.txt`, `tools/acoustics/README.md` |
| Síntesis de voz gallega (Celtia) y corpus | `github.com/proxectonos` | `docs/design/integracion-proxecto-nos.md` |
| Frontend fonético del euskera | `github.com/hitz-zentroa/aHoTTS` | `docs/design/arquitectura-corpus-voz.md` §7 |

> ⚠️ **Hueco conocido.** Frank dio un repositorio de GitHub como referencia para
> el **análisis de prosodia** y su URL **no está registrada aquí**: en el
> repositorio solo aparecen Praat/parselmouth y menciones a DisVoice, ninguna
> con URL, y no se puede confirmar cuál es sin preguntárselo. **Antes de tocar
> `src/Screens/ProsodyAnalysis/`, pregúntale cuál es y anótalo en esta tabla.**
> No lo deduzcas ni elijas uno «parecido»: eso es exactamente lo que esta regla
> prohíbe.

**Corolarios, todos incumplidos ya:**

- **Nunca saltes una comprobación de compatibilidad.** `install-expo-modules`
  rechazó React Native 0.80.1 («Unable to find compatible Expo SDK version») y
  se forzó con `--sdk-version 54.0.0` en lugar de subir React Native. Saltar la
  comprobación dejó el proyecto en una combinación que ni Expo ni Valeria+
  respaldan. Si una herramienta dice que no, la respuesta es arreglar la
  incompatibilidad, no rodearla.
  **CORREGIDO el 22/8/2026**: VIA+ está en React Native **0.81.5**, la de
  Valeria+, y el instalador ahora elige el SDK solo («Defaulting to SDK 54.0.0
  for react-native version 0.81.5») sin que nadie lo fuerce. Así se sabe que la
  combinación es la respaldada: la herramienta la acepta.
- **Una herramienta que toca VARIOS ficheros se sigue hasta el último.**
  `install-expo-modules` gestiona TRES: `android/app/build.gradle`,
  `metro.config.js` y `babel.config.js`. Se arreglaron de uno en uno y a días de
  distancia, y cada hueco costó lo suyo: Gradle empaquetando con el CLI de Expo
  mientras Metro seguía con el preset de React Native tiró un build de 21 min
  46 s (23/8/2026), y cuando eso se arregló `babel.config.js` se quedó otro día
  en `@react-native/babel-preset`. Ya está en `babel-preset-expo` (24/8/2026);
  el bundle de release baja de 11,4 MB a 10,3 MB, que es la medida de lo que la
  configuración a medias NO estaba haciendo. Vigilado por
  `scripts/__tests__/metroBundleConfig.test.js`, que ahora comprueba los tres.
- **Una divergencia respecto al blueprint se anota CON SU MOTIVO** en la tabla
  de `docs/design/arquitectura-corpus-voz.md`, o no se hace. Una decisión sin
  justificación escrita no se revisa: se hereda.
- **«Es más rápido así» no es un motivo.** «Aquí no puedo compilarlo» tampoco:
  la imposibilidad de verificar es una razón para AVISAR, nunca para elegir el
  camino peor.
- **Cuando una herramienta cambia el build, mira TODO lo que deja tocado.**
  `install-expo-modules` no solo añadió el plugin: dejó
  `cliFile = @expo/cli` y `bundleCommand = "export:embed"` en
  `android/app/build.gradle`, y **no** cambió `metro.config.js`, que se quedó
  en `@react-native/metro-config`. `export:embed` espera la salida
  estructurada del serializador de Expo; el de React Native no define
  `customSerializer` y devuelve el bundle en crudo, así que el CLI intentaba
  parsear `var __BUNDLE_START_TIME__…` como JSON y el build moría en
  `:app:createBundleReleaseJsAndAssets` **a los 21 min 46 s, con todo el
  nativo ya compilado**. Ni `tsc` ni los 661 tests ven esto: el bundle solo se
  construye al compilar. Vigilado ahora por
  `scripts/__tests__/metroBundleConfig.test.js`, y **comprobable en local sin
  SDK de Android** con el mismo comando que ejecuta Gradle:
  `npx expo export:embed --platform android --dev false --entry-file index.js
  --bundle-output /tmp/b.js --assets-dest /tmp/a`. Son dos minutos; el CI son
  veintidós. **Y si comparas dos bundles, borra antes `/tmp/metro-*`**: Metro
  cachea la transformación y el 24/8/2026 el bundle salió byte a byte idéntico
  después de cambiar el preset de Babel entero. Con la caché limpia bajaba
  1,1 MB. Una comparación sobre caché sucia dice justo lo contrario de la
  verdad.
- **Una orden externa dentro del build que no drena `stderr` CUELGA el build.**
  `install-expo-modules` dejó las dos llamadas a `node` de
  `android/app/build.gradle` con el patrón de Groovy `[...].execute(...).text`.
  `.text` lee SOLO la salida estándar: nadie consume el error estándar, así que
  en cuanto el hijo escribe más de lo que cabe en el buffer de la tubería
  (64 KB en Linux —un aviso de obsolescencia, un shim de nvm o corepack, una
  traza—) el hijo se bloquea escribiendo y Gradle se bloquea leyendo. El build
  se queda parado **en la fase de configuración**, sin mensaje, sin tarea a la
  que señalar y sin nada en el registro. Tampoco se miraba el código de salida:
  con `node` fuera del PATH —lo normal cuando Android Studio se abre desde el
  escritorio— la salida volvía vacía y el build seguía con `entryFile` apuntando
  a la nada. **No es teoría:** ejecutado con el compilador de Groovy sobre el
  ayudante real, con 300 KB por `stderr` el patrón nuevo vuelve en 55 ms y el
  viejo seguía bloqueado a los 8 s. Vigilado por
  `scripts/__tests__/metroBundleConfig.test.js`. Cuando metas una orden externa
  en un build, drena las dos salidas, ponle plazo y comprueba el código.
- **Un plugin de Gradle que añades trae REQUISITOS. Míralos.**
  `install-expo-modules` añadió `apply plugin: "expo-root-project"` al
  `android/build.gradle`, ese plugin aplica KSP, y KSP exige una versión de
  Kotlin de su lista. El proyecto estaba en 1.9.25 y **todos los builds del 22 y
  23 de agosto de 2026 murieron** con «Can't find KSP version for Kotlin version
  '1.9.25'», al EVALUAR el proyecto raíz, antes de compilar una sola línea.
  Cinco commits seguidos en rojo por el mismo motivo. Cuando metas un plugin
  nuevo en el build nativo, lee qué versiones exige y compáralas con las del
  bloque `ext` — no lo descubras en el CI de Frank.

---

### 2. «Hecho» exige los gates, no solo el typecheck

Antes de empujar, y en este orden:

```bash
npx tsc --noEmit
npx jest
npx eslint . --ext .js,.jsx,.ts,.tsx
node scripts/check-verbal-coverage.js --strict
node scripts/check-lua-sprite.js
node scripts/build-launcher-icons.js --check
node scripts/resize-verbal-images.js --check
node scripts/build-lua-protocol.js --check
node scripts/check-ui-strings.js
```

`check-ui-strings.js` (portado de Valeria+, agosto 2026) prohíbe texto literal
en los `.tsx`: la interfaz se lee entera del catálogo de `src/I18n/`. Sin él,
migrar 40 ficheros «a ojo» deja la app mitad en un idioma y mitad en otro sin
que nada avise — es lo que pasó en Valeria+ dos veces. Para exceptuar una línea
(un nombre propio, una marca), un comentario en ella o en la anterior:
`// i18n-exempt: motivo`. El motivo es obligatorio.

`scripts/check-android-permissions.js` **NO va en esa lista**: necesita el
manifiesto FUSIONADO de release y en local siempre falla con «no encuentro el
manifiesto fusionado». Corre en CI, después de `./gradlew bundleRelease`. Si lo
pones entre los gates locales, estarás escribiendo una instrucción que nadie
puede cumplir — comprobado el 22/8/2026 antes de escribir esta línea.

`npx eslint .` sale con **0 errores** desde el 24/8/2026. Antes arrastraba 16
(`'Buffer' is not defined` en `docs/play-store/build-feature-graphic.js` y
`scripts/__tests__/voiceClipTempo.test.js`) y esta misma guía los declaraba
«preexistentes, no son tuyos» — que es exactamente cómo un error deja de verse:
con 16 en rojo permanente, nadie distingue el número 17. Arreglado donde tocaba,
en `.eslintrc.js`: esos ficheros corren en Node y no se empaquetan nunca, así que
llevan `env: { node: true }` por `overrides`. **Cualquier error es tuyo ahora.**

Y desde el **31/8/2026 sale también con 0 AVISOS**, desde los 725 que
arrastraba. La frase que ocupaba este hueco —«quedan ~650 avisos: son avisos, no
errores, y tocarlos es reescribir el DSP»— era la misma figura que los 16
errores «preexistentes» de arriba, un piso de ruido con el que nadie ve el aviso
727. Cómo se cerraron, porque marca lo que se espera de aquí en adelante:

- **Lo que era un fallo de verdad, arreglado en el código.** Dos componentes
  definidos DENTRO del render (`StepButton`, y `ParamCard`/`TakeRow` del
  análisis de voz), que hacían a React desmontar el subárbol entero en cada
  render; 26 variables que tapaban otra del ámbito exterior; un `require` sin
  usar.
- **Lo que era el linter equivocándose de dominio, en su sitio y CON MOTIVO.**
  `no-bitwise` no se discute en el cable de Lúa, el SFLOAT del pulsioxímetro, el
  CRC-32 del PNG ni las dos divisiones enteras del DSP: cada silenciador lleva
  escrito por qué, como ya hacía `scripts/resize-verbal-images.js`. `no-void`
  usa `allowAsStatement`, la opción que la propia regla trae para el disparo sin
  espera. **Un silenciador en blanco no vale**: se quitaron los que había, y
  `eslint-comments/no-unused-disable` avisa solo cuando uno se queda obsoleto.
- **Los 577 estilos en línea, a `@/Theme/styleAtoms` y a hojas locales.** Los
  átomos son los retoques sueltos y llevan nombre derivado del contenido
  (`flex1`, `marginTop2`); un estilo con significado propio va al `StyleSheet`
  de su pantalla con nombre pensado, como el decorado de `TrainScene`. Antes de
  añadir uno nuevo, busca el que ya existe.

**El listón es cero, y un aviso nuevo es tuyo igual que un error.** Lo que NO se
comprobó: nada de esto se ha visto en el emulador; que el aspecto no cambie está
razonado sobre el código —mismos valores, mismo orden— y verificado con `tsc` y
los 870 tests, no en pantalla.

Todo cambio de **texto locutado** lleva `node scripts/export-voice-corpus.js` y
`node scripts/build-voice-asset-map.js` en el MISMO commit; sin ellos las
lenguas sin recorte caen a la voz del sistema en silencio.

---

### 3. Un mock que no respeta el contrato nativo no prueba nada

**Coste real (agosto 2026).** Cuatro suites vigilaban el micrófono y todas
pasaban mientras el micrófono devolvía un buffer vacío. Sus mocks emitían
bloques a voluntad y **ninguno reproducía el vaciado de `stop()`**
(`sendRemainingData`), que es justo la parte del contrato que el código se
estaba comiendo. Validaban la suposición del autor, no el comportamiento real.

Antes de escribir un mock de un módulo nativo, **lee su fuente** en
`node_modules/<lib>/android/src/main/**` o `common/cpp/**` y reproduce su
contrato: cuándo emite, qué emite al parar, y en qué hilo llega.

---

### 4. Nada puede fallar en silencio

La capa de audio degrada en silencio por diseño —una prueba no debe reventar
delante de un niño— y esa misma decisión hizo indistinguibles media docena de
causas con arreglos completamente distintos.

- Un `catch {}` vacío en una ruta clínica necesita, al lado, **un estado
  observable** que la pantalla pueda mostrar.
- Un `return` que aborta una operación pedida por el usuario **debe informar**.
  El parche del T.A.R. hacía `return` a secas cuando no podía garantizar
  reconocimiento local: el JS esperaba un resultado que no llegaba nunca.
- `console.warn` **no es informar**: en un APK de release no lo ve nadie.
- La pantalla **Comprobar audio** (`src/Screens/DiagnosticoAudio/`) recorre la
  cadena entera y nombra el eslabón roto. Si añades un eslabón nuevo al audio,
  añade su comprobación ahí.
- **Un diagnóstico que no recorre una vía no puede dar por buena esa vía.**
  Coste real (25/8/2026): Frank mandó la captura de «Comprobar audio» con
  SIETE eslabones en verde junto al mensaje «la audiometría verbal y el test de
  articulación siguen sin sonido; es información falsa». La pantalla no mentía
  sobre lo medido: medía el banco de locuciones (`expo-audio`) y **cuántas voces
  enumera el sistema**. La audiometría verbal no suena por ahí —decodifica un
  recorte base64 sobre el `AudioContext` y lo reproduce por `BufferSource`— y el
  modelo hablado del T.A.R. tampoco: dicta con `expo-speech`. **Las dos vías
  mudas eran justo las dos que no se tocaban.** Tres reglas que quedan:
  · **«473 voces» no es «suena».** Enumerar el catálogo y emitir son preguntas
    distintas. Ahora `checkSystemVoiceSpeaks` DICTA una frase y espera
    `onStart`/`onDone`/`onError` con plazo — porque el motor también puede
    aceptar la locución y no emitir nada ni avisar.
  · **`state === 'running'` del AudioContext no prueba que se OIGA — pero sí
    dice más de lo que esta guía afirmaba (corregido el 2/9/2026).** Lo que
    decía aquí era: «el constructor hace `audioPlayer_->start(); state_ =
    RUNNING;` **ignorando el booleano**, así que un contexto sin stream se
    declara "running"». La primera mitad es cierta y sigue siéndolo. La
    conclusión NO, porque lo que llega a JS no es `state_`: en la versión
    instalada (`react-native-audio-api` **0.8.4**, leído en `node_modules`)
    `ctx.state` cruza el puente por `BaseAudioContext::getState()`
    (`BaseAudioContext.cpp:31`), que devuelve **«suspended»** siempre que
    `isDriverRunning()` sea falso, e `isDriverRunning()` acaba en
    `AudioPlayer::isRunning()` (`AudioPlayer.cpp:79`) =
    `mStream_ && mStream_->getState() == Started`. Es decir: **«running»
    implica que el stream de Oboe está abierto y arrancado**; lo que no implica
    es que salga sonido audible (volumen, ruta, ganancia). Coste de haberlo
    dado por perdido: la rama `sonido` (2/9/2026) construyó su arreglo sobre la
    frase vieja y quitó la guarda de `resumeAudioContext()` «porque el motor
    miente» — un no-op, ya que `AudioContext::resume()` (`AudioContext.cpp:59`)
    abre con `if (isRunning()) return true;`. **Cuando una regla de aquí cite
    código de una librería, comprueba la versión instalada antes de razonar
    sobre ella.**
  · **Lo que sí es una prueba máquina de que el motor emite: `currentTime`.**
    `AudioDestinationNode::getCurrentTime()` = `currentSampleFrame_ /
    sampleRate`, y `currentSampleFrame_` solo crece dentro de
    `AudioDestinationNode::renderAudio` (`AudioDestinationNode.cpp:44`), a la
    que únicamente se llega desde `AudioPlayer::onAudioReady`, el callback con
    el que Oboe PIDE muestras — y que sale sin renderizar si `isInitialized_`
    es `false`. Si el reloj avanza, el hardware está tirando de frames. Es el
    eslabón **«Reloj del hardware de salida»** de Comprobar audio.
  · **La sesión de audio (`AudioManager`) es una capa iOS: en Android no hace
    nada.** `AudioAPIModule.kt:66` implementa `setAudioSessionOptions` como
    `// noting to do here` y `setAudioSessionActivity` solo resuelve la
    promesa. Un arreglo de sonido para el emulador de Frank que consista en
    reconfigurar la sesión está tocando una capa que ahí no existe.
  · **Un motor de salida que no arranca deja la app muda PARA SIEMPRE, y hasta
    el 2/9/2026 no había forma de salir de ahí.** `AudioPlayer` abre el stream
    en su constructor; si Oboe falla, `mStream_` queda nulo. `AudioContext`
    ignora el `false` de `start()` y deja `playerHasBeenStarted_ = true`, que es
    justo el booleano del que cuelga la única rama de `resume()` que reabriría
    el stream. El contexto se abre al ARRANCAR la app (`src/App.tsx`) y no se
    suelta jamás: una apertura fallida = sesión entera muda, sin reintento y sin
    mensaje. Ahora `recoverAudioContext()` construye uno nuevo y avisa por
    `onAudioContextChange()` a los adaptadores (que cachean su referencia);
    «Comprobar audio» lo intenta solo. **Cuando algo salga mudo, esta es la
    primera hipótesis, y no exige que haya cambiado ninguna línea de audio.**
  · **Si hay tres motores de salida, hay tres pruebas de escucha.** Había una
    (el tono) y cerraba el veredicto de los tres. Ahora son cuatro emisiones
    —tono, recorte verbal, locución empaquetada, voz del sistema— y mientras
    falte alguna, ni el titular ni el resumen copiable dicen «todo funciona»:
    dicen «SALIDA NO COMPROBADA» y cuántas faltan.
- **Un arranque que falla tiene que DECIRLO en la pantalla.** El APK del
  24/8/2026 «no abría y se quedaba colgado», y no había forma de saber en qué
  eslabón: la app **no tenía ninguna barrera de error** (`grep` sobre `src/`: ni
  una `componentDidCatch`), así que cualquier excepción de render dejaba la
  pantalla EN BLANCO sin texto; y las dos esperas del arranque —la
  rehidratación de `redux-persist` y `initDatabase()`— pintaban el MISMO splash
  mudo, con el error de la base de datos yendo solo a `console.error`. Un
  síntoma idéntico para media docena de causas con arreglos distintos. Ahora
  `@/Startup` pinta el fallo en el dispositivo (mensaje, código, error del
  driver que TypeORM envuelve, pila) y, si no hay error pero la espera se
  alarga, NOMBRA el eslabón en el que se quedó. Vigilado por
  `src/Startup/__tests__/startupDiagnostics.test.tsx`.
- **Un estado que no se ha comprobado NO se presume favorable.** El hub deducía
  el estado acústico de la sala de la AUSENCIA de una bandera de navegación:
  no abrir el sonómetro, o medir «DEMASIADO RUIDO» y volver atrás, dejaban esa
  bandera sin poner y el hub pintaba **«Sala verificada · sonómetro OK» con
  tic verde**. Un certificado que nadie emitió, sobre una sala que invalidaba
  las pruebas auditivas. La regla: si un dato clínico no existe, la UI dice que
  no existe — nunca cae en la rama del aprobado. Vigilado por
  `src/Store/slices/__tests__/roomNoise.test.ts`.

---

### 5. Informa de lo que Frank VA A VER, no de lo que has hecho

Primera línea: qué cambia en pantalla o en el comportamiento de la app. Si un
merge no cambia nada visible —es refactor, es documentación— **dilo en la
primera línea**, no en el párrafo doce. «`tsc` limpio» y «53 suites en verde»
son hechos sobre ti, no sobre lo que la app hace.

---

### 6. Un push por cambio, y solo a la rama destino

`android-release.yml` lanza un build completo por push. No empujes el mismo
commit a dos ramas sin necesidad.

---

### 7. El banco de pruebas es el emulador de Android Studio, y Valeria+ funciona ahí

Frank prueba en el **emulador de Android Studio**. En ESE MISMO emulador,
Valeria+ locuta con voz neural y reconoce sin fallos. De ahí se siguen tres
cosas, y las tres se incumplieron ya:

- **«Es tu dispositivo» nunca es una conclusión válida.** Si Valeria+ funciona
  y VIA+ no, la diferencia está en VIA+. Coste real: se le dijo a Frank «el
  código no explica tu fallo, el problema está en tu dispositivo». Era falso —
  los tres fallos eran un parche propio, el C++ del grabador y el Java del TTS.
- **Antes de teorizar sobre el entorno, compara con Valeria+.** Clona
  `github.com/FrankBetances/Valeria` y mira qué hace distinto. Es la
  referencia, no una curiosidad. La comparación tardó cinco minutos y dio la
  causa raíz que tres turnos de hipótesis no habían encontrado.
- **Frank prueba en Android, no en iPad.** El port SwiftUI de `ios-native/` es
  un demostrador visual sin módulos clínicos; la app real es `src/` + `android/`
  y **no tiene proyecto `ios/`**. Diagnosticar sobre el port equivocado costó un
  turno entero. Si no sabes en qué está probando, PREGÚNTALO antes de analizar.

Hay capacidades que el emulador **no trae** y que no son averías: el
reconocimiento de voz en el dispositivo exige API 33 y el modelo de la lengua
descargado. Distinguir «no lo trae» de «está roto» es obligatorio, y la pantalla
**Comprobar audio** lo hace por ti.

---

### 8. La imposibilidad de verificar se AVISA, no se convierte en atajo

Las sesiones de Claude sobre este repositorio **no tienen SDK de Android**: no se
puede compilar ni ejecutar la app. Eso obliga a dos cosas:

- Decir **«esto no lo he compilado»** en el mismo mensaje en que se entrega, no
  enterrado al final. Un cambio nativo sin compilar no está «hecho», está
  «escrito».
- **No usarlo como excusa para elegir el camino peor.** «No puedo compilar la
  actualización de React Native» no autoriza a saltarse la comprobación de
  compatibilidad y dejar el proyecto en una combinación que nadie respalda. Eso
  es la regla 1, y se incumplió el 22/8/2026.

---

## Arquitectura de audio: qué motor para qué

Migrado a la arquitectura de Valeria+ en agosto de 2026. **No lo cambies sin
leer la regla 1.**

| Función | Motor | Por qué |
| --- | --- | --- |
| Síntesis de voz (consignas, modelo del T.A.R., funciones ejecutivas) | `expo-speech` | El de Valeria+. La voz es una PREFERENCIA por locución, nunca una puerta |
| Reconocimiento de voz (T.A.R.) | `expo-speech-recognition` | El de Valeria+. Trae `requiresOnDeviceRecognition` de serie (Zero-PHI sin parches) |
| Reproducción de locuciones empaquetadas | `expo-audio` | El de Valeria+. Fuera de Oboe: una ayuda pedagógica no va en la cadena del estímulo calibrado |
| Tonos de audiometría (osciladores) | `react-native-audio-api` | **Divergencia justificada**: expo no sintetiza osciladores |
| Captura de PCM crudo (análisis acústico, prosodia) | `react-native-audio-api` | **Divergencia justificada**: `expo-audio` graba a fichero, no entrega bloques de muestras. Valeria+ no lo necesita porque no hace análisis acústico |

**Prohibido reintroducir** `react-native-tts`, `@react-native-voice/voice`
(npm marca la segunda como deprecada recomendando literalmente
`expo-speech-recognition`) y `react-native-audio-recorder-player`. Hay un test
que lo impide: `scripts/__tests__/nativeAudioConfig.test.js`.

### Una dependencia nativa que nadie importa NO es inofensiva

El autolinking de React Native no mira quién IMPORTA una librería: mira quién la
DECLARA en `package.json`. Una dependencia nativa muerta se sigue compilando en
cada build, así que su código —que nadie mantiene, porque nadie lo usa— puede
tumbar el APK entero al subir de versión de React Native.

**Coste real (23/8/2026).** `react-native-audio-recorder-player@3.6.7` dejó de
usarse cuando la toma del T.A.R. pasó a PCM en memoria, pero se quedó declarada.
Con React Native 0.81 su Kotlin dejó de compilar (`Unresolved reference
'currentActivity'`, `'applicationContext'`: los getters desaparecieron de su
clase base) y el build de release cayó a los 15 min 51 s en
`:react-native-audio-recorder-player:compileReleaseKotlin`. Una librería que la
app no usa y que npm marca como deprecada dejó a Frank sin APK.

Agrava el coste que la dependencia se vio y se dejó pasar: durante la migración
de agosto de 2026 apareció en el `package.json`, se pensó «no la usa nadie, no
la toco para no ampliar el alcance» y se siguió. **Ampliar el alcance no es lo
caro; dejar una bomba con la mecha encendida sí.** Cuando cambies la versión de
React Native, la lista de dependencias nativas se AUDITA entera: lo que no se
importa desde `src/` y no es peer de algo que sí, se quita.

**Y esa auditoría se quedó a medias (24/8/2026).** Se quitó
`react-native-audio-recorder-player` y no se miró el resto:
`@sentry/react-native@8.16.0` —telemetría nativa de mediados de 2024— seguía
declarada sin que **ni un solo fichero de `src/` la importara**, autolinkeándose
y compilándose dentro de un APK de React Native 0.81 con la arquitectura nueva,
sin que nada la llamara jamás. Misma figura, mismo riesgo. Ya no depende de que
alguien se acuerde: `scripts/__tests__/nativeDependencyAudit.test.js` recorre
las dependencias con código nativo de Android y falla si alguna no se importa
desde `src/` y no tiene su motivo escrito en la lista del propio test. Los
comentarios no cuentan como uso — es justo así como
`react-native-ble-plx` parecía viva (aparece seis veces en `src/`, las seis
dentro de bloques de comentario).

### Zero-PHI en el reconocimiento

Si no se puede GARANTIZAR que el reconocimiento ocurre en el dispositivo, **no
se reconoce**. La puerta se queda cerrada y el T.A.R. sigue siendo válido con
clasificación SODA manual. Lo que no puede volver a pasar es que se cierre sin
decirlo: `speechRecognitionBridge.start()` **lanza** con el motivo.

En cualquier emulador de Android la puerta está cerrada por diseño:
`supportsOnDeviceRecognition()` exige API 33 y el modelo de la lengua
descargado, y las imágenes de AVD no lo traen. **Eso no es una avería.**

---

## Pendiente (abierto: no lo des por cerrado)

- **Verificar en el emulador el resto de la batería.** La cadena de AUDIO ya
  está comprobada en dispositivo (las cuatro escuchas, 3/9/2026 — ver abajo).
  Lo que sigue abierto es todo lo demás: **ningún módulo clínico se ha recorrido
  de principio a fin**, y las sesiones de Claude aquí siguen sin SDK de Android.
  «Suena» y «la prueba mide lo que dice medir» son cosas distintas.
- **Registrar el repositorio de referencia del análisis de prosodia.** Frank
  dio uno y su URL no consta en el repositorio. Hasta que esté en la tabla de
  la regla 1, no se toca `src/Screens/ProsodyAnalysis/`.
- **El veredicto de ruido de sala no llega al informe.** No se persiste en
  ningún modelo ni aparece en el PDF (comprobado con `grep` sobre `src/PDF/`,
  `src/Models/` y `src/Repositories/`): un informe de audiometría no deja
  constancia de las condiciones acústicas en que se hizo, ni de si la sala se
  saltó. Decidir con Frank si debe constar.
- **Decidir si `react-native-ble-plx` entra en esta versión.** Hoy es
  exactamente la figura de `react-native-audio-recorder-player`: autolinkeada y
  compilada en cada build, arrastrando `rxandroidble` y toda la cirugía de
  permisos del manifiesto, con los dos adaptadores que la usarían (`src/Lua/`,
  el pulsioxímetro de disfagia) esperando un `BleManager` que **nadie
  instancia**. Es decisión de producto, no de limpieza.
- **LAS CUATRO ESCUCHAS ESTÁN CONTESTADAS (Frank, emulador, 3/9/2026).** El
  25/8/2026 se arregló la elección de voz del sistema (VIA+ prefería la voz
  `-network` de Google, que no emite sin cobertura, porque la regla «local gana
  a red» colgaba de una bandera que `expo-speech` no envía nunca — ver
  `docs/design/arquitectura-corpus-voz.md` §2 bis); el 27/8 Frank confirmó que
  la app habla, y el 3/9, tras el episodio del build mudo, que **las cuatro
  escuchas de «Comprobar audio» suenan**: `tone`, `verbal-clip-heard`,
  `voice-bank-heard` y `tts-heard`. Son los tres motores de salida
  (`expo-speech`, `expo-audio`, `react-native-audio-api`), así que la cadena de
  audio SÍ se puede dar por comprobada en dispositivo. **Lo que sigue sin
  cubrir, y no se puede estirar hasta ahí:** eso es una corrida de la pantalla
  de diagnóstico, no un recorrido de los trece módulos clínicos, que sigue
  abierto arriba. Y la regla que lo hizo posible se queda: si alguien añade un
  motor de salida, añade su escucha, y mientras falte una el veredicto es
  «SALIDA NO COMPROBADA».
- **El build mudo del 2/9/2026: Frank informa el 3/9/2026 de que «ya se arregló
  todo». La causa RAÍZ no está identificada.** Las dos cosas caben juntas y hay
  que anotarlas juntas, porque entre el build mudo y el que suena entraron
  varios cambios a la vez y ninguno se aisló: el merge de audio (`dfe77f6`:
  reabrir el contexto muerto, el eslabón del reloj) y los cambios de CI del NDK
  (`fddd1d7`, `ba0c29c`) —una descarga corrupta del NDK ya había tumbado `main`
  una vez—. **No se puede escribir que lo arreglara el arreglo del audio.** Lo
  descartado desde aquí, sin emulador: ninguna línea de `src/Audio/` cambió
  entre el build que hablaba (27/8, `6929c47`) y el mudo; `npx expo
  export:embed` construía el bundle sin error con sus 458 `.m4a`; los 421
  `require` del mapa de voz apuntan a ficheros existentes y no vacíos. Ni
  regresión de audio ni fallo de empaquetado. Lo que queda por saber, y **hay
  que preguntárselo a Frank antes de tocar la capa de audio otra vez**: qué dijo
  el eslabón «Reloj del hardware de salida» en la corrida buena. Si dijo
  «reabierto», la causa era el stream de Oboe que no abría y está demostrada en
  dispositivo; si salió verde de primeras, el mudo era otra cosa y sigue suelta.
- **La lista de Gemini sigue sin incorporar.** Salió de la revisión que Frank
  pidió por el build mudo y produjo la rama `sonido`, cuyo arreglo era inerte en
  Android. Que el síntoma haya desaparecido no valida esa revisión ni cierra sus
  otros hallazgos.
- **El micrófono no cambia de nivel al acercarse (25/8/2026).** Frank lo
  reporta como duda, no como avería, y no está resuelto. La toma de prueba
  publica ahora el **recorrido** (bloque más flojo → más fuerte) para que la
  duda se pueda medir en vez de discutir. Si el recorrido sale plano hablando y
  callando, la hipótesis a comprobar es el *input preset* de la captura:
  `AndroidAudioRecorder.cpp` de `react-native-audio-api` **no llama a
  `setInputPreset`**, así que se queda con el que Oboe traiga por defecto —y
  para análisis acústico haría falta `Unprocessed`, sin nivelado automático—.
  **No verificado**: no se ha leído la cabecera de Oboe (viene de Gradle, no
  está en `node_modules`) ni se ha medido en dispositivo. Cambiarlo exige
  parchear la librería nativa, que aquí no se puede compilar: decidirlo con
  Frank antes de tocar nada.
