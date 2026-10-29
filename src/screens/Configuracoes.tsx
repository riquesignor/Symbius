import { voltar } from '../navegacao';
  import React, { useState, useEffect, useRef } from 'react';
  import {
    StyleSheet, Text, View, TouchableOpacity, ScrollView,
    SafeAreaView, StatusBar, Switch, Modal, TextInput,
    ActivityIndicator, Linking, Animated, Platform, Vibration
  } from 'react-native';
  import { Ionicons, MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
  import AsyncStorage from '@react-native-async-storage/async-storage';
  import { useSafeAreaInsets } from 'react-native-safe-area-context';
  import { db, auth } from '../config/firebaseConfig';
  import { useAppSettings } from '../contexts/AppSettingsContext';
  import { doc, getDoc, updateDoc, collection, getDocs } from 'firebase/firestore';
  import { useNotificacao } from '../contexts/NotificacaoProvider';
  import { sairDaConta as encerrarSessao } from '../services/authService';
  import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';

  import { F } from '../constants/theme';
  import { CORES_SYMBIUS, CORES_SYMBIUS_DARK } from './Boasvindas';

  // ── Shadow de paleta: a lógica desta tela (Section/SettingRow com C.xxx /
  // cores.xxx) foi escrita em cima de CORES/CORES_DARK do theme.ts antigo.
  // Em vez de reescrever tudo, sombreamos esses dois nomes localmente com a
  // paleta Symbius — mesma técnica usada em Match.tsx/Perfil.tsx. ──
  const CORES = {
    azulEscuro: CORES_SYMBIUS.verdeEscuro,
    branco:     CORES_SYMBIUS.fundoCard,
    fundo:      CORES_SYMBIUS.fundo,
    cinzaClaro: CORES_SYMBIUS.borda,
    textoSec:   CORES_SYMBIUS.textoSec,
    preto:      CORES_SYMBIUS.texto,
    amarelo:    CORES_SYMBIUS.laranja,
    laranja:    CORES_SYMBIUS.laranjaTexto,
    verde:      CORES_SYMBIUS.sucesso,
    rosa:       '#C9667E',
    roxo:       '#9B7EBD',
    vermelho:   '#D64545',
  };
  const CORES_DARK = {
    azulEscuro: CORES_SYMBIUS.verdeMedio,
    branco:     CORES_SYMBIUS_DARK.fundoCard,
    fundo:      CORES_SYMBIUS_DARK.fundo,
    cinzaClaro: CORES_SYMBIUS_DARK.fundoSuave,
    textoSec:   CORES_SYMBIUS_DARK.textoSec,
    preto:      CORES_SYMBIUS_DARK.texto,
    amarelo:    CORES_SYMBIUS.laranja,
    laranja:    CORES_SYMBIUS.laranjaTexto,
    verde:      CORES_SYMBIUS.sucesso,
    rosa:       '#D98099',
    roxo:       '#B29BCB',
    vermelho:   '#E06666',
  };

  const TAMANHOS_FONTE = ['Pequeno', 'Normal', 'Grande'];
  const SONS_NOTIF     = ['Nenhum', 'Leve', 'Normal', 'Forte'];
  const VISIBILIDADES  = ['Público', 'Apenas Contatos', 'Privado'];
  const SERIES         = ['1º Ano', '2º Ano', '3º Ano', 'Não definir'];

  // ── Animação ──
  const FadeInView = ({ children, delay = 0, style }: any) => {
    const anim = useRef(new Animated.Value(0)).current;
    useEffect(() => {
      Animated.timing(anim, {
        toValue: 1, duration: 450, delay, useNativeDriver: true,
      }).start();
    }, []);
    return (
      <Animated.View style={[
        style,
        { opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0,1], outputRange: [12, 0] }) }] }
      ]}>
        {children}
      </Animated.View>
    );
  };

  export default function Configuracoes({ navigation, route }: any) {
    const insets = useSafeAreaInsets();
    const uid = route?.params?.uid;

  const {
    modoEscuro,    setModoEscuro,
    tamanhoFonte,  setTamanhoFonte,
    notifGeral,    setNotifGeral,
    notifAvisos,   setNotifAvisos,
    notifEventos,  setNotifEventos,
    notifMatch,    setNotifMatch,
    notifMensagens, setNotifMensagens,
    notifDiario,    setNotifDiario,
    somNotif,      setSomNotif,
    vibracao,      setVibracao,
    visibilidade,  setVisibilidade,
    statusOnline,  setStatusOnline,
    serieFiltro,   setSerieFiltro,
  } = useAppSettings();

    // ════ STATES — CONTA ════
    const [userData, setUserData] = useState<any>(null);

    // ════ STATES — UI ════
    const [carregando,      setCarregando]      = useState(true);
    const [salvandoSenha,   setSalvandoSenha]   = useState(false);
    const [toast,           setToast]           = useState('');
    const [confirmacao,     setConfirmacao]     = useState<any>(null);

    // ════ STATES — MODAIS ════
    const [modalFonte,        setModalFonte]        = useState(false);
    const [modalSom,          setModalSom]          = useState(false);
    const [modalVisibilidade, setModalVisibilidade] = useState(false);
    const [modalSerie,        setModalSerie]        = useState(false);
    const [modalSenha,        setModalSenha]        = useState(false);

    // ════ STATES — SENHA ════
    const [senhaAtual,        setSenhaAtual]        = useState('');
    const [senhaNova,         setSenhaNova]         = useState('');
    const [senhaConfirma,     setSenhaConfirma]     = useState('');
    const [erroSenha,         setErroSenha]         = useState('');

    // ── Histórico de notificações (portado do Index original) ──
    const { notificacoesChat, limparNotificacoesChat } = useNotificacao();
    const [notificacoesAgenda, setNotificacoesAgenda] = useState<any[]>([]);
    const [notifDescartadas, setNotifDescartadas] = useState<Set<string>>(new Set());
    const [modalHistorico, setModalHistorico] = useState(!!route?.params?.abrirNotificacoes);

    // Cores dinâmicas baseadas no modo — paleta Symbius ainda não tem modo
    // escuro definitivo (pendente), fixado em claro por ora. O toggle real
    // (modoEscuro/toggleModoEscuro) continua funcionando pras telas antigas.
    const C = CORES;

    // Tamanho de fonte multiplier
    const fonteScale = tamanhoFonte === 'Pequeno' ? 0.9 : tamanhoFonte === 'Grande' ? 1.15 : 1;

    // ════ LOAD ════
    useEffect(() => {
      carregar();
    }, []);

    useEffect(() => {
      if (!toast) return;
      const t = setTimeout(() => setToast(''), 2400);
      return () => clearTimeout(t);
    }, [toast]);

    // Carrega IDs de notificações de agenda já descartadas
    useEffect(() => {
      AsyncStorage.getItem('notif_descartadas').then(raw => {
        if (raw) setNotifDescartadas(new Set(JSON.parse(raw)));
      }).catch(() => {});
    }, []);

    // Carrega lembretes vencidos + provas próximas (mesma lógica do Index original)
    useEffect(() => {
      if (!uid) return;
      (async () => {
        try {
          const hoje = new Date();
          hoje.setHours(0, 0, 0, 0);
          const itens: any[] = [];

          const raLimpo = userData?.ra?.replace(/[\/\\]/g, '');
          const raValido = raLimpo && raLimpo !== 'N/A' && raLimpo.length > 0;
          const userIdentifier = raValido ? raLimpo : uid;
          try {
            const snapL = await getDocs(collection(db, 'lembretes', userIdentifier, 'lembretes'));
            snapL.forEach(d => itens.push({ id: d.id, fonte: 'lembrete', tipo: 'lembrete', ...d.data() }));
          } catch (e) {}

          try {
            const snapE = await getDocs(collection(db, 'eventos_admin', 'tipos', 'provas'));
            snapE.forEach((d: any) => itens.push({ id: d.id, fonte: 'admin', tipo: 'Prova', ...d.data() }));
          } catch (e) {}

          const notifs: any[] = [];
          itens.forEach(item => {
            if (item.tipo === 'lembrete' && item.data) {
              const [a, m, dd] = item.data.split('-').map(Number);
              const dt = new Date(a, m - 1, dd);
              dt.setHours(0, 0, 0, 0);
              if (dt < hoje) {
                notifs.push({ id: item.id, tipo: 'lembrete_vencido', titulo: item.titulo, data: item.data, icon: 'alert-circle' });
              }
            }
            if (item.tipo === 'Prova' && item.data) {
              notifs.push({ id: item.id, tipo: 'prova_proxima', titulo: item.titulo, data: item.data, icon: 'document-text' });
            }
          });
          setNotificacoesAgenda(notifs);
        } catch (e) { console.error('Erro ao carregar notificações de agenda:', e); }
      })();
    }, [uid, userData?.ra]);

    const totalNotificacoesAtivas =
      notificacoesChat.length + notificacoesAgenda.filter(n => !notifDescartadas.has(n.id)).length;

    const limparHistoricoNotificacoes = () => {
      limparNotificacoesChat();
      const idsAtivos = notificacoesAgenda.map(n => n.id);
      const novoSet = new Set([...notifDescartadas, ...idsAtivos]);
      setNotifDescartadas(novoSet);
      AsyncStorage.setItem('notif_descartadas', JSON.stringify([...novoSet])).catch(() => {});
    };

    const carregar = async () => {
    try {
      if (uid) {
        const snap = await getDoc(doc(db, 'usuarios', uid));
        if (snap.exists()) {
          setUserData(snap.data());
        }
      }
    } catch (e) { console.error(e); }
    finally { setCarregando(false); }
  };

    // ════ SALVAR LOCAL ════
    const salvarLocal = async (chave: string, valor: any) => {
      try {
        await AsyncStorage.setItem(chave, typeof valor === 'boolean' ? (valor ? '1' : '0') : String(valor));
      } catch (e) { console.error(e); }
    };

    // ════ SALVAR FIRESTORE ════
    const salvarFirestore = async (campo: string, valor: any) => {
      if (!uid) return;
      try {
        await updateDoc(doc(db, 'usuarios', uid), { [campo]: valor });
      } catch (e) { console.error(e); }
    };

    // ════ HANDLERS — TOGGLES ════
    // O tema é aplicado antes das telas carregarem, então trocar reinicia o app.
    const toggleModoEscuro = (v: boolean) => {
      setConfirmacao({
        titulo: v ? 'Ativar modo escuro?' : 'Voltar pro modo claro?',
        msg: 'O tema novo atravessa a tela como uma onda e é aplicado em todas as telas.',
        btnTxt: 'Aplicar',
        onOk: () => {
          setConfirmacao(null);
          if (vibracao) Vibration.vibrate(20);
          setModoEscuro(v);
        },
      });
    };

    const toggleNotifGeral = (v: boolean) => {
      setNotifGeral(v);
      salvarLocal('cfg_notifGeral', v);
      setToast(v ? 'Notificações ativadas' : 'Notificações desativadas');
    };

    const toggleNotifAvisos = (v: boolean) => {
      setNotifAvisos(v);
      salvarLocal('cfg_notifAvisos', v);
    };

    const toggleNotifEventos = (v: boolean) => {
      setNotifEventos(v);
      salvarLocal('cfg_notifEventos', v);
    };

    const toggleNotifMatch = (v: boolean) => {
      setNotifMatch(v);
      salvarLocal('cfg_notifMatch', v);
    };

    const toggleNotifMensagens = (v: boolean) => {
      setNotifMensagens(v);
      setToast(v ? 'Notificações de mensagens ativadas' : 'Notificações de mensagens desativadas');
    };

    const toggleVibracao = (v: boolean) => {
      setVibracao(v);
      salvarLocal('cfg_vibracao', v);
      if (v) Vibration.vibrate(50);
    };

    // Aparecer no Descobrir do Match (campo visivel_match; ausente conta como ligado)
    const [visivelMatch, setVisivelMatch] = useState(true);
    useEffect(() => {
      if (!uid) return;
      getDoc(doc(db, 'usuarios', uid)).then(snap => {
        if (snap.exists()) setVisivelMatch(snap.data()?.visivel_match !== false);
      }).catch(() => {});
    }, [uid]);
    const toggleVisivelMatch = (v: boolean) => {
      setVisivelMatch(v);
      salvarFirestore('visivel_match', v);
      setToast(v ? 'Seu perfil aparece nos Elos' : 'Seu perfil está oculto nos Elos');
    };

    const toggleStatusOnline = (v: boolean) => {
      setStatusOnline(v);
      salvarFirestore('statusOnline', v);
      setToast(v ? 'Status online visível' : 'Status online oculto');
    };

    // ════ HANDLERS — SELETORES ════
    const selecionarFonte = (v: string) => {
      setTamanhoFonte(v);
      salvarLocal('cfg_tamanhoFonte', v);
      setModalFonte(false);
      setToast(`Fonte: ${v}`);
    };

    const selecionarSom = (v: string) => {
      setSomNotif(v);
      salvarLocal('cfg_somNotif', v);
      setModalSom(false);
      setToast(`Som: ${v}`);
    };

    const selecionarVisibilidade = (v: string) => {
      setVisibilidade(v);
      salvarFirestore('visibilidade', v);
      setModalVisibilidade(false);
      setToast(`Perfil: ${v}`);
    };

    const selecionarSerie = (v: string) => {
      setSerieFiltro(v);
      salvarLocal('cfg_serieFiltro', v);
      setModalSerie(false);
      setToast(`Série: ${v}`);
    };

    // ════ HANDLERS — AÇÕES ════
    const limparCache = () => {
      setConfirmacao({
        titulo: 'Limpar Cache?',
        msg: 'Isso vai remover dados temporários do app. Suas configurações e login não serão afetados.',
        onOk: async () => {
          try {
            // Limpa só caches específicos, preserva login e configs
            const todasChaves = await AsyncStorage.getAllKeys();
            const chavesCache = todasChaves.filter(k =>
              k.startsWith('cache_') || k.startsWith('temp_')
            );
            if (chavesCache.length > 0) {
              await AsyncStorage.multiRemove(chavesCache);
            }
            setToast('Cache limpo');
          } catch { setToast('Erro ao limpar'); }
          setConfirmacao(null);
        }
      });
    };

    const sairDaConta = () => {
      setConfirmacao({
        titulo: 'Sair da conta?',
        msg: 'Você precisará fazer login novamente para acessar o app.',
        btnTxt: 'Sair',
        perigo: true,
        onOk: async () => {
          try {
            await encerrarSessao(uid);
            setConfirmacao(null);
            navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
          } catch { setToast('Erro ao sair'); }
        }
      });
    };

    const alterarSenha = async () => {
      setErroSenha('');
      if (!senhaAtual || !senhaNova || !senhaConfirma) {
        setErroSenha('Preencha todos os campos.');
        return;
      }
      if (senhaNova.length < 6) {
        setErroSenha('A nova senha deve ter no mínimo 6 caracteres.');
        return;
      }
      if (senhaNova !== senhaConfirma) {
        setErroSenha('As senhas não coincidem.');
        return;
      }
      setSalvandoSenha(true);
      try {
        const user = auth.currentUser;
        if (!user || !user.email) throw new Error('no-user');
        const cred = EmailAuthProvider.credential(user.email, senhaAtual);
        await reauthenticateWithCredential(user, cred);
        await updatePassword(user, senhaNova);
        setModalSenha(false);
        setSenhaAtual(''); setSenhaNova(''); setSenhaConfirma('');
        setToast('Senha alterada');
      } catch (e: any) {
        console.error('Erro ao alterar senha:', e?.code, e?.message);
        const code = e?.code || '';
        if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
          setErroSenha('Senha atual incorreta.');
        } else if (code === 'auth/weak-password') {
          setErroSenha('A nova senha é muito fraca. Escolha uma mais segura.');
        } else if (code === 'auth/too-many-requests') {
          setErroSenha('Muitas tentativas. Aguarde alguns minutos e tente novamente.');
        } else if (code === 'auth/network-request-failed') {
          setErroSenha('Erro de conexão. Verifique sua internet e tente novamente.');
        } else if (e?.message === 'no-user') {
          setErroSenha('Usuário não autenticado. Feche o app, faça login novamente e tente outra vez.');
        } else {
          setErroSenha(`Erro ao alterar senha: ${e?.message || code || 'Tente novamente.'}`);
        }
      } finally { setSalvandoSenha(false); }
    };

    const abrirURL = async (url: string) => {
      try {
        await Linking.openURL(url);
      } catch { setToast('Erro ao abrir link'); }
    };

    const enviarFeedback = () => {
      abrirURL('mailto:contato@anchieta.br?subject=Feedback Simbio&body=Olá, gostaria de enviar um feedback sobre o app...');
    };

    // ════ ROW COMPONENT ════
    const SettingRow = ({ icon, iconCor, label, descricao, toggle, onToggle, valor, onPress, perigo, ultimo }: any) => {
      const cores = CORES;
      return (
        <TouchableOpacity
          style={[
            styles.row,
            { borderBottomColor: cores.cinzaClaro, borderBottomWidth: ultimo ? 0 : 0.5 },
          ]}
          onPress={onPress}
          disabled={onToggle != null && onPress == null}
          activeOpacity={onPress ? 0.6 : 1}
        >
          <View style={[styles.rowIcon, { backgroundColor: (iconCor || cores.azulEscuro) + '15' }]}>
            <Ionicons name={icon} size={16} color={iconCor || cores.azulEscuro} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.rowLabel, { color: perigo ? CORES.vermelho : cores.preto, fontSize: 14 * fonteScale }]}>
              {label}
            </Text>
            {descricao && (
              <Text style={[styles.rowDesc, { color: cores.textoSec, fontSize: 11 * fonteScale }]}>
                {descricao}
              </Text>
            )}
          </View>
          {onToggle != null ? (
            <Switch
              value={toggle}
              onValueChange={onToggle}
              trackColor={{ false: cores.cinzaClaro, true: cores.azulEscuro }}
              thumbColor={toggle ? cores.amarelo : '#FFF'}
              ios_backgroundColor={cores.cinzaClaro}
            />
          ) : valor ? (
            <View style={styles.rowValor}>
              <Text style={[styles.rowValorText, { color: cores.textoSec, fontSize: 12 * fonteScale }]}>
                {valor}
              </Text>
              <Ionicons name="chevron-forward" size={15} color={cores.textoSec} />
            </View>
          ) : (
            <Ionicons name="chevron-forward" size={15} color={cores.textoSec} />
          )}
        </TouchableOpacity>
      );
    };

    // ════ SECTION COMPONENT ════
    const Section = ({ eyebrow, titulo, children }: any) => {
      const cores = CORES;
      return (
        <View style={styles.section}>
          <Text style={[styles.sectionEyebrow, { color: cores.rosa, fontSize: 9 * fonteScale }]}>
            {eyebrow}
          </Text>
          <Text style={[styles.sectionTitulo, { color: cores.azulEscuro, fontSize: 16 * fonteScale }]}>
            {titulo}
          </Text>
          <View style={[styles.sectionCard, { backgroundColor: cores.branco }]}>
            {children}
          </View>
        </View>
      );
    };

    if (carregando) {
      return (
        <View style={[styles.centro, { backgroundColor: C.fundo }]}>
          <ActivityIndicator size="large" color={C.azulEscuro} />
        </View>
      );
    }

    return (
      <View style={[styles.container, { backgroundColor: C.fundo }]}>
        <StatusBar barStyle={CORES_SYMBIUS.barStyle} backgroundColor={CORES_SYMBIUS.fundo} />

        {/* TOAST */}
        {toast !== '' && (
          <View style={[styles.toast, { top: insets.top + 12 }]}>
            <Ionicons name="checkmark-circle" size={16} color={CORES.amarelo} />
            <Text style={styles.toastText}>{toast}</Text>
          </View>
        )}

        {/* HEADER */}
        <View style={[styles.header, { paddingTop: insets.top + 28 }]}>
          <TouchableOpacity onPress={() => voltar(navigation)} style={styles.btnVoltar} accessibilityLabel="Voltar">
            <Ionicons name="arrow-back" size={22} color={CORES_SYMBIUS.texto} />
          </TouchableOpacity>
          <Text style={[styles.headerTitulo, styles.headerTituloCentro, { top: insets.top + 28 }]} pointerEvents="none">
            Configurações
          </Text>
          <View style={{ flex: 1 }} />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 60 }}
        >
          {/* ══ APARÊNCIA ══ */}
          <FadeInView delay={0}>
            <Section eyebrow="VISUAL" titulo="Aparência">
              <SettingRow
                icon="moon"
                iconCor={CORES.roxo || '#8e44ad'}
                label="Modo Escuro"
                descricao="Vale para o app inteiro"
                toggle={modoEscuro}
                onToggle={toggleModoEscuro}
              />
              <SettingRow
                icon="text"
                iconCor={CORES.azulEscuro}
                label="Tamanho da Fonte"
                valor={tamanhoFonte}
                onPress={() => setModalFonte(true)}
                ultimo
              />
            </Section>
          </FadeInView>

          {/* ══ NOTIFICAÇÕES ══ */}
          <FadeInView delay={100}>
            <Section eyebrow="ALERTAS" titulo="Notificações">
              <SettingRow
                icon="notifications-outline"
                iconCor={CORES.preto}
                label="Histórico de notificações"
                descricao={totalNotificacoesAtivas > 0 ? `${totalNotificacoesAtivas} não lida(s)` : 'Mensagens e avisos da agenda'}
                onPress={() => setModalHistorico(true)}
              />
              <SettingRow
                icon="notifications"
                iconCor={CORES.rosa}
                label="Notificações Gerais"
                descricao="Mestre de todas as notificações"
                toggle={notifGeral}
                onToggle={toggleNotifGeral}
              />
              <SettingRow
                icon="megaphone"
                iconCor={CORES.amarelo}
                label="Avisos da Escola"
                toggle={notifAvisos && notifGeral}
                onToggle={toggleNotifAvisos}
              />
              <SettingRow
                icon="calendar"
                iconCor={CORES.verde}
                label="Lembretes de Eventos"
                toggle={notifEventos && notifGeral}
                onToggle={toggleNotifEventos}
              />
              <SettingRow
                icon="chatbubbles"
                iconCor={CORES.azulEscuro}
                label="Mensagens"
                descricao="Chat com seus elos"
                toggle={notifMensagens && notifGeral}
                onToggle={toggleNotifMensagens}
              />
              <SettingRow
                icon="heart"
                iconCor={CORES.rosa}
                label="Elos"
                descricao="Solicitações e elos aceitos"
                toggle={notifMatch && notifGeral}
                onToggle={toggleNotifMatch}
              />
              <SettingRow
                icon="leaf"
                iconCor={CORES.verde}
                label="Desafio diário"
                descricao="Lembrete quando o XP do dia está liberado"
                toggle={notifDiario && notifGeral}
                onToggle={setNotifDiario}
              />
              <SettingRow
                icon="musical-notes"
                iconCor={CORES.azulEscuro}
                label="Som"
                valor={somNotif}
                onPress={() => setModalSom(true)}
              />
              <SettingRow
                icon="phone-portrait"
                iconCor={CORES.azulEscuro}
                label="Vibração"
                toggle={vibracao}
                onToggle={toggleVibracao}
                ultimo
              />
            </Section>
          </FadeInView>

          {/* ══ PRIVACIDADE ══ */}
          <FadeInView delay={200}>
            <Section eyebrow="SEGURANÇA" titulo="Privacidade">
              <SettingRow
                icon="eye"
                iconCor={CORES.verde}
                label="Visibilidade do Perfil"
                valor={visibilidade}
                onPress={() => setModalVisibilidade(true)}
              />
              <SettingRow
                icon="radio-button-on"
                iconCor={CORES.verde}
                label="Status Online"
                descricao="Mostrar quando você está ativo"
                toggle={statusOnline}
                onToggle={toggleStatusOnline}
              />
              <SettingRow
                icon="infinite"
                iconCor={CORES.verde}
                label="Aparecer nos Elos"
                descricao="Outras pessoas podem te encontrar no Descobrir e mandar solicitação"
                toggle={visivelMatch}
                onToggle={toggleVisivelMatch}
              />
              <SettingRow
                icon="school"
                iconCor={CORES.azulEscuro}
                label="Série Padrão"
                descricao="Filtrar agenda por padrão"
                valor={serieFiltro}
                onPress={() => setModalSerie(true)}
                ultimo
              />
            </Section>
          </FadeInView>

          {/* ══ DADOS ══ */}
          <FadeInView delay={300}>
            <Section eyebrow="ARMAZENAMENTO" titulo="Dados">
              <SettingRow
                icon="trash"
                iconCor={CORES.laranja || '#e67e22'}
                label="Limpar Cache"
                descricao="Remove dados temporários"
                onPress={limparCache}
                ultimo
              />
            </Section>
          </FadeInView>

          {/* ══ CONTA ══ */}
          <FadeInView delay={400}>
            <Section eyebrow="MINHA CONTA" titulo="Conta">
              <SettingRow
                icon="person-circle"
                iconCor={CORES.azulEscuro}
                label="Editar Perfil"
                descricao={userData?.email_escolar || ''}
                onPress={() => navigation.navigate('Perfil', { uid })}
              />
              <SettingRow
                icon="lock-closed"
                iconCor={CORES.azulEscuro}
                label="Alterar Senha"
                onPress={() => setModalSenha(true)}
              />
              <SettingRow
                icon="log-out"
                iconCor={CORES.vermelho}
                label="Sair da Conta"
                onPress={sairDaConta}
                perigo
                ultimo
              />
            </Section>
          </FadeInView>

          {/* ══ AJUDA ══ */}
          <FadeInView delay={500}>
            <Section eyebrow="SOBRE" titulo="Ajuda & Info">
              <SettingRow
                icon="mail"
                iconCor={CORES.azulEscuro}
                label="Enviar Feedback"
                onPress={enviarFeedback}
              />
              <SettingRow
                icon="document-text"
                iconCor={CORES.azulEscuro}
                label="Termos de Serviço"
                onPress={() => abrirURL('https://anchieta.br/termos')}
              />
              <SettingRow
                icon="shield-checkmark"
                iconCor={CORES.azulEscuro}
                label="Política de Privacidade"
                onPress={() => abrirURL('https://anchieta.br/privacidade')}
              />
              <SettingRow
                icon="information-circle"
                iconCor={CORES.azulEscuro}
                label="Versão do App"
                valor="1.0.0"
                ultimo
              />
            </Section>
          </FadeInView>

          {/* RODAPÉ */}
          <FadeInView delay={600}>
            <View style={styles.rodape}>
              <Text style={[styles.rodapeSymbius, { color: C.azulEscuro }]}>
                Simbi<Text style={{ color: C.rosa }}>o</Text>
              </Text>
              <Text style={[styles.rodapeTxt, { color: C.textoSec }]}>
                feito pela Anchieta
              </Text>
            </View>
          </FadeInView>
        </ScrollView>

        {/* ── MODAL TAMANHO FONTE ── */}
        <Modal visible={modalFonte} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 24, backgroundColor: C.branco }]}>
              <View style={[styles.modalHandle, { backgroundColor: C.cinzaClaro }]} />
              <Text style={[styles.modalTitulo, { color: C.azulEscuro }]}>Tamanho da Fonte</Text>
              {TAMANHOS_FONTE.map(t => (
                <TouchableOpacity
                  key={t}
                  style={[styles.seletorItem, { borderBottomColor: C.cinzaClaro }]}
                  onPress={() => selecionarFonte(t)}
                >
                  <Text style={[styles.seletorItemText, { color: C.azulEscuro, fontSize: t === 'Pequeno' ? 13 : t === 'Grande' ? 16 : 14 }]}>
                    {t}
                  </Text>
                  {tamanhoFonte === t && <Ionicons name="checkmark" size={18} color={C.azulEscuro} />}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </Modal>

        {/* ── MODAL SOM ── */}
        <Modal visible={modalSom} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 24, backgroundColor: C.branco }]}>
              <View style={[styles.modalHandle, { backgroundColor: C.cinzaClaro }]} />
              <Text style={[styles.modalTitulo, { color: C.azulEscuro }]}>Som de Notificação</Text>
              {SONS_NOTIF.map(s => (
                <TouchableOpacity
                  key={s}
                  style={[styles.seletorItem, { borderBottomColor: C.cinzaClaro }]}
                  onPress={() => selecionarSom(s)}
                >
                  <Text style={[styles.seletorItemText, { color: C.azulEscuro }]}>{s}</Text>
                  {somNotif === s && <Ionicons name="checkmark" size={18} color={C.azulEscuro} />}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </Modal>

        {/* ── MODAL VISIBILIDADE ── */}
        <Modal visible={modalVisibilidade} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 24, backgroundColor: C.branco }]}>
              <View style={[styles.modalHandle, { backgroundColor: C.cinzaClaro }]} />
              <Text style={[styles.modalTitulo, { color: C.azulEscuro }]}>Visibilidade do Perfil</Text>
              {VISIBILIDADES.map(v => (
                <TouchableOpacity
                  key={v}
                  style={[styles.seletorItem, { borderBottomColor: C.cinzaClaro }]}
                  onPress={() => selecionarVisibilidade(v)}
                >
                  <Text style={[styles.seletorItemText, { color: C.azulEscuro }]}>{v}</Text>
                  {visibilidade === v && <Ionicons name="checkmark" size={18} color={C.azulEscuro} />}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </Modal>

        {/* ── MODAL SÉRIE ── */}
        <Modal visible={modalSerie} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 24, backgroundColor: C.branco }]}>
              <View style={[styles.modalHandle, { backgroundColor: C.cinzaClaro }]} />
              <Text style={[styles.modalTitulo, { color: C.azulEscuro }]}>Série Padrão</Text>
              {SERIES.map(s => (
                <TouchableOpacity
                  key={s}
                  style={[styles.seletorItem, { borderBottomColor: C.cinzaClaro }]}
                  onPress={() => selecionarSerie(s)}
                >
                  <Text style={[styles.seletorItemText, { color: C.azulEscuro }]}>{s}</Text>
                  {serieFiltro === s && <Ionicons name="checkmark" size={18} color={C.azulEscuro} />}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </Modal>

        {/* ── MODAL ALTERAR SENHA ── */}
        <Modal visible={modalSenha} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 24, backgroundColor: C.branco }]}>
              <View style={[styles.modalHandle, { backgroundColor: C.cinzaClaro }]} />
              <Text style={[styles.modalTitulo, { color: C.azulEscuro }]}>Alterar Senha</Text>

              <Text style={[styles.inputLabel, { color: C.textoSec }]}>SENHA ATUAL</Text>
              <TextInput
                style={[styles.input, { backgroundColor: C.fundo, color: C.azulEscuro, borderColor: C.cinzaClaro }]}
                placeholder="Digite sua senha atual"
                placeholderTextColor={C.textoSec}
                secureTextEntry
                value={senhaAtual}
                onChangeText={setSenhaAtual}
              />

              <Text style={[styles.inputLabel, { color: C.textoSec, marginTop: 14 }]}>NOVA SENHA</Text>
              <TextInput
                style={[styles.input, { backgroundColor: C.fundo, color: C.azulEscuro, borderColor: C.cinzaClaro }]}
                placeholder="Mínimo 6 caracteres"
                placeholderTextColor={C.textoSec}
                secureTextEntry
                value={senhaNova}
                onChangeText={setSenhaNova}
              />

              <Text style={[styles.inputLabel, { color: C.textoSec, marginTop: 14 }]}>CONFIRMAR NOVA SENHA</Text>
              <TextInput
                style={[styles.input, { backgroundColor: C.fundo, color: C.azulEscuro, borderColor: C.cinzaClaro }]}
                placeholder="Repita a nova senha"
                placeholderTextColor={C.textoSec}
                secureTextEntry
                value={senhaConfirma}
                onChangeText={setSenhaConfirma}
              />

              {erroSenha !== '' && (
                <View style={styles.erroBox}>
                  <Ionicons name="alert-circle" size={14} color={CORES.vermelho} />
                  <Text style={styles.erroText}>{erroSenha}</Text>
                </View>
              )}

              <View style={styles.modalBtnsRow}>
                <TouchableOpacity
                  style={[styles.btnCancelar, { borderColor: C.cinzaClaro }]}
                  onPress={() => {
                    setModalSenha(false);
                    setSenhaAtual(''); setSenhaNova(''); setSenhaConfirma('');
                    setErroSenha('');
                  }}
                >
                  <Text style={[styles.btnCancelarText, { color: C.textoSec }]}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btnSalvar, { backgroundColor: CORES.azulEscuro }]}
                  onPress={alterarSenha}
                  disabled={salvandoSenha}
                >
                  {salvandoSenha
                    ? <ActivityIndicator color="#FFF" size="small" />
                    : <Text style={styles.btnSalvarText}>Salvar</Text>
                  }
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* ── MODAL CONFIRMAÇÃO ── */}
        <Modal visible={!!confirmacao} transparent animationType="fade">
          <View style={styles.confirmOverlay}>
            <View style={[styles.confirmCaixa, { backgroundColor: C.branco }]}>
              <View style={[styles.confirmIconWrap, {
                backgroundColor: confirmacao?.perigo ? CORES.vermelho + '15' : CORES.amarelo + '20'
              }]}>
                <Ionicons
                  name={confirmacao?.perigo ? "log-out" : "alert-circle"}
                  size={28}
                  color={confirmacao?.perigo ? CORES.vermelho : CORES.laranja || '#e67e22'}
                />
              </View>
              <Text style={[styles.confirmTitulo, { color: C.azulEscuro }]}>
                {confirmacao?.titulo}
              </Text>
              <Text style={[styles.confirmMsg, { color: C.textoSec }]}>
                {confirmacao?.msg}
              </Text>
              <View style={styles.confirmBtns}>
                <TouchableOpacity
                  style={[styles.btnCancelar, { flex: 1, borderColor: C.cinzaClaro }]}
                  onPress={() => setConfirmacao(null)}
                >
                  <Text style={[styles.btnCancelarText, { color: C.textoSec }]}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.btnSalvar,
                    { flex: 1, backgroundColor: confirmacao?.perigo ? CORES.vermelho : CORES.azulEscuro }
                  ]}
                  onPress={confirmacao?.onOk}
                >
                  <Text style={styles.btnSalvarText}>{confirmacao?.btnTxt || 'Confirmar'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* ── MODAL HISTÓRICO DE NOTIFICAÇÕES (portado do Index original) ── */}
        <Modal visible={modalHistorico} transparent animationType="slide" onRequestClose={() => setModalHistorico(false)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 24, backgroundColor: C.branco, maxHeight: '80%' }]}>
              <View style={[styles.modalHandle, { backgroundColor: C.cinzaClaro }]} />
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
                <Text style={[styles.modalTitulo, { color: C.azulEscuro, flex: 1, marginBottom: 0 }]}>
                  Notificações
                </Text>
                {totalNotificacoesAtivas > 0 && (
                  <TouchableOpacity onPress={limparHistoricoNotificacoes} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Text style={[styles.notifLimparTxt, { color: CORES.rosa }]}>Limpar tudo</Text>
                  </TouchableOpacity>
                )}
              </View>

              {totalNotificacoesAtivas === 0 ? (
                <View style={{ alignItems: 'center', paddingVertical: 36 }}>
                  <Ionicons name="notifications-off" size={36} color={C.cinzaClaro} />
                  <Text style={{ color: C.textoSec, fontSize: 13, marginTop: 10, fontFamily: F.medium }}>
                    Nenhuma notificação
                  </Text>
                </View>
              ) : (
                <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
                  {notificacoesChat.length > 0 && (
                    <>
                      <Text style={[styles.notifGrupoLabel, { color: C.textoSec }]}>MENSAGENS</Text>
                      {notificacoesChat.map(item => (
                        <TouchableOpacity
                          key={item.id}
                          style={[styles.notifCard, { backgroundColor: C.fundo, borderColor: C.cinzaClaro }]}
                          onPress={() => {
                            setModalHistorico(false);
                            navigation.navigate('Chat', { outroUid: item.outroUid, outroNome: item.outroNome });
                          }}
                        >
                          <View style={[styles.notifIconWrap, { backgroundColor: CORES.rosa + '18' }]}>
                            <Ionicons name="chatbubble-ellipses" size={16} color={CORES.rosa} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.notifTitulo, { color: C.azulEscuro }]} numberOfLines={1}>{item.nome}</Text>
                            <Text style={[styles.notifMeta, { color: C.textoSec }]} numberOfLines={1}>{item.corpo}</Text>
                          </View>
                        </TouchableOpacity>
                      ))}
                    </>
                  )}

                  {notificacoesAgenda.filter(n => !notifDescartadas.has(n.id)).length > 0 && (
                    <>
                      <Text style={[styles.notifGrupoLabel, { color: C.textoSec, marginTop: notificacoesChat.length > 0 ? 12 : 0 }]}>
                        AGENDA
                      </Text>
                      {notificacoesAgenda.filter(n => !notifDescartadas.has(n.id)).map(item => (
                        <View
                          key={item.id}
                          style={[styles.notifCard, { backgroundColor: C.fundo, borderColor: C.cinzaClaro }]}
                        >
                          <View style={[styles.notifIconWrap, { backgroundColor: (item.tipo === 'lembrete_vencido' ? CORES.vermelho : (CORES.laranja || '#e67e22')) + '18' }]}>
                            <Ionicons name={item.icon} size={16} color={item.tipo === 'lembrete_vencido' ? CORES.vermelho : (CORES.laranja || '#e67e22')} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.notifTitulo, { color: C.azulEscuro }]} numberOfLines={1}>{item.titulo}</Text>
                            <Text style={[styles.notifMeta, { color: C.textoSec }]}>
                              {item.tipo === 'lembrete_vencido' ? 'Vencido' : 'Próximo'}
                            </Text>
                          </View>
                        </View>
                      ))}
                    </>
                  )}
                </ScrollView>
              )}

              <TouchableOpacity
                style={[styles.btnSalvar, { backgroundColor: CORES.azulEscuro, marginTop: 16 }]}
                onPress={() => setModalHistorico(false)}
              >
                <Text style={styles.btnSalvarText}>Fechar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
        <SymbiusTabBar ativa="nenhuma" navigation={navigation} uid={uid ?? null} />
      </View>
    );
  }

  const styles = StyleSheet.create({
    container:           { flex: 1 },
    centro:              { flex: 1, justifyContent: 'center', alignItems: 'center' },

    // TOAST
    toast:               { position: 'absolute', alignSelf: 'center', backgroundColor: CORES.azulEscuro, paddingVertical: 10, paddingHorizontal: 18, borderRadius: 24, zIndex: 9999, elevation: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
    toastText:           { color: CORES.branco, fontFamily: F.bold, fontSize: 12 },

    // HEADER
    header:              { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingBottom: 10, gap: 8, backgroundColor: CORES_SYMBIUS.fundo },
    btnVoltar:           { width: 44, height: 44, justifyContent: 'center', alignItems: 'flex-start' },
    headerEyebrowRow:    { flexDirection: 'row', alignItems: 'center', gap: 6 },
    headerDot:           { width: 6, height: 6, borderRadius: 3, backgroundColor: CORES.amarelo },
    headerEyebrow:       { color: 'rgba(255,255,255,0.7)', fontSize: 9, fontFamily: F.black, letterSpacing: 1.6 },
    headerTitulo:        { color: CORES_SYMBIUS.texto, fontSize: 17, fontFamily: F.black, letterSpacing: -0.3 },
    headerTituloCentro:  { position: 'absolute', left: 0, right: 0, height: 44, lineHeight: 44, textAlign: 'center' },
    headerIconWrap:      { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },

    // SECTION
    section:             { marginBottom: 18 },
    sectionEyebrow:      { fontFamily: F.black, letterSpacing: 1.4, marginBottom: 4 },
    sectionTitulo:       { fontFamily: F.black, marginBottom: 10, letterSpacing: -0.2 },
    sectionCard:         { borderRadius: 14, overflow: 'hidden', elevation: 2, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4 },

    // ROW
    row:                 { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 13 },
    rowIcon:             { width: 32, height: 32, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
    rowLabel:            { fontFamily: F.bold },
    rowDesc:             { fontFamily: F.medium, marginTop: 2 },
    rowValor:            { flexDirection: 'row', alignItems: 'center', gap: 4 },
    rowValorText:        { fontFamily: F.bold },

    // RODAPE
    rodape:              { alignItems: 'center', paddingVertical: 24, gap: 4 },
    rodapeSymbius:          { fontFamily: F.black, fontSize: 24, letterSpacing: -0.5 },
    rodapeTxt:           { fontFamily: F.medium, fontSize: 11 },

    // MODAIS
    modalOverlay:        { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalSheet:          { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 22, paddingBottom: 32 },
    modalHandle:         { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
    modalTitulo:         { fontSize: 16, fontFamily: F.black, marginBottom: 14 },
    seletorItem:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 0.5 },
    seletorItemText:     { fontSize: 14, fontFamily: F.bold },

    notifLimparTxt:      { fontSize: 13, fontFamily: F.bold },
    notifGrupoLabel:     { fontSize: 10, fontFamily: F.bold, letterSpacing: 0.6, marginBottom: 8 },
    notifCard:           { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 14, padding: 10, marginBottom: 8 },
    notifIconWrap:       { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center' },
    notifTitulo:         { fontSize: 13, fontFamily: F.bold },
    notifMeta:           { fontSize: 11, fontFamily: F.regular, marginTop: 2 },

    // INPUT
    inputLabel:          { fontSize: 9, fontFamily: F.black, letterSpacing: 1.2, marginBottom: 6 },
    input:               { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontFamily: F.medium, fontSize: 13, borderWidth: 1 },
    erroBox:             { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FDECEA', padding: 10, borderRadius: 10, marginTop: 14 },
    erroText:            { fontSize: 12, color: CORES.vermelho, fontFamily: F.bold, flex: 1 },
    modalBtnsRow:        { flexDirection: 'row', gap: 8, marginTop: 18 },
    btnCancelar:         { flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: 'center', borderWidth: 1 },
    btnCancelarText:     { fontFamily: F.bold, fontSize: 13 },
    btnSalvar:           { flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: 'center' },
    btnSalvarText:       { color: CORES.branco, fontFamily: F.black, fontSize: 13 },

    // CONFIRMAÇÃO
    confirmOverlay:      { flex: 1, backgroundColor: 'rgba(11,32,70,0.65)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 30 },
    confirmCaixa:        { width: '100%', maxWidth: 360, borderRadius: 18, padding: 22, alignItems: 'center' },
    confirmIconWrap:     { width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', marginBottom: 14 },
    confirmTitulo:       { fontSize: 17, fontFamily: F.black, marginBottom: 6, textAlign: 'center' },
    confirmMsg:          { fontSize: 13, fontFamily: F.medium, textAlign: 'center', lineHeight: 19, marginBottom: 18 },
    confirmBtns:         { flexDirection: 'row', gap: 8, width: '100%' },
  })
import SymbiusTabBar from '../components/SymbiusTabBar';;