# B0 — Módulo de prosodia: tarea de habla y política de afirmaciones

> Decisión clínica previa que desbloquea B3–B5 del
> [plan de trabajo](./plan-prosodia-y-asr.md). Dos preguntas que el software no
> puede resolver solo: **qué se le pide al niño** y **qué se afirma con lo
> medido**.
>
> Redactado sobre revisión de literatura (agosto 2026).
>
> **Estado: RATIFICADO** por el responsable clínico (agosto 2026). Las dos
> decisiones que siguen son vinculantes para el módulo; cambiarlas —en
> particular pasar a afirmación normativa— exige reabrir este documento y el
> expediente, no es un cambio de interfaz.

---

## Resumen de las dos decisiones

| | Decisión |
|---|---|
| **B0.1 — Tarea** | Narración provocada con apoyo visual, en dos bandas de edad, **con guion fijo**. Objetivo: 30–60 s de habla conectada válida |
| **B0.2 — Afirmaciones** | **Descriptivas, nunca normativas.** Sin percentiles, sin puntuaciones z, sin etiquetas «normal/alterado». Comparación permitida: el niño consigo mismo entre tomas |

---

## Estado de la evidencia

Tres hallazgos de la revisión condicionan todo lo demás.

### 1. Existen baremos pediátricos de ritmo — pero no en español, y no son transferibles

Hay curvas normativas de tasa de articulación por percentiles para 30–119 meses
construidas sobre 570 niños con desarrollo típico, con mediana de 2.7 sílabas/s
a los 36 meses y 3.3 sílabas/s a los 96 [1]. Existen también baremos de tasa
máxima de repetición en neerlandés sobre 1.014 niños [4], de control motor del
habla en turco sobre 427 [8], y datos evolutivos en húngaro [6] y alemán [7].

Ninguno es español, y **ninguno es trasladable**, por dos motivos
independientes:

- **La lengua.** Los propios autores del baremo neerlandés recomiendan
  explícitamente recoger datos normativos por lengua con el mismo protocolo [4].
- **La tarea.** La tasa depende fuertemente de qué se pide. El habla automática y
  la repetición son significativamente más rápidas que el habla imitada [2]; la
  generación y el recuento de historias dan tasas más lentas que la narración
  espontánea, con patrones de pausa distintos [6]; y la longitud del enunciado
  modifica la tasa por sí sola [3]. El baremo de [1] se construyó sobre
  repetición de frases y eliminando las pausas mayores de 150 ms: aplicar sus
  percentiles a una narración libre sería comparar dos cosas distintas.

> **Consecuencia:** un baremo de otra lengua y otra tarea no sirve, y aplicarlo
> daría una falsa precisión clínica. De ahí B0.2.

### 2. La variabilidad entre niños típicos es sustancial

El estudio de 570 niños concluye que «la variabilidad en la tasa de articulación
entre niños típicos fue sustancial» [1]. El seguimiento longitudinal de
preescolares encontró que la tasa **no** aumentó significativamente con la edad,
que la variabilidad **no** disminuyó, y que el desarrollo es no lineal [2].

> **Consecuencia:** incluso con baremo español, una lectura individual fuera de
> rango significaría poco por sí sola. Refuerza B0.2.

### 3. Las medidas de tono discriminan; las de ritmo, mucho menos

Un metaanálisis sobre prosodia natural en TEA encontró tamaños de efecto de
moderados a grandes en los parámetros de tono —media 0.35, rango 0.67,
desviación típica 0.57, variabilidad 0.51— pero **poco fiables en los temporales**:
0.074 para duración y −0.055 para tasa de habla [5].

> **Consecuencia clínica y de diseño:** el peso del informe debe recaer en
> **rango y variabilidad de F0**, no en la tasa de habla. Esto reordena la
> jerarquía de la interfaz y del PDF, y coincide con que la tasa es además la
> medida más frágil de medir (ver `tools/acoustics/README.md`).

---

## B0.1 — Decisión: la tarea de habla

### Elicitación narrativa con apoyo visual

Se adopta **narración provocada** (recuento o generación de historia a partir de
lámina), no conversación libre ni lectura como vía primaria.

Justificación: un estudio observacional sobre 53 niños comparó las tareas de
referencia de muestreo de habla corrida en evaluación vocal pediátrica —pregunta
sobre la voz, conversación informal, párrafo de lectura— con tareas de
elicitación narrativa, y concluyó que un procedimiento de recuento o generación
de historia **es adecuado** para obtener la muestra, con correlaciones y
decisiones diagnósticas equivalentes [8]. Además, la conversación informal y el
párrafo de lectura tienen un problema práctico en nuestra población: no sirven
con prelectores ni con niños con dificultades de lectura, que son parte del
público de VIA+.

### Dos bandas de edad

| Banda | Tarea | Apoyo |
|---|---|---|
| **3–6 años** (prelectores) | Generación de historia sobre lámina secuenciada | Lámina en pantalla + consigna hablada |
| **7–12 años** | Recuento de historia + narración libre sobre lámina | Lámina en pantalla + consigna hablada |

La consigna se locuta con la capa `@/Voice`, como el resto de la app, para que
sea **idéntica entre exploradores**. Una consigna leída por el clínico varía en
velocidad y entonación, y el niño imita al modelo: sería introducir en la medida
justo la variable que se quiere medir.

### Objetivo de muestra: 30–60 s de habla conectada válida

«Válida» = tras descontar pausas y tramos no analizables, no de reloj de pared.

**Este umbral es una decisión de ingeniería, no un hallazgo de la literatura, y
hay que decirlo.** La evidencia sobre duración mínima de muestra se refiere al
análisis de muestras de lenguaje (medidas léxicas y gramaticales), donde 7
minutos bastan para medidas fiables en escolares y 3 minutos para algunas [3 en
la segunda búsqueda]. Las medidas **acústicas** de prosodia convergen mucho
antes que las léxicas —un rango de F0 se estabiliza con decenas de segundos de
habla sonora—, pero **la fiabilidad test-retest de estas métricas concretas a
30–60 s no está establecida para esta tarea**. Es una pregunta explícita para
B6, no algo que este documento dé por resuelto.

### Criterios de toma válida (a implementar en B4)

Se comprueban **durante** la captura, no después: un niño de cinco años no
repite tres veces una toma de 45 segundos.

1. Ruido de sala dentro de rango — enlazar con el módulo `RoomNoiseCheck`, que
   ya existe. Una toma prosódica en sala ruidosa no es interpretable.
2. Sin saturación ni nivel insuficiente.
3. Mínimo de habla sonora acumulada antes de permitir cerrar la toma.
4. **Sin solapamiento del explorador.** Si el clínico habla, esas sílabas y esas
   pausas entran en la medida. La consigna debe terminar antes de que empiece la
   captura, y la interfaz debe dejarlo explícito.

### Lo que la tarea NO es

No sustituye a **PEPS-C** (*Profiling Elements of Prosodic Systems in
Children*), el instrumento de referencia para prosodia infantil, que evalúa
función comunicativa —interacción, afecto, delimitación, foco— por vía
perceptiva y en comprensión además de en producción [4 en la segunda búsqueda].
Este módulo mide **parámetros acústicos de producción**. Son complementarios, y
el informe no debe insinuar lo contrario.

---

## B0.2 — Decisión: qué se afirma

### Descriptivo, no normativo

El módulo publica **valores medidos con sus unidades**, el contorno de F0 y las
pausas sobre la línea temporal. **No** publica percentiles, puntuaciones z,
etiquetas «normal / límite / alterado», ni comparación con población de
referencia.

Es la misma doctrina que ya practica el DSP cuando declara «formantes no
estimables» en lugar de fabricar un F3 a partir del F2, y la que sostiene el
diseño de `ProsodyMetrics`, donde toda métrica derivada es `number | null`:
**cero pausas y pausas no medidas son clínicamente lo contrario.**

### Lo que sí se permite afirmar

1. **El valor medido**, con su unidad y su método.
2. **Que no se ha podido medir**, y por qué (`reason`).
3. **Cambio intrasujeto**: comparar tomas del mismo niño en la misma tarea a lo
   largo del seguimiento. No necesita baremo poblacional —el niño es su propio
   control— y es lo que de verdad interesa en rehabilitación del lenguaje, que
   es el uso previsto de VIA+.

### Jerarquía del informe

Por el hallazgo [5]: **primero tono, después ritmo.**

1. Rango tonal y variabilidad de F0 en semitonos (las que discriminan).
2. Contorno de cierre.
3. Pausas.
4. Tasa de habla y de articulación, **con la advertencia de que es la medida más
   frágil** del conjunto y la que menos discrimina en la evidencia disponible.

### Advertencia que debe constar en el informe

Las medidas acústicas de prosodia **no equivalen** al juicio perceptivo de
prosodia. En un estudio de validación sobre 33 niños con apraxia del habla
infantil, **ninguna** de las nueve medidas acústicas correlacionó
significativamente con el juicio clínico-perceptivo de prosodia [6 en la segunda
búsqueda]. Las dos cosas informan, pero no son intercambiables, y el informe no
puede presentarse como sustituto del criterio del logopeda.

### Consecuencia regulatoria

Al no emitir afirmación normativa ni diagnóstica, el módulo se mantiene como
**instrumento de medida y registro**, en la misma línea que el resto de la
batería. Cualquier futuro cambio a afirmación normativa —introducir percentiles,
por ejemplo— **exige baremo español propio y reapertura del expediente**: no es
un cambio de interfaz.

---

## Qué queda abierto (entra en B6)

- Fiabilidad test-retest de cada métrica a 30–60 s **en esta tarea**.
- Concordancia del recuento silábico automático con recuento manual de logopeda
  sobre habla infantil real, con coarticulación, disfluencias y ruido de sala.
  Es la medida más frágil del módulo.
- Si en el futuro se quisiera baremo español: exigiría muestra propia con este
  protocolo exacto, por las razones de [4] y de [2], [3] y [6].

---

## Referencias

1. [Speech Development Between 30 and 119 Months in Typical Children II: Articulation Rate Growth Curves](https://consensus.app/papers/details/6e34ede7226d55ca85d40c914913087e/?utm_source=claude_desktop) — Mahr et al., 2021, *JSLHR* (13 citas)
2. [Articulation rate in preschool children: a 3-year longitudinal study](https://consensus.app/papers/details/62333b522171557e9eec2d5f8bdfb073/?utm_source=claude_desktop) — Walker et al., 2006, *Int J Lang Commun Disord* (66 citas)
3. [Speech Rate Varies With Sentence Length in Typically Developing Children](https://consensus.app/papers/details/ad75fa2bfdfe5062af15fe4dfe9b2bf3/?utm_source=claude_desktop) — Darling-White et al., 2021, *JSLHR* (15 citas)
4. [Maximum repetition rate in a large cross-sectional sample of typically developing Dutch-speaking children](https://consensus.app/papers/details/2d7cc2df940a5ca0906ee1d85fbef994/?utm_source=claude_desktop) — van Haaften et al., 2021, *Int J Speech Lang Pathol* (8 citas)
5. [Can Natural Speech Prosody Distinguish Autism Spectrum Disorders? A Meta-Analysis](https://consensus.app/papers/details/93e91e192ff25517a50667e87a6e85f3/?utm_source=claude_desktop) — Ma et al., 2024, *Behavioral Sciences* (14 citas)
6. [Speech tempo in Hungarian speaking children and adolescents](https://consensus.app/papers/details/4e247fb221eb5baea0e261abf8f5fc6e/?utm_source=claude_desktop) — Bóna et al., 2022, *J Acoust Soc Am* (4 citas)
7. [Intelligibility, Articulation Rate, Fluency, and Communicative Efficiency in Typically Developing Children](https://consensus.app/papers/details/6f84fc5bbd935aa8baad71552bf8853b/?utm_source=claude_desktop) — Schölderle et al., 2021, *JSLHR* (8 citas)
8. [An Observational Study of Discourse Tasks and Running Speech Sampling in the Assessment of Paediatric Voice Quality](https://consensus.app/papers/details/9feb65ceffe351368c01524f8dca2ad8/?utm_source=claude_desktop) — Reynolds et al., 2025, *Int J Lang Commun Disord*

Referencias de la segunda búsqueda citadas en el texto:

- [Assessing intonation and prosody in children with atypical language development: the PEPS-C test](https://consensus.app/papers/details/7f62e95d9b4155bf8113a1b4cb6e90cc/?utm_source=claude_desktop) — Peppé & McCann, 2003, *Clin Linguist Phon* (218 citas)
- [The Reliability of Short Conversational Language Sample Measures in Children With and Without Developmental Language Disorder](https://consensus.app/papers/details/dbfcbae2da8751a6962fbe9f7e265cf7/?utm_source=claude_desktop) — Wilder et al., 2022, *JSLHR* (8 citas)
- [Acoustic Measures of Word-Level Prosody in Childhood Apraxia of Speech: An Initial Validation Study](https://consensus.app/papers/details/1c15ea09beeb5b05b33db3132a230e82/?utm_source=claude_desktop) — Littlejohn et al., 2025, *Am J Speech Lang Pathol* (1 cita)
