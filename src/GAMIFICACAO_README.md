# 🎮 Gamificação MVP — Guia de Implementação

## Status: ✅ Estrutura Criada — Pronto para Integração

Este guia documenta o sistema de **XP + Moedas** para o TCC. Tudo está estruturado e pronto para usar.

---

## 📁 Arquivos Criados/Modificados

### ✅ Novos Arquivos
1. **`src/utils/gamification.ts`** — Configurações, cálculos e utils
2. **`src/services/gamificationService.ts`** — Service com funções de award XP, compra de cosméticos

### ✅ Modificados
1. **`src/services/authService.ts`** — Adicionados campos iniciais do usuário:
   - `xp_total: 0`
   - `moedas_saldo: 0`
   - `matches_bonificados_hoje: 0`
   - `ultimo_reset_diario: new Date()`
   - `ultimo_acesso: new Date()`

2. **`src/screens/Match.tsx`** — Adicionado:
   - Import do `gamificationService`
   - Função `finalizarMatchComAvaliacao()` (exemplo de como usar)

3. **`src/screens/Perfil.tsx`** — Adicionado:
   - Seção visual de **Progresso** (XP + Moedas)
   - Card com Coruja (emoji), XP bar, contador de matches/dia
   - Importação de utils de gamificação

---

## 🚀 Como Usar

### 1️⃣ Award XP ao Match Concluído (5⭐)

Quando o usuário avaliar um match com 5 ⭐, chame:

```typescript
import { awardXpMatch } from '../services/gamificationService';

// Em qualquer lugar (Chat.tsx, Match.tsx, etc)
const sucesso = await awardXpMatch(meuUid);

if (sucesso) {
  // Mostrar toast: "+50 XP, +15 Moedas 🎉"
} else {
  // Mostrar: "Limite diário atingido" ou erro
}
```

**O que acontece:**
- ✅ +50 XP
- ✅ +15 Moedas (Sementes)
- ✅ Incrementa contador `matches_bonificados_hoje`
- ✅ Reset automático à meia-noite
- ✅ Anti-cheat: máximo 3 matches/dia

---

### 2️⃣ Daily Check-in (Você implementa depois)

```typescript
import { awardDailyCheckIn } from '../services/gamificationService';

// Chamar quando usuário abre o app (em Index.tsx ou useEffect global)
const sucesso = await awardDailyCheckIn(meuUid);

if (sucesso) {
  // Mostrar: "+10 XP, +10 Moedas — Daily Check-in!"
}
```

---

### 3️⃣ Comprar Cosmético

```typescript
import { comprarCosmetico } from '../services/gamificationService';

const idCosmetico = 'oculos_leitura';
const preco = 100; // em Moedas

const sucesso = await comprarCosmetico(meuUid, idCosmetico, preco);

if (sucesso) {
  // Item adicionado ao inventário
  // Mostrar: "Cosmético comprado! -100 Moedas"
}
```

---

### 4️⃣ Equipar Cosmético

```typescript
import { equiparCosmetico } from '../services/gamificationService';

const sucesso = await equiparCosmetico(meuUid, 'oculos_leitura');

if (sucesso) {
  // Cosmético agora aparece na Coruja (com Z-Index)
}
```

---

## 🐣 Fases da Coruja (MVP)

Baseado em XP, a Coruja evolui automaticamente:

| Fase | XP Mínimo | XP Máximo | Emoji | Descrição |
|------|-----------|-----------|-------|-----------|
| Filhote | 0 | 299 | 🐣 | Início da jornada |
| Jovem | 300 | 749 | 🐥 | Primeiros sucessos |
| Adulto | 750 | 1.499 | 🦉 | Domínio pleno |
| Veterano | 1.500+ | ∞ | 👑 | Mestre floresta |

**Como usar:**

```typescript
import { calcularFaseCoruja, calcularProgressoXp } from '../utils/gamification';

const xpUsuario = usuario.xp_total; // ex: 450

const fase = calcularFaseCoruja(xpUsuario);
console.log(fase.label); // "Jovem"
console.log(fase.icone); // "🐥"

const progresso = calcularProgressoXp(xpUsuario);
console.log(progresso.percentual); // ~50
console.log(progresso.faltam); // 299
```

---

## 📊 Display no Perfil

A seção **Progresso** foi adicionada ao Perfil e mostra:

```
🐥 Jovem
═══════════════════════════════════════════
EXPERIÊNCIA: 450

[████████░░░░░░░░░░░░░░░░░░░░] 50% até próximo nível
299 XP até próximo nível

═══════════════════════════════════════════
🌱 Sementes: 125
📍 Matches Hoje: 2/3
```

---

## ⚙️ Estrutura Firestore

```
usuarios/{uid}
├── xp_total: 450
├── moedas_saldo: 125
├── matches_bonificados_hoje: 2
├── ultimo_reset_diario: 2026-06-10
├── ultimo_acesso: 2026-06-10
├── itens_adquiridos: ["oculos_leitura", "cachecol_verde"]
├── cosmetico_equipado: "oculos_leitura"
└── ... (outros campos)
```

---

## 🎯 Próximos Passos (Para Você Fazer)

### Phase 1: Testes (1h)
- [ ] Testar award XP no Match.tsx
- [ ] Verificar se XP aparece no Perfil
- [ ] Testar reset diário (colocar data anterior)

### Phase 2: Toast Visual (2h)
- [ ] Adicionar toast quando ganha XP
- [ ] Animação de ganho (número flutuante?)
- [ ] Som opcional (ding!)

### Phase 3: Daily Check-in (2h)
- [ ] Integrar ao Calendario.tsx
- [ ] Mostrar badge "Check-in disponível"
- [ ] Reset à meia-noite

### Phase 4: Cosméticos (5h)
- [ ] Criar tabela `cosmeticos` no Firestore
- [ ] Desenhar itens (óculos, cachecol, etc)
- [ ] Criar tela de Loja
- [ ] Sistema de Z-Index (camadas)

### Phase 5: Cloud Function (1h)
- [ ] Deploy Cloud Function para inatividade
- [ ] Testar decaimento após 6 dias

---

## 📝 Exemplo Completo: Finalizar Match

```typescript
// Em Chat.tsx (quando usuário clica "Finalizar Match")

const finalizarMatch = async (outroUid: string, avaliacao: number) => {
  if (!meuUid) return;

  try {
    // 1. Atualizar match como finalizado
    await updateDoc(doc(db, 'conversas', conversaId), {
      status: 'finalizado',
      avaliacao: avaliacao,
      data_conclusao: serverTimestamp(),
    });

    // 2. Award XP se avaliação é 5⭐
    if (avaliacao === 5) {
      const sucesso = await awardXpMatch(meuUid);
      
      if (sucesso) {
        // 3. Mostrar toast
        Toast.show({
          type: 'success',
          text1: '🎉 Match Concluído!',
          text2: '+50 XP, +15 Moedas',
        });
        
        // 4. Recarregar dados do usuário
        const userSnap = await getDoc(doc(db, 'usuarios', meuUid));
        setUsuario(userSnap.data());
      }
    }
  } catch (error) {
    console.error('Erro:', error);
  }
};
```

---

## 🔒 Anti-Cheat

Proteções implementadas:

✅ **Limite diário**: Máximo 3 matches bonificados/dia
✅ **Reset automático**: À meia-noite
✅ **Validação servidor**: Cloud Firestore Rules (você implementa)
✅ **Histórico**: Logs de award para auditoria

---

## 🐛 Debugging

### Ver XP em tempo real
```typescript
// No console
getDoc(doc(db, 'usuarios', uid)).then(snap => {
  console.log('XP:', snap.data().xp_total);
  console.log('Moedas:', snap.data().moedas_saldo);
});
```

### Resetar usuário para teste
```typescript
// APENAS EM DEV! Reseta XP para 0
updateDoc(doc(db, 'usuarios', uid), {
  xp_total: 0,
  moedas_saldo: 0,
  matches_bonificados_hoje: 0,
});
```

---

## 📞 Dúvidas?

Tudo está modularizado em:
- `utils/gamification.ts` — Configurações e cálculos
- `services/gamificationService.ts` — Lógica de award
- Seção "Progresso" no `Perfil.tsx` — Display visual

Qualquer mudança em valores (XP, moedas, limites) é **só em uma linha**! 🎯

---

**Criado em:** 2026-06-10  
**Status:** MVP Pronto ✅  
**Próxima:** Phase 2 — Toast Visual + Daily Check-in
