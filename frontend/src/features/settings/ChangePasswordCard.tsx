import { useState } from 'react';
import { KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/primitives';
import { useChangePassword } from '@/api/queries';

const EMPTY = { currentPassword: '', newPassword: '', confirmPassword: '' };

/**
 * Trocar a própria senha.
 *
 * Cada pessoa troca a sua — a dona do espaço não redefine a senha da locatária,
 * porque a conta da locatária dá acesso à carteira dela. Quem esqueceu usa o
 * "esqueci minha senha" da tela de login.
 */
export function ChangePasswordCard() {
  const [form, setForm] = useState(EMPTY);
  const changePassword = useChangePassword();

  const tooShort = form.newPassword.length > 0 && form.newPassword.length < 8;
  const mismatch = form.confirmPassword.length > 0 && form.newPassword !== form.confirmPassword;
  const ready =
    form.currentPassword.length > 0 &&
    form.newPassword.length >= 8 &&
    form.newPassword === form.confirmPassword;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Senha</CardTitle>
        <CardDescription>
          Ao trocar a senha, as sessões abertas em outros aparelhos são encerradas
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form
          className="grid gap-4 sm:max-w-md"
          onSubmit={async (event) => {
            event.preventDefault();
            if (!ready) return;
            await changePassword
              .mutateAsync({
                currentPassword: form.currentPassword,
                newPassword: form.newPassword,
              })
              .then(() => setForm(EMPTY))
              .catch(() => undefined);
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="current-password">Senha atual</Label>
            <Input
              id="current-password"
              type="password"
              autoComplete="current-password"
              required
              value={form.currentPassword}
              onChange={(e) => setForm((f) => ({ ...f, currentPassword: e.target.value }))}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="new-password">Nova senha</Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              required
              value={form.newPassword}
              onChange={(e) => setForm((f) => ({ ...f, newPassword: e.target.value }))}
            />
            <p className={`text-xs ${tooShort ? 'text-destructive' : 'text-muted-foreground'}`}>
              No mínimo 8 caracteres
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirm-password">Repita a nova senha</Label>
            <Input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              required
              value={form.confirmPassword}
              onChange={(e) => setForm((f) => ({ ...f, confirmPassword: e.target.value }))}
            />
            {mismatch ? <p className="text-xs text-destructive">As senhas não conferem</p> : null}
          </div>

          <div>
            <Button type="submit" loading={changePassword.isPending} disabled={!ready}>
              <KeyRound />
              Trocar senha
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

/** Encerra as sessões abertas sem mexer na senha. */
export function SessionsCard({ onLogoutAll }: { onLogoutAll: () => Promise<void> }) {
  const [running, setRunning] = useState(false);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sessões</CardTitle>
        <CardDescription>
          Usou o sistema num computador que não é seu? Encerre tudo e entre de novo
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          type="button"
          variant="outline"
          loading={running}
          onClick={async () => {
            setRunning(true);
            try {
              await onLogoutAll();
              toast.success('Todas as sessões foram encerradas');
            } finally {
              setRunning(false);
            }
          }}
        >
          Sair de todos os aparelhos
        </Button>
      </CardContent>
    </Card>
  );
}
