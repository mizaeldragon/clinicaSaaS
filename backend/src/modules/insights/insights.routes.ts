import { Router } from 'express';
import { z } from 'zod';
import { riscoDeFalta, resumoDeRisco } from './noShow.service';
import { vagasDoDia } from './gaps.service';
import { resumoDoMes } from './summary.service';
import { validate } from '../../shared/middlewares/validate';
import { PERMISSIONS, requirePermission } from '../../shared/middlewares/rbac';
import { requireModule } from '../../shared/middlewares/moduleGuard';
import { asyncHandler, serialize } from '../../shared/utils/http';

/**
 * Leituras do próprio histórico da empresa.
 *
 * Tudo aqui é cálculo sobre dados que já existem no banco — nada sai para
 * serviço externo e nada é gravado. São consultas caras o suficiente para não
 * caberem numa tela de listagem, e baratas o bastante para rodarem a cada
 * abertura.
 *
 * Ficam no módulo de relatórios porque é a mesma pergunta que os relatórios
 * respondem: o que os meus dados dizem. Quem não tem o módulo não vê.
 */
export const insightsRoutes = Router();

insightsRoutes.use(requireModule('reports'), requirePermission(PERMISSIONS.reportsView));

/** Atendimentos futuros ordenados por risco de falta. */
insightsRoutes.get(
  '/no-show',
  validate({ query: z.object({ dias: z.coerce.number().int().min(1).max(60).optional() }) }),
  asyncHandler(async (req, res) => {
    const { dias } = req.query as unknown as { dias?: number };
    res.json(serialize(await riscoDeFalta({ dias })));
  }),
);

/** A versão curta, para o cartão do painel. */
insightsRoutes.get(
  '/no-show/resumo',
  validate({ query: z.object({ dias: z.coerce.number().int().min(1).max(60).optional() }) }),
  asyncHandler(async (req, res) => {
    const { dias } = req.query as unknown as { dias?: number };
    res.json(serialize(await resumoDeRisco(dias)));
  }),
);

/**
 * O dia pedido, no fuso de quem usa.
 *
 * `new Date('2026-09-19')` é meia-noite em UTC, que no Brasil ainda é dia 18 às
 * 21h — a agenda inteira sairia deslocada um dia. Montando a partir dos
 * pedaços, a data é exatamente a que a pessoa escolheu no calendário.
 */
function diaLocal(texto?: string): Date {
  if (!texto) return new Date();
  const [ano, mes, dia] = texto.split('-').map(Number);
  return new Date(ano, mes - 1, dia);
}

/** Buracos na agenda do dia e quem caberia neles. */
insightsRoutes.get(
  '/encaixes',
  validate({
    query: z.object({
      data: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use o formato 2026-09-19')
        .optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { data } = req.query as { data?: string };
    res.json(serialize(await vagasDoDia(diaLocal(data))));
  }),
);

/** O mês em palavras. Formato `2026-09`; sem parâmetro, o mês corrente. */
insightsRoutes.get(
  '/resumo-do-mes',
  validate({
    query: z.object({
      mes: z
        .string()
        .regex(/^\d{4}-\d{2}$/, 'Use o formato 2026-09')
        .optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { mes } = req.query as { mes?: string };
    const agora = new Date();
    const padrao = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`;
    res.json(serialize(await resumoDoMes(mes ?? padrao)));
  }),
);
