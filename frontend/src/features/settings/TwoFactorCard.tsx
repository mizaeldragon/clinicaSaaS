import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Copy, ShieldCheck, ShieldOff, ShieldPlus } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/primitives';
import { Skeleton } from '@/components/ui/feedback';
import { useTwoFactor, useTwoFactorMutations } from '@/api/queries';

/**
 * Segundo fator por aplicativo.
 *
 * É a única proteção que continua valendo depois que a senha vaza — e senha
 * vaza por fora do sistema: site falso, um serviço de terceiro que foi
 * invadido, alguém olhando por cima do ombro.
 *
 * A configuração tem três estados na mesma tela: desligado, conferindo o
 * primeiro código, e os códigos de recuperação para guardar. Anotar os códigos
 * é o passo que as pessoas pulam, então ele fica sozinho, sem nada em volta.
 */
export function TwoFactorCard() {
  const { data, isLoading } = useTwoFactor();
  const { setup, enable, disable, regenerate } = useTwoFactorMutations();

  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [codes, setCodes] = useState<string[] | null>(null);
  const [removing, setRemoving] = useState(false);
  const [password, setPassword] = useState('');

  // O QR é desenhado aqui, a partir do endereço otpauth:// que a API devolve.
  // Assim o segredo não passa por nenhum serviço de terceiro para virar imagem.
  useEffect(() => {
    if (!setup.data?.otpauthUrl) return;
    QRCode.toDataURL(setup.data.otpauthUrl, { margin: 1, width: 220 })
      .then(setQr)
      .catch(() => setQr(null));
    setSecret(setup.data.secret);
  }, [setup.data]);

  if (isLoading) return <Skeleton className="h-44 rounded-lg" />;

  // --------------------------------------------- códigos recém-gerados
  if (codes) {
    return (
      <Card className="border-primary/40">
        <CardHeader>
          <CardTitle>Guarde os códigos de recuperação</CardTitle>
          <CardDescription>
            Eles são a sua entrada se você perder o celular. Só aparecem agora — depois de fechar
            esta tela, nem nós conseguimos mostrá-los de novo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="grid gap-2 rounded-lg border bg-muted/40 p-4 font-mono text-sm sm:grid-cols-2">
            {codes.map((value) => (
              <li key={value} className="tabular-nums tracking-wider">
                {value}
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                navigator.clipboard.writeText(codes.join('\n'));
                toast.success('Códigos copiados');
              }}
            >
              <Copy />
              Copiar todos
            </Button>
            <Button type="button" onClick={() => setCodes(null)}>
              Já guardei
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            Cada código funciona uma única vez. Guarde fora do computador — impresso, ou no
            gerenciador de senhas.
          </p>
        </CardContent>
      </Card>
    );
  }

  // ------------------------------------------------------ já está ligado
  if (data?.enabled) {
    return (
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                Verificação em duas etapas
                <Badge variant="success">Ativa</Badge>
              </CardTitle>
              <CardDescription>
                Saber a sua senha não basta para entrar nesta conta
              </CardDescription>
            </div>
            <ShieldCheck className="size-6 shrink-0 text-primary" />
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Restam <strong>{data.recoveryCodesLeft}</strong> códigos de recuperação.
            {data.recoveryCodesLeft <= 2 ? ' Gere um jogo novo enquanto ainda dá.' : ''}
          </p>

          {removing ? (
            <form
              className="grid gap-3 rounded-lg border border-destructive/40 p-4 sm:max-w-md"
              onSubmit={async (event) => {
                event.preventDefault();
                await disable
                  .mutateAsync({ password, code })
                  .then(() => {
                    setRemoving(false);
                    setPassword('');
                    setCode('');
                  })
                  .catch(() => undefined);
              }}
            >
              <p className="text-sm">
                Para desligar, confirme a senha e um código — assim quem pegar seu computador
                destrancado não consegue remover a proteção.
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="tf-password">Senha</Label>
                <Input
                  id="tf-password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tf-code-off">Código do aplicativo</Label>
                <Input
                  id="tf-code-off"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="000000"
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" variant="destructive" loading={disable.isPending}>
                  Desligar
                </Button>
                <Button type="button" variant="ghost" onClick={() => setRemoving(false)}>
                  Cancelar
                </Button>
              </div>
            </form>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                loading={regenerate.isPending}
                onClick={async () => {
                  const digitado = prompt('Digite um código do aplicativo para confirmar:');
                  if (!digitado) return;
                  await regenerate
                    .mutateAsync({ code: digitado })
                    .then((result) => setCodes(result.recoveryCodes))
                    .catch(() => undefined);
                }}
              >
                Gerar novos códigos de recuperação
              </Button>
              <Button type="button" variant="ghost" onClick={() => setRemoving(true)}>
                <ShieldOff />
                Desligar
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // -------------------------------------------------------- configurando
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Verificação em duas etapas</CardTitle>
            <CardDescription>
              Um código de seis dígitos no celular, além da senha
            </CardDescription>
          </div>
          <ShieldPlus className="size-6 shrink-0 text-muted-foreground" />
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {!setup.data ? (
          <>
            <p className="text-sm text-muted-foreground">
              Se a sua senha for descoberta — num site falso, ou porque vazou de outro serviço
              onde você usou a mesma —, ela sozinha deixa de abrir esta conta. É a proteção que
              mais vale a pena ligar.
            </p>
            <Button type="button" loading={setup.isPending} onClick={() => setup.mutate()}>
              <ShieldPlus />
              Ativar
            </Button>
          </>
        ) : (
          <form
            className="space-y-4"
            onSubmit={async (event) => {
              event.preventDefault();
              await enable
                .mutateAsync({ code })
                .then((result) => {
                  setCodes(result.recoveryCodes);
                  setCode('');
                  setQr(null);
                })
                .catch(() => undefined);
            }}
          >
            <ol className="space-y-4 text-sm">
              <li>
                <p className="font-medium">1. Abra o aplicativo autenticador</p>
                <p className="text-muted-foreground">
                  Google Authenticator, Microsoft Authenticator, 1Password, Bitwarden — qualquer
                  um serve.
                </p>
              </li>

              <li>
                <p className="font-medium">2. Aponte a câmera para o código</p>
                {qr ? (
                  <img
                    src={qr}
                    alt="QR Code da verificação em duas etapas"
                    className="mt-2 rounded-lg border bg-white p-2"
                    width={220}
                    height={220}
                  />
                ) : (
                  <Skeleton className="mt-2 size-[220px] rounded-lg" />
                )}
                {secret ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Sem câmera? Digite este código no aplicativo:{' '}
                    <code className="rounded bg-muted px-1.5 py-0.5 font-mono">{secret}</code>
                  </p>
                ) : null}
              </li>

              <li className="space-y-1.5">
                <Label htmlFor="tf-code">3. Digite o código que apareceu</Label>
                <Input
                  id="tf-code"
                  className="sm:max-w-40"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="000000"
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
              </li>
            </ol>

            <Button type="submit" loading={enable.isPending}>
              Confirmar e ativar
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
