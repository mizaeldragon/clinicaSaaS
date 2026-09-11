import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import {
  ArrowRight,
  CalendarCheck,
  CalendarDays,
  Check,
  ChevronDown,
  Clock,
  KeyRound,
  Link2,
  Lock,
  Menu,
  Palette,
  Receipt,
  Smartphone,
  Sparkles,
  TrendingUp,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { cn } from '@/lib/utils';

/**
 * Vitrine do produto.
 *
 * Usa a mesma linguagem visual do login: fundo slate-950 com os halos violeta e
 * rosa, e o roxo da marca nas ações. O ritmo alterna seções escuras e claras
 * para que cada bloco tenha peso próprio em vez de virar uma lista de cartões.
 */

const GLOW_VIOLET = 'radial-gradient(circle, #7C3AED, transparent 65%)';
const GLOW_PINK = 'radial-gradient(circle, #EC4899, transparent 65%)';

/** Halos do login, reaproveitados nas seções escuras. */
function Glows({ className }: { className?: string }) {
  return (
    <div className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}>
      <div
        className="absolute -left-32 -top-40 size-[520px] rounded-full opacity-30 blur-3xl"
        style={{ background: GLOW_VIOLET }}
      />
      <div
        className="absolute -bottom-48 -right-24 size-[520px] rounded-full opacity-25 blur-3xl"
        style={{ background: GLOW_PINK }}
      />
    </div>
  );
}

function Eyebrow({ children, dark = false }: { children: React.ReactNode; dark?: boolean }) {
  return (
    <p
      className={cn(
        'mb-4 text-xs font-semibold uppercase tracking-[0.2em]',
        dark ? 'text-violet-300' : 'text-primary',
      )}
    >
      {children}
    </p>
  );
}

export function LandingPage() {
  const token = useAuthStore((s) => s.accessToken);

  // Quem já está logado não precisa da vitrine.
  if (token) return <Navigate to="/app" replace />;

  return (
    <div className="min-h-screen scroll-smooth bg-background text-foreground">
      <Header />
      <Hero />
      <Audience />
      <Pain />
      <Portfolio />
      <PublicLinks />
      <Features />
      <Plans />
      <WhiteLabel />
      <Faq />
      <FinalCta />
      <Footer />
    </div>
  );
}

/* ------------------------------------------------------------------ topo */

const NAV = [
  { href: '#como-funciona', label: 'Como funciona' },
  { href: '#recursos', label: 'Recursos' },
  { href: '#planos', label: 'Planos' },
  { href: '#duvidas', label: 'Dúvidas' },
];

function Header() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-slate-950/80 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-6xl items-center gap-4 px-6 py-3.5">
        <a href="#topo" className="flex items-center gap-2.5 text-white">
          <span className="flex size-9 items-center justify-center rounded-xl bg-white/10 backdrop-blur">
            <Sparkles className="size-4" />
          </span>
          <span className="text-lg font-semibold tracking-tight">Belezza</span>
        </a>

        <nav className="ml-8 hidden items-center gap-8 lg:flex">
          {NAV.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm text-white/60 transition-colors hover:text-white"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <Link
            to="/login"
            className="hidden rounded-lg px-4 py-2 text-sm font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white sm:block"
          >
            Entrar
          </Link>
          <Link
            to="/cadastro"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Testar grátis
          </Link>
          <button
            type="button"
            className="ml-1 text-white lg:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-label="Menu"
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      {open ? (
        <nav className="border-t border-white/10 px-6 py-2 lg:hidden">
          {NAV.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="block py-2.5 text-sm text-white/70"
            >
              {link.label}
            </a>
          ))}
        </nav>
      ) : null}
    </header>
  );
}

/* ------------------------------------------------------------------ hero */

function Hero() {
  return (
    <section id="topo" className="relative overflow-hidden bg-slate-950 text-white">
      <Glows />

      <div className="relative mx-auto w-full max-w-6xl px-6 pb-28 pt-16 sm:pt-20 lg:pb-36">
        <div className="grid items-center gap-14 lg:grid-cols-[1.02fr_1fr]">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-xs font-medium text-white/80 backdrop-blur">
              <KeyRound className="size-3.5" />
              Para quem atende — e para quem também aluga
            </span>

            <h1 className="mt-7 text-[2.6rem] font-semibold leading-[1.06] tracking-tight sm:text-6xl">
              A agenda da sua clínica e o aluguel do seu espaço,{' '}
              <span className="bg-gradient-to-r from-violet-400 via-fuchsia-400 to-pink-400 bg-clip-text text-transparent">
                no mesmo lugar.
              </span>
            </h1>

            <p className="mt-7 max-w-xl text-lg leading-relaxed text-white/65">
              Belezza organiza o dia a dia de salões, studios e clínicas de estética — e foi
              desenhado também para quem <strong className="font-medium text-white">aluga
              cadeira, mesa ou sala</strong> para outras profissionais. Cada uma com a própria
              agenda, as próprias clientes e o próprio link de agendamento.
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link
                to="/cadastro"
                className="group inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3.5 font-medium text-primary-foreground transition-opacity hover:opacity-90"
              >
                Começar teste de 14 dias
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <a
                href="#como-funciona"
                className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-6 py-3.5 font-medium text-white transition-colors hover:bg-white/10"
              >
                Ver como funciona
              </a>
            </div>

            <p className="mt-6 text-sm text-white/45">
              Sem cartão de crédito · Sem instalar nada · Funciona no celular
            </p>
          </div>

          <AgendaMock />
        </div>
      </div>

      {/* Emenda suave com a seção clara seguinte. */}
      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-background" />
    </section>
  );
}

/** Ilustração da agenda — desenho, não captura de tela. */
function AgendaMock() {
  const rows = [
    { time: '08:00', name: 'Ana Ribeiro', tag: 'Salão · Manhã', rented: true },
    { time: '09:30', name: 'Limpeza de pele', tag: 'Camila M.', rented: false },
    { time: '11:00', name: 'Massagem modeladora', tag: 'Renata P.', rented: false },
    { time: '13:00', name: 'Bia Nunes', tag: 'Mesa 01 · Tarde', rented: true },
    { time: '15:00', name: 'Limpeza de pele', tag: 'Júlia F.', rented: false },
  ];

  return (
    <div className="relative">
      <div className="absolute -inset-px rounded-[26px] bg-gradient-to-br from-violet-500/40 via-fuchsia-500/20 to-transparent" />
      <div className="relative rounded-3xl border border-white/10 bg-slate-900/80 p-5 backdrop-blur-xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold">Terça-feira</p>
            <p className="text-xs text-white/45">5 compromissos</p>
          </div>
          <span className="rounded-lg border border-white/10 px-2.5 py-1 text-[11px] text-white/60">
            Hoje
          </span>
        </div>

        <div className="space-y-2">
          {rows.map((row) => (
            <div
              key={row.time}
              className={cn(
                'flex items-center gap-3 rounded-xl border-l-2 py-2.5 pl-3 pr-2.5',
                row.rented
                  ? 'border-l-violet-400 bg-violet-500/10'
                  : 'border-l-white/20 bg-white/[0.04]',
              )}
            >
              <span className="w-11 shrink-0 text-xs tabular-nums text-white/45">{row.time}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{row.name}</p>
                <p className="truncate text-xs text-white/45">{row.tag}</p>
              </div>
              {row.rented ? (
                <span className="shrink-0 rounded-md bg-violet-500/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-200">
                  alugado
                </span>
              ) : null}
            </div>
          ))}
        </div>

        <p className="mt-4 border-t border-white/10 pt-3 text-[11px] leading-relaxed text-white/45">
          Os turnos alugados aparecem como <strong className="font-medium text-white/80">ocupação</strong> —
          quem alugou, qual espaço, se pagou. O atendimento de quem aluga é dela, e não aparece aqui.
        </p>
      </div>
    </div>
  );
}

/* --------------------------------------------------------- para quem é */

function Audience() {
  const kinds = [
    'Salões de beleza',
    'Studios de unhas',
    'Clínicas de estética',
    'Barbearias',
    'Studios de sobrancelha',
    'Espaços compartilhados',
  ];

  return (
    <section className="border-b bg-background px-6 py-10">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-center gap-x-3 gap-y-2">
        <span className="mr-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Feito para
        </span>
        {kinds.map((kind) => (
          <span
            key={kind}
            className="rounded-full border bg-card px-3.5 py-1.5 text-sm text-muted-foreground"
          >
            {kind}
          </span>
        ))}
      </div>
    </section>
  );
}

/* --------------------------------------------------------------- a dor */

function Pain() {
  const items = [
    {
      icon: CalendarDays,
      title: 'A agenda mora no caderno',
      text: 'Você rabisca, apaga, e no fim do mês não sabe quantos atendimentos fez nem quanto entrou.',
    },
    {
      icon: Smartphone,
      title: 'Cada horário vira uma conversa',
      text: '"Tem vaga quinta?" · "Que horas?" · "Quanto fica?" — dez mensagens para marcar um corte.',
    },
    {
      icon: KeyRound,
      title: 'Ninguém sabe quem está no espaço',
      text: 'Quem alugou a cadeira hoje? Pagou? A sala está livre amanhã à tarde? Ninguém sabe de cabeça.',
    },
    {
      icon: Wallet,
      title: 'O dinheiro se mistura',
      text: 'O que é do aluguel, o que é do seu atendimento e o que é da profissional que trabalha ali.',
    },
  ];

  return (
    <section className="px-6 py-24">
      <div className="mx-auto w-full max-w-6xl">
        <div className="mx-auto max-w-2xl text-center">
          <Eyebrow>O problema</Eyebrow>
          <h2 className="text-3xl font-semibold tracking-tight sm:text-[2.6rem] sm:leading-[1.15]">
            Você abriu um espaço de beleza. Não uma central de recados.
          </h2>
          <p className="mt-5 text-lg text-muted-foreground">
            Quanto maior o espaço, mais tempo some em coisas que não são o seu trabalho.
          </p>
        </div>

        <div className="mt-14 grid gap-px overflow-hidden rounded-2xl border bg-border sm:grid-cols-2 lg:grid-cols-4">
          {items.map((item) => (
            <div key={item.title} className="bg-card p-6">
              <item.icon className="mb-4 size-5 text-primary" />
              <h3 className="mb-2 font-semibold">{item.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{item.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------ dois negócios, um sistema */

function Portfolio() {
  const owner = [
    'A agenda e as clientes da sua sala',
    'O seu faturamento, separado de tudo',
    'Quem alugou, qual espaço, qual turno',
    'Quem já pagou e quem está devendo',
    'Aluguel por turno, diária, semana ou mês',
  ];

  const renter = [
    'A agenda dela, com as clientes dela',
    'O link de agendamento dela',
    'Os turnos que alugou e as faturas',
    'Cadastro e histórico das próprias clientes',
    'Nada do seu negócio — nem do da vizinha',
  ];

  return (
    <section id="como-funciona" className="relative overflow-hidden bg-slate-950 px-6 py-24 text-white">
      <Glows />

      <div className="relative mx-auto w-full max-w-6xl">
        <div className="mx-auto max-w-2xl text-center">
          <Eyebrow dark>A parte difícil</Eyebrow>
          <h2 className="text-3xl font-semibold tracking-tight sm:text-[2.6rem] sm:leading-[1.15]">
            Dois negócios debaixo do mesmo teto — e uma parede entre eles.
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-white/60">
            Quando você aluga uma cadeira, você é{' '}
            <strong className="font-medium text-white">locadora, não sócia</strong>. Quem aluga monta
            o próprio negócio ali dentro: cliente dela, agenda dela, dinheiro dela. Você fatura o
            turno — e só o turno.
          </p>
        </div>

        <div className="mt-14 grid gap-5 lg:grid-cols-2">
          <PortfolioCard
            icon={Users}
            title="Você, a dona"
            subtitle="Atende e aluga"
            items={owner}
            highlighted
          />
          <PortfolioCard
            icon={KeyRound}
            title="Quem aluga de você"
            subtitle="Entra com o login dela"
            items={renter}
          />
        </div>

        <div className="mt-5 flex items-start gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-6">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/15 text-violet-300">
            <Lock className="size-5" />
          </span>
          <p className="text-sm leading-relaxed text-white/60">
            <strong className="font-medium text-white">
              A separação é de verdade, não é só o menu escondido.
            </strong>{' '}
            Você não consegue abrir a agenda de quem aluga nem digitando o endereço, e ela não
            consegue ver a sua. Só a sala continua compartilhada: o sistema impede duas pessoas de
            marcarem no mesmo espaço, no mesmo horário, sem revelar de quem é o outro atendimento.
          </p>
        </div>
      </div>
    </section>
  );
}

function PortfolioCard({
  icon: Icon,
  title,
  subtitle,
  items,
  highlighted = false,
}: {
  icon: typeof Users;
  title: string;
  subtitle: string;
  items: string[];
  highlighted?: boolean;
}) {
  return (
    <div
      className={cn(
        'rounded-2xl border p-7',
        highlighted ? 'border-violet-400/30 bg-violet-500/10' : 'border-white/10 bg-white/[0.04]',
      )}
    >
      <div className="mb-6 flex items-center gap-3">
        <span
          className={cn(
            'flex size-11 items-center justify-center rounded-xl',
            highlighted ? 'bg-primary text-primary-foreground' : 'bg-white/10 text-white',
          )}
        >
          <Icon className="size-5" />
        </span>
        <div>
          <p className="font-semibold">{title}</p>
          <p className="text-sm text-white/50">{subtitle}</p>
        </div>
      </div>
      <ul className="space-y-3">
        {items.map((line) => (
          <li key={line} className="flex gap-3 text-sm text-white/75">
            <Check className="mt-0.5 size-4 shrink-0 text-violet-300" />
            <span>{line}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------ links públicos */

function PublicLinks() {
  const points = [
    {
      icon: Link2,
      title: 'Link individual, pronto na hora',
      text: 'Nasce com o cadastro da profissional. Ela copia do próprio painel.',
    },
    {
      icon: Clock,
      title: 'Só aparece quem está no espaço naquele dia',
      text: 'Alugou a terça de manhã? Terça de manhã é o horário que a cliente enxerga.',
    },
    {
      icon: CalendarCheck,
      title: 'Sem choque de horário, nunca',
      text: 'A sala reservada bloqueia a agenda de todo mundo, mesmo de quem não a enxerga.',
    },
  ];

  return (
    <section className="px-6 py-24">
      <div className="mx-auto grid w-full max-w-6xl items-center gap-16 lg:grid-cols-[1fr_0.85fr]">
        <div>
          <Eyebrow>Agendamento online</Eyebrow>
          <h2 className="text-3xl font-semibold tracking-tight sm:text-[2.6rem] sm:leading-[1.15]">
            Um link para o espaço. E um para cada profissional.
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-muted-foreground">
            Cada profissional recebe o próprio endereço para colar na bio do Instagram. Quem abre vê
            a marca da casa, mas só o nome e os serviços de quem mandou o link — e marca direto com
            ela.
          </p>

          <ul className="mt-9 space-y-6">
            {points.map((point) => (
              <li key={point.title} className="flex gap-4">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <point.icon className="size-4" />
                </span>
                <div>
                  <p className="font-medium">{point.title}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">{point.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <PhoneMock />
      </div>
    </section>
  );
}

function PhoneMock() {
  const services = [
    { name: 'Corte', time: '60 min', price: 'R$ 80,00' },
    { name: 'Escova', time: '45 min', price: 'R$ 70,00' },
    { name: 'Lavagem + finalização', time: '30 min', price: 'R$ 50,00' },
  ];

  return (
    <div className="mx-auto w-full max-w-[300px]">
      <div className="rounded-[2.2rem] border-8 border-slate-900 bg-card shadow-2xl">
        <div className="rounded-[1.6rem] p-4">
          <div className="mb-5 flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Sparkles className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">Ana Ribeiro</p>
              <p className="truncate text-xs text-muted-foreground">Espaço Márcia Vaz</p>
            </div>
          </div>

          <div className="mb-4 flex gap-1.5">
            <span className="h-1 flex-1 rounded-full bg-primary" />
            <span className="h-1 flex-1 rounded-full bg-muted" />
            <span className="h-1 flex-1 rounded-full bg-muted" />
            <span className="h-1 flex-1 rounded-full bg-muted" />
          </div>

          <p className="mb-1 text-sm font-medium">O que você quer agendar?</p>
          <p className="mb-3 text-[11px] uppercase tracking-wider text-muted-foreground">Cabelo</p>

          <div className="space-y-2">
            {services.map((service) => (
              <div
                key={service.name}
                className="flex items-center justify-between rounded-xl border px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{service.name}</p>
                  <p className="text-xs text-muted-foreground">{service.time}</p>
                </div>
                <p className="shrink-0 text-sm font-semibold">{service.price}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ recursos */

function Features() {
  return (
    <section id="recursos" className="border-y bg-muted/30 px-6 py-24">
      <div className="mx-auto w-full max-w-6xl">
        <div className="mx-auto max-w-2xl text-center">
          <Eyebrow>Recursos</Eyebrow>
          <h2 className="text-3xl font-semibold tracking-tight sm:text-[2.6rem] sm:leading-[1.15]">
            Tudo que o dia pede — e nada que você não use.
          </h2>
          <p className="mt-5 text-lg text-muted-foreground">
            Cada empresa liga só os módulos de que precisa. O menu muda junto.
          </p>
        </div>

        <div className="mt-14 grid gap-5 lg:grid-cols-3">
          <FeatureCard
            icon={CalendarDays}
            title="Agenda que não deixa marcar errado"
            text="Dia, semana e mês. Confere jornada, intervalo, folga, sala e equipamento antes de aceitar. No celular, vira a lista do dia."
            className="lg:col-span-2"
            wide
          />
          <FeatureCard
            icon={Users}
            title="Ficha completa da cliente"
            text="Histórico, quanto já gastou, última visita, aniversário e observações que só você vê."
          />
          <FeatureCard
            icon={KeyRound}
            title="Aluguel por turno, diária, semana ou mês"
            text="Preço por espaço e por turno. Reserve o mês inteiro de uma vez, com o valor somado antes de confirmar — dias ocupados são pulados sozinhos."
          />
          <FeatureCard
            icon={Wallet}
            title="Caixa sem planilha"
            text="A receita entra ao finalizar o atendimento. Despesas por categoria, o que está a receber e o lucro do mês."
          />
          <FeatureCard
            icon={Receipt}
            title="Comissão calculada sozinha"
            text="Percentual ou valor fixo, por profissional ou por serviço. Fechamento sem calculadora."
          />
          <FeatureCard
            icon={TrendingUp}
            title="Relatórios que cabem numa olhada"
            text="Faturamento do mês, ticket médio, taxa de cancelamento e desempenho de cada profissional."
            className="lg:col-span-2"
            wide
          />
          <FeatureCard
            icon={Smartphone}
            title="Funciona no celular"
            text="É um site: abre no navegador do telefone, do tablet e do computador. Nada para instalar."
          />
        </div>
      </div>
    </section>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  text,
  className,
  wide = false,
}: {
  icon: typeof Users;
  title: string;
  text: string;
  className?: string;
  wide?: boolean;
}) {
  return (
    <div
      className={cn(
        'rounded-2xl border bg-card p-7 transition-shadow hover:shadow-lg',
        className,
      )}
    >
      <span className="mb-5 flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Icon className="size-5" />
      </span>
      <h3 className={cn('mb-2 font-semibold', wide && 'text-lg')}>{title}</h3>
      <p className={cn('leading-relaxed text-muted-foreground', wide ? 'max-w-lg' : 'text-sm')}>
        {text}
      </p>
    </div>
  );
}

/* -------------------------------------------------------------- planos */

function Plans() {
  const pro = [
    'Agenda com prevenção de conflitos',
    'Clientes com histórico e timeline',
    'Serviços, preços e durações',
    'Equipe, jornada e folgas',
    'Salas, cadeiras e equipamentos',
    'Financeiro e comissões',
    'Relatórios do mês',
    'Link público de agendamento',
  ];

  const premium = [
    'Aluguel por turno, diária, semana ou mês',
    'Preço por espaço × turno',
    'Contratos recorrentes e cobrança do aluguel',
    'Login próprio para quem aluga',
    'Agenda e clientes separadas por profissional',
    'Link público individual para cada uma',
    'Mapa do dia: quem está em cada espaço',
  ];

  return (
    <section id="planos" className="px-6 py-24">
      <div className="mx-auto w-full max-w-6xl">
        <div className="mx-auto max-w-2xl text-center">
          <Eyebrow>Planos</Eyebrow>
          <h2 className="text-3xl font-semibold tracking-tight sm:text-[2.6rem] sm:leading-[1.15]">
            Dois planos. A diferença é o aluguel.
          </h2>
          <p className="mt-5 text-lg text-muted-foreground">
            Se você só atende, o Pro resolve. Se você também aluga espaço, o Premium é o seu.
          </p>
        </div>

        <div className="mx-auto mt-14 grid max-w-4xl items-start gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border bg-card p-8">
            <h3 className="text-xl font-semibold">Pro</h3>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Para a clínica, o salão ou o studio que atende as próprias clientes.
            </p>
            <p className="mt-7">
              <span className="text-4xl font-semibold tracking-tight">R$ 300</span>
              <span className="text-lg text-muted-foreground">/mês</span>
            </p>
            <Link
              to="/cadastro"
              className="mt-7 block rounded-xl border py-3 text-center font-medium transition-colors hover:bg-muted"
            >
              Testar 14 dias grátis
            </Link>
            <ul className="mt-8 space-y-3">
              {pro.map((line) => (
                <li key={line} className="flex gap-3 text-sm">
                  <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="relative rounded-2xl bg-gradient-to-br from-violet-500 via-fuchsia-500 to-pink-500 p-px">
            <div className="rounded-[calc(1rem-1px)] bg-card p-8">
              <span className="absolute -top-3 left-8 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-white">
                Espaço compartilhado
              </span>
              <h3 className="text-xl font-semibold">Premium</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Para quem aluga cadeira, mesa ou sala para outras profissionais.
              </p>
              <p className="mt-7">
                <span className="text-4xl font-semibold tracking-tight">R$ 450</span>
                <span className="text-lg text-muted-foreground">/mês</span>
              </p>
              <Link
                to="/cadastro"
                className="mt-7 block rounded-xl bg-primary py-3 text-center font-medium text-primary-foreground transition-opacity hover:opacity-90"
              >
                Testar 14 dias grátis
              </Link>
              <p className="mt-8 text-sm font-medium">Tudo do Pro, mais:</p>
              <ul className="mt-3 space-y-3">
                {premium.map((line) => (
                  <li key={line} className="flex gap-3 text-sm">
                    <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <p className="mt-9 text-center text-sm text-muted-foreground">
          14 dias grátis nos dois, sem cartão. Cancele quando quiser.
        </p>
      </div>
    </section>
  );
}

/* --------------------------------------------------------- white label */

const SWATCHES = [
  { hex: '#7C3AED', name: 'Violeta' },
  { hex: '#4B7C5B', name: 'Verde' },
  { hex: '#EC4899', name: 'Rosa' },
  { hex: '#0EA5E9', name: 'Azul' },
  { hex: '#B45309', name: 'Âmbar' },
  { hex: '#0F172A', name: 'Grafite' },
];

function WhiteLabel() {
  const [color, setColor] = useState(SWATCHES[0].hex);

  return (
    <section className="border-y bg-muted/30 px-6 py-24">
      <div className="mx-auto grid w-full max-w-6xl items-center gap-14 lg:grid-cols-2">
        <div>
          <Eyebrow>Sua marca</Eyebrow>
          <h2 className="text-3xl font-semibold tracking-tight sm:text-[2.6rem] sm:leading-[1.15]">
            O painel fica na cor da sua casa.
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-muted-foreground">
            Escolha a cor da sua marca em Configurações e o sistema inteiro se ajusta — botões,
            menu, gráficos e, principalmente, a página pública que as suas clientes abrem. Suba o
            seu logo e o link de agendamento passa a ser a sua cara, não a nossa.
          </p>

          <div className="mt-8">
            <p className="mb-3 text-sm font-medium">Experimente:</p>
            <div className="flex flex-wrap items-center gap-2.5">
              {SWATCHES.map((swatch) => (
                <button
                  key={swatch.hex}
                  type="button"
                  onClick={() => setColor(swatch.hex)}
                  aria-label={swatch.name}
                  className={cn(
                    'size-10 rounded-xl ring-offset-2 ring-offset-background transition-all',
                    color === swatch.hex ? 'ring-2 ring-foreground' : 'hover:scale-105',
                  )}
                  style={{ backgroundColor: swatch.hex }}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border bg-card p-6 shadow-sm">
          <div className="mb-5 flex items-center gap-3">
            <span
              className="flex size-10 items-center justify-center rounded-xl text-white transition-colors"
              style={{ backgroundColor: color }}
            >
              <Palette className="size-4" />
            </span>
            <div>
              <p className="text-sm font-medium">Espaço Márcia Vaz</p>
              <p className="text-xs text-muted-foreground">Página pública de agendamento</p>
            </div>
          </div>

          <div className="space-y-2.5 rounded-xl border p-4">
            <div className="flex gap-1.5">
              <span
                className="h-1 flex-1 rounded-full transition-colors"
                style={{ backgroundColor: color }}
              />
              <span className="h-1 flex-1 rounded-full bg-muted" />
              <span className="h-1 flex-1 rounded-full bg-muted" />
            </div>
            <div className="h-2.5 w-3/4 rounded-full bg-muted" />
            <div className="h-2.5 w-1/2 rounded-full bg-muted" />
            <div
              className="mt-4 rounded-lg py-2.5 text-center text-xs font-medium text-white transition-colors"
              style={{ backgroundColor: color }}
            >
              Confirmar agendamento
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------- dúvidas */

const QUESTIONS = [
  {
    q: 'Quem aluga o espaço precisa pagar o sistema também?',
    a: 'Não. A assinatura é sua. As profissionais que alugam entram com um login que você cria, sem custo por pessoa — você paga um plano para o espaço inteiro.',
  },
  {
    q: 'Eu consigo ver a agenda e o faturamento de quem aluga?',
    a: 'Não, e é de propósito. Você é a locadora: vê qual espaço foi alugado, por quem, em qual turno e se já pagou. O atendimento e as clientes são do negócio dela — do mesmo jeito que o dono da sala comercial não vê a agenda do dentista que aluga a sala.',
  },
  {
    q: 'E se duas profissionais tentarem usar a mesma sala no mesmo horário?',
    a: 'O sistema não deixa. A sala é física e compartilhada, então uma reserva bloqueia a agenda de todo mundo — mesmo de quem não enxerga o atendimento da outra. Quem tentar marcar recebe um aviso de horário ocupado, sem saber de quem é.',
  },
  {
    q: 'Dá para alugar o mês inteiro de uma vez?',
    a: 'Dá. Você escolhe o período (este dia, esta semana, este mês ou uma data específica), quais dias da semana e quais turnos. O sistema mostra quantos turnos entram e o valor total antes de confirmar, e pula sozinho os dias já ocupados.',
  },
  {
    q: 'Minhas clientes precisam baixar aplicativo?',
    a: 'Não. Elas abrem o link no navegador do celular, escolhem o serviço, o dia e o horário, e pronto. Você recebe o agendamento na hora.',
  },
  {
    q: 'Meus dados ficam misturados com os de outros salões?',
    a: 'Nunca. Cada empresa é isolada no sistema, e o isolamento é garantido no servidor — não depende de o programa lembrar de filtrar. Nenhuma empresa consegue ler dado de outra, por nenhum caminho.',
  },
  {
    q: 'Posso começar só com a agenda e crescer depois?',
    a: 'Pode. No primeiro acesso você responde algumas perguntas e o sistema liga apenas os módulos que fazem sentido para o seu caso. Dá para ativar o resto quando quiser, em Configurações.',
  },
];

function Faq() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="duvidas" className="px-6 py-24">
      <div className="mx-auto w-full max-w-3xl">
        <div className="text-center">
          <Eyebrow>Dúvidas</Eyebrow>
          <h2 className="text-3xl font-semibold tracking-tight sm:text-[2.6rem] sm:leading-[1.15]">
            O que costumam perguntar antes de assinar
          </h2>
        </div>

        <div className="mt-12 divide-y rounded-2xl border bg-card">
          {QUESTIONS.map((item, index) => (
            <div key={item.q}>
              <button
                type="button"
                onClick={() => setOpen(open === index ? null : index)}
                className="flex w-full items-center gap-4 px-6 py-5 text-left"
              >
                <span className="flex-1 font-medium">{item.q}</span>
                <ChevronDown
                  className={cn(
                    'size-4 shrink-0 text-muted-foreground transition-transform',
                    open === index && 'rotate-180',
                  )}
                />
              </button>
              {open === index ? (
                <p className="px-6 pb-5 text-sm leading-relaxed text-muted-foreground">{item.a}</p>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------ CTA final */

function FinalCta() {
  return (
    <section className="relative overflow-hidden bg-slate-950 px-6 py-24 text-white">
      <Glows />

      <div className="relative mx-auto w-full max-w-3xl text-center">
        <h2 className="text-3xl font-semibold tracking-tight sm:text-[2.75rem] sm:leading-[1.12]">
          Comece hoje com a agenda organizada.
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-lg text-white/60">
          Catorze dias para usar tudo, sem cartão. Se não servir, é só parar — seus dados continuam
          seus.
        </p>
        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/cadastro"
            className="group inline-flex items-center gap-2 rounded-xl bg-primary px-7 py-3.5 font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Criar minha conta
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <Link
            to="/login"
            className="rounded-xl border border-white/15 px-7 py-3.5 font-medium text-white transition-colors hover:bg-white/10"
          >
            Já tenho conta
          </Link>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-white/10 bg-slate-950 px-6 py-10 text-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-5 sm:flex-row">
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-lg bg-white/10">
            <Sparkles className="size-3.5" />
          </span>
          <span className="font-semibold">Belezza</span>
        </div>
        <p className="text-sm text-white/40">
          © {new Date().getFullYear()} Belezza · Plataforma SaaS multiempresa
        </p>
        <div className="flex items-center gap-6">
          <Link to="/login" className="text-sm text-white/60 transition-colors hover:text-white">
            Entrar
          </Link>
          <Link to="/cadastro" className="text-sm text-white/60 transition-colors hover:text-white">
            Criar conta
          </Link>
        </div>
      </div>
    </footer>
  );
}
