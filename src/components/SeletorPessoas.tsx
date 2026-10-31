import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Image, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../config/firebaseConfig';
import { CORES_SYMBIUS } from '../constants/coresSymbius';
import { F } from '../constants/theme';

export interface Pessoa { uid: string; nome: string; foto: string | null }

const fotoUri = (foto?: string | null) =>
  !foto ? null : foto.startsWith('http') || foto.startsWith('data:') ? foto : `data:image/jpeg;base64,${foto}`;

const normalizar = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

interface Props {
  meuUid: string;
  matches: Pessoa[];           // elos ativos: entram direto no grupo
  excluir?: string[];          // já membros ou banidos
  selecionados: string[];      // elos marcados
  convidados: Pessoa[];        // sem elo: recebem pedido de convite
  onAlternarMatch: (uid: string) => void;
  onAlternarConvidado: (p: Pessoa) => void;
  vagas: number;               // quantas pessoas ainda cabem
  alturaMax?: number;
}

const Avatar = ({ p }: { p: Pessoa }) => {
  const uri = fotoUri(p.foto);
  return uri
    ? <Image source={{ uri }} style={styles.foto} />
    : <View style={[styles.foto, styles.fotoVazia]}><Text style={styles.fotoInicial}>{p.nome.charAt(0)}</Text></View>;
};

export default function SeletorPessoas({
  meuUid, matches, excluir = [], selecionados, convidados, onAlternarMatch, onAlternarConvidado, vagas, alturaMax = 300,
}: Props) {
  const [busca, setBusca] = useState('');
  const [todos, setTodos] = useState<Pessoa[] | null>(null);
  const [carregando, setCarregando] = useState(false);
  const carregou = useRef(false);

  const buscando = busca.trim().length >= 2;

  // Firestore não tem busca por trecho de texto: carrega a lista de usuários
  // ativos uma vez (a escola é pequena) e filtra aqui.
  useEffect(() => {
    if (!buscando || carregou.current) return;
    carregou.current = true;
    setCarregando(true);
    getDocs(collection(db, 'usuarios'))
      .then(snap => setTodos(snap.docs
        .filter(d => d.data().status === 1)
        .map(d => ({ uid: d.id, nome: d.data().nome_completo || 'Usuário', foto: d.data().foto || null }))))
      .catch(() => setTodos([]))
      .finally(() => setCarregando(false));
  }, [buscando]);

  const uidsMatch = useMemo(() => new Set(matches.map(m => m.uid)), [matches]);
  const ocultos = useMemo(() => new Set([meuUid, ...excluir]), [meuUid, excluir]);
  const termo = normalizar(busca);

  const matchesVisiveis = matches.filter(m => !ocultos.has(m.uid) && (!buscando || normalizar(m.nome).includes(termo)));
  const semElo = buscando && todos
    ? todos.filter(p => !ocultos.has(p.uid) && !uidsMatch.has(p.uid) && normalizar(p.nome).includes(termo)).slice(0, 20)
    : [];
  const semVaga = vagas <= 0;

  return (
    <View>
      <View style={styles.busca}>
        <Ionicons name="search" size={16} color={CORES_SYMBIUS.textoSec} />
        <TextInput
          style={styles.buscaInput}
          placeholder="Buscar pessoas pelo nome"
          placeholderTextColor={CORES_SYMBIUS.textoTerciario}
          value={busca}
          onChangeText={setBusca}
          autoCorrect={false}
          accessibilityLabel="Buscar pessoas pelo nome"
        />
        {busca.length > 0 && (
          <TouchableOpacity onPress={() => setBusca('')} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} accessibilityLabel="Limpar busca">
            <Ionicons name="close-circle" size={18} color={CORES_SYMBIUS.textoSec} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView style={{ maxHeight: alturaMax }} keyboardShouldPersistTaps="handled">
        <Text style={styles.secao}>SEUS ELOS ATIVOS</Text>
        {matchesVisiveis.length === 0 && (
          <Text style={styles.vazio}>{buscando ? 'Nenhum elo com esse nome.' : 'Nenhum elo ativo disponível.'}</Text>
        )}
        {matchesVisiveis.map(p => {
          const marcado = selecionados.includes(p.uid);
          const bloqueado = !marcado && semVaga;
          return (
            <TouchableOpacity
              key={p.uid}
              style={[styles.opcao, bloqueado && { opacity: 0.45 }]}
              onPress={() => !bloqueado && onAlternarMatch(p.uid)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: marcado, disabled: bloqueado }}
            >
              <Avatar p={p} />
              <Text style={styles.nome} numberOfLines={1}>{p.nome}</Text>
              <Ionicons name={marcado ? 'checkbox' : 'square-outline'} size={22} color={marcado ? CORES_SYMBIUS.verdeEscuro : CORES_SYMBIUS.textoTerciario} />
            </TouchableOpacity>
          );
        })}

        {convidados.length > 0 && !buscando && (
          <>
            <Text style={styles.secao}>VÃO RECEBER CONVITE</Text>
            {convidados.map(p => (
              <TouchableOpacity key={p.uid} style={styles.opcao} onPress={() => onAlternarConvidado(p)} accessibilityRole="button" accessibilityLabel={`Remover convite para ${p.nome}`}>
                <Avatar p={p} />
                <Text style={styles.nome} numberOfLines={1}>{p.nome}</Text>
                <Ionicons name="close" size={20} color={CORES_SYMBIUS.textoSec} />
              </TouchableOpacity>
            ))}
          </>
        )}

        {buscando && (
          <>
            <Text style={styles.secao}>OUTRAS PESSOAS · recebem um convite</Text>
            {carregando && <ActivityIndicator color={CORES_SYMBIUS.verdeEscuro} style={{ marginVertical: 12 }} />}
            {!carregando && semElo.length === 0 && <Text style={styles.vazio}>Ninguém encontrado.</Text>}
            {semElo.map(p => {
              const convidado = convidados.some(c => c.uid === p.uid);
              const bloqueado = !convidado && semVaga;
              return (
                <TouchableOpacity
                  key={p.uid}
                  style={[styles.opcao, bloqueado && { opacity: 0.45 }]}
                  onPress={() => !bloqueado && onAlternarConvidado(p)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: convidado, disabled: bloqueado }}
                  accessibilityLabel={`Convidar ${p.nome}`}
                >
                  <Avatar p={p} />
                  <Text style={styles.nome} numberOfLines={1}>{p.nome}</Text>
                  <View style={[styles.pill, convidado && styles.pillAtiva]}>
                    <Text style={[styles.pillTxt, convidado && styles.pillTxtAtiva]}>{convidado ? 'Convidado' : 'Convidar'}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </>
        )}
      </ScrollView>
      {semVaga && <Text style={styles.aviso}>O grupo chegou ao limite de pessoas.</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  busca: {
    flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, borderRadius: 14,
    paddingHorizontal: 12, backgroundColor: CORES_SYMBIUS.fundoSuave, marginBottom: 6,
  },
  buscaInput: { flex: 1, fontFamily: F.medium, fontSize: 14, color: CORES_SYMBIUS.texto, paddingVertical: 8 },
  secao: { fontSize: 10.5, fontFamily: F.bold, letterSpacing: 0.6, color: CORES_SYMBIUS.textoSec, marginTop: 12, marginBottom: 4 },
  vazio: { fontSize: 13, fontFamily: F.medium, color: CORES_SYMBIUS.textoSec, paddingVertical: 8 },
  opcao: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48, paddingVertical: 4 },
  foto: { width: 36, height: 36, borderRadius: 18 },
  fotoVazia: { backgroundColor: CORES_SYMBIUS.fundoSuave, justifyContent: 'center', alignItems: 'center' },
  fotoInicial: { fontFamily: F.bold, color: CORES_SYMBIUS.verdeEscuro },
  nome: { flex: 1, fontSize: 14, fontFamily: F.semibold, color: CORES_SYMBIUS.texto },
  pill: { minHeight: 32, paddingHorizontal: 12, borderRadius: 16, justifyContent: 'center', borderWidth: 1, borderColor: CORES_SYMBIUS.verdeEscuro },
  pillAtiva: { backgroundColor: CORES_SYMBIUS.verdeEscuro },
  pillTxt: { fontSize: 12, fontFamily: F.bold, color: CORES_SYMBIUS.verdeEscuro },
  pillTxtAtiva: { color: CORES_SYMBIUS.creme },
  aviso: { fontSize: 12, fontFamily: F.semibold, color: CORES_SYMBIUS.laranjaTexto, marginTop: 6, textAlign: 'center' },
});
