import React, { useState, useEffect } from 'react';
import {
  StyleSheet, Text, View, FlatList, TouchableOpacity,
  SafeAreaView, StatusBar, Modal, TextInput, ScrollView,
  ActivityIndicator, Alert, Platform
} from 'react-native';
import { db } from '../config/firebaseConfig';
import {
  collection, query, orderBy, onSnapshot,
  addDoc, updateDoc, deleteDoc, doc, serverTimestamp
} from 'firebase/firestore';
import { Ionicons, MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';

const CORES = {
  azulEscuro: '#0B2046',
  rosa:        '#E51C6A',
  amarelo:     '#FFC82C',
  verde:       '#10B981',
  fundo:       '#F5F7FA',
  branco:      '#FFFFFF',
  cinzaClaro:  '#E2E8F0',
  textoSec:    '#64748B',
};

const CATEGORIAS = [
  { label: 'Eletrônicos',      icon: 'phone-portrait-outline', color: '#6366F1' },
  { label: 'Material Escolar', icon: 'book-outline',           color: '#10B981' },
  { label: 'Vestuário',        icon: 'shirt-outline',          color: '#F59E0B' },
  { label: 'Documentos',       icon: 'document-text-outline',  color: '#E51C6A' },
  { label: 'Outros',           icon: 'help-outline',           color: '#64748B' },
];

const LOCAIS = [
  'Pátio Central', 'Laboratório de Informática', 'Laboratório de Design',
  'Laboratório de Nutrição', 'Biblioteca', 'Quadra', 'Refeitório',
  'Corredor Bloco A', 'Corredor Bloco B', 'Secretaria', 'Sala de Aula', 'Outro',
];

const getCat    = (cat: string) => CATEGORIAS.find(c => c.label === cat) || { icon: 'help-outline', color: CORES.textoSec, label: cat };
const getStatus = (status: string) =>
  status === 'disponivel'
    ? { label: 'Disponível', color: CORES.verde,  bg: '#D1FAE5' }
    : { label: 'Retirado',   color: '#6B7280',    bg: '#F3F4F6' };

const capitalizarPrimeira = (str: string) =>
  str ? str.charAt(0).toUpperCase() + str.slice(1) : '';

export default function AchadosPerdidos({ navigation, route }: any) {
  const meuUid  = route?.params?.uid;
  const meuTipo = route?.params?.tipo;
  const isAdmin = meuTipo === 'Administrador';

  const [itens,          setItens]          = useState<any[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [salvando,       setSalvando]       = useState(false);
  const [filtroCategoria,setFiltroCategoria]= useState('Todos');
  const [filtroStatus,   setFiltroStatus]   = useState('disponivel');
  const [modalForm,      setModalForm]      = useState(false);
  const [modalDetalhe,   setModalDetalhe]   = useState(false);
  const [itemSelecionado,setItemSelecionado]= useState<any>(null);
  const [editando,       setEditando]       = useState<any>(null);

  // Campos do form
  const [titulo,        setTitulo]        = useState('');
  const [descricao,     setDescricao]     = useState('');
  const [categoria,     setCategoria]     = useState(CATEGORIAS[0].label);
  const [local,         setLocal]         = useState(LOCAIS[0]);
  const [showCatModal,  setShowCatModal]  = useState(false);
  const [showLocalModal,setShowLocalModal]= useState(false);

  // Listener em tempo real
  useEffect(() => {
    const q = query(collection(db, 'achados_perdidos'), orderBy('data_postagem', 'desc'));
    const unsub = onSnapshot(q, snap => {
      setItens(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const itensFiltrados = itens.filter(i => {
    const catOk    = filtroCategoria === 'Todos' || i.categoria === filtroCategoria;
    const statusOk = filtroStatus    === 'todos' || i.status    === filtroStatus;
    return catOk && statusOk;
  });

  // ── Form ──────────────────────────────────────────────────────
  const abrirFormNovo = () => {
    setEditando(null);
    setTitulo(''); setDescricao('');
    setCategoria(CATEGORIAS[0].label); setLocal(LOCAIS[0]);
    setModalDetalhe(false);
    setModalForm(true);
  };

  const abrirFormEditar = (item: any) => {
    setEditando(item);
    setTitulo(item.titulo);
    setDescricao(item.descricao || '');
    setCategoria(item.categoria);
    setLocal(item.local_encontrado);
    setModalDetalhe(false);
    setModalForm(true);
  };

  const salvar = async () => {
    if (!titulo.trim() || !local.trim()) {
      Alert.alert('Atenção', 'Nome do objeto e local são obrigatórios.');
      return;
    }
    setSalvando(true);
    try {
      const dados = {
        titulo:           capitalizarPrimeira(titulo.trim()),
        descricao:        capitalizarPrimeira(descricao.trim()),
        categoria,
        local_encontrado: capitalizarPrimeira(local),
      };
      if (editando) {
        await updateDoc(doc(db, 'achados_perdidos', editando.id), dados);
      } else {
        await addDoc(collection(db, 'achados_perdidos'), {
          ...dados,
          status:        'disponivel',
          data_postagem: serverTimestamp(),
        });
      }
      setModalForm(false);
    } catch {
      Alert.alert('Erro', 'Falha ao salvar. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  };

  // ── Ações admin ───────────────────────────────────────────────
  const alternarStatus = (item: any) => {
    const novoStatus = item.status === 'disponivel' ? 'retirado' : 'disponivel';
    Alert.alert(
      novoStatus === 'retirado' ? 'Marcar como Retirado?' : 'Marcar como Disponível?',
      novoStatus === 'retirado'
        ? 'Confirma que o dono buscou o item?'
        : 'Recolocar como disponível na secretaria?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Confirmar', onPress: async () => {
            await updateDoc(doc(db, 'achados_perdidos', item.id), { status: novoStatus });
            setItemSelecionado({ ...item, status: novoStatus });
          }
        }
      ]
    );
  };

  const excluirItem = (item: any) => {
    Alert.alert(
      'Excluir Item',
      `Deseja excluir "${item.titulo}"? Esta ação não tem volta.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Excluir', style: 'destructive', onPress: async () => {
            await deleteDoc(doc(db, 'achados_perdidos', item.id));
            setModalDetalhe(false);
          }
        }
      ]
    );
  };

  const formatarData = (timestamp: any) => {
    if (!timestamp) return '—';
    try {
      const d = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch { return '—'; }
  };

  // ── Card ──────────────────────────────────────────────────────
  const renderItem = ({ item, index }: any) => {
    const cat = getCat(item.categoria);
    const st  = getStatus(item.status);
    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.82}
        onPress={() => { setItemSelecionado(item); setModalDetalhe(true); }}
      >
        {/* Número sequencial decorativo */}
        <Text style={styles.cardSeq}>{String(index + 1).padStart(2, '0')}</Text>

        <View style={[styles.cardIconBox, { backgroundColor: cat.color + '15' }]}>
          <Ionicons name={cat.icon as any} size={26} color={cat.color} />
        </View>

        <View style={styles.cardBody}>
          <View style={[styles.catBadge, { backgroundColor: cat.color + '18', borderColor: cat.color + '40' }]}>
            <Text style={[styles.catBadgeText, { color: cat.color }]}>{item.categoria}</Text>
          </View>
          <Text style={styles.cardTitulo} numberOfLines={2}>{item.titulo}</Text>
          {item.descricao
            ? <Text style={styles.cardDesc} numberOfLines={2}>{item.descricao}</Text>
            : <Text style={[styles.cardDesc, { fontStyle: 'italic', color: CORES.cinzaClaro }]}>Sem descrição.</Text>
          }
          <View style={styles.cardMeta}>
            <View style={styles.metaItem}>
              <Ionicons name="location-outline" size={11} color={CORES.textoSec} />
              <Text style={styles.metaText}>{item.local_encontrado}</Text>
            </View>
            <View style={styles.metaItem}>
              <Ionicons name="calendar-outline" size={11} color={CORES.textoSec} />
              <Text style={styles.metaText}>{formatarData(item.data_postagem)}</Text>
            </View>
          </View>
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
        <View style={{ flex: 1 }}>
          <Text style={styles.headerEyebrow}>MURAL</Text>
          <Text style={styles.headerTitulo}>Achados & Perdidos</Text>
          <Text style={styles.headerSub}>Itens encontrados na escola</Text>
        </View>
        {isAdmin && (
          <TouchableOpacity style={styles.btnAdd} onPress={abrirFormNovo}>
            <Ionicons name="add" size={22} color={CORES.branco} />
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
          const conf  = cat === 'Todos' ? null : getCat(cat);
          const ativo = filtroCategoria === cat;
          return (
            <TouchableOpacity
              key={cat}
              style={[styles.filtroCat, ativo && { backgroundColor: conf?.color || CORES.azulEscuro, borderColor: 'transparent' }]}
              onPress={() => setFiltroCategoria(cat)}
            >
              {conf && <Ionicons name={conf.icon as any} size={13} color={ativo ? '#FFF' : conf.color} />}
              <Text style={[styles.filtroCatText, ativo && { color: '#FFF' }]}>{cat}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* CONTADOR */}
      <View style={styles.contadorRow}>
        <Text style={styles.contadorText}>
          {itensFiltrados.length === 0
            ? 'Nenhum item registrado'
            : `${itensFiltrados.length} item${itensFiltrados.length > 1 ? 's' : ''} registrado${itensFiltrados.length > 1 ? 's' : ''}`
          }
        </Text>
      </View>

      {/* LISTA */}
      {loading
        ? <View style={styles.centro}><ActivityIndicator size="large" color={CORES.rosa} /></View>
        : (
          <FlatList
            data={itensFiltrados}
            keyExtractor={i => i.id}
            renderItem={renderItem}
            contentContainerStyle={styles.lista}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.centro}>
                <MaterialCommunityIcons name="box-open-outline" size={56} color={CORES.cinzaClaro} />
                <Text style={styles.txtVazio}>Nenhum item nesta categoria.</Text>
              </View>
            }
          />
        )
      }

      {/* FAB admin */}
      {isAdmin && (
        <TouchableOpacity style={styles.fab} onPress={abrirFormNovo}>
          <Ionicons name="add" size={26} color={CORES.branco} />
        </TouchableOpacity>
      )}

      {/* ── MODAL DETALHE ── */}
      <Modal visible={modalDetalhe} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            {itemSelecionado && (() => {
              const cat = getCat(itemSelecionado.categoria);
              const st  = getStatus(itemSelecionado.status);
              return (
                <>
                  <View style={styles.modalHandle} />

                  <View style={[styles.detalheIconBox, { backgroundColor: cat.color + '15' }]}>
                    <Ionicons name={cat.icon as any} size={38} color={cat.color} />
                  </View>

                  <View style={[styles.catBadge, { backgroundColor: cat.color + '18', borderColor: cat.color + '40', alignSelf: 'center', marginBottom: 8 }]}>
                    <Text style={[styles.catBadgeText, { color: cat.color }]}>{itemSelecionado.categoria}</Text>
                  </View>

                  <Text style={styles.detalheTitulo}>{itemSelecionado.titulo}</Text>

                  <View style={[styles.statusBadge, { backgroundColor: st.bg, alignSelf: 'center', marginBottom: 20 }]}>
                    <Text style={[styles.statusText, { color: st.color }]}>{st.label}</Text>
                  </View>

                  {itemSelecionado.descricao ? (
                    <View style={styles.detalheDescBox}>
                      <Text style={styles.detalheDescLabel}>DESCRIÇÃO</Text>
                      <Text style={styles.detalheDesc}>{itemSelecionado.descricao}</Text>
                    </View>
                  ) : null}

                  <View style={styles.detalheMetaRow}>
                    <View style={styles.detalheMeta}>
                      <Ionicons name="location-outline" size={15} color={CORES.textoSec} />
                      <Text style={styles.detalheMetaText}>{itemSelecionado.local_encontrado}</Text>
                    </View>
                    <View style={styles.detalheMeta}>
                      <Ionicons name="calendar-outline" size={15} color={CORES.textoSec} />
                      <Text style={styles.detalheMetaText}>{formatarData(itemSelecionado.data_postagem)}</Text>
                    </View>
                  </View>

                  {isAdmin && (
                    <View style={styles.detalheAcoes}>
                      <TouchableOpacity
                        style={[styles.btnAcao, { backgroundColor: '#E3F2FD', flex: 1 }]}
                        onPress={() => abrirFormEditar(itemSelecionado)}
                      >
                        <Ionicons name="create-outline" size={17} color="#2196F3" />
                        <Text style={[styles.btnAcaoText, { color: '#2196F3' }]}>Editar</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.btnAcao, {
                          backgroundColor: itemSelecionado.status === 'disponivel' ? '#D1FAE5' : '#FEF3C7',
                          flex: 1
                        }]}
                        onPress={() => alternarStatus(itemSelecionado)}
                      >
                        <Ionicons
                          name={itemSelecionado.status === 'disponivel' ? 'checkmark-circle-outline' : 'refresh-outline'}
                          size={17}
                          color={itemSelecionado.status === 'disponivel' ? CORES.verde : '#F59E0B'}
                        />
                        <Text style={[styles.btnAcaoText, {
                          color: itemSelecionado.status === 'disponivel' ? CORES.verde : '#F59E0B'
                        }]}>
                          {itemSelecionado.status === 'disponivel' ? 'Retirado' : 'Disponível'}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.btnAcao, { backgroundColor: '#FEE2E2' }]}
                        onPress={() => excluirItem(itemSelecionado)}
                      >
                        <Ionicons name="trash-outline" size={17} color="#EF4444" />
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
          <ScrollView keyboardShouldPersistTaps="handled">
            <View style={[styles.modalSheet, { marginTop: 'auto' as any, paddingBottom: Platform.OS === 'ios' ? 40 : 28 }]}>
              <View style={styles.modalHandle} />
              <Text style={styles.modalTitulo}>{editando ? 'Editar Item' : 'Registrar Item Encontrado'}</Text>
              <Text style={styles.modalSub}>Preencha os dados para torná-lo visível aos alunos</Text>

              <Text style={styles.formLabel}>NOME DO OBJETO *</Text>
              <TextInput
                style={styles.formInput}
                placeholder="Ex: Chaveiro do Stitch"
                placeholderTextColor={CORES.textoSec}
                value={titulo}
                onChangeText={setTitulo}
              />

              <Text style={styles.formLabel}>CATEGORIA *</Text>
              <TouchableOpacity style={styles.formSelect} onPress={() => setShowCatModal(true)}>
                <Text style={styles.formSelectText}>{categoria}</Text>
                <Ionicons name="chevron-down" size={17} color={CORES.textoSec} />
              </TouchableOpacity>

              <Text style={styles.formLabel}>LOCAL ENCONTRADO *</Text>
              <TouchableOpacity style={styles.formSelect} onPress={() => setShowLocalModal(true)}>
                <Text style={styles.formSelectText}>{local}</Text>
                <Ionicons name="chevron-down" size={17} color={CORES.textoSec} />
              </TouchableOpacity>

              <Text style={styles.formLabel}>DESCRIÇÃO</Text>
              <TextInput
                style={[styles.formInput, { height: 90, textAlignVertical: 'top' }]}
                placeholder="Detalhes que ajudem na identificação..."
                placeholderTextColor={CORES.textoSec}
                value={descricao}
                onChangeText={setDescricao}
                multiline
                maxLength={400}
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
          </ScrollView>
        </View>
      </Modal>

      {/* SELETOR CATEGORIA */}
      <Modal visible={showCatModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitulo}>Categoria</Text>
            {CATEGORIAS.map(c => (
              <TouchableOpacity
                key={c.label}
                style={styles.seletorItem}
                onPress={() => { setCategoria(c.label); setShowCatModal(false); }}
              >
                <Ionicons name={c.icon as any} size={19} color={c.color} />
                <Text style={styles.seletorItemText}>{c.label}</Text>
                {categoria === c.label && <Ionicons name="checkmark" size={17} color={CORES.rosa} style={{ marginLeft: 'auto' as any }} />}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

      {/* SELETOR LOCAL */}
      <Modal visible={showLocalModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitulo}>Local Encontrado</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {LOCAIS.map(l => (
                <TouchableOpacity
                  key={l}
                  style={styles.seletorItem}
                  onPress={() => { setLocal(l); setShowLocalModal(false); }}
                >
                  <Ionicons name="location-outline" size={17} color={CORES.textoSec} />
                  <Text style={styles.seletorItemText}>{l}</Text>
                  {local === l && <Ionicons name="checkmark" size={17} color={CORES.rosa} style={{ marginLeft: 'auto' as any }} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:          { flex: 1, backgroundColor: CORES.fundo },
  centro:             { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60, gap: 10 },
  txtVazio:           { color: CORES.textoSec, fontSize: 14, fontWeight: '600' },

  header:             { backgroundColor: CORES.azulEscuro, flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 20, paddingTop: 18, paddingBottom: 20, gap: 14 },
  btnVoltar:          { padding: 4, marginBottom: 2 },
  headerEyebrow:      { color: 'rgba(255,255,255,0.45)', fontSize: 10, fontWeight: '800', letterSpacing: 2, marginBottom: 2 },
  headerTitulo:       { color: CORES.branco, fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  headerSub:          { color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: '500', marginTop: 2 },
  btnAdd:             { marginLeft: 'auto' as any, backgroundColor: CORES.rosa, width: 38, height: 38, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 2 },

  filtroStatusRow:    { flexDirection: 'row', backgroundColor: CORES.branco, paddingHorizontal: 16, paddingVertical: 10, gap: 8, borderBottomWidth: 1, borderBottomColor: CORES.cinzaClaro },
  filtroStatusBtn:    { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: CORES.fundo },
  filtroStatusAtivo:  { backgroundColor: CORES.azulEscuro },
  filtroStatusText:   { fontSize: 12, fontWeight: '700', color: CORES.textoSec },
  filtroStatusTextAtivo: { color: CORES.branco },

  filtrosCatRow:      { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  filtroCat:          { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: CORES.branco, borderWidth: 1, borderColor: CORES.cinzaClaro },
  filtroCatText:      { fontSize: 12, fontWeight: '700', color: CORES.textoSec },

  contadorRow:        { paddingHorizontal: 18, paddingBottom: 6 },
  contadorText:       { fontSize: 11, fontWeight: '700', color: CORES.textoSec, letterSpacing: 0.8, textTransform: 'uppercase' },

  lista:              { paddingHorizontal: 16, paddingBottom: 100 },
  card:               { backgroundColor: CORES.branco, borderRadius: 18, padding: 16, marginBottom: 10, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  cardSeq:            { position: 'absolute', top: 12, right: 14, fontSize: 22, fontWeight: '900', color: CORES.cinzaClaro, letterSpacing: -1 },
  cardIconBox:        { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  cardBody:           { flex: 1, gap: 4 },
  catBadge:           { flexDirection: 'row', alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  catBadgeText:       { fontSize: 10, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' },
  cardTitulo:         { fontSize: 15, fontWeight: '800', color: CORES.azulEscuro, lineHeight: 20, paddingRight: 28 },
  cardDesc:           { fontSize: 12, color: CORES.textoSec, lineHeight: 18 },
  cardMeta:           { gap: 3, marginTop: 4, paddingTop: 8, borderTopWidth: 1, borderTopColor: CORES.cinzaClaro },
  metaItem:           { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText:           { fontSize: 11, color: CORES.textoSec, fontWeight: '500' },
  statusBadge:        { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8, marginTop: 2 },
  statusText:         { fontSize: 10, fontWeight: '800', letterSpacing: 0.3 },

  fab:                { position: 'absolute', bottom: 24, right: 20, width: 54, height: 54, borderRadius: 27, backgroundColor: CORES.rosa, justifyContent: 'center', alignItems: 'center', elevation: 6, shadowColor: CORES.rosa, shadowOpacity: 0.4, shadowRadius: 8 },

  modalOverlay:       { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet:         { backgroundColor: CORES.branco, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 36 },
  modalHandle:        { width: 40, height: 4, backgroundColor: CORES.cinzaClaro, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  modalTitulo:        { fontSize: 18, fontWeight: '900', color: CORES.azulEscuro, marginBottom: 4 },
  modalSub:           { fontSize: 12, color: CORES.textoSec, marginBottom: 20, fontWeight: '500' },

  detalheIconBox:     { width: 68, height: 68, borderRadius: 22, justifyContent: 'center', alignItems: 'center', alignSelf: 'center', marginBottom: 12 },
  detalheTitulo:      { fontSize: 20, fontWeight: '900', color: CORES.azulEscuro, textAlign: 'center', marginBottom: 8 },
  detalheDescBox:     { backgroundColor: CORES.fundo, borderRadius: 14, padding: 14, marginBottom: 14 },
  detalheDescLabel:   { fontSize: 10, fontWeight: '800', color: CORES.textoSec, letterSpacing: 1, marginBottom: 5 },
  detalheDesc:        { fontSize: 14, color: CORES.azulEscuro, lineHeight: 21 },
  detalheMetaRow:     { gap: 8, marginBottom: 16 },
  detalheMeta:        { flexDirection: 'row', alignItems: 'center', gap: 8 },
  detalheMetaText:    { fontSize: 14, color: CORES.textoSec, fontWeight: '600' },
  detalheAcoes:       { flexDirection: 'row', gap: 10, marginBottom: 16 },
  btnAcao:            { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 12, borderRadius: 14 },
  btnAcaoText:        { fontWeight: '800', fontSize: 13 },

  formLabel:          { fontSize: 11, fontWeight: '800', color: CORES.textoSec, letterSpacing: 0.8, marginBottom: 7, marginTop: 14 },
  formInput:          { backgroundColor: CORES.fundo, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: CORES.azulEscuro, borderWidth: 1, borderColor: CORES.cinzaClaro },
  formSelect:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: CORES.fundo, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 14, borderWidth: 1, borderColor: CORES.cinzaClaro },
  formSelectText:     { fontSize: 14, color: CORES.azulEscuro, fontWeight: '600' },

  seletorItem:        { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: CORES.cinzaClaro },
  seletorItemText:    { fontSize: 14, fontWeight: '700', color: CORES.azulEscuro, flex: 1 },

  btnFechar:          { backgroundColor: CORES.fundo, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  btnFecharText:      { fontWeight: '800', fontSize: 14, color: CORES.textoSec },
});