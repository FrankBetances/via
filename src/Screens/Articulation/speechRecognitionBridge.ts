/* -------------------------------------------------------------------------- */
/*  Reconocimiento de voz del T.A.R. sobre `expo-speech-recognition`.           */
/*                                                                             */
/*  POR QUÉ SE CAMBIÓ DE LIBRERÍA                                               */
/*  Antes: `@react-native-voice/voice@3.2.4`, que npm marca como DEPRECADA      */
/*  recomendando literalmente `expo-speech-recognition` —el mismo paquete que   */
/*  usa Valeria+, donde el reconocimiento funciona—. Encima necesitaba un       */
/*  parche propio (`patches/@react-native-voice+voice+3.2.4.patch`) para poder  */
/*  exigir modo local, y ese parche abortaba EN SILENCIO cuando no podía        */
/*  garantizarlo: `startListening` hacía `return` sin avisar a nadie y el T.A.R.*/
/*  se quedaba esperando un resultado que no iba a llegar nunca. En cualquier   */
/*  emulador de Android ese era el caso NORMAL.                                 */
/*                                                                             */
/*  `expo-speech-recognition` trae de serie lo que el parche intentaba añadir:  */
/*  `requiresOnDeviceRecognition` como opción declarada y                       */
/*  `supportsOnDeviceRecognition()` para consultarlo antes.                     */
/*                                                                             */
/*  ZERO-PHI, IGUAL DE ESTRICTO. La regla no cambia: si no se puede GARANTIZAR  */
/*  que el reconocimiento ocurre en el dispositivo, no se reconoce. Lo que      */
/*  cambia es que ahora se DICE — la puerta sigue cerrada, pero deja de ser     */
/*  invisible.                                                                  */
/*                                                                             */
/*  La forma que expone este módulo imita la de la librería antigua a propósito */
/*  (`start`/`stop`/`destroy` + manejadores `onSpeech*`), para que el hook del  */
/*  T.A.R. cambie lo mínimo y el cambio se pueda revisar de un vistazo.         */
/* -------------------------------------------------------------------------- */

/* Metro exige literales en `require(...)`; opcional para que los tests y los
 * targets sin el módulo nativo sigan compilando. */
const optionalSpeechRecognition = (): any => {
  try {
    const mod = require('expo-speech-recognition');
    return mod?.ExpoSpeechRecognitionModule ?? null;
  } catch (_e) {
    return null;
  }
};

/** Resultado de una transcripción (parcial o final). */
export interface RecognitionResultEvent {
  /** Transcripciones candidatas, la mejor primero. */
  value: string[];
}

export interface RecognitionError {
  code: string;
  message: string;
}

/** Manejadores del reconocedor. Misma forma que la librería anterior. */
export interface SpeechRecognizer {
  onSpeechStart?: () => void;
  onSpeechEnd?: () => void;
  onSpeechResults?: (e: RecognitionResultEvent) => void;
  onSpeechPartialResults?: (e: RecognitionResultEvent) => void;
  onSpeechError?: (e: RecognitionError) => void;
  /** Arranca la escucha. Lanza si no se puede garantizar el modo local. */
  start: (locale: string) => Promise<void>;
  stop: () => Promise<void>;
  cancel: () => Promise<void>;
  destroy: () => Promise<void>;
  removeAllListeners: () => void;
}

/** ¿Hay reconocedor en este dispositivo? */
export const isRecognitionAvailable = (): boolean => {
  const mod = optionalSpeechRecognition();
  try {
    return mod?.isRecognitionAvailable?.() === true;
  } catch {
    return false;
  }
};

/**
 * ¿Puede este dispositivo reconocer SIN RED? Es la condición Zero-PHI: en
 * Android exige API 33 y el modelo de la lengua descargado; en iOS, que el
 * `SFSpeechRecognizer` del locale soporte reconocimiento local.
 */
export const supportsOnDeviceRecognition = (): boolean => {
  const mod = optionalSpeechRecognition();
  try {
    return mod?.supportsOnDeviceRecognition?.() === true;
  } catch {
    return false;
  }
};

/** Pide el permiso de micrófono/reconocimiento. */
export const requestRecognitionPermission = async (): Promise<boolean> => {
  const mod = optionalSpeechRecognition();
  if (!mod?.requestPermissionsAsync) return false;
  try {
    const res = await mod.requestPermissionsAsync();
    return res?.granted === true;
  } catch {
    return false;
  }
};

/**
 * Crea el reconocedor, o `null` si el binario no trae el módulo. Reservar NO
 * arranca nada: la escucha empieza en `start()`, y solo si el modo local está
 * garantizado.
 */
export function createSpeechRecognizer(): SpeechRecognizer | null {
  const mod = optionalSpeechRecognition();
  if (!mod?.start) return null;

  const handlers: SpeechRecognizer = {
    start: async () => {},
    stop: async () => {},
    cancel: async () => {},
    destroy: async () => {},
    removeAllListeners: () => {},
  };

  const subs: Array<{ remove?: () => void }> = [];
  const listen = (event: string, fn: (payload: any) => void) => {
    try {
      const sub = mod.addListener?.(event, fn);
      if (sub) subs.push(sub);
    } catch {
      /* un evento que el módulo no expone no puede tumbar la pantalla */
    }
  };

  /** Extrae las transcripciones candidatas del evento nativo. */
  const valuesOf = (ev: any): string[] => {
    const results = Array.isArray(ev?.results) ? ev.results : [];
    return results.map((r: any) => String(r?.transcript ?? '')).filter(Boolean);
  };

  listen('start', () => handlers.onSpeechStart?.());
  listen('end', () => handlers.onSpeechEnd?.());
  listen('result', (ev: any) => {
    const value = valuesOf(ev);
    if (!value.length) return;
    // `isFinal` distingue la transcripción definitiva de las parciales, que es
    // lo que la pantalla usa para ir mostrando lo que el niño va diciendo.
    if (ev?.isFinal) handlers.onSpeechResults?.({ value });
    else handlers.onSpeechPartialResults?.({ value });
  });
  listen('error', (ev: any) =>
    handlers.onSpeechError?.({
      code: String(ev?.error ?? 'unknown'),
      message: String(ev?.message ?? 'fallo del reconocedor'),
    }),
  );

  handlers.start = async (locale: string) => {
    // PUERTA ZERO-PHI. Se comprueba ANTES de arrancar y se LANZA si no se
    // cumple: la librería anterior volvía en silencio y dejaba al T.A.R.
    // esperando para siempre.
    if (!supportsOnDeviceRecognition()) {
      throw new Error(
        'Reconocimiento en el dispositivo no disponible: requiere Android 13 o superior ' +
          'con el modelo de la lengua descargado. No se arranca el reconocedor para que ' +
          'la voz del paciente no salga del equipo.',
      );
    }
    const granted = await requestRecognitionPermission();
    if (!granted) throw new Error('Permiso de reconocimiento de voz denegado');

    mod.start({
      lang: locale,
      interimResults: true,
      continuous: false,
      // La garantía, declarada al motor: en Android usa el reconocedor local
      // (API 33+) y en iOS fija `requiresOnDeviceRecognition`.
      requiresOnDeviceRecognition: true,
    });
  };

  handlers.stop = async () => {
    try {
      mod.stop?.();
    } catch {
      /* noop */
    }
  };

  handlers.cancel = async () => {
    try {
      mod.abort?.();
    } catch {
      /* noop */
    }
  };

  handlers.removeAllListeners = () => {
    for (const sub of subs.splice(0)) {
      try {
        sub.remove?.();
      } catch {
        /* noop */
      }
    }
    handlers.onSpeechStart = undefined;
    handlers.onSpeechEnd = undefined;
    handlers.onSpeechResults = undefined;
    handlers.onSpeechPartialResults = undefined;
    handlers.onSpeechError = undefined;
  };

  handlers.destroy = async () => {
    await handlers.cancel();
    handlers.removeAllListeners();
  };

  return handlers;
}
