import type { ReactNode } from 'react';
import { CalendarCheck, Sparkles, TrendingUp, Users } from 'lucide-react';

const HIGHLIGHTS = [
  { icon: CalendarCheck, title: 'Agenda inteligente', text: 'Sem choque de horário, sala ou profissional.' },
  { icon: Users, title: 'Clientes com histórico', text: 'Timeline de atendimentos e valores gastos.' },
  { icon: TrendingUp, title: 'Financeiro no controle', text: 'Receitas, despesas, comissões e aluguéis.' },
];

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <div className="relative hidden overflow-hidden bg-slate-950 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div
          className="pointer-events-none absolute -left-24 -top-24 size-[420px] rounded-full opacity-30 blur-3xl"
          style={{ background: 'radial-gradient(circle, #7C3AED, transparent 65%)' }}
        />
        <div
          className="pointer-events-none absolute -bottom-32 -right-16 size-[420px] rounded-full opacity-25 blur-3xl"
          style={{ background: 'radial-gradient(circle, #EC4899, transparent 65%)' }}
        />

        <div className="relative flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-white/10 backdrop-blur">
            <Sparkles className="size-5" />
          </div>
          <span className="text-lg font-semibold tracking-tight">Belezza</span>
        </div>

        <div className="relative max-w-md space-y-8">
          <div className="space-y-3">
            <h2 className="text-4xl font-semibold leading-tight tracking-tight">
              A gestão completa do seu espaço de beleza.
            </h2>
            <p className="text-white/70">
              Do studio de manicure com uma profissional à clínica com salas, equipe e aluguel de
              espaços — cada empresa usa apenas os módulos de que precisa.
            </p>
          </div>

          <ul className="space-y-4">
            {HIGHLIGHTS.map((item) => (
              <li key={item.title} className="flex gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/10">
                  <item.icon className="size-5" />
                </div>
                <div>
                  <p className="font-medium">{item.title}</p>
                  <p className="text-sm text-white/60">{item.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-white/40">
          © {new Date().getFullYear()} Belezza · Plataforma SaaS multiempresa
        </p>
      </div>

      <div className="flex items-center justify-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-[420px] space-y-7">
          <div className="flex items-center gap-2 lg:hidden">
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Sparkles className="size-5" />
            </div>
            <span className="text-lg font-semibold">Belezza</span>
          </div>

          <div className="space-y-1.5">
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          </div>

          {children}

          {footer ? <div className="text-center text-sm text-muted-foreground">{footer}</div> : null}
        </div>
      </div>
    </div>
  );
}
