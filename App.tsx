import 'react-native-gesture-handler';
import React, { useState, useEffect, useRef } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db, auth } from './src/config/firebaseConfig';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppSettingsProvider } from './src/contexts/AppSettingsContext'; 
import * as Notifications from 'expo-notifications';


import {
  useFonts,
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
  Poppins_800ExtraBold,
} from '@expo-google-fonts/poppins';

import Cadastro        from './src/screens/Cadastro';
import Login           from './src/screens/Login';
import Index           from './src/screens/Index';
import Perfil          from './src/screens/Perfil';
import EditorPost      from './src/screens/EditorPost';
import Chat            from './src/screens/Chat';
import Calendario      from './src/screens/Calendario';
import Admin           from './src/screens/Admin';
import Match           from './src/screens/Match';
import Configuracoes   from './src/screens/Configuracoes';
import PerfilPublico   from 'src/screens/Perfilpublico';
import Contato         from 'src/screens/Contato';
import Ajuda           from 'src/screens/Ajuda';
import Leaderboard     from 'src/screens/Leaderboard';

const Stack = createStackNavigator();

// ✅ ADICIONAR: Setup de notificações
Notifications.setNotificationHandler({
  handleNotification: async () => {
    return {
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    } as any;
  },
});

export default function App() {
  const navigationRef = useRef(null);
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
  if (navigationRef && navigationRef.current) {
    (globalThis as any).navigationRef = navigationRef.current;
    console.log('✅ navigationRef setado global');
  }
}, [navigationRef]);

  useEffect(() => {
    const pedirPermissaoNotif = async () => {
      try {
        const { status } = await Notifications.requestPermissionsAsync();
        if (status !== 'granted') {
          console.log('⚠️ Permissão de notificações foi negada');
        }
      } catch (e) {
        console.log('Erro ao pedir permissão notif:', e);
      }
    };

    pedirPermissaoNotif();
  }, []);

  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      
      console.log('👆 User tocou notificação:', data);

      // Se for mensagem de chat, abrir a tela de chat
      if (data?.tipo === 'mensagem' && navigationRef.current) {
        (navigationRef.current as any).navigate('Chat', {
          outroUid: data.outroUid,
          outroNome: data.outroNome,
        });
      }
    });

    return () => subscription.remove();
  }, []);

  useEffect(() => {
    const verificarSessao = async () => {
      try {
        const uid = await AsyncStorage.getItem('uid');
        if (uid) {
          const docSnap = await getDoc(doc(db, 'usuarios', uid));
          if (docSnap.exists() && docSnap.data().status === 1) {
            setInitialUid(uid);
            setInitialRoute('Index');
            return;
          }
          await AsyncStorage.removeItem('uid');
        }
      } catch (e) {
        console.log('Erro ao recuperar sessão:', e);
      }
      setInitialRoute('Login');
    };

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) return;
      const uidSalvo = await AsyncStorage.getItem('uid');
      if (uidSalvo) return;

      try {
        await user.reload();
        if (user.emailVerified) {
          const docRef  = doc(db, 'usuarios', user.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists() && docSnap.data().status === 0) {
            await updateDoc(docRef, { status: 1 });
          }
        }
      } catch (err) {
        console.log('Erro ao verificar status:', err);
      } finally {
        const aindaSemSessao = !(await AsyncStorage.getItem('uid'));
        if (aindaSemSessao) {
          await signOut(auth);
        }
      }
    });

    verificarSessao();
    return unsubscribe;
  }, []);

  if (initialRoute === null) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFF' }}>
        <ActivityIndicator size="large" color="#E91E63" />
      </View>
    );
  }

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFF' }}>
        <ActivityIndicator size="large" color="#E91E63" />
      </View>
    );
  }

  return (
    <AppSettingsProvider>
      <NavigationContainer ref={navigationRef}>
        <Stack.Navigator
          initialRouteName={initialRoute}
          screenOptions={{ headerShown: false }}
        >
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
          <Stack.Screen name="Calendario"      component={Calendario} />
          <Stack.Screen name="Admin"           component={Admin} />
          <Stack.Screen name="Match"           component={Match} />
          <Stack.Screen name="Configuracoes"   component={Configuracoes} />
          <Stack.Screen name="PerfilPublico"   component={PerfilPublico} />
          <Stack.Screen name="Contatos"        component={Contato}/>
          <Stack.Screen name="Ajuda"           component={Ajuda} />
          <Stack.Screen name="Leaderboard" component={Leaderboard} options={{ headerShown: false }} />
        </Stack.Navigator>
      </NavigationContainer>
    </AppSettingsProvider>
  );
}