import { Animal } from '../utils/gamification';

export type CategoriaCosmetico = 'chapeu' | 'acessorio' | 'moldura';

export interface Cosmetico {
  id: string;
  nome: string;
  /** Nome do ícone (MaterialCommunityIcons) usado como arte do item. */
  icone: string;
  categoria: CategoriaCosmetico;
  preco: number;
  /** Itens de prestígio só ficam disponíveis pra compra após alcançar um animal mínimo. */
  prestigio?: boolean;
  animalMinimo?: Animal;
  /** Só usado por itens de categoria 'moldura' (cor da borda do avatar). */
  cor?: string;
}

export const LABEL_CATEGORIA: Record<CategoriaCosmetico, string> = {
  chapeu:    'Chapéus',
  acessorio: 'Acessórios',
  moldura:   'Molduras',
};

export const COSMETICOS: Cosmetico[] = [
  // ── Chapéus ──────────────────────────────────────────────
  { id: 'chapeu_bone',      nome: 'Boné',           icone: 'account-cowboy-hat', categoria: 'chapeu', preco: 15 },
  { id: 'chapeu_cartola',   nome: 'Cartola',        icone: 'hat-fedora', categoria: 'chapeu', preco: 30 },
  { id: 'chapeu_capelo',    nome: 'Capelo',         icone: 'school', categoria: 'chapeu', preco: 40 },
  { id: 'chapeu_coroa',     nome: 'Coroa Real',     icone: 'crown', categoria: 'chapeu', preco: 80, prestigio: true, animalMinimo: 'tubarao' },

  // ── Acessórios ───────────────────────────────────────────
  { id: 'acs_oculos',       nome: 'Óculos Escuros', icone: 'sunglasses', categoria: 'acessorio', preco: 20 },
  { id: 'acs_laco',         nome: 'Laço',           icone: 'bow-tie', categoria: 'acessorio', preco: 15 },
  { id: 'acs_colar',        nome: 'Colar',          icone: 'necklace', categoria: 'acessorio', preco: 25 },
  { id: 'acs_monoculo',     nome: 'Monóculo de Sábio', icone: 'glasses', categoria: 'acessorio', preco: 60, prestigio: true, animalMinimo: 'leopardo' },

  // ── Molduras (cor da borda do avatar) ───────────────────
  { id: 'mol_prata',        nome: 'Moldura Prata',   icone: 'account-circle-outline', categoria: 'moldura', preco: 20,  cor: '#C0C0C0' },
  { id: 'mol_ouro',         nome: 'Moldura Ouro',    icone: 'account-circle-outline', categoria: 'moldura', preco: 50,  cor: '#FFD700' },
  { id: 'mol_diamante',     nome: 'Moldura Diamante', icone: 'account-circle-outline', categoria: 'moldura', preco: 100, prestigio: true, animalMinimo: 'gaviao', cor: '#4FC3F7' },
];

export const getCosmetico = (id?: string | null): Cosmetico | undefined =>
  id ? COSMETICOS.find(c => c.id === id) : undefined;