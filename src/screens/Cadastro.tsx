import React, { useState, useEffect } from 'react';
import {
  StyleSheet, Text, View, TextInput, TouchableOpacity,
  ScrollView, KeyboardAvoidingView,
  Platform, Modal, FlatList, ActivityIndicator, StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { auth, db } from '../config/firebaseConfig';
import { createUserWithEmailAndPassword, sendEmailVerification, signOut } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { CORES_SYMBIUS } from './Boasvindas';
import { notificarAdmins } from '../services/pushNotificationsService';
import { F } from '../constants/theme';

type Papel = 'aprender' | 'ensinar';

const OPCOES_PAPEL: { valor: Papel; titulo: string; sub: string; icone: any }[] = [
  { valor: 'aprender', titulo: 'Aluno',  sub: 'Quero aprender', icone: 'book-outline' },
  { valor: 'ensinar',  titulo: 'Mentor', sub: 'Quero ensinar',  icone: 'school-outline' },
];

export default function Cadastro({ navigation, route }: any) {
  const insets = useSafeAreaInsets();
  // Tag de comunidade (selo no perfil + filtro do ranking). Não é tipo de conta:
  // `tipo` continua sendo 'Aluno'/'Administrador', detectado pelo e-mail.
  const [papel, setPapel] = useState<Papel>(route?.params?.papel === 'ensinar' ? 'ensinar' : 'aprender');
  const [nome,          setNome]          = useState('');
  const [email,         setEmail]         = useState('');
  const [senha,         setSenha]         = useState('');
  const [confirmaSenha, setConfirmaSenha] = useState('');
  const [verSenha,      setVerSenha]      = useState(false);
  const [verConfirma,   setVerConfirma]   = useState(false);
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
    'ADM A', 'ADM B',
  ];

  useEffect(() => {
    if (toastMsg !== '') {
      const t = setTimeout(() => setToastMsg(''), 3000);
      return () => clearTimeout(t);
    }
  }, [toastMsg]);

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
    if (!perfilTipo) { setToastMsg('E-mail institucional inválido.'); return; }
    if (!nome || !email || !senha || !confirmaSenha) { setToastMsg('Preencha todos os campos obrigatórios.'); return; }
    if (perfilTipo === 'Aluno' && (!serie || !indicacao)) { setToastMsg('Selecione série e turma.'); return; }
    if (senha.length < 6) { setToastMsg('A senha precisa ter pelo menos 6 caracteres.'); return; }
    if (senha !== confirmaSenha) { setToastMsg('As senhas não coincidem.'); return; }

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
      const emailNormalizado = email.trim().toLowerCase();
      const userCredential = await createUserWithEmailAndPassword(auth, emailNormalizado, senha);
      const user = userCredential.user;
      await sendEmailVerification(user);

      const identificador = perfilTipo === 'Aluno' ? (ra || emailNormalizado) : emailNormalizado;

      await setDoc(doc(db, 'usuarios', user.uid), {
        uid: user.uid,
        nome_completo: nome.trim(),
        email_escolar: emailNormalizado,
        ra: ra || 'N/A',
        identificador,
        turma: turmaFormatada,
        tipo: perfilTipo,
        status: 0, // 0 = aguardando verificação de email
        data_criacao: new Date().toISOString(),
        posso_ensinar: [],
        quer_aprender: [],
        papel_comunidade: papel,
        foto_url: '',
        bio: '',
        medalhas_visiveis: [],
        ajudas: 0,
        statusOnline: false,
        visibilidade: true,
      });

      // Ainda logado aqui (createUser loga sozinho), então dá pra chamar o backend.
      await notificarAdmins('nova_conta');

      // createUser já deixa a pessoa logada; o acesso de verdade é pelo Login.
      await signOut(auth);

      setLoading(false);
      setPopupOk(true);
      setTimeout(() => {
        setPopupOk(false);
        navigation.navigate('Login');
      }, 1800);
    } catch (error: any) {
      setLoading(false);
      console.error('Erro ao cadastrar:', error);
      if (error.code === 'auth/email-already-in-use') setToastMsg('Este e-mail já está registrado.');
      else if (error.code === 'auth/weak-password') setToastMsg('Senha fraca. Use pelo menos 6 caracteres.');
      else if (error.code === 'auth/invalid-email') setToastMsg('E-mail inválido.');
      else setToastMsg('Erro ao cadastrar. Tente novamente.');
    }
  };

  const campoSenha = (valor: string, setValor: (v: string) => void, visivel: boolean, setVisivel: (v: boolean) => void) => (
    <View style={styles.senhaWrap}>
      <TextInput
        style={[styles.input, { paddingRight: 50 }]}
        placeholder="Digite aqui..."
        placeholderTextColor={CORES_SYMBIUS.textoTerciario}
        value={valor}
        onChangeText={setValor}
        secureTextEntry={!visivel}
        autoCapitalize="none"
      />
      <TouchableOpacity
        style={styles.olhoBtn}
        onPress={() => setVisivel(!visivel)}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        accessibilityLabel={visivel ? 'Ocultar senha' : 'Mostrar senha'}
      >
        <Ionicons name={visivel ? 'eye-off-outline' : 'eye-outline'} size={22} color={CORES_SYMBIUS.textoSec} />
      </TouchableOpacity>
    </View>
  );

  const desabilitaTurma = perfilTipo === 'Administrador';

  return (
    <View style={styles.container}>
      <StatusBar barStyle={CORES_SYMBIUS.barStyle} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>

        {toastMsg !== '' && (
          <View style={styles.toast}>
            <Text style={styles.toastText}>{toastMsg}</Text>
          </View>
        )}

        <View style={[styles.header, { paddingTop: insets.top + 22 }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="arrow-back" size={22} color={CORES_SYMBIUS.texto} />
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.logoWrap}>
            <Text style={styles.logoText}>Simbio</Text>
            <Text style={styles.logoSlogan}>crie sua conta</Text>
          </View>

          <View style={styles.card}>
            {/* PAPEL */}
            <Text style={styles.fieldLabel}>Como você quer participar?</Text>
            <View style={styles.papelRow}>
              {OPCOES_PAPEL.map(op => {
                const ativo = papel === op.valor;
                return (
                  <TouchableOpacity
                    key={op.valor}
                    style={[styles.papelCard, ativo && styles.papelCardAtivo]}
                    onPress={() => setPapel(op.valor)}
                    activeOpacity={0.85}
                  >
                    <Ionicons name={op.icone} size={20} color={ativo ? CORES_SYMBIUS.creme : CORES_SYMBIUS.verdeEscuro} />
                    <Text style={[styles.papelTitulo, ativo && { color: CORES_SYMBIUS.creme }]}>{op.titulo}</Text>
                    <Text style={[styles.papelSub, ativo && { color: CORES_SYMBIUS.creme, opacity: 0.8 }]}>{op.sub}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={styles.papelNota}>Dá pra trocar depois no seu perfil.</Text>

            <Text style={styles.fieldLabel}>Nome:</Text>
            <TextInput
              style={styles.input}
              placeholder="Digite aqui..."
              placeholderTextColor={CORES_SYMBIUS.textoTerciario}
              value={nome}
              onChangeText={setNome}
            />

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
            {statusMsg !== '' && (
              <Text style={[styles.statusText, { color: perfilTipo === '' ? '#C0392B' : CORES_SYMBIUS.sucesso }]}>
                {statusMsg}
              </Text>
            )}

            <Text style={styles.fieldLabel}>Senha:</Text>
            {campoSenha(senha, setSenha, verSenha, setVerSenha)}

            <Text style={styles.fieldLabel}>Confirmar senha:</Text>
            {campoSenha(confirmaSenha, setConfirmaSenha, verConfirma, setVerConfirma)}

            <Text style={styles.fieldLabel}>Série:</Text>
            <TouchableOpacity
              style={[styles.input, styles.selectInput, desabilitaTurma && { opacity: 0.5 }]}
              onPress={() => setShowSerieModal(true)}
              disabled={desabilitaTurma}
              activeOpacity={0.7}
            >
              <Text style={[styles.selectText, !serie && { color: CORES_SYMBIUS.textoTerciario }]}>
                {serie || 'Selecione...'}
              </Text>
              <Ionicons name="chevron-down" size={18} color={CORES_SYMBIUS.textoSec} />
            </TouchableOpacity>

            <Text style={styles.fieldLabel}>Turma:</Text>
            <TouchableOpacity
              style={[styles.input, styles.selectInput, desabilitaTurma && { opacity: 0.5 }]}
              onPress={() => setShowIndicacaoModal(true)}
              disabled={desabilitaTurma}
              activeOpacity={0.7}
            >
              <Text style={[styles.selectText, !indicacao && { color: CORES_SYMBIUS.textoTerciario }]}>
                {indicacao || 'Selecione...'}
              </Text>
              <Ionicons name="chevron-down" size={18} color={CORES_SYMBIUS.textoSec} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.btnCriar, loading && { opacity: 0.6 }]}
              onPress={handleSignUp}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color={CORES_SYMBIUS.creme} />
                : <Text style={styles.btnCriarText}>Criar Conta</Text>}
            </TouchableOpacity>
          </View>

          <TouchableOpacity onPress={() => navigation.navigate('Login')} style={styles.loginLink}>
            <Text style={styles.loginText}>
              Já tem uma conta? <Text style={{ color: CORES_SYMBIUS.verdeEscuro, fontFamily: F.bold }}>Entrar</Text>
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={popupOk} transparent animationType="fade">
        <View style={styles.popupOverlay}>
          <View style={styles.popupBox}>
            <View style={styles.popupIcon}>
              <Ionicons name="checkmark" size={40} color={CORES_SYMBIUS.creme} />
            </View>
            <Text style={styles.popupTitle}>Conta criada!</Text>
            <Text style={styles.popupSub}>Verifique seu e-mail para confirmar.</Text>
          </View>
        </View>
      </Modal>

      <SelectionModal
        visible={showSerieModal}
        data={listaSeries}
        onSelect={(v: string) => { setSerie(v); setShowSerieModal(false); }}
        onClose={() => setShowSerieModal(false)}
        title="Selecione sua Série"
      />
      <SelectionModal
        visible={showIndicacaoModal}
        data={listaIndicacoes}
        onSelect={(v: string) => { setIndicacao(v); setShowIndicacaoModal(false); }}
        onClose={() => setShowIndicacaoModal(false)}
        title="Selecione sua Turma"
      />
    </View>
  );
}

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
              <Ionicons name="chevron-forward" size={18} color={CORES_SYMBIUS.textoSec} />
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
  container: { flex: 1, backgroundColor: CORES_SYMBIUS.fundo },
  header:    { paddingHorizontal: 20, paddingBottom: 4 },
  scroll:    { flexGrow: 1, alignItems: 'center', paddingHorizontal: 24, paddingTop: 4, paddingBottom: 40 },

  toast: {
    position: 'absolute', top: 50, alignSelf: 'center',
    backgroundColor: CORES_SYMBIUS.verdeEscuro, paddingVertical: 12, paddingHorizontal: 24,
    borderRadius: 24, zIndex: 999, elevation: 5,
  },
  toastText: { color: CORES_SYMBIUS.creme, fontFamily: F.bold, fontSize: 14 },

  logoWrap:   { marginBottom: 24, alignItems: 'center' },
  logoText:   { fontSize: 36, fontFamily: F.bold, letterSpacing: -0.5, color: CORES_SYMBIUS.verdeEscuro },
  logoSlogan: { fontSize: 13, color: CORES_SYMBIUS.textoSec, fontFamily: F.semibold, marginTop: 2 },

  card: {
    width: '100%',
    backgroundColor: CORES_SYMBIUS.fundoSuave,
    borderRadius: 28,
    padding: 24,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 20, shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },

  papelRow:       { flexDirection: 'row', gap: 10, marginBottom: 6 },
  papelCard: {
    flex: 1, borderRadius: 18, paddingVertical: 14, paddingHorizontal: 12,
    backgroundColor: CORES_SYMBIUS.fundoCard, borderWidth: 1.5, borderColor: CORES_SYMBIUS.borda2,
    alignItems: 'center', gap: 2,
  },
  papelCardAtivo: { backgroundColor: CORES_SYMBIUS.verdeEscuro, borderColor: CORES_SYMBIUS.verdeEscuro },
  papelTitulo:    { fontSize: 15, fontFamily: F.bold, color: CORES_SYMBIUS.texto, marginTop: 4 },
  papelSub:       { fontSize: 11, fontFamily: F.medium, color: CORES_SYMBIUS.textoSec },
  papelNota:      { fontSize: 11, fontFamily: F.medium, color: CORES_SYMBIUS.textoMuted, textAlign: 'center', marginBottom: 18 },

  fieldLabel: { fontSize: 14, fontFamily: F.bold, color: CORES_SYMBIUS.texto, marginBottom: 8 },
  input: {
    backgroundColor: CORES_SYMBIUS.fundoCard,
    borderRadius: 16, borderWidth: 1, borderColor: CORES_SYMBIUS.borda,
    paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 15, fontFamily: F.regular, color: CORES_SYMBIUS.texto,
    marginBottom: 16,
  },
  senhaWrap:   { position: 'relative' },
  olhoBtn:     { position: 'absolute', right: 14, top: 14 },
  selectInput: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  selectText:  { fontSize: 15, fontFamily: F.regular, color: CORES_SYMBIUS.texto },
  statusText:  { fontSize: 12, fontFamily: F.bold, marginTop: -10, marginBottom: 12, marginLeft: 4 },

  btnCriar: {
    backgroundColor: CORES_SYMBIUS.verdeEscuro, borderRadius: 18, paddingVertical: 16,
    alignItems: 'center', marginTop: 8, elevation: 3,
    shadowColor: CORES_SYMBIUS.verdeEscuro, shadowOpacity: 0.15, shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
  },
  btnCriarText: { color: CORES_SYMBIUS.creme, fontSize: 16, fontFamily: F.bold, letterSpacing: 0.5 },

  loginLink: { marginTop: 20, alignItems: 'center' },
  loginText: { color: CORES_SYMBIUS.textoSec, fontSize: 14, fontFamily: F.medium },

  popupOverlay: { flex: 1, backgroundColor: 'rgba(26,26,26,0.5)', justifyContent: 'center', alignItems: 'center' },
  popupBox:     { backgroundColor: CORES_SYMBIUS.fundoCard, borderRadius: 24, padding: 30, alignItems: 'center', width: 260 },
  popupIcon:    { width: 70, height: 70, borderRadius: 35, backgroundColor: CORES_SYMBIUS.verdeEscuro, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  popupTitle:   { fontSize: 18, fontFamily: F.black, color: CORES_SYMBIUS.texto, marginBottom: 6 },
  popupSub:     { fontSize: 13, fontFamily: F.regular, color: CORES_SYMBIUS.textoSec, textAlign: 'center' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(26,26,26,0.5)', justifyContent: 'flex-end' },
  modalSheet:   { backgroundColor: CORES_SYMBIUS.fundoCard, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 24, maxHeight: '60%' },
  modalHandle:  { width: 40, height: 4, backgroundColor: CORES_SYMBIUS.borda2, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  modalTitle:   { fontSize: 18, fontFamily: F.black, textAlign: 'center', color: CORES_SYMBIUS.texto, marginBottom: 12 },
  modalItem:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: CORES_SYMBIUS.borda },
  modalItemText:{ fontSize: 15, color: CORES_SYMBIUS.texto, fontFamily: F.semibold },
  modalClose:   { marginTop: 16, paddingVertical: 14, backgroundColor: CORES_SYMBIUS.fundoSuave, borderRadius: 14, alignItems: 'center' },
  modalCloseText:{ fontFamily: F.bold, color: CORES_SYMBIUS.texto, fontSize: 15 },
});
