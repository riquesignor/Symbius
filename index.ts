import { registerRootComponent } from 'expo';
import { getMessaging, setBackgroundMessageHandler, type RemoteMessage } from '@react-native-firebase/messaging';

import App from './App';

// Handler de mensagens em background/app fechado — precisa ser registrado
// fora do React, antes do registerRootComponent. O Android já exibe a
// notificação sozinho a partir do payload `notification`; este handler só
// precisa existir pra o FCM processar corretamente (obrigatório pela lib).
setBackgroundMessageHandler(getMessaging(), async (mensagem: RemoteMessage) => {
  console.log('📩 Mensagem recebida em background:', mensagem.messageId);
});

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
