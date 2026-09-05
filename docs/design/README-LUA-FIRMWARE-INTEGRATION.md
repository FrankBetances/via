# Integración de VIA+ con el periférico Lúa

> **Reescrito entero el 27/8/2026, contra el enlace real.**
>
> La versión anterior de este documento describía un aparato que no existe:
> otros UUID (`19B10000-…`), una trama con byte de suma de verificación, `GRANT`
> con TTL de hasta 255 s, latido cada 2 000 ms, un catálogo de nueve insignias
> clínicas que el firmware no tiene, y un «ejemplo de implementación» en C++ de
> ochenta líneas. Nada de eso es el enlace. Quien hubiera programado un
> periférico siguiéndolo habría construido un aparato con el que VIA+ **no puede
> hablar**, y quien lo leyera para depurar habría buscado el fallo en el sitio
> equivocado.
>
> Es el caso que el `CLAUDE.md` de `lua-firmware` llama §0 bis: un dato sin
> comprobar que nadie comprueba deja de leerse como dudoso y empieza a leerse
> como cierto. Todo lo que sigue está contrastado contra el código, y **cada
> sección dice contra qué fichero**.

---

## 0. Dónde está la verdad, y en qué orden

| Qué | Fuente ÚNICA | Aquí |
| :--- | :--- | :--- |
| Tabla de opcodes, UUID, límites | `FrankBetances/Valeria` · `firmware/lua/protocol.json` | copia vendorizada en [`src/Lua/protocol.json`](../../src/Lua/protocol.json), de la que `scripts/build-lua-protocol.js` genera `src/Lua/luaProtocol.ts` |
| Comportamiento del aparato | `FrankBetances/lua-firmware` · `core/src/device.cpp` | leído a mano en [`src/Lua/luaWire.ts`](../../src/Lua/luaWire.ts), con la línea citada |
| Dibujo de caras e insignias | `FrankBetances/Valeria` · `src/ValeriaPixelArt.ts` | no se replica: VIA+ solo manda índices |

**Este documento no es fuente de nada.** Si contradice a `protocol.json` o al
firmware, se equivoca él. El procedimiento para refrescar la copia está en
[`integracion-lua.md`](integracion-lua.md) §2.1, y desde el 24/8/2026 lo vigila
un gate que vive en el repositorio del firmware —el único que ve los tres—:

```bash
# desde un clon de lua-firmware, con este repositorio al lado
node tools/check-via-parity.js --via ../via
```

Compara los opcodes, las capacidades y los ocho bytes de `STATE`. Lo que **no**
compara, y no hay que confundirlo: que VIA+ *use* lo que tiene en la tabla. Que
un opcode esté en el `.json` no dice que haya una pantalla que lo mande.

---

## 1. Qué es Lúa y qué no es

Un periférico BLE con una pantalla y nada más: sin micrófono, sin motores y sin
salida de audio. Acompaña al niño durante la batería de VIA+ y celebra al
cerrar; **no mide, no registra y no decide nada**.

Hay **dos placas**, y no son intercambiables:

| | V1 · la oficial | V2 · en evaluación |
| :--- | :--- | :--- |
| MCU | ESP32-C3 | ESP32-S3 |
| Panel | GC9A01 redondo, 240×240 | ST7789 cuadrado, 240×240 |
| Táctil | no lleva | CST816 |
| Estado | ha corrido el firmware entero (19/8/2026) | arranca; **todavía no ha pintado un frame** |

La V1 es la placa sobre la que se decide y la que se pone delante de un niño.
La V2 lleva dos micrófonos y un códec montados de fábrica, **y el firmware no
los toca**: `board_v2.h` no define ni un pin de audio y hay un gate
(`check-lua-mute.js`) que rompe el build si alguien los baja a código.

Ni una de las dos afirmaciones de esta sección se ha comprobado desde aquí: son
lo que dicen el `README.md` y el `CLAUDE.md` de `lua-firmware` a fecha de
27/8/2026, y ahí está la validación de hardware con su informe.

---

## 2. Perfil GATT

**Contrastado contra** `src/Lua/luaProtocol.ts` (generado) y `protocol.json`.

- **Servicio**: `6c75612d-0001-4000-b000-000000000001`

Los UUID son ASCII: `6c 75 61 2d` es `lua-`. **No cambian nunca** — hay aparatos
flasheados.

| Característica | UUID | Propiedades | Bytes |
| :--- | :--- | :--- | ---: |
| `CTRL` | `6c75612d-0002-…` | `writeWithoutResponse` | 4 |
| `SAFE` | `6c75612d-0003-…` | `write` (con confirmación) | 2 |
| `STATE` | `6c75612d-0004-…` | `read` + `notify` | 8 |
| `CFG` | `6c75612d-0005-…` | `write` | 20 |

`CTRL` va **sin confirmación a propósito**: es el camino de latencia, y pedir
ACK duplica el peor caso. Una celebración perdida no le importa a nadie. `SAFE`
sí confirma, porque ahí importa saber que llegó.

---

## 3. La trama de `CTRL`: cuatro bytes, y el primero es la versión

**Contrastado contra** `luaFrame()` en `src/Lua/luaProtocol.ts` y
`Device::onCtrl` en `core/src/device.cpp`.

```text
Byte 0: versión del protocolo (hoy 1) — el firmware descarta lo que no reconoce
Byte 1: opcode
Byte 2: parámetro, byte BAJO
Byte 3: parámetro, byte ALTO
```

El parámetro es **un entero de 16 bits little-endian**, no dos parámetros
independientes. Donde la tabla habla de «byte bajo» y «byte alto» —`AWARD`,
`ACCESSORY`, `GRANT`, `PICTO_PAIR`— son las dos mitades de ese entero.

**No hay suma de verificación.** BLE ya la lleva por debajo; un cuarto byte de
XOR sería un byte de parámetro perdido.

## 4. Tabla de opcodes

**Contrastado contra** `LUA_OP` en `src/Lua/luaProtocol.ts` y el `switch` de
`core/src/device.cpp`.

| Código | Nombre | Parámetro | Qué hace |
| :--- | :--- | :--- | :--- |
| `0x01` | `PHASE` | 0-3 | espeja el turno: escucha · repite · veredicto · misión |
| `0x02` | `VERDICT` | 0-2 | 0 no coincide · 1 casi · 2 lo dijo |
| `0x03` | `CELEBRATE` | 0-2 | 0 cierre · 1 subida de nivel · 2 insignia |
| `0x04` | `IDLE` | — | cara neutra |
| `0x05` | `CALL` | — | llamada del Modo Vínculo |
| `0x06` | `AFFECT` | 0-7 | las ocho emociones puras (ver §5) |
| `0x07` | `PICTO` | índice · `0xFFFF` lo quita | la ficha del ejercicio |
| `0x08` | `AWARD` | glifo (bajo) + rango (alto) | la insignia (ver §6) |
| `0x09` | `LEVEL` | 1-12 | el anillo de progreso |
| `0x0A` | `PICTO_PAIR` | dos índices | **RESERVADO**: el firmware lo ignora |
| `0x0B` | `MOOD` | 0-4 | la vida de la mascota fuera del ejercicio |
| `0x0C` | `ACCESSORY` | ítem (bajo) + ranura (alto) | el armario; `0xFF` lo quita |
| `0x0D` | `RELAX` | 1-60 s | la gata se duerme (regla 20-20-20) |
| `0x10` | `GRANT` | ttl (bajo) + capacidades (alto) | concede (ver §7) |
| `0x11` | `HEARTBEAT` | — | renueva la concesión viva |
| `0xF0` | `BENCH` | — | banco de la Fase 0; no se usa en producción |

Los códigos `0x0E` y `0x0F` no existen: el salto a `0x10` es deliberado, para
que los opcodes de seguridad queden en su propio tramo.

**Un opcode desconocido no hace nada.** El `default` del `switch` lo descarta;
por eso se puede añadir al final sin romper un aparato ya flasheado, y por eso
**no se reordena nada nunca**.

## 5. Emociones (`AFFECT`)

**Contrastado contra** `case LUA_OP_AFFECT` en `core/src/device.cpp`.

La tabla declara **ocho**, 0-7: Alegría, Amor, Gratitud, Tranquilidad,
Esperanza, Orgullo, Inspiración, Diversión. Cada una pone su cara **y** siembra
sus partículas.

`LuaEmotion.Attentive = 8` de este repositorio **no está en la tabla**. Funciona
—deja la cara en escucha atenta, sin partículas— porque el `switch` del firmware
manda a `kExprAttentive` todo id que no reconozca y se salta el `spawnAffect`
con `if (param <= 7)`. Que el resultado sea justo el que hace falta en la
audiometría verbal y en el T.A.R. no lo convierte en contrato: **depende de una
rama `default`**. Añadir el 8 a la tabla se decide en Valeria+, y está anotado
como pendiente en [`integracion-lua.md`](integracion-lua.md).

`kExprAttentive` es además a donde vuelven `VERDICT(0)` y la ficha que se quita.
Ahí está la **regla de cero castigo**: un fallo no produce nunca una cara triste,
y eso está fijado en el firmware con un test propio (`testNoSadFace`). Si alguien
quiere una cara de decepción, pasa por logopedia y por el plan, no por un commit.

## 6. Insignias (`AWARD`)

**Contrastado contra** `core/include/lua/awards_generated.h` (generado desde
`src/ValeriaPixelArt.ts` de Valeria+) y `drawAward` en `core/src/renderer.cpp`.

El aparato lleva flasheadas **nueve familias × cinco rangos = 45 insignias**, y
el parámetro son las dos POSICIONES en esas listas:

```text
byte bajo = glifo, 0-8      byte alto = rango, 0-4
```

Ni el nombre ni la descripción viajan: no existe el campo. El aparato enseña el
dibujo número N de su catálogo y no sabe qué se ha ganado.

| # | Dibujo | # | Rango |
| :---: | :--- | :---: | :--- |
| 0 | cascabel fonador | 0 | bronce |
| 1 | huella de exploradora | 1 | plata |
| 2 | orejitas atentas | 2 | oro |
| 3 | lupa curiosa | 3 | diamante |
| 4 | Lúa soñadora | 4 | rubí |
| 5 | mochila de palabras | | |
| 6 | ovillo de cuentos | | |
| 7 | ronroneo afectivo | | |
| 8 | corona | | |

**Los nueve dibujos cambiaron el 25/8/2026** —Valeria+ los redibujó porque a
30 px «la huella parecía una cara y el cascabel un bolso»— y **las claves siguen
llamándose igual** (`flame`, `paw`, `star`…). Ese desfase es una trampa con
nombre propio: este repositorio tenía el mapa de insignias clínicas escrito
contra los nombres viejos, y la audiometría condicionada («Oído Atento») pintaba
el cascabel de la voz. La tabla de arriba es lo que se DIBUJA, que es lo único
que ve el niño.

El reparto de VIA+ vive en `LUA_CLINICAL_BADGES`
([`src/Lua/useLuaCompanion.ts`](../../src/Lua/useLuaCompanion.ts)), con el
porqué de cada elección al lado. Los índices 4 y 7 se quedan libres para el
cribado de SAHS y la disfagia cuando esos módulos cierren sesión.

Las hojas de contactos de las 45 están en `lua-firmware`:
`make shots-insignias` → `docs/insignias/catalogo.png`.

## 7. Concesiones, capacidades y seguridad

**Contrastado contra** `LUA_CAP`, `LUA_SAFE` y `LUA_LIMITS` en
`src/Lua/luaProtocol.ts`, y `Device::onCtrl` / `Device::onSafe`.

### `GRANT` — nada se dibuja sin permiso vivo

```text
byte bajo = TTL en segundos, 1-60      byte alto = máscara de capacidades
```

| Bit | Capacidad | |
| :---: | :--- | :--- |
| 0 | `VISUAL` | dibujar. Es lo que concede una máscara a 0 |
| 1 | `SOUND` | emitir sonido. **Nunca implícita**: hay que pedir el bit |
| 2 | `NO_TOUCH` | el único bit que **RESTA**: inhibe el táctil durante la concesión |

`NO_TOUCH` es feo y es deliberado: el dedo ya se atendía antes de que el bit
existiera, y un bit aditivo habría dejado sin caricia a todo lo ya escrito.

**REPOSO es el estado por omisión.** Ningún camino —fallo, desconexión,
reinicio, opcode desconocido, trama corta, ni un dedo en el cristal— lleva a
ACTIVA sin un `GRANT` explícito y reciente. El firmware lo prueba con 100
caducidades de 100 en cada cambio de `device.cpp`.

El latido es cada **10 s** (`LUA_LIMITS.heartbeatSeconds`), no cada 2 000 ms, y
solo sirve mientras la concesión anterior siga viva: si llega tarde, el aparato
ya está en REPOSO y hay que volver a conceder.

### `SAFE` — dos bytes, y sin byte de versión

`[operación, 0x00]`. El segundo va a cero porque la característica declara dos
bytes; el firmware lee `v[0]` directamente.

| Código | Operación | |
| :---: | :--- | :--- |
| `0x01` | `CLINICAL_SILENCE` | revoca toda concesión y **bloquea** nuevas. El cierre total |
| `0x02` | `UNLOCK` | levanta el bloqueo y el silencio sonoro. Devuelve a REPOSO, nunca a ACTIVA |
| `0x03` | `MUTE` | quita SOLO el sonido y deja viva la pantalla. Pega hasta un `UNLOCK` |

En `LOCKED` el aparato **no dibuja aunque se le conceda**. Por eso la recompensa
de cierre pide `UNLOCK` antes de `GRANT`; el orden está en
[`closingReward.ts`](../../src/Lua/closingReward.ts) y no es un detalle.

## 8. `STATE` — ocho bytes, y ninguno es la batería

**Contrastado contra** `Device::stateBytes` en `core/src/device.cpp:507-519` y
el decodificador de [`luaWire.ts`](../../src/Lua/luaWire.ts).

```text
 [0]    modo: 0 REPOSO · 1 ACTIVA · 2 BLOQUEADA
 [1]    segundos de concesión restantes, recortado a 255
 [2]    último opcode dibujado (diagnóstico; no se interpreta)
 [3]    versión de protocolo que dice hablar el firmware
 [4]    fps medidos por el aparato, recortado a 255
 [5..7] microsegundos de despacho, 24 bits little-endian (criterio de la Fase 0)
```

**La nota de `protocol.json` está mal aquí** y conviene saberlo: dice «modo,
capacidad viva, segundos de concesión restantes, batería, versión de firmware».
El firmware no publica batería ni capacidades. `luaWire.ts` sigue al firmware,
que es quien decide; corregir la nota se hace en Valeria+.

Este es exactamente el sitio donde la primera versión del códec se equivocó:
inventó un TTL en décimas de segundo y un byte de batería que no existen. Lo
único que lo sujeta hoy es que `check-via-parity.js` compare este desglose
contra `Device::stateBytes`.

---

## 9. Qué manda VIA+ hoy, y qué no

**Contrastado contra** `grep` sobre `src/` el 27/8/2026.

| Quién | Manda |
| :--- | :--- |
| `ResultadosFinal` · `closingReward.ts` | `UNLOCK` → `GRANT` → `CELEBRATE(2)`, con latido cada 10 s |
| Los seis módulos · `useLuaCompanion.ts` | `GRANT` + latido al entrar, `AFFECT`, `LEVEL`, `PHASE`, `VERDICT`, y al cerrar `AFFECT` + `CELEBRATE` y la insignia (`AWARD`) 2 s después |
| Tiene ayudante, no lo llama nadie | `PICTO`, `CALL` |
| No existe ni el ayudante | `MOOD`, `ACCESSORY`, `RELAX`, `PICTO_PAIR`, `BENCH` |

Los seis módulos son audiometría condicionada, audiometría verbal, análisis
acústico de voz, prosodia, T.A.R. y funciones ejecutivas.

**La insignia va 2 s detrás de la celebración, y esa espera es el arreglo del
27/8/2026**: las tres tramas salían juntas y en el aparato cada opcode sustituye
la cara, así que la insignia duraba lo que tarda la siguiente en cruzar el aire.
Está fijado en [`useLuaCompanion.test.tsx`](../../src/Lua/__tests__/useLuaCompanion.test.tsx),
que falla si alguien las vuelve a juntar.

La recompensa de cierre es **la única integración que el plan de Valeria+ (§8.2)
abre en la v1**: con la exploración terminada y los datos ya sellados, ahí Lúa
no puede contaminar nada. El resto de la lista existe en el código y su alcance
es una decisión de producto abierta — el §8.4 deja el refuerzo *durante* la
medición explícitamente fuera de la v1, y meterlo obligaría a plantearse si Lúa
pasa a ser parte del dispositivo. Esa conversación es con el organismo
notificado, no un commit.

Y hay un requisito de plataforma que sigue sin resolver: `react-native-ble-plx`
está declarada y **nadie instancia un `BleManager`**. Sin eso, todo lo de este
documento es una capa que no habla con ningún aparato. Está en la lista de
pendientes del `CLAUDE.md` como decisión de producto.

---

## 10. El muro regulatorio, que no cambia

1. **Mudez durante las pruebas.** Lúa no emite un pitido durante audiometría,
   análisis acústico, prosodia ni articulación. Hoy es estructural —no hay
   salida de audio, no hay pin y hay un gate que lo impide— y cuando algún día
   la haya, seguirá siendo la regla: la capacidad sonora se concede aparte y
   `MUTE` la quita sin apagar la pantalla.
2. **Cero texto en el periférico.** No es una decisión de interfaz: es la
   garantía **estructural** de Zero-PHI. Un nombre de paciente no puede llegar
   al aparato porque no existe el campo donde meterlo — todo son opcodes y
   números de catálogo.
3. **Cero castigo.** `VERDICT(0)` vuelve a *atenta*, nunca a una cara triste
   (§5).
4. **Desconexión segura.** Al caerse el enlace o caducar la concesión, el
   aparato vuelve a REPOSO solo. Nadie tiene que acordarse de apagarlo.

---

## 11. Lo que este documento ya no trae, y por qué

La versión anterior incluía un **ejemplo de implementación del firmware en
C++**. Se ha quitado entero, y no por espacio: el firmware existe, está en
`FrankBetances/lua-firmware`, tiene emulador de escritorio, 57 073
comprobaciones y capturas de las 28 caras. Un ejemplo escrito aquí solo puede
hacer dos cosas —repetirlo peor o contradecirlo—, y ya hizo la segunda: el que
había declaraba otros UUID, otra trama y un `AFFECT` de 0 a 15.

Si hace falta leer cómo responde el aparato a un opcode, se lee
`core/src/device.cpp`. Si hace falta verlo, `make run` levanta el emulador con
todos los mandos.
