import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, Text, View, TextInput, FlatList, 
  TouchableOpacity, SafeAreaView, ActivityIndicator, Image 
} from 'react-native';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../config/firebaseConfig';
import { Ionicons, MaterialIcons } from '@expo/vector-icons'; 

export default function BuscarUsuarios({ navigation }: any) {
  const [busca, setBusca] = useState('');
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [filtrados, setFiltrados] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const carregarUsuarios = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "usuarios"));
        // Mapeia os usuários do banco
        const lista = querySnapshot.docs.map(doc => ({ 
          id: doc.id, 
          ...doc.data() 
        }));
        
        setUsuarios(lista);
        setFiltrados(lista);
      } catch (error) {
        console.log("Erro ao buscar usuários:", error);
      } finally {
        setLoading(false);
      }
    };
    carregarUsuarios();
  }, []);

  useEffect(() => {
    const texto = busca.toLowerCase();
    const resultado = usuarios.filter(u => 
      (u.nome_completo?.toLowerCase().includes(texto)) ||
      (u.ra?.includes(texto)) ||
      (u.turma?.toString().includes(texto))
    );
    setFiltrados(resultado);
  }, [busca, usuarios]);

  const renderUsuario = ({ item }: { item: any }) => (
    <TouchableOpacity 
      style={styles.card}
      // ATENÇÃO: Mudado para 'Perfil' e passando 'userId'
      onPress={() => navigation.navigate('PerfilPublico', { userId: item.id })}
    >
      <View style={styles.fotoContainer}>
        {item.foto ? (
          <Image source={{ uri: item.foto }} style={styles.foto} />
        ) : (
          <Ionicons name="person" size={24} color="#00A8FF" />
        )}
        {/* Badge discreta se o cara for do Grêmio na lista */}
        {item.cargo === 'gremio' && <View style={styles.dotGremio} />}
      </View>

      <View style={styles.infoContainer}>
        <Text style={styles.nome}>{item.nome_completo}</Text>
        <Text style={styles.detalhes}>
          {item.cargo === 'gremio' ? '⭐ Membro do Grêmio' : `${item.ra || 'S/RA'} • ${item.turma || '?'}º Ano`}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#CCC" />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>BUSCAR ALUNOS</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.content}>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#888" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Nome, RA ou turma..."
            value={busca}
            onChangeText={setBusca}
            placeholderTextColor="#888"
          />
        </View>

        {loading ? (
          <ActivityIndicator size="large" color="#00A8FF" style={{ marginTop: 50 }} />
        ) : (
          <FlatList
            data={filtrados}
            keyExtractor={(item) => item.id}
            renderItem={renderUsuario}
            contentContainerStyle={{ paddingBottom: 20 }}
            ListEmptyComponent={
              <Text style={styles.emptyText}>Ninguém por aqui... 🕵️‍♂️</Text>
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#00A8FF' }, // Mantive seu azul padrão
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, height: 70 },
  backBtn: { padding: 5 },
  headerTitle: { color: '#FFF', fontSize: 18, fontWeight: '900', letterSpacing: 1 },
  content: { flex: 1, backgroundColor: '#FFF', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 20 },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0F2F5', borderRadius: 15, paddingHorizontal: 15, height: 50, marginBottom: 20 },
  searchIcon: { marginRight: 10 },
  searchInput: { flex: 1, fontSize: 16, color: '#333' },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', padding: 15, borderRadius: 15, marginBottom: 10, elevation: 1, shadowColor: '#000', shadowOffset: {width: 0, height: 1}, shadowOpacity: 0.1, shadowRadius: 2 },
  fotoContainer: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#E0F4FF', justifyContent: 'center', alignItems: 'center', marginRight: 15, position: 'relative' },
  foto: { width: 50, height: 50, borderRadius: 25 },
  dotGremio: { position: 'absolute', bottom: 0, right: 0, width: 12, height: 12, borderRadius: 6, backgroundColor: '#E91E63', borderWidth: 2, borderColor: '#FFF' },
  infoContainer: { flex: 1 },
  nome: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  detalhes: { fontSize: 13, color: '#777', marginTop: 2 },
  emptyText: { textAlign: 'center', color: '#888', marginTop: 30, fontSize: 16 }
});