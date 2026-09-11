import crypto from 'node:crypto';
import { generateSecret, generateURI, verifySync } from 'otplib';
import { prisma } from '../../shared/database/prisma';
import { tenantContext } from '../../shared/database/tenantContext';
import { BadRequestError, NotFoundError, UnauthorizedError } from '../../shared/errors/AppError';
import { comparePassword } from '../../shared/utils/hash';
import { decryptSecret, encryptSecret } from '../../shared/utils/crypto';
import { hashRefreshToken } from '../../shared/utils/jwt';
import { invalidateUserContext } from '../../shared/services/userContext.service';

/**
 * Segundo fator por aplicativo (TOTP).
 *
 * É a resposta para o ataque que nenhum dos outros controles alcança: a senha
 * ser roubada. Um site falso, um vazamento de outro serviço onde a pessoa
 * repetiu a senha, um programa espião no computador — em todos, a senha vai
 * embora e o resto das defesas continua funcionando perfeitamente enquanto o
 * invasor entra. Com o segundo fator, saber a senha deixa de ser suficiente.
 *
 * O segredo fica cifrado no banco e os códigos de recuperação, em hash. Um
 * dump do banco não abre a conta de ninguém.
 */

/**
 * Trinta segundos de folga para cada lado — um passo do TOTP.
 *
 * O relógio do celular quase nunca está perfeitamente sincronizado com o do
 * servidor, e sem essa tolerância a pessoa digitaria o código certo e levaria
 * erro. Mais que isso alargaria demais a vida útil de cada código.
 */
const TOLERANCIA_SEGUNDOS = 30;

/**
 * Confere um código de seis dígitos contra o segredo da conta.
 *
 * A biblioteca joga exceção para qualquer coisa que não sejam seis dígitos, e
 * aqui chega também código de recuperação (`a1b2-c3d4`). Por isso a triagem
 * vem antes: o que não tem cara de TOTP simplesmente não é TOTP, e segue para
 * a conferência dos códigos de recuperação em vez de derrubar o login.
 */
function checkTotp(secret: string, token: string): boolean {
  if (!/^\d{6}$/.test(token)) return false;
  try {
    return verifySync({ secret, token, epochTolerance: TOLERANCIA_SEGUNDOS }).valid;
  } catch {
    return false;
  }
}

const RECOVERY_CODE_COUNT = 8;

/** `a1b2-c3d4`: curto de digitar e fácil de copiar do papel. */
function newRecoveryCode(): string {
  const raw = crypto.randomBytes(4).toString('hex');
  return `${raw.slice(0, 4)}-${raw.slice(4)}`;
}

async function loadUser(userId: string) {
  const user = await tenantContext.runAsSystem(() =>
    prisma.user.findUnique({ where: { id: userId } }),
  );
  if (!user) throw new NotFoundError('Usuário');
  return user;
}

export const twoFactorService = {
  /**
   * Passo 1: gera o segredo e devolve o endereço que vira QR Code.
   *
   * Ainda não liga nada — só depois de a pessoa provar que o aplicativo está
   * gerando os códigos certos. Ligar antes trancaria quem digitou errado ou
   * fechou a tela no meio.
   */
  async begin(userId: string) {
    const user = await loadUser(userId);
    if (user.twoFactorEnabledAt) {
      throw new BadRequestError('O segundo fator já está ativo nesta conta.');
    }

    const secret = generateSecret();

    await tenantContext.runAsSystem(() =>
      prisma.user.update({
        where: { id: userId },
        data: { twoFactorSecret: encryptSecret(secret), twoFactorEnabledAt: null },
      }),
    );

    return {
      secret,
      // O nome da conta aparece dentro do aplicativo; o e-mail evita confusão
      // para quem administra mais de uma empresa.
      otpauthUrl: generateURI({ secret, label: user.email, issuer: 'Belezza' }),
    };
  },

  /** Passo 2: confere o primeiro código e liga, devolvendo os de recuperação. */
  async enable(userId: string, code: string) {
    const user = await loadUser(userId);
    if (user.twoFactorEnabledAt) {
      throw new BadRequestError('O segundo fator já está ativo nesta conta.');
    }
    if (!user.twoFactorSecret) {
      throw new BadRequestError('Comece a configuração antes de confirmar o código.');
    }

    const secret = decryptSecret(user.twoFactorSecret);
    if (!secret || !checkTotp(secret, code.trim())) {
      throw new BadRequestError('Código inválido. Confira o relógio do celular e tente de novo.');
    }

    const codes = Array.from({ length: RECOVERY_CODE_COUNT }, newRecoveryCode);

    await tenantContext.runAsSystem(async () => {
      await prisma.recoveryCode.deleteMany({ where: { userId } });
      await prisma.recoveryCode.createMany({
        data: codes.map((value) => ({ userId, codeHash: hashRefreshToken(value) })),
      });
      await prisma.user.update({
        where: { id: userId },
        data: { twoFactorEnabledAt: new Date() },
      });
    });

    invalidateUserContext(userId);

    // Só desta vez. Daqui em diante existe apenas o hash.
    return { recoveryCodes: codes };
  },

  /**
   * Desligar exige senha E código. Se bastasse a sessão aberta, quem roubasse
   * um notebook destrancado removeria a proteção em dois cliques.
   */
  async disable(userId: string, password: string, code: string) {
    const user = await loadUser(userId);
    if (!user.twoFactorEnabledAt) {
      throw new BadRequestError('O segundo fator não está ativo nesta conta.');
    }

    if (!(await comparePassword(password, user.passwordHash))) {
      throw new BadRequestError('Senha incorreta.');
    }

    const ok = await this.verifyCode(userId, code);
    if (!ok) throw new BadRequestError('Código inválido.');

    await tenantContext.runAsSystem(async () => {
      await prisma.recoveryCode.deleteMany({ where: { userId } });
      await prisma.user.update({
        where: { id: userId },
        data: { twoFactorSecret: null, twoFactorEnabledAt: null },
      });
    });

    invalidateUserContext(userId);
  },

  /**
   * Confere um código do aplicativo ou um de recuperação.
   *
   * O de recuperação é consumido no uso: é a saída de quem perdeu o celular, e
   * um código que continuasse valendo viraria uma segunda senha permanente,
   * escrita num papel.
   */
  async verifyCode(userId: string, code: string): Promise<boolean> {
    const user = await loadUser(userId);
    if (!user.twoFactorSecret) return false;

    const clean = code.trim().toLowerCase().replace(/\s/g, '');

    const secret = decryptSecret(user.twoFactorSecret);
    if (secret && checkTotp(secret, clean.replace(/-/g, ''))) return true;

    const recovery = await tenantContext.runAsSystem(() =>
      prisma.recoveryCode.findUnique({ where: { codeHash: hashRefreshToken(clean) } }),
    );
    if (!recovery || recovery.usedAt || recovery.userId !== userId) return false;

    await tenantContext.runAsSystem(() =>
      prisma.recoveryCode.update({ where: { id: recovery.id }, data: { usedAt: new Date() } }),
    );
    return true;
  },

  /** Quantos códigos de recuperação ainda restam — o painel avisa quando acaba. */
  async status(userId: string) {
    const user = await loadUser(userId);
    const remaining = user.twoFactorEnabledAt
      ? await tenantContext.runAsSystem(() =>
          prisma.recoveryCode.count({ where: { userId, usedAt: null } }),
        )
      : 0;

    return {
      enabled: Boolean(user.twoFactorEnabledAt),
      enabledAt: user.twoFactorEnabledAt,
      recoveryCodesLeft: remaining,
    };
  },

  /** Gera um jogo novo, invalidando o anterior. */
  async regenerateRecoveryCodes(userId: string, code: string) {
    const user = await loadUser(userId);
    if (!user.twoFactorEnabledAt) {
      throw new BadRequestError('O segundo fator não está ativo nesta conta.');
    }
    if (!(await this.verifyCode(userId, code))) {
      throw new UnauthorizedError('Código inválido.');
    }

    const codes = Array.from({ length: RECOVERY_CODE_COUNT }, newRecoveryCode);

    await tenantContext.runAsSystem(async () => {
      await prisma.recoveryCode.deleteMany({ where: { userId } });
      await prisma.recoveryCode.createMany({
        data: codes.map((value) => ({ userId, codeHash: hashRefreshToken(value) })),
      });
    });

    return { recoveryCodes: codes };
  },
};
