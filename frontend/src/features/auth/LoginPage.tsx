import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, KeyRound, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { AuthShell } from './AuthShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/primitives';
import { useAuthStore } from '@/stores/auth.store';
import { ApiError } from '@/lib/api';

/**
 * Atalhos do seed. Credenciais reais numa página aberta só fazem sentido em
 * desenvolvimento — em produção o bloco não é sequer renderizado.
 */
const DEMO_ACCOUNTS = import.meta.env.DEV
  ? [
      { label: 'Clínica completa', email: 'admin@clinicabella.com', password: 'bella@12345' },
      { label: 'Studio pequeno', email: 'lu@studionails.com', password: 'studio@12345' },
      { label: 'Espaço compartilhado', email: 'marcia@marciavaz.com.br', password: 'marcia@12345' },
      { label: 'Locatária do espaço', email: 'ana@marciavaz.com.br', password: 'marcia@12345' },
      { label: 'Super admin', email: 'admin@saas.com', password: 'admin@12345' },
    ]
  : null;

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, completeTwoFactor, accessToken, user } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [companySlug, setCompanySlug] = useState('');
  const [needsCompany, setNeedsCompany] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  // Preenchido quando a conta tem segundo fator: a senha passou, falta o código.
  const [challenge, setChallenge] = useState<string | null>(null);
  const [code, setCode] = useState('');

  if (accessToken && user) {
    return <Navigate to={user.role === 'SUPER_ADMIN' ? '/admin' : '/app'} replace />;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    try {
      const pendente = await login(email, password, companySlug || undefined);
      if (pendente) {
        setChallenge(pendente.challengeToken);
        return;
      }
      concluir();
    } catch (error) {
      if (error instanceof ApiError && error.code === 'BAD_REQUEST' && error.details) {
        setNeedsCompany(true);
        toast.info('Informe a empresa para continuar');
      } else if (error instanceof ApiError) {
        toast.error(error.message);
      } else {
        toast.error('Não foi possível entrar. Tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  }

  function concluir() {
    const role = useAuthStore.getState().user?.role;
    const from = (location.state as { from?: string } | null)?.from;
    navigate(role === 'SUPER_ADMIN' ? '/admin' : (from ?? '/app'), { replace: true });
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

  // Senha aceita, faltando o código: uma tela só, sem nada para distrair.
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
              setPassword('');
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
    <AuthShell
      title="Entrar na sua conta"
      subtitle="Acesse o painel da sua empresa"
      footer={
        <>
          Ainda não tem conta?{' '}
          <Link to="/cadastro" className="font-medium text-primary hover:underline">
            Criar empresa grátis
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">E-mail</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            icon={<Mail />}
            placeholder="voce@empresa.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password">Senha</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              required
              icon={<KeyRound />}
              placeholder="••••••••"
              className="pr-10"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          <div className="flex justify-end">
            <Link
              to="/esqueci-a-senha"
              className="text-xs text-muted-foreground hover:text-foreground hover:underline"
            >
              Esqueci minha senha
            </Link>
          </div>
        </div>

        {needsCompany ? (
          <div className="space-y-1.5">
            <Label htmlFor="company">Empresa</Label>
            <Input
              id="company"
              placeholder="identificador-da-empresa"
              value={companySlug}
              onChange={(e) => setCompanySlug(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Seu e-mail está vinculado a mais de uma empresa.
            </p>
          </div>
        ) : null}

        <Button type="submit" className="w-full" size="lg" loading={loading}>
          Entrar
        </Button>
      </form>

      {DEMO_ACCOUNTS ? (
        <div className="rounded-xl border border-dashed bg-muted/40 p-4 text-xs text-muted-foreground">
          <p className="mb-2 font-medium text-foreground">Contas de demonstração</p>
          <ul className="space-y-1">
            {DEMO_ACCOUNTS.map((account) => (
              <li key={account.email}>
                <button
                  type="button"
                  className="text-primary hover:underline"
                  onClick={() => {
                    setEmail(account.email);
                    setPassword(account.password);
                  }}
                >
                  {account.label}
                </button>{' '}
                — {account.email} / {account.password}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

    </AuthShell>
  );
}
