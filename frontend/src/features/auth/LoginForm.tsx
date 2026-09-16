import { useState } from 'react';
import { Link } from 'react-router-dom';
import { KeyRound, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/field';
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

/**
 * A metade "Entrar" do cartão de autenticação.
 *
 * Não decide para onde ir depois: avisa quem a contém. Quem entra com segundo
 * fator ainda não tem sessão — tem um passe —, e é a moldura que troca o
 * cartão pelo pedido do código. Deixar essa decisão aqui dentro obrigaria este
 * componente a conhecer a tela que o envolve.
 */
export function LoginForm({
  onTwoFactorRequired,
  onSignedIn,
}: {
  onTwoFactorRequired: (challengeToken: string) => void;
  onSignedIn: () => void;
}) {
  const login = useAuthStore((state) => state.login);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [companySlug, setCompanySlug] = useState('');
  const [needsCompany, setNeedsCompany] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    try {
      const pendente = await login(email, password, companySlug || undefined);
      if (pendente) {
        onTwoFactorRequired(pendente.challengeToken);
        return;
      }
      onSignedIn();
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
    <div className="space-y-5">
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
          <PasswordInput
            id="password"
            autoComplete="current-password"
            required
            icon={<KeyRound />}
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
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
    </div>
  );
}
