/* -------------------------------------------------------------------------- */
/*  Pruebas del adaptador de tonos de audiometría (audiometryToneAdapter).    */
/*                                                                             */
/*  Verifica la síntesis de tonos puros, timbres de instrumentos, sonidos de   */
/*  control, paneo estereofónico por canal y el ciclo de vida del adaptador.   */
/* -------------------------------------------------------------------------- */

const mockNodes = {
  oscillators: [] as any[],
  gains: [] as any[],
  panners: [] as any[],
};

jest.mock('react-native-audio-api', () => {
  class FakeParam {
    value = 0;
    setValueAtTime = jest.fn((val: number) => {
      this.value = val;
    });
    linearRampToValueAtTime = jest.fn((val: number) => {
      this.value = val;
    });
  }

  class FakeOscillator {
    type = 'sine';
    frequency = new FakeParam();
    connect = jest.fn();
    disconnect = jest.fn();
    start = jest.fn();
    stop = jest.fn();
    constructor() {
      mockNodes.oscillators.push(this);
    }
  }

  class FakeGain {
    gain = new FakeParam();
    connect = jest.fn();
    disconnect = jest.fn();
    constructor() {
      mockNodes.gains.push(this);
    }
  }

  class FakePanner {
    pan = new FakeParam();
    connect = jest.fn();
    disconnect = jest.fn();
    constructor() {
      mockNodes.panners.push(this);
    }
  }

  class FakeAudioContext {
    currentTime = 0;
    state = 'running';
    sampleRate = 48000;
    destination = {};
    createOscillator = () => new FakeOscillator();
    createGain = () => new FakeGain();
    createStereoPanner = () => new FakePanner();
    resume = jest.fn(async () => true);
    close = jest.fn(async () => {});
  }

  return {
    AudioContext: FakeAudioContext,
    AudioManager: {
      setAudioSessionOptions: jest.fn(),
      setAudioSessionActivity: jest.fn(async () => true),
    },
  };
});

import { __resetSharedAudioContextForTests } from '@/Audio';
import { installAudiometryToneAdapter } from '../audiometryToneAdapter';
import { useAudiometryTest } from '../useAudiometryTest';
import { act, renderHook } from '@testing-library/react-native';

describe('audiometryToneAdapter', () => {
  let uninstall: (() => void) | null = null;

  beforeEach(() => {
    jest.useFakeTimers();
    mockNodes.oscillators = [];
    mockNodes.gains = [];
    mockNodes.panners = [];
    __resetSharedAudioContextForTests();
  });

  afterEach(() => {
    uninstall?.();
    uninstall = null;
    jest.useRealTimers();
  });

  it('instala el adaptador y activa hasTone en el hook useAudiometryTest', () => {
    const { result: beforeInstall } = renderHook(() => useAudiometryTest());
    expect(beforeInstall.current.hasTone).toBe(false);

    uninstall = installAudiometryToneAdapter();

    const { result: afterInstall } = renderHook(() => useAudiometryTest());
    expect(afterInstall.current.hasTone).toBe(true);
  });

  it('emite un tono a 1000 Hz con instrumento piano y paneo al oído derecho (OD)', () => {
    uninstall = installAudiometryToneAdapter();
    const { result } = renderHook(() => useAudiometryTest());

    act(() => {
      result.current.setEar('OD');
      result.current.setFreq(1000);
      result.current.setDb(40);
      result.current.playStimulus();
    });

    expect(result.current.playing).toBe(true);
    expect(mockNodes.panners.length).toBeGreaterThan(0);
    // OD panea a +1
    expect(mockNodes.panners[mockNodes.panners.length - 1].pan.value).toBe(1);

    // Piano añade 3 parciales (1000, 2000, 3000 Hz)
    expect(mockNodes.oscillators.length).toBe(3);
    expect(mockNodes.oscillators[0].frequency.value).toBe(1000);

    // Los osciladores arrancaron
    for (const osc of mockNodes.oscillators) {
      expect(osc.start).toHaveBeenCalled();
    }
  });

  it('emite con paneo a oído izquierdo (OI) y campo libre (CL)', () => {
    uninstall = installAudiometryToneAdapter();
    const { result: testEar } = renderHook(() => useAudiometryTest());

    act(() => {
      testEar.current.setEar('OI');
      testEar.current.setFreq(2000);
    });
    act(() => {
      testEar.current.playStimulus();
    });

    expect(mockNodes.panners[mockNodes.panners.length - 1].pan.value).toBe(-1);

    const { result: testField } = renderHook(() => useAudiometryTest({ soundfield: true }));

    act(() => {
      testField.current.setFreq(4000);
    });
    act(() => {
      testField.current.playStimulus();
    });

    expect(mockNodes.panners[mockNodes.panners.length - 1].pan.value).toBe(0);
  });

  it('emite el tambor a 500 Hz con rampas percusivas', () => {
    uninstall = installAudiometryToneAdapter();
    const { result } = renderHook(() => useAudiometryTest());

    act(() => {
      result.current.setFreq(500);
    });
    act(() => {
      result.current.playStimulus();
    });

    expect(mockNodes.oscillators.length).toBe(1);
    expect(mockNodes.oscillators[0].frequency.setValueAtTime).toHaveBeenCalledWith(565, expect.any(Number));
  });

  it('emite frecuencias genéricas no clínicas con tono puro y rampas anti-click', () => {
    uninstall = installAudiometryToneAdapter();
    const { result } = renderHook(() => useAudiometryTest());

    act(() => {
      result.current.setFreq(250);
      result.current.setDb(30);
    });
    act(() => {
      result.current.playStimulus();
    });

    expect(mockNodes.oscillators.length).toBe(1);
    expect(mockNodes.oscillators[0].frequency.value).toBe(250);
    expect(mockNodes.gains[0].gain.linearRampToValueAtTime).toHaveBeenCalled();
  });

  it('emite sonidos de control no tonales (sirena y tren)', () => {
    uninstall = installAudiometryToneAdapter();
    const { result } = renderHook(() => useAudiometryTest());

    act(() => {
      result.current.setFreq('amb');
    });
    act(() => {
      result.current.playStimulus();
    });

    expect(mockNodes.oscillators[0].type).toBe('square');

    // Avanzar temporizador de modulación
    act(() => {
      jest.advanceTimersByTime(500);
    });
    expect(mockNodes.oscillators[0].frequency.setValueAtTime).toHaveBeenCalled();

    act(() => {
      result.current.setFreq('tren');
    });
    act(() => {
      result.current.playStimulus();
    });

    expect(mockNodes.oscillators[1].type).toBe('triangle');
    act(() => {
      jest.advanceTimersByTime(200);
    });
    expect(mockNodes.oscillators[1].frequency.setValueAtTime).toHaveBeenCalled();
  });

  it('stop() detiene todos los osciladores y desconecta nodos', () => {
    uninstall = installAudiometryToneAdapter();
    const { result } = renderHook(() => useAudiometryTest());

    act(() => {
      result.current.setFreq(1000);
      result.current.playStimulus();
    });

    const activeOscs = [...mockNodes.oscillators];
    expect(activeOscs.length).toBeGreaterThan(0);

    act(() => {
      result.current.stop();
    });

    for (const osc of activeOscs) {
      expect(osc.stop).toHaveBeenCalled();
      expect(osc.disconnect).toHaveBeenCalled();
    }
  });

  it('desinstalar limpia el adaptador y desregistra de useAudiometryTest', () => {
    uninstall = installAudiometryToneAdapter();
    const { result: installed } = renderHook(() => useAudiometryTest());
    expect(installed.current.hasTone).toBe(true);

    uninstall();
    uninstall = null;

    const { result: uninstalled } = renderHook(() => useAudiometryTest());
    expect(uninstalled.current.hasTone).toBe(false);
  });
});
