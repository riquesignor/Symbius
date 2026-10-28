import { voltar } from '../navegacao';
import React, { useEffect, useRef, useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  Platform, StyleSheet, Image, ActivityIndicator,
  Dimensions, KeyboardAvoidingView, Alert, FlatList,
  Animated, TouchableWithoutFeedback, useWindowDimensions, AppState
} from "react-native";
import { db } from "../config/firebaseConfig";
import {
  collection, addDoc, query, where,
  orderBy, serverTimestamp, setDoc, updateDoc,
  doc as firestoreDoc, getDoc, getDocs, deleteDoc, onSnapshot, arrayUnion, arrayRemove
} from "firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppSettings } from '../contexts/AppSettingsContext';
import { useNotificacao } from '../contexts/NotificacaoProvider';
import { dispararPush } from '../services/pushNotificationsService';
import { msDe, mensagemLidaPor, marcarComoLida, apagarConversaParaMim } from '../utils/conversas';
import {
  escolherImagemBase64, escolherVideoBase64, escolherDocumentoBase64, abrirArquivoBase64,
} from '../utils/midiaNativa';

import { F, CORES } from '../constants/theme';
import { CORES_SYMBIUS } from '../constants/temaSymbius';
import { awardXpFinalizarMatch, AwardResult, LevelUpInfo } from '../services/gamificationService';
import NivelUpSymbiusModal from '../components/NivelUpSymbiusModal';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const IMG_MAX = SCREEN_WIDTH * 0.65;
const IMG_MIN = 100;

// ── Helpers ──────────────────────────────────────────────
const getOrCreateConversa = async (uid1: string, uid2: string): Promise<string> => {
  const conversaId = [uid1, uid2].sort().join("_");
  const docRef = firestoreDoc(db, "conversas", conversaId);
  const snap = await getDoc(docRef);
  if (!snap.exists()) {
    await setDoc(docRef, { membros: [uid1, uid2], ultimaMensagem: "", data_postagem: serverTimestamp(), visto: false });
  }
  return conversaId;
};

const injectStyles = (dark: boolean) => {
  if (Platform.OS !== "web") return;
  const id = "chat-global-style";
  const existing = document.getElementById(id);
  if (existing) existing.remove();
  const style = document.createElement("style");
  style.id = id;
  style.textContent = `
    .chat-scroll::-webkit-scrollbar{width:0px;background:transparent}
    .chat-scroll{scrollbar-width:none;-ms-overflow-style:none}
    html,body,#root{height:100%;overflow:hidden;background:${dark? CORES_SYMBIUS.splashBg : CORES_SYMBIUS.fundo}}
    @keyframes typingBounce{0%,60%,100%{transform:translateY(0);opacity:.4}30%{transform:translateY(-5px);opacity:1}}
    .typing-dot{width:7px;height:7px;border-radius:50%;background:rgba(255,255,255,.7);display:inline-block;margin:0 2px;animation:typingBounce 1.2s infinite ease-in-out}
    .typing-dot:nth-child(2){animation-delay:.2s}
    .typing-dot:nth-child(3){animation-delay:.4s}
  `;
  document.head.appendChild(style);
};

const comprimirImagemWeb = (file: File, maxWidth = 800, quality = 0.7): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = document.createElement("img");
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let { width, height } = img;
        if (width > maxWidth) { height = Math.round((height * maxWidth) / width); width = maxWidth; }
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) { reject("no canvas"); return; }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality).split(",")[1]);
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

const getDimensoesWeb = (base64: string): Promise<{ w: number; h: number }> =>
  new Promise((resolve) => {
    const src = base64.startsWith("data:") ? base64 : `data:image/jpeg;base64,${base64}`;
    const img = document.createElement("img");
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => resolve({ w: 200, h: 200 });
    img.src = src;
  });

const calcDimensoes = (w: number, h: number, imgMax: number) => {
  if (w === 0 || h === 0) return { width: imgMax, height: imgMax };
  const ratio = h / w;
  const width = imgMax;
  const height = Math.max(IMG_MIN, Math.min(Math.round(imgMax * 1.4), Math.round(width * ratio)));
  return { width, height };
};

const formatarHora = (data: any): string => {
  if (!data) return "";
  const date = data?.toDate ? data.toDate() : new Date(data);
  return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
};

const formatarDataSeparador = (data: any): string => {
  if (!data) return "";
  const date = data?.toDate ? data.toDate() : new Date(data);
  const hoje = new Date(); const ontem = new Date();
  ontem.setDate(hoje.getDate() - 1);
  const mesmoDia = (a: Date, b: Date) => a.getDate()===b.getDate()&&a.getMonth()===b.getMonth()&&a.getFullYear()===b.getFullYear();
  if (mesmoDia(date, hoje)) return "Hoje";
  if (mesmoDia(date, ontem)) return "Ontem";
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
};

const getDataChave = (data: any): string => {
  if (!data) return "";
  const date = data?.toDate ? data.toDate() : new Date(data);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
};

const getImageUri = (foto: any): string => {
  const placeholder = "https://cdn-icons-png.flaticon.com/512/149/149071.png";
  if (!foto) return placeholder;
  if (typeof foto === "string" && (foto.startsWith("data:image") || foto.startsWith("http"))) return foto;
  return `data:image/jpeg;base64,${foto}`;
};

// ── Componente imagem na mensagem ──────────────────────
const ImagemMensagem = ({ base64, onPress }: { base64: string; onPress: () => void }) => {
  const { width: winW } = useWindowDimensions();
  const imgMax = Math.max(IMG_MIN, winW * 0.65);
  const [dims, setDims] = useState<{ width: number; height: number } | null>(null);
  const src = base64.startsWith("data:") ? base64 : `data:image/jpeg;base64,${base64}`;
  useEffect(() => {
    if (Platform.OS === "web") {
      getDimensoesWeb(base64).then(({ w, h }) => setDims(calcDimensoes(w, h, imgMax)));
    } else {
      Image.getSize(src, (w, h) => setDims(calcDimensoes(w, h, imgMax)), () => setDims({ width: 200, height: 200 }));
    }
  }, [base64, imgMax]);
  if (!dims) return <View style={{ width: 120, height: 120, justifyContent: "center", alignItems: "center" }}><ActivityIndicator color="white" /></View>;
  if (Platform.OS === "web") return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
      {/* @ts-ignore */}
      <img src={src} style={{ width: dims.width, height: dims.height, objectFit: "cover", borderRadius: 12, display: "block", cursor: "pointer" }} />
    </TouchableOpacity>
  );
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
      <Image source={{ uri: src }} style={{ width: dims.width, height: dims.height, borderRadius: 12 }} resizeMode="cover" />
    </TouchableOpacity>
  );
};

// ── Typing dots ────────────────────────────────────────
const TypingDotsNative = () => {
  const [phase, setPhase] = useState(0);
  useEffect(() => { const t = setInterval(() => setPhase(p => (p+1)%3), 400); return () => clearInterval(t); }, []);
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
      {[0,1,2].map(i => <View key={i} style={{ width:7,height:7,borderRadius:4,backgroundColor:"rgba(255,255,255,0.7)",opacity:phase===i?1:0.35,transform:[{translateY:phase===i?-4:0}] }} />)}
    </View>
  );
};

// ── Modal Perfil estilo WhatsApp ───────────────────────
const PerfilModal = ({ visible, onClose, outroUid, outroNome, outraFoto, CC, meuUid }: any) => {
  const [dadosPerfil, setDadosPerfil] = useState<any>(null);
  const [favoritos,   setFavoritos]   = useState<any[]>([]);

  useEffect(() => {
    if (!visible || !outroUid) return;
    getDoc(firestoreDoc(db, "usuarios", outroUid)).then(snap => {
      if (snap.exists()) setDadosPerfil(snap.data());
    });
  }, [visible, outroUid]);

  // Carrega favoritos do usuário atual
  useEffect(() => {
    if (!visible || !meuUid) return;
    getDoc(firestoreDoc(db, "usuarios", meuUid)).then(snap => {
      if (snap.exists()) setFavoritos(snap.data().favoritos || []);
    });
  }, [visible, meuUid]);

  const fotoUri = outraFoto
    ? (outraFoto.startsWith("data:") || outraFoto.startsWith("http") ? outraFoto : `data:image/jpeg;base64,${outraFoto}`)
    : "https://cdn-icons-png.flaticon.com/512/149/149071.png";

  // Mantém montado durante a animação de saída; sem isso o cartão sumia de uma vez.
  const [montado, setMontado] = useState(visible);
  const fundoAnim = useRef(new Animated.Value(0)).current;
  const cartaoAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (visible) {
      setMontado(true);
      Animated.parallel([
        Animated.timing(fundoAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.spring(cartaoAnim, { toValue: 1, friction: 9, tension: 70, useNativeDriver: true }),
      ]).start();
    } else if (montado) {
      Animated.parallel([
        Animated.timing(fundoAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
        Animated.timing(cartaoAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]).start(() => setMontado(false));
    }
  }, [visible]);

  if (!visible && !montado) return null;

  return (
    <Animated.View style={[psty.overlay, { opacity: fundoAnim }]}>
      <TouchableOpacity style={{
  position: "absolute",
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
}} onPress={onClose} />
      <Animated.View style={[
        psty.sheet,
        { backgroundColor: CC.menuBg, transform: [
          { translateY: cartaoAnim.interpolate({ inputRange: [0, 1], outputRange: [90, 0] }) },
          { scale: cartaoAnim.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) },
        ] },
      ]}>
        <View style={[psty.handle, { backgroundColor: CC.menuBorder }]} />

        {/* Capa + foto */}
        <View style={[psty.capa, { backgroundColor: CC.bolhaOther }]} />
          <View style={psty.fotoWrap}>
            <Image source={{ uri: fotoUri }} style={psty.foto} />
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={{ width: "100%" }}>
            {/* Nome */}
            <Text style={[psty.nome, { color: CC.menuTitle }]}>
              {dadosPerfil?.nome_completo || outroNome || "Usuário"}
            </Text>
            {dadosPerfil?.turma ? (
              <Text style={[psty.sub, { color: CC.textoSec }]}>Turma {dadosPerfil.turma}</Text>
            ) : null}

            {/* Info row — nomes de campo corretos: posso_ensinar / quer_aprender
                (o Firestore nunca teve `ensinar`/`melhorar`; era um bug antigo
                que zerava essa seção). */}
            <View style={[psty.infoRow, { borderColor: CC.menuBorder }]}>
              <View style={psty.infoItem}>
                <Ionicons name="school-outline" size={20} color={CORES_SYMBIUS.verdeEscuro} />
                <Text style={[psty.infoLabel, { color: CC.textoSec }]}>É bom em</Text>
                <Text style={[psty.infoVal, { color: CC.menuTitle }]}>
                  {dadosPerfil?.posso_ensinar?.length || 0} matérias
                </Text>
              </View>
              <View style={[psty.infoDiv, { backgroundColor: CC.menuBorder }]} />
              <View style={psty.infoItem}>
                <Ionicons name="book-outline" size={20} color={CORES_SYMBIUS.laranjaTexto} />
                <Text style={[psty.infoLabel, { color: CC.textoSec }]}>Precisa aprender</Text>
                <Text style={[psty.infoVal, { color: CC.menuTitle }]}>
                  {dadosPerfil?.quer_aprender?.length || 0} matérias
                </Text>
              </View>
            </View>

            {/* Matérias que é bom */}
            {dadosPerfil?.posso_ensinar?.length > 0 && (
              <View style={psty.secao}>
                <Text style={[psty.secaoTitulo, { color: CORES_SYMBIUS.verdeEscuro }]}>É BOM EM</Text>
                <View style={psty.tagsRow}>
                  {dadosPerfil.posso_ensinar.map((m: string) => (
                    <View key={m} style={[psty.tag, { backgroundColor: CORES_SYMBIUS.fundoSuave }]}>
                      <Text style={[psty.tagTxt, { color: CORES_SYMBIUS.verdeEscuro }]}>{m}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Matérias que precisa aprender */}
            {dadosPerfil?.quer_aprender?.length > 0 && (
              <View style={psty.secao}>
                <Text style={[psty.secaoTitulo, { color: CORES_SYMBIUS.laranjaTexto }]}>PRECISA APRENDER</Text>
                <View style={psty.tagsRow}>
                  {dadosPerfil.quer_aprender.map((m: string) => (
                    <View key={m} style={[psty.tag, { backgroundColor: CORES_SYMBIUS.fundoLaranjaClaro }]}>
                      <Text style={[psty.tagTxt, { color: CORES_SYMBIUS.laranjaTexto }]}>{m}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Seção Favoritos */}
            {favoritos.length > 0 && (
              <View style={psty.secao}>
                <Text style={[psty.secaoTitulo, { color: CC.textoSec }]}>MENSAGENS FAVORITAS</Text>
                {favoritos.map((fav: any, i: number) => (
                  <View key={i} style={[psty.favItem, { backgroundColor: CC.bolhaOther, borderColor: CC.menuBorder }]}>
                    <Text style={[psty.favTexto, { color: "#E0E0E0" }]} numberOfLines={3}>
                      {fav.tipo === "imagem" ? "Imagem" : fav.mensagem}
                    </Text>
                    <Text style={[psty.favHora, { color: CC.textoSec }]}>
                      {fav.nome_remetente} · {fav.hora || ""}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            <TouchableOpacity style={[psty.btnFechar, { backgroundColor: CORES_SYMBIUS.verdeEscuro }]} onPress={onClose}>
              <Text style={psty.btnFecharTxt}>Fechar</Text>
            </TouchableOpacity>
          <View style={{ height: 24 }} />
        </ScrollView>
      </Animated.View>
    </Animated.View>
  );
};

const psty = StyleSheet.create({
  overlay:     { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 999, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
  sheet:       { borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: SCREEN_HEIGHT * 0.88, alignItems: "center", overflow: "hidden" },
  handle:      { width: 40, height: 4, borderRadius: 2, marginTop: 12, marginBottom: 0 },
  capa:        { width: "100%", height: 80 },
  fotoWrap:    { marginTop: -45, marginBottom: 10, borderRadius: 48, borderWidth: 4, borderColor: CORES_SYMBIUS.verdeEscuro },
  foto:        { width: 90, height: 90, borderRadius: 45 },
  nome:        { fontSize: 20, fontFamily: F.black, letterSpacing: -0.4, marginBottom: 2, textAlign: "center", paddingHorizontal: 24 },
  sub:         { fontSize: 13, fontFamily: F.semibold, marginBottom: 12, textAlign: "center" },
  infoRow:     { flexDirection: "row", marginHorizontal: 20, borderRadius: 16, borderWidth: 1, overflow: "hidden", marginBottom: 16 },
  infoItem:    { flex: 1, alignItems: "center", paddingVertical: 14, gap: 3 },
  infoDiv:     { width: 1 },
  infoLabel:   { fontSize: 10, fontFamily: F.bold },
  infoVal:     { fontSize: 14, fontFamily: F.black },
  secao:       { width: "100%", paddingHorizontal: 20, marginBottom: 16 },
  secaoTitulo: { fontSize: 10, fontFamily: F.black, letterSpacing: 1.4, marginBottom: 8 },
  tagsRow:     { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  tag:         { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 12 },
  tagTxt:      { fontSize: 12, fontFamily: F.bold },
  favItem:     { borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1 },
  favTexto:    { fontSize: 13, lineHeight: 18, marginBottom: 4 },
  favHora:     { fontSize: 10, fontFamily: F.semibold },
  btnFechar:   { marginHorizontal: 20, paddingVertical: 13, borderRadius: 20, alignItems: "center" },
  btnFecharTxt:{ color: "#FFFFFF", fontFamily: F.black, fontSize: 15 },
});

// ── Modal Encaminhar ───────────────────────────────────
const EncaminharModal = ({ visible, onClose, meuUid, meuNome, minhaFoto, mensagem, CC }: any) => {
  const [matches,    setMatches]    = useState<any[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [enviados,   setEnviados]   = useState<string[]>([]);

  useEffect(() => {
    if (!visible || !meuUid) return;
    setCarregando(true);
    const q = query(
      collection(db, "match_solicitacoes"),
      where("status", "==", "aceito"),
      where("membros", "array-contains", meuUid)
    );
    getDocs(q).then(async snap => {
      const lista: any[] = [];
      await Promise.all(snap.docs.map(async d => {
        const data = d.data();
        const outroUid = data.membros?.find((id: string) => id !== meuUid);
        if (!outroUid) return;
        const oSnap = await getDoc(firestoreDoc(db, "usuarios", outroUid));
        if (oSnap.exists()) lista.push({ uid: outroUid, ...oSnap.data() });
      }));
      // Deduplica por uid
      const vistos = new Set<string>();
      setMatches(lista.filter(m => { if (vistos.has(m.uid)) return false; vistos.add(m.uid); return true; }));
      setCarregando(false);
    });
  }, [visible, meuUid]);

  const encaminhar = async (paraUid: string) => {
    if (enviados.includes(paraUid)) return;
    try {
      const conversaId = [meuUid, paraUid].sort().join("_");
      await getOrCreateConversa(meuUid, paraUid);
      const payload: any = {
        conversaId,
        mensagem: mensagem.tipo === "imagem" ? mensagem.mensagem : `↪️ ${mensagem.mensagem}`,
        tipo: mensagem.tipo,
        remetenteUid: meuUid,
        nome_remetente: meuNome,
        foto: minhaFoto || null,
        data_postagem: serverTimestamp(),
        encaminhada: true,
      };
      await addDoc(collection(db, "mensagens"), payload);
      const outroSnap = await getDoc(firestoreDoc(db, "usuarios", paraUid));
      const outroData = outroSnap.exists() ? outroSnap.data() : {};
      const ultimaMsgTexto = mensagem.tipo === "imagem" ? "📷 Imagem encaminhada" : `↪️ ${mensagem.mensagem}`;
      await setDoc(firestoreDoc(db, "conversas", conversaId), {
        ultimaMensagem: ultimaMsgTexto,
        data_postagem: serverTimestamp(),
        quemEnviou: meuUid, visto: false,
        dadosMembros: {
          [meuUid]:   { nome: meuNome, foto: minhaFoto || null },
          [paraUid]:  { nome: (outroData as any).nome_completo || "Usuário", foto: (outroData as any).foto || null },
        },
      }, { merge: true });
      dispararPush({
        destinatarioUid: paraUid,
        titulo: meuNome,
        corpo: ultimaMsgTexto,
        dados: { tipo: "mensagem", outroUid: meuUid, outroNome: meuNome },
      });
      setEnviados(prev => [...prev, paraUid]);
    } catch (e) { console.log("Encaminhar erro:", e); }
  };

  const fotoUri = (foto: any) => {
    if (!foto) return "https://cdn-icons-png.flaticon.com/512/149/149071.png";
    if (foto.startsWith("http") || foto.startsWith("data:")) return foto;
    return `data:image/jpeg;base64,${foto}`;
  };

  return (
    <View style={esty.overlay}>
      <TouchableOpacity style={{
  position: "absolute",
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
}} onPress={onClose} />
      <View style={[esty.sheet, { backgroundColor: CC.menuBg }]}>
          <View style={[esty.handle, { backgroundColor: CC.menuBorder }]} />
          <Text style={[esty.titulo, { color: CC.menuTitle }]}>Encaminhar para</Text>

          {/* Preview da mensagem */}
          <View style={[esty.preview, { backgroundColor: CC.bolhaOther }]}>
            <Text style={esty.previewTxt} numberOfLines={2}>
              {mensagem?.tipo === "imagem" ? "Imagem" : mensagem?.mensagem || ""}
            </Text>
          </View>

          {carregando
            ? <ActivityIndicator color={CORES_SYMBIUS.verdeEscuro} style={{ marginVertical: 24 }} />
            : <FlatList
                data={matches}
                keyExtractor={i => i.uid}
                style={{ width: "100%", maxHeight: SCREEN_HEIGHT * 0.4 }}
                renderItem={({ item }) => {
                  const enviou = enviados.includes(item.uid);
                  return (
                    <TouchableOpacity
                      style={[esty.matchItem, { borderBottomColor: CC.menuBorder }]}
                      onPress={() => encaminhar(item.uid)}
                      activeOpacity={0.7}
                    >
                      <Image source={{ uri: fotoUri(item.foto) }} style={esty.matchAvatar} />
                      <Text style={[esty.matchNome, { color: CC.menuTitle }]} numberOfLines={1}>
                        {item.nome_completo || "Usuário"}
                      </Text>
                      <View style={[esty.enviarBtn, { backgroundColor: enviou ? "#27ae60" : CORES_SYMBIUS.verdeEscuro }]}>
                        <Ionicons name={enviou ? "checkmark" : "send"} size={14} color="#fff" />
                      </View>
                    </TouchableOpacity>
                  );
                }}
              />
          }

          <TouchableOpacity style={[esty.btnFechar, { borderColor: CC.menuBorder }]} onPress={onClose}>
            <Text style={[esty.btnFecharTxt, { color: CC.textoSec }]}>Fechar</Text>
          </TouchableOpacity>
        </View>
      </View>
  );
};

const esty = StyleSheet.create({
  overlay:    { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 999, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
  sheet:      { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingBottom: 32, alignItems: "center" },
  handle:     { width: 40, height: 4, borderRadius: 2, marginBottom: 16 },
  titulo:     { fontSize: 17, fontFamily: F.black, marginBottom: 12 },
  preview:    { borderRadius: 12, padding: 12, marginBottom: 14, width: "100%", maxWidth: 400 },
  previewTxt: { color: "#E0E0E0", fontSize: 13 },
  matchItem:  { flexDirection: "row", alignItems: "center", paddingVertical: 12, paddingHorizontal: 4, borderBottomWidth: 0.5, gap: 12, width: "100%" },
  matchAvatar:{ width: 44, height: 44, borderRadius: 22, backgroundColor: "#2A2F36" },
  matchNome:  { flex: 1, fontSize: 15, fontFamily: F.bold },
  enviarBtn:  { width: 32, height: 32, borderRadius: 16, justifyContent: "center", alignItems: "center" },
  btnFechar:  { marginTop: 16, paddingVertical: 12, paddingHorizontal: 40, borderRadius: 20, borderWidth: 1 },
  btnFecharTxt:{ fontFamily: F.bold, fontSize: 14 },
});

// ══════════════════════════════════════════════════════════
// CHAT PRINCIPAL
// ══════════════════════════════════════════════════════════
export default function Chat({ route, navigation }: any) {
  const insets = useSafeAreaInsets();
  const { width: winW } = useWindowDimensions();
  const imgMax = Math.max(IMG_MIN, winW * 0.65);
  const bolhaMaxWidth = winW * 0.75;
  // ── TELA DE TESTE (Symbius): paleta verde fixa (modo claro), ignora o tema real do usuário.
  const modoEscuro = false;
  const { setConversaAtiva } = useNotificacao();
  const { outroUid, outroNome } = route.params || {};

  // ── TELA DE TESTE (Symbius): antes era claro/escuro via ternário; agora é
  // sempre a paleta verde do Symbius (mesmas chaves, nenhum uso de CC.* abaixo mudou). ──
  const CC = {
    fundo: CORES_SYMBIUS.fundo, headerBg: CORES_SYMBIUS.fundoCard, headerBorder: CORES_SYMBIUS.borda, headerTitle: CORES_SYMBIUS.texto,
    inputBg: CORES_SYMBIUS.fundoSuave, inputBorder: CORES_SYMBIUS.borda, inputText: CORES_SYMBIUS.texto, inputPlaceholder: CORES_SYMBIUS.textoMuted,
    scrollBg: CORES_SYMBIUS.fundo, bolhaMe: CORES_SYMBIUS.verdeEscuro, bolhaOther: CORES_SYMBIUS.fundoSuave, textoSec: CORES_SYMBIUS.textoSec,
    backBtn: CORES_SYMBIUS.fundoCard, backIcon: CORES_SYMBIUS.texto, sepLinha: CORES_SYMBIUS.borda, sepText: CORES_SYMBIUS.textoSec, sepBg: CORES_SYMBIUS.fundo,
    menuBg: CORES_SYMBIUS.fundoCard, menuTitle: CORES_SYMBIUS.texto, menuText: CORES_SYMBIUS.texto, menuBorder: CORES_SYMBIUS.borda,
    previewBg: CORES_SYMBIUS.fundoCard, previewTitle: CORES_SYMBIUS.texto, cancelBg: CORES_SYMBIUS.borda, cancelText: CORES_SYMBIUS.texto,
    citandoBg: CORES_SYMBIUS.fundoSuave, citandoBorder: CORES_SYMBIUS.verdeEscuro, citandoNome: CORES_SYMBIUS.verdeEscuro, citandoTexto: CORES_SYMBIUS.textoSec,
    citandoFechar: CORES_SYMBIUS.textoSec, sendBg: CORES_SYMBIUS.verdeEscuro, imgBtnBg: CORES_SYMBIUS.fundoSuave, imgBtnBorder: CORES_SYMBIUS.borda, imgBtnIcon: CORES_SYMBIUS.texto,
  };

  const scrollRef        = useRef<ScrollView>(null);
  const fileInputRef     = useRef<HTMLInputElement | null>(null);
  const videoInputRef    = useRef<HTMLInputElement | null>(null);
  const docInputRef      = useRef<HTMLInputElement | null>(null);
  const docIdMap         = useRef<Record<string, string>>({});
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [uidAtual,         setUidAtual]         = useState<string | null>(null);
  const [conversaId,       setConversaId]        = useState<string | null>(null);
  const [inputText,        setInputText]         = useState("");
  const [messages,         setMessages]          = useState<any[]>([]);
  const [loading,          setLoading]           = useState(true);
  const [meuNome,          setMeuNome]           = useState("Usuário");
  const [minhaFoto,        setMinhaFoto]         = useState<string | null>(null);
  const [uploading,        setUploading]         = useState(false);
  const [subpainelVisible, setSubpainelVisible]  = useState(false);
  const [previewVisible,   setPreviewVisible]    = useState(false);
  const [previewImage,     setPreviewImage]      = useState<string | null>(null);
  const [previewBase64,    setPreviewBase64]     = useState<string | null>(null);
  const [previewVideo,     setPreviewVideo]      = useState<string | null>(null);   // url blob
  const [previewVideoB64,  setPreviewVideoB64]   = useState<string | null>(null);
  const [previewDoc,       setPreviewDoc]        = useState<any | null>(null);      // {nome, base64, tipo}
  const [previewTipo,      setPreviewTipo]       = useState<'imagem'|'video'|'documento'>('imagem');
  const [fullImageVisible, setFullImageVisible]  = useState(false);
  const [fullImageUrl,     setFullImageUrl]      = useState<string | null>(null);
  const [fullImageMsg,     setFullImageMsg]      = useState<any | null>(null);
  const [fullVideoMsg,     setFullVideoMsg]      = useState<any | null>(null);
  const [menuMsg,          setMenuMsg]           = useState<any | null>(null);
  const [editandoId,       setEditandoId]        = useState<string | null>(null);
  const [citando,          setCitando]           = useState<any | null>(null);
  const [outraFoto,        setOutraFoto]         = useState<string | null>(null);
  const [onlineStatus,     setOnlineStatus]      = useState(false);
  const [outroDigitando,   setOutroDigitando]    = useState(false);
  const [perfilVisible,    setPerfilVisible]     = useState(false);
  const [encaminharMsg,    setEncaminharMsg]     = useState<any | null>(null);
  const [favoritos,        setFavoritos]         = useState<any[]>([]);
  const [silenciado,       setSilenciado]        = useState(false);
  const [conversaDados,    setConversaDados]     = useState<any>(null);
  const [escolhaConversa,  setEscolhaConversa]   = useState(false);
  const [appAtivo,         setAppAtivo]          = useState(AppState.currentState === 'active');
  const ultimaLeituraMarcada = useRef(0);

  // ── Finalizar Match / Gamificação ────────────────────────
  const [souAluno,         setSouAluno]          = useState<boolean | null>(null); // true=aluno (avalia), false=professor (não avalia), null=carregando
  const [matchFinalizado,  setMatchFinalizado]   = useState(false);
  const [avaliacaoVisible, setAvaliacaoVisible]  = useState(false);
  const [avaliacaoEtapa,   setAvaliacaoEtapa]    = useState<'pergunta' | 'estrelas'>('pergunta');
  const [entendeuDuvida,   setEntendeuDuvida]    = useState<boolean | null>(null);
  const [estrelasHover,    setEstrelasHover]     = useState<number | null>(null);
  const [comentarioPriv,   setComentarioPriv]    = useState('');
  const [enviandoAvaliacao,setEnviandoAvaliacao] = useState(false);
  const [xpToast,          setXpToast]           = useState<null | { xp: number; moedas: number; neutro?: boolean }>(null);
  const [levelUpInfo,      setLevelUpInfo]       = useState<null | LevelUpInfo>(null);
  const xpToastOpacity = useRef(new Animated.Value(0)).current;
  const xpToastSlide   = useRef(new Animated.Value(40)).current;
  const levelUpScale   = useRef(new Animated.Value(0.7)).current;
  const levelUpOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => { injectStyles(modoEscuro); }, [modoEscuro]);

  // ── File inputs web (imagem / vídeo / documento) ──────
  useEffect(() => {
    if (Platform.OS !== "web") return;

    // Imagem
    const imgInput = document.createElement("input");
    imgInput.type = "file"; imgInput.accept = "image/*"; imgInput.style.display = "none";
    imgInput.onchange = async (e: any) => {
      const file = e.target?.files?.[0]; if (!file) return;
      setUploading(true);
      try {
        const base64 = await comprimirImagemWeb(file);
        setPreviewImage(`data:image/jpeg;base64,${base64}`);
        setPreviewBase64(base64);
        setPreviewTipo('imagem');
        setPreviewVisible(true);
      } catch { Alert.alert("Erro", "Não foi possível processar a imagem."); }
      finally { setUploading(false); imgInput.value = ""; }
    };
    document.body.appendChild(imgInput);
    fileInputRef.current = imgInput;

    // Vídeo
    const vidInput = document.createElement("input");
    vidInput.type = "file"; vidInput.accept = "video/*"; vidInput.style.display = "none";
    vidInput.onchange = async (e: any) => {
      const file = e.target?.files?.[0]; if (!file) return;
      if (file.size > 20 * 1024 * 1024) { Alert.alert("Arquivo grande", "Use vídeos até 20MB."); return; }
      setUploading(true);
      try {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const b64 = (ev.target?.result as string).split(",")[1];
          const blobUrl = URL.createObjectURL(file);
          setPreviewVideo(blobUrl);
          setPreviewVideoB64(b64);
          setPreviewTipo('video');
          setPreviewVisible(true);
        };
        reader.readAsDataURL(file);
      } catch { Alert.alert("Erro", "Não foi possível processar o vídeo."); }
      finally { setUploading(false); vidInput.value = ""; }
    };
    document.body.appendChild(vidInput);
    videoInputRef.current = vidInput;

    // Documento (PDF / DOCX)
    const docInput = document.createElement("input");
    docInput.type = "file"; docInput.accept = ".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    docInput.style.display = "none";
    docInput.onchange = async (e: any) => {
      const file = e.target?.files?.[0]; if (!file) return;
      if (file.size > 10 * 1024 * 1024) { Alert.alert("Arquivo grande", "Use documentos até 10MB."); return; }
      setUploading(true);
      try {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const b64 = (ev.target?.result as string).split(",")[1];
          const ext = file.name.split('.').pop()?.toLowerCase() || 'pdf';
          setPreviewDoc({ nome: file.name, base64: b64, tipo: ext, tamanho: file.size });
          setPreviewTipo('documento');
          setPreviewVisible(true);
        };
        reader.readAsDataURL(file);
      } catch { Alert.alert("Erro", "Não foi possível processar o documento."); }
      finally { setUploading(false); docInput.value = ""; }
    };
    document.body.appendChild(docInput);
    docInputRef.current = docInput;

    return () => {
      document.body.removeChild(imgInput);
      document.body.removeChild(vidInput);
      document.body.removeChild(docInput);
    };
  }, []);

  useEffect(() => {
    AsyncStorage.getItem("uid")
      .then(uid => { if (uid) setUidAtual(uid); else setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!uidAtual) return;
    getDoc(firestoreDoc(db, "usuarios", uidAtual)).then(snap => {
      if (snap.exists()) {
        setMeuNome(snap.data().nome_completo || "Usuário");
        setMinhaFoto(snap.data().foto || null);
        setFavoritos(snap.data().favoritos || []);
        setSilenciado((snap.data().silenciados || []).includes(outroUid));
      }
    });
  }, [uidAtual]);

  // Silenciar: para de receber push e banner das mensagens dessa pessoa
  // (o backend e o NotificacaoProvider leem usuarios/{uid}.silenciados).
  const alternarSilenciar = async () => {
    if (!uidAtual || !outroUid) return;
    const novo = !silenciado;
    setSilenciado(novo);
    try {
      await updateDoc(firestoreDoc(db, "usuarios", uidAtual), {
        silenciados: novo ? arrayUnion(outroUid) : arrayRemove(outroUid),
      });
    } catch {
      setSilenciado(!novo);
      Alert.alert("Erro", "Não foi possível alterar. Tente novamente.");
    }
  };

  // ── Anexos no celular (a versão web usa <input type="file"> lá em cima) ──
  const anexarImagem = async (origem: 'galeria' | 'camera') => {
    setUploading(true);
    try {
      const b64 = await escolherImagemBase64({ origem, ladoMax: 1024, qualidade: 0.6 });
      if (!b64) return;
      setPreviewImage(`data:image/jpeg;base64,${b64}`);
      setPreviewBase64(b64);
      setPreviewTipo('imagem');
      setPreviewVisible(true);
    } catch { Alert.alert("Erro", "Não foi possível abrir a imagem."); }
    finally { setUploading(false); }
  };

  const anexarVideo = async () => {
    setUploading(true);
    try {
      const r = await escolherVideoBase64();
      if (!r) return;
      setPreviewVideo(null);
      setPreviewVideoB64(r.base64);
      setPreviewDoc({ nome: 'Vídeo', tamanho: r.tamanho });
      setPreviewTipo('video');
      setPreviewVisible(true);
    } catch { Alert.alert("Erro", "Não foi possível abrir o vídeo."); }
    finally { setUploading(false); }
  };

  const anexarDocumento = async () => {
    setUploading(true);
    try {
      const r = await escolherDocumentoBase64();
      if (!r) return;
      setPreviewDoc(r);
      setPreviewTipo('documento');
      setPreviewVisible(true);
    } catch { Alert.alert("Erro", "Não foi possível abrir o documento."); }
    finally { setUploading(false); }
  };

  useEffect(() => {
    if (!uidAtual) return;
    setDoc(firestoreDoc(db, "usuarios", uidAtual), { online: true }, { merge: true });
    return () => { setDoc(firestoreDoc(db, "usuarios", uidAtual), { online: false, digitandoEm: null }, { merge: true }); };
  }, [uidAtual]);

  useEffect(() => {
    if (!outroUid) return;
    getDoc(firestoreDoc(db, "usuarios", outroUid)).then(snap => { if (snap.exists()) setOutraFoto(snap.data().foto || null); });
    const unsub = onSnapshot(firestoreDoc(db, "usuarios", outroUid), (snap) => {
      if (snap.exists()) { setOnlineStatus(snap.data().online === true && (snap.data().online_ping ? Date.now() - msDe(snap.data().online_ping, Date.now()) < 150000 : true)); setOutroDigitando(!!snap.data().digitandoEm); }
    });
    return () => unsub();
  }, [outroUid]);

  useEffect(() => {
    if (!uidAtual || !outroUid) { setLoading(false); return; }
    getOrCreateConversa(uidAtual, outroUid).then(id => setConversaId(id)).catch(e => { console.log(e.message); setLoading(false); });
  }, [uidAtual, outroUid]);

  useEffect(() => {
    if (!conversaId) return;
    setLoading(true);
    const q = query(collection(db, "mensagens"), where("conversaId","==",conversaId), orderBy("data_postagem","asc"));
    const unsub = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(d => { docIdMap.current[d.id]=d.id; return { docId:d.id, id:d.id, ...d.data() }; });
      setMessages(msgs); setLoading(false);
    }, (e) => { console.log(e.message); setLoading(false); });
    return () => unsub();
  }, [conversaId]);

  // ── Documento da conversa ao vivo: quando o outro leu e o que eu já apaguei ──
  useEffect(() => {
    if (!conversaId) return;
    return onSnapshot(firestoreDoc(db, "conversas", conversaId), (snap) => {
      if (snap.exists()) {
        const d: any = snap.data();
        setConversaDados(d);
        if (d.matchFinalizado) setMatchFinalizado(true);
      }
    }, () => {});
  }, [conversaId]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => {
      setAppAtivo(st === 'active');
      if (st === 'active') ultimaLeituraMarcada.current = 0; // reabriu o app: confirma de novo
    });
    return () => sub.remove();
  }, []);

  // Mensagens que sumiram quando eu apaguei a conversa não voltam
  const apagadaEm = msDe(conversaDados?.ocultaEm?.[uidAtual || ""]);
  const mensagensVisiveis = apagadaEm
    ? messages.filter(m => msDe(m.data_postagem, Date.now()) > apagadaEm)
    : messages;

  // ── Marca como lida: ao abrir e a cada mensagem nova que chega com o chat aberto ──
  useEffect(() => {
    if (!conversaId || !uidAtual || !appAtivo) return;
    const maisNovaRecebida = messages
      .filter(m => m.remetenteUid !== uidAtual && !String(m.docId).startsWith('temp_'))
      .reduce((max, m) => Math.max(max, msDe(m.data_postagem, Date.now())), 0);
    // Considera também a marca local: o serverTimestamp da leitura chega null no
    // cache enquanto não confirma, e sem isso regravaria em laço.
    const jaLida = Math.max(msDe(conversaDados?.leitura?.[uidAtual]), ultimaLeituraMarcada.current);
    const precisa = maisNovaRecebida > jaLida
      || (!!conversaDados?.quemEnviou && conversaDados.quemEnviou !== uidAtual && msDe(conversaDados.data_postagem, Date.now()) > jaLida);
    if (!precisa) return;
    ultimaLeituraMarcada.current = Math.max(maisNovaRecebida, Date.now());
    marcarComoLida(conversaId, uidAtual);
  }, [messages, conversaDados?.quemEnviou, conversaDados?.data_postagem, conversaId, uidAtual, appAtivo]);

  // ── Setinhas estilo WhatsApp: ✓ enviada · ✓✓ azul = o outro leu ──
  const renderTicks = (item: any) => {
    if (String(item.docId).startsWith('temp_')) {
      return <Ionicons name="time-outline" size={13} color="rgba(255,255,255,0.65)" style={{ marginLeft: 4 }} />;
    }
    const lida = mensagemLidaPor(conversaDados, outroUid, item.data_postagem);
    return (
      <Ionicons
        name={lida ? "checkmark-done" : "checkmark"}
        size={15}
        color={lida ? "#53BDEB" : "rgba(255,255,255,0.65)"}
        style={{ marginLeft: 4 }}
      />
    );
  };

  // ── Apagar a conversa só pra mim (histórico de matches finalizados) ──
  const apagarConversa = () => {
    if (!conversaId || !uidAtual) return;
    const executar = async () => {
      try {
        await apagarConversaParaMim(conversaId, uidAtual);
        setEscolhaConversa(false);
        voltar(navigation);
      } catch (e: any) {
        console.log("Erro ao apagar conversa:", e?.message);
        Alert.alert("Erro", "Não foi possível apagar a conversa.");
      }
    };
    const msg = "A conversa some só pra você. Se a outra pessoa também apagar, ela é removida de vez.";
    if (Platform.OS === "web") { if (window.confirm("Apagar esta conversa?\n" + msg)) executar(); return; }
    Alert.alert("Apagar esta conversa?", msg, [
      { text: "Cancelar", style: "cancel" },
      { text: "Apagar", style: "destructive", onPress: executar },
    ]);
  };

  // ── Marca conversa como "ativa" (provider não notifica dela) ──
  useEffect(() => {
    if (!conversaId) return;
    setConversaAtiva(conversaId);
    return () => setConversaAtiva(null);
  }, [conversaId]);

  // ── Verifica se o match já foi finalizado/avaliado (evita repetir XP) ──
  useEffect(() => {
    if (!conversaId) return;
    getDoc(firestoreDoc(db, "conversas", conversaId)).then(snap => {
      if (snap.exists() && snap.data()?.matchFinalizado) setMatchFinalizado(true);
    }).catch(() => {});
  }, [conversaId]);

  // ── Descobre o papel na conversa: quem pediu ajuda (aluno, avalia) ──
  // vs. quem foi encontrado por saber ensinar (professor, não avalia).
  useEffect(() => {
    if (!uidAtual || !outroUid) return;
    (async () => {
      try {
        const [souAlunoSnap, souProfessorSnap] = await Promise.all([
          getDocs(query(collection(db, "match_solicitacoes"),
            where("deUid", "==", uidAtual), where("paraUid", "==", outroUid), where("status", "==", "aceito"))),
          getDocs(query(collection(db, "match_solicitacoes"),
            where("deUid", "==", outroUid), where("paraUid", "==", uidAtual), where("status", "==", "aceito"))),
        ]);
        if (!souAlunoSnap.empty) setSouAluno(true);
        else if (!souProfessorSnap.empty) setSouAluno(false);
      } catch (e) { console.log("Erro ao checar papel aluno/professor:", e); }
    })();
  }, [uidAtual, outroUid]);

  useEffect(() => {
    if (messages.length > 0) setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
  }, [messages.length, outroDigitando]);

  const handleTyping = (text: string) => {
    setInputText(text);
    if (!uidAtual || !conversaId) return;
    setDoc(firestoreDoc(db, "usuarios", uidAtual), { digitandoEm: conversaId }, { merge: true });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      setDoc(firestoreDoc(db, "usuarios", uidAtual), { digitandoEm: null }, { merge: true });
    }, 2000);
  };

  const clearTyping = () => {
    if (!uidAtual) return;
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    setDoc(firestoreDoc(db, "usuarios", uidAtual), { digitandoEm: null }, { merge: true });
  };

  const resolverDocId = (msg: any): string =>
    docIdMap.current[msg.id] || docIdMap.current[msg.docId] || msg.docId || msg.id;

  const sendMessage = async () => {
    if (!inputText.trim() || !uidAtual || !conversaId || !outroUid) return;
    const msgTexto = inputText.trim();
    setInputText(""); clearTyping();
    if (editandoId) {
      const docId = resolverDocId({ docId: editandoId, id: editandoId });
      setEditandoId(null);
      try { await updateDoc(firestoreDoc(db, "mensagens", docId), { mensagem: msgTexto, editada: true }); }
      catch (e: any) { console.log(e.message); }
      return;
    }
    const tempId = `temp_${Date.now()}`;
    const payload: any = { conversaId, mensagem: msgTexto, tipo: "texto", remetenteUid: uidAtual, nome_remetente: meuNome, foto: minhaFoto||null, data_postagem: serverTimestamp() };
    if (citando) { payload.citacao = { id: resolverDocId(citando), mensagem: citando.tipo==="imagem"?"📷 Imagem":citando.mensagem, nome: citando.nome_remetente, tipo: citando.tipo }; setCitando(null); }
    setMessages(prev => [...prev, { ...payload, docId: tempId, id: tempId, data_postagem: { toDate: () => new Date() } }]);
    try {
      const ref = await addDoc(collection(db, "mensagens"), payload);
      docIdMap.current[ref.id] = ref.id;
      setMessages(prev => prev.filter(m => m.docId !== tempId));
      await setDoc(firestoreDoc(db, "conversas", conversaId), { ultimaMensagem: msgTexto, data_postagem: serverTimestamp(), quemEnviou: uidAtual, visto: false, dadosMembros: { [uidAtual]: { nome: meuNome, foto: minhaFoto||null }, [outroUid]: { nome: outroNome||"Usuário", foto: null } } }, { merge: true });
      dispararPush({
        destinatarioUid: outroUid,
        titulo: meuNome,
        corpo: msgTexto,
        dados: { tipo: "mensagem", outroUid: uidAtual, outroNome: meuNome },
      });
    } catch (e: any) { console.log(e.message); setMessages(prev => prev.filter(m => m.docId !== tempId)); Alert.alert("Erro", "Não foi possível enviar."); }
  };

  const confirmarEnvio = async () => {
    if (!uidAtual || !conversaId || !outroUid) return;

    // Decide o payload pelo tipo
    let tipo: string;
    let mensagemPayload: string;
    let ultimaMsgTexto: string;
    let extra: any = {};

    if (previewTipo === 'imagem' && previewBase64) {
      tipo = "imagem"; mensagemPayload = previewBase64; ultimaMsgTexto = "📷 Imagem";
    } else if (previewTipo === 'video' && previewVideoB64) {
      tipo = "video"; mensagemPayload = previewVideoB64; ultimaMsgTexto = "🎥 Vídeo";
    } else if (previewTipo === 'documento' && previewDoc) {
      tipo = "documento"; mensagemPayload = previewDoc.base64;
      ultimaMsgTexto = `📄 ${previewDoc.nome}`;
      extra = { nomeArquivo: previewDoc.nome, tipoArquivo: previewDoc.tipo, tamanhoArquivo: previewDoc.tamanho };
    } else return;

    setPreviewVisible(false); setUploading(true); clearTyping();
    const tempId = `temp_${tipo}_${Date.now()}`;
    const payload: any = { conversaId, mensagem: mensagemPayload, tipo, remetenteUid: uidAtual, nome_remetente: meuNome, foto: minhaFoto||null, data_postagem: serverTimestamp(), ...extra };
    if (citando) { payload.citacao = { id: resolverDocId(citando), mensagem: citando.tipo==="imagem"||citando.tipo==="video"?"📷 Mídia":citando.mensagem, nome: citando.nome_remetente, tipo: citando.tipo }; setCitando(null); }
    setMessages(prev => [...prev, { ...payload, docId: tempId, id: tempId, data_postagem: { toDate: () => new Date() } }]);
    try {
      const ref = await addDoc(collection(db, "mensagens"), payload);
      docIdMap.current[ref.id] = ref.id;
      setMessages(prev => prev.filter(m => m.docId !== tempId));
      await setDoc(firestoreDoc(db, "conversas", conversaId), { ultimaMensagem: ultimaMsgTexto, data_postagem: serverTimestamp(), quemEnviou: uidAtual, visto: false, dadosMembros: { [uidAtual]: { nome: meuNome, foto: minhaFoto||null }, [outroUid]: { nome: outroNome||"Usuário", foto: null } } }, { merge: true });
      dispararPush({
        destinatarioUid: outroUid,
        titulo: meuNome,
        corpo: ultimaMsgTexto,
        dados: { tipo: "mensagem", outroUid: uidAtual, outroNome: meuNome },
      });
    } catch { setMessages(prev => prev.filter(m => m.docId !== tempId)); Alert.alert("Erro", "Não foi possível enviar."); }
    finally {
      setUploading(false);
      setPreviewBase64(null); setPreviewImage(null);
      setPreviewVideoB64(null); setPreviewVideo(null);
      setPreviewDoc(null);
    }
  };

  const apagarMensagem = async (msg: any) => {
    setMenuMsg(null);
    const localId = msg.docId||msg.id; const realDocId = docIdMap.current[localId]||localId;
    setMessages(prev => prev.filter(m => m.docId!==localId&&m.id!==localId&&m.docId!==realDocId&&m.id!==realDocId));
    try {
      await deleteDoc(firestoreDoc(db, "mensagens", realDocId));
      if (conversaId) {
        const msgsRestantes = messages.filter(m => m.docId!==localId&&m.id!==localId&&m.docId!==realDocId&&m.id!==realDocId);
        const ultima = msgsRestantes[msgsRestantes.length-1];
        await setDoc(firestoreDoc(db, "conversas", conversaId), { ultimaMensagem: ultima?(ultima.tipo==="imagem"?"📷 Imagem":ultima.mensagem):"", data_postagem: ultima?.data_postagem||serverTimestamp() }, { merge: true });
      }
    } catch (e: any) { console.log(e.message); }
  };

  const iniciarEdicao = (msg: any) => { setMenuMsg(null); setEditandoId(resolverDocId(msg)); setInputText(msg.mensagem); };

  // ── Favoritar/desfavoritar ────────────────────────────
  const toggleFavorito = async (msg: any) => {
    if (!uidAtual) return;
    const jaFavoritado = favoritos.some((f: any) => f.id === (msg.docId||msg.id));
    const favObj = {
      id: msg.docId||msg.id,
      mensagem: msg.mensagem,
      tipo: msg.tipo,
      nome_remetente: msg.nome_remetente,
      hora: formatarHora(msg.data_postagem),
    };
    try {
      if (jaFavoritado) {
        await updateDoc(firestoreDoc(db, "usuarios", uidAtual), { favoritos: arrayRemove(favoritos.find((f:any)=>f.id===favObj.id)) });
        setFavoritos(prev => prev.filter((f:any) => f.id !== favObj.id));
      } else {
        await updateDoc(firestoreDoc(db, "usuarios", uidAtual), { favoritos: arrayUnion(favObj) });
        setFavoritos(prev => [...prev, favObj]);
      }
    } catch (e) { console.log(e); }
    setMenuMsg(null);
    setFullImageMsg(null);
  };

  // ── Toast de XP (mesma animação usada no check-in da Home) ──
  // Se xp/moedas forem 0 (dúvida não resolvida), mostra um toast neutro sem número.
  const mostrarXpToast = (resultado: AwardResult) => {
    const neutro = resultado.xp === 0 && resultado.moedas === 0;
    setXpToast({ xp: resultado.xp, moedas: resultado.moedas, neutro });
    xpToastOpacity.setValue(0);
    xpToastSlide.setValue(40);
    Animated.parallel([
      Animated.timing(xpToastOpacity, { toValue: 1, duration: 320, useNativeDriver: true }),
      Animated.spring(xpToastSlide,   { toValue: 0, friction: 6, tension: 80, useNativeDriver: true }),
    ]).start();
    const duracao = resultado.levelUp ? 2200 : 3200;
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(xpToastOpacity, { toValue: 0, duration: 260, useNativeDriver: true }),
        Animated.timing(xpToastSlide,   { toValue: 40, duration: 260, useNativeDriver: true }),
      ]).start(() => {
        setXpToast(null);
        if (resultado.levelUp) {
          setLevelUpInfo(resultado.levelUp);
          levelUpScale.setValue(0.7);
          levelUpOpacity.setValue(0);
          Animated.parallel([
            Animated.spring(levelUpScale,   { toValue: 1, friction: 5, tension: 90, useNativeDriver: true }),
            Animated.timing(levelUpOpacity, { toValue: 1, duration: 280, useNativeDriver: true }),
          ]).start();
        }
      });
    }, duracao);
  };

  // ── Abre o modal de avaliação — só o aluno (quem pediu ajuda) avalia ──
  const abrirAvaliacao = () => {
    if (!uidAtual || !outroUid || matchFinalizado || souAluno !== true) return;
    setAvaliacaoEtapa('pergunta');
    setEntendeuDuvida(null);
    setEstrelasHover(null);
    setComentarioPriv('');
    setAvaliacaoVisible(true);
  };

  // ── Passo 1: responde se a dúvida foi resolvida, avança pro passo das estrelas ──
  const responderPergunta = (resolveu: boolean) => {
    setEntendeuDuvida(resolveu);
    setEstrelasHover(null);
    setAvaliacaoEtapa('estrelas');
  };

  // ── Passo 2: confirma a nota, premia professor (sempre) e aluno (se resolveu) ──
  const confirmarAvaliacao = async () => {
    if (!uidAtual || !outroUid || !conversaId || enviandoAvaliacao || entendeuDuvida === null || estrelasHover === null) return;
    setEnviandoAvaliacao(true);
    try {
      // uidAtual = aluno (só ele vê esse fluxo) · outroUid = professor
      const resultado = await awardXpFinalizarMatch(uidAtual, outroUid, entendeuDuvida, estrelasHover, comentarioPriv.trim());

      await setDoc(firestoreDoc(db, "conversas", conversaId), {
        matchFinalizado: true,
        finalizadoEm: serverTimestamp(),
        avaliacaoFinal: estrelasHover,
        avaliacaoResolveu: entendeuDuvida,
      }, { merge: true });

      setMatchFinalizado(true);
      setAvaliacaoVisible(false);
      mostrarXpToast(resultado.aluno);
      setEscolhaConversa(true);
    } catch (e: any) {
      console.log("❌ Erro ao finalizar match:", e.message);
      Alert.alert("Erro", "Não foi possível finalizar o match. Tente novamente.");
    } finally {
      setEnviandoAvaliacao(false);
    }
  };

  // ── Baixar imagem ──────────────────────────────────────
  const baixarMidia = (msg: any) => {
    if (Platform.OS !== "web") {
      if (msg.tipo === 'imagem') abrirArquivoBase64(msg.mensagem, `symbius_imagem_${Date.now()}.jpg`, 'image/jpeg');
      else if (msg.tipo === 'video') abrirArquivoBase64(msg.mensagem, `symbius_video_${Date.now()}.mp4`, 'video/mp4');
      else {
        const ext = msg.tipoArquivo || 'pdf';
        const mime = ext === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        abrirArquivoBase64(msg.mensagem, msg.nomeArquivo || `symbius_doc_${Date.now()}.${ext}`, mime);
      }
      return;
    }
    let dataUrl: string; let filename: string;
    if (msg.tipo === 'imagem') {
      const b64 = msg.mensagem;
      dataUrl = b64.startsWith("data:") ? b64 : `data:image/jpeg;base64,${b64}`;
      filename = `symbius_imagem_${Date.now()}.jpg`;
    } else if (msg.tipo === 'video') {
      const b64 = msg.mensagem;
      dataUrl = b64.startsWith("data:") ? b64 : `data:video/mp4;base64,${b64}`;
      filename = `symbius_video_${Date.now()}.mp4`;
    } else {
      const ext = msg.tipoArquivo || 'pdf';
      const b64 = msg.mensagem;
      const mime = ext === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      dataUrl = b64.startsWith("data:") ? b64 : `data:${mime};base64,${b64}`;
      filename = msg.nomeArquivo || `symbius_doc_${Date.now()}.${ext}`;
    }
    const link = document.createElement("a");
    link.href = dataUrl; link.download = filename;
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  const abrirImagemFull = (b64: string, msg?: any) => {
    setFullImageUrl(b64.startsWith("data:") ? b64 : `data:image/jpeg;base64,${b64}`);
    setFullImageMsg(msg || null);
    setFullImageVisible(true);
  };

  const cancelarPreview = () => {
    setPreviewVisible(false);
    setPreviewImage(null); setPreviewBase64(null);
    setPreviewVideo(null); setPreviewVideoB64(null);
    setPreviewDoc(null);
  };

  if (loading) {
    return <View style={{ flex:1, justifyContent:"center", alignItems:"center", backgroundColor: CC.fundo }}><ActivityIndicator size="large" color={CORES_SYMBIUS.verdeEscuro} /></View>;
  }

  const outraFotoUri = outraFoto
    ? (outraFoto.startsWith("data:")||outraFoto.startsWith("http") ? outraFoto : `data:image/jpeg;base64,${outraFoto}`)
    : "https://cdn-icons-png.flaticon.com/512/149/149071.png";

  return (
    <KeyboardAvoidingView style={[styles.container, { backgroundColor: CC.fundo }]} behavior={Platform.OS==="ios"?"padding":"height"}>

      {/* ── HEADER ── */}
      <View style={[styles.header, { paddingTop: insets.top + 10, backgroundColor: CC.headerBg, borderBottomColor: CC.headerBorder }]}>
        <TouchableOpacity onPress={() => voltar(navigation)} style={[styles.backBtn, { backgroundColor: CC.backBtn }]}>
          <Ionicons name="arrow-back" size={22} color={CC.backIcon} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.headerCenter} onPress={() => setPerfilVisible(true)} activeOpacity={0.7}>
          <View style={styles.headerAvatarWrap}>
            <Image source={{ uri: outraFotoUri }} style={styles.headerAvatar} />
            <View style={[styles.headerOnlineDot, { backgroundColor: onlineStatus ? "#22C55E" : "#94A3B8" }]} />
          </View>
          <View>
            <Text style={[styles.headerTitle, { color: CC.headerTitle }]}>{outroNome || "Chat"}</Text>
            {outroDigitando
              ? <Text style={[styles.headerSub, { color: CORES_SYMBIUS.verdeEscuro }]}>digitando...</Text>
              : <Text style={[styles.headerSub, { color: onlineStatus?"#22C55E":CC.textoSec }]}>{onlineStatus?"online":"offline"}</Text>
            }
          </View>
          <Ionicons name="chevron-forward" size={14} color={CC.textoSec} style={{ marginLeft: 4 }} />
        </TouchableOpacity>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <TouchableOpacity
          style={[styles.finalizarBtn, { backgroundColor: silenciado ? CORES_SYMBIUS.laranjaTexto + '25' : CC.backBtn }]}
          onPress={alternarSilenciar}
          activeOpacity={0.7}
          accessibilityLabel={silenciado ? "Reativar notificações desta conversa" : "Silenciar esta conversa"}
        >
          <Ionicons
            name={silenciado ? "notifications-off" : "notifications-outline"}
            size={19}
            color={silenciado ? CORES_SYMBIUS.laranjaTexto : CC.backIcon}
          />
        </TouchableOpacity>
        {matchFinalizado && (
          <TouchableOpacity
            style={[styles.finalizarBtn, { backgroundColor: CC.backBtn }]}
            onPress={apagarConversa}
            activeOpacity={0.7}
            accessibilityLabel="Apagar conversa"
          >
            <Ionicons name="trash-outline" size={19} color="#D64545" />
          </TouchableOpacity>
        )}
        {souAluno === true ? (
          <TouchableOpacity
            style={[styles.finalizarBtn, { backgroundColor: matchFinalizado ? CC.backBtn : CORES_SYMBIUS.verdeEscuro + '25' }]}
            onPress={abrirAvaliacao}
            disabled={matchFinalizado}
            activeOpacity={0.7}
          >
            <Ionicons
              name={matchFinalizado ? "checkmark-circle" : "flag-outline"}
              size={20}
              color={matchFinalizado ? '#94A3B8' : CORES_SYMBIUS.verdeEscuro}
            />
          </TouchableOpacity>
        ) : null}
        </View>
      </View>
      {matchFinalizado && (
        <View style={[styles.avisoSilenciado, { backgroundColor: CORES_SYMBIUS.fundoSuave }]}>
          <Ionicons name="checkmark-circle" size={13} color={CORES_SYMBIUS.verdeEscuro} />
          <Text style={[styles.avisoSilenciadoTxt, { color: CORES_SYMBIUS.textoSec }]}>Match finalizado · a conversa continua no seu histórico</Text>
        </View>
      )}
      {silenciado && (
        <TouchableOpacity style={[styles.avisoSilenciado, { backgroundColor: CORES_SYMBIUS.fundoLaranjaClaro }]} onPress={alternarSilenciar}>
          <Ionicons name="notifications-off" size={13} color={CORES_SYMBIUS.laranjaTexto} />
          <Text style={[styles.avisoSilenciadoTxt, { color: CORES_SYMBIUS.laranjaTexto }]}>Conversa silenciada · toque para reativar</Text>
        </TouchableOpacity>
      )}

      {/* ── MENSAGENS ── */}
      <ScrollView
        ref={scrollRef}
        style={[styles.scrollView, { backgroundColor: CC.scrollBg }]}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
      >
        {mensagensVisiveis.map((item, index) => {
          const isMe = item.remetenteUid === uidAtual;
          const chaveAtual    = getDataChave(item.data_postagem);
          const chaveAnterior = index > 0 ? getDataChave(mensagensVisiveis[index-1].data_postagem) : null;
          const mostrarSep    = chaveAtual !== chaveAnterior;
          const prevMsg       = mensagensVisiveis[index-1];
          const primeiraDaSeq = !prevMsg || prevMsg.remetenteUid !== item.remetenteUid || mostrarSep;
          const borderMe    = primeiraDaSeq ? { borderRadius:18, borderBottomRightRadius:4 } : { borderRadius:18 };
          const borderOther = primeiraDaSeq ? { borderRadius:18, borderBottomLeftRadius:4  } : { borderRadius:18 };
          const isFav = favoritos.some((f:any) => f.id === (item.docId||item.id));

          return (
            <React.Fragment key={item.docId||item.id||String(index)}>
              {mostrarSep && (
                <View style={styles.separadorDataWrap}>
                  <View style={[styles.separadorDataLinha, { backgroundColor: CC.sepLinha }]} />
                  <Text style={[styles.separadorDataTxt, { color: CC.sepText, backgroundColor: CC.sepBg }]}>{formatarDataSeparador(item.data_postagem)}</Text>
                  <View style={[styles.separadorDataLinha, { backgroundColor: CC.sepLinha }]} />
                </View>
              )}
              <TouchableOpacity activeOpacity={0.8} onLongPress={() => setMenuMsg(item)} style={[styles.messageRow, isMe?styles.messageRowMe:styles.messageRowOther, { marginVertical: primeiraDaSeq?4:1 }]}>
                <View style={[styles.bolha, { maxWidth: bolhaMaxWidth, backgroundColor: isMe?CC.bolhaMe:CC.bolhaOther }, isMe?borderMe:borderOther]}>
                  {/* Indicador de encaminhada */}
                  {item.encaminhada && <Text style={[styles.encaminhadaLabel, !isMe && { color: CORES_SYMBIUS.textoSec }]}>↪️ Encaminhada</Text>}
                  {!isMe && primeiraDaSeq && <Text style={styles.nomeRemetente}>{item.nome_remetente}</Text>}
                  {item.citacao && (
                    <View style={[styles.citacaoBox, isMe?styles.citacaoMe:styles.citacaoOther]}>
                      <Text style={styles.citacaoNome}>{item.citacao.nome}</Text>
                      <Text style={styles.citacaoTexto} numberOfLines={2}>{item.citacao.mensagem}</Text>
                    </View>
                  )}
                  {item.tipo === "imagem" ? (
                    <>
                      <ImagemMensagem base64={item.mensagem} onPress={() => abrirImagemFull(item.mensagem, item)} />
                      <View style={styles.rodape}>
                        {isFav && <Ionicons name="star" size={10} color="rgba(255,200,44,0.8)" style={{ marginRight: 4 }} />}
                        <Text style={[styles.hora, !isMe && { color: CORES_SYMBIUS.textoSec }]}>{formatarHora(item.data_postagem)}</Text>
                        {isMe && renderTicks(item)}
                      </View>
                    </>
                  ) : item.tipo === "video" ? (
                    <>
                      <TouchableOpacity onPress={() => setFullVideoMsg(item)} activeOpacity={0.85}>
                        <View style={[styles.videoThumb, { width: imgMax }]}>
                          <Ionicons name="play-circle" size={52} color="rgba(255,255,255,0.9)" />
                          <Text style={styles.videoLabel}>Toque para assistir</Text>
                        </View>
                      </TouchableOpacity>
                      <View style={styles.rodape}>
                        {isFav && <Ionicons name="star" size={10} color="rgba(255,200,44,0.8)" style={{ marginRight: 4 }} />}
                        <Text style={[styles.hora, !isMe && { color: CORES_SYMBIUS.textoSec }]}>{formatarHora(item.data_postagem)}</Text>
                        {isMe && renderTicks(item)}
                      </View>
                    </>
                  ) : item.tipo === "documento" ? (
                    <>
                      <TouchableOpacity style={[styles.docBolha, { borderColor: 'rgba(255,255,255,0.2)' }]} onPress={() => baixarMidia(item)} activeOpacity={0.8}>
                        <Ionicons name={item.tipoArquivo === 'pdf' ? 'document-text' : 'document'} size={32} color={item.tipoArquivo === 'pdf' ? '#FF6B9D' : '#90CAF9'} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.docBolhaNome} numberOfLines={2}>{item.nomeArquivo || 'Documento'}</Text>
                          <Text style={styles.docBolhaTipo}>{item.tipoArquivo?.toUpperCase()} · toque para baixar</Text>
                        </View>
                        <Ionicons name="download-outline" size={18} color="rgba(255,255,255,0.6)" />
                      </TouchableOpacity>
                      <View style={styles.rodape}>
                        {isFav && <Ionicons name="star" size={10} color="rgba(255,200,44,0.8)" style={{ marginRight: 4 }} />}
                        <Text style={[styles.hora, !isMe && { color: CORES_SYMBIUS.textoSec }]}>{formatarHora(item.data_postagem)}</Text>
                        {isMe && renderTicks(item)}
                      </View>
                    </>
                  ) : (
                    <>
                      <Text style={[styles.messageText, !isMe && { color: CORES_SYMBIUS.texto }]}>{item.mensagem}</Text>
                      <View style={styles.rodape}>
                        {item.editada && <Text style={[styles.editadaLabel, !isMe && { color: CORES_SYMBIUS.textoSec }]}>editada · </Text>}
                        {isFav && <Ionicons name="star" size={10} color="rgba(255,200,44,0.8)" style={{ marginRight: 4 }} />}
                        <Text style={[styles.hora, !isMe && { color: CORES_SYMBIUS.textoSec }]}>{formatarHora(item.data_postagem)}</Text>
                        {isMe && renderTicks(item)}
                      </View>
                    </>
                  )}
                </View>
              </TouchableOpacity>
            </React.Fragment>
          );
        })}

        {outroDigitando && (
          <View style={[styles.messageRow, styles.messageRowOther]}>
            <View style={[styles.bolha, { backgroundColor: CC.bolhaOther, borderRadius:18, borderBottomLeftRadius:4, paddingHorizontal:16, paddingVertical:14 }]}>
              {Platform.OS==="web" ? (
                // @ts-ignore
                <div style={{ display:"flex", alignItems:"center", gap:4 }}>
                  {/* @ts-ignore */}
                  <span className="typing-dot"/><span className="typing-dot"/><span className="typing-dot"/>
                </div>
              ) : <TypingDotsNative />}
            </View>
          </View>
        )}
      </ScrollView>

      {/* ── BARRA CITAÇÃO/EDIÇÃO ── */}
      {(citando||editandoId) && (
        <View style={[styles.citandoBar, { backgroundColor: CC.citandoBg, borderTopColor: CC.citandoBorder }]}>
          <View style={styles.citandoInfo}>
            {citando ? <>
              <Text style={[styles.citandoNome, { color: CC.citandoNome }]}>{citando.nome_remetente}</Text>
              <Text style={[styles.citandoTexto, { color: CC.citandoTexto }]} numberOfLines={1}>{citando.tipo==="imagem"?"Imagem":citando.mensagem}</Text>
            </> : <Text style={[styles.citandoNome, { color: CC.citandoNome }]}>Editando mensagem</Text>}
          </View>
          <TouchableOpacity onPress={() => { setCitando(null); setEditandoId(null); setInputText(""); clearTyping(); }}>
            <Ionicons name="close" size={20} color={CC.citandoFechar} style={{ paddingLeft: 10 }} />
          </TouchableOpacity>
        </View>
      )}

      {/* ── SUBPAINEL DE ANEXO estilo WhatsApp ── */}
      {subpainelVisible && (
        <View style={[styles.subpainel, { backgroundColor: CC.inputBg, borderTopColor: CC.inputBorder }]}>
          {/* Foto */}
          <TouchableOpacity style={styles.subItem} onPress={() => { setSubpainelVisible(false); Platform.OS === "web" ? fileInputRef.current?.click() : anexarImagem('galeria'); }}>
            <View style={[styles.subIconWrap, { backgroundColor: CORES_SYMBIUS.verdeEscuro }]}>
              <Ionicons name="image" size={26} color="#fff" />
            </View>
            <Text style={[styles.subLabel, { color: CC.menuTitle }]}>Galeria</Text>
          </TouchableOpacity>
          {Platform.OS !== "web" && (
            <TouchableOpacity style={styles.subItem} onPress={() => { setSubpainelVisible(false); anexarImagem('camera'); }}>
              <View style={[styles.subIconWrap, { backgroundColor: CORES_SYMBIUS.laranjaTexto }]}>
                <Ionicons name="camera" size={26} color="#fff" />
              </View>
              <Text style={[styles.subLabel, { color: CC.menuTitle }]}>Câmera</Text>
            </TouchableOpacity>
          )}
          {/* Vídeo */}
          <TouchableOpacity style={styles.subItem} onPress={() => { setSubpainelVisible(false); Platform.OS === "web" ? videoInputRef.current?.click() : anexarVideo(); }}>
            <View style={[styles.subIconWrap, { backgroundColor: "#7C3AED" }]}>
              <Ionicons name="videocam" size={26} color="#fff" />
            </View>
            <Text style={[styles.subLabel, { color: CC.menuTitle }]}>Vídeo</Text>
          </TouchableOpacity>
          {/* Documento */}
          <TouchableOpacity style={styles.subItem} onPress={() => { setSubpainelVisible(false); Platform.OS === "web" ? docInputRef.current?.click() : anexarDocumento(); }}>
            <View style={[styles.subIconWrap, { backgroundColor: CORES_SYMBIUS.texto }]}>
              <Ionicons name="document-text" size={26} color="#fff" />
            </View>
            <Text style={[styles.subLabel, { color: CC.menuTitle }]}>Documento</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── INPUT ── */}
      <View style={[styles.inputArea, { backgroundColor: CC.inputBg, borderTopColor: CC.inputBorder }, Platform.OS === "android" && { paddingBottom: 14 + insets.bottom }]}>
        <TextInput value={inputText} onChangeText={handleTyping} style={[styles.input, { backgroundColor: CC.scrollBg, color: CC.inputText, borderColor: CC.inputBorder }]} placeholder="Digite aqui..." placeholderTextColor={CC.inputPlaceholder} multiline />
        {/* Grampo lado direito antes do send */}
        <TouchableOpacity
          onPress={() => setSubpainelVisible(v => !v)}
          style={[styles.imgButton, { backgroundColor: subpainelVisible ? CORES_SYMBIUS.verdeEscuro : CC.imgBtnBg, borderColor: CC.imgBtnBorder }]}
          disabled={uploading}
        >
          {uploading
            ? <ActivityIndicator size="small" color={CORES_SYMBIUS.verdeEscuro} />
            : <Ionicons name={subpainelVisible ? "close" : "attach"} size={22} color={subpainelVisible ? "#fff" : CC.imgBtnIcon} style={{ transform: [{ rotate: subpainelVisible ? "0deg" : "45deg" }] }} />
          }
        </TouchableOpacity>
        <TouchableOpacity onPress={sendMessage} style={[styles.sendButton, { backgroundColor: CC.sendBg }]}>
          <Ionicons name="send" size={18} color="white" />
        </TouchableOpacity>
      </View>

      {/* ── MENU CONTEXTO ── */}
      {menuMsg && (
        <View style={styles.overlayFull}>
          <TouchableOpacity style={{
  position: "absolute",
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
}} onPress={() => setMenuMsg(null)} />
          <View style={[styles.menuCard, { backgroundColor: CC.menuBg }]}>
            <Text style={[styles.menuTitle, { color: CC.menuTitle }]}>Opções</Text>
            <TouchableOpacity style={[styles.menuItem, { borderBottomColor: CC.menuBorder }]} onPress={() => { setCitando(menuMsg); setMenuMsg(null); }}>
              <Text style={styles.menuItemIcon}>↩️</Text><Text style={[styles.menuItemText, { color: CC.menuText }]}>Responder</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.menuItem, { borderBottomColor: CC.menuBorder }]} onPress={() => { setEncaminharMsg(menuMsg); setMenuMsg(null); }}>
              <Text style={styles.menuItemIcon}>↪️</Text><Text style={[styles.menuItemText, { color: CC.menuText }]}>Encaminhar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.menuItem, { borderBottomColor: CC.menuBorder }]} onPress={() => toggleFavorito(menuMsg)}>
              <Ionicons name={favoritos.some((f:any)=>f.id===(menuMsg.docId||menuMsg.id))?"star":"star-outline"} size={20} color={CC.menuText} style={{ marginRight: 12 }} />
              <Text style={[styles.menuItemText, { color: CC.menuText }]}>{favoritos.some((f:any)=>f.id===(menuMsg.docId||menuMsg.id))?"Desfavoritar":"Favoritar"}</Text>
            </TouchableOpacity>
            {menuMsg.remetenteUid===uidAtual && menuMsg.tipo==="texto" && (
              <TouchableOpacity style={[styles.menuItem, { borderBottomColor: CC.menuBorder }]} onPress={() => iniciarEdicao(menuMsg)}>
                <Ionicons name="create-outline" size={20} color={CC.menuText} style={{ marginRight: 12 }} /><Text style={[styles.menuItemText, { color: CC.menuText }]}>Editar</Text>
              </TouchableOpacity>
            )}
            {menuMsg.remetenteUid===uidAtual && (
              <TouchableOpacity style={[styles.menuItem, { borderBottomColor: CC.menuBorder }]} onPress={() => {
                if (Platform.OS==="web") { if (window.confirm("Apagar mensagem?")) apagarMensagem(menuMsg); }
                else Alert.alert("Apagar", "Tem certeza?", [{ text:"Cancelar",style:"cancel" },{ text:"Apagar",style:"destructive",onPress:()=>apagarMensagem(menuMsg) }]);
              }}>
                <Ionicons name="trash-outline" size={20} color="#ff4d6d" style={{ marginRight: 12 }} /><Text style={[styles.menuItemText, { color: "#ff4d6d" }]}>Apagar</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={[styles.menuItem, { borderBottomWidth:0, marginTop:4 }]} onPress={() => setMenuMsg(null)}>
              <Text style={[styles.menuItemText, { color: CC.textoSec, textAlign:"center", width:"100%" }]}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ── PREVIEW UNIFICADO ── */}
      {previewVisible && (
        <View style={styles.overlayFull}>
          <View style={[styles.previewCard, { backgroundColor: CC.previewBg }]}>
            <Text style={[styles.previewTitle, { color: CC.previewTitle }]}>
              {previewTipo === 'imagem' ? 'Pré-visualização' : previewTipo === 'video' ? 'Vídeo' : 'Documento'}
            </Text>

            {/* Imagem */}
            {previewTipo === 'imagem' && previewImage && (
              Platform.OS === "web"
                // @ts-ignore
                ? <img src={previewImage} style={{ width:280,height:280,objectFit:"contain",borderRadius:12,marginBottom:20 }} />
                : <Image source={{ uri: previewImage }} style={styles.previewImage} resizeMode="contain" />
            )}

            {/* Vídeo */}
            {previewTipo === 'video' && Platform.OS !== "web" && (
              <View style={[styles.docPreviewBox, { backgroundColor: CC.scrollBg, borderColor: CC.inputBorder }]}>
                <Ionicons name="videocam" size={48} color={CORES_SYMBIUS.verdeEscuro} />
                <Text style={[styles.docTamanho, { color: CC.textoSec }]}>
                  {previewDoc?.tamanho ? `${(previewDoc.tamanho / 1024).toFixed(0)} KB` : 'Vídeo'}
                </Text>
              </View>
            )}
            {previewTipo === 'video' && previewVideo && Platform.OS === "web" && (
              // @ts-ignore
              <video src={previewVideo} controls style={{ width:280,height:200,borderRadius:12,marginBottom:20,backgroundColor:"#000" }} />
            )}

            {/* Documento */}
            {previewTipo === 'documento' && previewDoc && (
              <View style={[styles.docPreviewBox, { backgroundColor: CC.scrollBg, borderColor: CC.inputBorder }]}>
                <Ionicons name={previewDoc.tipo === 'pdf' ? 'document-text' : 'document'} size={48} color={previewDoc.tipo === 'pdf' ? CORES_SYMBIUS.verdeEscuro : CORES_SYMBIUS.texto} />
                <Text style={[styles.docNome, { color: CC.previewTitle }]} numberOfLines={2}>{previewDoc.nome}</Text>
                <Text style={[styles.docTamanho, { color: CC.textoSec }]}>
                  {previewDoc.tipo?.toUpperCase()} · {(previewDoc.tamanho / 1024).toFixed(0)} KB
                </Text>
              </View>
            )}

            <View style={styles.previewButtons}>
              <TouchableOpacity style={[styles.previewBtn, { backgroundColor: CC.cancelBg }]} onPress={cancelarPreview}>
                <Text style={[styles.cancelBtnText, { color: CC.cancelText }]}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.previewBtn, styles.sendBtn]} onPress={confirmarEnvio}>
                <Text style={styles.sendBtnText}>Enviar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* ── FULLSCREEN IMAGEM com toolbar ── */}
      {fullImageVisible && (
        <View style={styles.overlayFullDark}>
          {/* Toolbar superior */}
          <View style={styles.fullToolbar}>
            <Text style={styles.fullToolbarNome}>{fullImageMsg?.nome_remetente || ""}</Text>
            <Text style={styles.fullToolbarHora}>{fullImageMsg ? formatarHora(fullImageMsg.data_postagem) : ""}</Text>
            <View style={styles.fullToolbarActions}>
              {/* Responder */}
              <TouchableOpacity style={styles.fullToolBtn} onPress={() => { setCitando(fullImageMsg); setFullImageVisible(false); }}>
                <Ionicons name="arrow-undo-outline" size={22} color="#fff" />
              </TouchableOpacity>
              {/* Favoritar */}
              <TouchableOpacity style={styles.fullToolBtn} onPress={() => { if (fullImageMsg) toggleFavorito(fullImageMsg); setFullImageVisible(false); }}>
                <Ionicons name={fullImageMsg && favoritos.some((f:any)=>f.id===(fullImageMsg.docId||fullImageMsg.id)) ? "star" : "star-outline"} size={22} color={fullImageMsg && favoritos.some((f:any)=>f.id===(fullImageMsg.docId||fullImageMsg.id)) ? "#FFC82C" : "#fff"} />
              </TouchableOpacity>
              {/* Encaminhar */}
              <TouchableOpacity style={styles.fullToolBtn} onPress={() => { setEncaminharMsg(fullImageMsg); setFullImageVisible(false); }}>
                <Ionicons name="share-outline" size={22} color="#fff" />
              </TouchableOpacity>
              {/* Baixar */}
              <TouchableOpacity style={styles.fullToolBtn} onPress={() => fullImageMsg && baixarMidia(fullImageMsg)}>
                <Ionicons name="download-outline" size={22} color="#fff" />
              </TouchableOpacity>
              {/* Fechar */}
              <TouchableOpacity style={styles.fullToolBtn} onPress={() => setFullImageVisible(false)}>
                <Ionicons name="close" size={26} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Imagem */}
          {fullImageUrl && (
            Platform.OS==="web"
              // @ts-ignore
              ? <img src={fullImageUrl} style={{ maxWidth:"95%", maxHeight:"82%", objectFit:"contain", borderRadius:8 }} />
              : <Image source={{ uri: fullImageUrl }} style={styles.fullImage} resizeMode="contain" />
          )}
        </View>
      )}

      {/* ── FULLSCREEN VÍDEO ── */}
      {fullVideoMsg && (
        <View style={styles.overlayFullDark}>
          {/* Toolbar */}
          <View style={styles.fullToolbar}>
            <Text style={styles.fullToolbarNome}>{fullVideoMsg.nome_remetente || ""}</Text>
            <Text style={styles.fullToolbarHora}>{formatarHora(fullVideoMsg.data_postagem)}</Text>
            <View style={styles.fullToolbarActions}>
              <TouchableOpacity style={styles.fullToolBtn} onPress={() => { setCitando(fullVideoMsg); setFullVideoMsg(null); }}>
                <Ionicons name="arrow-undo-outline" size={22} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.fullToolBtn} onPress={() => { if (fullVideoMsg) toggleFavorito(fullVideoMsg); setFullVideoMsg(null); }}>
                <Ionicons name={favoritos.some((f:any)=>f.id===(fullVideoMsg.docId||fullVideoMsg.id))?"star":"star-outline"} size={22} color={favoritos.some((f:any)=>f.id===(fullVideoMsg.docId||fullVideoMsg.id))?"#FFC82C":"#fff"} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.fullToolBtn} onPress={() => { setEncaminharMsg(fullVideoMsg); setFullVideoMsg(null); }}>
                <Ionicons name="share-outline" size={22} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.fullToolBtn} onPress={() => baixarMidia(fullVideoMsg)}>
                <Ionicons name="download-outline" size={22} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.fullToolBtn} onPress={() => setFullVideoMsg(null)}>
                <Ionicons name="close" size={26} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
          {Platform.OS === "web" ? (() => {
            const b64 = fullVideoMsg.mensagem;
            const src = b64.startsWith("data:") ? b64 : `data:video/mp4;base64,${b64}`;
            // @ts-ignore
            return <video src={src} controls autoPlay style={{ maxWidth:"95%", maxHeight:"72%", borderRadius:8, backgroundColor:"#000" }} />;
          })() : (
            <TouchableOpacity style={{ alignItems: "center", gap: 10 }} onPress={() => baixarMidia(fullVideoMsg)}>
              <Ionicons name="play-circle" size={84} color="#fff" />
              <Text style={{ color: "#fff", fontFamily: F.semibold }}>Abrir no player do celular</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* ── MODAL PERFIL ── */}
      <PerfilModal
        visible={perfilVisible}
        onClose={() => setPerfilVisible(false)}
        outroUid={outroUid}
        outroNome={outroNome}
        outraFoto={outraFoto}
        CC={CC}
        meuUid={uidAtual}
      />

      {/* ── MODAL ENCAMINHAR ── */}
      {encaminharMsg && (
        <EncaminharModal
          visible={!!encaminharMsg}
          onClose={() => setEncaminharMsg(null)}
          meuUid={uidAtual}
          meuNome={meuNome}
          minhaFoto={minhaFoto}
          mensagem={encaminharMsg}
          CC={CC}
        />
      )}

      {escolhaConversa && (
        <View style={styles.overlayFull}>
          <View style={[styles.menuCard, { backgroundColor: CC.menuBg }]}>
            <Text style={[styles.menuTitle, { color: CC.menuTitle }]}>Match finalizado</Text>
            <Text style={{ color: CC.textoSec, fontFamily: F.medium, fontSize: 13, textAlign: "center", marginBottom: 14 }}>
              O que você quer fazer com esta conversa?
            </Text>
            <TouchableOpacity
              style={[styles.menuItem, { borderBottomColor: CC.menuBorder }]}
              onPress={() => setEscolhaConversa(false)}
            >
              <Text style={styles.menuItemIcon}>💬</Text>
              <Text style={[styles.menuItemText, { color: CC.menuText }]}>Manter a conversa</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.menuItem, { borderBottomWidth: 0 }]} onPress={apagarConversa}>
              <Text style={styles.menuItemIcon}>🗑️</Text>
              <Text style={[styles.menuItemText, { color: "#D64545" }]}>Apagar a conversa</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ── AVALIAÇÃO / FINALIZAR MATCH (aluno avalia o professor) ── */}
      {avaliacaoVisible && (
        <TouchableWithoutFeedback onPress={() => !enviandoAvaliacao && setAvaliacaoVisible(false)}>
          <View style={avaliacaoStyles.backdrop}>
            <TouchableWithoutFeedback>
              <View style={[avaliacaoStyles.card, { backgroundColor: CC.menuBg }]}>
                {avaliacaoEtapa === 'pergunta' ? (
                  <>
                    <Ionicons name="help-circle-outline" size={44} color={CC.menuTitle} style={{ marginBottom: 8 }} />
                    <Text style={[avaliacaoStyles.titulo, { color: CC.menuTitle, fontFamily: F.black }]}>
                      Você conseguiu tirar sua dúvida com {outroNome}?
                    </Text>
                    <Text style={[avaliacaoStyles.subtitulo, { color: CC.textoSec, fontFamily: F.medium }]}>
                      Isso ajuda a gente a recompensar quem realmente ajuda
                    </Text>

                    <TouchableOpacity
                      style={[avaliacaoStyles.btnConfirmar, { backgroundColor: "#22C55E", marginBottom: 10 }]}
                      onPress={() => responderPergunta(true)}
                      activeOpacity={0.85}
                    >
                      <Text style={avaliacaoStyles.btnConfirmarTxt}>Sim, entendi a matéria!</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[avaliacaoStyles.btnConfirmar, { backgroundColor: CORES_SYMBIUS.verdeEscuro }]}
                      onPress={() => responderPergunta(false)}
                      activeOpacity={0.85}
                    >
                      <Text style={avaliacaoStyles.btnConfirmarTxt}>Não, ainda com dúvida</Text>
                    </TouchableOpacity>

                    <TouchableOpacity onPress={() => setAvaliacaoVisible(false)} style={{ marginTop: 14 }}>
                      <Text style={[avaliacaoStyles.btnCancelar, { color: CC.textoSec }]}>Cancelar</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <Ionicons name={entendeuDuvida ? "happy-outline" : "sad-outline"} size={44} color={CC.menuTitle} style={{ marginBottom: 8 }} />
                    <Text style={[avaliacaoStyles.titulo, { color: CC.menuTitle, fontFamily: F.black }]}>
                      Avalie {outroNome}
                    </Text>
                    <Text style={[avaliacaoStyles.subtitulo, { color: CC.textoSec, fontFamily: F.medium }]}>
                      {entendeuDuvida
                        ? "Quão bem ele(a) te ajudou?"
                        : "O que faltou? Isso é privado, só ele(a) vê"}
                    </Text>

                    <View style={avaliacaoStyles.estrelasRow}>
                      {(entendeuDuvida ? [4, 5] : [0, 1, 2, 3]).map(n => (
                        <TouchableOpacity key={n} onPress={() => setEstrelasHover(n)} disabled={enviandoAvaliacao}>
                          <Ionicons
                            name={n === 0 ? "close-circle" : (estrelasHover !== null && n <= estrelasHover ? "star" : "star-outline")}
                            size={34}
                            color={n === 0 ? (estrelasHover === 0 ? CORES_SYMBIUS.verdeEscuro : CC.textoSec) : "#FFC82C"}
                            style={{ marginHorizontal: 3 }}
                          />
                        </TouchableOpacity>
                      ))}
                    </View>
                    <Text style={[avaliacaoStyles.subtitulo, { color: CC.textoSec, fontFamily: F.medium, marginTop: -8 }]}>
                      {estrelasHover === null ? " "
                        : estrelasHover === 5 ? "Perfeito!"
                        : estrelasHover === 4 ? "Bom, mas podia melhorar"
                        : estrelasHover === 3 ? "Não resolveu, mas explicou bem"
                        : estrelasHover === 2 ? "Saí com mais dúvidas, mas tentou"
                        : estrelasHover === 1 ? "Tentou, mas não adiantou"
                        : "Não ajudou em nada"}
                    </Text>

                    {entendeuDuvida === false && (
                      <TextInput
                        value={comentarioPriv}
                        onChangeText={setComentarioPriv}
                        placeholder="O que poderia ter sido melhor? (opcional)"
                        placeholderTextColor={CC.textoSec}
                        multiline
                        style={[avaliacaoStyles.comentarioInput, { color: CC.menuTitle, borderColor: CC.menuBorder }]}
                      />
                    )}

                    <TouchableOpacity
                      style={[avaliacaoStyles.btnConfirmar, { backgroundColor: estrelasHover !== null ? CORES_SYMBIUS.verdeEscuro : "#CBD5E1", marginTop: 8 }]}
                      disabled={estrelasHover === null || enviandoAvaliacao}
                      onPress={confirmarAvaliacao}
                      activeOpacity={0.85}
                    >
                      {enviandoAvaliacao
                        ? <ActivityIndicator color="#fff" />
                        : <Text style={avaliacaoStyles.btnConfirmarTxt}>Finalizar match</Text>}
                    </TouchableOpacity>

                    <TouchableOpacity onPress={() => setAvaliacaoEtapa('pergunta')} disabled={enviandoAvaliacao}>
                      <Text style={[avaliacaoStyles.btnCancelar, { color: CC.textoSec }]}>Voltar</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      )}

      {/* ── TOAST DE XP ── */}
      {xpToast && (
        <View style={avaliacaoStyles.toastOverlay} pointerEvents="none">
          <Animated.View style={[
            avaliacaoStyles.toastCard,
            { backgroundColor: modoEscuro ? CORES_SYMBIUS.fundoCard : "#FFFFFF",
              opacity: xpToastOpacity,
              transform: [{ translateY: xpToastSlide }] },
          ]}>
            <Ionicons name={xpToast.neutro ? "mail-outline" : "leaf"} size={28} color={CORES_SYMBIUS.verdeEscuro} />
            <View>
              <Text style={[avaliacaoStyles.toastTitulo, { color: modoEscuro ? CORES_SYMBIUS.texto : CORES_SYMBIUS.texto, fontFamily: F.bold }]}>
                {xpToast.neutro ? "Feedback enviado!" : "Match finalizado!"}
              </Text>
              <Text style={[avaliacaoStyles.toastSubtitulo, { color: "#8D99AE", fontFamily: F.medium }]}>
                {xpToast.neutro ? "Tenta com outro professor sem problema" : `+${xpToast.xp} XP · +${xpToast.moedas} Sementes`}
              </Text>
            </View>
          </Animated.View>
        </View>
      )}

      {/* ── MODAL DE LEVEL-UP — mesmo componente/gradiente radial por animal
          usado na Home (Index.tsx); só design por enquanto, back-end (levelUpInfo)
          já é o real, calculado pelo gamificationService. ── */}
      <NivelUpSymbiusModal info={levelUpInfo} onFechar={() => setLevelUpInfo(null)} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex:1, ...(Platform.OS==="web"?{height:"100vh" as any,maxHeight:"100vh" as any,overflow:"hidden" as any}:{}) },

  header:           { flexDirection:"row",alignItems:"center",justifyContent:"space-between",paddingHorizontal:16,paddingTop:Platform.OS==="ios"?50:40,paddingBottom:14,borderBottomWidth:1,elevation:2,shadowColor:"#000",shadowOpacity:.05,shadowRadius:4 },
  backBtn:          { width:38,height:38,borderRadius:19,justifyContent:"center",alignItems:"center" },
  headerCenter:     { flexDirection:"row",alignItems:"center",gap:10,flex:1,paddingLeft:10 },
  headerAvatarWrap: { position:"relative" },
  headerAvatar:     { width:42,height:42,borderRadius:21,backgroundColor:CORES_SYMBIUS.borda },
  headerOnlineDot:  { position:"absolute",bottom:1,right:1,width:12,height:12,borderRadius:6,borderWidth:2,borderColor:"#FFFFFF" },
  headerTitle:      { fontSize:16,fontFamily: F.black },
  headerSub:        { fontSize:12,fontFamily: F.semibold,marginTop:1 },

  scrollView:    { flex:1 },
  scrollContent: { paddingVertical:12,paddingHorizontal:12,flexGrow:1 },

  messageRow:      { flexDirection:"row",alignItems:"flex-end",paddingHorizontal:4,width:"100%" },
  messageRowMe:    { justifyContent:"flex-end" },
  messageRowOther: { justifyContent:"flex-start" },
  bolha:           { maxWidth:SCREEN_WIDTH*0.75,paddingHorizontal:14,paddingVertical:10,marginHorizontal:2,flexShrink:1,elevation:1,shadowColor:"#000",shadowOpacity:.06,shadowRadius:3 },
  encaminhadaLabel:{ color:"rgba(255,255,255,0.5)",fontSize:10,marginBottom:3,fontStyle:"italic" },
  nomeRemetente:   { color:CORES_SYMBIUS.verdeEscuro,fontSize:11,fontFamily: F.black,marginBottom:3 },
  messageText:     { color:"white",fontSize:15,flexShrink:1,flexWrap:"wrap",lineHeight:21 },
  rodape:          { flexDirection:"row",justifyContent:"flex-end",alignItems:"center",marginTop:4 },
  hora:            { color:"rgba(255,255,255,0.6)",fontSize:10,textAlign:"right" },
  editadaLabel:    { color:"rgba(255,255,255,0.5)",fontSize:10 },

  citacaoBox:   { borderLeftWidth:3,paddingLeft:8,marginBottom:8,borderRadius:4,paddingVertical:4 },
  citacaoMe:    { borderLeftColor:"rgba(255,255,255,0.7)",backgroundColor:"rgba(0,0,0,0.12)" },
  citacaoOther: { borderLeftColor:CORES_SYMBIUS.verdeEscuro,backgroundColor:"rgba(31,61,43,0.10)" },
  citacaoNome:  { color:"rgba(255,255,255,0.85)",fontSize:11,fontFamily: F.black,marginBottom:1 },
  citacaoTexto: { color:"rgba(255,255,255,0.65)",fontSize:12 },

  citandoBar:   { flexDirection:"row",alignItems:"center",paddingHorizontal:14,paddingVertical:10,borderTopWidth:2 },
  citandoInfo:  { flex:1 },
  citandoNome:  { fontSize:12,fontFamily: F.black },
  citandoTexto: { fontSize:12 },
  citandoFechar:{ fontSize:18,paddingLeft:10 },

  inputArea:  { flexDirection:"row",alignItems:"center",paddingHorizontal:12,paddingTop:10,paddingBottom:Platform.OS==="ios"?32:14,borderTopWidth:1,gap:8 },
  imgButton:  { width:42,height:42,justifyContent:"center",alignItems:"center",borderRadius:21,borderWidth:1 },
  input:      { flex:1,borderRadius:22,paddingHorizontal:16,paddingTop:10,paddingBottom:10,maxHeight:100,fontSize:15,borderWidth:1 },
  sendButton: { width:42,height:42,borderRadius:21,justifyContent:"center",alignItems:"center",elevation:3,shadowColor:CORES_SYMBIUS.verdeEscuro,shadowOpacity:.35,shadowRadius:6 },

  overlayFull:     { position:"absolute",top:0,left:0,right:0,bottom:0,backgroundColor:"rgba(0,0,0,0.6)",justifyContent:"center",alignItems:"center",zIndex:999 },
  overlayFullDark: { position:"absolute",top:0,left:0,right:0,bottom:0,backgroundColor:"#000",justifyContent:"center",alignItems:"center",zIndex:999 },

  // Fullscreen toolbar
  fullToolbar:        { position:"absolute",top:0,left:0,right:0,backgroundColor:"rgba(0,0,0,0.7)",paddingTop:Platform.OS==="ios"?50:36,paddingBottom:12,paddingHorizontal:16,zIndex:10 },
  fullToolbarNome:    { color:"#fff",fontSize:15,fontFamily: F.black },
  fullToolbarHora:    { color:"rgba(255,255,255,0.6)",fontSize:12,marginBottom:8 },
  fullToolbarActions: { flexDirection:"row",gap:4 },
  fullToolBtn:        { width:42,height:42,borderRadius:21,justifyContent:"center",alignItems:"center",backgroundColor:"rgba(255,255,255,0.1)" },

  fullImage: { width:SCREEN_WIDTH,height:SCREEN_HEIGHT*0.72 },

  menuCard:     { borderRadius:24,padding:20,width:290,elevation:10 },
  menuTitle:    { fontSize:16,fontFamily: F.black,marginBottom:12,textAlign:"center" },
  menuItem:     { flexDirection:"row",alignItems:"center",paddingVertical:14,borderBottomWidth:1 },
  menuItemIcon: { fontSize:20,marginRight:12 },
  menuItemText: { fontSize:15,fontFamily: F.semibold },

  previewCard:    { borderRadius:24,padding:24,width:340,alignItems:"center",elevation:10 },
  previewTitle:   { fontSize:18,fontFamily: F.black,marginBottom:16 },
  previewImage:   { width:280,height:280,borderRadius:16,marginBottom:20 },
  previewButtons: { flexDirection:"row",gap:15 },
  previewBtn:     { paddingHorizontal:28,paddingVertical:13,borderRadius:25 },
  sendBtn:        { backgroundColor:CORES_SYMBIUS.verdeEscuro },
  cancelBtnText:  { fontFamily: F.bold },
  sendBtnText:    { color:"white",fontFamily: F.bold },

  separadorDataWrap:  { flexDirection:"row",alignItems:"center",marginVertical:16,paddingHorizontal:16 },
  separadorDataLinha: { flex:1,height:1 },
  separadorDataTxt:   { fontSize:11,fontFamily: F.bold,marginHorizontal:10,letterSpacing:.5,paddingHorizontal:8,paddingVertical:3,borderRadius:8 },

  // Subpainel de anexo estilo WhatsApp
  subpainel:    { flexDirection:"row",justifyContent:"space-around",alignItems:"center",paddingVertical:18,paddingHorizontal:24,borderTopWidth:1 },
  subItem:      { alignItems:"center",gap:8 },
  subIconWrap:  { width:58,height:58,borderRadius:29,justifyContent:"center",alignItems:"center",elevation:4,shadowColor:"#000",shadowOpacity:.15,shadowRadius:6 },
  subLabel:     { fontSize:12,fontFamily: F.bold },

  // Vídeo na mensagem (thumbnail)
  videoThumb:   { height:130,borderRadius:12,backgroundColor:"#000",justifyContent:"center",alignItems:"center",gap:6 },
  videoLabel:   { color:"rgba(255,255,255,0.75)",fontSize:11,fontFamily: F.bold },

  // Documento na mensagem
  docBolha:     { flexDirection:"row",alignItems:"center",gap:10,paddingVertical:6,borderTopWidth:1,marginTop:4 },
  docBolhaNome: { color:"#fff",fontSize:13,fontFamily: F.bold,flex:1 },
  docBolhaTipo: { color:"rgba(255,255,255,0.55)",fontSize:10,marginTop:2 },

  // Preview documento no modal
  docPreviewBox:{ alignItems:"center",gap:8,padding:20,borderRadius:16,borderWidth:1,marginBottom:20,width:260 },
  docNome:      { fontSize:14,fontFamily: F.bold,textAlign:"center" },
  docTamanho:   { fontSize:11,fontFamily: F.semibold },

  // Finalizar match
  avisoSilenciado:    { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 6 },
  avisoSilenciadoTxt: { fontSize: 11.5, fontFamily: F.semibold },
  finalizarBtn: { width: 38, height: 38, borderRadius: 19, justifyContent: "center", alignItems: "center" },
});

// ══════════════════════════════════════════════════════════
// ESTILOS — Avaliação / Toast XP / Level-up (gamificação)
// ══════════════════════════════════════════════════════════
const avaliacaoStyles = StyleSheet.create({
  // Modal de avaliação
  backdrop: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 999, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "center", alignItems: "center", padding: 28 },
  card: { width: "100%", maxWidth: 340, borderRadius: 24, padding: 26, alignItems: "center", elevation: 20, shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 16 },
  titulo: { fontSize: 17, textAlign: "center", marginBottom: 4 },
  subtitulo: { fontSize: 12, textAlign: "center", marginBottom: 18 },
  estrelasRow: { flexDirection: "row", marginBottom: 8 },
  comentarioInput: { width: "100%", borderWidth: 1, borderRadius: 12, padding: 12, minHeight: 60, fontSize: 13, marginTop: 10, marginBottom: 4, textAlignVertical: "top" },
  btnConfirmar: { width: "100%", paddingVertical: 14, borderRadius: 14, alignItems: "center" },
  btnConfirmarTxt: { color: "#fff", fontFamily: F.black, fontSize: 15 },
  btnCancelar: { marginTop: 14, fontSize: 13, fontFamily: F.semibold },

  // Toast de XP
  toastOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 999, justifyContent: "flex-end", alignItems: "center", paddingBottom: Platform.OS === "ios" ? 44 : 32 },
  toastCard: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingVertical: 14, borderRadius: 20, minWidth: 240, elevation: 16, shadowColor: "#000", shadowOpacity: 0.18, shadowRadius: 12 },
  toastTitulo: { fontSize: 13, marginBottom: 1 },
  toastSubtitulo: { fontSize: 12 },

  // Modal de level-up
  levelUpBackdrop: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 999, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "center", alignItems: "center", padding: 32 },
  levelUpCard: { width: "100%", borderRadius: 24, overflow: "hidden", elevation: 24, shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 20 },
  levelUpHeader: { alignItems: "center", paddingVertical: 32, paddingHorizontal: 20, gap: 4 },
  levelUpLabel: { fontFamily: F.black, fontSize: 13, color: "#FFC82C", letterSpacing: 1.5, marginBottom: 8 },
  levelUpBody: { padding: 24, alignItems: "center", gap: 10 },
  levelUpNivel: { fontSize: 22, textAlign: "center" },
  levelUpConceito: { fontSize: 13, textAlign: "center", lineHeight: 19, opacity: 0.85 },
  levelUpBtn: { marginTop: 8, paddingHorizontal: 32, paddingVertical: 14, borderRadius: 14, width: "100%", alignItems: "center", backgroundColor: CORES_SYMBIUS.verdeEscuro },
  levelUpBtnTxt: { fontFamily: F.bold, fontSize: 15, color: CORES_SYMBIUS.fundo },
});