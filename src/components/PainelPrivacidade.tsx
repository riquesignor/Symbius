import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CORES_SYMBIUS } from '../constants/coresSymbius';
import { F } from '../constants/theme';
import { useAppSettings } from '../contexts/AppSettingsContext';

// Mini painel de privacidade do próprio perfil. Grava nos mesmos campos de
// `usuarios/{uid}` que a tela de Configurações usava (visibilidade,
// statusOnline, visivel_match), então valores antigos continuam valendo.
export const VISIBILIDADES = ['Público', 'Apenas Contatos', 'Privado'] as const;

// Cadastros antigos gravaram `visibilidade: true`; sem texto válido = Público.
export const normalizarVisibilidade = (v: unknown): string =>
  typeof v === 'string' && (VISIBILIDADES as readonly string[]).includes(v) ? v : 'Público';

interface Props {
  visivelMatch: boolean;
  onVisivelMatch: (v: boolean) => void;
  fs: (n: number) => number;
}

export default function PainelPrivacidade({ visivelMatch, onVisivelMatch, fs }: Props) {
  const { visibilidade, setVisibilidade, statusOnline, setStatusOnline } = useAppSettings();
  const atual = normalizarVisibilidade(visibilidade);

  return (
    <View style={styles.card}>
      <Text style={[styles.rotulo, { fontSize: fs(13) }]} nativeID="rotuloVisibilidade">Quem vê seu perfil</Text>
      <View style={styles.segmentos} accessibilityRole="radiogroup" accessibilityLabelledBy="rotuloVisibilidade">
        {VISIBILIDADES.map(v => {
          const ativo = atual === v;
          return (
            <TouchableOpacity
              key={v}
              style={[styles.segmento, ativo && styles.segmentoAtivo]}
              onPress={() => !ativo && setVisibilidade(v)}
              accessibilityRole="radio"
              accessibilityState={{ checked: ativo }}
            >
              <Text style={[styles.segmentoTxt, ativo && styles.segmentoTxtAtivo, { fontSize: fs(12) }]} numberOfLines={1}>
                {v === 'Apenas Contatos' ? 'Contatos' : v}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.divisor} />

      <LinhaSwitch
        icone="radio-button-on"
        titulo="Status online"
        descricao="Mostra quando você está usando o app"
        valor={statusOnline}
        onChange={setStatusOnline}
        fs={fs}
      />
      <View style={styles.divisor} />
      <LinhaSwitch
        icone="infinite"
        titulo="Aparecer nos Elos"
        descricao="Outras pessoas te encontram no Descobrir e podem mandar pedido"
        valor={visivelMatch}
        onChange={onVisivelMatch}
        fs={fs}
      />
    </View>
  );
}

const LinhaSwitch = ({ icone, titulo, descricao, valor, onChange, fs }: {
  icone: keyof typeof Ionicons.glyphMap; titulo: string; descricao: string;
  valor: boolean; onChange: (v: boolean) => void; fs: (n: number) => number;
}) => (
  <TouchableOpacity
    style={styles.linha}
    activeOpacity={0.7}
    onPress={() => onChange(!valor)}
    accessibilityRole="switch"
    accessibilityState={{ checked: valor }}
    accessibilityLabel={titulo}
    accessibilityHint={descricao}
  >
    <View style={styles.linhaIcone}>
      <Ionicons name={icone} size={16} color={CORES_SYMBIUS.verdeEscuro} />
    </View>
    <View style={{ flex: 1 }}>
      <Text style={[styles.linhaTitulo, { fontSize: fs(14) }]}>{titulo}</Text>
      <Text style={[styles.linhaDesc, { fontSize: fs(12) }]}>{descricao}</Text>
    </View>
    <Switch
      value={valor}
      onValueChange={onChange}
      trackColor={{ false: CORES_SYMBIUS.borda2, true: CORES_SYMBIUS.verdeEscuro }}
      thumbColor={CORES_SYMBIUS.creme}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
    />
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  card: {
    backgroundColor: CORES_SYMBIUS.fundoCard, borderRadius: 22, borderWidth: 1,
    borderColor: CORES_SYMBIUS.borda2, padding: 16, marginTop: 10,
  },
  rotulo: { fontFamily: F.bold, color: CORES_SYMBIUS.texto, marginBottom: 8 },
  segmentos: {
    flexDirection: 'row', backgroundColor: CORES_SYMBIUS.fundoSuave,
    borderRadius: 14, padding: 3, gap: 3,
  },
  segmento: { flex: 1, minHeight: 44, borderRadius: 11, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 },
  segmentoAtivo: { backgroundColor: CORES_SYMBIUS.verdeEscuro },
  segmentoTxt: { fontFamily: F.semibold, color: CORES_SYMBIUS.textoSec },
  segmentoTxtAtivo: { fontFamily: F.bold, color: CORES_SYMBIUS.creme },
  divisor: { height: 1, backgroundColor: CORES_SYMBIUS.borda, marginVertical: 12 },
  linha: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 },
  linhaIcone: {
    width: 32, height: 32, borderRadius: 10, justifyContent: 'center', alignItems: 'center',
    backgroundColor: CORES_SYMBIUS.verdeEscuro + '15',
  },
  linhaTitulo: { fontFamily: F.bold, color: CORES_SYMBIUS.texto },
  linhaDesc: { fontFamily: F.medium, color: CORES_SYMBIUS.textoSec, marginTop: 2 },
});
