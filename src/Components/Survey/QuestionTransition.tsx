import React, { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';

/* -------------------------------------------------------------------------- */
/*  QuestionTransition — entrada animada de la tarjeta de pregunta (desliza    */
/*  desde el lado de avance y funde). Re-móntese con `key={indice}` para que   */
/*  cada cambio de pregunta dispare la animación:                              */
/*                                                                             */
/*    <QuestionTransition key={qIndex} direction={dir}>…</QuestionTransition>  */
/* -------------------------------------------------------------------------- */

interface Props {
  /** 1 = avanza (entra desde la derecha) · -1 = retrocede (desde la izquierda). */
  direction?: 1 | -1;
  children: React.ReactNode;
}

export default function QuestionTransition({ direction = 1, children }: Props) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [anim]);

  return (
    <Animated.View
      style={{
        opacity: anim,
        transform: [{ translateX: anim.interpolate({ inputRange: [0, 1], outputRange: [36 * direction, 0] }) }],
      }}>
      {children}
    </Animated.View>
  );
}
