import { createNavigationContainerRef } from '@react-navigation/native';

export const navegacaoRef = createNavigationContainerRef<any>();

// No React Navigation 7, navigate() EMPILHA a mesma tela de novo em vez de
// voltar pra ela. Trocar de aba várias vezes enchia a pilha e o botão de voltar
// ficava passando por telas repetidas ("travado"). Com pop:true volta pra tela
// que já existe na pilha (ou empilha se ainda não existe).
export const irParaAba = (navigation: any, destino: string, params?: any) =>
  navigation.navigate({ name: destino, params, pop: true });

// Seta de voltar das telas: volta se der; se a tela foi aberta direto
// (notificação, link) cai na Home em vez de não fazer nada.
export const voltar = (navigation: any) => {
  if (navigation.canGoBack()) navigation.goBack();
  else navigation.navigate({ name: 'Index', pop: true });
};

const ROTAS_DE_ABA = ['Index', 'Calendario', 'Match', 'Resumos', 'Perfil', 'Admin', 'Leaderboard', 'Loja'];

// Navega de fora das telas (toque em notificação, banner in-app). Se o
// NavigationContainer ainda não montou (app abrindo pelo toque), tenta de novo.
export const navegarGlobal = (rota: string, params?: any, tentativas = 20) => {
  if (navegacaoRef.isReady()) {
    (navegacaoRef as any).navigate({ name: rota, params, pop: ROTAS_DE_ABA.includes(rota) });
    return;
  }
  if (tentativas > 0) setTimeout(() => navegarGlobal(rota, params, tentativas - 1), 250);
};
