import React from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Check, Globe, X } from 'lucide-react-native';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '@/Store';
import { setSessionLanguage } from '@/Store/slices/localeSlice';
import { SessionLang } from '@/Store/slices/sessionLangs';
import i18n from '@/I18n';

/* -------------------------------------------------------------------------- */
/*  LanguagePickerModal — Selector de idioma accesible y visual para VIA+     */
/*  Permite seleccionar entre los 7 idiomas/variantes soportados.             */
/* -------------------------------------------------------------------------- */

interface LanguageOption {
  code: SessionLang;
  flag: string;
  name: string;
  subtitle: string;
}

export const LANGUAGE_OPTIONS: LanguageOption[] = [
  {
    code: 'es',
    flag: '🇪🇸',
    name: 'Español (España)',
    subtitle: 'Idioma base de la batería clínica',
  },
  {
    code: 'gl',
    flag: '🌐',
    name: 'Galego',
    subtitle: 'Proxecto Nós · Celtia · ACOPROS',
  },
  {
    code: 'eu',
    flag: '🌐',
    name: 'Euskara',
    subtitle: 'HiTZ / AhoTTS · Maider · Ulertuz',
  },
  {
    code: 'ca',
    flag: '🌐',
    name: 'Català',
    subtitle: 'Localització en curs',
  },
  {
    code: 'es-419',
    flag: '🌎',
    name: 'Español (Latinoamérica)',
    subtitle: 'Variante neutra latinoamericana',
  },
  {
    code: 'es-DO',
    flag: '🇩🇴',
    name: 'Español (Rep. Dominicana)',
    subtitle: 'Quisqueya Habla · FONDOCYT',
  },
  {
    code: 'en',
    flag: '🇺🇸',
    name: 'English (US)',
    subtitle: 'American English user interface',
  },
];

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function LanguagePickerModal({ visible, onClose }: Props) {
  const dispatch = useDispatch();
  const currentLang = useSelector((state: RootState) => state.locale.language) as SessionLang;

  const handleSelect = (code: SessionLang) => {
    dispatch(setSessionLanguage(code));
    if (i18n.isInitialized) {
      i18n.changeLanguage(code).catch(() => {});
    }
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Cerrar selector" />
        
        <View style={styles.sheetContainer}>
          {/* Header del Modal */}
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderLeft}>
              <View style={styles.globeCircle}>
                <Globe size={20} color="#FF7F00" strokeWidth={2.4} />
              </View>
              <View>
                <Text style={styles.modalTitle}>Idioma de la aplicación</Text>
                <Text style={styles.modalSubtitle}>Selecciona la lengua o variante de sesión</Text>
              </View>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cerrar"
              style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}
              onPress={onClose}>
              <X size={20} color="#64748B" strokeWidth={2.4} />
            </Pressable>
          </View>

          {/* Lista de idiomas */}
          <ScrollView
            style={styles.langListScroll}
            contentContainerStyle={styles.langListContent}
            showsVerticalScrollIndicator={false}>
            {LANGUAGE_OPTIONS.map(opt => {
              const isSelected = currentLang === opt.code;
              return (
                <Pressable
                  key={opt.code}
                  accessibilityRole="button"
                  accessibilityLabel={`${opt.name}: ${opt.subtitle}`}
                  accessibilityState={{ selected: isSelected }}
                  style={({ pressed }) => [
                    styles.langCard,
                    isSelected && styles.langCardSelected,
                    pressed && styles.pressed,
                  ]}
                  onPress={() => handleSelect(opt.code)}>
                  <Text style={styles.flagEmoji}>{opt.flag}</Text>
                  
                  <View style={styles.langTextContainer}>
                    <Text style={[styles.langName, isSelected && styles.langNameSelected]}>
                      {opt.name}
                    </Text>
                    <Text style={styles.langSubtitle}>{opt.subtitle}</Text>
                  </View>

                  <View style={[styles.checkCircle, isSelected && styles.checkCircleSelected]}>
                    {isSelected && <Check size={14} color="#FFFFFF" strokeWidth={3} />}
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
