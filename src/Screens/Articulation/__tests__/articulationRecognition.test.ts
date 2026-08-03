import {
  canRecognize,
  probeRecognitionCaps,
  recognitionBlockLabel,
  resolveRecognitionMode,
  type RecognitionCaps,
} from '../articulationRecognition';

/* -------------------------------------------------------------------------- */
/*  Puerta de reconocimiento del T.A.R. (A2 · Zero-PHI).                       */
/*                                                                            */
/*  De esta decisión depende si la voz de un menor sale o no del dispositivo,  */
/*  así que se prueba de forma EXHAUSTIVA: las 36 combinaciones posibles de    */
/*  capacidades, no una muestra.                                              */
/* -------------------------------------------------------------------------- */

const caps = (
  libraryAvailable: boolean,
  onDeviceSupported: boolean | null,
  onDeviceEnforced: boolean | null,
): RecognitionCaps => ({ libraryAvailable, onDeviceSupported, onDeviceEnforced });

const TRISTATE: Array<boolean | null> = [true, false, null];

describe('resolveRecognitionMode · invariante de seguridad', () => {
  /* EL invariante del módulo: no existe ninguna entrada que haga transcribir
   * por red. El tipo ya lo impide (`'server'` no se puede representar), pero
   * esta prueba lo fija sobre TODO el espacio de entradas por si alguien
   * añadiera un modo en el futuro. */
  it('ninguna combinación de capacidades produce un modo distinto de on-device/unavailable', () => {
    for (const lib of [true, false]) {
      for (const supported of TRISTATE) {
        for (const enforced of TRISTATE) {
          const { mode } = resolveRecognitionMode(caps(lib, supported, enforced));
          expect(['on-device', 'unavailable']).toContain(mode);
        }
      }
    }
  });

  /* FALLO CERRADO. Solo se transcribe con las DOS capacidades confirmadas que
   * sí. Cualquier `null` —«no se ha podido preguntar»— bloquea. */
  it('solo transcribe con ambas capacidades confirmadas afirmativamente', () => {
    let allowed = 0;
    for (const lib of [true, false]) {
      for (const supported of TRISTATE) {
        for (const enforced of TRISTATE) {
          if (canRecognize(caps(lib, supported, enforced))) {
            allowed += 1;
            expect(lib).toBe(true);
            expect(supported).toBe(true);
            expect(enforced).toBe(true);
          }
        }
      }
    }
    // Exactamente una de las 18 combinaciones abre la puerta.
    expect(allowed).toBe(1);
  });
});

describe('resolveRecognitionMode · motivos', () => {
  it('sin librería lo dice, y no lo confunde con falta de modelo', () => {
    expect(resolveRecognitionMode(caps(false, true, true))).toEqual({
      mode: 'unavailable',
      reason: 'no-library',
    });
  });

  it('la plataforma responde que NO hay modelo local para esa lengua', () => {
    expect(resolveRecognitionMode(caps(true, false, true))).toEqual({
      mode: 'unavailable',
      reason: 'no-local-model',
    });
  });

  /* «No se pudo preguntar» es distinto de «dijo que no», y la pantalla debe
   * poder distinguirlos: el segundo lo resuelve el clínico descargando el
   * modelo desde los ajustes; el primero no. */
  it('no poder preguntar no es lo mismo que un no', () => {
    expect(resolveRecognitionMode(caps(true, null, true)).reason).toBe('cannot-confirm');
    expect(resolveRecognitionMode(caps(true, false, true)).reason).toBe('no-local-model');
  });

  /* Una PREFERENCIA de modo local no basta. `EXTRA_PREFER_OFFLINE` de Android
   * es preferencia, no garantía: el proveedor puede ignorarla y salir a la red.
   * Por eso `onDeviceEnforced` solo cuenta si es exactamente `true`. */
  it('preferir el modo local no basta: hace falta garantizarlo', () => {
    expect(canRecognize(caps(true, true, null))).toBe(false);
    expect(canRecognize(caps(true, true, false))).toBe(false);
    expect(canRecognize(caps(true, true, true))).toBe(true);
  });

  it('el caso feliz', () => {
    expect(resolveRecognitionMode(caps(true, true, true))).toEqual({
      mode: 'on-device',
      reason: 'ok',
    });
  });
});

describe('recognitionBlockLabel', () => {
  it('cada motivo tiene explicación propia y no genérica', () => {
    const labels = (['ok', 'no-library', 'no-local-model', 'cannot-confirm'] as const).map(
      recognitionBlockLabel,
    );
    expect(new Set(labels).size).toBe(labels.length);
    for (const l of labels) expect(l.length).toBeGreaterThan(20);
  });

  it('los mensajes de bloqueo dicen que la voz no sale del equipo', () => {
    expect(recognitionBlockLabel('cannot-confirm')).toMatch(/no sale del equipo/i);
    expect(recognitionBlockLabel('no-local-model')).toMatch(/no transcribe a través de internet/i);
  });
});

describe('probeRecognitionCaps · toda ambigüedad cierra la puerta', () => {
  it('sin módulo nativo', async () => {
    expect(await probeRecognitionCaps(null, 'es-ES')).toEqual({
      libraryAvailable: false,
      onDeviceSupported: null,
      onDeviceEnforced: null,
    });
  });

  /* Es el estado REAL de hoy con @react-native-voice/voice 3.2.4: la librería
   * está, pero no expone forma de confirmar ni de forzar el modo local. */
  it('librería presente pero sin la consulta nativa → no se asume nada', async () => {
    const c = await probeRecognitionCaps({}, 'es-ES');
    expect(c).toEqual({ libraryAvailable: true, onDeviceSupported: null, onDeviceEnforced: null });
    expect(canRecognize(c)).toBe(false);
  });

  it('una consulta que lanza se trata como «no se pudo confirmar»', async () => {
    const c = await probeRecognitionCaps(
      {
        isOnDeviceRecognitionAvailable: async () => {
          throw new Error('boom');
        },
        startRequiresOnDevice: true,
      },
      'es-ES',
    );
    expect(c.onDeviceSupported).toBeNull();
    expect(canRecognize(c)).toBe(false);
  });

  it('una respuesta que no es booleana no se interpreta como sí', async () => {
    const c = await probeRecognitionCaps(
      {
        isOnDeviceRecognitionAvailable: (async () => 'sí') as never,
        startRequiresOnDevice: true,
      },
      'es-ES',
    );
    expect(c.onDeviceSupported).toBeNull();
    expect(canRecognize(c)).toBe(false);
  });

  it('con la capa nativa completa, la puerta se abre sola', async () => {
    const c = await probeRecognitionCaps(
      { isOnDeviceRecognitionAvailable: async () => true, startRequiresOnDevice: true },
      'es-ES',
    );
    expect(c).toEqual({ libraryAvailable: true, onDeviceSupported: true, onDeviceEnforced: true });
    expect(canRecognize(c)).toBe(true);
  });

  it('la consulta recibe el locale pedido', async () => {
    const seen: string[] = [];
    await probeRecognitionCaps(
      {
        isOnDeviceRecognitionAvailable: async (l: string) => {
          seen.push(l);
          return true;
        },
      },
      'gl-ES',
    );
    expect(seen).toEqual(['gl-ES']);
  });
});
