import React, { useState, useEffect } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, ScrollView,
  SafeAreaView, StatusBar, Modal, TextInput, Alert,
  ActivityIndicator, Platform, FlatList
} from 'react-native';
import { db } from '../config/firebaseConfig';
import {
  collection, query, where, getDocs, addDoc,
  deleteDoc, doc, serverTimestamp
} from 'firebase/firestore';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';

// ── Constantes ─────────────────────────────────────────────────
const MESES = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'
];
const DIAS_SEMANA = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

const TIPOS_EVENTO = ['Prova','Feriado','Aviso','Evento'];

const TIPO_CONFIG: Record<string, { color: string; bg: string }> = {
  lembrete: { color: '#2c3e50', bg: '#EBF0F5' },
  Prova:    { color: '#e74c3c', bg: '#FDECEA' },
  Feriado:  { color: '#27ae60', bg: '#E8F8EE' },
  Aviso:    { color: '#e67e22', bg: '#FEF3E7' },
  Evento:   { color: '#8e44ad', bg: '#F3E8FA' },
};

const CORES = {
  azulEscuro: '#0B2046',
  rosa:        '#E51C6A',
  fundo:       '#F5F7FA',
  branco:      '#FFFFFF',
  cinzaClaro:  '#E2E8F0',
  textoSec:    '#64748B',
  preto:       '#1A1A2E',
};

const formatarDataStr = (ano: number, mes: number, dia: number) =>
  `${ano}-${String(mes).padStart(2,'0')}-${String(dia).padStart(2,'0')}`;

const extrairSerie = (turma: string) => {
  if (!turma) return null;
  const match = turma.match(/^(\d+)/);
  return match ? `${match[1]}º` : null;
};

const capitalizarPrimeira = (s: string) =>
  s ? s.charAt(0).toUpperCase() + s.slice(1) : '';

// ── Componente principal ────────────────────────────────────────
export default function Calendario({ navigation, route }: any) {
  const uid     = route?.params?.uid;
  const tipo    = route?.params?.tipo;
  const turma   = route?.params?.turma;
  const isAdmin = tipo?.toLowerCase() === 'administrador';
  const serie   = extrairSerie(turma || '');

  const hoje = new Date();
  const [mes,  setMes]  = useState(hoje.getMonth());
  const [ano,  setAno]  = useState(hoje.getFullYear());

  // Dados
  const [lembretes,    setLembretes]    = useState<Map<string, any[]>>(new Map());
  const [eventosAdmin, setEventosAdmin] = useState<Map<string, any[]>>(new Map());
  const [adminTodos,   setAdminTodos]   = useState<any[]>([]);
  const [loading,      setLoading]      = useState(true);

  // Modais
  const [modalDia,       setModalDia]       = useState(false);
  const [modalAdminForm, setModalAdminForm] = useState(false);
  const [modalLegenda,   setModalLegenda]   = useState(false);
  const [diaSelecionado, setDiaSelecionado] = useState('');

  // Form lembrete
  const [lembreTitulo, setLembreTitulo] = useState('');
  const [lembreDesc,   setLembreDesc]   = useState('');
  const [salvandoLemb, setSalvandoLemb] = useState(false);

  // Form admin
  const [adminTitulo,  setAdminTitulo]  = useState('');
  const [adminDesc,    setAdminDesc]    = useState('');
  const [adminData,    setAdminData]    = useState('');
  const [adminTipo,    setAdminTipo]    = useState('');
  const [adminSeries,  setAdminSeries]  = useState<string[]>([]);
  const [salvandoAdm,  setSalvandoAdm]  = useState(false);
  const [modalTipoEvt, setModalTipoEvt] = useState(false);
  const [modalDataEvt, setModalDataEvt] = useState(false);

  // ── Carregar dados ─────────────────────────────────────────────
  useEffect(() => { carregar(); }, []);

  const carregar = async () => {
    setLoading(true);
    await Promise.all([carregarLembretes(), carregarEventosAdmin()]);
    setLoading(false);
  };

  const carregarLembretes = async () => {
    if (!uid) return;
    try {
      const snap = await getDocs(query(
        collection(db, 'lembretes'), where('uid', '==', uid)
      ));
      const mapa = new Map<string, any[]>();
      snap.forEach(d => {
        const ev: any = { id: d.id, ...d.data() };
        if (!mapa.has(ev.data)) mapa.set(ev.data, []);
        mapa.get(ev.data)!.push(ev);
      });
      setLembretes(mapa);
    } catch (e) { console.error('Erro lembretes:', e); }
  };

  const carregarEventosAdmin = async () => {
    try {
      let snap;
      if (isAdmin) {
        snap = await getDocs(collection(db, 'eventos_admin'));
      } else if (serie) {
        snap = await getDocs(query(
          collection(db, 'eventos_admin'),
          where('series', 'array-contains', serie)
        ));
      } else return;

      const mapa = new Map<string, any[]>();
      const todos: any[] = [];
      snap.forEach(d => {
        const ev: any = { id: d.id, ...d.data() };
        todos.push(ev);
        if (!mapa.has(ev.data)) mapa.set(ev.data, []);
        mapa.get(ev.data)!.push(ev);
      });
      todos.sort((a, b) => a.data.localeCompare(b.data));
      setEventosAdmin(mapa);
      setAdminTodos(todos);
    } catch (e) { console.error('Erro eventos_admin:', e); }
  };

  // ── Ações lembrete ─────────────────────────────────────────────
  const salvarLembrete = async () => {
    if (!lembreTitulo.trim()) { Alert.alert('Atenção', 'O título é obrigatório.'); return; }
    setSalvandoLemb(true);
    try {
      const dados = {
        uid,
        data:      diaSelecionado,
        titulo:    capitalizarPrimeira(lembreTitulo.trim()),
        descricao: capitalizarPrimeira(lembreDesc.trim()),
        criado_em: serverTimestamp(),
      };
      const ref = await addDoc(collection(db, 'lembretes'), dados);
      const novoLemb = { id: ref.id, ...dados };
      setLembretes(prev => {
        const nova = new Map(prev);
        if (!nova.has(diaSelecionado)) nova.set(diaSelecionado, []);
        nova.get(diaSelecionado)!.push(novoLemb);
        return nova;
      });
      setLembreTitulo(''); setLembreDesc('');
    } catch { Alert.alert('Erro', 'Falha ao salvar lembrete.'); }
    finally  { setSalvandoLemb(false); }
  };

  const excluirLembrete = async (id: string) => {
    Alert.alert('Excluir', 'Excluir este lembrete?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: async () => {
          await deleteDoc(doc(db, 'lembretes', id));
          setLembretes(prev => {
            const nova = new Map(prev);
            const lista = (nova.get(diaSelecionado) || []).filter(e => e.id !== id);
            if (lista.length) nova.set(diaSelecionado, lista);
            else nova.delete(diaSelecionado);
            return nova;
          });
        }
      }
    ]);
  };

  // ── Ações admin ────────────────────────────────────────────────
  const toggleSerie = (s: string) =>
    setAdminSeries(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);

  const salvarEventoAdmin = async () => {
    if (!adminTitulo.trim() || !adminData || !adminTipo || adminSeries.length === 0) {
      Alert.alert('Atenção', 'Preencha todos os campos e selecione ao menos uma série.');
      return;
    }
    setSalvandoAdm(true);
    try {
      const dados = {
        titulo:    capitalizarPrimeira(adminTitulo.trim()),
        descricao: capitalizarPrimeira(adminDesc.trim()),
        data:      adminData,
        tipo:      adminTipo,
        series:    adminSeries,
        criado_em: serverTimestamp(),
      };
      const ref = await addDoc(collection(db, 'eventos_admin'), dados);
      const novoEv = { id: ref.id, ...dados };
      setEventosAdmin(prev => {
        const nova = new Map(prev);
        if (!nova.has(adminData)) nova.set(adminData, []);
        nova.get(adminData)!.push(novoEv);
        return nova;
      });
      setAdminTodos(prev => [...prev, novoEv].sort((a,b) => a.data.localeCompare(b.data)));
      setModalAdminForm(false);
      setAdminTitulo(''); setAdminDesc(''); setAdminData('');
      setAdminTipo(''); setAdminSeries([]);
    } catch { Alert.alert('Erro', 'Falha ao publicar evento.'); }
    finally  { setSalvandoAdm(false); }
  };

  const excluirEventoAdmin = async (id: string, dataStr: string) => {
    Alert.alert('Excluir', 'Excluir este evento para todos os alunos?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: async () => {
          await deleteDoc(doc(db, 'eventos_admin', id));
          setEventosAdmin(prev => {
            const nova = new Map(prev);
            const lista = (nova.get(dataStr) || []).filter(e => e.id !== id);
            if (lista.length) nova.set(dataStr, lista);
            else nova.delete(dataStr);
            return nova;
          });
          setAdminTodos(prev => prev.filter(e => e.id !== id));
        }
      }
    ]);
  };

  // ── Renderizar calendário ──────────────────────────────────────
  const primeiroDia = new Date(ano, mes, 1).getDay();
  const totalDias   = new Date(ano, mes + 1, 0).getDate();
  const celulas: (number | null)[] = [
    ...Array(primeiroDia).fill(null),
    ...Array.from({ length: totalDias }, (_, i) => i + 1),
  ];

  const renderCelula = (dia: number | null, idx: number) => {
    if (!dia) return <View key={`v${idx}`} style={styles.celulaVazia} />;

    const dataStr   = formatarDataStr(ano, mes + 1, dia);
    const eHoje     = dia === hoje.getDate() && mes === hoje.getMonth() && ano === hoje.getFullYear();
    const diaSem    = new Date(ano, mes, dia).getDay();
    const eFimSem   = diaSem === 0 || diaSem === 6;
    const temLemb   = lembretes.has(dataStr);
    const temAdmin  = eventosAdmin.has(dataStr);
    const tiposAdm  = temAdmin ? [...new Set(eventosAdmin.get(dataStr)!.map(e => e.tipo))] : [];

    return (
      <TouchableOpacity
        key={dataStr}
        style={[styles.celula, eFimSem && styles.celulaFimSem, (temLemb || temAdmin) && styles.celulaComEvento]}
        onPress={() => { setDiaSelecionado(dataStr); setModalDia(true); }}
        activeOpacity={0.7}
      >
        <View style={[styles.numWrap, eHoje && styles.numHoje]}>
          <Text style={[styles.numDia, eFimSem && { color: CORES.textoSec }, eHoje && { color: CORES.branco }]}>
            {dia}
          </Text>
        </View>
        <View style={styles.dotsRow}>
          {temLemb && <View style={[styles.dot, { backgroundColor: TIPO_CONFIG.lembrete.color }]} />}
          {tiposAdm.map(t => (
            <View key={t} style={[styles.dot, { backgroundColor: TIPO_CONFIG[t]?.color || '#888' }]} />
          ))}
        </View>
      </TouchableOpacity>
    );
  };

  // ── Modal dia: dados ───────────────────────────────────────────
  const parseDia = (ds: string) => {
    if (!ds) return { dia: 0, mesNome: '', anoN: 0, diaSemNome: '' };
    const [a, m, d] = ds.split('-').map(Number);
    const obj = new Date(a, m - 1, d);
    return { dia: d, mesNome: MESES[m - 1], anoN: a, diaSemNome: DIAS_SEMANA[obj.getDay()] };
  };

  const { dia: diaNum, mesNome: mesNomeDia, anoN, diaSemNome } = parseDia(diaSelecionado);
  const evsAdmDia: any[] = eventosAdmin.get(diaSelecionado) || [];
  const lembDia:   any[] = lembretes.get(diaSelecionado)    || [];

  // ── Seletor de data (simples: ano/mes/dia) ─────────────────────
  const [selAno, setSelAno] = useState(ano);
  const [selMes, setSelMes] = useState(mes + 1);
  const [selDia, setSelDia] = useState(1);

  const totalDiasSelMes = new Date(selAno, selMes, 0).getDate();

  const confirmarData = () => {
    setAdminData(formatarDataStr(selAno, selMes, selDia));
    setModalDataEvt(false);
  };

  if (loading) return (
    <View style={styles.centro}>
      <ActivityIndicator size="large" color={CORES.rosa} />
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={CORES.azulEscuro} />

      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.btnVoltar}>
          <Ionicons name="arrow-back" size={22} color={CORES.branco} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerEyebrow}>AGENDA ESCOLAR</Text>
          <Text style={styles.headerTitulo}>Calendário</Text>
        </View>
        <TouchableOpacity onPress={() => setModalLegenda(true)} style={styles.btnIcone}>
          <Ionicons name="information-circle-outline" size={24} color={CORES.branco} />
        </TouchableOpacity>
        {isAdmin && (
          <TouchableOpacity
            onPress={() => {
              setSelAno(ano); setSelMes(mes + 1); setSelDia(1);
              setAdminData(''); setAdminTitulo(''); setAdminDesc('');
              setAdminTipo(''); setAdminSeries([]);
              setModalAdminForm(true);
            }}
            style={styles.btnAdd}
          >
            <Ionicons name="add" size={20} color={CORES.branco} />
            <Text style={styles.btnAddText}>Evento</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

        {/* NAV MÊS */}
        <View style={styles.navMes}>
          <TouchableOpacity
            style={styles.btnNavMes}
            onPress={() => { if (mes === 0) { setMes(11); setAno(a => a - 1); } else setMes(m => m - 1); }}
          >
            <Ionicons name="chevron-back" size={18} color={CORES.preto} />
          </TouchableOpacity>

          <View style={{ alignItems: 'center' }}>
            <Text style={styles.navMesNome}>{MESES[mes]}</Text>
            <Text style={styles.navAno}>{ano}</Text>
          </View>

          <TouchableOpacity
            style={styles.btnNavMes}
            onPress={() => { if (mes === 11) { setMes(0); setAno(a => a + 1); } else setMes(m => m + 1); }}
          >
            <Ionicons name="chevron-forward" size={18} color={CORES.preto} />
          </TouchableOpacity>
        </View>

        {/* BOTÃO HOJE */}
        <TouchableOpacity
          style={styles.btnHoje}
          onPress={() => { setMes(hoje.getMonth()); setAno(hoje.getFullYear()); }}
        >
          <Text style={styles.btnHojeText}>Ir para hoje</Text>
        </TouchableOpacity>

        {/* DIAS DA SEMANA */}
        <View style={styles.semanaRow}>
          {DIAS_SEMANA.map(d => (
            <Text key={d} style={styles.semanaLabel}>{d}</Text>
          ))}
        </View>

        {/* GRADE */}
        <View style={styles.grade}>
          {celulas.map((dia, idx) => renderCelula(dia, idx))}
        </View>

        {/* LISTA EVENTOS ADMIN (só admin vê todos) */}
        {isAdmin && adminTodos.length > 0 && (
          <View style={styles.secaoAdmin}>
            <Text style={styles.secaoAdminTitulo}>EVENTOS CADASTRADOS</Text>
            {adminTodos.map(ev => (
              <View key={ev.id} style={styles.adminEvCard}>
                <View style={styles.adminEvTop}>
                  <View style={[styles.tipoBadge, { backgroundColor: TIPO_CONFIG[ev.tipo]?.bg }]}>
                    <Text style={[styles.tipoBadgeText, { color: TIPO_CONFIG[ev.tipo]?.color }]}>{ev.tipo}</Text>
                  </View>
                  <Text style={styles.adminEvData}>
                    {ev.data?.split('-').reverse().join('/')}
                  </Text>
                  <TouchableOpacity onPress={() => excluirEventoAdmin(ev.id, ev.data)} style={styles.btnDel}>
                    <Ionicons name="close" size={14} color={CORES.textoSec} />
                  </TouchableOpacity>
                </View>
                <Text style={styles.adminEvTitulo}>{ev.titulo}</Text>
                <Text style={styles.adminEvSeries}>{(ev.series || []).join(' · ')}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* ══════════════════════════════════════════════════════════
          MODAL DIA
      ══════════════════════════════════════════════════════════ */}
      <Modal visible={modalDia} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />

            {/* Cabeçalho dia */}
            <View style={styles.diaHeader}>
              <Text style={styles.diaSemLabel}>{diaSemNome}</Text>
              <Text style={styles.diaTituloData}>{diaNum} de {mesNomeDia}, {anoN}</Text>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: '80%' }}>

              {/* Eventos admin */}
              {evsAdmDia.length > 0 && (
                <View style={styles.diaBloco}>
                  <Text style={styles.diaBlocoTitulo}>
                    <Ionicons name="school-outline" size={12} /> AGENDA ESCOLAR
                  </Text>
                  {evsAdmDia.map(ev => (
                    <View key={ev.id} style={[styles.eventoItem, { borderLeftColor: TIPO_CONFIG[ev.tipo]?.color }]}>
                      <View style={styles.eventoTop}>
                        <View style={[styles.tipoBadge, { backgroundColor: TIPO_CONFIG[ev.tipo]?.bg }]}>
                          <Text style={[styles.tipoBadgeText, { color: TIPO_CONFIG[ev.tipo]?.color }]}>{ev.tipo}</Text>
                        </View>
                        <Text style={styles.eventoTitulo}>{ev.titulo}</Text>
                      </View>
                      {ev.descricao ? <Text style={styles.eventoDesc}>{ev.descricao}</Text> : null}
                      <Text style={styles.eventoMeta}>
                        Séries: {(ev.series || []).join(', ')}
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Lembretes */}
              <View style={styles.diaBloco}>
                <Text style={styles.diaBlocoTitulo}>
                  <Ionicons name="bookmark-outline" size={12} /> MEUS LEMBRETES
                </Text>
                {lembDia.length === 0
                  ? <Text style={styles.diaVazio}>Nenhum lembrete para este dia.</Text>
                  : lembDia.map(ev => (
                    <View key={ev.id} style={[styles.eventoItem, { borderLeftColor: TIPO_CONFIG.lembrete.color }]}>
                      <View style={styles.eventoTop}>
                        <View style={[styles.tipoBadge, { backgroundColor: TIPO_CONFIG.lembrete.bg }]}>
                          <Text style={[styles.tipoBadgeText, { color: TIPO_CONFIG.lembrete.color }]}>Lembrete</Text>
                        </View>
                        <Text style={styles.eventoTitulo}>{ev.titulo}</Text>
                        <TouchableOpacity onPress={() => excluirLembrete(ev.id)} style={styles.btnDel}>
                          <Ionicons name="trash-outline" size={14} color="#e74c3c" />
                        </TouchableOpacity>
                      </View>
                      {ev.descricao ? <Text style={styles.eventoDesc}>{ev.descricao}</Text> : null}
                    </View>
                  ))
                }
              </View>

              {/* Form lembrete */}
              <View style={[styles.diaBloco, { borderTopWidth: 1, borderTopColor: CORES.cinzaClaro, paddingTop: 16 }]}>
                <Text style={styles.diaBlocoTitulo}>
                  <Ionicons name="add-circle-outline" size={12} /> ADICIONAR LEMBRETE
                </Text>
                <TextInput
                  style={styles.lembInput}
                  placeholder="Título do lembrete *"
                  placeholderTextColor={CORES.textoSec}
                  value={lembreTitulo}
                  onChangeText={setLembreTitulo}
                />
                <TextInput
                  style={[styles.lembInput, { height: 70, textAlignVertical: 'top' }]}
                  placeholder="Descrição (opcional)"
                  placeholderTextColor={CORES.textoSec}
                  value={lembreDesc}
                  onChangeText={setLembreDesc}
                  multiline
                />
                <TouchableOpacity style={styles.btnSalvarLemb} onPress={salvarLembrete} disabled={salvandoLemb}>
                  {salvandoLemb
                    ? <ActivityIndicator color="#FFF" size="small" />
                    : <Text style={styles.btnSalvarLembText}>Salvar Lembrete</Text>
                  }
                </TouchableOpacity>
              </View>
            </ScrollView>

            <TouchableOpacity style={styles.btnFecharModal} onPress={() => setModalDia(false)}>
              <Text style={styles.btnFecharModalText}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ══════════════════════════════════════════════════════════
          MODAL ADMIN — NOVO EVENTO
      ══════════════════════════════════════════════════════════ */}
      <Modal visible={modalAdminForm} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, justifyContent: 'flex-end' }}>
            <View style={[styles.modalSheet, { paddingBottom: Platform.OS === 'ios' ? 40 : 28 }]}>
              <View style={styles.modalHandle} />
              <Text style={styles.modalTitulo}>Novo Evento Escolar</Text>
              <Text style={styles.modalSub}>Será visível para os alunos das séries selecionadas</Text>

              <Text style={styles.formLabel}>TÍTULO *</Text>
              <TextInput
                style={styles.formInput}
                placeholder="Ex: Prova de Matemática"
                placeholderTextColor={CORES.textoSec}
                value={adminTitulo}
                onChangeText={setAdminTitulo}
              />

              <Text style={styles.formLabel}>DESCRIÇÃO</Text>
              <TextInput
                style={[styles.formInput, { height: 72, textAlignVertical: 'top' }]}
                placeholder="Informações adicionais..."
                placeholderTextColor={CORES.textoSec}
                value={adminDesc}
                onChangeText={setAdminDesc}
                multiline
              />

              <View style={styles.adminRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.formLabel}>DATA *</Text>
                  <TouchableOpacity
                    style={styles.formSelect}
                    onPress={() => {
                      setSelAno(ano); setSelMes(mes + 1); setSelDia(1);
                      setModalDataEvt(true);
                    }}
                  >
                    <Text style={[styles.formSelectText, !adminData && { color: CORES.textoSec }]}>
                      {adminData ? adminData.split('-').reverse().join('/') : 'Selecione...'}
                    </Text>
                    <Ionicons name="calendar-outline" size={16} color={CORES.textoSec} />
                  </TouchableOpacity>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.formLabel}>TIPO *</Text>
                  <TouchableOpacity style={styles.formSelect} onPress={() => setModalTipoEvt(true)}>
                    <Text style={[styles.formSelectText, !adminTipo && { color: CORES.textoSec }]}>
                      {adminTipo || 'Selecione...'}
                    </Text>
                    <Ionicons name="chevron-down" size={16} color={CORES.textoSec} />
                  </TouchableOpacity>
                </View>
              </View>

              <Text style={styles.formLabel}>SÉRIES *</Text>
              <View style={styles.seriesRow}>
                {['1º','2º','3º'].map(s => (
                  <TouchableOpacity
                    key={s}
                    style={[styles.serieBadge, adminSeries.includes(s) && styles.serieBadgeAtivo]}
                    onPress={() => toggleSerie(s)}
                  >
                    <Text style={[styles.serieBadgeText, adminSeries.includes(s) && { color: CORES.branco }]}>
                      {s} Ano
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.formBtns}>
                <TouchableOpacity
                  style={[styles.formBtn, { backgroundColor: CORES.cinzaClaro }]}
                  onPress={() => setModalAdminForm(false)}
                >
                  <Text style={[styles.formBtnText, { color: CORES.preto }]}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.formBtn, { backgroundColor: CORES.azulEscuro }]}
                  onPress={salvarEventoAdmin}
                  disabled={salvandoAdm}
                >
                  {salvandoAdm
                    ? <ActivityIndicator color="#FFF" size="small" />
                    : <Text style={[styles.formBtnText, { color: CORES.branco }]}>Publicar</Text>
                  }
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* ── SELETOR TIPO EVENTO ── */}
      <Modal visible={modalTipoEvt} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitulo}>Tipo de Evento</Text>
            {TIPOS_EVENTO.map(t => (
              <TouchableOpacity
                key={t}
                style={styles.seletorItem}
                onPress={() => { setAdminTipo(t); setModalTipoEvt(false); }}
              >
                <View style={[styles.dot, { backgroundColor: TIPO_CONFIG[t]?.color, width: 10, height: 10 }]} />
                <Text style={styles.seletorItemText}>{t}</Text>
                {adminTipo === t && <Ionicons name="checkmark" size={18} color={CORES.rosa} />}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

      {/* ── SELETOR DATA ── */}
      <Modal visible={modalDataEvt} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitulo}>Selecionar Data</Text>

            {/* Ano */}
            <View style={styles.dataPickerRow}>
              <TouchableOpacity onPress={() => setSelAno(a => a - 1)} style={styles.btnNavMes}>
                <Ionicons name="chevron-back" size={16} color={CORES.preto} />
              </TouchableOpacity>
              <Text style={styles.dataPickerValor}>{selAno}</Text>
              <TouchableOpacity onPress={() => setSelAno(a => a + 1)} style={styles.btnNavMes}>
                <Ionicons name="chevron-forward" size={16} color={CORES.preto} />
              </TouchableOpacity>
            </View>

            {/* Mês */}
            <View style={styles.dataPickerRow}>
              <TouchableOpacity onPress={() => setSelMes(m => m === 1 ? 12 : m - 1)} style={styles.btnNavMes}>
                <Ionicons name="chevron-back" size={16} color={CORES.preto} />
              </TouchableOpacity>
              <Text style={styles.dataPickerValor}>{MESES[selMes - 1]}</Text>
              <TouchableOpacity onPress={() => setSelMes(m => m === 12 ? 1 : m + 1)} style={styles.btnNavMes}>
                <Ionicons name="chevron-forward" size={16} color={CORES.preto} />
              </TouchableOpacity>
            </View>

            {/* Dia */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 12 }}>
              {Array.from({ length: totalDiasSelMes }, (_, i) => i + 1).map(d => (
                <TouchableOpacity
                  key={d}
                  style={[styles.diaPickerBtn, selDia === d && styles.diaPickerBtnAtivo]}
                  onPress={() => setSelDia(d)}
                >
                  <Text style={[styles.diaPickerText, selDia === d && { color: CORES.branco }]}>{d}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity style={[styles.formBtn, { backgroundColor: CORES.azulEscuro, marginTop: 8 }]} onPress={confirmarData}>
              <Text style={[styles.formBtnText, { color: CORES.branco }]}>Confirmar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── MODAL LEGENDA ── */}
      <Modal visible={modalLegenda} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitulo}>Legenda</Text>
            {[
              { key: 'lembrete', label: 'Meu lembrete' },
              { key: 'Prova',    label: 'Prova'         },
              { key: 'Feriado',  label: 'Feriado'       },
              { key: 'Aviso',    label: 'Aviso Escolar' },
              { key: 'Evento',   label: 'Evento'        },
            ].map(item => (
              <View key={item.key} style={styles.legendaItem}>
                <View style={[styles.dot, { backgroundColor: TIPO_CONFIG[item.key]?.color, width: 10, height: 10 }]} />
                <Text style={styles.legendaText}>{item.label}</Text>
              </View>
            ))}
            <TouchableOpacity style={styles.btnFecharModal} onPress={() => setModalLegenda(false)}>
              <Text style={styles.btnFecharModalText}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const CEL_SIZE = Math.floor((require('react-native').Dimensions.get('window').width - 32) / 7);

const styles = StyleSheet.create({
  container:         { flex: 1, backgroundColor: CORES.fundo },
  centro:            { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // HEADER
  header:            { backgroundColor: CORES.azulEscuro, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, gap: 12 },
  btnVoltar:         { padding: 4 },
  headerEyebrow:     { color: 'rgba(255,255,255,0.45)', fontSize: 10, fontWeight: '800', letterSpacing: 2 },
  headerTitulo:      { color: CORES.branco, fontSize: 20, fontWeight: '900', letterSpacing: -0.5 },
  btnIcone:          { padding: 4 },
  btnAdd:            { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: CORES.rosa, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  btnAddText:        { color: CORES.branco, fontWeight: '800', fontSize: 13 },

  // NAV MÊS
  navMes:            { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, backgroundColor: CORES.branco, borderBottomWidth: 1, borderBottomColor: CORES.cinzaClaro },
  btnNavMes:         { width: 34, height: 34, borderRadius: 8, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: CORES.cinzaClaro },
  navMesNome:        { fontSize: 16, fontWeight: '800', color: CORES.preto, textAlign: 'center' },
  navAno:            { fontSize: 12, color: CORES.textoSec, textAlign: 'center', fontWeight: '600' },
  btnHoje:           { alignSelf: 'center', marginVertical: 8, paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: CORES.cinzaClaro, backgroundColor: CORES.branco },
  btnHojeText:       { fontSize: 12, fontWeight: '700', color: CORES.textoSec },

  // GRADE
  semanaRow:         { flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: CORES.cinzaClaro },
  semanaLabel:       { width: CEL_SIZE, textAlign: 'center', fontSize: 10, fontWeight: '800', color: CORES.textoSec, letterSpacing: 0.8 },
  grade:             { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, paddingTop: 4 },
  celula:            { width: CEL_SIZE, height: CEL_SIZE + 10, borderWidth: 0.5, borderColor: CORES.cinzaClaro, padding: 4, backgroundColor: CORES.branco },
  celulaVazia:       { width: CEL_SIZE, height: CEL_SIZE + 10, backgroundColor: '#F9FAFB', borderWidth: 0.5, borderColor: CORES.cinzaClaro },
  celulaFimSem:      { backgroundColor: '#FAFAF8' },
  celulaComEvento:   { backgroundColor: '#FAFFF9' },
  numWrap:           { width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  numHoje:           { backgroundColor: CORES.preto },
  numDia:            { fontSize: 12, fontWeight: '600', color: CORES.preto },
  dotsRow:           { flexDirection: 'row', flexWrap: 'wrap', gap: 2, marginTop: 2 },
  dot:               { width: 6, height: 6, borderRadius: 3 },

  // SEÇÃO ADMIN
  secaoAdmin:        { margin: 16, backgroundColor: CORES.branco, borderRadius: 16, padding: 16, elevation: 2, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4 },
  secaoAdminTitulo:  { fontSize: 11, fontWeight: '800', color: CORES.textoSec, letterSpacing: 1, marginBottom: 12 },
  adminEvCard:       { marginBottom: 10, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: CORES.cinzaClaro },
  adminEvTop:        { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  adminEvData:       { fontSize: 11, color: CORES.textoSec, marginLeft: 'auto' as any },
  btnDel:            { padding: 4 },
  adminEvTitulo:     { fontSize: 14, fontWeight: '700', color: CORES.preto },
  adminEvSeries:     { fontSize: 11, color: CORES.textoSec, marginTop: 2 },

  // MODAIS
  modalOverlay:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet:        { backgroundColor: CORES.branco, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 36, maxHeight: '92%' },
  modalHandle:       { width: 40, height: 4, backgroundColor: CORES.cinzaClaro, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  modalTitulo:       { fontSize: 18, fontWeight: '900', color: CORES.preto, marginBottom: 4 },
  modalSub:          { fontSize: 12, color: CORES.textoSec, marginBottom: 16 },

  // MODAL DIA
  diaHeader:         { marginBottom: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: CORES.preto },
  diaSemLabel:       { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: CORES.textoSec, textTransform: 'uppercase' },
  diaTituloData:     { fontSize: 22, fontWeight: '900', color: CORES.preto },
  diaBloco:          { marginBottom: 16 },
  diaBlocoTitulo:    { fontSize: 10, fontWeight: '800', color: CORES.textoSec, letterSpacing: 1, marginBottom: 10, textTransform: 'uppercase' },
  diaVazio:          { fontSize: 13, color: CORES.cinzaClaro, fontStyle: 'italic' },
  eventoItem:        { borderLeftWidth: 3, borderLeftColor: CORES.cinzaClaro, paddingLeft: 10, paddingVertical: 6, backgroundColor: '#F8FAFC', marginBottom: 8, borderRadius: 4 },
  eventoTop:         { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  eventoTitulo:      { fontSize: 13, fontWeight: '700', color: CORES.preto, flex: 1 },
  eventoDesc:        { fontSize: 12, color: CORES.textoSec, lineHeight: 18 },
  eventoMeta:        { fontSize: 11, color: CORES.textoSec, marginTop: 4 },

  tipoBadge:         { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
  tipoBadgeText:     { fontSize: 10, fontWeight: '800', letterSpacing: 0.4 },

  lembInput:         { backgroundColor: CORES.fundo, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: CORES.preto, borderWidth: 1, borderColor: CORES.cinzaClaro, marginBottom: 10 },
  btnSalvarLemb:     { backgroundColor: CORES.preto, borderRadius: 12, paddingVertical: 13, alignItems: 'center', marginTop: 4 },
  btnSalvarLembText: { color: CORES.branco, fontWeight: '800', fontSize: 14 },

  // FORM ADMIN
  formLabel:         { fontSize: 11, fontWeight: '800', color: CORES.textoSec, letterSpacing: 0.8, marginBottom: 7, marginTop: 12 },
  formInput:         { backgroundColor: CORES.fundo, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: CORES.preto, borderWidth: 1, borderColor: CORES.cinzaClaro },
  formSelect:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: CORES.fundo, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: CORES.cinzaClaro },
  formSelectText:    { fontSize: 14, fontWeight: '600', color: CORES.preto },
  adminRow:          { flexDirection: 'row', gap: 10 },
  seriesRow:         { flexDirection: 'row', gap: 10, marginTop: 4 },
  serieBadge:        { flex: 1, paddingVertical: 11, borderRadius: 12, borderWidth: 1.5, borderColor: CORES.cinzaClaro, alignItems: 'center', backgroundColor: CORES.fundo },
  serieBadgeAtivo:   { backgroundColor: CORES.azulEscuro, borderColor: CORES.azulEscuro },
  serieBadgeText:    { fontSize: 13, fontWeight: '800', color: CORES.textoSec },
  formBtns:          { flexDirection: 'row', gap: 10, marginTop: 20 },
  formBtn:           { flex: 1, borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  formBtnText:       { fontWeight: '800', fontSize: 14 },

  // SELETOR DATA
  dataPickerRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  dataPickerValor:   { fontSize: 16, fontWeight: '800', color: CORES.preto, flex: 1, textAlign: 'center' },
  diaPickerBtn:      { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: CORES.cinzaClaro, backgroundColor: CORES.fundo },
  diaPickerBtnAtivo: { backgroundColor: CORES.azulEscuro, borderColor: CORES.azulEscuro },
  diaPickerText:     { fontSize: 13, fontWeight: '700', color: CORES.preto },

  // SELETOR GENÉRICO
  seletorItem:       { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: CORES.cinzaClaro },
  seletorItemText:   { flex: 1, fontSize: 15, fontWeight: '700', color: CORES.preto },

  // LEGENDA
  legendaItem:       { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  legendaText:       { fontSize: 14, fontWeight: '600', color: CORES.preto },

  btnFecharModal:    { backgroundColor: CORES.fundo, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 12 },
  btnFecharModalText:{ fontWeight: '800', fontSize: 14, color: CORES.textoSec },
});