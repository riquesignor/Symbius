import { auth, db } from '../config/firebaseConfig';
import { 
  createUserWithEmailAndPassword, 
  sendEmailVerification, 
  signOut 
} from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';

export const cadastrarNoSymbius = async (
  email: string, 
  senha: string, 
  nome: string, 
  ra: string, 
  turmaFormatada: string, 
  perfilTipo: string
) => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, senha);
    const user = userCredential.user;

    await sendEmailVerification(user);

    const eAluno = perfilTipo.toLowerCase() === 'aluno';

    const dadosUsuario = {
      nome_completo: nome,
      email_escolar: email.toLowerCase().trim(),
      // ✅ CAMPO SENHA SALVO NO FIRESTORE para que o login funcione
      // mesmo quando a senha for redefinida manualmente no banco.
      senha: senha,
      ra: ra.toUpperCase().trim() || null,
      tipo: perfilTipo,
      turma: turmaFormatada,
      status: 0,
      ensinar: eAluno ? [] : null,
      melhorar: eAluno ? [] : null,
      ajudas_realizadas: eAluno ? 0 : null,
      foto: null,
      bio: "",
      // ✅ GAMIFICAÇÃO — Inicializa XP, Moedas e tracker diário
      xp_total: 0,
      moedas_saldo: 0,
      matches_bonificados_hoje: 0,
      ultimo_reset_diario: new Date(),
      ultimo_acesso: new Date(),
      perfil_publico_xp: false, // Privado por padrão
    };

    await setDoc(doc(db, "usuarios", user.uid), dadosUsuario);

    // ✅ Desloga do Firebase Auth após cadastro — o login será feito via Firestore
    await signOut(auth);

    return user;
  } catch (error: any) {
    if (error.code === 'auth/email-already-in-use') {
      throw new Error('Esse e-mail já está cadastrado!');
    } else if (error.code === 'auth/weak-password') {
      throw new Error('A senha deve ter pelo menos 6 caracteres.');
    }
    throw error;
  }
};
