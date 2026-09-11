import { Request, Response } from 'express';
import { authService } from './auth.service';
import { twoFactorService } from './twoFactor.service';
import { UnauthorizedError } from '../../shared/errors/AppError';
import { serialize } from '../../shared/utils/http';
import { recordAudit } from '../../shared/services/audit.service';

function meta(req: Request) {
  return { userAgent: req.headers['user-agent'] ?? null, ip: req.ip ?? null };
}

export const authController = {
  async login(req: Request, res: Response) {
    const result = await authService.login(req.body, meta(req));
    res.json(serialize(result));
  },

  async register(req: Request, res: Response) {
    const result = await authService.registerCompany(req.body, meta(req));
    await recordAudit({
      companyId: result.user.companyId,
      userId: result.user.id,
      userName: result.user.name,
      action: 'company.registered',
      entity: 'Company',
      entityId: result.user.companyId,
      ip: req.ip,
    });
    res.status(201).json(serialize(result));
  },

  async refresh(req: Request, res: Response) {
    const result = await authService.refresh(req.body.refreshToken, meta(req));
    res.json(serialize(result));
  },

  async logout(req: Request, res: Response) {
    const token = req.body?.refreshToken as string | undefined;
    if (token) await authService.logout(token);
    res.status(204).send();
  },

  async logoutAll(req: Request, res: Response) {
    if (!req.user) throw new UnauthorizedError();
    await authService.logoutAll(req.user.id);
    res.status(204).send();
  },

  async changePassword(req: Request, res: Response) {
    if (!req.user) throw new UnauthorizedError();
    await authService.changePassword(req.user.id, req.body);
    res.status(204).send();
  },

  async forgotPassword(req: Request, res: Response) {
    await authService.forgotPassword(req.body);
    // 204 sempre — ver auth.service.forgotPassword: a resposta não pode
    // revelar se o e-mail tem conta.
    res.status(204).send();
  },

  async resetPassword(req: Request, res: Response) {
    await authService.resetPassword(req.body);
    res.status(204).send();
  },

  // ------------------------------------------------------- segundo fator
  async twoFactorLogin(req: Request, res: Response) {
    const result = await authService.completeTwoFactorLogin(
      req.body.challengeToken,
      req.body.code,
      meta(req),
    );
    res.json(serialize(result));
  },

  async twoFactorStatus(req: Request, res: Response) {
    if (!req.user) throw new UnauthorizedError();
    res.json(serialize(await twoFactorService.status(req.user.id)));
  },

  async twoFactorBegin(req: Request, res: Response) {
    if (!req.user) throw new UnauthorizedError();
    res.json(serialize(await twoFactorService.begin(req.user.id)));
  },

  async twoFactorEnable(req: Request, res: Response) {
    if (!req.user) throw new UnauthorizedError();
    res.json(serialize(await twoFactorService.enable(req.user.id, req.body.code)));
  },

  async twoFactorDisable(req: Request, res: Response) {
    if (!req.user) throw new UnauthorizedError();
    await twoFactorService.disable(req.user.id, req.body.password, req.body.code);
    res.status(204).send();
  },

  async twoFactorRecoveryCodes(req: Request, res: Response) {
    if (!req.user) throw new UnauthorizedError();
    res.json(
      serialize(await twoFactorService.regenerateRecoveryCodes(req.user.id, req.body.code)),
    );
  },

  async me(req: Request, res: Response) {
    if (!req.user) throw new UnauthorizedError();
    const context = await authService.context(req.user.id);
    res.json(serialize(context));
  },
};
