# Lúa como periférico de SALIDA · espejo visual y alertas sonoras en VIA+

> **Revisado contra el plan de Valeria+ el 14/8/2026.** La primera versión de este
> documento se escribió sin el plan delante y acertó el problema pero no las
> cifras. Leído `docs/plan-integracion-lua.md`, cambian cuatro cosas y conviene
> saber cuáles: la capacidad sonora separada **sí está diseñada** (§5 del plan) y
> `GRANT` **ya lleva** un campo de capacidad que la tabla perdió por el camino
> (§5 de aquí); el volumen desde la app **ya estaba** en la D-F, por `CFG` (§6);
> el espejo puro es una decisión de Valeria+ y **no se aplica a VIA+** (§3.1); y
> lo que zanja el sonido no es el protocolo sino la placa: **voz y sonido
> muestreado son v2 y placa distinta**, y la única placa que los trae no puede
> animar una cara (§6).
>
> **Estado (14/8/2026):** decisión de dirección **registrada**, no implementada.
> Del lado del código solo está hecho lo que no necesita protocolo nuevo: la
> tabla de opcodes vendorizada, que se había quedado en ocho y ahora trae los
> trece del aparato (§8). **Ni una línea de audio, en ninguno de los tres
> repositorios**, y todavía no puede haberla: §6 dice por qué y §7 en qué orden
> se desbloquea.
>
> ✅ **Cerrados los dos: el sonido (D-K) y el permiso (D-L), 14/8/2026.** La voz
> la pone la tableta, y `GRANT` ya lleva máscara de capacidades con un `MUTE` en
> `SAFE` que silencia **sin apagar la pantalla** — el estado que este documento
> pedía en su §5 y que hoy ya existe en el enlace y en el firmware.
>
> **El sonido, en detalle: la voz la pone la tableta.** Lúa se queda con la cara, la placa no se mueve y **el
> altavoz del aparato desaparece de las siete filas de la matriz** (§3). Con eso
> caen `AudioPlay`, `noisePermit.ts`, el TTL de 3 s y cualquier cambio del gate
> de la mudez: no eran trabajo pendiente, y ahora directamente no existen. La
> fila que pedía locución de consigna **ya funcionaba** por `@/Voice`. Lo que
> sigue abierto de este documento es lo **visual**: el arte que no existe (§3.1),
> la clasificación regulatoria fila a fila (§4) y el campo de capacidad de `GRANT`
> (§5), que la D-K hace más necesario, no menos.
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
| **`ExecutiveFunctions`** | Avatar de juego y retroalimentación de bloque | **Silencio.** La consigna la locuta **la tableta** (`@/Voice`), y ya lo hace | No. Interacción táctil |
| **`VoiceAnalysis`** (/a/ sostenida) | Gata respirando hondo / cantando | **Silencio absoluto** | **Sí** · 48 kHz → F₀, jitter, shimmer, HNR, formantes |
| **`ProsodyAnalysis`** (habla continua) | Gata con cara atenta, escucha activa | **Silencio absoluto** | **Sí** · pausas, rango dinámico en semitonos |
| **`RoomNoiseCheck`** | — | **Silencio absoluto** | **Sí** · sonómetro |
| **`ResultadosFinal`** (cierre) | Animación de celebración | **Silencio.** El refuerzo hablado lo pone **la tableta** | No |

**La columna del altavoz se quedó entera en silencio, y no por prudencia: por la
D-K** (Frank, 14/8/2026, §14 del plan de Valeria+). La voz la pone la tableta y
Lúa se queda con la cara, así que en los siete módulos el aparato **no emite ni un
sonido**. Lo que era una regla que había que sostener módulo a módulo pasa a ser
una propiedad del aparato: en VIA+, Lúa es muda por decisión, no por
temporización. Las consecuencias están en §6, y son casi todas cosas que ya no hay
que construir.

Tres lecturas que no son evidentes en la tabla:

1. **Ningún módulo suena mientras el micrófono está abierto.** No es una
   coincidencia de las filas: es la regla clínica, y es la misma que rige en
   Valeria+ («Lúa no suena mientras la tableta escucha»). Un pitido encima del
   estímulo enmascara, y un pitido durante la captura entra en el micrófono y
   contamina la medida. Aquí pesa más aún que allí, porque lo que contamina no
   es un reconocedor: es un F₀ y un HNR que van a un informe. **Con la D-K esta
   regla deja de necesitar vigilancia en VIA+**: el aparato no puede violarla
   porque no tiene nada que emitir. Sigue escrita porque es la que explica por
   qué la columna es como es, y porque en Valeria+ —donde el zumbador sigue
   autorizado— sí hay que sostenerla.
2. **Donde el altavoz calla, la pantalla no.** `VoiceAnalysis` y
   `ProsodyAnalysis` piden gata visible con el micrófono abierto. **Hoy eso es
   imposible por construcción** y es el conflicto principal de esta decisión:
   §5.
3. **`RoomNoiseCheck` no estaba en la matriz de la dirección y se añade aquí.**
   Es el tercer consumidor de micrófono del repositorio y mide **ruido de sala**:
   si Lúa emitiera durante esa medida, el sonómetro mediría a Lúa y calibraría la
   sala contra el propio periférico. Es la fila donde el error sería más difícil
   de ver después.

### 3.1. Esto no es el espejo de Valeria+, y el plan lo dice de las dos formas

En Valeria+ el espejo está cerrado como **espejo puro** (D-G): «Lúa muestra la
misma imagen que ve el adulto en la tableta», y la consecuencia que el plan
subraya es que **ninguna de las siete pantallas clínicas se toca**. Eso funciona
allí porque el dibujo ya está en el aparato: los pictogramas, las insignias y los
niveles son los mismos activos, y por el cable viaja **el número**, no el dibujo.
El §10.1 del plan lo dice sin rodeos al presupuestar la flash:

> «Ninguna se dibuja nueva: es el mismo dibujo que ve el niño en la tableta, que
> es lo que significa espejo.»

**En VIA+ eso no se cumple, y por eso esto no es un espejo.** Lo que pide la
matriz del §3 no tiene contrapartida en el catálogo del aparato. Contado contra
el catálogo real —22 caras más tres fichas que no son caras, en
`core/include/lua/faces.h`—:

| Lo que pide la matriz | Qué hay hoy en el aparato |
| :--- | :--- |
| Gata atenta / escucha activa (prosodia) | ✅ `kExprAttentive`. Existe, es la de `PHASE(0)` |
| Gata respirando hondo (/a/ sostenida) | ✅ `kExprNeutral` — «la gata mira, respira». *Cantando*, no |
| Celebración de cierre | ✅ `kExprCelebrate`, `kExprSuccess` y el destello de la corona |
| Avatar de juego y retroalimentación de bloque | 🟨 caras hay; «avatar de juego» y «bloque» no significan nada para el aparato |
| **Modelo visual de postura y deglución** | ❌ no existe. Arte nuevo |
| **Maquinista del tren que avanza con la respuesta** | ❌ no existe. Arte nuevo **y** semántica nueva: no hay forma de decir «avanza un paso» |

Las dos últimas filas son las caras: no es que falte el dibujo —eso son 24×24 y
el 1 % de la flash, el §10.1 lo resolvió—, es que **falta qué byte lo pide**. El
catálogo tiene techo de 256 fichas y `PICTO` manda un índice; un tren que avanza
no es una ficha, es un estado con progreso.

Y hay una asimetría que conviene ver antes de dibujar nada: en Valeria+ el arte
del aparato **sube** a la app y sirve a las dos (D-J). Un modelo de deglución
dibujado para el cristal de 32 mm de Lúa no le sirve a ninguna pantalla de VIA+,
así que sería la primera vez que se dibuja arte **solo** para el aparato. No es
un impedimento; es una partida de trabajo que no aparece en ninguna estimación
todavía.

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

### 4.1. La buena noticia: cambiar la presencia no necesita permiso de Valeria+

El §8 del plan —el de «la integración correcta es la ausencia»— se cierra a sí
mismo con esta frase, que es fácil pasar por alto y aquí vale dinero:

> «Esta sección describe lo que VIA+ hace con Lúa. **No es una fuente de
> requisitos para Valeria+.** Nada de aquí baja a §1, §3, §5, §10 ni §11.»

Es decir: la postura de la ausencia es **de VIA+ sobre VIA+**, y moverla es
competencia de este repositorio y de su análisis de riesgo. No hay que negociarla
en Valeria+ ni esperar a que allí se cierre nada.

Lo que sí depende de Valeria+ es el **sonido**, porque eso sí baja: protocolo,
tabla y placa (§6). Separadas las dos cosas, la parte visual de esta decisión
—que es la mayor parte de la matriz— está desbloqueada hoy, con la salvedad de
que cuatro de las siete filas necesitan arte y semántica que no existen (§3.1) y
tres necesitan la conversación regulatoria del §4.

## 5. El permiso de ruido, y por qué no es el silencio clínico que ya existe

> **Reducido por la D-K (14/8/2026), y conviene ver hasta dónde.** Con la voz en
> la tableta, **`noisePermit.ts` deja de hacer falta**: no hay capacidad sonora
> que revocar en un aparato que no suena. Lo que **no** desaparece es la otra
> mitad de esta sección —el estado «dibuja pero no suena»—, y de hecho la D-K lo
> hace más necesario, no menos: VIA+ necesita que la gata esté **visible**
> durante la /a/ sostenida, y hoy `CLINICAL_SILENCE` bloquea el aparato entero.
> Lo que hay que recuperar en `protocol.json` es el campo de capacidad de `GRANT`;
> lo que ya no hay que escribir es el temporizador de ruido y su TTL de 3 s.

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
- **El permiso de ruido no hay que inventarlo: está diseñado desde el principio.**
  El §5 del plan —«capacidades por concesión, no interruptores»— dice que las
  capacidades son independientes (visual, sonora y de motor), que la sonora «se
  concede aparte de la visual, caduca igual, y el firmware topa el volumen aunque
  la app pida más», y remata con la frase exacta que esta matriz necesita:

  > «Que se conceda por separado es lo que permite —si algún día hiciera falta—
  > dejar a Lúa mostrando el pictograma y callada, **sin inventar un modo
  > nuevo**.»

  Lo que falta no es el diseño: es que **se perdió al escribir la tabla**. El
  §6.2 del plan declara `GRANT` con parámetros «**capacidad · ttl en s**», pero
  `protocol.json` —que es la fuente de la que se generan las tres copias— lo
  declara «ttl en segundos (1-60)» y anota «concede capacidad **visual**», y el
  firmware lee los 16 bits enteros como TTL. **El campo de capacidad existe en la
  prosa del plan y no existe en el enlace.** Es la misma clase de fallo que la
  discrepancia de `STATE` ya anotada en `integracion-lua.md` §2.2, y va al mismo
  sitio: se corrige en Valeria+, en el `.json`, y baja.

  Que quede ahí y no en un opcode nuevo importa: recuperar ese campo **cumple la
  D-F** —«no hay opcode nuevo»— y le da a VIA+ el estado «dibuja pero no suena»
  sin tocar la tabla.
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
decidirlo con el firmware delante y no aquí. *(Con la D-K esta discusión se
archiva: no hay sonido que temporizar. El número del latido sigue importando para
la capacidad visual, que es el punto 5 de la lista de Valeria+.)*

## 6. Las cuatro divergencias con el diseño ya cerrado en Valeria+

> ## ✅ **RESUELTO el 14/8/2026: la voz la pone la tableta (D-K)**
>
> Frank cerró la elección que esta sección dejaba abierta, y eligió la salida que
> el §6.1 recomendaba mirar primero: **tonos en la C3 —sin implementar— y la
> locución por el altavoz de la tableta**. Está escrito en el §14 del plan de
> Valeria+ como **D-K**, con su consecuencia en el §3.
>
> Las tres divergencias de la tabla de abajo **se cierran sin escribir nada**:
>
> | Divergencia | Cómo queda |
> | :--- | :--- |
> | Qué suena | Nada, en el aparato. La voz sale de la tableta |
> | Cómo | No aplica: sin salida de audio no hay PWM ni I2S que elegir |
> | Protocolo `AudioPlay` | **No entra.** `protocol.json` no se toca, y con él ninguna de las tres copias |
>
> **Lo que esto ahorra, que es el resultado de verdad:** no hay cuarta placa, no
> se rehacen los §2/§3/§4 del plan, no hay opcode nuevo, no hay `noisePermit.ts`,
> no hay TTL de 3 s y no hay que tocar `check-lua-mute.js` en ningún repositorio.
> **La fila de `ExecutiveFunctions` ya funciona hoy**: `speakConsigna()`, en
> `src/Screens/ExecutiveFunctions/efSpeech.ts`, locuta la consigna del dominio
> resolviendo texto y voz juntos en las cinco lenguas y degradando en silencio si
> no hay voz disponible.
>
> Lo que **no** cierra la D-K es el §6.1 de la lista de Valeria+ —el campo de
> capacidad de `GRANT`—, que es lo único que sigue separando a esta matriz de su
> parte visual. Ver §7.
>
> Lo de abajo se conserva como el razonamiento que llevó ahí, no como trabajo
> pendiente.

Esto es lo que impedía escribir código de audio, y no era burocracia: el
protocolo tiene **una sola** fuente, `firmware/lua/protocol.json` en
`FrankBetances/Valeria`, y las copias de este repositorio y del firmware se
generan de ella. Una quinta interpretación escrita a mano es exactamente el
error que ya se cometió una vez aquí (§1.1 de `integracion-lua.md`).

El plan de Valeria+ cerró el 13/8/2026 la decisión **D-F**, «Lúa suena», y el §3
la sostiene con una cuenta de pines que no es una preferencia de diseño:

| Vía de salida | Pines | Qué da | Coste |
| :--- | ---: | :--- | :--- |
| Zumbador pasivo por PWM | **1** | tonos, arpegios, un «tilín» de acierto | ninguno: cabe hoy en la placa elegida |
| DAC interno + amplificador I2C | 2 | muestras cortas, calidad pobre | ocupa el puerto entero |
| **Códec I²S + altavoz** | **3+** | **voz y sonido real** | **exige otra placa** |

La placa de v1 es la **ESP32-2424S012** (ESP32-C3, 4 MB de flash, panel GC9A01),
y su puerto de expansión es **un** SH1.0-4P: 3V3, GND y **dos I/O**. Eso es todo
lo que hay. El plan lo resume en una línea: «para I²S —BCLK, WS, DOUT— no llegan
ni los tres pines mínimos», y la D-F concluye que **voz y sonido muestreado son
v2 y placa distinta**.

Con eso delante, las divergencias reales son estas tres —una menos de las que
esta sección decía antes de leer el plan—:

| | D-F (cerrada, 13/8) | Dirección (14/8) | Estado |
| :--- | :--- | :--- | :--- |
| **Qué suena** | Tonos de zumbador pasivo | **Locuciones pregrabadas** | Divergencia real, y es la que arrastra todo |
| **Cómo** | PWM, **1 pin** | DAC / I2S | Divergencia real: I2S no cabe en la placa de v1 |
| **Protocolo** | **Ningún opcode nuevo**: el tono va atado al opcode existente | `AudioPlay` con `[id_sonido, volumen]` | Divergencia **derivada**: solo hace falta si hay locuciones |
| **Volumen** | Tope en firmware; **el adulto lo ajusta por `CFG`**, y el 0 es legítimo | Parámetro desde la app | ~~Divergencia~~ **No lo es.** La D-F ya da volumen a la app; lo que cambia es *dónde* viaja |

La fila del volumen la tenía mal este documento: la D-F dice literalmente que
«el adulto lo ajusta por `CFG` desde la tarjeta de Ajustes, y **el 0 es un valor
legítimo**: hay niños con hiperacusia y sesiones donde el sonido sobra». La app
manda volumen, y el firmware topa. Lo único que habría que discutir es si viaja
como preferencia en `CFG` —como está— o como byte en cada trama de reproducción,
y esa es una conversación pequeña.

### 6.1. La que no tiene salida por protocolo: la placa que suena no puede animar una cara

Esta es la que zanja el asunto, y no se ve mirando el protocolo. La única de las
tres placas estudiadas que trae el códec I²S y el altavoz es la **e-Paper S3**
(ES8311, RTC, microSD, 8 MB de PSRAM). Y el plan la descarta como Lúa por un
motivo que el sonido no arregla:

> «**Refresco de 15 s en modo rápido, 20 s completo.** Una cara que tarda quince
> segundos en sonreír no es refuerzo inmediato; es otra cosa.»

Con lo cual, de las placas que hay sobre la mesa:

| | Cara animada 240×240 | Locuciones |
| :--- | :---: | :---: |
| ESP32-C3 · IPS circular (v1) | ✅ 20-30 fps | ❌ solo tonos, 1 pin |
| ESP32-S3 · e-Paper | ❌ 15-20 s por refresco | ✅ ES8311 |

**Ninguna hace las dos cosas**, y la matriz del §3 las pide juntas —gata
respirando *y* locución de consigna—. Eso deja tres salidas, y las tres son
decisiones de dirección, no de código:

1. **Tonos en v1 y ya** (la D-F tal cual). La consigna hablada no sale de Lúa.
2. **Una cuarta placa** que traiga panel rápido y códec. No está estudiada: abrir
   esa puerta obliga a rehacer los §2, §3 y §4 del plan —el presupuesto de
   latencia no contempla audio— y mueve el calendario entero.
3. **La consigna la dice la tableta.** Es la que recomiendo mirar primero, y la
   más barata con diferencia: VIA+ **ya tiene** el banco de locuciones y el motor
   que las reproduce (`@/Voice`: `viaVoiceConsignas.ts`, `viaVoicePlayback.ts`,
   `VOICE_ASSETS`), y la matriz de la dirección ya lo cita entre paréntesis en esa
   misma fila. Con la consigna en la tableta, Lúa se queda con la cara —que es lo
   que la placa hace bien— y el sonido sale por donde ya está calibrado el resto
   del audio de la app. Cuesta cero hardware, cero flash y cero opcodes.

La opción 3 no cubre el caso que de verdad quería la dirección con sonido en el
aparato —el niño que **no mira la tableta**, que es el argumento con el que nació
todo esto— pero sí cubre las dos filas de la matriz que piden locución, porque en
las dos el niño está atendiendo a la tarea de la tableta.

**Dónde se cierra:** en el plan de Valeria+, que es donde viven la D-F y la
decisión de hardware, y de ahí baja a `protocol.json`. No aquí, y tampoco en el
repositorio del firmware: el 14/8/2026 quedó anotado allí que aparcar parches
para Valeria+ en otro repositorio no funciona —cuando llegó el momento de
aplicarlos ya no aplicaban, y además chocaban con opcodes decididos mientras
tanto—.

### 6.2. Un detalle de la tabla de pines que hay que confirmar, no dar por bueno

La fila del medio —«DAC interno + amplificador I2C, 2 pines»— conviene revisarla
antes de contar con ella: **el ESP32-C3 no lleva el periférico DAC** que sí
tienen el ESP32 clásico y el S2. Lo más parecido que da el C3 es el modulador
sigma-delta, que con filtro y amplificador saca audio pobre por un pin. Si eso se
confirma, la tabla de tres filas se queda en **dos** —tonos por un pin, o cambiar
de placa— y desaparece la opción intermedia que hoy parece existir.

No lo doy por cerrado: no he mirado la hoja de datos, y el plan sostiene la fila.
Pero es exactamente el tipo de dato que hay que confirmar antes de que alguien
diseñe contra él, igual que `board.h` avisa de que sus propios seis pines están
sin confirmar contra el esquemático.

## 7. En qué orden se desbloquea

Separado por quién manda en cada cosa, que es lo que la lectura del plan aclaró:

**Lo que decide VIA+ solo, hoy, sin hablar con nadie** (el §8 del plan se declara
no vinculante para Valeria+, §4.1):

1. **Mover la postura de la ausencia** en el análisis de riesgo de este
   repositorio, fila a fila del §4. Es la puerta de todo lo visual.
2. **El `BleManager` compartido**, pendiente de antes y sin el cual todo
   `src/Lua/` es *no-op*. No depende de nada de lo de abajo y es lo único que hoy
   separa a la recompensa de cierre de funcionar contra un aparato real. Lo
   espera también el pulsioxímetro.

**Lo que hay que cerrar en Valeria+ antes de que exista** — los ocho puntos están
desglosados, con su cita y sin convertirlos en parches, en
[`docs/pendiente-en-valeria.md`](https://github.com/FrankBetances/lua-firmware/blob/main/docs/pendiente-en-valeria.md)
del repositorio del firmware. **Es la lista que hay que darle al agente cuando se
abra una sesión con Valeria+:**

3. ~~**La placa, que es la decisión de verdad del sonido**~~ — ✅ **CERRADA
   (Frank, 14/8/2026 · D-K): la consigna la dice la tableta.** Con eso,
   `AudioPlay`, el TTL del permiso de ruido y el volumen por trama **dejan de ser
   trabajo pendiente y pasan a no existir**. Este punto ya no bloquea nada.
4. ~~**Recuperar el campo de capacidad de `GRANT` en `protocol.json`**~~ — ✅
   **CERRADO Y APLICADO (14/8/2026 · D-L).** TTL en el byte bajo, máscara en el
   alto (`LUA_CAP.VISUAL`, `LUA_CAP.SOUND`), y una operación `MUTE` en `SAFE` que
   quita el sonido dejando la pantalla viva. Sin opcode nuevo, así que cumple la
   D-F. Bajado ya a las tres copias; en este repositorio `luaGrant()` concede solo
   la visual y `luaMute()` existe. **Lo que sigue siendo del §4 y no de esto: que
   VIA+ lo use durante las capturas.**
5. **De paso, las otras dos discrepancias de origen ya anotadas**: `STATE` dice
   publicar batería y capacidades vivas y publica cara, fps y microsegundos; y el
   latido renueva al máximo en un firmware y al TTL concedido en el otro —abierto
   en el §5 del plan, y es el número del que depende cualquier TTL corto—.

**Lo que solo entonces tiene sentido escribir:**

6. ~~**Firmware**: pin, tabla de tonos, y el cambio del gate~~ — **cae con la
   D-K.** No hay salida de audio que escribir, así que `check-lua-mute.js` se
   queda como está en los dos repositorios. El micrófono no se toca nunca, y eso
   no dependía de esta decisión ni de ninguna otra.
7. **VIA+**: refrescar `protocol.json` y regenerar, cuando el punto 4 baje. ~~y
   entonces `noisePermit.ts`~~ — **tampoco hace falta**: sin capacidad sonora que
   revocar, el silencio clínico se queda solo, que es como está hoy.
8. **El arte que no existe** (§3.1): el modelo de deglución y el tren. Es la
   primera partida de dibujo que sería solo del aparato, y no está estimada.
   **Es, con el punto 1, lo que de verdad queda abierto de todo este documento.**

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
