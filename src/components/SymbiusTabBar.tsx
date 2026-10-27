import React from 'react';
import { StyleSheet, View, TouchableOpacity, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CORES_SYMBIUS } from '../screens/Boasvindas';
import { F } from '../constants/theme';

// ── Barra de navegação inferior compartilhada pelas 4 telas "top-level"
// (Início, Match, Feed, Perfil). Não usamos @react-navigation/bottom-tabs
// de propósito — o app inteiro roda num único Stack Navigator, então essa
// barra só chama navigation.navigate(...) entre as telas já registradas.
export type SymbiusAba = 'inicio' | 'agenda' | 'match' | 'feed' | 'perfil' | 'nenhuma';

interface Props {
  ativa: SymbiusAba;
  navigation: any;
  uid: string | null;
}

const ITENS: { chave: SymbiusAba; label: string; icone: keyof typeof Ionicons.glyphMap; iconeAtivo: keyof typeof Ionicons.glyphMap; destino: string }[] = [
  { chave: 'inicio', label: 'Início', icone: 'home-outline', iconeAtivo: 'home', destino: 'Index' },
  { chave: 'agenda', label: 'Agenda', icone: 'calendar-outline', iconeAtivo: 'calendar', destino: 'Calendario' },
  { chave: 'match',  label: 'Match',  icone: 'infinite-outline', iconeAtivo: 'infinite', destino: 'Match' },
  { chave: 'feed',   label: 'Resumos',   icone: 'newspaper-outline', iconeAtivo: 'newspaper', destino: 'Resumos' },
  { chave: 'perfil', label: 'Perfil', icone: 'person-outline', iconeAtivo: 'person', destino: 'Perfil' },
];

export default function SymbiusTabBar({ ativa, navigation, uid }: Props) {
  const insets = useSafeAreaInsets();
  const irPara = (destino: string) => {
    if (destino === ativa && ITENS.find(i => i.chave === ativa)?.destino === destino) return;
    navigation.navigate(destino, uid ? { uid } : undefined);
  };

  return (
    <View style={[styles.container, { paddingBottom: 12 + insets.bottom }]}>
      {ITENS.map((item) => {
        const ativo = item.chave === ativa;
        return (
          <TouchableOpacity
            key={item.chave}
            style={styles.item}
            activeOpacity={0.7}
            onPress={() => irPara(item.destino)}
          >
            <Ionicons
              name={ativo ? item.iconeAtivo : item.icone}
              size={20}
              color={ativo ? CORES_SYMBIUS.verdeEscuro : CORES_SYMBIUS.textoTerciario}
            />
            <Text style={[styles.label, ativo && styles.labelAtivo]}>{item.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around',
    paddingVertical: 12, paddingHorizontal: 8,
    backgroundColor: CORES_SYMBIUS.fundoCard,
    borderTopWidth: 1, borderTopColor: CORES_SYMBIUS.borda,
  },
  item: { alignItems: 'center', gap: 4 },
  label: { fontSize: 10, fontFamily: F.semibold, color: CORES_SYMBIUS.textoTerciario },
  labelAtivo: { fontFamily: F.bold, color: CORES_SYMBIUS.verdeEscuro },
});
