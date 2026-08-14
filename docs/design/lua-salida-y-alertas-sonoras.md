# Lúa como periférico de SALIDA · espejo visual y alertas sonoras en VIA+

> **Estado (14/8/2026):** decisión de dirección **registrada**, no implementada.
> Del lado del código solo está hecho lo que no necesita protocolo nuevo: la
> tabla de opcodes vendorizada, que se había quedado en ocho y ahora trae los
> trece del aparato (§8). **Ni una línea de audio, en ninguno de los tres
> repositorios**, y todavía no puede haberla: §6 dice por qué y §7 en qué orden
> se desbloquea.
>
> Este documento **no sustituye** a [`integracion-lua.md`](integracion-lua.md),
> que sigue describiendo lo que VIA+ hace hoy. Lo que hace es marcar qué parte
> de aquel documento queda superada por esta decisión —el §3, «el control es la
> ausencia»— y qué hace falta para poder cambiarlo sin romper nada.

---

## 1. Lo que la dirección fija

| | Queda cerrado |
| :--- | :--- |
| **Naturaleza del aparato** | Lúa es **estrictamente de salida**: pantalla GC9A01 de 240×240 y altavoz |
| **Micrófono** | **Cero.** Ni micrófono, ni códec de entrada, ni grabación, ni ASR en el aparato |
| **Captura acústica** | **Toda** en la tableta: el micrófono de VIA+ por `sharedAudioContext` a 48 kHz, y el DSP determinista local |
| **Sentido del enlace** | BLE **unidireccional en lo funcional**: de la tableta al aparato salen órdenes; del aparato solo vuelve su estado por `STATE` |
| **Presencia en la batería** | Lúa **está**, espeja y —en algunos módulos— suena. Esto es lo que cambia (§4) |

Las cuatro primeras filas **no cambian nada** de lo que ya había: son la postura
de siempre, y conviene decir por qué se escriben igualmente. La ausencia de
micrófono es lo único que mantiene a Lúa fuera del alcance de una
logoaudiometría —un altavoz cambia lo que el aparato *emite*; un micrófono
cambiaría lo que *capta*, y eso es otra conversación, de datos, de PHI y de
clase—. Está sostenida por un gate que rompe el build en el firmware, y ese gate
**no se toca nunca** en la parte del micrófono.

La quinta fila es la decisión de verdad, y es grande.

## 2. La topología, y el único sitio por donde entra el sonido

```
┌──────────────────────────── TABLETA · VIA+ ────────────────────────────┐
│                                                                        │
│  [ Micrófono de la tableta ]  ← ENTRADA ÚNICA de todo el sistema       │
│           │                                                            │
│           ▼                                                            │
│  [ sharedAudioContext · 48 kHz · acquireRecordingSession() ]           │
│           │                                                            │
│           ├── DSP local: VoiceAnalysis    (F0, jitter, shimmer, HNR)   │
│           ├── DSP local: ProsodyAnalysis  (pausas, rango en semitonos) │
│           └── DSP local: RoomNoiseCheck   (sonómetro)                  │
│                                                                        │
│  [ BLE central · react-native-ble-plx ]                                │
└───────────────────────────────┬────────────────────────────────────────┘
                                │  GATT · solo órdenes de salida
                                ▼
┌──────────────────────────── LÚA · periférico ──────────────────────────┐
│  ESP32-C3 (placa ESP32-2424S012)                                       │
│  ENTRADAS:  ninguna de audio. Ni micrófono, ni códec, ni ADC de audio  │
│  SALIDAS:   1. Pantalla GC9A01 240×240 circular                        │
│             2. Altavoz — AUTORIZADO Y SIN EXISTIR (§6)                 │
└────────────────────────────────────────────────────────────────────────┘
```

Lo que hace verificable esa flecha única de entrada no es el dibujo: es
`acquireRecordingSession()`, el punto por el que pasa **todo** consumidor de
micrófono de VIA+, y el test `src/Lua/__tests__/micChokePoint.test.ts`, que lee
el árbol de fuentes y falla si aparece un módulo que abre el micrófono sin
reservar la sesión. El día que alguien añada una captura nueva, esa flecha sigue
siendo cierta sin que su autor tenga que saber que Lúa existe.

## 3. La matriz por módulo

Los nombres son los de las pantallas reales de este repositorio, para que no haya
que traducir nada al implementarlo.

| Módulo (`src/Screens/…`) | Pantalla de Lúa | Altavoz de Lúa | Micrófono de la tableta |
| :--- | :--- | :--- | :--- |
| **`DysphagiaTest`** (MECV-V) | Modelo visual de postura y deglución | **Silencio.** La orden de tragar la da el clínico | No. Usa el pulsioxímetro BLE |
| **`AudiometryConditioned`** | Maquinista del tren: avanza al detectar respuesta | **Silencio.** Los tonos salen por los auriculares o la tableta | No. La respuesta es motora, en pantalla |
| **`ExecutiveFunctions`** | Avatar de juego y retroalimentación de bloque | Locución de consigna inicial pregrabada (`@/Voice`) | No. Interacción táctil |
| **`VoiceAnalysis`** (/a/ sostenida) | Gata respirando hondo / cantando | **Silencio absoluto** | **Sí** · 48 kHz → F₀, jitter, shimmer, HNR, formantes |
| **`ProsodyAnalysis`** (habla continua) | Gata con cara atenta, escucha activa | **Silencio absoluto** | **Sí** · pausas, rango dinámico en semitonos |
| **`RoomNoiseCheck`** | — | **Silencio absoluto** | **Sí** · sonómetro |
| **`ResultadosFinal`** (cierre) | Animación de celebración | Locución de refuerzo y felicitación | No |

Tres lecturas que no son evidentes en la tabla:

1. **Ningún módulo suena mientras el micrófono está abierto.** No es una
   coincidencia de las filas: es la regla clínica, y es la misma que rige en
   Valeria+ («Lúa no suena mientras la tableta escucha»). Un pitido encima del
   estímulo enmascara, y un pitido durante la captura entra en el micrófono y
   contamina la medida. Aquí pesa más aún que allí, porque lo que contamina no
   es un reconocedor: es un F₀ y un HNR que van a un informe.
2. **Donde el altavoz calla, la pantalla no.** `VoiceAnalysis` y
   `ProsodyAnalysis` piden gata visible con el micrófono abierto. **Hoy eso es
   imposible por construcción** y es el conflicto principal de esta decisión:
   §5.
3. **`RoomNoiseCheck` no estaba en la matriz de la dirección y se añade aquí.**
   Es el tercer consumidor de micrófono del repositorio y mide **ruido de sala**:
   si Lúa emitiera durante esa medida, el sonómetro mediría a Lúa y calibraría la
   sala contra el propio periférico. Es la fila donde el error sería más difícil
   de ver después.

## 4. Lo que esto supera de `integracion-lua.md`

Aquel documento tiene un §3 titulado «la postura de VIA+: el control es la
ausencia», y su tabla dice, literalmente, que durante la medición VIA+ no hace
«ni refuerzo, ni espejo de turno, ni veredicto». Esta decisión dice lo contrario:
hay espejo, y en dos módulos hay sonido.

**No se borra aquel §3, y no por cortesía documental.** Lo que sostenía la
postura de la ausencia es un argumento que sigue en pie palabra por palabra:

> Un aviso que forma parte del procedimiento mueve a Lúa de accesorio a parte del
> acto clínico. Si el aparato se apaga y la exploración sigue igual, es un
> accesorio; si la maniobra depende de que el aviso llegue, no lo es. **VIA+ es
> SaMD Clase IIa.**

Las siete filas de la matriz no son iguales frente a ese criterio, y conviene
separarlas antes de que alguien las implemente todas con el mismo cuidado:

| Fila | ¿Se apaga Lúa y la exploración sigue igual? | Qué es entonces |
| :--- | :--- | :--- |
| `ResultadosFinal` | Sí | Accesorio. **Es lo único implementado hoy** |
| `VoiceAnalysis`, `ProsodyAnalysis` | Sí — apoyo visual, la medida es del micrófono | Accesorio, **si y solo si** nada de lo que dibuje entra en la medida |
| `ExecutiveFunctions` | La consigna inicial pregrabada, no | Parte del procedimiento |
| `AudiometryConditioned` | **No.** El refuerzo condicionado *es* el método | Parte del acto. Esto es un VRA |
| `DysphagiaTest` | **No**, si el modelo visual pauta la maniobra | Parte del acto |

Las tres últimas filas no son «lo mismo pero más»: cambian con qué figura entra
Lúa en el expediente técnico, y eso **no se decide en un `.md` de este
repositorio** — se decide con el análisis de riesgo delante y, llegado el caso,
con el organismo notificado. Registrarlo aquí es lo que evita que se implemente
por goteo, pantalla a pantalla, sin que nadie haya hecho esa pregunta una sola
vez.

Mientras tanto: **la fila de `ResultadosFinal` es la única que se puede
construir sin abrir esa conversación**, y ya está construida.

## 5. El permiso de ruido, y por qué no es el silencio clínico que ya existe

La dirección describe `noisePermit.ts`: un coordinador colgado de
`onRecordingSessionChange()` que **revoca el permiso de ruido** cuando la tableta
abre el micrófono. La intención es exactamente la correcta. El detalle que hay
que no perder es que **eso no es lo que hace hoy el código**, y la diferencia va
en la dirección peligrosa si se implementa sin mirar:

| | `clinicalSilence.ts` (hoy) | `noisePermit.ts` (propuesto) |
| :--- | :--- | :--- |
| Al abrirse el micrófono | `SAFE`/`CLINICAL_SILENCE`: revoca **toda** concesión y **bloquea** el aparato | Revoca **solo** la capacidad sonora |
| Al cerrarse el micrófono | No desbloquea nada. El `UNLOCK` es explícito | Presumiblemente vuelve a permitir |
| Efecto en la pantalla | La apaga: en `LOCKED` no hay concesión que valga | Ninguno: la gata sigue visible |

La matriz **necesita** la columna de la derecha —gata respirando durante la /a/
sostenida—, y la seguridad **necesita** la de la izquierda. Se resuelve con las
dos, no eligiendo:

- **El silencio clínico se queda como está, y se queda primero.** Es defensa en
  profundidad, es una escritura *con confirmación*, y es lo que cubre el caso de
  que alguien traiga el aparato puesto a una medición para la que nadie lo
  planeó. Sustituirlo por una revocación parcial sería cambiar un cierre por un
  permiso, que es justo el sentido contrario.
- **El permiso de ruido es una capacidad nueva, concedida aparte de la visual y
  caducando aparte**, para que exista un estado «puede dibujar, no puede sonar».
  Ese estado **no existe en el aparato**: hoy hay `REST`, `ACTIVE` y `LOCKED`, y
  ninguna capacidad separada. Es firmware y es protocolo, y ninguna de las dos
  cosas se decide en este repositorio (§6).
- **El orden no es negociable: el silencio gana siempre, y gana antes de que el
  zumbador pueda sonar una sola vez.** En términos de implementación: la
  capacidad sonora se concede solo desde un estado en el que se ha comprobado que
  no hay ninguna sesión de micrófono viva, y su caducidad es más corta que la
  visual, no más larga.

Sobre el **TTL de 3 s** de la propuesta, con una nota de historia: la primera
versión de `src/Lua/` de este repositorio usaba TTL de 3 s con renovación cada
1 s, y estaba **inventado**. Los números del aparato son 60 s de tope y latido
cada 10 s (`LUA_LIMITS`), así que aquel diseño habría dejado a Lúa en reposo
entre latido y latido. Un *dead-man's switch* de 3 s para el sonido es una idea
razonable —cuanto más corto, antes calla si se cae el enlace—, pero **exige un
latido más rápido que el que el firmware implementa hoy**, y eso hay que
decidirlo con el firmware delante y no aquí.

## 6. Las cuatro divergencias con el diseño ya cerrado en Valeria+

Esto es lo que impide escribir código de audio hoy, y no es burocracia: el
protocolo tiene **una sola** fuente, `firmware/lua/protocol.json` en
`FrankBetances/Valeria`, y las copias de este repositorio y del firmware se
generan de ella. Una quinta interpretación escrita a mano es exactamente el
error que ya se cometió una vez aquí (§1.1 de `integracion-lua.md`).

El plan de Valeria+ cerró el 13/8/2026 la decisión **D-F**, «Lúa suena». La
decisión de dirección del 14/8/2026 se aparta de ella en cuatro puntos:

| | D-F (cerrada, 13/8) | Dirección (14/8) | Consecuencia |
| :--- | :--- | :--- | :--- |
| **Qué suena** | Tonos de zumbador pasivo | **Locuciones pregrabadas** y sonidos | No es un incremento: es otro subsistema |
| **Cómo** | PWM en un pin del puerto de expansión | **DAC / I2S** | El ESP32-**C3 no tiene DAC**, e I2S son tres señales; el puerto de expansión es un SH1.0-4P. Hay que confirmarlo contra el esquemático — `board.h` avisa de que sus pines tampoco están confirmados |
| **Protocolo** | **Ningún opcode nuevo**: el tono se ata al opcode existente en una tabla del firmware | Característica **`AudioPlay`** con `[id_sonido, volumen]` | Con opcode nuevo, un aparato ya flasheado se queda atrás. Sin él, no hay forma de pedir una locución concreta |
| **Volumen** | Tope **en el firmware** | Parámetro **desde la app** | Un tope que viaja en cada trama es un tope que se puede perder |

La tercera fila merece leerse dos veces, porque la propuesta de la dirección es
**coherente** y la de D-F también, y son incompatibles: una locución pregrabada
no cabe en el enlace —GATT no es un transporte de audio—, así que tiene que vivir
en la flash del aparato e indexarse. Y en cuanto se indexa, hace falta decir
*cuál*, y eso es un opcode o una característica nueva. **Pedir locuciones y
prohibir opcodes nuevos no puede cumplirse a la vez.** Quien cierre esto tiene
que elegir, y la elección arrastra el hardware.

**Dónde se cierra:** en el plan de Valeria+, que es donde vive D-F, y de ahí baja
a `protocol.json`. No aquí, y tampoco en el repositorio del firmware: el
14/8/2026 quedó anotado allí que aparcar parches para Valeria+ en otro
repositorio no funciona —cuando llegó el momento de aplicarlos ya no aplicaban, y
además chocaban con opcodes decididos mientras tanto—.

## 7. En qué orden se desbloquea

1. **Cerrar las cuatro divergencias del §6 en el plan de Valeria+** y bajarlas a
   `protocol.json`. Sin esto no hay nada que implementar en ningún lado.
2. **Decidir la figura regulatoria de las tres filas «parte del acto» del §4**,
   con el análisis de riesgo delante. Esto es independiente de lo anterior y
   puede hacerse en paralelo; es lo que decide si `AudiometryConditioned` y
   `DysphagiaTest` llegan a implementarse.
3. **Firmware**: pin, tabla, y el cambio del gate `check-lua-mute.js` —que se
   cambia **en los dos repositorios o en ninguno**, porque el del firmware es
   copia del de Valeria+—. La parte del micrófono del gate no se toca nunca.
4. **VIA+**: refrescar `protocol.json`, regenerar, y entonces `noisePermit.ts`
   con el silencio clínico intacto por debajo (§5).
5. **El `BleManager` compartido**, que sigue pendiente de antes y sin el cual
   todo `src/Lua/` es *no-op* — Lúa y el pulsioxímetro lo esperan igual.

El punto 5 no depende de ninguno de los otros cuatro y es el único que hoy
separa a la recompensa de cierre de funcionar contra un aparato real.

## 8. Lo único que cambia hoy en el código

`src/Lua/protocol.json` se había quedado con **ocho** opcodes: los de la primera
tanda. El aparato contesta a **trece** desde el 13/8/2026. Refrescada la copia
vendorizada y regenerado `luaProtocol.ts`, entran los cinco del espejo:

| Opcode | | Para qué, en la matriz del §3 |
| :--- | :--- | :--- |
| `AFFECT` | `0x06` | Las ocho emociones. La gata atenta de `ProsodyAnalysis` sale de aquí |
| `PICTO` | `0x07` | La ficha del ejercicio en el panel |
| `AWARD` | `0x08` | Insignia: familia y rango, nunca su nombre |
| `LEVEL` | `0x09` | Nivel: doce segmentos en el anillo |
| `PICTO_PAIR` | `0x0A` | **Reservado.** El firmware todavía no lo dibuja |

**Tenerlos en la tabla no es enviarlos**, y VIA+ no envía ninguno todavía: quién
los manda y desde qué pantalla es el §4, que está sin decidir. Lo que se gana es
que la copia deje de mentir sobre lo que el aparato entiende — que es justo el
fallo que `protocol.json` avisa en su primera línea, y que no se manifiesta como
test rojo sino como una mascota haciendo cosas raras en la consulta.

Nada de audio. Ni un `AudioPlay`, ni un `noisePermit.ts`, ni un TTL de 3 s: eso
es el §6, y no está cerrado.
