/* Stub para módulos web-only (p.ej. `react-dom`) que llegan transitivamente
 * vía @gluestack-ui/menu -> @react-spectrum/menu -> react-aria, pero que el
 * código de la app nunca importa ni ejecuta (no usamos Menu/Select). Metro
 * exige que CADA módulo alcanzable en el grafo de imports resuelva a algo,
 * aunque sea código muerto en runtime — ver metro.config.js. */
module.exports = {};
