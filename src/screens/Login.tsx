import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, Text, View, TextInput, TouchableOpacity, 
  SafeAreaView, ScrollView, KeyboardAvoidingView, 
  Platform, ActivityIndicator 
} from 'react-native';
import { auth, db } from '../config/firebaseConfig';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { AntDesign, FontAwesome5, MaterialIcons } from '@expo/vector-icons'; 

export default function Login({ navigation }: any) {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [loading, setLoading] = useState(false);
  const [msgAviso, setMsgAviso] = useState('');
  const [secureText, setSecureText] = useState(true);

  // Efeito para limpar o aviso após 3 segundos
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

      // Verifica se o e-mail está verificado
      if (!user.emailVerified) {
        setMsgAviso("⚠️ Verifique seu e-mail para acessar!");
        await signOut(auth);
        setLoading(false);
        return;
      }

      // Consulta os dados do usuário no Firestore
      const userRef = doc(db, "usuarios", user.uid);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const userData = userSnap.data();

        // Verifica se a conta está suspensa
        if (userData.status === 2) {
          setMsgAviso("⚠️ Sua conta foi suspensa.");
          await signOut(auth);
          setLoading(false);
          return;
        }

        // Navegação baseada no tipo de usuário
        navigation.replace(userData.tipo === 'Administrador' ? 'Admin' : 'Index');
      } else {
        setMsgAviso("Perfil não encontrado no banco.");
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
      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "height"} 
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          
          {/* Toast de Aviso */}
          {msgAviso !== '' && (
            <View style={styles.toastAviso}>
              <Text style={styles.toastText}>{msgAviso}</Text>
            </View>
          )}

          <View style={styles.content}>
            <Text style={styles.title}>Entrar na sua conta</Text>

            {/* Botões Sociais (Estilo X) */}
            <TouchableOpacity style={styles.socialButton}>
              <AntDesign name="google" size={20} color="#000" style={styles.socialIcon} />
              <Text style={styles.socialButtonText}>Entrar com Google</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.socialButton}>
              <FontAwesome5 name="apple" size={20} color="#000" style={styles.socialIcon} />
              <Text style={styles.socialButtonText}>Entrar com Apple</Text>
            </TouchableOpacity>

            {/* Divisor */}
            <View style={styles.dividerContainer}>
              <View style={styles.line} />
              <Text style={styles.dividerText}>ou</Text>
              <View style={styles.line} />
            </View>

            {/* Formulário de Login */}
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                placeholder="Celular, e-mail ou usuário"
                placeholderTextColor="#71767B"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
              />
            </View>

            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                placeholder="Senha"
                placeholderTextColor="#71767B"
                value={senha}
                onChangeText={setSenha}
                secureTextEntry={secureText}
              />
              <TouchableOpacity onPress={() => setSecureText(!secureText)} style={styles.eyeIcon}>
                <MaterialIcons 
                  name={secureText ? "visibility-off" : "visibility"} 
                  size={20} 
                  color="#3FA9F5" 
                />
              </TouchableOpacity>
            </View>

            {/* Botão Entrar (Azul Original) */}
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

            {/* Esqueceu a Senha */}
            <TouchableOpacity style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Esqueceu a senha?</Text>
            </TouchableOpacity>

            {/* Rodapé de Inscrição */}
            <View style={styles.footer}>
              <Text style={styles.footerText}>Não tem uma conta? </Text>
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
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 20,
  },
  toastAviso: {
    position: 'absolute',
    top: 50,
    left: '10%',
    right: '10%',
    backgroundColor: 'rgba(255, 60, 60, 0.9)',
    paddingVertical: 10,
    borderRadius: 25,
    zIndex: 999,
    alignItems: 'center',
  },
  toastText: { color: '#FFF', fontWeight: 'bold' },
  content: {
    paddingHorizontal: 30,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 40,
    alignSelf: 'center',
  },
  
  // Botões Sociais
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    width: '100%',
    height: 45,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: '#E1E8ED',
    marginBottom: 15,
  },
  socialIcon: { marginRight: 10 },
  socialButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: 'bold',
  },

  // Divisor
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginVertical: 10,
  },
  line: { flex: 1, height: 1, backgroundColor: '#EFF3F4' },
  dividerText: { color: '#000', marginHorizontal: 10, fontSize: 15 },

  // Inputs
  inputWrapper: {
    width: '100%',
    height: 55,
    borderWidth: 1,
    borderColor: '#CFD9DE',
    borderRadius: 4,
    marginVertical: 10,
    paddingHorizontal: 10,
    justifyContent: 'center',
  },
  input: {
    fontSize: 16,
    color: '#000',
  },
  eyeIcon: {
    position: 'absolute',
    right: 15,
  },

  // Botão Principal (Azul Original)
  primaryButton: {
    backgroundColor: '#3FA9F5',
    width: '100%',
    height: 45,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  primaryButtonDisabled: {
    backgroundColor: '#B2DFFC',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },

  // Botão Esqueceu Senha
  secondaryButton: {
    width: '100%',
    height: 45,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: '#CFD9DE',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 15,
  },
  secondaryButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: 'bold',
  },

  // Rodapé
  footer: {
    flexDirection: 'row',
    alignSelf: 'center',
    marginTop: 40,
  },
  footerText: { color: '#71767B', fontSize: 15 },
  linkText: { color: '#3FA9F5', fontSize: 15, fontWeight: 'bold' },
});