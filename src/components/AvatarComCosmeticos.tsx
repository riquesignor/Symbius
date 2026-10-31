import React from 'react';
import { View, Image, Text, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import {
  AncoraCosmetico, Cosmetico, EquipadosPorAncora, equipadosPorAncora, getCosmetico,
} from '../constants/cosmeticos';
import { CORES_SYMBIUS } from '../constants/coresSymbius';
import { F } from '../constants/theme';

// ══════════════════════════════════════════════════════════════════════
// Avatar único do app com cosméticos sobrepostos (PNGs transparentes).
// A caixa do componente tem exatamente `tamanho` x `tamanho` (a foto);
// chapéu, óculos e colar saem dos limites da foto de propósito, então quem
// usa deve deixar folga acima/abaixo quando o avatar é grande.
// ══════════════════════════════════════════════════════════════════════

// Ordem de empilhamento: moldura contorna a foto; chapéu fica por cima de tudo.
const ORDEM: AncoraCosmetico[] = ['moldura', 'pescoco', 'olhos', 'cabeca'];

const uriDaFoto = (foto?: string | null) => {
  if (!foto || typeof foto !== 'string') return null;
  if (foto.startsWith('http') || foto.startsWith('data:') || foto.startsWith('file:')) return foto;
  return `data:image/jpeg;base64,${foto}`;
};

interface Props {
  foto?: string | null;
  tamanho: number;
  /** `cosmeticos_equipados` do usuário, como está no Firestore. */
  cosmeticosEquipados?: any;
  /** Já resolvido por âncora (usado pela Loja no provador). */
  equipados?: EquipadosPorAncora;
  /** Item mostrado no lugar do equipado da mesma âncora (prova na Loja). */
  previaId?: string | null;
  nome?: string;
  corFundo?: string;
  style?: StyleProp<ViewStyle>;
  /** Em avatares muito pequenos dá pra mostrar só a moldura. */
  apenasMoldura?: boolean;
  /** Anel em volta da foto (escondido quando há moldura equipada). */
  borda?: { cor: string; largura: number };
  /** O que mostrar no lugar da foto quando não há foto (ex.: rosto do animal). */
  semFoto?: React.ReactNode;
}

export default function AvatarComCosmeticos({
  foto, tamanho, cosmeticosEquipados, equipados, previaId, nome, corFundo, style, apenasMoldura, borda, semFoto,
}: Props) {
  const porAncora: EquipadosPorAncora = { ...(equipados ?? equipadosPorAncora(cosmeticosEquipados)) };
  const previa = getCosmetico(previaId);
  if (previa) porAncora[previa.ancora] = previa.id;

  const itens = ORDEM
    .filter(a => !apenasMoldura || a === 'moldura')
    .map(a => getCosmetico(porAncora[a]))
    .filter((c): c is Cosmetico => !!c);

  const uri = uriDaFoto(foto);
  const estiloBorda = borda && !porAncora.moldura ? { borderWidth: borda.largura, borderColor: borda.cor } : null;
  const descricao = itens.length
    ? `${nome ? `Foto de ${nome}` : 'Foto de perfil'} usando ${itens.map(i => i.nome.toLowerCase()).join(', ')}`
    : nome ? `Foto de ${nome}` : 'Foto de perfil';

  return (
    <View
      style={[{ width: tamanho, height: tamanho }, styles.raiz, style]}
      accessible
      accessibilityRole="image"
      accessibilityLabel={descricao}
    >
      {uri
        ? <Image source={{ uri }} style={[styles.foto, { width: tamanho, height: tamanho, borderRadius: tamanho / 2 }, estiloBorda]} />
        : semFoto ? <View style={styles.foto}>{semFoto}</View>
        : (
          <View style={[styles.foto, styles.semFoto, { width: tamanho, height: tamanho, borderRadius: tamanho / 2, backgroundColor: corFundo || CORES_SYMBIUS.fundoSuave }, estiloBorda]}>
            <Text style={[styles.inicial, { fontSize: tamanho * 0.4 }]}>{(nome || '?').charAt(0).toUpperCase()}</Text>
          </View>
        )}

      {itens.map(item => {
        const largura = tamanho * item.ajuste.largura;
        const altura = largura / item.proporcao;
        return (
          <Image
            key={item.ancora}
            source={item.imagem}
            resizeMode="contain"
            accessibilityIgnoresInvertColors
            accessibilityElementsHidden
            importantForAccessibility="no"
            style={{
              position: 'absolute',
              width: largura,
              height: altura,
              left: tamanho * item.ajuste.centroX - largura / 2,
              top: tamanho * item.ajuste.centroY - altura / 2,
            }}
          />
        );
      })}
    </View>
  );
}


const styles = StyleSheet.create({
  raiz: { overflow: 'visible' },
  foto: { position: 'absolute', top: 0, left: 0 },
  semFoto: { justifyContent: 'center', alignItems: 'center' },
  inicial: { fontFamily: F.bold, color: CORES_SYMBIUS.verdeEscuro },
});
