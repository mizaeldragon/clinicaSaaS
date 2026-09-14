import { useState } from 'react';
import { Building2, Check, Mail, User } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { cn } from '@/lib/utils';
import { ApiError } from '@/lib/api';

/** A metade "Criar conta" do cartão de autenticação. */
export function RegisterForm({ onCreated }: { onCreated: () => void }) {
  const register = useAuthStore((state) => state.register);
  const { data: plans } = usePublicPlans();

  const [form, setForm] = useState({
    companyName: '',
    companyType: 'OTHER',
    adminName: '',
    email: '',
    password: '',
    phone: '',
  });
  const [planSlug, setPlanSlug] = useState<string>('pro');
  const [loading, setLoading] = useState(false);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    try {
      await register({
        company: { name: form.companyName, type: form.companyType, phone: form.phone || undefined },
        admin: {
          name: form.adminName,
          email: form.email,
          password: form.password,
          phone: form.phone || undefined,
        },
        planSlug,
      });
      toast.success('Empresa criada! Vamos configurar seus módulos.');
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
          <Input
            id="phone"
            placeholder="(11) 99999-0000"
            value={form.phone}
            onChange={(e) => set('phone', e.target.value)}
          />
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

      <div className="space-y-1.5">
        <Label htmlFor="register-password">Senha</Label>
        <Input
          id="register-password"
          type="password"
          required
          minLength={8}
          placeholder="Mínimo de 8 caracteres"
          value={form.password}
          onChange={(e) => set('password', e.target.value)}
        />
      </div>

      {plans?.length ? (
        <div className="space-y-2">
          <Label>Plano inicial</Label>
          <div className="grid gap-2">
            {plans.map((plan) => (
              <button
                key={plan.slug}
                type="button"
                onClick={() => setPlanSlug(plan.slug)}
                className={cn(
                  'flex items-center justify-between rounded-xl border p-3 text-left transition-all',
                  planSlug === plan.slug
                    ? 'border-primary bg-primary/5 ring-1 ring-primary'
                    : 'border-border hover:border-primary/40',
                )}
              >
                <div>
                  <p className="flex items-center gap-2 text-sm font-medium">
                    {plan.name}
                    {planSlug === plan.slug ? <Check className="size-4 text-primary" /> : null}
                  </p>
                  <p className="text-xs text-muted-foreground">{plan.description}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">{currency(plan.price)}</p>
                  <p className="text-[11px] text-muted-foreground">{plan.trialDays} dias grátis</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <Button type="submit" className="w-full" size="lg" loading={loading}>
        Criar minha conta
      </Button>
    </form>
  );
}
