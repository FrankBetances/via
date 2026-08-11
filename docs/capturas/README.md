# Capturas e icono de VIA+

Material gráfico de la aplicación para documentación y para la ficha de la
tienda.

| Archivo | Qué es | Tamaño |
|---|---|---|
| `icono-app-512.png` | Icono de la app compuesto (fondo degradado + primer plano del icono adaptativo), al tamaño que pide la ficha de Google Play | 512 × 512 |
| `icono-app-launcher.png` | Icono de lanzador tal cual está empaquetado en el APK (`mipmap-xxxhdpi/ic_launcher.png`) | 192 × 192 |
| `creditos.png` | Pantalla de **Créditos** (autoría, colaboradores y sello de calidad) | 824 × 1830 |
| `seleccion-ejercicios.png` | Pantalla de **Selección de pruebas**, el hub de la batería | 824 × 1830 |

## Procedencia — léase antes de subir nada a la tienda

El **icono** sale directamente de los recursos del proyecto:
`icono-app-launcher.png` es una copia literal del PNG empaquetado, y
`icono-app-512.png` compone los dos recursos del icono adaptativo
(`drawable/ic_launcher_background.xml`, el degradado de marca, y
`mipmap-xxxhdpi/ic_launcher_foreground.png`) en un lienzo cuadrado de 512 px.
Es fiel al icono que se instala en el dispositivo.

Las **dos capturas de pantalla NO son capturas de dispositivo**: son
reconstrucciones fieles de `CreditosScreen.tsx` y `SeleccionEjerciciosScreen.tsx`
—mismos textos, colores, tipos de letra, tamaños, iconos lucide y escenas SVG de
las tarjetas, tomados del código— renderizadas en Chromium a 412 × 915 px CSS con
densidad ×2, que es la resolución de un móvil Android corriente. Se hicieron así
porque el entorno donde se generaron no tiene emulador de Android.

Sirven para documentación: manual, README, presentaciones. **Para la ficha de
Google Play hay que sustituirlas por capturas reales del dispositivo**, tomadas
sobre la app instalada: la política de la tienda exige que las imágenes muestren
la aplicación tal y como se ejecuta, y estas reconstrucciones, por fieles que
sean, no lo son.

Diferencias conocidas frente a la app en ejecución:

- las animaciones aparecen congeladas en un fotograma (los anillos de pulso del
  emblema, los doce puntos de módulo en órbita y la banda de partículas de la
  tarjeta del autor se ven en una posición fija);
- la tipografía es la sustituta del entorno de render, no la Rethink Sans
  declarada en `src/Theme/gluestack-ui.config.ts`;
- no hay datos de paciente (ninguna de las dos pantallas los muestra en el
  estado que se ha capturado, así que no aparece información clínica).

Si cambian esas pantallas, estas imágenes se quedan obsoletas en silencio: hay
que regenerarlas o, mejor, reemplazarlas por capturas reales.
