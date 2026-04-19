import React, { useState, useEffect } from 'react';
import {
  StyleSheet, Text, View, TextInput, TouchableOpacity,
  SafeAreaView, ScrollView, KeyboardAvoidingView,
  Platform, ActivityIndicator
} from 'react-native';
import { db, auth } from '../config/firebaseConfig';
import { signOut } from 'firebase/auth';
import { collection, query, where, getDocs, updateDoc } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function Login({ navigation }: any) {
  const [email,      setEmail]      = useState('');
  const [senha,      setSenha]      = useState('');
  const [loading,    setLoading]    = useState(false);
  const [msgAviso,   setMsgAviso]   = useState('');
  const [secureText, setSecureText] = useState(true);

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
      const q = query(
        collection(db, 'usuarios'),
        where('email_escolar', '==', email.trim().toLowerCase())
      );
      const querySnap = await getDocs(q);
      if (querySnap.empty) { setMsgAviso('Usuário não encontrado.'); return; }

      const userDoc  = querySnap.docs[0];
      const userData = userDoc.data();

      if (userData.senha !== senha) { setMsgAviso('E-mail ou senha incorretos.'); return; }
      if (userData.status === 2)    { setMsgAviso('🚫 Conta desativada, entre em contato com a coordenação.'); return; }

      if (userData.status === 0) {
        try {
          const { signInWithEmailAndPassword } = await import('firebase/auth');
          const credential = await signInWithEmailAndPassword(auth, email.trim(), userData.senhaAuth || senha);
          await credential.user.reload();
          if (credential.user.emailVerified) {
            await updateDoc(userDoc.ref, { status: 1 });
            await signOut(auth);
          } else {
            await signOut(auth);
            setMsgAviso('⚠️ Aprove seu e-mail para entrar.');
            return;
          }
        } catch {
          setMsgAviso('⚠️ Aprove seu e-mail para entrar.');
          return;
        }
      }

      const uid = userDoc.id;
      await AsyncStorage.setItem('uid', uid);
      navigation.reset({
        index: 0,
        routes: [{ name: userData.tipo === 'Administrador' ? 'Admin' : 'Index', params: { uid } }],
      });
    } catch (err: any) {
      setMsgAviso('Erro ao conectar. Tente novamente.');
    } finally {
      setLoading(false);
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
            <TouchableOpacity onPress={() => navigation.navigate('RedefinirSenha')}>
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
    borderRadius: 24,
    padding: 28,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },

  // FIELDS
  fieldLabel: { fontSize: 15, fontWeight: '700', color: '#1A1A2E', marginBottom: 6 },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#1A1A2E',
    marginBottom: 16,
  },

  // ESQUECEU
  forgotText: { fontSize: 13, color: '#8D99AE', marginBottom: 24 },

  // BOTÃO ENTRAR
  btnEntrar: {
    backgroundColor: '#2C2C3E',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
  },
  btnEntrarText: { color: '#FFF', fontSize: 16, fontWeight: '700' },

  // RODAPÉ
  footer: { alignItems: 'center', marginTop: 28, gap: 12 },
  footerText: { fontSize: 14, color: '#8D99AE' },
  btnCriarConta: {
    width: '100%',
    backgroundColor: '#F5F5F5',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#D0D0D0',
    paddingVertical: 15,
    alignItems: 'center',
  },
  btnCriarContaText: { fontSize: 16, fontWeight: '700', color: '#1A1A2E' },
});