import React, { useEffect, useRef, useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  Platform, StyleSheet, Image, ActivityIndicator,
  Dimensions, KeyboardAvoidingView, Alert
} from "react-native";
import { db } from "../config/firebaseConfig";
import {
  collection, addDoc, query, where, getDocs,
  orderBy, serverTimestamp, setDoc, updateDoc,
  doc as firestoreDoc, getDoc, deleteDoc
} from "firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const IMG_MAX = 220;
const IMG_MIN = 80;

const getServerIP = () => {
  const hostUri = Constants.expoConfig?.hostUri || (Constants.manifest as any)?.debuggerHost;
  if (hostUri) return hostUri.split(":")[0];
  return "192.168.3.40";
};
const WS_URL = `ws://${getServerIP()}:3001`;

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
  // Largura fixa em IMG_MAX, altura proporcional limitada a 1.4x
  const width  = IMG_MAX;
  const height = Math.max(IMG_MIN, Math.min(Math.round(IMG_MAX * 1.4), Math.round(width * ratio)));
  return { width, height };
};

const formatarHora = (data: any): string => {
  if (!data) return "";
  const date = data?.toDate ? data.toDate() : new Date(data);
  return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
};

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

export default function Chat({ route, navigation }: any) {
  const { outroUid, outroNome } = route.params || {};

  const socketRef    = useRef<WebSocket | null>(null);
  const scrollRef    = useRef<ScrollView>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const docIdMap     = useRef<Record<string, string>>({});

  const [uidAtual,          setUidAtual]         = useState<string | null>(null);
  const [conversaId,        setConversaId]        = useState<string | null>(null);
  const [inputText,         setInputText]         = useState("");
  const [messages,          setMessages]          = useState<any[]>([]);
  const [loading,           setLoading]           = useState(true);
  const [meuNome,           setMeuNome]           = useState("Usuário");
  const [minhaFoto,         setMinhaFoto]         = useState<string | null>(null);
  const [uploading,         setUploading]         = useState(false);
  const [previewVisible,    setPreviewVisible]    = useState(false);
  const [previewImage,      setPreviewImage]      = useState<string | null>(null);
  const [previewBase64,     setPreviewBase64]     = useState<string | null>(null);
  const [fullImageVisible,  setFullImageVisible]  = useState(false);
  const [fullImageUrl,      setFullImageUrl]      = useState<string | null>(null);
  const [menuMsg,           setMenuMsg]           = useState<any | null>(null);
  const [editandoId,        setEditandoId]        = useState<string | null>(null);
  const [citando,           setCitando]           = useState<any | null>(null);

  useEffect(() => { injectStyles(); }, []);

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
      }
    }).catch(e => console.log("Erro perfil:", e.message));
  }, [uidAtual]);

  useEffect(() => {
    if (!uidAtual || !outroUid) { setLoading(false); return; }
    getOrCreateConversa(uidAtual, outroUid)
      .then(id => setConversaId(id))
      .catch(e => { console.log("Erro conversa:", e.message); setLoading(false); });
  }, [uidAtual, outroUid]);

  useEffect(() => {
    if (!conversaId || !meuNome) return;
    let ws: WebSocket;
    const iniciar = async () => {
      try {
        const q = query(
          collection(db, "mensagens"),
          where("conversaId", "==", conversaId),
          orderBy("data_postagem", "asc")
        );
        const snapshot = await getDocs(q);
        const msgs = snapshot.docs.map(d => {
          docIdMap.current[d.id] = d.id;
          return { docId: d.id, id: d.id, ...d.data() };
        });
        setMessages(msgs);
      } catch (e: any) { console.log("Erro histórico:", e.message); }
      finally { setLoading(false); }

      ws = new WebSocket(WS_URL);
      socketRef.current = ws;
      ws.onopen  = () => ws.send(JSON.stringify({ type: "join", room: conversaId, user: meuNome }));
      ws.onerror = (e: any) => console.log("❌ WS:", e.message);
      ws.onclose = () => console.log("WS fechado.");
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "message" && data.remetenteUid !== uidAtual)
            setMessages(prev => [...prev, { ...data, docId: data.docId || data.id }]);
          if (data.type === "edit")
            setMessages(prev => prev.map(m =>
              m.docId === data.docId ? { ...m, mensagem: data.mensagem, editada: true } : m
            ));
          if (data.type === "delete")
            setMessages(prev => prev.filter(m => m.docId !== data.docId));
        } catch { }
      };
    };
    iniciar();
    return () => ws?.close();
  }, [conversaId, meuNome]);

  useEffect(() => {
    if (messages.length > 0)
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
  }, [messages.length]);

  const resolverDocId = (msg: any): string => {
    return docIdMap.current[msg.id] || docIdMap.current[msg.docId] || msg.docId || msg.id;
  };

  const sendMessage = async () => {
    if (!inputText.trim() || !uidAtual || !conversaId || !outroUid) return;
    const msgTexto = inputText.trim();
    setInputText("");

    if (editandoId) {
      const docId = resolverDocId({ docId: editandoId, id: editandoId });
      setEditandoId(null);
      setMessages(prev => prev.map(m => m.docId === docId ? { ...m, mensagem: msgTexto, editada: true } : m));
      if (socketRef.current?.readyState === WebSocket.OPEN)
        socketRef.current.send(JSON.stringify({ type: "edit", docId, mensagem: msgTexto }));
      try { await updateDoc(firestoreDoc(db, "mensagens", docId), { mensagem: msgTexto, editada: true }); }
      catch (e: any) { console.log("❌ Edit:", e.message); }
      return;
    }

    const localId = String(Date.now());
    const nova: any = {
      id: localId, docId: localId, conversaId, mensagem: msgTexto,
      remetenteUid: uidAtual, nome_remetente: meuNome,
      foto: minhaFoto || null, tipo: "texto",
      data_postagem: new Date().toISOString(),
    };
    if (citando) {
      nova.citacao = {
        id: resolverDocId(citando),
        mensagem: citando.tipo === "imagem" ? "📷 Imagem" : citando.mensagem,
        nome: citando.nome_remetente, tipo: citando.tipo,
      };
      setCitando(null);
    }
    setMessages(prev => [...prev, nova]);
    if (socketRef.current?.readyState === WebSocket.OPEN)
      socketRef.current.send(JSON.stringify({ type: "message", ...nova }));
    try {
      const ref = await addDoc(collection(db, "mensagens"), {
        conversaId, mensagem: msgTexto, tipo: "texto",
        remetenteUid: uidAtual, nome_remetente: meuNome,
        foto: minhaFoto || null, data_postagem: serverTimestamp(),
        ...(nova.citacao ? { citacao: nova.citacao } : {}),
      });
      docIdMap.current[localId] = ref.id;
      setMessages(prev => prev.map(m => m.id === localId ? { ...m, docId: ref.id } : m));
      await setDoc(firestoreDoc(db, "conversas", conversaId), {
        ultimaMensagem: msgTexto, data_postagem: serverTimestamp(),
        quemEnviou: uidAtual, visto: false,
        dadosMembros: {
          [uidAtual]: { nome: meuNome, foto: minhaFoto || null },
          [outroUid]:  { nome: outroNome || "Usuário", foto: null },
        },
      }, { merge: true });
    } catch (e: any) { console.log("❌ Firestore:", e.message); }
  };

  const apagarMensagem = async (msg: any) => {
    setMenuMsg(null);

    // Resolve o docId real — prioriza o mapa de ids
    const localId = msg.docId || msg.id;
    const realDocId = docIdMap.current[localId] || localId;

    // Remove da UI usando todas as formas possíveis de identificação
    setMessages(prev => prev.filter(m =>
      m.docId !== localId && m.id !== localId &&
      m.docId !== realDocId && m.id !== realDocId
    ));

    // Avisa outros via WebSocket com o id real
    if (socketRef.current?.readyState === WebSocket.OPEN)
      socketRef.current.send(JSON.stringify({ type: "delete", docId: realDocId }));

    // Deleta no Firestore
    try {
      await deleteDoc(firestoreDoc(db, "mensagens", realDocId));

      // ✅ Atualiza ultimaMensagem da conversa com a mensagem anterior
      // para que o Homechat não mostre a mensagem apagada
      if (conversaId) {
        const msgsRestantes = [...messages].filter(m =>
          m.docId !== localId && m.id !== localId &&
          m.docId !== realDocId && m.id !== realDocId
        );
        const ultimaRestante = msgsRestantes[msgsRestantes.length - 1];
        await setDoc(firestoreDoc(db, "conversas", conversaId), {
          ultimaMensagem: ultimaRestante
            ? (ultimaRestante.tipo === "imagem" ? "📷 Imagem" : ultimaRestante.mensagem)
            : "",
          data_postagem: ultimaRestante?.data_postagem || serverTimestamp(),
        }, { merge: true });
      }
    } catch (e: any) {
      console.log("❌ Delete Firestore:", e.message);
    }
  };

  const iniciarEdicao = (msg: any) => {
    setMenuMsg(null);
    setEditandoId(resolverDocId(msg));
    setInputText(msg.mensagem);
  };

  const confirmarEnvio = async () => {
    if (!previewBase64 || !uidAtual || !conversaId || !outroUid) return;
    setPreviewVisible(false);
    setUploading(true);
    try {
      const localId = String(Date.now());
      const nova: any = {
        id: localId, docId: localId, conversaId, mensagem: previewBase64,
        remetenteUid: uidAtual, nome_remetente: meuNome,
        foto: minhaFoto || null, tipo: "imagem",
        data_postagem: new Date().toISOString(),
      };
      if (citando) {
        nova.citacao = {
          id: resolverDocId(citando),
          mensagem: citando.tipo === "imagem" ? "📷 Imagem" : citando.mensagem,
          nome: citando.nome_remetente, tipo: citando.tipo,
        };
        setCitando(null);
      }
      setMessages(prev => [...prev, nova]);
      if (socketRef.current?.readyState === WebSocket.OPEN)
        socketRef.current.send(JSON.stringify({ type: "message", ...nova }));
      const ref = await addDoc(collection(db, "mensagens"), {
        conversaId, mensagem: previewBase64, tipo: "imagem",
        remetenteUid: uidAtual, nome_remetente: meuNome,
        foto: minhaFoto || null, data_postagem: serverTimestamp(),
        ...(nova.citacao ? { citacao: nova.citacao } : {}),
      });
      docIdMap.current[localId] = ref.id;
      setMessages(prev => prev.map(m => m.id === localId ? { ...m, docId: ref.id } : m));
      await setDoc(firestoreDoc(db, "conversas", conversaId), {
        ultimaMensagem: "📷 Imagem", data_postagem: serverTimestamp(),
        quemEnviou: uidAtual, visto: false,
        dadosMembros: {
          [uidAtual]: { nome: meuNome, foto: minhaFoto || null },
          [outroUid]:  { nome: outroNome || "Usuário", foto: null },
        },
      }, { merge: true });
    } catch { Alert.alert("Erro", "Não foi possível enviar a imagem."); }
    finally { setUploading(false); setPreviewBase64(null); setPreviewImage(null); }
  };

  const cancelarPreview = () => { setPreviewVisible(false); setPreviewImage(null); setPreviewBase64(null); };
  const abrirImagemFull = (b64: string) => {
    setFullImageUrl(b64.startsWith("data:") ? b64 : `data:image/jpeg;base64,${b64}`);
    setFullImageVisible(true);
  };
  const getImageUri = (foto: any) => {
    const p = "https://cdn-icons-png.flaticon.com/512/149/149071.png";
    if (!foto) return p;
    if (typeof foto === "string" && (foto.startsWith("data:image") || foto.startsWith("http"))) return foto;
    return `data:image/jpeg;base64,${foto}`;
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0f0f1a" }}>
        <ActivityIndicator size="large" color="#E91E63" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : "height"}>

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ paddingRight: 15 }}>
          <Text style={styles.backButton}>←</Text>
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>{outroNome || "Chat"}</Text>
          <Text style={styles.headerUser}>Conversa privada</Text>
        </View>
      </View>

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
          const isMe = item.remetenteUid === uidAtual;
          const proxMsg = messages[index + 1];
          const ultimaDaSequencia = proxMsg?.remetenteUid !== item.remetenteUid || !proxMsg;

          return (
            <TouchableOpacity
              key={item.docId || item.id || String(index)}
              activeOpacity={0.8}
              onLongPress={() => setMenuMsg(item)}
              // ✅ FIX: justifyContent muda conforme o remetente para alinhar bolha corretamente
              style={[styles.messageRow, isMe ? styles.messageRowMe : styles.messageRowOther]}
            >
              {!isMe && (
                <View style={styles.avatarSlot}>
                  {ultimaDaSequencia
                    ? <Image source={{ uri: getImageUri(item.foto) }} style={styles.avatar} />
                    : <View style={styles.avatarEspaco} />}
                </View>
              )}

              {/* ✅ FIX: sem flex:1 — a bolha cresce só até o tamanho do conteúdo */}
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
                {item.tipo === "imagem" ? (
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
                )}
              </View>

              {isMe && (
                <View style={styles.avatarSlot}>
                  {ultimaDaSequencia
                    ? <Image source={{ uri: getImageUri(minhaFoto) }} style={styles.avatar} />
                    : <View style={styles.avatarEspaco} />}
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {(citando || editandoId) && (
        <View style={styles.citandoBar}>
          <View style={styles.citandoInfo}>
            {citando
              ? <><Text style={styles.citandoNome}>{citando.nome_remetente}</Text>
                  <Text style={styles.citandoTexto} numberOfLines={1}>
                    {citando.tipo === "imagem" ? "📷 Imagem" : citando.mensagem}
                  </Text></>
              : <Text style={styles.citandoNome}>✏️ Editando mensagem</Text>
            }
          </View>
          <TouchableOpacity onPress={() => { setCitando(null); setEditandoId(null); setInputText(""); }}>
            <Text style={styles.citandoFechar}>✕</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.inputArea}>
        <TouchableOpacity onPress={() => fileInputRef.current?.click()} style={styles.imgButton} disabled={uploading}>
          {uploading ? <ActivityIndicator size="small" color="#E91E63" /> : <Text style={styles.imgIcon}>🖼️</Text>}
        </TouchableOpacity>
        <TextInput
          value={inputText} onChangeText={setInputText}
          style={styles.input} placeholder="Mensagem..."
          placeholderTextColor="#888" multiline
        />
        <TouchableOpacity onPress={sendMessage} style={styles.sendButton}>
          <Text style={styles.sendButtonText}>➤</Text>
        </TouchableOpacity>
      </View>

      {menuMsg && (
        <View style={styles.overlayFull}>
          <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={() => setMenuMsg(null)} />
          <View style={styles.menuCard}>
            <Text style={styles.menuTitle}>Opções</Text>
            <TouchableOpacity style={styles.menuItem} onPress={() => { setCitando(menuMsg); setMenuMsg(null); }}>
              <Text style={styles.menuItemIcon}>↩️</Text>
              <Text style={styles.menuItemText}>Responder</Text>
            </TouchableOpacity>
            {menuMsg.remetenteUid === uidAtual && menuMsg.tipo !== "imagem" && (
              <TouchableOpacity style={styles.menuItem} onPress={() => iniciarEdicao(menuMsg)}>
                <Text style={styles.menuItemIcon}>✏️</Text>
                <Text style={styles.menuItemText}>Editar</Text>
              </TouchableOpacity>
            )}
            {/* Apagar: usa confirm nativo no web, Alert no mobile */}
            <TouchableOpacity style={styles.menuItem} onPress={() => {
              if (menuMsg.remetenteUid !== uidAtual) return;
              if (Platform.OS === "web") {
                if (window.confirm("Apagar mensagem? Essa ação não pode ser desfeita.")) {
                  apagarMensagem(menuMsg);
                }
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
            <TouchableOpacity style={[styles.menuItem, { borderBottomWidth: 0, marginTop: 4 }]} onPress={() => setMenuMsg(null)}>
              <Text style={[styles.menuItemText, { color: "#aaa", textAlign: "center", width: "100%" }]}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {previewVisible && (
        <View style={styles.overlayFull}>
          <View style={styles.previewCard}>
            <Text style={styles.previewTitle}>Pré-visualização</Text>
            {previewImage && (
              Platform.OS === "web"
                // @ts-ignore
                ? <img src={previewImage} style={{ width: 280, height: 280, objectFit: "contain", borderRadius: 12, marginBottom: 20 }} />
                : <Image source={{ uri: previewImage }} style={styles.previewImage} resizeMode="contain" />
            )}
            <View style={styles.previewButtons}>
              <TouchableOpacity style={[styles.previewBtn, styles.cancelBtn]} onPress={cancelarPreview}>
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.previewBtn, styles.sendBtn]} onPress={confirmarEnvio}>
                <Text style={styles.sendBtnText}>Enviar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

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

const styles = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: "#0f0f1a",
    ...(Platform.OS === "web"
      ? { height: "100vh" as any, maxHeight: "100vh" as any, overflow: "hidden" as any }
      : {}),
  },
  header:        { backgroundColor: "#1c1c2e", flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingTop: Platform.OS === "ios" ? 50 : 40, paddingBottom: 16 },
  backButton:    { color: "white", fontSize: 28 },
  headerTitle:   { color: "white", fontSize: 18, fontWeight: "bold" },
  headerUser:    { color: "#aaa", fontSize: 12 },
  scrollView:    { flex: 1 },
  scrollContent: { paddingVertical: 10, paddingHorizontal: 6, flexGrow: 1 },

  // ✅ FIX: messageRow agora tem variantes por lado, sem definir justifyContent fixo
  messageRow:      { flexDirection: "row", alignItems: "flex-end", marginVertical: 2, paddingHorizontal: 4, width: "100%" },
  messageRowMe:    { justifyContent: "flex-end" },
  messageRowOther: { justifyContent: "flex-start" },

  avatarSlot:    { width: 40, alignItems: "center", justifyContent: "flex-end" },
  avatarEspaco:  { width: 34, height: 34 },
  avatar:        { width: 34, height: 34, borderRadius: 17 },

  // ✅ FIX: removido flex:1 — bolha cresce conforme conteúdo, limitada por maxWidth
  bolha:         { maxWidth: SCREEN_WIDTH * 0.72, padding: 10, borderRadius: 15, marginHorizontal: 4, flexShrink: 1 },
  bolhaMe:       { backgroundColor: "#E91E63", borderBottomRightRadius: 0, alignSelf: "flex-end" },
  bolhaOther:    { backgroundColor: "#2f2f4a", borderBottomLeftRadius: 0, alignSelf: "flex-start" },

  nomeRemetente: { color: "#E91E63", fontSize: 12, fontWeight: "bold", marginBottom: 3 },
  messageText:   { color: "white", fontSize: 15, flexShrink: 1, flexWrap: "wrap" },
  rodape:        { flexDirection: "row", justifyContent: "flex-end", alignItems: "center", marginTop: 4 },
  hora:          { color: "rgba(255,255,255,0.55)", fontSize: 10, textAlign: "right", marginTop: 2 },
  editadaLabel:  { color: "rgba(255,255,255,0.45)", fontSize: 10 },
  citacaoBox:    { borderLeftWidth: 3, paddingLeft: 8, marginBottom: 6, borderRadius: 4, paddingVertical: 3 },
  citacaoMe:     { borderLeftColor: "rgba(255,255,255,0.6)", backgroundColor: "rgba(0,0,0,0.15)" },
  citacaoOther:  { borderLeftColor: "#E91E63", backgroundColor: "rgba(233,30,99,0.1)" },
  citacaoNome:   { color: "rgba(255,255,255,0.8)", fontSize: 11, fontWeight: "bold", marginBottom: 1 },
  citacaoTexto:  { color: "rgba(255,255,255,0.65)", fontSize: 12 },
  citandoBar:    { flexDirection: "row", alignItems: "center", backgroundColor: "#1c1c2e", paddingHorizontal: 14, paddingVertical: 8, borderTopWidth: 1, borderTopColor: "#E91E63" },
  citandoInfo:   { flex: 1 },
  citandoNome:   { color: "#E91E63", fontSize: 12, fontWeight: "bold" },
  citandoTexto:  { color: "#aaa", fontSize: 12 },
  citandoFechar: { color: "white", fontSize: 18, paddingLeft: 10 },
  inputArea:     { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingTop: 10, paddingBottom: Platform.OS === "ios" ? 32 : 16, backgroundColor: "#1c1c2e", borderTopWidth: 1, borderTopColor: "#2a2a3e" },
  imgButton:     { width: 44, height: 44, justifyContent: "center", alignItems: "center", marginRight: 6, backgroundColor: "#111", borderRadius: 22 },
  imgIcon:       { fontSize: 22 },
  input:         { flex: 1, backgroundColor: "#111", color: "white", borderRadius: 20, paddingHorizontal: 15, paddingTop: 10, paddingBottom: 10, maxHeight: 100, fontSize: 15 },
  sendButton:    { marginLeft: 10, backgroundColor: "#E91E63", width: 44, height: 44, borderRadius: 22, justifyContent: "center", alignItems: "center" },
  sendButtonText:{ color: "white", fontWeight: "bold", fontSize: 18 },
  overlayFull:     { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.85)", justifyContent: "center", alignItems: "center", zIndex: 999 },
  overlayFullDark: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "#000", justifyContent: "center", alignItems: "center", zIndex: 999 },
  menuCard:      { backgroundColor: "#1c1c2e", borderRadius: 20, padding: 20, width: 280 },
  menuTitle:     { color: "white", fontSize: 16, fontWeight: "bold", marginBottom: 12, textAlign: "center" },
  menuItem:      { flexDirection: "row", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#2a2a3e" },
  menuItemIcon:  { fontSize: 20, marginRight: 12 },
  menuItemText:  { color: "white", fontSize: 15 },
  previewCard:    { backgroundColor: "#1c1c2e", borderRadius: 20, padding: 24, width: 340, alignItems: "center" },
  previewTitle:   { color: "white", fontSize: 18, fontWeight: "bold", marginBottom: 16 },
  previewImage:   { width: 280, height: 280, borderRadius: 12, marginBottom: 20 },
  previewButtons: { flexDirection: "row", gap: 15 },
  previewBtn:     { paddingHorizontal: 28, paddingVertical: 12, borderRadius: 25 },
  cancelBtn:      { backgroundColor: "#444" },
  sendBtn:        { backgroundColor: "#E91E63" },
  cancelBtnText:  { color: "white", fontWeight: "bold" },
  sendBtnText:    { color: "white", fontWeight: "bold" },
  closeBtn:      { position: "absolute", top: Platform.OS === "ios" ? 50 : 30, right: 20, zIndex: 10, backgroundColor: "rgba(255,255,255,0.2)", width: 40, height: 40, borderRadius: 20, justifyContent: "center", alignItems: "center" },
  closeBtnText:  { color: "white", fontSize: 20, fontWeight: "bold" },
  fullImage:     { width: SCREEN_WIDTH, height: SCREEN_HEIGHT * 0.8 },
});