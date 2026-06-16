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
  import { doc, getDoc, updateDoc } from 'firebase/firestore';
  import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';

  // ── Fonte Poppins ──
  const F = {
    regular:  'Poppins_400Regular',
    medium:   'Poppins_500Medium',
    semibold: 'Poppins_600SemiBold',
    bold:     'Poppins_700Bold',
    black:    'Poppins_800ExtraBold',
  };

  const CORES = {
    azulEscuro:      '#0B2046',
    azulMedio:       '#1B3868',
    rosa:            '#E51C6A',
    amarelo:         '#FFC82C',
    fundo:           '#F5F7FA',
    branco:          '#FFFFFF',
    cinzaClaro:      '#EAEFF4',
    textoSec:        '#8D99AE',
    preto:           '#1A1A2E',
    verde:           '#27ae60',
    vermelho:        '#e74c3c',
    roxo:            '#8e44ad',      
    laranja:         '#e67e22',      
  };

  const CORES_DARK = {
    azulEscuro:      '#FFFFFF',
    azulMedio:       '#E0E0E0',
    rosa:            '#FF5C97',
    amarelo:         '#FFC82C',
    fundo:           '#0F1419',
    branco:          '#1A1F26',
    cinzaClaro:      '#2A2F36',
    textoSec:        '#7A8595',
    preto:           '#FFFFFF',
    verde:           '#27ae60',
    vermelho:        '#e74c3c',
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

    // Cores dinâmicas baseadas no modo
    const C = modoEscuro ? CORES_DARK : CORES;

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
    const toggleModoEscuro = (v: boolean) => {
      setModoEscuro(v);
      salvarLocal('cfg_modoEscuro', v);
      if (v && vibracao) Vibration.vibrate(20);
      setToast(v ? 'Modo escuro ativado' : 'Modo claro ativado');
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

    const toggleVibracao = (v: boolean) => {
      setVibracao(v);
      salvarLocal('cfg_vibracao', v);
      if (v) Vibration.vibrate(50);
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
            await AsyncStorage.removeItem('uid');
            await auth.signOut();
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
      abrirURL('mailto:contato@anchieta.br?subject=Feedback JUMO&body=Olá, gostaria de enviar um feedback sobre o app...');
    };

    // ════ ROW COMPONENT ════
    const SettingRow = ({ icon, iconCor, label, descricao, toggle, onToggle, valor, onPress, perigo, ultimo }: any) => {
      const cores = modoEscuro ? CORES_DARK : CORES;
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
      const cores = modoEscuro ? CORES_DARK : CORES;
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
      <SafeAreaView style={[styles.container, { backgroundColor: C.fundo }]}>
        <StatusBar barStyle={modoEscuro ? "light-content" : "light-content"} backgroundColor={CORES.azulEscuro} />

        {/* TOAST */}
        {toast !== '' && (
          <View style={[styles.toast, { top: insets.top + 12 }]}>
            <Ionicons name="checkmark-circle" size={16} color={CORES.amarelo} />
            <Text style={styles.toastText}>{toast}</Text>
          </View>
        )}

        {/* HEADER */}
        <View style={[styles.header, { paddingTop: insets.top + 14, backgroundColor: CORES.azulEscuro }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.btnVoltar}>
            <Ionicons name="arrow-back" size={20} color="#FFF" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <View style={styles.headerEyebrowRow}>
              <View style={styles.headerDot} />
              <Text style={styles.headerEyebrow}>PERSONALIZE SEU APP</Text>
            </View>
            <Text style={styles.headerTitulo}>Configurações</Text>
          </View>
          <View style={styles.headerIconWrap}>
            <Ionicons name="settings" size={18} color={CORES.amarelo} />
          </View>
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
                descricao="Tema escuro nesta tela"
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
                icon="heart"
                iconCor={CORES.rosa}
                label="Match"
                toggle={notifMatch && notifGeral}
                onToggle={toggleNotifMatch}
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
              <Text style={[styles.rodapeJumo, { color: C.azulEscuro }]}>
                JU<Text style={{ color: C.rosa }}>MO</Text>
              </Text>
              <Text style={[styles.rodapeTxt, { color: C.textoSec }]}>
                feito com 💛 pela Anchieta
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
      </SafeAreaView>
    );
  }

  const styles = StyleSheet.create({
    container:           { flex: 1 },
    centro:              { flex: 1, justifyContent: 'center', alignItems: 'center' },

    // TOAST
    toast:               { position: 'absolute', alignSelf: 'center', backgroundColor: CORES.azulEscuro, paddingVertical: 10, paddingHorizontal: 18, borderRadius: 24, zIndex: 9999, elevation: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
    toastText:           { color: CORES.branco, fontFamily: F.bold, fontSize: 12 },

    // HEADER
    header:              { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingBottom: 16, gap: 12 },
    btnVoltar:           { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },
    headerEyebrowRow:    { flexDirection: 'row', alignItems: 'center', gap: 6 },
    headerDot:           { width: 6, height: 6, borderRadius: 3, backgroundColor: CORES.amarelo },
    headerEyebrow:       { color: 'rgba(255,255,255,0.7)', fontSize: 9, fontFamily: F.black, letterSpacing: 1.6 },
    headerTitulo:        { color: CORES.branco, fontSize: 19, fontFamily: F.black, letterSpacing: -0.4, marginTop: 2 },
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
    rodapeJumo:          { fontFamily: F.black, fontSize: 24, letterSpacing: -0.5 },
    rodapeTxt:           { fontFamily: F.medium, fontSize: 11 },

    // MODAIS
    modalOverlay:        { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalSheet:          { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 22, paddingBottom: 32 },
    modalHandle:         { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
    modalTitulo:         { fontSize: 16, fontFamily: F.black, marginBottom: 14 },
    seletorItem:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 0.5 },
    seletorItemText:     { fontSize: 14, fontFamily: F.bold },

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
  });