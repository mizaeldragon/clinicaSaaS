import { AppointmentStatus, AppointmentSource } from '@prisma/client';
import { prisma } from '../../shared/database/prisma';

/**
 * Risco de falta: quem provavelmente não vem.
 *
 * Não é um modelo treinado, e isso é de propósito. A pergunta — "esta cliente
 * vem?" — já está respondida no histórico dela, e um salão tem dezenas de
 * atendimentos por mês, não milhões. Estatística simples sobre os dados da
 * própria empresa acerta mais que um modelo genérico, roda em milissegundos e,
 * o que mais importa, **é explicável**: a recepção só liga para confirmar se
 * entender por que aquele horário foi marcado.
 *
 * A conta tem três camadas:
 *
 * 1. A taxa de falta da própria empresa, que é o ponto de partida.
 * 2. A taxa da cliente, encolhida em direção à da empresa — quem tem duas
 *    visitas não merece o mesmo peso de quem tem trinta.
 * 3. Ajustes pequenos por antecedência, origem e confirmação, cada um limitado
 *    para nenhum sozinho dominar o resultado.
 */

/** Só estes contam como "passou e sabemos o que aconteceu". */
const CONCLUIDOS: AppointmentStatus[] = [AppointmentStatus.COMPLETED, AppointmentStatus.NO_SHOW];

/** Ainda vai acontecer — são estes que recebem nota. */
const FUTUROS: AppointmentStatus[] = [AppointmentStatus.SCHEDULED, AppointmentStatus.CONFIRMED];

/**
 * Peso do encolhimento.
 *
 * Uma cliente com 1 falta em 2 visitas não tem 50% de risco: tem pouco
 * histórico. O K faz a taxa dela começar colada na da empresa e só se soltar
 * conforme as visitas se acumulam. Em 4, a opinião dela já vale metade.
 */
const K = 4;

/** Abaixo disso a empresa não tem histórico suficiente para uma taxa própria. */
const MINIMO_PARA_TAXA_PROPRIA = 12;

/** O que vale quando nem a empresa tem histórico. Média de mercado do setor. */
const TAXA_PADRAO = 0.2;

export type FaixaDeRisco = 'baixo' | 'medio' | 'alto';

export interface MotivoDoRisco {
  /** Frase pronta para a tela. */
  texto: string;
  /** Para onde empurrou: cima piora, baixo melhora. */
  direcao: 'cima' | 'baixo';
}

export interface RiscoDeFalta {
  appointmentId: string;
  startsAt: Date;
  customer: { id: string; name: string; phone: string | null };
  professional: { id: string; name: string } | null;
  servico: string | null;
  valor: number;
  /** 0 a 1. */
  risco: number;
  faixa: FaixaDeRisco;
  motivos: MotivoDoRisco[];
  /** Quantos atendimentos passados desta cliente entraram na conta. */
  historico: { total: number; faltas: number };
}

/** Converte probabilidade em chance e volta — é onde os ajustes se aplicam. */
function paraChance(p: number): number {
  return p / (1 - p);
}

function paraProbabilidade(chance: number): number {
  return chance / (1 + chance);
}

function faixaDe(risco: number): FaixaDeRisco {
  if (risco >= 0.45) return 'alto';
  if (risco >= 0.25) return 'medio';
  return 'baixo';
}

function porcento(p: number): string {
  return `${Math.round(p * 100)}%`;
}

/**
 * A nota de um atendimento futuro.
 *
 * Exportada separada do banco para poder ser testada com números na mão.
 */
export function calcularRisco(entrada: {
  taxaDaEmpresa: number;
  faltasDaCliente: number;
  totalDaCliente: number;
  /** Falhou na última vez que esteve marcada? */
  faltouNaUltima: boolean;
  /** Dias entre a marcação e o atendimento. */
  antecedenciaEmDias: number;
  origem: AppointmentSource;
  confirmado: boolean;
}): { risco: number; motivos: MotivoDoRisco[] } {
  const motivos: MotivoDoRisco[] = [];

  // 1. A taxa da cliente, encolhida em direção à da empresa.
  const taxaCliente =
    (entrada.faltasDaCliente + entrada.taxaDaEmpresa * K) / (entrada.totalDaCliente + K);

  if (entrada.totalDaCliente === 0) {
    motivos.push({ texto: 'Primeira vez — sem histórico para avaliar', direcao: 'cima' });
  } else if (entrada.faltasDaCliente === 0) {
    motivos.push({
      texto: `Nunca faltou em ${entrada.totalDaCliente} ${entrada.totalDaCliente === 1 ? 'atendimento' : 'atendimentos'}`,
      direcao: 'baixo',
    });
  } else {
    motivos.push({
      texto: `Faltou ${entrada.faltasDaCliente} de ${entrada.totalDaCliente} vezes`,
      direcao: entrada.faltasDaCliente / entrada.totalDaCliente > entrada.taxaDaEmpresa ? 'cima' : 'baixo',
    });
  }

  let chance = paraChance(Math.min(0.95, Math.max(0.02, taxaCliente)));

  // 2. A última vez pesa mais que a média. Quem faltou no último horário está
  //    num momento diferente de quem faltou há um ano.
  if (entrada.faltouNaUltima) {
    chance *= 1.6;
    motivos.push({ texto: 'Faltou no último horário marcado', direcao: 'cima' });
  }

  // 3. Antecedência. O que marca com muita antecedência esquece; o que marca
  //    para hoje ou amanhã ainda tem a decisão fresca.
  if (entrada.antecedenciaEmDias >= 21) {
    chance *= 1.35;
    motivos.push({ texto: 'Marcado com mais de três semanas de antecedência', direcao: 'cima' });
  } else if (entrada.antecedenciaEmDias <= 1) {
    chance *= 0.7;
    motivos.push({ texto: 'Marcado em cima da hora', direcao: 'baixo' });
  }

  // 4. Origem. Quem marcou sozinha pelo link não falou com ninguém — nada
  //    ancora o compromisso.
  if (entrada.origem === AppointmentSource.PUBLIC) {
    chance *= 1.25;
    motivos.push({ texto: 'Agendou sozinha pelo link, sem contato', direcao: 'cima' });
  }

  // 5. Confirmação. É o sinal mais barato de todos e o único que a recepção
  //    controla — por isso vale tanto.
  if (entrada.confirmado) {
    chance *= 0.45;
    motivos.push({ texto: 'Já confirmou presença', direcao: 'baixo' });
  }

  return { risco: Math.min(0.97, paraProbabilidade(chance)), motivos };
}

function diasEntre(de: Date, ate: Date): number {
  return Math.max(0, (ate.getTime() - de.getTime()) / 86_400_000);
}

/**
 * Os atendimentos futuros da janela, ordenados do mais arriscado para o menos.
 *
 * Uma consulta para o que vem, outra para o histórico — e a conta acontece em
 * memória. Puxar o histórico de cada cliente separado seria uma consulta por
 * atendimento.
 */
export async function riscoDeFalta(opcoes: { dias?: number } = {}): Promise<{
  taxaDaEmpresa: number;
  baseadoEm: number;
  atendimentos: RiscoDeFalta[];
}> {
  const dias = Math.min(60, Math.max(1, opcoes.dias ?? 7));
  const agora = new Date();
  const ate = new Date(agora.getTime() + dias * 86_400_000);

  const [futuros, passados] = await Promise.all([
    prisma.appointment.findMany({
      where: { startsAt: { gte: agora, lte: ate }, status: { in: FUTUROS } },
      select: {
        id: true,
        startsAt: true,
        createdAt: true,
        status: true,
        source: true,
        totalPrice: true,
        customer: { select: { id: true, name: true, phone: true } },
        professional: { select: { id: true, name: true } },
        services: { select: { service: { select: { name: true } } }, take: 1 },
      },
      orderBy: { startsAt: 'asc' },
    }),
    prisma.appointment.findMany({
      where: { startsAt: { lt: agora }, status: { in: CONCLUIDOS } },
      select: { customerId: true, status: true, startsAt: true },
      orderBy: { startsAt: 'asc' },
    }),
  ]);

  // A taxa da casa. Com pouco histórico, vale a média do setor: uma empresa com
  // três atendimentos não define nada sobre si mesma.
  const faltasTotais = passados.filter((a) => a.status === AppointmentStatus.NO_SHOW).length;
  const taxaDaEmpresa =
    passados.length >= MINIMO_PARA_TAXA_PROPRIA ? faltasTotais / passados.length : TAXA_PADRAO;

  // Histórico por cliente, em uma passada só.
  const porCliente = new Map<string, { total: number; faltas: number; ultimaFoiFalta: boolean }>();
  for (const a of passados) {
    const atual = porCliente.get(a.customerId) ?? { total: 0, faltas: 0, ultimaFoiFalta: false };
    atual.total += 1;
    if (a.status === AppointmentStatus.NO_SHOW) atual.faltas += 1;
    // A lista vem em ordem crescente, então o último a passar por aqui é o
    // atendimento mais recente dela.
    atual.ultimaFoiFalta = a.status === AppointmentStatus.NO_SHOW;
    porCliente.set(a.customerId, atual);
  }

  const atendimentos = futuros.map((a) => {
    const historico = porCliente.get(a.customer.id) ?? {
      total: 0,
      faltas: 0,
      ultimaFoiFalta: false,
    };

    const { risco, motivos } = calcularRisco({
      taxaDaEmpresa,
      faltasDaCliente: historico.faltas,
      totalDaCliente: historico.total,
      faltouNaUltima: historico.ultimaFoiFalta,
      antecedenciaEmDias: diasEntre(a.createdAt, a.startsAt),
      origem: a.source,
      confirmado: a.status === AppointmentStatus.CONFIRMED,
    });

    return {
      appointmentId: a.id,
      startsAt: a.startsAt,
      customer: a.customer,
      professional: a.professional,
      servico: a.services[0]?.service.name ?? null,
      valor: Number(a.totalPrice),
      risco,
      faixa: faixaDe(risco),
      motivos,
      historico: { total: historico.total, faltas: historico.faltas },
    };
  });

  atendimentos.sort((a, b) => b.risco - a.risco);

  return {
    taxaDaEmpresa,
    baseadoEm: passados.length,
    atendimentos,
  };
}

/** O resumo curto que cabe num cartão do painel. */
export async function resumoDeRisco(dias = 7) {
  const { atendimentos, taxaDaEmpresa, baseadoEm } = await riscoDeFalta({ dias });
  const emRisco = atendimentos.filter((a) => a.faixa === 'alto');

  return {
    dias,
    taxaDaEmpresa,
    taxaEmTexto: porcento(taxaDaEmpresa),
    baseadoEm,
    total: atendimentos.length,
    emRisco: emRisco.length,
    /** Quanto está marcado nos horários de risco — o que se perde se todos faltarem. */
    valorEmRisco: emRisco.reduce((soma, a) => soma + a.valor, 0),
    /** Os piores, para o cartão não virar uma lista infinita. */
    principais: emRisco.slice(0, 5),
  };
}
