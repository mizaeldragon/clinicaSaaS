import { AppointmentStatus, TransactionType } from '@prisma/client';
import { prisma } from '../../shared/database/prisma';

/**
 * O mês em palavras.
 *
 * O painel já mostra tudo em gráfico, e gráfico responde "quanto" muito bem e
 * "e daí?" muito mal. Quem fecha o mês quer a frase que contaria para o
 * contador: cresceu ou caiu, por causa do quê, e o que merece atenção.
 *
 * O texto é montado a partir dos números, não gerado por modelo de linguagem.
 * Aqui cada frase precisa ser verdadeira e reproduzível — um resumo financeiro
 * que inventa um número é pior que resumo nenhum, e ninguém conferiria.
 */

export interface Destaque {
  /** A frase. */
  texto: string;
  /** Para a tela saber se pinta de bom, ruim ou neutro. */
  tom: 'bom' | 'ruim' | 'neutro';
}

export interface ResumoDoMes {
  mes: string;
  rotulo: string;
  receita: number;
  despesa: number;
  resultado: number;
  atendimentos: number;
  faltas: number;
  /** Comparação com o mês anterior, quando ele existe. */
  anterior: { receita: number; atendimentos: number; variacao: number | null } | null;
  destaques: Destaque[];
  /** Vazio quando o mês não teve movimento nenhum. */
  temDados: boolean;
}

const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

function dinheiro(valor: number): string {
  return valor.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  });
}

function faixaDoMes(mes: string): { de: Date; ate: Date; anoMes: [number, number] } {
  const [ano, m] = mes.split('-').map(Number);
  return { de: new Date(ano, m - 1, 1), ate: new Date(ano, m, 1), anoMes: [ano, m] };
}

/**
 * Monta o resumo de um mês no formato `2026-09`.
 */
export async function resumoDoMes(mes: string): Promise<ResumoDoMes> {
  const { de, ate, anoMes } = faixaDoMes(mes);
  const anteriorDe = new Date(anoMes[0], anoMes[1] - 2, 1);

  const [transacoes, atendimentos, transacoesAnteriores, atendimentosAnteriores] =
    await Promise.all([
      prisma.financialTransaction.findMany({
        where: { competenceDate: { gte: de, lt: ate } },
        select: { type: true, amount: true },
      }),
      prisma.appointment.findMany({
        where: { startsAt: { gte: de, lt: ate } },
        select: {
          status: true,
          totalPrice: true,
          customerId: true,
          professional: { select: { id: true, name: true } },
          services: { select: { service: { select: { name: true } } } },
        },
      }),
      prisma.financialTransaction.findMany({
        where: { competenceDate: { gte: anteriorDe, lt: de } },
        select: { type: true, amount: true },
      }),
      prisma.appointment.findMany({
        where: { startsAt: { gte: anteriorDe, lt: de } },
        select: { status: true, services: { select: { service: { select: { name: true } } } } },
      }),
    ]);

  const somar = (lista: { type: TransactionType; amount: unknown }[], tipo: TransactionType) =>
    lista
      .filter((t) => t.type === tipo)
      .reduce((soma, t) => soma + Number(t.amount), 0);

  const receita = somar(transacoes, TransactionType.INCOME);
  const despesa = somar(transacoes, TransactionType.EXPENSE);
  const receitaAnterior = somar(transacoesAnteriores, TransactionType.INCOME);

  const finalizados = atendimentos.filter((a) => a.status === AppointmentStatus.COMPLETED);
  const faltas = atendimentos.filter((a) => a.status === AppointmentStatus.NO_SHOW);
  const finalizadosAnteriores = atendimentosAnteriores.filter(
    (a) => a.status === AppointmentStatus.COMPLETED,
  );

  const rotulo = `${MESES[anoMes[1] - 1]} de ${anoMes[0]}`;
  const temDados = transacoes.length > 0 || atendimentos.length > 0;

  const destaques: Destaque[] = [];

  if (!temDados) {
    return {
      mes,
      rotulo,
      receita: 0,
      despesa: 0,
      resultado: 0,
      atendimentos: 0,
      faltas: 0,
      anterior: null,
      destaques: [{ texto: `Nenhum movimento registrado em ${rotulo}.`, tom: 'neutro' }],
      temDados: false,
    };
  }

  // 1. A variação da receita — a primeira coisa que qualquer dono quer saber.
  const houveAnterior = receitaAnterior > 0;
  const variacao = houveAnterior ? (receita - receitaAnterior) / receitaAnterior : null;

  if (variacao !== null) {
    const p = Math.abs(Math.round(variacao * 100));
    if (p < 3) {
      destaques.push({
        texto: `Faturou ${dinheiro(receita)}, praticamente o mesmo do mês anterior.`,
        tom: 'neutro',
      });
    } else {
      destaques.push({
        texto: `Faturou ${dinheiro(receita)}, ${p}% ${variacao > 0 ? 'a mais' : 'a menos'} que no mês anterior.`,
        tom: variacao > 0 ? 'bom' : 'ruim',
      });
    }
  } else {
    destaques.push({ texto: `Faturou ${dinheiro(receita)} no mês.`, tom: 'neutro' });
  }

  // 2. O resultado. Prejuízo merece frase própria, não uma linha de tabela.
  const resultado = receita - despesa;
  if (despesa > 0) {
    destaques.push({
      texto:
        resultado >= 0
          ? `Depois de ${dinheiro(despesa)} de despesas, sobraram ${dinheiro(resultado)}.`
          : `As despesas somaram ${dinheiro(despesa)} e o mês fechou negativo em ${dinheiro(Math.abs(resultado))}.`,
      tom: resultado >= 0 ? 'bom' : 'ruim',
    });
  }

  // 3. O serviço que mais cresceu — o "por causa do quê".
  const contarServicos = (lista: { services: { service: { name: string } }[] }[]) => {
    const mapa = new Map<string, number>();
    for (const a of lista) {
      for (const s of a.services) {
        mapa.set(s.service.name, (mapa.get(s.service.name) ?? 0) + 1);
      }
    }
    return mapa;
  };

  const agora = contarServicos(finalizados);
  const antes = contarServicos(finalizadosAnteriores);

  if (agora.size > 0) {
    const maisFeito = [...agora.entries()].sort((a, b) => b[1] - a[1])[0];
    destaques.push({
      texto: `O serviço mais feito foi ${maisFeito[0]}, com ${maisFeito[1]} ${maisFeito[1] === 1 ? 'atendimento' : 'atendimentos'}.`,
      tom: 'neutro',
    });

    if (antes.size > 0) {
      const crescimentos = [...agora.entries()]
        .map(([nome, qtd]) => ({ nome, delta: qtd - (antes.get(nome) ?? 0) }))
        .filter((c) => c.delta > 0)
        .sort((a, b) => b.delta - a.delta);

      if (crescimentos.length > 0) {
        const topo = crescimentos[0];
        destaques.push({
          texto: `O que mais cresceu foi ${topo.nome}: ${topo.delta} ${topo.delta === 1 ? 'atendimento' : 'atendimentos'} a mais que no mês anterior.`,
          tom: 'bom',
        });
      }
    }
  }

  // 4. As faltas, em dinheiro. É o número que costuma surpreender.
  if (faltas.length > 0) {
    const perdido = faltas.reduce((soma, a) => soma + Number(a.totalPrice), 0);
    const taxa = Math.round((faltas.length / atendimentos.length) * 100);
    destaques.push({
      texto: `${faltas.length} ${faltas.length === 1 ? 'cliente faltou' : 'clientes faltaram'} (${taxa}% do total), deixando ${dinheiro(perdido)} na mesa.`,
      tom: taxa >= 20 ? 'ruim' : 'neutro',
    });
  }

  // 5. Quem atendeu mais. Só faz sentido com equipe.
  const porProfissional = new Map<string, number>();
  for (const a of finalizados) {
    if (!a.professional) continue;
    porProfissional.set(
      a.professional.name,
      (porProfissional.get(a.professional.name) ?? 0) + Number(a.totalPrice),
    );
  }

  if (porProfissional.size > 1) {
    const topo = [...porProfissional.entries()].sort((a, b) => b[1] - a[1])[0];
    destaques.push({
      texto: `${topo[0]} foi quem mais faturou: ${dinheiro(topo[1])}.`,
      tom: 'neutro',
    });
  }

  // 6. Clientes que sumiram. O dado que ninguém olha e que mais cedo avisa.
  const clientesDoMes = new Set(finalizados.map((a) => a.customerId));
  const sumiram = await clientesQueSumiram(de, clientesDoMes);
  if (sumiram > 0) {
    destaques.push({
      texto: `${sumiram} ${sumiram === 1 ? 'cliente que costumava vir não voltou' : 'clientes que costumavam vir não voltaram'} este mês.`,
      tom: 'ruim',
    });
  }

  return {
    mes,
    rotulo,
    receita,
    despesa,
    resultado,
    atendimentos: finalizados.length,
    faltas: faltas.length,
    anterior: houveAnterior
      ? { receita: receitaAnterior, atendimentos: finalizadosAnteriores.length, variacao }
      : null,
    destaques,
    temDados: true,
  };
}

/**
 * Quantas clientes frequentes não apareceram no mês.
 *
 * "Frequente" aqui é quem veio ao menos duas vezes nos três meses anteriores —
 * quem veio uma vez só nunca foi frequente, e cobrar volta dela seria ruído.
 */
async function clientesQueSumiram(inicioDoMes: Date, presentes: Set<string>): Promise<number> {
  const tresMesesAntes = new Date(inicioDoMes);
  tresMesesAntes.setMonth(tresMesesAntes.getMonth() - 3);

  const anteriores = await prisma.appointment.findMany({
    where: {
      startsAt: { gte: tresMesesAntes, lt: inicioDoMes },
      status: AppointmentStatus.COMPLETED,
    },
    select: { customerId: true },
  });

  const visitas = new Map<string, number>();
  for (const a of anteriores) {
    visitas.set(a.customerId, (visitas.get(a.customerId) ?? 0) + 1);
  }

  let sumiram = 0;
  for (const [customerId, quantas] of visitas) {
    if (quantas >= 2 && !presentes.has(customerId)) sumiram += 1;
  }
  return sumiram;
}
