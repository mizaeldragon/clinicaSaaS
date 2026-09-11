import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, MailCheck } from 'lucide-react';
import { AuthShell } from './AuthShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/primitives';
import { useForgotPassword } from '@/api/queries';

/**
 * Pedir o link de redefinição.
 *
 * A confirmação é a mesma para e-mail cadastrado e não cadastrado — de
 * propósito. Se a tela dissesse "esse e-mail não existe", bastaria tentar
 * endereços até descobrir quem tem conta aqui.
 */
export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const forgotPassword = useForgotPassword();

  if (sent) {
    return (
      <AuthShell
        title="Confira seu e-mail"
        subtitle="Se houver uma conta com esse endereço, o link de redefinição já está a caminho."
        footer={
          <Link to="/login" className="font-medium text-primary hover:underline">
            Voltar para o login
          </Link>
        }
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-lg border bg-muted/40 p-4">
            <MailCheck className="mt-0.5 size-5 shrink-0 text-primary" />
            <div className="space-y-1 text-sm">
              <p className="font-medium">Enviamos para {email}</p>
              <p className="text-muted-foreground">
                O link vale por 1 hora e só pode ser usado uma vez. Não esqueça de olhar o spam.
              </p>
            </div>
          </div>

          <Button type="button" variant="outline" className="w-full" onClick={() => setSent(false)}>
            Usar outro e-mail
          </Button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Esqueceu a senha?"
      subtitle="Informe o e-mail da sua conta e enviaremos um link para criar uma nova."
      footer={
        <Link to="/login" className="font-medium text-primary hover:underline">
          Voltar para o login
        </Link>
      }
    >
      <form
        className="space-y-4"
        onSubmit={async (event) => {
          event.preventDefault();
          await forgotPassword
            .mutateAsync({ email })
            .then(() => setSent(true))
            .catch(() => undefined);
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="email">E-mail</Label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              className="pl-9"
              placeholder="voce@suaempresa.com.br"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
        </div>

        <Button type="submit" className="w-full" loading={forgotPassword.isPending}>
          Enviar link
        </Button>
      </form>
    </AuthShell>
  );
}
