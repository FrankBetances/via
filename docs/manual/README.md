# Manual de Usuario · VIA+

Manual de usuario en PDF de VIA+ con capturas de pantalla (mockups fieles a la
interfaz real de la app) y casos de uso clínicos.

## Ficheros

| Fichero | Descripción |
|---|---|
| `VIA+_Manual_de_Usuario.pdf` | **Manual final en PDF** (17 páginas, A4). |
| `VIA+_Manual_de_Usuario.docx` | **Manual en Word** (17 páginas A4, réplica visual del PDF). |
| `manual.html` | Fuente maquetada del manual (con marcadores para los SVG). |
| `build-pdf.js` | Genera los SVG (isotipo, ondas, firma, tarjetas) y renderiza el PDF. |
| `build-docx.py` | Rasteriza cada página y las incrusta a página completa en el `.docx`. |

## Regenerar el PDF

Requiere Node ≥ 18 y [Playwright](https://playwright.dev) con Chromium.

```bash
node docs/manual/build-pdf.js
```

Variables de entorno opcionales:

- `PLAYWRIGHT_MODULE` — ruta al paquete `playwright` (por defecto `playwright`).
- `CHROMIUM_PATH` — ejecutable de Chromium (si no, se usa el de Playwright).

Los mockups replican los tokens de diseño de `src/Theme/gluestack-ui.config.ts`
(fondo crema `#F1ECE2`, acento naranja `#FF7F00`) y el isotipo de
`src/Components/Common/ViaIcon.tsx`.

## Contenido

Portada · Índice · Introducción · Flujo clínico · Acceso · Pacientes ·
Consentimiento y CAP · Sonómetro de sala y selección de pruebas ·
**Idioma de la sesión y voz neuronal (es · gl · eu · es-DO)** · Audiometrías ·
Voz y articulación (T.A.R.) · **Análisis prosódico (ritmo, pausas y tono)** ·
Disfagia, M-CHAT y SAHS ·
Módulos nuevos (Audiometría Verbal y Funciones Ejecutivas) ·
**Cribado de hitos del lenguaje (ASHA, percentil 75, 0–5 años)** ·
Resultados, valoración de uso (Likert → QR de telemetría Zero-PHI) e informe PDF ·
Casos de uso · Buenas prácticas, privacidad y soporte.

La batería cubre **13 módulos** de evaluación en **cuatro lenguas de sesión**.

Los cuatro casos de uso de principio a fin son: cribado auditivo infantil,
valoración de lenguaje y voz, exploración de disfagia por la vía rápida y sesión
en español dominicano (Quisqueya Habla). La sección 7 añade además el caso de la
consulta en galego.

## Qué revisar cuando cambia la app

El manual es una maqueta fiel, no una captura automática: si cambian estas cosas
hay que actualizarlo a mano.

| Si cambia… | Revisar |
|---|---|
| El número de módulos de la batería | Portada, sección 1 (recuento **y** chips), flujo clínico, hub (sección 6) y secciones de módulo |
| Las lenguas de sesión o su estado de validación | Sección 7 (tablas de lenguas y de voces) |
| Los umbrales o criterios de interpretación | Secciones 8–12 (tarjetas de criterios) |
| Los controles de privacidad realmente implementados | Sección 15 y el README del repositorio |
| El motor de voz o las vías de salida de audio | Sección 7 (cadena de degradación) y sección 15 (**Comprobar audio**) |
| Que el reconocimiento de voz salga o no del dispositivo | Sección 9 (ficha del T.A.R.) y sección 15 (privacidad) |

### Al añadir un chip o una tarjeta de módulo

Los marcadores `__CHIP_…__` y `__MODCARD_…__` de `manual.html` **solo se
sustituyen si están dados de alta en el mapa `repl` de `build-pdf.js`**. Se
añadió el chip de prosodia sin registrarlo y el PDF salió con el literal
`__CHIP_〰️_…__` impreso en la página 3. Ahora la compilación **falla** si queda
algún marcador sin sustituir, en vez de publicarlo.

### Al añadir una sección

Añadir una página desplaza la numeración: hay que revisar el índice (números de
sección y de página), las cabeceras `ph-sec`, los `kicker` de sección y los pies
`Página N`. El índice tiene un alto fijo — al llegar a 15 entradas hubo que
reducir el relleno vertical de `.toc li` para que el aviso de seguridad no se
saliera por debajo del pie.
