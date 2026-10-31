import type { Animal } from '../utils/gamification';

// Ilustrações low-poly dos 5 animais (assets/animais).
export const IMG_ANIMAL: Record<Animal, any> = {
  coruja:   require('../../assets/animais/coruja.png'),
  raposa:   require('../../assets/animais/raposa.png'),
  gaviao:   require('../../assets/animais/gaviao.png'),
  leopardo: require('../../assets/animais/leopardo.png'),
  tubarao:  require('../../assets/animais/tubarao.png'),
};

// Retratos (só o rosto) usados nas bolinhas pequenas. Animais sem retrato
// ainda usam o corpo inteiro.
export const IMG_ANIMAL_ROSTO: Partial<Record<Animal, any>> = {
  coruja: require('../../assets/animais/coruja_rosto.png'),
  raposa: require('../../assets/animais/raposa_rosto.png'),
};
