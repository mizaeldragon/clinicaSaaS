import type { ModuleKey, Plan } from '@prisma/client';
import { prisma } from '../../shared/database/prisma';
import { tenantContext } from '../../shared/database/tenantContext';
import { NotFoundError } from '../../shared/errors/AppError';
import { invalidateCompanyContext } from '../../shared/services/companyContext.service';
import { CORE_MODULES } from './company.constants';

/**
 * Troca o plano de uma empresa e acerta os módulos dela. Uma regra só, usada
 * pela dona (Configurações → Plano) e pelo super admin (Empresas → Mudar plano).
 *
 * Desliga o que o plano novo não tem, menos os módulos essenciais. E liga o
 * que ele trouxe: antes a troca só desligava, e quem subia do Starter para o
 * Pro pagava pelo Pro sem ver Comissões nem Relatórios no menu.
 *
 * "O que ele trouxe" é o que está no plano novo e não estava no antigo. Um
 * módulo que os dois planos têm e a dona desligou de propósito continua
 * desligado — trocar de plano não é motivo para desfazer a escolha dela.
 */
export async function trocarPlano(companyId: string, plan: Plan) {
  return tenantContext.runAsSystem(async () => {
    const subscription = await prisma.subscription.findUnique({
      where: { companyId },
      include: { plan: true },
    });
    if (!subscription) throw new NotFoundError('Assinatura');

    const ligados = await prisma.companyModule.findMany({ where: { companyId, enabled: true } });
    const desligar = ligados
      .map((m) => m.module)
      .filter((m) => !plan.modules.includes(m) && !CORE_MODULES.includes(m));
    const ligar: ModuleKey[] = plan.modules.filter(
      (m) => !subscription.plan.modules.includes(m),
    );

    await prisma.$transaction([
      prisma.subscription.update({ where: { companyId }, data: { planId: plan.id } }),
      prisma.companyModule.updateMany({
        where: { companyId, module: { in: desligar } },
        data: { enabled: false },
      }),
      ...ligar.map((module) =>
        prisma.companyModule.upsert({
          where: { companyId_module: { companyId, module } },
          create: { companyId, module, enabled: true },
          update: { enabled: true },
        }),
      ),
    ]);

    invalidateCompanyContext(companyId);
    return { plan, disabledModules: desligar, enabledModules: ligar };
  });
}
