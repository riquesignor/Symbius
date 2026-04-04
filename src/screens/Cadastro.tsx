import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, Text, View, TextInput, TouchableOpacity, 
  ScrollView, Alert, SafeAreaView, KeyboardAvoidingView, 
  Platform, Dimensions, Modal, FlatList, ActivityIndicator
} from 'react-native';
import { cadastrarNoJumo } from '../services/authService'; 
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

export default function Cadastro({ navigation }: any) {
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmaSenha, setConfirmaSenha] = useState('');
  const [ra, setRa] = useState('');
  const [serie, setSerie] = useState('');
  const [indicacao, setIndicacao] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const [perfilTipo, setPerfilTipo] = useState('');
  const [loading, setLoading] = useState(false);

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
        setPerfilTipo('Aluno');
        const prefixo = emailLower.split('@')[0];
        if (!prefixo.includes('.')) setRa(prefixo.toUpperCase());
      } 
      else if (emailLower.endsWith('@anchieta.br')) {
        setStatusMsg("✓ Perfil Administrativo Detectado");
        setPerfilTipo('Administrador');
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
    if (!nome || !email || !senha || (perfilTipo === 'Aluno' && (!serie || !indicacao))) {
      Alert.alert("Atenção", "Preencha todos os campos obrigatórios.");
      return;
    }
    if (senha !== confirmaSenha) {
      Alert.alert("Erro", "As senhas não coincidem!");
      return;
    }

    setLoading(true);
    let turmaFormatada = "N/A";
    
    if (perfilTipo === 'Aluno' && serie && indicacao) {
      const numeroSerie = serie.replace(' ANO', '');
      const partes = indicacao.split(' ');
      const curso = partes[0].charAt(0).toUpperCase() + partes[0].slice(1).toLowerCase();
      const letra = partes[1] || "";
      turmaFormatada = `${numeroSerie} - ${curso} - ${letra}`;
    }

    try {
      await cadastrarNoJumo(email, senha, nome, ra, turmaFormatada, perfilTipo);
      Alert.alert(
        "Sucesso!", 
        "Verifique seu e-mail para confirmar a conta.", 
        [{ text: "OK", onPress: () => navigation.navigate('Login') }]
      );
    } catch (error: any) {
      Alert.alert("Erro", error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        
        {/* Header no estilo X (Botão voltar e Título) */}
        <View style={styles.xHeader}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="close-outline" size={28} color="#000" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Criar sua conta</Text>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          
          <View style={styles.formContainer}>
            
            {/* Input Nome */}
            <View style={styles.inputBox}>
              <TextInput 
                style={styles.input} 
                placeholder="Nome completo" 
                placeholderTextColor="#71767B"
                onChangeText={setNome} 
                value={nome} 
              />
            </View>

            {/* Input Email com StatusMsg Dinâmica */}
            <View style={[styles.inputBox, statusMsg.includes('❌') && { borderColor: '#F4212E' }]}>
              <TextInput 
                style={styles.input} 
                placeholder="E-mail institucional" 
                placeholderTextColor="#71767B"
                onChangeText={setEmail} 
                value={email} 
                autoCapitalize="none" 
                keyboardType="email-address" 
              />
            </View>
            {statusMsg !== "" && (
              <Text style={[styles.statusText, { color: perfilTipo === '' ? '#F4212E' : '#00BA7C' }]}>
                {statusMsg}
              </Text>
            )}

            {/* Linha de Senhas */}
            <View style={styles.inputBox}>
              <TextInput 
                style={styles.input} 
                placeholder="Senha" 
                placeholderTextColor="#71767B"
                onChangeText={setSenha} 
                secureTextEntry 
                value={senha} 
              />
            </View>

            <View style={styles.inputBox}>
              <TextInput 
                style={styles.input} 
                placeholder="Confirmar senha" 
                placeholderTextColor="#71767B"
                onChangeText={setConfirmaSenha} 
                secureTextEntry 
                value={confirmaSenha} 
              />
            </View>

            {/* RA e SÉRIE */}
            <View style={styles.row}>
              <View style={[styles.inputBox, { flex: 1 }, perfilTipo === 'Administrador' && styles.disabledInput]}>
                <TextInput 
                  style={styles.input} 
                  placeholder="RA (ID)" 
                  placeholderTextColor="#71767B"
                  value={ra} 
                  onChangeText={setRa} 
                  editable={perfilTipo !== 'Administrador'} 
                />
              </View>

              <TouchableOpacity 
                style={[styles.inputBox, { flex: 1, justifyContent: 'center' }, perfilTipo === 'Administrador' && styles.disabledInput]}
                onPress={() => setShowSerieModal(true)}
                disabled={perfilTipo === 'Administrador'}
              >
                <Text style={[styles.inputText, !serie && { color: '#71767B' }]}>
                  {serie || "Série"}
                </Text>
                <Ionicons name="chevron-down" size={18} color="#71767B" style={styles.iconRight} />
              </TouchableOpacity>
            </View>

            {/* Turma/Indicação */}
            <TouchableOpacity 
              style={[styles.inputBox, perfilTipo === 'Administrador' && styles.disabledInput, { justifyContent: 'center' }]}
              onPress={() => setShowIndicacaoModal(true)}
              disabled={perfilTipo === 'Administrador'}
            >
              <Text style={[styles.inputText, !indicacao && { color: '#71767B' }]}>
                {indicacao || "Indicação (Curso/Turma)"}
              </Text>
              <Ionicons name="chevron-down" size={18} color="#71767B" style={styles.iconRight} />
            </TouchableOpacity>

          </View>

          {/* Rodapé com botão fixo visualmente */}
          <View style={styles.footer}>
            <Text style={styles.termsText}>
              Ao se inscrever, você concorda com os Termos de Serviço e a Política de Privacidade.
            </Text>
            
            <TouchableOpacity 
              style={[styles.btnAction, loading && { opacity: 0.7 }]} 
              onPress={handleSignUp}
              disabled={loading}
            >
              {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.btnText}>Cadastrar agora</Text>}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => navigation.navigate('Login')} style={styles.loginLink}>
              <Text style={styles.loginText}>Já tem uma conta? <Text style={styles.linkBlue}>Entrar</Text></Text>
            </TouchableOpacity>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>

      {/* Modais Customizados estilo X */}
      <SelectionModal 
        visible={showSerieModal} 
        data={listaSeries} 
        onSelect={(val: string) => {setSerie(val); setShowSerieModal(false);}} 
        onClose={() => setShowSerieModal(false)}
        title="Selecione sua Série"
      />

      <SelectionModal 
        visible={showIndicacaoModal} 
        data={listaIndicacoes} 
        onSelect={(val: string) => {setIndicacao(val); setShowIndicacaoModal(false);}} 
        onClose={() => setShowIndicacaoModal(false)}
        title="Selecione sua Turma"
      />

    </SafeAreaView>
  );
}

const SelectionModal = ({ visible, data, onSelect, onClose, title }: any) => (
  <Modal visible={visible} transparent animationType="slide">
    <View style={styles.modalOverlay}>
      <View style={styles.modalContent}>
        <View style={styles.modalHeader}>
           <Text style={styles.modalTitle}>{title}</Text>
        </View>
        <FlatList 
          data={data}
          keyExtractor={(item) => item}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.modalItem} onPress={() => onSelect(item)}>
              <Text style={styles.modalItemText}>{item}</Text>
            </TouchableOpacity>
          )}
        />
        <TouchableOpacity style={styles.modalCloseBtn} onPress={onClose}>
          <Text style={styles.modalCloseBtnText}>Fechar</Text>
        </TouchableOpacity>
      </View>
    </View>
  </Modal>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  xHeader: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 15, 
    height: 60,
  },
  backBtn: { padding: 5 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', marginLeft: 20 },
  scrollContent: { paddingHorizontal: 30, paddingBottom: 40 },
  formContainer: { marginTop: 20 },
  
  // Design de Input do X
  inputBox: {
    width: '100%',
    height: 55,
    borderWidth: 1,
    borderColor: '#CFD9DE',
    borderRadius: 4,
    marginBottom: 15,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center'
  },
  input: { flex: 1, fontSize: 17, color: '#000' },
  inputText: { fontSize: 17, color: '#000' },
  disabledInput: { backgroundColor: '#F7F9F9', borderColor: '#EFF3F4', opacity: 0.6 },
  iconRight: { position: 'absolute', right: 12 },
  statusText: { fontSize: 13, fontWeight: '600', marginTop: -10, marginBottom: 15, marginLeft: 5 },
  row: { flexDirection: 'row', gap: 12 },

  // Botão e Rodapé
  footer: { marginTop: 30 },
  termsText: { fontSize: 13, color: '#71767B', lineHeight: 18, marginBottom: 20 },
  btnAction: { 
    backgroundColor: '#00A8FF', 
    height: 50, 
    borderRadius: 25, 
    justifyContent: 'center', 
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 2
  },
  btnText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },
  loginLink: { marginTop: 20, alignItems: 'center' },
  loginText: { color: '#71767B', fontSize: 15 },
  linkBlue: { color: '#00A8FF', fontWeight: 'bold' },

  // Estilo Modais
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalContent: { 
    backgroundColor: '#FFF', 
    borderTopLeftRadius: 20, 
    borderTopRightRadius: 20, 
    padding: 20, 
    maxHeight: '60%' 
  },
  modalHeader: { paddingBottom: 15, borderBottomWidth: 1, borderBottomColor: '#EFF3F4' },
  modalTitle: { fontSize: 18, fontWeight: 'bold', textAlign: 'center' },
  modalItem: { paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: '#EFF3F4' },
  modalItemText: { fontSize: 16, textAlign: 'center', color: '#000' },
  modalCloseBtn: { 
    marginTop: 10, 
    paddingVertical: 15, 
    backgroundColor: '#F7F9F9', 
    borderRadius: 25, 
    alignItems: 'center' 
  },
  modalCloseBtnText: { fontWeight: 'bold', color: '#000' }
});