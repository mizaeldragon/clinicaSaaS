import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import { AuthShell } from './AuthShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/primitives';
import { useResetPassword } from '@/api/queries';

/** Criar a senha nova com o token que chegou por e-mail. */
export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const resetPassword = useResetPassword();

  const tooShort = password.length > 0 && password.length < 8;
  const mismatch = confirm.length > 0 && password !== confirm;
  const ready = password.length >= 8 && password === confirm;

  if (!token) {
    return (
      <AuthShell
        title="Link inválido"
        subtitle="Este endereço não traz um código de redefinição."
        footer={
          <Link to="/esqueci-a-senha" className="font-medium text-primary hover:underline">
            Pedir um novo link
          </Link>
        }
      >
        <p className="rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
          Copie o endereço completo do e-mail que você recebeu — alguns aplicativos cortam o link
          no meio.
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Criar nova senha"
      subtitle="Depois de salvar, as sessões abertas em outros aparelhos serão encerradas."
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
          if (!ready) return;
          await resetPassword
            .mutateAsync({ token, newPassword: password })
            .then(() => {
              toast.success('Senha redefinida. Entre com a nova senha.');
              navigate('/login', { replace: true });
            })
            .catch(() => undefined);
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="password">Nova senha</Label>
          <div className="relative">
            <Input
              id="password"
              type={show ? 'text' : 'password'}
              autoComplete="new-password"
              required
              className="pr-10"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              aria-label={show ? 'Ocultar senha' : 'Mostrar senha'}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          <p className={`text-xs ${tooShort ? 'text-destructive' : 'text-muted-foreground'}`}>
            No mínimo 8 caracteres
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="confirm">Repita a nova senha</Label>
          <Input
            id="confirm"
            type={show ? 'text' : 'password'}
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
          {mismatch ? <p className="text-xs text-destructive">As senhas não conferem</p> : null}
        </div>

        <Button type="submit" className="w-full" loading={resetPassword.isPending} disabled={!ready}>
          <KeyRound />
          Salvar nova senha
        </Button>
      </form>
    </AuthShell>
  );
}
