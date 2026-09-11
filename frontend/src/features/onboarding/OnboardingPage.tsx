import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Check, PartyPopper, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { usePlans } from '@/api/queries';
import { useAuthStore } from '@/stores/auth.store';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/primitives';
import { MODULE_ICONS } from '@/config/navigation';
import { cn } from '@/lib/utils';
import { handleError } from '@/api/queries';
import { MODULE_LABELS } from '@/lib/modules';
import type { ModuleKey } from '@/types';

interface Options {
  companyTypes: { value: string; label: string }[];
  services: { key: string; label: string; category: string }[];
  rentalResources: { key: string; label: string }[];
}

const CORE: ModuleKey[] = ['appointments', 'customers', 'services'];

const STEPS = ['Tipo de negócio', 'Serviços', 'Estrutura', 'Módulos'];

export function OnboardingPage() {
  const navigate = useNavigate();
  const { company, refreshContext } = useAuthStore();

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [answers, setAnswers] = useState({
    companyType: (company?.type ?? 'OTHER') as string,
    serviceKeys: [] as string[],
    hasProfessionals: false,
    usesCommission: false,
    hasRooms: false,
    rentsSpaces: false,
    rentalResourceKeys: [] as string[],
  });
  const [modules, setModules] = useState<ModuleKey[]>([]);
  const { data: plans } = usePlans();

  /**
   * Menor plano que inclui o módulo — é o que a empresa precisa assinar para
   * destravar. Sem isso, "fora do seu plano" não diz o que fazer a respeito.
   */
  const planWith = (module: ModuleKey): string | null =>
    (plans ?? []).find((plan) => plan.modules.includes(module))?.name ?? null;

  const { data: options } = useQuery<Options>({
    queryKey: ['onboarding-options'],
    queryFn: () => api.get<Options>('/onboarding/options'),
  });

  // Ao chegar na revisão, busca a sugestão de módulos do backend.
  useEffect(() => {
    if (step !== 3) return;
    api
      .post<{ modules: ModuleKey[] }>('/onboarding/preview', answers)
      .then((data) => setModules(data.modules))
      .catch(() => undefined);
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  const groupedServices = useMemo(() => {
    const groups = new Map<string, Options['services']>();
    for (const service of options?.services ?? []) {
      const list = groups.get(service.category) ?? [];
      list.push(service);
      groups.set(service.category, list);
    }
    return [...groups.entries()];
  }, [options]);

  function toggle<T>(list: T[], value: T): T[] {
    return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
  }

  async function finish() {
    setSaving(true);
    try {
      await api.post('/onboarding/complete', { ...answers, modules, seedCatalog: true });
      await refreshContext();
      toast.success('Tudo pronto! Sua empresa está configurada.');
      navigate('/app', { replace: true });
    } catch (error) {
      handleError(error, 'Não foi possível concluir o onboarding');
    } finally {
      setSaving(false);
    }
  }

  const canAdvance = step === 0 ? Boolean(answers.companyType) : true;

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 via-background to-background px-4 py-8 sm:py-14">
      <div className="mx-auto w-full max-w-3xl space-y-8">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Sparkles className="size-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              Vamos configurar a {company?.name ?? 'sua empresa'}
            </h1>
            <p className="text-sm text-muted-foreground">
              Suas respostas definem quais módulos ficam ativos — nada é obrigatório.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {STEPS.map((label, index) => (
            <div key={label} className="flex flex-1 flex-col gap-1.5">
              <div
                className={cn(
                  'h-1.5 rounded-full transition-colors',
                  index <= step ? 'bg-primary' : 'bg-border',
                )}
              />
              <span
                className={cn(
                  'text-[11px] font-medium',
                  index === step ? 'text-primary' : 'text-muted-foreground',
                )}
              >
                {label}
              </span>
            </div>
          ))}
        </div>

        <Card className="p-6 sm:p-8">
          {step === 0 ? (
            <div className="space-y-4">
              <div className="space-y-1">
                <h2 className="text-lg font-semibold">Qual o tipo da sua empresa?</h2>
                <p className="text-sm text-muted-foreground">
                  Usamos isso para sugerir a configuração inicial.
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {options?.companyTypes.map((type) => (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => setAnswers((a) => ({ ...a, companyType: type.value }))}
                    className={cn(
                      'flex items-center justify-between rounded-xl border p-3.5 text-left text-sm transition-all',
                      answers.companyType === type.value
                        ? 'border-primary bg-primary/5 font-medium ring-1 ring-primary'
                        : 'hover:border-primary/40 hover:bg-muted/50',
                    )}
                  >
                    {type.label}
                    {answers.companyType === type.value ? (
                      <Check className="size-4 text-primary" />
                    ) : null}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {step === 1 ? (
            <div className="space-y-5">
              <div className="space-y-1">
                <h2 className="text-lg font-semibold">Quais serviços sua empresa oferece?</h2>
                <p className="text-sm text-muted-foreground">
                  Vamos criar as categorias e um catálogo inicial — você pode editar depois.
                </p>
              </div>

              {groupedServices.map(([category, services]) => (
                <div key={category} className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {category}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {services.map((service) => {
                      const selected = answers.serviceKeys.includes(service.key);
                      return (
                        <button
                          key={service.key}
                          type="button"
                          onClick={() =>
                            setAnswers((a) => ({
                              ...a,
                              serviceKeys: toggle(a.serviceKeys, service.key),
                            }))
                          }
                          className={cn(
                            'rounded-full border px-3.5 py-1.5 text-sm transition-all',
                            selected
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'hover:border-primary/40 hover:bg-muted',
                          )}
                        >
                          {service.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {step === 2 ? (
            <div className="space-y-5">
              <div className="space-y-1">
                <h2 className="text-lg font-semibold">Como sua empresa funciona?</h2>
                <p className="text-sm text-muted-foreground">
                  Responda para ativarmos apenas o que faz sentido para você.
                </p>
              </div>

              <div className="divide-y rounded-xl border">
                <YesNo
                  label="Sua empresa possui profissionais?"
                  hint="Equipe com agenda própria, especialidades e horários."
                  value={answers.hasProfessionals}
                  onChange={(v) => setAnswers((a) => ({ ...a, hasProfessionals: v }))}
                />
                <YesNo
                  label="Sua empresa trabalha com comissão?"
                  hint="Cálculo automático por serviço ou profissional."
                  value={answers.usesCommission}
                  onChange={(v) => setAnswers((a) => ({ ...a, usesCommission: v }))}
                />
                <YesNo
                  label="Sua empresa possui salas?"
                  hint="Salas de atendimento com controle de ocupação."
                  value={answers.hasRooms}
                  onChange={(v) => setAnswers((a) => ({ ...a, hasRooms: v }))}
                />
                <YesNo
                  label="Sua empresa aluga espaços?"
                  hint="Mesas, cadeiras ou salas alugadas para profissionais."
                  value={answers.rentsSpaces}
                  onChange={(v) => setAnswers((a) => ({ ...a, rentsSpaces: v }))}
                />
              </div>

              {answers.rentsSpaces ? (
                <div className="space-y-2 rounded-xl border border-primary/30 bg-primary/5 p-4">
                  <p className="text-sm font-medium">O que você aluga?</p>
                  <div className="flex flex-wrap gap-2">
                    {options?.rentalResources.map((resource) => {
                      const selected = answers.rentalResourceKeys.includes(resource.key);
                      return (
                        <button
                          key={resource.key}
                          type="button"
                          onClick={() =>
                            setAnswers((a) => ({
                              ...a,
                              rentalResourceKeys: toggle(a.rentalResourceKeys, resource.key),
                            }))
                          }
                          className={cn(
                            'rounded-full border px-3.5 py-1.5 text-sm transition-all',
                            selected
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-border bg-card hover:border-primary/40',
                          )}
                        >
                          {resource.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-5">
              <div className="space-y-1">
                <h2 className="text-lg font-semibold">Módulos sugeridos</h2>
                <p className="text-sm text-muted-foreground">
                  Ajuste o que quiser — você pode ativar ou desativar módulos depois em
                  Configurações.
                </p>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                {(Object.keys(MODULE_LABELS) as ModuleKey[]).map((module) => {
                  const Icon = MODULE_ICONS[module];
                  const enabled = modules.includes(module) || CORE.includes(module);
                  const locked = CORE.includes(module);
                  const inPlan = company?.plan?.modules.includes(module) ?? true;

                  return (
                    <label
                      key={module}
                      className={cn(
                        'flex items-center gap-3 rounded-xl border p-3.5 transition-all',
                        enabled ? 'border-primary/40 bg-primary/5' : 'border-border',
                        !inPlan && 'opacity-50',
                      )}
                    >
                      <div
                        className={cn(
                          'flex size-9 items-center justify-center rounded-lg',
                          enabled ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground',
                        )}
                      >
                        <Icon className="size-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{MODULE_LABELS[module]}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {locked
                            ? 'Essencial'
                            : inPlan
                              ? 'Opcional'
                              : `Disponível no plano ${planWith(module) ?? 'superior'}`}
                        </p>
                      </div>
                      <Switch
                        checked={enabled}
                        disabled={locked || !inPlan}
                        onCheckedChange={() =>
                          setModules((prev) =>
                            prev.includes(module)
                              ? prev.filter((m) => m !== module)
                              : [...prev, module],
                          )
                        }
                      />
                    </label>
                  );
                })}
              </div>
            </div>
          ) : null}
        </Card>

        <div className="flex items-center justify-between gap-3">
          <Button
            variant="ghost"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
          >
            <ArrowLeft />
            Voltar
          </Button>

          {step < 3 ? (
            <Button onClick={() => setStep((s) => s + 1)} disabled={!canAdvance}>
              Continuar
              <ArrowRight />
            </Button>
          ) : (
            <Button onClick={finish} loading={saving} size="lg">
              <PartyPopper />
              Concluir configuração
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function YesNo({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 p-4">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1 rounded-lg bg-muted p-1">
        <button
          type="button"
          onClick={() => onChange(false)}
          className={cn(
            'rounded-md px-3 py-1 text-xs font-medium transition-all',
            !value ? 'bg-card shadow-soft' : 'text-muted-foreground',
          )}
        >
          Não
        </button>
        <button
          type="button"
          onClick={() => onChange(true)}
          className={cn(
            'rounded-md px-3 py-1 text-xs font-medium transition-all',
            value ? 'bg-primary text-primary-foreground shadow-soft' : 'text-muted-foreground',
          )}
        >
          Sim
        </button>
      </div>
    </div>
  );
}
