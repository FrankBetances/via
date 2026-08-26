# Cribado de Hitos del Lenguaje (ASHA) · módulo `AshaScreening`

Módulo de apoyo a la decisión clínica (CDSS) para el cribado del desarrollo del
lenguaje y la comunicación entre 0 y 5 años, sobre umbrales de **percentil 75**
de la *American Speech-Language-Hearing Association*. Es determinista, se
resuelve entero en el dispositivo y no envía nada a ninguna parte.

## Procedencia

Lo escribió Gemini en la rama `ASHA_UX` (commit `6c11a5a`, 26/8/2026). Aquí se
integró **solo el módulo**; el resto de esa rama —el rediseño de la interfaz, el
DSP «alineado con Praat» y las tres correcciones de voz— fue por caminos
distintos, y conviene que conste por qué:

| Parte de `ASHA_UX` | Qué se hizo | Por qué |
| --- | --- | --- |
| Módulo ASHA | Integrado con correcciones (ver abajo) | Aporta un módulo que no existía |
| Normalización de reproducción, medidor VU, sonómetro compartido, `rate` 0,95 | Integrados aparte | Mejoras reales y verificables |
| DSP: coste de octava y jitter/shimmer ciclo a ciclo | **Integrado en la tanda C, tras medirlo** | La primera lectura fue que era una regresión, y era falsa: el test que fallaba usaba una señal mal construida. Arbitrado con Praat, el coste de octava corrige una /a/ de 150 Hz que salía en 233 Hz, y la medida ciclo a ciclo corrige una infravaloración del jitter y el shimmer de seis a diez veces. Ver `tools/acoustics/README.md` |
| Rediseño de Bienvenida, Créditos y CAP | **Integrado en la tanda D** | Sin pérdida de datos clínicos: el CAP escribe exactamente los mismos campos y `clinicalAssessmentResult.ts` (la lógica) no se toca |
| Retirada del `stop()` previo a `speak()` | **NO integrado** | Valeria+ hace justo eso en sus tres puntos de entrada (`src/valeriaVoice.ts:318, 329, 390`) y locuta. `expo-speech` habla con `TextToSpeech.QUEUE_ADD` (`SpeechModule.kt:126`): sin el `stop()`, las locuciones se **encolan** en vez de relevarse |
| `canSpeak()` / `canSpeakText()` degradados a «¿existe el módulo?» | **NO integrado** | Es el patrón que prohíbe la regla 4: enumerar no es emitir. Y en la app es inerte, porque el adaptador se instala siempre (`src/App.tsx:58`) |
| Respaldo directo a `expo-speech` en `viaVoice.ts` | **NO integrado** | Inalcanzable: solo se dispara si el adaptador verbal NO está instalado, y se instala siempre |
| Borrado de los comentarios de `verbalAudiometryAudio.ts` y `viaVoice.ts` | **NO integrado** | Son el registro de por qué cada decisión existe. Una decisión sin motivo escrito no se revisa: se hereda |

### Dos cambios de texto que NO se aplicaron, y por qué

Los trae el rediseño y no son de estilo:

+ **Veredictos del CAP renombrados**: «Restricción» → «Adaptar» y «Bloqueo» →
  «Bloqueado», con las etiquetas duplicadas dentro de la hoja de estilos en vez
  de leerlas de `DOMAIN_LABELS`. Renombrar un veredicto clínico es una decisión
  clínica. Se mantiene el vocabulario actual y una sola fuente para él, vigilado
  por `clinicalAssessmentRender.test.tsx`.
+ **Acreditación de Créditos**: «Innovación tecnológica en salud» → «Innovación
  sanitaria **avalada por el ISCIII**». Es una afirmación más fuerte sobre un
  sello. Se mantiene la actual hasta que Frank confirme los términos.

Los dos están **pendientes de decisión**, no descartados.

El `README_ASHA_UX.md` de esa rama atribuye además al cambio la migración a
`expo-speech`, la sonda `probeSpeech` y el análisis del fallo de `voices()` de
`react-native-tts`. Eso ya estaba en `main` desde los commits `9ca4d69` y
`16d29e5`; no viene de esa rama.

## Piezas

| Fichero | Qué es |
| --- | --- |
| `src/Screens/AshaScreening/ashaMilestones.ts` | Catálogo estático: 21 hitos, 7 bandas de edad, 3 dominios, 8 banderas rojas |
| `src/Screens/AshaScreening/ashaCdssEngine.ts` | `evaluateAshaScreening()`: función pura, sin efectos, sin red |
| `src/Screens/AshaScreening/AshaScreeningScreen.tsx` | Formulario con `react-hook-form`, modal bloqueante ISO 14971 y telemetría Zero-PHI |
| `src/Models/Asha/AshaMilestoneTest.ts` | Entidad TypeORM (`asha_milestone_test`) |
| `src/Repositories/AshaMilestoneTestRepository.ts` | Persistencia local, mismo patrón que el resto de módulos |
| `src/PDF/blocks/AshaScreeningDetail.ts` | Página del informe, con el descargo regulatorio obligatorio |

## Estratificación

+ **Rojo** — al menos una bandera roja no cumplida.
+ **Amarillo** — algún hito fallado, ninguno con bandera roja.
+ **Verde** — todos los hitos de la banda cumplidos.

Un hito **sin contestar no cuenta como fallado**, ni en el motor ni en el
informe: es la regla 4 aplicada a un dato clínico. Un cribado a medias no puede
producir una bandera roja que nadie ha observado.

### Hueco conocido: las banderas rojas se acaban a los 3 años

Las 8 banderas rojas del catálogo están todas entre 0 y 36 meses. En `3-4y` y
`4-5y` no hay ninguna, así que **un niño de cuatro años que falle los tres hitos
de su banda sale «riesgo moderado · watchful waiting», nunca rojo**, y el informe
no pide derivación urgente.

Puede ser deliberado —las señales de alerta de ASHA se concentran en la primera
infancia— o puede ser un hueco. **Está sin decidir.** Queda fijado en
`ashaCdssEngine.test.ts` («DEJA CONSTANCIA de qué bandas pueden llegar a ROJO»)
para que la decisión sea explícita y no se herede sin que nadie la mire.

## Correcciones aplicadas al integrarlo

1. **El informe entero reventaba.** El enunciado del hito `asha_2_3_exp_1` usaba
   `≥`, y las fuentes estándar de pdf-lib codifican en WinAnsi, que no lo tiene:
   `drawText` lanza. `Report.ts` no envuelve los bloques en `try`, así que un
   niño de 2–3 años con cribado ASHA dejaba **sin generar el informe de toda la
   batería**. Vigilado por `src/PDF/blocks/__tests__/ashaScreeningDetail.test.ts`,
   que dibuja las siete bandas contra pdf-lib real.
2. **Los reactivos se solapaban.** Cada uno avanzaba 18 pt fijos mientras
   `drawText` envolvía el enunciado en dos y tres líneas. Ahora el avance sale
   de `textHeight()` (`@/PDF/utils`). Un test que solo mire que las `y` bajan no
   detecta esto: bajaban, solo que demasiado poco.
3. **Un hito sin responder se imprimía como «NO CUMPLE».** Ahora hay un tercer
   estado, `[ SIN EVALUAR ]`.
4. **Un desglose recortado por falta de sitio no lo decía.** Ahora dice cuántos
   reactivos no caben.
5. **La banda de edad se elegía sola.** Leía un `patient.ageMonths` que no
   existe y caía a 24 meses en silencio; la banda decide con qué norma se
   compara al niño. Ahora se deduce de `dobEnc` (`@/Helpers/patientAge`) y la
   pantalla **dice** si viene de la ficha o si hay que elegirla a mano.
6. **La migración estaba muerta.** `CreateAshaMilestoneTestTable…` no estaba
   registrada (`migrations: []`) y el `DataSource` va con `synchronize: true`:
   nunca se ejecutaba. Retirada.
7. `completedAt` estaba en el DTO y no en la entidad. Ahora es columna, como en
   el resto de módulos; el informe fecha por ella y no por `createdAt`.
8. **No aparecía en Resultados.** El módulo se registró en el hub, la
   navegación y el PDF, pero no en `ResultadosFinalScreen`, que es donde el
   clínico mira: el cribado se hacía, se guardaba y no se veía por ningún
   sitio hasta abrir el informe. Añadida su tarjeta, con el desglose por
   dominio sobre los hitos CONTESTADOS (un hito sin responder no cuenta, y el
   denominador lo dice).
9. Nueve errores de `tsc` y seis de `eslint` (contrato de `Header`,
   `RadialBackground`, `TelemetryTracker.endSession`, escalas de `Icon`/`HStack`,
   `Card.maxW`, tipado de `FindOptionsWhere`).

## Lo que NO está verificado

Nada de esto se ha compilado ni abierto en el emulador: las sesiones de Claude
sobre este repositorio no tienen SDK de Android. El módulo está **escrito y
pasado por los gates del repositorio**, no probado en dispositivo. Queda por
comprobar allí, al menos: que la pantalla entra desde el hub, que el modal
bloqueante no se puede saltar, que el registro se guarda y que la página sale en
el PDF.
