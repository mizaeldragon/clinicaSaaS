import bcrypt from 'bcryptjs';

/**
 * 12 rodadas: cada incremento dobra o custo de quebrar um hash vazado, e 12 é
 * o piso recomendado hoje. O custo fica gravado dentro do próprio hash, então
 * as senhas antigas continuam válidas e migram sozinhas na próxima troca.
 */
const ROUNDS = 12;

/**
 * Hash descartável, do mesmo formato e custo de um real.
 *
 * Serve para gastar o mesmo tempo quando o e-mail não existe: sem isso o login
 * responde na hora para endereço desconhecido e devagar para um cadastrado, e
 * essa diferença sozinha entrega quem tem conta aqui.
 */
const DUMMY_HASH = bcrypt.hashSync('senha-que-nao-existe', ROUNDS);

export async function burnPasswordTime(plain: string): Promise<void> {
  await bcrypt.compare(plain, DUMMY_HASH);
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, ROUNDS);
}

export async function comparePassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
