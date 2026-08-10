# Integración de Lúa — mascota física de refuerzo (periférico BLE)

> **Estado:** EN CURSO (agosto 2026). El lado VIA+ que no depende de hardware
> está implementado y probado: **F2** (`src/Lua/`) y **F3** (enganche de
> contexto). Sigue pendiente todo lo que exige placa delante: **F0** (banco de
> pruebas y decisión de placa firmada), **F1** (firmware GATT del ESP32),
> **F4** (assets visuales) y **F6** (ensayo acústico). Ver §9 para el estado
> fase a fase, §12 para lo que queda del lado del código y §13 para la identidad
> visual, ya decidida: Lúa es la gata de Valeria+, no un personaje nuevo.
>
> Este documento fija **qué se construye, qué no, y por qué**, antes de comprar
> el segundo lote de placas.
>
> **Alcance:** el lado VIA+ de la integración. El lado Valeria+ vive en
> `FrankBetances/Valeria` y solo se referencia aquí (§10).
>
> **Fuentes de partida:** plan de trabajo de Lúa (AIoT, ESP32), manual del
> ESP32-2424S012 (C3 · IPS circular 1.28") y del ESP32-S3-ePaper-1.54G.

---

## 1. Qué decide este documento

Lúa es una gata física que reacciona a lo que ocurre en la tableta. Es una pieza
de motivación, no de clínica. El plan de partida la describe bien como concepto
y razonablemente como cronograma, pero al bajarlo al código de VIA+ y a las
hojas de datos de las dos placas aparecen **tres problemas que cambian el
diseño**, no solo la implementación. Este documento los resuelve y deja el resto
del plan en pie.

Los tres, en una línea cada uno:

1. **Ninguna de las dos placas es Lúa.** Se cruzan requisitos: la que refresca a
   tiempo no tiene ni audio ni reloj; la que los tiene refresca 15 veces más
   lento que el presupuesto de latencia. (§2)
2. **El silencio no se ordena, se concede.** Un comando «cállate» falla al lado
   equivocado: si se pierde, la mascota hace ruido durante una medición. (§3)
3. **«Accesorio» no es una exención del MDR, es una clasificación propia.** Para
   que Lúa quede fuera del expediente hay que diseñarla para que no sea
   accesorio, y eso impone una restricción dura al protocolo. (§4)

---

## 2. Ninguna de las dos placas es Lúa

El plan de partida asume que se elige entre dos candidatas comparables. No lo
son: cada una tiene la mitad de Lúa y les falta una mitad distinta.

| Requisito de Lúa | ESP32-2424S012 (C3 · IPS) | ESP32-S3-ePaper-1.54G |
|---|---|---|
| Expresión facial < 1 s | ✅ IPS 240×240, 16 bits, GC9A01 por SPI | ❌ **15 s** en refresco rápido, **2 niveles de gris** |
| Altavoz / maullidos | ❌ No hay códec ni amplificador | ✅ ES8311 + amplificador + altavoz MX1.25 |
| RTC para el «Modo Vínculo» | ❌ No hay | ✅ PCF85063ATL con interrupción a GPIO5 |
| Gestión de batería | ⚠️ Conector JST 1.25-2P, **sin IC de carga documentada** | ✅ ETA6098 + medida de batería en GPIO4 |
| Micrófono a bordo | ✅ **No tiene** (ver abajo, es una ventaja) | ⚠️ Micrófono omnidireccional integrado |
| Expansión de E/S | ⚠️ **SH1.0-4P**: alimentación + dos señales | ✅ Header 2×6P, GPIO1-3 libres |

**La pantalla decide.** El propio plan fija «latencia inferior a 1 segundo tras
la validación de un acierto fonológico». El e-Paper tarda 15 s en su modo
rápido: no es un margen ajustado, es un factor de 15 contra el requisito. Y con
2 niveles de gris, la cara de la gata es una silueta binaria. El e-Paper queda
descartado para el bucle de refuerzo; su sitio es un cartel de estado, no una
mascota.

**Y la C3 no puede recuperar lo que le falta.** El SH1.0-4P son cuatro pines:
3V3, GND y **dos señales**. Eso es un bus, no dos. Se puede colgar un RTC por
I²C **o** un módulo de audio por UART, no ambos, salvo montajes que nadie quiere
mantener. Conviene decirlo sin rodeos: sobre la C3 tal cual, **Lúa v1 no tiene
voz ni despertador**.

### 2.1. La decisión, y por qué es buena noticia

> **Lúa v1 = ESP32-2424S012C-I-Y — pantalla, y nada más.** Sin altavoz, sin
> servos, sin RTC. El «Modo Vínculo» (alertas autónomas por reloj) se aplaza a
> una v2 con placa propia.

Parece una renuncia y en realidad resuelve el requisito bloqueante de VIA+ de la
manera más barata posible: **una Lúa que no puede hacer ruido no puede
contaminar una prueba acústica**. La interferencia acústica nula deja de ser un
control de software que hay que verificar y pasa a ser una propiedad física del
montaje. Para un dispositivo que se va a llevar a la consulta del Hospital
Ribera Polusa y a ACOPROS, esa diferencia vale más que un maullido.

Dos notas menores del mismo signo:

- **La C3 no lleva micrófono.** La regla 7 del plan de partida («micrófono
  inhabilitado en Lúa») se cumple por ausencia de componente, que es la única
  forma de cumplirla sin tener que demostrarla. La placa e-Paper, que sí lo
  lleva, obligaría a argumentar por qué un micrófono presente en la sala no
  captura nada — un argumento que no apetece escribir en un expediente.
- **La carga de batería está sin documentar** en la hoja de la C3 (hay conector,
  no hay IC). Es una tarea medible de la Fase 0, no un supuesto.

---

## 3. El silencio no se ordena, se concede

El plan de partida propone que la tableta envíe «un comando prioritario de
Silencio Clínico» al entrar en `VoiceAnalysis`, `VerbalAudiometry` o
`ProsodyAnalysis`. El diseño es correcto en intención y **falla hacia el lado
equivocado**: el estado seguro (callado) depende de que un mensaje llegue. Si el
BLE se cae, si la app se cierra de golpe, si alguien añade en 2027 una pantalla
nueva con micrófono y no se acuerda del comando, Lúa se queda hablando encima de
una toma de voz. En términos de ISO 14971 eso es un control de riesgo cuyo modo
de fallo produce exactamente el daño que quiere evitar.

Se invierte:

> **Lúa arranca muda y quieta. Solo puede sonar o moverse mientras sostiene un
> permiso de ruido vigente, de vida corta, que la tableta renueva.**

Es un *dead-man's switch*. La tableta ya no tiene que acordarse de silenciar;
tiene que acordarse de **permitir**, y olvidarse de permitir es inofensivo.
Cualquier fallo — enlace caído, app colgada, tableta dormida, pantalla nueva sin
integrar — converge en silencio dentro del TTL del permiso.

Sobre esa base, tres capas independientes, cada una suficiente por sí sola:

| Capa | Mecanismo | Cubre |
|---|---|---|
| **1 · Lista blanca de pantallas** | El permiso solo se concede en pantallas sin clínica: `Bienvenida`, `SeleccionEjercicios`, `ResultadosPreliminares`, `ResultadosFinal` | El caso normal. Dentro de un módulo nunca hay permiso, así que la carrera del apartado siguiente no llega a existir |
| **2 · Revocación por sesión de grabación** | Observador sobre el contador de `acquireRecordingSession()` en `src/Audio/sharedAudioContext.ts`: en la transición 0→1 se revoca y se deja de renovar | Cualquier captura de micrófono, **incluida la de módulos que aún no existen** |
| **3 · Caducidad del permiso** | TTL de 3 s, renovación cada 1 s. Sin renovación, el firmware vuelve a mudo | Enlace caído, app muerta, tableta suspendida |

La capa 2 es la que hace que esto sea barato de mantener, y merece un párrafo.

### 3.1. `acquireRecordingSession()` ya es el punto único

VIA+ tiene un sitio, y solo uno, por el que pasa todo módulo que abre el
micrófono. Está en `src/Audio/sharedAudioContext.ts:129`, con recuento de
referencias, y hoy lo llaman los cuatro consumidores de micrófono del código:

```
src/Screens/VoiceAnalysis/voiceMicAdapter.ts:253
src/Screens/ProsodyAnalysis/prosodyMicAdapter.ts:192
src/Screens/RoomNoiseCheck/noiseMicAdapter.ts:222
src/Screens/Articulation/articulationAudio.ts:627
```

Colgar ahí la revocación significa que **no hay que tocar ni una pantalla
clínica** para integrar Lúa, y que el quinto módulo con micrófono que se escriba
quedará protegido sin que su autor sepa que Lúa existe. Es la diferencia entre
un control que hay que recordar y un control que se hereda.

El cambio en `sharedAudioContext.ts` es aditivo y pequeño: exportar un
`onRecordingSessionChange(cb)` que notifique las transiciones 0↔1. Nada más. El
módulo ya expone `isRecordingSessionActive()` para diagnóstico; esto es su
versión observable. El aviso se emite **antes** de reconfigurar la sesión de
audio: quien lo escucha lo hace para apagar algo, y el orden seguro es apagar
primero y abrir el micrófono después.

#### El punto único tenía una fuga (hallazgo de la implementación)

Al escribir la F3 se comprobó el supuesto en vez de darlo por bueno, y **el
punto único no lo era del todo**. En el T.A.R., `articulationAudio.ts` arrancaba
el reconocedor nativo y reservaba la sesión **dentro** del `if` de la captura en
memoria:

```ts
startRecognition(targetWord, targetPhoneme);   // abre el micrófono
if (availableRef.current) {                    // ← solo si hay motor de captura
  releaseSessionRef.current = acquireRecordingSession();
```

En un dispositivo sin `react-native-audio-api` operativo —la vía «solo
reconocimiento, SODA manual», que es una degradación prevista y no un caso
raro— el micrófono se abría por el reconocedor del sistema y **no constaba
ninguna sesión reservada**. La transcripción no se veía afectada, y por eso el
hueco no había dado la cara; lo que quedaba fuera era la contabilidad por la que
el resto de la app se entera de que hay un micrófono abierto. Con Lúa v2 en la
sala, el permiso de ruido habría seguido vigente durante la repetición del niño.

Corregido: la reserva pasa a ser **incondicional y previa** a
`startRecognition()`, y si la captura no llega a arrancar se aborta el intento
completo en vez de dejar al reconocedor escuchando sin toma que lo acompañe. Es
la única modificación a un módulo clínico de toda la integración, y no es de
Lúa: es de VIA+. Lo que hizo Lúa fue obligar a mirar.

Para que el supuesto no se rompa otra vez en silencio, la suite incluye un
guardián (`src/Lua/__tests__/micChokePoint.test.ts`) que **lee el árbol de
fuentes**, localiza todo el que abre el micrófono —construir un `AudioRecorder`,
reservar el recorder compartido, cargar el reconocedor nativo— y falla si alguno
no reserva la sesión. Las exenciones se declaran una a una con su motivo, así
que ampliarlas se ve en el PR. Se ha verificado que el guardián falla de verdad
en los dos casos que le importan: un módulo nuevo con micrófono sin sesión, y la
inversión del orden entre reserva y reconocimiento en el T.A.R.

### 3.2. La trampa de `allowBluetooth` en iOS

Un detalle del código actual que hay que dejar escrito antes de que muerda. La
sesión de audio de VIA+ se configura, tanto en reproducción como en grabación,
con `allowBluetooth` (y `allowBluetoothA2DP` en reproducción):

```ts
// src/Audio/sharedAudioContext.ts
iosOptions: ['defaultToSpeaker', 'allowBluetooth', 'allowBluetoothA2DP'],
```

Si Lúa expusiera alguna vez un perfil de audio Bluetooth **clásico** (A2DP o
HFP), iOS podría encaminar hacia ella los tonos de la audiometría o las palabras
de la logoaudiometría. El resultado sería una prueba de campo libre saliendo por
un altavoz de juguete no calibrado, y lo peor es que sonaría — nadie vería un
error.

> **Regla dura:** Lúa es **BLE-only**. No anuncia, no implementa y no negocia
> A2DP ni HFP. Se verifica en la Fase 1 sobre la pila del ESP32-C3, no se
> supone.

---

## 4. «Accesorio» no es una exención del MDR

El plan de partida busca el «aislamiento regulatorio» declarando a Lúa
«accesorio no decisorio». Conviene ser precisos, porque la etiqueta no hace lo
que parece: el MDR **se aplica también a los accesorios** de productos
sanitarios, y el Anexo VIII exige clasificarlos **por derecho propio**,
separadamente del producto con el que se usan. Llamar accesorio a Lúa no la saca
del expediente: la mete, con su propia ruta de conformidad y su propio marcado.

La vía que sí funciona es que **Lúa no sea accesorio**. Un accesorio, según la
definición del Reglamento, es lo que está destinado a permitir específicamente
que el producto se use conforme a su finalidad prevista, o a asistir específica
y directamente su funcionalidad médica. Una gata que pone cara de contenta no
hace ninguna de las dos cosas — **siempre que no se le dé nada clínico que
hacer**. Y eso hay que sostenerlo en el diseño, no en la prosa:

| Compromiso | Consecuencia técnica |
|---|---|
| Lúa no recibe contenido clínico | Por el aire viajan **estados afectivos abstractos**, nunca aciertos, puntuaciones, umbrales ni resultados. §5 lo impone en el propio protocolo |
| Lúa no influye en la medida ni en el juicio | Ninguna decisión de VIA+ lee el estado de Lúa. El adaptador es de escritura hacia el periférico; lo que Lúa notifica (batería, estado) es diagnóstico y no entra en ningún informe |
| VIA+ funciona idénticamente sin Lúa | Ya es la norma de la casa: el patrón del pulsioxímetro degrada a modo demo y el motor de audio degrada en silencio si falta el módulo nativo. Lúa degrada a *no-op* |
| El IFU no le atribuye beneficio clínico | Nada de «mejora la adherencia a la prueba». Es un juguete que acompaña |

De ahí sale, gratis, el **Zero-PHI**: si por el aire no viaja nada clínico, no
hay dato de salud que proteger en el periférico. El firmware no escribe en flash
nada de lo que recibe.

---

## 5. Protocolo BLE

Lúa es servidor GATT; la tableta, cliente. Un solo servicio.

**UUID base:** `6c7561XX-b17e-4f4d-9a2f-0a1b2c3d4e5f` (`6c 75 61` = `lua`).

| Característica | UUID | Props | Carga útil |
|---|---|---|---|
| **Capacidades** | `…6c756101…` | Read | `u8` versión de protocolo · `u8` bitmask: `bit0` pantalla, `bit1` altavoz, `bit2` motores, `bit3` RTC |
| **Expresión** | `…6c756102…` | Write sin respuesta | `u8` estado afectivo · `u8` intensidad (0-255) |
| **Permiso de ruido** | `…6c756103…` | Write sin respuesta | `u8` magic `0xA5` · `u8` TTL en décimas de segundo · `u8` secuencia |
| **Estado** | `…6c756104…` | Notify | `u8` estado del firmware · `u8` batería % · `u8` flags · `u8` eco de secuencia |

**Estados afectivos** (el enumerado completo, deliberadamente pobre en
semántica): `0` dormida · `1` neutra · `2` atenta · `3` contenta · `4`
celebración · `5` cariño. No existe `acierto`, no existe `fallo`, no existe
`umbral alcanzado`. Quien quiera meter clínica en el enlace tendrá que ampliar
este enumerado en un PR, que es exactamente donde queremos que se discuta.

**Capacidades primero.** El cliente lee capacidades al conectar y adapta la
política: sobre Lúa v1 (bit1 y bit2 a cero) el permiso de ruido ni siquiera se
envía. El mismo código sirve para la v2 con altavoz sin bifurcarse. Y mientras
las capacidades no se hayan leído, la respuesta a «¿puede hacer ruido?» es
**no**, así que la ventana entre conectar y leer es segura por omisión.

**Estado del firmware** (normativo para la F1, lo fija el códec del cliente en
`src/Lua/luaProtocol.ts`): `0` muda · `1` con permiso de ruido vigente · `2`
fallo. Un valor desconocido lo interpreta el cliente como fallo, nunca como
permiso vigente. Flags: `bit0` cargando, `bit1` batería baja. Batería `0xFF`
significa «no medida» —la C3 puede no medirla—, que no es lo mismo que
descargada.

**Seguridad.** Emparejamiento con LE Secure Connections y aceptación de
escrituras solo desde el central emparejado. No protege confidencialidad de PHI
—no la hay— sino **integridad**: impide que un tercero conceda un permiso de
ruido en mitad de una audiometría. El nombre anunciado es fijo (`Lua-XXXX`, con
los últimos bytes de la MAC); nunca nombre de paciente ni de profesional.

### 5.1. Presupuesto de latencia

| Tramo | Coste |
|---|---|
| JS → escritura nativa BLE (sin respuesta) | ~5-15 ms |
| Espera al intervalo de conexión (solicitado 30 ms) | ≤ 30 ms |
| Callback GATT → inicio de animación en el C3 | < 5 ms |
| Primer fotograma completo por SPI al GC9A01 (240×240×16 bits ≈ 115 KB, SPI a 40 MHz) | ~23 ms; por región parcial, mucho menos |
| **Total** | **< 100 ms frente a un presupuesto de 1000 ms** |

Diez veces de margen. Compárese con los 15 000 ms del e-Paper y se entenderá por
qué §2 no admitía discusión.

---

## 6. Cómo se integra en el código de VIA+

El patrón ya está inventado en este repositorio: el adaptador del pulsioxímetro
(`src/Screens/DysphagiaTest/pulseOximeter.ts`) registra **un** adaptador global,
lo instala con una función que recibe el `BleManager` y devuelve su limpieza, y
degrada a un modo sin hardware si nadie lo registró. Lúa lo copia literalmente.

```
src/Lua/
├── luaProtocol.ts     # codec puro de tramas + enumerados. Sin dependencias nativas → testeable
├── luaAdapter.ts      # setLuaAdapter / getLuaAdapter / installBleLua(manager) → cleanup
│                      # + fachada no-op (luaExpress, luaSendNoisePermit) que nunca lanza
├── noisePermit.ts     # renovador del permiso: lista blanca + observador de grabación + TTL
├── luaRoute.ts        # ruta activa (la hoja más profunda) desde el estado del navegador
├── installLua.ts      # instalación conjunta: adaptador + permiso, para que no se separen
├── useLua.ts          # hook de conveniencia para las pantallas (expresión + estado de enlace)
├── index.ts           # punto de entrada único
└── __tests__/         # codec, adaptador, permiso, integración con @/Audio y guardián del
                       # punto único del micrófono
```

Todo `src/Lua/` es *no-op* sin adaptador registrado, y la suite corre **sin
hardware**: el renovador del permiso se prueba con dependencias inyectadas y
temporizadores falsos, y el adaptador BLE contra un doble del `BleManager`.

Puntos de anclaje, todos ya existentes:

| Enganche | Dónde | Qué se hace | Estado |
|---|---|---|---|
| Permisos Android | `android/app/src/main/AndroidManifest.xml:62-64` | **Nada.** `BLUETOOTH_SCAN` (con `neverForLocation`) y `BLUETOOTH_CONNECT` ya están declarados para el pulsioxímetro | ✅ nada que hacer |
| Dependencia BLE | `package.json` | **Nada.** `react-native-ble-plx@^3.2.1` ya está | ✅ nada que hacer |
| Revocación por micrófono | `src/Audio/sharedAudioContext.ts` | `onRecordingSessionChange(cb)` (§3.1), exportado desde `@/Audio` | ✅ hecho |
| Lista blanca de pantallas | `NavigationContainer` en `src/App.tsx` | `onStateChange` + `onReady` → `handleNavigationStateChange` | ✅ hecho |
| `BleManager` compartido | Arranque de la app | Una sola instancia para pulsioxímetro y Lúa, como ya anticipa el comentario de `pulseOximeter.ts:74` | ⏳ **pendiente** (ver abajo) |
| Celebración de cierre | `src/Navigators/finishModule.ts` y `ResultadosFinal` | Ver abajo | ⏳ pendiente de F4 |

**Sobre la lista blanca y por qué acabó en `App.tsx`.** El plan situaba el
enganche en `src/Navigators/Default.tsx`, pero el estado de navegación no vive
ahí: lo publica el `NavigationContainer`, que se monta en `App.tsx`. Se escuchan
`onStateChange` **y** `onReady`, porque el primero no se dispara con el estado
inicial y sin el segundo la primera pantalla del arranque quedaría sin informar
—inofensivo (una ruta desconocida no concede permiso) pero dejaría a la gata
dormida hasta la primera navegación. La ruta que se toma es la **hoja más
profunda** del árbol: un módulo clínico anidado no puede quedar tapado por el
nombre de su contenedor.

**Sobre el `BleManager`, que sigue sin crearse.** Hoy la app no instancia
ninguno: el adaptador del pulsioxímetro tiene la misma forma
`install…(manager)` y también está esperando ese manager compartido. Crearlo no
es cableado inocuo —en iOS el primer uso dispara el diálogo de permiso de
Bluetooth del sistema en el arranque—, así que se decide con la placa delante,
en la F0, y de una vez para los dos periféricos. Hasta entonces `installLua()`
existe, está probada y no se llama: `src/Lua/` es *no-op* y lo único vivo es la
lista blanca de rutas, que ya se alimenta desde el navegador sin coste alguno.
`installLua()` instala **adaptador y permiso juntos** a propósito: el estado
intermedio «la gata ya funciona, el permiso lo hacemos luego» no debe existir ni
un día.

**Sobre dónde celebrar.** El plan de partida sitúa la recompensa en
`ResultadosFinal`. En el código, cerrar un módulo no lleva ahí: `finishModule()`
hace `replace('ResultadosPreliminares')`. Hay entonces dos momentos posibles y no
son equivalentes:

- **Cierre de módulo** (`finishModule` → `ResultadosPreliminares`): refuerza más
  a menudo, que es lo que motiva a un niño. Pero puede dispararse segundos
  después de una toma de voz.
- **Cierre de sesión** (`ResultadosFinal`): seguro, y raro.

Se hacen **los dos**, y el conflicto lo resuelve el mecanismo de §3 sin lógica
adicional: la expresión visual no está sujeta a permiso —una pantalla no hace
ruido—, y el sonido y el movimiento sí. En Lúa v1, que no tiene ni lo uno ni lo
otro, la pregunta ni se plantea.

---

## 7. Criterio de aceptación acústica

El plan de partida pide «auditoría acústica» sin decir contra qué. VIA+ trae su
propio sonómetro (`src/Screens/RoomNoiseCheck/`, ponderación A, Leq por bloques
de ~100 ms), y es el instrumento natural para la prueba — con una limitación que
hay que escribir antes de usarlo: su escala tiene el suelo en **25 dB(A)**
(`NOISE_DB_MIN`) y el micrófono de la tableta **no está calibrado en absoluto**;
el propio módulo lo dice al justificar su fondo de escala. Con ese instrumento
**no se puede demostrar «Lúa emite menos de X dB(A)»**.

Sí se puede demostrar lo que de verdad importa, que es diferencial:

1. **Protocolo:** sala en silencio, tableta en posición de examen, Lúa a 1 m.
   Tres tandas de 60 s alternando Lúa apagada / Lúa en su peor caso (todas las
   animaciones, y en v2 altavoz y motores al máximo).
2. **Criterio:** ΔLeq entre condiciones **por debajo de la repetibilidad medida
   de la propia condición «apagada»**, y sin cambio visible en el espectro de 24
   bandas. Si Lúa no se distingue del ruido de fondo con el mismo instrumento
   que usa la clínica, no interfiere en esa clínica.
3. **Cifra absoluta:** para el expediente, medición con **sonómetro clase 2**
   contra los niveles máximos de ruido ambiente de la **ISO 8253-2** para campo
   libre. La cifra concreta se toma de la norma en el momento del ensayo, no de
   este documento — *pendiente de verificar contra el texto vigente*.
4. **Trivialidad de v1:** con la placa de §2 la condición «peor caso» no incluye
   ni altavoz ni motores. Se espera Δ ≈ 0 y se mide igualmente, porque un
   resultado esperado sin medir no es un resultado.

---

## 8. Riesgos (ISO 14971)

| # | Peligro | Situación peligrosa | Daño | Control | Verificación |
|---|---|---|---|---|---|
| L-1 | Emisión acústica del periférico | Lúa suena durante análisis de voz, prosodia o logoaudiometría | Medida inválida → decisión clínica sobre dato falso | Permiso de ruido con caducidad, revocación por sesión de grabación, lista blanca (§3). En v1, ausencia física de altavoz | Ensayo §7 + test de integración: iniciar cada módulo con micrófono y comprobar revocación |
| L-2 | Encaminamiento del audio clínico al periférico | iOS enruta tonos por A2DP hacia Lúa | Audiometría de campo libre por transductor no calibrado, **sin señal de error** | BLE-only, sin perfiles de audio clásicos (§3.2) | Inspección de la pila BT del firmware + prueba en iOS con Lúa conectada durante audiometría |
| L-3 | Distracción visual | Animación durante una prueba que exige atención | Peor rendimiento atribuido al niño, no al estímulo | La lista blanca gobierna también la expresión: dentro de un módulo, Lúa duerme | Test de navegación por ruta |
| L-4 | Bloqueo del flujo clínico por el periférico | Escaneo o reconexión BLE bloquea la UI | Sesión interrumpida | Adaptador *no-op* si no hay hardware; todo el trabajo BLE fuera del camino crítico; ningún `await` de Lúa en un flujo de prueba | Tests con adaptador ausente y con desconexión a mitad de módulo |
| L-5 | Fuga de datos | El periférico recibe o almacena información del paciente | Incumplimiento de protección de datos | Sin semántica clínica en el protocolo (§4-§5); el firmware no persiste lo recibido | Revisión del enumerado en cada PR que toque `luaProtocol.ts` |
| L-6 | Escritura por un tercero | Un central no emparejado concede permiso de ruido | Equivale a L-1, provocado | Emparejamiento LESC + escrituras solo del central emparejado | Prueba con central no emparejado |

---

## 9. Fases

Diez semanas, como el plan de partida, reordenadas para que la decisión de
hardware caiga antes de que dependa nada de ella.

| Fase | Semanas | Entregable | Puerta de salida |
|---|---|---|---|
| **F0 · Banco de pruebas** | 1-2 | Medida real en ambas placas: latencia de refresco del GC9A01, consumo, comportamiento de carga de la C3, ruido propio | **Decisión de placa firmada.** La recomendación de §2 es la hipótesis a batir, no un hecho |
| **F1 · Protocolo y firmware base** | 2-3 | Servidor GATT en ESP32-C3, máquina de estados con arranque mudo, permiso con TTL, sin perfiles BT clásicos | Un central que se desconecta a mitad de permiso deja a Lúa muda dentro del TTL, comprobado |
| **F2 · Adaptador en VIA+** ✅ | 3-5 | `src/Lua/` completo, con tests de codec y de renovador de permiso | ✅ Suite verde **sin hardware**; app idéntica con y sin Lúa (probado con adaptador ausente, caído y que lanza) |
| **F3 · Enganche de contexto** ✅ | 5-6 | `onRecordingSessionChange` en `sharedAudioContext.ts` + lista blanca en el navegador | ✅ Los cuatro adaptadores con micrófono revocan el permiso, comprobado contra el `acquireRecordingSession()` real; el guardián del punto único falla si aparece un quinto sin cubrir — y ya cazó una fuga en el T.A.R. (§3.1) |
| **F4 · Assets visuales** | 6-8 | Catálogo de expresiones para 240×240 circular, con máscara de recorte, derivado de la identidad de Valeria+ (§13) | Legibles a 32,4 mm de diámetro visible |
| **F5 · Valeria+** | 8-9 | Mapeo `TurnPhaseStrip` → estados afectivos (repo `FrankBetances/Valeria`) | Fuera del alcance de este repositorio; se referencia para el cronograma |
| **F6 · Validación y cierre** | 9-10 | Ensayo acústico §7 en Ribera Polusa / ACOPROS, revisión de la tabla §8 | Riesgos L-1 a L-6 con verificación ejecutada |

---

## 10. Lo que este plan NO hace

Escrito para que no se cuele por omisión:

- **No embarca perro robot, servos ni cinemática.** El chasis mecánico del plan
  de partida queda fuera de v1 por §2 y §3. Reabrirlo exige rehacer §7 con
  motores en el peor caso.
- **No implementa el «Modo Vínculo».** Sin RTC no hay alertas autónomas. Es la
  razón principal para que exista una v2 con placa propia.
- **No pone micrófono en Lúa.** Ni ahora ni en la v2. La telemetría vocal se
  captura en la tableta, donde está caracterizada.
- **No mete a Lúa en el expediente MDR** — precisamente el objetivo de §4. Si
  alguna vez se le atribuye beneficio clínico, o se le envía contenido clínico,
  este documento queda invalidado y hay que reabrir la clasificación.
- **No añade lógica de Lúa a los módulos clínicos.** Ninguna pantalla clínica
  sabe que Lúa existe, y ninguna decisión clínica depende de ella. La intención
  original —«no toca los módulos clínicos»— se cumplió con una excepción que
  conviene decir en voz alta: la reserva de sesión del T.A.R. se corrigió
  (§3.1). No es código de Lúa ni una concesión a Lúa; es un fallo de
  contabilidad del micrófono que estaba ahí antes y que esta integración
  destapó. Se corrige en VIA+ y se queda aunque Lúa nunca llegue.

---

## 11. Qué hay que decidir antes de empezar

1. **Compra de F0:** ¿se compra una segunda C3 para el banco, o se decide sobre
   las placas ya disponibles?
2. **v1 sin sonido:** ¿se acepta que Lúa v1 sea muda, o el maullido es
   irrenunciable para el valor motivacional? Si lo es, F0 debe evaluar una
   tercera placa (C3/S3 con IPS **y** códec), no las dos de este documento.
3. **Orden Valeria+ / VIA+:** el refuerzo tiene más sentido clínico en Valeria+
   (uso diario) que en VIA+ (valoración puntual). Si se prioriza Valeria+, F5
   sube y F3 baja.

---

## 12. Lo que sigue del lado del código

Con F2 y F3 dentro, lo que queda en este repositorio es corto y está bloqueado
por hardware o por decisiones de §11:

1. **Crear el `BleManager` compartido** y llamar a `installLua(manager)` (y, de
   paso, a `installBlePulseOximeter(manager)`, que espera lo mismo desde antes).
   Bloqueado por F0: crearlo cambia el arranque en iOS.
2. **Assets visuales (F4)**: dibujar las seis expresiones sobre la identidad ya
   decidida (§13), partiendo de la sección de traspaso del repositorio de
   Valeria+ —**pendiente de bajar aquí**. Hasta que existan, `useLua().express()`
   está escrita y probada pero ninguna pantalla la llama: no se enganchan
   celebraciones a `finishModule` sin cara que poner.
3. **Firmware (F1)** contra el protocolo de §5, incluidos los estados de
   firmware normativos y la verificación de que la pila BT no anuncia A2DP/HFP.
4. **Ensayo acústico (F6)** según §7. Con la placa de §2 se espera Δ ≈ 0 y se
   mide igualmente.

Lo que **no** hay que decidir otra vez: el protocolo, la política del permiso y
el punto de enganche del micrófono están fijados y con pruebas que fallan si
alguien los cambia sin querer.

---

## 13. Identidad visual — la gata de Valeria+

> **Decisión (agosto 2026): Lúa no es un personaje nuevo.** Es la misma gata de
> Valeria+, con el mismo estilo gráfico. No se diseña una mascota para el
> periférico.

**Fuente de verdad: el repositorio `FrankBetances/Valeria`.** La identidad se
mantiene ahí, incluida una sección propia de traspaso —«Copiar a Lúa a otro
proyecto»— que es de donde hay que sacar el personaje, la paleta con sus
hexadecimales y los recortes. De ahí, y no de este documento: transcribir
colores de marca a mano es la forma más barata de que dos productos acaben con
dos teales distintos.

> **Aviso: no usar las láminas de Canva como referencia.** Existen varias
> («Valeria - App Icon», «Valeria - Bienvenida», «Valeria — Créditos») y son
> material **anterior** a la corrección de la identidad: siguen mostrando el
> personaje antiguo —un oso, con leyendas que lo llaman así— y consignas con
> «Oso Distractor». Son imágenes aplanadas, sin capa de texto, así que ni sus
> colores ni sus rótulos se pueden leer de forma fiable por herramienta. Están
> ahí, se ven convincentes y llevan a la conclusión equivocada; esta nota existe
> porque ya pasó una vez.

La paleta tiene cuatro papeles —teal de marca, teal oscuro, teal claro y navy— y
el personaje se usa en blanco sobre teal, con una variante inversa (teal sobre
blanco) y otra específica para tamaños pequeños, que es el punto de partida
natural para la F4. *Los valores concretos quedan pendientes de bajar desde el
repositorio de Valeria+; este documento no los transcribe.*

### 13.1. Por qué este estilo es un regalo para el GC9A01

No es solo coherencia de marca; el estilo resuelve casi todos los problemas de
una pantalla de 240×240 a 32,4 mm:

| Propiedad del estilo | Lo que resuelve en la placa |
|---|---|
| Rellenos planos, sin degradados | El panel es de **16 bits** (RGB565): un degradado suave se ve a bandas. Lo que no tiene degradado no puede bandear |
| Dos o tres colores por composición | Assets diminutos en la flash del C3, y **refresco por región parcial** trivial: repintar una zona plana no deja costura visible |
| Silueta pesada y cerrada | Lo único que sobrevive a 32,4 mm es la silueta. Un personaje de línea fina se convierte en una mancha |
| Alto contraste blanco sobre teal | La puerta de la F4 («legible a 32,4 mm») se cumple por construcción, no por ajuste fino |
| Variante para tamaños pequeños ya diseñada | El trabajo de simplificación está hecho; F4 la adapta, no la inventa |

**Lo que sí hay que rehacer:** el icono es una composición **squircle** de iOS
—con su brillo superior sutil— y la pantalla de Lúa es un **círculo**. El brillo
y el squircle son afordancias de icono de app, no rasgos del personaje: se caen.
La composición se rehace centrada, con margen de seguridad radial para que el
recorte circular del GC9A01 no coma orejas.

### 13.2. Las seis caras

El catálogo de F4 es el enumerado de §5 y nada más: `dormida`, `neutra`,
`atenta`, `contenta`, `celebración`, `cariño`. Se dibujan sobre el mismo
personaje, cambiando ojos, boca y poco más — que es justo lo que permite el
refresco parcial. Dos de ellas cargan trabajo clínico y conviene decirlo aquí:

- **`dormida`** es el estado por omisión y el que se usa **dentro de todo módulo
  clínico** (riesgo L-3): una gata dormida no compite por la atención del niño.
  Tiene que leerse como dormida a 32,4 mm y de un vistazo, no por un detalle
  fino.
- **`celebración`** es la única que puede ser vistosa, y solo aparece fuera de
  los módulos.

### 13.3. Compartir personaje no la convierte en accesorio

Reutilizar la gata de Valeria+ es una decisión de marca y no toca §4. Lo que
convertiría a Lúa en accesorio de un producto sanitario no es parecerse a
Valeria+, sino **hacer** algo clínico o que se le **atribuya** un beneficio
clínico. El límite práctico, para quien escriba el IFU o la ficha de tienda: se
puede decir que es el mismo personaje de Valeria+; no se puede decir que es «la
gata que guía la terapia», ni que acompaña, mejora o sostiene el tratamiento. El
personaje es compartido; la finalidad prevista, no.
