import { Alert, Platform } from 'react-native';

// Alert.alert com botões não faz nada no navegador (react-native-web); nele usa
// o confirm() do próprio navegador. No celular abre o alerta nativo.
export const confirmar = (titulo: string, mensagem: string, textoOk = 'Confirmar', destrutivo = false): Promise<boolean> =>
  new Promise((resolve) => {
    if (Platform.OS === 'web') {
      resolve(typeof window !== 'undefined' && window.confirm(mensagem ? `${titulo}\n${mensagem}` : titulo));
      return;
    }
    Alert.alert(titulo, mensagem, [
      { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
      { text: textoOk, style: destrutivo ? 'destructive' : 'default', onPress: () => resolve(true) },
    ], { cancelable: true, onDismiss: () => resolve(false) });
  });
