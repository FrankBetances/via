# Plan de mejora de la app · VIA+ (ejecución con Sonnet)

> **Fecha:** 15/11/2026 · **Base analizada:** rama `claude/tender-mccarthy-j6yahp`, commit `2e1e918`.
> **Revisado el 17/11/2026** contra el código: tres caminos de lectura (H2), alcance real de H3,
> consentimiento en el PDF (H3 bis), fuga de toasts en el gate de textos (H6) y esfuerzo por paquete.
>
> **Qué es esto.** Un plan de ingeniería para mejorar la app que ya existe, troceado en paquetes
> cerrados para que los ejecuten sesiones de Claude Sonnet. No sustituye a
> [`PLAN-DE-TRABAJO.md`](./PLAN-DE-TRABAJO.md), que es el plan **del producto** (llave en mano,
> F0–F6): lo complementa por debajo, y dice dónde encaja cada paquete en aquellas fases.
>
> **Supuesto.** «Con Sonnet» se ha leído como «plan que ejecutará Sonnet». Si lo que se pedía era
> otra cosa, el diagnóstico del §2 sigue valiendo y solo cambia el §3.

## 0. Lo que este análisis NO ha comprobado

- **No se ha ejecutado ningún gate.** El contenedor de esta sesión no tiene `node_modules`: ni
  `tsc`, ni `jest`, ni `eslint` se han corrido. Todo lo de abajo sale de **leer el código** y de
  contarlo con `grep` y `wc`.
- **No se ha compilado ni visto la app.** Sin SDK de Android (regla 8 de `CLAUDE.md`).
- Los recuentos por `grep` son aproximados cuando así se indica. Los hallazgos con ruta y línea
  están leídos en el fichero.
- Ningún corte clínico de este documento es una propuesta: donde hay dos cifras en conflicto, se
  **señala** el conflicto y la decisión es de Frank.

---

## 1. Tesis

La app no necesita módulos nuevos: necesita que lo que ya tiene **sea fiable y demostrable**. El
código tiene 62 840 líneas en `src/` y 94 ficheros de test, pero la cobertura está muy
descompensada: la lógica de audio y de voz está vigilada, y **la capa que guarda y lee los datos
clínicos no tiene ni un test**. Los cinco riesgos que más pesan, por orden:

1. **Un mismo resultado se pinta con cortes distintos según la pantalla** (T.A.R.).
2. **Un módulo que falla al leerse desaparece del resultado sin aviso.**
3. **El esquema de la base de datos lo gestiona `synchronize: true`**, sin migraciones activas.
4. **Datos identificativos en claro** y base sin cifrar (ya declarado en el README; es la F2).
5. **Nada se ha recorrido en dispositivo**, y eso no lo arregla ningún paquete de software.

---

## 2. Diagnóstico

### 2.1 Medidas

| Zona | Líneas (sin tests) | Ficheros de test |
| --- | --- | --- |
| `src/Screens/` | 38 318 | 50 |
| `src/I18n/` | 6 708 | 2 |
| `src/PDF/` | 4 863 | 7 |
| `src/Models/` | 1 930 | **0** |
| `src/Repositories/` | 1 440 | **0** |
| `src/Services/` | 785 | **0** |
| `src/Database/` | 697 | **0** |

Pantallas **sin ningún test**: `AutismScreening` (795 líneas), `DysphagiaTest` (1 131),
`SahsScreening` (1 181), `Consentimiento` (629), `RegistroProfesional` (616),
`SeleccionProfesional` (689), `RegistroPaciente`, `Pacientes`, `HistorialPaciente`.

### 2.2 Hallazgos (hechos, con su evidencia)

**H1 · Dos juegos de cortes para el T.A.R.** La pantalla del módulo colorea con 85 / 60
(`src/Screens/Articulation/ArticulationTestScreen.tsx:274-277`); las tarjetas de resultados con
90 / 70 (`src/Screens/ResultadosPreliminares/evaluationResults.ts:252` y
`src/Screens/ResultadosFinal/ResultadosFinalScreen.tsx:643` y `:659`). Un 87 % sale verde al
terminar la prueba y ámbar en el resumen. Ninguno de los cuatro está en
`src/PDF/nlgThresholds.ts`. Es exactamente el caso que `CLAUDE.md` describe como «un umbral
clínico vive en UN sitio». *Cuál de los dos es el correcto, y de qué fuente sale, no consta.*

**H2 · Los resultados se leen por tres caminos distintos.** `evaluationResults.ts` se creó,
según su propia cabecera, para que «ampliar la batería» no obligara «a tocar dos sitios». Hoy hay
tres:

- `evaluationResults.ts` arma las tarjetas de Resultados preliminares e Historial;
- `ResultadosFinalScreen.tsx` relee los once repositorios para la síntesis (líneas 437-447) y
  otra vez para sus propias tarjetas (477-793);
- **el PDF lee por su cuenta**: `src/PDF/templates/Report.ts` importa los repositorios
  directamente.

Lo que se ve en pantalla y lo que se firma en el PDF pueden divergir. Es la causa estructural de
H1 y del fallo de ASHA del 2/11/2026.

**H3 · En las tarjetas, un módulo que no se puede leer desaparece en silencio.** El fallo de
lectura de un módulo se queda en `console.warn` (`evaluationResults.ts:79`,
`ResultadosFinalScreen.tsx:416`). El clínico ve un resumen con una prueba menos y nada le dice que
falta. Incumple la regla 4 («`console.warn` no es informar») en la pantalla que cierra la
evaluación.

*Lo que NO es silencioso:* la síntesis NLG. Su lectura es todo o nada, activa `nlgReadFailed` y la
pantalla lo pinta (`ResultadosFinalScreen.tsx:852`). No hay que tocarla por este motivo.

**H3 bis · El PDF puede salir sin la constancia del consentimiento, sin avisar.** Si
`Report.ts` no puede leer el consentimiento, omite la línea «Consentimiento informado … firmado
el … por …» y el error solo va a `console.warn` (`src/PDF/templates/Report.ts:132-135`; el
comentario dice «el informe no debe fallar por no poder leer el consentimiento»). Que no falle es
razonable; que salga **sin decirlo** no. Es el único hallazgo con consecuencia regulatoria directa
sobre un documento que sale de la consulta.

**H4 · Esquema por `synchronize: true`.** `src/Database/config.ts:50`, con `migrations: []`. Hay
nueve migraciones escritas en `src/Database/migrations/` y **ninguna registrada**; diez entidades
no tienen migración. Con `synchronize`, un cambio de columna lo resuelve TypeORM al arrancar, sin
control y sin prueba. *Riesgo, no fallo observado*: no consta ninguna pérdida de datos.

**H5 · Identificadores en claro.** `nameEnc` y `dobEnc` guardan texto plano
(`src/Models/Patient/Patient.ts:74-88`), `viaplus.db` no está cifrada. El README lo declara. No
hay registro de auditoría ni borrado verificable (README, *Controles de seguridad*). No se ha
encontrado bloqueo por inactividad ni límite de intentos de contraseña (búsqueda por `grep`, no
exhaustiva).

**H6 · Textos de interfaz fuera del catálogo.** `check-ui-strings.js` solo mira el texto JSX y
una lista de props visibles (`VISIBLE_PROPS`) de los `.tsx`. Se le escapan dos cosas.

*Argumentos de función:* **43 llamadas** a `showSuccessToast`/`showErrorToast`/`Alert.alert` con
texto literal, repartidas en 20 pantallas (de 2 a 4 por pantalla; recuento por `grep`). Se ven en
castellano en cualquier lengua y el gate no puede verlas.

*Ficheros `.ts`:*
Recuento aproximado de literales en castellano en ficheros `.ts` que acaban en pantalla:
`clinicalAssessmentResult.ts` (25), `ashaMilestones.ts` (24), `executiveFunctionsGame.ts` (15),
`audioSelfTest.ts` (12), `orbitModules.ts` (12), `moduleCards.ts` (11), `sahsScreeningResult.ts`
(8), `evaluationResults.ts` (8), `prosodyResult.ts` (8). Una sesión en gallego o euskera ve esos
títulos en castellano.

**H7 · El README se contradice con el plan del producto.** La tabla de controles tiene una fila
«Aislamiento Kiosk y firmware congelado · 🟢 Especificación homologada» y, más abajo, la misma
medida como «🔴 Planificado (F3)». El título «SaMD sobre Hardware Homologado» usa la palabra que
`PLAN-DE-TRABAJO.md` §2 pide no usar. Es documentación externa: un evaluador lo lee.

**H8 · Accesibilidad.** 35 `accessibilityLabel` para unos 121 `Pressable`/`TouchableOpacity`
(recuento por `grep`). No hay auditoría hecha; el número solo dice que hay que hacerla.

**H9 · Pantallas de más de 900 líneas con lógica dentro.** `ResultadosFinalScreen` (1 987),
`ClinicalAssessmentScreen` (1 402), `ArticulationTestScreen` (947), `SahsScreeningScreen` (930),
`DysphagiaTestScreen` (917). La de disfagia y la de SAHS no tienen ni un test: su lógica clínica
no se puede probar sin extraerla.

**H10 · El documento del incidente de Lúa está desfasado.**
[`incidente-2026-11-03-pie-lua.md`](./incidente-2026-11-03-pie-lua.md) da el punto 1 como
«Pendiente», pero el pie y la descripción se quitaron en `5a27b95` y `b696f7f`. Los puntos 2
(build con la corrección) y 3 (`CLAUDE.md` de `lua-firmware`) siguen abiertos. **Va antes que
cualquier paquete de este plan** (regla 0 bis).

### 2.3 Lo que ya estaba abierto y sigue igual

No se repite aquí: está en `CLAUDE.md` § *Pendiente* y en el README § *Lo que sigue abierto*.
Lo que este plan toma de esa lista: ruido de sala en el informe, `react-native-ble-plx`,
recorrido en emulador. Lo que **no** toca: prosodia (falta la URL de referencia), *input preset*
del micrófono (nativo), causa del build mudo, lista de Gemini.

---

## 3. Cómo se trabaja con Sonnet

### 3.1 Reparto

| Trabajo | Quién |
| --- | --- |
| Paquetes cerrados de TypeScript con criterio de salida ejecutable (tests, extracción de lógica, unificación) | Sonnet |
| Decisiones clínicas, de texto visible y de producto | **Frank**, antes de abrir el paquete |
| Nativo (`android/`, parches de librería, cifrado de la base, Keystore) | No se delega a ciegas: sesión dedicada, entrega marcada «escrito, no compilado», y build de Frank |
| Verificación en emulador | Frank; ninguna sesión puede |

El criterio del reparto no es la capacidad del modelo, sino **qué se puede comprobar desde una
sesión sin SDK**. Lo que solo se demuestra en dispositivo no se da por hecho lo escriba quien lo
escriba.

### 3.2 Formato de cada paquete

Cada paquete se abre en una sesión nueva con este encargo, y nada más:

1. **Objetivo** en una frase y **ficheros que puede tocar** (lista cerrada).
2. **Qué no puede tocar**: `src/I18n/`, cualquier `.tsx` en lo que se ve, `assets/`, `site/`
   (lo vigila el hook de la regla 0 bis), `android/`, `src/Screens/ProsodyAnalysis/`, cualquier
   cifra de `nlgThresholds.ts`.
3. **Criterio de salida**: el test nuevo que debe existir y que **falla sin el cambio**, más los
   diez gates de `CLAUDE.md` §2 en verde.
4. **Condición de parada**: si para terminar hace falta una decisión, un texto nuevo o tocar algo
   de la lista 2, la sesión **para y pregunta**. No resuelve por su cuenta.
5. **Entrega**: primera línea, qué cambia en pantalla («nada» si es así); después, qué se
   comprobó y con qué, y qué no.

Un paquete, una rama, un push (regla 6). Tamaño orientativo: lo que cabe en una sesión sin
compactar contexto; si no cabe, se parte antes de empezar.

### 3.3 Riesgos de delegar, y su freno

- **Tests que validan la suposición del autor** (regla 3). Freno: el criterio de salida exige
  comprobar que el test falla sin el cambio, y decirlo en la entrega.
- **«Mejorar» el texto de al lado** (regla 0 bis). Freno: el hook y la lista cerrada de ficheros.
- **Refactor que cambia el aspecto sin que nadie lo vea.** Freno: los paquetes de extracción
  mueven lógica, no JSX; lo que toque JSX se entrega como «no visto en pantalla».
- **Verde como sinónimo de hecho** (regla 0). Freno: la plantilla de entrega del punto 5.

---

## 4. Paquetes

Leyenda de **visible**: *no* = no cambia nada en pantalla · *sí* = cambia algo que el usuario ve
y por tanto necesita el visto bueno previo de Frank.

Esfuerzo, entre corchetes al final de cada paquete (**estimación**, no medida): **[S]** cabe en
una sesión corta · **[M]** ocupa una sesión entera · **[L]** no cabe en una sesión y se parte en
varios paquetes antes de empezar. Lo que dependa de Frank o del emulador no cuenta en el tamaño.

### Fase 0 · Deudas previas (antes de nada)

| Id | Paquete | Visible | Necesita de Frank |
| --- | --- | --- | --- |
| P0.1 | Cerrar el incidente de Lúa: actualizar su tabla de estado, lanzar `workflow_dispatch` y comprobar APK y AAB, corregir el `CLAUDE.md` de `lua-firmware` **[S]** | no | Confirmar que la pantalla queda sin pie; el estado real del aparato para el punto 3 |
| P0.2 | ~~Ejecutar los diez gates sobre `main`~~ **Hecho el 17/11/2026 sobre `2e1e918` (= `main`)**: los diez en verde, con `npm ci --legacy-peer-deps` como el CI. `tsc` limpio; `jest` 94 suites, 1188 tests; `eslint` 0 errores y 0 avisos; los siete scripts y `lint:md` sin fallos. Dice que el código compila y pasa sus tests, **no** que la app funcione en dispositivo **[S]** | no | Nada |

### Fase A · Una sola verdad para los resultados

Es la de mayor valor por coste: arregla H1–H3 bis y no depende del dispositivo ni del
organismo notificado. **A0 va el primero**: es el único paquete con consecuencia regulatoria
directa.

| Id | Paquete | Visible | Necesita de Frank |
| --- | --- | --- | --- |
| A0 | Consentimiento en el PDF (H3 bis): si no se puede leer, el informe lo dice en la portada en vez de omitir la línea; test que reproduce la lectura fallida y comprueba que el aviso sale **[M]** | **sí** (texto nuevo en el PDF) | El texto del aviso, en las cinco lenguas; y si un PDF sin consentimiento legible debe poder **finalizarse** o solo exportarse como borrador |
| A1 | Cortes del T.A.R. a `nlgThresholds.ts`, usados por las cuatro líneas de H1; test de paridad como el de `nlgReportEngine.test.ts` **[S]** | **sí** (un color cambiará en una de las dos pantallas) | **Decidido (15/11/2026): porcentaje con semáforo.** Al abrir el paquete falta una sola cifra: qué corte único usan las cuatro líneas (hoy 85/60 y 90/70, ambos sin fuente en el repositorio) |
| A2 | Barrido de cortes numéricos sueltos en `src/Screens/**` y `src/PDF/**` fuera de `nlgThresholds.ts`; solo **informe**, sin cambios **[S]** | no | Decidir uno a uno los que aparezcan |
| A3 | Una sola lectura de la sesión para los tres consumidores de H2: `ResultadosFinalScreen` y `Report.ts` dejan de leer los repositorios por su cuenta. Test que falla si la pantalla y el PDF no recogen los mismos módulos. Se parte en A3a (pantalla) y A3b (PDF) **[L]** | no (razonado, no visto) | Nada |
| A4 | Estado observable de «módulo no leído» en la lectura única de A3, que devuelve también la lista de módulos que fallaron. No toca la síntesis NLG, que ya informa (H3) **[M]** | no | Nada |
| A5 | Pintar ese estado en Resultados preliminares, Resultados finales, Historial y el PDF **[S]** | **sí** (aviso nuevo) | El texto del aviso, en las cinco lenguas |
| A6 | Test de registro de módulos: toda entidad de módulo de `config.ts` tiene lectura en `evaluationResults.ts` o una excepción escrita con motivo **[S]** | no | **Decidido (15/11/2026): `ClinicalAssessment` lleva tarjeta.** Falta aprobar su título y su texto, que son visibles |

### Fase B · La capa de datos, con red

| Id | Paquete | Visible | Necesita de Frank |
| --- | --- | --- | --- |
| B1 | Banco de pruebas de persistencia en Node: los repositorios reales contra SQLite en memoria, con el driver `sqljs` de TypeORM como dependencia de desarrollo (JS puro, no entra en el APK). Los 17 repositorios importan `AppDataSource` directamente, así que el banco sustituye `@/Database/config` con `jest.mock`. TypeORM 0.3.30 trae el driver y los tipos de columna son de SQLite; **que funcione está por verificar** en el propio paquete **[M]** | no | **Aceptada (15/11/2026)** |
| B2 | Tests de ida y vuelta por repositorio (guardar → leer → mismos datos), incluidos `null` de umbrales y `noResponseAtMax` **[L]** | no | Nada |
| B3 | Test de `writeWithVerify` (plazo vencido con fila guardada, plazo vencido sin fila) **[S]** | no | Nada |
| B4 | Migración de línea base que reproduce el esquema actual, registrada, con test que compara el esquema por migraciones con el de `synchronize` **[M]** | no | Nada |
| B5 | Apagar `synchronize` **[S]** | no | **Sí**: solo tras B4 en verde **y** una prueba de Frank sobre una base con datos reales en el emulador. Hasta entonces no se toca |

B5 es el único paquete de esta fase que puede perder datos si sale mal. Se deja explícitamente
fuera de la ejecución autónoma.

### Fase C · Lógica clínica sin test

Extracción **sin cambiar comportamiento ni texto**: la lógica sale de la pantalla a un `.ts`
puro y se le pone test. Cada paquete lee antes la fuente clínica citada en el propio código.

| Id | Paquete | Visible |
| --- | --- | --- |
| C1 | Disfagia (MECV-V): veredicto y recomendación fuera de `DysphagiaTestScreen.tsx` **[M]** | no |
| C2 | SAHS: tests de `sahsScreeningResult.ts` y extracción de lo que quede en la pantalla **[M]** | no |
| C3 | M-CHAT-R: puntuación y bandas, con los cortes ya presentes en `nlgThresholds.ts` **[S]** | no |
| C4 | Consentimiento: regla de menor de edad y de firmante **[S]** | no |
| C5 | Acceso del profesional: alta, verificación de contraseña, perfil antiguo sin contraseña **[M]** | no |

Si al extraer aparece una discrepancia (un corte que no cuadra con la matriz, una rama que cae
en el caso favorable sin dato), **no se arregla en el paquete**: se informa y se abre otro.

### Fase D · Seguridad y privacidad (F2 del plan del producto)

| Id | Paquete | Quién | Necesita de Frank |
| --- | --- | --- | --- |
| D1 | Informe de viabilidad: cifrado de `viaplus.db` con `react-native-nitro-sqlite` y custodia de clave. Solo lectura de fuentes; sin código **[S]** | Sonnet | Nada |
| D2 | Primitivas en TypeScript puro (HMAC-SHA256 del NHC, AES-256-GCM de nombre y fecha) comprobadas contra el `crypto` de Node, como ya se hizo con PBKDF2 **[M]** | Sonnet | Nada |
| D3 | Custodia de la clave en el almacén del sistema **[L]** | Sesión dedicada, nativo | Elegir la librería; mirar antes qué usa Valeria+ (regla 1) |
| D4 | Cablear D2 + D3 en `Patient`, con migración de las filas en claro y fallo **visible** si la clave no abre **[L]** | Sesión dedicada | Texto del error; prueba en emulador |
| D5 | Límite de intentos y bloqueo por inactividad **[M]** | Sonnet (lógica) | Política: cuántos intentos, cuánto tiempo, y los textos |
| D6 | Registro de auditoría local (acceso, cierre de evaluación, exportación de PDF, borrado) **[M]** | Sonnet | Qué eventos y si aparece en algún sitio |
| D7 | Medir el coste de las 10 000 iteraciones de PBKDF2 en Hermes **[S]** | Frank, en emulador | — |

`site/privacidad.html` y la tabla de controles del README **no se tocan** hasta que D4 esté
comprobado en dispositivo.

### Fase E · Interfaz

Toda esta fase cambia lo que se ve: cada paquete empieza con la lista de cambios aprobada.

| Id | Paquete | Necesita de Frank |
| --- | --- | --- |
| E1 | Ampliar `check-ui-strings.js` (o un gate hermano) a las dos fugas de H6: argumentos de texto de toasts y `Alert.alert`, y los `.ts` que alimentan pantallas. Primero en modo informe, para tener el recuento real **[M]** | Nada (no cambia textos) |
| E2 | Migrar esos literales al catálogo, módulo a módulo. En castellano el texto no cambia; en gl, eu, ca y en **aparece texto nuevo** **[L]** | Traducciones revisadas por quien firmó cada lengua |
| E3 | Auditoría de accesibilidad: informe con lista de controles sin etiqueta, objetivos táctiles y contraste **[M]** | Nada |
| E4 | Aplicar E3 **[M]** | Las etiquetas son texto: aprobación previa |
| E5 | Ruido de sala en el modelo y en el PDF **[M]** | **Decisión de producto pendiente**; no se abre sin ella |

### Fase F · Estructura y limpieza

| Id | Paquete | Necesita de Frank |
| --- | --- | --- |
| F1 | Partir `ResultadosFinalScreen` y `ClinicalAssessmentScreen` en componentes, tras A3 y con los tests de C como red **[L]** | Ver el resultado en emulador |
| F2 | Reducir los 66 `any` empezando por los repositorios y los adaptadores nativos **[M]** | Nada |
| F3 | Alinear el README con `PLAN-DE-TRABAJO.md` §2 (H7) **[S]** | Aprobar la redacción: es documentación externa |
| F4 | `react-native-ble-plx`: quitarla o cablearla **[M]** | **Decisión de producto pendiente** |

### Fase G · Verificación en dispositivo (no delegable)

Ningún paquete de software cierra esto. Lo que sí se puede preparar:

| Id | Paquete | Quién |
| --- | --- | --- |
| G1 | Guion de recorrido de los trece módulos: pasos, qué debe verse, qué anotar, con casilla por paso **[M]** | Sonnet lo redacta; Frank lo aprueba |
| G2 | Recorrido en el emulador con el guion, empezando por «Exportar PDF» y el selector de carpetas **[L]** | Frank |
| G3 | Cada fallo del recorrido entra como paquete nuevo con su captura | — |

---

## 5. Orden y dependencias

```
P0.1 ─► P0.2 ─┬─► A0 ─► A1 ─► A3a ─► A3b ─► A4 ─► A5 ─► A6
              ├─► A2
              ├─► B1 ─► B2 ─► B3 ─► B4 ─► (B5, con Frank)
              ├─► C1…C5  (independientes entre sí)
              ├─► D1 ─► D2 ─► (D3, D4 nativo) · D5 · D6
              ├─► E1 ─► E2 · E3 ─► E4
              └─► G1 ─► G2 ─► G3
F1 después de A3 y C · F2 después de B2
```

**Recomendación de arranque.** P0.1, P0.2 y después la fase A entera, **empezando por A0**: un
PDF que pierde la constancia del consentimiento sin decirlo pesa más que un color incoherente.
A1 necesita una sola cifra de Frank (el corte del T.A.R.) y elimina una incoherencia que hoy
puede verse en el mismo informe. En paralelo, B1–B3, C1–C5 y G1 no cambian nada visible y no requieren decisiones:
son los que se pueden lanzar ya.

**No se recomienda** empezar por la fase F (estética del código) ni por E2 (traducciones): su
valor es real, pero ninguna reduce el riesgo clínico o de datos, y E2 consume revisores.

---

## 6. Lo que Frank tiene que decidir

1. Incidente de Lúa: ¿la pantalla queda sin pie? ¿Qué se escribe en el `CLAUDE.md` del firmware?
2. ~~T.A.R.~~ Porcentaje con semáforo (15/11/2026). Queda fijar el corte único al abrir A1:
   hoy conviven 85/60 y 90/70, los dos sin fuente en el repositorio.
3. ~~¿`ClinicalAssessment` debe tener tarjeta en los resultados?~~ Sí (15/11/2026).
4. ~~¿Se acepta `sqljs` como dependencia de desarrollo?~~ Sí (15/11/2026).
5. Política de acceso: intentos, inactividad, recuperación de contraseña.
6. Ruido de sala en el informe: ¿consta o no?
7. `react-native-ble-plx`: ¿entra en esta versión?
8. ¿Quién revisa los textos nuevos de gl, eu, ca y en?
9. Consentimiento ilegible en el PDF (A0): el texto del aviso, y si ese PDF puede **finalizarse**
   o solo exportarse como borrador.

Con 3 y 4 decididas, la fase B y los paquetes A3, A4 y A6 quedan desbloqueados. A1 solo necesita la cifra del corte.

---

## 7. Lo que este plan no afirma

- Que los gates estén en verde hoy: no se han ejecutado.
- Que H4 o H5 hayan causado ya un daño: son riesgos leídos en el código.
- Que los recuentos por `grep` (H6, H8, `any`) sean exactos.
- Que alguno de los paquetes esté empezado: no hay una sola línea de código cambiada.
- Plazos. No se dan porque dependen de decisiones del §6 y de pruebas en emulador que no se
  pueden estimar desde aquí.
