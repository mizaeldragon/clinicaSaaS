import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  KeyRound,
  Link2,
  MoreHorizontal,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  UserCog,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/data';
import { EmptyState, Skeleton } from '@/components/ui/feedback';
import { UserAvatar } from '@/components/ui/primitives';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useProfessionalMutations, useProfessionals } from '@/api/queries';
import { useAuthStore } from '@/stores/auth.store';
import { phoneMask } from '@/lib/format';
import { publicBookingUrl } from '@/components/PublicLinkCard';
import { ProfessionalDialog } from './ProfessionalDialog';
import type { Professional } from '@/types';

/** O link individual da profissional, pronto para mandar por WhatsApp. */
async function copyLink(url: string) {
  try {
    await navigator.clipboard.writeText(url);
  } catch {
    // Clipboard bloqueado: o link continua acessível pela página da profissional.
  }
}

const ehLocataria = (professional: Professional) => professional.revenueOwner === 'PROFESSIONAL';

/**
 * A equipe da casa e quem aluga o espaço.
 *
 * São dois negócios na mesma lista: a dona paga a equipe e fatura o atendimento
 * dela; da locatária ela fatura o turno, e o atendimento é negócio de outra
 * pessoa. Misturadas, as duas perguntas que esta tela responde — "quem trabalha
 * comigo?" e "quem está alugando?" — vinham embaralhadas na mesma resposta.
 *
 * A divisão só aparece onde o aluguel existe. Numa clínica comum a tela continua
 * sendo uma lista só, como sempre foi.
 */
export function ProfessionalsPage() {
  const canManage = useAuthStore((s) => s.can('professionals:manage'));
  const company = useAuthStore((s) => s.company);
  const hasRentals = useAuthStore((s) => s.hasModule('rentals'));
  const { data, isLoading } = useProfessionals({});
  const { remove, update } = useProfessionalMutations();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Professional | null>(null);
  const [mostrarInativas, setMostrarInativas] = useState(false);

  /*
   * Quem saiu não convive com quem atende.
   *
   * Profissional com histórico não é apagada — vira inativa, senão o
   * atendimento, a comissão e o turno alugado dela iriam junto. Só que
   * misturada às outras ela parece ativa, e a lista de uma casa com rotatividade
   * vira um cemitério onde a dona procura quem está trabalhando hoje.
   */
  const todas = data?.data ?? [];
  const inativas = todas.filter((p) => !p.isActive);
  const visiveis = mostrarInativas ? todas : todas.filter((p) => p.isActive);

  const equipe = visiveis.filter((p) => !ehLocataria(p));
  const locatarias = visiveis.filter(ehLocataria);

  const abrirNova = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const cartao = (professional: Professional) => (
    <Card key={professional.id} className="p-5 transition-shadow hover:shadow-pop">
      <div className="flex items-start gap-3">
        <UserAvatar
          name={professional.name}
          src={professional.avatarUrl}
          color={professional.color}
          className="size-12"
        />
        <div className="min-w-0 flex-1">
          <Link
            to={`/app/profissionais/${professional.id}`}
            className="truncate font-semibold hover:text-primary"
          >
            {professional.name}
          </Link>
          <p className="truncate text-xs text-muted-foreground">{phoneMask(professional.phone)}</p>
          {/* Sem o selo de locatária aqui: a seção já diz de quem é o cartão, e
              repetir em cada um seria ruído. O de inativo continua, porque ele
              vale dentro de qualquer uma das duas. */}
          {!professional.isActive ? (
            <Badge variant="muted" className="mt-1">
              Inativo
            </Badge>
          ) : null}
        </div>

        {canManage ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm">
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onSelect={() => {
                  setEditing(professional);
                  setDialogOpen(true);
                }}
              >
                <Pencil />
                Editar
              </DropdownMenuItem>
              {professional.publicSlug && company?.slug ? (
                <DropdownMenuItem
                  onSelect={() => copyLink(publicBookingUrl(company.slug, professional.publicSlug))}
                >
                  <Link2 />
                  Copiar link de agendamento
                </DropdownMenuItem>
              ) : null}
              {/* Inativa não se remove de novo — o caminho que falta é o de volta. */}
              {professional.isActive ? (
                <DropdownMenuItem destructive onSelect={() => remove.mutate(professional.id)}>
                  <Trash2 />
                  Remover
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  onSelect={() => update.mutate({ id: professional.id, isActive: true })}
                >
                  <RotateCcw />
                  Reativar
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>

      {professional.specialties.length ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {professional.specialties.map((specialty) => (
            <Badge key={specialty} variant="secondary">
              {specialty}
            </Badge>
          ))}
        </div>
      ) : null}

      <div className="mt-4 flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
        <span>{professional._count?.appointments ?? 0} atendimentos</span>
        <Link
          to={`/app/profissionais/${professional.id}`}
          className="font-medium text-primary hover:underline"
        >
          Ver painel →
        </Link>
      </div>
    </Card>
  );

  const secao = (
    icone: typeof UserCog,
    titulo: string,
    explicacao: string,
    lista: Professional[],
    vazio: React.ReactNode,
  ) => {
    const Icone = icone;
    return (
      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Icone className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">{titulo}</h2>
          <span className="text-xs text-muted-foreground">{explicacao}</span>
        </div>

        {lista.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{lista.map(cartao)}</div>
        ) : (
          <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            {vazio}
          </p>
        )}
      </section>
    );
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Profissionais"
        description={
          hasRentals
            ? 'Quem trabalha na casa e quem aluga o espaço'
            : 'Equipe, especialidades, jornada de trabalho e comissões'
        }
        actions={
          canManage ? (
            <Button onClick={abrirNova}>
              <Plus />
              Novo profissional
            </Button>
          ) : null
        }
      />

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-44 rounded-xl" />
          ))}
        </div>
      ) : !visiveis.length ? (
        <EmptyState
          icon={UserCog}
          title={inativas.length ? 'Nenhuma profissional ativa' : 'Nenhum profissional cadastrado'}
          description={
            inativas.length
              ? 'Todas as profissionais cadastradas estão inativas. Cadastre uma nova ou reative alguma.'
              : 'Cadastre sua equipe para organizar agendas individuais e calcular comissões.'
          }
          action={canManage ? { label: 'Cadastrar profissional', onClick: abrirNova } : undefined}
        />
      ) : !hasRentals ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{visiveis.map(cartao)}</div>
      ) : (
        <div className="space-y-7">
          {secao(
            UserCog,
            'Equipe da casa',
            'atendem pela empresa · a receita entra no seu caixa',
            equipe,
            'Ninguém da casa cadastrado — só locatárias por enquanto.',
          )}

          {secao(
            KeyRound,
            'Locatárias',
            'alugam o espaço · cobram as próprias clientes',
            locatarias,
            <>
              Nenhuma locatária ainda. Elas entram junto com o contrato, em{' '}
              <Link to="/app/alugueis" className="font-medium text-primary hover:underline">
                Aluguéis
              </Link>
              .
            </>,
          )}
        </div>
      )}

      {inativas.length ? (
        <button
          type="button"
          onClick={() => setMostrarInativas((atual) => !atual)}
          className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          {mostrarInativas
            ? 'Ocultar inativas'
            : `Mostrar ${inativas.length} ${inativas.length === 1 ? 'inativa' : 'inativas'}`}
        </button>
      ) : null}

      <ProfessionalDialog open={dialogOpen} onOpenChange={setDialogOpen} professional={editing} />
    </div>
  );
}
