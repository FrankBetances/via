import { useCallback, useEffect, useState } from 'react';

import type { TtsStatus } from '@/Screens/VerbalAudiometry/verbalAudiometryAudio';
import { onVoiceStatusChange, retryVoiceEngine, voiceStatus } from './viaVoice';

/* -------------------------------------------------------------------------- */
/*  Estado del motor de voz del sistema, para la UI.                           */
/*                                                                             */
/*  Existe porque «no suena nada» es un síntoma con muchas causas distintas    */
/*  (motor no instalado, datos del idioma sin descargar, motor todavía         */
/*  arrancando, voz de red sin conectividad) y cada una tiene una acción       */
/*  distinta por parte del profesional. Sin esto, la pantalla solo podía       */
/*  callar, que es lo que hacía que el problema se reportara como «ningún      */
/*  motor de voz funciona» sin más pista.                                       */
/* -------------------------------------------------------------------------- */

export interface VoiceEngineStatus {
  /** `null` mientras no haya adaptador registrado (arranque de la app). */
  status: TtsStatus | null;
  /** ¿Hay que avisar al profesional? (solo cuando el motor NO va a sonar). */
  shouldWarn: boolean;
  /** ¿Hay un reintento en curso? */
  retrying: boolean;
  retry: () => void;
}

export function useVoiceEngineStatus(): VoiceEngineStatus {
  const [status, setStatus] = useState<TtsStatus | null>(() => voiceStatus());
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    const refresh = () => setStatus(voiceStatus());
    refresh();
    const unsubscribe = onVoiceStatusChange(refresh);
    // El adaptador se instala en el arranque de la app: si esta pantalla montó
    // antes, la suscripción de arriba no existe todavía y hay que volver a
    // mirar. Un único reintento diferido basta y evita un intervalo vivo.
    const t = setTimeout(refresh, 1500);
    return () => {
      unsubscribe();
      clearTimeout(t);
    };
  }, []);

  const retry = useCallback(() => {
    setRetrying(true);
    void retryVoiceEngine()
      .catch(() => false)
      .finally(() => {
        setRetrying(false);
        setStatus(voiceStatus());
      });
  }, []);

  return {
    status,
    shouldWarn: status?.phase === 'unavailable',
    retrying,
    retry,
  };
}
