import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { BrandLogo } from '@/components/brand';
import { useAuthStore } from '@/stores/auth.store';
import { usePublicPlans } from '@/features/auth/usePublicPlans';
import type { Plan } from '@/types';
import './landing.css';

/**
 * A vitrine do produto.
 *
 * Tipografia em duas vozes: Newsreader nos títulos, com o trecho em itálico
 * vinho carregando a ideia, e Hanken Grotesk no corpo. As seções se separam por
 * fundo — creme, branco, marinho, areia — em vez de caixas, e fios de 1px fazem
 * o trabalho que bordas de cartão fariam.
 *
 * Os estilos moram em `landing.css`, fora do Tailwind: esta página não divide
 * paleta nem régua de espaçamento com o painel, e traduzi-la para as classes do
 * sistema de design seria perder o desenho no caminho.
 */

const SEGMENTOS = [
  'Salões',
  'Studios',
  'Clínicas de estética',
  'Barbearias',
  'Espaços compartilhados',
];

const PASSOS = [
  [
    'A cliente marca sozinha',
    'Você coloca o seu link na bio e no WhatsApp. Ela escolhe o serviço e um horário livre pelo celular — a qualquer hora, sem esperar você responder.',
  ],
  [
    'A agenda se protege',
    'Profissional, sala, maca e cadeira são conferidos juntos. O sistema simplesmente não deixa marcar duas clientes no mesmo lugar e horário.',
  ],
  [
    'O caixa fecha sozinho',
    'Finalizou o atendimento, entrou no caixa. Despesas, comissões e o lucro do mês aparecem prontos — sem calculadora e sem planilha.',
  ],
];

const MODULOS = [
  {
    tag: 'Núcleo',
    nome: 'Agenda inteligente',
    desc: 'Horário, profissional, sala e cadeira conferidos de uma vez. Marcou, está garantido — nada de duas clientes esperando a mesma cadeira.',
    metrica: '0 choques',
    metricaLabel: 'de horário, sala ou cadeira',
  },
  {
    tag: 'Captação',
    nome: 'Link de agendamento',
    desc: 'Um link para a bio do Instagram e para o WhatsApp. A cliente agenda pelo celular, sem baixar aplicativo e sem depender de você responder.',
    metrica: '24h',
    metricaLabel: 'agenda aberta, até de madrugada',
  },
  {
    tag: 'Caixa',
    nome: 'Financeiro organizado',
    desc: 'Entradas, saídas, o que falta receber e o lucro do mês numa tela só. Você sabe quanto ganhou sem abrir planilha.',
    metrica: '1 tela',
    metricaLabel: 'para fechar o mês',
  },
  {
    tag: 'Equipe',
    nome: 'Comissões automáticas',
    desc: 'Percentual ou valor fixo por serviço: o acerto de cada profissional sai calculado, sem conta de cabeça e sem discussão no fim do mês.',
    metrica: 'Sem planilha',
    metricaLabel: 'acerto pronto para pagar',
  },
  {
    tag: 'Operação',
    nome: 'Recursos e salas',
    desc: 'Salas, macas, cadeiras e equipamentos com agenda própria: você vê na hora o que está livre, em uso ou em manutenção.',
    metrica: 'Tempo real',
    metricaLabel: 'o que está livre agora',
  },
];

/**
 * As três leituras que o sistema faz do próprio histórico da empresa.
 *
 * O texto evita a promessa vazia de "IA" e diz de onde a resposta vem: são os
 * atendimentos da própria casa, contados. É o que sustenta a frase de que nada
 * sai para fora — e é também o que faz a recepção confiar e ligar para a
 * cliente, porque o motivo aparece junto do número.
 */
const INTELIGENCIA = [
  {
    tag: 'Antes de acontecer',
    nome: 'Risco de falta',
    desc: 'Os atendimentos da semana em ordem de quem provavelmente não vem — com o motivo ao lado, para você saber para quem ligar antes da cadeira ficar vazia.',
    exemplo: 'Camila · 47% — faltou 4 das 11 vezes e não confirmou',
  },
  {
    tag: 'Buraco na agenda',
    nome: 'Encaixes possíveis',
    desc: 'Os buracos entre um atendimento e outro, e quem já está marcada nos próximos dias e caberia ali. Horário vazio vira atendimento.',
    exemplo: '45 min livres às 14h · 3 clientes aceitariam antecipar',
  },
  {
    tag: 'Fim do mês',
    nome: 'Resumo em palavras',
    desc: 'O mês contado em frases, não em gráfico: cresceu ou caiu, por causa do quê — e quais clientes fiéis sumiram e merecem uma mensagem.',
    exemplo: '+12% em setembro · 4 clientes frequentes não voltaram',
  },
];

/**
 * O texto de venda de cada plano. Preço e nome NÃO moram aqui: vêm do banco,
 * que é o que o super admin edita em /admin/planos e o que o Asaas cobra. Com o
 * preço escrito à mão, editar o plano mudava a cobrança e deixava a vitrine
 * anunciando o valor antigo.
 *
 * Plano criado no painel e ausente daqui aparece com a descrição cadastrada.
 */
interface TextoPlano {
  selo?: string;
  desc: string;
  itens: string[];
  branco?: boolean;
  navy?: boolean;
}

const TEXTO_PLANOS: Record<string, TextoPlano> = {
  starter: {
    selo: 'Para começar',
    desc: 'Para quem atende sozinha e quer largar o caderno e a planilha de vez.',
    itens: [
      'Agenda online sem choque de horário',
      'Link para a cliente marcar sozinha',
      'Ficha das clientes e caixa do dia',
    ],
  },
  pro: {
    selo: 'Próprio espaço',
    desc: 'Para o espaço com equipe que quer agenda, caixa e comissões rodando sem depender de você.',
    branco: true,
    itens: [
      'Tudo do Starter, para a equipe inteira',
      'Financeiro, comissões e relatórios',
      'Aviso de falta, encaixes e resumo do mês',
      'Salas e equipamentos sem conflito',
    ],
  },
  premium: {
    selo: 'Mais completo',
    desc: 'Para quem atende e também aluga sala ou cadeira para outras profissionais.',
    navy: true,
    itens: [
      'Tudo do Pro, inteligência inclusa',
      'Aluguel por turno, diária ou mês',
      'Contrato e cobrança de cada locatária',
      'Login próprio para cada profissional',
    ],
  },
};

/** `199,99` com centavos (em fonte menor, para caber), `300` quando é redondo. */
function formatarPreco(price: number): { valor: string; menor: boolean } {
  const redondo = Number.isInteger(price);
  return {
    valor: price.toLocaleString('pt-BR', {
      minimumFractionDigits: redondo ? 0 : 2,
      maximumFractionDigits: 2,
    }),
    menor: !redondo,
  };
}

function montarVitrine(plans: Plan[]) {
  return plans.map((plan) => {
    const texto = TEXTO_PLANOS[plan.slug] ?? { desc: plan.description ?? '', itens: [] };
    return { ...texto, slug: plan.slug, nome: plan.name, preco: formatarPreco(plan.price) };
  });
}

const DUVIDAS = [
  [
    'Preciso instalar alguma coisa?',
    'Não. O CliniStudio abre no navegador do computador, do tablet ou do celular. Você assina, entra e já começa a montar a agenda.',
  ],
  [
    'Como eu pago? Tem fidelidade?',
    'Mensalidade no PIX, boleto ou cartão, sem fidelidade. Se cancelar, o acesso continua até o fim do período que você já pagou.',
  ],
  [
    'As clientes precisam instalar um aplicativo?',
    'Não. Elas agendam pelo seu link no navegador, em poucos toques, direto do Instagram ou do WhatsApp.',
  ],
  [
    'Quem aluga o espaço precisa pagar o sistema?',
    'Não. O acesso dos profissionais que alugam está incluído no plano Premium do espaço — cada um entra com o próprio login.',
  ],
  [
    'Eu vejo a agenda e o faturamento de quem aluga?',
    'Você vê o uso do espaço e a cobrança do aluguel. O atendimento e o financeiro de cada profissional ficam privados.',
  ],
  [
    'O sistema evita conflito na mesma sala?',
    'Sim. Salas, cadeiras e equipamentos são recursos com disponibilidade própria: se estiver ocupado, o horário não aparece.',
  ],
  [
    'Essa inteligência manda meus dados para algum lugar?',
    'Não. As três leituras são calculadas aqui dentro, sobre os seus próprios atendimentos — nada é enviado para serviço externo e nada alimenta o treino de modelo nenhum.',
  ],
  [
    'A inteligência vem em qual plano?',
    'No Pro e no Premium. O Starter tem agenda, clientes, serviços e caixa; risco de falta, encaixes e resumo do mês entram junto com os relatórios, a partir do Pro.',
  ],
];

/**
 * Fica colado no topo e só vira barra quando a página sai do lugar.
 *
 * Parado no início, sem fundo e sem fio embaixo, ele some dentro do creme e o
 * hero começa na borda da tela. Depois de rolar, precisa se destacar do que
 * passa por baixo — e aí vira uma barra solta, com fundo e sombra.
 */
function useRolou(limite = 24) {
  const [rolou, setRolou] = useState(false);

  useEffect(() => {
    const aoRolar = () => setRolou(window.scrollY > limite);
    aoRolar();
    window.addEventListener('scroll', aoRolar, { passive: true });
    return () => window.removeEventListener('scroll', aoRolar);
  }, [limite]);

  return rolou;
}

/*
 * O que entra em cena ao rolar. Os blocos de abertura de cada seção sobem
 * sozinhos; os cartões de uma mesma grade entram em cascata, um depois do
 * outro, para o olho percorrer a fileira em vez de recebê-la de uma vez.
 */
const REVELA = [
  '.lp-metodo-cabeca',
  '.lp-sistema-cabeca',
  '.lp-agenda-grid > *',
  '.lp-ia-cabeca',
  '.lp-ia-nota',
  '.lp-planos .lp-eyebrow',
  '.lp-planos .lp-h2',
  '.lp-planos-teste',
  '.lp-duvidas-grid > .lp-h2',
  '.lp-cta',
].join(',');

const CASCATA = [
  '.lp-passo',
  '.lp-modulo',
  '.lp-modulo-destaque',
  '.lp-ia-cartao',
  '.lp-plano',
  '.lp-faq-item',
].join(',');

/**
 * Revela os blocos da landing conforme entram na tela.
 *
 * Quem esconde é o JavaScript (a classe `lp-motion` na raiz), não o CSS
 * sozinho: se o script falhar, ou o navegador não tiver IntersectionObserver,
 * a página aparece inteira e parada — nunca em branco. Quem pede menos
 * movimento no sistema também recebe a página parada.
 *
 * `refazer` muda quando chega conteúdo novo (os planos vêm da API depois da
 * primeira pintura); cada elemento só é marcado uma vez.
 */
function useRevelar(refazer: unknown) {
  const raiz = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = raiz.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    el.classList.add('lp-motion');

    const observador = new IntersectionObserver(
      (entradas) => {
        for (const entrada of entradas) {
          if (!entrada.isIntersecting) continue;
          entrada.target.classList.add('is-visivel');
          observador.unobserve(entrada.target);
        }
      },
      // Dispara um pouco antes da borda de baixo, para a subida terminar
      // enquanto o bloco ainda está entrando, e não depois de já estar lido.
      { rootMargin: '0px 0px -8% 0px', threshold: 0.12 },
    );

    // Marca uma vez, mas observa de novo a cada rodada: a rodada anterior
    // desligou o observador dela, e um bloco marcado que ainda não apareceu
    // ficaria escondido para sempre se fosse pulado aqui.
    const marcar = (alvo: Element, atraso: number) => {
      if (!alvo.hasAttribute('data-reveal')) {
        alvo.setAttribute('data-reveal', '');
        (alvo as HTMLElement).style.setProperty('--atraso', `${atraso}ms`);
      }
      if (!alvo.classList.contains('is-visivel')) observador.observe(alvo);
    };

    el.querySelectorAll(REVELA).forEach((alvo) => marcar(alvo, 0));
    el.querySelectorAll(CASCATA).forEach((alvo) => {
      const irmaos = Array.from(alvo.parentElement?.children ?? []);
      // Teto de 4 passos: numa lista longa o último esperaria demais.
      marcar(alvo, Math.min(irmaos.indexOf(alvo), 4) * 90);
    });

    return () => observador.disconnect();
  }, [refazer]);

  return raiz;
}

export function LandingPage() {
  const token = useAuthStore((state) => state.accessToken);
  const [aberta, setAberta] = useState<number>(0);
  const rolou = useRolou();
  const { data: planos } = usePublicPlans();
  const raiz = useRevelar(planos);
  const [params] = useSearchParams();

  // Temporário, enquanto a tipografia não está fechada: `?fonte=newsreader` e
  // `?fonte=bodoni` devolvem as serifadas para comparar na própria página. Sai
  // daqui junto com as regras `[data-fonte]` do CSS quando a escolha for feita.
  const pedida = params.get('fonte');
  const fonte = pedida === 'newsreader' || pedida === 'bodoni' ? pedida : undefined;

  if (token) return <Navigate to="/app" replace />;

  return (
    <div className="lp" data-fonte={fonte} ref={raiz}>
      {/* ------------------------------------------------------- barra topo */}
      <div className={rolou ? 'lp-topo lp-topo--flutuante' : 'lp-topo'} id="top">
        <div className="lp-wrap lp-pad lp-topo-linha">
          <a href="#top" className="lp-marca" aria-label="CliniStudio, início">
            <BrandLogo className="lp-logo" />
          </a>

          <nav className="lp-nav" aria-label="Navegação principal">
            <a href="#metodo">Como funciona</a>
            <a href="#sistema">Sistema</a>
            <a href="#inteligencia">Inteligência</a>
            <a href="#planos">Planos</a>
            <a href="#duvidas">Dúvidas</a>
          </nav>

          <div className="lp-acoes">
            <Link to="/login" className="lp-link lp-entrar">
              Entrar
            </Link>
            <a href="#planos" className="lp-btn-topo">
              Assinar agora
            </a>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------ hero */}
      <div className="lp-hero">
        <div className="lp-wrap lp-pad lp-hero-grid">
          <div className="lp-hero-texto">
            <p className="lp-eyebrow">
              <i />
              <span>Sistema de gestão para beleza</span>
              <span className="calado">· Salões · Estética · Barbearias</span>
            </p>

            {/* Quebra escolhida, não calculada: "com as clientes" partido em
                duas linhas separava o que a frase quer dizer junto. */}
            <h1 className="lp-h1 lp-h1-linhas">
              <span>Seu tempo</span>
              <span>com as clientes.</span>
              <span>
                <span className="lp-it">A ordem</span> com
              </span>
              <span>o CliniStudio.</span>
            </h1>

            <p className="lp-hero-sub">
              Agenda online, ficha das clientes, caixa e comissões num sistema só. A cliente marca
              sozinha pelo seu link, a agenda não deixa marcar duas no mesmo horário e o mês fecha
              sem planilha.
            </p>

            <div className="lp-hero-cta">
              <a href="#planos" className="lp-btn lp-btn-cheio">
                Assinar agora <span aria-hidden>→</span>
              </a>
              {/* Todo convite da landing termina nos planos: é lá que a pessoa
                  escolhe entre assinar e testar. Só o "Entrar" leva ao login. */}
              <a href="#planos" className="lp-btn lp-btn-vazio">
                Ver os planos
              </a>
            </div>

            <p className="lp-hero-nota">
              <i />Pagamento mensal · sem fidelidade · cancele quando quiser
            </p>
          </div>

          <div className="lp-hero-img">
            <img
              src="/landing/hero.jpg"
              alt="CliniStudio aberto em um notebook sobre a mesa"
              width={1536}
              height={1024}
            />
          </div>
        </div>
      </div>

      {/* ---------------------------------------------------------- ticker */}
      <div className="lp-ticker">
        <div className="lp-ticker-trilho">
          {/* Duas cópias: a animação desliza metade da largura e recomeça sem
              emenda visível. */}
          {[0, 1].map((copia) => (
            <div className="lp-ticker-grupo" key={copia} aria-hidden={copia === 1}>
              {SEGMENTOS.map((nome) => (
                <span className="lp-ticker-par" key={nome}>
                  <b>{nome}</b>
                  <s>/</s>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* ---------------------------------------------------------- método */}
      <div className="lp-wrap lp-pad lp-metodo" id="metodo">
        <div className="lp-metodo-cabeca">
          <h2 className="lp-h2">
            Chega de agenda no caderno e <span className="lp-it">cliente perdida no WhatsApp.</span>
          </h2>
          <p className="lp-lead">
            O CliniStudio cuida da parte chata da rotina para o seu tempo ficar com quem paga as
            contas: a cliente na cadeira.
          </p>
        </div>

        <div className="lp-passos">
          {PASSOS.map(([titulo, texto], i) => (
            <div className="lp-passo" key={titulo}>
              <span className="lp-passo-num">{String(i + 1).padStart(2, '0')}</span>
              <h3 className="lp-h3">{titulo}</h3>
              <p>{texto}</p>
            </div>
          ))}
        </div>
      </div>

      {/* --------------------------------------------------------- sistema */}
      <div className="lp-sistema" id="sistema">
        <div className="lp-wrap lp-pad">
          <div className="lp-sistema-cabeca">
            <div>
              <p className="lp-eyebrow">
                <i />
                <span>O que você ganha</span>
              </p>
              <h2 className="lp-h2">
                Tudo que o seu espaço precisa, <span className="lp-it">num sistema só.</span>
              </h2>
            </div>
            <p className="lp-sistema-lead">
              Cada parte resolve um problema que hoje toma o seu tempo — e todas conversam entre
              si: o que entra na agenda já aparece no caixa.
            </p>
          </div>

          <div className="lp-modulos">
            {MODULOS.map((modulo, i) => (
              <article className="lp-modulo" key={modulo.nome}>
                <span className="lp-modulo-halo" aria-hidden />
                <div className="lp-modulo-topo">
                  <span className="lp-modulo-tag">{modulo.tag}</span>
                  <span className="lp-modulo-num">{String(i + 1).padStart(2, '0')}</span>
                </div>
                <h3>{modulo.nome}</h3>
                <p>{modulo.desc}</p>
                <div className="lp-modulo-rodape">
                  <b>{modulo.metrica}</b>
                  <span>{modulo.metricaLabel}</span>
                </div>
              </article>
            ))}

            <article className="lp-modulo-destaque">
              <span className="lp-modulo-grade" aria-hidden />
              <div className="lp-modulo-topo">
                <span className="lp-modulo-tag">Espaço compartilhado</span>
                <span className="lp-modulo-num">06</span>
              </div>
              <h3>Aluguel sob controle</h3>
              <p>
                Aluga sala ou cadeira? Contrato, cobrança e login de cada profissional por turno,
                diária ou mês — sem você virar cobradora.
              </p>
              <a href="#planos" className="lp-btn-mini">
                Ver plano Premium
              </a>
            </article>
          </div>
        </div>
      </div>

      {/* --------------------------------------------------- agenda online */}
      <div className="lp-wrap lp-pad lp-agenda">
        <div className="lp-agenda-grid">
          <div>
            <p className="lp-eyebrow">
              <i />
              <span>Agendamento online</span>
            </p>
            <h2 className="lp-h2">
              A cliente marca sozinha. <span className="lp-it">Você só atende.</span>
            </h2>
            <p className="lp-agenda-sub">
              Cada profissional ganha um link próprio, com a cara da sua marca. A cliente vê só os
              horários realmente livres e agenda em poucos toques — enquanto você atende, ou dorme.
            </p>

            <div className="lp-lista">
              {[
                ['I', 'Link próprio para a bio e o WhatsApp'],
                ['II', 'Só aparecem horários realmente livres'],
                ['III', 'Sem aplicativo para a cliente instalar'],
              ].map(([numero, texto]) => (
                <div key={texto}>
                  <i>{numero}</i>
                  <span>{texto}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="lp-agenda-img">
            <img
              src="/landing/agenda.jpg"
              alt="Agenda do CliniStudio no notebook e no celular"
              width={1536}
              height={1024}
            />
          </div>
        </div>
      </div>

      {/* --------------------------------------------------- inteligência */}
      {/* Depois da agenda e antes dos planos de propósito: a seção existe para
          justificar o degrau do Starter para o Pro, e só convence quem já
          entendeu o que o sistema faz no dia a dia. */}
      <div className="lp-ia" id="inteligencia">
        <div className="lp-wrap lp-pad">
          <div className="lp-ia-cabeca">
            <div>
              <p className="lp-eyebrow">
                <i />
                <span>Inteligência</span>
              </p>
              <h2 className="lp-h2">
                Saiba quem vai faltar <span className="lp-it">antes da cadeira ficar vazia.</span>
              </h2>
            </div>
            <p className="lp-ia-lead">
              O CliniStudio lê o histórico do seu próprio espaço e avisa o que nenhuma agenda de
              papel avisa: quem tende a faltar, onde cabe um encaixe e como foi o seu mês.
            </p>
          </div>

          <div className="lp-ia-grid">
            {INTELIGENCIA.map((item, i) => (
              <article className="lp-ia-cartao" key={item.nome}>
                <div className="lp-ia-topo">
                  <span className="lp-modulo-tag">{item.tag}</span>
                  <span className="lp-ia-num">{String(i + 1).padStart(2, '0')}</span>
                </div>
                <h3>{item.nome}</h3>
                <p>{item.desc}</p>
                <div className="lp-ia-exemplo">
                  <i aria-hidden />
                  <span>{item.exemplo}</span>
                </div>
              </article>
            ))}
          </div>

          <div className="lp-ia-nota">
            <p>
              <b>Incluído no Pro e no Premium.</b> Nada sai do sistema: a conta é feita sobre os
              seus próprios atendimentos, e cada número aparece com o motivo do lado — para você
              conferir antes de pegar o telefone.
            </p>
            <a href="#planos" className="lp-btn-mini">
              Ver os planos
            </a>
          </div>
        </div>
      </div>

      {/* ---------------------------------------------------------- planos */}
      <div className="lp-planos" id="planos">
        <div className="lp-wrap lp-pad">
          <p className="lp-eyebrow">
            <i />
            <span>Planos</span>
          </p>
          <h2 className="lp-h2">
            Um plano para cada <span className="lp-it">fase do seu espaço.</span>
          </h2>

          <div className="lp-planos-grid">
            {montarVitrine(planos ?? []).map((plano) => (
              <article
                key={plano.slug}
                className={[
                  'lp-plano',
                  plano.branco ? 'lp-plano-branco' : '',
                  plano.navy ? 'lp-plano-navy' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                {plano.navy ? <span className="lp-plano-halo" aria-hidden /> : null}

                <div className="lp-plano-topo">
                  <h3>{plano.nome}</h3>
                  {plano.selo ? <span className="lp-plano-selo">{plano.selo}</span> : null}
                </div>

                <p className="lp-plano-desc">{plano.desc}</p>

                <div className="lp-plano-preco">
                  <span className="moeda">R$</span>
                  <span className={plano.preco.menor ? 'valor menor' : 'valor'}>
                    {plano.preco.valor}
                  </span>
                  <span className="mes">/ mês</span>
                </div>

                <div className="lp-plano-itens">
                  {plano.itens.map((item) => (
                    <div key={item}>
                      <i aria-hidden>✓</i>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>

                {/* O plano escolhido viaja na URL: a decisão acontece aqui, na
                    comparação, e não no meio do formulário de cadastro.
                    `assinar=1` diz que esta pessoa veio pagar — o cadastro
                    termina na tela de cobrança, não no painel. */}
                <Link to={`/cadastro?plano=${plano.slug}&assinar=1`} className="lp-plano-btn">
                  Assinar {plano.nome}
                </Link>

                <p className="lp-plano-rodape">Mensal · sem fidelidade · PIX, boleto ou cartão</p>
              </article>
            ))}
          </div>

          {/* O teste fica fora dos cartões de propósito.
              Dentro de cada um, ele competia com a assinatura e ganhava sempre:
              ninguém escolhe pagar quando "grátis" está no mesmo botão. Aqui
              embaixo ele vira o que é — a saída para quem ainda não se decidiu,
              depois de ter lido os três preços. */}
          <div className="lp-planos-teste">
            <p>
              Ainda em dúvida? Teste por <b>5 dias grátis</b>, com todos os recursos e sem cartão de
              crédito.
            </p>
            <Link to="/cadastro" className="lp-planos-teste-btn">
              Começar teste grátis →
            </Link>
          </div>
        </div>
      </div>

      {/* --------------------------------------------------------- dúvidas */}
      <div className="lp-duvidas" id="duvidas">
        <div className="lp-wrap lp-pad lp-duvidas-grid">
          <h2 className="lp-h2">
            Perguntas antes de <span className="lp-it">começar.</span>
          </h2>

          <div className="lp-faq">
            {DUVIDAS.map(([pergunta, resposta], i) => {
              const estaAberta = aberta === i;
              return (
                <div className="lp-faq-item" key={pergunta}>
                  <button
                    type="button"
                    className="lp-faq-botao"
                    aria-expanded={estaAberta}
                    onClick={() => setAberta(estaAberta ? -1 : i)}
                  >
                    <span className="lp-faq-num">{String(i + 1).padStart(2, '0')}</span>
                    <span className="lp-faq-pergunta">{pergunta}</span>
                    <span className="lp-faq-sinal" aria-hidden>
                      {estaAberta ? '−' : '+'}
                    </span>
                  </button>
                  {estaAberta ? <p className="lp-faq-resposta">{resposta}</p> : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- CTA */}
      {/* Dentro de `lp-wrap`/`lp-pad` como o resto: antes tinha largura própria
          de 1060px e ficava mais estreito que a seção logo acima. */}
      <div className="lp-wrap lp-pad lp-cta-caixa">
        <div className="lp-cta">
        <img
          src="/landing/cta.jpg"
          alt="CliniStudio no notebook e no celular"
          width={2067}
          height={761}
        />
        <div className="lp-cta-veu" aria-hidden />
        <div className="lp-cta-conteudo">
          <div>
            <span className="lp-cta-eyebrow">Comece hoje</span>
            <h2>
              Menos tempo organizando. <em>Mais tempo atendendo — e faturando.</em>
            </h2>
            <p>
              Assine em poucos minutos e pague como preferir: PIX, boleto ou cartão. Sem fidelidade.
            </p>
            <a href="#planos" className="lp-btn lp-btn-branco">
              Escolher meu plano <span aria-hidden>→</span>
            </a>
            </div>
          </div>
        </div>
      </div>

      {/* ---------------------------------------------------------- rodapé */}
      <footer className="lp-rodape">
        <div className="lp-wrap lp-pad">
          <div className="lp-rodape-grid">
            <div className="lp-rodape-marca">
              <BrandLogo className="lp-logo" />
              <p>
                O sistema de gestão para salões, clínicas de estética, studios e barbearias: agenda
                online, clientes, caixa, comissões e aluguel de espaços num lugar só.
              </p>
            </div>

            <div className="lp-rodape-coluna">
              <h3>Produto</h3>
              <a href="#metodo">Como funciona</a>
              <a href="#sistema">Sistema</a>
              <a href="#inteligencia">Inteligência</a>
              <a href="#planos">Planos</a>
              <a href="#duvidas">Dúvidas</a>
            </div>

            <div className="lp-rodape-coluna">
              <h3>Conta</h3>
              <Link to="/login">Entrar</Link>
              <a href="#planos">Criar conta</a>
              <Link to="/esqueci-a-senha">Esqueci a senha</Link>
            </div>

            <div className="lp-rodape-coluna">
              <h3>Legal</h3>
              <Link to="/termos">Termos de uso</Link>
              <Link to="/privacidade">Política de privacidade</Link>
              <a href="mailto:contato@clinistudio.app">Falar com a gente</a>
            </div>
          </div>

          <div className="lp-rodape-fim">
            <span className="lp-rodape-copy">
              © {new Date().getFullYear()} CliniStudio · Gestão para espaços de beleza
            </span>
            <span className="lp-rodape-copy">Feito no Brasil · dados hospedados no Brasil</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
