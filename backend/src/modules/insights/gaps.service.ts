import { AppointmentStatus } from '@prisma/client';
import { prisma } from '../../shared/database/prisma';

/**
 * Encaixe: quem cabe no buraco que abriu.
 *
 * Quando alguém cancela, a cadeira fica parada — e quem pagaria por ela já está
 * na agenda da semana, marcada para depois. O sistema sabe quem é: basta
 * procurar, entre os atendimentos seguintes da mesma profissional, os que
 * caberiam no vão e cuja cliente tenha motivo para preferir o horário mais
 * cedo.
 *
 * Só sugere antecipar, nunca adiar, e só dentro da mesma profissional: mudar de
 * mão é mudar de serviço na prática, e ninguém aceita isso por telefone.
 *
 * A decisão continua sendo de quem atende. Isto é uma lista de ligações a
 * fazer, não uma remarcação automática.
 */

const OCUPAM: AppointmentStatus[] = [
  AppointmentStatus.SCHEDULED,
  AppointmentStatus.CONFIRMED,
  AppointmentStatus.IN_PROGRESS,
];

/** Vão menor que isso não vale uma ligação. */
const VAO_MINIMO = 30;

/** Até onde procurar candidatas para trazer para frente. */
const DIAS_A_FRENTE = 14;

export interface Candidata {
  appointmentId: string;
  customer: { id: string; name: string; phone: string | null };
  servico: string | null;
  duracao: number;
  /** Onde ela está marcada hoje. */
  marcadaPara: Date;
  /** Quantos dias ela adiantaria. */
  adiantaEmDias: number;
  valor: number;
  /** Por que ela é uma boa candidata. */
  motivos: string[];
}

export interface Vao {
  professional: { id: string; name: string };
  comecaEm: Date;
  terminaEm: Date;
  minutos: number;
  /** Ordenadas da melhor para a pior. */
  candidatas: Candidata[];
}

function minutosEntre(de: Date, ate: Date): number {
  return Math.round((ate.getTime() - de.getTime()) / 60_000);
}

function inicioDoDia(data: Date): Date {
  const d = new Date(data);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Os vãos de um dia, com quem caberia em cada um.
 *
 * O "dia" é a data pedida; a janela de trabalho de cada profissional sai do
 * primeiro ao último atendimento dela naquele dia. É de propósito: um vão antes
 * do primeiro horário ou depois do último não é buraco, é o expediente dela
 * começando mais tarde ou terminando mais cedo.
 */
export async function vagasDoDia(data: Date): Promise<Vao[]> {
  const inicio = inicioDoDia(data);
  const fim = new Date(inicio.getTime() + 86_400_000);
  const agora = new Date();

  const doDia = await prisma.appointment.findMany({
    where: { startsAt: { gte: inicio, lt: fim }, status: { in: OCUPAM } },
    select: {
      id: true,
      startsAt: true,
      endsAt: true,
      professional: { select: { id: true, name: true } },
    },
    orderBy: { startsAt: 'asc' },
  });

  // Agrupa por profissional. Sem profissional não há agenda para ter buraco.
  const porProfissional = new Map<string, { nome: string; blocos: typeof doDia }>();
  for (const a of doDia) {
    if (!a.professional) continue;
    const atual = porProfissional.get(a.professional.id) ?? {
      nome: a.professional.name,
      blocos: [] as typeof doDia,
    };
    atual.blocos.push(a);
    porProfissional.set(a.professional.id, atual);
  }

  // Os vãos: o espaço entre o fim de um atendimento e o começo do próximo.
  const vaos: Omit<Vao, 'candidatas'>[] = [];
  for (const [professionalId, { nome, blocos }] of porProfissional) {
    for (let i = 0; i < blocos.length - 1; i += 1) {
      const termina = blocos[i].endsAt;
      const comeca = blocos[i + 1].startsAt;
      const minutos = minutosEntre(termina, comeca);

      // Vão que já passou não dá para preencher.
      if (minutos >= VAO_MINIMO && comeca > agora) {
        vaos.push({
          professional: { id: professionalId, name: nome },
          comecaEm: termina,
          terminaEm: comeca,
          minutos,
        });
      }
    }
  }

  if (vaos.length === 0) return [];

  // As candidatas: atendimentos futuros das mesmas profissionais, depois deste
  // dia, que poderiam ser trazidos para frente.
  const candidatas = await prisma.appointment.findMany({
    where: {
      startsAt: { gte: fim, lte: new Date(fim.getTime() + DIAS_A_FRENTE * 86_400_000) },
      status: { in: OCUPAM },
      professionalId: { in: [...porProfissional.keys()] },
    },
    select: {
      id: true,
      startsAt: true,
      durationMinutes: true,
      totalPrice: true,
      professionalId: true,
      customerId: true,
      customer: { select: { id: true, name: true, phone: true } },
      services: { select: { service: { select: { name: true } } }, take: 1 },
    },
    orderBy: { startsAt: 'asc' },
  });

  // Quem já faltou costuma faltar de novo: não vale gastar a ligação com ela
  // para tapar um buraco — vale saber, e por isso entra como observação.
  const passados = await prisma.appointment.findMany({
    where: {
      startsAt: { lt: agora },
      customerId: { in: candidatas.map((c) => c.customerId) },
      status: { in: [AppointmentStatus.COMPLETED, AppointmentStatus.NO_SHOW] },
    },
    select: { customerId: true, status: true },
  });

  const historico = new Map<string, { total: number; faltas: number }>();
  for (const a of passados) {
    const atual = historico.get(a.customerId) ?? { total: 0, faltas: 0 };
    atual.total += 1;
    if (a.status === AppointmentStatus.NO_SHOW) atual.faltas += 1;
    historico.set(a.customerId, atual);
  }

  return vaos
    .map((vao) => {
      const cabem = candidatas
        .filter(
          (c) => c.professionalId === vao.professional.id && c.durationMinutes <= vao.minutos,
        )
        .map((c) => {
          const h = historico.get(c.customerId) ?? { total: 0, faltas: 0 };
          const adiantaEmDias = Math.round(
            (c.startsAt.getTime() - vao.comecaEm.getTime()) / 86_400_000,
          );

          const motivos: string[] = [];
          if (c.durationMinutes === vao.minutos) motivos.push('Encaixa exato no vão');
          else motivos.push(`Cabe com ${vao.minutos - c.durationMinutes} min de folga`);

          motivos.push(`Adianta ${adiantaEmDias} ${adiantaEmDias === 1 ? 'dia' : 'dias'}`);

          if (h.faltas > 0) {
            motivos.push(`Atenção: já faltou ${h.faltas} ${h.faltas === 1 ? 'vez' : 'vezes'}`);
          }

          return {
            appointmentId: c.id,
            customer: c.customer,
            servico: c.services[0]?.service.name ?? null,
            duracao: c.durationMinutes,
            marcadaPara: c.startsAt,
            adiantaEmDias,
            valor: Number(c.totalPrice),
            motivos,
            // Só para ordenar; não sai na resposta.
            _peso:
              (c.durationMinutes / vao.minutos) * 2 - // quem aproveita melhor o vão
              adiantaEmDias * 0.05 - // quem está mais perto topa mais fácil
              (h.total > 0 ? (h.faltas / h.total) * 1.5 : 0.2), // e quem costuma vir
          };
        })
        .sort((a, b) => b._peso - a._peso)
        .slice(0, 3)
        .map(({ _peso, ...resto }) => resto);

      return { ...vao, candidatas: cabem };
    })
    .filter((vao) => vao.candidatas.length > 0)
    .sort((a, b) => a.comecaEm.getTime() - b.comecaEm.getTime());
}
