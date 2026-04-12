import React, { useState, useEffect } from 'react';
import {
  StyleSheet, Text, View, Image, TouchableOpacity,
  TextInput, ScrollView, Alert, ActivityIndicator,
  SafeAreaView, ImageBackground, Platform, Modal, FlatList
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { db } from '../config/firebaseConfig';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { MaterialIcons, Ionicons, FontAwesome5 } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CORES = {
  azulEscuro: '#0B2046',
  rosa:        '#E51C6A',
  amarelo:     '#FFC82C',
  verde:       '#10B981',
  fundo:       '#F4F6F8',
  branco:      '#FFFFFF',
  cinzaClaro:  '#EDF2F7',
  textoSec:    '#8D99AE',
};

const BANNERS = [
  'https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=500',
  'https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=500',
  'https://images.unsplash.com/photo-1614850523296-d8c1af93d400?q=80&w=500',
  'https://images.unsplash.com/photo-1531297484001-80022131f5a1?q=80&w=500',
];

const MATERIAS = [
  // Linguagens
  { grupo: 'Linguagens',          nome: 'Português'   },
  { grupo: 'Linguagens',          nome: 'Literatura'  },
  { grupo: 'Linguagens',          nome: 'Inglês'      },
  { grupo: 'Linguagens',          nome: 'Artes'       },
  // Matemática
  { grupo: 'Matemática',          nome: 'Matemática'  },
  // Ciências da Natureza
  { grupo: 'Ciências da Natureza', nome: 'Física'     },
  { grupo: 'Ciências da Natureza', nome: 'Química'    },
  { grupo: 'Ciências da Natureza', nome: 'Biologia'   },
  // Ciências Humanas
  { grupo: 'Ciências Humanas',    nome: 'História'    },
  { grupo: 'Ciências Humanas',    nome: 'Geografia'   },
  { grupo: 'Ciências Humanas',    nome: 'Filosofia'   },
  { grupo: 'Ciências Humanas',    nome: 'Sociologia'  },
];

const GRUPOS = [...new Set(MATERIAS.map(m => m.grupo))];

// ─── Chip de matéria com X ────────────────────────────────
const Chip = ({ label, cor, onRemove }: any) => (
  <View style={[styles.chip, { backgroundColor: cor + '18', borderColor: cor + '40' }]}>
    <Text style={[styles.chipText, { color: cor }]}>{label}</Text>
    <TouchableOpacity onPress={onRemove} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
      <Ionicons name="close-circle" size={16} color={cor} />
    </TouchableOpacity>
  </View>
);

// ─── Modal de seleção de matérias ────────────────────────
const ModalMaterias = ({ visible, titulo, cor, selecionadas, onToggle, onClose }: any) => (
  <Modal visible={visible} transparent animationType="slide">
    <View style={styles.modalOverlay}>
      <View style={styles.modalSheet}>
        <View style={styles.modalHandle} />
        <Text style={styles.modalTitulo}>{titulo}</Text>
        <Text style={styles.modalSub}>Toque para adicionar ou remover</Text>
        <ScrollView showsVerticalScrollIndicator={false}>
          {GRUPOS.map(grupo => (
            <View key={grupo}>
              <Text style={styles.grupoLabel}>{grupo}</Text>
              <View style={styles.grupoChips}>
                {MATERIAS.filter(m => m.grupo === grupo).map(m => {
                  const selecionada = selecionadas.includes(m.nome);
                  return (
                    <TouchableOpacity
                      key={m.nome}
                      style={[
                        styles.chipOpcao,
                        selecionada && { backgroundColor: cor, borderColor: cor }
                      ]}
                      onPress={() => onToggle(m.nome)}
                    >
                      {selecionada && (
                        <Ionicons name="checkmark" size={13} color="#FFF" />
                      )}
                      <Text style={[styles.chipOpcaoText, selecionada && { color: '#FFF' }]}>
                        {m.nome}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ))}
          <View style={{ height: 20 }} />
        </ScrollView>
        <TouchableOpacity style={[styles.btnFechar, { backgroundColor: cor }]} onPress={onClose}>
          <Text style={styles.btnFecharText}>Confirmar</Text>
        </TouchableOpacity>
      </View>
    </View>
  </Modal>
);

// ─── Tela principal ───────────────────────────────────────
export default function Perfil({ navigation, route }: any) {
  const [loading,      setLoading]      = useState(true);
  const [updating,     setUpdating]     = useState(false);
  const [userData,     setUserData]     = useState<any>(null);
  const [bio,          setBio]          = useState('');
  const [fotoBase64,   setFotoBase64]   = useState<string | null>(null);
  const [originalBio,  setOriginalBio]  = useState('');
  const [originalFoto, setOriginalFoto] = useState<string | null>(null);
  const [banner,       setBanner]       = useState('');

  const [ensinar,  setEnsinar]  = useState<string[]>([]);
  const [melhorar, setMelhorar] = useState<string[]>([]);
  const [originalEnsinar,  setOriginalEnsinar]  = useState<string[]>([]);
  const [originalMelhorar, setOriginalMelhorar] = useState<string[]>([]);

  const [modalEnsinar,  setModalEnsinar]  = useState(false);
  const [modalMelhorar, setModalMelhorar] = useState(false);

  const hasChanges =
    bio !== originalBio ||
    fotoBase64 !== originalFoto ||
    JSON.stringify(ensinar)  !== JSON.stringify(originalEnsinar) ||
    JSON.stringify(melhorar) !== JSON.stringify(originalMelhorar);

  useEffect(() => {
    setBanner(BANNERS[Math.floor(Math.random() * BANNERS.length)]);
    const carregar = async () => {
      try {
        const uid = route?.params?.uid;
        if (!uid) { Alert.alert('Erro', 'Usuário não identificado.'); return; }
        const snap = await getDoc(doc(db, 'usuarios', uid));
        if (snap.exists()) {
          const d = snap.data();
          setUserData({ ...d, uid });
          setBio(d.bio || '');            setOriginalBio(d.bio || '');
          setFotoBase64(d.foto || null);  setOriginalFoto(d.foto || null);
          setEnsinar(d.ensinar  || []);   setOriginalEnsinar(d.ensinar  || []);
          setMelhorar(d.melhorar || []);  setOriginalMelhorar(d.melhorar || []);
        }
      } catch { Alert.alert('Erro', 'Erro ao carregar perfil.'); }
      finally  { setLoading(false); }
    };
    carregar();
  }, []);

  const trocarFoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return Alert.alert('Aviso', 'Acesso negado.');
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [1, 1], quality: 0.2, base64: true,
    });
    if (!result.canceled && result.assets[0].base64) {
      setFotoBase64(`data:image/jpeg;base64,${result.assets[0].base64}`);
    }
  };

  const salvar = async () => {
    setUpdating(true);
    try {
      const uid = userData?.uid;
      if (!uid) return;
      await updateDoc(doc(db, 'usuarios', uid), {
        foto:     fotoBase64,
        bio:      bio.trim(),
        ensinar,
        melhorar,
      });
      setOriginalBio(bio.trim());
      setOriginalFoto(fotoBase64);
      setOriginalEnsinar([...ensinar]);
      setOriginalMelhorar([...melhorar]);
      Alert.alert('Sucesso!', 'Perfil atualizado.');
    } catch { Alert.alert('Erro', 'Falha ao salvar.'); }
    finally  { setUpdating(false); }
  };

  const reverter = () => {
    setBio(originalBio);
    setFotoBase64(originalFoto);
    setEnsinar([...originalEnsinar]);
    setMelhorar([...originalMelhorar]);
  };

  const toggleEnsinar  = (m: string) =>
    setEnsinar(prev  => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]);
  const toggleMelhorar = (m: string) =>
    setMelhorar(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]);

  const handleSair = async () => {
    await AsyncStorage.removeItem('uid');
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
  };

  if (loading) return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={CORES.rosa} />
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 50 }}>

        {/* BANNER */}
        <ImageBackground source={{ uri: banner }} style={styles.banner}>
          <View style={styles.bannerOverlay} />
          <View style={styles.topNav}>
            <TouchableOpacity style={styles.btnBack} onPress={() => navigation.goBack()}>
              <Ionicons name="arrow-back" size={22} color={CORES.azulEscuro} />
            </TouchableOpacity>
            <Text style={styles.topTitle}>Meu Perfil</Text>
            <View style={{ width: 38 }} />
          </View>
        </ImageBackground>

        {/* CARD PRINCIPAL */}
        <View style={styles.cardPrincipal}>
          <View style={styles.avatarWrap}>
            <View style={styles.avatarBorda}>
              {fotoBase64
                ? <Image source={{ uri: fotoBase64 }} style={styles.avatarImg} />
                : <View style={styles.avatarPlaceholder}>
                    <MaterialIcons name="person" size={52} color="#CCC" />
                  </View>
              }
            </View>
            <TouchableOpacity style={styles.btnCamera} onPress={trocarFoto}>
              <MaterialIcons name="camera-alt" size={16} color="#FFF" />
            </TouchableOpacity>
          </View>

          <Text style={styles.userName}>{userData?.nome_completo || 'Usuário'}</Text>
          <Text style={styles.userEmail}>{userData?.email_escolar}</Text>

          {/* BADGES */}
          <View style={styles.badgesRow}>
            {userData?.tipo === 'Administrador' && (
              <View style={[styles.badge, { backgroundColor: '#E3F2FD', borderColor: '#2196F3' }]}>
                <MaterialIcons name="admin-panel-settings" size={13} color="#2196F3" />
                <Text style={[styles.badgeText, { color: '#2196F3' }]}>ADMIN</Text>
              </View>
            )}
            {userData?.tipo === 'Gremista' && (
              <View style={[styles.badge, { backgroundColor: '#FFF0F5', borderColor: CORES.rosa }]}>
                <MaterialIcons name="verified" size={13} color={CORES.rosa} />
                <Text style={[styles.badgeText, { color: CORES.rosa }]}>GRÊMIO</Text>
              </View>
            )}
            {ensinar.length > 0 && (
              <View style={[styles.badge, { backgroundColor: '#ECFDF5', borderColor: CORES.verde }]}>
                <Ionicons name="school" size={13} color={CORES.verde} />
                <Text style={[styles.badgeText, { color: CORES.verde }]}>TUTOR</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.secoes}>

          {/* BARRA SALVAR */}
          {hasChanges && (
            <View style={styles.barraSalvar}>
              <View style={styles.barraSalvarLeft}>
                <View style={styles.dotAlerta} />
                <Text style={styles.barraSalvarText}>Alterações não salvas</Text>
              </View>
              <View style={styles.barraSalvarBtns}>
                <TouchableOpacity style={styles.btnReverter} onPress={reverter}>
                  <Ionicons name="close" size={18} color="#FF5252" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.btnSalvar} onPress={salvar} disabled={updating}>
                  {updating
                    ? <ActivityIndicator size="small" color="#FFF" />
                    : <Ionicons name="checkmark" size={18} color="#FFF" />
                  }
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* BIO */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderLeft}>
                <MaterialIcons name="notes" size={18} color={CORES.azulEscuro} />
                <Text style={styles.cardTitulo}>Sobre mim</Text>
              </View>
              <MaterialIcons name="edit" size={15} color={CORES.textoSec} />
            </View>
            <TextInput
              style={styles.bioInput}
              value={bio}
              onChangeText={setBio}
              multiline
              scrollEnabled={false}
              placeholder="Escreva algo sobre você..."
              placeholderTextColor={CORES.textoSec}
            />
          </View>

          {/* ENSINAR */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderLeft}>
                <Ionicons name="school" size={18} color={CORES.verde} />
                <Text style={styles.cardTitulo}>Posso ensinar</Text>
              </View>
              <TouchableOpacity
                style={[styles.btnAddMateria, { backgroundColor: CORES.verde + '18' }]}
                onPress={() => setModalEnsinar(true)}
              >
                <Ionicons name="add" size={16} color={CORES.verde} />
                <Text style={[styles.btnAddMateriaText, { color: CORES.verde }]}>Adicionar</Text>
              </TouchableOpacity>
            </View>
            {ensinar.length > 0
              ? <View style={styles.chipsWrap}>
                  {ensinar.map(m => (
                    <Chip
                      key={m}
                      label={m}
                      cor={CORES.verde}
                      onRemove={() => toggleEnsinar(m)}
                    />
                  ))}
                </View>
              : <Text style={styles.emptyMateria}>
                  Nenhuma matéria adicionada ainda.
                </Text>
            }
          </View>

          {/* MELHORAR */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderLeft}>
                <Ionicons name="trending-up" size={18} color={CORES.rosa} />
                <Text style={styles.cardTitulo}>Quero melhorar</Text>
              </View>
              <TouchableOpacity
                style={[styles.btnAddMateria, { backgroundColor: CORES.rosa + '18' }]}
                onPress={() => setModalMelhorar(true)}
              >
                <Ionicons name="add" size={16} color={CORES.rosa} />
                <Text style={[styles.btnAddMateriaText, { color: CORES.rosa }]}>Adicionar</Text>
              </TouchableOpacity>
            </View>
            {melhorar.length > 0
              ? <View style={styles.chipsWrap}>
                  {melhorar.map(m => (
                    <Chip
                      key={m}
                      label={m}
                      cor={CORES.rosa}
                      onRemove={() => toggleMelhorar(m)}
                    />
                  ))}
                </View>
              : <Text style={styles.emptyMateria}>
                  Nenhuma matéria adicionada ainda.
                </Text>
            }
          </View>

          {/* ACADÊMICO */}
          <View style={styles.card}>
            <Text style={styles.cardTitulo}>Informações Acadêmicas</Text>
            <View style={styles.academicRow}>
              <View style={styles.academicBox}>
                <Text style={styles.academicLabel}>TURMA</Text>
                <Text style={styles.academicValue}>{userData?.turma || '---'}</Text>
              </View>
              <View style={styles.academicDivider} />
              <View style={styles.academicBox}>
                <Text style={styles.academicLabel}>RA</Text>
                <Text style={styles.academicValue}>{userData?.ra || '---'}</Text>
              </View>
              <View style={styles.academicDivider} />
              <View style={styles.academicBox}>
                <Text style={styles.academicLabel}>AJUDAS</Text>
                <Text style={styles.academicValue}>{userData?.ajudas_realizadas || 0}</Text>
              </View>
            </View>
          </View>

          {/* LOGOUT */}
          <TouchableOpacity style={styles.btnLogout} onPress={handleSair}>
            <Ionicons name="log-out-outline" size={20} color="#FF5252" />
            <Text style={styles.btnLogoutText}>Sair da conta</Text>
          </TouchableOpacity>

        </View>
      </ScrollView>

      {/* MODAIS */}
      <ModalMaterias
        visible={modalEnsinar}
        titulo="Posso ensinar"
        cor={CORES.verde}
        selecionadas={ensinar}
        onToggle={toggleEnsinar}
        onClose={() => setModalEnsinar(false)}
      />
      <ModalMaterias
        visible={modalMelhorar}
        titulo="Quero melhorar"
        cor={CORES.rosa}
        selecionadas={melhorar}
        onToggle={toggleMelhorar}
        onClose={() => setModalMelhorar(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:         { flex: 1, backgroundColor: CORES.fundo },
  center:            { flex: 1, justifyContent: 'center', alignItems: 'center' },
  banner:            { width: '100%', height: 155 },
  bannerOverlay:     { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.35)' },
  topNav:            { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 36 },
  btnBack:           { backgroundColor: CORES.branco, padding: 8, borderRadius: 20 },
  topTitle:          { color: CORES.branco, fontSize: 17, fontWeight: '800' },

  cardPrincipal:     { backgroundColor: CORES.branco, marginHorizontal: 20, marginTop: -44, borderRadius: 24, padding: 22, alignItems: 'center', elevation: 6, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 10 },
  avatarWrap:        { position: 'relative', marginTop: -62, marginBottom: 12 },
  avatarBorda:       { width: 96, height: 96, borderRadius: 48, borderWidth: 4, borderColor: CORES.branco, overflow: 'hidden', backgroundColor: CORES.cinzaClaro, elevation: 4 },
  avatarImg:         { width: '100%', height: '100%' },
  avatarPlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  btnCamera:         { position: 'absolute', bottom: 0, right: 0, backgroundColor: CORES.rosa, width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: CORES.branco },
  userName:          { fontSize: 20, fontWeight: '900', color: CORES.azulEscuro, letterSpacing: -0.3 },
  userEmail:         { fontSize: 13, color: CORES.textoSec, marginTop: 3, fontWeight: '500' },
  badgesRow:         { flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap', justifyContent: 'center' },
  badge:             { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, borderWidth: 1 },
  badgeText:         { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },

  secoes:            { padding: 18, gap: 14 },

  barraSalvar:       { flexDirection: 'row', backgroundColor: CORES.azulEscuro, borderRadius: 16, padding: 14, alignItems: 'center', justifyContent: 'space-between' },
  barraSalvarLeft:   { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dotAlerta:         { width: 8, height: 8, borderRadius: 4, backgroundColor: CORES.amarelo },
  barraSalvarText:   { color: CORES.branco, fontWeight: '700', fontSize: 13 },
  barraSalvarBtns:   { flexDirection: 'row', gap: 8 },
  btnReverter:       { backgroundColor: 'rgba(255,82,82,0.15)', padding: 8, borderRadius: 10 },
  btnSalvar:         { backgroundColor: CORES.rosa, padding: 8, borderRadius: 10 },

  card:              { backgroundColor: CORES.branco, borderRadius: 20, padding: 18, elevation: 2, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6 },
  cardHeader:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  cardHeaderLeft:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitulo:        { fontSize: 15, fontWeight: '800', color: CORES.azulEscuro },
  bioInput:          { color: '#4A5568', fontSize: 15, lineHeight: 22, padding: 0, minHeight: 60 },

  btnAddMateria:     { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  btnAddMateriaText: { fontSize: 12, fontWeight: '800' },
  chipsWrap:         { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip:              { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  chipText:          { fontSize: 13, fontWeight: '700' },
  emptyMateria:      { fontSize: 13, color: CORES.textoSec, fontStyle: 'italic' },

  academicRow:       { flexDirection: 'row', justifyContent: 'space-around', marginTop: 14 },
  academicBox:       { alignItems: 'center', flex: 1 },
  academicLabel:     { fontSize: 10, color: CORES.textoSec, fontWeight: '800', letterSpacing: 1, marginBottom: 4 },
  academicValue:     { fontSize: 18, color: CORES.azulEscuro, fontWeight: '900' },
  academicDivider:   { width: 1, height: 32, backgroundColor: CORES.cinzaClaro },

  btnLogout:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 18 },
  btnLogoutText:     { color: '#FF5252', fontWeight: '800', fontSize: 15 },

  modalOverlay:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet:        { backgroundColor: CORES.branco, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, maxHeight: '80%' },
  modalHandle:       { width: 40, height: 4, backgroundColor: CORES.cinzaClaro, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  modalTitulo:       { fontSize: 18, fontWeight: '900', color: CORES.azulEscuro, marginBottom: 4 },
  modalSub:          { fontSize: 13, color: CORES.textoSec, marginBottom: 20, fontWeight: '500' },
  grupoLabel:        { fontSize: 11, fontWeight: '900', color: CORES.textoSec, letterSpacing: 1, marginTop: 16, marginBottom: 10 },
  grupoChips:        { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chipOpcao:         { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: CORES.cinzaClaro, backgroundColor: CORES.fundo },
  chipOpcaoText:     { fontSize: 13, fontWeight: '700', color: CORES.azulEscuro },
  btnFechar:         { borderRadius: 16, paddingVertical: 15, alignItems: 'center', marginTop: 20 },
  btnFecharText:     { color: CORES.branco, fontWeight: '900', fontSize: 15 },
});