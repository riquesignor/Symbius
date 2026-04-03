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
  // ===== DEBUG - REMOVER DEPOIS =====
  console.log("=== CADASTRO DEBUG ===");
  console.log("Email:", JSON.stringify(email));
  console.log("Senha length:", senha?.length);
  console.log("Senha undefined?", senha === undefined);
  console.log("Senha null?", senha === null);
  // ==================================

  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, senha);
    const user = userCredential.user;

    await sendEmailVerification(user);

    const eAluno = perfilTipo.toLowerCase() === 'aluno';

    const dadosUsuario = {
      nome_completo: nome,
      email_escolar: email.toLowerCase().trim(),
      ra: ra.toUpperCase().trim() || null,
      tipo: perfilTipo, 
      turma: turmaFormatada,
      status: 0,
      ensinar: eAluno ? [] : null,
      melhorar: eAluno ? [] : null,
      ajudas_realizadas: eAluno ? 0 : null,
      foto: null, 
      bio: "",
    };

    await setDoc(doc(db, "usuarios", user.uid), dadosUsuario);
    await signOut(auth);

    return user;
  } catch (error: any) {
    console.log("=== ERRO DEBUG ===", error.code, error.message);
    if (error.code === 'auth/email-already-in-use') {
      throw new Error('Esse e-mail já está cadastrado!');
    } else if (error.code === 'auth/weak-password') {
      throw new Error('A senha deve ter pelo menos 6 caracteres.');
    }
    throw error;
  }
};