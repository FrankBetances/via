/* -------------------------------------------------------------------------- */
/*  Capa de voz neuronal multi-idioma de VIA+ (es · gl · eu · es-DO).          */
/*                                                                             */
/*  Arquitectura portada del blueprint «corpus de voz neuronal NÓS/ILENIA»     */
/*  (Valeria+). Ver docs/design/arquitectura-corpus-voz.md para el mapa de     */
/*  componentes, el pipeline build-time y las tareas de cableado pendientes.   */
/* -------------------------------------------------------------------------- */

export {
  voiceCorpusId,
  normalizeVoiceText,
  fnv1a32,
  voiceLangPrefix,
  VOICE_LANGS,
  VOICE_STYLES,
  VOICE_BASE_LANG,
  VOICE_LANG_BASE,
} from './voiceCorpusId';
export type { VoiceStyle, VoiceLang } from './voiceCorpusId';

export { buildVoiceCorpus, voiceCorpusStats } from './viaVoiceCorpus';
export type { VoiceCorpusEntry, VoiceCorpusStats } from './viaVoiceCorpus';

export {
  CONSIGNAS,
  EF_RULE_CONSIGNAS,
  TAR_MODELS,
  VOICE_CONTENT_BANKS,
  efConsignaText,
  efConsignaByLang,
  efRuleConsignaByLang,
  tarModelByLang,
  EF_CONSIGNA_LANGS,
  TAR_MODEL_LANGS,
  PROSODY_CONSIGNAS,
  prosodyConsignaTextByLang,
  PROSODY_CONSIGNA_LANGS,
} from './viaVoiceConsignas';
export type { ConsignaSpec, ConsignaText } from './viaVoiceConsignas';

export { resolveVoiceAsset, toVoiceLang } from './viaVoiceResolve';
export { resolveSpokenText, isSpokenTextDegraded, bankLangs } from './viaVoiceLocale';
export type { SpokenText, TextByLang } from './viaVoiceLocale';
export { VOICE_ASSETS, VOICE_ASSETS_VERSION } from './viaVoiceAssets';

export {
  speak,
  speakLocalized,
  stopSpeaking,
  canSpeak,
  voiceStatus,
  retryVoiceEngine,
  onVoiceStatusChange,
} from './viaVoice';
export { playVoiceAsset, stopVoiceAsset, disposeVoicePlayback } from './viaVoicePlayback';

export { useVoiceEngineStatus } from './useVoiceEngineStatus';
export type { VoiceEngineStatus } from './useVoiceEngineStatus';
