import React, { useRef, useEffect } from 'react';
import SymbiusTabBar from '../components/SymbiusTabBar';
import {
  StyleSheet, Text, View, TouchableOpacity, ScrollView,
  Linking, Animated, Platform, Alert,
} from 'react-native';
import { Ionicons, MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppSettings } from '../contexts/AppSettingsContext';

import { F } from '../constants/theme';
import { TEMA_SYMBIUS } from '../constants/temaSymbius';

// ── Dados de contato (fonte: escolas.anchieta.br/contato) ──
const CONTATOS = [
  {
    id: 'whatsapp',
    label: 'WhatsApp',
    valor: '(11) 94847-7000',
    descricao: 'Atendimento via mensagem',
    icone: 'logo-whatsapp' as const,
    tipo: 'whatsapp',
    url: 'https://api.whatsapp.com/send?phone=5511948477000&text=Ol%C3%A1!%20Gostaria%20de%20receber%20mais%20informa%C3%A7%C3%B5es%20sobre%20a%20Escola%20Anchieta',
    cor: '#25D366',
  },
  {
    id: 'telefone',
    label: 'Telefone',
    valor: '0800 772-8445',
    descricao: 'Ligação gratuita',
    icone: 'call-outline' as const,
    tipo: 'tel',
    url: 'tel:08007728445',
    cor: '#1B3868',
  },
  {
    id: 'email',
    label: 'E-mail',
    valor: 'ouvidoria@anchieta.br',
    descricao: 'Ouvidoria e atendimento geral',
    icone: 'mail-outline' as const,
    tipo: 'email',
    url: 'mailto:ouvidoria@anchieta.br?subject=Contato%20via%20App%20Simbio',
    cor: '#E51C6A',
  },
  {
    id: 'site',
    label: 'Site oficial',
    valor: 'escolas.anchieta.br',
    descricao: 'Informações, matrículas e mais',
    icone: 'globe-outline' as const,
    tipo: 'url',
    url: 'https://escolas.anchieta.br',
    cor: '#8e44ad',
  },
  {
    id: 'maps',
    label: 'Localização',
    valor: 'Rua Bom Jesus de Pirapora, 100',
    descricao: 'Centro – Jundiaí – SP · CEP 13207-270',
    icone: 'location-outline' as const,
    tipo: 'maps',
    url: 'https://www.google.com/maps/place/R.+Bom+Jesus+de+Pirapora,+100-140+-+Jundiaí+-+SP',
    cor: '#e67e22',
  },
  {
    id: 'visita',
    label: 'Agendar visita',
    valor: 'escolas.anchieta.br/visita-agendada',
    descricao: 'Conheça a escola presencialmente',
    icone: 'calendar-outline' as const,
    tipo: 'url',
    url: 'https://escolas.anchieta.br/visita-agendada/',
    cor: '#27ae60',
  },
  {
    id: 'aluno',
    label: 'Área do Aluno',
    valor: 'ng.anchieta.br',
    descricao: 'Portal acadêmico online',
    icone: 'school-outline' as const,
    tipo: 'url',
    url: 'https://ng.anchieta.br/aluno-online/index.html#/login',
    cor: '#0B2046',
  },
];

const HORARIO = {
  dias: 'Segunda a sexta-feira',
  horas: '07h15 às 17h50',
};

// ── Componente de card de contato ──
function ContatoCard({
  item, C, fs,
}: {
  item: typeof CONTATOS[0];
  C: any;
  fs: (n: number) => number;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const onPressIn  = () => Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 50 }).start();
  const onPressOut = () => Animated.spring(scale, { toValue: 1,    useNativeDriver: true, speed: 50 }).start();

  const abrir = async () => {
    try {
      const suporte = await Linking.canOpenURL(item.url);
      if (suporte) {
        await Linking.openURL(item.url);
      } else {
        Alert.alert('Não foi possível abrir', `Tente acessar manualmente:\n${item.valor}`);
      }
    } catch {
      Alert.alert('Erro', 'Não foi possível abrir este contato.');
    }
  };

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        style={[styles.card, { backgroundColor: C.branco, borderColor: C.cinzaClaro }]}
        onPress={abrir}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        activeOpacity={1}
        accessibilityRole="button"
        accessibilityLabel={`${item.label}: ${item.valor}`}
        accessibilityHint="Toque para abrir"
      >
        <View style={[styles.cardIcon, { backgroundColor: item.cor + '18' }]}>
          <Ionicons name={item.icone} size={22} color={item.cor} />
        </View>
        <View style={styles.cardTextos}>
          <Text style={[styles.cardLabel, { color: C.textoSec, fontSize: fs(11) }]}>
            {item.label.toUpperCase()}
          </Text>
          <Text style={[styles.cardValor, { color: C.azulEscuro, fontSize: fs(14) }]} numberOfLines={1}>
            {item.valor}
          </Text>
          {item.descricao ? (
            <Text style={[styles.cardDesc, { color: C.textoSec, fontSize: fs(12) }]} numberOfLines={1}>
              {item.descricao}
            </Text>
          ) : null}
        </View>
        <Ionicons name="chevron-forward" size={18} color={C.textoSec} />
      </TouchableOpacity>
    </Animated.View>
  );
}

// ── Tela principal ──
export default function Contato({ navigation, route }: any) {
  const insets  = useSafeAreaInsets();
  const { fonteScale } = useAppSettings();
  // Paleta Symbius fixa (claro) — mesma técnica de shadow usada em
  // Match/Perfil/Configuracoes/Calendario/Admin/FeedResumos.
  const C = TEMA_SYMBIUS;
  const fs = (n: number) => Math.round(n * fonteScale);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: C.fundo }]}>

      {/* HEADER */}
      <View style={[
        styles.header,
        {
          paddingTop: insets.top + 16 + (Platform.OS === 'android' ? 8 : 0),
          backgroundColor: C.branco,
          borderBottomColor: C.cinzaClaro,
        },
      ]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel="Voltar"
        >
          <Ionicons name="arrow-back" size={22} color={C.azulEscuro} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: C.azulEscuro, fontSize: fs(17) }]}>
          Contato
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{ opacity: fadeAnim }}>

          {/* Hero */}
          <View style={[styles.hero, { backgroundColor: C.branco }]}>
            <View style={[styles.heroIconBg, { backgroundColor: '#0B2046' + '14' }]}>
              <MaterialIcons name="school" size={38} color={C.azulEscuro} />
            </View>
            <Text style={[styles.heroTitulo, { color: C.azulEscuro, fontSize: fs(18) }]}>
              Escolas Padre Anchieta
            </Text>
            <Text style={[styles.heroSub, { color: C.textoSec, fontSize: fs(13) }]}>
              Jundiaí – SP
            </Text>
            {/* Horário */}
            <View style={[styles.horarioPill, { backgroundColor: C.fundo }]}>
              <Ionicons name="time-outline" size={14} color={C.textoSec} />
              <Text style={[styles.horarioText, { color: C.textoSec, fontSize: fs(12) }]}>
                {HORARIO.dias} · {HORARIO.horas}
              </Text>
            </View>
          </View>

          {/* Lista de contatos */}
          <View style={styles.lista}>
            <Text style={[styles.secaoLabel, { color: C.textoSec, fontSize: fs(11) }]}>
              CANAIS DE ATENDIMENTO
            </Text>
            {CONTATOS.map((item, i) => (
              <ContatoCard key={item.id} item={item} C={C} fs={fs} />
            ))}
          </View>

          {/* Nota de rodapé */}
          <Text style={[styles.nota, { color: C.textoSec, fontSize: fs(11) }]}>
            Informações obtidas em escolas.anchieta.br · 2026
          </Text>

        </Animated.View>
      </ScrollView>
      <SymbiusTabBar ativa="nenhuma" navigation={navigation} uid={route?.params?.uid ?? null} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    width: 40, height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: F.bold,
    letterSpacing: 0.3,
  },

  scroll: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 16,
  },

  hero: {
    borderRadius: 18,
    padding: 24,
    alignItems: 'center',
    gap: 6,
  },
  heroIconBg: {
    width: 72, height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  heroTitulo: {
    fontFamily: F.black,
    textAlign: 'center',
  },
  heroSub: {
    fontFamily: F.regular,
    textAlign: 'center',
  },
  horarioPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 14,
    marginTop: 6,
  },
  horarioText: {
    fontFamily: F.medium,
  },

  lista: {
    gap: 10,
  },
  secaoLabel: {
    fontFamily: F.bold,
    letterSpacing: 0.8,
    marginLeft: 4,
    marginBottom: 2,
  },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 16,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  cardIcon: {
    width: 46, height: 46,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardTextos: {
    flex: 1,
    gap: 1,
  },
  cardLabel: {
    fontFamily: F.bold,
    letterSpacing: 0.5,
  },
  cardValor: {
    fontFamily: F.semibold,
  },
  cardDesc: {
    fontFamily: F.regular,
  },

  nota: {
    fontFamily: F.regular,
    textAlign: 'center',
    marginTop: 4,
  },
});
