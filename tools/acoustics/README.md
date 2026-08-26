# Validación del análisis acústico contra Praat

Banco de referencia que comprueba que las cifras del análisis acústico de VIA+
significan lo que el informe clínico dice que significan. Compara el DSP que
corre **de verdad** en la app con **Praat**, el estándar de facto en fonética
clínica, sobre las mismas señales.

Cubre **dos familias**, que son dos preguntas clínicas distintas sobre la misma
señal:

| Familia | Módulo | Señal | Qué mide |
|---|---|---|---|
| **Vocal sostenida** | `src/Screens/VoiceAnalysis/voiceDsp.ts` | /a/ sostenida | Calidad de la fonación: F0, jitter, shimmer, HNR, formantes |
| **Habla conectada** | `src/Screens/ProsodyAnalysis/prosodyDsp.ts` | cadenas de sílabas con pausas | Dinámica del habla: ritmo, pausas, entonación |

Es una herramienta de **build-time**, igual que `tools/nos/`: los modelos y
librerías de análisis no entran nunca en el dispositivo. La app sigue midiendo
en local y offline.

## Uso

```bash
node tools/acoustics/fixtures.js                     # genera WAVs + medidas de VIA+
pip install -r tools/acoustics/requirements.txt
python3 tools/acoustics/validate.py                  # mide con Praat y compara
```

`validate.py` sale con código distinto de cero si algún parámetro se desvía por
encima de su tolerancia, así que sirve tal cual como puerta de CI.

## Cómo funciona

1. `fixtures.js` sintetiza vocales sostenidas **deterministas** (sin
   `Math.random`: el mismo caso produce siempre el mismo WAV, de modo que un
   cambio en las medidas es un cambio real del DSP y no ruido de muestreo) con
   F0, formantes, jitter, shimmer y contaminación conocidos. En **dos familias
   de fuente**, y hacen falta las dos:
   + **Suma de armónicos** (`vowel`) — espectro suave, fácil de seguir.
   + **Tren de pulsos glotales por resonadores** (`vowelPulsed`, modelo de
     Klatt) — más parecido a una voz real. Los pulsos dejan la autocorrelación
     con picos marcados en cada múltiplo del periodo, que es donde un estimador
     de F0 se equivoca. Sobre la suma de armónicos, los dos estimadores que se
     compararon en agosto de 2026 daban F0 IDÉNTICA en los 20 casos; sobre la
     fuente de pulsos, no. Una sola familia de señal no distinguía dos DSP que
     se comportan distinto.

   **El pulso se reparte entre las dos muestras vecinas**, no se clava con
   `Math.floor`. Clavarlo cuantiza el periodo a un entero y, cuando el periodo
   real no lo es, el patrón de redondeo SE REPITE y crea un subarmónico de
   verdad: a 16 kHz, 300 Hz cae en 53,33 muestras y con `floor` sale la
   secuencia 53-53-54, que suma 160 muestras cada tres ciclos — una señal cuyo
   fundamental REAL es 100 Hz. Praat lo medía como 100 Hz, que era la respuesta
   correcta, y parecía un fallo de VIA+. Es el mismo error que ya había
   aparecido con el jitter alternado; van dos.
2. Escribe dos ficheros por caso: `<caso>.wav` (la señal cruda, como la
   entregaría el micrófono) y `<caso>.conditioned.wav` (tras el acondicionado
   de VIA+). La comparación se hace sobre la **acondicionada**, que es la que
   el DSP analiza de verdad.
3. Mide cada caso con el DSP real —compilado con el `tsc` del proyecto, así que
   si el módulo dejara de ser puro fallaría aquí— y vuelca `via-measurements.json`.
4. `validate.py` mide los mismos WAV con Praat y contrasta.

## Prosodia: dos oráculos, y por qué

En la familia de habla conectada **no todo lo puede arbitrar Praat**, y fingir
que sí sería peor que no validarlo:

+ **Entonación y pausas → Praat.** Tiene estimador de tono propio y detector de
  silencios propio (`To TextGrid (silences)`), configurado aquí con el mismo
  criterio que el módulo: umbral a −25 dB del nivel alto y pausa mínima de
  250 ms. Es un juez genuinamente independiente.
+ **Recuento de sílabas → el guion de la síntesis.** Praat **no trae** detector
  de núcleos silábicos: el método de De Jong & Wempe que usa VIA+ es un *script*
  de Praat, no una función suya. Reimplementarlo en el validador sería comparar
  el módulo contra una segunda implementación nuestra del mismo método —
  circular y sin valor probatorio—. Como las señales se sintetizan con un número
  de sílabas conocido, la verdad de campo es mejor juez que Praat.

## Qué se ha encontrado con él

El banco no es decorativo: se escribió para responder a «el análisis acústico
no funciona» y encontró cuatro cosas en la primera pasada.

| Hallazgo | Dónde estaba |
|---|---|
| **Orden LPC insuficiente.** Con orden 14 a 16 kHz solo caben ~5 formantes en toda la banda de 8 kHz, y F3 se quedaba sin polos: VIA+ declaraba «formantes no estimables» en 10 de 11 casos que Praat resolvía sin dificultad. Con orden 20 (2 polos por formante + margen) coinciden dentro de 25–72 Hz. | `voiceDsp.ts` |
| **Techo del HNR no declarado.** El HNR se deriva del pico de autocorrelación y satura en ~30 dB. No es un problema clínico (las voces humanas van de 5 a 25 dB) pero no estaba dicho en ninguna parte: una lectura de 30 significa «≥ 30». Ahora es una constante documentada. | `voiceDsp.ts` |
| **El acondicionado de baja frecuencia es correcto.** Sobre el caso con retumbe de 20 Hz, Praat —que mide el fichero crudo— da F0 = 408 Hz; VIA+, que acondiciona, da los 200 Hz reales. | confirma `HIGHPASS_HZ` |
| **Un caso de prueba mal construido.** Perturbar el periodo alternando el signo genera doblado de periodo: la F0 real es la mitad. Praat lo detectaba bien y parecía un fallo de VIA+. Corregido a perturbación aleatoria. | `fixtures.js` |

Y cuatro más en la segunda pasada, la de agosto de 2026, cuando se le añadieron
la banda infantil alta, la fuente de pulsos y la validación de jitter y shimmer:

| Hallazgo | Dónde estaba |
|---|---|
| **El jitter y el shimmer del informe no los validaba NADIE.** El banco medía F0, HNR y formantes y se saltaba justo las dos cifras sobre las que el logopeda decide si una voz es sana. En cuanto se compararon: sobre 1 % de jitter inyectado VIA+ informaba **0,1 %** (Praat: 0,8 %) y sobre 8 % de shimmer, **1,3 %** (Praat: 5,4 %). Infravaloración de seis a diez veces, y en la dirección peligrosa — una voz patológica leída como sana. | `useVoiceAnalysis.ts` |
| **La perturbación se medía sobre las MEDIAS POR VENTANA**, una F0 y un RMS cada 16 ms, o sea ya promediados sobre unos cinco ciclos glotales. Promediar es exactamente lo que borra lo que se quiere medir. Ahora se mide pulso a pulso (`computeCycleMetrics`). | `voiceDsp.ts` |
| **El estimador de F0 no podía elegir un lag largo.** Cogía el PRIMER máximo local que superase una fracción del máximo global, así que un subarmónico no lo engañaba nunca… y un armónico sí, sin dejar rastro. Sobre fuente de pulsos, una /a/ de 150 Hz con F1 en 900 Hz salía en **233,2 Hz** (Praat: 150,0), y se llevaba por delante el HNR y el shimmer, que cuelgan de esa F0. Con el coste de octava de Praat sale 150,0 y ningún otro caso cambia. | `voiceDsp.ts` |
| **El banco no miraba por encima de 260 Hz**, que es voz de mujer adulta, mientras VIA+ explora niños. Añadida la banda de 280 a 400 Hz, donde el periodo cabe en tan pocas muestras que el estimador se juega el salto de octava. | `fixtures.js` |

## Estado actual — vocal sostenida

+ **F0** — coincide con Praat **al decimal** (Δ = 0.0 Hz) en todos los casos.
+ **HNR** — sobre ruido aditivo puro, dentro de **0.5 dB**. Ante perturbación
  (jitter/shimmer) divergen algunos dB: VIA+ lo deriva del pico de
  autocorrelación y Praat de la armonicidad, y el pico baja también cuando lo
  que varía es el periodo. La tolerancia (8 dB) cubre esa diferencia de método.
+ **Formantes** — F1/F2 dentro de la tolerancia en todos los casos estimados.
  F3 es el menos fiable en ambos estimadores cuando F2 y F3 se acercan (/i/).
  En la familia de **fuente de pulsos** los arbitra el GUION, no Praat, por el
  mismo motivo por el que en prosodia el recuento de sílabas lo arbitra el
  guion: con F0 alta los armónicos están tan separados que la envolvente
  espectral queda submuestreada y el seguidor de Praat se pierde. Con F3
  sintetizado en 3400 Hz, VIA+ da 3490 y Praat 2174; con F1 en 1150, VIA+ da
  1200 y Praat 968. Comparar ahí contra Praat marcaría como fallo de VIA+ un
  acierto de VIA+.

**Desviación abierta (no es de esta pasada):** en `vocal-u-200hz`, VIA+ da un
F3 de 4302 Hz donde el guion pide 2400 y Praat lee 2809. Es la /u/, cuyos dos
primeros formantes se funden; lo correcto sería declararlo no estimable, que es
lo que el módulo ya hace con F1 y F2 de esa vocal. Está así desde antes.
+ **Vocal /u/** — VIA+ declara los formantes no estimables (F1 y F2 están a
  450 Hz y el pico se funde). Es la respuesta honesta y el banco no lo cuenta
  como fallo: no estimar es preferible a inventar. La prueba clínica usa /a/
  sostenida.
+ **Jitter** — sigue a Praat dentro de **0,4 puntos** en todos los casos con
  perturbación inyectada, y da 0,0 sobre voz sana.
+ **Shimmer** — coincide con Praat **al decimal** sobre perturbación inyectada
  (5,4 % frente a 5,4 % con 8 % inyectado) y da 0,0 sobre señal limpia.

### Lo que el shimmer NO mide bien, y por qué

Cuando el periodo no cabe en un número entero de muestras —106,67 a 150 Hz;
45,71 a 350 Hz, a 16 kHz— la fase sub-muestra del pulso va rotando y la cresta
cae cada vez en un punto distinto entre dos muestras, así que la amplitud
medida oscila sola. VIA+ queda entre **0,2 y 1,2 puntos por encima de Praat**
en esas señales (2,3 % frente a 1,4 % a 150 Hz). Es un artefacto de muestreo,
no perturbación de la voz, y se queda muy por debajo del umbral clínico
(3,5 %), pero conviene tenerlo escrito antes de afinar nada sobre esas cifras.

Sobre captura RUIDOSA el shimmer también corre por encima de Praat (4,5 %
frente a 3,0 % con ruido fuerte): la amplitud pico a pico de un ciclo es
sensible al ruido aditivo por construcción. En esas tomas el HNR ya sale bajo,
que es el dato que dice que la captura no vale.

## Estado actual — habla conectada (prosodia)

Ocho casos: cadenas con y sin pausas, habla monótona frente a entonada, cierres
entonativos ascendente y descendente, y habla lenta.

+ **Recuento de sílabas** — **exacto en los ocho casos** (16/16, 12/12, 14/14…)
  frente al guion de síntesis.
+ **Recuento de pausas** — exacto, y coincidente con Praat en todos los casos.
+ **F0 mediana** — dentro de **0.03 Hz** de Praat.
+ **Rango tonal** — Δ ≤ **0.67 st**, y solo en los casos con glissando final: los
  dos estimadores muestrean la rampa con pasos distintos y los percentiles caen
  en puntos algo distintos de ella. En habla sin glissando, Δ = 0.00 st.
+ **SD de F0** — Δ ≤ **0.07 st**.
+ **Separación monótona / entonada** — 0.0 st frente a 7.4 st de rango, sobre
  unos 170–260 Hz sintetizados (7.35 st nominales).
+ **Tasa de habla** — la señal lenta da 0.52× la tasa de la normal, contra el
  0.517× que pide el guion.

Sobre la **duración total de las pausas**: sale unos 50 ms más larga por pausa
que el guion. No es un sesgo del detector. Los flancos de la envolvente de cada
sílaba cruzan el umbral de silencio antes de que acabe el segmento, así que el
silencio acústico **real** es más largo que el nominal — y Praat mide esas
mismas pausas largas (Δ frente a VIA+ ≤ 13 ms). El margen de tolerancia frente
al guion recoge esa diferencia entre lo que pedía el guion y lo que contiene la
señal.

## Lo que este banco NO valida

Señales **sintéticas**. Que VIA+ coincida con Praat sobre ellas dice que el
cálculo es correcto, no que la medida sea clínicamente válida sobre voz real
de niño, con su ruido de sala, su micrófono y su distancia. Eso exige un
contraste con grabaciones reales anotadas por un logopeda, que es parte de la
validación clínica del módulo y no de esta herramienta.

En prosodia esa advertencia **pesa más**, no menos. Las sílabas sintéticas de
este banco están perfectamente separadas y tienen todas la misma envolvente; el
habla infantil real trae coarticulación, disfluencias, alargamientos y ruido de
sala. El recuento silábico exacto que se ve arriba dice que el algoritmo
implementa bien el método de De Jong & Wempe, **no** que vaya a contar bien las
sílabas de un niño de cinco años. Es la medida más frágil del módulo y la
primera que hay que contrastar contra recuento manual de un logopeda.
