import crypto from 'node:crypto';
import { env } from '../../config/env';

/**
 * Cifra simétrica para segredos que precisam voltar ao texto original.
 *
 * Senha vira hash e nunca volta — mas o segredo do segundo fator precisa ser
 * lido a cada login para conferir o código de seis dígitos. Guardá-lo em texto
 * puro faria do banco uma cópia dos autenticadores de todo mundo: quem
 * conseguisse um dump entraria em qualquer conta, mesmo com 2FA ligado.
 *
 * AES-256-GCM: além de cifrar, a etiqueta de autenticação denuncia qualquer
 * alteração no texto cifrado. A chave sai do `ENCRYPTION_KEY`; sem ela,
 * derivamos do `REFRESH_TOKEN_SECRET` para a instalação funcionar de cara —
 * mas em produção vale definir a própria, porque trocar o segredo do refresh
 * passaria a inutilizar todos os segundos fatores.
 */

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const SALT = 'belezza.encryption.v1';

let cachedKey: Buffer | null = null;

function key(): Buffer {
  if (cachedKey) return cachedKey;
  const material = env.ENCRYPTION_KEY || env.REFRESH_TOKEN_SECRET;
  cachedKey = crypto.scryptSync(material, SALT, 32);
  return cachedKey;
}

/** Formato guardado: `iv.etiqueta.textoCifrado`, tudo em base64url. */
export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, key(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, encrypted].map((part) => part.toString('base64url')).join('.');
}

/** Devolve null em vez de estourar: segredo ilegível é 2FA a reconfigurar. */
export function decryptSecret(stored: string): string | null {
  try {
    const [ivPart, tagPart, dataPart] = stored.split('.');
    if (!ivPart || !tagPart || !dataPart) return null;

    const decipher = crypto.createDecipheriv(
      ALGORITHM,
      key(),
      Buffer.from(ivPart, 'base64url'),
    );
    decipher.setAuthTag(Buffer.from(tagPart, 'base64url'));

    return Buffer.concat([
      decipher.update(Buffer.from(dataPart, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  } catch {
    return null;
  }
}

/**
 * Compara dois textos em tempo constante.
 *
 * `===` sai no primeiro caractere diferente, e essa diferença de tempo, medida
 * muitas vezes, entrega o valor esperado caractere a caractere.
 */
export function safeEqual(a: string, b: string): boolean {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  if (bufferA.length !== bufferB.length) return false;
  return crypto.timingSafeEqual(bufferA, bufferB);
}
