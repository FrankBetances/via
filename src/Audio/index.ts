/* -------------------------------------------------------------------------- */
/*  Capa de audio de VIA+ — punto de entrada único.                             */
/*                                                                             */
/*  Todo módulo que reproduzca o grabe audio pasa por aquí: un solo             */
/*  AudioContext nativo para toda la app y una sola sesión de audio. Ver        */
/*  `sharedAudioContext.ts` para el porqué (streams exclusivos de Oboe en       */
/*  Android y AVAudioEngine compartido en iOS).                                 */
/* -------------------------------------------------------------------------- */

export {
  acquireAudioContext,
  acquireRecordingSession,
  audioContextRefCount,
  AUDIO_SAMPLE_RATE,
  isAudioEngineAvailable,
  isRecordingSessionActive,
  onRecordingSessionChange,
  peekAudioContext,
  releaseAudioContext,
  resumeAudioContext,
  __resetSharedAudioContextForTests,
} from './sharedAudioContext';
export type { SharedAudioContext } from './sharedAudioContext';

export {
  acquireRecorder,
  isRecorderAvailable,
  isRecorderPermissionGranted,
  RECORDER_SAMPLE_RATE,
  recorderHealth,
  recorderRefCount,
  setRecorderPermissionGranted,
  __resetSharedAudioRecorderForTests,
} from './sharedAudioRecorder';
export type { RecorderHealth, RecorderListener, SharedRecorder } from './sharedAudioRecorder';
