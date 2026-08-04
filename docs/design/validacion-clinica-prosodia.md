# Validación clínica — Módulo de Análisis Prosódico

> **Módulo:** `ProsodyAnalysis` · SaMD Clase IIa (MDR 2017/745).
> **Decisiones previas:** [`b0-prosodia-tarea-y-afirmaciones.md`](./b0-prosodia-tarea-y-afirmaciones.md) (ratificada) ·
> **Riesgos:** [`prosodia-riesgos.md`](./prosodia-riesgos.md).
>
> **Estado:** Parte A **FIRMADA**. Parte B **pendiente de datos**.
> Registro legible por máquina: `assets/prosody-approval.json`.

---

## 0. Por qué este documento tiene dos partes

La validación de este módulo no es una sola cosa, y tratarla como tal sería el
error. Hay dos clases de afirmación, y solo una de ellas se resuelve con la
firma de un clínico:

| | Naturaleza | Cómo se resuelve |
|---|---|---|
| **Parte A — Juicio clínico** | ¿Es adecuada la tarea? ¿Son las láminas apropiadas para la edad? ¿Dice el informe lo que debe decir? | **Firma del responsable clínico.** Es juicio experto, y la firma ES la evidencia |
| **Parte B — Concordancia de medida** | ¿Cuenta bien las sílabas de un niño de cinco años? | **Medición.** Requiere grabaciones reales anotadas. Ninguna firma la sustituye |

La distinción no es formalismo. La Parte A es una decisión y puede tomarse hoy.
La Parte B es un **hecho sobre el mundo**: o el estimador concuerda con el
recuento humano o no, y eso solo se sabe midiéndolo. Declarar validada la
Parte B sin datos pondría en el expediente una afirmación que nadie ha
comprobado —exactamente lo que este módulo evita en todas sus demás decisiones,
desde publicar `null` en vez de cero hasta guardar las tomas fallidas con su
motivo—.

---

## 1. Qué valida ya la máquina, y qué no

| Invariante | Comprobación automática |
|---|---|
| El DSP coincide con Praat en F0 (Δ ≤ 0.03 Hz), rango y SD tonales, y pausas | ✅ CI (`tools/acoustics/`) |
| Recuento de sílabas y de pausas exacto sobre habla sintética | ✅ CI (verdad de campo del guion) |
| Umbrales de publicación: nada se publica sobre muestra insuficiente | ✅ Jest |
| Silencio y ruido de sala no se leen como habla | ✅ Jest (regresión del umbral colapsado) |
| Zero-PHI: no salen contornos ni audio hacia la base de datos | ✅ Jest + guardias de arquitectura |
| El informe imprime siempre la advertencia de ausencia de baremo | ✅ Guardia de arquitectura |
| Un solo micrófono entre módulos | ✅ Jest |

Lo que la máquina **no** puede validar es todo lo de las dos partes que siguen.

---

## 2. Parte A — Juicio clínico (FIRMADA)

Los puntos que siguen los ratifica el responsable clínico. Cada uno es una
decisión sobre adecuación, no una medición.

### A.1 — Tarea de habla

- Narración provocada con apoyo visual como vía primaria, frente a conversación
  libre o lectura.
- Dos bandas: prelector (3–6 a) con escena única; lector (7–12 a) con lámina
  secuenciada de tres viñetas.
- Objetivo de 30–60 s de habla válida, descontando pausas.
- La consigna la locuta la app y no el explorador, para que el modelo prosódico
  que el niño imita sea idéntico entre sesiones.

### A.2 — Estímulos

- `lamina-parque-v1` — 10 elementos describibles, adecuados a 3–6 años.
- `lamina-excursion-v1` — 3 viñetas, 8 elementos, secuencia narrativa cerrada.
- Consignas abiertas («cuéntame…»), que no admiten respuesta de sí o no.

### A.3 — Afirmaciones del informe

- Descriptivas, sin percentiles, sin puntuaciones z, sin etiqueta de normalidad.
- Jerarquía tono → ritmo, y la tasa de habla presentada con su advertencia de
  fragilidad.
- Comparación admitida: intrasujeto y dentro de la misma tarea.
- Constancia de que las medidas acústicas no sustituyen la valoración
  perceptiva del logopeda.

### A.4 — Criterios de toma válida

- Aviso de saturación y de muestra corta durante la captura.
- Distinción entre «no hay señal» y «no habló».
- Las tomas fallidas se registran con su motivo, no se ocultan.

> **Lo que la Parte A NO cubre.** Firmar estos puntos no dice nada sobre la
> exactitud del recuento silábico ni sobre la fiabilidad test-retest de ninguna
> métrica. Esas son Parte B.

---

## 3. Parte B — Concordancia de medida (PENDIENTE DE DATOS)

### 3.1 Qué hay que medir, y por qué esta es la prioridad

La sospecha está fundada, no es cautela genérica. Al verificar los recortes
neuronales de las consignas, el **mismo texto** locutado por **dos voces
distintas** dio 16 y 23 sílabas frente a ~26 reales (ver R-01 en
`prosodia-riesgos.md`). El estimador depende del locutor y tiende a quedarse
corto. Sobre habla infantil —con coarticulación, disfluencias y alargamientos—
puede desviarse mucho más.

Prioridad de medición:

1. **Recuento silábico** (del que dependen las dos tasas). La más frágil.
2. **Recuento y duración de pausas.**
3. **Fiabilidad test-retest** de rango y SD tonales sobre dos tomas del mismo
   niño en la misma sesión.

### 3.2 Muestra

- **n ≥ 30** niños con desarrollo típico, estratificados: ≥ 15 en la banda
  prelectora (3–6 a) y ≥ 15 en la lectora (7–12 a).
- Tomas obtenidas **con el módulo**, en condiciones de consulta reales
  (incluido su ruido de sala habitual), no en cabina.
- Subgrupo de **≥ 10** con segunda toma en la misma sesión, para test-retest.

Es un mínimo pragmático para estimar un ICC con intervalo utilizable, no un
cálculo de potencia formal; si se pretende publicar, procede recalcularlo.

### 3.3 Anotación manual

- Recuento silábico y de pausas por **logopeda**, sobre la señal, con criterio
  documentado. Para que dos anotadores puedan concordar, el criterio tiene que
  estar cerrado ANTES de empezar:

  | Caso | Criterio |
  |---|---|
  | Sílaba | Un núcleo vocálico = una sílaba. Los diptongos cuentan como **una** |
  | Alargamiento (`caaasa`) | **Una** sílaba: alargar no añade núcleo |
  | Repetición disfluente (`ca-ca-casa`) | Se cuentan **todas** las emitidas, no las de la palabra objetivo |
  | Muletillas (`eee`, `mmm`) | **No** cuentan como sílaba; si duran > 250 ms cuentan como pausa llena |
  | Pausa | Silencio > 250 ms **dentro** del habla. El previo al inicio y el posterior al final NO son pausas |
  | Pausa llena | Cuenta como pausa y se anota en `_notas` |
  | Voz del explorador | Se excluye del recuento; si contamina, se descarta la muestra |

- Plantilla de anotación: `tools/acoustics/anotacion-plantilla.json`.
- **Fiabilidad entre anotadores**: un ≥ 20 % de las muestras lo anotan dos
  personas de forma independiente, y se exige **ICC ≥ 0.90** entre ellas.

> Este punto no es opcional. Contrastar el estimador contra un patrón de
> referencia poco fiable no mide el estimador: mide el ruido del patrón. Si los
> anotadores no concuerdan entre sí, la Parte B no puede concluirse.

### 3.4 Criterios de aceptación

| Medida | Criterio | Si no se alcanza |
|---|---|---|
| Recuento silábico | **ICC(A,1) ≥ 0.75** y sesgo medio dentro de ±10 % | **Se retira la tasa de habla y de articulación** del informe; el resto del módulo sigue |
| Recuento de pausas | ICC(A,1) ≥ 0.75 | Se retira el recuento de pausas |
| Test-retest de rango y SD tonales | ICC ≥ 0.75 entre tomas | Se documenta la variabilidad en el informe |

**ICC de concordancia absoluta, no Pearson.** Un estimador que contara
sistemáticamente el 62 % de las sílabas daría Pearson r = 1.00 y sería
inservible; ese es justamente el modo de fallo que se sospecha. Verificado en
el banco: con un sesgo simulado del −38 %, Pearson da 1.000 y el ICC cae a
0.359.

Si la tasa se retira, **el módulo no se retira**: rango tonal, variabilidad,
contorno de cierre y fracción sonora no dependen del recuento silábico, y son
además las medidas con mayor respaldo en la literatura.

### 3.5 Cómo se ejecuta

```bash
# 1. Anotaciones del logopeda (JSON; ver esquema en el encabezado del script).
# 2. Audio en una carpeta LOCAL, fuera del repositorio.
node tools/acoustics/concordance.js \
     --annotations muestras/anotaciones.json \
     --audio-dir muestras/audio \
     --json informe-concordancia.json \
     --fail-under-icc 0.75
```

El banco decodifica cada grabación, la pasa por **el mismo DSP que corre en la
app** y contrasta con la anotación manual: tabla por muestra, ICC, Pearson,
sesgo y límites de concordancia de Bland-Altman. Sale con código distinto de
cero si el ICC queda bajo el umbral declarado.

**Zero-PHI:** el audio vive en una carpeta local que nunca entra al
repositorio; el informe contiene solo cifras. La herramienta no transcribe ni
conserva señal.

---

## 4. Registro de aprobación

`assets/prosody-approval.json` guarda la firma en formato legible por máquina,
con el mismo patrón que `assets/verbal-approval.<lang>.json`. La Parte B queda
con `status: "pendiente-datos"` y su bloque `measured` vacío **hasta que exista
la medición**; rellenarlo antes sería falsear el expediente.

## 5. Qué NO habilita esta validación

- No habilita afirmación normativa: sigue sin haber baremo pediátrico español,
  y añadirlo exigiría muestra propia con este protocolo exacto (B0.2).
- No habilita uso diagnóstico: el módulo es instrumento de medida y registro.
- Mientras la Parte B esté pendiente, las tasas de habla y articulación se
  presentan como lo que son: **medidas exploratorias con advertencia**.
