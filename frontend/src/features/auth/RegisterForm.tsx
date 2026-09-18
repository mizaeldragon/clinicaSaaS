import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Building2, Mail, User } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DocumentInput, PasswordInput, PhoneInput } from '@/components/ui/field';
import { Label } from '@/components/ui/primitives';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuthStore } from '@/stores/auth.store';
import { usePublicPlans } from './usePublicPlans';
import { COMPANY_TYPE } from '@/config/labels';
import { currency } from '@/lib/format';
import { ApiError } from '@/lib/api';

/**
 * A metade "Criar conta" do cartão de autenticação.
 *
 * O plano não se escolhe aqui. Quem decide entre Pro e Premium está comparando
 * o que cada um entrega, e essa comparação é a seção de planos da landing —
 * com as duas listas lado a lado. Repetir a escolha no fim do formulário, em
 * duas linhas de resumo, era pedir a mesma decisão de novo no pior momento
 * para tomá-la.
 *
 * O plano chega pela URL (`/cadastro?plano=premium`), posto lá pelo botão do
 * cartão na landing. Aqui ele só aparece confirmado, com um caminho de volta
 * para a comparação. Sem parâmetro — quem veio pelo alternador do login, por
 * exemplo — vale o primeiro plano da lista, e o aviso diz qual é.
 */
export function RegisterForm({ onCreated }: { onCreated: () => void }) {
  const register = useAuthStore((state) => state.register);
  const { data: plans } = usePublicPlans();
  const [searchParams] = useSearchParams();

  const [form, setForm] = useState({
    companyName: '',
    companyType: 'OTHER',
    document: '',
    adminName: '',
    email: '',
    password: '',
    confirmacao: '',
    phone: '',
  });
  const [loading, setLoading] = useState(false);

  // Só aceita slug que exista de verdade: a URL é de quem chega, e um valor
  // inventado faria o cadastro falhar lá no fim, depois de tudo preenchido.
  const escolhido = searchParams.get('plano');
  const plan = plans?.find((item) => item.slug === escolhido) ?? plans?.[0];
  const planSlug = plan?.slug ?? 'pro';

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  // Só reclama depois que a pessoa comecou a repetir: acusar diferenca no
  // primeiro caractere digitado seria acusar o óbvio.
  const naoConfere = form.confirmacao.length > 0 && form.confirmacao !== form.password;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (form.password !== form.confirmacao) {
      toast.error('As duas senhas estão diferentes.');
      return;
    }

    setLoading(true);
    try {
      await register({
        company: {
          name: form.companyName,
          type: form.companyType,
          phone: form.phone || undefined,
          document: form.document || undefined,
        },
        admin: {
          name: form.adminName,
          email: form.email,
          password: form.password,
          phone: form.phone || undefined,
        },
        planSlug,
      });
      toast.success('Empresa criada! Seu plano já está ativo.');
      onCreated();
    } catch (error) {
      if (error instanceof ApiError) toast.error(error.message);
      else toast.error('Não foi possível criar a conta');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="companyName">Nome da empresa</Label>
        <Input
          id="companyName"
          required
          minLength={2}
          icon={<Building2 />}
          placeholder="Clínica Bella"
          value={form.companyName}
          onChange={(e) => set('companyName', e.target.value)}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Tipo de negócio</Label>
          <Select value={form.companyType} onValueChange={(v) => set('companyType', v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(COMPANY_TYPE).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {/* Opcional de propósito. A promessa logo acima é "sem cartão de
            crédito", e exigir documento fiscal antes de a pessoa ter visto o
            sistema contradiz isso. Quem tem em mãos preenche agora e não
            precisa voltar; quem não tem preenche em Configurações, que é onde a
            assinatura cobra. */}
        <div className="space-y-1.5">
          <Label htmlFor="document">
            CPF ou CNPJ <span className="font-normal text-muted-foreground">(opcional)</span>
          </Label>
          <DocumentInput
            id="document"
            value={form.document}
            onChange={(v) => set('document', v)}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="adminName">Seu nome</Label>
          <Input
            id="adminName"
            required
            minLength={2}
            icon={<User />}
            value={form.adminName}
            onChange={(e) => set('adminName', e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="phone">Telefone</Label>
          <PhoneInput id="phone" value={form.phone} onChange={(v) => set('phone', v)} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="register-email">E-mail</Label>
        <Input
          id="register-email"
          type="email"
          required
          icon={<Mail />}
          value={form.email}
          onChange={(e) => set('email', e.target.value)}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="register-password">Senha</Label>
          <PasswordInput
            id="register-password"
            autoComplete="new-password"
            required
            minLength={8}
            placeholder="Mínimo de 8 caracteres"
            value={form.password}
            onChange={(e) => set('password', e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="register-confirmacao">Confirmar senha</Label>
          <PasswordInput
            id="register-confirmacao"
            autoComplete="new-password"
            required
            placeholder="Repita a senha"
            value={form.confirmacao}
            onChange={(e) => set('confirmacao', e.target.value)}
            aria-invalid={naoConfere}
            className={naoConfere ? 'border-destructive focus-visible:border-destructive' : undefined}
          />
          {naoConfere ? (
            <p className="text-xs font-medium text-destructive">As duas senhas estão diferentes.</p>
          ) : null}
        </div>
      </div>

      {plan ? (
        <div className="flex items-center justify-between gap-3 rounded-xl bg-muted/60 px-3.5 py-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Plano escolhido
            </p>
            <p className="mt-0.5 truncate text-sm font-semibold">
              {plan.name}
              <span className="font-normal text-muted-foreground">
                {' '}· {currency(plan.price)}/mês · {plan.trialDays} dias grátis
              </span>
            </p>
          </div>
          {/* <a> e não <Link> de propósito: o React Router troca a rota sem
              recarregar e não rola até a âncora, então o "#planos" seria
              ignorado e a pessoa cairia no topo da landing. */}
          <a
            href="/#planos"
            className="shrink-0 text-xs font-semibold text-primary hover:underline"
          >
            Trocar
          </a>
        </div>
      ) : null}

      <Button type="submit" className="w-full" size="lg" loading={loading}>
        Criar minha conta
      </Button>
    </form>
  );
}
