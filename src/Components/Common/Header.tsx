import React from 'react';
import { HStack, Icon, Pressable, Text } from '@gluestack-ui/themed';
import { ArrowLeft } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useT } from '@/I18n';
/* -------------------------------------------------------------------------- */
/*  Header — cabecera mínima compartida por las 9 pantallas de módulo.        */
/*  Las pantallas solo usan `<Header animationType="expand" />` sin más       */
/*  props ni children: un botón de retroceso etiquetado («Volver») respetando */
/*  el inset superior; se oculta cuando no hay pantalla previa en el stack.   */
/*  `animationType` se acepta y se ignora (placeholder de una fase de UI      */
/*  posterior con animación de colapso al hacer scroll).                      */
/* -------------------------------------------------------------------------- */

export interface HeaderProps {
  animationType?: 'expand' | 'none';
}

export default function Header({ animationType: _animationType }: HeaderProps) {
  const t = useT();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const canGoBack = navigation.canGoBack();

  return (
    <HStack pt={insets.top + 8} px="$6" pb="$2" alignItems="center">
      {canGoBack ? (
        <Pressable
          onPress={() => navigation.goBack()}
          $pressed-opacity={0.6}
          accessibilityRole="button"
          accessibilityLabel={t.components.volver}>
          <HStack
            space="xs"
            alignItems="center"
            px="$3"
            py="$1.5"
            borderRadius="$full"
            borderWidth={1}
            borderColor="$borderLight200"
            bg="$white">
            <Icon as={ArrowLeft} size="sm" color="$textLight700" />
            <Text fontSize={13} fontWeight="$bold" color="$textLight700">
              
              {t.components.volver}
            </Text>
          </HStack>
        </Pressable>
      ) : null}
    </HStack>
  );
}
