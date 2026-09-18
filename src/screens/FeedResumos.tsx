import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, FlatList,
  SafeAreaView, StatusBar, ActivityIndicator, Modal, TextInput,
  KeyboardAvoidingView, Platform, Image, Alert,
} from 'react-native';
import { db } from '../config/firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppSettings } from '../contexts/AppSettingsContext';
import { CORES_SYMBIUS } from './Boasvindas';
import SymbiusTabBar from '../components/SymbiusTabBar';
import { F } from '../constants/theme';
import {
  Resumo, buscarResumos, criarResumo, alternarCurtidaResumo,
  editarResumo, apagarResumo, alternarPrivacidadeResumo,
} from '../services/resumosService';

// ══════════════════════════════════════════════════════════════════════
// ⚠️  TELA DE TESTE — Feed de Resumos ("Symbius"). Feature nova de verdade:
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
  const [resumoEditando, setResumoEditando] = useState<Resumo | null>(null);
  const [menuResumo, setMenuResumo] = useState<Resumo | null>(null);

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
    const lista = await buscarResumos(aba, 30, uid);
    setResumos(lista);
    setLoading(false);
  }, [aba, uid]);

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

  const fecharModalPublicar = () => {
    setModalVisible(false);
    setResumoEditando(null);
    setMateria(''); setTitulo(''); setCorpo('');
  };

  const abrirModalNovo = () => {
    setResumoEditando(null);
    setMateria(''); setTitulo(''); setCorpo('');
    setModalVisible(true);
  };

  const abrirModalEditar = (item: Resumo) => {
    setResumoEditando(item);
    setMateria(item.materia);
    setTitulo(item.titulo);
    setCorpo(item.corpo);
    setModalVisible(true);
  };

  const handlePublicar = async () => {
    if (!uid || !titulo.trim() || !corpo.trim() || publicando) return;
    setPublicando(true);

    if (resumoEditando) {
      const ok = await editarResumo(resumoEditando.id, { materia, titulo, corpo });
      setPublicando(false);
      if (ok) {
        const materiaFinal = materia.trim() || 'Geral';
        const tituloFinal = titulo.trim();
        const corpoFinal = corpo.trim();
        setResumos(prev => prev.map(r => r.id === resumoEditando.id
          ? { ...r, materia: materiaFinal, titulo: tituloFinal, corpo: corpoFinal }
          : r));
        fecharModalPublicar();
      }
      return;
    }

    const ok = await criarResumo({
      autorUid: uid, autorNome: meuNome, autorFoto: minhaFoto,
      materia, titulo, corpo,
    });
    setPublicando(false);
    if (ok) {
      fecharModalPublicar();
      setAba('recentes');
      carregarResumos();
    }
  };

  const handleAlternarPrivacidade = async (item: Resumo) => {
    setMenuResumo(null);
    const privadoAtual = !!item.privado;
    setResumos(prev => prev.map(r => r.id === item.id ? { ...r, privado: !privadoAtual } : r));
    await alternarPrivacidadeResumo(item.id, privadoAtual);
  };

  const handleApagar = (item: Resumo) => {
    setMenuResumo(null);
    Alert.alert(
      'Apagar resumo?',
      'Essa ação não pode ser desfeita.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Apagar',
          style: 'destructive',
          onPress: async () => {
            setResumos(prev => prev.filter(r => r.id !== item.id));
            await apagarResumo(item.id);
          },
        },
      ],
    );
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
              <Ionicons name="person" size={16} color={CORES_SYMBIUS.textoSec} />
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={[styles.autorLinha, { fontSize: fs(12.5) }]} numberOfLines={1}>
              <Text style={styles.autorNome}>{item.autorNome}</Text> compartilhou um resumo
            </Text>
            <View style={styles.materiaTempoRow}>
              <Text style={[styles.materiaTempo, { fontSize: fs(11) }]}>
                {item.materia} · {formatarTempo(item.criadoEm)}
              </Text>
              {item.privado && (
                <View style={styles.privadoBadge}>
                  <Ionicons name="eye-off" size={9} color={CORES_SYMBIUS.laranjaTexto} />
                  <Text style={styles.privadoBadgeTxt}>Privado</Text>
                </View>
              )}
            </View>
          </View>
          {uid && item.autorUid === uid && (
            <TouchableOpacity
              onPress={() => setMenuResumo(item)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="ellipsis-horizontal" size={18} color={CORES_SYMBIUS.textoSec} />
            </TouchableOpacity>
          )}
        </View>

        <Text style={[styles.titulo, { fontSize: fs(14.5) }]}>{item.titulo}</Text>
        <Text style={[styles.corpo, { fontSize: fs(12.5) }]} numberOfLines={3}>{item.corpo}</Text>

        <TouchableOpacity
          style={styles.curtidaBtn}
          onPress={() => handleCurtir(item)}
          disabled={processandoCurtida === item.id}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name={curti ? 'heart' : 'heart-outline'} size={16} color={curti ? CORES_SYMBIUS.verdeEscuro : CORES_SYMBIUS.textoSec} />
          <Text style={[styles.curtidaTxt, { fontSize: fs(12), color: curti ? CORES_SYMBIUS.verdeEscuro : CORES_SYMBIUS.textoSec }]}>
            {item.curtidasCount || 0}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={CORES_SYMBIUS.fundo} />

      <View style={[styles.header, { paddingTop: insets.top || 12 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="chevron-back" size={24} color={CORES_SYMBIUS.texto} />
        </TouchableOpacity>
        <Text style={[styles.headerTitulo, { fontSize: fs(17) }]}>Feed de Resumos</Text>
        <TouchableOpacity onPress={abrirModalNovo} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="add-circle" size={26} color={CORES_SYMBIUS.verdeEscuro} />
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
        <ActivityIndicator style={{ marginTop: 60 }} color={CORES_SYMBIUS.verdeEscuro} size="large" />
      ) : resumos.length === 0 ? (
        <View style={styles.vazio}>
          <FontAwesome5 name="book-open" size={36} color={CORES_SYMBIUS.borda} />
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
      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={fecharModalPublicar}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitulo, { fontSize: fs(15) }]}>{resumoEditando ? 'Editar resumo' : 'Novo resumo'}</Text>
              <TouchableOpacity onPress={fecharModalPublicar} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" size={22} color={CORES_SYMBIUS.texto} />
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.input}
              placeholder="Matéria (ex: Matemática)"
              placeholderTextColor={CORES_SYMBIUS.textoSec}
              value={materia}
              onChangeText={setMateria}
            />
            <TextInput
              style={styles.input}
              placeholder="Título do resumo"
              placeholderTextColor={CORES_SYMBIUS.textoSec}
              value={titulo}
              onChangeText={setTitulo}
            />
            <TextInput
              style={[styles.input, styles.inputMultilinha]}
              placeholder="Escreva o resumo aqui..."
              placeholderTextColor={CORES_SYMBIUS.textoSec}
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
                ? <ActivityIndicator color={CORES_SYMBIUS.fundo} />
                : <Text style={styles.btnPublicarTxt}>{resumoEditando ? 'Salvar' : 'Publicar'}</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Menu de ações do dono do resumo (editar / privacidade / apagar) */}
      <Modal visible={!!menuResumo} transparent animationType="fade" onRequestClose={() => setMenuResumo(null)}>
        <TouchableOpacity style={styles.menuOverlay} activeOpacity={1} onPress={() => setMenuResumo(null)}>
          <View style={styles.menuPopup}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => { if (menuResumo) { const item = menuResumo; setMenuResumo(null); abrirModalEditar(item); } }}
            >
              <Ionicons name="create-outline" size={18} color={CORES_SYMBIUS.texto} />
              <Text style={styles.menuItemTxt}>Editar</Text>
            </TouchableOpacity>
            <View style={styles.menuDivider} />
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => menuResumo && handleAlternarPrivacidade(menuResumo)}
            >
              <Ionicons name={menuResumo?.privado ? 'eye-outline' : 'eye-off-outline'} size={18} color={CORES_SYMBIUS.texto} />
              <Text style={styles.menuItemTxt}>{menuResumo?.privado ? 'Tornar público' : 'Tornar privado'}</Text>
            </TouchableOpacity>
            <View style={styles.menuDivider} />
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => menuResumo && handleApagar(menuResumo)}
            >
              <Ionicons name="trash-outline" size={18} color="#D64545" />
              <Text style={[styles.menuItemTxt, { color: '#D64545' }]}>Apagar</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <SymbiusTabBar ativa="feed" navigation={navigation} uid={uid} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: CORES_SYMBIUS.fundo },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 18, paddingBottom: 14,
  },
  headerTitulo: { color: CORES_SYMBIUS.texto, fontFamily: F.black },

  abasRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 18, paddingBottom: 14 },
  abaPill: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    borderWidth: 1, borderColor: CORES_SYMBIUS.borda, backgroundColor: CORES_SYMBIUS.fundoCard,
  },
  abaPillAtiva: { backgroundColor: CORES_SYMBIUS.verdeEscuro, borderColor: CORES_SYMBIUS.verdeEscuro },
  abaTxt: { color: CORES_SYMBIUS.textoSec, fontFamily: F.bold },
  abaTxtAtiva: { color: CORES_SYMBIUS.fundo },

  lista: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 40 },
  card: {
    backgroundColor: CORES_SYMBIUS.fundoCard, borderRadius: 16, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: CORES_SYMBIUS.borda,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  avatar: { width: 32, height: 32, borderRadius: 16 },
  avatarFallback: { backgroundColor: CORES_SYMBIUS.fundo, alignItems: 'center', justifyContent: 'center' },
  autorLinha: { color: CORES_SYMBIUS.texto, fontFamily: F.medium },
  autorNome: { fontFamily: F.black },
  materiaTempoRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 1 },
  materiaTempo: { color: CORES_SYMBIUS.textoSec, fontFamily: F.medium },
  privadoBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: CORES_SYMBIUS.fundoLaranjaClaro, borderRadius: 8,
    paddingHorizontal: 6, paddingVertical: 1.5,
  },
  privadoBadgeTxt: { color: CORES_SYMBIUS.laranjaTexto, fontFamily: F.bold, fontSize: 9 },

  titulo: { color: CORES_SYMBIUS.texto, fontFamily: F.black, marginBottom: 4 },
  corpo: { color: CORES_SYMBIUS.textoSec, lineHeight: 18, marginBottom: 10 },

  curtidaBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start' },
  curtidaTxt: { fontFamily: F.bold },

  vazio: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, paddingHorizontal: 40 },
  vazioTxt: { color: CORES_SYMBIUS.textoSec, textAlign: 'center', lineHeight: 20, fontFamily: F.medium },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: CORES_SYMBIUS.fundo, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, paddingBottom: 32, gap: 12,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  modalTitulo: { color: CORES_SYMBIUS.texto, fontFamily: F.black },
  input: {
    backgroundColor: CORES_SYMBIUS.fundoCard, borderRadius: 12, borderWidth: 1, borderColor: CORES_SYMBIUS.borda,
    paddingHorizontal: 14, paddingVertical: 12, color: CORES_SYMBIUS.texto, fontSize: 14,
  },
  inputMultilinha: { minHeight: 100 },
  btnPublicar: { backgroundColor: CORES_SYMBIUS.verdeEscuro, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  btnDesabilitado: { opacity: 0.5 },
  btnPublicarTxt: { color: CORES_SYMBIUS.fundo, fontFamily: F.black, fontSize: 14.5 },

  menuOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: 30 },
  menuPopup: {
    backgroundColor: CORES_SYMBIUS.fundoCard, borderRadius: 16, width: '100%', maxWidth: 280,
    paddingVertical: 6, overflow: 'hidden',
  },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 13 },
  menuItemTxt: { color: CORES_SYMBIUS.texto, fontFamily: F.medium, fontSize: 14 },
  menuDivider: { height: 1, backgroundColor: CORES_SYMBIUS.borda, marginHorizontal: 12 },
});
