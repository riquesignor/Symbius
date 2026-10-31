import React, { useEffect, useRef } from 'react';
import { Animated } from 'react-native';

// Mesma entrada do Perfil (fade + subida de 10px em 450ms), aplicada à tela
// inteira. Usado em App.tsx para as telas que não têm animação própria.
export default function comEntradaAnimada<P extends object>(Tela: React.ComponentType<P>) {
  const Animada = (props: P) => {
    const anim = useRef(new Animated.Value(0)).current;
    useEffect(() => {
      Animated.timing(anim, { toValue: 1, duration: 450, useNativeDriver: true }).start();
    }, []);
    return (
      <Animated.View
        style={{
          flex: 1,
          opacity: anim,
          transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
        }}
      >
        <Tela {...props} />
      </Animated.View>
    );
  };
  Animada.displayName = `ComEntrada(${Tela.displayName || Tela.name || 'Tela'})`;
  return Animada;
}
