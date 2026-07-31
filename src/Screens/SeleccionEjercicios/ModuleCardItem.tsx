import React, { useEffect } from 'react';
import { Pressable, View } from 'react-native';
import { Box, Center, HStack, VStack } from '@gluestack-ui/themed';
import type { LucideIcon } from 'lucide-react-native';
import Animated, {
  FadeInDown,
  ZoomIn,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { Text } from '@/Components/Common';
import ModuleIllustration from './ModuleIllustration';

/* -------------------------------------------------------------------------- */
/*  ModuleCardItem — tarjeta de módulo clínico.                                */
/*                                                                             */
/*  REDISEÑO: la versión anterior era una rejilla de dos columnas con una      */
/*  cabecera ilustrada de 96 px por tarjeta. Con nueve módulos eso dejaba una  */
/*  huérfana en la última fila, recortaba los títulos largos a dos líneas      */
/*  apretadas, obligaba a resumir la descripción en una frase telegráfica y    */
/*  dedicaba más superficie al dibujo que al contenido: parecía un menú de     */
/*  juegos, no el índice de una batería de exploración.                         */
/*                                                                             */
/*  Ahora es una FILA a ancho completo con jerarquía tipográfica explícita:    */
/*   · raíl de acento a la izquierda — identifica el dominio sin teñir la      */
/*     tarjeta entera;                                                          */
/*   · icono sobre azulejo tintado, tamaño fijo, alineado con la primera línea; */
/*   · título en un solo renglón de lectura + descripción completa;             */
/*   · metadatos (dominio · duración · edades) en una línea sobria de texto     */
/*     con separadores, en lugar de tres chips de colores;                      */
/*   · la escena SVG del módulo pasa a MARCA DE AGUA a la derecha, muy tenue:  */
/*     conserva la identidad visual sin competir con el texto;                  */
/*   · selección = borde de acento + índice de orden en la batería.            */
/*                                                                             */
/*  Movimiento (reanimated, todo en el hilo de UI): entrada escalonada, escala */
/*  de feedback al pulsar y realce contenido al seleccionar. Se retiran el     */
/*  zoom y la báscula del medallón, que en una lista clínica sobran.            */
/* -------------------------------------------------------------------------- */

export interface ModuleCardData {
  id: string;
  title: string;
  description: string;
  duration: string;
  ages: string;
  icon: LucideIcon;
  tag: string; // etiqueta corta de dominio clínico
  color: string; // acento (raíl/azulejo/borde/badge)
  soft: string; // fondo suave del azulejo y de la marca de agua
}

interface Props {
  module: ModuleCardData;
  /** Índice de la tarjeta en la lista; escalona la animación de entrada. */
  index: number;
  /** Posición 1-based dentro de la selección (null = no seleccionada). */
  order: number | null;
  onToggle: (id: string) => void;
}

const SPRING = { damping: 14, stiffness: 180 };

/** Gris de los metadatos: contraste suficiente sobre blanco sin pesar. */
const META_COLOR = '#8A8577';
const HAIRLINE = '#EDE9E1';

export default function ModuleCardItem({ module: m, index, order, onToggle }: Props) {
  const isSelected = order !== null;
  const IconGlyph = m.icon;

  const pressed = useSharedValue(0);
  const sel = useSharedValue(isSelected ? 1 : 0);

  useEffect(() => {
    sel.value = withSpring(isSelected ? 1 : 0, SPRING);
  }, [isSelected, sel]);

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - 0.015 * pressed.value }],
    shadowOpacity: interpolate(sel.value, [0, 1], [0.04, 0.14]),
  }));

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 45)
        .springify()
        .damping(16)
        .stiffness(150)}>
      <Pressable
        onPress={() => onToggle(m.id)}
        onPressIn={() => {
          pressed.value = withSpring(1, SPRING);
        }}
        onPressOut={() => {
          pressed.value = withSpring(0, SPRING);
        }}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: isSelected }}
        accessibilityLabel={`${m.title}. ${m.description} Duración ${m.duration}. Edades ${m.ages}.`}>
        <Animated.View
          style={[
            {
              borderRadius: 16,
              backgroundColor: '#FFFFFF',
              borderWidth: 1.5,
              borderColor: isSelected ? m.color : HAIRLINE,
              overflow: 'hidden',
              shadowColor: isSelected ? m.color : '#000000',
              shadowRadius: 10,
              shadowOffset: { width: 0, height: 4 },
              elevation: isSelected ? 4 : 1,
            },
            cardStyle,
          ]}>
          {/* Marca de agua: la escena del módulo, recortada a la derecha. Muy
              tenue y estrecha a propósito — una descripción de dos líneas llega
              hasta aquí, y la ilustración no puede competir con el texto. */}
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              right: 0,
              top: 0,
              bottom: 0,
              width: 130,
              opacity: isSelected ? 0.34 : 0.22,
            }}>
            <ModuleIllustration moduleId={m.id} color={m.color} />
          </View>

          <HStack>
            {/* raíl de acento del dominio clínico */}
            <Box w={5} style={{ backgroundColor: isSelected ? m.color : m.soft }} />

            <HStack style={{ flex: 1, gap: 12 }} p="$3.5" alignItems="flex-start">
              {/* azulejo con el icono */}
              <Center
                w={44}
                h={44}
                borderRadius={12}
                style={{ backgroundColor: isSelected ? m.color : m.soft }}>
                <IconGlyph size={22} color={isSelected ? '#FFFFFF' : m.color} strokeWidth={2.2} />
              </Center>

              <VStack style={{ flex: 1 }} space="xs">
                <Text size="sm" weight="bold" color="$textLight900" style={{ lineHeight: 19 }}>
                  {m.title}
                </Text>
                <Text size="2xs" color="$textLight500" style={{ lineHeight: 16 }}>
                  {m.description}
                </Text>

                {/* metadatos en una línea sobria, con separadores */}
                <HStack alignItems="center" style={{ gap: 6, flexWrap: 'wrap' }} mt="$0.5">
                  <Text
                    size="2xs"
                    weight="bold"
                    style={{ color: m.color, letterSpacing: 0.7, fontSize: 9 }}>
                    {m.tag}
                  </Text>
                  <Text size="2xs" style={{ color: HAIRLINE, fontSize: 9 }}>
                    ●
                  </Text>
                  <Text
                    size="2xs"
                    weight="semiBold"
                    style={{ color: META_COLOR, fontSize: 10, fontVariant: ['tabular-nums'] }}>
                    {m.duration}
                  </Text>
                  <Text size="2xs" style={{ color: HAIRLINE, fontSize: 9 }}>
                    ●
                  </Text>
                  <Text size="2xs" weight="semiBold" style={{ color: META_COLOR, fontSize: 10 }}>
                    {m.ages}
                  </Text>
                </HStack>
              </VStack>

              {/* selección: casilla con el ORDEN dentro de la batería */}
              <Center
                w={28}
                h={28}
                borderRadius={9}
                borderWidth={isSelected ? 0 : 1.5}
                borderColor="$borderLight300"
                style={{ backgroundColor: isSelected ? m.color : '#FFFFFF', marginTop: 8 }}>
                {isSelected ? (
                  <Animated.View entering={ZoomIn.springify().damping(12).stiffness(220)}>
                    {/* el número ES el orden de ejecución de la batería, así que
                        se muestra siempre (también con una sola prueba) */}
                    <Text
                      size="2xs"
                      weight="bold"
                      color="$white"
                      style={{ fontVariant: ['tabular-nums'] }}>
                      {order}
                    </Text>
                  </Animated.View>
                ) : null}
              </Center>
            </HStack>
          </HStack>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}
