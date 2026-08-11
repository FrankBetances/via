/* -------------------------------------------------------------------------- */
/*  Pruebas del silencio clínico — DEFENSA EN PROFUNDIDAD.                      */
/*                                                                             */
/*  Ojo con lo que esta suite NO demuestra: no demuestra que la medición esté     */
/*  protegida. Eso lo da la ausencia física del aparato durante la exploración    */
/*  (§8 del plan de Valeria+), que es un requisito de procedimiento y no se puede */
/*  probar con un test. Lo que sí se verifica es que el cinturón funciona: que    */
/*  cualquier apertura de micrófono manda el `SAFE`, incluida la de módulos que   */
/*  todavía no existen, y que al cerrarse la captura NO se desbloquea nada solo.  */
/* -------------------------------------------------------------------------- */

import { acquireRecordingSession, __resetSharedAudioContextForTests } from '@/Audio';
import {
  createClinicalSilenceController,
  installClinicalSilence,
  isLuaSilenced,
  __resetClinicalSilenceForTests,
} from '../clinicalSilence';
import { setLuaAdapter, type LuaAdapter } from '../luaAdapter';
import { LUA_OP, LUA_SAFE } from '../luaProtocol';

function setup(options: { recording?: boolean; confirmed?: boolean } = {}) {
  const safeOps: number[] = [];
  const ctrlOps: number[] = [];
  let recordingListener: ((active: boolean) => void) | null = null;
  let recording = options.recording ?? false;
  let unsubscribed = false;

  const controller = createClinicalSilenceController({
    silence: () => {
      safeOps.push(LUA_SAFE.CLINICAL_SILENCE);
      return Promise.resolve(options.confirmed ?? true);
    },
    idle: () => ctrlOps.push(LUA_OP.IDLE),
    isRecordingActive: () => recording,
    subscribeRecording: listener => {
      recordingListener = listener;
      return () => {
        unsubscribed = true;
      };
    },
  });

  return {
    controller,
    safeOps,
    ctrlOps,
    setRecording: (active: boolean) => {
      recording = active;
      recordingListener?.(active);
    },
    wasUnsubscribed: () => unsubscribed,
  };
}

describe('emisión del silencio', () => {
  it('sin captura de micrófono no se emite nada', () => {
    const { controller, safeOps } = setup();
    expect(safeOps).toEqual([]);
    expect(controller.isSilenced()).toBe(false);
  });

  it('abrir el micrófono emite CLINICAL_SILENCE y la cara neutra', () => {
    const { controller, safeOps, ctrlOps, setRecording } = setup();
    setRecording(true);
    expect(safeOps).toEqual([LUA_SAFE.CLINICAL_SILENCE]);
    // IDLE va por CTRL y funciona sin concesión, así que si el SAFE se perdiera
    // el aparato al menos se queda quieto.
    expect(ctrlOps).toEqual([LUA_OP.IDLE]);
    expect(controller.isSilenced()).toBe(true);
  });

  it('instalarse a mitad de una captura emite en el acto', () => {
    // Enchufar el aparato durante una audiometría no puede dejarlo desbloqueado.
    const { controller, safeOps } = setup({ recording: true });
    expect(safeOps).toEqual([LUA_SAFE.CLINICAL_SILENCE]);
    expect(controller.isSilenced()).toBe(true);
  });

  it('cerrar la captura NO desbloquea: el desbloqueo es explícito', () => {
    const { safeOps, setRecording } = setup();
    setRecording(true);
    setRecording(false);
    // Ni un UNLOCK. El aparato se queda LOCKED hasta que la recompensa de cierre
    // lo pida, con la exploración terminada.
    expect(safeOps).toEqual([LUA_SAFE.CLINICAL_SILENCE]);
  });

  it('cada nueva captura vuelve a emitir', () => {
    const { controller, setRecording } = setup();
    setRecording(true);
    setRecording(false);
    setRecording(true);
    expect(controller.emissions()).toBe(2);
  });

  it('una escritura sin confirmar no rompe nada ni deja un rechazo suelto', () => {
    const { controller, setRecording } = setup({ confirmed: false });
    expect(() => setRecording(true)).not.toThrow();
    expect(controller.isSilenced()).toBe(true);
  });

  it('parar da de baja el observador y deja de emitir', () => {
    const { controller, safeOps, setRecording, wasUnsubscribed } = setup();
    controller.stop();
    setRecording(true);
    expect(safeOps).toEqual([]);
    expect(wasUnsubscribed()).toBe(true);
  });
});

/* -------------------------------------------------------------------------- */
/*  Integración con el micrófono REAL de VIA+                                   */
/* -------------------------------------------------------------------------- */

describe('cableado real: acquireRecordingSession() dispara el silencio', () => {
  let stop: (() => void) | null = null;
  const safeWrites: number[] = [];

  const fakeLua = (): void => {
    const adapter: LuaAdapter = {
      isConnected: () => true,
      state: () => null,
      sendCtrl: () => {},
      sendSafe: op => {
        safeWrites.push(op);
        return Promise.resolve(true);
      },
      subscribeState: () => () => {},
      onLinkChange: () => () => {},
    };
    setLuaAdapter(adapter);
  };

  beforeEach(() => {
    safeWrites.length = 0;
    __resetSharedAudioContextForTests();
    __resetClinicalSilenceForTests();
    fakeLua();
  });

  afterEach(() => {
    stop?.();
    stop = null;
    __resetClinicalSilenceForTests();
    setLuaAdapter(null);
  });

  it('la reserva que hacen los módulos clínicos emite el SAFE', () => {
    stop = installClinicalSilence();
    expect(safeWrites).toEqual([]);

    // Esto es literalmente lo que hace cualquier adaptador de micrófono de VIA+.
    const release = acquireRecordingSession();
    expect(safeWrites).toEqual([LUA_SAFE.CLINICAL_SILENCE]);
    expect(isLuaSilenced()).toBe(true);

    release();
    expect(safeWrites).toEqual([LUA_SAFE.CLINICAL_SILENCE]);
  });

  it('dos módulos grabando a la vez emiten una sola vez', () => {
    stop = installClinicalSilence();
    const a = acquireRecordingSession();
    const b = acquireRecordingSession();
    expect(safeWrites).toEqual([LUA_SAFE.CLINICAL_SILENCE]);
    a();
    b();
  });

  it('sin aparato conectado todo el mecanismo es inerte', () => {
    setLuaAdapter(null);
    stop = installClinicalSilence();
    const release = acquireRecordingSession();
    expect(() => release()).not.toThrow();
  });
});
