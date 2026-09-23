import type { ModuleKey } from '@/types';
import { MODULE_LABELS } from './modules';

/**
 * A trilha de auditoria em português de gente.
 *
 * O backend grava a ação como um código (`commission.paid_month`) e a área
 * como o nome da tabela (`Commission`). Isso serve para filtrar e para quem
 * programa; na tela, para quem administra a clínica, é ruído técnico. Aqui cada
 * código vira a frase que descreve o que aconteceu.
 */

const ACOES: Record<string, string> = {
  'company.registered': 'Criou a conta da empresa',
  'company.updated': 'Alterou os dados da empresa',

  'user.created': 'Cadastrou um usuário',
  'user.updated': 'Alterou um usuário',
  'user.deactivated': 'Desativou um usuário',

  'customer.created': 'Cadastrou uma cliente',
  'customer.updated': 'Alterou os dados de uma cliente',
  'customer.removed': 'Excluiu uma cliente',

  'professional.created': 'Cadastrou uma profissional',
  'professional.updated': 'Alterou uma profissional',
  'professional.deactivated': 'Desativou uma profissional',
  'professional.removed': 'Excluiu uma profissional',

  'service.created': 'Cadastrou um serviço',
  'service.updated': 'Alterou um serviço',
  'service.removed': 'Excluiu um serviço',

  'resource.created': 'Cadastrou uma sala ou recurso',
  'resource.removed': 'Excluiu uma sala ou recurso',

  'appointment.created': 'Criou um agendamento',
  'appointment.updated': 'Alterou um agendamento',
  'appointment.removed': 'Excluiu um agendamento',
  'appointment.status.scheduled': 'Voltou um agendamento para agendado',
  'appointment.status.confirmed': 'Confirmou um agendamento',
  'appointment.status.in_progress': 'Iniciou um atendimento',
  'appointment.status.completed': 'Finalizou um atendimento',
  'appointment.status.canceled': 'Cancelou um agendamento',
  'appointment.status.no_show': 'Marcou falta da cliente',

  'financial.created': 'Lançou uma movimentação no caixa',
  'financial.paid': 'Deu baixa em um pagamento',
  'financial.removed': 'Excluiu uma movimentação do caixa',

  'commission.paid': 'Pagou uma comissão',
  'commission.paid_month': 'Pagou as comissões do mês',

  'shift.created': 'Criou um turno de aluguel',
  'rental.created': 'Criou um contrato de aluguel',
  'rental.updated': 'Alterou um contrato de aluguel',
  'rental.removed': 'Encerrou um contrato de aluguel',
  'rental.renter.created': 'Cadastrou uma locatária',
  'rental.payment.paid': 'Recebeu o pagamento de um aluguel',
  'rental.booking.created': 'Reservou um turno de espaço',
  'rental.booking.paid': 'Recebeu o pagamento de um turno',
  'rental.booking.removed': 'Cancelou a reserva de um turno',

  'billing.subscribed': 'Assinou ou mudou de plano',
  'billing.canceled': 'Cancelou a assinatura',
};

const AREAS: Record<string, string> = {
  Company: 'Empresa',
  CompanyModule: 'Módulos',
  User: 'Usuários',
  Customer: 'Clientes',
  Professional: 'Profissionais',
  Service: 'Serviços',
  Resource: 'Salas e recursos',
  Appointment: 'Agenda',
  FinancialTransaction: 'Financeiro',
  Commission: 'Comissões',
  Shift: 'Aluguel',
  Rental: 'Aluguel',
  RentalBooking: 'Aluguel',
  RentalPayment: 'Aluguel',
  Subscription: 'Assinatura',
};

/**
 * O que foi feito, numa frase.
 *
 * Os módulos levam o nome junto ("Ligou o módulo Relatórios") porque o código
 * sozinho não diz qual foi, e é exatamente o que se quer saber.
 *
 * Ação que ainda não está no dicionário — uma nova que alguém adicionar no
 * backend e esquecer daqui — não aparece crua: vira uma frase genérica a
 * partir do verbo e da área, em vez de voltar a mostrar código na tela.
 */
export function descreverAcao(action: string, entity?: string | null, entityId?: string | null): string {
  if (action === 'module.enabled' || action === 'module.disabled') {
    const nome = entityId ? MODULE_LABELS[entityId as ModuleKey] : undefined;
    const verbo = action === 'module.enabled' ? 'Ligou' : 'Desligou';
    return nome ? `${verbo} o módulo ${nome}` : `${verbo} um módulo`;
  }

  const conhecida = ACOES[action];
  if (conhecida) return conhecida;

  const verbo = action.split('.').pop() ?? '';
  const area = nomeDaArea(entity).toLowerCase();
  const generico: Record<string, string> = {
    created: 'Criou um registro',
    updated: 'Alterou um registro',
    removed: 'Excluiu um registro',
    deleted: 'Excluiu um registro',
    paid: 'Registrou um pagamento',
  };
  const frase = generico[verbo] ?? 'Fez uma alteração';
  return area ? `${frase} em ${area}` : frase;
}

/** A parte do sistema onde a ação aconteceu. */
export function nomeDaArea(entity?: string | null): string {
  if (!entity) return '';
  return AREAS[entity] ?? '';
}
