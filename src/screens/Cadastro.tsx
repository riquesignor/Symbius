import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, Text, View, TextInput, TouchableOpacity, 
  ScrollView, Alert, SafeAreaView, KeyboardAvoidingView, 
  Platform, Dimensions, Modal, FlatList, ActivityIndicator
} from 'react-native';
import { cadastrarNoJumo } from '../services/authService'; 
import { Ionicons, MaterialIcons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

// Paleta de Cores JUMO (A mesma do Login)
const CORES = {
  azulEscuro: '#1A1A2E',
  rosa: '#E91E63',
  amarelo: '#FFC107',
  fundo: '#FAFAFA',
  inputBg: '#F0F4F8',
  textoDestaque: '#1A1A2E',
  textoSecundario: '#8D99AE',
  sucesso: '#10B981', // Verde suave para mensagens de ok
};

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

  // LÓGICA INTACTA
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
      {/* Elementos Decorativos de Fundo */}
      <View style={styles.blobTopRight} />
      <View style={styles.blobBottomLeft} />

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        
        {/* Header Estilizado */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={28} color={CORES.azulEscuro} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Criar conta</Text>
          <View style={{ width: 28 }} /> {/* Espaçador para centralizar o título */}
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          
          <View style={styles.headerTextContainer}>
            <Text style={styles.title}>Junte-se ao JUMO!</Text>
            <Text style={styles.subtitle}>Preencha seus dados para começar a explorar.</Text>
          </View>

          <View style={styles.formContainer}>
            
            {/* Input Nome */}
            <View style={styles.inputBox}>
              <MaterialIcons name="person-outline" size={20} color={CORES.textoSecundario} style={styles.inputIcon} />
              <TextInput 
                style={styles.input} 
                placeholder="Nome completo" 
                placeholderTextColor={CORES.textoSecundario}
                onChangeText={setNome} 
                value={nome} 
              />
            </View>

            {/* Input Email com StatusMsg Dinâmica */}
            <View style={[styles.inputBox, statusMsg.includes('❌') && { borderWidth: 1, borderColor: CORES.rosa }]}>
              <MaterialIcons name="alternate-email" size={20} color={CORES.textoSecundario} style={styles.inputIcon} />
              <TextInput 
                style={styles.input} 
                placeholder="E-mail institucional" 
                placeholderTextColor={CORES.textoSecundario}
                onChangeText={setEmail} 
                value={email} 
                autoCapitalize="none" 
                keyboardType="email-address" 
              />
            </View>
            {statusMsg !== "" && (
              <Text style={[styles.statusText, { color: perfilTipo === '' ? CORES.rosa : CORES.sucesso }]}>
                {statusMsg}
              </Text>
            )}

            {/* Linha de Senhas */}
            <View style={styles.inputBox}>
              <MaterialIcons name="lock-outline" size={20} color={CORES.textoSecundario} style={styles.inputIcon} />
              <TextInput 
                style={styles.input} 
                placeholder="Senha" 
                placeholderTextColor={CORES.textoSecundario}
                onChangeText={setSenha} 
                secureTextEntry 
                value={senha} 
              />
            </View>

            <View style={styles.inputBox}>
              <MaterialIcons name="lock-outline" size={20} color={CORES.textoSecundario} style={styles.inputIcon} />
              <TextInput 
                style={styles.input} 
                placeholder="Confirmar senha" 
                placeholderTextColor={CORES.textoSecundario}
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
                  placeholderTextColor={CORES.textoSecundario}
                  value={ra} 
                  onChangeText={setRa} 
                  editable={perfilTipo !== 'Administrador'} 
                />
              </View>

              <TouchableOpacity 
                style={[styles.inputBox, { flex: 1, justifyContent: 'center', paddingLeft: 15 }, perfilTipo === 'Administrador' && styles.disabledInput]}
                onPress={() => setShowSerieModal(true)}
                disabled={perfilTipo === 'Administrador'}
              >
                <Text style={[styles.inputText, !serie && { color: CORES.textoSecundario }]}>
                  {serie || "Série"}
                </Text>
                <Ionicons name="chevron-down" size={18} color={CORES.textoSecundario} style={styles.iconRight} />
              </TouchableOpacity>
            </View>

            {/* Turma/Indicação */}
            <TouchableOpacity 
              style={[styles.inputBox, perfilTipo === 'Administrador' && styles.disabledInput, { justifyContent: 'center' }]}
              onPress={() => setShowIndicacaoModal(true)}
              disabled={perfilTipo === 'Administrador'}
            >
              <Text style={[styles.inputText, !indicacao && { color: CORES.textoSecundario }]}>
                {indicacao || "Indicação (Curso/Turma)"}
              </Text>
              <Ionicons name="chevron-down" size={18} color={CORES.textoSecundario} style={styles.iconRight} />
            </TouchableOpacity>

          </View>

          {/* Rodapé com botão fixo visualmente */}
          <View style={styles.footer}>
            <Text style={styles.termsText}>
              Ao se inscrever, você concorda com nossos{' '}
              <Text style={{color: CORES.rosa, fontWeight: 'bold'}}>Termos de Serviço</Text> e{' '}
              <Text style={{color: CORES.rosa, fontWeight: 'bold'}}>Política de Privacidade</Text>.
            </Text>
            
            <TouchableOpacity 
              style={[styles.btnAction, loading && { opacity: 0.7 }]} 
              onPress={handleSignUp}
              disabled={loading}
            >
              {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.btnText}>Criar Conta</Text>}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => navigation.navigate('Login')} style={styles.loginLink}>
              <Text style={styles.loginText}>Já tem uma conta? <Text style={styles.linkDestaque}>Entrar</Text></Text>
            </TouchableOpacity>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>

      {/* Modais Customizados */}
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

// Componente Modal Estilizado
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
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.modalItem} onPress={() => onSelect(item)}>
              <Text style={styles.modalItemText}>{item}</Text>
              <Ionicons name="radio-button-off" size={20} color={CORES.rosa} opacity={0.5} />
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
  container: { flex: 1, backgroundColor: CORES.fundo },

  // Decoração de Fundo (Bolhas)
  blobTopRight: {
    position: 'absolute',
    top: -50,
    right: -50,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(233, 30, 99, 0.05)', // Rosa suave
  },
  blobBottomLeft: {
    position: 'absolute',
    bottom: -30,
    left: -80,
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: 'rgba(255, 193, 7, 0.08)', // Amarelo suave
  },

  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between',
    paddingHorizontal: 20, 
    height: 60,
    marginTop: Platform.OS === 'android' ? 10 : 0,
  },
  backBtn: { padding: 5 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: CORES.azulEscuro },
  
  scrollContent: { paddingHorizontal: 30, paddingBottom: 40 },
  
  headerTextContainer: {
    marginTop: 10,
    marginBottom: 25,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: CORES.azulEscuro,
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 15,
    color: CORES.textoSecundario,
  },

  formContainer: { marginTop: 10 },
  
  // Design de Input Arredondado (Pill)
  inputBox: {
    width: '100%',
    height: 55,
    backgroundColor: CORES.inputBg,
    borderRadius: 25,
    marginBottom: 15,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, fontSize: 15, color: CORES.azulEscuro, height: '100%' },
  inputText: { fontSize: 15, color: CORES.azulEscuro },
  
  disabledInput: { opacity: 0.5 },
  iconRight: { position: 'absolute', right: 20 },
  
  statusText: { fontSize: 13, fontWeight: '700', marginTop: -8, marginBottom: 15, marginLeft: 15 },
  row: { flexDirection: 'row', gap: 12 },

  // Botão e Rodapé
  footer: { marginTop: 25 },
  termsText: { fontSize: 13, color: CORES.textoSecundario, lineHeight: 20, marginBottom: 25, textAlign: 'center', paddingHorizontal: 10 },
  
  btnAction: { 
    backgroundColor: CORES.rosa, 
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
  btnText: { color: '#FFF', fontWeight: '800', fontSize: 17 },
  
  loginLink: { marginTop: 25, alignItems: 'center' },
  loginText: { color: CORES.textoSecundario, fontSize: 15, fontWeight: '500' },
  linkDestaque: { color: CORES.amarelo, fontWeight: '800' },

  // Estilo Modais
  modalOverlay: { flex: 1, backgroundColor: 'rgba(26, 26, 46, 0.6)', justifyContent: 'flex-end' },
  modalContent: { 
    backgroundColor: '#FFF', 
    borderTopLeftRadius: 30, 
    borderTopRightRadius: 30, 
    padding: 25, 
    maxHeight: '60%',
    paddingBottom: Platform.OS === 'ios' ? 40 : 25,
  },
  modalHeader: { paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: CORES.inputBg, marginBottom: 10 },
  modalTitle: { fontSize: 20, fontWeight: '800', textAlign: 'center', color: CORES.azulEscuro },
  
  modalItem: { 
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 18, 
    borderBottomWidth: 1, 
    borderBottomColor: CORES.inputBg 
  },
  modalItemText: { fontSize: 16, color: CORES.azulEscuro, fontWeight: '600' },
  
  modalCloseBtn: { 
    marginTop: 20, 
    paddingVertical: 16, 
    backgroundColor: CORES.inputBg, 
    borderRadius: 25, 
    alignItems: 'center' 
  },
  modalCloseBtnText: { fontWeight: '800', color: CORES.azulEscuro, fontSize: 16 }
});