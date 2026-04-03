import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, Text, View, Image, TouchableOpacity, 
  TextInput, ScrollView, Alert, ActivityIndicator, 
  SafeAreaView, ImageBackground, Platform 
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { auth, db } from '../config/firebaseConfig';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { MaterialIcons, Ionicons, FontAwesome5 } from '@expo/vector-icons';

const BANNERS_LAB = [
  'https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=500',
  'https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=500',
  'https://images.unsplash.com/photo-1614850523296-d8c1af93d400?q=80&w=500',
  'https://images.unsplash.com/photo-1531297484001-80022131f5a1?q=80&w=500'
];

export default function Perfil({ navigation }: any) {
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [userData, setUserData] = useState<any>(null);
  
  const [bio, setBio] = useState('');
  const [fotoBase64, setFotoBase64] = useState<string | null>(null);
  
  const [originalBio, setOriginalBio] = useState('');
  const [originalFoto, setOriginalFoto] = useState<string | null>(null);
  const [bannerSorteado, setBannerSorteado] = useState('');

  const hasChanges = bio !== originalBio || fotoBase64 !== originalFoto;

  useEffect(() => {
    const randomIdx = Math.floor(Math.random() * BANNERS_LAB.length);
    setBannerSorteado(BANNERS_LAB[randomIdx]);

    const carregarMeusDados = async () => {
      try {
        const meuUid = auth.currentUser?.uid;
        if (!meuUid) return;

        const docRef = doc(db, "usuarios", meuUid);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data();
          setUserData(data);
          setBio(data.bio || '');
          setOriginalBio(data.bio || '');
          setFotoBase64(data.foto || null);
          setOriginalFoto(data.foto || null);
        }
      } catch (error) {
        Alert.alert("Erro", "Erro ao carregar seu perfil.");
      } finally {
        setLoading(false);
      }
    };
    carregarMeusDados();
  }, []);

  const trocarFoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return Alert.alert("Aviso", "Acesso negado.");
    
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [1, 1], quality: 0.2, base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      setFotoBase64(`data:image/jpeg;base64,${result.assets[0].base64}`); 
    }
  };

  const salvarAlteracoes = async () => {
    setUpdating(true);
    try {
      const meuUid = auth.currentUser?.uid;
      if (!meuUid) return;

      await updateDoc(doc(db, "usuarios", meuUid), { 
        foto: fotoBase64, bio: bio.trim() 
      });
      setOriginalBio(bio.trim());
      setOriginalFoto(fotoBase64);
      Alert.alert("Sucesso!", "Seu perfil foi atualizado.");
    } catch (e) {
      Alert.alert("Erro", "Falha ao salvar alterações.");
    } finally {
      setUpdating(false);
    }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#E91E63" /></View>;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        
        {/* HEADER COM BANNER */}
        <ImageBackground source={{ uri: bannerSorteado }} style={styles.bannerHeader}>
          <View style={styles.overlayBanner} />
          <View style={styles.topNav}>
            <TouchableOpacity style={styles.btnBack} onPress={() => navigation.goBack()}>
              <Ionicons name="arrow-back" size={24} color="#1A1A2E" />
            </TouchableOpacity>
            <Text style={styles.topTitle}>Meu Perfil</Text>
            <View style={{ width: 40 }} />
          </View>
        </ImageBackground>

        {/* CARD PRINCIPAL (Sempre editável) */}
        <View style={styles.profileHeaderCard}>
          <View style={styles.avatarWrapper}>
            <View style={[styles.avatarBorder, userData?.tipo === 'Gremista' && {borderColor: '#E91E63'}]}>
              {fotoBase64 ? (
                <Image source={{ uri: fotoBase64 }} style={styles.avatarImg} />
              ) : (
                <View style={styles.placeholderAvatar}><MaterialIcons name="person" size={60} color="#CCC" /></View>
              )}
            </View>
            <TouchableOpacity onPress={trocarFoto} style={styles.btnCamera}>
              <MaterialIcons name="camera-alt" size={18} color="#FFF" />
            </TouchableOpacity>
          </View>

          <Text style={styles.userName}>{userData?.nome_completo || 'Usuário'}</Text>
          <Text style={styles.userEmail}>{userData?.email_escolar}</Text>
          
          <View style={styles.badgesContainer}>
            {userData?.tipo === 'Gremista' && (
              <View style={[styles.badge, {backgroundColor: '#FFF0F5', borderColor: '#E91E63'}]}>
                <MaterialIcons name="verified" size={14} color="#E91E63" />
                <Text style={[styles.txtBadge, {color: '#E91E63'}]}>GRÊMIO</Text>
              </View>
            )}
            {userData?.tipo === 'Administrador' && (
              <View style={[styles.badge, {backgroundColor: '#E3F2FD', borderColor: '#2196F3'}]}>
                <MaterialIcons name="admin-panel-settings" size={14} color="#2196F3" />
                <Text style={[styles.txtBadge, {color: '#2196F3'}]}>ADMIN</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.contentSection}>
          
          {/* BARRA DE SALVAR (FLUTUANTE QUANDO HÁ MUDANÇAS) */}
          {hasChanges && (
            <View style={styles.actionRow}>
              <Text style={styles.actionTitle}>Alterações não salvas</Text>
              <View style={styles.actionButtons}>
                <TouchableOpacity style={styles.btnReverter} onPress={() => {setBio(originalBio); setFotoBase64(originalFoto);}}>
                  <MaterialIcons name="close" size={20} color="#FF5252" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.btnSalvar} onPress={salvarAlteracoes} disabled={updating}>
                  {updating ? <ActivityIndicator size="small" color="#FFF" /> : <MaterialIcons name="check" size={20} color="#FFF" />}
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* CARD SOBRE MIM (INPUT CLEAN) */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
                <MaterialIcons name="notes" size={20} color="#1A1A2E" />
                <Text style={styles.cardTitle}>Sobre mim</Text>
              </View>
              <MaterialIcons name="edit" size={16} color="#A0AEC0" />
            </View>
            <TextInput 
              style={styles.bioInputEditable}
              value={bio} 
              onChangeText={setBio} 
              multiline 
              scrollEnabled={false}
              placeholder="Escreva algo sobre você..." 
              placeholderTextColor="#A0AEC0"
            />
          </View>

          {/* CARD ACADÊMICO */}
          <View style={styles.card}>
            <Text style={[styles.cardTitle, {marginBottom: 15}]}>Informações Acadêmicas</Text>
            <View style={styles.schoolDetailsRow}>
              <View style={styles.schoolDetailBox}>
                <Text style={styles.schoolLabel}>TURMA</Text>
                <Text style={styles.schoolValue}>{userData?.turma || '---'}</Text>
              </View>
              <View style={styles.schoolDivider} />
              <View style={styles.schoolDetailBox}>
                <Text style={styles.schoolLabel}>RA</Text>
                <Text style={styles.schoolValue}>{userData?.ra || '---'}</Text>
              </View>
            </View>
          </View>

          {/* ESTATÍSTICAS */}
          <View style={styles.card}>
            <View style={styles.statHeader}>
              <FontAwesome5 name="hands-helping" size={20} color="#E91E63" />
              <View>
                <Text style={styles.statValue}>{userData?.ajudas_realizadas || 0}</Text>
                <Text style={styles.statLabel}>Ajudas Concluídas</Text>
              </View>
            </View>
          </View>

          <TouchableOpacity style={styles.btnLogOut} onPress={() => auth.signOut()}>
            <MaterialIcons name="logout" size={20} color="#FF5252" />
            <Text style={styles.txtLogOut}>Sair da Conta</Text>
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
  btnCamera: { position: 'absolute', bottom: 0, right: 0, backgroundColor: '#E91E63', width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#FFF' },
  userName: { fontSize: 20, fontWeight: 'bold', color: '#1A1A2E' },
  userEmail: { fontSize: 13, color: '#6B7280' },
  badgesContainer: { flexDirection: 'row', gap: 10, marginTop: 10 },
  badge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, gap: 4, borderWidth: 1 },
  txtBadge: { fontSize: 10, fontWeight: 'bold' },
  contentSection: { padding: 20 },
  actionRow: { flexDirection: 'row', backgroundColor: '#1A1A2E', borderRadius: 12, padding: 15, alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  actionTitle: { color: '#FFF', fontWeight: 'bold', fontSize: 13 },
  actionButtons: { flexDirection: 'row', gap: 10 },
  btnReverter: { backgroundColor: 'rgba(255,82,82,0.2)', padding: 8, borderRadius: 10 },
  btnSalvar: { backgroundColor: '#E91E63', padding: 8, borderRadius: 10 },
  card: { backgroundColor: '#FFF', borderRadius: 16, padding: 20, marginBottom: 15, elevation: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  cardTitle: { fontSize: 15, fontWeight: 'bold', color: '#1A1A2E' },
  bioInputEditable: { color: '#4A5568', fontSize: 15, lineHeight: 22, padding: 0, marginTop: 5 },
  schoolDetailsRow: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 5 },
  schoolDetailBox: { alignItems: 'center', flex: 1 },
  schoolLabel: { fontSize: 10, color: '#A0AEC0', fontWeight: '800', letterSpacing: 1, marginBottom: 4 },
  schoolValue: { fontSize: 18, color: '#1A1A2E', fontWeight: 'bold' },
  schoolDivider: { width: 1, height: 30, backgroundColor: '#EDF2F7' },
  statHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  statValue: { fontSize: 20, fontWeight: 'bold', color: '#1A1A2E' },
  statLabel: { fontSize: 12, color: '#6B7280' },
  btnLogOut: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 20, marginTop: 10 },
  txtLogOut: { color: '#FF5252', fontWeight: 'bold' }
});