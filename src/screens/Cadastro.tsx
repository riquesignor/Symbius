import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, Text, View, TextInput, TouchableOpacity, 
  ScrollView, Alert, SafeAreaView, KeyboardAvoidingView, 
  Platform, Dimensions, Modal, FlatList 
} from 'react-native';
import { cadastrarNoJumo } from '../services/authService'; 

const { height: screenHeight } = Dimensions.get('window');

export default function Cadastro({ navigation }: any) {
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmaSenha, setConfirmaSenha] = useState('');
  const [ra, setRa] = useState('');
  const [serie, setSerie] = useState('');
  const [indicacao, setIndicacao] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const [perfilTipo, setPerfilTipo] = useState(''); // Agora guardará 'Aluno' ou 'Administrador'

  // Estados para controlar os Modais (Combo Box)
  const [showSerieModal, setShowSerieModal] = useState(false);
  const [showIndicacaoModal, setShowIndicacaoModal] = useState(false);

  const listaSeries = ['1º ANO', '2º ANO', '3º ANO'];
  const listaIndicacoes = [
    'REGULAR A', 'REGULAR B', 'REGULAR C',
    'INFO A', 'INFO B', 'INFO C',
    'NUTRI A', 'NUTRI B',
    'DESIGN A', 'DESIGN B',
    'ADM A', 'ADM B'
  ];

  useEffect(() => {
    const emailLower = email.trim().toLowerCase();
    if (emailLower.length > 5) {
      if (emailLower.endsWith('@escolas.anchieta.br')) {
        setStatusMsg("✓ Perfil Aluno Detectado");
        setPerfilTipo('Aluno'); // Ajustado para a nova regra de nomenclatura
        const prefixo = emailLower.split('@')[0];
        if (!prefixo.includes('.')) setRa(prefixo.toUpperCase());
      } 
      else if (emailLower.endsWith('@anchieta.br')) {
        setStatusMsg("✓ Perfil Administrativo Detectado");
        setPerfilTipo('Administrador'); // Ajustado para a nova regra de nomenclatura
        setRa('N/A'); setSerie('N/A'); setIndicacao('N/A');
      } 
      else {
        setStatusMsg("❌ Use apenas e-mail @anchieta");
        setPerfilTipo('');
      }
    } else {
      setStatusMsg("");
      setPerfilTipo('');
    }
  }, [email]);

  const handleSignUp = async () => {
    if (!perfilTipo) {
      Alert.alert("E-mail Inválido", "Use seu e-mail institucional.");
      return;
    }
    // Validação ajustada para o tipo 'Aluno'
    if (!nome || !email || !senha || (perfilTipo === 'Aluno' && (!serie || !indicacao))) {
      Alert.alert("Atenção", "Preencha todos os campos, incluindo Série e Indicação.");
      return;
    }
    if (senha !== confirmaSenha) {
      Alert.alert("Erro", "As senhas não coincidem!");
      return;
    }

    // --- MÁGICA PARA JUNTAR A TURMA NO PADRÃO DO JS ---
    let turmaFormatada = "N/A";
    
    // Condição ajustada para 'Aluno'
    if (perfilTipo === 'Aluno' && serie && indicacao) {
      const numeroSerie = serie.replace(' ANO', ''); // Tira o " ANO", fica só "2º"
      const partes = indicacao.split(' '); // Divide "DESIGN B" em ["DESIGN", "B"]
      
      const curso = partes[0].charAt(0).toUpperCase() + partes[0].slice(1).toLowerCase(); // "Design"
      const letra = partes[1] || ""; // "B"
      
      turmaFormatada = `${numeroSerie} - ${curso} - ${letra}`; // Resultado: "2º - Design - B"
    }

    try {
      await cadastrarNoJumo(email, senha, nome, ra, turmaFormatada, perfilTipo);
      Alert.alert(
        "Sucesso!", 
        "Enviamos um link de verificação para o seu e-mail. Por favor, confirme antes de fazer login.", 
        [{ text: "OK", onPress: () => navigation.navigate('Login') }]
      );
    } catch (error: any) {
      Alert.alert("Erro", error.message);
    }
  };

  // Componente para o "Combo Box" (Seletor)
  const SelectorField = ({ label, value, onPress, enabled }: any) => (
    <View style={{ flex: 1 }}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity 
        style={[styles.input, !enabled && { backgroundColor: '#E0E0E0', opacity: 0.7 }]} 
        onPress={onPress}
        disabled={!enabled}
      >
        <Text style={{ color: value ? '#333' : '#ABB' }}>{value || "Selecionar"}</Text>
      </TouchableOpacity>
    </View>
  );

  const handleSelectSerie = (item: string) => {
    setSerie(item);
    setShowSerieModal(false);
  };

  const handleSelectIndicacao = (item: string) => {
    setIndicacao(item);
    setShowIndicacaoModal(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          
          <View style={styles.header}>
            <Text style={styles.headerTitle}>CRIAR CONTA</Text>
          </View>

          <View style={styles.formCard}>
            {/* Campo Nome */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>NOME COMPLETO</Text>
              <TextInput style={styles.input} onChangeText={setNome} value={nome} placeholder="" />
            </View>

            {/* Campo Email */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>EMAIL ESCOLAR</Text>
              <TextInput style={styles.input} onChangeText={setEmail} value={email} autoCapitalize="none" keyboardType="email-address" placeholder="" />
              {statusMsg !== "" && <Text style={[styles.statusMsgText, { color: perfilTipo === '' ? '#E91E63' : '#27AE60' }]}>{statusMsg}</Text>}
            </View>

            {/* Senhas */}
            <View style={styles.row}>
              <View style={{flex: 1}}>
                <Text style={styles.label}>SENHA</Text>
                <TextInput style={styles.input} onChangeText={setSenha} secureTextEntry value={senha} placeholder="" />
              </View>
              <View style={{flex: 1}}>
                <Text style={styles.label}>CONFIRMAR</Text>
                <TextInput style={styles.input} onChangeText={setConfirmaSenha} secureTextEntry value={confirmaSenha} placeholder="" />
              </View>
            </View>

            {/* RA e SÉRIE (COMBO BOX) */}
            <View style={styles.row}>
              <View style={{flex: 1}}>
                <Text style={styles.label}>RA (ID)</Text>
                {/* Desabilita se for Administrador */}
                <TextInput style={[styles.input, perfilTipo === 'Administrador' && {backgroundColor: '#E0E0E0'}]} value={ra} onChangeText={setRa} editable={perfilTipo !== 'Administrador'} />
              </View>
              
              <SelectorField 
                label="SÉRIE" 
                value={serie} 
                enabled={perfilTipo !== 'Administrador'} 
                onPress={() => setShowSerieModal(true)} 
              />
            </View>

            {/* INDICAÇÃO (COMBO BOX) */}
            <View style={styles.inputGroup}>
              <SelectorField 
                label="INDICAÇÃO (CURSO/TURMA)" 
                value={indicacao} 
                enabled={perfilTipo !== 'Administrador'} 
                onPress={() => setShowIndicacaoModal(true)} 
              />
            </View>

            <TouchableOpacity style={styles.btnAction} onPress={handleSignUp}>
              <Text style={styles.btnText}>CADASTRAR AGORA</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => navigation.navigate('Login')} style={{ marginTop: 20, alignItems: 'center' }}>
              <Text style={{ color: '#777' }}>Já tem uma conta? <Text style={{ color: '#00A8FF', fontWeight: 'bold' }}>Entrar</Text></Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* --- MODAIS DE SELEÇÃO (COMBO BOX) --- */}
      <SelectionModal 
        visible={showSerieModal} 
        data={listaSeries} 
        onSelect={handleSelectSerie} 
        onClose={() => setShowSerieModal(false)}
        title="Selecione sua Série"
      />

      <SelectionModal 
        visible={showIndicacaoModal} 
        data={listaIndicacoes} 
        onSelect={handleSelectIndicacao} 
        onClose={() => setShowIndicacaoModal(false)}
        title="Selecione sua Turma/Curso"
      />

    </SafeAreaView>
  );
}

// Componente Interno de Modal para Seleção
const SelectionModal = ({ visible, data, onSelect, onClose, title }: any) => {
  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>{title}</Text>
          <FlatList 
            data={data}
            keyExtractor={(item) => item}
            renderItem={({ item }) => (
              <TouchableOpacity 
                style={styles.modalItem} 
                onPress={() => {
                   onSelect(item); 
                }}
              >
                <Text style={styles.modalItemText}>{item}</Text>
              </TouchableOpacity>
            )}
          />
          <TouchableOpacity style={styles.modalCloseBtn} onPress={onClose}>
            <Text style={{ color: '#FFF', fontWeight: 'bold' }}>CANCELAR</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#00A8FF' },
  scrollContent: { flexGrow: 1 },
  header: { height: 100, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { color: '#FFF', fontSize: 22, fontWeight: '900', letterSpacing: 2 },
  formCard: { flex: 1, backgroundColor: '#FFF', borderTopLeftRadius: 40, borderTopRightRadius: 40, padding: 25 },
  inputGroup: { marginBottom: 15 },
  row: { flexDirection: 'row', gap: 15, marginBottom: 15 },
  label: { fontSize: 11, fontWeight: 'bold', color: '#888', marginBottom: 5 },
  input: { backgroundColor: '#F4F7F9', borderRadius: 12, padding: 15, fontSize: 15, color: '#333', justifyContent: 'center', minHeight: 50 },
  btnAction: { backgroundColor: '#00A8FF', paddingVertical: 16, borderRadius: 15, alignItems: 'center', marginTop: 15 },
  btnText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },
  statusMsgText: { fontSize: 12, fontWeight: 'bold', marginTop: 5 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '80%', backgroundColor: '#FFF', borderRadius: 20, padding: 20, maxHeight: '70%' },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15, textAlign: 'center', color: '#00A8FF' },
  modalItem: { paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#EEE' },
  modalItemText: { fontSize: 16, color: '#333', textAlign: 'center' },
  modalCloseBtn: { backgroundColor: '#E91E63', padding: 12, borderRadius: 10, marginTop: 15, alignItems: 'center' }
});