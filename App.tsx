import 'react-native-gesture-handler';
import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, Platform } from 'react-native';
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

import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';

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
import TesteNivelUp    from './src/screens/TesteNivelUp';

import comEntradaAnimada from './src/components/comEntradaAnimada';

const Stack = createStackNavigator();

// Mesma animação de entrada do Perfil nas demais telas (Perfil, Perfil público,
// Admin, Calendário e Configurações já têm a sua própria).
const BoasvindasA   = comEntradaAnimada(Boasvindas);
const EscolhaPapelA = comEntradaAnimada(EscolhaPapel);
const LoginA        = comEntradaAnimada(Login);
const CadastroA     = comEntradaAnimada(Cadastro);
const IndexA        = comEntradaAnimada(Index);
const EditorPostA   = comEntradaAnimada(EditorPost);
const ChatA         = comEntradaAnimada(Chat);
const GrupoChatA    = comEntradaAnimada(GrupoChat);
const MatchA        = comEntradaAnimada(Match);
const ContatoA      = comEntradaAnimada(Contato);
const AjudaA        = comEntradaAnimada(Ajuda);
const LeaderboardA  = comEntradaAnimada(Leaderboard);
const LojaA         = comEntradaAnimada(Loja);
const TesteNivelUpA = comEntradaAnimada(TesteNivelUp);
const FeedResumosA  = comEntradaAnimada(FeedResumos);

export default function App() {
  const [initialRoute, setInitialRoute] = useState<string | null>(null);
  const [initialUid,   setInitialUid]   = useState<string | null>(null);

  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
    Poppins_800ExtraBold,
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
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
            screenOptions={{ headerShown: false, cardStyle: { backgroundColor: CORES_SYMBIUS.fundo, ...(Platform.OS === 'web' ? ({ height: '100vh' } as any) : {}) } }}
          >
            <Stack.Screen name="Boasvindas"     component={BoasvindasA} />
            <Stack.Screen name="EscolhaPapel"   component={EscolhaPapelA} />
            <Stack.Screen name="Login"           component={LoginA} />
            <Stack.Screen name="Cadastro"        component={CadastroA} />
            <Stack.Screen
              name="Index"
              component={IndexA}
              initialParams={initialUid ? { uid: initialUid } : undefined}
            />
            <Stack.Screen name="Perfil"          component={Perfil} />
            <Stack.Screen name="EditorPost"      component={EditorPostA} />
            <Stack.Screen name="Chat"            component={ChatA} />
            <Stack.Screen name="GrupoChat"       component={GrupoChatA} />
            <Stack.Screen name="Calendario"      component={Calendario} />
            <Stack.Screen name="Admin"           component={Admin} />
            <Stack.Screen name="Match"           component={MatchA} />
            <Stack.Screen name="Configuracoes"   component={Configuracoes} />
            <Stack.Screen name="PerfilPublico"   component={PerfilPublico} />
            <Stack.Screen name="Contatos"        component={ContatoA}/>
            <Stack.Screen name="Ajuda"           component={AjudaA} />
            <Stack.Screen name="Leaderboard"     component={LeaderboardA} />
            <Stack.Screen name="Loja"            component={LojaA} />
            <Stack.Screen name="TesteNivelUp"    component={TesteNivelUpA} />
            <Stack.Screen name="Resumos"         component={FeedResumosA} />
          </Stack.Navigator>
        </NavigationContainer>
      </NotificacaoProvider>
    </AppSettingsProvider>
  );
}
