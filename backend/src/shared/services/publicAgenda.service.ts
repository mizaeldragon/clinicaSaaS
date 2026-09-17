import { prisma } from '../database/prisma';
import { tenantContext } from '../database/tenantContext';
import { emitirParaPaginaPublica } from '../../websocket/io';
import { logger } from '../utils/logger';

/**
 * Avisa quem está com o link de agendamento aberto que a agenda mudou.
 *
 * Quem escuta é o navegador de uma cliente sem login, e a sala é identificada
 * pelo slug — que é justamente o que ela já tem na barra de endereços. Por isso
 * a tradução de `companyId` para slug acontece aqui: quem chama tem o id, quem
 * escuta conhece o slug.
 *
 * O slug de uma empresa quase nunca muda, então fica em memória por alguns
 * minutos. Sem isso, cada agendamento criado custaria uma consulta a mais só
 * para descobrir um texto que já era conhecido.
 */

const CACHE_MS = 5 * 60_000;
const cache = new Map<string, { slug: string | null; ate: number }>();

async function slugDaEmpresa(companyId: string): Promise<string | null> {
  const guardado = cache.get(companyId);
  if (guardado && guardado.ate > Date.now()) return guardado.slug;

  // Sem escopo de inquilino: a busca é pela chave primária da própria empresa,
  // e o contexto nem sempre existe (o webhook e as rotas públicas não têm).
  const empresa = await tenantContext.runUnscoped(() =>
    prisma.company.findUnique({ where: { id: companyId }, select: { slug: true } }),
  );

  const slug = empresa?.slug ?? null;
  cache.set(companyId, { slug, ate: Date.now() + CACHE_MS });
  return slug;
}

/**
 * Dispara o aviso. Nunca joga exceção para cima: um socket que não avisou não
 * pode derrubar o agendamento que a cliente acabou de fazer.
 */
export async function avisarPaginaPublica(companyId: string): Promise<void> {
  try {
    const slug = await slugDaEmpresa(companyId);
    if (slug) emitirParaPaginaPublica(slug);
  } catch (error) {
    logger.warn({ error, companyId }, 'Não consegui avisar a página pública');
  }
}

/** Some com o slug guardado — usado quando a empresa troca de endereço. */
export function esquecerSlug(companyId: string): void {
  cache.delete(companyId);
}
