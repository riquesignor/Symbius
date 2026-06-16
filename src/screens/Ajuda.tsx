import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, ScrollView,
  Animated, Platform,
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppSettings } from '../contexts/AppSettingsContext';

// ── Fontes Poppins ──
const F = {
  regular:  'Poppins_400Regular',
  medium:   'Poppins_500Medium',
  semibold: 'Poppins_600SemiBold',
  bold:     'Poppins_700Bold',
  black:    'Poppins_800ExtraBold',
};

const CORES_LIGHT = {
  azulEscuro: '#0B2046',
  azulMedio:  '#1B3868',
  rosa:       '#E51C6A',
  amarelo:    '#FFC82C',
  fundo:      '#F5F7FA',
  branco:     '#FFFFFF',
  cinzaClaro: '#EAEFF4',
  textoSec:   '#8D99AE',
  verde:      '#27ae60',
};

const CORES_DARK = {
  azulEscuro: '#FFFFFF',
  azulMedio:  '#E0E0E0',
  rosa:       '#FF5C97',
  amarelo:    '#FFC82C',
  fundo:      '#0F1419',
  branco:     '#1A1F26',
  cinzaClaro: '#2A2F36',
  textoSec:   '#7A8595',
  verde:      '#27ae60',
};

// ── Dados do FAQ ──
const SECOES = [
  {
    titulo: 'Primeiros passos',
    icone: 'rocket-outline' as const,
    cor: '#1B3868',
    itens: [
      {
        pergunta: 'Como criar minha conta?',
        resposta:
          'Na tela inicial, toque em "Criar conta" e preencha seus dados: nome, e-mail e senha. Após confirmar, você já pode acessar o app.',
      },
      {
        pergunta: 'Como fazer login?',
        resposta:
          'Na tela de login, insira seu e-mail e senha cadastrados. Se esqueceu a senha, use a opção "Esqueci minha senha" para receber um link de redefinição no seu e-mail.',
      },
      {
        pergunta: 'Como completar meu perfil?',
        resposta:
          'Acesse as Configurações (ícone de engrenagem) e preencha nome, foto de perfil e série. Um perfil completo melhora sua experiência e a dos outros usuários.',
      },
    ],
  },
  {
    titulo: 'Publicações',
    icone: 'newspaper-outline' as const,
    cor: '#E51C6A',
    itens: [
      {
        pergunta: 'O que são as publicações do JUMO?',
        resposta:
          'As publicações são avisos, destaques, oportunidades, eventos de olimpíadas e passeios publicados pela gestão da escola. Fique por dentro de tudo que acontece no colégio.',
      },
      {
        pergunta: 'Como acessar uma publicação?',
        resposta:
          'Na tela inicial, toque em qualquer card de destaque ou item de lista para abrir a publicação completa com foto, título e conteúdo detalhado.',
      },
      {
        pergunta: 'Por que não consigo editar posts?',
        resposta:
          'Apenas administradores do app podem criar, editar e excluir publicações. Se precisar de uma correção em algum conteúdo, entre em contato com a gestão.',
      },
    ],
  },
  {
    titulo: 'Chat e Mensagens',
    icone: 'chatbubbles-outline' as const,
    cor: '#27ae60',
    itens: [
      {
        pergunta: 'Como iniciar uma conversa?',
        resposta:
          'Acesse a seção de Matches ou a lista de contatos e toque no perfil da pessoa com quem deseja conversar. A conversa será iniciada automaticamente.',
      },
      {
        pergunta: 'O que significa o indicador verde?',
        resposta:
          'O círculo verde ao lado da foto indica que o usuário está online no momento. Quando estiver cinza, exibe há quanto tempo ele esteve online pela última vez.',
      },
      {
        pergunta: 'Como enviar fotos no chat?',
        resposta:
          'Dentro de uma conversa, toque no ícone de câmera/galeria ao lado do campo de texto para selecionar uma imagem da sua galeria e enviá-la.',
      },
      {
        pergunta: 'Minhas mensagens são privadas?',
        resposta:
          'Sim. As conversas são individuais e acessíveis apenas pelos participantes. Nenhum administrador lê o conteúdo das mensagens privadas.',
      },
    ],
  },
  {
    titulo: 'Notificações',
    icone: 'notifications-outline' as const,
    cor: '#FFC82C',
    itens: [
      {
        pergunta: 'Como ativar ou desativar notificações?',
        resposta:
          'Nas Configurações, acesse a seção "Notificações" e ajuste as preferências para Avisos, Eventos e Matches. Você pode silenciar categorias específicas.',
      },
      {
        pergunta: 'O que é o banner de mensagem?',
        resposta:
          'Quando alguém te envia uma mensagem enquanto você está em outra tela do app, aparece um banner no topo com a foto, nome e prévia da mensagem. Toque nele para abrir o chat.',
      },
      {
        pergunta: 'Onde vejo minhas notificações antigas?',
        resposta:
          'Toque no ícone de sino no canto superior direito da tela inicial. Lá aparecem notificações de mensagens e eventos da agenda. Você pode limpá-las com "Limpar tudo".',
      },
    ],
  },
  {
    titulo: 'Privacidade e Conta',
    icone: 'shield-checkmark-outline' as const,
    cor: '#8e44ad',
    itens: [
      {
        pergunta: 'Como alterar minha senha?',
        resposta:
          'Nas Configurações, role até "Conta" e toque em "Alterar senha". Você precisará digitar a senha atual e depois a nova senha (mínimo 6 caracteres).',
      },
      {
        pergunta: 'Como ocultar meu status online?',
        resposta:
          'Nas Configurações, na seção "Privacidade", ative a opção "Ocultar status online". Outros usuários não verão quando você está ativo.',
      },
      {
        pergunta: 'Como excluir minha conta?',
        resposta:
          'Para solicitar a exclusão da sua conta, entre em contato com a gestão da escola. Dados de conta são gerenciados pelos administradores para garantir a segurança da plataforma.',
      },
    ],
  },
  {
    titulo: 'Problemas comuns',
    icone: 'build-outline' as const,
    cor: '#e67e22',
    itens: [
      {
        pergunta: 'O app está lento ou travando. O que faço?',
        resposta:
          'Tente fechar e reabrir o app. Se o problema persistir, limpe o cache nas Configurações do app ou reinstale o aplicativo. Verifique também sua conexão com a internet.',
      },
      {
        pergunta: 'Não consigo carregar fotos ou conteúdo.',
        resposta:
          'Verifique sua conexão com a internet. Imagens e conteúdo requerem uma boa conexão. Se estiver em Wi-Fi, tente alternar para dados móveis ou vice-versa.',
      },
      {
        pergunta: 'Recebi um erro de "Permissão negada". O que significa?',
        resposta:
          'Isso ocorre quando você tenta acessar um recurso restrito ao seu perfil. Se acredita que é um erro, entre em contato com a gestão da escola.',
      },
    ],
  },
];

// ── Componente de item expansível ──
function ItemFAQ({ item, C, fs }: { item: { pergunta: string; resposta: string }; C: any; fs: (n: number) => number }) {
  const [aberto, setAberto] = useState(false);
  const anim = useRef(new Animated.Value(0)).current;

  const toggleItem = () => {
    Animated.timing(anim, {
      toValue: aberto ? 0 : 1,
      duration: 220,
      useNativeDriver: false,
    }).start();
    setAberto(!aberto);
  };

  const maxHeight = anim.interpolate({ inputRange: [0, 1], outputRange: [0, 300] });
  const opacity   = anim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
  const rotate    = anim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });

  return (
    <View style={[styles.faqItem, { borderBottomColor: C.cinzaClaro }]}>
      <TouchableOpacity
        style={styles.faqPergunta}
        onPress={toggleItem}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={item.pergunta}
        accessibilityHint={aberto ? 'Toque para fechar' : 'Toque para expandir'}
      >
        <Text style={[styles.faqPerguntaText, { color: C.azulEscuro, fontSize: fs(14) }]}>
          {item.pergunta}
        </Text>
        <Animated.View style={{ transform: [{ rotate }] }}>
          <Ionicons name="chevron-down" size={18} color={C.textoSec} />
        </Animated.View>
      </TouchableOpacity>

      <Animated.View style={{ maxHeight, opacity, overflow: 'hidden' }}>
        <Text style={[styles.faqResposta, { color: C.textoSec, fontSize: fs(13) }]}>
          {item.resposta}
        </Text>
      </Animated.View>
    </View>
  );
}

// ── Tela principal ──
export default function Ajuda({ navigation }: any) {
  const insets  = useSafeAreaInsets();
  const { cores: C, fonteScale, modoEscuro } = useAppSettings();
  const fs = (n: number) => Math.round(n * fonteScale);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: C.fundo }]}>

      {/* HEADER */}
      <View style={[styles.header, { paddingTop: insets.top + (Platform.OS === 'android' ? 8 : 0), backgroundColor: C.branco, borderBottomColor: C.cinzaClaro }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel="Voltar"
        >
          <Ionicons name="arrow-back" size={24} color={C.azulEscuro} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: C.azulEscuro, fontSize: fs(17) }]}>
          Ajuda
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
            <View style={[styles.heroIconBg, { backgroundColor: C.azulEscuro + '12' }]}>
              <MaterialIcons name="help-outline" size={36} color={C.azulEscuro} />
            </View>
            <Text style={[styles.heroTitulo, { color: C.azulEscuro, fontSize: fs(20) }]}>
              Central de Ajuda
            </Text>
            <Text style={[styles.heroSub, { color: C.textoSec, fontSize: fs(13) }]}>
              Encontre respostas para as perguntas mais frequentes sobre o JUMO.
            </Text>
          </View>

          {/* Seções de FAQ */}
          {SECOES.map((secao, si) => (
            <View key={si} style={[styles.secao, { backgroundColor: C.branco }]}>
              {/* Título da seção */}
              <View style={styles.secaoHeader}>
                <View style={[styles.secaoIconBg, { backgroundColor: secao.cor + '18' }]}>
                  <Ionicons name={secao.icone} size={18} color={secao.cor} />
                </View>
                <Text style={[styles.secaoTitulo, { color: C.azulEscuro, fontSize: fs(14) }]}>
                  {secao.titulo}
                </Text>
              </View>

              {/* Itens */}
              {secao.itens.map((item, ii) => (
                <ItemFAQ
                  key={ii}
                  item={item}
                  C={C}
                  fs={fs}
                />
              ))}
            </View>
          ))}

          {/* Rodapé — contato */}
          <View style={[styles.rodape, { backgroundColor: C.branco }]}>
            <Text style={[styles.rodapeTitulo, { color: C.azulEscuro, fontSize: fs(14) }]}>
              Ainda com dúvidas?
            </Text>
            <Text style={[styles.rodapeText, { color: C.textoSec, fontSize: fs(13) }]}>
              Entre em contato com a gestão da escola ou acesse a tela de Contatos para falar diretamente com a equipe responsável.
            </Text>
            <TouchableOpacity
              style={[styles.btnContato, { backgroundColor: C.azulEscuro }]}
              onPress={() => navigation.navigate('Contatos')}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Ir para Contatos"
            >
              <Ionicons name="call-outline" size={16} color="#FFF" />
              <Text style={[styles.btnContatoText, { fontSize: fs(14) }]}>
                Ver Contatos
              </Text>
            </TouchableOpacity>
          </View>

        </Animated.View>
      </ScrollView>
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
    gap: 12,
  },

  hero: {
    borderRadius: 18,
    padding: 24,
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  heroIconBg: {
    width: 68, height: 68,
    borderRadius: 34,
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
    lineHeight: 20,
  },

  secao: {
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: 4,
  },
  secaoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 12,
  },
  secaoIconBg: {
    width: 34, height: 34,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  secaoTitulo: {
    fontFamily: F.bold,
    flex: 1,
  },

  faqItem: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginHorizontal: 18,
  },
  faqPergunta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    gap: 12,
  },
  faqPerguntaText: {
    fontFamily: F.medium,
    flex: 1,
    lineHeight: 20,
  },
  faqResposta: {
    fontFamily: F.regular,
    lineHeight: 21,
    paddingBottom: 14,
  },

  rodape: {
    borderRadius: 18,
    padding: 22,
    alignItems: 'center',
    gap: 8,
  },
  rodapeTitulo: {
    fontFamily: F.bold,
    textAlign: 'center',
  },
  rodapeText: {
    fontFamily: F.regular,
    textAlign: 'center',
    lineHeight: 20,
  },
  btnContato: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 30,
    paddingVertical: 12,
    paddingHorizontal: 28,
    marginTop: 8,
  },
  btnContatoText: {
    fontFamily: F.bold,
    color: '#FFF',
  },
});
