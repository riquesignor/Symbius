import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList, Image, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert, Modal, StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  doc, onSnapshot, collection, query, where, orderBy, updateDoc, arrayUnion, arrayRemove, getDoc,
} from 'firebase/firestore';
import { db, auth } from '../config/firebaseConfig';
import { CORES_SYMBIUS } from '../constants/coresSymbius';
import { F } from '../constants/theme';
import { useNotificacao } from '../contexts/NotificacaoProvider';
import { Grupo, enviarMensagemGrupo, sairDoGrupo } from '../services/gruposService';
import { escolherImagemBase64 } from '../utils/midiaNativa';

const fotoUri = (foto?: string | null) =>
  !foto ? null : foto.startsWith('http') || foto.startsWith('data:') ? foto : `data:image/jpeg;base64,${foto}`;

const hora = (t: any) => {
  const d = t?.toDate ? t.toDate() : null;
  return d ? d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';
};

// Cor fixa por pessoa pro nome acima da bolha (como em grupos do WhatsApp).
const CORES_NOMES = ['#B4682A', '#2E6B45', '#4A90C2', '#8e44ad', '#C0392B', '#16A085'];
const corDoNome = (uid: string) => CORES_NOMES[[...uid].reduce((s, c) => s + c.charCodeAt(0), 0) % CORES_NOMES.length];

export default function GrupoChat({ navigation, route }: any) {
  const insets = useSafeAreaInsets();
  const grupoId: string = route?.params?.grupoId;
  const meuUid = auth.currentUser?.uid || route?.params?.uid;
  const { setConversaAtiva } = useNotificacao();

  const [grupo, setGrupo] = useState<Grupo | null>(null);
  const [mensagens, setMensagens] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [eu, setEu] = useState<{ nome: string; foto: string | null }>({ nome: 'Você', foto: null });
  const [silenciado, setSilenciado] = useState(false);
  const [infoAberta, setInfoAberta] = useState(false);
  const [imagemCheia, setImagemCheia] = useState<string | null>(null);
  const listaRef = useRef<FlatList>(null);

  useEffect(() => {
    setConversaAtiva(grupoId);
    return () => setConversaAtiva(null);
  }, [grupoId]);

  useEffect(() => {
    if (!meuUid) return;
    getDoc(doc(db, 'usuarios', meuUid)).then(s => {
      const d: any = s.data() || {};
      setEu({ nome: d.nome_completo || 'Você', foto: d.foto || null });
      setSilenciado((d.silenciados || []).includes(grupoId));
    });
  }, [meuUid, grupoId]);

  useEffect(() => {
    if (!grupoId) return;
    return onSnapshot(doc(db, 'conversas', grupoId), snap => {
      if (!snap.exists()) { setGrupo(null); return; }
      setGrupo({ id: snap.id, ...(snap.data() as any) });
    });
  }, [grupoId]);

  useEffect(() => {
    if (!grupoId) return;
    const q = query(collection(db, 'mensagens'), where('conversaId', '==', grupoId), orderBy('data_postagem', 'asc'));
    return onSnapshot(q, snap => {
      setMensagens(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setCarregando(false);
    }, e => { console.log('Erro mensagens do grupo:', e.message); setCarregando(false); });
  }, [grupoId]);

  const souMembro = !!grupo && !!meuUid && grupo.membros.includes(meuUid);

  const enviar = async (conteudo: { tipo: 'texto' | 'imagem'; mensagem: string }) => {
    if (!grupo || !meuUid || !souMembro) return;
    setEnviando(true);
    try {
      await enviarMensagemGrupo(grupo, { uid: meuUid, nome: eu.nome, foto: eu.foto }, conteudo);
    } catch (e) {
      console.log('Erro ao enviar no grupo:', e);
      Alert.alert('Erro', 'Não foi possível enviar.');
    } finally {
      setEnviando(false);
    }
  };

  const enviarTexto = () => {
    const t = texto.trim();
    if (!t || enviando) return;
    setTexto('');
    enviar({ tipo: 'texto', mensagem: t });
  };

  const enviarImagem = async () => {
    const b64 = await escolherImagemBase64({ ladoMax: 1024, qualidade: 0.6 });
    if (b64) enviar({ tipo: 'imagem', mensagem: b64 });
  };

  const alternarSilenciar = async () => {
    if (!meuUid) return;
    const novo = !silenciado;
    setSilenciado(novo);
    try {
      await updateDoc(doc(db, 'usuarios', meuUid), { silenciados: novo ? arrayUnion(grupoId) : arrayRemove(grupoId) });
    } catch { setSilenciado(!novo); }
  };

  const confirmarSaida = () => {
    if (!grupo || !meuUid) return;
    const sair = async () => {
      setInfoAberta(false);
      await sairDoGrupo(grupo, meuUid, eu.nome);
      navigation.goBack();
    };
    if (Platform.OS === 'web') { if (window.confirm('Sair do grupo?')) sair(); return; }
    Alert.alert('Sair do grupo?', 'Você deixa de receber as mensagens deste grupo.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: sair },
    ]);
  };

  if (!carregando && !grupo) {
    return (
      <View style={[styles.container, styles.centro]}>
        <Ionicons name="people-outline" size={48} color={CORES_SYMBIUS.textoTerciario} />
        <Text style={styles.vazio}>Este grupo não existe mais.</Text>
        <TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.link}>Voltar</Text></TouchableOpacity>
      </View>
    );
  }

  const renderMensagem = ({ item, index }: any) => {
    const minha = item.remetenteUid === meuUid;
    const anterior = mensagens[index - 1];
    const mostraNome = !minha && anterior?.remetenteUid !== item.remetenteUid;
    const avatar = fotoUri(item.foto);
    return (
      <View style={[styles.linha, minha ? styles.linhaMinha : styles.linhaOutro]}>
        {!minha && (
          <View style={{ width: 30 }}>
            {mostraNome && (avatar
              ? <Image source={{ uri: avatar }} style={styles.miniAvatar} />
              : <View style={[styles.miniAvatar, styles.miniAvatarVazio]}><Text style={styles.miniAvatarTxt}>{(item.nome_remetente || '?').charAt(0)}</Text></View>)}
          </View>
        )}
        <View style={[styles.bolha, minha ? styles.bolhaMinha : styles.bolhaOutro]}>
          {mostraNome && <Text style={[styles.nome, { color: corDoNome(item.remetenteUid) }]}>{item.nome_remetente}</Text>}
          {item.tipo === 'imagem'
            ? (
              <TouchableOpacity onPress={() => setImagemCheia(fotoUri(item.mensagem))} activeOpacity={0.85}>
                <Image source={{ uri: fotoUri(item.mensagem)! }} style={styles.imagem} resizeMode="cover" />
              </TouchableOpacity>
            )
            : <Text style={[styles.texto, minha && { color: CORES_SYMBIUS.creme }]}>{item.mensagem}</Text>}
          <Text style={[styles.hora, minha && { color: 'rgba(244,241,232,0.7)' }]}>{hora(item.data_postagem)}</Text>
        </View>
      </View>
    );
  };

  const membros = grupo ? grupo.membros.map(uid => ({ uid, ...(grupo.dadosMembros?.[uid] || { nome: 'Usuário', foto: null }) })) : [];

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <StatusBar barStyle={CORES_SYMBIUS.barStyle} backgroundColor={CORES_SYMBIUS.fundoCard} />
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="arrow-back" size={22} color={CORES_SYMBIUS.texto} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.headerCentro} onPress={() => setInfoAberta(true)} activeOpacity={0.7}>
          <View style={styles.grupoIcone}><Ionicons name="people" size={20} color={CORES_SYMBIUS.creme} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitulo} numberOfLines={1}>{grupo?.nome || 'Grupo'}</Text>
            <Text style={styles.headerSub} numberOfLines={1}>
              {grupo ? `${grupo.membros.length} participantes${grupo.materia ? ` · ${grupo.materia}` : ''}` : ''}
            </Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity onPress={alternarSilenciar} style={styles.headerBtn} accessibilityLabel={silenciado ? 'Reativar notificações' : 'Silenciar grupo'}>
          <Ionicons name={silenciado ? 'notifications-off' : 'notifications-outline'} size={20} color={silenciado ? CORES_SYMBIUS.laranjaTexto : CORES_SYMBIUS.texto} />
        </TouchableOpacity>
      </View>

      {carregando
        ? <View style={styles.centro}><ActivityIndicator color={CORES_SYMBIUS.verdeEscuro} /></View>
        : (
          <FlatList
            ref={listaRef}
            data={mensagens}
            keyExtractor={m => m.id}
            renderItem={renderMensagem}
            contentContainerStyle={{ padding: 12, paddingBottom: 16, flexGrow: 1 }}
            onContentSizeChange={() => listaRef.current?.scrollToEnd({ animated: false })}
            ListEmptyComponent={<Text style={[styles.vazio, { marginTop: 40 }]}>Mandem a primeira mensagem do grupo 👋</Text>}
          />
        )}

      {souMembro ? (
        <View style={[styles.inputArea, { paddingBottom: 10 + insets.bottom }]}>
          <TouchableOpacity onPress={enviarImagem} style={styles.btnAnexo} disabled={enviando}>
            <Ionicons name="image-outline" size={22} color={CORES_SYMBIUS.texto} />
          </TouchableOpacity>
          <TextInput
            style={styles.input}
            value={texto}
            onChangeText={setTexto}
            placeholder="Mensagem para o grupo..."
            placeholderTextColor={CORES_SYMBIUS.textoMuted}
            multiline
          />
          <TouchableOpacity onPress={enviarTexto} style={[styles.btnEnviar, (!texto.trim() || enviando) && { opacity: 0.5 }]} disabled={!texto.trim() || enviando}>
            {enviando ? <ActivityIndicator size="small" color={CORES_SYMBIUS.creme} /> : <Ionicons name="send" size={18} color={CORES_SYMBIUS.creme} />}
          </TouchableOpacity>
        </View>
      ) : (
        <View style={[styles.inputArea, { paddingBottom: 10 + insets.bottom, justifyContent: 'center' }]}>
          <Text style={styles.vazio}>Você não participa mais deste grupo.</Text>
        </View>
      )}

      <Modal visible={infoAberta} transparent animationType="slide" onRequestClose={() => setInfoAberta(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setInfoAberta(false)}>
          <View style={[styles.sheet, { paddingBottom: 20 + insets.bottom }]}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitulo}>{grupo?.nome}</Text>
            {!!grupo?.materia && <Text style={styles.headerSub}>{grupo.materia}</Text>}
            <Text style={styles.rotulo}>PARTICIPANTES ({membros.length})</Text>
            {membros.map(m => {
              const f = fotoUri(m.foto);
              return (
                <TouchableOpacity
                  key={m.uid}
                  style={styles.membro}
                  onPress={() => { setInfoAberta(false); if (m.uid !== meuUid) navigation.navigate('PerfilPublico', { uid: m.uid, meuUid }); }}
                >
                  {f ? <Image source={{ uri: f }} style={styles.membroFoto} />
                    : <View style={[styles.membroFoto, styles.miniAvatarVazio]}><Text style={styles.miniAvatarTxt}>{m.nome.charAt(0)}</Text></View>}
                  <Text style={styles.membroNome}>{m.uid === meuUid ? `${m.nome} (você)` : m.nome}</Text>
                  {grupo?.criadoPor === m.uid && <Text style={styles.criador}>criador</Text>}
                </TouchableOpacity>
              );
            })}
            {souMembro && (
              <TouchableOpacity style={styles.btnSair} onPress={confirmarSaida}>
                <Ionicons name="exit-outline" size={18} color="#D64545" />
                <Text style={styles.btnSairTxt}>Sair do grupo</Text>
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={!!imagemCheia} transparent animationType="fade" onRequestClose={() => setImagemCheia(null)}>
        <TouchableOpacity style={styles.imagemOverlay} activeOpacity={1} onPress={() => setImagemCheia(null)}>
          {imagemCheia && <Image source={{ uri: imagemCheia }} style={{ width: '95%', height: '80%' }} resizeMode="contain" />}
        </TouchableOpacity>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: CORES_SYMBIUS.fundo },
  centro: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10 },
  vazio: { color: CORES_SYMBIUS.textoSec, fontFamily: F.medium, fontSize: 13, textAlign: 'center' },
  link: { color: CORES_SYMBIUS.verdeEscuro, fontFamily: F.bold, fontSize: 14 },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingBottom: 12,
    backgroundColor: CORES_SYMBIUS.fundoCard, borderBottomWidth: 1, borderBottomColor: CORES_SYMBIUS.borda,
  },
  headerBtn: { width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center', backgroundColor: CORES_SYMBIUS.fundoSuave },
  headerCentro: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  grupoIcone: { width: 40, height: 40, borderRadius: 20, backgroundColor: CORES_SYMBIUS.verdeEscuro, justifyContent: 'center', alignItems: 'center' },
  headerTitulo: { fontSize: 15, fontFamily: F.bold, color: CORES_SYMBIUS.texto },
  headerSub: { fontSize: 11.5, fontFamily: F.medium, color: CORES_SYMBIUS.textoSec },

  linha: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, marginVertical: 2 },
  linhaMinha: { justifyContent: 'flex-end' },
  linhaOutro: { justifyContent: 'flex-start' },
  miniAvatar: { width: 28, height: 28, borderRadius: 14 },
  miniAvatarVazio: { backgroundColor: CORES_SYMBIUS.fundoSuave, justifyContent: 'center', alignItems: 'center' },
  miniAvatarTxt: { fontFamily: F.bold, color: CORES_SYMBIUS.verdeEscuro, fontSize: 12 },
  bolha: { maxWidth: '78%', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8 },
  bolhaMinha: { backgroundColor: CORES_SYMBIUS.verdeEscuro, borderBottomRightRadius: 4 },
  bolhaOutro: { backgroundColor: CORES_SYMBIUS.fundoCard, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: CORES_SYMBIUS.borda },
  nome: { fontSize: 11.5, fontFamily: F.bold, marginBottom: 2 },
  texto: { fontSize: 14.5, fontFamily: F.regular, color: CORES_SYMBIUS.texto, lineHeight: 20 },
  imagem: { width: 220, height: 220, borderRadius: 10 },
  hora: { fontSize: 10, fontFamily: F.medium, color: CORES_SYMBIUS.textoMuted, alignSelf: 'flex-end', marginTop: 3 },

  inputArea: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 10, paddingTop: 10,
    backgroundColor: CORES_SYMBIUS.fundoCard, borderTopWidth: 1, borderTopColor: CORES_SYMBIUS.borda,
  },
  btnAnexo: { width: 42, height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center', backgroundColor: CORES_SYMBIUS.fundoSuave },
  input: {
    flex: 1, maxHeight: 110, borderRadius: 21, borderWidth: 1, borderColor: CORES_SYMBIUS.borda,
    backgroundColor: CORES_SYMBIUS.fundo, paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 14.5, fontFamily: F.regular, color: CORES_SYMBIUS.texto,
  },
  btnEnviar: { width: 42, height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center', backgroundColor: CORES_SYMBIUS.verdeEscuro },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: CORES_SYMBIUS.fundoCard, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 12, maxHeight: '80%' },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: CORES_SYMBIUS.borda2, alignSelf: 'center', marginBottom: 12 },
  sheetTitulo: { fontSize: 18, fontFamily: F.black, color: CORES_SYMBIUS.texto },
  rotulo: { fontSize: 10.5, fontFamily: F.bold, letterSpacing: 0.6, color: CORES_SYMBIUS.textoSec, marginTop: 16, marginBottom: 6 },
  membro: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9 },
  membroFoto: { width: 38, height: 38, borderRadius: 19 },
  membroNome: { flex: 1, fontSize: 14, fontFamily: F.semibold, color: CORES_SYMBIUS.texto },
  criador: { fontSize: 10.5, fontFamily: F.bold, color: CORES_SYMBIUS.laranjaTexto },
  btnSair: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 14, paddingVertical: 13, borderRadius: 14, borderWidth: 1.5, borderColor: '#D6454555' },
  btnSairTxt: { fontSize: 14, fontFamily: F.bold, color: '#D64545' },

  imagemOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center', alignItems: 'center' },
});
