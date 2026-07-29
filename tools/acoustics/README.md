# Validación del análisis acústico contra Praat

Banco de referencia que comprueba que las cifras del análisis acústico de VIA+
significan lo que el informe clínico dice que significan. Compara el DSP que
corre **de verdad** en la app (`src/Screens/VoiceAnalysis/voiceDsp.ts`) con
**Praat**, el estándar de facto en fonética clínica, sobre las mismas señales.

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
   F0, formantes, jitter, shimmer y contaminación conocidos.
2. Escribe dos ficheros por caso: `<caso>.wav` (la señal cruda, como la
   entregaría el micrófono) y `<caso>.conditioned.wav` (tras el acondicionado
   de VIA+). La comparación se hace sobre la **acondicionada**, que es la que
   el DSP analiza de verdad.
3. Mide cada caso con el DSP real —compilado con el `tsc` del proyecto, así que
   si el módulo dejara de ser puro fallaría aquí— y vuelca `via-measurements.json`.
4. `validate.py` mide los mismos WAV con Praat y contrasta.

## Qué se ha encontrado con él

El banco no es decorativo: se escribió para responder a «el análisis acústico
no funciona» y encontró cuatro cosas en la primera pasada.

| Hallazgo | Dónde estaba |
|---|---|
| **Orden LPC insuficiente.** Con orden 14 a 16 kHz solo caben ~5 formantes en toda la banda de 8 kHz, y F3 se quedaba sin polos: VIA+ declaraba «formantes no estimables» en 10 de 11 casos que Praat resolvía sin dificultad. Con orden 20 (2 polos por formante + margen) coinciden dentro de 25–72 Hz. | `voiceDsp.ts` |
| **Techo del HNR no declarado.** El HNR se deriva del pico de autocorrelación y satura en ~30 dB. No es un problema clínico (las voces humanas van de 5 a 25 dB) pero no estaba dicho en ninguna parte: una lectura de 30 significa «≥ 30». Ahora es una constante documentada. | `voiceDsp.ts` |
| **El acondicionado de baja frecuencia es correcto.** Sobre el caso con retumbe de 20 Hz, Praat —que mide el fichero crudo— da F0 = 408 Hz; VIA+, que acondiciona, da los 200 Hz reales. | confirma `HIGHPASS_HZ` |
| **Un caso de prueba mal construido.** Perturbar el periodo alternando el signo genera doblado de periodo: la F0 real es la mitad. Praat lo detectaba bien y parecía un fallo de VIA+. Corregido a perturbación aleatoria. | `fixtures.js` |

## Estado actual

+ **F0** — coincide con Praat **al decimal** (Δ = 0.0 Hz) en todos los casos.
+ **HNR** — sobre ruido aditivo puro, dentro de **0.5 dB**. Ante perturbación
  (jitter/shimmer) divergen algunos dB: VIA+ lo deriva del pico de
  autocorrelación y Praat de la armonicidad, y el pico baja también cuando lo
  que varía es el periodo. La tolerancia (8 dB) cubre esa diferencia de método.
+ **Formantes** — F1/F2 dentro de la tolerancia en todos los casos estimados.
  F3 es el menos fiable en ambos estimadores cuando F2 y F3 se acercan (/i/).
+ **Vocal /u/** — VIA+ declara los formantes no estimables (F1 y F2 están a
  450 Hz y el pico se funde). Es la respuesta honesta y el banco no lo cuenta
  como fallo: no estimar es preferible a inventar. La prueba clínica usa /a/
  sostenida.

## Lo que este banco NO valida

Señales **sintéticas**. Que VIA+ coincida con Praat sobre ellas dice que el
cálculo es correcto, no que la medida sea clínicamente válida sobre voz real
de niño, con su ruido de sala, su micrófono y su distancia. Eso exige un
contraste con grabaciones reales anotadas por un logopeda, que es parte de la
validación clínica del módulo y no de esta herramienta.
