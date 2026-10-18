import 'react-native-gesture-handler';
import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { doc, getDoc } from 'firebase/firestore';
import { db, auth } from './src/config/firebaseConfig';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppSettingsProvider } from './src/contexts/AppSettingsContext';
import { NotificacaoProvider } from './src/contexts/NotificacaoProvider';
import { navegacaoRef } from './src/navegacao';
import { CORES_SYMBIUS } from './src/constants/coresSymbius';

import {
  useFonts,
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
  Poppins_800ExtraBold,
} from '@expo-google-fonts/poppins';

import Boasvindas      from './src/screens/Boasvindas';
import EscolhaPapel    from './src/screens/EscolhaPapel';
import FeedResumos     from './src/screens/FeedResumos';
import Cadastro        from './src/screens/Cadastro';
import Login           from './src/screens/Login';
import Index           from './src/screens/Index';
import Perfil          from './src/screens/Perfil';
import EditorPost      from './src/screens/EditorPost';
import Chat            from './src/screens/Chat';
import GrupoChat       from './src/screens/GrupoChat';
import Calendario      from './src/screens/Calendario';
import Admin           from './src/screens/Admin';
import Match           from './src/screens/Match';
import Configuracoes   from './src/screens/Configuracoes';
import PerfilPublico   from 'src/screens/Perfilpublico';
import Contato         from 'src/screens/Contato';
import Ajuda           from 'src/screens/Ajuda';
import Leaderboard     from 'src/screens/Leaderboard';
import Loja            from './src/screens/Loja';

const Stack = createStackNavigator();

export default function App() {
  const [initialRoute, setInitialRoute] = useState<string | null>(null);
  const [initialUid,   setInitialUid]   = useState<string | null>(null);

  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
    Poppins_800ExtraBold,
  });

  useEffect(() => {
    const verificarSessao = async () => {
      try {
        const uid = await AsyncStorage.getItem('uid');
        if (uid) {
          // A sessão do app (uid salvo) só vale junto com a do Firebase Auth:
          // sem ela não há token pra chamar o backend de push e o Firestore
          // pode recusar escritas. Sessões antigas (de antes da persistência
          // do Auth) caem aqui e pedem login de novo uma única vez.
          await auth.authStateReady();
          const docSnap = auth.currentUser?.uid === uid ? await getDoc(doc(db, 'usuarios', uid)) : null;
          if (docSnap?.exists() && docSnap.data().status === 1) {
            setInitialUid(uid);
            setInitialRoute('Index');
            return;
          }
          await AsyncStorage.removeItem('uid');
          if (auth.currentUser) await auth.signOut();
        }
      } catch (e) {
        console.log('Erro ao recuperar sessão:', e);
      }
      setInitialRoute('Boasvindas');
    };
    verificarSessao();
  }, []);

  if (initialRoute === null || !fontsLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: CORES_SYMBIUS.fundo }}>
        <ActivityIndicator size="large" color={CORES_SYMBIUS.verdeEscuro} />
      </View>
    );
  }

  return (
    <AppSettingsProvider>
      <NotificacaoProvider>
        <NavigationContainer ref={navegacaoRef}>
          <Stack.Navigator
            initialRouteName={initialRoute}
            screenOptions={{ headerShown: false, cardStyle: { backgroundColor: CORES_SYMBIUS.fundo } }}
          >
            <Stack.Screen name="Boasvindas"     component={Boasvindas} />
            <Stack.Screen name="EscolhaPapel"   component={EscolhaPapel} />
            <Stack.Screen name="Login"           component={Login} />
            <Stack.Screen name="Cadastro"        component={Cadastro} />
            <Stack.Screen
              name="Index"
              component={Index}
              initialParams={initialUid ? { uid: initialUid } : undefined}
            />
            <Stack.Screen name="Perfil"          component={Perfil} />
            <Stack.Screen name="EditorPost"      component={EditorPost} />
            <Stack.Screen name="Chat"            component={Chat} />
            <Stack.Screen name="GrupoChat"       component={GrupoChat} />
            <Stack.Screen name="Calendario"      component={Calendario} />
            <Stack.Screen name="Admin"           component={Admin} />
            <Stack.Screen name="Match"           component={Match} />
            <Stack.Screen name="Configuracoes"   component={Configuracoes} />
            <Stack.Screen name="PerfilPublico"   component={PerfilPublico} />
            <Stack.Screen name="Contatos"        component={Contato}/>
            <Stack.Screen name="Ajuda"           component={Ajuda} />
            <Stack.Screen name="Leaderboard"     component={Leaderboard} />
            <Stack.Screen name="Loja"            component={Loja} />
            <Stack.Screen name="Resumos"         component={FeedResumos} />
          </Stack.Navigator>
        </NavigationContainer>
      </NotificacaoProvider>
    </AppSettingsProvider>
  );
}
