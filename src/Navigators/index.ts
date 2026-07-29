/* -------------------------------------------------------------------------- */
/*  @/Navigators — barrel requerido por las pantallas de módulo               */
/*  (`import { RootStackParamList } from '@/Navigators'`). Reexporta el tipo  */
/*  de rutas declarado en `screenTypeNavigator.ts` (fuente de verdad única).  */
/* -------------------------------------------------------------------------- */

export type { RootStackParamList } from '@/Navigators/screenTypeNavigator';
export { default } from '@/Navigators/Default';
export { finishModule } from '@/Navigators/finishModule';
export type { ModuleExitNavigation } from '@/Navigators/finishModule';
