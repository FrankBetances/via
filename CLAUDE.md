# VIA+ · Notas para Claude Code

## Reglas de trabajo (obligatorias, no negociables)

Nacen de errores reales cometidos en este repositorio, cada uno con su coste.
No son buenas prácticas genéricas: son la lista de lo que ya salió mal aquí.

Valeria+ tiene su propio `CLAUDE.md` con las suyas. **Léelo también**: las
reglas 0, 2 y 4 de aquí son las suyas, y se incumplieron en VIA+ porque este
repositorio no tenía dónde guardarlas. Una orden que solo vive en la memoria de
Frank y no en el repositorio se incumple por defecto en la sesión siguiente.

---

### 0. Se hace lo que está DEMOSTRADO que funciona, no lo más corto para ti

Manda sobre cualquier consideración de esfuerzo, elegancia o comodidad de
instalación.

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

**Corolarios, todos incumplidos ya:**

- **Nunca saltes una comprobación de compatibilidad.** `install-expo-modules`
  rechazó React Native 0.80.1 («Unable to find compatible Expo SDK version») y
  se forzó con `--sdk-version 54.0.0` en lugar de subir React Native. Saltar la
  comprobación dejó el proyecto en una combinación que ni Expo ni Valeria+
  respaldan. Si una herramienta dice que no, la respuesta es arreglar la
  incompatibilidad, no rodearla.
- **Una divergencia respecto al blueprint se anota CON SU MOTIVO** en la tabla
  de `docs/design/arquitectura-corpus-voz.md`, o no se hace. Una decisión sin
  justificación escrita no se revisa: se hereda.
- **«Es más rápido así» no es un motivo.** «Aquí no puedo compilarlo» tampoco:
  la imposibilidad de verificar es una razón para AVISAR, nunca para elegir el
  camino peor.

---

### 1. No afirmes nada que no hayas comprobado

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

Si no lo has comprobado, dilo con esas palabras: **«esto no lo he verificado»**.
Y nunca conviertas la ausencia de prueba en una afirmación sobre el equipo de
Frank: «no encuentro la causa» y «tu dispositivo está mal» son cosas distintas.

---

### 2. «Hecho» exige los gates, no solo el typecheck

Antes de empujar, y en este orden:

```bash
npx tsc --noEmit
npx jest
npx eslint . --ext .js,.jsx,.ts,.tsx
node scripts/check-verbal-coverage.js --strict
node scripts/check-lua-sprite.js
node scripts/resize-verbal-images.js --check
node scripts/build-lua-protocol.js --check
```

`scripts/check-android-permissions.js` **NO va en esa lista**: necesita el
manifiesto FUSIONADO de release y en local siempre falla con «no encuentro el
manifiesto fusionado». Corre en CI, después de `./gradlew bundleRelease`. Si lo
pones entre los gates locales, estarás escribiendo una instrucción que nadie
puede cumplir — comprobado el 22/8/2026 antes de escribir esta línea.

`npx eslint .` arrastra **16 errores preexistentes** (`'Buffer' is not defined`
en `docs/play-store/build-feature-graphic.js` y
`scripts/__tests__/voiceClipTempo.test.js`, dos scripts de Node sin `env: node`).
No son tuyos: lo que no puede subir es un error NUEVO.

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
  es la regla 0, y se incumplió el 22/8/2026.

---

## Arquitectura de audio: qué motor para qué

Migrado a la arquitectura de Valeria+ en agosto de 2026. **No lo cambies sin
leer la regla 0.**

| Función | Motor | Por qué |
| --- | --- | --- |
| Síntesis de voz (consignas, modelo del T.A.R., funciones ejecutivas) | `expo-speech` | El de Valeria+. La voz es una PREFERENCIA por locución, nunca una puerta |
| Reconocimiento de voz (T.A.R.) | `expo-speech-recognition` | El de Valeria+. Trae `requiresOnDeviceRecognition` de serie (Zero-PHI sin parches) |
| Reproducción de locuciones empaquetadas | `expo-audio` | El de Valeria+. Fuera de Oboe: una ayuda pedagógica no va en la cadena del estímulo calibrado |
| Tonos de audiometría (osciladores) | `react-native-audio-api` | **Divergencia justificada**: expo no sintetiza osciladores |
| Captura de PCM crudo (análisis acústico, prosodia) | `react-native-audio-api` | **Divergencia justificada**: `expo-audio` graba a fichero, no entrega bloques de muestras. Valeria+ no lo necesita porque no hace análisis acústico |

**Prohibido reintroducir** `react-native-tts` y `@react-native-voice/voice`
(npm marca la segunda como deprecada recomendando literalmente
`expo-speech-recognition`). Hay un test que lo impide:
`scripts/__tests__/nativeAudioConfig.test.js`.

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

- **Igualar React Native a Valeria+ (0.81.5).** VIA+ está en **0.80.1** y Expo
  SDK 54 fija `react-native: 0.81.5` en su `bundledNativeModules.json` — la
  versión exacta de Valeria+. `install-expo-modules` rechazó la combinación
  («Unable to find compatible Expo SDK version») y se forzó con
  `--sdk-version 54.0.0`, es decir, se saltó la comprobación. Mientras no se
  iguale, el build de Android está en una combinación que ni Expo ni Valeria+
  respaldan. Ver regla 0.
- **Compilar y verificar en el emulador.** La migración de voz de agosto de 2026
  está probada en JS (640 tests, `tsc` limpio) y **sin compilar ni una vez**.
  Nada de eso cuenta como verificado en dispositivo.
- **Revisar la lista de errores que Gemini encontró** en la última revisión.
  Frank la tiene; no se ha incorporado.
