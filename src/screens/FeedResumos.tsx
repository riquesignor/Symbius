import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, FlatList,
  SafeAreaView, StatusBar, ActivityIndicator, Modal, TextInput,
  KeyboardAvoidingView, Platform, Image,
} from 'react-native';
import { db } from '../config/firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppSettings } from '../contexts/AppSettingsContext';
import { CORES_SABE } from './Boasvindas';
import SabeTabBar from '../components/SabeTabBar';
import { F } from '../constants/theme';
import {
  Resumo, buscarResumos, criarResumo, alternarCurtidaResumo,
} from '../services/resumosService';

// ══════════════════════════════════════════════════════════════════════
// ⚠️  TELA DE TESTE — Feed de Resumos ("Sabé"). Feature nova de verdade:
// leitura/escrita real na collection `resumos` do Firestore (não é mock).
// ══════════════════════════════════════════════════════════════════════

type Aba = 'recentes' | 'populares';

const formatarTempo = (timestamp: any): string => {
  if (!timestamp?.toDate) return 'agora';
  const diffMs = Date.now() - timestamp.toDate().getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
};

export default function FeedResumos({ navigation, route }: any) {
  const insets = useSafeAreaInsets();
  const { fonteScale } = useAppSettings();
  const fs = (s: number) => s * fonteScale;

  const [uid, setUid] = useState<string | null>(route?.params?.uid || null);
  const [meuNome, setMeuNome] = useState('Anônimo');
  const [minhaFoto, setMinhaFoto] = useState<string | null>(null);

  const [aba, setAba] = useState<Aba>('recentes');
  const [resumos, setResumos] = useState<Resumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [processandoCurtida, setProcessandoCurtida] = useState<string | null>(null);

  const [modalVisible, setModalVisible] = useState(false);
  const [materia, setMateria] = useState('');
  const [titulo, setTitulo] = useState('');
  const [corpo, setCorpo] = useState('');
  const [publicando, setPublicando] = useState(false);

  const carregarPerfil = useCallback(async () => {
    let uidAtual = uid;
    if (!uidAtual) {
      uidAtual = await AsyncStorage.getItem('uid');
      if (uidAtual) setUid(uidAtual);
    }
    if (!uidAtual) return;
    try {
      const snap = await getDoc(doc(db, 'usuarios', uidAtual));
      if (snap.exists()) {
        const d = snap.data() as any;
        setMeuNome(d.nome_completo || 'Anônimo');
        setMinhaFoto(d.foto_url || null);
      }
    } catch (e) { console.log('Erro ao carregar perfil do feed:', e); }
  }, [uid]);

  const carregarResumos = useCallback(async () => {
    setLoading(true);
    const lista = await buscarResumos(aba);
    setResumos(lista);
    setLoading(false);
  }, [aba]);

  useEffect(() => { carregarPerfil(); }, [carregarPerfil]);
  useEffect(() => { carregarResumos(); }, [carregarResumos]);

  const handleCurtir = async (item: Resumo) => {
    if (!uid || processandoCurtida) return;
    const jaCurtiu = item.curtidas?.includes(uid);
    setProcessandoCurtida(item.id);
    // Atualização otimista
    setResumos(prev => prev.map(r => r.id === item.id ? {
      ...r,
      curtidasCount: r.curtidasCount + (jaCurtiu ? -1 : 1),
      curtidas: jaCurtiu ? r.curtidas.filter(u => u !== uid) : [...r.curtidas, uid],
    } : r));
    await alternarCurtidaResumo(item.id, uid, !!jaCurtiu);
    setProcessandoCurtida(null);
  };

  const handlePublicar = async () => {
    if (!uid || !titulo.trim() || !corpo.trim() || publicando) return;
    setPublicando(true);
    const ok = await criarResumo({
      autorUid: uid, autorNome: meuNome, autorFoto: minhaFoto,
      materia, titulo, corpo,
    });
    setPublicando(false);
    if (ok) {
      setModalVisible(false);
      setMateria(''); setTitulo(''); setCorpo('');
      setAba('recentes');
      carregarResumos();
    }
  };

  const renderItem = ({ item }: { item: Resumo }) => {
    const curti = !!(uid && item.curtidas?.includes(uid));
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          {item.autorFoto ? (
            <Image source={{ uri: item.autorFoto }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Ionicons name="person" size={16} color={CORES_SABE.textoSec} />
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={[styles.autorLinha, { fontSize: fs(12.5) }]} numberOfLines={1}>
              <Text style={styles.autorNome}>{item.autorNome}</Text> compartilhou um resumo
            </Text>
            <Text style={[styles.materiaTempo, { fontSize: fs(11) }]}>
              {item.materia} · {formatarTempo(item.criadoEm)}
            </Text>
          </View>
        </View>

        <Text style={[styles.titulo, { fontSize: fs(14.5) }]}>{item.titulo}</Text>
        <Text style={[styles.corpo, { fontSize: fs(12.5) }]} numberOfLines={3}>{item.corpo}</Text>

        <TouchableOpacity
          style={styles.curtidaBtn}
          onPress={() => handleCurtir(item)}
          disabled={processandoCurtida === item.id}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name={curti ? 'heart' : 'heart-outline'} size={16} color={curti ? CORES_SABE.verdeEscuro : CORES_SABE.textoSec} />
          <Text style={[styles.curtidaTxt, { fontSize: fs(12), color: curti ? CORES_SABE.verdeEscuro : CORES_SABE.textoSec }]}>
            {item.curtidasCount || 0}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={CORES_SABE.fundo} />

      <View style={[styles.header, { paddingTop: insets.top || 12 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="chevron-back" size={24} color={CORES_SABE.texto} />
        </TouchableOpacity>
        <Text style={[styles.headerTitulo, { fontSize: fs(17) }]}>Feed de Resumos</Text>
        <TouchableOpacity onPress={() => setModalVisible(true)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="add-circle" size={26} color={CORES_SABE.verdeEscuro} />
        </TouchableOpacity>
      </View>

      <View style={styles.abasRow}>
        {([{ chave: 'recentes', label: 'Recentes' }, { chave: 'populares', label: 'Mais Populares' }] as { chave: Aba; label: string }[]).map(a => {
          const ativa = a.chave === aba;
          return (
            <TouchableOpacity
              key={a.chave}
              style={[styles.abaPill, ativa && styles.abaPillAtiva]}
              onPress={() => setAba(a.chave)}
            >
              <Text style={[styles.abaTxt, ativa && styles.abaTxtAtiva, { fontSize: fs(12.5) }]}>{a.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 60 }} color={CORES_SABE.verdeEscuro} size="large" />
      ) : resumos.length === 0 ? (
        <View style={styles.vazio}>
          <FontAwesome5 name="book-open" size={36} color={CORES_SABE.borda} />
          <Text style={[styles.vazioTxt, { fontSize: fs(13) }]}>
            Nenhum resumo publicado ainda.{'\n'}Toque em + pra ser o primeiro!
          </Text>
        </View>
      ) : (
        <FlatList
          data={resumos}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.lista}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Modal de criação */}
      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitulo, { fontSize: fs(15) }]}>Novo resumo</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" size={22} color={CORES_SABE.texto} />
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.input}
              placeholder="Matéria (ex: Matemática)"
              placeholderTextColor={CORES_SABE.textoSec}
              value={materia}
              onChangeText={setMateria}
            />
            <TextInput
              style={styles.input}
              placeholder="Título do resumo"
              placeholderTextColor={CORES_SABE.textoSec}
              value={titulo}
              onChangeText={setTitulo}
            />
            <TextInput
              style={[styles.input, styles.inputMultilinha]}
              placeholder="Escreva o resumo aqui..."
              placeholderTextColor={CORES_SABE.textoSec}
              value={corpo}
              onChangeText={setCorpo}
              multiline
              textAlignVertical="top"
            />

            <TouchableOpacity
              style={[styles.btnPublicar, (!titulo.trim() || !corpo.trim() || publicando) && styles.btnDesabilitado]}
              onPress={handlePublicar}
              disabled={!titulo.trim() || !corpo.trim() || publicando}
            >
              {publicando
                ? <ActivityIndicator color={CORES_SABE.fundo} />
                : <Text style={styles.btnPublicarTxt}>Publicar</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <SabeTabBar ativa="feed" navigation={navigation} uid={uid} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: CORES_SABE.fundo },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 18, paddingBottom: 14,
  },
  headerTitulo: { color: CORES_SABE.texto, fontFamily: F.black },

  abasRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 18, paddingBottom: 14 },
  abaPill: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    borderWidth: 1, borderColor: CORES_SABE.borda, backgroundColor: CORES_SABE.fundoCard,
  },
  abaPillAtiva: { backgroundColor: CORES_SABE.verdeEscuro, borderColor: CORES_SABE.verdeEscuro },
  abaTxt: { color: CORES_SABE.textoSec, fontFamily: F.bold },
  abaTxtAtiva: { color: CORES_SABE.fundo },

  lista: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 40 },
  card: {
    backgroundColor: CORES_SABE.fundoCard, borderRadius: 16, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: CORES_SABE.borda,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  avatar: { width: 32, height: 32, borderRadius: 16 },
  avatarFallback: { backgroundColor: CORES_SABE.fundo, alignItems: 'center', justifyContent: 'center' },
  autorLinha: { color: CORES_SABE.texto, fontFamily: F.medium },
  autorNome: { fontFamily: F.black },
  materiaTempo: { color: CORES_SABE.textoSec, fontFamily: F.medium, marginTop: 1 },

  titulo: { color: CORES_SABE.texto, fontFamily: F.black, marginBottom: 4 },
  corpo: { color: CORES_SABE.textoSec, lineHeight: 18, marginBottom: 10 },

  curtidaBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start' },
  curtidaTxt: { fontFamily: F.bold },

  vazio: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, paddingHorizontal: 40 },
  vazioTxt: { color: CORES_SABE.textoSec, textAlign: 'center', lineHeight: 20, fontFamily: F.medium },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: CORES_SABE.fundo, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, paddingBottom: 32, gap: 12,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  modalTitulo: { color: CORES_SABE.texto, fontFamily: F.black },
  input: {
    backgroundColor: CORES_SABE.fundoCard, borderRadius: 12, borderWidth: 1, borderColor: CORES_SABE.borda,
    paddingHorizontal: 14, paddingVertical: 12, color: CORES_SABE.texto, fontSize: 14,
  },
  inputMultilinha: { minHeight: 100 },
  btnPublicar: { backgroundColor: CORES_SABE.verdeEscuro, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  btnDesabilitado: { opacity: 0.5 },
  btnPublicarTxt: { color: CORES_SABE.fundo, fontFamily: F.black, fontSize: 14.5 },
});
