import React, { useState, useEffect, useRef } from 'react';
import { 
  StyleSheet, Text, View, ScrollView, TouchableOpacity, 
  Image, SafeAreaView, StatusBar, Dimensions, 
  Modal, TouchableWithoutFeedback, Platform, Animated
} from 'react-native';
import { db } from '../config/firebaseConfig';
import { doc, getDoc, collection, onSnapshot, query, orderBy, updateDoc, increment, arrayUnion } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialIcons, Ionicons, FontAwesome5 } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

const CORES = {
  azulEscuro: '#0B2046',
  rosa: '#E51C6A',
  amarelo: '#FFC82C',
  fundo: '#F5F7FA',
  cinzaClaro: '#EAEFF4',
  textoSecundario: '#8D99AE',
  branco: '#FFFFFF'
};

const CATEGORIAS = [
  { titulo: "Avisos",        cat: "avisos",       icon: "campaign"     },
  { titulo: "Destaques",     cat: "destaque",     icon: "star"         },
  { titulo: "Oportunidades", cat: "oportunidades",icon: "work"         },
  { titulo: "Olimpíadas",    cat: "olimpiadas",   icon: "emoji-events" },
  { titulo: "Passeios",      cat: "passeios",     icon: "explore"      },
];

export default function Index({ navigation, route }: any) {
  const [userData, setUserData]             = useState<any>(null);
  const [posts, setPosts]                   = useState<any[]>([]);
  const [modalVisible, setModalVisible]     = useState(false);
  const [selectedPost, setSelectedPost]     = useState<any>(null);
  const [modoEdicao, setModoEdicao]         = useState(false);
  const [miniMenuAberto, setMiniMenuAberto] = useState(false);
  const [categoriaAtiva, setCategoriaAtiva] = useState('avisos');

  const scrollY = useRef(new Animated.Value(0)).current;

  const userEmail           = userData?.email_escolar || '';
  // ✅ isSuperAdmin: aceita email @anchieta.br OU tipo "administrador" (case-insensitive)
  const isSuperAdmin        = userEmail.endsWith('@anchieta.br') || userData?.tipo?.toLowerCase() === 'administrador';
  const isGremio            = userData?.tipo === 'Gremista';
  const temPermissaoDeStaff = isSuperAdmin || isGremio;

  useEffect(() => {
    const carregarPerfil = async () => {
      const uid = route?.params?.uid;
      if (!uid) return;
      try {
        const docSnap = await getDoc(doc(db, 'usuarios', uid));
        if (docSnap.exists()) setUserData({ ...docSnap.data(), uid });
      } catch (error) { console.error(error); }
    };

    const q = query(collection(db, 'posts'), orderBy('data_publicacao', 'desc'));
    const unsubPosts = onSnapshot(q, (snapshot) => {
      setPosts(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    carregarPerfil();
    return () => unsubPosts();
  }, []);

  const visualizarPost = async (post: any) => {
    setSelectedPost(post);
    setModalVisible(true);
    try {
      const uid   = userData?.uid;
      const jaLeu = post.leitores?.includes(uid);
      if (!jaLeu && uid) {
        await updateDoc(doc(db, 'posts', post.id), {
          visualizacoes: increment(1),
          leitores: arrayUnion(uid),
        });
      }
    } catch (e) {}
  };

  const handleSair = async () => {
    await AsyncStorage.removeItem('uid');
    setMiniMenuAberto(false);
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
  };

  const postsDaCategoria = posts.filter(p => p.categoria === categoriaAtiva);
  const secaoAtiva       = CATEGORIAS.find(c => c.cat === categoriaAtiva);
  const podeEditar       = modoEdicao && isSuperAdmin;

  const renderCard = (post: any) => (
    <TouchableOpacity
      key={post.id}
      style={styles.card}
      onPress={() => podeEditar
        ? navigation.navigate('EditorPost', { postId: post.id, categoria: post.categoria, current: post })
        : visualizarPost(post)
      }
      activeOpacity={0.85}
    >
      {post.capa
        ? <Image source={{ uri: post.capa }} style={styles.cardImg} />
        : <View style={styles.cardImgPlaceholder}>
            <MaterialIcons name="image" size={32} color={CORES.textoSecundario} />
          </View>
      }
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle} numberOfLines={2}>{post.titulo}</Text>
        {post.subtitulo
          ? <Text style={styles.cardSub} numberOfLines={1}>{post.subtitulo}</Text>
          : null
        }
        <View style={styles.cardMeta}>
          <Ionicons name="eye" size={12} color={CORES.rosa} />
          <Text style={styles.cardViews}>{post.visualizacoes || 0}</Text>
          {post.leitores?.includes(userData?.uid) && (
            <View style={styles.lidoBadge}>
              <Ionicons name="checkmark-circle" size={12} color="#10B981" />
              <Text style={styles.lidoText}>Lido</Text>
            </View>
          )}
        </View>
      </View>
      {podeEditar && (
        <View style={styles.editBadge}>
          <MaterialIcons name="edit" size={13} color="#FFF" />
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={CORES.branco} />

      {/* NAVBAR */}
      <View style={styles.navbar}>
        <View style={styles.logoWrap}>
          <View style={styles.dotAmarelo} />
          <Text style={styles.logoText}>JUM<Text style={{ color: CORES.rosa }}>O</Text></Text>
        </View>
        <View style={styles.navRight}>
          {temPermissaoDeStaff && (
            <TouchableOpacity
              onPress={() => setModoEdicao(!modoEdicao)}
              style={[styles.btnEdit, modoEdicao && { backgroundColor: CORES.rosa, borderColor: CORES.rosa }]}
            >
              <FontAwesome5 name="pen" size={11} color={modoEdicao ? '#FFF' : CORES.azulEscuro} />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.avatarBtn}
            onPress={() => navigation.navigate('Perfil', { uid: userData?.uid })}
          >
            {userData?.foto
              ? <Image source={{ uri: userData.foto }} style={styles.avatarImg} />
              : <View style={styles.avatarPlaceholder}>
                  <MaterialIcons name="person" size={20} color={CORES.azulEscuro} />
                </View>
            }
          </TouchableOpacity>
        </View>
      </View>

      {/* SCROLL PRINCIPAL */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
      >
        {/* HERO */}
        <View style={styles.heroWrap}>
          {modoEdicao && (
            <View style={styles.alertEdicao}>
              <Ionicons name="alert-circle" size={15} color="#FFF" />
              <Text style={styles.txtEdicao}>MODO EDITOR ATIVADO</Text>
            </View>
          )}
          <View style={styles.heroCard}>
            <View style={styles.heroLeft}>
              <View style={styles.heroBadge}>
                <Text style={styles.heroBadgeText}>Novidades</Text>
              </View>
              <Text style={styles.heroTitle}>UM SÓ{"\n"}ANCHIETA</Text>
              <View style={styles.heroCta}>
                <Text style={styles.heroCtaText}>VER MAIS</Text>
                <Ionicons name="arrow-forward" size={14} color={CORES.branco} />
              </View>
            </View>
            <Image
              source={{ uri: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?q=80&w=400' }}
              style={styles.heroImg}
            />
          </View>
        </View>

        {/* PILLS DE CATEGORIA */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.pillsRow}
        >
          {CATEGORIAS.map(cat => (
            <TouchableOpacity
              key={cat.cat}
              style={[styles.pill, categoriaAtiva === cat.cat && styles.pillAtiva]}
              onPress={() => setCategoriaAtiva(cat.cat)}
            >
              <MaterialIcons
                name={cat.icon as any}
                size={15}
                color={categoriaAtiva === cat.cat ? CORES.branco : CORES.textoSecundario}
              />
              <Text style={[styles.pillText, categoriaAtiva === cat.cat && styles.pillTextAtiva]}>
                {cat.titulo}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* HEADER DA SEÇÃO */}
        <View style={styles.secaoHeader}>
          <Text style={styles.secaoTitulo}>{secaoAtiva?.titulo}</Text>
          {podeEditar && (
            <TouchableOpacity
              style={styles.btnAdd}
              onPress={() => navigation.navigate('EditorPost', { categoria: categoriaAtiva })}
            >
              <MaterialIcons name="add" size={18} color="#FFF" />
              <Text style={styles.btnAddText}>Novo post</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* CARDS */}
        {postsDaCategoria.length > 0
          ? postsDaCategoria.map(post => renderCard(post))
          : (
            <View style={styles.emptyState}>
              <MaterialIcons name="inbox" size={40} color={CORES.cinzaClaro} />
              <Text style={styles.emptyText}>Nenhum post ainda.</Text>
            </View>
          )
        }

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* TAB BAR — com Chat (do doc3) e Match central (do doc2) */}
      <View style={styles.tabBar}>
        <TabItem icon="home"                  label="Início"  ativo onPress={() => {}} />
        <TabItem icon="calendar-outline"      label="Agenda"        onPress={() => navigation.navigate('Calendario', { uid: userData?.uid, tipo: userData?.tipo, turma: userData?.turma })} />
        <View style={styles.centerTab}>
          <TouchableOpacity style={styles.centerBtn} onPress={() => navigation.navigate('Match')}>
            <Ionicons name="heart" size={22} color={CORES.rosa} />
          </TouchableOpacity>
        </View>
        <TabItem icon="chatbubbles-outline"   label="Chat"          onPress={() => navigation.navigate('Hall', { uid: userData?.uid })} />
        <TabItem icon="search-outline"        label="Achados"       onPress={() => navigation.navigate('AchadosPerdidos', { uid: userData?.uid, tipo: userData?.tipo })} />
        <TabItem icon="ellipsis-horizontal"   label="Mais"          onPress={() => setMiniMenuAberto(true)} />
      </View>

      {/* MINI MENU — com Painel Admin (do doc2) condicional por tipo */}
      <Modal visible={miniMenuAberto} transparent animationType="fade">
        <TouchableWithoutFeedback onPress={() => setMiniMenuAberto(false)}>
          <View style={styles.menuOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.menuPopup}>
                <TouchableOpacity style={styles.menuItem} onPress={() => { setMiniMenuAberto(false); navigation.navigate('Contatos'); }}>
                  <Ionicons name="call" size={17} color={CORES.azulEscuro} />
                  <Text style={styles.menuItemText}>Contatos</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.menuItem} onPress={() => { setMiniMenuAberto(false); navigation.navigate('Ajuda'); }}>
                  <Ionicons name="help-circle" size={17} color={CORES.azulEscuro} />
                  <Text style={styles.menuItemText}>Ajuda</Text>
                </TouchableOpacity>

                {/* ✅ Painel Admin — só aparece para administradores (do doc2) */}
                {userData?.tipo?.toLowerCase() === 'administrador' && (
                  <>
                    <View style={styles.menuDivider} />
                    <TouchableOpacity style={styles.menuItem} onPress={() => { setMiniMenuAberto(false); navigation.navigate('Admin', { uid: userData?.uid }); }}>
                      <Ionicons name="shield-checkmark" size={17} color={CORES.azulEscuro} />
                      <Text style={styles.menuItemText}>Painel Admin</Text>
                    </TouchableOpacity>
                  </>
                )}

                <View style={styles.menuDivider} />
                <TouchableOpacity style={styles.menuItem} onPress={handleSair}>
                  <Ionicons name="log-out" size={17} color="#FF5252" />
                  <Text style={[styles.menuItemText, { color: '#FF5252' }]}>Sair</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* MODAL POST */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalWrap}>
          <View style={styles.modalCover}>
            {selectedPost?.capa
              ? <Image source={{ uri: selectedPost.capa }} style={StyleSheet.absoluteFillObject} />
              : <View style={[StyleSheet.absoluteFillObject, { backgroundColor: CORES.azulEscuro, justifyContent: 'center', alignItems: 'center' }]}>
                  <Text style={styles.logoMini}>JU<Text style={{ color: CORES.rosa }}>MO</Text></Text>
                </View>
            }
            <View style={styles.modalCoverOverlay} />
            <TouchableOpacity style={styles.btnFechar} onPress={() => setModalVisible(false)}>
              <Ionicons name="chevron-down" size={26} color="#FFF" />
            </TouchableOpacity>
          </View>

          <View style={styles.modalBody}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 28, paddingBottom: 60 }}>
              {selectedPost?.tags?.length > 0 && (
                <View style={styles.tagsRow}>
                  {selectedPost.tags.map((tag: string, i: number) => (
                    <View key={i} style={styles.tag}><Text style={styles.tagText}>{tag}</Text></View>
                  ))}
                </View>
              )}
              <Text style={styles.modalTitulo}>{selectedPost?.titulo}</Text>
              {selectedPost?.subtitulo && <Text style={styles.modalSub}>{selectedPost.subtitulo}</Text>}
              <View style={styles.modalMeta}>
                <View style={styles.autorRow}>
                  <View style={styles.autorAvatar}>
                    <MaterialIcons name="person" size={18} color="#FFF" />
                  </View>
                  <View>
                    <Text style={styles.autorNome}>{selectedPost?.autor || 'Gestão JUMO'}</Text>
                    <Text style={styles.autorRole}>Autor(a)</Text>
                  </View>
                </View>
                <View style={styles.viewsPill}>
                  <Ionicons name="eye" size={14} color={CORES.rosa} />
                  <Text style={styles.viewsText}>{selectedPost?.visualizacoes} views</Text>
                </View>
              </View>
              <View style={styles.modalDivider} />
              <Text style={styles.modalConteudo}>{selectedPost?.conteudo}</Text>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const TabItem = ({ icon, label, onPress, ativo }: any) => (
  <TouchableOpacity style={styles.tabItem} onPress={onPress}>
    <Ionicons name={icon} size={23} color={ativo ? CORES.azulEscuro : CORES.textoSecundario} />
    <Text style={[styles.tabLabel, ativo && { color: CORES.azulEscuro, fontWeight: '800' }]}>{label}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container:         { flex: 1, backgroundColor: CORES.fundo },
  navbar:            { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, height: 64, backgroundColor: CORES.branco, borderBottomWidth: 1, borderBottomColor: CORES.cinzaClaro },
  logoWrap:          { position: 'relative', flexDirection: 'row', alignItems: 'center' },
  dotAmarelo:        { position: 'absolute', top: 2, left: -4, width: 7, height: 7, borderRadius: 4, backgroundColor: CORES.amarelo, zIndex: 1 },
  logoText:          { fontSize: 26, fontWeight: '900', color: CORES.azulEscuro, letterSpacing: -1 },
  navRight:          { flexDirection: 'row', alignItems: 'center', gap: 10 },
  btnEdit:           { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: CORES.cinzaClaro, backgroundColor: CORES.branco },
  avatarBtn:         { width: 38, height: 38, borderRadius: 19, overflow: 'hidden', borderWidth: 2, borderColor: CORES.azulEscuro, backgroundColor: CORES.cinzaClaro },
  avatarImg:         { width: '100%', height: '100%' },
  avatarPlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent:     { paddingBottom: 20 },
  heroWrap:          { paddingHorizontal: 18, paddingTop: 18, paddingBottom: 6 },
  alertEdicao:       { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: CORES.rosa, borderRadius: 8, padding: 10, marginBottom: 12 },
  txtEdicao:         { color: '#FFF', fontWeight: 'bold', fontSize: 12 },
  heroCard:          { height: 180, backgroundColor: CORES.azulEscuro, borderRadius: 24, overflow: 'hidden', flexDirection: 'row', elevation: 6, shadowColor: CORES.azulEscuro, shadowOpacity: 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } },
  heroLeft:          { flex: 1, padding: 22, justifyContent: 'space-between' },
  heroBadge:         { alignSelf: 'flex-start', backgroundColor: CORES.amarelo, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  heroBadgeText:     { fontSize: 10, fontWeight: '900', color: CORES.azulEscuro, letterSpacing: 0.5 },
  heroTitle:         { fontSize: 24, fontWeight: '900', color: CORES.branco, lineHeight: 28, letterSpacing: -0.5 },
  heroCta:           { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: CORES.rosa, alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12 },
  heroCtaText:       { color: CORES.branco, fontWeight: '800', fontSize: 12, letterSpacing: 0.5 },
  heroImg:           { width: '45%', height: '130%', position: 'absolute', right: -20, bottom: -10, opacity: 0.15 },
  pillsRow:          { paddingHorizontal: 18, paddingVertical: 16, gap: 8, flexDirection: 'row' },
  pill:              { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, backgroundColor: CORES.branco, borderWidth: 1, borderColor: CORES.cinzaClaro },
  pillAtiva:         { backgroundColor: CORES.azulEscuro, borderColor: CORES.azulEscuro },
  pillText:          { fontSize: 13, fontWeight: '700', color: CORES.textoSecundario },
  pillTextAtiva:     { color: CORES.branco },
  secaoHeader:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, marginBottom: 14 },
  secaoTitulo:       { fontSize: 20, fontWeight: '900', color: CORES.azulEscuro, letterSpacing: -0.5 },
  btnAdd:            { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: CORES.rosa, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 12 },
  btnAddText:        { color: '#FFF', fontWeight: '700', fontSize: 13 },
  card:              { marginHorizontal: 18, marginBottom: 12, backgroundColor: CORES.branco, borderRadius: 18, overflow: 'hidden', flexDirection: 'row', elevation: 2, shadowColor: CORES.azulEscuro, shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, borderWidth: 1, borderColor: CORES.cinzaClaro },
  cardImg:           { width: 100, height: 100 },
  cardImgPlaceholder:{ width: 100, height: 100, backgroundColor: CORES.cinzaClaro, justifyContent: 'center', alignItems: 'center' },
  cardBody:          { flex: 1, padding: 14, justifyContent: 'space-between' },
  cardTitle:         { fontSize: 15, fontWeight: '800', color: CORES.azulEscuro, lineHeight: 20 },
  cardSub:           { fontSize: 12, color: CORES.textoSecundario, marginTop: 4 },
  cardMeta:          { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  cardViews:         { fontSize: 12, color: CORES.rosa, fontWeight: '700' },
  lidoBadge:         { flexDirection: 'row', alignItems: 'center', gap: 3 },
  lidoText:          { fontSize: 11, color: '#10B981', fontWeight: '700' },
  editBadge:         { position: 'absolute', top: 8, right: 8, backgroundColor: CORES.rosa, width: 26, height: 26, borderRadius: 13, justifyContent: 'center', alignItems: 'center' },
  emptyState:        { alignItems: 'center', justifyContent: 'center', paddingVertical: 50, gap: 10 },
  emptyText:         { color: CORES.textoSecundario, fontSize: 14, fontWeight: '600' },
  // tabBar com 6 itens: home, agenda, [heart-center], chat, achados, mais
  tabBar:            { position: 'absolute', bottom: 0, width: '100%', height: Platform.OS === 'ios' ? 84 : 68, backgroundColor: CORES.branco, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', borderTopWidth: 1, borderTopColor: CORES.cinzaClaro, paddingBottom: Platform.OS === 'ios' ? 18 : 0, elevation: 20 },
  tabItem:           { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tabLabel:          { fontSize: 10, fontWeight: '600', color: CORES.textoSecundario, marginTop: 3 },
  centerTab:         { flex: 1, alignItems: 'center', justifyContent: 'center' },
  centerBtn:         { width: 48, height: 48, borderRadius: 24, backgroundColor: '#FFE4EC', justifyContent: 'center', alignItems: 'center', marginTop: -16, borderWidth: 2, borderColor: CORES.branco, elevation: 4 },
  menuOverlay:       { flex: 1, backgroundColor: 'rgba(0,0,0,0.08)' },
  menuPopup:         { position: 'absolute', bottom: Platform.OS === 'ios' ? 95 : 78, right: 14, backgroundColor: CORES.branco, borderRadius: 16, paddingVertical: 8, width: 170, elevation: 12, shadowColor: CORES.azulEscuro, shadowOpacity: 0.15, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
  menuItem:          { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, paddingHorizontal: 16 },
  menuItemText:      { fontSize: 14, fontWeight: '700', color: CORES.azulEscuro },
  menuDivider:       { height: 1, backgroundColor: CORES.cinzaClaro, marginHorizontal: 14, marginVertical: 4 },
  modalWrap:         { flex: 1, backgroundColor: CORES.fundo },
  modalCover:        { width: '100%', height: height * 0.42, position: 'absolute', top: 0 },
  modalCoverOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.35)' },
  logoMini:          { fontSize: 36, fontWeight: '900', color: '#FFF', opacity: 0.2 },
  btnFechar:         { position: 'absolute', top: Platform.OS === 'ios' ? 50 : 28, right: 18, backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 22, width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  modalBody:         { flex: 1, marginTop: height * 0.36, backgroundColor: CORES.branco, borderTopLeftRadius: 36, borderTopRightRadius: 36, overflow: 'hidden', elevation: 20 },
  tagsRow:           { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  tag:               { backgroundColor: '#FFE4EC', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  tagText:           { color: CORES.rosa, fontSize: 11, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase' },
  modalTitulo:       { fontSize: 26, fontWeight: '900', color: CORES.azulEscuro, lineHeight: 32, marginBottom: 8, letterSpacing: -0.5 },
  modalSub:          { fontSize: 15, color: CORES.textoSecundario, fontStyle: 'italic', marginBottom: 20, lineHeight: 22 },
  modalMeta:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: CORES.fundo, padding: 14, borderRadius: 16 },
  autorRow:          { flexDirection: 'row', alignItems: 'center', gap: 10 },
  autorAvatar:       { width: 36, height: 36, borderRadius: 18, backgroundColor: CORES.azulEscuro, justifyContent: 'center', alignItems: 'center' },
  autorNome:         { fontSize: 14, fontWeight: '800', color: CORES.azulEscuro },
  autorRole:         { fontSize: 11, color: CORES.textoSecundario },
  viewsPill:         { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: CORES.branco, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12 },
  viewsText:         { fontSize: 12, fontWeight: '800', color: CORES.rosa },
  modalDivider:      { height: 3, width: 40, backgroundColor: CORES.cinzaClaro, borderRadius: 2, alignSelf: 'center', marginVertical: 24 },
  modalConteudo:     { fontSize: 16, color: '#4A4A68', lineHeight: 26, fontWeight: '500' },
});