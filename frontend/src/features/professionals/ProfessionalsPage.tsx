import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Link2, MoreHorizontal, Pencil, Plus, Trash2, UserCog } from 'lucide-react';
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

export function ProfessionalsPage() {
  const canManage = useAuthStore((s) => s.can('professionals:manage'));
  const company = useAuthStore((s) => s.company);
  const { data, isLoading } = useProfessionals({});
  const { remove } = useProfessionalMutations();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Professional | null>(null);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Profissionais"
        description="Equipe, especialidades, jornada de trabalho e comissões"
        actions={
          canManage ? (
            <Button
              onClick={() => {
                setEditing(null);
                setDialogOpen(true);
              }}
            >
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
      ) : data?.data.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.data.map((professional) => (
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
                  <p className="truncate text-xs text-muted-foreground">
                    {phoneMask(professional.phone)}
                  </p>
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
                          onSelect={() =>
                            copyLink(publicBookingUrl(company.slug, professional.publicSlug))
                          }
                        >
                          <Link2 />
                          Copiar link de agendamento
                        </DropdownMenuItem>
                      ) : null}
                      <DropdownMenuItem destructive onSelect={() => remove.mutate(professional.id)}>
                        <Trash2 />
                        Remover
                      </DropdownMenuItem>
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
          ))}
        </div>
      ) : (
        <EmptyState
          icon={UserCog}
          title="Nenhum profissional cadastrado"
          description="Cadastre sua equipe para organizar agendas individuais e calcular comissões."
          action={
            canManage
              ? {
                  label: 'Cadastrar profissional',
                  onClick: () => {
                    setEditing(null);
                    setDialogOpen(true);
                  },
                }
              : undefined
          }
        />
      )}

      <ProfessionalDialog open={dialogOpen} onOpenChange={setDialogOpen} professional={editing} />
    </div>
  );
}
