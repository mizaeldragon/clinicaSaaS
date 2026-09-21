import { useEffect, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { BrandLogo } from '@/components/brand';
import { useAuthStore } from '@/stores/auth.store';
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
    'Organize a agenda',
    'Serviços, horários, equipe e recursos em uma visão clara — o dia inteiro resolvido antes de abrir a porta.',
  ],
  [
    'Atenda com contexto',
    'Histórico, preferências e observações da cliente sempre à mão, para um atendimento que parece pessoal porque é.',
  ],
  [
    'Feche o dia segura',
    'Receitas, despesas, comissões e aluguéis fechados sem calculadora e sem dúvida no fim do mês.',
  ],
];

const MODULOS = [
  {
    tag: 'Núcleo',
    nome: 'Agenda inteligente',
    desc: 'Horário, sala, cadeira e profissional checados juntos — o conflito simplesmente não acontece.',
    metrica: '0 conflitos',
    metricaLabel: 'de sala ou equipamento',
  },
  {
    tag: 'Captação',
    nome: 'Link de agendamento',
    desc: 'Cada profissional divulga o seu link. A cliente marca pelo navegador, sem instalar nada.',
    metrica: '24h',
    metricaLabel: 'agenda aberta, todo dia',
  },
  {
    tag: 'Caixa',
    nome: 'Financeiro organizado',
    desc: 'Entradas, saídas e resultado do mês em uma leitura só, com o que ainda está a receber.',
    metrica: '1 tela',
    metricaLabel: 'para fechar o mês',
  },
  {
    tag: 'Equipe',
    nome: 'Comissões automáticas',
    desc: 'Por serviço ou percentual: o acerto de cada profissional sai calculado no fechamento.',
    metrica: 'Sem planilha',
    metricaLabel: 'relatório pronto para pagar',
  },
  {
    tag: 'Operação',
    nome: 'Recursos e salas',
    desc: 'Salas, cadeiras e equipamentos com disponibilidade própria: livre, em uso ou em manutenção.',
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
    desc: 'Os atendimentos da semana ordenados por quem provavelmente não vem — com o motivo ao lado da nota, para a recepção saber para quem ligar.',
    exemplo: 'Camila · 47% — faltou 4 das 11 vezes e não confirmou',
  },
  {
    tag: 'Buraco na agenda',
    nome: 'Encaixes possíveis',
    desc: 'Os vãos entre um atendimento e outro, e quem já está marcada nos próximos dias e caberia ali. Sugere antecipar, sempre com a mesma profissional.',
    exemplo: '45 min livres às 14h · 3 clientes aceitariam antecipar',
  },
  {
    tag: 'Fim do mês',
    nome: 'Resumo em palavras',
    desc: 'O mês contado em frases, não em gráfico: cresceu ou caiu, por causa do quê, e o que merece atenção — inclusive quem costumava vir e sumiu.',
    exemplo: '+12% em setembro · 4 clientes frequentes não voltaram',
  },
];

const PLANOS = [
  {
    slug: 'starter',
    nome: 'Starter',
    selo: 'Para começar',
    desc: 'Para quem atende sozinha e quer sair do caderno e da planilha.',
    preco: '199,99',
    precoMenor: true,
    itens: [
      'Agenda, clientes e serviços',
      'Link público de agendamento',
      'Controle de caixa do dia',
    ],
  },
  {
    slug: 'pro',
    nome: 'Pro',
    selo: 'Próprio espaço',
    desc: 'Para quem atende no próprio espaço e quer a operação inteira em ordem.',
    preco: '300',
    branco: true,
    itens: [
      'Agenda, clientes e serviços',
      'Financeiro, comissão e relatórios',
      'Risco de falta, encaixes e resumo do mês',
      'Link público de agendamento',
    ],
  },
  {
    slug: 'premium',
    nome: 'Premium',
    selo: 'Mais completo',
    desc: 'Para quem atende e também aluga espaço para outros profissionais.',
    preco: '450',
    navy: true,
    itens: [
      'Tudo do Pro, inteligência inclusa',
      'Aluguel por turno, diária ou mês',
      'Contratos, cobrança e logins separados',
      'Login próprio para cada profissional',
    ],
  },
];

const DUVIDAS = [
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
  [
    'As clientes precisam instalar um aplicativo?',
    'Não. Elas agendam pelo link no navegador, em poucos toques, direto do Instagram ou do WhatsApp.',
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

export function LandingPage() {
  const token = useAuthStore((state) => state.accessToken);
  const [aberta, setAberta] = useState<number>(0);
  const rolou = useRolou();
  const [params] = useSearchParams();

  // Temporário, enquanto a tipografia não está fechada: `?fonte=newsreader` e
  // `?fonte=bodoni` devolvem as serifadas para comparar na própria página. Sai
  // daqui junto com as regras `[data-fonte]` do CSS quando a escolha for feita.
  const pedida = params.get('fonte');
  const fonte = pedida === 'newsreader' || pedida === 'bodoni' ? pedida : undefined;

  if (token) return <Navigate to="/app" replace />;

  return (
    <div className="lp" data-fonte={fonte}>
      {/* ------------------------------------------------------- barra topo */}
      <div className={rolou ? 'lp-topo lp-topo--flutuante' : 'lp-topo'} id="top">
        <div className="lp-wrap lp-pad lp-topo-linha">
          <a href="#top" className="lp-marca" aria-label="CliniStudio, início">
            <BrandLogo className="lp-logo" />
          </a>

          <nav className="lp-nav" aria-label="Navegação principal">
            <a href="#metodo">Método</a>
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
              Começar grátis
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
              <span>Gestão feita para beleza</span>
              <span className="calado">· Beleza · Estética · Barbearia</span>
            </p>

            <h1 className="lp-h1">
              Seu tempo com as clientes. <span className="lp-it">A ordem</span> com o CliniStudio.
            </h1>

            <p className="lp-hero-sub">
              Agenda, clientes, caixa e espaços operando como uma coisa só. Nada de cadernos, grupos
              e planilhas disputando a sua atenção.
            </p>

            <div className="lp-hero-cta">
              <a href="#planos" className="lp-btn lp-btn-cheio">
                Começar grátis <span aria-hidden>→</span>
              </a>
              <a href="#metodo" className="lp-btn lp-btn-vazio">
                Ver o sistema
              </a>
            </div>

            <p className="lp-hero-nota">
              <i />5 dias gratuitos · sem cartão de crédito
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
            A gestão do espaço não precisa <span className="lp-it">tomar o seu dia.</span>
          </h2>
          <p className="lp-lead">
            Três movimentos simples que substituem a improvisação do dia a dia por um método.
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
                <span>Seu espaço, no controle</span>
              </p>
              <h2 className="lp-h2">
                Tudo para atender bem e <span className="lp-it">decidir melhor.</span>
              </h2>
            </div>
            <p className="lp-sistema-lead">
              Cinco módulos que conversam entre si — cada um resolvendo uma parte concreta do seu
              dia.
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
                Turno, diária ou mês: contratos, cobrança e logins separados — sem você virando
                síndica.
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
              Uma agenda que parece <span className="lp-it">parte da sua marca.</span>
            </h2>
            <p className="lp-agenda-sub">
              Cada profissional tem o seu próprio link. A cliente agenda direto com quem atende, no
              horário em que ela está no espaço.
            </p>

            <div className="lp-lista">
              {[
                ['I', 'Link individual para divulgar'],
                ['II', 'Disponibilidade baseada no uso do espaço'],
                ['III', 'Sem conflito de sala, cadeira ou equipamento'],
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
                O seu histórico <span className="lp-it">avisando antes.</span>
              </h2>
            </div>
            <p className="lp-ia-lead">
              Cada atendimento que passou deixou uma pista. O sistema lê as suas e responde três
              perguntas que ninguém tem tempo de calcular no meio do expediente.
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
            Comece pelo que o seu <span className="lp-it">espaço precisa.</span>
          </h2>

          <div className="lp-planos-grid">
            {PLANOS.map((plano) => (
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
                  <span className="lp-plano-selo">{plano.selo}</span>
                </div>

                <p className="lp-plano-desc">{plano.desc}</p>

                <div className="lp-plano-preco">
                  <span className="moeda">R$</span>
                  <span className={plano.precoMenor ? 'valor menor' : 'valor'}>{plano.preco}</span>
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

                <p className="lp-plano-rodape">Pagamento mensal · cancele quando quiser</p>
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
              Quer testar antes de assinar? Comece com <b>5 dias grátis</b>, com todos os recursos e
              sem cartão de crédito.
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
              Menos tempo organizando. <em>Mais tempo fazendo seu espaço acontecer.</em>
            </h2>
            <p>
              Crie sua conta e teste a gestão do CliniStudio sem compromisso — 5 dias, sem cartão.
            </p>
            <a href="#planos" className="lp-btn lp-btn-branco">
              Começar grátis <span aria-hidden>→</span>
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
                Agenda, clientes, caixa e aluguel de espaços num lugar só — para salões,
                clínicas de estética, barbearias e espaços compartilhados de beleza.
              </p>
            </div>

            <div className="lp-rodape-coluna">
              <h3>Produto</h3>
              <a href="#metodo">Método</a>
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
