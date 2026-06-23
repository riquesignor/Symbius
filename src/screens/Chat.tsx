import React, { useEffect, useRef, useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  Platform, StyleSheet, Image, ActivityIndicator,
  Dimensions, KeyboardAvoidingView, Alert, Vibration
} from "react-native";
import { db } from "../config/firebaseConfig";
import {
  collection, addDoc, query, where,
  orderBy, serverTimestamp, setDoc, updateDoc,
  doc as firestoreDoc, getDoc, deleteDoc, onSnapshot
} from "firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import { useAppSettings } from '../contexts/AppSettingsContext';
import { useNotificacao } from '../contexts/NotificacaoProvider';

// ── Fonte Poppins ──
const F = {
  regular:  'Poppins_400Regular',
  medium:   'Poppins_500Medium',
  semibold: 'Poppins_600SemiBold',
  bold:     'Poppins_700Bold',
  black:    'Poppins_800ExtraBold',
};

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const IMG_MAX = 220;
const IMG_MIN = 80;

// ── Cria ou busca conversa ─────────────────────────────────
const getOrCreateConversa = async (uid1: string, uid2: string): Promise<string> => {
  const conversaId = [uid1, uid2].sort().join("_");
  const docRef = firestoreDoc(db, "conversas", conversaId);
  const snap = await getDoc(docRef);
  if (!snap.exists()) {
    await setDoc(docRef, {
      membros: [uid1, uid2],
      ultimaMensagem: "",
      data_postagem: serverTimestamp(),
      visto: false,
    });
  }
  return conversaId;
};

// ── Estilos globais web (scrollbar, animação digitando) ────
const injectStyles = () => {
  if (Platform.OS !== "web") return;
  const id = "chat-global-style";
  if (document.getElementById(id)) return;
  const style = document.createElement("style");
  style.id = id;
  style.textContent = `
    .chat-scroll::-webkit-scrollbar { width: 0px; background: transparent; }
    .chat-scroll { scrollbar-width: none; -ms-overflow-style: none; }
    html, body, #root { height: 100%; overflow: hidden; }
    @keyframes typingBounce {
      0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
      30% { transform: translateY(-5px); opacity: 1; }
    }
    .typing-dot {
      width: 7px; height: 7px; border-radius: 50%;
      background: rgba(255,255,255,0.7); display: inline-block;
      margin: 0 2px; animation: typingBounce 1.2s infinite ease-in-out;
    }
    .typing-dot:nth-child(2) { animation-delay: 0.2s; }
    .typing-dot:nth-child(3) { animation-delay: 0.4s; }
  `;
  document.head.appendChild(style);
};

// ── Comprime imagem no web ─────────────────────────────────
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
        if (!ctx) { reject("Canvas não suportado"); return; }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality).split(",")[1]);
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

// ── Dimensões de imagem web ────────────────────────────────
const getDimensoesWeb = (base64: string): Promise<{ w: number; h: number }> =>
  new Promise((resolve) => {
    const src = base64.startsWith("data:") ? base64 : `data:image/jpeg;base64,${base64}`;
    const img = document.createElement("img");
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => resolve({ w: 200, h: 200 });
    img.src = src;
  });

const calcDimensoes = (w: number, h: number) => {
  if (w === 0 || h === 0) return { width: IMG_MAX, height: IMG_MAX };
  const ratio = h / w;
  const width = IMG_MAX;
  const height = Math.max(IMG_MIN, Math.min(Math.round(IMG_MAX * 1.4), Math.round(width * ratio)));
  return { width, height };
};

// ── Formatadores ───────────────────────────────────────────
const formatarHora = (data: any): string => {
  if (!data) return "";
  const date = data?.toDate ? data.toDate() : new Date(data);
  return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
};

const formatarDataSeparador = (data: any): string => {
  if (!data) return "";
  const date = data?.toDate ? data.toDate() : new Date(data);
  const hoje = new Date();
  const ontem = new Date();
  ontem.setDate(hoje.getDate() - 1);
  const mesmoDia = (a: Date, b: Date) =>
    a.getDate() === b.getDate() &&
    a.getMonth() === b.getMonth() &&
    a.getFullYear() === b.getFullYear();
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

// ── Componente: imagem na mensagem ─────────────────────────
const ImagemMensagem = ({ base64, onPress }: { base64: string; onPress: () => void }) => {
  const [dims, setDims] = useState<{ width: number; height: number } | null>(null);
  const src = base64.startsWith("data:") ? base64 : `data:image/jpeg;base64,${base64}`;

  useEffect(() => {
    if (Platform.OS === "web") {
      getDimensoesWeb(base64).then(({ w, h }) => setDims(calcDimensoes(w, h)));
    } else {
      Image.getSize(src, (w, h) => setDims(calcDimensoes(w, h)), () => setDims({ width: 200, height: 200 }));
    }
  }, [base64]);

  if (!dims) {
    return (
      <View style={{ width: 120, height: 120, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator color="white" />
      </View>
    );
  }

  if (Platform.OS === "web") {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
        {/* @ts-ignore */}
        <img src={src} style={{ width: dims.width, height: dims.height, objectFit: "cover", borderRadius: 12, display: "block", cursor: "pointer" }} />
      </TouchableOpacity>
    );
  }
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
      <Image source={{ uri: src }} style={{ width: dims.width, height: dims.height, borderRadius: 12 }} resizeMode="cover" />
    </TouchableOpacity>
  );
};

// ── Componente: bolinhas "digitando" no mobile ─────────────
const TypingDotsNative = () => {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setPhase(p => (p + 1) % 3), 400);
    return () => clearInterval(t);
  }, []);
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
      {[0, 1, 2].map(i => (
        <View
          key={i}
          style={{
            width: 7, height: 7, borderRadius: 4,
            backgroundColor: "rgba(255,255,255,0.7)",
            opacity: phase === i ? 1 : 0.35,
            transform: [{ translateY: phase === i ? -4 : 0 }],
          }}
        />
      ))}
    </View>
  );
};

// ══════════════════════════════════════════════════════════
// CHAT PRINCIPAL
// ══════════════════════════════════════════════════════════
export default function Chat({ route, navigation }: any) {
  const insets = useSafeAreaInsets();
  const { outroUid, outroNome } = route.params || {};

  // ✅ ADICIONAR: pegar settings de notificação, cores e escala de fonte
  const { notifGeral, somNotif, vibracao, cores: C, fonteScale, modoEscuro } = useAppSettings();
  const fs = (size: number) => size * fonteScale;

  // ✅ Avisa o provider global qual conversa está aberta (pra ele NÃO
  // disparar notificação de uma conversa que o usuário já está vendo)
  const { setConversaAtiva } = useNotificacao();

  const scrollRef        = useRef<ScrollView>(null);
  const fileInputRef     = useRef<HTMLInputElement | null>(null);
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
  const [previewVisible,   setPreviewVisible]    = useState(false);
  const [previewImage,     setPreviewImage]      = useState<string | null>(null);
  const [previewBase64,    setPreviewBase64]     = useState<string | null>(null);
  const [fullImageVisible, setFullImageVisible]  = useState(false);
  const [fullImageUrl,     setFullImageUrl]      = useState<string | null>(null);
  const [menuMsg,          setMenuMsg]           = useState<any | null>(null);
  const [editandoId,       setEditandoId]        = useState<string | null>(null);
  const [citando,          setCitando]           = useState<any | null>(null);
  const [outraFoto,        setOutraFoto]         = useState<string | null>(null);
  const [onlineStatus,     setOnlineStatus]      = useState(false);
  const [outroDigitando,   setOutroDigitando]    = useState(false);

  // ── Injeta CSS global (web) ──────────────────────────────
  useEffect(() => { injectStyles(); }, []);

  // ── Input file para imagem (web) ─────────────────────────
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const input = document.createElement("input");
    input.type = "file"; input.accept = "image/*"; input.style.display = "none";
    input.onchange = async (e: any) => {
      const file = e.target?.files?.[0];
      if (!file) return;
      setUploading(true);
      try {
        const base64 = await comprimirImagemWeb(file);
        setPreviewImage(`data:image/jpeg;base64,${base64}`);
        setPreviewBase64(base64);
        setPreviewVisible(true);
      } catch {
        Alert.alert("Erro", "Não foi possível processar a imagem.");
      } finally { setUploading(false); input.value = ""; }
    };
    document.body.appendChild(input);
    fileInputRef.current = input;
    return () => { document.body.removeChild(input); };
  }, []);

  // ── Carrega UID do AsyncStorage ──────────────────────────
  useEffect(() => {
    AsyncStorage.getItem("uid")
      .then(uid => { if (uid) setUidAtual(uid); else setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  // ── Carrega perfil do usuário atual ──────────────────────
  useEffect(() => {
    if (!uidAtual) return;
    getDoc(firestoreDoc(db, "usuarios", uidAtual)).then(snap => {
      if (snap.exists()) {
        setMeuNome(snap.data().nome_completo || "Usuário");
        setMinhaFoto(snap.data().foto || null);
      }
    }).catch(e => console.log("Erro perfil:", e.message));
  }, [uidAtual]);

  // ── Limpa "digitandoEm" ao sair do chat ──────────────────
  // (online/offline é gerenciado globalmente pelo NotificacaoProvider)
  useEffect(() => {
    if (!uidAtual) return;
    return () => {
      setDoc(firestoreDoc(db, "usuarios", uidAtual), { digitandoEm: null }, { merge: true });
    };
  }, [uidAtual]);

  // ── Ouve status online e "digitando" do outro ────────────
  useEffect(() => {
    if (!outroUid) return;
    getDoc(firestoreDoc(db, "usuarios", outroUid)).then(snap => {
      if (snap.exists()) setOutraFoto(snap.data().foto || null);
    });
    const unsub = onSnapshot(firestoreDoc(db, "usuarios", outroUid), (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        // ✅ Só mostra "online" se a pessoa PERMITE (statusOnline !== false).
        // Se ela desativou nas Configurações, aparece sempre offline.
        setOnlineStatus(d.online === true && d.statusOnline !== false);
        setOutroDigitando(!!d.digitandoEm);
      }
    });
    return () => unsub();
  }, [outroUid]);

  // ── Cria/busca conversaId ────────────────────────────────
  useEffect(() => {
    if (!uidAtual || !outroUid) { setLoading(false); return; }
    getOrCreateConversa(uidAtual, outroUid)
      .then(id => setConversaId(id))
      .catch(e => { console.log("Erro conversa:", e.message); setLoading(false); });
  }, [uidAtual, outroUid]);

  // ── Marca conversa como "ativa" (provider não notifica dela) ──
  useEffect(() => {
    if (!conversaId) return;
    setConversaAtiva(conversaId);
    return () => setConversaAtiva(null);
  }, [conversaId]);

  // ── Abrir perfil público da pessoa (toque no header) ─────
  const abrirPerfilDoOutro = () => {
    if (!outroUid) return;
    navigation.navigate('PerfilPublico', { uid: outroUid, meuUid: uidAtual });
  };

  // ── Listener de mensagens em tempo real (onSnapshot) ─────
  // Funciona em web, iOS e Android sem nenhum servidor externo.
  useEffect(() => {
    if (!conversaId) return;
    setLoading(true);

    const q = query(
      collection(db, "mensagens"),
      where("conversaId", "==", conversaId),
      orderBy("data_postagem", "asc")
    );

    const unsub = onSnapshot(q, async (snapshot) => {
      const msgs = snapshot.docs.map(d => {
        docIdMap.current[d.id] = d.id;
        return { docId: d.id, id: d.id, ...d.data() };
      });
      setMessages(msgs);
      // 🔔 Notificações de mensagem agora são tratadas globalmente
      // pelo NotificacaoProvider (funciona em qualquer tela, sem duplicar).
      setLoading(false);
    }, (e) => {
      console.log("Erro onSnapshot mensagens:", e.message);
      setLoading(false);
    });

    return () => unsub();
  }, [conversaId, uidAtual]);

  // ── Scroll para o fim ao chegar nova mensagem ────────────
  useEffect(() => {
    if (messages.length > 0)
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
  }, [messages.length, outroDigitando]);

  // ── Gerencia estado "digitando" no Firestore ─────────────
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

  // ── Envia mensagem de texto ───────────────────────────────
  const sendMessage = async () => {
    if (!inputText.trim() || !uidAtual || !conversaId || !outroUid) return;
    const msgTexto = inputText.trim();
    setInputText("");
    clearTyping();

    // Modo edição
    if (editandoId) {
      const docId = resolverDocId({ docId: editandoId, id: editandoId });
      setEditandoId(null);
      try {
        await updateDoc(firestoreDoc(db, "mensagens", docId), { mensagem: msgTexto, editada: true });
      } catch (e: any) { console.log("❌ Edit:", e.message); }
      return;
    }

    const tempId = `temp_${Date.now()}`;
    const novaMsgPayload: any = {
      conversaId, mensagem: msgTexto, tipo: "texto",
      remetenteUid: uidAtual, nome_remetente: meuNome,
      foto: minhaFoto || null, data_postagem: serverTimestamp(),
    };

    if (citando) {
      novaMsgPayload.citacao = {
        id: resolverDocId(citando),
        mensagem: citando.tipo === "imagem" ? "📷 Imagem" : citando.mensagem,
        nome: citando.nome_remetente, tipo: citando.tipo,
      };
      setCitando(null);
    }

    // Mensagem otimista: aparece imediatamente para quem enviou
    setMessages(prev => [...prev, {
      ...novaMsgPayload,
      docId: tempId, id: tempId,
      data_postagem: { toDate: () => new Date() },
    }]);

    try {
      const ref = await addDoc(collection(db, "mensagens"), novaMsgPayload);
      docIdMap.current[ref.id] = ref.id;
      // Remove o placeholder quando o onSnapshot traz a mensagem real
      setMessages(prev => prev.filter(m => m.docId !== tempId));

      await setDoc(firestoreDoc(db, "conversas", conversaId), {
        ultimaMensagem: msgTexto, data_postagem: serverTimestamp(),
        quemEnviou: uidAtual, visto: false,
        dadosMembros: {
          [uidAtual]: { nome: meuNome, foto: minhaFoto || null },
          [outroUid]:  { nome: outroNome || "Usuário", foto: null },
        },
      }, { merge: true });
    } catch (e: any) {
      console.log("❌ Firestore:", e.message);
      setMessages(prev => prev.filter(m => m.docId !== tempId));
      Alert.alert("Erro", "Não foi possível enviar a mensagem.");
    }
  };

  // ── Envia imagem ──────────────────────────────────────────
  const confirmarEnvio = async () => {
    if (!previewBase64 || !uidAtual || !conversaId || !outroUid) return;
    setPreviewVisible(false);
    setUploading(true);
    clearTyping();

    const tempId = `temp_img_${Date.now()}`;
    const novaMsgPayload: any = {
      conversaId, mensagem: previewBase64, tipo: "imagem",
      remetenteUid: uidAtual, nome_remetente: meuNome,
      foto: minhaFoto || null, data_postagem: serverTimestamp(),
    };

    if (citando) {
      novaMsgPayload.citacao = {
        id: resolverDocId(citando),
        mensagem: citando.tipo === "imagem" ? "📷 Imagem" : citando.mensagem,
        nome: citando.nome_remetente, tipo: citando.tipo,
      };
      setCitando(null);
    }

    // Otimista
    setMessages(prev => [...prev, {
      ...novaMsgPayload,
      docId: tempId, id: tempId,
      data_postagem: { toDate: () => new Date() },
    }]);

    try {
      const ref = await addDoc(collection(db, "mensagens"), novaMsgPayload);
      docIdMap.current[ref.id] = ref.id;
      setMessages(prev => prev.filter(m => m.docId !== tempId));

      await setDoc(firestoreDoc(db, "conversas", conversaId), {
        ultimaMensagem: "📷 Imagem", data_postagem: serverTimestamp(),
        quemEnviou: uidAtual, visto: false,
        dadosMembros: {
          [uidAtual]: { nome: meuNome, foto: minhaFoto || null },
          [outroUid]:  { nome: outroNome || "Usuário", foto: null },
        },
      }, { merge: true });
    } catch {
      setMessages(prev => prev.filter(m => m.docId !== tempId));
      Alert.alert("Erro", "Não foi possível enviar a imagem.");
    } finally {
      setUploading(false);
      setPreviewBase64(null);
      setPreviewImage(null);
    }
  };

  // ── Apaga mensagem ────────────────────────────────────────
  const apagarMensagem = async (msg: any) => {
    setMenuMsg(null);
    const localId   = msg.docId || msg.id;
    const realDocId = docIdMap.current[localId] || localId;

    // Remove localmente de imediato
    setMessages(prev => prev.filter(m =>
      m.docId !== localId && m.id !== localId &&
      m.docId !== realDocId && m.id !== realDocId
    ));

    try {
      await deleteDoc(firestoreDoc(db, "mensagens", realDocId));
      if (conversaId) {
        const msgsRestantes = messages.filter(m =>
          m.docId !== localId && m.id !== localId &&
          m.docId !== realDocId && m.id !== realDocId
        );
        const ultima = msgsRestantes[msgsRestantes.length - 1];
        await setDoc(firestoreDoc(db, "conversas", conversaId), {
          ultimaMensagem: ultima ? (ultima.tipo === "imagem" ? "📷 Imagem" : ultima.mensagem) : "",
          data_postagem:  ultima?.data_postagem || serverTimestamp(),
        }, { merge: true });
      }
    } catch (e: any) { console.log("❌ Delete:", e.message); }
  };

  const iniciarEdicao = (msg: any) => {
    setMenuMsg(null);
    setEditandoId(resolverDocId(msg));
    setInputText(msg.mensagem);
  };

  const cancelarPreview = () => {
    setPreviewVisible(false);
    setPreviewImage(null);
    setPreviewBase64(null);
  };

  const abrirImagemFull = (b64: string) => {
    setFullImageUrl(b64.startsWith("data:") ? b64 : `data:image/jpeg;base64,${b64}`);
    setFullImageVisible(true);
  };

  // ── Loading ───────────────────────────────────────────────
  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0f0f1a" }}>
        <ActivityIndicator size="large" color="#E91E63" />
      </View>
    );
  }

  // ══════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════
  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: C.fundo }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      {/* ── HEADER ── */}
      <View style={[styles.header, { paddingTop: insets.top + 10, backgroundColor: C.branco, borderBottomColor: C.cinzaClaro }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backBtn, { backgroundColor: C.cinzaClaro }]}>
          <Ionicons name="arrow-back" size={22} color={C.azulEscuro} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.headerCenter} onPress={abrirPerfilDoOutro} activeOpacity={0.7}>
          <View style={styles.headerAvatarWrap}>
            <Image
              source={{ uri: outraFoto
                ? (outraFoto.startsWith("data:") || outraFoto.startsWith("http")
                    ? outraFoto : `data:image/jpeg;base64,${outraFoto}`)
                : "https://cdn-icons-png.flaticon.com/512/149/149071.png"
              }}
              style={styles.headerAvatar}
            />
            <View style={[styles.headerOnlineDot, { backgroundColor: onlineStatus ? "#22C55E" : "#94A3B8", borderColor: C.branco }]} />
          </View>
          <View>
            <Text style={[styles.headerTitle, { color: C.azulEscuro, fontFamily: F.black }]}>{outroNome || "Chat"}</Text>
            {outroDigitando
              ? <Text style={[styles.headerSub, { color: "#E91E63" }]}>digitando...</Text>
              : <Text style={[styles.headerSub, { color: onlineStatus ? "#22C55E" : "#94A3B8" }]}>
                  {onlineStatus ? "online" : "offline"}
                </Text>
            }
          </View>
        </TouchableOpacity>

        <View style={{ width: 40 }} />
      </View>

      {/* ── LISTA DE MENSAGENS ── */}
      <ScrollView
        ref={scrollRef}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
        // @ts-ignore
        dataSet={{ class: "chat-scroll" }}
      >
        {messages.map((item, index) => {
          const isMe              = item.remetenteUid === uidAtual;
          const proxMsg           = messages[index + 1];
          const ultimaDaSequencia = proxMsg?.remetenteUid !== item.remetenteUid || !proxMsg;

          const chaveAtual    = getDataChave(item.data_postagem);
          const chaveAnterior = index > 0 ? getDataChave(messages[index - 1].data_postagem) : null;
          const mostrarSep    = chaveAtual !== chaveAnterior;

          return (
            <React.Fragment key={item.docId || item.id || String(index)}>
              {mostrarSep && (
                <View style={styles.separadorDataWrap}>
                  <View style={styles.separadorDataLinha} />
                  <Text style={styles.separadorDataTxt}>
                    {formatarDataSeparador(item.data_postagem)}
                  </Text>
                  <View style={styles.separadorDataLinha} />
                </View>
              )}

              <TouchableOpacity
                activeOpacity={0.8}
                onLongPress={() => setMenuMsg(item)}
                style={[styles.messageRow, isMe ? styles.messageRowMe : styles.messageRowOther]}
              >
                {!isMe && (
                  <View style={styles.avatarSlot}>
                    {ultimaDaSequencia
                      ? <Image source={{ uri: getImageUri(item.foto) }} style={styles.avatar} />
                      : <View style={styles.avatarEspaco} />}
                  </View>
                )}

                <View style={[styles.bolha, isMe ? styles.bolhaMe : styles.bolhaOther]}>
                  {!isMe && ultimaDaSequencia && (
                    <Text style={styles.nomeRemetente}>{item.nome_remetente}</Text>
                  )}
                  {item.citacao && (
                    <View style={[styles.citacaoBox, isMe ? styles.citacaoMe : styles.citacaoOther]}>
                      <Text style={styles.citacaoNome}>{item.citacao.nome}</Text>
                      <Text style={styles.citacaoTexto} numberOfLines={2}>{item.citacao.mensagem}</Text>
                    </View>
                  )}
                  {(() => {
                    // Detecta imagem pelo tipo OU pelo conteúdo (fallback p/ msgs antigas sem tipo)
                    const pareceBase64 = typeof item.mensagem === "string"
                      && item.mensagem.length > 500
                      && !/\s/.test(item.mensagem.substring(0, 100));
                    const isImagem = item.tipo === "imagem" || pareceBase64;

                    return isImagem ? (
                      <>
                        <ImagemMensagem base64={item.mensagem} onPress={() => abrirImagemFull(item.mensagem)} />
                        <Text style={styles.hora}>{formatarHora(item.data_postagem)}</Text>
                      </>
                    ) : (
                      <>
                        <Text style={styles.messageText}>{item.mensagem}</Text>
                        <View style={styles.rodape}>
                          {item.editada && <Text style={styles.editadaLabel}>editada · </Text>}
                          <Text style={styles.hora}>{formatarHora(item.data_postagem)}</Text>
                        </View>
                      </>
                    );
                  })()}
                </View>

                {/* Avatar próprio removido — nenhum app de referência exibe o seu avatar no chat */}
              </TouchableOpacity>
            </React.Fragment>
          );
        })}

        {/* Bolha "digitando..." */}
        {outroDigitando && (
          <View style={[styles.messageRow, styles.messageRowOther]}>
            <View style={styles.avatarSlot}>
              <Image
                source={{ uri: outraFoto
                  ? (outraFoto.startsWith("data:") || outraFoto.startsWith("http")
                      ? outraFoto : `data:image/jpeg;base64,${outraFoto}`)
                  : "https://cdn-icons-png.flaticon.com/512/149/149071.png"
                }}
                style={styles.avatar}
              />
            </View>
            <View style={[styles.bolha, styles.bolhaOther, styles.bolhaDigitando]}>
              {Platform.OS === "web" ? (
                // @ts-ignore
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  {/* @ts-ignore */}
                  <span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" />
                </div>
              ) : (
                <TypingDotsNative />
              )}
            </View>
          </View>
        )}
      </ScrollView>

      {/* ── BARRA DE CITAÇÃO / EDIÇÃO ── */}
      {(citando || editandoId) && (
        <View style={[styles.citandoBar, { backgroundColor: C.branco }]}>
          <View style={styles.citandoInfo}>
            {citando
              ? <>
                  <Text style={styles.citandoNome}>{citando.nome_remetente}</Text>
                  <Text style={[styles.citandoTexto, { color: C.textoSec }]} numberOfLines={1}>
                    {citando.tipo === "imagem" ? "📷 Imagem" : citando.mensagem}
                  </Text>
                </>
              : <Text style={styles.citandoNome}>✏️ Editando mensagem</Text>
            }
          </View>
          <TouchableOpacity onPress={() => { setCitando(null); setEditandoId(null); setInputText(""); clearTyping(); }}>
            <Text style={styles.citandoFechar}>✕</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── INPUT ── */}
      <View style={[styles.inputArea, { backgroundColor: C.branco, borderTopColor: C.cinzaClaro }]}>
        <TouchableOpacity
          onPress={() => fileInputRef.current?.click()}
          style={[styles.imgButton, { backgroundColor: C.cinzaClaro, borderColor: C.cinzaClaro }]}
          disabled={uploading}
        >
          {uploading
            ? <ActivityIndicator size="small" color="#E91E63" />
            : <Ionicons name="image-outline" size={22} color={C.azulEscuro} />
          }
        </TouchableOpacity>
        <TextInput
          value={inputText}
          onChangeText={handleTyping}
          style={[styles.input, { backgroundColor: C.cinzaClaro, color: C.azulEscuro, borderColor: C.cinzaClaro }]}
          placeholder="Digite aqui..."
          placeholderTextColor={C.textoSec}
          multiline
        />
        <TouchableOpacity onPress={sendMessage} style={styles.sendButton}>
          <Ionicons name="send" size={18} color="white" />
        </TouchableOpacity>
      </View>

      {/* ── MENU CONTEXTO ── */}
      {menuMsg && (
        <View style={styles.overlayFull}>
          <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={() => setMenuMsg(null)} />
          <View style={[styles.menuCard, { backgroundColor: C.branco }]}>
            <Text style={[styles.menuTitle, { color: C.azulEscuro, fontFamily: F.black }]}>Opções</Text>
            <TouchableOpacity style={[styles.menuItem, { borderBottomColor: C.cinzaClaro }]} onPress={() => { setCitando(menuMsg); setMenuMsg(null); }}>
              <Text style={styles.menuItemIcon}>↩️</Text>
              <Text style={[styles.menuItemText, { color: C.azulEscuro, fontFamily: F.semibold }]}>Responder</Text>
            </TouchableOpacity>
            {menuMsg.remetenteUid === uidAtual && menuMsg.tipo !== "imagem" && (
              <TouchableOpacity style={[styles.menuItem, { borderBottomColor: C.cinzaClaro }]} onPress={() => iniciarEdicao(menuMsg)}>
                <Text style={styles.menuItemIcon}>✏️</Text>
                <Text style={[styles.menuItemText, { color: C.azulEscuro, fontFamily: F.semibold }]}>Editar</Text>
              </TouchableOpacity>
            )}
            {menuMsg.remetenteUid === uidAtual && (
              <TouchableOpacity style={styles.menuItem} onPress={() => {
                if (Platform.OS === "web") {
                  if (window.confirm("Apagar mensagem? Essa ação não pode ser desfeita."))
                    apagarMensagem(menuMsg);
                } else {
                  Alert.alert("Apagar mensagem", "Tem certeza?", [
                    { text: "Cancelar", style: "cancel" },
                    { text: "Apagar", style: "destructive", onPress: () => apagarMensagem(menuMsg) },
                  ]);
                }
              }}>
                <Text style={styles.menuItemIcon}>🗑️</Text>
                <Text style={[styles.menuItemText, { color: "#ff4d6d" }]}>Apagar</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.menuItem, { borderBottomWidth: 0, marginTop: 4 }]}
              onPress={() => setMenuMsg(null)}
            >
              <Text style={[styles.menuItemText, { color: C.textoSec, textAlign: "center", width: "100%", fontFamily: F.medium }]}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ── PREVIEW IMAGEM ── */}
      {previewVisible && (
        <View style={styles.overlayFull}>
          <View style={[styles.previewCard, { backgroundColor: C.branco }]}>
            <Text style={[styles.previewTitle, { color: C.azulEscuro, fontFamily: F.black }]}>Pré-visualização</Text>
            {previewImage && (
              Platform.OS === "web"
                // @ts-ignore
                ? <img src={previewImage} style={{ width: 280, height: 280, objectFit: "contain", borderRadius: 12, marginBottom: 20 }} />
                : <Image source={{ uri: previewImage }} style={styles.previewImage} resizeMode="contain" />
            )}
            <View style={styles.previewButtons}>
              <TouchableOpacity style={[styles.previewBtn, styles.cancelBtn, { backgroundColor: C.cinzaClaro }]} onPress={cancelarPreview}>
                <Text style={[styles.cancelBtnText, { color: C.azulEscuro, fontFamily: F.bold }]}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.previewBtn, styles.sendBtn]} onPress={confirmarEnvio}>
                <Text style={styles.sendBtnText}>Enviar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* ── IMAGEM FULLSCREEN ── */}
      {fullImageVisible && (
        <View style={styles.overlayFullDark}>
          <TouchableOpacity style={styles.closeBtn} onPress={() => setFullImageVisible(false)}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
          {fullImageUrl && (
            Platform.OS === "web"
              // @ts-ignore
              ? <img src={fullImageUrl} style={{ maxWidth: "90%", maxHeight: "85%", objectFit: "contain", borderRadius: 8 }} />
              : <Image source={{ uri: fullImageUrl }} style={styles.fullImage} resizeMode="contain" />
          )}
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

// ══════════════════════════════════════════════════════════
// STYLES
// ══════════════════════════════════════════════════════════
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F0F2F5",
    ...(Platform.OS === "web"
      ? { height: "100vh" as any, maxHeight: "100vh" as any, overflow: "hidden" as any }
      : {}),
  },

  // Header
  header:           { backgroundColor: "#FFFFFF", flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: "#EAEFF4", elevation: 2, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 4 },
  backBtn:          { width: 38, height: 38, borderRadius: 19, backgroundColor: "#F0F2F5", justifyContent: "center", alignItems: "center" },
  headerCenter:     { flexDirection: "row", alignItems: "center", gap: 10, flex: 1, paddingLeft: 10 },
  headerAvatarWrap: { position: "relative" },
  headerAvatar:     { width: 42, height: 42, borderRadius: 21, backgroundColor: "#EAEFF4" },
  headerOnlineDot:  { position: "absolute", bottom: 1, right: 1, width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: "#FFFFFF" },
  headerTitle:      { color: "#0B2046", fontSize: 16, fontWeight: "800" },
  headerSub:        { fontSize: 12, fontWeight: "600", marginTop: 1 },

  // Scroll
  scrollView:    { flex: 1 },
  scrollContent: { paddingVertical: 12, paddingHorizontal: 8, flexGrow: 1 },

  // Mensagens
  messageRow:      { flexDirection: "row", alignItems: "flex-end", marginVertical: 2, paddingHorizontal: 4, width: "100%" },
  messageRowMe:    { justifyContent: "flex-end" },
  messageRowOther: { justifyContent: "flex-start" },
  avatarSlot:      { width: 36, alignItems: "center", justifyContent: "flex-end" },
  avatarEspaco:    { width: 32, height: 32 },
  avatar:          { width: 32, height: 32, borderRadius: 16 },
  bolha:           { maxWidth: SCREEN_WIDTH * 0.72, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, marginHorizontal: 4, flexShrink: 1, elevation: 1, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 3 },
  bolhaMe:         { backgroundColor: "#E91E63", borderBottomRightRadius: 4, alignSelf: "flex-end" },
  bolhaOther:      { backgroundColor: "#0B2046", borderBottomLeftRadius: 4, alignSelf: "flex-start" },
  bolhaDigitando:  { paddingHorizontal: 16, paddingVertical: 14 },
  nomeRemetente:   { color: "#E91E63", fontSize: 11, fontWeight: "800", marginBottom: 3 },
  messageText:     { color: "white", fontSize: 15, flexShrink: 1, flexWrap: "wrap", lineHeight: 21 },
  rodape:          { flexDirection: "row", justifyContent: "flex-end", alignItems: "center", marginTop: 4 },
  hora:            { color: "rgba(255,255,255,0.85)", fontSize: 10, textAlign: "right" },
  editadaLabel:    { color: "rgba(255,255,255,0.5)", fontSize: 10 },

  // Citação
  citacaoBox:   { borderLeftWidth: 3, paddingLeft: 8, marginBottom: 8, borderRadius: 4, paddingVertical: 4 },
  citacaoMe:    { borderLeftColor: "rgba(255,255,255,0.7)", backgroundColor: "rgba(0,0,0,0.12)" },
  citacaoOther: { borderLeftColor: "#E91E63", backgroundColor: "rgba(233,30,99,0.12)" },
  citacaoNome:  { color: "rgba(255,255,255,0.85)", fontSize: 11, fontWeight: "800", marginBottom: 1 },
  citacaoTexto: { color: "rgba(255,255,255,0.65)", fontSize: 12 },

  // Barra citando/editando
  citandoBar:   { flexDirection: "row", alignItems: "center", backgroundColor: "#FFFFFF", paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: 2, borderTopColor: "#E91E63" },
  citandoInfo:  { flex: 1 },
  citandoNome:  { color: "#E91E63", fontSize: 12, fontWeight: "800" },
  citandoTexto: { color: "#64748B", fontSize: 12 },
  citandoFechar:{ color: "#64748B", fontSize: 18, paddingLeft: 10 },

  // Input
  inputArea:  { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingTop: 10, paddingBottom: Platform.OS === "ios" ? 32 : 14, backgroundColor: "#FFFFFF", borderTopWidth: 1, borderTopColor: "#EAEFF4", gap: 8 },
  imgButton:  { width: 42, height: 42, justifyContent: "center", alignItems: "center", backgroundColor: "#F0F2F5", borderRadius: 21, borderWidth: 1, borderColor: "#EAEFF4" },
  input:      { flex: 1, backgroundColor: "#F0F2F5", color: "#0B2046", borderRadius: 22, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10, maxHeight: 100, fontSize: 15, borderWidth: 1, borderColor: "#EAEFF4" },
  sendButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: "#E91E63", justifyContent: "center", alignItems: "center", elevation: 3, shadowColor: "#E91E63", shadowOpacity: 0.35, shadowRadius: 6 },

  // Overlays
  overlayFull:     { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center", zIndex: 999 },
  overlayFullDark: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "#000", justifyContent: "center", alignItems: "center", zIndex: 999 },

  // Menu contexto
  menuCard:     { backgroundColor: "#FFFFFF", borderRadius: 24, padding: 20, width: 290, elevation: 10 },
  menuTitle:    { color: "#0B2046", fontSize: 16, fontWeight: "900", marginBottom: 12, textAlign: "center" },
  menuItem:     { flexDirection: "row", alignItems: "center", paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#F0F2F5" },
  menuItemIcon: { fontSize: 20, marginRight: 12 },
  menuItemText: { color: "#0B2046", fontSize: 15, fontWeight: "600" },

  // Preview imagem
  previewCard:    { backgroundColor: "#FFFFFF", borderRadius: 24, padding: 24, width: 340, alignItems: "center", elevation: 10 },
  previewTitle:   { color: "#0B2046", fontSize: 18, fontWeight: "900", marginBottom: 16 },
  previewImage:   { width: 280, height: 280, borderRadius: 16, marginBottom: 20 },
  previewButtons: { flexDirection: "row", gap: 15 },
  previewBtn:     { paddingHorizontal: 28, paddingVertical: 13, borderRadius: 25 },
  cancelBtn:      { backgroundColor: "#F0F2F5" },
  sendBtn:        { backgroundColor: "#E91E63" },
  cancelBtnText:  { color: "#0B2046", fontWeight: "700" },
  sendBtnText:    { color: "white", fontWeight: "700" },

  // Imagem fullscreen
  closeBtn:     { position: "absolute", top: Platform.OS === "ios" ? 50 : 30, right: 20, zIndex: 10, backgroundColor: "rgba(255,255,255,0.25)", width: 40, height: 40, borderRadius: 20, justifyContent: "center", alignItems: "center" },
  closeBtnText: { color: "white", fontSize: 20, fontWeight: "bold" },
  fullImage:    { width: SCREEN_WIDTH, height: SCREEN_HEIGHT * 0.8 },

  // Separador de data
  separadorDataWrap:  { flexDirection: "row", alignItems: "center", marginVertical: 16, paddingHorizontal: 16 },
  separadorDataLinha: { flex: 1, height: 1, backgroundColor: "#DDEAEF" },
  separadorDataTxt:   { color: "#94A3B8", fontSize: 11, fontWeight: "700", marginHorizontal: 10, letterSpacing: 0.5, backgroundColor: "#F0F2F5", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },

  // Finalizar match
  finalizarBtn: { width: 38, height: 38, borderRadius: 19, justifyContent: "center", alignItems: "center" },

  // Toast XP
  toast:     { position: "absolute", bottom: 110, alignSelf: "center", backgroundColor: "#0B2046", paddingHorizontal: 22, paddingVertical: 12, borderRadius: 28, zIndex: 9999, elevation: 12, shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 8 },
  toastText: { color: "white", fontWeight: "800", fontSize: 15, letterSpacing: 0.3 },
});