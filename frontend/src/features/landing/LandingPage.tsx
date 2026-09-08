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
  Palette,
  Receipt,
  Smartphone,
  Sparkles,
  Users,
  Wallet,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { cn } from '@/lib/utils';

/**
 * Página de apresentação do SaaS.
 *
 * Paleta própria — areia, creme e café — declarada em classes locais em vez dos
 * tokens do painel. O painel é white label e muda de cor conforme a empresa
 * logada; a marca do produto não pode mudar junto.
 */

const SAND = 'bg-[#FAF7F2]';
const INK = 'text-[#2B2520]';
const MUTED = 'text-[#6F6255]';
const LINE = 'border-[#E4DACB]';
const ACCENT = 'bg-[#8A6A4F]';
const ACCENT_TEXT = 'text-[#8A6A4F]';

function Section({
  children,
  className,
  id,
}: {
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={cn('px-6 py-20 sm:py-24', className)}>
      <div className="mx-auto w-full max-w-6xl">{children}</div>
    </section>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className={cn('mb-3 text-xs font-semibold uppercase tracking-[0.18em]', ACCENT_TEXT)}>
      {children}
    </p>
  );
}

export function LandingPage() {
  const token = useAuthStore((s) => s.accessToken);

  // Quem já está logado não precisa da vitrine.
  if (token) return <Navigate to="/app" replace />;

  return (
    <div className={cn('min-h-screen scroll-smooth', SAND, INK)}>
      <Header />
      <Hero />
      <Pain />
      <TwoBusinesses />
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

function Header() {
  const [open, setOpen] = useState(false);

  const links = [
    { href: '#dois-negocios', label: 'Como funciona' },
    { href: '#recursos', label: 'Recursos' },
    { href: '#planos', label: 'Planos' },
    { href: '#duvidas', label: 'Dúvidas' },
  ];

  return (
    <header className={cn('sticky top-0 z-40 border-b bg-[#FAF7F2]/85 backdrop-blur', LINE)}>
      <div className="mx-auto flex w-full max-w-6xl items-center gap-4 px-6 py-4">
        <div className="flex items-center gap-2.5">
          <div className={cn('flex size-9 items-center justify-center rounded-xl', ACCENT)}>
            <Sparkles className="size-4 text-white" />
          </div>
          <span className="text-lg font-semibold tracking-tight">Belezza</span>
        </div>

        <nav className="ml-6 hidden items-center gap-7 md:flex">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className={cn('text-sm transition-colors hover:text-[#2B2520]', MUTED)}
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <Link
            to="/login"
            className={cn(
              'hidden rounded-lg px-4 py-2 text-sm font-medium transition-colors hover:bg-[#EFE8DD] sm:block',
              MUTED,
            )}
          >
            Entrar
          </Link>
          <Link
            to="/cadastro"
            className={cn(
              'rounded-lg px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90',
              ACCENT,
            )}
          >
            Testar grátis
          </Link>
          <button
            type="button"
            className="ml-1 md:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-label="Menu"
          >
            <ChevronDown className={cn('size-5 transition-transform', open && 'rotate-180')} />
          </button>
        </div>
      </div>

      {open ? (
        <nav className={cn('border-t px-6 py-3 md:hidden', LINE)}>
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className={cn('block py-2 text-sm', MUTED)}
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
    <Section className="pt-16 sm:pt-20">
      <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_1fr]">
        <div>
          <span
            className={cn(
              'inline-flex items-center gap-2 rounded-full border bg-white px-3 py-1 text-xs font-medium',
              LINE,
              MUTED,
            )}
          >
            <KeyRound className="size-3.5" />
            Feito para quem atende — e para quem também aluga
          </span>

          <h1 className="mt-6 text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl lg:text-[3.4rem]">
            A agenda da sua clínica e o aluguel do seu espaço,{' '}
            <span className={ACCENT_TEXT}>no mesmo lugar.</span>
          </h1>

          <p className={cn('mt-6 max-w-xl text-lg leading-relaxed', MUTED)}>
            Belezza organiza o dia a dia de salões, studios e clínicas de estética — e foi
            desenhado também para quem <strong className={INK}>aluga cadeira, mesa ou sala</strong>{' '}
            para outras profissionais. Cada uma com a própria agenda, as próprias clientes e o
            próprio link de agendamento. Você fatura o aluguel sem se meter no negócio de ninguém.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              to="/cadastro"
              className={cn(
                'inline-flex items-center gap-2 rounded-xl px-6 py-3.5 font-medium text-white transition-opacity hover:opacity-90',
                ACCENT,
              )}
            >
              Começar teste de 14 dias
              <ArrowRight className="size-4" />
            </Link>
            <a
              href="#dois-negocios"
              className={cn(
                'inline-flex items-center gap-2 rounded-xl border bg-white px-6 py-3.5 font-medium transition-colors hover:bg-[#F5F0E8]',
                LINE,
              )}
            >
              Ver como funciona
            </a>
          </div>

          <p className={cn('mt-5 text-sm', MUTED)}>
            Sem cartão de crédito. Sem instalar nada. Funciona no celular.
          </p>
        </div>

        <AgendaMock />
      </div>
    </Section>
  );
}

/** Ilustração da agenda — desenho, não captura de tela. */
function AgendaMock() {
  const rows = [
    { time: '08:00', name: 'Ana Ribeiro', tag: 'Salão · Manhã', tone: 'rent' },
    { time: '09:30', name: 'Limpeza de pele', tag: 'Camila M.', tone: 'own' },
    { time: '11:00', name: 'Massagem modeladora', tag: 'Renata P.', tone: 'own' },
    { time: '13:00', name: 'Bia Nunes', tag: 'Mesa 01 · Tarde', tone: 'rent' },
    { time: '15:00', name: 'Limpeza de pele', tag: 'Júlia F.', tone: 'own' },
  ];

  return (
    <div className={cn('rounded-2xl border bg-white p-5 shadow-[0_20px_60px_-30px_#8A6A4F]', LINE)}>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">Terça-feira</p>
          <p className={cn('text-xs', MUTED)}>5 compromissos</p>
        </div>
        <div className={cn('rounded-lg border px-2.5 py-1 text-[11px]', LINE, MUTED)}>Hoje</div>
      </div>

      <div className="space-y-2">
        {rows.map((row) => (
          <div
            key={row.time}
            className={cn(
              'flex items-center gap-3 rounded-xl border-l-[3px] px-3 py-2.5',
              row.tone === 'rent'
                ? 'border-l-[#8A6A4F] bg-[#F7F1E8]'
                : 'border-l-[#C3B29C] bg-[#FBF9F5]',
            )}
          >
            <span className={cn('w-11 shrink-0 text-xs tabular-nums', MUTED)}>{row.time}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{row.name}</p>
              <p className={cn('truncate text-xs', MUTED)}>{row.tag}</p>
            </div>
            {row.tone === 'rent' ? (
              <span className={cn('shrink-0 text-[10px] font-semibold uppercase', ACCENT_TEXT)}>
                alugado
              </span>
            ) : null}
          </div>
        ))}
      </div>

      <p className={cn('mt-4 border-t pt-3 text-[11px] leading-relaxed', LINE, MUTED)}>
        Os turnos alugados aparecem como <strong className={INK}>ocupação</strong> — quem alugou,
        qual espaço, se pagou. O atendimento de quem aluga é dela, e não aparece aqui.
      </p>
    </div>
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
      title: 'Você não sabe quem está no espaço',
      text: 'Quem alugou a cadeira hoje? Pagou? A sala está livre amanhã de tarde? Ninguém sabe de cabeça.',
    },
    {
      icon: Wallet,
      title: 'O dinheiro se mistura',
      text: 'O que é do aluguel, o que é do seu atendimento e o que é da profissional que trabalha ali.',
    },
  ];

  return (
    <Section className="border-y border-[#E4DACB] bg-white">
      <div className="mx-auto max-w-2xl text-center">
        <Eyebrow>O problema</Eyebrow>
        <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Você abriu um espaço de beleza. Não uma central de recados.
        </h2>
        <p className={cn('mt-4 text-lg', MUTED)}>
          Quanto maior o espaço, mais tempo some em coisas que não são o seu trabalho.
        </p>
      </div>

      <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((item) => (
          <div key={item.title} className={cn('rounded-2xl border bg-[#FBF9F5] p-5', LINE)}>
            <div
              className={cn(
                'mb-3 flex size-10 items-center justify-center rounded-xl bg-[#F0E7DA]',
                ACCENT_TEXT,
              )}
            >
              <item.icon className="size-5" />
            </div>
            <h3 className="mb-1.5 font-semibold">{item.title}</h3>
            <p className={cn('text-sm leading-relaxed', MUTED)}>{item.text}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}

/* ------------------------------------------ dois negócios, um sistema */

function TwoBusinesses() {
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
    'Os turnos que ela alugou e as faturas',
    'Cadastro e histórico das próprias clientes',
    'Nada do seu negócio — nem do da vizinha',
  ];

  return (
    <Section id="dois-negocios">
      <div className="mx-auto max-w-2xl text-center">
        <Eyebrow>A parte difícil</Eyebrow>
        <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Dois negócios debaixo do mesmo teto — e uma parede entre eles.
        </h2>
        <p className={cn('mt-4 text-lg leading-relaxed', MUTED)}>
          Quando você aluga uma cadeira, você é <strong className={INK}>locadora, não sócia</strong>
          . A profissional que aluga monta o próprio negócio ali dentro: cliente dela, agenda dela,
          dinheiro dela. Você fatura o turno — e só o turno.
        </p>
      </div>

      <div className="mt-12 grid gap-5 lg:grid-cols-2">
        <div className={cn('rounded-2xl border bg-white p-7', LINE)}>
          <div className="mb-5 flex items-center gap-3">
            <div className={cn('flex size-11 items-center justify-center rounded-xl', ACCENT)}>
              <Users className="size-5 text-white" />
            </div>
            <div>
              <p className="font-semibold">Você, a dona</p>
              <p className={cn('text-sm', MUTED)}>Atende e aluga</p>
            </div>
          </div>
          <ul className="space-y-2.5">
            {owner.map((line) => (
              <li key={line} className="flex gap-2.5 text-sm">
                <Check className={cn('mt-0.5 size-4 shrink-0', ACCENT_TEXT)} />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className={cn('rounded-2xl border bg-[#F7F1E8] p-7', LINE)}>
          <div className="mb-5 flex items-center gap-3">
            <div
              className={cn('flex size-11 items-center justify-center rounded-xl border bg-white', LINE)}
            >
              <KeyRound className={cn('size-5', ACCENT_TEXT)} />
            </div>
            <div>
              <p className="font-semibold">Quem aluga de você</p>
              <p className={cn('text-sm', MUTED)}>Entra com o login dela</p>
            </div>
          </div>
          <ul className="space-y-2.5">
            {renter.map((line) => (
              <li key={line} className="flex gap-2.5 text-sm">
                <Check className={cn('mt-0.5 size-4 shrink-0', ACCENT_TEXT)} />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className={cn('mt-5 flex items-start gap-3 rounded-2xl border bg-white p-5', LINE)}>
        <Lock className={cn('mt-0.5 size-5 shrink-0', ACCENT_TEXT)} />
        <p className={cn('text-sm leading-relaxed', MUTED)}>
          <strong className={INK}>A separação é de verdade, não é só o menu escondido.</strong> Você
          não consegue abrir a agenda de quem aluga nem digitando o endereço, e ela não consegue ver
          a sua. Só a sala continua sendo compartilhada: o sistema impede duas pessoas de marcarem
          no mesmo espaço, no mesmo horário, sem revelar de quem é o outro atendimento.
        </p>
      </div>
    </Section>
  );
}

/* ------------------------------------------------------ links públicos */

function PublicLinks() {
  return (
    <Section className="border-y border-[#E4DACB] bg-white">
      <div className="grid items-center gap-12 lg:grid-cols-2">
        <div>
          <Eyebrow>Agendamento online</Eyebrow>
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Um link para o espaço. E um para cada profissional.
          </h2>
          <p className={cn('mt-4 text-lg leading-relaxed', MUTED)}>
            Cada profissional recebe o próprio endereço para colar na bio do Instagram. Quem abre vê
            a marca da casa, mas só o nome e os serviços de quem mandou o link — e marca direto com
            ela.
          </p>

          <ul className="mt-6 space-y-3">
            {[
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
            ].map((item) => (
              <li key={item.title} className="flex gap-3">
                <div
                  className={cn(
                    'flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#F0E7DA]',
                    ACCENT_TEXT,
                  )}
                >
                  <item.icon className="size-4" />
                </div>
                <div>
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className={cn('text-sm', MUTED)}>{item.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className={cn('rounded-2xl border bg-[#FBF9F5] p-6', LINE)}>
          <p className={cn('mb-4 text-xs font-medium uppercase tracking-wider', MUTED)}>
            O que a cliente vê no celular
          </p>
          <div className={cn('rounded-2xl border bg-white p-5', LINE)}>
            <div className="mb-4 flex items-center gap-3">
              <div className={cn('flex size-10 items-center justify-center rounded-xl', ACCENT)}>
                <Sparkles className="size-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold">Ana Ribeiro</p>
                <p className={cn('text-xs', MUTED)}>Espaço Márcia Vaz</p>
              </div>
            </div>

            <p className={cn('mb-3 text-xs font-medium uppercase tracking-wider', MUTED)}>Cabelo</p>
            <div className="space-y-2">
              {[
                { name: 'Corte', time: '60 min', price: 'R$ 80,00' },
                { name: 'Escova', time: '45 min', price: 'R$ 70,00' },
                { name: 'Lavagem + finalização', time: '30 min', price: 'R$ 50,00' },
              ].map((service) => (
                <div
                  key={service.name}
                  className={cn(
                    'flex items-center justify-between rounded-xl border px-3.5 py-2.5',
                    LINE,
                  )}
                >
                  <div>
                    <p className="text-sm font-medium">{service.name}</p>
                    <p className={cn('text-xs', MUTED)}>{service.time}</p>
                  </div>
                  <p className="text-sm font-semibold">{service.price}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Section>
  );
}

/* ------------------------------------------------------------ recursos */

function Features() {
  const features = [
    {
      icon: CalendarDays,
      title: 'Agenda que não deixa marcar errado',
      text: 'Dia, semana e mês. Confere jornada, intervalo, folga, sala e equipamento antes de aceitar. No celular, a agenda vira lista do dia.',
    },
    {
      icon: Users,
      title: 'Ficha completa da cliente',
      text: 'Histórico de atendimentos, quanto já gastou, última visita, aniversário e observações que só você vê.',
    },
    {
      icon: KeyRound,
      title: 'Aluguel por turno, diária, semana ou mês',
      text: 'Preço por espaço e por turno. Reserve o mês inteiro de uma vez, com o valor somado antes de confirmar. Dias ocupados são pulados sozinhos.',
    },
    {
      icon: Wallet,
      title: 'Caixa sem planilha',
      text: 'Receita entra ao finalizar o atendimento. Despesas por categoria, formas de pagamento, o que está a receber e o lucro do mês.',
    },
    {
      icon: Receipt,
      title: 'Comissão calculada sozinha',
      text: 'Percentual ou valor fixo, por profissional ou por serviço. Fechamento do mês sem conferir na calculadora.',
    },
    {
      icon: Smartphone,
      title: 'Funciona no celular',
      text: 'É um site — abre no navegador do telefone, do tablet e do computador. Nada para instalar, nada para atualizar.',
    },
  ];

  return (
    <Section id="recursos">
      <div className="mx-auto max-w-2xl text-center">
        <Eyebrow>Recursos</Eyebrow>
        <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Tudo que o dia pede — e nada que você não use.
        </h2>
        <p className={cn('mt-4 text-lg', MUTED)}>
          Cada empresa liga só os módulos de que precisa. O menu muda junto.
        </p>
      </div>

      <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {features.map((feature) => (
          <div key={feature.title} className={cn('rounded-2xl border bg-white p-6', LINE)}>
            <div
              className={cn(
                'mb-4 flex size-11 items-center justify-center rounded-xl bg-[#F0E7DA]',
                ACCENT_TEXT,
              )}
            >
              <feature.icon className="size-5" />
            </div>
            <h3 className="mb-2 font-semibold">{feature.title}</h3>
            <p className={cn('text-sm leading-relaxed', MUTED)}>{feature.text}</p>
          </div>
        ))}
      </div>
    </Section>
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
    <Section id="planos" className="border-y border-[#E4DACB] bg-white">
      <div className="mx-auto max-w-2xl text-center">
        <Eyebrow>Planos</Eyebrow>
        <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Dois planos. A diferença é o aluguel.
        </h2>
        <p className={cn('mt-4 text-lg', MUTED)}>
          Se você só atende, o Pro resolve. Se você também aluga espaço, o Premium é o seu.
        </p>
      </div>

      <div className="mx-auto mt-12 grid max-w-4xl gap-6 lg:grid-cols-2">
        <div className={cn('rounded-2xl border bg-[#FBF9F5] p-8', LINE)}>
          <h3 className="text-xl font-semibold">Pro</h3>
          <p className={cn('mt-1 text-sm', MUTED)}>
            Para a clínica, o salão ou o studio que atende as próprias clientes.
          </p>
          <p className="mt-6">
            <span className="text-4xl font-semibold">R$ 129</span>
            <span className={cn('text-lg', MUTED)}>,90/mês</span>
          </p>
          <Link
            to="/cadastro"
            className={cn(
              'mt-6 block rounded-xl border bg-white py-3 text-center font-medium transition-colors hover:bg-[#F5F0E8]',
              LINE,
            )}
          >
            Testar 14 dias grátis
          </Link>
          <ul className="mt-7 space-y-2.5">
            {pro.map((line) => (
              <li key={line} className="flex gap-2.5 text-sm">
                <Check className={cn('mt-0.5 size-4 shrink-0', ACCENT_TEXT)} />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className={cn('relative rounded-2xl border-2 border-[#8A6A4F] bg-white p-8')}>
          <span
            className={cn(
              'absolute -top-3 left-8 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-white',
              ACCENT,
            )}
          >
            Espaço compartilhado
          </span>
          <h3 className="text-xl font-semibold">Premium</h3>
          <p className={cn('mt-1 text-sm', MUTED)}>
            Para quem aluga cadeira, mesa ou sala para outras profissionais.
          </p>
          <p className="mt-6">
            <span className="text-4xl font-semibold">R$ 219</span>
            <span className={cn('text-lg', MUTED)}>,90/mês</span>
          </p>
          <Link
            to="/cadastro"
            className={cn(
              'mt-6 block rounded-xl py-3 text-center font-medium text-white transition-opacity hover:opacity-90',
              ACCENT,
            )}
          >
            Testar 14 dias grátis
          </Link>
          <p className={cn('mt-7 text-sm font-medium', INK)}>Tudo do Pro, mais:</p>
          <ul className="mt-3 space-y-2.5">
            {premium.map((line) => (
              <li key={line} className="flex gap-2.5 text-sm">
                <Check className={cn('mt-0.5 size-4 shrink-0', ACCENT_TEXT)} />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <p className={cn('mt-8 text-center text-sm', MUTED)}>
        14 dias grátis nos dois, sem cartão. Cancele quando quiser.
      </p>
    </Section>
  );
}

/* --------------------------------------------------------- white label */

function WhiteLabel() {
  const swatches = ['#8A6A4F', '#4B7C5B', '#7C3AED', '#EC4899', '#0EA5E9', '#B45309'];

  return (
    <Section>
      <div className={cn('grid items-center gap-10 rounded-3xl border bg-white p-8 sm:p-12 lg:grid-cols-2', LINE)}>
        <div>
          <Eyebrow>Sua marca</Eyebrow>
          <h2 className="text-3xl font-semibold tracking-tight">
            O painel fica na cor da sua casa.
          </h2>
          <p className={cn('mt-4 text-lg leading-relaxed', MUTED)}>
            Escolha a cor da sua marca em Configurações e o sistema inteiro se ajusta — botões,
            menu, gráficos e, principalmente, a página pública que as suas clientes abrem. Suba o
            seu logo e o link de agendamento passa a ser a sua cara, não a nossa.
          </p>

          <div className="mt-7 flex items-center gap-2.5">
            {swatches.map((color) => (
              <span
                key={color}
                className="size-9 rounded-xl ring-1 ring-black/5"
                style={{ backgroundColor: color }}
              />
            ))}
            <span className={cn('ml-1 text-sm', MUTED)}>ou qualquer outra</span>
          </div>
        </div>

        <div className={cn('rounded-2xl border bg-[#FBF9F5] p-6', LINE)}>
          <div className="flex items-center gap-3">
            <div className={cn('flex size-10 items-center justify-center rounded-xl', ACCENT)}>
              <Palette className="size-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-medium">Cor principal</p>
              <p className={cn('text-xs', MUTED)}>Configurações › Empresa</p>
            </div>
          </div>

          <div className={cn('mt-5 space-y-2.5 rounded-xl border bg-white p-4', LINE)}>
            <div className={cn('h-2.5 w-3/4 rounded-full', ACCENT)} />
            <div className="h-2.5 w-1/2 rounded-full bg-[#E4DACB]" />
            <div className="h-2.5 w-2/3 rounded-full bg-[#EFE8DD]" />
            <div className={cn('mt-4 rounded-lg py-2.5 text-center text-xs font-medium text-white', ACCENT)}>
              Agendar
            </div>
          </div>
        </div>
      </div>
    </Section>
  );
}

/* -------------------------------------------------------------- dúvidas */

function Faq() {
  const questions = [
    {
      q: 'Quem aluga o espaço precisa pagar o sistema também?',
      a: 'Não. A assinatura é sua. As profissionais que alugam entram com um login que você cria, sem custo por pessoa. Você paga um plano para o espaço inteiro.',
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
      a: 'Sim. No primeiro acesso você responde algumas perguntas e o sistema liga apenas os módulos que fazem sentido. Dá para ativar o resto quando quiser, em Configurações.',
    },
  ];

  const [open, setOpen] = useState<number | null>(0);

  return (
    <Section id="duvidas" className="border-y border-[#E4DACB] bg-white">
      <div className="mx-auto max-w-3xl">
        <div className="text-center">
          <Eyebrow>Dúvidas</Eyebrow>
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            O que costumam perguntar antes de assinar
          </h2>
        </div>

        <div className="mt-10 space-y-3">
          {questions.map((item, index) => (
            <div key={item.q} className={cn('rounded-2xl border bg-[#FBF9F5]', LINE)}>
              <button
                type="button"
                onClick={() => setOpen(open === index ? null : index)}
                className="flex w-full items-center gap-4 px-5 py-4 text-left"
              >
                <span className="flex-1 font-medium">{item.q}</span>
                <ChevronDown
                  className={cn(
                    'size-4 shrink-0 transition-transform',
                    MUTED,
                    open === index && 'rotate-180',
                  )}
                />
              </button>
              {open === index ? (
                <p className={cn('px-5 pb-4 text-sm leading-relaxed', MUTED)}>{item.a}</p>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}

/* ------------------------------------------------------------ CTA final */

function FinalCta() {
  return (
    <Section>
      <div className={cn('rounded-3xl px-8 py-14 text-center sm:px-14', ACCENT)}>
        <h2 className="mx-auto max-w-2xl text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          Comece hoje com a agenda organizada.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-lg text-white/80">
          Catorze dias para usar tudo, sem cartão. Se não servir, é só parar — seus dados continuam
          seus.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/cadastro"
            className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3.5 font-medium text-[#2B2520] transition-opacity hover:opacity-90"
          >
            Criar minha conta
            <ArrowRight className="size-4" />
          </Link>
          <Link
            to="/login"
            className="rounded-xl border border-white/30 px-6 py-3.5 font-medium text-white transition-colors hover:bg-white/10"
          >
            Já tenho conta
          </Link>
        </div>
      </div>
    </Section>
  );
}

function Footer() {
  return (
    <footer className={cn('border-t px-6 py-10', LINE)}>
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
        <div className="flex items-center gap-2.5">
          <div className={cn('flex size-8 items-center justify-center rounded-lg', ACCENT)}>
            <Sparkles className="size-3.5 text-white" />
          </div>
          <span className="font-semibold">Belezza</span>
        </div>
        <p className={cn('text-sm', MUTED)}>
          © {new Date().getFullYear()} Belezza · Gestão para beleza, estética e clínicas
        </p>
        <div className="flex items-center gap-5">
          <Link to="/login" className={cn('text-sm hover:text-[#2B2520]', MUTED)}>
            Entrar
          </Link>
          <Link to="/cadastro" className={cn('text-sm hover:text-[#2B2520]', MUTED)}>
            Criar conta
          </Link>
        </div>
      </div>
    </footer>
  );
}
