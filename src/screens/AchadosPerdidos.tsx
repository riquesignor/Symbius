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
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

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

// ── Lógica dos dois combobox de local ──────────────────────────
const AMBIENTES: Record<string, string[]> = {
  'Sala de Aula':   Array.from({ length: 23 }, (_, i) => String(i + 1)),
  'Banheiro':       ['Masculino de Cima', 'Masculino de Baixo', 'Feminino de Cima', 'Feminino de Baixo'],
  'Laboratório':    ['do Fabiano', 'do William', 'do Norberto', 'de Nutrição', 'de Design'],
  'Corredor':       ['De Baixo', 'De Cima'],
  'Biblioteca':     [],
  'Cantina':        [],
  'Área de Lazer':  [],
  'Área Verde':     [],
};

const AMBIENTES_UNICOS = ['Biblioteca', 'Cantina', 'Área de Lazer', 'Área Verde'];

const montarLocal = (amb: string, sub: string) =>
  AMBIENTES_UNICOS.includes(amb) ? amb : `${amb} — ${sub}`;

const getCat = (cat: string) =>
  CATEGORIAS.find(c => c.label === cat) || { icon: 'help-outline' as any, color: CORES.textoSec, label: cat };

const getStatus = (status: string) =>
  status === 'disponivel'
    ? { label: 'Disponível', color: CORES.verde, bg: '#D1FAE5' }
    : { label: 'Retirado',   color: '#6B7280',   bg: '#F3F4F6' };

const capitalizarPrimeira = (str: string) =>
  str ? str.charAt(0).toUpperCase() + str.slice(1) : '';

const formatarData = (timestamp: any) => {
  if (!timestamp) return '—';
  try {
    const d = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch { return '—'; }
};



// ── Componente reutilizável de ComboBox ─────────────────────────
const ComboBox = ({ label, valor, onPress, desabilitado = false, placeholder = 'Selecione...' }: any) => (
  <TouchableOpacity
    style={[styles.comboBox, desabilitado && styles.comboBoxDisabled]}
    onPress={!desabilitado ? onPress : undefined}
    activeOpacity={desabilitado ? 1 : 0.7}
  >
    <Text style={[styles.comboBoxLabel, !valor && { color: CORES.textoSec }]} numberOfLines={1}>
      {valor || placeholder}
    </Text>
    <Ionicons name="chevron-down" size={16} color={desabilitado ? CORES.cinzaClaro : CORES.textoSec} />
  </TouchableOpacity>
);

// ── Modal de seleção genérico ────────────────────────────────────
const ModalSelecao = ({ visible, titulo, opcoes, selecionado, onSelect, onClose }: any) => (
  <Modal visible={visible} transparent animationType="slide">
    <View style={styles.modalOverlay}>
      <View style={styles.modalSheet}>
        <View style={styles.modalHandle} />
        <Text style={styles.modalTitulo}>{titulo}</Text>
        <ScrollView showsVerticalScrollIndicator={false}>
          {opcoes.map((op: string) => (
            <TouchableOpacity
              key={op}
              style={styles.seletorItem}
              onPress={() => { onSelect(op); onClose(); }}
            >
              <Text style={styles.seletorItemText}>{op}</Text>
              {selecionado === op && (
                <Ionicons name="checkmark-circle" size={18} color={CORES.rosa} />
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
        <TouchableOpacity style={styles.btnFecharModal} onPress={onClose}>
          <Text style={styles.btnFecharModalText}>Fechar</Text>
        </TouchableOpacity>
      </View>
    </View>
  </Modal>
);

export default function AchadosPerdidos({ navigation, route }: any) {
  const meuTipo = route?.params?.tipo;
const isAdmin = meuTipo?.toLowerCase() === 'administrador';
  // ── Estado principal ─────────────────────────────────────────
  const [itens,          setItens]          = useState<any[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [salvando,       setSalvando]       = useState(false);
  const [itemSelecionado,setItemSelecionado]= useState<any>(null);
  const [editando,       setEditando]       = useState<any>(null);

  // Modais
  const [modalDetalhe,   setModalDetalhe]   = useState(false);
  const [modalForm,      setModalForm]      = useState(false);
  const [modalCat,       setModalCat]       = useState(false);
  const [modalAmbiente,  setModalAmbiente]  = useState(false);
  const [modalSub,       setModalSub]       = useState(false);

  // Filtros
  const [filtroCategoria,   setFiltroCategoria]   = useState('Todos');
  const [filtroStatus,      setFiltroStatus]       = useState('disponivel');
  const [filtroAmbiente,    setFiltroAmbiente]     = useState('');
  const [filtroSub,         setFiltroSub]          = useState('');
  const [modalFiltroAmbiente, setModalFiltroAmbiente] = useState(false);
  const [modalFiltroSub,      setModalFiltroSub]      = useState(false);

  // Form
  const [titulo,      setTitulo]      = useState('');
  const [descricao,   setDescricao]   = useState('');
  const [categoria,   setCategoria]   = useState('');
  const [ambiente,    setAmbiente]    = useState('');
  const [subLocal,    setSubLocal]    = useState('');

  // ── Derived ─────────────────────────────────────────────────
  const subOpcoes        = ambiente ? (AMBIENTES[ambiente] || []) : [];
  const ambienteUnico    = AMBIENTES_UNICOS.includes(ambiente);
  const subFiltroOpcoes  = filtroAmbiente ? (AMBIENTES[filtroAmbiente] || []) : [];
  const filtroAmbienteUnico = AMBIENTES_UNICOS.includes(filtroAmbiente);

  // ── Listener ─────────────────────────────────────────────────
  useEffect(() => {
    const q = query(collection(db, 'achados_perdidos'), orderBy('data_postagem', 'desc'));
    const unsub = onSnapshot(q, snap => {
      setItens(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // ── Filtrar itens ─────────────────────────────────────────────
  const itensFiltrados = itens.filter(i => {
    const catOk    = filtroCategoria === 'Todos' || i.categoria === filtroCategoria;
    const statusOk = filtroStatus    === 'todos' || i.status    === filtroStatus;

    let localOk = true;
    if (filtroAmbiente) {
      if (filtroAmbienteUnico) {
        localOk = i.local_encontrado === filtroAmbiente;
      } else if (filtroSub) {
        localOk = i.local_encontrado === montarLocal(filtroAmbiente, filtroSub);
      } else {
        localOk = i.local_encontrado?.startsWith(filtroAmbiente);
      }
    }
    return catOk && statusOk && localOk;
  });

  // ── Form helpers ─────────────────────────────────────────────
  const abrirFormNovo = () => {
    setEditando(null);
    setTitulo(''); setDescricao('');
    setCategoria(''); setAmbiente(''); setSubLocal('');
    setModalDetalhe(false);
    setModalForm(true);
  };

  const abrirFormEditar = (item: any) => {
    setEditando(item);
    setTitulo(item.titulo);
    setDescricao(item.descricao || '');
    setCategoria(item.categoria);
    // Tenta recuperar ambiente e sub do local_encontrado
    const partes = item.local_encontrado?.split(' — ') || [];
    setAmbiente(partes[0] || '');
    setSubLocal(partes[1] || '');
    setModalDetalhe(false);
    setModalForm(true);
  };

  const mudarAmbiente = (val: string) => {
    setAmbiente(val);
    setSubLocal(''); // reseta o sub ao trocar ambiente
  };

  const salvar = async () => {
    if (!titulo.trim()) {
      Alert.alert('Atenção', 'Nome do objeto é obrigatório.');
      return;
    }
    if (!categoria) {
      Alert.alert('Atenção', 'Selecione uma categoria.');
      return;
    }
    if (!ambiente) {
      Alert.alert('Atenção', 'Selecione o local onde foi encontrado.');
      return;
    }
    if (!ambienteUnico && !subLocal) {
      Alert.alert('Atenção', 'Selecione o detalhe do local.');
      return;
    }

    const localFinal = ambienteUnico ? ambiente : montarLocal(ambiente, subLocal);

    setSalvando(true);
    try {
      const dados = {
        titulo:           capitalizarPrimeira(titulo.trim()),
        descricao:        capitalizarPrimeira(descricao.trim()),
        categoria,
        local_encontrado: localFinal,
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
      novoStatus === 'retirado' ? 'Confirma que o dono buscou o item?' : 'Recolocar como disponível?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Confirmar', onPress: async () => {
            await updateDoc(doc(db, 'achados_perdidos', item.id), { status: novoStatus });
            setItemSelecionado((prev: any) => ({ ...prev, status: novoStatus }));
          }
        }
      ]
    );
  };

  const excluirItem = (item: any) => {
    Alert.alert(
      'Excluir Item',
      `Deseja excluir "${item.titulo}"? Essa ação não tem volta.`,
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

  // ── Render card ───────────────────────────────────────────────
  const renderItem = ({ item, index }: any) => {
    const cat = getCat(item.categoria);
    const st  = getStatus(item.status);
    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.82}
        onPress={() => { setItemSelecionado(item); setModalDetalhe(true); }}
      >
        <Text style={styles.cardSeq}>{String(index + 1).padStart(2, '0')}</Text>

        <View style={[styles.cardIconBox, { backgroundColor: cat.color + '15' }]}>
          <Ionicons name={cat.icon as any} size={24} color={cat.color} />
        </View>

        <View style={styles.cardBody}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <View style={[styles.catBadge, { backgroundColor: cat.color + '15', borderColor: cat.color + '35' }]}>
              <Text style={[styles.catBadgeText, { color: cat.color }]}>{item.categoria}</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: st.bg }]}>
              <Text style={[styles.statusText, { color: st.color }]}>{st.label}</Text>
            </View>
          </View>

          <Text style={styles.cardTitulo} numberOfLines={2}>{item.titulo}</Text>

          <View style={styles.metaItem}>
            <Ionicons name="location-outline" size={11} color={CORES.textoSec} />
            <Text style={styles.metaText} numberOfLines={1}>{item.local_encontrado}</Text>
          </View>
          <View style={styles.metaItem}>
            <Ionicons name="calendar-outline" size={11} color={CORES.textoSec} />
            <Text style={styles.metaText}>{formatarData(item.data_postagem)}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  console.log('tipo recebido:', meuTipo);
console.log('isAdmin:', isAdmin);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={CORES.azulEscuro} />

      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={CORES.branco} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerEyebrow}>MURAL</Text>
          <Text style={styles.headerTitulo}>Achados & Perdidos</Text>
        </View>
        {isAdmin && (
          <TouchableOpacity style={styles.btnHeaderAdd} onPress={abrirFormNovo}>
            <Ionicons name="add" size={20} color={CORES.branco} />
            <Text style={styles.btnHeaderAddText}>Registrar</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* FILTRO STATUS */}
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
            <Text style={[styles.filtroStatusText, filtroStatus === f.key && { color: CORES.branco }]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* FILTRO CATEGORIA */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtroCatRow}>
        {['Todos', ...CATEGORIAS.map(c => c.label)].map(cat => {
          const conf  = cat === 'Todos' ? null : getCat(cat);
          const ativo = filtroCategoria === cat;
          return (
            <TouchableOpacity
              key={cat}
              style={[styles.filtroCat, ativo && { backgroundColor: conf?.color || CORES.azulEscuro, borderColor: 'transparent' }]}
              onPress={() => setFiltroCategoria(cat)}
            >
              {conf && <Ionicons name={conf.icon as any} size={12} color={ativo ? '#FFF' : conf.color} />}
              <Text style={[styles.filtroCatText, ativo && { color: '#FFF' }]}>{cat}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* FILTRO LOCAL — dois combobox */}
      <View style={styles.filtroLocalRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.filtroLocalLabel}>AMBIENTE</Text>
          <ComboBox
            valor={filtroAmbiente}
            placeholder="Todos os locais"
            onPress={() => setModalFiltroAmbiente(true)}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.filtroLocalLabel}>DETALHE</Text>
          <ComboBox
            valor={filtroSub}
            placeholder={filtroAmbienteUnico ? 'Único' : 'Selecione...'}
            onPress={() => setModalFiltroSub(true)}
            desabilitado={!filtroAmbiente || filtroAmbienteUnico || subFiltroOpcoes.length === 0}
          />
        </View>
        {(filtroAmbiente || filtroSub) && (
          <TouchableOpacity
            style={styles.btnLimparFiltro}
            onPress={() => { setFiltroAmbiente(''); setFiltroSub(''); }}
          >
            <Ionicons name="close-circle" size={20} color={CORES.textoSec} />
          </TouchableOpacity>
        )}
      </View>

      {/* CONTADOR */}
      <View style={styles.contadorRow}>
        <Text style={styles.contadorText}>
          {itensFiltrados.length === 0
            ? 'Nenhum item encontrado'
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
                <MaterialCommunityIcons name="box-open-outline" size={54} color={CORES.cinzaClaro} />
                <Text style={styles.txtVazio}>Nenhum item neste filtro.</Text>
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

      {/* ══════════════════════════════════════════════════════════
          MODAL DETALHE
      ══════════════════════════════════════════════════════════ */}
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
                    <Ionicons name={cat.icon as any} size={36} color={cat.color} />
                  </View>

                  <Text style={styles.detalheTitulo}>{itemSelecionado.titulo}</Text>

                  <View style={styles.detalheBadgesRow}>
                    <View style={[styles.catBadge, { backgroundColor: cat.color + '15', borderColor: cat.color + '35' }]}>
                      <Text style={[styles.catBadgeText, { color: cat.color }]}>{itemSelecionado.categoria}</Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: st.bg }]}>
                      <Text style={[styles.statusText, { color: st.color }]}>{st.label}</Text>
                    </View>
                  </View>

                  {itemSelecionado.descricao ? (
                    <View style={styles.detalheDescBox}>
                      <Text style={styles.detalheDescLabel}>DESCRIÇÃO</Text>
                      <Text style={styles.detalheDesc}>{itemSelecionado.descricao}</Text>
                    </View>
                  ) : null}

                  <View style={styles.detalheMetaRow}>
                    <Ionicons name="location-outline" size={15} color={CORES.textoSec} />
                    <Text style={styles.detalheMetaText}>{itemSelecionado.local_encontrado}</Text>
                  </View>
                  <View style={styles.detalheMetaRow}>
                    <Ionicons name="calendar-outline" size={15} color={CORES.textoSec} />
                    <Text style={styles.detalheMetaText}>{formatarData(itemSelecionado.data_postagem)}</Text>
                  </View>

                  {/* Ações admin */}
                  {isAdmin && (
                    <View style={styles.detalheAcoes}>
                      <TouchableOpacity
                        style={[styles.btnAcao, { backgroundColor: '#E3F2FD', flex: 1 }]}
                        onPress={() => abrirFormEditar(itemSelecionado)}
                      >
                        <Ionicons name="create-outline" size={16} color="#2196F3" />
                        <Text style={[styles.btnAcaoText, { color: '#2196F3' }]}>Editar</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.btnAcao, {
                          flex: 1,
                          backgroundColor: itemSelecionado.status === 'disponivel' ? '#D1FAE5' : '#FEF3C7'
                        }]}
                        onPress={() => alternarStatus(itemSelecionado)}
                      >
                        <Ionicons
                          name={itemSelecionado.status === 'disponivel' ? 'checkmark-circle-outline' : 'refresh-outline'}
                          size={16}
                          color={itemSelecionado.status === 'disponivel' ? CORES.verde : '#F59E0B'}
                        />
                        <Text style={[styles.btnAcaoText, {
                          color: itemSelecionado.status === 'disponivel' ? CORES.verde : '#F59E0B'
                        }]}>
                          {itemSelecionado.status === 'disponivel' ? 'Retirado' : 'Disponível'}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.btnAcao, { backgroundColor: '#FEE2E2', paddingHorizontal: 14 }]}
                        onPress={() => excluirItem(itemSelecionado)}
                      >
                        <Ionicons name="trash-outline" size={16} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  )}

                  <TouchableOpacity style={styles.btnFecharDetalhe} onPress={() => setModalDetalhe(false)}>
                    <Text style={styles.btnFecharDetalheText}>Fechar</Text>
                  </TouchableOpacity>
                </>
              );
            })()}
          </View>
        </View>
      </Modal>

      {/* ══════════════════════════════════════════════════════════
          MODAL FORM (ADMIN)
      ══════════════════════════════════════════════════════════ */}
      <Modal visible={modalForm} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ justifyContent: 'flex-end', flexGrow: 1 }}>
            <View style={[styles.modalSheet, { paddingBottom: Platform.OS === 'ios' ? 40 : 28 }]}>
              <View style={styles.modalHandle} />
              <Text style={styles.modalTitulo}>{editando ? 'Editar Item' : 'Registrar Item Encontrado'}</Text>
              <Text style={styles.modalSub}>Preencha os dados do objeto para torná-lo visível</Text>

              {/* Nome */}
              <Text style={styles.formLabel}>NOME DO OBJETO *</Text>
              <TextInput
                style={styles.formInput}
                placeholder="Ex: Chaveiro do Stitch"
                placeholderTextColor={CORES.textoSec}
                value={titulo}
                onChangeText={setTitulo}
              />

              {/* Categoria */}
              <Text style={styles.formLabel}>CATEGORIA *</Text>
              <ComboBox
                valor={categoria}
                placeholder="Selecione a categoria..."
                onPress={() => setModalCat(true)}
              />

              {/* Local — dois combobox */}
              <Text style={styles.formLabel}>LOCAL ENCONTRADO *</Text>
              <View style={styles.localRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.localSubLabel}>Ambiente</Text>
                  <ComboBox
                    valor={ambiente}
                    placeholder="Selecione..."
                    onPress={() => setModalAmbiente(true)}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.localSubLabel}>Detalhe</Text>
                  <ComboBox
                    valor={subLocal}
                    placeholder={ambienteUnico ? 'Único' : 'Selecione...'}
                    onPress={() => setModalSub(true)}
                    desabilitado={!ambiente || ambienteUnico || subOpcoes.length === 0}
                  />
                </View>
              </View>

              {/* Preview do local montado */}
              {ambiente && (
                <View style={styles.localPreview}>
                  <Ionicons name="location" size={13} color={CORES.rosa} />
                  <Text style={styles.localPreviewText}>
                    {ambienteUnico ? ambiente : subLocal ? montarLocal(ambiente, subLocal) : `${ambiente} — ...`}
                  </Text>
                </View>
              )}

              {/* Descrição */}
              <Text style={styles.formLabel}>DESCRIÇÃO</Text>
              <TextInput
                style={[styles.formInput, { height: 80, textAlignVertical: 'top' }]}
                placeholder="Detalhes que ajudem na identificação..."
                placeholderTextColor={CORES.textoSec}
                value={descricao}
                onChangeText={setDescricao}
                multiline
                maxLength={400}
              />

              {/* Botões */}
              <View style={styles.formBtns}>
                <TouchableOpacity
                  style={[styles.formBtn, { backgroundColor: CORES.cinzaClaro }]}
                  onPress={() => setModalForm(false)}
                >
                  <Text style={[styles.formBtnText, { color: CORES.azulEscuro }]}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.formBtn, { backgroundColor: CORES.rosa }]}
                  onPress={salvar}
                  disabled={salvando}
                >
                  {salvando
                    ? <ActivityIndicator color="#FFF" size="small" />
                    : <Text style={[styles.formBtnText, { color: '#FFF' }]}>
                        {editando ? 'Salvar' : 'Registrar'}
                      </Text>
                  }
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* ══ SELETORES ══════════════════════════════════════════════ */}

      {/* Categoria */}
      <ModalSelecao
        visible={modalCat}
        titulo="Categoria"
        opcoes={CATEGORIAS.map(c => c.label)}
        selecionado={categoria}
        onSelect={setCategoria}
        onClose={() => setModalCat(false)}
      />

      {/* Ambiente (form) */}
      <ModalSelecao
        visible={modalAmbiente}
        titulo="Ambiente"
        opcoes={Object.keys(AMBIENTES)}
        selecionado={ambiente}
        onSelect={mudarAmbiente}
        onClose={() => setModalAmbiente(false)}
      />

      {/* Sub local (form) */}
      <ModalSelecao
        visible={modalSub}
        titulo={`Detalhe — ${ambiente}`}
        opcoes={subOpcoes}
        selecionado={subLocal}
        onSelect={setSubLocal}
        onClose={() => setModalSub(false)}
      />

      {/* Ambiente (filtro) */}
      <ModalSelecao
        visible={modalFiltroAmbiente}
        titulo="Filtrar por Ambiente"
        opcoes={Object.keys(AMBIENTES)}
        selecionado={filtroAmbiente}
        onSelect={(val: string) => { setFiltroAmbiente(val); setFiltroSub(''); }}
        onClose={() => setModalFiltroAmbiente(false)}
      />

      {/* Sub local (filtro) */}
      <ModalSelecao
        visible={modalFiltroSub}
        titulo={`Filtrar — ${filtroAmbiente}`}
        opcoes={subFiltroOpcoes}
        selecionado={filtroSub}
        onSelect={setFiltroSub}
        onClose={() => setModalFiltroSub(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:            { flex: 1, backgroundColor: CORES.fundo },
  centro:               { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60, gap: 10 },
  txtVazio:             { color: CORES.textoSec, fontSize: 14, fontWeight: '600' },

  // HEADER
  header:               { backgroundColor: CORES.azulEscuro, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, gap: 14 },
  headerEyebrow:        { color: 'rgba(255,255,255,0.45)', fontSize: 10, fontWeight: '800', letterSpacing: 2 },
  headerTitulo:         { color: CORES.branco, fontSize: 20, fontWeight: '900', letterSpacing: -0.5 },
  btnHeaderAdd:         { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: CORES.rosa, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 12 },
  btnHeaderAddText:     { color: CORES.branco, fontWeight: '800', fontSize: 13 },

  // FILTRO STATUS
  filtroStatusRow:      { flexDirection: 'row', backgroundColor: CORES.branco, paddingHorizontal: 16, paddingVertical: 10, gap: 8, borderBottomWidth: 1, borderBottomColor: CORES.cinzaClaro },
  filtroStatusBtn:      { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: CORES.fundo },
  filtroStatusAtivo:    { backgroundColor: CORES.azulEscuro },
  filtroStatusText:     { fontSize: 12, fontWeight: '700', color: CORES.textoSec },

  // FILTRO CATEGORIA
  filtroCatRow:         { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  filtroCat:            { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: CORES.branco, borderWidth: 1, borderColor: CORES.cinzaClaro },
  filtroCatText:        { fontSize: 12, fontWeight: '700', color: CORES.textoSec },

  // FILTRO LOCAL
  filtroLocalRow:       { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 16, paddingBottom: 10, backgroundColor: CORES.branco, borderBottomWidth: 1, borderBottomColor: CORES.cinzaClaro },
  filtroLocalLabel:     { fontSize: 10, fontWeight: '800', color: CORES.textoSec, letterSpacing: 0.8, marginBottom: 5 },
  btnLimparFiltro:      { paddingBottom: 10 },

  // COMBOBOX
  comboBox:             { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: CORES.fundo, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11, borderWidth: 1, borderColor: CORES.cinzaClaro },
  comboBoxDisabled:     { opacity: 0.45 },
  comboBoxLabel:        { fontSize: 13, fontWeight: '600', color: CORES.azulEscuro, flex: 1, marginRight: 4 },

  // CONTADOR
  contadorRow:          { paddingHorizontal: 18, paddingVertical: 8 },
  contadorText:         { fontSize: 11, fontWeight: '700', color: CORES.textoSec, letterSpacing: 0.8, textTransform: 'uppercase' },

  // LISTA
  lista:                { paddingHorizontal: 16, paddingBottom: 100 },
  card:                 { backgroundColor: CORES.branco, borderRadius: 18, padding: 14, marginBottom: 10, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  cardSeq:              { position: 'absolute', top: 10, right: 12, fontSize: 20, fontWeight: '900', color: CORES.cinzaClaro, letterSpacing: -1 },
  cardIconBox:          { width: 44, height: 44, borderRadius: 13, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  cardBody:             { flex: 1, gap: 5 },
  catBadge:             { flexDirection: 'row', alignSelf: 'flex-start', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  catBadgeText:         { fontSize: 10, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase' },
  statusBadge:          { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
  statusText:           { fontSize: 10, fontWeight: '800' },
  cardTitulo:           { fontSize: 15, fontWeight: '800', color: CORES.azulEscuro, lineHeight: 20, paddingRight: 24 },
  metaItem:             { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText:             { fontSize: 11, color: CORES.textoSec, fontWeight: '500', flex: 1 },

  // FAB
  fab:                  { position: 'absolute', bottom: 24, right: 20, width: 54, height: 54, borderRadius: 27, backgroundColor: CORES.rosa, justifyContent: 'center', alignItems: 'center', elevation: 6, shadowColor: CORES.rosa, shadowOpacity: 0.4, shadowRadius: 8 },

  // MODAIS BASE
  modalOverlay:         { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet:           { backgroundColor: CORES.branco, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 36, maxHeight: '90%' },
  modalHandle:          { width: 40, height: 4, backgroundColor: CORES.cinzaClaro, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  modalTitulo:          { fontSize: 18, fontWeight: '900', color: CORES.azulEscuro, marginBottom: 4 },
  modalSub:             { fontSize: 12, color: CORES.textoSec, marginBottom: 18, fontWeight: '500' },

  // DETALHE
  detalheIconBox:       { width: 64, height: 64, borderRadius: 20, justifyContent: 'center', alignItems: 'center', alignSelf: 'center', marginBottom: 12 },
  detalheTitulo:        { fontSize: 20, fontWeight: '900', color: CORES.azulEscuro, textAlign: 'center', marginBottom: 10 },
  detalheBadgesRow:     { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 16 },
  detalheDescBox:       { backgroundColor: CORES.fundo, borderRadius: 14, padding: 14, marginBottom: 14 },
  detalheDescLabel:     { fontSize: 10, fontWeight: '800', color: CORES.textoSec, letterSpacing: 1, marginBottom: 5 },
  detalheDesc:          { fontSize: 14, color: CORES.azulEscuro, lineHeight: 21 },
  detalheMetaRow:       { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  detalheMetaText:      { fontSize: 14, color: CORES.textoSec, fontWeight: '600' },
  detalheAcoes:         { flexDirection: 'row', gap: 10, marginTop: 16, marginBottom: 12 },
  btnAcao:              { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 13, borderRadius: 14 },
  btnAcaoText:          { fontWeight: '800', fontSize: 13 },
  btnFecharDetalhe:     { backgroundColor: CORES.fundo, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  btnFecharDetalheText: { fontWeight: '800', fontSize: 14, color: CORES.textoSec },

  // FORM
  formLabel:            { fontSize: 11, fontWeight: '800', color: CORES.textoSec, letterSpacing: 0.8, marginBottom: 7, marginTop: 14 },
  formInput:            { backgroundColor: CORES.fundo, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: CORES.azulEscuro, borderWidth: 1, borderColor: CORES.cinzaClaro },
  localRow:             { flexDirection: 'row', gap: 10, marginBottom: 4 },
  localSubLabel:        { fontSize: 10, fontWeight: '700', color: CORES.textoSec, marginBottom: 5 },
  localPreview:         { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FFF0F5', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, marginBottom: 4 },
  localPreviewText:     { fontSize: 13, color: CORES.rosa, fontWeight: '700', flex: 1 },
  formBtns:             { flexDirection: 'row', gap: 10, marginTop: 20 },
  formBtn:              { flex: 1, borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  formBtnText:          { fontWeight: '800', fontSize: 14 },

  // SELETOR
  seletorItem:          { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: CORES.cinzaClaro },
  seletorItemText:      { flex: 1, fontSize: 15, fontWeight: '700', color: CORES.azulEscuro },
  btnFecharModal:       { backgroundColor: CORES.fundo, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  btnFecharModalText:   { fontWeight: '800', color: CORES.textoSec, fontSize: 14 },
});