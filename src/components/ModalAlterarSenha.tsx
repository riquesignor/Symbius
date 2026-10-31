import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Modal, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { auth } from '../config/firebaseConfig';
import { CORES_SYMBIUS } from '../constants/coresSymbius';
import { F } from '../constants/theme';

// Troca de senha (pede a senha atual: o Firebase exige login recente pra isso).
// Ficava nas Configurações; agora tudo da conta fica no Perfil.
interface Props { visivel: boolean; onFechar: () => void; onSucesso?: () => void }

const ModalAlterarSenha: React.FC<Props> = ({ visivel, onFechar, onSucesso }) => {
  const insets = useSafeAreaInsets();
  const [senhaAtual, setSenhaAtual] = useState('');
  const [senhaNova, setSenhaNova] = useState('');
  const [senhaConfirma, setSenhaConfirma] = useState('');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  const fechar = () => {
    setSenhaAtual(''); setSenhaNova(''); setSenhaConfirma(''); setErro('');
    onFechar();
  };

  const salvar = async () => {
    setErro('');
    if (!senhaAtual || !senhaNova || !senhaConfirma) { setErro('Preencha todos os campos.'); return; }
    if (senhaNova.length < 6) { setErro('A nova senha deve ter no mínimo 6 caracteres.'); return; }
    if (senhaNova !== senhaConfirma) { setErro('As senhas não coincidem.'); return; }
    setSalvando(true);
    try {
      const user = auth.currentUser;
      if (!user || !user.email) throw new Error('no-user');
      await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, senhaAtual));
      await updatePassword(user, senhaNova);
      fechar();
      onSucesso?.();
    } catch (e: any) {
      console.error('Erro ao alterar senha:', e?.code, e?.message);
      const code = e?.code || '';
      if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') setErro('Senha atual incorreta.');
      else if (code === 'auth/weak-password') setErro('A nova senha é muito fraca. Escolha uma mais segura.');
      else if (code === 'auth/too-many-requests') setErro('Muitas tentativas. Aguarde alguns minutos e tente novamente.');
      else if (code === 'auth/network-request-failed') setErro('Erro de conexão. Verifique sua internet e tente novamente.');
      else if (e?.message === 'no-user') setErro('Usuário não autenticado. Feche o app, faça login novamente e tente outra vez.');
      else setErro(`Erro ao alterar senha: ${e?.message || code || 'Tente novamente.'}`);
    } finally {
      setSalvando(false);
    }
  };

  const campo = (label: string, placeholder: string, valor: string, mudar: (v: string) => void, primeiro = false) => (
    <>
      <Text style={[styles.label, !primeiro && { marginTop: 14 }]}>{label}</Text>
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor={CORES_SYMBIUS.textoSec}
        secureTextEntry
        value={valor}
        onChangeText={mudar}
      />
    </>
  );

  return (
    <Modal visible={visivel} transparent animationType="slide" onRequestClose={fechar}>
      <View style={styles.overlay}>
        {/* fundo ao lado do quadro (não em volta): clicar num campo não fecha */}
        <Pressable style={StyleSheet.absoluteFill} onPress={fechar} accessibilityLabel="Fechar" />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 24 }]}>
          <View style={styles.handle} />
          <Text style={styles.titulo}>Alterar senha</Text>

          {campo('SENHA ATUAL', 'Digite sua senha atual', senhaAtual, setSenhaAtual, true)}
          {campo('NOVA SENHA', 'Mínimo 6 caracteres', senhaNova, setSenhaNova)}
          {campo('CONFIRMAR NOVA SENHA', 'Repita a nova senha', senhaConfirma, setSenhaConfirma)}

          {erro !== '' && (
            <View style={styles.erroBox}>
              <Ionicons name="alert-circle" size={14} color="#D64545" />
              <Text style={styles.erroTxt}>{erro}</Text>
            </View>
          )}

          <View style={styles.botoes}>
            <TouchableOpacity style={styles.btnCancelar} onPress={fechar}>
              <Text style={styles.btnCancelarTxt}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnSalvar} onPress={salvar} disabled={salvando}>
              {salvando ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={styles.btnSalvarTxt}>Salvar</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 22, backgroundColor: CORES_SYMBIUS.fundoCard },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16, backgroundColor: CORES_SYMBIUS.borda2 },
  titulo: { fontSize: 16, fontFamily: F.black, marginBottom: 14, color: CORES_SYMBIUS.texto },
  label: { fontSize: 9, fontFamily: F.black, letterSpacing: 1.2, marginBottom: 6, color: CORES_SYMBIUS.textoSec },
  input: {
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontFamily: F.medium, fontSize: 13, borderWidth: 1,
    backgroundColor: CORES_SYMBIUS.fundo, color: CORES_SYMBIUS.texto, borderColor: CORES_SYMBIUS.borda2,
  },
  erroBox: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FDECEA', padding: 10, borderRadius: 10, marginTop: 14 },
  erroTxt: { fontSize: 12, color: '#D64545', fontFamily: F.bold, flex: 1 },
  botoes: { flexDirection: 'row', gap: 8, marginTop: 18 },
  btnCancelar: { flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: CORES_SYMBIUS.borda2 },
  btnCancelarTxt: { fontFamily: F.bold, fontSize: 13, color: CORES_SYMBIUS.textoSec },
  btnSalvar: { flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: 'center', backgroundColor: CORES_SYMBIUS.verdeEscuro },
  btnSalvarTxt: { color: '#FFF', fontFamily: F.black, fontSize: 13 },
});

export default ModalAlterarSenha;
