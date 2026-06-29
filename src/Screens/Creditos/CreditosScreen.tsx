import React from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Box, Center, HStack, Icon, VStack } from '@gluestack-ui/themed';
import { ArrowRight, Mic } from 'lucide-react-native';

import { Button, Content, Text } from '@/Components/Common';
import RadialBackground from '@/Components/Themed/RadialBackground';
import { RootStackParamList } from '@/Navigators';

/* -------------------------------------------------------------------------- */
/*  CreditosScreen — splash/about screen "Quisqueya Habla" (mockup            */
/*  `Créditos Quisqueya Habla.dc.html`). Pantalla de presentación del         */
/*  proyecto; el CTA "Comenzar" continúa al registro profesional.             */
/* -------------------------------------------------------------------------- */

type Props = NativeStackScreenProps<RootStackParamList, 'Creditos'>;

const YEAR = new Date().getFullYear();

export default function CreditosScreen({ navigation }: Props) {
  return (
    <Content
      padding={false}
      insetTop={false}
      radialBackgrounds={
        <>
          <RadialBackground topMultiplier={0.12} leftMultiplier={-0.2} widthMultiplier={2} heightMultiplier={2} center={(w, _h) => [w, w]} radiusMultiplier={1} />
          <RadialBackground topMultiplier={-0.95} leftMultiplier={-0.8} widthMultiplier={2} heightMultiplier={2} center={(w, _h) => [w, w]} radiusMultiplier={1} />
        </>
      }>
      <VStack flex={1} px="$6" justifyContent="space-between">
        {/* ----- top badge ----- */}
        <Center mt="$10">
          <HStack alignItems="center" space="xs" bg="$white" px="$3" py="$1.5" borderRadius="$full" borderWidth={1} borderColor="$borderLight100">
            <Box w={6} h={6} borderRadius="$full" bg="$primary500" />
            <Text size="2xs" weight="bold" color="$textLight600" style={{ letterSpacing: 0.4 }}>
              VIA+ · EVALUACIÓN DE AUDICIÓN Y LENGUAJE
            </Text>
          </HStack>
        </Center>

        {/* ----- emblem + headline ----- */}
        <VStack alignItems="center" space="md" mt="$8">
          <Center
            w={92}
            h={92}
            borderRadius={26}
            bg="$primary500"
            style={{ shadowColor: '#FF7F00', shadowOpacity: 0.35, shadowRadius: 18, shadowOffset: { width: 0, height: 8 } }}>
            <Icon as={Mic} size="xl" color="$white" />
          </Center>
          <Text size="2xs" weight="bold" color="$textLight400" style={{ letterSpacing: 1.2 }}>
            PROYECTO
          </Text>
          <VStack alignItems="center">
            <Text size="3xl" weight="bold" color="$textLight900" style={{ textAlign: 'center' }}>
              Quisqueya{' '}
              <Text size="3xl" weight="bold" color="$primary500">
                Habla
              </Text>
            </Text>
            <Text size="sm" color="$textLight500" mt="$2" style={{ textAlign: 'center', lineHeight: 19, maxWidth: 280 }}>
              Tecnología clínica al servicio de la rehabilitación del lenguaje.
            </Text>
          </VStack>
        </VStack>

        {/* ----- author + partners ----- */}
        <VStack space="md" mt="$8">
          <HStack alignItems="center" space="sm">
            <Box style={{ flex: 1, height: 1 }} bg="$borderLight100" />
            <Text size="2xs" weight="bold" color="$textLight400" style={{ letterSpacing: 0.6 }}>
              DESARROLLADO POR
            </Text>
            <Box style={{ flex: 1, height: 1 }} bg="$borderLight100" />
          </HStack>

          <HStack space="sm" alignItems="center" bg="$white" p="$3.5" borderRadius={16} borderWidth={1} borderColor="$borderLight100">
            <Center w={44} h={44} borderRadius={14} bg="$textLight900">
              <Text size="sm" weight="bold" color="$white">
                FB
              </Text>
            </Center>
            <VStack style={{ flex: 1 }}>
              <Text size="sm" weight="bold" color="$textLight900">
                Dr. Frank Betances
              </Text>
              <Text size="2xs" color="$textLight500">
                Dirección clínica e investigación
              </Text>
            </VStack>
          </HStack>

          <Text size="2xs" weight="bold" color="$textLight400" style={{ letterSpacing: 0.6 }}>
            EN COLABORACIÓN CON
          </Text>
          <HStack space="sm">
            <HStack space="sm" alignItems="center" bg="$white" p="$3" borderRadius={14} borderWidth={1} borderColor="$borderLight100" style={{ flex: 1 }}>
              <Center w={32} h={32} borderRadius={10} bg="$success600">
                <Text size="xs" weight="bold" color="$white">
                  E
                </Text>
              </Center>
              <VStack style={{ flex: 1 }}>
                <Text size="xs" weight="bold" color="$textLight900">
                  Earlify Health
                </Text>
                <Text size="2xs" color="$textLight500">
                  Tecnología e ingeniería
                </Text>
              </VStack>
            </HStack>
            <HStack space="sm" alignItems="center" bg="$white" p="$3" borderRadius={14} borderWidth={1} borderColor="$borderLight100" style={{ flex: 1 }}>
              <Center w={32} h={32} borderRadius={10} bg="$info600">
                <Text size="xs" weight="bold" color="$white">
                  A
                </Text>
              </Center>
              <VStack style={{ flex: 1 }}>
                <Text size="xs" weight="bold" color="$textLight900">
                  ACOPROS
                </Text>
                <Text size="2xs" color="$textLight500">
                  Apoyo y alianza institucional
                </Text>
              </VStack>
            </HStack>
          </HStack>
        </VStack>

        {/* ----- CTA ----- */}
        <VStack space="sm" mb="$8" mt="$8">
          <Button action="primary" variant="solid" rounded="$full" onPress={() => navigation.navigate('RegistroProfesional')}>
            <HStack space="sm" alignItems="center">
              <Text size="md" weight="bold" color="$white">
                Comenzar
              </Text>
              <Icon as={ArrowRight} size="sm" color="$white" />
            </HStack>
          </Button>
          <Text size="2xs" color="$textLight400" style={{ textAlign: 'center' }}>
            Lugo, Galicia, España · {YEAR}
          </Text>
        </VStack>
      </VStack>
    </Content>
  );
}
