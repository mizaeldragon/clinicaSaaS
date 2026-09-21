import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { AuthShell } from './AuthShell';
import { LoginForm } from './LoginForm';
import { RegisterForm } from './RegisterForm';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/primitives';
import { useAuthStore } from '@/stores/auth.store';
import { ApiError } from '@/lib/api';
import { safeInternalPath } from '@/lib/safePath';
import { cn } from '@/lib/utils';

/**
 * Entrar e criar conta na mesma tela, com um interruptor entre as duas.
 *
 * Antes eram duas páginas separadas, ligadas por um link no rodapé — quem
 * chegava para se cadastrar e já tinha conta precisava percorrer o formulário
 * inteiro até achar o "Já tem conta?" lá embaixo. Aqui as duas metades estão
 * sempre à vista e a troca é imediata.
 *
 * O endereço continua sendo `/login` e `/cadastro`: o interruptor navega entre
 * eles. Assim o botão voltar do navegador funciona, os links da landing
 * continuam valendo e quem salvou `/cadastro` nos favoritos cai na aba certa.
 */

type Mode = 'login' | 'register';

const TABS: { mode: Mode; label: string; path: string }[] = [
  { mode: 'login', label: 'Entrar', path: '/login' },
  { mode: 'register', label: 'Criar conta', path: '/cadastro' },
];

const COPY: Record<Mode, { title: string; subtitle: string }> = {
  login: {
    title: 'Entrar na sua conta',
    subtitle: 'Acesse o painel da sua empresa',
  },
  register: {
    title: 'Criar sua empresa',
    subtitle: 'Teste grátis por 5 dias, sem cartão de crédito',
  },
};

export function AuthSwitch() {
  const navigate = useNavigate();
  const location = useLocation();
  const { accessToken, user, completeTwoFactor } = useAuthStore();

  const mode: Mode = location.pathname.startsWith('/cadastro') ? 'register' : 'login';

  /*
   * Quem chegou pelo "Assinar" de um cartão não está testando nada — prometer
   * "sem cartão de crédito" no cabeçalho de quem veio pagar é promessa trocada.
   */
  const querAssinar = new URLSearchParams(location.search).get('assinar') === '1';
  const subtitulo =
    mode === 'register' && querAssinar
      ? 'Crie a conta da empresa para concluir a assinatura'
      : COPY[mode].subtitle;

  // Preenchido quando a conta tem segundo fator: a senha passou, falta o código.
  const [challenge, setChallenge] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  if (accessToken && user) {
    return <Navigate to={user.role === 'SUPER_ADMIN' ? '/admin' : '/app'} replace />;
  }

  function concluir() {
    const role = useAuthStore.getState().user?.role;
    const from = safeInternalPath((location.state as { from?: unknown } | null)?.from);
    navigate(role === 'SUPER_ADMIN' ? '/admin' : from, { replace: true });
  }

  async function handleTwoFactor(event: React.FormEvent) {
    event.preventDefault();
    if (!challenge) return;
    setLoading(true);
    try {
      await completeTwoFactor(challenge, code);
      concluir();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Código inválido.');
      setCode('');
    } finally {
      setLoading(false);
    }
  }

  // Senha aceita, faltando o código: uma tela só, sem o interruptor nem nada
  // para distrair. Trocar para "Criar conta" no meio da verificação não faria
  // sentido nenhum.
  if (challenge) {
    return (
      <AuthShell
        title="Confirme que é você"
        subtitle="Digite o código de seis dígitos do seu aplicativo autenticador."
        footer={
          <button
            type="button"
            className="font-medium text-primary hover:underline"
            onClick={() => {
              setChallenge(null);
              setCode('');
            }}
          >
            Entrar com outra conta
          </button>
        }
      >
        <form className="space-y-4" onSubmit={handleTwoFactor}>
          <div className="space-y-1.5">
            <Label htmlFor="code">Código</Label>
            <Input
              id="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              required
              placeholder="000000"
              className="text-center text-lg tracking-[0.4em]"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Perdeu o celular? Use um dos códigos de recuperação que você guardou.
            </p>
          </div>

          <Button type="submit" className="w-full" size="lg" loading={loading}>
            Entrar
          </Button>
        </form>
      </AuthShell>
    );
  }

  return (
    <AuthShell title={COPY[mode].title} subtitle={subtitulo}>
      <div className="space-y-6">
        {/* ----------------------------------------------------- interruptor */}
        <div
          role="tablist"
          aria-label="Entrar ou criar conta"
          className="relative grid grid-cols-2 rounded-full bg-[#1d2340]/[0.06] p-1"
        >
          {/* A pastilha desliza entre as metades em vez de piscar de um lado
              para o outro: o movimento é o que faz o controle parecer um
              interruptor, e não dois botões. */}
          {/* `left-1` para casar com o p-1 do trilho: sem ele a pastilha
              nascia colada na borda esquerda e, empurrada, colava na direita.
              Com a margem certa dos dois lados, o deslocamento é exatamente a
              largura dela. */}
          <span
            aria-hidden
            className={cn(
              'absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-full bg-white shadow-sm transition-transform duration-300 ease-out',
              mode === 'register' && 'translate-x-full',
            )}
          />
          {TABS.map((tab) => (
            <button
              key={tab.mode}
              type="button"
              role="tab"
              aria-selected={mode === tab.mode}
              onClick={() => navigate(tab.path, { state: location.state })}
              className={cn(
                'relative z-10 rounded-full py-2 text-sm font-bold transition-colors',
                mode === tab.mode ? 'text-[#1d2340]' : 'text-[#1d2340]/55 hover:text-[#1d2340]/80',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* -------------------------------------------------------- a metade ativa */}
        {mode === 'login' ? (
          <LoginForm onTwoFactorRequired={setChallenge} onSignedIn={concluir} />
        ) : (
          <RegisterForm onCreated={(destino) => navigate(destino, { replace: true })} />
        )}
      </div>
    </AuthShell>
  );
}
