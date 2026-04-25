import React, { useState, useEffect } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, ScrollView,
  SafeAreaView, StatusBar, TextInput, Alert, ActivityIndicator,
  Modal, FlatList
} from 'react-native';
import { db } from '../config/firebaseConfig';
import {
  collection, query, orderBy, getDocs, updateDoc, doc
} from 'firebase/firestore';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';



const CORES = {
  azulEscuro: '#0B2046',
  rosa:        '#E51C6A',
  fundo:       '#F5F7FA',
  branco:      '#FFFFFF',
  cinzaClaro:  '#E2E8F0',
  textoSec:    '#64748B',
  preto:       '#1A1A2E',
  verde:       '#27ae60',
  vermelho:    '#e74c3c',
  amarelo:     '#FFC82C',
};

const CAT_LABELS: Record<string, string> = {
  destaque:      'Destaques',
  oportunidades: 'Oportunidades',
  olimpiadas:    'Olimpíadas',
  avisos:        'Avisos',
  passeios:      'Passeios',
};

const STATUS_LABELS: Record<number, string> = { 0: 'Pendente', 1: 'Ativo', 2: 'Suspenso' };
const TIPOS_USUARIO = ['Aluno', 'Gremista', 'Administrador'];
const STATUS_OPCOES = [
  { value: 0, label: 'Pendente' },
  { value: 1, label: 'Ativo'    },
  { value: 2, label: 'Suspenso' },
];

export default function Admin({ navigation, route }: any) {
  const uid = route?.params?.uid;

  const [posts,     setPosts]     = useState<any[]>([]);
  const [usuarios,  setUsuarios]  = useState<any[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [abaAtiva,  setAbaAtiva]  = useState<'heat' | 'usuarios'>('heat');

  // Busca por RA
  const [buscaRA,        setBuscaRA]        = useState('');
  const [usuarioBuscado, setUsuarioBuscado] = useState<any>(null);
  const [erroRA,         setErroRA]         = useState('');
  const [sucessoRA,      setSucessoRA]      = useState('');

  // Edição inline
  const [editTipo,   setEditTipo]   = useState<Record<string, string>>({});
  const [editStatus, setEditStatus] = useState<Record<string, number>>({});
  const [salvando,   setSalvando]   = useState<Record<string, boolean>>({});

  // Modais de seleção
  const [modalTipo,       setModalTipo]       = useState(false);
  const [modalStatus,     setModalStatus]     = useState(false);
  const [modalUidAlvo,    setModalUidAlvo]    = useState('');
  const [modalCartaoTipo, setModalCartaoTipo] = useState(false);
  const [modalCartaoSts,  setModalCartaoSts]  = useState(false);
  const [cartaoTipo,      setCartaoTipo]      = useState('');
  const [cartaoStatus,    setCartaoStatus]    = useState(0);
  const [salvandoCartao,  setSalvandoCartao]  = useState(false);

  useEffect(() => {
    if (!uid) {
      (async () => {
        await AsyncStorage.removeItem('uid');
        navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
      })();
      return;
    }
    carregar();
  }, [uid]);

  const carregar = async () => {
    setLoading(true);
    try {
      const [snapPosts, snapUsuarios] = await Promise.all([
        getDocs(query(collection(db, 'posts'), orderBy('visualizacoes', 'desc'))),
        getDocs(query(collection(db, 'usuarios'), orderBy('nome_completo', 'asc'))),
      ]);
      const ps = snapPosts.docs.map(d => ({ id: d.id, ...d.data() }));
      const us = snapUsuarios.docs.map(d => ({ uid: d.id, ...d.data() }));
      setPosts(ps);
      setUsuarios(us);

      // Inicializa estados de edição
      const t: Record<string, string> = {};
      const s: Record<string, number> = {};
      us.forEach((u: any) => { t[u.uid] = u.tipo; s[u.uid] = u.status; });
      setEditTipo(t);
      setEditStatus(s);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  // ── Stats ─────────────────────────────────────────────────────
  const totalViews  = posts.reduce((s, p) => s + (p.visualizacoes || 0), 0);
  const totalAlunos = usuarios.filter((u: any) => u.tipo === 'Aluno').length;
  const top5        = [...posts].sort((a, b) => (b.visualizacoes || 0) - (a.visualizacoes || 0)).slice(0, 5);
  const maxViews    = top5[0]?.visualizacoes || 1;

  // ── Mapa de calor ─────────────────────────────────────────────
  const categorias = Object.keys(CAT_LABELS);
  const maxGlobal  = Math.max(1, ...posts.map(p => p.visualizacoes || 0));

  const intensidadeCor = (views: number) => {
    const ratio = views / maxGlobal;
    const l = Math.round(95 - ratio * 75);
    return { bg: `hsl(220,${Math.round(ratio * 60)}%,${l}%)`, texto: l < 50 ? '#FFF' : CORES.preto };
  };

  // ── Salvar usuário (tabela) ────────────────────────────────────
  const salvarUsuario = async (uid: string) => {
    setSalvando(prev => ({ ...prev, [uid]: true }));
    try {
      await updateDoc(doc(db, 'usuarios', uid), {
        tipo:   editTipo[uid],
        status: editStatus[uid],
      });
      setUsuarios(prev => prev.map((u: any) =>
        u.uid === uid ? { ...u, tipo: editTipo[uid], status: editStatus[uid] } : u
      ));
      Alert.alert('Sucesso', 'Usuário atualizado!');
    } catch { Alert.alert('Erro', 'Falha ao salvar.'); }
    finally { setSalvando(prev => ({ ...prev, [uid]: false })); }
  };

  // ── Busca por RA ───────────────────────────────────────────────
  const buscarRA = () => {
    setErroRA(''); setSucessoRA(''); setUsuarioBuscado(null);
    if (!buscaRA.trim()) { setErroRA('Digite um RA para buscar.'); return; }
    const encontrado = usuarios.find((u: any) => u.ra?.toUpperCase() === buscaRA.trim().toUpperCase());
    if (!encontrado) { setErroRA(`Nenhum aluno encontrado com RA "${buscaRA.trim().toUpperCase()}".`); return; }
    setUsuarioBuscado(encontrado);
    setCartaoTipo(encontrado.tipo);
    setCartaoStatus(encontrado.status);
  };

  const salvarCartao = async () => {
    if (!usuarioBuscado) return;
    setSalvandoCartao(true);
    try {
      await updateDoc(doc(db, 'usuarios', usuarioBuscado.uid), {
        tipo: cartaoTipo, status: cartaoStatus,
      });
      setUsuarios(prev => prev.map((u: any) =>
        u.uid === usuarioBuscado.uid ? { ...u, tipo: cartaoTipo, status: cartaoStatus } : u
      ));
      setSucessoRA(`✓ ${usuarioBuscado.nome_completo} atualizado — ${cartaoTipo} / ${STATUS_LABELS[cartaoStatus]}`);
      setTimeout(() => setSucessoRA(''), 4000);
    } catch { Alert.alert('Erro', 'Falha ao salvar.'); }
    finally { setSalvandoCartao(false); }
  };

  if (loading) return (
    <View style={styles.centro}><ActivityIndicator size="large" color={CORES.rosa} /></View>
  );

  

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={CORES.azulEscuro} />

      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => navigation.reset({ index: 0, routes: [{ name: 'Index', params: { uid } }] })} 
          style={{ padding: 4 }}
        >
      <Ionicons name="arrow-back" size={22} color={CORES.branco} />
      </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerEyebrow}>RESTRITO</Text>
          <Text style={styles.headerTitulo}>Painel Administrativo</Text>
        </View>
      </View>

      {/* STATS */}
      <View style={styles.statsRow}>
        {[
          { n: posts.length,    l: 'Posts'         },
          { n: totalViews,      l: 'Views'          },
          { n: usuarios.length, l: 'Usuários'       },
          { n: totalAlunos,     l: 'Alunos'         },
        ].map(s => (
          <View key={s.l} style={styles.statCard}>
            <Text style={styles.statN}>{s.n}</Text>
            <Text style={styles.statL}>{s.l}</Text>
          </View>
        ))}
      </View>

      {/* ABAS */}
      <View style={styles.abas}>
        <TouchableOpacity
          style={[styles.aba, abaAtiva === 'heat' && styles.abaAtiva]}
          onPress={() => setAbaAtiva('heat')}
        >
          <Text style={[styles.abaText, abaAtiva === 'heat' && styles.abaTextAtiva]}>
            Engajamento
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.aba, abaAtiva === 'usuarios' && styles.abaAtiva]}
          onPress={() => setAbaAtiva('usuarios')}
        >
          <Text style={[styles.abaText, abaAtiva === 'usuarios' && styles.abaTextAtiva]}>
            Usuários
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>

        {/* ══ ABA ENGAJAMENTO ══ */}
        {abaAtiva === 'heat' && (
          <View>
            {/* Mapa de calor por categoria */}
            {categorias.map(cat => {
              const postsCat = posts.filter((p: any) => p.categoria === cat);
              if (!postsCat.length) return null;
              const totalCat = postsCat.reduce((s, p) => s + (p.visualizacoes || 0), 0);
              return (
                <View key={cat} style={styles.heatBanda}>
                  <View style={styles.heatBandaHeader}>
                    <Text style={styles.heatCatLabel}>{CAT_LABELS[cat]}</Text>
                    <Text style={styles.heatCatTotal}>{totalCat} views</Text>
                  </View>
                  <View style={styles.heatCells}>
                    {postsCat.map((p: any) => {
                      const { bg, texto } = intensidadeCor(p.visualizacoes || 0);
                      return (
                        <View key={p.id} style={[styles.heatCell, { backgroundColor: bg }]}>
                          <Text style={[styles.heatCellTitulo, { color: texto }]} numberOfLines={2}>
                            {p.titulo}
                          </Text>
                          <View style={styles.heatCellMeta}>
                            <Ionicons name="eye" size={10} color={texto} />
                            <Text style={[styles.heatCellViews, { color: texto }]}>
                              {p.visualizacoes || 0}
                            </Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </View>
              );
            })}

            {/* Top 5 */}
            <View style={styles.top5Secao}>
              <Text style={styles.top5Titulo}>TOP 5 POSTS</Text>
              {top5.map((p: any, i: number) => (
                <View key={p.id} style={styles.top5Item}>
                  <Text style={styles.top5Pos}>{String(i + 1).padStart(2, '0')}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.top5Nome} numberOfLines={1}>{p.titulo}</Text>
                    <Text style={styles.top5Meta}>
                      {CAT_LABELS[p.categoria] || p.categoria} · {p.visualizacoes || 0} views
                    </Text>
                    <View style={styles.barraWrap}>
                      <View style={[styles.barra, { width: `${Math.round(((p.visualizacoes || 0) / maxViews) * 100)}%` as any }]} />
                    </View>
                  </View>
                </View>
              ))}
              {top5.length === 0 && (
                <Text style={styles.vazio}>Nenhum post com visualizações ainda.</Text>
              )}
            </View>
          </View>
        )}

        {/* ══ ABA USUÁRIOS ══ */}
        {abaAtiva === 'usuarios' && (
          <View style={{ padding: 16 }}>

            {/* Busca por RA */}
            <Text style={styles.secaoTitulo}>BUSCA POR RA</Text>
            <View style={styles.buscaRow}>
              <TextInput
                style={styles.buscaInput}
                placeholder="Digite o RA do aluno..."
                placeholderTextColor={CORES.textoSec}
                value={buscaRA}
                onChangeText={setBuscaRA}
                autoCapitalize="characters"
                onSubmitEditing={buscarRA}
              />
              <TouchableOpacity style={styles.btnBuscar} onPress={buscarRA}>
                <Ionicons name="search" size={18} color={CORES.branco} />
              </TouchableOpacity>
            </View>

            {erroRA !== '' && (
              <View style={styles.msgErro}>
                <Text style={styles.msgErroText}>{erroRA}</Text>
              </View>
            )}
            {sucessoRA !== '' && (
              <View style={styles.msgSucesso}>
                <Text style={styles.msgSucessoText}>{sucessoRA}</Text>
              </View>
            )}

            {/* Cartão do usuário encontrado */}
            {usuarioBuscado && (
              <View style={styles.cartao}>
                <Text style={styles.cartaoNome}>{usuarioBuscado.nome_completo}</Text>
                <Text style={styles.cartaoDetalhe}>RA: {usuarioBuscado.ra || '—'}</Text>
                <Text style={styles.cartaoDetalhe}>Turma: {usuarioBuscado.turma || '—'}</Text>
                <Text style={styles.cartaoDetalhe}>Email: {usuarioBuscado.email_escolar || '—'}</Text>

                <View style={styles.cartaoControles}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.campoLabel}>TIPO</Text>
                    <TouchableOpacity style={styles.seletorBtn} onPress={() => setModalCartaoTipo(true)}>
                      <Text style={styles.seletorBtnText}>{cartaoTipo}</Text>
                      <Ionicons name="chevron-down" size={14} color={CORES.textoSec} />
                    </TouchableOpacity>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.campoLabel}>STATUS</Text>
                    <TouchableOpacity style={styles.seletorBtn} onPress={() => setModalCartaoSts(true)}>
                      <Text style={styles.seletorBtnText}>{STATUS_LABELS[cartaoStatus]}</Text>
                      <Ionicons name="chevron-down" size={14} color={CORES.textoSec} />
                    </TouchableOpacity>
                  </View>
                </View>

                <TouchableOpacity style={styles.btnSalvarCartao} onPress={salvarCartao} disabled={salvandoCartao}>
                  {salvandoCartao
                    ? <ActivityIndicator color="#FFF" size="small" />
                    : <Text style={styles.btnSalvarCartaoText}>Salvar Alterações</Text>
                  }
                </TouchableOpacity>
              </View>
            )}

            {/* Tabela de usuários */}
            <Text style={[styles.secaoTitulo, { marginTop: 24 }]}>
              TODOS OS USUÁRIOS ({usuarios.length})
            </Text>

            {usuarios.map((u: any) => (
              <View key={u.uid} style={styles.usuarioCard}>
                <View style={styles.usuarioInfo}>
                  <Text style={styles.usuarioNome}>{u.nome_completo || '—'}</Text>
                  <Text style={styles.usuarioEmail}>{u.email_escolar || ''}</Text>
                  <Text style={styles.usuarioDetalhe}>{u.ra || '—'} · {u.turma || '—'}</Text>
                </View>

                <View style={styles.usuarioControles}>
                  <TouchableOpacity
                    style={styles.seletorBtnSm}
                    onPress={() => { setModalUidAlvo(u.uid); setModalTipo(true); }}
                  >
                    <Text style={styles.seletorBtnSmText}>{editTipo[u.uid] || u.tipo}</Text>
                    <Ionicons name="chevron-down" size={12} color={CORES.textoSec} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.seletorBtnSm}
                    onPress={() => { setModalUidAlvo(u.uid); setModalStatus(true); }}
                  >
                    <Text style={styles.seletorBtnSmText}>{STATUS_LABELS[editStatus[u.uid] ?? u.status]}</Text>
                    <Ionicons name="chevron-down" size={12} color={CORES.textoSec} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.btnSalvarRow}
                    onPress={() => salvarUsuario(u.uid)}
                    disabled={salvando[u.uid]}
                  >
                    {salvando[u.uid]
                      ? <ActivityIndicator color="#FFF" size="small" />
                      : <Ionicons name="checkmark" size={16} color="#FFF" />
                    }
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* ── MODAL TIPO (tabela) ── */}
      <Modal visible={modalTipo} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitulo}>Tipo de Usuário</Text>
            {TIPOS_USUARIO.map(t => (
              <TouchableOpacity
                key={t}
                style={styles.seletorItem}
                onPress={() => {
                  setEditTipo(prev => ({ ...prev, [modalUidAlvo]: t }));
                  setModalTipo(false);
                }}
              >
                <Text style={styles.seletorItemText}>{t}</Text>
                {editTipo[modalUidAlvo] === t && <Ionicons name="checkmark" size={18} color={CORES.rosa} />}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

      {/* ── MODAL STATUS (tabela) ── */}
      <Modal visible={modalStatus} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitulo}>Status</Text>
            {STATUS_OPCOES.map(s => (
              <TouchableOpacity
                key={s.value}
                style={styles.seletorItem}
                onPress={() => {
                  setEditStatus(prev => ({ ...prev, [modalUidAlvo]: s.value }));
                  setModalStatus(false);
                }}
              >
                <Text style={styles.seletorItemText}>{s.label}</Text>
                {editStatus[modalUidAlvo] === s.value && <Ionicons name="checkmark" size={18} color={CORES.rosa} />}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

      {/* ── MODAL TIPO (cartão) ── */}
      <Modal visible={modalCartaoTipo} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitulo}>Tipo de Usuário</Text>
            {TIPOS_USUARIO.map(t => (
              <TouchableOpacity
                key={t}
                style={styles.seletorItem}
                onPress={() => { setCartaoTipo(t); setModalCartaoTipo(false); }}
              >
                <Text style={styles.seletorItemText}>{t}</Text>
                {cartaoTipo === t && <Ionicons name="checkmark" size={18} color={CORES.rosa} />}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

      {/* ── MODAL STATUS (cartão) ── */}
      <Modal visible={modalCartaoSts} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitulo}>Status</Text>
            {STATUS_OPCOES.map(s => (
              <TouchableOpacity
                key={s.value}
                style={styles.seletorItem}
                onPress={() => { setCartaoStatus(s.value); setModalCartaoSts(false); }}
              >
                <Text style={styles.seletorItemText}>{s.label}</Text>
                {cartaoStatus === s.value && <Ionicons name="checkmark" size={18} color={CORES.rosa} />}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:          { flex: 1, backgroundColor: CORES.fundo },
  centro:             { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header:             { backgroundColor: CORES.azulEscuro, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, gap: 12 },
  headerEyebrow:      { color: 'rgba(255,255,255,0.45)', fontSize: 10, fontWeight: '800', letterSpacing: 2 },
  headerTitulo:       { color: CORES.branco, fontSize: 18, fontWeight: '900' },

  statsRow:           { flexDirection: 'row', backgroundColor: CORES.branco, borderBottomWidth: 1, borderBottomColor: CORES.cinzaClaro },
  statCard:           { flex: 1, alignItems: 'center', paddingVertical: 14, borderRightWidth: 1, borderRightColor: CORES.cinzaClaro },
  statN:              { fontSize: 22, fontWeight: '900', color: CORES.preto },
  statL:              { fontSize: 10, fontWeight: '700', color: CORES.textoSec, letterSpacing: 0.8 },

  abas:               { flexDirection: 'row', backgroundColor: CORES.branco, borderBottomWidth: 1, borderBottomColor: CORES.cinzaClaro },
  aba:                { flex: 1, paddingVertical: 12, alignItems: 'center' },
  abaAtiva:           { borderBottomWidth: 2, borderBottomColor: CORES.azulEscuro },
  abaText:            { fontSize: 13, fontWeight: '700', color: CORES.textoSec },
  abaTextAtiva:       { color: CORES.azulEscuro },

  // MAPA DE CALOR
  heatBanda:          { marginHorizontal: 16, marginTop: 16, backgroundColor: CORES.branco, borderRadius: 14, overflow: 'hidden', elevation: 2, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4 },
  heatBandaHeader:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: CORES.cinzaClaro, backgroundColor: CORES.fundo },
  heatCatLabel:       { fontSize: 11, fontWeight: '800', color: CORES.preto, letterSpacing: 0.8, textTransform: 'uppercase' },
  heatCatTotal:       { fontSize: 11, color: CORES.textoSec, fontWeight: '600' },
  heatCells:          { flexDirection: 'row', flexWrap: 'wrap', gap: 1, padding: 1, backgroundColor: CORES.cinzaClaro },
  heatCell:           { minWidth: 120, flex: 1, minHeight: 72, padding: 10, justifyContent: 'space-between' },
  heatCellTitulo:     { fontSize: 12, fontWeight: '700', lineHeight: 17 },
  heatCellMeta:       { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  heatCellViews:      { fontSize: 10, fontWeight: '600' },

  // TOP 5
  top5Secao:          { margin: 16, backgroundColor: CORES.branco, borderRadius: 14, padding: 16, elevation: 2, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4 },
  top5Titulo:         { fontSize: 11, fontWeight: '800', color: CORES.textoSec, letterSpacing: 1, marginBottom: 14 },
  top5Item:           { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: CORES.cinzaClaro },
  top5Pos:            { fontSize: 20, fontWeight: '900', color: CORES.cinzaClaro, minWidth: 32 },
  top5Nome:           { fontSize: 13, fontWeight: '700', color: CORES.preto },
  top5Meta:           { fontSize: 11, color: CORES.textoSec, marginTop: 2 },
  barraWrap:          { height: 3, backgroundColor: CORES.cinzaClaro, borderRadius: 2, marginTop: 6, overflow: 'hidden' },
  barra:              { height: 3, backgroundColor: CORES.azulEscuro },
  vazio:              { fontSize: 13, color: CORES.cinzaClaro, fontStyle: 'italic', textAlign: 'center', paddingVertical: 20 },

  // USUÁRIOS
  secaoTitulo:        { fontSize: 11, fontWeight: '800', color: CORES.textoSec, letterSpacing: 1, marginBottom: 10 },
  buscaRow:           { flexDirection: 'row', gap: 10, marginBottom: 10 },
  buscaInput:         { flex: 1, backgroundColor: CORES.branco, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: CORES.preto, borderWidth: 1, borderColor: CORES.cinzaClaro },
  btnBuscar:          { backgroundColor: CORES.azulEscuro, borderRadius: 12, paddingHorizontal: 16, justifyContent: 'center', alignItems: 'center' },
  msgErro:            { backgroundColor: '#FDECEA', borderLeftWidth: 3, borderLeftColor: CORES.vermelho, padding: 10, borderRadius: 8, marginBottom: 10 },
  msgErroText:        { fontSize: 13, color: CORES.vermelho, fontWeight: '600' },
  msgSucesso:         { backgroundColor: '#E8F8EE', borderLeftWidth: 3, borderLeftColor: CORES.verde, padding: 10, borderRadius: 8, marginBottom: 10 },
  msgSucessoText:     { fontSize: 13, color: CORES.verde, fontWeight: '600' },

  // CARTÃO
  cartao:             { backgroundColor: CORES.branco, borderRadius: 14, padding: 16, marginBottom: 16, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, borderWidth: 1, borderColor: CORES.preto },
  cartaoNome:         { fontSize: 17, fontWeight: '800', color: CORES.preto, marginBottom: 6 },
  cartaoDetalhe:      { fontSize: 13, color: CORES.textoSec, marginBottom: 3 },
  cartaoControles:    { flexDirection: 'row', gap: 10, marginTop: 14 },
  campoLabel:         { fontSize: 10, fontWeight: '800', color: CORES.textoSec, letterSpacing: 0.8, marginBottom: 5 },
  seletorBtn:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: CORES.fundo, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: CORES.cinzaClaro },
  seletorBtnText:     { fontSize: 13, fontWeight: '700', color: CORES.preto },
  btnSalvarCartao:    { backgroundColor: CORES.azulEscuro, borderRadius: 12, paddingVertical: 13, alignItems: 'center', marginTop: 14 },
  btnSalvarCartaoText:{ color: CORES.branco, fontWeight: '800', fontSize: 14 },

  // LISTA USUÁRIOS
  usuarioCard:        { backgroundColor: CORES.branco, borderRadius: 14, padding: 14, marginBottom: 10, elevation: 1, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 3 },
  usuarioInfo:        { marginBottom: 10 },
  usuarioNome:        { fontSize: 14, fontWeight: '800', color: CORES.preto },
  usuarioEmail:       { fontSize: 12, color: CORES.textoSec, marginTop: 2 },
  usuarioDetalhe:     { fontSize: 12, color: CORES.textoSec, marginTop: 2 },
  usuarioControles:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  seletorBtnSm:       { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: CORES.fundo, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, borderWidth: 1, borderColor: CORES.cinzaClaro },
  seletorBtnSmText:   { fontSize: 11, fontWeight: '700', color: CORES.preto },
  btnSalvarRow:       { width: 36, height: 36, borderRadius: 10, backgroundColor: CORES.verde, justifyContent: 'center', alignItems: 'center' },

  // MODAIS
  modalOverlay:       { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet:         { backgroundColor: CORES.branco, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 36 },
  modalHandle:        { width: 40, height: 4, backgroundColor: CORES.cinzaClaro, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  modalTitulo:        { fontSize: 17, fontWeight: '900', color: CORES.preto, marginBottom: 12 },
  seletorItem:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: CORES.cinzaClaro },
  seletorItemText:    { fontSize: 15, fontWeight: '700', color: CORES.preto },
});