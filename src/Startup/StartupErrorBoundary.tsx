import React from 'react';

import StartupReport from './StartupReport';

/* -------------------------------------------------------------------------- */
/*  StartupErrorBoundary — el último eslabón que impedía ver un fallo.         */
/*                                                                            */
/*  La app NO tenía ninguna barrera de error (comprobado con `grep` sobre      */
/*  `src/`: ni una sola `componentDidCatch` en todo el proyecto). Cualquier    */
/*  excepción lanzada durante el render —un módulo nativo que no responde al   */
/*  contrato que espera su envoltorio JS, un proveedor que revienta al         */
/*  montarse— desmonta el árbol entero. En desarrollo eso pinta la pantalla    */
/*  roja con el mensaje; en un APK de release deja la pantalla EN BLANCO, sin  */
/*  texto, sin cierre y sin ninguna forma de saber qué pasó.                   */
/*                                                                            */
/*  Es decir: el mismo síntoma («no abre») para media docena de causas con     */
/*  arreglos completamente distintos, que es justo lo que la regla 4 prohíbe.  */
/*  Con esta barrera el APK enseña el error en la propia pantalla del          */
/*  dispositivo, sin cable, sin logcat y sin Android Studio.                   */
/*                                                                            */
/*  Envuelve TODO, incluidos los proveedores (Redux, Gluestack, navegación):   */
/*  los fallos de arranque que interesan ocurren precisamente ahí.             */
/* -------------------------------------------------------------------------- */

interface Props {
  children: React.ReactNode;
  /** Qué se estaba montando, para nombrarlo en pantalla. */
  stage?: string;
}

interface State {
  error: unknown;
}

export default class StartupErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: unknown): State {
    return { error };
  }

  componentDidCatch(error: unknown, info: { componentStack?: string | null }) {
    /* El `console.error` se conserva para el emulador con el depurador
     * enganchado, pero NO es la vía de aviso: la vía es la pantalla. */
    console.error('VIA+: excepción no capturada durante el arranque', error, info?.componentStack);
  }

  render() {
    if (this.state.error !== null && this.state.error !== undefined) {
      return <StartupReport stage={this.props.stage ?? 'la interfaz'} error={this.state.error} />;
    }
    return this.props.children as React.ReactElement;
  }
}
