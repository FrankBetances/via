# E1 · Literales de interfaz fuera del catálogo (informe)

> **Fecha:** 17/11/2026 · **Base:** rama `worktree-agent-a54abd32dcbb9899f`, sobre `2e1e918`.
> **Paquete:** E1 de [`PLAN-MEJORA-APP.md`](../PLAN-MEJORA-APP.md) (hallazgo H6), en modo informe.
> **No se ha cambiado ningún texto ni ningún fichero de `src/`.** Tampoco `scripts/check-ui-strings.js`.

## Qué se ha entregado

- `scripts/report-ui-literals.js`: informe con el AST de `typescript`, como el gate. **Sale
  siempre con código 0.** Para volver a ejecutarlo: `node scripts/report-ui-literals.js`
  (`--json` para los hallazgos en JSON).
- `scripts/__tests__/reportUiLiterals.test.js`: 9 tests (un toast literal, un `Alert.alert`
  literal, la exención, el criterio (b) y el código de salida 0).
- **No está en la lista de gates ni en el CI.** La lógica de «qué es una frase» (`isPhrase`,
  `BRAND`) y de «qué es un literal» (`literalOf`) está **copiada** del gate para no modificarlo;
  si el gate cambia, el informe hay que seguirlo a mano.

## Recuento (ejecutado el 17/11/2026 sobre 336 ficheros de `src/`)

| Categoría | Literales | Llamadas | Ficheros |
| --- | --- | --- | --- |
| (a) `show*Toast` con texto literal | 99 | 50 | 16 (todos `.tsx`) |
| (a) `Alert.alert` con texto literal | 0 | 0 | 0 |
| (b) propiedades de texto visible en `.ts` | 345 | no aplica | 23 |
| **Total de literales** | **444** | | |

- Un toast lleva título y mensaje: 2 literales por llamada, salvo uno de los de
  `DysphagiaTestScreen.tsx`, que lleva un argumento dinámico.
- **El plan (H6) decía «43 llamadas en 20 pantallas». Lo medido es 50 llamadas en 16 pantallas, y
  0 de `Alert.alert`.** La diferencia puede ser del método (el plan decía «recuento por `grep`»);
  no he investigado la causa.
- `Alert.alert` en `src/` solo aparece en `src/Helpers/showToast.ts:18` y recibe parámetros, no
  literales. En un `.tsx` el gate existente ya lo cubre (su regla 4), así que un literal
  nuevo ahí no pasaría el gate.
- Exenciones `// i18n-exempt:` que el informe ha respetado en el código actual: **0**
  (las dos que hay en `src/` son de `CreditosScreen.tsx`, no tocan toasts ni propiedades de
  `.ts`).
- Otros toasts ya leen del catálogo y no se cuentan: `ResultadosFinalScreen.tsx` (9 llamadas) y
  `RegistroProfesionalScreen.tsx` (3).

## (a) Toasts con texto literal

Por fichero, en llamadas y literales:

| Fichero | Llamadas | Literales |
| --- | --- | --- |
| `src/Screens/AshaScreening/AshaScreeningScreen.tsx` | 5 | 10 |
| `src/Screens/ClinicalAssessment/ClinicalAssessmentScreen.tsx` | 4 | 8 |
| `src/Screens/Consentimiento/ConsentimientoScreen.tsx` | 4 | 8 |
| `src/Screens/RegistroPaciente/RegistroPacienteScreen.tsx` | 4 | 8 |
| `src/Screens/Articulation/ArticulationTestScreen.tsx` | 3 | 6 |
| `src/Screens/Audiometry/AudiometryScreen.tsx` | 3 | 6 |
| `src/Screens/AudiometryConditioned/AudiometryConditionedScreen.tsx` | 3 | 6 |
| `src/Screens/AutismScreening/AutismScreeningScreen.tsx` | 3 | 6 |
| `src/Screens/ExecutiveFunctions/ExecutiveFunctionsScreen.tsx` | 3 | 6 |
| `src/Screens/ProsodyAnalysis/ProsodyAnalysisScreen.tsx` | 3 | 6 |
| `src/Screens/SahsScreening/SahsScreeningScreen.tsx` | 3 | 6 |
| `src/Screens/VerbalAudiometry/VerbalAudiometryScreen.tsx` | 3 | 6 |
| `src/Screens/VoiceAnalysis/VoiceAnalysisScreen.tsx` | 3 | 6 |
| `src/Screens/DysphagiaTest/DysphagiaTestScreen.tsx` | 3 | 5 |
| `src/Screens/Pacientes/PacientesScreen.tsx` | 2 | 4 |
| `src/Screens/SeleccionProfesional/SeleccionProfesionalScreen.tsx` | 1 | 2 |
| **Total** | **50** | **99** |

El patrón se repite en las pantallas de módulo: «No se puede guardar / No hay una evaluación
activa asociada al paciente.», «Error al guardar / No se pudo registrar…», y un
«… guardado» con la métrica. El listado completo, con fichero y línea de cada literal, sale de
`node scripts/report-ui-literals.js`.

## (b) Propiedades de texto en `.ts`

### Criterio (objetivo, y sus límites)

Una propiedad de objeto de un `.ts` cuenta como texto visible si se cumplen las cuatro:

1. su nombre está en `VISIBLE_KEYS`: `title`, `label`, `headline`, `text`, `message`,
   `instruction`, `description`, `subtitle`, `metric`, `reason`, `sub`, `hint`, `caption`,
   `recommendation`, `summary` (los siete primeros son los del encargo; los ocho últimos los he
   añadido porque aparecen en los ficheros que alimentan pantallas);
2. su valor es un literal de cadena, de plantilla, una concatenación o un ternario de literales;
3. el literal es «frase» (al menos tres letras seguidas y no es una marca de `BRAND`);
4. empieza por mayúscula o contiene un espacio (descarta casi todos los identificadores:
   `label: 'f0'`).

**Lo que este criterio NO ve** (y por tanto el recuento es un mínimo):

- texto que llega por `return 'Alto (8–20)'` o por una variable (por ejemplo
  `rangeLabelFromScore` en `autismScreeningResult.ts:34`);
- arrays de cadenas (por ejemplo `EXAM_SIGNS` en `sahsScreeningResult.ts`);
- propiedades con otro nombre (`name`, `placeholder`, `note`…);
- texto visible en `.tsx` fuera de las props que mira el gate.

### Recuento por fichero

| Fichero | Propiedades |
| --- | --- |
| `src/Screens/AshaScreening/ashaMilestones.ts` | 62 |
| `src/Screens/DiagnosticoAudio/audioSelfTest.ts` | 44 |
| `src/Screens/SahsScreening/sahsScreeningResult.ts` | 36 |
| `src/Screens/ClinicalAssessment/clinicalAssessmentResult.ts` | 31 |
| `src/Screens/ExecutiveFunctions/executiveFunctionsGame.ts` | 24 |
| `src/Screens/SeleccionEjercicios/moduleCards.ts` | 24 |
| `src/Screens/ProsodyAnalysis/prosodyStimuli.ts` | 19 |
| `src/Screens/ResultadosPreliminares/evaluationResults.ts` | 19 |
| `src/Screens/ProsodyAnalysis/prosodyResult.ts` | 18 |
| `src/Screens/Creditos/orbitModules.ts` | 13 |
| `src/Screens/Articulation/articulationResult.ts` | 10 |
| `src/Screens/VoiceAnalysis/voiceAnalysisResult.ts` | 10 |
| `src/Screens/Audiometry/audiometryResult.ts` | 9 |
| `src/PDF/blocks/ClinicalAssessmentDetail.ts` | 4 |
| `src/Screens/VerbalAudiometry/verbalAudiometryLists.ts` | 4 |
| `src/Screens/VerbalAudiometry/verbalAudiometryLists.eu.ts` | 4 |
| `src/Screens/VerbalAudiometry/verbalAudiometryLists.gl.ts` | 4 |
| `src/Screens/ProsodyAnalysis/prosodyMicAdapter.ts` | 2 |
| `src/Screens/RoomNoiseCheck/noiseMicAdapter.ts` | 2 |
| `src/Screens/VoiceAnalysis/voiceMicAdapter.ts` | 2 |
| `src/Startup/describeError.ts` | 2 |
| `src/PDF/blocks/AudiometryDetail.ts` | 1 |
| `src/Screens/ProsodyAnalysis/prosodyDsp.ts` | 1 |
| **Total** | **345** |

**Frente a los recuentos del plan** (H6 dio 25, 24, 15, 12, 12, 11, 8, 8, 8 para los nueve
ficheros que citaba): `clinicalAssessmentResult.ts` 31, `ashaMilestones.ts` 62,
`executiveFunctionsGame.ts` 24, `audioSelfTest.ts` 44, `orbitModules.ts` 13, `moduleCards.ts` 24,
`sahsScreeningResult.ts` 36, `evaluationResults.ts` 19, `prosodyResult.ts` 18. **Son más altos** porque
el plan hablaba de «literales en castellano» a ojo y aquí se cuentan propiedades (un hito de ASHA
lleva `text` y `description`). No son magnitudes comparables, y ninguna de las dos cifras
está verificada contra lo que de verdad se ve en pantalla.

### Falsos positivos evidentes y casos que hay que mirar

- `src/Screens/ProsodyAnalysis/prosodyDsp.ts:579`, propiedad `reason` con el valor
  `ok`/`no-voicing`: es un código interno, **no se ve**. Falso positivo (1).
- `src/Screens/VerbalAudiometry/verbalAudiometryLists.eu.ts` y `.gl.ts` (8 literales): ya
  están en euskera y en gallego, no en castellano. Siguen fuera del catálogo `src/I18n/`, así que
  el informe tiene razón en listarlos, pero **no son «texto en castellano que se ve igual en
  todas las lenguas»**, que es el problema que describe H6.
- `src/Screens/ProsodyAnalysis/prosodyStimuli.ts` (19): etiquetas de láminas y de textos
  estímulo; no he comprobado cuáles se pintan y cuáles solo se locutan o identifican.
- `src/Screens/DiagnosticoAudio/audioSelfTest.ts` (44): textos de la pantalla de diagnóstico del
  audio, escritos en castellano de forma deliberada y técnica. Puede ser una exención con motivo
  y no una migración; **lo decide Frank**.
- `src/Screens/Creditos/orbitModules.ts` (13): nombres de módulo de la animación de créditos.
- `src/Startup/describeError.ts` (2): mensaje de la pantalla de fallo de arranque, que por diseño
  se pinta antes de que exista nada más.
- `src/Screens/*MicAdapter.ts` (6): título y mensaje del permiso de micrófono; llegan a un diálogo
  del sistema. No he leído por dónde pasan hasta la pantalla.
- `src/PDF/blocks/*.ts` (5): etiquetas que van al PDF, no a una pantalla.

## Lo que este informe no afirma

- **No dice qué hay que migrar**: solo qué hay fuera del catálogo según un criterio. Migrar es E2
  y cambia lo que se ve en gl, eu, ca y en.
- No se ha visto ninguna pantalla ni ningún toast en el emulador.
- El criterio (b) tiene falsos negativos (arriba) y alguno positivo; **el 345 es una cota inferior
  del texto de `.ts` fuera del catálogo, no el recuento exacto**.
- No he comparado si cada literal ya tiene su equivalente en `src/I18n/strings.es.ts`: algunos
  `.ts` pueden estar siendo sustituidos por el catálogo en tiempo de ejecución.
