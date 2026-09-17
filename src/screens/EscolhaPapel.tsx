import React, { useState } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, SafeAreaView, StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CORES_SABE } from './Boasvindas';

// ── Papel na comunidade (não é um "tipo" novo de conta no backend — é uma tag
//    exibida no perfil; todo mundo continua sendo "Aluno" no Firestore) ──
type Papel = 'aprender' | 'ensinar';

const OPCOES: { chave: Papel; titulo: string; tag: string; desc: string; icone: any }[] = [
  {
    chave: 'aprender',
    titulo: 'Quero aprender',
    tag: '(Aluno)',
    desc: 'Buscar colegas que podem me ajudar nas matérias que tenho mais dificuldade.',
    icone: 'book-outline',
  },
  {
    chave: 'ensinar',
    titulo: 'Quero ensinar',
    tag: '(Mentor)',
    desc: 'Ajudar colegas nas matérias que já domino, e ganhar XP por isso.',
    icone: 'school-outline',
  },
];

export default function EscolhaPapel({ navigation }: any) {
  const [selecionado, setSelecionado] = useState<Papel | null>(null);

  const continuar = () => {
    if (!selecionado) return;
    // A escolha vai como parâmetro pro Cadastro, que grava como tag no perfil
    // (campo `papel_comunidade`) — não cria um tipo de conta novo.
    navigation.navigate('Cadastro', { papel: selecionado });
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="arrow-back" size={24} color={CORES_SABE.textoClaro} />
        </TouchableOpacity>
      </View>

      <View style={styles.conteudo}>
        <Text style={styles.titulo}>Qual é o seu papel{'\n'}na comunidade?</Text>

        {OPCOES.map((op) => {
          const ativo = selecionado === op.chave;
          return (
            <TouchableOpacity
              key={op.chave}
              style={[styles.card, ativo && styles.cardAtivo]}
              activeOpacity={0.85}
              onPress={() => setSelecionado(op.chave)}
            >
              <View style={[styles.iconeWrap, ativo && { backgroundColor: CORES_SABE.verdeClaro }]}>
                <Ionicons name={op.icone} size={22} color={ativo ? CORES_SABE.fundo : CORES_SABE.verdeClaro} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitulo}>{op.titulo} <Text style={styles.cardTag}>{op.tag}</Text></Text>
                <Text style={styles.cardDesc}>{op.desc}</Text>
              </View>
              {ativo && <Ionicons name="checkmark-circle" size={22} color={CORES_SABE.verdeClaro} />}
            </TouchableOpacity>
          );
        })}

        <Text style={styles.nota}>
          Não se preocupe: dá pra ajudar em algumas matérias e pedir ajuda em outras ao
          mesmo tempo. Essa escolha só define o que aparece como destaque no seu perfil.
        </Text>

        <View style={{ flex: 1 }} />

        <TouchableOpacity
          style={[styles.btnContinuar, !selecionado && { opacity: 0.4 }]}
          activeOpacity={0.85}
          disabled={!selecionado}
          onPress={continuar}
        >
          <Text style={styles.btnContinuarText}>Continuar</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: CORES_SABE.fundo },
  header: { paddingHorizontal: 20, paddingTop: 8 },
  conteudo: { flex: 1, paddingHorizontal: 24, paddingTop: 12, paddingBottom: 30 },
  titulo: {
    fontSize: 24, fontWeight: '800', color: CORES_SABE.textoClaro, lineHeight: 30,
    marginBottom: 24,
  },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: CORES_SABE.fundoCard, borderRadius: 18, padding: 16,
    marginBottom: 14, borderWidth: 1.5, borderColor: CORES_SABE.borda,
  },
  cardAtivo: { borderColor: CORES_SABE.verdeClaro },
  iconeWrap: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: CORES_SABE.fundo,
    justifyContent: 'center', alignItems: 'center',
  },
  cardTitulo: { fontSize: 15.5, fontWeight: '800', color: CORES_SABE.textoClaro },
  cardTag: { fontSize: 13, fontWeight: '600', color: CORES_SABE.textoSec },
  cardDesc: { fontSize: 12.5, color: CORES_SABE.textoSec, marginTop: 3, lineHeight: 17 },
  nota: { fontSize: 11.5, color: CORES_SABE.textoSec, marginTop: 4, lineHeight: 16 },
  btnContinuar: {
    backgroundColor: CORES_SABE.creme, borderRadius: 16, paddingVertical: 17,
    alignItems: 'center',
  },
  btnContinuarText: { color: CORES_SABE.fundo, fontSize: 16, fontWeight: '800' },
});
