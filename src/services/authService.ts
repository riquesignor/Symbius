import { auth, db } from '../config/firebaseConfig';
import { 
  createUserWithEmailAndPassword, 
  sendEmailVerification, 
  signOut 
} from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';

export const cadastrarNoJumo = async (
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

    // CORREÇÃO: Aceita 'Aluno' ou 'aluno' para não bugar a criação dos arrays
    const eAluno = perfilTipo.toLowerCase() === 'aluno';

    // Monta o objeto com a NOVA ESTRUTURA
    const dadosUsuario = {
      nome_completo: nome,
      email_escolar: email.toLowerCase().trim(),
      ra: ra.toUpperCase().trim() || null,
      tipo: perfilTipo, 
      turma: turmaFormatada,
      status: 0, // 0 = Pendente, 1 = Ativo, 2 = Suspenso
      
      // Novos campos blindados contra crash no perfil
      ensinar: eAluno ? [] : null,
      melhorar: eAluno ? [] : null,
      ajudas_realizadas: eAluno ? 0 : null,
      
      foto: null, 
      bio: "",
    };

    // Salva na coleção correta
    await setDoc(doc(db, "usuarios", user.uid), dadosUsuario);

    // BLOQUEIO: Desloga imediatamente após criar
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