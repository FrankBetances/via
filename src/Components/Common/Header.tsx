import React from 'react';
import { HStack, Icon, Pressable } from '@gluestack-ui/themed';
import { ArrowLeft } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/* -------------------------------------------------------------------------- */
/*  Header — cabecera mínima compartida por las 9 pantallas de módulo.        */
/*  Las pantallas solo usan `<Header animationType="expand" />` sin más       */
/*  props ni children: un botón de retroceso flotante respetando el inset     */
/*  superior. `animationType` se acepta y se ignora (placeholder de una       */
/*  fase de UI posterior con animación de colapso al hacer scroll).           */
/* -------------------------------------------------------------------------- */

export interface HeaderProps {
  animationType?: 'expand' | 'none';
}

export default function Header({ animationType: _animationType }: HeaderProps) {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  return (
    <HStack pt={insets.top + 8} px="$6" pb="$2" alignItems="center">
      <Pressable
        onPress={() => navigation.goBack()}
        $pressed-opacity={0.6}
        accessibilityRole="button"
        accessibilityLabel="Volver">
        <Icon as={ArrowLeft} size="lg" color="$textLight700" />
      </Pressable>
    </HStack>
  );
}
