/* -------------------------------------------------------------------------- */
/*  Registro central de servicios locales de módulo — VIA+.                  */
/*  Re-exporta los 7 módulos de servicio (RTK-Query-like) registrados bajo    */
/*  `src/Services/local/modules/<modulo>/`, ver Contrato de Compilación §6.   */
/* -------------------------------------------------------------------------- */

export * from './clinicalAssessments';
export * from './screenings';
export * from './audiometry';
export * from './voiceAnalysis';
export * from './dysphagiaTest';
export * from './sahsScreenings';
export * from './articulationTests';
