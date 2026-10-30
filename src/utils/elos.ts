// Quem é o "aluno" (quem pediu ajuda e avalia ao finalizar) num elo.
// Quando os dois mandaram pedido um pro outro, existem duas solicitações
// aceitas; vale a mais antiga, pra só uma pessoa finalizar.
export interface SolicitacaoAceita {
  deUid?: string;
  paraUid?: string;
  criadoEm?: { seconds?: number } | null;
}

export const alunoDoElo = (solicitacoes: SolicitacaoAceita[]): string | null => {
  const validas = solicitacoes.filter(s => s.deUid && s.paraUid);
  if (validas.length === 0) return null;
  const maisAntiga = validas.reduce((a, b) =>
    (b.criadoEm?.seconds ?? Infinity) < (a.criadoEm?.seconds ?? Infinity) ? b : a);
  return maisAntiga.deUid ?? null;
};
