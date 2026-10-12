import { createNavigationContainerRef } from '@react-navigation/native';

export const navegacaoRef = createNavigationContainerRef<any>();

// Navega de fora das telas (toque em notificação, banner in-app). Se o
// NavigationContainer ainda não montou (app abrindo pelo toque), tenta de novo.
export const navegarGlobal = (rota: string, params?: any, tentativas = 20) => {
  if (navegacaoRef.isReady()) {
    navegacaoRef.navigate(rota, params);
    return;
  }
  if (tentativas > 0) setTimeout(() => navegarGlobal(rota, params, tentativas - 1), 250);
};
