import React, { useState } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, StyleSheet, 
  SafeAreaView, Alert, ActivityIndicator,  
} from 'react-native';
import { auth, db } from '../config/firebaseConfig';
import { collection, addDoc, query, where, getDocs, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
// 1. ADICIONADO: Importação da biblioteca de e-mail
import emailjs from '@emailjs/browser';

export default function RecuperarSenha({ navigation }: any) {
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [codigoDigitado, setCodigoDigitado] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [loading, setLoading] = useState(false);
  const [mensagemSucesso, setMensagemSucesso] = useState(false);

  // --- SEUS DADOS DO EMAILJS ---
  const SERVICE_ID = "service_zyzhn4t";
  const TEMPLATE_ID = "template_t4silf4";
  const PUBLIC_KEY = "h7W8IUyfgRneNK2J7";

  // --- PASSO 1: ENVIAR CÓDIGO REAL ---
  const enviarCodigo = async () => {
    if (!email.includes("@")) {
      Alert.alert("Erro", "Digite um e-mail válido.");
      return;
    }

    setLoading(true);
    try {
      const codigoGerado = Math.floor(100000 + Math.random() * 900000).toString();

      // Salva no Firestore
      await addDoc(collection(db, "recuperacao_senhas"), {
        email: email.toLowerCase().trim(),
        codigo: codigoGerado,
        criadoEm: new Date()
      });

      // 2. ADICIONADO: Envio real via EmailJS usando seus IDs
      const templateParams = {
        to_email: email,
        codigo: codigoGerado,
      };

      await emailjs.send(SERVICE_ID, TEMPLATE_ID, templateParams, PUBLIC_KEY);
      
      console.log("E-mail enviado com o código:", codigoGerado);
      
      setMensagemSucesso(true);
      setTimeout(() => {
        setMensagemSucesso(false);
        setStep(2);
      }, 5000);

    } catch (error) {
      console.error("ERRO NO EMAILJS:", error);
      Alert.alert("Erro", "Falha ao enviar e-mail. Verifique se os IDs estão corretos.");
    } finally {
      setLoading(false);
    }
  };

  // --- PASSO 2: VALIDAR CÓDIGO ---
  const validarCodigo = async () => {
    setLoading(true);
    try {
      const q = query(
        collection(db, "recuperacao_senhas"), 
        where("email", "==", email.toLowerCase().trim()),
        where("codigo", "==", codigoDigitado)
      );

      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        querySnapshot.forEach(async (documento) => {
          await deleteDoc(doc(db, "recuperacao_senhas", documento.id));
        });
        setStep(3);
      } else {
        Alert.alert("Erro", "Código inválido.");
      }
    } catch (error) {
      Alert.alert("Erro", "Erro ao validar.");
    } finally {
      setLoading(false);
    }
  };

  // --- PASSO 3: ATUALIZAR A SENHA ---
 const atualizarSenha = async () => {
  if (novaSenha.length < 6) {
    Alert.alert("Erro", "A senha deve ter pelo menos 6 caracteres.");
    return;
  }

  setLoading(true);
  try {
    const emailAlvo = email.toLowerCase().trim();
    console.log("Buscando no campo 'email_escolar' por:", emailAlvo);

    // 1. Busca direta no campo correto
    const q = query(
      collection(db, "usuarios"), 
      where("email_escolar", "==", emailAlvo) // <--- O NOME CERTO AQUI
    );

    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      // 2. Achou! Agora pegamos o ID do documento
      const userDoc = querySnapshot.docs[0];
      const userRef = doc(db, "usuarios", userDoc.id);

      // 3. Atualiza a senha
      await updateDoc(userRef, {
        senha: novaSenha
      });

      console.log("✅ Senha alterada com sucesso!");
      Alert.alert("Sucesso", "Senha redefinida com sucesso!", [
        { text: "OK", onPress: () => navigation.navigate('Login') }
      ]);
    } else {
      console.log("❌ Erro: e-mail não encontrado no campo 'email_escolar'");
      Alert.alert("Erro", "E-mail escolar não encontrado.");
    }
  } catch (error: any) {
    console.error("Erro no Firebase:", error.message);
    Alert.alert("Erro", "Falha ao atualizar.");
  } finally {
    setLoading(false);
  }
};
  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.btnVoltar}>
        <Ionicons name="arrow-back" size={28} color="white" />
      </TouchableOpacity>

      <View style={styles.content}>
        <Text style={styles.title}>
          {step === 1 && "Recuperar Senha"}
          {step === 2 && "Verificação"}
          {step === 3 && "Nova Senha"}
        </Text>

        {mensagemSucesso && (
          <View style={styles.toast}>
            <Text style={styles.toastText}>✅ Código enviado para o seu e-mail!</Text>
            <Text style={styles.toastSubText}>Aguarde 5 segundos...</Text>
          </View>
        )}

        {step === 1 && (
          <View>
            <Text style={styles.subtitle}>Digite seu e-mail para receber o código de 6 dígitos.</Text>
            <TextInput 
              style={styles.input} 
              placeholder="seu@email.com" 
              placeholderTextColor="#666"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <TouchableOpacity style={styles.button} onPress={enviarCodigo}>
              {loading ? <ActivityIndicator color="white" /> : <Text style={styles.buttonText}>Enviar Código</Text>}
            </TouchableOpacity>
          </View>
        )}

        {step === 2 && (
          <View>
            <Text style={styles.subtitle}>Insira o código enviado para {email}</Text>
            <TextInput 
              style={styles.input} 
              placeholder="000000" 
              placeholderTextColor="#666"
              value={codigoDigitado}
              onChangeText={setCodigoDigitado}
              keyboardType="number-pad"
              maxLength={6}
            />
            <TouchableOpacity style={styles.button} onPress={validarCodigo}>
              <Text style={styles.buttonText}>Verificar Código</Text>
            </TouchableOpacity>
          </View>
        )}

        {step === 3 && (
          <View>
            <Text style={styles.subtitle}>Crie uma nova senha de acesso.</Text>
            <TextInput 
              style={styles.input} 
              placeholder="Nova senha" 
              placeholderTextColor="#666"
              secureTextEntry
              value={novaSenha}
              onChangeText={setNovaSenha}
            />
            <TextInput 
              style={styles.input} 
              placeholder="Confirmar nova senha" 
              placeholderTextColor="#666"
              secureTextEntry
              value={confirmarSenha}
              onChangeText={setConfirmarSenha}
            />
            <TouchableOpacity style={[styles.button, {backgroundColor: '#4CAF50'}]} onPress={atualizarSenha}>
              <Text style={styles.buttonText}>Redefinir Senha</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f1a' },
  btnVoltar: { padding: 20, paddingTop: 40 },
  content: { padding: 25, justifyContent: 'center', flex: 1 },
  title: { fontSize: 28, fontWeight: 'bold', color: 'white', marginBottom: 10 },
  subtitle: { color: '#aaa', fontSize: 16, marginBottom: 30 },
  input: { backgroundColor: '#1c1c2e', color: 'white', padding: 18, borderRadius: 12, fontSize: 16, marginBottom: 20 },
  button: { backgroundColor: '#E91E63', padding: 18, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  buttonText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  toast: { backgroundColor: '#E91E63', padding: 15, borderRadius: 8, marginBottom: 20, borderLeftWidth: 5, borderLeftColor: 'white' },
  toastText: { color: 'white', fontWeight: 'bold', textAlign: 'center' },
  toastSubText: { color: 'white', textAlign: 'center', fontSize: 12 }
});