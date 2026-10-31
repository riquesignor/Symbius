import { ImageSourcePropType } from 'react-native';
import { Animal } from '../utils/gamification';

export type CategoriaCosmetico = 'chapeu' | 'acessorio' | 'moldura';

// Onde o item fica no avatar. Cada âncora é um "slot": dá pra usar um item
// por âncora ao mesmo tempo (ex.: óculos + colar + cartola + moldura).
export type AncoraCosmetico = 'cabeca' | 'olhos' | 'pescoco' | 'moldura';

// Posição da arte em relação à foto, em frações do lado da foto (1 = lado
// inteiro). Valores fora de 0..1 deixam o item sair dos limites da foto.
export interface AjusteCosmetico {
  largura: number;
  centroX: number;
  centroY: number;
}

export interface Cosmetico {
  id: string;
  nome: string;
  /** Ícone (MaterialCommunityIcons) — usado só como fallback textual/legado. */
  icone: string;
  categoria: CategoriaCosmetico;
  ancora: AncoraCosmetico;
  imagem: ImageSourcePropType;
  /** largura / altura da arte (PNG recortado no conteúdo). */
  proporcao: number;
  ajuste: AjusteCosmetico;
  preco: number;
  /** Itens de prestígio só ficam disponíveis pra compra após alcançar um animal mínimo. */
  prestigio?: boolean;
  animalMinimo?: Animal;
  cor?: string;
}

export const LABEL_CATEGORIA: Record<CategoriaCosmetico, string> = {
  chapeu:    'Chapéus',
  acessorio: 'Acessórios',
  moldura:   'Molduras',
};

export const LABEL_ANCORA: Record<AncoraCosmetico, string> = {
  cabeca:  'Cabeça',
  olhos:   'Olhos',
  pescoco: 'Pescoço',
  moldura: 'Moldura',
};

// Moldura: 1.18 da foto; o furo da arte tem exatamente o tamanho da foto.
const AJUSTE_MOLDURA: AjusteCosmetico = { largura: 1.18, centroX: 0.5, centroY: 0.5 };

export const COSMETICOS: Cosmetico[] = [
  // ── Cabeça ───────────────────────────────────────────────
  { id: 'chapeu_bone', nome: 'Boné', icone: 'account-cowboy-hat', categoria: 'chapeu', ancora: 'cabeca', preco: 15,
    imagem: require('../../assets/cosmeticos/bone.png'), proporcao: 1.6364,
    ajuste: { largura: 1.0, centroX: 0.56, centroY: 0.06 } },
  { id: 'chapeu_cartola', nome: 'Cartola', icone: 'hat-fedora', categoria: 'chapeu', ancora: 'cabeca', preco: 30,
    imagem: require('../../assets/cosmeticos/cartola.png'), proporcao: 1.0379,
    ajuste: { largura: 0.72, centroX: 0.5, centroY: -0.07 } },
  { id: 'chapeu_capelo', nome: 'Capelo', icone: 'school', categoria: 'chapeu', ancora: 'cabeca', preco: 40,
    imagem: require('../../assets/cosmeticos/capelo.png'), proporcao: 1.5367,
    ajuste: { largura: 1.0, centroX: 0.5, centroY: 0.02 } },
  { id: 'chapeu_coroa', nome: 'Coroa Real', icone: 'crown', categoria: 'chapeu', ancora: 'cabeca', preco: 80,
    prestigio: true, animalMinimo: 'tubarao',
    imagem: require('../../assets/cosmeticos/coroa.png'), proporcao: 1.4539,
    ajuste: { largura: 0.8, centroX: 0.5, centroY: 0.0 } },

  // ── Olhos ────────────────────────────────────────────────
  { id: 'acs_oculos', nome: 'Óculos Escuros', icone: 'sunglasses', categoria: 'acessorio', ancora: 'olhos', preco: 20,
    imagem: require('../../assets/cosmeticos/oculos.png'), proporcao: 3.0476,
    ajuste: { largura: 0.86, centroX: 0.5, centroY: 0.42 } },
  { id: 'acs_monoculo', nome: 'Monóculo de Sábio', icone: 'glasses', categoria: 'acessorio', ancora: 'olhos', preco: 60,
    prestigio: true, animalMinimo: 'leopardo',
    imagem: require('../../assets/cosmeticos/monoculo.png'), proporcao: 0.6353,
    ajuste: { largura: 0.3, centroX: 0.66, centroY: 0.5 } },

  // ── Pescoço ──────────────────────────────────────────────
  { id: 'acs_laco', nome: 'Laço', icone: 'bow-tie', categoria: 'acessorio', ancora: 'pescoco', preco: 15,
    imagem: require('../../assets/cosmeticos/laco.png'), proporcao: 2.4064,
    ajuste: { largura: 0.5, centroX: 0.5, centroY: 0.98 } },
  { id: 'acs_colar', nome: 'Colar', icone: 'necklace', categoria: 'acessorio', ancora: 'pescoco', preco: 25,
    imagem: require('../../assets/cosmeticos/colar.png'), proporcao: 1.1044,
    ajuste: { largura: 0.7, centroX: 0.5, centroY: 0.98 } },

  // ── Molduras ─────────────────────────────────────────────
  { id: 'mol_prata', nome: 'Moldura Prata', icone: 'account-circle-outline', categoria: 'moldura', ancora: 'moldura', preco: 20,
    cor: '#C0C0C0', imagem: require('../../assets/cosmeticos/moldura_prata.png'), proporcao: 1, ajuste: AJUSTE_MOLDURA },
  { id: 'mol_ouro', nome: 'Moldura Ouro', icone: 'account-circle-outline', categoria: 'moldura', ancora: 'moldura', preco: 50,
    cor: '#FFD700', imagem: require('../../assets/cosmeticos/moldura_ouro.png'), proporcao: 1, ajuste: AJUSTE_MOLDURA },
  { id: 'mol_diamante', nome: 'Moldura Diamante', icone: 'account-circle-outline', categoria: 'moldura', ancora: 'moldura', preco: 100,
    prestigio: true, animalMinimo: 'gaviao',
    cor: '#4FC3F7', imagem: require('../../assets/cosmeticos/moldura_diamante.png'), proporcao: 1, ajuste: AJUSTE_MOLDURA },
];

export const getCosmetico = (id?: string | null): Cosmetico | undefined =>
  id ? COSMETICOS.find(c => c.id === id) : undefined;

export type EquipadosPorAncora = Partial<Record<AncoraCosmetico, string>>;

// Lê `cosmeticos_equipados` do Firestore. Antes havia um slot por categoria
// (chapeu/acessorio/moldura); esses valores antigos continuam valendo e são
// encaixados na âncora do item. Valores por âncora (gravados agora) vencem.
export const equipadosPorAncora = (cosmeticosEquipados: any): EquipadosPorAncora => {
  const bruto: Record<string, string | null | undefined> = cosmeticosEquipados || {};
  const resultado: EquipadosPorAncora = {};
  for (const legado of ['chapeu', 'acessorio', 'moldura']) {
    const item = getCosmetico(bruto[legado]);
    if (item) resultado[item.ancora] = item.id;
  }
  for (const ancora of Object.keys(LABEL_ANCORA) as AncoraCosmetico[]) {
    if (ancora in bruto && ancora !== 'moldura') {
      const item = getCosmetico(bruto[ancora]);
      if (item) resultado[ancora] = item.id; else delete resultado[ancora];
    }
  }
  return resultado;
};
