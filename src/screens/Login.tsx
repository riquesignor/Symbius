import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, Text, View, TextInput, TouchableOpacity, 
  SafeAreaView, ScrollView, KeyboardAvoidingView, 
  Platform, ActivityIndicator, Dimensions
} from 'react-native';
import { db, auth } from '../config/firebaseConfig';
import { signOut } from 'firebase/auth';
import { collection, query, where, getDocs, updateDoc } from 'firebase/firestore';
import { AntDesign, MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage'; 

const { width } = Dimensions.get('window');

const CORES = {
  azulEscuro: '#1A1A2E',
  rosa: '#E91E63',
  amarelo: '#FFC107',
  fundo: '#FAFAFA',
  inputBg: '#F0F4F8',
  textoDestaque: '#1A1A2E',
  textoSecundario: '#8D99AE'
};

export default function Login({ navigation }: any) {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [loading, setLoading] = useState(false);
  const [msgAviso, setMsgAviso] = useState('');
  const [secureText, setSecureText] = useState(true);

  useEffect(() => {
    if (msgAviso !== '') {
      const timer = setTimeout(() => setMsgAviso(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [msgAviso]);

 const handleLogin = async () => {
  if (!email || !senha) {
    setMsgAviso('Preencha e-mail e senha!');
    return;
  }

  setLoading(true);
  try {
    const usuariosRef = collection(db, 'usuarios');
    const q = query(usuariosRef, where('email_escolar', '==', email.trim().toLowerCase()));
    const querySnap = await getDocs(q);

    if (querySnap.empty) {
      setMsgAviso('Usuário não encontrado.');
      setLoading(false);
      return;
    }

    const userDoc = querySnap.docs[0];
    const userData = userDoc.data();

    if (userData.senha !== senha) {
      setMsgAviso('E-mail ou senha incorretos.');
      setLoading(false);
      return;
    }

    if (userData.status === 2) {
      setMsgAviso('🚫 Conta desativada, entre em contato com a coordenação.');
      setLoading(false);
      return;
    }

    // ✅ Se ainda está pendente, tenta sincronizar com o Firebase Auth
    if (userData.status === 0) {
      try {
        // Faz login temporário no Auth só pra checar o emailVerified
        const { signInWithEmailAndPassword } = await import('firebase/auth');
        const credential = await signInWithEmailAndPassword(auth, email.trim(), userData.senhaAuth || senha);
        await credential.user.reload();

        if (credential.user.emailVerified) {
          // ✅ Clicou no link → atualiza status no Firestore
          await updateDoc(userDoc.ref, { status: 1 });
          await signOut(auth);
        } else {
          await signOut(auth);
          setMsgAviso('⚠️ Aprove seu e-mail para entrar.');
          setLoading(false);
          return;
        }
      } catch (authErr) {
        // Se o Auth falhar (senha diferente), verifica só pelo Firestore
        setMsgAviso('⚠️ Aprove seu e-mail para entrar.');
        setLoading(false);
        return;
      }
    }
    
    const uid = userDoc.id;
    await AsyncStorage.setItem('uid', uid);
    // status === 1 → entra
    navigation.reset({
        index: 0,
        routes: [{ 
        name: userData.tipo === 'Administrador' ? 'Admin' : 'Index',
        params: { uid }
        }],
    });

  } catch (err: any) {
    console.log('Erro no login Firestore:', err);
    setMsgAviso('Erro ao conectar. Tente novamente.');
  } finally {
    setLoading(false);
  }
};
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.blobTopRight} />
      <View style={styles.blobBottomLeft} />

      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "height"} 
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          
          {msgAviso !== '' && (
            <View style={styles.toastAviso}>
              <Text style={styles.toastText}>{msgAviso}</Text>
            </View>
          )}

          <View style={styles.content}>
            
            <View style={styles.logoContainer}>
              <View style={styles.yellowDot} />
              <Text style={styles.logoText}>
                JUM<Text style={{color: CORES.rosa}}>O</Text>
              </Text>
            </View>

            <View style={styles.headerTextContainer}>
              <Text style={styles.title}>Bem-vindo de volta!</Text>
              <Text style={styles.subtitle}>Acesse para ver as novidades do Anchieta</Text>
            </View>

            <View style={styles.inputWrapper}>
              <MaterialIcons name="email" size={20} color={CORES.textoSecundario} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="E-mail acadêmico"
                placeholderTextColor={CORES.textoSecundario}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </View>

            <View style={styles.inputWrapper}>
              <MaterialIcons name="lock" size={20} color={CORES.textoSecundario} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Senha"
                placeholderTextColor={CORES.textoSecundario}
                value={senha}
                onChangeText={setSenha}
                secureTextEntry={secureText}
              />
              <TouchableOpacity onPress={() => setSecureText(!secureText)} style={styles.eyeIcon}>
                <MaterialIcons 
                  name={secureText ? "visibility-off" : "visibility"} 
                  size={20} 
                  color={CORES.rosa} 
                />
              </TouchableOpacity>
            </View>

            <TouchableOpacity 
              style={styles.forgotPassword} 
              onPress={() => navigation.navigate('RedefinirSenha')}
            >
              <Text style={styles.forgotPasswordText}>Esqueceu a senha?</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.primaryButton, (!email || !senha) && styles.primaryButtonDisabled]} 
              onPress={handleLogin}
              disabled={loading || !email || !senha}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.primaryButtonText}>Avançar</Text>
              )}
            </TouchableOpacity>

            <View style={styles.dividerContainer}>
              <View style={styles.line} />
              <Text style={styles.dividerText}>ou</Text>
              <View style={styles.line} />
            </View>

            <TouchableOpacity style={styles.googleButton}>
              <AntDesign name="google" size={20} color={CORES.azulEscuro} style={styles.socialIcon} />
              <Text style={styles.googleButtonText}>Continuar com Google</Text>
            </TouchableOpacity>

            <View style={styles.footer}>
              <Text style={styles.footerText}>Ainda não tem acesso? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Cadastro')}>
                <Text style={styles.linkText}>Inscreva-se</Text>
              </TouchableOpacity>
            </View>

          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: CORES.fundo },
  blobTopRight: {
    position: 'absolute', top: -50, right: -50,
    width: 200, height: 200, borderRadius: 100,
    backgroundColor: 'rgba(233, 30, 99, 0.08)',
  },
  blobBottomLeft: {
    position: 'absolute', bottom: -30, left: -80,
    width: 250, height: 250, borderRadius: 125,
    backgroundColor: 'rgba(255, 193, 7, 0.1)',
  },
  scrollContent: { flexGrow: 1, justifyContent: 'center', paddingVertical: 20 },
  toastAviso: {
    position: 'absolute', top: 20, alignSelf: 'center',
    backgroundColor: CORES.rosa, paddingVertical: 12,
    paddingHorizontal: 25, borderRadius: 25, zIndex: 999,
    elevation: 5, shadowColor: '#000', shadowOpacity: 0.2,
    shadowRadius: 5, shadowOffset: { width: 0, height: 2 },
  },
  toastText: { color: '#FFF', fontWeight: 'bold', fontSize: 14 },
  content: { paddingHorizontal: 35, alignItems: 'center' },
  logoContainer: {
    position: 'relative', marginBottom: 30,
    flexDirection: 'row', alignItems: 'center',
  },
  yellowDot: {
    position: 'absolute', top: 4, left: -6,
    width: 10, height: 10, backgroundColor: CORES.amarelo,
    borderRadius: 5, zIndex: 10,
  },
  logoText: { fontSize: 50, fontWeight: '900', color: CORES.azulEscuro, letterSpacing: -1 },
  headerTextContainer: { alignItems: 'center', marginBottom: 35 },
  title: { fontSize: 26, fontWeight: '800', color: CORES.azulEscuro, marginBottom: 5 },
  subtitle: { fontSize: 14, color: CORES.textoSecundario, textAlign: 'center' },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center', width: '100%',
    height: 55, backgroundColor: CORES.inputBg, borderRadius: 25,
    marginBottom: 15, paddingHorizontal: 20,
    borderWidth: 1, borderColor: 'transparent',
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, fontSize: 15, color: CORES.azulEscuro, height: '100%' },
  eyeIcon: { padding: 5 },
  forgotPassword: { alignSelf: 'flex-end', marginBottom: 25, paddingRight: 5 },
  forgotPasswordText: { color: CORES.rosa, fontSize: 13, fontWeight: '700' },
  primaryButton: {
    backgroundColor: CORES.rosa, width: '100%', height: 55,
    borderRadius: 25, justifyContent: 'center', alignItems: 'center',
    elevation: 3, shadowColor: CORES.rosa, shadowOpacity: 0.3,
    shadowRadius: 8, shadowOffset: { width: 0, height: 4 },
  },
  primaryButtonDisabled: { backgroundColor: '#F48FB1', elevation: 0, shadowOpacity: 0 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 17, fontWeight: '800' },
  dividerContainer: {
    flexDirection: 'row', alignItems: 'center',
    width: '100%', marginVertical: 25,
  },
  line: { flex: 1, height: 1, backgroundColor: '#E0E0E0' },
  dividerText: { color: CORES.textoSecundario, marginHorizontal: 15, fontSize: 13, fontWeight: '600' },
  googleButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#FFF', width: '100%', height: 55,
    borderRadius: 25, borderWidth: 1.5, borderColor: CORES.inputBg, elevation: 1,
  },
  socialIcon: { marginRight: 12 },
  googleButtonText: { color: CORES.azulEscuro, fontSize: 15, fontWeight: '700' },
  footer: { flexDirection: 'row', alignSelf: 'center', marginTop: 40 },
  footerText: { color: CORES.textoSecundario, fontSize: 14, fontWeight: '500' },
  linkText: { color: CORES.amarelo, fontSize: 14, fontWeight: '800' },
});
