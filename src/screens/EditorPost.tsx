import React, { useState } from 'react';
import { 
  StyleSheet, View, Text, TextInput, TouchableOpacity, 
  Image, ScrollView, Alert, ActivityIndicator, SafeAreaView,
  Modal
} from 'react-native';
import { db } from '../config/firebaseConfig';
import { doc, setDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { gerarIdLegivel } from '../utils/firestoreIds';
import * as ImagePicker from 'expo-image-picker';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CORES } from '../constants/theme';

const CATEGORIAS_OPCOES = [
  { label: 'Avisos',        value: 'avisos',        icon: 'campaign'     },
  { label: 'Destaques',     value: 'destaque',       icon: 'star'         },
  { label: 'Oportunidades', value: 'oportunidades',  icon: 'work'         },
  { label: 'Olimpíadas',    value: 'olimpiadas',     icon: 'emoji-events' },
  { label: 'Passeios',      value: 'passeios',       icon: 'explore'      },
];

export default function EditorPost({ route, navigation }: any) {
  const insets = useSafeAreaInsets();
  const { postId, categoria: categoriaParam, current } = route.params;

  const [titulo,     setTitulo]     = useState(current?.titulo    || '');
  const [subtitulo,  setSubtitulo]  = useState(current?.subtitulo || '');
  const [conteudo,   setConteudo]   = useState(current?.conteudo  || '');
  const [capa,       setCapa]       = useState(current?.capa      || null);
  const [autor,      setAutor]      = useState(current?.autor     || '');
  const [tagsInput,  setTagsInput]  = useState(current?.tags ? current.tags.join(', ') : '');
  const [loading,    setLoading]    = useState(false);

  const [categoria,       setCategoria]       = useState(current?.categoria || categoriaParam || 'avisos');
  const [showCatModal,    setShowCatModal]    = useState(false);

  const catAtual = CATEGORIAS_OPCOES.find(c => c.value === categoria) || CATEGORIAS_OPCOES[0];

  const selecionarImagem = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permissão necessária', 'Precisamos de acesso às suas fotos.');
      return;
    }
    const resultado = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.3,
      base64: true,
    });
    if (!resultado.canceled && resultado.assets[0].base64) {
      setCapa(`data:image/jpeg;base64,${resultado.assets[0].base64}`);
    }
  };

  const salvar = async () => {
    if (!titulo.trim() || !conteudo.trim() || !capa) {
      return Alert.alert('Erro', 'Título, conteúdo e capa são obrigatórios.');
    }
    setLoading(true);
    try {
      const tagsArray = tagsInput.split(',').map((t: string) => t.trim()).filter((t: string) => t !== '');
      const postData = {
        titulo:           titulo.trim(),
        subtitulo:        subtitulo.trim(),
        conteudo:         conteudo.trim(),
        capa,
        categoria,        // ✅ usa o estado selecionado
        autor:            autor.trim() || 'Gestão Symbius',
        tags:             tagsArray,
        ultimaAtualizacao: serverTimestamp(),
      };

      if (postId) {
        await updateDoc(doc(db, 'posts', postId), postData);
        Alert.alert('Sucesso!', 'Post atualizado.', [{ text: 'OK', onPress: () => navigation.goBack() }]);
      } else {
        // ID legível (slug do título + sufixo curto) em vez do ID aleatório
        // do addDoc — facilita identificar o post direto na lista do Firestore.
        const idPost = gerarIdLegivel(postData.titulo);
        await setDoc(doc(db, 'posts', idPost), {
          ...postData,
          visualizacoes:   0,
          leitores:        [],
          data_publicacao: serverTimestamp(),
        });
        Alert.alert('Sucesso!', 'Post publicado.', [{ text: 'OK', onPress: () => navigation.goBack() }]);
      }
    } catch (e: any) {
      console.error(e);
      Alert.alert('Erro', 'Falha ao salvar. Talvez a imagem seja muito grande.');
    } finally {
      setLoading(false);
    }
  };

  const excluirPost = () => {
    if (!postId) {
      Alert.alert('Erro', 'ID do post não encontrado. Não é possível excluir.');
      return;
    }
    Alert.alert(
      'Excluir Post',
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
              const msg = e?.message || String(e);
              console.error('Erro ao excluir post:', msg);
              Alert.alert('Erro ao excluir', msg || 'Não foi possível excluir. Verifique sua conexão ou permissões.');
              return;
            }
            setLoading(false);
            navigation.goBack();
          }
        }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>

      {/* HEADER */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={CORES.azulEscuro} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{postId ? 'EDITAR POST' : 'NOVO POST'}</Text>
        {postId
          ? <TouchableOpacity onPress={excluirPost}>
              <MaterialIcons name="delete-outline" size={24} color="#FF5252" />
            </TouchableOpacity>
          : <View style={{ width: 24 }} />
        }
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* SELETOR DE CATEGORIA */}
        <Text style={styles.label}>CATEGORIA</Text>
        <TouchableOpacity style={styles.catSelector} onPress={() => setShowCatModal(true)}>
          <View style={styles.catSelectorLeft}>
            <MaterialIcons name={catAtual.icon as any} size={20} color={CORES.rosa} />
            <Text style={styles.catSelectorText}>{catAtual.label}</Text>
          </View>
          <Ionicons name="chevron-down" size={18} color={CORES.textoSec} />
        </TouchableOpacity>

        {/* CAPA */}
        <Text style={[styles.label, { marginTop: 20 }]}>CAPA DO POST (16:9)</Text>
        <TouchableOpacity style={styles.uploadArea} onPress={selecionarImagem}>
          {capa
            ? <Image source={{ uri: capa }} style={styles.preview} />
            : <View style={styles.placeholder}>
                <MaterialIcons name="add-a-photo" size={40} color={CORES.rosa} />
                <Text style={styles.placeholderText}>Toque para adicionar capa</Text>
              </View>
          }
        </TouchableOpacity>

        {/* TÍTULO */}
        <Text style={styles.label}>TÍTULO *</Text>
        <TextInput
          style={styles.input}
          value={titulo}
          onChangeText={setTitulo}
          placeholder="Ex: Inscrições abertas para OBMEP"
          placeholderTextColor={CORES.textoSec}
        />

        {/* SUBTÍTULO */}
        <Text style={styles.label}>SUBTÍTULO</Text>
        <TextInput
          style={styles.input}
          value={subtitulo}
          onChangeText={setSubtitulo}
          placeholder="Resumo rápido do post..."
          placeholderTextColor={CORES.textoSec}
        />

        {/* AUTOR + TAGS */}
        <View style={styles.row}>
          <View style={{ flex: 1, marginRight: 10 }}>
            <Text style={styles.label}>AUTOR / SETOR</Text>
            <TextInput
              style={styles.input}
              value={autor}
              onChangeText={setAutor}
              placeholder="Ex: Direção"
              placeholderTextColor={CORES.textoSec}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>TAGS (vírgula)</Text>
            <TextInput
              style={styles.input}
              value={tagsInput}
              onChangeText={setTagsInput}
              placeholder="Ex: Exatas, Avisos"
              placeholderTextColor={CORES.textoSec}
            />
          </View>
        </View>

        {/* CONTEÚDO */}
        <Text style={styles.label}>CONTEÚDO COMPLETO *</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={conteudo}
          onChangeText={setConteudo}
          multiline
          numberOfLines={8}
          placeholder="Escreva o texto completo do post aqui..."
          placeholderTextColor={CORES.textoSec}
          textAlignVertical="top"
        />

        {/* BOTÃO SALVAR */}
        <TouchableOpacity
          style={[styles.btnSalvar, loading && { opacity: 0.7 }]}
          onPress={salvar}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#FFF" />
            : <Text style={styles.btnText}>{postId ? 'SALVAR ALTERAÇÕES' : 'PUBLICAR POST'}</Text>
          }
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* MODAL SELETOR DE CATEGORIA */}
      <Modal visible={showCatModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitulo}>Selecione a Categoria</Text>
            {CATEGORIAS_OPCOES.map(cat => (
              <TouchableOpacity
                key={cat.value}
                style={styles.catOpcao}
                onPress={() => { setCategoria(cat.value); setShowCatModal(false); }}
              >
                <MaterialIcons name={cat.icon as any} size={20} color={CORES.rosa} />
                <Text style={styles.catOpcaoText}>{cat.label}</Text>
                {categoria === cat.value && (
                  <Ionicons name="checkmark-circle" size={20} color={CORES.rosa} style={{ marginLeft: 'auto' as any }} />
                )}
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.btnFechar} onPress={() => setShowCatModal(false)}>
              <Text style={styles.btnFecharText}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: CORES.branco },
  header:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: CORES.cinzaClaro },
  backBtn:         { padding: 4 },
  headerTitle:     { fontSize: 15, fontWeight: '900', color: CORES.azulEscuro, letterSpacing: 1 },
  scrollContent:   { padding: 24 },
  row:             { flexDirection: 'row' },
  label:           { fontSize: 11, fontWeight: '800', color: CORES.textoSec, letterSpacing: 0.8, marginBottom: 8, marginTop: 4 },
  input:           { backgroundColor: CORES.fundo, borderRadius: 14, padding: 16, fontSize: 14, color: CORES.azulEscuro, borderWidth: 1, borderColor: CORES.cinzaClaro, marginBottom: 18 },
  textArea:        { height: 160 },

  catSelector:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: CORES.fundo, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, borderWidth: 1, borderColor: CORES.cinzaClaro, marginBottom: 4 },
  catSelectorLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  catSelectorText: { fontSize: 15, fontWeight: '700', color: CORES.azulEscuro },

  uploadArea:      { width: '100%', height: 190, backgroundColor: CORES.fundo, borderRadius: 18, overflow: 'hidden', marginBottom: 20, borderWidth: 2, borderColor: CORES.cinzaClaro, borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center' },
  preview:         { width: '100%', height: '100%' },
  placeholder:     { alignItems: 'center', gap: 10 },
  placeholderText: { color: CORES.rosa, fontWeight: '700', fontSize: 13 },

  btnSalvar:       { backgroundColor: CORES.rosa, padding: 18, borderRadius: 16, alignItems: 'center', marginTop: 8, elevation: 4, shadowColor: CORES.rosa, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 6 },
  btnText:         { color: '#FFF', fontWeight: '900', fontSize: 15, letterSpacing: 1 },

  modalOverlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet:      { backgroundColor: CORES.branco, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 36 },
  modalHandle:     { width: 40, height: 4, backgroundColor: CORES.cinzaClaro, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  modalTitulo:     { fontSize: 17, fontWeight: '900', color: CORES.azulEscuro, marginBottom: 16 },
  catOpcao:        { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: CORES.cinzaClaro },
  catOpcaoText:    { fontSize: 15, fontWeight: '700', color: CORES.azulEscuro },
  btnFechar:       { marginTop: 16, backgroundColor: CORES.fundo, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  btnFecharText:   { fontWeight: '800', color: CORES.textoSec, fontSize: 14 },
});