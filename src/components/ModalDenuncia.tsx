import React, { useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CORES_SYMBIUS } from '../constants/coresSymbius';
import { F } from '../constants/theme';
import { MOTIVOS_DENUNCIA, denunciarMensagem } from '../services/denunciasService';

interface Props {
  mensagem: any | null; // precisa de id e remetenteUid
  conversaId: string | null;
  denuncianteUid: string | null;
  tipoConversa: 'individual' | 'grupo';
  onFechar: () => void;
}

export default function ModalDenuncia({ mensagem, conversaId, denuncianteUid, tipoConversa, onFechar }: Props) {
  const insets = useSafeAreaInsets();
  const [motivo, setMotivo] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<'registrada' | 'ja_denunciada' | 'erro' | null>(null);

  const fechar = () => { setMotivo(null); setResultado(null); setEnviando(false); onFechar(); };

  const enviar = async () => {
    if (!mensagem || !conversaId || !denuncianteUid || !motivo || enviando) return;
    setEnviando(true);
    try {
      setResultado(await denunciarMensagem({
        mensagemId: mensagem.id, conversaId, denuncianteUid,
        autorUid: mensagem.remetenteUid, tipoConversa, motivo,
      }));
    } catch {
      setResultado('erro');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Modal visible={!!mensagem} transparent animationType="slide" onRequestClose={fechar}>
      <View style={styles.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={fechar} accessibilityLabel="Fechar" />
        <View style={[styles.sheet, { paddingBottom: 20 + insets.bottom }]}>
          <View style={styles.handle} />
          {resultado === 'registrada' || resultado === 'ja_denunciada' ? (
            <View style={{ alignItems: 'center', paddingVertical: 12 }}>
              <Ionicons name="shield-checkmark" size={40} color={CORES_SYMBIUS.verdeEscuro} />
              <Text style={styles.titulo}>
                {resultado === 'registrada' ? 'Denúncia enviada' : 'Você já denunciou esta mensagem'}
              </Text>
              <Text style={styles.sub}>A coordenação vai analisar. Quem enviou a mensagem não fica sabendo quem denunciou.</Text>
              <TouchableOpacity style={[styles.btn, styles.btnPrimario]} onPress={fechar}>
                <Text style={styles.btnPrimarioTxt}>Entendi</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <Text style={styles.titulo} accessibilityRole="header">Denunciar mensagem</Text>
              <Text style={styles.sub}>Qual é o problema?</Text>
              {MOTIVOS_DENUNCIA.map(m => {
                const ativo = motivo === m;
                return (
                  <TouchableOpacity
                    key={m}
                    style={styles.opcao}
                    onPress={() => setMotivo(m)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: ativo }}
                  >
                    <Text style={styles.opcaoTxt}>{m}</Text>
                    <Ionicons name={ativo ? 'radio-button-on' : 'radio-button-off'} size={20} color={ativo ? CORES_SYMBIUS.verdeEscuro : CORES_SYMBIUS.textoTerciario} />
                  </TouchableOpacity>
                );
              })}
              {resultado === 'erro' && <Text style={styles.erro}>Não foi possível enviar. Tente de novo.</Text>}
              <View style={styles.botoes}>
                <TouchableOpacity style={[styles.btn, styles.btnSecundario]} onPress={fechar}>
                  <Text style={styles.btnSecundarioTxt}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btn, styles.btnPerigo, (!motivo || enviando) && { opacity: 0.5 }]}
                  onPress={enviar}
                  disabled={!motivo || enviando}
                  accessibilityState={{ disabled: !motivo || enviando }}
                >
                  {enviando ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnPrimarioTxt}>Denunciar</Text>}
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: CORES_SYMBIUS.fundoCard, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 12 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: CORES_SYMBIUS.borda2, alignSelf: 'center', marginBottom: 12 },
  titulo: { fontSize: 18, fontFamily: F.black, color: CORES_SYMBIUS.texto, marginTop: 6, textAlign: 'center' },
  sub: { fontSize: 13, fontFamily: F.medium, color: CORES_SYMBIUS.textoSec, marginTop: 4, marginBottom: 10, textAlign: 'center' },
  opcao: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 48,
    borderBottomWidth: 1, borderBottomColor: CORES_SYMBIUS.borda,
  },
  opcaoTxt: { fontSize: 14.5, fontFamily: F.semibold, color: CORES_SYMBIUS.texto },
  erro: { color: '#D64545', fontFamily: F.semibold, fontSize: 13, marginTop: 10, textAlign: 'center' },
  botoes: { flexDirection: 'row', gap: 10, marginTop: 16 },
  btn: { flex: 1, minHeight: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16 },
  btnSecundario: { backgroundColor: CORES_SYMBIUS.fundoSuave },
  btnSecundarioTxt: { fontFamily: F.bold, fontSize: 14, color: CORES_SYMBIUS.texto },
  btnPerigo: { backgroundColor: '#C84B2E' },
  btnPrimario: { backgroundColor: CORES_SYMBIUS.verdeEscuro, marginTop: 16, alignSelf: 'stretch', flex: 0 },
  btnPrimarioTxt: { fontFamily: F.bold, fontSize: 14, color: '#fff' },
});
