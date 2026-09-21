import React, { createContext, useContext, useState, useEffect } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, getDoc, updateDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../config/firebaseConfig';
import { CORES as CORES_LIGHT, CORES_DARK, Tema } from '../constants/theme';
import { aplicarDecaimentoInatividade } from '../services/gamificationService';


type Cores = Tema;

interface AppSettingsContextType {
  // Aparência
  modoEscuro: boolean;
  tamanhoFonte: string;
  setModoEscuro: (v: boolean) => void;
  setTamanhoFonte: (v: string) => void;

  // Notificações
  notifGeral: boolean;
  notifAvisos: boolean;
  notifEventos: boolean;
  notifMatch: boolean;
  somNotif: string;
  vibracao: boolean;
  setNotifGeral: (v: boolean) => void;
  setNotifAvisos: (v: boolean) => void;
  setNotifEventos: (v: boolean) => void;
  setNotifMatch: (v: boolean) => void;
  setSomNotif: (v: string) => void;
  setVibracao: (v: boolean) => void;

  // Privacidade
  visibilidade: string;
  statusOnline: boolean;
  serieFiltro: string;
  setVisibilidade: (v: string) => void;
  setStatusOnline: (v: boolean) => void;
  setSerieFiltro: (v: string) => void;

  // Helpers (calculados)
  cores: Cores;
  fonteScale: number;
  carregando: boolean;

  // Sincronizar com Firebase quando login muda
  recarregarDoFirebase: (uid: string) => Promise<void>;
}

const AppSettingsContext = createContext<AppSettingsContextType | undefined>(undefined);


export const AppSettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // ── States ──
  const [modoEscuro, setModoEscuroState] = useState(false);
  const [tamanhoFonte, setTamanhoFonteState] = useState('Normal');
  const [notifGeral, setNotifGeralState] = useState(true);
  const [notifAvisos, setNotifAvisosState] = useState(true);
  const [notifEventos, setNotifEventosState] = useState(true);
  const [notifMatch, setNotifMatchState] = useState(true);
  const [somNotif, setSomNotifState] = useState('Normal');
  const [vibracao, setVibracaoState] = useState(true);
  const [visibilidade, setVisibilidadeState] = useState('Público');
  const [statusOnline, setStatusOnlineState] = useState(true);
  const [serieFiltro, setSerieFiltroState] = useState('Não definir');
  const [carregando, setCarregando] = useState(true);

  // ── Calculados ──
  const cores = modoEscuro ? CORES_DARK : CORES_LIGHT;
  const fonteScale =
    tamanhoFonte === 'Pequeno' ? 0.9 :
    tamanhoFonte === 'Grande'  ? 1.15 : 1;

  // ── Carregar do AsyncStorage no boot ──
  useEffect(() => {
    carregarLocal();
  }, []);

  // ── Online/Offline via AppState (backup global, complementa o NotificacaoProvider) ──
  useEffect(() => {
    const handler = AppState.addEventListener('change', async (nextState) => {
      try {
        const uid = auth.currentUser?.uid || (await AsyncStorage.getItem('uid'));
        if (!uid) return;
        const userRef = doc(db, 'usuarios', uid);
        if (nextState === 'active') {
          setDoc(userRef, { online: true }, { merge: true }).catch(() => {});
        } else {
          setDoc(userRef, { online: false, ultimo_acesso: serverTimestamp() }, { merge: true }).catch(() => {});
        }
      } catch {}
    });
    return () => handler.remove();
  }, []);

  // ── Decaimento por inatividade (roda 1x no boot do app) ──
  useEffect(() => {
    (async () => {
      try {
        const uid = auth.currentUser?.uid || (await AsyncStorage.getItem('uid'));
        if (!uid) return;
        await aplicarDecaimentoInatividade(uid);
      } catch {}
    })();
  }, []);

  const carregarLocal = async () => {
    try {
      const configs = await AsyncStorage.multiGet([
        'cfg_modoEscuro', 'cfg_tamanhoFonte', 'cfg_notifGeral',
        'cfg_notifAvisos', 'cfg_notifEventos', 'cfg_notifMatch',
        'cfg_somNotif', 'cfg_vibracao', 'cfg_serieFiltro',
      ]);
      const map: Record<string, string | null> = {};
      configs.forEach(([k, v]) => map[k] = v);

      if (map.cfg_modoEscuro    !== null) setModoEscuroState(map.cfg_modoEscuro === '1');
      if (map.cfg_tamanhoFonte  !== null) setTamanhoFonteState(map.cfg_tamanhoFonte || 'Normal');
      if (map.cfg_notifGeral    !== null) setNotifGeralState(map.cfg_notifGeral !== '0');
      if (map.cfg_notifAvisos   !== null) setNotifAvisosState(map.cfg_notifAvisos !== '0');
      if (map.cfg_notifEventos  !== null) setNotifEventosState(map.cfg_notifEventos !== '0');
      if (map.cfg_notifMatch    !== null) setNotifMatchState(map.cfg_notifMatch !== '0');
      if (map.cfg_somNotif      !== null) setSomNotifState(map.cfg_somNotif || 'Normal');
      if (map.cfg_vibracao      !== null) setVibracaoState(map.cfg_vibracao !== '0');
      if (map.cfg_serieFiltro   !== null) setSerieFiltroState(map.cfg_serieFiltro || 'Não definir');

      // Tenta sincronizar com Firebase se já tiver login
      const uid = await AsyncStorage.getItem('uid');
      if (uid) {
        await recarregarDoFirebase(uid);
        // Marca online assim que o Firebase confirmar que está acessível
        // (aqui Auth já está pronto pois recarregarDoFirebase fez um getDoc com sucesso)
        setDoc(doc(db, 'usuarios', uid), { online: true }, { merge: true })
          .catch(() => {}); // falha silenciosa – NotificacaoProvider vai tentar novamente
      }
    } catch (e) {
      console.error('Erro carregar configs:', e);
    } finally {
      setCarregando(false);
    }
  };

  const recarregarDoFirebase = async (uid: string) => {
    try {
      const snap = await getDoc(doc(db, 'usuarios', uid));
      if (snap.exists()) {
        const d = snap.data();
        setVisibilidadeState(d.visibilidade || 'Público');
        setStatusOnlineState(d.statusOnline !== false);
      }
    } catch (e) {
      console.error('Erro Firebase configs:', e);
    }
  };

  // ── Helpers de salvar ──
  const salvarLocal = async (chave: string, valor: any) => {
    try {
      await AsyncStorage.setItem(
        chave,
        typeof valor === 'boolean' ? (valor ? '1' : '0') : String(valor)
      );
    } catch (e) { console.error(e); }
  };

  const salvarFirestore = async (campo: string, valor: any) => {
    try {
      const uid = auth.currentUser?.uid || (await AsyncStorage.getItem('uid'));
      if (uid) await updateDoc(doc(db, 'usuarios', uid), { [campo]: valor });
    } catch (e) { console.error(e); }
  };

  // ── Setters públicos (atualizam state + persistem) ──
  const setModoEscuro = (v: boolean) => {
    setModoEscuroState(v);
    salvarLocal('cfg_modoEscuro', v);
  };
  const setTamanhoFonte = (v: string) => {
    setTamanhoFonteState(v);
    salvarLocal('cfg_tamanhoFonte', v);
  };
  const setNotifGeral = (v: boolean) => {
    setNotifGeralState(v);
    salvarLocal('cfg_notifGeral', v);
  };
  const setNotifAvisos = (v: boolean) => {
    setNotifAvisosState(v);
    salvarLocal('cfg_notifAvisos', v);
  };
  const setNotifEventos = (v: boolean) => {
    setNotifEventosState(v);
    salvarLocal('cfg_notifEventos', v);
  };
  const setNotifMatch = (v: boolean) => {
    setNotifMatchState(v);
    salvarLocal('cfg_notifMatch', v);
  };
  const setSomNotif = (v: string) => {
    setSomNotifState(v);
    salvarLocal('cfg_somNotif', v);
  };
  const setVibracao = (v: boolean) => {
    setVibracaoState(v);
    salvarLocal('cfg_vibracao', v);
  };
  const setVisibilidade = (v: string) => {
    setVisibilidadeState(v);
    salvarFirestore('visibilidade', v);
  };
  const setStatusOnline = (v: boolean) => {
    setStatusOnlineState(v);
    salvarFirestore('statusOnline', v);
  };
  const setSerieFiltro = (v: string) => {
    setSerieFiltroState(v);
    salvarLocal('cfg_serieFiltro', v);
  };

  const value: AppSettingsContextType = {
    modoEscuro, tamanhoFonte,
    setModoEscuro, setTamanhoFonte,
    notifGeral, notifAvisos, notifEventos, notifMatch, somNotif, vibracao,
    setNotifGeral, setNotifAvisos, setNotifEventos, setNotifMatch, setSomNotif, setVibracao,
    visibilidade, statusOnline, serieFiltro,
    setVisibilidade, setStatusOnline, setSerieFiltro,
    cores, fonteScale, carregando,
    recarregarDoFirebase,
  };

  return (
    <AppSettingsContext.Provider value={value}>
      {children}
    </AppSettingsContext.Provider>
  );
};


export const useAppSettings = () => {
  const ctx = useContext(AppSettingsContext);
  if (!ctx) {
    throw new Error('useAppSettings precisa estar dentro de <AppSettingsProvider>');
  }
  return ctx;
};
