import { voltar, HIT_VOLTAR } from '../navegacao';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList, Image, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert, Modal, StatusBar, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  doc, onSnapshot, collection, query, where, orderBy, updateDoc, arrayUnion, arrayRemove, getDoc, getDocs,
} from 'firebase/firestore';
import { db, auth } from '../config/firebaseConfig';
import { CORES_SYMBIUS } from '../constants/coresSymbius';
import { F } from '../constants/theme';
import { useNotificacao } from '../contexts/NotificacaoProvider';
import {
  Grupo, enviarMensagemGrupo, sairDoGrupo, adminsDoGrupo, souAdminDoGrupo, repararAdminDoGrupo,
  atualizarInfoGrupo, adicionarMembros, removerMembro, promoverAdmin, desbanirMembro,
  editarMensagemGrupo, apagarMensagemParaMim, apagarMensagemParaTodos, podeApagarParaTodos,
  MAX_MEMBROS_GRUPO, MAX_DESCRICAO_GRUPO,
} from '../services/gruposService';
import { enviarConviteGrupo } from '../services/convitesService';
import { escolherImagemBase64 } from '../utils/midiaNativa';
import { conversaNaoLida, marcarComoLida, mensagemLidaPor, msDe } from '../utils/conversas';
import { confirmar } from '../utils/confirmar';
import ModalDenuncia from '../components/ModalDenuncia';
import SeletorPessoas, { Pessoa } from '../components/SeletorPessoas';

const fotoUri = (foto?: string | null) =>
  !foto ? null : foto.startsWith('http') || foto.startsWith('data:') ? foto : `data:image/jpeg;base64,${foto}`;

const hora = (t: any) => {
  const d = t?.toDate ? t.toDate() : null;
  return d ? d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';
};

// Cor fixa por pessoa pro nome acima da bolha (como em grupos do WhatsApp).
const CORES_NOMES = ['#B4682A', '#2E6B45', '#4A90C2', '#8e44ad', '#C0392B', '#16A085'];
const corDoNome = (uid: string) => CORES_NOMES[[...uid].reduce((s, c) => s + c.charCodeAt(0), 0) % CORES_NOMES.length];

const HIT = { top: 10, bottom: 10, left: 10, right: 10 };

// No iOS, abrir um Modal enquanto outro ainda está fechando não mostra nada.
const depoisDeFechar = (fn: () => void) => setTimeout(fn, Platform.OS === 'ios' ? 400 : 0);

export default function GrupoChat({ navigation, route }: any) {
  const insets = useSafeAreaInsets();
  const grupoId: string = route?.params?.grupoId;
  const meuUid = auth.currentUser?.uid || route?.params?.uid;
  const { setConversaAtiva } = useNotificacao();

  const [grupo, setGrupo] = useState<Grupo | null>(null);
  const [mensagens, setMensagens] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [eu, setEu] = useState<{ nome: string; foto: string | null }>({ nome: 'Você', foto: null });
  const [silenciado, setSilenciado] = useState(false);
  const [infoAberta, setInfoAberta] = useState(false);
  const [imagemCheia, setImagemCheia] = useState<string | null>(null);
  const listaRef = useRef<FlatList>(null);

  // Ações em mensagens
  const [menuMsg, setMenuMsg] = useState<any | null>(null);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [denunciaMsg, setDenunciaMsg] = useState<any | null>(null);

  // Administração
  const [editarAberto, setEditarAberto] = useState(false);
  const [nomeEdit, setNomeEdit] = useState('');
  const [descEdit, setDescEdit] = useState('');
  const [fotoEdit, setFotoEdit] = useState<string | null>(null);
  const [salvandoInfo, setSalvandoInfo] = useState(false);
  const [adicionarAberto, setAdicionarAberto] = useState(false);
  const [meusElos, setMeusElos] = useState<Pessoa[]>([]);
  const [selMatches, setSelMatches] = useState<string[]>([]);
  const [selConvidados, setSelConvidados] = useState<Pessoa[]>([]);
  const [adicionando, setAdicionando] = useState(false);
  const [acoesMembro, setAcoesMembro] = useState<string | null>(null);

  useEffect(() => {
    setConversaAtiva(grupoId);
    return () => setConversaAtiva(null);
  }, [grupoId]);

  useEffect(() => {
    if (!meuUid) return;
    getDoc(doc(db, 'usuarios', meuUid)).then(s => {
      const d: any = s.data() || {};
      setEu({ nome: d.nome_completo || 'Você', foto: d.foto || null });
      setSilenciado((d.silenciados || []).includes(grupoId));
    });
  }, [meuUid, grupoId]);

  useEffect(() => {
    if (!grupoId) return;
    return onSnapshot(doc(db, 'conversas', grupoId), snap => {
      if (!snap.exists()) { setGrupo(null); return; }
      setGrupo({ id: snap.id, ...(snap.data() as any) });
    });
  }, [grupoId]);

  useEffect(() => {
    if (!grupoId) return;
    const q = query(collection(db, 'mensagens'), where('conversaId', '==', grupoId), orderBy('data_postagem', 'asc'));
    return onSnapshot(q, snap => {
      setMensagens(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setCarregando(false);
    }, e => { console.log('Erro mensagens do grupo:', e.message); setCarregando(false); });
  }, [grupoId]);

  const souMembro = !!grupo && !!meuUid && grupo.membros.includes(meuUid);
  const souAdmin = souAdminDoGrupo(grupo, meuUid);
  const admins = grupo ? adminsDoGrupo(grupo) : [];

  // Grupo antigo cujo criador saiu: o membro mais antigo assume, pra nunca
  // ficar sem admin.
  useEffect(() => {
    if (grupo && meuUid && souMembro) repararAdminDoGrupo(grupo, meuUid).catch(() => {});
  }, [grupo?.membros?.join(','), grupo?.admins?.join(','), meuUid]);

  // "Apagar para mim" esconde só pra quem apagou.
  const visiveis = useMemo(
    () => mensagens.filter(m => !(m.ocultaPara || []).includes(meuUid)),
    [mensagens, meuUid],
  );

  // Marca como lido ao abrir e a cada mensagem nova com o grupo aberto.
  const ultimaMarcada = useRef(0);
  useEffect(() => {
    if (!grupo || !meuUid || !souMembro) return;
    if (!conversaNaoLida(grupo, meuUid)) return;
    if (msDe(grupo.data_postagem, Date.now()) <= ultimaMarcada.current) return;
    ultimaMarcada.current = Date.now();
    marcarComoLida(grupo.id, meuUid);
  }, [grupo?.data_postagem, grupo?.quemEnviou, meuUid, souMembro]);

  // ✓ enviada · ✓✓ azul quando TODOS os outros participantes já leram.
  const renderTicks = (item: any) => {
    if (!grupo || !meuUid) return null;
    const outros = grupo.membros.filter(m => m !== meuUid);
    const lida = outros.length > 0 && outros.every(m => mensagemLidaPor(grupo, m, item.data_postagem));
    return (
      <Ionicons
        name={lida ? 'checkmark-done' : 'checkmark'}
        size={15}
        color={lida ? '#53BDEB' : 'rgba(244,241,232,0.7)'}
        style={{ marginLeft: 4 }}
        accessibilityLabel={lida ? 'Lida por todos' : 'Enviada'}
      />
    );
  };

  const enviar = async (conteudo: { tipo: 'texto' | 'imagem'; mensagem: string }) => {
    if (!grupo || !meuUid || !souMembro) return;
    setEnviando(true);
    try {
      await enviarMensagemGrupo(grupo, { uid: meuUid, nome: eu.nome, foto: eu.foto }, conteudo);
    } catch (e) {
      console.log('Erro ao enviar no grupo:', e);
      Alert.alert('Erro', 'Não foi possível enviar.');
    } finally {
      setEnviando(false);
    }
  };

  const enviarTexto = async () => {
    const t = texto.trim();
    if (!t || enviando) return;
    setTexto('');
    if (editandoId) {
      const id = editandoId;
      setEditandoId(null);
      try { await editarMensagemGrupo(id, t); }
      catch { Alert.alert('Erro', 'Não foi possível editar a mensagem.'); }
      return;
    }
    enviar({ tipo: 'texto', mensagem: t });
  };

  const enviarImagem = async () => {
    const b64 = await escolherImagemBase64({ ladoMax: 1024, qualidade: 0.6 });
    if (b64) enviar({ tipo: 'imagem', mensagem: b64 });
  };

  const alternarSilenciar = async () => {
    if (!meuUid) return;
    const novo = !silenciado;
    setSilenciado(novo);
    try {
      await updateDoc(doc(db, 'usuarios', meuUid), { silenciados: novo ? arrayUnion(grupoId) : arrayRemove(grupoId) });
    } catch { setSilenciado(!novo); }
  };

  const confirmarSaida = async () => {
    if (!grupo || !meuUid) return;
    const unicoAdmin = souAdmin && admins.length === 1 && grupo.membros.length > 1;
    const ok = await confirmar(
      'Sair do grupo?',
      unicoAdmin
        ? 'Você é o único admin. O participante mais antigo vira admin quando você sair.'
        : 'Você deixa de receber as mensagens deste grupo.',
      'Sair', true,
    );
    if (!ok) return;
    setInfoAberta(false);
    await sairDoGrupo(grupo, meuUid, eu.nome);
    voltar(navigation);
  };

  // ── Ações em mensagem ──
  const iniciarEdicao = (msg: any) => {
    setMenuMsg(null);
    setEditandoId(msg.id);
    setTexto(msg.mensagem);
  };

  const apagarParaMim = async (msg: any) => {
    setMenuMsg(null);
    if (!meuUid) return;
    try { await apagarMensagemParaMim(msg.id, meuUid); }
    catch { Alert.alert('Erro', 'Não foi possível apagar.'); }
  };

  const apagarParaTodos = async (msg: any) => {
    setMenuMsg(null);
    if (!grupo || !meuUid) return;
    const ok = await confirmar('Apagar para todos?', 'A mensagem some para todos do grupo.', 'Apagar', true);
    if (!ok) return;
    try {
      await apagarMensagemParaTodos(grupo, msg, meuUid, mensagens[mensagens.length - 1]?.id === msg.id);
    } catch (e: any) {
      Alert.alert('Não foi possível apagar', e?.message || 'Tente de novo.');
    }
  };

  // ── Administração ──
  const abrirEditar = () => {
    if (!grupo) return;
    setNomeEdit(grupo.nome || '');
    setDescEdit(grupo.descricao || '');
    setFotoEdit(grupo.foto ?? null);
    setInfoAberta(false);
    depoisDeFechar(() => setEditarAberto(true));
  };

  const escolherFotoGrupo = async () => {
    const b64 = await escolherImagemBase64({ ladoMax: 512, qualidade: 0.6, quadrada: true });
    if (b64) setFotoEdit(b64);
  };

  const salvarInfo = async () => {
    if (!grupo || !meuUid || !nomeEdit.trim()) return;
    setSalvandoInfo(true);
    try {
      await atualizarInfoGrupo(grupo, meuUid, eu.nome, {
        nome: nomeEdit !== grupo.nome ? nomeEdit : undefined,
        descricao: descEdit !== (grupo.descricao || '') ? descEdit : undefined,
        foto: fotoEdit !== (grupo.foto ?? null) ? fotoEdit : undefined,
      });
      setEditarAberto(false);
    } catch {
      Alert.alert('Erro', 'Não foi possível salvar. Só admins podem editar o grupo.');
    } finally {
      setSalvandoInfo(false);
    }
  };

  const abrirAdicionar = async () => {
    if (!meuUid) return;
    setSelMatches([]); setSelConvidados([]);
    setInfoAberta(false);
    depoisDeFechar(() => setAdicionarAberto(true));
    try {
      const snap = await getDocs(query(collection(db, 'match_solicitacoes'),
        where('status', '==', 'aceito'), where('membros', 'array-contains', meuUid)));
      const uids = [...new Set(snap.docs.map(d => d.data().membros?.find((u: string) => u !== meuUid)).filter(Boolean))] as string[];
      const pessoas = await Promise.all(uids.map(async uid => {
        const u: any = (await getDoc(doc(db, 'usuarios', uid))).data() || {};
        return { uid, nome: u.nome_completo || 'Usuário', foto: u.foto || null };
      }));
      setMeusElos(pessoas);
    } catch { setMeusElos([]); }
  };

  const vagasAdicionar = grupo ? MAX_MEMBROS_GRUPO - grupo.membros.length - selMatches.length - selConvidados.length : 0;

  const confirmarAdicionar = async () => {
    if (!grupo || !meuUid || adicionando) return;
    setAdicionando(true);
    const falhas: string[] = [];
    try {
      if (selMatches.length) await adicionarMembros(grupo, { uid: meuUid, nome: eu.nome }, selMatches);
      for (const p of selConvidados) {
        try { await enviarConviteGrupo(grupo, { uid: meuUid, nome: eu.nome }, p.uid); }
        catch (e: any) { falhas.push(`${p.nome.split(' ')[0]}: ${e?.message || 'erro ao convidar'}`); }
      }
      setAdicionarAberto(false);
      if (falhas.length) Alert.alert('Alguns convites não foram enviados', falhas.join('\n'));
      else if (selConvidados.length) Alert.alert('Convites enviados', 'Quem não é seu elo entra quando aceitar o convite.');
    } catch {
      Alert.alert('Erro', 'Não foi possível adicionar. Só admins podem adicionar pessoas.');
    } finally {
      setAdicionando(false);
    }
  };

  const executarAcaoMembro = async (acao: 'promover' | 'remover' | 'banir', alvo: string) => {
    if (!grupo || !meuUid) return;
    setAcoesMembro(null);
    const nome = grupo.dadosMembros?.[alvo]?.nome?.split(' ')[0] || 'essa pessoa';
    const textos = {
      promover: ['Tornar admin?', `${nome} vai poder editar o grupo e gerenciar participantes.`, 'Tornar admin'],
      remover: ['Remover do grupo?', `${nome} sai do grupo, mas pode ser adicionado de novo.`, 'Remover'],
      banir: ['Banir do grupo?', `${nome} sai e não pode mais ser adicionado nem convidado.`, 'Banir'],
    } as const;
    const [titulo, msg, ok] = textos[acao];
    if (!(await confirmar(titulo, msg, ok, acao !== 'promover'))) return;
    try {
      if (acao === 'promover') await promoverAdmin(grupo, { uid: meuUid, nome: eu.nome }, alvo);
      else await removerMembro(grupo, { uid: meuUid, nome: eu.nome }, alvo, acao === 'banir');
    } catch (e: any) {
      Alert.alert('Erro', e?.message || 'Não foi possível concluir. Só admins podem fazer isso.');
    }
  };

  if (!carregando && !grupo) {
    return (
      <View style={[styles.container, styles.centro]}>
        <Ionicons name="people-outline" size={48} color={CORES_SYMBIUS.textoTerciario} />
        <Text style={styles.vazio}>Este grupo não existe mais.</Text>
        <TouchableOpacity hitSlop={HIT_VOLTAR} onPress={() => voltar(navigation)} style={styles.linkBtn}><Text style={styles.link}>Voltar</Text></TouchableOpacity>
      </View>
    );
  }

  const renderMensagem = ({ item, index }: any) => {
    const minha = item.remetenteUid === meuUid;
    const anterior = visiveis[index - 1];
    const mostraNome = !minha && anterior?.remetenteUid !== item.remetenteUid;
    const avatar = fotoUri(item.foto);
    const apagada = !!item.apagadaParaTodos;
    return (
      <View style={[styles.linha, minha ? styles.linhaMinha : styles.linhaOutro]}>
        {!minha && (
          <View style={{ width: 30 }}>
            {mostraNome && (avatar
              ? <Image source={{ uri: avatar }} style={styles.miniAvatar} />
              : <View style={[styles.miniAvatar, styles.miniAvatarVazio]}><Text style={styles.miniAvatarTxt}>{(item.nome_remetente || '?').charAt(0)}</Text></View>)}
          </View>
        )}
        <TouchableOpacity
          activeOpacity={0.85}
          onLongPress={() => souMembro && setMenuMsg(item)}
          delayLongPress={350}
          disabled={!souMembro}
          style={[styles.bolha, minha ? styles.bolhaMinha : styles.bolhaOutro]}
          accessibilityHint="Toque e segure para ver opções"
        >
          {mostraNome && <Text style={[styles.nome, { color: corDoNome(item.remetenteUid) }]}>{item.nome_remetente}</Text>}
          {apagada
            ? (
              <View style={styles.apagadaLinha}>
                <Ionicons name="ban" size={13} color={minha ? 'rgba(244,241,232,0.7)' : CORES_SYMBIUS.textoSec} />
                <Text style={[styles.apagadaTxt, minha && { color: 'rgba(244,241,232,0.8)' }]}>Mensagem apagada</Text>
              </View>
            )
            : item.tipo === 'imagem'
              ? (
                <TouchableOpacity onPress={() => setImagemCheia(fotoUri(item.mensagem))} onLongPress={() => souMembro && setMenuMsg(item)} activeOpacity={0.85}>
                  <Image source={{ uri: fotoUri(item.mensagem)! }} style={styles.imagem} resizeMode="cover" />
                </TouchableOpacity>
              )
              : <Text style={[styles.texto, minha && { color: CORES_SYMBIUS.creme }]}>{item.mensagem}</Text>}
          <View style={styles.horaLinha}>
            {item.editada && !apagada && <Text style={[styles.hora, minha && { color: 'rgba(244,241,232,0.7)' }]}>editada · </Text>}
            <Text style={[styles.hora, minha && { color: 'rgba(244,241,232,0.7)' }]}>{hora(item.data_postagem)}</Text>
            {minha && !apagada && renderTicks(item)}
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  const membros = grupo ? grupo.membros.map(uid => ({ uid, ...(grupo.dadosMembros?.[uid] || { nome: 'Usuário', foto: null }) })) : [];
  const fotoGrupo = fotoUri(grupo?.foto);
  const msgMenuMinha = menuMsg?.remetenteUid === meuUid;
  const msgMenuApagada = !!menuMsg?.apagadaParaTodos;
  const podeTodos = menuMsg ? podeApagarParaTodos(menuMsg, meuUid) : false;

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <StatusBar barStyle={CORES_SYMBIUS.barStyle} backgroundColor={CORES_SYMBIUS.fundoCard} />
      <View style={[styles.header, { paddingTop: insets.top + 24 }]}>
        <TouchableOpacity hitSlop={HIT_VOLTAR} onPress={() => voltar(navigation)} style={styles.headerBtn} accessibilityRole="button" accessibilityLabel="Voltar">
          <Ionicons name="arrow-back" size={22} color={CORES_SYMBIUS.texto} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.headerCentro} onPress={() => setInfoAberta(true)} activeOpacity={0.7} accessibilityRole="button" accessibilityHint="Abre os detalhes do grupo">
          {fotoGrupo
            ? <Image source={{ uri: fotoGrupo }} style={styles.grupoIcone} />
            : <View style={styles.grupoIcone}><Ionicons name="people" size={20} color={CORES_SYMBIUS.creme} /></View>}
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitulo} numberOfLines={1}>{grupo?.nome || 'Grupo'}</Text>
            <Text style={styles.headerSub} numberOfLines={1}>
              {grupo ? `${grupo.membros.length} participantes${grupo.materia ? ` · ${grupo.materia}` : ''}` : ''}
            </Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity onPress={alternarSilenciar} style={styles.headerBtn} hitSlop={HIT} accessibilityLabel={silenciado ? 'Reativar notificações' : 'Silenciar grupo'}>
          <Ionicons name={silenciado ? 'notifications-off' : 'notifications-outline'} size={20} color={silenciado ? CORES_SYMBIUS.laranjaTexto : CORES_SYMBIUS.texto} />
        </TouchableOpacity>
      </View>

      {carregando
        ? <View style={styles.centro}><ActivityIndicator color={CORES_SYMBIUS.verdeEscuro} /></View>
        : (
          <FlatList
            ref={listaRef}
            data={visiveis}
            keyExtractor={m => m.id}
            renderItem={renderMensagem}
            contentContainerStyle={{ padding: 12, paddingBottom: 16, flexGrow: 1 }}
            onContentSizeChange={() => listaRef.current?.scrollToEnd({ animated: false })}
            ListEmptyComponent={<Text style={[styles.vazio, { marginTop: 40 }]}>Mandem a primeira mensagem do grupo</Text>}
          />
        )}

      {souMembro ? (
        <View style={[styles.inputArea, { paddingBottom: 10 + insets.bottom }]}>
          {editandoId ? (
            <View style={styles.editandoBarra}>
              <Ionicons name="create-outline" size={16} color={CORES_SYMBIUS.verdeEscuro} />
              <Text style={styles.editandoTxt}>Editando mensagem</Text>
              <TouchableOpacity onPress={() => { setEditandoId(null); setTexto(''); }} hitSlop={HIT} accessibilityLabel="Cancelar edição">
                <Ionicons name="close" size={18} color={CORES_SYMBIUS.textoSec} />
              </TouchableOpacity>
            </View>
          ) : null}
          <View style={styles.inputLinha}>
            {!editandoId && (
              <TouchableOpacity onPress={enviarImagem} style={styles.btnAnexo} disabled={enviando} accessibilityLabel="Enviar imagem">
                <Ionicons name="image-outline" size={22} color={CORES_SYMBIUS.texto} />
              </TouchableOpacity>
            )}
            <TextInput
              style={styles.input}
              value={texto}
              onChangeText={setTexto}
              placeholder={editandoId ? 'Editar mensagem...' : 'Mensagem para o grupo...'}
              placeholderTextColor={CORES_SYMBIUS.textoMuted}
              multiline
            />
            <TouchableOpacity
              onPress={enviarTexto}
              style={[styles.btnEnviar, (!texto.trim() || enviando) && { opacity: 0.5 }]}
              disabled={!texto.trim() || enviando}
              accessibilityLabel={editandoId ? 'Salvar edição' : 'Enviar'}
            >
              {enviando
                ? <ActivityIndicator size="small" color={CORES_SYMBIUS.creme} />
                : <Ionicons name={editandoId ? 'checkmark' : 'send'} size={18} color={CORES_SYMBIUS.creme} />}
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={[styles.inputArea, { paddingBottom: 10 + insets.bottom, justifyContent: 'center' }]}>
          <Text style={styles.vazio}>Você não participa mais deste grupo.</Text>
        </View>
      )}

      {/* ── MENU DA MENSAGEM ── */}
      <Modal visible={!!menuMsg} transparent animationType="fade" onRequestClose={() => setMenuMsg(null)}>
        <TouchableOpacity style={styles.overlayCentro} activeOpacity={1} onPress={() => setMenuMsg(null)}>
          <View style={styles.menuCard}>
            <Text style={styles.menuTitulo}>Mensagem</Text>
            {msgMenuMinha && !msgMenuApagada && menuMsg?.tipo === 'texto' && (
              <ItemMenu icone="create-outline" texto="Editar" onPress={() => iniciarEdicao(menuMsg)} />
            )}
            <ItemMenu icone="eye-off-outline" texto="Apagar para mim" onPress={() => apagarParaMim(menuMsg)} />
            {msgMenuMinha && !msgMenuApagada && (
              <ItemMenu
                icone="trash-outline"
                texto="Apagar para todos"
                perigo
                desabilitado={!podeTodos}
                detalhe={podeTodos ? 'Disponível até 30 min após o envio' : 'Prazo de 30 minutos encerrado'}
                onPress={() => podeTodos && apagarParaTodos(menuMsg)}
              />
            )}
            {!msgMenuMinha && !msgMenuApagada && (
              <ItemMenu icone="flag-outline" texto="Denunciar" perigo onPress={() => { const m = menuMsg; setMenuMsg(null); depoisDeFechar(() => setDenunciaMsg(m)); }} />
            )}
            <TouchableOpacity style={styles.menuCancelar} onPress={() => setMenuMsg(null)}>
              <Text style={styles.menuCancelarTxt}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <ModalDenuncia
        mensagem={denunciaMsg}
        conversaId={grupoId}
        denuncianteUid={meuUid}
        tipoConversa="grupo"
        onFechar={() => setDenunciaMsg(null)}
      />

      {/* ── DETALHES DO GRUPO ── */}
      <Modal visible={infoAberta} transparent animationType="slide" onRequestClose={() => setInfoAberta(false)}>
        <View style={styles.overlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setInfoAberta(false)} accessibilityLabel="Fechar" />
          <View style={[styles.sheet, { paddingBottom: 20 + insets.bottom }]}>
            <View style={styles.handle} />
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.infoTopo}>
                {fotoGrupo
                  ? <Image source={{ uri: fotoGrupo }} style={styles.infoFoto} />
                  : <View style={[styles.infoFoto, styles.grupoIconeGrande]}><Ionicons name="people" size={34} color={CORES_SYMBIUS.creme} /></View>}
                <Text style={styles.sheetTitulo}>{grupo?.nome}</Text>
                {!!grupo?.materia && <Text style={styles.headerSub}>{grupo.materia}</Text>}
                {!!grupo?.descricao && <Text style={styles.descricao}>{grupo.descricao}</Text>}
                {souAdmin && (
                  <View style={styles.acoesAdmin}>
                    <TouchableOpacity style={styles.btnAdmin} onPress={abrirEditar} accessibilityRole="button">
                      <Ionicons name="create-outline" size={16} color={CORES_SYMBIUS.verdeEscuro} />
                      <Text style={styles.btnAdminTxt}>Editar grupo</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.btnAdmin, grupo!.membros.length >= MAX_MEMBROS_GRUPO && { opacity: 0.5 }]}
                      onPress={abrirAdicionar}
                      disabled={grupo!.membros.length >= MAX_MEMBROS_GRUPO}
                      accessibilityRole="button"
                    >
                      <Ionicons name="person-add-outline" size={16} color={CORES_SYMBIUS.verdeEscuro} />
                      <Text style={styles.btnAdminTxt}>Adicionar</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              <Text style={styles.rotulo}>PARTICIPANTES ({membros.length}/{MAX_MEMBROS_GRUPO})</Text>
              {membros.map(m => {
                const f = fotoUri(m.foto);
                const ehAdmin = admins.includes(m.uid);
                return (
                  <View key={m.uid} style={styles.membro}>
                    <TouchableOpacity
                      style={styles.membroInfo}
                      onPress={() => { setInfoAberta(false); if (m.uid !== meuUid) navigation.navigate('PerfilPublico', { uid: m.uid, meuUid }); }}
                      accessibilityRole="button"
                    >
                      {f ? <Image source={{ uri: f }} style={styles.membroFoto} />
                        : <View style={[styles.membroFoto, styles.miniAvatarVazio]}><Text style={styles.miniAvatarTxt}>{m.nome.charAt(0)}</Text></View>}
                      <Text style={styles.membroNome} numberOfLines={1}>{m.uid === meuUid ? `${m.nome} (você)` : m.nome}</Text>
                      {ehAdmin && <View style={styles.badgeAdmin}><Text style={styles.badgeAdminTxt}>admin</Text></View>}
                    </TouchableOpacity>
                    {souAdmin && m.uid !== meuUid && (
                      <TouchableOpacity
                        style={styles.btnMais}
                        onPress={() => setAcoesMembro(m.uid)}
                        accessibilityRole="button"
                        accessibilityLabel={`Ações para ${m.nome}`}
                      >
                        <Ionicons name="ellipsis-vertical" size={18} color={CORES_SYMBIUS.textoSec} />
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}

              {souAdmin && (grupo?.banidos || []).length > 0 && (
                <>
                  <Text style={styles.rotulo}>BANIDOS</Text>
                  {(grupo?.banidos || []).map(uid => (
                    <View key={uid} style={styles.membro}>
                      <Text style={[styles.membroNome, { color: CORES_SYMBIUS.textoSec }]} numberOfLines={1}>
                        {grupo?.dadosMembros?.[uid]?.nome || 'Pessoa banida'}
                      </Text>
                      <TouchableOpacity style={styles.btnDesbanir} onPress={() => desbanirMembro(grupo!, uid).catch(() => Alert.alert('Erro', 'Não foi possível desbanir.'))}>
                        <Text style={styles.btnAdminTxt}>Desbanir</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </>
              )}

              {souMembro && (
                <TouchableOpacity style={styles.btnSair} onPress={confirmarSaida} accessibilityRole="button">
                  <Ionicons name="exit-outline" size={18} color="#D64545" />
                  <Text style={styles.btnSairTxt}>Sair do grupo</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── AÇÕES SOBRE UM PARTICIPANTE (admin) ── */}
      <Modal visible={!!acoesMembro} transparent animationType="fade" onRequestClose={() => setAcoesMembro(null)}>
        <TouchableOpacity style={styles.overlayCentro} activeOpacity={1} onPress={() => setAcoesMembro(null)}>
          <View style={styles.menuCard}>
            <Text style={styles.menuTitulo} numberOfLines={1}>{acoesMembro ? grupo?.dadosMembros?.[acoesMembro]?.nome : ''}</Text>
            {acoesMembro && !admins.includes(acoesMembro) && (
              <ItemMenu icone="shield-checkmark-outline" texto="Tornar admin" onPress={() => executarAcaoMembro('promover', acoesMembro)} />
            )}
            <ItemMenu icone="person-remove-outline" texto="Remover do grupo" perigo onPress={() => acoesMembro && executarAcaoMembro('remover', acoesMembro)} />
            <ItemMenu icone="ban-outline" texto="Banir do grupo" perigo onPress={() => acoesMembro && executarAcaoMembro('banir', acoesMembro)} />
            <TouchableOpacity style={styles.menuCancelar} onPress={() => setAcoesMembro(null)}>
              <Text style={styles.menuCancelarTxt}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── EDITAR GRUPO (admin) ── */}
      <Modal visible={editarAberto} transparent animationType="slide" onRequestClose={() => setEditarAberto(false)}>
        <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[styles.sheet, { paddingBottom: 20 + insets.bottom }]}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitulo}>Editar grupo</Text>
            <TouchableOpacity style={styles.editarFotoBtn} onPress={escolherFotoGrupo} accessibilityRole="button" accessibilityLabel="Trocar foto do grupo">
              {fotoUri(fotoEdit)
                ? <Image source={{ uri: fotoUri(fotoEdit)! }} style={styles.infoFoto} />
                : <View style={[styles.infoFoto, styles.grupoIconeGrande]}><Ionicons name="camera" size={28} color={CORES_SYMBIUS.creme} /></View>}
              <Text style={styles.btnAdminTxt}>{fotoEdit ? 'Trocar foto' : 'Adicionar foto'}</Text>
            </TouchableOpacity>
            {!!fotoEdit && (
              <TouchableOpacity onPress={() => setFotoEdit(null)} style={styles.linkBtn}>
                <Text style={[styles.link, { color: '#D64545', fontSize: 13 }]}>Remover foto</Text>
              </TouchableOpacity>
            )}
            <Text style={styles.rotulo}>NOME</Text>
            <TextInput style={styles.campo} value={nomeEdit} onChangeText={setNomeEdit} maxLength={40} placeholder="Nome do grupo" placeholderTextColor={CORES_SYMBIUS.textoMuted} />
            <Text style={styles.rotulo}>DESCRIÇÃO</Text>
            <TextInput
              style={[styles.campo, { minHeight: 80, textAlignVertical: 'top' }]}
              value={descEdit}
              onChangeText={setDescEdit}
              maxLength={MAX_DESCRICAO_GRUPO}
              multiline
              placeholder="Sobre o que é o grupo, horários de estudo..."
              placeholderTextColor={CORES_SYMBIUS.textoMuted}
            />
            <Text style={styles.contador}>{descEdit.length}/{MAX_DESCRICAO_GRUPO}</Text>
            <View style={styles.botoes}>
              <TouchableOpacity style={[styles.botao, styles.botaoSec]} onPress={() => setEditarAberto(false)}>
                <Text style={styles.botaoSecTxt}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.botao, styles.botaoPri, (!nomeEdit.trim() || salvandoInfo) && { opacity: 0.5 }]}
                onPress={salvarInfo}
                disabled={!nomeEdit.trim() || salvandoInfo}
              >
                {salvandoInfo ? <ActivityIndicator color={CORES_SYMBIUS.creme} /> : <Text style={styles.botaoPriTxt}>Salvar</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── ADICIONAR PESSOAS (admin) ── */}
      <Modal visible={adicionarAberto} transparent animationType="slide" onRequestClose={() => setAdicionarAberto(false)}>
        <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[styles.sheet, { paddingBottom: 20 + insets.bottom }]}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitulo}>Adicionar ao grupo</Text>
            <Text style={[styles.headerSub, { marginBottom: 8 }]}>Seus elos entram direto. Outras pessoas recebem um convite.</Text>
            {meuUid && grupo && (
              <SeletorPessoas
                meuUid={meuUid}
                matches={meusElos}
                excluir={[...grupo.membros, ...(grupo.banidos || [])]}
                selecionados={selMatches}
                convidados={selConvidados}
                onAlternarMatch={uid => setSelMatches(prev => prev.includes(uid) ? prev.filter(u => u !== uid) : vagasAdicionar > 0 ? [...prev, uid] : prev)}
                onAlternarConvidado={p => setSelConvidados(prev => prev.some(c => c.uid === p.uid) ? prev.filter(c => c.uid !== p.uid) : vagasAdicionar > 0 ? [...prev, p] : prev)}
                vagas={vagasAdicionar}
                alturaMax={300}
              />
            )}
            <View style={styles.botoes}>
              <TouchableOpacity style={[styles.botao, styles.botaoSec]} onPress={() => setAdicionarAberto(false)}>
                <Text style={styles.botaoSecTxt}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.botao, styles.botaoPri, (selMatches.length + selConvidados.length === 0 || adicionando) && { opacity: 0.5 }]}
                onPress={confirmarAdicionar}
                disabled={selMatches.length + selConvidados.length === 0 || adicionando}
              >
                {adicionando ? <ActivityIndicator color={CORES_SYMBIUS.creme} /> : <Text style={styles.botaoPriTxt}>Adicionar</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={!!imagemCheia} transparent animationType="fade" onRequestClose={() => setImagemCheia(null)}>
        <TouchableOpacity style={styles.imagemOverlay} activeOpacity={1} onPress={() => setImagemCheia(null)} accessibilityLabel="Fechar imagem">
          {imagemCheia && <Image source={{ uri: imagemCheia }} style={{ width: '95%', height: '80%' }} resizeMode="contain" />}
        </TouchableOpacity>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const ItemMenu = ({ icone, texto, onPress, perigo, desabilitado, detalhe }: {
  icone: keyof typeof Ionicons.glyphMap; texto: string; onPress: () => void;
  perigo?: boolean; desabilitado?: boolean; detalhe?: string;
}) => {
  const cor = desabilitado ? CORES_SYMBIUS.textoTerciario : perigo ? '#D64545' : CORES_SYMBIUS.texto;
  return (
    <TouchableOpacity
      style={styles.menuItem}
      onPress={onPress}
      disabled={desabilitado}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!desabilitado }}
      accessibilityHint={detalhe}
    >
      <Ionicons name={icone} size={20} color={cor} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.menuItemTxt, { color: cor }]}>{texto}</Text>
        {!!detalhe && <Text style={styles.menuItemDetalhe}>{detalhe}</Text>}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: CORES_SYMBIUS.fundo },
  centro: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10 },
  vazio: { color: CORES_SYMBIUS.textoSec, fontFamily: F.medium, fontSize: 13, textAlign: 'center' },
  link: { color: CORES_SYMBIUS.verdeEscuro, fontFamily: F.bold, fontSize: 14 },
  linkBtn: { minHeight: 44, justifyContent: 'center', alignSelf: 'center', paddingHorizontal: 12 },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingBottom: 12,
    backgroundColor: CORES_SYMBIUS.fundoCard, borderBottomWidth: 1, borderBottomColor: CORES_SYMBIUS.borda,
  },
  headerBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', backgroundColor: CORES_SYMBIUS.fundoSuave },
  headerCentro: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 },
  grupoIcone: { width: 40, height: 40, borderRadius: 20, backgroundColor: CORES_SYMBIUS.verdeEscuro, justifyContent: 'center', alignItems: 'center' },
  headerTitulo: { fontSize: 15, fontFamily: F.bold, color: CORES_SYMBIUS.texto },
  headerSub: { fontSize: 11.5, fontFamily: F.medium, color: CORES_SYMBIUS.textoSec },

  linha: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, marginVertical: 2 },
  linhaMinha: { justifyContent: 'flex-end' },
  linhaOutro: { justifyContent: 'flex-start' },
  miniAvatar: { width: 28, height: 28, borderRadius: 14 },
  miniAvatarVazio: { backgroundColor: CORES_SYMBIUS.fundoSuave, justifyContent: 'center', alignItems: 'center' },
  miniAvatarTxt: { fontFamily: F.bold, color: CORES_SYMBIUS.verdeEscuro, fontSize: 12 },
  bolha: { maxWidth: '78%', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8 },
  bolhaMinha: { backgroundColor: CORES_SYMBIUS.verdeEscuro, borderBottomRightRadius: 4 },
  bolhaOutro: { backgroundColor: CORES_SYMBIUS.fundoCard, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: CORES_SYMBIUS.borda },
  nome: { fontSize: 11.5, fontFamily: F.bold, marginBottom: 2 },
  texto: { fontSize: 14.5, fontFamily: F.regular, color: CORES_SYMBIUS.texto, lineHeight: 20 },
  apagadaLinha: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  apagadaTxt: { fontSize: 13.5, fontFamily: F.regular, fontStyle: 'italic', color: CORES_SYMBIUS.textoSec },
  imagem: { width: 220, height: 220, borderRadius: 10 },
  horaLinha: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end', marginTop: 3 },
  hora: { fontSize: 10, fontFamily: F.medium, color: CORES_SYMBIUS.textoMuted, alignSelf: 'flex-end', marginTop: 3 },

  inputArea: {
    paddingHorizontal: 10, paddingTop: 10,
    backgroundColor: CORES_SYMBIUS.fundoCard, borderTopWidth: 1, borderTopColor: CORES_SYMBIUS.borda,
  },
  inputLinha: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  editandoBarra: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 6, paddingBottom: 8 },
  editandoTxt: { flex: 1, fontSize: 12.5, fontFamily: F.bold, color: CORES_SYMBIUS.verdeEscuro },
  btnAnexo: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', backgroundColor: CORES_SYMBIUS.fundoSuave },
  input: {
    flex: 1, maxHeight: 110, borderRadius: 21, borderWidth: 1, borderColor: CORES_SYMBIUS.borda,
    backgroundColor: CORES_SYMBIUS.fundo, paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 14.5, fontFamily: F.regular, color: CORES_SYMBIUS.texto,
  },
  btnEnviar: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', backgroundColor: CORES_SYMBIUS.verdeEscuro },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  overlayCentro: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', paddingHorizontal: 28 },
  sheet: { backgroundColor: CORES_SYMBIUS.fundoCard, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 12, maxHeight: '85%' },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: CORES_SYMBIUS.borda2, alignSelf: 'center', marginBottom: 12 },
  sheetTitulo: { fontSize: 18, fontFamily: F.black, color: CORES_SYMBIUS.texto, textAlign: 'center' },
  infoTopo: { alignItems: 'center', gap: 4 },
  infoFoto: { width: 84, height: 84, borderRadius: 42, marginBottom: 6 },
  grupoIconeGrande: { backgroundColor: CORES_SYMBIUS.verdeEscuro, justifyContent: 'center', alignItems: 'center' },
  descricao: { fontSize: 13.5, fontFamily: F.regular, color: CORES_SYMBIUS.texto, textAlign: 'center', marginTop: 6, lineHeight: 19 },
  acoesAdmin: { flexDirection: 'row', gap: 10, marginTop: 12 },
  btnAdmin: {
    flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, paddingHorizontal: 14,
    borderRadius: 22, backgroundColor: CORES_SYMBIUS.verdeEscuro + '15',
  },
  btnAdminTxt: { fontSize: 13, fontFamily: F.bold, color: CORES_SYMBIUS.verdeEscuro },
  rotulo: { fontSize: 10.5, fontFamily: F.bold, letterSpacing: 0.6, color: CORES_SYMBIUS.textoSec, marginTop: 16, marginBottom: 6 },
  membro: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48 },
  membroInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 },
  membroFoto: { width: 38, height: 38, borderRadius: 19 },
  membroNome: { flex: 1, fontSize: 14, fontFamily: F.semibold, color: CORES_SYMBIUS.texto },
  badgeAdmin: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, backgroundColor: CORES_SYMBIUS.laranjaTexto + '20' },
  badgeAdminTxt: { fontSize: 10.5, fontFamily: F.bold, color: CORES_SYMBIUS.laranjaTexto },
  btnMais: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  btnDesbanir: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 12 },
  btnSair: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 14, minHeight: 48, borderRadius: 14, borderWidth: 1.5, borderColor: '#D6454555' },
  btnSairTxt: { fontSize: 14, fontFamily: F.bold, color: '#D64545' },

  menuCard: { backgroundColor: CORES_SYMBIUS.fundoCard, borderRadius: 20, padding: 16 },
  menuTitulo: { fontSize: 15, fontFamily: F.black, color: CORES_SYMBIUS.texto, marginBottom: 6 },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48, borderBottomWidth: 1, borderBottomColor: CORES_SYMBIUS.borda },
  menuItemTxt: { fontSize: 14.5, fontFamily: F.semibold },
  menuItemDetalhe: { fontSize: 11.5, fontFamily: F.medium, color: CORES_SYMBIUS.textoSec, marginTop: 1 },
  menuCancelar: { minHeight: 48, justifyContent: 'center', alignItems: 'center', marginTop: 4 },
  menuCancelarTxt: { fontSize: 14, fontFamily: F.bold, color: CORES_SYMBIUS.textoSec },

  editarFotoBtn: { alignItems: 'center', gap: 4, marginTop: 12, minHeight: 44 },
  campo: {
    borderRadius: 14, borderWidth: 1, borderColor: CORES_SYMBIUS.borda, backgroundColor: CORES_SYMBIUS.fundo,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, fontFamily: F.medium, color: CORES_SYMBIUS.texto,
  },
  contador: { alignSelf: 'flex-end', fontSize: 11, fontFamily: F.medium, color: CORES_SYMBIUS.textoSec, marginTop: 4 },
  botoes: { flexDirection: 'row', gap: 10, marginTop: 16 },
  botao: { flex: 1, minHeight: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  botaoSec: { backgroundColor: CORES_SYMBIUS.fundoSuave },
  botaoSecTxt: { fontSize: 14, fontFamily: F.bold, color: CORES_SYMBIUS.texto },
  botaoPri: { backgroundColor: CORES_SYMBIUS.verdeEscuro },
  botaoPriTxt: { fontSize: 14, fontFamily: F.bold, color: CORES_SYMBIUS.creme },

  imagemOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center', alignItems: 'center' },
});
