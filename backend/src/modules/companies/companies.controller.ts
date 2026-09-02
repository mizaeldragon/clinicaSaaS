import { Request, Response } from 'express';
import { companiesService } from './companies.service';
import { serialize } from '../../shared/utils/http';
import { recordAudit } from '../../shared/services/audit.service';

function companyId(req: Request): string {
  return req.companyId as string;
}

export const companiesController = {
  async show(req: Request, res: Response) {
    res.json(serialize(await companiesService.get(companyId(req))));
  },

  async update(req: Request, res: Response) {
    const before = await companiesService.get(companyId(req));
    const company = await companiesService.update(companyId(req), req.body);
    await recordAudit({
      action: 'company.updated',
      entity: 'Company',
      entityId: company.id,
      before: { name: before.name, primaryColor: before.primaryColor },
      after: req.body,
      userName: req.user?.id,
      ip: req.ip,
    });
    res.json(serialize(company));
  },

  async businessHours(req: Request, res: Response) {
    const hours = await companiesService.setBusinessHours(companyId(req), req.body);
    res.json(serialize(hours));
  },

  async listModules(req: Request, res: Response) {
    res.json(serialize(await companiesService.listModules(companyId(req))));
  },

  async toggleModule(req: Request, res: Response) {
    const modules = await companiesService.toggleModule(companyId(req), req.body);
    await recordAudit({
      action: req.body.enabled ? 'module.enabled' : 'module.disabled',
      entity: 'CompanyModule',
      entityId: req.body.module,
      after: req.body,
      ip: req.ip,
    });
    res.json(serialize(modules));
  },
};
