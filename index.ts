import React, { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import { registerRootComponent } from 'expo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { aplicarPaleta } from './src/constants/coresSymbius';
import TransicaoTema, {
  CHAVE_TRANSICAO, FUNDO_ESCURO, FUNDO_CLARO, EstadoInicial, lerEstadoWeb, prepararTransicao,
} from './src/components/TransicaoTema';

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
  // Na web o estado do reinício de tema já é conhecido no primeiro quadro (localStorage)
  const [inicial, setInicial] = useState<EstadoInicial | null>(() => {
    const w = lerEstadoWeb();
    if (w) prepararTransicao(w);
    return w;
  });

  useEffect(() => {
    Promise.all([AsyncStorage.getItem('cfg_modoEscuro'), AsyncStorage.getItem(CHAVE_TRANSICAO)])
      .catch(() => [null, null] as (string | null)[])
      .then(([valor, flag]) => {
        const escuro = valor === '1';
        aplicarPaleta(escuro);
        const estado = { pendente: flag === '1', escuro };
        prepararTransicao(estado);
        setInicial(estado);
        setApp(() => require('./App').default);
      });
  }, []);

  // Reabrindo depois de trocar o tema: a espera já é na cor do tema novo (nada de piscar verde)
  const corBase = inicial?.pendente ? (inicial.escuro ? FUNDO_ESCURO : FUNDO_CLARO) : '#1F3D2B';

  // A onda da troca de tema fica acima do App, então sobrevive ao reinício e se dissolve quando ele monta
  return React.createElement(
    View,
    { style: { flex: 1, backgroundColor: corBase } },
    App ? React.createElement(App) : null,
    inicial ? React.createElement(TransicaoTema, { pronto: !!App, inicial }) : null,
  );
}

registerRootComponent(Raiz);
