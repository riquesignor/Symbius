import 'react-native-gesture-handler';
import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db, auth } from './src/config/firebaseConfig';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

import Cadastro        from './src/screens/Cadastro';
import Login           from './src/screens/Login';
import Index           from './src/screens/Index';
import Perfil          from './src/screens/Perfil';
import PerfilPublico   from './src/screens/PerfilPublico';
import EditorPost      from './src/screens/EditorPost';
import AchadosPerdidos from './src/screens/AchadosPerdidos';
import Chat            from './src/screens/Chat';
import Homechat        from './src/screens/Homechat';
import RedefinirSenha  from './src/screens/RecuperarSenha';
import Calendario      from './src/screens/Calendario';
import Admin           from './src/screens/Admin';

const Stack = createStackNavigator();

export default function App() {
  const [initialRoute, setInitialRoute] = useState<string | null>(null);
  const [initialUid,   setInitialUid]   = useState<string | null>(null);

  useEffect(() => {
    // ✅ Verifica sessão salva no AsyncStorage
    const verificarSessao = async () => {
      try {
        const uid = await AsyncStorage.getItem('uid');
        if (uid) {
          const docSnap = await getDoc(doc(db, 'usuarios', uid));
          if (docSnap.exists() && docSnap.data().status === 1) {
            setInitialUid(uid);
            setInitialRoute(docSnap.data().tipo === 'Administrador' ? 'Admin' : 'Index');
            return;
          }
        }
      } catch (e) {
        console.log('Erro ao recuperar sessão:', e);
      }
      setInitialRoute('Login');
    };

    // ✅ Listener só para atualizar status 0 → 1 quando usuário clica no link do e-mail
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
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

  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName={initialRoute}
        screenOptions={{ headerShown: false }}
      >
        <Stack.Screen name="Login"           component={Login} />
        <Stack.Screen name="Cadastro"        component={Cadastro} />
        <Stack.Screen name="RedefinirSenha"  component={RedefinirSenha} />
        <Stack.Screen
          name="Index"
          component={Index}
          initialParams={initialUid ? { uid: initialUid } : undefined}
        />
        <Stack.Screen name="Perfil"          component={Perfil} />
        <Stack.Screen name="PerfilPublico"   component={PerfilPublico} />
        <Stack.Screen name="EditorPost"      component={EditorPost} />
        <Stack.Screen name="Chat"            component={Chat} />
        <Stack.Screen name="AchadosPerdidos" component={AchadosPerdidos} />
        <Stack.Screen name="Hall"            component={Homechat} />
        <Stack.Screen name="Calendario"      component={Calendario} />
        <Stack.Screen name="Admin"           component={Admin} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}