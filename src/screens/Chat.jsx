import React, { useEffect, useRef, useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  KeyboardAvoidingView, Platform, StyleSheet, Image, ActivityIndicator
} from "react-native";
import { db, auth } from "../config/firebaseConfig";
import {
  collection, addDoc, query, where, getDocs,
  orderBy, serverTimestamp, setDoc, doc, getDoc
} from "firebase/firestore";
import Constants from "expo-constants";

const getServerIP = () => {
  const hostUri = Constants.expoConfig?.hostUri || Constants.manifest?.debuggerHost;
  if (hostUri) return hostUri.split(":")[0];
  return "192.168.3.40";
};

const WS_URL = `ws://${getServerIP()}:3001`;

export default function Chat({ route, navigation }) {
  const { room, outroUid, outroNome } = route.params || {};

  const socketRef = useRef(null);
  const flatListRef = useRef(null);

  const [inputText, setInputText] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [meuNome, setMeuNome] = useState("");
  const [minhaFoto, setMinhaFoto] = useState(null);

  useEffect(() => {
    // DEBUG — ver o que está chegando nos params
    console.log("=== PARAMS DO CHAT ===");
    console.log("room:", room);
    console.log("outroUid:", outroUid);
    console.log("outroNome:", outroNome);
  }, []);

  useEffect(() => {
    const carregarMeusDados = async () => {
      const user = auth.currentUser;
      if (!user) {
        setLoading(false);
        return;
      }
      try {
        const snap = await getDoc(doc(db, "usuarios", user.uid));
        if (snap.exists()) {
          setMeuNome(snap.data().nome_completo || "Usuário");
          setMinhaFoto(snap.data().foto || null);
        }
      } catch (e) {
        console.log("Erro ao carregar perfil:", e.message);
      }
    };
    carregarMeusDados();
  }, []);

  useEffect(() => {
    if (!room) {
      setLoading(false);
      return;
    }
    if (!meuNome) return;

    const carregarHistorico = async () => {
      try {
        const q = query(
          collection(db, "mensagens"),
          where("sala", "==", room),
          orderBy("data_postagem", "asc")
        );
        const snapshot = await getDocs(q);
        const msgs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        console.log("Mensagens carregadas:", msgs.length);
        setMessages(msgs);
      } catch (e) {
        console.log("Erro ao carregar histórico:", e.message);
      } finally {
        setLoading(false);
      }
    };

    carregarHistorico();

    const ws = new WebSocket(WS_URL);
    socketRef.current = ws;

    ws.onopen = () => {
      console.log("✅ WebSocket conectado!");
      ws.send(JSON.stringify({ type: "join", room, user: meuNome }));
    };
    ws.onerror = (e) => console.log("❌ Erro WebSocket:", e.message);
    ws.onclose = () => console.log("WebSocket fechado.");
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "message") {
          setMessages(prev => [...prev, data]);
        }
      } catch (e) {
        console.log("Erro ao parsear mensagem:", e.message);
      }
    };

    return () => ws.close();
  }, [meuNome, room]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages]);

  const sendMessage = async () => {
    if (!inputText.trim() || !auth.currentUser) return;

    // Proteção contra undefined nos params
    if (!room) {
      console.log("❌ room está undefined! Verifique o navigation.navigate()");
      return;
    }

    const uidAtual = auth.currentUser.uid;
    const msgTexto = inputText.trim();
    setInputText("");

    const novaMensagem = {
      id: String(Date.now()),
      nome_remetente: meuNome || "Usuário",
      nome_destinatario: outroNome || "Usuário",  // proteção contra undefined
      mensagem: msgTexto,
      sala: room,
      remetenteUid: uidAtual,
      foto: minhaFoto || null
    };

    setMessages(prev => [...prev, novaMensagem]);

    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: "message", ...novaMensagem }));
    }

    try {
      const docRef = await addDoc(collection(db, "mensagens"), {
        nome_remetente: novaMensagem.nome_remetente,
        nome_destinatario: novaMensagem.nome_destinatario,
        mensagem: msgTexto,
        sala: room,
        remetenteUid: uidAtual,
        foto: minhaFoto || null,
        data_postagem: serverTimestamp()
      });
      console.log("✅ Mensagem salva! ID:", docRef.id);

      await setDoc(doc(db, "conversas", room), {
        membros: [uidAtual, outroUid || ""],
        ultimaMensagem: msgTexto,
        data_postagem: serverTimestamp(),
        quemEnviou: uidAtual,
        visto: false,
        dadosMembros: {
          [uidAtual]: { nome: meuNome || "Usuário", foto: minhaFoto || null },
          [outroUid || "outro"]: { nome: outroNome || "Usuário", foto: null }
        }
      }, { merge: true });
      console.log("✅ Conversa atualizada!");

    } catch (e) {
      console.log("❌ ERRO Firestore:", e.code, "|", e.message);
    }
  };

  const getImageUri = (foto) => {
    const padrao = "https://cdn-icons-png.flaticon.com/512/149/149071.png";
    if (!foto) return padrao;
    if (typeof foto === "string" && (foto.startsWith("data:image") || foto.startsWith("http"))) return foto;
    return `data:image/jpeg;base64,${foto}`;
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color="#E91E63" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.container}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ paddingRight: 15 }}>
          <Text style={{ color: "white", fontSize: 24 }}>←</Text>
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>{outroNome || "Chat"}</Text>
          <Text style={styles.headerUser}>Conversa privada</Text>
        </View>
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item, index) => item.id || String(index)}
        renderItem={({ item }) => {
          const isMe = item.remetenteUid === auth.currentUser?.uid;
          return (
            <View style={[styles.messageRow, isMe ? styles.rowRight : styles.rowLeft]}>
              {!isMe && (
                <Image source={{ uri: getImageUri(item.foto) }} style={styles.avatar} />
              )}
              <View style={[styles.messageBox, isMe ? styles.myMessage : styles.otherMessage]}>
                <Text style={styles.messageText}>{item.mensagem}</Text>
              </View>
            </View>
          );
        }}
      />

      <View style={styles.inputArea}>
        <TextInput
          value={inputText}
          onChangeText={setInputText}
          style={styles.input}
          placeholder="Mensagem..."
          placeholderTextColor="#888"
          multiline
        />
        <TouchableOpacity onPress={sendMessage} style={styles.sendButton}>
          <Text style={{ color: "white", fontWeight: "bold" }}>➤</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f0f1a" },
  header: { padding: 20, paddingTop: 50, backgroundColor: "#1c1c2e", flexDirection: "row", alignItems: "center" },
  headerTitle: { color: "white", fontSize: 18, fontWeight: "bold" },
  headerUser: { color: "#aaa", fontSize: 12 },
  messageRow: { flexDirection: "row", alignItems: "flex-end", margin: 8 },
  rowLeft: { justifyContent: "flex-start" },
  rowRight: { justifyContent: "flex-end" },
  avatar: { width: 35, height: 35, borderRadius: 20, marginHorizontal: 5 },
  messageBox: { padding: 12, borderRadius: 15, maxWidth: "75%" },
  myMessage: { backgroundColor: "#E91E63", borderBottomRightRadius: 0 },
  otherMessage: { backgroundColor: "#2f2f4a", borderBottomLeftRadius: 0 },
  messageText: { color: "white", fontSize: 15 },
  inputArea: { flexDirection: "row", padding: 10, paddingBottom: Platform.OS === "ios" ? 30 : 10, backgroundColor: "#1c1c2e", alignItems: "center" },
  input: { flex: 1, backgroundColor: "#111", color: "white", borderRadius: 20, paddingHorizontal: 15, paddingTop: 10, paddingBottom: 10, maxHeight: 100 },
  sendButton: { marginLeft: 10, backgroundColor: "#E91E63", width: 45, height: 45, borderRadius: 25, justifyContent: "center", alignItems: "center" }
});