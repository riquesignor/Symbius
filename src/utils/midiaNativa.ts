import { Alert, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

// Tudo é salvo como base64 dentro do próprio documento do Firestore, que tem
// limite de 1 MiB por documento — por isso os limites abaixo ficam bem
// abaixo disso (base64 infla o arquivo em ~33%).
export const LIMITE_ARQUIVO_BYTES = 700 * 1024;

export type OrigemImagem = 'galeria' | 'camera';

const pedirPermissao = async (origem: OrigemImagem): Promise<boolean> => {
  const resp = origem === 'camera'
    ? await ImagePicker.requestCameraPermissionsAsync()
    : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (resp.granted) return true;
  Alert.alert(
    'Permissão necessária',
    origem === 'camera'
      ? 'Libere o acesso à câmera nas configurações do celular para tirar fotos.'
      : 'Libere o acesso às fotos nas configurações do celular para enviar imagens.',
  );
  return false;
};

// Retorna base64 puro (sem prefixo data:), já redimensionado e comprimido.
export const escolherImagemBase64 = async (
  opts: { origem?: OrigemImagem; ladoMax?: number; qualidade?: number; quadrada?: boolean; aspecto?: [number, number] } = {},
): Promise<string | null> => {
  const { origem = 'galeria', ladoMax = 1024, qualidade = 0.6, quadrada = false } = opts;
  const aspecto = opts.aspecto || (quadrada ? [1, 1] as [number, number] : undefined);
  if (Platform.OS !== 'web' && !(await pedirPermissao(origem))) return null;

  const pickerOpts: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    allowsEditing: !!aspecto,
    aspect: aspecto,
    quality: 1,
  };
  const res = origem === 'camera'
    ? await ImagePicker.launchCameraAsync(pickerOpts)
    : await ImagePicker.launchImageLibraryAsync(pickerOpts);
  if (res.canceled || !res.assets?.[0]) return null;

  const asset = res.assets[0];
  const maiorLado = Math.max(asset.width || 0, asset.height || 0);
  const acoes = maiorLado > ladoMax
    ? [{ resize: (asset.width || 0) >= (asset.height || 0) ? { width: ladoMax } : { height: ladoMax } }]
    : [];
  const final = await manipulateAsync(asset.uri, acoes, { compress: qualidade, format: SaveFormat.JPEG, base64: true });
  if (!final.base64) return null;
  if (final.base64.length * 0.75 > LIMITE_ARQUIVO_BYTES) {
    Alert.alert('Imagem muito grande', 'Tente uma imagem menor.');
    return null;
  }
  return final.base64;
};

const lerBase64 = (uri: string) =>
  FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });

export const escolherVideoBase64 = async (): Promise<{ base64: string; tamanho: number } | null> => {
  if (!(await pedirPermissao('galeria'))) return null;
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'], quality: 0.5 });
  if (res.canceled || !res.assets?.[0]) return null;
  const asset = res.assets[0];
  const info = await FileSystem.getInfoAsync(asset.uri);
  const tamanho = asset.fileSize || (info.exists ? info.size : 0) || 0;
  if (tamanho > LIMITE_ARQUIVO_BYTES) {
    Alert.alert('Vídeo muito grande', `Envie vídeos de até ${Math.round(LIMITE_ARQUIVO_BYTES / 1024)} KB.`);
    return null;
  }
  return { base64: await lerBase64(asset.uri), tamanho };
};

export const escolherDocumentoBase64 = async (): Promise<{ nome: string; base64: string; tipo: string; tamanho: number } | null> => {
  const res = await DocumentPicker.getDocumentAsync({
    type: ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    copyToCacheDirectory: true,
    base64: Platform.OS === 'web', // na web o uri vira data URL
  });
  if (res.canceled || !res.assets?.[0]) return null;
  const asset = res.assets[0];
  const tamanho = asset.size || 0;
  if (tamanho > LIMITE_ARQUIVO_BYTES) {
    Alert.alert('Arquivo muito grande', `Envie documentos de até ${Math.round(LIMITE_ARQUIVO_BYTES / 1024)} KB.`);
    return null;
  }
  const tipo = (asset.name.split('.').pop() || 'pdf').toLowerCase();
  const base64 = Platform.OS === 'web' ? (asset.uri.split(',')[1] || '') : await lerBase64(asset.uri);
  return { nome: asset.name, base64, tipo, tamanho };
};

// Grava o base64 num arquivo temporário e abre a folha de compartilhamento do
// sistema (de lá o usuário salva, abre num leitor de PDF, etc).
export const abrirArquivoBase64 = async (base64: string, nomeArquivo: string, mimeType: string) => {
  if (Platform.OS === 'web') {
    const link = document.createElement('a');
    link.href = base64.startsWith('data:') ? base64 : `data:${mimeType};base64,${base64}`;
    link.download = nomeArquivo;
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
    return;
  }
  try {
    const puro = base64.startsWith('data:') ? base64.split(',')[1] : base64;
    const nomeSeguro = nomeArquivo.replace(/[^\w.\-]/g, '_');
    const destino = `${FileSystem.cacheDirectory}${nomeSeguro}`;
    await FileSystem.writeAsStringAsync(destino, puro, { encoding: FileSystem.EncodingType.Base64 });
    if (!(await Sharing.isAvailableAsync())) {
      Alert.alert('Indisponível', 'Não foi possível abrir o arquivo neste aparelho.');
      return;
    }
    await Sharing.shareAsync(destino, { mimeType, dialogTitle: nomeArquivo });
  } catch (e) {
    console.log('Erro ao abrir arquivo:', e);
    Alert.alert('Erro', 'Não foi possível abrir o arquivo.');
  }
};
