# Manual de Usuario · VIA+

Manual de usuario en PDF de VIA+ con capturas de pantalla (mockups fieles a la
interfaz real de la app) y casos de uso clínicos.

## Ficheros

| Fichero | Descripción |
|---|---|
| `VIA+_Manual_de_Usuario.pdf` | **Manual final en PDF** (15 páginas, A4). |
| `VIA+_Manual_de_Usuario.docx` | **Manual en Word** (15 páginas A4, réplica visual del PDF). |
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
Consentimiento y CAP · Sonómetro y selección de pruebas · Audiometrías ·
Voz y articulación (T.A.R.) · Disfagia, M-CHAT y SAHS ·
Módulos nuevos (Audiometría Verbal y Funciones Ejecutivas) ·
Resultados e informe PDF · Casos de uso · Buenas prácticas, privacidad y soporte.

La batería cubre **11 módulos** de evaluación.
