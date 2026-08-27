# Especificaciones de Diseño · Resultados Preliminares y Definitivos (VIA+)

Este documento recopila las referencias visuales aprobadas para las pantallas de **Resultados Preliminares** y **Resultados Definitivos / Informe Clínico** en formato tableta apaisada (4:3) con Master-Detail y gráficos clínicos interactivos.

> **Los renders son referencia visual, no contenido.** Su texto se generó con datos de ejemplo (paciente «Mateo B.», 85 % de normalidad, rótulos en inglés). Ninguna de esas cadenas debe aparecer en el código: sin evaluación activa las pantallas muestran su **estado vacío**, y sin paciente asignado la cabecera lo dice. Lo fija `src/Screens/ResultadosFinal/__tests__/informeSinDatosDeEjemplo.test.ts`.
>
> **Cobertura de la batería.** De los **trece módulos**, dos —CAP y sonómetro de
> sala— son prerrequisitos y no generan tarjeta de resultado. De los once
> restantes, **ambas pantallas recomponen diez** desde sus repositorios
> (audiometría infantil y condicionada comparten tabla): tonal, verbal, voz,
> prosodia, articulación, funciones ejecutivas, SAHS, M-CHAT y disfagia.
>
> **El undécimo, el cribado de hitos ASHA, solo aparece en Resultados
> Definitivos** (`ResultadosFinalScreen`), no en Preliminares. Entró en agosto de
> 2026 y se añadió donde el clínico cierra el informe; si debe verse también en
> la vista preliminar es **decisión pendiente de Frank**, no un olvido tapado.
> El resto de este documento describe las diez comunes. El estado (`Normal` / `Revisar` / `Alterado`) y la interpretación de cada prueba los calcula su lógica clínica (`interpretAudiometry`, `buildInterpretation`, `efStatus`, `verbalDiscriminationStatus`…); nunca se escriben a mano en la pantalla. La prosodia es la excepción deliberada: no tiene baremo poblacional, así que su estado solo distingue toma válida de toma sin métricas.

---

## 1. 📊 Pantalla de Resultados Preliminares (`ResultadosPreliminaresScreen`)

### Render Visual Aprobado
![Render Resultados Preliminares Tableta](./render_resultados_preliminares_tableta.jpg)

### Estructura de la Pantalla
1. **Columna Izquierda (Medidor de Normalidad Global)** — rotulada `Índice global de normalidad`, en castellano:
   - **Anillo de Score Visual**: Gradiente verde menta a teal que sintetiza el porcentaje global de normalidad de la batería (calculado, no fijo).
   - **Semáforo Diagnóstico**: Chips con conteo de `Normales`, `En Observación` y `Alterados`.
   - **Alerta Clínica Resumida**: Nombra las pruebas realmente marcadas (*"Revisar los parámetros de: Análisis Acústico de Voz."*), nunca un dominio fijo.
2. **Columna Derecha (Rejilla de Pruebas Evaluadas)**:
   - Tarjetas con **raíl lateral de dominio** (*Azul para audición, Púrpura para voz, Naranja para TAR, Esmeralda para ejecutivas*).
   - Micro-curvas y gráficos integrados (audiograma, espectrograma).
   - Métricas clave en texto claro (e.g. *15 dB HL bilateral*, *Shimmer 4.2% elevado*).
3. **Dock Inferior**:
   - Resumen de sesión a la izquierda y botón en Naranja Radiante **`Ver Informe Detallado →`** a la derecha.

---

## 2. 📋 Pantalla de Resultados Definitivos / Informe Clínico (`ResultadosFinalScreen`)

### Render Visual Aprobado
![Render Resultados Finales Tableta](./render_resultados_final_tableta.jpg)

### Estructura de la Pantalla (Master-Detail)
1. **Barra Lateral Izquierda (Master Navigation Sidebar)**:
   - Lista de pruebas completadas con sus badges de estado (`Normal`, `Revisar`).
   - Módulo inferior de **Telemetría Zero-PHI** con escala de satisfacción Likert (1 a 5 estrellas) y código QR comprimido.
2. **Escenario Principal Derecho (Detalle Clínico)**:
   - **Audiograma Gráfico Clínico**: Curvas OD (🔴 Círculos) y OI (🔵 Cruces) sobre la franja sombreada de normalidad (<20 dB HL). El eje de frecuencias es el de la batería (`FREQS` = 500 Hz, 1 kHz, 2 kHz, 4 kHz): no se pintan columnas que no se miden, y un umbral sin respuesta se deja sin marcar en vez de rellenarse.
   - **Tarjeta de Interpretación Médica**: Juicio clínico calculado por `interpretAudiometry` (incluye el PTA); nunca texto fijo.
   - **Sello y Firma Médica**: El facultativo de la sesión activa (nombre y número de colegiado del profesional en curso), no un firmante fijo.
3. **Dock Inferior de Cierre**:
   - Botón de descarga de informe oficial **`📄 Exportar PDF`** y botón en Naranja Radiante **`✅ Finalizar y Archivar`**.
