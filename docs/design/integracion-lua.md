# Integración de Lúa en VIA+ — periférico físico de refuerzo

> **Estado:** implementado el lado VIA+ (agosto 2026). Queda pendiente crear el
> `BleManager` compartido y probar contra el aparato (§9). La mascota ya está
> ya está en el repositorio, con su gate (§8).
>
> **Alcance:** solo lo que hace VIA+. **Lúa no es un proyecto de este
> repositorio.**
>
> ⚠ **14/8/2026 · el §3 de este documento está superado en su postura.** La
> dirección fijó que Lúa **sí** espeja durante la batería. Lo que describe este
> documento sigue siendo **lo que el código hace hoy** —la recompensa de cierre y
> nada más—; la decisión nueva, la matriz por módulo y lo que falta para poder
> implementarla están en
> [`lua-salida-y-alertas-sonoras.md`](lua-salida-y-alertas-sonoras.md). El
> argumento del §3 no se retira: es el que decide con qué figura entra Lúa en el
> expediente técnico.
>
> **De las alertas sonoras que aquella decisión traía ya no queda ninguna en
> VIA+**: la D-K del plan de Valeria+ cerró ese mismo día que **la voz la pone la
> tableta**, así que el aparato es **mudo en los siete módulos** y lo que espeja
> es solo imagen. El §2.2 de aquí sigue siendo la referencia de lo que `STATE` y
> `SAFE` hacen de verdad.

---

## 1. Lo primero: este documento no decide casi nada

Lúa es la mascota de Valeria+ —una gata negra tipo *smoking*, en píxel art— y
también un aparato físico de refuerzo sobre ESP32-C3 con una pantalla circular de
240×240. **El proyecto vive en `FrankBetances/Valeria`**, y allí están las cosas
que mandan:

| Qué | Dónde, en `FrankBetances/Valeria` |
|---|---|
| **La tabla de opcodes — fuente ÚNICA del enlace** | `firmware/lua/protocol.json` |
| El firmware del aparato | `firmware/lua/` (`src/main.cpp`, `include/lua_protocol.h`) |
| El plan completo: placas, latencia, seguridad, fases, identidad | `docs/plan-integracion-lua.md` |
| El sprite de la mascota | `src/ValeriaCatPixel.tsx` |

Este documento cubre **únicamente** la parte de VIA+, que es deliberadamente
pequeña, y el porqué. Para cambiar un opcode, un UUID, una placa o la mascota se
va al otro repositorio. Aquí no se discute nada de eso.

### 1.1. Una versión anterior de este documento estaba mal, y conviene saber cómo

Se escribió sin leer el repositorio de Valeria+, y produjo dos errores que
merecen quedar anotados porque explican la forma del código actual:

1. **Un protocolo GATT inventado.** UUID de servicio propio, cuatro
   características distintas, tramas de dos bytes, TTL en décimas de segundo y un
   byte de batería que no existe. No coincidía en **nada** con el aparato: no
   habría conectado con ninguna Lúa flasheada. Era además exactamente la «cuarta
   copia a mano» contra la que avisa `protocol.json`.
2. **El encuadre de riesgo invertido.** Declaraba el silencio del periférico como
   el control de riesgo de la interferencia acústica, con su fila en la tabla ISO
   14971. El plan de Valeria+ dice lo contrario y con razón (§3 de aquí).

La lección operativa está en §2: la tabla ya no se escribe, se genera.

---

## 2. El protocolo se genera, no se escribe

`protocol.json` lo consumen tres sitios —el firmware en C, Valeria+ y este
repositorio— y su propia nota lo advierte: «tres copias a mano se desincronizan».
El bug que produce no aparece como error de compilación ni como test rojo:
aparece como una mascota que hace cosas raras en la consulta.

Así que en VIA+:

```
src/Lua/protocol.json        ← copia VENDORIZADA byte a byte de Valeria+
scripts/build-lua-protocol.js ← genera el .ts desde ese .json
src/Lua/luaProtocol.ts       ← GENERADO. No editar a mano
```

El **cuerpo** del fichero generado es idéntico al `src/valeriaLuaProtocol.ts` de
Valeria+; solo cambia la cabecera de origen, para que un diff entre repositorios
enseñe la cabecera y nada más. Lo comprueba
`src/Lua/__tests__/luaProtocolGate.test.ts`, que regenera y compara en cada
ejecución de la suite.

### 2.1. Procedimiento de sincronización

El gate local detecta que alguien edite lo generado; lo que **no** puede detectar
es que la copia vendorizada se quede atrás respecto a Valeria+, porque este
repositorio no ve el otro. Eso es un paso manual y hay que hacerlo cuando cambie
el enlace:

```bash
# desde un clon de FrankBetances/Valeria al día
cp ../Valeria/firmware/lua/protocol.json src/Lua/protocol.json
node scripts/build-lua-protocol.js
npm test -- src/Lua
```

**Refresco del 14/8/2026, y de dónde salió exactamente.** La copia de aquí se
había quedado en los ocho opcodes de la primera tanda y el aparato contesta a
trece. Se refrescó **desde `protocol/protocol.json` del repositorio
`FrankBetances/lua-firmware`**, no desde un clon de Valeria+, porque es a lo que
había acceso en ese momento; ese fichero se declara allí copia de
`firmware/lua/protocol.json` de Valeria+. **Verificado después contra el original:
`diff` contra `firmware/lua/protocol.json` de un clon de Valeria+ da cero
diferencias**, y allí los tres gates `--upstream` pasan en verde. La versión de
protocolo no cambió (sigue en 1) y ningún `code` ni UUID se movió: lo que entró
son cinco opcodes nuevos al final, que es como se añaden.

Si el `.json` cambia de versión de protocolo, el aparato viejo **no** se actualiza
solo: `protocol.json` fija que «ni los uuid ni los `code` cambian nunca» porque un
aparato ya flasheado se queda con los suyos. `isLuaProtocolCompatible()` compara
la versión que publica el firmware por `STATE` con la del cliente.

### 2.2. Lo que la tabla generada no cubre

`protocol.json` no describe la trama de `SAFE` ni el desglose de `STATE`. Eso
está en `src/Lua/luaWire.ts`, leído del **firmware** —no deducido del documento— y
con la línea citada. Dos detalles que se habían inventado mal antes:

- **`SAFE` no lleva byte de versión.** El byte 0 es la operación
  (`main.cpp:164-165`). Poner ahí la versión haría que el aparato leyera `1` como
  `CLINICAL_SILENCE` por casualidad.
- **`STATE` son 8 bytes y ninguno es la batería:** modo, segundos de concesión
  restantes, cara, versión de firmware, fps y 24 bits de microsegundos de
  despacho (`main.cpp:91-106`). *La nota de `STATE` en `protocol.json` dice
  «batería»; el firmware no la publica. Discrepancia de origen, anotada aquí y a
  resolver en Valeria+.*

---

## 3. La postura de VIA+: el control es la ausencia

> **Implementado (22/8/2026).** La dirección decidió el 14/8 que Lúa esté
> presente y espeje durante la batería, y esa decisión **ya está en el código**:
> `useLuaCompanion` acompaña las siete pruebas. La tabla de abajo describía el
> estado anterior y se ha reescrito; lo que **no** cambia es el criterio con el
> que se juzga cada fila: si el aparato se apaga y la exploración sigue igual, es
> un accesorio; si la maniobra depende de que el aviso llegue, no lo es. Cada
> fila se clasifica con ese criterio en
> [`lua-salida-y-alertas-sonoras.md`](lua-salida-y-alertas-sonoras.md) §4, y tres
> de las siete caen del lado que hay que hablar con el análisis de riesgo
> delante. **Ese sigue siendo el punto abierto**, y ahora con código detrás en
> vez de un plan: ver §3.1.

VIA+ es SaMD **Clase IIa**: todo lo que pueda alterar la validez de una medición
entra en el expediente técnico y en el análisis ISO 14971.

La tentación es hacer que la tableta mande callar al periférico al entrar en un
módulo con micrófono. El §8 del plan de Valeria+ explica por qué es mal negocio:
eso convierte el silencio en **un control de riesgo implementado por software de
un dispositivo externo no verificado**, y obliga a demostrar, para el marcado, que
el comando llega siempre, que el firmware siempre obedece y que el fallo es
detectable. Caro, y no hace falta.

> **El control es que Lúa no está.** No entra en la cabina ni en la sala de campo
> libre durante una medición. Es un requisito del **protocolo de exploración**, no
> del software, y se audita mirando, no leyendo logs. Un aparato ausente no puede
> interferir.

De ahí sale todo lo demás:

| | Qué hacía VIA+ | Qué hace desde la integración del acompañamiento |
|---|---|---|
| **Durante la medición** | Nada. Ni refuerzo, ni espejo de turno, ni veredicto | Espeja el turno: `AFFECT` (estado afectivo), `PHASE` (fase del turno clínico) y, donde hay progresión, `LEVEL`. El refuerzo es **visual y háptico del periférico**, nunca sonoro mientras hay captura abierta (§5) |
| **Al cerrar la prueba** | — | `AWARD`: insignia clínica del módulo (siete, una por prueba) |
| **Al cerrar la sesión** | La recompensa de `ResultadosFinal` (§4) | Igual, más la Gran Insignia de cierre |
| **Si alguien la trae puesta** | `SAFE`/`CLINICAL_SILENCE` al abrirse cualquier captura — **defensa en profundidad, no declarada como control** (§5) | Sin cambios: el silencio clínico es anterior e independiente del acompañamiento, y sus pruebas siguen verdes |

### 3.1. `VERDICT` y `PHASE` ahora SÍ se envían — y eso abre el expediente

Este apartado decía lo contrario, y conviene leer por qué cambió.

Ambos opcodes existen en el protocolo y Valeria+ los usa dentro de la terapia: el
adulto califica y el aparato espeja el turno. El §8.4 del plan los dejaba fuera
de la v1 de VIA+ con un argumento que no era burocrático: hay caso clínico para
ello —es literalmente lo que hace un VRA con un juguete iluminado—, pero enviarlos
convierte a Lúa en algo más que un accesorio decorativo.

La dirección decidió el 14/8 que Lúa acompañe la batería, y la integración lo
implementa. El envío real de la app es hoy:

| Opcode | Cuándo | Quién lo emite |
|---|---|---|
| `AFFECT` | Cambio de estado afectivo en cualquiera de las siete pruebas | `useLuaCompanion.setEmotion()` |
| `PHASE` | Cambio de fase del turno clínico | `useLuaCompanion.setPhase()` |
| `VERDICT` | Resultado de un ítem, donde la prueba lo tiene | `useLuaCompanion` |
| `LEVEL` | Progresión (anillo de 12 niveles del T.A.R.) | `useLuaCompanion.setLevel()` |
| `AWARD` | Insignia al cerrar cada módulo | `useLuaCompanion.awardBadge()` |
| `GRANT` · `HEARTBEAT` · `CELEBRATE` · `IDLE` | Como antes | `closingReward` · `installLua` |

**Lo que esto NO cambia:** el silencio clínico (§5) es anterior e independiente,
y sigue siendo la defensa en profundidad de siempre. Lúa no emite sonido con una
captura abierta, así que el refuerzo durante la medición es visual y háptico del
propio periférico, no acústico: no entra en el canal por el que se mide.

**Lo que esto SÍ cambia, y hay que decirlo con todas las letras:** con `PHASE` y
`VERDICT` en vuelo durante la exploración, la pregunta de si Lúa es parte del
dispositivo deja de ser hipotética. El criterio de §3 sigue siendo el que decide
—si el aparato se apaga y la exploración sigue igual, es accesorio—, y hoy se
cumple: ningún camino clínico espera a Lúa, todo envío es dispara-y-olvida y sin
adaptador la app es idéntica (verificado en los tests, §6). Pero eso es un
argumento que **hay que sostener ante el organismo notificado con el análisis de
riesgo delante**, no darlo por bueno en un `.md`. Las tres filas señaladas en
[`lua-salida-y-alertas-sonoras.md`](lua-salida-y-alertas-sonoras.md) §4 son
exactamente las que exigen esa conversación.

---

## 4. La recompensa de cierre

`src/Lua/closingReward.ts`, enganchada en `ResultadosFinal` con
`useLuaClosingReward()`. Es la única integración de la v1, y va ahí porque en esa
pantalla la exploración está terminada y los datos sellados.

**No** va en `ResultadosPreliminares`, que es donde aterriza `finishModule()` al
cerrar un módulo: allí la sesión sigue abierta y puede venir otra toma de voz a
continuación.

El orden importa, y no es evidente:

```
UNLOCK  →  GRANT(30 s)  →  CELEBRATE(2)     +  HEARTBEAT cada 10 s
```

- **`UNLOCK` primero** porque el silencio clínico deja el aparato en `LOCKED`, y en
  ese estado el firmware ignora las concesiones (`main.cpp:126, 148`). Sin
  desbloquear, la celebración no se dibujaría y no habría ningún error a la vista.
- **La concesión caduca sola.** Se piden 30 de los 60 s que admite el aparato. Si
  la app muere o la pantalla se cierra, Lúa vuelve a reposo sin que nadie envíe
  nada: no hay trama de apagado que pueda perderse.
- **El latido va a 10 s**, la cadencia del aparato. La versión anterior usaba TTL
  de 3 s y renovación de 1 s, inventados; con los números reales, aquello habría
  dejado al aparato en reposo entre latido y latido.
- **Con un micrófono abierto no se celebra**, comprobado antes de arrancar. No
  debería poder pasar —esta pantalla no graba— pero cuesta cero.

---

## 5. Silencio clínico: el cinturón, no los tirantes

`src/Lua/clinicalSilence.ts`. Se emite `SAFE`/`CLINICAL_SILENCE` —con
confirmación— **al abrirse cualquier captura de micrófono**, y también al
instalarse si ya hay una captura viva: enchufar el aparato a mitad de una
audiometría no puede dejarlo desbloqueado.

Al cerrarse la captura **no se desbloquea nada**. El desbloqueo es explícito y
solo lo pide la recompensa de cierre.

Y no se declara como control de riesgo (§3). Está para el caso de que alguien la
traiga puesta.

### 5.1. `acquireRecordingSession()` es el punto único

El plan pide emitirlo «al abrir cualquier pantalla de captura». En VIA+ hay un
sitio, y solo uno, por el que pasa todo módulo que abre el micrófono:
`acquireRecordingSession()` en `src/Audio/sharedAudioContext.ts`, con recuento de
referencias. Colgarlo de ahí cumple lo que pide el plan y además cubre **los
módulos que todavía no existen**: el quinto que se escriba queda protegido sin
que su autor sepa que Lúa existe. Una lista de pantallas hay que acordarse de
actualizarla; esto se hereda.

La única modificación a código existente por Lúa es aditiva:
`onRecordingSessionChange(cb)`, que notifica las transiciones 0↔1. El aviso se
emite **antes** de reconfigurar la sesión de audio: quien lo escucha lo hace para
apagar algo.

### 5.2. El punto único tenía una fuga (y es un fallo de VIA+, no de Lúa)

Al comprobar el supuesto en vez de darlo por bueno, resultó que no era cierto. En
el T.A.R., `articulationAudio.ts` arrancaba el reconocedor nativo y reservaba la
sesión **dentro** del `if` de la captura en memoria:

```ts
startRecognition(targetWord, targetPhoneme);   // abre el micrófono
if (availableRef.current) {                    // ← solo si hay motor de captura
  releaseSessionRef.current = acquireRecordingSession();
```

En un dispositivo sin motor de captura operativo —la vía «solo reconocimiento,
SODA manual», que es una degradación prevista— el micrófono se abría por el
reconocedor del sistema **sin que constara ninguna sesión reservada**. La
transcripción no se veía afectada, y por eso no había dado la cara; lo que
quedaba fuera era la contabilidad por la que el resto de la app se entera de que
hay un micrófono abierto.

Corregido: la reserva es ahora **incondicional y previa** a `startRecognition()`,
y si la captura no arranca se aborta el intento completo en vez de dejar al
reconocedor escuchando sin toma. **Es un fallo de VIA+ que estaba ahí antes y se
queda corregido aunque Lúa nunca llegue.**

Para que no se rompa otra vez en silencio,
`src/Lua/__tests__/micChokePoint.test.ts` **lee el árbol de fuentes**, localiza
todo lo que abre el micrófono —construir un `AudioRecorder`, reservar el recorder
compartido, cargar el reconocedor nativo— y falla si alguno no reserva la sesión,
con las exenciones declaradas una a una. Verificado por mutación: falla con un
módulo nuevo sin cubrir y falla si se invierte el orden en el T.A.R.

### 5.3. La trampa de `allowBluetooth` en iOS

Esto es específico de VIA+ y hay que dejarlo escrito. La sesión de audio se
configura, en reproducción y en grabación, con `allowBluetooth` (y
`allowBluetoothA2DP` en reproducción):

```ts
// src/Audio/sharedAudioContext.ts
iosOptions: ['defaultToSpeaker', 'allowBluetooth', 'allowBluetoothA2DP'],
```

Si Lúa expusiera alguna vez un perfil de audio **clásico** (A2DP o HFP), iOS
podría encaminar hacia ella los tonos de la audiometría o las palabras de la
logoaudiometría: una prueba de campo libre saliendo por un altavoz de juguete no
calibrado, y lo peor es que **sonaría** — nadie vería un error.

> **Regla dura:** Lúa es **BLE-only**. No anuncia, no implementa y no negocia
> A2DP ni HFP. En la v1 no tiene ni altavoz, y el firmware trae un gate
> (`check-lua-mute.js` en Valeria+) que rompe el build si aparece inicialización
> de audio o de servo.

**Esta regla sube de importancia con el altavoz autorizado, no baja.** Mientras
Lúa no podía sonar, encaminar audio hacia ella era un fallo silencioso pero sin
transductor al otro lado. Con altavoz, un perfil clásico negociado por descuido
convierte L-2 en una audiometría de campo libre saliendo de verdad por un
altavoz de juguete no calibrado. **BLE-only, y las órdenes de sonido viajan como
un identificador por GATT — nunca como audio encaminado por el sistema.**

---

## 6. El mapa del código

```
src/Lua/
├── protocol.json        # copia vendorizada de la fuente única de Valeria+
├── luaProtocol.ts       # GENERADO desde el .json: UUIDs, opcodes, límites, trama CTRL
├── luaWire.ts           # trama SAFE y desglose de STATE, leídos del firmware
├── luaAdapter.ts        # adaptador único + fachada no-op que nunca lanza
├── clinicalSilence.ts   # SAFE al abrirse una captura (defensa en profundidad)
├── closingReward.ts     # UNLOCK → GRANT → CELEBRATE + latido (ResultadosFinal)
├── useLua.ts            # useLuaClosingReward() · useLuaDiagnostics()
├── useLuaCompanion.ts   # acompañamiento en las 7 pruebas: 9 emociones, fase,
│                        # nivel, respiración guiada e insignias clínicas
├── installLua.ts        # instalación conjunta: silencio + adaptador
└── __tests__/

src/Components/Mascot/
├── LuaCompanionWidget.tsx  # tarjeta en pantalla: emoción, mensaje e insignia
└── LuaPixel.tsx            # pixel art compartido con la cara del aparato
```

Las **nueve emociones** (`LuaEmotion`) y las **siete insignias clínicas**
(`LUA_CLINICAL_BADGES`, una por prueba, más la Gran Insignia de cierre) viven en
`useLuaCompanion.ts`. La novena, `Attentive`, se añadió para las pruebas en que
Lúa acompaña sin intervenir —audiometría verbal y T.A.R.—: el rango de `AFFECT`
subió a 0-15 para dejar sitio a futuras emociones sin revisar el protocolo, y el
firmware debe replegar a `kExprTranquility` todo id que no reconozca. Ojo con el
detalle: el firmware de referencia resolvía `AFFECT` con `p1 % 8`, que habría
pintado **Alegría** en plena escucha atenta. La tabla y el repliegue están en
[`README-LUA-FIRMWARE-INTEGRATION.md`](README-LUA-FIRMWARE-INTEGRATION.md) §4.

Enganches, todos existentes:

| Enganche | Dónde | Estado |
|---|---|---|
| Permisos Android | `AndroidManifest.xml:62-64` — ya declarados para el pulsioxímetro | ✅ nada que hacer |
| Dependencia BLE | `react-native-ble-plx@^3.2.1` ya está | ✅ nada que hacer |
| Aviso de captura | `onRecordingSessionChange()` en `src/Audio/sharedAudioContext.ts` | ✅ hecho |
| Recompensa | `useLuaClosingReward()` en `ResultadosFinal` | ✅ hecho |
| Acompañamiento | `useLuaCompanion()` en las 7 pruebas de la batería | ✅ hecho |
| Widget en pantalla | `LuaCompanionWidget` | ✅ hecho |
| `BleManager` compartido | arranque de la app, para Lúa **y** el pulsioxímetro | ⏳ pendiente (§9) |

**Reglas de la casa, verificadas en los tests:** ningún camino clínico espera
(`await`) a Lúa; los envíos de `CTRL` son dispara-y-olvida con `catch` vacío
deliberado; sin adaptador registrado todo es *no-op* y la app es idéntica; un
adaptador que lanza no se propaga a ninguna pantalla.

---

## 7. Riesgos (ISO 14971) — la parte de VIA+

> **Tabla rehecha el 22/8/2026, con el acompañamiento implementado.** La versión
> anterior se apoyaba en «el aparato no está» y «el aparato no tiene altavoz», y
> aplazaba la reescritura hasta que cerrase el §6 de
> [`lua-salida-y-alertas-sonoras.md`](lua-salida-y-alertas-sonoras.md). Ese §6
> **cerró el 14/8** (D-K: la voz la pone la tableta; en v1 el aparato no emite
> sonido, porque I²S no cabe en la ESP32-2424S012), así que la condición que
> bloqueaba esta tabla ya no se cumple y aquí está.
>
> Esto es además el punto 1 de «lo que decide VIA+ solo, hoy, sin hablar con
> nadie» del §7 de aquel documento: *mover la postura de la ausencia, fila a
> fila*. No baja requisitos a Valeria+ (§4.1).

### 7.1. Qué cambió en la exposición

Dos hechos del código mandan sobre todo lo demás, y conviene tenerlos delante
antes de leer la tabla:

**Uno.** `clinicalSilence` emite `SAFE`/`CLINICAL_SILENCE` —no `MUTE`— en cuanto
se abre cualquier captura de micrófono, y eso **apaga el aparato entero**, no
solo su sonido. De modo que en las pruebas que graban, Lúa está a oscuras
durante la medida:

| Prueba | ¿Abre captura? | Lúa durante la medida |
|---|---|---|
| Análisis de Voz · Prosodia · T.A.R. · Sonómetro | Sí | **Apagada** por `CLINICAL_SILENCE` |
| Audiometría Condicionada · Audiometría Verbal · Funciones Ejecutivas | No (solo reproducen) | **Viva** |

**Dos.** En v1 el aparato **no tiene salida de audio** (D-F/D-K). No hay
interferencia acústica posible: no hay nada que suene.

El riesgo residual se concentra, por tanto, en la fila de abajo a la derecha:
las pruebas que no graban y en las que Lúa sigue expresándose. De ellas, la
crítica es la **audiometría condicionada**, que la matriz del §4 clasifica como
*parte del acto* — es un VRA, y el refuerzo condicionado **es** el método.

### 7.2. La tabla

| # | Peligro | Daño | Control | Verificación |
|---|---|---|---|---|
| L-1 | El periférico interfiere en una medición **acústica** | Medida inválida → decisión clínica sobre dato falso | **Mudez física**: la v1 no tiene salida de audio (D-F/D-K, §6 de `lua-salida-y-alertas-sonoras.md`). *Defensa en profundidad:* `CLINICAL_SILENCE` al abrirse cualquier captura, que además apaga la pantalla | Inspección del hardware v1 (sin códec ni altavoz). Test de integración: la reserva real de micrófono emite el `SAFE` (`micChokePoint`) |
| L-2 | Encaminamiento del audio clínico al periférico | Audiometría de campo libre por transductor no calibrado, **sin señal de error** | BLE-only, sin perfiles de audio clásicos (§5.3) | Inspección de la pila BT del firmware + prueba en iOS con Lúa conectada durante audiometría |
| **L-3** | **Lúa señala la respuesta en una audiometría condicionada**: el niño responde a la gata y no al tono | **Umbral falsamente bajo → hipoacusia infravalorada.** Es el daño más grave de toda la tabla: un cribado que dice «normal» sobre un niño que no oye | **Lúa no se expresa en la ventana que va del estímulo a la respuesta.** `setEmotion` cambia solo en fronteras de fase; `setVerdict` se emite únicamente desde el manejador de la respuesta y solo si el tono estaba sonando, de modo que el refuerzo llega SIEMPRE después del acto del niño y nunca antes. Es la misma regla por la que `WhistleButton` mantiene aspecto constante en la prueba real | Puerta estructural sobre el código: `luaStimulusWindow.test.ts` (5 aserciones; verificada inyectando una violación, que la hace fallar). **Pendiente: verificación de comportamiento contra el aparato real** (§9) |
| L-3b | Distracción visual fuera de la ventana crítica | Peor rendimiento atribuido al niño, no al estímulo | Expresión acotada a fronteras de fase y a cierres de ítem; en las pruebas con micrófono no hay expresión ninguna (`CLINICAL_SILENCE`) | Tests de la recompensa: no celebra con captura viva ni fuera de su pantalla. Tabla de exposición del §7.1 |
| L-4 | El periférico bloquea el flujo clínico | Sesión interrumpida | Adaptador *no-op* sin hardware; ningún `await` de Lúa en un flujo de prueba; escaneo fuera del camino crítico | Tests con adaptador ausente, caído, que lanza y con escrituras que fallan |
| L-5 | Fuga de datos | Incumplimiento de protección de datos | **Zero-PHI estructural**: no existe ninguna característica de texto en el protocolo. No hay sitio donde meter un nombre | Gate del protocolo en cada ejecución de la suite |
| **L-6** | **Lúa pasa a ser parte del dispositivo sin que nadie lo haya decidido** | Dispositivo Clase IIa con un componente no verificado dentro del acto clínico | Criterio del §3, que se sigue cumpliendo: ningún camino clínico espera a Lúa, todo envío es dispara-y-olvida y sin adaptador la app es idéntica. **Pero el criterio deja de bastar en las filas que el §4 clasifica como *parte del acto***, y la audiometría condicionada ya está implementada | Tests de degradación (L-4). **INSUFICIENTE por diseño: esta fila no se cierra con una prueba, se cierra con el organismo notificado** (§9) |

### 7.3. Lo que esta tabla NO cierra

Dos cosas, y ninguna es una prueba que falte escribir:

1. **L-6 no es un riesgo técnico.** Es la pregunta de con qué figura entra Lúa en
   el expediente. El §4 clasifica `AudiometryConditioned` y `DysphagiaTest` como
   *parte del acto*, y `ExecutiveFunctions` también por su consigna pregrabada.
   De esas tres, **la audiometría condicionada ya tiene código**. Que el criterio
   del §3 se cumpla hoy es un argumento a favor, no una absolución.
2. **La interferencia acústica medida** (ensayo diferencial con el sonómetro de
   `RoomNoiseCheck`, sonómetro clase 2 contra la ISO 8253-2) sigue sin ser una
   puerta de VIA+ **mientras el hardware no tenga altavoz**. La D-F manda voz y
   sonido muestreado a v2 y placa distinta. El día que exista esa placa, L-1
   vuelve a necesitar medida, no inspección.

## 8. Identidad visual

**Lúa es la gata de Valeria+: negra tipo *smoking*, en píxel art.** No se diseña
mascota para VIA+.

El sprite es una **rejilla de caracteres** que se pinta como rectángulos de 1×1 en
un `viewBox` (`src/ValeriaCatPixel.tsx` en Valeria+): escala a cualquier tamaño
sin perder el borde duro, y un mapa de texto se revisa en el diff, cosa que un PNG
no. Dos poses: cabeza sola por debajo de 90 px, cuerpo entero por encima.

Y el dato que simplifica el hardware: **a 240×240 el píxel art es el formato
nativo del panel**, así que la cara del aparato y la de la app son literalmente el
mismo dibujo, no dos interpretaciones que se separan versión a versión.

### 8.1. Dónde está, y por qué no hay una segunda copia

```
src/Components/Mascot/LuaPixel.tsx   # copia literal del sprite de Valeria+
scripts/check-lua-sprite.js          # el gate: compara el DIBUJO, no el fichero
```

Se reexporta como `CatPixel` desde `@/Lua`, porque el mismo sprite es la cara del
periférico: una pantalla que celebre el cierre pinta la misma gata que el aparato,
no una segunda interpretación. Solo necesita `react-native-svg`, que ya estaba.

**El gate compara el dibujo, no el fichero,** y esa decisión es la buena: extrae
las dos rejillas y la paleta y las hashea, así que los comentarios, las rutas y el
nombre del componente pueden diferir entre repositorios —y difieren— sin que
salte. Lo que no puede diferir es un solo píxel. Un gate que exigiera identidad
byte a byte del fichero entero saltaría con cada cabecera adaptada, y un gate que
salta por nada se acaba desactivando.

Corre en dos sitios: en `android-release.yml` al publicar, y en la suite
(`src/Lua/__tests__/luaSpriteGate.test.ts`), porque un dibujo retocado aquí no
debería pasar desapercibido todo el desarrollo para saltar al publicar. El test
comprueba además que el paso de CI siga existiendo: un gate que alguien quita de
un workflow no deja ningún rastro rojo.

### 8.2. Lo que NO se trae del traspaso

El README de Valeria+ manda llevarse tres ficheros; el tercero,
`build-brand-assets.js`, **no se trae**, y conviene justificarlo porque apartarse
de un traspaso normativo es justo como se desfasan las copias.

Ese script genera los cinco PNG de marca de Valeria+ —icono Android, icono
adaptativo, splash, retrato del manual e icono de iOS— desde la rejilla. En VIA+
eso **sobrescribiría la identidad del producto con la mascota de otro**: VIA+ es un
producto distinto, con su propio icono, y Lúa es aquí el personaje de un
periférico, no la marca de la app. El traspaso está escrito para un proyecto que
adopta a Lúa como marca; VIA+ no lo es. Arrastra además Playwright como
dependencia de build.

Si algún día hace falta un bitmap de Lúa en VIA+, sale de ahí. Las caras del
periférico se generan en Valeria+ con `build-lua-faces.js`, que es donde vive el
firmware.

Tampoco se trae **ningún PNG** —son salidas, no fuentes— ni el copy de los
ejercicios de Valeria+, que es contenido clínico suyo y no marca. Y se respeta la
distinción que hereda el gate de allí: **«oso» es vocabulario terapéutico
legítimo** en este repositorio —par mínimo *ocho/oso*, frases de lectura, órdenes
TPR— y no se toca.

### 8.3. Compartir personaje no la convierte en parte del dispositivo

Reutilizar la gata es una decisión de marca. Lo que cambiaría la clasificación no
es parecerse a Valeria+, sino **hacer** algo clínico o que se le **atribuya**
beneficio clínico. El límite práctico para quien escriba el IFU o la ficha de
tienda: se puede decir que es el mismo personaje; no se puede decir que es «la
gata que guía la terapia», ni que acompaña, mejora o sostiene el tratamiento.

---

## 9. Lo que queda

1. **Crear el `BleManager` compartido** y llamar a `installLua(manager)` —y, de
   paso, a `installBlePulseOximeter(manager)`, que espera lo mismo desde antes—.
   No es cableado inocuo: en iOS el primer uso dispara el permiso de Bluetooth
   del sistema en el arranque. Se decide con la placa delante y de una vez para
   los dos periféricos. No corre prisa: el aparato solo anuncia 120 s tras pulsar
   su botón físico, así que ni un escaneo permanente lo encontraría solo.
2. **Probar contra el aparato de verdad.** Todo lo de aquí está verificado contra
   el firmware **leyéndolo**, que es mejor que inventarlo pero no es lo mismo que
   conectar. Pendiente: emparejamiento, `BENCH` para el presupuesto de latencia
   (300 ms) y comprobar que `UNLOCK` → `GRANT` → `CELEBRATE` dibuja de verdad.
3. **Llevar L-6 al organismo notificado.** La tabla del §7 está rehecha
   (22/8/2026) y todas sus filas tienen control y verificación salvo esa, que no
   se cierra con una prueba: la audiometría condicionada es *parte del acto*
   según el §4 y ya tiene código. Lo que hay que llevar es el argumento del §3
   —ningún camino clínico espera a Lúa— con la tabla delante, y que decida quien
   corresponde. **Lo firma el responsable clínico, no un `.md`.**
4. **Verificar L-3 contra el aparato real.** El control está redactado y tiene
   puerta estructural (`luaStimulusWindow.test.ts`), pero una puerta sobre el
   código fuente no es una prueba de comportamiento: falta comprobar con la placa
   que Lúa efectivamente no se mueve entre el tono y la respuesta. Entra en el
   mismo viaje que el punto 2.
5. **Avisar a Valeria+** de la discrepancia de `STATE` en `protocol.json` (§2.2).
6. **Cerrar en Valeria+ las cuatro divergencias del sonido** entre la D-F del
   plan y la decisión de dirección del 14/8/2026, que es lo que hoy impide
   escribir una sola línea de audio en cualquiera de los tres repositorios:
   [`lua-salida-y-alertas-sonoras.md`](lua-salida-y-alertas-sonoras.md) §6.

Lo que **no** hay que decidir otra vez: el protocolo no se negocia —se genera—, y
la postura regulatoria de VIA+ está fijada en el §8 del plan de Valeria+, no aquí.
