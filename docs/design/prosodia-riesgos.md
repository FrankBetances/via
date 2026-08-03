# Análisis de riesgos del módulo de prosodia (ISO 14971)

> Entrada de riesgos del módulo `ProsodyAnalysis`. Mientras
> `docs/risk-management/` esté pendiente de constituir, los riesgos identificados
> viven en los documentos de diseño, según la convención declarada en el README.
>
> Contexto de las decisiones: [`b0-prosodia-tarea-y-afirmaciones.md`](./b0-prosodia-tarea-y-afirmaciones.md).

---

## Peligro rector

El módulo produce **números plausibles**. Ese es su riesgo característico y el
que ordena todo lo demás: una cifra con dos decimales en un informe clínico se
lee como una medida fiable, tenga detrás una muestra de 45 segundos o de 4. El
control transversal es la doctrina de `null`: **toda métrica no medida se
publica como «no medido», nunca como cero ni como una estimación silenciosa.**

---

## Registro de riesgos

| # | Peligro | Situación peligrosa | Daño potencial | Control implementado | Dónde |
|---|---|---|---|---|---|
| P-01 | Métrica publicada sobre muestra insuficiente | Toma de pocos segundos; se calculan tasas igualmente | Sobreinterpretación: se atribuye lentitud del habla a un artefacto de la muestra | Umbrales mínimos de publicación (`MIN_SPAN_FOR_RATE_SEC`, `MIN_SYLLABLES_FOR_RATE`, `MIN_VOICED_FRAMES_FOR_F0`); por debajo, la métrica sale `null`. Aviso de muestra corta en pantalla | `prosodyDsp.ts`, `ProsodyAnalysisScreen.tsx` |
| P-02 | Umbral relativo colapsado | Grabación sin habla: el umbral se calcula sobre el percentil 99 de la propia toma y se hunde con ella | La toma entera se declara habla y se publican tasa, pausas y sonoridad de una grabación en la que no habló nadie | Suelo absoluto `ABSOLUTE_SILENCE_DB`; la toma se marca `silent` y no publica nada. Prueba de regresión dedicada | `prosodyDsp.ts`, `prosodyDsp.test.ts` |
| P-03 | Recuento silábico erróneo sobre habla infantil real | Coarticulación, disfluencias, alargamientos y ruido de sala degradan la detección de núcleos | Tasa de habla falsa presentada como medida | Jerarquía del informe: tono primero, ritmo después. La tasa se presenta con advertencia explícita de fragilidad. **Validación pendiente contra recuento manual (B6)** | `prosodyResult.ts`, `tools/acoustics/README.md` |
| P-04 | Voz del explorador dentro de la muestra | El clínico habla durante la captura | Sus sílabas y sus pausas entran en la medida del niño | Consigna locutada por `@/Voice` (termina antes de la captura) y aviso explícito en pantalla | `ProsodyAnalysisScreen.tsx`, B0.1 |
| P-05 | Comparación entre tareas distintas | Seguimiento que cruza narración y lectura | Se lee como progreso lo que es un cambio de tarea (la tasa depende fuertemente de la tarea) | La tarea se persiste con cada toma; `areProsodyTakesComparable` exige identidad de tarea | `ProsodyAnalysis.ts`, `prosodyRecord.ts` |
| P-06 | Lectura normativa de valores sin baremo | Tabla de cifras sin contexto en un informe | Juicio de normalidad infundado sobre un menor | Prohibición de percentiles y etiquetas; advertencia impresa **siempre** en el PDF y visible en pantalla | `ProsodyDetail.ts`, `ProsodyAnalysisScreen.tsx`, B0.2 |
| P-07 | Ruido de sala no verificado | Toma en sala ruidosa | Pausas y núcleos silábicos mal detectados | Acceso directo al sonómetro antes de la toma. **Limitación conocida:** no hay bloqueo automático porque el sonómetro persiste su calibración, no el nivel medido | `ProsodyAnalysisScreen.tsx` |
| P-08 | Micrófono mudo u ocupado | Otra aplicación retiene el stream, o el stream falla al abrir sin lanzar | Toma vacía interpretada como «el niño no habla» | `hasSignal()` distingue «sin señal» de «sin habla»; la pantalla lo dice con mensajes distintos | `prosodyMicAdapter.ts`, `useProsodyAnalysis.ts` |
| P-09 | Conflicto de micrófono entre módulos | Dos adaptadores abren cada uno su `AudioRecorder` (stream exclusivo, fallo silencioso en el constructor) | Un módulo deja de capturar sin ningún error | Micrófono compartido con recuento de referencias y reparto único; regresión que verifica un solo recorder con ambos adaptadores | `sharedAudioRecorder.ts`, `prosodyMicLifecycle.test.ts` |
| P-10 | Retención de audio (PHI) | El PCM o los contornos de F0 persisten en base de datos | Serie temporal de la voz de un menor almacenada sin necesidad | El PCM vive lo que dura el análisis y se suelta; el módulo no reproduce la toma; `toProsodyMetricsRecord` mapea campo a campo y no deja pasar contornos ni tiempos silábicos. Guardias de arquitectura sobre entidad y migración | `prosodyRecord.ts`, `prosodyPersistence.test.js` |
| P-11 | Toma fallida invisible en el historial | Las tomas sin métricas no se guardan | El historial miente por omisión: parece que la prueba no se intentó | Las tomas fallidas se guardan con su `reason`, y el informe lo imprime | `ProsodyAnalysisScreen.tsx`, `ProsodyDetail.ts` |
| P-12 | Agotamiento de memoria en tomas largas | Captura sin límite | Caída de la aplicación a mitad de exploración | Tope duro `MAX_TAKE_SEC` (120 s) aplicado en el hook y recortado también al concatenar el PCM; acumulación ya decimada a 16 kHz | `useProsodyAnalysis.ts`, `prosodyMicAdapter.ts` |

---

## Riesgos residuales aceptados

**R-01 — Fiabilidad de la tasa de habla sobre voz infantil real.** El banco de
CI demuestra que el algoritmo implementa correctamente el método de De Jong &
Wempe sobre señal sintética; no demuestra que cuente bien las sílabas de un niño
de cinco años. Mitigado por la jerarquía del informe y la advertencia explícita,
pero **no eliminado**. Cierre previsto: B6.

> **Primer dato sobre habla no ideal (agosto 2026).** Al verificar los recortes
> neuronales de las consignas se pasó el DSP por encima de los cuatro ficheros.
> Sobre el **mismo texto** locutado por **dos voces distintas**, el recuento
> silábico difiere de forma marcada:
>
> | Consigna | Sílabas del texto | Voz `es` | Voz `es-DO` |
> |---|---|---|---|
> | Prelector | ~26 | 16 (62 %) | 23 (88 %) |
> | Lector | ~31 | 19 (61 %) | 25 (81 %) |
>
> Las dos voces dicen exactamente las mismas palabras, así que la diferencia es
> del **estimador**, no del contenido: la envolvente de intensidad de cada voz
> —su grado de coarticulación y la profundidad de los valles entre sílabas—
> decide cuántos núcleos superan el criterio de caída de 2 dB.
>
> No es una validación clínica: son voces sintéticas de adulto, no habla
> infantil. Pero es la primera medida sobre señal **no ideal** y va en la
> dirección que ya se temía: el recuento tiende a quedarse **corto** y depende
> del locutor. Refuerza mantener la tasa al final del informe y con advertencia,
> y convierte la concordancia con recuento manual en la prioridad de B6.

**R-02 — Ventana de cierre del stream de micrófono.** `AudioRecorder` no expone
`close()`: el stream se cierra cuando el recolector de basura libera el objeto.
Si una pantalla se desmonta y otra pide el micrófono antes de que el GC pase, el
recorder nuevo puede abrirse sobre un stream vivo. El micrófono compartido
**reduce** el riesgo (elimina el caso simultáneo, que era el común) pero no lo
elimina. Es una limitación de la librería, no del módulo.

**R-03 — Ruido de sala sin verificación obligatoria.** Ver P-07. Cierre posible
con un cambio pequeño: persistir la última medición del sonómetro con su marca
de tiempo, lo que beneficiaría también a las audiometrías.

---

## Verificación

| Control | Verificado por |
|---|---|
| Doctrina de `null` y umbrales de publicación | `prosodyDsp.test.ts`, `prosodyRecord.test.ts` |
| Suelo absoluto de silencio | `prosodyDsp.test.ts` (regresión dedicada) |
| Exactitud de las medidas frente al estándar clínico | `tools/acoustics/` contra Praat, en CI |
| Zero-PHI del registro | `prosodyRecord.test.ts`, `prosodyPersistence.test.js` |
| Micrófono único entre módulos | `prosodyMicLifecycle.test.ts` |
| Registro del módulo (ruta, navegador, hub, entidad) | `prosodyPersistence.test.js` |
