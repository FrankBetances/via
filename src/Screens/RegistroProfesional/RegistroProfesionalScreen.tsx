import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useDispatch } from 'react-redux';

import { Header } from '@/Components/Common';
import { RootStackParamList } from '@/Navigators';
import { AppDispatch } from '@/Store';
import { loginSuccess } from '@/Store/slices/authSlice';
import { Professional, ProfessionalRole } from '@/Models/Professional/Professional';
import { ProfessionalRepository } from '@/Repositories/ProfessionalRepository';
import { showErrorToast, showSuccessToast } from '@/Helpers/showToast';
import { writeWithVerify } from '@/Helpers/dbWrite';
import { hashPassword } from '@/Helpers/passwordHash';

import { useT } from '@/I18n';
import { atoms } from '@/Theme/styleAtoms';
/* -------------------------------------------------------------------------- */
/*  RegistroProfesionalScreen — alta del profesional responsable. Nombre,      */
/*  rol, email y contraseña son obligatorios. Todo es LOCAL: el perfil va a    */
/*  SQLite y la contraseña se guarda como PBKDF2 (`@/Helpers/passwordHash`).   */
/*  VIA+ ya no usa Firebase (2/11/2026). Al confirmar abre sesión              */
/*  (`loginSuccess`): el gate de DefaultNavigator aterriza en Pacientes. La    */
/*  sesión se abre DESPUÉS de guardar, no antes: un perfil que no llegó a      */
/*  guardarse no puede quedar con la sesión abierta.                           */
/*                                                                             */
/*  Diseño: lenguaje visual de Bienvenida/Créditos (crema + naranja + mono),   */
/*  con VISTA PREVIA EN VIVO del perfil según se escribe y roles como chips    */
/*  con emoji.                                                                 */
/* -------------------------------------------------------------------------- */

type Props = NativeStackScreenProps<RootStackParamList, 'RegistroProfesional'>;

const ROLES: { value: ProfessionalRole; label: string; emoji: string }[] = [
  { value: 'medico', label: 'Médico', emoji: '🩺' },
  { value: 'medico', label: 'Otorrino', emoji: '👂' },
  { value: 'logopeda', label: 'Logopeda', emoji: '🗣️' },
  { value: 'enfermero', label: 'Enfermería', emoji: '💉' },
  { value: 'medico', label: 'Médico A. Primaria', emoji: '🏥' },
  { value: 'medico', label: 'Pediatra', emoji: '🧸' },
  { value: 'psicopedagogo', label: 'Psicopedagogo/a', emoji: '🧠' },
];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '';
  return parts
    .slice(0, 2)
    .map(p => p[0]?.toUpperCase() ?? '')
    .join('');
}

export default function RegistroProfesionalScreen({ navigation: _navigation }: Props) {
  const t = useT();
  const dispatch = useDispatch<AppDispatch>();

  const [nombre, setNombre] = useState('');
  const [rolLabel, setRolLabel] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [colegiado, setColegiado] = useState('');
  // El campo «Servicio» se retiró del alta: no se persistía en el perfil
  // (`Professional` no tiene esa columna) ni viajaba a Firestore, así que solo
  // añadía fricción al registro.
  const [centro, setCentro] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const selectedRole = ROLES.find(r => r.label === rolLabel);

  const nameOk = nombre.trim().length > 0;
  const roleOk = !!rolLabel;
  const emailOk = /^\S+@\S+\.\S+$/.test(email.trim());
  const passwordOk = password.length >= 6;
  const ready = nameOk && roleOk && emailOk && passwordOk;
  const requiredCount = useMemo(
    () => [nameOk, roleOk, emailOk, passwordOk].filter(Boolean).length,
    [nameOk, roleOk, emailOk, passwordOk],
  );

  const handleSubmit = async () => {
    if (!ready || isSaving) return;
    setIsSaving(true);

    const trimmedName = nombre.trim();
    const trimmedLicense = colegiado.trim();
    const trimmedEmail = email.trim().toLowerCase();
    const role = selectedRole?.value ?? 'medico';

    // Mismo correo o mismo colegiado: NO se reutiliza el perfil ni se abre su
    // sesión. Antes se reutilizaba en silencio, lo que con contraseñas locales
    // sería entrar en un perfil ajeno sin conocer su contraseña.
    try {
      const existing =
        (await ProfessionalRepository.getProfessionalByEmail(trimmedEmail)) ??
        (trimmedLicense ? await ProfessionalRepository.getProfessionalByLicense(trimmedLicense) : null);
      if (existing) {
        showErrorToast(t.registroProfesional.perfilYaExisteTitulo, t.registroProfesional.perfilYaExiste);
        setIsSaving(false);
        return;
      }
    } catch {
      // Si la lectura falla, se sigue: la escritura dirá si hay un problema.
    }

    // PBKDF2 bloquea el hilo de JS un momento: se cede antes para que el
    // indicador de guardado llegue a pintarse.
    await new Promise<void>(resolve => setTimeout(resolve, 0));
    try {
      const professional = new Professional();
      professional.fullName = trimmedName;
      professional.role = role;
      professional.licenseNumber = trimmedLicense;
      professional.email = trimmedEmail;
      professional.passwordHash = hashPassword(password);
      professional.centerId = null;
      const saved = await writeWithVerify(
        () => ProfessionalRepository.createProfessional(professional),
        () => ProfessionalRepository.getProfessionalByEmail(trimmedEmail),
      );
      dispatch(
        loginSuccess({
          id: saved.id,
          fullName: saved.fullName,
          licenseNumber: saved.licenseNumber,
          role: saved.role,
          email: saved.email ?? trimmedEmail,
          centerId: saved.centerId,
          createdAt: saved.createdAt?.toISOString?.() ?? new Date().toISOString(),
        }),
      );
      showSuccessToast(t.registroProfesional.registroCompletado, t.registroProfesional.bienvenida(trimmedName));
    } catch (e) {
      const detail = e instanceof Error && e.message ? e.message : String(e);
      showErrorToast(t.registroProfesional.perfilNoGuardadoTitulo, t.registroProfesional.perfilNoGuardado(detail));
    } finally {
      setIsSaving(false);
    }
  };

  const previewInitials = initials(nombre);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#F1ECE2" />
      <View style={styles.blobTopRight} pointerEvents="none" />
      <View style={styles.blobBottomLeft} pointerEvents="none" />

      <Header animationType="expand" />

      <KeyboardAvoidingView style={atoms.flex1} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          style={atoms.flex1}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          {/* ----- título ----- */}
          <Text style={styles.overline}>{t.registroProfesional.perfilProfesionalSolaVez}</Text>
          <Text style={styles.title}>{t.registroProfesional.creaTuPerfil}</Text>
          <Text style={styles.subtitle}>{t.registroProfesional.responsableEvaluacionesEsteDispositivo}</Text>

          {/* ----- vista previa en vivo ----- */}
          <View style={styles.previewCard}>
            <View style={styles.previewLabelRow}>
              <View style={styles.previewDot} />
              <Text style={styles.previewLabel}>{t.registroProfesional.asiVeraTuPerfil}</Text>
            </View>
            <View style={styles.previewBody}>
              <View style={styles.previewRing}>
                <View style={styles.previewAvatar}>
                  <Text style={styles.previewAvatarText}>{previewInitials || '🧑‍⚕️'}</Text>
                </View>
              </View>
              <View style={atoms.flex1}>
                <Text style={[styles.previewName, !nameOk && styles.previewPlaceholder]}>
                  {nameOk ? nombre.trim() : t.registroProfesional.tuNombreApellidos}
                </Text>
                <View style={styles.previewMetaRow}>
                  <View style={[styles.previewRoleChip, roleOk && styles.previewRoleChipActive]}>
                    <Text style={[styles.previewRoleText, roleOk && styles.previewRoleTextActive]}>
                      {selectedRole ? `${selectedRole.emoji} ${selectedRole.label}` : t.registroProfesional.eligeTuRol}
                    </Text>
                  </View>
                  {colegiado.trim() ? <Text style={styles.previewLicense}>{t.registroProfesional.col} {colegiado.trim()}</Text> : null}
                </View>
              </View>
            </View>
          </View>

          {/* ----- formulario ----- */}
          <View style={styles.formCard}>
            <Text style={styles.fieldLabel}>
              
              {t.registroProfesional.nombreApellidos} <Text style={styles.fieldRequired}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              placeholder={t.registroProfesional.ejElenaRuizSoto}
              placeholderTextColor="#B8B2A7"
              value={nombre}
              onChangeText={setNombre}
            />

            <Text style={[styles.fieldLabel, atoms.marginTop16]}>
              
              {t.registroProfesional.rolProfesional} <Text style={styles.fieldRequired}>*</Text>
            </Text>
            <View style={styles.rolesWrap}>
              {ROLES.map(r => {
                const selected = rolLabel === r.label;
                return (
                  <Pressable key={r.label} onPress={() => setRolLabel(r.label)}>
                    <View style={[styles.roleChip, selected && styles.roleChipSelected]}>
                      <Text style={styles.roleEmoji}>{r.emoji}</Text>
                      <Text style={[styles.roleText, selected && styles.roleTextSelected]}>{r.label}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>

            <Text style={[styles.fieldLabel, atoms.marginTop16]}>
              
              {t.registroProfesional.email} <Text style={styles.fieldRequired}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              placeholder={t.registroProfesional.nombreCentro}
              placeholderTextColor="#B8B2A7"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
            />

            <Text style={[styles.fieldLabel, atoms.marginTop16]}>
              
              {t.registroProfesional.contrasena} <Text style={styles.fieldRequired}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              placeholder={t.registroProfesional.minimo6Caracteres}
              placeholderTextColor="#B8B2A7"
              value={password}
              onChangeText={setPassword}
              autoCapitalize="none"
              secureTextEntry
            />

            <View style={styles.row}>
              <View style={atoms.flex1}>
                <Text style={styles.fieldLabel}>{t.registroProfesional.nColegiadoOpcional}</Text>
                <TextInput
                  style={styles.input}
                  placeholder="28/1234"
                  placeholderTextColor="#B8B2A7"
                  value={colegiado}
                  onChangeText={setColegiado}
                />
              </View>
            </View>

            <Text style={[styles.fieldLabel, atoms.marginTop16]}>{t.registroProfesional.centroTrabajoOpcional}</Text>
            <TextInput
              style={styles.input}
              placeholder={t.registroProfesional.hospitalCentroSalud}
              placeholderTextColor="#B8B2A7"
              value={centro}
              onChangeText={setCentro}
            />

            <View style={styles.hint}>
              <Text style={styles.hintEmoji}>💡</Text>
              <Text style={styles.hintText}>
                
                {t.registroProfesional.esteRegistroRealizaSolaVez}
              </Text>
            </View>
          </View>
        </ScrollView>

        {/* ----- footer ----- */}
        <View style={styles.footer}>
          <View style={styles.progressRow}>
            <View style={[styles.progressSeg, nameOk && styles.progressSegDone]} />
            <View style={[styles.progressSeg, roleOk && styles.progressSegDone]} />
            <View style={[styles.progressSeg, emailOk && styles.progressSegDone]} />
            <View style={[styles.progressSeg, passwordOk && styles.progressSegDone]} />
            <Text style={styles.progressText}>{requiredCount}{t.registroProfesional.n4Obligatorios}</Text>
          </View>
          <Pressable
            disabled={!ready || isSaving}
            onPress={handleSubmit}
            style={({ pressed }) => [
              styles.button,
              (!ready || isSaving) && styles.buttonDisabled,
              pressed && ready && !isSaving && styles.buttonPressed,
            ]}>
            {isSaving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Text style={styles.buttonText}>{t.registroProfesional.guardarContinuar}</Text>
                <Text style={styles.buttonArrow}>→</Text>
              </>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const MONO = Platform.OS === 'ios' ? 'Courier' : 'monospace';

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F1ECE2',
  },
  blobTopRight: {
    position: 'absolute',
    top: -150,
    right: -120,
    width: 380,
    height: 380,
    borderRadius: 190,
    backgroundColor: 'rgba(240,174,108,0.18)',
  },
  blobBottomLeft: {
    position: 'absolute',
    bottom: -170,
    left: -130,
    width: 360,
    height: 360,
    borderRadius: 180,
    backgroundColor: 'rgba(255,204,128,0.14)',
  },
  scroll: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },

  overline: {
    fontFamily: MONO,
    fontSize: 10,
    letterSpacing: 1.6,
    fontWeight: '700',
    color: '#B3A791',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.6,
    color: '#3A352F',
    marginTop: 4,
  },
  subtitle: {
    fontSize: 13,
    color: '#8A8274',
    marginTop: 4,
    marginBottom: 16,
  },

  /* ----- preview ----- */
  previewCard: {
    borderRadius: 20,
    backgroundColor: '#3A352F',
    padding: 16,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  previewLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 12,
  },
  previewDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#FF7F00',
  },
  previewLabel: {
    fontFamily: MONO,
    fontSize: 9,
    letterSpacing: 1.4,
    fontWeight: '700',
    color: '#B3A791',
  },
  previewBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
  },
  previewRing: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: '#FF7F00',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#FF7F00',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewAvatarText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  previewName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  previewPlaceholder: {
    color: '#8A8274',
    fontWeight: '600',
  },
  previewMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 5,
  },
  previewRoleChip: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  previewRoleChipActive: {
    backgroundColor: 'rgba(255,127,0,0.25)',
  },
  previewRoleText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#8A8274',
  },
  previewRoleTextActive: {
    color: '#FFB566',
  },
  previewLicense: {
    fontFamily: MONO,
    fontSize: 10,
    color: '#B3A791',
  },

  /* ----- form ----- */
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#EFE8DB',
    padding: 18,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6E6759',
    marginBottom: 7,
  },
  fieldRequired: {
    color: '#FF7F00',
  },
  input: {
    borderWidth: 1.5,
    borderColor: '#E9E2D5',
    borderRadius: 13,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 12 : 9,
    fontSize: 15,
    color: '#3A352F',
    backgroundColor: '#FBF9F4',
  },
  rolesWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  roleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: '#E9E2D5',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  roleChipSelected: {
    borderColor: '#FF7F00',
    backgroundColor: 'rgba(255,127,0,0.08)',
  },
  roleEmoji: {
    fontSize: 15,
  },
  roleText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#6E6759',
  },
  roleTextSelected: {
    color: '#C2410C',
    fontWeight: '800',
  },
  row: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  hint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
    backgroundColor: 'rgba(255,127,0,0.07)',
    borderRadius: 14,
    padding: 12,
    marginTop: 18,
  },
  hintEmoji: {
    fontSize: 15,
  },
  hintText: {
    flex: 1,
    fontSize: 11.5,
    lineHeight: 17,
    color: '#8A6A46',
  },

  /* ----- footer ----- */
  footer: {
    paddingHorizontal: 24,
    paddingTop: 10,
    paddingBottom: 26,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  progressSeg: {
    flex: 1,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#E5DECF',
  },
  progressSegDone: {
    backgroundColor: '#FF7F00',
  },
  progressText: {
    fontFamily: MONO,
    fontSize: 10,
    fontWeight: '700',
    color: '#A89F93',
    marginLeft: 6,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 11,
    backgroundColor: '#FF7F00',
    borderRadius: 999,
    paddingVertical: 17,
    shadowColor: '#FF7F00',
    shadowOpacity: 0.36,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 14 },
    elevation: 10,
  },
  buttonDisabled: {
    backgroundColor: '#D8CFC0',
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonPressed: {
    opacity: 0.88,
    transform: [{ translateY: -2 }],
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  buttonArrow: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
});
