import 'react-native-gesture-handler';
import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db, auth } from './src/config/firebaseConfig';
// IMPORTANTE: Adicionei o signOut aqui em baixo!
import { onAuthStateChanged, signOut } from 'firebase/auth'; 

// TELAS
import Cadastro from './src/screens/Cadastro';
import Login from './src/screens/Login';
import Index from './src/screens/Index';
import Perfil from './src/screens/Perfil';
import BuscarUsuarios from './src/screens/BuscarUsuarios';
import PerfilPublico from './src/screens/PerfilPublico';
import EditorPost from './src/screens/EditorPost';
import Chat from 'src/screens/Chat';
import HallChat from 'src/screens/HallChat';

const Stack = createStackNavigator();

export default function App() {
  const [estaLogado, setEstaLogado] = useState<boolean | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          // 1. Força atualização do token pra ver se o e-mail verificou de fato
          await user.reload();

          // 👇 AQUI TAVA O B.O.! Mudamos de "cadastro" para "usuarios"
          const docRef = doc(db, "usuarios", user.uid);
          const docSnap = await getDoc(docRef);

          if (docSnap.exists()) {
            const userData = docSnap.data();

            // 2. LÓGICA DE STATUS:
            // Se verificou o e-mail agora e ainda estava como status 0, sobe pra 1
            if (user.emailVerified && userData.status === 0) {
              await updateDoc(docRef, { status: 1 });
              setEstaLogado(true);
            } 
            // Se o status já for 1 (Ativo), entra direto
            else if (userData.status === 1) {
              setEstaLogado(true);
            } 
            // Se status for 0 (pendente) ou 2 (suspenso), barra o login E DESLOGA
            else {
              await signOut(auth); // Tira o cara do limbo do Auth
              setEstaLogado(false);
            }
          } else {
            // Se o documento nem existir no banco (ex: vc apagou o doc na mão) E DESLOGA
            await signOut(auth); 
            setEstaLogado(false);
          }
        } catch (err) {
          console.log("Erro ao validar acesso:", err);
          await signOut(auth);
          setEstaLogado(false);
        }
      } else {
        // Sem usuário no Firebase Auth
        setEstaLogado(false);
      }
    });

    return unsubscribe;
  }, []);

  // Tela de carregamento enquanto o Firebase decide a vida do usuário
  if (estaLogado === null) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFF' }}>
        <ActivityIndicator size="large" color="#E91E63" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {estaLogado ? (
          // ROTAS PARA USUÁRIOS ATIVOS (STATUS 1)
          <>
            <Stack.Screen name="Index" component={Index} />
            <Stack.Screen name="Perfil" component={Perfil} />
            <Stack.Screen name="BuscarUsuarios" component={BuscarUsuarios} />
            <Stack.Screen name="PerfilPublico" component={PerfilPublico} />
            <Stack.Screen name="EditorPost" component={EditorPost} />
            <Stack.Screen name="Chat" component={Chat}/>
            <Stack.Screen name="Hall" component={HallChat} />
          </>
        ) : (
          <>
            <Stack.Screen name="Login" component={Login} />
            <Stack.Screen name="Cadastro" component={Cadastro} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}