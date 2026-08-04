# ADR — Inferencia de IA en el dispositivo (Línea A-bis)

> **Estado: RATIFICADO** por el responsable del proyecto (agosto 2026).
> La decisión que sigue es vinculante: revertirla —embarcar un modelo— exige
> reabrir este documento y el expediente, no es un cambio de implementación.
>
> **Pregunta:** ¿debe VIA+ incorporar un modelo neuronal que se ejecute en el
> dispositivo para detectar distorsiones articulatorias (GOP sobre
> posteriorgramas, Línea A-bis)?
>
> **Recomendación:** **no ahora.** Mantener el principio vigente y abrir una vía
> intermedia —detección acústica **determinista**— que resuelve buena parte del
> problema clínico sin activar ninguna de las consecuencias regulatorias.

---

## 1. Qué está en juego

El principio rector de VIA+ dice: **«cero IA en el dispositivo»**. Los modelos
neuronales solo corren en *build-time* (`tools/nos/`); en runtime la app
reproduce ficheros ya empaquetados y mide con DSP determinista.

No es una postura estética. Es una **línea argumental del expediente**: sostiene
que el dispositivo médico no incorpora inferencia estadística como componente, y
de ahí se derivan simplificaciones reales en verificación, gestión de
configuración y análisis de riesgos.

La Línea A-bis pide romperla, y conviene ser preciso sobre por qué querría uno
romperla: **la distorsión (D) del registro SODA no es detectable desde texto.**
Una /s/ interdental o una /r/ mal vibrada producen exactamente la misma cadena
que la producción correcta. El alineamiento fonémico ya implementado
(`articulationPhonetics.ts`) resuelve S, O y A; la D queda fuera de su alcance
por construcción, no por falta de esfuerzo.

## 2. Lo que NO cuenta como romper el principio

Conviene delimitarlo, porque si no la discusión se vuelve difusa:

| Componente | ¿Es inferencia de IA en el dispositivo? |
|---|---|
| DSP del análisis de voz y prosodia (autocorrelación, LPC, Levinson-Durbin) | **No.** Algoritmos clásicos, deterministas, reproducibles y validados contra Praat |
| Conversión grafema→fonema y alineamiento por distancia de edición | **No.** Tabla de reglas y programación dinámica: auditable línea a línea |
| Voces neuronales de las consignas | **No en el dispositivo.** El modelo corre en CI; la app reproduce un `.m4a` |
| Reconocedor del sistema en modo local (A2) | **Zona gris.** Hay un modelo, pero es del sistema operativo, no un componente que VIA+ distribuya, versione ni caracterice. Y su salida NO puntúa: es ayuda de cribado que el clínico firma |
| Zipformer CTC + GOP empaquetado en el APK | **Sí, inequívocamente** |

La diferencia decisiva no es «hay o no hay estadística», sino **quién responde
del modelo y qué decide su salida**. Un modelo distribuido por nosotros, cuyos
pesos versionamos y cuya salida propone una clasificación clínica, es un
componente del dispositivo médico.

## 3. Consecuencias de adoptarlo

### 3.1 MDR / IEC 62304

El modelo pasa a ser **elemento de software del dispositivo**, con todo lo que
eso arrastra: identificación y control de versiones de los pesos, verificación
propia, análisis de riesgos específico (ISO 14971) del modo de fallo
«clasificación errónea plausible», y caracterización del rendimiento **por
subgrupos** — edad, sexo, variedad dialectal —, que en una app con sesión
castellana, gallega, vasca y dominicana no es un detalle.

No cambia por sí solo la clase (seguimos en IIa por la Regla 11), pero engorda
el expediente de forma sustancial.

### 3.2 Reglamento de IA (UE) 2024/1689 — el punto que decide

Este es el argumento que más pesa y el que conviene verificar con el organismo
notificado antes de nada.

El Reglamento de IA clasifica como **alto riesgo** los sistemas de IA que son
producto —o componente de seguridad de un producto— cubierto por la legislación
de armonización del Anexo I **y** que requieren evaluación de la conformidad por
tercero. **El MDR está en ese Anexo I, y VIA+ es Clase IIa, que exige organismo
notificado.**

Es decir: un modelo embarcado cuya salida propone una clasificación clínica
tiene muy probablemente la consideración de **sistema de IA de alto riesgo**, con
sus obligaciones propias —gestión de riesgos, gobernanza de datos de
entrenamiento, documentación técnica, registro de eventos, supervisión humana,
exactitud/robustez/ciberseguridad— integradas en la evaluación MDR.

> **Esto no es una opinión jurídica.** Es la lectura razonada del articulado y
> debe confirmarse con el consultor regulatorio y el organismo notificado antes
> de tomar la decisión. Pero el orden de magnitud del coste está claro, y es
> mucho mayor que «añadir una dependencia».

### 3.3 Lo que además no tenemos hoy

- **Corpus.** No hay habla infantil española anotada por logopeda con la que
  entrenar ni validar. Sin él, ni siquiera se puede medir si el GOP funciona.
- **Peso y superficie.** Un Zipformer ronda 80–100 MB, con su runtime ONNX.
- **Sesgo dialectal.** Un modelo entrenado en castellano peninsular aplicado a
  habla dominicana produciría error sistemático justo en la población que el
  proyecto quiere servir — y presentado como medida objetiva.

## 4. Opciones

| | Opción | Coste | Qué resuelve |
|---|---|---|---|
| **A** | Mantener el principio. A-bis se queda en su mitad no acústica; la D la marca el clínico de oído | Cero | Nada nuevo, pero nada se rompe |
| **B** | Embarcar GOP neuronal | Alto: AI Act alto riesgo + corpus + expediente | La D completa, si el modelo funciona en habla infantil |
| **C** | **Detección acústica DETERMINISTA de distorsiones concretas** | Medio-bajo | Un subconjunto de distorsiones, sin tocar el principio |

### La opción C, que es la que propongo explorar

La D no exige un modelo: exige mirar la señal. Y varias de las distorsiones
frecuentes en clínica infantil tienen **correlatos acústicos medibles con DSP
clásico**, del mismo tipo que el módulo ya ejecuta:

- **Sigmatismo interdental** (/s/ realizada como [θ]): el centro de gravedad
  espectral y el pico de la fricativa bajan de forma marcada respecto a una /s/
  alveolar. Es una medida espectral, no una clasificación aprendida.
- **Rotacismo** (/r/ vibrante mal realizada): el número de ciclos de vibración
  se lee en la periodicidad de la envolvente de amplitud en la banda de ~20–35 Hz.
  Contar vibraciones es determinista.
- **Sonorización / ensordecimiento** de oclusivas: presencia o ausencia de barra
  de sonoridad y duración del VOT, ambas medibles sobre la señal.

Ninguna de las tres necesita pesos, ni red, ni runtime nuevo. Todas son
verificables contra Praat en el banco que ya existe (`tools/acoustics/`), igual
que se verificó F0, HNR y formantes.

No cubre toda la D —no hay medida clásica para cualquier distorsión— pero cubre
las de mayor frecuencia clínica, y lo que no cubra se declara «no estimable»,
que es la doctrina de la casa.

## 5. Decisión adoptada

1. **Se adopta A.** El principio se mantiene, el expediente no se toca y la
   D sigue siendo del clínico, que es donde está hoy y donde nadie la echa de
   menos como defecto.
2. **Se abre C como línea de trabajo**, con el mismo patrón que la prosodia:
   módulo puro en TypeScript, validado contra Praat en CI, y afirmaciones
   descriptivas hasta que haya validación clínica sobre habla real.
3. **Se reserva B** para si C resulta insuficiente, y solo tras: confirmación
   regulatoria del encaje en el Reglamento de IA, corpus infantil español
   anotado, y análisis de sesgo dialectal. Ninguna de las tres existe hoy.

> **Condición que no debería negociarse:** si algún día se embarca un modelo, su
> salida entra en el informe como **propuesta con incertidumbre declarada**,
> nunca como medida. Es la misma regla que ya gobierna la prosodia sin baremo y
> la propuesta SODA del alineamiento fonémico.

## 6. Registro de la decisión

| Campo | Valor |
|---|---|
| Estado | **RATIFICADO** — agosto 2026 |
| Firmante | F. A. Betances (médico · responsable del proyecto) |
| Decisión adoptada | **A** ahora · **C** como línea de trabajo · **B** reservada y condicionada |
| Condición para reabrir B | Confirmación regulatoria del encaje en el Reglamento (UE) 2024/1689 **+** corpus infantil español anotado **+** análisis de sesgo dialectal. Las tres, no una |
| Afecta a | Línea A-bis · principio «cero IA en el dispositivo» · expediente MDR |
| Verificación previa a B | Encaje en Reglamento (UE) 2024/1689 con organismo notificado |
| Documentos relacionados | [`plan-prosodia-y-asr.md`](./plan-prosodia-y-asr.md) · [`evaluacion-prosodia-y-asr.md`](./evaluacion-prosodia-y-asr.md) |
