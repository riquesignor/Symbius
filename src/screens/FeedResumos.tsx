import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, FlatList,
  StatusBar, ActivityIndicator, Modal, TextInput,
  KeyboardAvoidingView, Platform, Image, Alert, PanResponder, Animated, Dimensions,
} from 'react-native';
import { db } from '../config/firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppSettings } from '../contexts/AppSettingsContext';
import { CORES_SYMBIUS } from './Boasvindas';
import SymbiusTabBar from '../components/SymbiusTabBar';
import { F } from '../constants/theme';
import {
  Resumo, buscarResumos, criarResumo, reagirResumo, Reacao,
  editarResumo, apagarResumo, alternarPrivacidadeResumo,
  Comentario, ouvirComentarios, comentarResumo, apagarComentario, AnexoResumo,
} from '../services/resumosService';
import { dispararPush } from '../services/pushNotificationsService';
import { escolherDocumentoBase64, abrirArquivoBase64 } from '../utils/midiaNativa';

const fotoUri = (foto?: string | null) =>
  !foto ? null : foto.startsWith('http') || foto.startsWith('data:') ? foto : `data:image/jpeg;base64,${foto}`;

const mimeDoArquivo = (tipo?: string) =>
  tipo === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

// ══════════════════════════════════════════════════════════════════════
// ⚠️  TELA DE TESTE — Feed de Resumos ("Symbius"). Feature nova de verdade:
// leitura/escrita real na collection `resumos` do Firestore (não é mock).
// ══════════════════════════════════════════════════════════════════════

type Aba = 'recentes' | 'populares';

const formatarTempo = (timestamp: any): string => {
  if (!timestamp?.toDate) return 'agora';
  const diffMs = Date.now() - timestamp.toDate().getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
};

export default function FeedResumos({ navigation, route }: any) {
  const insets = useSafeAreaInsets();
  const { fonteScale } = useAppSettings();
  const fs = (s: number) => s * fonteScale;

  const [uid, setUid] = useState<string | null>(route?.params?.uid || null);
  const [meuNome, setMeuNome] = useState('Anônimo');
  const [minhaFoto, setMinhaFoto] = useState<string | null>(null);

  const [aba, setAba] = useState<Aba>('recentes');
  const abaRef = useRef<Aba>('recentes');
  useEffect(() => { abaRef.current = aba; }, [aba]);
  const ABAS_RESUMOS: Aba[] = ['recentes', 'populares'];
  const abaSwipeX = useRef(new Animated.Value(0)).current;
  const abaSwipeResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 20 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderMove: (_, g) => {
        const idx = ABAS_RESUMOS.indexOf(abaRef.current);
        let dx = g.dx;
        if (dx < 0 && idx >= ABAS_RESUMOS.length - 1) dx *= 0.25;
        if (dx > 0 && idx <= 0) dx *= 0.25;
        abaSwipeX.setValue(dx);
      },
      onPanResponderRelease: (_, g) => {
        const idx = ABAS_RESUMOS.indexOf(abaRef.current);
        const vaiProxima  = g.dx < -40 && idx < ABAS_RESUMOS.length - 1;
        const vaiAnterior = g.dx > 40  && idx > 0;
        if (vaiProxima || vaiAnterior) {
          const dir = vaiProxima ? -1 : 1;
          const { width } = Dimensions.get('window');
          Animated.timing(abaSwipeX, { toValue: dir * width, duration: 180, useNativeDriver: true }).start(() => {
            setAba(ABAS_RESUMOS[idx + (vaiProxima ? 1 : -1)]);
            abaSwipeX.setValue(-dir * width);
            Animated.timing(abaSwipeX, { toValue: 0, duration: 220, useNativeDriver: true }).start();
          });
        } else {
          Animated.spring(abaSwipeX, { toValue: 0, useNativeDriver: true, friction: 8 }).start();
        }
      },
    })
  ).current;
  const [resumos, setResumos] = useState<Resumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [processandoCurtida, setProcessandoCurtida] = useState<string | null>(null);

  const [modalVisible, setModalVisible] = useState(false);
  const [materia, setMateria] = useState('');
  const [titulo, setTitulo] = useState('');
  const [corpo, setCorpo] = useState('');
  const [publicando, setPublicando] = useState(false);
  const [resumoEditando, setResumoEditando] = useState<Resumo | null>(null);
  const [menuResumo, setMenuResumo] = useState<Resumo | null>(null);
  const [anexo, setAnexo] = useState<AnexoResumo | null>(null);

  // ── Comentários ──
  const [resumoComentarios, setResumoComentarios] = useState<Resumo | null>(null);
  const [comentarios, setComentarios] = useState<Comentario[]>([]);
  const [textoComentario, setTextoComentario] = useState('');
  const [enviandoComentario, setEnviandoComentario] = useState(false);

  useEffect(() => {
    if (!resumoComentarios) { setComentarios([]); return; }
    return ouvirComentarios(resumoComentarios.id, setComentarios);
  }, [resumoComentarios?.id]);

  // Veio de uma notificação de curtida/comentário: abre direto os comentários desse resumo
  const resumoIdParam = route?.params?.resumoId;
  useEffect(() => {
    if (!resumoIdParam || resumos.length === 0) return;
    const alvo = resumos.find(r => r.id === resumoIdParam);
    if (alvo) setResumoComentarios(alvo);
    navigation.setParams({ resumoId: undefined });
  }, [resumoIdParam, resumos.length]);

  const carregarPerfil = useCallback(async () => {
    let uidAtual = uid;
    if (!uidAtual) {
      uidAtual = await AsyncStorage.getItem('uid');
      if (uidAtual) setUid(uidAtual);
    }
    if (!uidAtual) return;
    try {
      const snap = await getDoc(doc(db, 'usuarios', uidAtual));
      if (snap.exists()) {
        const d = snap.data() as any;
        setMeuNome(d.nome_completo || 'Anônimo');
        setMinhaFoto(d.foto || d.foto_url || null);
      }
    } catch (e) { console.log('Erro ao carregar perfil do feed:', e); }
  }, [uid]);

  const carregarResumos = useCallback(async () => {
    setLoading(true);
    const lista = await buscarResumos(aba, 30, uid);
    setResumos(lista);
    setLoading(false);
  }, [aba, uid]);

  useEffect(() => { carregarPerfil(); }, [carregarPerfil]);
  useEffect(() => { carregarResumos(); }, [carregarResumos]);

  const handleReagir = async (item: Resumo, reacao: Reacao) => {
    if (!uid || processandoCurtida) return;
    setProcessandoCurtida(item.id);
    // Atualização otimista (curtir e não curtir se excluem)
    setResumos(prev => prev.map(r => {
      if (r.id !== item.id) return r;
      const curtidas = r.curtidas || [];
      const descurtidas = r.descurtidas || [];
      const alvo = reacao === 'curtir' ? curtidas : descurtidas;
      const jaTinha = alvo.includes(uid);
      const novoAlvo = jaTinha ? alvo.filter(u => u !== uid) : [...alvo, uid];
      const novasCurtidas = reacao === 'curtir' ? novoAlvo : curtidas.filter(u => u !== uid);
      const novasDescurtidas = reacao === 'curtir' ? descurtidas.filter(u => u !== uid) : novoAlvo;
      return {
        ...r,
        curtidas: novasCurtidas, curtidasCount: novasCurtidas.length,
        descurtidas: novasDescurtidas, descurtidasCount: novasDescurtidas.length,
      };
    }));
    const resultado = await reagirResumo(item.id, uid, reacao);
    setProcessandoCurtida(null);
    if (resultado === null) { carregarResumos(); return; }
    if (resultado === 'adicionou' && reacao === 'curtir' && item.autorUid !== uid) {
      dispararPush({
        destinatarioUid: item.autorUid,
        titulo: '👍 Curtiram seu resumo',
        corpo: `${meuNome} curtiu "${item.titulo}"`,
        dados: { tipo: 'resumo_curtida', resumoId: item.id },
      });
    }
  };

  const handleComentar = async () => {
    const alvo = resumoComentarios;
    if (!uid || !alvo || !textoComentario.trim() || enviandoComentario) return;
    setEnviandoComentario(true);
    const texto = textoComentario.trim();
    const ok = await comentarResumo(alvo.id, { autorUid: uid, autorNome: meuNome, autorFoto: minhaFoto, texto });
    setEnviandoComentario(false);
    if (!ok) { Alert.alert('Erro', 'Não foi possível comentar.'); return; }
    setTextoComentario('');
    setResumos(prev => prev.map(r => r.id === alvo.id ? { ...r, comentariosCount: (r.comentariosCount || 0) + 1 } : r));
    if (alvo.autorUid !== uid) {
      dispararPush({
        destinatarioUid: alvo.autorUid,
        titulo: '💬 Novo comentário no seu resumo',
        corpo: `${meuNome}: ${texto.slice(0, 100)}`,
        dados: { tipo: 'resumo_comentario', resumoId: alvo.id },
      });
    }
  };

  const handleApagarComentario = (c: Comentario) => {
    const alvo = resumoComentarios;
    if (!alvo) return;
    Alert.alert('Apagar comentário?', '', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Apagar', style: 'destructive', onPress: async () => {
          if (await apagarComentario(alvo.id, c.id)) {
            setResumos(prev => prev.map(r => r.id === alvo.id ? { ...r, comentariosCount: Math.max(0, (r.comentariosCount || 1) - 1) } : r));
          }
        },
      },
    ]);
  };

  const anexarArquivo = async () => {
    const r = await escolherDocumentoBase64();
    if (r) setAnexo(r);
  };

  const abrirAnexo = (item: Resumo) => {
    if (!item.arquivoBase64) return;
    abrirArquivoBase64(item.arquivoBase64, item.arquivoNome || `resumo.${item.arquivoTipo || 'pdf'}`, mimeDoArquivo(item.arquivoTipo));
  };

  const fecharModalPublicar = () => {
    setModalVisible(false);
    setResumoEditando(null);
    setMateria(''); setTitulo(''); setCorpo(''); setAnexo(null);
  };

  const abrirModalNovo = () => {
    setResumoEditando(null);
    setMateria(''); setTitulo(''); setCorpo(''); setAnexo(null);
    setModalVisible(true);
  };

  const abrirModalEditar = (item: Resumo) => {
    setResumoEditando(item);
    setMateria(item.materia);
    setTitulo(item.titulo);
    setCorpo(item.corpo);
    setModalVisible(true);
  };

  const handlePublicar = async () => {
    if (!uid || !titulo.trim() || !corpo.trim() || publicando) return;
    setPublicando(true);

    if (resumoEditando) {
      const ok = await editarResumo(resumoEditando.id, { materia, titulo, corpo });
      setPublicando(false);
      if (ok) {
        const materiaFinal = materia.trim() || 'Geral';
        const tituloFinal = titulo.trim();
        const corpoFinal = corpo.trim();
        setResumos(prev => prev.map(r => r.id === resumoEditando.id
          ? { ...r, materia: materiaFinal, titulo: tituloFinal, corpo: corpoFinal }
          : r));
        fecharModalPublicar();
      }
      return;
    }

    const ok = await criarResumo({
      autorUid: uid, autorNome: meuNome, autorFoto: minhaFoto,
      materia, titulo, corpo, anexo,
    });
    setPublicando(false);
    if (ok) {
      fecharModalPublicar();
      setAba('recentes');
      carregarResumos();
    }
  };

  const handleAlternarPrivacidade = async (item: Resumo) => {
    setMenuResumo(null);
    const privadoAtual = !!item.privado;
    setResumos(prev => prev.map(r => r.id === item.id ? { ...r, privado: !privadoAtual } : r));
    await alternarPrivacidadeResumo(item.id, privadoAtual);
  };

  const handleApagar = (item: Resumo) => {
    setMenuResumo(null);
    Alert.alert(
      'Apagar resumo?',
      'Essa ação não pode ser desfeita.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Apagar',
          style: 'destructive',
          onPress: async () => {
            setResumos(prev => prev.filter(r => r.id !== item.id));
            await apagarResumo(item.id);
          },
        },
      ],
    );
  };

  const renderItem = ({ item }: { item: Resumo }) => {
    const curti = !!(uid && item.curtidas?.includes(uid));
    const descurti = !!(uid && item.descurtidas?.includes(uid));
    const foto = fotoUri(item.autorFoto);
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          {foto ? (
            <Image source={{ uri: foto }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Ionicons name="person" size={16} color={CORES_SYMBIUS.textoSec} />
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={[styles.autorLinha, { fontSize: fs(12.5) }]} numberOfLines={1}>
              <Text style={styles.autorNome}>{item.autorNome}</Text> compartilhou um resumo
            </Text>
            <View style={styles.materiaTempoRow}>
              <Text style={[styles.materiaTempo, { fontSize: fs(11) }]}>
                {item.materia} · {formatarTempo(item.criadoEm)}
              </Text>
              {item.privado && (
                <View style={styles.privadoBadge}>
                  <Ionicons name="eye-off" size={9} color={CORES_SYMBIUS.laranjaTexto} />
                  <Text style={styles.privadoBadgeTxt}>Privado</Text>
                </View>
              )}
            </View>
          </View>
          {uid && item.autorUid === uid && (
            <TouchableOpacity
              onPress={() => setMenuResumo(item)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="ellipsis-horizontal" size={18} color={CORES_SYMBIUS.textoSec} />
            </TouchableOpacity>
          )}
        </View>

        <Text style={[styles.titulo, { fontSize: fs(14.5) }]}>{item.titulo}</Text>
        <Text style={[styles.corpo, { fontSize: fs(12.5) }]} numberOfLines={3}>{item.corpo}</Text>

        {!!item.arquivoBase64 && (
          <TouchableOpacity style={styles.anexoChip} onPress={() => abrirAnexo(item)} activeOpacity={0.8}>
            <Ionicons name="document-text" size={22} color={CORES_SYMBIUS.laranjaTexto} />
            <View style={{ flex: 1 }}>
              <Text style={styles.anexoNome} numberOfLines={1}>{item.arquivoNome || 'Arquivo'}</Text>
              <Text style={styles.anexoMeta}>
                {(item.arquivoTipo || 'pdf').toUpperCase()}{item.arquivoTamanho ? ` · ${Math.round(item.arquivoTamanho / 1024)} KB` : ''} · toque para abrir
              </Text>
            </View>
            <Ionicons name="open-outline" size={18} color={CORES_SYMBIUS.textoSec} />
          </TouchableOpacity>
        )}

        <View style={styles.acoesRow}>
          <TouchableOpacity
            style={styles.curtidaBtn}
            onPress={() => handleReagir(item, 'curtir')}
            disabled={processandoCurtida === item.id}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="Curtir"
          >
            <Ionicons name={curti ? 'thumbs-up' : 'thumbs-up-outline'} size={16} color={curti ? CORES_SYMBIUS.verdeEscuro : CORES_SYMBIUS.textoSec} />
            <Text style={[styles.curtidaTxt, { fontSize: fs(12), color: curti ? CORES_SYMBIUS.verdeEscuro : CORES_SYMBIUS.textoSec }]}>
              {item.curtidasCount || 0}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.curtidaBtn}
            onPress={() => handleReagir(item, 'descurtir')}
            disabled={processandoCurtida === item.id}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="Não curti"
          >
            <Ionicons name={descurti ? 'thumbs-down' : 'thumbs-down-outline'} size={16} color={descurti ? '#D64545' : CORES_SYMBIUS.textoSec} />
            <Text style={[styles.curtidaTxt, { fontSize: fs(12), color: descurti ? '#D64545' : CORES_SYMBIUS.textoSec }]}>
              {item.descurtidasCount || 0}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.curtidaBtn}
            onPress={() => setResumoComentarios(item)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="Comentários"
          >
            <Ionicons name="chatbubble-outline" size={16} color={CORES_SYMBIUS.textoSec} />
            <Text style={[styles.curtidaTxt, { fontSize: fs(12), color: CORES_SYMBIUS.textoSec }]}>
              {item.comentariosCount || 0}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle={CORES_SYMBIUS.barStyle} backgroundColor={CORES_SYMBIUS.fundo} />

      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="chevron-back" size={24} color={CORES_SYMBIUS.texto} />
        </TouchableOpacity>
        <Text style={[styles.headerTitulo, { fontSize: fs(17) }]}>Feed de Resumos</Text>
        <TouchableOpacity onPress={abrirModalNovo} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="add-circle" size={26} color={CORES_SYMBIUS.verdeEscuro} />
        </TouchableOpacity>
      </View>

      <View style={styles.abasRow}>
        {([{ chave: 'recentes', label: 'Recentes' }, { chave: 'populares', label: 'Mais Populares' }] as { chave: Aba; label: string }[]).map(a => {
          const ativa = a.chave === aba;
          return (
            <TouchableOpacity
              key={a.chave}
              style={[styles.abaPill, ativa && styles.abaPillAtiva]}
              onPress={() => setAba(a.chave)}
            >
              <Text style={[styles.abaTxt, ativa && styles.abaTxtAtiva, { fontSize: fs(12.5) }]}>{a.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Animated.View style={{ flex: 1, transform: [{ translateX: abaSwipeX }] }} {...abaSwipeResponder.panHandlers}>
      {loading ? (
        <ActivityIndicator style={{ marginTop: 60 }} color={CORES_SYMBIUS.verdeEscuro} size="large" />
      ) : resumos.length === 0 ? (
        <View style={styles.vazio}>
          <FontAwesome5 name="book-open" size={36} color={CORES_SYMBIUS.borda} />
          <Text style={[styles.vazioTxt, { fontSize: fs(13) }]}>
            Nenhum resumo publicado ainda.{'\n'}Toque em + pra ser o primeiro!
          </Text>
        </View>
      ) : (
        <FlatList
          data={resumos}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.lista}
          showsVerticalScrollIndicator={false}
        />
      )}
      </Animated.View>

      {/* Modal de criação */}
      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={fecharModalPublicar}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitulo, { fontSize: fs(15) }]}>{resumoEditando ? 'Editar resumo' : 'Novo resumo'}</Text>
              <TouchableOpacity onPress={fecharModalPublicar} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" size={22} color={CORES_SYMBIUS.texto} />
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.input}
              placeholder="Matéria (ex: Matemática)"
              placeholderTextColor={CORES_SYMBIUS.textoSec}
              value={materia}
              onChangeText={setMateria}
            />
            <TextInput
              style={styles.input}
              placeholder="Título do resumo"
              placeholderTextColor={CORES_SYMBIUS.textoSec}
              value={titulo}
              onChangeText={setTitulo}
            />
            <TextInput
              style={[styles.input, styles.inputMultilinha]}
              placeholder="Escreva o resumo aqui..."
              placeholderTextColor={CORES_SYMBIUS.textoSec}
              value={corpo}
              onChangeText={setCorpo}
              multiline
              textAlignVertical="top"
            />

            {!resumoEditando && (
              anexo ? (
                <View style={styles.anexoChip}>
                  <Ionicons name="document-text" size={20} color={CORES_SYMBIUS.laranjaTexto} />
                  <Text style={[styles.anexoNome, { flex: 1 }]} numberOfLines={1}>{anexo.nome}</Text>
                  <TouchableOpacity onPress={() => setAnexo(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="close-circle" size={20} color={CORES_SYMBIUS.textoSec} />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity style={styles.btnAnexar} onPress={anexarArquivo}>
                  <Ionicons name="attach" size={18} color={CORES_SYMBIUS.verdeEscuro} />
                  <Text style={styles.btnAnexarTxt}>Anexar PDF ou DOCX (até 700 KB)</Text>
                </TouchableOpacity>
              )
            )}

            <TouchableOpacity
              style={[styles.btnPublicar, (!titulo.trim() || !corpo.trim() || publicando) && styles.btnDesabilitado]}
              onPress={handlePublicar}
              disabled={!titulo.trim() || !corpo.trim() || publicando}
            >
              {publicando
                ? <ActivityIndicator color={CORES_SYMBIUS.creme} />
                : <Text style={styles.btnPublicarTxt}>{resumoEditando ? 'Salvar' : 'Publicar'}</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Menu de ações do dono do resumo (editar / privacidade / apagar) */}
      <Modal visible={!!menuResumo} transparent animationType="fade" onRequestClose={() => setMenuResumo(null)}>
        <TouchableOpacity style={styles.menuOverlay} activeOpacity={1} onPress={() => setMenuResumo(null)}>
          <View style={styles.menuPopup}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => { if (menuResumo) { const item = menuResumo; setMenuResumo(null); abrirModalEditar(item); } }}
            >
              <Ionicons name="create-outline" size={18} color={CORES_SYMBIUS.texto} />
              <Text style={styles.menuItemTxt}>Editar</Text>
            </TouchableOpacity>
            <View style={styles.menuDivider} />
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => menuResumo && handleAlternarPrivacidade(menuResumo)}
            >
              <Ionicons name={menuResumo?.privado ? 'eye-outline' : 'eye-off-outline'} size={18} color={CORES_SYMBIUS.texto} />
              <Text style={styles.menuItemTxt}>{menuResumo?.privado ? 'Tornar público' : 'Tornar privado'}</Text>
            </TouchableOpacity>
            <View style={styles.menuDivider} />
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => menuResumo && handleApagar(menuResumo)}
            >
              <Ionicons name="trash-outline" size={18} color="#D64545" />
              <Text style={[styles.menuItemTxt, { color: '#D64545' }]}>Apagar</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Comentários */}
      <Modal visible={!!resumoComentarios} animationType="slide" transparent onRequestClose={() => setResumoComentarios(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { maxHeight: '85%', paddingBottom: 16 + insets.bottom }]}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.modalTitulo, { fontSize: fs(15) }]}>Comentários</Text>
                <Text style={[styles.materiaTempo, { fontSize: fs(11) }]} numberOfLines={1}>{resumoComentarios?.titulo}</Text>
              </View>
              <TouchableOpacity onPress={() => setResumoComentarios(null)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" size={22} color={CORES_SYMBIUS.texto} />
              </TouchableOpacity>
            </View>

            <FlatList
              data={comentarios}
              keyExtractor={c => c.id}
              style={{ flexGrow: 0, maxHeight: 360 }}
              ListEmptyComponent={<Text style={[styles.vazioTxt, { paddingVertical: 24 }]}>Nenhum comentário ainda. Seja o primeiro!</Text>}
              renderItem={({ item: c }) => {
                const fotoC = fotoUri(c.autorFoto);
                return (
                  <TouchableOpacity
                    style={styles.comentario}
                    activeOpacity={1}
                    onLongPress={() => c.autorUid === uid && handleApagarComentario(c)}
                  >
                    {fotoC
                      ? <Image source={{ uri: fotoC }} style={styles.avatar} />
                      : <View style={[styles.avatar, styles.avatarFallback]}><Ionicons name="person" size={14} color={CORES_SYMBIUS.textoSec} /></View>}
                    <View style={styles.comentarioBolha}>
                      <Text style={styles.comentarioAutor}>{c.autorNome} <Text style={styles.comentarioTempo}>· {formatarTempo(c.criadoEm)}</Text></Text>
                      <Text style={styles.comentarioTexto}>{c.texto}</Text>
                    </View>
                  </TouchableOpacity>
                );
              }}
            />

            <View style={styles.comentarioInputRow}>
              <TextInput
                style={[styles.input, { flex: 1, paddingVertical: 10 }]}
                placeholder="Escreva um comentário..."
                placeholderTextColor={CORES_SYMBIUS.textoSec}
                value={textoComentario}
                onChangeText={setTextoComentario}
                multiline
                maxLength={1000}
              />
              <TouchableOpacity
                style={[styles.btnEnviarComentario, (!textoComentario.trim() || enviandoComentario) && styles.btnDesabilitado]}
                onPress={handleComentar}
                disabled={!textoComentario.trim() || enviandoComentario}
              >
                {enviandoComentario
                  ? <ActivityIndicator size="small" color={CORES_SYMBIUS.creme} />
                  : <Ionicons name="send" size={18} color={CORES_SYMBIUS.creme} />}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <SymbiusTabBar ativa="feed" navigation={navigation} uid={uid} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: CORES_SYMBIUS.fundo },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 18, paddingBottom: 14,
  },
  headerTitulo: { color: CORES_SYMBIUS.texto, fontFamily: F.black },

  abasRow: { flexDirection: 'row', gap: 4, marginHorizontal: 18, marginBottom: 14, backgroundColor: CORES_SYMBIUS.fundoSuave, padding: 4, borderRadius: 14 },
  abaPill: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 10 },
  abaPillAtiva: { backgroundColor: CORES_SYMBIUS.verdeEscuro },
  abaTxt: { color: CORES_SYMBIUS.textoSec, fontFamily: F.bold },
  abaTxtAtiva: { color: CORES_SYMBIUS.creme },

  lista: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 40 },
  card: {
    backgroundColor: CORES_SYMBIUS.fundoCard, borderRadius: 16, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: CORES_SYMBIUS.borda,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  avatar: { width: 32, height: 32, borderRadius: 16 },
  avatarFallback: { backgroundColor: CORES_SYMBIUS.fundo, alignItems: 'center', justifyContent: 'center' },
  autorLinha: { color: CORES_SYMBIUS.texto, fontFamily: F.medium },
  autorNome: { fontFamily: F.black },
  materiaTempoRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 1 },
  materiaTempo: { color: CORES_SYMBIUS.textoSec, fontFamily: F.medium },
  privadoBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: CORES_SYMBIUS.fundoLaranjaClaro, borderRadius: 8,
    paddingHorizontal: 6, paddingVertical: 1.5,
  },
  privadoBadgeTxt: { color: CORES_SYMBIUS.laranjaTexto, fontFamily: F.bold, fontSize: 9 },

  titulo: { color: CORES_SYMBIUS.texto, fontFamily: F.black, marginBottom: 4 },
  corpo: { color: CORES_SYMBIUS.textoSec, lineHeight: 18, marginBottom: 10 },

  curtidaBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start' },
  curtidaTxt: { fontFamily: F.bold },

  vazio: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, paddingHorizontal: 40 },
  vazioTxt: { color: CORES_SYMBIUS.textoSec, textAlign: 'center', lineHeight: 20, fontFamily: F.medium },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: CORES_SYMBIUS.fundo, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, paddingBottom: 32, gap: 12,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  modalTitulo: { color: CORES_SYMBIUS.texto, fontFamily: F.black },
  input: {
    backgroundColor: CORES_SYMBIUS.fundoCard, borderRadius: 12, borderWidth: 1, borderColor: CORES_SYMBIUS.borda,
    paddingHorizontal: 14, paddingVertical: 12, color: CORES_SYMBIUS.texto, fontSize: 14,
  },
  inputMultilinha: { minHeight: 100 },
  btnPublicar: { backgroundColor: CORES_SYMBIUS.verdeEscuro, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  btnDesabilitado: { opacity: 0.5 },
  btnPublicarTxt: { color: CORES_SYMBIUS.creme, fontFamily: F.black, fontSize: 14.5 },
  btnAnexar: {
    flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center',
    borderRadius: 12, borderWidth: 1.5, borderStyle: 'dashed', borderColor: CORES_SYMBIUS.borda2, paddingVertical: 12,
  },
  btnAnexarTxt: { color: CORES_SYMBIUS.verdeEscuro, fontFamily: F.semibold, fontSize: 13 },
  anexoChip: {
    flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: CORES_SYMBIUS.fundoSuave,
    borderRadius: 12, padding: 10, marginBottom: 10,
  },
  anexoNome: { color: CORES_SYMBIUS.texto, fontFamily: F.bold, fontSize: 12.5 },
  anexoMeta: { color: CORES_SYMBIUS.textoSec, fontFamily: F.medium, fontSize: 10.5, marginTop: 1 },
  acoesRow: { flexDirection: 'row', alignItems: 'center', gap: 22 },
  comentario: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  comentarioBolha: { flex: 1, backgroundColor: CORES_SYMBIUS.fundoSuave, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  comentarioAutor: { color: CORES_SYMBIUS.texto, fontFamily: F.bold, fontSize: 12.5 },
  comentarioTempo: { color: CORES_SYMBIUS.textoSec, fontFamily: F.regular, fontSize: 11 },
  comentarioTexto: { color: CORES_SYMBIUS.texto, fontFamily: F.regular, fontSize: 13, lineHeight: 18, marginTop: 2 },
  comentarioInputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginTop: 4 },
  btnEnviarComentario: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: CORES_SYMBIUS.verdeEscuro,
    justifyContent: 'center', alignItems: 'center',
  },

  menuOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: 30 },
  menuPopup: {
    backgroundColor: CORES_SYMBIUS.fundoCard, borderRadius: 16, width: '100%', maxWidth: 280,
    paddingVertical: 6, overflow: 'hidden',
  },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 13 },
  menuItemTxt: { color: CORES_SYMBIUS.texto, fontFamily: F.medium, fontSize: 14 },
  menuDivider: { height: 1, backgroundColor: CORES_SYMBIUS.borda, marginHorizontal: 12 },
});
