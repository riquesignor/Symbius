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
import { Ionicons } from '@expo/vector-icons';
import { CORES_SYMBIUS } from './Boasvindas';
import { F } from '../constants/theme';

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
        setMsgAviso('Conta desativada, entre em contato com a coordenação.');
        await signOut(auth);
        return;
      }

      // Conta criada mas e-mail ainda não confirmado na hora do cadastro:
      // se já confirmou, libera (status 1) — é o que mantém a sessão ao reabrir.
      if (userData.status === 0) {
        await user.reload();
        if (user.emailVerified) await updateDoc(userDocRef, { status: 1 });
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
      setMsgAviso('Email de redefinição enviado!');
      setModalReset(false);
      setEmailReset('');
    } catch (error: any) {
      setMsgAviso('Email não encontrado.');
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
            <Text style={styles.logoText}>Simbio</Text>
            <Text style={styles.logoSlogan}>aprenda junto</Text>
          </View>

          {/* CARD */}
          <View style={styles.card}>

            {/* EMAIL */}
            <Text style={styles.fieldLabel}>Email:</Text>
            <TextInput
              style={styles.input}
              placeholder="Digite aqui..."
              placeholderTextColor={CORES_SYMBIUS.textoTerciario}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />

            {/* SENHA */}
            <Text style={styles.fieldLabel}>Senha:</Text>
            <View style={styles.senhaWrap}>
              <TextInput
                style={[styles.input, styles.senhaInput]}
                placeholder="Digite aqui..."
                placeholderTextColor={CORES_SYMBIUS.textoTerciario}
                value={senha}
                onChangeText={setSenha}
                secureTextEntry={secureText}
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={styles.olhoBtn}
                onPress={() => setSecureText(v => !v)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityLabel={secureText ? 'Mostrar senha' : 'Ocultar senha'}
              >
                <Ionicons name={secureText ? 'eye-outline' : 'eye-off-outline'} size={22} color={CORES_SYMBIUS.textoSec} />
              </TouchableOpacity>
            </View>

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
                ? <ActivityIndicator color={CORES_SYMBIUS.creme} />
                : <Text style={styles.btnEntrarText}>Entrar</Text>
              }
            </TouchableOpacity>

          </View>

          {/* RODAPÉ */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Ainda não possui acesso?</Text>
            <TouchableOpacity
              style={styles.btnCriarConta}
              onPress={() => navigation.navigate('EscolhaPapel')}
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
              placeholderTextColor={CORES_SYMBIUS.textoTerciario}
              value={emailReset}
              onChangeText={setEmailReset}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <View style={styles.modalBtns}>
              <TouchableOpacity 
                style={[styles.modalBtn, { backgroundColor: CORES_SYMBIUS.fundoSuave }]}
                onPress={() => {
                  setModalReset(false);
                  setEmailReset('');
                }}
              >
                <Text style={styles.modalBtnText}>Cancelar</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.modalBtn, { backgroundColor: CORES_SYMBIUS.verdeEscuro }]}
                onPress={handleResetEmail}
                disabled={loadingReset}
              >
                {loadingReset ? (
                  <ActivityIndicator color={CORES_SYMBIUS.creme} size="small" />
                ) : (
                  <Text style={[styles.modalBtnText, { color: CORES_SYMBIUS.creme }]}>Enviar</Text>
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
  container: { flex: 1, backgroundColor: CORES_SYMBIUS.fundo },
  scroll:    { flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 40, paddingHorizontal: 28 },

  // TOAST
  toast: {
    position: 'absolute', top: 20, alignSelf: 'center',
    backgroundColor: CORES_SYMBIUS.verdeEscuro, paddingVertical: 12, paddingHorizontal: 24,
    borderRadius: 24, zIndex: 999, elevation: 5,
  },
  toastText: { color: CORES_SYMBIUS.creme, fontFamily: F.bold, fontSize: 14 },

  // LOGO
  logoWrap: { marginBottom: 32, alignItems: 'center' },
  logoText:  { fontSize: 40, fontFamily: F.bold, letterSpacing: -0.5, color: CORES_SYMBIUS.verdeEscuro },
  logoSlogan: { fontSize: 13, color: CORES_SYMBIUS.textoSec, fontFamily: F.semibold, marginTop: 2 },

  // CARD
  card: {
    width: '100%',
    backgroundColor: CORES_SYMBIUS.fundoSuave,
    borderRadius: 32,
    padding: 32,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },

  // FIELDS
  fieldLabel: { fontSize: 15, fontFamily: F.bold, color: CORES_SYMBIUS.texto, marginBottom: 8 },
  input: {
    backgroundColor: CORES_SYMBIUS.fundoCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: CORES_SYMBIUS.borda,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: CORES_SYMBIUS.texto,
    marginBottom: 18,
  },

  senhaWrap:  { position: 'relative', justifyContent: 'center' },
  senhaInput: { paddingRight: 50 },
  olhoBtn:    { position: 'absolute', right: 14, top: 14 },

  // ESQUECEU
  forgotText: { fontSize: 13, color: CORES_SYMBIUS.textoSec, marginBottom: 20, textAlign: 'right' },

  // BOTÃO ENTRAR
  btnEntrar: {
    backgroundColor: CORES_SYMBIUS.verdeEscuro,
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 14,
    elevation: 3,
    shadowColor: CORES_SYMBIUS.verdeEscuro,
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  btnEntrarText: { color: CORES_SYMBIUS.creme, fontSize: 16, fontFamily: F.bold, letterSpacing: 0.5 },

  // RODAPÉ
  footer: { alignItems: 'center', marginTop: 16, gap: 12 },
  footerText: { fontSize: 13, color: CORES_SYMBIUS.textoSec },
  btnCriarConta: {
    width: '100%',
    backgroundColor: CORES_SYMBIUS.fundoCard,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: CORES_SYMBIUS.verdeEscuro,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnCriarContaText: { fontSize: 16, fontFamily: F.bold, color: CORES_SYMBIUS.verdeEscuro, letterSpacing: 0.5 },

  // MODAL
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(26, 26, 26, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBox: {
    width: '85%',
    maxWidth: 360,
    backgroundColor: CORES_SYMBIUS.fundoCard,
    borderRadius: 16,
    padding: 24,
    elevation: 5,
  },
  modalTitulo: {
    fontSize: 18,
    fontFamily: F.bold,
    color: CORES_SYMBIUS.texto,
    marginBottom: 6,
  },
  modalSub: {
    fontSize: 13,
    color: CORES_SYMBIUS.textoSec,
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
    fontFamily: F.bold,
    color: CORES_SYMBIUS.texto,
  },
});
