import { Alert, Platform, ToastAndroid } from 'react-native';

/* -------------------------------------------------------------------------- */
/*  showToast — helper compartido por las 9 pantallas de módulo.              */
/*                                                                            */
/*  No hay librería de toasts en las dependencias del proyecto (Fase 1 no la  */
/*  incluyó). Para no añadir una dependencia nueva en esta fase de            */
/*  integración, se usa `ToastAndroid` en Android (nativo de React Native) y  */
/*  se cae a `Alert.alert` en iOS (sin equivalente nativo de toast). Mismo    */
/*  título + mensaje en ambos casos. Sustituible por un toast con diseño      */
/*  propio (Gluestack `useToast`) en una fase de UI posterior.                */
/* -------------------------------------------------------------------------- */

function show(title: string, message: string) {
  if (Platform.OS === 'android') {
    ToastAndroid.showWithGravity(`${title}\n${message}`, ToastAndroid.LONG, ToastAndroid.BOTTOM);
  } else {
    Alert.alert(title, message);
  }
}

export function showSuccessToast(title: string, message: string): void {
  show(title, message);
}

export function showErrorToast(title: string, message: string): void {
  show(title, message);
}
