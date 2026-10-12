// ══════════════════════════════════════════════════════════════════════
// Helper pra gerar IDs de documento legíveis no Firestore, a partir de um
// texto (ex: título de post/resumo), em vez do ID aleatório que o addDoc()
// gera por padrão (algo como "aK3x9pQ...").
//
// Formato: slug do texto (minúsculas, sem acento, sem caracteres inválidos
// pra ID de documento do Firestore — principalmente "/") + um sufixo curto
// aleatório, pra evitar colisão quando dois documentos têm o mesmo texto
// (ex: dois posts com o mesmo título) — sem o sufixo, o segundo `setDoc`
// simplesmente sobrescreveria o primeiro silenciosamente.
// ══════════════════════════════════════════════════════════════════════

export const slugify = (texto: string): string => {
  const slug = (texto || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // remove acentos
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return slug || 'sem-titulo';
};

export const gerarIdLegivel = (texto: string): string => {
  const sufixo = Math.random().toString(36).slice(2, 8); // 6 chars aleatórios
  return `${slugify(texto)}-${sufixo}`;
};
