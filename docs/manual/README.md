# Manual de Usuario · VIA+

Manual de usuario en PDF de VIA+ con capturas de pantalla (mockups fieles a la
interfaz real de la app) y casos de uso clínicos.

## Ficheros

| Fichero | Descripción |
|---|---|
| `VIA+_Manual_de_Usuario.pdf` | **Manual final en PDF** (16 páginas, A4). |
| `VIA+_Manual_de_Usuario.docx` | **Manual en Word** (16 páginas A4, réplica visual del PDF). |
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
Voz y articulación (T.A.R.) · Disfagia, M-CHAT y SAHS ·
Módulos nuevos (Audiometría Verbal y Funciones Ejecutivas) ·
Resultados, valoración de uso (Likert → QR de telemetría Zero-PHI) e informe PDF ·
Casos de uso · Buenas prácticas, privacidad y soporte.

La batería cubre **11 módulos** de evaluación en **cuatro lenguas de sesión**.

Los cuatro casos de uso de principio a fin son: cribado auditivo infantil,
valoración de lenguaje y voz, exploración de disfagia por la vía rápida y sesión
en español dominicano (Quisqueya Habla). La sección 7 añade además el caso de la
consulta en galego.

## Qué revisar cuando cambia la app

El manual es una maqueta fiel, no una captura automática: si cambian estas cosas
hay que actualizarlo a mano.

| Si cambia… | Revisar |
|---|---|
| El número de módulos de la batería | Portada, sección 1 (chips) y secciones de módulo |
| Las lenguas de sesión o su estado de validación | Sección 7 (tablas de lenguas y de voces) |
| Los umbrales o criterios de interpretación | Secciones 8–11 (tarjetas de criterios) |
| Los controles de privacidad realmente implementados | Sección 14 y el README del repositorio |
