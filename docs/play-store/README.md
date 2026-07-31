# Recursos gráficos de la ficha de Google Play

| Archivo | Qué es | Tamaño |
|---|---|---|
| `via-plus-feature-graphic-1024x500.png` | **Gráfico destacado** (*feature graphic*) de la ficha principal | 1024 × 500 |
| `build-feature-graphic.js` | Generador del gráfico destacado (HTML → Chromium → PNG) | — |

## Qué exige la tienda

El gráfico destacado tiene que ser **PNG o JPEG de 1024 × 500 px y sin
transparencia**. El fichero de aquí es PNG de 24 bits (color type 2, sin canal
alfa): Chromium escribe RGBA en cuanto algún píxel no es opaco, y un alfa
sobrante hace que la consola rechace la imagen, así que el generador comprueba
la opacidad y reescribe el PNG sin canal alfa antes de guardarlo.

Se sube en Play Console → **Crecimiento → Presencia en Play Store → Ficha
principal de la tienda → Recursos gráficos → Gráfico destacado**. Es obligatorio
para publicar y es la imagen que la tienda usa cuando destaca la app o cuando la
ficha lleva vídeo promocional.

## Regenerar

```bash
node docs/play-store/build-feature-graphic.js
```

Requiere Node ≥ 18 y [Playwright](https://playwright.dev) con Chromium, igual
que `docs/manual/build-pdf.js`. Variables de entorno opcionales:

- `PLAYWRIGHT_MODULE` — ruta al paquete `playwright` (por defecto `playwright`).
- `CHROMIUM_PATH` — ejecutable de Chromium (si no, se usa el de Playwright).

El render es determinista: mismas medidas, mismos colores y una envolvente de
onda calculada, no aleatoria. Regenerarlo dos veces da el mismo fichero.

## Decisiones de diseño — léase antes de retocarlo

La identidad no es una aproximación: el isotipo se replica de
`src/Components/Common/ViaIcon.tsx` (tesela con la onda de 7 barras y el `+`
vectorial) y los colores salen de `src/Theme/gluestack-ui.config.ts` — crema
`#F5F2EC`/`#ECE7DE`, naranja de marca, tinta `#2B2620`. Es el mismo criterio que
sigue el manual de usuario.

- **Zona segura.** Todo lo legible —isotipo, marca, descriptor y las tres
  etiquetas— queda dentro de un margen de 88 px. El motivo de onda es
  decorativo y sangra por la derecha: si alguna disposición de la ficha recorta
  los bordes, no se pierde nada que haya que leer.
- **Se lee en pequeño.** El gráfico aparece a menudo a una fracción de su
  tamaño. De ahí el descriptor en dos líneas, las etiquetas cortas y una onda
  con silueta continua en lugar de barras alternas, que a tamaño reducido se
  leen como ruido.
- **Sin afirmaciones clínicas.** El texto es el nombre de la app, lo que
  significan sus siglas y los tres bloques de la batería. VIA+ es un producto
  sanitario de clase IIa (MDR 2017/745): la ficha de la tienda no es sitio para
  prometer resultados diagnósticos o terapéuticos.

Una salvedad, la misma que arrastra el manual: el entorno donde se genera no
tiene la **Rethink Sans** que declara el tema, así que el texto sale con la
tipografía sustituta del sistema. Si algún día se quiere el gráfico con la
tipografía de marca, hay que instalarla en el entorno de render y añadir su
`@font-face`; el resto de la maquetación no cambia.

## Qué NO hay aquí

Las **capturas de pantalla** de la ficha, que van en `docs/capturas/`. Ojo con
ellas: las que hay son reconstrucciones para documentación, no capturas de
dispositivo, y la política de la tienda exige capturas reales de la app en
ejecución. Está explicado en `docs/capturas/README.md`.

El gráfico destacado es otra cosa: es material promocional, no una captura, y
no está sujeto a esa regla.
