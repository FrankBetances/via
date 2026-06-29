/* -------------------------------------------------------------------------- */
/*  Shim de tipos — `react-native-audio-api` (versión instalada: 0.5.7) no    */
/*  expone `AudioManager`/`AudioRecorder` en sus declaraciones públicas,      */
/*  pero ambos forman parte de la API nativa del paquete (gestión de sesión   */
/*  de audio y captura PCM) usada por `AudioEngineProvider`. Se declaran aquí  */
/*  como augmentación ambiental hasta que el paquete publique sus tipos.      */
/* -------------------------------------------------------------------------- */
import 'react-native-audio-api';

declare module 'react-native-audio-api' {
  export interface AudioSessionOptions {
    iosCategory?: string;
    iosMode?: string;
    iosOptions?: string[];
  }

  export const AudioManager: {
    setAudioSessionOptions(options: AudioSessionOptions): void;
    requestRecordingPermissions(): Promise<'Granted' | 'Denied' | string>;
    setAudioSessionActivity(active: boolean): Promise<void>;
  };

  export interface AudioRecorderOptions {
    sampleRate: number;
    bufferLengthInSamples: number;
  }

  export interface AudioReadyEvent {
    buffer: import('react-native-audio-api').AudioBuffer;
    numFrames: number;
    when: number;
  }

  export class AudioRecorder {
    constructor(options: AudioRecorderOptions);
    connect(): import('react-native-audio-api').AudioNode;
    onAudioReady(callback: (event: AudioReadyEvent) => void): void;
    start(): void;
    stop(): void;
  }
}
