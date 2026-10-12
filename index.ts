import React, { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import { registerRootComponent } from 'expo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { aplicarPaleta } from './src/constants/coresSymbius';

// Handler de mensagens em background/app fechado — precisa ser registrado
// fora do React, antes do registerRootComponent. O Android já exibe a
// notificação sozinho a partir do payload `notification`; este handler só
// precisa existir pra o FCM processar corretamente (obrigatório pela lib).
if (Platform.OS !== 'web') {
  const { getMessaging, setBackgroundMessageHandler } = require('@react-native-firebase/messaging');
  setBackgroundMessageHandler(getMessaging(), async () => {});
}

// As telas leem a paleta dentro de StyleSheet.create quando o módulo carrega,
// então o tema salvo precisa ser aplicado ANTES de importar o App — por isso
// o App é carregado com require() só depois de ler a preferência.
function Raiz() {
  const [App, setApp] = useState<React.ComponentType | null>(null);

  useEffect(() => {
    AsyncStorage.getItem('cfg_modoEscuro')
      .catch(() => null)
      .then((valor) => {
        aplicarPaleta(valor === '1');
        setApp(() => require('./App').default);
      });
  }, []);

  if (!App) return React.createElement(View, { style: { flex: 1, backgroundColor: '#1F3D2B' } });
  return React.createElement(App);
}

registerRootComponent(Raiz);
