import React, { useState } from 'react';
import { 
  StyleSheet, View, Text, TextInput, TouchableOpacity, 
  Image, ScrollView, Alert, ActivityIndicator, SafeAreaView 
} from 'react-native';
import { db, auth } from '../config/firebaseConfig';
import { doc, collection, addDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import * as ImagePicker from 'expo-image-picker';
import { MaterialIcons } from '@expo/vector-icons';

export default function EditorPost({ route, navigation }: any) {
  // Recebe postId se for edição. Se for novo, postId vem undefined.
  const { postId, categoria, current } = route.params;

  const [titulo, setTitulo] = useState(current?.titulo || '');
  const [subtitulo, setSubtitulo] = useState(current?.subtitulo || '');
  const [conteudo, setConteudo] = useState(current?.conteudo || '');
  const [capa, setCapa] = useState(current?.capa || null);
  const [autor, setAutor] = useState(current?.autor || '');
  
  // Transforma o array de tags em string pro input, e vice-versa na hora de salvar
  const [tagsInput, setTagsInput] = useState(current?.tags ? current.tags.join(', ') : '');
  
  const [loading, setLoading] = useState(false);

  const selecionarImagem = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert("Permissão necessária", "Precisamos de acesso às suas fotos.");
      return;
    }

    const resultado = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.3, // Mantém baixo pra não estourar o limite de 1MB do Firestore (Base64 é pesado)
      base64: true,
    });

    if (!resultado.canceled && resultado.assets[0].base64) {
      setCapa(`data:image/jpeg;base64,${resultado.assets[0].base64}`);
    }
  };

  const salvar = async () => {
    if (!titulo.trim() || !conteudo.trim() || !capa) {
      return Alert.alert("Erro", "Título, conteúdo e capa são obrigatórios.");
    }

    setLoading(true);
    try {
      // Processa as tags: separa por vírgula, tira os espaços em branco e remove os vazios
      const tagsArray = tagsInput.split(',').map(t => t.trim()).filter(t => t !== '');

      const postData = {
        titulo: titulo.trim(),
        subtitulo: subtitulo.trim(),
        conteudo: conteudo.trim(),
        capa: capa,
        categoria: categoria,
        autor: autor.trim() || "Gestão", // Fallback caso não preencha
        tags: tagsArray,
        ultimaAtualizacao: serverTimestamp()
      };

      if (postId) {
        // ATUALIZAR POST EXISTENTE
        const postRef = doc(db, "posts", postId);
        await updateDoc(postRef, postData);
        Alert.alert("Sucesso!", "Post atualizado com sucesso.");
      } else {
        // CRIAR NOVO POST
        await addDoc(collection(db, "posts"), {
          ...postData,
          visualizacoes: 0, // Inicia zerado
          data_publicacao: serverTimestamp() // Importante pra ordenação da Home
        });
        Alert.alert("Sucesso!", "Novo post publicado.");
      }
      
      navigation.goBack();
    } catch (e: any) {
      console.error(e);
      Alert.alert("Erro", "Falha ao salvar. Talvez a imagem seja muito grande.");
    } finally {
      setLoading(false);
    }
  };

  const excluirPost = () => {
    Alert.alert(
      "Excluir Post",
      "Deseja realmente excluir esta publicação? Essa ação não tem volta.",
      [
        { text: "Cancelar", style: "cancel" },
        { 
          text: "Excluir", 
          style: "destructive", 
          onPress: async () => {
            try {
              await deleteDoc(doc(db, "posts", postId));
              navigation.goBack();
            } catch (e) {
              Alert.alert("Erro", "Não foi possível excluir.");
            }
          } 
        }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={28} color="#1A1A2E" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{postId ? "EDITAR POST" : "NOVO POST"}</Text>
        {/* Só exibe a lixeira se o post já existir no banco */}
        {postId ? (
          <TouchableOpacity onPress={excluirPost}>
            <MaterialIcons name="delete-outline" size={26} color="#FF5252" />
          </TouchableOpacity>
        ) : (
          <View style={{width: 26}} /> // Spacer pra manter o título centralizado
        )}
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.catLabel}>{categoria.toUpperCase()}</Text>
        
        <TouchableOpacity style={styles.uploadArea} onPress={selecionarImagem}>
          {capa ? (
            <Image source={{ uri: capa }} style={styles.preview} />
          ) : (
            <View style={styles.placeholder}>
              <MaterialIcons name="add-a-photo" size={45} color="#E91E63" />
              <Text style={styles.placeholderText}>Capa do Post (16:9)</Text>
            </View>
          )}
        </TouchableOpacity>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>TÍTULO DO POST</Text>
          <TextInput 
            style={styles.input} 
            value={titulo} 
            onChangeText={setTitulo} 
            placeholder="Ex: Inscrições abertas para OBMEP"
            placeholderTextColor="#ABB"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>SUBTÍTULO (Resumo rápido)</Text>
          <TextInput 
            style={styles.input} 
            value={subtitulo} 
            onChangeText={setSubtitulo} 
            placeholder="Ex: Garanta sua vaga até dia 20..."
            placeholderTextColor="#ABB"
          />
        </View>

        <View style={styles.row}>
          <View style={[styles.inputGroup, {flex: 1, marginRight: 10}]}>
            <Text style={styles.label}>AUTOR / SETOR</Text>
            <TextInput 
              style={styles.input} 
              value={autor} 
              onChangeText={setAutor} 
              placeholder="Ex: Direção"
              placeholderTextColor="#ABB"
            />
          </View>

          <View style={[styles.inputGroup, {flex: 1}]}>
            <Text style={styles.label}>TAGS (Separadas por vírgula)</Text>
            <TextInput 
              style={styles.input} 
              value={tagsInput} 
              onChangeText={setTagsInput} 
              placeholder="Ex: Exatas, Avisos"
              placeholderTextColor="#ABB"
            />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>CONTEÚDO COMPLETO</Text>
          <TextInput 
            style={[styles.input, styles.textArea]} 
            value={conteudo} 
            onChangeText={setConteudo} 
            multiline 
            numberOfLines={8}
            placeholder="Escreva todo o texto do post aqui..." 
            placeholderTextColor="#ABB"
          />
        </View>

        <TouchableOpacity 
          style={[styles.btnSalvar, loading && { opacity: 0.7 }]} 
          onPress={salvar}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.btnText}>{postId ? "SALVAR ALTERAÇÕES" : "PUBLICAR POST"}</Text>
          )}
        </TouchableOpacity>
        
        <View style={{height: 30}} /> {/* Spacer final */}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingHorizontal: 20, 
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0'
  },
  headerTitle: { fontSize: 16, fontWeight: '900', color: '#1A1A2E', letterSpacing: 1 },
  backBtn: { padding: 5 },
  scrollContent: { padding: 25 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  catLabel: { 
    alignSelf: 'flex-start', 
    backgroundColor: '#FFF0F5', 
    color: '#E91E63', 
    paddingHorizontal: 12, 
    paddingVertical: 4, 
    borderRadius: 8, 
    fontSize: 12, 
    fontWeight: '800',
    marginBottom: 20
  },
  uploadArea: { 
    width: '100%', 
    height: 200, 
    backgroundColor: '#F8F9FA', 
    borderRadius: 20, 
    overflow: 'hidden', 
    marginBottom: 25, 
    borderWidth: 2, 
    borderColor: '#F0F0F0', 
    borderStyle: 'dashed',
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  preview: { width: '100%', height: '100%' },
  placeholder: { alignItems: 'center' },
  placeholderText: { color: '#E91E63', fontWeight: 'bold', marginTop: 10, fontSize: 13 },
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 11, fontWeight: 'bold', color: '#888', marginBottom: 8, marginLeft: 5 },
  input: { 
    backgroundColor: '#F8F9FA', 
    borderRadius: 15, 
    padding: 18, 
    fontSize: 14, 
    color: '#1A1A2E',
    borderWidth: 1,
    borderColor: '#EEE'
  },
  textArea: { height: 160, textAlignVertical: 'top' },
  btnSalvar: { 
    backgroundColor: '#E91E63', 
    padding: 20, 
    borderRadius: 18, 
    alignItems: 'center', 
    marginTop: 10,
    elevation: 4,
    shadowColor: '#E91E63',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5
  },
  btnText: { color: '#FFF', fontWeight: 'bold', fontSize: 16, letterSpacing: 1 }
});