import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet, Text, View, ScrollView, TouchableOpacity,
  Image, SafeAreaView, StatusBar, Dimensions, Modal,
  ActivityIndicator, FlatList, Vibration
} from 'react-native';
import { db } from '../config/firebaseConfig';
import {
  collection, doc, getDoc, getDocs, query, where,
  addDoc, updateDoc, setDoc, serverTimestamp, onSnapshot
} from 'firebase/firestore';
import { Ionicons, FontAwesome5, MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
// ✅ ADICIONAR: Notificações
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppSettings } from '../contexts/AppSettingsContext';
// ✅ GAMIFICAÇÃO — Import do service
import { awardXpMatch } from '../services/gamificationService';

const { width, height } = Dimensions.get('window');

const CORES = {
  azulEscuro:      '#0B2046',
  rosa:            '#E51C6A',
  amarelo:         '#FFC82C',
  fundo:           '#F5F7FA',
  cinzaClaro:      '#EAEFF4',
  textoSecundario: '#8D99AE',
  branco:          '#FFFFFF',
  verde:           '#10B981',
};

const MATERIAS = [
  'Português', 'Redação', 'Matemática', 'Física', 'Química', 'Biologia',
  'História', 'Geografia', 'Inglês', 'Filosofia', 'Sociologia',
];

const getImageUri = (foto: any) => {
  const padrao = 'https://cdn-icons-png.flaticon.com/512/149/149071.png';
  if (!foto) return padrao;
  if (typeof foto === 'string') {
    if (foto.startsWith('http') || foto.startsWith('data:image')) return foto;
    if (foto.length > 100) return `data:image/jpeg;base64,${foto}`;
  }
  return padrao;
};

type Aba  = 'descobrir' | 'solicitacoes' | 'matches';
type Modo = 'aprender'  | 'ensinar';

// ── Hook: ouve conversas de uma lista de matchIds ──
function useConversas(meuUid: string | undefined, matchIds: string[]) {
  const [conversas, setConversas] = useState<Record<string, any>>({});

  useEffect(() => {
    if (!meuUid || matchIds.length === 0) return;
    const unsubs: (() => void)[] = [];

    matchIds.forEach(outroUid => {
      const conversaId = [meuUid, outroUid].sort().join('_');
      const unsub = onSnapshot(doc(db, 'conversas', conversaId), snap => {
        if (snap.exists()) {
          setConversas(prev => ({ ...prev, [outroUid]: snap.data() }));
        }
      });
      unsubs.push(unsub);
    });

    return () => unsubs.forEach(u => u());
  }, [meuUid, matchIds.join(',')]);

  return conversas;
}

export default function Match({ navigation, route }: any) {
  const insets = useSafeAreaInsets();
  const [abaAtiva,       setAbaAtiva]       = useState<Aba>('descobrir');
  const [modo,           setModo]           = useState<Modo>('aprender');
  const [materiasFiltro, setMateriasFiltro] = useState<string[]>([]);
  const [interagidosCarregado, setInteragidosCarregado] = useState(false);
  const uidsInteragidosRef = useRef<Set<string>>(new Set());  
  const [candidatos,     setCandidatos]     = useState<any[]>([]);
  const [solicitacoes,   setSolicitacoes]   = useState<any[]>([]);
  const [matches,        setMatches]        = useState<any[]>([]);
  const [meusDados,      setMeusDados]      = useState<any>(null);
  const [carregando,     setCarregando]     = useState(false);
  const [popupInfo,      setPopupInfo]      = useState(false);
  const [popupMateria,   setPopupMateria]   = useState(false);
  const [cardAtual,      setCardAtual]      = useState(0);

  const meuUid = route?.params?.uid;

  const matchUids = matches.map(m => m.outro?.uid).filter(Boolean);
  const conversas = useConversas(meuUid, matchUids);

  // ── Dados do usuário logado ──
  useEffect(() => {
    if (!meuUid) return;
    getDoc(doc(db, 'usuarios', meuUid)).then(snap => {
      if (snap.exists()) setMeusDados({ ...snap.data(), uid: meuUid });
    });
  }, [meuUid]);

  // ── Ouve todas as solicitações onde sou parte ──
  useEffect(() => {
    if (!meuUid) return;
    const qEnv = query(collection(db, 'match_solicitacoes'), where('deUid',   '==', meuUid));
    const qRec = query(collection(db, 'match_solicitacoes'), where('paraUid', '==', meuUid));

    let envSnap: any = null, recSnap: any = null;
    let envOk = false, recOk = false;

    const recalcular = () => {
      const uids = new Set<string>();
      envSnap?.docs?.forEach((d: any) => uids.add(d.data().paraUid));
      recSnap?.docs?.forEach((d: any) => uids.add(d.data().deUid));
      uidsInteragidosRef.current = uids;
      if (envOk && recOk) setInteragidosCarregado(true);
    };

    const u1 = onSnapshot(qEnv, s => { envSnap = s; envOk = true; recalcular(); });
    const u2 = onSnapshot(qRec, s => { recSnap = s; recOk = true; recalcular(); });
    return () => { u1(); u2(); };
  }, [meuUid]);

  // ── Carrega candidatos quando filtro muda ──
  useEffect(() => {
    if (!meusDados || !interagidosCarregado) return;
    carregarCandidatos();
  }, [meusDados, modo, materiasFiltro.join(','), interagidosCarregado]);

  // ── Ouve solicitações pendentes recebidas ──
  // ✅ ADICIONAR: notificação de nova solicitação
  useEffect(() => {
    if (!meuUid) return;
    const q = query(
      collection(db, 'match_solicitacoes'),
      where('paraUid', '==', meuUid),
      where('status',  '==', 'pendente')
    );
    const unsub = onSnapshot(q, async snap => {
      const lista = (await Promise.all(snap.docs.map(async d => {
        const data = d.data();
        const rSnap = await getDoc(doc(db, 'usuarios', data.deUid));
        if (!rSnap.exists()) return null;
        return { id: d.id, ...data, remetente: rSnap.data() };
      }))).filter(Boolean);

      // 🔔 Notificações de match agora são tratadas globalmente pelo
      // NotificacaoProvider (funciona em qualquer tela, sem duplicar).
      setSolicitacoes(lista);
    });
    return () => unsub();
  }, [meuUid]);

  // ── Ouve matches confirmados ──
  useEffect(() => {
    if (!meuUid) return;
    const q = query(
      collection(db, 'match_solicitacoes'),
      where('status',  '==', 'aceito'),
      where('membros', 'array-contains', meuUid)
    );
    const unsub = onSnapshot(q, async snap => {
      const parVistos = new Map<string, any>();
      await Promise.all(snap.docs.map(async d => {
        const data     = d.data();
        const outroUid = data.membros?.find((id: string) => id !== meuUid);
        if (!outroUid) return;
        const oSnap = await getDoc(doc(db, 'usuarios', outroUid));
        if (!oSnap.exists()) return;
        const jaExiste = parVistos.get(outroUid);
        const ts = data.criadoEm?.seconds ?? 0;
        if (!jaExiste || ts > (jaExiste._ts ?? 0)) {
          parVistos.set(outroUid, {
            id: d.id, ...data, _ts: ts,
            outro: { ...oSnap.data(), uid: outroUid },
          });
        }
      }));
      setMatches(Array.from(parVistos.values()));
    });
    return () => unsub();
  }, [meuUid]);

  const carregarCandidatos = async () => {
    setCarregando(true);
    setCardAtual(0);
    try {
      const snap = await getDocs(collection(db, 'usuarios'));
      const jaInteragidos = uidsInteragidosRef.current;
      const todos = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter((u: any) => {
          if (u.id === meuUid)         return false;
          if (u.status !== 1)          return false;
          if (jaInteragidos.has(u.id)) return false;
          const campo    = modo === 'aprender' ? 'ensinar' : 'melhorar';
          const materias = u[campo] || [];
          if (materiasFiltro.length > 0) return materiasFiltro.some(m => materias.includes(m));
          return materias.length > 0;
        });
      setCandidatos(todos);
    } catch (e) { console.log(e); }
    finally { setCarregando(false); }
  };

  const enviarSolicitacao = async (paraUid: string) => {
    if (!meuUid) return;
    uidsInteragidosRef.current.add(paraUid);
    try {
      await addDoc(collection(db, 'match_solicitacoes'), {
        deUid: meuUid, paraUid,
        status: 'pendente', membros: [meuUid, paraUid],
        criadoEm: serverTimestamp(),
      });
    } catch (e) { console.log(e); }
    setCardAtual(prev => prev + 1);
  };

  const recusarCard = () => setCardAtual(prev => prev + 1);

  const responderSolicitacao = async (solId: string, deUid: string, aceitar: boolean) => {
    try {
      await updateDoc(doc(db, 'match_solicitacoes', solId), {
        status: aceitar ? 'aceito' : 'recusado',
      });
      if (aceitar && meuUid) {
        const conversaId = [meuUid, deUid].sort().join('_');
        const [meuSnap, outroSnap] = await Promise.all([
          getDoc(doc(db, 'usuarios', meuUid)),
          getDoc(doc(db, 'usuarios', deUid)),
        ]);
        const meuData   = meuSnap.exists()  ? meuSnap.data()  : {};
        const outroData = outroSnap.exists() ? outroSnap.data() : {};
        await setDoc(doc(db, 'conversas', conversaId), {
          membros: [meuUid, deUid],
          ultimaMensagem: '🤝 Vocês fizeram match!',
          data_postagem: serverTimestamp(),
          quemEnviou: deUid, visto: false, isMatch: true,
          dadosMembros: {
            [meuUid]: { nome: meuData.nome_completo   || 'Usuário', foto: meuData.foto   || null },
            [deUid]:  { nome: outroData.nome_completo || 'Usuário', foto: outroData.foto || null },
          },
        }, { merge: true });
      }
    } catch (e) { console.log(e); }
  };

  const abrirChat = (outroUid: string, outroNome: string, outraFoto: string) => {
    const conversaId = [meuUid, outroUid].sort().join('_');
    navigation.navigate('Chat', {
      room: conversaId, meuUid,
      meuNome:   meusDados?.nome_completo,
      minhaFoto: meusDados?.foto || null,
      outroUid, outroNome,
      outraFoto: outraFoto || null,
    });
  };

  // ✅ Abre o perfil público de uma pessoa (toque na foto)
  const abrirPerfil = (outroUid: string) => {
    if (!outroUid) return;
    navigation.navigate('PerfilPublico', { uid: outroUid, meuUid });
  };

  const getMateriaDoMatch = (item: any): { materias: string[]; tipo: 'te ensina' | 'você ensina' } => {
    const outro = item.outro || {};
    if (item.deUid === meuUid) {
      return { materias: outro.ensinar || [], tipo: 'te ensina' };
    } else {
      return { materias: meusDados?.ensinar || [], tipo: 'você ensina' };
    }
  };

  const toggleMateria = (m: string) => {
    setMateriasFiltro(prev =>
      prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]
    );
  };

  // ✅ GAMIFICAÇÃO — Finalizar match com avaliação 5⭐
  const finalizarMatchComAvaliacao = async (outroUid: string, avaliacao: number) => {
    if (avaliacao === 5 && meuUid) {
      // Quando o usuário avalia com 5 ⭐, award XP
      const sucesso = await awardXpMatch(meuUid);
      if (sucesso) {
        // Mostrar toast de sucesso
        console.log('✅ Match concluído com sucesso! +50 XP, +15 Moedas');
        // TODO: Adicionar toast visual aqui
      } else {
        console.warn('⚠️ Não foi possível registrar XP (limite diário atingido?)');
      }
    }
  };

  // ── Matches ordenados pela última mensagem ──
  const matchesOrdenados = [...matches].sort((a, b) => {
    const ca = conversas[a.outro?.uid];
    const cb = conversas[b.outro?.uid];
    const ta = ca?.data_postagem?.seconds ?? a._ts ?? 0;
    const tb = cb?.data_postagem?.seconds ?? b._ts ?? 0;
    return tb - ta;
  });

  // ── CARD DE CANDIDATO ──
  const card = candidatos[cardAtual];

  const renderCard = () => {
    if (carregando) return (
      <View style={styles.centro}>
        <ActivityIndicator size="large" color={CORES.rosa} />
      </View>
    );
    if (!card) return (
      <View style={styles.centro}>
        <FontAwesome5 name="search" size={48} color={CORES.cinzaClaro} />
        <Text style={styles.txtVazio}>Ninguém mais por aqui!</Text>
        <Text style={[styles.txtVazio, { fontSize: 13, marginTop: 4 }]}>
          Tente mudar o filtro ou volte mais tarde.
        </Text>
        <TouchableOpacity style={styles.btnRecarregar} onPress={carregarCandidatos}>
          <Text style={styles.btnRecarregarTxt}>Recarregar</Text>
        </TouchableOpacity>
      </View>
    );

    const materias: string[] = modo === 'aprender' ? (card.ensinar || []) : (card.melhorar || []);

    return (
      <View style={styles.cardWrap}>
        <View style={styles.matchCard}>
          <Image source={{ uri: getImageUri(card.foto) }} style={styles.cardFoto} />
          <View style={styles.cardOverlay} />
          <View style={styles.cardInfo}>
            <Text style={styles.cardNome}>{card.nome_completo}</Text>
            <Text style={styles.cardTurma}>{card.turma || card.ra || ''}</Text>
            <View style={styles.materiasRow}>
              {materias.slice(0, 4).map((m: string) => (
                <View key={m} style={styles.materiaTag}>
                  <Text style={styles.materiaTagTxt}>{m}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        <Text style={styles.arenaContador}>{cardAtual + 1} de {candidatos.length}</Text>

        <View style={styles.acoesRow}>
          <TouchableOpacity style={styles.btnRecusar} onPress={recusarCard}>
            <Ionicons name="close" size={28} color="#FF5252" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnAceitar} onPress={() => enviarSolicitacao(card.id)}>
            <Ionicons name="heart" size={28} color={CORES.branco} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // ── ITEM DE SOLICITAÇÃO ──
  const renderSolicitacao = ({ item }: any) => (
    <View style={styles.solCard}>
      <TouchableOpacity onPress={() => abrirPerfil(item.deUid)} activeOpacity={0.8}>
        <Image source={{ uri: getImageUri(item.remetente?.foto) }} style={styles.solAvatar} />
      </TouchableOpacity>
      <View style={styles.solInfo}>
        <Text style={styles.solNome}>{item.remetente?.nome_completo || 'Usuário'}</Text>
        <Text style={styles.solTurma}>{item.remetente?.turma || ''}</Text>
      </View>
      <View style={styles.solAcoes}>
        <TouchableOpacity
          style={styles.btnSolRecusar}
          onPress={() => responderSolicitacao(item.id, item.deUid, false)}
        >
          <Ionicons name="close" size={20} color="#FF5252" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.btnSolAceitar}
          onPress={() => responderSolicitacao(item.id, item.deUid, true)}
        >
          <Ionicons name="checkmark" size={20} color={CORES.branco} />
        </TouchableOpacity>
      </View>
    </View>
  );

  // ── ITEM DE MATCH ──
  const renderMatch = ({ item }: any) => {
    const { materias, tipo } = getMateriaDoMatch(item);
    const isEnsina  = tipo === 'te ensina';
    const outroUid  = item.outro?.uid;
    const conversa  = conversas[outroUid];

    const ultimaMsg  = conversa?.ultimaMensagem || '';
    const quemEnviou = conversa?.quemEnviou;
    const naoLida    = conversa && !conversa.visto && quemEnviou !== meuUid;
    const prefixo    = quemEnviou === meuUid
      ? 'Você: '
      : (item.outro?.nome_completo?.split(' ')[0] + ': ' || '');
    const labelMsg   = ultimaMsg
      ? `${prefixo}${ultimaMsg}`
      : 'Diga olá! 👋';

    return (
      <TouchableOpacity
        style={[styles.solCard, naoLida && styles.solCardNaoLido]}
        onPress={() => abrirChat(outroUid, item.outro?.nome_completo, item.outro?.foto)}
        activeOpacity={0.75}
      >
        <TouchableOpacity style={styles.avatarWrap} onPress={() => abrirPerfil(outroUid)} activeOpacity={0.8}>
          <Image source={{ uri: getImageUri(item.outro?.foto) }} style={styles.solAvatar} />
          {naoLida && <View style={styles.bolinhaVerde} />}
        </TouchableOpacity>

        <View style={styles.solInfo}>
          <View style={styles.nomeLinha}>
            <Text
              style={[styles.solNome, naoLida && styles.solNomeNaoLido]}
              numberOfLines={1}
            >
              {item.outro?.nome_completo || 'Usuário'}
            </Text>

            <View style={[styles.tagTipo, { backgroundColor: isEnsina ? '#E8F5E9' : '#FFF3E0' }]}>
              <Ionicons
                name={isEnsina ? 'school-outline' : 'book-outline'}
                size={9}
                color={isEnsina ? '#2E7D32' : '#E65100'}
              />
              <Text style={[styles.tagTipoTxt, { color: isEnsina ? '#2E7D32' : '#E65100' }]}>
                {tipo}
              </Text>
            </View>

            {materias.slice(0, 2).map((m: string) => (
              <View
                key={m}
                style={[styles.tagMateria, { backgroundColor: isEnsina ? '#E3F2FD' : '#FCE4EC' }]}
              >
                <Text style={[styles.tagMateriaTxt, { color: isEnsina ? '#1565C0' : '#880E4F' }]}>
                  {m}
                </Text>
              </View>
            ))}
            {materias.length > 2 && (
              <Text style={styles.tagMais}>+{materias.length - 2}</Text>
            )}
          </View>

          {item.outro?.turma ? (
            <Text style={styles.solTurma}>{item.outro.turma}</Text>
          ) : null}

          <Text
            style={[styles.ultimaMsg, naoLida && styles.ultimaMsgNaoLida]}
            numberOfLines={1}
          >
            {labelMsg}
          </Text>
        </View>

        <View style={styles.matchBadgeWrap}>
          <View style={[styles.matchBadge, naoLida && styles.matchBadgeAtivo]}>
            <Ionicons
              name="chatbubble-outline"
              size={20}
              color={naoLida ? CORES.branco : CORES.rosa}
            />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // ══════════════════════════════════════════════════════════
  // RENDER PRINCIPAL
  // ══════════════════════════════════════════════════════════
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={CORES.branco} />

      {/* NAVBAR */}
      <View style={[styles.navbar, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={CORES.azulEscuro} />
        </TouchableOpacity>
        <View style={styles.logoWrap}>
          <View style={styles.dotAmarelo} />
          <Text style={styles.logo}>JUM<Text style={{ color: CORES.rosa }}>O</Text></Text>
        </View>
        <TouchableOpacity onPress={() => setPopupInfo(true)}>
          <Ionicons name="help-circle-outline" size={26} color={CORES.azulEscuro} />
        </TouchableOpacity>
      </View>

      {/* TABS */}
      <View style={styles.tabs}>
        {(['descobrir', 'solicitacoes', 'matches'] as Aba[]).map(aba => (
          <TouchableOpacity
            key={aba}
            style={[styles.tab, abaAtiva === aba && styles.tabAtiva]}
            onPress={() => setAbaAtiva(aba)}
          >
            <Ionicons
              name={aba === 'descobrir' ? 'search' : aba === 'solicitacoes' ? 'mail' : 'heart'}
              size={15}
              color={abaAtiva === aba ? CORES.branco : CORES.textoSecundario}
            />
            <Text style={[styles.tabTxt, abaAtiva === aba && styles.tabTxtAtiva]}>
              {aba === 'descobrir' ? 'Descobrir' : aba === 'solicitacoes' ? 'Solicitações' : 'Matches'}
            </Text>
            {aba === 'solicitacoes' && solicitacoes.length > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeTxt}>{solicitacoes.length}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* ABA DESCOBRIR */}
      {abaAtiva === 'descobrir' && (
        <View style={{ flex: 1 }}>
          <View style={styles.filtros}>
            {/* Modo aprender/ensinar */}
            <View style={styles.modoRow}>
              <TouchableOpacity
                style={[styles.modoBtn, modo === 'aprender' && styles.modoBtnAtivo]}
                onPress={() => setModo('aprender')}
              >
                <FontAwesome5
                  name="graduation-cap"
                  size={12}
                  color={modo === 'aprender' ? CORES.branco : CORES.azulEscuro}
                />
                <Text style={[styles.modoBtnTxt, modo === 'aprender' && { color: CORES.branco }]}>
                  Quero Aprender
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modoBtn, modo === 'ensinar' && styles.modoBtnAtivo]}
                onPress={() => setModo('ensinar')}
              >
                <MaterialIcons
                  name="cast-for-education"
                  size={14}
                  color={modo === 'ensinar' ? CORES.branco : CORES.azulEscuro}
                />
                <Text style={[styles.modoBtnTxt, modo === 'ensinar' && { color: CORES.branco }]}>
                  Quero Ensinar
                </Text>
              </TouchableOpacity>
            </View>

            {/* Selector de matérias — abre popup */}
            <TouchableOpacity
              style={styles.materiaSelector}
              onPress={() => setPopupMateria(true)}
            >
              {materiasFiltro.length === 0 ? (
                <Text style={styles.materiaSelectorTxt}>Filtrar por matéria</Text>
              ) : (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, flex: 1 }}>
                  {materiasFiltro.map(m => (
                    <View key={m} style={styles.tagMateriaFiltro}>
                      <Text style={styles.tagMateriaFiltroTxt}>{m}</Text>
                    </View>
                  ))}
                </View>
              )}
              <Ionicons name="chevron-down" size={16} color={CORES.textoSecundario} />
            </TouchableOpacity>
          </View>

          {renderCard()}
        </View>
      )}

      {/* ABA SOLICITAÇÕES */}
      {abaAtiva === 'solicitacoes' && (
        solicitacoes.length === 0
          ? <View style={styles.centro}>
              <Ionicons name="mail-open-outline" size={56} color={CORES.cinzaClaro} />
              <Text style={styles.txtVazio}>Nenhuma solicitação pendente.</Text>
            </View>
          : <FlatList
              data={solicitacoes}
              keyExtractor={i => i.id}
              renderItem={renderSolicitacao}
              contentContainerStyle={{ padding: 16 }}
            />
      )}

      {/* ABA MATCHES */}
      {abaAtiva === 'matches' && (
        matchesOrdenados.length === 0
          ? <View style={styles.centro}>
              <Ionicons name="heart-outline" size={56} color={CORES.cinzaClaro} />
              <Text style={styles.txtVazio}>Nenhum match ainda.</Text>
              <Text style={[styles.txtVazio, { fontSize: 13, marginTop: 4 }]}>
                Comece a descobrir monitores!
              </Text>
            </View>
          : <FlatList
              data={matchesOrdenados}
              keyExtractor={i => i.id}
              renderItem={renderMatch}
              contentContainerStyle={{ padding: 16 }}
            />
      )}

      {/* POPUP INFO */}
      <Modal visible={popupInfo} transparent animationType="fade">
        <View style={styles.overlayEscuro}>
          <View style={styles.popupBox}>
            <View style={styles.popupIcone}>
              <Ionicons name="heart" size={32} color={CORES.rosa} />
            </View>
            <Text style={styles.popupTitulo}>
              O que é o <Text style={{ fontStyle: 'italic', color: CORES.rosa }}>Match Acadêmico</Text>?
            </Text>
            <ScrollView style={{ maxHeight: height * 0.45 }} showsVerticalScrollIndicator={false}>
              {[
                { num: '01', titulo: 'Encontre seu monitor ideal',         desc: 'Conectamos alunos que querem aprender com quem pode ensinar — da mesma série ou superior.' },
                { num: '02', titulo: 'Você escolhe com quem quer estudar', desc: 'Nada é imposto. Você vê o perfil de cada pessoa e decide se quer se conectar.' },
                { num: '03', titulo: 'Match mútuo → Chat liberado',        desc: 'Só quando os dois aceitarem é que o chat é aberto. Seguro e respeitoso.' },
                { num: '04', titulo: 'Configure no seu Perfil',            desc: 'Vá em Perfil e configure quais matérias você pode ensinar e quais quer melhorar.' },
              ].map(item => (
                <View key={item.num} style={styles.popupItem}>
                  <View style={styles.popupNum}>
                    <Text style={styles.popupNumTxt}>{item.num}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.popupItemTitulo}>{item.titulo}</Text>
                    <Text style={styles.popupItemDesc}>{item.desc}</Text>
                  </View>
                </View>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.popupBtnPrimary} onPress={() => setPopupInfo(false)}>
              <Ionicons name="checkmark" size={18} color={CORES.branco} />
              <Text style={styles.popupBtnTxt}>Entendido, vamos lá!</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* POPUP MATÉRIA — multi-select com tags */}
      <Modal visible={popupMateria} transparent animationType="slide">
        <View style={styles.overlayEscuro}>
          <View style={styles.materiaBox}>
            <Text style={styles.materiaTitulo}>Filtrar por matéria</Text>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.materiaTagsGrid}>
                {MATERIAS.map(m => {
                  const selecionada = materiasFiltro.includes(m);
                  return (
                    <TouchableOpacity
                      key={m}
                      style={[
                        styles.materiaTagOpcao,
                        selecionada && styles.materiaTagOpcaoAtiva,
                      ]}
                      onPress={() => toggleMateria(m)}
                    >
                      {selecionada && (
                        <Ionicons name="checkmark" size={11} color={CORES.branco} style={{ marginRight: 3 }} />
                      )}
                      <Text style={[
                        styles.materiaTagOpcaoTxt,
                        selecionada && { color: CORES.branco },
                      ]}>
                        {m}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            <View style={styles.materiaBotoes}>
              <TouchableOpacity
                style={styles.btnLimpar}
                onPress={() => setMateriasFiltro([])}
              >
                <Text style={styles.btnLimparTxt}>Limpar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.btnAplicar}
                onPress={() => setPopupMateria(false)}
              >
                <Text style={styles.btnAplicarTxt}>
                  {materiasFiltro.length === 0
                    ? 'Ver todas'
                    : `Ver resultados (${materiasFiltro.length})`}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:          { flex: 1, backgroundColor: CORES.fundo },
  navbar:             { height: 64, backgroundColor: CORES.branco, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: CORES.cinzaClaro },
  logoWrap:           { position: 'relative', flexDirection: 'row', alignItems: 'center' },
  dotAmarelo:         { position: 'absolute', top: 2, left: -4, width: 7, height: 7, borderRadius: 4, backgroundColor: CORES.amarelo, zIndex: 1 },
  logo:               { fontSize: 24, fontWeight: '900', color: CORES.azulEscuro, letterSpacing: -1 },
  tabs:               { flexDirection: 'row', backgroundColor: CORES.branco, paddingHorizontal: 16, paddingBottom: 12, paddingTop: 8, gap: 8, borderBottomWidth: 1, borderBottomColor: CORES.cinzaClaro },
  tab:                { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: CORES.fundo },
  tabAtiva:           { backgroundColor: CORES.azulEscuro },
  tabTxt:             { fontSize: 12, fontWeight: '700', color: CORES.textoSecundario },
  tabTxtAtiva:        { color: CORES.branco },
  badge:              { backgroundColor: CORES.rosa, width: 18, height: 18, borderRadius: 9, justifyContent: 'center', alignItems: 'center', marginLeft: 2 },
  badgeTxt:           { color: CORES.branco, fontSize: 10, fontWeight: '900' },
  filtros:            { backgroundColor: CORES.branco, paddingHorizontal: 16, paddingVertical: 12, gap: 10, borderBottomWidth: 1, borderBottomColor: CORES.cinzaClaro },
  modoRow:            { flexDirection: 'row', gap: 8 },
  modoBtn:            { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, justifyContent: 'center', paddingVertical: 10, borderRadius: 14, backgroundColor: CORES.cinzaClaro },
  modoBtnAtivo:       { backgroundColor: CORES.azulEscuro },
  modoBtnTxt:         { fontSize: 13, fontWeight: '700', color: CORES.azulEscuro },
  materiaSelector:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: CORES.fundo, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, borderWidth: 1, borderColor: CORES.cinzaClaro, minHeight: 46 },
  materiaSelectorTxt: { fontSize: 14, fontWeight: '600', color: CORES.textoSecundario },

  // Tags no selector (resumo das selecionadas)
  tagMateriaFiltro:    { backgroundColor: CORES.azulEscuro, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  tagMateriaFiltroTxt: { color: CORES.branco, fontSize: 11, fontWeight: '700' },

  // Card descobrir
  cardWrap:         { flex: 1, alignItems: 'center', paddingTop: 20, paddingHorizontal: 20 },
  matchCard:        { width: '100%', height: height * 0.45, borderRadius: 28, overflow: 'hidden', elevation: 8, shadowColor: CORES.azulEscuro, shadowOpacity: 0.2, shadowRadius: 16, shadowOffset: { width: 0, height: 8 } },
  cardFoto:         { width: '100%', height: '100%' },
  cardOverlay:      { ...StyleSheet.absoluteFillObject as any, backgroundColor: 'rgba(11,32,70,0.45)' },
  cardInfo:         { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20 },
  cardNome:         { fontSize: 24, fontWeight: '900', color: CORES.branco, letterSpacing: -0.5 },
  cardTurma:        { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginBottom: 10 },
  materiasRow:      { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  materiaTag:       { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  materiaTagTxt:    { color: CORES.branco, fontSize: 11, fontWeight: '700' },
  arenaContador:    { marginTop: 12, fontSize: 12, color: CORES.textoSecundario, fontWeight: '600' },
  acoesRow:         { flexDirection: 'row', gap: 24, marginTop: 20 },
  btnRecusar:       { width: 64, height: 64, borderRadius: 32, backgroundColor: CORES.branco, justifyContent: 'center', alignItems: 'center', elevation: 4, shadowColor: '#FF5252', shadowOpacity: 0.2, shadowRadius: 8 },
  btnAceitar:       { width: 64, height: 64, borderRadius: 32, backgroundColor: CORES.rosa, justifyContent: 'center', alignItems: 'center', elevation: 4, shadowColor: CORES.rosa, shadowOpacity: 0.4, shadowRadius: 8 },
  btnRecarregar:    { marginTop: 16, backgroundColor: CORES.azulEscuro, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 16 },
  btnRecarregarTxt: { color: CORES.branco, fontWeight: '700' },
  centro:           { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
  txtVazio:         { color: CORES.textoSecundario, fontSize: 15, fontWeight: '600', textAlign: 'center' },

  // Cards de match / solicitação
  solCard:         { flexDirection: 'row', alignItems: 'center', backgroundColor: CORES.branco, padding: 14, borderRadius: 20, marginBottom: 10, elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4 },
  solCardNaoLido:  { backgroundColor: '#FFF5F8', borderLeftWidth: 3, borderLeftColor: CORES.rosa },
  solAvatar:       { width: 52, height: 52, borderRadius: 16, backgroundColor: CORES.cinzaClaro },
  solInfo:         { flex: 1, marginLeft: 12 },
  solNome:         { fontSize: 15, fontWeight: '700', color: CORES.azulEscuro },
  solNomeNaoLido:  { fontWeight: '900' },
  solTurma:        { fontSize: 11, color: CORES.textoSecundario, marginTop: 1 },
  solAcoes:        { flexDirection: 'row', gap: 8 },
  btnSolRecusar:   { width: 38, height: 38, borderRadius: 19, backgroundColor: '#FFF0F0', justifyContent: 'center', alignItems: 'center' },
  btnSolAceitar:   { width: 38, height: 38, borderRadius: 19, backgroundColor: CORES.verde, justifyContent: 'center', alignItems: 'center' },

  // Avatar com bolinha
  avatarWrap:   { position: 'relative' },
  bolinhaVerde: { position: 'absolute', top: 0, right: 0, width: 12, height: 12, borderRadius: 6, backgroundColor: CORES.verde, borderWidth: 2, borderColor: CORES.branco },

  // Tags inline no match
  nomeLinha:    { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4 },
  tagTipo:      { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 7 },
  tagTipoTxt:   { fontSize: 9, fontWeight: '800' },
  tagMateria:   { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 7 },
  tagMateriaTxt:{ fontSize: 10, fontWeight: '700' },
  tagMais:      { fontSize: 10, color: CORES.textoSecundario, fontWeight: '700' },

  // Última mensagem
  ultimaMsg:        { fontSize: 12, color: CORES.textoSecundario, marginTop: 4 },
  ultimaMsgNaoLida: { color: CORES.azulEscuro, fontWeight: '700' },

  // Badge chat
  matchBadgeWrap: { marginLeft: 8 },
  matchBadge:     { width: 38, height: 38, borderRadius: 19, backgroundColor: '#FFE4EC', justifyContent: 'center', alignItems: 'center' },
  matchBadgeAtivo:{ backgroundColor: CORES.rosa },

  // Overlays / popups
  overlayEscuro: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  popupBox:      { backgroundColor: CORES.branco, borderRadius: 28, padding: 28, width: '100%', maxWidth: 400 },
  popupIcone:    { width: 64, height: 64, borderRadius: 32, backgroundColor: '#FFE4EC', justifyContent: 'center', alignItems: 'center', alignSelf: 'center', marginBottom: 16 },
  popupTitulo:   { fontSize: 22, fontWeight: '900', color: CORES.azulEscuro, textAlign: 'center', marginBottom: 20, letterSpacing: -0.5 },
  popupItem:     { flexDirection: 'row', gap: 14, marginBottom: 18 },
  popupNum:      { width: 32, height: 32, borderRadius: 16, backgroundColor: CORES.azulEscuro, justifyContent: 'center', alignItems: 'center' },
  popupNumTxt:   { color: CORES.branco, fontSize: 11, fontWeight: '900' },
  popupItemTitulo:{ fontSize: 14, fontWeight: '800', color: CORES.azulEscuro, marginBottom: 4 },
  popupItemDesc: { fontSize: 13, color: CORES.textoSecundario, lineHeight: 18 },
  popupBtnPrimary:{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: CORES.rosa, paddingVertical: 14, borderRadius: 18, marginTop: 8 },
  popupBtnTxt:   { color: CORES.branco, fontWeight: '800', fontSize: 15 },

  // Popup matéria — novo visual multi-select
  materiaBox:         { backgroundColor: CORES.branco, borderRadius: 28, padding: 24, width: '100%', maxWidth: 400, maxHeight: height * 0.7 },
  materiaTitulo:      { fontSize: 18, fontWeight: '900', color: CORES.azulEscuro, marginBottom: 16, textAlign: 'center' },
  materiaTagsGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingBottom: 8 },
  materiaTagOpcao:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, backgroundColor: CORES.cinzaClaro },
  materiaTagOpcaoAtiva:{ backgroundColor: CORES.azulEscuro },
  materiaTagOpcaoTxt: { fontSize: 13, fontWeight: '700', color: CORES.azulEscuro },
  materiaBotoes:      { flexDirection: 'row', gap: 10, marginTop: 16 },
  btnLimpar:          { flex: 1, alignItems: 'center', paddingVertical: 13, borderRadius: 16, borderWidth: 1.5, borderColor: CORES.cinzaClaro },
  btnLimparTxt:       { fontWeight: '700', color: CORES.textoSecundario, fontSize: 14 },
  btnAplicar:         { flex: 2, alignItems: 'center', paddingVertical: 13, borderRadius: 16, backgroundColor: CORES.rosa },
  btnAplicarTxt:      { fontWeight: '800', color: CORES.branco, fontSize: 14 },
});