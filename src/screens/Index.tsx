import React, { useState, useEffect, useRef } from 'react';
import { 
  StyleSheet, Text, View, ScrollView, TouchableOpacity, 
  Image, SafeAreaView, StatusBar, Dimensions, Animated, 
  Modal, Alert, TouchableWithoutFeedback 
} from 'react-native';
import { auth, db } from '../config/firebaseConfig';
import { doc, getDoc, collection, onSnapshot, query, orderBy, updateDoc, increment } from 'firebase/firestore';
import { MaterialIcons, Ionicons, FontAwesome5 } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

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
    >
      {post.capa ? <Image source={{ uri: post.capa }} style={styles.popupImg} /> : <View style={styles.emptyCard}><MaterialIcons name="image" size={24} color="#CCC" /></View>}
      <View style={styles.popupInfo}>
        <Text style={styles.popupTitle} numberOfLines={2}>{post.titulo}</Text>
        {post.visualizacoes !== undefined && <Text style={styles.txtViews}>{post.visualizacoes} views</Text>}
      </View>
      {podeEditarEste && <View style={styles.editBadge}><MaterialIcons name="edit" size={12} color="#FFF" /></View>}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFF" />
      
      {/* 1. NAVBAR */}
      <View style={styles.navbar}>
        <View style={styles.navLeft}>
          <TouchableOpacity style={styles.topProfile} onPress={() => navigation.navigate('Perfil')}>
            {userData?.foto ? (
              <Image source={{ uri: userData.foto }} style={styles.imgProfile} />
            ) : (
              <View style={styles.avatarPlaceholder}><Text style={styles.iniciais}>?</Text></View>
            )}
          </TouchableOpacity>
          <Text style={styles.logoMini}>JU<Text style={{color: '#E91E63'}}>MO</Text></Text>
        </View>

        <View style={styles.navRight}>
          {temPermissaoDeStaff && (
            <TouchableOpacity 
              onPress={() => setModoEdicao(!modoEdicao)} 
              style={[styles.btnEditMode, modoEdicao && { backgroundColor: '#E91E63' }]}
            >
              <FontAwesome5 name="pen" size={14} color={modoEdicao ? "#FFF" : "#E91E63"} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* 2. ÁREA DE CONTEÚDO */}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
          <View style={styles.padraoContainer}>
            <View style={styles.welcomeHeader}>
              <Text style={styles.txtSaudacao}>Olá, {userData?.nome_completo?.split(' ')[0] || 'Aluno'}</Text>
              <Text style={[styles.txtSub, modoEdicao && { color: '#E91E63', fontWeight: 'bold' }]}>
                {modoEdicao ? "● MODO EDITOR ATIVO" : "Novidades do Anchieta"}
              </Text>
            </View>

            <TouchableOpacity style={styles.cardHero}>
              <View style={styles.heroContent}>
                <View style={styles.badgeNews}><Text style={styles.badgeText}>EXPLORAR</Text></View>
                <Text style={styles.heroTitle}>JUMO 2026</Text>
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
                      <MaterialIcons name="add" size={16} color="#FFF" />
                    </TouchableOpacity>
                  )}
                </View>
                
                {/* LISTA ARRASTÁVEL (HORIZONTAL) */}
                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={false} 
                  contentContainerStyle={{ paddingLeft: 20, paddingRight: 20 }} // Respiro na direita ao chegar no fim
                  decelerationRate="fast"
                >
                  {postsDaSecao.length > 0 ? postsDaSecao.map(post => renderCard(post, podeEditarSecao)) : (
                    <View style={styles.emptySecao}><Text style={styles.txtEmpty}>Sem posts por aqui.</Text></View>
                  )}
                </ScrollView>
              </View>
            );
          })}
      </ScrollView>

      {/* 3. BARRA INFERIOR (TAB BAR) */}
      <View style={styles.bottomTabBar}>
        <TabItem icon="person" label="Perfil" onPress={() => navigation.navigate('Perfil')} />
        <TabItem icon="chatbubbles" label="Chat" onPress={() => navigation.navigate('Chat')} />
        <TabItem icon="heart" label="Match" onPress={() => navigation.navigate('Match')} />
        <TabItem icon="search" label="Achados" onPress={() => navigation.navigate('AchadosPerdidos')} />
        <TabItem icon="ellipsis-horizontal" label="Mais" onPress={() => setMiniMenuAberto(true)} />
      </View>

      {/* 4. MINI MENU */}
      <Modal visible={miniMenuAberto} transparent animationType="fade">
        <TouchableWithoutFeedback onPress={() => setMiniMenuAberto(false)}>
          <View style={styles.miniMenuOverlay}>
            <View style={styles.miniMenuContent}>
              <View style={styles.miniMenuIndicator} />
              <TouchableOpacity style={styles.miniMenuBtn} onPress={() => { setMiniMenuAberto(false); navigation.navigate('Contatos'); }}>
                <Ionicons name="call" size={20} color="#1A1A2E" />
                <Text style={styles.miniMenuBtnText}>Contatos</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.miniMenuBtn} onPress={() => { setMiniMenuAberto(false); navigation.navigate('Ajuda'); }}>
                <Ionicons name="help-circle" size={22} color="#1A1A2E" />
                <Text style={styles.miniMenuBtnText}>Ajuda</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.miniMenuBtn, {marginTop: 10}]} onPress={() => auth.signOut()}>
                <Ionicons name="log-out" size={20} color="#FF5252" />
                <Text style={[styles.miniMenuBtnText, {color: '#FF5252'}]}>Sair da Conta</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* 5. MODAL DE POST (RESTAURADO) */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <TouchableOpacity style={styles.closeModal} onPress={() => setModalVisible(false)}>
              <MaterialIcons name="close" size={28} color="#FFF" />
            </TouchableOpacity>
            
            {selectedPost?.capa && <Image source={{ uri: selectedPost.capa }} style={styles.modalImg} />}
            
            <ScrollView style={styles.modalScroll}>
              {/* RESTAURADO: TAGS */}
              {selectedPost?.tags && selectedPost.tags.length > 0 && (
                <View style={styles.tagContainer}>
                  {selectedPost.tags.map((tag: string, index: number) => (
                    <View key={index} style={styles.tagChip}><Text style={styles.tagText}>{tag}</Text></View>
                  ))}
                </View>
              )}

              <Text style={styles.modalTitle}>{selectedPost?.titulo}</Text>
              
              {/* RESTAURADO: SUBTÍTULO */}
              {selectedPost?.subtitulo && (
                <Text style={styles.modalSub}>{selectedPost?.subtitulo}</Text>
              )}
              
              {/* RESTAURADO: META INFO (AUTOR E VIEWS) */}
              <View style={styles.postMetaRow}>
                <Text style={styles.txtMeta}>Por: <Text style={{fontWeight: 'bold', color: '#1A1A2E'}}>{selectedPost?.autor || "Gestão"}</Text></Text>
                {selectedPost?.visualizacoes !== undefined && (
                  <Text style={styles.txtMeta}><Ionicons name="eye" size={14} /> {selectedPost?.visualizacoes}</Text>
                )}
              </View>

              {/* RESTAURADO: DIVISOR */}
              <View style={styles.divider} />

              <Text style={styles.modalDesc}>{selectedPost?.conteudo}</Text>
              <View style={{height: 100}} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const TabItem = ({ icon, label, onPress }: any) => (
  <TouchableOpacity style={styles.tabItem} onPress={onPress}>
    <Ionicons name={icon} size={24} color="#1A1A2E" />
    <Text style={styles.tabLabel}>{label}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  navbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, height: 70, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  navLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  navRight: { flexDirection: 'row', alignItems: 'center' },
  logoMini: { fontSize: 20, fontWeight: '900', color: '#1A1A2E' },
  topProfile: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F0F0F0', overflow: 'hidden', borderWidth: 2, borderColor: '#E91E63' },
  imgProfile: { width: '100%', height: '100%' },
  avatarPlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  iniciais: { color: '#E91E63', fontWeight: 'bold' },
  btnEditMode: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#E91E63' },
  padraoContainer: { paddingHorizontal: 20 },
  welcomeHeader: { marginTop: 20, marginBottom: 20 },
  txtSaudacao: { fontSize: 24, fontWeight: '900', color: '#1A1A2E' },
  txtSub: { fontSize: 13, color: '#777' },
  cardHero: { width: '100%', height: 120, backgroundColor: '#1A1A2E', borderRadius: 20, overflow: 'hidden', flexDirection: 'row', marginBottom: 20 },
  heroContent: { flex: 1, padding: 20, justifyContent: 'center' },
  badgeNews: { backgroundColor: '#E91E63', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, alignSelf: 'flex-start' },
  badgeText: { fontSize: 9, fontWeight: '900', color: '#FFF' },
  heroTitle: { color: 'white', fontSize: 18, fontWeight: 'bold', marginTop: 8 },
  heroImg: { width: '40%', height: '100%', opacity: 0.6 },
  sectionContainer: { marginBottom: 25 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingRight: 20, marginBottom: 12 },
  sectionTitle: { fontSize: 17, fontWeight: '900', color: '#1A1A2E', marginLeft: 20 },
  btnAddPost: { backgroundColor: '#E91E63', width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  popupCard: { width: 150, height: 190, backgroundColor: '#FFF', borderRadius: 18, marginRight: 15, elevation: 3, overflow: 'hidden', borderWidth: 1, borderColor: '#F0F0F0' },
  cardEditavel: { borderColor: '#E91E63', borderWidth: 2 },
  popupImg: { width: '100%', height: 100, backgroundColor: '#EEE' },
  emptyCard: { width: '100%', height: 100, backgroundColor: '#F8F9FA', justifyContent: 'center', alignItems: 'center' },
  popupInfo: { padding: 10 },
  popupTitle: { fontSize: 13, fontWeight: '800', color: '#333' },
  txtViews: { fontSize: 10, color: '#999', marginTop: 4 },
  editBadge: { position: 'absolute', top: 5, right: 5, backgroundColor: '#E91E63', width: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  emptySecao: { padding: 15, backgroundColor: '#F8F9FA', borderRadius: 12 },
  txtEmpty: { color: '#AAA', fontSize: 12 },
  bottomTabBar: { position: 'absolute', bottom: 0, width: '100%', height: 80, backgroundColor: '#FFF', flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#F0F0F0', paddingBottom: 20, elevation: 10, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10 },
  tabItem: { alignItems: 'center', justifyContent: 'center' },
  tabLabel: { fontSize: 10, fontWeight: 'bold', color: '#1A1A2E', marginTop: 4 },
  miniMenuOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  miniMenuContent: { backgroundColor: '#FFF', borderTopLeftRadius: 25, borderTopRightRadius: 25, padding: 25, paddingBottom: 40, alignItems: 'center' },
  miniMenuIndicator: { width: 40, height: 5, backgroundColor: '#DDD', borderRadius: 3, marginBottom: 20 },
  miniMenuBtn: { flexDirection: 'row', alignItems: 'center', width: '100%', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#F5F5F5', gap: 15 },
  miniMenuBtnText: { fontSize: 16, fontWeight: 'bold', color: '#1A1A2E' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'flex-end' },
  modalContent: { width: '100%', height: height * 0.85, backgroundColor: '#FFF', borderTopLeftRadius: 30, borderTopRightRadius: 30, overflow: 'hidden' },
  closeModal: { position: 'absolute', top: 20, right: 20, zIndex: 10, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20, padding: 8 },
  modalImg: { width: '100%', height: 250 },
  modalScroll: { padding: 25 },
  tagContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 15 },
  tagChip: { backgroundColor: '#FFF0F5', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 15, borderWidth: 1, borderColor: '#E91E63' },
  tagText: { color: '#E91E63', fontSize: 11, fontWeight: 'bold' },
  modalTitle: { fontSize: 24, fontWeight: '900', color: '#1A1A2E' },
  modalSub: { fontSize: 16, color: '#666', marginTop: 8, fontStyle: 'italic' },
  postMetaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 15 },
  txtMeta: { fontSize: 13, color: '#777' },
  divider: { height: 4, width: 40, backgroundColor: '#E91E63', marginVertical: 20, borderRadius: 2 },
  modalDesc: { fontSize: 16, color: '#444', lineHeight: 26 },
});