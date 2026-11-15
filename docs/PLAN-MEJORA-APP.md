# Plan de mejora de la app · VIA+ (ejecución con Sonnet)

> **Fecha:** 15/11/2026 · **Base analizada:** rama `claude/tender-mccarthy-j6yahp`, commit `2e1e918`.
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

**H2 · La lectura de resultados está duplicada.** `evaluationResults.ts` se creó, según su propia
cabecera, para que «ampliar la batería» no obligara «a tocar dos sitios». `ResultadosFinalScreen`
vuelve a leer los diez repositorios por su cuenta (líneas 437-447 y 477-793). Es la causa
estructural de H1 y del fallo de ASHA del 2/11/2026.

**H3 · Un módulo que no se puede leer desaparece en silencio.** En las dos vistas el fallo de
lectura de un módulo se queda en `console.warn` (`evaluationResults.ts:79`,
`ResultadosFinalScreen.tsx:416`, `:467`, `:837`). El clínico ve un resumen con una prueba menos y
nada le dice que falta. Incumple la regla 4 («`console.warn` no es informar») en la pantalla que
cierra la evaluación.

**H4 · Esquema por `synchronize: true`.** `src/Database/config.ts:50`, con `migrations: []`. Hay
nueve migraciones escritas en `src/Database/migrations/` y **ninguna registrada**; diez entidades
no tienen migración. Con `synchronize`, un cambio de columna lo resuelve TypeORM al arrancar, sin
control y sin prueba. *Riesgo, no fallo observado*: no consta ninguna pérdida de datos.

**H5 · Identificadores en claro.** `nameEnc` y `dobEnc` guardan texto plano
(`src/Models/Patient/Patient.ts:74-88`), `viaplus.db` no está cifrada. El README lo declara. No
hay registro de auditoría ni borrado verificable (README, *Controles de seguridad*). No se ha
encontrado bloqueo por inactividad ni límite de intentos de contraseña (búsqueda por `grep`, no
exhaustiva).

**H6 · Textos de interfaz fuera del catálogo.** `check-ui-strings.js` solo mira los `.tsx`.
Recuento aproximado de literales en castellano en ficheros `.ts` que acaban en pantalla:
`clinicalAssessmentResult.ts` (25), `ashaMilestones.ts` (24), `executiveFunctionsGame.ts` (15),
`audioSelfTest.ts` (12), `orbitModules.ts` (12), `moduleCards.ts` (11), `sahsScreeningResult.ts`
(8), `evaluationResults.ts` (8), `prosodyResult.ts` (8). Una sesión en gallego o euskera ve esos
títulos en castellano. También hay toasts literales en `.tsx`
(`ArticulationTestScreen.tsx:263`, `:267`); por qué el gate no los caza está **por verificar**.

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

### Fase 0 · Deudas previas (antes de nada)

| Id | Paquete | Visible | Necesita de Frank |
| --- | --- | --- | --- |
| P0.1 | Cerrar el incidente de Lúa: actualizar su tabla de estado, lanzar `workflow_dispatch` y comprobar APK y AAB, corregir el `CLAUDE.md` de `lua-firmware` | no | Confirmar que la pantalla queda sin pie; el estado real del aparato para el punto 3 |
| P0.2 | Ejecutar los diez gates sobre `main` y anotar el resultado real (este análisis no pudo) | no | Nada |

### Fase A · Una sola verdad para los resultados

Es la de mayor valor por coste: arregla H1–H3 y no depende del dispositivo ni del organismo
notificado.

| Id | Paquete | Visible | Necesita de Frank |
| --- | --- | --- | --- |
| A1 | Cortes del T.A.R. a `nlgThresholds.ts`, usados por las cuatro líneas de H1; test de paridad como el de `nlgReportEngine.test.ts` | **sí** (un color cambiará en una de las dos pantallas) | **Qué corte es el bueno (85/60 o 90/70) y su fuente**, para la matriz de evidencia |
| A2 | Barrido de cortes numéricos sueltos en `src/Screens/**` y `src/PDF/**` fuera de `nlgThresholds.ts`; solo **informe**, sin cambios | no | Decidir uno a uno los que aparezcan |
| A3 | `ResultadosFinalScreen` consume `loadEvaluationResultCards` en vez de releer los repositorios; test que falla si una vista muestra un módulo que la otra no | no (razonado, no visto) | Nada |
| A4 | Estado observable de «módulo no leído»: `loadEvaluationResultCards` devuelve también la lista de módulos que fallaron | no | Nada |
| A5 | Pintar ese estado en Resultados preliminares, Resultados finales e Historial | **sí** (aviso nuevo) | El texto del aviso, en las cinco lenguas |
| A6 | Test de registro de módulos: toda entidad de módulo de `config.ts` tiene lectura en `evaluationResults.ts` o una excepción escrita con motivo | no | Confirmar si `ClinicalAssessment` debe tener tarjeta (hoy no la tiene) |

### Fase B · La capa de datos, con red

| Id | Paquete | Visible | Necesita de Frank |
| --- | --- | --- | --- |
| B1 | Banco de pruebas de persistencia en Node: los repositorios reales contra SQLite en memoria. *Propuesta:* driver `sqljs` de TypeORM como dependencia de desarrollo (JS puro, no entra en el APK); **compatibilidad por verificar** en el propio paquete | no | Aceptar la dependencia de desarrollo |
| B2 | Tests de ida y vuelta por repositorio (guardar → leer → mismos datos), incluidos `null` de umbrales y `noResponseAtMax` | no | Nada |
| B3 | Test de `writeWithVerify` (plazo vencido con fila guardada, plazo vencido sin fila) | no | Nada |
| B4 | Migración de línea base que reproduce el esquema actual, registrada, con test que compara el esquema por migraciones con el de `synchronize` | no | Nada |
| B5 | Apagar `synchronize` | no | **Sí**: solo tras B4 en verde **y** una prueba de Frank sobre una base con datos reales en el emulador. Hasta entonces no se toca |

B5 es el único paquete de esta fase que puede perder datos si sale mal. Se deja explícitamente
fuera de la ejecución autónoma.

### Fase C · Lógica clínica sin test

Extracción **sin cambiar comportamiento ni texto**: la lógica sale de la pantalla a un `.ts`
puro y se le pone test. Cada paquete lee antes la fuente clínica citada en el propio código.

| Id | Paquete | Visible |
| --- | --- | --- |
| C1 | Disfagia (MECV-V): veredicto y recomendación fuera de `DysphagiaTestScreen.tsx` | no |
| C2 | SAHS: tests de `sahsScreeningResult.ts` y extracción de lo que quede en la pantalla | no |
| C3 | M-CHAT-R: puntuación y bandas, con los cortes ya presentes en `nlgThresholds.ts` | no |
| C4 | Consentimiento: regla de menor de edad y de firmante | no |
| C5 | Acceso del profesional: alta, verificación de contraseña, perfil antiguo sin contraseña | no |

Si al extraer aparece una discrepancia (un corte que no cuadra con la matriz, una rama que cae
en el caso favorable sin dato), **no se arregla en el paquete**: se informa y se abre otro.

### Fase D · Seguridad y privacidad (F2 del plan del producto)

| Id | Paquete | Quién | Necesita de Frank |
| --- | --- | --- | --- |
| D1 | Informe de viabilidad: cifrado de `viaplus.db` con `react-native-nitro-sqlite` y custodia de clave. Solo lectura de fuentes; sin código | Sonnet | Nada |
| D2 | Primitivas en TypeScript puro (HMAC-SHA256 del NHC, AES-256-GCM de nombre y fecha) comprobadas contra el `crypto` de Node, como ya se hizo con PBKDF2 | Sonnet | Nada |
| D3 | Custodia de la clave en el almacén del sistema | Sesión dedicada, nativo | Elegir la librería; mirar antes qué usa Valeria+ (regla 1) |
| D4 | Cablear D2 + D3 en `Patient`, con migración de las filas en claro y fallo **visible** si la clave no abre | Sesión dedicada | Texto del error; prueba en emulador |
| D5 | Límite de intentos y bloqueo por inactividad | Sonnet (lógica) | Política: cuántos intentos, cuánto tiempo, y los textos |
| D6 | Registro de auditoría local (acceso, cierre de evaluación, exportación de PDF, borrado) | Sonnet | Qué eventos y si aparece en algún sitio |
| D7 | Medir el coste de las 10 000 iteraciones de PBKDF2 en Hermes | Frank, en emulador | — |

`site/privacidad.html` y la tabla de controles del README **no se tocan** hasta que D4 esté
comprobado en dispositivo.

### Fase E · Interfaz

Toda esta fase cambia lo que se ve: cada paquete empieza con la lista de cambios aprobada.

| Id | Paquete | Necesita de Frank |
| --- | --- | --- |
| E1 | Ampliar `check-ui-strings.js` (o un gate hermano) a los `.ts` que alimentan pantallas; primero en modo informe, para tener el recuento real de H6 | Nada (no cambia textos) |
| E2 | Migrar esos literales al catálogo, módulo a módulo. En castellano el texto no cambia; en gl, eu, ca y en **aparece texto nuevo** | Traducciones revisadas por quien firmó cada lengua |
| E3 | Auditoría de accesibilidad: informe con lista de controles sin etiqueta, objetivos táctiles y contraste | Nada |
| E4 | Aplicar E3 | Las etiquetas son texto: aprobación previa |
| E5 | Ruido de sala en el modelo y en el PDF | **Decisión de producto pendiente**; no se abre sin ella |

### Fase F · Estructura y limpieza

| Id | Paquete | Necesita de Frank |
| --- | --- | --- |
| F1 | Partir `ResultadosFinalScreen` y `ClinicalAssessmentScreen` en componentes, tras A3 y con los tests de C como red | Ver el resultado en emulador |
| F2 | Reducir los 66 `any` empezando por los repositorios y los adaptadores nativos | Nada |
| F3 | Alinear el README con `PLAN-DE-TRABAJO.md` §2 (H7) | Aprobar la redacción: es documentación externa |
| F4 | `react-native-ble-plx`: quitarla o cablearla | **Decisión de producto pendiente** |

### Fase G · Verificación en dispositivo (no delegable)

Ningún paquete de software cierra esto. Lo que sí se puede preparar:

| Id | Paquete | Quién |
| --- | --- | --- |
| G1 | Guion de recorrido de los trece módulos: pasos, qué debe verse, qué anotar, con casilla por paso | Sonnet lo redacta; Frank lo aprueba |
| G2 | Recorrido en el emulador con el guion, empezando por «Exportar PDF» y el selector de carpetas | Frank |
| G3 | Cada fallo del recorrido entra como paquete nuevo con su captura | — |

---

## 5. Orden y dependencias

```
P0.1 ─► P0.2 ─┬─► A1 ─► A3 ─► A4 ─► A5 ─► A6
              ├─► A2
              ├─► B1 ─► B2 ─► B3 ─► B4 ─► (B5, con Frank)
              ├─► C1…C5  (independientes entre sí)
              ├─► D1 ─► D2 ─► (D3, D4 nativo) · D5 · D6
              ├─► E1 ─► E2 · E3 ─► E4
              └─► G1 ─► G2 ─► G3
F1 después de A3 y C · F2 después de B2
```

**Recomendación de arranque.** P0.1, P0.2 y después la fase A entera. A1 necesita una sola
respuesta de Frank (el corte del T.A.R.) y elimina una incoherencia que hoy puede verse en el
mismo informe. En paralelo, B1–B3, C1–C5 y G1 no cambian nada visible y no requieren decisiones:
son los que se pueden lanzar ya.

**No se recomienda** empezar por la fase F (estética del código) ni por E2 (traducciones): su
valor es real, pero ninguna reduce el riesgo clínico o de datos, y E2 consume revisores.

---

## 6. Lo que Frank tiene que decidir

1. Incidente de Lúa: ¿la pantalla queda sin pie? ¿Qué se escribe en el `CLAUDE.md` del firmware?
2. T.A.R.: ¿85/60 o 90/70, y con qué fuente?
3. ¿`ClinicalAssessment` debe tener tarjeta en los resultados?
4. ¿Se acepta `sqljs` como dependencia de desarrollo para probar la persistencia?
5. Política de acceso: intentos, inactividad, recuperación de contraseña.
6. Ruido de sala en el informe: ¿consta o no?
7. `react-native-ble-plx`: ¿entra en esta versión?
8. ¿Quién revisa los textos nuevos de gl, eu, ca y en?

Las decisiones 2, 3 y 4 desbloquean las fases A y B, que son las primeras.

---

## 7. Lo que este plan no afirma

- Que los gates estén en verde hoy: no se han ejecutado.
- Que H4 o H5 hayan causado ya un daño: son riesgos leídos en el código.
- Que los recuentos por `grep` (H6, H8, `any`) sean exactos.
- Que alguno de los paquetes esté empezado: no hay una sola línea de código cambiada.
- Plazos. No se dan porque dependen de decisiones del §6 y de pruebas en emulador que no se
  pueden estimar desde aquí.
