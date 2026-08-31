/* -------------------------------------------------------------------------- */
/*  VIA+ · Selector de idioma de la INTERFAZ                                    */
/*                                                                             */
/*  Sigue a `src/ValeriaUiLangPicker.tsx` de Valeria+ (regla 1), incluida su    */
/*  decisión central: elegir un idioma cambia la APP ENTERA —textos Y           */
/*  locuciones—, no solo los textos. Frank lo dejó dicho allí con estas         */
/*  palabras: «si estamos trabajando en una versión en inglés, es en inglés     */
/*  para toda la app».                                                          */
/*                                                                             */
/*  QUÉ HACÍA ANTES ESTE FICHERO, para que no vuelva a pasar: despachaba        */
/*  `setSessionLanguage` (la variedad clínica) y llamaba a                      */
/*  `i18n.changeLanguage` dentro de un `if (i18n.isInitialized)` que en el      */
/*  dispositivo era SIEMPRE falso, porque `initI18n()` no lo llamaba nadie.     */
/*  Resultado: elegir «English» dejaba la app entera en castellano y movía en   */
/*  silencio el banco de estímulos. La mitad visible no hacía nada; la          */
/*  invisible, sí.                                                              */
/*                                                                             */
/*  Ahora las dos mitades van juntas y por el mismo camino: `setAppLanguage`    */
/*  fija el idioma de interfaz (módulo con suscripción → repinta) y aplica la   */
/*  variedad (redux → banco, voz y ASR).                                        */
/*                                                                             */
/*  A diferencia de Valeria+ no hay opción «Automático»: allí existe porque el  */
/*  idioma de interfaz (3) es un subconjunto de las variedades (6) y hay que    */
/*  poder volver al acoplamiento por defecto. Aquí la correspondencia es 1:1,   */
/*  así que «Automático» no tendría nada distinto que hacer.                    */
/* -------------------------------------------------------------------------- */
import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Check, Globe, X } from 'lucide-react-native';
import { useDispatch } from 'react-redux';

import { setSessionLanguage } from '@/Store/slices/localeSlice';
import { SESSION_LANG_LABEL, SessionLang } from '@/Store/slices/sessionLangs';
import { useT } from '@/I18n';
import { UiLang, ALL_UI_LANGS, getUiLang, setAppLanguage, subscribeUiLang } from '@/I18n/uiLang';

/** Bandera de cada variedad. El nombre y el pie salen del catálogo activo. */
const FLAG: Record<UiLang, string> = {
  es: '🇪🇸',
  gl: '🌐',
  eu: '🌐',
  ca: '🌐',
  'es-419': '🌎',
  'es-DO': '🇩🇴',
  en: '🇺🇸',
};

/** Códigos ofrecidos, en el orden estable de `SESSION_LANGS`. */
export const LANGUAGE_OPTIONS: readonly UiLang[] = ALL_UI_LANGS;

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function LanguagePickerModal({ visible, onClose }: Props) {
  const t = useT();
  const dispatch = useDispatch();

  // El idioma de interfaz no es un store de redux (ver `I18n/uiLang.ts`), así
  // que la suscripción es la del módulo. `useT()` ya se resuscribe por su
  // cuenta; esto repinta la marca de selección.
  const [, force] = React.useReducer((n: number) => n + 1, 0);
  React.useEffect(() => subscribeUiLang(force), []);
  const current = getUiLang();

  // Pie de cada opción, en el idioma activo del catálogo.
  const hintOf = (code: UiLang): string =>
    ({
      es: t.langPicker.hintEs,
      gl: t.langPicker.hintGl,
      eu: t.langPicker.hintEu,
      ca: t.langPicker.hintCa,
      'es-419': t.langPicker.hintEs419,
      'es-DO': t.langPicker.hintEsDO,
      en: t.langPicker.hintEn,
    })[code];

  const choose = (code: UiLang): void => {
    // Cambia la app ENTERA: textos (idioma de interfaz) y locuciones
    // (variedad de sesión). Ver `setAppLanguage`.
    void setAppLanguage(code, lang => {
      dispatch(setSessionLanguage(lang as SessionLang));
    });
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityLabel={t.langPicker.closeA11y}
        />

        <View style={styles.sheetContainer}>
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderLeft}>
              <View style={styles.globeCircle}>
                <Globe size={20} color="#FF7F00" strokeWidth={2.4} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>{t.langPicker.title}</Text>
                <Text style={styles.modalSubtitle}>{t.langPicker.subtitle}</Text>
              </View>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t.langPicker.closeA11y}
              style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}
              onPress={onClose}>
              <X size={20} color="#64748B" strokeWidth={2.4} />
            </Pressable>
          </View>

          <ScrollView
            style={styles.langListScroll}
            contentContainerStyle={styles.langListContent}
            showsVerticalScrollIndicator={false}>
            {LANGUAGE_OPTIONS.map(code => {
              const name = SESSION_LANG_LABEL[code];
              const hint = hintOf(code);
              const isSelected = current === code;
              return (
                <Pressable
                  key={code}
                  accessibilityRole="radio"
                  accessibilityLabel={t.langPicker.optionA11y(name, hint)}
                  accessibilityState={{ selected: isSelected }}
                  style={({ pressed }) => [
                    styles.langCard,
                    isSelected && styles.langCardSelected,
                    pressed && styles.pressed,
                  ]}
                  onPress={() => choose(code)}>
                  <Text style={styles.flagEmoji}>{FLAG[code]}</Text>

                  <View style={styles.langTextContainer}>
                    <Text style={[styles.langName, isSelected && styles.langNameSelected]}>
                      {name}
                    </Text>
                    <Text style={styles.langSubtitle}>{hint}</Text>
                  </View>

                  <View style={[styles.checkCircle, isSelected && styles.checkCircleSelected]}>
                    {isSelected ? <Check size={14} color="#FFFFFF" strokeWidth={3} /> : null}
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(43, 38, 32, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 32,
  },
  sheetContainer: {
    width: '100%',
    maxWidth: 500,
    maxHeight: '85%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#EDE7DC',
    overflow: 'hidden',
    shadowColor: '#2B2620',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    backgroundColor: '#FAF8F5',
  },
  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  globeCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 127, 0, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 127, 0, 0.25)',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#2B2620',
    letterSpacing: -0.2,
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.75,
  },
  langListScroll: {
    flexGrow: 0,
  },
  langListContent: {
    padding: 16,
    gap: 10,
  },
  langCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: '#FAF8F5',
    borderWidth: 1.5,
    borderColor: '#EFEBE4',
    minHeight: 58,
  },
  langCardSelected: {
    backgroundColor: 'rgba(255, 127, 0, 0.06)',
    borderColor: '#FF7F00',
  },
  flagEmoji: {
    fontSize: 22,
    marginRight: 14,
  },
  langTextContainer: {
    flex: 1,
  },
  langName: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#1E293B',
  },
  langNameSelected: {
    color: '#D97706',
    fontWeight: '800',
  },
  langSubtitle: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 2,
  },
  checkCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },
  checkCircleSelected: {
    backgroundColor: '#FF7F00',
    borderColor: '#FF7F00',
  },
});
