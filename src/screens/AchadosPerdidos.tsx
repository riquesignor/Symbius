import React, { useState, useEffect } from 'react';
import {
  StyleSheet, Text, View, FlatList, TouchableOpacity,
  SafeAreaView, StatusBar, Modal, TextInput, ScrollView,
  ActivityIndicator, Alert, Platform
} from 'react-native';
import { db } from '../config/firebaseConfig';
import {
  collection, query, orderBy, onSnapshot,
  addDoc, updateDoc, doc, serverTimestamp
} from 'firebase/firestore';
import { Ionicons, MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';

const CORES = {
  azulEscuro: '#0B2046',
  rosa: '#E51C6A',
  amarelo: '#FFC82C',
  verde: '#10B981',
  fundo: '#F5F7FA',
  branco: '#FFFFFF',
  cinzaClaro: '#E2E8F0',
  textoSecundario: '#64748B',
};

const CATEGORIAS = [
  { label: 'Eletrônico',       icon: 'phone-portrait-outline',  color: '#6366F1' },
  { label: 'Vestuário',        icon: 'shirt-outline',           color: '#F59E0B' },
  { label: 'Material Escolar', icon: 'book-outline',            color: '#10B981' },
  { label: 'Documentos',       icon: 'document-text-outline',   color: '#E51C6A' },
];

const LOCAIS = [
  'Pátio Central', 'Laboratório de Informática', 'Laboratório de Design',
  'Laboratório de Nutrição', 'Biblioteca', 'Quadra', 'Refeitório',
  'Corredor Bloco A', 'Corredor Bloco B', 'Secretaria', 'Sala de Aula', 'Outro',
];

const getCatConfig = (cat: string) =>
  CATEGORIAS.find(c => c.label === cat) || { icon: 'help-outline', color: CORES.textoSecundario };

const getStatusConfig = (status: string) =>
  status === 'disponivel'
    ? { label: 'Disponível', color: CORES.verde,   bg: '#D1FAE5' }
    : { label: 'Retirado',   color: '#6B7280',     bg: '#F3F4F6' };

export default function AchadosPerdidos({ navigation, route }: any) {
  const [itens, setItens] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroCategoria, setFiltroCategoria] = useState('Todos');
  const [filtroStatus, setFiltroStatus] = useState('disponivel');
  const [modalForm, setModalForm] = useState(false);
  const [modalDetalhe, setModalDetalhe] = useState(false);
  const [itemSelecionado, setItemSelecionado] = useState<any>(null);
  const [salvando, setSalvando] = useState(false);

  // Dados do usuário vindos via route.params
  const meuUid = route?.params?.uid;
  const meuTipo = route?.params?.tipo;
  const isAdmin = meuTipo === 'Administrador';

  // Form
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [categoria, setCategoria] = useState(CATEGORIAS[0].label);
  const [local, setLocal] = useState(LOCAIS[0]);
  const [showCatModal, setShowCatModal] = useState(false);
  const [showLocalModal, setShowLocalModal] = useState(false);
  const [editando, setEditando] = useState<any>(null);

  useEffect(() => {
    const q = query(collection(db, 'achados_perdidos'), orderBy('data_postagem', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setItens(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const itensFiltrados = itens.filter(i => {
    const catOk = filtroCategoria === 'Todos' || i.categoria === filtroCategoria;
    const statusOk = filtroStatus === 'todos' || i.status === filtroStatus;
    return catOk && statusOk;
  });

  const abrirFormNovo = () => {
    setEditando(null);
    setTitulo(''); setDescricao('');
    setCategoria(CATEGORIAS[0].label); setLocal(LOCAIS[0]);
    setModalForm(true);
  };

  const abrirFormEditar = (item: any) => {
    setEditando(item);
    setTitulo(item.titulo); setDescricao(item.descricao || '');
    setCategoria(item.categoria); setLocal(item.local_encontrado);
    setModalDetalhe(false);
    setModalForm(true);
  };

  const salvar = async () => {
    if (!titulo.trim()) { Alert.alert('Atenção', 'Digite o título do item.'); return; }
    setSalvando(true);
    try {
      if (editando) {
        await updateDoc(doc(db, 'achados_perdidos', editando.id), {
          titulo: titulo.trim(),
          descricao: descricao.trim(),
          categoria,
          local_encontrado: local,
        });
      } else {
        await addDoc(collection(db, 'achados_perdidos'), {
          titulo: titulo.trim(),
          descricao: descricao.trim(),
          categoria,
          local_encontrado: local,
          status: 'disponivel',
          data_postagem: serverTimestamp(),
        });
      }
      setModalForm(false);
    } catch (e) {
      Alert.alert('Erro', 'Falha ao salvar.');
    } finally {
      setSalvando(false);
    }
  };

  const marcarRetirado = async (item: any) => {
    const novoStatus = item.status === 'disponivel' ? 'retirado' : 'disponivel';
    Alert.alert(
      novoStatus === 'retirado' ? 'Marcar como Retirado?' : 'Marcar como Disponível?',
      novoStatus === 'retirado'
        ? 'Confirma que o dono buscou o item?'
        : 'Recolocar o item como disponível?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar', onPress: async () => {
            await updateDoc(doc(db, 'achados_perdidos', item.id), { status: novoStatus });
            setItemSelecionado({ ...item, status: novoStatus });
          }
        }
      ]
    );
  };

  const renderItem = ({ item }: any) => {
    const cat = getCatConfig(item.categoria);
    const st = getStatusConfig(item.status);
    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.8}
        onPress={() => { setItemSelecionado(item); setModalDetalhe(true); }}
      >
        <View style={[styles.cardIconBox, { backgroundColor: cat.color + '18' }]}>
          <Ionicons name={cat.icon as any} size={28} color={cat.color} />
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.cardTitulo} numberOfLines={1}>{item.titulo}</Text>
          <Text style={styles.cardLocal} numberOfLines={1}>
            <Ionicons name="location-outline" size={12} /> {item.local_encontrado}
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: st.bg }]}>
          <Text style={[styles.statusText, { color: st.color }]}>{st.label}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={CORES.azulEscuro} />

      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.btnVoltar}>
          <Ionicons name="arrow-back" size={22} color={CORES.branco} />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitulo}>Achados & Perdidos</Text>
          <Text style={styles.headerSub}>Secretaria do Anchieta</Text>
        </View>
        {isAdmin && (
          <TouchableOpacity style={styles.btnAdd} onPress={abrirFormNovo}>
            <Ionicons name="add" size={24} color={CORES.branco} />
          </TouchableOpacity>
        )}
      </View>

      {/* FILTROS STATUS */}
      <View style={styles.filtroStatusRow}>
        {[
          { key: 'disponivel', label: 'Disponíveis' },
          { key: 'retirado',   label: 'Retirados'   },
          { key: 'todos',      label: 'Todos'        },
        ].map(f => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filtroStatusBtn, filtroStatus === f.key && styles.filtroStatusAtivo]}
            onPress={() => setFiltroStatus(f.key)}
          >
            <Text style={[styles.filtroStatusText, filtroStatus === f.key && styles.filtroStatusTextAtivo]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* FILTROS CATEGORIA */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtrosCatRow}>
        {['Todos', ...CATEGORIAS.map(c => c.label)].map(cat => {
          const conf = cat === 'Todos' ? null : getCatConfig(cat);
          const ativo = filtroCategoria === cat;
          return (
            <TouchableOpacity
              key={cat}
              style={[styles.filtroCat, ativo && { backgroundColor: conf?.color || CORES.azulEscuro, borderColor: 'transparent' }]}
              onPress={() => setFiltroCategoria(cat)}
            >
              {conf && <Ionicons name={conf.icon as any} size={14} color={ativo ? '#FFF' : conf.color} />}
              <Text style={[styles.filtroCatText, ativo && { color: '#FFF' }]}>{cat}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* LISTA */}
      {loading ? (
        <View style={styles.centro}><ActivityIndicator size="large" color={CORES.rosa} /></View>
      ) : (
        <FlatList
          data={itensFiltrados}
          keyExtractor={i => i.id}
          renderItem={renderItem}
          contentContainerStyle={styles.lista}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.centro}>
              <MaterialCommunityIcons name="magnify" size={56} color={CORES.cinzaClaro} />
              <Text style={styles.txtVazio}>Nenhum item encontrado</Text>
            </View>
          }
        />
      )}

      {/* FAB admin em mobile */}
      {isAdmin && (
        <TouchableOpacity style={styles.fab} onPress={abrirFormNovo}>
          <Ionicons name="add" size={28} color={CORES.branco} />
        </TouchableOpacity>
      )}

      {/* ── MODAL DETALHE ── */}
      <Modal visible={modalDetalhe} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            {itemSelecionado && (() => {
              const cat = getCatConfig(itemSelecionado.categoria);
              const st = getStatusConfig(itemSelecionado.status);
              return (
                <>
                  <View style={styles.modalHandle} />
                  <View style={[styles.detalheIconBox, { backgroundColor: cat.color + '18' }]}>
                    <Ionicons name={cat.icon as any} size={40} color={cat.color} />
                  </View>
                  <Text style={styles.detalheTitulo}>{itemSelecionado.titulo}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: st.bg, alignSelf: 'center', marginBottom: 20 }]}>
                    <Text style={[styles.statusText, { color: st.color }]}>{st.label}</Text>
                  </View>

                  <View style={styles.detalheRow}>
                    <Ionicons name="location-outline" size={18} color={CORES.textoSecundario} />
                    <Text style={styles.detalheInfo}>{itemSelecionado.local_encontrado}</Text>
                  </View>
                  <View style={styles.detalheRow}>
                    <Ionicons name="pricetag-outline" size={18} color={CORES.textoSecundario} />
                    <Text style={styles.detalheInfo}>{itemSelecionado.categoria}</Text>
                  </View>
                  {itemSelecionado.descricao ? (
                    <View style={styles.detalheDescBox}>
                      <Text style={styles.detalheDescLabel}>Descrição</Text>
                      <Text style={styles.detalheDesc}>{itemSelecionado.descricao}</Text>
                    </View>
                  ) : null}

                  {isAdmin && (
                    <View style={styles.detalheAcoes}>
                      <TouchableOpacity
                        style={[styles.btnAcao, { backgroundColor: cat.color + '18', flex: 1 }]}
                        onPress={() => abrirFormEditar(itemSelecionado)}
                      >
                        <Ionicons name="create-outline" size={18} color={cat.color} />
                        <Text style={[styles.btnAcaoText, { color: cat.color }]}>Editar</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.btnAcao, {
                          backgroundColor: itemSelecionado.status === 'disponivel' ? '#D1FAE5' : '#FEE2E2',
                          flex: 1
                        }]}
                        onPress={() => marcarRetirado(itemSelecionado)}
                      >
                        <Ionicons
                          name={itemSelecionado.status === 'disponivel' ? 'checkmark-circle-outline' : 'refresh-outline'}
                          size={18}
                          color={itemSelecionado.status === 'disponivel' ? CORES.verde : CORES.rosa}
                        />
                        <Text style={[styles.btnAcaoText, {
                          color: itemSelecionado.status === 'disponivel' ? CORES.verde : CORES.rosa
                        }]}>
                          {itemSelecionado.status === 'disponivel' ? 'Retirado' : 'Disponível'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  <TouchableOpacity style={styles.btnFechar} onPress={() => setModalDetalhe(false)}>
                    <Text style={styles.btnFecharText}>Fechar</Text>
                  </TouchableOpacity>
                </>
              );
            })()}
          </View>
        </View>
      </Modal>

      {/* ── MODAL FORM ── */}
      <Modal visible={modalForm} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { paddingBottom: Platform.OS === 'ios' ? 40 : 24 }]}>
            <View style={styles.modalHandle} />
            <Text style={styles.formTitulo}>{editando ? 'Editar Item' : 'Novo Item Encontrado'}</Text>

            <Text style={styles.formLabel}>Título *</Text>
            <TextInput
              style={styles.formInput}
              placeholder="Ex: Chaveiro do Stitch"
              placeholderTextColor={CORES.textoSecundario}
              value={titulo}
              onChangeText={setTitulo}
            />

            <Text style={styles.formLabel}>Categoria *</Text>
            <TouchableOpacity style={styles.formSelect} onPress={() => setShowCatModal(true)}>
              <Text style={styles.formSelectText}>{categoria}</Text>
              <Ionicons name="chevron-down" size={18} color={CORES.textoSecundario} />
            </TouchableOpacity>

            <Text style={styles.formLabel}>Local Encontrado *</Text>
            <TouchableOpacity style={styles.formSelect} onPress={() => setShowLocalModal(true)}>
              <Text style={styles.formSelectText}>{local}</Text>
              <Ionicons name="chevron-down" size={18} color={CORES.textoSecundario} />
            </TouchableOpacity>

            <Text style={styles.formLabel}>Descrição</Text>
            <TextInput
              style={[styles.formInput, { height: 80, textAlignVertical: 'top' }]}
              placeholder="Detalhes extras sobre o item..."
              placeholderTextColor={CORES.textoSecundario}
              value={descricao}
              onChangeText={setDescricao}
              multiline
            />

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
              <TouchableOpacity
                style={[styles.btnFechar, { flex: 1, backgroundColor: CORES.cinzaClaro }]}
                onPress={() => setModalForm(false)}
              >
                <Text style={[styles.btnFecharText, { color: CORES.azulEscuro }]}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btnFechar, { flex: 1, backgroundColor: CORES.rosa }]}
                onPress={salvar}
                disabled={salvando}
              >
                {salvando
                  ? <ActivityIndicator color="#FFF" size="small" />
                  : <Text style={[styles.btnFecharText, { color: '#FFF' }]}>
                      {editando ? 'Salvar' : 'Registrar'}
                    </Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* SELETOR CATEGORIA */}
      <Modal visible={showCatModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.formTitulo}>Categoria</Text>
            {CATEGORIAS.map(c => (
              <TouchableOpacity
                key={c.label}
                style={styles.seletorItem}
                onPress={() => { setCategoria(c.label); setShowCatModal(false); }}
              >
                <Ionicons name={c.icon as any} size={20} color={c.color} />
                <Text style={styles.seletorItemText}>{c.label}</Text>
                {categoria === c.label && <Ionicons name="checkmark" size={18} color={CORES.rosa} />}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

      {/* SELETOR LOCAL */}
      <Modal visible={showLocalModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <ScrollView>
            <View style={[styles.modalSheet, { marginTop: 'auto' }]}>
              <View style={styles.modalHandle} />
              <Text style={styles.formTitulo}>Local Encontrado</Text>
              {LOCAIS.map(l => (
                <TouchableOpacity
                  key={l}
                  style={styles.seletorItem}
                  onPress={() => { setLocal(l); setShowLocalModal(false); }}
                >
                  <Ionicons name="location-outline" size={18} color={CORES.textoSecundario} />
                  <Text style={styles.seletorItemText}>{l}</Text>
                  {local === l && <Ionicons name="checkmark" size={18} color={CORES.rosa} />}
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: CORES.fundo },
  centro: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60, gap: 10 },
  txtVazio: { color: CORES.textoSecundario, fontSize: 15, fontWeight: '600' },

  header: { backgroundColor: CORES.azulEscuro, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 18, gap: 14 },
  btnVoltar: { padding: 4 },
  headerTitulo: { color: CORES.branco, fontSize: 18, fontWeight: '900' },
  headerSub: { color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: '600' },
  btnAdd: { marginLeft: 'auto' as any, backgroundColor: CORES.rosa, width: 36, height: 36, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },

  filtroStatusRow: { flexDirection: 'row', backgroundColor: CORES.branco, paddingHorizontal: 16, paddingVertical: 12, gap: 8, borderBottomWidth: 1, borderBottomColor: CORES.cinzaClaro },
  filtroStatusBtn: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20, backgroundColor: CORES.fundo },
  filtroStatusAtivo: { backgroundColor: CORES.azulEscuro },
  filtroStatusText: { fontSize: 13, fontWeight: '700', color: CORES.textoSecundario },
  filtroStatusTextAtivo: { color: CORES.branco },

  filtrosCatRow: { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  filtroCat: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: CORES.branco, borderWidth: 1, borderColor: CORES.cinzaClaro },
  filtroCatText: { fontSize: 13, fontWeight: '700', color: CORES.textoSecundario },

  lista: { paddingHorizontal: 16, paddingBottom: 100 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: CORES.branco, borderRadius: 18, padding: 14, marginBottom: 10, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, gap: 12 },
  cardIconBox: { width: 52, height: 52, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  cardBody: { flex: 1 },
  cardTitulo: { fontSize: 15, fontWeight: '800', color: CORES.azulEscuro },
  cardLocal: { fontSize: 12, color: CORES.textoSecundario, marginTop: 3, fontWeight: '600' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  statusText: { fontSize: 11, fontWeight: '800' },

  fab: { position: 'absolute', bottom: 24, right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: CORES.rosa, justifyContent: 'center', alignItems: 'center', elevation: 6, shadowColor: CORES.rosa, shadowOpacity: 0.4, shadowRadius: 8 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: CORES.branco, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 36 },
  modalHandle: { width: 40, height: 4, backgroundColor: CORES.cinzaClaro, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },

  detalheIconBox: { width: 72, height: 72, borderRadius: 24, justifyContent: 'center', alignItems: 'center', alignSelf: 'center', marginBottom: 14 },
  detalheTitulo: { fontSize: 22, fontWeight: '900', color: CORES.azulEscuro, textAlign: 'center', marginBottom: 8 },
  detalheRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  detalheInfo: { fontSize: 15, color: CORES.textoSecundario, fontWeight: '600' },
  detalheDescBox: { backgroundColor: CORES.fundo, borderRadius: 14, padding: 14, marginTop: 4, marginBottom: 16 },
  detalheDescLabel: { fontSize: 11, fontWeight: '800', color: CORES.textoSecundario, letterSpacing: 0.5, marginBottom: 6 },
  detalheDesc: { fontSize: 15, color: CORES.azulEscuro, lineHeight: 22 },
  detalheAcoes: { flexDirection: 'row', gap: 10, marginTop: 8, marginBottom: 16 },
  btnAcao: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 12, borderRadius: 14 },
  btnAcaoText: { fontWeight: '800', fontSize: 14 },

  formTitulo: { fontSize: 18, fontWeight: '900', color: CORES.azulEscuro, marginBottom: 20 },
  formLabel: { fontSize: 12, fontWeight: '800', color: CORES.textoSecundario, letterSpacing: 0.5, marginBottom: 6, marginTop: 12 },
  formInput: { backgroundColor: CORES.fundo, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: CORES.azulEscuro, borderWidth: 1, borderColor: CORES.cinzaClaro },
  formSelect: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: CORES.fundo, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 14, borderWidth: 1, borderColor: CORES.cinzaClaro },
  formSelectText: { fontSize: 15, color: CORES.azulEscuro, fontWeight: '600' },

  seletorItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: CORES.cinzaClaro },
  seletorItemText: { flex: 1, fontSize: 15, fontWeight: '700', color: CORES.azulEscuro },

  btnFechar: { backgroundColor: CORES.fundo, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  btnFecharText: { fontWeight: '800', fontSize: 15, color: CORES.textoSecundario },
});