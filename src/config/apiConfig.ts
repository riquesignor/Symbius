// URL base do backend (Vercel Function) que envia os pushes.
// Local: roda `vercel dev` na raiz do projeto (porta padrão 3000) — em
// dispositivo físico, troca 'localhost' pelo IP da sua máquina na rede
// (ex: 'http://192.168.0.10:3000'), já que "localhost" no celular aponta
// pra ele mesmo, não pro seu computador.
export const API_BASE_URL = __DEV__
  ? 'http://localhost:3000'
  : 'https://symbius-seven.vercel.app';
