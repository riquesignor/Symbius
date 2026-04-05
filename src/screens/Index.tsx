import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, Text, View, ScrollView, TouchableOpacity, 
  Image, SafeAreaView, StatusBar, Dimensions, 
  Modal, TouchableWithoutFeedback, Platform 
} from 'react-native';
import { auth, db } from '../config/firebaseConfig';
import { doc, getDoc, collection, onSnapshot, query, orderBy, updateDoc, increment } from 'firebase/firestore';
import { MaterialIcons, Ionicons, FontAwesome5 } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

const CORES = {
  azulEscuro: '#0B2046',
  rosa: '#E51C6A',
  amarelo: '#FFC82C',
  verde: '#4CAF50',
  fundo: '#F5F7FA',
  cinzaClaro: '#EAEFF4',
  textoDestaque: '#0B2046',
  textoSecundario: '#8D99AE',
  branco: '#FFFFFF'
};

const CATEGORIAS = [
  { titulo: "Olimpíadas", cat: "olimpiadas" },
  { titulo: "Indicações de Estágios", cat: "estagios" },
  { titulo: "Passeios", cat: "passeios" },
  { titulo: "Grêmio Estudantil", cat: "gremio" },
];

export default function Index({ navigation }: any) {
  const [userData, setUserData] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedPost, setSelectedPost] = useState<any>(null);
  const [modoEdicao, setModoEdicao] = useState(false);
  const [miniMenuAberto, setMiniMenuAberto] = useState(false);

  const userEmail = auth.currentUser?.email || '';
  const isSuperAdmin = userEmail.endsWith('@anchieta.br') || userData?.tipo === 'admin';
  const isGremio = userData?.tipo === 'gremio';
  const temPermissaoDeStaff = isSuperAdmin || isGremio;

  useEffect(() => {
    const carregarPerfil = async () => {
      const user = auth.currentUser;
      if (user) {
        try {
          const docRef = doc(db, "usuarios", user.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) setUserData(docSnap.data());
        } catch (error) { console.error(error); }
      }
    };

    const q = query(collection(db, "posts"), orderBy("data_publicacao", "desc"));
    const unsubPosts = onSnapshot(q, (snapshot) => {
      const postsArray = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setPosts(postsArray);
    });

    carregarPerfil();
    return () => unsubPosts();
  }, []);

  const visualizarPost = async (post: any) => {
    setSelectedPost(post);
    setModalVisible(true);
    if (!modoEdicao) {
      try {
        const postRef = doc(db, "posts", post.id);
        await updateDoc(postRef, { visualizacoes: increment(1) });
      } catch (error) { console.error("Erro ao computar view:", error); }
    }
  };

  const renderCard = (post: any, podeEditarEste: boolean) => (
    <TouchableOpacity 
      key={post.id} 
      style={[styles.popupCard, podeEditarEste && styles.cardEditavel]} 
      onPress={() => podeEditarEste ? navigation.navigate('EditorPost', { postId: post.id, categoria: post.categoria, current: post }) : visualizarPost(post)}
      activeOpacity={0.9}
    >
      {post.capa ? (
        <Image source={{ uri: post.capa }} style={styles.popupImg} />
      ) : (
        <View style={styles.emptyCard}>
          <MaterialIcons name="image" size={36} color={CORES.textoSecundario} opacity={0.2} />
        </View>
      )}
      
      <View style={styles.popupInfo}>
        <Text style={styles.popupTitle} numberOfLines={2}>{post.titulo}</Text>
        <View style={styles.cardFooter}>
          <View style={styles.viewBadge}>
            <Ionicons name="eye" size={14} color={CORES.rosa} />
            <Text style={styles.txtViews}>{post.visualizacoes || 0}</Text>
          </View>
        </View>
      </View>
      
      {podeEditarEste && (
        <View style={styles.editBadge}>
          <MaterialIcons name="edit" size={14} color="#FFF" />
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={CORES.branco} />
      
      {/* 1. NAVBAR FIXA */}
      <View style={styles.navbar}>
        <TouchableOpacity style={styles.navIconBtn}>
          <Ionicons name="menu" size={28} color={CORES.azulEscuro} />
        </TouchableOpacity>

        <View style={styles.logoContainer}>
          <View style={styles.dotAmarelo} />
          <Text style={styles.logoText}>
            <Text style={{color: CORES.azulEscuro}}>JUM</Text>
            <Text style={{color: CORES.rosa}}>O</Text>
          </Text>
        </View>

        <View style={styles.navRight}>
          {temPermissaoDeStaff && (
            <TouchableOpacity 
              onPress={() => setModoEdicao(!modoEdicao)} 
              style={[styles.btnEditMode, modoEdicao && { backgroundColor: CORES.rosa, borderColor: CORES.rosa }]}
            >
              <FontAwesome5 name="pen" size={12} color={modoEdicao ? "#FFF" : CORES.azulEscuro} />
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.topProfile} onPress={() => navigation.navigate('Perfil')}>
            {userData?.foto ? (
              <Image source={{ uri: userData.foto }} style={styles.imgProfile} />
            ) : (
              <View style={styles.avatarPlaceholder}><Text style={styles.iniciais}>?</Text></View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* 2. AREA DE SCROLL - ENVOLVIDA POR VIEW FLEX 1 */}
      <View style={{ flex: 1 }}>
        <ScrollView 
          showsVerticalScrollIndicator={false} 
          contentContainerStyle={styles.scrollContent} 
        >
            <View style={styles.padraoContainer}>
              {modoEdicao && (
                <View style={styles.alertEdicao}>
                  <Ionicons name="alert-circle" size={16} color="#FFF" />
                  <Text style={styles.txtEdicao}>MODO EDITOR ATIVADO</Text>
                </View>
              )}

              <TouchableOpacity style={styles.cardHero} activeOpacity={0.9}>
                <View style={styles.heroContent}>
                  <View style={styles.badgeAmarelo}>
                    <Text style={styles.badgeTextAmarelo}>Novidades</Text>
                  </View>
                  <Text style={styles.heroTitle}>UM SÓ ANCHIETA:{"\n"}A REVOLUÇÃO{"\n"}COMEÇOU</Text>
                  <View style={styles.btnLerAgora}>
                    <Text style={styles.txtLerAgora}>LER AGORA</Text>
                  </View>
                </View>
                <Image source={{ uri: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?q=80&w=400' }} style={styles.heroImg} />
              </TouchableOpacity>
            </View>
            
            {CATEGORIAS.map(secao => {
              const postsDaSecao = posts.filter(p => p.categoria === secao.cat);
              const podeEditarSecao = modoEdicao && (isSuperAdmin || (isGremio && secao.cat === 'gremio'));

              return (
                <View key={secao.cat} style={styles.sectionContainer}>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>{secao.titulo}</Text>
                    {podeEditarSecao && (
                      <TouchableOpacity style={styles.btnAddPost} onPress={() => navigation.navigate('EditorPost', { categoria: secao.cat })}>
                        <MaterialIcons name="add" size={20} color="#FFF" />
                      </TouchableOpacity>
                    )}
                  </View>
                  
                  <ScrollView 
                    horizontal 
                    showsHorizontalScrollIndicator={false} 
                    contentContainerStyle={{ paddingLeft: 20, paddingRight: 20 }} 
                    decelerationRate="fast"
                    snapToInterval={235}
                  >
                    {postsDaSecao.length > 0 ? postsDaSecao.map(post => renderCard(post, podeEditarSecao)) : (
                      <View style={styles.emptySecao}>
                        <Text style={styles.txtEmpty}>Nenhum post no momento.</Text>
                      </View>
                    )}
                  </ScrollView>
                </View>
              );
            })}
        </ScrollView>
      </View>

      {/* 3. BARRA INFERIOR FIXA */}
      <View style={styles.bottomTabBar}>
        <TabItem icon="home" label="Início" onPress={() => {}} ativo={true} />
        <TabItem icon="chatbubbles-outline" label="HallChat" onPress={() => navigation.navigate('Hall')} />
        
        <View style={styles.centerTabContainer}>
          <TouchableOpacity style={styles.centerTabBtn} onPress={() => navigation.navigate('Match')}>
            <View style={styles.centerTabInner}>
              <Ionicons name="heart" size={24} color={CORES.rosa} />
            </View>
          </TouchableOpacity>
        </View>
        
        <TabItem icon="search-outline" label="Achados" onPress={() => navigation.navigate('AchadosPerdidos')} />
        <TabItem icon="ellipsis-horizontal" label="Mais" onPress={() => setMiniMenuAberto(true)} />
      </View>

      {/* 4. MODAIS E MENUS */}
      <Modal visible={miniMenuAberto} transparent animationType="fade">
        <TouchableWithoutFeedback onPress={() => setMiniMenuAberto(false)}>
          <View style={styles.miniMenuOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.miniMenuPopup}>
                <TouchableOpacity style={styles.miniMenuBtn} onPress={() => { setMiniMenuAberto(false); navigation.navigate('Contatos'); }}>
                  <Ionicons name="call" size={18} color={CORES.azulEscuro} />
                  <Text style={styles.miniMenuBtnText}>Contatos</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.miniMenuBtn} onPress={() => { setMiniMenuAberto(false); navigation.navigate('Ajuda'); }}>
                  <Ionicons name="help-circle" size={18} color={CORES.azulEscuro} />
                  <Text style={styles.miniMenuBtnText}>Ajuda</Text>
                </TouchableOpacity>
                <View style={styles.miniMenuDivider} />
                <TouchableOpacity style={styles.miniMenuBtn} onPress={() => auth.signOut()}>
                  <Ionicons name="log-out" size={18} color="#FF5252" />
                  <Text style={[styles.miniMenuBtnText, {color: '#FF5252'}]}>Sair</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalFullContainer}>
          <View style={styles.postCoverContainer}>
            {selectedPost?.capa ? (
              <Image source={{ uri: selectedPost.capa }} style={styles.modalImgFull} />
            ) : (
              <View style={[styles.modalImgFull, { backgroundColor: CORES.azulEscuro, justifyContent: 'center', alignItems: 'center' }]}>
                <Text style={styles.logoMiniMuda}>JU<Text style={{color: CORES.rosa}}>MO</Text></Text>
              </View>
            )}
            <View style={styles.coverOverlay} />
            <TouchableOpacity style={styles.closeModalGordinho} onPress={() => setModalVisible(false)}>
              <Ionicons name="chevron-down" size={28} color="#FFF" />
            </TouchableOpacity>
          </View>

          <View style={styles.modalBodyWrapper}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalScrollGordinho}>
              {selectedPost?.tags && selectedPost.tags.length > 0 && (
                <View style={styles.tagContainer}>
                  {selectedPost.tags.map((tag: string, index: number) => (
                    <View key={index} style={styles.tagChip}><Text style={styles.tagText}>{tag}</Text></View>
                  ))}
                </View>
              )}
              <Text style={styles.modalTitleBig}>{selectedPost?.titulo}</Text>
              {selectedPost?.subtitulo && (
                <Text style={styles.modalSubLine}>{selectedPost?.subtitulo}</Text>
              )}
              <View style={styles.postMetaBox}>
                <View style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
                  <View style={styles.authorAvatar}><MaterialIcons name="person" size={20} color={CORES.branco} /></View>
                  <View>
                    <Text style={styles.txtAuthorName}>{selectedPost?.autor || "Gestão JUMO"}</Text>
                    <Text style={styles.txtAuthorRole}>Autor(a)</Text>
                  </View>
                </View>
                {selectedPost?.visualizacoes !== undefined && (
                  <View style={styles.viewsPill}>
                    <Ionicons name="eye" size={16} color={CORES.rosa} />
                    <Text style={styles.txtMetaViews}>{selectedPost?.visualizacoes} views</Text>
                  </View>
                )}
              </View>
              <View style={styles.dividerGordinho} />
              <Text style={styles.modalDescText}>{selectedPost?.conteudo}</Text>
              <View style={{height: 60}} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const TabItem = ({ icon, label, onPress, ativo }: any) => (
  <TouchableOpacity style={styles.tabItem} onPress={onPress}>
    <Ionicons name={icon} size={24} color={ativo ? CORES.azulEscuro : CORES.textoSecundario} />
    <Text style={[styles.tabLabel, ativo && { color: CORES.azulEscuro, fontWeight: '800' }]}>{label}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: CORES.fundo },
  
  // O SEGREDO DO SCROLL:
  scrollContent: { 
    paddingBottom: 120, // Espaço para a TabBar absoluta
    paddingTop: 10 
  },

  navbar: { 
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', 
    paddingHorizontal: 20, height: 75, backgroundColor: CORES.branco,
    borderBottomWidth: 1, borderBottomColor: CORES.cinzaClaro,
    zIndex: 10
  },
  navIconBtn: { width: 40, justifyContent: 'center' },
  logoContainer: { alignItems: 'center', justifyContent: 'center' },
  dotAmarelo: { width: 6, height: 6, backgroundColor: CORES.amarelo, borderRadius: 3, position: 'absolute', top: -4, left: 4 },
  logoText: { fontSize: 28, fontWeight: '900', letterSpacing: -1 },
  navRight: { flexDirection: 'row', alignItems: 'center', gap: 10, width: 80, justifyContent: 'flex-end' },
  topProfile: { width: 40, height: 40, borderRadius: 20, backgroundColor: CORES.cinzaClaro, overflow: 'hidden', borderWidth: 2, borderColor: CORES.azulEscuro },
  imgProfile: { width: '100%', height: '100%' },
  avatarPlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  iniciais: { color: CORES.azulEscuro, fontWeight: '900', fontSize: 16 },
  btnEditMode: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: CORES.cinzaClaro, backgroundColor: CORES.branco },

  padraoContainer: { paddingHorizontal: 20 },
  alertEdicao: { backgroundColor: CORES.rosa, padding: 10, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 15 },
  txtEdicao: { color: '#FFF', fontWeight: 'bold', fontSize: 12 },
  cardHero: { width: '100%', height: 200, backgroundColor: CORES.rosa, borderRadius: 25, overflow: 'hidden', flexDirection: 'row', marginTop: 20, marginBottom: 35, elevation: 8, shadowColor: CORES.rosa, shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: {width: 0, height: 5} },
  heroContent: { flex: 1, padding: 20, justifyContent: 'center', zIndex: 2 },
  badgeAmarelo: { backgroundColor: CORES.amarelo, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, alignSelf: 'flex-end', position: 'absolute', top: 15, right: 15 },
  badgeTextAmarelo: { fontSize: 11, fontWeight: '900', color: CORES.azulEscuro },
  heroTitle: { color: CORES.branco, fontSize: 22, fontWeight: '900', marginTop: 10, lineHeight: 26 },
  btnLerAgora: { backgroundColor: '#FF8A65', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20, alignSelf: 'flex-start', marginTop: 15 },
  txtLerAgora: { color: '#FFF', fontWeight: 'bold', fontSize: 12 },
  heroImg: { position: 'absolute', right: -30, bottom: -20, width: '60%', height: '120%', opacity: 0.2 },

  sectionContainer: { marginBottom: 35 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingRight: 20, marginBottom: 15 },
  sectionTitle: { fontSize: 22, fontWeight: '900', color: CORES.azulEscuro, marginLeft: 20, letterSpacing: -0.5 },
  btnAddPost: { backgroundColor: CORES.rosa, width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  
  popupCard: { width: 220, height: 190, backgroundColor: CORES.branco, borderRadius: 20, marginRight: 15, elevation: 4, shadowColor: CORES.azulEscuro, shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: {width: 0, height: 3}, overflow: 'hidden', borderWidth: 1, borderColor: CORES.cinzaClaro },
  cardEditavel: { borderColor: CORES.rosa, borderWidth: 2 },
  popupImg: { width: '100%', height: 110, backgroundColor: CORES.cinzaClaro },
  emptyCard: { width: '100%', height: 110, backgroundColor: CORES.cinzaClaro, justifyContent: 'center', alignItems: 'center' },
  popupInfo: { padding: 15, flex: 1, justifyContent: 'space-between' },
  popupTitle: { fontSize: 16, fontWeight: '800', color: CORES.azulEscuro, lineHeight: 22 },
  cardFooter: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center' },
  viewBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FFE4EC', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  txtViews: { fontSize: 12, color: CORES.rosa, fontWeight: '900' },
  editBadge: { position: 'absolute', top: 10, right: 10, backgroundColor: CORES.rosa, width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', elevation: 3 },
  emptySecao: { padding: 20, backgroundColor: CORES.cinzaClaro, borderRadius: 20, alignItems: 'center', justifyContent: 'center', width: width - 40 },
  txtEmpty: { color: CORES.textoSecundario, fontSize: 14, fontWeight: '600' },

  bottomTabBar: { position: 'absolute', bottom: 0, width: '100%', height: Platform.OS === 'ios' ? 85 : 70, backgroundColor: CORES.branco, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', borderTopWidth: 1, borderTopColor: CORES.cinzaClaro, paddingBottom: Platform.OS === 'ios' ? 20 : 0, elevation: 20, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10 },
  tabItem: { alignItems: 'center', justifyContent: 'center', flex: 1 },
  tabLabel: { fontSize: 10, fontWeight: '600', color: CORES.textoSecundario, marginTop: 4 },
  centerTabContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  centerTabBtn: { width: 50, height: 50, borderRadius: 25, backgroundColor: CORES.branco, borderWidth: 2, borderColor: '#FF8A65', justifyContent: 'center', alignItems: 'center', marginTop: -20 },
  centerTabInner: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#FFE4EC', justifyContent: 'center', alignItems: 'center' },

  miniMenuOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.1)' },
  miniMenuPopup: { position: 'absolute', bottom: Platform.OS === 'ios' ? 95 : 80, right: 15, backgroundColor: CORES.branco, borderRadius: 16, paddingVertical: 10, width: 150, elevation: 10, shadowColor: CORES.azulEscuro, shadowOpacity: 0.15, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
  miniMenuBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 15, gap: 12 },
  miniMenuBtnText: { fontSize: 15, fontWeight: '700', color: CORES.azulEscuro },
  miniMenuDivider: { height: 1, backgroundColor: CORES.cinzaClaro, marginVertical: 4, marginHorizontal: 15 },

  modalFullContainer: { flex: 1, backgroundColor: CORES.fundo },
  postCoverContainer: { width: '100%', height: height * 0.45, position: 'absolute', top: 0 }, 
  modalImgFull: { width: '100%', height: '100%' },
  coverOverlay: { position: 'absolute', top: 0, left: 0, right: 0, height: 120, backgroundColor: 'rgba(0,0,0,0.4)' },
  logoMiniMuda: { fontSize: 40, fontWeight: '900', color: '#FFF', letterSpacing: -1, opacity: 0.2 },
  closeModalGordinho: { position: 'absolute', top: Platform.OS === 'ios' ? 50 : 30, right: 20, zIndex: 10, backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 24, width: 48, height: 48, justifyContent: 'center', alignItems: 'center' },
  modalBodyWrapper: { flex: 1, marginTop: height * 0.38 }, 
  modalScrollGordinho: { backgroundColor: CORES.branco, borderTopLeftRadius: 40, borderTopRightRadius: 40, padding: 30, minHeight: height * 0.65, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 20, elevation: 20 },
  tagContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  tagChip: { backgroundColor: '#FFE4EC', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20 },
  tagText: { color: CORES.rosa, fontSize: 11, fontWeight: '900', letterSpacing: 0.5, textTransform: 'uppercase' },
  modalTitleBig: { fontSize: 28, fontWeight: '900', color: CORES.azulEscuro, lineHeight: 34, marginBottom: 10, letterSpacing: -1 },
  modalSubLine: { fontSize: 16, color: CORES.textoSecundario, fontStyle: 'italic', marginBottom: 25, lineHeight: 24 },
  postMetaBox: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: CORES.cinzaClaro, padding: 15, borderRadius: 20 },
  authorAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: CORES.azulEscuro, justifyContent: 'center', alignItems: 'center', elevation: 2 },
  txtAuthorName: { fontSize: 15, fontWeight: '800', color: CORES.azulEscuro },
  txtAuthorRole: { fontSize: 12, color: CORES.textoSecundario, fontWeight: '600' },
  viewsPill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: CORES.branco, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 15 },
  txtMetaViews: { fontSize: 12, fontWeight: '800', color: CORES.rosa },
  dividerGordinho: { height: 4, width: 50, backgroundColor: CORES.cinzaClaro, marginVertical: 30, borderRadius: 2, alignSelf: 'center' },
  modalDescText: { fontSize: 17, color: '#4A4A68', lineHeight: 28, fontWeight: '500' },
});