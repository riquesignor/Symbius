import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, Text, View, Image, TouchableOpacity, 
  SafeAreaView, ActivityIndicator, ScrollView, Alert, ImageBackground 
} from 'react-native';
import { doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../config/firebaseConfig'; 
import { Ionicons, FontAwesome5, MaterialIcons } from '@expo/vector-icons'; 



export default function PerfilPublico({ route, navigation }: any) {
  const userId = route?.params?.userId; 
  
  const [usuario, setUsuario] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const carregarPerfil = async () => {
      try {
        const docRef = doc(db, "usuarios", userId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          setUsuario(docSnap.data());
        } else {
          Alert.alert("Erro", "Usuário não encontrado.");
          navigation.goBack();
        }
      } catch (error) {
        console.log("Erro ao buscar perfil:", error);
      } finally {
        setLoading(false);
      }
    };
    carregarPerfil();
  }, [userId]);

  const handleIniciarConversa = () => {
    const seuUid = auth.currentUser?.uid;
    
    if (!seuUid) {
      Alert.alert("Erro", "Você precisa estar logado para conversar.");
      return;
    }

    if (!usuario) {
      Alert.alert("Aguarde", "Carregando dados do perfil...");
      return;
    }

    try {
      const IDs = [seuUid, userId].sort();
      const roomID = `${IDs[0]}_${IDs[1]}`;

      navigation.navigate('Chat', { 
        room: roomID, 
        outroUid: userId, 
        outroNome: usuario?.nome_completo || "Usuário",
        outroFoto: usuario?.foto || null
      });
    } catch (error) {
      console.error("Erro ao abrir chat:", error);
      Alert.alert("Erro", "Não foi possível abrir a conversa.");
    }
  };

  if (loading) return (
    <View style={styles.center}><ActivityIndicator size="large" color="#E91E63" /></View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        
        {/* HEADER COM BANNER */}
        <ImageBackground 
          source={{ uri: 'https://images.unsplash.com/photo-1557683316-973673baf926?q=80&w=500' }} 
          style={styles.bannerHeader}
        >
          <View style={styles.overlayBanner} />
          <View style={styles.topNav}>
            <TouchableOpacity style={styles.btnBack} onPress={() => navigation.goBack()}>
              <Ionicons name="arrow-back" size={24} color="#1A1A2E" />
            </TouchableOpacity>
            <Text style={styles.topTitle}>Perfil do Aluno</Text>
            <View style={{ width: 40 }} />
          </View>
        </ImageBackground>

        {/* CARD DE PERFIL */}
        <View style={styles.profileHeaderCard}>
          <View style={styles.avatarWrapper}>
            <View style={[styles.avatarBorder, usuario?.tipo === 'Gremista' && {borderColor: '#E91E63'}]}>
              {usuario?.foto ? (
                <Image source={{ uri: usuario.foto }} style={styles.avatarImg} />
              ) : (
                <View style={styles.placeholderAvatar}><MaterialIcons name="person" size={60} color="#CCC" /></View>
              )}
            </View>
          </View>

          <Text style={styles.userName}>{usuario?.nome_completo}</Text>
          <Text style={styles.userTurma}>{usuario?.turma ? `${usuario.turma}` : 'Estudante'}</Text>
          
          <View style={styles.badgesContainer}>
            {usuario?.tipo === 'Gremista' && (
              <View style={[styles.badge, {backgroundColor: '#FFF0F5', borderColor: '#E91E63'}]}>
                <MaterialIcons name="verified" size={14} color="#E91E63" />
                <Text style={[styles.txtBadge, {color: '#E91E63'}]}>GRÊMIO</Text>
              </View>
            )}
          </View>

          {/* BOTÕES DE AÇÃO */}
          <View style={styles.actionButtonsRow}>
            <TouchableOpacity style={styles.btnChat} onPress={handleIniciarConversa}>
              <Ionicons name="chatbubbles" size={18} color="#FFF" />
              <Text style={styles.btnTextWhite}>Conversar</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.btnAdd} onPress={() => Alert.alert("Sucesso", "Pedido enviado!")}>
              <Ionicons name="person-add" size={18} color="#1A1A2E" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.contentSection}>
          {/* BIO */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <MaterialIcons name="notes" size={20} color="#1A1A2E" />
              <Text style={styles.cardTitle}>Sobre</Text>
            </View>
            <Text style={styles.bioText}>
              {usuario?.bio || "Este aluno ainda não escreveu uma biografia."}
            </Text>
          </View>

          {/* AJUDAS E TAGS */}
          <View style={styles.card}>
            <View style={styles.statHeader}>
              <FontAwesome5 name="hands-helping" size={20} color="#E91E63" />
              <View>
                <Text style={styles.statValue}>{usuario?.ajudas_realizadas || 0}</Text>
                <Text style={styles.statLabel}>Ajudas Concluídas</Text>
              </View>
            </View>

            {usuario?.ensinar?.length > 0 && (
              <View style={styles.tagSection}>
                <div style={styles.divider} />
                <Text style={styles.labelTags}>PODE AJUDAR EM</Text>
                <View style={styles.tagWrap}>
                  {usuario.ensinar.map((item: string, i: number) => (
                    <View key={i} style={[styles.tag, {backgroundColor: '#D1FAE5'}]}>
                      <Text style={[styles.tagText, {color: '#059669'}]}>{item}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </View>

          {/* DENUNCIAR */}
          <TouchableOpacity style={styles.btnBloquear} onPress={() => Alert.alert("Denunciar", "Deseja reportar este usuário?")}>
            <MaterialIcons name="block" size={16} color="#A0AEC0" />
            <Text style={styles.txtBloquear}>Denunciar ou Bloquear</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F6F8' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  bannerHeader: { width: '100%', height: 160 },
  overlayBanner: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.3)' },
  topNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 40 },
  btnBack: { backgroundColor: 'white', padding: 8, borderRadius: 20 },
  topTitle: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  profileHeaderCard: { backgroundColor: '#FFF', marginHorizontal: 20, marginTop: -40, borderRadius: 20, padding: 20, alignItems: 'center', elevation: 4 },
  avatarWrapper: { position: 'relative', marginTop: -60, marginBottom: 10 },
  avatarBorder: { width: 100, height: 100, borderRadius: 50, borderWidth: 4, borderColor: '#FFF', overflow: 'hidden', backgroundColor: '#EEE' },
  avatarImg: { width: '100%', height: '100%' },
  placeholderAvatar: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  userName: { fontSize: 20, fontWeight: 'bold', color: '#1A1A2E' },
  userTurma: { fontSize: 14, color: '#6B7280', marginTop: 2 },
  badgesContainer: { flexDirection: 'row', gap: 10, marginTop: 8 },
  badge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, gap: 4, borderWidth: 1 },
  txtBadge: { fontSize: 10, fontWeight: 'bold' },
  actionButtonsRow: { flexDirection: 'row', marginTop: 20, gap: 10, width: '100%' },
  btnChat: { flex: 1, backgroundColor: '#E91E63', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 12, gap: 8 },
  btnAdd: { backgroundColor: '#F1F5F9', paddingHorizontal: 15, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  btnTextWhite: { color: '#FFF', fontWeight: 'bold', fontSize: 15 },
  contentSection: { padding: 20 },
  card: { backgroundColor: '#FFF', borderRadius: 16, padding: 20, marginBottom: 15, elevation: 2 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  cardTitle: { fontSize: 15, fontWeight: 'bold', color: '#1A1A2E' },
  bioText: { color: '#4A5568', fontSize: 15, lineHeight: 22 },
  statHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  statValue: { fontSize: 20, fontWeight: 'bold', color: '#1A1A2E' },
  statLabel: { fontSize: 12, color: '#6B7280' },
  divider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 15 },
  labelTags: { fontSize: 10, fontWeight: '800', color: '#A0AEC0', marginBottom: 8, letterSpacing: 0.5 },
  tagWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 15 },
  tagText: { fontSize: 11, fontWeight: 'bold' },
  btnBloquear: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 10 },
  txtBloquear: { color: '#A0AEC0', fontSize: 13, fontWeight: '600' },
  tagSection: { marginTop: 10 }
});