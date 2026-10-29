import React, { useState } from 'react';
import {
  StyleSheet, View, Text, TextInput, TouchableOpacity,
  Image, ScrollView, Alert, ActivityIndicator, Modal, StatusBar,
} from 'react-native';
import { db } from '../config/firebaseConfig';
import { doc, setDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { gerarIdLegivel } from '../utils/firestoreIds';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CORES_SYMBIUS } from '../constants/coresSymbius';
import { F } from '../constants/theme';
import { escolherImagemBase64 } from '../utils/midiaNativa';
import { dispararPushTodos } from '../services/pushNotificationsService';

const CATEGORIAS_OPCOES = [
  { label: 'Avisos',        value: 'avisos',        icon: 'campaign'     },
  { label: 'Destaques',     value: 'destaque',      icon: 'star'         },
  { label: 'Oportunidades', value: 'oportunidades', icon: 'work'         },
  { label: 'Olimpíadas',    value: 'olimpiadas',    icon: 'emoji-events' },
  { label: 'Passeios',      value: 'passeios',      icon: 'explore'      },
];

export default function EditorPost({ route, navigation }: any) {
  const insets = useSafeAreaInsets();
  const { postId, categoria: categoriaParam, current } = route.params || {};

  const [titulo,     setTitulo]     = useState(current?.titulo    || '');
  const [subtitulo,  setSubtitulo]  = useState(current?.subtitulo || '');
  const [conteudo,   setConteudo]   = useState(current?.conteudo  || '');
  const [capa,       setCapa]       = useState<string | null>(current?.capa || null);
  const [autor,      setAutor]      = useState(current?.autor     || '');
  const [tagsInput,  setTagsInput]  = useState(current?.tags ? current.tags.join(', ') : '');
  const [loading,    setLoading]    = useState(false);
  const [carregandoCapa, setCarregandoCapa] = useState(false);

  const [categoria,    setCategoria]    = useState(current?.categoria || categoriaParam || 'avisos');
  const [showCatModal, setShowCatModal] = useState(false);

  const catAtual = CATEGORIAS_OPCOES.find(c => c.value === categoria) || CATEGORIAS_OPCOES[0];

  const selecionarImagem = async () => {
    setCarregandoCapa(true);
    try {
      const b64 = await escolherImagemBase64({ ladoMax: 1280, qualidade: 0.6, aspecto: [16, 9] });
      if (b64) setCapa(`data:image/jpeg;base64,${b64}`);
    } finally {
      setCarregandoCapa(false);
    }
  };

  const salvar = async () => {
    if (!titulo.trim() || !conteudo.trim() || !capa) {
      return Alert.alert('Faltam informações', 'Título, conteúdo e capa são obrigatórios.');
    }
    setLoading(true);
    try {
      const tagsArray = tagsInput.split(',').map((t: string) => t.trim()).filter((t: string) => t !== '');
      const postData = {
        titulo:            titulo.trim(),
        subtitulo:         subtitulo.trim(),
        conteudo:          conteudo.trim(),
        capa,
        categoria,
        autor:             autor.trim() || 'Gestão Simbio',
        tags:              tagsArray,
        ultimaAtualizacao: serverTimestamp(),
      };

      if (postId) {
        await updateDoc(doc(db, 'posts', postId), postData);
        Alert.alert('Pronto!', 'Post atualizado.', [{ text: 'OK', onPress: () => navigation.goBack() }]);
      } else {
        // ID legível (slug do título + sufixo curto) facilita achar o post no Firestore.
        const idPost = gerarIdLegivel(postData.titulo);
        await setDoc(doc(db, 'posts', idPost), {
          ...postData,
          visualizacoes:   0,
          leitores:        [],
          data_publicacao: serverTimestamp(),
        });
        const cat = CATEGORIAS_OPCOES.find(c => c.value === categoria)?.label || 'Mural';
        dispararPushTodos({
          titulo: `Novo post: ${cat}`,
          corpo: postData.titulo,
          dados: { tipo: 'novo_post', postId: idPost },
        });
        Alert.alert('Pronto!', 'Post publicado.', [{ text: 'OK', onPress: () => navigation.goBack() }]);
      }
    } catch (e: any) {
      console.error(e);
      Alert.alert('Erro', 'Falha ao salvar. Talvez a imagem seja muito grande.');
    } finally {
      setLoading(false);
    }
  };

  const excluirPost = () => {
    if (!postId) return;
    Alert.alert(
      'Excluir post',
      'Deseja realmente excluir esta publicação? Essa ação não tem volta.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              await deleteDoc(doc(db, 'posts', postId));
            } catch (e: any) {
              setLoading(false);
              Alert.alert('Erro ao excluir', e?.message || 'Verifique sua conexão ou permissões.');
              return;
            }
            setLoading(false);
            navigation.goBack();
          },
        },
      ],
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle={CORES_SYMBIUS.barStyle} backgroundColor={CORES_SYMBIUS.fundo} />

      <View style={[styles.header, { paddingTop: insets.top + 24 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="arrow-back" size={22} color={CORES_SYMBIUS.texto} />
        </TouchableOpacity>
        <View style={{ alignItems: 'center' }}>
          <Text style={styles.headerEyebrow}>MURAL</Text>
          <Text style={styles.headerTitle}>{postId ? 'Editar post' : 'Novo post'}</Text>
        </View>
        {postId
          ? (
            <TouchableOpacity onPress={excluirPost} style={styles.headerBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <MaterialIcons name="delete-outline" size={20} color="#D64545" />
            </TouchableOpacity>
          )
          : <View style={{ width: 36 }} />}
      </View>

      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: 40 + insets.bottom }]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>CATEGORIA</Text>
        <TouchableOpacity style={styles.catSelector} onPress={() => setShowCatModal(true)}>
          <View style={styles.catSelectorLeft}>
            <View style={styles.catIcone}>
              <MaterialIcons name={catAtual.icon as any} size={16} color={CORES_SYMBIUS.creme} />
            </View>
            <Text style={styles.catSelectorText}>{catAtual.label}</Text>
          </View>
          <Ionicons name="chevron-down" size={18} color={CORES_SYMBIUS.textoSec} />
        </TouchableOpacity>

        <Text style={[styles.label, { marginTop: 18 }]}>CAPA DO POST (16:9)</Text>
        <TouchableOpacity style={styles.uploadArea} onPress={selecionarImagem} activeOpacity={0.85} disabled={carregandoCapa}>
          {carregandoCapa
            ? <ActivityIndicator color={CORES_SYMBIUS.verdeEscuro} />
            : capa
              ? <Image source={{ uri: capa }} style={styles.preview} />
              : (
                <View style={styles.placeholder}>
                  <MaterialIcons name="add-a-photo" size={34} color={CORES_SYMBIUS.verdeEscuro} />
                  <Text style={styles.placeholderText}>Toque para adicionar a capa</Text>
                </View>
              )}
        </TouchableOpacity>
        {!!capa && !carregandoCapa && (
          <TouchableOpacity onPress={selecionarImagem} style={styles.trocarCapa}>
            <Ionicons name="swap-horizontal" size={14} color={CORES_SYMBIUS.verdeEscuro} />
            <Text style={styles.trocarCapaTxt}>Trocar capa</Text>
          </TouchableOpacity>
        )}

        <Text style={styles.label}>TÍTULO *</Text>
        <TextInput
          style={styles.input}
          value={titulo}
          onChangeText={setTitulo}
          placeholder="Ex: Inscrições abertas para OBMEP"
          placeholderTextColor={CORES_SYMBIUS.textoTerciario}
        />

        <Text style={styles.label}>SUBTÍTULO</Text>
        <TextInput
          style={styles.input}
          value={subtitulo}
          onChangeText={setSubtitulo}
          placeholder="Resumo rápido do post..."
          placeholderTextColor={CORES_SYMBIUS.textoTerciario}
        />

        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>AUTOR / SETOR</Text>
            <TextInput
              style={styles.input}
              value={autor}
              onChangeText={setAutor}
              placeholder="Ex: Direção"
              placeholderTextColor={CORES_SYMBIUS.textoTerciario}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>TAGS (VÍRGULA)</Text>
            <TextInput
              style={styles.input}
              value={tagsInput}
              onChangeText={setTagsInput}
              placeholder="Ex: Exatas, Avisos"
              placeholderTextColor={CORES_SYMBIUS.textoTerciario}
            />
          </View>
        </View>

        <Text style={styles.label}>CONTEÚDO COMPLETO *</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={conteudo}
          onChangeText={setConteudo}
          multiline
          placeholder="Escreva o texto completo do post aqui..."
          placeholderTextColor={CORES_SYMBIUS.textoTerciario}
          textAlignVertical="top"
        />

        <TouchableOpacity
          style={[styles.btnSalvar, loading && { opacity: 0.7 }]}
          onPress={salvar}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color={CORES_SYMBIUS.creme} />
            : <Text style={styles.btnText}>{postId ? 'Salvar alterações' : 'Publicar post'}</Text>}
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={showCatModal} transparent animationType="slide" onRequestClose={() => setShowCatModal(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowCatModal(false)}>
          <View style={[styles.modalSheet, { paddingBottom: 24 + insets.bottom }]}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitulo}>Selecione a categoria</Text>
            {CATEGORIAS_OPCOES.map(cat => {
              const ativa = categoria === cat.value;
              return (
                <TouchableOpacity
                  key={cat.value}
                  style={styles.catOpcao}
                  onPress={() => { setCategoria(cat.value); setShowCatModal(false); }}
                >
                  <View style={[styles.catIcone, !ativa && { backgroundColor: CORES_SYMBIUS.fundoSuave }]}>
                    <MaterialIcons name={cat.icon as any} size={16} color={ativa ? CORES_SYMBIUS.creme : CORES_SYMBIUS.verdeEscuro} />
                  </View>
                  <Text style={[styles.catOpcaoText, ativa && { fontFamily: F.bold }]}>{cat.label}</Text>
                  {ativa && <Ionicons name="checkmark-circle" size={20} color={CORES_SYMBIUS.verdeEscuro} style={{ marginLeft: 'auto' }} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container:     { flex: 1, backgroundColor: CORES_SYMBIUS.fundo },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: CORES_SYMBIUS.borda,
    backgroundColor: CORES_SYMBIUS.fundo,
  },
  headerBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: CORES_SYMBIUS.fundoSuave,
    justifyContent: 'center', alignItems: 'center',
  },
  headerEyebrow: { fontSize: 10, fontFamily: F.bold, color: CORES_SYMBIUS.textoSec, letterSpacing: 0.6 },
  headerTitle:   { fontSize: 16, fontFamily: F.black, color: CORES_SYMBIUS.texto },
  scrollContent: { padding: 20 },
  row:           { flexDirection: 'row', gap: 10 },
  label:         { fontSize: 10.5, fontFamily: F.bold, color: CORES_SYMBIUS.textoSec, letterSpacing: 0.6, marginBottom: 8, marginTop: 4 },
  input: {
    backgroundColor: CORES_SYMBIUS.fundoCard, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13,
    fontSize: 14, fontFamily: F.regular, color: CORES_SYMBIUS.texto,
    borderWidth: 1, borderColor: CORES_SYMBIUS.borda, marginBottom: 16,
  },
  textArea:      { height: 170 },

  catSelector: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: CORES_SYMBIUS.fundoCard, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12,
    borderWidth: 1, borderColor: CORES_SYMBIUS.borda,
  },
  catSelectorLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  catIcone: {
    width: 30, height: 30, borderRadius: 10, backgroundColor: CORES_SYMBIUS.verdeEscuro,
    justifyContent: 'center', alignItems: 'center',
  },
  catSelectorText: { fontSize: 15, fontFamily: F.bold, color: CORES_SYMBIUS.texto },

  uploadArea: {
    width: '100%', aspectRatio: 16 / 9, backgroundColor: CORES_SYMBIUS.fundoSuave, borderRadius: 18,
    overflow: 'hidden', marginBottom: 8, borderWidth: 1.5, borderColor: CORES_SYMBIUS.borda2, borderStyle: 'dashed',
    justifyContent: 'center', alignItems: 'center',
  },
  preview:         { width: '100%', height: '100%' },
  placeholder:     { alignItems: 'center', gap: 8 },
  placeholderText: { color: CORES_SYMBIUS.verdeEscuro, fontFamily: F.semibold, fontSize: 13 },
  trocarCapa:      { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-end', marginBottom: 12 },
  trocarCapaTxt:   { color: CORES_SYMBIUS.verdeEscuro, fontFamily: F.bold, fontSize: 12 },

  btnSalvar: {
    backgroundColor: CORES_SYMBIUS.verdeEscuro, paddingVertical: 16, borderRadius: 16, alignItems: 'center', marginTop: 6,
    elevation: 3, shadowColor: CORES_SYMBIUS.verdeEscuro, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.18, shadowRadius: 8,
  },
  btnText: { color: CORES_SYMBIUS.creme, fontFamily: F.bold, fontSize: 15, letterSpacing: 0.3 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet:   { backgroundColor: CORES_SYMBIUS.fundoCard, borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 22 },
  modalHandle:  { width: 40, height: 4, backgroundColor: CORES_SYMBIUS.borda2, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  modalTitulo:  { fontSize: 17, fontFamily: F.black, color: CORES_SYMBIUS.texto, marginBottom: 8 },
  catOpcao:     { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: CORES_SYMBIUS.borda },
  catOpcaoText: { fontSize: 15, fontFamily: F.semibold, color: CORES_SYMBIUS.texto },
});
