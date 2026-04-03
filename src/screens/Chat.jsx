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

export default function Chat({ route, navigation }) {
  // Pegando os dados que vêm da outra tela
  const { room, outroUid, outroNome } = route.params || {};

  const socketRef = useRef(null);
  const flatListRef = useRef(null);

  const [inputText, setInputText] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);

  const [meuNome, setMeuNome] = useState("");
  const [minhaFoto, setMinhaFoto] = useState(null);

  // 1. Carrega seus dados (Remetente)
  useEffect(() => {
    const carregarMeusDados = async () => {
      const user = auth.currentUser;
      if (user) {
        try {
          // Verifique se sua coleção no Firebase chama 'usuarios' ou 'cadastro'
          const docRef = doc(db, "usuarios", user.uid); 
          const snap = await getDoc(docRef);
          if (snap.exists()) {
            setMeuNome(snap.data().nome_completo || "Usuário");
            setMinhaFoto(snap.data().foto || null);
          }
        } catch (e) {
          console.log("Erro ao carregar perfil local:", e);
        }
      }
    };
    carregarMeusDados();
  }, []);

  // 2. Histórico e Socket
  useEffect(() => {
    if (!meuNome || !room) return;

    const carregarHistorico = async () => {
      try {
        const q = query(
          collection(db, "mensagens"),
          where("sala", "==", room),
          orderBy("data_postagem", "asc")
        );

        const querySnapshot = await getDocs(q);
        const msgs = [];
        
        querySnapshot.forEach((docItem) => {
          msgs.push({ id: docItem.id, ...docItem.data() });
        });
        setMessages(msgs);
      } catch (error) {
        console.error("Erro ao buscar mensagens:", error);
      } finally {
        setLoading(false);
      }
    };

    carregarHistorico();

    // Configuração do WebSocket
    const ws = new WebSocket("ws://192.168.3.40:3001");
    socketRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "join", room, user: meuNome }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "message") {
          setMessages((prev) => [...prev, data]);
        }
      } catch (err) {
        console.log("Erro no socket:", err);
      }
    };

    return () => ws.close();
  }, [meuNome, room]);

  // 3. Enviar Mensagem
  const sendMessage = async () => {
    if (!inputText.trim() || !auth.currentUser) return;

    const uidAtual = auth.currentUser.uid;
    const msgTexto = inputText;
    setInputText(""); 

    const novaMensagem = {
      nome_remetente: meuNome,
      nome_destinatario: outroNome,
      mensagem: msgTexto,
      sala: room,
      remetenteUid: uidAtual,
      foto: minhaFoto
    };

    // Socket
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: "message", ...novaMensagem }));
    }

    // Update Local
    setMessages((prev) => [...prev, novaMensagem]);

    // Firestore
    try {
      await addDoc(collection(db, "mensagens"), {
        ...novaMensagem,
        data_postagem: serverTimestamp()
      });

      // Atualiza a lista de conversas (Caixa de entrada)
      await setDoc(doc(db, "conversas", room), {
        membros: [uidAtual, outroUid],
        ultimaMensagem: msgTexto,
        data_postagem: serverTimestamp(),
        quemEnviou: uidAtual,
        visto: false,
        dadosMembros: {
          [uidAtual]: { nome: meuNome, foto: minhaFoto },
          [outroUid]: { nome: outroNome, foto: null }
        }
      }, { merge: true });

    } catch (e) {
      console.log("Erro ao salvar no Firebase:", e);
    }
  };

  const getImageUri = (foto) => {
    const padrao = "https://cdn-icons-png.flaticon.com/512/149/149071.png";
    if (!foto) return padrao;
    if (typeof foto === 'string' && (foto.startsWith("data:image") || foto.startsWith("http"))) {
      return foto;
    }
    return `data:image/jpeg;base64,${foto}`;
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center' }]}>
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
        keyExtractor={(_, index) => index.toString()}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
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
  header: { padding: 20, paddingTop: 50, backgroundColor: "#1c1c2e", flexDirection: 'row', alignItems: 'center' },
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
  inputArea: { flexDirection: "row", padding: 10, paddingBottom: Platform.OS === 'ios' ? 30 : 10, backgroundColor: "#1c1c2e", alignItems: 'center' },
  input: { flex: 1, backgroundColor: "#111", color: "white", borderRadius: 20, paddingHorizontal: 15, paddingTop: 10, paddingBottom: 10, maxHeight: 100 },
  sendButton: { marginLeft: 10, backgroundColor: "#E91E63", width: 45, height: 45, borderRadius: 25, justifyContent: 'center', alignItems: 'center' }
});