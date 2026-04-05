import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, Text, View, TextInput, TouchableOpacity, 
  SafeAreaView, ScrollView, KeyboardAvoidingView, 
  Platform, ActivityIndicator, Dimensions
} from 'react-native';
import { auth, db } from '../config/firebaseConfig';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { AntDesign, MaterialIcons } from '@expo/vector-icons'; 

const { width } = Dimensions.get('window');

// Paleta de Cores JUMO
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
      const userCredential = await signInWithEmailAndPassword(auth, email.trim(), senha);
      const user = userCredential.user;
      await user.reload();

      if (!user.emailVerified) {
        setMsgAviso("⚠️ Verifique seu e-mail para acessar!");
        await signOut(auth);
        setLoading(false);
        return;
      }

      const userRef = doc(db, "usuarios", user.uid);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const userData = userSnap.data();

        if (userData.status === 2) {
          setMsgAviso("⚠️ Sua conta foi suspensa.");
          await signOut(auth);
          setLoading(false);
          return;
        }

        navigation.replace(userData.tipo === 'Administrador' ? 'Admin' : 'Index');
      } else {
        setMsgAviso("Perfil não encontrado.");
        await signOut(auth);
      }
    } catch (err: any) {
      let message = "E-mail ou senha incorretos.";
      if (err.code === 'auth/user-not-found') message = "Usuário não encontrado.";
      if (err.code === 'auth/wrong-password') message = "Senha incorreta.";
      setMsgAviso(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Elementos Decorativos de Fundo */}
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
            
            {/* LOGO JUMO ESTILIZADA */}
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

            {/* Inputs Arredondados */}
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

            <TouchableOpacity style={styles.forgotPassword}>
              <Text style={styles.forgotPasswordText}>Esqueceu a senha?</Text>
            </TouchableOpacity>

            {/* Botão Entrar (Rosa Vibrante) */}
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

            {/* Divisor */}
            <View style={styles.dividerContainer}>
              <View style={styles.line} />
              <Text style={styles.dividerText}>ou</Text>
              <View style={styles.line} />
            </View>

            {/* Botão Google */}
            <TouchableOpacity style={styles.googleButton}>
              <AntDesign name="google" size={20} color={CORES.azulEscuro} style={styles.socialIcon} />
              <Text style={styles.googleButtonText}>Continuar com Google</Text>
            </TouchableOpacity>

            {/* Rodapé de Inscrição */}
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
  container: {
    flex: 1,
    backgroundColor: CORES.fundo,
  },
  
  // Decoração de Fundo (Bolhas)
  blobTopRight: {
    position: 'absolute',
    top: -50,
    right: -50,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(233, 30, 99, 0.08)', // Rosa bem clarinho
  },
  blobBottomLeft: {
    position: 'absolute',
    bottom: -30,
    left: -80,
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: 'rgba(255, 193, 7, 0.1)', // Amarelo bem clarinho
  },

  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 20,
  },
  toastAviso: {
    position: 'absolute',
    top: 20,
    alignSelf: 'center',
    backgroundColor: CORES.rosa,
    paddingVertical: 12,
    paddingHorizontal: 25,
    borderRadius: 25,
    zIndex: 999,
    elevation: 5,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
  },
  toastText: { color: '#FFF', fontWeight: 'bold', fontSize: 14 },
  
  content: {
    paddingHorizontal: 35,
    alignItems: 'center',
  },

  // Estilo do Logo
  logoContainer: {
    position: 'relative',
    marginBottom: 30,
    flexDirection: 'row',
    alignItems: 'center',
  },
  yellowDot: {
    position: 'absolute',
    top: 4,
    left: -6,
    width: 10,
    height: 10,
    backgroundColor: CORES.amarelo,
    borderRadius: 5, // Bolinha redondinha
    zIndex: 10,
  },
  logoText: {
    fontSize: 50,
    fontWeight: '900',
    color: CORES.azulEscuro,
    letterSpacing: -1,
  },

  headerTextContainer: {
    alignItems: 'center',
    marginBottom: 35,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: CORES.azulEscuro,
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 14,
    color: CORES.textoSecundario,
    textAlign: 'center',
  },

  // Inputs Arredondados
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    height: 55,
    backgroundColor: CORES.inputBg,
    borderRadius: 25, // Bem arredondado
    marginBottom: 15,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: CORES.azulEscuro,
    height: '100%',
  },
  eyeIcon: {
    padding: 5,
  },

  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: 25,
    paddingRight: 5,
  },
  forgotPasswordText: {
    color: CORES.rosa,
    fontSize: 13,
    fontWeight: '700',
  },

  // Botões
  primaryButton: {
    backgroundColor: CORES.rosa,
    width: '100%',
    height: 55,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    shadowColor: CORES.rosa,
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  primaryButtonDisabled: {
    backgroundColor: '#F48FB1',
    elevation: 0,
    shadowOpacity: 0,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
  },

  // Divisor
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginVertical: 25,
  },
  line: { flex: 1, height: 1, backgroundColor: '#E0E0E0' },
  dividerText: { color: CORES.textoSecundario, marginHorizontal: 15, fontSize: 13, fontWeight: '600' },

  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF',
    width: '100%',
    height: 55,
    borderRadius: 25,
    borderWidth: 1.5,
    borderColor: CORES.inputBg,
    elevation: 1,
  },
  socialIcon: { marginRight: 12 },
  googleButtonText: {
    color: CORES.azulEscuro,
    fontSize: 15,
    fontWeight: '700',
  },

  // Rodapé
  footer: {
    flexDirection: 'row',
    alignSelf: 'center',
    marginTop: 40,
  },
  footerText: { color: CORES.textoSecundario, fontSize: 14, fontWeight: '500' },
  linkText: { color: CORES.amarelo, fontSize: 14, fontWeight: '800' },
});