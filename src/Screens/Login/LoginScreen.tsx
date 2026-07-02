import React, { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { useDispatch } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/Navigators/screenTypeNavigator';
import { AppDispatch } from '@/Store';
import { loginSuccess } from '@/Store/slices/authSlice';
import { ProfessionalRepository } from '@/Repositories/ProfessionalRepository';
import ViaIcon from '@/Components/Common/ViaIcon';

/* -------------------------------------------------------------------------- */
/*  LoginScreen — acceso del profesional. Fase 1 (offline-first, sin backend): */
/*  busca el profesional por email en la BD local y abre sesión si existe.    */
/*  La verificación real de contraseña (hash + JWT) llega en una fase          */
/*  posterior; por ahora la contraseña solo se valida en formato.             */
/*  Si el dispositivo aún no tiene ningún profesional dado de alta, el enlace  */
/*  inferior lleva a `RegistroProfesional` (antes esa pantalla era             */
/*  inalcanzable desde el flujo de bienvenida).                                */
/* -------------------------------------------------------------------------- */

type Nav = NativeStackNavigationProp<RootStackParamList, 'Login'>;

interface LoginFormValues {
  email: string;
  password: string;
}

const schema = yup.object({
  email: yup.string().email('Introduce un email válido').required('El email es obligatorio'),
  password: yup
    .string()
    .min(6, 'La contraseña debe tener al menos 6 caracteres')
    .required('La contraseña es obligatoria'),
});

export default function LoginScreen() {
  const dispatch = useDispatch<AppDispatch>();
  const navigation = useNavigation<Nav>();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: yupResolver(schema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (values: LoginFormValues) => {
    setSubmitError(null);
    setIsSubmitting(true);
    try {
      const professional = await ProfessionalRepository.getProfessionalByEmail(
        values.email.trim().toLowerCase(),
      );
      if (!professional) {
        setSubmitError(
          'No hay ningún profesional registrado con ese email en este dispositivo. Regístrate primero.',
        );
        return;
      }
      dispatch(
        loginSuccess({
          id: professional.id,
          fullName: professional.fullName,
          licenseNumber: professional.licenseNumber,
          role: professional.role,
          email: professional.email,
          centerId: professional.centerId,
          createdAt: professional.createdAt?.toISOString?.() ?? new Date().toISOString(),
        }),
      );
    } catch (e) {
      setSubmitError('No se pudo comprobar el acceso. Inténtalo de nuevo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.logoBlock}>
        <ViaIcon size={72} variant="color" />
        <Text style={styles.title}>
          VIA<Text style={styles.titlePlus}>+</Text>
        </Text>
        <Text style={styles.subtitle}>Acceso del profesional</Text>
      </View>

      <Controller
        control={control}
        name="email"
        render={({ field: { onChange, onBlur, value } }) => (
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#A89F93"
            autoCapitalize="none"
            keyboardType="email-address"
            onBlur={onBlur}
            onChangeText={onChange}
            value={value}
          />
        )}
      />
      {errors.email && <Text style={styles.error}>{errors.email.message}</Text>}

      <Controller
        control={control}
        name="password"
        render={({ field: { onChange, onBlur, value } }) => (
          <TextInput
            style={styles.input}
            placeholder="Contraseña"
            placeholderTextColor="#A89F93"
            secureTextEntry
            onBlur={onBlur}
            onChangeText={onChange}
            value={value}
          />
        )}
      />
      {errors.password && <Text style={styles.error}>{errors.password.message}</Text>}

      {submitError && <Text style={styles.error}>{submitError}</Text>}

      <Pressable
        style={[styles.button, isSubmitting && styles.buttonDisabled]}
        disabled={isSubmitting}
        onPress={handleSubmit(onSubmit)}
      >
        <Text style={styles.buttonText}>{isSubmitting ? 'Comprobando…' : 'Entrar'}</Text>
      </Pressable>

      <Pressable style={styles.registerLink} onPress={() => navigation.navigate('RegistroProfesional')}>
        <Text style={styles.registerLinkText}>
          ¿Primera vez en este dispositivo?{' '}
          <Text style={styles.registerLinkAccent}>Registra tu perfil profesional</Text>
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F2EC',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 12,
  },
  logoBlock: {
    alignItems: 'center',
    gap: 10,
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#2B2620',
    textAlign: 'center',
    letterSpacing: -1,
  },
  titlePlus: {
    color: '#FF7F00',
  },
  subtitle: {
    fontSize: 13,
    color: '#7A746B',
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#2B2620',
  },
  error: {
    color: '#D1564A',
    fontSize: 12,
  },
  button: {
    backgroundColor: '#FF7F00',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  registerLink: {
    marginTop: 16,
    alignItems: 'center',
  },
  registerLinkText: {
    fontSize: 13,
    color: '#7A746B',
    textAlign: 'center',
  },
  registerLinkAccent: {
    color: '#E8720C',
    fontWeight: '700',
  },
});
