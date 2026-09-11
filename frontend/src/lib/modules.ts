import type { ModuleKey } from '@/types';

/**
 * Nome de cada módulo em português.
 *
 * `ModuleKey` é o identificador interno (`appointments`, `rentals`…) e nunca
 * deve chegar à tela: quem administra planos e empresas lê "Agenda" e "Aluguel
 * de espaços", não o nome da coluna no banco. Este mapa é a única tradução —
 * se um módulo novo aparecer, o TypeScript cobra a entrada aqui.
 */
export const MODULE_LABELS: Record<ModuleKey, string> = {
  appointments: 'Agenda',
  customers: 'Clientes',
  professionals: 'Profissionais',
  services: 'Serviços',
  financial: 'Financeiro',
  commissions: 'Comissões',
  resources: 'Salas e recursos',
  rentals: 'Aluguel de espaços',
  reports: 'Relatórios',
  notifications: 'Notificações',
};

/** Uma frase curta sobre o que cada módulo entrega. */
export const MODULE_HINTS: Record<ModuleKey, string> = {
  appointments: 'Agenda por dia, semana e mês, sem choque de horário',
  customers: 'Cadastro, histórico e ficha de cada cliente',
  professionals: 'Equipe, horários de trabalho e folgas',
  services: 'Catálogo de serviços, preços e duração',
  financial: 'Caixa, contas a pagar e a receber',
  commissions: 'Percentual da equipe, calculado no atendimento',
  resources: 'Salas, cadeiras e macas com controle de ocupação',
  rentals: 'Locação de espaço por turno ou diária',
  reports: 'Faturamento, ocupação e desempenho',
  notifications: 'Lembretes e avisos para a equipe e as clientes',
};

/** A ordem em que os módulos aparecem nas listas. */
export const ALL_MODULES = Object.keys(MODULE_LABELS) as ModuleKey[];

/** Rótulo de um módulo; cai no identificador se algum dia vier um desconhecido. */
export function moduleLabel(module: string): string {
  return MODULE_LABELS[module as ModuleKey] ?? module;
}
