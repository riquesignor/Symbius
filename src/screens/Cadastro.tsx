import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, Text, View, TextInput, TouchableOpacity, 
  ScrollView, SafeAreaView, KeyboardAvoidingView, 
  Platform, Modal, FlatList, ActivityIndicator
} from 'react-native';
import { cadastrarNoJumo } from '../services/authService'; 
import { Ionicons } from '@expo/vector-icons';

// Paleta JUMO
const CORES = {
  azulEscuro:      '#1A1A2E',
  rosa:            '#E91E63',
  amarelo:         '#FFC107',
  fundo:           '#EFEFEF',
  cardCinza:       '#F5F5F5',
  inputBranco:     '#FFFFFF',
  borda:           '#E0E0E0',
  textoSecundario: '#BBBFC4',
  sucesso:         '#10B981',
};

export default function Cadastro({ navigation }: any) {
  const [nome,          setNome]          = useState('');
  const [email,         setEmail]         = useState('');
  const [senha,         setSenha]         = useState('');
  const [confirmaSenha, setConfirmaSenha] = useState('');
  const [serie,         setSerie]         = useState('');
  const [indicacao,     setIndicacao]     = useState('');
  const [ra,            setRa]            = useState('');

  const [statusMsg,  setStatusMsg]  = useState('');
  const [perfilTipo, setPerfilTipo] = useState('');
  const [loading,    setLoading]    = useState(false);
  const [toastMsg,   setToastMsg]   = useState('');
  const [popupOk,    setPopupOk]    = useState(false);

  const [showSerieModal,     setShowSerieModal]     = useState(false);
  const [showIndicacaoModal, setShowIndicacaoModal] = useState(false);

  const listaSeries = ['1º ANO', '2º ANO', '3º ANO'];
  const listaIndicacoes = [
    'REGULAR A', 'REGULAR B', 'REGULAR C',
    'INFO A', 'INFO B', 'INFO C',
    'NUTRI A', 'NUTRI B',
    'DESIGN A', 'DESIGN B',
    'ADM A', 'ADM B'
  ];

  // ✅ Toast some sozinho
  useEffect(() => {
    if (toastMsg !== '') {
      const t = setTimeout(() => setToastMsg(''), 3000);
      return () => clearTimeout(t);
    }
  }, [toastMsg]);

  // ✅ Detecção de perfil pelo email
  useEffect(() => {
    const emailLower = email.trim().toLowerCase();
    if (emailLower.length > 5) {
      if (emailLower.endsWith('@escolas.anchieta.br')) {
        setStatusMsg('✓ Perfil Aluno detectado');
        setPerfilTipo('Aluno');
        const prefixo = emailLower.split('@')[0];
        if (!prefixo.includes('.')) setRa(prefixo.toUpperCase());
      } else if (emailLower.endsWith('@anchieta.br')) {
        setStatusMsg('✓ Perfil Administrativo detectado');
        setPerfilTipo('Administrador');
        setRa('N/A'); setSerie('N/A'); setIndicacao('N/A');
      } else {
        setStatusMsg('Use apenas e-mail @anchieta');
        setPerfilTipo('');
      }
    } else {
      setStatusMsg('');
      setPerfilTipo('');
    }
  }, [email]);

  const handleSignUp = async () => {
    if (!perfilTipo) {
      setToastMsg('E-mail institucional inválido.');
      return;
    }
    if (!nome || !email || !senha || !confirmaSenha) {
      setToastMsg('Preencha todos os campos obrigatórios.');
      return;
    }
    if (perfilTipo === 'Aluno' && (!serie || !indicacao)) {
      setToastMsg('Selecione série e turma.');
      return;
    }
    if (senha.length < 6) {
      setToastMsg('A senha precisa ter pelo menos 6 caracteres.');
      return;
    }
    if (senha !== confirmaSenha) {
      setToastMsg('As senhas não coincidem.');
      return;
    }

    setLoading(true);

    let turmaFormatada = 'N/A';
    if (perfilTipo === 'Aluno' && serie && indicacao) {
      const numeroSerie = serie.replace(' ANO', '');
      const partes = indicacao.split(' ');
      const curso = partes[0].charAt(0).toUpperCase() + partes[0].slice(1).toLowerCase();
      const letra = partes[1] || '';
      turmaFormatada = `${numeroSerie} - ${curso} - ${letra}`;
    }

    try {
      await cadastrarNoJumo(email, senha, nome, ra, turmaFormatada, perfilTipo);
      setLoading(false);
      setPopupOk(true);
      setTimeout(() => {
        setPopupOk(false);
        navigation.navigate('Login');
      }, 1800);
    } catch (error: any) {
      setLoading(false);
      setToastMsg(error?.message || 'Erro ao cadastrar. Tente novamente.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>

        {/* TOAST */}
        {toastMsg !== '' && (
          <View style={styles.toast}>
            <Text style={styles.toastText}>{toastMsg}</Text>
          </View>
        )}

        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >

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

            {/* NOME */}
            <Text style={styles.fieldLabel}>Nome:</Text>
            <TextInput
              style={styles.input}
              placeholder="Digite aqui..."
              placeholderTextColor={CORES.textoSecundario}
              value={nome}
              onChangeText={setNome}
            />

            {/* EMAIL */}
            <Text style={styles.fieldLabel}>Email:</Text>
            <TextInput
              style={styles.input}
              placeholder="Digite aqui..."
              placeholderTextColor={CORES.textoSecundario}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />

            {statusMsg !== '' && (
              <Text style={[
                styles.statusText,
                { color: perfilTipo === '' ? CORES.rosa : CORES.sucesso }
              ]}>
                {statusMsg}
              </Text>
            )}

            {/* SENHA */}
            <Text style={styles.fieldLabel}>Senha:</Text>
            <TextInput
              style={styles.input}
              placeholder="Digite aqui..."
              placeholderTextColor={CORES.textoSecundario}
              value={senha}
              onChangeText={setSenha}
              secureTextEntry
            />

            {/* CONFIRMAR SENHA */}
            <Text style={styles.fieldLabel}>Confirmar senha:</Text>
            <TextInput
              style={styles.input}
              placeholder="Digite aqui..."
              placeholderTextColor={CORES.textoSecundario}
              value={confirmaSenha}
              onChangeText={setConfirmaSenha}
              secureTextEntry
            />

            {/* SÉRIE */}
            <Text style={styles.fieldLabel}>Série:</Text>
            <TouchableOpacity
              style={[styles.input, styles.selectInput, perfilTipo === 'Administrador' && { opacity: 0.5 }]}
              onPress={() => setShowSerieModal(true)}
              disabled={perfilTipo === 'Administrador'}
              activeOpacity={0.7}
            >
              <Text style={[styles.selectText, !serie && { color: CORES.textoSecundario }]}>
                {serie || 'Digite aqui...'}
              </Text>
              <Ionicons name="chevron-down" size={18} color={CORES.textoSecundario} />
            </TouchableOpacity>

            {/* TURMA */}
            <Text style={styles.fieldLabel}>Turma:</Text>
            <TouchableOpacity
              style={[styles.input, styles.selectInput, perfilTipo === 'Administrador' && { opacity: 0.5 }]}
              onPress={() => setShowIndicacaoModal(true)}
              disabled={perfilTipo === 'Administrador'}
              activeOpacity={0.7}
            >
              <Text style={[styles.selectText, !indicacao && { color: CORES.textoSecundario }]}>
                {indicacao || 'Digite aqui...'}
              </Text>
              <Ionicons name="chevron-down" size={18} color={CORES.textoSecundario} />
            </TouchableOpacity>

            {/* BOTÃO */}
            <TouchableOpacity
              style={[styles.btnCriar, loading && { opacity: 0.6 }]}
              onPress={handleSignUp}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color={CORES.azulEscuro} />
                : <Text style={styles.btnCriarText}>Criar Conta</Text>
              }
            </TouchableOpacity>

          </View>

          {/* LINK LOGIN */}
          <TouchableOpacity onPress={() => navigation.navigate('Login')} style={styles.loginLink}>
            <Text style={styles.loginText}>
              Já tem uma conta? <Text style={{ color: CORES.rosa, fontWeight: '800' }}>Entrar</Text>
            </Text>
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>

      {/* POPUP DE SUCESSO */}
      <Modal visible={popupOk} transparent animationType="fade">
        <View style={styles.popupOverlay}>
          <View style={styles.popupBox}>
            <View style={styles.popupIcon}>
              <Ionicons name="checkmark" size={40} color="#FFF" />
            </View>
            <Text style={styles.popupTitle}>Conta criada!</Text>
            <Text style={styles.popupSub}>Verifique seu e-mail para confirmar.</Text>
          </View>
        </View>
      </Modal>

      {/* MODAL SÉRIE */}
      <SelectionModal
        visible={showSerieModal}
        data={listaSeries}
        onSelect={(v: string) => { setSerie(v); setShowSerieModal(false); }}
        onClose={() => setShowSerieModal(false)}
        title="Selecione sua Série"
      />

      {/* MODAL TURMA */}
      <SelectionModal
        visible={showIndicacaoModal}
        data={listaIndicacoes}
        onSelect={(v: string) => { setIndicacao(v); setShowIndicacaoModal(false); }}
        onClose={() => setShowIndicacaoModal(false)}
        title="Selecione sua Turma"
      />

    </SafeAreaView>
  );
}

// ─── Modal Reutilizável (FORA da função, então não tem o bug) ───
const SelectionModal = ({ visible, data, onSelect, onClose, title }: any) => (
  <Modal visible={visible} transparent animationType="slide">
    <View style={styles.modalOverlay}>
      <View style={styles.modalSheet}>
        <View style={styles.modalHandle} />
        <Text style={styles.modalTitle}>{title}</Text>
        <FlatList
          data={data}
          keyExtractor={item => item}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.modalItem} onPress={() => onSelect(item)}>
              <Text style={styles.modalItemText}>{item}</Text>
              <Ionicons name="chevron-forward" size={18} color={CORES.textoSecundario} />
            </TouchableOpacity>
          )}
        />
        <TouchableOpacity style={styles.modalClose} onPress={onClose}>
          <Text style={styles.modalCloseText}>Fechar</Text>
        </TouchableOpacity>
      </View>
    </View>
  </Modal>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: CORES.fundo },
  scroll:    { flexGrow: 1, alignItems: 'center', paddingHorizontal: 28, paddingTop: 30, paddingBottom: 40 },

  // TOAST
  toast: {
    position: 'absolute', top: 20, alignSelf: 'center',
    backgroundColor: CORES.rosa, paddingVertical: 12, paddingHorizontal: 24,
    borderRadius: 24, zIndex: 999, elevation: 5,
  },
  toastText: { color: '#FFF', fontWeight: 'bold', fontSize: 14 },

  // LOGO
  logoWrap:  { position: 'relative', marginBottom: 28, alignItems: 'center' },
  logoDot:   { position: 'absolute', top: 2, left: 1, width: 9, height: 9, borderRadius: 5, backgroundColor: CORES.amarelo, zIndex: 10 },
  logoText:  { fontSize: 44, fontWeight: '900', letterSpacing: -1 },
  logoJum:   { color: CORES.azulEscuro },
  logoO:     { color: CORES.rosa },

  // CARD
  card: {
    width: '100%',
    backgroundColor: CORES.cardCinza,
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },

  // CAMPOS
  fieldLabel: { fontSize: 15, fontWeight: '700', color: CORES.azulEscuro, marginBottom: 6, marginTop: 4 },
  input: {
    backgroundColor: CORES.inputBranco,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: CORES.borda,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: CORES.azulEscuro,
    marginBottom: 14,
  },
  selectInput: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  selectText:  { fontSize: 15, color: CORES.azulEscuro },
  statusText:  { fontSize: 12, fontWeight: '700', marginTop: -10, marginBottom: 12, marginLeft: 4 },

  // BOTÃO
  btnCriar: {
    backgroundColor: CORES.fundo,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 10,
    borderWidth: 1.5,
    borderColor: '#D0D0D0',
  },
  btnCriarText: { color: CORES.azulEscuro, fontSize: 16, fontWeight: '700' },

  loginLink: { marginTop: 20, alignItems: 'center' },
  loginText: { color: '#8D99AE', fontSize: 14, fontWeight: '500' },

  // POPUP SUCESSO
  popupOverlay: { flex: 1, backgroundColor: 'rgba(26,26,46,0.6)', justifyContent: 'center', alignItems: 'center' },
  popupBox:     { backgroundColor: '#FFF', borderRadius: 24, padding: 30, alignItems: 'center', width: 260 },
  popupIcon:    { width: 70, height: 70, borderRadius: 35, backgroundColor: CORES.sucesso, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  popupTitle:   { fontSize: 18, fontWeight: '900', color: CORES.azulEscuro, marginBottom: 6 },
  popupSub:     { fontSize: 13, color: '#8D99AE', textAlign: 'center' },

  // MODAIS DE SELEÇÃO
  modalOverlay: { flex: 1, backgroundColor: 'rgba(26,26,46,0.5)', justifyContent: 'flex-end' },
  modalSheet:   { backgroundColor: '#FFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 24, maxHeight: '60%' },
  modalHandle:  { width: 40, height: 4, backgroundColor: '#E0E0E0', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  modalTitle:   { fontSize: 18, fontWeight: '900', textAlign: 'center', color: CORES.azulEscuro, marginBottom: 12 },
  modalItem:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  modalItemText:{ fontSize: 15, color: CORES.azulEscuro, fontWeight: '600' },
  modalClose:   { marginTop: 16, paddingVertical: 14, backgroundColor: CORES.fundo, borderRadius: 14, alignItems: 'center' },
  modalCloseText:{ fontWeight: '800', color: CORES.azulEscuro, fontSize: 15 },
});