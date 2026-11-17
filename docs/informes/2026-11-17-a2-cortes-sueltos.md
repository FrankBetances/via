# A2 · Cortes clínicos sueltos fuera de `nlgThresholds.ts`

> **Fecha:** 17/11/2026 · **Base:** rama `worktree-agent-a54abd32dcbb9899f`, sobre `2e1e918`.
> **Paquete:** A2 de [`PLAN-MEJORA-APP.md`](../PLAN-MEJORA-APP.md). **Solo informe:** no se ha tocado
> ni un fichero de `src/`. **No se propone ninguna cifra**: el corte lo decide Frank.

## Cómo se ha hecho, y lo que NO garantiza

- Búsqueda por `grep` sobre `src/Screens/**` y `src/PDF/**` (sin `__tests__`) de comparaciones
  con literal numérico, con constante en mayúsculas y con decimales; después, lectura del
  contexto de cada coincidencia para decidir si el resultado pinta un color, una banda, una
  frase o una derivación.
- **No es exhaustivo.** Un corte escrito con una variable intermedia, con un `switch`, o en un
  fichero fuera de esas dos carpetas (`src/Helpers`, `src/Store`, `src/Services`) no se ha
  buscado. Lo que sí se ha leído está con fichero y línea.
- Las líneas son las del commit `2e1e918`.
- Nada de esto se ha visto en pantalla ni se ha ejecutado: es lectura de código.

## 1. Resumen

- **Conceptos con más de una cifra: 3.**
  - T.A.R. (porcentaje de acierto): 85/60 en dos sitios y 90/70 en tres (filas 1 a 5).
  - Referencias de voz: el color sale de `VOICE_REF` (220–320 Hz, 1,04 %, 3,81 %, 12 dB) y el
    rótulo que se pinta al lado dice 200–320 Hz, 1,0 %, 3,0 % y 20 dB (fila 6).
  - Audiometría tonal: la tarjeta de Resultados finales decide por umbral de cada frecuencia
    contra 20 y 40; la de Resultados preliminares, por PTA de cada oído con `severityOf` (fila 7).
- **Cortes cuya cifra YA está en `nlgThresholds.ts` y se escribe a mano: 5 filas** (7, 9, 10, 11
  y 25). Hoy coinciden; nada impide que dejen de hacerlo.
- **Cortes sin equivalente en `nlgThresholds.ts`:** filas 1 a 6, 8 (solo el 60), 12 a 24 y 26.
- **Total de filas clínicas en las tablas: 26**, repartidas en 18 ficheros.
- Casos dudosos, sin clasificar: sección 4.

## 2. Tabla de cortes

Leyenda de la columna «¿Constante en `nlgThresholds.ts`?»: **sí, y se usa** = ya lee de ahí;
**sí, copiada como literal** = existe y este sitio escribe el número a mano; **no** = no existe
equivalente.

### 2.1 Conceptos con más de una cifra

| # | Fichero:línea | Expresión | Qué decide | ¿Constante en `nlgThresholds.ts`? | ¿Otra cifra para el mismo concepto? |
| --- | --- | --- | --- | --- | --- |
| 1 | `src/Screens/Articulation/ArticulationTestScreen.tsx:274,277` | `correctPct >= 85` / `>= 60` | Color e icono del cuadro de resultado al terminar el T.A.R. | no | **Sí: 90/70** en las filas 3 a 5 |
| 2 | `src/PDF/blocks/ArticulationDetail.ts:20` | `pct >= 85 ? green : pct >= 60 ? amber : red` | Color del porcentaje en la página de detalle del PDF | no | **Sí: 90/70.** Hallazgo nuevo respecto al plan (H1 citaba cuatro líneas): el PDF usa 85/60, la cifra de la pantalla del módulo y no la de las tarjetas |
| 3 | `src/Screens/ResultadosPreliminares/evaluationResults.ts:252` | `correctPct >= 90 ? 'ok' : >= 70 ? 'warn' : 'alt'` | Estado de la tarjeta en Resultados preliminares e Historial | no | Sí: 85/60 en las filas 1 y 2 |
| 4 | `src/Screens/ResultadosFinal/ResultadosFinalScreen.tsx:643` | ídem | Estado de la fila «Ítems acertados» | no | Sí |
| 5 | `src/Screens/ResultadosFinal/ResultadosFinalScreen.tsx:659` | ídem | Estado de la tarjeta de articulación | no | Sí |
| 6 | `src/Screens/ResultadosFinal/ResultadosFinalScreen.tsx:578-581` y `src/Screens/VoiceAnalysis/VoiceAnalysisScreen.tsx:685-690` | rótulos `ref:` y `norm=`: `'200–320 Hz'`, `'< 1.0 %'`, `'< 3.0 %'`, `'> 20 dB'` | **Texto** de referencia que se pinta junto al semáforo de voz | `VOICE_REF` **sí, y se usa** para el color (`voiceAnalysisResult.ts:29-38`) | **Sí:** el color sale de `VOICE_REF` y el rótulo enseña las cifras que `voiceAnalysisResult.ts:12-16` dice haber sustituido el 2/11/2026. No son comparaciones; un clínico ve un jitter de 1,3 % junto a «< 1.0 %» y un indicador verde |
| 7 | `src/Screens/ResultadosFinal/ResultadosFinalScreen.tsx:485-486` | `v > 20` → `'warn'`; `v > 40`, o campo libre con `null` → `'alt'` | Estado de la tarjeta de audiometría tonal en Resultados finales | **sí, copiada como literal** (`PTA_REF_MAX` = 20, `PTA_BAND_MILD_MAX` = 40) | **Sí:** `evaluationResults.ts:91,98` decide por PTA de cada oído con `severityOf` y solo produce `'ok'` o `'warn'`, nunca `'alt'`. Mismo estudio, dos reglas |
| 8 | `src/Screens/ExecutiveFunctions/executiveFunctionsGame.ts:523-527` | `score >= EF_OK_CUT ? 'ok' : score >= EF_WARN_CUT ? 'warn' : 'alt'` | Estado de la tarjeta de funciones ejecutivas | `EF_DOMAIN_CUT` (65) **sí, y se usa**; `EF_WARN_CUT` = 60 **no** | No hay segunda cifra para el mismo corte; el 60 vive solo aquí. La matriz (`matriz-evidencia-nlg.md`) lo deja a propósito fuera del texto |

### 2.2 Cifras que ya están en `nlgThresholds.ts` o se repiten en varios sitios

| # | Fichero:línea | Expresión | Qué decide | Constante equivalente | ¿Otra cifra? |
| --- | --- | --- | --- | --- | --- |
| 9 | `src/Screens/AutismScreening/AutismScreeningScreen.tsx:251` | `score >= 8 ? 'high' : score >= 3 ? 'med' : 'low'` | Nivel de riesgo M-CHAT-R que se guarda y se pinta | `MCHAT_REFER` = 8 y `MCHAT_FOLLOW` = 3: **sí, copiada como literal** | No: coinciden |
| 10 | `src/Screens/AutismScreening/AutismScreeningScreen.tsx:306` | `'Alto (8–20)'`, `'Medio (3–7)'`, `'Bajo (0–2)'` según `score >= 8` y `>= 3` | Texto de la banda en pantalla | ídem | No |
| 11 | `src/Screens/AutismScreening/autismScreeningResult.ts:29,34` | `levelFromScore` y `rangeLabelFromScore` con 8 y 3 | Las mismas dos decisiones, copiadas en el módulo de lógica | ídem | Misma lógica duplicada en dos ficheros (filas 9 y 10 frente a 11) |
| 12 | `src/PDF/blocks/DysphagiaDetail.ts:92` | `drop >= 3` | Desaturación: marca la seguridad del bolo como alterada en la tabla del PDF | no (SpO₂ no está en `nlgThresholds.ts`) | Misma cifra que `MIN_SPO2_DROP = 3` en `DysphagiaTestScreen.tsx:73,222`, escrita dos veces |

### 2.3 Cortes clínicos sin equivalente en `nlgThresholds.ts`

| # | Fichero:línea | Expresión | Qué decide | ¿Otra cifra para el mismo concepto? |
| --- | --- | --- | --- | --- |
| 13 | `src/Screens/ResultadosFinal/ResultadosFinalScreen.tsx:797-798` | `basalSpO2 >= 95`, `(minSpO2 ?? 100) >= 95` | Estado de las filas de SpO₂ (y el rótulo `'≥ 95 %'`) | No encontrada. Ojo: `minSpO2 ?? 100` hace que un dato ausente caiga en «ok» (regla 4 de `CLAUDE.md`) |
| 14 | `src/Screens/DysphagiaTest/DysphagiaTestScreen.tsx:222` | `basalSpO2 - eff >= MIN_SPO2_DROP` (3) | Desaturación del bolo: entra en `hasSafety` y por tanto en el veredicto de disfagia | Ver fila 12 |
| 15 | `src/Screens/DysphagiaTest/DysphagiaTestScreen.tsx:446-448` | `lSafe >= 5`, `nSafe >= 5`, `pSafe >= 5` | Recomendación de textura y volumen | No |
| 16 | `src/Screens/SahsScreening/sahsScreeningResult.ts:164,177,180` | `yesCount / PSQ_TOTAL >= 0.33`; `prop >= 0.5 ? 3 : prop >= 0.33 ? 2 : 0` | PSQ positivo y sus puntos | El 0,33 va también en un texto: `'< 0.33 (positivo ≥ 0.33)'` (`ResultadosFinalScreen.tsx:754`) |
| 17 | `src/Screens/SahsScreening/sahsScreeningResult.ts:182,187` | `brodsky >= 4 ? 3 : brodsky === 3 ? 2 : 0`; `total >= 6 ? 'high' : total >= 3 ? 'med' : 'low'` | Puntos de Brodsky y nivel de sospecha SAHS → color y derivación | No. El 3 y el 6 no son los de M-CHAT-R: conceptos distintos con cifras parecidas |
| 18 | `src/Screens/SahsScreening/SahsScreeningScreen.tsx:590` | `b.grade >= 4 ? '$error500' : b.grade === 3 ? '$warning700' : '$primary500'` | Color del grado de Brodsky | Misma escala que la fila 17 escrita aparte |
| 19 | `src/Screens/ClinicalAssessment/clinicalAssessmentResult.ts:157-158` | `vbTrue / 3 < 0.5` → bloqueo; `vbTrue === 3` → ok | Bloqueo del juego J04 («producción verbal insuficiente») y color del dominio verbal | No |
| 20 | `src/Screens/ResultadosFinal/ResultadosFinalScreen.tsx:557,567` | `g.g >= 2 ? 'alt' : g.g === 1 ? 'warn' : 'ok'` | Estado de la valoración GRBAS cuando la voz se cierra a mano | No. El texto sale de `rules.grbasGrade(g)` en el catálogo (`strings.*.ts`); **no he leído si el catálogo usa el mismo corte** |
| 21 | `src/Screens/VoiceAnalysis/voiceAnalysisResult.ts:32,35,38` | `jitter.max * 1.5`, `shimmer.max * 1.5`, `hnr.min - 5` | Banda «límite» frente a «alterado» | `VOICE_REF` da el máximo; el 1,5 y el 5 que fijan el «alterado» no están en `nlgThresholds.ts` |
| 22 | `src/Screens/RoomNoiseCheck/RoomNoiseCheckScreen.tsx:102`; `src/Screens/RoomNoiseCheck/useNoiseMeter.ts:96,220` | `threshold ?? 45`; `db <= threshold + 10`; `a <= threshold && l10 <= threshold + 12`; `a <= threshold + 8` | Veredicto de ruido de sala (ok / aviso / bloqueo) y color del medidor | No. Dos reglas con márgenes distintos: +10 en el medidor en vivo, +12 y +8 en el veredicto final |
| 23 | `src/Screens/VerbalAudiometry/verbalAudiometryResult.ts:75` | `DISCRIMINATION_OK_CUT = 90` (con `WARN_CUT = DISC_MIN`) | Estado verde o ámbar de la discriminación | `DISC_MIN` (80) **sí, y se usa**; el 90 no existe en `nlgThresholds.ts` |
| 24 | `src/Screens/VerbalAudiometry/verbalAudiometryResult.ts:188` | `ls.pct >= 50` | URV estimado (nivel más bajo con al menos 50 %) | No |
| 25 | `src/Screens/AudiometryConditioned/AudiometryConditionedScreen.tsx:246` | `a.db >= 80` | Si cuenta como «sin respuesta al máximo» | `AUDIO_MAX_DB` = 80: **sí, copiada como literal**. Decide `noResponseAtMax` |
| 26 | `src/Screens/Consentimiento/ConsentimientoScreen.tsx:127` | `age < 18` | Régimen de firma (menor: tutor) | No; es decisión legal, no un umbral clínico |

## 3. Dónde pesa

- **Mismo resultado, distinto aspecto según la pantalla:** filas 1 a 5 (T.A.R., ahora con el PDF
  incluido), fila 6 (rótulos de voz) y fila 7 (audiometría tonal).
- **Cifra correcta hoy, escrita a mano en varios sitios:** filas 9 a 12 y 25.
- **Sin nada con lo que compararse:** filas 13 a 24. Deciden color o derivación y no están en el
  fichero que `CLAUDE.md` declara fuente única. Decidir cuáles pasan a `nlgThresholds.ts` es de
  Frank.
- **Lo que NO se ha mirado y puede añadir filas:** `src/Helpers/`, `src/Store/`, `src/Services/`
  y los textos del catálogo (`src/I18n/`), donde `rules.*` puede llevar un corte dentro de una
  frase.

## 4. Casos dudosos (no se han clasificado)

- `src/Screens/VerbalAudiometry/verbalAudiometryResult.ts:128-130`: `years < 4`, `<= 5`, `<= 8`
  eligen la banda de láminas (A/B/C/D). No es un estado clínico, pero cambia el estímulo
  presentado, y el rótulo `'< 4 años'` está repetido en `verbalAudiometryLists.ts`,
  `verbalAudiometryLists.eu.ts` y `verbalAudiometryLists.gl.ts`.
- `src/Screens/AshaScreening/ashaMilestones.ts:259-264`: `months <= 6/12/18/24/36/48` eligen la
  banda de hitos. Es protocolo, no semáforo, pero decide qué hitos se preguntan.
- `src/Screens/AshaScreening/ashaCdssEngine.ts:97-104`: el riesgo es «alguna bandera roja → rojo;
  algún hito fallado → amarillo». No hay cifra, pero el corte es «más de 0».
- `src/Screens/Audiometry/useAudiometryTest.ts:137`: `heardCount >= 2` confirma un umbral
  (criterio de respuesta de la medida), no un corte de interpretación.
- `src/Screens/DiagnosticoAudio/audioSelfTest.ts:198,222,569` (`peak > -60`,
  `MIN_RESPONSIVE_SPAN_DB`, `MIN_CLOCK_RATIO`): umbrales de la comprobación técnica del
  micrófono, no de un resultado del paciente; deciden un veredicto de la pantalla de diagnóstico.
- `src/Screens/RegistroPaciente/RegistroPacienteScreen.tsx:69`: `years < 2` solo cambia «24 m» por
  «2 a» en la edad mostrada.

## 5. Descartado por no ser clínico

- DSP y análisis de señal: `prosodyDsp.ts`, `voiceDsp.ts`, `noiseDsp.ts`, `useVoiceAnalysis.ts`
  (`F0_VALID_MIN/MAX`, `MIN_TAKE_SEC`), `voiceMicAdapter.ts`, `prosodyMicAdapter.ts`,
  `noiseMicAdapter.ts`, `audiometryToneAdapter.ts`.
- Maquetación (`seleccionLayout.ts`, `luaLayout.ts`, `BienvenidaScreen.tsx`,
  `ResultadosPreliminaresScreen.tsx:119`), saludos por hora (`SeleccionProfesionalScreen.tsx:57-59`),
  animaciones, índices de pregunta (`qIndex >= 19`, `PSQ_TOTAL`) y longitud de contraseña.
- Márgenes y saltos de página de los bloques del PDF (`PDF_MARGINS.bottom + 60`, etc.).
- Semillas y bucles de guarda de `executiveFunctionsGame.ts`.
- `src/PDF/nlgReportEngine.ts`: todas las comparaciones que he leído usan constantes de
  `nlgThresholds.ts`.

## 6. Lo que decide Frank

Para cada fila de 2.1 y 2.2, cuál de las cifras manda; para 2.3, si el corte pasa a
`nlgThresholds.ts` o se queda donde está con su motivo escrito. Este informe no propone cifras. Lo
más urgente son las filas 1 a 5 (T.A.R.), que A1 del plan ya tiene pendientes de una sola cifra,
y la fila 6, que es un texto visible al lado de un semáforo y por tanto pasa por la regla 0 bis.
