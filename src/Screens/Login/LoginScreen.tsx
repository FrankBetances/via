import React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '@/Store';
import { loginSuccess } from '@/Store/slices/authSlice';

/* -------------------------------------------------------------------------- */
/*  LoginScreen — pantalla MÍNIMA para que el navegador type-checke y el      */
/*  flujo de autenticación tenga un punto de entrada real. La UI final        */
/*  (acorde a los mockups) y la autenticación real (JWT) llegan en fases      */
/*  posteriores. `onSubmit` solo despacha un login de stub.                  */
/* -------------------------------------------------------------------------- */

interface LoginFormValues {
  email: string;
  password: string;
}

const schema = yup.object({
  email: yup.string().email().required(),
  password: yup.string().min(6).required(),
});

export default function LoginScreen() {
  const dispatch = useDispatch<AppDispatch>();
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: yupResolver(schema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = (values: LoginFormValues) => {
    // STUB: sustituir por autenticación JWT real contra el backend / store local.
    dispatch(
      loginSuccess({
        id: 0,
        fullName: 'Profesional',
        licenseNumber: '',
        role: 'medico',
        email: values.email,
        centerId: null,
        createdAt: new Date().toISOString(),
      }),
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>VIA+</Text>

      <Controller
        control={control}
        name="email"
        render={({ field: { onChange, onBlur, value } }) => (
          <TextInput
            style={styles.input}
            placeholder="Email"
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
            secureTextEntry
            onBlur={onBlur}
            onChangeText={onChange}
            value={value}
          />
        )}
      />
      {errors.password && <Text style={styles.error}>{errors.password.message}</Text>}

      <Pressable style={styles.button} onPress={handleSubmit(onSubmit)}>
        <Text style={styles.buttonText}>Entrar</Text>
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
  title: {
    fontSize: 28,
    fontWeight: '600',
    color: '#2B2620',
    textAlign: 'center',
    marginBottom: 24,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
  },
  error: {
    color: '#D1564A',
    fontSize: 12,
  },
  button: {
    backgroundColor: '#F0AE6C',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  buttonText: {
    color: '#2B2620',
    fontSize: 16,
    fontWeight: '600',
  },
});
