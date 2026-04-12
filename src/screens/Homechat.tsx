// ============================================================
// Homechat.tsx
// ============================================================
import React, { useState, useEffect } from 'react';
import {
  StyleSheet, Text, View, FlatList, TouchableOpacity,
  Image, SafeAreaView, TextInput, StatusBar, Platform,
  ActivityIndicator, KeyboardAvoidingView
} from 'react-native';
import { db } from '../config/firebaseConfig';
import {
  collection, query, where, onSnapshot, orderBy,
  getDocs, doc, getDoc, setDoc
} from 'firebase/firestore';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const CORES = {
  azulEscuro: '#0B2046',
  rosa: '#E51C6A',
  amarelo: '#FFC82C',
  fundo: '#F8FAFC',
  branco: '#FFFFFF',
  cinzaClaro: '#E2E8F0',
  textoSecundario: '#64748B',
};

export default function Homechat({ navigation, route }: any) {
  const [aba, setAba] = useState<'conversas' | 'buscar'>('conversas');
  const [conversas, setConversas] = useState<any[]>([]);
  const [busca, setBusca] = useState('');
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [carregandoBusca, setCarregandoBusca] = useState(false);
  const [meusDados, setMeusDados] = useState<any>(null);

  // ✅ uid vem do Index via route.params
  const meuUid = route?.params?.uid;

  // Carrega dados do próprio usuário
  useEffect(() => {
    const carregar = async () => {
      if (!meuUid) return;
      const snap = await getDoc(doc(db, 'usuarios', meuUid));
      if (snap.exists()) setMeusDados({ ...snap.data(), uid: meuUid });
    };
    carregar();
  }, [meuUid]);

  // Escuta conversas em tempo real
  useEffect(() => {
    if (!meuUid) { setCarregando(false); return; }

    const q = query(
      collection(db, 'conversas'),
      where('membros', 'array-contains', meuUid),
      orderBy('data_postagem', 'desc')
    );

    const unsub = onSnapshot(q, (snapshot) => {
      setConversas(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      setCarregando(false);
    }, (err) => {
      console.error('Erro conversas:', err);
      setCarregando(false);
    });

    return () => unsub();
  }, [meuUid]);

  // Busca usuários pelo nome
  useEffect(() => {
    if (aba !== 'buscar') return;
    if (busca.length < 2) { setUsuarios([]); return; }

    const timer = setTimeout(async () => {
      setCarregandoBusca(true);
      try {
        const snap = await getDocs(collection(db, 'usuarios'));
        const lista = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter((u: any) =>
            u.id !== meuUid &&
            u.nome_completo?.toLowerCase().includes(busca.toLowerCase())
          );
        setUsuarios(lista);
      } catch (e) { console.log(e); }
      finally { setCarregandoBusca(false); }
    }, 400);

    return () => clearTimeout(timer);
  }, [busca, aba]);

  const abrirConversa = async (outroUsuario: any) => {
    if (!meuUid || !meusDados) return;

    // ✅ Gera ID da sala igual ao Chat.tsx: menor uid primeiro
    const salaId = [meuUid, outroUsuario.id].sort().join('_');

    // Garante que o documento da conversa existe
    await setDoc(doc(db, 'conversas', salaId), {
      membros: [meuUid, outroUsuario.id],
      dadosMembros: {
        [meuUid]: { nome: meusDados.nome_completo, foto: meusDados.foto || null },
        [outroUsuario.id]: { nome: outroUsuario.nome_completo, foto: outroUsuario.foto || null }
      },
    }, { merge: true });

    navigation.navigate('Chat', {
      room: salaId,
      meuUid,
      meuNome: meusDados.nome_completo,
      minhaFoto: meusDados.foto || null,
      outroUid: outroUsuario.id,
      outroNome: outroUsuario.nome_completo,
      outraFoto: outroUsuario.foto || null,
    });
  };

  const formatarTempo = (timestamp: any) => {
    if (!timestamp) return '';
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return formatDistanceToNow(date, { addSuffix: true, locale: ptBR })
        .replace('atrás', '').replace('cerca de', '').trim();
    } catch { return ''; }
  };

  const renderConversa = ({ item }: any) => {
    const outroUid = item.membros?.find((id: string) => id !== meuUid);
    const outro = item.dadosMembros?.[outroUid] || {};
    const naoLida = item.visto === false && item.quemEnviou !== meuUid;

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.75}
        onPress={() => navigation.navigate('Chat', {
          room: item.id,
          meuUid,
          meuNome: meusDados?.nome_completo,
          minhaFoto: meusDados?.foto || null,
          outroUid,
          outroNome: outro?.nome,
          outraFoto: outro?.foto || null,
        })}
      >
        <View style={styles.avatarWrap}>
          {outro?.foto
            ? <Image source={{ uri: outro.foto }} style={styles.avatar} />
            : <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarLetra}>{outro?.nome?.charAt(0) || '?'}</Text>
              </View>
          }
          <View style={styles.dotOnline} />
        </View>

        <View style={styles.cardBody}>
          <View style={styles.cardTop}>
            <Text style={[styles.cardNome, naoLida && { color: CORES.rosa }]} numberOfLines={1}>
              {outro?.nome || 'Usuário'}
            </Text>
            <Text style={styles.cardTempo}>{formatarTempo(item.data_postagem)}</Text>
          </View>
          <View style={styles.cardBottom}>
            <Text style={[styles.cardMsg, naoLida && { fontWeight: '700', color: CORES.azulEscuro }]} numberOfLines={1}>
              {item.quemEnviou === meuUid ? 'Você: ' : ''}
              {item.ultimaMensagem || 'Inicie uma conversa...'}
            </Text>
            {naoLida && <View style={styles.badgeNaoLida} />}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderUsuario = ({ item }: any) => (
    <TouchableOpacity style={styles.card} activeOpacity={0.75} onPress={() => abrirConversa(item)}>
      <View style={styles.avatarWrap}>
        {item.foto
          ? <Image source={{ uri: item.foto }} style={styles.avatar} />
          : <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarLetra}>{item.nome_completo?.charAt(0) || '?'}</Text>
            </View>
        }
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.cardNome}>{item.nome_completo}</Text>
        <Text style={styles.cardMsg}>{item.turma || item.ra || ''}</Text>
      </View>
      <Ionicons name="chatbubble-outline" size={20} color={CORES.rosa} />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={CORES.branco} />

      {/* NAVBAR */}
      <View style={styles.navbar}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={CORES.azulEscuro} />
        </TouchableOpacity>
        <View style={styles.logoWrap}>
          <View style={styles.dotAmarelo} />
          <Text style={styles.logo}>JUM<Text style={{ color: CORES.rosa }}>O</Text></Text>
        </View>
        <TouchableOpacity onPress={() => { setAba('buscar'); }}>
          <Ionicons name="create-outline" size={24} color={CORES.azulEscuro} />
        </TouchableOpacity>
      </View>

      {/* ABAS */}
      <View style={styles.abas}>
        <TouchableOpacity
          style={[styles.aba, aba === 'conversas' && styles.abaAtiva]}
          onPress={() => setAba('conversas')}
        >
          <Text style={[styles.abaText, aba === 'conversas' && styles.abaTextAtiva]}>Conversas</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.aba, aba === 'buscar' && styles.abaAtiva]}
          onPress={() => setAba('buscar')}
        >
          <Text style={[styles.abaText, aba === 'buscar' && styles.abaTextAtiva]}>Buscar Aluno</Text>
        </TouchableOpacity>
      </View>

      {/* SEARCH BAR — aparece sempre */}
      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color={CORES.textoSecundario} />
        <TextInput
          style={styles.searchInput}
          placeholder={aba === 'conversas' ? 'Pesquisar conversas...' : 'Digite o nome do aluno...'}
          placeholderTextColor={CORES.textoSecundario}
          value={busca}
          onChangeText={setBusca}
          onFocus={() => setAba('buscar')}
        />
        {busca.length > 0 && (
          <TouchableOpacity onPress={() => { setBusca(''); setAba('conversas'); }}>
            <Ionicons name="close-circle" size={18} color={CORES.textoSecundario} />
          </TouchableOpacity>
        )}
      </View>

      {/* CONTEÚDO */}
      {aba === 'conversas' ? (
        carregando ? (
          <View style={styles.centro}><ActivityIndicator size="large" color={CORES.rosa} /></View>
        ) : (
          <FlatList
            data={conversas.filter(c => {
              const outroUid = c.membros?.find((id: string) => id !== meuUid);
              return c.dadosMembros?.[outroUid]?.nome?.toLowerCase().includes(busca.toLowerCase());
            })}
            keyExtractor={item => item.id}
            renderItem={renderConversa}
            contentContainerStyle={styles.lista}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.centro}>
                <MaterialCommunityIcons name="message-text-outline" size={56} color={CORES.cinzaClaro} />
                <Text style={styles.txtVazio}>Nenhuma conversa ainda</Text>
                <Text style={[styles.txtVazio, { fontSize: 13, marginTop: 4 }]}>
                  Toque em ✏️ para iniciar uma
                </Text>
              </View>
            }
          />
        )
      ) : (
        carregandoBusca ? (
          <View style={styles.centro}><ActivityIndicator size="large" color={CORES.rosa} /></View>
        ) : (
          <FlatList
            data={usuarios}
            keyExtractor={item => item.id}
            renderItem={renderUsuario}
            contentContainerStyle={styles.lista}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.centro}>
                <Ionicons name="search" size={56} color={CORES.cinzaClaro} />
                <Text style={styles.txtVazio}>
                  {busca.length < 2 ? 'Digite pelo menos 2 letras' : 'Nenhum aluno encontrado'}
                </Text>
              </View>
            }
          />
        )
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: CORES.fundo },
  centro: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60, gap: 8 },
  navbar: { height: 64, backgroundColor: CORES.branco, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: CORES.cinzaClaro },
  logoWrap: { position: 'relative', flexDirection: 'row', alignItems: 'center' },
  dotAmarelo: { position: 'absolute', top: 2, left: -4, width: 7, height: 7, borderRadius: 4, backgroundColor: CORES.amarelo, zIndex: 1 },
  logo: { fontSize: 24, fontWeight: '900', color: CORES.azulEscuro, letterSpacing: -1 },
  abas: { flexDirection: 'row', backgroundColor: CORES.branco, paddingHorizontal: 20, paddingBottom: 12, gap: 8 },
  aba: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: CORES.fundo },
  abaAtiva: { backgroundColor: CORES.azulEscuro },
  abaText: { fontSize: 13, fontWeight: '700', color: CORES.textoSecundario },
  abaTextAtiva: { color: CORES.branco },
  searchWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: CORES.branco, marginHorizontal: 16, marginVertical: 12, paddingHorizontal: 14, height: 48, borderRadius: 16, borderWidth: 1, borderColor: CORES.cinzaClaro, gap: 8 },
  searchInput: { flex: 1, fontSize: 14, fontWeight: '600', color: CORES.azulEscuro },
  lista: { paddingHorizontal: 16, paddingBottom: 40 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: CORES.branco, padding: 12, borderRadius: 20, marginBottom: 10, elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4 },
  avatarWrap: { position: 'relative', marginRight: 12 },
  avatar: { width: 58, height: 58, borderRadius: 20 },
  avatarPlaceholder: { width: 58, height: 58, borderRadius: 20, backgroundColor: CORES.azulEscuro, justifyContent: 'center', alignItems: 'center' },
  avatarLetra: { color: '#FFF', fontSize: 22, fontWeight: '900' },
  dotOnline: { position: 'absolute', bottom: 2, right: 2, width: 13, height: 13, backgroundColor: '#22C55E', borderRadius: 7, borderWidth: 2, borderColor: CORES.branco },
  cardBody: { flex: 1 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  cardNome: { fontSize: 16, fontWeight: '800', color: CORES.azulEscuro, flex: 1, marginRight: 8 },
  cardTempo: { fontSize: 11, color: CORES.textoSecundario, fontWeight: '600' },
  cardBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardMsg: { fontSize: 13, color: CORES.textoSecundario, flex: 1, marginRight: 8 },
  badgeNaoLida: { width: 10, height: 10, backgroundColor: CORES.rosa, borderRadius: 5 },
  txtVazio: { color: CORES.textoSecundario, fontSize: 15, fontWeight: '600', textAlign: 'center' },
});