import type { CSSProperties, ReactNode } from 'react';
import { CalendarDays, Link2, Sparkles, Wallet } from 'lucide-react';

/**
 * Moldura das telas de entrada: login, cadastro, esqueci a senha e redefinir.
 *
 * Segue a mesma linguagem da landing — areia, marinho e vinho — porque quem
 * clica em "Entrar" na vitrine não pode cair noutro produto. Antes daqui a
 * landing era clara e o login, roxo escuro: a troca de identidade no meio do
 * caminho faz a pessoa duvidar de que está no lugar certo, e é justamente onde
 * ela vai digitar a senha.
 *
 * A coluna escura repete o bloco de recursos da landing. Sem foto de propósito:
 * a landing carrega as dela de um banco de imagens externo, e aqui uma imagem
 * que não chega deixaria a tela de login parecendo quebrada.
 */

const HIGHLIGHTS = [
  {
    icon: CalendarDays,
    title: 'Agenda inteligente',
    text: 'Sem choque de horário, sala ou profissional.',
  },
  {
    icon: Link2,
    title: 'Link de agendamento',
    text: 'A cliente marca sozinha, pelo celular.',
  },
  {
    icon: Wallet,
    title: 'Financeiro organizado',
    text: 'Receitas, despesas, comissões e aluguéis.',
  },
];

/**
 * A paleta entra como variável de tema, não como classe solta.
 *
 * Assim o `Button`, o `Input` e o anel de foco — que leem esses tokens —
 * ficam vinho junto com o resto, sem precisar de `className` em cada um. E
 * fica preso a esta subárvore: o painel continua white label, com a cor que
 * cada empresa escolheu.
 */
const THEME = {
  '--background': '17 100% 99%',
  '--foreground': '230 38% 18%',
  '--card': '0 0% 100%',
  '--card-foreground': '230 38% 18%',
  '--primary': '347 61% 54%',
  '--primary-foreground': '0 0% 100%',
  '--muted': '20 33% 94%',
  '--muted-foreground': '230 15% 45%',
  '--border': '230 20% 88%',
  '--input': '230 20% 88%',
  '--ring': '347 61% 54%',
} as CSSProperties;

function Logo({ tone = 'dark' }: { tone?: 'dark' | 'light' }) {
  return (
    <span
      className={
        tone === 'dark'
          ? 'grid size-9 place-items-center rounded-full bg-[#1d2340] text-white'
          : 'grid size-9 place-items-center rounded-full bg-white/10 text-white backdrop-blur'
      }
    >
      <Sparkles className="size-[17px]" strokeWidth={2.2} />
    </span>
  );
}

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
    <div
      style={THEME}
      className="grid min-h-screen bg-[#fffaf8] text-[#1d2340] selection:bg-[#f8ced7] lg:grid-cols-[1fr_1.05fr]"
    >
      {/* ------------------------------------------------------ coluna escura */}
      <aside className="relative hidden overflow-hidden bg-[#1d2340] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        {/* Um brilho vinho bem discreto, só para o marinho não ficar chapado. */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 size-[420px] rounded-full opacity-25 blur-3xl"
          style={{ background: 'radial-gradient(circle, #d24362, transparent 65%)' }}
        />

        <a href="/" className="relative flex items-center gap-2.5" aria-label="Belezza, início">
          <Logo tone="light" />
          <span className="text-lg font-bold tracking-[-0.04em]">Belezza</span>
        </a>

        <div className="relative max-w-md space-y-9">
          <div className="space-y-4">
            <h2 className="text-[2.6rem] font-bold leading-[1.03] tracking-[-0.055em]">
              Seu tempo fica com as clientes.
            </h2>
            <p className="text-lg leading-relaxed text-white/62">
              A agenda, o caixa e os espaços ficam com o Belezza.
            </p>
          </div>

          <ul className="space-y-5">
            {HIGHLIGHTS.map((item) => (
              <li key={item.title} className="flex gap-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-white/[0.09] text-[#ff9bb1]">
                  <item.icon className="size-[18px]" />
                </span>
                <div>
                  <p className="font-bold">{item.title}</p>
                  <p className="text-sm leading-relaxed text-white/55">{item.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs font-medium text-white/40">
          © {new Date().getFullYear()} Belezza · Gestão para espaços de beleza
        </p>
      </aside>

      {/* ------------------------------------------------------- coluna do form */}
      <div className="flex items-center justify-center px-5 py-12 sm:px-10">
        <div className="w-full max-w-[420px] space-y-8">
          {/* No celular a coluna escura some, então a marca reaparece aqui. */}
          <a href="/" className="flex items-center gap-2.5 lg:hidden" aria-label="Belezza, início">
            <Logo />
            <span className="text-lg font-bold tracking-[-0.04em]">Belezza</span>
          </a>

          <div className="space-y-2">
            <h1 className="text-[2rem] font-bold leading-[1.1] tracking-[-0.05em]">{title}</h1>
            <p className="text-[15px] leading-relaxed text-[#1d2340]/62">{subtitle}</p>
          </div>

          {children}

          {footer ? (
            <div className="text-center text-sm font-medium text-[#1d2340]/62">{footer}</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
