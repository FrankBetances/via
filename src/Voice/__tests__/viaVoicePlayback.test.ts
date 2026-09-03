/* -------------------------------------------------------------------------- */
/*  Pruebas del motor de reproducción de voz (viaVoicePlayback).              */
/*                                                                             */
/*  Verifica la integración con expo-audio, configuración de sesión de audio, */
/*  gestión de slot único, sondas de carga y avance, y recuperación de errores.*/
/* -------------------------------------------------------------------------- */

const mockExpoAudio = {
  createAudioPlayer: jest.fn(),
  setAudioModeAsync: jest.fn(async (_opts?: any) => {}),
};

jest.mock('expo-audio', () => ({
  createAudioPlayer: (asset: any) => mockExpoAudio.createAudioPlayer(asset),
  setAudioModeAsync: (opts?: any) => mockExpoAudio.setAudioModeAsync(opts),
}));

import {
  playVoiceAsset,
  stopVoiceAsset,
  probeVoiceAsset,
  disposeVoicePlayback,
  voiceAudioModeStatus,
  __resetVoicePlaybackForTests,
} from '../viaVoicePlayback';

describe('viaVoicePlayback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    __resetVoicePlaybackForTests();
  });

  afterEach(() => {
    disposeVoicePlayback();
    __resetVoicePlaybackForTests();
  });

  it('devuelve false de inmediato si assetModule es nulo o indefinido', async () => {
    expect(await playVoiceAsset(undefined)).toBe(false);
    expect(mockExpoAudio.createAudioPlayer).not.toHaveBeenCalled();
  });

  it('configura el modo de audio con mixWithOthers y arranca la reproducción', async () => {
    const fakePlayer = {
      play: jest.fn(),
      pause: jest.fn(),
      remove: jest.fn(),
      addListener: jest.fn(() => ({ remove: jest.fn() })),
    };
    mockExpoAudio.createAudioPlayer.mockReturnValue(fakePlayer);

    const started = await playVoiceAsset(1234);

    expect(started).toBe(true);
    expect(mockExpoAudio.setAudioModeAsync).toHaveBeenCalledWith({
      playsInSilentMode: true,
      shouldPlayInBackground: false,
      interruptionMode: 'mixWithOthers',
    });
    expect(mockExpoAudio.createAudioPlayer).toHaveBeenCalledWith(1234);
    expect(fakePlayer.play).toHaveBeenCalledTimes(1);
    expect(fakePlayer.addListener).toHaveBeenCalledWith('playbackStatusUpdate', expect.any(Function));
  });

  /* -------------------------------------------------------------------- */
  /*  El modo de sesión falla en silencio POR NATURALEZA: si no se aplica,  */
  /*  la voz enmudece con la tableta en silencio y pausa el estímulo en     */
  /*  curso en vez de mezclarse. Marcarlo como fijado ANTES de saber si la  */
  /*  llamada funcionó dejaba el modo sin aplicar para toda la sesión, y    */
  /*  sin nada que la pantalla pudiera enseñar (regla 4).                   */
  /* -------------------------------------------------------------------- */

  const makeFakePlayer = () => ({
    play: jest.fn(),
    pause: jest.fn(),
    remove: jest.fn(),
    addListener: jest.fn(() => ({ remove: jest.fn() })),
  });

  it('publica el modo de sesión como aplicado cuando la llamada funciona', async () => {
    mockExpoAudio.createAudioPlayer.mockReturnValue(makeFakePlayer());
    expect(voiceAudioModeStatus()).toEqual({ applied: false, error: null });

    await playVoiceAsset(1234);

    expect(voiceAudioModeStatus()).toEqual({ applied: true, error: null });
  });

  it('reintenta el modo de sesión y NOMBRA el fallo si la promesa rechaza', async () => {
    mockExpoAudio.createAudioPlayer.mockReturnValue(makeFakePlayer());
    mockExpoAudio.setAudioModeAsync.mockRejectedValueOnce(new Error('audio focus denied'));

    await playVoiceAsset(1234);
    // La promesa rechazada se resuelve en el siguiente tic del bucle.
    await Promise.resolve();
    await Promise.resolve();

    expect(voiceAudioModeStatus()).toEqual({ applied: false, error: 'audio focus denied' });

    // Y el intento siguiente vuelve a probar en vez de darlo por hecho.
    mockExpoAudio.setAudioModeAsync.mockResolvedValueOnce(undefined);
    await playVoiceAsset(5678);

    expect(mockExpoAudio.setAudioModeAsync).toHaveBeenCalledTimes(2);
    expect(voiceAudioModeStatus()).toEqual({ applied: true, error: null });
  });

  it('sigue locutando aunque el modo de sesión no se pueda fijar', async () => {
    mockExpoAudio.createAudioPlayer.mockReturnValue(makeFakePlayer());
    mockExpoAudio.setAudioModeAsync.mockImplementationOnce(() => {
      throw new Error('sin AudioManager');
    });

    // Degradar en silencio delante del niño sigue siendo lo correcto: lo que
    // no puede pasar es que nadie se entere.
    expect(await playVoiceAsset(1234)).toBe(true);
    expect(voiceAudioModeStatus().applied).toBe(false);
    expect(voiceAudioModeStatus().error).toMatch(/sin AudioManager/);
  });

  it('detiene la locución anterior al arrancar una nueva (ranura única)', async () => {
    const player1 = {
      play: jest.fn(),
      pause: jest.fn(),
      remove: jest.fn(),
      addListener: jest.fn(() => ({ remove: jest.fn() })),
    };
    const player2 = {
      play: jest.fn(),
      pause: jest.fn(),
      remove: jest.fn(),
      addListener: jest.fn(() => ({ remove: jest.fn() })),
    };

    mockExpoAudio.createAudioPlayer
      .mockReturnValueOnce(player1)
      .mockReturnValueOnce(player2);

    await playVoiceAsset(101);
    expect(player1.play).toHaveBeenCalledTimes(1);

    await playVoiceAsset(102);
    expect(player1.pause).toHaveBeenCalledTimes(1);
    expect(player1.remove).toHaveBeenCalledTimes(1);
    expect(player2.play).toHaveBeenCalledTimes(1);
  });

  it('stopVoiceAsset detiene y elimina el reproductor activo', async () => {
    const fakePlayer = {
      play: jest.fn(),
      pause: jest.fn(),
      remove: jest.fn(),
      addListener: jest.fn(() => ({ remove: jest.fn() })),
    };
    mockExpoAudio.createAudioPlayer.mockReturnValue(fakePlayer);

    await playVoiceAsset(202);
    stopVoiceAsset();

    expect(fakePlayer.pause).toHaveBeenCalledTimes(1);
    expect(fakePlayer.remove).toHaveBeenCalledTimes(1);
  });

  it('libera el reproductor cuando playbackStatusUpdate reporta didJustFinish', async () => {
    let statusCallback: (status: any) => void = () => {};
    const fakePlayer = {
      play: jest.fn(),
      pause: jest.fn(),
      remove: jest.fn(),
      addListener: jest.fn((event: string, cb: any) => {
        if (event === 'playbackStatusUpdate') {
          statusCallback = cb;
        }
        return { remove: jest.fn() };
      }),
    };
    mockExpoAudio.createAudioPlayer.mockReturnValue(fakePlayer);

    await playVoiceAsset(303);
    expect(fakePlayer.remove).not.toHaveBeenCalled();

    // Notificar fin de reproducción
    statusCallback({ didJustFinish: true });
    expect(fakePlayer.pause).toHaveBeenCalled();
    expect(fakePlayer.remove).toHaveBeenCalled();
  });

  it('captura excepciones al crear reproductor y devuelve false de forma segura', async () => {
    mockExpoAudio.createAudioPlayer.mockImplementation(() => {
      throw new Error('Fallo nativo al abrir MediaPlayer');
    });

    const result = await playVoiceAsset(404);
    expect(result).toBe(false);
  });

  describe('probeVoiceAsset', () => {
    it('devuelve aviso si assetModule es nulo', async () => {
      const probe = await probeVoiceAsset(undefined);
      expect(probe.loaded).toBe(false);
      expect(probe.advanced).toBe(false);
      expect(probe.detail).toMatch(/No hay ninguna locución/);
    });

    it('verifica carga exitosa y avance de posición de la locución', async () => {
      const fakePlayer = {
        isLoaded: true,
        duration: 1.5,
        currentTime: 0.1,
        playing: true,
        play: jest.fn(),
        pause: jest.fn(),
        remove: jest.fn(),
        addListener: jest.fn(() => ({ remove: jest.fn() })),
      };
      mockExpoAudio.createAudioPlayer.mockReturnValue(fakePlayer);

      const probe = await probeVoiceAsset(505, 500, 200);
      expect(probe.loaded).toBe(true);
      expect(probe.advanced).toBe(true);
      expect(probe.durationSec).toBe(1.5);
      expect(probe.detail).toMatch(/cargó \(1\.50 s\) y la reproducción avanzó/);
    });

    it('detecta cuando el reproductor no llega a cargar en el plazo', async () => {
      const fakePlayer = {
        isLoaded: false,
        duration: 0,
        currentTime: 0,
        playing: false,
        play: jest.fn(),
        pause: jest.fn(),
        remove: jest.fn(),
        addListener: jest.fn(() => ({ remove: jest.fn() })),
      };
      mockExpoAudio.createAudioPlayer.mockReturnValue(fakePlayer);

      const probe = await probeVoiceAsset(606, 100, 100);
      expect(probe.loaded).toBe(false);
      expect(probe.advanced).toBe(false);
      expect(probe.detail).toMatch(/no llegó a cargar/);
    });

    it('detecta cuando el reproductor carga pero no avanza tras play()', async () => {
      const fakePlayer = {
        isLoaded: true,
        duration: 2.0,
        currentTime: 0,
        playing: false,
        play: jest.fn(),
        pause: jest.fn(),
        remove: jest.fn(),
        addListener: jest.fn(() => ({ remove: jest.fn() })),
      };
      mockExpoAudio.createAudioPlayer.mockReturnValue(fakePlayer);

      const probe = await probeVoiceAsset(707, 200, 100);
      expect(probe.loaded).toBe(true);
      expect(probe.advanced).toBe(false);
      expect(probe.detail).toMatch(/la reproducción NO avanzó tras «play»/);
    });

    it('maneja errores del reproductor devolviendo detalle informativo', async () => {
      mockExpoAudio.createAudioPlayer.mockImplementation(() => {
        throw new Error('Codec no disponible');
      });

      const probe = await probeVoiceAsset(808, 100, 100);
      expect(probe.loaded).toBe(false);
      expect(probe.advanced).toBe(false);
      expect(probe.detail).toMatch(/Codec no disponible/);
    });
  });
});
