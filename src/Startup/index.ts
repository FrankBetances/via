/* -------------------------------------------------------------------------- */
/*  @/Startup — lo que hace que un arranque fallido se pueda LEER.             */
/*  Ver StartupErrorBoundary.tsx y StartupReport.tsx para el porqué.           */
/* -------------------------------------------------------------------------- */

export { default as StartupErrorBoundary } from './StartupErrorBoundary';
export { default as StartupReport } from './StartupReport';
export type { StartupReportProps } from './StartupReport';
export { describeError } from './describeError';
export type { DescribedError } from './describeError';
