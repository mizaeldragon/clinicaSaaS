import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import {
  ArrowRight,
  CalendarDays,
  Check,
  ChevronDown,
  Clock3,
  Link2,
  Menu,
  Receipt,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { BrandLogo } from '@/components/brand';
import { useAuthStore } from '@/stores/auth.store';
import { cn } from '@/lib/utils';

const NAV = [
  { href: '#como-funciona', label: 'Como funciona' },
  { href: '#recursos', label: 'Recursos' },
  { href: '#planos', label: 'Planos' },
  { href: '#duvidas', label: 'Dúvidas' },
];

const PHOTOS = {
  hero: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=1600&q=85',
  team: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=1400&q=85',
};

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="mb-4 text-xs font-bold uppercase tracking-[0.16em] text-[#d24362]">{children}</p>;
}

export function LandingPage() {
  const token = useAuthStore((state) => state.accessToken);
  if (token) return <Navigate to="/app" replace />;

  return (
    <main className="min-h-screen bg-[#fffaf8] text-[#1d2340] selection:bg-[#f8ced7]">
      <Header />
      <Hero />
      <TrustLine />
      <HowItWorks />
      <Features />
      <OnlineBooking />
      <Plans />
      <Faq />
      <FinalCta />
      <Footer />
    </main>
  );
}

function Header() {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-50 border-b border-[#1d2340]/10 bg-[#fffaf8]/90 backdrop-blur-xl">
      <div className="mx-auto flex h-[70px] max-w-7xl items-center gap-5 px-5 sm:px-8">
        <a href="#topo" className="flex items-center" aria-label="CliniStudio, início"><BrandLogo className="h-9" /></a>
        <nav className="ml-7 hidden items-center gap-7 lg:flex" aria-label="Navegação principal">
          {NAV.map((item) => <a key={item.href} href={item.href} className="text-sm font-medium text-[#1d2340]/70 transition hover:text-[#1d2340]">{item.label}</a>)}
        </nav>
        <div className="ml-auto flex items-center gap-1.5">
          <Link to="/login" className="hidden rounded-full px-4 py-2 text-sm font-semibold text-[#1d2340] transition hover:bg-[#1d2340]/[0.06] sm:block">Entrar</Link>
          <a href="#planos" className="rounded-full bg-[#d24362] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#b9314e] active:translate-y-px">Começar grátis</a>
          <button type="button" onClick={() => setOpen((current) => !current)} className="grid size-9 place-items-center rounded-full lg:hidden" aria-label={open ? 'Fechar menu' : 'Abrir menu'} aria-expanded={open}>{open ? <X className="size-5" /> : <Menu className="size-5" />}</button>
        </div>
      </div>
      {open ? <nav className="border-t border-[#1d2340]/10 bg-[#fffaf8] px-5 py-3 lg:hidden" aria-label="Navegação mobile">{NAV.map((item) => <a key={item.href} href={item.href} onClick={() => setOpen(false)} className="block rounded-xl px-3 py-3 text-sm font-semibold hover:bg-[#1d2340]/[0.05]">{item.label}</a>)}</nav> : null}
    </header>
  );
}

function Hero() {
  return (
    <section id="topo" className="overflow-hidden px-5 pb-12 pt-10 sm:px-8 lg:pb-20 lg:pt-16">
      <div className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
        <div className="max-w-xl">
          <Eyebrow>Gestão feita para beleza</Eyebrow>
          <h1 className="text-[3.1rem] font-bold leading-[0.98] tracking-[-0.065em] sm:text-6xl lg:text-[4.35rem]">Seu tempo fica com as clientes. A organização fica com o CliniStudio.</h1>
          <p className="mt-6 max-w-lg text-lg leading-relaxed text-[#1d2340]/68">Agenda, clientes, caixa e espaços em um só lugar para seu negócio crescer sem virar uma bagunça.</p>
          <div className="mt-8 flex flex-wrap items-center gap-3"><a href="#planos" className="group inline-flex items-center gap-2 rounded-full bg-[#d24362] px-6 py-3.5 text-sm font-bold text-white transition hover:bg-[#b9314e] active:translate-y-px">Começar grátis <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" /></a><a href="#como-funciona" className="rounded-full border border-[#1d2340]/15 px-6 py-3.5 text-sm font-bold transition hover:border-[#1d2340]/35 hover:bg-white">Ver como funciona</a></div>
          <p className="mt-5 text-sm font-medium text-[#1d2340]/48">5 dias gratuitos. Sem cartão de crédito.</p>
        </div>
        <div className="relative min-h-[390px] sm:min-h-[480px]">
          <div className="absolute inset-y-0 left-4 right-0 overflow-hidden rounded-[2rem] bg-[#f2d8d1] sm:left-10"><img src={PHOTOS.hero} alt="Profissional em um salão de beleza" className="size-full object-cover object-center" /></div>
          <div className="absolute bottom-5 left-0 w-[78%] rounded-2xl bg-white p-4 shadow-[0_22px_60px_-28px_rgba(29,35,64,0.48)] sm:bottom-8 sm:p-5">
            <div className="flex items-center justify-between"><div className="flex items-center gap-2.5"><span className="grid size-9 place-items-center rounded-full bg-[#fbe7eb] text-[#d24362]"><CalendarDays className="size-4" /></span><div><p className="text-sm font-bold">Agenda de hoje</p><p className="text-xs text-[#1d2340]/48">Tudo no horário certo</p></div></div><span className="rounded-full bg-[#e6f2e9] px-2.5 py-1 text-xs font-bold text-[#2b7753]">6 atendimentos</span></div>
            <div className="mt-4 flex items-center gap-3 border-t border-[#1d2340]/[0.08] pt-3"><span className="text-xs font-bold text-[#1d2340]/48">14:00</span><span className="h-8 w-1 rounded-full bg-[#d24362]" /><div><p className="text-sm font-bold">Design de sobrancelhas</p><p className="text-xs text-[#1d2340]/48">Camila Ferreira</p></div></div>
          </div>
        </div>
      </div>
    </section>
  );
}

function TrustLine() {
  return <section className="border-y border-[#1d2340]/10 bg-white px-5 py-6 sm:px-8"><div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-8 gap-y-3"><p className="text-sm font-bold text-[#1d2340]/55">Uma rotina melhor para</p><div className="flex flex-wrap gap-x-7 gap-y-2 text-sm font-semibold text-[#1d2340]/76"><span>Salões</span><span>Studios</span><span>Clínicas de estética</span><span>Barbearias</span><span>Espaços compartilhados</span></div></div></section>;
}

function HowItWorks() {
  const steps = [
    ['Organize a agenda', 'Serviços, horários, equipe e recursos em uma visão clara.', CalendarDays],
    ['Atenda com contexto', 'Histórico e preferências da cliente sempre à mão.', Users],
    ['Feche o dia segura', 'Receitas, despesas, comissões e aluguéis organizados.', Wallet],
  ];
  return <section id="como-funciona" className="px-5 py-24 sm:px-8 lg:py-32"><div className="mx-auto max-w-7xl"><div className="max-w-2xl"><h2 className="text-4xl font-bold leading-[1.04] tracking-[-0.055em] sm:text-5xl">A gestão do espaço não precisa tomar o seu dia.</h2><p className="mt-5 text-lg leading-relaxed text-[#1d2340]/62">O CliniStudio reúne o que hoje fica espalhado entre conversas, cadernos e planilhas.</p></div><div className="mt-14 grid gap-10 md:grid-cols-3 md:gap-6">{steps.map(([title, description, Icon], index) => <article key={title as string} className="border-t-2 border-[#1d2340] pt-5"><span className="text-sm font-bold text-[#d24362]">0{index + 1}</span><div className="mt-8 grid size-11 place-items-center rounded-2xl bg-[#f7ece8] text-[#d24362]"><Icon className="size-5" /></div><h3 className="mt-5 text-xl font-bold tracking-[-0.03em]">{title as string}</h3><p className="mt-2 max-w-xs text-sm leading-relaxed text-[#1d2340]/61">{description as string}</p></article>)}</div></div></section>;
}

function Features() {
  const tools = [
    ['Agenda inteligente', 'Evite conflitos de horário, sala e profissional.', CalendarDays],
    ['Link de agendamento', 'Receba marcações pelo Instagram e pelo celular.', Link2],
    ['Financeiro organizado', 'Acompanhe entradas, saídas e resultados.', Wallet],
    ['Comissões automáticas', 'Feche pagamentos sem calculadora.', Receipt],
  ];
  return <section id="recursos" className="bg-[#1d2340] px-5 py-24 text-white sm:px-8 lg:py-32"><div className="mx-auto grid max-w-7xl gap-14 lg:grid-cols-[0.82fr_1.18fr] lg:gap-24"><div className="max-w-md"><Eyebrow>Seu espaço, no controle</Eyebrow><h2 className="text-4xl font-bold leading-[1.04] tracking-[-0.055em] sm:text-5xl">Tudo para atender bem e decidir melhor.</h2><p className="mt-6 text-lg leading-relaxed text-white/63">Módulos que conversam entre si, sem você precisar montar uma operação complicada.</p><a href="#planos" className="mt-8 inline-flex items-center gap-2 rounded-full bg-[#d24362] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#b9314e] active:translate-y-px">Testar grátis <ArrowRight className="size-4" /></a></div><div className="grid gap-px overflow-hidden rounded-2xl border border-white/15 bg-white/15 sm:grid-cols-2">{tools.map(([title, description, Icon]) => <article key={title as string} className="min-h-[210px] bg-[#1d2340] p-6 transition hover:bg-white/[0.05]"><span className="grid size-10 place-items-center rounded-full bg-white/[0.09] text-[#ff9bb1]"><Icon className="size-[18px]" /></span><h3 className="mt-12 text-lg font-bold">{title as string}</h3><p className="mt-2 max-w-xs text-sm leading-relaxed text-white/55">{description as string}</p></article>)}</div></div></section>;
}

function OnlineBooking() {
  return <section className="px-5 py-24 sm:px-8 lg:py-32"><div className="mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-[1.02fr_0.98fr] lg:gap-24"><div className="relative min-h-[440px]"><div className="absolute inset-y-0 right-4 left-0 overflow-hidden rounded-[2rem] bg-[#dce9e3] sm:right-10"><img src={PHOTOS.team} alt="Profissional atendendo uma cliente" className="size-full object-cover" /></div><div className="absolute bottom-6 right-0 w-[74%] rounded-2xl bg-[#1d2340] p-5 text-white shadow-[0_22px_60px_-28px_rgba(29,35,64,0.7)]"><div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-full bg-white/10 text-[#ff9bb1]"><Clock3 className="size-4" /></span><div><p className="text-sm font-bold">Seu link trabalha por você</p><p className="text-xs text-white/52">Disponível todos os dias</p></div></div><p className="mt-4 border-t border-white/10 pt-4 text-sm leading-relaxed text-white/70">A cliente escolhe o serviço e o horário. Você recebe o agendamento pronto.</p></div></div><div className="max-w-xl lg:justify-self-end"><h2 className="text-4xl font-bold leading-[1.04] tracking-[-0.055em] sm:text-5xl">Agenda online que parece parte da sua marca.</h2><p className="mt-6 text-lg leading-relaxed text-[#1d2340]/62">Cada profissional tem seu próprio link. A cliente agenda direto com quem atende, no horário em que ela está no espaço.</p><ul className="mt-8 space-y-4">{['Link individual para divulgar', 'Disponibilidade baseada no uso do espaço', 'Sem conflito de sala, cadeira ou equipamento'].map((text) => <li key={text} className="flex gap-3 text-sm font-semibold"><Check className="mt-0.5 size-4 shrink-0 text-[#d24362]" />{text}</li>)}</ul></div></div></section>;
}

function Plans() {
  // O corte entre os planos não é quantidade de recurso, é uma pergunta só:
  // você trabalha sozinha, com equipe, ou também aluga o espaço?
  const starter = ['Agenda, clientes e serviços', 'Caixa: entradas e saídas', 'Link público de agendamento', 'Uma profissional — você'];
  const pro = ['Tudo do Starter', 'Até 10 profissionais na equipe', 'Comissões, salas e relatórios', 'Até 8 logins'];
  const premium = ['Tudo do Pro', 'Aluguel por turno, diária ou mês', 'Contratos, cobrança e logins separados', 'Equipe sem limite'];
  return <section id="planos" className="border-y border-[#1d2340]/10 bg-[#f6eee9] px-5 py-24 sm:px-8 lg:py-32"><div className="mx-auto max-w-7xl"><div className="max-w-xl"><Eyebrow>Planos</Eyebrow><h2 className="text-4xl font-bold leading-[1.04] tracking-[-0.055em] sm:text-5xl">Comece pelo que o seu espaço precisa.</h2></div><div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3"><Plan slug="starter" name="Starter" description="Para quem atende sozinha." price="169,90" features={starter} /><Plan slug="pro" name="Pro" description="Para quem tem equipe no próprio espaço." price="300" features={pro} /><Plan slug="premium" name="Premium" description="Para quem atende e também aluga espaço." price="450" features={premium} popular /></div><p className="mt-7 text-sm font-medium text-[#1d2340]/54">Teste por 5 dias. Cancele quando quiser.</p></div></section>;
}

function Plan({ slug, name, description, price, features, popular = false }: { slug: string; name: string; description: string; price: string; features: string[]; popular?: boolean }) {
  return <article className={cn('rounded-2xl p-7 sm:p-8', popular ? 'bg-[#1d2340] text-white' : 'border border-[#1d2340]/12 bg-white')}><div className="flex flex-col justify-between gap-5 sm:flex-row"><div>{popular ? <p className="mb-4 text-xs font-bold uppercase tracking-[0.15em] text-[#ff9bb1]">Para espaço compartilhado</p> : null}<h3 className="text-2xl font-bold tracking-[-0.04em]">{name}</h3><p className={cn('mt-2 text-sm', popular ? 'text-white/58' : 'text-[#1d2340]/57')}>{description}</p></div><p className="text-3xl font-bold tracking-[-0.05em]">R$ {price}<span className={cn('ml-1 text-sm font-medium tracking-normal', popular ? 'text-white/50' : 'text-[#1d2340]/45')}>/mês</span></p></div><div className={cn('mt-8 border-t pt-7', popular ? 'border-white/12' : 'border-[#1d2340]/10')}><ul className="grid gap-3">{features.map((item) => <li key={item} className={cn('flex gap-2 text-sm leading-relaxed', popular ? 'text-white/76' : 'text-[#1d2340]/72')}><Check className="mt-0.5 size-4 shrink-0 text-[#d24362]" />{item}</li>)}</ul><Link to={`/cadastro?plano=${slug}`} className={cn('mt-7 inline-flex rounded-full px-5 py-3 text-sm font-bold transition active:translate-y-px', popular ? 'bg-[#d24362] text-white hover:bg-[#b9314e]' : 'bg-[#1d2340] text-white hover:bg-[#30395f]')}>Começar grátis</Link></div></article>;
}

const QUESTIONS = [
  ['Quem aluga o espaço precisa pagar o sistema?', 'Não. A assinatura é do espaço. As profissionais parceiras entram com o login que você cria.'],
  ['Eu vejo a agenda e o faturamento de quem aluga?', 'Você acompanha o uso do espaço e os pagamentos do aluguel. Agenda, clientes e faturamento da profissional são privados.'],
  ['O sistema evita conflito na mesma sala?', 'Sim. Quando um recurso já está reservado, o horário fica indisponível sem revelar os dados do outro atendimento.'],
  ['As clientes precisam instalar um aplicativo?', 'Não. Elas abrem o link no navegador, escolhem serviço, dia e horário e confirmam por ali.'],
];

function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return <section id="duvidas" className="px-5 py-24 sm:px-8 lg:py-32"><div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.72fr_1.28fr] lg:gap-24"><div className="max-w-md"><h2 className="text-4xl font-bold leading-[1.04] tracking-[-0.055em] sm:text-5xl">Perguntas antes de começar.</h2><p className="mt-5 text-lg leading-relaxed text-[#1d2340]/62">Tudo que você precisa saber para decidir com tranquilidade.</p></div><div className="border-t border-[#1d2340]/15">{QUESTIONS.map(([question, answer], index) => <div key={question} className="border-b border-[#1d2340]/15"><button type="button" onClick={() => setOpen(open === index ? null : index)} className="flex w-full items-center gap-5 py-5 text-left"><span className="flex-1 text-base font-bold">{question}</span><ChevronDown className={cn('size-4 shrink-0 text-[#d24362] transition-transform', open === index && 'rotate-180')} /></button>{open === index ? <p className="max-w-2xl pb-5 text-sm leading-relaxed text-[#1d2340]/65">{answer}</p> : null}</div>)}</div></div></section>;
}

function FinalCta() {
  return <section className="px-5 pb-20 sm:px-8 lg:pb-28"><div className="mx-auto max-w-7xl rounded-[2rem] bg-[#d24362] px-6 py-14 text-center text-white sm:px-12 lg:py-20"><h2 className="mx-auto max-w-2xl text-4xl font-bold leading-[1.04] tracking-[-0.055em] sm:text-5xl">Menos tempo organizando. Mais tempo fazendo seu espaço acontecer.</h2><p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-white/78">Crie sua conta e teste a gestão do CliniStudio sem compromisso.</p><a href="#planos" className="mt-8 inline-flex items-center gap-2 rounded-full bg-white px-6 py-3.5 text-sm font-bold text-[#1d2340] transition hover:bg-[#fff4f6] active:translate-y-px">Começar grátis <ArrowRight className="size-4" /></a></div></section>;
}

function Footer() {
  return <footer className="border-t border-[#1d2340]/10 px-5 py-9 sm:px-8"><div className="mx-auto flex max-w-7xl flex-col gap-5 text-sm sm:flex-row sm:items-center sm:justify-between"><BrandLogo className="h-8" /><p className="font-medium text-[#1d2340]/45">© {new Date().getFullYear()} CliniStudio. Gestão para espaços de beleza.</p><div className="flex gap-5 font-semibold"><Link to="/login" className="text-[#1d2340]/65 hover:text-[#1d2340]">Entrar</Link><a href="#planos" className="text-[#1d2340]/65 hover:text-[#1d2340]">Criar conta</a></div></div></footer>;
}
