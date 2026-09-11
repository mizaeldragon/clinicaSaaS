import crypto from 'node:crypto';
import { logger } from '../utils/logger';

/**
 * Recusa senhas que já apareceram em vazamentos conhecidos.
 *
 * É a defesa contra *credential stuffing*, o ataque que passa por baixo de todo
 * o resto: se a pessoa usa aqui a mesma senha de um site que vazou, o invasor
 * acerta na primeira tentativa — nenhum limite de força bruta chega a disparar,
 * porque não houve erro nenhum.
 *
 * A consulta usa k-anonimato: mandamos apenas os **cinco primeiros** caracteres
 * do SHA-1 da senha e recebemos de volta todos os sufixos que começam assim
 * (uns poucos milhares). A comparação acontece aqui dentro. A senha não sai
 * desta máquina, nem inteira nem em hash completo, e o outro lado não tem como
 * saber qual das milhares era a nossa.
 *
 * Falha em aberto de propósito: se a consulta não responde, a senha passa. O
 * contrário deixaria as pessoas sem conseguir trocar a própria senha por causa
 * de um serviço de terceiro fora do ar — trocar uma senha comprometida é
 * urgente, e o bloqueio seria pior que a falta da checagem.
 */

const ENDPOINT = 'https://api.pwnedpasswords.com/range/';
const TIMEOUT_MS = 3_000;

/**
 * A partir de quantos vazamentos recusar.
 *
 * Uma aparição isolada costuma ser ruído de listas mal montadas. Dez ou mais é
 * senha que está em dicionário de ataque — e é o que o atacante testa primeiro.
 */
const MIN_BREACHES = 10;

export interface BreachCheck {
  breached: boolean;
  /** Quantas vezes apareceu em vazamentos. */
  count: number;
  /** false quando não conseguimos consultar — a senha passou sem checagem. */
  checked: boolean;
}

export async function checkBreachedPassword(password: string): Promise<BreachCheck> {
  const sha1 = crypto.createHash('sha1').update(password).digest('hex').toUpperCase();
  const prefix = sha1.slice(0, 5);
  const suffix = sha1.slice(5);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(`${ENDPOINT}${prefix}`, {
      headers: { 'Add-Padding': 'true', 'User-Agent': 'Belezza' },
      signal: controller.signal,
    });
    if (!response.ok) return { breached: false, count: 0, checked: false };

    const body = await response.text();
    for (const line of body.split('\n')) {
      const [hashSuffix, times] = line.trim().split(':');
      if (hashSuffix === suffix) {
        const count = Number(times) || 0;
        return { breached: count >= MIN_BREACHES, count, checked: true };
      }
    }

    return { breached: false, count: 0, checked: true };
  } catch (error) {
    logger.warn({ error }, 'Não consegui checar vazamento de senha — seguindo sem a checagem');
    return { breached: false, count: 0, checked: false };
  } finally {
    clearTimeout(timer);
  }
}

/** A frase que a pessoa lê quando a senha é recusada. */
export function breachMessage(count: number): string {
  return (
    `Esta senha já apareceu em ${count.toLocaleString('pt-BR')} vazamentos de outros sites ` +
    'e é testada por invasores em primeiro lugar. Escolha outra.'
  );
}
