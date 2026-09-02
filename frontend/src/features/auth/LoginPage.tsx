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

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, accessToken, user } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [companySlug, setCompanySlug] = useState('');
  const [needsCompany, setNeedsCompany] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  if (accessToken && user) {
    return <Navigate to={user.role === 'SUPER_ADMIN' ? '/admin' : '/app'} replace />;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    try {
      await login(email, password, companySlug || undefined);
      const role = useAuthStore.getState().user?.role;
      const from = (location.state as { from?: string } | null)?.from;
      navigate(role === 'SUPER_ADMIN' ? '/admin' : (from ?? '/app'), { replace: true });
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

      <div className="rounded-xl border border-dashed bg-muted/40 p-4 text-xs text-muted-foreground">
        <p className="mb-2 font-medium text-foreground">Contas de demonstração</p>
        <ul className="space-y-1">
          <li>
            <button
              type="button"
              className="text-primary hover:underline"
              onClick={() => {
                setEmail('admin@clinicabella.com');
                setPassword('bella@12345');
              }}
            >
              Clínica completa
            </button>{' '}
            — admin@clinicabella.com / bella@12345
          </li>
          <li>
            <button
              type="button"
              className="text-primary hover:underline"
              onClick={() => {
                setEmail('lu@studionails.com');
                setPassword('studio@12345');
              }}
            >
              Studio pequeno
            </button>{' '}
            — lu@studionails.com / studio@12345
          </li>
          <li>
            <button
              type="button"
              className="text-primary hover:underline"
              onClick={() => {
                setEmail('admin@saas.com');
                setPassword('admin@12345');
              }}
            >
              Super admin
            </button>{' '}
            — admin@saas.com / admin@12345
          </li>
        </ul>
      </div>
    </AuthShell>
  );
}
