import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, Text, View, FlatList, TouchableOpacity, 
  Image, SafeAreaView, TextInput, StatusBar, Platform, ActivityIndicator 
} from 'react-native';
import { auth, db } from '../config/firebaseConfig';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
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

export default function ListaChat({ navigation }: any) {
  const [conversas, setConversas] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");

  const meuUid = auth.currentUser?.uid;

  // =========================================================
  // LOGICA DE BUSCA DAS CONVERSAS E ÚLTIMAS MENSAGENS
  // =========================================================
  useEffect(() => {
    if (!meuUid) {
      setCarregando(false);
      return;
    }

    try {
      // 1. Criamos a query para buscar na coleção 'chats'
      // Buscamos onde o array 'membros' contém o meu ID de usuário
      const q = query(
        collection(db, "chats"), 
        where("membros", "array-contains", meuUid),
        orderBy("data_postagem", "desc") // Ordena pela mensagem mais recente
      );

      // 2. Escutamos o banco de dados em tempo real
      const unsub = onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        // 3. Atualizamos o estado com a lista de conversas encontradas
        setConversas(data);
        setCarregando(false);
      }, (error) => {
        // Se der erro aqui (como falta de índice), a tela não fica branca, apenas loga o erro
        console.error("Erro ao buscar conversas:", error);
        setCarregando(false);
      });

      return () => unsub();
    } catch (e) {
      console.log("Erro no useEffect:", e);
      setCarregando(false);
    }
  }, [meuUid]);

  const formatarVisto = (timestamp: any) => {
    if (!timestamp) return "agora pouco";
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return formatDistanceToNow(date, { addSuffix: true, locale: ptBR })
        .replace('atrás', '').replace('cerca de', '').trim();
    } catch { return "agora"; }
  };

  const renderItem = ({ item }: any) => {
    // =========================================================
    // LÓGICA PARA IDENTIFICAR A OUTRA PESSOA E A ÚLTIMA MSG
    // =========================================================
    
    // Pegamos o ID da outra pessoa no array de membros
    const outroUid = item.membros?.find((id: string) => id !== meuUid);
    
    // Buscamos os dados (nome/foto) dessa pessoa dentro do objeto 'dadosMembros'
    // que você tem salvo no documento do chat (conforme seu print do Firebase)
    const dadosOutro = item.dadosMembros?.[outroUid] || {};

    return (
      <TouchableOpacity 
        activeOpacity={0.7}
        style={styles.card} 
        // AO CLICAR: Direciona para a tela de Chat passando os parâmetros necessários
        onPress={() => navigation.navigate('Chat', { 
          room: item.id, 
          outroUid: outroUid,
          outroNome: dadosOutro?.nome 
        })}
      >
        <View style={styles.avatarContainer}>
          {dadosOutro?.foto ? (
            <Image source={{ uri: dadosOutro.foto }} style={styles.foto} />
          ) : (
            <View style={[styles.foto, styles.avatarPlaceholder]}>
              <Text style={styles.letraAvatar}>{dadosOutro?.nome?.charAt(0) || "?"}</Text>
            </View>
          )}
          <View style={styles.dotOnline} />
        </View>
        
        <View style={styles.conteudo}>
          <View style={styles.linhaTopo}>
            <Text style={styles.nome} numberOfLines={1}>
              {dadosOutro?.nome || "Usuário JUMO"}
            </Text>
            <Text style={styles.tempo}>{formatarVisto(item.data_postagem)}</Text>
          </View>
          
          <View style={styles.linhaMensagem}>
            {/* Exibe a última mensagem e se foi você quem enviou */}
            <Text style={styles.msg} numberOfLines={1}>
              {item.quemEnviou === meuUid ? 'Você: ' : ''}
              {item.ultimaMensagem || "Inicie uma conversa..."}
            </Text>
            
            {/* Badge de notificação se a mensagem não foi vista */}
            {item.visto === false && item.quemEnviou !== meuUid && (
              <View style={styles.badgeNotif} />
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFF" />

      {/* NAVBAR */}
      <View style={styles.navbar}>
        <TouchableOpacity 
          style={styles.btnMenu} 
          onPress={() => {
            // Tenta abrir a sidebar, se não existir o navigator, avisa no console
            if (navigation.openDrawer) {
              navigation.openDrawer();
            } else {
              console.warn("Drawer Navigator não configurado no App.js");
            }
          }}
        >
          <View style={[styles.barraMenu, { width: 22 }]} />
          <View style={[styles.barraMenu, { width: 16, backgroundColor: CORES.rosa }]} />
          <View style={[styles.barraMenu, { width: 20 }]} />
        </TouchableOpacity>

        <View style={styles.logoContainer}>
          <View style={styles.pontoAmarelo} />
          <Text style={styles.logoJum}>JUM<Text style={{color: CORES.rosa}}>O</Text></Text>
        </View>
        
        <TouchableOpacity style={styles.btnAcao}>
          <Ionicons name="create-outline" size={24} color={CORES.azulEscuro} />
        </TouchableOpacity>
      </View>

      {/* BARRA DE PESQUISA */}
      <View style={styles.searchSection}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color={CORES.textoSecundario} />
          <TextInput 
            placeholder="Pesquisar conversas..." 
            placeholderTextColor={CORES.textoSecundario}
            style={styles.searchInput}
            value={busca}
            onChangeText={setBusca}
          />
        </View>
      </View>

      {carregando ? (
        <View style={styles.centro}><ActivityIndicator size="large" color={CORES.rosa} /></View>
      ) : (
        <FlatList
          data={conversas.filter(c => {
             const outroUid = c.membros?.find((id: string) => id !== meuUid);
             return c.dadosMembros?.[outroUid]?.nome?.toLowerCase().includes(busca.toLowerCase());
          })}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.centro}>
              <MaterialCommunityIcons name="message-text-outline" size={60} color={CORES.cinzaClaro} />
              <Text style={styles.txtVazio}>Nenhuma conversa encontrada</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: CORES.fundo },
  centro: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 50 },
  navbar: {
    height: 65, backgroundColor: '#FFF', flexDirection: 'row',
    alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20,
    borderBottomWidth: 1, borderBottomColor: CORES.cinzaClaro
  },
  btnMenu: { padding: 5 },
  barraMenu: { height: 3, backgroundColor: CORES.azulEscuro, borderRadius: 10, marginVertical: 2 },
  logoContainer: { flexDirection: 'row', alignItems: 'center' },
  pontoAmarelo: { width: 7, height: 7, backgroundColor: CORES.amarelo, borderRadius: 4, marginRight: 2, marginBottom: 12 },
  logoJum: { fontSize: 26, fontWeight: '900', color: CORES.azulEscuro, letterSpacing: -1 },
  btnAcao: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#F0F4F8', justifyContent: 'center', alignItems: 'center' },
  searchSection: { paddingHorizontal: 20, paddingVertical: 15 },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF',
    height: 50, borderRadius: 18, paddingHorizontal: 15,
    borderWidth: 1, borderColor: CORES.cinzaClaro,
    elevation: 2, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 5
  },
  searchInput: { flex: 1, marginLeft: 10, fontWeight: '600', color: CORES.azulEscuro },
  listContent: { paddingHorizontal: 20, paddingBottom: 100 },
  card: {
    flexDirection: 'row', backgroundColor: '#FFF', padding: 12,
    borderRadius: 24, marginBottom: 12, alignItems: 'center',
  },
  avatarContainer: { position: 'relative' },
  foto: { width: 62, height: 62, borderRadius: 24, backgroundColor: CORES.cinzaClaro },
  avatarPlaceholder: { justifyContent: 'center', alignItems: 'center', backgroundColor: CORES.azulEscuro },
  letraAvatar: { color: '#FFF', fontSize: 22, fontWeight: 'bold' },
  dotOnline: { position: 'absolute', bottom: 2, right: 2, width: 14, height: 14, backgroundColor: '#22C55E', borderRadius: 7, borderWidth: 3, borderColor: '#FFF' },
  conteudo: { flex: 1, marginLeft: 15 },
  linhaTopo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  nome: { fontSize: 17, fontWeight: '800', color: CORES.azulEscuro },
  tempo: { fontSize: 11, color: CORES.textoSecundario, fontWeight: '600' },
  linhaMensagem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 3 },
  msg: { fontSize: 14, color: CORES.textoSecundario, flex: 1, marginRight: 10 },
  badgeNotif: { width: 10, height: 10, backgroundColor: CORES.rosa, borderRadius: 5 },
  txtVazio: { color: CORES.textoSecundario, marginTop: 15, fontWeight: '600' }
});