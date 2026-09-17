import React, { useState, useEffect } from 'react';
import {
  StyleSheet, Text, View, TextInput, TouchableOpacity,
  SafeAreaView, ScrollView, KeyboardAvoidingView,
  Platform, ActivityIndicator, Modal
} from 'react-native';
import { db, auth } from '../config/firebaseConfig';
import { signOut, sendPasswordResetEmail, signInWithEmailAndPassword } from 'firebase/auth';
import { collection, query, where, getDocs, updateDoc, doc, getDoc } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function Login({ navigation }: any) {
  const [email,         setEmail]         = useState('');
  const [senha,         setSenha]         = useState('');
  const [loading,       setLoading]       = useState(false);
  const [msgAviso,      setMsgAviso]      = useState('');
  const [secureText,    setSecureText]    = useState(true);
  
  // Modal reset
  const [modalReset,    setModalReset]    = useState(false);
  const [emailReset,    setEmailReset]    = useState('');
  const [loadingReset,  setLoadingReset]  = useState(false);

  useEffect(() => {
    if (msgAviso !== '') {
      const timer = setTimeout(() => setMsgAviso(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [msgAviso]);

  const handleLogin = async () => {
    if (!email || !senha) { setMsgAviso('Preencha e-mail e senha!'); return; }
    setLoading(true);
    try {
      // 1. Autenticar com Firebase Auth
      const userCredential = await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), senha);
      const user = userCredential.user;
      const uid = user.uid;

      // 2. Buscar dados do usuário no Firestore
      const userDocRef = doc(db, 'usuarios', uid);
      const userDocSnap = await getDoc(userDocRef);

      if (!userDocSnap.exists()) {
        setMsgAviso('Dados do usuário não encontrados.');
        await signOut(auth);
        return;
      }

      const userData = userDocSnap.data();

      // 3. Verificar status da conta
      if (userData.status === 2) {
        setMsgAviso('🚫 Conta desativada, entre em contato com a coordenação.');
        await signOut(auth);
        return;
      }

      // 4. Guardar UID e navegar
      await AsyncStorage.setItem('uid', uid);
      navigation.reset({
        index: 0,
        routes: [{ name: 'Index', params: { uid } }],
      });
    } catch (err: any) {
      if (err.code === 'auth/user-not-found') {
        setMsgAviso('Usuário não encontrado.');
      } else if (err.code === 'auth/wrong-password') {
        setMsgAviso('E-mail ou senha incorretos.');
      } else if (err.code === 'auth/invalid-credential') {
        setMsgAviso('E-mail ou senha incorretos.');
      } else {
        setMsgAviso('Erro ao conectar. Tente novamente.');
      }
      console.error('Erro de login:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleResetEmail = async () => {
    if (!emailReset) {
      setMsgAviso('Email vazio');
      return;
    }
    setLoadingReset(true);
    try {
      await sendPasswordResetEmail(auth, emailReset.trim());
      setMsgAviso('✅ Email de redefinição enviado!');
      setModalReset(false);
      setEmailReset('');
    } catch (error: any) {
      setMsgAviso('❌ Email não encontrado.');
    } finally {
      setLoadingReset(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          {/* TOAST */}
          {msgAviso !== '' && (
            <View style={styles.toast}>
              <Text style={styles.toastText}>{msgAviso}</Text>
            </View>
          )}

          {/* LOGO */}
          <View style={styles.logoWrap}>
            <View style={styles.logoDot} />
            <Text style={styles.logoText}>
              <Text style={styles.logoJum}>JUM</Text>
              <Text style={styles.logoO}>O</Text>
            </Text>
          </View>

          {/* CARD */}
          <View style={styles.card}>

            {/* EMAIL */}
            <Text style={styles.fieldLabel}>Email:</Text>
            <TextInput
              style={styles.input}
              placeholder="Digite aqui..."
              placeholderTextColor="#BBBFC4"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />

            {/* SENHA */}
            <Text style={styles.fieldLabel}>Senha:</Text>
            <TextInput
              style={styles.input}
              placeholder="Digite aqui..."
              placeholderTextColor="#BBBFC4"
              value={senha}
              onChangeText={setSenha}
              secureTextEntry={secureText}
            />

            {/* ESQUECEU */}
            <TouchableOpacity onPress={() => setModalReset(true)}>
              <Text style={styles.forgotText}>Esqueceu a senha?</Text>
            </TouchableOpacity>

            {/* BOTÃO ENTRAR */}
            <TouchableOpacity
              style={[styles.btnEntrar, (!email || !senha) && { opacity: 0.5 }]}
              onPress={handleLogin}
              disabled={loading || !email || !senha}
            >
              {loading
                ? <ActivityIndicator color="#FFF" />
                : <Text style={styles.btnEntrarText}>Entrar</Text>
              }
            </TouchableOpacity>

          </View>

          {/* RODAPÉ */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Ainda não possui acesso?</Text>
            <TouchableOpacity
              style={styles.btnCriarConta}
              onPress={() => navigation.navigate('Cadastro')}
            >
              <Text style={styles.btnCriarContaText}>Criar Conta</Text>
            </TouchableOpacity>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>

      {/* ════════════════════════════════════════════════
          MODAL REDEFINIR SENHA
      ════════════════════════════════════════════════ */}
      <Modal visible={modalReset} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitulo}>Redefinir Senha</Text>
            <Text style={styles.modalSub}>Informe seu email escolar</Text>
            
            <TextInput
              style={styles.input}
              placeholder="seu.email@escola.com"
              placeholderTextColor="#BBBFC4"
              value={emailReset}
              onChangeText={setEmailReset}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <View style={styles.modalBtns}>
              <TouchableOpacity 
                style={[styles.modalBtn, { backgroundColor: '#E0E0E0' }]}
                onPress={() => {
                  setModalReset(false);
                  setEmailReset('');
                }}
              >
                <Text style={styles.modalBtnText}>Cancelar</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.modalBtn, { backgroundColor: '#2C2C3E' }]}
                onPress={handleResetEmail}
                disabled={loadingReset}
              >
                {loadingReset ? (
                  <ActivityIndicator color="#FFF" size="small" />
                ) : (
                  <Text style={[styles.modalBtnText, { color: '#FFF' }]}>Enviar</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#EFEFEF' },
  scroll:    { flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 40, paddingHorizontal: 28 },

  // TOAST
  toast: {
    position: 'absolute', top: 20, alignSelf: 'center',
    backgroundColor: '#E91E63', paddingVertical: 12, paddingHorizontal: 24,
    borderRadius: 24, zIndex: 999, elevation: 5,
  },
  toastText: { color: '#FFF', fontWeight: 'bold', fontSize: 14 },

  // LOGO
  logoWrap: { position: 'relative', marginBottom: 32, alignItems: 'center' },
  logoDot: {
    position: 'absolute', top: 2, left: 1,
    width: 9, height: 9, borderRadius: 5,
    backgroundColor: '#FFC107', zIndex: 10,
  },
  logoText:  { fontSize: 44, fontWeight: '900', letterSpacing: -1 },
  logoJum:   { color: '#1A1A2E' },
  logoO:     { color: '#E91E63' },

  // CARD
  card: {
    width: '100%',
    backgroundColor: '#F5F5F5',
    borderRadius: 32,
    padding: 32,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },

  // FIELDS
  fieldLabel: { fontSize: 15, fontWeight: '700', color: '#0B2046', marginBottom: 8 },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 0,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: '#1A1A2E',
    marginBottom: 18,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },

  // ESQUECEU
  forgotText: { fontSize: 13, color: '#8D99AE', marginBottom: 20, textAlign: 'right' },

  // BOTÃO ENTRAR
  btnEntrar: {
    backgroundColor: '#0B2046',
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 14,
    elevation: 3,
    shadowColor: '#0B2046',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  btnEntrarText: { color: '#FFF', fontSize: 16, fontWeight: '700', letterSpacing: 0.5 },

  // RODAPÉ
  footer: { alignItems: 'center', marginTop: 16, gap: 12 },
  footerText: { fontSize: 13, color: '#8D99AE' },
  btnCriarConta: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#0B2046',
    paddingVertical: 14,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  btnCriarContaText: { fontSize: 16, fontWeight: '700', color: '#0B2046', letterSpacing: 0.5 },

  // MODAL
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBox: {
    width: '85%',
    maxWidth: 360,
    backgroundColor: '#F5F5F5',
    borderRadius: 16,
    padding: 24,
    elevation: 5,
  },
  modalTitulo: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A2E',
    marginBottom: 6,
  },
  modalSub: {
    fontSize: 13,
    color: '#8D99AE',
    marginBottom: 16,
  },
  modalBtns: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  modalBtn: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A1A2E',
  },
});
