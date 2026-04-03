import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, Text, View, TextInput, TouchableOpacity, 
  SafeAreaView, ScrollView, KeyboardAvoidingView, 
  Platform, Dimensions, ActivityIndicator 
} from 'react-native';
import { auth, db } from '../config/firebaseConfig';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { MaterialIcons, FontAwesome5 } from '@expo/vector-icons'; 

const { height: screenHeight } = Dimensions.get('window');

export default function Login({ navigation }: any) {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [loading, setLoading] = useState(false);
  const [msgAviso, setMsgAviso] = useState('');

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

      // CORREÇÃO 1: Mudamos de "cadastro" para "usuarios"
      const userRef = doc(db, "usuarios", user.uid);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const userData = userSnap.data();

        // CORREÇÃO 2: Verifica se a conta está suspensa para dar o aviso na tela
        if (userData.status === 2) {
          setMsgAviso("⚠️ Sua conta foi suspensa.");
          await signOut(auth);
          setLoading(false);
          return;
        }

        // CORREÇÃO 3: Ajustado para "Administrador" com a primeira letra maiúscula
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
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <View style={styles.centeredWrapper}>
          
          {msgAviso !== '' && (
            <View style={styles.toastAviso}>
              <Text style={styles.toastText}>{msgAviso}</Text>
            </View>
          )}

          <View style={styles.mainCard}>
            
            {/* LADO ESQUERDO: MENSAGEM E ILUSTRAÇÃO */}
            <View style={styles.leftSide}>
               <View style={styles.welcomeContent}>
                  <Text style={styles.welcomeTitle}>Welcome back!</Text>
                  <Text style={styles.welcomeSub}>You can sign in to access with your existing account.</Text>
               </View>

               <View style={styles.illustrationContainer}>
                  {/* Elementos decorativos (Nuvens/Símbolos) */}
                  <View style={[styles.decor, { top: 20, left: 40 }]}><Text style={styles.decorText}>+</Text></View>
                  <View style={[styles.decor, { top: 60, right: 30 }]}><View style={styles.circleDecor}/></View>
                  
                  {/* Porta Minimalista */}
                  <View style={styles.doorFrame}>
                    <View style={styles.doorWindowRow}>
                      <View style={styles.doorPane}/><View style={styles.doorPane}/>
                    </View>
                    <View style={styles.doorBottomPane}/>
                  </View>

                  {/* Personagem Minimalista */}
                  <View style={styles.charBody}>
                    <View style={styles.charHead}/>
                    <View style={styles.charTorso}/>
                    <View style={styles.charArm}/>
                  </View>
               </View>
            </View>

            {/* LADO DIREITO: FORMULÁRIO */}
            <View style={styles.rightSide}>
              <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                <Text style={styles.loginTitle}>LOGIN</Text>

                <View style={styles.inputWrapper}>
                  <MaterialIcons name="person-outline" size={20} color="#A0B2C3" style={styles.inputIcon} />
                  <TextInput 
                    style={styles.input} 
                    onChangeText={setEmail} 
                    value={email} 
                    placeholder="@mail.com"
                    placeholderTextColor="#A0B2C3"
                    autoCapitalize="none"
                  />
                </View>

                <View style={styles.inputWrapper}>
                  <MaterialIcons name="lock-outline" size={20} color="#A0B2C3" style={styles.inputIcon} />
                  <TextInput 
                    style={styles.input} 
                    onChangeText={setSenha} 
                    value={senha} 
                    secureTextEntry 
                    placeholder="password"
                    placeholderTextColor="#A0B2C3"
                  />
                </View>

                <View style={styles.optionsRow}>
                  <TouchableOpacity style={styles.rememberMeContainer}>
                    <View style={styles.checkbox} />
                    <Text style={styles.rememberText}>Remember me</Text>
                  </TouchableOpacity>
                  <TouchableOpacity>
                    <Text style={styles.forgotPasswordText}>Esqueceu a Senha?</Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity style={styles.btnEntrar} onPress={handleLogin} disabled={loading}>
                  {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.btnText}>Entrar</Text>}
                </TouchableOpacity>

                <TouchableOpacity style={styles.signupContainer} onPress={() => navigation.navigate('Cadastro')}>
                  <Text style={styles.signupText}>
                    Não Tem Uma Conta? <Text style={styles.linkBlue}>Inscrever-se</Text>
                  </Text>
                </TouchableOpacity>

                <View style={styles.socialSection}>
                  <View style={styles.dividerRow}>
                    <View style={styles.line} />
                    <Text style={styles.socialLabel}>Logar Com</Text>
                    <View style={styles.line} />
                  </View>
                  <View style={styles.socialIcons}>
                    <FontAwesome5 name="facebook-f" size={22} color="#1877F2" />
                    <FontAwesome5 name="google" size={22} color="#DB4437" />
                    <FontAwesome5 name="apple" size={24} color="#000" />
                  </View>
                </View>
              </ScrollView>
            </View>

          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#3FA9F5' },
  centeredWrapper: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  toastAviso: {
    position: 'absolute', top: 40, backgroundColor: 'rgba(255, 60, 60, 0.9)',
    paddingVertical: 10, paddingHorizontal: 20, borderRadius: 25, zIndex: 999,
  },
  toastText: { color: '#FFF', fontWeight: 'bold' },
  
  mainCard: {
    width: '100%', maxWidth: 850, height: screenHeight * 0.75,
    flexDirection: 'row', backgroundColor: '#FFF', borderRadius: 20,
    overflow: 'hidden', elevation: 20, shadowColor: '#000',
    shadowOpacity: 0.2, shadowRadius: 15,
  },
  
  // --- LADO ESQUERDO ---
  leftSide: { flex: 1, backgroundColor: '#3FA9F5', padding: 40, justifyContent: 'center' },
  welcomeContent: { marginBottom: 40 },
  welcomeTitle: { fontSize: 32, fontWeight: 'bold', color: '#FFF', marginBottom: 10 },
  welcomeSub: { fontSize: 16, color: '#E1F5FE', lineHeight: 22 },
  
  illustrationContainer: { flex: 1, justifyContent: 'flex-end', alignItems: 'center', position: 'relative' },
  doorFrame: { 
    width: 120, height: 180, backgroundColor: '#B3E5FC', 
    borderTopLeftRadius: 60, borderTopRightRadius: 60, borderBottomWidth: 4, borderColor: '#0288D1',
    padding: 15, justifyContent: 'space-between'
  },
  doorWindowRow: { flexDirection: 'row', justifyContent: 'space-between' },
  doorPane: { width: '45%', height: 40, backgroundColor: '#FFF', borderRadius: 4 },
  doorBottomPane: { width: '100%', height: 80, backgroundColor: '#FFF', borderRadius: 4 },
  
  charBody: { position: 'absolute', right: 20, bottom: 0, alignItems: 'center' },
  charHead: { width: 25, height: 25, backgroundColor: '#263238', borderRadius: 12, marginBottom: 2 },
  charTorso: { width: 35, height: 50, backgroundColor: '#0288D1', borderTopLeftRadius: 10, borderTopRightRadius: 10 },
  charArm: { position: 'absolute', left: -10, top: 30, width: 20, height: 8, backgroundColor: '#FFE0B2', borderRadius: 4, transform: [{rotate: '-15deg'}] },

  decor: { position: 'absolute' },
  decorText: { color: '#FFF', fontSize: 24, fontWeight: '300' },
  circleDecor: { width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: '#FFF' },

  // --- LADO DIREITO ---
  rightSide: { flex: 1.2, backgroundColor: '#FFF', paddingHorizontal: '8%' },
  scrollContent: { flexGrow: 1, justifyContent: 'center' },
  loginTitle: { fontSize: 24, fontWeight: '900', color: '#333', textAlign: 'center', marginBottom: 40 },
  
  inputWrapper: { 
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0F7FF',
    borderRadius: 30, marginBottom: 15, paddingHorizontal: 20, height: 55
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, fontSize: 14, color: '#333' },
  
  optionsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 30 },
  rememberMeContainer: { flexDirection: 'row', alignItems: 'center' },
  checkbox: { width: 16, height: 16, borderWidth: 1, borderColor: '#3FA9F5', borderRadius: 4, marginRight: 8 },
  rememberText: { fontSize: 12, color: '#666' },
  forgotPasswordText: { fontSize: 12, color: '#3FA9F5' },
  
  btnEntrar: { 
    backgroundColor: '#3FA9F5', height: 55, borderRadius: 30, 
    justifyContent: 'center', alignItems: 'center', elevation: 5 
  },
  btnText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },
  
  signupContainer: { marginTop: 25, alignItems: 'center' },
  signupText: { color: '#777', fontSize: 13 },
  linkBlue: { color: '#3FA9F5', fontWeight: 'bold' },

  socialSection: { marginTop: 40 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  line: { flex: 1, height: 1, backgroundColor: '#EEE' },
  socialLabel: { marginHorizontal: 10, color: '#999', fontSize: 12 },
  socialIcons: { flexDirection: 'row', justifyContent: 'center', gap: 30 }
});