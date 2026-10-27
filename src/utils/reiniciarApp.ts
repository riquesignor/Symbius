import { DevSettings, Platform } from 'react-native';
import * as Updates from 'expo-updates';

// Recarrega o JS do zero (usado ao trocar o tema: as cores são lidas pelos
// StyleSheet das telas só quando os módulos carregam). Em build de produção
// o expo-updates recria o contexto do React mesmo com updates desabilitado;
// em desenvolvimento o expo-updates recusa, então cai no DevSettings.
export const reiniciarApp = async () => {
  if (Platform.OS === 'web') {
    window.location.reload();
    return;
  }
  if (__DEV__) {
    DevSettings.reload();
    return;
  }
  try {
    await Updates.reloadAsync();
  } catch (e) {
    console.log('Falha ao reiniciar o app:', e);
  }
};
