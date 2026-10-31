# Matriz de evidencia del motor NLG

Versión de todas las reglas: `1.0.0`.

Este documento es el expediente de las reglas que la oleada 2 escribirá en `src/PDF/nlgReportEngine.ts`. Las plantillas en castellano viven en `src/I18n/strings.es.ts`, bloque `nlg`. Las otras seis lenguas aún no tienen el bloque: hasta que lo tengan, `npx tsc --noEmit` queda en rojo. Esta oleada no cambia pantallas, PDF ni umbrales del código de hoy.

Frank cerró el 31/10/2026 que, donde el plan del motor y el código discrepen, manda el plan. Las cifras de abajo son las del plan. `VOICE_NORMS`, `severityOf`, `DISCRIMINATION_WARN_CUT` y `EF_OK_CUT` / `EF_WARN_CUT` siguen en sus ficheros y no se han tocado.

## Convenciones

- Un hecho lleva `ruleId`, módulo, valores medidos y la fila de esta matriz (`evidenceRef` = el `ruleId` y la versión `1.0.0`).
- `null` y `undefined` no entran en la rama de «dentro del intervalo». Una lista ausente equivale a vacía. Una sesión sin entidades de un módulo no emite el hecho favorable de ese módulo: no emite nada de ese módulo.
- Si hay varias filas del mismo tipo, se cruzan en orden de `id` ascendente (`AshaMilestoneTest.id` es texto: orden lexicográfico). El orden de ensamblado es fijo: CAP, reglas cruzadas, audiometría tonal, verbal, voz, prosodia, articulación, ASHA, M-CHAT, disfagia, SAHS, funciones ejecutivas. Dentro de cada módulo, el orden de esta matriz.
- Los huecos de las plantillas salen de claves de `nlg.rules` de la lengua activa. El motor no concatena castellano dentro de otra lengua.
- Códigos que el motor pasa ya resueltos: `rAut002` recibe `rec` `0` (puntuación por debajo de 3), `1` (de 3 a 7) o `2` (8 o más). `rVer003` recibe `borrowed` `1` si la lengua es `ca` o `en`. `rVoz004` recibe `formantsMissing` `1` si `formants` es `null`. `rEf002` recibe `anyBelow` `1` si algún dominio completado queda por debajo de 65.
- El módulo `src/Screens/ProsodyAnalysis/` no se edita. `R-PRO-*` lee la entidad ya guardada (`metrics`, `reason`). No importa `prosodyDsp.ts`.
- `tools/acoustics/` y los motores de audio no se editan. La nota de shimmer cita el factor ya publicado; no recalcula el banco.

## Léxico que las plantillas no usan

- `patológico`, `sano`, `enfermo`, `descarta`, `diagnóstico confirmado`, `voz perceptualmente normal`, `dentro de los rangos normativos`.
- `normal` como clasificación del paciente. El token persistido `Normal` de la otoscopia es un valor de base de datos: la plantilla no lo vierte. Lo mismo con la etiqueta vieja «Audición normal» y con «Voz perceptualmente normal».
- En `R-SAH-001` la plantilla no dice «diagnóstico definitivo». Dice que la confirmación corresponde a una polisomnografía en Unidad de Sueño.
- En `R-CROSS-001` la plantilla no dice «invalida técnicamente». Dice que el PTA de ese oído no es interpretable por el hallazgo de otoscopia.

## Campos reales

El plan nombra atajos (`cap.earRight`, `evaluateAssessment`, `computeSahsResult`) que el código no tiene. La condición de cada regla usa estos campos.

- Otoscopia: `ClinicalAssessment.domains.otoscopia.od` y `.oi`. Valores persistidos: `Cerumen`, `OMA`, `OME`, `Perforación`, `DTT`, `Otro`, `Normal`, o `null`. Veredicto: `globalResult` = `FULL`, `PARTIAL` o `BLOCKED`.
- Audiometría: `AudiometryTest.thresholds.OD`, `.OI` y, si hay campo libre, `.CL`. Frecuencias que la prueba guarda: 500, 1000, 2000 y 4000 Hz. `null` = sin umbral. PTA de oído: `ptaOD` o `ptaOI` si no es `null`; si lo es, media redondeada de los umbrales determinados de ese oído. Campo libre: no hay columna `ptaCL`; la media se calcula sobre `thresholds.CL`.
- Verbal: `presentedCount`, `levelScores[]` (`level`, `pct`, `correct`, `presented`), `srtDb`, `ageBand`, `language`, `discriminationPct`.
- Voz: `f0`, `jitter`, `shimmer`, `hnr`, `formants`, `grbas`. Los cuatro primeros `null` = cierre manual.
- Prosodia: `reason` (`ok`, `empty`, `silent`, `too-short`, `no-voicing`) y `metrics` (duración, núcleos, pausas, rango tonal, tasas).
- Articulación: `evaluatedCount`, `totalCount`, `correctPct`, `sodaCounts`, `affectedPhonemes[].phoneme`, `phonemeStatus[].place`.
- ASHA: `riskLevel` (`green`, `yellow`, `red`), `failedDomains` (`receptive`, `expressive`, `pragmatic`), `ageBand`.
- M-CHAT: fila `Screening` con `instrument === 'autism-tea'`. Otra fila de `Screening` no cuenta. `score`, `total`, `answers`, `riskLevel`.
- Disfagia: `safetyAltered`, `efficacyAltered`, `basalSpO2`, `minSpO2`, `maxDrop`, `recommendation`, `verdict`.
- SAHS: `psqYesCount`, `psqTotal`, `brodsky`, `imc` (`normo`, `sobrepeso`, `obesidad`), `suspicionLevel` (`low`, `med`, `high`).
- Funciones ejecutivas: `ageBand`, `overallScore`, `attentionScore`, `inhibitionScore`, `flexibilityScore`, `workingMemoryScore`, `planningScore`. `null` = mini-juego no completado.

## Bandas y cortes de esta versión

Estas cifras sustituyen, en el texto del motor, a las del código de hoy. El código de pantalla no se ha cambiado en esta oleada.

- Voz, intervalo de referencia: F0 de 220 a 320 Hz inclusive; jitter hasta 1,04 % inclusive; shimmer hasta 3,81 % inclusive; HNR desde 12 dB inclusive. Fuera: F0 por debajo de 220 o por encima de 320, jitter por encima de 1,04, shimmer por encima de 3,81, HNR por debajo de 12.
- Audiometría, banda del PTA entero en dB HL: ≤ 20 rango de referencia; 21–40; 41–70; 71–90; 91 o más (por encima de 90). No se usan las etiquetas «pérdida leve», «moderada», «severa» ni «profunda».
- Morfología, solo con 500 Hz y 4000 Hz determinados en ese oído. Margen 15 dB, el mismo que el plan ya usa entre URV y PTA. Sea `d = umbral(4000) − umbral(500)`:
  - `d ≥ 15`: curva descendente en agudos.
  - `d ≤ −15`: curva ascendente.
  - en otro caso: curva plana.
  - si falta 500 o 4000: no se afirma morfología. No se rellena con «plana».
- Verbal: el corte de reconocimiento es 80 %, no el 70 del código. El plan escribe «60 dB» y «nivel conversacional». Esta prueba presenta 65 y 50 dB; el nivel conversacional persistido es 65 dB (`DEFAULT_LEVEL`). La cláusula de discriminación mira el `levelScore` con `level === 65`. No se busca un nivel 60, que la prueba no guarda: un nivel ausente no se da por buen reconocimiento. Si no hay tramo a 65 dB, esa cláusula no dispara.
- Funciones ejecutivas: un dominio completado queda por debajo del umbral orientativo si es menor de 65. La regla cruzada con SAHS usa además índice global menor de 70, o atención o inhibición menores de 65. El 80 y el 60 del juego no entran en estas frases.
- Derivación tonal: cualquier umbral determinado por encima de 20 dB HL, o una frecuencia sin respuesta al máximo. 20 dB HL sigue dentro del rango de referencia.

## R-CROSS-001

- Identificador: `R-CROSS-001`. Versión `1.0.0`. Módulos: CAP y audiometría tonal.
- Condición: en un `ClinicalAssessment` de la sesión, `domains.otoscopia.od` o `.oi` es `Cerumen`, `OMA` o `Perforación`, y en una `AudiometryTest` de la misma sesión el oído homolateral tiene al menos un umbral determinado (no `null`) en `thresholds.OD` o `thresholds.OI`. `DTT`, `Otro`, `Normal` y `null` no disparan esta regla. `null` no se lee como oído libre.
- Entrada: lado (`labelEarOd` o `labelEarOi`) y hallazgo (`labelFindingCerumen`, `labelFindingOma` o `labelFindingPerf`).
- Efecto: el PTA de ese oído no es interpretable; conviene reevaluar la audiometría cuando el hallazgo se haya resuelto.
- Fuente: protocolo CAP de VIA+ (`BLOCKING_FINDINGS` ya lista esos tres hallazgos) e ISO 14971.
- Mitigación: el informe no presenta ese PTA como usable. El hecho queda en la traza con el hallazgo y el lado.

## R-CROSS-002

- Identificador: `R-CROSS-002`. Versión `1.0.0`. Módulos: CAP y audiometría tonal.
- Condición: `domains.otoscopia.od` o `.oi` es `OME` y el PTA homolateral es mayor de 20 dB HL. Sin PTA numérico, la regla no dispara.
- Entrada: lado y PTA entero.
- Efecto: concordancia entre elevación de umbral y otitis media con efusión. Se sugiere valoración ORL e impedanciometría.
- Fuente: BIAP Rec. 02/1 bis y guía SEORL, citadas por el plan del motor.
- Mitigación: la sugerencia es texto de apoyo. No sustituye la impedanciometría ni una conclusión de oído medio.

## R-CROSS-003

- Identificador: `R-CROSS-003`. Versión `1.0.0`. Módulos: audiometría tonal y verbal.
- Condición: el mejor PTA tonal es ≤ 20 dB HL y se cumple al menos una de estas dos: el `pct` del `levelScore` a 65 dB es menor de 80, o `srtDb` y el mejor PTA son números y su diferencia absoluta es mayor de 15 dB. El mejor PTA es el menor entre los PTA determinados (OD, OI o campo libre). Un PTA `null` no entra en el mínimo. Si no hay ningún PTA, la regla no dispara. Si no hay tramo a 65 dB, la cláusula de discriminación no dispara y no se usa el 50 dB ni `discriminationPct` para dar el reconocimiento por bueno. Si `srtDb` es `null`, la cláusula del URV no dispara.
- Entrada: mejor PTA y el detalle ya renderizado con `rCross003Disc` (porcentaje y 65) y/o `rCross003Gap` (diferencia en dB), unidos con `labelListSep` si disparan las dos.
- Efecto: disociación entre umbrales tonales en el rango de referencia y reconocimiento verbal. Se sugiere explorar el procesamiento auditivo o la comprensión léxica.
- Fuente: el plan cita ASHA, procesamiento auditivo central. Corte 80 % y margen 15 dB: plan del motor. Nivel 65 dB: nivel conversacional persistido por VIA+, en lugar del «60 dB» escrito en el plan, por la razón de la sección de cortes.
- Mitigación: no se afirma un trastorno de procesamiento. La sugerencia queda identificada con este `ruleId`.

## R-CROSS-004

- Identificador: `R-CROSS-004`. Versión `1.0.0`. Módulos: audiometría tonal y T.A.R.
- Condición: en alguna audiometría, el umbral de 2000 Hz o el de 4000 Hz (OD, OI o CL) es mayor de 25 dB HL, y `affectedPhonemes` contiene `/s/`, `/f/` o `/z/`. La comparación quita espacios y barras y pasa a minúsculas, porque el tipo documenta el fonema con barras (`'/r/'`).
- Entrada: frecuencias que superan 25 dB HL y fonemas encontrados.
- Efecto: el descenso en agudos puede comprometer la percepción y la producción de esas fricativas o sibilantes.
- Fuente: fonética acústica clínica y BIAP, citadas por el plan.
- Mitigación: es una correlación, no una causa demostrada en esa sesión. Los dos valores viajan en el hecho.

## R-CROSS-005

- Identificador: `R-CROSS-005`. Versión `1.0.0`. Módulos: voz y disfagia.
- Condición: `DysphagiaTest.safetyAltered === true` y, en una `VoiceAnalysis` de la sesión, al menos un parámetro numérico cumple jitter > 1,04, o shimmer > 3,81, o HNR < 12. Un parámetro `null` no cumple su comparación y tampoco la da por dentro. Si los tres son `null`, la regla no dispara aunque la deglución tenga la seguridad comprometida: eso lo cuenta `R-DYS-003`, sin afirmar una perturbación acústica que no se midió.
- Entrada: jitter, shimmer y HNR tal como se midieron, o `labelUnavailable` si ese parámetro es `null`.
- Efecto: precaución laringo-faríngea. Correlacionar en consulta.
- Fuente: Clavé y colaboradores (MECV-V) y ORL pediátrica, citadas por el plan. Intervalos acústicos: plan del motor, no `VOICE_NORMS`.
- Mitigación: no se afirma penetración ni aspiración. El hecho exige las dos medidas a la vez.

## R-CROSS-006

- Identificador: `R-CROSS-006`. Versión `1.0.0`. Módulos: ASHA y M-CHAT-R.
- Condición: una `AshaMilestoneTest` tiene `riskLevel === 'red'` o `failedDomains` incluye `receptive` o `pragmatic`, y una `Screening` con `instrument === 'autism-tea'` tiene `score >= 3`. `expressive` solo no basta. Una fila que no sea `autism-tea` no cuenta. `score` ausente no se lee como 0.
- Entrada: detalle ASHA (banda y dominios) y puntuación.
- Efecto: se sugiere derivación prioritaria conjunta a neuropediatría y atención temprana.
- Fuente: ASHA, percentil 75, y Robins y colaboradores (M-CHAT-R/F), citadas por el plan.
- Mitigación: la derivación es una sugerencia del apoyo a la decisión. Los dos cribados y la puntuación quedan en la traza. Entra porque el plan la especifica y Frank indicó seguir el plan.

## R-CROSS-007

- Identificador: `R-CROSS-007`. Versión `1.0.0`. Módulos: SAHS y funciones ejecutivas.
- Condición: `suspicionLevel` es `med` o `high`, y se cumple al menos una de estas: `overallScore` numérico menor de 70, `attentionScore` numérico menor de 65, o `inhibitionScore` numérico menor de 65. `low` no dispara. Un score `null` no cumple la comparación numérica.
- Entrada: etiqueta de sospecha (`labelSahsMed` o `labelSahsHigh`) y el detalle de las puntuaciones que cumplieron el corte.
- Efecto: coexistencia de sospecha orientativa de trastorno respiratorio del sueño y rendimiento por debajo del corte en el índice global, la atención o la inhibición. Correlacionar en consulta.
- Fuente: Chervin y colaboradores (PSQ SRBD-22), citada por el plan. Cortes 70 y 65: plan del motor, no `EF_OK_CUT` (80) ni `EF_WARN_CUT` (60).
- Mitigación: no se afirma un trastorno del sueño. La frase dice sospecha orientativa.

## R-CAP-001

- Identificador: `R-CAP-001`. Versión `1.0.0`. Módulo: certificado de aptitud.
- Condición: `globalResult === 'FULL'`.
- Entrada: ninguna. Plantilla fija.
- Efecto: condiciones visuales, motoras, verbales y otoscópicas verificadas.
- Fuente: protocolo CAP de VIA+. El cálculo de `FULL` ya lo hace `analyzeClinicalAssessment` (el plan lo llama `evaluateAssessment`; ese nombre no existe).
- Mitigación: el motor no recalcula el veredicto con otros cortes. Repite el veredicto persistido.

## R-CAP-002

- Identificador: `R-CAP-002`. Versión `1.0.0`. Módulo: certificado de aptitud.
- Condición: `globalResult === 'PARTIAL'`.
- Entrada: dominios cuyo `kind` es `warn` o `block`, con `labelDomainVisual`, `labelDomainMotor`, `labelDomainVerbal` y `labelDomainOtoscopy`.
- Efecto: veredicto parcial y lista de dominios con restricción.
- Fuente: protocolo CAP de VIA+.
- Mitigación: un dominio `pending` no se lista como verificado.

## R-CAP-003

- Identificador: `R-CAP-003`. Versión `1.0.0`. Módulo: certificado de aptitud.
- Condición: `globalResult === 'BLOCKED'`.
- Entrada: ninguna. Plantilla fija.
- Efecto: la batería estándar no queda habilitada; hacen falta metodologías adaptadas.
- Fuente: protocolo CAP de VIA+.
- Mitigación: no se acompaña de una frase de aptitud.

## R-AUD-001

- Identificador: `R-AUD-001`. Versión `1.0.0`. Módulo: audiometría tonal.
- Condición: en OD, en OI o en CL no hay ningún umbral determinado. Se emite un hecho por cada lado vacío que la fila traiga. Un lado ausente del objeto (CL sin clave) no se inventa: CL solo se evalúa si `thresholds.CL` existe.
- Entrada: `labelEarOd`, `labelEarOi` o `labelEarCl`.
- Efecto: datos insuficientes para estimar el PTA.
- Fuente: protocolo de audiometría de VIA+.
- Mitigación: no se calcula un PTA con ceros ni se elige la banda de referencia.

## R-AUD-002

- Identificador: `R-AUD-002`. Versión `1.0.0`. Módulo: audiometría tonal.
- Condición: el PTA del lado es un entero. La banda es la de la sección de cortes (≤ 20, 21–40, 41–70, 71–90, > 90), no la de `severityOf` (20/40/60/80). La morfología es la de esa misma sección. Si falta 500 o 4000, la morfología es `labelMorphUnknown`.
- Entrada: lado, PTA, banda y morfología, las tres últimas ya traducidas.
- Efecto: descripción del PTA, de la banda y de la morfología.
- Fuente: bandas numéricas del plan del motor (el plan las alinea con BIAP 02/1 bis). Margen de morfología: 15 dB, ya usado por el plan en `R-CROSS-003`, aplicado a 500 Hz y 4000 Hz porque son los extremos que esta prueba guarda. El plan nombra las tres formas y no escribe la resta; esta fila fija la resta para que la versión `1.0.0` sea reproducible.
- Mitigación: la banda no lleva nombre de grado de pérdida. Quien cambie el margen tiene que cambiar esta fila y la plantilla en el mismo paso.

## R-AUD-003

- Identificador: `R-AUD-003`. Versión `1.0.0`. Módulo: audiometría tonal.
- Condición: en un lado con algún otro dato, una o más frecuencias de 500, 1000, 2000 o 4000 Hz están a `null` (sin respuesta al nivel máximo). Si todas están a `null`, manda `R-AUD-001` y no se duplica aquí.
- Entrada: lado y lista de frecuencias sin respuesta.
- Efecto: constancia de las frecuencias sin respuesta al máximo de salida.
- Fuente: protocolo de audiometría de VIA+ (`missingFreqs` en el plan).
- Mitigación: `null` no se sustituye por el máximo del audiómetro.

## R-AUD-004

- Identificador: `R-AUD-004`. Versión `1.0.0`. Módulo: audiometría tonal.
- Condición: cualquier umbral determinado es mayor de 20 dB HL, o hay alguna frecuencia sin respuesta (`R-AUD-003` o lado vacío en `R-AUD-001`).
- Entrada: lado.
- Efecto: se sugiere derivación a ORL/audiología.
- Fuente: el plan del motor. El corte > 20 dB HL ya es el de `soundfieldNeedsReferral` para el PTA; aquí se aplica también a cada umbral suelto, como dice el plan («cualquier umbral supera 20 dB HL»).
- Mitigación: la sugerencia nombra el umbral o la ausencia de respuesta. No nombra una enfermedad.

## R-AUD-005

- Identificador: `R-AUD-005`. Versión `1.0.0`. Módulo: audiometría tonal.
- Condición: la fila tiene `thresholds.CL` o `transducer === 'soundfield'`.
- Entrada: ninguna. Plantilla fija.
- Efecto: el campo libre estima la respuesta del mejor oído y no permite evaluar cada oído por separado.
- Fuente: sustitución léxica del plan. Sustituye «no descarta una pérdida unilateral».
- Mitigación: la frase no afirma ni descarta una asimetría. Dice que la prueba no la puede ver.

## R-VER-001

- Identificador: `R-VER-001`. Versión `1.0.0`. Módulo: audiometría verbal.
- Condición: `presentedCount === 0`.
- Entrada: ninguna. Plantilla fija.
- Efecto: exploración incompleta. No hay porcentaje de reconocimiento.
- Fuente: plan del motor.
- Mitigación: no se emite `R-VER-002` ni `R-VER-004` sobre un porcentaje vacío. El 0 % no se trata como reconocimiento nulo medido.

## R-VER-002

- Identificador: `R-VER-002`. Versión `1.0.0`. Módulo: audiometría verbal.
- Condición: `presentedCount > 0`. Se describe cada `levelScore` presente. La plantilla maestra lleva el nivel principal: el de 65 dB si existe; si no, el de mayor nivel presentado.
- Entrada: banda `A`–`D`, porcentaje, nivel en dB, aciertos, presentados y URV. Si `srtDb` es `null`, el hueco del URV es `labelUnavailable`.
- Efecto: reconocimiento por nivel y URV/SRT estimado.
- Fuente: plan del motor y campos de `VerbalAudiometryTest`.
- Mitigación: el URV ausente se nombra. No se estima un URV de relleno.

## R-VER-003

- Identificador: `R-VER-003`. Versión `1.0.0`. Módulo: audiometría verbal.
- Condición: siempre que la fila exista. `borrowed` es `1` si `language` es `ca` o `en`. En `es`, `gl`, `eu`, `es-DO` y `es-419` es `0`.
- Entrada: nombre de la variante y el indicador de banco prestado.
- Efecto: constancia de la lengua. Si el banco es prestado, el texto dice que el resultado no se compara como banco propio.
- Fuente: plan del motor (`R-VER-003`).
- Mitigación: una lengua prestada no se presenta como banco propio de esa lengua.

## R-VER-004

- Identificador: `R-VER-004`. Versión `1.0.0`. Módulo: audiometría verbal.
- Condición: hay `levelScore` a 65 dB y su `pct` es menor de 80. Sin ese tramo, la regla no dispara. No usa el corte 70 del código.
- Entrada: porcentaje y nivel (65).
- Efecto: se sugiere logoaudiometría diagnóstica en un centro especializado.
- Fuente: plan del motor. El nombre del procedimiento es el del plan.
- Mitigación: el porcentaje y el nivel viajan en la frase. No se sugiere si el dato conversacional falta.

## R-VOZ-001

- Identificador: `R-VOZ-001`. Versión `1.0.0`. Módulo: voz.
- Condición: `f0`, `jitter`, `shimmer` y `hnr` son `null` (cierre manual, como dice el comentario del modelo).
- Entrada: texto GRBAS. Si `grbas` es `null`, `labelGrbasMissing`. Si `grbas.g` es un número, `grbasGrade`: G0 usa la frase del plan («sin alteración perceptual registrada por el evaluador»); G1, G2 y G3 nombran el grado registrado, sin la etiqueta «Voz perceptualmente normal».
- Efecto: constancia de cierre sin captura y de la escala perceptual si se registró.
- Fuente: plan del motor y sustitución léxica de G0.
- Mitigación: no se rellenan F0, jitter, shimmer ni HNR. No se emite `voiceWithinReference`.

## R-VOZ-002

- Identificador: `R-VOZ-002`. Versión `1.0.0`. Módulo: voz.
- Condición: al menos uno de F0, jitter, shimmer o HNR es numérico. Los que falten se escriben con `labelUnavailable`. Los formantes, si `formants` no es `null`, como F1, F2 y F3; si es `null`, `labelUnavailable` en este hecho (la frase de imposibilidad va en `R-VOZ-004`).
- Entrada: F0, jitter, shimmer, HNR y formantes.
- Efecto: reporte de lo medido. Si los cuatro parámetros son numéricos y ninguno cae fuera del intervalo de la sección de cortes, se añade la cadena `voiceWithinReference`, que es la sustitución del plan para «dentro de los rangos normativos». Si alguno cae fuera, no se añade esa cadena: entra `R-VOZ-003`. Si alguno es `null`, tampoco se añade: falta un dato y no es la rama de intervalo cumplido.
- Fuente: plan del motor. Intervalos: sección de cortes, no `VOICE_NORMS` (allí F0 200–320, jitter 1,0, shimmer 3,0, HNR 20).
- Mitigación: la frase de intervalo cumplido solo sale con los cuatro números presentes y dentro. El shimmer de esta frase es el de VIA+, y `R-VOZ-004` recuerda que comprime respecto a Praat.

## R-VOZ-003

- Identificador: `R-VOZ-003`. Versión `1.0.0`. Módulo: voz.
- Condición: algún parámetro numérico cae fuera del intervalo de la sección de cortes. Los `null` no se cuentan como fuera ni como dentro.
- Entrada: lista de parámetros fuera, con su valor.
- Efecto: señalamiento descriptivo, sin clasificar la voz.
- Fuente: plan del motor (F0 220–320 Hz, jitter 1,04 %, shimmer 3,81 %, HNR 12 dB).
- Mitigación: el hecho nombra el parámetro y el valor. No usa «patológico» ni «normal».

## R-VOZ-004

- Identificador: `R-VOZ-004`. Versión `1.0.0`. Módulo: voz.
- Condición: se emite en toda voz que tenga shimmer numérico. `formantsMissing` es `1` cuando `formants` es `null`.
- Entrada: ese indicador.
- Efecto: la estimación ciclo a ciclo del shimmer comprime la cifra entre 1,3 y 1,7 veces respecto a Praat. Si los formantes son `null`, la misma frase dice que no pudieron estimarse.
- Fuente: `tools/acoustics/README.md`, tabla a 220 Hz (4 % → Praat 5,4 y VIA+ 4,1; 8 % → 9,6 y 6,2; 16 % → 17,6 y 10,2). El plan pide el factor 1,3–1,7. Esta oleada no modifica ese README ni `voiceDsp.ts`. El 3,5 % que el README menciona como lectura de consulta no sustituye al 3,81 % del plan: el corte del texto es el del plan; el factor de compresión es el del README.
- Mitigación: quien lea el shimmer en el informe ve el factor en la misma página. El banco de Praat no se relaja para igualar las cifras.

## R-PRO-001

- Identificador: `R-PRO-001`. Versión `1.0.0`. Módulo: prosodia.
- Condición: `reason !== 'ok'`. Textos: `empty` → `labelReasonEmpty`; `silent` → `labelReasonSilent`; `too-short` → `labelReasonShort`; `no-voicing` → `labelReasonNoVoicing`; cualquier otro valor distinto de `ok` → `labelReasonOther`.
- Entrada: esa etiqueta.
- Efecto: la toma no produjo métricas y se dice por qué.
- Fuente: plan del motor y los valores de `reason` ya persistidos. No se abre `src/Screens/ProsodyAnalysis/`.
- Mitigación: no se fabrican duración, núcleos ni rango tonal. No se emite `R-PRO-002`.

## R-PRO-002

- Identificador: `R-PRO-002`. Versión `1.0.0`. Módulo: prosodia.
- Condición: `reason === 'ok'`. Los huecos salen de `metrics`. Un métrica `null` se escribe con `labelUnavailable`.
- Entrada: duración en segundos, núcleos silábicos, pausas, rango tonal en semitonos y velocidades de habla y de articulación.
- Efecto: registro descriptivo y constancia de que no hay baremo poblacional de referencia. La lectura corresponde al profesional.
- Fuente: plan del motor (`R-PRO-002`). El plan dice «baremo poblacional normativo»; la plantilla dice «baremo poblacional de referencia» para no usar la familia léxica vetada. El sentido es el de ausencia de baremo, que es lo que la función actual ya dice.
- Mitigación: no hay corte de aprobado. Una toma `ok` con métricas a `null` no se narra como habla medida.

## R-ART-001

- Identificador: `R-ART-001`. Versión `1.0.0`. Módulo: articulación.
- Condición: `evaluatedCount === 0`.
- Entrada: ninguna. Plantilla fija.
- Efecto: exploración incompleta.
- Fuente: plan del motor.
- Mitigación: no se emite un porcentaje de producción. No se emiten `R-ART-002` ni `R-ART-003`.

## R-ART-002

- Identificador: `R-ART-002`. Versión `1.0.0`. Módulo: articulación.
- Condición: `evaluatedCount > 0`.
- Entrada: evaluados, total, `correctPct` y desglose `sodaCounts` de S, O, D y A.
- Efecto: resumen cuantitativo SODA.
- Fuente: plan del motor y `computeArticulationScore`, que ya persiste estos campos.
- Mitigación: el denominador es `totalCount`, no solo lo evaluado, para que el porcentaje no se lea sobre una base escondida. `correctPct` es el persistido; el motor no lo recalcula con otro redondeo en esta versión.

## R-ART-003

- Identificador: `R-ART-003`. Versión `1.0.0`. Módulo: articulación.
- Condición: `evaluatedCount > 0` y `affectedPhonemes` no está vacío. El agrupamiento usa `phonemeStatus[].place` cuando el fonema coincide.
- Entrada: lista de fonemas con su punto de articulación.
- Efecto: relación de errores sistemáticos y sugerencia de valoración logopédica miofuncional y fonética.
- Fuente: plan del motor.
- Mitigación: sin fonemas afectados no se sugiere esa valoración por esta regla. La sugerencia entra porque el plan la escribe.

## R-ASH-001

- Identificador: `R-ASH-001`. Versión `1.0.0`. Módulo: ASHA.
- Condición: `riskLevel === 'green'`.
- Entrada: banda de edad.
- Efecto: los hitos contestados de esa banda están cumplidos.
- Fuente: plan del motor y `evaluateAshaScreening`.
- Mitigación: no se traduce `green` como «normal». No se emite junto con `R-ASH-003`.

## R-ASH-002

- Identificador: `R-ASH-002`. Versión `1.0.0`. Módulo: ASHA.
- Condición: `riskLevel === 'yellow'`.
- Entrada: banda y dominios de `failedDomains` (`labelAshaReceptive`, `labelAshaExpressive`, `labelAshaPragmatic`).
- Efecto: hitos no cumplidos sin bandera roja, con los dominios implicados.
- Fuente: plan del motor.
- Mitigación: `yellow` no se narra como aviso menor sin dominios. Si `failedDomains` viene vacío, el hueco es `labelUnavailable`.

## R-ASH-003

- Identificador: `R-ASH-003`. Versión `1.0.0`. Módulo: ASHA.
- Condición: `riskLevel === 'red'`.
- Entrada: banda y dominios.
- Efecto: banderas rojas no cumplidas y sugerencia de rutas de derivación interdisciplinar.
- Fuente: plan del motor. El motor CDSS actual ya genera derivaciones en castellano; esta plantilla no copia la frase «descartar hipoacusia» de `ashaCdssEngine.ts`.
- Mitigación: la derivación de esta regla es la del plan (interdisciplinar), trazada con `R-ASH-003`. El cruce con M-CHAT, si dispara, va aparte en `R-CROSS-006`.

## R-AUT-001

- Identificador: `R-AUT-001`. Versión `1.0.0`. Módulo: M-CHAT-R.
- Condición: la fila es `instrument === 'autism-tea'` y `answers` tiene algún `null`, o el número de respuestas no nulas es menor que `total`. Si la fila no existe, no hay hecho: el módulo no se hizo, y eso no es una banda favorable.
- Entrada: ninguna. Plantilla fija.
- Efecto: cuestionario incompleto. No se emite banda.
- Fuente: plan del motor (`R-AUT-001`).
- Mitigación: no se usa `isRiskAns`, que trata `null` como «no es respuesta de riesgo». Un ítem sin contestar no suma como ítem sin riesgo y no alimenta `R-AUT-002`.

## R-AUT-002

- Identificador: `R-AUT-002`. Versión `1.0.0`. Módulo: M-CHAT-R.
- Condición: fila `autism-tea` completa (no dispara `R-AUT-001`) y `score` numérico. `rec` es `2` si `score >= 8`, `1` si `score` está entre 3 y 7 inclusive, `0` si `score` es menor de 3. La banda sale de `riskLevel` persistido (`labelRiskLow`, `labelRiskMed`, `labelRiskHigh`) y tiene que coincidir con ese corte; si no coincide, el hecho usa el corte del `score`, que es el del plan (0–2, 3–7, 8–20).
- Entrada: puntuación, banda y `rec`.
- Efecto: puntuación sobre 20. De 3 a 7, entrevista de seguimiento. Desde 8, derivación directa a atención temprana o neuropediatría. Por debajo de 3, solo la puntuación y la banda.
- Fuente: plan del motor y Robins y colaboradores (M-CHAT-R/F), citados por el plan. `levelFromScore` ya parte en 3 y en 8.
- Mitigación: por debajo de 3 no se añade una frase de tranquilidad. La derivación desde 8 es la del plan.

## R-DYS-001

- Identificador: `R-DYS-001`. Versión `1.0.0`. Módulo: disfagia MECV-V.
- Condición: `safetyAltered === false` y `efficacyAltered === false`.
- Entrada: ninguna. Plantilla fija.
- Efecto: sin signos de compromiso de eficacia ni de seguridad en los bolos evaluados.
- Fuente: plan del motor y Clavé y colaboradores (MECV-V).
- Mitigación: si uno de los dos booleanos faltara, no se elige esta rama. Hoy el modelo los persiste como boolean, con defecto `false`: un registro creado sin pasar por la pantalla podría llegar en falso. La oleada 2 solo emite `R-DYS-001` cuando los dos son `false` y `bolus` no está vacío. `bolus` vacío es exploración incompleta y no esta regla (se trata como dato ausente, nivel de aviso, sin `ruleId` de compromiso ausente). Esta salvaguarda no está en el plan como `ruleId`; queda aquí para no cumplir `R-DYS-001` con una fila vacía.

## R-DYS-002

- Identificador: `R-DYS-002`. Versión `1.0.0`. Módulo: disfagia MECV-V.
- Condición: `efficacyAltered === true` y `safetyAltered === false`.
- Entrada: `recommendation`. Si viene vacía, `labelUnavailable`.
- Efecto: compromiso de eficacia sin compromiso respiratorio, más la recomendación registrada.
- Fuente: plan del motor (sello labial, residuo, deglución fraccionada).
- Mitigación: no se afirma seguridad de la vía aérea más allá de `safetyAltered === false` en los bolos evaluados.

## R-DYS-003

- Identificador: `R-DYS-003`. Versión `1.0.0`. Módulo: disfagia MECV-V.
- Condición: `safetyAltered === true`. En la pantalla, eso incluye tos, cambio vocal o caída de SpO2 de 3 % o más respecto a `basalSpO2`.
- Entrada: `minSpO2`, `maxDrop` y `recommendation`. Un número `null` se escribe con `labelUnavailable`.
- Efecto: compromiso de seguridad, con la SpO2 mínima, la caída máxima y la recomendación de viscosidad o volumen que ya guardó la pantalla.
- Fuente: plan del motor y Clavé y colaboradores (MECV-V).
- Mitigación: si `maxDrop` es `null`, la frase no inventa una caída de 3 %. El booleano `safetyAltered` sigue siendo el que dispara la regla, porque es el veredicto persistido.

## R-SAH-001

- Identificador: `R-SAH-001`. Versión `1.0.0`. Módulo: cribado SAHS.
- Condición: la fila `SahsScreening` existe. No hay una segunda regla de «sospecha baja = favorable» escondida: la sospecha `low` también se enuncia, con su etiqueta.
- Entrada: `psqYesCount`, `psqTotal`, `brodsky` (o `labelUnavailable`), categoría de IMC (`labelImcRef` para el token `normo`, sin verter «normal»; `labelImcSobrepeso`; `labelImcObesidad`) y sospecha (`labelSahsLow`, `labelSahsMed`, `labelSahsHigh`).
- Efecto: resumen PSQ, Brodsky, IMC y sospecha orientativa. La confirmación corresponde a una polisomnografía en Unidad de Sueño.
- Fuente: plan del motor y Chervin y colaboradores (PSQ). El plan escribe «el diagnóstico definitivo exige polisomnografía»; la plantilla usa la formulación de la sección de léxico.
- Mitigación: `low` no se narra como ausencia de enfermedad. El cálculo de la sospecha sigue siendo el de `computeSahsScore` (el plan lo llama `computeSahsResult`; ese nombre no existe). El motor no rehace el cuestionario.

## R-EF-001

- Identificador: `R-EF-001`. Versión `1.0.0`. Módulo: funciones ejecutivas.
- Condición: `overallScore === null`. Eso es lo que `efOverallScore` persiste cuando no hay ningún dominio completado.
- Entrada: ninguna. Plantilla fija.
- Efecto: sin mini-juegos completados. No hay índice global.
- Fuente: plan del motor.
- Mitigación: no se emite `R-EF-002`. No se compara `null` con 65 ni con 70.

## R-EF-002

- Identificador: `R-EF-002`. Versión `1.0.0`. Módulo: funciones ejecutivas.
- Condición: `overallScore` es numérico. `anyBelow` es `1` si atención, inhibición, flexibilidad, memoria de trabajo o planificación, estando completada, es menor de 65. Un dominio `null` se lista como no completado, no como por debajo del umbral. La frase de «iguales o superiores al umbral orientativo (≥ 65/100)» solo sale cuando `anyBelow` es `0` y hay al menos un dominio completado (si no, habría disparado `R-EF-001`).
- Entrada: banda `A`–`D`, índice global, dominios completados con su puntuación, dominios por debajo de 65 y el indicador `anyBelow`.
- Efecto: índice y dominios. Por debajo de 65, se nombran. En el otro caso, la frase de sustitución del plan, que reemplaza «Rendimiento dentro de lo esperado en todos los dominios explorados».
- Fuente: plan del motor. Corte 65, no el 80 ni el 60 del juego.
- Mitigación: el índice se acompaña de los dominios que lo forman. Un solo dominio completado no se presenta como batería entera: la plantilla dice «dominios completados» y el motor incluye el recuento en ese hueco.

## Qué no demuestra esta matriz

- No demuestra que el motor exista. `src/PDF/nlgReportEngine.ts` no está escrito. Lo escribe la oleada 2.
- No demuestra las otras seis lenguas. Sin ellas el tipo `UiStrings` no cierra.
- No cambia `VOICE_NORMS` ni el audiograma. Hasta la oleada 3 la pantalla puede seguir mostrando la etiqueta vieja mientras el catálogo `nlg` ya tiene la frase nueva. Es el corte previsto: esta oleada solo deja el contrato en castellano.
- No recorre un informe en el emulador. No hay llamada desde `ResultadosFinalScreen`.
