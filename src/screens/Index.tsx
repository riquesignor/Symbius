import React, { useState, useEffect, useRef } from 'react';
import { 
  StyleSheet, Text, View, ScrollView, TouchableOpacity, 
  Image, SafeAreaView, StatusBar, Dimensions, Animated, 
  TouchableWithoutFeedback, Modal, Alert 
} from 'react-native';
import { auth, db } from '../config/firebaseConfig';
import { doc, getDoc, collection, onSnapshot, query, orderBy, updateDoc, increment } from 'firebase/firestore';
import { MaterialIcons, Ionicons, FontAwesome5 } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

// Categorias agora servem só para organizar as seções, sem IDs fixos
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
  const [menuAberto, setMenuAberto] = useState(false);
  const slideAnim = useRef(new Animated.Value(-300)).current;

  // Lógica de Permissões
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

    // Puxando da coleção 'posts', ordenando pelo mais recente
    const q = query(collection(db, "posts"), orderBy("data_publicacao", "desc"));
    const unsubPosts = onSnapshot(q, (snapshot) => {
      const postsArray = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setPosts(postsArray);
    });

    carregarPerfil();
    return () => unsubPosts();
  }, []);

  const abrirMenu = () => {
    setMenuAberto(true);
    Animated.timing(slideAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start();
  };

  const fecharMenu = () => {
    Animated.timing(slideAnim, { toValue: -300, duration: 300, useNativeDriver: true })
      .start(() => setMenuAberto(false));
  };

  const visualizarPost = async (post: any) => {
    setSelectedPost(post);
    setModalVisible(true);
    
    // Incrementa a visualização no banco de dados se não for o autor/admin
    if (!modoEdicao) {
      try {
        const postRef = doc(db, "posts", post.id);
        await updateDoc(postRef, {
          visualizacoes: increment(1)
        });
      } catch (error) {
        console.error("Erro ao computar view:", error);
      }
    }
  };

  const renderCard = (post: any, podeEditarEste: boolean) => {
    return (
      <TouchableOpacity 
        key={post.id} 
        style={[styles.popupCard, podeEditarEste && styles.cardEditavel]} 
        onPress={() => {
          if (podeEditarEste) {
            navigation.navigate('EditorPost', { postId: post.id, categoria: post.categoria, current: post });
          } else {
            visualizarPost(post);
          }
        }}
      >
        {post.capa ? (
          <Image source={{ uri: post.capa }} style={styles.popupImg} />
        ) : (
          <View style={styles.emptyCard}>
            <MaterialIcons name="image" size={24} color="#CCC" />
          </View>
        )}
        <View style={styles.popupInfo}>
          <Text style={styles.popupTitle} numberOfLines={2}>{post.titulo}</Text>
          {post.visualizacoes !== undefined && (
            <Text style={styles.txtViews}>{post.visualizacoes} views</Text>
          )}
        </View>
        {podeEditarEste && <View style={styles.editBadge}><MaterialIcons name="edit" size={12} color="#FFF" /></View>}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFF" />
      
      {/* 1. NAVBAR - FIXA */}
      <View style={styles.navbar}>
        <TouchableOpacity onPress={abrirMenu}>
          <MaterialIcons name="menu" size={32} color="#1A1A2E" />
        </TouchableOpacity>
        
        <Text style={styles.logo}>JU<Text style={{color: '#E91E63'}}>MO</Text></Text>
        
        <View style={styles.navRight}>
          {temPermissaoDeStaff && (
            <TouchableOpacity 
              onPress={() => setModoEdicao(!modoEdicao)} 
              style={[styles.btnEditMode, modoEdicao && { backgroundColor: '#E91E63' }]}
            >
              <FontAwesome5 name="pen" size={14} color={modoEdicao ? "#FFF" : "#E91E63"} />
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

      {/* 2. ÁREA DE ROLAGEM - O segredo está nestas duas linhas abaixo */}
      <View style={{ flex: 1 }}> 
        <ScrollView 
          showsVerticalScrollIndicator={true}
          contentContainerStyle={{ flexGrow: 1, paddingBottom: 40 }} 
          
        >
          {/* Cabeçalho e Banner */}
          <View style={styles.padraoContainer}>
            <View style={styles.welcomeHeader}>
              <Text style={styles.txtSaudacao}>Olá, {userData?.nome_completo?.split(' ')[0] || 'Aluno'}</Text>
              <Text style={[styles.txtSub, modoEdicao && { color: '#E91E63', fontWeight: 'bold' }]}>
                {modoEdicao ? "● MODO EDITOR ATIVO" : "O que temos para hoje no Anchieta?"}
              </Text>
            </View>

            <TouchableOpacity style={styles.cardHero}>
              <View style={styles.heroContent}>
                <View style={styles.badgeNews}><Text style={styles.badgeText}>NOVIDADE</Text></View>
                <Text style={styles.heroTitle}>Explore o JUMO 2026</Text>
              </View>
              <Image source={{ uri: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?q=80&w=400' }} style={styles.heroImg} />
            </TouchableOpacity>
          </View>
          
          {/* Listagem Dinâmica de Categorias */}
          {CATEGORIAS.map(secao => {
            const postsDaSecao = posts.filter(p => p.categoria === secao.cat);
            const podeEditarSecao = modoEdicao && (isSuperAdmin || (isGremio && secao.cat === 'gremio'));

            return (
              <View key={secao.cat} style={styles.sectionContainer}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>{secao.titulo}</Text>
                  {podeEditarSecao && (
                    <TouchableOpacity 
                      style={styles.btnAddPost} 
                      onPress={() => navigation.navigate('EditorPost', { categoria: secao.cat })}
                    >
                      <MaterialIcons name="add" size={16} color="#FFF" />
                      <Text style={styles.txtAddPost}>Novo</Text>
                    </TouchableOpacity>
                  )}
                </View>

                <ScrollView horizontal showsHorizontalScrollIndicator={true} contentContainerStyle={{ paddingLeft: 20 }}>
                  {postsDaSecao.length > 0 ? (
                    postsDaSecao.map(post => renderCard(post, podeEditarSecao))
                  ) : (
                    <View style={styles.emptySecao}>
                      <Text style={styles.txtEmpty}>Nenhuma novidade ainda.</Text>
                    </View>
                  )}
                </ScrollView>
              </View>
            );
          })}

          <TouchableOpacity style={styles.btnLogout} onPress={() => auth.signOut()}>
            <MaterialIcons name="exit-to-app" size={20} color="#FF5252" />
            <Text style={styles.btnLogoutText}> Sair da Conta</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* 3. MODAL (Fora da área de scroll para não bugar) */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <TouchableOpacity style={styles.closeModal} onPress={() => setModalVisible(false)}>
              <MaterialIcons name="close" size={28} color="#FFF" />
            </TouchableOpacity>
            
            {selectedPost?.capa && (
              <Image source={{ uri: selectedPost.capa }} style={styles.modalImg} />
            )}
            
            <ScrollView style={styles.modalScroll}>
              {selectedPost?.tags && selectedPost.tags.length > 0 && (
                <View style={styles.tagContainer}>
                  {selectedPost.tags.map((tag: string, index: number) => (
                    <View key={index} style={styles.tagChip}><Text style={styles.tagText}>{tag}</Text></View>
                  ))}
                </View>
              )}

              <Text style={styles.modalTitle}>{selectedPost?.titulo}</Text>
              
              {selectedPost?.subtitulo && (
                <Text style={styles.modalSub}>{selectedPost?.subtitulo}</Text>
              )}
              
              <View style={styles.postMetaRow}>
                <Text style={styles.txtMeta}>Por: <Text style={{fontWeight: 'bold', color: '#1A1A2E'}}>{selectedPost?.autor || "Gestão"}</Text></Text>
                {selectedPost?.visualizacoes !== undefined && (
                  <Text style={styles.txtMeta}><Ionicons name="eye" size={14} /> {selectedPost?.visualizacoes}</Text>
                )}
              </View>

              <View style={styles.divider} />
              <Text style={styles.modalDesc}>{selectedPost?.conteudo}</Text>
              <View style={{height: 40}} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* 4. SIDEBAR */}
      {menuAberto && (
        <View style={styles.overlayContainer}>
          <TouchableWithoutFeedback onPress={fecharMenu}><View style={styles.overlayBg} /></TouchableWithoutFeedback>
          <Animated.View style={[styles.sidebar, { transform: [{ translateX: slideAnim }] }]}>
            <View style={styles.sidebarHeader}>
              <Text style={styles.sidebarLogo}>MENU <Text style={{color: '#E91E63'}}>JUMO</Text></Text>
              <TouchableOpacity onPress={fecharMenu}><MaterialIcons name="close" size={30} color="white" /></TouchableOpacity>
            </View>
            <View style={styles.sidebarContent}>
              <SidebarItem icon="person" title="Meu Perfil" rota="Perfil" navigation={navigation} fechar={fecharMenu} />
              {isSuperAdmin && <SidebarItem icon="shield" title="Gestão de Membros" rota="GerenciarUsuarios" navigation={navigation} fechar={fecharMenu} destaque />}
              <SidebarItem icon="people" title="Buscar Alunos" rota="BuscarUsuarios" navigation={navigation} fechar={fecharMenu} />
              <SidebarItem icon="chatbubble-ellipses" title="Chat" rota="Chat" navigation={navigation} fechar={fecharMenu} />
              <SidebarItem icon="heart" title="Match" rota="Match" navigation={navigation} fechar={fecharMenu} />
            </View>
            <Text style={styles.versionText}>v2.0.0 - Jumo Posts</Text>
          </Animated.View>
        </View>
      )}
    </SafeAreaView>
  );
}

const SidebarItem = ({ icon, title, rota, navigation, fechar, destaque }: any) => (
  <TouchableOpacity 
    style={[styles.sidebarBtn, destaque && { backgroundColor: '#2D2D5A', borderWidth: 1, borderColor: '#E91E63' }]} 
    onPress={() => { fechar(); if(rota) navigation.navigate(rota); }}
  >
    <Ionicons name={icon} size={22} color={destaque ? "#00A8FF" : "#E91E63"} />
    <Text style={styles.sidebarBtnText}>{title}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF', height: '100%', },
  padraoContainer: { paddingHorizontal: 20 },
  navbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, height: 70, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  navRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  btnEditMode: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#E91E63' },
  logo: { fontSize: 24, fontWeight: '900', color: '#1A1A2E' },
  topProfile: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#F0F0F0', overflow: 'hidden', borderWidth: 2, borderColor: '#E91E63' },
  imgProfile: { width: '100%', height: '100%' },
  avatarPlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  iniciais: { color: '#E91E63', fontWeight: 'bold' },
  welcomeHeader: { marginTop: 20, marginBottom: 20 },
  txtSaudacao: { fontSize: 26, fontWeight: '900', color: '#1A1A2E' },
  txtSub: { fontSize: 14, color: '#777' },
  cardHero: { width: '100%', height: 140, backgroundColor: '#1A1A2E', borderRadius: 25, overflow: 'hidden', flexDirection: 'row', marginBottom: 30 },
  heroContent: { flex: 1, padding: 25, justifyContent: 'center' },
  badgeNews: { backgroundColor: '#E91E63', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, alignSelf: 'flex-start' },
  badgeText: { fontSize: 10, fontWeight: '900', color: '#FFF' },
  heroTitle: { color: 'white', fontSize: 18, fontWeight: 'bold', marginTop: 10 },
  heroImg: { width: '45%', height: '100%', opacity: 0.7 },
  sectionContainer: { marginBottom: 30 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingRight: 20, marginBottom: 15 },
  sectionTitle: { fontSize: 18, fontWeight: '900', color: '#1A1A2E', marginLeft: 20 },
  btnAddPost: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E91E63', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  txtAddPost: { color: '#FFF', fontWeight: 'bold', fontSize: 12, marginLeft: 4 },
  popupCard: { width: 140, height: 180, backgroundColor: '#FFF', borderRadius: 22, marginRight: 15, elevation: 4, overflow: 'hidden', borderWidth: 1, borderColor: '#F0F0F0' },
  cardEditavel: { borderColor: '#E91E63', borderWidth: 2, backgroundColor: '#FFF0F5' },
  popupImg: { width: '100%', height: 105, backgroundColor: '#EEE' },
  emptyCard: { width: '100%', height: 105, backgroundColor: '#F8F9FA', justifyContent: 'center', alignItems: 'center' },
  popupInfo: { padding: 10, flex: 1, justifyContent: 'space-between' },
  popupTitle: { fontSize: 12, fontWeight: '800', color: '#333' },
  txtViews: { fontSize: 10, color: '#999', marginTop: 5 },
  editBadge: { position: 'absolute', top: 8, right: 8, backgroundColor: '#E91E63', width: 22, height: 22, borderRadius: 11, justifyContent: 'center', alignItems: 'center' },
  emptySecao: { padding: 20, backgroundColor: '#F8F9FA', borderRadius: 15, marginRight: 20 },
  txtEmpty: { color: '#888', fontStyle: 'italic' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'flex-end' },
  modalContent: { width: '100%', height: height * 0.85, backgroundColor: '#FFF', borderTopLeftRadius: 35, borderTopRightRadius: 35, overflow: 'hidden' },
  closeModal: { position: 'absolute', top: 20, right: 20, zIndex: 10, backgroundColor: 'rgba(0,0,0,0.5)', padding: 10, borderRadius: 30 },
  modalImg: { width: '100%', height: 250 },
  modalScroll: { padding: 30 },
  tagContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 15 },
  tagChip: { backgroundColor: '#FFF0F5', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 15, borderWidth: 1, borderColor: '#E91E63' },
  tagText: { color: '#E91E63', fontSize: 12, fontWeight: 'bold' },
  modalTitle: { fontSize: 24, fontWeight: '900', color: '#1A1A2E' },
  modalSub: { fontSize: 16, color: '#666', marginTop: 10, fontStyle: 'italic' },
  postMetaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 15 },
  txtMeta: { fontSize: 13, color: '#777' },
  divider: { height: 4, width: 50, backgroundColor: '#E91E63', marginVertical: 20, borderRadius: 2 },
  modalDesc: { fontSize: 16, color: '#444', lineHeight: 26 },
  btnLogout: { marginVertical: 20, padding: 20, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' },
  btnLogoutText: { color: '#FF5252', fontWeight: 'bold' },
  overlayContainer: { position: 'absolute', width: '100%', height: '100%', zIndex: 100 },
  overlayBg: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.75)' },
  sidebar: { width: 300, height: '100%', backgroundColor: '#1A1A2E', padding: 30 },
  sidebarHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 40 },
  sidebarLogo: { color: 'white', fontWeight: '900', fontSize: 22 },
  sidebarContent: { gap: 15 },
  sidebarBtn: { flexDirection: 'row', alignItems: 'center', padding: 15, backgroundColor: '#252542', borderRadius: 18, gap: 15 },
  sidebarBtnText: { color: 'white', fontWeight: 'bold' },
  versionText: { color: '#444', fontSize: 11, textAlign: 'center', position: 'absolute', bottom: 30, width: '100%' }
});